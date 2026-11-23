import { memo } from 'react';
import { Part, Lin, Rad, Pulse } from './kit';
import { makeLine, bez2, strip, ribbon, edge, poly, spike, circle, ellipse, onLine, rng, rad, polar } from '../lib/geom';

/* AVARICE — a violet greatsword, veined with lightning. Claw pommel at x = 0, curved tip near x = 1560. */
const R = rng(23);

/* the blade: slight sori, tip curls up */
const BL = makeLine(bez2([600, 0], [1150, 60], [1560, -190], 80), 220);
const W = (t) => 104 * Math.pow(1 - t, 0.72) * Math.min(1, 0.6 + t * 6);
const BLADE = ribbon(BL, W, W, { n: 70 });
const BLADE_UP = strip(BL, 0, (t) => -W(t), { n: 70 });
const BEV_TOP = strip(BL, (t) => -W(t), (t) => -W(t) + 8 * (1 - t * 0.5), { n: 70 }), BEV_BOT = strip(BL, (t) => W(t) - 8 * (1 - t * 0.5), (t) => W(t), { n: 70 });
const STREAK = strip(BL, (t) => -W(t) * 0.62 - 2.4, (t) => -W(t) * 0.62 + 2.4, { t0: 0.06, t1: 0.92, n: 50 });
const scr = (n, seed) => { const r = rng(seed); let d = ''; for (let i = 0; i < n; i++) { const t = 0.03 + r() * 0.9, c = onLine(BL, t, (r() * 2 - 1) * W(t) * 0.8), l = 16 + r() * 80; d += `M${c.x.toFixed(1)} ${c.y.toFixed(1)}l${(Math.cos(c.ang) * l).toFixed(1)} ${(Math.sin(c.ang) * l + (r() - 0.5) * 3).toFixed(1)}`; } return d; };
const SCRATCH = scr(44, 77);

/* lightning veins: a wandering main vein and branches, kept inside the blade */
function nearest(x, y) { let b = 0, bd = 1e9; BL.p.forEach(([px, py], i) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; b = i; } }); return { t: b / (BL.p.length - 1), d: Math.sqrt(bd) }; }
const veins = [];
function branch(x, y, ang, len, depth) {
  const pts = [[x, y]];
  for (let s = 0; s < len; s += 20) {
    ang += (R() - 0.5) * 0.9;
    x += Math.cos(ang) * 20; y += Math.sin(ang) * 20;
    const n = nearest(x, y);
    if (n.d > W(n.t) * 0.88) break;
    pts.push([x, y]);
    if (depth < 3 && R() < 0.3) branch(x, y, ang + (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.8), len * 0.6, depth + 1);
  }
  if (pts.length > 1) veins.push({ pts, depth });
}
(function build() {
  const main = [];
  for (let i = 0; i <= 64; i++) { const c = BL.at(i / 64 * 0.97), j = (R() - 0.5) * W(i / 64) * 0.5; main.push([c.x + c.nx * j, c.y + c.ny * j]); }
  veins.push({ pts: main, depth: 0 });
  for (let i = 3; i < 62; i += 2) { const c = BL.at(i / 64 * 0.97), a = c.ang + (R() < 0.5 ? -1 : 1) * (0.7 + R() * 0.7); branch(main[i][0], main[i][1], a, 220 + R() * 160, 1); }
})();
const veinD = (v) => poly(v.pts, false);
const veinGroups = [0, 1, 2, 3].map((d) => ({ depth: d, d: veins.filter((v) => v.depth === d).map(veinD).join('') })).filter((g) => g.d);

/* fins */
const dorsal = [0.12, 0.24, 0.36, 0.48, 0.6].map((t, i) => { const c = onLine(BL, t, -W(t) * 0.8); return spike(c.x, c.y, c.ang - rad(105 - i * 6), 190 - i * 28, 78 - i * 10, 0.3); });
const lower = [0.1, 0.22, 0.34, 0.47].map((t, i) => { const c = onLine(BL, t, W(t) * 0.8); return spike(c.x, c.y, c.ang + rad(105 - i * 8), 120 - i * 20, 52 - i * 7, -0.28); });

/* guard: a dense mass of thorns around the eye */
const EYE = [504, 0];
const thornList = [...Array(15)].map((_, i) => {
  const a = -Math.PI + (i / 15) * Math.PI * 2 + (R() - 0.5) * 0.3, up = Math.abs(Math.sin(a));
  const len = 70 + up * 120 + R() * 60, p = polar(EYE[0], EYE[1], 46, a);
  return spike(p[0], p[1], a, len, 38 + R() * 16, (R() - 0.5) * 0.5);
});
const MASS = [ellipse(EYE[0], EYE[1], 92, 76, 0.2), ellipse(EYE[0] - 40, EYE[1] - 10, 60, 90, -0.4), ellipse(EYE[0] + 50, EYE[1] + 10, 80, 56, 0.5)];
const guardSil = [...MASS, ...thornList];

