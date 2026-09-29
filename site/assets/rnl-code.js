/* RNL 介绍页 · 代码着色与代码面板
 *
 * 只做显示用的着色，不是解析器：宿主网表行、普通注释行、@RNL 记录（可跨行）分别处理。
 * 记录内部按当前讨论稿的记号着色：#实例 &网络 %本层对象 $定义 ?空位 <点>，
 * 关键字 @XX 及其参数，紧跟对象的 (角色)，其余是说明文字。
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function span(cls, s) { return '<span class="' + cls + '">' + esc(s) + '</span>'; }

  /* ---------- 宿主网表（SPICE 结构子集） ---------- */

  function hlSpiceRest(rest) {
    return rest.replace(/(\s+)|([A-Za-z_]\w*)=(\{[^}]*\}|\S+)|(\S+)/g, function (all, ws, pn, pv, tok) {
      if (ws) return ws;
      if (pn) return span('t-pn', pn) + '=' + span('t-hval', pv);
      if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?[a-z]*$/i.test(tok)) return span('t-hval', tok);
      return span('t-hnet', tok);
    });
  }

  function hlSpice(text) {
    var m = /^(\s*)(\S+)(.*)$/.exec(text);
    if (!m) return esc(text);
    var head = m[2].charAt(0) === '.' ? span('t-dir', m[2]) : span('t-dev', m[2]);
    return esc(m[1]) + head + hlSpiceRest(m[3]);
  }

  /* ---------- RNL 记录 ---------- */

  var RE = {
    ws: /\s+/y,
    str: /"(?:[^"\\]|\\.)*"?/y,
    kw: /@[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/y,
    pt: /<[^<>\n]*>/y,
    inst: /#(?:"[^"]*"|[A-Za-z0-9_]+)?(?::(?:"[^"]*"|[A-Za-z0-9_]+))*(?:::[A-Za-z0-9_]+)?/y,
    net: /&(?:"[^"]*"|[A-Za-z0-9_]+)(?:::[A-Za-z0-9_]+)?/y,
    obj: /%(?:"[^"]*"|[A-Za-z0-9_]+)(?:\/[A-Za-z0-9_]+)?(?::(?:"[^"]*"|[A-Za-z0-9_]+))?(?:::[A-Za-z0-9_]+)?/y,
    def: /\$(?:"[^"]*"|[A-Za-z0-9_]+)/y,
    slot: /\?[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z0-9_]+)?(?::[A-Za-z0-9_]+)?/y,
    num: /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y,
    ident: /[A-Za-z_][A-Za-z0-9_]*/y,
    role: /\(\s*(?:"[^"]*"|[A-Za-z_][A-Za-z0-9_]*)\s*\)/y,
    word: /[^\s{}();|=\[\],<>"@#&%$?]+/y
  };

  function at(re, s, i) {
    re.lastIndex = i;
    var m = re.exec(s);
    return m ? m[0] : null;
  }

  function State() {
    this.inRec = false;
    this.depth = 0;
    this.opened = false;
    this.inCmt = false;
    this.paren = 0;
    this.brack = 0;
  }

  function hlRnl(s, st) {
    var out = '', i = 0, n = s.length, m;
    var afterKw = false, lastRef = false;
    while (i < n) {
      if (st.inCmt) {
        var e = s.indexOf('*/', i);
        if (e < 0) { out += span('t-cmt', s.slice(i)); return out; }
        out += span('t-cmt', s.slice(i, e + 2));
        i = e + 2;
        st.inCmt = false;
        continue;
      }
      if (!st.inRec) {
        var rest = s.slice(i);
        var k = rest.search(/@rnl\b/i);
        if (k < 0) { out += span('t-cmt', rest); return out; }
        if (k > 0) out += span('t-cmt', rest.slice(0, k));
        i += k;
        out += span('t-rec', s.substr(i, 4));
        i += 4;
        st.inRec = true; st.depth = 0; st.opened = false; st.paren = 0; st.brack = 0;
        afterKw = true; lastRef = false;
        continue;
      }
      var c = s.charAt(i);
      if (/\s/.test(c)) { m = at(RE.ws, s, i); out += m; i += m.length; continue; }
      if (c === '/' && s.charAt(i + 1) === '*') { st.inCmt = true; continue; }
      var inParams = st.paren > 0;
      if (c === '(') {
        if (afterKw) { st.paren++; out += span('t-punct', '('); i++; afterKw = false; lastRef = false; continue; }
        if (lastRef && (m = at(RE.role, s, i))) { out += span('t-role', m); i += m.length; lastRef = false; continue; }
        if (inParams) { st.paren++; out += span('t-punct', '('); i++; continue; }
        out += span('t-free', '('); i++; continue;
      }
      afterKw = false;
      if (c === ')') {
        if (st.paren > 0) { st.paren--; out += span('t-punct', ')'); } else out += span('t-free', ')');
        i++; lastRef = false; continue;
      }
      if (c === '{') {
        if (inParams) { out += span('t-punct', '{'); i++; continue; }
        st.depth++; st.opened = true; out += span('t-punct', '{'); i++; lastRef = false; continue;
      }
      if (c === '}') {
        if (inParams) { out += span('t-punct', '}'); i++; continue; }
        st.depth--; out += span('t-punct', '}'); i++; lastRef = false;
        if (st.opened && st.depth <= 0) { st.inRec = false; st.depth = 0; }
        continue;
      }
      if (c === '"') { m = at(RE.str, s, i); out += span(inParams ? 't-str' : 't-free', m); i += m.length; lastRef = false; continue; }
      if (c === '@') {
        m = at(RE.kw, s, i);
        if (m) { out += span(/^@rnl$/i.test(m) ? 't-rec' : 't-kw', m); i += m.length; afterKw = true; lastRef = false; continue; }
      }
      if (c === '#' && (m = at(RE.inst, s, i))) { out += span('t-inst', m); i += m.length; lastRef = true; continue; }
      if (c === '&' && (m = at(RE.net, s, i))) { out += span('t-net', m); i += m.length; lastRef = true; continue; }
      if (c === '%' && (m = at(RE.obj, s, i))) { out += span('t-obj', m); i += m.length; lastRef = true; continue; }
      if (c === '$' && (m = at(RE.def, s, i))) { out += span('t-def', m); i += m.length; lastRef = false; continue; }
      if (c === '?' && (m = at(RE.slot, s, i))) { out += span('t-slot', m); i += m.length; lastRef = true; continue; }
      if (c === '<' && (m = at(RE.pt, s, i))) { out += span('t-pt', m); i += m.length; lastRef = true; continue; }
      if (c === '[') { st.brack++; out += span(inParams ? 't-punct' : 't-free', c); i++; continue; }
      if (c === ']') { st.brack = Math.max(0, st.brack - 1); out += span(inParams ? 't-punct' : 't-free', c); i++; continue; }
      if (c === ';' || c === '|' || c === '=') { out += span('t-punct', c); i++; lastRef = false; continue; }
      if (c === ',') { out += span(inParams ? 't-punct' : 't-free', c); i++; continue; }
      if (/[-+.\d]/.test(c) && (m = at(RE.num, s, i))) {
        /* 数字后紧跟字母（如 2O）不是合法的数：标出来 */
        var glued = inParams && /[A-Za-z_]/.test(s.charAt(i + m.length));
        out += span(glued ? 't-bad' : inParams ? 't-num' : 't-free', m); i += m.length; lastRef = false; continue;
      }
      if (/[A-Za-z_]/.test(c) && (m = at(RE.ident, s, i))) {
        if (inParams && /\d/.test(s.charAt(i - 1))) {
          out += span('t-bad', m);
        } else if (inParams) {
          var j = i + m.length;
          while (j < n && s.charAt(j) === ' ') j++;
          out += span(s.charAt(j) === '=' ? 't-pn' : 't-lit', m);
        } else out += span('t-free', m);
        i += m.length; lastRef = false; continue;
      }
      m = at(RE.word, s, i);
      if (m) { out += span('t-free', m); i += m.length; lastRef = false; continue; }
      out += span('t-free', c); i++;
    }
    return out;
  }

  /* 整个文件：返回每行的 HTML 与种类 */
  function hlFile(texts) {
    var st = new State();
    return texts.map(function (text) {
      var m = /^(\s*)(\*|\/\/)(.*)$/.exec(text);
      if (m && (st.inRec || st.inCmt || /@rnl\b/i.test(m[3]))) {
        return { html: esc(m[1]) + span('t-pref', m[2]) + hlRnl(m[3], st), rnl: true };
      }
      if (m) return { html: esc(m[1]) + span('t-pref', m[2]) + span('t-cmt', m[3]), cmt: true };
      if (!text.trim()) return { html: '', blank: true };
      return { html: hlSpice(text), host: true };
    });
  }

  /* 记录内部的片段（不带宿主前缀），用于行内示例 */
  function hlSnippet(text) {
    var st = new State();
    st.inRec = true; st.opened = true; st.depth = 1;
    return hlRnl(text, st);
  }

  /* ---------- 代码面板 ---------- */

  function render(container, lines, opts) {
    opts = opts || {};
    var hl = hlFile(lines.map(function (l) { return l.t; }));
    var html = '';
    lines.forEach(function (l, i) {
      var h = hl[i];
      var cls = 'cl' + (h.rnl ? ' is-rnl' : '') + (l.r ? ' is-link' : '') + (l.cls ? ' ' + l.cls : '') + (l.mark ? ' ' + l.mark : '');
      html += '<div class="' + cls + '" data-i="' + i + '"' + (l.r ? ' data-refs="' + esc(l.r) + '" tabindex="0"' : '') + '>' +
        '<span class="ln" aria-hidden="true">' + (i + 1) + '</span><span class="tx">' + (h.html || ' ') + '</span></div>';
    });
    container.innerHTML = html;
    return Array.prototype.slice.call(container.querySelectorAll('.cl'));
  }

  /* 代码行与图互相高亮：悬停某行高亮它引用的对象；悬停图里的对象，标出引用它的行 */
  function link(container, lines, view, opts) {
    opts = opts || {};
    var current = -1;
    function rows() { return Array.prototype.slice.call(container.querySelectorAll('.cl')); }
    function setLine(i) {
      if (i === current) return;
      current = i;
      rows().forEach(function (r) { r.classList.remove('is-hot'); });
      if (i < 0) {
        if (view) { view.highlight(null); if (opts.modes) view.setMode(null); }
        if (opts.onLine) opts.onLine(-1, null);
        return;
      }
      var l = lines[i];
      var row = rows()[i];
      if (row) row.classList.add('is-hot');
      if (view) {
        if (opts.modes) view.setMode(l.mode || null);
        view.highlight(l.r ? l.r.split(/\s+/) : null);
      }
      if (opts.onLine) opts.onLine(i, l);
    }
    function fromEvent(e) {
      var row = e.target.closest ? e.target.closest('.cl') : null;
      if (!row || !container.contains(row)) return -1;
      var i = +row.getAttribute('data-i');
      return lines[i] && (lines[i].r || opts.allLines) ? i : -1;
    }
    container.addEventListener('mouseover', function (e) { setLine(fromEvent(e)); });
    container.addEventListener('mouseleave', function () { setLine(-1); });
    container.addEventListener('focusin', function (e) { setLine(fromEvent(e)); });
    container.addEventListener('focusout', function () { setLine(-1); });
    return {
      setLine: setLine,
      setLines: function (ls) { lines = ls; current = -1; },
      /* 图里悬停对象 → 标出引用它的行 */
      markRef: function (ref) {
        rows().forEach(function (r) {
          var refs = (r.getAttribute('data-refs') || '').split(/\s+/);
          r.classList.toggle('is-hot', !!ref && refs.indexOf(ref) >= 0);
        });
        if (view) view.highlight(ref ? [ref] : null);
      }
    };
  }

  global.RNLCode = { hlFile: hlFile, hlSnippet: hlSnippet, render: render, link: link, esc: esc };
})(window);
