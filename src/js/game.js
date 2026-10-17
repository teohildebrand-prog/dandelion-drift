'use strict';
/* ===================== GAME ===================== */
const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('c');
let R = null;
try { R = makeRenderer(canvas); } catch (e) { console.error(e); }
/* no WebGL: show the message and stop here; render.js and ui.js stop too */
if (!R) { $('glErr').hidden = false; $('title').hidden = true; throw new Error('WebGL unavailable'); }
const gl = R.gl;

/* ---------- natural puffcaps are solid ---------- */
natCaps.forEach(c => { c.solid = addSolid({ type: 'cyl', x: c.x, z: c.z, r: 1.35, bot: c.y, top: c.y + 1.45, surf: 'cap', cap: c }); gridAdd(c.solid); });

/* ---------- upload meshes ---------- */
const WORLD = WB.upload(gl), WORLDX = WX.upload(gl);
const M = {}; for (const k in MD) if (MD[k]) M[k] = MD[k].upload(gl);
webs.forEach(w => {
  const b = new Builder(); b.jit = 0;
  const seg = (x1, y1, x2, y2, t = .045) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * t, ny = dx / l * t; const c = [1, 1, 1]; b.quad([x1 - nx, y1 - ny, 0], [x2 - nx, y2 - ny, 0], [x2 + nx, y2 + ny, 0], [x1 + nx, y1 + ny, 0], c, c, c, c); };
  const A = 12, rw = w.w / 2, rh = w.h / 2, pt = (a, f) => [Math.cos(a) * rw * f, Math.sin(a) * rh * f];
  for (let i = 0; i < A; i++) { const [x, y] = pt(i / A * 6.28, 1); seg(0, 0, x, y); }
  for (let k = 1; k <= 6; k++) for (let i = 0; i < A; i++) { const f = k / 6.4, [x1, y1] = pt(i / A * 6.28, f), [x2, y2] = pt((i + 1) / A * 6.28, f); seg(x1, y1, x2, y2, .03); }
  w.mesh = b.upload(gl); w.sp = 0; w.spT = 0;
});

/* ---------- tuning (GDD starting values) ---------- */
const TUNE = { sink: 1, airSpeed: 4, diveSpeed: 12, flareClimb: 6, fern: 15, sunpod: 30, kWarn: 1.5, kWarnAssist: 2.5, run: 6.2, jump: 11.6, grav: 28 };
const PLANTS = [
  { id: 'fern', name: 'Fan Fern', note: 'Updraft, 15 m' },
  { id: 'sunpod', name: 'Sunpod', note: 'Thermal, 30 m, sun only' },
  { id: 'puffcap', name: 'Puffcap', note: 'One strong burst' },
  { id: 'windbell', name: 'Windbell', note: 'Bends side wind upward' },
  { id: 'bramble', name: 'Bramble Ward', note: 'Predators keep 10 m away' },
];
const unlocked = new Set(['fern', 'puffcap']);
let lastPlant = 'fern';

/* ---------- options (per-viewer convenience) ---------- */
const OPT = { assist: false, tilt: true, sharp: false, dither: true };
try { Object.assign(OPT, JSON.parse(localStorage.getItem('dd-opt') || '{}')); } catch (e) {}
const saveOpt = () => { try { localStorage.setItem('dd-opt', JSON.stringify(OPT)); } catch (e) {} };

/* ---------- player ---------- */
const PR = .35, PH = 1.1;
const START = { x: 0, y: 0, z: 58, yaw: Math.PI };
const P = {
  pos: new V3(START.x, START.y, START.z), prev: new V3(START.x, START.y, START.z), vel: new V3(), yaw: START.yaw, prevYaw: START.yaw,
  state: 'ground', open: false, dive: false, diveT: 0, flareT: 0, flareP: 1, coyote: 0, jumpBuf: 0, jumpT: 0, jumpHeld: false,
  hang: null, climbT: 0, regrab: 0, sticky: 0, inv: 0, spin: 0, turbT: 0, noLift: 0, sporeT: 0, launchT: 0, stun: 0,
  tufts: 3, maxTufts: 3, pods: 0, ground: null, web: null, struggle: 0, caughtT: 0, caughtBy: null, pulseCd: 0, pulseT: 0,
  anim: 0, stepD: 0, inLift: 0, feather: false, goldenT: 0, landSq: 0, reopenT: 0,
};
const STATS = { t: 0, pollen: [0, 0, 0], golden: 0, letters: 0, hits: 0, falls: 0 };
const TOT = { pollen: [0, 0, 0] }; motes.forEach(m => TOT.pollen[m.tier - 1]++);
let checkpointCP = null, cpPods = 0;
let mode = 'title', gameT = 0, worldT = 0, timeScale = 1, tierNow = 1, tiersSeen = new Set(), chimneyIntro = false;
let pollenCombo = 0, pollenLastT = -9;

/* ---------- input ---------- */
const IN = { kx: 0, kz: 0, gx: 0, gz: 0, tx: 0, tz: 0, jump: false, jumpP: 0, closeP: 0, dive: false, plant: false, plantP: 0, plantR: 0, pulseP: 0, camX: 0, camY: 0, mdx: 0, mdy: 0, recenter: 0, num: 0, gDive: false, tDive: false, kDive: false, mDive: false };
const keys = {};
function moveRaw() { let x = IN.kx + IN.gx + IN.tx, z = IN.kz + IN.gz + IN.tz; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } return { x, z, m: Math.min(1, l) }; }
function moveVec() {
  const r = moveRaw(), cy = cam.yaw;
  const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = -fz, rz = fx;
  const x = fx * r.z + rx * r.x, z = fz * r.z + rz * r.x;
  return { x, z, m: r.m };
}
const turnToward = (a, b, max) => a + clamp(wrapA(b - a), -max, max);

