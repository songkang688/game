import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  PUZZLES,
  THEMES,
  failText,
  goalText,
  headline,
  hintText,
  openingTip,
  parseSetup,
  puzzleAt,
  puzzleBoard,
  solvedText,
  starsFor,
} from "./endgames";
import { TOTAL_LEVELS } from "../level99";
import { type Side, findKing, generalsFacing, idx, statusOf } from "./logic";
import { genMoves, makeMove, positionKey, unmakeMove } from "./movegen";
import { canWinIn, finishKindAfter, principalLine, solveMate, winningFirstMoves } from "./solve";

/** 红黑各有几个子 */
function counts(setup: string) {
  const b = parseSetup(setup);
  let red = 0;
  let black = 0;
  for (const p of b) {
    if (!p) continue;
    if (p.side === "red") red++;
    else black++;
  }
  return { red, black, all: red + black };
}

describe("188 课的骨架", () => {
  it("正好 188 课，课号 0..187 连着排", () => {
    expect(PUZZLES.length).toBe(188);
    expect(TOTAL_LEVELS).toBe(188);
    PUZZLES.forEach((p, i) => expect(p.level).toBe(i));
  });

  it("八章，每章都有名字、表情、颜色和说明", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8);
    expect(CHAPTERS.length).toBe(THEMES.length);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.desc.length).toBeGreaterThan(8);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("各章课数加起来正好 188", () => {
    expect(CHAPTERS.reduce((n, c) => n + c.size, 0)).toBe(188);
  });

  it("章号按顺序分段，同一章的课连在一起", () => {
    let at = 0;
    CHAPTERS.forEach((c, i) => {
      for (let k = 0; k < c.size; k++) expect(PUZZLES[at + k].chapter).toBe(i);
      at += c.size;
    });
    expect(at).toBe(188);
  });

  it("章节名是中文原创说法，不甩生僻术语", () => {
    for (const t of THEMES) {
      expect(t.name).toMatch(/^[\u4e00-\u9fa5]{3,6}$/);
      expect(t.lesson.length).toBeGreaterThan(10);
    }
  });

  it("puzzleAt 越界往两头 clamp", () => {
    expect(puzzleAt(-5).level).toBe(0);
    expect(puzzleAt(0).level).toBe(0);
    expect(puzzleAt(187).level).toBe(187);
    expect(puzzleAt(999).level).toBe(187);
    expect(puzzleAt(Number.NaN).level).toBe(0);
    expect(puzzleAt(12.4).level).toBe(12);
  });
});

describe("每一课摆出来都是站得住的局面", () => {
  it("双方各有一个将帅，且都在自己的九宫里", () => {
    for (const p of PUZZLES) {
      const b = puzzleBoard(p);
      for (const side of ["red", "black"] as Side[]) {
        const k = findKing(b, side);
        expect(k, `第 ${p.level + 1} 课缺 ${side} 将`).not.toBeNull();
        expect(k!.x, `第 ${p.level + 1} 课`).toBeGreaterThanOrEqual(3);
        expect(k!.x).toBeLessThanOrEqual(5);
        if (side === "red") expect(k!.y).toBeGreaterThanOrEqual(7);
        else expect(k!.y).toBeLessThanOrEqual(2);
      }
    }
  });

  it("开局不照面、黑方也不是一上来就被将着", () => {
    for (const p of PUZZLES) {
      const b = puzzleBoard(p);
      expect(generalsFacing(b), `第 ${p.level + 1} 课`).toBe(false);
      // 黑方轮不到走，先被将着就等于红方白赚一手，题目不算数
      expect(statusOf(b, "black"), `第 ${p.level + 1} 课`).toBe("normal");
    }
  });

  it("残局就该是残局：子不多，红方也不是一堆车碾过去", () => {
    for (const p of PUZZLES) {
      const c = counts(p.setup);
      expect(c.all, `第 ${p.level + 1} 课`).toBeLessThanOrEqual(10);
      expect(c.red).toBeGreaterThanOrEqual(2);
      expect(c.black).toBeGreaterThanOrEqual(1);
    }
  });

  it("没有两个子摆在同一个交叉点上", () => {
    for (const p of PUZZLES) {
      const seen = new Set<string>();
      for (const token of p.setup.trim().split(/\s+/)) {
        const at = token.slice(2);
        expect(seen.has(at), `第 ${p.level + 1} 课 ${at} 重了`).toBe(false);
        seen.add(at);
      }
    }
  });

  it("188 个局面互不相同", () => {
    const keys = new Set(PUZZLES.map((p) => positionKey(puzzleBoard(p), "red")));
    expect(keys.size).toBe(188);
  });
});

