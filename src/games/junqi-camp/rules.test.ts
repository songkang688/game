// 军旗对决 · 电子裁判单测：棋盘长得对不对、能走到哪儿、撞上以后谁留下、这一盘怎么算完。
import { describe, expect, it } from "vitest";
import {
  CAMP,
  HQ,
  LINES,
  ROAD_ADJ,
  RAIL_ADJ,
  cellsOf,
  idx,
  inCamp,
  inHQ,
  isRail,
  placeableOf,
  type Pos,
} from "./board";
import {
  ARMY_SIZE,
  BOMB_ON_FLAG_WINS,
  NO_CAPTURE_DRAW,
  applyMove,
  combat,
  drawByNoCapture,
  hasMoves,
  knownInfo,
  legalMoves,
  makeState,
  movablePiece,
  movesFrom,
  railMoves,
  revealFlagOnCommanderLoss,
  roadMoves,
  status,
  visibleKind,
  winner,
  type Cell,
  type GameState,
  type Kind,
  type Side,
} from "./rules";

let nextId = 1;

function board(): Cell[] {
  nextId = 1;
  return new Array<Cell>(60).fill(null);
}

function put(cells: Cell[], p: Pos, side: Side, kind: Kind): Pos {
  cells[p] = { id: nextId++, side, kind };
  return p;
}

function state(cells: Cell[], turn: Side = "duo"): GameState {
  return makeState(cells, { turn });
}

describe("军旗对决 · 棋盘", () => {
  it("每边非行营格正好 25 个，和 25 枚棋子一一对上", () => {
    expect(ARMY_SIZE).toBe(25);
    expect(placeableOf("duo")).toHaveLength(25);
    expect(placeableOf("star")).toHaveLength(25);
    expect(cellsOf("duo")).toHaveLength(30);
  });

  it("行营五个、大本营两个，行营不在铁路上", () => {
    expect(CAMP.duo).toHaveLength(5);
    expect(HQ.duo).toHaveLength(2);
    for (const p of [...CAMP.duo, ...CAMP.star]) {
      expect(inCamp(p)).toBe(true);
      expect(isRail(p)).toBe(false);
    }
    for (const p of [...HQ.duo, ...HQ.star]) {
      expect(inHQ(p)).toBe(true);
      expect(isRail(p)).toBe(false);
    }
  });

  it("前沿只有第 1、3、5 列能过，第 2、4 列是山界", () => {
    for (const c of [0, 2, 4]) {
      expect(ROAD_ADJ[idx(5, c)]).toContain(idx(6, c));
    }
    for (const c of [1, 3]) {
      expect(ROAD_ADJ[idx(5, c)]).not.toContain(idx(6, c));
    }
  });

  it("铁路是整行整列连起来的，画线表里粗线细线都有", () => {
    expect(RAIL_ADJ[idx(1, 0)]).toContain(idx(1, 1));
    expect(RAIL_ADJ[idx(1, 0)]).toContain(idx(2, 0));
    expect(RAIL_ADJ[idx(5, 2)]).toContain(idx(6, 2));
    expect(RAIL_ADJ[idx(0, 1)]).toHaveLength(0);
    expect(LINES.some((l) => l.rail)).toBe(true);
    expect(LINES.some((l) => !l.rail && l.diagonal)).toBe(true);
  });

  it("行营和四个斜角是通的", () => {
    const camp = idx(2, 1);
    expect(ROAD_ADJ[camp]).toContain(idx(1, 0));
    expect(ROAD_ADJ[camp]).toContain(idx(3, 2));
  });
});

describe("军旗对决 · 对撞表", () => {
  const bigger: Array<[Kind, Kind]> = [
    ["siling", "junzhang"],
    ["junzhang", "shizhang"],
    ["shizhang", "lvzhang"],
    ["lvzhang", "tuanzhang"],
    ["tuanzhang", "yingzhang"],
    ["yingzhang", "lianzhang"],
    ["lianzhang", "paizhang"],
    ["paizhang", "gongbing"],
  ];

  it("号数大的留下，号数小的回营休息", () => {
    for (const [big, small] of bigger) {
      expect(combat(big, small).outcome).toBe("attacker");
      expect(combat(small, big).outcome).toBe("defender");
    }
  });

  it("同级对撞两子同尽", () => {
    for (const k of ["siling", "shizhang", "lianzhang", "gongbing"] as Kind[]) {
      expect(combat(k, k).outcome).toBe("both");
    }
  });

  it("炸弹碰上谁都是同尽", () => {
    for (const k of ["siling", "paizhang", "gongbing", "dilei", "zhadan"] as Kind[]) {
      expect(combat("zhadan", k).outcome).toBe("both");
      expect(combat(k, "zhadan").outcome).toBe("both");
    }
  });

  it("炸弹撞上军旗，本款判扛旗成功", () => {
    expect(BOMB_ON_FLAG_WINS).toBe(true);
    const r = combat("zhadan", "junqi");
    expect(r.outcome).toBe("both");
    expect(r.flagTaken).toBe(true);
  });

  it("工兵挖得掉地雷，别的棋子碰上地雷要回营", () => {
    expect(combat("gongbing", "dilei").outcome).toBe("attacker");
    for (const k of ["siling", "junzhang", "paizhang"] as Kind[]) {
      expect(combat(k, "dilei").outcome).toBe("defender");
    }
    expect(combat("zhadan", "dilei").outcome).toBe("both");
  });

  it("撞上军旗就算扛旗成功", () => {
    for (const k of ["siling", "gongbing", "paizhang"] as Kind[]) {
      const r = combat(k, "junqi");
      expect(r.outcome).toBe("attacker");
      expect(r.flagTaken).toBe(true);
    }
  });
});

