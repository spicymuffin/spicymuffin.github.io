import * as THREE from 'three';

import * as objutils from './objutils.js';

function signedAngleBetween(a, b, normal) {
    const angle = a.angleTo(b);
    const cross = new THREE.Vector3().crossVectors(a, b);
    return normal.dot(cross) > 0 ? angle : -angle;
}

export class IKJointConstraint {
    constructor(joint_index, chain_ref) {
        this.joint_index = joint_index;
        this.active = true;
    }

    apply_pos() {
        throw new Error('apply_pos() must be implemented by subclass');
    }

    apply_rot() {
        throw new Error('apply_rot() must be implemented by subclass');
    }
}

// implement constraints??
export class IKConeConstraint extends IKJointConstraint {
    // joint is the joint to be constrained
    // checker is a function that checks if the joint is within the constraint
    constructor(joint_index, chain_ref, joint, options = {}) {
        super(joint_index, chain_ref)
    }

    apply_pos() {
    }
    apply_rot() {
    }
}

export class IKAxisConstraint extends IKJointConstraint {
    constructor(joint_index, chain_ref, axis, options = {}) {
        super(joint_index, chain_ref);
    }

    apply_pos() {
    }
    apply_rot() {
    }
}

// piece of shit IK pole constraint idea i am literal idiot never look into this code
// // only pass this world space locations
// // also the polePosition is a reference, so updating the polePosition will update the IKPole
// // by default, the pole also defines the rotation of the joint too. the joint will align its +Z axis to the pole direction
// export class IKPoleConstraint extends IKJointConstraint {
//     constructor(joint_index, chain_ref, pole_ref, options = {}) {
//         super(joint_index, chain_ref);
//         this.joint_index = joint_index;
//         this.chain_ref = chain_ref;
//         this.pole_ref = pole_ref;

//         this.rotate = options.rotate ?? true; // if true, the joint will not be rotated, only moved
//         this.move = options.move ?? true; // if true, the joint will not be moved, only rotated

//         this.debug = options.debug || false;
//         this.angle = options.angle || 0; // angle to align the joint with the pole direction
//         this.polerot_root = options.polerot_root || -1; // index of the root joint for pole rotation
//         this.polerot_leaf = options.polerot_leaf || -1; // index of the leaf joint for pole rotation

//         if (this.polerot_root == -1) {
//             this.polerot_root = this.joint_index + 1;
//         }
//         else if (this.polerot_root == -2) {
//             this.polerot_root = this.chain_ref.bone_proxies.length - 1
//         }
//         if (this.polerot_leaf == -1) {
//             this.polerot_leaf = this.joint_index - 1;
//         }
//         else if (this.polerot_leaf == -2) {
//             this.polerot_leaf = 0;
//         }
//     }

//     apply_pos() {
//         if (!this.move) return; // if move is false, do not apply position
//         // rotate the joint around chainDirection towards polePosition
//         const pole_pos = this.pole_ref.position.clone();
//         const joint_pos = this.chain_ref.bone_proxies[this.joint_index].position;
//         const root_pos = this.chain_ref.bone_proxies[this.polerot_root].position;
//         const leaf_pos = this.chain_ref.bone_proxies[this.polerot_leaf].position;

//         const chain_vec = new THREE.Vector3().subVectors(leaf_pos, root_pos).normalize();

//         const pole_dir = new THREE.Vector3().subVectors(pole_pos, root_pos).normalize();
//         const joint_dir = new THREE.Vector3().subVectors(joint_pos, root_pos).normalize();

//         // project the pole position onto the plane defined by the chain direction
//         const projected_pole_dir = pole_dir.clone().projectOnPlane(chain_vec);
//         // project the joint position onto the plane defined by the chain direction
//         const projected_joint_dir = joint_dir.clone().projectOnPlane(chain_vec);


//         // calculate the angle between the joint direction and the pole direction, offset by this pole's align angle
//         const align_angle = signedAngleBetween(projected_joint_dir, projected_pole_dir, chain_vec) + this.angle;

//         // rotate the joint around chainVec by the angle
//         const q = new THREE.Quaternion().setFromAxisAngle(chain_vec, align_angle);

//         joint_pos.sub(root_pos).applyQuaternion(q).add(root_pos);

//         // THESE CREATE VECTOR CALLS ARE MALFORMED, use the new signature!
//         // // draw vectors for debugging
//         // if (this.debug) {
//         //     this.chain_ref.space_ref.add(objutils.drawVector(
//         //         root_pos,
//         //         chain_vec.clone().multiplyScalar(2),
//         //         0xff0000, // red for chain direction
//         //         0.02, 0.1, 2
//         //     ));

//         //     this.chain_ref.space_ref.add(objutils.drawVector(
//         //         root_pos,
//         //         projected_pole_dir.clone().multiplyScalar(2),
//         //         0x00ff00, // green for pole direction
//         //         0.02, 0.1, 2
//         //     ));

//         //     this.chain_ref.space_ref.add(objutils.drawVector(
//         //         root_pos,
//         //         projected_joint_dir.clone().multiplyScalar(2),
//         //         0x0000ff, // blue for joint direction
//         //         0.02, 0.1, 2
//         //     ));
//         // }
//     }

