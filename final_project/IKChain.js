import * as THREE from 'three';

import * as colors from './colors.js';
import * as objutils from './objutils.js';
import * as transformutils from './transformutils.js';

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positions
    constructor(end_effector_bone_ref, chain_len, space_ref, constraints = {}, options = {}) {
        this.chain_len = chain_len;
        this.debug = options.debug || false;
        if (this.debug) {
            this.bone_visualizers = [];
        }

        this.pole = options.pole || null; // pole position, if any

        this.end_effector_bone_ref = end_effector_bone_ref;
        this.space_ref = space_ref;

        this.constraints = constraints; // constraints for the chain, indexed by joint index

        if (chain_len < 2) {
            throw new Error('chain length must be at least 2');
        }
        if (!end_effector_bone_ref) {
            throw new Error('end effector must be non null');
        }

        // bone_proxies[0]                        is the end effector
        // bone_proxies[chain_len - 1]            is the root joint
        this.bone_proxies = [];

        // we will assume that the space_ref's ancestors' world matrix is up to date
        // because we will be referencing world locations to translate to space_ref's local space

        // we assume that because recomputing the world matrix of a chain of ancestors is expensive
        // and we will have to do this computation for every chain that is attached to space_ref

        // .updateWorldMatrix (updateParents : Boolean, updateChildren : Boolean) : undefined
        // updateParents - recursively updates global transform of ancestors.
        // updateChildren - recursively updates global transform of descendants.

        // however, we need to recompute the chain's world matrices so:
        this.space_ref.updateWorldMatrix(false, true);

        // this goes from world space to the space_ref's local space
        const spaceInvM = this.space_ref.matrixWorld.clone().invert();

        let iterator = this.end_effector_bone_ref;
        for (let i = 0; i < chain_len; i++) {
            const proxy = new THREE.Object3D();
            proxy.name = `proxy_${i}`;

            // wp for world position

            // calculates only the position of the OBJECT, not of all its points
            const wp = iterator.getWorldPosition(new THREE.Vector3());
            proxy.position.copy(wp).applyMatrix4(spaceInvM);

            this.bone_proxies.push(proxy); // add the proxy to the bone proxies
            this.space_ref.add(proxy); // parent proxies to the space_ref
            if (i + 1 !== chain_len) {
                iterator = iterator.parent; // go up the hierarchy to the parent joint IF we are not at the root already
            }
            if (this.debug) {
                console.log(`added proxy joint ${i} for ${iterator.name}`);
            }
        }

        this.anchor_bone_ref = iterator; // the last joint in the chain is the anchor bone

        // set the root joint to be the last joint in the chain
        this.root_pos = new THREE.Vector3().copy(this.bone_proxies[this.bone_proxies.length - 1].position);

        // calculate the distance between the joints
        this.bone_lengths = [];
        for (let i = 0; i < this.bone_proxies.length - 1; i++) {
            const dist = this.bone_proxies[i].position.distanceTo(this.bone_proxies[i + 1].position);
            this.bone_lengths.push(dist);
        }

        this.anchor_bone_ref_plus_x = transformutils.translateVector(
            new THREE.Vector3(1, 0, 0), // +X vector
            this.space_ref,
            this.anchor_bone_ref
        ); // translate +x vector in anchor_bone_ref space to space_ref space

        // offset of every joint from root in rest pose
        this.rest_offsets = [];
        for (let i = 0; i < this.chain_len - 1; ++i) {
            // root-relative offset copied now we dont have to subtract root_pos every time later
            const off = this.bone_proxies[i].position.clone().sub(this.root_pos);
            this.rest_offsets.push(off);
            if (this.deep_debug) {
                const vector = objutils.createVector({
                    origin: this.root_pos,
                    vec: off.clone(),
                    color: colors.green,
                    shaft_radius: 0.01,
                });
                this.space_ref.add(vector);
            }
        }

        if (this.debug) {
            for (let i = 0; i < this.bone_proxies.length; i++) {
                // console.log(`adding proxy joint ${i} to space_ref`);
                const sphere = objutils.createSphere({ radius: 0.2, color: 0xff00ff });
                sphere.quaternion.copy(this.bone_proxies[i].quaternion);
                sphere.name = `proxy_${i}`;

                this.bone_visualizers.push(sphere);
                this.bone_proxies[i].add(sphere);
                const axis = new THREE.AxesHelper(0.6);
                axis.raycast = () => { };
                sphere.add(axis);

                // add a box to visualize the bone
                if (i > 0) {
                    const bonevis_thickness = 0.02;
                    const bonevis_length = this.bone_lengths[i - 1];

                    const bone = objutils.createBox({
                        size: new THREE.Vector3(bonevis_thickness, bonevis_length, bonevis_thickness),
                        color: 0xffffff,
                        origin_shift: new THREE.Vector3(0, -0.5 * bonevis_length, 0)
                    });

                    sphere.add(bone);
                }
            }
        }
    }

    // this doesnt really work with FABRIK
    preRotateInitialGuess(target_pos_in_space_ref) {
        // calculate the normal of the plane defined by the root, end effector and target
        const anchor_target = new THREE.Vector3().subVectors(target_pos_in_space_ref, this.root_pos);
        const anchor_pole = new THREE.Vector3().subVectors(this.pole.position, this.root_pos);

        const normal = new THREE.Vector3().crossVectors(anchor_target, anchor_pole).normalize();

        // generate a quaternion that rotates anchor_bone_ref_plus_x to point towards normal
        const q = new THREE.Quaternion().setFromUnitVectors(
            this.anchor_bone_ref_plus_x.clone().normalize(), // +X of the anchor bone in space_ref
            normal // normal of the plane defined by the root, end effector and target
        )

        // apply the rotations to copies of the rest offsets, copy the results to the bone proxies
        for (let i = 0; i < this.chain_len - 1; ++i) {
            const rotated = this.rest_offsets[i].clone().applyQuaternion(q).add(this.root_pos);
            this.bone_proxies[i].position.copy(rotated);
        }
    }

    // apply constaints for ith joint
    applyConstraints(i, mode) {
        const joint_constraints = this.constraints[i];
        // joint has no constraints, skip
        if (joint_constraints === undefined || joint_constraints === null) return;
        // constraints found, apply them in order
        for (const c of joint_constraints) {
            if (!c) continue; // skip null constraints
            if (mode === 'pos') {
                c.apply_pos();
            }
            else if (mode === 'rot') {
                c.apply_rot();
            }
        }
    }

    calculateChainDirection() {
        // calculate the direction of the chain from root to tip
        const root_pos = this.bone_proxies[this.chain_len - 1].position;
        const end_effector_pos = this.bone_proxies[0].position;
        return new THREE.Vector3().subVectors(end_effector_pos, root_pos).normalize();
    }

    alignBonesAndPole() {
        // TODO: optimize by reusing vector3 objects
        const root_pos = this.bone_proxies[this.chain_len - 1].position;
        const endeffector_pos = this.bone_proxies[0].position;

        const chain_dir = new THREE.Vector3().subVectors(endeffector_pos, root_pos).normalize();
        const pole_dir = new THREE.Vector3().subVectors(this.pole.position, root_pos).normalize();
        const n = new THREE.Vector3().crossVectors(chain_dir, pole_dir);

        // degenerate when pole, root, end are collinear
        if (n.lengthSq() < 1e-6) n.set(0, 1, 0); else n.normalize();

        // iterate root to end effector, align +Y of the joint to point towards the child,
        // and align the joint's +Z axis to be in the pole plane
        for (let i = this.chain_len - 2; i >= 0; --i) {
            const joint = this.bone_proxies[i + 1];
            const child = this.bone_proxies[i];
            const forward = new THREE.Vector3().subVectors(child.position, joint.position).normalize();

            // up vector lies in the pole plane (normalize() is very important)
            const up = new THREE.Vector3().crossVectors(n, forward).normalize();

            // do we need this check?? idk doesnt seem to do anything tho....
            if (up.lengthSq() < 1e-8) continue;

            // TODO: rewrite with pure quaternions for stability (performance??)
            const right = new THREE.Vector3().crossVectors(forward, up).normalize();

            const m = new THREE.Matrix4();
            m.makeBasis(right, forward, up); // +X, +Y, +Z
            const q = new THREE.Quaternion().setFromRotationMatrix(m);

            joint.quaternion.copy(q);
        }
    }

    // this doesnt really work that well with FABRIK too, a bit better than preRotateInitialGuess
    // am i a retard?
    rotateBonesTowardsPole() {
        for (let i = 1; i < this.bone_proxies.length - 1; i++) {
            // rotate the bone around chainDirection towards polePosition
            const pole_pos = this.pole.position;
            const joint_pos = this.bone_proxies[i].position;
            const root_pos = this.bone_proxies[this.chain_len - 1].position;
            const leaf_pos = this.bone_proxies[0].position;

            const chain_vec = new THREE.Vector3().subVectors(leaf_pos, root_pos).normalize();

            const pole_dir = new THREE.Vector3().subVectors(pole_pos, root_pos).normalize();
            const joint_dir = new THREE.Vector3().subVectors(joint_pos, root_pos).normalize();

            // project the pole position onto the plane defined by the chain direction
            const projected_pole_dir = pole_dir.clone().projectOnPlane(chain_vec);
            // project the joint position onto the plane defined by the chain direction
            const projected_joint_dir = joint_dir.clone().projectOnPlane(chain_vec);

            const align_angle = transformutils.signedAngleBetween(projected_joint_dir, projected_pole_dir, chain_vec);

            const q = new THREE.Quaternion().setFromAxisAngle(chain_vec, align_angle);

            joint_pos.sub(root_pos).applyQuaternion(q).add(root_pos);
        }
    }

    extendBonesTowardsPole() {
        const anchor_pole = new THREE.Vector3().subVectors(this.pole.position, this.root_pos).normalize();

        // anchor is already extended towards the pole
        for (let i = this.chain_len - 2; i >= 0; i--) {
            const parent_proxy_position = this.bone_proxies[i + 1].position;
            const length_of_current_segment = this.bone_lengths[i];

            const new_child_position = new THREE.Vector3();
            new_child_position.copy(parent_proxy_position);
            new_child_position.addScaledVector(anchor_pole, length_of_current_segment);

            this.bone_proxies[i].position.copy(new_child_position);

            if (this.debug) {
                // console.log(`Extended bone ${this.bone_proxies[i].name} (index ${i}) towards pole direction. Parent: ${this.bone_proxies[i + 1].name}`);
            };
        }
    }

    // solves using FABRIK
    // target is a position, in a space that is in space_ref
    solve(target, tolerance = 0.01, max_iterations = 50) {
        let target_pos = target.position.clone();
        let target_quat = target.quaternion.clone();

        this.extendBonesTowardsPole();

        // return;

        for (let i = 0; i < max_iterations; i++) {
            this.doForwardPass(target_pos, target_quat);
            this.doBackwardPass(this.root_pos);

            if (this.pole) {
                this.alignBonesAndPole();
            } else {
                this.alignBones();
            }
            // check if the end effector is within tolerance of the target
            let dist = this.bone_proxies[0].position.distanceTo(target_pos);
            if (dist < tolerance) {
                // if the end effector is within tolerance, we are done
                if (this.debug) {
                    console.log(`FABRIK converged in ${i + 1} iterations`);
                }
                break;
            }
        }
        this.world2LocalPosition(); // log the local positions and quaternions of the bones
    }

    world2LocalPosition() {
        // get locat position and local rotation of bones
        const local_positions = [];
        const local_quaternions = [];

        for (let i = 0; i < this.bone_proxies.length; i++) {
            if (i + 1 === this.bone_proxies.length) {
                
                const parent_pos = new THREE.Vector3(0, -3, 0);
                const inv_parent_quat = this.anchor_bone_ref.parent.quaternion.clone().invert();

                const local_pos = this.bone_proxies[i].position.clone().sub(parent_pos).applyQuaternion(inv_parent_quat);
                const local_quat = inv_parent_quat.clone().multiply(this.bone_proxies[i].quaternion.clone());

                local_positions.push(local_pos);
                local_quaternions.push(local_quat);
            } else {
                // convert the position and quaternion to the local space of the previous bone
                const parent_pos = this.bone_proxies[i + 1].position.clone();
                const inv_parent_quat = this.bone_proxies[i + 1].quaternion.clone().invert();

                const local_pos = this.bone_proxies[i].position.clone().sub(parent_pos).applyQuaternion(inv_parent_quat);
                const local_quat = inv_parent_quat.clone().multiply(this.bone_proxies[i].quaternion.clone());

                local_positions.push(local_pos);
                local_quaternions.push(local_quat);
            }
        }

        let iterator = this.end_effector_bone_ref;
        for (let i = 0; i < this.chain_len; ++i) {
            // copy the local positions and quaternions to the original bone
            iterator.position.copy(local_positions[i]);
            iterator.quaternion.copy(local_quaternions[i]);

            iterator = iterator.parent;
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