/* ---------- collision helpers ---------- */
const dyn = [];   // planted puffcap solids
function local(s, x, z) { const dx = x - s.x, dz = z - s.z; return [dx * s.c - dz * s.s, dx * s.s + dz * s.c]; }
function contains(s, x, z, pad) {
  if (s.type === 'cyl') return Math.hypot(x - s.x, z - s.z) <= s.r + pad;
  const [lx, lz] = local(s, x, z); return Math.abs(lx) <= s.hx + pad && Math.abs(lz) <= s.hz + pad;
}
function candidates(x0, z0, x1, z1) { const a = near(x0, z0, x1, z1); return a; }
function groundUnder(x, z, yMax, pad = .14) {
  let best = -1e9, bs = null;
  for (const s of candidates(x - 1, z - 1, x + 1, z + 1)) { if (s.inv || s.top > yMax + 1e-4 || s.top <= best) continue; if (contains(s, x, z, pad)) { best = s.top; bs = s; } }
  return bs ? { top: best, s: bs } : null;
}
function pushOut(p, v, stepTol) {
  let wall = null;
  for (let it = 0; it < 2; it++) for (const s of candidates(p.x - 1.5, p.z - 1.5, p.x + 1.5, p.z + 1.5)) {
    if (s.top <= p.y + stepTol || s.bot >= p.y + PH) continue;
    if (s.type === 'cyl') {
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), R0 = s.r + PR;
      if (d >= R0) continue;
      const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
      p.x = s.x + nx * R0; p.z = s.z + nz * R0;
      const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; }
      wall = { nx, nz, s };
    } else {
      const [lx, lz] = local(s, p.x, p.z);
      const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz);
      let dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz), nlx, nlz, pen;
      if (d >= PR) continue;
      if (d > 1e-5) { nlx = dx / d; nlz = dz / d; pen = PR - d; }
      else { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) { nlx = Math.sign(lx) || 1; nlz = 0; pen = px + PR; } else { nlx = 0; nlz = Math.sign(lz) || 1; pen = pz + PR; } }
      const nx = nlx * s.c + nlz * s.s, nz = -nlx * s.s + nlz * s.c;
      p.x += nx * pen; p.z += nz * pen;
      const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; }
      wall = { nx, nz, s };
    }
  }
  return wall;
}
function ceilingAbove(x, z, yHead, yHeadPrev) {
  let lowest = null;
  for (const s of candidates(x - 1, z - 1, x + 1, z + 1)) { if (s.inv && s.bot > 150) continue; if (s.bot < yHeadPrev - .05 || s.bot > yHead) continue; if (contains(s, x, z, -.05)) if (!lowest || s.bot < lowest.bot) lowest = s; }
  return lowest;
}
function sheltered(x, y, z) {
  for (const s of candidates(x - 1, z - 1, x + 1, z + 1)) { if (s.inv) continue; if (s.bot > y + 1.3 && s.bot < y + 26 && contains(s, x, z, 0)) return true; }
  return false;
}
/* segment a→b against solids for the camera; returns clear fraction */
const CAMPAD = .35;
function rayClear(a, b) {
  let best = 1; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  for (const s of candidates(Math.min(a.x, b.x) - 1, Math.min(a.z, b.z) - 1, Math.max(a.x, b.x) + 1, Math.max(a.z, b.z) + 1)) {
    if (s.inv || (s.type === 'cyl' && s.r < .7)) continue;
    let t;
    if (s.type === 'box') {
      const [ax, az] = local(s, a.x, a.z), ldx = dx * s.c - dz * s.s, ldz = dx * s.s + dz * s.c;
      const mn = [-s.hx - CAMPAD, s.bot - CAMPAD, -s.hz - CAMPAD], mx = [s.hx + CAMPAD, s.top + CAMPAD, s.hz + CAMPAD], o = [ax, a.y, az], d = [ldx, dy, ldz];
      if (o[0] > mn[0] && o[0] < mx[0] && o[1] > mn[1] && o[1] < mx[1] && o[2] > mn[2] && o[2] < mx[2]) continue;
      let t0 = 0, t1 = 1, hit = true;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) { hit = false; break; } continue; }
        let ta = (mn[k] - o[k]) / d[k], tb = (mx[k] - o[k]) / d[k]; if (ta > tb) { const q = ta; ta = tb; tb = q; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { hit = false; break; }
      }
      if (!hit) continue; t = t0;
    } else {
      const fx = a.x - s.x, fz = a.z - s.z, Rr = s.r + CAMPAD, A = dx * dx + dz * dz, c0 = fx * fx + fz * fz - Rr * Rr;
      if (c0 < 0 && a.y > s.bot - CAMPAD && a.y < s.top + CAMPAD) continue;
      t = 2;
      if (A > 1e-8) { const B = 2 * (fx * dx + fz * dz), disc = B * B - 4 * A * c0; if (disc >= 0) { const tt = (-B - Math.sqrt(disc)) / (2 * A); if (tt >= 0 && tt <= 1) { const y = a.y + dy * tt; if (y > s.bot - CAMPAD && y < s.top + CAMPAD) t = tt; } } }
      for (const yy of [s.top + CAMPAD, s.bot - CAMPAD]) { if (Math.abs(dy) < 1e-9) continue; const tt = (yy - a.y) / dy; if (tt < 0 || tt > 1 || tt >= t) continue; const x = a.x + dx * tt - s.x, z = a.z + dz * tt - s.z; if (x * x + z * z < Rr * Rr) t = tt; }
      if (t > 1) continue;
    }
    if (t < best) best = t;
  }
  return best;
}

/* ---------- air: lifts, wind, turbulence ---------- */
const plantLifts = [];
let cloudX = -60;
const cloudShade = (x, z) => Math.hypot(x - cloudX, z - (-18)) < 15;
function rebuildPlantLifts() {
  plantLifts.length = 0;
  for (const p of patches) {
    const pl = p.plant; if (!pl || pl.grow < 1) continue;
    if (pl.type === 'fern') plantLifts.push({ x: p.x, z: p.z, r: 2.6, y0: p.y, y1: p.y + TUNE.fern, L: 18, kind: 'fern', on: true });
    else if (pl.type === 'sunpod') { const sun = !cloudShade(p.x, p.z); pl.sun = sun; plantLifts.push({ x: p.x, z: p.z, r: 2.4, y0: p.y, y1: p.y + TUNE.sunpod, L: 21, kind: 'sun', on: sun }); }
    else if (pl.type === 'windbell') { const w = windHere(p.x, p.y + 1.5, p.z, true); pl.wind = !!w; plantLifts.push({ x: p.x, z: p.z, r: 2.6, y0: p.y, y1: p.y + 25, L: 20, kind: 'bell', on: !!w }); }
  }
}
function liftAt(x, y, z) {
  let L = 0;
  for (const arr of [lifts, plantLifts]) for (const l of arr) {
    if (!l.on) continue; const d = Math.hypot(x - l.x, z - l.z); if (d > l.r || y < l.y0 - .5 || y > l.y1 + 1.5) continue;
    L += l.L * clamp((l.y1 + 1 - y) / 4, 0, 1) * (1 - Math.pow(d / l.r, 3) * .4);
  }
  return L;
}
function liftCentre(x, y, z) {
  for (const arr of [plantLifts, lifts]) for (const l of arr) if (l.on && Math.hypot(x - l.x, z - l.z) < l.r && y > l.y0 - .5 && y < l.y1 + 1.5) return l;
  return null;
}
function windHere(x, y, z, raw) {
  for (const w of winds) if (w.active && x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1 && z >= w.z0 && z <= w.z1) {
    if (!raw) for (const p of patches) if (p.plant && p.plant.type === 'windbell' && p.plant.grow >= 1 && Math.hypot(p.x - x, p.z - z) < 4) return null;
    return w;
  }
  return null;
}
const turbAt = (x, y, z) => turbs.find(t => Math.hypot(x - t.x, z - t.z) < t.R && y > t.y0 && y < t.y1);
const downAt = (x, y, z) => downs.find(d => Math.hypot(x - d.x, z - d.z) < d.r && y > d.y0 && y < d.y1);
const brambleNear = (x, z, r = 10) => patches.some(p => p.plant && p.plant.type === 'bramble' && p.plant.grow >= 1 && Math.hypot(p.x - x, p.z - z) < r);
const inWater = (x, y, z) => y < .4 && waters.some(w => !w.fall && Math.hypot(x - w.x, z - w.z) < w.r);

/* ---------- particles ---------- */
const parts = []; const PB = new PBatch(6000);
function burst(x, y, z, n, col, spd, life, size, grav = 0, up = 0) {
  for (let i = 0; i < n; i++) { if (parts.length > 900) parts.shift(); const a = rf(0, 6.28), e = rf(-1, 1); parts.push({ x, y, z, vx: Math.cos(a) * Math.sqrt(1 - e * e) * spd * rf(.3, 1), vy: e * spd * rf(.3, 1) + up, vz: Math.sin(a) * Math.sqrt(1 - e * e) * spd * rf(.3, 1), life, max: life, col, size, grav }); }
}

