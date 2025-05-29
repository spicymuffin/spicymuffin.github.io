import * as THREE from 'three';

import * as objutils from './objutils.js';

function signedAngleBetween(a, b, normal) {
    const angle = a.angleTo(b);
    const cross = new THREE.Vector3().crossVectors(a, b);
    return normal.dot(cross) > 0 ? angle : -angle;
}

export class IKJointConstraint {
    constructor(joint_index, chain) {
        this.joint_index = joint_index;
        this.active = true;
    }

    apply() {
        throw new Error('apply() must be implemented by subclass');
    }
}

// implement constraints??
export class IKConeConstraint extends IKJointConstraint {
    // joint is the joint to be constrained
    // checker is a function that checks if the joint is within the constraint
    constructor(joint_index, chain, joint, options = {}) {
        super(joint_index, chain)
    }

    apply() {
    }
}

export class IKAxisConstraint extends IKJointConstraint {
    constructor(joint_index, chain, axis, options = {}) {
        super(joint_index, chain);
    }

    apply() {
    }
}

// only pass this world space locations
// also the polePosition is a reference, so updating the polePosition will update the IKPole
// by default, the pole also defines the rotation of the joint too. the joint will align its +Z axis to the pole direction
export class IKPoleConstraint extends IKJointConstraint {
    constructor(joint_index, chain, poleRef, angle = 0, options = {}) {
        super(joint_index, chain);
        this.pole_ref = poleRef;
        this.angle = angle;
        this.chain = chain;
        this.debug = options.debug || false;
    }

    apply() {
        // rotate the joint around chainDirection towards polePosition
        const pole_pos = this.pole_ref.position.clone();
        const joint_pos = this.chain.bone_proxies[this.joint_index].position;
        const root_pos = this.chain.bone_proxies[this.joint_index + 1].position;
        const endPos = this.chain.bone_proxies[this.joint_index - 1].position;

        const chainVec = new THREE.Vector3().subVectors(endPos, root_pos).normalize();

        const poleDir = new THREE.Vector3().subVectors(pole_pos, root_pos).normalize();
        const jointDir = new THREE.Vector3().subVectors(joint_pos, root_pos).normalize();

        // project the pole position onto the plane defined by the chain direction
        const projectedPoleDir = poleDir.clone().projectOnPlane(chainVec);
        // project the joint position onto the plane defined by the chain direction
        const projectedJointDir = jointDir.clone().projectOnPlane(chainVec);


        // calculate the angle between the joint direction and the pole direction, offset by this pole's align angle
        const alignAngle = signedAngleBetween(projectedJointDir, projectedPoleDir, chainVec) + this.angle;

        // rotate the joint around chainVec by the angle
        const q = new THREE.Quaternion().setFromAxisAngle(chainVec, alignAngle);

        joint_pos.sub(root_pos).applyQuaternion(q).add(root_pos);

        // !!! this part needs to be handled by axis constraints
        // twist up (+Z) towards the projected pole direction
        const curUp = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chain.bone_proxies[this.joint_index].quaternion);

