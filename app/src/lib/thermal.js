import { onFrame } from './loop';
import { world } from './world';

/* The thermal cursor: a small GPU fluid simulation (stable fluids, the technique behind React Bits' SplashCursor).
   Moving the pointer stirs "heat" into the fluid; the display pass paints the heat with an infrared colour map
   (black, indigo, purple, red, orange, yellow, white) so it reads like a thermal camera. It lives on its own transparent
   canvas above the weapons, so wherever the heat drifts over a weapon you see it on the weapon. */

const VS = `#version 300 es
in vec2 a; out vec2 vUv, vL, vR, vT, vB; uniform vec2 tx;
void main(){ vUv=a*.5+.5; vL=vUv-vec2(tx.x,0.); vR=vUv+vec2(tx.x,0.); vT=vUv+vec2(0.,tx.y); vB=vUv-vec2(0.,tx.y); gl_Position=vec4(a,0.,1.); }`;
const HEAD = '#version 300 es\nprecision highp float; precision highp sampler2D;\nin vec2 vUv,vL,vR,vT,vB; out vec4 o;\n';
const FS = {
  clear: 'uniform sampler2D uT; uniform float v; void main(){ o=v*texture(uT,vUv); }',
  splat: 'uniform sampler2D uT; uniform float asp,r; uniform vec2 pt; uniform vec3 col; uniform float cap; void main(){ vec2 p=vUv-pt; p.x*=asp; vec3 b=texture(uT,vUv).xyz+exp(-dot(p,p)/r)*col; o=vec4(clamp(b.xy,-cap,cap),0.,1.); }',
  advect: 'uniform sampler2D uV,uS; uniform vec2 tx; uniform float dt,diss; void main(){ vec2 c=vUv-dt*texture(uV,vUv).xy*tx; o=texture(uS,c)/(1.+diss*dt); o.a=1.; }',
  div: 'uniform sampler2D uV; void main(){ float L=texture(uV,vL).x,R=texture(uV,vR).x,T=texture(uV,vT).y,B=texture(uV,vB).y; vec2 C=texture(uV,vUv).xy; if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }',
  curl: 'uniform sampler2D uV; void main(){ float L=texture(uV,vL).y,R=texture(uV,vR).y,T=texture(uV,vT).x,B=texture(uV,vB).x; o=vec4(.5*(R-L-T+B),0.,0.,1.); }',
  vort: 'uniform sampler2D uV,uC; uniform float cu,dt; void main(){ float L=texture(uC,vL).x,R=texture(uC,vR).x,T=texture(uC,vT).x,B=texture(uC,vB).x,C=texture(uC,vUv).x; vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+.0001; f*=cu*C; f.y*=-1.; vec2 v=texture(uV,vUv).xy+f*dt; o=vec4(clamp(v,-1000.,1000.),0.,1.); }',
  press: 'uniform sampler2D uP,uD; void main(){ float L=texture(uP,vL).x,R=texture(uP,vR).x,T=texture(uP,vT).x,B=texture(uP,vB).x; o=vec4((L+R+B+T-texture(uD,vUv).x)*.25,0.,0.,1.); }',
  grad: 'uniform sampler2D uP,uV; void main(){ float L=texture(uP,vL).x,R=texture(uP,vR).x,T=texture(uP,vT).x,B=texture(uP,vB).x; vec2 v=texture(uV,vUv).xy-vec2(R-L,T-B); o=vec4(v,0.,1.); }',
  show: `uniform sampler2D uD;
vec3 thermal(float h){ h=clamp(h,0.,1.); vec3 c=vec3(0.);
  c=mix(c,vec3(.02,.02,.38),smoothstep(0.,.16,h)); c=mix(c,vec3(.5,.05,.6),smoothstep(.12,.32,h)); c=mix(c,vec3(.9,.08,.2),smoothstep(.3,.5,h));
  c=mix(c,vec3(1.,.52,.05),smoothstep(.46,.68,h)); c=mix(c,vec3(1.,.93,.3),smoothstep(.64,.86,h)); return mix(c,vec3(1.),smoothstep(.84,1.,h)); }
void main(){ float h=texture(uD,vUv).r; float a=smoothstep(.03,.55,h)*.72; o=vec4(thermal(h*.9)*a,a); }`
};