/* ---------- planting ---------- */
let radial = { open: false, holdT: 0, sel: 0, patch: null, ax: 0, ay: 0 };
function nearPatch() { if (P.state !== 'ground') return null; let b = null, bd = 2.6; for (const p of patches) { const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z); if (d < bd && Math.abs(P.pos.y - p.y) < 1.2) { bd = d; b = p; } } return b; }
function plantOn(patch, type) {
  if (!unlocked.has(type)) { Audio.close(); toast('Not unlocked yet', 'You will find this plant higher up'); return; }
  if (patch.plant && patch.plant.type === type) return;
  if (!patch.plant) { if (P.pods <= 0) { Audio.close(); toast('No seed pods', 'Burst seed heads give you pods'); return; } P.pods--; }
  if (patch.plant && patch.plant.solid) { gridRemove(patch.plant.solid); }
  patch.plant = { type, grow: 0, t: 0, cd: 0, sq: 0 };
  if (type === 'puffcap') { const s = { type: 'cyl', x: patch.x, z: patch.z, r: 1.3, bot: patch.y, top: patch.y + 1.45, surf: 'cap', cap: patch.plant, id: uid++ }; patch.plant.solid = s; patch.plant.y = patch.y; patch.plant.x = patch.x; patch.plant.z = patch.z; }
  lastPlant = type; Audio.plant(); burst(patch.x, patch.y + .5, patch.z, 24, [.6, .9, .4, 1], 4, .8, .35, -4, 2);
}
function clearPlants() { for (const p of patches) { if (p.plant && p.plant.solid && p.plant.grow >= 1) gridRemove(p.plant.solid); p.plant = null; } }

/* ---------- enemies ---------- */
const SW = { c: new V3(-3.5, 56, -21), r: 4.5, th: 0, period: 11, state: 'loop', t: 0, cd: 0, pos: new V3(), dir: new V3(1, 0, 0), members: [] };
for (let i = 0; i < 4; i++) SW.members.push({ off: new V3(rf(-1, 1), rf(-.7, .7), rf(-1, 1)), pos: new V3(-3.5, 56, -21), prev: new V3(-3.5, 56, -21), vel: new V3(), ph: i * 1.7 });
const DF = { wps: [new V3(4, 100, -6), new V3(10, 98, -14), new V3(2, 104, 2), new V3(-4, 106, -4), new V3(6, 112, -12)], i: 0, state: 'pause', t: 1, pos: new V3(4, 100, -6), prev: new V3(4, 100, -6), from: new V3(), to: new V3(), yaw: 0 };
const K = { pos: new V3(14, 158, -22), prev: new V3(14, 158, -22), state: 'circle', t: 0, ang: 0, seq: 0, miss: 0, cd: 5, dir: new V3(), dist: 0, dropped: false, yaw: 0, pitch: 0, flap: 0 };
let featherItem = null;
const kestrelZone = () => P.pos.y > 86 && mode === 'play' && P.state !== 'caught';

/* ---------- camera ---------- */
const cam = { yaw: 0, pitch: .32, dist: 8, pos: new V3(0, 4, 66), look: new V3(), manualT: 9, pitchManualT: 9, recenterT: 0, shake: 0, cut: null, fov: 1.05 };
const RP = new V3(); let RYaw = 0;

/* ---------- HUD / UI helpers ---------- */
let toastT = 0, bannerT = 0, cardT = 0, flashT = 0, irisCb = null;
function toast(big, small) { $('toast').innerHTML = '<b>' + big + '</b>' + (small ? '<span>' + small + '</span>' : ''); $('toast').classList.add('on'); toastT = 2.4; }
function banner(big, small) { $('banner').innerHTML = '<b>' + big + '</b>' + (small ? '<span>' + small + '</span>' : ''); $('banner').classList.add('on'); bannerT = 2.6; }
function card(big, small) { $('card').innerHTML = '<span>' + (small || '') + '</span><b>' + big + '</b>'; $('card').classList.remove('on'); void $('card').offsetWidth; $('card').classList.add('on'); cardT = 3.2; }
function iris(out, cb) { const el = $('iris'); el.classList.toggle('closed', out); irisCb = cb || null; if (cb) setTimeout(() => { const f = irisCb; irisCb = null; f && f(); }, 520); }

/* text boxes, typed out letter by letter */
const TB = { lines: [], i: 0, shown: 0, done: null, title: '' };
function say(lines, title, done) {
  TB.lines = lines; TB.i = 0; TB.shown = 0; TB.done = done || null; TB.title = title || '';
  $('tbTitle').textContent = TB.title; $('tbTitle').hidden = !TB.title;
  $('textbox').hidden = false; mode = 'talk'; IN.jumpP = 0; IN.plantP = 0;
}
function advanceText() {
  const line = TB.lines[TB.i];
  if (TB.shown < line.length) { TB.shown = line.length; return; }
  TB.i++; TB.shown = 0; Audio.select();
  if (TB.i >= TB.lines.length) { $('textbox').hidden = true; mode = 'play'; const d = TB.done; TB.done = null; d && d(); }
}

/* ---------- game events ---------- */
function hurt(n, kx = 0, ky = 0, kz = 0) {
  if (P.inv > 0 || mode !== 'play' || P.state === 'goal') return;
  P.tufts -= n; P.inv = 1.6; STATS.hits++; Audio.hurt(); flashT = .3; cam.shake = .5;
  if (P.state === 'hang' || P.state === 'web') { P.state = 'air'; P.web = null; P.regrab = .5; }
  P.vel.x += kx; P.vel.y += ky; P.vel.z += kz; if (P.state === 'ground' && ky > 0) P.state = 'air';
  const wasOpen = P.open; P.open = false; P.dive = false; P.flareT = 0; if (P.state === 'air' && (wasOpen || P.vel.y > -6)) P.reopenT = .65;   // tumble, then the seed catches air again
  burst(P.pos.x, P.pos.y + .6, P.pos.z, 14, [1, 1, 1, 1], 5, .7, .4, -6);
  if (P.tufts <= 0) { P.tufts = 0; loseAll(); }
}
function loseAll() {
  mode = 'dying'; Audio.fall();
  setTimeout(() => iris(true, () => { respawnCP(); iris(false); mode = 'play'; }), 500);
}
function respawnCP() {
  const c = checkpointCP || { x: START.x, y: START.y, z: START.z };
  P.pos.set(c.x, c.y, c.z + (checkpointCP ? 1.5 : 0)); P.prev.copy(P.pos); P.vel.set(0, 0, 0);
  P.state = 'ground'; P.open = false; P.dive = false; P.flareT = 0; P.web = null; P.hang = null; P.tufts = P.maxTufts; P.pods = cpPods; P.inv = 2; P.noLift = 0; P.sporeT = 0; P.spin = 0;
  clearPlants();
  SW.state = 'return'; K.state = 'climb'; K.seq = 0; K.miss = 0; K.cd = 5;
  cam.yaw = wrapA(P.yaw + Math.PI); snapCam();
}
function activateCP(c) {
  if (checkpointCP === c) return;
  cps.forEach(o => { if (o !== c) o.on = o.on; });
  c.on = true; checkpointCP = c; cpPods = P.pods; Audio.checkpoint(); toast('Checkpoint', c.name);
  burst(c.x, c.y + 2, c.z, 30, [1, .9, .3, 1], 5, 1, .4, -3, 2);
  if (c.name === 'The Wasp Chimney') unlockPlant('sunpod');
  if (c.name === 'The Canopy') { unlockPlant('windbell'); unlockPlant('bramble'); }
}
function unlockPlant(id) { if (unlocked.has(id)) return; unlocked.add(id); Audio.unlock(); const p = PLANTS.find(q => q.id === id); setTimeout(() => toast('New plant: ' + p.name, p.note), 400); }
function doPulse() {
  if (P.pulseCd > 0 || P.state === 'caught') return;
  P.pulseCd = 6; P.pulseT = .5; Audio.pulse();
  burst(P.pos.x, P.pos.y + .6, P.pos.z, 40, [.9, .95, 1, .9], 12, .45, .5);
  const c = new V3(P.pos.x, P.pos.y + .6, P.pos.z);
  if (SW.members.some(m => m.pos.dist(c) < 8)) { SW.state = 'scatter'; SW.t = 3; }
  if (DF.pos.dist(c) < 8) { DF.state = 'pause'; DF.t = 2.2; DF.to.copy(DF.pos).addS(new V3(DF.pos.x - c.x, 2, DF.pos.z - c.z).norm(), 6); DF.stun = 2; }
  puffballs.forEach(b => { if (!b.gone && Math.hypot(b.x - c.x, b.y + b.r - c.y, b.z - c.z) < 8) popPuffball(b, false); });
  if (P.state === 'web') { P.struggle += .5; }
}
function popPuffball(b, onPlayer) {
  b.gone = 8; Audio.burst(); burst(b.x, b.y + b.r, b.z, 60, [.75, .85, .45, .8], 5, 2.2, .9, -.5, 1);
  if (onPlayer) { P.noLift = 3; P.sporeT = 3; P.open = false; }
}
function collectGolden(g) {
  g.taken = true; STATS.golden++; P.goldenT = 1.8; Audio.golden();
  banner('Golden seed!', g.name + ' · ' + STATS.golden + ' of ' + goldens.length + ' in this demo');
  burst(g.x, g.y + 1, g.z, 50, [1, .85, .2, 1], 7, 1.2, .5, -2, 2);
}
function finale() {
  P.state = 'goal'; mode = 'finale'; P.vel.set(0, 0, 0); Audio.clear();
  cam.cut = { t: 0, kind: 'finale' };
  setTimeout(showClear, 4200);
}