describe("军旗对决 · 走子", () => {
  it("公路一次只走一格", () => {
    const b = board();
    const from = put(b, idx(3, 0), "duo", "yingzhang");
    const moves = roadMoves(b, from);
    expect(moves).toContain(idx(2, 0));
    expect(moves).toContain(idx(4, 0));
    expect(moves).not.toContain(idx(1, 0));
  });

  it("铁路上直线走任意格，被子挡住就过不去", () => {
    const b = board();
    const from = put(b, idx(1, 0), "duo", "yingzhang");
    expect(railMoves(b, from, false)).toContain(idx(1, 4));
    put(b, idx(1, 2), "duo", "paizhang");
    const blocked = railMoves(b, from, false);
    expect(blocked).toContain(idx(1, 1));
    expect(blocked).not.toContain(idx(1, 2));
    expect(blocked).not.toContain(idx(1, 3));
  });

  it("挡路的是对方的子就撞得着，撞完不能再往前", () => {
    const b = board();
    const from = put(b, idx(1, 0), "duo", "yingzhang");
    put(b, idx(1, 3), "star", "paizhang");
    const moves = railMoves(b, from, false);
    expect(moves).toContain(idx(1, 3));
    expect(moves).not.toContain(idx(1, 4));
  });

  it("只有工兵能在铁路上拐弯", () => {
    const b = board();
    const at = idx(10, 0);
    const eng = put(b, at, "duo", "gongbing");
    expect(railMoves(b, eng, true)).toContain(idx(1, 3));
    b[at] = { id: 99, side: "duo", kind: "yingzhang" };
    expect(railMoves(b, at, false)).not.toContain(idx(1, 3));
    expect(railMoves(b, at, false)).toContain(idx(1, 0));
  });

  it("行营里的棋子撞不着，得等它自己走出来", () => {
    const b = board();
    const from = put(b, idx(3, 0), "duo", "siling");
    const camp = put(b, idx(2, 1), "star", "paizhang");
    expect(movesFrom(b, from)).not.toContain(camp);
    expect(movesFrom(b, camp)).toContain(idx(1, 0));
  });

  it("进了大本营的棋子不能再动，地雷与军旗一直不动", () => {
    const b = board();
    const hq = put(b, idx(11, 1), "duo", "siling");
    const mine = put(b, idx(10, 0), "duo", "dilei");
    const flag = put(b, idx(11, 3), "duo", "junqi");
    expect(movablePiece(b, hq)).toBe(false);
    expect(movesFrom(b, hq)).toHaveLength(0);
    expect(movesFrom(b, mine)).toHaveLength(0);
    expect(movesFrom(b, flag)).toHaveLength(0);
  });
});

