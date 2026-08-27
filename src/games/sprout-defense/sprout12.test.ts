/**
 * 绿芽保卫战 1.2 —— 新玩法的回归测试。
 *
 * 1.1 的 `logic.test.ts` 一条不动(前 99 关的数据指纹也在那边守着),
 * 这里只管 1.2 加进来的东西:绿芽体系、四类敌人的预警、三种特殊关、
 * 阳光经济与资源曲线、无尽「守到天亮」,以及手机版面那几条硬指标。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BELT_QUEUE_MAX,
  BLITZ_GRACE,
  BUG_INFO,
  LANES,
  LEVELS,
  PLANT_COLS,
  PLANT_INFO,
  PLANT_KINDS,
  PREP_SECONDS,
  TUNNEL_EXIT_COL,
  blitzLimit,
  buildLevelSchedule,
  canJumpOver,
  shortestPrepGap,
  shootCooldown,
  tunnelExitCol,
} from "./logic";
import {
  BLOCK_REASON_TEXT,
  CARD_MIN_W,
  ENDLESS_DAWN_WAVE,
  FIRST_PLANT_DEADLINE,
  HUD_FONT_MIN,
  LANE_MIN_H,
  MAIN_ROLES,
  PLANT_ORDER,
  PLANT_SPEC,
  REQUIRED_TRAITS,
  ROLE_LABEL,
  SHOVEL_CONFIRM_WINDOW,
  SUN_EVERY,
  SUN_NIGHT_SLOW,
  TRAIT_INFO,
  WARN_LEAD,
  activeWarnings,
  buildWarnings,
  bugTraits,
  canAffordPlant,
  cardStripLayout,
  dominancePairs,
  endlessBugCount,
  endlessDawn,
  endlessPool,
  endlessSkyLine,
  endlessThreat,
  endlessWave,
  fieldMetrics,
  plantBlockReason,
  plantSunCost,
  plantTable,
  plantTableLine,
  plantsWithRole,
  secondsToFirstPlant,
  shovelStep,
  specialLevels,
  sunInterval,
  unwarnedSpawns,
} from "./sprout12";
import { SIM_STYLES, simulateEndless, simulateLevel } from "./sim";
import { meta } from "./meta";
import guide from "./guide";

const SPECIAL_KINDS = ["puzzle", "conveyor", "blitz"] as const;
const src = (name: string): string =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("sprout-defense 1.2 · 绿芽体系", () => {
  it("绿芽至少 6 种,四类分工每类都有人,且每一株都在总表里", () => {
    expect(PLANT_KINDS.length).toBeGreaterThanOrEqual(6);
    expect(PLANT_ORDER.slice().sort()).toEqual(PLANT_KINDS.slice().sort());
    for (const role of MAIN_ROLES) {
      expect(plantsWithRole(role).length, `${ROLE_LABEL[role]}一株都没有`).toBeGreaterThanOrEqual(2);
    }
    // 四类主力(不含荷叶/望望草这种辅助)本身也得够 6 株
    const main = MAIN_ROLES.flatMap(plantsWithRole);
    expect(new Set(main).size).toBeGreaterThanOrEqual(6);
  });

  it("绿芽数据表与 PLANT_INFO 对得上:造价同源、射速同源、每株都有区别说明", () => {
    for (const kind of PLANT_ORDER) {
      const spec = PLANT_SPEC[kind];
      expect(spec.dew, `${kind} 露珠造价和 PLANT_INFO 不一致`).toBe(PLANT_INFO[kind].cost);
      expect(spec.cooldown).toBeGreaterThan(0);
      expect(spec.note.trim().length, `${kind} 少了区别说明`).toBeGreaterThan(6);
      if (spec.shootCd !== undefined) {
        expect(spec.shootCd).toBe(shootCooldown(kind as never));
      }
    }
  });

  it("没有万能苗:能力矩阵里一对支配关系都找不出来", () => {
    expect(dominancePairs()).toEqual([]);
  });

  it("同类之间也各有取舍:三门直射炮的「打空中 / 减速 / 便宜」互不通吃", () => {
    const direct = plantsWithRole("direct");
    expect(direct).toContain("bubble");
    expect(direct).toContain("star");
    expect(direct).toContain("ice");
    // 泡泡最便宜但打不到天上;星星打得到天上但没减速;冰冰能减速但卡片歇最久
    expect(PLANT_SPEC.bubble.dew).toBeLessThan(PLANT_SPEC.star.dew);
    expect(PLANT_SPEC.bubble.air).toBe(false);
    expect(PLANT_SPEC.star.air).toBe(true);
    expect(PLANT_SPEC.ice.air).toBe(true);
    expect(PLANT_SPEC.ice.cooldown).toBeGreaterThan(PLANT_SPEC.star.cooldown);
  });

  it("阳光只花在 1.2 的新苗上:老苗一律 0,前 99 关的经济一点没变", () => {
    const sunEaters = PLANT_ORDER.filter((k) => plantSunCost(k) > 0);
    expect(sunEaters.sort()).toEqual(["netpad", "puff"]);
    for (const k of ["sparkle", "moon", "bubble", "star", "ice", "boom", "nut", "lily", "scout"] as const) {
      expect(plantSunCost(k), `${k} 不该吃阳光`).toBe(0);
    }
  });

  it("种不下要说清原因:冷却 / 露珠 / 阳光 / 这一格,四种都有话说", () => {
    expect(plantBlockReason("puff", 9, 9, 1.2, true)).toBe("cooldown");
    expect(plantBlockReason("puff", 0, 9, 0, true)).toBe("dew");
    expect(plantBlockReason("puff", 9, 0, 0, true)).toBe("sun");
    expect(plantBlockReason("puff", 9, 9, 0, false)).toBe("cell");
    expect(plantBlockReason("puff", 9, 9, 0, true)).toBeNull();
    for (const text of Object.values(BLOCK_REASON_TEXT)) {
      expect(text.length).toBeGreaterThan(4);
      // 只鼓励、不指责:不许出现「不行 / 错」这种否定小朋友的说法
      expect(text).not.toMatch(/错|不行|失败/);
    }
    expect(canAffordPlant(2, 2, "puff")).toBe(true);
    expect(canAffordPlant(2, 1, "puff")).toBe(false);
  });

  it("攻略里有绿芽对照表和四类敌人的破法,和数据表同源", () => {
    const table = plantTable();
    expect(table.length).toBe(PLANT_ORDER.length);
    expect(plantTableLine("puff")).toContain("☀️");
    expect(plantTableLine("sparkle")).not.toContain("☀️");
    const all = guide.entries.flatMap((e) => e.tips).join("\n");
    for (const kind of PLANT_ORDER) {
      expect(all, `攻略里没提到 ${PLANT_INFO[kind].name}`).toContain(PLANT_INFO[kind].name);
    }
    for (const trait of REQUIRED_TRAITS) {
      expect(all).toContain(TRAIT_INFO[trait].counter);
    }
  });
});

describe("sprout-defense 1.2 · 四类敌人与预警", () => {
  it("带盾 / 跳跃 / 挖地 / 飞行四类都有虫,每类都有破法说明", () => {
    for (const trait of REQUIRED_TRAITS) {
      const kinds = (Object.keys(BUG_INFO) as Array<keyof typeof BUG_INFO>).filter((k) =>
        bugTraits(k).includes(trait),
      );
      expect(kinds.length, `${TRAIT_INFO[trait].label}一种虫都没有`).toBeGreaterThan(0);
      expect(TRAIT_INFO[trait].counter.length).toBeGreaterThan(6);
    }
    expect(bugTraits("tunneler")).toContain("dig");
    expect(bugTraits("bucket")).toContain("shield");
    expect(bugTraits("digger")).toContain("jump");
    expect(bugTraits("flyer")).toContain("fly");
  });

  it("不许突然袭击:全部 188 关里没有一只带机制的虫是无预警登场的", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const missed = unwarnedSpawns(buildLevelSchedule(i));
      expect(missed.length, `第 ${i + 1} 关有 ${missed.length} 只虫没预警`).toBe(0);
    }
  });

  it("预警提前 3 秒亮起,虫一出场就收掉,而且指明是哪条道", () => {
    const schedule = buildLevelSchedule(124);
    const warnings = buildWarnings(schedule);
    expect(warnings.length).toBeGreaterThan(0);
    for (const wn of warnings) {
      expect(wn.spawnTime - wn.time).toBeLessThanOrEqual(WARN_LEAD + 1e-9);
      expect(wn.lane).toBeGreaterThanOrEqual(0);
      expect(wn.lane).toBeLessThan(LANES);
      expect(wn.text).toContain(TRAIT_INFO[wn.trait].label);
    }
    const first = warnings[0];
    expect(activeWarnings(warnings, first.time)).toContain(first);
    expect(activeWarnings(warnings, first.spawnTime)).not.toContain(first);
  });

  it("哧溜虫钻地绕后,但出土点离家还有好几格;弹弹网让它钻不过去", () => {
    expect(BUG_INFO.tunneler.digs).toBe(true);
    expect(TUNNEL_EXIT_COL).toBeGreaterThanOrEqual(3);
    expect(TUNNEL_EXIT_COL).toBeLessThan(PLANT_COLS);
    // 没网:一路钻到 TUNNEL_EXIT_COL;网架在出土点外侧,它只能在网前面冒头
    expect(tunnelExitCol([])).toBe(TUNNEL_EXIT_COL);
    expect(tunnelExitCol([2])).toBe(TUNNEL_EXIT_COL);
    expect(tunnelExitCol([6])).toBe(7);
    expect(tunnelExitCol([6])).toBeGreaterThan(tunnelExitCol([]));
    expect(tunnelExitCol([PLANT_COLS - 1])).toBeLessThanOrEqual(PLANT_COLS);
  });

  it("会跳的能越过果果墩,但越不过弹弹网", () => {
    expect(canJumpOver("nut")).toBe(true);
    expect(canJumpOver("netpad")).toBe(false);
  });

  it("波与波之间留够布置时间,谁也不会一开局就被糊脸", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(shortestPrepGap(i), `第 ${i + 1} 关波间隙太短`).toBeGreaterThanOrEqual(PREP_SECONDS);
    }
  });
});

describe("sprout-defense 1.2 · 三种特殊关", () => {
  it("固定苗解谜 / 传送带发苗 / 限时速攻各至少 6 关,而且互不重叠", () => {
    const seen = new Set<number>();
    for (const kind of SPECIAL_KINDS) {
      const list = specialLevels(kind);
      expect(list.length, `${kind} 不够 6 关`).toBeGreaterThanOrEqual(6);
      for (const i of list) {
        expect(seen.has(i), `第 ${i + 1} 关被安排了两种特殊玩法`).toBe(false);
        seen.add(i);
      }
    }
  });

  it("特殊关只出现在第 100 关之后:前 99 关一如既往", () => {
    for (const kind of SPECIAL_KINDS) {
      for (const i of specialLevels(kind)) expect(i).toBeGreaterThanOrEqual(99);
    }
    for (let i = 0; i < 99; i++) expect(LEVELS[i].special).toBeUndefined();
  });

  it("解谜关:手里就那几株固定苗,种类够用、总数有限,而且提示里说清楚了", () => {
    for (const i of specialLevels("puzzle")) {
      const sp = LEVELS[i].special!;
      const stock = sp.stock ?? [];
      expect(stock.length, `第 ${i + 1} 关没给苗`).toBeGreaterThanOrEqual(3);
      const total = stock.reduce((s, x) => s + x.count, 0);
      expect(total).toBeGreaterThan(0);
      for (const s of stock) {
        expect(s.count).toBeGreaterThan(0);
        // 单一种类也不许多到能把整块地铺满 —— 那就不是解谜是堆料了
        expect(s.count, `第 ${i + 1} 关 ${s.kind} 给太多了`).toBeLessThanOrEqual(LANES * PLANT_COLS);
      }
      expect(LEVELS[i].hint.length).toBeGreaterThan(4);
    }
  });

  it("传送关:传送带循环发苗,队列有上限,苗的种类覆盖这一关的威胁", () => {
    for (const i of specialLevels("conveyor")) {
      const sp = LEVELS[i].special!;
      const belt = sp.belt ?? [];
      expect(belt.length, `第 ${i + 1} 关传送带是空的`).toBeGreaterThanOrEqual(6);
      expect(sp.beltEvery ?? 0).toBeGreaterThan(0);
      // 有会飞的就必须发得出打空中的苗;有水道就必须发荷叶
      const hasFlyer = LEVELS[i].waves.some((w) => w.some((e) => BUG_INFO[e.kind].flying));
      if (hasFlyer) expect(belt.some((k) => PLANT_SPEC[k].air)).toBe(true);
      if (LEVELS[i].waterLanes.length > 0) expect(belt).toContain("lily");
    }
    expect(BELT_QUEUE_MAX).toBeGreaterThanOrEqual(3);
  });

  it("速攻关:有倒计时,而且倒计时比最后一只虫出场还晚一段清场时间", () => {
    for (const i of specialLevels("blitz")) {
      const sched = buildLevelSchedule(i);
      const last = sched[sched.length - 1].time;
      const limit = blitzLimit(i);
      expect(limit).toBeGreaterThan(last);
      expect(limit - last).toBeGreaterThanOrEqual(BLITZ_GRACE - 0.05);
    }
  });

  it("三种特殊关都能打赢(固定策略模拟,一关不落)", () => {
    for (const kind of SPECIAL_KINDS) {
      for (const i of specialLevels(kind)) {
        const res = simulateLevel(i);
        expect(res.win, `${kind} 第 ${i + 1} 关打不过:${res.breachKind ?? "超时"}`).toBe(true);
        if (kind === "blitz") expect(res.timedOut).toBe(false);
      }
    }
  });
});

describe("sprout-defense 1.2 · 资源曲线", () => {
  it("每一关开局 20 秒内都种得下第一株苗", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(secondsToFirstPlant(i), `第 ${i + 1} 关开局等太久`).toBeLessThanOrEqual(
        FIRST_PLANT_DEADLINE,
      );
    }
  });

  it("阳光是第二条经济:白天 5 秒一点,天黑明显变慢,只有暖暖花会开", () => {
    expect(sunInterval(false)).toBe(SUN_EVERY);
    expect(sunInterval(true)).toBeCloseTo(SUN_EVERY * SUN_NIGHT_SLOW, 6);
    expect(sunInterval(true)).toBeGreaterThan(sunInterval(false));
    expect(plantsWithRole("produce")).toContain("sunbud");
  });

  it("两种流派都成立:稳扎稳打和速攻各自都能通关抽样关(含三种特殊关)", () => {
    const sample = [0, 66, 99, 101, 104, 118, 120, 155, 187];
    for (const style of ["steady", "rush"] as const) {
      for (const i of sample) {
        expect(simulateLevel(i, { style }).win, `${style} 打不过第 ${i + 1} 关`).toBe(true);
      }
    }
  });

  it("两种流派不是一回事:各有对方拿不下的关,经济曲线也走得不一样", () => {
    let steadyOnly = 0;
    let rushOnly = 0;
    for (let i = 99; i < LEVELS.length; i++) {
      const s = simulateLevel(i, { style: "steady" }).win;
      const r = simulateLevel(i, { style: "rush" }).win;
      if (s && !r) steadyOnly++;
      if (r && !s) rushOnly++;
    }
    expect(steadyOnly).toBeGreaterThan(0);
    expect(rushOnly).toBeGreaterThan(0);
    // 稳扎稳打靠经济滚雪球,速攻靠早早堆枪:同一关花的钱不一样多
    const steady = simulateLevel(120, { style: "steady" });
    const rush = simulateLevel(120, { style: "rush" });
    expect(steady.dewEarned).not.toBe(rush.dewEarned);
  });

  it("模拟器给的每一套打法都是确定性的:同一关跑两遍结果一模一样", () => {
    for (const style of SIM_STYLES) {
      const a = simulateLevel(144, { style });
      const b = simulateLevel(144, { style });
      expect(a.win).toBe(b.win);
      expect(a.time).toBeCloseTo(b.time, 9);
      expect(a.plantsBuilt).toBe(b.plantsBuilt);
    }
  });

  it("188 关抽样可解:含第 100 / 145 / 188 关,第 100 关起一关都不许是死局", () => {
    for (const i of [99, 144, 187]) {
      expect(simulateLevel(i).win, `第 ${i + 1} 关打不过`).toBe(true);
    }
    const fails: number[] = [];
    for (let i = 99; i < LEVELS.length; i++) if (!simulateLevel(i).win) fails.push(i + 1);
    expect(fails).toEqual([]);
  });
});

describe("sprout-defense 1.2 · 无尽「守到天亮」", () => {
  it("meta 里补了 endless,战役关数不变", () => {
    expect(meta.modes).toContain("campaign");
    expect(meta.modes).toContain("endless");
    expect(meta.levels).toBe(LEVELS.length);
    expect(meta.levels).toBe(188);
  });

  it("波次递增:虫越来越多,压力越来越大,种类一样一样解锁", () => {
    for (let n = 2; n <= 30; n++) {
      expect(endlessBugCount(n), `第 ${n} 波虫数倒退`).toBeGreaterThanOrEqual(endlessBugCount(n - 1));
      expect(endlessPool(n).length).toBeGreaterThanOrEqual(endlessPool(n - 1).length);
    }
    // 大块头波会顶出一个尖,所以按 6 波一段看总趋势
    for (let n = 7; n <= 30; n++) {
      expect(endlessThreat(n), `第 ${n} 波比 6 波前还轻松`).toBeGreaterThan(endlessThreat(n - 6));
    }
    expect(endlessPool(1)).toEqual(["walker"]);
    expect(endlessPool(30)).toContain("tunneler");
  });

  it("天色一路泛白,第 20 波天亮,之后是加场", () => {
    expect(endlessDawn(1)).toBe(0);
    expect(endlessDawn(ENDLESS_DAWN_WAVE)).toBe(1);
    for (let n = 2; n <= ENDLESS_DAWN_WAVE; n++) {
      expect(endlessDawn(n)).toBeGreaterThan(endlessDawn(n - 1));
    }
    expect(endlessSkyLine(1)).toContain("夜");
    expect(endlessSkyLine(ENDLESS_DAWN_WAVE)).toContain("天亮");
    expect(endlessSkyLine(ENDLESS_DAWN_WAVE + 5)).toContain("加场");
  });

  it("每 6 波压一个大块头,越往后血越厚", () => {
    expect(endlessWave(6).boss).toBe(true);
    expect(endlessWave(7).boss).toBe(false);
    expect(endlessWave(24).entries.some((e) => e.kind === "queen")).toBe(true);
    expect(endlessWave(12).hpBonus).toBeGreaterThan(endlessWave(3).hpBonus);
  });

  it("无尽真的守得住一阵子:固定策略至少撑过 10 波", () => {
    const res = simulateEndless(10);
    expect(res.reached).toBe(10);
    expect(res.wavesSurvived).toBeGreaterThanOrEqual(10);
    expect(res.bugsKilled).toBeGreaterThan(30);
  });
});

describe("sprout-defense 1.2 · 手机版面与误触保护", () => {
  it("360px 竖屏:苗卡热区 ≥ 44px、字号 ≥ 14px、通道 ≥ 40px", () => {
    expect(CARD_MIN_W).toBeGreaterThanOrEqual(44);
    expect(HUD_FONT_MIN).toBeGreaterThanOrEqual(14);
    expect(LANE_MIN_H).toBeGreaterThanOrEqual(40);
    for (const [vw, vh] of [
      [360, 720],
      [375, 667],
      [320, 568],
    ] as const) {
      const strip = cardStripLayout(vw, 13, 0);
      expect(strip.cardW, `${vw}px 上卡片被压小了`).toBeGreaterThanOrEqual(CARD_MIN_W);
      // 放不下就横滑,绝不把卡压扁
      expect(strip.maxScroll).toBeGreaterThan(0);
      const m = fieldMetrics(vw, vh, 92);
      expect(m.ch, `${vw}×${vh} 上通道太挤`).toBeGreaterThanOrEqual(LANE_MIN_H);
      expect(m.ox).toBeGreaterThan(0);
      expect(m.oy).toBeGreaterThanOrEqual(92);
    }
  });

  it("卡片少的时候不横滑,卡片条也不会把卡拉得过宽", () => {
    const strip = cardStripLayout(640, 5, 0);
    expect(strip.maxScroll).toBe(0);
    expect(strip.cardW).toBeLessThanOrEqual(96);
    // 滚动量会被夹在合法范围里
    expect(cardStripLayout(360, 13, 99999).scroll).toBe(cardStripLayout(360, 13, 0).maxScroll);
    expect(cardStripLayout(360, 13, -50).scroll).toBe(0);
  });

  it("铲子二段确认:同一格点两下才铲,换格子只是重新举铲,过了窗口要重来", () => {
    const first = shovelStep(null, "3,1", 10);
    expect(first.action).toBe("arm");
    expect(shovelStep(first.pending, "3,1", 10.5).action).toBe("dig");
    expect(shovelStep(first.pending, "4,1", 10.5).action).toBe("arm");
    expect(shovelStep(first.pending, "3,1", 10 + SHOVEL_CONFIRM_WINDOW + 0.1).action).toBe("arm");
    // 真铲之后就归零,再点一下又要重新举铲
    expect(shovelStep(shovelStep(first.pending, "3,1", 10.5).pending, "3,1", 10.6).action).toBe("arm");
  });
});

describe("sprout-defense 1.2 · 红线自查", () => {
  it("CSS 一律 spd- 前缀、写在局部 style 里,不碰全局样式表", () => {
    const index = src("index.ts");
    expect(index).toContain("spd-root");
    expect(index).not.toMatch(/import\s+["'][^"']*styles\.css/);
    const classes = [...index.matchAll(/className\s*=\s*"([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) expect(c, `类名 ${c} 没带 spd- 前缀`).toMatch(/^spd-/);
    for (const m of index.matchAll(/^\.([A-Za-z][\w-]*)/gm)) {
      expect(m[1]).toMatch(/^spd-/);
    }
  });

  it("音效只走 api.play:没有自建 AudioContext,也没有 setInterval / setTimeout 兜底循环", () => {
    for (const name of ["index.ts", "logic.ts", "sim.ts", "sprout12.ts"]) {
      const code = src(name);
      expect(code, `${name} 自建了音频`).not.toMatch(/AudioContext/);
      expect(code, `${name} 用了 setInterval`).not.toMatch(/setInterval/);
      expect(code, `${name} 用了 setTimeout`).not.toMatch(/setTimeout/);
    }
  });

  it("无血无伤无死亡,失败只鼓励;也不蹭同类商业作品的名号", () => {
    const texts = [
      ...LEVELS.map((l) => `${l.name} ${l.hint} ${l.feature}`),
      ...PLANT_ORDER.map((k) => `${PLANT_INFO[k].name} ${PLANT_SPEC[k].note}`),
      ...Object.values(BUG_INFO).map((b) => b.name),
      ...guide.general,
      ...guide.entries.flatMap((e) => [e.title, ...e.tips]),
      ...Object.values(BLOCK_REASON_TEXT),
      ...Object.values(TRAIT_INFO).map((t) => `${t.label} ${t.counter}`),
      ...Array.from({ length: 26 }, (_, i) => endlessSkyLine(i + 1)),
    ].join("\n");
    // 「掉血 / 血量」是 1.1 就有的数值说法,这里守的是画面与结局:
    // 不许出现死亡、尸体、杀戮、流血、疼痛这种东西
    expect(texts).not.toMatch(/死亡|死掉|打死|尸|杀|流血|鲜血|血腥|受伤|疼|痛|残/);
    expect(texts).not.toMatch(/植物大战|僵尸|豌豆射手|向日葵|坚果墙|Plants|Zombie/i);
  });

  it("index.ts 接了平台那几条线:直达关卡、跳关授权、无尽成绩", () => {
    const index = src("index.ts");
    expect(index).toContain("openCampaignLevel");
    expect(index).toContain("api.initialLevel");
    expect(index).toContain("requestSkip");
    expect(index).toContain('recordEndlessBest("sprout-defense"');
  });
});

/**
 * 1.2 监督修复员补的守门用例。
 *
 * 上面那条老用例放过了「掉血 / 血量」——它是 1.1 就有的数值说法。
 * 但本作头顶那条本来就该叫元气,1.2 新写的文案没有理由再冒出这个字。
 * 1.1 冻结的前 99 关关卡数据带指纹、一个字都不许动,所以这里从第 100 关起守。
 */
describe("1.2 新写的文案一律不说「血」", () => {
  it("第 100 关起的关卡文案、攻略、特性克制、放置提示都不含「血」", () => {
    const fresh: string[] = [];
    for (let i = 99; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      fresh.push(`第 ${i + 1} 关:${lv.name} ${lv.hint} ${lv.feature}`);
    }
    fresh.push(...guide.general);
    fresh.push(...guide.entries.flatMap((e) => [e.title, ...e.tips]));
    fresh.push(...Object.values(TRAIT_INFO).map((t) => `${t.label} ${t.counter}`));
    fresh.push(...Object.values(BLOCK_REASON_TEXT));
    expect(fresh.length).toBeGreaterThan(80);
    for (const line of fresh) {
      expect(line, `这句里还留着「血」:${line}`).not.toMatch(/血/);
    }
  });
});