/* ---------- player update ---------- */
function updatePlayer(h) {
  const p = P;
  p.inv -= h; p.regrab -= h; p.noLift -= h; p.sporeT -= h; p.launchT -= h; p.pulseCd -= h; p.pulseT -= h; p.sticky -= h; p.jumpBuf -= h; p.coyote -= h; p.stun -= h; p.goldenT -= h;
  if (IN.jumpP) { IN.jumpP = 0; p.jumpBuf = .14; }
  const closeP = IN.closeP > 0; IN.closeP = 0;
  if (IN.pulseP) { IN.pulseP = 0; doPulse(); }
  const mv = moveVec();
  if (p.goldenT > 0) { p.vel.set(0, Math.max(p.vel.y, 0) * .9, 0); return; }
  if (p.state === 'goal') return;
  if (p.state === 'caught') {
    p.caughtT -= h;
    if (p.caughtT <= 0) { const pc = p.caughtBy; p.state = 'air'; p.pos.set(pc.x, pc.my + 1.6, pc.z + .5); p.vel.set(rf(-2, 2), 14, 6); p.inv = 1.6; Audio.boing(); burst(p.pos.x, p.pos.y, p.pos.z, 20, [.6, .9, .4, 1], 6, .8, .4, -6); }
    return;
  }
  if (p.state === 'web') {
    const w = p.web; p.vel.set(0, 0, 0); p.struggle = Math.max(0, p.struggle - .12 * h);
    if (p.jumpBuf > 0) { p.jumpBuf = 0; p.struggle += .16; Audio.struggle(); cam.shake = .1; }
    // the spider crawls in from the web's top edge
    w.spT += h; const tx = Math.cos(w.yaw), tz = -Math.sin(w.yaw);
    const sx = w.x + tx * (w.w / 2 - .5), sy = w.y + w.h / 2 - .4, sz = w.z + tz * (w.w / 2 - .5);
    const k = clamp(w.spT * 1.1 / Math.max(.1, Math.hypot(sx - p.pos.x, sy - p.pos.y - .6, sz - p.pos.z)), 0, 1);
    w.spPos = [lerp(sx, p.pos.x, k), lerp(sy, p.pos.y + .6, k), lerp(sz, p.pos.z, k)];
    if (p.struggle >= 1) { p.state = 'air'; p.web = null; w.broken = 8; p.vel.set(Math.sin(w.yaw) * 3, 3, Math.cos(w.yaw) * 3); p.inv = .5; Audio.tear(); burst(p.pos.x, p.pos.y + .6, p.pos.z, 24, [1, 1, 1, .9], 4, .8, .3, -3); }
    else if (k >= 1) { w.broken = 8; p.state = 'air'; p.web = null; hurt(1, Math.sin(w.yaw) * 5, 4, Math.cos(w.yaw) * 5); }
    return;
  }
  if (p.state === 'hang') {
    const hg = p.hang;
    if (p.climbT > 0) {
      p.climbT -= h; const t = 1 - clamp(p.climbT / .26, 0, 1);
      p.pos.x = lerp(hg.px, hg.ex - hg.nx * .55, t); p.pos.z = lerp(hg.pz, hg.ez - hg.nz * .55, t); p.pos.y = lerp(hg.top - 1.02, hg.top, Math.min(1, t * 1.6));
      if (p.climbT <= 0) { p.state = 'ground'; p.ground = hg.s; p.pos.y = hg.top; }
      return;
    }
    if (p.jumpBuf > 0) { p.jumpBuf = 0; p.climbT = .26; hg.px = p.pos.x; hg.pz = p.pos.z; Audio.climb(); return; }
    const away = mv.x * hg.nx + mv.z * hg.nz;
    if (closeP || away > .6) { p.state = 'air'; p.open = false; p.vel.set(hg.nx * 2, 0, hg.nz * 2); p.regrab = .4; return; }
    return;
  }

  const wnd = windHere(p.pos.x, p.pos.y + .5, p.pos.z), wx = wnd ? wnd.dx * wnd.speed : 0, wz = wnd ? wnd.dz * wnd.speed : 0;
  if (p.state === 'ground') {
    const sticky = p.sticky > 0 || (p.ground && p.ground.surf === 'sundew');
    if (p.ground && p.ground.surf === 'sundew') { if (p.sticky <= 0) Audio.squelch(); p.sticky = .5; }
    const water = inWater(p.pos.x, p.pos.y, p.pos.z);
    const spd = sticky ? .9 : water ? 3.8 : TUNE.run;
    const gw = wnd && wnd.ground ? .45 : 0, tx = mv.x * spd + wx * gw, tz = mv.z * spd + wz * gw;
    const acc = (mv.m > .05 ? 40 : 28) * h, dx = tx - p.vel.x, dz = tz - p.vel.z, dl = Math.hypot(dx, dz);
    if (dl <= acc) { p.vel.x = tx; p.vel.z = tz; } else { p.vel.x += dx / dl * acc; p.vel.z += dz / dl * acc; }
    if (mv.m > .05) p.yaw = turnToward(p.yaw, Math.atan2(mv.x, mv.z), 14 * h);
    p.vel.y = 0;
    const sp = Math.hypot(p.vel.x, p.vel.z); p.anim += sp * h * 1.6; p.stepD += sp * h;
    if (p.stepD > 1.7) { p.stepD = 0; Audio.step(); if (water) burst(p.pos.x, .2, p.pos.z, 5, [.8, .9, 1, .8], 2, .4, .25, -8, 2); }
    if (p.jumpBuf > 0) {
      p.jumpBuf = 0; p.vel.y = sticky ? 5 : TUNE.jump; p.state = 'air'; p.open = false; p.jumpT = 0; p.jumpHeld = true; p.ground = null;
      if (sticky) Audio.squelch(); else Audio.jump();
    }
  } else {
    p.jumpT += h;
    const diveIn = IN.dive;
    if (p.reopenT > 0) { p.reopenT -= h; p.spin = Math.max(p.spin, 4); if (p.reopenT <= 0 && !p.dive && !turbAt(p.pos.x, p.pos.y + .6, p.pos.z)) { p.open = true; Audio.open(); } }
    if (p.coyote > 0 && p.jumpBuf > 0 && p.vel.y <= 0) { p.jumpBuf = 0; p.coyote = 0; p.vel.y = TUNE.jump; p.jumpT = 0; p.jumpHeld = true; Audio.jump(); }
    if (closeP && p.open) { p.open = false; Audio.close(); }
    if (p.jumpBuf > 0 && !p.open && !diveIn && p.flareT <= 0 && p.jumpT > .06) { p.jumpBuf = 0; p.open = true; p.jumpHeld = false; Audio.open(); burst(p.pos.x, p.pos.y + 2, p.pos.z, 10, [1, 1, 1, .8], 2, .6, .3); }
    if (!IN.jump && p.jumpHeld && p.vel.y > 0 && !p.open && p.launchT <= 0) { p.vel.y *= .5; p.jumpHeld = false; }
    if (diveIn && !p.dive && p.flareT <= 0) { p.dive = true; p.diveT = 0; p.open = false; Audio.dive(); }
    if (!diveIn && p.dive) {
      p.dive = false;
      if (p.diveT > .22) { p.flareT = 1; p.flareP = clamp(p.vel.len() / TUNE.diveSpeed, .35, 1); Audio.flare(); burst(p.pos.x, p.pos.y + .6, p.pos.z, 16, [1, 1, 1, .8], 3, .5, .3); }
      else { p.open = true; Audio.open(); }
    }
    const tb = p.dive ? null : turbAt(p.pos.x, p.pos.y + .6, p.pos.z);
    if (tb) {
      if (p.open) { p.open = false; Audio.close(); }
      p.turbT -= h;
      if (p.turbT <= 0) { p.turbT = .22; const ox = p.pos.x - tb.x, oz = p.pos.z - tb.z, ol = Math.hypot(ox, oz) || 1; p.vel.x += ox / ol * 5 + rf(-1, 1) * 5; p.vel.y += rf(-.4, .9) * 6; p.vel.z += oz / ol * 5 + rf(-1, 1) * 5; p.spin = rf(-1, 1) * 10; cam.shake = Math.max(cam.shake, .15); }   // churning air throws you outward
    }
    p.yaw += p.spin * h; p.spin *= Math.exp(-2.2 * h);
    const L = p.noLift > 0 ? 0 : liftAt(p.pos.x, p.pos.y + .5, p.pos.z);
    p.inLift = L > 1 ? Math.min(1, p.inLift + h * 2) : Math.max(0, p.inLift - h * 1.5);
    const dn = downAt(p.pos.x, p.pos.y, p.pos.z);
    if (p.dive) {
      p.diveT += h;
      if (mv.m > .1) p.yaw = turnToward(p.yaw, Math.atan2(mv.x, mv.z), 1.7 * h);
      const ca = Math.cos(.55), sa = Math.sin(.55), S = TUNE.diveSpeed, k = Math.min(1, 2.6 * h);
      p.vel.x += (Math.sin(p.yaw) * ca * S - p.vel.x) * k; p.vel.y += (-sa * S - p.vel.y) * k; p.vel.z += (Math.cos(p.yaw) * ca * S - p.vel.z) * k;
    } else if (p.flareT > 0) {
      p.flareT -= h; const t = 1 - clamp(p.flareT, 0, 1);
      p.vel.y = lerp(9, 3, t) * p.flareP;
      if (mv.m > .1) p.yaw = turnToward(p.yaw, Math.atan2(mv.x, mv.z), 2 * h);
      const k = Math.min(1, 1.5 * h); p.vel.x += (Math.sin(p.yaw) * TUNE.airSpeed - p.vel.x) * k; p.vel.z += (Math.cos(p.yaw) * TUNE.airSpeed - p.vel.z) * k;
      if (p.flareT <= 0) { p.open = true; }
    } else if (p.open) {
      if (mv.m > .1) p.yaw = turnToward(p.yaw, Math.atan2(mv.x, mv.z), 2.4 * mv.m * h);
      const spT = (mv.m > .2 ? TUNE.airSpeed * Math.min(1, mv.m * 1.2) : .7) * (L > 1 ? .6 : 1), k = Math.min(1, 2.2 * h);
      let cx = 0, cz = 0;
      if (L > 1) { const lc = liftCentre(p.pos.x, p.pos.y + .5, p.pos.z), f = mv.m < .5 ? 1.4 : .7; if (lc) { cx = (lc.x - p.pos.x) * f; cz = (lc.z - p.pos.z) * f; } }   // slower and gently centred inside a column, so updrafts are easy to ride
      if (p.launchT <= 0) { p.vel.x += (Math.sin(p.yaw) * spT + wx + cx - p.vel.x) * k; p.vel.z += (Math.cos(p.yaw) * spT + wz + cz - p.vel.z) * k; }
      if (p.launchT > 0) p.vel.y -= TUNE.grav * h;
      else { const sink = TUNE.sink + (dn ? 3 : 0); p.vel.y += (-sink - p.vel.y) * Math.min(1, 3 * h); }
      p.vel.y += L * h;
    } else {
      p.vel.y -= TUNE.grav * h;
      const tx = mv.x * 6 + wx * .6, tz = mv.z * 6 + wz * .6, acc = 11 * h, dx = tx - p.vel.x, dz = tz - p.vel.z, dl = Math.hypot(dx, dz);
      if (dl <= acc) { p.vel.x = tx; p.vel.z = tz; } else { p.vel.x += dx / dl * acc; p.vel.z += dz / dl * acc; }
      if (mv.m > .05 && p.spin === 0 || mv.m > .05 && Math.abs(p.spin) < 1) p.yaw = turnToward(p.yaw, Math.atan2(mv.x, mv.z), 8 * h);
      p.vel.y += L * .25 * h; if (dn) p.vel.y -= 4 * h;
    }
    p.vel.y = Math.max(p.vel.y, -26);
  }

  // pitcher plants pull floaters in
  for (const pc of pitchers) {
    const dx = pc.x - p.pos.x, dy = pc.my - (p.pos.y + .5), dz = pc.z - p.pos.z, d = Math.hypot(dx, dy, dz);
    if (d < pc.r && p.inv <= 0) {
      const f = 7 * (1 - d / pc.r * .5) * h; p.vel.x += dx / d * f; p.vel.y += dy / d * f; p.vel.z += dz / d * f;
      if (d < 1.15) { p.state = 'caught'; p.caughtT = .9; p.caughtBy = pc; pc.caught = .9; p.open = false; p.dive = false; Audio.squelch(); hurt(1); if (mode === 'play' && P.tufts > 0) { p.state = 'caught'; p.inv = 1.6; } return; }
    }
  }

  // integrate + collide
  const prevY = p.pos.y, grounded = p.state === 'ground';
  p.pos.x += p.vel.x * h; p.pos.z += p.vel.z * h;
  const wall = pushOut(p.pos, p.vel, grounded ? .46 : .22);
  p.pos.y += p.vel.y * h;
  if (p.vel.y > 0) { const c = ceilingAbove(p.pos.x, p.pos.z, p.pos.y + PH, prevY + PH); if (c) { p.pos.y = c.bot - PH; p.vel.y = 0; p.launchT = 0; } }
  if (grounded) {
    const g = groundUnder(p.pos.x, p.pos.z, p.pos.y + .46);
    if (g && g.top >= p.pos.y - .55) { p.pos.y = g.top; p.ground = g.s; }
    else { p.state = 'air'; p.coyote = .12; p.open = false; p.jumpT = 1; p.ground = null; }
  } else if (p.vel.y <= 0) {
    const g = groundUnder(p.pos.x, p.pos.z, prevY + .05);
    if (g && p.pos.y <= g.top) land(g, -p.vel.y);
  }
  if (p.state === 'ground' && p.ground && p.ground.surf === 'cap') capBurst(p.ground.cap, true);

  // webs: tuck dive tears through, anything else sticks
  for (const w of webs) {
    if (w.broken > 0) continue;
    const nx = Math.sin(w.yaw), nz = Math.cos(w.yaw), tx = Math.cos(w.yaw), tz = -Math.sin(w.yaw);
    const dx = p.pos.x - w.x, dy = p.pos.y + .6 - w.y, dz = p.pos.z - w.z;
    const dn = dx * nx + dz * nz, dt = dx * tx + dz * tz;
    if (Math.abs(dn) < .45 && Math.abs(dt) < w.w / 2 && Math.abs(dy) < w.h / 2 && (dt * dt) / (w.w * w.w / 4) + (dy * dy) / (w.h * w.h / 4) < 1) {
      if (p.dive) { w.broken = 10; Audio.tear(); burst(w.x, w.y, w.z, 30, [1, 1, 1, .9], 5, 1, .3, -3); }
      else if (p.state !== 'ground') { p.state = 'web'; p.web = w; w.spT = 0; p.struggle = 0; p.open = false; p.vel.set(0, 0, 0); Audio.web(); }
    }
  }
  // ledge grab (seed closed only)
  if (p.state === 'air' && !p.open && !p.dive && p.flareT <= 0 && p.vel.y < .5 && p.regrab <= 0) tryGrab(mv);
  if (p.pos.y < -8) { p.pos.set(checkpointCP ? checkpointCP.x : START.x, (checkpointCP ? checkpointCP.y : 0) + 1, checkpointCP ? checkpointCP.z : START.z); p.vel.set(0, 0, 0); snapCam(); }
}
function land(g, impact) {
  const p = P; p.reopenT = 0;
  p.pos.y = g.top; p.state = 'ground'; p.ground = g.s; p.vel.y = 0; p.flareT = 0; p.launchT = 0;
  if (p.open || p.dive) { p.open = false; p.dive = false; }
  if (impact > 5) { Audio.land(); p.landSq = .18; burst(p.pos.x, p.pos.y + .1, p.pos.z, Math.min(16, impact | 0), [.85, .78, .6, .8], 2.5, .45, .35, -4, 1); }
  if (g.s.surf === 'sundew') { Audio.squelch(); p.sticky = .6; }
}
function tryGrab(mv) {
  const p = P, hand = p.pos.y + 1.0;
  for (const s of candidates(p.pos.x - 1.5, p.pos.z - 1.5, p.pos.x + 1.5, p.pos.z + 1.5)) {
    if (s.inv || s.isFloor || s.surf === 'cap' || s.surf === 'wood' || s.surf === 'plant' || s.surf === 'leaf') continue;
    if (s.top < hand - .4 || s.top > hand + .3) continue;
    let ex, ez, nx, nz, d;
    if (s.type === 'cyl') { if (s.r < 1) continue; const dx = p.pos.x - s.x, dz = p.pos.z - s.z, d0 = Math.hypot(dx, dz); d = d0 - s.r; if (d <= 0) continue; nx = dx / d0; nz = dz / d0; ex = s.x + nx * s.r; ez = s.z + nz * s.r; }
    else {
      const [lx, lz] = local(s, p.pos.x, p.pos.z), qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz), dx = lx - qx, dz = lz - qz; d = Math.hypot(dx, dz);
      if (d <= 1e-4) continue; const nlx = dx / d, nlz = dz / d;
      nx = nlx * s.c + nlz * s.s; nz = -nlx * s.s + nlz * s.c; ex = s.x + qx * s.c + qz * s.s; ez = s.z - qx * s.s + qz * s.c;
    }
    if (d > PR + .32) continue;
    if (mv.m > .3 && (mv.x * nx + mv.z * nz) > .3) continue;   // steering away: don't grab
    const above = groundUnder(ex - nx * .5, ez - nz * .5, s.top + 1.7, -.05); if (above && above.top > s.top + .05) continue;
    p.state = 'hang'; p.hang = { nx, nz, ex, ez, top: s.top, s }; p.climbT = 0;
    p.pos.set(ex + nx * (PR + .02), s.top - 1.02, ez + nz * (PR + .02)); p.vel.set(0, 0, 0); p.yaw = Math.atan2(-nx, -nz); Audio.grab();
    return;
  }
}
function capBurst(cap, onTop) {
  if (!cap || cap.cd > 0) return;
  if (cap.grow !== undefined && cap.grow < 1) return;
  cap.cd = 4; cap.sq = .35; const p = P;
  p.state = 'air'; p.ground = null; p.vel.y = 21; p.vel.x += Math.sin(p.yaw) * 4; p.vel.z += Math.cos(p.yaw) * 4; p.launchT = .75; p.jumpHeld = false; p.jumpT = .2;
  Audio.boing(); burst(cap.x, (cap.y || 0) + 1.4, cap.z, 26, [.85, .75, 1, .9], 6, .7, .4, -4, 2);
}
function checkCapsAir() {
  if (P.state !== 'air' || P.vel.y > 0) return;
  const caps = natCaps.concat(patches.filter(p => p.plant && p.plant.type === 'puffcap' && p.plant.grow >= 1).map(p => p.plant));
  for (const c of caps) { const top = (c.y || 0) + 1.45, dy = P.pos.y - top; if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 1.6 && dy >= 0 && dy < 3) capBurst(c, false); }
}

