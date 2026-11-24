import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { detailNormalMap } from './detailmaps';
/* The live 3D weapons: the Blender models (models/<weapon>) drawn with three.js, each dressed and lit by its theme (lib/themes3d.js). Same seven parts
   as the 2D versions, same pull-apart offsets. Blender is Z-up, glTF / three is Y-up: Blender (x, y, z) arrives as (x, z, -y). */
const K = 1 / 700, FOV = 30;
const UV_PER_M = 5;                  // planar UVs: one texture tile every 20 cm

function lookFor(m, look, envIntensity, detail) {
  const spec = look[m.name] || { color: 0x2a2038, metalness: 0.9, roughness: 0.35 };
  const mat = new THREE.MeshPhysicalMaterial({
    color: spec.color, metalness: spec.metalness, roughness: spec.roughness,
    clearcoat: spec.clearcoat || 0, clearcoatRoughness: spec.clearcoatRoughness ?? 0.1,
    emissive: spec.emissive || 0x000000, emissiveIntensity: spec.glow || 0, envMapIntensity: envIntensity
  });
  mat.userData.glow = spec.glow || 0;
  if (detail && !spec.glow) { mat.normalMap = detail.map; mat.normalScale.set(detail.scale, detail.scale); }      // fine surface relief on the metal, not on the lit inlays
  return mat;
}

/** a tiny studio for the metal to reflect, from the theme's coloured panels */
function makeEnvironment(renderer, env) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(env.bg);
  env.panels.forEach(([w, h, color, pos, int]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(int), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); sc.add(m);
  });
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.015, 0.1, 100, { size: 512 }).texture;                 // 512 px cube: crisp reflections
  pm.dispose();
  return tex;
}

