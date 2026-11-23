import { memo } from 'react';
import { Part, Lin, Rad, Pulse } from './kit';
import { makeLine, sampleCR, strip, ribbon, edge, poly, rng, rad } from '../lib/geom';

/* HALCYON — an ice-crystal sword. Pommel at x = 0, blade tip at about x = 1445. */
const R = rng(11);

/* pommel crystal */
const POM = [[0, 0], [34, -34], [104, -38], [132, 0], [104, 38], [34, 34]];
const pomFacets = [[[0, 0], [34, -34], [62, 0]], [[34, -34], [104, -38], [62, 0]], [[104, -38], [132, 0], [62, 0]], [[0, 0], [62, 0], [34, 34]], [[34, 34], [62, 0], [104, 38]], [[104, 38], [62, 0], [132, 0]]];

/* grip lattice */
const zig = (x0, x1, y, per, ph) => { const o = []; for (let x = x0 - ph; x <= x1 + per; x += per / 2) o.push([x, (Math.round((x - x0 + ph) / (per / 2)) % 2) ? y : -y]); return o; };
const gripSil = [poly([[150, -16], [318, -16], [318, 16], [150, 16]]), poly([[134, -23], [160, -23], [160, 23], [134, 23]]), poly([[306, -26], [336, -26], [336, 26], [306, 26]])];

/* wing guard: layered feathers, mirrored about the axis */
function feather(sign, pts, w0, tipLen = 1) {
  const cl = makeLine(sampleCR(pts.map(([x, y]) => [x, y * sign]), 10), 90);
  return ribbon(cl, (t) => w0 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8) * (1 - 0.1 * t), (t) => w0 * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8), { n: 36 });
}
const wingDefs = [];
[-1, 1].forEach((sg) => {
  wingDefs.push({ d: feather(sg, [[352, 30], [392, 118], [470, 206], [590, 252], [700, 252]], 62), tone: 0 });
  wingDefs.push({ d: feather(sg, [[352, 24], [388, 96], [452, 160], [540, 190], [630, 192]], 46), tone: 1 });
  wingDefs.push({ d: feather(sg, [[350, 20], [380, 70], [430, 112], [490, 132], [550, 136]], 32), tone: 2 });
  wingDefs.push({ d: feather(sg, [[356, 40], [318, 100], [262, 150], [210, 168]], 30), tone: 1 });
  wingDefs.push({ d: feather(sg, [[392, 48], [480, 56], [620, 62], [780, 64]], 16), tone: 2 });
});
const wingSil = wingDefs.map((w) => w.d);
const toneFill = ['url(#hal-wing0)', 'url(#hal-wing1)', 'url(#hal-wing2)'];

/* the violet shards */
function shards(list) { return list.map(([x, y, len, w, a, c]) => { const ca = Math.cos(rad(a)), sa = Math.sin(rad(a)); const P = (u, v) => [x + ca * u - sa * v, y + sa * u + ca * v]; return { tip: P(len, 0), top: P(len * 0.35, -w), bot: P(len * 0.35, w), base: P(0, 0), c }; }); }
const SU = shards([[420, -168, 150, 22, -72, 0], [480, -176, 190, 26, -50, 1], [540, -190, 210, 24, -28, 0], [440, -150, 120, 18, -100, 1], [610, -212, 170, 22, -16, 1], [520, -150, 130, 16, -38, 0]]);
const SL = shards([[420, 168, 140, 22, 72, 0], [488, 176, 180, 25, 50, 1], [560, 190, 190, 22, 26, 0], [450, 150, 110, 17, 100, 1], [610, 150, 130, 18, 34, 1]]);
const shardPath = (s) => poly([s.base, s.top, s.tip, s.bot]);

/* the blade */
const bladeTop = [[456, -46], [700, -42], [1000, -36], [1250, -29], [1390, -23]], bladeBot = [[456, 46], [700, 43], [1000, 38], [1250, 31], [1360, 27]];
const BLADE = poly([...bladeTop, [1448, 20], ...bladeBot.slice().reverse()]);
const BLADE_UP = poly([...bladeTop, [1448, 20], [1392, 0], [456, 0]]);
const bladeFacets = [...Array(22)].map((_, i) => {
  const x = 470 + i * 44 + R() * 20, w = 30 + R() * 26, h = 40 + R() * 34, y = (R() - 0.5) * 60, sk = (R() - 0.5) * 40;
  return { d: poly([[x, y - h / 2], [x + w, y - h / 2 + sk], [x + w + 14, y + h / 2], [x - 6, y + h / 2 - sk]]), o: 0.06 + R() * 0.17, light: R() > 0.45 };
});
const cracks = [[[470, -30], [506, -18], [526, -26], [562, -4], [596, -12]], [[480, 22], [520, 14], [534, 30], [580, 24]], [[500, -6], [540, 6], [552, -4], [606, 10], [640, 4]]];

