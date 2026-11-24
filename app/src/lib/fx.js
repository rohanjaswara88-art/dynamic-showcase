import { onFrame } from './loop';
import { world } from './world';

/* One fixed 2D canvas above the weapons: additive sprite particles for each weapon's aura and its world's ambient dust,
   lightning arcs for Avarice. About 400 particles at most. */

const POOL = 520;
const sprites = new Map();
function sprite(color, core = 0.9) {
  const key = color + core;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, core > 0 ? `rgba(255,255,255,${core})` : color); gr.addColorStop(0.22, color); gr.addColorStop(0.6, color.replace(/[\d.]+\)$/, '0.25)')); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  sprites.set(key, c); return c;
}
const rnd = (a, b) => a + Math.random() * (b - a);

/* aura + ambient per weapon: [kind, rate/s, parts, params] */
const AURA = [
  /* VORACITY: hellfire. Magenta flame tongues licking up off the blade, mantle and ring, sparks, a few soul wisps */
  { glow: ['rgba(255,90,235,0.6)', 16, 200, 0.24], parts: ['blade', 'blade', 'mantle', 'ring', 'upbind', 'foot'], emit: [['flame', 72], ['spark', 28], ['wisp', 12]], ambient: [['ember', 24, '255,120,230']] },
  /* HALCYON: frost. Cold mist and ice streaks pouring down off the blade and wings, glints */
  { glow: ['rgba(150,225,255,0.55)', 18, 230, 0.2], parts: ['blade', 'blade', 'wings', 'shardsU', 'shardsL', 'core', 'pommel'], emit: [['rain', 22], ['mist', 26], ['glint', 14]], ambient: [['flake', 3]] },
  /* ECLIPSE: dark smoke with a red rim pouring off the steel, motes pulled into the gem */
  { glow: ['rgba(255,30,30,0.55)', 16, 210, 0.26], parts: ['blade', 'blade', 'guard', 'fangsU', 'fangsL', 'pommel'], emit: [['smoke', 18], ['mote', 26]], ambient: [['ember', 10, '255,40,40']] },
  /* AVARICE: storm. Lightning along the veins, violet static, falling gold */
  { glow: ['rgba(170,110,255,0.55)', 16, 200, 0.24], parts: ['blade', 'blade', 'blade', 'guard', 'finsU', 'finsL'], emit: [['static', 36], ['gold', 18]], arcs: 1, ambient: [['dust', 22]] }
];

const LANDING = { parts: [], emit: [], ambient: [['dust', 26, '150,235,210'], ['ember', 9, '140,235,205']] };

