'use strict';
/* ===================== MODELS (built once, posed per frame) ===================== */
// static extras painted into the world before upload
sundews.forEach(s => {
  WB.cyl(s.x, s.y, s.z, s.r, s.r * .95, .35, 10, { col: hex(0x9c2a2a), top: hex(0xc4423a) });
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, d = s.r * rr(.3, .8); WB.beam(s.x + Math.cos(a) * d, s.y + .3, s.z + Math.sin(a) * d, s.x + Math.cos(a) * d * 1.1, s.y + 1.1, s.z + Math.sin(a) * d * 1.1, .07, .05, 3, { col: hex(0xd0504a) }); }
});
pitchers.forEach(p => {
  WB.cyl(p.x, 0, p.z, 1.4, 1.9, 2.8, 10, { col: hex(0x6aa040), top: hex(0x3b1a14), capT: false });
  WB.cyl(p.x, 2.8, p.z, 1.9, 2.3, .5, 10, { col: hex(0xb8403a), top: hex(0x2a0e0a) });
  WB.beam(p.x + 1.6, 3.2, p.z, p.x + 2.4, 5.4, p.z - .6, .35, .5, 5, { col: hex(0xa83a34) });
  for (let i = 0; i < 3; i++) WB.beam(p.x - 1, 0, p.z + i - 1, p.x - 3 - i, .6, p.z + i * 1.5 - 1.5, .5, .2, 4, { col: C.grassD });
});

