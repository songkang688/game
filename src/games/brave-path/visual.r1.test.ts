/**
 * 勇者小路 · 1.3 第 17 步 A 档 · 视觉升级用例（只增不减）。
 *
 * 十二组断言对着规格第九节逐条写：
 *  1  CSS token 全部落在组件根          7  ghostAt 提示格功能类名保留
 *  2  徽章套系映射（勇者/怪物）          8  冷却扇形罩角度 = 冷却比例 × 360°
 *  3  迷宫格勇者/怪物是 SVG 徽章        9  稀有度边框色阶（灰/蓝/金 + 粗细分档）
 *  4  迷雾：未探索有、已探索无、不盖顶栏  10 reduced：抖动/上飘/点亮不加、迷雾立即消失
 *  5  暖光圈只跟随勇者所在格            11 destroy 后动画计时器归零
 *  6  血条三段色阈值 + 数据只读          12 只换皮：视觉模块零玩法依赖、入口原样
 *
 * badge.ts 自己的六套底色/环色/图标断言在 src/art/kit/badge.test.ts 里。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Cleanup } from "./cleanup";
import {
  BVP_LAYERS,
  BVP_TIMING,
  BVP_TOKENS,
  confettiHtml,
  cooldownAngle,
  foeBadgeKind,
  fxClassPlan,
  gearRarity,
  heroBadgeKind,
  hpSegment,
  hpSegmentOf,
  itemRarity,
  litDelayMs,
  mazeCellView,
  prefersReducedMotion,
  seenSet,
  skillRarity,
  tokenCss,
  type MazeCellState
} from "./visual";

const DIR = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(DIR, "index.ts"), "utf8");
const VISUAL_SRC = readFileSync(join(DIR, "visual.ts"), "utf8");
const BADGE_SRC = readFileSync(join(DIR, "..", "..", "art", "kit", "badge.ts"), "utf8");

/** 造一格迷宫视图状态，测试里只改关心的字段 */
function cell(over: Partial<MazeCellState>): MazeCellState {
  return {
    wall: false,
    been: false,
    seen: true,
    isMe: false,
    isGhost: false,
    nearMe: false,
    item: "",
    ...over
  };
}

describe("视觉 1 · CSS token 全部落在组件根", () => {
  it("七个 --bvp- 规格 token 一个不少，值与规格表一致", () => {
    const css = tokenCss();
    expect(css).toContain("--bvp-floor:#F6EFE4");
    expect(css).toContain("--bvp-floor-edge:#D9C9A8");
    expect(css).toContain("--bvp-wall:#C7B8D8");
    expect(css).toContain("--bvp-moss:#9FD98B");
    expect(css).toContain("--bvp-fog:rgba(120,120,140,.55)");
    expect(css).toContain("--bvp-torch:rgba(255,200,120,.35)");
    expect(css).toContain("--bvp-hp-hi:#8FD98B");
    expect(css).toContain("--bvp-hp-mid:#F0C25A");
    expect(css).toContain("--bvp-hp-low:#F4859F");
  });

  it("token 注入在 .bvp-root{} 顶部，样式表不再散落魔法迷宫色值", () => {
    expect(SRC).toContain(".bvp-root{${tokenCss()}");
    // 迷宫皮肤全走 var()，旧的迷宫路面/墙面魔法色值一个不剩
    expect(SRC).toContain("background:var(--bvp-floor)");
    expect(SRC).toContain("background-color:var(--bvp-wall)");
    expect(SRC).not.toContain("#c8bde4");
    expect(SRC).not.toContain("#eee6ff");
  });
});

describe("视觉 2 · 徽章套系映射", () => {
  it("勇者侧：火/暗剑士、光牧师、水/草法师", () => {
    expect(heroBadgeKind("fire")).toBe("swordsman");
    expect(heroBadgeKind("dark")).toBe("swordsman");
    expect(heroBadgeKind("light")).toBe("priest");
    expect(heroBadgeKind("water")).toBe("mage");
    expect(heroBadgeKind("grass")).toBe("mage");
  });

  it("怪物侧：草/水果冻、火蘑菇、光/暗石头", () => {
    expect(foeBadgeKind("grass")).toBe("jelly");
    expect(foeBadgeKind("water")).toBe("jelly");
    expect(foeBadgeKind("fire")).toBe("mushroom");
    expect(foeBadgeKind("light")).toBe("rock");
    expect(foeBadgeKind("dark")).toBe("rock");
  });
});

