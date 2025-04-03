#version 300 es

in vec2 a_position;
uniform mat4 u_transform;

void main() {
    gl_Position = u_transform * vec4(a_position, 0.0, 1.0);
}
