'use strict';
/* ===================== LEVEL: Thistledown Gorge ===================== */
const C = {
  sand: hex(0xd9a25e), sand2: hex(0xc98c4c), sand3: hex(0xe6b878), sandD: hex(0xa96d3c),
  moss: hex(0x5aa83a), grass: hex(0x7cc246), grassD: hex(0x3e8a2c), lip: hex(0x66b33e),
  bark: hex(0x7d5330), barkD: hex(0x59391f), leaf: hex(0x47a03a), leafL: hex(0x86d050), leafD: hex(0x2f7a2a),
  water: hex(0x4aa8dc), mud: hex(0x6b5338), stone: hex(0x9b958a), white: [1, 1, 1], ash: hex(0x5e5550), damp: hex(0x3f6a64),
  petal: hex(0xfffbf0), yellow: hex(0xf6c431), red: hex(0xd8432f), pink: hex(0xf08aa8), purple: hex(0x7a4fa0), blue: hex(0x5a8ee0),
};
const WB = new Builder();        // static opaque world
const WX = new Builder();        // static translucent world (water, webs are dynamic)
const solids = [], lifts = [], winds = [], turbs = [], downs = [], patches = [], heads = [], motes = [];
const goldens = [], letters = [], signs = [], cps = [], pitchers = [], puffballs = [], webs = [], natCaps = [], sundews = [], tufts = [], waters = [];
let uid = 0;

/* ---------- solids + painting ---------- */
function addSolid(s) { s.id = uid++; solids.push(s); return s; }
function sbox(x0, x1, y0, y1, z0, z1, style = 'rock', o = {}) {
  const s = addSolid({ type: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, c: 1, s: 0, yaw: 0, bot: y0, top: y1, surf: o.surf || style, inv: style === 'inv' });
  if (style !== 'inv') paintBox(s, style, o);
  return s;
}
function sobox(cx, cz, hx, hz, y0, y1, yaw, style, o = {}) {
  const s = addSolid({ type: 'box', x: cx, z: cz, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), yaw, bot: y0, top: y1, surf: o.surf || style });
  if (!o.noPaint) paintBox(s, style, o);
  return s;
}
function scyl(x, z, r, y0, y1, style = 'rock', o = {}) {
  const s = addSolid({ type: 'cyl', x, z, r, bot: y0, top: y1, surf: o.surf || style });
  if (!o.noPaint) paintCyl(s, style, o);
  return s;
}
function paintBox(s, style, o) {
  const h = s.top - s.bot, cy = (s.top + s.bot) / 2;
  WB.push(); WB.t(s.x, 0, s.z); WB.rY(s.yaw);
  if (style === 'rock' || style === 'cliff') {
    const bands = Math.max(1, Math.round(h / 6.5));
    for (let i = 0; i < bands; i++) {
      const b0 = s.bot + i * h / bands, b1 = s.bot + (i + 1) * h / bands;
      const c = i % 3 === 0 ? C.sand : i % 3 === 1 ? C.sand2 : C.sand3;
      WB.box(0, (b0 + b1) / 2, 0, s.hx, (b1 - b0) / 2, s.hz, { col: mulc(c, .92 + rnd() * .14), mat: MAT.rock, skipTop: i < bands - 1, skipBot: i > 0, ao: .82 });
    }
    if (!o.noLip) {
      WB.box(0, s.top + .14, 0, s.hx + .3, .3, s.hz + .3, { col: C.lip, top: C.grass, mat: MAT.moss, ao: .8 });
      if (!o.noTufts) for (let i = 0; i < Math.min(14, (s.hx * s.hz) / 6); i++) {
        const tx = rr(-s.hx + .5, s.hx - .5), tz = rr(-s.hz + .5, s.hz - .5); grassTuftLocal(tx, s.top + .4, tz, rr(.6, 1.4));
      }
    }
  } else if (style === 'wood') {
    WB.box(0, cy, 0, s.hx, h / 2, s.hz, { col: C.bark, top: hex(0x9a6a3e), mat: MAT.bark });
  } else if (style === 'step') {
    WB.box(0, cy, 0, s.hx, h / 2, s.hz, { col: C.stone, top: hex(0xb3ad9f), mat: MAT.rock });
    WB.box(0, s.top + .1, 0, s.hx + .15, .2, s.hz + .15, { col: C.lip, top: C.grass, mat: MAT.moss });
  } else if (style === 'mud') {
    WB.box(0, cy, 0, s.hx, h / 2, s.hz, { col: C.mud, top: C.moss, topMat: MAT.moss, mat: MAT.soft });
  }
  WB.pop();
}
function paintCyl(s, style, o) {
  if (style === 'rock') { WB.cyl(s.x, s.bot, s.z, s.r * 1.05, s.r * .95, s.top - s.bot, 9, { col: C.sand2, top: C.grass, mat: MAT.rock, topMat: MAT.moss, wob: .15 }); }
  else if (style === 'bark') { WB.cyl(s.x, s.bot, s.z, s.r * 1.08, s.r, s.top - s.bot, 12, { col: C.bark, top: hex(0xa47a4a), mat: MAT.bark, wob: .08 }); }
  else if (style === 'leaf') { const h = s.top - s.bot; WB.sph(s.x, (s.top + s.bot) / 2, s.z, s.r * 1.1, h * .62, s.r * 1.1, 10, 6, { col: C.leaf, top: C.leafL, bot: C.leafD, mat: MAT.leaf, wob: .25 }); }
}
/* a branch: drawn as a tapered log, collides as a flat-topped beam */
function branch(ax, az, bx, bz, top, w = 3, o = {}) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  const s = sobox((ax + bx) / 2, (az + bz) / 2, w / 2, L / 2, top - w * .9, top, yaw, 'bark', { noPaint: true, surf: 'bark' });
  const r = w * .6;
  WB.beam(ax, top - r * .92, az, bx, top - r * .92, bz, r * 1.12, r * .9, 8, { col: C.bark, mat: MAT.bark, a0: Math.PI / 8 });
  // flat walkway hint: a mossy strip along the top
  WB.push(); WB.t(s.x, 0, s.z); WB.rY(yaw); WB.box(0, top + .04, 0, w * .3, .07, L / 2 - .6, { col: C.lip, top: C.moss, mat: MAT.moss }); WB.pop();
  return s;
}

