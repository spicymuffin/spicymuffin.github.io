// Function to read shader files
export async function readShaderFile(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        return `${content}`;
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
}

// Function to compile shader
export function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Function to create shader program
export function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Shader class
export class Shader {
    constructor(gl, vertexSource, fragmentSource) {
        this.gl = gl;
        this.program = this.initShader(vertexSource, fragmentSource);
        if (!this.program) {
            throw new Error('Failed to initialize shader program');
        }
    }

    initShader(vertexSource, fragmentSource) {
        // 버텍스 셰이더 컴파일
        const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vertexShader, vertexSource);
        this.gl.compileShader(vertexShader);
        
        // 컴파일 결과 확인
        if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
            console.error('Error compiling vertex shader:', this.gl.getShaderInfoLog(vertexShader));
            this.gl.deleteShader(vertexShader);
            return null;
        }

        // 프래그먼트 셰이더 컴파일
        const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fragmentShader, fragmentSource);
        this.gl.compileShader(fragmentShader);
        
        // 컴파일 결과 확인
        if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
            console.error('Error compiling fragment shader:', this.gl.getShaderInfoLog(fragmentShader));
            this.gl.deleteShader(fragmentShader);
            return null;
        }

        // 프로그램 생성 및 링크
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        // 링크 결과 확인
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Error linking program:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }

        // 셰이더 객체 삭제
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        return program;
    }

    // use the shader program
    use() {
        if (!this.program) return;
        this.gl.useProgram(this.program);
    }

    // set the attribute pointer
    setAttribPointer(name, size, type, normalized, stride, offset) {
        if (!this.program) return;
        const location = this.gl.getAttribLocation(this.program, name);
        if (location === -1) {
            console.warn(`Attribute ${name} not found in shader program`);
            return;
        }
        this.gl.enableVertexAttribArray(location);
        this.gl.vertexAttribPointer(location, size, type, normalized, stride, offset);
    }

    // Uniform setters
    setBool(name, value) {
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, name), value ? 1 : 0);
    }

    setInt(name, value) {
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, name), value);
    }

    setFloat(name, value) {
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, name), value);
    }

    setVec2(name, x, y) {
        if (y === undefined) {
            this.gl.uniform2fv(this.gl.getUniformLocation(this.program, name), x);
        } else {
            this.gl.uniform2f(this.gl.getUniformLocation(this.program, name), x, y);
        }
    }

    setVec3(name, x, y, z) {
        if (y === undefined) {
            this.gl.uniform3fv(this.gl.getUniformLocation(this.program, name), x);
        } else {
            this.gl.uniform3f(this.gl.getUniformLocation(this.program, name), x, y, z);
        }
    }

    setVec4(name, x, y, z, w) {
        if (y === undefined) {
            this.gl.uniform4fv(this.gl.getUniformLocation(this.program, name), x);
        } else {
            this.gl.uniform4f(this.gl.getUniformLocation(this.program, name), x, y, z, w);
        }
    }

    setMat2(name, mat) {
        this.gl.uniformMatrix2fv(this.gl.getUniformLocation(this.program, name), false, mat);
    }

    setMat3(name, mat) {
        this.gl.uniformMatrix3fv(this.gl.getUniformLocation(this.program, name), false, mat);
    }

    setMat4(name, mat) {
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, name), false, mat);
    }
}