describe("视觉 3 · 迷宫格勇者/怪物是 SVG 徽章，不再 emoji 直出", () => {
  it("勇者格 innerHTML 含 <svg，且不含 🌸 文本", () => {
    const v = mazeCellView(cell({ isMe: true, been: true }));
    expect(v.html).toContain("<svg");
    expect(v.html).toContain("ak-badge-flower");
    expect(v.html).not.toContain("🌸");
  });

  it("影子格 innerHTML 含 <svg，且不含 ⭐ 文本", () => {
    const v = mazeCellView(cell({ isGhost: true }));
    expect(v.html).toContain("<svg");
    expect(v.html).toContain("ak-badge-star");
    expect(v.html).not.toContain("⭐");
  });

  it("index.ts 的 paint 里不再有 🌸/⭐ 贴片，改走 mazeCellView", () => {
    expect(SRC).not.toContain('text = "🌸"');
    expect(SRC).not.toContain('text = "⭐"');
    expect(SRC).toContain("mazeCellView({");
  });
});

describe("视觉 4 · 迷雾层：未探索有、已探索无、不盖顶栏", () => {
  it("未看见的格有 bvp-mz-fog，看见的格没有", () => {
    expect(mazeCellView(cell({ seen: false })).cls).toContain("bvp-mz-fog");
    expect(mazeCellView(cell({ seen: true })).cls).not.toContain("bvp-mz-fog");
    expect(mazeCellView(cell({ wall: true, seen: false })).cls).toContain("bvp-mz-fog");
  });

  it("可见集 = 走过的格 + 周围一圈，出界不算", () => {
    const seen = seenSet(new Set(["0,0"]), 4, 4);
    expect(seen.has("0,0")).toBe(true);
    expect(seen.has("1,1")).toBe(true);
    expect(seen.has("0,1")).toBe(true);
    expect(seen.has("2,2")).toBe(false);
    expect(seen.has("-1,0")).toBe(false);
  });

  it("层级序：格底 < 徽章 < 迷雾 < 暖光圈 < 战斗浮层 < 顶栏 < 结算", () => {
    const z = BVP_LAYERS;
    expect(z["--bvp-z-cell"]).toBeLessThan(z["--bvp-z-badge"]);
    expect(z["--bvp-z-badge"]).toBeLessThan(z["--bvp-z-fog"]);
    expect(z["--bvp-z-fog"]).toBeLessThan(z["--bvp-z-torch"]);
    expect(z["--bvp-z-torch"]).toBeLessThan(z["--bvp-z-battle"]);
    expect(z["--bvp-z-battle"]).toBeLessThan(z["--bvp-z-hud"]);
    expect(z["--bvp-z-hud"]).toBeLessThan(z["--bvp-z-settle"]);
    // 雾在格子的 ::after 上、顶栏是 bvp-hud，各自吃对应 token
    expect(SRC).toMatch(/\.bvp-mz::after\{[^}]*z-index:var\(--bvp-z-fog\)/);
    expect(SRC).toMatch(/\.bvp-hud\{[^}]*z-index:var\(--bvp-z-hud\)/);
  });
});

describe("视觉 5 · 暖光圈只跟随勇者所在格", () => {
  it("整张 4×4 假图扫一遍，光圈锚点类只出现在勇者坐标", () => {
    const me: [number, number] = [2, 1];
    const hits: string[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = mazeCellView(cell({ isMe: r === me[0] && c === me[1], been: r === me[0] && c === me[1] }));
        if (v.cls.includes("bvp-mz-me")) hits.push(`${r},${c}`);
      }
    }
    expect(hits).toEqual(["2,1"]);
    // 光圈挂在 .bvp-mz-me::before 上，呼吸周期走 token
    expect(SRC).toMatch(/\.bvp-mz-me::before\{[^}]*var\(--bvp-torch\)/);
    expect(SRC).toMatch(/\.bvp-mz-me::before\{[^}]*animation:bvpBreath var\(--bvp-t-breath\)/);
  });
});

