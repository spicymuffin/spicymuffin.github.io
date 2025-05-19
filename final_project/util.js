
export function isChildOf(child, parent) {
    while (child) {
        if (child === parent) return true;
        child = child.parent;
    }
    return false;
}
