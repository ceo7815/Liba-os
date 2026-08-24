"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SaleAlert } from "@/lib/sales-dashboard/types";

const CELEB_COLORS = [
  "#ffd400",
  "#111111",
  "#c41e3a",
  "#1b2a4a",
  "#ffffff",
  "#f4f4f1",
];

type FwPart = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
};

type Firework = {
  x: number;
  y: number;
  ty: number;
  vy: number;
  exploded: boolean;
  color: string;
  parts: FwPart[];
};

type Confetti = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rv: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
  shape: "rect" | "circle";
};

function createAudioContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function playWinSound() {
  try {
    const ctx = createAudioContext();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(master);
    o.type = "sine";
    o.frequency.setValueAtTime(180, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.35);
    g.gain.setValueAtTime(1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);

    (
      [
        [261.63, 0, 0.05],
        [329.63, 0.12, 0.05],
        [392, 0.24, 0.05],
        [523.25, 0.36, 0.05],
        [659.25, 0.48, 0.08],
        [783.99, 0.58, 0.08],
        [1046.5, 0.68, 0.12],
      ] as const
    ).forEach(([f, t, a]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = "sawtooth";
      osc.frequency.value = f;
      const s = ctx.currentTime + t;
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(a, s + 0.04);
      gain.gain.setValueAtTime(a, s + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, s + 0.55);
      osc.start(s);
      osc.stop(s + 0.6);
    });
  } catch {
    /* ignore autoplay blocks */
  }
}

export function playChaChingSound() {
  try {
    const ctx = createAudioContext();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    const bufLen = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 3500;
    nf.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.value = 1.2;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    noise.start(ctx.currentTime);

    (
      [
        [3520, 0, 1.8, 1],
        [5280, 0.005, 1.4, 0.6],
        [7040, 0.008, 1, 0.35],
        [1760, 0, 0.5, 0.5],
      ] as const
    ).forEach(([f, t, dur, vol]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = "triangle";
      osc.frequency.value = f;
      const s = ctx.currentTime + t;
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(vol, s + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.05);
    });
  } catch {
    /* ignore */
  }
}

export function speakAnnouncement(agent: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  function doSpeak() {
    const voices = window.speechSynthesis.getVoices();
    const heVoice =
      voices.find((v) => v.lang?.toLowerCase().startsWith("he")) ||
      voices.find((v) => /hebrew|carmit|asaf|rafi|dan|shira/i.test(v.name || ""));
    const text = agent
      ? `הופקה מכירה בהצלחה! כל הכבוד ל${agent}!`
      : "הופקה מכירה בהצלחה! כל הכבוד לצוות!";
    const u = new SpeechSynthesisUtterance(text);
    u.volume = 1;
    u.rate = 0.95;
    u.pitch = 1.25;
    if (heVoice) {
      u.voice = heVoice;
      u.lang = "he-IL";
    }
    window.speechSynthesis.speak(u);
  }

  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else {
    window.speechSynthesis.onvoiceschanged = doSpeak;
    window.setTimeout(doSpeak, 400);
  }
}

export function speakTest() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance("בדיקת קול! המערכת עובדת!");
  u.volume = 1;
  u.rate = 0.95;
  u.pitch = 1.25;
  const voices = window.speechSynthesis.getVoices();
  const heVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("he"));
  if (heVoice) {
    u.voice = heVoice;
    u.lang = "he-IL";
  }
  window.speechSynthesis.speak(u);
}

type SalesCelebrationProps = {
  alert: SaleAlert | null;
  onClose: () => void;
};

