import * as THREE from 'three';
import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { SpiderLegStepper } from './SpiderLegStepper.js';
import { SpiderRig } from './SpiderRig.js';

export const walkable_layer = 3; // layer for walkable surfaces

// gets input (mouse and keyboard), applies it to the spider_root_ref. updates the spider_rig and camera
export class SpiderController {
    constructor(scene_ref, spider_movement_root_ref, spider_rig_root_ref, spider_rig_obj_ref, spider_camera_root_ref, camera_ref, dom_element = document.body, options = {}) {
        // #region reference copies
        this.scene_ref = scene_ref;
        this.spider_movement_root_ref = spider_movement_root_ref;
        this.spider_rig_root_ref = spider_rig_root_ref;
        this.spider_rig_obj_ref = spider_rig_obj_ref;
        this.spider_camera_root_ref = spider_camera_root_ref;
        this.camera_ref = camera_ref;
        this.dom_element = dom_element;
        // #endregion

        this.enabled = true;

        // #region cosmetic parameters
        // TODO: precompute squared thresholds to avoid sqrt calls
        // the max allowed distance between the raycaster hit point and the anchor point
        this.limb_offset_thresholds = [[1.5, 1.0, 1.0, 1.2], [1.5, 1.0, 1.0, 1.2]];
        if (options.limb_offset_thresholds) {
            this.limb_offset_thresholds = options.limb_offset_thresholds;
        }

        this.time_to_reposition = 0.15; // seconds to reposition the limb
        if (options.time_to_reposition) {
            this.time_to_reposition = options.time_to_reposition;
        }

        this.max_time_unrested = 0.4; // seconds to wait before repositioning the limb
        if (options.max_time_unrested) {
            this.max_time_unrested = options.max_time_unrested;
        }
        // #endregion

        // #region control parameters
        this.move_speed = 5;
        this.sensitivity = 0.002;

        this.default_speed = 5;
        this.accel_speed = 8;
        // #endregion

        // #region camera intenrals
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.pitch = 0;
        this.yaw = 0;

        this.is_locked = false;
        this.drag_start = new THREE.Vector2();
        // #endregion

        // #region input states
        this.inputs = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            accel: false,
        };
        this.last_movement_input_ts = 0;
        // #endregion

        this.debug = false;
        if (options.debug) {
            this.debug = options.debug;
        }

        // #region raycasting setup
        this.limb_count = 8;
        if (options.limb_count) {
            this.limb_count = options.limb_count;
        }

        const default_z_offset = 3;
        const default_y_offset = 2;

        this.oy_angles = options.oy_angles || [Math.PI / 16, Math.PI / 7 * 3, Math.PI / 7 * 4, Math.PI / 9 * 7];
        this.raycaster_z_offsets = options.raycaster_z_offsets || [default_z_offset, default_z_offset, default_z_offset, default_z_offset];
        this.raycaster_y_offsets = options.raycaster_y_offsets || [default_y_offset, default_y_offset, default_y_offset, default_y_offset];

        // initialize raycaster positions
        this.raycaster_origins_root = new THREE.Object3D();
        this.raycaster_origins_root.name = 'raycaster_origins_root';
        this.raycaster_origins = [[], []];
        this.raycaster_directions = [[], []];
        this.raycaster_objects = [[], []];

        this.spider_movement_root_ref.add(this.raycaster_origins_root);

        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const raycaster_origin = new THREE.Object3D();

                this.raycaster_origins_root.add(raycaster_origin);
                this.raycaster_origins[lr].push(raycaster_origin);

                raycaster_origin.name = `target_raycaster_${lr}_${i}`;

                // picture a trigonometric circle where y is x, x is z
                // left is +x, right is -x
                const theta = (lr ? -1 : 1) * this.oy_angles[i];

                const pos = new THREE.Vector3(Math.sin(theta) * this.raycaster_z_offsets[i], this.raycaster_y_offsets[i], Math.cos(theta) * this.raycaster_z_offsets[i]); // angles are front to back, so we use -cos
                raycaster_origin.position.copy(pos);

                // set the direction of the raycaster
                const raycaster_direction = new THREE.Vector3(0, -1, 0); // pointing down
                this.raycaster_directions[lr].push(raycaster_direction);

                // create a raycaster object
                const raycaster_object = new THREE.Raycaster();
                // set the raycaster near and far for performance
                raycaster_object.near = 0;
                raycaster_object.far = 10; // far enough to reach the ground
                // dont set the origin, direction. because they are world space, we need to convert the local space to world space
                // every frame
                raycaster_object.layers.set(walkable_layer); // walkable layer is 3
                this.raycaster_objects[lr].push(raycaster_object);

