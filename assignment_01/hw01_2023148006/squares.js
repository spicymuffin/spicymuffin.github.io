const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  console.error("WebGL 2 is not supported by your browser.");
  throw new Error("WebGL 2 is not supported by your browser.");
}

function draw_squares(init_size = -1) {
  let size;
  if (init_size > 0) {
    size = init_size;
    canvas.width = init_size;
    canvas.height = init_size;
  } else {
    // 1:1 aspect ratio
    size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size;
    canvas.height = size;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);

  // enable scissor test
  gl.enable(gl.SCISSOR_TEST);

  // sqare size
  const half_sz = size / 2;

  // top left (red)
  gl.scissor(0, half_sz, half_sz, half_sz);
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // top right (green)
  gl.scissor(half_sz, half_sz, half_sz, half_sz);
  gl.clearColor(0, 1, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // bottom left (blue)
  gl.scissor(0, 0, half_sz, half_sz);
  gl.clearColor(0, 0, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // bottom right (yellow)
  gl.scissor(half_sz, 0, half_sz, half_sz);
  gl.clearColor(1, 1, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // disable scissor test
  gl.disable(gl.SCISSOR_TEST);
}

// handle window resize
window.addEventListener("resize", draw_squares);

// initial draw
draw_squares(500);
