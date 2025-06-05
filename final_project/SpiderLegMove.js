import * as THREE from 'three';

export class SpiderLegMove {
    constructor(start, end, options = {}) {
        this.start = start; // start position of the leg
        this.end = end; // end position of the leg
        this.options = options; // additional options for the movement

        this.liftAmount = options.liftAmount || 4; // amount to lift the leg in Y direction <-- can be adjusted
        this.upDirection = options.upDirection || new THREE.Vector3(0, 1, 0); // default up direction
        let control = new THREE.Vector3(
            (start.x + end.x) / 2,
            Math.max(start.y, end.y), // raise Y for arc
            (start.z + end.z) / 2
        );

        control.add(this.upDirection.clone().multiplyScalar(this.liftAmount)); // adjust control point for arc

        this.duration = options.duration || 600; // duration of the leg movement in milliseconds
        this.clock = new THREE.Clock();
        this.curve = new THREE.QuadraticBezierCurve3(start, control, end);
    }

    getPosition(){
        const t = this.clock.getElapsedTime() / (this.duration / 1000); // convert duration to seconds
        if (t > 1) {
            this.clock.stop(); // stop the clock when the movement is done
            return this.end; // return the end position when done
        }
        return this.curve.getPoint(t); // t = 0 → 1 over time
    }

    reset(start = this.start, end = this.end){
        this.start.copy(start);
        this.end.copy(end);
        this.clock.start(); // reset the clock
        const control = new THREE.Vector3(
            (start.x + end.x) / 2,
            Math.max(start.y, end.y), // raise Y for arc
            (start.z + end.z) / 2
        );
        control.add(this.upDirection.clone().multiplyScalar(this.liftAmount)); // adjust control point for arc
        this.curve = new THREE.QuadraticBezierCurve3(start, control, end);
    }
    
}