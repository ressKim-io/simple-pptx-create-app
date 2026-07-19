/* ============================================================
   slides — 가사 → 슬라이드 파싱, 글자 크기 공식, 배경 해석
   (미리보기와 내보내기가 같은 수치를 쓰도록 크기 공식은 여기 한 곳에만)
   ============================================================ */
import { RATIOS, RF, MAX_SIZE, LINE_H, REF_LINES, H_AVAIL, REF_EM } from './config.js';
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
