/* ============================================================
   export — PNG/PPTX 내보내기 파이프라인 (캔버스 렌더 + pptxgenjs + 후처리)
   라이브러리는 js/vendor/choirlibs.js 가 window.ChoirLibs 로 먼저 로드해 둔다.
   ============================================================ */
import { BGS, RATIOS } from './config.js';
import { $, timeout, hex6, xmlAttr, MIME, pickSaveHandle, saveBlob, lsSet } from './utils.js';
import { state } from './state.js';
import { curFont, ensureFont } from './fonts.js';
import { parseSlides, curPx, getBgImage } from './slides.js';
import { renderModal } from './render.js';

var PptxGenJS = window.ChoirLibs.PptxGenJS;
var JSZip = window.ChoirLibs.JSZip;

// 윈도우/맥에서 파일 이름에 못 쓰는 문자 제거
function fileBase() {
  var v = ($('fileNameInput').value || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return v || '슬라이드';
}

/* ---------- 캔버스 렌더 (미리보기와 같은 크기 공식) ---------- */
export function drawCover(ctx, img, W, H) {
  var ir = img.width / img.height, cr = W / H, dw, dh, dx, dy;
  if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
  else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}
export function drawOverlay(ctx, W, H) {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  if (state.overlayMode === 'light') {
    g.addColorStop(0, 'rgba(248,247,243,.55)');
    g.addColorStop(1, 'rgba(248,247,243,.72)');
  } else {
    g.addColorStop(0, 'rgba(10,12,16,.42)');
    g.addColorStop(1, 'rgba(10,12,16,.60)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function exportInk(imgOn) {
  if (imgOn) return state.overlayMode === 'light' ? '#1B1D20' : '#FFFFFF';
  return (BGS[state.bgKey] || BGS.white).ink;
}
// 캔버스는 자동 줄바꿈이 없어서 직접 랩핑 (DOM 미리보기·PPTX와 일관)
function wrapLine(ctx, text, maxW) {
  if (!text || ctx.measureText(text).width <= maxW) return [text];
  var words = text.split(' ');
  var lines = [], cur = '';
  words.forEach(function (word) {
    var t = cur ? cur + ' ' + word : word;
    if (ctx.measureText(t).width <= maxW) { cur = t; return; }
    if (cur) { lines.push(cur); cur = ''; }
    if (ctx.measureText(word).width > maxW) {
      var seg = '';
      for (var i = 0; i < word.length; i++) {
        if (seg && ctx.measureText(seg + word[i]).width > maxW) { lines.push(seg); seg = ''; }
        seg += word[i];
      }
      cur = seg;
    } else {
      cur = word;
    }
  });
  if (cur) lines.push(cur);
  return lines;
}
function renderSlideExport(ctx, W, H, lines, bgImg) {
  ctx.clearRect(0, 0, W, H);
  var lightMode = state.overlayMode === 'light';
  if (bgImg) {
    drawCover(ctx, bgImg, W, H);
    drawOverlay(ctx, W, H);
  } else {
    ctx.fillStyle = (BGS[state.bgKey] || BGS.white).bg;
    ctx.fillRect(0, 0, W, H);
  }
  var f = curFont();
  var px = curPx();
  var lh = px * state.lineHeight;
  ctx.font = f.weight + ' ' + px + 'px ' + f.cssName + f.fb;
  // 자간: Chromium 계열이면 캔버스에도 그대로 적용 (미지원 브라우저는 무시)
  if ('letterSpacing' in ctx) ctx.letterSpacing = (px * state.letterSpacing / 100) + 'px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = exportInk(!!bgImg);
  if (bgImg) {
    if (lightMode) {
      ctx.shadowColor = 'rgba(255,255,255,.55)';
      ctx.shadowBlur = px * 0.25;
      ctx.shadowOffsetY = px / 32;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = px * 12 / 32;
      ctx.shadowOffsetY = px * 2 / 32;
    }
  }
  var maxW = W * 0.86;
  var out = [];
  lines.forEach(function (line) {
    wrapLine(ctx, line, maxW).forEach(function (l) { out.push(l); });
  });
  var total = out.length * lh;
  var y = H / 2 - total / 2 + lh / 2;
  out.forEach(function (l) {
    ctx.fillText(l, W / 2, y);
    y += lh;
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/* ---------- 내보내기 파이프라인 ---------- */
function setPct(p) {
  state.exportPct = Math.max(0, Math.min(100, Math.round(p)));
  renderModal();
}
export function openExport() { state.exportState = 'choosing'; state.exportPct = 0; renderModal(); }
export function closeExport() {
  state.exportState = 'idle'; state.exportPct = 0; state.exportFmt = null;
  renderModal();
}
export function startExport(fmt) {
  var slides = parseSlides(state.text);
  if (slides.length === 1 && slides[0].lines.length === 0) {
    alert('가사를 먼저 입력해 주세요.');
    closeExport();
    return;
  }
  var base = fileBase();
  var ext = fmt === 'pptx' ? 'pptx' : (slides.length > 1 ? 'zip' : 'png');
  lsSet('sm_fname', base);

  // 저장 위치 선택창은 여기서 바로 띄운다 — 렌더링을 기다렸다 부르면
  // 클릭 제스처가 만료돼서 브라우저가 거부한다.
  pickSaveHandle(base, ext).then(function (handle) {
    state.exportFmt = fmt;
    state.exportState = 'progress';
    state.exportPct = 0;
    state.savedName = base + '.' + ext;
    state.savedPicked = !!handle;
    renderModal();
    var run = fmt === 'pptx' ? exportPPTX : exportPNG;
    return run(slides, handle, base);
  }).then(function () {
    setPct(100);
    return timeout(300);
  }).then(function () {
    if (state.exportState === 'progress') {
      state.exportState = 'done';
      renderModal();
    }
  }).catch(function (e) {
    closeExport();
    if (e && e.name === 'AbortError') return;   // 저장 위치 선택을 취소함 — 조용히 닫기
    alert('내보내기 실패: ' + (e && e.message ? e.message : e));
  });
}

export async function exportPNG(slides, handle, base) {
  await ensureFont();
  var bg = await getBgImage();
  var R = RATIOS[state.ratio];
  var cv = document.createElement('canvas');
  cv.width = R.w; cv.height = R.h;
  var ctx = cv.getContext('2d');
  var blobs = [];
  for (var i = 0; i < slides.length; i++) {
    renderSlideExport(ctx, R.w, R.h, slides[i].lines, bg);
    var b = await new Promise(function (res) { cv.toBlob(res, 'image/png'); });
    if (!b) throw new Error('이미지 생성에 실패했어요');
    blobs.push(b);
    setPct((i + 1) / slides.length * 85);
    await timeout(0);
  }
  if (blobs.length === 1) {
    await saveBlob(blobs[0], handle, base + '.png');
    return;
  }
  var zip = new JSZip();
  blobs.forEach(function (b, i) {
    zip.file(base + '_' + String(i + 1).padStart(2, '0') + '.png', b);
  });
  var out = await zip.generateAsync({ type: 'blob' }, function (meta) {
    setPct(85 + meta.percent * 0.15);
  });
  await saveBlob(out, handle, base + '.zip');
}

// pptxgenjs 가 만든 파일을 파워포인트가 제대로 읽도록 손본다.
//
// (1) 파일 손상 — <p:bgPr>(슬라이드 배경색) 안에는 채우기 다음에 <a:effectLst/> 가
//     반드시 있어야 하는데(CT_BackgroundProperties 필수) pptxgenjs 가 빼먹는다.
//     파워포인트는 이걸 "읽을 수 없는 콘텐츠"로 보고 복구를 제안하며, 복구하면서
//     글꼴 서식까지 통째로 버린다 → 글꼴 이름 칸이 비고 기본 글꼴로 나옴.
//
// (2) 한글 글꼴 — 파워포인트는 한글을 <a:ea>(동아시아) 글꼴로 그리는데 pptxgenjs 가
//     거기에 charset="-122"(GB2312=중국어 간체)를 하드코딩한다. 한글은 -127.
//
// (3) 테마 기본 글꼴 — 위 두 가지로 런 지정이 무시될 때 파워포인트가 최후에 집는 것이
//     테마의 script="Hang" 글꼴(기본값 맑은 고딕)이다. 이것도 고른 글꼴로 바꿔
//     슬라이드 전체가 그 글꼴을 쓰게 한다.
//
// (4) 발표자 노트 부속 — pptxgenjs 가 만드는 notesMaster 의 자리표시자 도형들이
//     파워포인트 기준으로 불량이라 "복구" 창이 뜬다. 복구가 노트 마스터 속만 지우므로
//     슬라이드 겉보기는 멀쩡해서 원인을 알기 어렵다 (gitbrent/PptxGenJS#1443, #1449).
//     이 앱은 노트를 안 쓰므로 노트 파트를 통째로 제거한다.
//
// (5) 유령 Override — pptxgenjs 는 [Content_Types].xml 에 슬라이드 수만큼
//     slideMasterN Override 를 쓰는데 실제 파일은 slideMaster1 하나뿐이다.
//     없는 파트를 선언하는 것도 복구 사유로 보고돼 있어 같이 지운다.
export async function fixupPptx(blob, fontName) {
  var font = xmlAttr(fontName);
  // createFolders:false — 다시 압축할 때 빈 디렉터리 항목이 끼지 않도록
  var zip = await JSZip.loadAsync(blob, { createFolders: false });

  var slideNames = Object.keys(zip.files).filter(function (n) {
    return /^ppt\/slides\/slide\d+\.xml$/.test(n);
  });
  for (var i = 0; i < slideNames.length; i++) {
    var xml = await zip.file(slideNames[i]).async('string');
    xml = xml.replace(/(<p:bgPr>[\s\S]*?)(<\/p:bgPr>)/g, function (all, body, close) {
      return body.indexOf('<a:effectLst') === -1 ? body + '<a:effectLst/>' + close : all;
    });
    xml = xml.replace(/(<a:ea\b[^>]*?)charset="-122"/g, '$1charset="-127"');
    zip.file(slideNames[i], xml);
  }

  // (4) 노트 파트 제거 + 참조 정리
  Object.keys(zip.files).forEach(function (n) {
    if (/^ppt\/(notesMasters|notesSlides)\//.test(n)) delete zip.files[n];
  });
  var slideRels = Object.keys(zip.files).filter(function (n) {
    return /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(n);
  });
  for (var j = 0; j < slideRels.length; j++) {
    var rels = await zip.file(slideRels[j]).async('string');
    zip.file(slideRels[j], rels.replace(/<Relationship\b[^>]*notesSlide[^>]*\/>/g, ''));
  }
  var pRelsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (pRelsFile) {
    var pRels = await pRelsFile.async('string');
    zip.file('ppt/_rels/presentation.xml.rels', pRels.replace(/<Relationship\b[^>]*notesMaster[^>]*\/>/g, ''));
  }
  var appFile = zip.file('docProps/app.xml');
  if (appFile) {
    var app = await appFile.async('string');
    zip.file('docProps/app.xml', app.replace(/<Notes>\d+<\/Notes>/, '<Notes>0</Notes>'));
  }

  // (4)+(5) [Content_Types].xml — 노트 Override 와 없는 slideMasterN Override 제거
  var ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    var ct = await ctFile.async('string');
    ct = ct.replace(/<Override PartName="\/ppt\/(?:notesMasters|notesSlides)\/[^"]*"[^>]*\/>/g, '');
    ct = ct.replace(/<Override PartName="\/ppt\/slideMasters\/(slideMaster\d+\.xml)"[^>]*\/>/g,
      function (all, name) {
        return zip.file('ppt/slideMasters/' + name) ? all : '';
      });
    zip.file('[Content_Types].xml', ct);
  }

  var themeFile = zip.file('ppt/theme/theme1.xml');
  if (themeFile) {
    var theme = await themeFile.async('string');
    theme = theme.replace(/(<a:(?:major|minor)Font>)([\s\S]*?)(<\/a:(?:major|minor)Font>)/g,
      function (all, open, body, close) {
        body = body
          .replace(/<a:latin\b[^>]*\/>/, function () { return '<a:latin typeface="' + font + '"/>'; })
          .replace(/<a:ea\b[^>]*\/>/, function () { return '<a:ea typeface="' + font + '"/>'; })
          .replace(/<a:font script="Hang"[^>]*\/>/, function () { return '<a:font script="Hang" typeface="' + font + '"/>'; });
        return open + body + close;
      });
    zip.file('ppt/theme/theme1.xml', theme);
  }

  // presentation.xml 자식 순서 교정 — pptxgenjs 는 notesMasterIdLst 를 sldIdLst 뒤에
  // 쓰는데 스키마(CT_Presentation)상 앞이어야 한다. 이 순서 위반도 "읽을 수 없는
  // 콘텐츠" 복구를 일으킨다 (특히 구형 파워포인트에서 엄격).
  var presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    var pres = await presFile.async('string');
    // (4) 노트 마스터 목록 제거 (파트를 지웠으니 참조도 없어야 한다)
    pres = pres.replace(/<p:notesMasterIdLst(?:\/>|>[\s\S]*?<\/p:notesMasterIdLst>)/, '');
    pres = pres.replace(/(<p:presentation\b[^>]*>)([\s\S]*)(<\/p:presentation>)/,
      function (all, open, body, close) {
        var order = ['sldMasterIdLst', 'notesMasterIdLst', 'handoutMasterIdLst', 'sldIdLst',
          'sldSz', 'notesSz', 'smartTags', 'embeddedFontLst', 'custShowLst', 'photoAlbum',
          'custDataLst', 'kinsoku', 'defaultTextStyle', 'modifyVerifier', 'extLst'];
        var found = [];
        order.forEach(function (tag) {
          var re = new RegExp('<p:' + tag + '(?:\\s[^>]*)?(?:/>|>[\\s\\S]*?</p:' + tag + '>)');
          var m = body.match(re);
          if (m) { found.push(m[0]); body = body.replace(m[0], ''); }
        });
        return open + found.join('') + body + close;
      });
    zip.file('ppt/presentation.xml', pres);
  }

  // OPC 패키지에는 디렉터리 항목이 없어야 한다 (pptxgenjs 가 넣는다)
  Object.keys(zip.files).forEach(function (n) {
    if (zip.files[n].dir) delete zip.files[n];
  });
  return zip.generateAsync({ type: 'blob', mimeType: MIME.pptx, compression: 'DEFLATE' });
}

export async function exportPPTX(slides, handle, base) {
  await ensureFont();
  var bg = await getBgImage();
  var R = RATIOS[state.ratio];
  var f = curFont();
  var pptx = new PptxGenJS();
  pptx.title = base.replace(/[&<>"']/g, '');   // core.xml 에 그대로 들어가므로 XML 깨질 문자 제거
  pptx.defineLayout({ name: 'CH', width: R.inW, height: R.inH });
  pptx.layout = 'CH';
  // 이미지 배경은 오버레이까지 미리 합성한 한 장으로 (텍스트는 편집 가능하게 유지)
  var bgData = null;
  if (bg) {
    var cv = document.createElement('canvas');
    cv.width = R.w; cv.height = R.h;
    var ctx = cv.getContext('2d');
    drawCover(ctx, bg, R.w, R.h);
    drawOverlay(ctx, R.w, R.h);
    bgData = cv.toDataURL('image/jpeg', 0.9);
  }
  var fontPt = Math.round(curPx() / 2);   // 1080px = 540pt → px/pt = 2
  var charSpc = Math.round(fontPt * state.letterSpacing / 100 * 100) / 100;  // 자간(pt)
  var ink = exportInk(!!bg);
  for (var i = 0; i < slides.length; i++) {
    var s = pptx.addSlide();
    if (bgData) s.addImage({ data: bgData, x: 0, y: 0, w: R.inW, h: R.inH });
    else s.background = { color: hex6((BGS[state.bgKey] || BGS.white).bg) };
    var opts = {
      // 좌우 7% 여백 = 미리보기(.lyrics 7cqw)·PNG 캔버스(maxW 0.86W)와 같은 줄바꿈 폭.
      // margin:0 — 텍스트 상자 기본 내부 여백(0.1in)까지 없애야 폭이 정확히 86%가 된다.
      x: R.inW * 0.07, y: 0.3, w: R.inW * 0.86, h: R.inH - 0.6, margin: 0,
      align: 'center', valign: 'middle',
      lang: 'ko-KR',   // 한글 런이라고 알려야 파워포인트가 <a:ea> 글꼴을 제대로 집는다
      // pptxgenjs 는 typeface 를 이스케이프 없이 XML 에 넣으므로 여기서 미리
      fontFace: xmlAttr(f.pptx), fontSize: fontPt, bold: f.pptxBold,
      color: hex6(ink),
      lineSpacing: Math.round(fontPt * state.lineHeight)
    };
    if (charSpc) opts.charSpacing = charSpc;
    if (bgData && state.overlayMode !== 'light') {
      opts.shadow = { type: 'outer', color: '000000', opacity: 0.5, blur: 4, offset: 2, angle: 90 };
    }
    s.addText(slides[i].lines.map(function (t) {
      return { text: t, options: { breakLine: true } };
    }), opts);
    setPct((i + 1) / slides.length * 60);
    await timeout(0);
  }
  setPct(70);
  var raw = await pptx.write({ outputType: 'blob' });
  setPct(85);
  var out = await fixupPptx(raw, f.pptx);
  await saveBlob(out, handle, base + '.pptx');
}
