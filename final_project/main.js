import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { EditorController } from './EditorController.js';
import { TransformManipulator } from './TransformManipulator.js';

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
const spider_camera = initCamera({ position: { x: -7, y: 3, z: 13 }, fov: 60, look_at: new THREE.Vector3(0, 0, 0) });
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

const editor_controller = new EditorController(editor_camera, renderer.domElement);
const transform_manipulator = new TransformManipulator(scene, editor_camera, renderer.domElement, editor_controller, { mode: 'translate' });

const Mode = Object.freeze({
    editor: 0,
    spider: 1,
});

let mode = Mode.editor;
let camera = editor_camera;

editor_controller.lookAt(new THREE.Vector3(0, 0, 0));

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

const spider_controller = new SpiderController(spider_root, spider_rig, spider_camera, renderer.domElement, {});

function switchMode() {
    // switch mode
    if (mode === Mode.editor) {
        mode = Mode.spider;

        camera = spider_camera;
        editor_controller.enabled = false;
        transform_manipulator.enabled = false;
        spider_controller.enabled = true;
        camera = spider_camera;
    } else {
        mode = Mode.editor;

        camera = editor_camera;
        editor_controller.enabled = true;
        transform_manipulator.enabled = true;
        spider_controller.enabled = false;
        camera = editor_camera;
    }
}

function handleCameraSwitchKeydown(event) {
    if (event.key === 'c') {
        switchMode();
    }
}

document.addEventListener('keydown', handleCameraSwitchKeydown, false);

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
    },

    sc: () => {
        switchMode();
    }
};

// add a button
gui.add(actions, 'runSolver').name('Solve IK');
gui.add(actions, 'flipRealtimeIK').name('Realtime IK');
gui.add(actions, 'action').name('Action');
gui.add(actions, 'sc').name('Switch Mode');

function render() {
    requestAnimationFrame(render);
    const delta = clock.getDelta();

    // update editor camera controls
    if (mode === Mode.editor) {
        editor_controller.update(delta);
    }
    else {
        spider_controller.update(delta);
    }

    // render the scene
    renderer.render(scene, camera);

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