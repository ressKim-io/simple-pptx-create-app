/* ============================================================
   utils — DOM·색·파일 저장·localStorage 공용 유틸 (앱 상태에 의존하지 않음)
   ============================================================ */

export function $(id) { return document.getElementById(id); }

export function timeout(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

export function hexA(hex, a) {
  var h = hex.replace('#', '');
  var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

export function hex6(c) {
  c = (c || '').replace('#', '').toUpperCase();
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  return c.slice(0, 6);
}

export function xmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export var MIME = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  zip: 'application/zip'
};
var EXT_LABEL = { pptx: '파워포인트 파일', png: 'PNG 이미지', zip: 'ZIP 압축 파일' };

export function downloadBlob(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// 저장 위치를 고르게 한다(크롬/엣지). 클릭 제스처가 살아 있을 때 불러야 하므로
// 무거운 작업을 시작하기 전에 호출한다. 지원 안 하면 null → 다운로드 폴더로 저장.
export function pickSaveHandle(name, ext) {
  if (!window.showSaveFilePicker) return Promise.resolve(null);
  var accept = {};
  accept[MIME[ext]] = ['.' + ext];
  return window.showSaveFilePicker({
    suggestedName: name + '.' + ext,
    types: [{ description: EXT_LABEL[ext], accept: accept }]
  }).catch(function (e) {
    if (e && e.name === 'AbortError') throw e;   // 사용자가 취소 → 내보내기도 중단
    return null;                                 // 그 밖의 이유 → 조용히 다운로드 폴더로
  });
}

export async function saveBlob(blob, handle, name) {
  if (!handle) { downloadBlob(blob, name); return false; }
  var w = await handle.createWritable();
  await w.write(blob);
  await w.close();
  return true;
}

export function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
