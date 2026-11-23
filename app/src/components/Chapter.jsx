import { useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import DecryptedText from './rb/DecryptedText/DecryptedText';
import ShinyText from './rb/ShinyText';
import { world } from '../lib/world';
import { scroller } from '../lib/scroll';
import { reduceMotion, clamp, smooth } from '../lib/anim';
import { layoutPoses, toScreen, toLocal, D2R } from '../lib/pose';

const ROMAN = ['I', 'II', 'III', 'IV'];
const FS = 0.29, FE = 0.79;
const SAMPLES = 90;

/* sample points (with outward normals) along every silhouette of every part */
function samplePoints(wid, parts) {
  const out = {};
  parts.forEach((p) => {
    const g = document.getElementById(`s-${wid}-${p.id}`), list = [];
    if (!g) return;
    const paths = [...g.querySelectorAll('path')], lens = paths.map((el) => el.getTotalLength()), tot = lens.reduce((a, b) => a + b, 0) || 1;
    paths.forEach((el, k) => {
      const n = Math.max(6, Math.round((SAMPLES * lens[k]) / tot));
      for (let i = 0; i < n; i++) {
        const d = (i / n) * lens[k], a = el.getPointAtLength(d), b = el.getPointAtLength(Math.min(lens[k], d + 2));
        const tx = b.x - a.x, ty = b.y - a.y, m = Math.hypot(tx, ty) || 1;
        list.push([a.x, a.y, ty / m, -tx / m]);
      }
    });
    out[p.id] = list;
  });
  return out;
}

export default function Chapter({ index, data, Art, revealed }) {
  const section = useRef(null), stage = useRef(null), svg = useRef(null), leaders = useRef(null), nameEl = useRef(null);
  const heroBack = useRef(null), heroFront = useRef(null), loreEl = useRef(null), kids = useRef({}).current;
  const reg = useRef({}).current, labs = useRef([]), lines = useRef([]);
  const [active, setActive] = useState(-1);
  const [reduced] = useState(reduceMotion);
  const regFn = useCallback((k, el) => { reg[k] = el; }, [reg]);
  const parts = data.parts, n = parts.length;

  useLayoutEffect(() => {
    const reduce = reduceMotion();
    const S = { x: 0, y: 0, rot: -50, s: 1, ex: 0, hero: 1, lab: 0, fm: 0, lore: 0 };
    const op = {}, hidden = {}, shown = {};
    let W = 1, H = 1, P = null, tl = null, st = null, activeNow = -1, poseDirty = true, visible = false, labsOn = false, ox = 0, oy = 0;
    const bb = {};

    parts.forEach((p) => {
      const b = reg['body:' + p.id].getBBox();
      bb[p.id] = { x: b.x - 4, y: b.y - 4, w: b.width + 8, h: b.height + 8 };
    });
    const pts = samplePoints(data.wid, parts);
    let maxX = 0; Object.values(bb).forEach((b) => { maxX = Math.max(maxX, b.x + b.w); });
    const pulses = [...stage.current.querySelectorAll('[data-pulse]')].map((el) => ({ kids: [...el.children], v: el.dataset.pulse.split(',').map(Number) }));
    let lastPulse = 0;
    const silPaths = {}, stableCache = {};
    parts.forEach((p) => { const g = document.getElementById(`s-${data.wid}-${p.id}`); silPaths[p.id] = g ? [...g.querySelectorAll('path')] : []; });
    const byId = {}; parts.forEach((p, i) => { byId[p.id] = i; });

    /* ---------- per-frame drawing ---------- */
    function applyPose() {
      reg.sword.setAttribute('transform', `translate(${S.x.toFixed(2)} ${S.y.toFixed(2)}) rotate(${S.rot.toFixed(3)}) scale(${S.s.toFixed(5)})`);
      parts.forEach((p) => {
        const el = reg[p.id];
        el.setAttribute('transform', `translate(${(p.ex[0] * S.ex).toFixed(1)} ${(p.ex[1] * S.ex).toFixed(1)})`);
        const on = activeNow >= 0 && parts[activeNow].id === p.id;
        const target = 1 - S.fm * (on ? 0 : 0.88);
        op[p.id] = op[p.id] === undefined ? target : op[p.id] + (target - op[p.id]) * 0.25;
        el.setAttribute('opacity', op[p.id].toFixed(3));
        /* parts wholly off screen are not drawn at all (while zoomed in, most of the weapon is) */
        const b = bb[p.id], dx = p.ex[0] * S.ex, dy = p.ex[1] * S.ex;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const cx of [b.x, b.x + b.w]) for (const cy of [b.y, b.y + b.h]) { const q = toScreen(S, cx + dx, cy + dy); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
        const pad = 80 + 40 * S.s, gone = x1 < -pad || x0 > W + pad || y1 < -pad || y0 > H + pad;
        if (gone !== hidden[p.id]) { hidden[p.id] = gone; el.style.display = gone ? 'none' : ''; }
      });
      const vertical = !P.land, bx = P.box;
      if (S.lab > 0.001 || labsOn) {
        let nu = 0, nd = 0;
        const L = parts.map((p, i) => {
          const b = bb[p.id], [px, py] = toScreen(S, b.x + b.w / 2 + p.ex[0] * S.ex, b.y + b.h / 2 + p.ex[1] * S.ex), up = p.side === 'up', k = (up ? nu++ : nd++) % 2;
          return vertical
            ? { i, px, py, up, lx: up ? bx.x0 - 26 - k * 14 : bx.x1 + 26 + k * 14, ly: py, anchor: up ? '-100%' : '0%' }
            : { i, px, py, up, lx: px, ly: up ? bx.y0 - 34 - k * 34 : bx.y1 + 34 + k * 34, anchor: '-50%' };
        });
        if (vertical) [true, false].forEach((side) => {                      // keep neighbours on one side from overlapping
          const row = L.filter((l) => l.up === side).sort((a, c) => a.ly - c.ly);
          for (let j = 1; j < row.length; j++) if (row[j].ly < row[j - 1].ly + 30) row[j].ly = row[j - 1].ly + 30;
        });
        L.forEach((l) => {
          const el = labs.current[l.i], ln = lines.current[l.i];
          if (!el) return;
          el.style.transform = `translate(${l.lx.toFixed(1)}px,${l.ly.toFixed(1)}px) translate(${l.anchor},-50%)`;
          el.style.opacity = S.lab.toFixed(3);
          ln.setAttribute('x1', l.px.toFixed(1)); ln.setAttribute('y1', l.py.toFixed(1));
          ln.setAttribute('x2', l.lx.toFixed(1)); ln.setAttribute('y2', (vertical ? l.ly : l.ly + (l.up ? 18 : -18)).toFixed(1));
          ln.setAttribute('opacity', (S.lab * 0.7).toFixed(3));
        });
        labsOn = S.lab > 0.001;
      }
      const hv = S.hero.toFixed(3), ty = `translateY(${((1 - S.hero) * -40).toFixed(1)}px)`;
      heroBack.current.style.opacity = hv; heroBack.current.style.transform = ty;
      heroFront.current.style.opacity = hv; heroFront.current.style.transform = ty;
      if (loreEl.current) { loreEl.current.style.opacity = S.lore.toFixed(3); loreEl.current.style.transform = `translateY(${((1 - S.lore) * 26).toFixed(1)}px)`; loreEl.current.style.visibility = S.lore > 0.01 ? 'visible' : 'hidden'; }
      poseDirty = false;
    }

    let wasActive = false;
    function applyLight(t) {
      const lit = world.lightOn, heat = world.heat;
      const R = Math.min(W, H) * 0.2, lx = world.px - ox, ly = world.py - oy;
      const [cx, cy] = toLocal(S, lx, ly);
      const rl = R / S.s, rh = (R * 0.8) / S.s;
      const live = lit > 0.01 || heat > 0.01;
      const dirx0 = 0.55, diry0 = 0.84;
      parts.forEach((p) => {
        const id = p.id, b = bb[id], pex = p.ex[0] * S.ex, pey = p.ex[1] * S.ex;
        const [sx, sy] = toScreen(S, b.x + b.w / 2 + pex, b.y + b.h / 2 + pey);
        let dx = dirx0, dy = diry0;
        if (lit > 0.02) { const vx = sx - lx, vy = sy - ly, m = Math.hypot(vx, vy) || 1; dx = dx * (1 - lit) + (vx / m) * lit; dy = dy * (1 - lit) + (vy / m) * lit; }
        const len = (7 + 15 * (0.35 + 0.65 * lit)) * (1 + 1.1 * S.ex) / S.s * Math.min(2.4, Math.max(0.5, S.s / (P.over.s || 1)) ** 0.6);
        const a = S.rot * D2R, c = Math.cos(a), si = Math.sin(a), mx = dx * len, my = dy * len;
        reg['sh:' + id].setAttribute('transform', `translate(${(mx * c + my * si).toFixed(2)} ${(-mx * si + my * c).toFixed(2)})`);
        if (!live) { if (wasActive) { reg['lo:' + id].style.display = 'none'; reg['ho:' + id].style.display = 'none'; shown[id + 'l'] = shown[id + 'h'] = false; } return; }
        const hw = (b.w * S.s) / 2, hh = (b.h * S.s) / 2, d = Math.hypot(sx - lx, sy - ly) - Math.hypot(hw, hh);
        const near = clamp(1 - d / (R * 1.5), 0, 1);
        const lo = reg['lo:' + id], ho = reg['ho:' + id], lv = near * lit * 0.95, hv = near * heat * 0.8;
        lo.setAttribute('opacity', lv.toFixed(3)); ho.setAttribute('opacity', hv.toFixed(3));
        const lOn = lv > 0.01, hOn = hv > 0.01;
        if (lOn !== shown[id + 'l']) { shown[id + 'l'] = lOn; lo.style.display = lOn ? '' : 'none'; }
        if (hOn !== shown[id + 'h']) { shown[id + 'h'] = hOn; ho.style.display = hOn ? '' : 'none'; }
        if (near > 0) {
          const g = reg['lg:' + id], gx = (cx - pex).toFixed(1), gy = (cy - pey).toFixed(1);
          g.setAttribute('cx', gx); g.setAttribute('cy', gy); g.setAttribute('fx', gx); g.setAttribute('fy', gy); g.setAttribute('r', rl.toFixed(1));
          const hgr = reg['hg:' + id];
          hgr.setAttribute('cx', gx); hgr.setAttribute('cy', gy); hgr.setAttribute('fx', gx); hgr.setAttribute('fy', gy); hgr.setAttribute('r', rh.toFixed(1));
        }
      });
      wasActive = live;
    }

    function frame(t) {
      if (!visible || !P) return;
      const r = stage.current.getBoundingClientRect(); ox = r.left; oy = r.top;
      if (poseDirty) applyPose();
      applyLight(t);
      if (t - lastPulse > 0.045) {                    // glows breathe at about 20 Hz; each child gets the alpha so no group layer is needed
        lastPulse = t;
        for (const { kids, v } of pulses) { const o = (v[1] + (v[2] - v[1]) * (0.5 + 0.5 * Math.sin(t * v[0] + v[3]))).toFixed(2); for (const k of kids) k.setAttribute('opacity', o); }
      }
    }

    /* ---------- controller the canvases and cursor use ---------- */
    const ctl = {
      i: index, data, S, byId,
      get visible() { return visible; }, frame,
      sample(ids) {
        const id = ids[(Math.random() * ids.length) | 0], list = pts[id];
        if (!list) return null;
        const q = list[(Math.random() * list.length) | 0], p = parts[byId[id]];
        const [x, y] = toScreen(S, q[0] + p.ex[0] * S.ex, q[1] + p.ex[1] * S.ex);
        const a = S.rot * D2R, c = Math.cos(a), si = Math.sin(a);
        return [x + ox, y + oy, q[2] * c - q[3] * si, q[2] * si + q[3] * c, S.s];
      },
      hit(vx, vy) {                                    // which part is under this viewport point (null if none)
        const [lx, ly] = toLocal(S, vx - ox, vy - oy);
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i], pt = new DOMPoint(lx - p.ex[0] * S.ex, ly - p.ex[1] * S.ex);
          if (hidden[p.id]) continue;
          for (const el of silPaths[p.id]) if (el.isPointInFill(pt)) return p.id;
        }
        return null;
      },
      stable(ids, n) {                                  // n fixed points on the weapon (same ones every frame), in viewport pixels
        const key = ids.join() + n;
        if (!stableCache[key]) stableCache[key] = Array.from({ length: n }, (_, k) => { const id = ids[k % ids.length], l = pts[id]; return l ? [id, (Math.random() * l.length) | 0] : null; }).filter(Boolean);
        const a = S.rot * D2R; void a;
        return stableCache[key].map(([id, i]) => { const q = pts[id][i], p = parts[byId[id]], [x, y] = toScreen(S, q[0] + p.ex[0] * S.ex, q[1] + p.ex[1] * S.ex); return [x + ox, y + oy]; });
      },
      partPoint(id) { const b = bb[id], p = parts[byId[id]]; if (!b) return null; const [x, y] = toScreen(S, b.x + b.w / 2 + p.ex[0] * S.ex, b.y + b.h / 2 + p.ex[1] * S.ex); return [x + ox, y + oy]; },
      axisPoint(u) { const [x, y] = toScreen(S, maxX * u, 0); return [x + ox, y + oy]; },
      scale: () => S.s,
    };
    world.chapters[index] = ctl;

    /* ---------- layout + timeline ---------- */
    function fitName() {
      const el = nameEl.current; if (!el) return;
      el.style.fontSize = '100px'; el.style.width = 'auto';
      const w = el.scrollWidth || 1;
      el.style.fontSize = Math.min(100 * (W * 0.9) / w, H * 0.5, 420) + 'px';
    }

    function build() {
      if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); tl = null; }
      const r = stage.current.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      svg.current.setAttribute('viewBox', `0 0 ${W} ${H}`); leaders.current.setAttribute('viewBox', `0 0 ${W} ${H}`);
      P = layoutPoses(W, H, data, bb);
      stage.current.classList.toggle('land', P.land);
      fitName();
      Object.assign(S, P.hero, { ex: 0, hero: 1, lab: 0, fm: 0, lore: 0 });
      Object.keys(op).forEach((k) => delete op[k]);
      poseDirty = true;

      if (reduce) { Object.assign(S, P.over, { ex: 1, hero: 0, lab: 1, lore: 0 }); poseDirty = true; return; }

      const SEG = (FE - FS) / n;
      const cam = (c, dur, at, ease = 'power2.inOut') => tl.to(S, { rot: c.rot, s: c.s, x: c.x, y: c.y, duration: dur, ease }, at);
      tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: () => {
          poseDirty = true;
          const p = tl.progress();
          const idx = p < FS - 0.005 || p > FE + 0.005 ? -1 : Math.min(n - 1, Math.max(0, Math.floor((p - FS) / SEG)));
          if (idx !== activeNow) { activeNow = idx; setActive(idx); }
        },
        scrollTrigger: { id: 'ch' + index, trigger: stage.current, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * (5.5 + n * 0.8)), pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true }
      });
      st = tl.scrollTrigger;
      tl.to(S, { hero: 0, duration: 0.07, ease: 'power1.in' }, 0.04);
      cam(P.over, 0.15, 0.06);
      tl.to(S, { ex: 1, duration: 0.13, ease: 'power3.inOut' }, 0.09)
        .to(S, { lab: 1, duration: 0.05 }, 0.2)
        .to(S, { lab: 0, duration: 0.025 }, 0.25)
        .to(S, { fm: 1, duration: 0.02 }, 0.265);
      P.cams.forEach((c, i) => cam(c, SEG * 0.46, FS + i * SEG));
      tl.to(S, { fm: 0, duration: 0.02 }, FE);
      cam(P.over, 0.05, FE);
      tl.to(S, { ex: 0, duration: 0.05, ease: 'power3.inOut' }, FE + 0.06);
      cam(P.lore, 0.06, FE + 0.06);
      tl.to(S, { lore: 1, duration: 0.05 }, FE + 0.12)
        .to({}, { duration: 0.01 }, 0.995);
    }

    build();
    const offFrame = (() => { world.frames = world.frames || new Set(); world.frames.add(frame); return () => world.frames.delete(frame); })();

    const vis = ScrollTrigger.create({
      trigger: section.current, start: 'top bottom+=10%', end: 'bottom top-=10%', refreshPriority: -1,
      onToggle: (self) => {
        visible = self.isActive; poseDirty = true;
        svg.current.style.display = visible ? '' : 'none'; leaders.current.style.display = visible ? '' : 'none';
      }
    });
    const cur = ScrollTrigger.create({
      trigger: section.current, start: 'top 62%', end: 'bottom 62%', refreshPriority: -1,
      onToggle: (self) => { if (self.isActive) world.cur = index; }
    });
    visible = vis.isActive; svg.current.style.display = visible ? '' : 'none'; leaders.current.style.display = visible ? '' : 'none';

    let t;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        const r = stage.current.getBoundingClientRect();
        if (Math.round(r.width) === W && Math.round(r.height) === H) return;     // pinning itself resizes the stage: ignore that
        build(); ScrollTrigger.refresh();
      }, 180);
    });
    ro.observe(stage.current);
    document.fonts?.ready.then(() => { fitName(); });
    kids.go = (p) => { ScrollTrigger.refresh(); const st = ScrollTrigger.getById('ch' + index); if (st) { const y = st.start + p * (st.end - st.start); if (scroller.lenis) scroller.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); ScrollTrigger.update(); } };
    world.go[index] = kids.go;
    return () => { clearTimeout(t); ro.disconnect(); offFrame(); vis.kill(); cur.kill(); if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); } delete world.chapters[index]; delete world.go[index]; };
  }, []);

  const part = active >= 0 ? parts[active] : null;
  const style = { '--wf': data.font, '--ac': data.ac, '--fs': data.fontScale, '--glow': data.glow };
  const Lore = (
    <aside className="lore" ref={loreEl} aria-label={`${data.name}: where it was found and who held it last`}>
      <p className="mono lore-k"><span>{ROMAN[index]} / IV</span><i />Last known</p>
      <h3 className="lore-h">{data.name}</h3>
      <dl className="lore-s">
        <div><dt className="mono">Found in</dt><dd>{data.lore.found}</dd></div>
        <div><dt className="mono">Last owner</dt><dd>{data.lore.owner}</dd></div>
        <div><dt className="mono">Fate</dt><dd>{data.lore.fate}</dd></div>
        <div><dt className="mono">Nature</dt><dd className="lore-nature">{data.sin}</dd></div>
      </dl>
    </aside>
  );

  return (
    <section className={'chapter' + (reduced ? ' reduced' : '')} id={data.id} ref={section} style={style} aria-label={data.name}>
      <div className="stage" ref={stage}>
        <div className="hero-back" ref={heroBack}>
          <div className="bgword" aria-label={data.name}><span ref={nameEl} className={'bgword-t' + (revealed ? ' in' : '')}>{data.name}</span></div>
        </div>
        <div className="hero-front" ref={heroFront}>
          <p className="kicker mono">{data.kicker}</p>
          <p className="tag-line">{data.tagline}</p>
          <p className="hint mono"><ShinyText text={(index < 3 ? 'Scroll to take it apart' : 'Scroll to take it apart') + ' ↓'} color="#8f8a7c" shineColor="#efe8d8" speed={3} /></p>
        </div>

        <svg className="svg" ref={svg} role="img" aria-label={`${data.name}, drawn in parts`}>
          <g ref={(el) => { reg.sword = el; }}><Art reg={regFn} /></g>
        </svg>
        <svg className="leaders" ref={leaders} aria-hidden="true">
          {parts.map((p, i) => <line key={p.id} ref={(el) => { lines.current[i] = el; }} stroke="#efe8d8" strokeWidth="1" strokeDasharray="3 4" opacity="0" />)}
        </svg>
        {parts.map((p, i) => (
          <div className="lab" key={p.id} ref={(el) => { labs.current[i] = el; }}>
            <span className="lab-n mono">{String(i + 1).padStart(2, '0')}</span>
            <span className="lab-t">{p.name}</span>
          </div>
        ))}

        <aside className={'panel' + (part ? ' on' : '')} aria-live="polite">
          {part && (
            <div className="panel-in" key={part.id}>
              <p className="mono panel-k"><span>{String(active + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span><i /><DecryptedText text={part.title} animateOn="view" sequential speed={36} maxIterations={8} /></p>
              <h2 className="panel-h">{part.name}</h2>
              <p className="panel-p">{part.role}</p>
              <p className="panel-m mono">{part.material}</p>
              <dl className="panel-s">{part.spec.map(([k, v]) => <div key={k}><dt className="mono">{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          )}
        </aside>

        <ol className="rail" aria-hidden="true">{parts.map((p, i) => <li key={p.id} className={i === active ? 'on' : ''} />)}</ol>
        {!reduced && Lore}
      </div>
      {reduced && <div className="lore-flow">{Lore}</div>}
    </section>
  );
}
