import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';
import * as colors from './colors.js';

import { EditorCameraControls } from './EditorCameraControls.js';
import { EditorControls } from './EditorControls.js';

import { IKChain } from './IKChain.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { SpiderRig } from './SpiderRig.js';

const gui = new GUI();
gui.domElement.style.position = 'absolute';
gui.domElement.style.right = '265px';

const scene = new THREE.Scene();
const stats = initStats();
const renderer = initRenderer();
const camera = initCamera({ position: { x: -7, y: 3, z: 13 } });
const clock = new THREE.Clock();

initDefaultLighting(scene);
initDefaultDirectionalLighting(scene);

const groundPlane = objutils.createGroundPlane();
groundPlane.position.y = -6;
scene.add(groundPlane);
const axis = new THREE.AxesHelper(10);
axis.position.set(0, 0, 0);
axis.raycast = () => { };
scene.add(axis);

const editorCameraControls = new EditorCameraControls(camera, renderer.domElement);
const transformControls = new EditorControls(scene, camera, renderer.domElement, editorCameraControls, { mode: 'translate' });

editorCameraControls.lookAt(new THREE.Vector3(0, 0, 0));

const target = objutils.createSphere({ radius: 0.4, color: 0xff0000, transparent: true, opacity: 0.5 });
target.name = `target`;
target.position.set(0, 3, 6);
scene.add(target);


const nbones = 4;
const bones = [];

for (let i = 0; i < nbones; i++) {
    const b = new THREE.Bone();
    b.name = `bone_${i}`;

    b.position.set(0, 0, 3);

    if (i > 0) {
        bones[i - 1].add(b);
    }

    bones.push(b);
}

scene.add(bones[0]);

let constraints = [];

const pole = objutils.createSphere({ radius: 0.3, color: 0xffff00, transparent: true, opacity: 0.5 });
pole.name = `pole`;
pole.position.set(0, 5, 3);
scene.add(pole);

constraints = {}

const testIKChain = new IKChain(bones[nbones - 1], nbones, scene, constraints, { debug: true, pole: pole });

let realtimeIK = false;

// spider locomomotion workflow:
// 1. user gives some inputs (wasd)
// 2. the spider position is updated (spider's body and target raycasters)
//    this causes all the targets to move with the spider
//    if some legs' anchors are too far from their targets, a repositioning sequence lerps anchors to targets
// 3. a plane is fitted to the anchored (or all?) end effectors to give a rotation to the spider's body
// 4. the IK solver is run to adjust the legs' bones to the new rotated body and the anchors' positions

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

const actions = {
    runSolver: () => {
        testIKChain.solve(target, 0.01, 10);
    },

    flipRealtimeIK: () => {
        realtimeIK = !realtimeIK;
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

    // update camera controls
    editorCameraControls.update(delta);

    // render the scene
    renderer.render(scene, camera);

    // update pole
    const dir = new THREE.Vector3();
    dir.subVectors(bones[0].position, target.position);

    pole.position.copy(target.position.clone().add(dir.multiplyScalar(0.5)));
    pole.position.y += 5;

    if (realtimeIK) {
        testIKChain.solve(target, 0.01, 10);
    }

    // update the poles
    spider_rig.updatePolePositions();
    // update the IK chains
    spider_rig.updateIKChains();

    // GUI
    stats.update();
}

render();