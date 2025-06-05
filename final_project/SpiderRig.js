import * as THREE from 'three';
import * as objutils from './objutils.js';
import * as boneutils from './boneutils.js';
import * as colors from './colors.js';
import * as transformutils from './transformutils.js';

import * as IK from './IKChain.js';

function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

// a "dumb" class (it does no logic, just spawns a rig, exposes some references to targets and bones)
// +Z is forward
export class SpiderRig {
    constructor(parent_ref, options = {}) {
        this.parent_ref = parent_ref;

        this.debug = options.debug ?? true;

        // create the rig
        // no ascii art, consult an image that hopefully someone has drawn...

        this.bone_root = new THREE.Bone();
        this.bone_root.name = 'spider_root';

        this.bone_root.position.copy(options.position || new THREE.Vector3(0, 0, 0));
        this.parent_ref.add(this.bone_root);

        // create the center - anchor bones
        this.limb_count = options.limb_count || 8; // default to 8 limbs?

        // lengths of the levels, from level 0 to level 3
        this.level_lengths = options.level_lengths || [1, 1.5, 1, 0.75];

        // angles from front to back from fwd to limb
        this.oy_angles = options.oy_angles || [Math.PI / 9 * 2, Math.PI / 7 * 3, Math.PI / 7 * 4, Math.PI / 9 * 7];

        // angles from level 0 to level 3 from parent space up
        this.ox_angles = options.ox_angles || [degToRad(20), degToRad(-10), degToRad(-60), degToRad(-20)];

        // 0 - left, 1 - right
        // 0 - front, n - back
        this.bone_levels = Array.from({ length: 5 }, () => [[], []]);

        this.ik_anchors = [[], []];

        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const bone = new THREE.Bone();

                this.bone_root.add(bone);
                this.bone_levels[0][lr].push(bone);

                bone.name = `spider_limb_${lr ? 'r' : 'l'}_${i}_level0`;
                bone.position.set(0, 0, 0);

                // picture a trigonometric circle where y is x, x is z
                // left is +x, right is -x
                const theta = (lr ? -1 : 1) * this.oy_angles[i]

                const up = new THREE.Vector3(0, 1, 0);
                const fwd = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)); // angles are front to back, so we use -cos
                const right = new THREE.Vector3().crossVectors(fwd, up).normalize();

                // store the static pole anchor position for this limb in parent space
                this.ik_anchors[lr][i] = fwd.clone().multiplyScalar(this.level_lengths[0]);

                // set the rotation
                const m = new THREE.Matrix4();
                m.makeBasis(right, fwd, up); // +X, +Y, +Z
                const q = new THREE.Quaternion().setFromRotationMatrix(m);
                bone.quaternion.copy(q);
            }
        }

        for (let level = 1; level <= 4; level++) {
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.limb_count / 2; i++) {
                    const bone = new THREE.Bone();
                    bone.name = `spider_limb_${lr ? 'r' : 'l'}_${i}_level${level}`;
                    bone.position.set(0, this.level_lengths[level - 1], 0);

                    this.bone_levels[level - 1][lr][i].add(bone);
                    this.bone_levels[level][lr].push(bone);

                }
            }
        }


        // last level doesnt need rotation so this.bone_levels.length - 1
        for (let level = 0; level < this.bone_levels.length - 1; level++) {
            for (let lr = 0; lr < 2; lr++) {
                for (let j = 0; j < this.limb_count / 2; j++) {
                    // rotate arond bone local X by ox_angles[level]
                    const bone = this.bone_levels[level][lr][j];

                    const q = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(1, 0, 0), // local X
                        this.ox_angles[level]
                    );

                    bone.quaternion.multiply(q);
                }
            }
        }

        // add bonevisualizations for the bones
        if (this.debug) {
            boneutils.addBoneVis(this.bone_root, {
                color: colors.green,
                sphere_radius: 0.15,
                axis: true,
                length: 2,
                thickness: 0.06,
                opacity: 0.8,
            });

            // since all the children of level 0 are only one per level, we can recursively add the visualizations
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.bone_levels[0][lr].length; i++) {
                    function recursive_step(bone) {
                        if (bone.children.length > 0) {
                            boneutils.addBoneVis(bone, {
                                color: colors.blue,
                                sphere_radius: 0.1,
                                axis: true,
                                child: bone.children[0],
                                thickness: 0.08,
                            });
                            recursive_step(bone.children[0]);
                        }
                        else {
                            boneutils.addBoneVis(bone, {
                                color: colors.red,
                                sphere_radius: 0.1,
                                axis: true,
                            });
                        }
                    }

                    recursive_step(this.bone_levels[0][lr][i]);
                }
            }
        }

        this.parent_ref.updateMatrixWorld();

        // create the targets
        this.targets = [[], []];
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const target = objutils.createSphere({
                    radius: 0.25,
                    color: colors.red,
                    opacity: 0.5,
                });

                target.name = `spider_limb_${lr ? 'r' : 'l'}_${i}_target`;

                // set the position to the end of the last bone
                const last_bone = this.bone_levels[this.bone_levels.length - 1][lr][i];
                const matrix_bone_to_world = last_bone.matrixWorld.clone();
                const matrix_world_to_parent = new THREE.Matrix4().copy(this.parent_ref.matrixWorld).invert();
                const matrix_bone_to_parent = new THREE.Matrix4().multiplyMatrices(matrix_world_to_parent, matrix_bone_to_world);

                target.position.copy(new THREE.Vector3(0, 0.1, 0.1).applyMatrix4(matrix_bone_to_parent));

                this.parent_ref.add(target);
                this.targets[lr].push(target);
            }
        }

        // create the poles
        this.poles = [[], []];
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const pole = objutils.createSphere({
                    radius: 0.1,
                    color: colors.yellow,
                    opacity: 0.5,
                });

                pole.name = `spider_limb_${lr ? 'r' : 'l'}_${i}_pole`;

                // set the position to some random middle point of the bone chain
                const last_bone = this.bone_levels[this.bone_levels.length - 3][lr][i];
                const matrix_bone_to_world = last_bone.matrixWorld.clone();
                const matrix_world_to_parent = new THREE.Matrix4().copy(this.parent_ref.matrixWorld).invert();
                const matrix_bone_to_parent = new THREE.Matrix4().multiplyMatrices(matrix_world_to_parent, matrix_bone_to_world);

                pole.position.copy(new THREE.Vector3(0, 0, 0).applyMatrix4(matrix_bone_to_parent));
                pole.position.y += 0.75; // raise it a bit

                this.parent_ref.add(pole);
                this.poles[lr].push(pole);
            }
        }

        // initialize IK chains
        this.ik_chains = [[], []];
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const chain = new IK.IKChain(
                    this.bone_levels[this.bone_levels.length - 1][lr][i],
                    this.bone_levels.length - 1, // level 0 should be static,
                    this.parent_ref, // space reference
                    {}, // constraints
                    {
                        pole: this.poles[lr][i],
                        debug: true
                    } // options
                );

                chain.name = `spider_limb_${lr ? 'r' : 'l'}_${i}_chain`;
                this.ik_chains[lr].push(chain);
            }
        }
    }

    // pass target and pole in parent_ref space!
    updateIKChain(lr, i, target_pos = null, pole_pos = null) {
        if (target_pos) {
            this.targets[lr][i].position.copy(target_pos);
        }

        if (pole_pos) {
            this.poles[lr][i].position.copy(pole_pos);
        }

        // console.log("updating IK chain", lr, i, this.targets[lr][i].position, this.poles[lr][i].position);
        // console.log(this.ik_chains[lr][i]);
        // console.log(`updating IK chain for ${i}th ${lr ? 'right' : 'left'} limb`);

        // update the IK chain
        this.ik_chains[lr][i].solve(
            this.targets[lr][i], // target obj
            0.01, // tolerance
            15 // max iterations
        )
    }

    // pass target_positions and pose_positions in parent_ref space!
    updateIKChains(target_positions = null, pose_positions = null) {
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                if (target_positions && target_positions[lr] && target_positions[lr][i]) {
                    this.targets[lr][i].position.copy(target_positions[lr][i]);
                }
                if (pose_positions && pose_positions[lr] && pose_positions[lr][i]) {
                    this.poles[lr][i].position.copy(pose_positions[lr][i]);
                }
                this.updateIKChain(lr, i);
            }
        }
    }

    updatePolePositions(options = {}) {
        // if pole positions are provided, use them
        if (options.pole_positions) {
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.limb_count / 2; i++) {
                    if (options.pole_positions[lr] && options.pole_positions[lr][i]) {
                        this.poles[lr][i].position.copy(options.pole_positions[lr][i]);
                    }
                    else {
                        throw new Error(`pole position for ${i}th ${lr ? 'right' : 'left'} limb not provided`);
                    }
                }
            }
        }
        // if pole positions are not provided, calculate halfway between root and target positions, add osme constant to y
        else {
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.limb_count / 2; i++) {
                    const target_pos = this.targets[lr][i].position.clone();
                    // TODO: this code is so bad, needs refactoring/optimization
                    const anchor_pos = this.ik_anchors[lr][i];
                    const center_pos = this.bone_levels[0][0][0].position.clone();

                    const center_anchor = new THREE.Vector3().subVectors(anchor_pos, center_pos).projectOnPlane(new THREE.Vector3(0, 1, 0));
                    const anchor_target = new THREE.Vector3().subVectors(target_pos, anchor_pos).projectOnPlane(new THREE.Vector3(0, 1, 0));
                    const center_target = new THREE.Vector3().subVectors(target_pos, center_pos).projectOnPlane(new THREE.Vector3(0, 1, 0));

                    // if (i == 0 && lr == 1) {
                    //     console.log(center_anchor.dot(anchor_target))
                    //     this.parent_ref.add(objutils.createVector({
                    //         origin: center_pos,
                    //         vec: center_anchor,
                    //         color: colors.red,
                    //     }));
                    //     this.parent_ref.add(objutils.createVector({
                    //         origin: anchor_pos,
                    //         vec: anchor_target,
                    //         color: colors.blue,
                    //     }));
                    // }

                    if (center_anchor.dot(anchor_target) < 0) {
                        // if the anchor and target are on opposite sides, we need to flip the pole position
                        anchor_target.multiplyScalar(-1);
                    }

                    anchor_target.normalize();
                    center_anchor.normalize();
                    center_target.normalize();

                    const pole_pos = new THREE.Vector3().copy(center_pos).add(center_target.multiplyScalar(5));
                    pole_pos.y += target_pos.y + 5;

                    this.poles[lr][i].position.copy(pole_pos);
                }
            }
        }
    }
}