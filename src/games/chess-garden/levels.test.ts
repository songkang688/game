/**
 * 花园国际象棋 · 188 关题库体检。
 *
 * 这一份不测 UI，只回答一件事：**这 188 道题每一道都真的有解吗**。
 * 杀棋题用搜索证明「N 步内强制将杀」，和棋题按类型断言那一手真的判和。
 */
import { describe, expect, it } from "vitest";
import { assertTotal } from "../level99";
import { fromFen, toFen, WHITE } from "./board";
import { CHAPTERS, LEVELS, buildLevel, endlessThinkMs, endlessTier, loseLine, rateLevel, winLine } from "./levels";
import { fromSan, inCheck, legalMoves, makeMove, toSan } from "./moves";
import { createGame, gameStatus, insufficientMaterial, playMove, status } from "./rules";
import { findForcedMate, forcesMate } from "./search";

describe("章节切分", () => {
  it("八章之和恒等于 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
  });

  it("章节表按规格写满八章，每章都有名字、图标与介绍", () => {
    expect(CHAPTERS.length).toBe(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.desc.length).toBeGreaterThan(4);
      expect(ch.size).toBeGreaterThan(0);
    }
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("188 关都拼出来了，关号连续、章节下标对得上", () => {
    expect(LEVELS.length).toBe(188);
    let acc = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      for (let i = 0; i < CHAPTERS[ci].size; i++) {
        const spec = LEVELS[acc];
        expect(spec.index).toBe(acc);
        expect(spec.chapterIndex).toBe(ci);
        expect(spec.indexInChapter).toBe(i);
        acc++;
      }
    }
    expect(acc).toBe(188);
  });

  it("buildLevel 越界也不会崩", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(999).index).toBe(187);
    expect(buildLevel(87).index).toBe(87);
  });
});

describe("题面本身是合法的局面", () => {
  it("每一关的 FEN 都读得进来、双方都有王、轮到白方走、白方有棋可走", () => {
    for (const spec of LEVELS) {
      const pos = fromFen(spec.fen);
      expect(toFen(pos), `第 ${spec.index + 1} 关 FEN 转回去不一致`).toBe(spec.fen);
      expect(pos.turn, `第 ${spec.index + 1} 关应该轮白方走`).toBe(WHITE);
      expect(pos.board.filter((p) => p === 6).length, `第 ${spec.index + 1} 关缺白王`).toBe(1);
      expect(pos.board.filter((p) => p === -6).length, `第 ${spec.index + 1} 关缺黑王`).toBe(1);
      expect(inCheck(pos, -1), `第 ${spec.index + 1} 关黑王一开局就被将`).toBe(false);
      expect(legalMoves(pos).length, `第 ${spec.index + 1} 关白方无棋可走`).toBeGreaterThan(0);
    }
  });

  it("每一关的参考解都是一条合法走法", () => {
    for (const spec of LEVELS) {
      const pos = fromFen(spec.fen);
      const move = fromSan(pos, spec.solution);
      expect(move, `第 ${spec.index + 1} 关的参考解「${spec.solution}」不合法`).not.toBeNull();
    }
  });

  it("题面没有重复（188 道题是 188 个不同局面）", () => {
    const seen = new Set(LEVELS.map((s) => s.fen));
    expect(seen.size).toBe(188);
  });
});

