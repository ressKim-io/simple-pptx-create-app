/* ============================================================
   slides — 가사 → 슬라이드 파싱, 글자 크기 공식, 배경·스크림 해석
   (미리보기와 내보내기가 같은 수치를 쓰도록 크기 공식은 여기 한 곳에만)
   ============================================================ */
import {
  RATIOS, RF, MAX_SIZE, LINE_H, REF_LINES, H_AVAIL, REF_EM,
  OVERLAY_RGB, OVERLAY_SHAPES
} from './config.js';
import { state, presets } from './state.js';

/* ---------- 파싱: 빈 줄 = 슬라이드 경계 ---------- */
export function parseSlides(text) {
  var norm = (text || '').replace(/\r\n?/g, '\n');
  var blocks = norm.split(/\n[ \t]*\n/);
  var out = blocks.map(function (b) {
    return b.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length; });
  });
  var filtered = out.filter(function (lines) { return lines.length; });
  var slides = filtered.length ? filtered : [[]];
  return slides.map(function (lines) { return { lines: lines }; });
}

/* ---------- 글자 크기 ---------- */
// 비율당 자동 폰트 크기(cqw) — "4줄이 꽉 차는" 기본값
export function fixedSize(ratio) {
  var vFill = (88 * RF[ratio]) / (REF_LINES * LINE_H);
  var hFit = H_AVAIL / REF_EM;
  return Math.min(MAX_SIZE, vFill, hFit);
}
// 자동 크기를 내보내기 px(세로 1080px 캔버스 기준)로 환산
export function autoPx() {
  return Math.round(RATIOS[state.ratio].w * fixedSize(state.ratio) / 100);
}
// 현재 적용 글자 크기(px). fontPx 미설정이면 자동값
export function curPx() {
  return state.fontPx || autoPx();
}

/* ---------- 배경 해석 ---------- */
export function currentImage() {
  if (state.bgKey.indexOf('img:') === 0) {
    var id = state.bgKey.slice(4);
    for (var i = 0; i < state.images.length; i++) {
      if (state.images[i].id === id) return { url: state.images[i].url };
    }
    return null;
  }
  if (state.bgKey.indexOf('preset:') === 0) {
    var key = state.bgKey.slice(7);
    for (var j = 0; j < presets.length; j++) {
      if (presets[j].key === key && presets[j].data) return { url: presets[j].data };
    }
    return null;
  }
  return null;
}

/* ---------- 이미지 위 스크림(덮개) ----------
   미리보기(CSS 그라데이션)와 내보내기(캔버스 그라데이션)가 반드시 같아야 하므로
   색·정지점 계산은 여기 한 곳에서만 하고, 두 쪽 다 이 결과를 그대로 그린다. */

// 부드러운 감쇠(smoothstep)를 정지점 배열로 펼친다. CSS·캔버스 모두 정지점 사이는
// 선형 보간이라, 같은 배열을 넘기면 두 그라데이션이 정확히 일치한다.
function ramp(p0, a0, p1, a1) {
  var out = [], n = 8;
  for (var i = 0; i <= n; i++) {
    var t = i / n, s = t * t * (3 - 2 * t);
    out.push({ p: p0 + (p1 - p0) * t, a: a0 + (a1 - a0) * s });
  }
  return out;
}

// 반환: { rgb, layers:[{dir:'h'|'v', stops:[{p,a}]}] }
// 층이 여러 개라도 색이 같아서 겹치는 순서와 무관하다 (알파만 누적).
// 인자는 견본(모양 고르기 버튼)용 — 비우면 현재 설정.
export function overlayLayers(shapeKey, strengthPct) {
  var light = state.overlayMode === 'light';
  var s = (strengthPct == null ? state.overlayStrength : strengthPct) / 100;
  // 밝은 스크림은 같은 알파라도 사진을 덜 가려서 조금 더 올린다 (기존 기본값 재현)
  if (light) s = Math.min(1, s * 1.2);
  var want = shapeKey || state.overlayShape;
  var shape = null;
  OVERLAY_SHAPES.forEach(function (o) { if (o.key === want) shape = o; });
  if (!shape) shape = OVERLAY_SHAPES[0];
  return {
    rgb: light ? OVERLAY_RGB.light : OVERLAY_RGB.dark,
    layers: shape.layers.map(function (L) {
      var stops = L.edge === null
        ? [{ p: 0, a: s * 0.7 }, { p: 1, a: s }]          // 전면: 위가 살짝 옅은 기존 스크림
        : ramp(0, s, L.edge, 0).concat(ramp(1 - L.edge, 0, 1, s));
      return { dir: L.dir, stops: stops };
    })
  };
}

var bgCache = {};                // src -> HTMLImageElement
export function getBgImage() {
  var img = currentImage();
  if (!img) return Promise.resolve(null);
  var src = img.url;
  if (bgCache[src]) return Promise.resolve(bgCache[src]);
  return new Promise(function (res) {
    var im = new Image();
    im.onload = function () { bgCache[src] = im; res(im); };
    im.onerror = function () { res(null); };
    im.src = src;
  });
}
