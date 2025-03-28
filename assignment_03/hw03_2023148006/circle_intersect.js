import {
  resizeAspectRatio,
  setupText,
  updateText,
  Axes,
} from "../../util/util.js";
import { Shader, readShaderFile } from "../../util/shader.js";
import { quadeq_solve, quadeq_n_roots } from "./quadeq_solver.js";

// global variables
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
let isInitialized = false;
let shader;
let vao;

let vbo_positions;

let draw_phase = 0;
let is_drawing = false;

let startpoint = null;
let endpoint = null;

let circle_info_txt_overlay;
let line_segment_info_txt_overlay;

let axes = new Axes(gl, 0.85);

const circle_nvert = 8;

const nverts = circle_nvert + 2;
const nfloats = nverts * 2;
let positions = new Float32Array(nfloats);

const circle_offset_floats = 0;
const line_offset_floats = circle_nvert * 2;

const circle_offset_vertices = 0;
const line_offset_vertices = circle_nvert;

function write_circle_data(buf, start_idx, nverts, x, y, radius) {
  for (let i = 0; i < nverts; i++) {
    const angle = (i / nverts) * Math.PI * 2;
    buf[start_idx + i * 2] = x + Math.cos(angle) * radius;
    buf[start_idx + i * 2 + 1] = y + Math.sin(angle) * radius;
  }
}

function write_line_data(buf, start_idx, x1, y1, x2, y2) {
  buf[start_idx + 0] = x1;
  buf[start_idx + 1] = y1;
  buf[start_idx + 2] = x2;
  buf[start_idx + 3] = y2;
}

function get_distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

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
  gl.clearColor(0.1, 0.2, 0.3, 1.0);

  return true;
}

function setupBuffers() {
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  vbo_positions = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

  shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
}

function convert_to_webGL_coords(x, y) {
  return [(x / canvas.width) * 2 - 1, -((y / canvas.height) * 2 - 1)];
}

function setupMouseEvents() {
  function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!is_drawing && draw_phase < 2) {
      startpoint = convert_to_webGL_coords(x, y);
      is_drawing = true;
    }
  }

  function handleMouseMove(event) {
    if (is_drawing) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      endpoint = convert_to_webGL_coords(x, y);
      render();
    }
  }

  function handleMouseUp() {
    if (is_drawing) {
      if (draw_phase === 0) {
        const r = get_distance(
          startpoint[0],
          startpoint[1],
          endpoint[0],
          endpoint[1]
        );
        write_circle_data(
          positions,
          circle_offset_floats,
          circle_nvert,
          startpoint[0],
          startpoint[1],
          r
        );
      } else if (draw_phase === 1) {
        write_line_data(
          positions,
          line_offset_floats,
          startpoint[0],
          startpoint[1],
          endpoint[0],
          endpoint[1]
        );

        updateText(
          circle_info_txt_overlay,
          "Circle: center (" +
            startpoint[0].toFixed(2) +
            ", " +
            startpoint[1].toFixed(2) +
            ") radius = " +
            get_distance(
              startpoint[0],
              startpoint[1],
              endpoint[0],
              endpoint[1]
            ).toFixed(2)
        );
      }

      is_drawing = false;
      startpoint = null;
      endpoint = null;
      draw_phase++;

      render();
    }
  }

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindVertexArray(vao);

  shader.use();

  if (draw_phase === 0) {
    if (is_drawing && endpoint != null) {
      const r = get_distance(
        startpoint[0],
        startpoint[1],
        endpoint[0],
        endpoint[1]
      );
      write_circle_data(
        positions,
        circle_offset_floats,
        circle_nvert,
        startpoint[0],
        startpoint[1],
        r
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]);
      gl.drawArrays(gl.LINE_LOOP, circle_offset_vertices, circle_nvert);
    }
  } else if (draw_phase === 1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
    shader.setVec4("u_color", [0.5, 0.0, 0.5, 1.0]);
    gl.drawArrays(gl.LINE_LOOP, circle_offset_vertices, circle_nvert);

    if (is_drawing && endpoint) {
      write_line_data(
        positions,
        line_offset_floats,
        startpoint[0],
        startpoint[1],
        endpoint[0],
        endpoint[1]
      );

      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]);
      gl.drawArrays(gl.LINES, line_offset_vertices, 2);
    }
  } else if (draw_phase === 2) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
    shader.setVec4("u_color", [0.5, 0.0, 0.5, 1.0]);
    gl.drawArrays(gl.LINE_LOOP, circle_offset_vertices, circle_nvert);

    shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);
    gl.drawArrays(gl.LINES, line_offset_vertices, 2);

    // draw intersection points, etc...

    draw_phase++;
  }

  // unbind
  gl.bindVertexArray(null);

  // draw axes last
  axes.draw(mat4.create(), mat4.create());
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

    await initShader();
    shader.use();

    setupBuffers();

    // text overlays
    circle_info_txt_overlay = setupText(canvas, "No line segment", 1);
    line_segment_info_txt_overlay = setupText(
      canvas,
      "Click mouse button and drag to draw line segments",
      2
    );

    // mouse events
    setupMouseEvents();

    // initial render
    render();

    return true;
  } catch (error) {
    console.error("Failed to initialize program:", error);
    alert("프로그램 초기화에 실패했습니다.");
    return false;
  }
}
