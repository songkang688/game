/**
 * 噗噗兄弟 · 1.3 视觉用例(只增不减)。
 *
 * 钉四类东西:
 *   1. 配色板 token 与规格四·补一逐个一致,图层序、时序表不许飘;
 *   2. 兄弟可区分性:broBody 两套参数产出不同剪影(抽样 ≥ 8 点)、
 *      六识别件分支都在、两套画法的调用序列真的不一样;
 *   3. 玩法红线只读:形变三件套 0 / 0.5 / 1 三点、`PUFF_WINDUP`、
 *      判定盒 `PLAYER_W × PLAYER_H`、吹泡窗口读 `blowCd`;
 *   4. reduced 行为:星尘 0、云视差 0、摆动 0、击掌静止合影、主画布零 scale。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  BRO_KITS,
  CLOUD_FACTORS,
  HIGH_FIVE_FRAME_MS,
  HIGH_FIVE_FRAMES,
  PB_BLOW_BUBBLE_MIN,
  PB_COLORS,
  PB_LAYERS,
  PB_SKIES,
  PB_WARP_A,
  PB_WARP_B,
  RING_SPARK_COUNT,
  RING_SPARK_MS,
  SPRING_COILS,
  SWAY_MS,
  broBody,
  cloudScroll,
  highFiveFrame,
  invertHex,
  mouthState,
  paintBro,
  paintPuffRing,
  ringSparkAngle,
  ringSparkCount,
  shouldHighFive,
  skyForLevel,
  springCoilYs,
  swayAngle,
} from "./visual13";
import { hexToRgb } from "../../art/kit/palette";
import { BUBBLE_RIM_MIN_R, rimVisible, sheenAngle } from "../../art/kit/bubbleSkin";
import { SQUASH_AMOUNT, SQUASH_TIME, newJumpFeel, squashScale as landingSquash } from "./feel";
import { PUFF_SQUISH_TIME, PUFF_WINDUP, newPuffState, squishScale as pushSquish } from "./push";
import { TUMBLE_TIME, newBounds, tumbleProgress } from "./bounds";
import { BLOW_CD, BUBBLE_R, PLAYER_H, PLAYER_W } from "./logic";
import { findAll, findButton, install, type Harness } from "./domStub";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

/** 万能记录桩:随便什么画笔方法都记下来(纯画笔函数专用) */
function recCtx(): { ctx: CanvasRenderingContext2D; calls: Array<[string, unknown[]]> } {
  const calls: Array<[string, unknown[]]> = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return (...a: unknown[]) => {
          calls.push([prop, a]);
          return { addColorStop: (...s: unknown[]) => void calls.push(["addColorStop", s]) };
        };
      }
      if (prop in t) return t[prop];
      return (...a: unknown[]) => void calls.push([prop, a]);
    },
    set(t, prop: string, v) {
      t[prop] = v;
      calls.push([`set:${prop}`, [v]]);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

function names(calls: Array<[string, unknown[]]>): string[] {
  return calls.map(([n]) => n);
}

async function mountGame(h: Harness, extra: Record<string, unknown> = {}) {
  const mod = await import("./index");
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: (n: number) => n,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    ...extra,
  } as never) as unknown as { destroy: () => void; openCampaignLevel: (n: number) => number };
  return game;
}

// ---------------------------------------------------------------------------
// 一、配色板与图层序
// ---------------------------------------------------------------------------

