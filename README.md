# dynamic.showcase

A landing chronicle (how the four relics were found, read through a magnifying glass that follows the cursor) leading into a scroll-driven gallery of four fantasy weapons, each drawn in code as pure vector SVG and taken apart piece by piece as
you scroll. Each weapon has its own name and display font, its own world behind it (a WebGL shader), its own aura
(2D canvas particles), a cursor that lights it and stirs a thermal-camera fluid, a hidden *nature* (one of the sins) that is revealed for a
moment when that heat touches the weapon, and a lore card at the end of its scroll.

React 18, GSAP + ScrollTrigger, Lenis. **There are no image files**: the weapons are SVG paths, the worlds are a fragment
shader, the auras are generated sprites. Everything stays sharp at any zoom.

| # | Weapon | Nature | Font | World |
| --- | --- | --- | --- | --- |
| I | **Voracity**, a scythe | Gluttony | Eater | purple hellfire |
| II | **Halcyon**, an ice-crystal sword | Pride | Cinzel Decorative | snow blizzard |
| III | **Eclipse**, a black sword with a red gem | Envy | Pirata One | black void under a red eclipse |
| IV | **Avarice**, a violet greatsword | Greed | Syncopate | violet thunderstorm over lava |

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `assets/` | The **built site** that gets served (for example from GitHub Pages). |
| `app/` | The React source. |

## Develop

```powershell
cd app
npm install
npm run dev        # http://127.0.0.1:5180
```

Open `http://127.0.0.1:5180/?w=2&p=0.4` to jump to weapon `w` (0 to 3) at scroll progress `p` (0 to 1) of its chapter;
`window.__dss` exposes `go(w, p)` and the shared state for poking at things.

## Rebuild the served site

```powershell
cd app
npm run build      # writes ../index.html and ../assets
```

## What is where (`app/src`)

- `lib/geom.js`: the path kit (polygons, Catmull-Rom curves, ribbons along a centre-line, thorns, seeded random).
- `weapons/kit.jsx`: `Part`, the wrapper every weapon part uses. It adds a soft cast shadow (stacked widening strokes of the
  part's own silhouette, no SVG filters), a cursor light overlay and an infrared heat overlay.
- `weapons/voracity.jsx`, `halcyon.jsx`, `eclipse.jsx`, `avarice.jsx`: the four weapons, in "sword space" (long axis on +x).
- `weapons/data.js`: names, fonts, sins, lore, per-part text and explode offsets.
- `lib/pose.js`: fitting a weapon into screen regions (hero, exploded overview, a camera for each part, lore) for any screen.
- `components/Chapter.jsx`: one pinned, scrubbed timeline per weapon, callouts, details panel, lore card.
- `components/Landing.jsx`, `components/Lens.jsx`, `weapons/story.js`: the chronicle and the magnifier (a second, scaled-up
  copy of the story inside a round glass that follows the pointer). Uncial Antiqua and IM Fell English.
- `lib/thermal.js`: the thermal cursor, a small GPU fluid simulation (the technique behind React Bits' SplashCursor)
  painted with an infrared colour map on its own transparent canvas.
- `lib/gl.js`: the one fixed WebGL background (five worlds, crossfaded: landing fog, hellfire, ice spires and sea,
  eclipse, thunderstorm over lava). Render scale adapts to the shader's GPU time (timer query).
- `lib/fx.js`: the one fixed 2D canvas: each weapon's aura (a shape-hugging glow plus flames, frost, smoke or lightning),
  ambient dust, lightning.
- `components/Cursor.jsx`: ring cursor, the light point, heat activity, and the nature reveal. On touch screens a scan wave
  sweeps the weapon every few seconds instead, so the nature still appears; the magnifier is for fine pointers only.
- `lib/world.js`, `lib/loop.js`: shared state and the single frame loop.
- `components/rb/`: React Bits components in use (ShinyText, DecryptedText) and some kept for later.
- `_archive/`: the earlier katana experience and sections, parked.
- `app/tools/perf.js`: dev-only frame-time probe (see the file header).

## Performance notes

No SVG filters, no CSS blur on large layers, DPR capped at 1.5 for the canvases, particle budget about 420, parts that are
off screen are not drawn, loops pause in hidden tabs, and `prefers-reduced-motion` gets fewer particles, no pinning and a
static exploded diagram. The weapon is vector and is re-rasterised on every pose change, so frame cost grows with the
area it covers; see the notes in the final report for measured numbers.
