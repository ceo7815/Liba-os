import { PNG } from "pngjs";

type Rgba = { r: number; g: number; b: number; a: number };

function pixel(data: Buffer, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return {
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  };
}

function colorDist(a: Rgba, b: Rgba) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function sampleCorners(png: PNG): Rgba {
  const { width: w, height: h, data } = png;
  const inset = 2;
  const pts = [
    pixel(data, w, inset, inset),
    pixel(data, w, w - 1 - inset, inset),
    pixel(data, w, inset, h - 1 - inset),
    pixel(data, w, w - 1 - inset, h - 1 - inset),
  ];
  return {
    r: Math.round(pts.reduce((s, p) => s + p.r, 0) / 4),
    g: Math.round(pts.reduce((s, p) => s + p.g, 0) / 4),
    b: Math.round(pts.reduce((s, p) => s + p.b, 0) / 4),
    a: 255,
  };
}

function cornersAgree(png: PNG, bg: Rgba) {
  const { width: w, height: h, data } = png;
  const inset = 2;
  const pts = [
    pixel(data, w, inset, inset),
    pixel(data, w, w - 1 - inset, inset),
    pixel(data, w, inset, h - 1 - inset),
    pixel(data, w, w - 1 - inset, h - 1 - inset),
  ];
  return pts.every((p) => colorDist(p, bg) < 36);
}

function columnHasContent(png: PNG, x: number, bg: Rgba, threshold: number) {
  let hits = 0;
  const need = Math.max(4, Math.floor(png.height * 0.02));
  const step = Math.max(2, Math.floor(png.height / 120));
  for (let y = 0; y < png.height; y += step) {
    if (colorDist(pixel(png.data, png.width, x, y), bg) > threshold) {
      hits += 1;
      if (hits >= need) return true;
    }
  }
  return false;
}

function rowHasContent(png: PNG, y: number, bg: Rgba, threshold: number) {
  let hits = 0;
  const need = Math.max(4, Math.floor(png.width * 0.02));
  const step = Math.max(2, Math.floor(png.width / 120));
  for (let x = 0; x < png.width; x += step) {
    if (colorDist(pixel(png.data, png.width, x, y), bg) > threshold) {
      hits += 1;
      if (hits >= need) return true;
    }
  }
  return false;
}

function trimLetterbox(png: PNG): PNG {
  if (png.width < 32 || png.height < 32) return png;
  const bg = sampleCorners(png);
  if (!cornersAgree(png, bg)) return png;

  const threshold = 28;
  let left = 0;
  let right = png.width - 1;
  let top = 0;
  let bottom = png.height - 1;

  while (left < right && !columnHasContent(png, left, bg, threshold)) left += 1;
  while (right > left && !columnHasContent(png, right, bg, threshold)) right -= 1;
  while (top < bottom && !rowHasContent(png, top, bg, threshold)) top += 1;
  while (bottom > top && !rowHasContent(png, bottom, bg, threshold)) bottom -= 1;

  const pad = 2;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(png.width - 1, right + pad);
  bottom = Math.min(png.height - 1, bottom + pad);

  const cw = right - left + 1;
  const ch = bottom - top + 1;
  if (cw < png.width * 0.45 || ch < png.height * 0.45) return png;
  if (cw >= png.width - 4 && ch >= png.height - 4) return png;

  const out = new PNG({ width: cw, height: ch });
  PNG.bitblt(png, out, left, top, cw, ch, 0, 0);
  return out;
}

/** Crop to target aspect with memcpy only — no per-pixel resample. */
function cropToAspect(png: PNG, aspectW: number, aspectH: number): PNG {
  const target = aspectW / aspectH;
  const src = png.width / png.height;
  let cw = png.width;
  let ch = png.height;
  let x = 0;
  let y = 0;
  if (src > target) {
    cw = Math.max(1, Math.round(png.height * target));
    x = Math.max(0, Math.floor((png.width - cw) / 2));
  } else if (src < target) {
    ch = Math.max(1, Math.round(png.width / target));
    y = Math.max(0, Math.floor((png.height - ch) / 2));
  }
  if (x + cw > png.width) cw = png.width - x;
  if (y + ch > png.height) ch = png.height - y;
  if (cw === png.width && ch === png.height) return png;
  const out = new PNG({ width: cw, height: ch });
  PNG.bitblt(png, out, x, y, cw, ch, 0, 0);
  return out;
}

function yieldEventLoop() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

/** Nearest-neighbor scale, yielding so Docker healthchecks can still pass. */
async function scaleNearest(png: PNG, dw: number, dh: number): Promise<PNG> {
  if (png.width === dw && png.height === dh) return png;
  const out = new PNG({ width: dw, height: dh });
  const xRatio = png.width / dw;
  const yRatio = png.height / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(png.height - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(png.width - 1, Math.floor(x * xRatio));
      const si = (sy * png.width + sx) * 4;
      const di = (y * dw + x) * 4;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
    if (y % 48 === 0) await yieldEventLoop();
  }
  return out;
}

async function placeContainExtend(png: PNG, dw: number, dh: number): Promise<PNG> {
  const scale = Math.min(dw / png.width, dh / png.height);
  const sw = Math.max(1, Math.round(png.width * scale));
  const sh = Math.max(1, Math.round(png.height * scale));
  const scaled = await scaleNearest(png, sw, sh);
  if (sw === dw && sh === dh) return scaled;

  const out = new PNG({ width: dw, height: dh });
  const ox = Math.floor((dw - sw) / 2);
  const oy = Math.floor((dh - sh) / 2);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, y - oy));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, x - ox));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out.data[di] = scaled.data[si];
      out.data[di + 1] = scaled.data[si + 1];
      out.data[di + 2] = scaled.data[si + 2];
      out.data[di + 3] = scaled.data[si + 3];
    }
    if (y % 48 === 0) await yieldEventLoop();
  }
  return out;
}

export async function fitSocialCanvas(
  buffer: Buffer,
  width: number,
  height: number,
  mode: "cover" | "contain" = "cover",
): Promise<Buffer> {
  try {
    const decoded = PNG.sync.read(buffer);
    const trimmed = trimLetterbox(decoded);
    const fitted =
      mode === "contain"
        ? await placeContainExtend(trimmed, width, height)
        : await scaleNearest(cropToAspect(trimmed, width, height), width, height);
    return PNG.sync.write(fitted);
  } catch {
    return buffer;
  }
}
