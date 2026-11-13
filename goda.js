/*
 * GoDa漫画（Venera 兼容源，自动生成）
 * 配置来源：https://git.nyne.dev/nyne/venera-configs/raw/branch/main/goda.js
 * 由 tools/venera/build.mjs 生成，改配置请改上游，不要改这个文件。
 */
/**
 * Venera 兼容运行时（纯 JS，无宿主依赖）
 *
 * 目标：让为 Venera 写的 ComicSource 配置，能在「大肥鱼漫画」这类
 * 只提供 http / console 的同步 JS 宿主里跑起来。
 *
 * 提供：HtmlDocument（HTML 解析 + CSS 选择器）、Network（同步 HTTP 垫片）、
 *       ComicSource 基类、ComicDetails、Cookie。
 *
 * 约定：宿主必须提供全局 http（{get,post}）与 console。
 *       宿主返回 {status, body}；本运行时的 async 被调用前已被 build 步骤剥掉。
 */

var VeneraRuntime = (function () {
  "use strict";

  // ======================================================================
  // 1. HTML 解析
  // ======================================================================

  var VOID_TAGS = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
    link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
  };

  function findTagEnd(s, from) {
    var i = from;
    var quote = null;
    while (i < s.length) {
      var ch = s.charAt(i);
      if (quote) {
        if (ch === quote) { quote = null; }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        return i;
      }
      i++;
    }
    return -1;
  }

  function parseAttrs(raw) {
    var attrs = {};
    var re = /([a-zA-Z_:@][-a-zA-Z0-9_:.@]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    var m;
    while ((m = re.exec(raw)) !== null) {
      var name = m[1].toLowerCase();
      var value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ""));
      if (!(name in attrs)) { attrs[name] = value; }
    }
    return attrs;
  }

  function textOf(node) {
    var out = "";
    var kids = node.kids;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (!kid.tag) { out += (kid.text == null ? '' : kid.text); }
      else { out += textOf(kid); }
    }
    return out;
  }

  function elementChildren(node) {
    var out = [];
    for (var i = 0; i < node.kids.length; i++) {
      if (node.kids[i].tag) { out.push(node.kids[i]); }
    }
    return out;
  }

  function decorate(node) {
    Object.defineProperty(node, "attributes", {
      get: function () { return node.attrs; },
      enumerable: true
    });
    Object.defineProperty(node, "text", {
      get: function () { return textOf(node); },
      enumerable: true
    });
    Object.defineProperty(node, "children", {
      get: function () { return elementChildren(node); },
      enumerable: true
    });
    Object.defineProperty(node, "innerHTML", {
      get: function () { return serializeChildren(node); },
      enumerable: true
    });
    node.querySelector = function (sel) {
      var list = selectAll(node, sel);
      return list.length > 0 ? list[0] : null;
    };
    node.querySelectorAll = function (sel) { return selectAll(node, sel); };
    node.getAttribute = function (name) { return node.attrs[String(name).toLowerCase()]; };
    node.hasAttribute = function (name) { return Object.prototype.hasOwnProperty.call(node.attrs, String(name).toLowerCase()); };
    node.forEach = function () { /* 兼容误用的 element.forEach */ };
    Object.defineProperty(node, "classNames", {
      get: function () {
        var cls = node.attrs["class"] || "";
        return cls ? String(cls).split(/\s+/).filter(function (c) { return c.length > 0; }) : [];
      }
    });
    Object.defineProperty(node, "id", {
      get: function () { return node.attrs["id"] || ""; }
    });
    Object.defineProperty(node, "localName", {
      get: function () { return node.tag; }
    });
    Object.defineProperty(node, "previousElementSibling", {
      get: function () {
        var sibs = elementChildren(node.parent || node);
        var idx = sibs.indexOf(node);
        return idx > 0 ? sibs[idx - 1] : null;
      }
    });
    Object.defineProperty(node, "nextElementSibling", {
      get: function () {
        var sibs = elementChildren(node.parent || node);
        var idx = sibs.indexOf(node);
        return idx >= 0 && idx + 1 < sibs.length ? sibs[idx + 1] : null;
      }
    });
    return node;
  }

  function serializeChildren(node) {
    var out = "";
    for (var i = 0; i < node.kids.length; i++) {
      var kid = node.kids[i];
      if (kid.text !== undefined) { out += kid.text; continue; }
      out += "<" + kid.tag;
      for (var k in kid.attrs) {
        if (Object.prototype.hasOwnProperty.call(kid.attrs, k)) {
          out += " " + k + '="' + String(kid.attrs[k]).replace(/"/g, "&quot;") + '"';
        }
      }
      out += ">" + serializeChildren(kid) + "</" + kid.tag + ">";
    }
    return out;
  }

  function parseHTML(html) {
    var src = String(html == null ? "" : html);
    var root = { tag: "#document", attrs: {}, kids: [], parent: null };
    var stack = [root];
    var i = 0;

    function currentParent() { return stack[stack.length - 1]; }

    function pushText(t) {
      if (!t) { return; }
      var parent = currentParent();
      parent.kids.push({ tag: null, text: t, parent: parent });
    }

    while (i < src.length) {
      var lt = src.indexOf("<", i);
      if (lt < 0) { pushText(src.slice(i)); break; }
      if (lt > i) { pushText(src.slice(i, lt)); }

      if (src.substr(lt, 4) === "<!--") {
        var endComment = src.indexOf("-->", lt + 4);
        i = endComment < 0 ? src.length : endComment + 3;
        continue;
      }
      if (src.substr(lt, 2) === "<!" || src.substr(lt, 2) === "<?") {
        var endDecl = src.indexOf(">", lt);
        i = endDecl < 0 ? src.length : endDecl + 1;
        continue;
      }

      var gt = findTagEnd(src, lt);
      if (gt < 0) { pushText(src.slice(lt)); break; }

      var raw = src.slice(lt + 1, gt);
      if (raw.charAt(0) === "/") {
        var closeName = raw.slice(1).trim().toLowerCase();
        for (var k = stack.length - 1; k > 0; k--) {
          if (stack[k].tag === closeName) { stack.length = k; break; }
        }
        i = gt + 1;
        continue;
      }

      var selfClose = false;
      if (raw.charAt(raw.length - 1) === "/") { selfClose = true; raw = raw.slice(0, -1); }

      var nameMatch = /^([a-zA-Z0-9:_-]+)/.exec(raw);
      var tag = nameMatch ? nameMatch[1].toLowerCase() : "";
      if (!tag) { i = gt + 1; continue; }

      var node = {
        tag: tag,
        attrs: parseAttrs(raw.slice(tag.length)),
        kids: [],
        parent: currentParent()
      };
      currentParent().kids.push(node);
      i = gt + 1;

      if (!selfClose && !VOID_TAGS[tag]) {
        stack.push(node);
      }

      // script / style / textarea 内部当作原始文本
      if (!selfClose && (tag === "script" || tag === "style")) {
        var closeTag = src.toLowerCase().indexOf("</" + tag, i);
        if (closeTag >= 0) {
          var innerEnd = src.indexOf(">", closeTag);
          if (innerEnd > i) { node.kids.push({ tag: null, text: src.slice(i, closeTag), parent: node }); }
          i = innerEnd < 0 ? src.length : innerEnd + 1;
          if (stack.length > 1 && stack[stack.length - 1] === node) { stack.pop(); }
        }
      }
    }

    decorateTree(root);
    return root;
  }

  function decorateTree(node) {
    if (node.tag) { decorate(node); }
    for (var i = 0; i < node.kids.length; i++) {
      if (node.kids[i].tag) { decorateTree(node.kids[i]); }
    }
  }

  // ======================================================================
  // 2. CSS 选择器（支持 tag / .class / #id / [attr] / [attr=value]
  //    / 后代(空格) / 子级(>) / 相邻(+) / :first-child / :last-child
  //    / :nth-child(n) / :not(sel) / 逗号分组）
  // ======================================================================

  var COMPOUND_RE = /([*a-zA-Z0-9_-]+)|\.([\w-]+)|#([\w-]+)|\[\s*([\w-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*))\s*)?\]|:([\w-]+)(?:\(([^)]*)\))?/g;

  function tokenizeSelector(selector) {
    var tokens = [];
    var part = "";
    var combinator = null; // null | " " | ">" | "+"
    var i = 0;
    var s = String(selector).trim();

    function flush() {
      if (part) {
        tokens.push({ part: part, combinator: tokens.length === 0 ? null : (combinator || " ") });
        part = "";
        combinator = null;
      }
    }

    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === " " || ch === ">" || ch === "+" || ch === "~") {
        flush();
        if (ch === ">" || ch === "+" || ch === "~") { combinator = ch; }
        i++;
        continue;
      }
      part += ch;
      i++;
    }
    flush();
    return tokens;
  }

  function parseCompound(part) {
    var tests = [];
    var m;
    COMPOUND_RE.lastIndex = 0;
    while ((m = COMPOUND_RE.exec(part)) !== null) {
      if (m[1]) {
        var tagName = m[1].toLowerCase();
        if (tagName !== "*") { tests.push({ kind: "tag", tag: tagName }); }
      } else if (m[2]) {
        tests.push({ kind: "class", name: m[2] });
      } else if (m[3]) {
        tests.push({ kind: "id", name: m[3] });
      } else if (m[4]) {
        var attrName = m[4].toLowerCase();
        var op = m[5];
        var attrValue = m[6] !== undefined ? m[6] : (m[7] !== undefined ? m[7] : (m[8] !== undefined ? m[8] : ""));
        tests.push({ kind: "attr", name: attrName, op: op, value: attrValue });
      } else if (m[9]) {
        tests.push({ kind: "pseudo", name: m[9].toLowerCase(), arg: m[10] });
      }
    }
    return tests;
  }

  function matchCompound(node, tests) {
    if (!node || !node.tag) { return false; }
    for (var i = 0; i < tests.length; i++) {
      var t = tests[i];
      if (t.kind === "tag") {
        if (node.tag !== t.tag) { return false; }
      } else if (t.kind === "class") {
        var classes = " " + (node.attrs["class"] || "") + " ";
        if (classes.indexOf(" " + t.name + " ") < 0) { return false; }
      } else if (t.kind === "id") {
        if ((node.attrs["id"] || "") !== t.name) { return false; }
      } else if (t.kind === "attr") {
        if (!Object.prototype.hasOwnProperty.call(node.attrs, t.name)) { return false; }
        if (t.op) {
          var actual = String(node.attrs[t.name]);
          var expected = String(t.value == null ? "" : t.value);
          if (t.op === "=" && actual !== expected) { return false; }
          if (t.op === "~=" && (" " + actual + " ").indexOf(" " + expected + " ") < 0) { return false; }
          if (t.op === "^=" && actual.indexOf(expected) !== 0) { return false; }
          if (t.op === "$=" && actual.slice(-expected.length) !== expected) { return false; }
          if (t.op === "*=" && actual.indexOf(expected) < 0) { return false; }
          if (t.op === "|=" && actual !== expected && actual.indexOf(expected + "-") !== 0) { return false; }
        }
      } else if (t.kind === "pseudo") {
        if (!matchPseudo(node, t.name, t.arg)) { return false; }
      }
    }
    return true;
  }

  function siblings(node) {
    var parent = node.parent;
    if (!parent) { return [node]; }
    return elementChildren(parent);
  }

  function matchPseudo(node, name, arg) {
    var sibs = siblings(node);
    var index = sibs.indexOf(node);
    if (name === "first-child") { return index === 0; }
    if (name === "last-child") { return index === sibs.length - 1; }
    if (name === "only-child") { return sibs.length === 1; }
    if (name === "nth-child") {
      var n = parseInt(arg, 10);
      if (!isFinite(n)) { return false; }
      return index === n - 1;
    }
    if (name === "not") {
      var inner = parseCompound(String(arg || ""));
      return !matchCompound(node, inner);
    }
    return true; // 未知伪类放行，宁可多匹配也不要整站空结果
  }

  function matchesChain(node, tokens, tokenIndex) {
    var token = tokens[tokenIndex];
    var tests = parseCompound(token.part);
    if (!matchCompound(node, tests)) { return false; }
    if (tokenIndex === 0) { return true; }

    var prevToken = tokens[tokenIndex - 1];
    var combinator = token.combinator || " ";

    if (combinator === ">") {
      return node.parent && node.parent.tag ? matchesChain(node.parent, tokens, tokenIndex - 1) : false;
    }
    if (combinator === "+") {
      var sibs = siblings(node);
      var idx = sibs.indexOf(node);
      return idx > 0 ? matchesChain(sibs[idx - 1], tokens, tokenIndex - 1) : false;
    }
    if (combinator === "~") {
      var sibs2 = siblings(node);
      var idx2 = sibs2.indexOf(node);
      for (var k = idx2 - 1; k >= 0; k--) {
        if (matchesChain(sibs2[k], tokens, tokenIndex - 1)) { return true; }
      }
      return false;
    }
    // 后代
    var anc = node.parent;
    while (anc && anc.tag) {
      if (matchesChain(anc, tokens, tokenIndex - 1)) { return true; }
      anc = anc.parent;
    }
    return false;
  }

  function walkElements(node, visit) {
    var kids = node.kids;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (!kid.tag) { continue; }
      visit(kid);
      walkElements(kid, visit);
    }
  }

  function selectAll(root, selector) {
    var out = [];
    var groups = String(selector).split(",");
    var tokenGroups = [];
    for (var g = 0; g < groups.length; g++) {
      var trimmed = groups[g].trim();
      if (!trimmed) { continue; }
      tokenGroups.push(tokenizeSelector(trimmed));
    }
    if (tokenGroups.length === 0) { return out; }

    walkElements(root, function (el) {
      for (var t = 0; t < tokenGroups.length; t++) {
        var tokens = tokenGroups[t];
        if (tokens.length > 0 && matchesChain(el, tokens, tokens.length - 1)) {
          out.push(el);
          return;
        }
      }
    });
    return out;
  }

  // ======================================================================
  // 3. 宿主垫片：Network / ComicSource / ComicDetails / Cookie / HtmlDocument
  // ======================================================================

  function hostRequest(method, url, headers, body) {
    if (typeof http === "undefined") { throw new Error("宿主没有提供 http"); }
    var result;
    if (method === "POST") {
      result = http.post(url, body == null ? "" : String(body), headers || null);
    } else {
      result = http.get(url, headers || null);
    }
    return {
      status: result && result.status !== undefined ? result.status : 200,
      body: result && result.body !== undefined ? String(result.body) : "",
      headers: {}
    };
  }

  var cookieJar = {};

  function cookieHeaderFor(url) {
    var host = "";
    var m = /^https?:\/\/([^\/]+)/i.exec(String(url));
    if (m) { host = m[1]; }
    var parts = [];
    for (var domain in cookieJar) {
      if (!Object.prototype.hasOwnProperty.call(cookieJar, domain)) { continue; }
      if (host === domain || host.slice(-domain.length - 1) === "." + domain) {
        for (var name in cookieJar[domain]) {
          if (Object.prototype.hasOwnProperty.call(cookieJar[domain], name)) {
            parts.push(name + "=" + cookieJar[domain][name]);
          }
        }
      }
    }
    return parts.join("; ");
  }

  function mergeHeaders(url, headers) {
    var merged = {};
    if (headers) {
      for (var k in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, k)) { merged[k] = headers[k]; }
      }
    }
    var cookie = cookieHeaderFor(url);
    if (cookie) { merged["Cookie"] = cookie; }
    return merged;
  }

  var Network = {
    get: function (url, headers) {
      return hostRequest("GET", url, mergeHeaders(url, headers), null);
    },
    post: function (url, headers, body) {
      return hostRequest("POST", url, mergeHeaders(url, headers), body);
    },
    setCookies: function (domain, cookies) {
      var jar = cookieJar[domain] || (cookieJar[domain] = {});
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i];
        if (c && c.name) { jar[c.name] = c.value; }
      }
    },
    deleteCookies: function (domain) {
      if (domain) { delete cookieJar[domain]; } else { cookieJar = {}; }
    }
  };

  function Cookie(options) {
    options = options || {};
    this.name = options.name || "";
    this.value = options.value || "";
    this.domain = options.domain || "";
    this.path = options.path || "/";
    this.expires = options.expires;
    this.secure = !!options.secure;
    this.httpOnly = !!options.httpOnly;
  }

  function HtmlDocument(html) {
    this.root = parseHTML(html);
    this.html = String(html == null ? "" : html);
  }
  HtmlDocument.prototype.querySelector = function (sel) {
    var list = selectAll(this.root, sel);
    return list.length > 0 ? list[0] : null;
  };
  HtmlDocument.prototype.querySelectorAll = function (sel) {
    return selectAll(this.root, sel);
  };
  Object.defineProperty(HtmlDocument.prototype, "text", {
    get: function () { return textOf(this.root); }
  });

  function ComicDetails(options) {
    options = options || {};
    this.title = options.title || "";
    this.subtitle = options.subtitle || options.subTitle || "";
    this.subTitle = this.subtitle;
    this.cover = options.cover || null;
    this.description = options.description || "";
    this.tags = options.tags || {};
    this.chapters = options.chapters || new Map();
    this.recommend = options.recommend || [];
    this.updateTime = options.updateTime || null;
    this.status = options.status || null;
    this.isFavorite = options.isFavorite;
    this.subId = options.subId;
  }

  function Comic(options) {
    options = options || {};
    this.id = options.id == null ? "" : String(options.id);
    this.title = options.title || "";
    this.subtitle = options.subtitle || options.subTitle || "";
    this.subTitle = this.subtitle;
    this.cover = options.cover || null;
    this.tags = options.tags || [];
    this.description = options.description || "";
    this.maxPage = options.maxPage;
    this.language = options.language;
  }

  function ComicSource() {}
  ComicSource.prototype.translate = function (key) { return key; };
  Object.defineProperty(ComicSource.prototype, "isLogged", {
    get: function () { return false; }
  });
  ComicSource.prototype.init = function () { };
  ComicSource.prototype.loadSetting = function (key) {
    var meta = this.settings ? this.settings[key] : null;
    if (meta && meta.default !== undefined) { return meta.default; }
    return null;
  };
  ComicSource.prototype.saveSetting = function () { /* 设置项暂不持久化 */ };
  ComicSource.prototype.setSetting = ComicSource.prototype.saveSetting;
  // 源配置里的本地存储（登录 token、设备指纹等）。宿主每次调用都是全新上下文，
  // 所以这里做成内存态：匿名使用不受影响，登录态需要等后续支持。
  ComicSource.prototype.loadData = function () { return null; };
  ComicSource.prototype.saveData = function () { };
  ComicSource.prototype.deleteData = function () { };

  // ======================================================================
  // 3.5 加密 / 编码（纯 JS，不依赖宿主）
  // ======================================================================

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function utf8Bytes(str) {
    var s = String(str);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
        var next = s.charCodeAt(i + 1);
        var cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        i++;
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return out;
  }

  function sha256Bytes(bytes) {
    var msg = bytes.slice(0);
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) { msg.push(0); }
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    msg.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);

    for (var offset = 0; offset < msg.length; offset += 64) {
      for (var i = 0; i < 16; i++) {
        w[i] = ((msg[offset + i * 4] << 24) | (msg[offset + i * 4 + 1] << 16) |
                (msg[offset + i * 4 + 2] << 8) | msg[offset + i * 4 + 3]) >>> 0;
      }
      for (var j = 16; j < 64; j++) {
        var s0 = (rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
        var s1 = (rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var k = 0; k < 64; k++) {
        var S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (hh + S1 + ch + SHA256_K[k] + w[k]) >>> 0;
        var S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e;
        e = (d + temp1) >>> 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }

    var out = [];
    for (var m2 = 0; m2 < 8; m2++) {
      out.push((h[m2] >>> 24) & 0xff, (h[m2] >>> 16) & 0xff, (h[m2] >>> 8) & 0xff, h[m2] & 0xff);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    }
    return hex;
  }

  function hmacSha256Hex(keyBytes, msgBytes) {
    var blockSize = 64;
    var key = keyBytes.slice(0);
    if (key.length > blockSize) { key = sha256Bytes(key); }
    while (key.length < blockSize) { key.push(0); }
    var oKey = [];
    var iKey = [];
    for (var i = 0; i < blockSize; i++) {
      oKey.push(key[i] ^ 0x5c);
      iKey.push(key[i] ^ 0x36);
    }
    var inner = sha256Bytes(iKey.concat(msgBytes));
    return bytesToHex(sha256Bytes(oKey.concat(inner)));
  }

  function bytesToBase64(bytes) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var b1 = bytes[i++];
      var b2 = i < bytes.length ? bytes[i++] : NaN;
      var b3 = i < bytes.length ? bytes[i++] : NaN;
      var e1 = b1 >> 2;
      var e2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
      var e3 = isNaN(b2) ? 64 : (((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6));
      var e4 = isNaN(b3) ? 64 : (b3 & 63);
      out += chars.charAt(e1) + chars.charAt(e2) +
        (e3 === 64 ? "=" : chars.charAt(e3)) +
        (e4 === 64 ? "=" : chars.charAt(e4));
    }
    return out;
  }

  function base64ToBytes(text) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var clean = String(text).replace(/[^A-Za-z0-9+/=]/g, "");
    var out = [];
    var i = 0;
    while (i < clean.length) {
      var e1 = chars.indexOf(clean.charAt(i++));
      var e2 = chars.indexOf(clean.charAt(i++));
      var e3 = chars.indexOf(clean.charAt(i++));
      var e4 = chars.indexOf(clean.charAt(i++));
      if (e2 < 0) { break; }
      out.push(((e1 << 2) | (e2 >> 4)) & 0xff);
      if (e3 >= 0) { out.push((((e2 & 15) << 4) | (e3 >> 2)) & 0xff); }
      if (e4 >= 0) { out.push((((e3 & 3) << 6) | e4) & 0xff); }
    }
    return out;
  }

  var Convert = {
    encodeUtf8: function (text) { return utf8Bytes(text); },
    decodeUtf8: function (bytes) {
      var out = "";
      for (var i = 0; i < bytes.length; i++) { out += String.fromCharCode(bytes[i]); }
      return out;
    },
    encodeBase64: function (bytes) { return bytesToBase64(bytes); },
    decodeBase64: function (text) { return base64ToBytes(text); },
    encodeBase64String: function (text) { return bytesToBase64(utf8Bytes(text)); },
    decodeBase64String: function (text) {
      var bytes = base64ToBytes(text);
      var out = "";
      for (var i = 0; i < bytes.length; i++) { out += String.fromCharCode(bytes[i]); }
      return out;
    },
    sha256String: function (bytes) { return bytesToHex(sha256Bytes(bytes)); },
    sha256: function (bytes) { return sha256Bytes(bytes); },
    hexEncode: function (bytes) { return bytesToHex(bytes); },
    hmacString: function (keyBytes, msgBytes, algo) {
      if (algo && String(algo).toLowerCase() !== "sha256") {
        throw new Error("只实现了 hmac sha256，收到：" + algo);
      }
      return hmacSha256Hex(keyBytes, msgBytes);
    }
  };

  // ======================================================================
  // 4. 导出
  // ======================================================================

  return {
    parseHTML: parseHTML,
    selectAll: selectAll,
    Network: Network,
    Cookie: Cookie,
    HtmlDocument: HtmlDocument,
    ComicDetails: ComicDetails,
    Comic: Comic,
    ComicSource: ComicSource,
    Convert: Convert,
    utf8Bytes: utf8Bytes,
    sha256Hex: function (bytes) { return bytesToHex(sha256Bytes(bytes)); },
    hmacSha256Hex: hmacSha256Hex,
    base64ToBytes: base64ToBytes,
    bytesToBase64: bytesToBase64
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = VeneraRuntime;
}