export function startFX(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d', { alpha: true });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0;
  function resize() { W = innerWidth; H = innerHeight; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); }
  resize(); addEventListener('resize', resize);

  const P = Array.from({ length: POOL }, () => ({ on: false }));
  let cursor = 0;
  const free = () => { for (let i = 0; i < POOL; i++) { const p = P[(cursor + i) % POOL]; if (!p.on) { cursor = (cursor + i + 1) % POOL; return p; } } return null; };
  const arcs = [];
  const acc = {};
  const budget = () => (world.reduce ? 0.35 : 1);

  function make(kind, x, y, nx, ny, vf, ctl) {
    const p = free(); if (!p) return;
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.t = 0; p.ph = Math.random() * 6.28; p.vx = 0; p.vy = 0; p.g = 0; p.grow = 1; p.add = true; p.a = 0.6; p.size = 20; p.hot = null; p.stretch = 0; p.flow = 0; p.star = false; p.gold = false; p.jit = 0; p.sway = 0;
    switch (kind) {
      case 'wisp': p.sp = sprite('rgba(255,110,240,0.8)', 0.7); p.max = rnd(1.6, 2.8); p.size = rnd(34, 74) * vf; p.a = 0.62; p.vx = nx * 18 + rnd(-14, 14); p.vy = -rnd(40, 95) * vf + ny * 10; p.grow = 1.8; p.sway = rnd(10, 26); break;
      case 'spark': p.sp = sprite('rgba(255,170,250,0.9)', 1); p.max = rnd(0.6, 1.3); p.size = rnd(7, 14) * vf; p.a = 0.95; p.vx = nx * rnd(40, 130) + rnd(-40, 40); p.vy = -rnd(70, 190) * vf; p.grow = 0.3; p.sway = 0; break;
      case 'ember': p.sp = sprite(`rgba(${p.col = ctl}, 0.85)`, 0.8); p.max = rnd(3, 6); p.size = rnd(4, 10) * vf; p.a = 0.8; p.vx = rnd(-20, 20); p.vy = -rnd(40, 140) * vf; p.grow = 0.5; p.sway = rnd(8, 30); break;
      case 'mist': p.sp = sprite('rgba(170,225,255,0.55)', 0.35); p.max = rnd(2.4, 4); p.size = rnd(90, 190) * vf; p.a = 0.2; p.vx = nx * 12 + rnd(-18, 8); p.vy = rnd(38, 92) * vf; p.grow = 1.5; p.sway = rnd(6, 18); break;
      case 'glint': p.sp = sprite('rgba(200,240,255,0.85)', 1); p.max = rnd(0.7, 1.4); p.size = rnd(9, 17) * vf; p.a = 1; p.star = true; p.vx = rnd(-6, 6); p.vy = rnd(6, 24); p.sway = 0; break;
      case 'flake': p.sp = sprite('rgba(230,242,255,0.7)', 0.8); p.max = rnd(4, 7); p.size = rnd(7, 18) * vf; p.a = rnd(0.25, 0.6); p.vx = -rnd(30, 90); p.vy = rnd(80, 190); p.grow = 1; p.sway = rnd(6, 20); p.x = rnd(0, W * 1.3); p.y = -20; break;
      case 'flame': p.hot = sprite('rgba(255,170,250,0.9)', 0.95); p.mid = sprite('rgba(225,60,235,0.8)', 0.4); p.cool = sprite('rgba(110,30,190,0.6)', 0); p.sp = p.hot; p.stretch = 2.1; p.max = rnd(0.9, 1.7); p.size = rnd(30, 62) * vf; p.a = 0.8; p.vx = nx * 26 + rnd(-18, 18); p.vy = -rnd(90, 190) * vf + ny * 14; p.g = -60; p.grow = 0.55; p.sway = rnd(16, 40); p.flow = 1; break;
      case 'rain': p.sp = sprite('rgba(190,235,255,0.85)', 0.7); p.stretch = 2.8; p.max = rnd(1.4, 2.6); p.size = rnd(22, 52) * vf; p.a = 0.4; p.vx = nx * 10 - rnd(4, 24); p.vy = rnd(50, 110) * vf; p.g = 110; p.grow = 0.8; p.sway = rnd(4, 12); p.flow = 0.4; break;
      case 'smoke': p.sp = sprite('rgba(8,5,10,0.9)', 0); p.halo = sprite('rgba(255,30,30,0.5)', 0.2); p.add = false; p.max = rnd(2.6, 4.4); p.size = rnd(60, 130) * vf; p.a = 0.3; p.vx = nx * 14 + rnd(-12, 12); p.vy = -rnd(16, 52) * vf; p.grow = 1.9; p.sway = rnd(6, 18); break;
      case 'mote': { const gp = ctl; p.sp = sprite('rgba(255,50,50,0.85)', 0.9); p.size = rnd(5, 11) * vf; p.a = 0.9; p.max = 4; p.tx = gp[0]; p.ty = gp[1]; p.sway = 0; p.grow = 0.7; p.v = rnd(0.5, 1); const ang = Math.random() * 6.28, r = rnd(0.28, 0.5) * Math.min(W, H); p.x = gp[0] + Math.cos(ang) * r; p.y = gp[1] + Math.sin(ang) * r; p.vx = 0; p.vy = 0; break; }
      case 'static': p.sp = sprite('rgba(190,130,255,0.85)', 0.9); p.max = rnd(0.7, 1.6); p.size = rnd(7, 15) * vf; p.a = 0.95; p.vx = rnd(-50, 50); p.vy = rnd(-50, 30); p.jit = 140; p.sway = 0; p.grow = 0.8; break;
      case 'gold': p.sp = sprite('rgba(255,205,90,0.9)', 1); p.max = rnd(1.6, 3); p.size = rnd(11, 20) * vf; p.a = 1; p.star = true; p.vx = nx * 12 + rnd(-10, 10); p.vy = rnd(8, 40); p.g = 150; p.sway = 0; p.gold = true; break;
      case 'dust': p.sp = sprite(`rgba(${ctl || '255,200,90'},0.8)`, 0.9); p.max = rnd(5, 9); p.size = rnd(3, 7) * vf; p.a = rnd(0.3, 0.8); p.vx = rnd(-25, 10); p.vy = rnd(30, 90); p.sway = rnd(4, 14); p.grow = 1; p.x = rnd(0, W); p.y = -10; break;
      default: p.on = false;
    }
  }

  function arc(ctl, vf) {
    const a = ctl.sample(['blade', 'blade', 'guard', 'finsU']), b = ctl.sample(['blade', 'finsL', 'guard']);
    if (!a) return;
    const out = rnd(70, 220) * vf, ang = Math.atan2(a[3], a[2]) + rnd(-0.9, 0.9);
    let ex = a[0] + Math.cos(ang) * out, ey = a[1] + Math.sin(ang) * out;
    if (b && Math.random() < 0.45) { ex = b[0]; ey = b[1]; if (Math.hypot(ex - a[0], ey - a[1]) > 360 * vf) { ex = a[0] + Math.cos(ang) * out; ey = a[1] + Math.sin(ang) * out; } }
    const pts = [[a[0], a[1]]], n = 7, dx = ex - a[0], dy = ey - a[1], len = Math.hypot(dx, dy) || 1;
    for (let i = 1; i < n; i++) { const j = rnd(-1, 1) * len * 0.12; pts.push([a[0] + dx * i / n + (-dy / len) * j, a[1] + dy * i / n + (dx / len) * j]); }
    pts.push([ex, ey]);
    const branch = [], bi = 2 + ((Math.random() * 3) | 0), bp = pts[bi], ba = ang + rnd(-1, 1), bl = len * rnd(0.3, 0.55);
    branch.push(bp); for (let i = 1; i <= 3; i++) branch.push([bp[0] + Math.cos(ba) * bl * i / 3 + rnd(-8, 8), bp[1] + Math.sin(ba) * bl * i / 3 + rnd(-8, 8)]);
    arcs.push({ pts, branch, t: 0, max: rnd(0.1, 0.22) });
    if (arcs.length > 7) arcs.shift();
  }

  function drawStar(x, y, s, a) {
    ctx.globalAlpha = a; ctx.fillRect(x - s * 1.7, y - 0.6, s * 3.4, 1.2); ctx.fillRect(x - 0.6, y - s * 1.7, 1.2, s * 3.4);
  }

  const off = onFrame((now, dt) => {
    if (window.__dbg && window.__dbg.fx === 0) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (world.cover) return;                    // a full-screen film is showing: nothing to draw over it
    const wi = world.cur, cfg = wi < 0 ? LANDING : AURA[wi] || AURA[0], ctl = world.chapters[wi], vf = Math.max(0.6, Math.min(W, H) / 800), bud = budget();

    /* emit */
    const live = ctl && ctl.visible;
    const rate = (r) => { return r * bud; };
    if (live) {
      cfg.emit.forEach(([kind, r]) => {
        acc[kind] = (acc[kind] || 0) + rate(r) * dt;
        let guard = 0;
        while (acc[kind] >= 1 && guard++ < 4) {
          acc[kind] -= 1;
          if (kind === 'mote') { const g = ctl.partPoint('gem'); if (g) make('mote', 0, 0, 0, 0, vf, g); continue; }
          const s = ctl.sample(cfg.parts); if (s) make(kind, s[0], s[1], s[2], s[3], vf, ctl);
        }
      });
      if (cfg.arcs) { acc.arc = (acc.arc || 0) + dt * (world.reduce ? 2 : 7); if (acc.arc >= 1) { acc.arc = 0; arc(ctl, vf); } }
    }
    cfg.ambient.forEach(([kind, r, col]) => {
      acc[kind] = (acc[kind] || 0) + rate(r) * dt;
      let guard = 0;
      while (acc[kind] >= 1 && guard++ < 3) {
        acc[kind] -= 1;
        if (kind === 'ember') make('ember', rnd(0, W), H + 10, 0, 0, vf, col);
        else make(kind, rnd(0, W), -10, 0, 0, vf, col || null);
      }
    });

    /* update */
    for (let i = 0; i < POOL; i++) {
      const p = P[i]; if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.max) { p.on = false; continue; }
      const u = p.t / p.max;
      if (p.kind === 'mote') {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1;
        const sp = (60 + 260 * u * u) * p.v;
        p.vx += (dx / d * sp - p.vx) * Math.min(1, dt * 3); p.vy += (dy / d * sp - p.vy) * Math.min(1, dt * 3);
        p.vx += (-dy / d) * 40 * dt; p.vy += (dx / d) * 40 * dt;
        if (d < 18) { p.on = false; continue; }
      }
      if (p.jit) { p.vx += rnd(-1, 1) * p.jit * dt * 6; p.vy += rnd(-1, 1) * p.jit * dt * 6; }
      if (p.flow) { const f = Math.sin(p.y * 0.013 + now * 1.4 + p.ph) + Math.sin(p.x * 0.017 - now * 0.9 + p.ph * 2); p.vx += f * dt * 70 * p.flow; }
      if (p.hot) p.sp = u < 0.25 ? p.hot : u < 0.6 ? p.mid : p.cool;
      p.vy += p.g * dt;
      p.x += (p.vx + (p.sway ? Math.sin(p.t * 2.4 + p.ph) * p.sway : 0)) * dt; p.y += p.vy * dt;
      if (p.y > H + 60 || p.x < -80 || p.x > W + 80 || p.y < -80) { p.on = false; }
    }

    /* a continuous glow that hugs the weapon's shape */
    if (live && cfg.glow) {
      const [gc, gn, gs, ga] = cfg.glow, spr = sprite(gc, 0.5), pts = ctl.stable(cfg.parts, gn);
      ctx.globalCompositeOperation = 'lighter';
      pts.forEach((q, k) => {
        const pulse = 0.65 + 0.35 * Math.sin(now * (1.3 + (k % 5) * 0.23) + k * 1.9), sz = gs * vf * (0.8 + 0.3 * Math.sin(now * 0.8 + k)) * Math.min(1.6, 0.6 + ctl.scale() * 0.5);
        ctx.globalAlpha = ga * pulse * (world.reduce ? 0.6 : 1); ctx.drawImage(spr, q[0] - sz / 2, q[1] - sz / 2, sz, sz);
      });
    }

    /* draw: normal-blend smoke first, then everything additive */
    for (let i = 0; i < POOL; i++) {
      const p = P[i]; if (!p.on || p.add) continue;
      const u = p.t / p.max, a = p.a * Math.sin(Math.min(1, u * 6) * 1.5708) * (1 - u), s = p.size * (1 + (p.grow - 1) * u);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.3; ctx.drawImage(p.halo, p.x - s * 0.66, p.y - s * 0.66, s * 1.32, s * 1.32);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.drawImage(p.sp, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < POOL; i++) {
      const p = P[i]; if (!p.on || !p.add) continue;
      const u = p.t / p.max;
      let a;
      if (p.star) a = p.a * Math.sin(u * Math.PI) * (0.55 + 0.45 * Math.sin(p.t * 24 + p.ph));
      else if (p.kind === 'mote') a = p.a * Math.min(1, u * 4) * Math.min(1, Math.hypot(p.tx - p.x, p.ty - p.y) / 60);
      else a = p.a * Math.min(1, u * 5) * (1 - u);
      if (p.kind === 'ember') a *= 0.75 + 0.25 * Math.sin(p.t * 18 + p.ph);
      const s = p.size * (1 + (p.grow - 1) * u);
      ctx.globalAlpha = Math.max(0, a);
      if (p.stretch) {
        const ang = Math.atan2(p.vy, p.vx) - 1.5708, c = Math.cos(ang) * DPR, sn = Math.sin(ang) * DPR;
        ctx.setTransform(c, sn, -sn, c, p.x * DPR, p.y * DPR); ctx.drawImage(p.sp, -s * 0.3, -s * p.stretch * 0.5, s * 0.6, s * p.stretch); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        continue;
      }
      ctx.drawImage(p.sp, p.x - s / 2, p.y - s / 2, s, s);
      if (p.star) { ctx.fillStyle = p.gold ? '#ffe9a8' : '#e8f8ff'; drawStar(p.x, p.y, s * 0.9, Math.max(0, a)); }
    }

    /* lightning */
    if (arcs.length) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = arcs.length - 1; i >= 0; i--) {
        const A = arcs[i]; A.t += dt; if (A.t > A.max) { arcs.splice(i, 1); continue; }
        const f = (1 - A.t / A.max) * (0.6 + 0.4 * Math.random());
        for (const line of [A.pts, A.branch]) {
          ctx.beginPath(); ctx.moveTo(line[0][0], line[0][1]); for (let k = 1; k < line.length; k++) ctx.lineTo(line[k][0], line[k][1]);
          ctx.strokeStyle = 'rgba(160,90,255,1)'; ctx.globalAlpha = 0.16 * f; ctx.lineWidth = 9 * vf; ctx.stroke();
          ctx.strokeStyle = 'rgba(205,160,255,1)'; ctx.globalAlpha = 0.6 * f; ctx.lineWidth = 3 * vf; ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.95 * f; ctx.lineWidth = 1.1 * vf; ctx.stroke();
          if (line === A.branch) break;
        }
      }
    }

    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  });
  return () => { off(); removeEventListener('resize', resize); };
}
