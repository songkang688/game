/**
 * 飞机小队 1.3 · 视觉升级用例(只增不减,对齐 step 第九节)。
 *
 * 玩法断言一条没动:这里只看配色板、图层序、剪影几何、动效常量、
 * reduced 行为与 destroy 归零 —— 全是「皮肤」,判定与弹幕的口径仍由
 * sky12.test.ts / runtime12.test.ts 把守。
 */
import { afterEach, describe, expect, it } from "vitest";
import { FakeCtx, findOne, install, type FakeEl, type Harness } from "./domStub";
import {
  CLOUD_BASE_SPEED,
  CLOUD_PARALLAX,
  FLAME,
  LAYER_ORDER,
  LOW_CLOUD_ALPHA,
  SHADOW,
  SKS_DECOR,
  SKS_PALETTE,
  SPIN_SMOKE_MS,
  TILT,
  TRAIL_FADE_FRAMES,
  TRAIL_STEP_S,
  WING_LIGHT_PERIOD_MS,
  WINGMAN_SCALE,
  cueGlowAlpha,
  foeArt,
  planePath,
  segExtent,
  shadowScaleAt,
  tiltScaleX,
  tracePath,
  wingLights,
  type ArtSeg,
} from "./art";
import { CORE_DOT_R, PLAYER_HIT_R, PLAYER_ROW, SKY_H, SKY_W, compileDecl } from "./bullets";
import { FOE_INFO, type FoeKind } from "./logic";
import { BOSSES, type FoeWave } from "./levels";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

async function openSortie(
  h: Harness,
  over: Partial<Parameters<typeof import("./index").createSortie>[0]> = {}
): Promise<ReturnType<typeof import("./index").createSortie>> {
  const mod = await import("./index");
  return mod.createSortie({
    host: h.root as unknown as HTMLElement,
    players: 1,
    tint: "#EAF2FF",
    hint: "视觉用例航线",
    waves: [],
    boss: null,
    pickups: [],
    sfx: () => {},
    onFinish: () => {},
    ...over,
  } as never);
}

