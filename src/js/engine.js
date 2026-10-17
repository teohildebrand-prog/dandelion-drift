'use strict';
/* ===================== ENGINE: math, WebGL renderer, mesh builder ===================== */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
let _seed = 1234567;
const rnd = () => { _seed = _seed + 0x6D2B79F5 | 0; let t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const rf = (a, b) => a + (b - a) * Math.random();

class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addS(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  scale(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  len() { return Math.hypot(this.x, this.y, this.z); }
  lenXZ() { return Math.hypot(this.x, this.z); }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  distXZ(v) { return Math.hypot(this.x - v.x, this.z - v.z); }
  norm() { const l = this.len() || 1; return this.scale(1 / l); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  lerpV(a, b, t) { this.x = a.x + (b.x - a.x) * t; this.y = a.y + (b.y - a.y) * t; this.z = a.z + (b.z - a.z) * t; return this; }
}

/* column-major 4x4 matrices */
const M4 = {
  make() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  ident(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  copy(o, a) { o.set(a); return o; },
  mul(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  persp(o, fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  lookAt(o, e, c, up = { x: 0, y: 1, z: 0 }) {
    let zx = e.x - c.x, zy = e.y - c.y, zz = e.z - c.z; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up.y * zz - up.z * zy, xy = up.z * zx - up.x * zz, xz = up.x * zy - up.y * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e.x + xy * e.y + xz * e.z); o[13] = -(yx * e.x + yy * e.y + yz * e.z); o[14] = -(zx * e.x + zy * e.y + zz * e.z); o[15] = 1; return o;
  },
  tr(m, x, y, z) { m[12] += m[0] * x + m[4] * y + m[8] * z; m[13] += m[1] * x + m[5] * y + m[9] * z; m[14] += m[2] * x + m[6] * y + m[10] * z; m[15] += m[3] * x + m[7] * y + m[11] * z; return m; },
  sc(m, x, y, z) { for (let i = 0; i < 4; i++) { m[i] *= x; m[4 + i] *= y; m[8 + i] *= z; } return m; },
  rx(m, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) { const y = m[4 + i], z = m[8 + i]; m[4 + i] = y * c + z * s; m[8 + i] = z * c - y * s; } return m; },
  ry(m, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) { const x = m[i], z = m[8 + i]; m[i] = x * c - z * s; m[8 + i] = x * s + z * c; } return m; },
  rz(m, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) { const x = m[i], y = m[4 + i]; m[i] = x * c + y * s; m[4 + i] = y * c - x * s; } return m; },
  xf(m, x, y, z, out) { out[0] = m[0] * x + m[4] * y + m[8] * z + m[12]; out[1] = m[1] * x + m[5] * y + m[9] * z + m[13]; out[2] = m[2] * x + m[6] * y + m[10] * z + m[14]; return out; },
};
/* a matrix stack for posing models */
class MStack {
  constructor() { this.s = [M4.make()]; this.i = 0; for (let k = 0; k < 24; k++) this.s.push(M4.make()); }
  get top() { return this.s[this.i]; }
  reset() { this.i = 0; M4.ident(this.s[0]); return this; }
  push() { this.s[this.i + 1].set(this.s[this.i]); this.i++; return this; }
  pop() { this.i--; return this; }
  t(x, y, z) { M4.tr(this.top, x, y, z); return this; }
  s3(x, y, z) { M4.sc(this.top, x, y, z ?? x); return this; }
  rX(a) { M4.rx(this.top, a); return this; }
  rY(a) { M4.ry(this.top, a); return this; }
  rZ(a) { M4.rz(this.top, a); return this; }
}

/* colours */
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mulc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/* material channel weights for the triplanar detail texture: rock strata, grass speckle, bark stripes, soft blotch */
const MAT = { none: [0, 0, 0, 0], rock: [1, 0, 0, 0], moss: [0, 1, 0, 0], bark: [0, 0, 1, 0], soft: [0, 0, 0, 1], leaf: [0, .4, 0, .6], sand: [.5, 0, 0, .5] };

/* ---------- mesh builder: flat-shaded triangles with vertex colours ---------- */
const STRIDE = 13;
class Builder {
  constructor() { this.v = []; this.T = M4.make(); this.stk = []; this._a = [0, 0, 0]; this._b = [0, 0, 0]; this._c = [0, 0, 0]; this.jit = .05; }
  push() { this.stk.push(new Float32Array(this.T)); return this; }
  pop() { this.T = this.stk.pop(); return this; }
  t(x, y, z) { M4.tr(this.T, x, y, z); return this; }
  rY(a) { M4.ry(this.T, a); return this; }
  rX(a) { M4.rx(this.T, a); return this; }
  rZ(a) { M4.rz(this.T, a); return this; }
  s3(x, y, z) { M4.sc(this.T, x, y ?? x, z ?? x); return this; }
  tri(a, b, c, ca, cb, cc, mat) {
    const A = M4.xf(this.T, a[0], a[1], a[2], this._a), B = M4.xf(this.T, b[0], b[1], b[2], this._b), C = M4.xf(this.T, c[0], c[1], c[2], this._c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const m = mat || MAT.none, j = this.jit;
    for (const [P, col] of [[A, ca], [B, cb], [C, cc]]) {
      const k = 1 + (Math.random() - .5) * 2 * j;
      this.v.push(P[0], P[1], P[2], nx, ny, nz, col[0] * k, col[1] * k, col[2] * k, m[0], m[1], m[2], m[3]);
    }
  }
  quad(a, b, c, d, ca, cb, cc, cd, mat) { this.tri(a, b, c, ca, cb, cc, mat); this.tri(a, c, d, ca, cc, cd, mat); }
  /* axis box centred at (x,y,z) with half sizes; o: {col, top, bot, mat, topMat, ao} */
  box(x, y, z, hx, hy, hz, o = {}) {
    const col = o.col || [.7, .7, .7], top = o.top || col, bot = o.bot || mulc(col, .6), ao = o.ao ?? .72;
    const low = mulc(col, ao), mat = o.mat, tm = o.topMat || mat;
    const p = (sx, sy, sz) => [x + sx * hx, y + sy * hy, z + sz * hz];
    const c000 = p(-1, -1, -1), c100 = p(1, -1, -1), c110 = p(1, 1, -1), c010 = p(-1, 1, -1), c001 = p(-1, -1, 1), c101 = p(1, -1, 1), c111 = p(1, 1, 1), c011 = p(-1, 1, 1);
    if (o.skipTop !== true) this.quad(c011, c111, c110, c010, top, top, top, top, tm);
    if (o.skipBot !== true) this.quad(c000, c100, c101, c001, bot, bot, bot, bot, mat);
    this.quad(c001, c101, c111, c011, low, low, col, col, mat);   // +z
    this.quad(c100, c000, c010, c110, low, low, col, col, mat);   // -z
    this.quad(c101, c100, c110, c111, low, low, col, col, mat);   // +x
    this.quad(c000, c001, c011, c010, low, low, col, col, mat);   // -x
  }
  /* cylinder/cone along y from y0 (base) with height h */
  cyl(x, y0, z, rb, rt, h, seg, o = {}) {
    const col = o.col || [.7, .7, .7], top = o.top || col, ao = o.ao ?? .75, low = mulc(col, ao), mat = o.mat, tm = o.topMat || mat, a0 = o.a0 || 0, wob = o.wob || 0;
    const pts = [];
    for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI * 2, w = i === seg ? pts[0][2] : 1 + (wob ? (Math.random() - .5) * wob : 0); pts.push([Math.cos(a), Math.sin(a), w]); }
    for (let i = 0; i < seg; i++) {
      const [c0, s0, w0] = pts[i], [c1, s1, w1] = pts[i + 1];
      const b0 = [x + c0 * rb * w0, y0, z + s0 * rb * w0], b1 = [x + c1 * rb * w1, y0, z + s1 * rb * w1];
      const t0 = [x + c0 * rt * w0, y0 + h, z + s0 * rt * w0], t1 = [x + c1 * rt * w1, y0 + h, z + s1 * rt * w1];
      if (rt > 0) this.quad(b1, b0, t0, t1, low, low, col, col, mat); else this.tri(b1, b0, t0, low, low, col, mat);
      if (o.capT !== false && rt > 0) this.tri([x, y0 + h, z], t1, t0, top, top, top, tm);
      if (o.capB) this.tri([x, y0, z], b0, b1, low, low, low, mat);
    }
  }
  /* low-poly ellipsoid */
  sph(x, y, z, rx, ry, rz, seg, rings, o = {}) {
    const col = o.col || [.8, .8, .8], top = o.top || col, botc = o.bot || mulc(col, .7), mat = o.mat, wob = o.wob || 0;
    const P = [];
    for (let r = 0; r <= rings; r++) {
      const ph = r / rings * Math.PI, row = [];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, w = (r === 0 || r === rings) ? 1 : 1 + (wob ? (Math.random() - .5) * wob : 0);
        row.push([x + Math.sin(ph) * Math.cos(a) * rx * w, y + Math.cos(ph) * ry * w, z + Math.sin(ph) * Math.sin(a) * rz * w]);
      }
      if (wob && r > 0 && r < rings) row[seg] = row[0];
      P.push(row);
    }
    const cAt = r => mixc(top, botc, r / rings);
    for (let r = 0; r < rings; r++) for (let i = 0; i < seg; i++) {
      const a = P[r][i], b = P[r][i + 1], c = P[r + 1][i + 1], d = P[r + 1][i], ca = cAt(r), cb = cAt(r + 1);
      if (r === 0) this.tri(a, c, d, ca, cb, cb, mat);
      else if (r === rings - 1) this.tri(a, b, d, ca, ca, cb, mat);
      else this.quad(a, b, c, d, ca, ca, cb, cb, mat);
    }
  }
  /* oriented beam from point a to point b with square-ish cross section (used for branches, stems) */
  beam(ax, ay, az, bx, by, bz, ra, rb, seg, o = {}) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
    this.push(); this.t(ax, ay, az);
    const yaw = Math.atan2(dx, dz), pitch = Math.acos(clamp(dy / L, -1, 1));
    this.rY(yaw); this.rX(pitch);
    this.cyl(0, 0, 0, ra, rb, L, seg, o);
    this.pop();
  }
  upload(gl) {
    const data = new Float32Array(this.v), buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { buf, count: data.length / STRIDE };
  }
}

