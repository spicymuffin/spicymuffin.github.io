#version 300 es

precision highp float;

in vec3 lightingColor;
out vec4 FragColor;

void main() {
    FragColor = vec4(lightingColor, 1.0);
}