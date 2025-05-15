
// main three.module.js library
import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// main scene
const scene = new THREE.Scene();
scene.backgroundColor = 0x000000;  // black

// Perspective camera: fov, aspect ratio, near, far
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

// set camera position: camera.position.set(-3, 8, 2) 가 더 많이 사용됨 (약간 빠름))
camera.position.set(0, 50, -50); // camera의 위치
camera.lookAt(scene.position);
// add camera to the scene
scene.add(camera);

// setup the renderer
// antialias = true: 렌더링 결과가 부드러워짐
const renderer = new THREE.WebGLRenderer({ antialias: true });

// outputColorSpace의 종류
// sRGBColorSpace: 보통 monitor에서 보이는 color로, 어두운 부분을 약간 밝게 보이게 Gamma correction을 함
// sRGBColorSpace는 PBR (Physically Based Rendering), HDR(High Dynamic Range)에서는 필수적으로 사용함
// LinearColorSpace: 모든 색상을 선형으로 보이게 함
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.shadowMap.enabled = true; // scene에서 shadow를 보이게

// shadowMap의 종류
// BasicShadowMap: 가장 기본적인 shadow map, 쉽고 빠르지만 부드럽지 않음
// PCFShadowMap (default): Percentage-Closer Filtering, 주변의 색상을 평균내서 부드럽게 보이게 함
// PCFSoftShadowMap: 더 부드럽게 보이게 함
// VSMShadowMap: Variance Shadow Map, 더 자연스러운 블러 효과, GPU에서 더 많은 연산 필요
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 현재 열린 browser window의 width와 height에 맞게 renderer의 size를 설정
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
// attach renderer to the body of the html page
document.body.appendChild(renderer.domElement);

// add Stats: 현재 FPS를 보여줌으로써 rendering 속도 표시
const stats = new Stats();
// attach Stats to the body of the html page
document.body.appendChild(stats.dom);

// add OrbitControls: arcball-like camera control
let orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true; // 관성효과, 바로 멈추지 않고 부드럽게 멈춤
orbitControls.dampingFactor = 0.25; // 감속 정도, 크면 더 빨리 감속, default = 0.05

// add GUI: 간단한 user interface를 제작 가능
// 사용법은 https://lil-gui.georgealways.com/ 
// http://yoonbumtae.com/?p=942 참고

const gui = new GUI();
const controls = new function () {
    this.perspective = "Perspective";
    this.switchCamera = function () {
        if (camera instanceof THREE.PerspectiveCamera) {
            scene.remove(camera);
            camera = null; // 기존의 camera 제거    
            // OrthographicCamera(left, right, top, bottom, near, far)
            camera = new THREE.OrthographicCamera(window.innerWidth / -16,
                window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / -16, -200, 500);
            camera.position.set(0, 50, -50);
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.perspective = "Orthographic";
        } else {
            scene.remove(camera);
            camera = null;
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 50, -50);
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.perspective = "Perspective";
        }
    };

    this.MercuryRotSpeed = 0.02;
    this.MercuryOrbitSpeed = 0.02;
    this.VenusRotSpeed = 0.015;
    this.VenusOrbitSpeed = 0.015;
    this.EarthRotSpeed = 0.01;
    this.EarthOrbitSpeed = 0.01;
    this.MarsRotSpeed = 0.008;
    this.MarsOrbitSpeed = 0.008;
};
const guiCamera = gui.addFolder('Camera');
guiCamera.add(controls, 'switchCamera').name('Switch Camera Type');
guiCamera.add(controls, 'perspective').listen().name('Current Camera');

const guiMercury = gui.addFolder('Mercury');
guiMercury.add(controls, 'MercuryRotSpeed', 0.0, 0.1, 0.001).name('Rotation Speed');
guiMercury.add(controls, 'MercuryOrbitSpeed', 0.0, 0.1, 0.001).name('Orbit Speed');
const guiVenus = gui.addFolder('Venus');
guiVenus.add(controls, 'VenusRotSpeed', 0.0, 0.1, 0.001).name('Rotation Speed');
guiVenus.add(controls, 'VenusOrbitSpeed', 0.0, 0.1, 0.001).name('Orbit Speed');
const guiEarth = gui.addFolder('Earth');
guiEarth.add(controls, 'EarthRotSpeed', 0.0, 0.1, 0.001).name('Rotation Speed');
guiEarth.add(controls, 'EarthOrbitSpeed', 0.0, 0.1, 0.001).name('Orbit Speed');
const guiMars = gui.addFolder('Mars');
guiMars.add(controls, 'MarsRotSpeed', 0.0, 0.1, 0.001).name('Rotation Speed');
guiMars.add(controls, 'MarsOrbitSpeed', 0.0, 0.1, 0.001).name('Orbit Speed');


