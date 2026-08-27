import { describe, expect, it } from "vitest";
import {
  aliveRing,
  attackRange,
  distance,
  inSlashRange,
  ringDistance,
  withinTrickRange,
  TRICK_RANGE_NEED,
  type Seat
} from "./distance";

/** 五个人围一圈 */
const FIVE: Seat[] = [0, 1, 2, 3, 4].map((id) => ({ id }));

describe("环上距离", () => {
  it("自己到自己是 0,相邻是 1", () => {
    expect(ringDistance(0, 0, FIVE)).toBe(0);
    expect(ringDistance(0, 1, FIVE)).toBe(1);
    expect(ringDistance(0, 4, FIVE)).toBe(1);
  });

  it("走近的那一边:五人桌里最远也只有 2", () => {
    expect(ringDistance(0, 2, FIVE)).toBe(2);
    expect(ringDistance(0, 3, FIVE)).toBe(2);
    expect(ringDistance(1, 4, FIVE)).toBe(2);
  });

  it("退场休息的人从环上摘掉,剩下的人彼此更近了", () => {
    const withOut: Seat[] = [{ id: 0 }, { id: 1, out: true }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(aliveRing(withOut)).toEqual([0, 2, 3, 4]);
    // 1 号走了,0 和 2 变成邻座
    expect(ringDistance(0, 2, FIVE)).toBe(2);
    expect(ringDistance(0, 2, withOut)).toBe(1);
  });

  it("问一个已经退场的人,距离是无穷远", () => {
    const withOut: Seat[] = [{ id: 0 }, { id: 1, out: true }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(Number.isFinite(ringDistance(0, 1, withOut))).toBe(false);
    expect(distance(0, 1, withOut)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("坐骑修正", () => {
  it("目标挂了疾风小马,别人算到他就 +1", () => {
    expect(distance(0, 2, FIVE)).toBe(2);
    expect(distance(0, 2, FIVE, { plus: [2] })).toBe(3);
  });

  it("自己穿了踏云软靴,算别人就 -1", () => {
    expect(distance(0, 2, FIVE, { minus: [0] })).toBe(1);
    // 软靴是自己的事,别人算到自己不受影响
    expect(distance(2, 0, FIVE, { minus: [0] })).toBe(2);
  });

  it("一边 +1 一边 -1 正好抵消", () => {
    expect(distance(0, 2, FIVE, { plus: [2], minus: [0] })).toBe(2);
  });

  it("再怎么减,距离也不会小于 1", () => {
    expect(distance(0, 1, FIVE, { minus: [0] })).toBe(1);
  });

  it("技能带来的额外 +1(闪闪的轻身)跟坐骑叠加", () => {
    expect(distance(0, 1, FIVE, { extraPlus: { 1: 1 } })).toBe(2);
    expect(distance(0, 1, FIVE, { plus: [1], extraPlus: { 1: 1 } })).toBe(3);
  });
});

describe("攻击范围", () => {
  it("没挂武器就是 1", () => {
    expect(attackRange()).toBe(1);
    expect(attackRange(0)).toBe(1);
    expect(attackRange(3)).toBe(3);
  });

  it("距离 2 空着手打不到;换上范围 2 的武器就够得着", () => {
    expect(inSlashRange(0, 2, { seats: FIVE })).toBe(false);
    expect(inSlashRange(0, 2, { seats: FIVE, weaponRange: 2 })).toBe(true);
  });

  it("武器只管「击」,顺手摘花该要 1 还是要 1", () => {
    // 挂了范围 2 的武器,击够得着
    expect(inSlashRange(0, 2, { seats: FIVE, weaponRange: 2 })).toBe(true);
    // 顺手摘花看的是纯距离,武器一概不算数
    expect(withinTrickRange(0, 2, TRICK_RANGE_NEED.snatch, { seats: FIVE })).toBe(false);
    expect(withinTrickRange(0, 1, TRICK_RANGE_NEED.snatch, { seats: FIVE })).toBe(true);
  });

  it("穿了软靴之后,顺手摘花也能够到隔壁的隔壁", () => {
    expect(withinTrickRange(0, 2, TRICK_RANGE_NEED.snatch, { seats: FIVE, horses: { minus: [0] } })).toBe(true);
  });

  it("谁都不能对自己出击", () => {
    expect(inSlashRange(0, 0, { seats: FIVE, weaponRange: 4 })).toBe(false);
    expect(withinTrickRange(0, 0, 9, { seats: FIVE })).toBe(false);
  });

  it("有人退场之后攻击范围要重算:原本够不着的现在够得着了", () => {
    expect(inSlashRange(0, 2, { seats: FIVE })).toBe(false);
    const withOut: Seat[] = [{ id: 0 }, { id: 1, out: true }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(inSlashRange(0, 2, { seats: withOut })).toBe(true);
  });
});
