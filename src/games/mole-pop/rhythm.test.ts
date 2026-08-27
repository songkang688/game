import { describe, expect, it } from "vitest";
import { LEVELS, endlessWave, type MoleLevel } from "./levels";
import {
  BUNNY_TEXT,
  COMBO_CAP,
  DROP_MS,
  JUDGE_LABEL,
  JUDGE_SCORE,
  MOLE_SPECS,
  RHYTHM_PATTERNS,
  RISE_MS,
  TimerBag,
  breakCombo,
  buildChart,
  capConcurrency,
  bunnyPenalty,
  chartMaxPoints,
  comboMultiplier,
  expandSwarms,
  flashStayMs,
  hitPoints,
  hitScore,
  judgeHit,
  maxConcurrentOf,
  moleTimeline,
  nightMarketChart,
  nightMarketLine,
  nightMarketStall,
  patternsFor,
  rollKind,
  stayMsFor,
  withSwarms,
  type MoleKind,
  type TimerHost,
} from "./rhythm";

/** 一个可以数「还剩几个没清」的假定时器 */
function fakeHost(): { host: TimerHost; live: () => number } {
  let seq = 1;
  const alive = new Set<number>();
  const host: TimerHost = {
    setTimeout: () => {
      const id = seq++;
      alive.add(id);
      return id;
    },
    clearTimeout: (id) => {
      alive.delete(id);
    },
    setInterval: () => {
      const id = seq++;
      alive.add(id);
      return id;
    },
    clearInterval: (id) => {
      alive.delete(id);
    },
  };
  return { host, live: () => alive.size };
}

describe("地鼠嘭嘭 · 判定窗口", () => {
  it("时间线四个节点按 钻出 → 停留 → 缩回 排好", () => {
    const t = moleTimeline(1000, 800);
    expect(t.riseAt).toBe(1000);
    expect(t.stayAt).toBe(1000 + RISE_MS);
    expect(t.dropAt).toBe(1000 + RISE_MS + 800);
    expect(t.goneAt).toBe(1000 + RISE_MS + 800 + DROP_MS);
  });

  it("三档判定的边界一格不差", () => {
    const up = 900;
    expect(judgeHit(0, up)).toBe("perfect");
    expect(judgeHit(RISE_MS - 1, up)).toBe("perfect");
    expect(judgeHit(RISE_MS, up)).toBe("good");
    expect(judgeHit(RISE_MS + up - 1, up)).toBe("good");
    expect(judgeHit(RISE_MS + up, up)).toBe("graze");
    expect(judgeHit(RISE_MS + up + DROP_MS - 1, up)).toBe("graze");
    expect(judgeHit(RISE_MS + up + DROP_MS, up)).toBe("miss");
  });

  it("还没冒头就落锤、或者数值坏掉都算点空", () => {
    expect(judgeHit(-5, 800)).toBe("miss");
    expect(judgeHit(Number.NaN, 800)).toBe("miss");
  });

  it("三档分数不同,擦边最少,点空是 0", () => {
    expect(JUDGE_SCORE.perfect).toBeGreaterThan(JUDGE_SCORE.good);
    expect(JUDGE_SCORE.good).toBeGreaterThan(JUDGE_SCORE.graze);
    expect(hitScore("perfect", 2)).toBe(6);
    expect(hitScore("graze", 2)).toBe(2);
    expect(hitScore("miss", 2)).toBe(0);
    expect(Object.keys(JUDGE_LABEL)).toHaveLength(4);
  });

  it("闯关计数不吃判定加成:只要打中就按底分算(前 99 关难度不变)", () => {
    expect(hitPoints("perfect", 1)).toBe(1);
    expect(hitPoints("good", 1)).toBe(1);
    expect(hitPoints("graze", 2)).toBe(2);
    expect(hitPoints("miss", 2)).toBe(0);
  });
});