describe("杀棋题正好是 N 步杀", () => {
  const mates = LEVELS.filter((s) => s.kind === "mate");

  it("杀棋题占了绝大多数，深度从 1 步到 4 步都有", () => {
    expect(mates.length).toBe(176);
    const depths = new Set(mates.map((s) => s.plies));
    expect([...depths].sort((a, b) => a - b)).toEqual([1, 3, 5, 7]);
  });

  it("每一道杀棋题都能在标称步数内强制将杀", () => {
    for (const spec of mates) {
      const pos = fromFen(spec.fen);
      const solve = findForcedMate(pos, spec.plies);
      expect(solve, `第 ${spec.index + 1} 关（${spec.plies} 个半回合）找不到强制杀`).not.toBeNull();
    }
  });

  it("每一道杀棋题都不能更快解掉（标称几步就是几步）", () => {
    for (const spec of mates) {
      if (spec.plies <= 1) continue;
      const pos = fromFen(spec.fen);
      expect(
        findForcedMate(pos, spec.plies - 2),
        `第 ${spec.index + 1} 关其实是更短的杀，标称步数写大了`
      ).toBeNull();
    }
  });

  it("参考解本身就是能强制将杀的那一手", () => {
    for (const spec of mates) {
      const pos = fromFen(spec.fen);
      const move = fromSan(pos, spec.solution)!;
      expect(forcesMate(pos, move, spec.plies), `第 ${spec.index + 1} 关参考解不成立`).toBe(true);
    }
  });

  it("规定首着的关卡（易位课 / 过路兵课 / 升变课）参考解确实是那一类走法", () => {
    for (const spec of mates.filter((s) => s.require)) {
      const pos = fromFen(spec.fen);
      const move = fromSan(pos, spec.solution)!;
      const isCastle = move.flag === "k" || move.flag === "q";
      const isEp = move.flag === "e";
      const isPromo = move.promo !== 0;
      expect(isCastle || isEp || isPromo, `第 ${spec.index + 1} 关的首着要求没落实`).toBe(true);
    }
  });

  it("易位课的 22 关首着都是易位", () => {
    const chapter = LEVELS.filter((s) => s.chapterIndex === 4);
    expect(chapter.length).toBe(22);
    for (const spec of chapter) {
      const move = fromSan(fromFen(spec.fen), spec.solution)!;
      expect(move.flag === "k" || move.flag === "q", `第 ${spec.index + 1} 关首着不是易位`).toBe(true);
    }
  });

  it("过路与升变章的 22 关首着不是吃过路兵就是升变", () => {
    const chapter = LEVELS.filter((s) => s.chapterIndex === 5);
    expect(chapter.length).toBe(22);
    let ep = 0;
    let promo = 0;
    for (const spec of chapter) {
      const move = fromSan(fromFen(spec.fen), spec.solution)!;
      if (move.flag === "e") ep++;
      else if (move.promo !== 0) promo++;
      else throw new Error(`第 ${spec.index + 1} 关既不是过路兵也不是升变`);
    }
    expect(ep).toBe(14);
    expect(promo).toBe(8);
  });

  it("升变课里有「升成后反而不是杀」的题，必须升马", () => {
    const under = LEVELS.filter((s) => s.chapterIndex === 5 && s.solution.includes("=N"));
    expect(under.length).toBeGreaterThanOrEqual(4);
    for (const spec of under) {
      const pos = fromFen(spec.fen);
      const knight = fromSan(pos, spec.solution)!;
      expect(forcesMate(pos, knight, 1)).toBe(true);
      // 同一格升成后就不是杀了，这才是这道题的意思
      const queen = legalMoves(pos).find((m) => m.from === knight.from && m.to === knight.to && m.promo === 5)!;
      expect(queen, `第 ${spec.index + 1} 关没有升后这个选项`).toBeTruthy();
      expect(forcesMate(pos, queen, 1), `第 ${spec.index + 1} 关升后也是杀，就不是升变课了`).toBe(false);
    }
  });
});

