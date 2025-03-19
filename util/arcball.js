export class Arcball {
    constructor(canvas, distance = 5.0, sensitivity = {
        rotation: 1.0,
        zoom: 0.001
    }) 
    {
        this.canvas = canvas;
        this.distance = distance;
        this.rotation = quat.create();
        this.position = vec3.fromValues(0, 0, distance);
        this.target = vec3.create();
        this.up = vec3.fromValues(0, 1, 0);
        
        // 감도 설정
        this.rotationSensitivity = sensitivity.rotation || 1.0;
        this.zoomSensitivity = sensitivity.zoom || 0.001;
        
        this.dragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // 마우스 이벤트 리스너 설정
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('wheel', this.onWheel.bind(this));
    }

    // 스크린 좌표를 구면 좌표로 변환
    getArcballVector(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const center = {
            x: rect.width * 0.5,
            y: rect.height * 0.5
        };
        
        // 스크린 좌표를 -1에서 1 사이의 값으로 정규화
        const x = (screenX - center.x) / center.x;
        const y = (center.y - screenY) / center.y;
        
        const sqrLen = x * x + y * y;
        const z = sqrLen <= 1.0 ? Math.sqrt(1.0 - sqrLen) : 0;
        
        const result = vec3.fromValues(x, y, z);
        vec3.normalize(result, result);
        return result;
    }

    onMouseDown(event) {
        this.dragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    onMouseMove(event) {
        if (!this.dragging) return;

        const currentX = event.clientX;
        const currentY = event.clientY;

        // 마우스 이동 거리로부터 회전 계산
        const va = this.getArcballVector(this.lastMouseX, this.lastMouseY);
        const vb = this.getArcballVector(currentX, currentY);
        
        // 회전 쿼터니언 계산
        const angle = Math.acos(Math.min(1.0, vec3.dot(va, vb))) * this.rotationSensitivity;
        const rotationAxis = vec3.create();
        vec3.cross(rotationAxis, vb, va);
        vec3.normalize(rotationAxis, rotationAxis);
        
        // 현재 회전에 새로운 회전 적용
        const deltaRotation = quat.create();
        quat.setAxisAngle(deltaRotation, rotationAxis, angle);
        quat.multiply(this.rotation, deltaRotation, this.rotation);

        this.lastMouseX = currentX;
        this.lastMouseY = currentY;
    }

    onMouseUp() {
        this.dragging = false;
    }

    onWheel(event) {
        // 줌 인/아웃에 감도 적용
        this.distance += event.deltaY * this.zoomSensitivity * this.distance;
        
        // 최소/최대 거리 제한
        this.distance = Math.max(0.1, Math.min(100.0, this.distance));
        
        // 카메라 위치 업데이트
        vec3.set(this.position, 0, 0, this.distance);
        event.preventDefault();
    }

    getViewMatrix() {
        const viewMatrix = mat4.create();
        
        // 회전 행렬 생성
        const rotationMatrix = mat4.create();
        mat4.fromQuat(rotationMatrix, this.rotation);
        
        // 카메라 위치 계산
        const eye = vec3.create();
        vec3.transformMat4(eye, this.position, rotationMatrix);
        
        mat4.lookAt(
            viewMatrix,
            eye,              // 카메라 위치
            this.target,      // 바라보는 지점
            this.up          // 상향 벡터
        );
        
        return viewMatrix;
    }

    getModelRotMatrix() {
        const modelMatrix = mat4.create();
        mat4.fromQuat(modelMatrix, this.rotation);
        return modelMatrix;
    }

    getViewCamDistanceMatrix() {
        const viewMatrix = mat4.create();

        mat4.lookAt(
            viewMatrix,
            this.position,   // 카메라 위치
            this.target,     // 바라보는 지점
            this.up          // 상향 벡터
        );
        
        return viewMatrix;
    }

    // 카메라 리셋
    reset() {
        this.rotation = quat.create();
        this.position = vec3.fromValues(0, 0, this.distance);
        this.target = vec3.fromValues(0, 0, 0);
    }
}
