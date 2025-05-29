import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';

import { EditorCameraControls } from './EditorCameraControls.js';
import { EditorControls } from './EditorControls.js';

import { IKChain, IKJointConstraint, IKAxisConstraint, IKPoleConstraint } from './IKChain.js';
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
groundPlane.position.y = -6;
scene.add(groundPlane);
const axis = new THREE.AxesHelper(10);
axis.position.set(0, 0, 0);
axis.raycast = () => { };
scene.add(axis);

const editorCameraControls = new EditorCameraControls(camera, renderer.domElement);
const transformControls = new EditorControls(scene, camera, renderer.domElement, editorCameraControls, { mode: 'translate' });

editorCameraControls.lookAt(new THREE.Vector3(0, 0, 0));

const ntargets = 1;
const targets = [];
targets.length = ntargets;

for (let i = 0; i < ntargets; i++) {
    const target = objutils.createSphere({ radius: 0.4, color: 0xff0000, transparent: true, opacity: 0.5 });
    target.name = `IK_target_${i}`;
    target.position.set(0, 3, 6);
    targets[i] = target;
    scene.add(target);
}

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

let poles = [];
const npoles = nbones;
poles.length = npoles;

const pole = objutils.createSphere({ radius: 0.3, color: 0xffff00, transparent: true, opacity: 0.5 });
pole.name = `pole`;
pole.position.set(0, 5, 3);
scene.add(pole);

constraints = [
    null, null,
];

const testIKChain = new IKChain(bones[nbones - 1], nbones, scene, constraints, { debug: true });

constraints[0] = new IKPoleConstraint(1, testIKChain, pole, { polerot_root: -2, polerot_leaf: -2, debug: true });
constraints[1] = new IKPoleConstraint(2, testIKChain, pole, { polerot_root: -2, polerot_leaf: -2, debug: true });

let realtimeIK = false;

const actions = {
    runSolver: () => {
        testIKChain.solve(targets[0], 0.01, 10);
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

    // update pole
    const dir = new THREE.Vector3();
    dir.subVectors(bones[0].position, targets[0].position);

    pole.position.copy(targets[0].position.clone().add(dir.multiplyScalar(0.5)));
    pole.position.y += 5;


    if (realtimeIK) {
        testIKChain.solve(targets[0], 0.1, 10);
    }

    // GUI
    stats.update();
}

render();