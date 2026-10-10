"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";
import { useThreeCanvas } from "@/src/components/three/use-three-canvas";
import { usePrefersReducedMotion } from "@/src/lib/use-prefers-reduced-motion";

const YELLOW = "#F4B400";

/** Brand dot wave shared by profile and login panels. Direct Three.js avoids
 * Fiber's deprecated Clock and contexts for CSS-hidden profile cards. */
export function DotWave({ background = "#1C1A17", dense = true, className = "" }: {
  background?: string;
  dense?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const createScene = useCallback((renderer: THREE.WebGLRenderer) => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(background, 4, 13);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 2.4, 6.5);
    camera.lookAt(0, 0, -1);
    const cols = dense ? 120 : 64;
    const rows = dense ? 62 : 38;
    const spacing = dense ? 0.22 : 0.3;
    const positions = new Float32Array(cols * rows * 3);
    let index = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        positions[index++] = (col - (cols - 1) / 2) * spacing;
        positions[index++] = 0;
        positions[index++] = 6 - row * spacing;
      }
    }
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", attribute);
    const material = new THREE.PointsMaterial({ color: YELLOW, size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    return {
      resize: (width: number, height: number) => {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      },
      render: (elapsed: number) => {
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] = Math.sin(positions[i] * 0.42 + elapsed * 0.7) * 0.32 + Math.cos(positions[i + 2] * 0.55 + elapsed * 0.55) * 0.28;
        }
        attribute.needsUpdate = true;
        renderer.render(scene, camera);
      },
      dispose: () => { geometry.dispose(); material.dispose(); },
    };
  }, [background, dense]);

  useThreeCanvas(hostRef, createScene, reducedMotion === false);

  return (
    <div ref={hostRef} data-dot-wave aria-hidden="true" className={`relative overflow-hidden ${className}`}>
      <svg viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {Array.from({ length: 16 }, (_, row) => Array.from({ length: 40 }, (_, col) => (
          <circle key={`${row}-${col}`} cx={col * 17 - 12} cy={row * 14 + Math.sin(col * 0.23 + row * 0.2) * 12} r={0.7 + row * 0.035} fill={YELLOW} opacity={0.08 + row * 0.015} />
        )))}
      </svg>
    </div>
  );
}
