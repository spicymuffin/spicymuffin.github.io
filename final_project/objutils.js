import * as THREE from 'three';

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

    if (options.name) {
        sphere.name = options.name;
    }

    return sphere;
}

export function createBox(options = {}) {
    // geometry
    const size = options.size || new THREE.Vector3(1, 1, 1);
    const origin_shift = options.origin_shift || new THREE.Vector3(0, 0, 0);
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    geometry.translate(-origin_shift.x, -origin_shift.y, -origin_shift.z);

    // material
    const opacity = options.opacity || 1.0;
    const is_transparent = opacity < 1.0;
    const mat_color = options.color || 0x00ff00;

    const material = new THREE.MeshLambertMaterial({
        color: mat_color,
        transparent: is_transparent,
        opacity: opacity
    });

    // mesh
    const cube = new THREE.Mesh(geometry, material);

    // transforms
    const position = options.position || new THREE.Vector3(0, 0, 0);
    cube.position.set(position.x, position.y, position.z);

    const rotation = options.rotation || new THREE.Quaternion();
    cube.quaternion.copy(rotation);

    if (options.scale) {
        cube.scale.copy(options.scale);
    }

    if (options.name) {
        cube.name = options.name;
    }

    return cube;
}

export function createCone(options = {}) {
    // primitive parameters
    const radius = options.radius ?? 1;
    const height = options.height ?? 2;
    const radial_segments = options.radial_segments ?? options.radial_segments ?? 32;
    const height_segments = options.height_segments ?? 1;
    const open_ended = options.open_ended ?? false;
    const theta_start = options.theta_start ?? 0;
    const theta_length = options.theta_length ?? Math.PI * 2;

    // geometry
    const geometry = new THREE.ConeGeometry(
        radius,
        height,
        radial_segments,
        height_segments,
        open_ended,
        theta_start,
        theta_length
    );

    const has_pointer = options.ptr_position instanceof THREE.Vector3 && options.ptr_direction instanceof THREE.Vector3;

    if (has_pointer) {
        geometry.translate(0, -height / 2, 0);
        const direction = options.ptr_direction.clone().normalize();
        const orient_quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction
        );
        geometry.applyQuaternion(orient_quat);
    } else {
        // legacy: base at origin, tip on +Y
        geometry.translate(0, height / 2, 0);
    }

    // material
    const opacity = options.opacity ?? 1.0;
    const is_transparent = opacity < 1.0;
    const mat_color = options.color ?? 0xff0000;

    const material = options.material || new THREE.MeshStandardMaterial({
        color: mat_color,
        transparent: is_transparent,
        opacity: opacity
    });

    // mesh
    const mesh = new THREE.Mesh(geometry, material);

    // transforms
    if (has_pointer) {
        mesh.position.copy(options.ptr_position);
    } else if (options.position) {
        mesh.position.copy(options.position);
    }

    if (options.rotation) {
        mesh.quaternion.copy(options.rotation);
    }

    if (options.scale) {
        mesh.scale.copy(options.scale);
    }

    if (options.name) {
        mesh.name = options.name;
    }

    return mesh;
}


// just use THREE.AxisHelper btw, dont use this, this sucks
export function createArrows(options = {}) {
    const group = new THREE.Group();

    const origin = options.origin || new THREE.Vector3(0, 0, 0);
    const xvec = options.xvec || new THREE.Vector3(1, 0, 0);
    const yvec = options.yvec || new THREE.Vector3(0, 1, 0);
    const zvec = options.zvec || new THREE.Vector3(0, 0, 1);

    const shaft_radius = options.shaft_radius || 0.02;
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
    const planeGeometry = new THREE.PlaneGeometry(50, 50, 1, 1);
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

export function createCircularGround(radius = 40, segments = 64) {
    // create the circular ground plane
    const circleGeometry = new THREE.CircleGeometry(radius, segments);
    const circleMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.receiveShadow = true;

    // rotate and position the circle to lay flat on XZ plane
    circle.rotation.x = -0.5 * Math.PI;
    circle.position.set(0, 0, 0);

    return circle;
}