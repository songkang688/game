import { describe, expect, it } from "vitest";
import {
  EAT_RATIO,
  MAX_CELLS,
  MIN_MASS,
  MIN_SPLIT_MASS,
  SPIT_MASS,
  VIRUS_FEED_LIMIT,
  VIRUS_MASS,
  canEat,
  canMerge,
  clampToMap,
  decayMass,
  eatVirus,
  ejectSpore,
  feedVirus,
  isSpent,
  leaderboard,
  massToRadius,
  massToSpeed,
  mergeCells,
  mergeDelaySec,
  rankOf,
  runLine,
  shrinkZone,
  splitCell,
  totalMass,
  zoneDrain,
  type Cell,
  type Spore,
  type Virus
} from "./logic";

function cell(over: Partial<Cell> = {}): Cell {
  return { id: "c1", owner: "me", mass: 40, x: 100, y: 100, vx: 0, vy: 0, bornAt: 0, ...over };
}

describe("质量、半径与速度", () => {
  it("质量越大半径越大", () => {
    expect(massToRadius(100)).toBeGreaterThan(massToRadius(25));
    expect(massToRadius(0)).toBe(0);
  });

  it("负质量与脏值不会算出 NaN", () => {
    expect(massToRadius(-5)).toBe(0);
    expect(Number.isFinite(massToRadius(Number.NaN))).toBe(true);
  });

  it("越大越慢,小圆永远追得上大圆", () => {
    expect(massToSpeed(20)).toBeGreaterThan(massToSpeed(200));
    expect(massToSpeed(2000)).toBeGreaterThan(0);
  });
});

describe("吞噬判定", () => {
  it("质量比不够就吃不掉,哪怕压在正中间", () => {
    const a = cell({ id: "a", owner: "a", mass: 50 });
    const b = cell({ id: "b", owner: "b", mass: 45, x: 100, y: 100 });
    expect(a.mass / b.mass).toBeLessThan(EAT_RATIO);
    expect(canEat(a, b)).toBe(false);
  });

  it("质量够、也压得够深才吃得到", () => {
    const a = cell({ id: "a", owner: "a", mass: 100 });
    const near = cell({ id: "b", owner: "b", mass: 20, x: 100, y: 100 });
    const far = cell({ id: "b2", owner: "b", mass: 20, x: 400, y: 100 });
    expect(canEat(a, near)).toBe(true);
    expect(canEat(a, far)).toBe(false);
  });

  it("自己吃不了自己", () => {
    const a = cell();
    expect(canEat(a, a)).toBe(false);
  });

  it("同一个人的两个分身没到合并窗口不能互吞", () => {
    const a = cell({ id: "a", owner: "me", mass: 200, bornAt: 0 });
    const b = cell({ id: "b", owner: "me", mass: 20, x: 100, y: 100, bornAt: 0 });
    expect(canEat(a, b, 1)).toBe(false);
    expect(canEat(a, b, 999)).toBe(true);
  });
});

describe("分身", () => {
  it("对半分,新的那半朝准星弹出去", () => {
    const out = splitCell(cell({ mass: 80 }), { x: 300, y: 100 }, 1, 0);
    expect(out.length).toBe(2);
    expect(out[0].mass).toBe(40);
    expect(out[1].mass).toBe(40);
    expect(out[1].x).toBeGreaterThan(out[0].x);
    expect(out[1].vx).toBeGreaterThan(0);
  });

  it("两半会小于下限时忽略这次输入", () => {
    const small = cell({ mass: MIN_SPLIT_MASS * 2 - 2 });
    expect(splitCell(small, { x: 200, y: 100 }, 1, 0).length).toBe(1);
  });

  it("已经 16 个分身就分不动了", () => {
    const out = splitCell(cell({ mass: 200 }), { x: 200, y: 100 }, MAX_CELLS, 0);
    expect(out.length).toBe(1);
    expect(MAX_CELLS).toBe(16);
  });

  it("准星和自己重合时也不会算出 NaN", () => {
    const out = splitCell(cell({ mass: 80 }), { x: 100, y: 100 }, 1, 0);
    expect(Number.isFinite(out[1].x)).toBe(true);
    expect(Number.isFinite(out[1].vy)).toBe(true);
  });
});

