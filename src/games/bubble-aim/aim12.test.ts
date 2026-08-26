// 泡泡瞄准手 · 1.2 手感层单测:预览线、角度微调、真掉落、连锁分、换弹与炸弹、无尽墙。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  H,
  RAINBOW,
  STONE,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  descend,
  findFloating,
  parseLayout,
  settleShot,
  simulateShot,
  type Grid,
} from "./logic";
import { LEVELS } from "./levels";
import {
  BOMB,
  COARSE_STEP_DEG,
  ENDLESS_PUSH_EVERY,
  FINE_STEP_DEG,
  MAX_AIM_DEG,
  MIN_AIM_DEG,
  PREVIEW_MAX_LEN,
  SHOOTER_X,
  SHOOTER_Y,
  aimAngleDeg,
  aimFromDrag,
  aimVector,
  ammoIsUseful,
  angleStepDeg,
  bombTargets,
  chainFontSize,
  chainLabel,
  chainScore,
  detonate,
  endlessLine,
  endlessRow,
  endlessShouldPush,
  endlessStartRows,
  endlessTotal,
  fallGravity,
  fallPath,
  fallenOut,
  fallersFor,
  fixDeadAmmo,
  isBomb,
  lowestRow,
  makeFaller,
  pathLength,
  pickAmmo,
  previewPath,
  reload,
  snapAimAngle,
  stepFaller,
  stoneNeedsDrop,
  swapLoader,
} from "./aim12";

/** 固定序列的假随机,单测要的是可复现 */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("bubble-aim 1.2 · 瞄准线预览", () => {
  it("直线弹道被剪到限定长度,不把落点白送给你", () => {
    const g = parseLayout(["RRRRRRRRR", "BBBBBBBB"]);
    const full = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1);
    const preview = previewPath(full.path);
    expect(pathLength(preview)).toBeLessThanOrEqual(PREVIEW_MAX_LEN + 1e-6);
    expect(pathLength(preview)).toBeLessThan(pathLength(full.path) + 1e-6);
  });

  it("最多带一次反射,第二次反弹之后的不画", () => {
    const g = parseLayout(["RRRRRRRRR"]);
    const full = simulateShot(g, SHOOTER_X, SHOOTER_Y, -1, -0.25);
    const preview = previewPath(full.path, 1, 10_000);
    expect(preview.length).toBeLessThanOrEqual(3);
    expect(preview[0]).toEqual({ x: full.path[0].x, y: full.path[0].y });
  });

  it("预览起点永远是发射台,空弹道不会炸", () => {
    expect(previewPath([])).toEqual([]);
    const one = previewPath([{ x: 10, y: 20 }]);
    expect(one).toEqual([{ x: 10, y: 20 }]);
  });
});

describe("bubble-aim 1.2 · 角度与微调", () => {
  it("只能往上瞄,指到发射台下面不算数", () => {
    expect(aimAngleDeg(SHOOTER_X, SHOOTER_Y, SHOOTER_X, SHOOTER_Y + 30)).toBeNull();
    expect(aimAngleDeg(SHOOTER_X, SHOOTER_Y, SHOOTER_X, 20)).toBeCloseTo(90, 6);
  });

  it("太贴地的角度被夹在 8 到 172 度之间", () => {
    expect(aimAngleDeg(SHOOTER_X, SHOOTER_Y, SHOOTER_X + 400, SHOOTER_Y - 25)).toBe(MIN_AIM_DEG);
    expect(aimAngleDeg(SHOOTER_X, SHOOTER_Y, SHOOTER_X - 400, SHOOTER_Y - 25)).toBe(MAX_AIM_DEG);
  });

  it("拖得越远角度越精细:近处 3 度一格,远处 0.25 度一格", () => {
    expect(angleStepDeg(20)).toBe(COARSE_STEP_DEG);
    expect(angleStepDeg(150)).toBeLessThan(COARSE_STEP_DEG);
    expect(angleStepDeg(400)).toBe(FINE_STEP_DEG);
    expect(angleStepDeg(150)).toBeGreaterThan(FINE_STEP_DEG);
  });

  it("角度按当前精度吸附,远端 1px 抖动不再让弹道乱飞", () => {
    expect(snapAimAngle(91.4, 20)).toBeCloseTo(90, 6);
    expect(snapAimAngle(91.4, 400)).toBeCloseTo(91.5, 6);
    expect(snapAimAngle(200, 400)).toBe(MAX_AIM_DEG);
  });

  it("角度换成方向向量:90 度就是笔直朝上", () => {
    const v = aimVector(90);
    expect(v.dx).toBeCloseTo(0, 6);
    expect(v.dy).toBeCloseTo(-1, 6);
    const drag = aimFromDrag(SHOOTER_X, SHOOTER_Y, SHOOTER_X + 100, SHOOTER_Y - 100);
    expect(drag).not.toBeNull();
    expect(drag?.dy).toBeLessThan(0);
    expect(aimFromDrag(SHOOTER_X, SHOOTER_Y, SHOOTER_X, SHOOTER_Y + 5)).toBeNull();
  });
});

