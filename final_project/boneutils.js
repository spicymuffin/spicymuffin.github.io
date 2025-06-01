import * as THREE from 'three';

import * as objutils from './objutils.js';
import * as colors from './colors.js';

// very hacky way to override the raycast method of a mesh
// i hate javascript
function raycastToBone(raycaster, intersects) {
    const tmp_intersects = [];
    THREE.Mesh.prototype.raycast.call(this, raycaster, tmp_intersects);

    for (let i = 0; i < tmp_intersects.length; i++) {
        intersects.push({
            ...tmp_intersects[i],
            object: this._bone_target,
        });
    }
}

export function addBoneVis(bone, options = {}) {
    const color = options.color || 0xff0000;
    const sphere_radius = options.sphere_radius || 0.05;
    const axis = options.axis || false;
    let length = options.length || null;
    const thickness = options.thickness || 0.02;
    const box_color = options.box_color || color;
    const opacity = options.opacity || 1.0;
    const child = options.child || null;

    const is_transparent = opacity < 1.0;

    // add sphere at bone origin
    const sphere_geo = new THREE.SphereGeometry(sphere_radius, 16, 16);
    const sphere_mat = new THREE.MeshLambertMaterial({
        color: color,
        opacity: opacity,
        transparent: is_transparent,
    });
    const sphere = new THREE.Mesh(sphere_geo, sphere_mat);
    sphere.name = 'bone_sphere';

    // override raycast method to replace the object with the bone
    sphere._bone_target = bone; // store the bone reference for raycasting
    sphere.raycast = raycastToBone;
    bone.add(sphere);

    // add axis helper if requested
    if (axis) {
        const axis_helper = new THREE.AxesHelper(sphere_radius * 2);
        axis_helper.name = 'bone_axis';
        axis_helper.raycast = () => { }; // disable raycasting for the axis helper
        bone.add(axis_helper);
    }

    // add bone-length box if length is specified
    if (length !== null || child !== null) {
        if (child !== null) {
            // if a child bone is specified, the length to the child is used
            length = new THREE.Vector3(0, 0, 0).distanceTo(child.position);
        }
        const box_geo = new THREE.BoxGeometry(thickness, length, thickness);
        const box_mat = new THREE.MeshLambertMaterial({
            color: box_color,
            opacity: opacity,
            transparent: is_transparent,
        });
        const box = new THREE.Mesh(box_geo, box_mat);
        box.name = 'bone_box';

        // translte on Y so the box starts at the origin of the bone and extends along the Y axis
        box_geo.translate(0, length / 2, 0);

        // override raycast method to replace the object with the bone
        box._bone_target = bone; // store the bone reference for raycasting
        box.raycast = raycastToBone;

        bone.add(box);
    }
}