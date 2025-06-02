import * as THREE from 'three';
import * as util from './util.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

export class TransformManipulator {
    constructor(scene, camera, domElement, cameraControls = null, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.cameraControls = cameraControls;

        this.gui = new GUI();
        this.selectedObjGUIFolder = null;

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

        this.attachedObject = null;

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

        console.log('intersects:', intersects.map(i => i.object.name || i.object));

        if (target) {
            console.log('target:', target.object.name || target.object);
            this.attach(target.object);
        } else {
            console.log('no target found');
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
        this.attachedObject = object;

        // clear previous GUI folder
        if (this.selectedObj) {
            this.selectedObj.destroy();
        }
        this.selectedObj = this.gui.addFolder('Selected Object');

        // add properties to the GUI
        const objectID = { name: object.name || object.uuid };
        this.selectedObj.add(objectID, 'name').name('Name').listen();

        const positionFolder = this.selectedObj.addFolder('Position');
        positionFolder.add(object.position, 'x').step(0.01).listen();
        positionFolder.add(object.position, 'y').step(0.01).listen();
        positionFolder.add(object.position, 'z').step(0.01).listen();

        // TODO: although the transform contorls thing uses quaternions,
        // reading the rotation from object.rotation gives euler angles that are prone to gimbal lock
        // and are not the same as the transform controls's rotation

        // a good solution would be adding a euler angle property to 3d objects and listening to that
        // ofc we would need to convert the quaternion to euler angles when we want to read the rotation
        // and vice versa when we want to set the rotation

        const rotationFolder = this.selectedObj.addFolder('Rotation');
        rotationFolder.add(object.rotation, 'x').step(0.01).listen();
        rotationFolder.add(object.rotation, 'y').step(0.01).listen();
        rotationFolder.add(object.rotation, 'z').step(0.01).listen();

        const scaleFolder = this.selectedObj.addFolder('Scale');
        scaleFolder.add(object.scale, 'x').step(0.01).listen();
        scaleFolder.add(object.scale, 'y').step(0.01).listen();
        scaleFolder.add(object.scale, 'z').step(0.01).listen();

        this.selectedObj.open();
        positionFolder.open();
        rotationFolder.open();
        scaleFolder.open();
    }

    detach() {
        this.transform.detach();
        this.attachedObject = null;
        if (this.selectedObj) {
            this.selectedObj.destroy();
            this.selectedObj = null;
        }
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
