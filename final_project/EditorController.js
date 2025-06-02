import * as THREE from 'three';

export class EditorController {
    constructor(camera, domElement = document.body) {
        this.camera = camera;
        this.domElement = domElement;

        this.enabled = true;

        this.moveSpeed = 10;
        this.sensitivity = 0.002;

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

        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

        this.pitch = 0;
        this.yaw = 0;

        this.isDragging = false;
        this.dragStart = new THREE.Vector2();

        this._bindEvents();
    }

    // accepts a target of type THREE.Object3D or THREE.Vector3
    // use to init rotation. this will also alter the yaw and pitch vars.
    lookAt(target) {
        this.camera.rotation.z = 0;

        const up = new THREE.Vector3(0, 1, 0);
        const targetPosition = new THREE.Vector3();
        if (target instanceof THREE.Object3D) {
            targetPosition.setFromMatrixPosition(target.matrixWorld);
        } else if (target instanceof THREE.Vector3) {
            targetPosition.copy(target);
        } else {
            alert("invalid target for lookAt");
            return;
        }

        // compute forward vector (negative Z in camera space)
        const zAxis = new THREE.Vector3().subVectors(this.camera.position, targetPosition).normalize();

        // compute right vector
        const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();

        // recompute orthogonal up vector
        const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

        // build the rotation matrix
        const rotMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

        // apply rotation matrix to object
        this.camera.quaternion.setFromRotationMatrix(rotMatrix);
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

        this.domElement.addEventListener('mousedown', this._onMouseDown);
        this.domElement.addEventListener('wheel', this._onMouseScroll);
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
            case 'KeyE': this.inputs.up = true; break;
            case 'KeyQ': this.inputs.down = true; break;
            case 'ShiftLeft': this.inputs.accel = true; break;
        }
    }

    _onKeyUp(e) {
        if (!this.enabled) return;
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
        if (!this.enabled) return;
        if (e.button === 2) { // right mouse button
            this.isDragging = true;
            this.domElement.requestPointerLock();
        }
    }

    _onMouseUp(e) {
        if (!this.enabled) return;
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

    dispose() {
        this._unbindEvents();
    }

    _unbindEvents() {
        this.domElement.removeEventListener('mousedown', this._onMouseDown);
        this.domElement.removeEventListener('wheel', this._onMouseScroll);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('mousemove', this._onMouseMove);
    }
}
