/**
 * 王子公主大冒险 · 1.3 视觉升级用例(只增不减,共 14 个)。
 *
 * 管三件事:
 *  1. 常量对表:配色板 token、九层图层序、动效时序表和规格四·补一/补三一字不差;
 *  2. 可区分性:王子 / 公主剪影点集不相等,皇冠 / 蝶结 / 双层裙摆 / 双排扣 / 披纱
 *     五个识别件的几何分支真实存在,而且**真的画上了画布**;
 *  3. 红线:攻击窗口 `attackT` 视觉层只读、无敌闪烁节拍与 1.2 逐拍一致、
 *     判定盒 `HERO_W / HERO_H` 不动、⭐ emoji 的 fillText 清零、
 *     危险标记压在最顶层、reduced 全冻但刃光保留、destroy 后星尘与计时归零。
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { findAll, findButton, findCtx, install, type Harness } from "./domStub";
import { TOTAL_LEVELS } from "../level99";
import { buildLevel } from "./levels";
import { ELEMENT_SPECS } from "./elements";
import { HERO_H, HERO_W, HURT_INVULN, MELEE_TIME } from "./logic";
import { shade, withAlpha } from "../../art/kit/palette";
import {
  BLADE_FLASH_COLOR,
  BLADE_FLASH_MS,
  BLINK_LIFT,
  CAPE_SWAY_FRAMES,
  CAPE_SWAY_MS,
  CROWN_RUBY,
  FLAG_WAVE_FRAMES,
  FLAG_WAVE_MS,
  GEM_BREATH_MS,
  GEM_GLOW_BASE,
  HEADWEAR_MIN_PX,
  HIGHFIVE_MS,
  PP_COLORS,
  PP_LAYERS,
  PRINCESS_CROWN_SCALE,
  PcpFx,
  SHADOW_H_RATIO,
  SHADOW_W_RATIO,
  SHAWL_ALPHA,
  STARDUST_COUNT,
  STARDUST_MS,
  TOP_LIGHT,
  bladeFlashOn,
  blinkLift,
  bowShape,
  buttonPoints,
  capePhase,
  crownPath,
  crownTeethTips,
  flagWavePhase,
  gemGlowAlpha,
  headwearDetail,
  invulnBlink,
  princeSilhouette,
  princessSilhouette,
  shawlFill,
  shawlPath,
  skirtLiningArcs,
  skirtStars,
} from "./visual13";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

interface Mounted {
  destroy: () => void;
  openCampaignLevel: (n: number) => number;
}

async function mountGame(h: Harness): Promise<{ game: Mounted; mod: typeof import("./index") }> {
  const mod = await import("./index");
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: (n: number) => n,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
  } as never) as unknown as Mounted;
  // 「一个人 / 两人」是模块级偏好,先归位免得用例之间串台
  findButton(h.root, "一个人玩")?.fire("click");
  return { game, mod };
}

function srcOf(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

/** 第一关有尖刺的关(1 基) */
function firstSpikeLevel(): number {
  for (let i = 0; i < TOTAL_LEVELS; i++) {
    if (buildLevel(i).spikes.length > 0) return i + 1;
  }
  throw new Error("一关尖刺都没有?");
}

// ---------------------------------------------------------------------------
// 一、配色板与图层序 / 时序表
// ---------------------------------------------------------------------------

