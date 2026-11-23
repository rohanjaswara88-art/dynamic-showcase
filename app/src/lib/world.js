import { finePointer, reduceMotion } from './anim';

/* Shared, mutable state that the canvases, the weapon stage and the cursor all read.
   Positions are viewport pixels. */
export const world = {
  cur: -1,                        // active chapter (drives environment + aura)
  fine: true, reduce: false,
  mx: -9999, my: -9999,           // raw pointer
  px: -9999, py: -9999,           // smoothed pointer
  lx: -9999, ly: -9999, lightOn: 0,   // the point the weapon is lit from (pointer, or the scan on touch screens)
  speed: 0, heat: 0,              // px/s, smoothed 0..1
  trail: [],                      // {x,y,t,s} points the shader turns into heat
  pulses: [],                     // {x,y,t,s} expanding thermal rings
  over: null, nature: 0,          // part id under the pointer, and the smoothed "nature revealed" amount
  chapters: [], go: {},                   // per-chapter controllers (see Chapter.jsx)
  flash: 0,                       // lightning flash, 0..1
  lastMove: 0,
  tint: [0.55, 0.42, 0.2],        // colour the landing fog leans toward
};

const MAX_TRAIL = 16, MAX_PULSE = 4;
export function addTrail(x, y, s, now) {
  world.trail.push({ x, y, t: now, s });
  if (world.trail.length > MAX_TRAIL) world.trail.shift();
}
export function addPulse(x, y, s, now) {
  world.pulses.push({ x, y, t: now, s });
  if (world.pulses.length > MAX_PULSE) world.pulses.shift();
}

let lastX = 0, lastY = 0, lastT = 0, lastRing = 0, started = false;
export function initPointer() {
  if (started) return () => {};
  started = true;
  world.fine = finePointer(); world.reduce = reduceMotion();
  const now = () => performance.now() / 1000;
  const move = (e) => {
    if (e.pointerType === 'touch') world.fine = false;
    else world.fine = finePointer();
    const t = now(), x = e.clientX, y = e.clientY;
    const dt = Math.max(0.008, t - lastT);
    const v = Math.hypot(x - lastX, y - lastY) / dt;
    if (lastT) world.speed += (Math.min(v, 4000) - world.speed) * 0.35;
    if (world.px < -9000) { world.px = x; world.py = y; }
    world.mx = x; world.my = y; world.lastMove = t;
    if (Math.hypot(x - lastX, y - lastY) > 7 || !lastT) { addTrail(x, y, Math.min(1, 0.25 + v / 1800), t); lastX = x; lastY = y; }
    if (v > 260 && t - lastRing > 0.16) { addPulse(x, y, Math.min(1, 0.4 + v / 2500), t); lastRing = t; }
    lastT = t;
  };
  const down = (e) => { move(e); addPulse(e.clientX, e.clientY, 1, now()); lastRing = now(); };
  const leave = () => { world.mx = -9999; world.my = -9999; };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', down, { passive: true });
  document.addEventListener('pointerleave', leave);
  document.documentElement.addEventListener('mouseleave', leave);
  return () => {
    started = false;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down);
    document.removeEventListener('pointerleave', leave); document.documentElement.removeEventListener('mouseleave', leave);
  };
}
