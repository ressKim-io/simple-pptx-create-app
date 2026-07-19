/* ============================================================
   main — 진입점: 이벤트 바인딩 + 초기화
   - 100% 클라이언트 사이드 (서버 없음)
   - UI 디자인: Claude Design 목업 이식 / 내보내기: 기존 앱 로직 이식
   ============================================================ */
import {
  FONTS, BGS, ACCENTS, RATIOS,
  PX_MIN, PX_MAX, PX_STEP, TRACK_MIN, TRACK_MAX, LINE_MIN, LINE_MAX
} from './config.js';
import { $, lsGet, lsSet } from './utils.js';
import {
  state, localFaces, fontUi,
  idbAll, addImage, loadExternalPresets
} from './state.js';
import { resolveLocalFont } from './fonts.js';
import { curPx, autoPx } from './slides.js';
import { render, renderHeader } from './render.js';
import { openExport, closeExport, startExport } from './export.js';

/* ---------- 편집 / 되돌리기 / 자동저장 ---------- */
var saveT = null;
function scheduleSave() {
  state.save = 'saving';
  clearTimeout(saveT);
  saveT = setTimeout(function () {
    state.save = lsSet('sm_text', state.text) ? 'saved' : 'error';
    renderHeader();
  }, 600);
  renderHeader();
}
function onEdit(e) {
  state.past = state.past.concat([state.text]).slice(-60);
  state.future = [];
  state.text = e.target.value;
  scheduleSave();
  render();
}
function undo() {
  if (!state.past.length) return;
  var prev = state.past[state.past.length - 1];
  state.future = [state.text].concat(state.future).slice(0, 60);
  state.past = state.past.slice(0, -1);
  state.text = prev;
  $('lyricsTa').value = prev;
  scheduleSave();
  render();
}
function redo() {
  if (!state.future.length) return;
  var nxt = state.future[0];
  state.past = state.past.concat([state.text]).slice(-60);
  state.future = state.future.slice(1);
  state.text = nxt;
  $('lyricsTa').value = nxt;
  scheduleSave();
  render();
}

