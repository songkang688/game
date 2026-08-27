/**
 * 便便超人 · 1.3 视觉升级用例(第 22 步 C 档,只增不减)。
 *
 * 钉四样东西:
 * 1) 配色板 token 与四·补一表一致,豆豆怪糖果色沿用 1.2 原值;
 * 2) 超人三态 / 披风阈值 / 腿摆 / 降级 / 章节主题 / 变花帧这些纯函数分支;
 * 3) 判定盒与扫除窗口一个数都没动(只读断言);
 * 4) 源码字符串:💨 与 FLOWERS[] 从画布上清场、图层序从底到顶、destroy 清粒子。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CROUCH_H, PLAYER_H, PLAYER_W } from "./logic";
import { CHAPTERS, TOTAL } from "./levels";
import { DASH_SPEED, DASH_TIME, MOVE_SPEED, SWEEP_TIME } from "./tuning";
import { capeMode } from "../../art/kit/cape";
import {
  BEAN_COLORS,
  FLOWER_STYLES,
  HERO_VIS,
  PH_ANIM,
  PH_LAYERS,
  PH_TOKENS,
  PhFx,
  badgePulse,
  bloomFrame,
  breathOffset,
  broomTrailAlpha,
  heroPose,
  legFrame,
  poseLean,
  sceneTheme,
  shade,
  showDetail,
  trailAlpha,
} from "./visual";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

const HEX = /^#[0-9A-F]{6}$/;

describe("配色板 token(四·补一)", () => {
  it("token 值与表一致且全部合法", () => {
    expect(PH_TOKENS.phCapeOut).toBe("#F4859F");
    expect(PH_TOKENS.phCapeOutDeep).toBe(shade("#F4859F", -18));
    expect(PH_TOKENS.phCapeIn).toBe("#FFE9F2");
    expect(PH_TOKENS.phSuit).toBe("#7FB2F0");
    expect(PH_TOKENS.phSuitHi).toBe(shade("#7FB2F0", 25));
    expect(PH_TOKENS.phBelt).toBe("#F0C25A");
    expect(PH_TOKENS.phBroom).toBe("#C89B6C");
    expect(PH_TOKENS.phClean).toBe("rgba(255,244,200,.25)");
    expect(PH_TOKENS.phShadow).toBe("rgba(90,74,110,.16)");
    for (const c of [
      PH_TOKENS.phCapeOut,
      PH_TOKENS.phCapeOutDeep,
      PH_TOKENS.phCapeIn,
      PH_TOKENS.phSuit,
      PH_TOKENS.phSuitHi,
      PH_TOKENS.phBelt,
      PH_TOKENS.phBeltBuckle,
      PH_TOKENS.phBroom,
      PH_TOKENS.phBroomRing,
    ]) {
      expect(c).toMatch(HEX);
    }
    // shade 是双向的:提亮往白走、加深往黑走
    expect(shade("#808080", 100)).toBe("#FFFFFF");
    expect(shade("#808080", -100)).toBe("#000000");
  });

  it("豆豆怪糖果色沿用 1.2 原值,一个不改(「不搞脏」约定延续)", () => {
    expect(BEAN_COLORS.map((c) => c.body)).toEqual([
      "#FFC9DE",
      "#C9E7C0",
      "#C6DCF7",
      "#FFE0AE",
      "#F6C6EA",
      "#BFE6F2",
      "#FFF0B0",
      "#DACDF6",
    ]);
    expect(BEAN_COLORS[0]).toEqual({ body: "#FFC9DE", shade: "#F7A8C6", face: "#B4577E" });
    expect(BEAN_COLORS).toHaveLength(8);
  });

  it("两位主角的套装是粉彩原创撞色,自绘五瓣花五套配色齐全", () => {
    expect(HERO_VIS).toHaveLength(2);
    for (const v of HERO_VIS) {
      expect(v.capeOut0).toMatch(HEX);
      expect(v.suit).toMatch(HEX);
      expect(v.capeOut1).toBe(shade(v.capeOut0, -18));
    }
    // 两人披风主色不同,一眼分得开
    expect(HERO_VIS[0].capeOut0).not.toBe(HERO_VIS[1].capeOut0);
    expect(FLOWER_STYLES).toHaveLength(5);
  });
});

describe("超人三态与披风三段(读状态不写状态)", () => {
  it("站 / 跑 / 冲走三条不同绘制分支", () => {
    expect(heroPose({ dashT: 0, vx: 0 })).toBe("idle");
    expect(heroPose({ dashT: 0, vx: MOVE_SPEED })).toBe("run");
    expect(heroPose({ dashT: 0.2, vx: DASH_SPEED })).toBe("dash");
    // 前倾角:站 0 / 跑 10° / 冲 18°
    expect(poseLean("idle")).toBe(0);
    expect(poseLean("run")).toBeCloseTo((10 * Math.PI) / 180, 6);
    expect(poseLean("dash")).toBeCloseTo((18 * Math.PI) / 180, 6);
    // drawHero 里三条分支都接了线
    expect(SRC).toContain('pose === "idle"');
    expect(SRC).toContain('pose === "run"');
    expect(SRC).toContain('pose === "dash"');
  });

  it("披风三段形态的速度阈值映射:本款三种速度各归各段", () => {
    expect(capeMode(0)).toBe("rest");
    expect(capeMode(MOVE_SPEED)).toBe("run");
    expect(capeMode(DASH_SPEED)).toBe("dash");
    expect(capeMode(-DASH_SPEED)).toBe("dash");
  });

  it("跑动腿摆 4 帧相位循环(160ms/帧,step)", () => {
    expect(PH_ANIM.legFrameMs).toBe(160);
    expect([0, 160, 320, 480].map((t) => legFrame(t, false))).toEqual([0, 1, 2, 3]);
    expect(legFrame(640, false)).toBe(0);
    // reduced 简化成 2 帧
    expect([0, 160, 320].map((t) => legFrame(t, true))).toEqual([0, 1, 0]);
  });

  it("细节降级阈值:刘海 / 腰带扣低于 5px 省略", () => {
    expect(PH_ANIM.detailMinPx).toBe(5);
    expect(showDetail(4.99)).toBe(false);
    expect(showDetail(5)).toBe(true);
    expect(SRC).toContain("showDetail(buckleR * 2)");
    expect(SRC).toContain("showDetail(headR * 0.42)");
  });
});

describe("判定盒与窗口常量只读不动", () => {
  it("PLAYER_W/H 与 CROUCH_H 原值原样", () => {
    expect(PLAYER_W).toBe(34);
    expect(PLAYER_H).toBe(46);
    expect(CROUCH_H).toBe(26);
  });

  it("扫除 / 冲刺窗口与章节数据没被视觉步碰过", () => {
    expect(SWEEP_TIME).toBe(0.24);
    expect(DASH_TIME).toBe(0.26);
    expect(CHAPTERS).toHaveLength(8);
    expect(TOTAL).toBe(188);
  });

  it("扫帚弧形残影只在 sweepT > 0 的窗口里出现", () => {
    expect(broomTrailAlpha(0, SWEEP_TIME, false)).toBe(0);
    expect(broomTrailAlpha(-0.01, SWEEP_TIME, false)).toBe(0);
    // 窗口内:刚挥出最亮,走到窗口尾巴归零
    expect(broomTrailAlpha(SWEEP_TIME, SWEEP_TIME, false)).toBe(1);
    const mid = broomTrailAlpha(SWEEP_TIME / 2, SWEEP_TIME, false);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("尾流 / 变花 / 徽章的时序(四·补三)", () => {
  it("星星尾流 3 颗 300ms ease-out,变花 3 帧 240ms,脉冲 500ms", () => {
    expect(PH_ANIM.trailStars).toBe(3);
    expect(PH_ANIM.trailMs).toBe(300);
    expect(PH_ANIM.bloomFrames).toBe(3);
    expect(PH_ANIM.bloomMs).toBe(240);
    expect(PH_ANIM.badgePulseMs).toBe(500);
    expect(trailAlpha(0)).toBe(1);
    expect(trailAlpha(300)).toBe(0);
  });

  it("变花展开:0/80/160ms 三帧 step,展开完停在最后一帧", () => {
    expect(bloomFrame(0, false)).toBe(0);
    expect(bloomFrame(80, false)).toBe(1);
    expect(bloomFrame(160, false)).toBe(2);
    expect(bloomFrame(600, false)).toBe(2);
  });
});

describe("章节主题场景", () => {
  it("章节 → 背景主题:街道 / 公园 / 星空屋顶 三章节三主题轮换", () => {
    expect(sceneTheme(0)).toBe("street");
    expect(sceneTheme(1)).toBe("park");
    expect(sceneTheme(2)).toBe("rooftop");
    expect(sceneTheme(3)).toBe("street");
    // 8 个章节把三套主题全轮到
    const themes = new Set(Array.from({ length: 8 }, (_, ci) => sceneTheme(ci)));
    expect(themes.size).toBe(3);
  });

  it("图层序从底到顶:背景视差 → 地面干净带 → 豆豆怪 → 残影 → 超人 → 尾流星花 → HUD", () => {
    expect(PH_LAYERS).toHaveLength(7);
    const marks = ["图层①", "图层②", "图层③", "图层④", "图层⑤", "图层⑥", "图层⑦"];
    const spots = marks.map((m) => SRC.indexOf(m));
    for (const [k, at] of spots.entries()) {
      expect(at, `render 里少了 ${marks[k]} 这层`).toBeGreaterThanOrEqual(0);
    }
    for (let k = 1; k < spots.length; k++) {
      expect(spots[k], `${marks[k]} 画反了层`).toBeGreaterThan(spots[k - 1]);
    }
    // 残影(④)永远画在超人(⑤)身后一层
    expect(SRC.indexOf("fx.ghosts")).toBeLessThan(SRC.indexOf("// ── 图层⑤ 超人"));
  });
});

describe("emoji 清场(源码字符串断言)", () => {
  it("冲刺尾流不再 fillText(💨):画布上一个 💨 都不许贴", () => {
    expect(SRC).not.toMatch(/emoji\([^)]*"💨"/);
    expect(SRC).not.toMatch(/fillText\("💨"/);
    expect(SRC).not.toMatch(/smash:\s*"💨"/);
  });

  it("变花不再用 emoji FLOWERS[]:数组连定义都不剩", () => {
    expect(SRC).not.toMatch(/const FLOWERS\s*=/);
    expect(SRC).not.toMatch(/FLOWERS\[/);
    // 顶上来的是自绘五瓣花
    expect(SRC).toContain("drawFlower(");
  });
});

describe("reduced(减少动态效果)", () => {
  it("呼吸 / 残影 / 尾流 / 脉冲全停,扫帚反馈保留一帧静态弧", () => {
    expect(breathOffset(1234, true)).toBe(0);
    const fx = new PhFx();
    fx.spawnGhost(10, 0, 1, false, true);
    fx.spawnTrailStar(10, -20, 6, true);
    expect(fx.count()).toBe(0);
    expect(badgePulse(0, true)).toEqual({ scale: 1, glow: 0.35 });
    expect(badgePulse(0, false).scale).toBeGreaterThan(1);
    expect(badgePulse(PH_ANIM.badgePulseMs, false)).toEqual({ scale: 1, glow: 0 });
    // 扫除反馈不能丢:窗口内一帧静态弧
    expect(broomTrailAlpha(SWEEP_TIME / 2, SWEEP_TIME, true)).toBe(0.5);
    expect(broomTrailAlpha(0, SWEEP_TIME, true)).toBe(0);
    // 变花一帧到位
    expect(bloomFrame(0, true)).toBe(PH_ANIM.bloomFrames - 1);
  });
});

describe("FX 粒子生命周期", () => {
  it("残影两帧渐隐、尾流 300ms 到点回收、星花池有帧数", () => {
    const fx = new PhFx();
    fx.spawnGhost(0, 0, 1, false, false);
    expect(fx.ghosts[0].framesLeft).toBe(PH_ANIM.dashGhostFrames);
    fx.tickGhosts();
    expect(fx.ghosts).toHaveLength(1);
    fx.tickGhosts();
    expect(fx.ghosts).toHaveLength(0);
    fx.spawnTrailStar(0, 0, 6, false);
    fx.updateTrail(PH_ANIM.trailMs - 1);
    expect(fx.trail).toHaveLength(1);
    fx.updateTrail(1);
    expect(fx.trail).toHaveLength(0);
    // 尾流上限:每人最多 3 颗、双人 6 颗,再多就顶掉最老的
    for (let k = 0; k < 10; k++) fx.spawnTrailStar(k, 0, 6, false);
    expect(fx.trail.length).toBeLessThanOrEqual(PH_ANIM.trailStars * 2);
  });

  it("destroy / swap 后残影与星花粒子归零", () => {
    const fx = new PhFx();
    fx.spawnGhost(0, 0, 1, false, false);
    fx.spawnTrailStar(0, 0, 6, false);
    fx.sparks.spawn(0, 0, false);
    expect(fx.count()).toBeGreaterThan(0);
    fx.clear();
    expect(fx.count()).toBe(0);
    // index.ts 的 destroy 与 swap 都接了 fx.clear()
    const destroyBlock = SRC.slice(SRC.indexOf("destroyed = true;"), SRC.indexOf("wrap.remove();"));
    expect(destroyBlock).toContain("fx.clear();");
    const swapBlock = SRC.slice(SRC.indexOf("swap(def, keep) {"), SRC.indexOf("showVeil,"));
    expect(swapBlock).toContain("fx.clear();");
  });
});

describe("HUD 卡片化与连击", () => {
  it("连击卡 / 章节卡进了 HUD,卡片字号 14px,连击 ≥2 才亮", () => {
    expect(SRC).toContain(".pph-card{");
    expect(SRC).toMatch(/\.pph-card\{[^}]*font-size:14px/);
    expect(SRC).toContain(".pph-chip-combo");
    expect(SRC).toContain(".pph-chip-chapter");
    expect(SRC).toContain("combo >= 2");
    // 徽章脉冲跟连击走同一个开关
    expect(SRC).toContain("badgePulse(badgeMs, gentle)");
  });
});
