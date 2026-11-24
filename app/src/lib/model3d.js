import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from '../assets/voracity.glb?url';

/* The live 3D scythe: the Blender model (models/voracity) drawn with three.js. Same seven parts as the 2D version,
   same pull-apart offsets. Blender is Z-up, glTF / three is Y-up: Blender (x, y, z) arrives as (x, z, -y). */
const K = 1 / 700, FOV = 30;

/* what each Blender material becomes in the browser (Blender's procedural scratches and glow do not travel in a .glb) */
const LOOK = {
  Voracity_ForgedMetal: { color: 0x6a5a88, metalness: 0.95, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.15 },
  Voracity_Plate: { color: 0x7a5aa8, metalness: 0.92, roughness: 0.26, clearcoat: 0.55, clearcoatRoughness: 0.1 },
  Voracity_BlackIron: { color: 0x40345a, metalness: 0.85, roughness: 0.4 },
  Voracity_Vine: { color: 0x4a2c72, metalness: 0.4, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.3 },
  Voracity_Blade: { color: 0x34205a, metalness: 0.92, roughness: 0.24, clearcoat: 0.5, clearcoatRoughness: 0.06 },
  Voracity_Eyelet: { color: 0x200a1c, metalness: 0, roughness: 0.3, emissive: 0xff4de6, glow: 2.6 },
  Voracity_RingGlow: { color: 0x200a1c, metalness: 0, roughness: 0.3, emissive: 0xff4ae0, glow: 2.0 },
  Voracity_VioletGlass: { color: 0x14082a, metalness: 0, roughness: 0.1, emissive: 0x8a2bff, glow: 1.2 }
};

function lookFor(m) {
  const spec = LOOK[m.name] || { color: 0x2a2038, metalness: 0.9, roughness: 0.35 };
  const mat = new THREE.MeshPhysicalMaterial({
    color: spec.color, metalness: spec.metalness, roughness: spec.roughness,
    clearcoat: spec.clearcoat || 0, clearcoatRoughness: spec.clearcoatRoughness ?? 0.1,
    emissive: spec.emissive || 0x000000, emissiveIntensity: spec.glow || 0, envMapIntensity: 2.4
  });
  mat.userData.glow = spec.glow || 0;
  return mat;
}

/** a tiny studio for the metal to reflect: dark room, a magenta strip, a blue-violet strip, a white softbox */
function makeEnvironment(renderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x05030a);
  const panel = (w, h, color, pos, int) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(int), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); sc.add(m);
  };
  panel(1.2, 7, 0xff3ad8, [-5, 1, 2], 14);
  panel(1.2, 7, 0x6a5cff, [5, 1, -1], 11);
  panel(6, 3, 0xe9ddff, [-2, 6, 4], 8);
  panel(8, 1.4, 0xb04cff, [0, -4, 3], 4);
  panel(10, 10, 0x2a1458, [0, 3, -8], 2.5);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.04).texture;
  pm.dispose();
  return tex;
}

export function createStage(canvas, partIds, exOffsets) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  const key = new THREE.DirectionalLight(0xf2e6ff, 4.5); key.position.set(-3, 4, 4); scene.add(key);
  const rim1 = new THREE.PointLight(0xff3ad8, 140, 0, 1.6); rim1.position.set(3.2, 2.4, -2.5); scene.add(rim1);
  const rim2 = new THREE.PointLight(0x5a4cff, 90, 0, 1.6); rim2.position.set(-3.2, 1.2, -2.8); scene.add(rim2);
  const cursorLight = new THREE.PointLight(0xffd6ff, 0, 0, 1.4); scene.add(cursorLight);
  const rollG = new THREE.Group(), spinG = new THREE.Group(); rollG.add(spinG); scene.add(rollG);

  const api = {
    ready: false, renderer, camera, parts: {}, pivot: new THREE.Vector3(), boxes: {}, glow: [], exVec: {}, samples: {}, meshes: [], center0: new THREE.Vector3()
  };
  partIds.forEach((id) => { const e = exOffsets[id]; api.exVec[id] = new THREE.Vector3(e[1] * K * 1.25, e[0] * K * 1.25, 0); });

  const loading = new Promise((resolve, reject) => {
    new GLTFLoader().load(glbUrl, (gltf) => {
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
          if (o.isMesh) {
            api.meshes.push(o); o.userData.part = id;
            const old = o.material; o.material = lookFor(old); o.material.name = old.name;
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
  api.loading = loading;

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
    for (const m of api.glow) { if (m.isMeshBasicMaterial) m.color.setScalar((0.55 + 0.45 * pulse) * 2.4); else m.emissiveIntensity = m.userData.glow * pulse; }
    rim1.intensity = 140 * (0.8 + 0.3 * Math.sin(time * 1.7)); rim2.intensity = 90 * (0.85 + 0.25 * Math.sin(time * 1.3 + 2));
  };

  /** a light that follows the pointer, so the metal catches it */
  api.pointerLight = (nx, ny, amount, target) => {
    cursorLight.intensity = 90 * amount;
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
