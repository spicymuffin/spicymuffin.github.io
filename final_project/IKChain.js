import * as THREE from 'three';

import * as objutils from './objutils.js';


export class IKJointConstraint {
    constructor(jointIndex) {
        this.jointIndex = jointIndex;
        this.isActive = true;
    }
    apply(/* joints, i, boneObjs */) {
        throw new Error('apply() must be implemented by subclass');
    }
}

export class IKConeConstraint extends IKJointConstraint {
    // joint is the joint to be constrained
    // checker is a function that checks if the joint is within the constraint
    constructor(joint, checker) {
        super(joint)
    }

    apply() {
    }
}

// implement constraints....
export class IKAxisConstraint extends IKJointConstraint {
    constructor(jointIndex, axis, options = {}) {
        super(jointIndex);
        this.axis = axis.clone().normalize();

        this.project = options.project || false;
        this.local = options.local || false;
        this.reference = options.reference || null;
    }

    apply(joints, i, boneObjs = null) {

    }
}

// only pass this world space locations
// also the polePosition is a reference, so updating the polePosition will update the IKPole
// by default, the pole also defines the rotation of the joint too. the joint will align its +Z axis to the pole direction
export class IKPole {
    constructor(poleObject, strength = 0.1, angle = 0) {
        this.poleObject = poleObject;
        this.strength = strength;
        this.angle = angle;
    }

    // return anonymous pole direction
    getPoleDirectionVector(origin) {
        // update world matrix
        this.poleObject.updateWorldMatrix(true, false);
        // get the pole direction in world space
        const poleDir = this.poleObject.getWorldPosition(new THREE.Vector3());
        poleDir.sub(origin).normalize();

        // console.log(this.poleObject.name, 'poleDir:', poleDir.x, poleDir.y, poleDir.z);
        return poleDir;
    }
}

