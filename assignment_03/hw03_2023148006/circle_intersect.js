/*-------------------------------------------------------------------------
07_LineSegments.js

left mouse button을 click하면 선분을 그리기 시작하고,
button up을 하지 않은 상태로 마우스를 움직이면 임시 선분을 그리고,
button up을 하면 최종 선분을 저장하고 임시 선분을 삭제함.

임시 선분의 color는 회색이고, 최종 선분의 color는 빨간색임.

이 과정을 반복하여 여러 개의 선분 (line segment)을 그릴 수 있음.
---------------------------------------------------------------------------*/
import {
  resizeAspectRatio,
  setupText,
  updateText,
  Axes,
} from "../../util/util.js";
import { Shader, readShaderFile } from "../../util/shader.js";
import { quadeq_solve, quadeq_n_roots } from "./quadeq_solver.js";

// Global variables
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
let isInitialized = false; // main이 실행되는 순간 true로 change
let shader;
let vao;
let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let isDrawing = false; // mouse button을 누르고 있는 동안 true로 change
let drawPhase = 0;
let startPoint = null; // mouse button을 누른 위치
let tempEndPoint = null; // mouse를 움직이는 동안의 위치
let lines = []; // 그려진 선분들을 저장하는 array
let intersect_pos = [];
let textOverlay; // 1st line segment 정보 표시
let textOverlay2; // 2nd line segment 정보 표시
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)
let radius = 0;
let lines_seg = []; // 선분
let circle_center = [];
let xs = []; // 교점 x좌표
let ys = []; // 교점 y좌표

function interval_endpoints_to_parametric(x1, y1, x2, y2) {
  let x_parametric_slope = x2 - x1;
  let x_parametric_offset = x1;
  let y_parametric_slope = y2 - y1;
  let y_parametric_offset = y1;
  return [
    x_parametric_slope,
    x_parametric_offset,
    y_parametric_slope,
    y_parametric_offset,
  ];
}

function get_intersect_quadeq_coefficients(
  x_parametric_slope,
  x_parametric_offset,
  y_parametric_slope,
  y_parametric_offset,
  circle_center_x,
  circle_center_y,
  radius
) {
  let a =
    x_parametric_slope * x_parametric_slope +
    y_parametric_slope * y_parametric_slope;
  let b =
    2 *
    (x_parametric_slope * x_parametric_offset -
      x_parametric_slope * circle_center_x +
      y_parametric_slope * y_parametric_offset -
      y_parametric_slope * circle_center_y);
  let c =
    y_parametric_offset * y_parametric_offset +
    x_parametric_offset * x_parametric_offset +
    circle_center_x * circle_center_x +
    circle_center_y * circle_center_y -
    radius * radius -
    2 *
      (x_parametric_offset * circle_center_x +
        y_parametric_offset * circle_center_y);

  return [a, b, c];
}

// DOMContentLoaded event
// 1) 모든 HTML 문서가 완전히 load되고 parsing된 후 발생
// 2) 모든 resource (images, css, js 등) 가 완전히 load된 후 발생
// 3) 모든 DOM 요소가 생성된 후 발생
// DOM: Document Object Model로 HTML의 tree 구조로 표현되는 object model
// 모든 code를 이 listener 안에 넣는 것은 mouse click event를 원활하게 처리하기 위해서임
// mouse input을 사용할 때 이와 같이 main을 call 한다.

