import { useEffect, useRef } from 'react';
import { Content } from './Landing';
import { world } from '../lib/world';
import { onFrame } from '../lib/loop';

const Z = 2.1;          // magnification

/** A magnifying glass that follows the pointer over the story. Inside it is a second, scaled-up copy of the story
 *  (always fully lit), shifted so that the point under the pointer sits at the centre of the glass. */
export default function Lens() {
  const frame = useRef(null), worldEl = useRef(null);

  useEffect(() => {
    let sx = -999, sy = -999, on = 0, size = 0, lastW = 0;
    const off = onFrame((now, dt) => {
      const sec = document.getElementById('story'), f = frame.current, w = worldEl.current;
      if (!sec || !f) return;
      const want = world.cur < 0 && world.fine && world.mx > -9000 ? 1 : 0;
      on += (want - on) * (1 - Math.exp(-dt * 12));
      f.style.opacity = on.toFixed(3);
      if (on < 0.01) return;
      const S = Math.round(Math.min(280, Math.max(190, innerWidth * 0.17)));
      if (S !== size) { size = S; f.style.setProperty('--ls', S + 'px'); }
      const k = 1 - Math.exp(-dt * 22);
      if (sx < -900) { sx = world.mx; sy = world.my; }
      sx += (world.mx - sx) * k; sy += (world.my - sy) * k;
      const r = sec.getBoundingClientRect(), R = S / 2;
      if (sec.offsetWidth !== lastW) { lastW = sec.offsetWidth; w.style.width = lastW + 'px'; }
      f.style.transform = `translate3d(${(sx - R).toFixed(1)}px,${(sy - R).toFixed(1)}px,0) scale(${(0.85 + 0.15 * on).toFixed(3)})`;
      w.style.transform = `translate3d(${(R - (sx - r.left) * Z).toFixed(1)}px,${(R - (sy - r.top) * Z).toFixed(1)}px,0) scale(${Z})`;
    });
    return off;
  }, []);

  return (
    <div className="lens-frame" ref={frame} aria-hidden="true">
      <div className="lens">
        <div className="lens-world" ref={worldEl}><Content lens /></div>
      </div>
      <i className="lens-handle" />
    </div>
  );
}
