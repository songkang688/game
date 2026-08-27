// 1.2 第 19 步 A 档：气球砰砰的飘动物理、连锁、五种气球、四类目标与无尽气球节
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { LEVELS } from "./levels";
import {
  CHAIN_MIN,
  CHAIN_RADIUS,
  CHAIN_SCORE_CAP,
  CHAIN_STEP_MS,
  CHAIN_WINDOW_MS,
  ESCAPE_Y,
  FAR_BONUS,
  FEST_MISS_LIMIT,
  GIFT_MAX_ON_SCREEN,
  GIFT_PUSH_PX,
  GIFT_RISE_MUL,
  GOAL_LABELS,
  HIT_PAD,
  Janitor,
  KINDS,
  MIN_BALLOON_D,
  SAME_COLOR_RADIUS,
  SKY_H,
  SPEC_KINDS,
  blastGroup,
  canSpawnGift,
  chainDelays,
  chainDurationMs,
  chainGroup,
  chainScore,
  driftStep,
  festGift,
  festInit,
  festMiss,
  festPlan,
  festPop,
  festRiseSpeed,
  festScoreFor,
  festSpawnMs,
  floatAt,
  goalFailure,
  goalReached,
  isHit,
  isTargetBalloon,
  kindInfo,
  levelGoal,
  rainbowTargets,
  simulateLevel,
  starsFor,
  swayPx,
  tapBalloon,
  twinPartner,
  windShift,
  windSign,
  type AirCfg,
  type ChainNode,
  type GoalState
} from "./logic";

const node = (id: number, x: number, y: number, color: number, kind: ChainNode["kind"] = "normal"): ChainNode => ({
  id,
  x,
  y,
  color,
  kind
});

// ---------------------------------------------------------------------------
// 一、飘动物理与帧率无关
// ---------------------------------------------------------------------------