render();
function render() {
    orbitControls.update();
    stats.update();

    // render using requestAnimationFrame
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

// listen to the resize events
window.addEventListener('resize', onResize, false);
function onResize() { // resize handler
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// axes helper: x, y, z 축을 보여줌
const axesHelper = new THREE.AxesHelper(10); // 10 unit 길이의 축을 보여줌
scene.add(axesHelper);

// add ambient light
const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// add directional light
const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(5, 12, 8); // 여기서 부터 (0, 0, 0) 방향으로 light ray 방향
dirLight.castShadow = false;
scene.add(dirLight);

//----- Directional light의 target 위치를 바꾸기 ------------
//const light = new THREE.DirectionalLight(0xffffff, 1);
//light.position.set(10, 10, 10); // 광원이 있는 위치
//
// 타겟 객체 생성
//const targetObject = new THREE.Object3D();
//targetObject.position.set(5, 0, 0); // 타겟 위치 지정
//scene.add(targetObject);
//
// 빛의 방향 지정
//light.target = targetObject;
//scene.add(light);


const SunGeometry = new THREE.SphereGeometry(10);
const SunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const SunMesh = new THREE.Mesh(SunGeometry, SunMaterial);
SunMesh.position.set(0, 0, 0);
scene.add(SunMesh);

const MercuryGeometry = new THREE.SphereGeometry(1.5);
const MercuryMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
const MercuryMesh = new THREE.Mesh(MercuryGeometry, MercuryMaterial);
MercuryMesh.position.set(20, 0, 0);
scene.add(MercuryMesh);

const VenusGeometry = new THREE.SphereGeometry(3, 32, 32);
const VenusMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
const VenusMesh = new THREE.Mesh(VenusGeometry, VenusMaterial);
VenusMesh.position.set(35, 0, 0);
scene.add(VenusMesh);
const EarthGeometry = new THREE.SphereGeometry(3.5, 32, 32);
const EarthMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
const EarthMesh = new THREE.Mesh(EarthGeometry, EarthMaterial);
EarthMesh.position.set(50, 0, 0);
scene.add(EarthMesh);
const MarsGeometry = new THREE.SphereGeometry(2.5, 32, 32);
const MarsMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const MarsMesh = new THREE.Mesh(MarsGeometry, MarsMaterial);
MarsMesh.position.set(65, 0, 0);
scene.add(MarsMesh);

let MercuryAngle = 0;
let VenusAngle = 0;
let EarthAngle = 0;
let MarsAngle = 0;

function animate() {

    // stats와 orbitControls는 매 frame마다 update 해줘야 함
    stats.update();
    orbitControls.update();

    // Mercury의 회전과 공전
    MercuryAngle += controls.MercuryOrbitSpeed;
    MercuryMesh.rotation.y += controls.MercuryRotSpeed;
    MercuryMesh.position.x = 20 * Math.cos(MercuryAngle);
    MercuryMesh.position.z = 20 * Math.sin(MercuryAngle);
    // Venus의 회전과 공전
    VenusAngle += controls.VenusOrbitSpeed;
    VenusMesh.rotation.y += controls.VenusRotSpeed;
    VenusMesh.position.x = 35 * Math.cos(VenusAngle);
    VenusMesh.position.z = 35 * Math.sin(VenusAngle);
    // Earth의 회전과 공전
    EarthAngle += controls.EarthOrbitSpeed;
    EarthMesh.rotation.y += controls.EarthRotSpeed;
    EarthMesh.position.x = 50 * Math.cos(EarthAngle);
    EarthMesh.position.z = 50 * Math.sin(EarthAngle);
    // Mars의 회전과 공전
    MarsAngle += controls.MarsOrbitSpeed;
    MarsMesh.rotation.y += controls.MarsRotSpeed;
    MarsMesh.position.x = 65 * Math.cos(MarsAngle);
    MarsMesh.position.z = 65 * Math.sin(MarsAngle);
    // 각각의 구체에 대해 rotation transformation
    // 각각의 구체에 대해 translation transformation


    // 모든 transformation 적용 후, renderer에 렌더링을 한번 해 줘야 함
    renderer.render(scene, camera);

    // 다음 frame을 위해 requestAnimationFrame 호출 
    requestAnimationFrame(animate);
}

animate();