/* ---------- decoration (no collision) ---------- */
function grassTuftLocal(x, y, z, s) { for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(); WB.beam(x, y - .3, z, x + Math.cos(a) * .4 * s, y + 1.3 * s, z + Math.sin(a) * .4 * s, .18 * s, .02, 3, { col: C.grassD, top: C.grass }); } }
function blade(x, y, z, h, lean = .3, yaw = rnd() * 6.28, col = C.grass) {
  const tx = x + Math.cos(yaw) * h * lean, tz = z + Math.sin(yaw) * h * lean, mx = x + Math.cos(yaw) * h * lean * .25, mz = z + Math.sin(yaw) * h * lean * .25;
  const w = h * .06 + .25;
  WB.beam(x, y - .2, z, mx, y + h * .55, mz, w, w * .7, 4, { col: mulc(col, .75), mat: MAT.moss });
  WB.beam(mx, y + h * .55, mz, tx, y + h, tz, w * .7, .03, 4, { col: col, mat: MAT.moss });
}
function daisy(x, y, z, h, petal = C.petal, center = C.yellow) {
  const lean = rr(-.08, .08), hx = x + lean * h, hz = z + rr(-.08, .08) * h;
  WB.beam(x, y, z, hx, y + h, hz, .35, .3, 5, { col: C.grassD, mat: MAT.moss });
  WB.push(); WB.t(hx, y + h, hz); WB.rX(-.25); WB.rY(rnd() * 6);
  for (let i = 0; i < 12; i++) { WB.push(); WB.rY(i / 12 * Math.PI * 2); WB.box(0, 0, h * .14, h * .035, .08, h * .1, { col: petal, top: petal, ao: .95 }); WB.pop(); }
  WB.cyl(0, -.15, 0, h * .08, h * .07, .45, 8, { col: center, top: center });
  WB.pop();
}
function boulder(x, y, z, r, solid = true) {
  WB.sph(x, y + r * .55, z, r, r * .75, r * .9, 7, 5, { col: C.stone, top: hex(0xb8b2a6), mat: MAT.rock, wob: .3 });
  if (solid) addSolid({ type: 'cyl', x, z, r: r * .85, bot: y, top: y + r * 1.1, surf: 'rock' });
}
function clover(x, y, z, s) {
  WB.beam(x, y, z, x, y + s * 1.6, z, .12 * s, .1 * s, 4, { col: C.grassD });
  for (let i = 0; i < 3; i++) { const a = i * 2.094; WB.sph(x + Math.cos(a) * s * .55, y + s * 1.6, z + Math.sin(a) * s * .55, s * .6, s * .08, s * .6, 7, 2, { col: C.moss, top: C.leafL }); }
}
function pinecone(x, y, z, s) {
  for (let i = 0; i < 7; i++) { const r = s * (1 - Math.abs(i - 2.5) / 4.2), yy = y + i * s * .42; WB.cyl(x, yy, z, r, r * .6, s * .5, 8, { col: i % 2 ? hex(0x8a5a32) : hex(0x6e4424), top: hex(0x9a6a40), a0: i * .3, mat: MAT.bark }); }
}
function deadLeaf(x, y, z, s, yaw) { WB.push(); WB.t(x, y, z); WB.rY(yaw); WB.sph(0, 0, 0, s * .5, .12, s, 8, 2, { col: hex(0xc9873a), top: hex(0xe0a050) }); WB.pop(); }

