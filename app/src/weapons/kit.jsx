/* Shared pieces for drawing a weapon as pure SVG: gradients, and the Part wrapper.
   A Part carries (1) a soft cast shadow made from stacked, widening strokes of its own silhouette (no SVG filters),
   (2) the art itself, (3) a cursor "light" overlay and (4) an infrared "heat" overlay, both clipped to the silhouette
   by being <use> copies of it, so they follow the part wherever it flies. */

export const Stops = ({ stops }) => stops.map(([o, c, a = 1], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={a} />);

/** objectBoundingBox linear gradient; default runs top to bottom across a blade lying along +x */
export const Lin = ({ id, x1 = 0, y1 = 0, x2 = 0, y2 = 1, stops, user }) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={user ? 'userSpaceOnUse' : 'objectBoundingBox'}><Stops stops={stops} /></linearGradient>
);
export const Rad = ({ id, cx = 0.5, cy = 0.5, r = 0.5, fx, fy, stops, user }) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx ?? cx} fy={fy ?? cy} gradientUnits={user ? 'userSpaceOnUse' : 'objectBoundingBox'}><Stops stops={stops} /></radialGradient>
);

const SHADOW = [[26, 0.07], [7, 0.15]];
const HEAT_STOPS = [[0, '#ffffff', 0.95], [0.14, '#fff27a', 0.92], [0.32, '#ff9a1f', 0.88], [0.52, '#e3213f', 0.78], [0.74, '#7b1fa2', 0.5], [1, '#1a1a8a', 0]];

export function Part({ wid, id, reg, sil, shadow = '#000', light = '#ffffff', children }) {
  const key = `${wid}-${id}`, sid = 's-' + key, r = (k) => (el) => reg(k + ':' + id, el);
  const shapes = [].concat(sil);
  return (
    <>
      <defs>
        <g id={sid} fillRule="evenodd">{shapes.map((d, i) => <path key={i} d={d} />)}</g>
        <radialGradient id={'lg-' + key} ref={r('lg')} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
          <Stops stops={[[0, light, 0.95], [0.18, light, 0.6], [0.5, light, 0.16], [1, light, 0]]} />
        </radialGradient>
        <radialGradient id={'hg-' + key} ref={r('hg')} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
          <Stops stops={HEAT_STOPS} />
        </radialGradient>
      </defs>
      <g ref={(el) => reg(id, el)} data-part={id}>
        <g ref={r('sh')} pointerEvents="none">
          {SHADOW.map(([w, o]) => <use key={w} href={'#' + sid} fill={shadow} stroke={shadow} strokeWidth={w} strokeLinejoin="round" opacity={o} />)}
        </g>
        <g className="body" ref={r('body')}>{children}</g>
        <use className="heat" href={'#' + sid} fill={`url(#hg-${key})`} opacity="0" ref={r('ho')} pointerEvents="none" style={{ display: 'none' }} />
        <use className="light" data-part={id} href={'#' + sid} fill={`url(#lg-${key})`} opacity="0" ref={r('lo')} pointerEvents="none" style={{ display: 'none' }} />
      </g>
    </>
  );
}

/** A glow that breathes: `data-pulse="speed,min,max"` is read by the stage loop. */
export const Pulse = ({ speed = 2, min = 0.55, max = 1, phase = 0, children, ...rest }) => <g data-pulse={`${speed},${min},${max},${phase}`} {...rest}>{children}</g>;
