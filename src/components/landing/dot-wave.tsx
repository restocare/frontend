"use client";

/**
 * A field of brand-yellow dots rolling like a slow wave, seen from a low
 * angle so it fades into the distance. Used as the backdrop of dark brand
 * panels (e.g. the login page). Load it with next/dynamic and `ssr: false`:
 * it needs WebGL and keeps three.js out of the first paint.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { BufferAttribute, Points } from "three";

const YELLOW = "#F4B400";

function Wave({
  cols,
  rows,
  spacing,
  animate,
}: {
  cols: number;
  rows: number;
  spacing: number;
  animate: boolean;
}) {
  const ref = useRef<Points>(null);

  // Flat grid on the XZ plane; Y is filled in by the wave. The near edge
  // sits just in front of the camera so the field never shows a border.
  const positions = useMemo(() => {
    const arr = new Float32Array(cols * rows * 3);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        arr[i++] = (c - (cols - 1) / 2) * spacing;
        arr[i++] = 0;
        arr[i++] = 6 - r * spacing;
      }
    }
    return arr;
  }, [cols, rows, spacing]);

  useFrame(({ clock, pointer, camera }) => {
    const points = ref.current;
    if (!points) return;
    const t = animate ? clock.elapsedTime : 0;
    const attr = points.geometry.attributes.position as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i];
      const z = arr[i + 2];
      arr[i + 1] =
        Math.sin(x * 0.42 + t * 0.7) * 0.32 + Math.cos(z * 0.55 + t * 0.55) * 0.28;
    }
    attr.needsUpdate = true;

    // Gentle parallax towards the pointer.
    if (animate) {
      camera.position.x += (pointer.x * 1.1 - camera.position.x) * 0.03;
      camera.position.y += (2.4 + pointer.y * 0.4 - camera.position.y) * 0.03;
    }
    camera.lookAt(0, 0, -1);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={YELLOW}
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}

export function DotWave({
  /** Matches the panel colour so far dots fade into it. */
  background = "#1C1A17",
  dense = true,
  className = "",
}: {
  background?: string;
  dense?: boolean;
  className?: string;
}) {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAnimate(!mq.matches);
    queueMicrotask(sync);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 2.4, 6.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        frameloop={animate ? "always" : "demand"}
      >
        <fog attach="fog" args={[background, 4, 13]} />
        <Wave
          cols={dense ? 120 : 64}
          rows={dense ? 62 : 38}
          spacing={dense ? 0.22 : 0.3}
          animate={animate}
        />
      </Canvas>
    </div>
  );
}
