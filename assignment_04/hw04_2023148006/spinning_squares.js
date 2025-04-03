/*-------------------------------------------------------------------------
08_Transformation.js

canvas의 중심에 한 edge의 길이가 0.3인 정사각형을 그리고,
이를 크기 변환 (scaling), 회전 (rotation), 이동 (translation) 하는 예제임.
    T는 x, y 방향 모두 +0.5 만큼 translation
    R은 원점을 중심으로 2초당 1회전의 속도로 rotate
    S는 x, y 방향 모두 0.3배로 scale
이라 할 때,
    keyboard 1은 TRS 순서로 적용
    keyboard 2는 TSR 순서로 적용
    keyboard 3은 RTS 순서로 적용
    keyboard 4는 RST 순서로 적용
    keyboard 5는 STR 순서로 적용
    keyboard 6은 SRT 순서로 적용
    keyboard 7은 원래 위치로 돌아옴
---------------------------------------------------------------------------*/
import { resizeAspectRatio, Axes } from "../../util/util.js";
import { Shader, readShaderFile } from "../../util/shader.js";

let isInitialized = false;
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
let shader;
let vao;
let axes;
let finalTransform;
let rotationAngle = 0;
let currentTransformType = null;
let isAnimating = false;
let lastTime = 0;

// rotation angles
let sun_rot = 0;
let earth_rot = 0;
let moon_rot = 0;

let earth_rev = 0;
let moon_rev = 0;

let sun_transform;
let earth_transform;
let moon_transform;

const earth_rev_radius = 0.7;
const moon_rev_radius = 0.2;

// spec says sun red earth cyan moon yellow
const sun_color = [1.0, 0.0, 0.0, 1.0]; // red
const earth_color = [0.0, 1.0, 1.0, 1.0]; // cyan
const moon_color = [1.0, 1.0, 0.0, 1.0]; // yellow

const sun_scale = [0.2, 0.2, 1.0];
const earth_scale = [0.1, 0.1, 1.0];
const moon_scale = [0.05, 0.05, 1.0];

document.addEventListener("DOMContentLoaded", () => {
  if (isInitialized) {
    console.log("Already initialized");
    return;
  }

  main()
    .then((success) => {
      if (!success) {
        console.log("프로그램을 종료합니다.");
        return;
      }
      isInitialized = true;
      requestAnimationFrame(animate);
    })
    .catch((error) => {
      console.error("프로그램 실행 중 오류 발생:", error);
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

function setupBuffers() {
  const cubeVertices = new Float32Array([
    -0.5,
    0.5, // 좌상단
    -0.5,
    -0.5, // 좌하단
    0.5,
    -0.5, // 우하단
    0.5,
    0.5, // 우상단
  ]);

  const indices = new Uint16Array([
    0,
    1,
    2, // 첫 번째 삼각형
    0,
    2,
    3, // 두 번째 삼각형
  ]);


  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // VBO for position
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
  shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

  // EBO
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
}

function applyTransform(type) {
  sun_transform = mat4.create();
  earth_transform = mat4.create();
  moon_transform = mat4.create();

  // sun rotate
  mat4.rotate(sun_transform, sun_transform, sun_rot, [0, 0, 1]);
  // sun scale
  mat4.scale(sun_transform, sun_transform, sun_scale);

  // earth revelove
  mat4.rotate(earth_transform, earth_transform, earth_rev, [0, 0, 1]);
  // earth transpose
  mat4.translate(earth_transform, earth_transform, [earth_rev_radius, 0, 0]);
  // earth rotate
  mat4.rotate(earth_transform, earth_transform, earth_rot, [0, 0, 1]);
  // earth scale
  mat4.scale(earth_transform, earth_transform, earth_scale);

  // moon revolve (relative to sun)
  mat4.rotate(moon_transform, moon_transform, earth_rev, [0, 0, 1]);
  // moon transpose (relative to sun)
  mat4.translate(moon_transform, moon_transform, [earth_rev_radius, 0, 0]);
  // moon revolve (relative to earth)
  mat4.rotate(moon_transform, moon_transform, moon_rev, [0, 0, 1]);
  // moon transpose (relative to earth)
  mat4.translate(moon_transform, moon_transform, [moon_rev_radius, 0, 0]);
  // moon rotate
  mat4.rotate(moon_transform, moon_transform, moon_rot, [0, 0, 1]);
  // moon scale
  mat4.scale(moon_transform, moon_transform, moon_scale);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  // draw axes
  axes.draw(mat4.create(), mat4.create());

  // draw cube
  shader.use();

  gl.bindVertexArray(vao);

  shader.setMat4("u_transform", sun_transform);
  shader.setVec4("u_color", sun_color);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  shader.setMat4("u_transform", earth_transform);
  shader.setVec4("u_color", earth_color);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  shader.setMat4("u_transform", moon_transform);
  shader.setVec4("u_color", moon_color);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  // shader.setMat4("u_transform", mat4.create()); // reset transform
}

function animate(currentTime) {
  if (!lastTime) lastTime = currentTime; // if lastTime == 0
  // deltaTime: 이전 frame에서부터의 elapsed time (in seconds)
  let deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // change to 10 if you want to have fun
  deltaTime *= 1;

  sun_rot += (Math.PI / 4) * deltaTime; // 1초당 45도 자전

  earth_rot += Math.PI * deltaTime; // 1초당 180도 자전
  earth_rev += (Math.PI / 6) * deltaTime; // 1초당 30도 공전

  moon_rot += Math.PI * deltaTime; // 1초당 180도 자전
  moon_rev += (Math.PI * 2) * deltaTime; // 1초당 360도 공전
  applyTransform(currentTransformType);

  render();

  requestAnimationFrame(animate);
}

async function initShader() {
  const vertexShaderSource = await readShaderFile("shVert.glsl");
  const fragmentShaderSource = await readShaderFile("shFrag.glsl");
  shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
  try {
    if (!initWebGL()) {
      throw new Error("WebGL 초기화 실패");
    }

    // finalTransform = mat4.create();

    sun_transform = mat4.create();
    earth_transform = mat4.create();
    moon_transform = mat4.create();

    await initShader();

    setupBuffers();
    axes = new Axes(gl, 0.8);

    return true;
  } catch (error) {
    console.error("Failed to initialize program:", error);
    alert("프로그램 초기화에 실패했습니다.");
    return false;
  }
}
