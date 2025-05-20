import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';

export function initStats(type) {

    const panelType = (typeof type !== 'undefined' && type) && (!isNaN(type)) ? parseInt(type) : 0;
    const stats = new Stats();

    stats.showPanel(panelType); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    return stats;
}


/// TODO: drop antialias: true, import TAA from three/examples/jsm/postprocessing/TAARenderPass.js
export function initRenderer(additionalProperties) {

    const props = (typeof additionalProperties !== 'undefined' && additionalProperties) ? additionalProperties : { antialias: true };
    const renderer = new THREE.WebGLRenderer(props);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.setClearColor(new THREE.Color(0x000000));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.antialias = true;
    document.body.appendChild(renderer.domElement);

    return renderer;
}

export function initCanvasRenderer() {

    const canvasRenderer = new THREE.CanvasRenderer();
    canvasRenderer.setClearColor(new THREE.Color(0x000000));
    canvasRenderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    return canvasRenderer;
}

export function initCamera(options = {}) {
    const position = options.position || new THREE.Vector3(10, 10, 10);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000);
    camera.position.copy(position);

    return camera;
}

export function initDefaultLighting(scene, initialPosition) {
    const position = (initialPosition !== undefined) ? initialPosition : new THREE.Vector3(-10, 30, 40);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight1.position.copy(position);
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    directionalLight1.shadow.camera.fov = 15;
    directionalLight1.name = "directionalLight1";
    //scene.add(directionalLight1);

    const spotLight = new THREE.SpotLight(0xffffff, 5000);
    spotLight.position.copy(position);
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.fov = 15;
    spotLight.castShadow = true;
    spotLight.decay = 2;
    spotLight.penumbra = 0.05;
    spotLight.name = "spotLight"

    scene.add(spotLight);

    const ambientLight = new THREE.AmbientLight(0x353535);
    ambientLight.name = "ambientLight";
    scene.add(ambientLight);
}

export function initDefaultDirectionalLighting(scene, initialPosition) {
    const position = (initialPosition !== undefined) ? initialPosition : new THREE.Vector3(100, 200, 200);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.copy(position);
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.castShadow = true;

    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;

    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x343434);
    ambientLight.name = "ambientLight";
    scene.add(ambientLight);
}

export function initOrbitControls(camera, renderer) {
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.rotateSpeed = 1.0;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.panSpeed = 0.8;
    orbitControls.noZoom = false;
    orbitControls.noPan = false;
    orbitControls.staticMoving = true;
    orbitControls.dynamicDampingFactor = 0.3;
    orbitControls.keys = [65, 83, 68];

    return orbitControls;
}

export const applyMeshStandardMaterial = function (geometry, material) {
    if (!material || material.type !== "MeshStandardMaterial") {
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
        material.side = THREE.DoubleSide;
    }

    return new THREE.Mesh(geometry, material)
}

export const applyMeshNormalMaterial = function (geometry, material) {
    if (!material || material.type !== "MeshNormalMaterial") {
        material = new THREE.MeshNormalMaterial();
        material.side = THREE.DoubleSide;
    }

    return new THREE.Mesh(geometry, material)
}

export function addBasicMaterialSettings(gui, controls, material, name) {

    const folderName = (name !== undefined) ? name : 'THREE.Material';

    controls.material = material;

    const folder = gui.addFolder(folderName);
    folder.add(controls.material, 'id');
    folder.add(controls.material, 'uuid');
    folder.add(controls.material, 'name');
    folder.add(controls.material, 'opacity', 0, 1, 0.01);
    folder.add(controls.material, 'transparent');
    folder.add(controls.material, 'overdraw', 0, 1, 0.01);
    folder.add(controls.material, 'visible');
    folder.add(controls.material, 'side', { FrontSide: 0, BackSide: 1, BothSides: 2 }).onChange(function (side) {
        controls.material.side = parseInt(side)
    });

    folder.add(controls.material, 'colorWrite');
    folder.add(controls.material, 'flatShading').onChange(function (shading) {
        controls.material.flatShading = shading;
        controls.material.needsUpdate = true;
    });
    folder.add(controls.material, 'premultipliedAlpha');
    folder.add(controls.material, 'dithering');
    folder.add(controls.material, 'shadowSide', { FrontSide: 0, BackSide: 1, BothSides: 2 });
    folder.add(controls.material, 'vertexColors', { NoColors: THREE.NoColors, FaceColors: THREE.FaceColors, VertexColors: THREE.VertexColors }).onChange(function (vertexColors) {
        material.vertexColors = parseInt(vertexColors);
    });
    folder.add(controls.material, 'fog');

    return folder;
}

export function addSpecificMaterialSettings(gui, controls, material, name) {
    controls.material = material;

    const folderName = (name !== undefined) ? name : 'THREE.' + material.type;
    const folder = gui.addFolder(folderName);
    switch (material.type) {
        case "MeshNormalMaterial":
            folder.add(controls.material, 'wireframe');
            return folder;

        case "MeshPhongMaterial":
            controls.specular = material.specular.getStyle();
            folder.addColor(controls, 'specular').onChange(function (e) {
                material.specular.setStyle(e)
            });
            folder.add(material, 'shininess', 0, 100, 0.01);
            return folder;

        case "MeshStandardMaterial":
            controls.color = material.color.getStyle();
            folder.addColor(controls, 'color').onChange(function (e) {
                material.color.setStyle(e)
            });
            controls.emissive = material.emissive.getStyle();
            folder.addColor(controls, 'emissive').onChange(function (e) {
                material.emissive.setStyle(e)
            });
            folder.add(material, 'metalness', 0, 1, 0.01);
            folder.add(material, 'roughness', 0, 1, 0.01);
            folder.add(material, 'wireframe');

            return folder;
    }
}