                if (this.debug) {
                    const cone_height = 0.5;
                    const downward_dir = new THREE.Vector3(0, -1, 0);

                    const raycaster_visualizer = objutils.createCone({
                        radius: 0.1,
                        height: cone_height,

                        ptr_position: new THREE.Vector3(0, 0, 0),
                        ptr_direction: downward_dir,
                    });

                    raycaster_origin.add(raycaster_visualizer);

                    const ray_visualizer = objutils.createBox({
                        size: new THREE.Vector3(0.005, 20, 0.005),
                        color: colors.red,
                        opacity: 0.5,
                        origin_shift: new THREE.Vector3(0, 10, 0), // shift the origin to the top of the ray
                    });

                    raycaster_origin.add(ray_visualizer);
                }
            }
        }

        if (options.debug) {
            this.raycaster_hit_visualizers = [[], []];
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.limb_count / 2; i++) {
                    const raycaster_hit_visualizer = objutils.createBox({
                        size: new THREE.Vector3(0.1, 0.1, 0.1),
                        color: colors.maroon,
                        opacity: 0.5,
                    });

                    this.spider_movement_root_ref.parent.add(raycaster_hit_visualizer);
                    this.raycaster_hit_visualizers[lr].push(raycaster_hit_visualizer);
                }
            }
        }

        this.raycast_hit_points = [[], []]; // to store the hit points of the raycasters

        if (options.raycaster_origins) {
            this.raycaster_origins = options.raycaster_origins;
        }

        if (options.raycasting_candidates) {
            this.raycasting_candidates = options.raycasting_candidates;
        }

        // #endregion

        this.doRaycasts();

        this.spider_movement_root_ref.updateWorldMatrix(true, true);

        // #region anchor setup
        this.anchors = [[], []]; // anchors for the spider legs
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const anchor = new THREE.Vector3().copy(this.raycast_hit_points[lr][i]);
                this.anchors[lr].push(anchor);
            }
        }

        if (options.debug) {
            this.anchor_visualizers = [[], []];
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.limb_count / 2; i++) {
                    const anchor_visualizer = objutils.createSphere({
                        radius: 0.1,
                        color: colors.blue,
                        opacity: 0.5,
                    });
                    anchor_visualizer.position.copy(this.anchors[lr][i]);
                    this.scene_ref.add(anchor_visualizer);
                    this.anchor_visualizers[lr].push(anchor_visualizer);
                }
            }
        }
        // #endregion

        // #region gait logic
        this.leg_groups = [
            [0, 1, 0, 1], // left legs:  L1(0), L2(1), L3(0), L4(1)
            [1, 0, 1, 0]  // right legs: R1(1), R2(0), R3(1), R4(0)
        ];

        this.current_moving_group = 0;
        // #endregion

        // #region update internals
        this.velocity = new THREE.Vector3(0, 0, 0); // velocity of the spider movement root
        // #endregion

        // #region leg stepping
        // TODO: get leg stepper parmaters from options
        this.limb_steppers = [[], []]; // steppers for the spider legs
        this.limb_reposition_flags = [[], []]; // flags to indicate if a limb needs to be repositioned
        this.reposition_targets = [[], []]; // targets to reposition the limbs to
        this.reposition_start_timestamps = [[], []]; // timestamps when the repositioning started
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                // TODO: replace control with the up vector of the spider movement root
                this.limb_steppers[lr].push(new SpiderLegStepper(
                    this.anchors[lr][i],
                    this.raycast_hit_points[lr][i],
                    new THREE.Vector3(0, 1, 0),
                    this.time_to_reposition, // duration of the step in seconds
                    {
                        lift_amount: 0.5, // how much to lift the leg
                        curve_bias: 0.7, // how much to curve the step
                        ease_fn: (t) => t * (2 - t), // ease function for the step
                    }
                ));
                this.limb_reposition_flags[lr].push(false); // initialize all flags to false
                this.reposition_targets[lr].push(new THREE.Vector3()); // initialize all targets to a new vector
                this.reposition_start_timestamps[lr].push(0); // initialize all timestamps to 0
            }
        }

        this.look_rest = true;
        this.move_rest = true;
        // #endregion

        // #region camera setup
        this.spider_camera_root_ref.add(this.camera_ref);
        // this.spider_root_ref.add(this.spider_camera_root_ref);

        this.x_offset = 0;

        if (options.offset) {
            this.camera_ref.position.copy(options.offset);
        }
        else {
            this.camera_ref.position.set(this.x_offset, 2, -6); // default offset
        }

        this.look_at_target = new THREE.Vector3(this.x_offset, 0, 0); // default look at target
        if (options.offset) {
            this.look_at_target.x = options.offset.x;
        }

        this.lookAt(this.look_at_target); // default look at

        // #endregion

        this._bindEvents();
    }

    lockMouse() {
        this.is_locked = true;
        this.dom_element.requestPointerLock();
    }

    unlockMouse() {
        this.is_locked = false;
        document.exitPointerLock();
    }

    enable() {
        this.enabled = true;
        this.lookAt(this.look_at_target);
        this.lockMouse();
    }

    disable() {
        this.enabled = false;
        this.unlockMouse();
    }

    // accepts a target of type THREE.Object3D or THREE.Vector3
    // use to init rotation. this will also alter the yaw and pitch vars.
    lookAt(target) {
        this.camera_ref.rotation.z = 0;

        const up = new THREE.Vector3(0, 1, 0);
        const target_position = new THREE.Vector3();
        if (target instanceof THREE.Object3D) {
            target_position.setFromMatrixPosition(target.matrixWorld);
        } else if (target instanceof THREE.Vector3) {
            target_position.copy(target);
        } else {
            alert("invalid target for lookAt");
            return;
        }

        // compute forward vector (negative Z in camera space)
        const z_axis = new THREE.Vector3().subVectors(this.camera_ref.position, target_position).normalize();

        // compute right vector
        const x_axis = new THREE.Vector3().crossVectors(up, z_axis).normalize();

        // recompute orthogonal up vector
        const y_axis = new THREE.Vector3().crossVectors(z_axis, x_axis).normalize();

        // build the rotation matrix
        const m = new THREE.Matrix4().makeBasis(x_axis, y_axis, z_axis);

        // apply rotation matrix to object
        this.camera_ref.quaternion.setFromRotationMatrix(m);
        this.euler.setFromQuaternion(this.camera_ref.quaternion, 'YXZ');
        this.pitch = this.euler.x;
        this.yaw = this.euler.y;
    }

    _bindEvents() {
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseScroll = this._onMouseScroll.bind(this);

        this.dom_element.addEventListener('mousedown', this._onMouseDown);
        this.dom_element.addEventListener('wheel', this._onMouseScroll);
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('mousemove', this._onMouseMove);
    }

    _onKeyDown(e) {
        if (!this.enabled) return;
        switch (e.code) {
            case 'KeyW': this.inputs.forward = true; break;
            case 'KeyS': this.inputs.backward = true; break;
            case 'KeyA': this.inputs.left = true; break;
            case 'KeyD': this.inputs.right = true; break;
            case 'ShiftLeft': this.inputs.accel = true; break;
            case 'Backquote':
                // toggle pointer lock
                if (this.is_locked) {
                    document.exitPointerLock();
                    this.is_locked = false;
                } else {
                    this.dom_element.requestPointerLock();
                    this.is_locked = true;
                }
                break;
        }
    }

    _onKeyUp(e) {
        if (!this.enabled) return;
        switch (e.code) {
            case 'KeyW': this.inputs.forward = false; break;
            case 'KeyS': this.inputs.backward = false; break;
            case 'KeyA': this.inputs.left = false; break;
            case 'KeyD': this.inputs.right = false; break;
            case 'ShiftLeft': this.inputs.accel = false; break;
        }
    }

    _onMouseDown(e) {
        if (!this.enabled) return;
        if (e.button === 0) { // left mouse button
            this.lockMouse();
        }
    }

    _onMouseUp(e) {
        // nothing for now
    }

    _onMouseScroll(e) {
        e.preventDefault();
        const delta = e.deltaY || e.detail || e.wheelDelta;
        if (this.default_speed + delta * -0.1 > 0.1) { this.default_speed += delta * -0.1; }
        this.accel_speed = this.default_speed * 2;
    }

    _onMouseMove(e) {
        if (!this.enabled || !this.is_locked) return;

        const dx = e.movementX || 0;
        const dy = e.movementY || 0;

        this.look_rest = false;

        if (this.look_rest_timeout) {
            clearTimeout(this.look_rest_timeout);
        }

        // the mouse rest will be considered at rest after 100ms of no movement
        this.look_rest_timeout = setTimeout(() => {
            this.look_rest = true;
        }, 10);

        // accumulate yaw / pitch
        this.yaw -= dx * this.sensitivity;
        this.pitch -= dy * this.sensitivity;

        // clamp pitch to avoid flipping
        const PI_2 = Math.PI / 2;
        const off = 0.3;
        this.pitch = Math.max(-PI_2 - off, Math.min(PI_2 - off, this.pitch));

        // after this step, we have the movement direction (yaw)
        this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
        this.spider_camera_root_ref.quaternion.setFromEuler(this.euler);
    }

    doRaycasts() {
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                // retrieve the raycaster origin and direction
                const raycaster_origin = this.raycaster_origins[lr][i];
                const raycaster_direction = this.raycaster_directions[lr][i];

                // retrueve the raycaster object
                const raycaster_object = this.raycaster_objects[lr][i];

                // translate a global position for the raycaster
                const raycaster_world_position = new THREE.Vector3();
                raycaster_origin.getWorldPosition(raycaster_world_position);
                // translate the raycaster direction to world space
                const raycaster_world_direction = raycaster_direction.clone();
                raycaster_world_direction.applyQuaternion(raycaster_origin.getWorldQuaternion(new THREE.Quaternion()));

                // shoot the ray
                raycaster_object.set(raycaster_world_position, raycaster_world_direction);

                let intersections = null;
                if (this.raycasting_candidates) {
                    intersections = raycaster_object.intersectObjects(this.raycasting_candidates, false);
                }
                else {
                    intersections = raycaster_object.intersectObjects(this.scene_ref.children, true);
                }

                if (intersections.length > 0) {
                    this.raycast_hit_points[lr][i] = intersections[0].point; // store the hit point
                    if (this.debug) {
                        // update the raycaster hit visualizer
                        this.raycaster_hit_visualizers[lr][i].position.copy(intersections[0].point);
                    }
                }
                // if no intersection, leave the hit point as it was in the last frame
            }
        }
    }

    getAdjacentLegs(lr, i) {
        let l_lr = lr;
        let l_idx = i;
        let r_lr = lr;
        let r_idx = i;

        // shift idxs to the corrrect direction based on lr
        if (lr == 0) {
            l_idx++;
            r_idx--;
        }
        else {
            l_idx--;
            r_idx++;
        }

        // if the leg is at a lr boundart, we need to invert lr
        if (l_idx < 0 || l_idx >= this.limb_count / 2) {
            l_lr = 1 - lr; // invert the lr
            l_idx = Math.max(0, Math.min(this.limb_count / 2 - 1, l_idx)); // clamp the index
        }

        if (r_idx < 0 || r_idx >= this.limb_count / 2) {
            r_lr = 1 - lr; // invert the lr
            r_idx = Math.max(0, Math.min(this.limb_count / 2 - 1, r_idx)); // clamp the index
        }

        return {
            l_lr,
            l_idx,
            r_lr,
            r_idx,
        }
    }

    update(delta, now) {
        if (!this.enabled);

        this.velocity.set(0, 0, 0); // reset velocity

        if (this.inputs.forward) this.velocity.z += 1;
        if (this.inputs.backward) this.velocity.z -= 1;
        if (this.inputs.left) this.velocity.x += 1;
        if (this.inputs.right) this.velocity.x -= 1;
        if (this.inputs.accel) {
            this.move_speed = this.accel_speed;
        } else {
            this.move_speed = this.default_speed;
        }
        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            this.move_rest = false;
            this.velocity.normalize().multiplyScalar(this.move_speed);
        }
        else {
            this.move_rest = true;
        }

        if (!this.look_rest || !this.move_rest) {
            console.log(`movement input detected: look_rest = ${this.look_rest}, move_rest = ${this.move_rest}`);
            this.last_movement_input_ts = now;
        }

        // offset the raycaster origins root by the velocity from its original position
        this.raycaster_origins_root.position.copy(this.velocity.clone().multiplyScalar(0.2));

        this.velocity.multiplyScalar(delta);

        // calculate the yaw rotation
        const spider_movement_euler = new THREE.Euler(0, this.yaw, 0, 'YXZ');
        const spider_movement_quaternion = new THREE.Quaternion().setFromEuler(spider_movement_euler);

        // copy only yaw to spider movement root
        // NOTE: right now, we just copy (no lerp) later we can add a lerp to smooth the movement, or disable the copying at all if the user presses alt, for example
        // to pan around the spider freely without affecting the spider's rotation
        this.spider_movement_root_ref.quaternion.copy(spider_movement_quaternion);

        // rotate velocity so it matches the camera's look direction
        this.velocity.applyQuaternion(spider_movement_quaternion);

        // apply the velocity to the spider movement root
        this.spider_movement_root_ref.position.add(this.velocity);

        // update the position of the camera so it follows the spider movement root
        this.spider_camera_root_ref.position.copy(this.spider_movement_root_ref.position);

        this.doRaycasts();

        // get a new up direction for the spider movement root using the raycast hit points
        // get a new center point for the spider movement root using the raycast hit points (average of all hit points + up vector * height from ground)

        // copy the updated position, rotation to the spider rig
        this.spider_rig_root_ref.position.copy(this.spider_movement_root_ref.position);
        this.spider_rig_root_ref.quaternion.copy(this.spider_movement_root_ref.quaternion);

        const time_since_last_movement = now - this.last_movement_input_ts;

        // 1. determine if any leg is currently in the middle of a step
        // if a step is in progress, we should not trigger a new one
        let step_in_progress = false;
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                if (this.limb_reposition_flags[lr][i]) {
                    step_in_progress = true;
                    break;
                }
            }
            if (step_in_progress) break;
        }

        // 2. if no step is in progress, check if we should start a new one
        let trigger_new_step = false;
        if (!step_in_progress) {
            // the group we would potentially move next is the other group
            const next_group_to_move = 1 - this.current_moving_group; // 1 - 0 = 1, 1 - 1 = 0

            // check if any leg in that next group is over-extended or needs to reposition due to rest
            for (let lr = 0; lr < 2; lr++) {
                for (let i = 0; i < this.limb_count / 2; i++) {
                    // only check legs belonging to the next potential group
                    if (this.leg_groups[lr][i] === next_group_to_move) {
                        const distance = this.anchors[lr][i].distanceTo(this.raycast_hit_points[lr][i]);
                        const unrested_mult = time_since_last_movement > this.max_time_unrested ? 0.2 : 1.0; // if unrested, shrink the threshold to 10% of the original
                        const stretched = distance > this.limb_offset_thresholds[lr][i] * unrested_mult;

                        if (stretched) {
                            trigger_new_step = true;
                            break;
                        }
                    }
                }
                if (trigger_new_step) break;
            }

            // if we found a reason to step, switch the active group
            if (trigger_new_step) {
                this.current_moving_group = next_group_to_move;
            }
        }

        // 3. update all legs: update in-progress steps and starting new ones
        for (let lr = 0; lr < 2; lr++) {
            for (let i = 0; i < this.limb_count / 2; i++) {
                const anchor = this.anchors[lr][i];
                const hit_point = this.raycast_hit_points[lr][i];

                // ALWAYS update the position of a leg that is currently stepping
                if (this.limb_reposition_flags[lr][i]) {
                    const stepper = this.limb_steppers[lr][i];
                    const elapsed_time = now - this.reposition_start_timestamps[lr][i];

                    if (elapsed_time >= stepper.duration) {
                        // stepper is done, reset the flag and snap the anchor to the final target
                        this.limb_reposition_flags[lr][i] = false;
                        this.anchors[lr][i].copy(stepper.to);
                    }
                    else {
                        // update the anchor's position based on the stepper's progress
                        stepper.getPositionInPlace(elapsed_time, this.anchors[lr][i]);
                    }
                }

                // check if we need to START a step for a leg
                // this can only happen if a new step was triggered for its group
                const should_this_leg_move_now = trigger_new_step && (this.leg_groups[lr][i] === this.current_moving_group);

                if (should_this_leg_move_now) {
                    const distance = anchor.distanceTo(hit_point);
                    const unrested_mult = time_since_last_movement > this.max_time_unrested ? 0.2 : 1.0; // if unrested, shrink the threshold to 10% of the original
                    const stretched = distance > this.limb_offset_thresholds[lr][i] * unrested_mult;

                    // only move the legs in the group that are actually stretched or unrested
                    if (stretched) {
                        // start repositioning the limb
                        this.limb_reposition_flags[lr][i] = true;
                        this.reposition_start_timestamps[lr][i] = now;

                        // configure the stepper for this leg's movement
                        const stepper = this.limb_steppers[lr][i];
                        stepper.setFrom(this.anchors[lr][i]);
                        stepper.setTo(hit_point);
                        // TODO: replace the up vector with the spider movement root's up vector (world space)
                        stepper.setUp(new THREE.Vector3(0, 1, 0)); // up vector for the stepper

                        if (this.debug) {
                            // update the anchor visualizer target position
                            this.anchor_visualizers[lr][i].position.copy(hit_point);
                        }
                    }
                }
            }
        }

        // 4. re-translate the IK targets to the updated anchor positions
        this.spider_rig_obj_ref.setTargetPositions(this.anchors);
    }

    dispose() {
        this._unbindEvents();
    }

    _unbindEvents() {
        this.dom_element.removeEventListener('mousedown', this._onMouseDown);
        this.dom_element.removeEventListener('wheel', this._onMouseScroll);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('mousemove', this._onMouseMove);
    }
}