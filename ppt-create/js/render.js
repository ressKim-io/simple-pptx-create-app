/* ============================================================
   render — 상태 → 화면 (테마 변수, 미리보기, 컨트롤, 썸네일, 내보내기 모달)
   상태는 읽기만 하고, 화면 갱신은 전부 여기서만 한다.
   ============================================================ */
import { BGS, PVW, PV_ASPECT, RATIOS, PX_MIN, PX_MAX } from './config.js';
import { $, hexA, lsSet } from './utils.js';
import { state, presets, fontUi, removeImage } from './state.js';
import { curFont, missingFontName } from './fonts.js';
import { parseSlides, curPx, currentImage } from './slides.js';

/* ---------- 테마 ---------- */
function themeVars() {
  var dark = state.dark;
  var imgOn = !!currentImage();
  var lightMode = state.overlayMode === 'light';
  var pal = imgOn
    ? (lightMode
        ? { bg: '#F2F0EA', ink: '#1B1D20', muted: 'rgba(20,22,26,.72)' }
        : { bg: '#1A1D22', ink: '#FFFFFF', muted: 'rgba(255,255,255,.82)' })
    : (BGS[state.bgKey] || BGS.white);
  var f = curFont();
  return {
    '--accent': state.accent,
    '--accentInk': '#FFFFFF',
    '--accentSoft': hexA(state.accent, dark ? 0.22 : 0.12),
    '--good': '#2FA36B',
    '--slideBg': pal.bg, '--slideInk': pal.ink, '--slideMuted': pal.muted,
    '--slideFont': f.cssName + f.fb, '--slideWeight': String(f.weight),
    '--bg': dark ? '#14161B' : '#F4F3EF',
    '--surface': dark ? '#1C1F26' : '#FFFFFF',
    '--surface2': dark ? '#242832' : '#FAF9F6',
    '--border': dark ? '#323844' : '#E5E3DC',
    '--ink': dark ? '#E9EBEF' : '#23262C',
    '--muted': dark ? '#98A0AD' : '#5F6672',
    '--faint': dark ? '#69707D' : '#9AA0A9',
    '--warn': dark ? '#E8B04B' : '#B5730C',
    '--warnSoft': dark ? 'rgba(232,176,75,.18)' : 'rgba(181,115,12,.12)',
    '--shadow': dark ? '0 12px 40px rgba(0,0,0,.55)' : '0 10px 34px rgba(30,34,44,.13)'
  };
}
function applyTheme() {
  var vars = themeVars();
  // :root 에 — 내보내기 모달이 #app 밖에 있어서 #app 에 걸면 모달이 상속받지 못한다
  var el = document.documentElement;
  for (var k in vars) el.style.setProperty(k, vars[k]);
}

/* ---------- 렌더 ---------- */
export function render() {
  var slides = parseSlides(state.text);
  state.active = Math.max(0, Math.min(state.active, slides.length - 1));
  var cur = slides[state.active];
  applyTheme();
  renderHeader();
  renderPreview(slides, cur);
  renderThumbs(slides);
  renderControls();
  renderModal();
}

export function renderHeader() {
  $('undoBtn').disabled = !state.past.length;
  $('redoBtn').disabled = !state.future.length;
  var dot = $('saveDot');
  dot.className = state.save === 'saving' ? 'saving' : (state.save === 'error' ? 'error' : '');
  $('saveLabel').textContent = state.save === 'saving' ? '저장 중…' : (state.save === 'error' ? '저장 안 됨' : '저장됨');
  $('darkIcon').textContent = state.dark ? '☀' : '☾';
  $('darkLabel').textContent = state.dark ? '라이트' : '다크';
  $('darkBtn').setAttribute('aria-label', state.dark ? '라이트 모드로 전환' : '다크 모드로 전환');
}

