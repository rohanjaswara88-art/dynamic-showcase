import { useEffect, useRef } from 'react';
import { world } from '../lib/world';
import { onFrame } from '../lib/loop';
import { WEAPONS } from '../weapons/data';

const SCAN_EVERY = 6.5, SCAN_LEN = 2.8, CONTACT_HOLD = 2.4;     // seconds the nature stays up after the heat last touched the weapon

/** The "light" point the weapon is lit from and the NATURE reveal. The pointer itself is the normal browser cursor.
 *  With a mouse the pointer is the light. On touch screens a scan wave sweeps the weapon every few seconds instead. */
export default function Cursor() {
  const nat = useRef(null), word = useRef(null), line = useRef(null);

  useEffect(() => {
    let anchored = false, placed = false, contactT = -99, cx = 0, cy = 0, wasHidden = true, hitT = 0, scanT = -1, nextScan = 3, shownFor = -1, natW = 0;
    const off = onFrame((now, dt) => {
      const ctl = world.chapters[world.cur];
      const pointer = world.fine && world.mx > -9000;

      /* touch scan */
      let sx = null, sy = null;
      if (!world.fine && ctl && ctl.visible && !world.reduce) {
        if (scanT < 0 && now > nextScan) scanT = now;
        if (scanT >= 0) {
          const u = (now - scanT) / SCAN_LEN;
          if (u >= 1) { scanT = -1; nextScan = now + SCAN_EVERY; }
          else { [sx, sy] = ctl.axisPoint(0.04 + 0.92 * u); }
        }
      }
      const scanning = sx !== null;

      /* the light point */
      const tx = pointer ? world.mx : scanning ? sx : world.px, ty = pointer ? world.my : scanning ? sy : world.py;
      if (world.px < -9000) { world.px = tx; world.py = ty; }
      const k = 1 - Math.exp(-dt * 20);
      world.px += (tx - world.px) * k; world.py += (ty - world.py) * k;
      const lightT = pointer || scanning ? 1 : 0;
      world.lightOn += (lightT - world.lightOn) * (1 - Math.exp(-dt * (lightT ? 9 : 4)));

      /* contact: the nature shows while the pointer is on the weapon, and for a moment after */
      world.speed *= Math.exp(-dt * 3.2);
      if (now - hitT > 0.09) {
        hitT = now;
        let hitAt = null;
        if (pointer && ctl && ctl.visible) {
          if (ctl.hit(world.mx, world.my)) hitAt = [world.mx, world.my];
        } else if (scanning && ctl && ctl.visible && ctl.hit(sx, sy)) hitAt = [sx, sy];
        if (hitAt) { contactT = now; if (!anchored) { anchored = true; placed = false; cx = hitAt[0]; cy = hitAt[1]; } }
        world.over = hitAt ? 'x' : null;
      }
      const hot = now - contactT < CONTACT_HOLD;
      const nT = hot ? 1 : 0;
      world.nature += (nT - world.nature) * (1 - Math.exp(-dt * (nT ? 8 : 1.6)));
      world.heat = 0;
      if (!hot && world.nature < 0.01) anchored = false;

      /* the nature word */
      if (nat.current && ctl) {
        if (shownFor !== world.cur) {
          const d = ctl.data; shownFor = world.cur;
          nat.current.style.setProperty('--wf', d.font); nat.current.style.setProperty('--fs', d.fontScale); nat.current.style.setProperty('--ng', d.glow);
          word.current.textContent = d.sin; line.current.textContent = d.sinLine;
          natW = nat.current.offsetWidth;
        }
        const a = world.nature;
        nat.current.style.opacity = a.toFixed(3);
        if (a > 0.003 && !placed) {                      // the word is placed once per touch and then stays perfectly still
          placed = true;
          natW = nat.current.offsetWidth || 240;
          const vw = innerWidth, vh = innerHeight, w = natW;
          const x = !pointer ? (vw - w) / 2 : Math.min(vw - w - 16, Math.max(16, cx + 28)), y = !pointer ? vh * 0.2 : Math.min(vh - 130, Math.max(76, cy - 80));
          nat.current.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
        }
      }
    });
    return off;
  }, []);

  return (
    <>
      <div className="nature" ref={nat} aria-hidden="true">
        <span className="mono nature-k">Nature</span>
        <span className="nature-w" ref={word}>—</span>
        <span className="nature-l" ref={line}>—</span>
      </div>
    </>
  );
}
