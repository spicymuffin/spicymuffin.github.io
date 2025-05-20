import * as THREE from 'three';

import * as objutils from './objutils.js';


export class IKJointConstraint {

    constructor(joint) {
        this.joint = joint;
        this.isActive = true;
    }

    apply() {
        throw new Error("apply() must be implemented by subclass");
    }
}

export class ConeConstraint extends IKJointConstraint {
    // joint is the joint to be constrained
    // checker is a function that checks if the joint is within the constraint
    constructor(joint, checker) {
        super(joint)
    }

    apply() {
    }
}

export class AxisConstraint extends IKJointConstraint {

    constructor(joint, axis) {
        super(joint);
        this.axis = axis.clone().normalize();
    }

    apply() {

    }
}

export class IKPole {
    constructor(pole, vector = true) {
        this.isVector = vector;

        if (vector) {
            this.pole = pole.clone().normalize();
        } else {
            this.target = pole.clone();
        }
    }

    getPoleDirection(origin) {
        if (this.isVector) {
            return this.pole.clone().normalize();
        } else {
            return this.target.clone().sub(origin).normalize();
        }
    }
}

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positions
    constructor(endEffectorBone, njoints, scene, constraints = null, poles = null, options = {}) {
        this.chainLength = njoints;
        this.debug = false || options.debug;
        if (this.debug) {
            this.jointVisualizers = [];
        }

        this.endEffectorBone = endEffectorBone;
        this.sceneRef = scene;

        // default pole is above the IK chain
        this.defaultPole = options.defaultPole || new IKPole(new THREE.Vector3(0, 1, 0), true);

        if (constraints) {
            this.constraints = constraints;
        } else {
            this.constraints = [];
            this.constraints.length = njoints;
        }

        if (poles) {
            this.poles = poles;
        } else {
            this.poles = [];
            this.poles.length = njoints;
        }

        if (njoints < 2) {
            throw new Error('chain length must be at least 2');
        }
        if (!endEffectorBone) {
            throw new Error('end effector must be non null');
        }

        // proxyJoints[0]                        is the end effector
        // proxyJoints[chainLength - 1]          is the root joint
        this.proxyJoints = [];
        let iterator = endEffectorBone;
        for (let i = 0; i < njoints; i++) {
            if (this.debug) {
                console.log(`adding proxy joint ${i} for ${iterator.name}`);
            }
            this.proxyJoints.push(new THREE.Object3D());
            iterator.updateWorldMatrix(true, false);
            // copy the world position of the joint into the proxy joint
            this.proxyJoints[i].position.copy(iterator.getWorldPosition(new THREE.Vector3()));
            // copy the world rotation of the joint into the proxy joint
            this.proxyJoints[i].quaternion.copy(iterator.getWorldQuaternion(new THREE.Quaternion()));
            iterator = iterator.parent;
            this.sceneRef.add(this.proxyJoints[i]);
        }

        // set the root joint to be the last joint in the chain
        this.rootPos = new THREE.Vector3().copy(this.proxyJoints[this.proxyJoints.length - 1].position);
        if (options.rootPos) {
            this.rootPos.copy(options.rootPos);
        }

        // calculate the distance between the joints
        this.jointDistances = [];
        for (let i = 0; i < this.proxyJoints.length - 1; i++) {
            const dist = this.proxyJoints[i].position.distanceTo(this.proxyJoints[i + 1].position);
            this.jointDistances.push(dist);
        }

        if (this.debug) {
            for (let i = 0; i < this.proxyJoints.length; i++) {
                const sphere = objutils.createSphere({ radius: 0.2, color: 0xff00ff });
                const axis = new THREE.AxesHelper(0.6);
                axis.raycast = () => { };
                sphere.quaternion.copy(this.proxyJoints[i].quaternion);
                sphere.add(axis);
                this.jointVisualizers.push(sphere);
                console.log(`adding proxy joint ${i} to scene`);
                this.proxyJoints[i].add(sphere);
                sphere.name = `proxy_${i}`;
            }
        }

    }

    // index is the index of the joint to be biased towards the pole
    lookupPole(index) {
        if (this.poles[index]) {
            return this.poles[index];
        } else {
            return this.defaultPole;
        }
    }

    // solves using FABRIK
    // TODO: add CCD...?
    solve(target, tolerance = 0.1, maxIterations = 10) {
        target.updateWorldMatrix(true, false);
        let targetPos = target.getWorldPosition(new THREE.Vector3());
        let targetQuat = target.getWorldQuaternion(new THREE.Quaternion());
        this.doForwardPass(targetPos, targetQuat);
        this.doBackwardPass(this.rootPos);
    }

    doForwardPass(targetPos, targetQuat) {
        // set the end effector to the target position
        this.proxyJoints[0].position.copy(targetPos);
        // set the end effector's rotation to the target's rotation
        this.proxyJoints[0].quaternion.copy(targetQuat);

        // iterate over the joints
        for (let i = 1; i < this.proxyJoints.length; i++) {
            // forward is +Y
            // poleref is +Z
            // pole/forward ortho is +X

            // i-1th joint is the child of the ith joint

            // calculate forward direction for the joint
            let forward = new THREE.Vector3().subVectors(this.proxyJoints[i - 1].position, this.proxyJoints[i].position).normalize();

            // get pole object
            let pole = this.lookupPole(i);

            // get pole direction (if its already a vector, getPoleDirection returns the vector)
            let poleDir = pole.getPoleDirection(this.proxyJoints[i].position).clone();

            poleDir.sub(forward.clone().multiplyScalar(poleDir.dot(forward)));
            poleDir.normalize();

            // calculate pole/forward orthogonal direction
            let poleForwardOrtho = new THREE.Vector3().crossVectors(forward, poleDir).normalize();

            // recompute pole to forward orthogonal direction
            let poleRef = new THREE.Vector3().crossVectors(poleForwardOrtho, forward).normalize();

            poleForwardOrtho.crossVectors(forward, poleRef).normalize();

            if (this.debug) {
                // draw the basis
                // const basis = objutils.drawArrows(this.proxyJoints[i].position, poleForwardOrtho, forward, poleRef);
                // this.sceneRef.add(basis);
            }

            let m = new THREE.Matrix4().makeBasis(poleForwardOrtho, forward, poleRef);
            this.proxyJoints[i].quaternion.setFromRotationMatrix(m);

            // move the joint along the forward direction to compensate for the distance change
            let dist = this.jointDistances[i - 1];
            this.proxyJoints[i].position.copy(this.proxyJoints[i - 1].position.clone().add(forward.clone().multiplyScalar(-dist)));

            // apply constraints
            // TODO: apply constraints
        }
    }

    doBackwardPass(rootPos) {
        this.proxyJoints[this.proxyJoints.length - 1].position.copy(rootPos);
        // we dont need to set the rotation of the root joint, since that will be handled by constraints

        // iterate over the joints
        for (let i = this.proxyJoints.length - 2; i >= 0; i--) {
            // forward is +Y
            // poleref is +Z
            // pole/forward ortho is +X

            // i+1th joint is the parent of the ith joint
            let forward = new THREE.Vector3().subVectors(this.proxyJoints[i].position, this.proxyJoints[i + 1].position).normalize();

            // get pole object
            let pole = this.lookupPole(i);

            // get pole direction (if its already a vector, getPoleDirection returns the vector)
            let poleDir = pole.getPoleDirection(this.proxyJoints[i].position).clone();

            // project the pole direction onto the forward directio for accuracy
            poleDir.sub(forward.clone().multiplyScalar(poleDir.dot(forward)));
            poleDir.normalize();

            // calculate pole/forward orthogonal direction
            let poleForwardOrtho = new THREE.Vector3().crossVectors(forward, poleDir).normalize();

            // recompute pole to forward orthogonal direction
            let poleRef = new THREE.Vector3().crossVectors(poleForwardOrtho, forward).normalize();

            poleForwardOrtho.crossVectors(forward, poleRef).normalize();

            if (this.debug) {
                // // draw the basis
                // const basis = objutils.drawArrows(this.proxyJoints[i].position, poleForwardOrtho, forward, poleRef);
                // this.sceneRef.add(basis);

                // console.log(`joint ${i} position: ${this.proxyJoints[i].position.x}, ${this.proxyJoints[i].position.y}, ${this.proxyJoints[i].position.z}`);
            }

            let m = new THREE.Matrix4().makeBasis(poleForwardOrtho, forward, poleRef);
            this.proxyJoints[i + 1].quaternion.setFromRotationMatrix(m);

            // move the joint along the forward direction to compensate for the distance change
            let dist = this.jointDistances[i];
            this.proxyJoints[i].position.copy(this.proxyJoints[i + 1].position.clone().add(forward.clone().multiplyScalar(dist)));
        }

    }
}