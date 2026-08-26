import { describe, expect, it } from "vitest";
import {
  COMBO_MIN,
  GHOST_MS,
  LEGACY_SAVE_KEYS,
  MUSHROOM_MAX_SPEED,
  MUSHROOM_MIN_SPEED,
  SAVE_KEY,
  STICKY_HOLD,
  SWEET_BOARD_FROM,
  SWEET_GREMLIN_FROM,
  SWEET_SCISSORS_FROM,
  SWEET_STAR_MAX,
  bestSweetScore,
  buildSweetLevel,
  comboBonus,
  comboLabel,
  createSticky,
  ghostAlpha,
  levelStarCount,
  makeSwingRng,
  mushroomAxis,
  mushroomBounce,
  mushroomTriggers,
  needsMigration,
  pruneGhosts,
  pushGhost,
  readStars,
  solvabilitySample,
  stickyCatch,
  stickyProgress,
  stickyRelease,
  strokeCutIndices,
  strokeNormal,
  sweetScore,
  sweetStarCount,
  tickSticky,
} from "./swing12";
import { buildRope, makeParticle, type Link, type Particle } from "./physics";
import { LEVELS } from "./levels";
import { playRecipeFor, searchCutTimeFor } from "./sim";

/** 一根从 (ax,ay) 垂到 (bx,by) 的绳，只为割绳判定用 */
function rope(ax: number, ay: number, bx: number, by: number): { ps: Particle[]; links: Link[] } {
  const built = buildRope(ax, ay, bx, by, 6);
  const ps: Particle[] = [...built.particles, makeParticle(bx, by, false)];
  const candyIndex = ps.length - 1;
  const links: Link[] = built.links.map((l) => ({
    a: l.a < 0 ? candyIndex : l.a,
    b: l.b < 0 ? candyIndex : l.b,
    rest: l.rest,
    active: true,
  }));
  return { ps, links };
}

/* ---------------- 一刀两断 ---------------- */

describe("1.2 划线切绳与连击", () => {
  it("一笔慢慢划过一根绳能切中", () => {
    const { ps, links } = rope(100, 100, 100, 200);
    const cut = strokeCutIndices(ps, links, 60, 150, 140, 150);
    expect(cut.length).toBeGreaterThan(0);
  });

  it("手指飞快地从绳左边跳到右边也不会漏切（不穿模）", () => {
    const { ps, links } = rope(100, 100, 100, 200);
    // 两帧之间跨了 300px，任何「只看当前这个点」的判定都会漏
    const cut = strokeCutIndices(ps, links, -60, 150, 240, 150);
    expect(cut.length).toBeGreaterThan(0);
  });

  it("从绳旁边擦过去（不相交）不算切中", () => {
    const { ps, links } = rope(100, 100, 100, 200);
    expect(strokeCutIndices(ps, links, 200, 150, 300, 150)).toEqual([]);
  });

  it("已经断掉的绳段不会被重复统计", () => {
    const { ps, links } = rope(100, 100, 100, 200);
    for (const l of links) l.active = false;
    expect(strokeCutIndices(ps, links, 60, 150, 140, 150)).toEqual([]);
  });

  it("一笔横扫两根绳 = 一刀两断", () => {
    const a = rope(80, 100, 80, 220);
    const b = rope(200, 100, 200, 220);
    const ps = [...a.ps, ...b.ps];
    const shift = a.ps.length;
    const links: Link[] = [
      ...a.links,
      ...b.links.map((l) => ({ ...l, a: l.a + shift, b: l.b + shift })),
    ];
    const cut = strokeCutIndices(ps, links, 20, 160, 280, 160);
    const ropesHit = new Set(cut.map((i) => (i < a.links.length ? 0 : 1)));
    expect(ropesHit.size).toBe(2);
  });

  it("连击评价语只在切中两根及以上时出现", () => {
    expect(comboLabel(1)).toBeNull();
    expect(comboLabel(COMBO_MIN)).toContain("一刀两断");
    expect(comboLabel(3)).toContain("三断");
    expect(comboLabel(5)).toContain("5");
  });

  it("连击评价语里没有任何贬义或失败字眼", () => {
    for (let n = 1; n <= 6; n++) {
      const line = comboLabel(n) ?? "";
      expect(line).not.toMatch(/笨|差|失败|输/);
    }
  });

  it("连击奖励随根数涨但封顶 5 颗", () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(1);
    expect(comboBonus(4)).toBe(3);
    expect(comboBonus(20)).toBe(5);
  });

  it("绳头回甩方向与划线垂直，退化成一个点时也有稳定方向", () => {
    const n = strokeNormal(0, 0, 10, 0);
    expect(n.nx).toBeCloseTo(0);
    expect(Math.abs(n.ny)).toBeCloseTo(1);
    const degenerate = strokeNormal(5, 5, 5, 5);
    expect(Math.hypot(degenerate.nx, degenerate.ny)).toBeCloseTo(1);
  });
});

