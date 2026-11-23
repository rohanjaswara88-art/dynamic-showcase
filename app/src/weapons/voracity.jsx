import { memo } from 'react';
import { Part, Lin, Rad, Pulse } from './kit';
import { makeLine, strip, edge, ribbon, spike, ellipse, circle, bez2, sampleCR, onLine, rad, polar, curve, poly } from '../lib/geom';

/* VORACITY — a scythe. Foot at x = 0, shaft runs +x to the head near x = 1130, the blade climbs +y and curls back. */
const BL = makeLine(bez2([1130, 50], [1480, 300], [1040, 790], 90), 240);
const wTot = (t) => 205 * Math.pow(1 - t, 0.9) * Math.min(1, 0.55 + t * 5);
const wA = (t) => wTot(t) * 0.58, wB = (t) => wTot(t) * 0.42;                 // A = glowing inner (concave) side, B = dark spiny back
const SH = makeLine(sampleCR([[120, 0], [420, -16], [760, 12], [1050, -6]], 12), 220);

/* outer spines of the blade */
const bladeSpikes = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((t, i) => {
  const c = onLine(BL, t, -wB(t) * 0.95);
  const ang = Math.atan2(-c.ny * 0.75 - c.ty * 0.9, -c.nx * 0.75 - c.tx * 0.9);
  return spike(c.x, c.y, ang, 92 - i * 8, 46 - i * 3.5, 0.28);
});
const bladeSil = [ribbon(BL, wA, wB), ...bladeSpikes];

const eyelets = [0.07, 0.17, 0.27, 0.37, 0.48, 0.6].map((t) => {
  const c = onLine(BL, t, -wTot(t) * 0.13), w = wTot(t);
  return { path: ellipse(c.x, c.y, w * 0.2, w * 0.055 + 3, c.ang), x: c.x, y: c.y };
});

/* mantle: layered plates over the blade root and thorns off the ring */
const RING = [1130, -20];
const plateDefs = [0, 1, 2].map((i) => strip(BL, (t) => -wB(t) * (0.05 + 0.28 * i), (t) => -(wB(t) * (1.08 + 0.12 * i) + 16 * i), { t0: 0.01 + 0.03 * i, t1: 0.52 - 0.1 * i }));
const plateTips = [0, 1, 2].map((i) => { const t = 0.52 - 0.1 * i, c = onLine(BL, t, -(wB(t) * (0.6 + 0.1 * i))); return spike(c.x, c.y, c.ang + rad(-12), 120 - i * 26, 56 - i * 8, 0.18); });
const crown = [[180, 330, 44], [208, 240, 38], [236, 200, 36], [262, 230, 34], [290, 180, 30], [152, 150, 36], [118, 110, 30], [322, 120, 28]].map(([a, l, b]) => {
  const p = polar(RING[0], RING[1], 86, rad(a));
  return spike(p[0], p[1], rad(a), l, b, a < 200 ? -0.1 : 0.12);
});
const mantleSil = [...plateDefs, ...plateTips, ...crown];

/* helix binding: two strands crossing every half turn */
function helix(x0, x1, amp, lam) {
  const half = lam / 2, segs = [];
  for (let x = x0, k = 0; x < x1 - 1; x += half, k++) {
    const pa = [], pb = [];
    for (let i = 0; i <= 10; i++) {
      const xx = x + (half * i) / 10, ph = ((xx - x0) / lam) * Math.PI * 2;
      pa.push([xx, Math.sin(ph) * amp]); pb.push([xx, -Math.sin(ph) * amp]);
    }
    segs.push({ a: curve(pa), b: curve(pb), top: k % 2 ? 'a' : 'b', cx: x + half });
  }
  return segs;
}
const HX1 = helix(235, 375, 25, 70), HX2 = helix(870, 1010, 25, 70);
const helixSil = (x0, x1) => [strip(makeLine([[x0 - 12, 0], [x1 + 12, 0]], 4), 40, -40, { n: 2 })];