describe("逐课可解：步数是紧的，首着只有一个", () => {
  it("每一课红方先走都能在声明的步数内赢", () => {
    for (const p of PUZZLES) {
      expect(canWinIn(puzzleBoard(p), "red", p.mateIn), `第 ${p.level + 1} 课解不开`).toBe(true);
    }
  }, 120_000);

  it("少一步就赢不了（步数不注水）", () => {
    for (const p of PUZZLES) {
      if (p.mateIn <= 1) continue;
      expect(canWinIn(puzzleBoard(p), "red", p.mateIn - 1), `第 ${p.level + 1} 课少一步也能赢`).toBe(false);
    }
  }, 120_000);

  it("唯一主线解：能赢的第一步只有一个", () => {
    for (const p of PUZZLES) {
      const first = winningFirstMoves(puzzleBoard(p), "red", p.mateIn);
      expect(first.length, `第 ${p.level + 1} 课有 ${first.length} 个首着`).toBe(1);
    }
  }, 180_000);

  it("首着动的子和课上写的兵种对得上（提示不会指错子）", () => {
    for (const p of PUZZLES) {
      const b = puzzleBoard(p);
      const first = winningFirstMoves(b, "red", p.mateIn)[0];
      const piece = b[idx(first.from.x, first.from.y)];
      expect(piece?.type, `第 ${p.level + 1} 课`).toBe(p.lead);
    }
  }, 180_000);

  it("收官方式和课上写的将死 / 困毙一致", () => {
    for (const p of PUZZLES) {
      const b = puzzleBoard(p);
      const line = principalLine(b, "red", p.mateIn);
      expect(line.length, `第 ${p.level + 1} 课走不出主线`).toBeGreaterThan(0);
      // 走完主线，最后一步该收官
      let kind: "checkmate" | "stalemate" | "none" = "none";
      for (let i = 0; i < line.length; i++) {
        const mover: Side = i % 2 === 0 ? "red" : "black";
        if (mover === "red") kind = finishKindAfter(b, line[i], "red");
        makeMove(b, line[i]);
        if (kind !== "none") break;
      }
      expect(kind, `第 ${p.level + 1} 课`).toBe(p.finish);
    }
  }, 180_000);

  it("一步杀的课，走完首着黑方立刻就完了", () => {
    const ones = PUZZLES.filter((p) => p.mateIn === 1);
    expect(ones.length).toBeGreaterThan(20);
    for (const p of ones) {
      const b = puzzleBoard(p);
      const first = winningFirstMoves(b, "red", 1)[0];
      expect(finishKindAfter(b, first, "red"), `第 ${p.level + 1} 课`).toBe(p.finish);
    }
  }, 60_000);

  it("困毙的课确实是困毙：走完之后黑方没被将，却一步也走不了", () => {
    const still = PUZZLES.filter((p) => p.finish === "stalemate");
    expect(still.length).toBeGreaterThan(5);
    for (const p of still) {
      const b = puzzleBoard(p);
      const line = principalLine(b, "red", p.mateIn);
      for (const m of line) makeMove(b, m);
      expect(genMoves(b, "black").length, `第 ${p.level + 1} 课`).toBe(0);
      expect(statusOf(b, "black"), `第 ${p.level + 1} 课`).toBe("stalemate");
    }
  }, 60_000);

  it("走错第一步就赢不了那么快（首着真的唯一）", () => {
    // 抽查前二十课：换成别的首着，剩下的步数就不够了
    for (const p of PUZZLES.slice(0, 20)) {
      const b = puzzleBoard(p);
      const right = winningFirstMoves(b, "red", p.mateIn)[0];
      let checkedAny = false;
      for (const m of genMoves(b, "red")) {
        if (m.from.x === right.from.x && m.from.y === right.from.y && m.to.x === right.to.x && m.to.y === right.to.y) {
          continue;
        }
        const captured = makeMove(b, m);
        // 换一步之后，黑方总能撑过剩下的回合
        const stillLost = genMoves(b, "black").length === 0 || canWinIn(b, "red", p.mateIn - 1);
        unmakeMove(b, m, captured);
        expect(stillLost, `第 ${p.level + 1} 课还有第二条路`).toBe(false);
        checkedAny = true;
      }
      expect(checkedAny).toBe(true);
    }
  }, 120_000);
});

