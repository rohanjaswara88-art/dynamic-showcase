import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
/* The live 3D weapons: the Blender models (models/<weapon>) drawn with three.js, each dressed and lit by its theme (lib/themes3d.js). Same seven parts
   as the 2D versions, same pull-apart offsets. Blender is Z-up, glTF / three is Y-up: Blender (x, y, z) arrives as (x, z, -y). */
const K = 1 / 700, FOV = 30;

function lookFor(m, look, envIntensity) {
  const spec = look[m.name] || { color: 0x2a2038, metalness: 0.9, roughness: 0.35 };
  const mat = new THREE.MeshPhysicalMaterial({
    color: spec.color, metalness: spec.metalness, roughness: spec.roughness,
    clearcoat: spec.clearcoat || 0, clearcoatRoughness: spec.clearcoatRoughness ?? 0.1,
    emissive: spec.emissive || 0x000000, emissiveIntensity: spec.glow || 0, envMapIntensity: envIntensity
  });
  mat.userData.glow = spec.glow || 0;
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
  const tex = pm.fromScene(sc, 0.04).texture;
  pm.dispose();
  return tex;
}

export function createStage(canvas, partIds, exOffsets, theme) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: fine)').matches ? 2 : 1.5));      // sharper edges on desktop screens
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = theme.exposure;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer, theme.env);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  const key = new THREE.DirectionalLight(theme.key[0], theme.key[1]); key.position.set(-3, 4, 4); scene.add(key);
  const rim1 = new THREE.PointLight(theme.rim1[0], theme.rim1[1], 0, 1.6); rim1.position.set(...theme.rim1[2]); scene.add(rim1);
  const rim2 = new THREE.PointLight(theme.rim2[0], theme.rim2[1], 0, 1.6); rim2.position.set(...theme.rim2[2]); scene.add(rim2);
  const cursorLight = new THREE.PointLight(theme.cursor[0], 0, 0, 1.4); scene.add(cursorLight);
  const rollG = new THREE.Group(), spinG = new THREE.Group(); rollG.add(spinG); scene.add(rollG);

  const api = {
    ready: false, renderer, camera, parts: {}, pivot: new THREE.Vector3(), boxes: {}, glow: [], exVec: {}, samples: {}, meshes: [], center0: new THREE.Vector3()
  };
  partIds.forEach((id) => { const e = exOffsets[id]; api.exVec[id] = new THREE.Vector3(e[1] * K * 1.25, e[0] * K * 1.25, 0); });

  let begin = () => {};
  const loading = new Promise((resolve, reject) => {
    begin = () => new GLTFLoader().load(theme.glb, (gltf) => {
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
            const old = o.material; o.material = lookFor(old, theme.look, theme.envIntensity); o.material.name = old.name;
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
  if (import.meta.env && import.meta.env.DEV) window.__stage3 = { api, scene };

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

  api.resize = (w, h) => { W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };

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

  api.render = () => renderer.render(scene, camera);

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
  api.dispose = () => renderer.dispose();
  void _m;
  return api;
}
