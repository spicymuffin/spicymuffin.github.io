#version 300 es

layout (location = 0) in vec3 aPos;

uniform vec2 displacement;

void main() {
    gl_Position = vec4(aPos[0] + displacement[0], aPos[1] + displacement[1], aPos[2], 1.0);
}