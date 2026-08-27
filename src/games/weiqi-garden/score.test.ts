import { describe, expect, it } from "vitest";
import { BLACK, WHITE, parseRows, pointOf, type Color } from "./board";
import { board9, rows9 } from "./testkit";
import {
  KOMI_CN,
  KOMI_JP,
  RULE_HINTS,
  RULE_LABELS,
  applyDead,
  chineseScore,
  damePoints,
  fillDame,
  finalScore,
  japaneseScore,
  judge,
  komiFor,
  scoreLines,
  territoryOf
} from "./score";

const P = (x: number, y: number): number => pointOf(9, x, y);

/**
 * 终局盘 A:黑占左五列、白占右四列,中间贴在一起,一个单官都不剩。
 * 黑 5 列 = 9 子 + 36 空 = 45;白 4 列 = 9 子 + 27 空 = 36。
 */
function finalA(): ReturnType<typeof parseRows> {
  const rows: string[] = [];
  for (let y = 0; y < 9; y++) rows.push("....XO...");
  return parseRows(rows);
}

/** 终局盘 B:在盘 A 的黑地里困了一颗走不掉的白子 */
function finalB(): ReturnType<typeof parseRows> {
  const b = finalA();
  b.cells[P(2, 2)] = WHITE;
  return b;
}

const captures0: Record<Color, number> = { [BLACK]: 0, [WHITE]: 0 } as Record<Color, number>;

describe("weiqi-garden · 归属地图", () => {
  it("只挨着一方的空区归那一方,两方都挨着的算中立", () => {
    const t = territoryOf(finalA());
    expect(t.black).toHaveLength(36);
    expect(t.white).toHaveLength(27);
    expect(t.neutral).toHaveLength(0);
  });

  it("标死的子先请回篮子,再算归属", () => {
    const { board, removed } = applyDead(finalB(), [P(2, 2)]);
    expect(removed[WHITE]).toBe(1);
    expect(removed[BLACK]).toBe(0);
    expect(board.cells[P(2, 2)]).toBe(0);
  });
});

describe("weiqi-garden · 数子法(默认)", () => {
  it("终局盘一:黑 45 子、白 36 子,贴还 3¾ 之后黑胜", () => {
    const s = chineseScore(finalA());
    expect(s.blackStones).toBe(9);
    expect(s.blackTerritory).toBe(36);
    expect(s.black).toBe(45);
    expect(s.white).toBe(36);
    expect(s.neutral).toBe(0);
    const v = finalScore(finalA(), { rule: "chinese" });
    expect(v.komi).toBe(KOMI_CN);
    expect(v.diff).toBe(5.25);
    expect(v.winner).toBe("black");
  });

  it("终局盘二:那颗白子不标死,整片黑地就变成中立,分数完全不一样", () => {
    const raw = chineseScore(finalB());
    expect(raw.neutral).toBe(35);
    expect(raw.black).toBe(9);
    const marked = chineseScore(finalB(), [P(2, 2)]);
    expect(marked.black).toBe(45);
    expect(marked.white).toBe(36);
    expect(finalScore(finalB(), { rule: "chinese", dead: [P(2, 2)] }).winner).toBe("black");
  });

  it("两边的子 + 围空 + 中立点加起来正好是全盘", () => {
    const s = chineseScore(finalA());
    expect(s.black + s.white + s.neutral).toBe(81);
  });
});

describe("weiqi-garden · 数目法(对战可切)", () => {
  it("终局盘一:只数空目,黑 36 目、白 27 目,贴 6½ 之后黑胜 2½", () => {
    const s = japaneseScore(finalA(), [], captures0);
    expect(s.blackTerritory).toBe(36);
    expect(s.whiteTerritory).toBe(27);
    expect(s.black).toBe(36);
    expect(s.white).toBe(27);
    const v = finalScore(finalA(), { rule: "japanese" });
    expect(v.komi).toBe(KOMI_JP);
    expect(v.diff).toBe(2.5);
    expect(v.winner).toBe("black");
  });

  it("终局盘二:标死的白子按提子算给黑方", () => {
    const s = japaneseScore(finalB(), [P(2, 2)], captures0);
    expect(s.blackTerritory).toBe(36);
    expect(s.blackCaptures).toBe(1);
    expect(s.black).toBe(37);
    expect(s.white).toBe(27);
  });

  it("对局途中提到的子也要加进去", () => {
    const s = japaneseScore(finalA(), [], { [BLACK]: 4, [WHITE]: 1 } as Record<Color, number>);
    expect(s.black).toBe(40);
    expect(s.white).toBe(28);
  });

  it("数目法允许和棋:分数一样、又不用贴目的时候就是平局", () => {
    const v = judge("japanese", 30, 30, 0);
    expect(v.winner).toBe("draw");
    expect(v.text).toContain("和棋");
  });
});

