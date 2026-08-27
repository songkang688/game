// 碰碰砖块 · 1.3 视觉升级用例（只增不减）：
// 配色板 / 图层序 / 果冻砖三层与光斑分支 / 裂纹只读映射与 seed 复现 /
// 挡板回弹判定零改动 / 拖尾双层只读 / 碎片上限与寿命 / 传送门反色 /
// reduced 全停 / destroy 清场 / 玩法数值一个不动。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANDY_DARK_K,
  CANDY_LIT_K,
  candyColors,
  crackPaths,
  hasSpark
} from "../../art/kit/candyBrick";
import { BALL_R, BRICKS, H, KIND, PADDLE_H, PADDLE_Y, W, trailLength } from "./logic";
import {
  BK_LAYER_ORDER,
  BK_PALETTE,
  BK_WALL_PX,
  CAPSULE_SWING_DEG,
  CAPSULE_SWING_MS,
  MAGNET_ARC_LINES,
  MAGNET_ARC_STEP_MS,
  MAX_DEBRIS,
  PADDLE_PRESS_MS,
  PADDLE_PRESS_PX,
  PORTAL_ACCENT_IN,
  PORTAL_ACCENT_OUT,
  PORTAL_PULSE_K,
  PORTAL_PULSE_MS,
  PORTAL_SPIN_MS,
  RIBBON_MIN_COMBO,
  RIBBON_MS,
  SHARDS_PER_BRICK,
  SHARD_LIFE_MS,
  STARS_PER_BRICK,
  capsuleSwingDeg,
  chapterAccent,
  clearDebris,
  crackLevel,
  lampXs,
  magnetArcPhase,
  magnetArcWobble,
  paddlePressOffset,
  pierceOrbitAngle,
  portalInverseColor,
  portalPulseScale,
  portalSpinAngle,
  pushDebris,
  ribbonAlpha,
  spawnBrickDebris,
  stepDebris,
  trailLayers
} from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("配色板与图层序（四·补一）", () => {
  it("八个 token 和规格表一字不差，且都是合法色值", () => {
    expect(BK_PALETTE.bkBgTop).toBe("#FDEFF5");
    expect(BK_PALETTE.bkBgBottom).toBe("#F3E4F0");
    expect(BK_PALETTE.bkWall).toBe("#E0D2E8");
    expect(BK_PALETTE.bkPaddle).toBe("#7FB2F0");
    expect(BK_PALETTE.bkPaddleMagnet).toBe("#8FD98B");
    expect(BK_PALETTE.bkTrailCore).toBe("#FFFFFF");
    expect(BK_PALETTE.bkTrailGlow).toBe("rgba(255,214,120,.4)");
    expect(BK_PALETTE.bkShadow).toBe("rgba(93,74,110,.16)");
    for (const v of Object.values(BK_PALETTE)) {
      expect(v).toMatch(/^#[0-9A-Fa-f]{6}$|^rgba\(\d+,\d+,\d+,\.\d+\)$/);
    }
  });

  it("图层序从背景到 HUD 十层：砖阵在星门下、球在挡板下、碎片在最上层游戏物之上", () => {
    expect([...BK_LAYER_ORDER]).toEqual([
      "bg",
      "walls",
      "bricks",
      "portal",
      "capsules",
      "trail",
      "ball",
      "paddle",
      "debris",
      "hud"
    ]);
  });

  it("index.ts 的 draw 真按图层序落笔（源码顺序断言）", () => {
    const from = SRC.indexOf("paintScene(c2d, accent)");
    expect(from).toBeGreaterThan(0);
    const block = SRC.slice(from, SRC.indexOf("function tick", from));
    const order = ["drawBrick(", "drawPortal(", "drawCapsule(", "drawBallWithTrail(", "drawPaddle(", "paintDebris(", "drawRibbon("];
    let at = 0;
    for (const fn of order) {
      const next = block.indexOf(fn, at);
      expect(next, `${fn} 应当排在上一层之后`).toBeGreaterThan(-1);
      at = next;
    }
  });

  it("砖的三层色值走 candyBrick 的 +28%/-18%（砖排色带沿用关卡 palette，数据不动）", () => {
    expect(CANDY_LIT_K).toBe(0.28);
    expect(CANDY_DARK_K).toBe(0.18);
    const c = candyColors(BRICKS[KIND.NORMAL].color);
    expect(c.body).toBe("#FF9EC8");
    expect(c.lit).toBe("#ffb9d7");
    expect(c.dark).toBe("#d182a4");
  });
});

describe("果冻砖：小屏分支与裂纹（四·补二）", () => {
  it("360px 缩小后砖高 < 10px 光斑省略、亮带保留", () => {
    // 本款砖高恒 18-4=14 有光斑；给 puzzle-tiles 之类的矮砖兜底分支也要在
    expect(hasSpark(14)).toBe(true);
    expect(hasSpark(9)).toBe(false);
  });

  it("裂纹层数只读血量映射：三层砖掉一档 1 层、掉两档 2 层，打不动的恒 0", () => {
    expect(crackLevel(KIND.THREE, KIND.THREE)).toBe(0);
    expect(crackLevel(KIND.THREE, KIND.TWO)).toBe(1);
    expect(crackLevel(KIND.THREE, KIND.NORMAL)).toBe(2);
    expect(crackLevel(KIND.TWO, KIND.NORMAL)).toBe(1);
    expect(crackLevel(KIND.NORMAL, KIND.NORMAL)).toBe(0);
    expect(crackLevel(KIND.STEEL, KIND.STEEL)).toBe(0);
    expect(crackLevel(KIND.PORTAL, KIND.PORTAL)).toBe(0);
  });

  it("换算过程不写血量：BRICKS 注册表在调用前后一个字段没变", () => {
    const before = JSON.stringify(BRICKS);
    crackLevel(KIND.THREE, KIND.NORMAL);
    crackLevel(KIND.TWO, KIND.TWO);
    expect(JSON.stringify(BRICKS)).toBe(before);
  });

  it("裂纹 seed 固定可复现：同 seed 两次路径相等，格子 seed 用 r*31+c", () => {
    expect(crackPaths(3 * 31 + 5, 41, 14, 2)).toEqual(crackPaths(3 * 31 + 5, 41, 14, 2));
    expect(SRC).toContain("r * 31 + c");
  });
});

describe("挡板：下压回弹只影响绘制（四·补三）", () => {
  it("判定值零改动：PADDLE_Y/PADDLE_H/BALL_R 还是 1.2 的数", () => {
    expect(W).toBe(360);
    expect(H).toBe(430);
    expect(PADDLE_Y).toBe(H - 24);
    expect(PADDLE_H).toBe(12);
    expect(BALL_R).toBe(7);
  });

  it("回弹曲线：0ms 压满 2px，80ms 内弹回 0，永不超过 2px", () => {
    expect(PADDLE_PRESS_MS).toBe(80);
    expect(PADDLE_PRESS_PX).toBe(2);
    expect(paddlePressOffset(0, false)).toBeCloseTo(2, 5);
    expect(paddlePressOffset(PADDLE_PRESS_MS, false)).toBe(0);
    expect(paddlePressOffset(10_000, false)).toBe(0);
    for (let t = 0; t <= 80; t += 4) {
      expect(paddlePressOffset(t, false)).toBeLessThanOrEqual(PADDLE_PRESS_PX + 1e-9);
    }
  });

  it("下压只加在绘制的 py 上，判定分支里没有 paddlePressOffset", () => {
    // 绘制里有（drawPaddle 的 py），物理判定里没有
    const drawPart = SRC.slice(SRC.indexOf("function drawPaddle"), SRC.indexOf("function drawBallWithTrail"));
    expect(drawPart).toContain("PADDLE_Y + paddlePressOffset");
    const physicsPart = SRC.slice(SRC.indexOf("function physics"), SRC.indexOf("function draw"));
    expect(physicsPart).not.toContain("paddlePressOffset");
  });

  it("磁铁电弧：90ms 步进换姿势，两条线；reduced 相位恒 0 且 0 相位不抖（常亮直线）", () => {
    expect(MAGNET_ARC_STEP_MS).toBe(90);
    expect(MAGNET_ARC_LINES).toBe(2);
    expect(magnetArcPhase(0, false)).toBe(0);
    expect(magnetArcPhase(89, false)).toBe(0);
    expect(magnetArcPhase(90, false)).toBe(1);
    expect(magnetArcPhase(12_345, true)).toBe(0);
    for (let line = 0; line < 8; line++) expect(magnetArcWobble(0, line)).toBe(0);
    // 非 reduced 的相位真的会抖
    const wobbles = [1, 2, 3].map((p) => magnetArcWobble(p, 1));
    expect(wobbles.some((v) => v !== 0)).toBe(true);
    for (const v of wobbles) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });
});

describe("球与拖尾：双层规格沿用既有速度映射（只读）", () => {
  it("span 恒等于 logic.trailLength(speed)，一格没改", () => {
    for (const sp of [80, 150, 250, 400, 900]) {
      expect(trailLayers(sp, BALL_R).span).toBe(trailLength(sp));
    }
  });

  it("双层几何：外晕永远比芯宽", () => {
    for (const sp of [80, 150, 250, 400]) {
      const l = trailLayers(sp, BALL_R);
      expect(l.glowWidth).toBeGreaterThan(l.coreWidth);
      expect(l.coreWidth).toBeGreaterThan(0);
    }
  });

  it("穿透星屑 2 颗：reduced 静止在固定角，非 reduced 会转", () => {
    expect(pierceOrbitAngle(0, 0, true)).toBe(pierceOrbitAngle(999, 0, true));
    expect(pierceOrbitAngle(100, 0, false)).not.toBe(pierceOrbitAngle(400, 0, false));
    expect(SRC).toContain("PIERCE_ORBIT_STARS");
  });
});

describe("碎砖特效：数量上限与寿命（四·补三）", () => {
  it("每砖 4 片同色方块 + 3 颗星屑，寿命都是 300ms", () => {
    expect(SHARDS_PER_BRICK).toBe(4);
    expect(STARS_PER_BRICK).toBe(3);
    expect(SHARD_LIFE_MS).toBe(300);
    const list = spawnBrickDebris(7, 100, 100, "#FF9EC8", false);
    expect(list).toHaveLength(7);
    expect(list.filter((d) => d.kind === "shard")).toHaveLength(4);
    expect(list.filter((d) => d.kind === "star")).toHaveLength(3);
    for (const d of list) expect(d.lifeMs).toBe(SHARD_LIFE_MS);
    for (const d of list.filter((x) => x.kind === "shard")) expect(d.color).toBe("#FF9EC8");
  });

  it("同 seed 两次生成完全相等；reduced 一片不生成", () => {
    expect(spawnBrickDebris(42, 10, 20, "#FFD26E", false)).toEqual(spawnBrickDebris(42, 10, 20, "#FFD26E", false));
    expect(spawnBrickDebris(42, 10, 20, "#FFD26E", true)).toEqual([]);
  });

  it("寿命推进：300ms 一到全部散尽；四角碎片带旋转抛物线（vy 越走越大、rot 在变）", () => {
    let list = spawnBrickDebris(9, 50, 50, "#9FE08D", false);
    const shard = list.find((d) => d.kind === "shard")!;
    const vy0 = shard.vy;
    const rot0 = shard.rot;
    list = stepDebris(list, 150);
    expect(list.length).toBe(7);
    expect(shard.vy).toBeGreaterThan(vy0);
    expect(shard.rot).not.toBe(rot0);
    list = stepDebris(list, 150);
    expect(list).toHaveLength(0);
  });

  it("同屏总量封顶 MAX_DEBRIS，超出的直接不收", () => {
    let list: ReturnType<typeof spawnBrickDebris> = [];
    for (let i = 0; i < 20; i++) list = pushDebris(list, spawnBrickDebris(i, 0, 0, "#FF9EC8", false));
    expect(list.length).toBeLessThanOrEqual(MAX_DEBRIS);
    expect(list.length).toBe(MAX_DEBRIS);
  });

  it("destroy 清场：clearDebris 当场归零，index.ts 两个 destroy 都接了线", () => {
    const list = spawnBrickDebris(1, 0, 0, "#FF9EC8", false);
    clearDebris(list);
    expect(list).toHaveLength(0);
    expect((SRC.match(/clearDebris\(debris\)/g) ?? []).length).toBe(2);
    expect(SRC).toContain("portalPulse.clear()");
    expect((SRC.match(/cancelAnimationFrame\(raf\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("连击彩带（四·补三）", () => {
  it("连击 >= 5 才闪、只闪 120ms、越到后越淡", () => {
    expect(RIBBON_MIN_COMBO).toBe(5);
    expect(RIBBON_MS).toBe(120);
    expect(ribbonAlpha(0, 4, false)).toBe(0);
    expect(ribbonAlpha(0, 5, false)).toBeGreaterThan(0);
    expect(ribbonAlpha(60, 5, false)).toBeLessThan(ribbonAlpha(10, 5, false));
    expect(ribbonAlpha(RIBBON_MS, 9, false)).toBe(0);
  });
});

describe("传送门：反色双环与涨缩（四·补三）", () => {
  it("进出口亮环互为反色：换算断言 + 反色再反回来", () => {
    expect(PORTAL_ACCENT_OUT).toBe(portalInverseColor(PORTAL_ACCENT_IN));
    expect(portalInverseColor(PORTAL_ACCENT_OUT).toUpperCase()).toBe(PORTAL_ACCENT_IN.toUpperCase());
    // 每个通道加起来正好 255
    const a = parseInt(PORTAL_ACCENT_IN.slice(1), 16);
    const b = parseInt(PORTAL_ACCENT_OUT.slice(1), 16);
    for (const shift of [16, 8, 0]) {
      expect(((a >> shift) & 255) + ((b >> shift) & 255)).toBe(255);
    }
  });

  it("常驻旋转 3200ms/圈 linear，球进出 160ms 涨 8%", () => {
    expect(PORTAL_SPIN_MS).toBe(3200);
    expect(PORTAL_PULSE_MS).toBe(160);
    expect(PORTAL_PULSE_K).toBe(0.08);
    expect(portalSpinAngle(800, false)).toBeCloseTo(Math.PI / 2, 6);
    expect(portalSpinAngle(3200, false)).toBeCloseTo(0, 6);
    expect(portalPulseScale(0, false)).toBeCloseTo(1.08, 6);
    expect(portalPulseScale(PORTAL_PULSE_MS, false)).toBe(1);
  });
});

describe("胶囊与场景", () => {
  it("药丸摆动 ±4°、600ms 正弦周期，摆幅永不出界", () => {
    expect(CAPSULE_SWING_DEG).toBe(4);
    expect(CAPSULE_SWING_MS).toBe(600);
    for (let t = 0; t < 1200; t += 37) {
      expect(Math.abs(capsuleSwingDeg(t, 0.7, false))).toBeLessThanOrEqual(4 + 1e-9);
    }
    expect(Math.abs(capsuleSwingDeg(150, 0, false))).toBeGreaterThan(3);
  });

  it("灯带主题色跟章节走：第 0 关彩虹操场、越界给砖塔色兜底", () => {
    expect(chapterAccent(0)).toBe("#FFE3F1");
    expect(chapterAccent(17)).toBe("#FFF0C9");
    expect(chapterAccent(-1)).toBe("#C9A0F0");
    expect(chapterAccent(99999)).toBe("#C9A0F0");
  });

  it("灯带小圆灯均匀排布在画布宽度里，边墙 3px 纯装饰", () => {
    const xs = lampXs(360);
    expect(xs).toHaveLength(9);
    expect(xs[0]).toBeCloseTo(20, 5);
    expect(xs[8]).toBeCloseTo(340, 5);
    expect(BK_WALL_PX).toBe(3);
    // 物理边界还是 0..W：index.ts 的 stepBall 世界参数没被边墙改
    expect(SRC).toContain("left: 0,");
    expect(SRC).toContain("right: W,");
  });
});

describe("reduced-motion：回弹/电弧/彩带/门旋/摆动/碎片全停，静态层次保留", () => {
  it("六路动效在 reduced 下全部归零或静止", () => {
    expect(paddlePressOffset(10, true)).toBe(0);
    expect(magnetArcPhase(5000, true)).toBe(0);
    expect(magnetArcWobble(magnetArcPhase(5000, true), 3)).toBe(0);
    expect(ribbonAlpha(10, 9, true)).toBe(0);
    expect(portalSpinAngle(1234, true)).toBe(0);
    expect(portalPulseScale(50, true)).toBe(1);
    expect(capsuleSwingDeg(150, 0, true)).toBe(0);
    expect(spawnBrickDebris(3, 0, 0, "#FF9EC8", true)).toEqual([]);
  });

  it("磁铁提示 reduced 不丢：电弧退化成常亮直线而不是消失（源码分支断言）", () => {
    // drawPaddle 里电弧的画线不套 reduced 早退，只有 wobble 归零
    const paddlePart = SRC.slice(SRC.indexOf("function drawPaddle"), SRC.indexOf("function drawBallWithTrail"));
    expect(paddlePart).toContain("magnetArcPhase(nowMs, reduce)");
    expect(paddlePart).toContain("magnetArcWobble");
    expect(paddlePart).not.toMatch(/if\s*\(reduce\)\s*return/);
  });
});

describe("玩法红线：视觉层不碰逻辑", () => {
  it("visual.ts 对 logic 只读：不 import 任何会写状态的函数", () => {
    const visualSrc = readFileSync(fileURLToPath(new URL("./visual.ts", import.meta.url)), "utf8");
    for (const banned of ["damageBrick", "stepBall", "paddleBounce", "towerTick", "grantPower", "launchVelocity"]) {
      expect(visualSrc, `visual.ts 不应引用 ${banned}`).not.toContain(banned);
    }
    expect(visualSrc).not.toContain("document.");
    expect(visualSrc).not.toContain("localStorage");
  });
});
