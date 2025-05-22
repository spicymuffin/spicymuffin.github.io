import * as THREE from 'three';

import * as objutils from './objutils.js';

function signedAngleBetween(a, b, normal) {
    const angle = a.angleTo(b);
    const cross = new THREE.Vector3().crossVectors(a, b);
    return normal.dot(cross) > 0 ? angle : -angle;
}

export class IKJointConstraint {
    constructor(jointIndex, chain) {
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
    constructor(jointIndex, chain, axis, options = {}) {
        super(jointIndex, chain);
        this.axis = axis.clone().normalize();

    }

    apply() {

    }
}

// only pass this world space locations
// also the polePosition is a reference, so updating the polePosition will update the IKPole
// by default, the pole also defines the rotation of the joint too. the joint will align its +Z axis to the pole direction
export class IKPoleConstraint extends IKJointConstraint {
    constructor(jointIndex, chain, poleRef, angle = 0, options = {}) {
        super(jointIndex, chain);
        this.poleRef = poleRef;
        this.angle = angle;
        this.chain = chain;
        this.debug = options.debug || false;
    }

    apply() {
        // rotate the joint around chainDirection towards polePosition
        const pole = this.poleRef.position.clone();
        const joint = this.chain.proxyJoints[this.jointIndex].position;
        const root = this.chain.proxyJoints[this.jointIndex + 1].position;
        const end = this.chain.proxyJoints[this.jointIndex - 1].position;

        const chainVec = new THREE.Vector3().subVectors(end, root).normalize();

        const poleDir = new THREE.Vector3().subVectors(pole, root).normalize();
        const jointDir = new THREE.Vector3().subVectors(joint, root).normalize();

        // project the pole position onto the plane defined by the chain direction
        const projectedPoleDir = poleDir.clone().projectOnPlane(chainVec);
        // project the joint position onto the plane defined by the chain direction
        const projectedJointDir = jointDir.clone().projectOnPlane(chainVec);


        // calculate the angle between the joint direction and the pole direction, offset by this pole's align angle
        const alignAngle = signedAngleBetween(projectedJointDir, projectedPoleDir, chainVec) + this.angle;

        // rotate the joint around chainVec by the angle
        const q = new THREE.Quaternion().setFromAxisAngle(chainVec, alignAngle);

        joint.sub(root).applyQuaternion(q).add(root);

        // // twist up (+Z) towards the projected pole direction
        // const curUp = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chain.proxyJoints[this.jointIndex].quaternion);

        // // flatten both current and desired ups onto the roll plane
        // const curFlat = curUp.clone().projectOnPlane(chainVec).normalize();
        // const desFlat = projectedPoleDir.clone().normalize();

        // if (curFlat.lengthSq() < 1e-9) return;

        // // signed twist angle around chainVec
        // const twistAngle = signedAngleBetween(curFlat, desFlat, chainVec);

        // if (Math.abs(twistAngle) > 1e-4) {
        //     const qTwist = new THREE.Quaternion().setFromAxisAngle(chainVec, twistAngle);
        //     // premultiply so we add only roll
        //     this.chain.proxyJoints[this.jointIndex].quaternion.copy(qTwist);
        //     // (optional smoothing) jointObj.quaternion.slerp(qTwist.multiply(jointObj.quaternion), 0.3);
        // }

        if (this.chain.debug) {
            // draw the projected pole
            // this.chain.sceneRef.add(objutils.drawVector(root, projectedPoleDir, 0xffff00)); // yellow
            // // draw the projected joint
            // this.chain.sceneRef.add(objutils.drawVector(root, projectedJointDir, 0x0000ff)); // blue
            // // draw chainvec
            // this.chain.sceneRef.add(objutils.drawVector(root, chainVec, 0x00ffff)); // cyan
            // console.log(`twist angle: ${alignAngle * 180 / Math.PI}`);
            // console.log(`angle chainvec-projectedJointDir: ${chainVec.angleTo(projectedJointDir) * 180 / Math.PI}`);
            // console.log(`angle chainvec-projectedPoleDir: ${chainVec.angleTo(projectedPoleDir) * 180 / Math.PI}`);
        }
    }
}

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positions
    constructor(endEffectorBone, njoints, scene, constraints = null, options = {}) {
        this.chainLength = njoints;
        this.debug = options.debug || false;
        if (this.debug) {
            this.jointVisualizers = [];
        }

        this.endEffectorBone = endEffectorBone;
        this.sceneRef = scene;

        if (constraints) {
            this.constraints = constraints;
        } else {
            this.constraints = [];
            this.constraints.length = njoints;
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
        for (const c of this.constraints) {
            if (!c) continue;
            c.apply(this.proxyJoints, i, this.proxyJoints);
        }
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
            this.applyConstraints();

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

            // calculate forward direction for the joint
            let forward = new THREE.Vector3().subVectors(this.proxyJoints[i - 1].position, this.proxyJoints[i].position).normalize();

            // align joint's +Y with the forward direction
            let baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.clone());

            // set the joint's rotation to the final quaternion
            this.proxyJoints[i].quaternion.copy(baseQuat);

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
            // this.applyConstraints(i);
        }
    }

    doBackwardPass(rootPos) {
        this.proxyJoints[this.proxyJoints.length - 1].position.copy(rootPos);
        // we dont need to set the rotation of the root joint, since that will be handled by constraints

        // iterate over the joints
        for (let i = this.proxyJoints.length - 2; i >= 0; i--) {
            // i+1th joint is the parent of the ith joint

            // calculate forward direction for the joint
            let forward = new THREE.Vector3().subVectors(this.proxyJoints[i].position, this.proxyJoints[i + 1].position).normalize();

            // align joint's +Y with the forward direction
            let baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.clone());

            // set the joint's rotation to the final quaternion
            this.proxyJoints[i + 1].quaternion.copy(baseQuat);

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
            // this.applyConstraints(i);
        }

    }
}