import { onFrame } from './loop';
import { world } from './world';
import { WEAPONS } from '../weapons/data';

/* One fixed full-screen fragment shader: four worlds (0 purple hellfire, 1 snow blizzard, 2 black void with an eclipse,
   3 violet thunderstorm over lava), crossfaded. */
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uT, uMix, uFlash, uBolt;
uniform float uA, uB;
uniform vec2 uMouse;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+19.19));}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(7.3,1.7);a*=.5;}return v;}
float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.1+vec2(3.1,5.7);a*=.5;}return v;}

/* 0: purple hellfire */
vec3 env0(vec2 uv,float t,float asp){
  vec2 p=vec2(uv.x*asp,uv.y);
  vec3 col=mix(vec3(.012,0.,.03),vec3(.085,.008,.14),smoothstep(1.,.0,uv.y));
  col+=vec3(.04,.0,.07)*fbm3(p*2.+t*.03);
  vec2 q=vec2(p.x*2.3,p.y*1.6-t*.42);
  float w=fbm(q+vec2(fbm(q*1.4+vec2(0.,t*.25))*1.3,0.));
  float h=1.-smoothstep(0.,.8,uv.y);                         /* flames climb from the floor */
  float f=smoothstep(.34,.92,w*1.1+h*.78-.3);
  float core=smoothstep(.5,1.,w*1.05+h*.95-.34);
  vec3 fl=mix(vec3(.13,.0,.26),vec3(.5,.05,.66),f);
  fl=mix(fl,vec3(.85,.22,.78),core*core*.85);
  fl=mix(fl,vec3(1.,.7,.95),pow(core,4.)*.4);
  col=mix(col,fl,f*(.25+.75*h));
  col+=vec3(.4,.04,.46)*exp(-uv.y*5.)*.3;
  return col;
}

