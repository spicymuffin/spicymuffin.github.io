import * as THREE from 'three';

import * as objutils from './objutils.js';

function createBoneViz(length = 5, radius = 0.1, color = 0x00ff00) {
    const container = new THREE.Object3D();

    // Box: visualize bone segment
    const geometry = new THREE.BoxGeometry(radius * 2, length, radius * 2);
    geometry.translate(0, length / 2, 0); // so the base is at origin
    const material = new THREE.MeshBasicMaterial({ color });
    const box = new THREE.Mesh(geometry, material);

    // Line: visualize direction
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, length, 0),
    ]);
    const line = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({ color: 0x0000ff })
    );

    container.add(box);
    container.add(line);

    return container;
}