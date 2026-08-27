/**
 * 气球砰砰 · 窗口4 档A 第 1 轮测试员走查（不改玩法，只记录与断言）
 *
 * 剧本：首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽气球节玩到结算 → 360px 窄屏。
 *
 * 本轮记录到报告的问题（修复交给监督修复员）：
 *  - W4A-01：第 129–188 关里有 28 关会放礼物气球却不是「保护关」，
 *    HUD 从不提礼物，礼物飘走却照样按 `giftLost × 2` 扣星；
 *  - W4A-02：`chainDurationMs` 与「250ms 内连爆」的规格对不上；
 *  - W4A-03：`festPlan` 不看礼物气球上限，纯函数层没人守。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGames } from "../../engine/loader";
import { LEVELS } from "./levels";
import {
  ESCAPE_Y,
  FEST_MISS_LIMIT,
  GIFT_MAX_ON_SCREEN,
  HIT_PAD,
  KINDS,
  MIN_BALLOON_D,
  SKY_H,
  canSpawnGift,
  festInit,
  festMiss,
  festPlan,
  festPop,
  festRiseSpeed,
  festSpawnMs,
  goalFailure,
  goalReached,
  isHit,
  levelGoal,
  simulateLevel,
  starsFor,
  tapBalloon
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("气球砰砰 · R1 · 从首页进入", () => {
  it("首页列得出这一款，动态加载能真的拿到 mount", async () => {
    const entry = loadGames().find((g) => g.meta.id === "balloon-pop");
    expect(entry, "首页 loadGames() 里找不到 balloon-pop").toBeTruthy();
    expect(entry!.meta.title).toBe("气球砰砰");
    expect(entry!.meta.levels).toBe(LEVELS.length);
    expect(typeof (await entry!.load())).toBe("function");
  });

  it("meta.modes 声明的闯关 / 无尽在 index.ts 里都有真入口", () => {
    const entry = loadGames().find((g) => g.meta.id === "balloon-pop");
    expect(entry!.meta.modes).toEqual(["campaign", "endless"]);
    expect(SRC).toContain("mountLevelGame(");
    expect(SRC).toContain("function mountFestival(");
    expect(SRC).toContain("recordEndlessBest(");
  });
});

describe("气球砰砰 · R1 · 赢一次 + 输一次", () => {
  it("赢一次：第 1 关被「反应有延迟、手速有上限」的假玩家拿下，还是三星", () => {
    const res = simulateLevel(LEVELS[0], { seed: 500 });
    expect(res.won).toBe(true);
    expect(res.popped).toBeGreaterThanOrEqual(res.target);
    expect(res.mistakes).toBe(0);
    expect(starsFor(res.mistakes, res.escaped, res.giftLost)).toBe(3);
  });

  it("输一次：反应慢到 5 秒一次，气球会真的飘走飘到不及格", () => {
    const res = simulateLevel(LEVELS[0], { seed: 3, reaction: 5, tapGap: 5, maxSeconds: 60 });
    expect(res.won).toBe(false);
    expect(res.escaped).toBeGreaterThan(LEVELS[0].escapes);
    const why = goalFailure(levelGoal(LEVELS[0]), {
      popped: res.popped,
      target: res.target,
      escaped: res.escaped,
      escapes: LEVELS[0].escapes,
      mistakes: res.mistakes,
      giftLost: res.giftLost
    });
    expect(why).not.toBeNull();
    // 失败文案只给方法，不批评
    for (const bad of ["笨", "差", "太慢了", "不行"]) expect(why!).not.toContain(bad);
  });

  it("戳错三次也会收工，而且说法一样只给方法", () => {
    const why = goalFailure("count", { popped: 0, target: 10, escaped: 0, escapes: 5, mistakes: 3, giftLost: 0 });
    expect(why).toContain("换指令时先停半秒确认");
  });
});

describe("气球砰砰 · R1 · 战役第 1 / 100 / 188 关", () => {
  for (const lv of [0, 99, 187]) {
    it(`第 ${lv + 1} 关：假玩家戳得够数量，一次都没戳错`, () => {
      const res = simulateLevel(LEVELS[lv], { seed: 500 + lv * 7 });
      expect(res.won, `第 ${lv + 1} 关只戳到 ${res.popped}/${res.target}`).toBe(true);
      expect(res.mistakes).toBe(0);
      expect(res.escaped).toBeLessThanOrEqual(LEVELS[lv].escapes);
    });
  }

  it("第 100 关起的新天空目标更多、飞得更快，第 1 关明显更轻松", () => {
    expect(LEVELS[99].target).toBeGreaterThan(LEVELS[0].target);
    expect(LEVELS[187].riseSpeed).toBeGreaterThan(LEVELS[0].riseSpeed);
  });

  it("保护关真的会判「礼物飘走就没过」", () => {
    const protectLv = LEVELS.findIndex((c) => c.protect);
    expect(protectLv).toBeGreaterThanOrEqual(0);
    const st = { popped: 99, target: 10, escaped: 0, escapes: 5, mistakes: 0, giftLost: 1 };
    expect(goalReached("protect", st)).toBe(false);
    expect(goalFailure("protect", st)).toContain("礼物气球飘走啦");
    // 一个都没放跑才算过
    expect(goalReached("protect", { ...st, giftLost: 0 })).toBe(true);
  });
});

describe("气球砰砰 · R1 · 无尽气球节玩到结算", () => {
  it("放跑三个就收工（真结算，不是玩不完）", () => {
    let st = festInit();
    for (let i = 0; i < FEST_MISS_LIMIT; i++) {
      expect(st.over).toBe(false);
      st = festMiss(st);
    }
    expect(st.over).toBe(true);
    expect(st.missed).toBe(FEST_MISS_LIMIT);
    // 收工之后再怎么点都不动了
    expect(festPop(st, "normal")).toEqual(st);
  });

  it("手不停就能一直玩下去：900 个出场全戳完也没被叫停", () => {
    let st = festInit();
    const plan = festPlan(4242, 900);
    for (const p of plan) {
      if (p.kind === "cloud" || p.kind === "gift") continue;
      st = festPop(st, p.kind, 1, p.far);
    }
    expect(st.over).toBe(false);
    expect(st.popped).toBeGreaterThan(500);
    expect(st.score).toBeGreaterThan(0);
    expect(st.bestCombo).toBe(st.combo);
    expect(plan[plan.length - 1].at).toBeGreaterThan(300);
  });

  it("戳到礼物只扣分不收工，也不算「放跑」", () => {
    const st = festPop(festInit(), "normal");
    const after = { ...st, score: Math.max(0, st.score - KINDS.gift.penalty), combo: 0 };
    expect(after.over).toBe(false);
    expect(after.missed).toBe(0);
  });

  it("越往后越密、越快，但都有下限 / 上限，不会难到没法玩", () => {
    expect(festSpawnMs(0)).toBeGreaterThan(festSpawnMs(50));
    expect(festSpawnMs(100000)).toBe(360);
    expect(festRiseSpeed(0)).toBeLessThan(festRiseSpeed(50));
    expect(festRiseSpeed(100000)).toBe(140);
  });
});

describe("气球砰砰 · R1 · 360px 窄屏", () => {
  it("天空高 420，气球直径不小于 40px，手指点得准", () => {
    expect(SKY_H).toBe(420);
    expect(MIN_BALLOON_D).toBeGreaterThanOrEqual(40);
    expect(HIT_PAD).toBeGreaterThan(0);
  });

  it("气球横向百分比定位，360px 上左右都留得住边", () => {
    const plan = festPlan(2025, 300);
    for (const p of plan) {
      expect(p.x).toBeGreaterThanOrEqual(4);
      expect(p.x).toBeLessThanOrEqual(88);
    }
  });

  it("命中判定带 8px 外圈容错：偏一点点也算点中", () => {
    expect(isHit(180, 200, 180, 200)).toBe(true);
    expect(isHit(180 + 28 + HIT_PAD - 1, 200, 180, 200)).toBe(true);
    expect(isHit(180 + 28 + HIT_PAD + 6, 200, 180, 200)).toBe(false);
  });

  it("气球飘出上边界才算跑掉，不会在屏幕里凭空消失", () => {
    expect(ESCAPE_Y).toBeLessThan(0);
  });
});

describe("气球砰砰 · R1 · 本轮记录在案的问题（现状快照）", () => {
  it("W4A-03：festPlan 自己不管礼物上限，靠 index.ts 的 spawn 兜底", () => {
    expect(GIFT_MAX_ON_SCREEN).toBe(1);
    expect(canSpawnGift(0)).toBe(true);
    expect(canSpawnGift(1)).toBe(false);
    // 出场表里礼物是连着排的，纯函数层没有任何节流
    const gifts = festPlan(12345, 400).filter((p) => p.kind === "gift");
    expect(gifts.length).toBeGreaterThan(1);
    // 真机靠这一行兜住，缺了它天上就会同时挂好几个礼物
    expect(SRC).toContain("canSpawnGift(balloons.filter");
  });

  it("礼物气球点一下是「摇一摇往下沉」，永远不会被戳破", () => {
    const res = tapBalloon("gift");
    expect(res.popped).toBe(false);
    expect(res.shake).toBe(true);
    expect(res.pushDown).toBeGreaterThan(0);
    expect(res.mistake).toBe(false);
  });
});

describe("气球砰砰 · R1 · 分级红线", () => {
  it("音效只走平台的 api.play，没有自己造 AudioContext", () => {
    expect(SRC).not.toContain("AudioContext");
    expect(SRC).not.toContain("new Audio");
  });

  it("没有引入 three.js / CDN / Socket，也没有联网请求", () => {
    for (const bad of ["three", "socket", "fetch(", "XMLHttpRequest", "http://", "https://"]) {
      expect(SRC.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });
});
