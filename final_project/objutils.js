import * as THREE from 'three';

// preferrably pass a THREE.Vector3 for position
// generates a box mesh that is uniformly scaled of size
// options.size.x, options.size.y, options.size.z
// with rotation and position
export function createBox(options = {}) {
    let size = options.size || new THREE.Vector3(1, 1, 1);
    const originShift = options.originShift || new THREE.Vector3(0, 0, 0);

    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);

    // shift the geometry to the center of the box
    geometry.translate(-originShift.x, -originShift.y, -originShift.z);

    // material for the mesh
    const matColor = options.color || 0x00ff00;
    const material = new THREE.MeshLambertMaterial({ color: matColor });

    // generate the object3d (mesh, which is a subclass of object3d)
    const cube = new THREE.Mesh(geometry, material);

    let position = options.position || new THREE.Vector3(0, 0, 0);
    cube.position.set(position.x, position.y, position.z);

    const rotation = options.rotation || new THREE.Quaternion();
    cube.quaternion.copy(rotation);
    return cube;
}

// generates a sphere mesh with a given radius
// options.size = radius (number)
// options.position = THREE.Vector3
// options.rotation = THREE.Vector3 (quaternion)
export function createSphere(options = {}) {
    const radius = options.radius || 1;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    const opacity = options.opacity || 1.0;

    const is_transparent = opacity < 1.0;

    const mat_color = options.color || 0x00ff00;
    const material = new THREE.MeshLambertMaterial({
        color: mat_color,
        transparent: is_transparent,
        opacity: opacity
    });

    const sphere = new THREE.Mesh(geometry, material);

    const position = options.position || new THREE.Vector3(0, 0, 0);
    sphere.position.set(position.x, position.y, position.z);

    const rotation = options.rotation || new THREE.Quaternion();
    sphere.quaternion.copy(rotation);

    return sphere;
}

// just use THREE.AxisHelper btw, dont use this, this sucks
export function createArrows(options = {}) {
    const group = new THREE.Group();

    const origin = options.origin || new THREE.Vector3(0, 0, 0);
    const xvec = options.xVec || new THREE.Vector3(1, 0, 0);
    const yvec = options.yVec || new THREE.Vector3(0, 1, 0);
    const zvec = options.zVec || new THREE.Vector3(0, 0, 1);

    const shaft_radius = options.shaftRadius || 0.02;
    const head_length_ratio = options.head_length_ratio || 0.1;
    const head_width_ratio = options.head_width_ratio || 2;

    function createArrow(dirVec, color) {
        const length = dirVec.length();
        if (length === 0) return null;

        const direction = dirVec.clone().normalize();
        const arrow = new THREE.ArrowHelper(
            direction,
            origin.clone(),
            length,
            color,
            length * head_length_ratio,
            shaft_radius * head_width_ratio
        );

        const shaft_geo = new THREE.CylinderGeometry(shaft_radius, shaft_radius, length - length * head_length_ratio, 8);
        const shaft_mat = new THREE.MeshBasicMaterial({ color });
        const shaft = new THREE.Mesh(shaft_geo, shaft_mat);

        shaft.position.copy(origin.clone().add(dirVec.clone().multiplyScalar(0.5 - head_length_ratio * 0.5)));
        shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

        group.add(arrow);
        group.add(shaft);
        return arrow;
    }

    createArrow(xvec, 0xff0000); // x is red
    createArrow(yvec, 0x00ff00); // y is green
    createArrow(zvec, 0x0000ff); // z is blue

    return group;
}


export function createVector(options = {}) {

    const origin = options.origin || new THREE.Vector3(0, 0, 0);
    const vec = options.vec || new THREE.Vector3(1, 0, 0);
    const color = options.color || 0x00ff00; // green
    const shaft_radius = options.shaft_radius || 0.02;
    const head_length_ratio = options.head_length_ratio || 0.1;
    const head_width_ratio = options.head_width_ratio || 2;

    const length = vec.length();
    if (length === 0) return null;
    const direction = vec.clone().normalize();
    const arrow = new THREE.ArrowHelper(
        direction,
        origin.clone(),
        length,
        color,
        length * head_length_ratio,
        shaft_radius * head_width_ratio
    );
    const shaft_geo = new THREE.CylinderGeometry(shaft_radius, shaft_radius, length - length * head_length_ratio, 8);
    const shaft_mat = new THREE.MeshBasicMaterial({ color });
    const shaft = new THREE.Mesh(shaft_geo, shaft_mat);

    shaft.position.copy(origin.clone().add(vec.clone().multiplyScalar(0.5 - head_length_ratio * 0.5)));
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    const group = new THREE.Group();
    group.add(arrow);
    group.add(shaft);
    return group;
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