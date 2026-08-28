/**
 * 1.3 第 20 步 · B 档 —— 水果切切乐视觉升级用例(只增不减)。
 *
 * 只验「皮」:专属剪影 / 切面果肉 / 刀光星花液滴 / 乌云娃娃 / 花瓣雨 / destroy 清理。
 * 玩法(抛物线、判定半径 `f.r`、效果逻辑)一个断言都不动,还反过来上锁:
 * 判定走廊与 FRUITS 半径表在这里被钉死,谁改玩法这里先红。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BANANA_SEEDS,
  BERRY_CORE_LINES,
  CITRUS_SEGMENTS,
  FACE_FLASH_FRAMES,
  FS_COLORS,
  JUICE_COLORS,
  LEMON_BUBBLES,
  LEMON_CELLS,
  MELON_RIND_RATIO,
  MELON_SEEDS,
  MIN_DETAIL_PX,
  PEACH_PIT_RATIO,
  PETAL_COMBO,
  PETAL_RAIN_MS,
  PetalRain,
  SILHOUETTE_MAX_SCALE,
  TRAIL_RIBBON_MS,
  auraFor,
  drawCrossSection,
  juiceColorFor,
  silhouetteExtent,
  silhouettePoints,
  traceSilhouette,
  type SliceFruitName,
} from "./visual";
import {
  JUICE_DROPS_PER_SLICE,
  JUICE_LIFE_MS,
  JuicePool,
} from "../../art/kit/juice";
import {
  SPARK_FRAMES,
  SPARK_FRAMES_REDUCED,
  SparklePool,
} from "../../art/kit/sparkle";
import { ctx2d, flushFrames, installDom, restoreDom, windowListenerCount } from "../../qa-window2/canvasDom";

const ctx = ctx2d as CanvasRenderingContext2D;
const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const FIVE: SliceFruitName[] = ["桃桃", "瓜瓜", "橙橙", "莓莓", "柠柠"];

/** 采样点环的「指纹」:逐点距离,足够区分两条剪影 */
function fingerprint(name: SliceFruitName): number[] {
  return silhouettePoints(name, 30).map((p) => Math.hypot(p.x, p.y));
}

describe("B档视觉 · 五果专属剪影(主管点名:不再是统一正圆)", () => {
  it("五种剪影两两不相等(抽 4 对逐点对比)", () => {
    const pairs: Array<[SliceFruitName, SliceFruitName]> = [
      ["桃桃", "瓜瓜"],
      ["瓜瓜", "莓莓"],
      ["橙橙", "柠柠"],
      ["桃桃", "莓莓"],
    ];
    for (const [a, b] of pairs) {
      const fa = fingerprint(a);
      const fb = fingerprint(b);
      const diff = fa.reduce((s, v, i) => s + Math.abs(v - fb[i]), 0);
      expect(diff, `${a} 和 ${b} 的剪影长得一样`).toBeGreaterThan(3);
    }
  });

  it("桃桃 / 瓜瓜 / 莓莓不再是正圆:剪影半径有起伏,drawFruit 主干走专属路径", () => {
    for (const name of ["桃桃", "瓜瓜", "莓莓"] as const) {
      const f = fingerprint(name);
      const spread = Math.max(...f) - Math.min(...f);
      expect(spread, `${name} 的剪影仍是正圆(半径无起伏)`).toBeGreaterThan(30 * 0.08);
    }
    // 主干接线:果身经 traceSilhouette(silhouettePoints(...)) 描形,不再 arc 一把梭
    expect(SRC).toMatch(/silhouettePoints\(name, f\.r\)/);
    expect(SRC).toMatch(/traceSilhouette\(ctx, pts\)/);
  });

  it("画大不改判:五果剪影外接 ≤ SILHOUETTE_MAX_SCALE × r,上限常量就是 1.15", () => {
    expect(SILHOUETTE_MAX_SCALE).toBe(1.15);
    for (const name of FIVE) {
      for (const r of [20, 26, 30, 36]) {
        expect(silhouetteExtent(name, r), `${name} 在 r=${r} 时画出界`).toBeLessThanOrEqual(
          SILHOUETTE_MAX_SCALE * r,
        );
      }
    }
  });

  it("判定与半径没被视觉动过:扫掠走廊、FRUITS 半径表原样钉死", () => {
    // 判定走廊 = f.r + 12px,一字不差
    expect(SRC).toContain(
      "sweptHit(x1, y1, x2, y2, { x: f.x, y: f.y, vx: f.vx + wind, vy: f.vy, r: f.r }, lastDt, 12)",
    );
    // 五果判定半径原值
    for (const frag of ["r: 30 }", "r: 28 }", "r: 36 }", "r: 22 }", "r: 26 }"]) {
      expect(SRC, `FRUITS 半径表被改动:${frag}`).toContain(frag);
    }
  });

  it("小尺寸可辨:低于 MIN_DETAIL_PX 才省略细节层,常量为 20px", () => {
    expect(MIN_DETAIL_PX).toBe(20);
    expect(SRC).toMatch(/f\.r >= MIN_DETAIL_PX/);
  });
});