export function redrawGeometryAndUpdateUI(gui, scene, controls, geomFunction) {
    guiRemoveFolder(gui, controls.specificMaterialFolder);
    guiRemoveFolder(gui, controls.currentMaterialFolder);
    if (controls.mesh) scene.remove(controls.mesh)
    const changeMat = eval("(" + controls.appliedMaterial + ")")
    if (controls.mesh) {
        controls.mesh = changeMat(geomFunction(), controls.mesh.material);
    } else {
        controls.mesh = changeMat(geomFunction());
    }

    controls.mesh.castShadow = controls.castShadow;
    scene.add(controls.mesh)
    controls.currentMaterialFolder = addBasicMaterialSettings(gui, controls, controls.mesh.material);
    controls.specificMaterialFolder = addSpecificMaterialSettings(gui, controls, controls.mesh.material);
}

function guiRemoveFolder(gui, folder) {
    if (folder && folder.name && gui.__folders[folder.name]) {
        gui.__folders[folder.name].close();
        gui.__folders[folder.name].domElement.parentNode.parentNode.removeChild(gui.__folders[folder.name].domElement.parentNode);
        delete gui.__folders[folder.name];
        gui.onResize();
    }
}

export function addMeshSelection(gui, controls, material, scene) {
    const sphereGeometry = new THREE.SphereGeometry(10, 20, 20);
    const cubeGeometry = new THREE.BoxGeometry(16, 16, 15);
    const planeGeometry = new THREE.PlaneGeometry(14, 14, 4, 4);

    const sphere = new THREE.Mesh(sphereGeometry, material);
    const cube = new THREE.Mesh(cubeGeometry, material);
    const plane = new THREE.Mesh(planeGeometry, material);

    sphere.position.x = 0;
    sphere.position.y = 11;
    sphere.position.z = 2;

    cube.position.y = 8;

    controls.selectedMesh = "cube";
    loadGopher(material).then(function (gopher) {

        gopher.scale.x = 5;
        gopher.scale.y = 5;
        gopher.scale.z = 5;
        gopher.position.z = 0
        gopher.position.x = -10
        gopher.position.y = 0

        gui.add(controls, 'selectedMesh', ["cube", "sphere", "plane", "gopher"]).onChange(function (e) {

            scene.remove(controls.selected);

            switch (e) {
                case "cube":
                    scene.add(cube);
                    controls.selected = cube;
                    break;
                case "sphere":
                    scene.add(sphere);
                    controls.selected = sphere;
                    break;
                case "plane":
                    scene.add(plane);
                    controls.selected = plane;
                    break;
                case "gopher":
                    scene.add(gopher);
                    controls.selected = gopher;
                    break;
            }
        });
    });

    controls.selected = cube;
    scene.add(controls.selected);
}

export function loadGopher(material) {
    const loader = new THREE.OBJLoader();
    const mesh = null;
    const p = new Promise(function (resolve) {
        loader.load('../../assets/models/gopher/gopher.obj', function (loadedMesh) {
            // this is a group of meshes, so iterate until we reach a THREE.Mesh
            mesh = loadedMesh;
            if (material) {
                // material is defined, so overwrite the default material.
                computeNormalsGroup(mesh);
                setMaterialGroup(material, mesh);
            }
            resolve(mesh);
        });
    });

    return p;
}

export function setMaterialGroup(material, group) {
    if (group instanceof THREE.Mesh) {
        group.material = material;
    } else if (group instanceof THREE.Group) {
        group.children.forEach(function (child) { setMaterialGroup(material, child) });
    }
}

export function computeNormalsGroup(group) {
    if (group instanceof THREE.Mesh) {
        const tempGeom = new THREE.Geometry();
        tempGeom.fromBufferGeometry(group.geometry)
        tempGeom.computeFaceNormals();
        tempGeom.mergeVertices();
        tempGeom.computeVertexNormals();

        tempGeom.normalsNeedUpdate = true;

        // group = new THREE.BufferGeometry();
        // group.fromGeometry(tempGeom);
        group.geometry = tempGeom;

    } else if (group instanceof THREE.Group) {
        group.children.forEach(function (child) { computeNormalsGroup(child) });
    }
}

export function addGeometry(scene, geom, name, texture, gui, controls) {
    var mat = new THREE.MeshStandardMaterial(
        {
            map: texture,
            metalness: 0.2,
            roughness: 0.07
        });
    var mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;

    scene.add(mesh);
    //addBasicMaterialSettings(gui, controls, mat, name + '-THREE.Material');
    //addSpecificMaterialSettings(gui, controls, mat, name + '-THREE.MeshStandardMaterial');

    return mesh;
};

export function addGeometryWithMaterial(scene, geom, name, gui, controls, material) {
    var mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;

    scene.add(mesh);
    //addBasicMaterialSettings(gui, controls, material, name + '-THREE.Material');
    //addSpecificMaterialSettings(gui, controls, material, name + '-Material');

    return mesh;
};
