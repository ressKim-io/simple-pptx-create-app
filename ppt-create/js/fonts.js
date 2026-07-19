/* ============================================================
   fonts — 글꼴 해석: 현재 글꼴, 설치 여부 검사, 글꼴 파일 name table 파싱
   ============================================================ */
import { FONTS, FB } from './config.js';
import { timeout } from './utils.js';
import { state } from './state.js';

// 이 컴퓨터에 실제로 설치된 글꼴인지 검사.
// document.fonts.check() 는 로컬 글꼴에 대해 없는 이름도 true 를 주므로 못 쓴다.
// 대신 기준 글꼴 두 개와 폭을 비교 — 둘 다 폭이 같으면 대체 글꼴로 그려진 것 = 없는 글꼴.
var probeCtx = null, probeCache = {};
export function fontInstalled(name) {
  name = (name || '').replace(/["\\]/g, '').trim();
  if (!name) return true;
  if (name in probeCache) return probeCache[name];
  if (!probeCtx) probeCtx = document.createElement('canvas').getContext('2d');
  var sample = '주 은혜임을 Handgloves 0123';
  function w(fam) {
    probeCtx.font = '600 72px ' + fam;
    return probeCtx.measureText(sample).width;
  }
  var q = '"' + name + '"';
  var hit = !(w(q + ',monospace') === w('monospace') && w(q + ',serif') === w('serif'));
  probeCache[name] = hit;
  return hit;
}

// 커스텀 글꼴이 이 컴퓨터에 없으면 그 이름, 아니면 ''
export function missingFontName() {
  if (state.fontKey !== 'custom' || !state.customFont) return '';
  if (state.customFontMeta) return '';   // 목록에서 고른 글꼴 — 설치돼 있음이 확실
  return fontInstalled(state.customFont) ? '' : state.customFont;
}

/* ---------- 글꼴 파일의 이름표(name table) 읽기 ----------
   같은 글꼴이라도 프로그램마다 부르는 이름이 다르다:
   - 브라우저(DirectWrite)는 nameID 16 "대표 가족명" — Light/Bold 를 하나로 묶은 이름
   - 파워포인트(GDI)는 nameID 1 — 굵기별로 쪼개진 이름 (예: "Kim jung chul Gothic Light")
   브라우저 목록의 이름을 그대로 pptx 에 적으면 파워포인트가 "없는 글꼴"로 취급하므로,
   글꼴 파일에서 nameID 1 을 직접 꺼내 그 이름을 적어야 한다. */
function parseSfntNames(buf) {
  var dv = new DataView(buf);
  function tableAt(base) {
    var num = dv.getUint16(base + 4);
    for (var i = 0; i < num; i++) {
      var o = base + 12 + i * 16;
      var tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
      if (tag === 'name') return nameAt(dv.getUint32(o + 8));
    }
    return [];
  }
  function nameAt(off) {
    var count = dv.getUint16(off + 2), strOff = off + dv.getUint16(off + 4), out = [];
    for (var i = 0; i < count; i++) {
      var r = off + 6 + i * 12;
      var p = dv.getUint16(r), l = dv.getUint16(r + 4), id = dv.getUint16(r + 6);
      var len = dv.getUint16(r + 8), so = strOff + dv.getUint16(r + 10), s = '';
      if (so + len > dv.byteLength) continue;
      if (p === 3 || p === 0) { for (var j = 0; j + 1 < len; j += 2) s += String.fromCharCode(dv.getUint16(so + j)); }
      else { for (var k = 0; k < len; k++) s += String.fromCharCode(dv.getUint8(so + k)); }
      if (s) out.push({ p: p, l: l, id: id, s: s });
    }
    return out;
  }
  if (dv.getUint32(0) === 0x74746366) {   // 'ttcf' — 한 파일에 글꼴 여러 개
    var n = dv.getUint32(8), sets = [];
    for (var i = 0; i < n && i < 64; i++) sets.push(tableAt(dv.getUint32(12 + i * 4)));
    return sets;
  }
  return [tableAt(0)];
}
function nameFrom(recs, id) {
  var c = recs.filter(function (r) { return r.id === id; });
  if (!c.length) return '';
  var hit =
    c.find(function (r) { return r.p === 3 && r.l === 0x409; }) ||   // Windows 영어
    c.find(function (r) { return r.p === 3 && r.l === 0x412; }) ||   // Windows 한국어
    c.find(function (r) { return r.p === 3; }) ||
    c[0];
  return hit.s;
}
function fontWeightOf(style) {
  var s = (style || '').toLowerCase();
  if (/hairline|thin/.test(s)) return 100;
  if (/extra\s*light|ultra\s*light/.test(s)) return 200;
  if (/semi\s*light|light/.test(s)) return 300;
  if (/medium/.test(s)) return 500;
  if (/semi\s*bold|demi/.test(s)) return 600;
  if (/extra\s*bold|ultra\s*bold/.test(s)) return 800;
  if (/black|heavy/.test(s)) return 900;
  if (/bold/.test(s)) return 700;
  return 400;
}

// 목록에서 고른 글꼴 face → 미리보기용/pptx용 이름 세트
export function resolveLocalFont(fd) {
  var label = fd.fullName || (fd.family + (fd.style && fd.style !== 'Regular' ? ' ' + fd.style : ''));
  var fallback = {
    label: label, css: fd.family, weight: fontWeightOf(fd.style),
    pptx: label, pptxBold: false, ps: fd.postscriptName || ''
  };
  if (!fd.blob) return Promise.resolve(fallback);
  return fd.blob().then(function (b) { return b.arrayBuffer(); }).then(function (buf) {
    var sets = parseSfntNames(buf);
    var recs = sets[0] || [];
    if (sets.length > 1) {   // TTC: postscript 이름이 일치하는 글꼴을 찾는다
      for (var i = 0; i < sets.length; i++) {
        if (nameFrom(sets[i], 6) === fd.postscriptName) { recs = sets[i]; break; }
      }
    }
    var gdi = nameFrom(recs, 1);
    if (!gdi) return fallback;
    return {
      label: nameFrom(recs, 4) || label,
      css: fd.family,
      weight: fontWeightOf(nameFrom(recs, 17) || fd.style),
      pptx: gdi,
      pptxBold: /bold/i.test(nameFrom(recs, 2)),
      ps: fd.postscriptName || ''
    };
  }).catch(function () { return fallback; });
}

// 현재 글꼴 정보 (프리셋 또는 내 컴퓨터 글꼴)
export function curFont() {
  if (state.fontKey === 'custom' && state.customFont) {
    var meta = state.customFontMeta;
    if (meta) {
      // 목록에서 고른 글꼴: 미리보기는 브라우저 가족명, pptx 는 파워포인트(GDI) 가족명
      return {
        label: meta.label, cssName: '"' + (meta.css || '').replace(/["\\]/g, '') + '"',
        weight: meta.weight || 600, fb: FB, pptx: meta.pptx, pptxBold: !!meta.pptxBold
      };
    }
    var name = state.customFont.replace(/["\\]/g, '');
    return { label: name, cssName: '"' + name + '"', weight: 600, fb: FB, pptx: name, pptxBold: false };
  }
  return FONTS[state.fontKey] || FONTS.gothic;
}

/* ---------- 웹폰트 사전 로드 (캔버스가 대체 글꼴로 그리는 것 방지) ---------- */
export function ensureFont() {
  var f = curFont();
  if (!f || !document.fonts) return Promise.resolve();
  var spec = f.weight + ' 100px ' + f.cssName;
  return Promise.race([
    document.fonts.load(spec).catch(function () {}),
    timeout(2000)
  ]);
}
