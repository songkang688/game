/**
 * 冰冰火火森林 · 1.3 视觉用例(只增不减)。
 *
 * 盯四类事:
 *  1. 配色板 / 图层序 / 动效时序表与规格逐个对表 —— 谁改数值立刻红;
 *  2. 双角色可区分性:剪影点集、尖端偏移、头饰 / 附件四分支、glow 与 rim;
 *  3. reduced:气泡 / 闪点 / 尘土生成数为 0,火苗围巾旗帜全部静止;
 *  4. 功能件与清理:虚线圈与小云朵分支还在、摄像机常量一个数没动、destroy 归零。
 */
import { afterEach, describe, expect, it } from "vitest";
import { FakeCtx, findAll, install, type Harness } from "./domStub";
import { CAMERA } from "./camera";
import {
  CONTROL_RING,
  FIRE_GLOW_BLUR,
  FIRE_JUMP_SQUASH,
  FLAG_WAVE_MS,
  FLAME_BOB_MS,
  FLAME_PHASE_MS,
  GATE_DUST_MS,
  GATE_DUST_PUFFS,
  GEM_SPIN_MS,
  HERO_SHADOW,
  ICE_JUMP_STRETCH,
  IFF_COLORS,
  IFF_LAYERS,
  IFF_PARALLAX_DEPTHS,
  IffDustFx,
  LAVA_BUBBLE_MS,
  LAVA_SHEEN_MS,
  SCARF_FRAMES,
  SCARF_FRAME_MS,
  drawCloudBuddy,
  drawControlRing,
  drawHeroFigure,
  drawMiniHero,
  flagWave,
  flameBob,
  gemSparks,
  heroSilhouette,
  heroSilhouetteSegments,
  lavaBubbles,
  lavaSheenPhase,
  saturationOf,
  scarfFrame,
  silhouetteApex,
  silhouettePoints,
  type HeroFigureOpts,
} from "./visual13";

/** 在 FakeCtx 之上再记两笔:save/restore 是否配平、shadowBlur 有没有开过 */
class SpyCtx extends FakeCtx {
  saves = 0;
  restores = 0;
  maxShadowBlur = 0;
  private blur = 0;
  override save(): void {
    this.saves++;
  }
  override restore(): void {
    this.restores++;
  }
  get shadowBlur(): number {
    return this.blur;
  }
  set shadowBlur(v: number) {
    this.blur = v;
    this.maxShadowBlur = Math.max(this.maxShadowBlur, v);
  }
}

function ctx2d(): CanvasRenderingContext2D {
  return new FakeCtx() as unknown as CanvasRenderingContext2D;
}

function figureOpts(kind: "ice" | "fire", extra: Partial<HeroFigureOpts> = {}): HeroFigureOpts {
  return {
    kind,
    cx: 20,
    cy: 20,
    r: 10,
    nowMs: 500,
    reduced: false,
    moving: false,
    jumping: false,
    leanX: 0,
    flash: false,
    shadow: true,
    ...extra,
  };
}

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

// ---------------------------------------------------------------------------
// 一、配色板 / 图层序 / 时序表对表
// ---------------------------------------------------------------------------

