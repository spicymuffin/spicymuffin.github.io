import { resizeAspectRatio, Axes } from '../../util/util.js';
import { Shader, readShaderFile } from '../../util/shader.js';
import { regularOctahedron } from './regularOctahedron.js';
import { Arcball } from '../../util/arcball.js';
import { loadTexture } from '../../util/texture.js';
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let isInitialized = false;
let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create();
const axes = new Axes(gl, 1.5); // create an Axes object with the length of axis 1.5
const texture = loadTexture(gl, true, '../../images/textures/sunrise.jpg'); // see ../util/texture.js
const cube = new regularOctahedron(gl);

// Arcball object
const arcball = new Arcball(canvas, 5.0, { rotation: 2.0, zoom: 0.0005 });

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('program terminated');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('program terminated with error:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {

    // clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // get view matrix from the arcball
    viewMatrix = arcball.getViewMatrix();

    // drawing the cube
    shader.use();  // using the cube's shader
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setMat4('u_projection', projMatrix);
    cube.draw(shader);

    // drawing the axes (using the axes's shader: see util.js)
    axes.draw(viewMatrix, projMatrix);

    // call the render function the next time for animation
    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        await initShader();

        // View transformation matrix (the whole world is translated to -3 in z-direction)
        // Camera is at (0, 0, 0) and looking at negative z-direction
        mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -3));

        // Projection transformation matrix (invariant in the program)
        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),  // field of view (fov, degree)
            canvas.width / canvas.height, // aspect ratio
            0.1, // near
            1000.0 // far
        );

        // activate the texture unit 0
        // in fact, we can omit this command
        // when we use the only one texture
        gl.activeTexture(gl.TEXTURE0);

        // bind the texture to the shader
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // pass the u_texture uniform variable to the shader
        // with the texture unit number
        shader.setInt('u_texture', 0);

        // call the render function the first time for animation
        requestAnimationFrame(render);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}