describe("puff-bros 1.3 视觉 · 配色板与图层序", () => {
  it("1. 配色 token 与四·补一表逐个一致,且十六进制全部合法", () => {
    expect(PB_COLORS.pbBroA).toBe("#F9B97F");
    expect(PB_COLORS.pbBroB).toBe("#FBD3A5");
    expect(PB_COLORS.pbBelly).toBe("#FFF3E2");
    expect(PB_COLORS.pbBubble).toBe("rgba(190,230,255,.55)");
    expect(PB_COLORS.pbSkyMorn).toBe("#FFE9F0");
    expect(PB_COLORS.pbSkyDay).toBe("#E3F3FF");
    expect(PB_COLORS.pbSkyDusk).toBe("#FFE3C9");
    expect(PB_COLORS.pbShadow).toBe("rgba(120,90,60,.16)");
    // hex 合法:hexToRgb 不会退回中性灰
    for (const c of [PB_COLORS.pbBroA, PB_COLORS.pbBroB, PB_COLORS.pbBelly]) {
      expect(hexToRgb(c)).not.toEqual([128, 128, 128]);
    }
  });

  it("2. 图层序八层齐:泡泡在兄弟之下,攒气环永远在兄弟之上,HUD 收尾", () => {
    expect(PB_LAYERS).toHaveLength(8);
    expect(PB_LAYERS[0]).toBe("sky");
    expect(PB_LAYERS.indexOf("bubbles")).toBeLessThan(PB_LAYERS.indexOf("bros"));
    expect(PB_LAYERS.indexOf("ring")).toBeGreaterThan(PB_LAYERS.indexOf("bros"));
    expect(PB_LAYERS[PB_LAYERS.length - 1]).toBe("hud");
  });

  it("3. 传送门旋涡双色互为反色", () => {
    expect(PB_WARP_A).toBe("#8FBEF5");
    expect(PB_WARP_B.toUpperCase()).toBe("#70410A");
    expect(invertHex(PB_WARP_B).toUpperCase()).toBe(PB_WARP_A);
    expect(invertHex("#FFFFFF")).toBe("#000000");
  });
});

// ---------------------------------------------------------------------------
// 二、兄弟可区分性
// ---------------------------------------------------------------------------