function renderPreview(slides, cur) {
  var img = currentImage();
  var imgOn = !!img;
  var lightMode = state.overlayMode === 'light';
  var slideEl = $('slideEl');
  slideEl.style.width = PVW[state.ratio];
  slideEl.style.aspectRatio = PV_ASPECT[state.ratio];

  // 미리보기 cqw = 내보내기 px ÷ 내보내기 가로폭 × 100 (미리보기와 파일이 동일 비율)
  var lyricSize = curPx() / RATIOS[state.ratio].w * 100;

  $('slideBgImg').hidden = !imgOn;
  $('slideOverlay').hidden = !imgOn;
  if (imgOn) {
    $('slideBgImg').style.background = 'url(' + JSON.stringify(img.url) + ') center/cover no-repeat';
    $('slideOverlay').style.background = lightMode
      ? 'linear-gradient(180deg,rgba(248,247,243,.55),rgba(248,247,243,.72))'
      : 'linear-gradient(180deg,rgba(10,12,16,.42),rgba(10,12,16,.60))';
  }
  $('emptyMsg').hidden = cur.lines.length !== 0;

  var box = $('lyricsBox');
  box.textContent = '';
  cur.lines.forEach(function (l) {
    var d = document.createElement('div');
    d.textContent = l;
    box.appendChild(d);
  });
  box.style.fontSize = lyricSize + 'cqw';
  box.style.letterSpacing = (state.letterSpacing / 100) + 'em';
  box.style.lineHeight = String(state.lineHeight);
  box.style.textShadow = imgOn
    ? (lightMode ? '0 1px 8px rgba(255,255,255,.55)' : '0 2px 12px rgba(0,0,0,.55)')
    : 'none';

  $('slideNum').textContent = state.active + 1;
  $('activeNum').textContent = state.active + 1;
  $('totalNum').textContent = slides.length;
}

function renderThumbs(slides) {
  var imgOn = !!currentImage();
  var lightMode = state.overlayMode === 'light';
  var thumbBg = imgOn ? (lightMode ? '#F2F0EA' : '#1A1D22') : (BGS[state.bgKey] || BGS.white).bg;
  var wrap = $('thumbs');
  wrap.textContent = '';
  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'thumb' + (i === state.active ? ' sel' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === state.active ? 'true' : 'false');
    b.setAttribute('aria-label', '슬라이드 ' + (i + 1));
    b.style.background = thumbBg;
    var num = document.createElement('div');
    num.className = 'thumb-num'; num.setAttribute('aria-hidden', 'true');
    num.textContent = i + 1;
    var l1 = document.createElement('div');
    l1.className = 'thumb-l1' + (s.lines.length ? '' : ' muted-line');
    l1.textContent = s.lines[0] || '(빈 슬라이드)';
    var l2 = document.createElement('div');
    l2.className = 'thumb-l2';
    l2.textContent = s.lines[1] || '';
    b.appendChild(num); b.appendChild(l1); b.appendChild(l2);
    b.addEventListener('click', function () { state.active = i; render(); });
    wrap.appendChild(b);
  });
}

function selToggle(container, selector, attr, value) {
  container.querySelectorAll(selector).forEach(function (el) {
    var sel = el.dataset[attr] === value;
    el.classList.toggle('sel', sel);
    el.setAttribute('aria-pressed', sel ? 'true' : 'false');
  });
}

function renderControls() {
  selToggle($('ratioGroup'), '.seg-btn', 'ratio', state.ratio);
  selToggle($('bgChips'), '.bg-chip', 'bg', state.bgKey);
  renderImgChips();
  var imgOn = !!currentImage();
  $('overlayBox').hidden = !imgOn;
  selToggle($('overlayGroup'), '.seg-btn', 'mode', state.overlayMode);
  selToggle($('accentRow'), '.accent-dot', 'color', state.accent);
  selToggle($('fontCol'), '.font-opt', 'font', state.fontKey);

  // 글자 크기 (px)
  var px = curPx();
  var pxInput = $('pxInput');
  if (document.activeElement !== pxInput) pxInput.value = px;
  $('growBtn').disabled = px >= PX_MAX;
  $('shrinkBtn').disabled = px <= PX_MIN;
  var isAuto = state.fontPx === null;
  $('scaleDefault').hidden = !isAuto;
  $('scaleReset').hidden = isAuto;

  // 자간
  $('trackRange').value = state.letterSpacing;
  $('trackVal').textContent = (state.letterSpacing > 0 ? '+' : '') + state.letterSpacing.toFixed(1) + '%';
  var trackDef = Math.abs(state.letterSpacing) < 0.05;
  $('trackDefault').hidden = !trackDef;
  $('trackReset').hidden = trackDef;

  // 줄 간격
  var lhPct = Math.round(state.lineHeight * 100);
  $('lineRange').value = lhPct;
  $('lineVal').textContent = lhPct + '%';
  $('lineDefault').hidden = lhPct !== 150;
  $('lineReset').hidden = lhPct === 150;

  // 내 컴퓨터 글꼴 — 목록에서 고르기와 직접 입력 중 하나만 켠다.
  // 둘 다 켜두면 서로의 값을 덮어써서 헷갈리고, 목록에 없는 이름을 적으면 선택창이 빈칸이 된다.
  var isCustom = state.fontKey === 'custom';
  $('customFontBox').classList.toggle('sel', isCustom);
  var listMode = fontUi.listLoaded && fontUi.pickMode === 'list';

  var sel = $('localFontSel');
  var cfi = $('customFontInput');
  sel.hidden = !listMode;
  cfi.hidden = listMode;
  $('loadFontsBtn').hidden = fontUi.listLoaded;
  var tog = $('fontModeBtn');
  tog.hidden = !fontUi.listLoaded;
  tog.textContent = listMode ? '목록에 없는 글꼴 직접 입력' : '목록에서 고르기';

  if (document.activeElement !== cfi) cfi.value = isCustom ? state.customFont : '';
  if (listMode) {
    sel.value = (isCustom && state.customFontMeta) ? state.customFontMeta.ps : '';
    // 목록에 없는 이름이면 selectedIndex 가 -1 이 되어 선택창이 빈칸으로 보인다 → 안내 문구로 되돌림
    if (sel.selectedIndex === -1) sel.selectedIndex = 0;
  }

  // 없는 글꼴 이름을 적으면 조용히 기본 글꼴로 대체되어 버리므로 알려준다
  var miss = missingFontName();
  var warn = $('cfWarn');
  warn.hidden = !miss;
  if (miss) warn.textContent = '‘' + miss + '’ 글꼴이 이 컴퓨터에 없어요. 미리보기와 PNG는 기본 글꼴로 나와요. (PPTX에는 이 이름 그대로 저장되니, 파일을 열 컴퓨터에 이 글꼴이 있으면 제대로 보여요.)';
}

