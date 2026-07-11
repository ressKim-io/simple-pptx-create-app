# verify — 슬라이드 메이커 (ppt-create)

정적 HTML 앱. 메인은 `ppt-create/index.html` 단일 파일
(라인 ~375-377은 번들된 PptxGenJS/JSZip — 매우 긴 줄이므로 Read 전체 금지, grep/sed로 부분 확인).

## 실행

```bash
cd ppt-create && python3 -m http.server 8642   # run_in_background 로
# file:// 로도 열리지만 presets.json fetch와 queryLocalFonts는 http 필요
```

## 구동 (headless Chrome)

playwright 미설치. 스크래치패드에 `npm i puppeteer-core` 후 설치된 Chrome 사용:

```js
puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
```

- 다운로드 검증: CDP `Page.setDownloadBehavior { behavior:'allow', downloadPath }` → 내보내기 클릭 → pptx unzip 후 `ppt/slides/slide1.xml`에서 `sz=`(pt×100), `spc=`(자간 pt×100), `spcPts val=`(줄간격 pt×100), `typeface=` grep.
- number input에 타이핑할 때 triple-click/cmd+A 선택이 헤드리스에서 안 먹음 → `page.$eval(sel, el => { el.focus(); el.select(); })` 후 `page.type`.
- 앱은 'change' 이벤트로 커밋(Enter/blur). 입력창 포커스 중엔 render가 입력값을 안 덮어씀 — 커밋값 확인은 Tab으로 blur 후 읽기.
- 상태는 localStorage(`sm_*` 키) — 테스트 시작 시 `localStorage.clear()` 후 reload.
- 검증 흐름: 왼쪽 textarea 입력(빈 줄=새 슬라이드) → 오른쪽 패널 컨트롤 → 미리보기 #lyricsBox 인라인 스타일 확인 → 내보내기 모달(#exportBtn → #pptxChoice/#pngChoice).
- alert() 쓰는 경로 주의(가사 없이 내보내기, 글꼴 목록 실패 등) — 헤드리스에선 자동 dismiss되지만 흐름이 끊길 수 있음.
- `queryLocalFonts`(내 컴퓨터 글꼴 목록)는 권한 프롬프트가 떠서 자동화로 못 누름 — 직접 입력(#customFontInput + Enter)으로 대신 검증.
