// 贪吃毛毛虫 · 1.3 视觉用例:配色板 / 时序 / 圆节链 / 九种场景元素自绘 / reduced 降级。
// 只测视觉层;玩法逻辑(logic.ts / snake12.ts)的既有断言一个没动。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAT_HEAD_R_RATIO,
  CAT_MIN_GAP_PX,
  CAT_TAIL_R_RATIO,
  type CatCell,
  chainCenters,
  eyeOffsets,
  linkWidth,
  nodeRadii,
  showAntenna,
} from "../../art/kit/caterpillar";
import { spawnA } from "./logic";
import {
  type Paint2D,
  SS_ANIM,
  SS_COLORS,
  SS_LAYERS,
  SS_SCENE,
  SS_WORM_GREEN,
  SS_WORM_PINK,
  bulgePos,
  createVisualFx,
  doorSwingT,
  moveGlideT,
  paintBoard,
  paintBush,
  paintDoor,
  paintHedgehog,
  paintRock,
  paintSnack,
  paintStar,
  paintSwirl,
  paintTile,
  swirlPhase,
  tileGlowT,
} from "./visual13";

/** index.ts 里的格宽(红线:不许动),测试里当契约值引用 */
const CELL = 26;

const indexSrc = readFileSync("src/games/snake-snack/index.ts", "utf8");
const visualSrc = readFileSync("src/games/snake-snack/visual13.ts", "utf8");

