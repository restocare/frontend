"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useThreeCanvas } from "@/src/components/three/use-three-canvas";

function createConnectionScene(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 820, 290, 0, 0.1, 1000);
  camera.position.z = 500;
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xffe5a4, 3);
  light.position.set(100, 250, 200);
  scene.add(light);
  const gold = new THREE.MeshStandardMaterial({ color: "#F4B400", metalness: 0.35, roughness: 0.3, transparent: true, opacity: 0.75 });
  const pale = new THREE.MeshStandardMaterial({ color: "#DDD7C2", metalness: 0.15, roughness: 0.65, transparent: true, opacity: 0.7 });
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#F4B400", transparent: true, opacity: 0.3, depthWrite: false });
  const blockGeometry = new THREE.BoxGeometry(12, 12, 12);
  const ringGeometry = new THREE.TorusGeometry(32, 0.85, 8, 64);
  const blocks = [
    { x: 0.09, y: 0.27, scale: 1.1 }, { x: 0.34, y: 0.72, scale: 0.8 },
    { x: 0.48, y: 0.2, scale: 1.25 }, { x: 0.63, y: 0.8, scale: 0.85 },
    { x: 0.91, y: 0.68, scale: 1.1 },
  ].map((point, i) => {
    const mesh = new THREE.Mesh(blockGeometry, i % 2 ? gold : pale);
    mesh.rotation.set(0.5, 0.5, Math.PI / 4);
    mesh.scale.set(point.scale, point.scale, point.scale * 1.8);
    scene.add(mesh);
    return { ...point, mesh };
  });
  const rings = [{ x: 0.18, y: 0.62 }, { x: 0.79, y: 0.39 }].map((point) => {
    const mesh = new THREE.Mesh(ringGeometry, ringMaterial);
    scene.add(mesh);
    return { ...point, mesh };
  });
  let width = 820;
  let height = 290;
  return {
    resize: (nextWidth: number, nextHeight: number) => {
      width = nextWidth;
      height = nextHeight;
      camera.right = width;
      camera.top = height;
      camera.updateProjectionMatrix();
      rings.forEach(({ mesh, x, y }) => mesh.position.set(x * width, (1 - y) * height, 0));
    },
    render: (elapsed: number) => {
      blocks.forEach(({ mesh, x, y }, i) => {
        mesh.position.set(x * width, (1 - y) * height + Math.sin(elapsed * 0.7 + i) * 3, 0);
        mesh.rotation.y = 0.5 + Math.sin(elapsed * 0.35 + i) * 0.15;
      });
      rings.forEach(({ mesh }, i) => mesh.scale.setScalar(1 + Math.sin(elapsed * 1.5 + i) * 0.07));
      renderer.render(scene, camera);
    },
    dispose: () => {
      blockGeometry.dispose();
      ringGeometry.dispose();
      gold.dispose();
      pale.dispose();
      ringMaterial.dispose();
    },
  };
}

/** Keep a mounted surface when paused, so scrolling doesn't churn contexts. */
export default function ConnectionScene({ animate }: { animate: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useThreeCanvas(hostRef, createConnectionScene, animate);
  return <div ref={hostRef} data-connection-scene aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
