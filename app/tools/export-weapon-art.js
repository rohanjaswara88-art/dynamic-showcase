/* Paste into the browser console on the running site (see export-weapon-art.md).
   __exportWeapon(wid, sectionId): rasterises every part of one weapon's SVG drawing (silhouette, artwork, glow layers) and POSTs the PNGs to the local receiver. */
window.__exportWeapon = async (wid, secId, S = 1.5, M = 10) => {
  const NS = 'http://www.w3.org/2000/svg';
  const sec = document.getElementById(secId), svg = sec.querySelector('svg.svg');
  const defsHTML = Array.from(svg.querySelectorAll('defs')).map((d) => d.innerHTML).join('');
  const parts = Array.from(svg.querySelectorAll('g[data-part]')).map((g) => g.getAttribute('data-part'));
  const bbox = (html) => { const t = document.createElementNS(NS, 'svg'); t.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px'); t.innerHTML = '<g>' + html + '</g>'; document.body.appendChild(t); const b = t.firstChild.getBBox(); t.remove(); return b; };
  const sil = {}; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const id of parts) { const g = svg.querySelector('#s-' + wid + '-' + id); sil[id] = g.innerHTML; const b = bbox(g.innerHTML); x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.height); }
  x0 = Math.floor(x0); x1 = Math.ceil(x1); y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const Wp = Math.round((y1 - y0 + 2 * M) * S), Hp = Math.round((x1 - x0 + 2 * M) * S);
  const tr = `matrix(0 ${-S} ${S} 0 ${S * (M - y0)} ${S * (x1 - x0 + M)})`;     // sword (x along, y across) -> image (u = across, v = down toward the pommel)
  const frame = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${Wp}" height="${Hp}" viewBox="0 0 ${Wp} ${Hp}"><defs>${defsHTML}</defs><g transform="${tr} translate(${-x0} 0)"><g>${inner}</g></g></svg>`;
  const post = async (path, blob) => { const r = await fetch('http://127.0.0.1:5191/save?path=' + encodeURIComponent(path), { method: 'POST', body: blob }); if (!r.ok) throw new Error('save ' + path); };
  const png = async (svgText) => { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); await img.decode(); const c = document.createElement('canvas'); c.width = Wp; c.height = Hp; c.getContext('2d').drawImage(img, 0, 0, Wp, Hp); return await new Promise((res) => c.toBlob(res, 'image/png')); };
  const info = { wid, S, M, x0, x1, y0, y1, W: Wp, H: Hp, parts };
  for (const id of parts) {
    const part = svg.querySelector('g[data-part="' + id + '"]'), body = part.querySelector(':scope > g.body');
    const clip = `<clipPath id="cl" clip-rule="evenodd">${sil[id]}</clipPath>`;
    const pul = Array.from(body.querySelectorAll('[data-pulse]')).filter((e) => !e.parentElement.closest('[data-pulse]')).map((e) => e.outerHTML).join('');
    await post(`${wid}/${id}_sil.png`, await png(frame(`<g fill="#000" fill-rule="evenodd">${sil[id]}</g>`)));
    await post(`${wid}/${id}_art.png`, await png(frame(`<defs>${clip}</defs><g clip-path="url(#cl)">${body.innerHTML}</g>`)));
    await post(`${wid}/${id}_glow.png`, await png(frame(`<defs>${clip}</defs><g clip-path="url(#cl)">${pul}</g>`)));
  }
  await post(`${wid}/frame.json`, new Blob([JSON.stringify(info)]));
  return info;
};