/* twin vine along the shaft */
const vine = (ph) => {
  const pts = [];
  for (let x = 140; x <= 1040; x += 14) pts.push([x, Math.sin(x / 58 + ph) * 15 - (x / 1050) * 8]);
  return makeLine(pts, 200);
};
const V1 = vine(0), V2 = vine(Math.PI);
const thorns = [...Array(14)].map((_, i) => { const x = 160 + i * 64, y = Math.sin(x / 58) * 15 - (x / 1050) * 8; return spike(x, y, rad(i % 2 ? -78 : 78), 24, 10, 0.3); });

/* foot ornament */
const FOOT_OUT = strip(makeLine([[18, 0], [128, 0]], 8), (t) => 50 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.8), (t) => -50 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.8), { n: 24 });
const FOOT_IN = strip(makeLine([[38, 0], [108, 0]], 8), (t) => 26 * Math.sin(Math.PI * t), (t) => -26 * Math.sin(Math.PI * t), { n: 24 });
const footSil = [FOOT_OUT, FOOT_IN, spike(26, 0, Math.PI, 112, 44, 0), spike(90, 40, rad(100), 40, 16, 0.2), spike(90, -40, rad(-100), 40, 16, -0.2)];

/* the ring */
const ringHoles = [200, 262, 330].map((a) => polar(RING[0], RING[1], 92, rad(a)));
const ringSil = [circle(RING[0], RING[1], 118), circle(RING[0], RING[1], 66)];

