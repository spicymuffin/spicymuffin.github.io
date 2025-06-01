import * as THREE from 'three';

export function signedAngleBetween(a, b, normal) {
    const angle = a.angleTo(b);
    const cross = new THREE.Vector3().crossVectors(a, b);
    return normal.dot(cross) > 0 ? angle : -angle;
}

export function translateQuaternion(ancestor, descendant) {
    let translated_quaternion = new THREE.Quaternion()

    const q_world_ancestor = new THREE.Quaternion();
    ancestor.getWorldQuaternion(q_world_ancestor);
    const q_world_descendant = new THREE.Quaternion();
    descendant.getWorldQuaternion(q_world_descendant);

    const q_world_ancestor_inverse = q_world_ancestor.clone().invert();
    translated_quaternion.multiplyQuaternions(q_world_ancestor_inverse, q_world_descendant);

    return translated_quaternion;
}

export function translateVector(v, ancestor, descendant) {
    let translted_vector = new THREE.Vector3()
    const m_local_to_world = descendant.matrixWorld;
    const m_world_to_parent = ancestor.matrixWorld.clone().invert();

    const m_local_to_parent = new THREE.Matrix4();
    m_local_to_parent.multiplyMatrices(m_world_to_parent, m_local_to_world);
    translted_vector.copy(v).transformDirection(m_local_to_parent);
    return translted_vector;
}

export function basisToQuaternion(x, y, z) {
    let targetQuaternion = new THREE.Quaternion()
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(x, y, z);
    targetQuaternion.setFromRotationMatrix(matrix);
    return targetQuaternion;
}

export function getAlignmentQuaternion(q_from, q_to) {
    let q = new THREE.Quaternion()
    const q_inverse = q_from.clone().invert();
    q.multiplyQuaternions(q_to, q_inverse);
    return q;
}