//     apply_rot() {
//         if (!this.rotate) return; // if rotate is false, do not apply rotation

//         const pole_pos = this.pole_ref.position.clone();
//         const root_pos = this.chain_ref.bone_proxies[this.polerot_root].position;
//         const child_pos = this.chain_ref.bone_proxies[this.joint_index - 1].position;

//         const forward = new THREE.Vector3().subVectors(child_pos, this.chain_ref.bone_proxies[this.joint_index].position).normalize();

//         const pole_dir = new THREE.Vector3().subVectors(pole_pos, root_pos).normalize();

//         // project the pole position onto the plane defined by the chain direction
//         const projected_pole_dir = pole_dir.clone().projectOnPlane(forward).normalize();

//         // calculate the current up vector of the joint
//         const cur_up = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chain_ref.bone_proxies[this.joint_index].quaternion);

//         // project the current up vector onto the plane defined by the chain direction
//         const cur_up_projected = cur_up.clone().projectOnPlane(forward).normalize();

//         if (cur_up_projected.lengthSq() < 1e-9) return;

//         // signed twist angle around chain_vec
//         const twist_angle = signedAngleBetween(cur_up_projected, projected_pole_dir, forward);

//         const twist_quat = new THREE.Quaternion().setFromAxisAngle(forward, twist_angle);
//         this.chain_ref.bone_proxies[this.joint_index].quaternion.premultiply(twist_quat);

//         if (this.debug) {
//             // draw the current up vector
//             this.chain_ref.space_ref.add(objutils.drawVector(
//                 this.chain_ref.bone_proxies[this.joint_index].position,
//                 cur_up.multiplyScalar(2),
//                 0xffffff
//             )); // white

//             // draw the projected pole
//             this.chain_ref.space_ref.add(objutils.drawVector(
//                 this.chain_ref.bone_proxies[this.joint_index].position,
//                 projected_pole_dir,
//                 0xffff00
//             )); // yellow
//             // draw the current up vector
//             this.chain_ref.space_ref.add(objutils.drawVector(
//                 this.chain_ref.bone_proxies[this.joint_index].position,
//                 cur_up_projected,
//                 0xff00ff
//             )); // magenta

//             // draw chain_vec
//             this.chain_ref.space_ref.add(objutils.drawVector(
//                 root_pos,
//                 forward.multiplyScalar([this.chain_ref.bone_lengths[this.joint_index - 1]]),
//                 0x00ffff
//             )); // cyan
//             console.log(`twist angle: ${twist_quat * 180 / Math.PI}`);
//             console.log(`angle cur_up_projected-projected_pole_dir: ${forward.angleTo(projected_pole_dir) * 180 / Math.PI}`);
//         }
//     }
// }

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positions
    constructor(bone_end, chain_len, space_ref, constraints = {}, options = {}) {
        this.chain_len = chain_len;
        this.debug = options.debug || false;
        if (this.debug) {
            this.bone_visualizers = [];
        }

        this.pole = options.pole || null; // pole position, if any

        this.bone_end = bone_end;
        this.space_ref = space_ref;

        this.constraints = constraints; // constraints for the chain, indexed by joint index

        if (chain_len < 2) {
            throw new Error('chain length must be at least 2');
        }
        if (!bone_end) {
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

        // these go from world space to the space_ref's local space
        const spaceInvM = this.space_ref.matrixWorld.clone().invert();
        const spaceInvQ = this.space_ref.getWorldQuaternion(new THREE.Quaternion()).invert();

        let iterator = bone_end;
        for (let i = 0; i < chain_len; i++) {
            const proxy = new THREE.Object3D();
            proxy.name = `proxy_${i}`;

            // wp for world position, wq for world quaternion

            // calculates only the position of the OBJECT, not of all its points
            const wp = iterator.getWorldPosition(new THREE.Vector3());
            proxy.position.copy(wp).applyMatrix4(spaceInvM); // p_space = pS⁻¹ · p_world

            // set the rotation of the OBJECT
            const wq = iterator.getWorldQuaternion(new THREE.Quaternion());
            proxy.quaternion.copy(spaceInvQ).multiply(wq); // q_space = qS⁻¹ * q_world

            this.bone_proxies.push(proxy); // add the proxy to the bone proxies
            this.space_ref.add(proxy); // parent proxies to the space_ref
            iterator = iterator.parent; // go up the hierarchy to the parent joint

            if (this.debug) {
                console.log(`added proxy joint ${i} for ${iterator.name}`);
            }
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
                console.log(`adding proxy joint ${i} to space_ref`);
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
                        originShift: new THREE.Vector3(0, -0.5 * bonevis_length, 0)
                    });

                    sphere.add(bone);
                }
            }
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

        const chainDir = new THREE.Vector3().subVectors(endeffector_pos, root_pos).normalize();
        const poleDir = new THREE.Vector3().subVectors(this.pole.position, root_pos).normalize();
        const n = new THREE.Vector3().crossVectors(chainDir, poleDir);

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

    // solves using FABRIK
    // target is a position, in a space that is in space_ref
    solve(target, tolerance = 0.01, max_iterations = 50) {
        for (let i = 0; i < max_iterations; i++) {
            let target_pos = target.position.clone();
            let target_quat = target.quaternion.clone();
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