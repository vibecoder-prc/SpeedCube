import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';

const FACE_COLORS = {
  R: 0xf54118,
  L: 0xd1112e,
  U: 0xffffff,
  D: 0xffc824,
  F: 0x303af0,
  B: 0x08d108,
};

const Cube = forwardRef((props, ref) => {
  const mountRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const controlsRef = useRef();
  const cubeGroupRef = useRef([]);
  const rotationStateRef = useRef(null);
  const moveQueueRef = useRef([]);
  const onMoveCallbackRef = useRef();

  const createCube = () => {
    const size = 3;
    const spacing = 0.25;
    const increment = size + spacing;
    const offset = (3 - 1) / 2;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          const x = (i - offset) * increment;
          const y = (j - offset) * increment;
          const z = (k - offset) * increment;

          const materials = [
            new THREE.MeshToonMaterial({ color: i === 2 ? FACE_COLORS.R : 0x000000 }),
            new THREE.MeshToonMaterial({ color: i === 0 ? FACE_COLORS.L : 0x000000 }),
            new THREE.MeshToonMaterial({ color: j === 2 ? FACE_COLORS.U : 0x000000 }),
            new THREE.MeshToonMaterial({ color: j === 0 ? FACE_COLORS.D : 0x000000 }),
            new THREE.MeshToonMaterial({ color: k === 2 ? FACE_COLORS.F : 0x000000 }),
            new THREE.MeshToonMaterial({ color: k === 0 ? FACE_COLORS.B : 0x000000 }),
          ];

          const geometry = new RoundedBoxGeometry(size, size, size, 2, 0.5);
          const cube = new THREE.Mesh(geometry, materials);
          cube.position.set(x, y, z);
          cube.castShadow = true;

          sceneRef.current.add(cube);
          cubeGroupRef.current.push(cube);
        }
      }
    }
  };

  const removeCube = () => {
    cubeGroupRef.current.forEach(cube => {
      sceneRef.current.remove(cube);
      cube.geometry.dispose();
      cube.material.forEach(mat => mat.dispose());
    });
    cubeGroupRef.current = [];
  };

  const rotateFaceInternal = (move) => {
    const moves = {
      R: { axis: 'x', val: 1 },
      L: { axis: 'x', val: -1 },
      U: { axis: 'y', val: 1 },
      D: { axis: 'y', val: -1 },
      F: { axis: 'z', val: 1 },
      B: { axis: 'z', val: -1 },
    };

    if (!move || !moves[move.replace("'", "")]) return;

    const prime = move.includes("'");
    const base = move.replace("'", "");
    const { axis, val } = moves[base];

    const slice = cubeGroupRef.current.filter(cube => {
      const pos = Math.round(cube.position[axis] * 2) / 2;
      return val === 1 ? pos > 1 : pos < -1;
    });

    if (slice.length === 0) return;

    const group = new THREE.Group();
    slice.forEach(cube => group.attach(cube));
    sceneRef.current.add(group);

    rotationStateRef.current = {
      group,
      axis,
      slice,
      targetAngle: (Math.PI / 2) * (prime ? -1 : 1),
      currentAngle: 0,
      speed: 0.1,
    };

    if (onMoveCallbackRef.current) {
      onMoveCallbackRef.current(move);
    }
  };

  const isCubeSolved = () => {
    const faces = [
      { axis: 'x', value: 3, faceIndex: 0 },
      { axis: 'x', value: -3, faceIndex: 1 },
      { axis: 'y', value: 3, faceIndex: 2 },
      { axis: 'y', value: -3, faceIndex: 3 },
      { axis: 'z', value: 3, faceIndex: 4 },
      { axis: 'z', value: -3, faceIndex: 5 },
    ];

    for (const { axis, value, faceIndex } of faces) {
      const faceCubes = cubeGroupRef.current.filter(c => Math.round(c.position[axis]) === value);
      const referenceColor = faceCubes[0]?.material[faceIndex].color.getHex();
      if (!faceCubes.every(c => c.material[faceIndex].color.getHex() === referenceColor)) {
        return false;
      }
    }

    return true;
  };

  const resetCube = () => {
    if (rotationStateRef.current) return;
    removeCube();
    createCube();
    moveQueueRef.current = [];
    rotationStateRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    rotateFace: (move) => {
      if (rotationStateRef.current) {
        moveQueueRef.current.push(move);
      } else {
        rotateFaceInternal(move);
      }
    },
    isCubeSolved,
    resetCube,
    setControlsEnabled: (enabled) => {
      if (controlsRef.current) controlsRef.current.enabled = enabled;
    },
    onMove: (fn) => {
      onMoveCallbackRef.current = fn;
    },
  }));

  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(-20, 20, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0xa7d1b2);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enabled = true;
    controlsRef.current = controls;

    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(20, 20, 20);
    scene.add(light);

    createCube();

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (rotationStateRef.current) {
        const r = rotationStateRef.current;
        const remaining = r.targetAngle - r.currentAngle;
        const step = Math.abs(remaining) < r.speed ? remaining : Math.sign(remaining) * r.speed;

        r.group.rotation[r.axis] += step;
        r.currentAngle += step;

        if (Math.abs(r.currentAngle - r.targetAngle) < 1e-3) {
          r.group.rotation[r.axis] = Math.round(r.group.rotation[r.axis] / (Math.PI / 2)) * (Math.PI / 2);
          r.slice.forEach(cube => scene.attach(cube));
          scene.remove(r.group);
          rotationStateRef.current = null;

          if (moveQueueRef.current.length > 0) {
            rotateFaceInternal(moveQueueRef.current.shift());
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeChild(renderer.domElement);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '80vh' }} />;
});

export default Cube;