/* ---------- interactive markers ---------- */
function lift(x, z, r, y0, y1, L, kind) { const l = { x, z, r, y0, y1, L, kind, on: true, ph: rnd() * 10 }; lifts.push(l); return l; }
function vent(x, y, z, h, kind = 'steam') {
  WB.cyl(x, y - .3, z, 3.2, 1.6, 1.1, 9, { col: C.stone, top: hex(0x3a3330), mat: MAT.rock, wob: .2 });
  return lift(x, z, kind === 'steam' ? 2.3 : 2.6, y, y + h, 18, kind);
}
function patch(x, y, z, hint, tier) {
  const p = { x, y, z, hint, tier, plant: null, id: patches.length };
  WB.cyl(x, y - .05, z, 1.9, 1.7, .14, 10, { col: hint === 'ash' ? C.ash : hint === 'moss' ? hex(0x356b2a) : hint === 'damp' ? C.damp : C.mud, top: hint === 'ash' ? hex(0x4a403c) : hint === 'moss' ? hex(0x2e5a25) : hex(0x2f4e4a) });
  patches.push(p); return p;
}
function seedHead(x, y, z) { heads.push({ x, y, z, t: 0, ready: true }); WB.beam(x, y, z, x, y + 1.6, z, .1, .08, 4, { col: C.grassD }); }
function mote(x, y, z) { motes.push({ x, y, z, taken: false, tier: tierOf(y) }); }
function line(a, b, n, arc = 0) { for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1); mote(lerp(a[0], b[0], t), lerp(a[1], b[1], t) + Math.sin(t * Math.PI) * arc, lerp(a[2], b[2], t)); } }
function helix(x, z, r, y0, y1, n, turns = 2) { for (let i = 0; i < n; i++) { const t = i / (n - 1), a = t * turns * Math.PI * 2; mote(x + Math.cos(a) * r, lerp(y0, y1, t), z + Math.sin(a) * r); } }
function ring(x, y, z, r, n) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; mote(x + Math.cos(a) * r, y, z + Math.sin(a) * r); } }
function tierOf(y) { return y < 23 ? 1 : y < 86 ? 2 : 3; }
function wind(x0, x1, y0, y1, z0, z1, dx, dz, speed, o = {}) { const w = { x0, x1, y0, y1, z0, z1, dx, dz, speed, ground: !!o.ground, steady: !!o.steady, period: o.period || 4.2, onT: o.onT || 1.6, ph: o.ph || 0, active: false, tele: false }; winds.push(w); return w; }
function windTuft(x, y, z, w) { tufts.push({ x, y, z, w, s: rr(.9, 1.4) }); }
function sign(x, y, z, yaw, lines, o = {}) {
  WB.push(); WB.t(x, y, z); WB.rY(yaw);
  WB.box(0, .9, 0, .12, .9, .12, { col: C.barkD, mat: MAT.bark });
  WB.box(0, 1.9, 0, .9, .5, .1, { col: hex(0xb07a44), top: hex(0xc58a50), mat: MAT.bark });
  WB.box(0, 1.9, .11, .6, .06, .01, { col: hex(0x4a2e18) }); WB.box(0, 1.72, .11, .45, .05, .01, { col: hex(0x4a2e18) }); WB.box(0, 2.08, .11, .5, .05, .01, { col: hex(0x4a2e18) });
  WB.pop();
  addSolid({ type: 'cyl', x, z, r: .3, bot: y, top: y + 2.4, surf: 'wood' });
  signs.push({ x, y, z, lines, unlock: o.unlock || null, auto: !!o.auto, seen: false });
}
function checkpoint(x, y, z, name) { cps.push({ x, y, z, name, on: false, t: 0 }); }

/* =================== BUILD THE GORGE =================== */
_seed = 4242;
// --- ground: the mossy floor tier ---
WB.box(0, -1.05, 30, 48, 1, 52, { col: C.mud, top: C.mud, skipTop: true, mat: MAT.soft, ao: .9 });
{ const T = 4, cAt = (x, z) => { const n = Math.sin(x * .09 + Math.sin(z * .07) * 1.3) + Math.sin(z * .11 - x * .05) * .8 + Math.sin(x * .23 + z * .19) * .35; const d = clamp(.5 + n * .32, 0, 1);
    return mixc(mixc(hex(0x4f8f34), hex(0x6fae3e), d), hex(0x8a7a48), clamp((n - .9) * 1.2, 0, .55)); };
  for (let x = -48; x < 48; x += T) for (let z = -22; z < 82; z += T) { const a = cAt(x, z), b = cAt(x + T, z), c2 = cAt(x + T, z + T), d = cAt(x, z + T); WB.quad([x, 0, z + T], [x + T, 0, z + T], [x + T, 0, z], [x, 0, z], d, c2, b, a, MAT.moss); } }
