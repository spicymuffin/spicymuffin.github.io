import { resizeAspectRatio, setupText, updateText } from "../../util/util.js";
import { Shader, readShaderFile } from "../../util/shader.js";

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
let shader; // shader program
let vao; // vertex array object
let textOverlay3; // for text output third line (see util.js)

// rectangle vertices
const vertices = new Float32Array([
  -0.1,
  -0.1,
  0.0, // Bottom left
  0.1,
  -0.1,
  0.0, // Bottom right
  0.1,
  0.1,
  0.0, // Top right
  -0.1,
  0.1,
  0.0, // Top left
]);

let displacement = new Float32Array([0.0, 0.0]);

function initWebGL() {
  if (!gl) {
    console.error("WebGL 2 is not supported by your browser.");
    throw new Error("WebGL 2 is not supported by your browser.");
  }

  canvas.width = 600;
  canvas.height = 600;

  resizeAspectRatio(gl, canvas);

  // Initialize WebGL settings
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  return true;
}

async function initShader() {
  const vertexShaderSource = await readShaderFile("shVert.glsl");
  const fragmentShaderSource = await readShaderFile("shFrag.glsl");
  shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function out_of_bounds(axis, movement) {
  if (movement > 0) {
    if (displacement[axis] + movement >= 0.9) {
      console.log("out of bounds");
      return true;
    }
  } else {
    if (displacement[axis] + movement <= -0.9) {
      console.log("out of bounds");
      return true;
    }
  }
  return false;
}

function setupKeyboardEvents() {
  document.addEventListener("keydown", (event) => {
    if (event.key == "ArrowRight") {
      // move rectangle right
      //   updateText(textOverlay3, "> key pressed");
      if (!out_of_bounds(0, +0.01)) {
        displacement[0] += 0.01;
      }
    } else if (event.key == "ArrowLeft") {
      // move rectangle left
      //   updateText(textOverlay3, "< key pressed");
      if (!out_of_bounds(0, -0.01)) {
        displacement[0] -= 0.01;
      }
    } else if (event.key == "ArrowUp") {
      // move rectangle up
      //   updateText(textOverlay3, "^ key pressed");
      if (!out_of_bounds(1, +0.01)) {
        displacement[1] += 0.01;
      }
    } else if (event.key == "ArrowDown") {
      // move rectangle down
      //   updateText(textOverlay3, ". key pressed");
      if (!out_of_bounds(1, -0.01)) {
        displacement[1] -= 0.01;
      }
    }
  });
}

function setupBuffers() {
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  shader.setAttribPointer("aPos", 3, gl.FLOAT, false, 0, 0);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  // artifact
  let color = [1.0, 0.0, 0.0, 1.0];

  shader.setVec4("uColor", color);
  shader.setVec2("displacement", displacement);

  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

  requestAnimationFrame(() => render());
}

async function main() {
  try {
    // WebGL 초기화
    if (!initWebGL()) {
      throw new Error("WebGL 초기화 실패");
    }

    // 셰이더 초기화
    await initShader();

    // setup text overlay (see util.js)
    setupText(canvas, "Use arrow keys to move the rectangle", 1);
    // textOverlay3 = setupText(canvas, "no key pressed", 3);

    // 키보드 이벤트 설정
    setupKeyboardEvents();

    // 나머지 초기화
    setupBuffers(shader);
    shader.use();

    // 렌더링 시작
    render();

    return true;
  } catch (error) {
    console.error("Failed to initialize program:", error);
    alert("프로그램 초기화에 실패했습니다.");
    return false;
  }
}

// call main function
main()
  .then((success) => {
    if (!success) {
      console.log("프로그램을 종료합니다.");
      return;
    }
  })
  .catch((error) => {
    console.error("프로그램 실행 중 오류 발생:", error);
  });
