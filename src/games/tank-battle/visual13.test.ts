/**
 * 1.3 视觉升级 · 视觉用例(只增不减)。
 *
 * 盯四件事:
 *   1. 配色板与动效时序常量和规格表一字不差 —— 谁顺手改个数立刻红;
 *   2. 履带里程 / 闪光帧这套渲染账本的行为:前进加、倒溜减、reduced 冻结、
 *      受击白闪与炮口闪光(功能反馈)在 reduced 下保留;
 *   3. 徽章 / 零件 / 盾牌全是自绘矢量:canvas 通道零 fillText,emoji 素材彻底下岗;
 *   4. 玩法数值一个没动:recoilPixels 快照、REBUILD/SCATTER 秒数、GRASS_ALPHA、TANK_HALF。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SIDE_RATIO } from "../../art/kit/block25d";
import { shade } from "../../art/kit/palette";
import { AI_TIERS } from "./ai12";
import { FakeCtx, findOne, install, type Harness } from "./domStub";
import {
  IDLE_INPUT,
  MUZZLE_WINDUP,
  REBUILD_SECONDS,
  SCATTER_SECONDS,
  TANK_HALF,
  recoilPixels,
  type Tank,
  type World,
} from "./logic";
import { GRASS_ALPHA } from "./terrain12";
import {
  ARMOR_BADGE_PX,
  HIT_FLASH_FRAMES,
  ICE_SHEEN_MS,
  KIND_BADGE,
  MUZZLE_FLASH_FRAMES,
  MUZZLE_FLASH_FRAMES_REDUCED,
  PART_KINDS,
  REBUILD_RING_MS,
  SHADOW_PX,
  TANK_SIDE_RATIO,
  TK_COLORS,
  TRACK_STEP_MS,
  TRACK_TOOTH_GAP,
  TRACK_TOOTH_H,
  TankFx,
  WATER_WAVE_MS,
  cellBlock,
  drawBadge,
  drawBoltBadge,
  drawFlowerBadge,
  drawFxCrumb,
  drawFxFlower,
  drawFxSmoke,
  drawFxSparkle,
  drawGearBadge,
  drawHexRing,
  drawMuzzleFlash,
  drawPart,
  drawRivetBadge,
  drawShieldBadge,
  drawStarBadge,
  iceSheenPos,
  rebuildProgress,
  ringAngle,
  trackPhase,
  trackToothOffset,
  waterFrame,
} from "./visual13";

/** 一辆凑数的铁皮车桩:TankFx 只读位置/朝向/护甲/前摇,其余字段随便填 */
function makeTank(over: Partial<Tank> = {}): Tank {
  return {
    id: 1,
    side: "enemy",
    kind: "armor",
    player: -1,
    x: 4,
    y: 4,
    dir: 0,
    speed: 2,
    cool: 0,
    coolMax: 1,
    bulletSpeed: 6,
    armor: 2,
    armorMax: 2,
    shield: 0,
    spin: 0,
    scatterX: 4,
    scatterY: 4,
    shell: "plain",
    tilt: 1,
    windup: 0,
    windupShell: "plain",
    recoil: 0,
    glide: 0,
    glideDir: 0,
    bricks: 0,
    shots: 0,
    maxShots: 1,
    aiTimer: 0,
    aiDir: -1,
    aiFire: false,
    tier: AI_TIERS[0],
    goal: "base",
    goalTimer: 0,
    stuck: 0,
    moved: false,
    ...over,
  };
}

function worldWith(tanks: Tank[]): World {
  return { tanks } as unknown as World;
}

const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

/** 记录每一笔坐标的桩:验证「全画在盒子里」 */
class BoxCtx extends FakeCtx {
  xs: number[] = [];
  ys: number[] = [];
  override moveTo(x?: number, y?: number): void {
    if (typeof x === "number" && typeof y === "number") {
      this.xs.push(x);
      this.ys.push(y);
    }
  }
  override arcTo(x1?: number, y1?: number, x2?: number, y2?: number): void {
    if (typeof x1 === "number" && typeof y1 === "number") {
      this.xs.push(x1);
      this.ys.push(y1);
    }
    if (typeof x2 === "number" && typeof y2 === "number") {
      this.xs.push(x2);
      this.ys.push(y2);
    }
  }
}

