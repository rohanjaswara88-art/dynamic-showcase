/* Tiny path kit. Everything is drawn in "sword space": long axis along +x, pommel / butt at x = 0, y = 0 on the axis. */
export const f = (n) => Math.round(n * 10) / 10;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const rng = (seed = 1) => {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};
const pt = (p) => f(p[0]) + ' ' + f(p[1]);

export const poly = (pts, close = true) => 'M' + pts.map(pt).join('L') + (close ? 'Z' : '');

/** Catmull-Rom through the points, written as cubic segments (no leading M). */
export function smoothSeg(pts, close = false, k = 1 / 6) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p0 = pts[close ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[close ? (i + 2) % n : Math.min(n - 1, i + 2)];
    d += 'C' + pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k]) + ' ' + pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k]) + ' ' + pt(p2);
  }
  return d;
}
export const curve = (pts, close = false) => 'M' + pt(pts[0]) + smoothSeg(pts, close) + (close ? 'Z' : '');

export function bez2(a, b, c, n = 80) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]);
  }
  return o;
}
export function bez3(a, b, c, d, n = 80) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return o;
}
/** dense points through a Catmull-Rom spline */
export function sampleCR(pts, per = 14) {
  const o = [], n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      o.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  o.push(pts[n - 1]);
  return o;
}

/** A centre-line: resampled by arc length, with tangent / normal lookups by t in 0..1. Normal = (-ty, tx), so for a line running +x the normal is +y. */
export function makeLine(src, N = 200) {
  const cum = [0];
  for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const len = cum[cum.length - 1], p = [];
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const d = (i / N) * len;
    while (j < src.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1, u = (d - cum[j]) / seg;
    p.push([lerp(src[j][0], src[j + 1][0], u), lerp(src[j][1], src[j + 1][1], u)]);
  }
  const at = (t) => {
    const x = clamp01(t) * N, i = Math.min(N - 1, Math.floor(x)), u = x - i;
    const a = p[i], b = p[i + 1], a0 = p[Math.max(0, i - 1)], b1 = p[Math.min(N, i + 2)];
    let tx = (b1[0] - a0[0]), ty = (b1[1] - a0[1]);
    const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), tx, ty, nx: -ty, ny: tx, ang: Math.atan2(ty, tx) };
  };
  return { p, len, at };
}

const val = (o, t) => (typeof o === 'function' ? o(t) : o);
/** The shape between two offsets (px, along the normal) of a centre-line over t0..t1. */
export function strip(cl, o1, o2, { t0 = 0, t1 = 1, n = 40 } = {}) {
  const A = [], B = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n), c = cl.at(t), a = val(o1, t), b = val(o2, t);
    A.push([c.x + c.nx * a, c.y + c.ny * a]);
    B.push([c.x + c.nx * b, c.y + c.ny * b]);
  }
  const Br = B.reverse();
  return 'M' + pt(A[0]) + smoothSeg(A) + 'L' + pt(Br[0]) + smoothSeg(Br) + 'Z';
}
/** wa on the +normal side, wb on the other */
export const ribbon = (cl, wa, wb, opt) => strip(cl, wa, typeof wb === 'function' ? (t) => -wb(t) : -wb, opt);
/** an open line at an offset */
export function edge(cl, o, { t0 = 0, t1 = 1, n = 40 } = {}) {
  const A = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n), c = cl.at(t), a = val(o, t);
    A.push([c.x + c.nx * a, c.y + c.ny * a]);
  }
  return 'M' + pt(A[0]) + smoothSeg(A);
}
export function onLine(cl, t, o = 0) {
  const c = cl.at(t);
  return { x: c.x + c.nx * o, y: c.y + c.ny * o, ang: c.ang, nx: c.nx, ny: c.ny, tx: c.tx, ty: c.ty };
}

/** a curved thorn: base centred on (x,y), pointing along `ang` (radians) */
export function spike(x, y, ang, len, base, bend = 0.2) {
  const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
  const b1 = [x + (px * base) / 2, y + (py * base) / 2], b2 = [x - (px * base) / 2, y - (py * base) / 2];
  const tip = [x + c * len + px * len * bend, y + s * len + py * len * bend];
  const m1 = [x + c * len * 0.5 + px * (base * 0.36 + bend * len * 0.45), y + s * len * 0.5 + py * (base * 0.36 + bend * len * 0.45)];
  const m2 = [x + c * len * 0.5 + px * (-base * 0.36 + bend * len * 0.45), y + s * len * 0.5 + py * (-base * 0.36 + bend * len * 0.45)];
  return 'M' + pt(b1) + 'Q' + pt(m1) + ' ' + pt(tip) + 'Q' + pt(m2) + ' ' + pt(b2) + 'Z';
}
export function ellipse(cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), a = [cx - c * rx, cy - s * rx], b = [cx + c * rx, cy + s * rx], deg = (rot * 180) / Math.PI;
  return `M${pt(a)}A${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${pt(b)}A${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${pt(a)}Z`;
}
export const circle = (cx, cy, r) => ellipse(cx, cy, r, r, 0);
export const rad = (d) => (d * Math.PI) / 180;
export const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
/** a symmetric kite / leaf polygon along +x from x0 to x1 with max half-width w at fraction k */
export const leaf = (x0, x1, w, k = 0.4, y = 0) => poly([[x0, y], [lerp(x0, x1, k), y - w], [x1, y], [lerp(x0, x1, k), y + w]]);