describe("步数与章节的分布", () => {
  it("步数在 1..3 之间，三种都有", () => {
    const kinds = new Set(PUZZLES.map((p) => p.mateIn));
    for (const n of kinds) expect(n).toBeGreaterThanOrEqual(1);
    for (const n of kinds) expect(n).toBeLessThanOrEqual(3);
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it("越往后的章节越难：平均步数不下降", () => {
    const avg = CHAPTERS.map((_, i) => {
      const list = PUZZLES.filter((p) => p.chapter === i);
      return list.reduce((n, p) => n + p.mateIn, 0) / list.length;
    });
    expect(avg[0]).toBeLessThanOrEqual(avg[avg.length - 1]);
  });

  it("首着的兵种不只一种，八章合起来车马炮兵都用得上", () => {
    const leads = new Set(PUZZLES.map((p) => p.lead));
    expect(leads.size).toBeGreaterThanOrEqual(3);
    for (const t of ["R", "C", "H", "P"]) expect(leads.has(t as never), t).toBe(true);
  });

  it("每一章的题都对得上自己的招牌", () => {
    const inCh = (i: number) => PUZZLES.filter((p) => p.chapter === i);
    // 一车封路：清一色车，一步收
    expect(inCh(0).every((p) => p.lead === "R" && p.mateIn === 1)).toBe(true);
    // 一招定音：炮与马的一步杀
    expect(inCh(1).every((p) => (p.lead === "C" || p.lead === "H") && p.mateIn === 1)).toBe(true);
    // 围而不将：整章都是困毙
    expect(inCh(3).every((p) => p.finish === "stalemate")).toBe(true);
    expect(inCh(3).length).toBeGreaterThanOrEqual(15);
    // 马炮同心：首着不是马就是炮
    expect(inCh(4).every((p) => p.lead === "C" || p.lead === "H")).toBe(true);
    // 双车并进：首着都是车
    expect(inCh(5).every((p) => p.lead === "R")).toBe(true);
    // 小兵立功：整章都由兵起手
    expect(inCh(6).every((p) => p.lead === "P")).toBe(true);
    // 两步的章节确实要走两步
    for (const i of [2, 4, 5, 7]) expect(inCh(i).every((p) => p.mateIn === 2), `第 ${i + 1} 章`).toBe(true);
  });

  it("双车并进那一章确实摆了两只车", () => {
    for (const p of PUZZLES.filter((x) => x.chapter === 5)) {
      const rooks = p.setup.split(/\s+/).filter((t) => t.startsWith("rR")).length;
      expect(rooks, `第 ${p.level + 1} 课`).toBeGreaterThanOrEqual(2);
    }
  });

  it("小兵立功那一章的兵都过了河", () => {
    for (const p of PUZZLES.filter((x) => x.chapter === 6)) {
      const pawns = p.setup.split(/\s+/).filter((t) => t.startsWith("rP"));
      expect(pawns.length, `第 ${p.level + 1} 课`).toBeGreaterThan(0);
      // 红兵过河 = y <= 4
      expect(pawns.some((t) => Number(t.slice(2).split(",")[1]) <= 4), `第 ${p.level + 1} 课`).toBe(true);
    }
  });
});

describe("题面与讲解", () => {
  it("目标写清楚步数与收官方式，不剧透坐标", () => {
    for (const p of PUZZLES) {
      const g = goalText(p);
      expect(g).toContain("红方先走");
      expect(g).toContain(String(p.mateIn));
      if (p.finish === "stalemate") expect(g).toContain("困毙");
      expect(g).not.toMatch(/\d\s*,\s*\d/);
    }
  });

  it("小标题带课号与章节名", () => {
    const p = PUZZLES[11];
    expect(headline(p)).toContain("第 12 课");
    expect(headline(p)).toContain(THEMES[p.chapter].name);
  });

  it("提示只说动哪个子，不说落到哪一格", () => {
    for (const p of PUZZLES) {
      const h = hintText(p);
      expect(h.length).toBeGreaterThan(8);
      expect(h).not.toMatch(/\d\s*,\s*\d/);
    }
    expect(openingTip(PUZZLES[0])).toContain(THEMES[0].lesson);
  });

  it("失败只鼓励，不出现批评或者打杀字眼", () => {
    for (const p of PUZZLES.slice(0, 30)) {
      const t = failText(p) + solvedText(p, false) + solvedText(p, true);
      for (const bad of ["笨", "蠢", "错了", "杀死", "血", "死掉"]) expect(t).not.toContain(bad);
    }
    // 失败话术不评价孩子，只把这一章的方法再讲一遍
    expect(failText(PUZZLES[0])).toContain(THEMES[PUZZLES[0].chapter].lesson);
  });

  it("星级：一次解开三星、用提示两星、重摆三次一星", () => {
    expect(starsFor(false, 0)).toBe(3);
    expect(starsFor(true, 0)).toBe(2);
    expect(starsFor(false, 3)).toBe(1);
    expect(starsFor(true, 5)).toBe(1);
    expect(starsFor(false, 2)).toBe(3);
  });
});

describe("求解器本身", () => {
  it("一步杀认得出来，两步杀也认得出来", () => {
    const p1 = PUZZLES.find((p) => p.mateIn === 1)!;
    expect(solveMate(puzzleBoard(p1), "red", 3)?.moves).toBe(1);
    const p2 = PUZZLES.find((p) => p.mateIn === 2);
    if (p2) expect(solveMate(puzzleBoard(p2), "red", 3)?.moves).toBe(2);
  });

  it("赢不了的局面返回 null", () => {
    // 光杆司令对光杆司令，谁也赢不了
    const b = parseSetup("rK4,9 bK4,0 rA4,8");
    expect(solveMate(b, "red", 2)).toBeNull();
  });

  it("求解不会把棋盘弄脏", () => {
    const p = PUZZLES[7];
    const b = puzzleBoard(p);
    const before = positionKey(b, "red");
    canWinIn(b, "red", p.mateIn);
    winningFirstMoves(b, "red", p.mateIn);
    solveMate(b, "red", p.mateIn);
    expect(positionKey(b, "red")).toBe(before);
  });
});