describe("合并", () => {
  it("质量越大等得越久,但不超过上限", () => {
    expect(mergeDelaySec(20)).toBeLessThan(mergeDelaySec(400));
    expect(mergeDelaySec(100000)).toBeLessThanOrEqual(30);
  });

  it("到时间才能合", () => {
    const c = cell({ bornAt: 10, mass: 40 });
    expect(canMerge(c, 12)).toBe(false);
    expect(canMerge(c, 10 + mergeDelaySec(40))).toBe(true);
  });

  it("合并后质量相加,位置往大的那半靠", () => {
    const a = cell({ id: "a", mass: 90, x: 0, y: 0 });
    const b = cell({ id: "b", mass: 10, x: 100, y: 0 });
    const m = mergeCells(a, b);
    expect(m.mass).toBe(100);
    expect(m.x).toBeCloseTo(10, 6);
  });
});

describe("孢子与刺球", () => {
  it("体格不够吐不出孢子", () => {
    expect(ejectSpore(cell({ mass: 12 }), { x: 200, y: 100 })).toBeNull();
  });

  it("吐一颗就从本体扣质量", () => {
    const out = ejectSpore(cell({ mass: 60 }), { x: 200, y: 100 });
    expect(out).not.toBeNull();
    expect(out!.cell.mass).toBe(60 - SPIT_MASS);
    expect(out!.spore.mass).toBe(SPIT_MASS);
  });

  it("比刺球轻:什么都不会发生,不会一下退场", () => {
    const v: Virus = { id: "v", x: 100, y: 100, mass: VIRUS_MASS, fed: 0 };
    const res = eatVirus(cell({ mass: 30 }), v, 1, 0);
    expect(res.popped).toBe(false);
    expect(res.cells.length).toBe(1);
    expect(res.cells[0].mass).toBe(30);
  });

  it("比刺球重:散成一堆小圆,总质量不丢", () => {
    const v: Virus = { id: "v", x: 100, y: 100, mass: VIRUS_MASS, fed: 0 };
    const res = eatVirus(cell({ mass: 200 }), v, 1, 0);
    expect(res.popped).toBe(true);
    expect(res.cells.length).toBeGreaterThan(1);
    const sum = res.cells.reduce((s, c) => s + c.mass, 0);
    expect(sum).toBeCloseTo(200 + VIRUS_MASS, 6);
  });

  it("已经 16 个分身时散不开,只是把质量加上去", () => {
    const v: Virus = { id: "v", x: 100, y: 100, mass: VIRUS_MASS, fed: 0 };
    const res = eatVirus(cell({ mass: 200 }), v, MAX_CELLS, 0);
    expect(res.popped).toBe(false);
    expect(res.cells.length).toBe(1);
    expect(res.cells[0].mass).toBe(200 + VIRUS_MASS);
  });

  it("散开的份数不会把总数顶破 16", () => {
    const v: Virus = { id: "v", x: 100, y: 100, mass: VIRUS_MASS, fed: 0 };
    const res = eatVirus(cell({ mass: 900 }), v, 10, 0);
    expect(res.cells.length).toBeLessThanOrEqual(MAX_CELLS - 10 + 1);
  });

  it("喂孢子:没喂够只是变重变位置", () => {
    const v: Virus = { id: "v", x: 100, y: 100, mass: VIRUS_MASS, fed: 0 };
    const s: Spore = { id: "s", owner: "me", x: 90, y: 100, vx: 300, vy: 0, mass: SPIT_MASS };
    const out = feedVirus(v, s);
    expect(out.spawned).toBeNull();
    expect(out.virus.mass).toBeGreaterThan(VIRUS_MASS);
    expect(out.virus.x).toBeGreaterThan(100);
  });

  it("喂够了就朝被喂的方向弹出一颗新刺球", () => {
    let v: Virus = { id: "v", x: 100, y: 100, mass: VIRUS_MASS, fed: VIRUS_FEED_LIMIT - 1 };
    const s: Spore = { id: "s", owner: "me", x: 100, y: 90, vx: 0, vy: 400, mass: SPIT_MASS };
    const out = feedVirus(v, s);
    v = out.virus;
    expect(out.spawned).not.toBeNull();
    expect(out.spawned!.y).toBeGreaterThan(100);
    expect(v.fed).toBe(0);
    expect(v.mass).toBe(VIRUS_MASS);
  });
});

