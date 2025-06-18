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

const ground_plane1 = objutils.createGroundPlane();
ground_plane1.position.y = -4.5;
scene.add(ground_plane1);

const ground_plane2 = objutils.createGroundPlane();
ground_plane2.rotation.x = -Math.PI / 4; // rotate it to be at an angle
ground_plane2.position.set(0, -4.5, -25);
scene.add(ground_plane2);

const ground_plane3 = objutils.createGroundPlane();
ground_plane3.rotation.x = 0; // rotate it to be at an angle
ground_plane3.position.set(0, 10, -30);
scene.add(ground_plane3);

const ground_plane4 = objutils.createGroundPlane();
ground_plane4.rotation.x = Math.PI / 4; // rotate it to be at an angle
ground_plane4.position.set(0, 10, -25);
scene.add(ground_plane4);

const ground_plane5 = objutils.createGroundPlane();
ground_plane5.rotation.x = Math.PI / 2; // rotate it to be at an angle
ground_plane5.position.set(0, 10, 0);
scene.add(ground_plane5);

const ground_sphere = objutils.createSphere({
    radius: 10,
    color: colors.light_gray,
});
ground_sphere.position.set(-30, -12, 0);
scene.add(ground_sphere);

ground_plane1.layers.enable(3);
ground_plane2.layers.enable(3);
ground_plane3.layers.enable(3);
ground_plane4.layers.enable(3);
ground_plane5.layers.enable(3);
ground_sphere.layers.enable(3);

let walkables = [];
walkables.push(ground_plane1);
walkables.push(ground_plane2);
walkables.push(ground_plane3);
walkables.push(ground_plane4);
walkables.push(ground_plane5);
walkables.push(ground_sphere);

// Additional objects for IK testing
const cube1 = objutils.createBox({
    size: new THREE.Vector3(2, 2, 2),
    color: colors.blue,
});
cube1.position.set(5, -3.5, 5);
scene.add(cube1);


const cube2 = objutils.createBox({
    size: new THREE.Vector3(1.5, 4, 1.5),
    color: colors.green,
});
cube2.position.set(-5, -2.5, 5);
scene.add(cube2);

const cube3 = objutils.createBox({
    size: new THREE.Vector3(3, 1, 3),
    color: colors.red,
});
cube3.position.set(0, -3, 10);
scene.add(cube3);
walkables.push(cube1);
walkables.push(cube2);
walkables.push(cube3);

// Create a staircase structure
for (let i = 0; i < 5; i++) {
    const step = objutils.createBox({
        size: new THREE.Vector3(2, 0.5, 2),
        color: colors.yellow,
    });
    step.position.set(-8, -4 + (i * 0.5), -5 + (i * 2));
    scene.add(step);
    step.layers.enable(3);
    walkables.push(step);
}

// Create a ramp
const ramp = objutils.createBox({
    size: new THREE.Vector3(3, 0.5, 8),
    color: colors.purple,
});
ramp.position.set(8, -3, -5);
ramp.rotation.x = Math.PI / 8;
scene.add(ramp);
walkables.push(ramp);

// Create a platform
const platform = objutils.createBox({
    size: new THREE.Vector3(5, 0.5, 5),
    color: colors.orange,
});
platform.position.set(3, -2, -10);
scene.add(platform);
walkables.push(platform);

// Add a smaller sphere
const smallSphere = objutils.createSphere({
    radius: 1.5,
    color: colors.pink,
});
smallSphere.position.set(7, -3, 0);
scene.add(smallSphere);
walkables.push(smallSphere);

// Enable layer 3 for all new objects
cube1.layers.enable(3);
cube2.layers.enable(3);
cube3.layers.enable(3);
ramp.layers.enable(3);
platform.layers.enable(3);
smallSphere.layers.enable(3);

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

const spider_rig_root = objutils.createSphere({
    radius: 0.5,
    color: colors.red,
    transparent: true,
    opacity: 0.5,
    name: 'spider_rig_root',
});

scene.add(spider_rig_root);

const spider = [spider_movement_root, spider_rig_root];

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
    spider_camera,
    renderer.domElement,
    {
        debug: true,
        raycasting_candidates: walkables,
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
// const stepper = new SpiderLegStepper(
//     new THREE.Vector3(0, 0, 0),
//     new THREE.Vector3(5, 2, 5),
//     new THREE.Vector3(0, 1, 0),
//     0.2,
//     spider_camera,
//     {
//         lift_amount: 3,
//         curve_bias: 0.7,
//         ease_fn: (t) => t * (2 - t), // ease in-out
//     }
// );

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