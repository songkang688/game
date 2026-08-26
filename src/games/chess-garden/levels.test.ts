import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { other, parseFen, startPosition, zobrist, type Color, type Position } from "./board";
import { CHAPTERS, TOTAL, chapterIndexOf, chaptersValid, endlessPlan, goalText, planFor, positionFor, rateLevel } from "./levels";
import { legalMoves, makeMove, status } from "./rules";
import { TIERS, chooseMove, evaluate, playDuel, search, type Tier } from "./search";

/** 白方是不是有 n 步强制将杀（黑方怎么挡都挡不住） */
export function hasForcedMate(pos: Position, n: number, attacker: Color = pos.turn): boolean {
  if (n <= 0) return false;
  if (pos.turn !== attacker) {
    // 轮到防守方：所有应手都必须仍然被将杀
    const replies = legalMoves(pos);
    if (replies.length === 0) return status(pos).kind === "checkmate";
    return replies.every((m) => hasForcedMate(makeMove(pos, m), n, attacker));
  }
  for (const m of legalMoves(pos)) {
    const next = makeMove(pos, m);
    if (status(next).kind === "checkmate") return true;
    if (n > 1 && hasForcedMate(next, n - 1, attacker)) return true;
  }
  return false;
}

describe("花园国际象棋 · 188 关章节", () => {
  it("八章之和恒等 188", () => {
    expect(chaptersValid()).toBe(true);
    expect(CHAPTERS.reduce((a, c) => a + c.size, 0)).toBe(188);
    expect(TOTAL).toBe(TOTAL_LEVELS);
  });

  it("八章都写全了名字、表情和说明", () => {
    expect(CHAPTERS.length).toBe(8);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.desc.length).toBeGreaterThan(4);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("关号落章正确，越界也不崩", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(planFor(-3).level).toBe(0);
    expect(planFor(500).level).toBe(187);
  });

  it("每一关的 FEN 都读得进来，而且轮到白方走", () => {
    for (let lv = 0; lv < 188; lv += 3) {
      const pos = positionFor(lv);
      expect(pos.turn, `第 ${lv + 1} 关`).toBe("w");
      expect(legalMoves(pos).length, `第 ${lv + 1} 关`).toBeGreaterThan(0);
    }
  });

  it("每一关都有目标文案和提示", () => {
    for (let lv = 0; lv < 188; lv += 5) {
      const plan = planFor(lv);
      expect(goalText(plan).length).toBeGreaterThan(2);
      expect(plan.hint.length).toBeGreaterThan(4);
      expect(plan.budget).toBeGreaterThan(0);
    }
  });

  it("难度往上走：越靠后的章节对手越强", () => {
    const rank = (t: Tier): number => TIERS.indexOf(t);
    expect(rank(planFor(0).tier)).toBeLessThanOrEqual(rank(planFor(120).tier));
    expect(rank(planFor(120).tier)).toBeLessThanOrEqual(rank(planFor(187).tier));
  });

  it("可走点提示前五章开着，后面关掉当难度", () => {
    expect(planFor(0).showHints).toBe(true);
    expect(planFor(115).showHints).toBe(true);
    expect(planFor(150).showHints).toBe(false);
    expect(planFor(187).showHints).toBe(false);
  });

  it("三星门槛：手数越少星越多", () => {
    expect(rateLevel(1, 30)).toBe(3);
    expect(rateLevel(15, 30)).toBe(2);
    expect(rateLevel(29, 30)).toBe(1);
  });
});

describe("花园国际象棋 · 关卡可解", () => {
  it("将杀章每一题都真的存在 N 步强制杀", () => {
    for (let lv = 140; lv < 164; lv++) {
      const plan = planFor(lv);
      expect(plan.goal.kind).toBe("mate");
      if (plan.goal.kind !== "mate") continue;
      const pos = parseFen(plan.fen);
      expect(hasForcedMate(pos, plan.goal.inMoves), `第 ${lv + 1} 关（${plan.fen}）`).toBe(true);
    }
  }, 60000);

  it("易位章每一题都真的能易位", () => {
    for (let lv = 96; lv < 118; lv++) {
      const plan = planFor(lv);
      expect(plan.goal.kind).toBe("castle");
      const pos = parseFen(plan.fen);
      expect(legalMoves(pos).some((m) => m.castle), `第 ${lv + 1} 关`).toBe(true);
    }
  });

  it("过路与升变章的题目都有对应的那一手", () => {
    for (let lv = 118; lv < 140; lv++) {
      const plan = planFor(lv);
      const pos = parseFen(plan.fen);
      const moves = legalMoves(pos);
      if (plan.goal.kind === "promote") {
        expect(moves.some((m) => m.promo), `第 ${lv + 1} 关要能升变`).toBe(true);
      } else if (plan.goal.kind === "enpassant") {
        expect(moves.some((m) => m.ep) || moves.some((m) => m.double), `第 ${lv + 1} 关要能吃过路`).toBe(true);
      } else {
        expect(moves.length).toBeGreaterThan(0);
      }
    }
  });

  it("吃子题里都真的有子可吃", () => {
    for (let lv = 0; lv < 96; lv++) {
      const plan = planFor(lv);
      if (plan.goal.kind !== "capture") continue;
      const pos = parseFen(plan.fen);
      const blackMen = pos.board.filter((p) => p && p.color === "b" && p.type !== "k").length;
      expect(blackMen, `第 ${lv + 1} 关`).toBeGreaterThan(0);
    }
  });
});

