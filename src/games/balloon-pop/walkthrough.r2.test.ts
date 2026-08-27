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
  festExtend, FEST_CHUNK,
  type ChainNode
} from "./logic";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

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
   * W4A-14（轻微）· 本轮监督修复员的结论：一半是量错了，一半是真的，真的那半已经改掉。
   *
   * 「相邻两关差三倍」这一半量错了。第 8 / 10 章是**两种玩法轮着来**的
   * （`t % 3 === 2 ? "color" : "free"` / `t % 2 === 0 ? "free" : "color"`）：
   * 自由关要戳掉飘上来的每一个球，指定色关一屏里该戳的只占五分之一。
   * 拿同一把「几秒点一下」的尺子量这两种关，差三倍是必然的，那不是难度锯齿，
   * 是两件不一样的事——就像不能拿跑步的配速去量跳绳。第 140 / 141 关正是
   * 一关指定色、一关自由。按玩法分开量，每一档自己都是干净的下坡（见下一条）。
   *
   * 「最后一章反而比中间几章松」这一半是真的。只比自由关：
   * 第 7 章紧到 0.8 秒、第 8 章 0.6 秒，第 10 章原来只紧到 0.8 秒——
   * 收尾这一章成了喘气的地方。已把第 10 章的坡压陡（`riseSpeed` / `spawnMs`），
   * 现在也紧到 0.6 秒，且仍在 `levels188.test.ts` 定的可玩上下界之内。
   */
  it("W4A-14 已修：按玩法分开量，同一章里每一档自己都是干净的下坡", () => {
    let at = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      const byMode = new Map<string, number[]>();
      for (let t = 0; t < size; t++) {
        const cfg = LEVELS[at + t];
        // 护礼物关是每三关插一关的特别关，自成一档
        const key = `${cfg.mode}${cfg.protect ? "+护" : ""}`;
        const list = byMode.get(key) ?? [];
        list.push(tapTolerance(at + t + 1));
        byMode.set(key, list);
      }
      for (const [key, list] of byMode) {
        if (list.length < 4) continue;
        const head = list.slice(0, Math.ceil(list.length / 2));
        const tail = list.slice(Math.ceil(list.length / 2));
        const avg = (l: number[]) => l.reduce((s, v) => s + v, 0) / l.length;
        expect(avg(tail), `第 ${ci + 1} 章 ${key} 后半段该比前半段紧`).toBeLessThanOrEqual(avg(head));
      }
      at += size;
    }
  });

  it("W4A-14 已修：第 140 / 141 关的三倍差是玩法不同，不是难度跳变", () => {
    expect(LEVELS[139].mode).toBe("color");
    expect(LEVELS[140].mode).toBe("free");
    // 同为自由关的相邻样本，松紧就贴得很近
    for (const [a, b] of [[123, 124], [126, 127], [129, 130]] as const) {
      expect(LEVELS[a - 1].mode).toBe("free");
      expect(LEVELS[b - 1].mode).toBe("free");
      const r = tapTolerance(a) / tapTolerance(b);
      expect(Math.max(r, 1 / r), `第 ${a} / ${b} 关`).toBeLessThanOrEqual(1.5);
    }
  });

  it("W4A-14 已修：只比自由关，末章现在紧过第 7 章、追平第 8 章", () => {
    const freeTol = (ci: number): number[] => {
      const at = CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
      const out: number[] = [];
      for (let t = 0; t < CHAPTERS[ci].size; t++) {
        if (LEVELS[at + t].mode === "free") out.push(tapTolerance(at + t + 1));
      }
      return out;
    };
    const tight = (ci: number) => Math.min(...freeTol(ci));
    expect(tight(9)).toBeLessThan(tight(6));
    expect(tight(9)).toBeLessThanOrEqual(tight(7));
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
   * W4A-12（中等）· 已由本轮监督修复员修掉。
   *
   * 原状：`reset()` 排一张 900 个球的固定表，`spawnFromPlan` 走完就不再出球，
   * 而 `tick` 里没有任何「表用完了」的分支——`st.over` 只会被「放跑三个」点亮。
   * 孩子要是一个都没放跑，第 341 秒之后天空彻底空掉：不出球、不结算、不给分。
   *
   * 现状：900 个改成「一段」（`FEST_CHUNK`）。`spawnFromPlan` 每帧先 `topUpPlan()`，
   * 只剩 `FEST_LOOKAHEAD` 个没出场就用 `festExtend` 续下一段。
   */
  it("W4A-12 已修：一段接一段续得下去，续到一小时以后天上还有球", () => {
    let plan = festPlan(7, FEST_CHUNK);
    expect(plan[plan.length - 1].at).toBeLessThan(400);

    let seed = 7;
    for (let seg = 0; seg < 10; seg++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      plan = plan.concat(festExtend(plan, seed, FEST_CHUNK));
    }
    expect(plan.length).toBe(FEST_CHUNK * 11);
    expect(plan[plan.length - 1].at).toBeGreaterThan(55 * 60);
  });

  it("W4A-12 已修：接缝处的间隔就是封顶的 360ms，不会突然静场也不会挤成一堆", () => {
    const head = festPlan(31, FEST_CHUNK);
    const tail = festExtend(head, 32, FEST_CHUNK);
    const seam = tail[0].at - head[head.length - 1].at;
    expect(seam).toBeCloseTo(festSpawnMs(FEST_CHUNK - 1) / 1000, 6);
    expect(seam).toBeCloseTo(0.36, 6);
    // 续段内部的时刻严格递增，一个都不会往回排
    for (let i = 1; i < tail.length; i++) expect(tail[i].at).toBeGreaterThan(tail[i - 1].at);
  });

  it("W4A-12 已修：续段里礼物球照样不撞上限——两个礼物之间隔得够飘完", () => {
    const head = festPlan(88, FEST_CHUNK);
    const tail = festExtend(head, 89, FEST_CHUNK);
    const gifts = tail.filter((p) => p.kind === "gift");
    expect(gifts.length).toBeGreaterThan(0);
    for (let i = 1; i < gifts.length; i++) {
      expect(gifts[i].at - gifts[i - 1].at).toBeGreaterThanOrEqual(festGiftFlightS(999) - 1e-9);
    }
  });

  it("W4A-12 已修：index.ts 每帧都先续表，天空不会空掉", () => {
    expect(SRC).toMatch(/function topUpPlan/);
    expect(SRC).toMatch(/festExtend\(plan, festSeed, FEST_CHUNK\)/);
    expect(SRC).toMatch(/function spawnFromPlan\(\): void \{\s*topUpPlan\(\);/);
    // 不再有写死的 900
    expect(SRC).not.toMatch(/festPlan\([^)]*,\s*900\)/);
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
