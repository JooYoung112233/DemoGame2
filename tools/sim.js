// ── UNSCRIPTED · UNDERSTUDY · UNCAST — 플레이어 시뮬레이터 ───────
//
// 확률 모델이 아니다. play.html 과 같은 규칙으로 실제 한 판을 끝까지 둔다.
//   맵 선택 → 전투(턴 계획 탐색) → 보상 선택 → 상점 → ... → 보스
//
// 「플레이어」는 정책(POLICIES)이다. 정책마다 무엇을 가치로 보는지가 다르고,
// 그 차이가 덱·대본·경로 선택을 갈라놓는다. 봇은 매 턴 손패와 코스트로
// 가능한 상연 순서를 실제로 탐색해서 고른다 — 증폭을 먼저 걸지 나중에 걸지가
// 탐색 결과로 갈린다.
(function (root) {
  'use strict';
  var T = root.Theater;

  // ── 무대(빌드) 시제품 ─────────────────────────────────────
  // 아직 확정 규칙이 아니다. 「조건이 실제로 채워지는가」를 재려고 붙였다.
  // opt.stages 로만 켜진다 — 기존 밸런스 측정은 건드리지 않는다.
  //
  // 계열(배역·악상·소품)이 아니라 카드로 조건을 건다. 계열은 시작 릴이 이미
  // 정해버려서(악장 100% 악상, 거울의 배우 89% 소품) 조건이 아니라 라벨이 된다.
  var STAGES = {
    // 반사만 보면 해당 대본이 10종뿐이라 대본 진행도가 0.35/3 에서 멈춘다.
    // 깨진 거울 조각은 꿰뚫는다 — 관통까지 세면 15종으로 가면·다타와 같은 대역이 된다.
    mirror: { name: '거울의 무대', icon: '🪞',
              // 릴 후보가 두 장뿐이면 4장을 못 채운다 — 쇠약을 세 장으로 넓히자 0%→4% 였다.
              reel: ['mirror', 'mask', 'chain'], relic: ['thorns', 'mirrorR', 'crackMirror'],
              script: function (e) { return !!e.thorns || !!e.pierce; },
              // 반사는 「맞아야 나가는 피해」라 내가 조절할 수 없다 — 거울의 배우는
              // 화력의 89% 가 반사이고 턴당 대본 피해가 2.5(어릿광대 85.5)다.
              // 완성하면 쌓아둔 반사가 스스로 나간다. 수동이 능동이 된다.
              gain: '매 턴 시작 시 쌓인 반사의 절반을 적 전체에게 쏜다' },
    burn:   { name: '화형의 무대', icon: '🔥',
              reel: ['rage', 'candle'], relic: ['embers', 'madBaton'],
              script: function (e) { return !!e.burn; },
              gain: '화상이 매 턴 인접한 적에게 절반씩 번진다' },
    king:   { name: '왕정의 무대', icon: '👑',
              reel: ['king', 'crown'], relic: ['drumOpen', 'darkScript', 'encore'],
              script: function (e, sc) { var r = sc.requires || [];
                return r.indexOf('king') >= 0 || r.indexOf('crown') >= 0; },
              gain: '왕·왕관을 요구하는 대본의 코스트 −1' },
    mask:   { name: '가면의 무대', icon: '🎭',
              reel: ['jester', 'acrobat'], relic: ['stand_in', 'glass'],
              script: function (e) { return (e.hits || 1) >= 2; },
              gain: '다타의 타격마다 증폭이 따로 적용된다' },
    curtain:{ name: '막의 무대',   icon: '🎪',
              reel: ['curtain', 'rose', 'shield'], relic: ['longBow', 'encoreCall'],
              // 방어+둔화 두 조건을 다 요구하니 해당 대본이 97종 중 3종뿐이라
              // 480판 동안 한 번도 열리지 않았다. 방어만 본다.
              script: function (e) { return !!e.block; },
              gain: '커튼콜 칸 +1' },
    // 독 대본이 97종 중 7종뿐이라, 기울기를 816층분 받고도 대본이 0.30/3 에서 멈췄다.
    // 독과 둔화를 하나로 묶으면 23종이 되고, 정체성도 선명해진다 —
    // 화형은 태우고 쇠약은 굳힌다.
    poison: { name: '쇠약의 무대', icon: '🩸',
              reel: ['violin', 'tragedy', 'cold'], relic: ['venom', 'glass', 'madBaton'],
              script: function (e) { return !!e.poison || !!e.slow; },
              gain: '화상·독·둔화가 매 턴 1씩 깊어진다' }
  };
  // 에픽 무대 — 물건이 아니라 「그렇게 플레이했다」가 조건이다.
  // 일반 무대는 효과를 축으로, 에픽은 시스템을 축으로 삼는다.
  var EPIC = {
    encore: { name: '앙코르의 무대', icon: '🎪',
              relic: ['longBow', 'encoreCall'], relicN: 2,
              // 상위 10% 지점(15회)으로 잡았더니 중앙 31층에 열렸다 — 다섯 층 쓰고 끝난다.
              // 누적 지표는 판이 진행돼야 쌓이므로 구조적으로 늦다. 상위 25% 로 내린다.
              // 상위 10% 지점으로 다시 잡았다. 52.1 에서 잡을 때는 13 이 상위 25% 였는데
              // 유품·무대·조용한 기울기가 붙으면서 상위 30% 로 헐거워졌다.
              need: { curtainPlays: 22, chainMax: 4 },
              gain: '커튼콜이 매 턴 온다' },
    frenzy: { name: '광란의 객석', icon: '👏',
              // 재연 0 의 환호 유물은 「큰 극장」(+40) 과 「빠른 인사」(−25) 뿐이라
              // 서로 정반대다. 2개를 요구하면 상충하는 유물을 둘 다 사게 만든다.
              relic: ['bigHouse', 'quickBow', 'hotHouse', 'emptyHouse'], relicN: 1,
              need: { ovations: 17, hotWins: 7 },
              gain: '「달아오른 무대」가 꺼지지 않는다' }
  };
  function epicProg(S, key) {
    var e = EPIC[key], st = S.stats, need = epicNeedAt(S, key);
    // 에픽은 재연에서만 열린다(69장). 본편은 「끝내는 것」, 재연은 「올라가는 것」.
    if (!(S.asc && S.asc.level > 0)) return { relic: 0, done: false, p: 0, have: [] };
    var relic = S.relics.filter(function (k) { return e.relic.indexOf(k) >= 0; }).length;
    var parts = [Math.min(1, relic / e.relicN)], done = relic >= e.relicN;
    // 「아는 카드」 조건은 뺐다 — 3판이면 포화돼서 관문 노릇을 못 하고,
    // 재연 단수로 바꾸면 목표가 아니라 타이머가 된다.
    // 에픽은 「그 시스템으로 판을 짰다」는 증명이어야 한다(52장).
    Object.keys(need).forEach(function (k) {
      var have = st[k] || 0;
      parts.push(Math.min(1, have / need[k]));
      if (have < need[k]) done = false;
    });
    return { relic: relic, done: done,
             p: parts.reduce(function (a, b) { return a + b; }, 0) / parts.length,
             have: Object.keys(e.need).map(function (k) { return st[k] || 0; }) };
  }

  var EPIC_AT = 0.15;             // 에픽 기울기 발동선
  var STAGE_NEED = { reel: 4, relic: 1, script: 2 };
  // 재연은 숙련의 증명이다 — 오를수록 무대 조건이 한 칸씩 풀린다.
  //
  // 실측(재연 고정 240판씩): 5단부터 무대 완성이 23% → 17% 로 꺾인다. 원인은
  // 어둠 유물의 슬롯 잠식이 아니다(3단에서 0.39 로 포화되고 그 뒤 안 늘어난다).
  // 판이 짧아지는 것이다 — 8단 평균 도달 15.4층인데 무대는 중앙 15층에 열린다.
  // 평균적인 판이 무대가 열리기 직전에 끝난다. 재연이 「저거 해보고 싶다」의
  // 사다리인데 오를수록 무대가 멀어지면 방향이 반대다.
  var STAGE_RELIEF = 3;           // 몇 단마다 조건이 한 칸 풀리나
  var EPIC_RELIEF = 0.12;         // 에픽 누적 조건이 한 칸마다 몇 % 줄어드나
  function reliefOf(S) {
    return Math.floor(((S.asc && S.asc.level) || 0) / STAGE_RELIEF);
  }
  function needAt(S) {
    var n = { reel: STAGE_NEED.reel, relic: STAGE_NEED.relic, script: STAGE_NEED.script };
    // 릴과 대본을 번갈아 푼다. 유물은 건드리지 않는다 — 1 아래로는 축이 사라진다.
    for (var i = 0, r = reliefOf(S); i < r; i++) {
      if (i % 2 === 0) n.reel = Math.max(2, n.reel - 1);
      else n.script = Math.max(2, n.script - 1);
    }
    return n;
  }
  function epicNeedAt(S, key) {
    var e = EPIC[key], cut = 1 - EPIC_RELIEF * reliefOf(S), o = {};
    Object.keys(e.need).forEach(function (k) { o[k] = Math.max(2, Math.round(e.need[k] * cut)); });
    return o;
  }
  var TILT_AT = 0.25;             // 이만큼 차면 상점·보상이 그 무대 쪽으로 기운다
  // 기울기가 매번 확정으로 자리를 채우면 무대가 9층에 완성된다.
  // 확률로 채워야 「모아가는 시간」이 생긴다.
  var TILT_P = { card: 1, relic: 1, script: 1 };
  function stageTune(o) {
    if (o.need) STAGE_NEED = o.need;
    if (o.tiltAt != null) TILT_AT = o.tiltAt;
    if (o.keep != null) TILT_KEEP = o.keep;
    if (o.w != null) TILT_W = o.w;
    if (o.epicAt != null) EPIC_AT = o.epicAt;
    if (o.relief != null) STAGE_RELIEF = o.relief;
    if (o.p) TILT_P = o.p;
  }
  // 무대를 노리는 사람은 릴 카드를 대본보다 우선한다. 봇이 그러지 않아서
  // 유물 1/1 · 대본 2/2 를 채우고도 릴이 0.3/3 에서 멈췄다.
  var TILT_W = 1;

  // 릴 진행도는 「지금 몇 장인가」가 아니라 「이 판에 몇 장을 넣었는가」다.
  // 시작 릴로 세면 거울의 배우는 거울 8장을 갖고 시작해서 거울의 무대가 92% 열리고,
  // 연출가는 아무 축도 없어서 0% 다 — 무대가 캐릭터 라벨이 되어버린다.
  function stageProg(S, key) {
    var st = STAGES[key], reel = 0;
    st.reel.forEach(function (id) {
      reel += Math.max(0, (S.deck[id] || 0) - ((S.deck0 || {})[id] || 0));
    });
    var relic = S.relics.filter(function (k) { return st.relic.indexOf(k) >= 0; }).length;
    // 대본도 릴과 같게 「이 판에 얻은 것」만 센다. 시작 대본으로 세면
    // 연출가는 시작 대본 셋 중 둘이 방어 대본이라 1층에 막의 무대로 잠긴다 —
    // 릴을 뗐더니 시작 대본이 똑같이 무대를 정해버렸다.
    var script = S.scripts.filter(function (sc) {
      return !(S.script0 || {})[sc.id] && st.script(sc.effect || {}, sc);
    }).length;
    var need = needAt(S);
    var p = 0.4 * Math.min(1, reel / need.reel)
          + 0.3 * Math.min(1, relic / need.relic)
          + 0.3 * Math.min(1, script / need.script);
    return { reel: reel, relic: relic, script: script, p: p,
             done: reel >= need.reel && relic >= need.relic && script >= need.script };
  }
  // 완성된 무대 — 규칙이 실제로 바뀌는 지점(51.2 「부분은 수치, 완성은 규칙」)
  function stageOn(S, key) {
    if (!S.useStages) return false;
    if (S.stageDoneCache && S.stageDoneCache[key] != null) return S.stageDoneCache[key];
    var d = stageProg(S, key).done;
    (S.stageDoneCache = S.stageDoneCache || {})[key] = d;
    return d;
  }
  // 기울기가 향한 무대 — 가장 많이 찬 것 하나. 플레이어가 선포하지 않는다.
  //
  // 관성이 있다. 매번 1등을 다시 뽑으면, 두 무대가 엇비슷한 캐릭터는 층마다
  // 기울기가 왔다 갔다 하면서 양쪽을 절반씩만 채우고 끝난다 — 연출가가 0% 였다.
  var TILT_KEEP = 0.12;           // 이만큼 앞서야 갈아탄다
  function tiltAt(S) {
    if (!S.useStages) return null;
    var cur = S.tiltKey, curP = -1;
    if (cur) { var cg = stageProg(S, cur); if (cg.done) cur = null; else curP = cg.p; }
    var best = cur, bv = cur ? curP + TILT_KEEP : TILT_AT;
    Object.keys(STAGES).forEach(function (k) {
      if (k === cur) return;
      var g = stageProg(S, k);
      if (g.done) return;                       // 이미 완성됐으면 더 기울 필요가 없다
      if (g.p > bv) { bv = g.p; best = k; }
    });
    if (best && curP < 0 && stageProg(S, best).p < TILT_AT) best = null;
    S.tiltKey = best;
    return best;
  }

  // ── 플레이어 성향 ─────────────────────────────────────────
  // w      : 전투 중 가치 판단 가중치
  // route  : 맵 노드 선호
  // grab   : 보상에서 배역/대본 중 무엇에 기우는지 (1 이면 중립)
  // thin   : 릴을 좁히려는 성향 (각색실·상점 제거를 쓴다)
  var POLICIES = {
    burst: { name: '화력형', desc: '큰 한 방. 방어는 최소한만',
      w: { dmg: 1.15, aoe: 1.0, block: 0.30, heal: 0.45, status: 0.55, thorns: 0.2 },
      route: { elite: 1.35, shop: 1.05, rest: 0.75, forge: 0.85, fight: 1 }, grab: { script: 1.15 }, thin: 0.4 },
    setup: { name: '셋업형', desc: '먼저 둔화·화상을 걸고 그다음 터뜨린다',
      w: { dmg: 0.92, aoe: 1.05, block: 0.5, heal: 0.55, status: 1.85, thorns: 0.4 },
      route: { elite: 1.1, shop: 1.15, rest: 0.9, forge: 1.0, fight: 1 }, grab: { script: 1.25 }, thin: 0.5 },
    turtle: { name: '수비형', desc: '버티고 반사로 갚는다',
      w: { dmg: 0.7, aoe: 0.9, block: 1.35, heal: 1.0, status: 0.8, thorns: 1.5 },
      route: { elite: 0.8, shop: 1.0, rest: 1.3, forge: 0.9, fight: 1.1 }, grab: { script: 1.0 }, thin: 0.4 },
    focus: { name: '집중형', desc: '릴을 좁혀 원하는 조합 확률을 올린다',
      w: { dmg: 1.0, aoe: 1.0, block: 0.6, heal: 0.6, status: 1.0, thorns: 0.6 },
      route: { elite: 1.0, shop: 1.35, rest: 0.9, forge: 1.6, fight: 1 }, grab: { card: 1.2 }, thin: 1.6 },
    collector: { name: '수집형', desc: '대본을 많이 모아 상황마다 답을 낸다',
      w: { dmg: 1.0, aoe: 1.0, block: 0.7, heal: 0.7, status: 1.1, thorns: 0.7 },
      route: { elite: 1.4, shop: 1.2, rest: 0.85, forge: 0.6, fight: 1 }, grab: { script: 1.6 }, thin: 0.2 },
    value: { name: '효율형', desc: '코스트당 값이 큰 것만 쓴다',
      w: { dmg: 1.05, aoe: 1.1, block: 0.75, heal: 0.8, status: 1.2, thorns: 0.7 },
      route: { elite: 1.0, shop: 1.1, rest: 1.0, forge: 1.1, fight: 1 }, grab: { script: 1.0 }, thin: 0.8 }
  };

  // ── 숙련도 ────────────────────────────────────────────────
  // 로그라이크의 첫 클리어는 어려워야 한다. 그러니 「봇 승률」과 「사람 승률」을 섞어 보면 안 된다.
  //   depth/width : 몇 수까지 내다보는가 (탐색 깊이)
  //   err         : 최선이 아닌 계획을 고르는 확률 (손이 미끄러지고 못 보고 지나간다)
  //   setup       : 상태이상을 먼저 거는 것의 값을 얼마나 아는가
  //   useReroll   : 재굴림을 쓸 줄 아는가
  //   rewardNoise : 보상 평가가 얼마나 흔들리는가
  //   shopSmart   : 상점에서 계획대로 사는가, 눈에 띄는 걸 사는가
  var SKILLS = {
    // 계획을 아예 안 하는 사람. 눈에 보이는 큰 것을 그냥 낸다 —
    // 1수만 보고, 셋업의 값을 모르고, 재굴림을 거의 쓰지 않는다.
    // 이 등급이 없으면 「가장 낮은 사람」도 2수를 봐서 초보를 과대평가한다.
    naive:  { name: '무작정', depth: 1, width: 1, err: 0.5, setup: 0.12, useReroll: 0.04,
              rewardNoise: 0.85, shopSmart: 0.15, driftRate: 0.3 },
    rookie: { name: '처음', depth: 2, width: 2, err: 0.34, setup: 0.35, useReroll: 0.25,
              rewardNoise: 0.6, shopSmart: 0.35, driftRate: 0.22 },
    mid:    { name: '익숙', depth: 3, width: 4, err: 0.14, setup: 0.75, useReroll: 0.7,
              rewardNoise: 0.28, shopSmart: 0.75, driftRate: 0.16 },
    expert: { name: '숙련', depth: 5, width: 7, err: 0.02, setup: 1.0, useReroll: 1.0,
              rewardNoise: 0.06, shopSmart: 1.0, driftRate: 0.1 }
  };

  // 숙련도는 3단이 아니라 연속이다 — 반복 플레이를 재려면 그 사이 값이 필요하다.
  // t=0 처음 · t=0.5 익숙 · t=1 숙련
  var SK_KEYS = ['depth', 'width', 'err', 'setup', 'useReroll', 'rewardNoise', 'shopSmart', 'driftRate'];
  // 출발점은 「무작정」이다 — 첫 판을 두는 사람은 계획을 세우지 않는다.
  // 이전에는 곡선이 「처음」(2수)에서 시작해서 가장 낮은 사람도 예측을 했다.
  var SK_CURVE = [[0, 'naive'], [0.28, 'rookie'], [0.62, 'mid'], [1, 'expert']];
  function skillMix(t) {
    t = Math.max(0, Math.min(1, t));
    var i = 0;
    while (i < SK_CURVE.length - 2 && t > SK_CURVE[i + 1][0]) i++;
    var a = SK_CURVE[i], b = SK_CURVE[i + 1];
    var lo = SKILLS[a[1]], hi = SKILLS[b[1]], u = (t - a[0]) / (b[0] - a[0]);
    var o = { name: '숙련 ' + Math.round(t * 100), t: t };
    SK_KEYS.forEach(function (k) { o[k] = lo[k] + (hi[k] - lo[k]) * u; });
    o.depth = Math.max(1, Math.round(o.depth));
    o.width = Math.max(1, Math.round(o.width));
    return o;
  }

  // 캐릭터 승리 조건이 정책 가중치를 한 번 더 민다 — 같은 성향이라도 캐릭터마다 다르게 큰다
  var WIN_BIAS = {
    burst:   { dmg: 1.15 },
    sweep:   { aoe: 1.5, status: 1.15 },
    reflect: { block: 1.4, thorns: 2.0 },
    status:  { status: 1.6 },
    hits:    { status: 1.3, aoe: 1.1 },
    cheer:   { dmg: 1.1, heal: 1.2 }
  };

  function mergeW(pol, ch) {
    var w = Object.assign({}, pol.w), b = WIN_BIAS[ch.win] || {};
    Object.keys(b).forEach(function (k) { w[k] = (w[k] || 1) * b[k]; });
    return w;
  }

  // 한 사람을 만든다 — 성향과 숙련도가 같아도 개인 편차로 서로 다른 사람이 된다.
  // 성향 6종만 두면 표본이 6개다. 여기서 100명은 실제로 100명이 된다.
  function makePlayer(pol, ch, sk, rnd) {
    var w = mergeW(pol, ch);
    Object.keys(w).forEach(function (k) { w[k] *= 0.72 + rnd() * 0.56; });   // ±28% 개인 편차
    w.status *= sk.setup;
    return w;
  }

  // 런 중 표류 — 손에 들어온 것이 사람의 방향을 바꾼다.
  // 반사 대본이 두 장 들어오면 계획에 없어도 반사로 기울고, 그게 실제 플레이다.
  function drift(S) {
    var inc = { dmg: 0, aoe: 0, block: 0, status: 0, thorns: 0, heal: 0 };
    S.scripts.forEach(function (sc) {
      var e = T.scriptEffect(sc, S.ch);
      inc.dmg += e.dmg; inc.aoe += e.aoe * 1.4; inc.block += e.block;
      inc.status += (e.burn + e.poison + e.slow * 2) * 3;
      inc.thorns += e.thorns * 2; inc.heal += e.heal;
    });
    var keys = Object.keys(inc), tot = 0;
    keys.forEach(function (k) { tot += inc[k]; });
    if (tot <= 0) return;
    var r = S.sk.driftRate;
    keys.forEach(function (k) {
      if (S.w[k] == null) return;
      var share = inc[k] / tot * keys.length;                 // 평균 1 로 정규화
      S.w[k] = S.w[k] * (1 - r) + S.w[k] * share * r;
    });
  }

  // ── 무대 조건 확률 ────────────────────────────────────────
  // 릴 구성으로 이 대본이 상연 가능해질 확률. 4칸을 독립 추출로 본다.
  // 정확히 DP 로 센다 — 보석(와일드)이 부족한 요구를 메운다.
  var probCache = {};
  function stageProb(sc, deck) {
    var sig = sc.id + '#' + Object.keys(deck).sort().map(function (k) { return k + deck[k]; }).join(',');
    if (probCache[sig] != null) return probCache[sig];
    var total = 0;
    Object.keys(deck).forEach(function (k) { total += deck[k]; });
    if (!total) return probCache[sig] = 0;
    var pw = (deck.gem || 0) / total;

    var p;
    if (sc.requiresFam) {
      var pf = 0;
      Object.keys(deck).forEach(function (k) {
        if ((T.CARDS[k] || {}).fam === sc.requiresFam) pf += deck[k] / total;
      });
      // 계열 3장 — 4칸 중 3칸 이상이 그 계열(보석 포함)
      var q = pf + pw, out = 0;
      for (var i = 3; i <= 4; i++) out += comb(4, i) * Math.pow(q, i) * Math.pow(1 - q, 4 - i);
      p = out;
    } else {
      var need = {}, ids = [];
      sc.requires.forEach(function (id) { if (!need[id]) { need[id] = 0; ids.push(id); } need[id]++; });
      var ps = ids.map(function (id) { return (deck[id] || 0) / total; });
      var ns = ids.map(function (id) { return need[id]; });
      p = dpFill(ps, ns, pw, 4);
    }
    return probCache[sig] = p;
  }
  function comb(n, k) { var r = 1; for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; }

  // 4번 추출해서 각 요구를 채울 확률 — 남는 보석은 부족분을 메운다
  function dpFill(ps, ns, pw, draws) {
    var k = ps.length, po = 1 - pw; ps.forEach(function (x) { po -= x; }); if (po < 0) po = 0;
    var states = {};
    states[key(new Array(k).fill(0), 0)] = 1;
    for (var d = 0; d < draws; d++) {
      var nx = {};
      Object.keys(states).forEach(function (s) {
        var pr = states[s], st = unkey(s, k);
        var add = function (cnt, wild, w) {
          if (w <= 0) return;
          var kk = key(cnt, wild); nx[kk] = (nx[kk] || 0) + pr * w;
        };
        for (var i = 0; i < k; i++) {
          var c = st.cnt.slice();
          if (c[i] < ns[i]) c[i]++;
          add(c, st.wild, ps[i]);
        }
        add(st.cnt.slice(), Math.min(draws, st.wild + 1), pw);
        add(st.cnt.slice(), st.wild, po);
      });
      states = nx;
    }
    var ok = 0;
    Object.keys(states).forEach(function (s) {
      var st = unkey(s, k), miss = 0;
      for (var i = 0; i < k; i++) miss += ns[i] - st.cnt[i];
      if (miss <= Math.min(1, st.wild)) ok += states[s];   // 보석은 대본마다 하나만 대신한다
    });
    return ok;
  }
  function key(cnt, wild) { return cnt.join('.') + '/' + wild; }
  function unkey(s, k) {
    var p = s.split('/'), c = p[0].split('.').map(Number);
    return { cnt: c, wild: +p[1] };
  }

  // ── 상태 복제 ─────────────────────────────────────────────
  function cloneFoe(f) {
    return { name: f.name, hp: f.hp, maxHp: f.maxHp, atk: f.atk, def: f.def, cd: f.cd, t: f.t,
      block: f.block, burn: f.burn, poison: f.poison, slowN: f.slowN || 0,
      dotImmune: f.dotImmune, evadeSingle: f.evadeSingle, defGrow: f.defGrow, defMax: f.defMax,
      doom: f.doom, doomMax: f.doomMax, curse: f.curse, boss: f.boss, next: f.next,
      role: f.role, guardMul: f.guardMul, gimmick: f.gimmick, gimCd: f.gimCd, gimT: f.gimT,
      seizeCd: f.seizeCd, seizeMax: f.seizeMax, seizeT: f.seizeT,
      phaseAt: f.phaseAt, phased: f.phased, phaseDoom: f.phaseDoom, clock: f.clock,
      phaseAtkMul: f.phaseAtkMul, phaseDef: f.phaseDef, adds2: f.adds2,
      clockPerAdd: f.clockPerAdd, clockPaid: f.clockPaid,
      intents: f.intents, defVal: f.defVal, buffVal: f.buffVal, healVal: f.healVal, dotVal: f.dotVal };
  }
  function snapCombat(S) {
    return { hp: S.hp, maxHp: S.maxHp, block: S.block, thorns: S.thorns, cost: S.cost, gold: S.gold,
      foes: S.foes.map(cloneFoe), tempN: S.temp.length, dead: false,
      cheer: S.cheer || 0, lastPlay: S.lastPlay, repeatN: S.repeatN || 0, maxPlay: S.maxPlay || 0, bleed: S.bleed || 0,
      demand: S.demand, tHits: S.tHits || 0, tPlays: S.tPlays || 0, tBlock: S.tBlock || 0,
      tHeal: S.tHeal || 0, tSelf: S.tSelf || 0, fThorns: S.fThorns || 0,
      usedF: Object.assign({}, S.usedF || {}) };
  }

  // ── 코스트 ────────────────────────────────────────────────
  // 캐릭터가 코스트를 바꿀 수 있으니 한 곳에서만 계산한다.
  // 「악장」은 악상이 아닌 대본에 +1 을 낸다 — 전문화의 대가다.
  function costOf(ch, sc, S) {
    if (S && stageOn(S, 'king')) {
      var rq = sc.requires || [];
      if (rq.indexOf('king') >= 0 || rq.indexOf('crown') >= 0) return Math.max(1, costOf0(ch, sc) - 1);
    }
    return costOf0(ch, sc);
  }
  function costOf0(ch, sc) {
    var c = sc.cost;
    if (ch && ch.offFamCost && ch.mainFam) {
      var f = T.scriptFam(sc);
      if (f !== ch.mainFam) c += ch.offFamCost;
    }
    return Math.max(1, c);
  }

  // ── 상연 1회를 상태에 적용 ────────────────────────────────
  // play.html 의 apply() 와 같은 순서다. 계획 탐색과 실제 진행이 같은 코드를 쓴다.
  function applyPlay(C, sc, tgt, ctx) {
    var acc = T.scriptEffect(sc, ctx.ch), ev = [];
    // 🪄 부서진 지휘봉 — 이번 턴 모든 대본이 광역이 된다
    if (ctx.propAoe && acc.dmg && !acc.aoe) { acc.aoe = acc.dmg; acc.dmg = 0; }

    if (ctx.embers && T.scriptFam(sc) === 'score' && acc.burn) acc.burn += 2 * ctx.embers;
    // 「독이 든 성배」 — 계열을 가리지 않는다. 독 대본이 7종뿐이라 계열까지 걸면 닿지 않는다.
    if (ctx.venom && acc.poison) acc.poison += 2 * ctx.venom;
    // 「악장」 — 주 계열 대본의 상태이상이 한 칸 더 깊어진다
    if (ctx.ch.famStatusPlus) {
      var sf = T.scriptFam(sc), plus = sf ? (ctx.ch.famStatusPlus[sf] || 0) : 0;
      if (plus) {
        if (acc.burn) acc.burn += plus;
        if (acc.poison) acc.poison += plus;
        if (acc.slow) acc.slow += plus;
      }
    }
    if (ctx.actBurn && acc.burn) acc.burn += ctx.actBurn;   // 사건 「불타는 대본」
    // 연출가 — 무대에 같은 배역이 2장 서 있고 그 배역을 쓰는 대본이면 피해가 늘어난다
    if (ctx.ch.pairBonus && ctx.S && ctx.S.stage && !sc.requiresFam) {
      var cnt = {};
      ctx.S.stage.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; });
      if ((sc.requires || []).some(function (id) { return cnt[id] >= 2; })) {
        var pb = 1 + ctx.ch.pairBonus;
        acc.dmg *= pb; acc.aoe *= pb;
        ev.push('🎬 겹쳐 세웠다 — 피해 ×' + pb.toFixed(2));
      }
    }

    C.cost -= costOf(ctx.ch, sc);
    if (sc.tier === 'three' && ctx.encore) C.cost += 1;
    if (sc.curtain && ctx.encoreCall) C.cost += 1;

    // 어둠 유물 — 상태이상 2배 / 회복 절반
    if (ctx.statusMul > 1) { acc.burn *= ctx.statusMul; acc.poison *= ctx.statusMul; acc.slow *= ctx.statusMul; }
    if (ctx.healMul != null && ctx.healMul !== 1) acc.heal *= ctx.healMul;
    // 커튼콜 연속 — 같은 대본으로 계속 막을 닫으면 그 대본이 커진다.
    if (ctx.chain > 0 && sc.id === ctx.chainId) {
      var cm = 1 + ctx.chainPer * ctx.chain;
      acc.dmg *= cm; acc.aoe *= cm;
      ev.push('🎭 연속 ' + ctx.chain + '회 — 피해 ×' + cm.toFixed(2));
    }

    // 달아오른 무대 — 환호가 높게 유지되면 모든 대본이 강해진다.
    // 그래서 기립 박수로 터뜨리는 것이 손해일 수도 있다. 그게 결정이다.
    var cb = 0;
    T.CHEER.boost.forEach(function (b) { if ((C.cheer || 0) >= b[0]) cb = b[1] * (ctx.boostMul || 1); });
    if (cb > 0) { acc.dmg *= (1 + cb); acc.aoe *= (1 + cb); }

    // 「관객의 총아」 — 환호가 그대로 곱셈이 된다. 무대를 데우고 나서 큰 것을 낸다.
    if (ctx.ch.cheerDmgPer) {
      var cm = 1 + Math.min(ctx.ch.cheerDmgCap || 0.7,
        Math.floor((C.cheer || 0) / 10) * ctx.ch.cheerDmgPer);
      if (cm > 1) {
        acc.dmg *= cm; acc.aoe *= cm;
        ev.push('🙌 환호 ' + Math.round(C.cheer) + ' — 피해 ×' + cm.toFixed(2));
      }
    }
    // 어둠 유물 「마지막 막」
    if (ctx.finalCurtain) { acc.dmg *= 1.35; acc.aoe *= 1.35; }

    C.block += acc.block;
    var cap = C.maxHp * ((ctx.blockCapPct != null ? ctx.blockCapPct : T.CFG.blockCapPct) / 100);
    if (C.block > cap) {
      var over = C.block - cap; C.block = cap;
      var conv = over * (T.CFG.overflowConv / 100) * ctx.overflowMul;
      acc.dmg += conv;
      if (conv > 0.5) ev.push('초과 방어 ' + Math.round(over) + ' → 피해 ' + Math.round(conv));
    }
    if (C.thorns > 0 && acc.block > 0) {
      var refl = acc.block * T.AMP.thornsToAoe;
      acc.aoe += refl;
      ev.push('🪞 반사 전환 — 방어 ' + Math.round(acc.block) + ' → 광역 ' + Math.round(refl));
    }
    // 타락한 감독 — 태운 피가 그대로 화력이 된다
    if (ctx.ch.selfToDmg && acc.selfDmg > 0) {
      // 🩸 피 묻은 대본 — 이번 턴 전환율이 두 배다 (리스크 없음)
      var burn2 = acc.selfDmg * ctx.ch.selfToDmg * (ctx.propBlood ? 2 : 1);
      if (acc.aoe > 0) acc.aoe += burn2; else acc.dmg += burn2;
      ev.push('🩸 태운 피 ' + Math.round(acc.selfDmg) + ' → 피해 +' + Math.round(burn2));
    }
    C.thorns = Math.min(ctx.thornCap, C.thorns + acc.thorns * (ctx.ch.thornsMul || 1));
    C.hp = Math.min(C.maxHp, C.hp + acc.heal) - (ctx.ch.ignoreSelfDmg ? 0 : acc.selfDmg);
    // 「타락한 감독」 — 자해로는 쓰러지지 않는다. 위험은 남는다: 피가 낮으면 적이 끝낸다.
    if (ctx.ch.selfFloor && acc.selfDmg > 0 && C.hp < 1) C.hp = 1;
    if (acc.gold) C.gold += acc.gold;
    if (C.hp <= 0) { C.dead = true; return ev; }

    var alive = C.foes.filter(function (f) { return f.hp > 0; });
    if (!alive.length) return ev;
    var t0 = (tgt >= 0 ? C.foes[tgt] : null);
    if (!t0 || t0.hp <= 0) t0 = alive[0];
    // 동반자가 살아 있으면 본체가 거의 안 깎인다 — 순서를 강제한다
    var guarded = alive.some(function (f) { return f.role === 'guard'; });
    var gm = function (f) { return (guarded && f.guardMul && f.role !== 'guard') ? f.guardMul : 1; };

    // 「어릿광대」 — 다타가 방어력을 벗긴다. 여러 번 찔러 틈을 만든다.
    var hits0 = (sc.effect && sc.effect.hits) || 1;
    if (ctx.ch.hitsShred && hits0 > 1) {
      var shred = hits0 * ctx.ch.hitsShred;
      var targets = (acc.aoe > 0) ? alive : [t0];
      var did = 0;
      targets.forEach(function (f) {
        if (f.def <= 0) return;
        var cut = Math.min(f.def, shred); f.def -= cut; did = Math.max(did, cut);
      });
      if (did > 0) ev.push('🎭 ' + hits0 + '타 — 방어력 −' + did);
    }

    // 「어릿광대」 — 적이 퇴장하면 남은 타격이 다음 적에게 넘어간다.
    // 다타는 단일 대상에 묶여 있어서 적 3~4마리 앞에서 광역 빌드에 밀렸다.
    if (acc.dmg > 0 && ctx.ch.hitSpill && hits0 > 1 && alive.length > 1) {
      var per = acc.dmg * gm(t0) / hits0, left = alive.slice(), cur = t0, tot0 = 0, ampS = T.ampMul(t0, {});
      for (var hi2 = 0; hi2 < hits0; hi2++) {
        if (cur.hp <= 0) {
          left = left.filter(function (f) { return f.hp > 0; });
          if (!left.length) break;
          cur = left[0];
        }
        tot0 += T.damageEnemy(cur, per, { single: true, pierce: acc.pierce, rnd: ctx.rnd, hits: 1 });
      }
      ev.push('🎭 ' + hits0 + '타 분산 — 합계 ' + Math.round(tot0));
      if (ampS > 1) C.ampHit = 1;
      C.maxPlay = Math.max(C.maxPlay || 0, acc.dmg);
      acc.dmg = 0;
    }
    if (acc.dmg > 0) {
      var amp = T.ampMul(t0, {});
      var d = T.damageEnemy(t0, acc.dmg * gm(t0),
        { single: true, pierce: acc.pierce, rnd: ctx.rnd, hits: hits0 });
      ev.push(t0.name + ' 에 ' + Math.round(acc.dmg)
        + (amp > 1 ? ' ×' + amp.toFixed(2) + ' 증폭' : '') + (gm(t0) < 1 ? ' ×조명 보호' : '')
        + ' → 실제 ' + Math.round(d) + (d === 0 ? ' (막혔다)' : ''));
      if (amp > 1) C.ampHit = 1;
      C.maxPlay = Math.max(C.maxPlay || 0, acc.dmg);      // 「재연」이 흉내낼 최대 대본
    }
    // 광역 전문 캐릭터는 적이 하나로 줄면 광역이 그 하나에 몰린다
    if (acc.aoe > 0 && ctx.ch.soloAoeMul && alive.length === 1) acc.aoe *= ctx.ch.soloAoeMul;
    if (acc.aoe > 0) {
      var tot = 0, ampd = 0;
      alive.forEach(function (f) {
        if (T.ampMul(f, { aoe: true }) > 1) ampd = 1;
        tot += T.damageEnemy(f, acc.aoe * gm(f), { aoe: true, pierce: acc.pierce });
      });
      ev.push('광역 ' + Math.round(acc.aoe) + (ampd ? ' (증폭)' : '') + ' → 합계 ' + Math.round(tot));
      if (ampd) C.ampHit = 1;
    }
    if (acc.burn) alive.forEach(function (f) { if (!f.dotImmune) f.burn += acc.burn; });
    if (acc.poison) alive.forEach(function (f) { if (!f.dotImmune) f.poison += acc.poison; });
    if (acc.slow) alive.forEach(function (f) { T.applySlow(f, acc.slow); });
    if (acc.burn || acc.poison || acc.slow) {
      ev.push('상태 — ' + [acc.burn ? '화상 +' + acc.burn : '', acc.poison ? '독 +' + acc.poison : '',
        acc.slow ? '둔화 +' + acc.slow : ''].filter(Boolean).join(' · '));
    }
    C.lastId = sc.id;                        // 이 대본이 막을 닫으면 커튼콜에 오른다
    var kills = alive.length - C.foes.filter(function (f) { return f.hp > 0; }).length;

    // 이번 턴 누적 — 관객의 요구를 판정하는 데 쓴다
    C.tHits = (C.tHits || 0) + (acc.dmg > 0 || acc.aoe > 0 ? hits0 : 0);
    C.tPlays = (C.tPlays || 0) + 1;
    C.tBlock = (C.tBlock || 0) + acc.block;
    C.tHeal = (C.tHeal || 0) + acc.heal;
    C.tSelf = (C.tSelf || 0) + acc.selfDmg;
    checkDemand(C, ctx, {
      sc: sc, hits: hits0, kills: kills, target: t0,
      dmg: acc.dmg, aoe: acc.aoe, aoeHit: acc.aoe > 0 ? alive.length : 0
    });
    // 처형에 성공하면 태운 피가 즉시 절반 돌아온다 — 자해를 「죽이는 데」 쓰게 만든다.
    // 실패해도 다음 턴에 돌아온다(bleedBack) — 그래야 계속 태울 수 있다.
    if (acc.selfDmg > 0 && ctx.ch.selfRefund) {
      if (kills > 0) {
        var back = Math.round(acc.selfDmg * ctx.ch.selfRefund);
        C.hp = Math.min(C.maxHp, C.hp + back);
        ev.push('🩸 처형 — 태운 피 ' + back + ' 회수');
      } else if (ctx.ch.bleedBack) {
        C.bleed = (C.bleed || 0) + acc.selfDmg * ctx.ch.bleedBack;
      }
    }
    if (!ctx.noCheer) {
      var need = Math.max(30, ctx.cheerNeed ? Math.min(ctx.cheerNeed, ctx.cheerCap) : ctx.cheerCap);
      if (ctx.noOvation) need = 1e9;   // 「달아오른 객석」 — 박수는 오지 않고 열기만 남는다
      cheerFor(C, sc, kills, ev, need, ctx.ovation, ctx.repeatMul, ctx.ch.freshBonus || 0, ctx.cheerCap);
    }
    return ev;
  }

  // ── 관중 ─────────────────────────────────────────────────
  // 크게 가면 환호가 오르고, 같은 대본을 반복하면 식는다.
  // 계획 탐색과 실제 진행이 같은 함수를 쓴다 — 그래서 봇이 환호를 계산에 넣는다.
  // ── 관객의 요구 ──────────────────────────────────────────
  // 판정을 applyPlay 안에 두는 이유 — 계획 탐색도 같은 함수를 쓰므로
  // 봇이 「이 대본을 내면 요구가 채워진다」를 계산에 넣게 된다.
  function demandMet(C, d, f) {
    if (!d) return false;
    switch (d.id) {
      case 'burst':  return f.target && f.dmg >= f.target.maxHp * 0.30;
      case 'kill':   return f.kills > 0;
      case 'hits':   return (C.tHits || 0) >= 5;
      case 'aoe':    return f.aoeHit >= 3;
      case 'burn':   return C.foes.some(function (x) { return x.hp > 0 && x.burn >= 8; });
      case 'slow':   return C.foes.some(function (x) { return x.hp > 0 && (x.slowN || 0) >= 5; });
      case 'block':  return (C.tBlock || 0) >= 25;
      case 'thorns': return (C.fThorns || 0) >= 20;
      case 'big':    return f.sc.tier === 'three' || f.sc.tier === 'fam';
      case 'many':   return (C.tPlays || 0) >= 4;
      case 'self':   return (C.tSelf || 0) >= 15;
      case 'heal':   return (C.tHeal || 0) >= 20;
    }
    return false;
  }

  function checkDemand(C, ctx, f) {
    var d = C.demand;
    if (!d || !demandMet(C, d, f)) return;
    C.cheer = (C.cheer || 0) + T.DEMAND_CHEER;
    C.demandDone = (C.demandDone || 0) + 1;
    C.demand = nextDemand(C, ctx);          // 달성하면 즉시 다음 요구가 온다
  }

  // 캐릭터 승리 조건 쪽으로 기울이되 고정하지는 않는다 —
  // 못 하는 요구가 가끔 오는 것이 「포기한다」는 판단을 만든다
  function nextDemand(C, ctx) {
    var cur = C.demand ? C.demand.id : null;
    var pool = T.DEMANDS.filter(function (x) { return x.id !== cur; });
    return T.pickWeighted(pool, function (x) {
      return x.win && ctx.ch.win === x.win ? 1.5 : 1;
    }, ctx.rnd, 1)[0];
  }

  function cheerFor(C, sc, kills, ev, cap, ova, repMul, fresh, hardCap) {
    var CH = T.CHEER, d = 0;
    cap = cap || CH.max;
    // 「관객의 총아」 — 이번 전투에서 처음 올리는 대본마다 환호가 오른다.
    // 반복 감점 2배와 짝을 이뤄 「매 턴 다른 것」을 강제한다.
    if (fresh) {
      if (!C.usedF) C.usedF = {};
      if (!C.usedF[sc.id]) { C.usedF[sc.id] = 1; d += fresh; }
    }
    if (sc.tier === 'three' || sc.tier === 'fam') d += CH.onThree;
    if (C.ampHit) d += CH.onAmp;
    if ((sc.effect.hits || 1) >= 3) d += CH.onHits;
    if (kills > 0) d += CH.onKill * kills;
    // 반복 감점 — 「관객의 총아」는 이 감점이 두 배다. 매 턴 다른 것을 해야 한다.
    // 커튼콜은 반복 감점을 받지 않는다 — 앙코르는 반복이 아니라 요청이다
    if (sc.curtain) { /* 감점 없음 */ }
    else if (C.lastPlay === sc.id) { C.repeatN = (C.repeatN || 0) + 1; d += CH.repeat * C.repeatN * (repMul || 1); }
    else { C.lastPlay = sc.id; C.repeatN = 0; }
    C.cheer = Math.max(0, Math.min(hardCap || cap, (C.cheer || 0) + d));
    if (C.cheer >= cap) {
      var gain = ova || CH.ovation;
      C.cheer = 0; C.cost += gain; C.ovation = 1;
      C.gold += CH.ovationGold;
      if (ev) ev.push('👏 기립 박수 — 코스트 +' + gain + ' · 골드 +' + CH.ovationGold);
    }
  }

  // ── 이번 턴에 들어올 피해 추정 ────────────────────────────
  // 이번 턴에 들어올 피해 — 이제 확률 평균이 아니라 예고된 대사를 그대로 읽는다.
  // 「무엇이 오는지 안다」가 방어·둔화·표적 판단을 전부 살린다.
  function incoming(C) {
    var inc = 0;
    C.foes.forEach(function (f) {
      if (f.hp <= 0) return;
      if (f.t - 1 > 0) return;                 // 이 턴에 행동하지 않는다
      var info = T.intentInfo(f, f.next || 'attack');
      if (info.kind === 'atk') inc += info.n;
    });
    return inc;
  }

  // ── 상태 평가 ─────────────────────────────────────────────
  // 계획 탐색의 값 함수. 적을 눕히는 것을 크게 본다 —
  // 적이 퇴장하면 그 적의 남은 공격이 전부 사라진다.
  function evaluate(C, C0, w, ctx) {
    if (C.dead) return -1e6;
    var v = 0;
    C.foes.forEach(function (f, i) {
      var f0 = C0.foes[i];
      var dealt = (f0.hp - f.hp) + (f0.block - f.block) * 0.35;
      v += dealt * (f.hp <= 0 ? 1.0 : 1.0) * w.dmg;
      if (f.hp <= 0 && f0.hp > 0) v += f.atk * 2.2 + 8;         // 퇴장 보너스
      // 남은 상태이상 = 다음 턴의 곱셈
      var st = (f.burn - f0.burn) * 2.0 + (f.poison - f0.poison) * 2.4
             + ((f.slowN || 0) - (f0.slowN || 0)) * 4.2;
      if (f.hp > 0) v += st * w.status;
      if (f.hp > 0 && (f.slowN || 0) > 0) v += Math.min(0.6, 0.12 * f.slowN) * f.hp * 0.15 * w.status;
    });
    var inc = incoming(C);
    var useful = Math.min(inc, C.block);
    v += useful * w.block * 1.0;
    v += Math.max(0, C.block - inc) * w.block * 0.15;           // 남는 방어는 값이 낮다
    v += (C.hp - C0.hp) * 1.4 * (C.hp < C.maxHp * 0.45 ? 1.6 : 1.0);
    v += (C.thorns - C0.thorns) * w.thorns * 1.1;
    v += (C.gold - C0.gold) * 0.5;
    // 관중 — 환호가 오르면 기립 박수(코스트 +2)가 가까워진다. 코스트 1 ≈ 2.2 점이니
    // 환호 1 점은 대략 2.2×2/100 의 값이다. 여기에 「반복하면 식는다」가 다양성을 만든다.
    v += (C.cheer - C0.cheer) * 0.06 * (ctx.cheerW || 1);
    if (C.ovation) v += 9 * (ctx.cheerW || 1);
    // 「관객의 총아」는 환호 자체가 화력이다 — 쌓아둔 환호에도 값이 있다
    if (ctx.ch.cheerDmgPer) v += (C.cheer || 0) * 0.10;
    // 커튼콜 — 연속을 잇는 대본으로 막을 닫으면 다음 무대가 강해진다.
    // 이걸 안 넣으면 봇이 「이 대본으로 끝내려고 한 턴 기다린다」를 못 한다.
    if (ctx.chainId && !C.foes.some(function (f) { return f.hp > 0; })) {
      if (C.lastId === ctx.chainId) v += 14 + (ctx.chain || 0) * 8;
      else v -= 6;                        // 다른 대본으로 닫으면 연속이 끊긴다
    }
    v -= C.cost * 2.2;                                          // 코스트를 남기면 손해
    if (C.hp - Math.max(0, inc - C.block) <= 0) v -= 400;       // 이 턴에 죽는 계획은 버린다
    return v;
  }

  // ── 턴 계획 — 빔 탐색 ────────────────────────────────────
  function planTurn(S, ctx, cheap) {
    var C0 = snapCombat(S);
    var hand = handOf(S);
    var beam = [{ C: snapCombat(S), seq: [], sc: 0 }], best = null, pool = [];
    var sk = S.sk || SKILLS.mid;
    var DEPTH = cheap ? Math.min(3, sk.depth) : sk.depth, WIDTH = cheap ? 3 : sk.width;
    for (var depth = 0; depth < DEPTH; depth++) {
      var next = [];
      beam.forEach(function (nd) {
        hand.forEach(function (sc, hi) {
          if (costOf(ctx.ch, sc) > nd.C.cost) return;
          if (sc.temp && nd.seq.filter(function (a) { return a.hi === hi; }).length) return;
          if (!sc.curtain && !T.canStage(sc, S.stage, ctx.relax)) return;
          var eff = T.scriptEffect(sc, ctx.ch);
          var tgts = eff.dmg > 0 ? nd.C.foes.map(function (f, i) { return f.hp > 0 ? i : -9; })
                                             .filter(function (i) { return i >= 0; }) : [-1];
          if (!tgts.length) tgts = [-1];
          tgts.forEach(function (tg) {
            var C = { hp: nd.C.hp, maxHp: nd.C.maxHp, block: nd.C.block, thorns: nd.C.thorns,
                      cost: nd.C.cost, gold: nd.C.gold, foes: nd.C.foes.map(cloneFoe), dead: false,
                      cheer: nd.C.cheer, lastPlay: nd.C.lastPlay, repeatN: nd.C.repeatN,
                      maxPlay: nd.C.maxPlay, bleed: nd.C.bleed || 0, usedF: Object.assign({}, nd.C.usedF || {}),
                      demand: nd.C.demand, tHits: nd.C.tHits, tPlays: nd.C.tPlays, tBlock: nd.C.tBlock,
                      tHeal: nd.C.tHeal, tSelf: nd.C.tSelf, fThorns: nd.C.fThorns };
            applyPlay(C, sc, tg, Object.assign({}, ctx, { rnd: function () { return 0.5; } }));
            var n2 = { C: C, seq: nd.seq.concat([{ hi: hi, sc: sc, tgt: tg }]) };
            n2.sc = evaluate(C, C0, ctx.w, ctx);
            next.push(n2);
          });
        });
      });
      if (!next.length) break;
      next.sort(function (a, b) { return b.sc - a.sc; });
      if (!best || next[0].sc > best.sc) best = next[0];
      pool = pool.concat(next.slice(0, 3));
      beam = next.slice(0, WIDTH);
    }
    // 실수 — 최선이 아닌 계획을 고른다. 처음 하는 사람은 세 번에 한 번 놓친다.
    if (!cheap && best && pool.length > 1 && S.rnd() < sk.err) {
      pool.sort(function (a, b) { return b.sc - a.sc; });
      var alt = pool[1 + Math.floor(S.rnd() * Math.min(3, pool.length - 1))];
      if (alt) best = alt;
    }
    return best ? { seq: best.seq, score: best.sc } : { seq: [], score: -1e9 };
  }

  // ── 재굴림 판단 ───────────────────────────────────────────
  // 코스트 1 을 내고 릴 하나를 바꿀 값이 있는가.
  // 그 릴에 실제로 들어 있는 배역들을 전부 대입해 보고, 구성 비율로 가중 평균한
  // 「바꾼 뒤의 최선 계획 점수」를 지금 점수와 비교한다. 확률 근사가 아니라 전수 대입이다.
  function rerollGain(S, ctx, k, nowScore, freeMode) {
    var strip = S.strips[k], cnt = {}, tot = strip.length;
    strip.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; });
    var keep = S.stage[k], keepTemp = S.temp, keepCost = S.cost;
    var exp = 0;
    S.cost = keepCost - (freeMode ? 0 : 1);      // 재굴림 비용을 먼저 낸 상태로 평가한다
    Object.keys(cnt).forEach(function (id) {
      S.stage[k] = id;
      S.temp = instantScripts(S, ctx);
      exp += planTurn(S, ctx, true).score * (cnt[id] / tot);
    });
    S.stage[k] = keep; S.temp = keepTemp; S.cost = keepCost;
    return exp - nowScore;
  }

  // 무대 4장 중 손패에 가장 안 쓰이는 릴을 고른다. 사람이 하는 판단과 같다.
  function worstReel(S, ctx) {
    var hand = handOf(S), useCnt = [];
    for (var z = 0; z < S.stage.length; z++)
      useCnt.push((z === 0 && S.cast) || (z === 1 && S.cast2) ? 1e9 : 0);
    hand.forEach(function (sc) {
      var req = sc.requiresFam ? [] : (sc.requires || []);
      S.stage.forEach(function (id, k) {
        if (T.isWild(id)) { useCnt[k] += 3; return; }
        if (sc.requiresFam) { if ((T.CARDS[id] || {}).fam === sc.requiresFam) useCnt[k] += 1; return; }
        if (req.indexOf(id) >= 0) useCnt[k] += T.canStage(sc, S.stage, ctx.relax) ? 2 : 1;
      });
    });
    var bi = 0;
    for (var i = 1; i < 4; i++) if (useCnt[i] < useCnt[bi]) bi = i;
    return bi;
  }

  // ── 한 판 ─────────────────────────────────────────────────
  function run(opt) {
    var ch = T.CHARS[opt.charKey], pol = POLICIES[opt.policyKey];
    var sk = opt.skillObj || SKILLS[opt.skillKey || 'mid'];
    var diff = T.DIFFICULTY[opt.diffKey || 'normal'];
    var rnd = T.rng32((opt.seed | 0) || 1);
    var S = {
      ch: ch, pol: pol, sk: sk, diff: diff, rnd: rnd, act: 1, asc: T.ascend(opt.asc || 0),
      deck: Object.assign({}, ch.deck), gold: T.CFG.gold.start, relics: [],
      maxHp: T.CFG.hpBase + (ch.hpDelta || 0), at: null, cleared: {},
      scripts: T.makeOpeners(ch).map(function (s) {
        return T.SCRIPTS.filter(function (x) { return x.name === s.name; })[0] || s;
      }),
      log: [], trace: opt.trace ? [] : null, feat: {}, growth: {},
      stats: { nodes: 0, turns: 0, ampTurns: 0, playable: 0, playableOf: 0, temp: 0,
               costUsed: 0, costMax: 0, plays: 0, rerolls: 0, byTier: {}, byScript: {}, fights: 0,
               snap: [] }
    };
    // 대본 해금 — 써본 카드의 조합만 풀에 들어온다. opt.known 이 없으면 전부 열린 상태.
    S.known = opt.known || null;
    S.useStages = !!opt.stages;
    S.useProps = !!opt.props;
    S.prop = opt.props ? T.propOf(opt.charKey) : null;   // 유품은 그 캐릭터 것을 들고 시작한다
    S.propCharge = opt.props ? T.propCharge() : 0;       // 한 판에 쓸 수 있는 총 횟수
    S.slotMax = T.CFG.stageBase + (opt.slot4 ? 1 : 0);   // 복원 목록을 사면 applyMeta 가 덮는다
    S.tiltKey = null;
    S.hp = S.maxHp;
    S.map = makeMap(rnd);
    S.w = makePlayer(pol, ch, sk, rnd);
    var w = S.w;
    S.meta = opt.meta || null;
    applyMeta(S, w);
    // 초연 기록이 시작 릴·시작 대본을 바꾸므로 그 뒤에 찍는다
    S.deck0 = Object.assign({}, S.deck);
    S.script0 = {}; S.scripts.forEach(function (sc) { S.script0[sc.id] = 1; });

    var guard = 0;
    while (guard++ < 400) {
      var nd = chooseNode(S, pol);
      if (!nd) break;
      S.at = nd; S.cleared[nd.f + ',' + nd.c] = 1;
      var act2 = Math.min(3, Math.floor(nd.f / T.CFG.actLen) + 1);
      // 막이 오르면 배우가 자란다. CFG.hpPerAct 가 정의만 되고 적용되지 않아
      // 3막에서 HP 60 으로 공격 31 을 받고 있었다.
      while (act2 > S.act) {
        S.act++; S.maxHp += T.CFG.hpPerAct; S.hp += T.CFG.hpPerAct;
        lg(S, 's', '── 제' + S.act + '막 — 최대 HP +' + T.CFG.hpPerAct + ' ──');
      }
      S.act = act2;
      S.stats.nodes++;
      // 무대(빌드) 조건을 설계하려면 「층마다 릴·유물·대본이 어디까지 모였나」를 알아야 한다.
      // 최종 상태만 봐서는 15층에 조건이 찼는지 34층에 찼는지 구분할 수 없다.
      if (opt.snap) {
        var sp = null;
        if (S.useStages) {
          sp = {}; Object.keys(STAGES).forEach(function (k) { sp[k] = stageProg(S, k); });
          sp._tilt = tiltAt(S);
          sp._epic = {}; Object.keys(EPIC).forEach(function (k) { sp._epic[k] = epicProg(S, k); });
        }
        S.stats.snap.push({
          f: nd.f, deck: Object.assign({}, S.deck), relics: S.relics.slice(),
          scripts: S.scripts.map(function (s) { return s.id; }), stages: sp
        });
      }
      tr(S, 'node', NK[nd.type] + ' (' + (nd.f + 1) + '층)');
      if (nd.type === 'shop') { doShop(S, w); drift(S); continue; }
      if (nd.type === 'rest') { doRest(S); continue; }
      if (nd.type === 'forge') { doForge(S, w); continue; }
      if (nd.type === 'event') { doEvent(S, w); drift(S); continue; }
      var r = fight(S, w, nd);
      if (!r.won) return finish(S, false, r.killedBy);
      // 보스가 막마다 있다. 마지막 막의 보스만 런을 끝낸다 —
      // 이 구분이 없어서 1막 보스를 잡으면 판이 클리어로 종료됐다.
      if (nd.type === 'boss') S.stats.bossKills = (S.stats.bossKills || 0) + 1;
      if (nd.type === 'boss' && nd.f >= T.CFG.floors - 1) return finish(S, true, null);
      doReward(S, w, nd);
      drift(S);
    }
    return finish(S, false, '길이 끊겼다');
  }

  function finish(S, won, killedBy) {
    var st = S.stats;
    return { won: won, killedBy: killedBy, char: S.ch.name, charKey: keyOf(T.CHARS, S.ch),
      policy: S.pol.name, skill: S.sk.name, w: S.w, feat: S.feat, seenIds: S.seenIds || {}, knownCards: S.knownCards || {},
      floor: S.at ? S.at.f + 1 : 0, nodes: st.nodes, turns: st.turns,
      hp: Math.max(0, Math.round(S.hp)), maxHp: S.maxHp, gold: S.gold,
      deck: Object.assign({}, S.deck), scripts: S.scripts.map(function (s) { return s.name; }),
      scriptIds: S.scripts.map(function (s) { return s.id; }),
      relics: S.relics.slice(), stats: st, log: S.log, trace: S.trace };
  }
  function keyOf(o, v) { return Object.keys(o).filter(function (k) { return o[k] === v; })[0]; }

  // ── 판 사이에 남은 것을 이 판에 적용한다 ──────────────────
  // 초연 기록(시작 릴 교체 · 시작 대본) · 유물 계승 · 대본 서고.
  // 이게 「다음 판을 할 이유」다.
  function applyMeta(S, w) {
    var m = S.meta;
    if (!m) return;
    var p = T.restored(m.owned || []);
    S.premiere = p;
    // 슬롯 4칸은 복원 목록에서 산다. 사기 전에는 3칸으로 판을 돈다.
    S.slotMax = T.CFG.stageBase + (p.slot ? 1 : 0);

    // 시작 릴 교체 — 가장 값이 낮은 칸을 이 캐릭터 풀의 가장 값 높은 배역으로 바꾼다
    for (var i = 0; i < p.swap; i++) {
      var worst = null, wv = 1e9;
      Object.keys(S.deck).forEach(function (id) {
        var v = cardValueDrop(S, w, id);
        if (v < wv) { wv = v; worst = id; }
      });
      var best = null, bv = -1e9;
      (S.ch.pool || Object.keys(T.CARDS)).forEach(function (id) {
        if (T.CARDS[id].hidden) return;
        var v = cardValue(S, w, id);
        if (v > bv) { bv = v; best = id; }
      });
      if (!worst || !best || best === worst) break;
      S.deck[worst]--; if (!S.deck[worst]) delete S.deck[worst];
      S.deck[best] = (S.deck[best] || 0) + 1;
      lg(S, 'e', '  📓 초연 기록 — ' + T.CARDS[worst].name + ' → ' + T.CARDS[best].name);
    }

    // 시작 대본 — 서고에 남은 것 위주로 뽑는다
    for (var j = 0; j < p.script; j++) {
      var offer = offerScripts(S, 3), pick = null, pv = 0;
      offer.forEach(function (sc) { var v = scriptValue(S, w, sc); if (v > pv) { pv = v; pick = sc; } });
      if (pick) { S.scripts.push(pick); lg(S, 'e', '  📓 초고 — 「' + pick.name + '」 을 들고 시작한다'); }
    }

    // 유물 계승 — 창고에서 가장 값이 큰 것을 하나 들고 온다
    if ((m.vault || []).length) {
      var vb = null, vv = -1e9;
      m.vault.forEach(function (k) { var v = relicValue(S, w, k); if (v > vv) { vv = v; vb = k; } });
      if (vb) { S.relics.push(vb); lg(S, 'e', '  🏛 계승 — ' + T.RELICS[vb].name); }
    }
  }

  // ── 맵 ───────────────────────────────────────────────────
  // 칸마다 독립으로 굴리면 같은 층에 「비극 비극 비극」이 나온다. 규칙을 둔다.
  //   ① 같은 층에 특별 노드(비극·소품실·분장실·각색실·사건)가 두 개 오지 않는다.
  //      공연은 겹쳐도 된다 — 3칸 전부 다른 종류로 강제하면 공연이 구조적으로 1/3 이 상한이 된다
  //   ② 앞 층에 있던 종류는 가중치가 내려간다 — 같은 것이 연달아 오지 않는다
  //   ③ 1층은 공연, 2층은 공연이나 사건 — 시작에 벽을 두지 않는다
  //   ④ 비극은 4층부터, 분장실은 5층부터
  //   ⑤ 보스 직전 층은 언제나 분장실 — 준비할 자리를 보장한다
  //   ⑥ 한 판에 소품실·비극·사건이 최소 2개씩은 있게 뒤에서 보정한다
  // 24층에서 전투가 13.4개(56%)였다. 판 길이를 늘리는 가장 안전한 축이 전투 수다 —
  // 적을 두껍게 하지 않고도 총 턴이 늘어난다.
  var MAP_W = { fight: 66, elite: 16, shop: 11, rest: 7, forge: 5, event: 10 };
  var MAP_MIN = { shop: 1, elite: 1, event: 1 };   // 막마다 최소 1개씩 (3막이면 판당 3개)

  // 3막 × 8층 — 막마다 마지막 층이 보스, 그 앞 층은 분장실.
  // 층 게이트는 막 안쪽 위치(inAct)로 판단한다. 절대 층으로 두면 2막·3막에서
  // 모든 종류가 곧바로 열려 막의 곡선이 사라진다.
  function makeMap(rnd) {
    var F = T.CFG.floors, L = T.CFG.actLen;
    var floors = [], prev = {};
    for (var f = 0; f < F; f++) {
      var inAct = f % L, isBoss = inAct === L - 1, isPre = inAct === L - 2;
      var n = (f === 0 || isBoss || isPre) ? 1 : (rnd() < 0.45 ? 2 : 3);
      var row = [], used = {};
      for (var c = 0; c < n; c++) {
        var t;
        if (isBoss) t = 'boss';
        else if (isPre) t = 'rest';                          // ⑤ 보스 직전
        else if (inAct === 0) t = 'fight';                   // ③ 막의 첫 층
        else if (inAct === 1) {
          var k1 = ['fight', 'event', 'forge'].filter(function (k) { return k === 'fight' || !used[k]; });
          t = T.pickWeighted(k1.length ? k1 : ['fight'],
            function (k) { return k === 'fight' ? 70 : k === 'event' ? 20 : 10; }, rnd, 1)[0];
        } else {
          var keys = Object.keys(MAP_W).filter(function (k) {
            if (used[k] && k !== 'fight') return false;      // ①
            if (k === 'elite' && inAct < 2) return false;    // ④
            if (k === 'rest' && inAct < 3) return false;
            return true;
          });
          if (!keys.length) keys = ['fight'];
          t = T.pickWeighted(keys, function (k) {
            return MAP_W[k] * (prev[k] ? 0.45 : 1);          // ②
          }, rnd, 1)[0];
        }
        used[t] = 1;
        row.push({ f: f, c: c, type: t });
      }
      prev = used;
      floors.push(row);
    }
    // ⑥ 최소 개수 보정 — 막마다 소품실·비극·사건을 최소 개수만큼 보장한다
    for (var a = 0; a < F / L; a++) {
      var lo = a * L, hi = lo + L - 2;                       // 보스·직전 분장실 제외
      Object.keys(MAP_MIN).forEach(function (k) {
        var have = 0;
        for (var i = lo; i < hi; i++) floors[i].forEach(function (nd) { if (nd.type === k) have++; });
        var guard = 0;
        while (have < MAP_MIN[k] && guard++ < 40) {
          var f2 = lo + 2 + Math.floor(rnd() * (hi - lo - 2)), row2 = floors[f2];
          if (!row2 || row2.some(function (x) { return x.type === k; })) continue;
          var cand = row2.filter(function (nd) { return nd.type === 'fight'; });
          if (!cand.length) continue;
          cand[Math.floor(rnd() * cand.length)].type = k; have++;
        }
      });
    }
    return floors;
  }
  var NK = { fight: '공연', elite: '비극', shop: '소품실', rest: '분장실', forge: '각색실',
             event: '사건', boss: '주연' };

  function reachable(S, f, c) {
    if (!S.at) return f === 0;
    if (f !== S.at.f + 1) return false;
    var cur = S.map[S.at.f], nxt = S.map[f];
    var p0 = cur.length > 1 ? S.at.c / (cur.length - 1) : 0.5;
    var p1 = nxt.length > 1 ? c / (nxt.length - 1) : 0.5;
    return Math.abs(p1 - p0) <= 0.55;
  }

  function chooseNode(S, pol) {
    var f = S.at ? S.at.f + 1 : 0;
    if (f >= T.CFG.floors) return null;
    var opts = S.map[f].filter(function (nd) { return reachable(S, nd.f, nd.c); });
    if (!opts.length) return null;
    var hurt = S.hp / S.maxHp;
    var best = null, bv = -1e9;
    opts.forEach(function (nd) {
      var v = (pol.route[nd.type] || 1) * 10 + S.rnd() * 2;
      if (nd.type === 'rest') v += (1 - hurt) * 26;               // 피가 없으면 분장실
      if (nd.type === 'elite') v -= (1 - hurt) * 22;              // 피가 없으면 비극을 피한다
      if (nd.type === 'shop' && S.gold > 55) v += 8;
      if (nd.type === 'forge' && Object.keys(S.deck).some(function (k) { return S.deck[k] >= 3; })) v += 5 * pol.thin;
      if (v > bv) { bv = v; best = nd; }
    });
    return best;
  }

  // ── 전투 ─────────────────────────────────────────────────
  function pickFoes(S, nd) {
    var pool = T.ENEMIES.filter(function (e) { return e.act === S.act && !e.boss; });
    if (nd.type === 'boss') {
      var bs = T.ENEMIES.filter(function (e) { return e.act === S.act && e.boss; })[0];
      return [bs || T.ENEMIES.filter(function (e) { return e.boss; })[0]];
    }
    var base = pool[Math.floor(S.rnd() * pool.length)];
    // 비극(엘리트)은 막 보스를 다시 쓰지 않는다 — 2층에 기믹 보스가 나오면 온보딩이 끊긴다.
    // 대신 「난입이 확정된 공연」이다. 위험의 형태가 보스가 아니라 난입이다.
    if (nd.type === 'elite') {
      // 🎭 분장실 열쇠 — 에픽은 「누적」이라 구조적으로 늦다(중앙 25층). 비극을 넘기면 당겨준다.
      if (S.useStages) {
        var ek2 = epicTilt(S) || Object.keys(EPIC)[0];
        var need2 = epicNeedAt(S, ek2);
        Object.keys(need2).forEach(function (k) {
          S.stats[k] = (S.stats[k] || 0) + Math.ceil(need2[k] * 0.3);
        });
        S.stats.keys = (S.stats.keys || 0) + 1;
        lg(S, 's', '  🎭 분장실 열쇠 — ' + EPIC[ek2].icon + ' ' + EPIC[ek2].name + ' 이 가까워졌다');
      }
      var n2 = base.solo ? 1 : Math.min(2, base.maxCount || 2);
      var out2 = []; for (var j = 0; j < n2; j++) out2.push(base);
      return out2;
    }
    // 전투가 3턴에 끝나던 이유의 절반은 적이 한둘뿐이었기 때문이다.
    // 개별 적을 두껍게 하면 「벽처럼」 느껴지니 수를 늘린다 — 광역·다타에 값이 생긴다.
    var cap = Math.min(base.maxCount || 4, nd.f === 0 ? 1 : (S.act === 1 ? 3 : 4));
    var n = base.solo ? 1 : Math.max(1, cap - (S.rnd() < 0.3 ? 1 : 0));
    var out = []; for (var i = 0; i < n; i++) out.push(base);
    return out;
  }

  // 해금 관찰 — 상연 한 번마다
  function watchFeats(S, sc, aliveBefore) {
    if (!S.feat) S.feat = {};
    if (!S.seenIds) S.seenIds = {};
    S.seenIds[sc.id] = 1;                       // 대본 서고에 남는다 (가중치)
    // 써본 카드를 기억한다 — 이 카드들의 조합이 다음 판 풀에 들어온다.
    // 97종을 첫 판부터 다 만나면 조합을 배울 수가 없다.
    if (!S.knownCards) S.knownCards = {};
    (sc.requires || []).forEach(function (c) { S.knownCards[c] = 1; });
    if (sc.requiresFam) S.stage.forEach(function (id) {
      if ((T.CARDS[id] || {}).fam === sc.requiresFam) S.knownCards[id] = 1;
    });
    var eff = sc.effect || {};
    var aoe = !!eff.aoe || ((S.ch.aoeFams || []).length && T.scriptFam(sc)
              && S.ch.aoeFams.indexOf(T.scriptFam(sc)) >= 0);
    if (eff.damage) { S.fightAnyDmg = 1; if (!aoe) S.fightAoeOnly = 0; }
    if (sc.temp) { S.fightTempPlays = (S.fightTempPlays || 0) + 1;
                   if (S.fightTempPlays >= 6) S.feat.harlequin = 1; }
    if ((S.stats.ovations || 0) >= 3) S.feat.darling = 1;      // 한 판에 기립 박수 3회
    // 둔화 상한이 +45% 라 1.5 는 도달 불가였다 (해금률 0%) — 상한 아래로 내렸다
    if (S.foes.some(function (f) { return f.hp > 0 && T.ampMul(f, {}) >= 1.35; })) S.feat.maestro = 1;
  }

  // 난입 예약 — 비극은 반드시 하나, 공연은 확률. 재연이 확률과 인원을 올린다.
  function queueIntruders(S, nd) {
    if (nd.type === 'boss') return [];
    var pool = T.INTRUDERS.filter(function (x) { return !x.asc || S.asc.intrudeNew >= x.asc; });
    var q = [];
    if (nd.type === 'elite') {
      q.push({ who: pool[Math.floor(S.rnd() * pool.length)], on: 2 });
      // 2막부터 비극은 난입자가 둘이다
      if (S.act >= 2) q.push({ who: pool[Math.floor(S.rnd() * pool.length)], on: 5 });
    }
    var p = Math.min(0.85, T.intrudeChance(nd.f) * S.asc.intrudeMul);
    for (var i = q.length; i < S.asc.intrudeMax; i++) {
      if (S.rnd() >= p) break;
      q.push({ who: pool[Math.floor(S.rnd() * pool.length)], on: 3 + Math.floor(S.rnd() * 3) + i * 2 });
    }
    return q;
  }

  function relicN(S, k) { return S.relics.filter(function (r) { return r === k; }).length; }
  function ctxOf(S, w) {
    return { ch: S.ch, w: w, rnd: S.rnd, S: S, relax: relicN(S, 'stand_in'), cheerMax: S.asc.cheerMax,
      embers: relicN(S, 'embers'), venom: relicN(S, 'venom'),
      encore: relicN(S, 'encore'), encoreCall: relicN(S, 'encoreCall'), actBurn: S.actBurn || 0,
      thornCap: T.CFG.thornCap * (T.CFG.thornActMul[S.act - 1] || 1) * (S.ch.thornsMul || 1) + relicN(S, 'thorns') * 8
                + relicN(S, 'crackMirror') * 12,
      blockCapPct: T.CFG.blockCapPct * (relicN(S, 'crackMirror') ? 0.8 : 1),
      statusMul: relicN(S, 'madBaton') ? 2 : 1,
      healMul: relicN(S, 'madBaton') ? 0.5 : 1,
      ovation: T.CHEER.ovation + relicN(S, 'lastActor') * 2 + (S.ch.ovationBonus || 0),
      cheerNeed: S.ch.cheerNeed || null,
      cheerCap: (S.asc.cheerMax || T.CHEER.max) + relicN(S, 'bigHouse') * 40 - relicN(S, 'quickBow') * 25,
      chain: S.chain || 0, chainId: S.chainId || null,
      chainPer: S.ch.chainPer || T.CFG.curtain.chainPer,
      boostMul: relicN(S, 'hotHouse') ? 2 : 1,
      noOvation: relicN(S, 'hotHouse') ? 1 : 0,
      repeatMul: S.ch.repeatMul || 1,
      cheerW: S.ch.cheerW || 1,
      noCheer: relicN(S, 'emptyHouse') ? 1 : 0,
      finalCurtain: relicN(S, 'finalCurtain') ? 1 : 0,
      propAoe: S.propAoe || 0, propReflect: S.propReflect || 0, propBlood: S.propBlood || 0,
      overflowMul: (S.ch.overflowMul || 1) * (relicN(S, 'mirrorR') ? 2 : 1) };
  }
  // 완성된 무대가 매 턴 하는 일. 51.2 「완성은 규칙」이 여기서 실제로 일어난다.
  // 이 함수가 없던 동안 무대는 「조건을 채운 비율」일 뿐 게임을 바꾸지 않았다 —
  // 거울의 배우가 무대 완성 1위(55%)인데 클리어 최하위였던 이유다.
  function stageTurn(S, ctx) {
    if (!S.useStages) return;
    var live = S.foes.filter(function (e) { return e.hp > 0; });
    if (!live.length) return;
    // 🪞 쌓인 반사의 절반이 스스로 나간다 — 맞기를 기다리지 않아도 된다
    if (stageOn(S, 'mirror') && S.thorns > 0) {
      var shot = Math.round(S.thorns * 0.5);
      live.forEach(function (e) { T.damageEnemy(S, e, shot, { aoe: 1, rnd: S.rnd }); });
      S.stats.mirrorShot = (S.stats.mirrorShot || 0) + shot * live.length;
      lg(S, 'b', '  🪞 거울의 무대 — 반사 ' + shot + ' 이 쏟아진다');
    }
    // 🔥 화상이 인접한 적에게 번진다
    if (stageOn(S, 'burn')) {
      var burning = live.filter(function (e) { return (e.burn || 0) > 0; });
      burning.forEach(function (e) {
        live.forEach(function (o) { if (o !== e) o.burn = Math.max(o.burn || 0, Math.floor(e.burn / 2)); });
      });
    }
    // 🩸 상태이상이 매 턴 깊어진다
    if (stageOn(S, 'poison')) {
      live.forEach(function (e) {
        if (e.burn) e.burn++;
        if (e.poison) e.poison++;
        if (e.slow) e.slow++;
      });
    }
  }

  // ── 유품 — 전투당 한 번의 개입 ────────────────────────────
  //
  // 봇은 「좋은 턴을 만들려고 아껴둔다」를 못 한다(커튼콜과 같은 한계 · 50.4).
  // 그래서 조건이 맞는 첫 턴에 쓴다 — 사람보다 낮게 나온다는 것을 알고 재야 한다.
  function propReady(S) {
    return S.useProps && S.prop && (S.propCharge || 0) > 0;
  }
  // 이번 턴에 쓸 값어치가 있나 — 유품마다 판정이 다르다
  function tryProp(S, ctx) {
    if (!propReady(S)) return;
    var p = T.PROPS[S.prop], live = S.foes.filter(function (e) { return e.hp > 0; });
    if (!live.length) return;
    // 한 판에 세 번뿐이다. 아무 데나 쓰면 정작 필요할 때 없다.
    // 주연·비극이거나, 몰렸거나, 전투가 길어졌을 때만 꺼낸다.
    var nd = S.at || {};
    var worth = nd.type === 'boss' || nd.type === 'elite'
             || S.hp < S.maxHp * 0.5 || S.turn >= 5 || S.foes.length >= 3;
    if (!worth) return;
    var use = false;

    if (p.kind === 'slot') {
      // 한 칸만 바꾸면 상연할 수 있게 되는 대본이 있나 — 있으면 그 배역으로 바꾼다
      var hand = handOf(S), bestGain = 0, bestAt = -1, bestId = null;
      hand.forEach(function (sc) {
        if (sc.curtain || T.canStage(sc, S.stage, ctx.relax)) return;
        if (costOf(ctx.ch, sc) > S.cost) return;
        for (var i = 0; i < S.stage.length; i++) {
          var keep = S.stage[i], req = sc.requiresFam ? [] : (sc.requires || []);
          var cand = sc.requiresFam
            ? Object.keys(T.CARDS).filter(function (id) { return (T.CARDS[id] || {}).fam === sc.requiresFam; })
            : req;
          for (var c = 0; c < cand.length; c++) {
            S.stage[i] = cand[c];
            if (T.canStage(sc, S.stage, ctx.relax)) {
              var g = scriptRaw(S, S.w, sc);
              if (g > bestGain) { bestGain = g; bestAt = i; bestId = cand[c]; }
            }
          }
          S.stage[i] = keep;
        }
      });
      if (bestAt >= 0) {
        S.stage[bestAt] = bestId; use = true;
        lg(S, 'e', '  🎬 연출 노트 — 슬롯을 ' + T.CARDS[bestId].name + ' 로 바꿨다');
      }
    } else if (p.kind === 'aoe') {
      if (live.length >= 2) { S.propAoe = 1; ctx.propAoe = 1; use = true; }
    } else if (p.kind === 'reflect') {
      // e.next 는 의도 id 문자열이지 객체가 아니다. e.next.dmg 를 읽고 있어서
      // 480판 동안 한 번도 발동하지 않았다.
      var incoming = 0;
      live.forEach(function (e) {
        var info = T.intentInfo(e, e.next);
        if (info.kind === 'atk') incoming += info.n;
      });
      // 방어로 막고도 남는 피해가 최대 HP 의 12% 를 넘을 때
      // 적은 1턴에 움직이지 않는다 — 의도를 한 턴 미리 공개하기 때문이다(48장).
      // 예고를 보고 그 턴에 쓰면 정작 맞을 때는 효과가 꺼져 있다.
      if (S.turn >= 2 && incoming >= S.maxHp * 0.12) { S.propReflect = 1; ctx.propReflect = 1; use = true; }
    } else if (p.kind === 'dots') {
      var dot = live.reduce(function (a, e) { return a + (e.burn || 0) + (e.poison || 0) + (e.slow || 0); }, 0);
      if (dot >= 8) {
        live.forEach(function (e) { e.burn = (e.burn || 0) * 2; e.poison = (e.poison || 0) * 2; e.slow = (e.slow || 0) * 2; });
        use = true;
      }
    } else if (p.kind === 'blood') {
      // 자해 대본을 낼 수 있을 때만 값이 있다
      // 대본 데이터의 키는 selfDamage 다. selfDmg 로 보고 있어서 한 번도 발동하지 않았다.
      if (handOf(S).some(function (sc) { return (sc.effect || {}).selfDamage && canPlay(S, sc); })) {
        S.propBlood = 1; ctx.propBlood = 1; use = true;
      }
    } else if (p.kind === 'strip') {
      var tough = null, td = 0;
      live.forEach(function (e) { if ((e.def || 0) > td) { td = e.def; tough = e; } });
      if (tough && td >= 4) { tough.propStripped = tough.def; tough.def = 0; S.propStrip = tough; use = true; }
    } else if (p.kind === 'hold') {
      // 환호를 쌓기 시작했을 때 걸어야 값이 있다
      if ((S.cheer || 0) >= 25) { S.propHold = 1; use = true; }
    } else if (p.kind === 'curtain') {
      // 이미 이어가는 연속이 있을 때만 — 지킬 것이 없으면 오히려 더 나쁜 대본을
      // 다음 커튼콜로 보내게 된다 (22% → 17% 였다)
      if (S.chainId && handOf(S).some(function (sc) { return sc.id === S.chainId; })) { S.propCurtain = 1; use = true; }
    }
    if (use) {
      S.propCharge--; S.stats.propUses = (S.stats.propUses || 0) + 1;
      lg(S, 'e', '  ' + p.icon + ' ' + p.name + ' 을 썼다');
    }
  }
  // 턴이 끝나면 이번 턴짜리 효과를 되돌린다
  function propTurnEnd(S) {
    if (S.propStrip) { S.propStrip.def = S.propStrip.propStripped; S.propStrip = null; }
    S.propAoe = 0; S.propReflect = 0; S.propBlood = 0;
    if (S.ctx) { S.ctx.propAoe = 0; S.ctx.propReflect = 0; S.ctx.propBlood = 0; }
  }

  // 슬롯 수 — 3칸에서 시작해 성장으로 4칸까지. 「무대」는 빌드를 가리키므로(51장) 칸은 슬롯이라 부른다
  function stageN(S) {
    // 4칸은 복원 목록(「넓어진 무대」)으로 열린다. 사기 전에는 3칸이다.
    return Math.min(T.CFG.stageMax, S.slotMax || T.CFG.stageBase);
  }

  // 캐스팅 — 이 전투에서 주연으로 세울 배역을 고른다.
  // 그 배역을 요구하는 보유 대본의 값이 가장 큰 것을 고른다. 적을 보고 정하는 결정이다.
  function pickCast(S, w, skip) {
    var best = null, bv = -1e9;
    Object.keys(S.deck).forEach(function (id) {
      if (T.CARDS[id].hidden || id === skip) return;
      var v = 0;
      S.scripts.forEach(function (sc) {
        var req = sc.requiresFam ? [] : (sc.requires || []);
        var need = req.filter(function (x) { return x === id; }).length;
        if (!need) {
          if (sc.requiresFam && (T.CARDS[id] || {}).fam === sc.requiresFam) v += scriptRaw(S, w, sc) * 0.35;
          return;
        }
        // 요구 배역 중 하나를 확정으로 채워주면 그 대본의 상연 확률이 크게 오른다
        var gain = stageProb(sc, S.deck);
        v += scriptRaw(S, w, sc) * (0.9 - gain * 0.5);
      });
      if (T.CARDS[id].wild) v *= 1.25;              // 보석은 어떤 대본에도 들어간다
      if (v > bv) { bv = v; best = id; }
    });
    return best;
  }

  function maxCost(S) {
    // 막이 오르면 극단이 커진다 — 대본 11.6장을 코스트 4로는 못 쓴다.
    // 빌드가 자란 것이 실제 출력이 되어야 한다.
    return Math.max(1, S.ch.maxCost + (S.growth.cost || 0) + (S.act - 1) * T.CFG.costPerAct
                       + relicN(S, 'drumOpen') + relicN(S, 'darkScript')
                       - relicN(S, 'doubleCast'));
  }
  function scriptCap(S) {
    return T.CFG.scriptBase + (S.ch.handBonus || 0) + (S.growth.hand || 0) * 2
         + relicN(S, 'archive') * 3 + relicN(S, 'tornScript') * 4;
  }

  function fight(S, w, nd) {
    S.stats.fights++;
    S.fightTurn0 = S.stats.turns;
    S.block = 0; S.thorns = 0; S.turn = 0; S.revived = false;
    S.sealed = {}; S.censor = null; S.maxPlay = 0;
    S.stageDoneCache = null;      // 무대 완성 여부는 전투마다 다시 본다 —
                                  // 판 초반에 한 번 캐시되면 완성해도 영영 false 로 남는다
    // ✂️ 검열관 — 릴에서 배역 하나가 두 턴 동안 검열된다.
    //
    // 「가장 많은 배역」으로 잡았더니 이 축 하나가 4단 승률을 14% → 7% 로 반토막 냈다.
    // 우리 게임은 릴을 좁혀 특정 대본을 노리는 구조라, 최다 배역을 빼는 것은
    // 덱의 심장을 정확히 겨냥하는 일이다. 지속을 3턴 → 2턴으로 줄여도 꿈쩍하지 않았다.
    // 무작위로 뽑으면 좁힌 덱은 여전히 맞을 확률이 높고 넓은 덱은 덜 맞는다 —
    // 「집중 빌드를 때린다」는 의도는 남고 세기만 내려간다.
    if (S.asc.censorStart) {
      var ids = Object.keys(S.deck);
      if (ids.length) {
        var pickC = ids[Math.floor(S.rnd() * ids.length)];
        S.censor = { id: pickC, turns: 2 };
        lg(S, 'e', '  ✂️ ' + T.CARDS[pickC].name + ' 이 두 턴 동안 검열됐다');
      }
    }
    // 📖 모두가 대본을 읽었다 — 가장 값이 큰 대본 하나가 봉인된 채 시작한다
    if (S.asc.sealStart && S.scripts.length) {
      var best = null, bv = -1e9;
      S.scripts.forEach(function (sc) { var v = scriptRaw(S, S.w, sc); if (v > bv) { bv = v; best = sc; } });
      if (best) { S.sealed[best.id] = 1; S.sealTurns = 1;   // 첫 턴만
        lg(S, 'e', '  📖 「' + best.name + '」 이 한 턴 봉인됐다'); }
    }
    S.foes = pickFoes(S, nd).map(function (b) {
      // 재연 — 보스가 기믹을 하나씩 더 배운다. 수치가 아니라 규칙이 늘어난다.
      if (b.boss && S.asc.bossExtra) {
        var learn = (T.BOSS_LEARN[b.name] || []).slice(0, S.asc.bossExtra);
        if (learn.length) {
          b = Object.assign({}, b);
          learn.forEach(function (l) {
            Object.keys(l).forEach(function (k) {
              if (k === 'adds') b.adds = (b.adds || []).concat(l.adds); else b[k] = l[k];
            });
          });
        }
      }
      return T.makeEnemy(b, S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1),
        S.diff.atkMul * (T.CFG.actAtk[S.act - 1] || 1));
    });
    // 보스의 동반자는 전투 시작과 함께 무대에 선다
    S.foes.slice().forEach(function (f) {
      (f.adds || []).forEach(function (a) {
        S.foes.push(T.makeEnemy(Object.assign({ act: S.act }, a),
          S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1),
          S.diff.atkMul * (T.CFG.actAtk[S.act - 1] || 1)));
      });
      if (f.gimCd) f.gimT = f.gimCd;
      if (f.seizeCd) f.seizeT = f.seizeCd;
    });
    // 잡몹 기믹은 무리에서 한 마리만 발동한다.
    // 기믹은 단독 보스를 상정하고 만들었는데 4마리가 각자 들고 있으면 4중으로 터진다 —
    // 「박수치는 관객」 4마리가 재연을 네 번 하면서 2막 최다 학살자가 됐다.
    var gimSeen = {};
    S.foes.forEach(function (f) {
      if (f.boss || !f.gimmick) return;
      if (gimSeen[f.gimmick]) { f.gimmick = null; f.gimT = null; }
      else gimSeen[f.gimmick] = 1;
    });
    // 적의 다음 대사를 미리 정한다 — 보여줄 수 있어야 퍼즐이 된다
    S.foes.forEach(function (f) { if (!f.next) f.next = T.pickIntent(f, S.rnd); });
    S.curser = S.foes.filter(function (f) { return f.curse; })[0] || null;
    S.strips = []; for (var si = 0; si < T.CFG.stageMax; si++) S.strips.push(T.buildStrip(S.deck, S.rnd));
    S.cast = pickCast(S, S.w);   // 전투 전 캐스팅
    S.cast2 = S.growth.cast ? pickCast(S, S.w, S.cast) : null;
    // 환호는 런 내내 이어진다. 오직 기립 박수(가득 참)에서만 0 으로 돌아간다.
    if (S.cheer == null) S.cheer = (S.ch.cheerStart || 0) + (S.growth.cheer || 0) * 25;
    // 관객의 요구는 큰 무대에서만 — 판마다 걸면 배경음이 된다 (판당 19회였다).
    // 비극과 주연에서만 걸어 특별한 자리로 남긴다.
    S.fThorns = 0; S.thornsMark = 0; S.stallSkip = 0;
    S.propAoe = 0; S.propReflect = 0; S.propStrip = null; S.propCurtain = 0; S.propHold = 0; S.propBlood = 0; S.fightIds = {};
    S.curtainIn = (S.curtainNext || []).slice();   // 지난 무대를 닫은 대본들
    S.curtainNext = [];
    S.demand = (nd.type === 'elite' || nd.type === 'boss') ? nextDemand({}, ctxOf(S, S.w)) : null;
    if (S.demand) S.stats.demandOffer = (S.stats.demandOffer || 0) + 1;
    S.lastPlay = null; S.repeatN = 0; S.usedF = {};
    S.fightAoeOnly = 1; S.fightAnyDmg = 0; S.fightTempPlays = 0;
    S.ovations = 0;
    if (relicN(S, 'hungrySeat')) S.hp -= 5;   // 어둠 유물 — 무대에 오르는 대가
    var ctx = ctxOf(S, w); S.ctx = ctx;
    lg(S, 't', '── ' + S.foes[0].name + (S.foes.length > 1 ? ' ×' + S.foes.length : '')
      + (S.foes[0].demands ? ' (요구: ' + S.foes[0].demands + ')' : '') + ' ──');

    // ⏳ 시계를 든 손님 — 적이 방어를 두르고 등장한다.
    //
    // 처음에는 「적이 첫 턴부터 움직인다」로 잡았는데 27% → 7% 로 무너졌다.
    // 하나만 걸어도 마찬가지였다(→10%) — 그건 행동을 앞당기는 게 아니라
    // 「죽기 전에 못 때리던 적이 반드시 한 번 때린다」가 되기 때문이다.
    // 방어는 한 번 뚫으면 끝이라 빠른 덱의 첫 타를 흡수하되 누적되지 않는다.
    if (S.asc.startBlock) S.foes.forEach(function (f) { f.block = (f.block || 0) + S.asc.startBlock; });

    // 난입 — 공연에서는 확률로, 비극에서는 확정으로. 한 턴 미리 예고한다.
    S.intrudeQ = queueIntruders(S, nd);
    S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
    S.stats.intrusions = (S.stats.intrusions || 0) + S.intrudeQ.length;

    while (S.turn < 60) {
      S.turn++; S.stats.turns++;
      S.cost = maxCost(S);
      S.stats.costMax += S.cost;
      S.tHits = 0; S.tPlays = 0; S.tBlock = 0; S.tHeal = 0; S.tSelf = 0;
      if (relicN(S, 'darkScript')) S.hp -= 2;
      if (S.bleed > 0) { var bk = Math.round(S.bleed); S.hp = Math.min(S.maxHp, S.hp + bk); S.bleed = 0;
        if (bk > 0) lg(S, 's', '  🩸 태운 피 ' + bk + ' 이 돌아왔다'); }
      if (S.curser && S.curser.hp > 0) sowCurse(S);

      // 난입 — 예고한 턴에 무대로 뛰어든다
      if (S.intrudeQ.length) {
        if (S.turn === S.intrudeQ[0].on - 1) lg(S, 'e', '  🚪 무대 뒤에서 소리가 난다 — 다음 턴 누군가 난입한다');
        while (S.intrudeQ.length && S.turn >= S.intrudeQ[0].on) {
          var ent = S.intrudeQ.shift();
          var iv = T.makeEnemy(Object.assign({ act: S.act }, ent.who), S.diff.hpMul, S.diff.atkMul);
          if (iv.gimCd) iv.gimT = iv.gimCd;
          if (iv.seizeCd) iv.seizeT = iv.seizeCd;
          iv.next = T.pickIntent(iv, S.rnd);
        S.foes.push(iv); S.intruderIdx = S.foes.length - 1;
          lg(S, 'e', '  ' + (ent.who.icon || '🎩') + ' ' + iv.name + ' 이 난입했다 — ' + (ent.who.demands || ''));
          tr(S, 'intrude', iv.name + ' 난입');
        }
        S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
      }
      if (S.sealTurns > 0 && --S.sealTurns === 0) S.sealed = {};   // 📖 봉인이 풀린다
      autoSpin(S);
      var rp = 1 - Math.pow(0.9, relicN(S, 'respin'));
      if (rp > 0 && S.rnd() < rp) { autoSpin(S); lg(S, 'e', '  🔄 무대를 다시 올렸다'); }
      S.temp = instantScripts(S, ctx);
      // 커튼콜 — 지난 무대를 닫은 대본이 1턴에 무료로 손패에 온다.
      // 이 주입이 사람 플레이 경로(beginTurn)에만 있어서 봇은 커튼콜을 한 번도
      // 쓴 적이 없다. 이번 세션의 밸런스 측정은 전부 커튼콜 없이 돌아갔다.
      if (S.turn === 1 && S.curtainIn && S.curtainIn.length) {
        S.curtainIn.forEach(function (id) {
          var csc = T.SCRIPT_BY_ID[id];
          if (csc) S.temp.unshift(Object.assign({}, csc, { temp: true, curtain: true, cost: 0 }));
        });
        lg(S, 's', '  🎭 커튼콜 — ' + S.curtainIn.map(function (id) {
          return '「' + (T.SCRIPT_BY_ID[id] || {}).name + '」';
        }).join(' '));
      }
      stageTurn(S, ctx);   // 완성된 무대의 규칙 — 매 턴 시작
      tryProp(S, ctx);   // 유품 — 스핀을 보고 나서, 계획을 세우기 전에
      lg(S, 't', '턴 ' + S.turn + ' 무대 — ' + S.stage.map(function (x) { return T.CARDS[x].name; }).join(' · '));
      tr(S, 'spin', '턴 ' + S.turn + ' 무대');

      var live = S.scripts.filter(function (s) { return T.canStage(s, S.stage, ctx.relax); }).length;
      S.stats.playable += live; S.stats.playableOf += S.scripts.length; S.stats.temp += S.temp.length;
      // 이번 턴에 실제로 「고를 수 있는」 것이 몇 개인가 — 1 이면 결정이 아니다.
      // 재미를 재는 가장 직접적인 숫자라 히스토그램으로 남긴다.
      var pick = handOf(S).filter(function (sc) { return canPlay(S, sc); }).length;
      S.stats.optSum = (S.stats.optSum || 0) + pick;
      var bkt = pick >= 3 ? 'o3' : ('o' + pick);
      S.stats[bkt] = (S.stats[bkt] || 0) + 1;

      // 계획 → 필요하면 재굴림 → 다시 계획
      var plan = planTurn(S, ctx);
      var rer = 0, free = (S.ch.freeReroll || 0) + (S.growth.reroll || 0);
      while (rer < 2 && (free > 0 || S.cost >= 2)) {
        if (S.rnd() > S.sk.useReroll) break;        // 재굴림을 쓸 줄 아는지가 숙련도다
        var k = worstReel(S, ctx), isFree = free > 0;
        var gain = rerollGain(S, ctx, k, planTurn(S, ctx, true).score, isFree);
        if (gain <= (isFree ? 0.5 : 6)) break;     // 공짜면 조금만 나아도, 코스트를 내면 확실할 때만
        if (isFree) free--; else S.cost -= 1;
        S.stats.rerolls++;
        var st = S.strips[k], ix = Math.floor(S.rnd() * st.length);
        S.pos[k] = ix; S.stage[k] = st[ix];
        S.temp = instantScripts(S, ctx);
        lg(S, 'e', '  🔁 릴 ' + (k + 1) + ' 재굴림 → ' + T.CARDS[S.stage[k]].name);
        tr(S, 'reroll', '릴 ' + (k + 1) + ' 재굴림');
        plan = planTurn(S, ctx); rer++;
      }

      var ampTurn = 0;
      for (var i = 0; i < plan.seq.length; i++) {
        var a = plan.seq[i];
        if (costOf(S.ch, a.sc) > S.cost) continue;
        if (!a.sc.curtain && !T.canStage(a.sc, S.stage, ctx.relax)) continue;
        if (S.sealed[a.sc.id]) continue;
        var aliveBefore = S.foes.filter(function (f) { return f.hp > 0; }).length;
        var C = { hp: S.hp, maxHp: S.maxHp, block: S.block, thorns: S.thorns, cost: S.cost,
                  gold: S.gold, foes: S.foes, dead: false, ampHit: 0,
                  cheer: S.cheer, lastPlay: S.lastPlay, repeatN: S.repeatN, maxPlay: S.maxPlay, bleed: S.bleed || 0,
                  demand: S.demand, tHits: S.tHits || 0, tPlays: S.tPlays || 0, tBlock: S.tBlock || 0,
                  tHeal: S.tHeal || 0, tSelf: S.tSelf || 0, fThorns: S.fThorns || 0,
                  usedF: S.usedF || (S.usedF = {}) };
        var ev = applyPlay(C, a.sc, a.tgt, ctx);
        S.hp = C.hp; S.block = C.block; S.thorns = C.thorns; S.cost = C.cost; S.gold = C.gold;
        S.cheer = C.cheer; S.lastPlay = C.lastPlay; S.repeatN = C.repeatN; S.maxPlay = C.maxPlay;
        S.bleed = C.bleed || 0;
        S.tHits = C.tHits; S.tPlays = C.tPlays; S.tBlock = C.tBlock; S.tHeal = C.tHeal; S.tSelf = C.tSelf;
        S.lastId = C.lastId;
        if (C.demand !== S.demand) {
          lg(S, 's', '  🎯 관객이 만족했다 — 환호 +' + T.DEMAND_CHEER
            + ' · 다음 요구 ' + (C.demand ? C.demand.icon + ' ' + C.demand.name : ''));
          S.stats.demandDone = (S.stats.demandDone || 0) + 1;
          S.demand = C.demand;
        }
        S.usedF = C.usedF || S.usedF;
        if (C.ovation) S.stats.ovations = (S.stats.ovations || 0) + 1;
        if (C.ampHit) ampTurn = 1;
        // 에픽 무대는 물건이 아니라 「그렇게 플레이했다」를 조건으로 삼는다.
        // 그러려면 시스템을 실제로 몇 번 썼는지를 세어야 한다.
        if (a.sc.curtain) S.stats.curtainPlays = (S.stats.curtainPlays || 0) + 1;
        S.stats.cheerPeak = Math.max(S.stats.cheerPeak || 0, C.cheer || 0);
        // 실제로 상연한 것만 센다 — applyPlay 는 계획 탐색 안에서도 불린다
        var _e = T.scriptEffect(a.sc, S.ch);
        S.stats.scrDmg = (S.stats.scrDmg || 0) + (_e.dmg || 0) + (_e.aoe || 0);
        S.stats.thornAdd = (S.stats.thornAdd || 0) + (_e.thorns || 0) * (S.ch.thornsMul || 1);
        S.stats.plays++;
        S.stats.byTier[a.sc.tier] = (S.stats.byTier[a.sc.tier] || 0) + 1;
        S.stats.byScript[a.sc.name] = (S.stats.byScript[a.sc.name] || 0) + 1;
        (S.fightIds = S.fightIds || {})[a.sc.id] = 1;   // 이 전투에 상연한 대본 (🎦 닫힌 막)
        if (a.sc.temp) { var ti = S.temp.indexOf(a.sc); if (ti >= 0) S.temp.splice(ti, 1); }
        lg(S, 's', '  상연 「' + a.sc.name + '」 ' + T.effText(a.sc.effect));
        ev.forEach(function (t) { lg(S, 'a', '    ' + t); });
        tr(S, 'play', '상연 「' + a.sc.name + '」');
        // 해금 조건 관찰 — 「극단」은 판 수가 아니라 플레이 방식으로 열린다.
        // 조건은 시작 캐릭터로 달성 가능해야 한다. 그 캐릭터의 카드가 필요한 조건은
        // 자기참조라서 열리지 않았다 (어릿광대 해금률 1%).
        watchFeats(S, a.sc, aliveBefore);
        if (S.hp <= 0) { if (!revive(S)) return { won: false, killedBy: S.foes[0].name }; }
        if (!S.foes.some(function (f) { return f.hp > 0; })) { winFight(S); return { won: true }; }
      }
      if (ampTurn) S.stats.ampTurns++;
      if (!plan.seq.length) S.cheer = Math.max(0, S.cheer + T.CHEER.emptyTurn);
      S.stats.costUsed += maxCost(S) - S.cost;

      var res = endTurn(S, w);
      if (res) return res;
    }
    return { won: false, killedBy: '시간 초과' };
  }

  function spent(plan, S) {
    var c = 0; plan.seq.forEach(function (a) { c += costOf(S.ch, a.sc); });
    return c;
  }

  function autoSpin(S) {
    var idx = [], line = [], N = stageN(S);
    for (var k = 0; k < N; k++) {
      var st = S.strips[k], i = Math.floor(S.rnd() * st.length);
      idx.push(i); line.push(st[i]);
    }
    // 캐스팅 — 지명한 주연은 매 턴 무대 첫 칸에 선다.
    // 릴을 설계한 결실이 무대에 보장되는 지점이고, 이 게임에서 유일하게
    // 「내가 정한 것이 반드시 나오는」 자리다.
    if (S.cast) { line[0] = S.cast; idx[0] = -1; }
    if (S.cast2 && N > 1) { line[1] = S.cast2; idx[1] = -1; }
    // 검열 — 봉인된 배역은 무대에서 검은 칸이 된다
    if (S.censor && S.censor.turns > 0) {
      line = line.map(function (id) { return id === S.censor.id ? 'void' : id; });
    }
    S.pos = idx; S.stage = line;
    // 어둠 유물 「더블 캐스팅」 — 무대를 두 번 올려 좋은 쪽을 쓴다
    if (relicN(S, 'doubleCast') && !S.inDouble) {
      S.inDouble = 1;
      var keepIdx = idx.slice(), keepLine = line.slice();
      var ctx = ctxOf(S, S.w);
      var scoreOf = function () {
        return S.scripts.filter(function (s) {
          return !S.sealed[s.id] && T.canStage(s, S.stage, ctx.relax); }).length;
      };
      var a = scoreOf();
      autoSpin(S);
      if (scoreOf() < a) { S.pos = keepIdx; S.stage = keepLine; }
      S.inDouble = 0;
    }
  }

  // 압수당한 대본은 이 전투 동안 손에서 사라진다
  function handOf(S) {
    return S.temp.concat(S.scripts.filter(function (s) { return !S.sealed[s.id]; }));
  }

  function instantScripts(S, ctx) {
    if (relicN(S, 'tornScript')) return [];        // 어둠 유물 — 즉석 대본이 나오지 않는다
    var owned = {}; S.scripts.forEach(function (s) { owned[s.id] = 1; });
    var out = [];
    T.SCRIPTS.forEach(function (s) {
      if (owned[s.id] || s.tier === 'one') return;
      if (!T.canStage(s, S.stage, ctx.relax)) return;
      out.push(Object.assign({}, s, { temp: true,
        cost: Math.max(1, s.cost - (relicN(S, 'improv') ? 1 : 0)) }));
    });
    out.sort(function (a, b) { return b.cost - a.cost; });
    // 즉석은 기본 1장. 유물이 늘리고, 환호가 절반을 넘으면 한 장 더 —
    // 관중이 달아오르면 즉흥이 나온다는 그림이다.
    var tn = T.CFG.tempBase + (S.growth.temp || 0) + relicN(S, 'improv')
           + ((S.cheer || 0) >= (S.asc.cheerMax || T.CHEER.max) * 0.5 ? 1 : 0);
    return out.slice(0, Math.max(1, tn));
  }

  function sowCurse(S) {
    var r = Math.floor(S.rnd() * 3), st = S.strips[r], free = [];
    for (var i = 0; i < st.length; i++) if (st[i] !== 'dead') free.push(i);
    if (!free.length) return;
    st[free[Math.floor(S.rnd() * free.length)]] = 'dead';
    lg(S, 'e', '  🕳 릴 ' + (r + 1) + ' 에 망자가 심겼다');
  }

  function revive(S) {
    if (S.revived || !relicN(S, 'phoenix')) return false;
    S.revived = true; S.hp = Math.round(S.maxHp * 0.3);
    lg(S, 'e', '  🪶 불사조의 깃펜 — 부활');
    return true;
  }

  function endTurn(S, w) {
    var before = S.foes.filter(function (f) { return f.hp > 0; }).length;
    S.foes.forEach(function (f) { if (f.hp > 0) T.tickDots(f); });
    var died = before - S.foes.filter(function (f) { return f.hp > 0; }).length;
    // 관객을 퇴장시키면 시계를 되산다 — 하수인이 시간이라는 자원이 된다
    S.foes.forEach(function (f) {
      if (f.clock == null || !f.clockPerAdd) return;
      var gone = (f.adds2 || []).length - S.foes.filter(function (y) {
        return y.hp > 0 && (f.adds2 || []).some(function (a) { return a.name === y.name; }); }).length;
      if (gone > (f.clockPaid || 0)) {
        var pay = (gone - (f.clockPaid || 0)) * f.clockPerAdd;
        f.clock += pay; f.clockPaid = gone;
        lg(S, 's', '  🔔 관객이 퇴장했다 — 시계 +' + pay);
      }
    });
    if (died && relicN(S, 'candleR')) { S.maxHp += 2 * died * relicN(S, 'candleR'); S.hp += 2 * died; }
    if (!S.foes.some(function (f) { return f.hp > 0; })) { winFight(S); return { won: true }; }

    S.foes.forEach(function (f) {
      if (f.hp > 0 && f.defGrow) f.def = Math.min(f.defMax || 1e9, f.def + f.defGrow);
    });
    // 관객의 야유 — 막이 길어지면 적이 세지고 플레이어가 깎인다.
    // 보스 막은 원래 길다. 같은 시계를 물리면 2막이 열리는 순간 야유까지 겹쳐 터진다.
    // 어둠 유물 「마지막 막」 — 12턴을 넘기면 즉시 패배
    if (relicN(S, 'finalCurtain') && S.turn >= 12) {
      lg(S, 'e', '  🎦 마지막 막 — 시간이 다 됐다');
      return { won: false, killedBy: '마지막 막' };
    }
    var stallAt = Math.max(4, T.CFG.stallTurn + S.asc.stallDelta)
      + (S.foes.some(function (f) { return f.boss; }) ? 6 : 0);
    if (relicN(S, 'emptyHouse')) stallAt = 1e9;      // 어둠 유물 — 야유가 오지 않는다
    // 반사는 맞아야 나가는 피해라 구조적으로 느리다 — 거울의 배우가 전투당 6.4턴,
    // 어릿광대가 2.4턴이었다. 그런데 재연은 야유만 앞당긴다(2단 8턴 · 8단 6턴).
    // 그래서 재연이 「느린 덱만 골라 때리는 사다리」가 됐다 — 거울의 배우 20% → 2%.
    // 되돌려주고 있으면 관객은 지루해하지 않는다. 그 턴은 정체로 세지 않는다.
    if (S.fThorns > (S.thornsMark || 0)) { S.thornsMark = S.fThorns; S.stallSkip = (S.stallSkip || 0) + 1; }
    if (S.turn - (S.stallSkip || 0) >= stallAt) {
      S.foes.forEach(function (f) { if (f.hp > 0) f.atk = Math.ceil(f.atk * (1 + T.CFG.stallAtkPer)); });
      S.hp -= S.asc.stallDmg;
      S.cheer = Math.max(0, S.cheer + T.CHEER.coolPerTurn);
      if (S.turn - (S.stallSkip || 0) === stallAt) lg(S, 'e', '  😠 관객이 야유한다 — 이제 매 턴 적이 세진다');
    }
    var gr = gimmicks(S);
    if (gr) return gr;
    if (S.hp <= 0 && !revive(S)) return { won: false, killedBy: S.foes[0].name };
    S.foes.forEach(function (f) {
      if (f.hp <= 0 || !f.doom) return;
      f.doom--;
      if (f.doom <= 0) { S.hp -= S.maxHp * 0.5; f.doom = f.doomMax; lg(S, 'e', '  🔔 종이 울렸다 — 최대 HP 절반'); }
    });
    if (S.hp <= 0 && !revive(S)) return { won: false, killedBy: S.foes[0].name };

    S.foes.forEach(function (f) { if (f.hp > 0) f.t--; });
    S.foes.forEach(function (f) {
      if (f.hp <= 0 || f.t > 0) return;
      f.t = f.cd;
      var it = f.next || T.pickIntent(f, S.rnd);
      f.next = T.pickIntent(f, S.rnd);
      if (it === 'defend') { f.block += f.defVal; lg(S, 't', '  ' + f.name + ' 방어 ' + f.defVal); return; }
      if (it === 'buff') { f.atk += f.buffVal; lg(S, 't', '  ' + f.name + ' 강화 +' + f.buffVal); return; }
      if (it === 'healAll') {
        S.foes.forEach(function (y) { if (y.hp > 0) y.hp = Math.min(y.maxHp, y.hp + f.healVal); });
        lg(S, 't', '  ' + f.name + ' 전체 회복 ' + f.healVal); return; }
      if (it === 'absorb') {
        var ab2 = S.block * 0.5;                 // 전액 흡수는 방어 빌드를 통째로 지웠다
        f.hp = Math.min(f.maxHp, f.hp + ab2);
        lg(S, 'e', '  ' + f.name + ' 방어 ' + Math.round(ab2) + ' 흡수'); S.block -= ab2; return; }
      var inc = f.atk * (it === 'doubleStrike' ? 2 : 1);
      if (it === 'attackBleed' || it === 'attackBurn') inc += f.dotVal;
      var ab = Math.min(S.block, inc); S.block -= ab; S.hp -= (inc - ab);
      // 크게 맞으면 관객이 등을 돌린다 — 이게 있어야 「환호 유지」가 덱이 된다
      if ((inc - ab) >= S.maxHp * T.CHEER.dropAt && S.cheer > 0) {
        S.cheer = 0; S.stats.cheerLost = (S.stats.cheerLost || 0) + 1;
        lg(S, 'e', '    💔 관객이 등을 돌렸다 — 환호 0');
      }
      lg(S, 'd', '  ' + f.name + ' ' + T.INTENT_KO[it] + ' ' + inc + (ab ? ' (방어 ' + Math.round(ab) + ')' : ''));
      // 🪞 손거울 — 날아온 공격을 그대로 돌려준다.
      // 「막고 남은 피해(inc - ab)」로 재고 있었는데 거울의 배우는 방어형이라
      // 방어가 거의 다 흡수한다 — 판당 반사가 1 이었다. 방어와 무관하게 원본을 돌려준다.
      if (S.propReflect) {
        var mr = inc;
        if (mr > 0) { f.hp -= mr; S.fThorns = (S.fThorns || 0) + mr;
          S.stats.propRefl = (S.stats.propRefl || 0) + mr;
          lg(S, 'b', '    🪞 그대로 반사 ' + Math.round(mr)); }
      }
      if (S.thorns) {
        var rd = S.ch.thornsIgnoreDef ? S.thorns
               : Math.max(0, S.thorns - f.def * T.AMP.thornsDefPart);
        if (f.block > 0) { var rb = Math.min(f.block, rd); f.block -= rb; rd -= rb; }
        f.hp -= rd; if (rd > 0) { S.fThorns = (S.fThorns || 0) + rd; lg(S, 'b', '    반사 ' + Math.round(rd)); }
      }
    });
    propTurnEnd(S);                 // 이번 턴짜리 유품 효과를 되돌린다
    tr(S, 'enemy', '적 행동');
    if (S.hp <= 0 && !revive(S)) return { won: false, killedBy: S.foes[0].name };
    if (!S.foes.some(function (f) { return f.hp > 0; })) { winFight(S); return { won: true }; }
    return null;
  }

  // ── 보스·난입자 기믹 ─────────────────────────────────────
  // 닼던의 방식 — 수치가 아니라 강제되는 대응을 만든다.
  function gimmicks(S) {
    if (S.censor && --S.censor.turns <= 0) { lg(S, 'e', '  ✂️ 검열이 풀렸다'); S.censor = null; }

    for (var i = 0; i < S.foes.length; i++) {
      var f = S.foes[i];
      if (f.hp <= 0) continue;

      // 재연 — 내가 가장 크게 쓴 대본을 그대로 되돌린다
      if (f.gimmick === 'mimic' && f.gimT != null) {
        if (--f.gimT <= 0) {
          f.gimT = f.gimCd;
          var d = Math.round((S.maxPlay || 0) * 0.6);
          if (d > 0) {
            var ab = Math.min(S.block, d); S.block -= ab; S.hp -= (d - ab);
            lg(S, 'd', '  🎬 ' + f.name + ' 재연 — ' + d + ' 피해' + (ab ? ' (방어 ' + Math.round(ab) + ')' : ''));
          }
        }
      }
      // 검열 — 릴에서 가장 많은 배역을 봉인한다
      if (f.gimmick === 'censor' && f.gimT != null) {
        if (--f.gimT <= 0) {
          f.gimT = f.gimCd;
          var top = null, tv = 0;
          Object.keys(S.deck).forEach(function (id) { if (S.deck[id] > tv) { tv = S.deck[id]; top = id; } });
          if (top) {
            S.censor = { id: top, turns: 3 };
            lg(S, 'e', '  ✂️ ' + f.name + ' 검열 — ' + T.CARDS[top].name + ' 2턴 봉인');
          }
        }
      }
      // 압수 — 내 대본을 이 전투 동안 빼앗는다
      if (f.seizeCd && f.seizeT != null) {
        if (--f.seizeT <= 0) {
          f.seizeT = f.seizeCd;
          var open = S.scripts.filter(function (s) { return !S.sealed[s.id]; });
          if (Object.keys(S.sealed).length < (f.seizeMax || 2) && open.length > 2) {
            // 가장 값이 큰 대본을 가져간다 — 그게 압수다
            var pick = open.slice().sort(function (a, b) {
              return scriptRaw(S, S.w, b) - scriptRaw(S, S.w, a); })[0];
            S.sealed[pick.id] = 1;
            lg(S, 'e', '  📜 ' + f.name + ' 압수 — 「' + pick.name + '」 이 사라졌다');
          }
        }
      }
      // 무대 화재 — 매 턴 플레이어가 탄다
      if (f.gimmick === 'ignite') { S.hp -= 4; lg(S, 'd', '  🔥 무대가 타오른다 — 4 피해'); }
      // 2막 — 절반에서 판이 바뀐다. 그리고 시계가 돌아간다.
      if (f.gimmick === 'phase' && !f.phased && f.hp <= f.maxHp * (f.phaseAt || 0.5)) {
        f.phased = 1;
        f.atk = Math.round(f.atk * (f.phaseAtkMul || 1.5));
        f.def += (f.phaseDef || 0);
        f.clock = f.phaseDoom || 5;
        (f.adds2 || []).forEach(function (a) {
          S.foes.push(T.makeEnemy(Object.assign({ act: 3 }, a), S.diff.hpMul, S.diff.atkMul));
        });
        lg(S, 'e', '  🎭 2막이 열렸다 — 공격 ' + f.atk + ' · 관객이 몰려온다 · ' + f.clock + '턴 남음');
        tr(S, 'phase', '2막');
      }
      if (f.clock != null && f.phased) {
        if (--f.clock <= 0) { lg(S, 'e', '  🔔 막이 내려갔다'); return { won: false, killedBy: f.name + ' (막 내림)' }; }
        lg(S, 't', '  🔔 ' + f.clock + '턴 남음');
      }
    }
    return null;
  }

  function winFight(S) {
    var G = T.CFG.gold;
    var g = G.fightBase + Math.floor(S.rnd() * G.fightRand) + (S.at.type === 'elite' ? G.elite : 0);
    if (relicN(S, 'hungrySeat')) g *= 2;           // 어둠 유물 — 골드 2배
    // 난입자를 이겨내면 대본 한 장과 골드를 더 준다 — 난입은 위험이자 기회다
    if (S.intruderIdx != null) {
      g += G.intruder;
      // 비극은 이미 대본을 준다 — 난입 보너스 대본은 일반 공연에서만
      if (S.at.type === 'fight') S.bonusScript = 1;
      S.intruderIdx = null;
      S.stats.intruderWins = (S.stats.intruderWins || 0) + 1;
      lg(S, 's', '  🎩 난입자를 이겨냈다' + (S.bonusScript ? ' — 대본 한 장 추가' : ' — 골드 +' + G.intruder));
    }
    // 관객은 위기를 좋아한다 — 벼랑에서 이기면 열기가 다음 무대까지 간다
    // 요구 「아슬아슬하게」 — 상시 보너스면 항상 벼랑에서 놀 이유가 되지만,
    // 요구로 두면 그때만 하는 선택이 된다.
    if (S.demand && S.demand.id === 'thrill' && S.hp <= S.maxHp * T.CHEER.thrillAt) {
      g += T.CHEER.thrillGold;
      S.cheer = Math.min(S.asc.cheerMax || T.CHEER.max, (S.cheer || 0) + T.CHEER.thrillCheer);
      S.stats.demandDone = (S.stats.demandDone || 0) + 1;
      S.stats.thrills = (S.stats.thrills || 0) + 1;
      lg(S, 's', '  😱 관객의 요구를 들어줬다 — 아슬아슬하게 · 골드 +' + T.CHEER.thrillGold
        + ' · 환호 +' + T.CHEER.thrillCheer);
    }
    // 커튼콜 — 막을 닫은 대본이 다음 무대의 1턴에 오른다
    if (S.lastId) {
      var slots = (S.ch.curtainSlots || T.CFG.curtain.slots) + (S.growth.curtain || 0)
        + (stageOn(S, 'curtain') ? 1 : 0)
                + relicN(S, 'longBow');
      // 🎦 닫힌 막 — 무대를 닫은 대본이 아니라 「이어가려던 대본」을 다음 커튼콜로 보낸다.
      // 종막의 배우가 연속을 잇지 못하고 끊기는 것을 한 번 되돌린다.
      S.curtainNext = [S.lastId];
      // 🎦 닫힌 막 — 마무리 대본을 덮어쓰지 않고 한 장 더한다
      if (S.propCurtain && S.chainId && S.chainId !== S.lastId && (S.fightIds || {})[S.chainId])
        S.curtainNext.push(S.chainId);
      // 연속 — 지난 무대를 닫은 그 대본으로 또 닫았는가
      if (S.chainId === S.lastId) {
        S.chain = Math.min(T.CFG.curtain.chainMax, (S.chain || 0) + 1);
        S.stats.chainMax = Math.max(S.stats.chainMax || 0, S.chain);
        lg(S, 's', '  🎭 연속 ' + S.chain + '회 — 「' + (T.SCRIPT_BY_ID[S.lastId] || {}).name + '」');
        if (S.chain >= 3) S.feat.closer = 1;
      } else {
        S.chain = S.chainId ? Math.floor((S.chain || 0) * (S.ch.chainKeep || 0)) : 0;
        S.chainId = S.lastId;
      }
      // 커튼콜 칸이 둘 이상이면 직전 대본도 함께 남는다
      if (slots > 1 && S.prevId && S.prevId !== S.lastId) S.curtainNext.push(S.prevId);
      S.prevId = S.lastId;
    }
    S.gold += g;
    if (!S.feat) S.feat = {};
    if (S.hp <= S.maxHp * 0.25) S.feat.fallen = 1;              // 벼랑에서 이겨낸다
    if (S.fightAoeOnly && S.fightAnyDmg) S.feat.frenzy = 1;     // 광역만으로 끝낸다
    // 환호를 높게 유지한 채 전투를 끝냈나 — 「달아오른 무대」를 지켰다는 증명
    if ((S.cheer || 0) >= (S.asc.cheerMax || T.CHEER.max) * 0.75)
      S.stats.hotWins = (S.stats.hotWins || 0) + 1;
    var _a = S.act;
    S.stats.actTurns = S.stats.actTurns || {1:0,2:0,3:0};
    S.stats.actFights = S.stats.actFights || {1:0,2:0,3:0};
    S.stats.actTurns[_a] += S.turn; S.stats.actFights[_a]++;
    S.stats.thornDmg = (S.stats.thornDmg || 0) + (S.fThorns || 0);
    lg(S, 's', '── 통과 · ' + S.turn + '턴 · HP ' + Math.round(S.hp) + ' · 골드 +' + g + ' ──');
  }

  // ── 보상 판단 ─────────────────────────────────────────────
  // 공연 보상은 배역 3 · 대본 3 을 함께 내밀고 하나만 고르게 한다.
  // 릴 확률을 올릴지, 대본 폭을 넓힐지가 매번 결정이 된다.
  function deckSize(S) { return Object.keys(S.deck).reduce(function (a, k) { return a + S.deck[k]; }, 0); }

  function cardValue(S, w, id) {
    var d = T.CARDS[id], v = 0;
    // 이 배역이 내 대본의 요구를 얼마나 자주 채우게 되는가 — 그게 값이다
    var d2 = Object.assign({}, S.deck); d2[id] = (d2[id] || 0) + 1;
    S.scripts.forEach(function (sc) {
      var gain = stageProb(sc, d2) - stageProb(sc, S.deck);
      v += gain * scriptRaw(S, w, sc) * 2.2;
    });
    if (d.wild) v += 6;
    if ((S.ch.pool || []).indexOf(id) >= 0) v += 3;
    v += (d.dmg || 0) * 0.12 + (d.block || 0) * 0.08 * w.block;
    v += tiltBonus(S, 'card', id);
    if (deckSize(S) >= T.CFG.reelMax) v = -1;
    return v;
  }

  function scriptRaw(S, w, sc) {
    var e = T.scriptEffect(sc, S.ch);
    return e.dmg * w.dmg + e.aoe * 1.45 * w.aoe + e.block * 0.62 * w.block + e.heal * 0.72
      + (e.burn * 2.1 + e.poison * 2.4 + e.slow * 4.4) * w.status
      + e.thorns * 1.25 * w.thorns * (S.ch.thornsMul || 1)
      // 태운 피가 돌아오는 캐릭터는 자해를 절반만 손해로 본다 —
      // 이걸 반영하지 않아서 봇이 자해 대본을 피했고 코스트 사용이 51% 였다
      - e.selfDmg * (S.ch.ignoreSelfDmg ? 0 : (S.ch.bleedBack ? 0.55 : 1.3));
  }

  function scriptValue(S, w, sc) {
    if (S.scripts.some(function (x) { return x.id === sc.id; })) return -1;
    if (costOf(S.ch, sc) > maxCost(S)) return -1;
    var raw = scriptRaw(S, w, sc) / costOf(S.ch, sc);
    var p = stageProb(sc, S.deck);
    var v = raw * (0.35 + p);                     // 상연 확률이 낮으면 값이 깎인다
    v *= T.scriptWeight(S.ch, sc) >= 4 ? 1.15 : 1;
    v += tiltBonus(S, 'script', sc);
    if (S.scripts.length >= scriptCap(S)) v = -1;
    return v;
  }

  function offerCards(S) {
    var pool = Object.keys(T.CARDS).filter(function (id) { return !T.CARDS[id].hidden; });
    var out = T.pickWeighted(pool, function (id) {
      return (S.ch.pool || []).indexOf(id) >= 0 ? 3 : 1;
    }, S.rnd, 3);
    // 조용한 기울기 — 후보 셋 중 한 자리를 그 무대의 카드로 채운다.
    // 이게 없으면 특정 카드가 뜰 기대값이 판당 0.25장이라 무엇도 못 모은다.
    var tk = tiltAt(S);
    if (tk && S.rnd() < TILT_P.card && stageProg(S, tk).reel < needAt(S).reel) {
      var want = STAGES[tk].reel[Math.floor(S.rnd() * STAGES[tk].reel.length)];
      if (out.indexOf(want) < 0) out[out.length - 1] = want;
    }
    if (tk) {
      var st0 = STAGES[tk];
      if (out.some(function (id) { return st0.reel.indexOf(id) >= 0; }))
        S.stats.tiltOffer = (S.stats.tiltOffer || 0) + 1;
      S.stats.tiltChance = (S.stats.tiltChance || 0) + 1;
    }
    return out;
  }
  // shop 이면 1종도 낸다. 보상에서 1종을 뺀 것은 「1종 반복이 정답이 되면 안 된다」였고
  // 그 원칙은 코스트당 값(1종 11.0 / 3종 17.5 · 49장)으로 이미 지켜진다. 그런데 그 여파로
  // 1종 26종 중 15종이 도달 불가가 됐다 — 시작 대본으로만 들어오기 때문이다(64.2).
  // 상점에만 싸게 두면 「무대 조건을 채우는 값싼 재료」가 되고 스팸은 손패 상한이 막는다.
  // 그 대본의 재료를 전부 써봤는가. 계열 대본은 그 계열 카드를 하나라도 알면 된다.
  function knownScript(S, sc) {
    var K = S.known; if (!K) return true;
    if (sc.requiresFam) return Object.keys(K).some(function (c) { return (T.CARDS[c] || {}).fam === sc.requiresFam; });
    return (sc.requires || []).every(function (c) { return K[c]; });
  }
  function offerScripts(S, n, shop) {
    var owned = {}; S.scripts.forEach(function (s) { owned[s.id] = 1; });
    var pool = T.SCRIPTS.filter(function (sc) {
      if (owned[sc.id] || (!shop && sc.tier === 'one')) return false;
      return knownScript(S, sc);
    });
    var seen = (S.meta && S.meta.seen) || {};
    var tk = tiltAt(S);
    var tst = (tk && S.rnd() < TILT_P.script && stageProg(S, tk).script < needAt(S).script) ? STAGES[tk] : null;
    // 대본 서고 — 예전 판에서 상연해 본 대본이 더 자주 뜬다. 덱을 이어서 만들어가는 감각.
    return T.pickWeighted(pool, function (sc) {
      var v = T.scriptWeight(S.ch, sc) * (seen[sc.id] ? T.ARCHIVE_MUL : 1);
      if (tst && tst.script(sc.effect || {}, sc)) v *= 3;
      return v;
    }, S.rnd, n);
  }
  // 유물 후보 두 자리 중 하나를 그 무대의 유물로 바꾼다.
  // 판당 유물 획득이 2.1개뿐이라, 이게 없으면 특정 유물 1개도 15% 밖에 안 나온다.
  function tiltRelics(S, list) {
    if (!S.useStages || S.rnd() >= TILT_P.relic) return list;
    // 자리가 둘이다 — 하나는 노리는 일반 무대, 하나는 진행 중인 에픽 무대.
    // 한쪽이 두 자리를 다 먹으면 다른 쪽이 영원히 못 찬다.
    var slot = 0;
    function put(want) {
      if (!want.length || slot >= list.length) return;
      var pick = want[Math.floor(S.rnd() * want.length)];
      if (list.indexOf(pick) < 0) list[slot] = pick;
      slot++;
    }
    function open(ks) {
      return ks.filter(function (k) {
        var r = T.RELICS[k];
        return !relicN(S, k) && (!r.dark || (S.asc.level || 0) >= r.asc);
      });
    }
    var tk = tiltAt(S);
    if (tk && stageProg(S, tk).relic < needAt(S).relic) put(open(STAGES[tk].relic));
    var ek = epicTilt(S);
    if (ek) put(open(EPIC[ek].relic));
    return list;
  }

  // 에픽은 「그렇게 플레이하고 있다」가 보일 때부터 유물이 따라온다.
  // 특정 유물 2개는 판당 획득 2.1개로는 우연히 모이지 않는다.
  function epicTilt(S) {
    if (!S.useStages) return null;
    // 0.30 이면 기립 박수 6.7/20 인 판이 발동선에 못 닿아 환호 유물을 영영 안 산다.
    var best = null, bv = EPIC_AT;
    Object.keys(EPIC).forEach(function (k) {
      var g = epicProg(S, k);
      if (g.done || g.relic >= EPIC[k].relicN) return;
      if (g.p > bv) { bv = g.p; best = k; }
    });
    return best;
  }

  // 팔지 말아야 할 릴 카드 — 노리는 무대뿐 아니라 이미 쌓아둔 무대까지.
  // 기울기가 옮겨가는 순간 이전 무대의 카드가 판매 대상으로 풀려서,
  // 8층에 3/3 이던 릴이 18층에 1/3 으로 줄어드는 일이 벌어졌다.
  function protectedReel(S) {
    if (!S.useStages) return [];
    var out = [], tk = tiltAt(S);
    Object.keys(STAGES).forEach(function (k) {
      var g = stageProg(S, k);
      if (k === tk || g.reel > 0) out = out.concat(STAGES[k].reel);
    });
    return out;
  }

  // 무대 진행이 걸린 물건은 값이 오른다 — 사람이 조준한다는 뜻이다
  function tiltBonus(S, kind, x) {
    // 에픽은 일반 무대와 별개로 굴러간다 — 일반 무대에 기울지 않은 판에서도
    // 커튼콜·환호는 쌓이므로, 여기서 먼저 빠져나가면 에픽 유물을 영영 안 산다.
    if (kind === 'relic') {
      var ek = epicTilt(S);
      if (ek && EPIC[ek].relic.indexOf(x) >= 0) return 14 + 14 * epicProg(S, ek).p;
    }
    var tk = tiltAt(S); if (!tk) return 0;
    var st = STAGES[tk], g = stageProg(S, tk);
    if (kind === 'card' && g.reel < needAt(S).reel && st.reel.indexOf(x) >= 0) return (5 + 5 * g.p) * TILT_W;
    if (kind === 'relic' && g.relic < needAt(S).relic && st.relic.indexOf(x) >= 0) return 14 + 14 * g.p;
    if (kind === 'script' && g.script < needAt(S).script && st.script(x.effect || {}, x)) return 4 + 4 * g.p;
    return 0;
  }

  // 숙련도에 따라 보상 평가가 흔들린다 — 처음 하는 사람은 좋은 걸 알아보지 못한다
  function noisy(S, v) { return v * (1 + (S.rnd() - 0.5) * 2 * S.sk.rewardNoise); }

  // 극단 성장 — 상한에 닿지 않은 것 중 셋
  function offerGrowth(S) {
    var pool = T.GROWTH.filter(function (g) { return (S.growth[g.id] || 0) < g.max; });
    if (!pool.length) return [];
    return T.pickWeighted(pool, function () { return 1; }, S.rnd, Math.min(3, pool.length));
  }

  // 무엇이 이 빌드에 값이 큰가 — 지금 부족한 것을 크게 본다
  function growthValue(S, w, g) {
    var live = S.scripts.filter(function (s) { return true; }).length;
    if (g.id === 'stage')  return 26 - stageN(S) * 3;              // 칸이 좁을수록 값이 크다
    if (g.id === 'cost')   return 22 + (S.stats.costUsed / Math.max(1, S.stats.costMax) > 0.8 ? 8 : 0);
    if (g.id === 'temp')   return 13 * (S.pol.grab.script || 1);
    if (g.id === 'hand')   return live >= scriptCap(S) - 1 ? 20 : 9;  // 상한에 닿았을 때만
    if (g.id === 'reroll') return 15 * (S.sk.useReroll || 0.5) * 1.6;
    if (g.id === 'cheer')  return S.ch.cheerDmgPer ? 22 : 10;
    if (g.id === 'cast')   return 24;
    return 8;
  }

  function doReward(S, w, nd) {
    if (S.bonusScript) {
      S.bonusScript = 0;
      var bss = offerScripts(S, 3), bb = null, bbv = 0;
      bss.forEach(function (sc) { var v = noisy(S, scriptValue(S, w, sc)); if (v > bbv) { bbv = v; bb = sc; } });
      if (bb) { S.scripts.push(bb); lg(S, 's', '  🎩 난입 보상 대본 「' + bb.name + '」'); }
    }
    // 막 보스를 넘기면 대본과 유물을 함께 준다 — 막의 끝이 보상으로 표시되어야 한다
    if (nd.type === 'boss') {
      var bss = offerScripts(S, 3), bp = null, bpv = 0;
      bss.forEach(function (sc) { var v = noisy(S, scriptValue(S, w, sc)); if (v > bpv) { bpv = v; bp = sc; } });
      if (bp) { S.scripts.push(bp); lg(S, 's', '  🏆 막을 넘겼다 — 대본 「' + bp.name + '」'); }
      var rpool = tiltRelics(S, T.pickWeighted(Object.keys(T.RELICS).filter(function (k) {
        var r2 = T.RELICS[k]; return !r2.dark || (S.asc.level || 0) >= r2.asc;
      }), function (k) { return T.RELICS[k].dark ? 1.8 : 1; }, S.rnd, 2));
      var br = null, brv = -1e9;
      rpool.forEach(function (k) { var v = relicValue(S, w, k); if (v > brv) { brv = v; br = k; } });
      if (br) { takeRelic(S, br); lg(S, 's', '  🏆 유물 ' + T.RELICS[br].name); }
      // 극단 성장 — 셋 중 하나. 성장을 자동으로 주면 런마다 같아진다.
      var go = offerGrowth(S), bg = null, bgv = -1e9;
      go.forEach(function (g) { var v = noisy(S, growthValue(S, w, g)); if (v > bgv) { bgv = v; bg = g; } });
      if (bg) {
        S.growth[bg.id] = (S.growth[bg.id] || 0) + 1;
        lg(S, 's', '  🎪 극단이 자랐다 — ' + bg.icon + ' ' + bg.name + ' (' + bg.desc + ')');
      }
      return;
    }
    if (nd.type === 'elite') {
      // 비극 — 대본을 넓힐지, 극단을 키울지. 둘 중 하나만 가져간다.
      // 성장이 막 보스 2회뿐이라 후반이 얇았다. 중간 관문에도 성장을 둔다.
      var ss = offerScripts(S, 3), bs = null, bv = 0;
      ss.forEach(function (sc) { var v = noisy(S, scriptValue(S, w, sc)); if (v > bv) { bv = v; bs = sc; } });
      var eg = offerGrowth(S).slice(0, 2), eb = null, ebv = -1e9;
      eg.forEach(function (g) { var v = noisy(S, growthValue(S, w, g)); if (v > ebv) { ebv = v; eb = g; } });
      if (eb && ebv > bv * 0.9) {
        S.growth[eb.id] = (S.growth[eb.id] || 0) + 1;
        lg(S, 's', '  🎪 극단이 자랐다 — ' + eb.icon + ' ' + eb.name + ' (' + eb.desc + ')');
        tr(S, 'reward', eb.name);
      } else if (bs) {
        S.scripts.push(bs); lg(S, 's', '  보상 대본 「' + bs.name + '」'); tr(S, 'reward', '대본 「' + bs.name + '」');
      }
      return;
    }
    // 공연 — 배역 3 · 대본 3 을 함께 내밀고 하나만
    var cards = offerCards(S), scripts = offerScripts(S, 3);
    var bc = null, bcv = 0;
    cards.forEach(function (id) { var v = noisy(S, cardValue(S, w, id) * (S.pol.grab.card || 1)); if (v > bcv) { bcv = v; bc = id; } });
    var bs2 = null, bsv = 0;
    scripts.forEach(function (sc) { var v = noisy(S, scriptValue(S, w, sc) * (S.pol.grab.script || 1)); if (v > bsv) { bsv = v; bs2 = sc; } });
    if (bs2 && bsv * 0.55 >= bcv) {
      S.scripts.push(bs2); lg(S, 's', '  보상 대본 「' + bs2.name + '」'); tr(S, 'reward', '대본 「' + bs2.name + '」');
    } else if (bc) {
      S.deck[bc] = (S.deck[bc] || 0) + 1; noteTake(S, bc, 'reward');
      lg(S, 's', '  보상 배역 ' + T.CARDS[bc].name); tr(S, 'reward', '배역 ' + T.CARDS[bc].name);
    } else S.stats.tookNeither = (S.stats.tookNeither || 0) + 1;
  }
  // 무대 카드가 「나왔는데 안 집었나」 「집었는데 딴 데서 빠졌나」를 가른다
  function noteTake(S, id, where) {
    var tk = tiltAt(S); if (!tk) return;
    if (STAGES[tk].reel.indexOf(id) >= 0) S.stats.tiltTake = (S.stats.tiltTake || 0) + 1;
    else S.stats['pass_' + where] = (S.stats['pass_' + where] || 0) + 1;
  }

  function doShop(S, w) {
    // 상점이 후반에 쓸모없어지는지 재려면 방문마다 기록이 필요하다
    var rec = { act: S.act, floor: S.at ? S.at.f + 1 : 0, gold0: S.gold,
                card: 0, script: 0, relic: 0, sold: 0, deck0: deckSize(S) };
    S.stats.shops = S.stats.shops || [];
    S.stats.shops.push(rec);
    S.shopRec = rec;
    sellReels(S, w);                    // 먼저 팔아서 자금을 만든 다음 산다
    var cards = offerCards(S).map(function (id) { return { id: id, cost: Math.round((8 + Math.floor(S.rnd() * 6)) * (S.asc.shopMul || 1)) }; });
    // 1종은 값싼 재료다 — 10골드. 세 칸 전부에서 뽑는다.
    //
    // 「한 칸으로 제한하면 상점의 질문이 살아난다」고 보고 조여봤는데 대가가 컸다:
    // 살아나는 대본이 14/15 → 4/15 로 돌아갔다. 상점 방문이 판당 2.15회뿐이라
    // 노출을 절반으로 줄이면 1종 26종 중 특정 대본이 뜰 기대값이 거의 0 이 된다.
    // 그리고 3칸이 랜덤이라 실제로는 평균 1칸쯤만 1종이다 — 도배되지 않는다.
    var scripts = offerScripts(S, 3, true).map(function (sc) {
      return { sc: sc, cost: Math.round((sc.tier === 'one' ? 10 : 16 + sc.cost * 5) * (S.asc.shopMul || 1)) };
    });
    // 어둠 유물은 재연 단계로 열린다 — 재연이 새 물건을 준다
    var pool2 = Object.keys(T.RELICS).filter(function (k) {
      var r = T.RELICS[k];
      return !r.dark || (S.asc.level || 0) >= r.asc;
    });
    // 유물은 막이 오를수록 비싸다 — 후반에 골드가 남는 것을 막는다
    var rmul = T.CFG.gold.relicActMul[S.act - 1] || 1;
    var relics = tiltRelics(S, T.pickWeighted(pool2, function (k) { return T.RELICS[k].dark ? 1.8 : 1; }, S.rnd, 2))
      .map(function (k) { return { k: k, cost: Math.round(T.RELICS[k].cost * rmul * (S.asc.shopMul || 1)) }; });
    // 대본 승급 — 보유 대본 하나의 코스트를 1 내린다.
    // 대본 상한(7장)과 부딪히지 않는 지출처다. 있는 것을 강하게 하니까.
    var ups = S.scripts.filter(function (sc) { return sc.cost > 1 && !sc.upgraded; })
      .slice(0, 3).map(function (sc) { return { sc: sc, cost: T.CFG.gold.upgrade[S.act - 1] || 32 }; });

    // 유물이 가장 값이 크다 — 규칙을 바꾸니까. 그다음 대본, 배역.
    var guard = 0;
    while (guard++ < 8) {
      var buys = [];
      relics.forEach(function (it, i) {
        if (S.gold >= it.cost) buys.push({ v: relicValue(S, w, it.k), kind: 'r', i: i, it: it });
      });
      scripts.forEach(function (it, i) {
        if (S.gold >= it.cost) buys.push({ v: scriptValue(S, w, it.sc) * 1.0, kind: 's', i: i, it: it });
      });
      cards.forEach(function (it, i) {
        if (S.gold >= it.cost) buys.push({ v: cardValue(S, w, it.id) * 0.9, kind: 'c', i: i, it: it });
      });
      ups.forEach(function (it, i) {
        if (S.gold < it.cost) return;
        // 코스트가 1 줄면 그 대본을 더 자주 낼 수 있다 — 값을 그 차이로 본다
        var raw = scriptRaw(S, w, it.sc), c0 = costOf(S.ch, it.sc);
        buys.push({ v: (raw / Math.max(1, c0 - 1) - raw / c0) * (0.35 + stageProb(it.sc, S.deck)),
                    kind: 'u', i: i, it: it });
      });
      buys.sort(function (a, b) { return b.v - a.v; });
      if (!buys.length || buys[0].v <= 1.5) break;
      // 처음 하는 사람은 계획대로 사지 않는다 — 눈에 띄는 것을 산다
      var b = (S.rnd() < S.sk.shopSmart) ? buys[0] : buys[Math.floor(S.rnd() * buys.length)];
      S.gold -= b.it.cost;
      if (b.kind === 'r') { takeRelic(S, b.it.k); relics.splice(b.i, 1); S.shopRec.relic++; lg(S, 'e', '  🏪 유물 ' + T.RELICS[b.it.k].name); }
      if (b.kind === 's') { S.scripts.push(b.it.sc); scripts.splice(b.i, 1); S.shopRec.script++; lg(S, 'e', '  🏪 대본 「' + b.it.sc.name + '」'); }
      if (b.kind === 'c') { if (deckSize(S) < T.CFG.reelMax) { S.deck[b.it.id] = (S.deck[b.it.id] || 0) + 1; noteTake(S, b.it.id, 'shop'); } else S.stats.reelFull = (S.stats.reelFull || 0) + 1; cards.splice(b.i, 1); S.shopRec.card++; lg(S, 'e', '  🏪 배역 ' + T.CARDS[b.it.id].name); }
      if (b.kind === 'u') {
        var ix = S.scripts.indexOf(b.it.sc);
        // 카탈로그 객체를 그대로 고치면 다른 런까지 오염된다 — 복제해서 바꾼다
        if (ix >= 0) S.scripts[ix] = Object.assign({}, b.it.sc, { cost: b.it.sc.cost - 1, upgraded: 1 });
        ups.splice(b.i, 1); S.shopRec.upgrade = (S.shopRec.upgrade || 0) + 1;
        lg(S, 'e', '  🏪 승급 「' + b.it.sc.name + '」 코스트 ' + b.it.sc.cost + ' → ' + (b.it.sc.cost - 1));
      }
    }
    closeShop(S);
  }

  // 상점을 나갈 때의 잔액 — 골드가 남으면 계획의 재미가 준다
  function closeShop(S) { if (S.shopRec) { S.shopRec.gold1 = S.gold; S.shopRec.deck1 = deckSize(S); S.shopRec = null; } }

  // 릴 판매 — 안 쓰는 배역을 팔아 골드를 만든다. 좁히기가 곧 자금이다.
  // 상점마다 상한이 있어서 릴을 통째로 갈아버리지는 못한다.
  function sellReels(S, w) {
    var G = T.CFG.gold, sold = 0;
    var keep = protectedReel(S);
    while (sold < G.sellMax && deckSize(S) > G.reelMin) {
      var worst = null, wv = 1e9;
      Object.keys(S.deck).forEach(function (id) {
        if (keep.indexOf(id) >= 0) return;
        var v = cardValueDrop(S, w, id);
        if (v < wv) { wv = v; worst = id; }
      });
      // 값이 낮은 칸만 판다. 좁히려는 성향은 더 과감하게 판다.
      if (!worst || wv > 1.6 * S.pol.thin) break;
      S.deck[worst]--; if (!S.deck[worst]) delete S.deck[worst];
      S.gold += G.sell; sold++; if (S.shopRec) S.shopRec.sold++;
      lg(S, 'e', '  🏪 ' + T.CARDS[worst].name + ' 를 팔았다 (+' + G.sell + ' 골드)');
    }
  }

  function cardValueDrop(S, w, id) {
    var d2 = Object.assign({}, S.deck); d2[id]--; if (!d2[id]) delete d2[id];
    var loss = 0;
    S.scripts.forEach(function (sc) {
      loss += (stageProb(sc, S.deck) - stageProb(sc, d2)) * scriptRaw(S, w, sc) * 2.2;
    });
    return loss;
  }

  function relicValue(S, w, k) {
    var base = { drumOpen: 30, stand_in: 24, archive: 10, respin: 14, glass: 12, embers: 12, venom: 12,
                 thorns: 8, mirrorR: 10, improv: 14, encore: 16, candleR: 12, phoenix: 26,
                 // 어둠 유물 — 이득이 크지만 대가가 있다. 봇은 그 대가를 값에 반영한다.
                 darkScript: 26, crackMirror: 14, hungrySeat: 16, tornScript: 12,
                 madBaton: 22, lastActor: 14,
                 emptyHouse: 18, doubleCast: 20, finalCurtain: 24,
                 longBow: 18, encoreCall: 14, bigHouse: 16, quickBow: 12, hotHouse: 20 };
    var v = base[k] || 10;
    if (k === 'thorns' || k === 'mirrorR' || k === 'crackMirror') v *= w.thorns;
    if (k === 'embers' || k === 'madBaton' || k === 'venom') v *= w.status;
    if (k === 'archive' || k === 'tornScript') v *= (S.pol.grab.script || 1);
    if (k === 'madBaton') v *= (w.heal > 0.8 ? 0.6 : 1);        // 회복에 의존하면 손해다
    if (k === 'tornScript') v *= 0.7;                            // 즉석 대본을 잃는다
    if (k === 'emptyHouse') v *= (S.ch.cheerDmgPer ? 0.2 : 1);   // 환호 빌드에는 자살이다
    if (k === 'doubleCast') v *= (S.ch.maxCost >= 5 ? 1.3 : 0.8);// 코스트가 넉넉해야 낸다
    if (k === 'finalCurtain') v *= (w.dmg > 1 ? 1.2 : 0.7);      // 빨리 끝낼 수 있어야 낸다
    if (relicN(S, k)) v *= 0.5;
    v += tiltBonus(S, 'relic', k);
    return v;
  }

  // 유물 획득 — 최대 HP 를 깎는 어둠 유물이 있어서 획득 시점 처리가 필요하다
  function takeRelic(S, k) {
    S.relics.push(k);
    if (k === 'lastActor') {
      var cut = Math.round(S.maxHp * 0.2);
      S.maxHp -= cut; S.hp = Math.min(S.hp, S.maxHp);
      lg(S, 'e', '    🕴 마지막 배우 — 최대 HP −' + cut);
    }
  }

  // ── 사건 ─────────────────────────────────────────────────
  // 봇은 「내주는 것」과 「받는 것」을 값으로 비교한다. 숙련도가 낮으면 잘못 고른다.
  function doEvent(S, w, forceId) {
    var ev = forceId ? T.EVENTS.filter(function (e) { return e.id === forceId; })[0]
                     : T.EVENTS[Math.floor(S.rnd() * T.EVENTS.length)];
    if (!ev) return null;
    var take = eventValue(S, w, ev.id);
    S.stats.events = (S.stats.events || 0) + 1;
    // 사건 판단도 숙련도에 흔들린다 — 처음 하는 사람은 대가를 못 읽는다
    if (noisy(S, take) > 0) { S.stats.eventsTaken = (S.stats.eventsTaken || 0) + 1;
      applyEvent(S, w, ev.id); lg(S, 'e', '  ' + ev.icon + ' ' + ev.name + ' — 받아들였다'); }
    else lg(S, 'e', '  ' + ev.icon + ' ' + ev.name + ' — 지나갔다');
    return ev;
  }

  function eventValue(S, w, id) {
    var hpPart = function (p) { return S.hp * p; };
    if (id === 'ghost')  return S.scripts.length > 4 ? 14 : -6;          // 대본이 많으면 하나쯤
    if (id === 'trunk')  return S.pol.thin >= 1 ? -4 : 5;                // 좁혀둔 릴을 흔들면 손해
    if (id === 'dresser') return S.hp > S.maxHp * 0.6 ? 11 - hpPart(0.12) * 0.35 : -8;
    if (id === 'beggar') return (S.gold < 25 && S.hp > S.maxHp * 0.65) ? 9 - hpPart(0.18) * 0.4 : -7;
    if (id === 'merge')  return deckSize(S) > T.CFG.gold.reelMin + 2 ? 8 : -3;
    if (id === 'burning') return S.scripts.length > 5 ? 7 * w.status : -5;
    if (id === 'invite') return tiltAt(S) ? 34 : 2;      // 무대를 노리는 중이면 가장 값이 크다
    if (id === 'folio')  return 12;                      // 다음 판을 위한 것 — 이 판에는 도움이 안 된다
    return -1;
  }

  function applyEvent(S, w, id) {
    if (id === 'ghost') {
      // 가장 값이 낮은 대본을 넘기고 유물을 받는다
      var worst = null, wv = 1e9;
      S.scripts.forEach(function (sc) { var v = scriptRaw(S, w, sc); if (v < wv) { wv = v; worst = sc; } });
      if (worst) S.scripts = S.scripts.filter(function (x) { return x !== worst; });
      var pool = Object.keys(T.RELICS).filter(function (k) {
        var r = T.RELICS[k]; return !r.dark || (S.asc.level || 0) >= r.asc; });
      var pick = null, pv = -1e9;
      pool.forEach(function (k) { var v = relicValue(S, w, k); if (v > pv) { pv = v; pick = k; } });
      if (pick) { takeRelic(S, pick); lg(S, 'e', '    👻 ' + T.RELICS[pick].name + ' 를 받았다'); }
      return;
    }
    if (id === 'trunk') {
      var ids = Object.keys(T.CARDS).filter(function (k) { return !T.CARDS[k].hidden; });
      for (var i = 0; i < 3; i++) {
        var keys = Object.keys(S.deck);
        if (!keys.length) break;
        var from = keys[Math.floor(S.rnd() * keys.length)];
        var to = ids[Math.floor(S.rnd() * ids.length)];
        S.deck[from]--; if (!S.deck[from]) delete S.deck[from];
        S.deck[to] = (S.deck[to] || 0) + 1;
      }
      lg(S, 'e', '    🧰 릴 3칸이 바뀌었다');
      return;
    }
    if (id === 'dresser') {
      var cut = Math.round(S.maxHp * 0.12);
      S.maxHp -= cut; S.hp = Math.min(S.hp, S.maxHp);
      // 가장 값이 큰 대본의 코스트를 깎는다
      var best = null, bv = -1e9;
      S.scripts.forEach(function (sc) { if (sc.cost <= 1) return;
        var v = scriptRaw(S, w, sc); if (v > bv) { bv = v; best = sc; } });
      if (best) {
        var idx = S.scripts.indexOf(best);
        S.scripts[idx] = Object.assign({}, best, { cost: best.cost - 1, upgraded: 1 });
        lg(S, 'e', '    💄 「' + best.name + '」 코스트 ' + best.cost + ' → ' + (best.cost - 1)
          + ' · 최대 HP −' + cut);
      }
      return;
    }
    if (id === 'beggar') {
      var d = Math.round(S.maxHp * 0.18);
      S.hp -= d; S.gold += 34;
      lg(S, 'e', '    🍞 HP −' + d + ' · 골드 +34');
      return;
    }
    if (id === 'merge') {
      var cands = Object.keys(S.deck).filter(function (k) { return S.deck[k] >= 2; });
      if (!cands.length) return;
      var dkeep = protectedReel(S);
      var worst2 = null, wv2 = 1e9;
      cands.forEach(function (k) {
        if (dkeep.indexOf(k) >= 0) return;
        var v = cardValueDrop(S, w, k); if (v < wv2) { wv2 = v; worst2 = k; }
      });
      var best2 = null, bv2 = -1e9;
      (S.ch.pool || []).forEach(function (k) {
        if (T.CARDS[k].hidden) return;
        var v = cardValue(S, w, k); if (v > bv2) { bv2 = v; best2 = k; }
      });
      if (worst2 && best2) {
        S.deck[worst2] -= 2; if (S.deck[worst2] <= 0) delete S.deck[worst2];
        S.deck[best2] = (S.deck[best2] || 0) + 1;
        lg(S, 'e', '    🎬 ' + T.CARDS[worst2].name + ' 2장 → ' + T.CARDS[best2].name + ' 1장');
      }
      return;
    }
    if (id === 'burning') {
      var w2 = null, wv3 = 1e9;
      S.scripts.forEach(function (sc) { var v = scriptRaw(S, w, sc); if (v < wv3) { wv3 = v; w2 = sc; } });
      if (w2) S.scripts = S.scripts.filter(function (x) { return x !== w2; });
      S.actBurn = (S.actBurn || 0) + 2;             // 이번 막 동안 화상 +2
      lg(S, 'e', '    🔥 「' + (w2 ? w2.name : '') + '」 을 태웠다 — 이번 막 화상 +2');
      return;
    }
    // 🎫 초대장 — 노리는 무대의 미충족 조건 하나를 즉시 채운다.
    // 조건이 누적뿐이면 시간이 곧 조건이라 판마다 속도가 같다(53.2).
    if (id === 'invite') {
      var tk = tiltAt(S); if (!tk) return;
      var st = STAGES[tk], g = stageProg(S, tk), need = needAt(S);
      if (g.relic < need.relic) {
        var want = st.relic.filter(function (k) {
          var rr = T.RELICS[k]; return !relicN(S, k) && (!rr.dark || (S.asc.level || 0) >= rr.asc); });
        if (want.length) { takeRelic(S, want[0]); lg(S, 'e', '    🎫 ' + T.RELICS[want[0]].name); return; }
      }
      if (g.reel < need.reel) {
        var give = need.reel - g.reel, card = st.reel[0];
        for (var q = 0; q < give && deckSize(S) < T.CFG.reelMax; q++) S.deck[card] = (S.deck[card] || 0) + 1;
        lg(S, 'e', '    🎫 ' + T.CARDS[card].name + ' ' + give + '장'); return;
      }
      if (g.script < need.script) {
        var cand = T.SCRIPTS.filter(function (sc) {
          return knownScript(S, sc) && st.script(sc.effect || {}, sc)
              && !S.scripts.some(function (x) { return x.id === sc.id; }); });
        if (cand.length) { S.scripts.push(cand[Math.floor(S.rnd() * cand.length)]);
          lg(S, 'e', '    🎫 대본을 한 권 얻었다'); }
      }
      return;
    }
    // 📜 낡은 대본철 — 아직 못 본 무대 하나를 도감에 등록한다
    if (id === 'folio') {
      if (!S.meta) return;
      var cx = S.meta.codex || (S.meta.codex = {});
      var un = Object.keys(STAGES).filter(function (k) { return !cx[k]; });
      if (un.length) { var pick2 = un[Math.floor(S.rnd() * un.length)];
        cx[pick2] = 1; S.stats.folio = (S.stats.folio || 0) + 1;
        lg(S, 'e', '    📜 ' + STAGES[pick2].icon + ' ' + STAGES[pick2].name + ' 이 도감에 실렸다'); }
      return;
    }
  }

  function doRest(S) {
    if (S.hp < S.maxHp * 0.72) { S.hp = Math.min(S.maxHp, S.hp + S.maxHp * 0.34); lg(S, 'e', '  🕯️ 회복'); }
    else { S.maxHp += 8; S.hp += 8; lg(S, 'e', '  🕯️ 최대 HP +8'); }
  }

  function doForge(S, w) {
    var fkeep = protectedReel(S);
    var cands = Object.keys(S.deck).filter(function (id) {
      return S.deck[id] >= 2 && fkeep.indexOf(id) < 0;
    });
    if (!cands.length) return;
    var worst = null, wv = 1e9;
    cands.forEach(function (id) { var v = cardValueDrop(S, w, id); if (v < wv) { wv = v; worst = id; } });
    if (worst) { S.deck[worst]--; lg(S, 'e', '  ⚒️ ' + T.CARDS[worst].name + ' 2장 → 1장'); }
  }

  // ── 기록 ─────────────────────────────────────────────────
  function lg(S, c, t) { S.log.push({ c: c, t: t }); if (S.log.length > 4000) S.log.shift(); }
  function tr(S, kind, txt) {
    if (!S.trace) return;
    S.trace.push({ kind: kind, txt: txt, logLen: S.log.length,
      snap: {
        hp: S.hp, maxHp: S.maxHp, block: S.block || 0, thorns: S.thorns || 0, gold: S.gold,
        cost: S.cost || 0, maxCost: maxCost(S), turn: S.turn || 0, act: S.act,
        cheer: S.cheer || 0,
        censor: S.censor ? { name: T.CARDS[S.censor.id].name, turns: S.censor.turns } : null,
        sealed: Object.keys(S.sealed || {}).map(function (id) {
          var s = T.SCRIPT_BY_ID[id]; return s ? s.name : id; }),
        intrudeIn: S.intrudeOn ? Math.max(0, S.intrudeOn - (S.turn || 0)) : 0,
        node: S.at ? { f: S.at.f, c: S.at.c, type: S.at.type } : null,
        stage: (S.stage || []).slice(), pos: (S.pos || []).slice(),
        strips: (S.strips || []).map(function (x) { return x.slice(); }),
        foes: (S.foes || []).map(cloneFoe),
        deck: Object.assign({}, S.deck),
        relics: S.relics.slice(),
        scripts: S.scripts.map(function (s) { return { id: s.id, name: s.name, cost: s.cost, tier: s.tier,
          req: T.reqText(s), eff: T.effText(s.effect),
          can: S.stage ? T.canStage(s, S.stage, relicN(S, 'stand_in')) : false }; }),
        temp: (S.temp || []).map(function (s) { return { id: s.id, name: s.name, cost: s.cost, tier: s.tier,
          req: T.reqText(s), eff: T.effText(s.effect), can: true, temp: true }; })
      } });
  }

  // ── 여정 — 한 사람이 여러 판을 반복한다 ───────────────────
  // 로그라이크의 진짜 지표는 한 판의 승률이 아니라 「몇 판째에 처음 이겼나」다.
  // 판 사이에 늘어나는 것: 숙련도 · 해금된 캐릭터 · 재연 단계.
  function career(opt) {
    var rnd = T.rng32((opt.seed | 0) || 1);
    var runsN = opt.runs || 30;
    // 사람마다 재능 상한과 학습 속도가 다르다 — 모두가 숙련자가 되지는 않는다.
    // 학습 속도는 실측 근거가 없는 가정이다. 0.65~1.6 으로 뒀을 때 5판 만에
    // 숙련도가 22% → 65% 로 뛰어서 사람보다 훨씬 빨랐다. 절반으로 낮췄다.
    var ceiling = 0.55 + rnd() * 0.45, learn = 0.3 + rnd() * 0.55;
    // 사람은 그만둔다. 계속 지면 포기하고, 엔딩을 보면 만족하거나 재연을 올린다.
    //   patience    — 연속 패배를 몇 번까지 버티나
    //   persistence — 첫 클리어 뒤에도 계속할 성향
    // 이게 없으면 모두가 관측 창을 끝까지 채워서 「몇 판 만에 떠나는가」를 잴 수 없다.
    var patience = 3 + Math.floor(rnd() * 6), persistence = rnd();
    // 첫 난이도 선택 — 선택창이 「무엇을 하러 왔는가」를 묻고 스토리를 권한다.
    // 전원이 보통에서 시작한다고 두면 83% 가 4판째에 내려갔다. 그건 밸런스가 아니라
    // 기본값 문제였다 — 신규에게 로그라이크 난이도를 기본으로 주고 있었던 것이다.
    // 난이도는 시작할 때 한 번 고르고 여정 내내 바뀌지 않는다 — 세이브가 다르다.
    var startsOnStory = rnd() < (opt.storyFirst == null ? 0.6 : opt.storyFirst);
    var e = 0, unlocked = {}, tried = {}, out = [];
    var asc = 0, diff = opt.diffKey || (startsOnStory ? 'story' : 'normal'), firstClear = null, clears = 0;
    var streak = 0, stopAt = null, stopWhy = null, firstNormal = null, droppedAt = null;
    // 판 사이에 남는 것 — 이게 「다음 판을 할 이유」다
    // 도감만은 계정 공유다. 조각·복원·재연·해금은 난이도 세이브 안에 갇히지만,
    // 도감은 「이 무대가 존재한다는 지식」이지 능력치가 아니다(65.5).
    var meta = { floors: 0, seen: {}, vault: [], shards: 0, owned: [], souls: {},
                 codex: opt.codex || {}, known: opt.known || {} };
    Object.keys(T.CHARS).forEach(function (k) { if (T.CHARS[k].start) unlocked[k] = 1; });
    var PKs = Object.keys(POLICIES), fav = PKs[Math.floor(rnd() * PKs.length)];

    for (var i = 1; i <= runsN; i++) {
      var sk = skillMix(Math.min(ceiling, e));
      var pool = Object.keys(unlocked);
      var fresh = pool.filter(function (k) { return !tried[k]; });
      // 새로 열린 캐릭터는 써 보고 싶어진다 — 해금이 다음 판의 이유가 된다
      var ck = (fresh.length && rnd() < 0.72) ? fresh[Math.floor(rnd() * fresh.length)]
                                             : pool[Math.floor(rnd() * pool.length)];
      tried[ck] = 1;
      var pk = rnd() < 0.28 ? PKs[Math.floor(rnd() * PKs.length)] : fav;
      var playedDiff = diff, playedAsc = asc;   // 기록은 실제로 플레이한 난이도로 남긴다
      var runSeed = ((opt.seed | 0) + i * 104729) | 0;
      // 시작 릴의 카드는 이미 손에 쥐고 시작하므로 아는 것으로 친다
      Object.keys(T.CHARS[ck].deck).forEach(function (c) { meta.known[c] = 1; });
      var r = run({ seed: runSeed, charKey: ck, diffKey: diff, known: meta.known,
                    policyKey: pk, skillObj: sk, asc: asc, meta: meta,
                    stages: opt.stages, snap: opt.snap });
      var newUnlock = 0;
      Object.keys(r.feat || {}).forEach(function (k) {
        if (T.CHARS[k] && !unlocked[k]) { unlocked[k] = 1; newUnlock++; }
      });

      // 이 판이 남기는 대본 조각 — 죽어도 남는다
      var stageDone = false, epicDone = false, newStage = 0, newEpic = 0;
      (r.stats.snap || []).forEach(function (sn) {
        if (!sn.stages) return;
        Object.keys(STAGES).forEach(function (k) {
          if (!sn.stages[k].done) return;
          stageDone = true;
          if (!meta.codex[k]) { meta.codex[k] = 1; newStage = 1; }   // 도감에 처음 들어온다
        });
        if (sn.stages._epic) Object.keys(EPIC).forEach(function (k) {
          if (!sn.stages._epic[k].done) return;
          epicDone = true;
          if (!meta.codex['e:' + k]) { meta.codex['e:' + k] = 1; newEpic = 1; }
        });
      });
      var firstSoul = r.won && !meta.souls[ck];
      if (firstSoul) meta.souls[ck] = 1;
      var gained = T.shardsFor({ floor: r.floor, bossKills: r.stats.bossKills || 0,
                                 stageDone: stageDone, epicDone: epicDone, firstSoul: firstSoul });
      meta.shards += gained;
      meta.floors += r.floor;

      // 살 수 있는 것이 있으면 산다 — 싼 것부터. 사람은 눈앞의 것을 먼저 연다.
      var newPremiere = 0, guard2 = 0;
      while (guard2++ < 10) {
        var nx = T.nextRestore(meta.owned, meta.shards);
        if (!nx || meta.shards < nx.cost) break;
        meta.shards -= nx.cost; meta.owned.push(nx.id); newPremiere = 1;
      }
      var afterP = T.restored(meta.owned);
      Object.keys(r.seenIds || {}).forEach(function (k) { meta.seen[k] = 1; });
      Object.keys(r.knownCards || {}).forEach(function (k) { meta.known[k] = 1; });
      if (r.relics.length) {
        // 그 판에서 가장 값이 큰 유물 하나가 창고에 남는다
        var keep = r.relics[0];
        if (meta.vault.indexOf(keep) < 0) {
          if (meta.vault.length < afterP.vault) meta.vault.push(keep);
          else meta.vault[Math.floor(rnd() * meta.vault.length)] = keep;
        }
      }
      // 깊게 간 판이 더 가르치고, 이긴 판이 가장 많이 가르친다
      e += learn * (0.045 + (r.floor / 12) * 0.055 + (r.won ? 0.11 : 0));
      if (r.won) {
        clears++;
        if (!firstClear) firstClear = i;
        // 난이도는 여정 내내 고정이다 — 이야기·보통·어려움이 **세이브가 다르다**.
        // 개입 이벤트와 서사가 난이도마다 달라서 중간에 바꿀 수 없다.
        // 예전에는 이야기를 깨면 보통으로 넘어가고, 계속 지면 이야기로 내려갔다.
        // 그건 하나의 진행으로 본 모델이라 지금 구조와 맞지 않는다.
        if (playedDiff === 'normal' && !firstNormal) firstNormal = i;
        // 그 난이도 안에서 재연이 오른다. 보통을 처음 넘기면 재연 1단이 열린다.
        if (playedDiff === 'story') { /* 이야기에는 재연이 없다 — 결말을 보러 온 자리다 */ }
        else asc = Math.min(T.ASCENSION.length, Math.max(playedDiff === 'normal' ? 1 : 0, asc + 1));
      }
      // 관전을 위해 이 판을 재현할 수 있는 값을 전부 남긴다
      out.push({ i: i, char: r.char, charKey: ck, policy: r.policy, policyKey: pk, skill: sk.t,
                 diff: playedDiff, asc: playedAsc, seed: runSeed,
                 won: r.won, floor: r.floor, killedBy: r.killedBy, hp: r.hp, gold: r.gold,
                 deck: r.deck, scripts: r.scripts, relics: r.relics, stats: r.stats, feat: r.feat,
                 unlocked: Object.keys(unlocked).length });

      // 그만두는가
      if (r.won) streak = 0; else streak++;

      // ── 다음 판을 할 이유가 있는가 ──────────────────────
      // 이탈을 그냥 확률로 두면 설계를 재는 게 아니라 내 가정을 재는 것이 된다.
      // 그래서 「새로운 것이 생겼는가」로 묶는다 — 해금 · 초연 기록 · 계승 · 안 써본 캐릭터.
      var novelty = 0;
      if (newUnlock) novelty += 0.30;                                  // 이번 판에 캐릭터가 열렸다
      if (newPremiere) novelty += 0.22;                                // 시작 조건이 자랐다
      if (Object.keys(unlocked).filter(function (k) { return !tried[k]; }).length) novelty += 0.16;
      // 다음 복원이 눈앞이다 — 초연 기록을 조각으로 흡수하면서(61장) afterP.next 가
      // 죽은 분기로 남아 있었다. restored() 에는 next 가 없다.
      var nx2 = T.nextRestore(meta.owned, meta.shards);
      if (nx2 && meta.shards >= nx2.cost * 0.6) novelty += 0.16;
      // 이번 판에 무대나 에픽을 처음 열었다 — 도감에 새 항목이 들어온다
      if (newStage) novelty += 0.26;
      if (newEpic) novelty += 0.30;
      if (meta.vault.length) novelty += 0.08;                          // 계승할 유물이 있다
      // 다음 재연 단에서 어둠 유물이 열린다 — 이게 재연을 올릴 이유다.
      // 이걸 빼두면 「더 아픈 같은 게임」이라 2단 이상 도달이 18% 에서 멈췄다.
      if (firstNormal && Object.keys(T.RELICS).some(function (k) {
        return T.RELICS[k].dark && T.RELICS[k].asc === asc + 1; })) novelty += 0.22;
      novelty = Math.min(0.75, novelty);
      out[out.length - 1].novelty = novelty;

      if (!firstClear) {
        // 첫 클리어 전 — 연속 패배가 인내를 넘으면 떠날 수 있다.
        // 스토리로 내려가 진행 중이면 더 버틴다 (내용을 보고 있으니까)
        var pat = patience * (diff === 'story' ? 2 : 1);
        if (streak >= pat && rnd() < 0.55 * (1 - novelty)) { stopAt = i; stopWhy = '포기'; break; }
      } else {
        // 첫 클리어 후 — 만족하고 떠나거나 계속 올린다.
        // 스토리를 넘긴 것과 보통을 넘긴 것을 같게 보면 안 된다.
        var keep = firstNormal ? 0.45 + persistence * 0.5    // 로그라이크를 이겼다 — 재연이 남았다
                              : 0.72 + persistence * 0.25;   // 이야기만 봤다 — 아직 본편이 남았다
        keep = keep + (1 - keep) * novelty;                  // 새 것이 있으면 남는다
        if (rnd() > keep) { stopAt = i; stopWhy = '만족'; break; }
      }
    }
    return { firstClear: firstClear, firstNormal: firstNormal, droppedAt: droppedAt,
             clears: clears, runs: out,
             played: out.length, stopAt: stopAt, stopWhy: stopWhy || '관측 종료',
             patience: patience, persistence: persistence,
             ceiling: ceiling, learn: learn, endSkill: Math.min(ceiling, e),
             unlocked: Object.keys(unlocked), maxAsc: asc,
             meta: { floors: meta.floors, seen: Object.keys(meta.seen).length, vault: meta.vault.slice(),
                     shards: meta.shards, owned: meta.owned.slice() },
             shards: meta.shards, owned: meta.owned.slice(), codex: Object.keys(meta.codex), known: Object.keys(meta.known),
             premiere: T.restored(meta.owned) };
  }

  // ── 사람이 플레이할 때 쓰는 문 ────────────────────────────
  // play.html 이 이 함수들만 쓴다. 규칙이 한 곳에만 있게 하려는 것이다 —
  // 예전에 play.html 과 balance.html 이 각자 규칙을 들고 있다가 네 번 어긋났다.
  function newRun(opt) {
    var ch = T.CHARS[opt.charKey];
    var rnd = T.rng32((opt.seed | 0) || 1);
    var S = {
      ch: ch, pol: POLICIES[opt.policyKey || 'value'], sk: SKILLS[opt.skillKey || 'expert'],
      diff: T.DIFFICULTY[opt.diffKey || 'normal'], rnd: rnd, act: 1, asc: T.ascend(opt.asc || 0),
      deck: Object.assign({}, ch.deck), gold: T.CFG.gold.start, relics: [],
      maxHp: T.CFG.hpBase + (ch.hpDelta || 0), at: null, cleared: {},
      scripts: T.makeOpeners(ch).map(function (s) {
        return T.SCRIPTS.filter(function (x) { return x.name === s.name; })[0] || s;
      }),
      log: [], trace: null, human: true, feat: {}, growth: {},
      stats: { nodes: 0, turns: 0, ampTurns: 0, playable: 0, playableOf: 0, temp: 0,
               costUsed: 0, costMax: 0, plays: 0, rerolls: 0, byTier: {}, byScript: {}, fights: 0 }
    };
    S.hp = S.maxHp;
    S.map = makeMap(rnd);
    S.w = makePlayer(S.pol, ch, S.sk, rnd);
    return S;
  }

  // 막이 오르면 배우가 자란다
  function goTo(S, nd) {
    S.at = nd; S.cleared[nd.f + ',' + nd.c] = 1;
    var a2 = Math.min(3, Math.floor(nd.f / T.CFG.actLen) + 1);
    while (a2 > S.act) {
      S.act++; S.maxHp += T.CFG.hpPerAct; S.hp += T.CFG.hpPerAct;
      lg(S, 's', '── 제' + S.act + '막 — 최대 HP +' + T.CFG.hpPerAct + ' ──');
    }
    S.act = a2; S.stats.nodes++;
  }

  // 전투를 열기만 한다. 턴 진행은 사람이 한다.
  function openFight(S, nd) {
    S.stats.fights++;
    S.block = 0; S.thorns = 0; S.turn = 0; S.revived = false; S.over = false;
    S.sealed = {}; S.censor = null; S.maxPlay = 0;
    S.stageDoneCache = null;      // 무대 완성 여부는 전투마다 다시 본다 —
                                  // 판 초반에 한 번 캐시되면 완성해도 영영 false 로 남는다
    // 환호는 전투가 끝나도 남는다. 막이 바뀔 때만 초기화된다 (goTo 에서).
    if (S.cheer == null) S.cheer = (S.ch.cheerStart || 0) + (S.growth.cheer || 0) * 25;
    // 관객의 요구는 큰 무대에서만 — 판마다 걸면 배경음이 된다 (판당 19회였다).
    // 비극과 주연에서만 걸어 특별한 자리로 남긴다.
    S.fThorns = 0;
    S.curtainIn = (S.curtainNext || []).slice();   // 지난 무대를 닫은 대본들
    S.curtainNext = [];
    S.demand = (nd.type === 'elite' || nd.type === 'boss') ? nextDemand({}, ctxOf(S, S.w)) : null;
    if (S.demand) S.stats.demandOffer = (S.stats.demandOffer || 0) + 1;
    S.lastPlay = null; S.repeatN = 0; S.usedF = {};
    S.fightAoeOnly = 1; S.fightAnyDmg = 0; S.fightTempPlays = 0;
    if (relicN(S, 'hungrySeat')) S.hp -= 5;   // 어둠 유물 — 무대에 오르는 대가
    S.foes = pickFoes(S, nd).map(function (b) {
      if (b.boss && S.asc.bossExtra) {
        var learn = (T.BOSS_LEARN[b.name] || []).slice(0, S.asc.bossExtra);
        if (learn.length) {
          b = Object.assign({}, b);
          learn.forEach(function (l) {
            Object.keys(l).forEach(function (k) {
              if (k === 'adds') b.adds = (b.adds || []).concat(l.adds); else b[k] = l[k];
            });
          });
        }
      }
      return T.makeEnemy(b, S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1),
        S.diff.atkMul * (T.CFG.actAtk[S.act - 1] || 1));
    });
    S.foes.slice().forEach(function (f) {
      (f.adds || []).forEach(function (a) {
        S.foes.push(T.makeEnemy(Object.assign({ act: S.act }, a),
          S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1),
          S.diff.atkMul * (T.CFG.actAtk[S.act - 1] || 1)));
      });
      if (f.gimCd) f.gimT = f.gimCd;
      if (f.seizeCd) f.seizeT = f.seizeCd;
    });
    // 잡몹 기믹은 무리에서 한 마리만 발동한다.
    // 기믹은 단독 보스를 상정하고 만들었는데 4마리가 각자 들고 있으면 4중으로 터진다 —
    // 「박수치는 관객」 4마리가 재연을 네 번 하면서 2막 최다 학살자가 됐다.
    var gimSeen = {};
    S.foes.forEach(function (f) {
      if (f.boss || !f.gimmick) return;
      if (gimSeen[f.gimmick]) { f.gimmick = null; f.gimT = null; }
      else gimSeen[f.gimmick] = 1;
    });
    // 적의 다음 대사를 미리 정한다 — 보여줄 수 있어야 퍼즐이 된다
    S.foes.forEach(function (f) { if (!f.next) f.next = T.pickIntent(f, S.rnd); });
    S.curser = S.foes.filter(function (f) { return f.curse; })[0] || null;
    S.strips = []; for (var si = 0; si < T.CFG.stageMax; si++) S.strips.push(T.buildStrip(S.deck, S.rnd));
    S.cast = pickCast(S, S.w);   // 전투 전 캐스팅
    S.cast2 = S.growth.cast ? pickCast(S, S.w, S.cast) : null;
    S.intrudeQ = queueIntruders(S, nd); S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
    lg(S, 't', '── ' + S.foes[0].name + (S.foes.length > 1 ? ' ×' + S.foes.length : '')
      + (S.foes[0].demands ? ' (요구: ' + S.foes[0].demands + ')' : '') + ' ──');
  }

  // 턴 시작 — 무대가 자동으로 올라간다
  function beginTurn(S) {
    S.turn++; S.stats.turns++;
    S.cost = maxCost(S); S.stats.costMax += S.cost;
    S.freeReroll = (S.ch.freeReroll || 0) + (S.growth.reroll || 0);
    S.tHits = 0; S.tPlays = 0; S.tBlock = 0; S.tHeal = 0; S.tSelf = 0;
    if (relicN(S, 'darkScript')) S.hp -= 2;
      if (S.bleed > 0) { var bk = Math.round(S.bleed); S.hp = Math.min(S.maxHp, S.hp + bk); S.bleed = 0;
        if (bk > 0) lg(S, 's', '  🩸 태운 피 ' + bk + ' 이 돌아왔다'); }   // 어둠 유물 — 각본이 피를 먹는다
    var ctx = ctxOf(S, S.w);
    if (S.curser && S.curser.hp > 0) sowCurse(S);
    if (S.intrudeQ.length) {
      if (S.turn === S.intrudeQ[0].on - 1) lg(S, 'e', '  🚪 무대 뒤에서 소리가 난다 — 다음 턴 누군가 난입한다');
      while (S.intrudeQ.length && S.turn >= S.intrudeQ[0].on) {
        var ent = S.intrudeQ.shift();
        var iv = T.makeEnemy(Object.assign({ act: S.act }, ent.who),
          S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1),
          S.diff.atkMul * (T.CFG.actAtk[S.act - 1] || 1));
        if (iv.gimCd) iv.gimT = iv.gimCd;
        if (iv.seizeCd) iv.seizeT = iv.seizeCd;
        iv.next = T.pickIntent(iv, S.rnd);
        S.foes.push(iv); S.intruderIdx = S.foes.length - 1;
        lg(S, 'e', '  ' + (ent.who.icon || '🎩') + ' ' + iv.name + ' 이 난입했다 — ' + (ent.who.demands || ''));
      }
      S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
    }
    autoSpin(S);
    var rp = 1 - Math.pow(0.9, relicN(S, 'respin'));
    if (rp > 0 && S.rnd() < rp) { autoSpin(S); lg(S, 'e', '  🔄 무대를 다시 올렸다'); }
    S.temp = instantScripts(S, ctx);
    if (S.turn === 1 && S.curtainIn.length) {
      S.curtainIn.forEach(function (id) {
        var sc = T.SCRIPT_BY_ID[id];
        if (sc) S.temp.unshift(Object.assign({}, sc, { temp: true, curtain: true, cost: 0 }));
      });
      lg(S, 's', '  🎭 커튼콜 — ' + S.curtainIn.map(function (id) {
        return '「' + (T.SCRIPT_BY_ID[id] || {}).name + '」'; }).join(' '));
    }
    lg(S, 't', '턴 ' + S.turn + ' 무대 — ' + S.stage.map(function (x) { return T.CARDS[x].name; }).join(' · '));
    S.stats.playable += S.scripts.filter(function (s) {
      return T.canStage(s, S.stage, ctx.relax) && !S.sealed[s.id]; }).length;
    S.stats.playableOf += S.scripts.length;
  }

  function canPlay(S, sc) {
    var ctx = ctxOf(S, S.w);
    if (sc.curtain) return true;              // 커튼콜은 무대 조건도 코스트도 없다
    return !S.sealed[sc.id] && costOf(S.ch, sc) <= S.cost && T.canStage(sc, S.stage, ctx.relax);
  }

  // 대본 한 장을 상연한다 — 봇과 사람이 같은 함수를 쓴다
  function playScript(S, sc, tgt) {
    if (!canPlay(S, sc)) return null;
    var ctx = ctxOf(S, S.w);
    var aliveBefore = S.foes.filter(function (f) { return f.hp > 0; }).length;
    var C = { hp: S.hp, maxHp: S.maxHp, block: S.block, thorns: S.thorns, cost: S.cost,
              gold: S.gold, foes: S.foes, dead: false, ampHit: 0,
              cheer: S.cheer, lastPlay: S.lastPlay, repeatN: S.repeatN, maxPlay: S.maxPlay, bleed: S.bleed || 0,
                  demand: S.demand, tHits: S.tHits || 0, tPlays: S.tPlays || 0, tBlock: S.tBlock || 0,
                  tHeal: S.tHeal || 0, tSelf: S.tSelf || 0, fThorns: S.fThorns || 0,
                  usedF: S.usedF || (S.usedF = {}) };
    var ev = applyPlay(C, sc, tgt == null ? -1 : tgt, ctx);
    S.hp = C.hp; S.block = C.block; S.thorns = C.thorns; S.cost = C.cost; S.gold = C.gold;
    S.cheer = C.cheer; S.lastPlay = C.lastPlay; S.repeatN = C.repeatN; S.maxPlay = C.maxPlay;
        S.bleed = C.bleed || 0;
        S.tHits = C.tHits; S.tPlays = C.tPlays; S.tBlock = C.tBlock; S.tHeal = C.tHeal; S.tSelf = C.tSelf;
        S.lastId = C.lastId;
        if (C.demand !== S.demand) {
          lg(S, 's', '  🎯 관객이 만족했다 — 환호 +' + T.DEMAND_CHEER
            + ' · 다음 요구 ' + (C.demand ? C.demand.icon + ' ' + C.demand.name : ''));
          S.stats.demandDone = (S.stats.demandDone || 0) + 1;
          S.demand = C.demand;
        }
        S.usedF = C.usedF || S.usedF;
    if (C.ovation) S.stats.ovations = (S.stats.ovations || 0) + 1;
    if (C.ampHit) S.ampTurn = 1;
    S.stats.plays++;
    S.stats.byTier[sc.tier] = (S.stats.byTier[sc.tier] || 0) + 1;
    S.stats.byScript[sc.name] = (S.stats.byScript[sc.name] || 0) + 1;
    if (sc.temp) { var ti = S.temp.indexOf(sc); if (ti >= 0) S.temp.splice(ti, 1); }
    lg(S, 's', '  상연 「' + sc.name + '」 ' + T.effText(sc.effect));
    ev.forEach(function (t) { lg(S, 'a', '    ' + t); });
    watchFeats(S, sc, aliveBefore);
    if (S.hp <= 0 && !revive(S)) { S.over = 'dead'; return ev; }
    if (!S.foes.some(function (f) { return f.hp > 0; })) { winFight(S); S.over = 'won'; }
    return ev;
  }

  function doReroll(S, k) {
    var free = S.freeReroll > 0;
    if (!free && S.cost < 1) return false;
    if (free) S.freeReroll--; else S.cost -= 1;
    S.stats.rerolls++;
    var st = S.strips[k], i = Math.floor(S.rnd() * st.length);
    S.pos[k] = i; S.stage[k] = st[i];
    if (S.censor && S.censor.turns > 0 && S.stage[k] === S.censor.id) S.stage[k] = 'void';
    S.temp = instantScripts(S, ctxOf(S, S.w));
    lg(S, 'e', '  🔁 릴 ' + (k + 1) + ' 재굴림 → ' + T.CARDS[S.stage[k]].name + (free ? ' (무료)' : ' (코스트 1)'));
    return true;
  }

  // 턴 종료 — 'won' / 'dead' / null
  function finishTurn(S) {
    if (S.ampTurn) { S.stats.ampTurns++; S.ampTurn = 0; }
    S.stats.costUsed += maxCost(S) - S.cost;
    var r = endTurn(S, S.w);
    if (!r) return null;
    S.over = r.won ? 'won' : 'dead';
    S.killedBy = r.killedBy;
    return S.over;
  }

  // 봇이 이번 턴에 둘 수를 돌려준다 — 사람이 「추천」으로 볼 수도 있다
  function suggest(S) { return planTurn(S, ctxOf(S, S.w)); }

  root.Sim = {
    run: run, career: career, skillMix: skillMix,
    POLICIES: POLICIES, SKILLS: SKILLS, stageProb: stageProb, NK: NK, mergeW: mergeW,
    STAGES: STAGES, stageProg: stageProg, tiltAt: tiltAt, stageTune: stageTune,
    EPIC: EPIC, epicProg: epicProg, epicTilt: epicTilt,
    needAt: needAt, epicNeedAt: epicNeedAt,
    // 사람 플레이용
    newRun: newRun, goTo: goTo, openFight: openFight, beginTurn: beginTurn,
    playScript: playScript, canPlay: canPlay, doReroll: doReroll, finishTurn: finishTurn,
    suggest: suggest, handOf: handOf, applyEvent: applyEvent, doEvent: doEvent,
    takeRelic: takeRelic, reachable: reachable, maxCost: maxCost, scriptCap: scriptCap,
    costOf: costOf,
    relicN: relicN, deckSize: deckSize, offerCards: offerCards, offerScripts: offerScripts,
    scriptValue: scriptValue, cardValue: cardValue, ctxOf: ctxOf, drift: drift
  };
  if (typeof module !== 'undefined') module.exports = root.Sim;
})(typeof window !== 'undefined' ? window : global);