function renderImgChips() {
  var box = $('imgChips');
  box.textContent = '';
  presets.forEach(function (p) {
    var key = 'preset:' + p.key;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'img-chip' + (state.bgKey === key ? ' sel' : '');
    b.setAttribute('aria-pressed', state.bgKey === key ? 'true' : 'false');
    b.setAttribute('aria-label', '배경 프리셋 ' + (p.name || ''));
    b.title = p.name || '';
    b.style.background = 'url(' + JSON.stringify(p.data) + ') center/cover';
    b.addEventListener('click', function () {
      state.bgKey = key; lsSet('sm_bgKey', key); render();
    });
    box.appendChild(b);
  });
  state.images.forEach(function (im) {
    var key = 'img:' + im.id;
    var wrap = document.createElement('span');
    wrap.className = 'img-wrap';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'img-chip' + (state.bgKey === key ? ' sel' : '');
    b.setAttribute('aria-pressed', state.bgKey === key ? 'true' : 'false');
    b.setAttribute('aria-label', '배경 이미지 ' + im.name);
    b.title = im.name;
    b.style.background = 'url(' + JSON.stringify(im.url) + ') center/cover';
    b.addEventListener('click', function () {
      state.bgKey = key; lsSet('sm_bgKey', key); render();
    });
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'img-del';
    del.setAttribute('aria-label', '이미지 삭제');
    del.title = '삭제';
    del.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
    del.addEventListener('click', function (ev) {
      ev.stopPropagation();
      removeImage(im.id);
      render();
    });
    wrap.appendChild(b); wrap.appendChild(del);
    box.appendChild(wrap);
  });
}

export function renderModal() {
  var open = state.exportState !== 'idle';
  $('exportModal').hidden = !open;
  if (!open) return;
  $('exChoosing').hidden = state.exportState !== 'choosing';
  $('exProgress').hidden = state.exportState !== 'progress';
  $('exDone').hidden = state.exportState !== 'done';
  $('exTitleP').textContent = state.exportFmt === 'pptx' ? 'PPTX' : 'PNG';
  $('exTotal').textContent = parseSlides(state.text).length;
  $('exSaveNote').hidden = !window.showSaveFilePicker;
  $('exDoneName').textContent = state.savedName || '';
  $('exDoneWhere').textContent = state.savedPicked
    ? '고른 폴더에 저장했어요.'
    : '다운로드 폴더를 확인해 주세요.';
  $('exFill').style.width = state.exportPct + '%';
  $('exPctLabel').textContent = state.exportPct + '%';

  var miss = missingFontName();
  var w = $('exFontWarn');
  w.hidden = !miss;
  if (miss) w.textContent = '‘' + miss + '’ 글꼴이 이 컴퓨터에 없어요. PNG는 기본 글꼴로 저장됩니다. (PPTX는 이 이름으로 저장돼요.)';
}
