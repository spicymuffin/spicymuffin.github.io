#version 300 es
precision mediump float;

out vec4 FragColor;
uniform vec4 uColor;

void main() {
    FragColor = uColor;
}