/* ---------------- 粘性泡泡 ---------------- */

describe("1.2 粘性泡泡", () => {
  it("撞进去就挂住，速度先收起来", () => {
    const s = stickyCatch(createSticky(), 120, -80);
    expect(s.held).toBe(true);
    expect(s.remain).toBeCloseTo(STICKY_HOLD);
  });

  it("挂住期间再撞不会刷新计时（不能赖着不走）", () => {
    let s = stickyCatch(createSticky(), 100, 0);
    s = tickSticky(s, 0.8);
    const again = stickyCatch(s, 999, 999);
    expect(again.remain).toBeCloseTo(s.remain);
    expect(again.vx).toBe(100);
  });

  it("到点自己松手", () => {
    let s = stickyCatch(createSticky(), 100, 50);
    s = tickSticky(s, STICKY_HOLD + 0.01);
    expect(s.held).toBe(false);
    expect(s.remain).toBe(0);
  });

  it("松手把速度还回去，但有损耗不会越荡越快", () => {
    const s = stickyCatch(createSticky(), 200, -100);
    const out = stickyRelease(s);
    expect(Math.abs(out.vx)).toBeLessThan(200);
    expect(Math.abs(out.vx)).toBeGreaterThan(0);
    expect(Math.sign(out.vy)).toBe(-1);
  });

  it("倒计时圈从 1 走到 0，没挂住时是 0", () => {
    expect(stickyProgress(createSticky())).toBe(0);
    const s = stickyCatch(createSticky(), 0, 0);
    expect(stickyProgress(s)).toBeCloseTo(1);
    expect(stickyProgress(tickSticky(s, STICKY_HOLD / 2))).toBeCloseTo(0.5, 1);
  });
});

/* ---------------- 弹簧蘑菇 ---------------- */

describe("1.2 弹簧蘑菇", () => {
  it("四个朝向的轴向都是单位向量", () => {
    for (const dir of ["up", "down", "left", "right"] as const) {
      const a = mushroomAxis(dir);
      expect(Math.hypot(a.x, a.y)).toBeCloseTo(1);
    }
  });

  it("从上往下砸在朝上的蘑菇上会被弹回去", () => {
    const out = mushroomBounce(0, 300, "up");
    expect(out.vy).toBeLessThan(0);
  });

  it("弹开速度有下限也有上限，不会越弹越快", () => {
    const soft = mushroomBounce(0, 10, "up");
    expect(Math.abs(soft.vy)).toBeGreaterThanOrEqual(MUSHROOM_MIN_SPEED - 1);
    const hard = mushroomBounce(0, 5000, "up");
    expect(Math.abs(hard.vy)).toBeLessThanOrEqual(MUSHROOM_MAX_SPEED + 1);
  });

  it("斜着撞上去还是斜着飞出来（侧向分量保留一半）", () => {
    const out = mushroomBounce(200, 300, "up");
    expect(out.vx).toBeGreaterThan(0);
    expect(out.vx).toBeLessThan(200);
  });

  it("蹭着蘑菇背面走不触发", () => {
    expect(mushroomTriggers(0, 300, "up")).toBe(true);
    expect(mushroomTriggers(0, -300, "up")).toBe(false);
  });
});

