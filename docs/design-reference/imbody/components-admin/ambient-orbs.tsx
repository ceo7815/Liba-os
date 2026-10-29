"use client";

import { useEffect, useRef } from "react";

type Orb = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  freq: number;
  amp: number;
  phase: number;
};

function seed(width: number, height: number): Orb[] {
  const span = Math.min(width, height);
  const compact = width < 640;
  const scale = compact ? 0.55 : 1;
  return [
    { x: width * 0.2, y: height * 0.3, vx: 34, vy: 16, r: span * 0.17 * scale, freq: 0.65, amp: 18, phase: 0.4 },
    { x: width * 0.78, y: height * 0.68, vx: -26, vy: -30, r: span * 0.12 * scale, freq: 1.15, amp: 26, phase: 2.2 },
    { x: width * 0.66, y: height * 0.18, vx: -18, vy: 36, r: span * 0.085 * scale, freq: 1.75, amp: 16, phase: 4.1 },
  ];
}

export function AmbientOrbs() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let orbs: Orb[] = [];
    let frame = 0;
    let running = true;
    let sized = "";

    const fit = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const next = `${width}x${height}@${dpr}`;
      if (next !== sized && width > 0 && height > 0) {
        sized = next;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (orbs.length === 0) orbs = seed(width, height);
      }
      return { width, height };
    };

    const paint = (width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const orb of orbs) {
        const highlightX = orb.x - orb.r * 0.32;
        const highlightY = orb.y - orb.r * 0.36;
        const glass = ctx.createRadialGradient(highlightX, highlightY, orb.r * 0.05, orb.x, orb.y, orb.r);
        glass.addColorStop(0, "rgba(255,255,255,0.5)");
        glass.addColorStop(0.28, "rgba(255,255,255,0.14)");
        glass.addColorStop(0.72, "rgba(255,255,255,0.05)");
        glass.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = glass;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.38)";
        ctx.lineWidth = 1.25;
        ctx.stroke();
        const gleam = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, orb.r * 0.28);
        gleam.addColorStop(0, "rgba(255,255,255,0.7)");
        gleam.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gleam;
        ctx.beginPath();
        ctx.arc(highlightX, highlightY, orb.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (dt: number, now: number, width: number, height: number) => {
      for (const orb of orbs) {
        const speed = Math.hypot(orb.vx, orb.vy) || 1;
        const wave = Math.sin((now / 1000) * orb.freq + orb.phase) * orb.amp;
        const px = -orb.vy / speed;
        const py = orb.vx / speed;
        orb.vx += px * wave * dt;
        orb.vy += py * wave * dt;
        const drag = Math.exp(-0.18 * dt);
        orb.vx *= drag;
        orb.vy *= drag;
        const mag = Math.hypot(orb.vx, orb.vy);
        const cruise = 42;
        const cap = 78;
        if (mag < cruise) {
          orb.vx = (orb.vx / (mag || 1)) * cruise;
          orb.vy = (orb.vy / (mag || 1)) * cruise;
        } else if (mag > cap) {
          orb.vx = (orb.vx / mag) * cap;
          orb.vy = (orb.vy / mag) * cap;
        }
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        if (orb.x < orb.r) {
          orb.x = orb.r;
          orb.vx = Math.abs(orb.vx);
        } else if (orb.x > width - orb.r) {
          orb.x = width - orb.r;
          orb.vx = -Math.abs(orb.vx);
        }
        if (orb.y < orb.r) {
          orb.y = orb.r;
          orb.vy = Math.abs(orb.vy);
        } else if (orb.y > height - orb.r) {
          orb.y = height - orb.r;
          orb.vy = -Math.abs(orb.vy);
        }
      }

      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const a = orbs[i];
          const b = orbs[j];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const min = a.r + b.r;
          if (dist >= min) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (min - dist) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          a.vx -= rel * nx;
          a.vy -= rel * ny;
          b.vx += rel * nx;
          b.vy += rel * ny;
        }
      }
    };

    fit();
    const observer = new ResizeObserver(() => {
      fit();
    });
    observer.observe(canvas);

    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      try {
        const { width, height } = fit();
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        if (width > 0 && height > 0 && orbs.length > 0) {
          step(dt, now, width, height);
          paint(width, height);
        }
      } catch {
        running = false;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onHide = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
        return;
      }
      if (!running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const onReduce = () => {
      if (!reduce.matches) return;
      running = false;
      cancelAnimationFrame(frame);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    document.addEventListener("visibilitychange", onHide);
    reduce.addEventListener("change", onReduce);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      reduce.removeEventListener("change", onReduce);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />;
}
