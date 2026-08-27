/**
 * 守门：这一屏自己滚起来之后，手指落在画布上也得划得动
 * （第 2 轮档A 监督修复员 W5R2-F-A-05，阻断）。
 *
 * 上一轮学习优化员 W5R2-L-02 把「装不下就让这一屏自己滚」做出来了，量出来的数字也真在：
 * `.clf-wrap` 拿到像素 `max-height` + `overflow-y:auto`，390×844 第 170 关上还能往下滚 122px。
 * 可本轮 CDP 真机复测（Chrome headless，真 `touchStart/touchMove/touchEnd`，
 * 命中一律 `document.elementFromPoint(键心)`）拆出来一件事：**滚得到 ≠ 滚得动**。
 *
 *   `.clf-stage` 挂着 `touch-action:none`（给双指捏合缩放用的），
 *   而 `pinCanvas()` 又把画布按滚动量往下钉，让它**恒占滚动视口的上半张**。
 *   于是手指落在画布上一步都划不动——
 *     起手点在画布上（390×844 L170）：`clf-wrap.scrollTop` 0 → **0**
 *     起手点在画布上边那一条（y=300）：`scrollTop` 0 → **122**（满行程）
 *   涂色游戏里手指本来就该落在画布上，等于「调色板整排点不着」这条阻断只修了一半。
 *
 * 改法照档B 第 2 轮 `music-stars` 那一版（`keyPan.test.ts`）：
 * **只在这一屏真的变成滚动容器时**（`clf-scrolly`）把画布的竖向手势让出去；
 * 不滚的屏上画布仍旧是 `touch-action:none`，双指捏合不受影响。
 * 让的是手势不是尺寸，热区一个都没动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLF_CSS } from "./ui";

const UI = readFileSync(fileURLToPath(new URL("./ui.ts", import.meta.url)), "utf8");

/** 从 CSS 里抠出一条规则的声明块 */
function rule(selector: string): string {
  const i = CLF_CSS.indexOf(`${selector}{`);
  if (i < 0) return "";
  return CLF_CSS.slice(i + selector.length + 1, CLF_CSS.indexOf("}", i));
}

describe("涂色小屋 · 这一屏自己滚起来时，画布让出竖向手势", () => {
  it("不滚的屏上画布仍旧锁着手势——双指捏合缩放靠的就是这一条", () => {
    expect(rule(".clf-stage")).toContain("touch-action:none");
  });

  it("滚起来那一档把竖向让给滚动容器", () => {
    expect(CLF_CSS, "没有 .clf-scrolly 这一档").toContain(".clf-wrap.clf-scrolly .clf-stage{");
    const scrolly = rule(".clf-wrap.clf-scrolly .clf-stage");
    expect(scrolly, "画布没让出竖向，手指落在画布上就划不动").toContain("touch-action:pan-y");
    expect(scrolly, "让的是手势，不许顺手改尺寸").not.toMatch(/height|width|padding|margin/);
  });

  it("这一档只在真的挂上滚动条时才生效——`clf-tight` 挂了不等于在滚", () => {
    const fit = UI.slice(UI.indexOf("export function fitColoringStage"), UI.indexOf("export function pinCanvas"));
    // 还原那一段：每次重量之前得把上一次的档位摘干净，不然越量越小
    expect(fit).toContain('wrap.classList.remove("clf-scrolly")');
    // 挂档位这一句必须和写 overflow-y 在同一个分支里
    const branch = fit.slice(fit.indexOf('wrap.style.overflowY = "auto"'));
    expect(branch, "滚动条挂上了却没挂 clf-scrolly").toContain('wrap.classList.add("clf-scrolly")');
    // 收紧档与滚动档是两件事，不许拿 clf-tight 顶替
    expect(CLF_CSS).not.toContain(".clf-wrap.clf-tight .clf-stage{touch-action");
  });

  it("画室那一屏不受影响：它本来就没有 pinCanvas，也不该跟着让手势", () => {
    expect(CLF_CSS).not.toContain(".clf-sheet .clf-stage{touch-action");
  });
});