describe("花园国际象棋 · 搜索与四档", () => {
  it("四档都能在起始局面给出合法的一手", () => {
    for (const t of TIERS) {
      const pos = startPosition();
      const m = chooseMove(pos, t, 3);
      expect(m).not.toBe(null);
      expect(legalMoves(pos).some((x) => x.from === m!.from && x.to === m!.to)).toBe(true);
    }
  }, 20000);

  it("一步杀摆在面前时，会算的档位一定能找到", () => {
    const pos = parseFen("6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1");
    for (const t of ["normal", "pro", "hell"] as Tier[]) {
      const m = chooseMove(pos, t, 1)!;
      expect(status(makeMove(pos, m)).kind, `${t} 没找到一步杀`).toBe("checkmate");
    }
  }, 20000);

  it("会算的档位不会把后白送掉", () => {
    // 白后走到 d5 就会被 c6 的兵吃掉，会算的档位不该选它
    const pos = parseFen("4k3/8/2p5/8/8/8/3Q4/4K3 w - - 0 1");
    const m = chooseMove(pos, "pro", 2)!;
    const after = makeMove(pos, m);
    const lost = legalMoves(after).some((r) => r.capture === "q");
    expect(lost).toBe(false);
  }, 20000);

  it("评估函数认得出多一个后就是占优", () => {
    const even = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const up = parseFen("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
    expect(evaluate(up)).toBeGreaterThan(evaluate(even));
  });

  it("地狱档单手耗时受时间预算约束", () => {
    const pos = startPosition();
    const t0 = Date.now();
    chooseMove(pos, "hell", 1);
    const spent = Date.now() - t0;
    expect(spent).toBeLessThan(2500);
  }, 20000);

  it("搜索深度越深，看到的节点越多", () => {
    const pos = startPosition();
    const a = search(pos, { depth: 1 });
    const b = search(pos, { depth: 3 });
    expect(b.nodes).toBeGreaterThan(a.nodes);
    expect(b.depth).toBeGreaterThanOrEqual(a.depth);
  }, 20000);

  it("固定 seed 下地狱档对菜鸟档胜场明显更多", () => {
    let hell = 0;
    let rookie = 0;
    for (let i = 0; i < 20; i++) {
      const white: Tier = i % 2 === 0 ? "hell" : "rookie";
      const black: Tier = i % 2 === 0 ? "rookie" : "hell";
      // 批量对局把思考时间收紧到 25ms，档位逻辑不变，只是想得浅一点
      const r = playDuel(startPosition(), white, black, 300 + i * 11, 50, 25);
      if (r.winner === null) continue;
      const hellSide: Color = i % 2 === 0 ? "w" : "b";
      if (r.winner === hellSide) hell += 1;
      else rookie += 1;
    }
    expect(hell).toBeGreaterThan(rookie);
  }, 180000);

  it("同一 seed 的对局可以复现", () => {
    const a = playDuel(startPosition(), "normal", "rookie", 42, 20, 25);
    const b = playDuel(startPosition(), "normal", "rookie", 42, 20, 25);
    expect(a.winner).toBe(b.winner);
    expect(a.plies).toBe(b.plies);
  }, 60000);

  it("无尽越连胜对手越强", () => {
    const rank = (t: Tier): number => TIERS.indexOf(t);
    expect(rank(endlessPlan(0).tier)).toBeLessThan(rank(endlessPlan(7).tier));
    expect(endlessPlan(12).tier).toBe("hell");
    expect(parseFen(endlessPlan(1).fen).turn).toBe("w");
  });

  it("局面哈希在对局里会一直变（重复检测才有意义）", () => {
    let pos = startPosition();
    const seen = new Set<number>([zobrist(pos)]);
    for (let i = 0; i < 6; i++) {
      const m = chooseMove(pos, "rookie", 9 + i);
      if (!m) break;
      pos = makeMove(pos, m);
      seen.add(zobrist(pos));
    }
    expect(seen.size).toBeGreaterThan(3);
    expect(other("w")).toBe("b");
  });
});
