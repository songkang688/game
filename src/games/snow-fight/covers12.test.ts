/**
 * 三种掩体的用例。
 *
 * 三种掩体各有各的脾气,差别必须**摸得出来**:
 * 雪墙砸三下碎、木箱砸不碎但会被推着走、雪坡站着不管用只有蹲下才半隐藏。
 * 再加一条伪纵深:远排抬高、判定收窄,低平的一发会从它底下穿过去。
 */
import { describe, expect, it } from "vitest";
import {
  CRATE_PUSH,
  FAR_HIT_SCALE,
  ROW_LIFT,
  SLOPE_HIDE,
  WALL_HP,
  blocksBall,
  coverAt,
  coverBox,
  defaultHp,
  hidesFighter,
  hitCover,
  isGone,
  makeCover,
  rowBase,
  rowHitScale,
  speedRatio,
  type Cover12,
} from "./covers12";

const fast = { dir: 1 as const, speed: 30 };

function wall(over: Partial<Cover12> = {}): Cover12 {
  return { ...makeCover({ kind: "wall", x: 20, w: 2.4, h: 4 }, 1), ...over };
}
function crate(over: Partial<Cover12> = {}): Cover12 {
  return { ...makeCover({ kind: "crate", x: 20, w: 1.8, h: 2.6 }, 2), ...over };
}
function slope(over: Partial<Cover12> = {}): Cover12 {
  return { ...makeCover({ kind: "slope", x: 20, w: 3.4, h: 2.2 }, 3), ...over };
}

describe("雪墙:砸三下就碎", () => {
  it("耐久正好三下,第三下报 broke,碎了要从场上拿走", () => {
    expect(defaultHp("wall")).toBe(WALL_HP);
    let c = wall();
    for (let i = 1; i <= WALL_HP; i++) {
      const out = hitCover(c, fast);
      c = out.cover;
      expect(out.broke).toBe(i === WALL_HP);
      expect(out.pushed).toBe(0);
    }
    expect(isGone(c)).toBe(true);
  });

  it("砸雪墙不会把它推走——那是木箱的活", () => {
    const out = hitCover(wall(), fast);
    expect(out.cover.x).toBe(20);
  });
});

describe("木箱:砸不碎,但推得动", () => {
  it("耐久是无穷,砸多少下都不碎,只会一路挪", () => {
    expect(defaultHp("crate")).toBe(Infinity);
    let c = crate();
    for (let i = 0; i < 8; i++) c = hitCover(c, fast).cover;
    expect(isGone(c)).toBe(false);
    expect(c.x).toBeGreaterThan(20);
  });

  it("被推的方向跟着球走,一下最多挪 CRATE_PUSH", () => {
    const right = hitCover(crate(), { dir: 1, speed: 99 });
    expect(right.pushed).toBeCloseTo(CRATE_PUSH, 6);
    const left = hitCover(crate(), { dir: -1, speed: 99 });
    expect(left.pushed).toBeCloseTo(-CRATE_PUSH, 6);
  });

  it("慢悠悠的一发只是啪一声,推不动", () => {
    expect(speedRatio(6)).toBe(0);
    expect(speedRatio(999)).toBe(1);
    expect(hitCover(crate(), { dir: 1, speed: 6 }).pushed).toBe(0);
  });

  it("推到边上就停住,不会被推出场地", () => {
    let c = crate({ x: 57 });
    for (let i = 0; i < 20; i++) c = hitCover(c, fast, { min: 0, max: 60 }).cover;
    expect(c.x + c.w).toBeLessThanOrEqual(60 + 1e-9);
    let l = crate({ x: 0.4 });
    for (let i = 0; i < 20; i++) l = hitCover(l, { dir: -1, speed: 30 }, { min: 0, max: 60 }).cover;
    expect(l.x).toBeGreaterThanOrEqual(0);
  });
});

describe("雪坡:蹲下才半隐藏", () => {
  it("站着一点都不挡,蹲下挡一半——「蹲下搓雪」和「蹲下躲」是同一个动作", () => {
    const s = slope();
    expect(hidesFighter(s, { x: 24, crouching: false }, 1)).toBe(0);
    expect(hidesFighter(s, { x: 24, crouching: true }, 1)).toBe(SLOPE_HIDE);
  });

  it("雪墙和木箱不一样:站着也挡下半身,蹲下整个人缩进去", () => {
    expect(hidesFighter(wall(), { x: 23.5, crouching: false }, 1)).toBeCloseTo(0.35, 6);
    expect(hidesFighter(wall(), { x: 23.5, crouching: true }, 1)).toBe(1);
    expect(hidesFighter(crate(), { x: 23, crouching: true }, 1)).toBe(1);
  });

  it("站错边、或者离得太远,都不算躲在它后面", () => {
    const w = wall();
    // 球从右边来,人却站在墙的左边:等于没躲
    expect(hidesFighter(w, { x: 18, crouching: true }, 1)).toBe(0);
    // 站在正确的一边但站到十万八千里外
    expect(hidesFighter(w, { x: 40, crouching: true }, 1)).toBe(0);
    // 换个方向来球,左边那位就躲上了
    expect(hidesFighter(w, { x: 18, crouching: true }, -1)).toBe(1);
  });

  it("`coverAt` 取最好的那一处,不叠加——躲两层墙也还是一层的效果", () => {
    const covers = [slope(), wall({ x: 22, w: 2 })];
    expect(coverAt(covers, { x: 24.5, crouching: true }, 1)).toBe(1);
    expect(coverAt(covers, { x: 24.5, crouching: false }, 1)).toBeCloseTo(0.35, 6);
    expect(coverAt([], { x: 24.5, crouching: true }, 1)).toBe(0);
  });

  it("雪坡是个斜面:擦着矮的那一头飞过去挡不住,撞在高的那一头才挡得下", () => {
    const s = slope();
    // 左边缘(矮)上方 1.5 格:从坡面上头飞过去
    expect(blocksBall(s, { x: 20.2, y: 1.5 })).toBe(false);
    // 右边缘(高)同样的高度:撞上
    expect(blocksBall(s, { x: 23.2, y: 1.5 })).toBe(true);
  });
});

describe("伪纵深:近排远排", () => {
  it("远排整体抬高 ROW_LIFT,方框跟着一起抬", () => {
    expect(rowBase(0)).toBe(0);
    expect(rowBase(1)).toBe(ROW_LIFT);
    const far = coverBox(wall({ row: 1 }));
    expect(far.y0).toBe(ROW_LIFT);
    expect(far.y1).toBe(ROW_LIFT + 4);
  });

  it("低平的一发从远排掩体底下穿过去,高抛的一发才被它挡下来", () => {
    const far = wall({ row: 1 });
    expect(blocksBall(far, { x: 21, y: 0.6 })).toBe(false);
    expect(blocksBall(far, { x: 21, y: ROW_LIFT + 2 })).toBe(true);
  });

  it("远排的判定半径收窄三成:远处的靶子更难打,这是练准头的地方", () => {
    expect(rowHitScale(0)).toBe(1);
    expect(rowHitScale(1)).toBe(FAR_HIT_SCALE);
    expect(FAR_HIT_SCALE).toBeLessThan(1);
  });
});
