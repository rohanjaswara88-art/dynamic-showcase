import { memo } from 'react';
import { Part, Lin, Rad, Pulse } from './kit';
import { makeLine, sampleCR, strip, ribbon, edge, poly, spike, circle, ellipse, rng, rad } from '../lib/geom';

/* ECLIPSE — a black sword with a single red gem. Spear pommel at x = 0, tip at about x = 1560. */
const R = rng(5);

/* spear pommel */
const HEAD = poly([[0, 0], [56, -22], [90, -32], [80, -11], [118, -9], [118, 9], [80, 11], [90, 32], [56, 22]]);
const ROD = poly([[116, -8], [262, -8], [262, 8], [116, 8]]);
const KNOB1 = ellipse(172, 0, 9, 20), KNOB2 = circle(252, 0, 19);
const pomSil = [HEAD, ROD, KNOB1, KNOB2, poly([[262, -22], [292, -26], [292, 26], [262, 22]])];

/* banded grip */
const gripPts = [[292, -17], [338, -14], [400, -11], [450, -13], [492, -19]];
const GRIP = poly([...gripPts, ...gripPts.map(([x, y]) => [x, -y]).reverse()]);
const bands = [...Array(8)].map((_, i) => 306 + i * 24);

/* crossguard */
function horn(sg, pts, w0) {
  const cl = makeLine(sampleCR(pts.map(([x, y]) => [x, y * sg]), 10), 90);
  return ribbon(cl, (t) => w0 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.9) * (1 - 0.3 * t), (t) => w0 * 0.55 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.9), { n: 40 });
}
const CREST = poly([[470, -34], [520, -58], [600, -40], [700, -8], [708, 0], [700, 8], [600, 40], [520, 58], [470, 34], [452, 0]]);
const hornList = [-1, 1].flatMap((sg) => [horn(sg, [[500, 20], [528, 76], [580, 150], [650, 210], [730, 236]], 56), horn(sg, [[520, 22], [548, 56], [590, 98], [640, 124]], 32)]);
const guardSil = [CREST, ...hornList];

/* gem */
const GEM = 'M612 0Q584 -26 548 -23A23 23 0 1 0 548 23Q584 26 612 0Z';

/* fangs: u = upper (y < 0), l = lower (y > 0) */
const fang = (sg, x, y, ang, len, base, bend) => spike(x, y * sg, rad(ang * sg), len, base, bend * sg);
const fangsU = [fang(-1, 660, 52, 10, 230, 50, -0.3), fang(-1, 612, 44, 24, 150, 38, -0.3)];
const fangsL = [fang(1, 660, 52, 10, 230, 50, -0.3), fang(1, 612, 44, 24, 150, 38, -0.3)];

/* blade */
const prof = [[0, 36], [0.05, 54], [0.16, 68], [0.32, 62], [0.55, 46], [0.8, 26], [0.93, 10], [1, 0]];
const W = (t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) { const [a, wa] = prof[i - 1], [b, wb] = prof[i], u = (t - a) / (b - a); return wa + (wb - wa) * u * u * (3 - 2 * u); } return 0; };
const BL = makeLine([[640, 0], [1560, 0]], 80);
const BLADE = strip(BL, (t) => W(t), (t) => -W(t), { n: 64 });
const BLADE_UP = strip(BL, (t) => W(t), 0, { n: 64 });
const FULLER = strip(BL, (t) => 7 * (1 - t * 0.6), (t) => -7 * (1 - t * 0.6), { t0: 0.04, t1: 0.82, n: 40 });
const flecks = [...Array(60)].map(() => {
  const t = 0.02 + R() * 0.9, x = 640 + t * 920, y = (R() * 2 - 1) * W(t) * 0.85, s = 4 + R() * 11, a = R() * 3;
  return { d: poly([[x, y], [x + Math.cos(a) * s, y + Math.sin(a) * s], [x + Math.cos(a + 2) * s * 0.7, y + Math.sin(a + 2) * s * 0.7]]), o: 0.07 + R() * 0.16, dark: R() > 0.5 };
});
const cracks = [[[700, -60], [740, -36], [770, -58], [820, -30], [850, -40]], [[720, 50], [770, 32], [790, 60], [850, 44]], [[900, -20], [940, 4], [972, -8], [1030, 18]], [[1040, 40], [1080, 28], [1100, 46]]];

