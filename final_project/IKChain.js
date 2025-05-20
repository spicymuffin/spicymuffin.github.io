import * as THREE from 'three';

import * as objutils from './objutils.js';

export class ConeConstraint {
    // joint is the joint to be constrained
    // checker is a function that checks if the joint is within the constraint
    constructor(joint, checker) {

    }
}

export class AxisConstraint {

    constructor(jointRoot, jointEnd, axis) {
        this.jointRoot = jointRoot;
        this.jointEnd = jointEnd;
        this.axis = axis;


    }


}

export class IKJoint {
    constructor(bone, parent = null) {

    }
}

export class IKChain {
    // creates proxy joints to solve with FABRIK without modifying the original joints' positionsa
    constructor(endEffector, chainLength, scene, options = {}) {
        this.chainLength = chainLength;
        this.debug = options.debug || false;
        if (this.debug) {
            this.jointSpheres = [];
        }
        this.endEffector = endEffector;
        this.sceneRef = scene;

        if (chainLength < 2) {
            throw new Error('chain length must be at least 2');
        }
        if (!endEffector) {
            throw new Error('end effector must be non null');
        }

        // proxy joint 0               is the end effector
        // proxy joint chainLength - 1 is the root joint
        this.proxyJoints = [];

        let iterator = endEffector;
        for (let i = 0; i < chainLength; i++) {
            if (this.debug) {
                console.log(`adding proxy joint ${i} for ${iterator.name}`);
            }
            this.proxyJoints.push(new THREE.Object3D());
            iterator.updateWorldMatrix(true, false);
            this.proxyJoints[i].position.copy(iterator.getWorldPosition(new THREE.Vector3()));
            iterator = iterator.parent;
        }

        if (this.debug) {
            for (let i = 0; i < this.proxyJoints.length; i++) {
                const sphere = objutils.createSphere({ radius: 0.2, color: 0x0000ff, position: this.proxyJoints[i].position });
                sphere.name = `proxy_${i}`;
                this.jointSpheres.push(sphere);
                this.sceneRef.add(sphere);
            }
        }

    }

    // solves using FABRIK
    // TODO: add CCD...?
    solve(target, maxIterations = 10) {

    }

    doForwardPass() {

    }
    doBackwardPass() {

    }
}