describe("puff-bros 1.3 视觉 · 兄弟骨架与识别件", () => {
  it("4. broBody 两套参数产出不同剪影:12 个抽样点里至少 8 点可分", () => {
    const a = broBody(0);
    const b = broBody(1);
    expect(a.silhouette).toHaveLength(12);
    expect(b.silhouette).toHaveLength(12);
    let differ = 0;
    for (let i = 0; i < a.silhouette.length; i++) {
      const pa = a.silhouette[i];
      const pb = b.silhouette[i];
      if (Math.abs(pa.x - pb.x) > 0.5 || Math.abs(pa.y - pb.y) > 0.5) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(8);
  });

  it("5. 六识别件分支都在:呆毛/帽、背带裤/围兜、耳朵/揪揪 —— 三通道逐对不同", () => {
    expect(BRO_KITS[0].headgear).toBe("crest");
    expect(BRO_KITS[1].headgear).toBe("cap");
    expect(BRO_KITS[0].outfit).toBe("overalls");
    expect(BRO_KITS[1].outfit).toBe("bib");
    expect(BRO_KITS[0].sidekick).toBe("ears");
    expect(BRO_KITS[1].sidekick).toBe("tuft");
    // 表情参数化:哥哥眼稍小眉平,弟弟眼圆腮红大
    expect(BRO_KITS[0].eyeR).toBeLessThan(BRO_KITS[1].eyeR);
    expect(BRO_KITS[0].browFlat).toBe(true);
    expect(BRO_KITS[1].browFlat).toBe(false);
    expect(BRO_KITS[1].blushR).toBeGreaterThan(BRO_KITS[0].blushR);
    // 身体主色也拉开一档:弟弟更浅
    expect(BRO_KITS[0].body).toBe(PB_COLORS.pbBroA);
    expect(BRO_KITS[1].body).toBe(PB_COLORS.pbBroB);
  });

  it("6. paintBro 两套参数走的是不同的画法,且一次 scale 都不调", () => {
    const pose = { facing: 1 as const, sway: 0, mouth: { kind: "idle" } as const, grounded: true };
    const a = recCtx();
    paintBro(a.ctx, broBody(0), pose);
    const b = recCtx();
    paintBro(b.ctx, broBody(1), pose);
    // 哥哥的呆毛是三段贝塞尔、背带裤是方块;弟弟一条贝塞尔都没有、一块方块也没有
    expect(names(a.calls).filter((n) => n === "bezierCurveTo").length).toBeGreaterThanOrEqual(3);
    expect(names(b.calls).filter((n) => n === "bezierCurveTo")).toHaveLength(0);
    expect(names(a.calls)).toContain("fillRect");
    expect(names(b.calls)).not.toContain("fillRect");
    // 调用序列整体不同(可区分性),而且谁都不许碰 scale
    expect(JSON.stringify(a.calls)).not.toBe(JSON.stringify(b.calls));
    expect(names(a.calls)).not.toContain("scale");
    expect(names(b.calls)).not.toContain("scale");
  });

  it("7. 落影统一规格:0.8×PLAYER_W 宽,两人一致", () => {
    expect(broBody(0).shadow.rx).toBeCloseTo(PLAYER_W * 0.4, 6);
    expect(broBody(1).shadow).toEqual(broBody(0).shadow);
  });
});

// ---------------------------------------------------------------------------
// 三、玩法红线只读(形变三件套 + 判定常量 + 吹泡窗口)
// ---------------------------------------------------------------------------

describe("puff-bros 1.3 视觉 · 玩法红线一字不动", () => {
  it("8. 落地压扁 landingSquash 三点钉死:0 / 半程 0.08 / 满程 0", () => {
    expect(SQUASH_TIME).toBe(0.18);
    expect(SQUASH_AMOUNT).toBe(0.08);
    const f = newJumpFeel();
    f.squashPower = 1;
    f.squash = 0;
    expect(landingSquash(f)).toBe(0);
    f.squash = SQUASH_TIME * 0.5;
    expect(landingSquash(f)).toBeCloseTo(SQUASH_AMOUNT, 6);
    f.squash = SQUASH_TIME;
    expect(landingSquash(f)).toBeCloseTo(0, 6);
  });

  it("9. 被吹扁 pushSquish 三点钉死:0 / 半程 0.16 / 满程 0", () => {
    expect(PUFF_SQUISH_TIME).toBe(0.32);
    const s = newPuffState();
    s.squish = 0;
    expect(pushSquish(s)).toBe(0);
    s.squish = PUFF_SQUISH_TIME * 0.5;
    expect(pushSquish(s)).toBeCloseTo(0.16, 6);
    s.squish = PUFF_SQUISH_TIME;
    expect(pushSquish(s)).toBeCloseTo(0, 6);
  });

  it("10. 打转 tumbleProgress 三点钉死:0 / 0.5 / 1,TUMBLE_TIME 原值", () => {
    expect(TUMBLE_TIME).toBe(1.25);
    const b = newBounds();
    b.phase = "tumble";
    b.tumbleT = 0;
    expect(tumbleProgress(b)).toBe(0);
    b.tumbleT = TUMBLE_TIME * 0.5;
    expect(tumbleProgress(b)).toBeCloseTo(0.5, 6);
    b.tumbleT = TUMBLE_TIME;
    expect(tumbleProgress(b)).toBe(1);
  });

  it("11. 前摇与判定盒只读:PUFF_WINDUP 0.09,PLAYER 26×34,BUBBLE_R 17", () => {
    expect(PUFF_WINDUP).toBe(0.09);
    expect(PLAYER_W).toBe(26);
    expect(PLAYER_H).toBe(34);
    expect(BUBBLE_R).toBe(17);
  });

  it("12. 吹泡两层动画的时序读 blowCd:0.24 窗口原样,分支顺序与 1.2 一致", () => {
    expect(BLOW_CD).toBe(0.4);
    expect(PB_BLOW_BUBBLE_MIN).toBe(0.24);
    // 刚吹出去(blowCd = 0.4):泡泡从 0 开始长
    expect(mouthState(BLOW_CD, 0, false)).toEqual({ kind: "blow", k: 0 });
    // 窗口过半
    const mid = mouthState(0.32, 0, false);
    expect(mid.kind).toBe("blow");
    expect((mid as { k: number }).k).toBeCloseTo(0.5, 6);
    // 窗口收尾长满;吹泡窗口优先于攒气(和 1.2 的 if/else 顺序一致)
    const busy = mouthState(0.25, 0.8, true);
    expect(busy.kind).toBe("blow");
    // 出了窗口:攒气显攒气,闲着显常态
    expect(mouthState(PB_BLOW_BUBBLE_MIN, 0.5, true)).toEqual({ kind: "windup", k: 0.5 });
    expect(mouthState(0, 0, false)).toEqual({ kind: "idle" });
  });
});

// ---------------------------------------------------------------------------
// 四、泡泡薄膜 / 攒气环 / 天空 / 云 / 击掌 / 摆动
// ---------------------------------------------------------------------------

describe("puff-bros 1.3 视觉 · 动效与 reduced", () => {
  it("13. 泡泡彩虹缘在半径 < 6px 自动省略;正泡 BUBBLE_R=17 画得全", () => {
    expect(BUBBLE_RIM_MIN_R).toBe(6);
    expect(rimVisible(5.9)).toBe(false);
    expect(rimVisible(BUBBLE_R)).toBe(true);
    // 嘴边小泡从 4 长到 10:前三分之一不够 6px,彩虹缘不出现
    const rOf = (k: number): number => 4 + k * 6;
    expect(rimVisible(rOf(0))).toBe(false);
    expect(rimVisible(rOf(1))).toBe(true);
  });

  it("14. 攒气环:非 reduced 星尘 3 颗打转,reduced 只留彩虹渐变描边、星尘 0", () => {
    expect(RING_SPARK_COUNT).toBe(3);
    expect(RING_SPARK_MS).toBe(500);
    expect(ringSparkCount(false)).toBe(3);
    expect(ringSparkCount(true)).toBe(0);
    // 500ms 一圈:同一颗星尘转回原角
    expect(ringSparkAngle(0, 0)).toBeCloseTo(ringSparkAngle(0, 500) - Math.PI * 2 * 0, 6);

    const ring = { cx: 100, cy: 80, x0: 80, x1: 120, y0: 60, y1: 100 };
    const on = recCtx();
    paintPuffRing(on.ctx, ring, 0.5, 250, false);
    const off = recCtx();
    paintPuffRing(off.ctx, ring, 0.5, 250, true);
    // 渐变描边两边都在(功能提示 reduced 也不丢)
    expect(names(on.calls)).toContain("createLinearGradient");
    expect(names(off.calls)).toContain("createLinearGradient");
    // 星尘是 fill 出来的菱形:reduced 一颗都没有
    expect(names(on.calls).filter((n) => n === "fill")).toHaveLength(3);
    expect(names(off.calls).filter((n) => n === "fill")).toHaveLength(0);
  });

  it("15. 三套天空与关卡序号的映射:0 晨 / 1 昼 / 2 暮,3 又回到晨", () => {
    expect(PB_SKIES).toEqual([PB_COLORS.pbSkyMorn, PB_COLORS.pbSkyDay, PB_COLORS.pbSkyDusk]);
    expect(skyForLevel(0)).toBe(PB_COLORS.pbSkyMorn);
    expect(skyForLevel(1)).toBe(PB_COLORS.pbSkyDay);
    expect(skyForLevel(2)).toBe(PB_COLORS.pbSkyDusk);
    expect(skyForLevel(3)).toBe(PB_COLORS.pbSkyMorn);
    expect(skyForLevel(187)).toBe(PB_SKIES[187 % 3]);
  });

  it("16. 软云视差:两层 0.15× / 0.3×,近层快一倍;reduced 恒 0;回卷不越界", () => {
    expect(CLOUD_FACTORS).toEqual([0.15, 0.3]);
    const span = 800;
    const far = cloudScroll(0, 10, span, false);
    const near = cloudScroll(1, 10, span, false);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeCloseTo(far * 2, 6);
    expect(cloudScroll(0, 10, span, true)).toBe(0);
    expect(cloudScroll(1, 99999, span, false)).toBeGreaterThanOrEqual(0);
    expect(cloudScroll(1, 99999, span, false)).toBeLessThan(span);
  });

  it("17. 击掌:2 帧 360ms step;reduced 静止合影;只认过关分支", () => {
    expect(HIGH_FIVE_FRAMES).toBe(2);
    expect(HIGH_FIVE_FRAME_MS).toBe(360);
    expect(highFiveFrame(0, false)).toBe(0);
    expect(highFiveFrame(359, false)).toBe(0);
    expect(highFiveFrame(360, false)).toBe(1);
    expect(highFiveFrame(720, false)).toBe(0);
    // reduced:什么时刻问都是相击那一帧(静止合影)
    expect(highFiveFrame(0, true)).toBe(1);
    expect(highFiveFrame(12345, true)).toBe(1);
    // 只在过关分支:lost / playing / 没记时间戳,都不画
    expect(shouldHighFive("won", 100)).toBe(true);
    expect(shouldHighFive("lost", 100)).toBe(false);
    expect(shouldHighFive("playing", 100)).toBe(false);
    expect(shouldHighFive("won", -1)).toBe(false);
  });

  it("18. 呆毛/揪揪摆动:320ms 周期,静止或 reduced 恒 0", () => {
    expect(SWAY_MS).toBe(320);
    expect(swayAngle(123, false, false)).toBe(0);
    expect(swayAngle(123, false, true)).toBe(0);
    expect(swayAngle(123, true, true)).toBe(0);
    const quarter = swayAngle(SWAY_MS * 0.25, true, false);
    expect(Math.abs(quarter)).toBeGreaterThan(0.01);
    expect(swayAngle(80, true, false)).toBeCloseTo(swayAngle(80 + SWAY_MS, true, false), 6);
  });

  it("19. 薄膜月牙与弹簧螺旋:reduced 月牙静止;压缩时同样 4 圈挤得更密", () => {
    expect(sheenAngle(600, true)).toBe(0);
    expect(sheenAngle(600, false)).toBeGreaterThan(0);
    expect(SPRING_COILS).toBe(4);
    const loose = springCoilYs(100, 22, 0);
    const tight = springCoilYs(100, 22, 0.4);
    expect(loose).toHaveLength(4);
    expect(tight).toHaveLength(4);
    const gap = (ys: number[]): number => Math.abs(ys[1] - ys[0]);
    expect(gap(tight)).toBeLessThan(gap(loose));
    // 都从底座往上排
    for (const y of loose) expect(y).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// 五、真挂载:天空轮换 / HUD 徽章 / reduced 零 scale / destroy 归零
// ---------------------------------------------------------------------------

describe("puff-bros 1.3 视觉 · 真挂载", () => {
  function mainCtx(h: Harness) {
    const cv = findAll(h.root, "pfb-cv")[0];
    const ctx = cv?.getContext("2d");
    if (!ctx) throw new Error("主画布没挂上");
    return ctx;
  }

  it("20. 第 1 关画晨色天,第 2 关画昼色天(按关卡序号轮换)", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 1 });
    h.flush(3);
    const ctx = mainCtx(h);
    ctx.ops.length = 0;
    h.flush(1);
    const sky = ctx.ops.find((o) => o.op === "gradient" && (o.stops?.length ?? 0) > 0);
    expect(sky?.stops?.[0]).toBe(PB_COLORS.pbSkyMorn);
    game.destroy();

    const h2 = (harness = install());
    const game2 = await mountGame(h2, { initialLevel: 2 });
    h2.flush(3);
    const ctx2 = mainCtx(h2);
    ctx2.ops.length = 0;
    h2.flush(1);
    const sky2 = ctx2.ops.find((o) => o.op === "gradient" && (o.stops?.length ?? 0) > 0);
    expect(sky2?.stops?.[0]).toBe(PB_COLORS.pbSkyDay);
    game2.destroy();
  });

  it("21. 对战 HUD 挂出两枚头像徽章(程序化小画布,真的画了东西);闯关里收起", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    h.flush(2);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(3);
    const badges = findAll(h.root, "pfb-badge");
    expect(badges).toHaveLength(2);
    for (const b of badges) {
      expect(b.style.display ?? "").not.toBe("none");
      const bctx = b.getContext("2d");
      expect(bctx && bctx.ops.length).toBeGreaterThan(0);
    }
    game.destroy();

    const h2 = (harness = install());
    const game2 = await mountGame(h2, { initialLevel: 1 });
    h2.flush(3);
    for (const b of findAll(h2.root, "pfb-badge")) {
      expect(b.style.display).toBe("none");
    }
    game2.destroy();
  });

  it("22. reduced 下真打一场:主画布零 scale(三件套 + 新动效全关),画面照常在画", async () => {
    const h = (harness = install({ reduceMotion: true }));
    const game = await mountGame(h);
    h.flush(2);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(3);
    const ctx = mainCtx(h);
    h.key("keydown", "KeyD");
    h.key("keydown", "KeyG");
    ctx.ops.length = 0;
    h.flush(60, 16);
    h.key("keyup", "KeyD");
    h.key("keyup", "KeyG");
    expect(ctx.ops.some((o) => o.op === "scale")).toBe(false);
    expect(ctx.ops.length).toBeGreaterThan(100);
    game.destroy();
  });

  it("23. destroy 归零:帧、计时器、window 监听一根不留", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 3 });
    h.flush(6);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    h.runTimers();
    expect(h.pendingTimers()).toBe(0);
  });
});
