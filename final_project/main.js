import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { EditorCameraControls } from './EditorCameraControls.js';
import { EditorControls } from './EditorControls.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { SpiderRig } from './SpiderRig.js';
import { SpiderController } from './SpiderController.js';

const gui = new GUI();
gui.domElement.style.position = 'absolute';
gui.domElement.style.right = '265px';

const scene = new THREE.Scene();
const stats = initStats();
const renderer = initRenderer();
const editor_camera = initCamera({ position: { x: -7, y: 3, z: 13 } });
const spider_camera = initCamera({ position: { x: -7, y: 3, z: 13 } });
const clock = new THREE.Clock();

initDefaultLighting(scene);
initDefaultDirectionalLighting(scene);

const ground_plane = objutils.createGroundPlane();
ground_plane.position.y = -6;
scene.add(ground_plane);
const axis = new THREE.AxesHelper(10);
axis.position.set(0, 0, 0);
axis.raycast = () => { };
scene.add(axis);

const editor_camera_controls = new EditorCameraControls(editor_camera, renderer.domElement);
const editor_controls = new EditorControls(scene, editor_camera, renderer.domElement, editor_camera_controls, { mode: 'translate' });

const Mode = Object.freeze({
    editor: 0,
    spider: 1,
});

let mode = Mode.editor;
let camera = editor_camera;

editor_camera_controls.lookAt(new THREE.Vector3(0, 0, 0));

// spider locomomotion workflow:
// 1. user gives some inputs (wasd)
// 2. the spider position is updated (spider's body and target raycasters)
//    this causes all the targets to move with the spider
//    if some legs' anchors are too far from their targets, a repositioning sequence lerps anchors to targets
// 3. a plane is fitted to the anchored (or all?) end effectors to give a rotation to the spider's body
// 4. the IK solver is run to adjust the legs' bones to the new rotated body and the anchors' positions

let realtime_IK = false;

const spider_root = objutils.createSphere({
    radius: 0.5,
    color: colors.white,
    transparent: true,
    opacity: 0.5,
});

spider_root.name = 'spider_root';
scene.add(spider_root);

const spider_rig = new SpiderRig(spider_root, {
    position: new THREE.Vector3(0, -3, 0),
    debug: true,
});

const spider_contoller = new SpiderController(spider_root, spider_rig, spider_camera, renderer.domElement, {});

document.addEventListener('keydown', (event) => {
    if (event.key === 'c') {
        // switch active camera
        if (camera === editor_camera) {
            mode = Mode.spider;
            camera = spider_camera;
            editor_camera_controls.enabled = false;
            spider_contoller.enabled = true;
        } else {
            mode = Mode.editor;
            camera = editor_camera;
            editor_camera_controls.enabled = true;
            spider_contoller.enabled = false;
        }
    }
}, false);

const actions = {
    runSolver: () => {
        // update the poles
        spider_rig.updatePolePositions();
        // update the IK chains
        spider_rig.updateIKChains();
    },

    flipRealtimeIK: () => {
        realtime_IK = !realtime_IK;
    },

    action: () => {
        spider_rig.updateIKChains();
    }
};

// add a button
gui.add(actions, 'runSolver').name('Solve IK');
gui.add(actions, 'flipRealtimeIK').name('Realtime IK');
gui.add(actions, 'action').name('Action');

function render() {
    requestAnimationFrame(render);
    const delta = clock.getDelta();

    // update editor camera controls
    if (mode === Mode.editor) {
        editor_camera_controls.update(delta);
    }
    else {
        spider_contoller.update(delta);
    }

    // render the scene
    renderer.render(scene, editor_camera);

    if (realtime_IK) {
        // update the poles
        spider_rig.updatePolePositions();
        // update the IK chains
        spider_rig.updateIKChains();
    }

    // GUI
    stats.update();
}

render();