describe("bubble-aim 1.2 · 掉落物理", () => {
  it("失联的泡泡真的往下掉,而且一路经过中间位置", () => {
    const f = makeFaller(100, 100, "R", 1);
    const path = fallPath(f, 1 / 60);
    expect(path.length).toBeGreaterThan(6);
    const mid = path[Math.floor(path.length / 2)];
    expect(mid.y).toBeGreaterThan(100);
    expect(mid.y).toBeLessThan(H + 40);
    expect(path[path.length - 1].y).toBeGreaterThan(H);
  });

  it("掉落是加速的,后面每一帧比前面掉得多", () => {
    let f = makeFaller(100, 100, "R", 2);
    const drops: number[] = [];
    for (let i = 0; i < 30; i++) {
      const before = f.y;
      f = stepFaller(f, 1 / 60);
      drops.push(f.y - before);
    }
    expect(drops[25]).toBeGreaterThan(drops[10]);
    expect(fallenOut({ ...f, y: H + 100 })).toBe(true);
  });

  it("关掉动效只是掉得快,仍然一帧一帧掉过中间位置", () => {
    expect(fallGravity(true)).toBeGreaterThan(fallGravity(false));
    const quick = fallPath(makeFaller(100, 100, "R", 3), 1 / 60, H, 600);
    expect(quick.length).toBeGreaterThan(2);
  });

  it("同一批掉落会轻轻散开,不会叠成一条线", () => {
    const g = parseLayout(["RRRRRRRRR"]);
    const cells = [
      { r: 0, c: 1, color: "R" },
      { r: 0, c: 2, color: "R" },
      { r: 0, c: 3, color: "R" },
    ];
    const fallers = fallersFor(g, cells);
    expect(fallers).toHaveLength(3);
    expect(new Set(fallers.map((f) => Math.round(f.vx))).size).toBeGreaterThan(1);
    expect(fallers[0].x).toBeCloseTo(cellCenter(g, 0, 1).x, 6);
  });

  it("三消之后失联的那一群会被真的列成掉落清单,不是凭空消失", () => {
    // 顶行三颗 R 撑着,下面挂着一颗 B;把 R 消掉,B 就该真的掉下去
    const g = parseLayout(["RRR......", "B.......", "........."]);
    const before = countBubbles(g);
    const settle = settleShot(g, 0, 1);
    expect(settle.popped.length).toBeGreaterThanOrEqual(3);
    expect(settle.dropped.length).toBeGreaterThan(0);
    expect(countBubbles(g)).toBeLessThan(before);
    expect(findFloating(g)).toEqual([]);
  });
});

describe("bubble-aim 1.2 · 连锁分", () => {
  it("掉下去的比消掉的值钱,链越长加成越高", () => {
    expect(chainScore(3, 0, 1)).toBe(30);
    expect(chainScore(3, 3, 1)).toBe(90);
    expect(chainScore(3, 3, 3)).toBeGreaterThan(chainScore(3, 3, 1));
  });

  it("飘字随链长变热闹,没掉东西就不吭声", () => {
    expect(chainLabel(0, 1)).toBe("");
    expect(chainLabel(2, 1)).toContain("2");
    expect(chainLabel(5, 3)).toContain("连锁");
    expect(chainFontSize(1)).toBe(14);
    expect(chainFontSize(4)).toBeGreaterThan(chainFontSize(1));
    expect(chainFontSize(20)).toBeLessThanOrEqual(30);
  });
});

