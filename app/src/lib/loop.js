import gsap from 'gsap';

/** One shared frame loop (GSAP's ticker, a single requestAnimationFrame that already pauses in hidden tabs). */
const subs = new Set();
let on = false;
function tick(time, deltaMs) {
  const dt = Math.min(0.1, deltaMs / 1000);
  subs.forEach((fn) => fn(time, dt));
}
export function onFrame(fn) {
  subs.add(fn);
  if (!on) { gsap.ticker.add(tick); on = true; }
  return () => { subs.delete(fn); if (!subs.size) { gsap.ticker.remove(tick); on = false; } };
}
