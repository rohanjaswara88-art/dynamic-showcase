/* Dev-only frame-time probe (not part of the site bundle). In the browser console of `npm run dev`:
     await import('/tools/perf.js');  await __measure(0, 0.02, 0.95, 6000)   // chapter 0, scroll through 2%..95% in 6 s
   It scrolls through a chapter while the pointer sweeps around, and reports requestAnimationFrame intervals in ms.
   Intervals are quantised to the display's refresh period, so on a 144 Hz screen 7 ms means "kept up". */
const stat = (dts) => {
  dts = dts.slice(1);
  const s = [...dts].sort((a, b) => a - b), q = (x) => s[Math.min(s.length - 1, Math.floor(x * s.length))];
  return { n: dts.length, med: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1), over11: dts.filter((d) => d > 11.5).length };
};
window.__idle = async (ms) => {
  const d = []; let l = performance.now(); const t0 = l;
  await new Promise((r) => { const f = (t) => { d.push(t - l); l = t; if (t - t0 > ms) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  return stat(d);
};
window.__measure = async (w, p0, p1, ms, mouse = true) => {
  const D = window.__dss;
  D.go(w, p0); await new Promise((r) => setTimeout(r, 1200));
  const st = D.ScrollTrigger.getById('ch' + w), dts = []; let last = performance.now(); const t0 = last;
  await new Promise((res) => {
    const f = (t) => {
      const e = (t - t0) / ms; dts.push(t - last); last = t;
      if (e >= 1) { res(); return; }
      D.lenis.scrollTo(st.start + (p0 + (p1 - p0) * e) * (st.end - st.start), { immediate: true, force: true }); D.ScrollTrigger.update();
      if (mouse) { const a = e * 20; window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth * 0.5 + Math.cos(a) * innerWidth * 0.25, clientY: innerHeight * 0.5 + Math.sin(a * 1.3) * innerHeight * 0.25, pointerType: 'mouse' })); }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  return { w, vw: innerWidth, vh: innerHeight, ...stat(dts) };
};