describe("B档视觉 · 六种切面果肉", () => {
  it("六种切面分支(桃/瓜/橙/莓/柠/蕉)+ 通用分支各自可调用不抛错", () => {
    for (const name of [...FIVE, "蕉蕉", "壳壳"]) {
      expect(() => drawCrossSection(ctx, name, 30, "#fff0f3", "#ffb3c1"), `${name} 切面抛错`).not.toThrow();
    }
  });

  it("切面细节常量:黑籽 6 / 放射 8 瓣 / 细纹 12 / 瓣格 8(附:汁泡 5、桃核 0.22r、皮环 0.1r、蕉籽 3)", () => {
    expect(MELON_SEEDS).toBe(6);
    expect(CITRUS_SEGMENTS).toBe(8);
    expect(BERRY_CORE_LINES).toBe(12);
    expect(LEMON_CELLS).toBe(8);
    expect(LEMON_BUBBLES).toBe(5);
    expect(PEACH_PIT_RATIO).toBe(0.22);
    expect(MELON_RIND_RATIO).toBe(0.1);
    expect(BANANA_SEEDS).toBe(3);
  });

  it("切开瞬间切面亮 1 帧再落定:帧数常量为 1,fresh 标记画一次就熄", () => {
    expect(FACE_FLASH_FRAMES).toBe(1);
    expect(SRC).toMatch(/fresh: true/);
    expect(SRC).toMatch(/half\.fresh = false/);
    // reduced 直接落定:白闪包在 !fxCalm(视觉层减弱动效别名)里
    expect(SRC).toMatch(/if \(half\.fresh\) \{\s*\n\s*if \(!fxCalm\)/);
  });
});

describe("B档视觉 · 刀光三层 + 白闪星花 + 果汁液滴", () => {
  it("刀光丝带三层(外晕/中层/芯线),尾迹 160ms;reduced 收成单层细线", () => {
    expect(TRAIL_RIBBON_MS).toBe(160);
    expect(FS_COLORS.trailCore).toBe("#FFFFFF");
    for (const layer of ["外晕渐隐", "中层主题色", "芯线白", "单层细线"]) {
      expect(SRC, `drawTrail 缺了「${layer}」层`).toContain(layer);
    }
  });

  it("白闪星花只在切中时出现:不 spawn 就一朵都没有,寿命 2 帧(reduced 1 帧)", () => {
    expect(SPARK_FRAMES).toBe(2);
    expect(SPARK_FRAMES_REDUCED).toBe(1);
    const pool = new SparklePool();
    // 未切中:随便画多少帧都不冒星花
    pool.draw(ctx);
    pool.draw(ctx);
    expect(pool.count()).toBe(0);
    // 切中:2 帧后自然熄灭
    pool.spawn(100, 100, false);
    expect(pool.count()).toBe(1);
    pool.draw(ctx);
    expect(pool.count()).toBe(1);
    pool.draw(ctx);
    expect(pool.count()).toBe(0);
    // reduced 仍保留 1 帧功能反馈
    pool.spawn(100, 100, true);
    pool.draw(ctx);
    expect(pool.count()).toBe(0);
    // 接线:星花只挂在切开水果的 splitHalves 里,别处不乱冒
    expect(SRC.match(/sparkles\.spawn\(/g)?.length).toBe(1);
    expect(SRC).toMatch(/function splitHalves[\s\S]{0,400}sparkles\.spawn\(/);
  });

  it("液滴颜色 = 对应果主色,一次上限 3 颗,寿命 300ms,reduced 不生成", () => {
    expect(JUICE_DROPS_PER_SLICE).toBe(3);
    expect(JUICE_LIFE_MS).toBe(300);
    expect(JUICE_COLORS["桃桃"]).toBe("#ffb3c1");
    expect(JUICE_COLORS["橙橙"]).toBe("#ffc46b");
    expect(JUICE_COLORS["瓜瓜"]).toBe("#8fd47a");
    expect(JUICE_COLORS["莓莓"]).toBe("#91a7ff");
    expect(JUICE_COLORS["柠柠"]).toBe("#ffe66b");
    // 没进映射表的(壳壳等)跟果皮颜色走
    expect(juiceColorFor("壳壳", "#c9a06a")).toBe("#c9a06a");
    const pool = new JuicePool();
    pool.spawn(10, 10, 0, "#ffb3c1", false);
    expect(pool.count()).toBe(JUICE_DROPS_PER_SLICE);
    pool.update(JUICE_LIFE_MS);
    expect(pool.count()).toBe(0);
    pool.spawn(10, 10, 0, "#ffb3c1", true);
    expect(pool.count()).toBe(0);
  });
});

describe("B档视觉 · 特殊物精修与舞台", () => {
  it("炸弹分支是乌云娃娃:皱眉云朵 + 引信星火,无写实武器元素", () => {
    expect(SRC).toContain("drawCloudBomb");
    expect(SRC).toContain("乌云娃娃");
    expect(SRC).toContain("皱眉");
    expect(FS_COLORS.cloud).toBe("#8B93A8");
    // 旧的写实炸弹画法(黑球 + 导火索)已整个移除
    expect(SRC).not.toContain("function drawBomb(");
    for (const banned of ["飞刀", "忍者", "导火索", "刀刃"]) {
      expect(SRC, `出现违禁元素:${banned}`).not.toContain(banned);
    }
  });

  it("花瓣雨:仅 combo ≥ 5 触发、时长 1000ms、reduced 关闭", () => {
    expect(PETAL_COMBO).toBe(5);
    expect(PETAL_RAIN_MS).toBe(1000);
    expect(SRC).toMatch(/comboCount >= PETAL_COMBO.*petals\.burst/);
    const rain = new PetalRain();
    rain.burst("#ffb3c1", true);
    expect(rain.count(), "reduced 下花瓣雨没关").toBe(0);
    rain.burst("#ffb3c1", false, () => 0.5);
    expect(rain.count()).toBeGreaterThan(0);
    rain.update(PETAL_RAIN_MS - 1);
    expect(rain.count()).toBeGreaterThan(0);
    rain.update(1);
    expect(rain.count(), "1 秒后花瓣没收干净").toBe(0);
  });

  it("冰冻/加倍的视觉映射只读效果状态:冻结对象也算得出、值不被写", () => {
    const state = Object.freeze({ freezeTimer: 2.5, doubleTimer: 0 });
    const aura = auraFor(state, 450, false);
    expect(aura.frozen).toBe(true);
    expect(aura.doubled).toBe(false);
    expect(aura.goldPulse01).toBeGreaterThanOrEqual(0);
    expect(aura.goldPulse01).toBeLessThanOrEqual(1);
    expect(state.freezeTimer).toBe(2.5);
    expect(state.doubleTimer).toBe(0);
    // reduced:脉动钉在 0.5(静态金边 / 静止寒气)
    const still = auraFor(state, 12345, true);
    expect(still.goldPulse01).toBe(0.5);
    expect(still.wisp01).toBe(0.5);
  });

  it("舞台与配色板:砧板/幕布/金边/冰面色值落成常量并被引用", () => {
    expect(FS_COLORS.stage).toBe("#F6EBDD");
    expect(FS_COLORS.curtain).toBe("rgba(255,220,235,.5)");
    expect(FS_COLORS.gold).toBe("#F0C25A");
    expect(FS_COLORS.ice).toBe("#DDF2FF");
    expect(SRC).toContain("drawStageDecor");
    expect(SRC).toContain("FS_COLORS.stage");
    expect(SRC).toContain("FS_COLORS.curtain");
    expect(SRC).toContain("FS_COLORS.gold");
    expect(SRC).toContain("FS_COLORS.ice");
  });

  it("destroy 后液滴 / 星花 / 花瓣粒子全部归零(池子 clear + 拆卸接线)", () => {
    const juice = new JuicePool();
    juice.spawn(0, 0, 0, "#fff", false);
    juice.clear();
    expect(juice.count()).toBe(0);
    const sparkles = new SparklePool();
    sparkles.spawn(0, 0, false);
    sparkles.clear();
    expect(sparkles.count()).toBe(0);
    const rain = new PetalRain();
    rain.burst("#fff", false);
    rain.clear();
    expect(rain.count()).toBe(0);
    expect(SRC).toMatch(/juice\.clear\(\);\s*\n\s*sparkles\.clear\(\);\s*\n\s*petals\.clear\(\);/);
  });
});

describe("B档视觉 · 整机冒烟(domStub)", () => {
  it("mount 能画剪影不抛错,destroy 后监听清零", async () => {
    const dom = installDom(360, 640);
    try {
      const mod = await import("./index");
      const game = mod.mount({
        root: dom.root as unknown as HTMLElement,
        play: () => {},
        addStars: () => 0,
        getStars: () => 0,
        onWin: () => {},
        onLose: () => {},
      });
      flushFrames(dom, 8);
      // 菜单 → 禅宗模式(第二张卡) → 点开面板进入局内,跑一段让水果起飞
      dom.root.children[0]?.dispatch("pointerdown", { clientX: 180, clientY: 640 * 0.26 + 88 + 40 });
      flushFrames(dom, 3);
      dom.root.children[0]?.dispatch("pointerdown", { clientX: 180, clientY: 320 });
      flushFrames(dom, 60);
      // 划一刀(不要求切中,只验刀光/星花/液滴管线不炸)
      dom.root.children[0]?.dispatch("pointerdown", { clientX: 20, clientY: 320 });
      dom.root.children[0]?.dispatch("pointermove", { clientX: 340, clientY: 300 });
      flushFrames(dom, 6);
      game.destroy();
      expect(windowListenerCount(dom)).toBe(0);
      expect(dom.root.countListeners()).toBe(0);
    } finally {
      restoreDom();
    }
  });
});
