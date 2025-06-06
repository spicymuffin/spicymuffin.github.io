import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { EditorController } from './EditorController.js';
import { TransformManipulator } from './TransformManipulator.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { SpiderRig } from './SpiderRig.js';
import { SpiderController } from './SpiderController.js';

import { SpiderLegStepper } from './SpiderLegStepper.js';

const gui = new GUI();
gui.domElement.style.position = 'absolute';
gui.domElement.style.right = '265px';

const scene = new THREE.Scene();
const stats = initStats();
const renderer = initRenderer();
const editor_camera = initCamera({ position: new THREE.Vector3(-7, 3, 13) });
const spider_camera = initCamera({ position: new THREE.Vector3(-7, 3, 13), fov: 60 });
const clock = new THREE.Clock();

const cameraHelper = new THREE.CameraHelper(spider_camera);

initDefaultLighting(scene);
initDefaultDirectionalLighting(scene);

const ground_plane = objutils.createGroundPlane();
ground_plane.position.y = -4.5;
scene.add(ground_plane);

const ground_sphere = objutils.createSphere({
    radius: 10,
    color: colors.light_gray,
});
ground_sphere.position.set(-12, -12, 0);
scene.add(ground_sphere);

ground_plane.layers.enable(3);
ground_sphere.layers.enable(3);


const axis = new THREE.AxesHelper(10);
axis.position.set(0, 0, 0);
axis.raycast = () => { };
scene.add(axis);

const editor_controller = new EditorController(editor_camera, renderer.domElement, { look_at: new THREE.Vector3(0, 0, 0) });
const transform_manipulator = new TransformManipulator(scene, editor_camera, renderer.domElement, editor_controller, { mode: 'translate' });

const Mode = Object.freeze({
    editor: 0,
    spider: 1,
});

let mode = Mode.editor;
let camera = editor_camera;

// spider locomomotion overview:
// 1. user gives some inputs (wasd, mouse). the rotation defines the forward dirction, the wasd keys define the motion relative
//    to the forward direction
//    these inputs are applied relative to last frame's location of the spider_camera_root. we want this because the player expects
//    the spider to move in relation to what he sees on the screen.
// 2. the position delta and rotation delta are also applied to the raycasting object.
//    [with a lerping delay. this way, the spider will move smoothly to accommodate the user's inputs.] - no lerping for now, but can be added later...?
// 3. the raycasting object is used to raycast against the ground plane to find the new position of the spider.
// 4. the average normal vector of the raycast hits is used to determine the new up direction of the spider_camera_root
//    this way, in the next frame, the movement/view plane will be aligned with the ground plane


let realtime_IK = true;

const spider_movement_root = objutils.createBox({
    color: colors.white,
    transparent: true,
    opacity: 0.9,
    name: 'spider_movement_root',
});

scene.add(spider_movement_root);

const spider_camera_root = objutils.createSphere({
    radius: 0.2,
    color: colors.green,
    transparent: true,
    opacity: 0.4,
    name: 'spider_camera_root',
});

scene.add(spider_camera_root);

const spider_rig_root = objutils.createSphere({
    radius: 0.5,
    color: colors.red,
    transparent: true,
    opacity: 0.5,
    name: 'spider_rig_root',
});

scene.add(spider_rig_root);

const spider = [spider_movement_root, spider_camera_root, spider_rig_root];

for (let i = 0; i < spider.length; i++) {
    const spider_part = spider[i];
    spider_part.position.set(0, -3.5, 0);
}

const spider_rig = new SpiderRig(spider_rig_root,
    {
        debug: true,
    }
);

// render once to initialize the world....? idk the raycasters work during the first frame if we do this
// hacky but VERY important for spidercontroller to initialize correctly
renderer.render(scene, camera);

const spider_controller = new SpiderController(
    scene,
    spider_movement_root,
    spider_rig_root,
    spider_rig,
    spider_camera_root,
    spider_camera,
    renderer.domElement,
    {
        debug: true,
        raycasting_candidates: [ground_plane, ground_sphere],
    }
);

function switchMode() {
    // editor -> spider
    if (mode === Mode.editor) {
        mode = Mode.spider;
        camera = spider_camera;

        spider_controller.enable();

        editor_controller.disable();
        transform_manipulator.disable();
    }
    // spider -> editor
    else {
        mode = Mode.editor;
        camera = editor_camera;

        editor_controller.enable();
        transform_manipulator.enable();

        spider_controller.disable();
    }
}

switchMode();
switchMode(); // call it twice to ensure the initial state is set correctly (bad bad bad)

function handleCameraSwitchKeydown(event) {
    if (event.key === 'c') {
        switchMode();
    }
}

document.addEventListener('keydown', handleCameraSwitchKeydown, false);

let step = false;
let start_ts = 0.0;
const test_obj = objutils.createBox({
    size: new THREE.Vector3(1.2, 1.2, 1.2),
    color: colors.olive,
    position: new THREE.Vector3(0, 0, 0),
});
scene.add(test_obj);
const stepper = new SpiderLegStepper(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(5, 2, 5),
    new THREE.Vector3(0, 1, 0),
    0.2,
    {
        lift_amount: 3,
        curve_bias: 0.7,
        ease_fn: (t) => t * (2 - t), // ease in-out
    }
);

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
        step = !step;
        start_ts = clock.getElapsedTime();
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
    const now = clock.getElapsedTime();

    // update editor camera controls
    if (mode === Mode.editor) {
        editor_controller.update(delta);
    }
    else {
        spider_controller.update(delta, now);
    }

    if (step) {
        const elapsed_time = now - start_ts;
        if (elapsed_time < stepper.duration) {
            stepper.getPositionInPlace(elapsed_time, test_obj.position);
        }
        else {
            step = false; // stop stepping after the duration
            test_obj.position.copy(stepper.to);
        }
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