export function createStage(canvas, partIds, exOffsets, theme) {
  /* Resolution: the weapon is drawn supersampled (2x on ordinary screens, so every edge is an average of four samples, on top of 4x MSAA in the render target)
     and the browser scales it down. A frame-time governor lowers that only if the machine cannot keep up. */
  const dpr = window.devicePixelRatio || 1, fine = matchMedia('(pointer: fine)').matches;
  const maxPR = dpr >= 2 ? dpr : fine ? 2 : Math.min(1.5, Math.max(dpr, 1.25)), minPR = Math.min(dpr, maxPR);
  let pr = maxPR;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, stencil: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = theme.exposure;      // keeps hue and saturation (ACES washed the colours out)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;      // refreshed every other frame, in render()
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer, theme.env);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.25, 40);                 // a tight clipping range keeps depth precision for the thin inlays
  const key = new THREE.DirectionalLight(theme.key[0], theme.key[1]); key.position.set(-3, 4, 4); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.004; key.shadow.radius = 2.5;
  Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 0.5, far: 14 });          // plates cast soft shadows on the sheet below them
  const rim1 = new THREE.PointLight(theme.rim1[0], theme.rim1[1], 0, 1.6); rim1.position.set(...theme.rim1[2]); scene.add(rim1);
  const rim2 = new THREE.PointLight(theme.rim2[0], theme.rim2[1], 0, 1.6); rim2.position.set(...theme.rim2[2]); scene.add(rim2);
  const cursorLight = new THREE.PointLight(theme.cursor[0], 0, 0, 1.4); scene.add(cursorLight);
  const rollG = new THREE.Group(), spinG = new THREE.Group(); rollG.add(spinG); scene.add(rollG);

  /* post: MSAA render target, controlled bloom on the lit inlays, then tone mapping and the sRGB conversion */
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), theme.bloom[0], theme.bloom[1], theme.bloom[2]);
  /* the stock bloom writes alpha 1 everywhere, which would blank the world behind the canvas: add its light to the colour only and leave the alpha alone */
  const bm = bloom.blendMaterial; bm.blending = THREE.CustomBlending; bm.blendEquation = THREE.AddEquation; bm.blendSrc = THREE.SrcAlphaFactor; bm.blendDst = THREE.OneFactor; bm.blendSrcAlpha = THREE.ZeroFactor; bm.blendDstAlpha = THREE.OneFactor; bm.needsUpdate = true;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const api = {
    ready: false, renderer, camera, parts: {}, pivot: new THREE.Vector3(), boxes: {}, glow: [], exVec: {}, samples: {}, meshes: [], center0: new THREE.Vector3()
  };
  partIds.forEach((id) => { const e = exOffsets[id]; api.exVec[id] = new THREE.Vector3(e[1] * K * 1.25, e[0] * K * 1.25, 0); });

  let begin = () => {}, detail = null;
  const loading = new Promise((resolve, reject) => {
    begin = () => new GLTFLoader().load(theme.glb, (gltf) => {
      if (theme.detail) detail = { map: detailNormalMap(theme.detail.kind, renderer), scale: theme.detail.scale };
      const root = gltf.scene;
      ['Voracity_Tilt', 'Voracity_Root'].forEach((n) => { const o = root.getObjectByName(n); if (o) { o.rotation.set(0, 0, 0); o.position.set(0, 0, 0); } });
      root.traverse((o) => { if (o.name && o.name.startsWith('Part_') && partIds.includes(o.name.slice(5))) { api.parts[o.name.slice(5)] = o; o.position.set(0, 0, 0); } });
      spinG.add(root);
      root.updateMatrixWorld(true);
      /* per-part boxes in model space and surface sample points for the aura */
      const total = new THREE.Box3();
      partIds.forEach((id) => {
        const node = api.parts[id]; if (!node) return;
        const box = new THREE.Box3().setFromObject(node); api.boxes[id] = box; total.union(box);
        const pts = [];
        node.traverse((o) => {
          if (o.isMesh && !o.userData.skin) {          // (the glow skin added below is a child, and the traversal would reach it)
            api.meshes.push(o); o.userData.part = id;
            const old = o.material; o.material = lookFor(old, theme.look, theme.envIntensity, detail); o.material.name = old.name;
            const gp = o.geometry.attributes.position, uv = new Float32Array(gp.count * 2);
            for (let i = 0; i < gp.count; i++) { uv[i * 2] = gp.getX(i) * UV_PER_M; uv[i * 2 + 1] = gp.getY(i) * UV_PER_M; }
            o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            o.castShadow = !o.material.userData.glow; o.receiveShadow = true;
            const glowCol = o.geometry.attributes.color_1;          // Blender exports its default white colour as COLOR_0 and the painted glow as COLOR_1
            if (glowCol) o.geometry.setAttribute('color', glowCol);
            if (old.name === 'Voracity_Blade' && o.geometry.attributes.color) {          // the burning inner edge: vertex colours painted in Blender, added as light
              const skin = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
              skin.userData.skin = true; o.add(skin); api.glow.push(skin.material);
            }
            if (o.material.userData.glow) api.glow.push(o.material);
            const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal, step = Math.max(1, Math.floor(pos.count / 40));
            for (let i = 0; i < pos.count; i += step) pts.push({ mesh: o, i });
            o.userData.nor = nor;
          }
        });
        api.samples[id] = pts;
      });
      api.center0.copy(total.getCenter(new THREE.Vector3()));
      api.pivot.set(0, -api.center0.y, 0);
      root.position.copy(api.pivot);
      api.root = root; api.ready = true; resolve(api);
    }, undefined, reject);
  });
  let started = false;
  api.start = () => { if (!started) { started = true; begin(); } };           // the model is fetched when its chapter is near, not all four at page load
  api.loading = loading;
  if (import.meta.env && import.meta.env.DEV) { window.__stage3 = { api, scene }; (window.__stages = window.__stages || {})[theme.id] = { api, scene }; }

  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();
  const ray = new THREE.Raycaster();
  let W = 1, H = 1;

  /** the pivot-space (model) box corners of a part, shifted by its explode offset */
  api.corners = (id, ex) => {
    const b = api.boxes[id]; if (!b) return [];
    const o = api.exVec[id].clone().multiplyScalar(ex).add(api.pivot), out = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z).add(o));
    return out;
  };
  api.modelMatrix = (roll, spin) => new THREE.Matrix4().makeRotationZ(roll).multiply(new THREE.Matrix4().makeRotationY(spin));

  const sizeAll = () => { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); renderer.setSize(W, H, false); composer.setSize(W, H); bloom.resolution.set(Math.max(64, W * 0.4), Math.max(64, H * 0.4)); };          // (the glow is soft, so it is blurred at low resolution: cheap, whatever the supersampling)
  api.resize = (w, h) => { W = w; H = h; sizeAll(); camera.aspect = w / h; camera.updateProjectionMatrix(); };

  /** put the camera and the model where state S says */
  api.apply = (S, focusId, time) => {
    rollG.rotation.z = S.roll; spinG.rotation.y = S.spin;
    for (const id of partIds) {
      const n = api.parts[id]; if (!n) continue;
      n.position.copy(api.exVec[id]).multiplyScalar(S.ex);
      const hide = S.fm > 0.5 && id !== focusId;
      if (n.visible === hide) n.visible = !hide;
    }
    const cp = Math.cos(S.pitch), d = S.dist;
    camera.position.set(S.tx + Math.sin(S.yaw) * cp * d, S.ty + Math.sin(S.pitch) * d, S.tz + Math.cos(S.yaw) * cp * d);
    camera.lookAt(S.tx, S.ty, S.tz);
    camera.setViewOffset(W, H, S.offx, S.offy, W, H);
    camera.updateMatrixWorld(true);
    const pulse = 0.72 + 0.28 * Math.sin(time * 2.4) + 0.08 * Math.sin(time * 5.7);
    for (const m of api.glow) { if (m.isMeshBasicMaterial) m.color.setScalar((0.55 + 0.45 * pulse) * 1.35); else m.emissiveIntensity = m.userData.glow * pulse; }
    rim1.intensity = theme.rim1[1] * (0.8 + 0.3 * Math.sin(time * 1.7)); rim2.intensity = theme.rim2[1] * (0.85 + 0.25 * Math.sin(time * 1.3 + 2));
  };

  /** a light that follows the pointer, so the metal catches it */
  api.pointerLight = (nx, ny, amount, target) => {
    cursorLight.intensity = theme.cursor[1] * amount;
    _v.set(nx, ny, 0.3).unproject(camera);
    const dir = _v.sub(camera.position).normalize();
    cursorLight.position.copy(camera.position).addScaledVector(dir, Math.max(0.6, camera.position.distanceTo(target) * 0.62));
  };

  /* frame-time governor: if frames stay slow it spends less, in this order: supersampling, soft shadows, bloom. It never climbs back up. */
  let last = 0, ema = 16, slow = 0, tier = 0, frameNo = 0, warm = 150;                // (the first frames compile shaders and upload textures, so they do not count)
  api.render = () => {
    const now = performance.now(), dt = last ? Math.min(100, now - last) : 16; last = now;
    ema += (dt - ema) * 0.06;
    if (warm > 0) { warm--; ema = 16; slow = 0; }
    else if (ema > 22 && !(import.meta.env && import.meta.env.DEV && window.__fullQuality)) {
      if (++slow > 36) {
        slow = 0; ema = 16; tier++;
        if (tier === 1 && pr > minPR) { pr = minPR; sizeAll(); }
        else if (tier <= 2) { key.castShadow = false; renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
        else if (tier === 3) bloom.enabled = false;
      }
    } else slow = 0;
    if (key.castShadow && (frameNo++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
    composer.render();
  };
  api.quality = () => ({ pr, minPR, maxPR, tier, ema, shadows: key.castShadow, bloom: bloom.enabled });
  api.composer = composer; api.bloom = bloom;

  api.project = (v3, out) => {                                   // world point -> viewport pixel
    _v.copy(v3).project(camera);
    out[0] = (_v.x * 0.5 + 0.5) * W; out[1] = (-_v.y * 0.5 + 0.5) * H; return out;
  };
  api.partCenter = (id, target) => {
    const b = new THREE.Box3().setFromObject(api.parts[id]);
    return b.getCenter(target);
  };
  api.partBox = (id) => new THREE.Box3().setFromObject(api.parts[id]);

  api.hit = (px, py) => {
    ray.setFromCamera(new THREE.Vector2((px / W) * 2 - 1, -(py / H) * 2 + 1), camera);
    const list = api.meshes.filter((m) => m.visible && m.parent && m.parent.visible);
    const h = ray.intersectObjects(list, false);
    return h.length ? h[0].object.userData.part : null;
  };

  /** a point (and outward screen direction) on a random part's surface, in pixels */
  api.sample = (ids, out) => {
    const id = ids[(Math.random() * ids.length) | 0], list = api.samples[id];
    if (!list || !list.length) return null;
    const { mesh, i } = list[(Math.random() * list.length) | 0];
    return api.samplePoint(mesh, i, out);
  };
  api.samplePoint = (mesh, i, out) => {
    const pos = mesh.geometry.attributes.position, nor = mesh.userData.nor;
    mesh.updateWorldMatrix(true, false);
    _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    api.project(_v, out);
    if (nor) {
      _n.fromBufferAttribute(nor, i).transformDirection(mesh.matrixWorld).multiplyScalar(0.05).add(_v);
      const p2 = [0, 0]; api.project(_n, p2);
      const dx = p2[0] - out[0], dy = p2[1] - out[1], m = Math.hypot(dx, dy) || 1;
      out[2] = dx / m; out[3] = dy / m;
    } else { out[2] = 0; out[3] = -1; }
    return out;
  };
  api.dispose = () => { composer.dispose(); target.dispose(); renderer.dispose(); };
  void _m;
  return api;
}