/* 1: snow blizzard */
vec3 snowLayer(vec2 uv,float asp,float t,float sc,float spd,float sz,float seed){
  vec2 p=vec2(uv.x*asp,uv.y)*sc+vec2(.55,1.)*spd*t*.55+seed*13.;
  vec2 id=floor(p),f=fract(p);
  float h=hash(id+seed);
  vec2 o=.22+.56*hash2(id+seed*7.);
  float rr=sz*(.45+.55*hash(id+11.));
  vec2 d=f-o; d.x+=d.y*.3;
  return vec3(smoothstep(rr,rr*.12,length(d))*step(.4,h));
}
/* ice spires: one sawtooth of jagged crystal columns per layer */
vec4 spireLayer(vec2 p,float f,float seed,float base,float amp,float wid){
  float x=p.x*f+seed; float i=floor(x); float u=fract(x)-.5;
  float h1=hash(vec2(i,seed)); float hh=base+amp*h1*h1;
  float w=wid*(.5+hash(vec2(i,seed+3.)));
  float lean=(hash(vec2(i,seed+7.))-.5)*.3;
  float edge=hh-abs(u+lean)/w*hh*.9;
  return vec4(step(0.,u+lean),smoothstep(-.003,.003,edge-p.y),(edge-p.y)/max(hh,.01),h1);
}
vec3 iceCol(vec4 s,vec2 p,float fog,vec3 fogc,float t){
  float fac=noise(vec2(p.x*60.,p.y*14.))*.5+noise(vec2(p.x*22.+3.,p.y*30.))*.5;
  vec3 lite=vec3(.55,.9,1.),dark=vec3(.06,.34,.78);
  vec3 c=mix(lite,dark,clamp(s.x*.62+fac*.45+(1.-s.z)*.1,0.,1.));
  c+=vec3(.5,.8,.95)*smoothstep(.12,.0,s.z)*.6;                 /* bright rim on the edges */
  c+=vec3(.9,1.,1.)*smoothstep(.55,.0,abs(fac-.5))*.05;
  return mix(c,fogc,fog);
}
vec3 iceScene(vec2 p,float y,float t,float asp){
  float hz=.3;
  vec3 hzc=vec3(.55,.82,.98);
  vec3 col=mix(hzc,vec3(.06,.36,.84),smoothstep(hz,.9,y));
  col=mix(col,vec3(.04,.26,.7),smoothstep(.75,1.,y)*.5);
  float cl=fbm(vec2(p.x*1.4+t*.02,y*3.4-.3)), cm=smoothstep(.5,.8,cl)*smoothstep(hz+.02,hz+.28,y);
  col=mix(col,vec3(.93,.97,1.),cm*.78);
  vec2 q=vec2(p.x,y);
  vec4 s=spireLayer(q,7.,1.,.31,.2,.4);  col=mix(col,iceCol(s,q,.72,hzc,t),s.y*step(hz-.02,y));
  s=spireLayer(q,4.2,5.,.31,.3,.36);     col=mix(col,iceCol(s,q,.45,hzc,t),s.y*step(hz-.02,y));
  /* the tall central crystal cluster on a rock base */
  float cx=.64*asp,ax=q.x-cx;
  float rock=.4-abs(ax)*1.15; float rm=smoothstep(-.003,.003,rock-y)*step(hz-.02,y);
  col=mix(col,mix(vec3(.12,.34,.62),vec3(.28,.6,.85),noise(q*vec2(30.,60.))*.8+step(0.,ax)*-.15+.15),rm*(1.-.2));
  for(int k=0;k<5;k++){
    float fk=float(k),w=.022+.006*fract(fk*.37),hk=.93-fk*.07+.05*hash(vec2(fk,2.)),ox=(fk-2.)*.026-.004*fk;
    float d=ax-ox; float e=min(w-abs(d),hk-abs(d)*3.4-y);
    float m=smoothstep(-.002,.002,e)*step(hz-.02,y)*step(.3,y+.25);
    vec3 c=mix(vec3(.5,.92,1.),vec3(.04,.5,.95),step(0.,d)*.7+noise(vec2(d*80.,y*8.))*.4);
    c+=vec3(.9,1.,1.)*smoothstep(.01,.0,w-abs(d))*.6;
    col=mix(col,c,m);
  }
  s=spireLayer(q,3.,9.,.31,.27,.34); col=mix(col,iceCol(s,q,.12,hzc,t),s.y*step(hz-.02,y)*step(.08,abs(ax)-.02*step(abs(ax),.28)*1.));
  /* floating shards */
  for(int k=0;k<7;k++){
    float fk=float(k); vec2 c=vec2(hash(vec2(fk,1.))*asp,.5+hash(vec2(fk,4.))*.42+.012*sin(t*.5+fk*2.));
    float sz=.012+.02*hash(vec2(fk,6.)); vec2 d=(q-c)/vec2(sz*.7,sz*1.4);
    float m=smoothstep(1.,.9,abs(d.x)+abs(d.y));
    col=mix(col,mix(vec3(.6,.95,1.),vec3(.1,.5,.95),step(0.,d.x)*.75),m);
  }
  return col;
}
vec3 env1(vec2 uv,float t,float asp){
  vec2 p=vec2(uv.x*asp,uv.y); float hz=.3;
  vec3 col;
  if(uv.y>=hz) col=iceScene(p,uv.y,t,asp);
  else{
    float dy=hz-uv.y;
    float rip=(noise(vec2(p.x*30.+t*.3,dy*60.))-.5)*.02*(1.+dy*8.);
    vec3 refl=iceScene(vec2(p.x+rip,0.),2.*hz-uv.y+rip*.3,t,asp);
    vec3 sea=mix(vec3(.05,.46,.82),vec3(.02,.2,.55),smoothstep(0.,.3,dy));
    float fres=.45+.45*exp(-dy*7.);
    col=mix(sea,refl*vec3(.78,.9,1.),fres);
    col+=vec3(.6,.9,1.)*smoothstep(.62,.9,noise(vec2(p.x*14.-t*.2,dy*70.)))*.18*(1.-dy*2.);
  }
  vec3 sn=snowLayer(uv,asp,t,44.,1.,.15,1.)*.5+snowLayer(uv,asp,t,22.,1.5,.15,2.)*.7+snowLayer(uv,asp,t,10.,2.2,.14,3.)*.85;
  col+=sn*vec3(.9,.96,1.);
  return col;
}

/* 2: black void, red eclipse */
vec3 env2(vec2 uv,float t,float asp){
  vec2 p=vec2((uv.x-.5)*asp,uv.y-.56);
  float r=length(p),R=.27;
  vec3 col=vec3(.012,.006,.012)+vec3(.02,.0,.01)*fbm3(p*3.+t*.02);
  float ang=atan(p.y,p.x);
  float rays=fbm3(vec2(ang*3.2+t*.05,r*2.));
  float cor=exp(-max(r-R,0.)*7.5);
  float pulse=.9+.1*sin(t*.8);
  col+=vec3(.9,.04,.05)*cor*cor*(.5+.9*rays)*pulse*step(R*.97,r+.02);
  col+=vec3(.35,.02,.03)*exp(-max(r-R,0.)*2.2)*.5;
  float rim=exp(-abs(r-R)*190.);
  col+=vec3(1.,.28,.12)*rim*1.25*pulse;
  col+=vec3(1.,.55,.3)*exp(-abs(r-R)*600.)*.8*smoothstep(.2,1.,.5+.5*sin(ang*1.+t*.2+1.6));      /* the diamond-ring flare */
  col=mix(col,vec3(.0),smoothstep(R,R-.004,r));                                                  /* the black disc */
  float stars=step(.9965,hash(floor(uv*vec2(asp,1.)*220.)));
  col+=vec3(.5,.1,.1)*stars*.5*(.6+.4*sin(t*2.+uv.x*30.));
  float ash=fbm(vec2(uv.x*asp*2.-t*.05,uv.y*2.+t*.08));
  col+=vec3(.12,.01,.015)*smoothstep(.45,.9,ash)*.5;
  return col;
}

