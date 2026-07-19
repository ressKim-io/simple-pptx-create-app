/* ============================================================
   state — 앱 상태 + 영속화 (localStorage 는 utils, 이미지는 IndexedDB)
   여기 함수들은 상태만 바꾸고 렌더링하지 않는다 — 호출한 쪽이 render() 를 부른다.
   ============================================================ */
import { DEFAULT_TEXT } from './config.js';
import { lsSet } from './utils.js';

export var state = {
  text: DEFAULT_TEXT,
  dark: false,
  accent: '#0E7C6B',
  bgKey: 'white',
  fontKey: 'gothic',
  ratio: '16:9',
  active: 0,
  past: [], future: [],          // undo/redo (최대 60)
  save: 'saved',                 // 'saving' | 'saved' | 'error'
  exportState: 'idle',           // 'idle' | 'choosing' | 'progress' | 'done'
  exportFmt: null, exportPct: 0,
  savedName: '',                 // 방금 저장한 파일 이름 (완료 화면에 표시)
  savedPicked: false,            // 저장 위치를 직접 골랐는가
  images: [],                    // 업로드 배경 [{id, name, url}] (IndexedDB 복원)
  overlayMode: 'dark',           // 'dark' = 어두운 스크림+흰 글자, 'light' = 반대
  fontPx: null,                  // 글자 크기(px, 내보내기 기준). null = 자동 맞춤
  letterSpacing: 0,              // 자간: 글자 크기 대비 % (-5 ~ +5, 0.1 단위)
  lineHeight: 1.5,               // 줄 간격 배수 (1.0 ~ 2.5)
  customFont: '',                // 내 컴퓨터 글꼴 이름 (fontKey === 'custom'일 때 사용)
  customFontMeta: null           // 목록에서 고른 face 정보 {label, css, weight, pptx, pptxBold, ps}
};

// 모듈 간 공유하는 부속 상태 — 객체를 재할당하지 말고 속성만 바꿀 것 (import 는 참조 공유)
export var localFaces = {};             // postscriptName -> FontData (글꼴 목록 불러온 뒤)
export var presets = [];                // presets.json: [{key, name, data(dataURL)}]
export var fontUi = {
  listLoaded: false,                    // 내 컴퓨터 글꼴 목록을 불러왔는가
  pickMode: 'type'                      // 'list' = 목록에서 고르기, 'type' = 이름 직접 입력
};

/* ---------- IndexedDB (배경 이미지는 커서 localStorage 대신 여기에) ---------- */
function idbOpen() {
  return new Promise(function (res, rej) {
    var req = indexedDB.open('slidemaker_bg', 1);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('bg')) db.createObjectStore('bg', { keyPath: 'id' });
    };
    req.onsuccess = function () { res(req.result); };
    req.onerror = function () { rej(req.error); };
  });
}
export function idbAll() {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('bg', 'readonly').objectStore('bg').getAll();
      tx.onsuccess = function () { res(tx.result || []); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
function idbPut(rec) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('bg', 'readwrite').objectStore('bg').put(rec);
      tx.onsuccess = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
function idbDelete(id) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('bg', 'readwrite').objectStore('bg').delete(id);
      tx.onsuccess = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}

/* ---------- 배경 이미지 추가/삭제 ---------- */
export function addImage(file) {
  var id = 'im_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  var rec = { id: id, blob: file, name: file.name || '이미지', ts: Date.now() };
  return idbPut(rec).then(function () {
    var url = URL.createObjectURL(file);
    state.images.push({ id: id, name: rec.name, url: url });
    state.bgKey = 'img:' + id;
    lsSet('sm_bgKey', state.bgKey);
  });
}
export function removeImage(id) {
  idbDelete(id).catch(function () {});
  for (var i = 0; i < state.images.length; i++) {
    if (state.images[i].id === id) {
      try { URL.revokeObjectURL(state.images[i].url); } catch (e) {}
      state.images.splice(i, 1);
      break;
    }
  }
  if (state.bgKey === 'img:' + id) {
    state.bgKey = 'white';
    lsSet('sm_bgKey', 'white');
  }
}

/* ---------- presets.json (온라인이면 병합, 실패해도 무시) ---------- */
export function loadExternalPresets() {
  return fetch('presets.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (j && j.presets && j.presets.length) {
        var have = {};
        presets.forEach(function (p) { have[p.key] = true; });
        j.presets.forEach(function (p) {
          if (p && p.key && p.data && !have[p.key]) { presets.push(p); have[p.key] = true; }
        });
      }
    })
    .catch(function () { /* 오프라인/파일모드 */ });
}