addSolid({ type: 'box', x: 0, z: 30, hx: 48, hz: 52, c: 1, s: 0, yaw: 0, bot: -4, top: 0, surf: 'moss', id: uid++ }); solids[solids.length - 1].isFloor = true;
// shallow puddle "lake"
waters.push({ x: 24, z: 48, r: 12 }); WB.cyl(24, .02, 48, 12.5, 12, .05, 16, { col: C.mud, top: hex(0x4b5a3a) });
WX.cyl(24, .12, 48, 12, 11.8, .1, 18, { col: C.water, top: C.water });
deadLeaf(21, .3, 45, 4.5, .7); deadLeaf(29, .3, 51, 3, 2.1);
// gorge side walls + south bank + invisible fences
sbox(-62, -46, 0, 110, -70, 82, 'cliff', { noTufts: true }); sbox(46, 62, 0, 96, -70, 82, 'cliff', { noTufts: true });
sbox(-46, 46, 0, 9, 78, 90, 'cliff');
sbox(-48, 48, 9, 220, 80, 82, 'inv'); sbox(-48, -46, 110, 220, -70, 82, 'inv'); sbox(46, 48, 96, 220, -70, 82, 'inv'); sbox(-48, 48, 88, 220, -68, -66, 'inv');
// --- the cliff with the Wasp Chimney ---
sbox(-46, -11, 0, 100, -66, -8, 'cliff', { noTufts: true });       // west block
sbox(11, 46, 0, 88, -66, -12, 'cliff', { noTufts: true });         // east block (canopy rim at 88)
sbox(11, 46, 0, 24, -12, -8, 'cliff', { noTufts: true });          // east foot
sbox(-11, 11, 0, 24, -26, -8, 'rock');                              // chimney floor shelf (24)
sbox(-11, 11, 24, 100, -66, -26, 'cliff', { noTufts: true });      // chimney back wall
// outcrops break up the big faces
function outcrops(x0, x1, y0, y1, z, dir, n) { for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1), w = rr(1.5, 5), h = rr(1, 3.5), d = rr(.5, 1.6); WB.box(x, y, z + dir * d * .5, w, h, d, { col: mulc(rnd() < .5 ? C.sand2 : C.sand3, rr(.85, 1.05)), mat: MAT.rock, top: rnd() < .4 ? C.lip : null }); } }
function outcropsX(z0, z1, y0, y1, x, dir, n) { for (let i = 0; i < n; i++) { const z = rr(z0, z1), y = rr(y0, y1), w = rr(1.5, 5), h = rr(1, 3.5), d = rr(.5, 1.6); WB.box(x + dir * d * .5, y, z, d, h, w, { col: mulc(rnd() < .5 ? C.sand2 : C.sand3, rr(.85, 1.05)), mat: MAT.rock, top: rnd() < .4 ? C.lip : null }); } }
outcrops(-45, -24, 3, 98, -8, 1, 40); outcrops(12, 45, 26, 86, -12, 1, 34); outcrops(12, 45, 2, 22, -8, 1, 10);
outcropsX(-60, 78, 4, 105, -46, 1, 46); outcropsX(-60, 78, 4, 92, 46, -1, 46);
outcropsX(-26, -14, 26, 98, -11, 1, 7); outcropsX(-26, -14, 26, 86, 11, -1, 7);
for (let i = 0; i < 26; i++) { const x = rr(-44, 44), y = rr(30, 95); if (Math.abs(x) < 12) continue; const len = rr(4, 14); WB.beam(x, y, (x < 0 ? -8 : -12) + .3, x + rr(-.5, .5), y - len, (x < 0 ? -8 : -12) + .5, .25, .1, 4, { col: C.grassD, mat: MAT.moss }); }
// floor-tier stepping stairs (ledges on the cliff face)
const L1 = sbox(-23, -12, 0, 8, -8, -1, 'rock');
const L2 = sbox(-4, 5, 16, 18, -8, -1, 'rock');
WB.cyl(.5, 0, -4.5, 1.6, 1.2, 16, 7, { col: C.sandD, mat: MAT.rock });   // a rock column holding L2 up
addSolid({ type: 'cyl', x: .5, z: -4.5, r: 1.5, bot: 0, top: 16, surf: 'rock' });
// chimney ledges
const E1 = sbox(6, 11, 35, 37, -19.5, -14, 'rock');
const W1 = sbox(-11, -5.5, 32, 34, -24, -14, 'rock');
const W2 = sbox(-11, -4, 45, 47, -17.5, -12, 'rock');
const E3 = sbox(7.5, 11, 73, 75, -26, -16, 'rock');
const T = sbox(-11, -5, 63, 66, -26, -12, 'rock');
const X = sbox(-2, 11, 77, 79, -14, -8, 'rock');
const H = sbox(-11, -7, 92, 93.5, -26, -19, 'rock');
// steps from the exit ledge up to the canopy rim
sbox(5, 8, 79, 80.5, -14, -11, 'step'); sbox(8, 11, 79, 82, -12, -8, 'step'); sbox(11, 14, 82, 83.5, -12, -8, 'step'); sbox(14, 17, 83.5, 85, -12, -8, 'step'); sbox(17, 20, 85, 86.5, -12, -8, 'step');
// fissure in the west wall where the chimney gusts come from (visual)
WB.box(-10.9, 38, -19, .3, 4, 2.5, { col: hex(0x3a2a1e) });
// wasp nest stalk
WB.beam(-3.5, 61, -25.8, -3.5, 58, -22.5, .25, .2, 5, { col: C.barkD });

