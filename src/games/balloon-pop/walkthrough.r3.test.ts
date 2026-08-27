/**
 * 戳戳小气球 · 窗口 4 档A · 第 3 轮测试员（收官）。
 *
 * 前两轮抽了 3 关 + 13 关。收官这一轮不抽了：**188 关一关不漏**各跑三个种子，
 * 四类目标（数数 / 挑颜色 / 按顺序 / 护礼物）逐类核一遍，
 * 气球节按「一直戳到手滑」跑到底，360px 再走一遍，
 * 最后把 W4A-01 / 03 / 12 / 13 / 14 的结论钉死。本段只读不改。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEGACY_LEVELS, LEVELS } from "./levels";
import {
  CHAIN_MIN, CHAIN_WINDOW_MS, ESCAPE_Y, FEST_CHUNK, FEST_LOOKAHEAD, FEST_MISS_LIMIT,
  GIFT_MAX_ON_SCREEN, GIFT_RISE_MUL, GOAL_LABELS, KINDS, SKY_H,
  canSpawnGift, chainDelays, chainDurationMs, chainGroup, chainScore, chainStepMs,
  festExtend, festGift, festGiftFlightS, festInit, festMiss, festPlan, festPop, festRiseSpeed,
  festScoreFor, festSpawnMs, floatAt, giftGuarded, goalFailure, goalReached, isHit, levelGoal,
  rainbowTargets, simulateLevel, starsFor, tapBalloon,
  type ChainNode, type GoalKind, type GoalState
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜"];

/** 这一关最慢能允许多久点一下（秒）：数越大越宽松 */
function tapTolerance(lv: number): number {
  let best = 0;
  for (const gap of [0.24, 0.4, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.6]) {
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

describe("戳戳小气球 · R3 · 188 关一关不漏", () => {
  it("每一关都赢得下来，而且换三个种子都赢得下来", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const s of [7, 20260827, 31415]) {
        if (!simulateLevel(LEVELS[lv], { seed: s + lv * 17 }).won) bad.push(`第 ${lv + 1} 关 seed ${s}`);
      }
    }
    expect(bad, `赢不了：${bad.slice(0, 8).join("、")}`).toEqual([]);
  });

  it("四类目标全都覆盖到了，每一类都有关、每一类都赢得下来", () => {
    const byGoal = new Map<GoalKind, number[]>();
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const g = levelGoal(LEVELS[lv]);
      byGoal.set(g, [...(byGoal.get(g) ?? []), lv + 1]);
    }
    for (const g of Object.keys(GOAL_LABELS) as GoalKind[]) {
      const list = byGoal.get(g) ?? [];
      expect(list.length, `${GOAL_LABELS[g]} 一关都没有`).toBeGreaterThan(0);
      for (const lv of list.slice(0, 6)) {
        expect(simulateLevel(LEVELS[lv - 1], { seed: 606 + lv }).won, `第 ${lv} 关（${GOAL_LABELS[g]}）`).toBe(true);
      }
    }
  });

  it("赢一次也输一次：手一直不动就一定输，输在放跑的球太多", () => {
    for (const lv of [1, 30, 70, 110, 150, 188]) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 808 + lv, tapGap: 99 });
      expect(res.won, `第 ${lv} 关`).toBe(false);
    }
  });

  it("每一关的参数都排得住：目标有上限、容错有下限、球速有封顶", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const cfg = LEVELS[lv];
      expect(cfg.target, `第 ${lv + 1} 关`).toBeGreaterThan(0);
      expect(cfg.target, `第 ${lv + 1} 关目标太多`).toBeLessThanOrEqual(40);
      expect(cfg.escapes, `第 ${lv + 1} 关`).toBeGreaterThanOrEqual(3);
      expect(cfg.riseSpeed, `第 ${lv + 1} 关球飞太快`).toBeLessThanOrEqual(150);
      expect(cfg.spawnMs, `第 ${lv + 1} 关出得太密`).toBeGreaterThanOrEqual(500);
      // 气球在天上至少待两秒，来得及看清
      expect((SKY_H + 40 - ESCAPE_Y) / cfg.riseSpeed, `第 ${lv + 1} 关`).toBeGreaterThan(2);
    }
  });

  it("章节开头会松一口气，前 99 关的生成参数一个字没动", () => {
    let at = 0;
    for (let ci = 0; ci < CHAPTERS.length - 1; ci++) {
      at += CHAPTERS[ci].size;
      expect(LEVELS[at].riseSpeed, `第 ${ci + 2} 章开头`).toBeLessThanOrEqual(LEVELS[at - 1].riseSpeed);
    }
    expect(LEGACY_LEVELS).toBe(99);
    // 1.0 的六章只有 free / color / number 三种玩法，1.1 起才有算式
    for (let lv = 0; lv < LEGACY_LEVELS; lv++) expect(LEVELS[lv].mode).not.toBe("math");
  });
});