describe("视觉 6 · 血条三段色阈值 + 数据只读", () => {
  it("绿 > .55 ≥ 黄 > .25 ≥ 粉，脏数字按粉兜底", () => {
    expect(hpSegment(1)).toBe("hi");
    expect(hpSegment(0.56)).toBe("hi");
    expect(hpSegment(0.55)).toBe("mid");
    expect(hpSegment(0.26)).toBe("mid");
    expect(hpSegment(0.25)).toBe("low");
    expect(hpSegment(0)).toBe("low");
    expect(hpSegment(Number.NaN)).toBe("low");
  });

  it("只读星芒数据：传冻结对象也不抛、不写", () => {
    const f = Object.freeze({ hp: 30, maxHp: 100 });
    expect(hpSegmentOf(f)).toBe("mid");
    expect(f.hp).toBe(30);
    expect(f.maxHp).toBe(100);
    expect(hpSegmentOf(Object.freeze({ hp: 10, maxHp: 0 }))).toBe("low");
  });
});

describe("视觉 7 · ghostAt 提示格只换皮", () => {
  it("影子格功能类名 bvp-mz-ghost 原样保留", () => {
    expect(mazeCellView(cell({ isGhost: true })).cls).toContain("bvp-mz-ghost");
    expect(SRC).toContain("function ghostAt(");
    expect(SRC).toContain(".bvp-mz-ghost{");
  });

  it("勇者和影子同格时勇者优先，脚印与迷雾规则互不冲突", () => {
    const both = mazeCellView(cell({ isMe: true, isGhost: true, been: true }));
    expect(both.cls).toContain("bvp-mz-me");
    expect(both.cls).not.toContain("bvp-mz-ghost");
    expect(both.html).toContain("ak-badge-flower");
    // 走过的格留脚印类，且已看见就不再盖雾
    const trod = mazeCellView(cell({ been: true, seen: true }));
    expect(trod.cls).toContain("bvp-mz-been");
    expect(trod.cls).not.toContain("bvp-mz-fog");
  });
});

describe("视觉 8 · 冷却扇形罩角度 = 冷却比例 × 360°", () => {
  it("0 / 0.5 / 1 三点 + 夹取", () => {
    expect(cooldownAngle(0)).toBe(0);
    expect(cooldownAngle(0.5)).toBe(180);
    expect(cooldownAngle(1)).toBe(360);
    expect(cooldownAngle(-1)).toBe(0);
    expect(cooldownAngle(2)).toBe(360);
    expect(cooldownAngle(Number.NaN)).toBe(0);
  });

  it("战斗按钮真用上了 conic-gradient 扇形罩，只读冷却数据", () => {
    expect(SRC).toContain("conic-gradient");
    expect(SRC).toContain("def.cooldown > 0 ? cd / def.cooldown : 0");
  });
});

