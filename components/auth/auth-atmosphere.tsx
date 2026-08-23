"use client";

import { useEffect, useRef } from "react";

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
};

type Rect = { left: number; top: number; right: number; bottom: number };

const COLORS = [
  "rgba(17, 17, 17, 0.16)",
  "rgba(17, 17, 17, 0.10)",
  "rgba(70, 70, 70, 0.14)",
  "rgba(120, 120, 120, 0.12)",
  "rgba(255, 212, 0, 0.22)",
  "rgba(255, 212, 0, 0.14)",
  "rgba(200, 40, 40, 0.14)",
  "rgba(200, 40, 40, 0.09)",
  "rgba(40, 40, 40, 0.11)",
  "rgba(90, 90, 90, 0.13)",
  "rgba(255, 212, 0, 0.10)",
  "rgba(180, 180, 180, 0.16)",
];

/** Fixed size tiers so the 12 balls look clearly different */
const SIZES = [28, 36, 44, 52, 60, 70, 82, 94, 48, 66, 38, 76];

function createBalls(width: number, height: number, count: number): Ball[] {
  return Array.from({ length: count }, (_, i) => {
    const r = SIZES[i % SIZES.length] / 2 + Math.random() * 6;
    const speed = 0.85 + Math.random() * 1.5;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: r + Math.random() * Math.max(1, width - r * 2),
      y: r + Math.random() * Math.max(1, height - r * 2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r,
      color: COLORS[i % COLORS.length],
    };
  });
}

function bounceBalls(a: Ball, b: Ball) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = a.r + b.r;
  if (dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = (minDist - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const impact = dvx * nx + dvy * ny;
  if (impact > 0) return;

  const impulse = impact * 0.92;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;

  const kick = 0.08;
  a.vx += (Math.random() - 0.5) * kick;
  a.vy += (Math.random() - 0.5) * kick;
  b.vx += (Math.random() - 0.5) * kick;
  b.vy += (Math.random() - 0.5) * kick;
}

/** Bounce ball off an axis-aligned obstacle (the login card). */
function bounceOffRect(ball: Ball, rect: Rect) {
  const nearestX = Math.max(rect.left, Math.min(ball.x, rect.right));
  const nearestY = Math.max(rect.top, Math.min(ball.y, rect.bottom));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= ball.r * ball.r) return;

  // Center is inside the card — push out via nearest edge
  if (distSq < 0.0001) {
    const toL = Math.abs(ball.x - rect.left);
    const toR = Math.abs(rect.right - ball.x);
    const toT = Math.abs(ball.y - rect.top);
    const toB = Math.abs(rect.bottom - ball.y);
    const min = Math.min(toL, toR, toT, toB);
    if (min === toL) {
      ball.x = rect.left - ball.r;
      ball.vx = -Math.abs(ball.vx) * (0.95 + Math.random() * 0.1);
    } else if (min === toR) {
      ball.x = rect.right + ball.r;
      ball.vx = Math.abs(ball.vx) * (0.95 + Math.random() * 0.1);
    } else if (min === toT) {
      ball.y = rect.top - ball.r;
      ball.vy = -Math.abs(ball.vy) * (0.95 + Math.random() * 0.1);
    } else {
      ball.y = rect.bottom + ball.r;
      ball.vy = Math.abs(ball.vy) * (0.95 + Math.random() * 0.1);
    }
    return;
  }

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = ball.r - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const impact = ball.vx * nx + ball.vy * ny;
  if (impact < 0) {
    ball.vx -= 2 * impact * nx;
    ball.vy -= 2 * impact * ny;
    ball.vx *= 0.96;
    ball.vy *= 0.96;
  }
}

function readObstacle(canvas: HTMLCanvasElement): Rect | null {
  const el = document.querySelector<HTMLElement>("[data-auth-obstacle]");
  if (!el) return null;
  const c = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    left: r.left - c.left,
    top: r.top - c.top,
    right: r.right - c.left,
    bottom: r.bottom - c.top,
  };
}

/**
 * Animated colliding circles that also bounce off the login card frame.
 */
export function AuthAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let balls: Ball[] = [];
    let obstacle: Rect | null = null;
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      obstacle = readObstacle(canvas);
      balls = createBalls(w, h, reduceMotion ? 8 : 12);
      // Keep balls outside the card on spawn
      if (obstacle) {
        for (const ball of balls) {
          const cx = (obstacle.left + obstacle.right) / 2;
          if (
            ball.x + ball.r > obstacle.left &&
            ball.x - ball.r < obstacle.right &&
            ball.y + ball.r > obstacle.top &&
            ball.y - ball.r < obstacle.bottom
          ) {
            ball.x = ball.x < cx ? obstacle.left - ball.r - 4 : obstacle.right + ball.r + 4;
          }
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(() => {
      obstacle = readObstacle(canvas);
    });
    const panel = document.querySelector("[data-auth-obstacle]");
    if (panel) ro.observe(panel);

    const draw = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      obstacle = readObstacle(canvas);

      ctx.clearRect(0, 0, w, h);

      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#fafafa");
      g.addColorStop(0.45, "#ffffff");
      g.addColorStop(1, "#f3f3f3");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (!reduceMotion) {
        for (const ball of balls) {
          ball.x += ball.vx;
          ball.y += ball.vy;

          if (ball.x - ball.r < 0) {
            ball.x = ball.r;
            ball.vx = Math.abs(ball.vx) * (0.95 + Math.random() * 0.08);
          } else if (ball.x + ball.r > w) {
            ball.x = w - ball.r;
            ball.vx = -Math.abs(ball.vx) * (0.95 + Math.random() * 0.08);
          }

          if (ball.y - ball.r < 0) {
            ball.y = ball.r;
            ball.vy = Math.abs(ball.vy) * (0.95 + Math.random() * 0.08);
          } else if (ball.y + ball.r > h) {
            ball.y = h - ball.r;
            ball.vy = -Math.abs(ball.vy) * (0.95 + Math.random() * 0.08);
          }

          if (obstacle) bounceOffRect(ball, obstacle);

          const speed = Math.hypot(ball.vx, ball.vy);
          if (speed > 3.2) {
            ball.vx = (ball.vx / speed) * 3.2;
            ball.vy = (ball.vy / speed) * 3.2;
          } else if (speed < 0.55) {
            const angle = Math.random() * Math.PI * 2;
            ball.vx = Math.cos(angle) * 1.1;
            ball.vy = Math.sin(angle) * 1.1;
          }
        }

        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            bounceBalls(balls[i], balls[j]);
          }
        }
      }

      for (const ball of balls) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(17, 17, 17, 0.06)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(255,255,255,0.55)_100%)]" />
    </div>
  );
}
