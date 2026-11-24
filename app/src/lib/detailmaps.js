import * as THREE from 'three';

/* Procedural micro-detail for the metal: a tileable normal map per surface kind, made once in JS so no image files ship and nothing is blurry (it is
   mip-mapped and anisotropically filtered like any texture). The weapon meshes get planar UVs from their own positions, so this tiles evenly. */
const hash = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const wrap = (a, p) => ((a % p) + p) % p;
const smooth = (t) => t * t * (3 - 2 * t);

/** tileable value noise, `px` x `py` cells across the texture */
function vnoise(u, v, px, py, s) {
  const x = u * px, y = v * py, xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash(wrap(xi, px), wrap(yi, py), s), b = hash(wrap(xi + 1, px), wrap(yi, py), s), c = hash(wrap(xi, px), wrap(yi + 1, py), s), d = hash(wrap(xi + 1, px), wrap(yi + 1, py), s);
  const top = a + (b - a) * fx, bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}

const KINDS = {
  /* long fine streaks along the weapon's length, a little grain: ground and brushed steel */
  brushed: (u, v) => 0.55 * vnoise(u, v, 340, 7, 1) + 0.3 * vnoise(u, v, 140, 3, 2) + 0.15 * vnoise(u, v, 512, 512, 3),
  /* soft overlapping dimples: hammered, forged iron */
  hammered: (u, v) => { let m = 1e9; const n = 16, x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = xi + i, cy = yi + j, px = wrap(cx, n), py = wrap(cy, n), fx = cx + hash(px, py, 5), fy = cy + hash(px, py, 6); m = Math.min(m, Math.hypot(x - fx, y - fy)); } return 0.8 * smooth(Math.min(1, m * 1.15)) + 0.2 * vnoise(u, v, 256, 256, 7); },
  /* crystalline frost: fine multi-scale noise */
  frost: (u, v) => 0.4 * vnoise(u, v, 64, 64, 11) + 0.3 * vnoise(u, v, 160, 160, 12) + 0.2 * vnoise(u, v, 340, 340, 13) + 0.1 * vnoise(u, v, 512, 512, 14),
  /* a fine engraved diamond lattice over a little grain */
  etched: (u, v) => { const a = Math.abs(((u + v) * 24) % 1 - 0.5), b = Math.abs(((u - v) * 24) % 1 - 0.5); const line = Math.min(a, b); return 0.75 * smooth(Math.min(1, line * 9)) + 0.25 * vnoise(u, v, 400, 400, 21); }
};

const cache = new Map();

/** a mip-mapped, anisotropic normal map of the given kind. `strength` is how steep the relief is */
export function detailNormalMap(kind, renderer, N = 1024, strength = 2.4) {
  const key = kind + N;
  if (cache.has(key)) return cache.get(key);
  const f = KINDS[kind] || KINDS.brushed, h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = f(i / N, j / N);
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const l = h[j * N + wrap(i - 1, N)], r = h[j * N + wrap(i + 1, N)], d = h[wrap(j - 1, N) * N + i], u = h[wrap(j + 1, N) * N + i];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
    const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
    const o = (j * N + i) * 4;
    data[o] = (nx * 0.5 + 0.5) * 255; data[o + 1] = (ny * 0.5 + 0.5) * 255; data[o + 2] = (nz * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
