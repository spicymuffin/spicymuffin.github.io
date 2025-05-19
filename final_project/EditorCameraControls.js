import * as THREE from 'three';

export class EditorCameraControls {
    constructor(camera, domElement = document.body) {
        this.camera = camera;
        this.domElement = domElement;

        this.enabled = true;

        this.moveSpeed = 10;
        this.lookSpeed = 0.002;

        this.defaultSpeed = 10;
        this.accelSpeed = 20;

        this.inputs = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            accel: false,
        };

        this.isDragging = false;
        this.dragStart = new THREE.Vector2();

        this._bindEvents();
    }

    _bindEvents() {
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseScroll = this._onMouseScroll.bind(this);

        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        this.domElement.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('mousemove', this._onMouseMove);
        this.domElement.addEventListener('wheel', this._onMouseScroll);
    }

    _onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': this.inputs.forward = true; break;
            case 'KeyS': this.inputs.backward = true; break;
            case 'KeyA': this.inputs.left = true; break;
            case 'KeyD': this.inputs.right = true; break;
            case 'KeyE': this.inputs.up = true; break;
            case 'KeyQ': this.inputs.down = true; break;
            case 'ShiftLeft': this.inputs.accel = true; break;
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': this.inputs.forward = false; break;
            case 'KeyS': this.inputs.backward = false; break;
            case 'KeyA': this.inputs.left = false; break;
            case 'KeyD': this.inputs.right = false; break;
            case 'KeyE': this.inputs.up = false; break;
            case 'KeyQ': this.inputs.down = false; break;
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

        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;

        this.camera.rotation.order = 'YXZ'; // yaw-pitch-roll

        this.camera.rotation.y -= movementX * this.lookSpeed;
        this.camera.rotation.x -= movementY * this.lookSpeed;

        const PI_2 = Math.PI / 2;
        this.camera.rotation.x = Math.max(-PI_2, Math.min(PI_2, this.camera.rotation.x));
        // this.camera.rotation.z = 0;
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

    dispose() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        this.domElement.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('wheel', this._onMouseScroll);
    }
}
