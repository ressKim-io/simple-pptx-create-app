# verify — 슬라이드 메이커 (ppt-create)

정적 HTML 앱 (빌드 없음, ES 모듈). 구조:

```
ppt-create/
  index.html            마크업만
  css/app.css           스타일
  js/config.js          상수 (글꼴·배경·비율·크기 공식 계수)
  js/utils.js           DOM·색·파일 저장·localStorage
  js/state.js           상태 객체 + IndexedDB + presets 로드
  js/fonts.js           글꼴 해석 (name table 파싱, curFont)
  js/slides.js          가사 파싱 + 크기 공식(curPx) + 배경 해석
  js/render.js          모든 DOM 렌더링
  js/export.js          PNG/PPTX 내보내기 + fixupPptx(파워포인트 호환 후처리)
  js/main.js            진입점 (이벤트 바인딩 + init)
  js/vendor/choirlibs.js  번들된 PptxGenJS+JSZip → window.ChoirLibs (Read 전체 금지)
```

## 실행

```bash
cd ppt-create && python3 -m http.server 8642   # run_in_background 로
# ES 모듈이라 http 필수 (file:// 불가)
```

## 구동 (headless Chrome)

playwright 미설치. `--headless=new --virtual-time-budget=N --dump-dom`(결과를 DOM에 적고 grep)
또는 스크래치패드에 `npm i puppeteer-core` 후 설치된 Chrome 사용:

```js
puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
```

- **모듈이라 테스트 주입이 쉬움**: 스크래치패드에 앱을 복사 → index.html 사본에 `<script type="module">` 추가 → `import { state } from './js/state.js'` 하면 앱과 같은 모듈 인스턴스를 얻는다 (state 조작·exportPPTX 직접 호출 가능).
- **내보내기 캡처**: 사본의 js/export.js에서 `await saveBlob(out, handle, base + '.pptx');` 앞에 `if (window.__capture) { await window.__capture(out, base); return; }` 를 끼워넣고, POST 받는 로컬 서버로 blob 수집 (다운로드 폴더 안 거침).
- **pptx 검증**: unzip 후 `ppt/slides/slide1.xml`에서 `sz=`(pt×100), `spc=`(자간 pt×100), `spcPts val=`(줄간격 pt×100), `typeface=` grep. XSD 전체 검증은 python-docx repo의 ref/xsd(pml.xsd+의존)를 받아 `xmllint --schema`.
- number input에 타이핑할 때 triple-click/cmd+A 선택이 헤드리스에서 안 먹음 → `el.focus(); el.select()` 후 type.
- 앱은 'change' 이벤트로 커밋(Enter/blur). 입력창 포커스 중엔 render가 입력값을 안 덮어씀 — 커밋값 확인은 blur 후 읽기.
- 상태는 localStorage(`sm_*` 키) — 테스트 시작 시 `localStorage.clear()` 후 reload.
- 검증 흐름: 왼쪽 textarea 입력(빈 줄=새 슬라이드) → 오른쪽 패널 컨트롤 → 미리보기 #lyricsBox 인라인 스타일 확인 → 내보내기 모달(#exportBtn → #pptxChoice/#pngChoice).
- 미리보기 글자 실측: `#lyricsBox`의 computed font-size == `curPx() × slideW/1920` 이어야 함 (cqw는 .slide content-box 기준이라 .slide에 패딩 넣으면 깨짐).
- alert() 쓰는 경로 주의(가사 없이 내보내기, 글꼴 목록 실패 등) — 헤드리스에선 자동 dismiss되지만 흐름이 끊길 수 있음.
- `queryLocalFonts`(내 컴퓨터 글꼴 목록)는 권한 프롬프트가 떠서 자동화로 못 누름 — 직접 입력(#customFontInput + Enter)으로 대신 검증.
