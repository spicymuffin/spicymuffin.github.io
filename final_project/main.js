import * as THREE from 'three';

import { initStats, initRenderer, initCamera, initDefaultLighting, initDefaultDirectionalLighting } from './setup.js';

import * as objutils from './objutils.js';

import { EditorCameraControls } from './EditorCameraControls.js';
import { EditorControls } from './EditorControls.js';
import { EditorAxisGizmo } from './EditorAxisGizmo.js';

import { IKChain } from './IKChain.js';


const scene = new THREE.Scene();
const stats = initStats();
const renderer = initRenderer();
const camera = initCamera({ position: { x: -10, y: 10, z: -10 } });
const clock = new THREE.Clock();

initDefaultLighting(scene);
initDefaultDirectionalLighting(scene);

const groundPlane = objutils.createGroundPlane(false);
groundPlane.position.y = -2;
scene.add(groundPlane);
// const box = objutils.createBox();
// scene.add(box);

const editorCameraControls = new EditorCameraControls(camera, renderer.domElement);
const transformControls = new EditorControls(scene, camera, renderer.domElement, editorCameraControls, { mode: 'translate' });

const axisGizmo = new EditorAxisGizmo(camera, 100);
renderer.domElement.parentElement.style.position = 'relative';
renderer.domElement.parentElement.appendChild(axisGizmo.dom);

const ntargets = 1;
const IK_targets = [];
IK_targets.length = ntargets;

for (let i = 0; i < ntargets; i++) {
    const target = objutils.createSphere({ radius: 2, color: 0xff0000 });
    target.name = `IK_target_${i}`;
    target.position.set(Math.random() * 10 - 5, Math.random() * 10 + 15, Math.random() * 10 + 5);
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

// const axis = new THREE.Vector3(1, 0, 0);
// const angle = Math.PI / 2;
// bones[1].quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));

const testIKChain = new IKChain(bones[nbones - 1], nbones, scene, { debug: true });

editorCameraControls.lookAt(new THREE.Vector3(0, 0, 0));

function render() {
    requestAnimationFrame(render);
    const delta = clock.getDelta();

    // update camera controls
    editorCameraControls.update(delta);
    // update axis gizmo
    axisGizmo.update();

    // render the scene
    renderer.render(scene, camera);

    // GUI
    stats.update();
}

render();