export function startThermal(canvas) {
  if (!canvas) return () => {};
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return () => {};
  gl.getExtension('OES_texture_float_linear');

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
  const vs = compile(gl.VERTEX_SHADER, VS), P = {};
  for (const [k, body] of Object.entries(FS)) {
    const fs = compile(gl.FRAGMENT_SHADER, HEAD + body); if (!fs || !vs) return () => {};
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return () => {}; }
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    P[k] = { p, u };
  }
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const fbo = (w, h, filter = gl.LINEAR) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h, tx: [1 / w, 1 / h], at(i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); return i; } };
  };
  const dbl = (w, h) => { let a = fbo(w, h), b = fbo(w, h); return { get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; }, tx: a.tx }; };

  const aspect = () => innerWidth / innerHeight;
  const res = (base) => { let r = aspect(); if (r < 1) r = 1 / r; const lo = Math.round(base), hi = Math.round(base * r); return aspect() > 1 ? [hi, lo] : [lo, hi]; };
  const SIM = innerWidth < 700 ? 72 : 96, DYE = innerWidth < 700 ? 256 : 384;
  const [sw, sh] = res(SIM), [dw, dh] = res(DYE);
  const vel = dbl(sw, sh), dye = dbl(dw, dh), div = fbo(sw, sh, gl.NEAREST), curl = fbo(sw, sh, gl.NEAREST), prs = dbl(sw, sh);
  const use = (k) => { gl.useProgram(P[k].p); return P[k].u; };
  const draw = (target) => { if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); } gl.drawArrays(gl.TRIANGLES, 0, 3); };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * 0.5;               // the heat is soft: half resolution is plenty
    const w = Math.max(2, Math.round(innerWidth * dpr)), h = Math.max(2, Math.round(innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  resize(); addEventListener('resize', resize);

  function splat(x, y, dx, dy, heat, force) {
    const u = use('splat'), ax = aspect(), r = 0.0022 * (ax > 1 ? ax : 1);
    gl.uniform1f(u.asp, ax); gl.uniform2f(u.pt, x / innerWidth, 1 - y / innerHeight); gl.uniform1f(u.r, r);
    gl.uniform1f(u.cap, 1000); gl.uniform1i(u.uT, vel.read.at(0)); gl.uniform3f(u.col, dx * force, dy * force, 0); draw(vel.write); vel.swap();
    gl.uniform1f(u.cap, 1.2); gl.uniform1i(u.uT, dye.read.at(0)); gl.uniform3f(u.col, heat, 0, 0); gl.uniform1f(u.r, r * 1.3); draw(dye.write); dye.swap();
  }

  function step(dt) {
    gl.disable(gl.BLEND);
    let u = use('curl'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uV, vel.read.at(0)); draw(curl);
    u = use('vort'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uV, vel.read.at(0)); gl.uniform1i(u.uC, curl.at(1)); gl.uniform1f(u.cu, 22); gl.uniform1f(u.dt, dt); draw(vel.write); vel.swap();
    u = use('div'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uV, vel.read.at(0)); draw(div);
    u = use('clear'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uT, prs.read.at(0)); gl.uniform1f(u.v, 0.8); draw(prs.write); prs.swap();
    u = use('press'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uD, div.at(1));
    for (let i = 0; i < 14; i++) { gl.uniform1i(u.uP, prs.read.at(0)); draw(prs.write); prs.swap(); }
    u = use('grad'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uP, prs.read.at(0)); gl.uniform1i(u.uV, vel.read.at(1)); draw(vel.write); vel.swap();
    u = use('advect'); gl.uniform2fv(u.tx, vel.tx); gl.uniform1i(u.uV, vel.read.at(0)); gl.uniform1i(u.uS, vel.read.at(0)); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, 0.35); draw(vel.write); vel.swap();
    gl.uniform1i(u.uV, vel.read.at(0)); gl.uniform1i(u.uS, dye.read.at(1)); gl.uniform1f(u.diss, 1.3); draw(dye.write); dye.swap();
  }

  function show() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const u = use('show'); gl.uniform1i(u.uD, dye.read.at(0)); draw(null);
  }

  let lx = null, ly = null, lastStir = 0, cleared = true; const seen = new WeakSet();
  const off = onFrame((now, dt) => {
    if (window.__dbg && window.__dbg.thermal === 0) return;
    const nowS = performance.now() / 1000;
    /* stir where the pointer (or the touch-screen scan wave) is */
    if (world.lightOn > 0.4 && world.px > -9000 && world.cur >= 0) {
      if (lx !== null) {
        const dx = world.px - lx, dy = world.py - ly, d = Math.hypot(dx, dy);
        if (d > 0.4) {
          const sp = Math.min(d / Math.max(dt, 0.004), 3500);
          splat(world.px, world.py, dx / innerWidth * 120, -dy / innerHeight * 120, Math.min(0.2, 0.05 + sp / 9000) * Math.min(1, d / 3), 55);
          lastStir = nowS; cleared = false;
        }
      }
      lx = world.px; ly = world.py;
    } else { lx = null; }
    /* a click or tap blows a ring of heat outwards */
    for (const p of world.pulses) if (!seen.has(p)) {
      seen.add(p); if (world.cur < 0) continue;
      for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.2832; splat(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8, Math.cos(a) * 0.9, -Math.sin(a) * 0.9, 0.22 * p.s, 700); }
      lastStir = nowS; cleared = false;
    }
    if (nowS - lastStir < 6) { step(Math.min(dt, 0.033)); show(); }
    else if (!cleared) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); cleared = true; for (const f of [dye.read, dye.write, vel.read, vel.write]) { gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } }
  });
  return () => { off(); removeEventListener('resize', resize); };
}
