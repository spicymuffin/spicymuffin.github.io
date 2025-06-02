import * as THREE from 'three';
import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { SpiderRig } from './SpiderRig.js';

// gets input (mouse and keyboard), applies it to the spider_root_ref. updates the spider_rig and camera
export class SpiderController {
    constructor(spider_root_ref, spider_rig, camera, dom_element = document.body, options = {}) {
        this.spider_root_ref = spider_root_ref;
        this.spider_rig = spider_rig;
        this.camera = camera;
        this.dom_element = dom_element;

        this.enabled = true;
        this.move_speed = 10;
        this.sesnitivity = 0.002;
    }

    _bindEvents() {
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseScroll = this._onMouseScroll.bind(this);

        this.domElement.addEventListener('mousedown', this._onMouseDown);
        this.domElement.addEventListener('wheel', this._onMouseScroll);
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('mousemove', this._onMouseMove);
    }

    _onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': this.inputs.forward = true; break;
            case 'KeyS': this.inputs.backward = true; break;
            case 'KeyA': this.inputs.left = true; break;
            case 'KeyD': this.inputs.right = true; break;
            // case 'ShiftLeft': this.inputs.accel = true; break;
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': this.inputs.forward = false; break;
            case 'KeyS': this.inputs.backward = false; break;
            case 'KeyA': this.inputs.left = false; break;
            case 'KeyD': this.inputs.right = false; break;
            case 'ShiftLeft': this.inputs.accel = false; break;
        }
    }

    _onMouseDown(e) {
        if (e.button === 2) { // right mouse button
            this.isDragging = true;
            this.domElement.requestPointerLock();
        }
    }

    _onMouseUp(e) {
        if (e.button === 2) {
            this.isDragging = false;
            document.exitPointerLock();
        }
    }

    _onMouseScroll(e) {
        e.preventDefault();
        const delta = e.deltaY || e.detail || e.wheelDelta;
        if (this.defaultSpeed + delta * -0.1 > 0.1) { this.defaultSpeed += delta * -0.1; }
        this.accelSpeed = this.defaultSpeed * 2;
    }

    _onMouseMove(e) {
        if (!this.enabled || !this.isDragging) return;

        const dx = e.movementX || 0;
        const dy = e.movementY || 0;

        /* accumulate yaw / pitch */
        this.yaw -= dx * this.sensitivity;
        this.pitch -= dy * this.sensitivity;

        /* clamp pitch to avoid flipping */
        const PI_2 = Math.PI / 2;
        this.pitch = Math.max(-PI_2, Math.min(PI_2, this.pitch));

        this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(this.euler);
    }

    update(delta) {
        if (!this.enabled) return;

        const velocity = new THREE.Vector3();

        if (this.inputs.forward) velocity.z -= 1;
        if (this.inputs.backward) velocity.z += 1;
        if (this.inputs.left) velocity.x -= 1;
        if (this.inputs.right) velocity.x += 1;
        if (this.inputs.up) velocity.y += 1;
        if (this.inputs.down) velocity.y -= 1;
        if (this.inputs.accel) {
            this.moveSpeed = this.accelSpeed;
        } else {
            this.moveSpeed = this.defaultSpeed;
        }

        velocity.normalize().multiplyScalar(this.moveSpeed * delta);

        // move in local space
        this.camera.translateX(velocity.x);
        this.camera.translateY(velocity.y);
        this.camera.translateZ(velocity.z);
    }

    _unbindEvents() {
        this.domElement.removeEventListener('mousedown', this._onMouseDown);
        this.domElement.removeEventListener('wheel', this._onMouseScroll);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('mousemove', this._onMouseMove);
    }

    dispose() {
        this._unbindEvents();
    }
}