const COLOR_RE = /^(#[0-9A-Fa-f]{6}|rgba\(\d+,\d+,\d+,(0|1|0?\.\d+)\))$/;

// ---------------------------------------------------------------------------
// 一、配色板 / 图层序 / 视差档位(step 第九节 1–2)
// ---------------------------------------------------------------------------

describe("sky-squad 1.3 视觉 · 常量块", () => {
  it("palette 九个 token 全部合法,且与四·补一表逐项一致", () => {
    expect(SKS_PALETTE).toEqual({
      sksSkyTop: "#BDE3FF",
      sksSkyBottom: "#E8F6FF",
      sksCloudHi: "rgba(255,255,255,.28)",
      sksCloudMid: "#FFFFFF",
      sksPlanePink: "#F4859F",
      sksPlaneBlue: "#7FB2F0",
      sksFlameIn: "#FFF4C2",
      sksFlameOut: "#FFB36B",
      sksShadow: "rgba(70,90,120,.12)",
    });
    const loose = /^(#[0-9A-Fa-f]{6}|rgba\([\d ,.]+\))$/;
    for (const v of Object.values(SKS_PALETTE)) expect(v, v).toMatch(loose);
    for (const v of Object.values(SKS_DECOR)) expect(v, v).toMatch(loose);
    expect(SKS_PALETTE.sksPlanePink).toMatch(COLOR_RE);
  });

  it("三档视差 0.2 / 0.5 / 0.9,图层序 ①–⑨ 从天空到画布 HUD", () => {
    expect(CLOUD_PARALLAX).toEqual({ hi: 0.2, mid: 0.5, low: 0.9 });
    expect(CLOUD_BASE_SPEED).toBeGreaterThan(0);
    expect(LAYER_ORDER).toEqual([
      "sky",
      "cloudHi",
      "cloudMid",
      "cloudLow",
      "foes",
      "shots",
      "planes",
      "puffs",
      "hud",
    ]);
    // 云都画在敌我单位之前,主机层在弹层之后,判定核心永远不会被云盖住
    expect(LAYER_ORDER.indexOf("cloudLow")).toBeLessThan(LAYER_ORDER.indexOf("foes"));
    expect(LAYER_ORDER.indexOf("planes")).toBeGreaterThan(LAYER_ORDER.indexOf("shots"));
    // 360px 红线:低层云透明度 ≤ 0.5,不遮弹幕
    expect(LOW_CLOUD_ALPHA).toBeLessThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// 二、剪影几何:主机 / 僚机 / 敌机(step 第九节 3–5)
// ---------------------------------------------------------------------------

function flatCoords(segs: readonly ArtSeg[]): number[] {
  const out: number[] = [];
  for (const s of segs) {
    if (s.kind === "move" || s.kind === "line") out.push(s.x, s.y);
    else if (s.kind === "curve") out.push(s.c1x, s.c1y, s.c2x, s.c2y, s.x, s.y);
    else if (s.kind === "ellipse") out.push(s.x, s.y, s.rx, s.ry);
  }
  return out;
}

describe("sky-squad 1.3 视觉 · 剪影", () => {
  it("planePath(0.55) 复用主机路径:点数一致、坐标等比,翼展仍是 ±36", () => {
    expect(WINGMAN_SCALE).toBe(0.55);
    const main = planePath(1, 0);
    const wing = planePath(WINGMAN_SCALE, 0);
    for (const key of ["body", "wingL", "wingR", "finL", "finR"] as const) {
      expect(wing[key].length, key).toBe(main[key].length);
      const a = flatCoords(main[key]);
      const b = flatCoords(wing[key]);
      expect(b.length).toBe(a.length);
      for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i] * WINGMAN_SCALE, 6);
    }
    // 翼展 = 原来那对机翼椭圆的外缘(±36),PLANE_ART 的判定口径没变
    expect(segExtent(main.wingR)).toBe(36);
    expect(segExtent(main.wingL)).toBe(36);
  });

  it("粉 / 蓝两架剪影双通道区分:翼形与尾翼坐标不同,结构相同", () => {
    const pink = planePath(1, 0);
    const blue = planePath(1, 1);
    expect(JSON.stringify(pink.wingR)).not.toBe(JSON.stringify(blue.wingR));
    expect(JSON.stringify(pink.finR)).not.toBe(JSON.stringify(blue.finR));
    // 结构一致(同样的工序数),灰度下靠形状而不是颜色区分
    expect(pink.wingR.length).toBe(blue.wingR.length);
    expect(pink.finR.length).toBe(blue.finR.length);
  });

  it("四种敌机新剪影两两不同、各有受光面,在 2D 桩上一笔画完不抛错", () => {
    const kinds: FoeKind[] = ["scout", "puff", "kite", "tanker"];
    const dumped = new Set<string>();
    const ctx = new FakeCtx() as unknown as CanvasRenderingContext2D;
    for (const kind of kinds) {
      const parts = foeArt(kind, 16);
      expect(parts.length, kind).toBeGreaterThanOrEqual(3);
      expect(parts.some((p) => p.role === "light"), `${kind} 没有受光面`).toBe(true);
      expect(parts.some((p) => p.role === "base"), `${kind} 没有基底剪影`).toBe(true);
      for (const part of parts) expect(() => tracePath(ctx, part.segs)).not.toThrow();
      dumped.add(JSON.stringify(parts));
    }
    expect(dumped.size).toBe(4);
  });

  it("敌机绘制仍以原 info.r 为界:判定半径没动,几何全部落在半径内", () => {
    // 这些是 1.2 的判定半径,一个数都不许变
    expect(FOE_INFO.scout.r).toBe(16);
    expect(FOE_INFO.puff.r).toBe(21);
    expect(FOE_INFO.kite.r).toBe(18);
    expect(FOE_INFO.tanker.r).toBe(28);
    for (const kind of ["scout", "puff", "kite", "tanker"] as const) {
      const r = FOE_INFO[kind].r;
      for (const part of foeArt(kind, r)) {
        expect(segExtent(part.segs), `${kind} 越界`).toBeLessThanOrEqual(r);
      }
      // 加上 1.5px 描边,包围盒也不超过 2r + 描边
      const widest = Math.max(...foeArt(kind, r).map((p) => segExtent(p.segs)));
      expect(widest * 2 + 1.5).toBeLessThanOrEqual(2 * r + 3);
    }
  });

  it("四种敌机带弹幕跑起来,新剪影一帧一帧画不炸", async () => {
    const h = (harness = install());
    const wave: FoeWave = {
      kinds: ["scout", "puff", "kite", "tanker"],
      count: 4,
      formation: "line",
      speed: 1,
      fire: compileDecl({ pattern: "rain", count: 2 }),
      fireGap: 2.5,
    };
    const sortie = await openSortie(h, { waves: [wave] });
    h.flush(40);
    expect(sortie.snapshot().foes).toBeGreaterThan(0);
    sortie.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、动效常量与纯函数(step 第九节 7–9 + 四·补三)
// ---------------------------------------------------------------------------

describe("sky-squad 1.3 视觉 · 动效", () => {
  it("判定核心的常量原样:CORE_DOT_R=6、判定半径 9,核心不大于判定圆", () => {
    expect(CORE_DOT_R).toBe(6);
    expect(PLAYER_HIT_R).toBe(9);
    expect(CORE_DOT_R).toBeLessThanOrEqual(PLAYER_HIT_R);
  });

  it("尾焰:内焰 = 外焰 0.6 倍,抖动参数与 1.2 一字不差", () => {
    expect(FLAME.innerScale).toBe(0.6);
    // 1.2 的尾焰是 Math.sin(clock * 24) * 4、基长 12,原样搬进常量块
    expect(FLAME.jitterHz).toBe(24);
    expect(FLAME.jitterAmp).toBe(4);
    expect(FLAME.baseLen).toBe(12);
  });

  it("飞机投影:0.12 透明度,y 越低影子越大且夹在 0.8–1.15", () => {
    expect(SHADOW.alpha).toBe(0.12);
    expect(shadowScaleAt(0)).toBeCloseTo(0.8, 6);
    expect(shadowScaleAt(SKY_H)).toBeCloseTo(1.15, 6);
    expect(shadowScaleAt(SKY_H / 2)).toBeGreaterThan(shadowScaleAt(SKY_H / 4));
    // 越界也夹住
    expect(shadowScaleAt(-100)).toBeCloseTo(0.8, 6);
    expect(shadowScaleAt(SKY_H * 3)).toBeCloseTo(1.15, 6);
    expect(SHADOW.scaleMin).toBe(0.8);
    expect(SHADOW.scaleMax).toBe(1.15);
  });

  it("翼灯 800ms 左红右绿交替;reduced 双灯常亮", () => {
    expect(WING_LIGHT_PERIOD_MS).toBe(800);
    expect(wingLights(0, false)).toEqual({ left: true, right: false });
    expect(wingLights(399, false)).toEqual({ left: true, right: false });
    expect(wingLights(400, false)).toEqual({ left: false, right: true });
    expect(wingLights(799, false)).toEqual({ left: false, right: true });
    expect(wingLights(800, false)).toEqual({ left: true, right: false });
    expect(wingLights(123, true)).toEqual({ left: true, right: true });
  });

  it("侧倾:120ms 跟随、scaleX 压到 0.82、内侧机翼抬 3px,映射两头夹紧", () => {
    expect(TILT.followMs).toBe(120);
    expect(TILT.scaleXMin).toBe(0.82);
    expect(TILT.wingLiftPx).toBe(3);
    expect(tiltScaleX(0)).toBe(1);
    expect(tiltScaleX(1)).toBeCloseTo(0.82, 6);
    expect(tiltScaleX(-1)).toBeCloseTo(0.82, 6);
    expect(tiltScaleX(9)).toBeCloseTo(0.82, 6);
    expect(tiltScaleX(0.5)).toBeCloseTo(0.91, 6);
  });

  it("敌弹拖尾 3 帧、打转烟圈 360ms,蓄力红晕随 cue 渐亮", () => {
    expect(TRAIL_FADE_FRAMES).toBe(3);
    expect(TRAIL_STEP_S).toBeCloseTo(1 / 60, 9);
    expect(SPIN_SMOKE_MS).toBe(360);
    // cueLeft 越接近 0 红晕越亮;预告一结束立刻归零
    expect(cueGlowAlpha(2, 2)).toBeGreaterThan(0);
    expect(cueGlowAlpha(1, 2)).toBeGreaterThan(cueGlowAlpha(2, 2));
    expect(cueGlowAlpha(0.1, 2)).toBeGreaterThan(cueGlowAlpha(1, 2));
    expect(cueGlowAlpha(0, 2)).toBe(0);
    expect(cueGlowAlpha(-1, 2)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 四、运行时:核心兜底 / 侧倾包裹 / reduced / destroy(step 第九节 6–7、10–11)
// ---------------------------------------------------------------------------

describe("sky-squad 1.3 视觉 · 运行时", () => {
  it("判定核心的像素兜底原样:白环半径 = max(CORE_DOT_R, 5/viewScale),亮心 0.62 倍", async () => {
    const h = (harness = install());
    const stage = h.root as unknown as FakeEl;
    stage.dataset.clip = "1";
    stage.rect = { left: 0, top: 0, width: 340, height: 260 };
    stage.clientWidth = 340;
    const sortie = await openSortie(h);
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    const ctx = canvas.getContext("2d") as unknown as FakeCtx;
    ctx.ops.length = 0;
    h.flush(1);
    const scale = ctx.ops.find((o) => o.op === "scale")?.args[0] ?? 0;
    expect(scale).toBeGreaterThan(0);
    const want = Math.max(CORE_DOT_R, 5 / scale);
    const core = ctx.ops
      .filter((o) => o.op === "arc" && o.args[0] === 0 && o.args[1] === 0)
      .map((o) => o.args[2])
      .sort((a, b) => a - b);
    expect(core.length).toBe(2);
    expect(core[1]).toBeCloseTo(want, 6);
    expect(core[0]).toBeCloseTo(want * 0.62, 6);
    sortie.destroy();
  });

  it("侧倾的 scaleX 只包在 save/restore 里;world 坐标一步一步全是逻辑说了算", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h);
    h.flush(2);
    expect(sortie.snapshot().pilots[0].x).toBeCloseTo(SKY_W / 2, 6);
    h.key("keydown", "KeyD");
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    const ctx = canvas.getContext("2d") as unknown as FakeCtx;
    h.flush(5);
    ctx.ops.length = 0;
    h.flush(1);
    h.key("keyup", "KeyD");
    // world 坐标:每帧 16ms × 250px/s = 4px,6 帧就是 24px,一像素不多不少
    const p = sortie.snapshot().pilots[0];
    expect(p.x).toBeCloseTo(SKY_W / 2 + 4 * 6, 6);
    expect(p.y).toBe(PLAYER_ROW);
    // 绘制层直接用 world 坐标 translate,没有自己另算一套
    const translated = ctx.ops.some(
      (o) => o.op === "translate" && Math.abs(o.args[0] - p.x) < 1e-6 && Math.abs(o.args[1] - p.y) < 1e-6
    );
    expect(translated).toBe(true);
    // 侧倾产生的非等比 scaleX 出现了,而且每一次都在 save 深度 ≥ 2 的括号里
    let depth = 0;
    let tilted = 0;
    let minDepth = Infinity;
    for (const o of ctx.ops) {
      if (o.op === "save") depth++;
      else if (o.op === "restore") depth--;
      else if (o.op === "scale" && o.args[0] !== o.args[1]) {
        tilted++;
        minDepth = Math.min(minDepth, depth);
        expect(o.args[0]).toBeGreaterThanOrEqual(TILT.scaleXMin);
        expect(o.args[0]).toBeLessThan(1);
        expect(o.args[1]).toBe(1);
      }
    }
    expect(tilted).toBeGreaterThan(0);
    expect(minDepth).toBeGreaterThanOrEqual(2);
    // 括号收平:save 与 restore 一一配对
    expect(depth).toBe(0);
    sortie.destroy();
  });

  it("reduced:视差速度 0、星屑 0、翼灯常亮;蓄力红晕这类功能提示原样保留", async () => {
    const h = (harness = install());
    // 对照组:平时云是真的在滚
    const loud = await openSortie(h);
    h.flush(30);
    expect(loud.snapshot().deco.cloudScroll).toBeGreaterThan(0);
    loud.destroy();

    h.setReducedMotion(true);
    const calm = await openSortie(h, { boss: BOSSES[1] });
    expect(calm.snapshot().calm).toBe(true);
    h.key("keydown", "KeyA");
    for (let i = 0; i < 120; i++) {
      h.flush(1);
      const deco = calm.snapshot().deco;
      expect(deco.cloudScroll).toBe(0);
      expect(deco.sparkles).toBe(0);
    }
    h.key("keyup", "KeyA");
    // 翼灯常亮、红晕照旧:reduced 关掉的是花活,不是功能提示
    expect(wingLights(12345, true)).toEqual({ left: true, right: true });
    expect(cueGlowAlpha(1, 2)).toBeGreaterThan(0);
    calm.destroy();
  });

  it("destroy 之后云层滚动器、rAF、星屑、烟圈全部归零", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { boss: BOSSES[2] });
    h.key("keydown", "KeyA");
    h.flush(90);
    h.key("keyup", "KeyA");
    const busy = sortie.snapshot().deco;
    expect(busy.cloudScroll).toBeGreaterThan(0);
    expect(busy.sparkles).toBeGreaterThan(0);
    sortie.destroy();
    const after = sortie.snapshot();
    expect(after.deco).toEqual({ cloudScroll: 0, sparkles: 0, rings: 0 });
    expect(h.pendingFrames()).toBe(0);
    expect(after.footprint).toBe(0);
  });

  it("HUD 卡片化:圆角 12px、白 72% 底、1.5px 描边,一行布局与 14px 底线不丢", async () => {
    const mod = await import("./index");
    expect(mod.CSS).toContain("border-radius:12px");
    expect(mod.CSS).toContain("rgba(255,255,255,.72)");
    expect(mod.CSS).toContain("1.5px solid");
    // 1.2 的两条底线顺手复核:HUD 不换行、字号 ≥ 14px
    expect(mod.CSS).toContain("flex-wrap:nowrap");
    const sizes = [...mod.CSS.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  });
});