/* ---------- 이미지 업로드 ---------- */
function onUpload(e) {
  var file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file || !/^image\//.test(file.type)) return;
  addImage(file).then(render).catch(function () {
    alert('이미지를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
  });
}

/* ---------- 프리셋 코드 복사 (presets.json 관리용) ---------- */
function copyPresetCode() {
  if (state.bgKey.indexOf('img:') !== 0) {
    alert('먼저 업로드한 이미지를 배경으로 선택해 주세요.');
    return;
  }
  var id = state.bgKey.slice(4);
  idbAll().then(function (recs) {
    var rec = null;
    for (var i = 0; i < recs.length; i++) if (recs[i].id === id) rec = recs[i];
    if (!rec) { alert('이미지를 찾을 수 없어요.'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var name = window.prompt('프리셋 이름 (목록에 표시될 이름)', rec.name || '새 배경');
      if (name === null) return;
      var key = 'preset_' + Date.now().toString(36);
      var entry = '{ "key": "' + key + '", "name": ' + JSON.stringify(name) + ', "data": "' + reader.result + '" }';
      var msg = 'presets.json 의 "presets" 배열 안에 이 항목을 붙여넣으면\n재배포 없이 배경 프리셋이 추가됩니다.';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(entry).then(
          function () { alert('프리셋 코드가 복사됐어요!\n' + msg); },
          function () { window.prompt(msg + '\n\n아래를 복사하세요:', entry); }
        );
      } else {
        window.prompt(msg + '\n\n아래를 복사하세요:', entry);
      }
    };
    reader.readAsDataURL(rec.blob);
  });
}

/* ---------- 글자 크기·글꼴 입력 ---------- */
function setPx(v) {
  v = Math.round(v);
  if (isFinite(v)) {
    state.fontPx = Math.max(PX_MIN, Math.min(PX_MAX, v));
    lsSet('sm_fontPx', String(state.fontPx));
  }
  render();
  // 입력창이 포커스 중이어도 클램프/잘못된 입력을 실제 값으로 되돌려 표시
  $('pxInput').value = curPx();
}
function applyCustomFont(name) {
  name = (name || '').trim();
  if (!name) return;
  state.customFont = name;
  state.customFontMeta = null;   // 직접 입력 = 적은 이름을 그대로 신뢰
  state.fontKey = 'custom';
  lsSet('sm_font', 'custom');
  lsSet('sm_customFont', name);
  lsSet('sm_customFontMeta', '');
  render();
}
function applyLocalFont(fd) {
  resolveLocalFont(fd).then(function (meta) {
    state.customFontMeta = meta;
    state.customFont = meta.label;
    state.fontKey = 'custom';
    lsSet('sm_font', 'custom');
    lsSet('sm_customFont', meta.label);
    lsSet('sm_customFontMeta', JSON.stringify(meta));
    render();
  });
}
// 이름을 비우면 기본 글꼴로 되돌린다
function commitCustomFont(name) {
  name = (name || '').trim();
  if (name) applyCustomFont(name);
  else if (state.fontKey === 'custom') { state.fontKey = 'gothic'; lsSet('sm_font', 'gothic'); render(); }
}
function loadLocalFonts() {
  if (!window.queryLocalFonts) {
    alert('이 브라우저는 글꼴 목록 불러오기를 지원하지 않아요. (Chrome/Edge에서 가능)\n아래 입력칸에 글꼴 이름을 직접 적어 주세요.');
    return;
  }
  window.queryLocalFonts().then(function (fonts) {
    // 가족이 아니라 face(굵기) 단위로 — 파워포인트 목록과 같은 단위·같은 이름이 뜬다
    Object.keys(localFaces).forEach(function (k) { delete localFaces[k]; });
    var faces = [];
    fonts.forEach(function (fo) {
      var ps = fo.postscriptName || (fo.family + '/' + fo.style);
      if (!fo.family || localFaces[ps]) return;
      localFaces[ps] = fo;
      faces.push({
        ps: ps,
        family: fo.family,
        label: fo.fullName || (fo.family + (fo.style && fo.style !== 'Regular' ? ' ' + fo.style : ''))
      });
    });
    faces.sort(function (a, b) { return a.label.localeCompare(b.label, 'ko'); });
    var sel = $('localFontSel');
    sel.textContent = '';
    var ph = document.createElement('option');
    ph.value = ''; ph.textContent = '글꼴 선택… (' + faces.length + '개)';
    sel.appendChild(ph);
    faces.forEach(function (fc) {
      var o = document.createElement('option');
      o.value = fc.ps;
      o.textContent = fc.label;
      o.style.fontFamily = '"' + fc.family.replace(/["\\]/g, '') + '"';
      sel.appendChild(o);
    });
    fontUi.listLoaded = true;
    fontUi.pickMode = 'list';   // 목록을 불러왔으면 목록에서 고르는 모드로 (입력칸은 숨겨짐)
    render();
  }).catch(function (e) {
    alert('글꼴 목록을 불러오지 못했어요: ' + (e && e.message ? e.message : e) + '\n아래 입력칸에 글꼴 이름을 직접 적어도 됩니다.');
  });
}

/* ---------- 정적 옵션 버튼 생성 (init에서 1회) ---------- */
function buildStaticOptions() {
  Object.keys(RATIOS).forEach(function (r) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-btn';
    b.dataset.ratio = r;
    b.textContent = r;
    b.addEventListener('click', function () { state.ratio = r; lsSet('sm_ratio', r); render(); });
    $('ratioGroup').appendChild(b);
  });
  Object.keys(BGS).forEach(function (k) {
    var p = BGS[k];
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'bg-chip';
    b.dataset.bg = k;
    b.title = p.label;
    b.setAttribute('aria-label', '배경 ' + p.label);
    b.style.background = p.bg;
    b.style.color = p.ink;
    b.textContent = '가';
    b.addEventListener('click', function () { state.bgKey = k; lsSet('sm_bgKey', k); render(); });
    $('bgChips').appendChild(b);
  });
  [{ mode: 'dark', label: '어두운 바탕' }, { mode: 'light', label: '밝은 바탕' }].forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-btn';
    b.dataset.mode = o.mode;
    b.textContent = o.label;
    b.addEventListener('click', function () {
      state.overlayMode = o.mode; lsSet('sm_overlay', o.mode); render();
    });
    $('overlayGroup').appendChild(b);
  });
  ACCENTS.forEach(function (a) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'accent-dot';
    b.dataset.color = a.color;
    b.setAttribute('aria-label', '강조색 ' + a.name);
    b.style.background = a.color;
    b.addEventListener('click', function () { state.accent = a.color; lsSet('sm_accent', a.color); render(); });
    $('accentRow').appendChild(b);
  });
  Object.keys(FONTS).forEach(function (k) {
    var f = FONTS[k];
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'font-opt';
    b.dataset.font = k;
    var sample = document.createElement('span');
    sample.className = 'font-sample';
    sample.setAttribute('aria-hidden', 'true');
    sample.style.fontFamily = f.cssName + f.fb;
    sample.style.fontWeight = f.weight;
    sample.textContent = '가';
    var label = document.createElement('span');
    label.className = 'font-label';
    label.textContent = f.label;
    b.appendChild(sample); b.appendChild(label);
    b.addEventListener('click', function () { state.fontKey = k; lsSet('sm_font', k); render(); });
    $('fontCol').appendChild(b);
  });
}

