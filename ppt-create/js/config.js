/* ============================================================
   config — 앱 전역 상수 (글꼴 프리셋·배경·비율·크기 공식 계수)
   새 기능을 붙일 때 여기 상수만 늘리면 되도록 데이터는 전부 이 파일에.
   ============================================================ */

export var FB = ',"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",system-ui,sans-serif';
export var SERIF_FB = ',"Batang","바탕",serif';

// pptx 필드 = PPTX 저장 시 실제로 쓰는 글꼴 이름(윈도우 기준 대체)
export var FONTS = {
  gothic: { label: '고딕 (기본)', cssName: 'Pretendard',       weight: 600, fb: FB,       pptx: 'Malgun Gothic', pptxBold: false },
  myeong: { label: '명조',        cssName: '"Nanum Myeongjo"', weight: 700, fb: SERIF_FB, pptx: 'Batang',        pptxBold: true  },
  big:    { label: '큰 고딕',     cssName: 'Pretendard',       weight: 800, fb: FB,       pptx: 'Malgun Gothic', pptxBold: true  }
};

export var BGS = {
  white: { label: '흰색', bg: '#FFFFFF', ink: '#22252A', muted: '#6B7280' },
  cream: { label: '크림', bg: '#F3ECDC', ink: '#3A3226', muted: '#8A7B60' },
  sky:   { label: '하늘', bg: '#E8EEF6', ink: '#1E2A3A', muted: '#5B6B7E' },
  navy:  { label: '남색', bg: '#1B2A4A', ink: '#EAF0FA', muted: '#9BB0CE' },
  ink:   { label: '먹',   bg: '#23262B', ink: '#EDEEF0', muted: '#9AA0A9' }
};

export var ACCENTS = [
  { key: 'teal',   color: '#0E7C6B', name: '청록' },
  { key: 'indigo', color: '#4257C4', name: '남보라' },
  { key: 'plum',   color: '#8A4A86', name: '자두' },
  { key: 'forest', color: '#356B3B', name: '초록' },
  { key: 'clay',   color: '#B85C36', name: '주황' }
];

// 슬라이드는 항상 540pt 높이(7.5in). PNG는 1080px → px/pt = 2.
export var RATIOS = {
  '16:9': { w: 1920, h: 1080, inW: 13.333, inH: 7.5 },
  '4:3':  { w: 1440, h: 1080, inW: 10,     inH: 7.5 },
  '1:1':  { w: 1080, h: 1080, inW: 7.5,    inH: 7.5 }
};
export var PVW = {
  '16:9': 'min(660px, 96cqw, calc(90cqh * 16 / 9))',
  '4:3':  'min(580px, 96cqw, calc(90cqh * 4 / 3))',
  '1:1':  'min(480px, 96cqw, 90cqh)'
};
export var PV_ASPECT = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1' };
// cqh를 cqw 단위로 환산한 값(높이÷너비)
export var RF = { '16:9': 0.5625, '4:3': 0.75, '1:1': 1 };

export var MAX_SIZE = 9;    // cqw 상한 (자동 크기 계산용)
export var LINE_H = 1.55;   // 자동 크기 계산용 안전 마진 (실제 표시 기본은 1.5)
export var REF_LINES = 4;   // 기본 크기 = "4줄 슬라이드가 꽉 차는" 크기
export var H_AVAIL = 84;    // 사용 가능한 가로폭(cqw)
export var REF_EM = 17;     // 기본 크기가 한 줄에 들어가야 하는 기준 폭(em)
export var PX_MIN = 12, PX_MAX = 500, PX_STEP = 2;      // 글자 크기(내보내기 px 기준)
export var TRACK_MIN = -5, TRACK_MAX = 5;               // 자간 (글자 크기 대비 %)
export var LINE_MIN = 1.0, LINE_MAX = 2.5;              // 줄 간격 배수

export var DEFAULT_TEXT = [
  '동해 물과 백두산이 마르고 닳도록',
  '하느님이 보우하사 우리나라 만세',
  '',
  '무궁화 삼천리 화려강산',
  '대한 사람 대한으로 길이 보전하세',
  '',
  '남산 위에 저 소나무 철갑을 두른 듯',
  '바람 서리 불변함은 우리 기상일세',
  '',
  '무궁화 삼천리 화려강산',
  '대한 사람 대한으로 길이 보전하세',
  '',
  '가을 하늘 공활한데 높고 구름 없이',
  '밝은 달은 우리 가슴 일편단심일세',
  '',
  '무궁화 삼천리 화려강산',
  '대한 사람 대한으로 길이 보전하세',
  '',
  '이 기상과 이 맘으로 충성을 다하여',
  '괴로우나 즐거우나 나라 사랑하세',
  '',
  '무궁화 삼천리 화려강산',
  '대한 사람 대한으로 길이 보전하세'
].join('\n');
