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

function columnHasContent(
  png: PNG,
  x: number,
  bg: Rgba,
  threshold: number,
) {
  let hits = 0;
  const need = Math.max(4, Math.floor(png.height * 0.02));
  for (let y = 0; y < png.height; y += 2) {
    if (colorDist(pixel(png.data, png.width, x, y), bg) > threshold) {
      hits += 1;
      if (hits >= need) return true;
    }
  }
  return false;
}

function rowHasContent(
  png: PNG,
  y: number,
  bg: Rgba,
  threshold: number,
) {
  let hits = 0;
  const need = Math.max(4, Math.floor(png.width * 0.02));
  for (let x = 0; x < png.width; x += 2) {
    if (colorDist(pixel(png.data, png.width, x, y), bg) > threshold) {
      hits += 1;
      if (hits >= need) return true;
    }
  }
  return false;
}

/** Crop uniform letterbox/frame if the model drew a smaller composition on a flat field. */
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

function sampleBilinear(
  data: Buffer,
  sw: number,
  sh: number,
  x: number,
  y: number,
): Rgba {
  const x0 = Math.max(0, Math.min(sw - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(sh - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(sw - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(sh - 1, y0 + 1));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const a = pixel(data, sw, x0, y0);
  const b = pixel(data, sw, x1, y0);
  const c = pixel(data, sw, x0, y1);
  const d = pixel(data, sw, x1, y1);
  const mix = (p: number, q: number, t: number) => p + (q - p) * t;
  return {
    r: mix(mix(a.r, b.r, fx), mix(c.r, d.r, fx), fy),
    g: mix(mix(a.g, b.g, fx), mix(c.g, d.g, fx), fy),
    b: mix(mix(a.b, b.b, fx), mix(c.b, d.b, fx), fy),
    a: mix(mix(a.a, b.a, fx), mix(c.a, d.a, fx), fy),
  };
}

/** Cover-scale so the dest canvas is filled with no padding. */
function coverResize(png: PNG, dw: number, dh: number): PNG {
  const sw = png.width;
  const sh = png.height;
  const scale = Math.max(dw / sw, dh / sh);
  const originX = (sw * scale - dw) / 2;
  const originY = (sh * scale - dh) / 2;
  const out = new PNG({ width: dw, height: dh });

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const src = sampleBilinear(
        png.data,
        sw,
        sh,
        (x + originX) / scale,
        (y + originY) / scale,
      );
      const i = (y * dw + x) * 4;
      out.data[i] = Math.round(src.r);
      out.data[i + 1] = Math.round(src.g);
      out.data[i + 2] = Math.round(src.b);
      out.data[i + 3] = Math.round(src.a);
    }
  }
  return out;
}

export async function fitSocialCanvas(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const decoded = PNG.sync.read(buffer);
  const trimmed = trimLetterbox(decoded);
  const fitted = coverResize(trimmed, width, height);
  return PNG.sync.write(fitted);
}