describe("配色板(四·补一)", () => {
  it("token 逐个与规格表一致,十六进制 / rgba 全部合法", () => {
    expect(IFF_COLORS.iffIceBody).toBe("#9FD8F5");
    expect(IFF_COLORS.iffIceCore).toBe("#FFFFFF");
    expect(IFF_COLORS.iffIceRim).toBe("#EFFBFF");
    expect(IFF_COLORS.iffFireBody).toBe("#F5824E");
    expect(IFF_COLORS.iffFireCore).toBe("#FFE28A");
    expect(IFF_COLORS.iffFireGlow).toBe("rgba(255,178,102,.5)");
    expect(IFF_COLORS.iffForestFar).toBe("#C9E3D8");
    expect(IFF_COLORS.iffForestMid).toBe("#A8CBB8");
    expect(IFF_COLORS.iffLava).toBe("#F0955A");
    expect(IFF_COLORS.iffShadowCold).toBe("rgba(110,150,200,.16)");
    expect(IFF_COLORS.iffShadowWarm).toBe("rgba(160,110,80,.16)");
    for (const v of Object.values(IFF_COLORS)) {
      expect(
        /^#[0-9A-F]{6}$/i.test(v) || /^rgba\(\d+,\d+,\d+,\.\d+\)$/.test(v),
        `token ${v} 不合法`
      ).toBe(true);
    }
  });

  it("冰影冷蓝(蓝通道占优)、火影暖褐(红通道占优)", () => {
    const cold = IFF_COLORS.iffShadowCold.match(/\d+/g)!.map(Number);
    const warm = IFF_COLORS.iffShadowWarm.match(/\d+/g)!.map(Number);
    expect(cold[2]).toBeGreaterThan(cold[0]);
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });

  it("图层序从天空到 HUD 十层不乱:粒子在主角之上、功能件更上、HUD 收尾", () => {
    expect(IFF_LAYERS.length).toBe(10);
    expect(IFF_LAYERS[0]).toBe("sky");
    expect(IFF_LAYERS[IFF_LAYERS.length - 1]).toBe("hud");
    const at = (k: string): number => IFF_LAYERS.indexOf(k as (typeof IFF_LAYERS)[number]);
    expect(at("heroes")).toBeGreaterThan(at("pools-kit-gems"));
    expect(at("particles")).toBeGreaterThan(at("heroes"));
    expect(at("arrows-ring")).toBeGreaterThan(at("particles"));
  });
});