function mk(fn) { const b = new Builder(); b.jit = .03; fn(b); return b; }
const MD = {};
MD.sky = SKYB; MD.cloud = CLOUDB;
// Pip: a little ant with a yellow backpack, as in the reference art
MD.pipHead = mk(b => {
  b.sph(0, 0, 0, .34, .31, .32, 9, 6, { col: hex(0xc9662a), top: hex(0xd87a36), bot: hex(0xa24f20) });
  for (const s of [-1, 1]) {
    b.sph(s * .13, .05, .25, .13, .16, .08, 7, 4, { col: [1, 1, 1], top: [1, 1, 1], bot: [.85, .85, .9] });
    b.sph(s * .12, .04, .31, .06, .08, .04, 6, 3, { col: hex(0x1a0e08), top: hex(0x1a0e08) });
    b.sph(s * .1, .08, .335, .02, .025, .01, 4, 2, { col: [1, 1, 1], top: [1, 1, 1] });
    b.beam(s * .12, .25, .05, s * .32, .65, .2, .025, .02, 4, { col: hex(0x4a2410) });
    b.sph(s * .32, .66, .2, .06, .06, .06, 5, 3, { col: hex(0xc9662a) });
  }
  b.box(0, -.15, .29, .1, .025, .02, { col: hex(0x5a1a10) });
});
MD.pipBody = mk(b => {
  b.sph(0, 0, 0, .24, .26, .22, 8, 5, { col: hex(0xc0602a), top: hex(0xcf7030) });                  // thorax
  b.sph(0, -.12, -.32, .28, .26, .34, 8, 5, { col: hex(0xa8521f), top: hex(0xbe6228) });           // abdomen
  b.box(0, .08, -.24, .24, .2, .13, { col: hex(0xf2c230), top: hex(0xffd84a), ao: .8 });             // backpack
  b.box(0, .2, -.37, .16, .05, .02, { col: hex(0x8a5a10) });
  b.push(); b.t(.18, .15, -.36); b.rZ(-.6); b.sph(0, 0, 0, .1, .28, .03, 6, 3, { col: hex(0x5fb83c), top: hex(0x7fd04a) }); b.pop();   // leaf in the pack
});
MD.pipArm = mk(b => { b.beam(0, 0, 0, 0, -.32, 0, .055, .05, 4, { col: hex(0x5a2a10) }); b.sph(0, -.34, 0, .07, .07, .07, 5, 3, { col: hex(0xc9662a) }); });
MD.pipLeg = mk(b => { b.beam(0, 0, 0, 0, -.3, 0, .06, .055, 4, { col: hex(0x5a2a10) }); b.sph(0, -.33, .05, .1, .07, .14, 6, 3, { col: hex(0x6a3a1a), top: hex(0x84502a) }); });
MD.stem = mk(b => { b.beam(0, 0, 0, 0, 1.5, 0, .04, .035, 4, { col: hex(0x9fcf5a) }); b.sph(0, 1.52, 0, .1, .07, .1, 6, 3, { col: hex(0xc9a868) }); });
MD.puffOpen = mk(b => {
  b.jit = .06;
  b.sph(0, 0, 0, 1.15, .55, 1.15, 12, 4, { col: [1, 1, 1], top: [1, 1, 1], bot: hex(0xe8eef4) });
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; b.beam(0, -.15, 0, Math.cos(a) * 1.05, .2, Math.sin(a) * 1.05, .02, .01, 3, { col: hex(0xf4f0e0) }); }
});
MD.puffClosed = mk(b => { b.sph(0, .3, 0, .22, .55, .22, 7, 4, { col: [1, 1, 1], top: [1, 1, 1], bot: hex(0xe8eef4) }); });
MD.shadow = mk(b => { b.jit = 0; b.cyl(0, 0, 0, 1, 1, .01, 14, { col: [0, 0, 0], top: [0, 0, 0] }); });
MD.column = mk(b => { b.jit = 0; b.cyl(0, 0, 0, 1, 1, 1, 14, { col: [1, 1, 1], top: [1, 1, 1], capT: false, ao: 1 }); });
MD.ring = mk(b => { b.jit = 0; for (let i = 0; i < 20; i++) { const a = i / 20 * 6.28, a2 = (i + 1) / 20 * 6.28; b.quad([Math.cos(a), -.06, Math.sin(a)], [Math.cos(a2), -.06, Math.sin(a2)], [Math.cos(a2), .06, Math.sin(a2)], [Math.cos(a), .06, Math.sin(a)], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]); } });
// collectables
MD.golden = mk(b => {
  b.sph(0, 0, 0, .45, .75, .45, 8, 6, { col: hex(0xf5c430), top: hex(0xfff090), bot: hex(0xc08a10) });
  b.beam(0, .7, 0, 0, 1.5, 0, .05, .04, 4, { col: hex(0xf5d060) });
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; b.beam(0, 1.5, 0, Math.cos(a) * .6, 1.9, Math.sin(a) * .6, .03, .02, 3, { col: hex(0xfff2b0) }); }
});
MD.letter = mk(b => { b.box(0, 0, 0, .45, .3, .05, { col: hex(0xf3ead8), top: hex(0xfff8ea) }); b.box(0, .05, .06, .1, .1, .02, { col: hex(0xc0392b) }); });
MD.feather = mk(b => { b.beam(0, -.6, 0, 0, .6, 0, .03, .02, 3, { col: hex(0xe8e0d0) }); b.sph(0, .1, 0, .22, .55, .04, 6, 4, { col: hex(0xd8c8a8), top: hex(0xfff6e4), bot: hex(0x8a6a4a) }); });
MD.seedHead = mk(b => { b.sph(0, 1.9, 0, .55, .55, .55, 9, 6, { col: [1, 1, 1], top: [1, 1, 1], bot: hex(0xe0e6ea) }); b.sph(0, 1.62, 0, .14, .1, .14, 6, 3, { col: hex(0x9a7a3a) }); });
MD.seedBare = mk(b => { b.sph(0, 1.62, 0, .16, .12, .16, 6, 3, { col: hex(0x9a7a3a) }); });
MD.cpBud = mk(b => { b.beam(0, 0, 0, 0, 1.6, 0, .08, .06, 4, { col: C.grassD }); b.sph(0, 1.8, 0, .3, .42, .3, 7, 4, { col: hex(0x8ac850), top: hex(0xf0e070) }); });
MD.cpBloom = mk(b => {
  b.beam(0, 0, 0, 0, 1.6, 0, .08, .06, 4, { col: C.grassD });
  b.push(); b.t(0, 1.75, 0); b.rX(-.3);
  for (let i = 0; i < 10; i++) { b.push(); b.rY(i / 10 * 6.28); b.box(0, 0, .45, .14, .04, .32, { col: hex(0xffe14a), top: hex(0xfff08a) }); b.pop(); }
  b.cyl(0, -.08, 0, .2, .18, .2, 8, { col: hex(0xe08a20), top: hex(0xf09a30) }); b.pop();
});
// plants
MD.fern = mk(b => {
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; b.push(); b.rY(a); b.rX(-.25);
    for (let k = 0; k < 5; k++) { const y = .3 + k * .6; b.push(); b.t(0, y, 0); b.rX(.35 + k * .1); b.sph(0, 0, .45, .16, .03, .45, 5, 2, { col: hex(0x3f9a34), top: hex(0x6cc248) }); b.pop(); }
    b.beam(0, 0, 0, 0, 3.2, .4, .07, .03, 3, { col: hex(0x2e7a28) }); b.pop(); }
  b.cyl(0, 0, 0, .6, .4, .5, 7, { col: hex(0x3a6a2a) });
});
MD.sunpod = mk(b => {
  b.cyl(0, 0, 0, .5, .3, 1, 7, { col: C.grassD });
  b.sph(0, 1.8, 0, 1.1, 1.3, 1.1, 10, 6, { col: hex(0x3a2440), top: hex(0x5a3a60), bot: hex(0x241628) });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; b.sph(Math.cos(a) * .8, .9, Math.sin(a) * .8, .5, .12, .3, 5, 2, { col: C.moss }); }
});
MD.sunGlow = mk(b => { b.sph(0, 2.9, 0, .55, .25, .55, 8, 3, { col: hex(0xffb040), top: hex(0xffe080) }); });
MD.puffcap = mk(b => {
  b.cyl(0, 0, 0, .55, .45, .9, 8, { col: hex(0xeee2c8), top: hex(0xeee2c8) });
  b.sph(0, 1, 0, 1.35, .55, 1.35, 10, 4, { col: hex(0x7a5ac8), top: hex(0x9a7ae0), bot: hex(0xe8dcc8) });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .3; b.sph(Math.cos(a) * .8, 1.38, Math.sin(a) * .8, .18, .06, .18, 5, 2, { col: hex(0xf4eefc), top: [1, 1, 1] }); }
});
MD.natcap = mk(b => {
  b.cyl(0, 0, 0, .6, .5, .9, 8, { col: hex(0xeee2c8) });
  b.sph(0, 1, 0, 1.4, .55, 1.4, 10, 4, { col: hex(0xd8432f), top: hex(0xe8584a), bot: hex(0xe8dcc8) });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .3; b.sph(Math.cos(a) * .85, 1.38, Math.sin(a) * .85, .2, .06, .2, 5, 2, { col: [1, 1, 1], top: [1, 1, 1] }); }
});
MD.windbell = mk(b => {
  b.beam(0, 0, 0, .3, 2.6, 0, .08, .06, 4, { col: C.grassD });
  b.push(); b.t(.3, 2.6, 0); b.rZ(.2); b.cyl(0, -.9, 0, .7, .15, .9, 8, { col: hex(0x5a7ae0), top: hex(0x7a9af0), capT: false }); b.sph(0, -.95, 0, .12, .12, .12, 5, 3, { col: hex(0xffe060) }); b.pop();
  for (let i = 0; i < 3; i++) { const a = i * 2.1; b.sph(Math.cos(a) * .5, .5, Math.sin(a) * .5, .35, .08, .2, 5, 2, { col: C.moss }); }
});
MD.bramble = mk(b => {
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; b.sph(Math.cos(a) * .6, .8 + rr(0, .5), Math.sin(a) * .6, .8, .7, .8, 6, 4, { col: hex(0x5a2a3a), top: hex(0x7a3a4a), wob: .3 }); }
  for (let i = 0; i < 22; i++) { const a = rr(0, 6.28), e = rr(-.3, 1.1), r = 1.2; const x = Math.cos(a) * Math.cos(e) * r, y = 1 + Math.sin(e) * r, z = Math.sin(a) * Math.cos(e) * r; b.beam(x * .7, y * .85, z * .7, x * 1.25, y * 1.08, z * 1.25, .08, .01, 3, { col: hex(0xd8c8b0) }); }
});
MD.puffball = mk(b => { b.sph(0, 1, 0, 1, 1, 1, 9, 6, { col: hex(0xcdb98a), top: hex(0xe8d8a8), bot: hex(0xa08a5a), wob: .08 }); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; b.box(Math.cos(a) * .7, 1.5, Math.sin(a) * .7, .05, .3, .05, { col: hex(0x8a7448) }); } });
// creatures
MD.wasp = mk(b => {
  b.sph(0, 0, .25, .2, .2, .22, 7, 4, { col: hex(0x1e1610) });
  b.sph(0, .02, .52, .17, .17, .17, 7, 4, { col: hex(0xf2c230) });
  b.sph(.08, .07, .66, .05, .05, .04, 4, 2, { col: hex(0x101010) }); b.sph(-.08, .07, .66, .05, .05, .04, 4, 2, { col: hex(0x101010) });
  for (let i = 0; i < 4; i++) b.sph(0, -.02, -.1 - i * .16, .2 - i * .03, .19 - i * .03, .1, 7, 3, { col: i % 2 ? hex(0x1e1610) : hex(0xf2c230) });
  b.beam(0, -.04, -.66, 0, -.06, -.88, .04, .005, 3, { col: hex(0x101010) });
});
MD.wing = mk(b => { b.jit = 0; b.sph(.45, 0, 0, .45, .02, .16, 6, 2, { col: hex(0xe8f4ff), top: [1, 1, 1] }); });
MD.nest = mk(b => {
  for (let i = 0; i < 5; i++) b.cyl(0, -i * .7 - .7, 0, 1.2 + Math.sin(i * .9) * .5, 1.4 + Math.sin(i * .9 + .7) * .5, .75, 10, { col: i % 2 ? hex(0xb8a58a) : hex(0xc9b698), top: hex(0xd8c8aa), a0: i });
  b.sph(0, -4.2, 0, .5, .3, .5, 6, 3, { col: hex(0x3a2a1a) });
});
MD.kestrel = mk(b => {
  b.sph(0, 0, 0, .9, .75, 1.9, 9, 6, { col: hex(0x9a5a30), top: hex(0xb8743e), bot: hex(0xe8d4b4) });
  b.sph(0, .35, 1.75, .7, .65, .7, 8, 5, { col: hex(0xa86a3a), top: hex(0x7a8aa0), bot: hex(0xf0e0c8) });
  b.cyl(0, .2, 2.35, .22, 0, .5, 6, { col: hex(0xf2b630) }); // beak, pointing up then rotated below
  b.sph(.38, .5, 2.15, .12, .12, .1, 5, 3, { col: hex(0x101010) }); b.sph(-.38, .5, 2.15, .12, .12, .1, 5, 3, { col: hex(0x101010) });
  b.box(0, 0, -2.1, .55, .1, .9, { col: hex(0x8a4a24), top: hex(0xa8603a) });
  for (const s of [-1, 1]) b.cyl(s * .35, -.9, .3, .1, .06, .6, 5, { col: hex(0xf2b630) });
});
MD.kWing = mk(b => { b.box(1.9, 0, 0, 1.9, .1, .85, { col: hex(0x9a5a30), top: hex(0xb06a38) }); b.box(4.6, 0, -.3, 1.1, .08, .6, { col: hex(0x3a2418), top: hex(0x5a3a28) }); });
MD.dragon = mk(b => {
  b.sph(0, 0, .6, .28, .26, .3, 7, 4, { col: hex(0x2a8a9a), top: hex(0x3ab0c0) });
  b.sph(.16, .08, .82, .14, .15, .12, 6, 3, { col: hex(0x60e0a0) }); b.sph(-.16, .08, .82, .14, .15, .12, 6, 3, { col: hex(0x60e0a0) });
  b.sph(0, 0, .15, .2, .2, .3, 6, 3, { col: hex(0x2a7a8a) });
  b.beam(0, 0, 0, 0, -.05, -2.2, .12, .06, 5, { col: hex(0x3ab0c0) });
});
MD.dWing = mk(b => { b.jit = 0; b.sph(.9, 0, 0, .9, .02, .2, 6, 2, { col: hex(0xd8f0ff), top: [1, 1, 1] }); });
MD.spider = mk(b => {
  b.sph(0, 0, 0, .35, .3, .45, 7, 4, { col: hex(0x241c18), top: hex(0x3a2e28) }); b.sph(0, .05, .5, .22, .2, .22, 6, 3, { col: hex(0x2a201c) });
  b.sph(.08, .12, .68, .05, .05, .04, 4, 2, { col: hex(0xd03030) }); b.sph(-.08, .12, .68, .05, .05, .04, 4, 2, { col: hex(0xd03030) });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const z = .35 - i * .22; b.beam(s * .25, 0, z, s * .7, .35, z + .1, .04, .03, 3, { col: hex(0x1a1412) }); b.beam(s * .7, .35, z + .1, s * 1.0, -.3, z + .15, .03, .02, 3, { col: hex(0x1a1412) }); }
});
MD.sign = null;

