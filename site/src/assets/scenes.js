/* RNL introduction page · scenes and example data
 *
 * The circuits come from examples used in the RNL language discussion (5T OTA, RC/RLC, the fill-in
 * example). Coordinates and wiring are placed by hand for this page, not real solver output; the RNL
 * follows the current discussion draft (scheme 1.16, 2026-09-29) for illustration.
 */
(function (global) {
  'use strict';

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  /* ================= Five-transistor OTA ================= */

  var OTA_VB = [-4, 0, 47, 38.6];

  var OTA_SPEC = {
    M1: { sym: 'nmos', label: 'M1', value: 'W/L 2u/0.5u', valueOpt: true },
    M2: { sym: 'nmos', label: 'M2', value: 'W/L 2u/0.5u', valueOpt: true },
    M3: { sym: 'pmos', label: 'M3', value: 'W/L 4u/0.5u', valueOpt: true },
    M4: { sym: 'pmos', label: 'M4', value: 'W/L 4u/0.5u', valueOpt: true },
    M5: { sym: 'nmos', label: 'M5', value: 'W/L 4u/1u', valueOpt: true, lab: [-2.6, -1.8, 'end'], val: [-2.6, 3.4, 'end'] },
    P_inp: { sym: 'port', label: 'inp', virtual: true },
    P_inn: { sym: 'port', label: 'inn', virtual: true },
    P_out: { sym: 'port', label: 'out', virtual: true },
    P_vb: { sym: 'port', label: 'vbias', virtual: true },
    P_vdd: { sym: 'port', label: 'vdd', virtual: true },
    P_vss: { sym: 'port', label: 'vss', virtual: true },
    VDD1: { sym: 'vdd', virtual: true },
    VDD2: { sym: 'vdd', virtual: true },
    GND: { sym: 'gnd', virtual: true }
  };

  function layout(tbl) {
    var devices = {};
    for (var id in tbl) {
      var t = tbl[id];
      devices[id] = merge(OTA_SPEC[id], { x: t[0], y: t[1], o: t[2] });
    }
    return devices;
  }

  var L_AIR = {
    M1: [10, 20, 'R0'], M2: [17, 20, 'R0'], M3: [24, 20, 'R0'], M4: [31, 20, 'R0'], M5: [38, 20, 'R0'],
    P_inp: [3, 6, 'R0'], P_inn: [3, 10, 'R0'], P_out: [3, 14, 'R0'],
    P_vdd: [3, 26, 'R0'], P_vss: [3, 30, 'R0'], P_vb: [3, 34, 'R0']
  };
  var L_GROUPED = {
    M1: [12, 20, 'R0'], M2: [28, 20, 'R0'], M3: [12, 8, 'R0'], M4: [28, 8, 'R0'], M5: [20, 30, 'R0'],
    P_inp: [5, 20, 'R0'], P_inn: [22, 20, 'R0'], P_out: [33, 14, 'MY'], P_vb: [13, 30, 'R0'],
    VDD1: [12, 3, 'R0'], VDD2: [28, 3, 'R0'], GND: [20, 35, 'R0']
  };
  var L_SYM = {
    M1: [12, 20, 'R0'], M2: [28, 20, 'MY'], M3: [12, 8, 'MY'], M4: [28, 8, 'R0'], M5: [20, 30, 'R0'],
    P_inp: [5, 20, 'R0'], P_inn: [35, 20, 'MY'], P_out: [33, 14, 'MY'], P_vb: [13, 30, 'R0'],
    VDD1: [12, 3, 'R0'], VDD2: [28, 3, 'R0'], GND: [20, 35, 'R0']
  };
  var L_TWEAK = merge(L_SYM, { M2: [30, 20, 'MY'] });
  var L_RESOLVED = {
    M1: [10, 20, 'R0'], M2: [30, 20, 'MY'], M3: [10, 8, 'MY'], M4: [30, 8, 'R0'], M5: [20, 30, 'R0'],
    P_inp: [3, 20, 'R0'], P_inn: [37, 20, 'MY'], P_out: [35, 14, 'MY'], P_vb: [13, 30, 'R0'],
    VDD1: [10, 3, 'R0'], VDD2: [30, 3, 'R0'], GND: [20, 35, 'R0']
  };

  /* Connectivity only: each net draws straight lines (airwires) from its first terminal to the others */
  var AIR_NETS = [
    ['inp', ['P_inp.p', 'M1.g']], ['inn', ['P_inn.p', 'M2.g']], ['out', ['P_out.p', 'M2.d', 'M4.d']],
    ['vdd', ['P_vdd.p', 'M3.s', 'M4.s']], ['vss', ['P_vss.p', 'M5.s']], ['vbias', ['P_vb.p', 'M5.g']],
    ['x', ['M1.d', 'M3.d', 'M3.g', 'M4.g']], ['tail', ['M1.s', 'M2.s', 'M5.d']]
  ];

  function routeAir(P) {
    var wires = [];
    AIR_NETS.forEach(function (n) {
      var a = P(n[1][0]);
      for (var i = 1; i < n[1].length; i++) wires.push({ net: n[0], pts: [a, P(n[1][i])], air: true });
    });
    return { wires: wires, dots: [] };
  }

  function routeCommon(P, wires, dots) {
    var M4d = P('M4.d'), M2d = P('M2.d'), Po = P('P_out.p');
    var yo = M4d[1] + 3;
    wires.push({ net: 'out', pts: [M4d, [M4d[0], yo], Po] });
    wires.push({ net: 'out', pts: [M2d, [M2d[0], yo]] });
    dots.push([M2d[0], yo, 'out']);
    var a = P('M1.s'), b = P('M2.s'), m = P('M5.d'), yt = a[1] + 2;
    wires.push({ net: 'tail', pts: [a, [a[0], yt], [b[0], yt], b] });
    wires.push({ net: 'tail', pts: [[m[0], yt], m] });
    dots.push([m[0], yt, 'tail']);
    wires.push({ net: 'vdd', pts: [P('M3.s'), P('VDD1.p')] });
    wires.push({ net: 'vdd', pts: [P('M4.s'), P('VDD2.p')] });
    wires.push({ net: 'inp', pts: [P('M1.g'), P('P_inp.p')] });
    wires.push({ net: 'inn', pts: [P('M2.g'), P('P_inn.p')] });
    wires.push({ net: 'vbias', pts: [P('M5.g'), P('P_vb.p')] });
    wires.push({ net: 'vss', pts: [P('M5.s'), P('GND.p')] });
  }

  function routeGrouped(P) {
    var wires = [], dots = [];
    var M3d = P('M3.d'), M1d = P('M1.d'), M3g = P('M3.g'), M4g = P('M4.g');
    var j1 = [M3d[0], M3d[1] + 1], j2 = [M3d[0], M3d[1] + 3];
    var xm = Math.round((M3d[0] + M4g[0]) / 2);
    wires.push({ net: 'x', pts: [M3d, M1d] });
    wires.push({ net: 'x', pts: [M3g, [M3g[0], j1[1]], j1] });
    wires.push({ net: 'x', pts: [M4g, [xm, M4g[1]], [xm, j2[1]], j2] });
    dots.push([j1[0], j1[1], 'x'], [j2[0], j2[1], 'x']);
    routeCommon(P, wires, dots);
    return { wires: wires, dots: dots };
  }

  function routeSym(P) {
    var wires = [], dots = [];
    var M3d = P('M3.d'), M1d = P('M1.d'), M3g = P('M3.g'), M4g = P('M4.g');
    var ja = [M3g[0] + 1, M3g[1]], jb = [M3d[0], M3d[1] + 2];
    wires.push({ net: 'x', pts: [M3d, M1d] });
    wires.push({ net: 'x', pts: [M3g, M4g] });
    wires.push({ net: 'x', pts: [ja, [ja[0], jb[1]], jb] });
    dots.push([ja[0], ja[1], 'x'], [jb[0], jb[1], 'x']);
    routeCommon(P, wires, dots);
    var a = P('M1.s'), m = P('M5.d');
    return {
      wires: wires, dots: dots,
      labels: [
        { text: 'x', at: [M1d[0] - 0.6, M1d[1] - 1.6], anchor: 'end', net: 'x', opt: true },
        { text: 'tail', at: [(a[0] + m[0]) / 2, a[1] + 1.1], anchor: 'middle', net: 'tail', opt: true },
        { text: 'out', at: [P('M4.d')[0] + 2.5, P('M4.d')[1] + 2.2], anchor: 'middle', net: 'out', opt: true }
      ]
    };
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  var TAG = { M1: [1, -0.6, 'start'], M2: [-1, -0.6, 'end'], M3: [-1, 3.4, 'end'], M4: [1, 3.4, 'start'], M5: [-2.6, 3.6, 'end'] };

  function boxes() {
    return [
      { id: 'dp1', kind: 'box', layer: 'back', ids: ['M1', 'M2'], pad: 1, label: '<zh>%dp1 · 差分对</zh><en>%dp1 · diff pair</en>', labelAt: [0.5, 1], anchor: 'middle' },
      { id: 'cm1', kind: 'box', layer: 'back', ids: ['M3', 'M4'], pad: 1, label: '<zh>%cm1 · 电流镜</zh><en>%cm1 · current mirror</en>', labelAt: [0.5, 0], anchor: 'middle' },
      { id: 'stage1', kind: 'box', layer: 'back', ids: ['M1', 'M2', 'M5'], pad: 2.4, label: '<zh>%stage1 · 输入级</zh><en>%stage1 · input stage</en>', labelAt: [0.03, 1], anchor: 'start' }
    ];
  }

  function intent(P, S, axisTone, axisX) {
    var L = [];
    var ax = axisX !== undefined ? axisX : (S('M1').x + S('M2').x) / 2;
    L.push({ id: 'ax', kind: 'vline', layer: 'back', x: ax, y0: 1.4, y1: 24.3, label: '%ax', tone: axisTone });
    var a = P('M1.s'), b = P('M2.s'), m = P('M5.d'), yt = a[1] + 2;
    var l1 = r1(m[0] - a[0]), l2 = r1(b[0] - m[0]);
    var eq = Math.abs(l1 - l2) < 0.05;
    L.push({
      id: 'c1', kind: 'ticks', y: yt, segs: [[a[0], m[0]], [m[0], b[0]]], labels: [String(l1), String(l2)],
      tone: eq ? undefined : 'err', mid: eq ? null : [m[0], yt - 1.25], midText: '≠'
    });
    L.push({ id: 'flow', kind: 'arrow', pts: [[3, 37.3], [12.5, 37.3]], label: '<zh>@FLOW 左→右</zh><en>@FLOW left→right</en>', labelAt: [3, 36], anchor: 'start' });
    var d5 = P('M5.d'), s5 = P('M5.s');
    L.push({ id: 'cur', kind: 'arrow', pts: [[d5[0] + 1.3, d5[1] + 0.7], [s5[0] + 1.3, s5[1] - 0.7]], label: 'I', labelAt: [d5[0] + 2, (d5[1] + s5[1]) / 2], anchor: 'start', mono: true, head: 0.42 });
    return L;
  }

  function tags(S, userId) {
    return ['M1', 'M2', 'M3', 'M4', 'M5'].map(function (id) {
      var st = S(id), o = TAG[id];
      return {
        id: 'tag-' + id, ref: id, kind: 'tag', at: [st.x + o[0], st.y + o[1]], anchor: o[2],
        text: '(' + Math.round(st.x) + ', ' + Math.round(st.y) + ')', tone: id === userId ? 'user' : undefined
      };
    });
  }

  function otaScene(stage) {
    var tbl = [L_AIR, L_GROUPED, L_SYM, L_SYM, L_TWEAK, L_RESOLVED][stage];
    var rk = stage === 0 ? 'air' : stage === 1 ? 'grouped' : 'sym';
    return {
      rk: rk,
      devices: layout(tbl),
      route: stage === 0 ? routeAir : stage === 1 ? routeGrouped : routeSym,
      overlays: function (P, S) {
        var L = [];
        if (stage === 1) L = L.concat(boxes());
        if (stage >= 2) L = L.concat(intent(P, S, stage === 4 ? 'mute' : undefined, stage === 4 ? (S('M3').x + S('M4').x) / 2 : undefined));
        if (stage >= 3) L = L.concat(tags(S, stage === 4 ? 'M2' : null));
        return L;
      }
    };
  }

  /* Step-by-step refinement: the full file at each step */
  function otaCode(stage) {
    var L = [];
    function add(id, t, r, extra) {
      var o = { id: id, t: t, r: r || '' };
      if (extra) for (var k in extra) o[k] = extra[k];
      L.push(o);
    }
    add('h0', '* 5T OTA');
    add('h1', '.model nch nmos level=1 vto=0.5');
    add('h2', '.model pch pmos level=1 vto=-0.5');
    add('h3', '.subckt ota5t inp inn out vdd vss vbias', 'P_inp P_inn P_out P_vb');
    add('m1', 'M1 x    inp   tail vss nch W=2u L=0.5u', 'M1');
    add('m2', 'M2 out  inn   tail vss nch W=2u L=0.5u', 'M2');
    add('m3', 'M3 x    x     vdd  vdd pch W=4u L=0.5u', 'M3');
    add('m4', 'M4 out  x     vdd  vdd pch W=4u L=0.5u', 'M4');
    add('m5', 'M5 tail vbias vss  vss nch W=4u L=1u', 'M5');
    if (stage >= 1) {
      add('u0', '* @RNL(source="user") {');
      add('u1', '*   Input pair, %dp1 = #M1(in_p) and #M2(in_n) are @AS $DIFFPAIR;', 'M1 M2 ov:dp1');
      add('u2', '*   the load, %cm1 = #M3(ref) and #M4(out) are @AS $CURRENT_MIRROR;', 'M3 M4 ov:cm1');
      add('u3', '*   %stage1 = %dp1(pair) and #M5(tail) form an @AS $INPUT_STAGE' + (stage >= 2 ? ';' : ''), 'M1 M2 M5 ov:stage1');
      if (stage >= 2) {
        add('u4', '*   %ax = <_, _>;', 'ov:ax');
        add('u5', '*   %sym12 = #M1(a) and #M2(b) about %ax(axis) @APPLY $MIRROR_PAIR;', 'M1 M2 ov:ax');
        add('u6', '*   %sym34 = #M3(a) and #M4(b) about %ax(axis) @APPLY $MIRROR_PAIR;', 'M3 M4 ov:ax');
        add('u7', '*   %c1 = #M1:s #M2:s #M5:d @APPLY $TAIL_CENTER;', 'M1 M2 M5 ov:c1');
        add('u8', '*   @FLOW(dir="left-to-right");', 'ov:flow');
        add('u9', '*   #M5:d #M5:s @CURRENT', 'M5 ov:cur');
      }
      add('u10', '* }');
    }
    if (stage >= 3) {
      var s5 = stage >= 5;
      add('s0', '* @RNL(source="solver", input="' + (s5 ? '9e27' : '4c1f') + '") {');
      add('s1', '*   #M1 @AT(' + (s5 ? 10 : 12) + ', 20);  #M2 @AT(' + (s5 ? 30 : 28) + ', 20) | @ORIENT("MY");', 'M1 M2');
      add('s2', '*   #M3 @AT(' + (s5 ? 10 : 12) + ', 8) | @ORIENT("MY");  #M4 @AT(' + (s5 ? 30 : 28) + ', 8);', 'M3 M4');
      add('s3', '*   #M5 @AT(20, 30);  %g0 = &vss @VIRTUAL $GND | @AT(20, 35);', 'M5 GND');
      add('s4', '*   &x @WIRE {#M3:d #M1:d};  &x @WIRE {#M3:g #M4:g};', 'net:x');
      add('s5', '<zh>*   /* 另有 11 条导线、2 个电源符号和 4 个端口，这里从略 */</zh><en>*   /* 11 more wires, 2 supply symbols and 4 ports omitted here */</en>');
      add('s6', '* }');
    }
    if (stage >= 4) {
      add('e0', '* @RNL(source="user") {');
      add('e1', '*   moved by hand, #M2 @AT(x=30)', 'M2');
      add('e2', '* }');
    }
    add('end', '.ends ota5t');
    return L;
  }

  /* "Who owns what" in section 01: one drawing, different annotations per mode */
  function ownerScene() {
    return {
      rk: 'sym',
      devices: layout(L_SYM),
      route: routeSym,
      overlays: function (P, S, B, mode) {
        if (mode === 'semantic') return boxes();
        if (mode === 'intent') return intent(P, S);
        if (mode === 'geometry') return tags(S, null);
        return [];
      }
    };
  }

  /* The edits-and-errors example: M2 moved right by hand, no %sym34 */
  function e5Scene() {
    return {
      rk: 'sym',
      devices: layout(L_TWEAK),
      route: routeSym,
      overlays: function (P, S) {
        var L = intent(P, S, 'ok');
        L = L.filter(function (o) { return o.id === 'ax' || o.id === 'c1'; });
        L.push({ id: 'tag-M2', ref: 'M2', kind: 'tag', at: [S('M2').x - 1, 19.4], anchor: 'end', text: '(30, 20)', tone: 'user' });
        L.push({ id: 'tag-M4', ref: 'M4', kind: 'tag', at: [29, 11.4], anchor: 'start', text: '(28, 8)', tone: 'mute' });
        return L;
      }
    };
  }

  var E5_LINES = [
    { t: '.subckt ota5t inp inn out vdd vss vbias' },
    { t: 'M1 x    inp   tail vss nch W=2u L=0.5u', r: 'M1' },
    { t: 'M2 out  inn   tail vss nch W=2u L=0.5u', r: 'M2' },
    { t: 'M3 x    x     vdd  vdd pch W=4u L=0.5u', r: 'M3' },
    { t: 'M4 out  x     vdd  vdd pch W=4u L=0.5u', r: 'M4' },
    { t: 'M5 tail vbias vss  vss nch W=4u L=1u', r: 'M5' },
    { t: '* @RNL(source="user") {' },
    { t: '*   Input pair, %dp1 = #M1(in_p) and #M2(in_n) are @AS $DIFFPAIR;', r: 'M1 M2', d: 'ok' },
    { t: '*   %ax = <_, _>;', r: 'ov:ax', d: 'ok' },
    { t: '*   %sym12 = #M1(a) and #M2(b) about %ax(axis) @APPLY $MIRROR_PAIR;', r: 'M1 M2 ov:ax', d: 'ok' },
    { t: '*   %c1 = #M1:s #M2:s #M5:d @APPLY $TAIL_CENTER;', r: 'M1 M2 M5 ov:c1', d: 'conflict' },
    { t: '*   {#M1 #M2 #M9} @ALIGN(axis="y")', cls: 'is-err', d: 'm9' },
    { t: '* }' },
    { t: '* @RNL(source="solver") {' },
    { t: '*   #M1 @AT(12, 20);  #M2 @AT(28, 20) | @ORIENT("MY");', r: 'M1 M2' },
    { t: '*   #M3 @AT(12, 8) | @ORIENT("MY");  #M4 @AT(28, 8);  #M5 @AT(20, 30)', r: 'M3 M4 M5', d: 'bad' },
    { t: '* }' },
    { t: '* @RNL(source="user") {' },
    { t: '*   moved by hand, #M2 @AT(x=30);', r: 'M2', d: 'conflict' },
    { t: '*   #M4 @AT(2O, 8)', r: 'M4', cls: 'is-err', d: 'bad' },
    { t: '* }' },
    { t: '.ends ota5t' }
  ];

  var E5_DIAG = [
    { k: 'err', id: 'm9', icon: 'cross', html: '<zh><code>{#M1 #M2 #M9} @ALIGN(axis="y")</code>：宿主里没有 M9。ALIGN 对输入是严格的，整句失效，不会退化成“只对齐 M1、M2”。</zh><en><code>{#M1 #M2 #M9} @ALIGN(axis="y")</code>: the host has no M9. ALIGN is strict about its inputs, so the whole statement fails; it does not fall back to “align only M1 and M2”.</en>', refs: [] },
    { k: 'err', id: 'bad', icon: 'cross', html: '<zh><code>#M4 @AT(2O, 8)</code>：“2O” 里是字母 O，不是合法的数。只丢掉这一句，M4 保留求解器给的 (28, 8)。</zh><en><code>#M4 @AT(2O, 8)</code>: “2O” contains the letter O, so it is not a valid number. Only this statement is dropped; M4 keeps the solver’s (28, 8).</en>', refs: ['M4'] },
    { k: 'warn', id: 'conflict', icon: 'warn', html: '<zh><code>#M2 @AT(x=30)</code> 让两个源极的中点不再对准 M5：按“新的优先”，保留新坐标，丢弃 <code>%c1</code> 展开出的匀布约束。</zh><en><code>#M2 @AT(x=30)</code> moves the midpoint of the two sources off M5. Newer wins, so the new coordinate is kept and the distribute constraint expanded from <code>%c1</code> is dropped.</en>', refs: ['M2', 'M5', 'ov:c1'] },
    { k: 'info', id: 'fp', icon: 'info', html: '<zh>输入指纹与求解时不符：求解之后语义改过了，查看器建议重新求解。旧结果照常显示。</zh><en>The input fingerprint does not match the one used for solving: the semantics changed after solving, so the viewer suggests solving again. The old result still displays.</en>', refs: [] },
    { k: 'ok', id: 'ok', icon: 'check', html: '<zh>其余照常生效：差分对，对称（对称轴是自由点，跟着移到 x = 21），其他坐标。</zh><en>Everything else takes effect: the differential pair, the symmetry (the axis is a free point and moves to x = 21), the other coordinates.</en>', refs: ['M1', 'M2', 'ov:ax'] }
  ];

  /* ================= Hero: RC low-pass ================= */

  var RC = {
    rk: 'rc',
    viewBox: [0.5, 0.6, 23.6, 17.8],
    devices: {
      V1: { sym: 'vac', x: 4, y: 10, label: 'V1', value: 'AC 1' },
      R1: { sym: 'res', x: 11, y: 4, o: 'R270', label: 'R1', value: '10k', lab: [-0.25, -1.9, 'end'], val: [0.25, -1.9, 'start'] },
      C1: { sym: 'cap', x: 18, y: 10, label: 'C1', value: '10n' },
      G: { sym: 'gnd', x: 11, y: 15, virtual: true }
    },
    route: function (P) {
      var v1p = P('V1.p'), r1p = P('R1.p'), r1n = P('R1.n'), c1p = P('C1.p'), v1n = P('V1.n'), c1n = P('C1.n'), g = P('G.p');
      return {
        wires: [
          { net: 'in', pts: [v1p, [v1p[0], r1p[1]], r1p] },
          { net: 'out', pts: [r1n, [c1p[0], r1n[1]], c1p] },
          { net: '0', pts: [v1n, [v1n[0], g[1]], [c1n[0], g[1]], c1n] }
        ],
        dots: [[g[0], g[1], '0']],
        labels: [{ text: 'out', at: [16, 3.15], net: 'out' }]
      };
    },
    overlays: function (P, S, B, mode) {
      if (mode !== 'chain') return [];
      return [{ id: 'chain', kind: 'arrow', pts: [[5.6, 8.4], [5.6, 5.7], [16.4, 5.7], [16.4, 8.4]], label: 'source → series → load', labelAt: [11, 6.95], anchor: 'middle', mono: true }];
    }
  };

  var HERO_LINES = [
    { t: '* RC low-pass filter', sim: 'title', view: 'skip', note: '<zh>第一行是标题。SPICE 把文件第一行当作标题，不属于电路。</zh><en>The first line is the title. SPICE treats a file’s first line as its title, not as part of the circuit.</en>' },
    { t: 'V1 in 0 AC 1', r: 'V1', sim: 'use', view: 'draw', note: '<zh><b>网表</b>：信号源 V1 接在 in 与地之间，交流幅度 1 V。</zh><en><b>Netlist</b>: source V1 between in and ground, AC amplitude 1 V.</en>' },
    { t: 'R1 in out 10k', r: 'R1', sim: 'use', view: 'draw', note: '<zh><b>网表</b>：10 kΩ 电阻，从 in 接到 out。</zh><en><b>Netlist</b>: a 10 kΩ resistor from in to out.</en>' },
    { t: 'C1 out 0 10n', r: 'C1', sim: 'use', view: 'draw', note: '<zh><b>网表</b>：10 nF 电容，从 out 接到地。</zh><en><b>Netlist</b>: a 10 nF capacitor from out to ground.</en>' },
    { t: '.ac dec 20 10 1meg', cls: 'is-analysis', sim: 'use', view: 'skip', plot: true, note: '<zh><b>仿真指令</b>：从 10 Hz 扫到 1 MHz。查看器画图用不到它。</zh><en><b>Simulation command</b>: sweep from 10 Hz to 1 MHz. The viewer does not need it to draw.</en>' },
    { t: '* @RNL {', sim: 'skip', view: 'meta', note: '<zh><b>RNL 记录开始</b>。仿真器眼里，这只是一行以 * 开头的注释。</zh><en><b>Start of an RNL record</b>. To the simulator, this is just a comment line starting with *.</en>' },
    { t: '*   Source to load, #V1 #R1 #C1 @AS $CHAIN;', r: 'V1 R1 C1 ov:chain', mode: 'chain', sim: 'skip', view: 'draw', note: '<zh><b>RNL</b>：V1、R1、C1 是一条从源到负载的链。于是源放左边、负载放右边，两端竖放。“Source to load,” 只是给人看的说明。</zh><en><b>RNL</b>: V1, R1 and C1 form a chain from source to load. So the source goes on the left, the load on the right, both ends upright. “Source to load,” is only a note for people.</en>' },
    { t: '*   %g = &0 @VIRTUAL $GND;', r: 'G', sim: 'skip', view: 'draw', note: '<zh><b>RNL</b>：给地网络 0 画一个地符号。它只为显示而存在，电路里并没有这个元件。</zh><en><b>RNL</b>: draw a ground symbol for ground net 0. It exists only for display; there is no such element in the circuit.</en>' },
    { t: '*   &out @LABEL', r: 'net:out', sim: 'skip', view: 'draw', note: '<zh><b>RNL</b>：在图上标出网络名 out。</zh><en><b>RNL</b>: label net out in the drawing.</en>' },
    { t: '* }', sim: 'skip', view: 'meta', note: '<zh><b>RNL 记录结束</b>。</zh><en><b>End of the RNL record</b>.</en>' },
    { t: '.end', sim: 'use', view: 'skip', note: '<zh>网表结束。</zh><en>End of the netlist.</en>' }
  ];

  /* ================= Example 1: RLC, one statement ================= */

  function rlcScene(style) {
    var dev = {
      V1: { sym: 'vac', x: 3, y: 10, label: 'V1', value: 'AC 1' },
      R1: { sym: 'res', x: 9, y: 4, o: 'R270', label: 'R1', value: '50', lab: [-0.25, -1.9, 'end'], val: [0.25, -1.9, 'start'] },
      L1: { sym: 'ind', x: 17, y: 4, o: 'R270', label: 'L1', value: '1m', lab: [-0.25, -1.9, 'end'], val: [0.25, -1.9, 'start'] },
      C1: { sym: 'cap', x: 23, y: 10, label: 'C1', value: '100n' }
    };
    if (style === 'split') {
      dev.G1 = { sym: 'gnd', x: 3, y: 15, virtual: true };
      dev.G2 = { sym: 'gnd', x: 23, y: 15, virtual: true };
    } else {
      dev.G = { sym: 'gnd', x: 13, y: 15, virtual: true };
    }
    return {
      rk: 'rlc-' + style,
      viewBox: [-0.5, 0.6, 29, 17.8],
      devices: dev,
      route: function (P) {
        var v1p = P('V1.p'), r1p = P('R1.p'), c1p = P('C1.p'), v1n = P('V1.n'), c1n = P('C1.n');
        var w = [
          { net: 'in', pts: [v1p, [v1p[0], r1p[1]], r1p] },
          { net: 'mid', pts: [P('R1.n'), P('L1.p')] },
          { net: 'out', pts: [P('L1.n'), [c1p[0], P('L1.n')[1]], c1p] }
        ];
        var dots = [];
        if (style === 'split') {
          w.push({ net: '0', pts: [v1n, P('G1.p')] });
          w.push({ net: '0', pts: [c1n, P('G2.p')] });
        } else {
          var g = P('G.p');
          w.push({ net: '0', pts: [v1n, [v1n[0], g[1]], [c1n[0], g[1]], c1n] });
          dots.push([g[0], g[1], '0']);
        }
        return { wires: w, dots: dots, labels: [{ text: 'mid', at: [13, 3.15], net: 'mid' }, { text: 'out', at: [21.5, 3.15], net: 'out' }] };
      },
      overlays: function (P, S, B, mode) {
        if (mode !== 'chain') return [];
        return [{ id: 'chain', kind: 'arrow', pts: [[4.6, 8.4], [4.6, 5.7], [21.4, 5.7], [21.4, 8.4]], label: 'source → series{R1 L1} → load', labelAt: [13, 6.95], anchor: 'middle', mono: true }];
      }
    };
  }

  var E1_LINES = [
    { t: '* RLC low-pass' },
    { t: 'V1 in 0 AC 1', r: 'V1' },
    { t: 'R1 in mid 50', r: 'R1' },
    { t: 'L1 mid out 1m', r: 'L1' },
    { t: 'C1 out 0 100n', r: 'C1' },
    { t: '* @RNL {' },
    { t: '*   Source to load, #V1 {#R1 #L1} #C1 @AS $CHAIN', r: 'V1 R1 L1 C1 ov:chain', mode: 'chain' },
    { t: '* }' },
    { t: '.end' }
  ];

  /* ================= Example 2: testbench and block symbol ================= */

  var TB = {
    rk: 'tb',
    viewBox: [-0.6, 1.4, 39.4, 29.4],
    devices: {
      XU1: { sym: 'block', x: 20, y: 14, label: 'XU1' },
      VIP: { sym: 'vsrc', x: 6, y: 15, label: 'VIP', value: 'DC 0.9', lab: [-2.2, -0.7, 'end'], val: [-2.2, 0.8, 'end'] },
      VIN: { sym: 'vsrc', x: 10, y: 19, label: 'VIN', value: 'DC 0.9' },
      VB: { sym: 'vsrc', x: 17, y: 23, label: 'VB', value: '0.6', lab: [-2.2, -0.7, 'end'], val: [-2.2, 0.8, 'end'] },
      VDD: { sym: 'vsrc', x: 33, y: 10, label: 'VDD', value: '1.8' },
      CL: { sym: 'cap', x: 29, y: 17, label: 'CL', value: '1p' },
      G1: { sym: 'gnd', x: 6, y: 20, virtual: true },
      G2: { sym: 'gnd', x: 10, y: 24, virtual: true },
      G3: { sym: 'gnd', x: 17, y: 28, virtual: true },
      G4: { sym: 'gnd', x: 21, y: 20, virtual: true },
      G5: { sym: 'gnd', x: 33, y: 15, virtual: true },
      G6: { sym: 'gnd', x: 29, y: 22, virtual: true }
    },
    route: function (P) {
      var vd = P('XU1.vdd'), vs = P('VDD.p');
      return {
        wires: [
          { net: 'inp', pts: [P('VIP.p'), P('XU1.inp')] },
          { net: 'inn', pts: [P('VIN.p'), P('XU1.inn')] },
          { net: 'vb', pts: [P('XU1.vbias'), P('VB.p')] },
          { net: 'vdd', pts: [vd, [vd[0], vs[1]], vs] },
          { net: 'out', pts: [P('XU1.out'), P('CL.p')] },
          { net: '0', pts: [P('VIP.n'), P('G1.p')] },
          { net: '0', pts: [P('VIN.n'), P('G2.p')] },
          { net: '0', pts: [P('VB.n'), P('G3.p')] },
          { net: '0', pts: [P('XU1.vss'), P('G4.p')] },
          { net: '0', pts: [P('VDD.n'), P('G5.p')] },
          { net: '0', pts: [P('CL.n'), P('G6.p')] }
        ],
        dots: [],
        labels: [
          { text: 'inp', at: [10.5, 11.2], net: 'inp' }, { text: 'inn', at: [12.5, 15.2], net: 'inn' },
          { text: 'vdd', at: [26, 6.2], net: 'vdd' }, { text: 'out', at: [27, 13.2], net: 'out' }
        ]
      };
    },
    overlays: function () {
      return [{ id: 'note', kind: 'text', at: [0.4, 3.2], text: '5T OTA testbench', anchor: 'start', tone: 'mute', mono: true }];
    }
  };

  var E2_LINES = [
    { t: '* 5T OTA testbench' },
    { t: '.subckt ota5t inp inn out vdd vss vbias' },
    { t: '<zh>* (M1 ... M5 与前面相同，从略)</zh><en>* (M1 ... M5 as before, omitted)</en>' },
    { t: '* @RNL {', r: 'XU1' },
    { t: '*   %ota5t = @SYMBOL(export="block", box=[-5, -5, 5, 5]) {', r: 'XU1' },
    { t: '*     <-5, -2> @PIN(term="inp");  <-5, 2> @PIN(term="inn");', r: 'XU1 net:inp net:inn' },
    { t: '*     <5, 0> @PIN(term="out");  <-1, -3> @PIN(term="vdd");', r: 'XU1 net:out net:vdd' },
    { t: '*     <1, 2> @PIN(term="vss");  <-3, 4> @PIN(term="vbias");', r: 'XU1 net:vb' },
    { t: '*     @POLYGON {<-5, -5> <-5, 5> <5, 0>};', r: 'XU1' },
    { t: '*     <-1.4, 0> @TEXT(field="name")', r: 'XU1' },
    { t: '*   }', r: 'XU1' },
    { t: '* }', r: 'XU1' },
    { t: '.ends ota5t' },
    { t: 'XU1 inp inn out vdd 0 vb ota5t', r: 'XU1' },
    { t: 'VDD vdd 0 1.8', r: 'VDD G5' },
    { t: 'VB  vb  0 0.6', r: 'VB G3' },
    { t: 'VIP inp 0 DC 0.9 AC 0.5', r: 'VIP G1' },
    { t: 'VIN inn 0 DC 0.9 AC 0.5 180', r: 'VIN G2' },
    { t: 'CL  out 0 1p', r: 'CL G6' },
    { t: '* @RNL {' },
    { t: '*   #XU1 @AT(20, 14);', r: 'XU1' },
    { t: '*   %n1 = @NOTE(text="5T OTA testbench") | @AT(1, 3)', r: 'ov:note' },
    { t: '* }' },
    { t: '.end' }
  ];

  /* ================= Example 3: custom symbol ================= */

  var E3_LINES = [
    { t: '* @RNL {' },
    { t: '*   $NMOS = @SYMBOL(box=[-3, -3, 0.4, 3]) {', r: 'box' },
    { t: '*     %d = <0, -3> @PIN(term="d", name="D", dir="N");', r: 'pin-d' },
    { t: '*     %g = <-3, 0> @PIN(term="g", name="G", dir="W");', r: 'pin-g' },
    { t: '*     %s = <0, 3> @PIN(term="s", name="S", dir="S");', r: 'pin-s' },
    { t: '*     @LINE {%g <-1.2, 0>};', r: 'l1' },
    { t: '*     @LINE(weight="emphasis") {<-1.2, -1.3> <-1.2, 1.3>};', r: 'l2' },
    { t: '*     @LINE(weight="emphasis") {<-0.6, -1.6> <-0.6, 1.6>};', r: 'l3' },
    { t: '*     @LINE {<-0.6, -1.1> <0, -1.1> %d};', r: 'l4' },
    { t: '*     @LINE {<-0.6, 1.1> <0, 1.1> %s};', r: 'l5' },
    { t: '*     @POLYGON(fill="foreground") {<0, 1.1> <-0.5, 0.8> <-0.5, 1.4>};', r: 'poly' },
    { t: '*     <1, -2> @TEXT(field="name")', r: 'text' },
    { t: '*   };', r: 'box' },
    { t: '*   @SELECT_INST(model="nch") | @APPEAR $NMOS', r: 'rule' },
    { t: '* }' }
  ];

  var E3_NOTES = {
    box: '<zh><b>@SYMBOL</b> 把大括号里的图元收成一个定义。<code>box</code> 是选择框，也是求解时的防重叠轮廓。</zh><en><b>@SYMBOL</b> gathers the primitives in braces into one definition. <code>box</code> is the selection box, and also the outline the solver keeps other objects out of.</en>',
    'pin-d': '<zh><b>引脚</b>是带端子绑定的点：<code>term="d"</code> 对应网表里 MOS 的漏极，<code>dir="N"</code> 是出线方向，<code>name</code> 只用于显示。</zh><en>A <b>pin</b> is a point bound to a terminal: <code>term="d"</code> maps to the MOS drain in the netlist, <code>dir="N"</code> is the direction wires leave in, and <code>name</code> is for display only.</en>',
    'pin-g': '<zh>栅极引脚，出线朝西（左）。</zh><en>Gate pin; wires leave to the west (left).</en>',
    'pin-s': '<zh>源极引脚，出线朝南（下）。衬底不想画，就不写它的引脚。</zh><en>Source pin; wires leave to the south (down). To leave the bulk undrawn, just give it no pin.</en>',
    l1: '<zh><b>@LINE</b> 收一组点：两个点是线段，更多是折线。这里从栅极引脚 %g 画到栅极板。</zh><en><b>@LINE</b> takes a list of points: two make a segment, more make a polyline. This one runs from gate pin %g to the gate plate.</en>',
    l2: '<zh>线宽写成<b>角色</b> <code>emphasis</code>，具体多粗由样式决定，换主题不用改符号。</zh><en>The line weight is written as a <b>role</b>, <code>emphasis</code>; the style decides how thick it is, so a new theme needs no symbol changes.</en>',
    l3: '<zh>沟道，同样是加粗的角色线。</zh><en>The channel, another emphasized role line.</en>',
    l4: '<zh>漏极的连线，终点是引脚 %d。</zh><en>The drain lead, ending at pin %d.</en>',
    l5: '<zh>源极的连线。</zh><en>The source lead.</en>',
    poly: '<zh><b>@POLYGON</b> 自动闭合；<code>fill="foreground"</code> 表示用前景色填充：这是 NMOS 的箭头。</zh><en><b>@POLYGON</b> closes itself; <code>fill="foreground"</code> fills it with the foreground color: this is the NMOS arrow.</en>',
    text: '<zh><b>@TEXT</b> 是文字槽：显示器件名（field="name"）。</zh><en><b>@TEXT</b> is a text slot: it shows the device name (field="name").</en>',
    rule: '<zh>一条<b>规则</b>：所有模型为 nch 的器件都用这个符号。写在哪一层，就管那一层及其下层。</zh><en>A <b>rule</b>: every device whose model is nch uses this symbol. It applies to the level it is written on and every level below.</en>',
    idle: '<zh>把鼠标放到左边任意一行上，看它对应符号里的哪一笔。</zh><en>Hover over any line on the left to see which stroke of the symbol it draws.</en>'
  };

  /* ================= Example 4: rules and fill-ins ================= */

  function fillScene(n) {
    var dev = {
      V1: { sym: 'vsrc', x: 0, y: 10, label: 'V1', value: '1.8', lab: [-2.2, -0.7, 'end'], val: [-2.2, 0.8, 'end'] },
      R1: { sym: 'res', x: 10, y: 6, label: 'R1', value: '10k' },
      M1: { sym: 'nmos', x: 10, y: 14, label: 'M1' },
      C1: { sym: 'cap', x: 18, y: 14, label: 'C1', value: '1p' },
      Gv: { sym: 'gnd', x: 0, y: 16, virtual: true }
    };
    if (n >= 1) dev.Gc = { sym: 'gnd', x: 18, y: 19, virtual: true, cls: 'is-gen' };
    if (n >= 2) dev.Gm = { sym: 'gnd', x: 10, y: 19, virtual: true, cls: 'is-gen' };
    if (n >= 3) dev.Pin = { sym: 'port', x: 5, y: 14, label: 'in', virtual: true, cls: 'is-gen' };
    return {
      rk: 'fill' + n,
      viewBox: [-5, 0.3, 28, 21.4],
      devices: dev,
      route: function (P) {
        var w = [
          { net: 'vdd', pts: [P('V1.p'), [0, 2], [10, 2], P('R1.p')] },
          { net: 'out', pts: [P('R1.n'), P('M1.d')] },
          { net: 'out', pts: [[10, 10], [18, 10], P('C1.p')] },
          { net: '0', pts: [P('V1.n'), P('Gv.p')] }
        ];
        if (n >= 1) w.push({ net: '0', pts: [P('C1.n'), P('Gc.p')], cls: 'is-gen' });
        if (n >= 2) w.push({ net: '0', pts: [P('M1.s'), P('Gm.p')], cls: 'is-gen' });
        if (n >= 3) w.push({ net: 'in', pts: [P('M1.g'), P('Pin.p')], cls: 'is-gen' });
        return { wires: w, dots: [[10, 10, 'out']], labels: [{ text: 'vdd', at: [5, 1.2], net: 'vdd' }, { text: 'out', at: [14, 9.2], net: 'out' }] };
      },
      overlays: function () {
        return [{ id: 'skip', kind: 'text', at: [0, 19.8], text: '<zh>已手动接地</zh><en>hand-placed</en>', anchor: 'middle', tone: 'mute' }];
      }
    };
  }

  var E4_LINES = [
    { t: '<zh>* 补位：给没接导线的端子逐个补上地和端口</zh><en>* Fill-ins: add a ground or a port to each unwired terminal</en>' },
    { t: 'V1 vdd 0 1.8', r: 'V1' },
    { t: 'R1 vdd out 10k', r: 'R1' },
    { t: 'M1 out in 0 0 nch', r: 'M1' },
    { t: 'C1 out 0 1p', r: 'C1' },
    { t: '* @RNL(source="user") {' },
    { t: '*   $PORT_STUB = @PATTERN(["t"]) {', r: 'Pin' },
    { t: '*     %p = ?t::net @VIRTUAL $IOPORT;', r: 'Pin' },
    { t: '*     ?t::net @WIRE {%p:p ?t};', r: 'Pin net:in' },
    { t: '*     {?t %p:p} @ALIGN(axis="y");', r: 'Pin' },
    { t: '*     %p:p ?t @DISTANCE(axis="x", mode="signed", min=2, max=2)', r: 'Pin' },
    { t: '*   };', r: 'Pin' },
    { t: '*   %gnds = @SELECT_TERM(net="0", wired=false) | @APPLY $GND_STUB;', r: 'Gc Gm', gen: 'gnd' },
    { t: '*   %ports = @SELECT_TERM(pin="g", wired=false) | @APPLY $PORT_STUB', r: 'Pin net:in', gen: 'port' },
    { t: '* }' },
    { t: '* @RNL(source="editor") {' },
    { t: '*   #V1 @AT(0, 10);  #R1 @AT(10, 6);  #M1 @AT(10, 14);  #C1 @AT(18, 14);', r: 'V1 R1 M1 C1' },
    { t: '*   &vdd @WIRE {#V1:p <0, 2> <10, 2> #R1:p};', r: 'net:vdd' },
    { t: '*   &out @WIRE {#R1:n #M1:d};  &out @WIRE {<10, 10> <18, 10> #C1:p};', r: 'net:out' },
    { t: '*   <10, 10> @JUNCTION;', r: 'net:out' },
    { t: '*   %g_v1 = &0 @VIRTUAL $GND | @AT(0, 16);  &0 @WIRE {#V1:n %g_v1:p}', r: 'Gv ov:skip' },
    { t: '* }' },
    { t: '.end' }
  ];

  global.RNLScenes = {
    OTA_VB: OTA_VB,
    otaScene: otaScene,
    otaCode: otaCode,
    ownerScene: ownerScene,
    e5Scene: e5Scene,
    E5_LINES: E5_LINES,
    E5_DIAG: E5_DIAG,
    RC: RC,
    HERO_LINES: HERO_LINES,
    rlcScene: rlcScene,
    E1_LINES: E1_LINES,
    TB: TB,
    E2_LINES: E2_LINES,
    E3_LINES: E3_LINES,
    E3_NOTES: E3_NOTES,
    fillScene: fillScene,
    E4_LINES: E4_LINES
  };
})(window);