// --- canopy tier: the Old Oak ---
const TRUNK = scyl(28, -38, 6.5, 88, 138, 'bark');
WB.cyl(28, 88, -38, 9, 6.5, 3, 12, { col: C.barkD, mat: MAT.bark });     // root flare
const CROWN = addSolid({ type: 'cyl', x: 28, z: -38, r: 9.5, bot: 136, top: 140, surf: 'bark' });
WB.cyl(28, 136, -38, 8.5, 9.8, 4, 14, { col: C.bark, top: hex(0x8a6a3a), mat: MAT.bark });
WB.cyl(28, 140, -38, 9.8, 9.8, .3, 14, { col: C.lip, top: C.moss, mat: MAT.moss });
for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; WB.beam(28 + Math.cos(a) * 9.2, 139.6, -38 + Math.sin(a) * 9.2, 28 + Math.cos(a + .5) * 9.5, 141.2, -38 + Math.sin(a + .5) * 9.5, .5, .3, 5, { col: hex(0xb08a50) }); }
// branches (walkable)
const BR1 = branch(24, -30, 6, -2, 95, 3.2);
const BR2 = branch(22, -38, -4, -8, 110, 3.2);
branch(32, -40, 44, -24, 118, 2.6);
branch(30, -44, 38, -58, 104, 2.6);
// leaf clumps (solid canopy overhangs)
const LC1 = scyl(14, -16, 5, 100.5, 106, 'leaf');
const LC2 = scyl(11, -12, 4.2, 129, 133, 'leaf');
scyl(40, -26, 6, 121, 128, 'leaf'); scyl(36, -56, 6, 107, 113, 'leaf'); scyl(18, -46, 7, 142, 150, 'leaf'); scyl(38, -42, 6, 144, 151, 'leaf'); scyl(26, -26, 5, 146, 152, 'leaf');
// rim boulders and grass
boulder(36, 88, -18, 3); boulder(22, 88, -50, 4); boulder(42, 88, -48, 3.5);

