export class Cylinder {
    /**
     * @param {WebGLRenderingContext} gl         - WebGL 렌더링 컨텍스트
     * @param {number} segments                 - 옆면 세그먼트 수 (원 둘레를 몇 등분할지)
     * @param {object} options
     *        options.color : [r, g, b, a] 형태의 색상 (기본 [0.8, 0.8, 0.8, 1.0])
     */
    constructor(gl, segments = 32, options = {}) {
        this.gl = gl;

        // VAO, VBO, EBO 생성
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        // 파라미터 설정
        const radius = 0.5;     // 원기둥 반지름
        const halfH = 0.5;      // 높이의 절반 (y=-0.5 ~ y=0.5)
        this.segments = segments;

        // 세그먼트별 각도 간격
        const angleStep = (2 * Math.PI) / segments;

        // 정점/법선/색상/텍스처좌표/인덱스 데이터를 담을 임시 배열
        const positions = [];
        const normals   = [];
        const colors    = [];
        const texCoords = [];
        const indices   = [];

        // 옵션에서 color가 있으면 사용, 없으면 기본값 사용
        const defaultColor = [0.8, 0.8, 0.8, 1.0];
        const colorOption = options.color || defaultColor;

        // 각 세그먼트별로 사각형(face)을 만든다.
        // 사각형 정점 순서(외부에서 본 CCW): top0 -> top1 -> bot1 -> bot0
        //  - top0: angle0, y= +0.5
        //  - top1: angle1, y= +0.5
        //  - bot1: angle1, y= -0.5
        //  - bot0: angle0, y= -0.5
        //
        // 인덱스는 (0,1,2), (2,3,0)로 두 삼각형을 구성.
        // 이 순서가 외부에서 볼 때 CCW가 되도록 정렬합니다.
        for (let i = 0; i < segments; i++) {
            const angle0 = i * angleStep;
            const angle1 = (i + 1) * angleStep;

            // 현재 세그먼트의 상단 (y=+0.5)
            const x0_top = radius * Math.cos(angle0);
            const z0_top = radius * Math.sin(angle0);
            const x1_top = radius * Math.cos(angle1);
            const z1_top = radius * Math.sin(angle1);

            // 현재 세그먼트의 하단 (y=-0.5)
            // (원기둥이므로 x,z는 동일, y만 -0.5)
            const x0_bot = x0_top;
            const z0_bot = z0_top;
            const x1_bot = x1_top;
            const z1_bot = z1_top;

            // 각 face의 4개 정점 (CCW)
            positions.push(
                // top0
                x0_top,  halfH, z0_top,
                // top1
                x1_top,  halfH, z1_top,
                // bot1
                x1_bot, -halfH, z1_bot,
                // bot0
                x0_bot, -halfH, z0_bot
            );

            // flat shading: 한 face(사각형)마다 동일한 법선.
            // face의 중앙 각도(midAngle) 기준으로 바깥쪽을 가리키는 (cos, 0, sin)
            const midAngle = angle0 + angleStep * 0.5;
            const nx = Math.cos(midAngle);
            const ny = 0.0;
            const nz = Math.sin(midAngle);

            // 이 사각형의 4개 정점에 동일한 법선 지정
            for (let k = 0; k < 4; k++) {
                normals.push(nx, ny, nz);
            }

            // 색상도 마찬가지로 4정점 동일
            for (let k = 0; k < 4; k++) {
                colors.push(
                    colorOption[0],
                    colorOption[1],
                    colorOption[2],
                    colorOption[3]
                );
            }

            // 텍스처 좌표 (단순 cylindrical mapping)
            // u: [0..1], v: y=+0.5 -> 1, y=-0.5 -> 0
            const u0 = i / segments;       // angle0 비율
            const u1 = (i + 1) / segments; // angle1 비율
            texCoords.push(
                // top0
                u0, 1,
                // top1
                u1, 1,
                // bot1
                u1, 0,
                // bot0
                u0, 0
            );

            // 인덱스 (두 삼각형)
            // 이번 face가 i번째면, 정점 baseIndex = i*4
            const base = i * 4;
            indices.push(
                base, base + 1, base + 2,
                base + 2, base + 3, base
            );
        }

        // Float32Array/Uint16Array에 담기
        this.vertices = new Float32Array(positions);
        this.normals  = new Float32Array(normals);
        this.colors   = new Float32Array(colors);
        this.texCoords= new Float32Array(texCoords);
        this.indices  = new Uint16Array(indices);

        // backup normals (for flat/smooth shading)
        this.faceNormals = new Float32Array(this.normals);
        this.vertexNormals = new Float32Array(this.normals);
        this.computeVertexNormals();

        // WebGL 버퍼 초기화
        this.initBuffers();
    }

    /**
     * Smooth Shading을 위해,
     * 각 정점별로 "y축에 수직인 방향 (x, 0, z)을 normalize하여 this.vertexNormals에 저장.
     */
    computeVertexNormals() {
        const vCount = this.vertices.length / 3;
        // 새로 계산된 스무스 노말을 담을 버퍼 (vertices와 동일 크기)
        this.vertexNormals = new Float32Array(this.vertices.length);

        for (let i = 0; i < vCount; i++) {
            const x = this.vertices[i * 3 + 0];
            const y = this.vertices[i * 3 + 1]; // 여기서는 y는 노말 계산에 사용 X
            const z = this.vertices[i * 3 + 2];

            // y축에 수직 -> (x, 0, z)를 정규화
            const len = Math.sqrt(x * x + z * z);
            // (len == 0)이 되는 경우는 없지만, 혹시 대비
            if (len > 0) {
                this.vertexNormals[i * 3 + 0] = x / len;
                this.vertexNormals[i * 3 + 1] = 0;
                this.vertexNormals[i * 3 + 2] = z / len;
            } else {
                // 혹시 모를 예외 상황(정말로 x=z=0이라면)
                this.vertexNormals[i * 3 + 0] = 0;
                this.vertexNormals[i * 3 + 1] = 1; // 그냥 y축 위로
                this.vertexNormals[i * 3 + 2] = 0;
            }
        }
    }

    // faceNormals -> normals 복사
    copyFaceNormalsToNormals() {
        this.normals.set(this.faceNormals);
    }

    // vertexNormals -> normals 복사
    copyVertexNormalsToNormals() {
        this.normals.set(this.vertexNormals);
    }

    initBuffers() {
        const gl = this.gl;

        // 배열 크기 측정
        const vSize = this.vertices.byteLength;
        const nSize = this.normals.byteLength;
        const cSize = this.colors.byteLength;
        const tSize = this.texCoords.byteLength;
        const totalSize = vSize + nSize + cSize + tSize;

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);

        // 순서대로 복사 (positions -> normals -> colors -> texCoords)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, this.colors);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, this.texCoords);

        // 인덱스 버퍼 (EBO)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        // vertexAttribPointer 설정
        // (shader의 layout: 0->pos, 1->normal, 2->color, 3->texCoord)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);  // positions
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize); // normals
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize); // colors
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize); // texCoords

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    /**
     * normals 배열 일부만 업데이트하고 싶을 때 (ex: Face/Vertex normal 토글 후)
     */
    updateNormals() {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

        const vSize = this.vertices.byteLength;
        // normals 부분만 다시 업로드
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    /**
     * 그리기
     * @param {Shader} shader - 사용할 셰이더
     */
    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    /**
     * 리소스 해제
     */
    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
}
