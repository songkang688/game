// 合成链:同级才合、位置在中点、连锁一节一节响、最高级有明确规则、序列可种子化。
import { describe, expect, it } from "vitest";
import {
  CHAIN,
  TOP_CLEAR_SCORE,
  TOP_LEVEL,
  TOP_RULE,
  biggestLevel,
  chainMerges,
  clampDropX,
  countLevel,
  dropFruit,
  mergeBusy,
  nextFruit,
  popScale,
  previewFruits,
  pullProgress,
  radiusOf,
  scoreFor,
  stepMerges,
  tryMerge,
} from "./merge";
import { GRACE_MS, addFruit, createWorld, type World } from "./physics";

function bowl(pullMs = 0, popMs = 0): World {
  return createWorld({ box: { w: 300, h: 430 }, lineY: 96, seed: 11, pullMs, popMs });
}

function put(w: World, level: number, x: number, y = 200): void {
  addFruit(w, { level, x, y, r: radiusOf(level), graceMs: 0 });
}

describe("合成链本身", () => {
  it("11 级,名字全部原创而且不重样", () => {
    expect(CHAIN.length).toBe(11);
    expect(TOP_LEVEL).toBe(10);
    const names = CHAIN.map((c) => c.name);
    expect(new Set(names).size).toBe(11);
    expect(names).toEqual(["籽", "莓", "柑", "桃", "梨", "苹", "橙", "柚", "瓜", "玉瓜", "团圆瓜"]);
  });

  it("半径逐级变大,基础分也逐级变高", () => {
    for (let i = 1; i < CHAIN.length; i++) {
      expect(CHAIN[i].r).toBeGreaterThan(CHAIN[i - 1].r);
      expect(CHAIN[i].base).toBeGreaterThan(CHAIN[i - 1].base);
    }
  });

  it("得分随等级递增,连锁越深加成越多", () => {
    expect(scoreFor(1, 1)).toBe(3);
    expect(scoreFor(2, 1)).toBeGreaterThan(scoreFor(1, 1));
    expect(scoreFor(2, 3)).toBeGreaterThan(scoreFor(2, 1));
    expect(scoreFor(5, 2)).toBe(Math.floor(CHAIN[5].base * 1.5));
    expect(scoreFor(0, 9)).toBe(0);
  });
});

describe("同级才合成", () => {
  it("两颗同级碰在一起就升一级", () => {
    const w = bowl();
    put(w, 1, 150);
    put(w, 1, 172);
    const merges = tryMerge(w);
    expect(merges.length).toBe(1);
    expect(w.fruits.length).toBe(1);
    expect(w.fruits[0].level).toBe(2);
  });

  it("不同级挨着也不会合成", () => {
    const w = bowl();
    put(w, 1, 150);
    put(w, 2, 172);
    expect(tryMerge(w).length).toBe(0);
    expect(w.fruits.length).toBe(2);
  });

  it("同级但离得远也不合成", () => {
    const w = bowl();
    put(w, 1, 60);
    put(w, 1, 240);
    expect(tryMerge(w).length).toBe(0);
  });

  it("新果正好出现在两心中点", () => {
    const w = bowl();
    put(w, 2, 120, 210);
    put(w, 2, 140, 224);
    expect(tryMerge(w).length).toBe(1);
    expect(w.fruits[0].x).toBeCloseTo(130, 6);
    expect(w.fruits[0].y).toBeCloseTo(217, 6);
  });

  it("一轮里每颗最多参与一次合成", () => {
    const w = bowl();
    put(w, 0, 100);
    put(w, 0, 117);
    put(w, 0, 134);
    const merges = tryMerge(w);
    expect(merges.length).toBe(1);
    expect(countLevel(w, 0)).toBe(1);
    expect(countLevel(w, 1)).toBe(1);
  });
});

describe("连锁", () => {
  it("摆好位置能一次连响三节,得分按节数加成", () => {
    const w = bowl();
    put(w, 0, 140);
    put(w, 0, 158);
    put(w, 1, 170);
    put(w, 2, 185);
    const res = chainMerges(w);
    expect(res.merges.length).toBe(3);
    expect(res.chain).toBe(3);
    expect(res.score).toBe(scoreFor(1, 1) + scoreFor(2, 2) + scoreFor(3, 3));
    expect(w.fruits.length).toBe(1);
    expect(w.fruits[0].level).toBe(3);
    expect(w.bestChain).toBe(3);
  });

  it("没得连的时候 chainMerges 什么都不做", () => {
    const w = bowl();
    put(w, 1, 60);
    put(w, 3, 240);
    const res = chainMerges(w);
    expect(res.merges.length).toBe(0);
    expect(res.score).toBe(0);
    expect(w.fruits.length).toBe(2);
  });

  it("chainMerges 借用完瞬时模式会把动画时长还回去", () => {
    const w = bowl(130, 80);
    put(w, 1, 150);
    put(w, 1, 172);
    chainMerges(w);
    expect(w.pullMs).toBe(130);
    expect(w.popMs).toBe(80);
  });
});

