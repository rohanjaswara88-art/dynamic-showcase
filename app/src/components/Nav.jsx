import { scrollToTarget } from '../lib/scroll';
import { WEAPONS } from '../weapons/data';

export default function Nav({ show }) {
  return (
    <header className={'nav' + (show ? ' show' : '')}>
      <a href="#top" className="logo" onClick={(e) => { e.preventDefault(); scrollToTarget(0, { duration: 2.2 }); }}>dynamic<i>.</i>showcase</a>
      <nav aria-label="Weapons">
        {WEAPONS.map((w) => <a key={w.id} href={'#' + w.id} onClick={(e) => { e.preventDefault(); scrollToTarget('#' + w.id, { duration: 2.4 }); }}>{w.name}</a>)}
      </nav>
    </header>
  );
}
