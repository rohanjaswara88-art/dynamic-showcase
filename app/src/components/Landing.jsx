import { Fragment, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FOLIO, BEATS } from '../weapons/story';
import { WEAPONS } from '../weapons/data';
import { world } from '../lib/world';
import { reduceMotion } from '../lib/anim';
import { scrollToTarget } from '../lib/scroll';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const words = (t) => t.split(' ').map((w, i) => <span className="w" key={i}>{w + ' '}</span>);

/** every word of every weapon, set very small on one page: only readable through the glass */
function Codex() {
  return (
    <section className="lc-codex" data-codex>
      <p className="lc-num">Appendix</p>
      <h2 className="lc-name long">The Codex of the Four</h2>
      <p className="lc-place mono">Every word the keepers set down, in the hand they used. Too small to read? Hold the glass to the page.</p>
      <div className="cx-grid">
        {WEAPONS.map((w) => (
          <article className="cx" key={w.id}>
            <h3 style={{ fontFamily: w.font, color: w.ac }}>{w.name}</h3>
            <p className="cx-k"><b>Nature</b> {w.sin}. {w.sinLine} {w.tagline}</p>
            <p><b>Found in</b> {w.lore.found}</p>
            <p><b>Last owner</b> {w.lore.owner}</p>
            <p><b>Fate</b> {w.lore.fate}</p>
            <ol>
              {w.parts.map((p, i) => (
                <li key={p.id}><b>{String(i + 1).padStart(2, '0')} {p.name}</b>, {p.title.toLowerCase()}. {p.role} <i>{p.material}</i> {p.spec.map(([k, v]) => `${k}: ${v}`).join('. ')}.</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

/** the readable story. Rendered once on the page and once, scaled up, inside the magnifier lens (`lens`). */
export function Content({ lens }) {
  return (
    <div className="lc-root" aria-hidden={lens || undefined}>
      <header className="lc-hero">
        <p className="lc-kicker mono">{FOLIO.kicker}</p>
        <h1 className="lc-title">{FOLIO.title.map((l) => <span key={l}>{[...l].map((c, i) => <i className="ch" key={i}>{c === ' ' ? ' ' : c}</i>)}</span>)}</h1>
        <p className="lc-sub">{FOLIO.sub}</p>
        <p className="lc-cue mono"><span className="lc-line" />{FOLIO.cue}</p>
      </header>
      {BEATS.map((b, i) => {
        const last = i === BEATS.length - 1;
        const w = b.w !== undefined ? WEAPONS[b.w] : null;
        return (
          <Fragment key={b.id}>
          {last && <Codex />}
          <section className={'lc-beat' + (i % 2 ? ' flip' : '')} data-beat={i}>
            <div className="lc-head">
              <p className="lc-num">{b.num}</p>
              <h2 className={'lc-name' + (w ? '' : ' long')} style={w ? { fontFamily: w.font, color: w.ac, textShadow: `0 0 44px ${w.glow}66`, fontSize: `calc(clamp(2.2rem,6vw,6.4rem)*${w.fontScale})` } : undefined}>{w ? w.name : b.name}</h2>
              <p className="lc-place mono">{b.place}</p>
              <span className="lc-rule" />
            </div>
            <div className="lc-body">
              <p className="lc-p">{words(b.text)}</p>
              {b.cta && <a className="lc-cta mono" href="#voracity" onClick={lens ? undefined : (e) => { e.preventDefault(); scrollToTarget('#voracity', { duration: 3 }); }}>{b.cta}<i>↓</i></a>}
            </div>
          </section>
          </Fragment>
        );
      })}
    </div>
  );
}

function Ring({ r, ticks, len, op }) {
  return (
    <g opacity={op}>
      <circle r={r} fill="none" stroke="currentColor" strokeWidth="1" />
      {[...Array(ticks)].map((_, i) => { const a = (i / ticks) * Math.PI * 2, l = i % 6 === 0 ? len * 1.9 : len; return <line key={i} x1={Math.cos(a) * r} y1={Math.sin(a) * r} x2={Math.cos(a) * (r - l)} y2={Math.sin(a) * (r - l)} stroke="currentColor" strokeWidth={i % 6 === 0 ? 1.4 : 0.8} />; })}
    </g>
  );
}

export default function Landing({ revealed }) {
  const sec = useRef(null), ring1 = useRef(null), ring2 = useRef(null), bar = useRef(null), deco = useRef(null);

  useLayoutEffect(() => {
    const reduce = reduceMotion();
    const root = sec.current, ctx = gsap.context(() => {
      /* the landing owns the world while it is on screen */
      ScrollTrigger.create({ trigger: root, start: 'top 62%', end: 'bottom 62%', onToggle: (s) => { if (s.isActive) world.cur = -1; } });
      if (reduce) { root.querySelectorAll('.w').forEach((w) => { w.style.opacity = 1; }); return; }

      gsap.to(bar.current, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });
      gsap.to(ring1.current, { rotation: 140, scale: 1.5, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: '+=1800', scrub: 0.6 } });
      gsap.to(ring2.current, { rotation: -200, scale: 1.25, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: '+=1800', scrub: 0.6 } });
      gsap.to(deco.current, { opacity: 0.08, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: '+=1000', scrub: true } });

      /* every word of every paragraph lights up as it is read */
      root.querySelectorAll('.lc-p').forEach((p) => {
        gsap.fromTo(p.querySelectorAll('.w'), { opacity: 0.14 }, { opacity: 1, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: p, start: 'top 84%', end: 'bottom 48%', scrub: 0.4 } });
      });
      root.querySelectorAll('.lc-beat').forEach((b, i) => {
        const head = b.querySelector('.lc-head'), rule = b.querySelector('.lc-rule');
        gsap.fromTo(head.children, { opacity: 0 }, { opacity: 1, stagger: 0.12, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 72%' } });
        gsap.fromTo(rule, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: b, start: 'top 70%', end: 'center 50%', scrub: true } });
        const t = BEATS[i].tint;
        ScrollTrigger.create({ trigger: b, start: 'top 60%', end: 'bottom 60%', onToggle: (s) => { if (s.isActive) world.tint = t; } });
      });
      /* the title letters rise in once the curtain is up */
      gsap.set(root.querySelectorAll('.lc-hero .ch'), { yPercent: 110, opacity: 0 });
      gsap.set(root.querySelectorAll('.lc-hero .lc-kicker,.lc-hero .lc-sub,.lc-hero .lc-cue'), { opacity: 0 });
    }, root);
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (!revealed || reduceMotion()) return;
    const root = sec.current;
    const tl = gsap.timeline({ delay: 0.15 });
    tl.to(root.querySelectorAll('.lc-hero .ch'), { yPercent: 0, opacity: 1, duration: 1.5, ease: 'expo.out', stagger: 0.05 })
      .to(root.querySelectorAll('.lc-hero .lc-kicker'), { opacity: 1, duration: 1.2 }, 0.2)
      .to(root.querySelectorAll('.lc-hero .lc-sub'), { opacity: 1, duration: 1.4 }, 0.9)
      .to(root.querySelectorAll('.lc-hero .lc-cue'), { opacity: 1, duration: 1.2 }, 1.5);
    return () => tl.kill();
  }, [revealed]);

  return (
    <section className="landing" id="story" ref={sec} aria-label="The story of the four relics">
      <div className="land-progress" aria-hidden="true"><i ref={bar} /></div>
      <div className="land-deco" ref={deco} aria-hidden="true">
        <svg viewBox="-500 -500 1000 1000" className="land-ring" ref={ring1}>
          <defs><path id="runepath" d="M0-420A420 420 0 1 1 -0.1-420" /></defs>
          <Ring r={470} ticks={120} len={10} op={0.6} />
          <Ring r={400} ticks={48} len={14} op={0.5} />
          <circle r={340} fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 9" />
          <text fontSize="30" fill="currentColor" letterSpacing="26" fontFamily="'Noto Sans Runic','Segoe UI Symbol',serif"><textPath href="#runepath" startOffset="0">{RUNES + RUNES.slice(0, 8)}</textPath></text>
        </svg>
        <svg viewBox="-500 -500 1000 1000" className="land-ring inner" ref={ring2}>
          <Ring r={300} ticks={72} len={8} op={0.5} />
          <circle r={250} fill="none" stroke="currentColor" strokeWidth="1" />
          {[0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + 0.78; return <path key={k} d={`M${Math.cos(a) * 250} ${Math.sin(a) * 250}L${Math.cos(a + 0.2) * 300} ${Math.sin(a + 0.2) * 300}L${Math.cos(a - 0.2) * 300} ${Math.sin(a - 0.2) * 300}Z`} fill="none" stroke="currentColor" strokeWidth="1" />; })}
        </svg>
      </div>
      <Content />
    </section>
  );
}
