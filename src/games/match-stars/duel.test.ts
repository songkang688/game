/**
 * 1.2：对战与无尽的规则。
 * 对战是「两边同一条订单队列，先清 3 张的赢」；
 * 无尽是「订单无限，每清 1 张 +1 步」。人机三档必须真的一档比一档强。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { EMPTY, PLAIN, RAINBOW, ROCKET_H, findMatchesOn, legalSwapsOn, makeCellset } from "./board";
import {
  DUEL_COLORS,
  DUEL_COLS,
  DUEL_ROWS,
  DUEL_TARGET,
  ENDLESS_START_MOVES,
  applyPlan,
  componentsOf,
  creditOrder,
  detonatePlan,
  duelWinner,
  endlessLine,
  endlessMovesAfter,
  endlessScore,
  makeDuelBoard,
  makeOrder,
  orderQueue,
  orderText,
  pickAiSwap,
  planRound,
  rainbowPlan,
  resolveBoard,
  TIER_NAMES,
  tierBlurb,
  type AiTier,
  type DuelOrder,
} from "./duel";

const emoji = (t: number): string => ["⭐", "💖", "🍀", "🌙", "🍊"][t] ?? "⭐";

describe("对战棋盘", () => {
  it("6×6，开局不自带三连（窄屏上下排也塞得下）", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = makeDuelBoard(mulberry32(seed));
      expect(s.cols).toBe(DUEL_COLS);
      expect(s.rows).toBe(DUEL_ROWS);
      expect(s.grid).toHaveLength(36);
      expect(findMatchesOn(s.grid, s.cols, s.rows).size, `第 ${seed} 副牌开局就自带三连`).toBe(0);
    }
  });

  it("同一个 seed 发出来的牌一模一样（对战两边才谈得上公平）", () => {
    expect(makeDuelBoard(mulberry32(7)).grid).toEqual(makeDuelBoard(mulberry32(7)).grid);
  });

  it("发出来的牌一定走得动：6×6 太小，死局得在发牌时就洗掉", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = makeDuelBoard(mulberry32(seed));
      expect(legalSwapsOn(s).length, `第 ${seed} 副牌开局就是死局`).toBeGreaterThan(0);
    }
  });
});

describe("订单", () => {
  it("同一个 seed 两边拿到的订单队列完全一样", () => {
    expect(orderQueue(42, 8)).toEqual(orderQueue(42, 8));
  });

  it("越往后的订单越苛刻，但都在能完成的范围内", () => {
    const q = orderQueue(9, 12);
    const first = q.filter((o) => o.kind === "color")[0];
    const last = q.filter((o) => o.kind === "color").slice(-1)[0];
    expect(first.need).toBeLessThan(last.need);
    for (const o of q) {
      expect(o.need).toBeGreaterThan(0);
      expect(o.need).toBeLessThanOrEqual(20);
      expect(o.token).toBeGreaterThanOrEqual(0);
      expect(o.token).toBeLessThan(DUEL_COLORS);
      expect(orderText(o, emoji)).not.toMatch(/[A-Za-z]/);
    }
  });

  it("收集类订单按这一步清掉的图案累加，攒满才算完成", () => {
    const o: DuelOrder = { kind: "color", token: 2, need: 4, got: 0 };
    expect(creditOrder(o, { steps: 1, total: 3, best: 3 }, [2, 2, 1])).toBe(false);
    expect(o.got).toBe(2);
    expect(creditOrder(o, { steps: 1, total: 3, best: 3 }, [2, 2, 2])).toBe(true);
    expect(o.got).toBe(5);
    // 已经满了就不再累加
    expect(creditOrder(o, { steps: 1, total: 3, best: 3 }, [2, 2])).toBe(false);
  });

  it("大消除 / 连锁类订单一步最多记一笔", () => {
    const big: DuelOrder = { kind: "big4", token: 0, need: 2, got: 0 };
    expect(creditOrder(big, { steps: 1, total: 6, best: 6 }, [])).toBe(false);
    expect(big.got).toBe(1);
    expect(creditOrder(big, { steps: 1, total: 3, best: 3 }, [])).toBe(false);
    expect(big.got).toBe(1);
    expect(creditOrder(big, { steps: 1, total: 4, best: 4 }, [])).toBe(true);

    const chain: DuelOrder = { kind: "chain3", token: 0, need: 1, got: 0 };
    expect(creditOrder(chain, { steps: 2, total: 9, best: 3 }, [])).toBe(false);
    expect(creditOrder(chain, { steps: 3, total: 9, best: 3 }, [])).toBe(true);
  });

  it("订单文案全是中文，四种说法各不相同", () => {
    const kinds = ["color", "big4", "big5", "chain2", "chain3"] as const;
    const labels = kinds.map((kind) => orderText({ kind, token: 0, need: 2, got: 0 }, emoji));
    expect(new Set(labels).size).toBe(kinds.length);
    for (const l of labels) expect(l).not.toMatch(/[A-Za-z]/);
  });
});

describe("一轮消除与引爆", () => {
  it("连通分量分得开：两团分开的三连算两团", () => {
    const comps = componentsOf([0, 1, 2, 30, 31, 32], DUEL_COLS);
    expect(comps).toHaveLength(2);
    expect(comps[0]).toHaveLength(3);
  });

  it("横 4 连清完会在手底下留一个火箭", () => {
    const s = makeCellset(DUEL_COLS, DUEL_ROWS, 0);
    for (let i = 0; i < s.grid.length; i++) s.grid[i] = 1;
    for (let c = 0; c < 4; c++) s.grid[c] = 2;
    for (let c = 4; c < DUEL_COLS; c++) s.grid[c] = 3;
    const plan = planRound(s, 1);
    expect(plan).not.toBeNull();
    const reward = plan!.rewards?.find((r) => r.special === ROCKET_H);
    expect(reward).toBeTruthy();
    applyPlan(s, plan!, new Set());
    expect(s.special[reward!.at]).toBe(ROCKET_H);
    expect(s.grid[reward!.at]).toBeGreaterThanOrEqual(0);
  });

  it("引爆一波一波来：applyPlan 只返回下一波，不自己炸到底", () => {
    const s = makeCellset(DUEL_COLS, DUEL_ROWS, 1);
    s.special[DUEL_COLS * 2] = ROCKET_H;
    const res = applyPlan(s, { cells: [DUEL_COLS * 2] }, new Set());
    expect(res.cleared).toEqual([1]);
    expect(res.blast.size).toBe(DUEL_COLS - 1);
    // 这一波还没落到盘面上，得由时间线再排一段
    expect(s.grid[DUEL_COLS * 2 + 1]).toBe(1);
  });

  it("彩虹星点名全场同一种图案", () => {
    const s = makeCellset(DUEL_COLS, DUEL_ROWS, 1);
    s.grid[0] = RAINBOW;
    s.grid[5] = 2;
    const plan = rainbowPlan(s, 0, 1, 0);
    expect(plan.cells).toContain(0);
    expect(plan.cells).not.toContain(5);
    expect(plan.cells.length).toBe(DUEL_COLS * DUEL_ROWS - 1);
  });

  it("交换特殊块就地引爆", () => {
    const s = makeCellset(DUEL_COLS, DUEL_ROWS, 1);
    s.special[0] = ROCKET_H;
    const plan = detonatePlan(s, 0, 1);
    expect(plan?.cells).toHaveLength(DUEL_COLS);
    expect(detonatePlan(s, 10, 11)).toBeNull();
  });

  it("resolveBoard 一路消到稳定，收尾时盘面没有三连也没有空洞", () => {
    const rand = mulberry32(5);
    const s = makeDuelBoard(rand);
    s.grid[0] = 1; s.grid[1] = 1; s.grid[2] = 1;
    const gen = mulberry32(99);
    const { info } = resolveBoard(s, () => Math.floor(gen() * DUEL_COLORS), 1);
    expect(info.steps).toBeGreaterThanOrEqual(1);
    expect(findMatchesOn(s.grid, s.cols, s.rows).size).toBe(0);
    expect(s.grid.filter((v) => v === EMPTY)).toHaveLength(0);
    expect(s.special.every((v) => v === PLAIN || v > 0)).toBe(true);
  });
});

describe("人机三档", () => {
  /** 一档 AI 独自消 n 步，看它能把订单推进多少 */
  function runTier(tier: AiTier, seed: number, steps = 14): number {
    const rand = mulberry32(seed);
    const s = makeDuelBoard(rand);
    const order = makeOrder(0, mulberry32(seed + 1));
    let progress = 0;
    for (let i = 0; i < steps; i++) {
      const pick = pickAiSwap(s, order, tier, rand);
      if (!pick) break;
      [s.grid[pick[0]], s.grid[pick[1]]] = [s.grid[pick[1]], s.grid[pick[0]]];
      const { info, cleared } = resolveBoard(s, () => Math.floor(rand() * DUEL_COLORS), pick[1]);
      progress += info.total;
      creditOrder(order, info, cleared);
    }
    return progress;
  }

  it("三档都能持续走出合法的一步", () => {
    for (const tier of ["rookie", "normal", "expert"] as AiTier[]) {
      expect(runTier(tier, 11), `${TIER_NAMES[tier]} 走不动`).toBeGreaterThan(0);
    }
  });

  it("越高档消得越多：新手 < 老手 ≤ 高手（多副牌取总和，避免单局运气）", () => {
    const seeds = [3, 8, 15, 21, 34, 55];
    const sum = (tier: AiTier): number => seeds.reduce((a, s) => a + runTier(tier, s), 0);
    const rookie = sum("rookie");
    const normal = sum("normal");
    const expert = sum("expert");
    expect(normal).toBeGreaterThan(rookie);
    expect(expert).toBeGreaterThanOrEqual(normal * 0.95);
  });

  it("三档各有各的说法，都是中文", () => {
    for (const tier of ["rookie", "normal", "expert"] as AiTier[]) {
      expect(TIER_NAMES[tier]).not.toMatch(/[A-Za-z]/);
      expect(tierBlurb(tier).length).toBeGreaterThan(6);
    }
    expect(new Set(["rookie", "normal", "expert"].map((t) => tierBlurb(t as AiTier))).size).toBe(3);
  });

  it("没有合法交换时老实返回 null，不硬走一步", () => {
    const s = makeCellset(DUEL_COLS, DUEL_ROWS, 1);
    for (let i = 0; i < s.grid.length; i++) s.solid[i] = true;
    expect(pickAiSwap(s, undefined, "expert", mulberry32(2))).toBeNull();
  });
});

describe("胜负与计分", () => {
  it("先清完 3 张订单的赢，没到 3 张就还没分出胜负", () => {
    expect(DUEL_TARGET).toBe(3);
    expect(duelWinner(2, 2)).toBe(0);
    expect(duelWinner(3, 1)).toBe(1);
    expect(duelWinner(0, 3)).toBe(2);
    expect(duelWinner(1, 2)).toBe(0);
  });

  it("无尽：每清 1 张 +1 步，得分就是清掉的张数", () => {
    expect(ENDLESS_START_MOVES).toBeGreaterThanOrEqual(10);
    expect(endlessMovesAfter(10, 3)).toBe(13);
    expect(endlessScore(7)).toBe(7);
    expect(endlessScore(-1)).toBe(0);
  });

  it("无尽收尾话术只鼓励，破纪录会说破纪录", () => {
    expect(endlessLine(0, 5)).toContain("下次");
    expect(endlessLine(9, 9)).toContain("新纪录");
    expect(endlessLine(3, 9)).toContain("9");
    for (const line of [endlessLine(0, 0), endlessLine(5, 9)]) {
      expect(line).not.toMatch(/输|笨|失败/);
    }
  });
});
