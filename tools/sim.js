// ── The Last Theater — 플레이어 시뮬레이터 ──────────────────────
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
      doom: f.doom, doomMax: f.doomMax, curse: f.curse, boss: f.boss,
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
      cheer: S.cheer || 0, lastPlay: S.lastPlay, repeatN: S.repeatN || 0, maxPlay: S.maxPlay || 0,
      usedF: Object.assign({}, S.usedF || {}) };
  }

  // ── 코스트 ────────────────────────────────────────────────
  // 캐릭터가 코스트를 바꿀 수 있으니 한 곳에서만 계산한다.
  // 「악장」은 악상이 아닌 대본에 +1 을 낸다 — 전문화의 대가다.
  function costOf(ch, sc) {
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
    if (ctx.embers && T.scriptFam(sc) === 'score' && acc.burn) acc.burn += 2 * ctx.embers;
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

    // 어둠 유물 — 상태이상 2배 / 회복 절반
    if (ctx.statusMul > 1) { acc.burn *= ctx.statusMul; acc.poison *= ctx.statusMul; acc.slow *= ctx.statusMul; }
    if (ctx.healMul != null && ctx.healMul !== 1) acc.heal *= ctx.healMul;
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
      var burn2 = acc.selfDmg * ctx.ch.selfToDmg;
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

    if (acc.dmg > 0) {
      var amp = T.ampMul(t0, {});
      var d = T.damageEnemy(t0, acc.dmg * gm(t0), { single: true, pierce: acc.pierce, rnd: ctx.rnd });
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
    var kills = alive.length - C.foes.filter(function (f) { return f.hp > 0; }).length;
    // 처형에 성공하면 태운 피가 절반 돌아온다 — 자해를 「죽이는 데」 쓰게 만든다
    if (kills > 0 && ctx.ch.selfRefund && acc.selfDmg > 0) {
      var back = Math.round(acc.selfDmg * ctx.ch.selfRefund);
      C.hp = Math.min(C.maxHp, C.hp + back);
      ev.push('🩸 처형 — 태운 피 ' + back + ' 회수');
    }
    if (!ctx.noCheer) {
      var need = ctx.cheerNeed ? Math.min(ctx.cheerNeed, ctx.cheerMax || T.CHEER.max)
                               : (ctx.cheerMax || T.CHEER.max);
      cheerFor(C, sc, kills, ev, need, ctx.ovation, ctx.repeatMul, ctx.ch.freshBonus || 0);
    }
    return ev;
  }

  // ── 관중 ─────────────────────────────────────────────────
  // 크게 가면 환호가 오르고, 같은 대본을 반복하면 식는다.
  // 계획 탐색과 실제 진행이 같은 함수를 쓴다 — 그래서 봇이 환호를 계산에 넣는다.
  function cheerFor(C, sc, kills, ev, cap, ova, repMul, fresh) {
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
    if (C.lastPlay === sc.id) { C.repeatN = (C.repeatN || 0) + 1; d += CH.repeat * C.repeatN * (repMul || 1); }
    else { C.lastPlay = sc.id; C.repeatN = 0; }
    C.cheer = Math.max(0, Math.min(cap, (C.cheer || 0) + d));
    if (C.cheer >= cap) {
      var gain = ova || CH.ovation;
      C.cheer = 0; C.cost += gain; C.ovation = 1;
      if (ev) ev.push('👏 기립 박수 — 코스트 +' + gain);
    }
  }

  // ── 이번 턴에 들어올 피해 추정 ────────────────────────────
  function incoming(C) {
    var inc = 0;
    C.foes.forEach(function (f) {
      if (f.hp <= 0) return;
      if (f.t - 1 > 0) return;                 // 이 턴에 행동하지 않는다
      var atkW = 0, tot = 0;
      f.intents.forEach(function (it) {
        var w = it[1] || 1; tot += w;
        if (it[0] === 'attack') atkW += w * f.atk;
        else if (it[0] === 'doubleStrike') atkW += w * f.atk * 2;
        else if (it[0] === 'attackBleed' || it[0] === 'attackBurn') atkW += w * (f.atk + f.dotVal);
      });
      inc += tot ? atkW / tot : f.atk;
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
          if (!T.canStage(sc, S.stage, ctx.relax)) return;
          var eff = T.scriptEffect(sc, ctx.ch);
          var tgts = eff.dmg > 0 ? nd.C.foes.map(function (f, i) { return f.hp > 0 ? i : -9; })
                                             .filter(function (i) { return i >= 0; }) : [-1];
          if (!tgts.length) tgts = [-1];
          tgts.forEach(function (tg) {
            var C = { hp: nd.C.hp, maxHp: nd.C.maxHp, block: nd.C.block, thorns: nd.C.thorns,
                      cost: nd.C.cost, gold: nd.C.gold, foes: nd.C.foes.map(cloneFoe), dead: false,
                      cheer: nd.C.cheer, lastPlay: nd.C.lastPlay, repeatN: nd.C.repeatN,
                      maxPlay: nd.C.maxPlay, usedF: Object.assign({}, nd.C.usedF || {}) };
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
    var hand = handOf(S), useCnt = [0, 0, 0, 0];
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
      log: [], trace: opt.trace ? [] : null, feat: {},
      stats: { nodes: 0, turns: 0, ampTurns: 0, playable: 0, playableOf: 0, temp: 0,
               costUsed: 0, costMax: 0, plays: 0, rerolls: 0, byTier: {}, byScript: {}, fights: 0 }
    };
    S.hp = S.maxHp;
    S.map = makeMap(rnd);
    S.w = makePlayer(pol, ch, sk, rnd);
    var w = S.w;
    S.meta = opt.meta || null;
    applyMeta(S, w);

    var guard = 0;
    while (guard++ < 400) {
      var nd = chooseNode(S, pol);
      if (!nd) break;
      S.at = nd; S.cleared[nd.f + ',' + nd.c] = 1;
      var act2 = nd.f < 4 ? 1 : (nd.f < 8 ? 2 : 3);
      // 막이 오르면 배우가 자란다. CFG.hpPerAct 가 정의만 되고 적용되지 않아
      // 3막에서 HP 60 으로 공격 31 을 받고 있었다.
      while (act2 > S.act) {
        S.act++; S.maxHp += T.CFG.hpPerAct; S.hp += T.CFG.hpPerAct;
        lg(S, 's', '── 제' + S.act + '막 — 최대 HP +' + T.CFG.hpPerAct + ' ──');
      }
      S.act = act2;
      S.stats.nodes++;
      tr(S, 'node', NK[nd.type] + ' (' + (nd.f + 1) + '층)');
      if (nd.type === 'shop') { doShop(S, w); drift(S); continue; }
      if (nd.type === 'rest') { doRest(S); continue; }
      if (nd.type === 'forge') { doForge(S, w); continue; }
      if (nd.type === 'event') { doEvent(S, w); drift(S); continue; }
      var r = fight(S, w, nd);
      if (!r.won) return finish(S, false, r.killedBy);
      if (nd.type === 'boss') return finish(S, true, null);
      doReward(S, w, nd);
      drift(S);
    }
    return finish(S, false, '길이 끊겼다');
  }

  function finish(S, won, killedBy) {
    var st = S.stats;
    return { won: won, killedBy: killedBy, char: S.ch.name, charKey: keyOf(T.CHARS, S.ch),
      policy: S.pol.name, skill: S.sk.name, w: S.w, feat: S.feat, seenIds: S.seenIds || {},
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
    var p = T.premiereAt(m.floors || 0);
    S.premiere = p;

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
  // 중복 금지가 공연 비중을 눌러서(40% → 33%) 가중치를 올렸다
  var MAP_W = { fight: 52, elite: 15, shop: 13, rest: 9, forge: 7, event: 11 };
  var MAP_MIN = { shop: 2, elite: 2, event: 2 };

  function makeMap(rnd) {
    var floors = [], prev = {};
    for (var f = 0; f < 12; f++) {
      var n = (f === 0 || f === 11 || f === 10) ? 1 : (rnd() < 0.45 ? 2 : 3);
      var row = [], used = {};
      for (var c = 0; c < n; c++) {
        var t;
        if (f === 11) t = 'boss';
        else if (f === 10) t = 'rest';                       // ⑤ 보스 직전
        else if (f === 0) t = 'fight';                       // ③
        else if (f === 1) {
          // 2층도 중복 검사를 해야 한다 — 안 하면 「공연 공연 공연」이 나온다
          var k1 = ['fight', 'event', 'forge'].filter(function (k) { return k === 'fight' || !used[k]; });
          t = T.pickWeighted(k1.length ? k1 : ['fight'],
            function (k) { return k === 'fight' ? 70 : k === 'event' ? 20 : 10; }, rnd, 1)[0];
        }
        else {
          var keys = Object.keys(MAP_W).filter(function (k) {
            if (used[k] && k !== 'fight') return false;       // ①
            if (k === 'elite' && f < 3) return false;        // ④
            if (k === 'rest' && f < 4) return false;
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
    // ⑥ 최소 개수 보정 — 공연 칸을 바꿔서 채운다
    Object.keys(MAP_MIN).forEach(function (k) {
      var have = 0;
      floors.forEach(function (row) { row.forEach(function (nd) { if (nd.type === k) have++; }); });
      var guard = 0;
      while (have < MAP_MIN[k] && guard++ < 40) {
        var f2 = 2 + Math.floor(rnd() * 8), row2 = floors[f2];
        var cand = row2.filter(function (nd) {
          return nd.type === 'fight' && !row2.some(function (x) { return x.type === k; });
        });
        if (!cand.length) continue;
        cand[Math.floor(rnd() * cand.length)].type = k; have++;
      }
    });
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
    if (f >= 12) return null;
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
    if (nd.type === 'boss') return [T.ENEMIES.filter(function (e) { return e.act === 3 && e.boss; })[0]];
    var base = pool[Math.floor(S.rnd() * pool.length)];
    // 비극(엘리트)은 막 보스를 다시 쓰지 않는다 — 2층에 기믹 보스가 나오면 온보딩이 끊긴다.
    // 대신 「난입이 확정된 공연」이다. 위험의 형태가 보스가 아니라 난입이다.
    if (nd.type === 'elite') {
      var n2 = base.solo ? 1 : Math.min(2, base.maxCount || 2);
      var out2 = []; for (var j = 0; j < n2; j++) out2.push(base);
      return out2;
    }
    var cap = Math.min(base.maxCount || 3, nd.f < 1 ? 1 : (nd.f < 4 ? 2 : 3));
    var n = base.solo ? 1 : Math.min(1 + Math.floor(S.rnd() * cap), cap);
    var out = []; for (var i = 0; i < n; i++) out.push(base);
    return out;
  }

  // 해금 관찰 — 상연 한 번마다
  function watchFeats(S, sc, aliveBefore) {
    if (!S.feat) S.feat = {};
    if (!S.seenIds) S.seenIds = {};
    S.seenIds[sc.id] = 1;                       // 대본 서고에 남는다
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

  // 난입 예약 — 비극은 반드시 하나, 공연은 확률. 승천이 확률과 인원을 올린다.
  function queueIntruders(S, nd) {
    if (nd.type === 'boss') return [];
    var pool = T.INTRUDERS.filter(function (x) { return !x.asc || S.asc.intrudeNew >= x.asc; });
    var q = [];
    if (nd.type === 'elite') {
      q.push({ who: pool[Math.floor(S.rnd() * pool.length)], on: 2 });
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
      embers: relicN(S, 'embers'), encore: relicN(S, 'encore'), actBurn: S.actBurn || 0,
      thornCap: T.CFG.thornCap * (S.ch.thornsMul || 1) + relicN(S, 'thorns') * 8
                + relicN(S, 'crackMirror') * 12,
      blockCapPct: T.CFG.blockCapPct * (relicN(S, 'crackMirror') ? 0.8 : 1),
      statusMul: relicN(S, 'madBaton') ? 2 : 1,
      healMul: relicN(S, 'madBaton') ? 0.5 : 1,
      ovation: T.CHEER.ovation + relicN(S, 'lastActor') * 2 + (S.ch.ovationBonus || 0),
      cheerNeed: S.ch.cheerNeed || null,
      repeatMul: S.ch.repeatMul || 1,
      cheerW: S.ch.cheerW || 1,
      noCheer: relicN(S, 'emptyHouse') ? 1 : 0,
      finalCurtain: relicN(S, 'finalCurtain') ? 1 : 0,
      overflowMul: (S.ch.overflowMul || 1) * (relicN(S, 'mirrorR') ? 2 : 1) };
  }
  function maxCost(S) {
    return Math.max(1, S.ch.maxCost + relicN(S, 'drumOpen') + relicN(S, 'darkScript')
                       - relicN(S, 'doubleCast'));
  }
  function scriptCap(S) {
    return 8 + (S.ch.handBonus || 0) + relicN(S, 'archive') * 3 + relicN(S, 'tornScript') * 4;
  }

  function fight(S, w, nd) {
    S.stats.fights++;
    S.block = 0; S.thorns = 0; S.turn = 0; S.revived = false;
    S.sealed = {}; S.censor = null; S.maxPlay = 0;
    S.foes = pickFoes(S, nd).map(function (b) {
      // 승천 — 보스가 기믹을 하나씩 더 배운다. 수치가 아니라 규칙이 늘어난다.
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
      return T.makeEnemy(b, S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1), S.diff.atkMul);
    });
    // 보스의 동반자는 전투 시작과 함께 무대에 선다
    S.foes.slice().forEach(function (f) {
      (f.adds || []).forEach(function (a) {
        S.foes.push(T.makeEnemy(Object.assign({ act: S.act }, a),
          S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1), S.diff.atkMul));
      });
      if (f.gimCd) f.gimT = f.gimCd;
      if (f.seizeCd) f.seizeT = f.seizeCd;
    });
    S.curser = S.foes.filter(function (f) { return f.curse; })[0] || null;
    S.strips = [0, 1, 2, 3].map(function () { return T.buildStrip(S.deck, S.rnd); });
    S.cheer = S.ch.cheerStart || 0; S.lastPlay = null; S.repeatN = 0; S.usedF = {};
    S.fightAoeOnly = 1; S.fightAnyDmg = 0; S.fightTempPlays = 0;
    S.ovations = 0;
    if (relicN(S, 'hungrySeat')) S.hp -= 5;   // 어둠 유물 — 무대에 오르는 대가
    var ctx = ctxOf(S, w);
    lg(S, 't', '── ' + S.foes[0].name + (S.foes.length > 1 ? ' ×' + S.foes.length : '')
      + (S.foes[0].demands ? ' (요구: ' + S.foes[0].demands + ')' : '') + ' ──');

    // 난입 — 공연에서는 확률로, 비극에서는 확정으로. 한 턴 미리 예고한다.
    S.intrudeQ = queueIntruders(S, nd);
    S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
    S.stats.intrusions = (S.stats.intrusions || 0) + S.intrudeQ.length;

    while (S.turn < 60) {
      S.turn++; S.stats.turns++;
      S.cost = maxCost(S);
      S.stats.costMax += S.cost;
      if (relicN(S, 'darkScript')) S.hp -= 2;
      if (S.curser && S.curser.hp > 0) sowCurse(S);

      // 난입 — 예고한 턴에 무대로 뛰어든다
      if (S.intrudeQ.length) {
        if (S.turn === S.intrudeQ[0].on - 1) lg(S, 'e', '  🚪 무대 뒤에서 소리가 난다 — 다음 턴 누군가 난입한다');
        while (S.intrudeQ.length && S.turn >= S.intrudeQ[0].on) {
          var ent = S.intrudeQ.shift();
          var iv = T.makeEnemy(Object.assign({ act: S.act }, ent.who), S.diff.hpMul, S.diff.atkMul);
          if (iv.gimCd) iv.gimT = iv.gimCd;
          if (iv.seizeCd) iv.seizeT = iv.seizeCd;
          S.foes.push(iv); S.intruderIdx = S.foes.length - 1;
          lg(S, 'e', '  ' + (ent.who.icon || '🎩') + ' ' + iv.name + ' 이 난입했다 — ' + (ent.who.demands || ''));
          tr(S, 'intrude', iv.name + ' 난입');
        }
        S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
      }
      autoSpin(S);
      var rp = 1 - Math.pow(0.9, relicN(S, 'respin'));
      if (rp > 0 && S.rnd() < rp) { autoSpin(S); lg(S, 'e', '  🔄 무대를 다시 올렸다'); }
      S.temp = instantScripts(S, ctx);
      lg(S, 't', '턴 ' + S.turn + ' 무대 — ' + S.stage.map(function (x) { return T.CARDS[x].name; }).join(' · '));
      tr(S, 'spin', '턴 ' + S.turn + ' 무대');

      var live = S.scripts.filter(function (s) { return T.canStage(s, S.stage, ctx.relax); }).length;
      S.stats.playable += live; S.stats.playableOf += S.scripts.length; S.stats.temp += S.temp.length;

      // 계획 → 필요하면 재굴림 → 다시 계획
      var plan = planTurn(S, ctx);
      var rer = 0, free = S.ch.freeReroll || 0;
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
        if (!T.canStage(a.sc, S.stage, ctx.relax)) continue;
        if (S.sealed[a.sc.id]) continue;
        var aliveBefore = S.foes.filter(function (f) { return f.hp > 0; }).length;
        var C = { hp: S.hp, maxHp: S.maxHp, block: S.block, thorns: S.thorns, cost: S.cost,
                  gold: S.gold, foes: S.foes, dead: false, ampHit: 0,
                  cheer: S.cheer, lastPlay: S.lastPlay, repeatN: S.repeatN, maxPlay: S.maxPlay,
                  usedF: S.usedF || (S.usedF = {}) };
        var ev = applyPlay(C, a.sc, a.tgt, ctx);
        S.hp = C.hp; S.block = C.block; S.thorns = C.thorns; S.cost = C.cost; S.gold = C.gold;
        S.cheer = C.cheer; S.lastPlay = C.lastPlay; S.repeatN = C.repeatN; S.maxPlay = C.maxPlay;
        S.usedF = C.usedF || S.usedF;
        if (C.ovation) S.stats.ovations = (S.stats.ovations || 0) + 1;
        if (C.ampHit) ampTurn = 1;
        S.stats.plays++;
        S.stats.byTier[a.sc.tier] = (S.stats.byTier[a.sc.tier] || 0) + 1;
        S.stats.byScript[a.sc.name] = (S.stats.byScript[a.sc.name] || 0) + 1;
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
    var idx = [], line = [];
    for (var k = 0; k < 4; k++) {
      var st = S.strips[k], i = Math.floor(S.rnd() * st.length);
      idx.push(i); line.push(st[i]);
    }
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
    return out.slice(0, 3);
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
    if (S.turn >= stallAt) {
      S.foes.forEach(function (f) { if (f.hp > 0) f.atk = Math.ceil(f.atk * (1 + T.CFG.stallAtkPer)); });
      S.hp -= S.asc.stallDmg;
      S.cheer = Math.max(0, S.cheer + T.CHEER.coolPerTurn);
      if (S.turn === stallAt) lg(S, 'e', '  😠 관객이 야유한다 — 이제 매 턴 적이 세진다');
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
      var it = T.pickIntent(f, S.rnd);
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
      lg(S, 'd', '  ' + f.name + ' ' + T.INTENT_KO[it] + ' ' + inc + (ab ? ' (방어 ' + Math.round(ab) + ')' : ''));
      if (S.thorns) {
        var rd = S.ch.thornsIgnoreDef ? S.thorns
               : Math.max(0, S.thorns - f.def * T.AMP.thornsDefPart);
        if (f.block > 0) { var rb = Math.min(f.block, rd); f.block -= rb; rd -= rb; }
        f.hp -= rd; if (rd > 0) lg(S, 'b', '    반사 ' + Math.round(rd));
      }
    });
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
    S.gold += g;
    if (!S.feat) S.feat = {};
    if (S.hp <= S.maxHp * 0.25) S.feat.fallen = 1;              // 벼랑에서 이겨낸다
    if (S.fightAoeOnly && S.fightAnyDmg) S.feat.frenzy = 1;     // 광역만으로 끝낸다
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
    if (deckSize(S) >= T.CFG.reelMax) v = -1;
    return v;
  }

  function scriptRaw(S, w, sc) {
    var e = T.scriptEffect(sc, S.ch);
    return e.dmg * w.dmg + e.aoe * 1.45 * w.aoe + e.block * 0.62 * w.block + e.heal * 0.72
      + (e.burn * 2.1 + e.poison * 2.4 + e.slow * 4.4) * w.status
      + e.thorns * 1.25 * w.thorns * (S.ch.thornsMul || 1)
      - e.selfDmg * (S.ch.ignoreSelfDmg ? 0 : 1.3);
  }

  function scriptValue(S, w, sc) {
    if (S.scripts.some(function (x) { return x.id === sc.id; })) return -1;
    if (costOf(S.ch, sc) > maxCost(S)) return -1;
    var raw = scriptRaw(S, w, sc) / costOf(S.ch, sc);
    var p = stageProb(sc, S.deck);
    var v = raw * (0.35 + p);                     // 상연 확률이 낮으면 값이 깎인다
    v *= T.scriptWeight(S.ch, sc) >= 4 ? 1.15 : 1;
    if (S.scripts.length >= scriptCap(S)) v = -1;
    return v;
  }

  function offerCards(S) {
    var pool = Object.keys(T.CARDS).filter(function (id) { return !T.CARDS[id].hidden; });
    return T.pickWeighted(pool, function (id) {
      return (S.ch.pool || []).indexOf(id) >= 0 ? 3 : 1;
    }, S.rnd, 3);
  }
  function offerScripts(S, n) {
    var owned = {}; S.scripts.forEach(function (s) { owned[s.id] = 1; });
    var pool = T.SCRIPTS.filter(function (s) { return !owned[s.id] && s.tier !== 'one'; });
    var seen = (S.meta && S.meta.seen) || {};
    // 대본 서고 — 예전 판에서 상연해 본 대본이 더 자주 뜬다. 덱을 이어서 만들어가는 감각.
    return T.pickWeighted(pool, function (sc) {
      return T.scriptWeight(S.ch, sc) * (seen[sc.id] ? T.ARCHIVE_MUL : 1);
    }, S.rnd, n);
  }

  // 숙련도에 따라 보상 평가가 흔들린다 — 처음 하는 사람은 좋은 걸 알아보지 못한다
  function noisy(S, v) { return v * (1 + (S.rnd() - 0.5) * 2 * S.sk.rewardNoise); }

  function doReward(S, w, nd) {
    if (S.bonusScript) {
      S.bonusScript = 0;
      var bss = offerScripts(S, 3), bb = null, bbv = 0;
      bss.forEach(function (sc) { var v = noisy(S, scriptValue(S, w, sc)); if (v > bbv) { bbv = v; bb = sc; } });
      if (bb) { S.scripts.push(bb); lg(S, 's', '  🎩 난입 보상 대본 「' + bb.name + '」'); }
    }
    if (nd.type === 'elite') {
      // 비극 — 대본 3 중 하나 (여기서만 3종이 잘 나온다)
      var ss = offerScripts(S, 3), bs = null, bv = 0;
      ss.forEach(function (sc) { var v = noisy(S, scriptValue(S, w, sc)); if (v > bv) { bv = v; bs = sc; } });
      if (bs) { S.scripts.push(bs); lg(S, 's', '  보상 대본 「' + bs.name + '」'); tr(S, 'reward', '대본 「' + bs.name + '」'); }
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
      S.deck[bc] = (S.deck[bc] || 0) + 1;
      lg(S, 's', '  보상 배역 ' + T.CARDS[bc].name); tr(S, 'reward', '배역 ' + T.CARDS[bc].name);
    }
  }

  function doShop(S, w) {
    sellReels(S, w);                    // 먼저 팔아서 자금을 만든 다음 산다
    var cards = offerCards(S).map(function (id) { return { id: id, cost: 8 + Math.floor(S.rnd() * 6) }; });
    var scripts = offerScripts(S, 3).map(function (sc) { return { sc: sc, cost: 16 + sc.cost * 5 }; });
    // 어둠 유물은 승천 단계로 열린다 — 승천이 새 물건을 준다
    var pool2 = Object.keys(T.RELICS).filter(function (k) {
      var r = T.RELICS[k];
      return !r.dark || (S.asc.level || 0) >= r.asc;
    });
    var relics = T.pickWeighted(pool2, function (k) { return T.RELICS[k].dark ? 1.8 : 1; }, S.rnd, 2)
      .map(function (k) { return { k: k, cost: T.RELICS[k].cost }; });

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
      buys.sort(function (a, b) { return b.v - a.v; });
      if (!buys.length || buys[0].v <= 1.5) break;
      // 처음 하는 사람은 계획대로 사지 않는다 — 눈에 띄는 것을 산다
      var b = (S.rnd() < S.sk.shopSmart) ? buys[0] : buys[Math.floor(S.rnd() * buys.length)];
      S.gold -= b.it.cost;
      if (b.kind === 'r') { takeRelic(S, b.it.k); relics.splice(b.i, 1); lg(S, 'e', '  🏪 유물 ' + T.RELICS[b.it.k].name); }
      if (b.kind === 's') { S.scripts.push(b.it.sc); scripts.splice(b.i, 1); lg(S, 'e', '  🏪 대본 「' + b.it.sc.name + '」'); }
      if (b.kind === 'c') { if (deckSize(S) < T.CFG.reelMax) S.deck[b.it.id] = (S.deck[b.it.id] || 0) + 1; cards.splice(b.i, 1); lg(S, 'e', '  🏪 배역 ' + T.CARDS[b.it.id].name); }
    }
  }

  // 릴 판매 — 안 쓰는 배역을 팔아 골드를 만든다. 좁히기가 곧 자금이다.
  // 상점마다 상한이 있어서 릴을 통째로 갈아버리지는 못한다.
  function sellReels(S, w) {
    var G = T.CFG.gold, sold = 0;
    while (sold < G.sellMax && deckSize(S) > G.reelMin) {
      var worst = null, wv = 1e9;
      Object.keys(S.deck).forEach(function (id) {
        var v = cardValueDrop(S, w, id);
        if (v < wv) { wv = v; worst = id; }
      });
      // 값이 낮은 칸만 판다. 좁히려는 성향은 더 과감하게 판다.
      if (!worst || wv > 1.6 * S.pol.thin) break;
      S.deck[worst]--; if (!S.deck[worst]) delete S.deck[worst];
      S.gold += G.sell; sold++;
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
    var base = { drumOpen: 30, stand_in: 24, archive: 10, respin: 14, glass: 12, embers: 12,
                 thorns: 8, mirrorR: 10, improv: 14, encore: 16, candleR: 12, phoenix: 26,
                 // 어둠 유물 — 이득이 크지만 대가가 있다. 봇은 그 대가를 값에 반영한다.
                 darkScript: 26, crackMirror: 14, hungrySeat: 16, tornScript: 12,
                 madBaton: 22, lastActor: 14,
                 emptyHouse: 18, doubleCast: 20, finalCurtain: 24 };
    var v = base[k] || 10;
    if (k === 'thorns' || k === 'mirrorR' || k === 'crackMirror') v *= w.thorns;
    if (k === 'embers' || k === 'madBaton') v *= w.status;
    if (k === 'archive' || k === 'tornScript') v *= (S.pol.grab.script || 1);
    if (k === 'madBaton') v *= (w.heal > 0.8 ? 0.6 : 1);        // 회복에 의존하면 손해다
    if (k === 'tornScript') v *= 0.7;                            // 즉석 대본을 잃는다
    if (k === 'emptyHouse') v *= (S.ch.cheerDmgPer ? 0.2 : 1);   // 환호 빌드에는 자살이다
    if (k === 'doubleCast') v *= (S.ch.maxCost >= 5 ? 1.3 : 0.8);// 코스트가 넉넉해야 낸다
    if (k === 'finalCurtain') v *= (w.dmg > 1 ? 1.2 : 0.7);      // 빨리 끝낼 수 있어야 낸다
    if (relicN(S, k)) v *= 0.5;
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
    // 사건 판단도 숙련도에 흔들린다 — 처음 하는 사람은 대가를 못 읽는다
    if (noisy(S, take) > 0) { applyEvent(S, w, ev.id); lg(S, 'e', '  ' + ev.icon + ' ' + ev.name + ' — 받아들였다'); }
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
      var worst2 = null, wv2 = 1e9;
      cands.forEach(function (k) { var v = cardValueDrop(S, w, k); if (v < wv2) { wv2 = v; worst2 = k; } });
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
  }

  function doRest(S) {
    if (S.hp < S.maxHp * 0.72) { S.hp = Math.min(S.maxHp, S.hp + S.maxHp * 0.25); lg(S, 'e', '  🕯️ 회복'); }
    else { S.maxHp += 8; S.hp += 8; lg(S, 'e', '  🕯️ 최대 HP +8'); }
  }

  function doForge(S, w) {
    var cands = Object.keys(S.deck).filter(function (id) { return S.deck[id] >= 2; });
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
  // 판 사이에 늘어나는 것: 숙련도 · 해금된 캐릭터 · 승천 단계.
  function career(opt) {
    var rnd = T.rng32((opt.seed | 0) || 1);
    var runsN = opt.runs || 30;
    // 사람마다 재능 상한과 학습 속도가 다르다 — 모두가 숙련자가 되지는 않는다.
    // 학습 속도는 실측 근거가 없는 가정이다. 0.65~1.6 으로 뒀을 때 5판 만에
    // 숙련도가 22% → 65% 로 뛰어서 사람보다 훨씬 빨랐다. 절반으로 낮췄다.
    var ceiling = 0.55 + rnd() * 0.45, learn = 0.3 + rnd() * 0.55;
    // 사람은 그만둔다. 계속 지면 포기하고, 엔딩을 보면 만족하거나 승천을 올린다.
    //   patience    — 연속 패배를 몇 번까지 버티나
    //   persistence — 첫 클리어 뒤에도 계속할 성향
    // 이게 없으면 모두가 관측 창을 끝까지 채워서 「몇 판 만에 떠나는가」를 잴 수 없다.
    var patience = 3 + Math.floor(rnd() * 6), persistence = rnd();
    // 첫 난이도 선택 — 선택창이 「무엇을 하러 왔는가」를 묻고 스토리를 권한다.
    // 전원이 보통에서 시작한다고 두면 83% 가 4판째에 내려갔다. 그건 밸런스가 아니라
    // 기본값 문제였다 — 신규에게 로그라이크 난이도를 기본으로 주고 있었던 것이다.
    var startsOnStory = rnd() < (opt.storyFirst == null ? 0.6 : opt.storyFirst);
    var e = 0, unlocked = {}, tried = {}, out = [];
    var asc = 0, diff = startsOnStory ? 'story' : 'normal', firstClear = null, clears = 0;
    var streak = 0, stopAt = null, stopWhy = null, firstNormal = null, droppedAt = null;
    // 판 사이에 남는 것 — 이게 「다음 판을 할 이유」다
    var meta = { floors: 0, seen: {}, vault: [] };
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
      var r = run({ seed: runSeed, charKey: ck, diffKey: diff,
                    policyKey: pk, skillObj: sk, asc: asc, meta: meta });
      var newUnlock = 0;
      Object.keys(r.feat || {}).forEach(function (k) {
        if (T.CHARS[k] && !unlocked[k]) { unlocked[k] = 1; newUnlock++; }
      });

      // 이 판의 흔적을 남긴다 — 층수 · 상연한 대본 · 유물
      var beforeP = T.premiereAt(meta.floors);
      meta.floors += r.floor;
      var afterP = T.premiereAt(meta.floors);
      var newPremiere = (afterP.swap > beforeP.swap || afterP.script > beforeP.script
                      || afterP.vault > beforeP.vault) ? 1 : 0;
      Object.keys(r.seenIds || {}).forEach(function (k) { meta.seen[k] = 1; });
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
        if (playedDiff === 'story') diff = 'normal';          // 이야기를 봤으니 로그라이크로
        else if (playedDiff === 'normal') {
          // 보통을 넘기면 곧바로 승천 1단이 열린다. 「어려움을 또 이겨야 승천」이었을 때
          // 승천 도달이 0.49단에 머물렀다 — 관문이 두 개였다.
          if (!firstNormal) firstNormal = i;
          diff = 'hard'; asc = Math.max(1, asc);
        } else asc = Math.min(T.ASCENSION.length, asc + 1);
      } else if (!firstClear && diff === 'normal' && streak >= 2 && rnd() < 0.45) {
        // 계속 지면 난이도를 내린다. 이 행동이 없으면 스토리 난이도가 아무 역할도 하지 않는다.
        diff = 'story'; if (!droppedAt) droppedAt = i;
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
      if (afterP.next) {                                               // 다음 기록이 눈앞이다
        var need = afterP.next.at - meta.floors;
        if (need <= 12) novelty += 0.14;
      }
      if (meta.vault.length) novelty += 0.08;                          // 계승할 유물이 있다
      // 다음 승천 단에서 어둠 유물이 열린다 — 이게 승천을 올릴 이유다.
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
        var keep = firstNormal ? 0.45 + persistence * 0.5    // 로그라이크를 이겼다 — 승천이 남았다
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
             meta: { floors: meta.floors, seen: Object.keys(meta.seen).length, vault: meta.vault.slice() },
             premiere: T.premiereAt(meta.floors) };
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
      log: [], trace: null, human: true, feat: {},
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
    var a2 = nd.f < 4 ? 1 : (nd.f < 8 ? 2 : 3);
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
    S.cheer = S.ch.cheerStart || 0; S.lastPlay = null; S.repeatN = 0; S.usedF = {};
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
      return T.makeEnemy(b, S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1), S.diff.atkMul);
    });
    S.foes.slice().forEach(function (f) {
      (f.adds || []).forEach(function (a) {
        S.foes.push(T.makeEnemy(Object.assign({ act: S.act }, a),
          S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1), S.diff.atkMul));
      });
      if (f.gimCd) f.gimT = f.gimCd;
      if (f.seizeCd) f.seizeT = f.seizeCd;
    });
    S.curser = S.foes.filter(function (f) { return f.curse; })[0] || null;
    S.strips = [0, 1, 2, 3].map(function () { return T.buildStrip(S.deck, S.rnd); });
    S.intrudeQ = queueIntruders(S, nd); S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
    lg(S, 't', '── ' + S.foes[0].name + (S.foes.length > 1 ? ' ×' + S.foes.length : '')
      + (S.foes[0].demands ? ' (요구: ' + S.foes[0].demands + ')' : '') + ' ──');
  }

  // 턴 시작 — 무대가 자동으로 올라간다
  function beginTurn(S) {
    S.turn++; S.stats.turns++;
    S.cost = maxCost(S); S.stats.costMax += S.cost;
    S.freeReroll = S.ch.freeReroll || 0;
    if (relicN(S, 'darkScript')) S.hp -= 2;   // 어둠 유물 — 각본이 피를 먹는다
    var ctx = ctxOf(S, S.w);
    if (S.curser && S.curser.hp > 0) sowCurse(S);
    if (S.intrudeQ.length) {
      if (S.turn === S.intrudeQ[0].on - 1) lg(S, 'e', '  🚪 무대 뒤에서 소리가 난다 — 다음 턴 누군가 난입한다');
      while (S.intrudeQ.length && S.turn >= S.intrudeQ[0].on) {
        var ent = S.intrudeQ.shift();
        var iv = T.makeEnemy(Object.assign({ act: S.act }, ent.who),
          S.diff.hpMul * (T.CFG.actHp[S.act - 1] || 1), S.diff.atkMul);
        if (iv.gimCd) iv.gimT = iv.gimCd;
        if (iv.seizeCd) iv.seizeT = iv.seizeCd;
        S.foes.push(iv); S.intruderIdx = S.foes.length - 1;
        lg(S, 'e', '  ' + (ent.who.icon || '🎩') + ' ' + iv.name + ' 이 난입했다 — ' + (ent.who.demands || ''));
      }
      S.intrudeOn = S.intrudeQ.length ? S.intrudeQ[0].on : 0;
    }
    autoSpin(S);
    var rp = 1 - Math.pow(0.9, relicN(S, 'respin'));
    if (rp > 0 && S.rnd() < rp) { autoSpin(S); lg(S, 'e', '  🔄 무대를 다시 올렸다'); }
    S.temp = instantScripts(S, ctx);
    lg(S, 't', '턴 ' + S.turn + ' 무대 — ' + S.stage.map(function (x) { return T.CARDS[x].name; }).join(' · '));
    S.stats.playable += S.scripts.filter(function (s) {
      return T.canStage(s, S.stage, ctx.relax) && !S.sealed[s.id]; }).length;
    S.stats.playableOf += S.scripts.length;
  }

  function canPlay(S, sc) {
    var ctx = ctxOf(S, S.w);
    return !S.sealed[sc.id] && costOf(S.ch, sc) <= S.cost && T.canStage(sc, S.stage, ctx.relax);
  }

  // 대본 한 장을 상연한다 — 봇과 사람이 같은 함수를 쓴다
  function playScript(S, sc, tgt) {
    if (!canPlay(S, sc)) return null;
    var ctx = ctxOf(S, S.w);
    var aliveBefore = S.foes.filter(function (f) { return f.hp > 0; }).length;
    var C = { hp: S.hp, maxHp: S.maxHp, block: S.block, thorns: S.thorns, cost: S.cost,
              gold: S.gold, foes: S.foes, dead: false, ampHit: 0,
              cheer: S.cheer, lastPlay: S.lastPlay, repeatN: S.repeatN, maxPlay: S.maxPlay,
                  usedF: S.usedF || (S.usedF = {}) };
    var ev = applyPlay(C, sc, tgt == null ? -1 : tgt, ctx);
    S.hp = C.hp; S.block = C.block; S.thorns = C.thorns; S.cost = C.cost; S.gold = C.gold;
    S.cheer = C.cheer; S.lastPlay = C.lastPlay; S.repeatN = C.repeatN; S.maxPlay = C.maxPlay;
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