describe("动效时序表(四·补三)", () => {
  it("毫秒数写死成常量,一个不许飘", () => {
    expect(FLAME_BOB_MS).toBe(600);
    expect(FLAME_PHASE_MS).toBe(300);
    expect(SCARF_FRAMES).toBe(2);
    expect(LAVA_BUBBLE_MS).toBe(2000);
    expect(LAVA_SHEEN_MS).toBe(3200);
    expect(GEM_SPIN_MS).toBe(1800);
    expect(GATE_DUST_MS).toBe(280);
    expect(GATE_DUST_PUFFS).toBe(2);
    expect(FLAG_WAVE_MS).toBe(900);
    expect(ICE_JUMP_STRETCH).toBe(0.08);
    expect(FIRE_GLOW_BLUR).toBe(4);
    expect(HERO_SHADOW).toEqual({ w: 0.75, h: 0.2 });
    expect(FIRE_JUMP_SQUASH[0]).toBeGreaterThan(1);
    expect(FIRE_JUMP_SQUASH[1]).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 二、剪影与可区分性
// ---------------------------------------------------------------------------

describe("heroSilhouette 双参数", () => {
  it("ice 与 fire 都能在 2D 桩上把路径画完,不抛错", () => {
    for (const kind of ["ice", "fire"] as const) {
      expect(() => heroSilhouette(ctx2d(), kind, 20, 20, 10)).not.toThrow();
      expect(() => heroSilhouette(ctx2d(), kind, 20, 20, 10, ICE_JUMP_STRETCH)).not.toThrow();
    }
  });

  it("两剪影路径点集不相等(抽样 12 点至少 8 点不同)", () => {
    const a = silhouettePoints("ice", 12);
    const b = silhouettePoints("fire", 12);
    expect(a.length).toBe(12);
    let differ = 0;
    for (let i = 0; i < 12; i++) {
      if (Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y) > 0.05) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(8);
  });

  it("16px 灰度三通道的形状底账:水滴对称、火苗尖端右偏且整体不对称", () => {
    expect(silhouetteApex("ice").x).toBe(0);
    expect(silhouetteApex("fire").x).not.toBe(0);
    const sumX = (kind: "ice" | "fire"): number =>
      silhouettePoints(kind, 12).reduce((s, p) => s + p.x, 0);
    expect(Math.abs(sumX("ice"))).toBeLessThan(0.01);
    expect(Math.abs(sumX("fire"))).toBeGreaterThan(0.5);
  });

  it("跳跃时凛凛尾端拉长 8%:只动尖端纵坐标,身宽一个数不变", () => {
    const rest = heroSilhouetteSegments("ice", 0);
    const jump = heroSilhouetteSegments("ice", ICE_JUMP_STRETCH);
    expect(rest.start[1]).toBeCloseTo(-1.3, 5);
    expect(jump.start[1]).toBeCloseTo(-1.3 * (1 + ICE_JUMP_STRETCH), 5);
    const widest = (spec: ReturnType<typeof heroSilhouetteSegments>): number =>
      Math.max(...spec.curves.map((c) => Math.abs(c[4])));
    expect(widest(jump)).toBe(widest(rest));
  });
});

describe("头饰 / 附件四分支(雪晶 / 火簇 / 围巾 / 腰带)", () => {
  it("凛凛:雪晶发饰 + 围巾 + 冰棱反光 + rim light,不带火件", () => {
    const parts = drawHeroFigure(ctx2d(), figureOpts("ice"));
    for (const p of ["shadow", "silhouette", "gradient", "snow-sprig", "scarf", "ice-shards", "rim"]) {
      expect(parts, `凛凛缺了 ${p}`).toContain(p);
    }
    for (const p of ["flame-tuft", "belt", "glow", "foot-glow", "brow"]) {
      expect(parts, `凛凛不该有 ${p}`).not.toContain(p);
    }
  });

  it("焰焰:火簇发型 + 腰带 + 脚下光斑 + 挑眉,不带冰件", () => {
    const parts = drawHeroFigure(ctx2d(), figureOpts("fire"));
    for (const p of ["shadow", "silhouette", "gradient", "flame-tuft", "belt", "foot-glow", "brow"]) {
      expect(parts, `焰焰缺了 ${p}`).toContain(p);
    }
    for (const p of ["snow-sprig", "scarf", "ice-shards", "rim"]) {
      expect(parts, `焰焰不该有 ${p}`).not.toContain(p);
    }
  });
});

describe("焰焰 glow(shadowBlur 断言)", () => {
  it("非 reduced 才开,blur = 4;reduced 与凛凛永远不开", () => {
    const on = new SpyCtx();
    const parts = drawHeroFigure(on as unknown as CanvasRenderingContext2D, figureOpts("fire"));
    expect(parts).toContain("glow");
    expect(on.maxShadowBlur).toBe(FIRE_GLOW_BLUR);

    const off = new SpyCtx();
    const reducedParts = drawHeroFigure(
      off as unknown as CanvasRenderingContext2D,
      figureOpts("fire", { reduced: true })
    );
    expect(reducedParts).not.toContain("glow");
    expect(off.maxShadowBlur).toBe(0);

    const ice = new SpyCtx();
    drawHeroFigure(ice as unknown as CanvasRenderingContext2D, figureOpts("ice"));
    expect(ice.maxShadowBlur).toBe(0);
  });
});

describe("跳跃形变只包 save/restore", () => {
  it("两位主角跳跃时 save 与 restore 笔笔配平,输入冻结也画得完", () => {
    for (const kind of ["ice", "fire"] as const) {
      const spy = new SpyCtx();
      const opts = Object.freeze(figureOpts(kind, { jumping: true, moving: true, leanX: 1 }));
      const parts = drawHeroFigure(spy as unknown as CanvasRenderingContext2D, opts);
      expect(spy.saves, `${kind} save/restore 不配平`).toBe(spy.restores);
      expect(parts).toContain(kind === "ice" ? "stretch" : "squash");
    }
  });

  it("不跳的时候不形变", () => {
    expect(drawHeroFigure(ctx2d(), figureOpts("ice"))).not.toContain("stretch");
    expect(drawHeroFigure(ctx2d(), figureOpts("fire"))).not.toContain("squash");
  });
});

// ---------------------------------------------------------------------------
// 三、reduced:能停的全停,生成数为 0
// ---------------------------------------------------------------------------

describe("reduced 行为", () => {
  it("岩浆气泡与宝石闪点在 reduced 下生成数为 0,非 reduced 按表生成", () => {
    expect(lavaBubbles(7, 1234, true).length).toBe(0);
    expect(gemSparks(1234, 7, true).length).toBe(0);
    const bubbles = lavaBubbles(7, 1234, false);
    expect(bubbles.length).toBe(2);
    for (const b of bubbles) {
      expect(b.u).toBeGreaterThan(0);
      expect(b.u).toBeLessThan(1);
      expect(b.alpha).toBeGreaterThanOrEqual(0);
      expect(b.alpha).toBeLessThanOrEqual(1);
    }
    expect(gemSparks(1234, 7, false).length).toBe(1);
  });

  it("流动高光 reduced 是静止条,火苗围巾旗帜全部停摆", () => {
    expect(lavaSheenPhase(800, true)).toBe(lavaSheenPhase(2400, true));
    expect(lavaSheenPhase(800, false)).not.toBe(lavaSheenPhase(2400, false));
    for (const i of [0, 1, 2]) expect(flameBob(150, i, true)).toBe(0);
    expect(scarfFrame(SCARF_FRAME_MS, true, true)).toBe(0);
    expect(flagWave(FLAG_WAVE_MS / 4, true)).toBe(0);
    expect(flagWave(FLAG_WAVE_MS / 4, false)).not.toBe(0);
  });

  it("火苗三簇相位差 0.3s,围巾走路两帧交替", () => {
    expect(flameBob(150, 0, false)).toBeCloseTo(1, 5);
    expect(flameBob(150, 1, false)).toBeCloseTo(-1, 5);
    expect(scarfFrame(0, true, false)).toBe(0);
    expect(scarfFrame(SCARF_FRAME_MS, true, false)).toBe(1);
    expect(scarfFrame(SCARF_FRAME_MS * 2, true, false)).toBe(0);
    expect(scarfFrame(SCARF_FRAME_MS, false, false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 四、只读断言:视差比例与摄像机
// ---------------------------------------------------------------------------

describe("功能数值只读", () => {
  it("三层视差比例 0.18 / 0.34 / 0.55 不变", () => {
    expect([...IFF_PARALLAX_DEPTHS]).toEqual([0.18, 0.34, 0.55]);
  });

  it("CAMERA 常量一个数没动(1.1 第 8 步与 1.2 第 16 步的镜头)", () => {
    expect(CAMERA.MIN_SCALE).toBe(0.6);
    expect(CAMERA.MAX_SCALE).toBe(1);
    expect(CAMERA.MARGIN_CELLS).toBe(1.6);
    expect(CAMERA.FOLLOW_PER_SEC).toBe(6);
    expect(CAMERA.ARROW_INSET_PX).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// 五、功能件保留:小云朵与虚线圈
// ---------------------------------------------------------------------------

describe("功能件保留", () => {
  it("借位小云朵分支仍可用:四团云 + 眯眯眼 + 腮红,画得出来", () => {
    const ctx = new FakeCtx();
    const parts = drawCloudBuddy(ctx as unknown as CanvasRenderingContext2D, 20, 20, 10, "#4FA8D8");
    expect(parts).toContain("puffs");
    expect(parts).toContain("sleepy-eyes");
    expect(parts).toContain("blush");
    expect(ctx.ops.filter((o) => o.op === "arc").length).toBeGreaterThanOrEqual(8);
  });

  it("当前控制角色的虚线圈保留:半径 1.42 倍、虚线节奏原样", () => {
    expect(CONTROL_RING).toEqual({ radius: 1.42, dashOn: 0.1, dashOff: 0.09 });
    const ctx = new FakeCtx();
    drawControlRing(ctx as unknown as CanvasRenderingContext2D, 20, 20, 10, "#4FA8D8", 30);
    const dashes = ctx.ops.filter((o) => o.op === "setLineDash" && o.args.length > 0);
    expect(dashes.length).toBe(1);
    expect(dashes[0].args).toEqual([30 * 0.1, 30 * 0.09]);
    const ring = ctx.ops.find((o) => o.op === "arc" && Math.abs(o.args[2] - 14.2) < 1e-9);
    expect(ring, "没画出 1.42 倍半径的虚线圈").toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 六、装饰层饱和度 ≤ 主体层 70%
// ---------------------------------------------------------------------------

describe("装饰不抢主体", () => {
  it("森林三层 token 的饱和度都压在双主角主体色 70% 以下", () => {
    const bodyFloor = Math.min(
      saturationOf(IFF_COLORS.iffIceBody),
      saturationOf(IFF_COLORS.iffFireBody)
    );
    for (const tone of [IFF_COLORS.iffForestFar, IFF_COLORS.iffForestMid, IFF_COLORS.iffForestNear]) {
      expect(saturationOf(tone), `${tone} 太抢戏`).toBeLessThanOrEqual(bodyFloor * 0.7);
    }
  });
});

// ---------------------------------------------------------------------------
// 七、尘土账本与 destroy 归零
// ---------------------------------------------------------------------------

describe("开门尘土账本", () => {
  it("false→true 撒两缕,到点划账;reduced 一缕不生成;reset 一笔不剩", () => {
    const fx = new IffDustFx();
    fx.noteGate(9, false, 1, 1, 0, false);
    fx.noteGate(9, true, 1, 1, 100, false);
    expect(fx.pending).toBe(GATE_DUST_PUFFS);
    fx.step(100 + GATE_DUST_MS + 1);
    expect(fx.pending).toBe(0);

    const quiet = new IffDustFx();
    quiet.noteGate(9, false, 1, 1, 0, true);
    quiet.noteGate(9, true, 1, 1, 100, true);
    expect(quiet.pending).toBe(0);

    const dirty = new IffDustFx();
    dirty.noteGate(3, false, 0, 0, 0, false);
    dirty.noteGate(3, true, 0, 0, 50, false);
    expect(dirty.pending).toBeGreaterThan(0);
    dirty.reset();
    expect(dirty.pending).toBe(0);
  });

  it("第一次见到就开着的门不撒(没有「开门」这个动作)", () => {
    const fx = new IffDustFx();
    fx.noteGate(5, true, 1, 1, 0, false);
    expect(fx.pending).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 八、真挂载:一帧画得出来、HUD 头像有笔迹、destroy 归零
// ---------------------------------------------------------------------------

interface Mounted {
  destroy: () => void;
  openCampaignLevel: (n: number) => number;
}

async function mountGame(h: Harness): Promise<Mounted> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: (n: number) => n,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
  } as never) as unknown as Mounted;
}

describe("真挂载渲染", () => {
  it("挂起一关跑三帧:棋盘画布有笔迹、HUD 双人头像画布也有笔迹", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(3);
    const canvases = h.root.querySelectorAll("canvas");
    const board = canvases.find((c) => c.getAttribute("role") === "img");
    expect(board, "棋盘画布没挂上").toBeTruthy();
    expect(board!.getContext("2d")!.ops.length).toBeGreaterThan(0);
    const faces = findAll(h.root, "iff-duo-face");
    expect(faces.length).toBe(2);
    for (const face of faces) {
      expect(face.getContext("2d")!.ops.length, "迷你头像没画").toBeGreaterThan(0);
    }
    game.destroy();
  });

  it("destroy 后 rAF 与计时全部归零(新加的粒子层也一笔不剩)", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    game.openCampaignLevel(3);
    h.flush(5);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
  });

  it("drawMiniHero 两位都画得出来,不抛错", () => {
    for (const kind of ["ice", "fire"] as const) {
      expect(() => drawMiniHero(ctx2d(), kind, 48)).not.toThrow();
    }
  });
});
