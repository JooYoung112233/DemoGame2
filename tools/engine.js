// ── The Last Theater — 규칙 엔진 v2 (대본 구조) ─────────────────
//
//   스핀 → 3장 확정 → 만들 수 있는 대본 제시(1종/2종/3종) → 하나를 손패로
//        → 코스트 안에서 사용 → 적 행동
//
// 조준은 폐기했다. 확률은 릴 구성만으로 정해지고, 그건 전투 중이 아니라 상점 결정이다.
// 계열(배역·악상·소품)은 카드의 성격 태그이고 유물이 참조한다. 플레이어가 선언하지 않는다.
//
// 데이터와 순수 규칙만 둔다. DOM 을 만지지 않는다.
(function (root) {
  'use strict';

  var FAMS = ['cast', 'score', 'prop'];
  var FAM_KO = { cast: '배역', score: '악상', prop: '소품', wild: '보석' };

  // ── 카드 26종 ─────────────────────────────────────────────
  var CARDS = {
    // 배역 — 사람이 무대에 선다
    knight:  { name: '기사',    icon: '⚔️', fam: 'cast',  dmg: 5 },
    king:    { name: '왕',      icon: '👑', fam: 'cast',  dmg: 7 },
    jester:  { name: '광대',    icon: '🎭', fam: 'cast',  dmg: 3, hits: 2 },
    priest:  { name: '사제',    icon: '🕯️', fam: 'cast',  heal: 5 },
    dancer:  { name: '무희',    icon: '💃', fam: 'cast',  dmg: 4, slow: 1 },
    acrobat: { name: '곡예사',  icon: '🤹', fam: 'cast',  dmg: 2, hits: 3 },
    singer:  { name: '가수',    icon: '🎤', fam: 'cast',  block: 3, heal: 2 },
    dead:    { name: '망자',    icon: '💀', fam: 'cast',  selfDmg: 3 },
    // 악상 — 음악이 무대를 채운다
    piano:   { name: '피아노',  icon: '🎹', fam: 'score', dmg: 3, aoe: true },
    violin:  { name: '바이올린', icon: '🎻', fam: 'score', dmg: 5, poison: 2 },
    drum:    { name: '북',      icon: '🥁', fam: 'score', dmg: 4, slow: 1 },
    trumpet: { name: '나팔',    icon: '🎺', fam: 'score', dmg: 6 },
    rage:    { name: '분노',    icon: '🔥', fam: 'score', dmg: 4, burn: 2 },
    tragedy: { name: '비극',    icon: '🩸', fam: 'score', dmg: 6, poison: 2 },
    cold:    { name: '냉기',    icon: '❄️', fam: 'score', dmg: 3, slow: 1 },
    fear:    { name: '공포',    icon: '👻', fam: 'score', dmg: 4, slow: 1 },
    joy:     { name: '환희',    icon: '✨', fam: 'score', heal: 4, gold: 2 },
    // 소품 — 물건이 장면을 만든다
    sword:   { name: '칼',      icon: '🗡', fam: 'prop',  dmg: 6 },
    shield:  { name: '방패',    icon: '🛡', fam: 'prop',  block: 7 },
    rose:    { name: '장미',    icon: '🌹', fam: 'prop',  heal: 4, block: 2 },
    mirror:  { name: '거울',    icon: '🪞', fam: 'prop',  block: 4, thorns: 5 },
    chain:   { name: '사슬',    icon: '⛓️', fam: 'prop',  dmg: 4, pierce: true },
    mask:    { name: '가면',    icon: '👺', fam: 'prop',  dmg: 4, thorns: 3 },
    candle:  { name: '촛대',    icon: '🕯',  fam: 'prop',  burn: 3 },
    curtain: { name: '커튼',    icon: '🎪', fam: 'prop',  block: 5, slow: 1 },
    crown:   { name: '왕관',    icon: '👑', fam: 'prop',  block: 4, gold: 3 },
    gem:     { name: '보석',    icon: '💎', fam: 'wild',  wild: true },
    // 검열된 칸 — 폭군의 기믹이 릴에 심는다. 어떤 대본도 이 칸을 쓰지 못한다.
    void:    { name: '검열됨',  icon: '⬛', fam: 'none',  hidden: true }
  };

  // ── 대본 1종 (26) — 코스트 1. 순수하고 효율이 좋다 ─────────
  var S1 = {
    knight:  ['베기',       { damage: 10 }],
    king:    ['왕의 명령',  { damage: 13 }],
    jester:  ['재주',       { damage: 5, hits: 2 }],
    priest:  ['축도',       { heal: 11 }],
    dancer:  ['선회',       { damage: 8, slow: 1 }],
    acrobat: ['공중제비',   { damage: 4, hits: 3 }],
    singer:  ['화음',       { block: 7, heal: 4 }],
    dead:    ['망자의 손',  { damage: 12, selfDamage: 4 }],
    piano:   ['건반',       { damage: 5, aoe: true }],
    violin:  ['현',         { damage: 9, poison: 2 }],
    drum:    ['타격',       { damage: 8, slow: 1 }],
    trumpet: ['취주',       { damage: 12 }],
    rage:    ['불씨',       { damage: 7, burn: 3 }],
    tragedy: ['탄식',       { damage: 11, poison: 3 }],
    cold:    ['서리',       { damage: 6, slow: 2 }],
    fear:    ['그림자',     { damage: 8, slow: 1 }],
    joy:     ['갈채',       { heal: 8, gold: 5 }],
    sword:   ['찌르기',     { damage: 12 }],
    shield:  ['막기',       { block: 14 }],
    rose:    ['헌화',       { heal: 8, block: 5 }],
    mirror:  ['반사면',     { block: 8, thorns: 8 }],
    chain:   ['속박',       { damage: 8, pierce: true }],
    mask:    ['가면극',     { damage: 8, thorns: 5 }],
    candle:  ['불붙이기',   { burn: 6 }],
    curtain: ['막 내리기',  { block: 10, slow: 2 }],
    crown:   ['대관',       { block: 8, gold: 6 }]
  };

  // ── 대본 2종 (36) — 코스트 2. 부가 효과가 붙는다 ───────────
  // 키는 카드 두 장을 정렬해 이었다. 같은 카드 2장도 조합이다.
  var S2 = [
    ['knight', 'shield',  '방패를 든 기사',  { damage: 12, block: 10 }],
    ['knight', 'sword',   '이도류',          { damage: 9, hits: 2 }],
    ['knight', 'knight',  '기사의 맹세',     { damage: 22 }],
    ['knight', 'chain',   '감옥의 심판',     { damage: 18, pierce: true }],
    ['king',   'rage',    '왕의 처형',       { damage: 20, burn: 3 }],
    ['king',   'trumpet', '즉위식',          { damage: 16, block: 8 }],
    ['king',   'crown',   '왕의 초상',       { damage: 14, block: 10, gold: 4 }],
    ['king',   'king',    '왕의 독백',       { damage: 26 }],
    ['jester', 'fear',    '인형극',          { damage: 9, aoe: true }],
    ['jester', 'jester',  '광대의 난무',     { damage: 5, hits: 5 }],
    ['jester', 'mask',    '가면 바꾸기',     { damage: 6, hits: 3, thorns: 4 }],
    ['priest', 'rose',    '성스러운 축복',   { heal: 14, block: 10 }],
    ['priest', 'candle',  '위령',            { heal: 10, burn: 4 }],
    ['priest', 'priest',  '성무',            { heal: 20, block: 8 }],
    ['dancer', 'cold',    '얼음 왈츠',       { damage: 9, slow: 3 }],
    ['dancer', 'drum',    '탭 댄스',         { damage: 6, hits: 3 }],
    ['dancer', 'curtain', '느린 막',         { block: 8, slow: 4 }],
    ['cold',   'drum',    '얼음 북',         { damage: 4, aoe: true, slow: 3 }],
    ['acrobat', 'candle', '불꽃 곡예',       { damage: 3, hits: 4, burn: 1 }],
    ['acrobat', 'violin', '독무',            { damage: 3, hits: 4, poison: 1 }],
    ['jester', 'candle',  '불장난',          { damage: 4, hits: 3, burn: 1 }],
    ['piano',  'candle',  '불타는 건반',     { damage: 6, aoe: true, burn: 3 }],
    ['acrobat', 'piano',  '곡예 무대',       { damage: 4, hits: 5 }],
    ['acrobat', 'curtain', '외줄',           { damage: 6, hits: 2, block: 8 }],
    ['singer', 'joy',     '아리아',          { heal: 14, block: 10 }],
    ['singer', 'trumpet', '이중창',          { damage: 12, block: 8 }],
    ['dead',   'tragedy', '망령의 대가',     { damage: 28, selfDamage: 8 }],
    ['dead',   'candle',  '화장',            { damage: 14, burn: 6, selfDamage: 4 }],
    ['piano',  'drum',    '행진곡',          { damage: 8, aoe: true, slow: 2 }],
    ['piano',  'violin',  '실내악',          { damage: 6, aoe: true, poison: 3 }],
    ['violin', 'tragedy', '비가',            { damage: 14, poison: 5 }],
    ['drum',   'rage',    '전쟁 북',         { damage: 12, burn: 3 }],
    ['trumpet', 'rage',   '진군 나팔',       { damage: 16, burn: 2 }],
    ['rage',   'candle',  '무대에 불이',     { damage: 6, aoe: true, burn: 5 }],
    ['rage',   'rage',    '불타는 무대',     { damage: 8, aoe: true, burn: 5 }],
    ['cold',   'curtain', '겨울의 장막',     { block: 14, slow: 3 }],
    ['cold',   'cold',    '얼어붙은 오페라', { damage: 7, aoe: true, slow: 4 }],
    ['fear',   'mask',    '괴담',            { damage: 10, thorns: 6 }],
    ['sword',  'sword',   '칼춤',            { damage: 13, hits: 2 }],
    ['shield', 'mirror',  '거울의 방',       { block: 16, thorns: 12 }],
    ['shield', 'shield',  '완전한 방벽',     { block: 26 }],
    ['mirror', 'mask',    '이면',            { block: 10, thorns: 14 }],
    ['chain',  'drum',    '사슬 소리',       { damage: 12, pierce: true, slow: 2 }],
    ['rose',   'joy',     '장미의 정원',     { heal: 16, block: 8 }],
    ['crown',  'joy',     '개막 축하',       { block: 10, heal: 6, gold: 10 }],
    ['curtain', 'candle', '무대 화재',       { damage: 5, aoe: true, burn: 6 }]
  ];

  // ── 대본 3종 (18) — 코스트 3. 판을 바꾼다 ──────────────────
  var S3 = [
    ['knight', 'knight', 'knight',  '삼중 기사단',   { damage: 34 }],
    ['knight', 'sword', 'shield',   '완전 무장',     { damage: 20, block: 16 }],
    ['knight', 'chain', 'sword',    '처형대',        { damage: 26, pierce: true }],
    ['king',   'king',  'king',     '삼대의 왕',     { damage: 42 }],
    ['king',   'crown', 'trumpet',  '대관식',        { damage: 22, block: 14, gold: 8 }],
    ['jester', 'jester', 'jester',  '광대의 극',     { damage: 6, hits: 7 }],
    ['jester', 'fear',  'mask',     '악몽 인형극',   { damage: 13, aoe: true, thorns: 6 }],
    ['priest', 'rose',  'joy',      '대성당',        { heal: 26, block: 16 }],
    ['acrobat', 'jester', 'dancer', '서커스',        { damage: 5, hits: 8 }],
    ['dancer', 'cold',  'curtain',  '눈의 무대',     { damage: 10, aoe: true, slow: 4 }],
    ['dead',   'dead',  'dead',     '망자의 행렬',   { damage: 46, selfDamage: 12 }],
    ['dead',   'tragedy', 'candle', '장송곡',        { damage: 20, aoe: true, burn: 6, selfDamage: 8 }],
    ['piano',  'violin', 'trumpet', '관현악',        { damage: 12, aoe: true, poison: 4 }],
    ['piano',  'drum',  'trumpet',  '대행진',        { damage: 14, aoe: true, slow: 3 }],
    ['rage',   'rage',  'candle',   '대화재',        { damage: 12, aoe: true, burn: 9 }],
    ['shield', 'mirror', 'curtain', '난공불락',      { block: 30, thorns: 16 }],
    ['mirror', 'mirror', 'mask',    '거울 미로',     { block: 16, thorns: 22 }],
    ['chain',  'chain', 'drum',     '사슬 감옥',     { damage: 22, pierce: true, slow: 4 }],
    // 증폭을 노리는 3종 — 먼저 걸고 터뜨리는 순서 결정을 만든다
    ['cold',   'drum',  'curtain',  '한겨울',        { damage: 6, aoe: true, slow: 6 }],
    ['candle', 'candle', 'piano',   '불바다',        { damage: 10, aoe: true, burn: 4 }],
    ['violin', 'violin', 'tragedy', '독의 3막',      { damage: 8, poison: 6 }],
    ['acrobat', 'acrobat', 'candle', '불꽃 서커스',  { damage: 3, hits: 6, burn: 1 }]
  ];

  // ── 계열 대본 — 세 장이 같은 계열이면. 코스트 2 ─────────────
  var SFAM = {
    cast:  ['배역들',   { damage: 14 }],
    score: ['합주',     { damage: 7, aoe: true, burn: 2 }],
    prop:  ['무대장치', { block: 14, thorns: 6 }]
  };

  var COST = { one: 1, two: 2, three: 3, fam: 2, free: 1 };

  // ── 캐릭터 6종 ────────────────────────────────────────────
  // 최대 코스트가 캐릭터 고유다. 적으면 강한 대본 하나, 많으면 여러 장.
  var S2MAP = {}, S3MAP = {};
  S2.forEach(function (r) { S2MAP[[r[0], r[1]].sort().join('|')] = { name: r[2], effect: r[3] }; });
  S3.forEach(function (r) { S3MAP[[r[0], r[1], r[2]].sort().join('|')] = { name: r[3], effect: r[4] }; });

  // openers — 공연 전에 준비해둔 대본. 매 전투 시작 시 손패로 들어간다.
  //   이게 없으면 1턴에 대본이 1장뿐이라 코스트를 절반도 못 쓴다.
  //   ['one', 카드] 또는 ['two', 카드A, 카드B]
  // pool — 이 캐릭터의 보상·상점에 우선 등장하는 배역. 빌드가 캐릭터 고유 원리로 자라게 한다.
  // win — 이 캐릭터의 승리 조건. 봇 정책과 보상 선택이 이걸 향해 간다.
  var CHARS = {
    // 처음에는 두 명만 열려 있다. 나머지는 플레이 방식으로 해금한다 —
    // 골드로 사는 계승이 아니라, 그 캐릭터의 승리 조건을 한 번 해내면 열린다.
    // 곱셈이 없는 캐릭터는 3막을 못 넘는다 — 측정에서 연출가만 1% 였다.
    // 「같은 배역을 겹쳐 세운다」가 연출가의 곱셈이다. 릴 집중과 직접 이어진다.
    director: { name: '연출가', maxCost: 4, freeReroll: 1, pairBonus: 0.7, win: 'burst', start: true,
      note: '최대 코스트 4 · 턴마다 재굴림 1회 무료 · 무대에 같은 배역이 2장이면 그 대본 피해 +70%',
      deck: { knight: 4, sword: 3, shield: 3, rose: 3, rage: 3, gem: 2 },
      pool: ['knight', 'king', 'sword', 'shield', 'trumpet', 'gem'],
      openers: [['one', 'knight'], ['one', 'shield'], ['two', 'knight', 'shield']] },
    // 광역 전문은 단일 보스에서 죽는다 — 적이 하나면 광역이 그 하나에 몰린다
    frenzy: { name: '광란의 감독', maxCost: 4, aoeFams: ['cast'], famDmgMul: { cast: 0.55 }, soloAoeMul: 2.2,
      note: '최대 코스트 4 · 배역 대본이 광역이 된다 (피해 55%) · 적이 하나면 광역 피해 2.2배', win: 'sweep',
      // 배역이 광역이 되는 캐릭터인데 소품(칼)이 섞이면 조합이 배역 순수가 안 된다 — 배역으로 채웠다
      deck: { knight: 5, king: 3, jester: 3, rage: 4, candle: 3 },
      pool: ['knight', 'king', 'jester', 'dancer', 'acrobat', 'rage', 'candle'],
      unlock: '한 전투를 광역 대본만으로 끝낸다',
      openers: [['one', 'knight'], ['one', 'rage'], ['two', 'king', 'rage']] },
    // 3막 적 다섯 중 셋이 방어력이 높다. 반사가 방어력에 깎이면 이 캐릭터만 원천 봉인된다.
    mirror: { name: '거울의 배우', maxCost: 4, thornsMul: 1.35, overflowMul: 1.2, thornsIgnoreDef: true, start: true,
      note: '반사 상한 1.35배 · 초과 방어 전환 1.2배 · 반사가 방어력을 무시한다', win: 'reflect',
      deck: { mirror: 5, shield: 5, mask: 3, rose: 3, priest: 2 },
      pool: ['mirror', 'shield', 'mask', 'curtain', 'rose', 'priest'],
      openers: [['one', 'shield'], ['one', 'mirror'], ['two', 'shield', 'mirror']] },
    // 혼자 53% 였다. 원인은 최대 코스트 5 — 매 턴 한 장을 더 쓰는데 상태이상 증폭까지 겹쳤다.
    // 계열 밖 코스트 +1 을 먼저 붙여 봤지만 덱이 이미 전부 악상이라 대가가 되지 않았다 (52%).
    // 그래서 템포 우위를 걷어내고 대신 진짜 상태이상 엔진을 줬다 —
    // 악상 대본의 화상·독·둔화가 각각 +1. 전문가는 깊이로 이긴다.
    maestro: { name: '악장', maxCost: 5, mainFam: 'score', offFamCost: 1,
      famStatusPlus: { score: 1 }, win: 'status',
      note: '최대 코스트 5 · 악상 대본의 화상·독·둔화 +1 · 악상이 아닌 대본은 코스트 +1',
      deck: { piano: 4, violin: 4, drum: 3, trumpet: 3, joy: 4 },
      pool: ['piano', 'violin', 'drum', 'trumpet', 'cold', 'rage', 'candle'],
      // 둔화 상한을 +45% 로 내린 뒤 1.5배는 도달 불가가 됐다 (해금률 0%) — 상한 아래로 내렸다
      unlock: '한 전투에서 증폭 배율 1.35배 이상을 만든다',
      openers: [['one', 'trumpet'], ['one', 'piano'], ['two', 'piano', 'drum']] },
    // 자해를 무시하게 하면 대가가 없어져 곱셈도 없다 — 그냥 밋밋한 딜러였다(38%).
    // 자해를 실제로 받게 하니 곱셈이 생겼지만 저숙련에서 자살이 됐다 (보통 8%).
    // 그래서 둘을 붙였다 — 자해로는 죽지 않고, 처형에 성공하면 태운 피가 절반 돌아온다.
    // 위험은 남는다: 피가 낮아지면 적이 끝낸다.
    // 21전투짜리 판에서는 자해가 누적 위험이 되어 봇이 아예 안 썼다 —
    // 코스트 사용률이 50% 로 혼자 압도적으로 낮았다 (다른 캐릭터 67~71%).
    // 태운 피가 다음 턴에 절반 돌아오면 계속 태울 수 있다. 위험은 그 한 턴에 남는다.
    fallen: { name: '타락한 감독', maxCost: 5, selfToDmg: 2.2, hpDelta: 20,
      selfFloor: true, selfRefund: 0.5, bleedBack: 0.5,
      note: '최대 코스트 5 · 최대 HP +20 · 자해한 만큼 피해 +2.2배 · 자해로는 쓰러지지 않는다'
          + ' · 태운 피의 절반이 다음 턴에 돌아온다 (적을 퇴장시키면 즉시)', win: 'burst',
      deck: { dead: 4, tragedy: 4, sword: 4, candle: 3, chain: 3 },
      pool: ['dead', 'tragedy', 'sword', 'chain', 'candle', 'violin'],
      unlock: 'HP 25% 이하로 한 전투를 이겨낸다',
      openers: [['one', 'sword'], ['one', 'tragedy'], ['two', 'dead', 'tragedy']] },
    // 다타 감쇠(×0.6) · 보석 상한 · 증폭 하향을 연달아 맞아 곱셈이 세 번 깎였다 (17%).
    // 상태이상에 얹혀 있던 정체성을 독립시켰다 — 다타가 방어력을 벗긴다.
    // 여러 번 찔러 틈을 만드는 그림이고, 철갑 인형처럼 방어력으로 버티는 적의 답이 된다.
    harlequin: { name: '어릿광대', maxCost: 4, handBonus: 2, hitsShred: 1, hitsDotFull: true, hitSpill: true,
      note: '대본 보유 +2 · 다타 대본은 타격 수만큼 방어력을 영구히 깎는다'
          + ' · 다타의 화상·독이 감쇠 없이 타격 수만큼 들어간다'
          + ' · 적이 퇴장하면 남은 타격이 다음 적에게 넘어간다', win: 'hits',
      deck: { jester: 4, acrobat: 4, gem: 3, dancer: 3, curtain: 4 },
      pool: ['jester', 'acrobat', 'dancer', 'gem', 'candle', 'violin'],
      unlock: '한 전투에서 즉석 대본을 6장 상연한다',
      openers: [['one', 'jester'], ['one', 'acrobat'], ['two', 'jester', 'jester']] },

    // 관중이 곱셈이 되는 캐릭터. 환호가 오를수록 세지고, 같은 대본을 반복하면 두 배로 식는다 —
    // 「매 턴 다른 것을 해야 하는」 유일한 캐릭터다.
    // 전투가 4~5턴이라 환호 100 은 닿지 않았다 — 환호 빌드가 환호 보상을 못 받았다.
    // 무대에 오르면 이미 팬이 있고(30), 박수를 받는 기준도 낮다(80).
    darling: { name: '관객의 총아', maxCost: 4, win: 'cheer',
      cheerDmgPer: 0.13, cheerDmgCap: 0.9, ovationBonus: 1, repeatMul: 2, cheerW: 2.6,
      cheerStart: 28, cheerNeed: 55, freshBonus: 9,
      note: '환호 28로 시작 · 환호 10당 피해 +13% (최대 +90%) · 박수 기준 55 · 기립 박수 코스트 +3'
          + ' · 이번 전투에 처음 쓰는 대본마다 환호 +9 · 같은 대본 반복 감점 2배',
      // 첫 덱이 방어·회복·골드 위주라 딜이 없었다 (승률 8%).
      // 배역 순수로 채워서 계열 대본「배역들」이 자주 뜨게 했다 — 그게 딜이면서 환호다.
      deck: { king: 4, jester: 4, singer: 3, trumpet: 3, crown: 2, joy: 2 },
      pool: ['king', 'jester', 'singer', 'trumpet', 'crown', 'joy', 'priest'],
      unlock: '한 판에서 기립 박수를 3회 받는다',
      openers: [['one', 'king'], ['one', 'trumpet'], ['two', 'singer', 'trumpet']] }
  };

  var WIN_KO = { burst: '한 방', sweep: '광역 소각', reflect: '반사·방어', status: '상태이상 증폭',
                 hits: '다타 누적', cheer: '관중 환호' };

  // 캐릭터별 대본 풀 — 요구 배역이 이 캐릭터 풀에 들어 있으면 보상에 더 자주 뜬다
  function scriptWeight(ch, sc) {
    var pool = (ch && ch.pool) || [];
    if (!pool.length) return 1;
    var req = sc.requiresFam ? [] : (sc.requires || []);
    if (!req.length) return 1;
    var hit = req.filter(function (id) { return pool.indexOf(id) >= 0; }).length;
    return hit === req.length ? 4 : (hit ? 2 : 1);
  }

  // openers 정의를 실제 대본 객체로 만든다
  function makeOpeners(ch) {
    return (ch.openers || []).map(function (o) {
      if (o[0] === 'one') {
        var s = S1[o[1]];
        return s ? { tier: 'one', name: s[0], effect: s[1], cost: COST.one, uses: [o[1]] } : null;
      }
      var k = [o[1], o[2]].sort().join('|'), t = S2MAP[k];
      return t ? { tier: 'two', name: t.name, effect: t.effect, cost: COST.two, uses: [o[1], o[2]] } : null;
    }).filter(Boolean);
  }

  // ── 적 ────────────────────────────────────────────────────
  var ENEMIES = [
    { act: 1, name: '잊혀진 관객',   hp: 18, atk: 4,  def: 0, cd: 2, intents: [['attack', 3]] },
    { act: 1, name: '가면 없는 배우', hp: 22, atk: 5,  def: 1, cd: 2, intents: [['attack', 2], ['attackBleed', 1, 2]] },
    // 쿨타임 1 은 다수로 나오면 즉사가 된다 — 3마리면 턴당 36 피해로 2턴에 끝났다
    { act: 1, name: '무대 거미',     hp: 14, atk: 6,  def: 0, cd: 2, maxCount: 2, intents: [['attack', 2], ['doubleStrike', 1]] },
    // 잡몹도 대응을 요구해야 전투가 「스쳐 지나가지」 않는다 — 수치는 그대로 두고 규칙을 준다
    { act: 1, name: '춤추는 그림자', hp: 20, atk: 5,  def: 2, cd: 2, evadeSingle: 0.25,
      intents: [['attack', 2], ['defend', 1, 6]], demands: '광역 · 다타' },
    // 표적 순서를 2막에서 미리 가르친다. 초보는 수치가 아니라 「답을 안 찾아서」 죽는다 —
    // 공격 배율을 올려도 초보 승률은 안 움직였고 숙련만 깎였다.
    { act: 2, name: '미친 왕',       hp: 32, atk: 9,  def: 3, cd: 2, solo: true, guardMul: 0.45,
      adds: [{ name: '시종', hp: 15, atk: 6, def: 0, cd: 2, role: 'guard',
               intents: [['attack', 2], ['defend', 1, 5]] }],
      intents: [['attack', 2], ['buff', 1, 4]], demands: '시종을 먼저' },
    // 2막 최다 학살자였다 — 7 캐릭터 중 5명의 1위 사인. 4마리 × 공격 18 × 방어력 성장이 겹쳤다.
    { act: 2, name: '웃는 병사',     hp: 28, atk: 8, def: 2, cd: 2, defGrow: 1, defMax: 7, maxCount: 3,
      intents: [['attack', 2], ['attackBleed', 1, 3]], demands: '관통 · 빠른 처리' },
    { act: 2, name: '노래하는 해골', hp: 24, atk: 7,  def: 1, cd: 3, intents: [['attack', 1], ['attackBurn', 1, 3], ['healAll', 1, 8]], demands: '한 번에 눕히기' },
    { act: 2, name: '박수치는 관객', hp: 26, atk: 8,  def: 2, cd: 2, gimmick: 'mimic', gimCd: 4,
      intents: [['attack', 2], ['defend', 1, 8], ['buff', 1, 3]], demands: '큰 대본을 아껴 쓰기' },
    // 방어력이 무한히 자라면 방어·반사 빌드가 죽지도 못하고 시간만 끈다 — 상한을 둔다
    { act: 3, name: '철갑 인형', hp: 60,  atk: 14, def: 8, cd: 3, dotImmune: true, defGrow: 4, defMax: 20, solo: true,
      intents: [['attack', 2], ['defend', 1, 12]], demands: '관통 · 빠른 화력' },
    { act: 3, name: '흡수체',    hp: 44,  atk: 14, def: 2,  cd: 2,
      intents: [['attack', 2], ['absorb', 3], ['buff', 1, 4]], demands: '방어 비의존 딜' },
    { act: 3, name: '유령 배우', hp: 36,  atk: 13, def: 0,  cd: 2, evadeSingle: 0.35, maxCount: 2,
      intents: [['attack', 2], ['doubleStrike', 1]], demands: '광역 · 다타' },
    { act: 3, name: '종지기',    hp: 110, atk: 12, def: 3,  cd: 2, doom: 5, solo: true,
      intents: [['attack', 2], ['buff', 1, 5]], demands: '속도' },
    // 보스는 수치가 아니라 「강제되는 대응」으로 기억된다.
    // 닼던1 의 방식이다 — 하수인을 먼저 죽이게 만들고, 자원을 빼앗고, 시계를 건다.

    // 스와인 프린스 계열 — 동반자가 살아 있으면 본체가 거의 안 깎인다. 표적 순서를 강제한다.
    { act: 1, name: '무대감독',  hp: 110,  atk: 8,  def: 3, cd: 2, boss: true,
      gimmick: 'mimic', gimCd: 3, guardMul: 0.4,
      adds: [{ name: '조명 담당', hp: 16, atk: 5, def: 0, cd: 2, role: 'guard',
               intents: [['attack', 2], ['defend', 1, 5]] }],
      intents: [['attack', 2], ['attackBleed', 1, 3], ['buff', 1, 3], ['defend', 1, 10]],
      demands: '조명을 먼저 끈다' },

    // 하그 계열 — 내 자원을 빼앗는다. 대본을 압수하고 배역을 검열한다.
    { act: 2, name: '폭군',      hp: 150, atk: 14, def: 5, cd: 3, boss: true,
      gimmick: 'censor', gimCd: 3, seizeCd: 5, seizeMax: 2,
      intents: [['attack', 2], ['attackBurn', 1, 4], ['defend', 1, 12], ['buff', 1, 5]],
      demands: '대본 한두 장이 봉인돼도 굴러가는 폭' },

    // 심장 계열 — 절반에서 2막이 열리고 시계가 돌아간다. 시간을 넘기면 막이 내려간다.
    { act: 3, name: '초대 감독', hp: 150, atk: 17, def: 6, cd: 3, boss: true, curse: 1,
      // 시계는 넉넉하게 주고, 관객을 처치하면 시간을 되사게 한다 —
      // 하수인이 시간을 사는 자원이 되면 「누구를 먼저 치는가」가 매 턴 결정이 된다.
      gimmick: 'phase', phaseAt: 0.5, phaseDoom: 9, phaseAtkMul: 1.4, phaseDef: 3, clockPerAdd: 2,
      adds2: [{ name: '관객', hp: 20, atk: 9, def: 0, cd: 2, intents: [['attack', 1]] },
              { name: '관객', hp: 20, atk: 9, def: 0, cd: 2, intents: [['attack', 1]] }],
      intents: [['attack', 2], ['attackBurn', 1, 5], ['defend', 1, 15], ['buff', 1, 6]],
      demands: '2막이 열리면 5턴 안에 끝낸다' }
  ];

  // ── 난입자 ────────────────────────────────────────────────
  // 닼던의 콜렉터처럼 일반 공연 중에 난입한다. 한 턴 미리 예고한다 —
  // 랜덤은 계획 가능해야 한다는 원칙 때문이다. 처치하면 대본 한 장을 확정으로 준다.
  var INTRUDERS = [
    { name: '수집가',   icon: '🎩', hp: 46, atk: 13, def: 4, cd: 2, intrude: true, gimmick: 'mimic', gimCd: 2,
      intents: [['attack', 2], ['defend', 1, 10]], demands: '난입 — 내 대본을 흉내낸다' },
    { name: '불타는 막', icon: '🔥', hp: 34, atk: 9,  def: 2, cd: 2, intrude: true, gimmick: 'ignite',
      intents: [['attack', 2], ['buff', 1, 4]], demands: '난입 — 매 턴 무대가 타오른다' },
    { name: '검열관',   icon: '✂️', hp: 40, atk: 11, def: 3, cd: 2, intrude: true, gimmick: 'censor', gimCd: 2,
      intents: [['attack', 2], ['attackBleed', 1, 3]], demands: '난입 — 배역을 봉인한다' },
    // 승천으로 열리는 난입자
    { name: '대역 도둑', icon: '🎭', hp: 44, atk: 12, def: 3, cd: 2, intrude: true, asc: 1,
      seizeCd: 3, seizeMax: 2,
      intents: [['attack', 2], ['defend', 1, 8]], demands: '난입 — 대본을 훔친다' },
    { name: '무대 붕괴', icon: '🏚', hp: 52, atk: 15, def: 5, cd: 3, intrude: true, asc: 1, gimmick: 'ignite',
      intents: [['attack', 2], ['doubleStrike', 1]], demands: '난입 — 무대가 무너진다' }
  ];
  // 층이 올라갈수록 난입 확률이 오른다
  // 막이 오를수록 난입이 잦아진다 — 중간 구간에도 위협이 있어야 한다
  function intrudeChance(floor) {
    var act = Math.min(3, Math.floor(floor / CFG.actLen) + 1);
    return [0.08, 0.24, 0.36][act - 1];
  }

  // 스토리는 서사를 보러 온 사람의 자리다 — 어느 덱이든 넘어가야 한다.
  // 보통은 로그라이크의 기본값이다 — 첫 클리어가 사건이어야 한다.
  // 난이도 선택은 「얼마나 아픈가」가 아니라 「무엇을 하러 왔는가」를 묻는 자리다.
  var DIFFICULTY = {
    // 계획을 안 하는 사람도 넘길 수 있어야 이 난이도가 제 역할을 한다.
    // HP ×1.35 / 공격 ×1.05 로는 무작정형이 24% 였다 — 구제가 아니었다.
    story:  { name: '스토리', hpMul: 1.0, atkMul: 0.55,
              note: '이야기를 보러 왔다', sub: '계획 없이 눌러도 막을 넘긴다. 규칙을 익히는 자리다.' },
    // 공격 배율을 2.0 → 2.15 로 올려 봤는데 처음 하는 사람은 26% 에서 그대로였고
    // 익숙·숙련만 6pp·3pp 깎였다. 초보의 죽음은 수치가 아니라 기믹 대응 실패다.
    // 맵 규칙(보스 직전 분장실 보장·소품실 최소 2개)이 승률을 올려서(숙련 44% → 58%)
    // 공격 배율로 되돌렸다. 이 지렛대는 숙련만 깎고 초보는 그대로 둔다 — 27.2 참조.
    normal: { name: '보통',   hpMul: 2.55, atkMul: 1.8,
              note: '로그라이크로 한다', sub: '첫 클리어가 사건이다. 죽고 다시 하면서 배운다.' },
    // 승천 1단이 곧 이 난이도다. 3.3 / 2.7 로는 클리어가 15% 라 승천이 거의 올라가지 않았다.
    hard:   { name: '어려움', hpMul: 3.0,  atkMul: 2.05,
              note: '이미 이겨본 사람의 자리', sub: '운과 실력이 함께 있어야 한다. 여기서 승천이 열린다.' }
  };

  // ── 극단 성장 ─────────────────────────────────────────────
  // 막 보스를 넘기면 셋 중 하나를 고른다. 성장을 자동으로 주면 런마다 같아진다 —
  // 고르게 하면 「이번 판은 무대를 넓혔다」와 「이번 판은 코스트로 갔다」가 갈린다.
  var GROWTH = [
    { id: 'stage',  icon: '🎭', name: '무대 확장',  desc: '무대 칸 +1',            max: 2 },
    { id: 'cost',   icon: '⚡', name: '개막 예산',  desc: '최대 코스트 +1',        max: 2 },
    { id: 'temp',   icon: '✨', name: '즉흥 극단',  desc: '즉석 대본 +1',          max: 2 },
    { id: 'hand',   icon: '📜', name: '대본 창고',  desc: '대본 보유 +2',          max: 2 },
    { id: 'reroll', icon: '🔁', name: '무대 감독',  desc: '턴마다 무료 재굴림 +1', max: 1 },
    { id: 'cheer',  icon: '🙌', name: '단골 관객',  desc: '전투를 환호 25로 시작', max: 2 },
    { id: 'cast',   icon: '🌟', name: '이중 캐스팅', desc: '주연을 한 명 더 세운다', max: 1 }
  ];

  // ── 사건 (이벤트 노드) ────────────────────────────────────
  // 전투도 상점도 아닌 칸. 대가를 내고 무언가를 바꾼다.
  // 판마다 다른 이야기가 생기게 하는 값싼 방법이고, 「한 번 더」의 이유가 된다.
  var EVENTS = [
    { id: 'ghost',  name: '유령 관객',   icon: '👻',
      text: '텅 빈 좌석 하나가 계속 박수를 친다. 대본 한 권을 원한다.',
      opts: [['대본 하나를 넘긴다 — 유물을 받는다', 'ghost'],
             ['무시하고 지나간다', 'none']] },
    { id: 'trunk',  name: '낡은 트렁크', icon: '🧰',
      text: '누가 두고 간 트렁크. 열면 무엇이 들었는지는 모른다.',
      opts: [['연다 — 릴 3칸이 무작위로 바뀐다', 'trunk'],
             ['그냥 둔다', 'none']] },
    { id: 'dresser', name: '분장사',     icon: '💄',
      text: '분장사가 대본 한 편을 손봐 주겠다고 한다. 살을 좀 내달라고 한다.',
      opts: [['최대 HP 12% 를 내준다 — 대본 하나의 코스트 −1', 'dresser'],
             ['거절한다', 'none']] },
    { id: 'beggar', name: '굶주린 관객', icon: '🍞',
      text: '객석에서 손을 내민다. 대신 주머니를 털어 주겠다고 한다.',
      opts: [['HP 18% 를 내준다 — 골드 34', 'beggar'],
             ['돌아선다', 'none']] },
    { id: 'audition', name: '대역 오디션', icon: '🎬',
      text: '같은 배역 둘이 서로를 노려본다. 하나로 합칠 수 있다.',
      opts: [['같은 배역 2장을 1장으로 — 그 배역 1장을 더 강한 것으로', 'merge'],
             ['둘 다 남긴다', 'none']] },
    { id: 'burning', name: '불타는 대본', icon: '🔥',
      text: '대본 한 권이 저절로 타오른다. 그 불을 무대에 옮길 수 있다.',
      opts: [['대본 하나를 태운다 — 이번 막 동안 화상 +2', 'burning'],
             ['불을 끈다', 'none']] }
  ];

  // ── 판 사이에 남는 것 ─────────────────────────────────────
  // 화폐를 만들지 않는다. 저번 판의 「흔적」이 다음 판을 조금 낫게 한다.
  // 이게 없으면 다음 판을 할 이유가 해금 하나뿐이고, 그러면 사람이 떠난다.

  // ① 초연 기록 — 누적 도달 층수로 시작 조건이 자란다
  // 층수 기준은 실측으로 잡았다 — 누적 층수 중위가 82 인데 130·210·320 을 요구하니
  // 후반 단계 도달률이 21% · 9% · 3% 였다. 닿지 않는 목표는 이유가 되지 않는다.
  // 층수가 12 → 36 으로 늘었다. 판당 19.3층이 실측이라 그 배수로 잡았다.
  // 마지막 단계는 620 에서 도달률이 4% 라 480 으로 당겼다 — 장기 목표라도 닿아야 목표다.
  var PREMIERE = [
    { at: 40,  kind: 'swap',   n: 1, name: '연습실',     desc: '시작 릴의 배역 1칸을 원하는 것으로 바꾼다' },
    { at: 110,  kind: 'script', n: 1, name: '초고',       desc: '시작 대본 +1' },
    { at: 220, kind: 'swap',   n: 3, name: '전속 배우',   desc: '시작 릴을 3칸까지 바꾼다' },
    { at: 380, kind: 'vault',  n: 1, name: '극장 창고',   desc: '계승 유물 슬롯 +1' },
    { at: 480, kind: 'script', n: 2, name: '개정판',     desc: '시작 대본 +1 (누적 2)' }
  ];

  // ② 유물 계승 — 런이 끝나면 그 판의 유물 하나가 창고에 남는다.
  //    다음 런은 창고에서 하나를 들고 시작한다. 골드로 사는 게 아니라 저번 판에서 가져온다.
  var VAULT_BASE = 1;

  // ③ 대본 서고 — 한 번이라도 상연한 대본은 다음 런 보상에 더 자주 뜬다.
  //    「내 덱을 만들어간다」는 감각이 여기서 나온다.
  var ARCHIVE_MUL = 2.2;

  function premiereAt(floors) {
    var o = { swap: 0, script: 0, vault: VAULT_BASE, next: null };
    PREMIERE.forEach(function (p) {
      if (floors >= p.at) {
        if (p.kind === 'swap') o.swap = Math.max(o.swap, p.n);
        if (p.kind === 'script') o.script = Math.max(o.script, p.n);
        if (p.kind === 'vault') o.vault += p.n;
      } else if (!o.next) o.next = p;
    });
    return o;
  }

  // ── 승천 — 저주받은 대본 ──────────────────────────────────
  // 반복 성장의 뼈대다. 수치를 올리지 않고 규칙을 하나씩 더한다.
  // 축은 셋이다 — 보스 기믹 / 난입 / 관중.
  var ASCENSION = [
    { n: 1, name: '난입이 흔해진다',       desc: '난입 확률 2배',                    intrudeMul: 2 },
    { n: 2, name: '관객이 성급해진다',     desc: '야유가 8턴부터 시작된다',           stallDelta: -4 },
    { n: 3, name: '무대감독이 검열을 배운다', desc: '1막 보스가 기믹을 하나 더 얻는다', bossExtra: 1 },
    { n: 4, name: '난입자가 둘 온다',      desc: '한 전투에 난입자가 둘까지 들어온다', intrudeMax: 2 },
    { n: 5, name: '박수가 인색해진다',     desc: '기립 박수 요구가 130으로 오른다',    cheerMax: 130 },
    { n: 6, name: '새 난입자가 나타난다',  desc: '난입자 종류가 늘어난다',            intrudeNew: 1 },
    { n: 7, name: '모든 보스가 배운다',    desc: '보스마다 기믹을 하나 더 얻는다',     bossExtra: 2 },
    { n: 8, name: '관객이 등을 돌린다',    desc: '야유가 6턴부터 · 매 턴 HP −5',      stallDelta: -6, stallDmg: 5 }
  ];

  // 승천으로 보스가 추가로 얻는 기믹 — 각 보스가 「배우는」 순서
  var BOSS_LEARN = {
    무대감독:    [{ gimmick: 'censor', gimCd: 4 }, { seizeCd: 6, seizeMax: 1 }],
    폭군:        [{ guardMul: 0.5, adds: [{ name: '검열 조수', hp: 18, atk: 7, def: 1, cd: 2, role: 'guard',
                     intents: [['attack', 2], ['defend', 1, 6]] }] }, { gimmick: 'mimic', gimCd: 3 }],
    '초대 감독': [{ seizeCd: 5, seizeMax: 2 }, { gimCd: 3 }]
  };

  // 승천 단계를 하나의 수정자로 접는다
  function ascend(level) {
    var m = { intrudeMul: 1, intrudeMax: 1, stallDelta: 0, stallDmg: CFG.stallDmg,
              cheerMax: CHEER.max, bossExtra: 0, intrudeNew: 0, level: level || 0 };
    ASCENSION.slice(0, level || 0).forEach(function (a) {
      if (a.intrudeMul) m.intrudeMul *= a.intrudeMul;
      if (a.intrudeMax) m.intrudeMax = Math.max(m.intrudeMax, a.intrudeMax);
      if (a.stallDelta) m.stallDelta += a.stallDelta;
      if (a.stallDmg) m.stallDmg = a.stallDmg;
      if (a.cheerMax) m.cheerMax = a.cheerMax;
      if (a.bossExtra) m.bossExtra = Math.max(m.bossExtra, a.bossExtra);
      if (a.intrudeNew) m.intrudeNew += a.intrudeNew;
    });
    return m;
  }

  var CFG = {
    // 3막 × 12층 + 막마다 보스. 12층일 때 한 판이 30턴(숙련 10분)이라 너무 짧았다 —
    // 슬더슬이 전투 25개에 150~200턴인데 우리는 전투 6개에 30턴이었다.
    floors: 36, actLen: 12,
    // 플레이어 화력 통지 — 1막 적 HP 31 에 턴당 피해 30~40 이면 한 턴에 한 마리가 사라진다.
    // 적 HP 를 올리면 「벽처럼 느껴진다」로 돌아가니 화력 쪽을 낮춘다.
    dmgMul: 0.8,
    reelSlots: 18, reelMax: 26,
    // 대본을 많이 들면 희소성이 사라지고 코스트 계산만 무거워진다.
    // 상한 10 일 때 실제 보유가 9.2장이었고 그중 턴당 2.57장만 썼다.
    handLimit: 7, scriptBase: 7,
    // 무대는 3칸에서 시작해 막을 넘길 때마다 넓어진다 — 로그라이크의 성장축을 하나 더 만든다
    stageBase: 3, stageMax: 5,
    // 즉석 대본은 기본 1장. 유물과 환호로 늘린다
    tempBase: 1,
    blockCapPct: 50, thornCap: 24, overflowConv: 50,
    hpBase: 60, hpPerAct: 42, costPerAct: 1,   // 전투가 6개 → 13개로 늘어 소모전이 누적된다
    // 막이 길어지면 관객이 야유한다 — 답이 없는 조합으로 버티는 교착을 끝낸다.
    // 이게 없으면 「죽지도 못하고 60턴」이 전체의 7% 였다. 12턴이면 루즈해지기 전에 조인다.
    // 10턴 — 초보의 전투는 길다. 야유가 그걸 실제로 물어야 앞쪽 층이 위협이 된다.
    // 초보 죽음의 76% 가 10~12층에 몰려 있었다. 1~9층이 무저항이면 로그라이크가 아니다.
    stallTurn: 10, stallAtkPer: 0.10, stallDmg: 3,
    // 막별 곡선 — 사망의 52% 가 1막에 몰려 있었다. 1막을 낮추고 2·3막을 올린다.
    // HP 뿐 아니라 공격도 막마다 오른다 — 뒤로 갈수록 실수의 대가가 커야 한다.
    // 같은 배율을 전 막에 물리면 잡몹 하나에 3~4턴이 걸렸다.
    actHp: [0.60, 1.00, 1.30], actAtk: [0.85, 1.05, 1.25],
    // 골드 — 남으면 결정이 아니다.
    // 이전 수치(시작 40 · 공연 16~27 · 비극 +15 · 난입 +20)로는 판 끝에 평균 94 가 남고
    // 61% 가 60 이상을 남겼다. 살 것을 다 사고도 남는다는 뜻이다.
    // 시작 골드는 없다. 골드는 무대에 선 대가로만 들어온다.
    // 릴은 「빼는 데 돈을 내는」 게 아니라 「팔아서 돈을 받는」 것이다 —
    // 릴을 좁히면 확률이 오르고 자금도 생긴다. 대신 대본 요구를 못 채울 위험을 진다.
    // 릴 판매가 골드를 주면 후반에 돈이 스스로 불어난다 — 상점마다 1.83칸을 팔았고
    // 3막 상점 입장 잔액이 125 였다. 파는 것은 칸만 비운다. 좁히기의 이득은 확률이다.
    gold: { start: 0, fightBase: 5, fightRand: 5, elite: 10, intruder: 12,
            sell: 0, sellMax: 2, reelMin: 12,
            // 후반 지출처 — 유물은 막이 오를수록 비싸고, 대본 승급이 새로 열린다
            // 승급도 막별 물가다 — 초반엔 싸서 살 수 있고 후반엔 비싸서 지출처로 남는다
            relicActMul: [0.85, 1.35, 1.7], upgrade: [20, 32, 44] }
  };

  // ── 관중 ──────────────────────────────────────────────────
  // 야유만 있으면 압박뿐이다. 환호를 같이 둬서 「크게 가는 것」이 보상받게 한다.
  // 그리고 같은 대본 반복에 감점을 둔다 — 측정에서 1종 대본 반복이 전체 상연의 40% 였다.
  // 요구가 100 이고 적립이 느려서 기립 박수가 0.6~0.8 회/판 이었다 —
  // 전투가 4~5턴인데 100 은 닿지 않는다. 요구를 낮추고 적립을 올렸다.
  var CHEER = {
    // 전투마다 0 으로 밀면 쌓는 재미가 없다. 환호는 런 내내 이어지고,
    // 오직 기립 박수(가득 참)에서만 0 으로 돌아간다.
    // 그래서 「터뜨릴까 유지할까」가 결정이 된다 — 차오르는 동안 대본이 강해지니까.
    max: 100,
    // 환호가 높게 유지되면 모든 대본이 강해진다. 관객이 달아오른 무대다.
    boost: [[40, 0.10], [75, 0.22]],
    // 환호가 깎이는 조건이 있어야 「유지」가 덱이 된다.
    // 크게 맞으면 관객이 등을 돌리고, 무대가 비면 식는다.
    dropAt: 0.15,     // 한 번에 최대 HP 의 15% 이상을 잃으면 환호가 0 이 된다
    emptyTurn: -25,   // 대본을 하나도 못 올린 턴
    // 증폭 폭발이 환호의 최대 원천이면 상태이상 캐릭터가 환호까지 독점한다 —
    // 실측에서 악장이 8.1회/판, 환호 캐릭터가 3.9회/판 이었다.
    // 환호는 「크고 다양한 무대」의 보상이어야 한다. 그래서 3종·계열을 최대 원천으로 올렸다.
    onThree: 24,      // 3종·계열 대본을 상연하면
    onKill: 12,       // 적이 퇴장하면
    onAmp: 8,         // 증폭이 실제로 터지면
    onHits: 7,        // 3타 이상 다타
    onFresh: 0,       // 이번 전투에서 처음 쓰는 대본 (캐릭터 고유로만 붙는다)
    repeat: -9,       // 같은 대본을 연속으로 또 쓰면 (반복마다 누적)
    coolPerTurn: -10, // 야유 구간(12턴 이후)부터 매 턴 식는다
    ovation: 2,       // 가득 차면 기립 박수 — 코스트 +2 즉시 회복
    // 기립 박수는 골드도 준다. 관객을 달구는 것이 곧 자금이 되면
    // 「크게·다양하게 간다」가 전투 밖의 계획으로 이어진다.
    ovationGold: 7,
    // 관객은 안전한 무대를 보러 오지 않는다 —
    // 벼랑에서 이기면 열광하고, 그 열기가 다음 무대까지 간다.
    thrillAt: 0.30, thrillGold: 15, thrillCheer: 30
  };

  // ── 관객의 요구 ───────────────────────────────────────────
  // 플레이어의 목표가 「효율적으로 죽이기」 하나뿐이면 매 턴 같은 판단이 된다.
  // 요구가 붙으면 효율과 관객이 충돌한다 — 지금 죽일 수 있는데 웃기려고 다타를 낼 것인가.
  //
  //   · 하나씩 걸고, 달성하면 즉시 다음이 온다 (짧은 전투 1개, 보스전 3~4개로 자연 스케일)
  //   · 실패 벌칙은 없다. 못 하는 요구가 반드시 나오니 「포기한다」가 판단이어야 한다
  //   · 수치는 절대값이 아니라 비율 — 막마다 자동으로 맞는다
  var DEMANDS = [
    { id: 'burst',  icon: '🩸', name: '피를 보여라',    desc: '한 번의 상연으로 적 최대 HP의 30%', win: 'burst' },
    { id: 'kill',   icon: '💀', name: '단칼에',         desc: '한 번의 상연으로 적을 퇴장시킨다',   win: 'burst' },
    { id: 'hits',   icon: '🎭', name: '웃겨라',         desc: '한 턴에 5회 이상 타격',             win: 'hits' },
    { id: 'aoe',    icon: '👥', name: '무대를 채워라',  desc: '한 번의 광역으로 3명 이상 타격',     win: 'sweep' },
    { id: 'burn',   icon: '🔥', name: '불태워라',       desc: '화상을 8 이상 쌓는다',              win: 'status' },
    { id: 'slow',   icon: '❄️', name: '얼려라',         desc: '둔화를 5스택 이상 쌓는다',          win: 'status' },
    { id: 'block',  icon: '🛡', name: '막아내라',       desc: '한 턴에 방어 25 이상',              win: 'reflect' },
    { id: 'thorns', icon: '🪞', name: '되갚아라',       desc: '반사로 누적 20 피해',               win: 'reflect' },
    { id: 'big',    icon: '🎬', name: '대작을 올려라',  desc: '3종 또는 계열 대본을 상연한다' },
    { id: 'many',   icon: '⚡', name: '쉬지 마라',      desc: '한 턴에 대본 4장 이상 상연' },
    { id: 'self',   icon: '🕯', name: '희생하라',       desc: '한 턴에 자해로 15 이상 잃는다',      win: 'burst' },
    { id: 'heal',   icon: '🌹', name: '살려라',         desc: '한 턴에 회복 20 이상',              win: 'cheer' },
    // 전투 끝에 판정되는 유일한 요구 — 그래서 보상도 다르다 (환호는 막과 함께 사라지니까)
    { id: 'thrill', icon: '😱', name: '아슬아슬하게',   desc: 'HP 30% 이하로 이 전투를 이긴다', endOfFight: true }
  ];
  var DEMAND_CHEER = 30;      // 달성하면 환호 +30 — 기립 박수의 절반쯤이 한 번에 온다

  var CHEER_TEXT = [
    ['🙌 환호', '3종·계열 상연 +14 · 적 퇴장 +9 · 증폭 폭발 +11 · 다타 +5'],
    ['👏 기립 박수', '환호가 가득 차면 즉시 코스트 +2 · 골드 +7 (환호는 0으로)'],
    ['🎪 이어진다', '환호는 런 내내 남는다 — 기립 박수로 터질 때만 0 이 된다'],
    ['🔥 달아오른 무대', '환호 40 이상이면 모든 대본 피해 +10% · 75 이상이면 +22%'],
    ['💔 등을 돌린다', '한 번에 최대 HP 15% 이상을 잃으면 환호가 0 · 빈 턴은 −25'],
    ['🎯 관객의 요구', '요구를 들어주면 환호 +30 · 곧바로 다음 요구가 온다 (실패해도 벌은 없다)'],
    ['😱 아슬아슬하게', '관객이 요구할 때만 — HP 30% 이하로 이기면 골드 +15 · 환호 +30'],
    ['😐 반복', '같은 대본을 연속으로 또 쓰면 환호 −9 (반복할수록 누적)'],
    ['😠 야유', '12턴부터 매 턴 적 공격 +10% · 내 HP −3 · 환호 −10']
  ];

  // 보스 기믹 설명 — UI 에 그대로 띄운다. 무엇을 강제하는지가 보여야 한다.
  var GIMMICK_TEXT = {
    mimic:  ['🎬 재연',   '3턴마다 당신이 가장 크게 쓴 대본을 흉내내 되돌린다'],
    guard:  ['💡 조명',   '조명 담당이 살아 있으면 무대감독이 받는 피해가 40% 로 줄어든다'],
    censor: ['✂️ 검열',   '3턴마다 릴에서 가장 많은 배역을 2턴 봉인한다'],
    seize:  ['📜 압수',   '4턴마다 내 대본 하나를 이 전투 동안 압수한다 (최대 2장)'],
    phase:  ['🎭 2막',    'HP 절반에서 2막 — 공격 1.4배, 관객 둘을 부르고 9턴 시계가 돌아간다'],
    doom:   ['🔔 막 내림', '시계가 0이 되면 막이 내려간다 — 관객을 퇴장시키면 시계가 +2']
  };

  var INTENT_KO = {
    attack: '공격', doubleStrike: '2연타', defend: '방어', buff: '강화',
    healAll: '전체 회복', attackBleed: '공격+출혈', attackBurn: '공격+화상', absorb: '방어 흡수'
  };

  // ── 조합표 조회 ───────────────────────────────────────────

  function isWild(id) { return !!(CARDS[id] && CARDS[id].wild); }

  // 보석은 어떤 카드로도 취급된다 — 와일드를 실제 카드로 치환한 후보들을 만든다
  function wildVariants(line) {
    var wilds = line.filter(isWild).length;
    if (!wilds) return [line];
    var real = Object.keys(CARDS).filter(function (k) { return !CARDS[k].wild; });
    var out = [];
    function rec(cur, i) {
      if (i >= line.length) { out.push(cur.slice()); return; }
      if (!isWild(line[i])) { cur.push(line[i]); rec(cur, i + 1); cur.pop(); return; }
      // 와일드는 이미 줄에 있는 카드로 치환하는 것이 항상 유리하다 (조합 완성)
      var pool = line.filter(function (x) { return !isWild(x); });
      if (!pool.length) pool = real.slice(0, 8);
      pool.forEach(function (p) { cur.push(p); rec(cur, i + 1); cur.pop(); });
    }
    rec([], 0);
    return out;
  }

  // 이번 3장으로 만들 수 있는 대본 후보 — 1종 / 2종 / 3종
  function scriptOptions(line) {
    var out = [], seen = {};
    function push(o) {
      var k = o.tier + '|' + o.name;
      if (seen[k]) return;
      seen[k] = 1; out.push(o);
    }
    wildVariants(line).forEach(function (L) {
      // 1종 — 줄에 있는 카드마다
      L.forEach(function (id) {
        var s = S1[id];
        if (s) push({ tier: 'one', name: s[0], effect: s[1], cost: COST.one, uses: [id] });
      });
      // 2종 — 세 쌍
      [[0, 1], [0, 2], [1, 2]].forEach(function (p) {
        var a = L[p[0]], b = L[p[1]];
        var s = S2MAP[[a, b].sort().join('|')];
        if (s) push({ tier: 'two', name: s.name, effect: s.effect, cost: COST.two, uses: [a, b] });
      });
      // 3종 — 명명된 것만
      var s3 = S3MAP[L.slice().sort().join('|')];
      if (s3) push({ tier: 'three', name: s3.name, effect: s3.effect, cost: COST.three, uses: L.slice() });
      // 계열 — 세 장이 같은 계열
      var f = CARDS[L[0]] && CARDS[L[0]].fam;
      if (f && f !== 'wild' && L.every(function (x) { return CARDS[x] && CARDS[x].fam === f; })) {
        var sf = SFAM[f];
        if (sf) push({ tier: 'fam', name: sf[0], effect: sf[1], cost: COST.fam, fam: f, uses: L.slice() });
      }
    });
    // 아무 명명 조합도 없으면 세 장 효과를 합친 「즉흥」
    if (!out.some(function (o) { return o.tier !== 'one'; })) {
      var e = {};
      line.forEach(function (id) {
        var d = CARDS[id] || {};
        ['dmg', 'block', 'heal', 'burn', 'poison', 'slow', 'thorns', 'gold', 'selfDmg'].forEach(function (k) {
          if (d[k]) e[k] = (e[k] || 0) + d[k];
        });
        if (d.aoe) e.aoe = true;
        if (d.pierce) e.pierce = true;
        if (d.hits) e.hits = Math.max(e.hits || 1, d.hits);
      });
      push({ tier: 'free', name: '즉흥', cost: COST.free, uses: line.slice(),
             effect: { damage: e.dmg || 0, aoe: e.aoe, pierce: e.pierce, hits: e.hits,
                       block: e.block, heal: e.heal, burn: e.burn, poison: e.poison,
                       slow: e.slow, thorns: e.thorns, gold: e.gold, selfDamage: e.selfDmg } });
    }
    var order = { three: 0, fam: 1, two: 2, one: 3, free: 4 };
    out.sort(function (a, b) { return order[a.tier] - order[b.tier] || b.cost - a.cost; });
    return out;
  }

  var TIER_KO = { one: '1종', two: '2종', three: '3종', fam: '계열', free: '즉흥' };

  // ── 대본 카탈로그 ─────────────────────────────────────────
  // 대본은 상점·보상으로 얻어 런 전체를 따라온다. 슬롯이 만드는 게 아니다.
  // 코스트 = 무대 장악력. 배역이 몇 명 필요한지가 그대로 코스트다.
  function allScripts() {
    var out = [];
    Object.keys(S1).forEach(function (id) {
      out.push({ id: 's1_' + id, tier: 'one', name: S1[id][0], effect: S1[id][1],
                 cost: COST.one, requires: [id] });
    });
    S2.forEach(function (r) {
      out.push({ id: 's2_' + r[0] + '_' + r[1], tier: 'two', name: r[2], effect: r[3],
                 cost: COST.two, requires: [r[0], r[1]] });
    });
    S3.forEach(function (r) {
      out.push({ id: 's3_' + r[0] + '_' + r[1] + '_' + r[2], tier: 'three', name: r[3], effect: r[4],
                 cost: COST.three, requires: [r[0], r[1], r[2]] });
    });
    Object.keys(SFAM).forEach(function (f) {
      out.push({ id: 'sf_' + f, tier: 'fam', name: SFAM[f][0], effect: SFAM[f][1],
                 cost: COST.fam, fam: f, requiresFam: f });
    });
    return out;
  }
  var SCRIPTS = allScripts();
  var SCRIPT_BY_ID = {};
  SCRIPTS.forEach(function (s) { SCRIPT_BY_ID[s.id] = s; });

  // 무대(페이라인 3장)가 이 대본의 요구를 채우는가.
  // 보석은 어떤 배역으로도 대신한다. relaxed 는 요구 하나를 면제한다(「대역 배우」 유물).
  // 보석은 대본마다 배역 하나만 대신한다. 무제한이면 보석 덱이 모든 대본을 상연해
  // 「무대를 읽는다」가 사라진다 — 어릿광대가 97% 를 찍은 원인이었다.
  function canStage(sc, stage, relaxed) {
    var pool = stage.slice(), wild = 0;
    pool = pool.filter(function (id) { if (isWild(id)) { wild++; return false; } return true; });
    wild = Math.min(wild, 1);
    if (sc.requiresFam) {
      var n = pool.filter(function (id) { return (CARDS[id] || {}).fam === sc.requiresFam; }).length + wild;
      return n + (relaxed || 0) >= 3;
    }
    var need = sc.requires.slice(), miss = 0;
    need.forEach(function (id) {
      var i = pool.indexOf(id);
      if (i >= 0) pool.splice(i, 1);
      else if (wild > 0) wild--;
      else miss++;
    });
    return miss <= (relaxed || 0);
  }

  function reqText(sc) {
    if (sc.requiresFam) return FAM_KO[sc.requiresFam] + ' ×3';
    return sc.requires.map(function (id) { return (CARDS[id] || {}).icon || id; }).join(' ');
  }

  // ── 유물 ──────────────────────────────────────────────────
  // 새 구조에 맞춰 다시 짰다. 규칙을 바꾸는 것 위주다.
  var RELICS = {
    respin:   { name: '무대 반복 장치', icon: '🔄', cost: 16,
                desc: '턴마다 10% 확률로 무대를 다시 올린다 (중첩 가능)' },
    drumOpen: { name: '개막 북',        icon: '🥁', cost: 24,
                desc: '최대 코스트 +1' },
    stand_in: { name: '대역 배우',      icon: '🎭', cost: 22,
                desc: '대본의 요구 배역 하나를 무시한다' },
    archive:  { name: '대본 창고',      icon: '📚', cost: 14,
                desc: '대본 보유 상한 +3' },
    glass:    { name: '감독의 돋보기',  icon: '🔍', cost: 18,
                desc: '릴에 4장 이상인 카드의 개별 효과 +2' },
    embers:   { name: '불씨 상자',      icon: '🧯', cost: 15,
                desc: '악상 대본의 화상 +2' },
    thorns:   { name: '가시 의상',      icon: '🪡', cost: 12,
                desc: '반사 상한 +8' },
    mirrorR:  { name: '무대 거울',      icon: '🪞', cost: 20,
                desc: '초과 방어 전환율 2배' },
    improv:   { name: '즉흥의 재능',    icon: '✨', cost: 17,
                desc: '즉석 대본의 코스트 −1' },
    encore:   { name: '앙코르 종',      icon: '🔔', cost: 26,
                desc: '3종 대본을 상연하면 코스트 1을 돌려받는다' },
    candleR:  { name: '영혼의 촛불',    icon: '🕯️', cost: 20,
                desc: '적이 퇴장할 때 최대 HP +2 (영구)' },
    phoenix:  { name: '불사조의 깃펜',  icon: '🪶', cost: 30,
                desc: '쓰러져도 HP 30%로 한 번 부활' },
    // 환호 상한을 늘리면 기립 박수는 늦게 오지만 「달아오른 무대」 구간이 길어진다.
    // 터뜨릴 것인가 유지할 것인가 — 그 저울을 바꾸는 유물들이다.
    bigHouse: { name: '큰 극장',        icon: '🏛', cost: 22,
                desc: '환호 상한 +40 — 오래 달아오른다' },
    quickBow: { name: '빠른 인사',      icon: '💫', cost: 20,
                desc: '환호 상한 −25 — 기립 박수가 자주 온다' },

    // ── 어둠 유물 — 이득과 불이득을 함께 준다 ────────────────
    // 승천 단계로 열린다. 승천이 「더 아픈 같은 게임」이 아니라 「새 물건」을 줘야
    // 올라갈 이유가 된다. 도달률이 0.49단에 머문 이유의 절반이 이것이었다.
    hotHouse: { name: '달아오른 객석',  icon: '🔥', cost: 26, dark: true, asc: 2,
                desc: '「달아오른 무대」 배율 2배 · 기립 박수가 오지 않는다' },
    darkScript: { name: '검은 각본',    icon: '📕', cost: 22, dark: true, asc: 1,
                desc: '최대 코스트 +1 · 매 턴 HP −2' },
    crackMirror:{ name: '깨진 거울',    icon: '🔨', cost: 20, dark: true, asc: 1,
                desc: '반사 상한 +12 · 방어 상한 −20%' },
    hungrySeat: { name: '굶주린 관객석', icon: '🪑', cost: 24, dark: true, asc: 2,
                desc: '골드 2배 · 전투 시작 시 HP −5' },
    tornScript: { name: '찢어진 대본',   icon: '📄', cost: 26, dark: true, asc: 2,
                desc: '대본 보유 +4 · 즉석 대본이 나오지 않는다' },
    madBaton:   { name: '광인의 지휘봉', icon: '🪄', cost: 28, dark: true, asc: 3,
                desc: '화상·독·둔화 2배 · 회복 효과 절반' },
    lastActor:  { name: '마지막 배우',   icon: '🕴', cost: 30, dark: true, asc: 4,
                desc: '기립 박수가 코스트 +4 · 최대 HP −20%' },
    // 승천 5단 이상에 아무것도 없어서 올라갈 이유가 끊겼다 — 2단 이상 도달이 20% 였다
    emptyHouse: { name: '텅 빈 객석',   icon: '🕳', cost: 26, dark: true, asc: 5,
                desc: '야유가 오지 않는다 · 환호도 쌓이지 않는다' },
    doubleCast: { name: '더블 캐스팅',  icon: '👥', cost: 32, dark: true, asc: 6,
                desc: '매 턴 무대를 두 번 올린다 (좋은 쪽 자동 선택) · 최대 코스트 −1' },
    finalCurtain:{ name: '마지막 막',   icon: '🎦', cost: 34, dark: true, asc: 8,
                desc: '모든 대본의 피해 +35% · 12턴을 넘기면 즉시 패배' }
  };

  // ── 효과 적용 ─────────────────────────────────────────────
  function blank() {
    return { dmg: 0, aoe: 0, block: 0, heal: 0, slow: 0, gold: 0,
             selfDmg: 0, thorns: 0, burn: 0, poison: 0, pierce: 0 };
  }

  function scriptEffect(sc, ch) {
    var e = sc.effect || {}, r = blank(), mul = 1, hits = e.hits || 1;
    ch = ch || {};
    // 계열 대본이든, 재료가 한 계열로 모인 대본이든 같게 취급한다.
    // sc.famOf 를 보고 있었는데 그 값은 어디에서도 설정되지 않았다.
    var f = sc.fam || null;
    var cf = scriptFam(sc);
    if (cf && ch.famDmgMul && ch.famDmgMul[cf]) mul *= ch.famDmgMul[cf];
    var aoe = e.aoe || (cf && ch.aoeFams && ch.aoeFams.indexOf(cf) >= 0);
    mul *= CFG.dmgMul;
    if (e.damage) { if (aoe) r.aoe += e.damage * hits * mul; else r.dmg += e.damage * hits * mul; }
    if (e.block) r.block += e.block * mul;
    if (e.heal) r.heal += e.heal * mul;
    if (e.thorns) r.thorns += e.thorns * mul;
    // 다타 대본은 화상·독을 타격 횟수에 비례해 얹는다 — 다타 빌드가 상태이상 엔진이 된다.
    // 배율을 그대로 hits 로 두면 「서커스」(딜5×8) 하나가 판을 끝냈다. 0.6 으로 눌렀다.
    // 「어릿광대」는 감쇠 없이 타격 수만큼 얹는다 — 다타가 그 캐릭터의 전부다
    var hd = ch.hitsDotFull ? 1 : AMP.hitsToDot;
    var stMul = hits > 1 ? Math.max(1, Math.ceil(hits * hd)) : 1;
    if (e.burn) r.burn += e.burn * stMul;
    if (e.poison) r.poison += e.poison * stMul;
    if (e.slow) r.slow += e.slow;
    if (e.gold) r.gold += e.gold;
    if (e.selfDamage) r.selfDmg += e.selfDamage;
    if (e.pierce) r.pierce = 1;
    return r;
  }

  // 대본의 주 계열 — 재료 카드의 계열이 하나로 모이면 그것
  // 대본의 주 계열 — 재료 카드의 계열이 하나로 모이면 그것.
  // uses 만 보고 있었는데 보유 대본은 requires 를 쓴다. 그래서 계열 판정이 항상 null 이었고,
  // 「불씨 상자」는 한 번도 발동하지 않았고 광란의 감독의 광역 전환은 계열 대본 하나에만 걸렸다.
  function scriptFam(sc) {
    if (sc.fam) return sc.fam;
    var src = (sc.uses && sc.uses.length) ? sc.uses : (sc.requires || []);
    var fs = src.map(function (id) { return (CARDS[id] || {}).fam; })
      .filter(function (f) { return f && f !== 'wild'; });
    if (!fs.length) return null;
    return fs.every(function (f) { return f === fs[0]; }) ? fs[0] : null;
  }

  function effText(e) {
    var p = [];
    if (e.damage) p.push('딜 ' + e.damage + (e.hits > 1 ? '×' + e.hits : '') + (e.aoe ? ' 광역' : ''));
    if (e.pierce) p.push('관통');
    if (e.block) p.push('방어 ' + e.block);
    if (e.heal) p.push('회복 ' + e.heal);
    if (e.thorns) p.push('반사 ' + e.thorns);
    if (e.burn) p.push('화상 ' + e.burn);
    if (e.poison) p.push('독 ' + e.poison);
    if (e.slow) p.push('둔화 ' + e.slow);
    if (e.gold) p.push('골드 ' + e.gold);
    if (e.selfDamage) p.push('자해 ' + e.selfDamage);
    return p.join(' · ') || '—';
  }

  function cardText(d) {
    var p = [];
    if (d.dmg) p.push('딜 ' + d.dmg + (d.hits > 1 ? '×' + d.hits : '') + (d.aoe ? ' 광역' : ''));
    if (d.pierce) p.push('관통');
    if (d.block) p.push('방어 ' + d.block);
    if (d.heal) p.push('회복 ' + d.heal);
    if (d.thorns) p.push('반사 ' + d.thorns);
    if (d.burn) p.push('화상 ' + d.burn);
    if (d.poison) p.push('독 ' + d.poison);
    if (d.slow) p.push('둔화 ' + d.slow);
    if (d.gold) p.push('골드 ' + d.gold);
    if (d.selfDmg) p.push('자해 ' + d.selfDmg);
    if (d.wild) p.push('와일드');
    return p.join(' · ') || '—';
  }

  // ── 릴 ────────────────────────────────────────────────────
  function buildStrip(deck, rnd) {
    var pool = [];
    Object.keys(deck).forEach(function (k) { for (var i = 0; i < deck[k]; i++) pool.push(k); });
    if (rnd) for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool;
  }

  // ── 적 ────────────────────────────────────────────────────
  function makeEnemy(base, hpMul, atkMul) {
    var e = Object.assign({}, base, {
      hp: Math.round(base.hp * hpMul), maxHp: Math.round(base.hp * hpMul),
      atk: Math.round(base.atk * atkMul), def: base.def || 0,
      t: base.cd, block: 0, burn: 0, poison: 0, doomMax: base.doom || 0,
      intents: base.intents || [['attack', 1]],
      defVal: 8, buffVal: 4, healVal: 8, dotVal: 3
    });
    e.intents.forEach(function (t) {
      if (t[0] === 'defend') e.defVal = t[2] || e.defVal;
      if (t[0] === 'buff') e.buffVal = t[2] || e.buffVal;
      if (t[0] === 'healAll') e.healVal = t[2] || e.healVal;
      if (t[0] === 'attackBleed' || t[0] === 'attackBurn') e.dotVal = t[2] || e.dotVal;
    });
    return e;
  }

  // 적의 다음 대사를 사람 말과 숫자로 — 미리 보여주려면 값이 필요하다.
  // 「2턴 후 · 공격 24」로는 방어 판단이 자동이 된다. 무엇이 오는지 알아야 퍼즐이 된다.
  function intentInfo(f, it) {
    if (it === 'defend')  return { ko: '방어',      n: f.defVal,  kind: 'def' };
    if (it === 'buff')    return { ko: '강화',      n: f.buffVal, kind: 'buff' };
    if (it === 'healAll') return { ko: '전체 회복', n: f.healVal, kind: 'heal' };
    if (it === 'absorb')  return { ko: '방어 흡수', n: 0,         kind: 'absorb' };
    var n = f.atk * (it === 'doubleStrike' ? 2 : 1);
    if (it === 'attackBleed' || it === 'attackBurn') n += f.dotVal;
    return { ko: INTENT_KO[it] || '공격', n: Math.round(n), kind: 'atk' };
  }

  function pickIntent(e, rnd) {
    var tot = e.intents.reduce(function (a, t) { return a + (t[1] || 1); }, 0), r = rnd() * tot;
    for (var i = 0; i < e.intents.length; i++) { r -= (e.intents[i][1] || 1); if (r <= 0) return e.intents[i][0]; }
    return 'attack';
  }

  // ── 증폭 — 상태이상이 피해를 곱한다 ────────────────────────
  // 이 층이 없으면 모든 대본이 독립된 덧셈이라 "조합을 찾았다" 가 없다.
  // 그리고 곱셈이 있으면 순서 결정이 생긴다 — 먼저 둔화를 걸고 큰 것을 쓴다.
  // 증폭 배율이 상태이상 빌드에만 과하게 몰렸다 — 증폭턴이 악장 69% · 광란 41% ·
  // 나머지 1~15% 였고, 승률 1·2위가 그 둘이었다. 층 자체를 눌렀다.
  var AMP = {
    slowPer: 0.10, slowCap: 0.45,  // 둔화 1스택당 받는 피해 +10%, 최대 +45%
    burnAoe: 1.75,                 // 화상이 걸린 적에게 광역 피해 1.75배
    poisonLock: 10,                // 독이 10 이상이면 감소하지 않는다
    // 방어력이 피해를 0 으로 만들면 그 적은 특정 빌드에 「무적」이 된다.
    // 철갑 인형(방어력 20 · 도트 면역) 앞에서 악장의 광역 5~11 이 전부 0 이 되어
    // 60턴 교착으로 죽었다. 방어력이 아무리 높아도 20% 는 들어간다.
    minPierce: 0.2,
    thornsToAoe: 0.3,              // 반사 보유 중이면 방어량의 30% 가 광역 피해로
    hitsToDot: 0.6,                // 다타 대본의 화상·독 = 기본값 × ceil(타수 × 0.6)
    // 반사는 방어력의 절반만 적용받는다. 전액 적용이면 철갑(방어력 20) 하나가
    // 반사 빌드를 0 으로 만들었다 — 3막 적 5종 중 2종이 한 캐릭터를 원천 봉인했다.
    thornsDefPart: 0.5
  };

  // 둔화는 쿨타임을 밀고, 동시에 받는 피해를 늘린다
  function applySlow(e, n) {
    if (!n) return;
    e.t += n;
    e.slowN = (e.slowN || 0) + n;
  }

  function ampMul(e, opt) {
    var mul = 1;
    if (e.slowN) mul += Math.min(AMP.slowCap, AMP.slowPer * e.slowN);
    if (opt.aoe && e.burn > 0) mul *= AMP.burnAoe;
    return mul;
  }

  // 피해 계산: 증폭 → 방어력(flat) → 방어(block) → HP
  function damageEnemy(e, amount, opt) {
    opt = opt || {};
    if (amount <= 0) return 0;
    // 회피는 타격마다 판정한다. 한 번에 판정하면 5타 대본이 통째로 빗나가서
    // 「유령 배우」(요구: 광역·다타) 앞에서 다타 빌드가 오히려 더 약했다.
    if (opt.single && e.evadeSingle && opt.rnd) {
      var h = Math.max(1, opt.hits || 1), landed = 0;
      for (var i = 0; i < h; i++) if (opt.rnd() >= e.evadeSingle) landed++;
      if (!landed) return 0;
      amount = amount * landed / h;
    }
    amount = amount * ampMul(e, opt);
    if (!opt.pierce) amount = Math.max(amount * AMP.minPierce, amount - e.def);
    if (e.block > 0) { var ab = Math.min(e.block, amount); e.block -= ab; amount -= ab; }
    e.hp -= amount;
    return amount;
  }

  // 지속 피해 정산 — 독은 임계를 넘기면 잠긴다(감소하지 않는다)
  function tickDots(e) {
    var out = 0;
    if (e.burn) { e.hp -= e.burn; out += e.burn; e.burn--; }
    if (e.poison) {
      e.hp -= e.poison; out += e.poison;
      if (e.poison < AMP.poisonLock) e.poison--;
    }
    if (e.slowN) e.slowN--;
    return out;
  }

  // 증폭 관계를 사람 말로 — UI 에 그대로 띄운다
  var AMP_TEXT = [
    ['🐌 둔화', '둔화 1스택당 그 적이 받는 피해 +12% (최대 +60%)'],
    ['🔥 화상', '화상이 걸린 적에게 광역 피해 2배'],
    ['🩸 독',   '독이 8 이상이면 더 이상 감소하지 않는다'],
    ['🪞 반사', '반사를 보유 중이면 방어량의 30%가 광역 피해로 나간다'],
    ['🎭 다타', '다타 대본은 화상·독을 타격 횟수에 비례해 적용한다 (×0.6)']
  ];

  // 가중 뽑기 — 중복 없이 n 개. 보상·상점 진열에 쓴다.
  function pickWeighted(arr, wfn, rnd, n) {
    var a = arr.slice(), out = [];
    while (out.length < n && a.length) {
      var tot = 0, w = a.map(function (x) { var v = Math.max(0.0001, wfn(x)); tot += v; return v; });
      var r = rnd() * tot, i = 0;
      for (; i < a.length; i++) { r -= w[i]; if (r <= 0) break; }
      if (i >= a.length) i = a.length - 1;
      out.push(a.splice(i, 1)[0]);
    }
    return out;
  }

  function rng32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  root.Theater = {
    CARDS: CARDS, FAMS: FAMS, FAM_KO: FAM_KO,
    S1: S1, S2: S2, S3: S3, SFAM: SFAM, COST: COST, TIER_KO: TIER_KO,
    CHARS: CHARS, ENEMIES: ENEMIES, DIFFICULTY: DIFFICULTY, CFG: CFG, INTENT_KO: INTENT_KO,
    WIN_KO: WIN_KO, scriptWeight: scriptWeight, pickWeighted: pickWeighted,
    GIMMICK_TEXT: GIMMICK_TEXT, INTRUDERS: INTRUDERS, intrudeChance: intrudeChance,
    GROWTH: GROWTH,
    CHEER: CHEER, CHEER_TEXT: CHEER_TEXT, DEMANDS: DEMANDS, DEMAND_CHEER: DEMAND_CHEER,
    ASCENSION: ASCENSION, BOSS_LEARN: BOSS_LEARN, ascend: ascend,
    PREMIERE: PREMIERE, premiereAt: premiereAt, ARCHIVE_MUL: ARCHIVE_MUL, VAULT_BASE: VAULT_BASE,
    EVENTS: EVENTS,
    makeOpeners: makeOpeners, scriptOptions: scriptOptions,
    SCRIPTS: SCRIPTS, SCRIPT_BY_ID: SCRIPT_BY_ID, allScripts: allScripts,
    canStage: canStage, reqText: reqText, RELICS: RELICS,
    AMP: AMP, AMP_TEXT: AMP_TEXT, applySlow: applySlow, ampMul: ampMul, tickDots: tickDots, scriptEffect: scriptEffect, scriptFam: scriptFam,
    effText: effText, cardText: cardText, blank: blank, isWild: isWild,
    buildStrip: buildStrip, makeEnemy: makeEnemy, pickIntent: pickIntent,
    damageEnemy: damageEnemy, rng32: rng32, intentInfo: intentInfo
  };
})(typeof window !== 'undefined' ? window : global);
