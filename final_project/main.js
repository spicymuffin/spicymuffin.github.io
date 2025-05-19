import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import { EditorCameraControls } from './EditorCameraControls.js';
import { EditorControls } from './EditorControls.js';

import * as objutils from './objutils.js';

const scene = new THREE.Scene();
const stats = initStats();
const renderer = initRenderer();
const camera = initCamera();
const clock = new THREE.Clock();

initDefaultLighting(scene);
initDefaultDirectionalLighting(scene);

// const loader = new OBJLoader();
// loader.load("./assets/models/city/city.obj", function (object) {
//     function setRandomColors(object) {
//         object.traverse(function (child) {
//             if (child instanceof THREE.Mesh) {
//                 const hue = Math.random();  // 색상 (0-1)
//                 const saturation = 0.7 + Math.random() * 0.3;
//                 const lightness = 0.5 + Math.random() * 0.3;

//                 const color = new THREE.Color().setHSL(hue, saturation, lightness);

//                 child.material = new THREE.MeshPhongMaterial({
//                     color: color
//                 });
//             }
//         });
//     }

//     setRandomColors(object);
//     const mesh = object;
//     scene.add(mesh);
// });

const groundPlane = objutils.createGroundPlane(false);
scene.add(groundPlane);
const box = objutils.createBox();
scene.add(box);

const cameraControls = new EditorCameraControls(camera, renderer.domElement);
const transformControls = new EditorControls(scene, camera, renderer.domElement, cameraControls, { mode: 'translate' });

const IK_target = new objutils.createSphere();
scene.add(IK_target);

cameraControls.lookAt(new THREE.Vector3(0, 0, 0));

function render() {
    requestAnimationFrame(render);
    const delta = clock.getDelta();

    // update camera controls
    cameraControls.update(delta);

    // render the scene
    renderer.render(scene, camera);

    // GUI
    stats.update();
}

render();