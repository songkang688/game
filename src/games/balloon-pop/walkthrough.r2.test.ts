/**
 * 戳戳小气球 · 窗口 4 档A · 第 2 轮测试员。
 *
 * 第 1 轮只验了第 1 / 100 / 188 关能过。这一轮换关卡、换目标类型（数数 / 挑颜色 / 按顺序 / 护礼物），
 * 专盯难度曲线、竞态、气球节能不能一直戳下去。本段只读不改。
 */
import { describe, it, expect } from "vitest";
import { LEVELS, CHAPTERS } from "./levels";
import {
  simulateLevel, levelGoal, goalReached, goalFailure, giftGuarded, starsFor,
  isTargetBalloon, GOAL_LABELS, type GoalKind, type GoalState,
  chainGroup, blastGroup, chainDelays, chainStepMs, chainDurationMs, chainScore,
  rainbowTargets, twinPartner, tapBalloon, KINDS, canSpawnGift, GIFT_MAX_ON_SCREEN,
  CHAIN_WINDOW_MS, CHAIN_MIN, CHAIN_SCORE_CAP, SAME_COLOR_RADIUS, CHAIN_RADIUS,
  festPlan, festSpawnMs, festRiseSpeed, festInit, festPop, festMiss, festGift,
  FEST_MISS_LIMIT, festScoreFor, festGiftFlightS, floatAt, isHit,
  SKY_H, ESCAPE_Y, BALLOON_W, BALLOON_H, HIT_PAD, MIN_BALLOON_D, GIFT_RISE_MUL,
  type ChainNode
} from "./logic";

/** 这一轮抽查的关卡：四类目标都覆盖到，一个第 1 关都不带 */
const SPOTS = [12, 27, 41, 55, 68, 83, 96, 108, 121, 137, 152, 166, 181];

/** 这一关最慢能允许多久点一下（秒）：数越大越宽松 */
function tapTolerance(lv: number): number {
  let best = 0;
  for (const gap of [0.24, 0.4, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0]) {
    let all = true;
    for (const s of [11, 222, 3333]) {
      if (!simulateLevel(LEVELS[lv - 1], { seed: s, reaction: 0.3, tapGap: gap }).won) {
        all = false;
        break;
      }
    }
    if (all) best = gap;
  }
  return best;
}

describe("戳戳小气球 · R2 · 换关卡再打一遍", () => {
  it("十三关抽查全都能赢，四类目标一个不落", () => {
    const seen = new Set<GoalKind>();
    for (const lv of SPOTS) {
      const cfg = LEVELS[lv - 1];
      seen.add(levelGoal(cfg));
      const res = simulateLevel(cfg, { seed: 7100 + lv });
      expect(res.won, `第 ${lv} 关`).toBe(true);
      expect(res.popped, `第 ${lv} 关`).toBeGreaterThanOrEqual(cfg.target);
      expect(res.seconds, `第 ${lv} 关`).toBeLessThan(180);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("手一直不动就会输，输在放跑的球上——不会卡在半路", () => {
    for (const lv of SPOTS) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 7100 + lv, tapGap: 999 });
      expect(res.won, `第 ${lv} 关`).toBe(false);
      expect(res.escaped, `第 ${lv} 关`).toBeGreaterThan(0);
    }
  });

  it("护礼物那类关卡才会因为礼物飘走扣星，别的关卡礼物只是路人", () => {
    const kinds: GoalKind[] = ["count", "color", "order", "protect"];
    for (const k of kinds) expect(GOAL_LABELS[k].length).toBeGreaterThan(0);
    expect(giftGuarded("protect")).toBe(true);
    for (const k of ["count", "color", "order"] as GoalKind[]) expect(giftGuarded(k)).toBe(false);
    // 抽查里的非护礼物关，模拟一遍不该记上 giftLost
    for (const lv of SPOTS) {
      if (levelGoal(LEVELS[lv - 1]) === "protect") continue;
      const res = simulateLevel(LEVELS[lv - 1], { seed: 7100 + lv });
      expect(res.giftLost, `第 ${lv} 关`).toBe(0);
    }
  });

  it("四类目标各有各的过关判定和失败判定，不会互相串味", () => {
    const base: GoalState = { popped: 0, target: 5, escaped: 0, escapes: 3, mistakes: 0, giftLost: 0 };
    expect(goalReached("count", { ...base, popped: 5 })).toBe(true);
    expect(goalReached("count", { ...base, popped: 4 })).toBe(false);
    expect(goalFailure("count", { ...base, escaped: 4 })).toBeTruthy();
    // 刚好用满机会还不算输：第 3 个飘走时还能继续
    expect(goalFailure("count", { ...base, escaped: 3 })).toBeNull();
    expect(goalFailure("count", base)).toBeNull();
    expect(goalFailure("protect", { ...base, giftLost: 1 })).toBeTruthy();
  });
});