/* ---------- world update ---------- */
function updateWorld(h) {
  worldT += h;
  cloudX += 6.15 * h; if (cloudX > 60) cloudX = -60;
  for (const w of winds) {
    if (w.steady) { w.active = true; w.tele = false; continue; }
    const t = (worldT + w.ph) % w.period, was = w.active;
    w.active = t < w.onT; w.tele = t > w.period - .85;
    if (w.active && !was && Math.hypot(P.pos.x - (w.x0 + w.x1) / 2, P.pos.y - (w.y0 + w.y1) / 2) < 30) Audio.gust();
  }
  for (const p of patches) {
    const pl = p.plant; if (!pl) continue;
    if (pl.grow < 1) { pl.grow = Math.min(1, pl.grow + h / 2); if (pl.grow >= 1) { Audio.grow(); if (pl.solid) gridAdd(pl.solid); } }
    pl.t += h; pl.cd -= h; pl.sq -= h;
  }
  natCaps.forEach(c => { c.cd -= h; c.sq -= h; });
  rebuildPlantLifts();
  SHORTCUT.on = STATS.letters >= letters.length;
  for (const hd of heads) if (!hd.ready) { hd.t -= h; if (hd.t <= 0) hd.ready = true; }
  for (const b of puffballs) { b.t += h; if (b.gone > 0) b.gone -= h; }
  for (const w of webs) if (w.broken > 0) w.broken -= h;
  for (const pc of pitchers) pc.caught -= h;
}
function updateWasps(h) {
  const S = SW; S.th += h * Math.PI * 2 / S.period; S.cd -= h;
  S.pos.set(S.c.x + Math.sin(S.th) * S.r, S.c.y + Math.cos(S.th) * S.r, S.c.z); S.dir.set(Math.cos(S.th), -Math.sin(S.th), 0);
  const pc = new V3(P.pos.x, P.pos.y + .6, P.pos.z);
  const canChase = mode === 'play' && P.state !== 'caught' && !brambleNear(S.c.x, S.c.z) && !brambleNear(P.pos.x, P.pos.z);
  if (S.state === 'loop' && canChase && S.cd <= 0) {
    const to = pc.clone().sub(S.pos), d = to.len();
    if (d < 8 && to.dot(S.dir) / d > Math.cos(.87)) { S.state = 'chase'; S.t = 5; }
  }
  if (S.state === 'chase') { S.t -= h; if (S.t <= 0 || pc.dist(S.c) > 24 || !canChase) { S.state = 'return'; S.cd = 1.5; } }
  if (S.state === 'scatter') { S.t -= h; if (S.t <= 0) { S.state = 'return'; S.cd = 2; } }
  let back = 0;
  for (const m of S.members) {
    let tgt, spd;
    m.ph += h * 3;
    if (S.state === 'chase') { tgt = pc.clone().addS(m.off, .5); spd = 7; }
    else if (S.state === 'scatter') { tgt = m.pos.clone().add(m.pos.clone().sub(pc).norm().scale(4)); spd = 9; }
    else { tgt = S.pos.clone().add(new V3(m.off.x + Math.sin(m.ph) * .3, m.off.y + Math.cos(m.ph * 1.3) * .3, m.off.z)); spd = S.state === 'return' ? 8 : 14; }
    const d = tgt.clone().sub(m.pos), dl = d.len();
    if (dl > .01) { const st = Math.min(dl, spd * h); m.vel.copy(d).scale(st / dl / h); m.pos.addS(d, st / dl); }
    if (S.state === 'return' && dl < 1) back++;
    if (S.state === 'chase' && m.pos.dist(pc) < .85) { const k = pc.clone().sub(m.pos).norm(); hurt(1, k.x * 7, 4, k.z * 7); S.state = 'return'; S.cd = 2.5; }
  }
  if (S.state === 'return' && back >= 3) S.state = 'loop';
}
function updateDragon(h) {
  const D = DF; D.t -= h;
  if (D.state === 'pause') { D.to.copy(D.pos); if (D.t <= 0) { D.state = 'flash'; D.t = .45; } }
  else if (D.state === 'flash') {
    if (D.t <= 0) {
      D.state = 'dart'; D.t = .42; D.from.copy(D.pos);
      const pc = new V3(P.pos.x, P.pos.y + .6, P.pos.z);
      if (mode === 'play' && pc.dist(D.pos) < 12 && P.pos.y > 86 && !brambleNear(P.pos.x, P.pos.z)) D.to.copy(pc).addS(P.vel, .35);
      else { D.i = (D.i + 1) % D.wps.length; D.to.copy(D.wps[D.i]); }
      D.yaw = Math.atan2(D.to.x - D.from.x, D.to.z - D.from.z);
    }
  } else if (D.state === 'dart') {
    D.pos.lerpV(D.from, D.to, 1 - clamp(D.t / .42, 0, 1));
    if (D.pos.dist(new V3(P.pos.x, P.pos.y + .6, P.pos.z)) < 1.1) { const k = new V3(P.pos.x - D.pos.x, 0, P.pos.z - D.pos.z).norm(); hurt(1, k.x * 7, 5, k.z * 7); }
    if (D.t <= 0) { D.state = 'pause'; D.t = 1.0; }
  }
}
function updateKestrel(h) {
  const k = K; k.cd -= h; k.flap += h;
  const pc = new V3(P.pos.x, P.pos.y + .6, P.pos.z);
  const warnT = OPT.assist ? TUNE.kWarnAssist : TUNE.kWarn;
  const safe = () => sheltered(P.pos.x, P.pos.y, P.pos.z) || brambleNear(P.pos.x, P.pos.z) || P.state === 'goal';
  if (k.state === 'circle') {
    k.ang += .32 * h; const tx = 14 + Math.cos(k.ang) * 26, tz = -22 + Math.sin(k.ang) * 26;
    k.yaw = Math.atan2(tx - k.pos.x, tz - k.pos.z); k.pos.set(tx, 158 + Math.sin(k.ang * 2) * 3, tz); k.pitch = 0;
    if (kestrelZone() && k.cd <= 0 && !safe()) { k.state = 'warn'; k.t = warnT; k.seq = (k.seq || 0) + 1; Audio.cry(); }
  } else if (k.state === 'warn') {
    k.t -= h; const hov = pc.clone().add(new V3(4, 24, 8)); k.pos.lerp(hov, Math.min(1, 1.6 * h));
    k.yaw = Math.atan2(pc.x - k.pos.x, pc.z - k.pos.z); k.pitch = -.5;
    if (!kestrelZone() || safe()) { k.state = 'climb'; k.seq = 0; k.miss = 0; k.cd = 3; }
    else if (k.t <= 0) { const tgt = pc.clone().addS(P.vel, .35); k.dir.copy(tgt).sub(k.pos); k.dist = k.dir.len(); k.dir.norm(); k.state = 'stoop'; k.t = 0; Audio.swoosh(); }
  } else if (k.state === 'stoop') {
    k.t += h; k.pos.addS(k.dir, 32 * h); k.yaw = Math.atan2(k.dir.x, k.dir.z); k.pitch = Math.asin(clamp(k.dir.y, -1, 1));
    if (k.pos.dist(pc) < 1.6 && P.inv <= 0) { hurt(1, k.dir.x * 10, 3, k.dir.z * 10); k.state = 'climb'; k.seq = 0; k.miss = 0; k.cd = 9; }
    else if (k.t > k.dist / 32 + .45) {
      k.miss++; k.state = 'climb';
      if (k.miss >= 3) { if (!k.dropped) { k.dropped = true; featherItem = { x: P.pos.x + 2, y: P.pos.y + 6, z: P.pos.z + 1, t: 0 }; toast('The kestrel dropped a feather!', 'Catch it before it lands'); } k.seq = 0; k.miss = 0; k.cd = 10; }
      else k.cd = .9;
    }
  } else if (k.state === 'climb') {
    const tx = 14 + Math.cos(k.ang) * 26, tz = -22 + Math.sin(k.ang) * 26, tgt = new V3(tx, 158, tz), d = tgt.clone().sub(k.pos), dl = d.len();
    k.pos.addS(d, Math.min(1, 24 * h / Math.max(dl, .01))); k.yaw = Math.atan2(d.x, d.z); k.pitch = .3;
    if (dl < 2 || (k.cd <= 0 && k.seq > 0 && dl < 30)) { k.state = 'circle'; }
  }
}
function updateCollect(h) {
  const c = new V3(P.pos.x, P.pos.y + .55, P.pos.z);
  for (const m of motes) {
    if (m.taken || Math.abs(m.x - c.x) > 1.6 || Math.abs(m.z - c.z) > 1.6) continue;
    if (Math.hypot(m.x - c.x, m.y - c.y, m.z - c.z) < 1.35) {
      m.taken = true; STATS.pollen[m.tier - 1]++;
      pollenCombo = gameT - pollenLastT < .8 ? pollenCombo + 1 : 0; pollenLastT = gameT; Audio.pollen(pollenCombo);
      burst(m.x, m.y, m.z, 6, [1, .9, .3, 1], 2.5, .35, .25);
      const tot = STATS.pollen[0] + STATS.pollen[1] + STATS.pollen[2];
      if (tot % 100 === 0 && P.maxTufts < 5) { P.maxTufts++; P.tufts = P.maxTufts; Audio.tuft(); toast('Extra seed tuft!', tot + ' pollen motes'); }
    }
  }
  for (const hd of heads) if (hd.ready && P.pods < 3 && Math.hypot(hd.x - c.x, hd.z - c.z) < 1.6 && Math.abs(hd.y - P.pos.y) < 2.4) { hd.ready = false; hd.t = 10; P.pods++; Audio.pod(); burst(hd.x, hd.y + 1.9, hd.z, 30, [1, 1, 1, .9], 3, 1.4, .3, -.5, 1); }
  for (const g of goldens) { if (!g.seen && Math.hypot(g.x - c.x, g.y - c.y, g.z - c.z) < 22) g.seen = true; if (!g.taken && Math.hypot(g.x - c.x, g.y + .5 - c.y, g.z - c.z) < 1.8) collectGolden(g); }
  for (const l of letters) if (!l.taken && Math.hypot(l.x - c.x, l.y - c.y, l.z - c.z) < 1.6) {
    l.taken = true; STATS.letters++; Audio.letter();
    const extra = STATS.letters === letters.length ? ['All four letters together make a map. A dotted line runs from a crack near the cliff stairs straight up to the top shelf.', 'Shortcut revealed: a hidden geyser now blows just east of the stepping stairs.'] : ['Lost letters: ' + STATS.letters + ' of ' + letters.length + '.'];
    say(l.text.concat(extra), l.title);
  }
  if (featherItem) {
    const f = featherItem; f.t += h; f.y -= 1.2 * h; f.x += Math.sin(f.t * 2) * 1.2 * h;
    if (Math.hypot(f.x - c.x, f.y - c.y, f.z - c.z) < 1.8) { featherItem = null; P.feather = true; Audio.feather(); banner('Feather charm!', 'Owl-down seed skin unlocked'); }
    else if (f.y < groundY(f.x, f.z) - 1 || f.t > 30) featherItem = null;
  }
  for (const cp of cps) if (Math.hypot(cp.x - c.x, cp.z - c.z) < 2.2 && Math.abs(cp.y - P.pos.y) < 2.5) {
    activateCP(cp);
    if (cp.name === 'The Wasp Chimney' && !chimneyIntro) { chimneyIntro = true; cam.cut = { t: 0, kind: 'chimney' }; mode = 'cut'; }
  }
  for (const b of puffballs) if (!b.gone && Math.hypot(b.x - c.x, b.y + b.r - c.y, b.z - c.z) < b.r + .55) popPuffball(b, true);
}
function groundY(x, z) { const g = groundUnder(x, z, 999); return g ? g.top : 0; }

