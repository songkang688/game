/**
 * 1.3 第 15 步 · A 档 视觉用例(只增不减)。
 *
 * 盯五件事:
 *   1. 配色板 token 与动效时序常量和四·补一 / 四·补三的表一字不差;
 *   2. 角色 / 门 / 道具已全部自绘:index.ts 源码里不再有 🌸⭐🚪 与 ITEM_INFO emoji 的
 *      fillText 直出,chibi 三态在 domStub 2D 桩下可调用;
 *   3. 动效行为:临爆脉动只在 1s 窗口且 ±6%、涟漪 150ms/格推进、危险格泛红呼吸
 *      峰值 0.32 且时序与 1.2 同一条归一化;reduced 全部按表退化、保命信息不减;
 *   4. 软砖裂纹是纯视觉(炸碎仍一次到位),三套主题装饰与章节映射对得上;
 *   5. destroy 后粒子与动画计时归零;玩法常量快照(谁动了立刻红)。
 */
import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { shade } from "../../art/kit/palette";
import { SIDE_RATIO } from "../../art/kit/block25d";
import { ACCESSORY_MIN_PX, accessoryMode, drawChibi, type ChibiSpec } from "../../art/kit/chibi";
import { FakeCtx, findButton, findOne, install, type Harness } from "./domStub";
import { CHAPTERS, MIN_CELL_PX } from "./levels";
import {
  BUBBLE_MS,
  DIR_NONE,
  FLAME_MS,
  FUSE_MS,
  ITEM_KINDS_V2,
  TILE_FLOOR,
  TILE_SOFT,
  createWorld,
  makeFighter,
  stepWorld,
  type Board,
  type Bomb,
  type ChainWave,
  type Intent,
} from "./logic";
import { mount } from "./index";
import {
  BB_COLORS,
  BB_LAYERS,
  BOOM_FLASH_FRAMES,
  BbBoomFx,
  BbFighterFx,
  CRACK_STAGE1_MS,
  CRACK_STAGE2_MS,
  DANGER_EDGE,
  DANGER_PEAK_ALPHA,
  FUSE_SPARK_MS,
  PULSE_AMP,
  PULSE_PERIOD_MS,
  PULSE_WINDOW_MS,
  RIPPLE_END_SPARKS,
  RIPPLE_STEP_MS,
  THEME_BY_CHAPTER,
  bombPulseScale,
  crackStage,
  dangerEdgeAlpha,
  dangerGlowAlpha,
  drawDoor,
  drawHudRing,
  drawItemIcon,
  drawRipplePetal,
  drawRivets,
  drawWallOrnament,
  fuseSparkPhase,
  hudRingColor,
  rippleDelayMs,
  themeOfChapter,
} from "./visual13";

const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

