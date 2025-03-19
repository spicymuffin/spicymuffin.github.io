export function loadTexture(gl, flip, url) { // flip: true or false (Y축 뒤집기 여부)
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // 텍스처가 로드되기 전까지 보여줄 단색
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([255, 0, 255, 255]));

    const image = new Image();
    image.onload = () => { 
        if (flip) { // Y축 뒤집는 경우
            //console.log("Flip case");
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        }
        else {
            //console.log("No flip case");
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    };
    image.src = url;

    return texture;
}