document.addEventListener("DOMContentLoaded", () => {
  if (isInitialized) {
    // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
    console.log("Already initialized");
    return;
  }

  main()
    .then((success) => {
      // call main function
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

  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

  gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
  return [
    (x / canvas.width) * 2 - 1, // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
    -((y / canvas.height) * 2 - 1), // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
  ];
}

/*
    browser window
    +----------------------------------------+
    | toolbar, address bar, etc.             |
    +----------------------------------------+
    | browser viewport (컨텐츠 표시 영역)     |
    | +------------------------------------+ |
    | |                                    | |
    | |    canvas                          | |
    | |    +----------------+              | |
    | |    |                |              | |
    | |    |      *         |              | |
    | |    |                |              | |
    | |    +----------------+              | |
    | |                                    | |
    | +------------------------------------+ |
    +----------------------------------------+

    *: mouse click position

    event.clientX = browser viewport 왼쪽 경계에서 마우스 클릭 위치까지의 거리
    event.clientY = browser viewport 상단 경계에서 마우스 클릭 위치까지의 거리
    rect.left = browser viewport 왼쪽 경계에서 canvas 왼쪽 경계까지의 거리
    rect.top = browser viewport 상단 경계에서 canvas 상단 경계까지의 거리

    x = event.clientX - rect.left  // canvas 내에서의 클릭 x 좌표
    y = event.clientY - rect.top   // canvas 내에서의 클릭 y 좌표
*/

function getLineSegments() {
  let tmplines = [];
  let segments = 300;
  radius = Math.sqrt(
    (tempEndPoint[0] - startPoint[0]) * (tempEndPoint[0] - startPoint[0]) +
      (tempEndPoint[1] - startPoint[1]) * (tempEndPoint[1] - startPoint[1])
  );

  // vertices.push(cx, cy); // 원의 중심
  for (let i = 1; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const angle2 = ((i - 1) / segments) * Math.PI * 2;
    const px = startPoint[0] + radius * Math.cos(angle2);
    const py = startPoint[1] + radius * Math.sin(angle2);
    const x = startPoint[0] + radius * Math.cos(angle);
    const y = startPoint[1] + radius * Math.sin(angle);
    tmplines.push(px, py, x, y);
  }
  return tmplines;
}

function setupMouseEvents() {
  function handleMouseDown(event) {
    event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
    event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

    const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
    const x = event.clientX - rect.left; // canvas 내 x 좌표
    const y = event.clientY - rect.top; // canvas 내 y 좌표

    if (!isDrawing && drawPhase < 2) {
      // 1번 또는 2번 선분을 그리고 있는 도중이 아닌 경우 (즉, mouse down 상태가 아닌 경우)
      // 캔버스 좌표를 WebGL 좌표로 변환하여 선분의 시작점을 설정
      let [glX, glY] = convertToWebGLCoordinates(x, y);
      startPoint = [glX, glY];
      if (drawPhase == 0) {
        circle_center = [glX, glY];
      }
      isDrawing = true; // 이제 mouse button을 놓을 때까지 계속 true로 둠. 즉, mouse down 상태가 됨
    }
  }

  function handleMouseMove(event) {
    if (isDrawing) {
      // 1번 또는 2번 선분을 그리고 있는 도중인 경우
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      let [glX, glY] = convertToWebGLCoordinates(x, y);
      tempEndPoint = [glX, glY]; // 임시 선분의 끝 point
      render();
    }
  }

  function handleMouseUp() {
    if (isDrawing && tempEndPoint) {
      // lines.push([...startPoint, ...tempEndPoint])
      //   : startPoint와 tempEndPoint를 펼쳐서 하나의 array로 합친 후 lines에 추가
      // ex) lines = [] 이고 startPoint = [1, 2], tempEndPoint = [3, 4] 이면,
      //     lines = [[1, 2, 3, 4]] 이 됨
      // ex) lines = [[1, 2, 3, 4]] 이고 startPoint = [5, 6], tempEndPoint = [7, 8] 이면,
      //     lines = [[1, 2, 3, 4], [5, 6, 7, 8]] 이 됨

      if (drawPhase == 1) {
        lines.push([...startPoint, ...tempEndPoint]);
        lines_seg.push([...startPoint, ...tempEndPoint]);

        updateText(
          textOverlay2,
          "Line segment: (" +
            lines_seg[0][0].toFixed(2) +
            ", " +
            lines_seg[0][1].toFixed(2) +
            ") ~ (" +
            lines_seg[0][2].toFixed(2) +
            ", " +
            lines_seg[0][3].toFixed(2) +
            ")"
        );

        // 교점 구하기
        let params = interval_endpoints_to_parametric(
          lines_seg[0][0],
          lines_seg[0][1],
          lines_seg[0][2],
          lines_seg[0][3]
        );

        let coeff = get_intersect_quadeq_coefficients(
          ...params,
          circle_center[0],
          circle_center[1],
          radius
        );

        xs = quadeq_solve(...coeff);

        for (let i = 0; i < xs.length; i++) {
          if (0 <= xs[i] && xs[i] <= 1) {
            let xpos =
              lines_seg[0][0] + xs[i] * (lines_seg[0][2] - lines_seg[0][0]);
            let ypos =
              lines_seg[0][1] + xs[i] * (lines_seg[0][3] - lines_seg[0][1]);
            intersect_pos.push([xpos, ypos]);
            console.log(xs[i], xpos.toFixed(2), ypos.toFixed(2));
          }
        }

        // console.log(intersection_num);

        if (intersect_pos.length == 2) {
          // ys[0] = (lines_seg[0][1] * (1 - xs[0]) + lines_seg[0][3] * xs[0]).toFixed(2); //y좌표 계산
          //ys[1] = (lines_seg[0][1] * (1 - xs[1]) + lines_seg[0][3] * xs[1]).toFixed(2);

          setupText(
            canvas,
            "Intersection Points: 2 Point 1: (" +
              intersect_pos[0][0].toFixed(2) +
              ", " +
              intersect_pos[0][1].toFixed(2) +
              ") Point 2: (" +
              intersect_pos[1][0].toFixed(2) +
              ", " +
              intersect_pos[0][1].toFixed(2) +
              ")",
            3
          );
          //render();
        } else if (intersect_pos.length == 1) {
          //ys[0] = (lines_seg[0][1] * (1 - xs[0]) + lines_seg[0][3] * xs[0]).toFixed(2);

          setupText(
            canvas,
            "Intersection Points: 1 Point 1: (" +
              intersect_pos[0][0].toFixed(2) +
              ", " +
              intersect_pos[0][1].toFixed(2) +
              ")",
            3
          );
          //render();
        } else {
          setupText(canvas, "No intersection", 3);
        }
      } else {
        let circleLines = getLineSegments();
        lines.push(circleLines);

        updateText(
          textOverlay,
          "Circle: center (" +
            circle_center[0].toFixed(2) +
            ", " +
            circle_center[1].toFixed(2) +
            ") radius = " +
            radius.toFixed(2)
        );
        //  updateText(textOverlay2, "Click and drag to draw the second line segment");
      }

      isDrawing = false;
      startPoint = null;
      tempEndPoint = null;
      drawPhase++;
      render();
    }
  }

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  shader.use();

  // 저장된 선들 그리기
  let num = 0;
  for (let line of lines) {
    let sz = 0;
    if (num == 0) {
      shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);
      sz = 300;
    }
    if (num == 1) {
      shader.setVec4("u_color", [1.0, 1.0, 1.0, 1.0]);
      sz = 1;
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.LINES, 0, sz * 2);
    num++;
  }

  // 임시 선 그리기
  if (isDrawing && startPoint && tempEndPoint) {
    shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색

    if (drawPhase == 0) {
      let circleLines = getLineSegments();
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(circleLines),
        gl.STATIC_DRAW
      );
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.LINES, 0, 600);
    } else if (drawPhase == 1) {
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([...startPoint, ...tempEndPoint]),
        gl.STATIC_DRAW
      );
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.LINES, 0, 2);
    }
  }

  // 교점 점 찍기
  if (intersect_pos.length == 2) {
    console.log("in");
    shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);
    let intersectionVertices = [...intersect_pos[0], ...intersect_pos[1]];
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(intersectionVertices),
      gl.STATIC_DRAW
    );
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, 2);
  } else if (intersect_pos.length == 1) {
    shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);
    let intersectionVertices = [...intersect_pos[0]];
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(intersectionVertices),
      gl.STATIC_DRAW
    );
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, 1);
  }

  // axes 그리기
  axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
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
      return false;
    }

    // 셰이더 초기화
    await initShader();

    // 나머지 초기화
    setupBuffers();
    shader.use();

    // 텍스트 초기화
    textOverlay = setupText(canvas, "", 1);
    textOverlay2 = setupText(canvas, "", 2);

    // 마우스 이벤트 설정
    setupMouseEvents();

    // 초기 렌더링
    render();

    return true;
  } catch (error) {
    console.error("Failed to initialize program:", error);
    alert("프로그램 초기화에 실패했습니다.");
    return false;
  }
}
