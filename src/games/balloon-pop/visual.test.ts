/**
 * 气球砰砰 · 1.3 A 档视觉升级用例（只增不减）。
 *
 * 十二组断言对应任务书第九节：三层皮肤 / 无平涂 / 明暗高光常量 / 贝塞尔线风向映射 /
 * 特殊气球本体差异 / 光圈回归 / dataset 与 aria 回归 / 爆炸三阶段 ≤ 400ms /
 * 裂片参数 / far 几何不动 / Janitor 清理 / 玩法常量回归。
 * 既有玩法测试文件一个断言都没改。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SKIN_HIGHLIGHT_AT,
  SKIN_DARKEN,
  SKIN_LIGHTEN,
  balloonSkin,
  balloonSkinLayers,
  splitLayers,
} from "../../art/kit/balloonSkin";
import { shade } from "../../art/kit/palette";
import { LEVELS } from "./levels";
import {
  CHAIN_MIN,
  CHAIN_WINDOW_MS,
  FAR_SCALE,
  GIFT_RISE_MUL,
  Janitor,
  KINDS,
  SWAY_AMP_PX,
  SWAY_SPEED,
  windSign,
} from "./logic";
import {
  BALLOON_COLORS,
  BLP_TIMINGS,
  BLP_TOKENS,
  CLOUD_PARALLAX,
  FAR_BLUR_PX,
  FAR_SWAY_RATIO,
  GIFT_SWAY_DEG,
  KIND_KEYS,
  LABEL_PLATE_ALPHA,
  LABEL_TOP_PCT,
  MIN_DECOR_PX,
  NIGHT_STARS,
  RIVET_PX,
  SHARD_COUNT,
  STAR_CLIP,
  STRING_SLACK_PX,
  STRING_WIND_BEND_PX,
  SWELL_SCALE,
  TWIN_BUDDY_SCALE,
  balloonKey,
  burstTotalMs,
  colorSkin,
  decorVisible,
  giftBoxSvg,
  ironSkin,
  kindSkin,
  shardCount,
  shardVectors,
  skyDecorHtml,
  stringControlOffsetPx,
  stringPathD,
  stringSvg,
  timingsCss,
  tokensCss,
  twinRibbonSvg,
} from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("气球砰砰 · 1.3 视觉 · ① 三层皮肤（平涂机器化断言）", () => {
  it("balloonSkin 输出恰好三层背景，含两处以上 radial-gradient", () => {
    const bg = balloonSkin(BALLOON_COLORS[0].key);
    expect(splitLayers(bg)).toHaveLength(3);
    expect((bg.match(/radial-gradient\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("② 遍历五色与全部机关球：没有一颗气球的 background 是单一纯色", () => {
    for (let i = 0; i < BALLOON_COLORS.length; i++) {
      const bg = colorSkin(i);
      expect(bg, `${BALLOON_COLORS[i].name}色`).toContain("gradient(");
      expect(splitLayers(bg), `${BALLOON_COLORS[i].name}色`).toHaveLength(3);
      expect(bg).not.toBe(BALLOON_COLORS[i].key);
    }
    for (const kind of ["cloud", "rainbow", "chain", "gift"] as const) {
      expect(kindSkin(kind), kind).toContain("gradient(");
    }
    // 铁壳走五色皮肤 + 条纹，也不是平涂
    expect(ironSkin(BALLOON_COLORS[2].key)).toContain("gradient(");
    // 彩虹保留六色转轮，但顶上有主高光那一层
    expect(kindSkin("rainbow")).toContain("conic-gradient");
    expect(kindSkin("rainbow")).toContain("rgba(255,255,255,.85)");
  });

  it("③ 明暗换算 +8 / -12 与高光位置 28%,22% 常量一测", () => {
    expect(SKIN_LIGHTEN).toBe(8);
    expect(SKIN_DARKEN).toBe(-12);
    expect(SKIN_HIGHLIGHT_AT).toEqual({ x: 28, y: 22 });
    const body = balloonSkinLayers("#F0605F")[2];
    expect(body).toContain(shade("#F0605F", 8));
    expect(body).toContain(shade("#F0605F", -12));
  });
});

describe("气球砰砰 · 1.3 视觉 · ④ 贝塞尔气球线（读 AirCfg 不改）", () => {
  it("控制点偏移 = 风向常量 × 6px，无风垂坠 2px", () => {
    expect(STRING_WIND_BEND_PX).toBe(6);
    expect(STRING_SLACK_PX).toBe(2);
    expect(stringControlOffsetPx(1)).toBe(6);
    expect(stringControlOffsetPx(-1)).toBe(-6);
    expect(stringControlOffsetPx(0)).toBe(2);
    expect(stringPathD(1)).toContain("Q");
    expect(stringSvg(-1)).toContain("blp-string");
  });

  it("风向映射读的是既有 windSign，飘动逻辑常量一个没动", () => {
    // windSign 行为回归：4200ms 翻面周期，前半右吹、后半左吹
    expect(windSign(0, 4200)).toBe(1);
    expect(windSign(4.3, 4200)).toBe(-1);
    expect(SWAY_SPEED).toBe(2);
    expect(SWAY_AMP_PX).toBe(8);
    expect(GIFT_RISE_MUL).toBe(0.45);
    expect(SRC).toContain("windSign(clock, cfg.windFlipMs)");
  });
});

describe("气球砰砰 · 1.3 视觉 · ⑤⑥ 特殊气球双通道", () => {
  it("⑤ 三种本体差异层存在：铁纹 / 丝带 / 礼盒", () => {
    expect(ironSkin("#4F94E8")).toContain("repeating-linear-gradient");
    expect(twinRibbonSvg("#F0605F")).toContain("blp-ribbon");
    expect(twinRibbonSvg("#F0605F")).toContain("<path");
    expect(giftBoxSvg()).toContain("blp-giftbox");
    expect(giftBoxSvg()).toContain("<rect");
    // index.ts 真把三种差异件挂上去了
    expect(SRC).toContain("blp-buddy");
    expect(SRC).toContain("twinRibbonSvg(");
    expect(SRC).toContain("giftBoxSvg(");
    expect(SRC).toContain("ironSkin(");
  });

  it("⑤ 补:铆钉两点画在铁壳本体上,双子副球 82% 缩放", () => {
    expect(ironSkin("#4F94E8", 1)).toContain("#5B6472");
    expect(TWIN_BUDDY_SCALE).toBe(0.82);
    expect(SRC).toContain("${TWIN_BUDDY_SCALE * 100}%");
  });

  it("⑥ 铁壳 / 双子 / 礼物的 box-shadow 光圈原样保留（色觉双通道回归）", () => {
    expect(SRC).toContain(".blp-shielded { box-shadow: 0 0 0 4px #C9D8E8, 0 0 0 6px rgba(160,190,220,.5); }");
    expect(SRC).toContain(".blp-twin { box-shadow: 0 0 0 3px #FFE1F0, 0 0 0 5px rgba(240,150,200,.6); }");
    expect(SRC).toContain(".blp-gift { box-shadow: 0 0 0 3px #FFF0C4, 0 0 0 6px rgba(230,180,90,.45); }");
  });

  it("低于 8px 的装饰件在 far 缩放下自动省略（铆钉 / 蝴蝶结）", () => {
    expect(MIN_DECOR_PX).toBe(8);
    expect(decorVisible(RIVET_PX, 1)).toBe(true);
    expect(decorVisible(RIVET_PX, FAR_SCALE)).toBe(false);
    expect(ironSkin("#4F94E8", FAR_SCALE)).not.toContain("#5B6472");
    expect(twinRibbonSvg("#F0605F", FAR_SCALE)).not.toContain("<circle");
    expect(giftBoxSvg(FAR_SCALE)).not.toContain("Q6 -0.5");
  });
});

describe("气球砰砰 · 1.3 视觉 · ⑦ dataset 与 aria-label 回归", () => {
  it("dataset 状态镜像换肤后原样（自动冒烟脚本依赖）", () => {
    expect(SRC).toContain("node.dataset.kind = b.kind;");
    expect(SRC).toContain("node.dataset.num = String(b.num);");
    expect(SRC).toContain("node.dataset.color = String(b.color);");
    expect(SRC).toContain('node.dataset.shield = b.kind === "iron" ? "1" : "0";');
  });

  it("aria-label 语义信息原样：颜色名 + 种类名", () => {
    expect(SRC).toContain('node.setAttribute("aria-label", `${BALLOON_COLORS[b.color].name}色${KINDS[b.kind].name}`)');
    // 颜色名与 1.2 一致
    expect(BALLOON_COLORS.map((c) => c.name)).toEqual(["红", "黄", "蓝", "绿", "紫"]);
    expect(BALLOON_COLORS.map((c) => c.key)).toEqual(["#F0605F", "#F5C142", "#4F94E8", "#6BBB4E", "#9E6BD9"]);
  });
});

describe("气球砰砰 · 1.3 视觉 · ⑧⑨ 爆炸三阶段与裂片", () => {
  it("⑧ 三阶段总时长 ≤ 400ms（分段常量求和），鼓胀 60ms × 1.15 倍", () => {
    expect(BLP_TIMINGS.swellMs).toBe(60);
    expect(BLP_TIMINGS.flashMs).toBe(16);
    expect(BLP_TIMINGS.shardMs).toBe(320);
    expect(burstTotalMs()).toBe(BLP_TIMINGS.swellMs + BLP_TIMINGS.flashMs + BLP_TIMINGS.shardMs);
    expect(burstTotalMs()).toBeLessThanOrEqual(400);
    expect(SWELL_SCALE).toBe(1.15);
  });

  it("⑨ 裂片 5 片、寿命 320ms、reduced 下为 0", () => {
    expect(SHARD_COUNT).toBe(5);
    expect(shardCount(false)).toBe(5);
    expect(shardCount(true)).toBe(0);
    const vecs = shardVectors();
    expect(vecs).toHaveLength(5);
    const seen = new Set(vecs.map((v) => `${v.dx},${v.dy}`));
    expect(seen.size).toBe(5);
    for (const v of vecs) {
      expect(Number.isFinite(v.dx)).toBe(true);
      expect(Number.isFinite(v.dy)).toBe(true);
      expect(v.rot).not.toBe(0);
    }
  });

  it("reduced：裂片与云移礼盒摆动全停，白闪保留（功能反馈）", () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/.exec(SRC)?.[0] ?? "";
    expect(reduced).toContain(".blp-shard");
    expect(reduced).toContain(".blp-cloudpuff");
    expect(reduced).toContain(".blp-giftbox");
    expect(reduced).not.toContain(".blp-flash");
  });

  it("彩纸升级成星星 / 圆点混合，星星是五角 clip-path", () => {
    expect(STAR_CLIP.startsWith("polygon(")).toBe(true);
    expect(SRC).toContain("blp-bit blp-bit-star");
    expect(SRC).toContain("blp-bit blp-bit-dot");
  });
});

describe("气球砰砰 · 1.3 视觉 · ⑩ 几何红线：热区一个像素不动", () => {
  it("气球按钮 56×68，far 缩放沿用旧值 0.72", () => {
    expect(FAR_SCALE).toBe(0.72);
    expect(SRC).toMatch(/\.blp-balloon \{ position: absolute; width: 56px; height: 68px;/);
    expect(SRC).toContain("Math.round(56 * FAR_SCALE)");
    expect(SRC).toContain("Math.round(68 * FAR_SCALE)");
  });

  it("远景纵深是纯渲染：blur 0.6px + 摆幅 60%，逻辑位置不折算", () => {
    expect(FAR_BLUR_PX).toBe(0.6);
    expect(FAR_SWAY_RATIO).toBe(0.6);
    const hits = SRC.match(/pos\.swayPx \* \(b\.far \? FAR_SWAY_RATIO : 1\)/g) ?? [];
    expect(hits.length).toBe(2);
    // b.x / b.y 的赋值原样（连锁与命中都读它们）
    expect(SRC).toContain("b.x = pos.x;");
    expect(SRC).toContain("b.y = pos.y;");
  });
});

describe("气球砰砰 · 1.3 视觉 · ⑪ Janitor 清理", () => {
  it("裂片 / 白闪的生灭都挂在 jan.after 上，destroy 后 pending 归零", () => {
    expect(SRC).toContain("flash.remove()");
    expect(SRC).toMatch(/jan\.after\(BLP_TIMINGS\.swellMs \+ BLP_TIMINGS\.shardMs \+ 40, \(\) => s\.remove\(\)\)/);
    const cleared = { timeouts: 0 };
    const jan = new Janitor({
      setTimeout: () => 1 + Math.random(),
      clearTimeout: () => {
        cleared.timeouts++;
      },
    });
    // 模拟一次爆炸挂的计时：白闪 1 个 + 裂片 5 × 2 个
    jan.after(BLP_TIMINGS.swellMs + BLP_TIMINGS.flashMs + 60, () => undefined);
    for (let i = 0; i < SHARD_COUNT; i++) {
      jan.after(16, () => undefined);
      jan.after(BLP_TIMINGS.swellMs + BLP_TIMINGS.shardMs + 40, () => undefined);
    }
    expect(jan.pending()).toBe(1 + SHARD_COUNT * 2);
    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(cleared.timeouts).toBe(1 + SHARD_COUNT * 2);
  });
});

describe("气球砰砰 · 1.3 视觉 · ⑫ 玩法常量回归（视觉升级零波及）", () => {
  it("连锁 / 目标 / 关卡表的关键常量一个没变", () => {
    expect(CHAIN_MIN).toBe(3);
    expect(CHAIN_WINDOW_MS).toBe(250);
    expect(LEVELS).toHaveLength(188);
    expect(LEVELS[0]).toEqual({
      target: 10,
      escapes: 4,
      riseSpeed: 55,
      spawnMs: 950,
      mode: "free",
      cloudChance: 0,
      rainbowChance: 0,
      night: false,
    });
    expect(Object.keys(KINDS).sort()).toEqual(["chain", "cloud", "gift", "iron", "normal", "rainbow", "twin"]);
  });
});

describe("气球砰砰 · 1.3 视觉 · token / 时序 / 天空装饰细则", () => {
  it("--blp- token 按规格表落成常量并铺进 CSS", () => {
    expect(BLP_TOKENS).toEqual({
      "--blp-sky-top": "#DFF2FF",
      "--blp-sky-bottom": "#FFF4FA",
      "--blp-cloud": "rgba(255,255,255,.65)",
      "--blp-night-sky": "#2E2A55",
      "--blp-moon": "#FFF3C9",
    });
    const css = tokensCss();
    for (const [k, v] of Object.entries(BLP_TOKENS)) expect(css).toContain(`${k}: ${v};`);
    expect(SRC).toContain("${tokensCss()}");
    expect(SRC).toContain("${timingsCss()}");
  });

  it("动效时长全部写成 CSS 自定义属性；软云两层 0.1×/0.2× 视差成反比", () => {
    const css = timingsCss();
    for (const name of ["--blp-swell-ms", "--blp-flash-ms", "--blp-shard-ms", "--blp-gift-drop-ms", "--blp-gift-sway-ms", "--blp-cloud-slow-ms", "--blp-cloud-fast-ms"]) {
      expect(css).toContain(name);
    }
    expect(CLOUD_PARALLAX).toEqual([0.1, 0.2]);
    // 视差 × 周期相等 ⇒ 快层速度恰是慢层两倍
    expect(BLP_TIMINGS.cloudSlowMs * CLOUD_PARALLAX[0]).toBe(BLP_TIMINGS.cloudFastMs * CLOUD_PARALLAX[1]);
  });

  it("礼盒缓落 500ms ease-in、常驻摆动 ±3° / 1100ms", () => {
    expect(BLP_TIMINGS.giftDropMs).toBe(500);
    expect(BLP_TIMINGS.giftSwayMs).toBe(1100);
    expect(GIFT_SWAY_DEG).toBe(3);
    expect(SRC).toContain("blpGiftDrop var(--blp-gift-drop-ms, .5s) ease-in");
    expect(SRC).toContain('classList.add("blp-gift-drop")');
  });

  it("数字 / 算式衬牌：55% 高度白底 .82，不压主高光", () => {
    expect(LABEL_TOP_PCT).toBe(55);
    expect(LABEL_PLATE_ALPHA).toBe(0.82);
    expect(LABEL_TOP_PCT).toBeGreaterThan(SKIN_HIGHLIGHT_AT.y);
    expect(SRC).toContain("top: ${LABEL_TOP_PCT}%");
    expect(SRC).toContain("rgba(255,255,255,${LABEL_PLATE_ALPHA})");
  });

  it("天空装饰：白天两层软云；夜关月亮 + 星子，星子聚在上部不压出球区", () => {
    const day = skyDecorHtml(false);
    expect((day.match(/blp-cloudpuff/g) ?? []).length).toBe(2);
    expect(day).not.toContain("blp-moon");
    const night = skyDecorHtml(true);
    expect(night).toContain("blp-moon");
    expect((night.match(/blp-starlet/g) ?? []).length).toBe(NIGHT_STARS.length);
    for (const [, y] of NIGHT_STARS) expect(y).toBeLessThanOrEqual(30);
  });

  it("气球主色与裂片同源：balloonKey 普通按五色、机关按代表色", () => {
    expect(balloonKey("normal", 0)).toBe("#F0605F");
    expect(balloonKey("iron", 2)).toBe("#4F94E8");
    expect(balloonKey("gift", 0)).toBe(KIND_KEYS.gift);
    expect(balloonKey("chain", 4)).toBe(KIND_KEYS.chain);
    expect(SRC).toContain("burstFx(skyEl, px, b.y, balloonKey(b.kind, b.color), reduce, jan)");
  });
});
