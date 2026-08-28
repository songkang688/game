/**
 * 钓鱼小达人 · 1.3 视觉升级(22 步 B 档)用例。
 *
 * 三类断言:
 *  1. 纯映射函数的契约(配色 token / 时序表 / 涟漪密度 / 浮标点头 / 钓竿弯曲 / reduced);
 *  2. 源码字符串回归:鱼群不再 fillText emoji、游动演算三行一字不动、图层序落位;
 *  3. 玩法判定常量零漂移(视觉只读它们做映射,谁都不许动)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FISH, GOOD_AT, MAX_DEPTH, RED_AT, RED_SNAP_MS, SNAP_AT, TIGHT_AT } from "./logic";
import { FISH_PATTERN_MIN_PX, depthFade, specForFish, tailWagPhase } from "../../art/kit/fishArt";
import {
  FSH_LAYER_ORDER,
  FSH_LINE_REFRACT_PX,
  FSH_ROD_BEND_MAX,
  FSH_TIMING,
  FSH_TOKENS,
  FishingFx,
  bobberDipPx,
  bubbleAt,
  easeInQuad,
  easeOutQuad,
  goldFlashAlpha,
  leapPoint,
  lineSplit,
  rippleGapMs,
  rippleRing,
  rodBendOf,
  splashDropAt,
  wagOf,
  waveShift,
} from "./visual";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");

describe("1. 配色 token 与四·补一逐字一致", () => {
  it("九枚 token 名与色值全对", () => {
    expect(FSH_TOKENS).toEqual({
      fshSkyTop: "#DFF2FF",
      fshWaterHi: "#A8D8F0",
      fshWaterLo: "#4A7FA8",
      fshWave: "rgba(255,255,255,.35)",
      fshShore: "#E8D5A8",
      fshBobberA: "#E85D75",
      fshBobberB: "#FFFFFF",
      fshRare: "#F0C25A",
      fshShadow: "rgba(40,70,100,.2)",
    });
  });

  it("每一枚都是合法颜色字面量", () => {
    for (const v of Object.values(FSH_TOKENS)) {
      expect(/^#[0-9A-F]{6}$/i.test(v) || /^rgba\(\d+,\d+,\d+,\.?\d*\)$/.test(v), `${v} 不是合法颜色`).toBe(true);
    }
  });

  it("动效时序表与四·补三逐项一致", () => {
    expect(FSH_TIMING).toEqual({
      waveMsA: 5200,
      waveMsB: 6800,
      bubbleMs: 4000,
      bubbleMax: 6,
      rippleMs: 600,
      rippleDense: 2,
      bobberNodMs: 160,
      bobberNodPx: 3,
      leapMs: 240,
      splashMs: 320,
      splashDrops: 5,
      rareFlashMs: 260,
    });
  });
});

describe("2. 鱼群自绘接线(25 种鱼都有皮)", () => {
  it("全部 25 种鱼都能领到确定性的鱼种 spec,传说鱼固定金鳞", () => {
    for (const f of FISH) {
      const spec = specForFish(f.id, f.rarity);
      expect(spec).toBeTruthy();
      expect(spec).toBe(specForFish(f.id, f.rarity));
      if (f.rarity >= 5) expect(spec.skin).toBe("gold");
    }
    const keys = new Set(FISH.map((f) => specForFish(f.id, f.rarity).key));
    expect(keys.size).toBeGreaterThanOrEqual(5);
  });
});

describe("3. drawSwimmers 不再 fillText emoji", () => {
  it("源码里没有任何 .emoji 进 fillText", () => {
    expect(shell).not.toMatch(/fillText\([^)]*\.emoji/);
  });

  it("画布上残留的 fillText 只剩功能文本(鱼群带/木尺/落点预览/风向),无一枚 emoji", () => {
    const uses = [...shell.matchAll(/fillText\(([^\n]*)\)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) {
      expect(/\p{Extended_Pictographic}/u.test(u), `fillText 里还有 emoji: ${u}`).toBe(false);
    }
  });

  it("鱼群走 kit 的 drawKitFish,深水先画浅水后画", () => {
    const at = shell.indexOf("function drawSwimmers()");
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("drawKitFish(");
    expect(body).toContain("sort((a, b) => b.depth - a.depth)");
  });
});

describe("4. 摆尾相位与朝向接线", () => {
  it("相位公式 x×0.05+speed×2;reduced 归零(摆尾停)", () => {
    expect(wagOf(100, 0.05, false)).toBeCloseTo(tailWagPhase(100, 0.05), 10);
    expect(wagOf(100, 0.05, false)).toBeCloseTo(100 * 0.05 + 0.05 * 2, 10);
    expect(wagOf(100, 0.05, true)).toBe(0);
  });

  it("index 把速度符号交给 facingOf、把 px/speed 交给 wagOf", () => {
    const at = shell.indexOf("function drawSwimmers()");
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("facing: facingOf(s.speed)");
    expect(body).toContain("wagPhase: wagOf(px, s.speed, reduced)");
  });
});

describe("5. 深度映射只读、演算数据零改动", () => {
  it("深水:饱和度 -30%、alpha 0.7", () => {
    expect(depthFade(MAX_DEPTH, MAX_DEPTH).sat).toBeCloseTo(0.7, 10);
    expect(depthFade(MAX_DEPTH, MAX_DEPTH).alpha).toBeCloseTo(0.7, 10);
    expect(depthFade(0, MAX_DEPTH)).toEqual({ sat: 1, alpha: 1 });
  });

  it("游动演算三行一字不动(x/px/py)", () => {
    expect(shell).toContain("const x = ((s.x + (ambient / 1000) * s.speed) % 1 + 1) % 1;");
    expect(shell).toContain("const px = 12 + x * (W - 46);");
    expect(shell).toContain("const py = yOfDepth(s.depth) + Math.sin(ambient / 600 + s.x * 9) * 3;");
  });

  it("makeSwimmers 的 depth/x/speed 生成与深度换算 yOfDepth 原样", () => {
    expect(shell).toContain("depth: layer.from + rand() * (layer.to - layer.from),");
    expect(shell).toContain("speed: (0.02 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),");
    expect(shell).toContain("return top + (clamp(d, 0, MAX_DEPTH) / MAX_DEPTH) * (H - top - 4);");
  });
});

describe("6. 花纹层门槛与鱼尺寸 clamp", () => {
  it("门槛 15px;鱼的最小渲染尺寸 clamp(W/22,13,22) 沿用", () => {
    expect(FISH_PATTERN_MIN_PX).toBe(15);
    expect(shell).toContain("clamp(W / 22, 13, 22)");
  });
});

describe("7. 钓线两段与入水折射", () => {
  it("分界点 = 入水点(钩子正上方的水面),水下段起笔错位恰好 2px", () => {
    const split = lineSplit(120, 36);
    expect(split.entryX).toBe(120);
    expect(split.entryY).toBe(36);
    expect(split.underX - split.entryX).toBe(FSH_LINE_REFRACT_PX);
    expect(FSH_LINE_REFRACT_PX).toBe(2);
  });

  it("index 的空中段与水下段都吃 lineSplit,同一个入水点", () => {
    const under = shell.slice(shell.indexOf("function drawLineUnder()"), shell.indexOf("function drawBobber("));
    const air = shell.slice(shell.indexOf("function drawLineAir()"), shell.indexOf("function observeFx()"));
    expect(under).toContain("lineSplit(hx, surfaceY())");
    expect(air).toContain("lineSplit(hx, surfaceY())");
    expect(under).toContain("split.underX");
    expect(air).toContain("split.entryX");
  });
});

describe("8. 涟漪密度只读上钩窗口", () => {
  it("窗口内加密 2 倍:间隔恰好折半", () => {
    expect(rippleGapMs(false) / rippleGapMs(true)).toBeCloseTo(FSH_TIMING.rippleDense, 10);
    expect(rippleGapMs(false)).toBeCloseTo(900, 10);
    expect(rippleGapMs(true)).toBeCloseTo(450, 10);
  });

  it("观察哨只读 phase 布尔,不碰 biteWindow 判定变量", () => {
    const obs = shell.slice(shell.indexOf("function observeFx()"), shell.indexOf("function drawFx()"));
    expect(obs).toContain('rippleGapMs(phase === "bite")');
    expect(obs).not.toContain("biteWindow");
  });

  it("上钩窗口常量零漂移:BITE_WINDOW_MS = 400,仍旧只被装备加成读走", () => {
    expect(shell).toContain("const BITE_WINDOW_MS = 400;");
    expect(shell).toContain("let biteWindow = BITE_WINDOW_MS + bonus.reactionMs;");
  });

  it("涟漪圆环 600ms ease-out:半径涨、透明度落", () => {
    const a = rippleRing(0);
    const b = rippleRing(1);
    expect(a.k).toBeCloseTo(0.25, 10);
    expect(b.k).toBeCloseTo(1, 10);
    expect(a.alpha).toBeCloseTo(0.5, 10);
    expect(b.alpha).toBeCloseTo(0, 10);
  });
});

describe("9. 浮标点头只在上钩窗口", () => {
  it("窗口外恒 0;窗口内 160ms ease-in 沉到 3px", () => {
    expect(bobberDipPx(9999, false, false)).toBe(0);
    expect(bobberDipPx(0, true, false)).toBe(0);
    expect(bobberDipPx(80, true, false)).toBeCloseTo(3 * easeInQuad(0.5), 10);
    expect(bobberDipPx(160, true, false)).toBe(3);
    expect(bobberDipPx(400, true, false)).toBe(3);
  });

  it("reduced 也保留点头(功能提示),直接沉到位", () => {
    expect(bobberDipPx(0, true, true)).toBe(3);
    expect(bobberDipPx(0, false, true)).toBe(0);
  });

  it("index 只在 bite 相位给它喂非零时长", () => {
    expect(shell).toContain("bobberDipPx(inBite ? phaseMs : 0, inBite, reduceMotion())");
    expect(shell).toContain('const inBite = phase === "bite";');
  });
});

describe("10. 钓竿弯曲量 = 力度的线性图形化(逐点一致)", () => {
  it("0 / 0.5 / 1 三点:bend/max 与旧力度值一致", () => {
    expect(rodBendOf(0)).toBe(0);
    expect(rodBendOf(0.5) / FSH_ROD_BEND_MAX).toBeCloseTo(0.5, 10);
    expect(rodBendOf(1) / FSH_ROD_BEND_MAX).toBeCloseTo(1, 10);
    expect(rodBendOf(1.7)).toBe(FSH_ROD_BEND_MAX);
    expect(rodBendOf(-1)).toBe(0);
  });

  it("index 蓄力吃 power、拉扯吃 fight.tension,都是只读", () => {
    expect(shell).toContain("rodBendOf(power)");
    expect(shell).toContain("rodBendOf(clamp(fight.tension, 0, 1))");
  });
});

describe("11. reduced 全套接线与 destroy 归零", () => {
  it("波光/气泡/摆尾/弧线在 reduced 下全部静止或瞬移", () => {
    expect(waveShift(2600, 5200, false)).toBeCloseTo(0.5, 10);
    expect(waveShift(2600, 5200, true)).toBe(0);
    expect(bubbleAt(2, 1000, true)).toEqual(bubbleAt(2, 987654, true));
    expect(wagOf(50, 0.03, true)).toBe(0);
    const p = leapPoint(100, 40, 60, 20, 0, true);
    expect(p).toEqual({ x: 60, y: 20, s: 1 });
  });

  it("鱼跃弧线:非 reduced 时中段真的在弦线上方(有弧)", () => {
    const mid = leapPoint(100, 40, 60, 40, 0.5, false);
    expect(mid.y).toBeLessThan(40);
    expect(leapPoint(100, 40, 60, 20, 1, false).x).toBeCloseTo(60, 10);
  });

  it("稀有金光:动效版 260ms 从 0.9 淡出,reduced 给恒定静态金边", () => {
    expect(goldFlashAlpha(0, false)).toBeCloseTo(0.9, 10);
    expect(goldFlashAlpha(FSH_TIMING.rareFlashMs, false)).toBe(0);
    expect(goldFlashAlpha(0, true)).toBe(0.55);
    expect(goldFlashAlpha(9999, true)).toBe(0.55);
  });

  it("reduced 不生成水花、涟漪改静态圆环(提示保留)", () => {
    const obs = shell.slice(shell.indexOf("function observeFx()"), shell.indexOf("function drawFx()"));
    expect(obs).toContain("if (!reduced) fx.spawnSplash(");
    const fxBody = shell.slice(shell.indexOf("function drawFx()"), shell.indexOf("function render()"));
    expect(fxBody).toMatch(/if \(reduced\) \{\s*if \(phase === "bite"\)/);
  });

  it("FX 池:生成/过期/一把清零", () => {
    const fx = new FishingFx();
    fx.spawnRipple(10, 20, 1000);
    fx.spawnSplash(10, 20, 1000);
    fx.startLeap(10, 20, 5, 8, 1000, true, "yueya-ji", 1);
    expect(fx.count()).toBe(3);
    fx.prune(1000 + 100);
    expect(fx.count()).toBe(3);
    fx.prune(1000 + 600);
    expect(fx.count()).toBe(0);
    fx.spawnRipple(1, 2, 3000);
    fx.reset();
    expect(fx.count()).toBe(0);
    expect(fx.lastRippleAt).toBe(0);
  });

  it("destroy 里清 FX:fx.reset 与 stars.clear 都在", () => {
    const body = shell.slice(shell.indexOf("    destroy() {"));
    const head = body.slice(0, body.indexOf("wrap.remove();"));
    expect(head).toContain("fx.reset();");
    expect(head).toContain("stars.clear();");
  });
});

describe("12. 图层序与判定常量零漂移", () => {
  it("图层序常量:①天空 → ⑪HUD 共 11 层", () => {
    expect([...FSH_LAYER_ORDER]).toEqual([
      "backdrop",
      "shore",
      "deep",
      "shafts",
      "swimmers",
      "lineUnder",
      "surface",
      "lineAir",
      "fx",
      "gauges",
      "hud",
    ]);
  });

  it("render 按图层序落笔:从底到顶一处不乱", () => {
    const at = shell.indexOf("  function render(): void {");
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    const calls = [
      "drawBackdrop()",
      "drawShore()",
      "drawWater()",
      "drawSwimmers()",
      "drawLineUnder()",
      "drawSurface()",
      "drawLineAir()",
      "drawFx()",
      "drawBand()",
      "drawRuler()",
      "drawAim()",
    ];
    let last = -1;
    for (const c of calls) {
      const idx = body.indexOf(c);
      expect(idx, `render 里缺了 ${c}`).toBeGreaterThan(-1);
      expect(idx, `${c} 的图层序不对`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("上钩/张力判定常量一个都没漂(视觉只读它们)", () => {
    expect(SNAP_AT).toBe(1);
    expect(RED_AT).toBe(0.82);
    expect(RED_SNAP_MS).toBe(1200);
    expect(TIGHT_AT).toBe(0.68);
    expect(GOOD_AT).toBe(0.28);
  });

  it("水花皇冠恰好 5 瓣,瓣与瓣方向两两不同,ease-out 越飞越小", () => {
    expect(FSH_TIMING.splashDrops).toBe(5);
    const dirs = new Set<string>();
    for (let i = 0; i < FSH_TIMING.splashDrops; i++) {
      const d = splashDropAt(i, 0.5);
      dirs.add(`${d.dx.toFixed(4)}|${d.dy.toFixed(4)}`);
    }
    expect(dirs.size).toBe(5);
    expect(splashDropAt(0, 1).r).toBeLessThan(splashDropAt(0, 0).r);
    expect(easeOutQuad(0.5)).toBeCloseTo(0.75, 10);
  });
});