/* ---------- renderer ---------- */
const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec4 aM;
uniform mat4 uProj, uView, uModel;
varying vec3 vC, vN, vW; varying vec4 vM; varying float vD;
void main(){
  vec4 w = uModel * vec4(aP,1.0);
  vW = w.xyz; vN = mat3(uModel) * aN; vC = aC; vM = aM;
  vec4 v = uView * w; vD = -v.z;
  gl_Position = uProj * v;
}`;
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vC, vN, vW; varying vec4 vM; varying float vD;
uniform sampler2D uTex; uniform vec4 uTint; uniform float uAlpha, uDither, uUnlit;
uniform vec3 uFogC, uSun, uSunC, uSky, uGnd; uniform vec2 uFog; uniform vec4 uCloud; uniform float uCloudOn;
float bayer(vec2 p){ vec2 q = mod(floor(p),4.0); float a=q.x+q.y*4.0;
  return mod(a*7.0+3.0,16.0)/16.0 - 0.5; }
void main(){
  vec3 n = normalize(vN);
  vec3 w = abs(n); w /= (w.x+w.y+w.z);
  vec2 sx = vW.zy*0.23, sy = vW.xz*0.23, sz = vW.xy*0.23;
  vec4 t = texture2D(uTex, sx)*w.x + texture2D(uTex, sy)*w.y + texture2D(uTex, sz)*w.z;
  float mw = vM.x+vM.y+vM.z+vM.w;
  float det = mw > 0.001 ? mix(1.0, 0.62 + 0.76*dot(t, vM)/mw, min(mw,1.0)) : 1.0;
  vec3 base = vC * uTint.rgb * det;
  vec3 light = mix(uGnd, uSky, n.y*0.5+0.5);
  float sun = max(dot(n, uSun), 0.0);
  float shade = 1.0;
  if (uCloudOn > 0.5) { float d = length(vW.xz - uCloud.xy); shade = mix(1.0, 1.0 - uCloud.w, 1.0 - smoothstep(uCloud.z*0.75, uCloud.z, d)); }
  vec3 c = base * (light + uSunC * sun * shade) + base * uTint.a;
  if (uUnlit > 0.5) c = base; else c = mix(c, uFogC, smoothstep(uFog.x, uFog.y, vD));
  if (uDither > 0.5) c = floor(c*31.0 + 0.5 + bayer(gl_FragCoord.xy)) / 31.0;
  gl_FragColor = vec4(c, uAlpha);
}`;
const PVS = `
attribute vec3 aP; attribute vec4 aC; attribute float aS;
uniform mat4 uProj, uView; uniform float uScale;
varying vec4 vC; varying float vD;
void main(){ vec4 v = uView*vec4(aP,1.0); vD = -v.z; vC = aC; gl_Position = uProj*v; gl_PointSize = clamp(aS*uScale/max(vD,0.1), 1.0, 96.0); }`;
const PFS = `
precision mediump float; varying vec4 vC; varying float vD; uniform vec3 uFogC; uniform vec2 uFog;
void main(){ vec2 p = gl_PointCoord*2.0-1.0; float r = dot(p,p); if (r>1.0) discard;
  float a = vC.a * (1.0 - r*r);
  vec3 c = vC.rgb + (1.0-smoothstep(0.0,0.35,dot(p-vec2(-0.3,-0.35),p-vec2(-0.3,-0.35))))*0.45;
  c = mix(c, uFogC, smoothstep(uFog.x, uFog.y, vD));
  gl_FragColor = vec4(c, a); }`;

function makeRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const P = program(VS, FS), PP = program(PVS, PFS);
  const U = {}; ['uProj', 'uView', 'uModel', 'uTex', 'uTint', 'uAlpha', 'uDither', 'uFogC', 'uSun', 'uSunC', 'uSky', 'uGnd', 'uFog', 'uCloud', 'uCloudOn', 'uUnlit'].forEach(n => U[n] = gl.getUniformLocation(P, n));
  const A = { aP: gl.getAttribLocation(P, 'aP'), aN: gl.getAttribLocation(P, 'aN'), aC: gl.getAttribLocation(P, 'aC'), aM: gl.getAttribLocation(P, 'aM') };
  const PU = {}; ['uProj', 'uView', 'uScale', 'uFogC', 'uFog'].forEach(n => PU[n] = gl.getUniformLocation(PP, n));
  const PA = { aP: gl.getAttribLocation(PP, 'aP'), aC: gl.getAttribLocation(PP, 'aC'), aS: gl.getAttribLocation(PP, 'aS') };

  /* detail texture: 4 tileable grey patterns, one per channel */
  const TS = 64, td = new Uint8Array(TS * TS * 4);
  const tile = (x, y, f) => f(x / TS * Math.PI * 2, y / TS * Math.PI * 2);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = (y * TS + x) * 4;
    const strata = tile(x, y, (u, v) => .5 + .16 * Math.sin(v * 2 + Math.sin(u * 2) * .9) + .12 * Math.sin(u * 3 + v * 2) + .1 * Math.sin(u * 5 - v * 3) + .06 * Math.sin(v * 6 + u * 2));
    const grass = tile(x, y, (u, v) => .5 + .2 * Math.sin(u * 9 + Math.sin(v * 5)) * Math.sin(v * 8 + u * 2) + .12 * Math.sin(u * 15 + v * 13));
    const bark = tile(x, y, (u, v) => .5 + .3 * Math.sin(u * 6 + Math.sin(v * 2) * .8) + .1 * Math.sin(u * 17 + v));
    const soft = tile(x, y, (u, v) => .5 + .18 * Math.sin(u * 2 + v * 3) + .14 * Math.sin(u * 5 - v * 4) + .1 * Math.sin(u * 3 + v * 7));
    td[i] = clamp(strata * 255 + (Math.random() - .5) * 26, 0, 255); td[i + 1] = clamp(grass * 255 + (Math.random() - .5) * 40, 0, 255);
    td[i + 2] = clamp(bark * 255 + (Math.random() - .5) * 20, 0, 255); td[i + 3] = clamp(soft * 255 + (Math.random() - .5) * 16, 0, 255);
  }
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TS, TS, 0, gl.RGBA, gl.UNSIGNED_BYTE, td);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); gl.generateMipmap(gl.TEXTURE_2D);

  const proj = M4.make(), view = M4.make(), I = M4.make();
  const R = {
    gl, proj, view, fov: 1.05, near: .2, far: 400,
    fogC: [.75, .85, .95], fog: [60, 190], sun: [.42, .8, .42], sunC: [.85, .78, .62], sky: [.62, .7, .82], gnd: [.36, .34, .3],
    cloud: [0, 0, 0, 0], cloudOn: 0, dither: 1, scaleH: 1,
    resize(w, h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); M4.persp(proj, R.fov, w / h, R.near, R.far); R.scaleH = h / (2 * Math.tan(R.fov / 2)); },
    setFov(f) { R.fov = f; M4.persp(proj, f, canvas.width / canvas.height, R.near, R.far); R.scaleH = canvas.height / (2 * Math.tan(f / 2)); },
    begin(clear) {
      gl.clearColor(clear[0], clear[1], clear[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
      gl.useProgram(P);
      gl.uniformMatrix4fv(U.uProj, false, proj); gl.uniformMatrix4fv(U.uView, false, view);
      gl.uniform3fv(U.uFogC, R.fogC); gl.uniform2fv(U.uFog, R.fog); const s = R.sun, l = Math.hypot(...s);
      gl.uniform3f(U.uSun, s[0] / l, s[1] / l, s[2] / l); gl.uniform3fv(U.uSunC, R.sunC); gl.uniform3fv(U.uSky, R.sky); gl.uniform3fv(U.uGnd, R.gnd);
      gl.uniform4fv(U.uCloud, R.cloud); gl.uniform1f(U.uCloudOn, R.cloudOn); gl.uniform1f(U.uDither, R.dither);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
      gl.disable(gl.BLEND); gl.depthMask(true);
    },
    blend(on) { if (on) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); } },
    cull(on) { if (on) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE); },
    draw(mesh, model = I, tint = null, alpha = 1, emis = 0, unlit = 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
      const B = STRIDE * 4;
      gl.enableVertexAttribArray(A.aP); gl.vertexAttribPointer(A.aP, 3, gl.FLOAT, false, B, 0);
      gl.enableVertexAttribArray(A.aN); gl.vertexAttribPointer(A.aN, 3, gl.FLOAT, false, B, 12);
      gl.enableVertexAttribArray(A.aC); gl.vertexAttribPointer(A.aC, 3, gl.FLOAT, false, B, 24);
      gl.enableVertexAttribArray(A.aM); gl.vertexAttribPointer(A.aM, 4, gl.FLOAT, false, B, 36);
      gl.uniformMatrix4fv(U.uModel, false, model);
      gl.uniform4f(U.uTint, tint ? tint[0] : 1, tint ? tint[1] : 1, tint ? tint[2] : 1, emis);
      gl.uniform1f(U.uAlpha, alpha); gl.uniform1f(U.uUnlit, unlit);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    },
    /* points: data is Float32Array of [x,y,z,r,g,b,a,size]*n */
    pbuf: gl.createBuffer(),
    points(data, n, additive) {
      if (!n) return;
      gl.useProgram(PP);
      gl.uniformMatrix4fv(PU.uProj, false, proj); gl.uniformMatrix4fv(PU.uView, false, view); gl.uniform1f(PU.uScale, R.scaleH);
      gl.uniform3fv(PU.uFogC, R.fogC); gl.uniform2fv(PU.uFog, R.fog);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.pbuf); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 8), gl.DYNAMIC_DRAW);
      for (const k in A) gl.disableVertexAttribArray(A[k]);
      gl.enableVertexAttribArray(PA.aP); gl.vertexAttribPointer(PA.aP, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(PA.aC); gl.vertexAttribPointer(PA.aC, 4, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(PA.aS); gl.vertexAttribPointer(PA.aS, 1, gl.FLOAT, false, 32, 28);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.disableVertexAttribArray(PA.aP); gl.disableVertexAttribArray(PA.aC); gl.disableVertexAttribArray(PA.aS);
      gl.depthMask(true); gl.disable(gl.BLEND);
      gl.useProgram(P);
    },
  };
  return R;
}

/* a growable point batch */
class PBatch {
  constructor(cap = 4096) { this.d = new Float32Array(cap * 8); this.n = 0; this.cap = cap; }
  clear() { this.n = 0; }
  add(x, y, z, r, g, b, a, s) {
    if (this.n >= this.cap) return; const i = this.n++ * 8, d = this.d;
    d[i] = x; d[i + 1] = y; d[i + 2] = z; d[i + 3] = r; d[i + 4] = g; d[i + 5] = b; d[i + 6] = a; d[i + 7] = s;
  }
}