// --- floor tier: signs, vent, pitcher, puffballs ---
checkpoint(5, 0, 52, 'Mossy Floor');
sign(3, 0, 56, -.4, ['Thistledown Gorge. The Old Oak waits at the rim, 140 m above.', 'WASD to run, Space to jump. Move the mouse (click first) or use the arrow keys to turn the camera.', 'Pollen motes like these teach good flight lines. Every 100 grows you an extra seed tuft.']);
const V0 = vent(-14, 0, 36, 14);
sign(-8, 0, 41, .5, ['Steam rises from cracks in the floor.', 'Jump, then press Space again in the air to open your seed.', 'Open, you sink about 1 m a second and catch every bit of lift. Shift closes it again.']);
const R1 = sbox(-31, -17.5, 0, 12, 29, 44, 'rock');
sbox(4, 10, 0, 3, 18, 24, 'rock');
// pitcher plant + alcove for Golden seed #1
pitchers.push({ x: 13, y: 0, z: 31, my: 3.4, r: 4, t: 0, caught: 0 });
addSolid({ type: 'cyl', x: 13, z: 31, r: 1.1, bot: 0, top: 2.8, surf: 'plant' });
natCaps.push({ x: 17, y: 0, z: 35, cd: 0, sq: 0 });
const R2 = sbox(19, 26, 0, 5, 22, 29, 'rock');
const PM = patch(6, 0, 40, 'moss', 1);
sign(8.5, 0, 43, -.9, ['Pitcher plants drag in anything that floats too close.', 'Mushroom caps like the one by its lip burst when you land on them or glide over.', 'You can grow your own Puffcap on mossy soil.']);
puffballs.push({ x: -6, y: 0, z: 26, r: 1.3, t: 0, gone: 0 }); puffballs.push({ x: -20, y: 12, z: 33, r: 1.1, t: 1, gone: 0 }); puffballs.push({ x: -2, y: 0, z: 18, r: 1.2, t: 2, gone: 0 });
// sundew pads by the stairs
sundews.push({ x: -2, z: 6, r: 2.2, y: 0 }); sundews.push({ x: -15, z: 7, r: 2, y: 0 });
sundews.forEach(s => addSolid({ type: 'cyl', x: s.x, z: s.z, r: s.r, bot: 0, top: .35, surf: 'sundew' }));
// stepping stairs patches
const S1 = patch(-8, 0, -2, 'damp', 1), P2 = patch(-17, 8, -4.5, 'damp', 1), P3 = patch(.5, 18, -4.5, 'damp', 1);
seedHead(-4, 0, 7); seedHead(-12, 0, 10); seedHead(1, 0, 12); seedHead(3, 0, 44); seedHead(-19, 8, -5.5);
sign(-6, 0, 4, .2, ['Glowing soil patches take seed pods. Pick pods up from burst seed heads; you carry up to 3.', 'Stand on a patch and hold E to choose a plant, or tap E to plant the last one again.', 'A Fan Fern pumps a steady updraft 15 m tall. Three patches climb this cliff, one after another.']);
// floor decoration
for (let i = 0; i < 70; i++) { const x = rr(-44, 44), z = rr(-6, 76); if (Math.hypot(x - 24, z - 48) < 13 || (Math.abs(x) < 7 && z > 30) || (x > -32 && x < -16 && z > 28 && z < 45)) continue; blade(x, 0, z, rr(6, 15), rr(.15, .45)); }
for (const [x, z, h] of [[-36, 64, 13], [-28, 70, 10], [34, 66, 12], [40, 30, 14], [-40, 20, 11], [30, 12, 9], [-34, 4, 12], [15, 70, 8]]) daisy(x, 0, z, h);
for (const [x, z, s] of [[-24, 52, 2.4], [8, 64, 2], [36, 8, 2.6], [-38, 36, 2.2]]) clover(x, 0, z, s);
pinecone(36, 0, 40, 4.4); addSolid({ type: 'cyl', x: 36, z: 40, r: 4, bot: 0, top: 11, surf: 'bark' });
boulder(-30, 0, 58, 3); boulder(28, 0, 22, 2.5); boulder(-40, 0, 46, 2.2); boulder(16, 0, 64, 2.6); boulder(40, 0, 56, 3.3);
// waterfall down the west gorge wall
for (let i = 0; i < 1; i++) WX.box(-45.6, 50, 20, .3, 50, 3, { col: hex(0xbfe6ff), top: hex(0xe8f6ff) });
waters.push({ x: -42, z: 20, r: 5, fall: true });

