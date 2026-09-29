/* RNL 介绍页 · 交互逻辑 */
(function () {
  'use strict';

  var S = window.RNLSchem, SC = window.RNLScenes, C = window.RNLCode;
  var REDUCE = S.REDUCE;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function icon(name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { /* 存储不可用时忽略 */ }
    return null;
  }
  function debounce(fn, ms) {
    var t = null;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
  function onVisible(el, cb, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { cb(e.isIntersecting); });
    }, { threshold: threshold || 0.2 });
    io.observe(el);
  }
  function setPressed(buttons, active) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === active ? 'true' : 'false'); });
  }

  /* 静态代码片段着色：data-hl 属性 */
  function paintStatic(root) {
    $$('[data-hl]', root).forEach(function (el) {
      var t = el.getAttribute('data-hl');
      var html;
      if (/^\s*[#&%$@{<?]/.test(t)) {
        html = C.hlSnippet(t);
      } else {
        html = C.hlFile(t.split('\n')).map(function (h) { return h.html; }).join('\n');
      }
      var keep = el.innerHTML;
      el.innerHTML = html + keep;
    });
  }

  /* ================= 配色与导航 ================= */

  function initTheme() {
    var btn = $('#theme-btn');
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function effective() {
      var t = document.documentElement.getAttribute('data-theme');
      if (t) return t;
      return mq && mq.matches ? 'dark' : 'light';
    }
    function paint() {
      var dark = effective() === 'dark';
      btn.innerHTML = icon(dark ? 'sun' : 'moon');
      btn.setAttribute('aria-label', dark ? '切换到浅色' : '切换到深色');
    }
    btn.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store('rnl-intro-theme', next);
      paint();
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', paint);
    paint();
  }

  function initNav() {
    var links = $$('.toc a');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove('is-on'); });
          var a = map[e.target.id];
          if (a) a.classList.add('is-on');
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      Object.keys(map).forEach(function (id) {
        var s = document.getElementById(id);
        if (s) io.observe(s);
      });
    }
    var bar = $('#progress-bar');
    function onScroll() {
      var h = document.documentElement;
      var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    var tb = $('#toc-btn'), toc = $('#toc');
    tb.addEventListener('click', function () {
      var open = toc.classList.toggle('is-open');
      tb.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.forEach(function (a) {
      a.addEventListener('click', function () {
        toc.classList.remove('is-open');
        tb.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ================= 首屏 ================= */

  function drawBode(svg) {
    var el = S.el, W = 340, H = 220, m = { l: 40, r: 12, t: 24, b: 32 };
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.classList.add('bode');
    var fc = 1 / (2 * Math.PI * 10e3 * 10e-9);
    function X(f) { return m.l + (Math.log10(f) - 1) / 5 * (W - m.l - m.r); }
    function Y(db) { return m.t + (-db / 60) * (H - m.t - m.b); }
    var g = el('g', null, svg);
    var names = ['10', '100', '1k', '10k', '100k', '1M'];
    for (var d = 1; d <= 6; d++) {
      if (d < 6) {
        for (var k = 2; k <= 9; k++) {
          var xm = X(k * Math.pow(10, d));
          el('line', { class: 'bd-minor', x1: xm, x2: xm, y1: m.t, y2: H - m.b }, g);
        }
      }
      var x = X(Math.pow(10, d));
      el('line', { class: 'bd-grid', x1: x, x2: x, y1: m.t, y2: H - m.b }, g);
      el('text', { class: 'bd-t', x: x, y: H - m.b + 15, 'text-anchor': 'middle' }, g).textContent = names[d - 1];
    }
    [0, -20, -40, -60].forEach(function (db) {
      var y = Y(db);
      el('line', { class: 'bd-grid', x1: m.l, x2: W - m.r, y1: y, y2: y }, g);
      el('text', { class: 'bd-t', x: m.l - 6, y: y + 3.5, 'text-anchor': 'end' }, g).textContent = db;
    });
    el('text', { class: 'bd-t', x: m.l - 6, y: m.t - 10, 'text-anchor': 'end' }, g).textContent = 'dB';
    el('text', { class: 'bd-t', x: W - m.r, y: H - 3, 'text-anchor': 'end' }, g).textContent = 'Hz';
    var pts = [];
    for (var i = 0; i <= 240; i++) {
      var f = Math.pow(10, 1 + 5 * i / 240);
      pts.push([X(f), Y(-10 * Math.log10(1 + Math.pow(f / fc, 2)))]);
    }
    el('path', { class: 'bd-curve', d: S.pathOf(pts) }, g);
    var xc = X(fc), yc = Y(-3.01);
    el('line', { class: 'bd-mark', x1: xc, x2: xc, y1: yc, y2: H - m.b }, g);
    el('circle', { class: 'bd-pt', cx: xc, cy: yc, r: 3.4 }, g);
    var lab = el('text', { class: 'bd-lab', x: xc + 8, y: yc - 7 }, g);
    lab.appendChild(document.createTextNode('f'));
    var sub = el('tspan', { 'baseline-shift': 'sub', 'font-size': '75%' }, lab);
    sub.textContent = 'c';
    lab.appendChild(document.createTextNode(' = 1.59 kHz, −3 dB'));
    el('text', { class: 'bd-t', x: m.l + 4, y: H - m.b - 6 }, g).textContent = '|V(out)|';
    return svg;
  }

  function initHero() {
    var code = $('#hero-code');
    var lines = SC.HERO_LINES;
    var rows = C.render(code, lines);
    rows.forEach(function (r) { r.setAttribute('tabindex', '0'); r.classList.add('is-link'); });
    var view = new S.View($('#hero-svg'), { viewBox: SC.RC.viewBox });
    view.setScene(SC.RC);
    var plot = drawBode($('#hero-plot'));
    var note = $('#hero-note-text'), simChip = $('#hero-sim-chip'), viewChip = $('#hero-view-chip');
    var IDLE = '同一个文件，两位读者各取所需。把鼠标放到文件的任意一行上看看；不动的时候，它会自己逐行演示。';
    var SIM = { use: ['chip chip-ok', '读取这一行'], skip: ['chip chip-mute', '当作注释跳过'], title: ['chip chip-mute', '当作标题'] };
    var VIEW = { draw: ['chip chip-rnl', '据此作图'], meta: ['chip chip-rnl', '记录边界'], skip: ['chip chip-mute', '用不到这一行'] };

    function show(i) {
      rows.forEach(function (r) { r.classList.remove('is-hot'); });
      if (i < 0) {
        view.setMode(null);
        view.highlight(null);
        plot.classList.remove('is-hot');
        note.innerHTML = IDLE;
        simChip.className = 'chip'; simChip.textContent = '只读网表';
        viewChip.className = 'chip chip-rnl'; viewChip.textContent = '网表 + RNL';
        return;
      }
      var l = lines[i];
      rows[i].classList.add('is-hot');
      view.setMode(l.mode || null);
      view.highlight(l.r ? l.r.split(' ') : null);
      plot.classList.toggle('is-hot', l.sim === 'use' && (!!l.plot || !!l.r));
      note.innerHTML = l.note;
      simChip.className = SIM[l.sim][0]; simChip.textContent = SIM[l.sim][1];
      viewChip.className = VIEW[l.view][0]; viewChip.textContent = VIEW[l.view][1];
    }

    var idx = -1, hover = false, visible = false;
    function step() {
      if (hover || !visible || document.hidden) return;
      idx = (idx + 1) % lines.length;
      show(idx);
    }
    if (!REDUCE) setInterval(step, 2600);
    onVisible($('#hero-demo'), function (v) { visible = v; }, 0.3);
    function pick(e) {
      var r = e.target.closest ? e.target.closest('.cl') : null;
      if (!r) return;
      hover = true;
      idx = +r.getAttribute('data-i');
      show(idx);
    }
    code.addEventListener('mouseover', pick);
    code.addEventListener('focusin', pick);
    code.addEventListener('mouseleave', function () { hover = false; });
    code.addEventListener('focusout', function () { hover = false; });
    show(-1);

    var demo = $('#hero-demo');
    var btns = $$('#hero-mode button');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        setPressed(btns, b);
        var m = b.getAttribute('data-mode');
        code.classList.toggle('sim-mode', m === 'sim');
        code.classList.toggle('view-mode', m === 'view');
        demo.classList.toggle('focus-sim', m === 'sim');
        demo.classList.toggle('focus-view', m === 'view');
        note.innerHTML = m === 'sim'
          ? '<b>仿真器眼里</b>：划掉的几行以 * 开头，只是注释，直接跳过。剩下的就是一份普通的网表。'
          : m === 'view'
            ? '<b>RNL 工具眼里</b>：网表给出器件和连接，注释里的 RNL 给出结构与画法；.ac 这样的仿真指令它用不到。'
            : IDLE;
      });
    });
  }

  /* ================= 01 谁管什么 ================= */

  function initOwners() {
    var svg = $('#own-svg');
    var view = new S.View(svg, { viewBox: SC.OTA_VB });
    view.setScene(SC.ownerScene());
    var cap = $('#own-cap');
    var DEFAULT = '左边四项来自网表，是电路本身；右边四项写在 RNL 里，只负责理解和呈现。<b>悬停或点击</b>某一项，看它对应图里的哪一部分。';
    var DEV = ['M1', 'M2', 'M3', 'M4', 'M5'];
    var MODES = {
      devices: { hl: DEV, cap: '<b>器件与类型</b>：M1–M5 是网表里的五个 MOS 管。它们叫什么、是什么管子，只由网表决定。' },
      params: { hl: DEV, cls: 'show-values', cap: '<b>参数</b>：W、L 等数值留在网表里。RNL 可以引用它们来显示标签，但不保存第二份。' },
      nets: { cls: 'color-nets show-nets', cap: '<b>连接关系</b>：每种颜色是一个网络。哪些端子接在一起完全来自网表；导线怎么画可以变，连接不会变。' },
      ports: { hl: ['P_inp', 'P_inn', 'P_out', 'P_vb'], cap: '<b>子电路接口</b>：inp、inn、out、vbias 这些端口由 .subckt 那一行定义。' },
      semantic: { mode: 'semantic', cap: '<b>结构</b>：M1、M2 是差分对，M3、M4 是电流镜，它们和 M5 一起组成输入级。这是写在 RNL 里的三句话。' },
      intent: { mode: 'intent', cap: '<b>意图</b>：关于中轴对称、尾管居中（两段一样长）、信号从左到右、M5 的电流方向。' },
      geometry: { mode: 'geometry', cls: 'color-none', cap: '<b>画法</b>：每个器件的位置和朝向、每段导线的路径。可以自己写，也可以交给求解器写回。' },
      virtual: { hl: ['VDD1', 'VDD2', 'GND'], cap: '<b>显示元素</b>：电源和地符号只为显示而存在，电气上并不是元件。它们关联到网络，但不产生连接。' }
    };
    var buttons = $$('#owners .own button');
    var pinned = null;
    function apply(key) {
      svg.classList.remove('show-values', 'color-nets', 'show-nets');
      buttons.forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-own') === key); });
      var m = key ? MODES[key] : null;
      view.setMode(m && m.mode ? m.mode : null);
      view.highlight(m && m.hl ? m.hl : null);
      if (m && m.cls) m.cls.split(' ').forEach(function (c) { if (c !== 'color-none') svg.classList.add(c); });
      cap.innerHTML = m ? m.cap : DEFAULT;
    }
    buttons.forEach(function (b) {
      var key = b.getAttribute('data-own');
      b.addEventListener('mouseenter', function () { apply(key); });
      b.addEventListener('focus', function () { apply(key); });
      b.addEventListener('click', function () {
        pinned = pinned === key ? null : key;
        b.setAttribute('aria-pressed', pinned === key ? 'true' : 'false');
        apply(pinned || key);
      });
    });
    $('#owners').addEventListener('mouseleave', function () { apply(pinned); });
    apply(null);
  }

  /* ================= 02 补救办法里的缩略图 ================= */

  function initFixes() {
    var v = new S.View($('#fix-air'), { viewBox: SC.OTA_VB, grid: false });
    v.setScene(SC.otaScene(0));
  }

  /* ================= 03 愿景：中心文件与连线 ================= */

  function initHub() {
    var hub = $('#hub'), svg = $('#hub-wires'), core = $('#hub-core');
    var lines = $('#hub-lines');
    lines.innerHTML = C.hlFile([
      'M1 x inp tail vss nch W=2u L=0.5u',
      '* @RNL {',
      '*   %dp1 = #M1 #M2 @AS $DIFFPAIR;',
      '*   #M2 @ORIENT("MY")',
      '* }'
    ]).map(function (h) { return '<div>' + h.html + '</div>'; }).join('');
    var nodes = $$('.hub-node', hub);
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (window.getComputedStyle(svg).display === 'none') return;
      var hb = hub.getBoundingClientRect(), cb = core.getBoundingClientRect();
      nodes.forEach(function (n, i) {
        var nb = n.getBoundingClientRect();
        var left = nb.right <= cb.left;
        var x0 = left ? cb.left - hb.left : cb.right - hb.left;
        var y0 = cb.top - hb.top + cb.height * (0.28 + 0.22 * (i % 3));
        var x1 = left ? nb.right - hb.left : nb.left - hb.left;
        var y1 = nb.top - hb.top + nb.height / 2;
        var xm = Math.round((x0 + x1) / 2);
        var d = 'M' + x0 + ' ' + y0 + ' H' + xm + ' V' + y1 + ' H' + x1;
        S.el('path', { d: d }, svg);
        S.el('circle', { cx: x0, cy: y0, r: 3.2, class: 'end' }, svg);
        S.el('circle', { cx: x1, cy: y1, r: 3.2, class: 'end' }, svg);
        if (!REDUCE) {
          var c = S.el('circle', { r: 3.4, class: 'pulse' }, svg);
          S.el('animateMotion', { dur: '2.8s', repeatCount: 'indefinite', begin: (i * 0.45).toFixed(2) + 's', path: d }, c);
        }
      });
    }
    draw();
    window.addEventListener('resize', debounce(draw, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  }

  /* ================= 03 逐步细化 ================= */

  var JR = [
    { cap: '<b>只有网表</b>：网表里只有器件和连接。工具能把器件摆出来、用飞线连上，但不知道哪两个管子是一对，也不知道信号往哪边走。' },
    { cap: '<b>写下结构</b>：加三句语义。M1、M2 是差分对，M3、M4 是电流镜，它们和尾管 M5 组成输入级。工具据此把同一结构的器件放在一起。' },
    { cap: '<b>写下意图</b>：再加对称、尾管居中、信号从左到右、M5 的电流方向。一个坐标都没写，求解器已经能排出教科书式的布局。' },
    { cap: '<b>求解器写回</b>：求解器把结果写成一段带 <code>source="solver"</code> 的记录：坐标、朝向、导线。以后打开文件直接显示，不用再求解；<code>input</code> 是求解时输入的指纹。' },
    { cap: '<b>手动微调</b>：把 M2 右移两格。编辑器不动求解器那一段，只在文件末尾追加一条用户语句，后写的覆盖先写的。其余语义都还在。', notice: ['warn', 'warn', '语义在求解后改过（指纹不符）。旧结果照常显示，建议重新求解。'] },
    { cap: '<b>重新求解</b>：求解器原地重写自己那一段。用户语句是最优先的约束：M2 留在 x = 30，其余器件跟着调整，重新对称，尾管重新居中。', notice: ['ok', 'check', '已重新求解，结果与当前语义一致。'] }
  ];

  function initJourney() {
    var svg = $('#jr-svg'), code = $('#jr-code');
    var cap = $('#jr-cap'), notice = $('#jr-notice'), metrics = $('#jr-metrics');
    var steps = $$('#jr-steps button');
    var prevBtn = $('#jr-prev'), nextBtn = $('#jr-next'), playBtn = $('#jr-play');
    var linker = null;
    var view = new S.View(svg, {
      viewBox: SC.OTA_VB,
      onHover: function (ref) { if (linker) linker.markRef(ref); }
    });
    var cur = -1, lastLines = null;

    function showMetrics() {
      var m = view.metrics();
      metrics.innerHTML = cur === 0
        ? '飞线 <b>' + m.air + '</b> · 交叉 <b>' + m.crossings + '</b>'
        : '交叉 <b>' + m.crossings + '</b> · 拐点 <b>' + m.bends + '</b> · 导线 <b>' + m.wires + '</b>';
    }

    function go(i, animate) {
      if (i < 0 || i > 5) return;
      var back = i < cur;
      cur = i;
      steps.forEach(function (b, j) {
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
        b.classList.toggle('is-done', j < i);
      });
      var lines = SC.otaCode(i);
      if (lastLines && !back) {
        var old = {};
        lastLines.forEach(function (l) { old[l.id] = l.t; });
        lines.forEach(function (l) {
          if (!(l.id in old)) l.mark = 'is-add';
          else if (old[l.id] !== l.t) l.mark = 'is-chg';
        });
      }
      lastLines = lines;
      C.render(code, lines);
      if (!linker) linker = C.link(code, lines, view);
      else linker.setLines(lines);
      var first = code.querySelector('.is-add, .is-chg');
      if (first) {
        var top = first.offsetTop - 48;
        if (code.scrollTo) code.scrollTo({ top: Math.max(0, top), behavior: REDUCE ? 'auto' : 'smooth' });
        else code.scrollTop = top;
      } else if (i === 0) {
        code.scrollTop = 0;
      }
      view.setScene(SC.otaScene(i), { animate: !!animate, duration: 1100, done: showMetrics });
      if (!animate) showMetrics();
      cap.innerHTML = JR[i].cap;
      var n = JR[i].notice;
      if (n) {
        notice.className = 'jr-notice ' + n[0];
        notice.innerHTML = icon(n[1]) + '<span>' + n[2] + '</span>';
        notice.hidden = false;
      } else {
        notice.hidden = true;
      }
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === 5;
    }

    var playing = false, timer = null;
    function setPlay(on) {
      playing = on;
      clearTimeout(timer);
      playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      playBtn.innerHTML = icon(on ? 'pause' : 'play') + '<span>' + (on ? '暂停' : '自动播放') + '</span>';
      if (on) schedule();
    }
    function schedule() {
      timer = setTimeout(function () {
        if (!playing) return;
        if (cur >= 5) { setPlay(false); return; }
        go(cur + 1, true);
        schedule();
      }, cur === 0 ? 2600 : 4600);
    }

    steps.forEach(function (b, j) {
      b.addEventListener('click', function () { setPlay(false); go(j, true); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, t = -1;
        if (k === 'ArrowRight') t = Math.min(5, j + 1);
        if (k === 'ArrowLeft') t = Math.max(0, j - 1);
        if (t >= 0) { e.preventDefault(); setPlay(false); go(t, true); steps[t].focus(); }
      });
    });
    prevBtn.addEventListener('click', function () { setPlay(false); go(cur - 1, true); });
    nextBtn.addEventListener('click', function () { setPlay(false); go(cur + 1, true); });
    playBtn.addEventListener('click', function () {
      if (playing) { setPlay(false); return; }
      if (cur >= 5) go(0, true);
      setPlay(true);
    });

    go(0, false);
    var started = false;
    onVisible($('.journey'), function (v) {
      if (v && !started && !REDUCE) {
        started = true;
        setTimeout(function () { if (cur === 0 && !playing) setPlay(true); }, 900);
      }
      if (!v && playing) setPlay(false);
    }, 0.35);
  }

  /* ================= 通用：选项卡 ================= */

  function initTabs(list, onShow) {
    var tabs = $$('[role="tab"]', list);
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tabIndex = on ? 0 : -1;
        var id = x.getAttribute('aria-controls');
        if (id) { var p = document.getElementById(id); if (p) p.hidden = !on; }
      });
      if (focus) t.focus();
      if (onShow) onShow(t);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var j = -1;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') j = 0;
        if (e.key === 'End') j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    var initial = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    select(initial);
    return select;
  }

  /* ================= 04 场景 ================= */

  function initScenes() {
    var made = {};
    function thumbs(id) {
      if (made[id]) return;
      made[id] = true;
      if (id === 't-ai') {
        new S.View($('#ai-thumb'), { viewBox: SC.OTA_VB, grid: false }).setScene(SC.otaScene(2));
      }
      if (id === 't-auto') {
        var a = new S.View($('#auto-air'), { viewBox: SC.OTA_VB, grid: false });
        a.setScene(SC.otaScene(0));
        var b = new S.View($('#auto-sym'), { viewBox: SC.OTA_VB, grid: false });
        b.setScene(SC.otaScene(2));
        var ma = a.metrics(), mb = b.metrics();
        $('#auto-air-cap').innerHTML = '<span class="chip chip-err">交叉 ' + ma.crossings + ' 处</span><span class="chip chip-err">看不出结构</span>';
        $('#auto-sym-cap').innerHTML = '<span class="chip chip-ok">交叉 ' + mb.crossings + ' 处</span><span class="chip chip-ok">差分对、电流镜一目了然</span>';
      }
    }
    initTabs($('#sc-tabs'), function (t) { thumbs(t.id); });
  }

  /* ================= 05 工具链 ================= */

  var MODS = {
    file: { nm: '网表 + RNL 文件', en: 'SPICE / Spectre', role: '一切的起点和终点。', li: ['电路由网表定义，理解与画法由注释里的 RNL 描述', '仿真器照常读取整份文件', '各个工具只改写自己来源的那几段记录'], form: '.sp、.scs 等原有网表文件', st: ['chip', '沿用现有格式'] },
    adapter: { nm: '宿主适配器', en: 'Host adapters', role: '读懂各种网表方言。', li: ['找出可以安全写入 RNL 的注释位置', '读出器件、网络、端子名和子电路层次', '只改 RNL 时，网表正文和普通注释原样保留'], form: 'rnl-host-spice、rnl-host-spectre（Rust）', st: ['chip chip-warn', '规划中'] },
    runtime: { nm: '运行库', en: 'Runtime', role: '读懂 RNL。', li: ['解析语法，错误定位到行、字段和引用', '解析名字、作用域和向下继承', '按“后写覆盖”合成最终生效的描述', '保留原文格式写回文件'], form: 'rnl-runtime（Rust，可编译到 WASM）；npm 包 @rich-netlist/runtime', st: ['chip chip-warn', '规划中 · 解释器原型 rnl-lang'] },
    solver: { nm: '求解器', en: 'Solver', role: '把意图变成坐标。', li: ['输入：运行库交来的一层电路的生效模型，即语义、约束和目标优先级', '输出：这一层完整的位置、朝向和走线，本身就是一段精确 RNL，交回运行库写进文件', '边算边交付更好的结果，可以随时取消', '同一输入、同一工作量预算，结果完全相同'], form: 'rnl-solver（纯 Rust，可编译到 WASM）；@rich-netlist/solver', st: ['chip chip-warn', '规划中 · Python 原型'] },
    render: { nm: '统一渲染器', en: 'Renderer', role: '把描述变成图元。', li: ['展开符号，应用旋转和镜像', '输出带对象身份的线条、填充和文字', '查看器和命令行画出来完全一致'], form: 'rnl-render（Rust，与运行库同属共享核心）', st: ['chip chip-warn', '规划中'] },
    viewer: { nm: '查看器', en: 'Viewer', role: '像 PDF 阅读器一样轻。', li: ['缩放、平移、搜索器件', '高亮一条网络，进入子电路', '文件里已有完整几何时，不需要求解器', '不自带元件库，符号来自 RNL 库'], form: '@rich-netlist/viewer（TypeScript，不依赖 UI 框架）', st: ['chip chip-warn', '规划中 · RNL Lab 实验'] },
    editor: { nm: '编辑器', en: 'Editor', role: '改图就是追加一行。', li: ['拖动、换符号、改样式，支持撤销重做', '修改写成用户语句，追加在求解结果之后', '内置轻量走线，拖动时不必等求解器'], form: '@rich-netlist/editor', st: ['chip chip-warn', '规划中'] },
    cli: { nm: '命令行', en: 'CLI', role: '批量处理和自动化。', li: ['检查语法、引用和基本规则', '把语义 RNL 求解成精确 RNL 并写回', '导出 SVG 或 PDF', '把旧版本语法迁移到新版本'], form: 'rnl-cli（Rust，各平台预编译）', st: ['chip chip-warn', '规划中'] },
    stdlib: { nm: '标准库', en: 'Standard library', role: '符号也是数据。', li: ['标准符号、样式、语义类型和约束模式', '和引擎分开发布、分开编版本号', '用户可以覆盖同名定义'], form: '@rich-netlist/stdlib（纯数据包）', st: ['chip chip-warn', '规划中 · 原型标准包'] }
  };

  var EDGES = [
    { id: 'f-a', from: 'file', to: 'adapter', route: 'h' },
    { id: 'a-r', from: 'adapter', to: 'runtime', route: 'h' },
    { id: 'r-ren', from: 'runtime', to: 'render', route: 'h' },
    { id: 'ren-v', from: 'render', to: 'viewer', route: 'h' },
    { id: 'r-s', from: 'runtime', to: 'solver', route: 'v', fa: 0.3 },
    { id: 's-r', from: 'solver', to: 'runtime', route: 'vu', fa: 0.7 },
    { id: 'ren-cli', from: 'render', to: 'cli', route: 'v', fa: 0.5, label: 'SVG / PDF', side: 'r' },
    { id: 'v-e', from: 'viewer', to: 'editor', route: 'v', fa: 0.5 },
    { id: 'e-r', from: 'editor', to: 'runtime', route: 'edit', label: '追加用户语句' },
    { id: 'lib-r', from: 'stdlib', to: 'runtime', route: 'lib', label: '符号、样式、类型' },
    { id: 'r-f', from: 'runtime', to: 'file', route: 'back', label: '写回（保留原文）' }
  ];

  var FLOWS = {
    open: { mods: ['file', 'adapter', 'runtime', 'render', 'viewer', 'stdlib'], edges: ['f-a', 'a-r', 'r-ren', 'ren-v', 'lib-r'], cap: '文件里已经有完整的几何：查看器直接画出来，不需要求解器。', skip: ['solver'] },
    solve: { mods: ['file', 'adapter', 'runtime', 'solver', 'render', 'viewer', 'cli', 'stdlib'], edges: ['f-a', 'a-r', 'r-s', 's-r', 'r-ren', 'ren-v', 'ren-cli', 'lib-r', 'r-f'], cap: '只有语义和意图：求解器算出坐标和走线，写回成一段带来源标记的 RNL；下次打开直接看。' },
    edit: { mods: ['editor', 'viewer', 'runtime', 'solver', 'render', 'file'], edges: ['v-e', 'e-r', 'r-s', 's-r', 'r-ren', 'ren-v', 'r-f'], cap: '在编辑器里拖动器件：追加一条用户语句，后台重新求解，更好的结果陆续刷新到画面上。' }
  };

  function initTools() {
    var graph = $('#tgraph'), svg = $('#twires'), detail = $('#tdetail');
    var mods = {};
    $$('.tmod', graph).forEach(function (m) { mods[m.getAttribute('data-mod')] = m; });
    var flow = 'solve', sel = 'solver';

    function R(id) {
      var g = graph.getBoundingClientRect(), r = mods[id].getBoundingClientRect();
      var l = r.left - g.left, t = r.top - g.top;
      return { l: l, t: t, r: l + r.width, b: t + r.height, w: r.width, h: r.height, cx: l + r.width / 2, cy: t + r.height / 2 };
    }
    function pts(e) {
      var A = R(e.from), B = R(e.to), x, y;
      switch (e.route) {
        case 'h': return [[A.r + 4, A.cy], [B.l - 4, B.cy]];
        case 'v': x = A.l + A.w * e.fa; return [[x, A.b + 4], [x, B.t - 4]];
        case 'vu': x = A.l + A.w * e.fa; return [[x, A.t - 4], [x, B.b + 4]];
        case 'lib':
          y = R('file').b + (A.t - R('file').b) * 0.52;
          x = B.l + B.w * 0.12;
          return [[A.cx, A.t - 4], [A.cx, y], [x, y], [x, B.b + 4]];
        case 'edit':
          y = R('viewer').b + (A.t - R('viewer').b) * 0.78;
          var xs = A.l + A.w * 0.24, xe = B.l + B.w * 0.9;
          return [[xs, A.t - 4], [xs, y], [xe, y], [xe, B.b + 4]];
        case 'back':
          y = A.t - 22;
          return [[A.cx, A.t - 4], [A.cx, y], [B.cx, y], [B.cx, B.t - 4]];
      }
      return [];
    }
    function d(p) { return 'M' + p.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L'); }

    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (window.getComputedStyle(svg).display === 'none') return;
      var defs = S.el('defs', null, svg);
      ['off', 'on'].forEach(function (k) {
        var mk = S.el('marker', { id: 'tm-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
        S.el('path', { d: 'M0 0L10 5L0 10z', class: 'tm-' + k }, mk);
      });
      var F = FLOWS[flow];
      EDGES.forEach(function (e) {
        var p = pts(e);
        var on = F.edges.indexOf(e.id) >= 0;
        S.el('path', { d: d(p), class: on ? 'is-on' : 'is-dim', 'marker-end': 'url(#tm-' + (on ? 'on' : 'off') + ')' }, svg);
        if (e.label) {
          var anchor = 'middle', lx, ly;
          if (p.length === 2) {
            /* 竖线：标签放在行间空隙的上部，免得和下部的横线打架 */
            lx = p[0][0] + (e.side === 'l' ? -7 : 7);
            ly = Math.min(p[0][1], p[1][1]) + 16;
            anchor = e.side === 'l' ? 'end' : 'start';
          } else if (e.route === 'edit') {
            lx = p[0][0] - 8;
            ly = p[1][1] - 6;
            anchor = 'end';
          } else {
            lx = (p[1][0] + p[2][0]) / 2;
            ly = p[1][1] - 6;
          }
          var t = S.el('text', { x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': anchor, class: on ? 'is-on' : '' }, svg);
          t.textContent = e.label;
        }
      });
    }

    function isFile(id) { return id === 'file'; }
    function paint() {
      var F = FLOWS[flow];
      Object.keys(mods).forEach(function (k) {
        mods[k].classList.toggle('is-on', F.mods.indexOf(k) >= 0);
        mods[k].classList.toggle('is-dim', F.mods.indexOf(k) < 0);
        mods[k].classList.toggle('is-sel', k === sel);
        mods[k].setAttribute('aria-pressed', k === sel ? 'true' : 'false');
        var tag = mods[k].querySelector('.skip-tag');
        if (F.skip && F.skip.indexOf(k) >= 0) {
          if (!tag) { tag = document.createElement('span'); tag.className = 'skip-tag'; tag.textContent = '不需要'; mods[k].appendChild(tag); }
        } else if (tag) tag.remove();
      });
      $('#flow-cap').textContent = F.cap;
      var m = MODS[sel];
      detail.innerHTML =
        '<h3>' + m.nm + ' <small>' + m.en + '</small></h3>' +
        '<p class="role">' + m.role + '</p>' +
        '<ul>' + m.li.map(function (x) { return '<li>' + icon('check') + '<span>' + x + '</span></li>'; }).join('') + '</ul>' +
        '<dl class="kv"><dt>形态</dt><dd>' + m.form + (isFile(sel) ? '' : '<br><span class="muted">名称均为暂定</span>') + '</dd><dt>状态</dt><dd><span class="' + m.st[0] + '">' + m.st[1] + '</span></dd></dl>';
      draw();
    }

    var fbtns = $$('#flow-seg button');
    fbtns.forEach(function (b) {
      b.addEventListener('click', function () {
        setPressed(fbtns, b);
        flow = b.getAttribute('data-flow');
        paint();
      });
    });
    Object.keys(mods).forEach(function (k) {
      mods[k].addEventListener('click', function () { sel = k; paint(); });
    });
    paint();
    window.addEventListener('resize', debounce(draw, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  }

  /* ================= 06 原则里的小演示 ================= */

  function initPrinciples() {
    var p3 = $('#p3'), p3code = $('#p3-code');
    var P3 = {
      sem: '%dp1 = #M1 #M2 @AS $DIFFPAIR',
      con: '{#M1 #M2} @ALIGN(axis="y")',
      geo: '#M1 @AT(10, 20);  #M2 @AT(30, 20)'
    };
    var p3btns = $$('.seg button', p3);
    var order = ['sem', 'con', 'geo'], gi = 0, auto = !REDUCE;
    function setG(g) {
      p3.setAttribute('data-g', g);
      p3code.innerHTML = C.hlSnippet(P3[g]);
      p3btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-g') === g ? 'true' : 'false'); });
    }
    p3btns.forEach(function (b) {
      b.addEventListener('click', function () { auto = false; setG(b.getAttribute('data-g')); });
    });
    setG('sem');
    var p3visible = false;
    onVisible(p3, function (v) { p3visible = v; });
    setInterval(function () {
      if (!auto || !p3visible || document.hidden) return;
      gi = (gi + 1) % order.length;
      setG(order[gi]);
    }, 2600);

    var p7 = $('#p7'), line = $('#p7-line');
    line.innerHTML = C.hlSnippet('do not move #M2 @AT(x=30)');
    var p7btns = $$('.seg button', p7);
    p7btns.forEach(function (b) {
      b.addEventListener('click', function () {
        setPressed(p7btns, b);
        line.classList.toggle('machine', b.getAttribute('data-m') === 'machine');
      });
    });
  }

  /* ================= 07 语言 ================= */

  var AN = {
    pref: ['*', '宿主注释前缀。SPICE 用 *，Spectre 用 //；RNL 的内容本身与网表格式无关。'],
    rec: ['@RNL', '记录入口。只有写在合法注释里、以 @RNL 开头的内容才是 RNL。'],
    src: ['(source="user")', '记录参数：这段是谁写的，比如 user、editor、solver。工具只重写自己来源的记录。'],
    brace: ['{ }', '记录的内容写在花括号里，多条语句用分号分开。'],
    free: ['说明文字', 'Input pair、and、are 都是给人看的，机器不读。只允许字母、数字、空格、逗号、句点这类安全字符。'],
    name: ['%dp1 =', '命名：把这条语句创建的对象叫做 dp1。% 开头的名字只在本层可见。'],
    inst: ['#M1、#M2', '引用网表里的器件。# 开头的都是宿主对象，RNL 只引用，不创建。'],
    role: ['(in_p)、(in_n)', '角色：紧跟对象的括号，说明它在这句里是正输入管还是负输入管。一句里要么全标角色，要么全不标。'],
    kw: ['@AS', '关键字：把前面的对象解释为某种结构。一条语句至多一个关键字。'],
    def: ['$DIFFPAIR', '定义：差分对这个类型，来自标准包。$ 开头的定义沿子电路层级向下继承，也可以被覆盖。'],
    semi: [';', '分号结束这条语句。每条语句独立生效，也独立失效。']
  };

  var KW = {
    '@AS': ['把一组对象解释为某种结构。结构类型用 $ 定义，角色来自类型的角色表。', '%dp1 = #M1(in_p) and #M2(in_n) are @AS $DIFFPAIR'],
    '@CURRENT': ['电流方向：从第一个端子流向第二个。只影响画法，不做电路分析。', '#M5:d #M5:s @CURRENT'],
    '@FLOW': ['本层的信号流向，没有参与对象。', '@FLOW(dir="left-to-right")'],
    '@GROUP': ['把几个对象组成一个有身份的组，组还可以再成组。', '%blk1 = {#M1 #M2 #M5} @GROUP'],
    '@ALIGN': ['对齐：axis="y" 表示这些对象的 y 坐标相同。', '{#M1 #M2} @ALIGN(axis="y")'],
    '@ORDER': ['顺序：沿某个轴严格排开，正序、倒序都算满足。下例让两个栅极相向。', '{#M1 #M1:g #M2:g #M2} @ORDER(axis="x")'],
    '@DISTRIBUTE': ['匀布：相邻两个之间的间距相等。下例让尾管居中。', '{#M1:s #M5:d #M2:s} @DISTRIBUTE(axis="x")'],
    '@DISTANCE': ['距离：给出上下界。signed 规定先后，absolute 不管先后。下例让栅极在左。', '#M1:g #M1 @DISTANCE(axis="x", mode="signed", min=1)'],
    '@APPLY': ['套用约束模式：一组约束作为整体使用，删掉这一行，这组约束就一起消失。', '%sym12 = #M1(a) and #M2(b) about %ax(axis) @APPLY $MIRROR_PAIR'],
    '@AT': ['坐标。x、y 各自覆盖，没写的一轴保持自由。', '#M1 @AT(10, 20);  #M1 @AT(x=12)'],
    '@ORIENT': ['姿态：R0、R90、R180、R270、MX、MY 等八种。', '#M2 @ORIENT("MY")'],
    '@WIRE': ['导线：关联一个网络，经过一组有序的点；端子本身就是点。', '&x @WIRE {#M1:d <12, 13> #M3:d}'],
    '@JUNCTION': ['显式画出的汇合圆点。', '<10, 30> @JUNCTION'],
    '@LABEL': ['标签：显示器件名、参数值或网络名，内容取自网表。', '#M1 @LABEL(field="value", template="W/L={W}/{L}")'],
    '@NOTE': ['自由文字或边框，纯绘图对象。', '%n1 = @NOTE(text="5T OTA testbench") | @AT(50, 18)'],
    '@VIRTUAL': ['虚元件：地、电源、端口这类只为显示存在的元件，关联到网络。', '%g0 = &vss @VIRTUAL $GND | @AT(24, 38)'],
    '@APPEAR': ['指定用哪个符号画这个对象。', '#M1 @APPEAR $NMOS4'],
    '@SELECT_INST': ['按元件字母、模型名或类型选出一批器件；和 APPEAR 连用就是一条外观规则。', '@SELECT_INST(model="nch") | @APPEAR $NMOS'],
    '@SELECT_TERM': ['选出一批端子，常用来批量补地、补端口。', '@SELECT_TERM(net="vss", wired=false) | @APPLY $GND_STUB'],
    '@STYLE_APPLY': ['应用样式：按属性合并，后写的覆盖先写的。', '%w13 @STYLE_APPLY $signal'],
    '@SYMBOL': ['定义符号：引脚、线、多边形、文字槽。例子见第 08 节。', '$NMOS = @SYMBOL(box=[-3, -3, 2, 3]) { … }'],
    '@STYLE': ['定义样式：颜色、线宽、字号，可以并入别的样式。', '$signal = @STYLE(stroke="#1f4fd8", width=2) {$base}'],
    '@TYPE': ['定义结构类型：角色表加定义体；空体就是纯语义标注。', '$DIFFPAIR = @TYPE(["in_p", "in_n"]) {}'],
    '@PATTERN': ['定义约束模式：带空位 ?a 的一组约束，套用时填入。', '$MIRROR_PAIR = @PATTERN(["a", "b", "axis"]) {\n  {?a ?b} @ALIGN(axis="y");\n  {?a ?axis ?b} @DISTRIBUTE(axis="x")\n}'],
    '@RNL': ['记录入口，括号里的参数作用于整段记录。', '* @RNL(source="solver") { #M1 @AT(12, 20) }'],
    '@VERSION': ['声明文件使用的语法版本。', '@VERSION("0.2")'],
    '@USE': ['引用一个 RNL 包。这一项暂缓，只占位。', '@USE(name="rnl-std", version="0.1")']
  };

  var PIPE = [
    ['读入', '检查词法、语法和关键字签名。写错的语句在这里变成“失效对象”，留在原位，不影响别的语句。'],
    ['名字与定义', '解析 #、&、%、$ 引用，允许先用后定义；求出符号、样式的定义体。'],
    ['创建对象', '创建虚元件、导线、点，展开 @AS 和 @APPLY 套用的模板。'],
    ['定符号', '外观规则和逐个对象的 @APPEAR 依次生效，后写的覆盖先写的。'],
    ['逐个生成', '按选择规则批量生成，比如给每个没接线的地端子补一个地符号。'],
    ['几何', '坐标按 x、y 分别覆盖；约束冲突时从新到旧保留；没有位置的对象交给求解器。'],
    ['定样式', '按属性合并样式，符号里的线型角色这时才落到具体的线宽和颜色。'],
    ['渲染', '把最终生效的描述画出来。']
  ];

  function initLanguage() {
    var line = $('#an-line'), tip = $('#an-tip');
    var IDLE = tip.innerHTML;
    var toks = $$('.tok', line);
    function show(tok) {
      toks.forEach(function (t) { t.classList.remove('is-on'); });
      if (!tok) { tip.innerHTML = IDLE; return; }
      var k = tok.getAttribute('data-k');
      toks.forEach(function (t) { if (t.getAttribute('data-k') === k) t.classList.add('is-on'); });
      var a = AN[k];
      tip.innerHTML = '<span class="k">' + C.esc(a[0]) + '</span><span>' + a[1] + '</span>';
    }
    toks.forEach(function (t) {
      t.addEventListener('mouseenter', function () { show(t); });
      t.addEventListener('focus', function () { show(t); });
    });
    line.addEventListener('mouseleave', function () { show(null); });
    var abtns = $$('#an-seg button');
    abtns.forEach(function (b) {
      b.addEventListener('click', function () {
        setPressed(abtns, b);
        line.classList.toggle('machine', b.getAttribute('data-m') === 'machine');
      });
    });

    var card = $('#kw-card');
    var kws = $$('#fams .kw');
    function pick(b) {
      kws.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var k = b.textContent.trim();
      var info = KW[k];
      var fam = b.closest('.fam').querySelector('span').textContent;
      card.innerHTML = '<h4>' + k + '</h4><span class="chip chip-rnl">' + fam + '</span><p>' + info[0] + '</p>' +
        '<div class="minicode">' + (/^\s*\*/.test(info[1]) ? C.hlFile(info[1].split('\n')).map(function (h) { return h.html; }).join('\n') : C.hlSnippet(info[1])) + '</div>';
    }
    kws.forEach(function (b) { b.addEventListener('click', function () { pick(b); }); });
    pick(kws[0]);

    var pipe = $('#pipe'), pcap = $('#pipe-cap');
    pipe.innerHTML = PIPE.map(function (p, i) {
      return '<button type="button" data-i="' + i + '"><span class="n">' + (i + 1) + '</span>' + p[0] + '</button>';
    }).join('');
    var pbtns = $$('button', pipe), pi = 0, hover = false, pvis = false;
    function setP(i) {
      pi = i;
      pbtns.forEach(function (b, j) { b.classList.toggle('is-on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      pcap.innerHTML = '<b>' + (i + 1) + ' · ' + PIPE[i][0] + '</b>　' + PIPE[i][1];
    }
    pbtns.forEach(function (b, j) {
      b.addEventListener('mouseenter', function () { hover = true; setP(j); });
      b.addEventListener('focus', function () { hover = true; setP(j); });
      b.addEventListener('click', function () { hover = true; setP(j); });
    });
    pipe.addEventListener('mouseleave', function () { hover = false; });
    setP(0);
    onVisible(pipe, function (v) { pvis = v; });
    if (!REDUCE) {
      setInterval(function () {
        if (hover || !pvis || document.hidden) return;
        setP((pi + 1) % PIPE.length);
      }, 2800);
    }
  }

  /* ================= 08 例子 ================= */

  function e3Drawing(host) {
    var el = S.el;
    var svg = el('svg', { class: 'sc e3', viewBox: '-5.4 -4.9 10.2 9.8', role: 'img', 'aria-label': 'NMOS 符号的定义，按图元分解' }, host);
    var defs = el('defs', null, svg);
    var pat = el('pattern', { id: 'e3dots', x: -0.5, y: -0.5, width: 1, height: 1, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 0.5, cy: 0.5, r: 0.05, class: 'sc-griddot' }, pat);
    el('rect', { x: -5.4, y: -4.9, width: 10.2, height: 9.8, fill: 'url(#e3dots)' }, svg);
    el('line', { class: 'e3-axis', x1: -5, y1: 0, x2: 4.2, y2: 0 }, svg);
    el('line', { class: 'e3-axis', x1: 0, y1: -4.6, x2: 0, y2: 4.6 }, svg);
    el('text', { class: 'e3-ax', x: 4.3, y: 0.05 }, svg).textContent = 'x';
    el('text', { class: 'e3-ax', x: 0.2, y: 4.55 }, svg).textContent = 'y';
    el('rect', { class: 'e3-box', 'data-ref': 'box', x: -3, y: -3, width: 3.4, height: 6 }, svg);
    var P = function (ref, tag, attrs) { attrs['data-ref'] = ref; return el(tag, attrs, svg); };
    P('l1', 'polyline', { class: 'sp e3-p', points: '-3,0 -1.2,0' });
    P('l2', 'polyline', { class: 'sp em e3-p', points: '-1.2,-1.3 -1.2,1.3' });
    P('l3', 'polyline', { class: 'sp em e3-p', points: '-0.6,-1.6 -0.6,1.6' });
    P('l4', 'polyline', { class: 'sp e3-p', points: '-0.6,-1.1 0,-1.1 0,-3' });
    P('l5', 'polyline', { class: 'sp e3-p', points: '-0.6,1.1 0,1.1 0,3' });
    P('poly', 'polygon', { class: 'sp fill e3-p', points: '0,1.1 -0.5,0.8 -0.5,1.4' });
    [['pin-d', 0, -3, 0, -3.9, 'D', 0.35, -3.55, 'start'], ['pin-g', -3, 0, -3.9, 0, 'G', -3.35, -0.5, 'end'], ['pin-s', 0, 3, 0, 3.9, 'S', 0.35, 3.6, 'start']].forEach(function (p) {
      var g = el('g', { class: 'e3-pin', 'data-ref': p[0] }, svg);
      el('line', { class: 'e3-dir', x1: p[1], y1: p[2], x2: p[3], y2: p[4] }, g);
      el('circle', { cx: p[1], cy: p[2], r: 0.24 }, g);
      el('text', { x: p[6], y: p[7], 'text-anchor': p[8] }, g).textContent = p[5];
    });
    var tg = el('g', { class: 'e3-text', 'data-ref': 'text' }, svg);
    el('rect', { x: 0.85, y: -2.6, width: 1.9, height: 1.2, rx: 0.15 }, tg);
    el('text', { x: 1.02, y: -2 }, tg).textContent = 'M1';
    return svg;
  }

  function e3Highlight(svg, ref) {
    $$('.is-hl', svg).forEach(function (e) { e.classList.remove('is-hl'); });
    var any = false;
    if (ref === 'rule') {
      $$('[data-ref]', svg).forEach(function (e) { e.classList.add('is-hl'); });
      any = true;
    } else if (ref) {
      $$('[data-ref="' + ref + '"]', svg).forEach(function (e) { e.classList.add('is-hl'); any = true; });
    }
    svg.classList.toggle('has-hl', any && ref !== 'rule');
  }

  function initExamples() {
    var codeEl = $('#ex-code'), fig = $('#ex-fig'), cap = $('#ex-cap'), extra = $('#ex-extra'), top = $('#ex-top'), file = $('#ex-file');
    var timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function mountView(scene, vb) {
      fig.innerHTML = '';
      var svg = S.el('svg', { role: 'img', 'aria-label': '示例原理图' }, fig);
      var linker = null;
      var view = new S.View(svg, { viewBox: vb || scene.viewBox, onHover: function (ref) { if (linker) linker.markRef(ref); } });
      view.setScene(scene);
      return { view: view, setLinker: function (l) { linker = l; } };
    }

    var EX = {
      e1: function () {
        file.textContent = 'rlc_lowpass.sp';
        var lines = SC.E1_LINES;
        C.render(codeEl, lines);
        var m = mountView(SC.rlcScene('split'));
        m.setLinker(C.link(codeEl, lines, m.view, { modes: true }));
        top.innerHTML = '<span class="seg" role="group" aria-label="地符号的画法"><button type="button" data-s="split" aria-pressed="true">每个端子一个地</button><button type="button" data-s="merged" aria-pressed="false">合并成一个</button></span>';
        var bs = $$('button', top);
        bs.forEach(function (b) {
          b.addEventListener('click', function () {
            setPressed(bs, b);
            m.view.setScene(SC.rlcScene(b.getAttribute('data-s')), { animate: true, duration: 700 });
          });
        });
        cap.innerHTML = '只写了一句：V1 → {R1 L1} → C1 是一条从源到负载的链，串联的位置上放的是一个集合。摆放、朝向、走线和地符号，都交给求解器和查看器。右上角切换地符号的画法：这是<b>查看器的风格设置</b>，RNL 一个字都不用改。';
      },
      e2: function () {
        file.textContent = 'ota5t_tb.sp';
        var lines = SC.E2_LINES;
        C.render(codeEl, lines);
        var m = mountView(SC.TB);
        m.setLinker(C.link(codeEl, lines, m.view));
        cap.innerHTML = '子电路 ota5t 在自己内部定义了外观：一个三角形的 block symbol（<code>export="block"</code>），引脚按端口名对应。顶层的 XU1 自动用它，顶层只写了 XU1 的位置和一段说明文字；电源、偏置源和负载电容没写位置，由求解器摆放。';
      },
      e3: function () {
        file.textContent = 'symbols.rnl';
        var lines = SC.E3_LINES;
        C.render(codeEl, lines);
        fig.innerHTML = '';
        var svg = e3Drawing(fig);
        cap.innerHTML = SC.E3_NOTES.idle;
        C.link(codeEl, lines, null, {
          onLine: function (i, l) {
            e3Highlight(svg, l ? l.r : null);
            cap.innerHTML = l ? SC.E3_NOTES[l.r] : SC.E3_NOTES.idle;
          }
        });
        $$('[data-ref]', svg).forEach(function (e) {
          e.addEventListener('mouseenter', function () {
            var ref = e.getAttribute('data-ref');
            e3Highlight(svg, ref);
            $$('.cl', codeEl).forEach(function (r) { r.classList.toggle('is-hot', r.getAttribute('data-refs') === ref); });
            cap.innerHTML = SC.E3_NOTES[ref];
          });
          e.addEventListener('mouseleave', function () {
            e3Highlight(svg, null);
            $$('.cl', codeEl).forEach(function (r) { r.classList.remove('is-hot'); });
            cap.innerHTML = SC.E3_NOTES.idle;
          });
        });
        top.innerHTML = '<span class="chip">局部坐标 · 一格一个单位</span>';
      },
      e4: function () {
        file.textContent = 'fill_in.sp';
        var lines = SC.E4_LINES;
        C.render(codeEl, lines);
        var m = mountView(SC.fillScene(3));
        m.setLinker(C.link(codeEl, lines, m.view));
        top.innerHTML = '<button type="button" class="btn btn-sm" id="ex-replay">' + icon('replay') + '重放生成</button>';
        function replay() {
          clearTimers();
          var rows = $$('.cl', codeEl);
          m.view.setScene(SC.fillScene(0), { animate: true, duration: 500 });
          [1, 2, 3].forEach(function (n, k) {
            timers.push(setTimeout(function () {
              m.view.setScene(SC.fillScene(n), { animate: true, duration: 450 });
              rows.forEach(function (r) { r.classList.remove('is-hot'); });
              var gen = n < 3 ? 'gnd' : 'port';
              lines.forEach(function (l, i) { if (l.gen === gen && rows[i]) rows[i].classList.add('is-hot'); });
            }, 900 + k * 900));
          });
          timers.push(setTimeout(function () { rows.forEach(function (r) { r.classList.remove('is-hot'); }); }, 900 + 3 * 900 + 800));
        }
        $('#ex-replay').addEventListener('click', replay);
        cap.innerHTML = '两条规则批量生成：接在 0 网络、还没接导线的端子各补一个地（标准包里的 <code>$GND_STUB</code>），没接线的栅极各补一个端口。V1 的负端已经手动接了地，所以被跳过（先占）。生成的对象画成灰色。';
      },
      e5: function () {
        file.textContent = 'ota5t.sp';
        var lines = SC.E5_LINES;
        C.render(codeEl, lines);
        var m = mountView(SC.e5Scene(), SC.OTA_VB);
        var linker = C.link(codeEl, lines, m.view);
        m.setLinker(linker);
        extra.innerHTML = '<ul class="diag">' + SC.E5_DIAG.map(function (d) {
          return '<li class="' + d.k + '" data-d="' + d.id + '" tabindex="0">' + icon(d.icon) + '<span>' + d.html + '</span></li>';
        }).join('') + '</ul>';
        $$('.diag li', extra).forEach(function (li) {
          var id = li.getAttribute('data-d');
          var d = SC.E5_DIAG.filter(function (x) { return x.id === id; })[0];
          function on() {
            $$('.cl', codeEl).forEach(function (r, i) { r.classList.toggle('is-hot', lines[i].d === id || (id === 'ok' && lines[i].d === 'ok')); });
            m.view.highlight(d.refs.length ? d.refs : null);
          }
          function off() {
            $$('.cl', codeEl).forEach(function (r) { r.classList.remove('is-hot'); });
            m.view.highlight(null);
          }
          li.addEventListener('mouseenter', on);
          li.addEventListener('focus', on);
          li.addEventListener('mouseleave', off);
          li.addEventListener('blur', off);
        });
        top.innerHTML = '<span class="chip chip-err">2 个错误</span><span class="chip chip-warn">1 处冲突</span>';
        cap.innerHTML = '三段记录按顺序处理：用户的语义、求解器的坐标、用户后来的修改。坏语句只让自己失效；冲突不是错误，按“新的优先”保留较新的事实。把鼠标放到上面的诊断上，看它指向哪一行、哪个器件。';
      }
    };

    function show(id) {
      clearTimers();
      extra.innerHTML = '';
      top.innerHTML = '';
      EX[id]();
    }
    initTabs($('#ex-tabs'), function (t) { show(t.getAttribute('data-ex')); });
  }

  /* ================= 启动 ================= */

  function boot() {
    paintStatic(document);
    initTheme();
    initNav();
    initHero();
    initOwners();
    initFixes();
    initHub();
    initJourney();
    initScenes();
    initTools();
    initPrinciples();
    initLanguage();
    initExamples();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
