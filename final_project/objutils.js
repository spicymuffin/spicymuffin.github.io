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
    const material = new THREE.MeshBasicMaterial({ color: matColor });

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
    const material = new THREE.MeshBasicMaterial({ color: matColor });

    const sphere = new THREE.Mesh(geometry, material);

    const position = options.position || new THREE.Vector3(0, 0, 0);
    sphere.position.set(position.x, position.y, position.z);

    const rotation = options.rotation || new THREE.Vector3(0, 0, 0);
    sphere.rotation.set(rotation.x, rotation.y, rotation.z);

    return sphere;
}
