/**
 * L-1(trio-r7)· 音乐星星矮横屏双栏的守门。
 *
 * 病根:915×412 一族矮横屏滚动窗只剩 ~208px,「🔁 再听一遍」半截、声音设置四钮
 * (静音/音量/音色/速度)整排折叠线下(r4 原账 4 控;r7 复测 wrap 自滚 80)。
 *
 * 修法:键盘宽有 SKY_MAX_PX=360 上限(hostWidth 封顶),矮横屏(且 ≥700px 宽)把
 * 关卡壳切「徽章+键盘左 / 两条工具行右」grid 双栏,左栏恒 ≥360px 键排一个像素不裁;
 * 「音越高摆越上」的抬升量 60 → SHORT_RISE_PX=28(高低关系与热区不变)。
 * 真机复测 915×412 第 1/70/90 关裁 0 / 线下 0 / 自滚 0;390×844、412×915、1280×800 原样。
 * advanced 视奏台与自由弹奏沙盒不卷入(mst-level 标记只挂关卡壳)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORT_RISE_PX, SKY_MAX_PX } from "./ui";

const UI = readFileSync(fileURLToPath(new URL("./ui.ts", import.meta.url)), "utf8");
const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const ADVANCED = readFileSync(fileURLToPath(new URL("./advanced.ts", import.meta.url)), "utf8");
const SANDBOX = readFileSync(fileURLToPath(new URL("./sandboxUi.ts", import.meta.url)), "utf8");

describe("音乐星星 · 矮横屏双栏(L-1)", () => {
  it("关卡壳挂 mst-level 标记,advanced/沙盒的 .mst-wrap 不卷入", () => {
    expect(INDEX).toContain('wrap.className = "mst-wrap mst-level"');
    expect(ADVANCED).not.toContain("mst-level");
    expect(SANDBOX).not.toContain("mst-level");
  });

  it("max-height:500px 且 ≥700px 宽才切双栏,左栏下限 = SKY_MAX_PX 键排永不裁", () => {
    expect(UI).toMatch(/@media \(max-height:500px\) and \(min-width:700px\)\{/);
    expect(UI).toContain(
      `grid-template-columns:minmax(\${SKY_MAX_PX}px,1fr) minmax(180px,230px)`
    );
    expect(SKY_MAX_PX).toBe(360);
  });

  it("徽章行/键盘进左栏,两条工具行(再听一遍 + 声音设置)进右栏", () => {
    expect(UI).toContain(".mst-wrap.mst-level>.mst-head{grid-column:1;grid-row:1;");
    expect(UI).toContain(".mst-wrap.mst-level>.mst-sky{grid-column:1;grid-row:2;}");
    expect(UI).toContain(".mst-wrap.mst-level>.mst-tools{grid-column:2;}");
  });

  it("矮横屏音高抬升 60 → 28:高低关系保留(单调),量不到 matchMedia 照旧 60", () => {
    expect(SHORT_RISE_PX).toBe(28);
    expect(UI).toMatch(/matchMedia\("\(max-height:500px\)"\)\.matches/);
    expect(UI).toMatch(/count > 1 \? \(shortViewport \? SHORT_RISE_PX : 60\) : 0/);
  });
});

// N-73(简谱视奏琴键切底)在并行批次里撞车:上游 r14 的 mst-scoreplay 档先合入
// (scoreKeys.r14.test.ts 守门),本工位的 mst-adv 双栏按「先合版赢」让位删除。
