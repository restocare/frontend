"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

export interface ThreeCanvasScene {
  render: (elapsed: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

/** One context per visible surface. Pause offscreen; use a fresh canvas on
 * Strict Mode setup. The underlying SVG survives missing or lost WebGL. */
export function useThreeCanvas(
  hostRef: RefObject<HTMLDivElement | null>,
  createScene: (renderer: THREE.WebGLRenderer) => ThreeCanvasScene,
  animate: boolean,
) {
  const animateRef = useRef(animate);
  const syncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    animateRef.current = animate;
    syncRef.current?.();
  }, [animate]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let canvas: HTMLCanvasElement | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: ThreeCanvasScene | null = null;
    let inView = false;
    let unavailable = false;
    let lost = false;
    let frame: number | null = null;
    let elapsed = 0;
    let lastFrame: number | null = null;
    let width = 0;
    let height = 0;
    let disposed = false;

    const stop = () => {
      if (frame != null) cancelAnimationFrame(frame);
      frame = null;
      lastFrame = null;
    };
    const draw = (time: number) => {
      frame = null;
      if (disposed || lost || !scene) return;
      if (lastFrame == null || time - lastFrame >= 1000 / 30) {
        if (lastFrame != null) elapsed += Math.min((time - lastFrame) / 1000, 0.1);
        lastFrame = time;
        scene.render(elapsed);
      }
      if (animateRef.current) frame = requestAnimationFrame(draw);
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      stop();
      if (canvas) canvas.style.opacity = "0";
      host.dataset.threeStatus = "context-lost";
    };
    const onRestored = () => {
      lost = false;
      scene?.resize(width, height);
      sync();
    };
    const initialize = () => {
      const element = document.createElement("canvas");
      element.setAttribute("aria-hidden", "true");
      element.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0";
      let context: WebGL2RenderingContext | null = null;
      try {
        context = element.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
        if (!context || context.isContextLost()) {
          unavailable = true;
          host.dataset.threeStatus = "unsupported";
          return;
        }
        renderer = new THREE.WebGLRenderer({ canvas: element, context, alpha: true, antialias: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setClearColor(0x000000, 0);
        scene = createScene(renderer);
        canvas = element;
        // Renderer restoration listeners must rebuild GL state first.
        canvas.addEventListener("webglcontextlost", onLost);
        canvas.addEventListener("webglcontextrestored", onRestored);
        host.appendChild(canvas);
      } catch {
        scene?.dispose();
        renderer?.dispose();
        context?.getExtension("WEBGL_lose_context")?.loseContext();
        scene = null;
        renderer = null;
        unavailable = true;
        host.dataset.threeStatus = "unsupported";
      }
    };
    function sync() {
      if (disposed) return;
      const nextWidth = host!.clientWidth;
      const nextHeight = host!.clientHeight;
      if (!inView || !nextWidth || !nextHeight || document.visibilityState !== "visible") {
        stop();
        if (renderer && !lost) host!.dataset.threeStatus = "paused";
        return;
      }
      if (!renderer && !unavailable) initialize();
      if (!renderer || !scene || lost) return;
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        renderer.setSize(width, height, false);
        scene.resize(width, height);
      }
      if (canvas) canvas.style.opacity = "1";
      host!.dataset.threeStatus = animateRef.current ? "running" : "static";
      if (!animateRef.current) {
        stop();
        scene.render(elapsed);
      } else if (frame == null) frame = requestAnimationFrame(draw);
    }
    syncRef.current = sync;
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }, { threshold: 0 });
    const resize = new ResizeObserver(sync);
    intersection.observe(host);
    resize.observe(host);
    document.addEventListener("visibilitychange", sync);

    return () => {
      disposed = true;
      syncRef.current = null;
      stop();
      intersection.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas?.removeEventListener("webglcontextlost", onLost);
      canvas?.removeEventListener("webglcontextrestored", onRestored);
      scene?.dispose();
      // Dispose removes Three's listeners before deliberately releasing GPU
      // context, preventing routine unmounts from logging "Context Lost".
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas?.remove();
      delete host.dataset.threeStatus;
    };
  }, [hostRef, createScene]);
}