function Halcyon({ reg }) {
  const P = { wid: 'hal', reg, shadow: '#05071a', light: '#e6f6ff' };
  return (
    <g className="weapon-art">
      <defs>
        <Lin id="hal-pom" stops={[[0, '#f4f1ff'], [0.5, '#c9b9ff'], [1, '#8d76ee']]} x2="1" y2="1" />
        <Lin id="hal-white" stops={[[0, '#ffffff'], [0.5, '#f1ecff'], [1, '#b9a8ff']]} />
        <Lin id="hal-wing0" stops={[[0, '#ffffff'], [0.55, '#e8e0ff'], [1, '#a38df0']]} x2="1" y2="0.4" />
        <Lin id="hal-wing1" stops={[[0, '#f4f1ff'], [0.6, '#c9b9ff'], [1, '#8f78ee']]} x2="1" y2="0.4" />
        <Lin id="hal-wing2" stops={[[0, '#ffffff'], [1, '#c4b2ff']]} x2="1" />
        <Lin id="hal-shard" stops={[[0, '#d9ccff'], [1, '#6a4fe0']]} x2="1" y2="1" />
        <Lin id="hal-bladeU" stops={[[0, '#f2fdff'], [1, '#a4dcff']]} />
        <Lin id="hal-bladeL" stops={[[0, '#86bdff'], [1, '#4a7ee0']]} />
        <Lin id="hal-gem" stops={[[0, '#bff1ff'], [0.5, '#5ab4ff'], [1, '#2b5fd6']]} x2="1" y2="1" />
        <Rad id="hal-glow" stops={[[0, '#c8f6ff', 0.95], [0.35, '#5ab4ff', 0.5], [1, '#5ab4ff', 0]]} />
      </defs>

      <Part {...P} id="pommel" sil={[poly(POM), poly([[128, -16], [150, -20], [150, 20], [128, 16]])]}>
        <path d={poly(POM)} fill="url(#hal-pom)" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        {pomFacets.map((f, i) => <path key={i} d={poly(f)} fill={i % 2 ? '#7c63e6' : '#ffffff'} fillOpacity={i % 2 ? 0.28 : 0.3} />)}
        <path d={poly(POM)} fill="none" stroke="#e8e0ff" strokeWidth="1.2" strokeOpacity="0.8" />
        <path d={poly([[128, -16], [150, -20], [150, 20], [128, 16]])} fill="url(#hal-white)" stroke="#b9a8ff" strokeWidth="1.5" />
        <Pulse speed={1.4}><circle cx="62" cy="0" r="22" fill="url(#hal-glow)" opacity="0.6" /></Pulse>
      </Part>

      <Part {...P} id="grip" sil={gripSil}>
        <path d={gripSil[0]} fill="url(#hal-white)" stroke="#fff" strokeWidth="1.5" />
        {[0, 15].map((ph) => <path key={ph} d={'M' + zig(152, 318, 14, 30, ph).filter(([x]) => x >= 150 && x <= 318).map(([x, y]) => `${x} ${y}`).join('L')} fill="none" stroke="#9c88f0" strokeWidth="1.5" strokeOpacity="0.8" />)}
        <path d={poly([[150, -14], [318, -14]], false)} fill="none" stroke="#fff" strokeWidth="2" strokeOpacity="0.9" />
        {[gripSil[1], gripSil[2]].map((d, i) => <path key={i} d={d} fill="url(#hal-white)" stroke="#8d76ee" strokeWidth="2" strokeLinejoin="round" />)}
        <path d={poly([[138, -17], [156, -17]], false)} stroke="#fff" strokeWidth="2" />
        <path d={poly([[310, -20], [332, -20]], false)} stroke="#fff" strokeWidth="2" />
      </Part>

      <Part {...P} id="core" sil={[poly([[352, 0], [386, -50], [420, 0], [386, 50]])]}>
        <Pulse speed={1.5} min={0.5} max={1}><circle cx="386" cy="0" r="90" fill="url(#hal-glow)" /></Pulse>
        <path d={poly([[346, 0], [386, -58], [426, 0], [386, 58]])} fill="url(#hal-white)" stroke="#b9a8ff" strokeWidth="2" />
        <path d={poly([[352, 0], [386, -50], [420, 0], [386, 50]])} fill="url(#hal-gem)" stroke="#e8fbff" strokeWidth="1.5" />
        <path d={poly([[352, 0], [386, -50], [386, 0]])} fill="#ffffff" fillOpacity="0.38" />
        <path d={poly([[386, -50], [420, 0], [386, 0]])} fill="#aef0ff" fillOpacity="0.22" />
        <path d={poly([[386, 0], [420, 0], [386, 50]])} fill="#102a8a" fillOpacity="0.32" />
        <path d={poly([[352, 0], [386, 0], [386, 50]])} fill="#2a58c4" fillOpacity="0.22" />
        <path d={poly([[368, -24], [386, -8], [404, -24]], false)} fill="none" stroke="#fff" strokeWidth="1" strokeOpacity="0.6" />
        <Pulse speed={1.5} min={0.4} max={1}><circle cx="386" cy="0" r="14" fill="#e8fcff" opacity="0.9" /></Pulse>
      </Part>

      <Part {...P} id="wings" sil={wingSil}>
        {wingDefs.slice().sort((a, b) => b.tone - a.tone).map((w, i) => (
          <g key={i}><path d={w.d} fill={toneFill[w.tone]} stroke="#fff" strokeWidth="1.8" strokeOpacity="0.95" strokeLinejoin="round" />
            <path d={w.d} fill="none" stroke="#8d76ee" strokeWidth="1" strokeOpacity="0.5" /></g>
        ))}
        {[-1, 1].map((sg) => <path key={sg} d={edge(makeLine(sampleCR([[360, 28 * sg], [400, 120 * sg], [480, 208 * sg], [600, 252 * sg]], 8), 60), 0, { n: 40 })} fill="none" stroke="#7c63e6" strokeWidth="1.4" strokeOpacity="0.5" />)}
      </Part>

      {[['shardsU', SU], ['shardsL', SL]].map(([id, list]) => (
        <Part key={id} {...P} id={id} sil={list.map(shardPath)}>
          {list.map((s, i) => (
            <g key={i}>
              <path d={shardPath(s)} fill="url(#hal-shard)" stroke="#e8e0ff" strokeWidth="1.5" strokeLinejoin="round" />
              <path d={poly([s.base, s.top, s.tip])} fill="#ffffff" fillOpacity={s.c ? 0.32 : 0.22} />
              <path d={poly([s.base, s.tip], false)} stroke="#fff" strokeWidth="1" strokeOpacity="0.6" />
            </g>
          ))}
        </Part>
      ))}

      <Part {...P} id="blade" sil={[BLADE]}>
        <Pulse speed={1.5} min={0.35} max={0.8}><ellipse cx="520" cy="0" rx="130" ry="46" fill="url(#hal-glow)" /></Pulse>
        <path d={BLADE} fill="url(#hal-bladeL)" />
        <path d={BLADE_UP} fill="url(#hal-bladeU)" />
        <path d={bladeFacets.filter((f) => f.light).map((f) => f.d).join('')} fill="#fff" fillOpacity="0.14" />
        <path d={bladeFacets.filter((f) => !f.light).map((f) => f.d).join('')} fill="#0b2a8a" fillOpacity="0.1" />
        <path d={[...Array(12)].map((_, i) => { const x = 520 + i * 78; return `M${x} -44L${x + 36} 0L${x + 6} 44`; }).join('')} fill="none" stroke="#fff" strokeWidth="1" strokeOpacity="0.28" />
        <path d={poly([[462, 0], [900, -7], [1380, -3], [1448, 20], [1380, 5], [900, 7]])} fill="#ffffff" fillOpacity="0.9" />
        <path d={poly([[462, 0], [1392, 0]], false)} stroke="#fff" strokeWidth="2.4" />
        {cracks.map((c, i) => <path key={i} d={poly(c, false)} fill="none" stroke="#10185a" strokeWidth="2.2" strokeOpacity="0.85" strokeLinejoin="round" />)}
        <path d={poly([...bladeTop, [1448, 20]], false)} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <path d={poly([...bladeBot, [1360, 27], [1448, 20]], false)} fill="none" stroke="#c8e6ff" strokeWidth="1.8" strokeLinejoin="round" />
        <path d={poly([[1250, -29], [1448, 20], [1392, 0]])} fill="#fff" fillOpacity="0.35" />
      </Part>
    </g>
  );
}
export default memo(Halcyon);