/* ---------- 이벤트 바인딩 ---------- */
function bindEvents() {
  $('lyricsTa').addEventListener('input', onEdit);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('darkBtn').addEventListener('click', function () {
    state.dark = !state.dark;
    lsSet('sm_dark', state.dark ? '1' : '0');
    render();
  });
  $('exportBtn').addEventListener('click', openExport);
  $('prevBtn').addEventListener('click', function () { state.active--; render(); });
  $('nextBtn').addEventListener('click', function () { state.active++; render(); });
  $('bgFile').addEventListener('change', onUpload);
  $('copyPresetBtn').addEventListener('click', copyPresetCode);
  $('growBtn').addEventListener('click', function () { setPx(curPx() + PX_STEP); });
  $('shrinkBtn').addEventListener('click', function () { setPx(curPx() - PX_STEP); });
  $('pxInput').addEventListener('change', function (e) { setPx(parseFloat(e.target.value)); });
  $('scaleReset').addEventListener('click', function () {
    state.fontPx = null; lsSet('sm_fontPx', ''); render();
  });
  $('trackRange').addEventListener('input', function (e) {
    var v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    state.letterSpacing = Math.max(TRACK_MIN, Math.min(TRACK_MAX, Math.round(v * 10) / 10));
    lsSet('sm_track', String(state.letterSpacing));
    render();
  });
  $('trackReset').addEventListener('click', function () {
    state.letterSpacing = 0; lsSet('sm_track', '0'); render();
  });
  $('lineRange').addEventListener('input', function (e) {
    var v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    state.lineHeight = Math.max(LINE_MIN, Math.min(LINE_MAX, v / 100));
    lsSet('sm_lineh', String(state.lineHeight));
    render();
  });
  $('lineReset').addEventListener('click', function () {
    state.lineHeight = 1.5; lsSet('sm_lineh', '1.5'); render();
  });
  $('loadFontsBtn').addEventListener('click', loadLocalFonts);
  $('fontModeBtn').addEventListener('click', function () {
    fontUi.pickMode = fontUi.pickMode === 'list' ? 'type' : 'list';
    render();
    if (fontUi.pickMode === 'type') $('customFontInput').focus();
  });
  $('localFontSel').addEventListener('change', function (e) {
    var fd = localFaces[e.target.value];
    if (fd) applyLocalFont(fd);
  });
  // Enter/포커스 이동을 기다리지 않고 적는 대로 바로 반영 (짧게 묶어서)
  var cfTimer = null;
  $('customFontInput').addEventListener('input', function (e) {
    var name = e.target.value;
    clearTimeout(cfTimer);
    cfTimer = setTimeout(function () { commitCustomFont(name); }, 250);
  });
  $('customFontInput').addEventListener('change', function (e) {
    clearTimeout(cfTimer);
    commitCustomFont(e.target.value);
  });
  $('exportModal').addEventListener('click', function (e) {
    if (e.target === $('exportModal')) closeExport();
  });
  $('modalX').addEventListener('click', closeExport);
  $('doneClose').addEventListener('click', closeExport);
  $('pngChoice').addEventListener('click', function () { startExport('png'); });
  $('pptxChoice').addEventListener('click', function () { startExport('pptx'); });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.exportState !== 'idle') { closeExport(); return; }
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    var mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (e.key === 'ArrowRight') { state.active++; render(); }
    else if (e.key === 'ArrowLeft') { state.active--; render(); }
  });
}

