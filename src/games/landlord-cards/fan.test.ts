import { describe, expect, it } from "vitest";
import {
  boxHits,
  cardHeightFor,
  cardWidthFor,
  fanHeightFor,
  fanLayout,
  hitIndex,
  isDragBox,
  moveCursor,
  normBox,
} from "./fan";

describe("牌的尺寸", () => {
  it("窄屏(375)与宽屏(1280)都给出能看清的牌宽", () => {
    expect(cardWidthFor(340)).toBeGreaterThanOrEqual(44);
    expect(cardWidthFor(340)).toBeLessThanOrEqual(66);
    expect(cardWidthFor(1200)).toBe(66);
  });

  it("宽度不合法时给一个安全值", () => {
    expect(cardWidthFor(0)).toBe(44);
    expect(cardWidthFor(Number.NaN)).toBe(44);
  });

  it("牌是竖着的长方形,容器留得下选中时上抬的空间", () => {
    const w = cardWidthFor(375);
    expect(cardHeightFor(w)).toBeGreaterThan(w);
    expect(fanHeightFor(w)).toBeGreaterThan(cardHeightFor(w));
  });
});

describe("扇形摆牌", () => {
  it("几张牌就给几个位置", () => {
    expect(fanLayout(17, 340, 40)).toHaveLength(17);
    expect(fanLayout(0, 340, 40)).toHaveLength(0);
  });

  it("只有一张时摆正中间,不歪", () => {
    const [s] = fanLayout(1, 300, 40);
    expect(s.rot).toBe(0);
    expect(s.x).toBe(130);
  });

  it("从左到右排开,不会倒着走", () => {
    const slots = fanLayout(17, 340, 40);
    for (let i = 1; i < slots.length; i++) expect(slots[i].x).toBeGreaterThan(slots[i - 1].x);
  });

  it("整扇牌不会超出容器", () => {
    const slots = fanLayout(20, 340, 40);
    expect(slots[0].x).toBeGreaterThanOrEqual(0);
    expect(slots[slots.length - 1].x + 40).toBeLessThanOrEqual(341);
  });

  it("左边往左歪、右边往右歪,中间基本是正的", () => {
    const slots = fanLayout(11, 340, 40);
    expect(slots[0].rot).toBeLessThan(0);
    expect(slots[10].rot).toBeGreaterThan(0);
    expect(Math.abs(slots[5].rot)).toBeLessThan(1);
  });

  it("两端比中间沉一点,像一把打开的扇子", () => {
    const slots = fanLayout(11, 340, 40);
    expect(slots[0].y).toBeGreaterThan(slots[5].y);
    expect(slots[10].y).toBeGreaterThan(slots[5].y);
  });

  it("牌越多叠得越紧", () => {
    const few = fanLayout(5, 340, 40);
    const many = fanLayout(17, 340, 40);
    expect(many[1].x - many[0].x).toBeLessThan(few[1].x - few[0].x);
  });

  it("窄到极限也不会把牌摆成负宽度", () => {
    const slots = fanLayout(20, 120, 40);
    for (let i = 1; i < slots.length; i++) expect(slots[i].x).toBeGreaterThan(slots[i - 1].x);
  });
});

describe("框选", () => {
  it("反着拖也能整理成左上右下", () => {
    expect(normBox(100, 80, 20, 10)).toEqual({ x1: 20, y1: 10, x2: 100, y2: 80 });
  });

  it("只挪了一点点就当成普通点击,不算框选", () => {
    expect(isDragBox(normBox(10, 10, 14, 12))).toBe(false);
    expect(isDragBox(normBox(10, 10, 60, 12))).toBe(true);
  });

  it("横着划过去,划到的每一张都被选中", () => {
    const slots = fanLayout(10, 340, 40);
    const hits = boxHits(slots, 40, 57, normBox(slots[2].x + 2, 5, slots[5].x + 2, 40));
    expect(hits).toContain(2);
    expect(hits).toContain(5);
    expect(hits).not.toContain(9);
  });

  it("框在牌外面什么都选不到", () => {
    const slots = fanLayout(10, 340, 40);
    expect(boxHits(slots, 40, 57, normBox(0, 400, 340, 460))).toHaveLength(0);
  });

  it("整个手牌区框起来就是全选", () => {
    const slots = fanLayout(10, 340, 40);
    expect(boxHits(slots, 40, 57, normBox(0, 0, 340, 200))).toHaveLength(10);
  });

  it("选中的下标一定是升序、不重复", () => {
    const slots = fanLayout(17, 340, 40);
    const hits = boxHits(slots, 40, 57, normBox(20, 0, 200, 100));
    expect(hits).toEqual([...hits].sort((a, b) => a - b));
    expect(new Set(hits).size).toBe(hits.length);
  });
});

describe("点选命中", () => {
  it("点在露出来的那一条上就选中那一张", () => {
    const slots = fanLayout(10, 340, 40);
    expect(hitIndex(slots, 40, 57, slots[3].x + 2, slots[3].y + 20)).toBe(3);
  });

  it("重叠的地方算上面那一张", () => {
    const slots = fanLayout(10, 340, 40);
    const overlapX = slots[4].x + 2;
    expect(hitIndex(slots, 40, 57, overlapX, slots[4].y + 20)).toBe(4);
  });

  it("最后一张整张都能点到", () => {
    const slots = fanLayout(10, 340, 40);
    const last = slots.length - 1;
    expect(hitIndex(slots, 40, 57, slots[last].x + 35, slots[last].y + 20)).toBe(last);
  });

  it("点空白处什么都不选", () => {
    const slots = fanLayout(10, 340, 40);
    expect(hitIndex(slots, 40, 57, 5, 400)).toBe(-1);
  });

  it("被挑起来的牌,点它抬起来之后的位置也算数", () => {
    const slots = fanLayout(10, 340, 40);
    const lifts = slots.map((_, i) => (i === 3 ? 20 : 0));
    expect(hitIndex(slots, 40, 57, slots[3].x + 2, slots[3].y - 15, lifts)).toBe(3);
  });
});

describe("键盘光标", () => {
  it("左右移动到头就停住", () => {
    expect(moveCursor(0, -1, 5)).toBe(0);
    expect(moveCursor(4, 1, 5)).toBe(4);
    expect(moveCursor(2, 1, 5)).toBe(3);
  });

  it("没有牌时光标停在 0", () => {
    expect(moveCursor(3, 1, 0)).toBe(0);
  });
});