/** WCAG 相对亮度 → 对比度(小屏保命线的算术依据) */
function luminance(hex: string): number {
  const chan = (i: number): number => {
    const v = Number.parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// 1. 配色板与图层序
// ---------------------------------------------------------------------------

describe("1. 配色板 token 与四·补一一字不差", () => {
  it("十个 token 逐个对表,bbWallSide = shade(bbWall, -22),全是合法色", () => {
    expect(BB_COLORS.bbFloorA.toUpperCase()).toBe("#FDF3F7");
    expect(BB_COLORS.bbFloorB.toUpperCase()).toBe("#F8ECF2");
    expect(BB_COLORS.bbWall.toUpperCase()).toBe("#D9C4E8");
    expect(BB_COLORS.bbWallSide).toBe(shade("#D9C4E8", -22));
    expect(BB_COLORS.bbBrick.toUpperCase()).toBe("#F3C9A8");
    expect(BB_COLORS.bbBubble.toUpperCase()).toBe("#BFE4FF");
    expect(BB_COLORS.bbDanger).toBe("rgba(244,110,110,.32)");
    expect(BB_COLORS.bbPink.toUpperCase()).toBe("#F4859F");
    expect(BB_COLORS.bbBlue.toUpperCase()).toBe("#7FB2F0");
    expect(BB_COLORS.bbShadow).toBe("rgba(93,64,90,.16)");
    for (const [name, value] of Object.entries(BB_COLORS)) {
      if (name === "bbDanger" || name === "bbShadow") continue;
      expect(value, `${name} 不是合法 #RRGGBB`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // 2.5D 侧面走全库统一的 block25d(0.18 / -22),没有另起炉灶
    expect(SIDE_RATIO).toBe(0.18);
  });

  it("图层序固定从底到顶:地板→危险→砖墙门→道具→泡泡→角色→涟漪→HUD", () => {
    expect([...BB_LAYERS]).toEqual([
      "floor",
      "danger",
      "blocks",
      "items",
      "bombs",
      "fighters",
      "ripples",
      "hud",
    ]);
    // render 里的图层注释顺序与约定一致(危险层永远压在砖下)
    const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    const marks = ["① 地板棋盘", "② 危险格泛红", "③ 硬墙 / 软砖 / 门", "④ 道具", "⑤ 炸弹泡泡", "⑥ 小怪 + 双人小人", "⑦ 彩虹波纹 + 爆炸涟漪"];
    const at = marks.map((m) => src.indexOf(m));
    for (const [i, pos] of at.entries()) {
      expect(pos, `render 里找不到图层注释「${marks[i]}」`).toBeGreaterThan(0);
      if (i > 0) expect(pos).toBeGreaterThan(at[i - 1]);
    }
  });

  it("动效时序表毫秒写死:星火 400、脉动窗口 1000/周期 250/±6%、白闪 2 帧、涟漪 150ms、星屑 3 颗", () => {
    expect(FUSE_SPARK_MS).toBe(400);
    expect(PULSE_WINDOW_MS).toBe(1000);
    expect(PULSE_PERIOD_MS).toBe(250);
    expect(PULSE_AMP).toBe(0.06);
    expect(BOOM_FLASH_FRAMES).toBe(2);
    expect(RIPPLE_STEP_MS).toBe(150);
    expect(RIPPLE_END_SPARKS).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. 角色 / 门 / 道具全自绘
// ---------------------------------------------------------------------------

const SPEC: ChibiSpec = {
  skin: "#FFE3D2",
  outfit: BB_COLORS.bbPink,
  outfitStyle: "dress",
  accessory: "flower",
  accessoryColor: "#FF9FBE",
};

describe("2. emoji fillText 全清(源码字符串断言)+ 三态可绘制", () => {
  const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

  it("index.ts 里再也没有 🌸⭐🚪、emoji 小花池与 ITEM_INFO emoji 的 fillText 直出", () => {
    for (const bad of ["🌸", "⭐", "🚪", "🌼", "🌺", "💠", "P_EMOJI", "FLOWER_EMOJI", "emojiAt"]) {
      expect(src.includes(bad), `index.ts 里还残留 ${bad}`).toBe(false);
    }
    expect(src).not.toMatch(/ITEM_INFO\[[^\]]*\]\.emoji/);
    expect(src).not.toMatch(/f\.emoji/);
    // 取而代之的是三件自绘:小人 / 木门 / 道具图标
    expect(src).toContain("drawChibi(");
    expect(src).toContain("drawDoor(");
    expect(src).toContain("drawItemIcon(");
  });

  it("角色三态(走 / 蹲 / 困)+ 镜像在 domStub 的 2D 桩下都画得出来,不抛错", () => {
    for (const pose of ["idle", "walk", "squat", "trapped"] as const) {
      for (const facing of [1, -1] as const) {
        expect(() =>
          drawChibi(ctx2d(new FakeCtx()), 20, 20, 40, SPEC, { pose, walkFrame: 0, facing, reduced: false })
        ).not.toThrow();
      }
    }
  });

  it("七件道具图标 + 木门 + 铆钉 + 圆环 + 涟漪花瓣全部矢量可绘制", () => {
    for (const kind of ITEM_KINDS_V2) {
      expect(() => drawItemIcon(ctx2d(new FakeCtx()), kind, 20, 20, 12), `${kind} 图标画不出来`).not.toThrow();
    }
    expect(() => drawDoor(ctx2d(new FakeCtx()), 0, 0, 40)).not.toThrow();
    expect(() => drawRivets(ctx2d(new FakeCtx()), 0, 0, 32, 32, "#888888")).not.toThrow();
    expect(() => drawHudRing(ctx2d(new FakeCtx()), 8, 8, 6, 0.5, "#6FBF9A")).not.toThrow();
    expect(() => drawRipplePetal(ctx2d(new FakeCtx()), 20, 20, 12, "#FFC2DA", 0.8)).not.toThrow();
  });

  it("最小格 24px 时发饰名义尺寸不足 4px,高对比色块兜底生效", () => {
    expect(MIN_CELL_PX).toBe(24);
    expect(accessoryMode(MIN_CELL_PX * 0.16)).toBe("block");
    expect(accessoryMode(30 * 0.16)).toBe("detail");
    expect(ACCESSORY_MIN_PX).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 3. 动效行为:脉动 / 星火 / 涟漪 / 危险呼吸
// ---------------------------------------------------------------------------

describe("3. 临爆脉动只在爆前 1s 窗口、幅度 ±6%;reduced 退化为变色", () => {
  it("窗口外恒为 1,窗口内在 [0.94, 1.06] 里摆满整个振幅", () => {
    expect(bombPulseScale(PULSE_WINDOW_MS + 1, false)).toBe(1);
    expect(bombPulseScale(1500, false)).toBe(1);
    let hi = 1;
    let lo = 1;
    for (let fuse = 0; fuse <= PULSE_WINDOW_MS; fuse += 5) {
      const s = bombPulseScale(fuse, false);
      hi = Math.max(hi, s);
      lo = Math.min(lo, s);
    }
    expect(hi).toBeLessThanOrEqual(1 + PULSE_AMP + 1e-9);
    expect(hi).toBeGreaterThan(1 + PULSE_AMP * 0.95);
    expect(lo).toBeGreaterThanOrEqual(1 - PULSE_AMP - 1e-9);
    expect(lo).toBeLessThan(1 - PULSE_AMP * 0.95);
  });

  it("reduced:任何引信读数都不脉动(变色由 BB_PULSE_TINT 接手)", () => {
    for (const fuse of [0, 125, 250, 500, 999]) {
      expect(bombPulseScale(fuse, true)).toBe(1);
    }
  });

  it("引信星火 400ms 线性循环;reduced 冻结成静态星火点", () => {
    expect(fuseSparkPhase(0, false)).toBe(0);
    expect(fuseSparkPhase(FUSE_SPARK_MS / 2, false)).toBeCloseTo(0.5, 6);
    expect(fuseSparkPhase(FUSE_SPARK_MS, false)).toBe(0);
    expect(fuseSparkPhase(999, true)).toBe(0);
  });
});

describe("4. 花瓣涟漪:150ms/格沿臂推进,末端星屑,白闪 2 帧;reduced 一次性静态", () => {
  const board: Board = { w: 7, h: 1, cells: [0, 0, 0, 0, 0, 0, 0] };
  const bombAt3 = { id: 1, pos: 3, owner: 0, power: 2, fuse: 0, remote: false, slide: -1, slideT: 0 } as Bomb;
  const wave: ChainWave = { wave: 0, ids: [1], cells: [1, 2, 3, 4, 5], delay: 0 };

  it("每格一瓣,出现时刻 = 离炸心距离 × 150ms;两条臂末端各 1 条星屑账(每条 3 颗)", () => {
    const fxLedger = new BbBoomFx();
    fxLedger.noteBombs([bombAt3]);
    fxLedger.noteBoom(board, [wave], 1000, false);
    expect(fxLedger.petalStarts()).toEqual([1000, 1150, 1150, 1300, 1300]);
    expect(fxLedger.sparkCount()).toBe(2);
    expect(fxLedger.flashCount()).toBe(1);
    expect(rippleDelayMs(2, false)).toBe(2 * RIPPLE_STEP_MS);
  });

  it("reduced:所有花瓣同时出现(一次性静态显示),星屑不撒,白闪保留(功能反馈)", () => {
    const fxLedger = new BbBoomFx();
    fxLedger.noteBombs([bombAt3]);
    fxLedger.noteBoom(board, [wave], 1000, true);
    expect(new Set(fxLedger.petalStarts())).toEqual(new Set([1000]));
    expect(fxLedger.sparkCount()).toBe(0);
    expect(fxLedger.flashCount()).toBe(1);
    expect(rippleDelayMs(5, true)).toBe(0);
  });

  it("白闪只活 2 帧;账本推进后自动清空;draw 在 2D 桩下不抛错", () => {
    const fxLedger = new BbBoomFx();
    fxLedger.noteBombs([bombAt3]);
    fxLedger.noteBoom(board, [wave], 0, false);
    expect(() => fxLedger.draw(ctx2d(new FakeCtx()), 30, 100)).not.toThrow();
    fxLedger.step(16);
    fxLedger.step(32);
    expect(fxLedger.flashCount()).toBe(0);
    fxLedger.step(99999);
    expect(fxLedger.pending).toBe(0);
  });

  it("与 dangerTiming 的时序只读对账:FUSE_MS=2000 / FLAME_MS=460 一个没动,涟漪常量自成一档", () => {
    expect(FUSE_MS).toBe(2000);
    expect(FLAME_MS).toBe(460);
    expect(BUBBLE_MS).toBe(3600);
    expect(RIPPLE_STEP_MS).toBe(150);
  });
});

describe("5. 危险格泛红呼吸:峰值 0.32、时机与 1.2 同一条归一化、对比度 ≥ 3:1", () => {
  it("峰值透明度 0.32;reduced 退化为静态红但保命信息不减", () => {
    expect(DANGER_PEAK_ALPHA).toBe(0.32);
    // reduced:呼吸停,静态峰值恰好是 0.32
    expect(dangerGlowAlpha(0, 12345, true)).toBeCloseTo(DANGER_PEAK_ALPHA, 6);
    // 非 reduced:呼吸最高点也不越过 0.32
    let hi = 0;
    for (let t = 0; t < 1800; t += 10) hi = Math.max(hi, dangerGlowAlpha(0, t, false));
    expect(hi).toBeLessThanOrEqual(DANGER_PEAK_ALPHA + 1e-9);
    expect(hi).toBeGreaterThan(DANGER_PEAK_ALPHA * 0.98);
  });

  it("一进危险表(msToBurn = FUSE_MS)就有底亮,不会黑屏到最后一秒才亮", () => {
    expect(dangerGlowAlpha(FUSE_MS, 0, true)).toBeGreaterThan(0.1);
    // 边缘虚线沿用 1.2 的透明度公式:0.15 + near × 0.55(时机一帧不差)
    expect(dangerEdgeAlpha(FUSE_MS)).toBeCloseTo(0.15, 6);
    expect(dangerEdgeAlpha(0)).toBeCloseTo(0.7, 6);
    expect(dangerEdgeAlpha(FUSE_MS / 2)).toBeCloseTo(0.15 + 0.5 * 0.55, 6);
  });

  it("小屏保命线:虚线边颜色对两种地板的对比度都 ≥ 3:1", () => {
    expect(contrast(DANGER_EDGE, BB_COLORS.bbFloorA)).toBeGreaterThanOrEqual(3);
    expect(contrast(DANGER_EDGE, BB_COLORS.bbFloorB)).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 6. 软砖裂纹纯视觉 + 三套主题
// ---------------------------------------------------------------------------

describe("6. 软砖两阶段裂纹是纯视觉状态", () => {
  it("裂纹分档只看 dangerTiming 读数:>1s 完好、≤1s 细裂、≤350ms 大裂", () => {
    expect(CRACK_STAGE1_MS).toBe(1000);
    expect(CRACK_STAGE2_MS).toBe(350);
    expect(crackStage(undefined)).toBe(0);
    expect(crackStage(Infinity)).toBe(0);
    expect(crackStage(1500)).toBe(0);
    expect(crackStage(1000)).toBe(1);
    expect(crackStage(351)).toBe(1);
    expect(crackStage(350)).toBe(2);
    expect(crackStage(0)).toBe(2);
  });

  it("炸碎逻辑仍是一次到位:软砖被波及当帧就变地板,没有「炸两次才碎」", () => {
    const board: Board = { w: 5, h: 1, cells: [0, 0, 0, TILE_SOFT, 1] };
    const world = createWorld({ board, fighters: [makeFighter(0, "测试", "", 2, 0)] });
    const idle: Intent = { dir: DIR_NONE, drop: false, detonate: false, kick: false };
    stepWorld(world, 16, [{ ...idle, drop: true }]);
    expect(world.bombs.length).toBe(1);
    let guard = 0;
    while (world.bombs.length > 0 && guard++ < 300) stepWorld(world, 20, [idle]);
    expect(world.bombs.length).toBe(0);
    expect(board.cells[3]).toBe(TILE_FLOOR);
  });
});

describe("7. 三套主题装饰与章节映射", () => {
  it("八个章节各归一套主题,三套都有人用;装饰画法在 2D 桩下可调用", () => {
    expect(THEME_BY_CHAPTER.length).toBe(CHAPTERS.length);
    expect(themeOfChapter(0)).toBe("garden");
    expect(themeOfChapter(2)).toBe("ice");
    expect(themeOfChapter(3)).toBe("starry");
    expect(themeOfChapter(5)).toBe("ice");
    expect(themeOfChapter(7)).toBe("starry");
    expect(new Set(THEME_BY_CHAPTER)).toEqual(new Set(["garden", "ice", "starry"]));
    // 越界夹回,不抛错
    expect(themeOfChapter(-3)).toBe(THEME_BY_CHAPTER[0]);
    expect(themeOfChapter(99)).toBe(THEME_BY_CHAPTER[7]);
    for (const theme of ["garden", "ice", "starry"] as const) {
      expect(() => drawWallOrnament(ctx2d(new FakeCtx()), theme, 0, 0, 32, "#7fb389")).not.toThrow();
    }
  });

  it("HUD 圆环配色三档:富余绿 / 过半琥珀 / 紧张红", () => {
    expect(hudRingColor(0.9)).toBe("#6FBF9A");
    expect(hudRingColor(0.4)).toBe("#F2B34C");
    expect(hudRingColor(0.1)).toBe("#E06A6A");
  });
});

// ---------------------------------------------------------------------------
// 8. 真挂载冒烟 + destroy 归零
// ---------------------------------------------------------------------------

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

function boot(opts: Parameters<typeof install>[0] = {}): { h: Harness; handle: ReturnType<typeof mount> } {
  const h = install(opts);
  harness = h;
  const state = { stars: 0 };
  const api = {
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: (n: number) => (state.stars += n),
    getStars: () => state.stars,
    onWin: () => {},
    onLose: () => {},
  };
  return { h, handle: mount(api as never) };
}

/**
 * 泡泡塔第 1 层是种子图(seed 5514):出生点 (1,1),第 1 行整行无砖。
 * 按 F 在脚下放泡后按住 D 往右走 3 格就能躲开威力 1 的十字波——
 * 人活着,这局才不会被「被罩住就结算」提前收场,涟漪帧才真的画得到。
 */
function dropAndDodge(m: { h: Harness }): void {
  findButton(m.h.root, "泡泡塔")?.fire("click");
  m.h.flush(3);
  expect(findOne(m.h.root, "bmb-board"), "泡泡塔没开起来").not.toBe(null);
  m.h.key("keydown", "KeyF");
  m.h.flush(2);
  m.h.key("keyup", "KeyF");
  // 速度 2 档 = 205ms/格;480ms 够走 3 格,落在 x=4,离十字波两格远
  m.h.key("keydown", "KeyD");
  m.h.flush(16, 30);
  m.h.key("keyup", "KeyD");
  // 再推 3s:引信 2s 烧完 + 白闪 2 帧 + 每格 150ms 的花瓣涟漪散尽
  m.h.flush(100, 30);
}

describe("8. 真挂载:新皮肤在 2D 桩下跑一整条「放泡→走位→爆炸→涟漪」不抛错", () => {
  it("泡泡塔里放泡再躲开,推过引信 2s + 波纹 460ms,画面帧照常出", () => {
    const m = boot();
    dropAndDodge(m);
    expect(findOne(m.h.root, "bmb-board")).not.toBe(null);
    m.handle.destroy();
    expect(m.h.pendingFrames()).toBe(0);
  });

  it("reduced 下同一条路径也顺:脉动退化、涟漪静态、危险提示照亮", () => {
    const m = boot({ reduceMotion: true });
    dropAndDodge(m);
    expect(findOne(m.h.root, "bmb-board")).not.toBe(null);
    m.handle.destroy();
    expect(m.h.pendingFrames()).toBe(0);
  });
});

describe("9. destroy 后粒子与动画计时归零", () => {
  it("BbBoomFx.reset 一笔不剩;BbFighterFx.reset 后没有悬着的下蹲计时", () => {
    const board: Board = { w: 3, h: 1, cells: [0, 0, 0] };
    const bomb = { id: 7, pos: 1, owner: 0, power: 1, fuse: 0, remote: false, slide: -1, slideT: 0 } as Bomb;
    const fxLedger = new BbBoomFx();
    fxLedger.noteBombs([bomb]);
    fxLedger.noteBoom(board, [{ wave: 0, ids: [7], cells: [0, 1, 2], delay: 0 }], 0, false);
    expect(fxLedger.pending).toBeGreaterThan(0);
    fxLedger.reset();
    expect(fxLedger.pending).toBe(0);

    const squat = new BbFighterFx();
    squat.update([], 1, 0);
    squat.update([bomb], 1, 10);
    expect(squat.squatting(0, 10)).toBe(true);
    expect(squat.pendingAt(10)).toBe(1);
    squat.reset();
    expect(squat.squatting(0, 10)).toBe(false);
    expect(squat.pendingAt(10)).toBe(0);
  });

  it("埋弹下蹲窗口 120ms:到点自己站起来", () => {
    const squat = new BbFighterFx();
    const bomb = { id: 1, pos: 0, owner: 0, power: 1, fuse: 2000, remote: false, slide: -1, slideT: 0 } as Bomb;
    squat.update([], 1, 0);
    squat.update([bomb], 1, 100);
    expect(squat.squatting(0, 100)).toBe(true);
    expect(squat.squatting(0, 219)).toBe(true);
    expect(squat.squatting(0, 220)).toBe(false);
  });
});