/* 3: violet thunderstorm over a lava ground */
float bolt(vec2 uv,float asp,float x0,float t){
  float y=uv.y,off=0.;
  off+=(noise(vec2(y*9.,x0*40.))-.5)*.06+(noise(vec2(y*28.,x0*40.+3.))-.5)*.02;
  float d=abs(uv.x*asp-(x0*asp+off+(1.-y)*.04));
  float m=smoothstep(.2,.3,y);
  return (exp(-d*260.)*1.1+exp(-d*34.)*.28)*m;
}
vec3 env3(vec2 uv,float t,float asp){
  vec2 p=vec2(uv.x*asp,uv.y);
  vec3 sky=mix(vec3(.05,.015,.1),vec3(.14,.04,.26),smoothstep(.2,1.,uv.y));
  float c=fbm(vec2(p.x*1.3+t*.04,p.y*2.6-t*.03));
  float c2=fbm(vec2(p.x*2.6-t*.07,p.y*4.5+t*.02));
  sky=mix(sky,vec3(.25,.1,.42),smoothstep(.35,.9,c)*.8);
  sky+=vec3(.08,.03,.12)*c2;
  sky+=vec3(.55,.4,.9)*uFlash*(.35+.9*c)*smoothstep(.15,1.,uv.y);
  float horizon=.27;
  /* ridges */
  float ridge1=horizon+.05*fbm3(vec2(p.x*1.7,1.))+.03;
  float ridge2=horizon-.01+.035*fbm3(vec2(p.x*3.1+9.,2.));
  vec3 col=sky;
  col+=vec3(1.,.4,.1)*exp(-abs(uv.y-ridge1)*18.)*.12;
  if(uv.y<ridge1){ col=mix(vec3(.02,.008,.03),vec3(.08,.03,.12),uFlash); }
  if(uv.y<ridge2){ col=vec3(.015,.005,.02); }
  /* lava floor with cracks */
  float gy=horizon-.05;
  if(uv.y<gy){
    float d=(gy-uv.y);
    float z=1./(d*3.+.18);
    vec2 g=vec2(p.x*z*2.4+t*.01,z*1.8-t*.02);
    vec2 id=floor(g),fr=fract(g);
    float m1=9.,m2=9.;
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
      vec2 o=vec2(float(i),float(j));vec2 h=hash2(id+o);h=.5+.5*sin(t*.12+6.28*h);
      float dd=length(o+h-fr);
      if(dd<m1){m2=m1;m1=dd;}else if(dd<m2)m2=dd;
    }
    float crack=smoothstep(.07,.0,m2-m1);
    float heat=.55+.45*noise(g*2.+t*.4);
    vec3 lava=mix(vec3(.04,.012,.03),vec3(1.,.38,.06),crack*heat);
    lava+=vec3(1.,.85,.4)*pow(crack,3.)*.6;
    lava+=vec3(.22,.05,.02)*exp(-d*10.);
    col=mix(lava,vec3(.02,.01,.03),smoothstep(.1,.0,d)*.0);
    col=mix(col,vec3(.05,.015,.08),smoothstep(.0,.04,gy-uv.y)*0.);
  }
  col+=vec3(1.,.35,.1)*exp(-abs(uv.y-horizon)*20.)*.12;
  col+=vec3(.9,.75,1.)*bolt(uv,asp,uBolt,t)*uFlash*1.6;
  return col;
}

vec3 env(float m,vec2 uv,float t,float asp){
  if(m<.5) return env0(uv,t,asp);
  if(m<1.5) return env1(uv,t,asp);
  if(m<2.5) return env2(uv,t,asp);
  return env3(uv,t,asp);
}