describe("地鼠嘭嘭 · 角色体系", () => {
  it("五种新老角色齐了,花花兔是唯一不能打的", () => {
    const kinds: MoleKind[] = ["normal", "hat", "flash", "bunny", "swarm"];
    for (const k of kinds) expect(MOLE_SPECS[k]).toBeTruthy();
    expect(MOLE_SPECS.bunny.hittable).toBe(false);
    expect(Object.values(MOLE_SPECS).filter((s) => !s.hittable)).toHaveLength(1);
  });

  it("帽子鼠要打两下,闪光鼠高分但停留短", () => {
    expect(MOLE_SPECS.hat.hits).toBe(2);
    expect(MOLE_SPECS.normal.hits).toBe(1);
    expect(MOLE_SPECS.flash.base).toBeGreaterThan(MOLE_SPECS.normal.base);
    expect(MOLE_SPECS.flash.stayScale).toBeLessThan(1);
    expect(flashStayMs(1000)).toBeLessThan(1000);
    expect(flashStayMs(100)).toBeGreaterThanOrEqual(260);
  });

  it("打到花花兔扣一分,不会扣成负数,提示温和不批评", () => {
    expect(bunnyPenalty(5)).toBe(4);
    expect(bunnyPenalty(0)).toBe(0);
    expect(BUNNY_TEXT).toContain("花花兔");
    expect(BUNNY_TEXT).not.toContain("错");
    expect(BUNNY_TEXT).not.toContain("笨");
  });

  it("群鼠展开成同一时刻的三只,洞位不重叠", () => {
    const swarm = expandSwarms([{ at: 1000, hole: 1, kind: "swarm", upMs: 700 }]);
    expect(swarm).toHaveLength(3);
    expect(new Set(swarm.map((n) => n.hole)).size).toBe(3);
    expect(swarm.every((n) => n.at === 1000 && n.kind === "normal")).toBe(true);
    expect(expandSwarms([{ at: 5, hole: 0, kind: "gold", upMs: 500 }])).toHaveLength(1);
  });
});

describe("地鼠嘭嘭 · 连击", () => {
  it("连中越多倍率越高,但封顶", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(1);
    expect(comboMultiplier(3)).toBe(2);
    expect(comboMultiplier(6)).toBe(3);
    expect(comboMultiplier(999)).toBe(COMBO_CAP);
  });

  it("打错 / 漏打清零,脏数据当 0", () => {
    expect(breakCombo()).toBe(0);
    expect(comboMultiplier(breakCombo())).toBe(1);
    expect(comboMultiplier(Number.NaN)).toBe(1);
    expect(comboMultiplier(-4)).toBe(1);
  });
});

describe("地鼠嘭嘭 · 谱面", () => {
  const cfg: MoleLevel = LEVELS[120];

  it("同一个种子生成同一张谱面(可复现)", () => {
    const a = buildChart(cfg, 2026, 120);
    const b = buildChart(cfg, 2026, 120);
    expect(a).toEqual(b);
    expect(buildChart(cfg, 7, 120)).not.toEqual(a);
  });

  it("谱面按时间排好,全部落在本关时长内", () => {
    const chart = buildChart(cfg, 11, 120);
    expect(chart.length).toBeGreaterThan(8);
    for (let i = 1; i < chart.length; i++) expect(chart[i].at).toBeGreaterThanOrEqual(chart[i - 1].at);
    expect(chart[chart.length - 1].at).toBeLessThan(cfg.duration * 1000);
    expect(chart.every((n) => n.hole >= 0 && n.hole < 9 && n.upMs > 0)).toBe(true);
  });

  it("后段靠节奏型变花样,不是单纯加速", () => {
    expect(patternsFor(0)).toHaveLength(1);
    expect(patternsFor(0)[0].key).toBe("steady");
    expect(patternsFor(100)).toHaveLength(RHYTHM_PATTERNS.length);
    expect(patternsFor(100).map((p) => p.key)).toContain("syncopa");
    expect(patternsFor(100).map((p) => p.key)).toContain("burst");
    expect(patternsFor(100).map((p) => p.key)).toContain("fake");
    // 每种节奏型的小节长度一致,只有拍点位置不同
    for (const p of RHYTHM_PATTERNS) expect(p.span).toBe(4);
  });

  it("抽 24 关看:谱面给得出的分数都够到过关线", () => {
    for (let lv = 0; lv < 188; lv += 8) {
      const c = LEVELS[lv];
      const chart = buildChart(c, 1000 + lv, lv);
      expect(chartMaxPoints(chart), `第 ${lv + 1} 关的谱面不够打到 ${c.target} 分`).toBeGreaterThanOrEqual(c.target);
    }
  });

  it("第 100 / 145 / 188 关都排得满,并且守住本关的同屏上限", () => {
    for (const lv of [99, 144, 187]) {
      const chart = buildChart(LEVELS[lv], 55 + lv, lv);
      expect(chartMaxPoints(chart)).toBeGreaterThanOrEqual(LEVELS[lv].target);
      expect(maxConcurrentOf(chart)).toBeLessThanOrEqual(LEVELS[lv].maxConcurrent);
    }
  });

  it("限流:同一时刻不超过上限,同一个洞不会站两只", () => {
    const crowded = Array.from({ length: 20 }, (_, i) => ({ at: 500, hole: i % 9, kind: "normal" as MoleKind, upMs: 900 }));
    const capped = capConcurrency(crowded, 3);
    expect(capped).toHaveLength(3);
    expect(new Set(capped.map((n) => n.hole)).size).toBe(3);
    expect(capConcurrency(crowded, 0)).toHaveLength(1);
    for (let lv = 0; lv < 188; lv += 17) {
      expect(maxConcurrentOf(buildChart(LEVELS[lv], 9 + lv, lv))).toBeLessThanOrEqual(LEVELS[lv].maxConcurrent);
    }
  });

  it("类型抽取遵守本关占比:没有花花兔的关不会冒出花花兔", () => {
    const clean: MoleLevel = { ...LEVELS[0], bunnyChance: 0, goldChance: 0, sleepyChance: 0 };
    const chart = buildChart(clean, 3, 0);
    expect(chart.some((n) => n.kind === "bunny")).toBe(false);
    let seq = 0;
    const rand = (): number => [0.01, 0.5, 0.99][seq++ % 3];
    expect(rollKind({ ...LEVELS[0], bunnyChance: 0.9 }, rand)).toBe("bunny");
  });

  it("停留期跟着角色倍率走:瞌睡鼠比普通鼠待得久", () => {
    const half = (): number => 0.5;
    expect(stayMsFor(cfg, "sleepy", half)).toBeGreaterThan(stayMsFor(cfg, "normal", half));
    expect(stayMsFor(cfg, "flash", half)).toBeLessThan(stayMsFor(cfg, "normal", half));
  });
});