/* ---------------- 糖果残影 ---------------- */

describe("1.2 糖果残影", () => {
  it("残影最多留固定几个点，老的自动挤掉", () => {
    let list = pushGhost([], 0, 0, 0, 3);
    list = pushGhost(list, 1, 1, 0.1, 3);
    list = pushGhost(list, 2, 2, 0.2, 3);
    list = pushGhost(list, 3, 3, 0.3, 3);
    expect(list.length).toBe(3);
    expect(list[0].x).toBe(1);
  });

  it("超过 300 毫秒的残影会被清掉", () => {
    const list = [
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 1, t: 0.25 },
    ];
    const kept = pruneGhosts(list, 0.31);
    expect(kept.length).toBe(1);
    expect(kept[0].t).toBe(0.25);
  });

  it("残影越老越淡，刚好 300 毫秒时是 0", () => {
    const g = { x: 0, y: 0, t: 0 };
    expect(ghostAlpha(g, 0)).toBeGreaterThan(0);
    expect(ghostAlpha(g, GHOST_MS / 2000)).toBeLessThan(ghostAlpha(g, 0));
    expect(ghostAlpha(g, GHOST_MS / 1000)).toBe(0);
  });
});

/* ---------------- 无尽甜甜塔 ---------------- */

describe("1.2 无尽甜甜塔", () => {
  it("同 seed 同颗糖生成的关卡完全一样", () => {
    expect(buildSweetLevel(5, 42)).toEqual(buildSweetLevel(5, 42));
  });

  it("随机数发生器同 seed 同序列", () => {
    const a = makeSwingRng(7);
    const b = makeSwingRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("机关按颗数分批登场，第一颗糖干干净净", () => {
    const first = buildSweetLevel(1, 3);
    expect(first.boards).toBeUndefined();
    expect(first.scissors).toBeUndefined();
    expect(first.gremlins).toBeUndefined();
    expect(buildSweetLevel(SWEET_BOARD_FROM, 3).boards?.length).toBe(1);
    expect(buildSweetLevel(SWEET_SCISSORS_FROM, 3).scissors?.length).toBe(1);
    expect(buildSweetLevel(SWEET_GREMLIN_FROM, 3).gremlins?.length).toBe(1);
  });

  it("星星数随进度涨，封顶 3 颗", () => {
    expect(sweetStarCount(1)).toBe(1);
    expect(sweetStarCount(9)).toBe(3);
    expect(sweetStarCount(99)).toBe(SWEET_STAR_MAX);
  });

  it("每一颗糖都存在一个能吃到的剪断时机（无尽不会卡死在某一颗）", () => {
    for (let i = 1; i <= 12; i++) {
      const lv = buildSweetLevel(i, 1234);
      expect(searchCutTimeFor(lv, 6, 0.1), `第 ${i} 颗糖搜不到解`).not.toBeNull();
    }
  });

  it("越往后的糖果机关越多（难度是涨的）", () => {
    const early = buildSweetLevel(1, 8);
    const late = buildSweetLevel(12, 8);
    const count = (lv: ReturnType<typeof buildSweetLevel>): number =>
      (lv.boards?.length ?? 0) + (lv.scissors?.length ?? 0) + (lv.gremlins?.length ?? 0);
    expect(count(late)).toBeGreaterThan(count(early));
  });

  it("计分：每颗糖 10 分，每颗星再加 2 分，最好成绩取大", () => {
    expect(sweetScore(0, 0)).toBe(0);
    expect(sweetScore(3, 4)).toBe(38);
    expect(sweetScore(-5, -5)).toBe(0);
    expect(bestSweetScore(40, 12)).toBe(40);
    expect(bestSweetScore(40, 55)).toBe(55);
  });
});

/* ---------------- 188 关可解性 ---------------- */

describe("1.2 关卡可解性抽样", () => {
  it("抽样覆盖 ≥30 关并点名 100 / 145 / 188", () => {
    const sample = solvabilitySample();
    expect(sample.length).toBeGreaterThanOrEqual(30);
    expect(sample).toContain(100);
    expect(sample).toContain(145);
    expect(sample).toContain(188);
  });

  it("抽样的每一关都存在通关解", () => {
    const bad: number[] = [];
    for (const id of solvabilitySample()) {
      const lv = LEVELS[id - 1];
      const ok =
        lv.solve.kind === "search"
          ? searchCutTimeFor(lv, lv.solve.tMax) !== null
          : playRecipeFor(lv).ate;
      if (!ok) bad.push(id);
    }
    expect(bad).toEqual([]);
  });

  it("抽样的每一关都摆了星星（三星解的前置条件）", () => {
    for (const id of solvabilitySample()) {
      expect(levelStarCount(LEVELS[id - 1]), `第 ${id} 关没有星星`).toBeGreaterThan(0);
    }
  });

  it("存在三星解：抽样里按配方就能把星星全收的关卡占多数", () => {
    let full = 0;
    let scripted = 0;
    for (const id of solvabilitySample()) {
      const lv = LEVELS[id - 1];
      if (lv.solve.kind === "search") continue;
      scripted++;
      const w = playRecipeFor(lv);
      if (w.ate && w.collected.size === lv.stars.length) full++;
    }
    expect(scripted).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(0);
  });
});

/* ---------------- 老存档迁移 ---------------- */

describe("1.2 两代前缀存档迁移", () => {
  const store = (map: Record<string, string>) => (k: string) => map[k] ?? null;

  it("新 key 没有时读老 key，星星不丢", () => {
    const stars = Array.from({ length: LEVELS.length }, () => 0);
    stars[0] = 3;
    stars[41] = 2;
    const read = store({ [LEGACY_SAVE_KEYS[0]]: JSON.stringify({ stars }) });
    const out = readStars(read);
    expect(out[0]).toBe(3);
    expect(out[41]).toBe(2);
    expect(needsMigration(read)).toBe(true);
  });

  it("新老都有时逐关取大的那个", () => {
    const oldStars = Array.from({ length: LEVELS.length }, () => 0);
    oldStars[0] = 3;
    const newStars = Array.from({ length: LEVELS.length }, () => 0);
    newStars[1] = 2;
    const read = store({
      [SAVE_KEY]: JSON.stringify({ stars: newStars }),
      [LEGACY_SAVE_KEYS[0]]: JSON.stringify({ stars: oldStars }),
    });
    const out = readStars(read);
    expect(out[0]).toBe(3);
    expect(out[1]).toBe(2);
  });

  it("新 key 已经不比老 key 差就不用再搬", () => {
    const stars = Array.from({ length: LEVELS.length }, () => 0);
    stars[0] = 3;
    const read = store({
      [SAVE_KEY]: JSON.stringify({ stars }),
      [LEGACY_SAVE_KEYS[0]]: JSON.stringify({ stars }),
    });
    expect(needsMigration(read)).toBe(false);
  });

  it("坏掉的存档读成空档，不抛异常", () => {
    const read = store({ [SAVE_KEY]: "{{{ 坏掉的 json" });
    expect(() => readStars(read)).not.toThrow();
    expect(readStars(read).every((v) => v === 0)).toBe(true);
  });

  it("星数被写脏也会夹回 0–3", () => {
    const stars = Array.from({ length: LEVELS.length }, () => 0) as unknown[];
    stars[0] = 99;
    stars[1] = -7;
    stars[2] = "三";
    const read = store({ [SAVE_KEY]: JSON.stringify({ stars }) });
    const out = readStars(read);
    expect(out[0]).toBe(3);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });
});
