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

describe("音乐星星 · 进阶四场矮横屏双栏(N-73)", () => {
  /**
   * 病根:进阶壳(100–188)纵排 头块134 + 键盘104 + 芯片44 ≈ 323px,915×412 的
   * ~208px 滚动窗装不下——第 167 关简谱视奏「哆」键切底、声音芯片折叠线下。
   * 修法:同一档把进阶壳切「头块左 / 键盘+鼓+选项+工具右」双栏,右栏恒 360px。
   */
  it("进阶壳挂 mst-adv 标记(四场共用),沙盒不挂", () => {
    expect(ADVANCED).toContain('wrap.className = "mst-wrap mst-adv"');
    expect(ADVANCED).toContain('head.className = "mst-adv-head"');
    expect(SANDBOX).not.toContain("mst-adv");
  });

  it("矮横屏双栏:右栏恒 SKY_MAX_PX 键排零裁,头块跨满右栏五个子项", () => {
    const media = UI.match(
      /@media \(max-height:500px\) and \(min-width:700px\)\{\s*\.mst-wrap\.mst-adv\{([\s\S]*?)\n\}/
    );
    expect(media).not.toBeNull();
    const block = media![0];
    expect(block).toContain(`grid-template-columns:minmax(0,1fr) \${SKY_MAX_PX}px`);
    expect(block).toContain(".mst-wrap.mst-adv>.mst-adv-head{grid-column:1;grid-row:1/span 5;");
    expect(block).toMatch(/\.mst-wrap\.mst-adv>\.mst-sky,\.mst-wrap\.mst-adv>\.mst-choices,\s*\.mst-wrap\.mst-adv>\.mst-tools\{grid-column:2;\}/);
  });

  it("头块只收展示件(徽章字号/消息字号),热区选择器一个不碰", () => {
    const media = UI.match(
      /@media \(max-height:500px\) and \(min-width:700px\)\{\s*\.mst-wrap\.mst-adv\{([\s\S]*?)\n\}/
    );
    const block = media![0];
    expect(block).toContain(".mst-wrap.mst-adv .mst-badge{font-size:12px;");
    expect(block).toContain(".mst-wrap.mst-adv .mst-msg{font-size:14px;");
    for (const hot of [".mst-star", ".mst-drum", ".mst-chip", ".mst-btn", ".mst-choice"]) {
      expect(block, `${hot} 是热区,不许出现在这一档`).not.toContain(`${hot}{`);
    }
  });
});
