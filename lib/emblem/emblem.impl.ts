// @ts-nocheck -- port literal de design/emblem/emblem.js (la lógica no se toca); la API tipada está en ./index.ts
// Port a TypeScript de design/emblem/emblem.js. La lógica es idéntica; solo se añaden tipos.
export type Pt = [number, number];
export type Shape = { d: string; fill: string; stroke: string; sw: number; op: number };
export type Colors = {
  c0: string; c1: string; c2: string; c3: string; eye: string;
  s0: string; s2: string; s3: string; eye2: string; ring1: string; ring2: string;
};
export type EmblemState = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type Emblem = { shapes: Shape[]; crowHead: Pt; snakeHead: Pt };
export type Badge = { x: number; y: number; ty: number; r: number; fs: number; ini: string; ring: string; op: number };
type Tx = (p: Pt) => Pt;
export function pfEmblem(state: number, col: Colors): Emblem {
  var S: Shape[] = [];
  var r0 = function (v: number) { return Math.round(v); };
  var P = function (p: Pt) { return r0(p[0]) + ' ' + r0(p[1]); };
  function push(d: string, fill?: string | null, stroke?: string | null, sw?: number, op?: number) { S.push({ d: d, fill: fill || 'none', stroke: stroke || 'none', sw: sw || 0, op: op == null ? 1 : op }); }
  function circ(c: Pt, r: number) { return 'M' + (c[0] - r).toFixed(1) + ' ' + c[1].toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 Z'; }

  // ---------- transform helper for crow (local -> global) ----------
  function T(tx: number, ty: number, rotDeg: number, sc: number, flip: boolean): Tx {
    var a = rotDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), sx = flip ? -sc : sc;
    return function (p: Pt): Pt { var x = p[0] * sx, y = p[1] * sc; return [tx + x * c - y * s, ty + x * s + y * c]; };
  }

  function feather(t: Tx, root: Pt, ang: number, L: number, W: number, bend: number, fill: string, shaft: string | null) {
    var a = ang * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
    var tip = [root[0] + d[0] * L + n[0] * L * bend, root[1] + d[1] * L + n[1] * L * bend];
    var m = [root[0] + d[0] * L * 0.45 + n[0] * L * bend * 0.6, root[1] + d[1] * L * 0.45 + n[1] * L * bend * 0.6];
    var c1 = [m[0] + n[0] * W, m[1] + n[1] * W], c2 = [m[0] - n[0] * W * 0.75, m[1] - n[1] * W * 0.75];
    var b1 = [root[0] + n[0] * W * 0.35, root[1] + n[1] * W * 0.35], b2 = [root[0] - n[0] * W * 0.35, root[1] - n[1] * W * 0.35];
    var tip2 = [tip[0] - d[0] * W * 0.45 + n[0] * W * 0.3, tip[1] - d[1] * W * 0.45 + n[1] * W * 0.3];
    push('M' + P(t(b1)) + ' Q' + P(t(c1)) + ' ' + P(t(tip)) + ' L' + P(t(tip2)) + ' Q' + P(t(c2)) + ' ' + P(t(b2)) + ' Z', fill, col.c0, 0.9);
    if (shaft) {
      var sm = [root[0] + d[0] * L * 0.5 + n[0] * L * bend * 0.55, root[1] + d[1] * L * 0.5 + n[1] * L * bend * 0.55];
      push('M' + P(t(root)) + ' Q' + P(t(sm)) + ' ' + P(t(tip2)), null, shaft, 1.2, 0.5);
    }
  }

  function wing(t: Tx, Sh: Pt, theta: number, span: number, spread: number, far: boolean, droop: number) {
    var a = theta * Math.PI / 180, Wr = [Sh[0] + Math.cos(a) * 70 * span, Sh[1] + Math.sin(a) * 70 * span];
    var base = far ? col.c0 : col.c1, cov = far ? col.c0 : col.c1, i, k, r;
    for (i = 0; i < 9; i++) { k = i / 8; r = [Sh[0] + (Wr[0] - Sh[0]) * k, Sh[1] + (Wr[1] - Sh[1]) * k];
      feather(t, r, theta + (95 - 25 * k) * spread, (64 + 10 * k) * span, 22 * span, 0.06, base, col.c3); }
    for (i = 0; i < 10; i++) { k = i / 9;
      feather(t, Wr, theta + (6 + k * (48 + droop)) * spread, (128 - 38 * k) * span, 22 * span, -0.04 - 0.08 * k, base, col.c3); }
    for (i = 0; i < 5; i++) { k = i / 4; r = [Sh[0] + (Wr[0] - Sh[0]) * k * 0.9, Sh[1] + (Wr[1] - Sh[1]) * k * 0.9];
      feather(t, r, theta + (80 - 35 * k) * spread, (48 + 6 * k) * span, 26 * span, 0.08, cov, null); }
  }

  function crow(t: Tx, o: any): Pt {
    var i, k;
    wing(t, [10, -14], o.far, 0.95, 1, true, o.droop || 0);
    for (i = 0; i < 9; i++) { k = i / 8; feather(t, [52, 4], -8 + (o.tail || 0) + (k - 0.5) * 44, 84 - Math.abs(k - 0.5) * 20, 18, 0.02, col.c1, col.c3); }
    // legs
    ([[-4, 110], [10, 95]] as Pt[]).forEach(function (lg) {
      var a = lg[1] * Math.PI / 180, knee = [lg[0] + Math.cos(a) * 28, 22 + Math.sin(a) * 28];
      push('M' + P(t([lg[0], 18])) + ' L' + P(t(knee)), null, col.c0, 5 * o.sc);
      ([-50, -15, 20] as number[]).forEach(function (dt) {
        var b = (lg[1] + dt + (o.grab ? 60 : 0)) * Math.PI / 180;
        var toe = [knee[0] + Math.cos(b) * 18, knee[1] + Math.sin(b) * 18], claw = [toe[0] + Math.cos(b + 1.3) * 8, toe[1] + Math.sin(b + 1.3) * 8];
        push('M' + P(t(knee)) + ' L' + P(t(toe)) + ' L' + P(t(claw)), null, col.c0, 3.5 * o.sc);
      });
    });
    var body: Pt[] = [[-46, -20], [-30, -40], [30, -34], [58, -8], [64, 2], [60, 14], [46, 18], [20, 30], [-24, 32], [-44, 14], [-56, 4], [-56, -10]];
    push('M' + P(t(body[0])) + ' C' + P(t(body[1])) + ' ' + P(t(body[2])) + ' ' + P(t(body[3])) + ' C' + P(t(body[4])) + ' ' + P(t(body[5])) + ' ' + P(t(body[6])) + ' C' + P(t(body[7])) + ' ' + P(t(body[8])) + ' ' + P(t(body[9])) + ' C' + P(t(body[10])) + ' ' + P(t(body[11])) + ' ' + P(t(body[0])) + ' Z', col.c1, col.c0, 1);
    for (i = 0; i < 6; i++) { var x = -40 + i * 12, y = 10 - Math.abs(i - 2) * 2;
      push('M' + P(t([x - 7, y])) + ' Q' + P(t([x, y + 9])) + ' ' + P(t([x + 7, y])), null, col.c2, 1.6, 0.8); }
    var nk: Pt[] = [[-30, -22], [-46, -40], [-70, -42], [-82, -30], [-92, -18], [-86, -2], [-70, 0], [-60, 2], [-48, -2], [-40, -6]];
    push('M' + P(t(nk[0])) + ' C' + P(t(nk[1])) + ' ' + P(t(nk[2])) + ' ' + P(t(nk[3])) + ' C' + P(t(nk[4])) + ' ' + P(t(nk[5])) + ' ' + P(t(nk[6])) + ' C' + P(t(nk[7])) + ' ' + P(t(nk[8])) + ' ' + P(t(nk[9])) + ' Z', col.c1, col.c0, 1);
    var hk: Pt[] = [[-80, -4], [-74, 12], [-70, 0], [-64, 14], [-60, 0], [-52, 10], [-48, -4]];
    push('M' + hk.map(function (p) { return P(t(p)); }).join(' L') + ' Z', col.c1);
    var bo = o.beak || 0;
    push('M' + P(t([-84, -30])) + ' C' + P(t([-100, -34])) + ' ' + P(t([-118, -28])) + ' ' + P(t([-132, -16])) + ' C' + P(t([-116, -18])) + ' ' + P(t([-100, -18])) + ' ' + P(t([-86, -16])) + ' Z', col.c0);
    push('M' + P(t([-86, -16])) + ' C' + P(t([-100, -16])) + ' ' + P(t([-112, -14 + bo])) + ' ' + P(t([-126, -10 + bo * 1.6])) + ' C' + P(t([-110, -6 + bo])) + ' ' + P(t([-98, -8])) + ' ' + P(t([-84, -10])) + ' Z', col.c0);
    push('M' + P(t([-88, -29])) + ' C' + P(t([-100, -31])) + ' ' + P(t([-114, -26])) + ' ' + P(t([-126, -18])), null, col.c3, 1.4, 0.6);
    push(circ(t([-78, -26]), 3.4 * o.sc), col.eye);
    push(circ(t([-77, -27]), 1 * o.sc), '#ffffff');
    push('M' + P(t([-20, -30])) + ' C' + P(t([10, -34])) + ' ' + P(t([34, -26])) + ' ' + P(t([52, -12])), null, col.c3, 2.5, 0.5);
    wing(t, [4, -18], o.near, 1, 1, false, o.droop || 0);
    return t([-72, -20]);
  }

  // ---------- snake ----------
  function catmull(pts: Pt[], n: number): Pt[] {
    var out: Pt[] = [], Q = [pts[0]!].concat(pts, [pts[pts.length - 1]!]), i: number, k: number;
    for (i = 1; i < Q.length - 2; i++) {
      var p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
      for (k = 0; k < n; k++) { var u = k / n, u2 = u * u, u3 = u2 * u;
        out.push([0, 1].map(function (j: number) { return 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3); }) as Pt); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function rad(u: number, SR: number) {
    var r;
    if (u < 0.04) r = 10 + u / 0.04; else if (u < 0.10) r = 11 - (u - 0.04) / 0.06 * 2;
    else if (u < 0.55) r = 9 + Math.sin((u - 0.10) / 0.45 * Math.PI / 2) * 8; else r = 17 * Math.pow(1 - (u - 0.55) / 0.45, 1.1) + 1;
    return r * SR;
  }
  function snake(center: Pt[], segs: number[][], mouth: string, SR: number, HS: number): any {
    var pts = catmull(center, 10), L = [0], i: number;
    for (i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var U = L.map(function (l) { return l / L[L.length - 1]; });
    function nd(i: number) { var a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [[-dy / m, dx / m], [dx / m, dy / m]]; }
    var layers = segs.map(function (sg) {
      var start = S.length, idx = [];
      for (i = 0; i < pts.length; i++) if (U[i] >= sg[0] && U[i] <= sg[1]) idx.push(i);
      if (idx.length < 2) return [];
      var left = [], right = [], belly = [], sheen = [];
      idx.forEach(function (k) { var n = nd(k)[0], r = rad(U[k], SR), p = pts[k];
        left.push([p[0] + n[0] * r, p[1] + n[1] * r]); right.push([p[0] - n[0] * r, p[1] - n[1] * r]);
        belly.push([p[0] - n[0] * r * 0.45, p[1] - n[1] * r * 0.45]); sheen.push([p[0] + n[0] * r * 0.65, p[1] + n[1] * r * 0.65]); });
      push('M' + left.concat(right.slice().reverse()).map(P).join(' L') + ' Z', col.s2, col.s0, 2);
      push('M' + belly.concat(right.slice().reverse()).map(P).join(' L') + ' Z', col.s3, null, 0, 0.85);
      idx.filter(function (_, j) { return j % 2 === 0; }).forEach(function (k) { var n = nd(k)[0], r = rad(U[k], SR), p = pts[k];
        push('M' + P([p[0] - n[0] * r * 0.45, p[1] - n[1] * r * 0.45]) + ' L' + P([p[0] - n[0] * r * 0.95, p[1] - n[1] * r * 0.95]), null, col.s2, 1, 0.5); });
      idx.filter(function (_, j) { return j % 3 === 0; }).forEach(function (k) { var nn = nd(k), n = nn[0], d = nn[1], r = rad(U[k], SR), p = pts[k];
        if (r < 5) return; var c = [p[0] + n[0] * r * 0.25, p[1] + n[1] * r * 0.25];
        push('M' + [[c[0] + d[0] * r * 0.55, c[1] + d[1] * r * 0.55], [c[0] + n[0] * r * 0.6, c[1] + n[1] * r * 0.6], [c[0] - d[0] * r * 0.55, c[1] - d[1] * r * 0.55], [c[0] - n[0] * r * 0.5, c[1] - n[1] * r * 0.5]].map(P).join(' L') + ' Z', col.s0, null, 0, 0.75);
        push(circ(c, +(r * 0.18).toFixed(1)), col.s3, null, 0, 0.7); });
      push('M' + sheen.map(P).join(' L'), null, col.s3, 1.6, 0.45);
      return S.splice(start, S.length - start);
    });
    var start = S.length, h = pts[0], d0 = [h[0] - pts[3][0], h[1] - pts[3][1]], m = Math.hypot(d0[0], d0[1]), d = [d0[0] / m, d0[1] / m], n = [-d[1], d[0]];
    function H(a: number, b: number): Pt { return [h[0] + d[0] * a * HS + n[0] * b * HS, h[1] + d[1] * a * HS + n[1] * b * HS]; }
    var eye;
    if (mouth === 'open') {
      var up = [H(-6, 12), H(10, 13), H(26, 9), H(36, 4), H(34, 1), H(20, 2), H(6, 0)], lo = [H(6, 0), H(18, -6), H(28, -14), H(26, -17), H(10, -12), H(-6, -11)];
      push('M' + up.concat(lo).map(P).join(' L') + ' Z', col.s2, col.s0, 1.5);
      push('M' + P(H(6, 0)) + ' L' + P(H(34, 1)) + ' L' + P(H(26, -15)) + ' Z', '#5a1418');
      push('M' + P(H(30, 2)) + ' L' + P(H(29, -4)) + ' L' + P(H(27, 2)) + ' Z', '#f2f0e6');
      push('M' + P(H(22, -12)) + ' L' + P(H(23, -6)) + ' L' + P(H(19, -10)) + ' Z', '#f2f0e6');
      push('M' + P(H(14, -2)) + ' L' + P(H(30, -6)) + ' L' + P(H(36, -4)) + ' M' + P(H(30, -6)) + ' L' + P(H(35, -9)), null, '#c4313a', 1.4);
      eye = H(16, 7);
    } else {
      push('M' + [H(-6, 12), H(8, 13), H(22, 10), H(32, 5), H(35, 0), H(32, -5), H(22, -10), H(8, -12), H(-6, -11)].map(P).join(' L') + ' Z', col.s2, col.s0, 1.5);
      push('M' + P(H(34, -1)) + ' L' + P(H(10, -6)), null, col.s0, 1.4);
      if (mouth === 'tongue') push('M' + P(H(35, 0)) + ' L' + P(H(46, 0)) + ' L' + P(H(50, 3)) + ' M' + P(H(46, 0)) + ' L' + P(H(50, -3)), null, '#c4313a', 1.4);
      eye = H(18, 6);
    }
    push('M' + P(H(4, 9)) + ' L' + P(H(26, 8)), null, col.s0, 2, 0.6);
    push(circ(eye, 3.4 * HS / 1.7), mouth === 'limp' ? col.s3 : col.eye2);
    if (mouth !== 'limp') push('M' + P([eye[0], eye[1] - 2.6]) + ' L' + P([eye[0], eye[1] + 2.6]), null, '#111111', 1.6);
    var head = S.splice(start, S.length - start);
    return { layers: layers, head: head, hp: H(12, 0) };
  }

  function crowShapes(tx: number, ty: number, r: number, sc: number, flip: boolean, o: any) {
    var start = S.length; o.sc = sc;
    var hp = crow(T(tx, ty, r, sc, flip), o);
    return { shapes: S.splice(start, S.length - start), hp: hp };
  }

  var C: Record<string, () => any[]> = {
    // state: +3 crow absolute ... 0 central ... -3 snake absolute
    '3': function () {
      // Dominio absoluto: cuervo enorme con las alas desplegadas en abanico, graznando; serpiente aplastada y apagada bajo las garras
      var sn = snake([[50, 503], [58, 458], [95, 418], [150, 393], [210, 390], [270, 404], [330, 436], [392, 476]], [[0, 1]], 'limp', 1.25, 1.35);
      sn.layers[0].forEach(function (x) { x.op *= 0.72; }); sn.head.forEach(function (x) { x.op *= 0.72; });
      var cr = crowShapes(205, 308, 6, 1.7, false, { near: -100, far: -155, grab: true, beak: 26, tail: -14 });
      return [sn.layers[0], sn.head, cr.shapes, cr.hp, sn.hp];
    },
    '2': function () {
      var sn = snake([[70, 330], [90, 280], [140, 250], [200, 222], [250, 222], [290, 270], [270, 330], [210, 370], [180, 420], [230, 465], [330, 475], [380, 455]], [[0, 1]], 'open', 1.9, 1.7);
      var cr = crowShapes(225, 175, 14, 1.3, false, { near: -118, far: -98, grab: true, beak: 10, tail: -10 });
      return [sn.layers[0], sn.head, cr.shapes, cr.hp, sn.hp];
    },
    '1': function () {
      var cr = crowShapes(240, 195, 4, 1.2, false, { near: -128, far: -108, grab: true, beak: 12, tail: -6 });
      var sn = snake([[110, 200], [140, 190], [175, 220], [200, 265], [250, 285], [300, 270], [310, 230], [255, 225], [225, 280], [240, 360], [310, 400], [360, 450], [330, 495]], [[0, 0.42], [0.42, 0.6], [0.6, 1]], 'open', 1.9, 1.7);
      return [[].concat(sn.layers[2], sn.layers[0]), [], cr.shapes, sn.layers[1].concat(sn.head), cr.hp, sn.hp];
    },
    '0': function () {
      var cr = crowShapes(270, 190, -8, 1.15, false, { near: -140, far: -118, grab: true, beak: 12, tail: -6 });
      var sn = snake([[95, 250], [120, 215], [165, 215], [200, 270], [250, 310], [320, 290], [330, 230], [260, 230], [230, 290], [250, 370], [320, 400], [370, 450], [330, 495]], [[0, 0.42], [0.42, 0.62], [0.62, 1]], 'open', 1.9, 1.7);
      return [[].concat(sn.layers[2], sn.layers[0]), [], cr.shapes, sn.layers[1].concat(sn.head), cr.hp, sn.hp];
    },
    '-1': function () {
      var cr = crowShapes(220, 175, 28, 1.2, false, { near: -150, far: -125, grab: false, beak: 14, tail: 0 });
      var sn = snake([[110, 330], [150, 290], [190, 280], [240, 250], [270, 200], [220, 175], [170, 200], [190, 245], [260, 260], [300, 330], [260, 400], [300, 460], [360, 490]], [[0, 0.32], [0.32, 0.5], [0.5, 1]], 'open', 1.9, 1.7);
      return [[].concat(sn.layers[1]), [], cr.shapes, sn.layers[0].concat(sn.layers[2], sn.head), cr.hp, sn.hp];
    },
    '-2': function () {
      var cr = crowShapes(205, 185, 70, 1.25, true, { near: 165, far: 185, grab: false, beak: 12, tail: 0, droop: 10 });
      var sn = snake([[320, 400], [270, 430], [210, 420], [180, 360], [205, 300], [260, 285], [270, 235], [205, 215], [140, 235], [150, 185], [245, 170], [285, 110], [230, 70], [200, 20]], [[0, 0.33], [0.33, 0.5], [0.5, 0.66], [0.66, 1]], 'tongue', 1.9, 1.7);
      return [[].concat(sn.layers[1], sn.layers[3]), [], cr.shapes, sn.layers[0].concat(sn.layers[2], sn.head), cr.hp, sn.hp];
    },
    '-3': function () {
      var cr = crowShapes(205, 175, 100, 1.3, true, { near: 150, far: 175, grab: false, beak: 10, tail: 0, droop: 25 });
      var sn = snake([[300, 410], [250, 440], [190, 430], [160, 370], [185, 310], [250, 290], [270, 240], [200, 220], [130, 240], [140, 190], [240, 175], [280, 120], [210, 95], [170, 50], [210, 0]], [[0, 0.30], [0.30, 0.46], [0.46, 0.62], [0.62, 0.80], [0.80, 1]], 'tongue', 1.9, 1.7);
      return [[].concat(sn.layers[2], sn.layers[4]), [], cr.shapes, sn.layers[0].concat(sn.layers[1], sn.layers[3], sn.head), cr.hp, sn.hp];
    }
  };
  var r = C[String(state)]();
  var shapes = [].concat(r[0], r[1], r[2], r[3]);
  if (r.length === 5) shapes = [].concat(r[0], r[1], r[2]);
  return { shapes: shapes, crowHead: r[r.length - 2], snakeHead: r[r.length - 1] };
}

// ---------------------------------------------------------------------------
// Colores aleatorios (deterministas por semilla) y estado de la rivalidad.
// ---------------------------------------------------------------------------

/** Paleta de una rivalidad. La semilla se sortea UNA vez al crear la rivalidad y se guarda. */
export function pfColors(seed: number): Colors {
  var a = (Number(seed) || 1) >>> 0;
  function rnd(): number { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var h1: number = Math.floor(rnd() * 360), h2: number = (h1 + 110 + Math.floor(rnd() * 140)) % 360; // tonos bien separados
  function hsl(h: number, s: number, l: number): string { s /= 100; l /= 100; var k = function (n: number) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l); var f = function (n: number) { var v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return ('0' + Math.round(v * 255).toString(16)).slice(-2); }; return '#' + f(0) + f(8) + f(4); }
  return {
    // cuervo
    c0: hsl(h1, 35, 7), c1: hsl(h1, 42, 24), c2: hsl(h1, 48, 36), c3: hsl(h1, 80, 68), eye: hsl(38, 85, 58),
    // serpiente
    s0: hsl(h2, 45, 10), s2: hsl(h2, 48, 33), s3: hsl(h2, 45, 72), eye2: hsl(55, 90, 58),
    // anillos de los iconos
    ring1: hsl(h1, 80, 68), ring2: hsl(h2, 60, 66)
  };
}

/**
 * Estado del emblema (-3..+3) desde el punto de vista del CUERVO.
 *  0: diferencia 0–1 · ±1: 2–3 · ±2: 4–6 · ±3: 7+ y ≥70 % de victorias del que gana
 *  (si la diferencia es 7+ pero no llega al 70 %, se queda en ±2).
 */
export function pfRivalryState(crowWins: number, snakeWins: number): EmblemState {
  var d = crowWins - snakeWins, ad = Math.abs(d), total = crowWins + snakeWins;
  var lvl = ad <= 1 ? 0 : ad <= 3 ? 1 : ad <= 6 ? 2 : 3;
  if (lvl === 3 && Math.max(crowWins, snakeWins) / total < 0.7) lvl = 2;
  return (d >= 0 ? lvl : -lvl) as EmblemState;
}

/** Iconos (iniciales) del emblema: grande y nítido en quien manda, pequeño y apagado en el otro; iguales en el centro. */
export function pfBadges(state: number, em: Emblem, crowIni: string, snakeIni: string, col: Colors): Badge[] {
  var abs3 = Math.abs(state) === 3; // dominio absoluto: icono del que manda más grande y el del otro casi apagado
  function badge(p: Pt, ini: string, big: boolean, ring: string, dim: boolean): Badge {
    var R = big ? (abs3 ? 22 : 17) : 12, oy = big ? (abs3 ? 36 : 30) : 24;
    return { x: Math.round(p[0]), y: Math.round(p[1] - oy), ty: Math.round(p[1] - oy + (big ? (abs3 ? 7 : 6) : 4)), r: R, fs: big ? (abs3 ? 19 : 15) : 11, ini: ini, ring: ring, op: dim ? (abs3 ? 0.35 : 0.55) : 1 };
  }
  if (state > 0) return [badge(em.snakeHead, snakeIni, false, col.ring2, true), badge(em.crowHead, crowIni, true, col.ring1, false)];
  if (state < 0) return [badge(em.crowHead, crowIni, false, col.ring1, true), badge(em.snakeHead, snakeIni, true, col.ring2, false)];
  return [badge(em.crowHead, crowIni, true, col.ring1, false), badge(em.snakeHead, snakeIni, true, col.ring2, false)];
}

/** Atajo: SVG completo como texto (útil para OG images, emails o tests). viewBox fijo -10 -50 420 560. */
export function pfEmblemSVG(state: number, seed: number, crowIni: string, snakeIni: string, size?: number): string {
  var col = pfColors(seed), em = pfEmblem(state, col), b = pfBadges(state, em, crowIni, snakeIni, col);
  var w = size || 400, h = Math.round(w * 4 / 3);
  var body = em.shapes.map(function (s) {
    return '<path d="' + s.d + '" fill="' + s.fill + '" stroke="' + s.stroke + '" stroke-width="' + s.sw + '" opacity="' + s.op + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }).join('') + b.map(function (x) {
    return '<g opacity="' + x.op + '"><circle cx="' + x.x + '" cy="' + x.y + '" r="' + x.r + '" fill="#0A1020" stroke="' + x.ring + '" stroke-width="3"/>' +
      '<text x="' + x.x + '" y="' + x.ty + '" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="' + x.fs + '" fill="#F2F5FA">' + x.ini + '</text></g>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -50 420 560" width="' + w + '" height="' + h + '" role="img">' + body + '</svg>';
}
