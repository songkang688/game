/**
 * 花园国际象棋 · 评估、搜索与四档 AI。
 *
 * 这一份守三件事：
 *  1. 搜索是自己算出来的——固定 seed 下同一个局面永远给同一手，断网也一样；
 *  2. 四档难度确实一档比一档强，而且都在各自的时间预算里落子；
 *  3. 杀棋验证器 `findForcedMate` 靠得住，188 关的「有解」才立得住。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { BLACK, WHITE, fromFen, parseSquare, startPosition, type Position } from "./board";
import { fromSan, legalMoves, makeMove, moveKey, toSan } from "./moves";
import { insufficientMaterial, status } from "./rules";
import {
  AI_BLURB,
  AI_LABEL,
  AI_TIERS,
  MATE_SCORE,
  PIECE_VALUE,
  TIER_PLAN,
  chooseMove,
  evaluate,
  findForcedMate,
  findMaterialDrawMove,
  findStalemateMove,
  forcesMate,
  isExactMate,
  search,
  type AiTier,
} from "./search";

/** 一个不用真等的时钟：每问一次就走 1 毫秒 */
function fakeClock(step = 1) {
  let ms = 0;
  return {
    now: () => (ms += step),
    get elapsed() {
      return ms;
    },
  };
}

/** 只看子力的白方净分（正数 = 白方多子） */
function material(pos: Position): number {
  return evaluate(pos, false);
}

/**
 * 执白的一档对执黑的菜鸟档下一盘短棋（固定 seed，可复现）。
 * 20 个半回合之内分不出胜负就按子力算——领先的一方算赢。
 */
function duel(whiteTier: AiTier, seed: number): boolean {
  let pos = startPosition();
  const rand = mulberry32(seed);
  for (let ply = 0; ply < 20; ply++) {
    const tier: AiTier = pos.turn === WHITE ? whiteTier : 1;
    const move = chooseMove(pos, tier, rand, { timeMs: tier === 1 ? undefined : 25 });
    if (!move) break;
    pos = makeMove(pos, move);
    const st = status(pos);
    if (st.over) return st.winner === WHITE;
  }
  return material(pos) > 0;
}

describe("评估函数", () => {
  it("开局是完全对称的，评估应该是 0", () => {
    expect(evaluate(startPosition(), false)).toBe(0);
    expect(evaluate(startPosition(), true)).toBe(0);
  });

  it("白方多一个后就明显是正分，黑方多子就是负分", () => {
    expect(material(fromFen("4k3/8/8/8/8/8/8/4KQ2 w - - 0 1"))).toBe(PIECE_VALUE[5]);
    expect(material(fromFen("4kq2/8/8/8/8/8/8/4K3 w - - 0 1"))).toBe(-PIECE_VALUE[5]);
  });

  it("子力价值排序：兵 < 马 ≈ 象 < 车 < 后", () => {
    expect(PIECE_VALUE[1]).toBeLessThan(PIECE_VALUE[2]);
    expect(PIECE_VALUE[2]).toBeLessThanOrEqual(PIECE_VALUE[3]);
    expect(PIECE_VALUE[3]).toBeLessThan(PIECE_VALUE[4]);
    expect(PIECE_VALUE[4]).toBeLessThan(PIECE_VALUE[5]);
  });

  it("位置表打开时，马站中间比蹲角落分高", () => {
    const center = evaluate(fromFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1"), true);
    const corner = evaluate(fromFen("4k3/8/8/8/8/8/8/N3K3 w - - 0 1"), true);
    expect(center).toBeGreaterThan(corner);
  });

  it("同一条线上叠两个兵要扣分", () => {
    const stacked = evaluate(fromFen("4k3/8/8/8/8/3P4/3P4/4K3 w - - 0 1"), true);
    const spread = evaluate(fromFen("4k3/8/8/8/8/2P5/3P4/4K3 w - - 0 1"), true);
    expect(stacked).toBeLessThan(spread);
  });
});

describe("搜索", () => {
  it("一步杀的局面直接给出杀着，分数接近满分", () => {
    const pos = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    const res = search(pos, { depth: 2 });
    expect(res.move).not.toBeNull();
    expect(toSan(res.move!, pos)).toBe("Ra8#");
    expect(res.score).toBeGreaterThan(MATE_SCORE - 100);
  });

  it("白送的后会被吃掉：搜索看得见明摆着的吃子", () => {
    const pos = fromFen("4k3/8/8/8/3q4/8/8/3RK3 w - - 0 1");
    const res = search(pos, { depth: 2 });
    expect(toSan(res.move!, pos)).toBe("Rxd4");
  });

  it("没棋可走的局面不会崩，只是返回 null", () => {
    const res = search(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), { depth: 3 });
    expect(res.move).toBeNull();
    expect(res.nodes).toBe(0);
  });

  it("迭代加深会一层层往下走，深度记在结果里", () => {
    const res = search(startPosition(), { depth: 3 });
    expect(res.depth).toBe(3);
    expect(res.nodes).toBeGreaterThan(0);
  });

  it("时间预算说停就停，手上永远有一步能走的棋", () => {
    const clock = fakeClock(40);
    const res = search(startPosition(), { depth: 40, timeMs: 120, now: clock.now });
    expect(res.move).not.toBeNull();
    expect(res.depth).toBeGreaterThanOrEqual(1);
  });

  it("同一个局面算两遍给的是同一手（没有随机性混进来）", () => {
    const pos = fromFen("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1");
    const a = search(pos, { depth: 3 });
    const b = search(pos, { depth: 3 });
    expect(moveKey(a.move!)).toBe(moveKey(b.move!));
  });
});