void main(){
  vec2 fc=gl_FragCoord.xy; vec2 uv=fc/uRes; float asp=uRes.x/uRes.y;
  float t=uT;
  vec3 col=env(uA,uv,t,asp);
  if(uMix>.002){ col=mix(col,env(uB,uv,t,asp),uMix); }
  float vig=smoothstep(1.25,.35,length((uv-.5)*vec2(asp*.55,1.)));
  col*=.55+.45*vig;
  /* gentle tone map */
  col=col/(1.+col*.18);
  col=pow(col,vec3(.93));
  gl_FragColor=vec4(col,1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
  return s;
}

export function startGL(canvas) {
  if (!canvas) return () => {};
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return () => {};
  const vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return () => {};
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return () => {}; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uRes', 'uT', 'uMix', 'uFlash', 'uBolt', 'uA', 'uB', 'uMouse'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const small = Math.min(innerWidth, innerHeight) < 600;
  let quality = reducedStart(small), cw = 0, ch = 0;
  const q = { a: 0, b: 0, mix: 0, to: 0, fl: 0, flT: 3, bolt: 0.5 };
  const envOf = (i) => WEAPONS[i].env;
  q.a = q.b = envOf(0);

  function reducedStart(sm) { return world.reduce ? 0.35 : sm ? 0.42 : 0.55; }
  function resize() {
    const w = Math.max(2, Math.round(innerWidth * DPR * quality)), h = Math.max(2, Math.round(innerHeight * DPR * quality));
    if (w !== cw || h !== ch) { cw = w; ch = h; canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  resize();
  addEventListener('resize', resize);

  /* adaptive quality: the shader's own GPU time (timer query) decides the render scale, so a slow page elsewhere
     (the SVG weapon) cannot make the background needlessly blurry. Without the extension the scale stays fixed. */
  const tq = gl.getExtension('EXT_disjoint_timer_query');
  let pending = null, ema = 0, samples = 0;
  const qMax = small ? 0.55 : 0.8, qMin = 0.36;
  function readTimer() {
    if (!tq || !pending) return;
    const ok = tq.getQueryObjectEXT(pending, tq.QUERY_RESULT_AVAILABLE_EXT), bad = gl.getParameter(tq.GPU_DISJOINT_EXT);
    if (!ok) return;
    if (!bad) {
      const ms = tq.getQueryObjectEXT(pending, tq.QUERY_RESULT_EXT) / 1e6;
      ema = ema ? ema * 0.9 + ms * 0.1 : ms; samples++;
      if (samples % 30 === 0) {
        if (ema > 4.2 && quality > qMin) { quality = Math.max(qMin, quality * 0.9); resize(); }
        else if (ema < 2 && quality < qMax) { quality = Math.min(qMax, quality * 1.06); resize(); }
      }
    }
    tq.deleteQueryEXT(pending); pending = null;
  }
  function adapt() { readTimer(); }

  let seen = world.cur, start = performance.now() / 1000;
  const off = onFrame((tt) => {
    if (window.__dbg && window.__dbg.gl === 0) return;
    const now = performance.now() / 1000;
    adapt();
    const cur = world.cur;
    if (cur !== seen) {
      /* start a crossfade from whatever is showing to the new world */
      if (q.mix > 0.5) q.a = q.b;
      q.b = envOf(cur); q.mix = q.mix > 0.5 ? 0 : q.mix; q.to = 1; seen = cur;
      if (q.a === q.b) { q.to = 0; q.mix = 0; }
    }
    q.mix += (q.to - q.mix) * (1 - Math.exp(-0.016 * 60 * 0.045));
    if (q.to === 1 && q.mix > 0.995) { q.a = q.b; q.mix = 0; q.to = 0; }

    /* lightning (world 3 only, but cheap to keep running) */
    q.flT -= 1 / 60;
    if (q.flT <= 0) { q.fl = 1; q.flT = 2.2 + Math.random() * 4.5; q.bolt = 0.15 + Math.random() * 0.7; world.flash = 1; }
    q.fl *= 0.9; if (q.fl < 0.01) q.fl = 0; world.flash = q.fl;
    const mixing = q.mix > 0.002 ? 1 : 0;
    const flash = (q.b === 3 && (mixing || q.a === 3) ? 1 : q.a === 3 ? 1 : 0) * q.fl * (0.6 + 0.4 * Math.sin(q.fl * 40));

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uT, now - start);
    gl.uniform1f(U.uMix, q.mix); gl.uniform1f(U.uA, q.a); gl.uniform1f(U.uB, q.b);
    gl.uniform1f(U.uFlash, flash); gl.uniform1f(U.uBolt, q.bolt);
    const q0 = tq && !pending ? tq.createQueryEXT() : null;
    if (q0) tq.beginQueryEXT(tq.TIME_ELAPSED_EXT, q0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (q0) { tq.endQueryEXT(tq.TIME_ELAPSED_EXT); pending = q0; }
  });
  return () => { off(); removeEventListener('resize', resize); };
}
