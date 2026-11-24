# Exporting a weapon's artwork for the 3D models

The Halcyon, Eclipse and Avarice 3D models are built from the site's own SVG drawings. The browser rasterises each part (it already knows how to draw
every gradient and stroke), and a tiny local receiver saves the images:

1. Start the receiver (it only writes inside the folder you give it):
   ```powershell
   python app/tools/art-receiver.py models/_art
   ```
2. Run `npm run dev` in `app/`, open `http://127.0.0.1:5180/` and paste the body of [export-weapon-art.js](export-weapon-art.js) into the browser console, then:
   ```js
   await __exportWeapon('hal', 'halcyon'); await __exportWeapon('ecl', 'eclipse'); await __exportWeapon('ava', 'avarice');
   ```
   Per part this saves `<part>_sil.png` (the silhouette), `<part>_art.png` (the artwork clipped to it), `<part>_glow.png` (only the pulsing glow layers) and a
   `frame.json`, all in one shared frame with the sword pointing up.
3. Trace and build (Blender 5.2):
   ```powershell
   cd models
   python trace_art.py hal            # -> halcyon/outline.json   (also: ecl, ava)
   & "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python build_weapon.py -- hal
   ```
   That writes `halcyon/halcyon.glb` and `app/src/assets/halcyon.glb`; add `ref 64 900 1400` after `hal` for a face-on render.