describe("最高级相碰", () => {
  it("两颗团圆瓜相碰按清除规则:一起散开并加一笔大分", () => {
    const w = bowl();
    put(w, TOP_LEVEL, 100, 300);
    put(w, TOP_LEVEL, 218, 300);
    expect(TOP_RULE).toBe("clear");
    const merges = tryMerge(w);
    expect(merges.length).toBe(1);
    expect(merges[0].level).toBe(-1);
    expect(w.fruits.length).toBe(0);
    expect(w.score).toBe(TOP_CLEAR_SCORE);
  });

  it("合成不会越过最高级", () => {
    const w = bowl();
    put(w, 9, 120, 300);
    put(w, 9, 218, 300);
    chainMerges(w);
    expect(biggestLevel(w)).toBe(TOP_LEVEL);
  });
});

describe("合成是吸合动画,不是瞬变", () => {
  it("刚碰上的那一瞬间新果还没出来", () => {
    const w = bowl(130, 80);
    put(w, 1, 150);
    put(w, 1, 172);
    const started = tryMerge(w);
    expect(started.length).toBe(1);
    expect(mergeBusy(w)).toBe(true);
    expect(w.fruits.length).toBe(0);
    expect(pullProgress(started[0])).toBe(0);
  });

  it("吸合走完才弹出新果,弹出还有一小段回弹", () => {
    const w = bowl(130, 80);
    put(w, 1, 150);
    put(w, 1, 172);
    tryMerge(w);
    expect(stepMerges(w, 100).length).toBe(0);
    expect(w.fruits.length).toBe(0);
    const born = stepMerges(w, 40);
    expect(born.length).toBe(1);
    expect(born[0].level).toBe(2);
    expect(born[0].popMs).toBe(80);
    expect(mergeBusy(w)).toBe(true);
    stepMerges(w, 100);
    expect(mergeBusy(w)).toBe(false);
  });

  it("弹出的缩放是先小后大再回落到 1", () => {
    expect(popScale(80, 80)).toBeLessThan(0.8);
    expect(popScale(20, 80)).toBeGreaterThan(1);
    expect(popScale(0, 80)).toBe(1);
    expect(popScale(40, 0)).toBe(1);
  });

  it("动画期间新果的分数还没记上,弹出来才算", () => {
    const w = bowl(130, 80);
    put(w, 1, 150);
    put(w, 1, 172);
    tryMerge(w);
    expect(w.score).toBe(0);
    stepMerges(w, 140);
    expect(w.score).toBe(scoreFor(2, 1));
  });
});

describe("投放序列", () => {
  it("同一个 seed 永远给出同一串", () => {
    const a = previewFruits(4242, 0, 20, 2);
    const b = previewFruits(4242, 0, 20, 2);
    expect(a).toEqual(b);
  });

  it("换个 seed 就换一串", () => {
    const a = previewFruits(1, 0, 24, 2).join(",");
    const b = previewFruits(2, 0, 24, 2).join(",");
    expect(a).not.toBe(b);
  });

  it("等级永远落在允许的区间里", () => {
    for (let i = 0; i < 300; i++) {
      const lv = nextFruit(999, i, 4, 2);
      expect(lv).toBeGreaterThanOrEqual(2);
      expect(lv).toBeLessThanOrEqual(4);
    }
  });

  it("小果子出得比大果子多", () => {
    let small = 0;
    let big = 0;
    for (let i = 0; i < 400; i++) {
      const lv = nextFruit(31337, i, 4, 0);
      if (lv === 0) small++;
      if (lv === 4) big++;
    }
    expect(small).toBeGreaterThan(big * 3);
  });

  it("预览和真正投下来的顺序一致", () => {
    const preview = previewFruits(88, 5, 3, 3, 1);
    expect(preview[0]).toBe(nextFruit(88, 5, 3, 1));
    expect(preview[2]).toBe(nextFruit(88, 7, 3, 1));
  });
});

describe("投放", () => {
  it("落点会被夹进盆里,整颗果子都在墙内", () => {
    expect(clampDropX(300, 8, -50)).toBe(radiusOf(8));
    expect(clampDropX(300, 8, 9999)).toBe(300 - radiusOf(8));
    expect(clampDropX(300, 0, 150)).toBe(150);
  });

  it("投下的果子带宽限期,而且会计数", () => {
    const w = bowl();
    const f = dropFruit(w, 1, 500);
    expect(w.drops).toBe(1);
    expect(f.graceMs).toBe(GRACE_MS);
    expect(f.x).toBe(300 - radiusOf(1));
    expect(w.events.some((e) => e.kind === "drop")).toBe(true);
  });
});
