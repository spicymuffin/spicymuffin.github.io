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

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const easingFunctions = {
    'Ease In-Out (Quadratic)': t => t * (2 - t),
    'Linear': t => t,
    'Ease In (Cubic)': t => t * t * t,
    'Ease Out (Cubic)': t => 1 - Math.pow(1 - t, 3),
    'Ease In-Out (Cubic)': t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    'Overshoot': t => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
};

async function main() {
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

    const starCount = 1000;
    const stars = new THREE.Group();
    const starGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < starCount; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        const radius = 100;
        star.position.set(
            (Math.random() - 0.5) * radius,
            (Math.random() - 0.5) * radius,
            (Math.random() - 0.5) * radius
        );
        stars.add(star);
    }
    scene.add(stars);

    const loader = new GLTFLoader();
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();

    const [backgroundGltf, robot_head_gltf, robot_arm_gltf, ambientBuffer] = await Promise.all([
        loader.loadAsync('blender/background.glb'),
        loader.loadAsync('blender/robot_head.glb'),
        loader.loadAsync('blender/robot_arm.glb'),
        audioLoader.loadAsync('assets/sounds/ambient.mp3')
    ]);

    const raycasting_candidates = [];

    const background = backgroundGltf.scene;
    background.traverse(obj => {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.isMesh) {
            obj.layers.enable(3);
            raycasting_candidates.push(obj);
            obj.material.depthTest = true;
            obj.material.depthWrite = true;
            obj.material.side = THREE.DoubleSide;
            obj.renderOrder = 0;
            if (obj.name.includes("grass")) {
                obj.material.alphaTest = 0.5;
            }
            if (obj.name == "pCylinder34_Light_0") {
                obj.material.emissive.set(0xffffff);
                obj.material.emissiveIntensity = 0.3;
                obj.material.alphaTest = 1.0;
            }
            if (obj.name == "Biig_LP_BigMushrooms_0") {
                const biiiig = obj.clone();
                biiiig.position.set(-141.5176143422687, -10.922487402934419, -28.092259821048195);
                biiiig.scale.set(27.022086805646087, 27.022086805646087, 27.022086805646087);
                scene.add(biiiig);
                biiiig.layers.enable(3);
                raycasting_candidates.push(biiiig);
            }
        }
    });

    background.scale.set(5, 5, 5);
    background.rotation.set(0, Math.PI, 0);
    background.position.set(0, -5.5, -13);
    scene.add(background);

    const ambient_sound = new THREE.Audio(listener);
    ambient_sound.setBuffer(ambientBuffer);
    ambient_sound.setLoop(true);
    ambient_sound.setVolume(0.5);
    ambient_sound.play();

    const editor_controller = new EditorController(editor_camera, renderer.domElement, { look_at: new THREE.Vector3(0, 0, 0) });
    const transform_manipulator = new TransformManipulator(scene, editor_camera, renderer.domElement, editor_controller, { mode: 'translate' });

    let realtime_IK = true;

    const spider_movement_root = new THREE.Object3D();
    spider_movement_root.name = 'spider_movement_root';

    let mesh = null;
    robot_head_gltf.scene.traverse((child) => {
        if (child.isMesh && !mesh) {
            mesh = child.clone();
        }
    });

    if (mesh) {
        mesh.scale.set(4, 4, 4);
        mesh.rotation.set(0, -Math.PI / 2, 0);
        mesh.position.set(0, 0.8, 0);
        spider_movement_root.add(mesh);
    }
    scene.add(spider_movement_root);

    const spider_rig_root = new THREE.Object3D();
    spider_rig_root.name = 'spider_rig_root'
    scene.add(spider_rig_root);

    const spider = [spider_movement_root, spider_rig_root];
    for (let i = 0; i < spider.length; i++) {
        const spider_part = spider[i];
        spider_part.position.set(0, -3.5, 0);
    }

    let sharedMesh = null;
    robot_arm_gltf.scene.traverse((child) => {
        if (child.isMesh && !sharedMesh) {
            console.log('[Found Mesh]', child.name);
            sharedMesh = child;
        }
    });

    const spider_rig = new SpiderRig(spider_rig_root,
        {
            debug: true,
            sharedMesh: sharedMesh
        }
    );

    // ensure world matrices are updated before spider controller initializes and raycasts
    scene.updateMatrixWorld(true);

    const spider_controller = new SpiderController(
        scene,
        spider_movement_root,
        spider_rig_root,
        spider_rig,
        spider_camera,
        renderer.domElement,
        {
            debug: true,
            raycasting_candidates: raycasting_candidates,
        }
    );

    // Main Parameters
    const controller_params = {
        easingFunctionName: 'Ease In-Out (Quadratic)'
    };

    const bodyFolder = gui.addFolder('Spider Body');
    bodyFolder.add(spider_controller, 'ride_height', 0.1, 5.0).name('Ride Height');

    const movementFolder = gui.addFolder('Movement');
    movementFolder.add(spider_controller, 'default_speed', 1, 10).name('Walk Speed');
    movementFolder.add(spider_controller, 'accel_speed', 1, 20).name('Sprint Speed');
    movementFolder.add(spider_controller, 'turn_speed', 1, 15).name('Turn Speed');

    const threshold_params = {
        pair_0: spider_controller.limb_offset_thresholds[0][0], // front legs
        pair_1: spider_controller.limb_offset_thresholds[0][1],
        pair_2: spider_controller.limb_offset_thresholds[0][2],
        pair_3: spider_controller.limb_offset_thresholds[0][3]  // rear legs
    };

    const gaitFolder = gui.addFolder('Gait & Stepping');
    gaitFolder.add(spider_controller, 'time_to_reposition', 0.05, 1.0).name('Step Duration (s)')
        .onChange(value => spider_controller.updateStepDuration(value)); // Add onChange
    gaitFolder.add(spider_controller, 'max_time_unrested', 0.1, 2.0).name('Idle Reposition (s)');
    gaitFolder.add(spider_controller, 'lift_amount', 0.1, 3.0).name('Step Lift Amount')
        .onChange(value => spider_controller.updateStepLift(value)); // Add onChange
    gaitFolder.add(spider_controller, 'curve_bias', 0.0, 1.0).name('Step Curve Bias')
        .onChange(value => spider_controller.updateStepCurve(value)); // Add onChange

    gaitFolder.add(controller_params, 'easingFunctionName', Object.keys(easingFunctions))
        .name('Easing Function')
        .onChange(value => {
            spider_controller.updateEasingFunction(easingFunctions[value]);
        });

    const thresholdsFolder = gaitFolder.addFolder('Step Thresholds');
    thresholdsFolder.add(threshold_params, 'pair_0', 0.01, 5.0).name('Front Pair (0)')
        .onChange(value => {
            spider_controller.limb_offset_thresholds[0][0] = value;
            spider_controller.limb_offset_thresholds[1][0] = value;
        });

    thresholdsFolder.add(threshold_params, 'pair_1', 0.01, 5.0).name('Mid-Front Pair (1)')
        .onChange(value => {
            spider_controller.limb_offset_thresholds[0][1] = value;
            spider_controller.limb_offset_thresholds[1][1] = value;
        });

    thresholdsFolder.add(threshold_params, 'pair_2', 0.01, 5.0).name('Mid-Rear Pair (2)')
        .onChange(value => {
            spider_controller.limb_offset_thresholds[0][2] = value;
            spider_controller.limb_offset_thresholds[1][2] = value;
        });

    thresholdsFolder.add(threshold_params, 'pair_3', 0.01, 5.0).name('Rear Pair (3)')
        .onChange(value => {
            spider_controller.limb_offset_thresholds[0][3] = value;
            spider_controller.limb_offset_thresholds[1][3] = value;
        });

    thresholdsFolder.close();

    const poleFolder = gui.addFolder('IK Pole Control');

    poleFolder.add(spider_rig, 'pole_distance_multiplier', 0, 20).name('Pole Distance');
    poleFolder.add(spider_rig, 'pole_vertical_offset', -5, 20).name('Pole Height Offset');

    const poleOffsetFolder = poleFolder.addFolder('Manual Offset');

    poleOffsetFolder.add(spider_rig.pole_additional_offset, 'x', -10, 10).step(0.1);
    poleOffsetFolder.add(spider_rig.pole_additional_offset, 'y', -10, 10).step(0.1);
    poleOffsetFolder.add(spider_rig.pole_additional_offset, 'z', -10, 10).step(0.1);

    poleOffsetFolder.close();
    poleFolder.close();

    const raycaster_params = {
        radius_0: spider_controller.raycaster_z_offsets[0],
        radius_1: spider_controller.raycaster_z_offsets[1],
        radius_2: spider_controller.raycaster_z_offsets[2],
        radius_3: spider_controller.raycaster_z_offsets[3],
        height_0: spider_controller.raycaster_y_offsets[0],
        height_1: spider_controller.raycaster_y_offsets[1],
        height_2: spider_controller.raycaster_y_offsets[2],
        height_3: spider_controller.raycaster_y_offsets[3],
    };

    const raycasterFolder = gui.addFolder('Raycaster Placement');
    const radiusFolder = raycasterFolder.addFolder('Radius (from center)');
    radiusFolder.add(raycaster_params, 'radius_0', 0, 10).name('Front Pair').onChange(v => { spider_controller.raycaster_z_offsets[0] = v; spider_controller.updateRaycasterPositions(); });
    radiusFolder.add(raycaster_params, 'radius_1', 0, 10).name('Mid-Front Pair').onChange(v => { spider_controller.raycaster_z_offsets[1] = v; spider_controller.updateRaycasterPositions(); });
    radiusFolder.add(raycaster_params, 'radius_2', 0, 10).name('Mid-Rear Pair').onChange(v => { spider_controller.raycaster_z_offsets[2] = v; spider_controller.updateRaycasterPositions(); });
    radiusFolder.add(raycaster_params, 'radius_3', 0, 10).name('Rear Pair').onChange(v => { spider_controller.raycaster_z_offsets[3] = v; spider_controller.updateRaycasterPositions(); });

    const heightFolder = raycasterFolder.addFolder('Height (from body)');
    heightFolder.add(raycaster_params, 'height_0', -5, 5).name('Front Pair').onChange(v => { spider_controller.raycaster_y_offsets[0] = v; spider_controller.updateRaycasterPositions(); });
    heightFolder.add(raycaster_params, 'height_1', -5, 5).name('Mid-Front Pair').onChange(v => { spider_controller.raycaster_y_offsets[1] = v; spider_controller.updateRaycasterPositions(); });
    heightFolder.add(raycaster_params, 'height_2', -5, 5).name('Mid-Rear Pair').onChange(v => { spider_controller.raycaster_y_offsets[2] = v; spider_controller.updateRaycasterPositions(); });
    heightFolder.add(raycaster_params, 'height_3', -5, 5).name('Rear Pair').onChange(v => { spider_controller.raycaster_y_offsets[3] = v; spider_controller.updateRaycasterPositions(); });

    raycasterFolder.close();

    const debug_params = {
        anchors: false, raycastHits: false, ikTargets: false, ikPoles: false,
        ikProxies: false, bones: false, raycastOrigins: false, repositionTarget: false, meshVisibility: true,
    };

    const debugFolder = gui.addFolder('Debug Visuals');
    debugFolder.add(debug_params, 'anchors').name('Anchors').onChange(v => spider_controller.setDebugAnchorsVisible(v));
    debugFolder.add(debug_params, 'raycastHits').name('Raycast Hits').onChange(v => spider_controller.setDebugRaycastHitsVisible(v));
    debugFolder.add(debug_params, 'ikTargets').name('IK Targets').onChange(v => spider_rig.setDebugTargetsVisible(v));
    debugFolder.add(debug_params, 'ikPoles').name('IK Poles').onChange(v => spider_rig.setDebugPolesVisible(v));
    debugFolder.add(debug_params, 'ikProxies').name('IK Proxies').onChange(v => spider_rig.setDebugIkProxiesVisible(v));
    debugFolder.add(debug_params, 'bones').name('Bones').onChange(v => spider_rig.setDebugBonesVisible(v));
    debugFolder.add(debug_params, 'raycastOrigins').name('Raycast Origins').onChange(v => { spider_controller.setDebugRaycastOriginsVisible(v); });
    debugFolder.add(debug_params, 'repositionTarget').name('Reposition Target').onChange(v => { spider_controller.setDebugRepositionTargetVisible(v); });
    debugFolder.add(debug_params, 'meshVisibility').name('Mesh Visibility').onChange(v => { spider_rig.setMeshVisibility(v); });

    spider_controller.setDebugAnchorsVisible(debug_params.anchors);
    spider_controller.setDebugRaycastHitsVisible(debug_params.raycastHits);
    spider_rig.setDebugTargetsVisible(debug_params.ikTargets);
    spider_rig.setDebugPolesVisible(debug_params.ikPoles);
    spider_rig.setDebugIkProxiesVisible(debug_params.ikProxies);
    spider_rig.setDebugBonesVisible(debug_params.bones);
    spider_controller.setDebugRaycastOriginsVisible(debug_params.raycastOrigins);
    spider_controller.setDebugRepositionTargetVisible(debug_params.repositionTarget);

    bodyFolder.close();
    movementFolder.close();
    debugFolder.close();
    gaitFolder.close();
    thresholdsFolder.close();

    document.addEventListener('click', () => {
        if (!ambient_sound.isPlaying) {
            ambient_sound.play();
        }
    });

    const Mode = Object.freeze({ editor: 0, spider: 1 });
    let mode = Mode.editor;
    let camera = editor_camera;

    function switchMode() {
        listener.parent?.remove(listener);
        if (mode === Mode.editor) {
            mode = Mode.spider;
            camera = spider_camera;
            spider_controller.enable();
            editor_controller.disable();
            transform_manipulator.disable();
            camera.add(listener);
        } else {
            mode = Mode.editor;
            camera = editor_camera;
            editor_controller.enable();
            transform_manipulator.enable();
            spider_controller.disable();
            camera.add(listener);
        }
    }

    switchMode();
    switchMode();

    document.addEventListener('keydown', (event) => {
        if (event.key === 'c') {
            switchMode();
        }
    }, false);

    const actions = {
        runSolver: () => {
            spider_rig.updatePolePositions();
            spider_rig.updateIKChains();
        },
        flipRealtimeIK: () => {
            realtime_IK = !realtime_IK;
        },
        sc: () => {
            switchMode();
        }
    };

    gui.add(actions, 'runSolver').name('Solve IK');
    gui.add(actions, 'flipRealtimeIK').name('Realtime IK');
    gui.add(actions, 'sc').name('Switch Mode');

    function render() {
        requestAnimationFrame(render);
        const delta = clock.getDelta();
        const now = clock.getElapsedTime();

        stars.rotation.y += delta * 0.05;

        if (mode === Mode.editor) {
            editor_controller.update(delta);
        } else {
            spider_controller.update(delta, now);
        }

        renderer.render(scene, camera);

        if (realtime_IK) {
            spider_rig.updatePolePositions();
            spider_rig.updateIKChains();
        }

        stats.update();
    }

    render();
}

main().catch(error => {
    console.error("An error occurred during initialization:", error);
});