function signedAngleBetween(a, b, normal) {
    const angle = a.angleTo(b);
    const cross = new THREE.Vector3().crossVectors(a, b);
    return normal.dot(cross) > 0 ? angle : -angle;
}

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positions
    constructor(endEffectorBone, njoints, scene, constraints = null, poles = null, options = {}) {
        this.chainLength = njoints;
        this.debug = options.debug || false;
        if (this.debug) {
            this.jointVisualizers = [];
        }

        this.endEffectorBone = endEffectorBone;
        this.sceneRef = scene;

        // default pole is above the IK chain
        this.defaultPole = options.defaultPole || null;

        if (constraints) {
            this.constraints = constraints;
        } else {
            this.constraints = [];
            this.constraints.length = njoints;
        }

        if (poles) {
            this.poles = poles;
        } else {
            // if no poles are given, create array of nulls
            this.poles = [];
            this.poles.length = njoints;
            for (let i = 0; i < njoints; i++) {
                this.poles[i] = null;
            }
        }

        if (njoints < 2) {
            throw new Error('chain length must be at least 2');
        }
        if (!endEffectorBone) {
            throw new Error('end effector must be non null');
        }

        // proxyJoints[0]                        is the end effector
        // proxyJoints[chainLength - 1]          is the root joint
        this.proxyJoints = [];
        let iterator = endEffectorBone;
        for (let i = 0; i < njoints; i++) {
            if (this.debug) {
                console.log(`adding proxy joint ${i} for ${iterator.name}`);
            }
            this.proxyJoints.push(new THREE.Object3D());
            iterator.updateWorldMatrix(true, false);
            // copy the world position of the joint into the proxy joint
            this.proxyJoints[i].position.copy(iterator.getWorldPosition(new THREE.Vector3()));
            // copy the world rotation of the joint into the proxy joint
            this.proxyJoints[i].quaternion.copy(iterator.getWorldQuaternion(new THREE.Quaternion()));
            iterator = iterator.parent;
            this.sceneRef.add(this.proxyJoints[i]);
        }

        // set the root joint to be the last joint in the chain
        this.rootPos = new THREE.Vector3().copy(this.proxyJoints[this.proxyJoints.length - 1].position);
        if (options.rootPos) {
            this.rootPos.copy(options.rootPos);
        }

        // calculate the distance between the joints
        this.jointDistances = [];
        for (let i = 0; i < this.proxyJoints.length - 1; i++) {
            const dist = this.proxyJoints[i].position.distanceTo(this.proxyJoints[i + 1].position);
            this.jointDistances.push(dist);
        }

        if (this.debug) {
            for (let i = 0; i < this.proxyJoints.length; i++) {
                console.log(`adding proxy joint ${i} to scene`);
                const sphere = objutils.createSphere({ radius: 0.2, color: 0xff00ff });
                sphere.quaternion.copy(this.proxyJoints[i].quaternion);
                sphere.name = `proxy_${i}`;

                this.jointVisualizers.push(sphere);
                this.proxyJoints[i].add(sphere);
                const axis = new THREE.AxesHelper(0.6);
                axis.raycast = () => { };
                sphere.add(axis);

                // add a box to visualize the bone
                if (i > 0) {
                    const boneThickness = 0.02;
                    const boneLength = this.jointDistances[i - 1];

                    const bone = objutils.createBox({
                        size: new THREE.Vector3(boneThickness, boneLength, boneThickness),
                        color: 0xffffff,
                        originShift: new THREE.Vector3(0, -0.5 * boneLength, 0)
                    });

                    sphere.add(bone);
                }
            }
        }

    }

    applyConstraints(i) {
        if (!this.constraints) return;
        for (const c of this.constraints) c.apply(this.proxyJoints, i, this.proxyJoints);
    }

    // index is the index of the joint to be biased towards the pole
    lookupPole(index) {
        if (this.poles[index]) {
            return this.poles[index];
        } else {
            return null;
        }
    }

    // solves using FABRIK
    // TODO: add CCD...?
    solve(target, tolerance = 0.01, maxIterations = 50) {

        for (let i = 0; i < maxIterations; i++) {
            target.updateWorldMatrix(true, false);
            let targetPos = target.getWorldPosition(new THREE.Vector3());
            let targetQuat = target.getWorldQuaternion(new THREE.Quaternion());
            this.doForwardPass(targetPos, targetQuat);
            this.doBackwardPass(this.rootPos);

            // check if the end effector is within tolerance of the target
            // let dist = this.proxyJoints[0].position.distanceTo(targetPos);
            // if (dist < tolerance) {
            //     // if the end effector is within tolerance, we are done
            //     if (this.debug) {
            //         console.log(`FABRIK converged in ${i + 1} iterations`);
            //     }
            //     return;
            // }
        }
    }

    doForwardPass(targetPos, targetQuat) {
        // set the end effector to the target position
        this.proxyJoints[0].position.copy(targetPos);
        // set the end effector's rotation to the target's rotation
        this.proxyJoints[0].quaternion.copy(targetQuat);

        // iterate over the joints
        for (let i = 1; i < this.proxyJoints.length; i++) {
            // i-1th joint is the child of the ith joint

            // get pole object
            let pole = this.lookupPole(i);

            // if no pole is defined, we will use a default pole
            let poleDir = null;
            // if it is defined, we need to bias the joint towards the pole and also retreive the pole direction
            if (pole) {
                // get pole direction (if its already a vector, getPoleDirection returns the vector)
                poleDir = pole.getPoleDirectionVector(this.proxyJoints[i].position);
                // bias the joint position towards the pole
                // compute a position for lerping
                let biasPos = this.proxyJoints[i].position.clone().add(poleDir.clone());
                // lerp towards the pole direction
                this.proxyJoints[i].position.lerp(biasPos, pole.strength);

                // const zLocal = new THREE.Vector3(0, 0, 1);
                // const joint = this.proxyJoints[i];
                // const worldZ = zLocal.applyQuaternion(joint.quaternion).normalize();

                // poleDir = worldZ.clone();

                // recalculate the pole direction since we moved the joint
                poleDir = pole.getPoleDirectionVector(this.proxyJoints[i].position);
            }
            // if no pole defined, we will only disambiguate joint roll using the joint's local +Z axis
            // unless some default parameters are given
            // TODO: add support for default parameters
            else {
                // if no default pole is given, use the joint's local +Z axis as the pole direction
                const zLocal = new THREE.Vector3(0, 0, 1);
                const joint = this.proxyJoints[i];
                const worldZ = zLocal.applyQuaternion(joint.quaternion).normalize();

                poleDir = worldZ.clone();
            }

            // calculate forward direction for the joint
            let forward = new THREE.Vector3().subVectors(this.proxyJoints[i - 1].position, this.proxyJoints[i].position).normalize();

            // align joint's +Y with the forward direction
            let baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.clone());

            // transform the local pole direction (+Z) to world space
            let localZ = new THREE.Vector3(0, 0, 1);
            let currentZWorld = localZ.clone().applyQuaternion(baseQuat);

            // project the poleDir onto the plane orthogonal to forward
            let projectedPole = poleDir.clone().sub(forward.clone().multiplyScalar(poleDir.dot(forward))).normalize();

            // project the current Z axis (after rotating by baseQuat) onto same plane
            let projectedCurrentZ = currentZWorld.clone().sub(forward.clone().multiplyScalar(currentZWorld.dot(forward))).normalize();

            // compute the angle from projected Z to projected pole
            let twistAngle = signedAngleBetween(projectedCurrentZ, projectedPole, forward);

            // the pole angle is used to adjust the twist
            twistAngle += pole.angle;

            // apply twist around the forward direction (note: forward points out of the screen)
            let twistQuat = new THREE.Quaternion().setFromAxisAngle(forward, twistAngle);

            // combine the base look rotation with the twist
            let finalQuat = twistQuat.multiply(baseQuat);

            // set the joint's rotation to the final quaternion
            this.proxyJoints[i].quaternion.copy(finalQuat);

            // move the joint along the forward direction to compensate for the distance change
            let dist = this.jointDistances[i - 1];

            this.proxyJoints[i].position.copy(this.proxyJoints[i - 1].position.clone().add(forward.clone().multiplyScalar(-dist)));

            if (this.debug) {
                // // draw projected pole
                // this.sceneRef.add(objutils.drawVector(this.proxyJoints[i].position, projectedPole, 0xffff00)); // yellow
                // // draw the pole direction
                // this.sceneRef.add(objutils.drawVector(this.proxyJoints[i].position, poleDir, 0x0000ff)); // blue
                // // draw the forward direction
                // this.sceneRef.add(objutils.drawVector(this.proxyJoints[i].position, forward, 0x00ffff)); // cyan
                // // draw currentZworld
                // this.sceneRef.add(objutils.drawVector(this.proxyJoints[i].position, currentZWorld, 0xff00ff)); // magenta
                // // draw the projected currentZ
                // this.sceneRef.add(objutils.drawVector(this.proxyJoints[i].position, projectedCurrentZ, 0x00ff00)); // green
                // console.log(`joint ${i} twist angle: ${twistAngle * 180 / Math.PI}`);
            }

            // apply constraints
            this.applyConstraints(i);
        }
    }

    doBackwardPass(rootPos) {
        this.proxyJoints[this.proxyJoints.length - 1].position.copy(rootPos);
        // we dont need to set the rotation of the root joint, since that will be handled by constraints

        // iterate over the joints
        for (let i = this.proxyJoints.length - 2; i >= 0; i--) {
            // i+1th joint is the parent of the ith joint

            // get pole object
            let pole = this.lookupPole(i + 1);

            let poleDir = null;
            // if no pole is defined, we will use a default pole
            if (pole) {
                // // get pole direction (if its already a vector, getPoleDirection returns the vector)
                // poleDir = pole.getPoleDirectionVector(this.proxyJoints[i + 1].position);
                // // bias the joint position towards the pole
                // // compute a position for lerping
                // let biasPos = this.proxyJoints[i + 1].position.clone().add(poleDir.clone());
                // // lerp towards the pole direction
                // this.proxyJoints[i + 1].position.lerp(biasPos, pole.strength);

                // const zLocal = new THREE.Vector3(0, 0, 1);
                // const joint = this.proxyJoints[i + 1];
                // const worldZ = zLocal.applyQuaternion(joint.quaternion).normalize();

                // poleDir = worldZ.clone();

                // recalculate the pole direction since we moved the joint
                poleDir = pole.getPoleDirectionVector(this.proxyJoints[i + 1].position);
            }
            // if no pole defined, we will only disambiguate joint roll using the joint's local +Z axis
            // unless some default parameters are given
            // TODO: add support for default parameters
            else {
                // if no default pole is given, use the joint's local +Z axis as the pole direction
                const zLocal = new THREE.Vector3(0, 0, 1);
                const joint = this.proxyJoints[i + 1];
                const worldZ = zLocal.applyQuaternion(joint.quaternion).normalize();

                poleDir = worldZ.clone();
            }

            // calculate forward direction for the joint
            let forward = new THREE.Vector3().subVectors(this.proxyJoints[i].position, this.proxyJoints[i + 1].position).normalize();

            // align joint's +Y with the forward direction
            let baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.clone());

            // transform the local pole direction (+Z) to world space
            let localZ = new THREE.Vector3(0, 0, 1);
            let currentZWorld = localZ.clone().applyQuaternion(baseQuat);

            // project the poleDir onto the plane orthogonal to forward
            let projectedPole = poleDir.clone().sub(forward.clone().multiplyScalar(poleDir.dot(forward))).normalize();

            // project the current Z axis (after rotating by baseQuat) onto same plane
            let projectedCurrentZ = currentZWorld.clone().sub(forward.clone().multiplyScalar(currentZWorld.dot(forward))).normalize();

            // compute the angle from projected Z to projected pole
            let twistAngle = signedAngleBetween(projectedCurrentZ, projectedPole, forward);

            // the pole angle is used to adjust the twist
            twistAngle += pole.angle;

            // apply twist around the forward direction (note: forward points out of the screen)
            let twistQuat = new THREE.Quaternion().setFromAxisAngle(forward, twistAngle);

            // combine the base look rotation with the twist
            let finalQuat = twistQuat.multiply(baseQuat);

            // set the joint's rotation to the final quaternion
            this.proxyJoints[i + 1].quaternion.copy(finalQuat);

            if (this.debug) {
                // // draw the basis
                // const basis = objutils.drawArrows(this.proxyJoints[i].position, poleForwardOrtho, forward, poleRef);
                // this.sceneRef.add(basis);

                // console.log(`joint ${i} position: ${this.proxyJoints[i].position.x}, ${this.proxyJoints[i].position.y}, ${this.proxyJoints[i].position.z}`);
            }

            // move the joint along the forward direction to compensate for the distance change
            let dist = this.jointDistances[i];
            this.proxyJoints[i].position.copy(this.proxyJoints[i + 1].position.clone().add(forward.clone().multiplyScalar(dist)));

            // apply constraints
            this.applyConstraints(i);
        }

    }
}