describe("weiqi-garden · 单官", () => {
  it("两边都挨得着的空点就是单官,数得出来", () => {
    // 黑第 3 列、白第 5 列,第 4 列整列都是单官
    const rows: string[] = [];
    for (let y = 0; y < 9; y++) rows.push("..X.O....");
    const board = parseRows(rows);
    expect(damePoints(board)).toHaveLength(9);
  });

  it("填单官会轮流填,填完就一个都不剩", () => {
    const rows: string[] = [];
    for (let y = 0; y < 9; y++) rows.push("..X.O....");
    const { board, filled } = fillDame(parseRows(rows), BLACK);
    expect(filled.length).toBeGreaterThan(0);
    expect(damePoints(board)).toHaveLength(0);
    expect(filled[0].color).toBe(BLACK);
  });

  it("已经贴在一起的终局盘一个单官都没有", () => {
    expect(damePoints(finalA())).toHaveLength(0);
  });
});

describe("weiqi-garden · 双活的公气两边都不算", () => {
  /**
   * 左上角摆一个双活:黑白两块贴在一起,只剩两个公气,谁先紧气谁先没气。
   */
  const seki = parseRows([
    "XXXX.OOOO",
    "XXXX.OOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO"
  ]);

  it("公气不算给任何一方(数子法把它算成中立点)", () => {
    const s = chineseScore(seki);
    expect(s.neutral).toBe(2);
    expect(s.black).toBe(43);
    expect(s.white).toBe(36);
    expect(s.black + s.white + s.neutral).toBe(81);
  });

  it("数目法下公气同样不得目", () => {
    const jp = japaneseScore(seki, [], captures0);
    expect(jp.blackTerritory).toBe(0);
    expect(jp.whiteTerritory).toBe(0);
  });

  it("公气不算单官,不该去填", () => {
    expect(damePoints(seki)).toEqual([]);
  });
});

describe("weiqi-garden · 贴还与文案", () => {
  it("分先贴还:数子 3¾ 子、数目 6½ 目", () => {
    expect(komiFor("chinese", 0)).toBe(3.75);
    expect(komiFor("japanese", 0)).toBe(6.5);
  });

  it("让 n 子就多贴 n:让 2 子数子贴 5¾,让 3 子数目贴 9½", () => {
    expect(komiFor("chinese", 2)).toBe(5.75);
    expect(komiFor("chinese", 3)).toBe(6.75);
    expect(komiFor("japanese", 3)).toBe(9.5);
    expect(komiFor("chinese", -1)).toBe(3.75);
  });

  it("让子会把胜负翻过来:同一个终局盘,让 2 子之后黑就不够了", () => {
    expect(finalScore(finalA(), { rule: "chinese", handicap: 0 }).winner).toBe("black");
    expect(finalScore(finalA(), { rule: "chinese", handicap: 6 }).winner).toBe("white");
  });

  it("结算面板的说明句里带单位,数子说「子」、数目说「目」", () => {
    expect(judge("chinese", 45, 36, 3.75).text).toContain("子");
    expect(judge("japanese", 36, 27, 6.5).text).toContain("目");
    expect(scoreLines(finalA(), { rule: "chinese" }).join("")).toContain("围空");
    expect(scoreLines(finalA(), { rule: "japanese" }).join("")).toContain("空目");
    expect(RULE_LABELS.chinese).toBe("数子法");
    expect(RULE_LABELS.japanese).toBe("数目法");
    expect(RULE_HINTS.chinese).toContain("单官");
  });

  it("盘面全空时两边都是 0,不会算出负数或 NaN", () => {
    const s = chineseScore(board9());
    expect(s.black).toBe(0);
    expect(s.white).toBe(0);
    expect(s.neutral).toBe(81);
    expect(Number.isFinite(finalScore(board9(), { rule: "chinese" }).diff)).toBe(true);
    expect(rows9()).toHaveLength(9);
  });
});
