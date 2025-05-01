


export function vectadd(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vectsub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function normalize(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (length === 0) {
        return [0, 0, 0];
    }
    return [v[0] / length, v[1] / length, v[2] / length];
}

export function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

export function find_normal(a, b, c) {
    const ab = vectsub(b, a);
    const ac = vectsub(c, a);
    return normalize(cross(ab, ac));
}