describe("戳戳小气球 · R2 · 难度曲线", () => {
  /**
   * W4A-14（轻微）· 战役难度是锯齿不是斜坡。
   *
   * 用「最慢能允许多久点一下」量每一关的松紧：
   * 前四章确实一章比一章紧（1.71 → 1.34 → 1.15 秒），可最后一章又松回 1.34 秒；
   * 更扎眼的是同一章里相邻两关能差三倍——第 140 关允许两秒点一下，第 141 关只给 0.6 秒。
   * 孩子的体感是「忽松忽紧」，不是「一关比一关难一点点」。
   * 记录在案，交给学习优化员。
   */
  it("W4A-14 特征化：相邻两关的松紧能差三倍", () => {
    const a = tapTolerance(140);
    const b = tapTolerance(141);
    expect(a).toBeGreaterThanOrEqual(1.6);
    expect(b).toBeLessThanOrEqual(0.8);
    expect(a / b).toBeGreaterThanOrEqual(2);
  });

  it("W4A-14 特征化：最后一章反而比中间几章松", () => {
    const avg = (ls: number[]) => ls.reduce((s, lv) => s + tapTolerance(lv), 0) / ls.length;
    const mid = avg([102, 108, 115, 120, 128, 133]);
    const last = avg([145, 150, 160, 168, 176, 182]);
    expect(last).toBeGreaterThan(mid);
  });

  it("章节开头会松一口气：新章第 1 关不比上一章最后一关更凶", () => {
    let at = 0;
    for (let ci = 0; ci < CHAPTERS.length - 1; ci++) {
      at += CHAPTERS[ci].size;
      const last = LEVELS[at - 1];
      const first = LEVELS[at];
      expect(first.riseSpeed, `第 ${ci + 2} 章开头`).toBeLessThanOrEqual(last.riseSpeed);
    }
  });

  it("第 1 关是所有关里最松的那一档——四岁的孩子第一次点就能赢", () => {
    expect(tapTolerance(1)).toBeGreaterThanOrEqual(2);
    for (const lv of [60, 99, 120, 160]) expect(tapTolerance(lv), `第 ${lv} 关`).toBeLessThanOrEqual(tapTolerance(1));
  });

  it("反应慢不是门槛：慢到 2.4 秒才出手，抽查的关照样赢得下来", () => {
    for (const lv of SPOTS) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 1900 + lv, reaction: 2.4, tapGap: 0.24 });
      expect(res.won, `第 ${lv} 关`).toBe(true);
    }
  });
});

