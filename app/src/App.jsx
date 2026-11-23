import { useEffect, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initScroll, scroller } from './lib/scroll';
import { initPointer, world } from './lib/world';
import { onFrame } from './lib/loop';
import Preloader from './components/Preloader.jsx';
import Nav from './components/Nav.jsx';
import Gallery from './components/Gallery.jsx';
import Landing from './components/Landing.jsx';
import Lens from './components/Lens.jsx';
import Cursor from './components/Cursor.jsx';
import { startGL } from './lib/gl';
import { startFX } from './lib/fx';
import { startThermal } from './lib/thermal';

export default function App() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const stopScroll = initScroll();
    const stopPtr = initPointer();
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    document.fonts?.ready.then(refresh);
    const stopFrames = onFrame((t, dt) => { world.frames && world.frames.forEach((fn) => fn(t, dt)); });
    const stopGL = startGL(document.getElementById('gl'));
    const stopFX = startFX(document.getElementById('fx'));
    const stopTh = startThermal(document.getElementById('thermal'));
    return () => { window.removeEventListener('load', refresh); stopScroll(); stopPtr(); stopFrames(); stopGL(); stopFX(); stopTh(); };
  }, []);

  useEffect(() => {
    window.__dss = { world, ScrollTrigger, get lenis() { return scroller.lenis; }, go: (w, p) => world.go[w] && world.go[w](p) };
    if (!revealed) return;
    const q = new URLSearchParams(location.search), w = q.get('w');
    if (w !== null) setTimeout(() => { window.__dss.go(+w, +(q.get('p') || 0)); }, 1200);
  }, [revealed]);

  return (
    <>
      <canvas id="gl" className="gl" aria-hidden="true" />
      <Preloader onReveal={() => setRevealed(true)} />
      <Nav show={revealed} />
      <main>
        <Landing revealed={revealed} />
        <Gallery revealed={revealed} />
        <footer className="foot mono"><span>© 2026 dynamic.showcase</span><span>Four weapons. More soon.</span></footer>
      </main>
      <canvas id="fx" className="fx" aria-hidden="true" />
      <canvas id="thermal" className="thermal" aria-hidden="true" />
      <Cursor />
      <Lens />
    </>
  );
}
