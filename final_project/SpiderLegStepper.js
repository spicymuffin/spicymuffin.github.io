import * as THREE from 'three';

export class SpiderLegStepper {
    constructor(from, to, up, duration, camera, options = {}) {
        this.from = from.clone();
        this.to = to.clone();
        this.up = up.clone().normalize();
        this.duration = duration;

        this.lift_amount = options.lift_amount ?? 4;
        this.curve_bias = options.curve_bias ?? 0.5;
        this.ease_fn = options.ease_fn ?? (t => t * (2 - t));

        this._compute_control_point();

        // camera section
        // this.camera = camera;
        // this.listener = new THREE.AudioListener();
        // this.camera.add(this.listener);

        // this.footstepSound = new THREE.Audio(this.listener);
        // this.audioLoader = new THREE.AudioLoader();
        // this.audioLoader.load('assets/sounds/spider-step.mp3', (buffer) => {
        //     this.footstepSound.setBuffer(buffer);
        //     this.footstepSound.setVolume(0.4);
        // });
        // camera section end
    }

    _compute_control_point() {
        this.control = new THREE.Vector3().lerpVectors(this.from, this.to, this.curve_bias);
        this.control.addScaledVector(this.up, this.lift_amount);
    }

    setFrom(from) {
        this.from.copy(from);
        this._compute_control_point();
    }

    setTo(to) {
        this.to.copy(to);
        this._compute_control_point();
    }

    setUp(up) {
        this.up.copy(up).normalize();
        this._compute_control_point();
    }

    setControl(control) {
        this.control.copy(control);
    }

    setDuration(duration) {
        this.duration = duration;
    }

    setEasing(ease_fn) {
        this.ease_fn = ease_fn;
    }

    getPosition(elapsed_time) {
        return this.getPositionInPlace(elapsed_time, new THREE.Vector3());
    }

    getPositionInPlace(elapsed_time, out) {
        let t = elapsed_time / this.duration;

        // t = Math.max(0, Math.min(1, t));
        if (t > 0.8 && t < 0.9){
            //print sound effect
            // console.log("Footstep sound effect triggered");
            // if (!this.footstepSound.isPlaying) {
            //     this.footstepSound.play();
            // }
        }

        const eased_t = this.ease_fn(t);

        const one_minus_t = 1 - eased_t;

        const a = one_minus_t * one_minus_t;
        const b = 2 * one_minus_t * eased_t;
        const c = eased_t * eased_t;

        out.set(
            this.from.x * a + this.control.x * b + this.to.x * c,
            this.from.y * a + this.control.y * b + this.to.y * c,
            this.from.z * a + this.control.z * b + this.to.z * c
        );

        return out;
    }
}