/* ---------- context prompt + E handling ---------- */
function context() {
  if (P.state === 'web') return { k: 'Space', t: 'Struggle free!' };
  if (P.state === 'hang') return { k: 'Space', t: 'Climb up · Shift drop' };
  if (P.state !== 'ground') return null;
  if (Math.hypot(P.pos.x - GOAL.x, P.pos.z - GOAL.z) < GOAL.r && P.pos.y > 139) return { k: 'E', t: 'Release your seed', act: 'goal' };
  const pt = nearPatch(); if (pt) return { k: 'E', t: pt.plant ? 'Swap plant (hold E)' : (P.pods ? 'Plant · hold E to choose' : 'Plant (no pods)'), act: 'patch', pt };
  for (const s of signs) if (Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 2.6 && Math.abs(P.pos.y - s.y) < 2) return { k: 'E', t: 'Read', act: 'sign', s };
  return null;
}
function handlePlantInput(h) {
  const ctx = context();
  if (IN.plantP) {
    IN.plantP = 0;
    if (ctx && ctx.act === 'sign') { ctx.s.seen = true; const s = ctx.s; say(s.lines, null, () => { if (s.unlock === 'sunpod') unlockPlant('sunpod'); if (s.unlock === 'canopy') { unlockPlant('windbell'); unlockPlant('bramble'); } }); return; }
    if (ctx && ctx.act === 'goal') { finale(); return; }
    if (ctx && ctx.act === 'patch') { radial.holdT = 0; radial.patch = ctx.pt; radial.ax = 0; radial.ay = 0; radial.sel = PLANTS.findIndex(q => q.id === lastPlant); radial.armed = true; }
  }
  if (radial.armed) {
    if (IN.plant) { radial.holdT += h; if (radial.holdT > .2 && !radial.open) { radial.open = true; timeScale = .2; showRadial(true); } }
    if (radial.open) {
      if (IN.num) { radial.sel = IN.num - 1; IN.num = 0; }
      const r = moveRaw(); radial.ax += IN.mdx * .02; radial.ay += IN.mdy * .02; IN.mdx = IN.mdy = 0;
      let vx = r.x + radial.ax, vy = -r.z + radial.ay; const l = Math.hypot(vx, vy);
      if (l > .5) { if (l > 1.5) { radial.ax *= .9; radial.ay *= .9; } let a = Math.atan2(vx, -vy); if (a < 0) a += 6.283; radial.sel = Math.round(a / (6.283 / 5)) % 5; }
      renderRadial();
    }
    if (!IN.plant) {
      const pt = radial.patch;
      if (radial.open) { plantOn(pt, PLANTS[radial.sel].id); showRadial(false); timeScale = 1; }
      else if (pt && nearPatch() === pt) plantOn(pt, lastPlant);
      radial.open = false; radial.armed = false; radial.patch = null;
    }
    if (P.state !== 'ground' && radial.open) { showRadial(false); timeScale = 1; radial.open = false; radial.armed = false; }
  }
}

