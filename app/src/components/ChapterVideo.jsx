import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ShinyText from './rb/ShinyText';
import { world } from '../lib/world';
import { reduceMotion } from '../lib/anim';
import { scroller } from '../lib/scroll';
import videoUrl from '../assets/voracity-scroll.mp4?url';
import posterUrl from '../assets/voracity-scroll.jpg';

/* A weapon chapter that plays a film by scrolling: the two clips (the scythe floating in its flames, then the scythe coming apart into its pieces) are
   joined into one all-intra video, so every frame can be shown instantly and scrolling back plays it in reverse. */
const ROMAN = ['I', 'II', 'III', 'IV'];
const START = 0.06, SPAN = 0.84;                       // the film runs over this part of the chapter's scroll
const CUTS = [0.085, 0.45, 0.565, 0.725, 0.91];        // chapter progress where the captions change (whole, waking, unmade, catalogue, then the lore card)
const BEATS = [
  { k: 'Whole', h: 'Seven parts, one hunger.', p: 'It stands in its own fire and does not need a hand. Everything you see is the scythe, and everything the scythe has eaten.' },
  { k: 'Waking', h: 'Violet lightning in the haft.', p: 'It remembers every harvest. The vine tightens, the eyelets flare, and something old turns its head.' },
  { k: 'Unmade', h: 'It comes apart all at once.', p: 'Not broken. Opened. Ring, crown, shards and thorns hang in the air the way they hung in the forge, before they were a weapon.' },
  { k: 'Catalogue', h: 'Laid out, nothing is missing.', p: 'The seven parts of Voracity, set in the order they are put back together.' }
];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function ChapterVideo({ index, data, revealed, onFail }) {
  const section = useRef(null), stage = useRef(null), vid = useRef(null), nameEl = useRef(null), heroBack = useRef(null), heroFront = useRef(null);
  const loreEl = useRef(null), shade = useRef(null), cat = useRef([]), bar = useRef(null);
  const [beat, setBeat] = useState(-1);
  const [reduced] = useState(reduceMotion);
  const parts = data.parts;

  useLayoutEffect(() => {
    const reduce = reduceMotion(), v = vid.current;
    const S = { vt: 0, z: 1, hero: 1, lore: 0, shade: 0 };
    let W = 1, H = 1, tl = null, visible = false, loaded = false, ox = 0, oy = 0, shown = 0, set = -1, beatNow = -1, dur = 15.2;

    /* the film is fetched when the chapter is a couple of screens away */
    const load = () => { if (loaded) return; loaded = true; v.preload = 'auto'; v.src = videoUrl; v.load(); };
    v.addEventListener('error', () => onFail && onFail());
    v.addEventListener('loadedmetadata', () => { if (v.duration) dur = v.duration; });
    if (reduce) load();

    function frame(t, dt) {
      if (!visible) return;
      const r = stage.current.getBoundingClientRect(); ox = r.left; oy = r.top;
      /* ease toward where the scroll says we are, so the film glides instead of stepping */
      const target = S.vt * Math.max(0, dur - 0.05);
      shown += (target - shown) * (1 - Math.exp(-(dt || 0.016) * 16));
      if (v.readyState >= 2 && Math.abs(shown - set) > 0.02) { set = shown; v.currentTime = shown; }
      /* a slow push in while it is whole, and a little parallax from the pointer */
      const mx = world.fine && world.px > -9000 ? (world.px - ox) / W - 0.5 : 0, my = world.fine && world.py > -9000 ? (world.py - oy) / H - 0.5 : 0;
      v.style.transform = `translate3d(${(-mx * 16).toFixed(1)}px,${(-my * 10).toFixed(1)}px,0) scale(${S.z.toFixed(4)})`;
      const hv = S.hero.toFixed(3), ty = `translateY(${((1 - S.hero) * -40).toFixed(1)}px)`;
      heroBack.current.style.opacity = hv; heroBack.current.style.transform = ty;
      heroFront.current.style.opacity = hv; heroFront.current.style.transform = ty;
      shade.current.style.opacity = S.shade.toFixed(3);
      if (loreEl.current) { loreEl.current.style.opacity = S.lore.toFixed(3); loreEl.current.style.transform = `translateY(${((1 - S.lore) * 26).toFixed(1)}px)`; loreEl.current.style.visibility = S.lore > 0.01 ? 'visible' : 'hidden'; }
      if (bar.current) bar.current.style.transform = `scaleX(${clamp01(S.vt).toFixed(4)})`;
    }

    /* ---------- what the aura, nature reveal and touch scan ask of a chapter ---------- */
    const ctl = {
      i: index, data, noFx: true,
      get visible() { return visible; }, frame,
      sample: () => null, stable: () => [], partPoint: () => null, scale: () => 1,
      /* the relic is whatever stands in the middle of the picture */
      hit(vx, vy) { const x = (vx - ox) / W - 0.5, y = (vy - oy) / H - 0.5; return (x * x) / (0.3 * 0.3) + (y * y) / (0.36 * 0.36) < 1; },
      axisPoint(u) { return [ox + W * (0.28 + 0.44 * u), oy + H * 0.5]; }
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
      fitName();
      stage.current.classList.toggle('tall', W / H < 0.95);
      Object.assign(S, { vt: 0, z: 1, hero: 1, lore: 0, shade: 0 }); shown = 0; set = -1;
      if (reduce) { Object.assign(S, { vt: 0.86, hero: 0, lore: 0 }); shown = S.vt * dur; setBeat(3); cat.current.forEach((el) => el && (el.style.opacity = 1)); return; }

      tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: () => {
          const p = tl.progress();
          const b = p < CUTS[0] ? -1 : p < CUTS[1] ? 0 : p < CUTS[2] ? 1 : p < CUTS[3] ? 2 : p < CUTS[4] ? 3 : -1;
          if (b !== beatNow) { beatNow = b; setBeat(b); }
          cat.current.forEach((el, i) => { if (el) el.style.opacity = clamp01((p - (CUTS[3] + 0.004 + i * 0.022)) / 0.018).toFixed(3); });
        },
        scrollTrigger: { id: 'ch' + index, trigger: stage.current, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 9), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true }
      });
      tl.to(S, { hero: 0, duration: 0.05, ease: 'power1.in' }, 0.03)
        .to(S, { vt: 1, duration: SPAN }, START)
        .to(S, { z: 1.1, duration: 0.38 }, START)          // push in on the floating scythe
        .to(S, { z: 1, duration: 0.07, ease: 'power2.inOut' }, 0.45)
        .to(S, { z: 1.05, duration: 0.14 }, 0.5)           // and lean toward the pieces as they open
        .to(S, { z: 1, duration: 0.2, ease: 'power2.out' }, 0.7)
        .to(S, { shade: 0.62, lore: 1, duration: 0.06 }, 0.925)
        .to({}, { duration: 0.01 }, 0.995);
      ScrollTrigger.refresh();
    }

    build();

    /* in view: draw; near: fetch the film */
    const vis = ScrollTrigger.create({
      trigger: section.current, start: 'top bottom+=10%', end: 'bottom top-=10%', refreshPriority: -1,
      onToggle: (self) => { visible = self.isActive; load(); }
    });
    const near = ScrollTrigger.create({ trigger: section.current, start: 'top bottom+=260%', end: 'bottom top', refreshPriority: -1, onToggle: (self) => { if (self.isActive) load(); } });
    const cur = ScrollTrigger.create({
      trigger: section.current, start: 'top 62%', end: 'bottom 62%', refreshPriority: -1,
      onToggle: (self) => { if (self.isActive) world.cur = index; }
    });
    /* while the film fills the screen the WebGL and particle layers behind it need not draw */
    const cover = ScrollTrigger.create({
      trigger: stage.current, start: 'top 4%', end: () => '+=' + Math.round(window.innerHeight * 9 - 80), refreshPriority: -1,
      onToggle: (self) => { world.cover = self.isActive && !stage.current.classList.contains('tall'); }
    });
    visible = vis.isActive; if (vis.isActive || near.isActive) load();
    world.frames = world.frames || new Set(); world.frames.add(frame);

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
    const go = (p) => { ScrollTrigger.refresh(); const s = ScrollTrigger.getById('ch' + index); if (s) { const y = s.start + p * (s.end - s.start); if (scroller.lenis) scroller.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); ScrollTrigger.update(); } };
    world.go[index] = go;
    return () => {
      clearTimeout(t); ro.disconnect(); world.frames.delete(frame); vis.kill(); near.kill(); cur.kill(); cover.kill();
      if (world.cover) world.cover = false;
      if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); }
      delete world.chapters[index]; delete world.go[index];
      v.removeAttribute('src'); v.load();
    };
  }, []);

  const b = beat >= 0 ? BEATS[beat] : null;
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
      <div className="stage vstage" ref={stage}>
        <video className="vvid" ref={vid} poster={posterUrl} muted playsInline preload="none" disablePictureInPicture aria-label={`${data.name}: the scythe in its flames, then taken apart into its pieces, played by scrolling`} />
        <div className="hero-back" ref={heroBack}>
          <div className="bgword" aria-label={data.name}><span ref={nameEl} className={'bgword-t vname' + (revealed ? ' in' : '')}>{data.name}</span></div>
        </div>
        <div className="vshade" ref={shade} aria-hidden="true" />
        <div className="hero-front" ref={heroFront}>
          <p className="kicker mono">{data.kicker}</p>
          <p className="tag-line">{data.tagline}</p>
          <p className="hint mono"><ShinyText text="Scroll to take it apart ↓" color="#8f8a7c" shineColor="#efe8d8" speed={3} /></p>
        </div>
        <div className={'vbeat' + (b ? ' on' : '')} aria-live="polite">
          {b && (
            <div className="vbeat-in" key={beat}>
              <p className="mono vbeat-k"><span>{String(beat + 1).padStart(2, '0')} / {String(BEATS.length).padStart(2, '0')}</span><i />{b.k}</p>
              <h2 className="vbeat-h">{b.h}</h2>
              <p className="vbeat-p">{b.p}</p>
            </div>
          )}
        </div>
        <ol className={'vcat' + (beat === 3 ? ' on' : '')} aria-label="The seven parts">
          {parts.map((p, i) => (
            <li key={p.id} ref={(el) => { cat.current[i] = el; }}><span className="mono">{String(i + 1).padStart(2, '0')}</span><b>{p.name}</b><em>{p.title}</em></li>
          ))}
        </ol>
        <ol className="rail" aria-hidden="true">{BEATS.map((x, i) => <li key={x.k} className={i === beat ? 'on' : ''} />)}</ol>
        <div className="vbar" aria-hidden="true"><i ref={bar} /></div>
        {!reduced && Lore}
      </div>
      {reduced && <div className="lore-flow">{Lore}</div>}
    </section>
  );
}