describe("bubble-aim 1.2 · 发射器与特殊泡", () => {
  it("换弹就是当前和下一颗对调", () => {
    expect(swapLoader({ current: "R", next: "B" })).toEqual({ current: "B", next: "R" });
  });

  it("普通颜色只从墙上还有的颜色里出,不会发死球", () => {
    const g = parseLayout(["RR.RR.RR.", "........"]);
    const pool = colorsInGrid(g);
    expect(pool).toEqual(["R"]);
    for (let i = 0; i < 20; i++) {
      const ammo = pickAmmo(pool, seq([0.9, i / 20]));
      expect(ammo).toBe("R");
    }
  });

  it("墙上一颗普通泡都没有时发彩虹,不会卡死", () => {
    expect(pickAmmo([], seq([0.9, 0.5]))).toBe(RAINBOW);
  });

  it("按概率出炸弹泡与彩虹泡", () => {
    expect(pickAmmo(["R"], seq([0.01]), { bomb: 0.05, rainbow: 0.05 })).toBe(BOMB);
    expect(pickAmmo(["R"], seq([0.07]), { bomb: 0.05, rainbow: 0.05 })).toBe(RAINBOW);
    expect(pickAmmo(["R"], seq([0.9, 0]), { bomb: 0.05, rainbow: 0.05 })).toBe("R");
    expect(isBomb(BOMB)).toBe(true);
    expect(isBomb("R")).toBe(false);
  });

  it("上膛把下一颗顶上来,配不上的颜色会被换掉", () => {
    const g = parseLayout(["BB.BB.BB.", "........"]);
    const after = reload({ current: "R", next: "B" }, g, seq([0.9, 0]));
    expect(after.current).toBe("B");
    const fixed = fixDeadAmmo({ current: "R", next: "G" }, g, seq([0.9, 0]));
    expect(fixed.current).toBe("B");
    expect(fixed.next).toBe("B");
    expect(ammoIsUseful(RAINBOW, [])).toBe(true);
    expect(ammoIsUseful("R", ["B"])).toBe(false);
  });

  it("炸弹泡清掉落点这一圈,连石泡一起炸", () => {
    const g = parseLayout(["RRRRRRRRR", "RSRRRRRR", "RRRRRRRRR"]);
    const targets = bombTargets(g, 1, 1);
    expect(targets.length).toBeGreaterThanOrEqual(5);
    const before = countBubbles(g);
    const res = detonate(g, 1, 1);
    expect(res.popped.length).toBe(targets.length);
    expect(res.popped.some((p) => p.color === STONE)).toBe(true);
    expect(countBubbles(g)).toBeLessThan(before);
  });

  it("炸完之后失联的泡泡也跟着掉", () => {
    const g = parseLayout(["..RRR....", "..BB....", "..G......"]);
    const res = detonate(g, 0, 3);
    expect(res.popped.length).toBe(5);
    expect(res.dropped.some((d) => d.color === "G")).toBe(true);
    expect(findFloating(g)).toEqual([]);
  });

  it("石泡不参与同色消,只能靠掉落或炸弹清掉", () => {
    expect(stoneNeedsDrop(STONE)).toBe(true);
    expect(stoneNeedsDrop("R")).toBe(false);
  });
});

describe("bubble-aim 1.2 · 无尽墙", () => {
  it("每 5 发下压一行", () => {
    expect(ENDLESS_PUSH_EVERY).toBe(5);
    expect(endlessShouldPush(0)).toBe(false);
    expect(endlessShouldPush(5)).toBe(true);
    expect(endlessShouldPush(7)).toBe(false);
    expect(endlessShouldPush(10)).toBe(true);
  });

  it("下压进来的行长度对得上翻转后的顶行,而且越往后越密", () => {
    const g = parseLayout(["RRRRRRRRR"]);
    const row = endlessRow(g, ["R", "B"], seq([0.1, 0.2]), 0);
    expect(row.length).toBe(8);
    descend(g, row);
    expect(g.rows[0]).toHaveLength(8);
    const dense = endlessRow(g, ["R"], seq([0.99]), 0);
    expect(dense).toContain(".");
  });

  it("开局铺的几行长短交替,颜色只用给定的调色板", () => {
    const rows = endlessStartRows(["R", "B"], seq([0.1, 0.2, 0.6, 0.4]), 4);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveLength(9);
    expect(rows[1]).toHaveLength(8);
    const g: Grid = parseLayout(rows);
    for (const ch of rows.join("")) expect([".", "R", "B"]).toContain(ch);
    expect(lowestRow(g)).toBeGreaterThanOrEqual(0);
  });

  it("成绩把撑住的行数也算进去,结算只鼓励", () => {
    expect(endlessTotal(100, 4)).toBe(200);
    expect(endlessLine(300, 200)).toContain("新纪录");
    expect(endlessLine(100, 200)).toContain("再来一次");
    expect(/输|笨|真差/.test(endlessLine(10, 200))).toBe(false);
  });

  it("空网格的最低行是 -1,不会越界", () => {
    const empty = parseLayout([".........", "........"]);
    expect(lowestRow(empty)).toBe(-1);
  });
});

describe("bubble-aim 1.2 · 188 关与清理", () => {
  it("188 关的关卡数据一关都没少", () => {
    expect(LEVELS.length).toBe(188);
  });

  it("抽样几关照样打得响:瞄准线算得出落点", () => {
    for (const n of [1, 50, 99, 145, 188]) {
      const g = parseLayout(LEVELS[n - 1].layout);
      const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1);
      expect(res.path.length).toBeGreaterThan(1);
      expect(previewPath(res.path).length).toBeGreaterThan(1);
    }
  });

  it("发射台位置和画面尺寸对得上", () => {
    expect(SHOOTER_X).toBe(W / 2);
    expect(SHOOTER_Y).toBeLessThan(H);
  });

  it("destroy 里把 rAF 和指针监听都收干净了", () => {
    const src = readFileSync("src/games/bubble-aim/index.ts", "utf8");
    expect(src).toContain("cancelAnimationFrame");
    expect(src).toContain('removeEventListener("pointerdown"');
    expect(src).toContain('removeEventListener("pointerup"');
  });
});