/* claw pommel */
const claws = [spike(64, 0, rad(180), 100, 38, 0.3), spike(66, 12, rad(220), 86, 30, -0.25), spike(66, -12, rad(140), 86, 30, 0.25), spike(78, 4, rad(100), 54, 22, 0.2), spike(78, -4, rad(-100), 54, 22, -0.2)];
const pomSil = [circle(78, 0, 34), ...claws, poly([[100, -20], [124, -24], [124, 24], [100, 20]])];
const GRIP = poly([[118, -16], [336, -16], [336, 16], [118, 16]]);
const wraps = [...Array(19)].map((_, i) => 124 + i * 11.5);

function Avarice({ reg }) {
  const P = { wid: 'ava', reg, shadow: '#060010', light: '#e8d0ff' };
  return (
    <g className="weapon-art">
      <defs>
        <Lin id="ava-body" stops={[[0, '#5a2fb8'], [0.45, '#2a1070'], [1, '#0d0620']]} />
        <Lin id="ava-dark" stops={[[0, '#3a1c8a'], [1, '#0a0418']]} />
        <Lin id="ava-bladeU" stops={[[0, '#8a5cf0'], [0.35, '#4a22a8'], [1, '#1e0a58']]} />
        <Lin id="ava-bladeL" stops={[[0, '#26105f'], [0.55, '#0c0424'], [1, '#2a0f5a']]} />
        <Lin id="ava-env" stops={[[0, '#ffffff', 0], [0.12, '#e8d8ff', 0.3], [0.24, '#ffffff', 0.03], [0.55, '#000000', 0.28], [0.85, '#b07bff', 0.22], [1, '#b07bff', 0]]} />
        <Lin id="ava-streak" x2="1" y2="0" stops={[[0, '#ffffff', 0], [0.12, '#f0e4ff', 0.9], [0.55, '#d9b8ff', 0.4], [1, '#ffffff', 0]]} />
        <Lin id="ava-sheen" x2="1" y2="0" stops={[[0, '#ffffff', 0], [0.06, '#ffffff', 0.18], [0.35, '#ffffff', 0.05], [1, '#ffffff', 0]]} />
        <Lin id="ava-cord" stops={[[0, '#9a98a8'], [0.5, '#5c5a68'], [1, '#2a2832']]} />
        <Rad id="ava-eye" stops={[[0, '#ffffff'], [0.25, '#e8d0ff'], [0.55, '#9a5cff', 0.85], [1, '#6a2cff', 0]]} />
        <Rad id="ava-halo" stops={[[0, '#b07bff', 0.8], [0.5, '#b07bff', 0.25], [1, '#b07bff', 0]]} />
      </defs>

      <Part {...P} id="pommel" sil={pomSil}>
        {claws.map((d, i) => <path key={i} d={d} fill="url(#ava-dark)" stroke="#8a5ae6" strokeWidth="1.6" strokeLinejoin="round" />)}
        <path d={pomSil[0]} fill="url(#ava-body)" stroke="#a678ff" strokeWidth="2" />
        <path d={pomSil[pomSil.length - 1]} fill="url(#ava-dark)" stroke="#8a5ae6" strokeWidth="1.5" />
        <path d={ellipse(72, -8, 16, 9, -0.5)} fill="#fff" fillOpacity="0.12" />
        <Pulse speed={2}><circle cx="78" cy="0" r="12" fill="url(#ava-eye)" opacity="0.7" /></Pulse>
      </Part>

      <Part {...P} id="grip" sil={[GRIP]}>
        <path d={GRIP} fill="url(#ava-cord)" stroke="#2a2832" strokeWidth="1.2" />
        {wraps.map((x, i) => <path key={i} d={`M${x} -16L${x + 9} 16`} stroke={i % 2 ? '#c6c4d0' : '#3a3844'} strokeWidth="3.2" strokeOpacity="0.8" />)}
        <path d={poly([[118, -14], [336, -14]], false)} stroke="#fff" strokeWidth="1.4" strokeOpacity="0.4" />
        {[[110, 126], [328, 344]].map(([a, b], i) => <path key={i} d={poly([[a, -22], [b, -22], [b, 22], [a, 22]])} fill="url(#ava-dark)" stroke="#8a5ae6" strokeWidth="1.5" />)}
      </Part>

      <Part {...P} id="guard" sil={guardSil}>
        {thornList.map((d, i) => <path key={i} d={d} fill="url(#ava-dark)" stroke="#9a64f0" strokeWidth="1.5" strokeLinejoin="round" />)}
        {MASS.map((d, i) => <path key={i} d={d} fill="url(#ava-body)" stroke="#8a5ae6" strokeWidth="1.8" />)}
        {[...Array(9)].map((_, i) => { const a = -Math.PI + i * 0.7, p1 = polar(EYE[0], EYE[1], 40, a), p2 = polar(EYE[0], EYE[1], 110 + (i % 3) * 20, a + 0.15); return <Pulse key={i} speed={3} phase={i}><path d={`M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${((p1[0] + p2[0]) / 2 + 6).toFixed(1)} ${((p1[1] + p2[1]) / 2 - 4).toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`} fill="none" stroke="#d9b8ff" strokeWidth="1.8" strokeOpacity="0.9" strokeLinecap="round" /></Pulse>; })}
        <circle cx={EYE[0]} cy={EYE[1]} r="40" fill="#07020f" stroke="#a678ff" strokeWidth="2.5" />
      </Part>

      <Part {...P} id="eye" sil={[circle(EYE[0], EYE[1], 34)]}>
        <Pulse speed={2.2} min={0.4} max={1}><circle cx={EYE[0]} cy={EYE[1]} r="110" fill="url(#ava-halo)" /></Pulse>
        <circle cx={EYE[0]} cy={EYE[1]} r="32" fill="url(#ava-eye)" stroke="#e8d0ff" strokeWidth="1.5" />
        <ellipse cx={EYE[0]} cy={EYE[1]} rx="8" ry="25" fill="#10062a" />
        <Pulse speed={2.2} min={0.3} max={0.9}><ellipse cx={EYE[0] - 6} cy={EYE[1] - 8} rx="5" ry="3.5" fill="#fff" /></Pulse>
      </Part>

      {[['finsU', dorsal], ['finsL', lower]].map(([id, list]) => (
        <Part key={id} {...P} id={id} sil={list}>
          {list.map((d, i) => (
            <g key={i}><path d={d} fill="url(#ava-dark)" stroke="#a678ff" strokeWidth="1.8" strokeLinejoin="round" />
              <path d={d} fill="url(#ava-bladeU)" fillOpacity="0.3" /></g>
          ))}
        </Part>
      ))}

      <Part {...P} id="blade" sil={[BLADE]}>
        {[[48, 0.04], [24, 0.07]].map(([w, o]) => <path key={w} d={veinD(veins[0])} fill="none" stroke="#b07bff" strokeWidth={w} strokeOpacity={o} strokeLinecap="round" strokeLinejoin="round" />)}
        <path d={BLADE} fill="url(#ava-bladeL)" />
        <path d={BLADE_UP} fill="url(#ava-bladeU)" />
        <path d={BLADE} fill="url(#ava-env)" />
        <path d={BLADE} fill="url(#ava-sheen)" />
        <path d={BEV_TOP} fill="#f0e4ff" fillOpacity="0.32" />
        <path d={BEV_BOT} fill="#000" fillOpacity="0.5" />
        <path d={SCRATCH} fill="none" stroke="#e0d0ff" strokeWidth="0.7" strokeOpacity="0.18" />
        <path d={STREAK} fill="url(#ava-streak)" />
        <path d={edge(BL, (t) => -W(t) * 0.5, { t0: 0.02, t1: 0.9 })} fill="none" stroke="#9a64f0" strokeWidth="1.2" strokeOpacity="0.4" />
        <Pulse speed={3.2} min={0.55} max={1}>
          {veinGroups.map((g) => <path key={'b' + g.depth} d={g.d} fill="none" stroke="#9a5cff" strokeWidth={16 - g.depth * 4} strokeOpacity="0.22" strokeLinecap="round" strokeLinejoin="round" />)}
          {veinGroups.map((g) => <path key={'m' + g.depth} d={g.d} fill="none" stroke="#c9a2ff" strokeWidth={5 - g.depth * 1.1} strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" />)}
          {veinGroups.map((g) => <path key={'c' + g.depth} d={g.d} fill="none" stroke="#fff" strokeWidth={2 - g.depth * 0.3} strokeOpacity={0.95 - g.depth * 0.12} strokeLinecap="round" strokeLinejoin="round" />)}
        </Pulse>
        <path d={edge(BL, (t) => -W(t), { n: 70 })} fill="none" stroke="#b890ff" strokeWidth="2.2" strokeOpacity="0.85" />
        <path d={edge(BL, (t) => W(t), { n: 70 })} fill="none" stroke="#e8d0ff" strokeWidth="2.4" strokeOpacity="0.9" />
      </Part>
    </g>
  );
}
export default memo(Avarice);