function Voracity({ reg }) {
  const W = 'vor', P = { wid: W, reg, shadow: '#07000f', light: '#ffb8f6' };
  return (
    <g className="weapon-art">
      <defs>
        <Lin id="vor-body" stops={[[0, '#4a2478'], [0.45, '#2a1248'], [1, '#12061f']]} />
        <Lin id="vor-dark" stops={[[0, '#3c1a63'], [0.5, '#1c0b33'], [1, '#0d0418']]} />
        <Lin id="vor-bladeA" stops={[[0, '#2a1048'], [1, '#120620']]} />
        <Rad id="vor-eye" stops={[[0, '#fff3ff'], [0.3, '#ff7cf2'], [0.7, '#c24bff', 0.7], [1, '#c24bff', 0]]} />
        <Rad id="vor-bead" stops={[[0, '#ffffff'], [0.4, '#ff6ef0'], [1, '#ff6ef0', 0]]} />
      </defs>

      <Part {...P} id="foot" sil={footSil}>
        <path d={footSil[2]} fill="url(#vor-dark)" stroke="#7a3fc4" strokeWidth="1.5" />
        <path d={footSil[3]} fill="url(#vor-dark)" /><path d={footSil[4]} fill="url(#vor-dark)" />
        <path d={FOOT_OUT} fill="url(#vor-body)" stroke="#8a4ed8" strokeWidth="2" />
        <path d={FOOT_IN} fill="#050008" stroke="#ff6ef0" strokeWidth="2" strokeOpacity="0.85" />
        <path d={edge(makeLine([[26, -42], [100, -34], [128, 0]], 20), 0, { n: 14 })} fill="none" stroke="#cf9bff" strokeWidth="2" strokeOpacity="0.5" />
        <Pulse speed={2.2}><circle cx="73" cy="0" r="18" fill="url(#vor-bead)" opacity="0.6" /></Pulse>
      </Part>

      <Part {...P} id="lowbind" sil={helixSil(235, 375)}>
        <rect x="223" y="-22" width="14" height="44" rx="6" fill="url(#vor-dark)" stroke="#8a4ed8" strokeWidth="1.5" />
        <rect x="373" y="-22" width="14" height="44" rx="6" fill="url(#vor-dark)" stroke="#8a4ed8" strokeWidth="1.5" />
        {HX1.map((s, i) => [s.top === 'a' ? 'b' : 'a', s.top].map((k, j) => <path key={i + k} d={s[k]} fill="none" stroke={j ? '#6a35b0' : '#1a0a2e'} strokeWidth={j ? 11 : 12} strokeLinecap="round" />))}
        {HX1.map((s, i) => <path key={'h' + i} d={s[s.top]} fill="none" stroke="#c9a2ff" strokeWidth="1.8" strokeOpacity="0.55" strokeLinecap="round" transform="translate(0 -3)" />)}
        {HX1.map((s, i) => <circle key={'b' + i} cx={s.cx} cy="0" r="4.5" fill="url(#vor-bead)" />)}
      </Part>

      <Part {...P} id="shaft" sil={[strip(SH, 17, -17, { n: 60 })]}>
        <path d={strip(SH, 17, -17, { n: 60 })} fill="url(#vor-body)" stroke="#6a35b0" strokeWidth="1.4" />
        <path d={edge(SH, -9, { n: 60 })} fill="none" stroke="#a97cf0" strokeWidth="2" strokeOpacity="0.55" />
        {[V1, V2].map((V, i) => <path key={i} d={ribbon(V, 5.5, 5.5, { n: 120 })} fill="#241040" stroke={i ? '#8a4ed8' : '#b58aff'} strokeWidth="1.3" strokeOpacity="0.8" />)}
        {thorns.map((d, i) => <path key={i} d={d} fill="#1a0a2e" stroke="#9a64e8" strokeWidth="1" />)}
        {[0.12, 0.3, 0.5, 0.68, 0.86].map((t, i) => { const c = onLine(SH, t); return <circle key={i} cx={c.x} cy={c.y} r="5" fill="url(#vor-bead)" opacity="0.8" />; })}
      </Part>

      <Part {...P} id="upbind" sil={helixSil(870, 1010)}>
        <rect x="858" y="-22" width="14" height="44" rx="6" fill="url(#vor-dark)" stroke="#8a4ed8" strokeWidth="1.5" />
        <rect x="1008" y="-22" width="14" height="44" rx="6" fill="url(#vor-dark)" stroke="#8a4ed8" strokeWidth="1.5" />
        {HX2.map((s, i) => [s.top === 'a' ? 'b' : 'a', s.top].map((k, j) => <path key={i + k} d={s[k]} fill="none" stroke={j ? '#6a35b0' : '#1a0a2e'} strokeWidth={j ? 11 : 12} strokeLinecap="round" />))}
        {HX2.map((s, i) => <path key={'h' + i} d={s[s.top]} fill="none" stroke="#c9a2ff" strokeWidth="1.8" strokeOpacity="0.55" strokeLinecap="round" transform="translate(0 -3)" />)}
        {HX2.map((s, i) => <circle key={'b' + i} cx={s.cx} cy="0" r="4.5" fill="url(#vor-bead)" />)}
      </Part>

      <Part {...P} id="ring" sil={ringSil}>
        <path d={ringSil[0]} fill="url(#vor-body)" stroke="#8a4ed8" strokeWidth="2" />
        <path d={ringSil[1]} fill="none" stroke="#ff6ef0" strokeWidth="3.5" strokeOpacity="0.9" />
        <Pulse speed={1.6}><circle cx={RING[0]} cy={RING[1]} r="70" fill="none" stroke="#ff9af5" strokeWidth="10" opacity="0.3" /></Pulse>
        <path d={ellipse(RING[0], RING[1], 104, 104)} fill="none" stroke="#c9a2ff" strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="60 24 14 24" />
        {ringHoles.map((p, i) => (
          <g key={i}><circle cx={p[0]} cy={p[1]} r="17" fill="#07000f" stroke="#a974f0" strokeWidth="2" />
            <Pulse speed={2 + i * 0.4} phase={i}><circle cx={p[0]} cy={p[1]} r="13" fill="url(#vor-eye)" /></Pulse></g>
        ))}
      </Part>

      <Part {...P} id="mantle" sil={mantleSil}>
        {crown.map((d, i) => <path key={i} d={d} fill="url(#vor-dark)" stroke="#8a4ed8" strokeWidth="1.8" strokeLinejoin="round" />)}
        {plateDefs.map((d, i) => (
          <g key={i}>
            <path d={d} fill="url(#vor-body)" stroke="#9a64e8" strokeWidth="1.8" />
            <path d={plateTips[i]} fill="url(#vor-dark)" stroke="#9a64e8" strokeWidth="1.8" strokeLinejoin="round" />
            <path d={edge(BL, (t) => -(wB(t) * (0.55 + 0.28 * i)), { t0: 0.04 + 0.03 * i, t1: 0.48 - 0.1 * i })} fill="none" stroke="#d1a8ff" strokeWidth="2" strokeOpacity="0.45" />
          </g>
        ))}
        {[0.1, 0.24, 0.38].map((t, i) => { const c = onLine(BL, t, -wB(t) * 0.55); return <Pulse key={i} speed={2 + i * 0.3} phase={i * 2}><path d={ellipse(c.x, c.y, wTot(t) * 0.14, 9, c.ang)} fill="url(#vor-eye)" /></Pulse>; })}
      </Part>

      <Part {...P} id="blade" sil={bladeSil}>
        {[[70, 0.05], [42, 0.08], [24, 0.14], [12, 0.26]].map(([w, o], i) => (
          <path key={i} d={edge(BL, (t) => wA(t) * 0.96, { t0: 0, t1: 0.97, n: 70 })} fill="none" stroke="#ff6ef0" strokeWidth={w} strokeOpacity={o} strokeLinecap="round" />
        ))}
        {bladeSpikes.map((d, i) => <path key={i} d={d} fill="url(#vor-dark)" stroke="#9a64e8" strokeWidth="1.6" strokeLinejoin="round" />)}
        <path d={ribbon(BL, wA, wB, { n: 70 })} fill="url(#vor-bladeA)" />
        {[[0.97, '#8a2be2', 0.3], [0.78, '#b043ff', 0.26], [0.6, '#df56f5', 0.26], [0.42, '#ff6ef0', 0.28], [0.24, '#ff9af5', 0.34], [0.1, '#ffe0fc', 0.6]].map(([k, c, o], i) => (
          <path key={i} d={strip(BL, (t) => wA(t), (t) => wA(t) * (1 - k), { n: 70 })} fill={c} fillOpacity={o} />
        ))}
        <path d={strip(BL, 0, (t) => -wB(t), { n: 70 })} fill="url(#vor-bladeA)" fillOpacity="0.93" />
        {[0.28, 0.56, 0.82].map((k, i) => <path key={i} d={edge(BL, (t) => -wB(t) * k, { t0: 0.02, t1: 0.9 - i * 0.1, n: 60 })} fill="none" stroke="#7a3fc4" strokeWidth="1.5" strokeOpacity="0.7" />)}
        <path d={[...Array(16)].map((_, i) => { const t = 0.05 + i * 0.054, a = onLine(BL, t, -wB(t) * 0.04), b = onLine(BL, t + 0.03, -wB(t) * 0.92); return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`; }).join('')} stroke="#4a2478" strokeWidth="1.3" strokeOpacity="0.8" fill="none" />
        {eyelets.map((e, i) => (
          <g key={i}><path d={e.path} fill="#120620" stroke="#b98aff" strokeWidth="2.4" />
            <Pulse speed={2 + (i % 3) * 0.35} phase={i * 1.3}><path d={e.path} fill="url(#vor-eye)" transform={`translate(${e.x} ${e.y}) scale(0.82) translate(${-e.x} ${-e.y})`} /></Pulse></g>
        ))}
        <path d={edge(BL, (t) => -wB(t), { n: 70 })} fill="none" stroke="#b58aff" strokeWidth="2" strokeOpacity="0.7" />
        <path d={edge(BL, (t) => wA(t), { n: 70 })} fill="none" stroke="#fff0ff" strokeWidth="2.6" strokeOpacity="0.95" strokeLinecap="round" />
      </Part>
    </g>
  );
}
export default memo(Voracity);
