import { useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import DecryptedText from './rb/DecryptedText/DecryptedText';
import ShinyText from './rb/ShinyText';
import { world } from '../lib/world';
import { reduceMotion } from '../lib/anim';
import { scroller } from '../lib/scroll';
import { createStage } from '../lib/model3d';

/* A weapon chapter drawn as a live 3D model (three.js): the same scroll story as the 2D chapters. */
const ROMAN = ['I', 'II', 'III', 'IV'];
const FS = 0.29, FE = 0.79, FOV = 30;

export default function Chapter3D({ index, data, revealed }) {
  const section = useRef(null), stage = useRef(null), canvas = useRef(null), leaders = useRef(null), nameEl = useRef(null);
  const heroBack = useRef(null), heroFront = useRef(null), loreEl = useRef(null), kids = useRef({}).current;
  const labs = useRef([]), lines = useRef([]);
  const [active, setActive] = useState(-1);
  const [reduced] = useState(reduceMotion);
  const parts = data.parts, n = parts.length;

  useLayoutEffect(() => {
    const reduce = reduceMotion();
    const ex = {}; parts.forEach((p) => { ex[p.id] = p.ex; });
    const ids = parts.map((p) => p.id);
    const S = { roll: -0.45, spin: 0.5, yaw: 0.1, pitch: 0.14, dist: 5, tx: 0, ty: 0, tz: 0, offx: 0, offy: 0, ex: 0, hero: 1, lab: 0, fm: 0, lore: 0 };
    let W = 1, H = 1, P = null, tl = null, activeNow = -1, visible = false, labsOn = false, ready = false, ox = 0, oy = 0, drag = 0, dragP = 0, tmr = 0;
    const st3 = createStage(canvas.current, ids, ex);
    const byId = {}; parts.forEach((p, i) => { byId[p.id] = i; });
    const stableCache = {}, tmp = new THREE.Vector3(), out = [0, 0, 0, 0];

    /* ---------- fitting the model into a region of the screen ---------- */
    function pointsFor(idList, exAmt) { return idList.flatMap((id) => st3.corners(id, exAmt)); }
    /** distance so that `pts` (in model space) fill `fw` x `fh` of the screen, looking at their centre. Returns {dist, target} */
    function fit(pts, roll, spin, yaw, pitch, fw, fh, minDist = 0.5) {
      const M = st3.modelMatrix(roll, spin), q = pts.map((p) => p.clone().applyMatrix4(M));
      const box = new THREE.Box3().setFromPoints(q), c = box.getCenter(new THREE.Vector3());
      const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 60);
      let d = 8;
      for (let it = 0; it < 4; it++) {
        const cp = Math.cos(pitch);
        cam.position.set(c.x + Math.sin(yaw) * cp * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * cp * d); cam.lookAt(c); cam.updateMatrixWorld(true);
        let mnx = 9, mxx = -9, mny = 9, mxy = -9;
        for (const p of q) { tmp.copy(p).project(cam); mnx = Math.min(mnx, tmp.x); mxx = Math.max(mxx, tmp.x); mny = Math.min(mny, tmp.y); mxy = Math.max(mxy, tmp.y); }
        d *= Math.max((mxx - mnx) / 2 / fw, (mxy - mny) / 2 / fh);
      }
      return { dist: Math.max(minDist, d), tx: c.x, ty: c.y, tz: c.z };
    }

    function layout() {
      const land = W / H > 0.95;
      /* [centre x, centre y, width, height] as fractions of the screen */
      const R = land
        ? { hero: [0.6, 0.5, 0.58, 0.8], over: [0.5, 0.52, 0.88, 0.56], focus: [0.3, 0.5, 0.5, 0.7], lore: [0.27, 0.5, 0.46, 0.8] }
        : { hero: [0.5, 0.48, 0.86, 0.66], over: [0.5, 0.5, 0.5, 0.8], focus: [0.5, 0.27, 0.84, 0.4], lore: [0.5, 0.27, 0.8, 0.4] };
      const place = (reg, f) => ({ ...f, offx: W / 2 - reg[0] * W, offy: H / 2 - reg[1] * H });
      const whole = pointsFor(ids, 0), apart = pointsFor(ids, 1);
      const heroRoll = land ? -0.38 : -0.2, overRoll = land ? -Math.PI / 2 : 0;
      const hero = { roll: heroRoll, spin: 0.12, yaw: 0.06, pitch: 0.08, ...place(R.hero, fit(whole, heroRoll, 0.12, 0.06, 0.08, R.hero[2], R.hero[3])) };
      const over = { roll: overRoll, spin: 0, yaw: 0, pitch: 0.06, ...place(R.over, fit(apart, overRoll, 0, 0, 0.06, R.over[2], R.over[3])) };
      const lore = { roll: heroRoll, spin: 0.2, yaw: 0.06, pitch: 0.08, ...place(R.lore, fit(whole, heroRoll, 0.2, 0.06, 0.08, R.lore[2], R.lore[3])) };
      const cams = parts.map((p, i) => {
        const spin = (i % 2 ? -0.3 : 0.3), f = fit(st3.corners(p.id, 1), overRoll, spin, 0.05, 0.1, R.focus[2] * 0.62, R.focus[3] * 0.62, 0.7);
        return { roll: overRoll, spin, yaw: 0.05, pitch: 0.1, ...place(R.focus, f) };
      });
      return { land, hero, over, lore, cams };
    }

    /* ---------- per-frame ---------- */
    const proj = (v) => st3.project(v, [0, 0]);
    function frame(t, dt) {
      if (!visible || !ready || !P) return;
      const r = stage.current.getBoundingClientRect(); ox = r.left; oy = r.top;
      /* a slow turntable swing while the weapon is whole, plus whatever the visitor dragged */
      drag *= Math.exp(-(dt || 0.016) * 0.9); dragP *= Math.exp(-(dt || 0.016) * 0.9);
      const calm = Math.max(S.hero, S.lore) * (1 - S.ex);
      const S2 = { ...S, spin: S.spin + Math.sin(t * 0.5) * 0.3 * calm + Math.sin(t * 0.35) * 0.12 * S.fm + drag, pitch: S.pitch + dragP };
      st3.apply(S2, activeNow >= 0 && S.fm > 0.5 ? parts[activeNow].id : null, t);
      /* the pointer lights the metal */
      const lx = (world.px - ox) / W * 2 - 1, ly = -((world.py - oy) / H) * 2 + 1;
      st3.pointerLight(lx, ly, world.lightOn, new THREE.Vector3(S.tx, S.ty, S.tz));
      st3.render();

      /* callouts */
      if (S.lab > 0.001 || labsOn) {
        const vertical = !P.land;
        const centers = parts.map((p) => { const c = st3.partCenter(p.id, tmp); return proj(c.clone()); });
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        parts.forEach((p) => st3.corners(p.id, S.ex).forEach((c) => {
          const q = proj(c.clone().applyMatrix4(rollSpin(S2)));
          x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        }));
        let nu = 0, nd = 0;
        const L = parts.map((p, i) => {
          const [px, py] = centers[i], up = p.side === 'up', k = (up ? nu++ : nd++) % 2;
          return vertical
            ? { i, px, py, up, lx: up ? x0 - 26 - k * 14 : x1 + 26 + k * 14, ly: py, anchor: up ? '-100%' : '0%' }
            : { i, px, py, up, lx: px, ly: up ? y0 - 30 - k * 34 : y1 + 30 + k * 34, anchor: '-50%' };
        });
        if (vertical) [true, false].forEach((side) => {
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
    }
    const rollSpin = (s) => st3.modelMatrix(s.roll, s.spin);

    /* ---------- what the aura, nature reveal and touch scan ask of a chapter ---------- */
    const ctl = {
      i: index, data, S, byId, st3,
      get visible() { return visible && ready; }, frame,
      sample(idList) { const q = st3.sample(idList, out); return q ? [q[0] + ox, q[1] + oy, q[2], q[3], 1] : null; },
      hit(vx, vy) { return ready ? st3.hit(vx - ox, vy - oy) : null; },
      stable(idList, count) {
        const key = idList.join() + count;
        if (!stableCache[key]) stableCache[key] = Array.from({ length: count }, (_, k) => { const id = idList[k % idList.length], l = st3.samples[id]; return l && l.length ? l[(Math.random() * l.length) | 0] : null; }).filter(Boolean);
        return stableCache[key].map(({ mesh, i }) => { const q = st3.samplePoint(mesh, i, [0, 0, 0, 0]); return [q[0] + ox, q[1] + oy]; });
      },
      partPoint(id) { if (!st3.parts[id]) return null; const q = proj(st3.partCenter(id, tmp).clone()); return [q[0] + ox, q[1] + oy]; },
      axisPoint(u) { const b = st3.partBox('shaft'), v = new THREE.Vector3(0, b.min.y + (b.max.y - b.min.y) * u, 0); const q = proj(v); return [q[0] + ox, q[1] + oy]; },
      scale: () => 1
    };
    world.chapters[index] = ctl;

    function fitName() {
      const el = nameEl.current; if (!el) return;
      el.style.fontSize = '100px'; el.style.width = 'auto';
      el.style.fontSize = Math.min(100 * (W * 0.9) / (el.scrollWidth || 1), H * 0.5, 420) + 'px';
    }

    function build() {
      if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); tl = null; }
      const r = stage.current.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      leaders.current.setAttribute('viewBox', `0 0 ${W} ${H}`);
      st3.resize(W, H);
      fitName();
      if (!ready) return;
      P = layout();
      stage.current.classList.toggle('land', P.land);
      Object.assign(S, P.hero, { ex: 0, hero: 1, lab: 0, fm: 0, lore: 0 });
      if (reduce) { Object.assign(S, P.over, { ex: 1, hero: 0, lab: 1, lore: 0 }); return; }

      const SEG = (FE - FS) / n;
      const cam = (c, dur, at, ease = 'power2.inOut') => tl.to(S, { roll: c.roll, spin: c.spin, yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty, tz: c.tz, offx: c.offx, offy: c.offy, duration: dur, ease }, at);
      tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: () => {
          const p = tl.progress();
          const idx = p < FS - 0.005 || p > FE + 0.005 ? -1 : Math.min(n - 1, Math.max(0, Math.floor((p - FS) / SEG)));
          if (idx !== activeNow) { activeNow = idx; setActive(idx); }
        },
        scrollTrigger: { id: 'ch' + index, trigger: stage.current, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * (5.5 + n * 0.8)), pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true }
      });
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
      ScrollTrigger.refresh();
    }

    build();
    st3.loading.then(() => { ready = true; build(); }).catch((e) => console.warn('model failed', e));
    world.frames = world.frames || new Set(); world.frames.add(frame);

    const vis = ScrollTrigger.create({
      trigger: section.current, start: 'top bottom+=10%', end: 'bottom top-=10%', refreshPriority: -1,
      onToggle: (self) => { visible = self.isActive; canvas.current.style.display = visible ? '' : 'none'; leaders.current.style.display = visible ? '' : 'none'; }
    });
    const cur = ScrollTrigger.create({
      trigger: section.current, start: 'top 62%', end: 'bottom 62%', refreshPriority: -1,
      onToggle: (self) => { if (self.isActive) world.cur = index; }
    });
    visible = vis.isActive;

    /* drag to turn it */
    const el = canvas.current.parentElement;
    let down = null;
    const pd = (e) => { if (S.fm > 0.5 || e.pointerType === 'touch') return; down = [e.clientX, e.clientY, drag, dragP]; };
    const pm = (e) => { if (!down) return; drag = down[2] + (e.clientX - down[0]) * 0.008; dragP = Math.max(-0.5, Math.min(0.5, down[3] + (e.clientY - down[1]) * 0.004)); };
    const pu = () => { down = null; };
    el.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu);

    let t;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        const r = stage.current.getBoundingClientRect();
        if (Math.round(r.width) === W && Math.round(r.height) === H) return;
        build(); ScrollTrigger.refresh();
      }, 180);
    });
    ro.observe(stage.current);
    document.fonts?.ready.then(() => { fitName(); });
    kids.go = (p) => { ScrollTrigger.refresh(); const s = ScrollTrigger.getById('ch' + index); if (s) { const y = s.start + p * (s.end - s.start); if (scroller.lenis) scroller.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); ScrollTrigger.update(); } };
    world.go[index] = kids.go;
    return () => {
      clearTimeout(t); clearTimeout(tmr); ro.disconnect(); world.frames.delete(frame); vis.kill(); cur.kill();
      el.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu);
      if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); }
      delete world.chapters[index]; delete world.go[index]; st3.dispose();
    };
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
          <p className="hint mono"><ShinyText text="Scroll to take it apart ↓" color="#8f8a7c" shineColor="#efe8d8" speed={3} /></p>
        </div>
        <canvas className="svg model3d" ref={canvas} role="img" aria-label={`${data.name}, a 3D model drawn in parts. Drag to turn it.`} />
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