// --- cliff tier: the Wasp Chimney ---
checkpoint(-3, 24, -14, 'The Wasp Chimney');
sign(-7, 24, -11, .3, ['The Wasp Chimney: 60 m of rising steam, gusts and a wasp nest.', 'Hold right mouse (or C) to tuck dive: the seed folds and you drop fast. Let go to flare, trading speed for a short climb.', 'Q sends a seed pulse that scatters wasps and pops spore puffballs. It recharges in 6 seconds.'], { unlock: 'sunpod' });
seedHead(-8, 24, -22); seedHead(-6.5, 34, -15.2);
const V1 = vent(3, 24, -19, 15);
const WG = wind(-11, .5, 30, 47, -19, -10, 1, 0, 6.5, { period: 4.4, onT: 1.7 });
for (const [x, z] of [[7, -15], [9, -17], [7.5, -18.5], [-7, -15.5], [-9, -17], [-6.5, -18.5]]) windTuft(x, x > 0 ? 37 : 34, z, WG);
const WP = patch(-8.5, 34, -22.3, 'damp', 2);
const RT = lift(5, -19, 2.4, 40, 77, 18, 'rock');     // sun-warmed rock thermal along the east wall
turbs.push({ x: -.5, y: 71, z: -19, R: 4, y0: 63.5, y1: 78, t: 0 });   // a tall churning column in the chimney neck
const PA = patch(-7.5, 66, -15, 'ash', 2), PBd = patch(-8.5, 66, -23.5, 'damp', 2);
checkpoint(2, 79, -11, 'Exit Ledge');
// chimney collectables
line([0, 1, 50], [-8, 1, 44], 6); line([-12, 1, 38], [-14, 2, 36], 2);
helix(-14, 36, 1.1, 2, 13, 10, 2);                                   // up the first steam vent
line([-19, 13, 36], [-29, 13, 40], 5);                                // across the rock shelf
line([3, 1, 46], [5, 1, 41], 3); ring(6, 1.2, 40, 2.4, 6);            // to the mossy patch
line([8, 7, 37], [17, 8, 30], 6, 1.5);                                 // the puffcap arc over the pitcher
line([2, 1, 40], [-6, 1, 6], 9);                                       // down to the stairs
helix(-8, -2, 1.2, 2, 14, 8, 1.5); helix(-17, -4.5, 1.2, 10, 22, 8, 1.5); helix(.5, -4.5, 1.2, 20, 23, 4, .7);
line([-28, 1, 10], [-36, 1, 26], 5, 2); line([30, 1, 60], [38, 1, 50], 5, 2);
helix(3, -19, 1.2, 25.5, 38, 20, 2.5);                  // GDD beat: 20 motes up the first vent
line([5, 39, -18], [-5, 36, -18], 6, 1);
helix(-8.5, -22.3, 1.4, 35, 48, 10, 2);
line([-5, 48, -15], [3, 46, -19], 5, 1.5);
helix(5, -19, 1.3, 46, 74, 14, 3);
line([6, 76, -20], [-6, 67.5, -18], 5);
helix(-7.5, -15, 1.2, 67, 80, 8, 1.5);
ring(-8.5, 80, -23.5, 1.8, 8);
goldens.push({ x: -9, y: 94.6, z: -22.5, tier: 2, name: 'Chimney Alcove', seen: false, taken: false });
letters.push({ x: -10.3, y: 48, z: -12.6, tier: 2, title: 'A note pinned in a crack', text: ['"Day 3 in the chimney. The wasps loop like clockwork.', 'When they swing low and face the far wall, the warm rock on the right will carry you past them. Do not hurry. — B."'] });
letters.push({ x: -10.4, y: 80.4, z: -25.4, tier: 2, title: 'A letter wedged in the stone', text: ['"The ash on the top shelf soaks up the sun.', 'A Sunpod there will throw you higher than any fern, but only while the cloud keeps away. Count the shadows. — B."'] });

// --- canopy tier ---
checkpoint(16, 88, -18, 'The Canopy');
sign(19, 88, -15, -.6, ['The canopy belongs to the kestrel. When it cries and your shadow starts to grow, it is about to stoop.', 'Dive sideways, hide under the leaves, or plant a Bramble Ward: predators keep 10 m away from it.', 'A Windbell bends wind straight up. Plant it where a side wind blows.'], { unlock: 'canopy' });
const G1 = lift(14, -5.5, 2.8, 85, 104, 18, 'branch');
const G2 = lift(1.5, -1, 2.6, 92, 116, 18, 'branch');
const G3 = lift(15.7, -23.1, 2.8, 108, 144, 19, 'branch');
downs.push({ x: 20, z: -14, r: 3, y0: 88, y1: 112 });
const PW = patch(8.5, 110, -21.5, 'stone', 3);         // windbell spot on BR2
const CW = wind(5.5, 12, 108, 118, -27, -16, -1, 0, 4, { steady: true });
for (const [x, z] of [[5.6, -19], [9, -23], [10.7, -25]]) windTuft(x, 110, z, CW);
const BW = wind(-2, 12, 108, 118, -16, -7, 0, 1, 6, { period: 5, onT: 1.8, ph: 2, ground: true });
for (const [x, z] of [[-2.2, -10], [-.9, -12], [.4, -14]]) windTuft(x, 110, z, BW);
const PBr = patch(13.5, 110, -28.2, 'stone', 3);
webs.push({ x: -1.4, y: 113.6, z: -4.6, yaw: Math.atan2(-5.5, -7), w: 5, h: 6, broken: 0, sp: 0 });
{ const w = webs[webs.length - 1], tx = Math.cos(w.yaw) * 2.6, tz = -Math.sin(w.yaw) * 2.6;
  WB.beam(w.x + tx, w.y + 3.2, w.z + tz, w.x + tx * 1.3, 110, w.z + tz * 1.3 - 1, .14, .1, 4, { col: C.barkD });
  WB.beam(w.x - tx, w.y + 3.2, w.z - tz, w.x - tx * 1.2, w.y + 6, w.z - tz * 1.2 - 2.5, .14, .1, 4, { col: C.barkD });
  WB.beam(w.x + tx, w.y + 3.2, w.z + tz, w.x - tx, w.y + 3.2, w.z - tz, .12, .1, 4, { col: C.barkD }); }