function Eclipse({ reg }) {
  const P = { wid: 'ecl', reg, shadow: '#000', light: '#ffb4a8' };
  const RIM = '#ff2a2a';
  return (
    <g className="weapon-art">
      <defs>
        <Lin id="ecl-steel" stops={[[0, '#4a4a56'], [0.45, '#1c1c22'], [1, '#08080b']]} />
        <Lin id="ecl-steelX" x2="1" y2="0" stops={[[0, '#2b2b33'], [0.5, '#4c4c58'], [1, '#17171c']]} />
        <Lin id="ecl-bladeU" stops={[[0, '#40404c'], [1, '#17171d']]} />
        <Lin id="ecl-bladeL" stops={[[0, '#14141a'], [1, '#050507']]} />
        <Rad id="ecl-gem" stops={[[0, '#fff0e8'], [0.25, '#ff4a3a'], [0.7, '#c4101c'], [1, '#6a0510']]} cx="0.4" cy="0.35" r="0.7" />
        <Rad id="ecl-halo" stops={[[0, '#ff2a2a', 0.85], [0.4, '#ff2a2a', 0.3], [1, '#ff2a2a', 0]]} />
      </defs>

      <Part {...P} id="pommel" sil={pomSil}>
        <path d={ROD} fill="url(#ecl-steel)" stroke="#5c5c6a" strokeWidth="1.2" />
        <path d={KNOB1} fill="url(#ecl-steelX)" stroke="#6a6a78" strokeWidth="1.5" />
        <path d={KNOB2} fill="url(#ecl-steel)" stroke="#6a6a78" strokeWidth="1.5" />
        <path d={pomSil[4]} fill="url(#ecl-steelX)" stroke="#6a6a78" strokeWidth="1.5" />
        <path d={HEAD} fill="url(#ecl-steel)" stroke="#86869a" strokeWidth="1.6" strokeLinejoin="round" />
        <path d={poly([[0, 0], [56, -22], [90, -32], [80, -11], [118, -9], [118, 0], [56, 0]])} fill="#fff" fillOpacity="0.08" />
        <path d={poly([[4, 0], [100, 0]], false)} stroke="#a5a5b8" strokeWidth="1.4" strokeOpacity="0.6" />
        <path d={HEAD} fill="none" stroke={RIM} strokeWidth="1.2" strokeOpacity="0.55" strokeLinejoin="round" />
      </Part>

      <Part {...P} id="grip" sil={[GRIP]}>
        <path d={GRIP} fill="url(#ecl-steel)" stroke="#44444f" strokeWidth="1.2" />
        {bands.map((x, i) => <path key={i} d={poly([[x, -22], [x + 10, -22], [x + 10, 22], [x, 22]])} fill="url(#ecl-steelX)" stroke="#6a6a78" strokeWidth="1" opacity={0.55 + 0.45 * (i % 2)} />)}
        <path d={poly([[296, -16], [492, -19]], false)} stroke="#8d8da0" strokeWidth="1.4" strokeOpacity="0.5" />
      </Part>

      <Part {...P} id="guard" sil={guardSil}>
        {hornList.map((d, i) => <path key={i} d={d} fill="url(#ecl-steel)" stroke="#8a8a9c" strokeWidth="1.8" strokeLinejoin="round" />)}
        {[-1, 1].map((sg) => <path key={sg} d={edge(makeLine(sampleCR([[510, 24 * sg], [540, 84 * sg], [596, 154 * sg], [660, 208 * sg], [730, 234 * sg]], 8), 70), 0, { n: 40 })} fill="none" stroke={RIM} strokeWidth="1.5" strokeOpacity="0.6" />)}
        <path d={CREST} fill="url(#ecl-steelX)" stroke="#9a9aae" strokeWidth="2" strokeLinejoin="round" />
        <path d={poly([[470, -34], [520, -58], [600, -40], [700, -8], [708, 0], [560, 0], [452, 0]])} fill="#fff" fillOpacity="0.09" />
        <path d={poly([[452, 0], [520, -22], [640, -12], [704, 0]], false)} stroke={RIM} strokeWidth="1.4" strokeOpacity="0.55" fill="none" />
        <path d={CREST} fill="none" stroke={RIM} strokeWidth="1.2" strokeOpacity="0.5" strokeLinejoin="round" />
        <path d={poly([[486, -20], [510, -30], [530, -22]], false)} stroke="#a5a5b8" strokeWidth="1.2" fill="none" strokeOpacity="0.6" />
      </Part>

      <Part {...P} id="gem" sil={[GEM]}>
        <Pulse speed={1.3} min={0.4} max={1}><circle cx="568" cy="0" r="86" fill="url(#ecl-halo)" /></Pulse>
        <path d={GEM} transform="translate(568 0) scale(1.25) translate(-568 0)" fill="#2a0508" stroke="#7d8090" strokeWidth="1.6" />
        <path d={GEM} fill="url(#ecl-gem)" stroke="#ffb0a0" strokeWidth="1.2" />
        <path d="M556 -15Q580 -12 596 -2" fill="none" stroke="#fff" strokeWidth="2.4" strokeOpacity="0.8" strokeLinecap="round" />
        <Pulse speed={1.3} min={0.35} max={0.9}><ellipse cx="554" cy="-4" rx="9" ry="6" fill="#fff" /></Pulse>
      </Part>

      {[['fangsU', fangsU], ['fangsL', fangsL]].map(([id, list]) => (
        <Part key={id} {...P} id={id} sil={list}>
          {list.map((d, i) => (
            <g key={i}><path d={d} fill="url(#ecl-steel)" stroke="#8a8a9c" strokeWidth="1.6" strokeLinejoin="round" />
              <path d={d} fill="none" stroke={RIM} strokeWidth="1.2" strokeOpacity="0.5" strokeLinejoin="round" /></g>
          ))}
        </Part>
      ))}

      <Part {...P} id="blade" sil={[BLADE]}>
        {[[16, 0.07], [7, 0.14]].map(([w, o]) => <path key={w} d={BLADE} fill="none" stroke={RIM} strokeWidth={w} strokeOpacity={o} strokeLinejoin="round" />)}
        <path d={BLADE} fill="url(#ecl-bladeL)" />
        <path d={BLADE_UP} fill="url(#ecl-bladeU)" />
        <path d={flecks.filter((f) => f.dark).map((f) => f.d).join('')} fill="#000" fillOpacity="0.18" />
        <path d={flecks.filter((f) => !f.dark).map((f) => f.d).join('')} fill="#9a9aae" fillOpacity="0.15" />
        <path d={FULLER} fill="#050507" stroke="#5a5a68" strokeWidth="1.3" />
        <path d={edge(BL, (t) => -7 * (1 - t * 0.6), { t0: 0.04, t1: 0.82 })} fill="none" stroke="#a6a6b8" strokeWidth="1.6" strokeOpacity="0.7" />
        <path d={edge(BL, (t) => 7 * (1 - t * 0.6), { t0: 0.04, t1: 0.82 })} fill="none" stroke="#000" strokeWidth="2" strokeOpacity="0.8" />
        {cracks.map((c, i) => <path key={i} d={poly(c, false)} fill="none" stroke="#000" strokeWidth="2" strokeOpacity="0.8" strokeLinejoin="round" />)}
        {cracks.map((c, i) => <path key={'l' + i} d={poly(c, false)} fill="none" stroke="#7a7a8c" strokeWidth="0.8" strokeOpacity="0.5" strokeLinejoin="round" transform="translate(0 1.6)" />)}
        <path d={edge(BL, (t) => W(t), { n: 64 })} fill="none" stroke={RIM} strokeWidth="2" strokeOpacity="0.9" />
        <path d={edge(BL, (t) => -W(t), { n: 64 })} fill="none" stroke={RIM} strokeWidth="2" strokeOpacity="0.9" />
        <path d={edge(BL, (t) => W(t) * 0.96, { n: 64 })} fill="none" stroke="#ffb0a0" strokeWidth="0.8" strokeOpacity="0.45" />
      </Part>
    </g>
  );
}
export default memo(Eclipse);
