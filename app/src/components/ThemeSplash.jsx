import { useEffect, useState } from 'react';
import SplashCursor from './rb/SplashCursor/SplashCursor';
import { world } from '../lib/world';
import { onFrame } from '../lib/loop';

/* The React Bits SplashCursor, used across the four weapon sections and coloured for whichever weapon is on screen.
   It is not mounted on the landing page. */
const THEMES = [
  ['#ff6ef0', '#c24bff', '#7a1fd6'],      // Voracity
  ['#ffffff', '#c4ecff', '#3a8cff'],      // Halcyon
  ['#ff2a2a', '#ff7a3a', '#a30a14'],      // Eclipse
  ['#b07bff', '#d9b8ff', '#ffd966']       // Avarice
];

export default function ThemeSplash() {
  const [cur, setCur] = useState(world.cur);
  useEffect(() => onFrame(() => { if (world.cur !== cur) setCur(world.cur); }), [cur]);
  if (cur < 0 || world.reduce) return null;
  return <SplashCursor colors={THEMES[cur] || THEMES[0]} rainbow={false} intensity={1.3} size={0.95} trail={1} shading={0.8} glow={0.25} quality="medium" intro={false} clickSplash zIndex={6} />;
}
