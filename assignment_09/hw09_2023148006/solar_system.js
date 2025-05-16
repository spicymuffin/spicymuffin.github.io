import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

camera.position.set(80, 50, 80);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

// Stats
const stats = new Stats();
document.body.appendChild(stats.dom);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Sun
const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

const sunLight = new THREE.PointLight(0xffffff, 10, 1000); 
sunLight.position.copy(sun.position);
sun.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight); 

const planets = [
  { name: 'Mercury', radius: 1.5, distance: 20, color: '#a6a6a6', texture: 'Mercury.jpg', rotationSpeed: 0.02, orbitSpeed: 0.02 },
  { name: 'Venus', radius: 3, distance: 35, color: '#e39e1c', texture: 'Venus.jpg', rotationSpeed: 0.015, orbitSpeed: 0.015 },
  { name: 'Earth', radius: 3.5, distance: 50, color: '#3498db', texture: 'Earth.jpg', rotationSpeed: 0.01, orbitSpeed: 0.01 },
  { name: 'Mars', radius: 2.5, distance: 65, color: '#c0392b', texture: 'Mars.jpg', rotationSpeed: 0.008, orbitSpeed: 0.008 }
];

const planetMeshes = [];

planets.forEach(p => {
  const group = new THREE.Group(); 
  const texture = textureLoader.load(`textures/${p.texture}`);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.2 });
  const geometry = new THREE.SphereGeometry(p.radius, 32, 32);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = p.distance;
  group.add(mesh);
  scene.add(group);
  p.group = group;
  p.mesh = mesh;
  planetMeshes.push(p);
});

const gui = new GUI();
const cameraFolder = gui.addFolder('Camera');
const cameraType = { mode: 'Perspective' };
cameraFolder.add(cameraType, 'mode', ['Perspective', 'Orthographic']).onChange((value) => {
});
planetMeshes.forEach(p => {
  const folder = gui.addFolder(p.name);
  folder.add(p, 'rotationSpeed', 0, 0.05);
  folder.add(p, 'orbitSpeed', 0, 0.05);
});

window.addEventListener('resize', onResize, false);
function onResize() { // resize handler
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


function animate() {
  requestAnimationFrame(animate);
  planetMeshes.forEach(p => {
    p.mesh.rotation.y += p.rotationSpeed;
    p.group.rotation.y += p.orbitSpeed;
  });
  controls.update();
  stats.update();
  renderer.render(scene, camera);
}
animate();