export function SalesCelebration({ alert, onClose }: SalesCelebrationProps) {
  const fwRef = useRef<HTMLCanvasElement>(null);
  const confRef = useRef<HTMLCanvasElement>(null);
  const [premiumText, setPremiumText] = useState("0₪");
  const [countdown, setCountdown] = useState(10);

  const stopFx = useCallback(() => {
    const fw = fwRef.current;
    const conf = confRef.current;
    if (fw) {
      const ctx = fw.getContext("2d");
      ctx?.clearRect(0, 0, fw.width, fw.height);
    }
    if (conf) {
      const ctx = conf.getContext("2d");
      ctx?.clearRect(0, 0, conf.width, conf.height);
    }
  }, []);

  useEffect(() => {
    if (!alert) {
      stopFx();
      return;
    }

    setPremiumText("0₪");
    setCountdown(10);

    let winTimer = 0;
    let voiceTimer = 0;
    let fwInterval = 0;
    let raf = 0;
    let fwRunning = false;
    const resize = () => {
      const fwCanvas = fwRef.current;
      const confCanvas = confRef.current;
      if (!fwCanvas || !confCanvas) return;
      fwCanvas.width = window.innerWidth;
      fwCanvas.height = window.innerHeight;
      confCanvas.width = window.innerWidth;
      confCanvas.height = window.innerHeight;
    };

    const countInterval = window.setInterval(() => {
      setCountdown((secs) => {
        if (secs <= 1) {
          window.clearInterval(countInterval);
          onClose();
          return 0;
        }
        return secs - 1;
      });
    }, 1000);

    try {
      playChaChingSound();
      winTimer = window.setTimeout(() => {
        try {
          playWinSound();
        } catch {
          /* ignore autoplay */
        }
      }, 300);
      voiceTimer = window.setTimeout(() => {
        try {
          speakAnnouncement(alert.agent);
        } catch {
          /* ignore speech */
        }
      }, 1600);

      const fwCanvas = fwRef.current;
      const confCanvas = confRef.current;
      if (fwCanvas && confCanvas) {
        resize();
        window.addEventListener("resize", resize);

        const fwList: Firework[] = [];
        fwRunning = true;
        const launch = () => {
          fwList.push({
            x: Math.random() * fwCanvas.width,
            y: fwCanvas.height,
            ty: fwCanvas.height * (0.1 + Math.random() * 0.45),
            vy: -(12 + Math.random() * 8),
            exploded: false,
            color: CELEB_COLORS[Math.floor(Math.random() * CELEB_COLORS.length)]!,
            parts: [],
          });
        };
        launch();
        launch();
        fwInterval = window.setInterval(() => {
          launch();
          if (Math.random() > 0.4) launch();
        }, 500);

        const fwCtx = fwCanvas.getContext("2d");
        const animFw = () => {
          if (!fwCtx) return;
          try {
            fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
            fwList.forEach((f) => {
              if (!f.exploded) {
                f.y += f.vy;
                f.vy += 0.25;
                fwCtx.beginPath();
                fwCtx.arc(f.x, f.y, 3, 0, Math.PI * 2);
                fwCtx.fillStyle = f.color;
                fwCtx.fill();
                if (f.y <= f.ty) {
                  f.exploded = true;
                  for (let i = 0; i < 120; i++) {
                    const a = ((Math.PI * 2) / 120) * i + Math.random() * 0.15;
                    const spd = Math.random() * 9 + 2;
                    f.parts.push({
                      x: f.x,
                      y: f.y,
                      vx: Math.cos(a) * spd,
                      vy: Math.sin(a) * spd,
                      alpha: 1,
                      color:
                        Math.random() > 0.3
                          ? f.color
                          : CELEB_COLORS[Math.floor(Math.random() * CELEB_COLORS.length)]!,
                      size: Math.random() * 3 + 1,
                    });
                  }
                }
              } else {
                f.parts.forEach((p) => {
                  p.x += p.vx;
                  p.y += p.vy;
                  p.vy += 0.09;
                  p.vx *= 0.97;
                  p.alpha -= 0.016;
                  fwCtx.save();
                  fwCtx.globalAlpha = Math.max(0, p.alpha);
                  fwCtx.beginPath();
                  fwCtx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
                  fwCtx.fillStyle = p.color;
                  fwCtx.fill();
                  fwCtx.restore();
                });
                f.parts = f.parts.filter((p) => p.alpha > 0);
              }
            });
            for (let i = fwList.length - 1; i >= 0; i--) {
              const f = fwList[i]!;
              if (f.exploded && f.parts.length === 0) fwList.splice(i, 1);
            }
            if (fwRunning || fwList.length > 0) requestAnimationFrame(animFw);
            else fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
          } catch {
            fwRunning = false;
          }
        };
        animFw();

        const confCtx = confCanvas.getContext("2d");
        const confParticles: Confetti[] = [];
        for (let i = 0; i < 300; i++) {
          const side = Math.random() > 0.5;
          confParticles.push({
            x: side ? -10 : confCanvas.width + 10,
            y: Math.random() * confCanvas.height * 0.4,
            vx: (side ? 1 : -1) * (Math.random() * 10 + 4),
            vy: Math.random() * 6 + 2,
            rot: Math.random() * 360,
            rv: (Math.random() - 0.5) * 14,
            w: Math.random() * 16 + 6,
            h: Math.random() * 8 + 4,
            color: CELEB_COLORS[Math.floor(Math.random() * CELEB_COLORS.length)]!,
            alpha: 1,
            shape: Math.random() > 0.4 ? "rect" : "circle",
          });
        }
        for (let i = 0; i < 200; i++) {
          confParticles.push({
            x: Math.random() * confCanvas.width,
            y: -20 - Math.random() * 100,
            vx: (Math.random() - 0.5) * 6,
            vy: Math.random() * 7 + 3,
            rot: Math.random() * 360,
            rv: (Math.random() - 0.5) * 12,
            w: Math.random() * 14 + 5,
            h: Math.random() * 7 + 3,
            color: CELEB_COLORS[Math.floor(Math.random() * CELEB_COLORS.length)]!,
            alpha: 1,
            shape: Math.random() > 0.4 ? "rect" : "circle",
          });
        }
        const animConf = () => {
          if (!confCtx) return;
          try {
            confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height);
            confParticles.forEach((p) => {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.08;
              p.rot += p.rv;
              p.vx *= 0.99;
              if (p.y > confCanvas.height * 0.7) p.alpha -= 0.018;
              confCtx.save();
              confCtx.globalAlpha = Math.max(0, p.alpha);
              confCtx.translate(p.x, p.y);
              confCtx.rotate((p.rot * Math.PI) / 180);
              confCtx.fillStyle = p.color;
              if (p.shape === "circle") {
                confCtx.beginPath();
                confCtx.arc(0, 0, Math.max(0.1, p.w / 2), 0, Math.PI * 2);
                confCtx.fill();
              } else {
                confCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
              }
              confCtx.restore();
            });
            for (let i = confParticles.length - 1; i >= 0; i--) {
              if (confParticles[i]!.alpha <= 0.01) confParticles.splice(i, 1);
            }
            if (confParticles.length > 0) requestAnimationFrame(animConf);
            else confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height);
          } catch {
            /* ignore */
          }
        };
        animConf();
      }

      const target = alert.premium;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / 1800, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setPremiumText(`${Math.round(target * ease).toLocaleString("he-IL")}₪`);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    } catch {
      /* overlay remains visible even if FX fail */
    }

    return () => {
      fwRunning = false;
      window.clearTimeout(winTimer);
      window.clearTimeout(voiceTimer);
      window.clearInterval(fwInterval);
      window.clearInterval(countInterval);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      stopFx();
    };
  }, [alert, onClose, stopFx]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <canvas ref={fwRef} className="sales-tv-fx fw" />
      <canvas ref={confRef} className="sales-tv-fx conf" />
    </>,
    document.body,
  );
}