/* ---------- tiers ---------- */
const TIERS = [null, ['Mossy Floor', 'Tier 1'], ['Sunbaked Cliff', 'Tier 2'], ['Windy Canopy', 'Tier 3']];
function updateTier() {
  const t = P.state === 'ground' || P.state === 'hang' ? tierOf(P.pos.y + .1) : tierNow;
  if (t !== tierNow) { tierNow = t; }
  if (!tiersSeen.has(tierNow) && P.state === 'ground') { tiersSeen.add(tierNow); if (tierNow > 1) card(TIERS[tierNow][0], 'Thistledown Gorge · ' + TIERS[tierNow][1]); }
}

/* ---------- fixed-step loop ---------- */
const STEP = 1 / 120;
function step(h) {
  P.prev.copy(P.pos); P.prevYaw = P.yaw;
  for (const m of SW.members) m.prev.copy(m.pos); DF.prev.copy(DF.pos); K.prev.copy(K.pos);
  if (mode === 'play') {
    const hs = h * timeScale;
    gameT += hs; STATS.t += hs;
    handlePlantInput(h);
    updatePlayer(hs);
    checkCapsAir();
    updateWorld(hs);
    updateWasps(hs); updateDragon(hs); updateKestrel(hs);
    updateCollect(hs);
    updateTier();
  } else if (mode === 'title' || mode === 'cut' || mode === 'finale' || mode === 'dying' || mode === 'talk') {
    updateWorld(h); updateWasps(h); updateDragon(h);
    if (mode === 'title') updateKestrel(h);
  }
  for (const pt of parts) { pt.life -= h; pt.vy += pt.grav * h; pt.x += pt.vx * h; pt.y += pt.vy * h; pt.z += pt.vz * h; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