describe("衰减、边界与缩圈", () => {
  it("小圆不掉质量", () => {
    expect(decayMass(50, 1)).toBe(50);
  });

  it("大圆会慢慢掉,但掉不穿门槛", () => {
    expect(decayMass(400, 1)).toBeLessThan(400);
    expect(decayMass(91, 1000)).toBeGreaterThanOrEqual(90);
  });

  it("身子不许出界", () => {
    const c = clampToMap(cell({ mass: 100, x: -50, y: 5000 }), 1000, 1000);
    const r = massToRadius(100);
    expect(c.x).toBeCloseTo(r, 6);
    expect(c.y).toBeCloseTo(1000 - r, 6);
  });

  it("安全区只会越收越小,收不到 0", () => {
    const z = shrinkZone({ cx: 0, cy: 0, radius: 500 }, 1, 100);
    expect(z.radius).toBe(400);
    expect(shrinkZone(z, 100, 100).radius).toBeGreaterThan(0);
  });

  it("圈外掉质量,圈里不掉", () => {
    const zone = { cx: 0, cy: 0, radius: 100 };
    expect(zoneDrain(cell({ x: 10, y: 10, mass: 50 }), zone, 1)).toBe(50);
    expect(zoneDrain(cell({ x: 500, y: 0, mass: 50 }), zone, 1)).toBeLessThan(50);
    expect(zoneDrain(cell({ mass: 50 }), null, 1)).toBe(50);
  });

  it("掉到下限就该先去休息", () => {
    expect(isSpent(MIN_MASS - 0.1)).toBe(true);
    expect(isSpent(MIN_MASS + 1)).toBe(false);
  });
});

describe("排行榜", () => {
  const cells: Cell[] = [
    cell({ id: "1", owner: "me", mass: 50 }),
    cell({ id: "2", owner: "me", mass: 30 }),
    cell({ id: "3", owner: "bot0", mass: 90 }),
    cell({ id: "4", owner: "bot1", mass: 70 })
  ];
  const names = { me: "鸭梨", bot0: "糯糯", bot1: "云云" };

  it("按总质量排,自家分身要合起来算", () => {
    const rows = leaderboard(cells, names);
    expect(rows[0].id).toBe("bot0");
    expect(rows[1].id).toBe("me");
    expect(rows[1].mass).toBe(80);
  });

  it("同质量按 id 稳定排,不会跳来跳去", () => {
    const tie: Cell[] = [cell({ id: "x", owner: "b", mass: 10 }), cell({ id: "y", owner: "a", mass: 10 })];
    const rows = leaderboard(tie, { a: "阿", b: "币" });
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(leaderboard(tie, { a: "阿", b: "币" }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("能报出自己第几名,不在场上就是 0", () => {
    expect(rankOf(cells, names, "me")).toBe(2);
    expect(rankOf(cells, names, "nobody")).toBe(0);
  });

  it("总质量统计只算自己的圆", () => {
    expect(totalMass(cells, "me")).toBe(80);
    expect(totalMass(cells, "bot1")).toBe(70);
  });

  it("战报只鼓励,不说死亡也不批评", () => {
    const lines = [runLine(true, 1, 300), runLine(false, 7, 40)].join("|");
    expect(lines).not.toMatch(/死|输了|笨|淘汰出局/);
    expect(runLine(false, 7, 40)).toContain("休息");
  });
});
