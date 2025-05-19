import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import * as util from "./util.js"

export class EditorControls {
    constructor(scene, camera, domElement, cameraControls = null, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.cameraControls = cameraControls;

        // TODO: add support for options.selctables
        // selectMode 1: all meshes on scene
        // selectMode 2: only meshes in options.selctables
        // this.selectMode = 1;

        this.transform = new TransformControls(camera, domElement);

        // TODO: add support for options.space
        this.transform.setSpace(options.space || 'world');
        this.transform.setMode(options.mode || 'translate');
        scene.add(this.transform);

        this.enabled = true;

        this.transform.addEventListener('dragging-changed', (e) => {
            if (this.cameraControls && 'enabled' in this.cameraControls) {
                this.cameraControls.enabled = !e.value;
            }
        });

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);

        domElement.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _onPointerDown(event) {
        if (!this.enabled || event.button !== 0) return;

        if (this.transform.dragging) return;

        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        const target = intersects.find(hit => !util.isChildOf(hit.object, this.transform));

        console.log("intersects:", intersects.map(i => i.object.name || i.object));

        if (target) {
            console.log("target:", target.object.name || target.object);
            this.attach(target.object);
        } else {
            console.log("no target found");
            this.detach();
        }
    }

    _onKeyDown(e) {
        if (!this.enabled) return;

        switch (e.key.toLowerCase()) {
            case 't': this.transform.setMode('translate'); break;
            case 'r': this.transform.setMode('rotate'); break;
            case 'y': this.transform.setMode('scale'); break;

            case '1': this.transform.setSpace('local'); break;
            case '2': this.transform.setSpace('world'); break;
            // TODO: add other spaces
        }
    }

    attach(object) {
        this.transform.attach(object);
    }

    detach() {
        this.transform.detach();
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
        this.detach();
    }

    dispose() {
        this.detach();
        this.domElement.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('keydown', this._onKeyDown);
        this.scene.remove(this.transform);
    }

    get mode() {
        return this.transform.getMode();
    }

    set mode(val) {
        this.transform.setMode(val);
    }

    get object() {
        return this.transform.object;
    }
}