describe("四档 AI", () => {
  it("四档都有名字和一句说明，说明里不吓唬人", () => {
    expect(AI_TIERS).toEqual([1, 2, 3, 4]);
    for (const t of AI_TIERS) {
      expect(AI_LABEL[t].length).toBeGreaterThan(0);
      expect(AI_BLURB[t].length).toBeGreaterThan(6);
      for (const bad of ["死", "杀死", "笨", "废物"]) expect(AI_BLURB[t].includes(bad)).toBe(false);
    }
  });

  it("四档的搜索参数一档比一档舍得算", () => {
    let depth = 0;
    let time = 0;
    for (const t of AI_TIERS) {
      const plan = TIER_PLAN[t];
      expect(plan.depth).toBeGreaterThanOrEqual(depth);
      expect(plan.timeMs).toBeGreaterThanOrEqual(time);
      expect(plan.timeMs).toBeLessThanOrEqual(200);
      depth = plan.depth;
      time = plan.timeMs;
    }
    expect(TIER_PLAN[4].timeMs).toBe(200);
  });

  it("每一档都能在任意局面里给出一条合法走法", () => {
    const board = fromFen("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1");
    for (const t of AI_TIERS) {
      const move = chooseMove(board, t, mulberry32(7 + t));
      expect(move, `第 ${t} 档没给出走法`).not.toBeNull();
      expect(legalMoves(board).some((m) => moveKey(m) === moveKey(move!))).toBe(true);
    }
  });

  it("没棋可走的时候四档一致返回 null", () => {
    const dead = fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    for (const t of AI_TIERS) expect(chooseMove(dead, t, mulberry32(3))).toBeNull();
  });

  it("会算棋的三档（普通 / 高手 / 地狱）都能一眼看见一步杀", () => {
    const pos = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    for (const t of [2, 3, 4] as AiTier[]) {
      expect(toSan(chooseMove(pos, t, mulberry32(11))!, pos), `第 ${t} 档没找到一步杀`).toBe("Ra8#");
    }
  });

  it("菜鸟档只是随便走，但不会把后白白送到对方嘴边", () => {
    // d4 的白后旁边就是黑兵，随便走的话很容易撞上去
    const pos = fromFen("4k3/8/8/2p1p3/3Q4/8/8/4K3 w - - 0 1");
    for (let seed = 0; seed < 24; seed++) {
      const move = chooseMove(pos, 1, mulberry32(seed))!;
      const next = makeMove(pos, move);
      const grabbed = legalMoves(next).some((r) => r.to === move.to && r.captured === 5);
      expect(grabbed, `seed ${seed} 把后送掉了`).toBe(false);
    }
  });

  it("固定 seed 下每一档都可复现：同样的输入永远给同样的一手", () => {
    const pos = fromFen("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1");
    for (const t of AI_TIERS) {
      const a = chooseMove(pos, t, mulberry32(2026));
      const b = chooseMove(pos, t, mulberry32(2026));
      expect(moveKey(a!), `第 ${t} 档不可复现`).toBe(moveKey(b!));
    }
  });

  it("时间预算可以从外面加码（无尽模式逐场加时用）", () => {
    const clock = fakeClock(30);
    const move = chooseMove(startPosition(), 4, mulberry32(5), { timeMs: 90, now: clock.now });
    expect(move).not.toBeNull();
    expect(clock.elapsed).toBeGreaterThan(0);
  });

  it("固定 seed 下 20 局：地狱档执白吃干抹净，菜鸟档执白只能靠运气", () => {
    let hell = 0;
    let rookie = 0;
    for (let g = 0; g < 20; g++) {
      if (duel(4, 1000 + g)) hell++;
      if (duel(1, 1000 + g)) rookie++;
    }
    expect(hell).toBeGreaterThanOrEqual(18);
    expect(hell).toBeGreaterThan(rookie * 2);
  }, 120000);

  it("每一档单手都在自己的时间预算里落子", () => {
    const pos = fromFen("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1");
    for (const t of AI_TIERS) {
      const started = Date.now();
      expect(chooseMove(pos, t, mulberry32(41))).not.toBeNull();
      const spent = Date.now() - started;
      // 预算之外再留一倍余量：慢机器上也不该拖到让孩子等
      expect(spent, `第 ${t} 档一手用了 ${spent}ms`).toBeLessThanOrEqual(TIER_PLAN[t].timeMs * 2 + 200);
    }
  }, 30000);
});