describe("戳戳小气球 · R2 · 竞态", () => {
  const row = (n: number, gap: number, color = 1): ChainNode[] =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, x: i * gap, y: 100, color, kind: "normal" as const }));

  it("整条链不管多长都在 250 毫秒里连完——不会响到孩子以为没打中", () => {
    for (let n = CHAIN_MIN; n <= 24; n++) {
      expect(chainDurationMs(n), `${n} 颗`).toBeLessThanOrEqual(CHAIN_WINDOW_MS);
      const d = chainDelays(n);
      expect(d.length).toBe(n);
      expect(d[0]).toBe(0);
      // 一颗接一颗，不是同一帧全炸
      for (let i = 1; i < n; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
      if (n > 1) expect(d[n - 1]).toBeGreaterThan(0);
    }
    expect(chainStepMs(3)).toBe(50);
    expect(chainStepMs(20)).toBeLessThan(50);
  });

  it("链在爆的半路上再戳一下，波及范围不会越滚越大", () => {
    const list = row(8, 40);
    const first = chainGroup(list, 1);
    // 已经在链里的再戳一次，拿到的还是同一批
    const again = chainGroup(list, first[first.length - 1]);
    expect(new Set(again).size).toBe(again.length);
    for (const id of again) expect(first).toContain(id);
  });

  it("同色连爆要够 3 颗才算数，离得远的不跟着响", () => {
    expect(chainGroup(row(2, 40), 1).length).toBeLessThan(CHAIN_MIN);
    expect(chainGroup(row(4, 40), 1).length).toBeGreaterThanOrEqual(CHAIN_MIN);
    // 隔开一个半径就断开
    expect(chainGroup(row(4, SAME_COLOR_RADIUS + 20), 1).length).toBeLessThan(CHAIN_MIN);
  });

  it("连锁气球的波及圈和同色圈各算各的，半径不会串", () => {
    const mixed: ChainNode[] = [
      { id: 1, x: 0, y: 0, color: 1, kind: "normal" },
      { id: 2, x: CHAIN_RADIUS - 10, y: 0, color: 9, kind: "normal" },
      { id: 3, x: CHAIN_RADIUS + 40, y: 0, color: 1, kind: "normal" }
    ];
    const blast = blastGroup(mixed, 1);
    expect(blast).toContain(2);
    expect(blast).not.toContain(3);
    expect(chainGroup(mixed, 1)).not.toContain(2);
  });

  it("一条链再长也不会刷爆分数：封顶在 120 分", () => {
    expect(chainScore(3)).toBeGreaterThan(0);
    expect(chainScore(50)).toBeLessThanOrEqual(CHAIN_SCORE_CAP);
    expect(chainScore(200)).toBe(chainScore(50));
  });

  it("铁气球第一下只碎盾、第二下才破，连点两下不会算成两颗", () => {
    const first = tapBalloon("iron", 0);
    expect(first.popped).toBe(false);
    expect(first.tapsLeft).toBe(1);
    const second = tapBalloon("iron", 1);
    expect(second.popped).toBe(true);
    expect(second.tapsLeft).toBe(0);
    // 超打也不会变成负数
    expect(tapBalloon("iron", 5).tapsLeft).toBe(0);
  });

  it("双子气球互相认得对方，戳哪一个都能找到另一个；对方没了就返回空", () => {
    const list = row(2, 40);
    const map = new Map([[1, 2], [2, 1]]);
    expect(twinPartner(list, 1, map)).toBe(2);
    expect(twinPartner(list, 2, map)).toBe(1);
    expect(twinPartner([list[0]], 1, map)).toBeNull();
  });

  it("彩虹气球只带走同色的，别的颜色一颗都不碰", () => {
    const mixed: ChainNode[] = [
      { id: 1, x: 0, y: 0, color: 3, kind: "normal" },
      { id: 2, x: 300, y: 300, color: 3, kind: "normal" },
      { id: 3, x: 50, y: 50, color: 4, kind: "normal" }
    ];
    const r = rainbowTargets(mixed);
    expect(r.ids.length).toBeGreaterThan(0);
    for (const id of r.ids) expect(mixed.find((m) => m.id === id)!.color).toBe(r.color);
  });

  it("礼物气球怎么点都不会破，只往下沉——手滑连点也不会送走它", () => {
    let push = 0;
    for (let i = 0; i < 5; i++) {
      const t = tapBalloon("gift", i);
      expect(t.popped).toBe(false);
      expect(t.shake).toBe(true);
      expect(t.mistake).toBe(false);
      push += t.pushDown;
    }
    expect(push).toBeGreaterThan(0);
  });

  it("天上同时最多挂一个礼物气球，出场表也得守这条规矩", () => {
    expect(canSpawnGift(0)).toBe(true);
    expect(canSpawnGift(GIFT_MAX_ON_SCREEN)).toBe(false);
    for (const seed of [3, 77, 512, 9001]) {
      const plan = festPlan(seed, 400);
      const gifts = plan.map((p, i) => ({ ...p, i })).filter((p) => p.kind === "gift");
      for (let k = 1; k < gifts.length; k++) {
        const gap = gifts[k].at - gifts[k - 1].at;
        expect(gap, `seed ${seed} 第 ${k} 个礼物`).toBeGreaterThanOrEqual(festGiftFlightS(gifts[k - 1].i) - 1e-6);
      }
    }
  });

  it("两颗气球挨得再近也留得下手指落点：最小间距盖得住误触", () => {
    expect(MIN_BALLOON_D).toBeGreaterThan(0);
    // 相隔一个最小间距时，点在其中一颗的正中不会同时命中另一颗
    expect(isHit(0, 0, 0, 0)).toBe(true);
    expect(isHit(0, 0, BALLOON_W / 2 + HIT_PAD + 1, 0)).toBe(false);
    expect(BALLOON_H).toBeGreaterThan(BALLOON_W / 2);
  });

  /**
   * W4A-13（轻微）· 每出一个新气球，天上所有气球会往上跳一下。
   *
   * `tick` 里算上升速度用的是 `festRiseSpeed(planAt - 1)`——planAt 是「已经出到第几个」，
   * 每出一个新球就加一。而 `floatAt` 是拿这个速度乘气球的**全部年龄**算位置的，
   * 于是速度一变，老气球的 y 立刻整体挪一截：飘了 5 秒的球每次跳 5.5 像素。
   * 密的时候一秒出两三个，看上去就是「气球在抽搐」，而且实际逃逸得比设计的更早。
   * 记录在案，交给学习优化员：速度该按气球自己的出生波次算，别用全局波次。
   */
  it("W4A-13 特征化：波次一涨，老气球的位置就跳一截", () => {
    const f = { x0: 50, y0: SKY_H + 40, born: 0, phase: 0 };
    for (const age of [1, 3, 5]) {
      const before = floatAt(f, { riseSpeed: festRiseSpeed(40) }, age).y;
      const after = floatAt(f, { riseSpeed: festRiseSpeed(41) }, age).y;
      expect(before - after).toBeCloseTo(1.1 * age, 5);
    }
    // 越老跳得越狠：这正是「用全局波次算位置」的味道
    const jump = (age: number) =>
      floatAt(f, { riseSpeed: festRiseSpeed(40) }, age).y - floatAt(f, { riseSpeed: festRiseSpeed(41) }, age).y;
    expect(jump(5)).toBeGreaterThan(jump(1));
  });
});

