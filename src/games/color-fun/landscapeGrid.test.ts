/**
 * L-1(trio-r7)· 涂色小屋矮横屏双栏的守门。
 *
 * 病根:915×412 一族矮横屏里滚动窗只剩 208px,画布地板 180px + 调色板 88px
 * 挤不进同一屏,canPinCanvas 判「钉不住」——孩子涂一块颜色要在画布和调色板
 * 之间来回滚两趟(r4 量得 7 控折叠线下,r7 复测调色板五钮 top≥vh)。
 *
 * 修法:@media (max-height:500px) 把 .clf-wrap 切成「画布左 / 尾队右」grid 双栏,
 * CSS-only,DOM 与 tight/tighter/pinCanvas 机制零触碰;真装不下仍走 clf-scrolly 老路。
 * 真机复测 915×412:第 1 关 / L40 调色锅 / L90 记忆 / L181 限色全部零滚动零线下。
 */
import { describe, expect, it } from "vitest";
import { CLF_CSS } from "./ui";

const media = (): string => {
  const i = CLF_CSS.indexOf("@media (max-height:500px)");
  if (i < 0) return "";
  return CLF_CSS.slice(i, CLF_CSS.indexOf("\n}", i));
};

describe("涂色小屋 · 矮横屏双栏(L-1)", () => {
  it("max-height:500px 档把 .clf-wrap 切成 grid 双栏", () => {
    const body = media();
    expect(body, "缺 @media (max-height:500px) 档").not.toBe("");
    expect(body).toMatch(/\.clf-wrap\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(260px,400px\)/);
  });

  it("左栏只放画布,span 只跨右栏 5 个常驻项(跨空行会凭空长 48px)", () => {
    expect(media()).toContain(".clf-stage{grid-column:1;grid-row:1/span 5;min-height:0;}");
  });

  it("尾队(徽章/指令/工具/调色锅/调色板/消息)全部归右栏", () => {
    expect(media()).toContain(
      ".clf-top,.clf-preview,.clf-legend,.clf-chips,.clf-tools,.clf-mixer,.clf-palette,.clf-msg{grid-column:2;}"
    );
  });

  it("tight/tighter 的 6px 纵缝在这档被压回 4px(特异度补丁)", () => {
    expect(media()).toMatch(/\.clf-wrap\.clf-tighter,\.clf-wrap\.clf-tight\{row-gap:4px;/);
  });

  it("竖屏纵向流原样:基础 .clf-wrap 仍是 flex column", () => {
    expect(CLF_CSS).toMatch(/\.clf-wrap\{display:flex;flex-direction:column/);
  });
});