// ===================== Venera 适配层（自动生成，勿手改） =====================
var __CONFIG_URL = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/goda.js";
var __META = {"id":"goda","name":"GoDa漫画","lang":"zh","version":1};

var ComicSource = VeneraRuntime.ComicSource;
var ComicDetails = VeneraRuntime.ComicDetails;
var Comic = VeneraRuntime.Comic;
var Network = VeneraRuntime.Network;
var HtmlDocument = VeneraRuntime.HtmlDocument;
var Cookie = VeneraRuntime.Cookie;
var Convert = VeneraRuntime.Convert;

// Venera 里额外提供的一些全局
var APP = {
  version: "1.6.0",
  buildNumber: 0,
  locale: "zh_CN",
  platform: "ios"
};

var UI = {
  showMessage: function (message) { console.log("[UI] " + message); },
  showDialog: function (title, content) { console.log("[UI] " + title + " / " + content); },
  launchUrl: function (url) { console.log("[UI] 打开链接：" + url); },
  showLoading: function () { return 0; },
  cancelLoading: function () { },
  showInputDialog: function () { throw new Error("这个源需要输入框交互，暂不支持"); },
  showSelectDialog: function () { throw new Error("这个源需要选择框交互，暂不支持"); }
};

function randomInt(min, max) {
  var lo = Math.ceil(min);
  var hi = Math.floor(max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function randomDouble(min, max) {
  return min + Math.random() * (max - min);
}

function createUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    var v = c === "x" ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function setTimeout(fn) {
  if (typeof fn === "function") { fn(); }
  return 0;
}

function setInterval(fn) {
  return { cancel: function () { } };
}

function setClipboard() { }
function getClipboard() { return ""; }
function compute() { throw new Error("compute 暂不支持"); }

/** Promise.all 在同步宿主里等价于直接返回数组（元素都已是结果值） */
function __promiseAll(list) { return list; }

/** fetch 的同步垫片：只覆盖配置里常见的 status / text() / json() 用法 */
function fetch(url, options) {
  var method = (options && options.method) ? String(options.method).toUpperCase() : "GET";
  var headers = options && options.headers ? options.headers : null;
  var body = options && options.body ? options.body : null;
  var res;
  if (method === "POST") {
    res = http.post(url, body == null ? "" : String(body), headers);
  } else {
    res = http.get(url, headers);
  }
  var text = res && res.body != null ? String(res.body) : "";
  return {
    status: res && res.status !== undefined ? res.status : 200,
    ok: (res && res.status !== undefined ? res.status : 200) < 400,
    statusText: "",
    headers: { get: function () { return null; } },
    arrayBuffer: function () { return Convert.encodeUtf8(text); },
    text: function () { return text; },
    json: function () { return JSON.parse(text); }
  };
}

function atob(text) { return Convert.decodeBase64String(String(text)); }
function btoa(text) { return Convert.encodeBase64String(String(text)); }
function error() { }

var __captured = null;
var __instanceCache = null;

/** 把 Venera 配置里的 async / await 去掉（宿主是同步 HTTP，await 一个非 Promise 值本来就是空操作） */
function __stripAsync(code) {
  var out = "";
  var i = 0;
  var n = code.length;
  var state = 0; // 0=代码 1=单引号 2=双引号 3=模板串 4=行注释 5=块注释
  while (i < n) {
    var ch = code.charAt(i);
    if (state === 4) {
      out += ch;
      if (ch === "\n") { state = 0; }
      i++;
      continue;
    }
    if (state === 5) {
      out += ch;
      if (ch === "*" && code.charAt(i + 1) === "/") { out += "/"; i += 2; state = 0; continue; }
      i++;
      continue;
    }
    if (state === 1 || state === 2) {
      out += ch;
      if (ch === "\\") { out += code.charAt(i + 1); i += 2; continue; }
      if ((state === 1 && ch === "'") || (state === 2 && ch === '"')) { state = 0; }
      i++;
      continue;
    }
    if (state === 3) {
      out += ch;
      if (ch === "\\") { out += code.charAt(i + 1); i += 2; continue; }
      if (ch === "`") { state = 0; }
      i++;
      continue;
    }
    // state 0
    if (ch === "/" && code.charAt(i + 1) === "/") { state = 4; out += ch; i++; continue; }
    if (ch === "/" && code.charAt(i + 1) === "*") { state = 5; out += ch; i++; continue; }
    if (ch === "'") { state = 1; out += ch; i++; continue; }
    if (ch === '"') { state = 2; out += ch; i++; continue; }
    if (ch === "`") { state = 3; out += ch; i++; continue; }
    if (/[A-Za-z_$]/.test(ch)) {
      var start = i;
      while (i < n && /[A-Za-z0-9_$]/.test(code.charAt(i))) { i++; }
      var word = code.slice(start, i);
      if (word === "async" || word === "await") {
        out += " "; // 直接吃掉关键字
      } else {
        out += word;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function __loadConfigText() {
  var res = http.get(__CONFIG_URL, { "User-Agent": "FishManga/1.0 (venera-loader)" });
  if (!res || res.status === undefined) { throw new Error("宿主没有返回响应"); }
  if (res.status >= 400) { throw new Error("源配置下载失败：HTTP " + res.status); }
  var body = res.body == null ? "" : String(res.body);
  if (!body) { throw new Error("源配置是空的（URL 可能失效）"); }
  return body;
}

function __instance() {
  if (__instanceCache) { return __instanceCache; }
  var raw = __loadConfigText();
  var m = /class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+extends\s+ComicSource/.exec(raw);
  if (!m) { throw new Error("这不是 Venera 源配置（没找到 extends ComicSource 的类）"); }
  var className = m[1];
  var code = __stripAsync(raw).split("Promise.all(").join("__promiseAll(");
  eval(code + "\n__captured = new (" + className + ")();");
  if (!__captured) { throw new Error("源实例化失败"); }
  try {
    if (typeof __captured.init === "function") { __captured.init(); }
  } catch (e) {
    console.log("[venera] init() 抛错（已忽略）：" + e);
  }
  __instanceCache = __captured;
  return __instanceCache;
}

function __abs(url, inst) {
  var text = url == null ? "" : String(url).trim();
  if (!text) { return ""; }
  if (/^https?:\/\//i.test(text)) { return text; }
  var base = "";
  try { base = inst && inst.baseUrl ? String(inst.baseUrl) : ""; } catch (e) { base = ""; }
  if (!base) { return text; }
  if (text.charAt(0) === "/") { return base.replace(/\/+$/, "") + text; }
  return base.replace(/\/+$/, "") + "/" + text;
}

function __toItem(comic, inst) {
  if (!comic) { return null; }
  var tags = comic.tags;
  if (!Array.isArray(tags)) { tags = tags ? [String(tags)] : []; }
  return {
    id: String(comic.id == null ? "" : comic.id),
    mangaID: String(comic.id == null ? "" : comic.id),
    title: comic.title == null ? "" : String(comic.title),
    cover: comic.cover ? __abs(comic.cover, inst) : null,
    author: comic.subTitle == null ? "" : String(comic.subTitle),
    description: comic.description == null ? "" : String(comic.description),
    tags: tags.map(function (t) { return String(t); })
  };
}

function __fromDetails(details, inst, fallbackID) {
  if (!details) { throw new Error("源没有返回漫画详情"); }
  var tagsMap = details.tags || {};
  var author = "";
  if (tagsMap["作者"] && tagsMap["作者"].length > 0) {
    author = tagsMap["作者"].join(" / ");
  } else if (details.subTitle) {
    author = String(details.subTitle);
  }
  /* 是否显示 tags 上的各种字段？控制一下，别把整张表塞进去 */
  var extraTags = [];
  for (var key in tagsMap) {
    if (!Object.prototype.hasOwnProperty.call(tagsMap, key)) { continue; }
    if (key === "作者") { continue; }
    var list = tagsMap[key];
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) { extraTags.push(String(list[i])); }
    }
  }
  return {
    id: String(fallbackID == null ? "" : fallbackID),
    mangaID: String(fallbackID == null ? "" : fallbackID),
    title: details.title == null ? "" : String(details.title),
    cover: details.cover ? __abs(details.cover, inst) : null,
    author: author,
    description: details.description == null ? "" : String(details.description),
    tags: extraTags
  };
}

function __search(query, page) {
  var inst = __instance();
  if (!inst.search || typeof inst.search.load !== "function") {
    throw new Error("这个源没有提供搜索接口");
  }
  var pageNumber = (typeof page === "number" && page >= 0) ? page + 1 : 1;
  var res = inst.search.load(query, [], pageNumber);
  if (!res || !res.comics) { return []; }
  var out = [];
  for (var i = 0; i < res.comics.length; i++) {
    var item = __toItem(res.comics[i], inst);
    if (item && item.id) { out.push(item); }
  }
  console.log("[venera] " + __META.name + " 搜索命中 " + out.length + " 条");
  return out;
}

function __detail(mangaID) {
  var inst = __instance();
  if (!inst.comic || typeof inst.comic.loadInfo !== "function") {
    throw new Error("这个源没有提供详情接口");
  }
  var details = inst.comic.loadInfo(mangaID);
  return __fromDetails(details, inst, mangaID);
}

function __chapters(mangaID) {
  var inst = __instance();
  var details = inst.comic.loadInfo(mangaID);
  var out = [];
  var map = details ? details.chapters : null;
  if (!map) { return out; }
  if (typeof map.forEach === "function") {
    var index = 0;
    map.forEach(function (title, key) {
      out.push({
        id: String(key),
        chapterID: String(key),
        title: title == null ? ("第 " + (index + 1) + " 话") : String(title),
        number: index
      });
      index++;
    });
  } else if (Object.prototype.toString.call(map) === "[object Array]") {
    for (var i = 0; i < map.length; i++) {
      out.push({ id: String(i), chapterID: String(i), title: String(map[i]), number: i });
    }
  }
  return out;
}

function __pages(mangaID, chapterID) {
  var inst = __instance();
  if (!inst.comic || typeof inst.comic.loadEp !== "function") {
    throw new Error("这个源没有提供图片接口");
  }
  var res = inst.comic.loadEp(mangaID, chapterID);
  var images = (res && res.images) ? res.images : [];
  var out = [];
  for (var i = 0; i < images.length; i++) {
    var url = __abs(images[i], inst);
    if (url) { out.push(url); }
  }
  console.log("[venera] " + __META.name + " 图片 " + out.length + " 页");
  return out;
}

var source = {
  id: __META.id,
  name: __META.name,
  lang: __META.lang || "zh",
  version: __META.version || 1,
  baseUrl: "",
  icon: "",
  search: __search,
  detail: __detail,
  chapters: __chapters,
  pages: __pages
};