describe("戳戳小气球 · R2 · 气球节能不能一直戳下去", () => {
  it("越往后越密越快，但都有封顶——不会快到看不见", () => {
    expect(festSpawnMs(0)).toBeGreaterThan(festSpawnMs(30));
    expect(festSpawnMs(61)).toBe(360);
    expect(festSpawnMs(999)).toBe(360);
    expect(festRiseSpeed(0)).toBeLessThan(festRiseSpeed(40));
    expect(festRiseSpeed(80)).toBe(140);
    expect(festRiseSpeed(999)).toBe(140);
  });

  it("封顶之后气球还能在天上待将近 4 秒：来得及看清、来得及点", () => {
    const life = (SKY_H + 40 - ESCAPE_Y) / festRiseSpeed(999);
    expect(life).toBeGreaterThan(3.5);
    // 礼物球飘得更慢，护起来更从容
    expect(festGiftFlightS(999)).toBeGreaterThan(life);
    expect(GIFT_RISE_MUL).toBeLessThan(1);
  });

  /**
   * W4A-12（中等）· 气球节其实只有五分四十秒。
   *
   * `reset()` 排的是一张 900 个球的固定表，`spawnFromPlan` 走完就不再出球；
   * 而 `tick` 里没有任何「表用完了」的分支——`st.over` 只会被「放跑三个」点亮。
   * 所以孩子要是一个都没放跑，第 341 秒之后天空会彻底空掉：
   * 不再出球、不结算、不给分，画面就那样一直挂着，只能按退出。
   * 比「无尽提前收工」更难受的是它连收工都没有。
   * 记录在案，交给学习优化员：表走完要接着排，别让天空空掉。
   */
  it("W4A-12 特征化：900 个球的表 341 秒就走完，之后天空是空的", () => {
    const plan = festPlan(7, 900);
    const total = plan[plan.length - 1].at;
    expect(total).toBeGreaterThan(300);
    expect(total).toBeLessThan(400);
    expect(plan.every((p) => p.at <= total)).toBe(true);
    // 表本身是有限的：不存在「排到第 900 个之后还有」
    expect(plan.length).toBe(900);
  });

  it("真戳一场：连击一直加分，加成封顶在每颗 +20", () => {
    let st = festInit();
    for (let i = 0; i < 60; i++) {
      const before = st.score;
      st = festPop(st, "normal");
      expect(st.score).toBeGreaterThan(before);
    }
    expect(st.over).toBe(false);
    expect(st.bestCombo).toBe(60);
    const base = festScoreFor("normal");
    expect(st.score - (st.score - base - 20)).toBe(base + 20);
  });

  it("放跑三个才收场，收场之后再放再戳都不动数", () => {
    let st = festInit();
    for (let i = 0; i < FEST_MISS_LIMIT - 1; i++) st = festMiss(st);
    expect(st.over).toBe(false);
    st = festMiss(st);
    expect(st.over).toBe(true);
    const frozen = st;
    expect(festMiss(st)).toBe(frozen);
    expect(festPop(st, "rainbow")).toBe(frozen);
    expect(festGift(st)).toBe(frozen);
  });

  it("戳到礼物只扣分不收场，而且扣不到负数", () => {
    let st = festInit();
    for (let i = 0; i < 10; i++) st = festGift(st);
    expect(st.score).toBe(0);
    expect(st.over).toBe(false);
    expect(st.missed).toBe(0);
  });

  it("远层气球小一点、分高一倍：伪纵深是真的给到甜头", () => {
    expect(festScoreFor("normal", 1, true)).toBeGreaterThan(festScoreFor("normal", 1, false));
    expect(festScoreFor("rainbow")).toBeGreaterThan(festScoreFor("normal"));
  });
});