describe("视觉 9 · 稀有度边框色阶：灰 / 蓝 / 金", () => {
  it("装备按解锁等级、技能按点数、道具按价格分档", () => {
    expect(gearRarity(1)).toBe("common");
    expect(gearRarity(8)).toBe("common");
    expect(gearRarity(16)).toBe("rare");
    expect(gearRarity(26)).toBe("rare");
    expect(gearRarity(38)).toBe("epic");
    expect(gearRarity(50)).toBe("epic");
    expect(skillRarity(1)).toBe("common");
    expect(skillRarity(2)).toBe("rare");
    expect(skillRarity(4)).toBe("epic");
    expect(itemRarity(18)).toBe("common");
    expect(itemRarity(30)).toBe("rare");
    expect(itemRarity(45)).toBe("epic");
  });

  it("边框颜色 + 粗细同步分档（1.5 / 2 / 2.5px），色弱也分得清", () => {
    expect(SRC).toMatch(/\.bvp-ico\{[^}]*border:1\.5px solid #c9c4d4/);
    expect(SRC).toMatch(/\.bvp-ico-rare\{[^}]*border:2px solid #5f9be8/);
    expect(SRC).toMatch(/\.bvp-ico-epic\{[^}]*border:2\.5px solid #e3a82f/);
    // 图标格 44px、圆角 10px
    expect(SRC).toMatch(/\.bvp-ico\{width:44px;height:44px;border-radius:10px/);
  });
});

describe("视觉 10 · reduced：动效类不加、迷雾立即消失", () => {
  it("fxClassPlan(true)：抖动不加、点亮不加、上飘换原地、彩纸不放", () => {
    const on = fxClassPlan(false);
    expect(on.shake).toBe("bvp-hit");
    expect(on.float).toBe("bvp-float");
    expect(on.dotLit).toBe("bvp-dot-lit");
    expect(on.confetti).toBe(true);
    const off = fxClassPlan(true);
    expect(off.shake).toBe("");
    expect(off.float).toBe("bvp-float bvp-float-still");
    expect(off.dotLit).toBe("");
    expect(off.confetti).toBe(false);
  });

  it("prefersReducedMotion：假宿主两个分支都走，node 裸环境不抛", () => {
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
    expect(() => prefersReducedMotion()).not.toThrow();
  });

  it("CSS reduce 块：时长 token 归零（迷雾立即消失）、呼吸/上飘/抖动/点亮/彩纸 animation:none", () => {
    const reduce = /@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/.exec(SRC);
    expect(reduce, "找不到 reduced 总闸").not.toBeNull();
    const block = reduce![1];
    expect(block).toContain("--bvp-t-fog:0ms");
    expect(block).toContain(".bvp-mz-me::before,.bvp-float,.bvp-hit,.bvp-dot-lit,.bvp-conf{animation:none;}");
    // 静态层次保留：光圈换常亮、上飘数字原地显示、出手方只留描边
    expect(block).toContain(".bvp-mz-me::before{opacity:.85;}");
    expect(block).toContain(".bvp-float{opacity:1;}");
    expect(block).toContain(".bvp-turn{transform:none;}");
  });
});

describe("视觉 11 · destroy 后动画计时器归零", () => {
  it("受击上飘/抖动那种 after 计时器全走 Cleanup，destroy 后 pending() = 0", () => {
    let nextId = 0;
    const c = new Cleanup({ setTimeout: () => ++nextId, clearTimeout: () => undefined });
    c.after(BVP_TIMING["--bvp-t-float"] + 60, () => undefined);
    c.after(BVP_TIMING["--bvp-t-shake"] + 20, () => undefined);
    c.after(1600, () => undefined);
    expect(c.pending()).toBe(3);
    c.destroy();
    expect(c.pending()).toBe(0);
  });

  it("index.ts 里没有绕开 Cleanup 的裸计时器", () => {
    expect(SRC).not.toMatch(/[^.\w](setTimeout|setInterval|requestAnimationFrame)\(/);
    expect(SRC).toContain("cleanup.after(");
  });
});

describe("视觉 12 · 只换皮不动骨", () => {
  it("visual.ts / badge.ts 零玩法依赖：不 import logic/combat/levels/maze，不碰存档", () => {
    for (const bad of ['from "./logic"', 'from "./combat"', 'from "./levels"', 'from "./maze"', "localStorage"]) {
      expect(VISUAL_SRC).not.toContain(bad);
      expect(BADGE_SRC).not.toContain(bad);
    }
    expect(BADGE_SRC).not.toContain("import ");
  });

  it("四个玩法入口原样：闯关 / 无尽 / 对战 / 竞速", () => {
    expect(SRC).toContain("mountLevelGame(");
    expect(SRC).toContain("function mountEndless(");
    expect(SRC).toContain("function mountArena(");
    expect(SRC).toContain("function mountMazeRace(");
  });

  it("动效时序对着规格表：呼吸 2000 / 迷雾 280 / 上飘 420 / 抖动 160 / 前移 180 / 点亮 90", () => {
    expect(BVP_TIMING["--bvp-t-breath"]).toBe(2000);
    expect(BVP_TIMING["--bvp-t-fog"]).toBe(280);
    expect(BVP_TIMING["--bvp-t-float"]).toBe(420);
    expect(BVP_TIMING["--bvp-t-shake"]).toBe(160);
    expect(BVP_TIMING["--bvp-t-turn"]).toBe(180);
    expect(BVP_TIMING["--bvp-t-lit"]).toBe(90);
    expect(litDelayMs(0)).toBe(0);
    expect(litDelayMs(3)).toBe(270);
  });

  it("彩纸是确定性铺开：不吃运行时随机，条数只由入参定", () => {
    expect(confettiHtml(6)).toBe(confettiHtml(6));
    expect((confettiHtml(18).match(/bvp-conf /g) ?? []).length).toBe(18);
    expect(VISUAL_SRC).not.toContain("Math.random");
    // 色板 token 不散落：所有 --bvp- 声明集中在 BVP_ 三张表里
    expect(Object.keys(BVP_TOKENS).length).toBe(9);
  });
});
