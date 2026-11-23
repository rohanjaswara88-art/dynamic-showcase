/* Placing a weapon on the screen. The weapon group is drawn with  translate(x y) rotate(rot) scale(s)  so a sword-space
   point p lands at  (x, y) + s * R(rot) * p. */
export const D2R = Math.PI / 180;

export function toScreen(S, px, py) {
  const a = S.rot * D2R, c = Math.cos(a), si = Math.sin(a);
  return [S.x + S.s * (px * c - py * si), S.y + S.s * (px * si + py * c)];
}
export function toLocal(S, sx, sy) {
  const a = S.rot * D2R, c = Math.cos(a), si = Math.sin(a), dx = (sx - S.x) / S.s, dy = (sy - S.y) / S.s;
  return [dx * c + dy * si, -dx * si + dy * c];
}

/** The pose that fits a cloud of sword-space points into a screen region, at the given rotation. */
export function fitRegion(pts, rot, region, maxS = Infinity) {
  const a = rot * D2R, c = Math.cos(a), si = Math.sin(a);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [px, py] of pts) {
    const rx = px * c - py * si, ry = px * si + py * c;
    if (rx < x0) x0 = rx; if (rx > x1) x1 = rx; if (ry < y0) y0 = ry; if (ry > y1) y1 = ry;
  }
  const s = Math.min(region.w / Math.max(1, x1 - x0), region.h / Math.max(1, y1 - y0), maxS);
  return { rot, s, x: region.x + region.w / 2 - s * (x0 + x1) / 2, y: region.y + region.h / 2 - s * (y0 + y1) / 2 };
}

/** corner points of every part's box, with each part shifted by `ex` of its explode offset */
export function cloud(parts, bb, ex) {
  const o = [];
  parts.forEach((p) => {
    const b = bb[p.id]; if (!b) return;
    const dx = p.ex[0] * ex, dy = p.ex[1] * ex;
    o.push([b.x + dx, b.y + dy], [b.x + b.w + dx, b.y + dy], [b.x + dx, b.y + b.h + dy], [b.x + b.w + dx, b.y + b.h + dy]);
  });
  return o;
}
export const windowPts = (cx, cy, w, h) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2], [cx + w / 2, cy + h / 2]];

const R = (W, H, x, y, w, h) => ({ x: W * x, y: H * y, w: W * w, h: H * h });

/** hero / overview / lore poses and a camera for each part, for this screen size */
export function layoutPoses(W, H, data, bb) {
  const land = W / H > 0.95, parts = data.parts;
  const pad = Math.max(10, Math.min(W, H) * 0.025);
  const regions = land
    ? { hero: R(W, H, 0.2, 0.1, 0.78, 0.8), over: R(W, H, 0.04, 0.22, 0.92, 0.56), focus: R(W, H, 0.04, 0.14, 0.55, 0.72), lore: R(W, H, 0.03, 0.1, 0.5, 0.8) }
    : { hero: R(W, H, 0.04, 0.16, 0.92, 0.7), over: R(W, H, 0.34, 0.1, 0.32, 0.8), focus: R(W, H, 0.04, 0.09, 0.92, 0.44), lore: R(W, H, 0.08, 0.07, 0.84, 0.44) };
  const inset = (r) => ({ x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 });
  const hr = land ? data.hero.land : data.hero.port, or = land ? data.over.land : data.over.port;
  const whole = cloud(parts, bb, 0), apart = cloud(parts, bb, 1);
  const hero = fitRegion(whole, hr, inset(regions.hero));
  const over = fitRegion(apart, or, inset(regions.over));
  const lore = fitRegion(whole, hr, inset(regions.lore));
  const focusRot = or;
  const cams = parts.map((p) => {
    const b = bb[p.id], dx = p.ex[0], dy = p.ex[1];
    let cx = b.x + b.w / 2 + dx, cy = b.y + b.h / 2 + dy, w = Math.max(b.w * 1.25, 170), h = Math.max(b.h * 1.25, 170);
    if (p.focus) { cx = p.focus[0] + dx; cy = p.focus[1] + dy; w = p.focus[2]; h = p.focus[2] * 0.6; }
    return fitRegion(windowPts(cx, cy, w, h), focusRot, inset(regions.focus), over.s * 9);
  });
  const sc = apart.map(([x, y]) => toScreen(over, x, y));
  const box = { x0: Math.min(...sc.map((q) => q[0])), x1: Math.max(...sc.map((q) => q[0])), y0: Math.min(...sc.map((q) => q[1])), y1: Math.max(...sc.map((q) => q[1])) };
  return { land, hero, over, lore, cams, box };
}
