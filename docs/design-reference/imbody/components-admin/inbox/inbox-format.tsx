"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

const zone = "Asia/Dubai";
const day = 86_400_000;
const kinds = ["image", "audio", "video", "document", "sticker", "location", "contacts", "interactive", "button", "template", "unsupported"];

function tag(locale: string) {
  return locale === "he" ? "he-IL" : "en-GB";
}

function valid(at: string) {
  const date = new Date(at);
  return at && !Number.isNaN(date.getTime()) ? date : null;
}

export function dayKey(at: string) {
  const date = valid(at);
  return date ? new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(date) : "";
}

function daysAgo(at: string, now: number) {
  const then = Date.parse(`${dayKey(at)}T00:00:00Z`);
  const today = Date.parse(`${dayKey(new Date(now).toISOString())}T00:00:00Z`);
  return Math.round((today - then) / day);
}

export function bubbleTime(at: string, locale: string) {
  const date = valid(at);
  return date ? new Intl.DateTimeFormat(tag(locale), { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(date) : "";
}

export function fullTime(at: string, locale: string) {
  const date = valid(at);
  return date ? new Intl.DateTimeFormat(tag(locale), { timeZone: zone, dateStyle: "full", timeStyle: "short" }).format(date) : "";
}

export function dayLabel(at: string, locale: string, now: number) {
  const date = valid(at);
  if (!date) return "";
  const ago = daysAgo(at, now);
  if (ago === 0 || ago === 1) return new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" }).format(-ago, "day");
  if (ago < 7) return new Intl.DateTimeFormat(tag(locale), { timeZone: zone, weekday: "long" }).format(date);
  return new Intl.DateTimeFormat(tag(locale), { timeZone: zone, day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function listTime(at: string, locale: string, now: number) {
  const date = valid(at);
  if (!date) return "";
  const ago = daysAgo(at, now);
  if (ago === 0) return bubbleTime(at, locale);
  if (ago === 1) return new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" }).format(-1, "day");
  if (ago < 7) return new Intl.DateTimeFormat(tag(locale), { timeZone: zone, weekday: "short" }).format(date);
  return new Intl.DateTimeFormat(tag(locale), { timeZone: zone, day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

export function windowLeft(lastInboundAt: string, now: number) {
  const date = valid(lastInboundAt);
  return date ? Math.max(0, date.getTime() + day - now) : 0;
}

export function kindLabel(t: (key: string) => string, kind: string) {
  return t(`kinds.${kinds.includes(kind) ? kind : "unsupported"}`);
}

export function previewText(t: (key: string) => string, preview: string) {
  const match = /^\[(\w+)\]$/.exec(preview);
  return match ? kindLabel(t, match[1]) : preview;
}

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const hues = [152, 200, 24, 280, 340, 48, 176, 230];

export function Avatar({ name, seed, size = "md" }: { name: string; seed: string; size?: "md" | "lg" }) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hues[hash % hues.length];
  const letters = name.startsWith("+")
    ? ""
    : name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => Array.from(word)[0] ?? "")
        .join("")
        .toUpperCase();
  const box = size === "lg" ? "size-16 text-xl" : "size-10 text-sm";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-medium text-white ${box}`}
      style={{ backgroundColor: `oklch(0.58 0.11 ${hue})` }}
    >
      {letters || <UserRound className="size-1/2" />}
    </span>
  );
}