describe("气球砰砰 · 飘动物理", () => {
  const air: AirCfg = { riseSpeed: 70, wind: 12, windFlipMs: 900 };

  it("上升 / 横摆 / 风都按 delta time 积分，30fps 与 60fps 落在同一个位置", () => {
    const born = 0.4;
    const f = { x0: 40, y0: SKY_H, born, phase: 0.7 };
    for (const fps of [30, 60, 144]) {
      let s = { x: f.x0, y: f.y0, sway: f.phase, age: 0 };
      const dt = 1 / fps;
      const frames = Math.round(3 * fps);
      for (let i = 0; i < frames; i++) s = driftStep(s, dt, air, born);
      const exact = floatAt(f, air, born + 3);
      expect(s.y).toBeCloseTo(exact.y, 6);
      expect(s.x).toBeCloseTo(exact.x, 6);
      expect(swayPx(s.sway)).toBeCloseTo(exact.swayPx, 6);
    }
  });

  it("风向按周期翻面，方波积分算得准（掉帧也不会错过一次翻面）", () => {
    expect(windSign(0, 1000)).toBe(1);
    expect(windSign(1.2, 1000)).toBe(-1);
    expect(windSign(2.5, 1000)).toBe(1);
    // 整整两个周期，来回抵消，净位移是 0
    expect(windShift(0, 2, 10, 1000)).toBeCloseTo(0, 9);
    // 一大步跨过翻面点，和切成小步走的结果一样
    let acc = 0;
    for (let i = 0; i < 200; i++) acc += windShift(i * 0.01, (i + 1) * 0.01, 10, 1000);
    expect(acc).toBeCloseTo(windShift(0, 2, 10, 1000), 9);
    expect(windShift(0, 1, 10)).toBeCloseTo(10, 9);
    expect(windShift(0, 1, 0)).toBe(0);
  });

  it("气球再怎么被风吹也不会飘出画面两侧", () => {
    const f = { x0: 8, y0: SKY_H, born: 0, phase: 0 };
    const strong: AirCfg = { riseSpeed: 60, wind: -80, minX: 4, maxX: 88 };
    expect(floatAt(f, strong, 5).x).toBeGreaterThanOrEqual(4);
    expect(floatAt({ ...f, x0: 80 }, { ...strong, wind: 80 }, 5).x).toBeLessThanOrEqual(88);
  });

  it("上升是匀速的，飘够时间就出界", () => {
    const f = { x0: 40, y0: SKY_H, born: 0, phase: 0 };
    const slow: AirCfg = { riseSpeed: 60 };
    expect(floatAt(f, slow, 1).y).toBeCloseTo(SKY_H - 60, 9);
    expect(floatAt(f, slow, (SKY_H - ESCAPE_Y) / 60 + 0.1).y).toBeLessThan(ESCAPE_Y);
  });

  it("命中热区带 8px 容错，最小气球在 360px 上也点得中", () => {
    expect(MIN_BALLOON_D).toBeGreaterThanOrEqual(40);
    expect(HIT_PAD).toBe(8);
    expect(isHit(180, 200, 180, 200)).toBe(true);
    // 正好在外圈容错里
    expect(isHit(180 + 28 + 7, 200, 180, 200)).toBe(true);
    // 离得太远就不算
    expect(isHit(180 + 28 + 20, 200, 180, 200)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 二、连锁
// ---------------------------------------------------------------------------

describe("气球砰砰 · 连锁", () => {
  it("相邻同色摸成一条链，隔得远的同色不算", () => {
    const list = [node(1, 100, 100, 0), node(2, 160, 120, 0), node(3, 210, 150, 0), node(4, 330, 300, 0)];
    const chain = chainGroup(list, 1);
    expect(chain.sort()).toEqual([1, 2, 3]);
    expect(chain).not.toContain(4);
  });

  it("中间隔着别的颜色就断链（不会跳过去接上）", () => {
    const list = [node(1, 100, 100, 0), node(2, 160, 100, 1), node(3, 220, 100, 0)];
    expect(chainGroup(list, 1)).toEqual([1]);
    // 把中间那颗换成同色，链就接上了
    expect(chainGroup([list[0], node(2, 160, 100, 0), list[2]], 1).sort()).toEqual([1, 2, 3]);
  });

  it("连锁半径就是「挨着」的意思，不会隔半个屏幕", () => {
    expect(SAME_COLOR_RADIUS).toBeLessThanOrEqual(CHAIN_RADIUS);
    const far = [node(1, 10, 10, 2), node(2, 10 + SAME_COLOR_RADIUS + 5, 10, 2)];
    expect(chainGroup(far, 1)).toEqual([1]);
  });

  it("整条链在 250ms 内连完，一颗一颗爆而不是同帧全炸", () => {
    const delays = chainDelays(5);
    expect(delays).toEqual([0, 50, 100, 150, 200]);
    expect(CHAIN_STEP_MS).toBeGreaterThanOrEqual(40);
    expect(CHAIN_STEP_MS).toBeLessThanOrEqual(60);
    expect(chainDurationMs(5)).toBeLessThanOrEqual(CHAIN_WINDOW_MS);
    expect(chainDelays(0)).toEqual([]);
  });

  it("链越长每颗越值钱，但整条封顶（不会一条链打完一关）", () => {
    expect(chainScore(0)).toBe(0);
    let last = -1;
    for (let n = 0; n <= 6; n++) {
      const s = chainScore(n);
      expect(s).toBeGreaterThan(last);
      last = s;
    }
    expect(chainScore(3)).toBeGreaterThan(chainScore(1) * 3 - 1);
    expect(chainScore(50)).toBe(CHAIN_SCORE_CAP);
    expect(chainScore(999)).toBe(CHAIN_SCORE_CAP);
    expect(CHAIN_MIN).toBeGreaterThanOrEqual(2);
  });

  it("连锁气球（🧨）不看颜色炸一片，但绝不碰乌云和礼物", () => {
    const list = [
      node(1, 100, 100, 0, "chain"),
      node(2, 140, 120, 3),
      node(3, 160, 160, 1),
      node(4, 120, 110, 0, "cloud"),
      node(5, 130, 130, 2, "gift"),
      node(6, 350, 400, 1)
    ];
    const hit = blastGroup(list, 1);
    expect(hit.sort()).toEqual([2, 3]);
  });
});

// ---------------------------------------------------------------------------
// 三、五种气球
// ---------------------------------------------------------------------------

describe("气球砰砰 · 五种气球", () => {
  it("五种气球齐活，名字与提示都不含商标英文", () => {
    expect(SPEC_KINDS).toHaveLength(5);
    for (const k of SPEC_KINDS) {
      const info = kindInfo(k);
      expect(info.name.length).toBeGreaterThan(1);
      expect(info.name).not.toMatch(/[A-Za-z]/);
      expect(info.hint).not.toMatch(/[A-Za-z]/);
      expect(info.emoji.length).toBeGreaterThan(0);
    }
    expect(new Set(SPEC_KINDS.map((k) => KINDS[k].name)).size).toBe(5);
  });

  it("普通气球一下就砰，护盾铁气球要敲两下", () => {
    expect(tapBalloon("normal").popped).toBe(true);
    const first = tapBalloon("iron", 0);
    expect(first.popped).toBe(false);
    expect(first.tapsLeft).toBe(1);
    expect(first.hint).toContain("护盾");
    expect(tapBalloon("iron", 1).popped).toBe(true);
  });

  it("礼物气球戳不破：只是摇一摇、往下沉，扣点分但不扣爱心", () => {
    const res = tapBalloon("gift");
    expect(res.popped).toBe(false);
    expect(res.shake).toBe(true);
    expect(res.mistake).toBe(false);
    expect(res.penalty).toBeGreaterThan(0);
    expect(res.pushDown).toBe(GIFT_PUSH_PX);
    expect(res.hint).toContain("礼物");
    expect(res.hint).not.toMatch(/笨|错|失败/);
    // 它飘得比别人慢，是「沙漏」不是靶子
    expect(GIFT_RISE_MUL).toBeLessThan(1);
    expect(GIFT_MAX_ON_SCREEN).toBe(1);
    expect(canSpawnGift(0)).toBe(true);
    expect(canSpawnGift(1)).toBe(false);
  });

  it("乌云球才算「戳错」，礼物气球不算", () => {
    expect(tapBalloon("cloud").mistake).toBe(true);
    expect(tapBalloon("gift").mistake).toBe(false);
  });

  it("彩虹气球清掉场上数量最多的那个颜色（不碰乌云和礼物）", () => {
    const list = [
      node(1, 10, 10, 0),
      node(2, 60, 20, 0),
      node(3, 90, 40, 0),
      node(4, 120, 60, 1),
      node(5, 150, 80, 2, "cloud"),
      node(6, 180, 90, 0, "gift")
    ];
    const res = rainbowTargets(list);
    expect(res.color).toBe(0);
    expect(res.ids.sort()).toEqual([1, 2, 3]);
    expect(rainbowTargets([])).toEqual({ color: -1, ids: [] });
  });

  it("双子气球绑在一起，戳一个另一个跟着爆", () => {
    const list = [node(1, 10, 10, 0, "twin"), node(2, 300, 300, 3, "twin"), node(3, 50, 50, 1)];
    const map = new Map([
      [1, 2],
      [2, 1]
    ]);
    expect(twinPartner(list, 1, map)).toBe(2);
    expect(twinPartner(list, 2, map)).toBe(1);
    expect(twinPartner(list, 3, map)).toBeNull();
    // 伙伴已经不在场上就不用再连
    expect(twinPartner([list[0]], 1, map)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 四、四类目标
// ---------------------------------------------------------------------------

describe("气球砰砰 · 四类目标", () => {
  const st = (over: Partial<GoalState> = {}): GoalState => ({
    popped: 0,
    target: 10,
    escaped: 0,
    escapes: 5,
    mistakes: 0,
    giftLost: 0,
    ...over
  });

  it("四类目标都能从关卡数据里认出来，文案齐全", () => {
    const kinds = new Set(LEVELS.map((cfg) => levelGoal(cfg)));
    expect(kinds).toEqual(new Set(["count", "color", "order", "protect"]));
    for (const label of Object.values(GOAL_LABELS)) {
      expect(label.length).toBeGreaterThan(2);
      expect(label).not.toMatch(/[A-Za-z]/);
    }
  });

  it("数量 / 颜色 / 顺序：戳够数就过关", () => {
    for (const kind of ["count", "color", "order"] as const) {
      expect(goalReached(kind, st({ popped: 9 }))).toBe(false);
      expect(goalReached(kind, st({ popped: 10 }))).toBe(true);
      // 礼物飘走不影响这三类
      expect(goalReached(kind, st({ popped: 10, giftLost: 2 }))).toBe(true);
    }
  });

  it("保护关：戳够数还不够，礼物气球一个都不能放跑", () => {
    expect(goalReached("protect", st({ popped: 10 }))).toBe(true);
    expect(goalReached("protect", st({ popped: 10, giftLost: 1 }))).toBe(false);
    const why = goalFailure("protect", st({ popped: 4, giftLost: 1 }));
    expect(why).toContain("礼物");
    expect(why).not.toMatch(/笨|输了|失败/);
  });

  it("三次戳错 / 飘走超额都会结束，理由只鼓励不批评", () => {
    expect(goalFailure("count", st())).toBeNull();
    expect(goalFailure("count", st({ mistakes: 3 }))).toMatch(/回来|再来|没关系/);
    expect(goalFailure("count", st({ escaped: 6 }))).toContain("再来一次");
    for (const kind of ["count", "color", "order", "protect"] as const) {
      const msg = goalFailure(kind, st({ mistakes: 3 })) ?? "";
      expect(msg).not.toMatch(/[A-Za-z]/);
    }
  });

  it("指定颜色只认颜色，按顺序只认得数，乌云和礼物永远不是目标", () => {
    const colorLv = LEVELS.find((l) => l.mode === "color" && !l.protect);
    const orderLv = LEVELS.find((l) => l.mode === "number");
    expect(colorLv).toBeTruthy();
    expect(orderLv).toBeTruthy();
    expect(isTargetBalloon(colorLv!, { kind: "normal", color: 2, num: 1 }, 2, 1)).toBe(true);
    expect(isTargetBalloon(colorLv!, { kind: "normal", color: 3, num: 1 }, 2, 1)).toBe(false);
    expect(isTargetBalloon(orderLv!, { kind: "normal", color: 0, num: 3 }, 0, 3)).toBe(true);
    expect(isTargetBalloon(orderLv!, { kind: "normal", color: 0, num: 4 }, 0, 3)).toBe(false);
    for (const kind of ["cloud", "gift", "rainbow", "chain"] as const) {
      expect(isTargetBalloon(colorLv!, { kind, color: 2, num: 1 }, 2, 1)).toBe(false);
    }
  });

  it("一次不错、一个不漏才是三星，放跑礼物扣得更多", () => {
    expect(starsFor(0, 0)).toBe(3);
    expect(starsFor(0, 1)).toBe(3);
    expect(starsFor(1, 1)).toBe(2);
    expect(starsFor(2, 2)).toBe(1);
    expect(starsFor(0, 0, 1)).toBe(2);
    expect(starsFor(0, 0, 2)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 五、无尽气球节
// ---------------------------------------------------------------------------

describe("气球砰砰 · 无尽气球节", () => {
  it("同一个种子永远是同一场气球节（可复现）", () => {
    const a = festPlan(20250519, 120);
    const b = festPlan(20250519, 120);
    expect(a).toEqual(b);
    expect(festPlan(1, 120)).not.toEqual(a);
    expect(a).toHaveLength(120);
  });

  it("越往后越密、越快，但密度和速度都有上下限", () => {
    expect(festSpawnMs(0)).toBeGreaterThan(festSpawnMs(20));
    expect(festSpawnMs(9999)).toBeGreaterThanOrEqual(360);
    expect(festRiseSpeed(0)).toBeLessThan(festRiseSpeed(20));
    expect(festRiseSpeed(9999)).toBeLessThanOrEqual(140);
    const plan = festPlan(7, 200);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at).toBeGreaterThan(plan[i - 1].at);
  });

  it("气球节里五种气球都会出场，远层气球分更高", () => {
    const kinds = new Set(festPlan(99, 600).map((p) => p.kind));
    for (const k of SPEC_KINDS) expect(kinds.has(k)).toBe(true);
    expect(festScoreFor("normal", 1, true)).toBe(festScoreFor("normal", 1, false) * FAR_BONUS);
    expect(festScoreFor("iron")).toBeGreaterThan(festScoreFor("normal"));
    expect(festScoreFor("normal", 4)).toBeGreaterThan(festScoreFor("normal", 1));
  });

  it("连击越长加分越多，漏掉 3 个收工", () => {
    let st = festInit();
    const one = festPop(st, "normal").score;
    st = festPop(st, "normal");
    st = festPop(st, "normal");
    expect(festPop(st, "normal").score - st.score).toBeGreaterThan(one);
    expect(st.bestCombo).toBe(2);

    let miss = festInit();
    for (let i = 0; i < FEST_MISS_LIMIT - 1; i++) miss = festMiss(miss);
    expect(miss.over).toBe(false);
    miss = festMiss(miss);
    expect(miss.over).toBe(true);
    // 收工之后再怎么点都不会继续加分
    expect(festPop(miss, "rainbow")).toBe(miss);
    expect(festMiss(miss)).toBe(miss);
  });

  it("戳到礼物气球只扣分、断连击，绝不会因此收工", () => {
    let st = festPop(festInit(), "rainbow");
    const before = st.score;
    st = festGift(st);
    expect(st.score).toBeLessThan(before);
    expect(st.combo).toBe(0);
    expect(st.over).toBe(false);
    expect(st.missed).toBe(0);
    // 分数不会被扣成负的
    expect(festGift(festGift(festGift(festInit()))).score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 六、188 关模拟 + destroy 归零
// ---------------------------------------------------------------------------

describe("气球砰砰 · 188 关够得着（模拟）", () => {
  it("188 关每一关都能被「反应有延迟、手速有上限」的假玩家拿下", () => {
    const stuck: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const res = simulateLevel(LEVELS[lv], { seed: 500 + lv * 7 });
      if (!res.won) stuck.push(`第 ${lv + 1} 关只戳到 ${res.popped}/${res.target}`);
    }
    expect(stuck).toEqual([]);
  });

  it("保护关也过得去：礼物气球一个都没放跑", () => {
    const protects = LEVELS.map((cfg, i) => ({ cfg, i })).filter(({ cfg }) => levelGoal(cfg) === "protect");
    expect(protects.length).toBeGreaterThan(0);
    for (const { cfg, i } of protects) {
      const res = simulateLevel(cfg, { seed: 900 + i });
      expect(res.giftLost, `第 ${i + 1} 关放跑了礼物`).toBe(0);
      expect(res.won).toBe(true);
    }
  });

  it("同一个种子重跑结果一模一样（确定性）", () => {
    const a = simulateLevel(LEVELS[60], { seed: 31337 });
    const b = simulateLevel(LEVELS[60], { seed: 31337 });
    expect(a).toEqual(b);
  });
});

describe("气球砰砰 · destroy 归零", () => {
  it("定时器 / 循环 / rAF / 监听在 destroy 之后一件都不剩", () => {
    const timers = new Set<number>();
    const loops = new Set<number>();
    const frames = new Set<number>();
    let next = 1;
    const jan = new Janitor({
      setTimeout: () => {
        const id = next++;
        timers.add(id);
        return id;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
      setInterval: () => {
        const id = next++;
        loops.add(id);
        return id;
      },
      clearInterval: (id) => {
        loops.delete(id);
      },
      requestAnimationFrame: () => {
        const id = next++;
        frames.add(id);
        return id;
      },
      cancelAnimationFrame: (id) => {
        frames.delete(id);
      }
    });

    let removed = 0;
    const target = {
      addEventListener: () => undefined,
      removeEventListener: () => {
        removed++;
      }
    };
    jan.after(100, () => undefined);
    jan.every(200, () => undefined);
    jan.every(300, () => undefined);
    jan.frame(() => undefined);
    jan.on(target, "pointerdown", () => undefined);
    expect(jan.pending()).toBe(5);

    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(timers.size).toBe(0);
    expect(loops.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(removed).toBe(1);
    expect(jan.dead).toBe(true);
  });

  it("单独停掉一个循环也会从账本上划掉", () => {
    const live = new Set<number>();
    let next = 1;
    const jan = new Janitor({
      setTimeout: () => next++,
      clearTimeout: () => undefined,
      setInterval: () => {
        const id = next++;
        live.add(id);
        return id;
      },
      clearInterval: (id) => {
        live.delete(id);
      }
    });
    const id = jan.every(100, () => undefined);
    expect(jan.pending()).toBe(1);
    jan.stopLoop(id);
    expect(jan.pending()).toBe(0);
    expect(live.size).toBe(0);
    jan.destroy();
    expect(jan.pending()).toBe(0);
  });
});

describe("气球砰砰 · 关卡数据回归", () => {
  it("前 99 关一个 1.2 新字段都没沾", () => {
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].giftChance).toBeUndefined();
      expect(LEVELS[i].twinChance).toBeUndefined();
      expect(LEVELS[i].protect).toBeUndefined();
    }
  });

  it("1.2 的礼物 / 双子只出现在后四片天空，概率都很克制", () => {
    const rand = mulberry32(5);
    expect(rand()).toBeGreaterThan(0);
    for (let i = 99; i < LEVELS.length; i++) {
      expect(LEVELS[i].giftChance ?? 0).toBeLessThanOrEqual(0.12);
      expect(LEVELS[i].twinChance ?? 0).toBeLessThanOrEqual(0.15);
    }
    expect(LEVELS.slice(99).some((l) => (l.giftChance ?? 0) > 0)).toBe(true);
    expect(LEVELS.slice(99).some((l) => (l.twinChance ?? 0) > 0)).toBe(true);
  });
});
