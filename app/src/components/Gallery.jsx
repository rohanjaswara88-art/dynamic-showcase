import Chapter from './Chapter.jsx';
import { WEAPONS } from '../weapons/data';
import Voracity from '../weapons/voracity';
import Halcyon from '../weapons/halcyon';
import Eclipse from '../weapons/eclipse';
import Avarice from '../weapons/avarice';

const ART = { voracity: Voracity, halcyon: Halcyon, eclipse: Eclipse, avarice: Avarice };

/** Four chapters, one per weapon. Each pins itself and scrubs its own timeline; the world behind them (shader + particles) is fixed. */
export default function Gallery({ revealed }) {
  return (
    <div className="gallery" id="gallery">
      {WEAPONS.map((w, i) => ART[w.id] && <Chapter key={w.id} index={i} data={w} Art={ART[w.id]} revealed={revealed} />)}
    </div>
  );
}