sundews.push({ x: 15.3, z: -16.5, r: 1.5, y: 95, branch: true }); addSolid({ type: 'cyl', x: 15.3, z: -16.5, r: 1.5, bot: 94.9, top: 95.3, surf: 'sundew' });
goldens.push({ x: 11, y: 134.6, z: -12, tier: 3, name: 'Leaf Crown', seen: false, taken: false });
goldens.push({ x: 22.5, y: 6.4, z: 25.5, tier: 1, name: 'Pitcher Hollow', seen: false, taken: false });
letters.push({ x: -26, y: 13.2, z: 40, tier: 1, title: 'A soggy envelope', text: ['"Whoever finds this: the gorge breathes. Steam at the bottom, warm rock in the middle, wind in the branches.', 'Learn where it breathes and you never need to walk. — B."'] });
letters.push({ x: 40, y: 89.2, z: -22, tier: 3, title: 'A letter under a stone', text: ['"I made it to the rim. The kestrel took my hat.', 'Plant thorns where you rest, and the bird will look elsewhere. The crown is close. — B."'] });
// canopy motes
helix(14, -5.5, 1.4, 88, 103, 10, 2);
line([12, 96.5, -12], [8, 96.5, -6], 4); line([18, 96.5, -21], [22, 96.5, -27], 3);
helix(1.5, -1, 1.3, 96, 115, 10, 2);
line([-3, 111.5, -9], [6, 111.5, -19], 5);
helix(15.7, -23.1, 1.5, 112, 142, 14, 3);
ring(28, 141.5, -38, 6, 10);
// crown goal
const GOAL = { x: 28, y: 140, z: -38, r: 3 };
for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; daisy(28 + Math.cos(a) * 2.6, 140.2, -38 + Math.sin(a) * 2.6, rr(1.6, 2.4), i % 2 ? C.pink : C.petal); }

// shortcut geyser revealed by the four letters
const SHORTCUT = lift(18, -3, 2.6, 0, 70, 20, 'steam'); SHORTCUT.on = false; SHORTCUT.hidden = true;
WB.cyl(18, -.3, -3, 2.8, 1.4, .9, 9, { col: C.stone, top: hex(0x2a2522), mat: MAT.rock });

// sky
const SKYB = new Builder(); SKYB.jit = 0; SKYB.sph(0, 0, 0, 1, 1, 1, 18, 12, { col: hex(0x9fd0f2), top: hex(0x2f6fcf), bot: hex(0xcfe8f7) });
const CLOUDB = new Builder(); CLOUDB.jit = .03;
for (let i = 0; i < 7; i++) CLOUDB.sph(rr(-7, 7), rr(-1, 1.5), rr(-4, 4), rr(4, 7), rr(2, 3), rr(3.5, 5), 8, 5, { col: [1, 1, 1], top: [1, 1, 1], bot: hex(0xd8e4f0) });

/* ---------- static spatial grid ---------- */
const GC = 10, GRID = new Map(); let qStamp = 1; const qOut = [];
const gk = (i, j) => (i + 500) * 1000 + (j + 500);
function solidExtent(s) {
  if (s.type === 'cyl') return [s.x - s.r, s.x + s.r, s.z - s.r, s.z + s.r];
  const ex = Math.abs(s.c) * s.hx + Math.abs(s.s) * s.hz, ez = Math.abs(s.s) * s.hx + Math.abs(s.c) * s.hz;
  return [s.x - ex, s.x + ex, s.z - ez, s.z + ez];
}
function gridAdd(s) {
  s.q = 0; const [x0, x1, z0, z1] = solidExtent(s);
  for (let i = Math.floor(x0 / GC); i <= Math.floor(x1 / GC); i++) for (let j = Math.floor(z0 / GC); j <= Math.floor(z1 / GC); j++) { const k = gk(i, j); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(s); }
}
function gridRemove(s) { const [x0, x1, z0, z1] = solidExtent(s); for (let i = Math.floor(x0 / GC); i <= Math.floor(x1 / GC); i++) for (let j = Math.floor(z0 / GC); j <= Math.floor(z1 / GC); j++) { const c = GRID.get(gk(i, j)); if (c) { const n = c.indexOf(s); if (n >= 0) c.splice(n, 1); } } }
solids.forEach(gridAdd);
function near(x0, z0, x1, z1) {
  qOut.length = 0; qStamp++;
  for (let i = Math.floor(x0 / GC); i <= Math.floor(x1 / GC); i++) for (let j = Math.floor(z0 / GC); j <= Math.floor(z1 / GC); j++) {
    const c = GRID.get(gk(i, j)); if (!c) continue;
    for (const s of c) if (s.q !== qStamp) { s.q = qStamp; qOut.push(s); }
  }
  return qOut;
}