/** 记录式画布桩:数调用、攒 fill/stroke 色与渐变色停 */
function paintStub(): {
  ctx: Paint2D;
  calls: string[];
  fills: unknown[];
  strokes: unknown[];
  stops: string[];
  alpha: () => number;
  count: (n: string) => number;
} {
  const calls: string[] = [];
  const fills: unknown[] = [];
  const strokes: unknown[] = [];
  const stops: string[] = [];
  const grad = () => ({ addColorStop: (_o: number, c: string) => stops.push(c) });
  const obj: Record<string, unknown> = {
    lineWidth: 0,
    lineCap: "",
    globalAlpha: 1,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    quadraticCurveTo: () => calls.push("quadraticCurveTo"),
    arc: () => calls.push("arc"),
    ellipse: () => calls.push("ellipse"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    fillRect: () => calls.push("fillRect"),
    strokeRect: () => calls.push("strokeRect"),
    createRadialGradient: () => {
      calls.push("createRadialGradient");
      return grad();
    },
    createLinearGradient: () => {
      calls.push("createLinearGradient");
      return grad();
    },
  };
  Object.defineProperty(obj, "fillStyle", {
    set: (v) => fills.push(v),
    get: () => fills[fills.length - 1],
  });
  Object.defineProperty(obj, "strokeStyle", {
    set: (v) => strokes.push(v),
    get: () => strokes[strokes.length - 1],
  });
  return {
    ctx: obj as unknown as Paint2D,
    calls,
    fills,
    strokes,
    stops,
    alpha: () => obj.globalAlpha as number,
    count: (n) => calls.filter((c) => c === n).length,
  };
}

/* ------------------------------------------------------------------ */
/* 一、配色板与图层序                                                   */
/* ------------------------------------------------------------------ */

describe("snake-snack 1.3 · 配色板与图层序", () => {
  it("palette token 与规格表逐色一致", () => {
    expect(SS_COLORS.ssBoardA).toBe("#F4F8EC");
    expect(SS_COLORS.ssBoardB).toBe("#EDF3E2");
    expect(SS_COLORS.ssFence).toBe("#C89B6C");
    expect(SS_COLORS.ssBodyA).toBe("#9FD98B");
    expect(SS_COLORS.ssBodyB).toBe("#B8E39B");
    expect(SS_COLORS.ssHead).toBe("#8FCB7A");
    expect(SS_COLORS.ssTile).toBe("#E8D8F0");
    expect(SS_COLORS.ssTileLit).toBe("#FFE9A8");
    expect(SS_COLORS.ssRock).toBe("#B9AFA4");
    expect(SS_COLORS.ssShadow).toBe("rgba(90,110,74,.14)");
  });

  it("全部 token 都是合法色值(#rrggbb 或 rgba)", () => {
    for (const [name, v] of [...Object.entries(SS_COLORS), ...Object.entries(SS_SCENE)]) {
      expect(
        /^#[0-9A-Fa-f]{6}$/.test(v) || /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/.test(v),
        `${name}=${v}`
      ).toBe(true);
    }
  });

  it("图层序从底到顶:棋盘→花砖→地形→旋涡→食物→刺猬→毛毛虫→fx→HUD", () => {
    expect([...SS_LAYERS]).toEqual([
      "board",
      "tiles",
      "terrain",
      "portal",
      "snack",
      "hedgehog",
      "caterpillar",
      "fx",
      "hud",
    ]);
  });

  it("双身位两条虫整套配色不同,一眼可分", () => {
    expect(SS_WORM_GREEN.head).not.toBe(SS_WORM_PINK.head);
    expect(SS_WORM_GREEN.bodyA).not.toBe(SS_WORM_PINK.bodyA);
    expect(SS_WORM_GREEN.bodyB).not.toBe(SS_WORM_PINK.bodyB);
  });

  it("draw 里画笔的出场顺序和图层序一致", () => {
    const body = indexSrc.slice(indexSrc.indexOf("function draw("), indexSrc.indexOf("function mirrorState"));
    const order = [
      "paintBoard(",
      "paintTile(",
      "paintBush(",
      "paintRock(",
      "paintDoor(",
      "paintSwirl(",
      "paintSnack(",
      "paintStar(",
      "paintHedgehog(",
      "drawCaterpillar(",
    ];
    let last = -1;
    for (const name of order) {
      const pos = body.indexOf(name);
      expect(pos, `${name} 不在 draw 里`).toBeGreaterThan(-1);
      expect(pos, `${name} 的图层顺序不对`).toBeGreaterThan(last);
      last = pos;
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、动效时序与 reduced 降级                                          */
/* ------------------------------------------------------------------ */

describe("snake-snack 1.3 · 动效时序与 reduced", () => {
  it("移动插值 80ms 平滑;reduced 关闭回逐格瞬跳", () => {
    expect(SS_ANIM.moveMs).toBe(80);
    expect(moveGlideT(0, false)).toBe(0);
    expect(moveGlideT(40, false)).toBeCloseTo(0.5, 6);
    expect(moveGlideT(120, false)).toBe(1);
    expect(moveGlideT(0, true)).toBe(1);
    expect(moveGlideT(40, true)).toBe(1);
  });

  it("花砖点亮微光 260ms easeOut 渐入;reduced 瞬亮(提示保留)", () => {
    expect(SS_ANIM.tileGlowMs).toBe(260);
    expect(tileGlowT(0, false)).toBe(0);
    expect(tileGlowT(130, false)).toBeCloseTo(0.75, 6);
    expect(tileGlowT(Number.POSITIVE_INFINITY, false)).toBe(1);
    expect(tileGlowT(-1, false)).toBe(0);
    expect(tileGlowT(0, true)).toBe(1);
  });

  it("门旋开 150ms easeOutQuad;reduced 瞬开", () => {
    expect(SS_ANIM.doorMs).toBe(150);
    expect(doorSwingT(75, false)).toBeCloseTo(0.75, 6);
    expect(doorSwingT(150, false)).toBe(1);
    expect(doorSwingT(-1, false)).toBe(0);
    expect(doorSwingT(0, true)).toBe(1);
  });

  it("传送旋涡 2400ms/圈 linear;reduced 静止", () => {
    expect(SS_ANIM.swirlMs).toBe(2400);
    expect(swirlPhase(600, false)).toBeCloseTo(0.25, 6);
    expect(swirlPhase(2400, false)).toBe(0);
    expect(swirlPhase(999999, true)).toBe(0);
  });

  it("鼓包传导两节 × 90ms easeOutQuad;传完与 reduced 都没有波", () => {
    expect(SS_ANIM.bulgeNodeMs).toBe(90);
    expect(SS_ANIM.bulgeNodes).toBe(2);
    expect(bulgePos(0, false)).toBe(0);
    expect(bulgePos(90, false)).toBeCloseTo(1.5, 6);
    expect(bulgePos(180, false)).toBe(-9);
    expect(bulgePos(-1, false)).toBe(-9);
    expect(bulgePos(90, true)).toBe(-9);
  });

  it("吃食张嘴与奖励金闪都是 1 帧,reduced 下也保留(功能反馈)", () => {
    expect(SS_ANIM.biteFrames).toBe(1);
    expect(SS_ANIM.goldFrames).toBe(1);
    const fx = createVisualFx();
    fx.noteEat(1000);
    fx.noteStar();
    expect(fx.biteFrames).toBe(1);
    expect(fx.goldFrames).toBe(1);
    expect(fx.eatAtMs).toBe(1000);
  });

  it("destroy 后插值计时与粒子归零:reset 一个不留", () => {
    const fx = createVisualFx();
    fx.noteEat(500);
    fx.noteStar();
    fx.noteDoorOpen(800);
    fx.noteTileLit(7, 900);
    fx.noteTileLit(8, 950);
    expect(fx.tileLitAt.size).toBe(2);
    fx.reset();
    expect(fx.eatAtMs).toBe(-1);
    expect(fx.biteFrames).toBe(0);
    expect(fx.goldFrames).toBe(0);
    expect(fx.doorOpenAtMs).toBe(-1);
    expect(fx.tileLitAt.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 三、圆节链(玩法状态只读)                                             */
/* ------------------------------------------------------------------ */

describe("snake-snack 1.3 · 圆节毛毛虫", () => {
  it("圆节链节数 = 逻辑蛇长,半径 0.42→0.34 单调递减", () => {
    const cells = spawnA();
    const radii = nodeRadii(cells.length, CELL);
    expect(radii).toHaveLength(cells.length);
    expect(radii[0]).toBeCloseTo(CELL * 0.42, 6);
    expect(radii[radii.length - 1]).toBeCloseTo(CELL * 0.34, 6);
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeLessThanOrEqual(radii[i - 1]);
    expect(CAT_HEAD_R_RATIO).toBe(0.42);
    expect(CAT_TAIL_R_RATIO).toBe(0.34);
  });

  it("直行时相邻节中心距 ≤ CELL(不断链)", () => {
    const cells: CatCell[] = [[6, 5], [5, 5], [4, 5]];
    const prev: CatCell[] = [[5, 5], [4, 5], [3, 5]];
    const pts = chainCenters(cells, prev, CELL, 0.5);
    for (let i = 1; i < pts.length; i++) {
      expect(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])).toBeLessThanOrEqual(CELL + 1e-6);
    }
  });

  it("拐角处相邻节中心距 ≤ CELL(不断链)", () => {
    const cells: CatCell[] = [[5, 5], [4, 5], [4, 4]];
    const prev: CatCell[] = [[4, 5], [4, 4], [4, 3]];
    for (const t of [0.25, 0.5, 0.75]) {
      const pts = chainCenters(cells, prev, CELL, t);
      for (let i = 1; i < pts.length; i++) {
        expect(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])).toBeLessThanOrEqual(CELL + 1e-6);
      }
    }
  });

  it("节间胶囊宽 = 较小节径 × 0.9(换算断言)", () => {
    const radii = nodeRadii(4, CELL);
    expect(linkWidth(radii[0], radii[1])).toBeCloseTo(radii[1] * 2 * 0.9, 6);
    expect(linkWidth(radii[3], radii[2])).toBeCloseTo(radii[3] * 2 * 0.9, 6);
  });

  it("绘制插值不改逻辑格坐标:tick 前后逻辑状态一致", () => {
    const cells: Array<[number, number]> = [[5, 5], [4, 5], [3, 5]];
    const prev: Array<[number, number]> = [[4, 5], [3, 5], [2, 5]];
    const cellsSnap = JSON.stringify(cells);
    const prevSnap = JSON.stringify(prev);
    for (const t of [0, 0.3, 0.7, 1]) chainCenters(cells, prev, CELL, t);
    expect(JSON.stringify(cells)).toBe(cellsSnap);
    expect(JSON.stringify(prev)).toBe(prevSnap);
    // t=1 正好落在当前逻辑格的格心
    const done = chainCenters(cells, prev, CELL, 1);
    expect(done[0]).toEqual([(5 + 0.5) * CELL, (5 + 0.5) * CELL]);
  });

  it("头部眼睛朝向 = 移动方向(四方向映射)", () => {
    const dirs: CatCell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const dir of dirs) {
      const { left, right } = eyeOffsets(dir, CELL * 0.42);
      for (const [ex, ey] of [left, right]) {
        expect(ex * dir[0] + ey * dir[1], `dir=${dir}`).toBeGreaterThan(0);
      }
    }
  });

  it("头径 < 12px 触角省略、眼睛保留;标准盘触角在、节间距 ≥ 1px", () => {
    expect(showAntenna(5.9)).toBe(false);
    expect(showAntenna(6)).toBe(true);
    // 标准盘 CELL=26:头径 21.84 ≥ 12,触角画;相邻节最小空隙 ≥ 1px 不粘连
    const headR = CELL * CAT_HEAD_R_RATIO;
    expect(showAntenna(headR)).toBe(true);
    expect(CELL - headR * 2).toBeGreaterThanOrEqual(CAT_MIN_GAP_PX);
  });
});

/* ------------------------------------------------------------------ */
/* 四、九种场景元素自绘                                                 */
/* ------------------------------------------------------------------ */

describe("snake-snack 1.3 · 场景元素不再 emoji 直出", () => {
  it("九种 emoji 逐种检查:没有一个再走 fillText", () => {
    for (const e of ["🌿", "🌼", "🔐", "🌀", "🚪", "🔒", "🪨", "🦔", "⭐"]) {
      expect(indexSrc.includes(`fillText("${e}"`), `index.ts 里 ${e} 还在 fillText`).toBe(false);
      expect(visualSrc.includes(`fillText("${e}"`), `visual13.ts 里 ${e} 还在 fillText`).toBe(false);
    }
    expect(indexSrc.includes("fillText(snackEmoji")).toBe(false);
    // 整个绘制层一次 fillText 都没有
    expect(indexSrc.includes("fillText(")).toBe(false);
    expect(visualSrc.includes("fillText(")).toBe(false);
  });

  it("视觉层不碰逻辑:visual13.ts 只 import 共享 kit", () => {
    expect(/from\s+"\.\/(logic|levels|snake12)"/.test(visualSrc)).toBe(false);
    expect(visualSrc.includes('from "../../art/kit/caterpillar"')).toBe(true);
  });

  it("棋盘双色格 + 栅栏:整盘格子都画满,双色都用上", () => {
    const s = paintStub();
    paintBoard(s.ctx, 13, CELL);
    expect(s.count("fillRect")).toBe(13 * 13);
    expect(s.fills).toContain(SS_COLORS.ssBoardA);
    expect(s.fills).toContain(SS_COLORS.ssBoardB);
    expect(s.strokes).toContain(SS_COLORS.ssFence);
    expect(s.count("strokeRect")).toBeGreaterThanOrEqual(2);
  });

  it("花砖双态:未踩灰砖、踩过亮砖,点亮时有微光圈", () => {
    const off = paintStub();
    paintTile(off.ctx, 3, 3, CELL, false, 0);
    expect(off.fills).toContain(SS_COLORS.ssTile);
    expect(off.fills).not.toContain(SS_COLORS.ssTileLit);
    const on = paintStub();
    paintTile(on.ctx, 3, 3, CELL, true, 0.8);
    expect(on.fills).toContain(SS_COLORS.ssTileLit);
    expect(on.fills).not.toContain(SS_COLORS.ssTile);
    expect(on.strokes).toContain(SS_SCENE.tileGlow);
    // 没有微光进度时不画光圈
    expect(off.strokes).not.toContain(SS_SCENE.tileGlow);
  });

  it("草丛 / 岩石 / 刺猬都有体积绘制且不抛", () => {
    for (const painter of [paintBush, paintRock, paintHedgehog]) {
      const s = paintStub();
      expect(() => painter(s.ctx, 2, 2, CELL)).not.toThrow();
      expect(s.count("fill")).toBeGreaterThan(2);
    }
    // 岩石要有亮顶面与暗侧面两阶
    const rock = paintStub();
    paintRock(rock.ctx, 1, 1, CELL);
    expect(rock.fills).toContain(SS_COLORS.ssRock);
    expect(new Set(rock.fills).size).toBeGreaterThanOrEqual(3);
  });

  it("门:关着挂金锁牌,旋开后门板收窄、绕圈门洞里有小花路标", () => {
    const closed = paintStub();
    paintDoor(closed.ctx, 4, 4, CELL, false, 0, true);
    expect(closed.stops).toContain(SS_SCENE.lockGold);
    const open = paintStub();
    paintDoor(open.ctx, 4, 4, CELL, true, 1, true);
    expect(open.stops).not.toContain(SS_SCENE.lockGold);
    expect(open.fills).toContain("#FFC85C");
    expect(open.calls.join(",")).not.toBe(closed.calls.join(","));
  });

  it("旋涡双色两臂,相位变了画面就变(reduced 相位恒 0 即静止)", () => {
    const a = paintStub();
    paintSwirl(a.ctx, 5, 5, CELL, 0);
    expect(a.strokes).toContain(SS_SCENE.swirlA);
    expect(a.strokes).toContain(SS_SCENE.swirlB);
    const b = paintStub();
    paintSwirl(b.ctx, 5, 5, CELL, 0.4);
    expect(a.count("lineTo")).toBe(b.count("lineTo"));
    expect(a.count("stroke")).toBeGreaterThanOrEqual(2);
  });

  it("七种点心 + 兜底全部矢量绘制,画完 alpha 回 1", () => {
    for (const kind of ["🍓", "🍎", "🍇", "🍪", "🧁", "✂️", "⭐", "❓"]) {
      const s = paintStub();
      expect(() => paintSnack(s.ctx, 6, 6, CELL, kind, 0.8)).not.toThrow();
      expect(s.count("fill"), `${kind} 没画出东西`).toBeGreaterThan(0);
      expect(s.alpha(), `${kind} 画完没把 alpha 收回 1`).toBe(1);
    }
  });

  it("奖励五角星:光晕径向渐变 + 十点星形 + 高光", () => {
    const s = paintStub();
    paintStar(s.ctx, 7, 7, CELL, true, 1);
    expect(s.count("createRadialGradient")).toBeGreaterThanOrEqual(2);
    // 星形轮廓 10 个顶点:1 moveTo + 9 lineTo
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(9);
    expect(s.stops).toContain("#FFD86B");
  });
});