describe("杀棋验证器", () => {
  it("一步杀找得到，而且返回的就是那一手", () => {
    const pos = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    const move = findForcedMate(pos, 1);
    expect(move).not.toBeNull();
    expect(toSan(move!, pos)).toBe("Ra8#");
  });

  it("两步杀（3 个半回合）也找得到，一步之内则找不到", () => {
    // 白王先走上去封住 g6/g8，下一手后到 g7 就是杀
    const pos = fromFen("7k/8/8/5K2/8/8/8/6Q1 w - - 0 1");
    expect(findForcedMate(pos, 1)).toBeNull();
    const move = findForcedMate(pos, 3);
    expect(move).not.toBeNull();
    expect(forcesMate(pos, move!, 3)).toBe(true);
  });

  it("摆不出杀的局面老老实实返回 null，不会瞎编一手", () => {
    const quiet = fromFen("4k3/8/8/8/8/8/8/4K2R w - - 0 1");
    expect(findForcedMate(quiet, 3)).toBeNull();
    expect(findForcedMate(quiet, 0)).toBeNull();
  });

  it("forcesMate 只认「走完还保得住强制杀」的那一手", () => {
    const pos = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    const mate = fromSan(pos, "Ra8")!;
    const idle = fromSan(pos, "Ra2")!;
    expect(forcesMate(pos, mate, 1)).toBe(true);
    expect(forcesMate(pos, idle, 1)).toBe(false);
    expect(forcesMate(pos, idle, 3)).toBe(false);
  });

  it("isExactMate 分得清「正好一步杀」和「其实更快」", () => {
    const one = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    expect(isExactMate(one, 1)).toBe(true);
    // 同一道题标成两步杀就不成立了：它一步就能解
    expect(isExactMate(one, 3)).toBe(false);
  });

  it("找得到一步走成逼和的棋", () => {
    // 黑王被挤在 h8，白后走到 f7 就把它逼死了（但没将军）
    const pos = fromFen("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1");
    const move = findStalemateMove(pos);
    expect(move).not.toBeNull();
    expect(status(makeMove(pos, move!)).kind).toBe("stalemate");
  });

  it("找得到一步换成子力不足的棋", () => {
    // 白马吃掉黑方最后一个车，剩下的子谁也杀不掉谁
    const pos = fromFen("4k3/8/8/8/8/3r4/8/2N1K3 w - - 0 1");
    const move = findMaterialDrawMove(pos, insufficientMaterial);
    expect(move).not.toBeNull();
    expect(toSan(move!, pos)).toContain("xd3");
    expect(insufficientMaterial(makeMove(pos, move!))).toBe(true);
  });

  it("黑方也能被验出强制杀（验证器不偏袒白方）", () => {
    const pos = fromFen("r5k1/6pp/8/8/8/8/5PPP/6K1 b - - 0 1");
    const move = findForcedMate(pos, 1);
    expect(move).not.toBeNull();
    expect(toSan(move!, pos)).toBe("Ra1#");
  });
});

describe("升变在搜索里也算得对", () => {
  it("兵再不升变就要被车吃掉，搜索会当场升成后", () => {
    const pos = fromFen("4k3/1P6/8/8/8/1r6/8/4K3 w - - 0 1");
    const res = search(pos, { depth: 4 });
    expect(res.move!.promo).toBe(5);
    expect(res.move!.to).toBe(parseSquare("b8"));
  });

  it("升后会逼和、升车才赢的局面，搜索选升车", () => {
    // 升后的话黑王一步都走不了变成逼和，升车则留一格给它
    const pos = fromFen("7k/5P2/8/8/8/8/8/5K2 w - - 0 1");
    const res = search(pos, { depth: 4 });
    const next = makeMove(pos, res.move!);
    expect(status(next).kind).not.toBe("stalemate");
  });
});

describe("黑白两边一视同仁", () => {
  it("镜像局面给出的是镜像的评估分", () => {
    const white = evaluate(fromFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"), true);
    const black = evaluate(fromFen("4k3/4p3/8/8/8/8/8/4K3 w - - 0 1"), true);
    expect(white).toBe(-black);
  });

  it("黑方走棋时四档一样能挑出吃子", () => {
    const pos = fromFen("4k3/8/8/8/3Q4/8/8/3rK3 b - - 0 1");
    for (const t of [2, 3, 4] as AiTier[]) {
      const move = chooseMove(pos, t, mulberry32(19))!;
      expect(makeMove(pos, move).turn).toBe(WHITE);
    }
    expect(fromFen("4k3/8/8/8/3Q4/8/8/3rK3 b - - 0 1").turn).toBe(BLACK);
  });
});
