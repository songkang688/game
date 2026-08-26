/**
 * 花园守卫 1.2(第 13 步 · A 档)回归测试。
 *
 * 分七块:
 *  1. 塔体系:五大定位齐全、支援塔真的在加成、克制关系表自洽;
 *  2. 无支配塔:「去一留全」与「只留一种」两套模拟给出的结论;
 *  3. 敌人四类原型 + boss 变体;
 *  4. 固定步长:2× 与 1× 结果必须一模一样;
 *  5. 无尽「守到底」:可复现、越往后越难、经济追不上血量;
 *  6. 360px 布局:HUD 一行不溢出、塔条横滑、图标 ≥ 44px、放置非法给得出原因;
 *  7. 手感与红线:弹开+星星、花瓣飞走、元气条不用红、destroy 归零。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEVELS,
  MONSTER_INFO,
  MonsterKind,
  TOWER_INFO,
  TOWER_KINDS,
  TowerKind,
  chimeAffects,
  chimeRangeBonus,
  chimeRateBonus,
  combineChime,
  effectiveRange,
  sellRefund,
  towerCooldown,
  towersUnlockedAt,
  upgradeCost,
} from "./logic";
import {
  ARCHETYPE_LABEL,
  CORE_ARCHETYPES,
  COUNTER_TABLE,
  REQUIRED_ROLES,
  TOWER_ROLE,
  archetypeBosses,
  chimeLevelsAt,
  counterLine,
  counterRow,
  counterScore,
  counterScoreAgainst,
  enemyArchetypes,
  enemiesOfArchetype,
  supportedCooldown,
  supportedRange,
  towersOfRole,
} from "./towers12";
import {
  EARLY_CALL_MAX_BONUS,
  MAX_STEPS_PER_FRAME,
  PREWAVE_SECONDS,
  SPEED_STEP,
  accumulateSteps,
  earlyCallBonus,
  totalSteps,
  waveArchetypeHints,
  waveHasBoss,
  waveHintLine,
  wavePreview,
  wavePreviewLine,
} from "./wave12";
import {
  ENDLESS_BOSS_EVERY,
  ENDLESS_BOSS_ROTATION,
  ENDLESS_HEARTS,
  ENDLESS_MAX_BATCH,
  endlessBatchCount,
  endlessBossKind,
  endlessBudget,
  endlessKillReward,
  endlessLevelIndex,
  endlessPressure,
  endlessResultLine,
  endlessRewardIndex,
  endlessWave,
  endlessWaveHp,
  endlessWaveName,
  isEndlessBossWave,
} from "./endless";
import {
  HUD_MIN_FONT,
  TOWER_ICON_MIN,
  clampScroll,
  estimateTextWidth,
  hudLayout,
  hudSegments,
  placementIssue,
  placementReason,
  scrollToCard,
  towerBarLayout,
  towerCardX,
} from "./hud12";
import {
  CLEAR_PETALS,
  HIT_STARS,
  KNOCK_DIST,
  KNOCK_TIME,
  clearPetal,
  energyColor,
  hitStar,
  knockOffset,
  shakeAmount,
} from "./fx12";
import { dominanceReport, dominantTower, dominanceSpread, simulateEndless, simulateLevel, soloReport, speedsAgree } from "./sim";
import guide from "./guide";
import { meta } from "./meta";

/** 抽样关卡:横跨十三章,含新塔解锁前后与三个规格点名的关号。 */
const SAMPLE_LEVELS = [4, 20, 40, 60, 80, 98, 105, 120, 130, 144, 160, 187];