/* ---------- 초기화 ---------- */
function init() {
  var t = lsGet('sm_text');
  if (t !== null) state.text = t;

  var bk = lsGet('sm_bgKey');
  if (bk && (BGS[bk] || bk.indexOf('preset:') === 0)) state.bgKey = bk;
  // 'img:' 키는 IndexedDB 복원 후 검증

  var ov = lsGet('sm_overlay');
  if (ov === 'dark' || ov === 'light') state.overlayMode = ov;
  var rt = lsGet('sm_ratio');
  if (RATIOS[rt]) state.ratio = rt;

  var fpx = parseFloat(lsGet('sm_fontPx'));
  if (isFinite(fpx) && fpx >= PX_MIN && fpx <= PX_MAX) {
    state.fontPx = Math.round(fpx);
  } else {
    // 예전 버전의 % 설정(sm_scale)이 있으면 px로 이관
    var oldSc = parseFloat(lsGet('sm_scale'));
    if (isFinite(oldSc) && Math.abs(oldSc - 1) > 0.001) {
      state.fontPx = Math.max(PX_MIN, Math.min(PX_MAX, Math.round(autoPx() * oldSc)));
      lsSet('sm_fontPx', String(state.fontPx));
    }
  }
  var tr = parseFloat(lsGet('sm_track'));
  if (isFinite(tr) && tr >= TRACK_MIN && tr <= TRACK_MAX) state.letterSpacing = Math.round(tr * 10) / 10;
  var lh = parseFloat(lsGet('sm_lineh'));
  if (isFinite(lh) && lh >= LINE_MIN && lh <= LINE_MAX) state.lineHeight = lh;

  var ac = lsGet('sm_accent');
  if (ACCENTS.some(function (a) { return a.color === ac; })) state.accent = ac;
  var cf = lsGet('sm_customFont');
  if (cf) state.customFont = cf;
  var cfm = lsGet('sm_customFontMeta');
  if (cfm) { try { state.customFontMeta = JSON.parse(cfm) || null; } catch (e) {} }
  var fk = lsGet('sm_font');
  if (FONTS[fk] || (fk === 'custom' && state.customFont)) state.fontKey = fk;
  state.dark = lsGet('sm_dark') === '1';

  var fn = lsGet('sm_fname');
  if (fn) $('fileNameInput').value = fn;

  $('lyricsTa').value = state.text;
  buildStaticOptions();
  bindEvents();
  render();

  idbAll().then(function (recs) {
    state.images = recs
      .sort(function (a, b) { return a.ts - b.ts; })
      .map(function (r) { return { id: r.id, name: r.name, url: URL.createObjectURL(r.blob) }; });
    var saved = lsGet('sm_bgKey');
    if (saved && saved.indexOf('img:') === 0) {
      var exists = state.images.some(function (im) { return 'img:' + im.id === saved; });
      state.bgKey = exists ? saved : 'white';
    }
    render();
  }).catch(function () {});

  loadExternalPresets().then(render);
}

init();