describe("和棋题真的能走成和棋", () => {
  it("逼和题：参考解走完就是逼和", () => {
    const list = LEVELS.filter((s) => s.kind === "stalemate");
    expect(list.length).toBe(5);
    for (const spec of list) {
      const pos = fromFen(spec.fen);
      const move = fromSan(pos, spec.solution)!;
      const next = makeMove(pos, move);
      const st = status(next);
      expect(st.kind, `第 ${spec.index + 1} 关不是逼和`).toBe("stalemate");
      expect(st.winner).toBe(0);
    }
  });

  it("子力不足题：参考解走完剩下的子谁也杀不掉谁", () => {
    const list = LEVELS.filter((s) => s.kind === "material");
    expect(list.length).toBe(4);
    for (const spec of list) {
      const pos = fromFen(spec.fen);
      const move = fromSan(pos, spec.solution)!;
      const next = makeMove(pos, move);
      expect(insufficientMaterial(next), `第 ${spec.index + 1} 关子力还够`).toBe(true);
      expect(status(next).kind).toBe("material");
    }
  });

  it("50 回合题：参考解是一步不吃子不动兵的棋，走完就判和", () => {
    const list = LEVELS.filter((s) => s.kind === "fifty");
    expect(list.length).toBe(1);
    for (const spec of list) {
      const pos = fromFen(spec.fen);
      expect(pos.halfmove).toBe(99);
      const move = fromSan(pos, spec.solution)!;
      expect(move.captured).toBe(0);
      const next = makeMove(pos, move);
      expect(next.halfmove).toBe(100);
      expect(status(next).kind).toBe("fifty");
    }
  });

  it("三次重复题：主线里黑方每一步都是唯一应手，循环走两遍就判和", () => {
    const list = LEVELS.filter((s) => s.kind === "repetition");
    expect(list.length).toBe(2);
    for (const spec of list) {
      expect(spec.line.length).toBe(4);
      const game = createGame(spec.fen);
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < spec.line.length; i++) {
          const san = spec.line[i];
          const move = fromSan(game.pos, san);
          expect(move, `第 ${spec.index + 1} 关主线第 ${round * 4 + i + 1} 手「${san}」走不出来`).not.toBeNull();
          if (i % 2 === 1) {
            // 黑方的应手必须是唯一的，否则这条「永久将」就不成立
            expect(legalMoves(game.pos).length, `第 ${spec.index + 1} 关黑方有别的选择`).toBe(1);
          }
          expect(playMove(game, move!)).toBe(true);
        }
      }
      const st = gameStatus(game);
      expect(st.kind, `第 ${spec.index + 1} 关没走成三次重复`).toBe("repetition");
      expect(st.winner).toBe(0);
    }
  });
});

describe("关卡外围工具", () => {
  it("评星按失误次数递减", () => {
    expect(rateLevel(0)).toBe(3);
    expect(rateLevel(1)).toBe(2);
    expect(rateLevel(4)).toBe(1);
  });

  it("过关与失败的文案都在鼓励，不批评", () => {
    const spec = buildLevel(0);
    expect(winLine(spec, 0).length).toBeGreaterThan(4);
    expect(winLine(spec, 2).length).toBeGreaterThan(4);
    const lose = loseLine(spec);
    expect(lose.length).toBeGreaterThan(4);
    for (const bad of ["笨", "错了", "失败", "不行"]) expect(lose.includes(bad)).toBe(false);
  });

  it("无尽模式一局比一局难：档位单调不降，思考时间也往上走", () => {
    let prevTier = 0;
    let prevMs = 0;
    for (let round = 1; round <= 14; round++) {
      const tier = endlessTier(round);
      const ms = endlessThinkMs(round);
      expect(tier).toBeGreaterThanOrEqual(prevTier);
      expect(ms).toBeGreaterThanOrEqual(prevMs);
      expect(ms).toBeLessThanOrEqual(240);
      prevTier = tier;
      prevMs = ms;
    }
    expect(endlessTier(1)).toBe(1);
    expect(endlessTier(20)).toBe(4);
  });

  it("每一关都写了标题与提示，提示里不直接给出答案着法", () => {
    for (const spec of LEVELS) {
      expect(spec.title.length).toBeGreaterThan(1);
      expect(spec.hint.length).toBeGreaterThan(8);
      expect(spec.hint.includes(spec.solution), `第 ${spec.index + 1} 关的提示把答案写出来了`).toBe(false);
    }
  });
});