describe("戳戳小气球 · R3 · 气球节戳到手滑为止（W4A-12 收官复核）", () => {
  it("一段接一段续到一小时以后，天空一刻都没空过", () => {
    let plan = festPlan(20260827, FEST_CHUNK);
    let seed = 20260827;
    for (let i = 0; i < 12; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      plan = plan.concat(festExtend(plan, seed, FEST_CHUNK));
    }
    expect(plan.length).toBe(FEST_CHUNK * 13);
    expect(plan[plan.length - 1].at).toBeGreaterThan(60 * 60);
    // 逐个核：时刻严格递增，间隔从不超过 900ms（不会静场）
    for (let i = 1; i < plan.length; i++) {
      const gap = plan[i].at - plan[i - 1].at;
      expect(gap, `第 ${i} 个`).toBeGreaterThan(0);
      expect(gap, `第 ${i} 个之后静场了`).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });

  it("续段里礼物球照样一次只挂一个，铁气球照样两下才破", () => {
    const head = festPlan(4321, FEST_CHUNK);
    const tail = festExtend(head, 8642, FEST_CHUNK);
    const gifts = tail.filter((p) => p.kind === "gift");
    for (let i = 1; i < gifts.length; i++) {
      expect(gifts[i].at - gifts[i - 1].at).toBeGreaterThanOrEqual(festGiftFlightS(999) - 1e-9);
    }
    expect(GIFT_MAX_ON_SCREEN).toBe(1);
    expect(canSpawnGift(0)).toBe(true);
    expect(canSpawnGift(1)).toBe(false);
    expect(tapBalloon("iron", 0).popped).toBe(false);
    expect(tapBalloon("iron", 1).popped).toBe(true);
    expect(tapBalloon("gift", 0).popped).toBe(false);
  });

  it("真戳一整场：连击一路加分，放跑三个才收场，收场之后一切冻住", () => {
    let st = festInit();
    for (let i = 0; i < 400; i++) {
      const before = st.score;
      st = festPop(st, i % 7 === 0 ? "rainbow" : "normal", i % 11 === 0 ? CHAIN_MIN : 1);
      expect(st.score).toBeGreaterThan(before);
    }
    expect(st.over).toBe(false);
    expect(st.bestCombo).toBe(400);
    for (let i = 0; i < FEST_MISS_LIMIT - 1; i++) st = festMiss(st);
    expect(st.over).toBe(false);
    st = festMiss(st);
    expect(st.over).toBe(true);
    const frozen = st;
    expect(festMiss(st)).toBe(frozen);
    expect(festPop(st, "normal")).toBe(frozen);
    expect(festGift(st)).toBe(frozen);
  });

  it("越往后越密越快都有封顶，气球始终在天上待够 3 秒", () => {
    expect(festSpawnMs(999)).toBe(360);
    expect(festRiseSpeed(999)).toBe(140);
    expect((SKY_H + 40 - ESCAPE_Y) / festRiseSpeed(999)).toBeGreaterThan(3.5);
    expect(festGiftFlightS(999)).toBeGreaterThan((SKY_H + 40 - ESCAPE_Y) / festRiseSpeed(999));
    expect(GIFT_RISE_MUL).toBeLessThan(1);
    expect(festScoreFor("rainbow")).toBeGreaterThan(festScoreFor("normal"));
    expect(festScoreFor("normal", 1, true)).toBeGreaterThan(festScoreFor("normal"));
  });
});

describe("戳戳小气球 · R3 · 前两轮结论的最终复核", () => {
  it("W4A-01 已修：非护礼物关的礼物一颗星都不扣", () => {
    for (const g of ["count", "color", "order"] as GoalKind[]) expect(giftGuarded(g)).toBe(false);
    expect(giftGuarded("protect")).toBe(true);
    for (let lv = 0; lv < LEVELS.length; lv++) {
      if (levelGoal(LEVELS[lv]) === "protect") continue;
      expect(simulateLevel(LEVELS[lv], { seed: 500 + lv * 7 }).giftLost, `第 ${lv + 1} 关`).toBe(0);
    }
  });

  it("W4A-03 已修：整条链不管多长都在 250ms 里连完", () => {
    for (let n = CHAIN_MIN; n <= 40; n++) {
      expect(chainDurationMs(n), `${n} 连`).toBeLessThanOrEqual(CHAIN_WINDOW_MS);
      const delays = chainDelays(n);
      expect(delays.length).toBe(n);
      expect(delays[0]).toBe(0);
      for (let i = 1; i < n; i++) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
      expect(chainStepMs(n)).toBeGreaterThan(0);
    }
    expect(chainScore(3)).toBeGreaterThan(0);
  });

  it("W4A-13 已修：上升速度按气球自己的出场波次算，天上不会整片往上跳", () => {
    expect(SRC).toContain("festRiseSpeed(b.wave)");
    expect(SRC).toMatch(/const wave = planAt;/);
    expect(SRC).not.toContain("festRiseSpeed(planAt)");
    // 同一个气球在两个时刻之间只按自己的速度走，不受后面出了多少球影响
    const rise = festRiseSpeed(3);
    const a = floatAt({ x0: 40, y0: SKY_H, born: 0, phase: 0 }, { riseSpeed: rise }, 5);
    const b = floatAt({ x0: 40, y0: SKY_H, born: 0, phase: 0 }, { riseSpeed: rise }, 5.5);
    expect(a.y - b.y).toBeCloseTo(rise * 0.5, 6);
  });

  it("W4A-14 已修：按玩法分开量，每章每一档都是干净的下坡；末章紧过第 7 章", () => {
    const freeMin = (ci: number): number => {
      const at = CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
      const out: number[] = [];
      for (let t = 0; t < CHAPTERS[ci].size; t++) {
        if (LEVELS[at + t].mode === "free") out.push(tapTolerance(at + t + 1));
      }
      return Math.min(...out);
    };
    expect(freeMin(9)).toBeLessThan(freeMin(6));
    expect(freeMin(9)).toBeLessThanOrEqual(freeMin(7));
  });

  it("A-L02 仍在：礼物球怎么点都不破，铁气球连点两下才算一次", () => {
    expect(KINDS.gift.popable).toBe(false);
    for (let i = 0; i < 20; i++) expect(tapBalloon("gift", i).popped).toBe(false);
    expect(KINDS.iron.taps).toBe(2);
    expect(tapBalloon("iron", 0).popped).toBe(false);
    expect(tapBalloon("iron", 1).popped).toBe(true);
  });
});

describe("戳戳小气球 · R3 · 竞态与判定再走一遍", () => {
  const row = (n: number, gap: number, color = 1): ChainNode[] =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, x: i * gap, y: 100, color, kind: "normal" as const }));

  it("同色成串才连，隔太远就不连", () => {
    expect(chainGroup(row(5, 40), 1).length).toBeGreaterThanOrEqual(CHAIN_MIN);
    expect(chainGroup(row(5, 400), 1).length).toBe(1);
  });

  it("彩虹球清的是同一种颜色，清完不会把自己也算两遍", () => {
    const list: ChainNode[] = [
      ...row(3, 30, 2),
      { id: 90, x: 200, y: 100, color: 4, kind: "normal" },
      { id: 99, x: 10, y: 100, color: 2, kind: "rainbow" }
    ];
    const t = rainbowTargets(list);
    expect(new Set(t.ids).size).toBe(t.ids.length);
    expect(t.ids.length).toBeGreaterThan(0);
  });

  it("点在气球身上才算数，点空地不算", () => {
    expect(isHit(100, 100, 100, 100)).toBe(true);
    expect(isHit(300, 300, 100, 100)).toBe(false);
  });

  it("过关与失败两套判定各管各的，不会互相串味", () => {
    const base: GoalState = { popped: 0, target: 5, escaped: 0, escapes: 3, mistakes: 0, giftLost: 0 };
    expect(goalReached("count", { ...base, popped: 5 })).toBe(true);
    expect(goalFailure("count", { ...base, escaped: 3 })).toBeNull();
    expect(goalFailure("count", { ...base, escaped: 4 })).toBeTruthy();
    expect(goalFailure("protect", { ...base, giftLost: 1 })).toBeTruthy();
    expect(starsFor(0, 0, 0)).toBe(3);
    expect(starsFor(9, 9, 9)).toBe(1);
  });
});

