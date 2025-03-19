import { Shader } from './shader.js';

// Add resize handler (keeping the aspect ratio)
export function resizeAspectRatio(gl, canvas) {
    window.addEventListener('resize', () => {
        // Calculate new canvas dimensions while maintaining aspect ratio
        const originalWidth = canvas.width;
        const originalHeight = canvas.height;
        const aspectRatio = originalWidth / originalHeight;
        let newWidth = window.innerWidth;
        let newHeight = window.innerHeight;

        if (newWidth / newHeight > aspectRatio) {
            newWidth = newHeight * aspectRatio;
        } else {
            newHeight = newWidth / aspectRatio;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    });
}

export function setupText(canvas, initialText, line = 1) {

    // 기존 텍스트 오버레이가 있다면 제거
    if (line == 1) {
        const existingOverlay = document.getElementById('textOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }

    // 새로운 텍스트 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'textOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = canvas.offsetLeft + 10 + 'px';
    overlay.style.top = canvas.offsetTop + (20 * (line - 1) + 10) + 'px';
    overlay.style.color = 'white';
    overlay.style.fontFamily = 'monospace';
    overlay.style.fontSize = '14px';
    overlay.style.zIndex = '100';
    overlay.textContent = `${initialText}`;

    // 캔버스의 부모 요소에 오버레이 추가
    canvas.parentElement.appendChild(overlay);
    return overlay;
}

export function updateText(overlay, text) {
    if (overlay) {
        overlay.textContent = `${text}`;
    }
}

export class Axes {
    constructor(gl, length = 1.5) {
        this.gl = gl;
        this.length = length;
        
        // VAO 생성
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        // 버텍스 데이터
        this.vertices = new Float32Array([
            -length, 0.0, 0.0,  length, 0.0, 0.0,  // x축
            0.0, -length, 0.0,  0.0, length, 0.0,  // y축
            0.0, 0.0, -length,  0.0, 0.0, length   // z축
        ]);

        // 색상 데이터
        this.colors = new Float32Array([
            1.0, 0.3, 0.0, 1.0,  1.0, 0.3, 0.0, 1.0,  // x축 색상 (빨간색)
            0.0, 1.0, 0.5, 1.0,  0.0, 1.0, 0.5, 1.0,  // y축 색상 (초록색)
            0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0   // z축 색상 (파란색)
        ]);

        // 버텍스 버퍼 생성 및 데이터 전달
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // 색상 버퍼 생성 및 데이터 전달
        const colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        gl.bindVertexArray(null);

        // 셰이더 생성
        const vertexSource = `#version 300 es
        layout(location = 0) in vec3 a_position;
        layout(location = 1) in vec4 a_color;
        out vec4 v_color;
        uniform mat4 u_model;
        uniform mat4 u_view;
        uniform mat4 u_projection;
        void main() {
            gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
            v_color = a_color;
        }`;

        const fragmentSource = `#version 300 es
        precision highp float;
        in vec4 v_color;
        out vec4 fragColor;
        void main() {
            fragColor = v_color;
        }`;

        this.shader = new Shader(gl, vertexSource, fragmentSource);
    }

    draw(viewMatrix, projMatrix) {
        const gl = this.gl;
        
        this.shader.use();
        
        // 단위 행렬을 모델 행렬로 사용 (변환 없음)
        const modelMatrix = mat4.create();
        this.shader.setMat4('u_model', modelMatrix);
        this.shader.setMat4('u_view', viewMatrix);
        this.shader.setMat4('u_projection', projMatrix);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.LINES, 0, 6);
        gl.bindVertexArray(null);
    }

    delete() {
        // 리소스 정리
        this.gl.deleteVertexArray(this.vao);
        this.shader.delete();
    }
}