        // draw the current up vector
        this.chain.scene_ref.add(objutils.drawVector(joint_pos, curUp.clone().multiplyScalar(3), 0xff00ff)); // magenta
    }
}

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positions
    constructor(bone_end, njoints, scene_ref, constraints = null, options = {}) {
        this.chain_len = njoints;
        this.debug = options.debug || false;
        if (this.debug) {
            this.jointVisualizers = [];
        }

        this.bone_end = bone_end;
        this.scene_ref = scene_ref;

        if (constraints) {
            this.constraints = constraints;
        } else {
            this.constraints = [];
            this.constraints.length = njoints;
        }

        if (njoints < 2) {
            throw new Error('chain length must be at least 2');
        }
        if (!bone_end) {
            throw new Error('end effector must be non null');
        }

        // bone_proxies[0]                        is the end effector
        // bone_proxies[chainLength - 1]          is the root joint
        this.bone_proxies = [];
        let iterator = bone_end;
        for (let i = 0; i < njoints; i++) {
            if (this.debug) {
                console.log(`adding proxy joint ${i} for ${iterator.name}`);
            }
            this.bone_proxies.push(new THREE.Object3D());
            iterator.updateWorldMatrix(true, false);
            // copy the world position of the joint into the proxy joint
            this.bone_proxies[i].position.copy(iterator.getWorldPosition(new THREE.Vector3()));
            // copy the world rotation of the joint into the proxy joint
            this.bone_proxies[i].quaternion.copy(iterator.getWorldQuaternion(new THREE.Quaternion()));
            iterator = iterator.parent;
            this.scene_ref.add(this.bone_proxies[i]);
        }

        // set the root joint to be the last joint in the chain
        this.root_pos = new THREE.Vector3().copy(this.bone_proxies[this.bone_proxies.length - 1].position);
        if (options.rootPos) {
            this.root_pos.copy(options.rootPos);
        }

        // calculate the distance between the joints
        this.bone_lengths = [];
        for (let i = 0; i < this.bone_proxies.length - 1; i++) {
            const dist = this.bone_proxies[i].position.distanceTo(this.bone_proxies[i + 1].position);
            this.bone_lengths.push(dist);
        }

        if (this.debug) {
            for (let i = 0; i < this.bone_proxies.length; i++) {
                console.log(`adding proxy joint ${i} to scene`);
                const sphere = objutils.createSphere({ radius: 0.2, color: 0xff00ff });
                sphere.quaternion.copy(this.bone_proxies[i].quaternion);
                sphere.name = `proxy_${i}`;

                this.jointVisualizers.push(sphere);
                this.bone_proxies[i].add(sphere);
                const axis = new THREE.AxesHelper(0.6);
                axis.raycast = () => { };
                sphere.add(axis);

                // add a box to visualize the bone
                if (i > 0) {
                    const bonevis_thickness = 0.02;
                    const boneLength = this.bone_lengths[i - 1];

                    const bone = objutils.createBox({
                        size: new THREE.Vector3(bonevis_thickness, boneLength, bonevis_thickness),
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
            c.apply(this.bone_proxies, i, this.bone_proxies);
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
            this.doBackwardPass(this.root_pos);
            this.applyConstraints();
            this.alignBones();

            // check if the end effector is within tolerance of the target
            let dist = this.bone_proxies[0].position.distanceTo(targetPos);
            if (dist < tolerance) {
                // if the end effector is within tolerance, we are done
                if (this.debug) {
                    console.log(`FABRIK converged in ${i + 1} iterations`);
                }
                return;
            }
        }
    }

    alignBones() {
        // iterate through all the bone proxies, align +Y of the parent to point towards the child
        for (let i = 1; i < this.bone_proxies.length; i++) {
            let forward = new THREE.Vector3().subVectors(this.bone_proxies[i - 1].position, this.bone_proxies[i].position).normalize();

            // align joint's +Y with the forward direction
            let baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward.clone());

            // set the bone's rotation to the final quaternion
            this.bone_proxies[i].quaternion.copy(baseQuat);
        }
    }

    doForwardPass(target_pos, target_quat) {
        // set the end effector to the target position
        this.bone_proxies[0].position.copy(target_pos);
        // set the end effector's rotation to the target's rotation
        this.bone_proxies[0].quaternion.copy(target_quat);

        // iterate over the joints
        for (let i = 1; i < this.bone_proxies.length; i++) {
            // i-1th bone is the child of the ith bone

            // calculate forward direction for the bone
            let forward = new THREE.Vector3().subVectors(this.bone_proxies[i - 1].position, this.bone_proxies[i].position).normalize();

            // move the bone along the forward direction to compensate for the distance change
            let dist = this.bone_lengths[i - 1];

            this.bone_proxies[i].position.copy(this.bone_proxies[i - 1].position.clone().add(forward.clone().multiplyScalar(-dist)));
        }

        // apply constraints
        // this.applyConstraints();
    }

    doBackwardPass(root_pos) {
        this.bone_proxies[this.bone_proxies.length - 1].position.copy(root_pos);
        // we dont need to set the rotation of the root bone, since that will be handled by constraints

        // iterate over the bones
        for (let i = this.bone_proxies.length - 2; i >= 0; i--) {
            // i+1th bone is the parent of the ith bone

            // calculate forward direction for the bone
            let forward = new THREE.Vector3().subVectors(this.bone_proxies[i].position, this.bone_proxies[i + 1].position).normalize();

            // move the bone along the forward direction to compensate for the distance change
            let dist = this.bone_lengths[i];
            this.bone_proxies[i].position.copy(this.bone_proxies[i + 1].position.clone().add(forward.clone().multiplyScalar(dist)));
        }
    }
}