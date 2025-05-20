import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';

import { EditorCameraControls } from './EditorCameraControls.js';
import { EditorControls } from './EditorControls.js';

import { IKChain } from './IKChain.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

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

const groundPlane = objutils.createGroundPlane(false);
groundPlane.position.y = -2;
scene.add(groundPlane);
const axis = new THREE.AxesHelper(10);
axis.position.set(0, -2, 0);
axis.raycast = () => { };
scene.add(axis);
// const box = objutils.createBox();
// scene.add(box);

const editorCameraControls = new EditorCameraControls(camera, renderer.domElement);
const transformControls = new EditorControls(scene, camera, renderer.domElement, editorCameraControls, { mode: 'translate' });

editorCameraControls.lookAt(new THREE.Vector3(0, 0, 0));

const ntargets = 1;
const IK_targets = [];
IK_targets.length = ntargets;

for (let i = 0; i < ntargets; i++) {
    const target = objutils.createSphere({ radius: 0.4, color: 0xff0000, transparent: true, opacity: 0.5 });
    target.name = `IK_target_${i}`;
    target.position.set(0, 0, 6);
    IK_targets[i] = target;
    scene.add(target);
}

const nbones = 4;
const bones = [];
// const boneViz = [];

for (let i = 0; i < nbones; i++) {
    const b = new THREE.Bone();
    b.name = `bone_${i}`;

    b.position.set(0, 0, 1);
    // console.log(b.position);

    // let dbgSphere = objutils.createSphere({ radius: 0.2, color: 0x00ff00 });
    // dbgSphere.position.copy(b.position);
    // dbgSphere.name = `bone_${i}_dbg`;
    // scene.add(dbgSphere);

    if (i > 0) {
        bones[i - 1].add(b);
        // boneViz[i - 1].add(dbgSphere);
    }

    bones.push(b);
    // boneViz.push(dbgSphere);
}

scene.add(bones[0]);

// bones[1].quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3);
// bones[2].quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3);
// bones[3].quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3);

const testIKChain = new IKChain(bones[nbones - 1], nbones, scene, null, null, { debug: true });

let realtimeIK = false;

const actions = {
    runSolver: () => {
        testIKChain.solve(IK_targets[0], 0.1, 10);
    },

    flipRealtimeIK: () => {
        realtimeIK = !realtimeIK;
    },
};

// add a button
gui.add(actions, 'runSolver').name('Solve IK');
gui.add(actions, 'flipRealtimeIK').name('Realtime IK');

function render() {
    requestAnimationFrame(render);
    const delta = clock.getDelta();

    // update camera controls
    editorCameraControls.update(delta);

    // render the scene
    renderer.render(scene, camera);

    if (realtimeIK) {
        testIKChain.solve(IK_targets[0], 0.1, 10);
    }

    // GUI
    stats.update();
}

render();