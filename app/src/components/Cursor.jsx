import { useEffect, useRef } from 'react';
import { world, addTrail, addPulse } from '../lib/world';
import { onFrame } from '../lib/loop';
import { WEAPONS } from '../weapons/data';

const SCAN_EVERY = 6.5, SCAN_LEN = 2.8;

/** Ring cursor, the "light" point the weapon is lit from, the heat activity, and the NATURE reveal.
 *  With a mouse the pointer is the light. On touch screens a scan wave sweeps the weapon every few seconds instead. */
export default function Cursor() {
  const ring = useRef(null), dot = useRef(null), nat = useRef(null), word = useRef(null), line = useRef(null);

  useEffect(() => {
    let wasHidden = true, hitT = 0, scanT = -1, nextScan = 3, shownFor = -1, natW = 0, rx = -100, ry = -100, onWeapon = false;
    const root = document.documentElement;
    const off = onFrame((now, dt) => {
      const ctl = world.chapters[world.cur];
      const pointer = world.fine && world.mx > -9000;
      root.classList.toggle('has-cur', world.fine);

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

      /* heat: how much the pointer has been moving lately */
      world.speed *= Math.exp(-dt * 3.2);
      const hT = scanning ? 0.75 : Math.min(1, world.speed / 700);
      world.heat = hT > world.heat ? world.heat + (hT - world.heat) * (1 - Math.exp(-dt * 10)) : world.heat * Math.exp(-dt * 1.15);
      if (scanning) {
        if (Math.floor(now * 14) !== Math.floor((now - dt) * 14)) addTrail(sx, sy, 0.85, now);
        if (Math.floor(now * 3) !== Math.floor((now - dt) * 3)) addPulse(sx, sy, 0.8, now);
      }

      /* is it on the weapon? (about 10 times a second) */
      if (now - hitT > 0.1) {
        hitT = now;
        if (pointer) {
          world.over = ctl && ctl.visible ? ctl.hit(world.mx, world.my) : null;
        } else if (scanning) world.over = ctl.data.parts[0].id;
        else world.over = null;
      }
      onWeapon = !!world.over && (pointer || scanning);
      const nT = onWeapon ? 1 : 0;
      world.nature += (nT - world.nature) * (1 - Math.exp(-dt * (nT ? 7 : 3.2)));

      /* ring cursor */
      if (ring.current) {
        if (pointer) { rx += (world.mx - rx) * (1 - Math.exp(-dt * 16)); ry += (world.my - ry) * (1 - Math.exp(-dt * 16)); }
        const show = pointer ? 1 : 0;
        ring.current.style.opacity = show; dot.current.style.opacity = show;
        ring.current.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0) translate(-50%,-50%) scale(${(1 + 0.7 * world.nature + 0.25 * world.heat).toFixed(3)})`;
        dot.current.style.transform = `translate3d(${world.mx.toFixed(1)}px,${world.my.toFixed(1)}px,0) translate(-50%,-50%)`;
        ring.current.classList.toggle('hot', world.nature > 0.5);
      }

      /* the nature word */
      if (nat.current && ctl) {
        if (shownFor !== world.cur) {
          const d = ctl.data; shownFor = world.cur;
          nat.current.style.setProperty('--wf', d.font); nat.current.style.setProperty('--fs', d.fontScale);
          word.current.textContent = d.sin; line.current.textContent = d.sinLine;
          natW = nat.current.offsetWidth;
        }
        const a = world.nature, vw = innerWidth, vh = innerHeight;
        nat.current.style.opacity = a.toFixed(3);
        if (a <= 0.003) wasHidden = true;
        if (a > 0.003) {
          if (wasHidden) { natW = nat.current.offsetWidth; wasHidden = false; }
          const ax = scanning ? sx : world.px, ay = scanning ? sy : world.py, w = natW || 240;
          const x = !pointer ? (vw - w) / 2 : Math.min(vw - w - 12, Math.max(12, ax + 30)), y = !pointer ? vh * 0.2 : Math.min(vh - 120, Math.max(70, ay - 70));
          nat.current.style.transform = `translate3d(${x.toFixed(1)}px,${(y + (1 - a) * 10).toFixed(1)}px,0) scale(${(0.94 + 0.06 * a).toFixed(3)})`;
        }
      }
    });
    return off;
  }, []);

  return (
    <>
      <div className="cur" ref={ring} aria-hidden="true" />
      <div className="cur-dot" ref={dot} aria-hidden="true" />
      <div className="nature" ref={nat} aria-hidden="true">
        <span className="mono nature-k">Nature</span>
        <span className="nature-w" ref={word}>—</span>
        <span className="nature-l" ref={line}>—</span>
      </div>
    </>
  );
}