describe("garden-guard 1.2 · 塔体系", () => {
  it("五大定位(单体/溅射/减速/支援/穿透)每个都至少有一座塔", () => {
    for (const role of REQUIRED_ROLES) {
      expect(towersOfRole(role).length, `${role} 缺塔`).toBeGreaterThan(0);
    }
  });

  it("每座塔都归了定位,没有漏网的", () => {
    for (const kind of TOWER_KINDS) {
      expect(TOWER_ROLE[kind], `${kind} 没定位`).toBeTruthy();
    }
    expect(TOWER_KINDS.length).toBeGreaterThanOrEqual(5);
  });

  it("支援塔铃兰铃:加成随等级递增,自己不吃自己的加成", () => {
    expect(TOWER_ROLE.chime).toBe("support");
    expect(chimeRateBonus(2)).toBeGreaterThan(chimeRateBonus(1));
    expect(chimeRangeBonus(3)).toBeGreaterThan(chimeRangeBonus(1));
    expect(chimeAffects("chime")).toBe(false);
    expect(chimeAffects("sunny")).toBe(false);
    expect(chimeAffects("bubble")).toBe(true);
  });

  it("多座铃兰叠加有收益但收益递减,不会叠出无限攻速", () => {
    const one = combineChime([3]);
    const three = combineChime([3, 3, 3]);
    expect(three.rate).toBeGreaterThan(one.rate);
    expect(three.rate).toBeLessThan(one.rate * 3);
  });

  it("被铃兰罩住的塔:装弹更快、射程更远;没罩住的一点没变", () => {
    const base = towerCooldown("needle", 1);
    expect(supportedCooldown("needle", 1, [2])).toBeLessThan(base);
    expect(supportedCooldown("needle", 1, [])).toBe(base);
    const baseRange = supportedRange("needle", 1, undefined, []);
    expect(supportedRange("needle", 1, undefined, [2])).toBeGreaterThan(baseRange);
    // 经济塔不吃加成:它本来就不打人
    expect(supportedCooldown("sunny", 1, [3])).toBe(towerCooldown("sunny", 1));
  });

  it("铃兰的覆盖范围按射程算,超出就不算,自己那格也不算", () => {
    const towers = [
      { kind: "chime" as TowerKind, col: 2, row: 2, level: 1 },
      { kind: "chime" as TowerKind, col: 9, row: 9, level: 3 },
    ];
    const reach = effectiveRange("chime", 1, undefined);
    expect(chimeLevelsAt(2 + Math.floor(reach), 2, towers, undefined).length).toBeLessThanOrEqual(1);
    expect(chimeLevelsAt(3, 2, towers, undefined)).toEqual([1]);
    expect(chimeLevelsAt(2, 2, towers, undefined)).toEqual([]);
    expect(chimeLevelsAt(0, 0, towers, undefined)).toEqual([]);
  });

  it("退款规则清楚:退六成、升过级退得更多、永远不超过投入", () => {
    for (const kind of TOWER_KINDS) {
      const spent1 = TOWER_INFO[kind].cost;
      const spent2 = spent1 + upgradeCost(kind, 1);
      expect(sellRefund(kind, 1)).toBeLessThanOrEqual(spent1);
      expect(sellRefund(kind, 2)).toBeLessThanOrEqual(spent2);
      expect(sellRefund(kind, 2)).toBeGreaterThanOrEqual(sellRefund(kind, 1));
      expect(sellRefund(kind, 1)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("garden-guard 1.2 · 克制关系表", () => {
  it("每个原型都写明了克星,克星和苦手不重叠", () => {
    for (const row of COUNTER_TABLE) {
      expect(row.good.length, `${row.archetype} 没克星`).toBeGreaterThan(0);
      expect(row.why.length).toBeGreaterThan(10);
      for (const k of row.bad) expect(row.good).not.toContain(k);
    }
  });

  it("六座输出塔每座都至少当过一次谁的克星:没有闲着的塔", () => {
    const stars = new Set<TowerKind>();
    for (const row of COUNTER_TABLE) for (const k of row.good) stars.add(k);
    for (const kind of ["bubble", "needle", "boom", "dew", "frost", "mist"] as TowerKind[]) {
      expect(stars.has(kind), `${kind} 不是任何怪的克星`).toBe(true);
    }
  });

  it("克制分:克星为正、苦手为负、其余为零", () => {
    expect(counterScore("mist", "armored")).toBeGreaterThan(0);
    expect(counterScore("needle", "armored")).toBeLessThan(0);
    expect(counterScore("dew", "swift")).toBeGreaterThan(0);
    expect(counterScore("needle", "flying")).toBeGreaterThan(0);
    expect(counterScore("boom", "splitting")).toBeGreaterThan(0);
    expect(counterScore("bubble", "plain")).toBeGreaterThan(0);
  });

  it("综合克制分把一只怪身上的原型都算进去:云朵怪吃对空、不吃地面溅射", () => {
    expect(counterScoreAgainst("needle", "glidey")).toBeGreaterThan(0);
    expect(counterScoreAgainst("boom", "glidey")).toBeLessThan(0);
    expect(counterScoreAgainst("mist", "shieldy")).toBeGreaterThan(counterScoreAgainst("needle", "shieldy"));
  });

  it("攻略里那句话读得通,而且指名道姓提到了塔", () => {
    for (const row of COUNTER_TABLE) {
      const line = counterLine(row.archetype);
      expect(line).toContain(ARCHETYPE_LABEL[row.archetype]);
      for (const k of row.good) expect(line).toContain(TOWER_INFO[k].name);
    }
    expect(counterRow("armored").archetype).toBe("armored");
  });
});

describe("garden-guard 1.2 · 敌人四类原型与 boss 变体", () => {
  it("护甲 / 迅捷 / 飞行 / 分裂四类都有小怪,也都有 boss", () => {
    for (const a of CORE_ARCHETYPES) {
      expect(enemiesOfArchetype(a).length, `${a} 没小怪`).toBeGreaterThan(0);
      expect(archetypeBosses(a).length, `${a} 没 boss`).toBeGreaterThan(0);
    }
  });

  it("四位原型 BOSS 各自带对的机制,而且都是 boss 体型", () => {
    expect(MONSTER_INFO.bossArmor.armor).toBeGreaterThan(0);
    expect(enemyArchetypes("bossSwift")).toContain("swift");
    expect(MONSTER_INFO.bossFly.flies).toBe(true);
    expect(MONSTER_INFO.bossSplit.splits).toBe(true);
    for (const k of ["bossArmor", "bossSwift", "bossFly", "bossSplit"] as MonsterKind[]) {
      expect(MONSTER_INFO[k].boss).toBe(true);
      expect(MONSTER_INFO[k].hp).toBeGreaterThan(80);
    }
  });

  it("原型分类不会把普通小怪算成特殊怪", () => {
    expect(enemyArchetypes("softy")).toEqual(["plain"]);
    expect(enemyArchetypes("shieldy")).toContain("armored");
    expect(enemyArchetypes("splity")).toContain("splitting");
    expect(enemyArchetypes("flappy")).toContain("flying");
  });
});

describe("garden-guard 1.2 · 无支配塔(模拟证明)", () => {
  const report = dominanceReport(SAMPLE_LEVELS);

  it("抽样至少 10 关,而且每关基准打法都能赢", () => {
    expect(report.length).toBeGreaterThanOrEqual(10);
    for (const r of report) expect(r.baseWin, `L${r.levelIdx + 1} 基准打不过`).toBe(true);
  });

  it("没有任何一座塔在所有关都独占第一:支配塔不存在", () => {
    expect(dominantTower(report)).toBeNull();
  });

  it("「本关最不可替代的塔」在抽样里换过好几种,各有各的舞台", () => {
    expect(dominanceSpread(report).length).toBeGreaterThanOrEqual(4);
  });

  it("最优解不唯一:多数关卡拆掉任意一座塔照样满心通关", () => {
    const multi = report.filter((r) => r.droppable.length >= 2 || r.topKinds.length >= 2);
    expect(multi.length).toBeGreaterThanOrEqual(Math.ceil(report.length / 2));
  });

  it("有的关就是缺了某座塔就守不住:塔不是可有可无的摆设", () => {
    const critical = report.filter((r) => r.margins.some((m) => !m.win));
    expect(critical.length).toBeGreaterThan(0);
  });

  it("「只留一种输出塔」时,没有哪座塔能包打所有抽样关", () => {
    const wins = new Map<TowerKind, number>();
    const seen = new Map<TowerKind, number>();
    for (const idx of [4, 20, 40, 98, 120, 144, 187]) {
      for (const s of soloReport(idx)) {
        seen.set(s.kind, (seen.get(s.kind) ?? 0) + 1);
        if (s.win) wins.set(s.kind, (wins.get(s.kind) ?? 0) + 1);
      }
    }
    for (const [kind, n] of seen) {
      expect(wins.get(kind) ?? 0, `${kind} 一座塔就通吃了`).toBeLessThan(n);
    }
  });
});

describe("garden-guard 1.2 · 波次可解性与固定步长", () => {
  it("规格点名的第 100 / 145 / 188 关都能用固定策略打赢", () => {
    for (const n of [100, 145, 188]) {
      const r = simulateLevel(n - 1);
      expect(r.win, `第 ${n} 关打不过`).toBe(true);
      expect(r.wavesCleared).toBe(LEVELS[n - 1].waves.length);
    }
  });

  it("解锁了铃兰铃之后的关卡照样能赢(新塔没把资源曲线压垮)", () => {
    const withChime = LEVELS.findIndex((l) => l.unlockTower === "chime");
    expect(withChime).toBeGreaterThan(98);
    expect(towersUnlockedAt(withChime, LEVELS)).toContain("chime");
    expect(simulateLevel(withChime).win).toBe(true);
  });

  it("2× 与 1× 结果完全一致:抽查四关每个字段都相同", () => {
    for (const idx of [0, 50, 120, 187]) {
      expect(speedsAgree(idx), `L${idx + 1} 两档速度结果不一致`).toBe(true);
    }
  });

  it("固定步长积分:2× 跑一半真实时间,走的步数和 1× 跑满一样", () => {
    const half = Array.from({ length: 60 }, () => 1 / 60);
    const full = Array.from({ length: 120 }, () => 1 / 60);
    expect(totalSteps(half, 2)).toBe(totalSteps(full, 1));
  });

  it("暂停不走步也不偷偷攒余数,回来接着摆塔不会突然快进", () => {
    const paused = accumulateSteps(0.004, 1 / 60, 0);
    expect(paused.steps).toBe(0);
    expect(paused.carry).toBe(0.004);
  });

  it("切后台回来一次性补太多步会被截断,不会卡死一帧", () => {
    const plan = accumulateSteps(0, 10, 1, SPEED_STEP, MAX_STEPS_PER_FRAME);
    expect(plan.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(plan.clamped).toBe(true);
  });

  it("余数会带到下一帧:碎帧长累计起来一点时间都不丢", () => {
    let carry = 0;
    let steps = 0;
    for (let i = 0; i < 100; i++) {
      const plan = accumulateSteps(carry, 0.007, 1);
      carry = plan.carry;
      steps += plan.steps;
    }
    // 走掉的步长加上还没凑够一步的余数,必须正好等于喂进去的总时间
    expect(steps * SPEED_STEP + carry).toBeCloseTo(0.7, 6);
    expect(carry).toBeLessThan(SPEED_STEP);
  });
});

describe("garden-guard 1.2 · 波次预览与提前召唤", () => {
  const wave = LEVELS[187].waves[0];

  it("预览把同一种怪合并成一格,数量相加,顺序按首次出现", () => {
    const items = wavePreview([
      { kind: "softy", count: 2, gap: 1 },
      { kind: "fasty", count: 3, gap: 1 },
      { kind: "softy", count: 4, gap: 1 },
    ]);
    expect(items.map((i) => i.kind)).toEqual(["softy", "fasty"]);
    expect(items[0].count).toBe(6);
    expect(items[0].emoji.length).toBeGreaterThan(0);
  });

  it("每种怪都配了预览图标,一个都不能缺", () => {
    for (const item of wavePreview(Object.keys(MONSTER_INFO).map((k) => ({ kind: k as MonsterKind, count: 1, gap: 1 })))) {
      expect(item.emoji, `${item.kind} 没图标`).toBeTruthy();
      expect(item.name).toBe(MONSTER_INFO[item.kind].name);
    }
  });

  it("提示语说得出「这波有会飞的」,BOSS 波认得出来", () => {
    const flying = [{ kind: "flappy" as MonsterKind, count: 3, gap: 1 }];
    expect(waveArchetypeHints(flying)).toContain("flying");
    expect(waveHintLine(flying)).toContain(ARCHETYPE_LABEL.flying);
    expect(waveHasBoss([{ kind: "boss13", count: 1, gap: 2 }])).toBe(true);
    expect(waveHasBoss(flying)).toBe(false);
    expect(wavePreviewLine(wave).length).toBeGreaterThan(0);
    expect(waveHintLine([{ kind: "softy", count: 3, gap: 1 }])).toContain("普通");
  });

  it("提前召唤:剩得越多给得越多,时间用完也至少给一片", () => {
    expect(earlyCallBonus(PREWAVE_SECONDS)).toBe(EARLY_CALL_MAX_BONUS);
    expect(earlyCallBonus(0)).toBe(1);
    expect(earlyCallBonus(PREWAVE_SECONDS / 2)).toBeGreaterThan(earlyCallBonus(0.2));
    expect(earlyCallBonus(PREWAVE_SECONDS / 2)).toBeLessThan(EARLY_CALL_MAX_BONUS);
  });
});

describe("garden-guard 1.2 · 无尽「守到底」", () => {
  it("同一个波号永远长一模一样的阵容:成绩可复现", () => {
    for (const n of [1, 7, 20, 33, 50]) {
      expect(endlessWave(n)).toEqual(endlessWave(n));
      expect(JSON.stringify(endlessWave(n))).toBe(JSON.stringify(endlessWave(n)));
    }
  });

  it("每 5 波一位 BOSS,护甲 → 迅捷 → 飞行 → 分裂轮着上", () => {
    for (let n = 1; n <= 40; n++) {
      expect(isEndlessBossWave(n)).toBe(n % ENDLESS_BOSS_EVERY === 0);
    }
    const order = [5, 10, 15, 20, 25].map((n) => endlessBossKind(n));
    expect(order.slice(0, 4)).toEqual(ENDLESS_BOSS_ROTATION);
    expect(order[4]).toBe(ENDLESS_BOSS_ROTATION[0]);
    expect(endlessBossKind(7)).toBeNull();
  });

  it("波次压力无限递增:任何一段 5 波以上的窗口都比前一段重", () => {
    for (const win of [5, 8, 10]) {
      for (let n = 1; n <= 60; n++) {
        expect(endlessPressure(n + win, win), `窗口 ${win} 在第 ${n} 波没变难`).toBeGreaterThan(
          endlessPressure(n, win),
        );
      }
    }
  });

  it("BOSS 波之间、普通波之间各自也是一路往上,没有回头的坡", () => {
    let prevBoss = 0;
    let prevPlain = 0;
    for (let n = 1; n <= 120; n++) {
      const hp = endlessWaveHp(n);
      if (isEndlessBossWave(n)) {
        expect(hp, `第 ${n} 波 BOSS 反而变轻`).toBeGreaterThan(prevBoss);
        prevBoss = hp;
      } else {
        expect(hp, `第 ${n} 波反而变轻`).toBeGreaterThan(prevPlain);
        prevPlain = hp;
      }
    }
  });

  it("预算与批数都不封顶,单批数量却始终压在上限内:屏幕不会糊成一片", () => {
    for (let n = 1; n <= 120; n++) {
      expect(endlessBudget(n + 1)).toBeGreaterThan(endlessBudget(n));
      expect(endlessBatchCount(n + 1)).toBeGreaterThanOrEqual(endlessBatchCount(n));
      for (const e of endlessWave(n)) {
        expect(e.count, `第 ${n} 波一批 ${e.count} 只太多`).toBeLessThanOrEqual(ENDLESS_MAX_BATCH);
        expect(e.count).toBeGreaterThan(0);
      }
    }
    expect(endlessBatchCount(200)).toBeGreaterThan(endlessBatchCount(10));
  });

  it("花瓣产出涨得比怪的血量慢得多,不然后期钱多到没处花", () => {
    expect(endlessRewardIndex(40)).toBeLessThan(endlessLevelIndex(40) / 4);
    expect(endlessKillReward("softy", 40)).toBeLessThan(20);
    expect(endlessKillReward("softy", 40)).toBeGreaterThan(endlessKillReward("softy", 1));
  });

  it("固定策略守得住开头也终究会被淹没:这才叫无尽", () => {
    const run = simulateEndless(80, { timeCap: 6000 });
    expect(run.win).toBe(false);
    expect(run.wavesCleared).toBeGreaterThanOrEqual(10);
    expect(run.wavesCleared).toBeLessThan(80);
    expect(run.heartsLeft).toBe(0);
  });

  it("一座塔都不种连第一波都守不住,五颗心和闯关一致", () => {
    const bare = simulateEndless(10, { noTowers: true });
    expect(bare.win).toBe(false);
    expect(bare.wavesCleared).toBeLessThanOrEqual(1);
    expect(ENDLESS_HEARTS).toBe(5);
  });

  it("波次标题与结算文案:BOSS 波报名字,破纪录只夸不骂", () => {
    expect(endlessWaveName(5)).toContain(MONSTER_INFO.bossArmor.name);
    expect(endlessWaveName(6)).toBe("第 6 波");
    expect(endlessResultLine(12, 8)).toContain("新纪录");
    expect(endlessResultLine(5, 20)).toContain("再来一次");
  });

  it("meta 补了 endless,并且 188 关闯关照旧", () => {
    expect(meta.modes).toContain("endless");
    expect(meta.modes).toContain("campaign");
    expect(meta.modes).not.toContain("versus");
    expect(meta.levels).toBe(LEVELS.length);
  });
});

describe("garden-guard 1.2 · 360px 手机布局", () => {
  const model = { hearts: 3, maxHearts: 5, petals: 128, wave: 12, waveTotal: 18, title: "13-9 🌧" };

  it("生命 / 花瓣 / 波次一行显示,360px 上字号 ≥ 14 且不横向溢出", () => {
    const layout = hudLayout(model, 360, 74);
    expect(layout.fontSize).toBeGreaterThanOrEqual(HUD_MIN_FONT);
    expect(layout.fits).toBe(true);
    expect(layout.usedWidth).toBeLessThanOrEqual(360);
  });

  it("无尽没有总波数时也放得下", () => {
    const layout = hudLayout({ ...model, waveTotal: null, wave: 137, title: "守到底" }, 360, 74);
    expect(layout.fits).toBe(true);
    expect(layout.fontSize).toBeGreaterThanOrEqual(HUD_MIN_FONT);
    expect(layout.segments.center).toContain("137");
  });

  it("窄屏爱心改成「💗×n」写法:五个 emoji 连排才是真正撑破布局的那段", () => {
    const narrow = hudSegments(model, 360);
    const wide = hudSegments(model, 800);
    expect(narrow.right).toBe("💗×3");
    expect(wide.right).toContain("🤍");
    expect(estimateTextWidth(narrow.right, 16)).toBeLessThan(estimateTextWidth(wide.right, 16));
  });

  it("塔选择条:八座塔在 360px 上要横滑,图标仍然 ≥ 44px", () => {
    const layout = towerBarLayout(TOWER_KINDS.length, 360, 58);
    expect(layout.iconSize).toBeGreaterThanOrEqual(TOWER_ICON_MIN);
    expect(layout.cardW).toBeGreaterThanOrEqual(TOWER_ICON_MIN);
    expect(layout.cardH).toBeGreaterThanOrEqual(TOWER_ICON_MIN);
    expect(layout.scrollable).toBe(true);
    expect(layout.maxScroll).toBeGreaterThan(0);
  });

  it("宽屏放得下就不滑;滑动量永远夹在 0 与上限之间", () => {
    const wide = towerBarLayout(TOWER_KINDS.length, 900, 58);
    expect(wide.scrollable).toBe(false);
    expect(wide.maxScroll).toBe(0);
    const narrow = towerBarLayout(TOWER_KINDS.length, 360, 58);
    expect(clampScroll(-50, narrow.maxScroll)).toBe(0);
    expect(clampScroll(9999, narrow.maxScroll)).toBe(narrow.maxScroll);
    expect(towerCardX(0, narrow, 0)).toBe(narrow.padX);
    expect(towerCardX(3, narrow, 0)).toBeGreaterThan(towerCardX(2, narrow, 0));
  });

  it("解锁新塔时能把它整个滑进视野", () => {
    const layout = towerBarLayout(TOWER_KINDS.length, 360, 58);
    const last = TOWER_KINDS.length - 1;
    const scrolled = scrollToCard(last, layout, 0, 360);
    expect(towerCardX(last, layout, scrolled) + layout.cardW).toBeLessThanOrEqual(360);
    expect(scrollToCard(0, layout, scrolled, 360)).toBe(0);
  });

  it("放不下的格子给得出原因,而不是点了没反应", () => {
    const ctx = {
      cols: 10,
      rows: 6,
      blocked: new Set(["1,1"]),
      occupied: new Set(["2,2"]),
      barricades: new Set(["3,3"]),
      petals: 0,
    };
    expect(placementIssue(-1, 0, "bubble", ctx)).toBe("outside");
    expect(placementIssue(1, 1, "bubble", ctx)).toBe("path");
    expect(placementIssue(2, 2, "bubble", ctx)).toBe("occupied");
    expect(placementIssue(3, 3, "bubble", ctx)).toBe("barricade");
    expect(placementIssue(4, 4, "bubble", ctx)).toBe("poor");
    expect(placementIssue(4, 4, "bubble", { ...ctx, petals: 99 })).toBeNull();
  });

  it("每种原因都有一句给孩子看的话,不吓人也不含糊", () => {
    for (const issue of ["outside", "path", "occupied", "barricade", "poor", null] as const) {
      const text = placementReason(issue, "bubble");
      expect(text.length).toBeGreaterThan(3);
      expect(text).not.toMatch(/错误|失败|非法/);
    }
    expect(placementReason("poor", "boom")).toContain(String(TOWER_INFO.boom.cost));
  });
});

describe("garden-guard 1.2 · 手感与分级红线", () => {
  it("受击是弹开:两端归零、中途最远,而且退得有限", () => {
    expect(knockOffset(0)).toBe(0);
    expect(knockOffset(KNOCK_TIME)).toBe(0);
    const mid = knockOffset(KNOCK_TIME / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThanOrEqual(KNOCK_DIST);
    expect(knockOffset(KNOCK_TIME / 2, 2)).toBeGreaterThan(mid);
  });

  it("星星往斜上方散开,花瓣往四周飘且整体带向上初速", () => {
    const stars = Array.from({ length: HIT_STARS }, (_, i) => hitStar(i));
    expect(stars.every((s) => s.vy < 0)).toBe(true);
    expect(stars.every((s) => s.life > 0)).toBe(true);
    const petals = Array.from({ length: CLEAR_PETALS }, (_, i) => clearPetal(i));
    expect(petals.some((p) => p.vx > 0)).toBe(true);
    expect(petals.some((p) => p.vx < 0)).toBe(true);
    expect(petals.reduce((s, p) => s + p.vy, 0)).toBeLessThan(0);
    expect(petals[0].life).toBeGreaterThan(stars[0].life);
  });

  it("元气条一路暖色,任何血量都不出现红", () => {
    for (const r of [0, 0.15, 0.35, 0.7, 1]) {
      const c = energyColor(r);
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
      const red = parseInt(c.slice(1, 3), 16);
      const green = parseInt(c.slice(3, 5), 16);
      expect(green, `${c} 太红了`).toBeGreaterThan(red * 0.6);
    }
  });

  it("开了「减少动效」就一点不抖,状态变化照常", () => {
    expect(shakeAmount(0.5, true)).toBe(0);
    expect(shakeAmount(0.5, false)).toBe(0.5);
  });

  it("塔、怪、克制表、攻略的文案都不含血腥死亡描写,也不夹带商标", () => {
    const words: string[] = [];
    for (const k of TOWER_KINDS) words.push(TOWER_INFO[k].name, TOWER_INFO[k].desc);
    for (const k of Object.keys(MONSTER_INFO) as MonsterKind[]) words.push(MONSTER_INFO[k].name);
    for (const row of COUNTER_TABLE) words.push(row.why);
    words.push(...guide.general);
    for (const e of guide.entries) words.push(e.title, ...e.tips);
    for (const text of words) {
      expect(text, text).not.toMatch(/血|伤|死|杀|尸|痛/);
      // 拉丁字母串在这个全中文的游戏里只可能是外来商标
      expect(text.replace(/BOSS/g, ""), text).not.toMatch(/[A-Za-z]{3,}/);
    }
  });

  it("攻略带上了克制关系表,而且四类原型都点到名", () => {
    const table = guide.entries.find((e) => e.title.includes("克制关系表"));
    expect(table).toBeTruthy();
    for (const a of CORE_ARCHETYPES) {
      expect(table?.tips.join(" "), `攻略没提 ${a}`).toContain(ARCHETYPE_LABEL[a]);
    }
    expect(guide.entries.some((e) => e.title.includes("无尽"))).toBe(true);
  });
});

/* ---------------- destroy 归零 ---------------- */

interface FakeEl {
  tagName: string;
  style: Record<string, string>;
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  children: FakeEl[];
  listeners: Map<string, Set<unknown>>;
  removed: boolean;
  appendChild(c: FakeEl): void;
  remove(): void;
  addEventListener(t: string, fn: unknown): void;
  removeEventListener(t: string, fn: unknown): void;
  getContext(): unknown;
  getBoundingClientRect(): { left: number; top: number };
}

function fakeCtx(): unknown {
  const noop = (): unknown => undefined;
  return new Proxy(
    {
      measureText: () => ({ width: 40 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      setTransform: noop,
      canvas: null,
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        return noop;
      },
      set(target, prop, value) {
        target[prop as string] = value;
        return true;
      },
    },
  );
}

function fakeEl(tagName: string): FakeEl {
  const listeners = new Map<string, Set<unknown>>();
  const el: FakeEl = {
    tagName,
    style: {},
    width: 0,
    height: 0,
    clientWidth: 360,
    clientHeight: 640,
    children: [],
    listeners,
    removed: false,
    appendChild(c) {
      el.children.push(c);
    },
    remove() {
      el.removed = true;
    },
    addEventListener(t, fn) {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)?.add(fn);
    },
    removeEventListener(t, fn) {
      listeners.get(t)?.delete(fn);
    },
    getContext: () => fakeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  return el;
}

describe("garden-guard 1.2 · destroy 归零", () => {
  const g = globalThis as Record<string, unknown>;
  const saved: Record<string, unknown> = {};
  let rafHandles = 0;
  let cancelled: number[] = [];
  let mediaListeners = 0;

  beforeEach(() => {
    for (const k of ["document", "window", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "location", "performance"]) {
      saved[k] = g[k];
    }
    rafHandles = 0;
    cancelled = [];
    mediaListeners = 0;
    const store = new Map<string, string>();
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    g.document = { createElement: (tag: string) => fakeEl(tag) };
    g.window = {
      devicePixelRatio: 1,
      matchMedia: () => ({
        matches: false,
        addEventListener: () => {
          mediaListeners++;
        },
        removeEventListener: () => {
          mediaListeners--;
        },
      }),
    };
    g.location = { search: "" };
    g.performance = { now: () => 0 };
    g.requestAnimationFrame = () => ++rafHandles;
    g.cancelAnimationFrame = (h: number) => cancelled.push(h);
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) g[k] = v;
    vi.resetModules();
  });

  it("destroy 之后:rAF 取消、监听清空、画布摘掉", async () => {
    const { mount } = await import("./index");
    const root = fakeEl("div");
    const handle = mount({
      root: root as unknown as HTMLElement,
      play: () => undefined,
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined,
    });
    const canvas = root.children[0];
    expect(canvas.listeners.get("pointerdown")?.size).toBe(1);
    expect(rafHandles).toBeGreaterThan(0);
    expect(mediaListeners).toBe(1);

    handle.destroy();

    expect(cancelled.length).toBe(1);
    expect(mediaListeners).toBe(0);
    expect(canvas.removed).toBe(true);
    for (const [type, set] of canvas.listeners) {
      expect(set.size, `${type} 监听没摘干净`).toBe(0);
    }
  });

  it("?level= 直达关卡:越界会被 clamp 到有效范围,不会崩", async () => {
    (g.location as { search: string }).search = "?level=9999";
    const { mount } = await import("./index");
    const root = fakeEl("div");
    const handle = mount({
      root: root as unknown as HTMLElement,
      play: () => undefined,
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined,
    });
    expect(root.children.length).toBe(1);
    handle.destroy();
  });
});
