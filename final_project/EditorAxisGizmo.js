import * as THREE from 'three';

export class EditorAxisGizmo {
    constructor(mainCamera, size = 100) {
        // canvas
        this.dom = document.createElement('canvas');
        this.dom.style.cssText =
            `position:absolute;right:8px;bottom:8px;width:${size}px;height:${size}px;
             z-index:10;pointer-events:none;`;

        // tiny renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.dom,
            alpha: true,
            antialias: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(size, size, false);

        // tiny scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
        this.camera.position.set(0, 0, 3);

        this.scene.add(new THREE.AxesHelper(1.6));

        // keep orientation in sync
        this.update = () => {
            this.camera.quaternion.copy(mainCamera.quaternion);
            this.renderer.render(this.scene, this.camera);
        };
    }
}