describe("地鼠嘭嘭 · 无尽地鼠夜市", () => {
  it("seeded 生成可复现,越往后群鼠越常来", () => {
    const early = nightMarketChart(endlessWave(1), 1, 99);
    const late = nightMarketChart(endlessWave(20), 20, 99);
    expect(nightMarketChart(endlessWave(1), 1, 99)).toEqual(early);
    expect(late.length).toBeGreaterThanOrEqual(early.length);
    expect(late.every((n) => n.kind !== "swarm")).toBe(true);
  });

  it("群鼠按间隔插入,展开后同刻三只", () => {
    const base = Array.from({ length: 12 }, (_, i) => ({ at: i * 500, hole: i % 9, kind: "normal" as MoleKind, upMs: 600 }));
    const withs = withSwarms(base, 4);
    expect(withs.length).toBeGreaterThan(base.length);
    expect(withs.every((n) => n.kind !== "swarm")).toBe(true);
    expect(withSwarms(base, 0).length).toBeGreaterThan(base.length);
  });

  it("摊位名随波次轮换,收摊只鼓励", () => {
    expect(nightMarketStall(1)).toBe("糖画摊");
    expect(nightMarketStall(4)).toBe("灯笼摊");
    expect(nightMarketStall(0)).toBe("糖画摊");
    expect(nightMarketLine(9, 4)).toContain("新纪录");
    expect(nightMarketLine(2, 8)).toContain("鼓点");
    expect(nightMarketLine(0, 0)).not.toContain("输");
  });
});

describe("地鼠嘭嘭 · 定时器口袋", () => {
  it("登记过的 setTimeout / setInterval,clearAll 之后一个不剩", () => {
    const { host, live } = fakeHost();
    const bag = new TimerBag(host);
    bag.after(() => undefined, 100);
    bag.after(() => undefined, 200);
    bag.every(() => undefined, 50);
    expect(bag.size).toBe(3);
    expect(live()).toBe(3);
    bag.clearAll();
    expect(bag.size).toBe(0);
    expect(live()).toBe(0);
  });

  it("一次性定时器跑完会自己从口袋里退掉", () => {
    const fired: Array<() => void> = [];
    const host: TimerHost = {
      setTimeout: (fn) => {
        fired.push(fn);
        return fired.length;
      },
      clearTimeout: () => undefined,
      setInterval: () => 0,
      clearInterval: () => undefined,
    };
    const bag = new TimerBag(host);
    bag.after(() => undefined, 10);
    expect(bag.size).toBe(1);
    fired[0]();
    expect(bag.size).toBe(0);
  });

  it("重复 clearAll 也安全", () => {
    const { host, live } = fakeHost();
    const bag = new TimerBag(host);
    bag.every(() => undefined, 30);
    bag.clearAll();
    bag.clearAll();
    expect(bag.size).toBe(0);
    expect(live()).toBe(0);
  });
});
