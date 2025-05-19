import * as THREE from 'three';

// preferrably pass a THREE.Vector3 for position
// generates a box mesh that is uniformly scaled of size
// options.size.x, options.size.y, options.size.z
// with rotation and position
export function createBox(options = {}) {
    let size = options.size || new THREE.Vector3(1, 1, 1);
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);

    // material for the mesh
    const matColor = options.color || 0x00ff00;
    const material = new THREE.MeshLambertMaterial({ color: matColor });

    // generate the object3d (mesh, which is a subclass of object3d)
    const cube = new THREE.Mesh(geometry, material);

    let position = options.position || new THREE.Vector3(0, 0, 0);
    cube.position.set(position.x, position.y, position.z);

    let rotation = options.rotation || new THREE.Vector3(0, 0, 0);
    cube.rotation.set(rotation.x, rotation.y, rotation.z);
    return cube;
}

// generates a sphere mesh with a given radius
// options.size = radius (number)
// options.position = THREE.Vector3
// options.rotation = THREE.Vector3 (in radians; why would you want to rotate a sphere?)
export function createSphere(options = {}) {
    const radius = options.size || 1;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    const matColor = options.color || 0x00ff00;
    const material = new THREE.MeshLambertMaterial({ color: matColor });

    const sphere = new THREE.Mesh(geometry, material);

    const position = options.position || new THREE.Vector3(0, 0, 0);
    sphere.position.set(position.x, position.y, position.z);

    const rotation = options.rotation || new THREE.Vector3(0, 0, 0);
    sphere.rotation.set(rotation.x, rotation.y, rotation.z);

    return sphere;
}

export function createDefaultCubeAndSphere() {

    // create a cube
    const cubeGeometry = new THREE.BoxGeometry(4, 4, 4);
    const cubeMaterial = new THREE.MeshLambertMaterial({
        color: 0xff0000
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.castShadow = true;

    // position the cube
    cube.position.x = -4;
    cube.position.y = 3;
    cube.position.z = 0;

    const sphereGeometry = new THREE.SphereGeometry(4, 20, 20);
    const sphereMaterial = new THREE.MeshLambertMaterial({
        color: 0x7777ff
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    // position the sphere
    sphere.position.x = 20;
    sphere.position.y = 0;
    sphere.position.z = 2;
    sphere.castShadow = true;

    return {
        cube: cube,
        sphere: sphere
    };
}

export function createGroundPlane() {
    // create the ground plane
    const planeGeometry = new THREE.PlaneGeometry(50, 50, 120, 120);
    const planeMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.receiveShadow = true;

    // rotate and position the plane
    plane.rotation.x = -0.5 * Math.PI;
    plane.position.x = 0;
    plane.position.y = 0;
    plane.position.z = 0;

    return plane;
}

export function createLargeGroundPlane(useTexture) {

    const withTexture = (useTexture !== undefined) ? useTexture : false;

    // create the ground plane
    const planeGeometry = new THREE.PlaneGeometry(10000, 10000);
    const planeMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff
    });
    if (withTexture) {
        const textureLoader = new THREE.TextureLoader();
        planeMaterial.map = textureLoader.load("./assets/textures/floor-wood.jpg");
        planeMaterial.map.wrapS = THREE.RepeatWrapping;
        planeMaterial.map.wrapT = THREE.RepeatWrapping;
        planeMaterial.map.repeat.set(80, 80)
    }
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.receiveShadow = true;

    // rotate and position the plane
    plane.rotation.x = -0.5 * Math.PI;
    plane.position.x = 0;
    plane.position.y = 0;
    plane.position.z = 0;

    return plane;
}
