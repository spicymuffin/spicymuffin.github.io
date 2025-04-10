/*-------------------------------------------------------------------------
10_CameraCircle.js

- Viewing a 3D unit squarePyramid at origin with perspective projection
- The squarePyramid is rotating about the x-axis with given constant speed
- A camera is rotating around the origin through the circle of radius 5
- The height (y position) of the camera is +2.
- The camera is always looking at the origin.
---------------------------------------------------------------------------*/

import {
  resizeAspectRatio,
  setupText,
  updateText,
  Axes,
} from "../../util/util.js";
import { Shader, readShaderFile } from "../../util/shader.js";
import { squarePyramid } from "./squarePyramid.js";
// import { Pyramid } from "squarePyramid.js";

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
let shader;
let startTime;
let lastFrameTime;

let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create();
const cameraCircleRadius = 3.0;
const cameraCircleHeight = 10.0;
const cameraCircleSpeed = 90.0;
const square_pyramid = new squarePyramid(gl);
const axes = new Axes(gl, 1.8);

document.addEventListener("DOMContentLoaded", () => {
  if (isInitialized) {
    console.log("Already initialized");
    return;
  }

  main()
    .then((success) => {
      if (!success) {
        console.log("program terminated");
        return;
      }
      isInitialized = true;
    })
    .catch((error) => {
      console.error("program terminated with error:", error);
    });
});

function initWebGL() {
  if (!gl) {
    console.error("WebGL 2 is not supported by your browser.");
    return false;
  }

  canvas.width = 700;
  canvas.height = 700;
  resizeAspectRatio(gl, canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.2, 0.3, 0.4, 1.0);

  return true;
}

async function initShader() {
  const vertexShaderSource = await readShaderFile("shVert.glsl");
  const fragmentShaderSource = await readShaderFile("shFrag.glsl");
  shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
  const currentTime = Date.now();
  // deltaTime: elapsed time from the last frame
  const deltaTime = (currentTime - lastFrameTime) / 1000.0; // convert to second
  // elapsed time from the start time
  const elapsedTime = (currentTime - startTime) / 1000.0; // convert to second
  lastFrameTime = currentTime;

  // Clear canvas
  gl.clearColor(0.2, 0.3, 0.4, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  // Viewing transformation matrix
  let camX =
    cameraCircleRadius *
    Math.sin(glMatrix.toRadian(cameraCircleSpeed * elapsedTime));
  let camZ =
    cameraCircleRadius *
    Math.cos(glMatrix.toRadian(cameraCircleSpeed * elapsedTime))
  let camY = cameraCircleHeight * 0.5 * (Math.sin(glMatrix.toRadian(cameraCircleSpeed * 0.5 * elapsedTime)) + 1);
  mat4.lookAt(
    viewMatrix,
    vec3.fromValues(camX, camY, camZ), // camera position
    vec3.fromValues(0, 0, 0), // look at origin
    vec3.fromValues(0, 1, 0)
  ); // up vector

  // drawing the squarePyramid
  shader.use(); // using the squarePyramid's shader
  shader.setMat4("u_model", modelMatrix);
  shader.setMat4("u_view", viewMatrix);
  shader.setMat4("u_projection", projMatrix);
  square_pyramid.draw(shader);

  // drawing the axes (using the axes's shader)
  axes.draw(viewMatrix, projMatrix);

  requestAnimationFrame(render);
}

async function main() {
  try {
    if (!initWebGL()) {
      throw new Error("WebGL initialization failed");
    }

    await initShader();

    // Projection transformation matrix
    mat4.perspective(
      projMatrix,
      glMatrix.toRadian(60), // field of view (fov, degree)
      canvas.width / canvas.height, // aspect ratio
      0.1, // near
      100.0 // far
    );

    // starting time (global variable) for animation
    startTime = lastFrameTime = Date.now();

    // call the render function the first time for animation
    requestAnimationFrame(render);

    return true;
  } catch (error) {
    console.error("Failed to initialize program:", error);
    alert("Failed to initialize program");
    return false;
  }
}