/** 记录调用序列的桩:验证「花和星画的不是同一套路径」 */
class OpCtx extends FakeCtx {
  ops: string[] = [];
  override beginPath(): void {
    this.ops.push("beginPath");
  }
  override closePath(): void {
    this.ops.push("closePath");
  }
  override moveTo(): void {
    this.ops.push("moveTo");
  }
  override lineTo(): void {
    this.ops.push("lineTo");
  }
  override arc(): void {
    this.ops.push("arc");
  }
  override ellipse(): void {
    this.ops.push("ellipse");
  }
  override quadraticCurveTo(): void {
    this.ops.push("quad");
  }
  override fill(): void {
    this.ops.push("fill");
    super.fill();
  }
  override stroke(): void {
    this.ops.push("stroke");
    super.stroke();
  }
  override fillRect(): void {
    this.ops.push("fillRect");
    super.fillRect();
  }
}

describe("1. 配色板与时序常量:和规格表一字不差", () => {
  it("九个 token + 投影色逐个对表,tkBrickSide = shade(tkBrick, -22)", () => {
    expect(TK_COLORS.tkGround.toUpperCase()).toBe("#F5EBDD");
    expect(TK_COLORS.tkBrick.toUpperCase()).toBe("#E2A87A");
    expect(TK_COLORS.tkBrickSide).toBe(shade("#E2A87A", -22));
    expect(TK_COLORS.tkSteel.toUpperCase()).toBe("#C9D3DE");
    expect(TK_COLORS.tkGrass.toUpperCase()).toBe("#9FD98B");
    expect(TK_COLORS.tkIce.toUpperCase()).toBe("#DDF2FF");
    expect(TK_COLORS.tkWater.toUpperCase()).toBe("#A8D8F0");
    expect(TK_COLORS.tkPink.toUpperCase()).toBe("#F4859F");
    expect(TK_COLORS.tkBlue.toUpperCase()).toBe("#7FB2F0");
    expect(TK_COLORS.tkShadow).toBe("rgba(70,60,50,.16)");
    for (const [name, value] of Object.entries(TK_COLORS)) {
      if (name === "tkShadow") continue;
      expect(value, `${name} 不是合法 #RRGGBB`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("动效时序表毫秒/帧数写死:履带 200ms、水波 1600ms、扫光 4000ms、光环 1200ms、白闪 2 帧", () => {
    expect(TRACK_STEP_MS).toBe(200);
    expect(WATER_WAVE_MS).toBe(1600);
    expect(ICE_SHEEN_MS).toBe(4000);
    expect(REBUILD_RING_MS).toBe(1200);
    expect(HIT_FLASH_FRAMES).toBe(2);
    expect(MUZZLE_FLASH_FRAMES).toBe(2);
    expect(MUZZLE_FLASH_FRAMES_REDUCED).toBe(1);
    expect(TRACK_TOOTH_H).toBe(1.5);
    expect(TRACK_TOOTH_GAP).toBe(3);
    expect(SHADOW_PX).toBe(2);
  });

  it("2.5D 侧面比例全库统一 0.18:本款常量与 art/kit 的 SIDE_RATIO 同值", () => {
    expect(TANK_SIDE_RATIO).toBe(0.18);
    expect(SIDE_RATIO).toBe(0.18);
  });
});

describe("2. 履带里程与闪光帧(TankFx 渲染账本)", () => {
  it("履带齿相位随里程推进:200ms 一格,负里程(倒溜)相位反向", () => {
    expect(trackPhase(0)).toBe(0);
    expect(trackPhase(199)).toBe(0);
    expect(trackPhase(200)).toBe(1);
    expect(trackPhase(999)).toBe(4);
    expect(trackPhase(-1)).toBe(-1);
    expect(trackPhase(-201)).toBe(-2);
    // 齿纹错位:奇数相位错半个齿距,负相位也算得对
    expect(trackToothOffset(0)).toBe(0);
    expect(trackToothOffset(200)).toBe(TRACK_TOOTH_GAP / 2);
    expect(trackToothOffset(400)).toBe(0);
    expect(trackToothOffset(-200)).toBe(TRACK_TOOTH_GAP / 2);
  });

  it("前进里程加、倒溜里程减;reduced 下里程冻结", () => {
    const fx = new TankFx();
    const tk = makeTank({ dir: 0 });
    const w = worldWith([tk]);
    fx.update(w, 0, false);
    tk.y -= 0.1; // 车头朝上,往上走 = 前进
    fx.update(w, 100, false);
    expect(fx.rollOf(tk)).toBe(100);
    tk.y += 0.2; // 冰上倒溜:车头没变,车身往后滑
    fx.update(w, 200, false);
    expect(fx.rollOf(tk)).toBe(0);
    tk.y += 0.2;
    fx.update(w, 300, false);
    expect(fx.rollOf(tk)).toBe(-100);

    const frozen = new TankFx();
    const tk2 = makeTank({ id: 2, dir: 0 });
    const w2 = worldWith([tk2]);
    frozen.update(w2, 0, true);
    tk2.y -= 0.5;
    frozen.update(w2, 400, true);
    expect(frozen.rollOf(tk2)).toBe(0);
  });

  it("炮口十字闪光:弹丸出膛点亮 2 帧;reduced 是功能反馈,留 1 帧", () => {
    const fx = new TankFx();
    const tk = makeTank({ windup: MUZZLE_WINDUP });
    const w = worldWith([tk]);
    fx.update(w, 0, false);
    tk.windup = 0; // 前摇归零 = 出膛
    fx.update(w, 16, false);
    expect(fx.muzzleOf(tk)).toBe(MUZZLE_FLASH_FRAMES);
    fx.update(w, 32, false);
    expect(fx.muzzleOf(tk)).toBe(1);
    fx.update(w, 48, false);
    expect(fx.muzzleOf(tk)).toBe(0);

    const rfx = new TankFx();
    const tk2 = makeTank({ id: 2, windup: MUZZLE_WINDUP });
    const w2 = worldWith([tk2]);
    rfx.update(w2, 0, true);
    tk2.windup = 0;
    rfx.update(w2, 16, true);
    expect(rfx.muzzleOf(tk2)).toBe(MUZZLE_FLASH_FRAMES_REDUCED);
    rfx.update(w2, 32, true);
    expect(rfx.muzzleOf(tk2)).toBe(0);
  });

  it("受击白闪 2 帧:护甲掉一格点亮,reduced 也保留(顿帧只在视觉,不碰逻辑)", () => {
    const fx = new TankFx();
    const tk = makeTank({ armor: 2 });
    const w = worldWith([tk]);
    fx.update(w, 0, true);
    tk.armor = 1;
    fx.update(w, 16, true);
    expect(fx.hitOf(tk)).toBe(HIT_FLASH_FRAMES);
    fx.update(w, 32, true);
    fx.update(w, 48, true);
    expect(fx.hitOf(tk)).toBe(0);
  });

  it("destroy 归零:reset 之后账本一辆车都不记", () => {
    const fx = new TankFx();
    fx.update(worldWith([makeTank()]), 0, false);
    expect(fx.tracked).toBe(1);
    fx.reset();
    expect(fx.tracked).toBe(0);
  });
});

describe("3. 常驻动效相位:reduced 一律冻结", () => {
  it("水面两帧 1600ms 交替;冰面扫光 0..1;光环 1200ms 一圈", () => {
    expect(waterFrame(0, false)).toBe(0);
    expect(waterFrame(1600, false)).toBe(1);
    expect(waterFrame(3200, false)).toBe(0);
    expect(iceSheenPos(0, false)).toBe(0);
    expect(iceSheenPos(2000, false)).toBeCloseTo(0.5, 5);
    expect(iceSheenPos(1000, false)).toBeGreaterThan(0);
    expect(iceSheenPos(1000, false)).toBeLessThan(0.5);
    expect(ringAngle(600, false)).toBeCloseTo(Math.PI, 5);
    expect(ringAngle(1200, false)).toBeCloseTo(0, 5);
  });

  it("reduced:水波 / 扫光 / 光环全部停在第 0 相", () => {
    expect(waterFrame(1600, true)).toBe(0);
    expect(iceSheenPos(2000, true)).toBe(0);
    expect(ringAngle(600, true)).toBe(0);
  });
});

describe("4. 玩法数值一个没动(视觉步的铁律)", () => {
  it("recoilPixels 输入输出快照与 1.2 完全一致", () => {
    // s=26:峰值 = clamp(0.2*26, 4, 6) = 5.2
    expect(recoilPixels(0.18, 26)).toBeCloseTo(5.2, 6);
    expect(recoilPixels(0.09, 26)).toBeCloseTo(2.6, 6);
    expect(recoilPixels(0.3, 26)).toBeCloseTo(5.2, 6); // 超过 RECOIL_SECONDS 就按满算
    expect(recoilPixels(0, 26)).toBe(0);
    expect(recoilPixels(-0.1, 26)).toBe(0);
    // s=14:0.2*14=2.8,顶到下限 4;s=40:0.2*40=8,压到上限 6
    expect(recoilPixels(0.18, 14)).toBeCloseTo(4, 6);
    expect(recoilPixels(0.18, 40)).toBeCloseTo(6, 6);
  });

  it("重生进度环只读 REBUILD_SECONDS;散架/重组秒数还是 1.2 那两个数", () => {
    expect(REBUILD_SECONDS).toBe(3);
    expect(SCATTER_SECONDS).toBe(1.1);
    expect(rebuildProgress(REBUILD_SECONDS)).toBe(0);
    expect(rebuildProgress(REBUILD_SECONDS / 2)).toBeCloseTo(0.5, 6);
    expect(rebuildProgress(0)).toBe(1);
  });

  it("判定半径与草丛遮蔽也没动:TANK_HALF 0.38、GRASS_ALPHA 0.55", () => {
    expect(TANK_HALF).toBe(0.38);
    expect(GRASS_ALPHA).toBe(0.55);
    expect(MUZZLE_WINDUP).toBe(0.09);
  });
});

describe("5. 徽章 / 零件 / 盾牌:自绘矢量", () => {
  it("五款徽章可调用不抛错,缩到 8px(r=4)也画得出来", () => {
    for (const r of [4, 9]) {
      for (const draw of [drawFlowerBadge, drawStarBadge, drawGearBadge, drawRivetBadge, drawBoltBadge]) {
        const c = new FakeCtx();
        expect(() => draw(ctx2d(c), 10, 10, r)).not.toThrow();
        expect(c.strokes).toBeGreaterThan(0);
      }
    }
    // 四种敌人车型都有徽章形状可挑(齿轮/铆钉/闪电三款)
    for (const kind of ["swift", "armor", "power", "smart"]) {
      const c = new FakeCtx();
      drawBadge(ctx2d(c), KIND_BADGE[kind], 10, 10, 4);
      expect(c.strokes, `${kind} 的徽章没画出来`).toBeGreaterThan(0);
    }
  });

  it("徽章双通道可辨:花 / 星 / 齿轮 / 铆钉 / 闪电的路径序列两两不同", () => {
    const seq = (draw: (c: CanvasRenderingContext2D, x: number, y: number, r: number) => void): string => {
      const c = new OpCtx();
      draw(ctx2d(c), 0, 0, 8);
      return c.ops.join(">");
    };
    const all = [drawFlowerBadge, drawStarBadge, drawGearBadge, drawRivetBadge, drawBoltBadge].map(seq);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(all[i], `第 ${i} 和第 ${j} 款徽章画得一模一样`).not.toBe(all[j]);
      }
    }
  });

  it("散架零件五款(对应 1.2 的五个 emoji)全部自绘,灰显版也能画", () => {
    expect(PART_KINDS).toHaveLength(5);
    for (const kind of PART_KINDS) {
      for (const gray of [false, true]) {
        const c = new FakeCtx();
        expect(() => drawPart(ctx2d(c), kind, 5, 5, 4, gray)).not.toThrow();
        expect(c.strokes).toBeGreaterThan(0);
      }
    }
  });

  it("护甲小盾牌:金边、固定 8px,替换 1.2 的白点", () => {
    expect(ARMOR_BADGE_PX).toBe(8);
    const c = new FakeCtx();
    drawShieldBadge(ctx2d(c), 10, 10);
    expect(c.strokes).toBeGreaterThan(1);
  });

  it("炮口十字闪光 / 护盾六边形网纹 / 四款粒子矢量都画得出来", () => {
    for (const run of [
      (c: CanvasRenderingContext2D) => drawMuzzleFlash(c, 5, 5, 4),
      (c: CanvasRenderingContext2D) => drawHexRing(c, 5, 5, 8, 0.4, 0.6),
      (c: CanvasRenderingContext2D) => drawFxFlower(c, 5, 5, 6),
      (c: CanvasRenderingContext2D) => drawFxSmoke(c, 5, 5, 6, 0.5),
      (c: CanvasRenderingContext2D) => drawFxSparkle(c, 5, 5, 6),
      (c: CanvasRenderingContext2D) => drawFxCrumb(c, 5, 5, 4),
    ]) {
      const c = new FakeCtx();
      expect(() => run(ctx2d(c))).not.toThrow();
      expect(c.strokes).toBeGreaterThan(0);
    }
  });
});

describe("6. 双面块与投影:全画在本格里,方向统一右下", () => {
  it("cellBlock(投影+侧面+顶面)的每一笔都收在 s×s 里", () => {
    const c = new BoxCtx();
    cellBlock(ctx2d(c) as never, 26, 52, 26, 26, "#E2A87A");
    expect(c.xs.length).toBeGreaterThan(4);
    for (const x of c.xs) {
      expect(x).toBeGreaterThanOrEqual(26);
      expect(x).toBeLessThanOrEqual(52);
    }
    for (const y of c.ys) {
      expect(y).toBeGreaterThanOrEqual(52);
      expect(y).toBeLessThanOrEqual(78);
    }
  });

  it("投影固定朝右下:影子那一笔从 (x+2, y+2) 起,块体从 (x, y) 起", () => {
    const c = new BoxCtx();
    cellBlock(ctx2d(c) as never, 0, 0, 26, 26, "#C9D3DE");
    // 第一条路径是投影(moveTo 的 x = 圆角起点 = 2 + 圆角半径),之后才是块体
    expect(Math.min(...c.xs)).toBe(0);
    expect(Math.min(...c.ys)).toBe(0);
    const firstX = c.xs[0];
    expect(firstX).toBeGreaterThanOrEqual(SHADOW_PX);
  });
});

describe("7. canvas 通道零 fillText:emoji 素材彻底下岗", () => {
  const here = new URL(".", import.meta.url).pathname;
  const src = readFileSync(`${here}/index.ts`, "utf8");
  const art = readFileSync(`${here}/visual13.ts`, "utf8");

  it("index.ts / visual13.ts 源码里一个 fillText 都不剩", () => {
    expect(src).not.toContain("fillText");
    expect(art).not.toContain("fillText");
  });

  it("散架五件套与车顶 emoji 不再出现在绘制源码里", () => {
    // 🌼 还留在 HUD 芯片与结算面板的 DOM 文案里(那是界面文字,不是 canvas 素材)
    for (const emoji of ["🔩", "⚙", "🔧", "🛞", "🧰", "✳", "KIND_FACE", "🕵", "🚜\", px"]) {
      expect(src, `index.ts 里还残留 ${emoji}`).not.toContain(emoji);
      expect(art, `visual13.ts 里还残留 ${emoji}`).not.toContain(emoji);
    }
  });

  it("真开一局跑几十帧:canvas 上没有任何一笔是文字", async () => {
    const h: Harness = install();
    try {
      const mod = await import("./index");
      const game = mod.mount({
        root: h.root as unknown as HTMLElement,
        play: () => {},
        addStars: (n: number) => n,
        initialLevel: 5,
      } as never);
      h.flush(3);
      const canvas = findOne(h.root, "tkb-canvas");
      const ctx = canvas?.getContext("2d");
      expect(ctx).not.toBeNull();
      let textCalls = 0;
      if (ctx) ctx.fillText = () => void (textCalls += 1);
      h.key("keydown", "KeyF"); // 开一炮:散架/闪光那几条路径也要跑到
      h.flush(40);
      h.key("keyup", "KeyF");
      expect((ctx?.strokes ?? 0) > 0 || textCalls === 0).toBe(true);
      expect(textCalls).toBe(0);
      game.destroy();
      expect(h.pendingFrames()).toBe(0);
    } finally {
      h.restore();
    }
  });

  it("零输入跑一段模拟:散架与粒子分支照样零 fillText(用的是矢量零件)", async () => {
    const h: Harness = install();
    try {
      const mod = await import("./index");
      const game = mod.mount({
        root: h.root as unknown as HTMLElement,
        play: () => {},
        addStars: (n: number) => n,
        initialLevel: 1,
      } as never);
      h.flush(2);
      const ctx = findOne(h.root, "tkb-canvas")?.getContext("2d");
      let textCalls = 0;
      if (ctx) ctx.fillText = () => void (textCalls += 1);
      // 摆烂挂机一阵:敌车会打中玩家,散架零件与烟花粒子都会走到
      h.flush(600, 33);
      expect(textCalls).toBe(0);
      expect(IDLE_INPUT.fire).toBe(false); // 顺带钉死:这局真的没人开火
      game.destroy();
    } finally {
      h.restore();
    }
  });
});