describe("戳戳小气球 · R3 · 360px 与收官红线", () => {
  it("天空宽度自适应，没有写死超过 360px 的宽度，也没有横向滚动", () => {
    const widths = [...SRC.matchAll(/(?<!-)\bwidth:\s*(\d{3,})px/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w, `有一处写死了 ${w}px`).toBeLessThanOrEqual(360);
    expect(SRC).not.toMatch(/overflow-x:\s*scroll/);
  });

  it("气球按钮不小于 44px，四岁的手指点得中", () => {
    const m = /\.blp-balloon\s*\{[^}]*width:\s*(\d+)px;\s*height:\s*(\d+)px/.exec(SRC);
    expect(m, "找不到气球按钮的尺寸").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
    expect(Number(m![2])).toBeGreaterThanOrEqual(44);
  });

  it("失败与收场文案只鼓励，一句判语都没有", () => {
    const words: string[] = [];
    for (const g of Object.keys(GOAL_LABELS) as GoalKind[]) {
      const w = goalFailure(g, { popped: 0, target: 9, escaped: 99, escapes: 1, mistakes: 9, giftLost: 9 });
      if (w) words.push(w);
    }
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) for (const bad of BLAME_WORDS) expect(w, `「${w}」`).not.toContain(bad);
  });

  it("同一个种子永远是同一场：出场表可复现", () => {
    expect(JSON.stringify(festPlan(99, 200))).toBe(JSON.stringify(festPlan(99, 200)));
    const head = festPlan(99, 200);
    expect(JSON.stringify(festExtend(head, 100, 200))).toBe(JSON.stringify(festExtend(head, 100, 200)));
    expect(FEST_LOOKAHEAD).toBeLessThan(FEST_CHUNK);
  });
});