describe("配色板与图层序", () => {
  it("① 四·补一的 token 一个不飘,顶光档是 +20%,落影 0.75×0.2", () => {
    expect(PP_COLORS.ppPrince).toBe("#7FB2F0");
    expect(PP_COLORS.ppPrincess).toBe("#F4859F");
    expect(PP_COLORS.ppLining).toBe("#FFF0F6");
    expect(PP_COLORS.ppGold).toBe("#F0C25A");
    expect(PP_COLORS.ppRuby).toBe("#E85D75");
    expect(PP_COLORS.ppCastleFar).toBe("#D8CBEA");
    expect(PP_COLORS.ppCastleMid).toBe("#BFA8DD");
    expect(PP_COLORS.ppShadow).toBe("rgba(90,74,120,.16)");
    expect(TOP_LIGHT).toBe(20);
    expect(SHADOW_W_RATIO).toBe(0.75);
    expect(SHADOW_H_RATIO).toBe(0.2);
  });

  it("② 九层图层序:天空最底,危险标记倒数第二(只让 HUD 盖它),特效压主角", () => {
    expect(PP_LAYERS.length).toBe(9);
    expect(PP_LAYERS[0]).toBe("sky");
    expect(PP_LAYERS[PP_LAYERS.length - 1]).toBe("hud");
    expect(PP_LAYERS[PP_LAYERS.length - 2]).toBe("hazardMark");
    const order = (k: (typeof PP_LAYERS)[number]): number => PP_LAYERS.indexOf(k);
    expect(order("castleTowers")).toBeGreaterThan(order("sky"));
    expect(order("bushes")).toBeGreaterThan(order("castleTowers"));
    expect(order("terrain")).toBeGreaterThan(order("bushes"));
    expect(order("props")).toBeGreaterThan(order("terrain"));
    expect(order("heroes")).toBeGreaterThan(order("props"));
    expect(order("fx")).toBeGreaterThan(order("heroes"));
    expect(order("hazardMark")).toBeGreaterThan(order("fx"));
  });

  it("③ 四·补三时序表:340ms 2 帧披风 / 1 帧刃光 / 5 颗 400ms 星尘 / 2000ms 呼吸 / 900ms 2 帧旗 / 600ms 击掌", () => {
    expect(CAPE_SWAY_MS).toBe(340);
    expect(CAPE_SWAY_FRAMES).toBe(2);
    expect(BLADE_FLASH_MS).toBe(50);
    expect(STARDUST_COUNT).toBe(5);
    expect(STARDUST_MS).toBe(400);
    expect(GEM_BREATH_MS).toBe(2000);
    expect(GEM_GLOW_BASE).toBe(0.42);
    expect(FLAG_WAVE_MS).toBe(900);
    expect(FLAG_WAVE_FRAMES).toBe(2);
    expect(HIGHFIVE_MS).toBe(600);
    expect(BLINK_LIFT).toBe(40);
    expect(SHAWL_ALPHA).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// 二、双角色可区分
// ---------------------------------------------------------------------------

describe("双角色剪影与识别件", () => {
  it("④ 王子 / 公主剪影各自可调用,抽样 8 点两两不相等(裤装凹口 vs 钟形裙)", () => {
    const a = princeSilhouette();
    const b = princessSilhouette();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(b.length).toBeGreaterThanOrEqual(8);
    for (let s = 0; s < 8; s++) {
      const t = s / 7;
      const pa = a[Math.round(t * (a.length - 1))];
      const pb = b[Math.round(t * (b.length - 1))];
      expect(pa[0] !== pb[0] || pa[1] !== pb[1], `抽样点 ${s}`).toBe(true);
    }
    // 王子有裆部凹口(裤装),公主没有;公主裙摆比王子任何一点都张得开
    expect(a.some(([, y]) => y === -0.14)).toBe(true);
    const flare = Math.max(...b.map(([x]) => Math.abs(x)));
    expect(flare).toBeGreaterThan(Math.max(...a.map(([x]) => Math.abs(x))));
  });

  it("⑤ 五个识别件分支都在:三齿皇冠 / 蝶结双翼 / 波浪内衬 / 双排四扣 / 披纱", () => {
    // 皇冠:恰好 3 颗齿尖(比两旁都高),齿尖圆珠与正中红宝石配套
    const crown = crownPath();
    const teeth = crown.filter(
      (p, i) => i > 0 && i < crown.length - 1 && p[1] < crown[i - 1][1] && p[1] < crown[i + 1][1]
    );
    expect(teeth.length).toBe(3);
    expect(crownTeethTips().length).toBe(3);
    expect(CROWN_RUBY.x).toBe(0);
    expect(CROWN_RUBY.rx).toBeGreaterThan(0);
    // 蝶结:一枚结 + 两片翼,分居结的两侧
    const bow = bowShape();
    expect(bow.wings.length).toBe(2);
    const tip0 = bow.wings[0][1][0];
    const tip1 = bow.wings[1][1][0];
    expect(tip0).toBeLessThan(bow.knot.x);
    expect(tip1).toBeGreaterThan(bow.knot.x);
    // 双层裙摆:内衬扇贝 ≥3 且左右对称;裙面三点星纹
    const arcs = skirtLiningArcs();
    expect(arcs.length).toBeGreaterThanOrEqual(3);
    expect(arcs[0][0]).toBeCloseTo(-arcs[arcs.length - 1][0], 9);
    expect(skirtStars().length).toBe(3);
    // 双排金扣:4 点,2 列 × 2 行
    const btns = buttonPoints();
    expect(btns.length).toBe(4);
    expect(new Set(btns.map(([x]) => x)).size).toBe(2);
    expect(new Set(btns.map(([, y]) => y)).size).toBe(2);
    // 披纱:画在身后(x 全 ≤ 0),半透明白 30%
    const veil = shawlPath();
    expect(veil.length).toBeGreaterThanOrEqual(4);
    expect(veil.every(([x]) => x <= 0)).toBe(true);
    expect(shawlFill()).toBe(withAlpha(PP_COLORS.ppLining, SHAWL_ALPHA));
  });

  it("⑥ 大皇冠 vs 蝶结小冠:公主的小冠只有 0.45 倍;6px 以下头饰退化为纯色块", () => {
    expect(PRINCESS_CROWN_SCALE).toBeLessThan(1);
    expect(PRINCESS_CROWN_SCALE).toBeGreaterThan(0);
    expect(HEADWEAR_MIN_PX).toBe(6);
    expect(headwearDetail(5.9)).toBe(false);
    expect(headwearDetail(6)).toBe(true);
    expect(headwearDetail(12)).toBe(true);
  });

  it("⑦ 识别件真的画上画布:金冠 / 红蝶结 / 内衬扇贝 / 自绘星头一样不缺", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(2);
    h.flush(6, 33);
    const ops = findCtx(h.root)!.ops;
    // 皇冠:9 折点的金色实心多边形(王子大冠或公主小冠都算)
    expect(ops.some((o) => o.op === "fill" && o.points === crownPath().length && o.fill === PP_COLORS.ppGold)).toBe(true);
    // 蝶结翼:3 点的 ppRuby 三角
    expect(ops.some((o) => o.op === "fill" && o.points === 3 && o.fill === PP_COLORS.ppRuby)).toBe(true);
    // 内衬扇贝:ppLining 的下半圆
    expect(ops.some((o) => o.op === "arc" && o.fill === PP_COLORS.ppLining)).toBe(true);
    // 自绘五角星(10 折点):魔杖星头 / 裙面星纹
    expect(ops.some((o) => o.op === "fill" && o.points === 10)).toBe(true);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、武器与 emoji 清零 / attackT 只读
// ---------------------------------------------------------------------------

describe("武器与红线", () => {
  it("⑧ 魔杖星头为自绘路径:index.ts 源码零 ⭐,画布上也没有 ⭐ 的 fillText", async () => {
    expect(srcOf("./index.ts")).not.toContain("⭐");
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(2);
    // 跑一段 + 挥两把,把武器帧都逼出来
    h.key("keydown", "ArrowRight");
    for (let i = 0; i < 90; i++) {
      if (i % 20 === 0) h.key("keydown", "KeyF");
      if (i % 20 === 4) h.key("keyup", "KeyF");
      h.flush(1, 33);
    }
    h.key("keyup", "ArrowRight");
    const ops = findCtx(h.root)!.ops;
    expect(ops.filter((o) => o.op === "fillText" && (o.text ?? "").includes("⭐")).length).toBe(0);
    expect(ops.some((o) => o.op === "fill" && o.points === 10)).toBe(true);
    game.destroy();
  });

  it("⑨ attackT 视觉层只读:index/visual13 源码无一处写入;刃光窗口是纯函数", () => {
    const writePattern = /\.attackT\s*[+\-*/]?=(?!=)/;
    expect(writePattern.test(srcOf("./index.ts"))).toBe(false);
    expect(writePattern.test(srcOf("./visual13.ts"))).toBe(false);
    // 视觉层确实在读这个窗口(不是绕开它另起炉灶)
    expect(srcOf("./index.ts")).toContain("h.attackT");
    // 刃光只亮起手 50ms:0.18 剩 0.18/0.15 亮,剩 0.12 灭,归零灭
    expect(bladeFlashOn(MELEE_TIME, MELEE_TIME)).toBe(true);
    expect(bladeFlashOn(0.15, MELEE_TIME)).toBe(true);
    expect(bladeFlashOn(0.12, MELEE_TIME)).toBe(false);
    expect(bladeFlashOn(0, MELEE_TIME)).toBe(false);
  });

  it("⑩ 无敌闪烁节拍与 1.2 逐拍一致,只把闪烁色换成主色 +40%;攻击/无敌时长没动", () => {
    for (let t = 0; t <= 1.5; t += 0.01) {
      const legacy = t > 0 && Math.floor(t * 12) % 2 === 0;
      expect(invulnBlink(t, false), `invuln=${t.toFixed(2)}`).toBe(legacy);
      expect(invulnBlink(t, true)).toBe(t > 0);
    }
    expect(invulnBlink(0, false)).toBe(false);
    expect(blinkLift(PP_COLORS.ppPrince)).toBe(shade(PP_COLORS.ppPrince, 40));
    expect(blinkLift(PP_COLORS.ppPrincess)).toBe(shade(PP_COLORS.ppPrincess, 40));
    // 1.2 的时序输入原封不动
    expect(HURT_INVULN).toBe(1.5);
    expect(MELEE_TIME).toBe(0.18);
  });

  it("⑪ 判定盒只读:HERO_W / HERO_H 还是 1.2 的 32 × 46", () => {
    expect(HERO_W).toBe(32);
    expect(HERO_H).toBe(46);
    // 视觉层没有对判定盒动手的语句
    expect(/HERO_[WH]\s*=(?!=)/.test(srcOf("./index.ts"))).toBe(false);
    expect(/HERO_[WH]\s*=(?!=)/.test(srcOf("./visual13.ts"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 四、危险语义:软刺之后标记仍在最顶层
// ---------------------------------------------------------------------------

describe("危险标记最顶层", () => {
  it("⑫ 同一帧里危险三角画在主角身体之后(第 ⑧ 层),软刺描边仍是规范表深红", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(firstSpikeLevel());
    const ctx = findCtx(h.root)!;
    const hazard = ELEMENT_SPECS.hazard.stroke;
    const bodyPts = princeSilhouette().length;
    let checked = false;
    let sawSpike = false;
    h.key("keydown", "ArrowRight");
    for (let f = 0; f < 900 && !(checked && sawSpike); f++) {
      if (f % 24 === 0) h.key("keydown", "ArrowUp");
      if (f % 24 === 6) h.key("keyup", "ArrowUp");
      const start = ctx.ops.length;
      h.flush(1, 33);
      const slice = ctx.ops.slice(start);
      let lastBody = -1;
      let lastMark = -1;
      for (let i = 0; i < slice.length; i++) {
        const o = slice[i];
        if (o.op === "fill" && o.points === bodyPts) lastBody = i;
        if (o.op === "stroke" && o.stroke === hazard && o.points === 3) lastMark = i;
        // 软刺:一段 moveTo + 两条二次曲线的描边(只剩 1 个折点被记下来)
        if (o.op === "stroke" && o.stroke === hazard && o.points === 1) sawSpike = true;
      }
      if (lastBody >= 0 && lastMark >= 0) {
        expect(lastMark).toBeGreaterThan(lastBody);
        checked = true;
      }
    }
    h.key("keyup", "ArrowRight");
    expect(checked).toBe(true);
    // 软刺的描边色仍照规范表(危险语义没有因为圆头而减弱)
    expect(sawSpike).toBe(true);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 五、reduced 与 destroy
// ---------------------------------------------------------------------------

describe("prefers-reduced-motion", () => {
  it("⑬ reduced 全冻:披风 / 旗帜相位恒 0、微光停在固定档、星尘不生成;刃光保留", async () => {
    for (const ms of [0, 170, 340, 999, 12345]) {
      expect(capePhase(ms, true, true)).toBe(0);
      expect(flagWavePhase(ms, true)).toBe(0);
      expect(gemGlowAlpha(ms, true)).toBe(GEM_GLOW_BASE);
    }
    // 不动的时候披风也不摆
    expect(capePhase(500, false, false)).toBe(0);
    const fx = new PcpFx();
    fx.stardust(10, -20, true);
    expect(fx.count).toBe(0);
    fx.highFive(0, -30, true);
    expect(fx.count).toBe(0);
    expect(fx.celebrating).toBe(true);
    // 刃光是功能反馈:reduced 下挥剑,画布上照样有那一抹白
    const h = (harness = install());
    (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
    const { game } = await mountGame(h);
    game.openCampaignLevel(2);
    h.flush(45, 50);
    const ctx = findCtx(h.root)!;
    for (let i = 0; i < 6; i++) {
      h.key("keydown", "KeyF");
      h.flush(2, 33);
      h.key("keyup", "KeyF");
      h.flush(2, 33);
    }
    expect(ctx.ops.some((o) => o.op === "fill" && o.fill === BLADE_FLASH_COLOR)).toBe(true);
    game.destroy();
  });

  it("⑭ 正常档相位真的会动;星尘 5 颗 400ms 走完;destroy 账本归零", () => {
    expect(capePhase(0, true, false)).toBe(0);
    expect(capePhase(180, true, false)).toBe(1);
    expect(capePhase(360, true, false)).toBe(0);
    expect(flagWavePhase(0, false)).toBe(0);
    expect(flagWavePhase(500, false)).toBe(1);
    expect(gemGlowAlpha(GEM_BREATH_MS / 4, false)).toBeCloseTo(GEM_GLOW_BASE + 0.07, 5);
    expect(gemGlowAlpha((GEM_BREATH_MS * 3) / 4, false)).toBeCloseTo(GEM_GLOW_BASE - 0.07, 5);
    const fx = new PcpFx();
    fx.stardust(0, 0, false, () => 0.5);
    expect(fx.count).toBe(STARDUST_COUNT);
    fx.step(0.2);
    expect(fx.count).toBe(STARDUST_COUNT);
    fx.step(0.25);
    expect(fx.count).toBe(0);
    // 击掌 600ms 走完;clear 一把归零
    fx.highFive(0, 0, false, () => 0.5);
    expect(fx.count).toBeGreaterThan(0);
    expect(fx.celebrating).toBe(true);
    fx.step(HIGHFIVE_MS / 1000 + 0.01);
    expect(fx.celebrating).toBe(false);
    fx.highFive(0, 0, false, () => 0.5);
    fx.clear();
    expect(fx.count).toBe(0);
    expect(fx.celebrateT).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 六、HUD 卡片化与 360px
// ---------------------------------------------------------------------------

describe("HUD 徽章与卡片", () => {
  it("⑮ 宝石计数卡片化,双人模式挂头像徽章,HUD 字号 ≥14px,token 进了样式表", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game, mod } = await mountGame(h);
    expect(mod.CSS).toContain("font-size:14px");
    expect(mod.CSS).toContain(PP_COLORS.ppGold);
    expect(mod.CSS).toContain(PP_COLORS.ppPrince);
    expect(mod.CSS).toContain(PP_COLORS.ppPrincess);
    expect(mod.CSS).toContain(PP_COLORS.ppRuby);
    findButton(h.root, "两人一起")!.fire("click");
    game.openCampaignLevel(2);
    h.flush(3, 33);
    expect(findAll(h.root, "pcp-chip-gem").length).toBe(1);
    expect(findAll(h.root, "pcp-chip-duo").length).toBe(1);
    expect(findAll(h.root, "pcp-ava").length).toBe(2);
    expect(findAll(h.root, "pcp-ava-prince").length).toBe(1);
    expect(findAll(h.root, "pcp-ava-princess").length).toBe(1);
    // 回到单人:徽章收起,谁在场由 whoChip 说
    findButton(h.root, "一个人玩")!.fire("click");
    game.openCampaignLevel(2);
    h.flush(3, 33);
    expect(findAll(h.root, "pcp-chip-duo").length).toBe(0);
    game.destroy();
  });
});
