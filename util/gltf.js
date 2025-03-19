class GLTFViewer {
    constructor(gl, canvas, url) {
        
        this.canvas = canvas;
        this.gl = gl;
        this.url = url;

        if (!this.gl) {
            console.error("WebGL 2.0 not supported");
            return;
        }
        this.animationTime = 0;
        this.init();
    }

    async init() {
        await this.loadGLTF("model.gltf");
        this.setupShaders();
        this.setupBuffers();
        this.setupTextures();
        this.setupAnimations();
        this.startRenderingLoop();
    }

    async loadGLTF(url) {
        const response = await fetch(url);
        this.gltf = await response.json();
        console.log("Loaded glTF file:", this.gltf);
    }

    setupShaders() {
        const vsSource = `#version 300 es
            in vec3 a_position;
            in vec2 a_texcoord;
            uniform mat4 u_projection;
            uniform mat4 u_view;
            uniform mat4 u_model;
            out vec2 v_texcoord;
            void main() {
                gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
                v_texcoord = a_texcoord;
            }
        `;

        const fsSource = `#version 300 es
            precision highp float;
            in vec2 v_texcoord;
            uniform sampler2D u_texture;
            out vec4 fragColor;
            void main() {
                fragColor = texture(u_texture, v_texcoord);
            }
        `;

        this.shaderProgram = this.createShaderProgram(vsSource, fsSource);
        this.gl.useProgram(this.shaderProgram);
    }

    createShaderProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error("Shader program failed to link:", gl.getProgramInfoLog(shaderProgram));
        }
        return shaderProgram;
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    setupBuffers() {
        const gl = this.gl;
        const vertices = new Float32Array([
            -0.5, -0.5, 0.0, 0.0, 0.0,
             0.5, -0.5, 0.0, 1.0, 0.0,
             0.0,  0.5, 0.0, 0.5, 1.0
        ]);
        
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    setupTextures() {
        const gl = this.gl;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
        };
        image.src = "texture.png";
    }

    setupAnimations() {
        this.animations = this.gltf.animations || [];
    }

    updateAnimation(time) {
        if (this.animations.length > 0) {
            this.animationTime = (time / 1000) % 5; 
        }
    }

    startRenderingLoop() {
        const gl = this.gl;
        const render = (time) => {
            this.updateAnimation(time);
            
            gl.clearColor(0.1, 0.1, 0.1, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            
            requestAnimationFrame(render);
        };
        render(0);
    }
}