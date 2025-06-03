import * as THREE from 'three';
import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { SpiderRig } from './SpiderRig.js';

// gets input (mouse and keyboard), applies it to the spider_root_ref. updates the spider_rig and camera
export class SpiderController {
    constructor(spider_root_ref, spider_rig, camera, dom_element = document.body, options = {}) {
        this.camera = camera;
        this.dom_element = dom_element;

        this.enabled = true;

        this.move_speed = 10;
        this.sensitivity = 0.002;

        this.default_speed = 10;
        this.accel_speed = 20;

        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.pitch = 0;
        this.yaw = 0;

        this.is_locked = false;
        this.drag_start = new THREE.Vector2();

        this.inputs = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            accel: false,
        };

        this.spider_rig = spider_rig;
        this.spider_root_ref = spider_root_ref;

        this.spider_root_ref.add(this.camera);
        if (options.offset) {
            this.camera.position.copy(options.offset);
        }
        else {
            this.camera.position.set(0, 2, -6); // default offset
        }

        this.look_at_target = new THREE.Vector3(0, 0, 0); // default look at target
        if (options.look_at_target) {
            this.look_at_target = options.look_at_target;
        }

        this.lookAt(this.look_at_target); // default look at

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
        this.camera.rotation.z = 0;

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
        const z_axis = new THREE.Vector3().subVectors(this.camera.position, target_position).normalize();

        // compute right vector
        const x_axis = new THREE.Vector3().crossVectors(up, z_axis).normalize();

        // recompute orthogonal up vector
        const y_axis = new THREE.Vector3().crossVectors(z_axis, x_axis).normalize();

        // build the rotation matrix
        const m = new THREE.Matrix4().makeBasis(x_axis, y_axis, z_axis);

        // apply rotation matrix to object
        this.camera.quaternion.setFromRotationMatrix(m);
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
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
        // e.preventDefault();
        // const delta = e.deltaY || e.detail || e.wheelDelta;
        // if (this.default_speed + delta * -0.1 > 0.1) { this.default_speed += delta * -0.1; }
        // this.accel_speed = this.default_speed * 2;
    }

    _onMouseMove(e) {
        if (!this.enabled || !this.is_locked) return;

        const dx = e.movementX || 0;
        const dy = e.movementY || 0;

        // accumulate yaw / pitch
        this.yaw -= dx * this.sensitivity;
        this.pitch -= dy * this.sensitivity;

        // clamp pitch to avoid flipping
        const PI_2 = Math.PI / 2;
        this.pitch = Math.max(-PI_2, Math.min(PI_2, this.pitch));

        this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(this.euler);
    }

    update(delta) {
        if (!this.enabled) return;

        const velocity = new THREE.Vector3(0, 0, 0);

        if (this.inputs.forward) velocity.z += 1;
        if (this.inputs.backward) velocity.z -= 1;
        if (this.inputs.left) velocity.x += 1;
        if (this.inputs.right) velocity.x -= 1;
        if (this.inputs.accel) {
            this.move_speed = this.accel_speed;
        } else {
            this.move_speed = this.default_speed;
        }

        velocity.normalize().multiplyScalar(this.move_speed * delta);

        // move in local space
        this.spider_root_ref.translateX(velocity.x);
        this.spider_root_ref.translateY(velocity.y);
        this.spider_root_ref.translateZ(velocity.z);
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