describe("戳戳小气球 · R2 · 360px 再走一遍", () => {
  it("出场表的横向位置都落在 8%~84%，360 宽下气球贴不到边", () => {
    for (const seed of [1, 42, 777]) {
      for (const p of festPlan(seed, 300)) {
        expect(p.x).toBeGreaterThanOrEqual(8);
        expect(p.x).toBeLessThanOrEqual(84);
      }
    }
  });

  it("气球本体够大：360 宽下也是能一指头点中的靶子", () => {
    expect(BALLOON_W + HIT_PAD * 2).toBeGreaterThanOrEqual(44);
    expect(BALLOON_H + HIT_PAD * 2).toBeGreaterThanOrEqual(44);
  });

  it("每种气球都有名字、图标和提示语，窄屏 HUD 里不会缺字", () => {
    for (const info of Object.values(KINDS)) {
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.emoji.length).toBeGreaterThan(0);
      expect(info.hint.length).toBeGreaterThan(4);
      expect(info.hint).not.toMatch(/失败|笨|不行|错了/);
    }
  });

  it("挑颜色那类关卡认的是「哪一颗该戳」，按顺序关只认数字——色弱也玩得了", () => {
    const b = { kind: "normal" as const, color: 2, num: 3 };
    const colorLevel = LEVELS.find((l) => levelGoal(l) === "color")!;
    const orderLevel = LEVELS.find((l) => levelGoal(l) === "order")!;
    expect(isTargetBalloon(colorLevel, b, 2, 1)).toBe(true);
    expect(isTargetBalloon(colorLevel, b, 3, 1)).toBe(false);
    // 按顺序关看的是数字，跟颜色无关
    expect(isTargetBalloon(orderLevel, b, 9, 3)).toBe(true);
    expect(isTargetBalloon(orderLevel, b, 2, 4)).toBe(false);
    // 乌云球和礼物球永远不是靶子
    expect(isTargetBalloon(colorLevel, { kind: "cloud", color: 2, num: 3 }, 2, 3)).toBe(false);
    expect(isTargetBalloon(colorLevel, { kind: "gift", color: 2, num: 3 }, 2, 3)).toBe(false);
    expect(starsFor(0, 0, 0)).toBe(3);
    expect(starsFor(3, 3, 1)).toBe(1);
  });
});