describe("军旗对决 · 一盘棋怎么算完", () => {
  it("扛走对方军旗就赢", () => {
    const b = board();
    put(b, idx(1, 1), "duo", "paizhang");
    put(b, idx(0, 1), "star", "junqi");
    put(b, idx(4, 4), "star", "lianzhang");
    const s = state(b);
    const r = applyMove(s, { from: idx(1, 1), to: idx(0, 1) });
    expect(r.ok).toBe(true);
    expect(status(s).kind).toBe("win");
    expect(winner(s)).toBe("duo");
  });

  it("司令回营，立刻把这一方的军旗亮出来", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "siling");
    put(b, idx(5, 0), "star", "siling");
    const flag = put(b, idx(0, 1), "star", "junqi");
    put(b, idx(4, 4), "star", "lianzhang");
    const s = state(b);
    expect(s.flagShown.star).toBe(false);
    applyMove(s, { from: idx(6, 0), to: idx(5, 0) });
    expect(s.flagShown.star).toBe(true);
    expect(s.history.some((e) => e.t === "flagShown" && e.at === flag)).toBe(true);
    expect(revealFlagOnCommanderLoss(s, "star")).toBe(flag);
  });

  it("对方一枚能动的子都没有就判负", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "siling");
    put(b, idx(0, 1), "star", "junqi");
    put(b, idx(1, 0), "star", "dilei");
    const s = state(b, "star");
    expect(hasMoves(b, "star")).toBe(false);
    expect(legalMoves(b, "star")).toHaveLength(0);
    expect(status(s).kind).toBe("win");
    expect(status(s).side).toBe("duo");
  });

  it("70 手都没人吃子就算和", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "siling");
    put(b, idx(0, 1), "star", "junqi");
    put(b, idx(2, 0), "star", "siling");
    const s = state(b);
    expect(drawByNoCapture(s)).toBe(false);
    s.sinceCapture = NO_CAPTURE_DRAW;
    expect(drawByNoCapture(s)).toBe(true);
    expect(status(s).kind).toBe("draw");
  });

  it("走一步不吃子，无吃子计数就加一；吃了子就清零", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "siling");
    put(b, idx(4, 0), "star", "paizhang");
    put(b, idx(0, 1), "star", "junqi");
    const s = state(b);
    applyMove(s, { from: idx(6, 0), to: idx(5, 0) });
    expect(s.sinceCapture).toBe(1);
    s.turn = "duo";
    applyMove(s, { from: idx(5, 0), to: idx(4, 0) });
    expect(s.sinceCapture).toBe(0);
  });

  it("走不通的一步不会改盘面", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "siling");
    put(b, idx(0, 1), "star", "junqi");
    put(b, idx(2, 0), "star", "siling");
    const s = state(b);
    const before = s.cells.slice();
    const r = applyMove(s, { from: idx(6, 0), to: idx(0, 3) });
    expect(r.ok).toBe(false);
    expect(s.cells).toEqual(before);
  });
});

describe("军旗对决 · 暗棋信息集", () => {
  it("撞过一次的子从此就是明的，动过的子一定不是地雷军旗", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "junzhang");
    put(b, idx(5, 0), "star", "lianzhang");
    put(b, idx(0, 1), "star", "junqi");
    put(b, idx(4, 4), "star", "shizhang");
    const s = state(b);
    applyMove(s, { from: idx(6, 0), to: idx(5, 0) });
    const know = knownInfo("duo", s.history);
    const facts = [...know.facts.values()];
    expect(facts.some((f) => f.kind === "lianzhang")).toBe(true);
    // 康康那边走一步，鸭梨就知道这枚子会动
    applyMove(s, { from: idx(4, 4), to: idx(3, 4) });
    const after = knownInfo("duo", s.history);
    expect([...after.facts.values()].some((f) => f.moved)).toBe(true);
  });

  it("在铁路上拐过弯的一定是工兵", () => {
    const b = board();
    put(b, idx(11, 0), "duo", "siling");
    const eng = put(b, idx(5, 0), "star", "gongbing");
    put(b, idx(0, 1), "star", "junqi");
    const s = state(b, "star");
    // 先顺着第 0 列往上，再拐进第 1 行——这个弯只有工兵拐得过来
    const r = applyMove(s, { from: eng, to: idx(1, 2) });
    expect(r.ok).toBe(true);
    const know = knownInfo("duo", s.history);
    expect([...know.facts.values()].some((f) => f.engineer && f.kind === "gongbing")).toBe(true);
  });

  it("没露过面的对方棋子只看得到一张背面，自己的子一直看得见", () => {
    const b = board();
    const mine = put(b, idx(6, 0), "duo", "siling");
    const hidden = put(b, idx(4, 4), "star", "shizhang");
    put(b, idx(0, 1), "star", "junqi");
    const s = state(b);
    expect(visibleKind(s, "duo", mine)).toBe("siling");
    expect(visibleKind(s, "duo", hidden)).toBeNull();
    expect(visibleKind(s, "all", hidden)).toBe("shizhang");
  });

  it("司令回营亮旗之后，对方看得见那面旗", () => {
    const b = board();
    put(b, idx(6, 0), "duo", "siling");
    put(b, idx(5, 0), "star", "siling");
    const flag = put(b, idx(0, 1), "star", "junqi");
    put(b, idx(4, 4), "star", "lianzhang");
    const s = state(b);
    applyMove(s, { from: idx(6, 0), to: idx(5, 0) });
    expect(knownInfo("duo", s.history).flagAt).toBe(flag);
    expect(visibleKind(s, "duo", flag)).toBe("junqi");
  });
});
