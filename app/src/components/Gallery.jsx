import { Component } from 'react';
import Chapter from './Chapter.jsx';
import Voracity from '../weapons/voracity';
import Chapter3D from './Chapter3D.jsx';
import { WEAPONS } from '../weapons/data';
import Halcyon from '../weapons/halcyon';
import Eclipse from '../weapons/eclipse';
import Avarice from '../weapons/avarice';

/** if the 3D scythe cannot start (no WebGL, model missing) the original 2D drawing takes its place */
class Safe3D extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('3D scythe unavailable, using the 2D drawing', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const ART = { halcyon: Halcyon, eclipse: Eclipse, avarice: Avarice };

/** Four chapters, one per weapon. Each pins itself and scrubs its own timeline; the world behind them (shader + particles) is fixed. */
export default function Gallery({ revealed }) {
  return (
    <div className="gallery" id="gallery">
      {WEAPONS.map((w, i) => (w.id === 'voracity'
        ? <Safe3D key={w.id} fallback={<Chapter index={i} data={w} Art={Voracity} revealed={revealed} />}><Chapter3D index={i} data={w} revealed={revealed} /></Safe3D>
        : ART[w.id] && <Chapter key={w.id} index={i} data={w} Art={ART[w.id]} revealed={revealed} />))}
    </div>
  );
}
