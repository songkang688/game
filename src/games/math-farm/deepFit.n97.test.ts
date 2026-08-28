/**
 * N-97：math-farm root×末章末关(应用题两行题面 + 🎫 直达行)把矮横屏宿主
 * 可视段(~164px)吃光,三块答案木牌初见掉到 412 线下(r17 实测 top 416)。
 * 修法全在 MTF_CSS 的 max-height:500px 档:
 *  1. 答案行 sticky 钉宿主可视段底(装得下时不产生位移,L1 勿动);
 *  2. 应用题题面收到正文红线 16px;
 *  3. root 开着(:has(.qz-jump))把徽章/进度条/朗读/直达排到答案后面滚。
 * 题库 / 判分 / seed / quiz99 壳文件零触碰。
 */
import { describe, expect, it } from "vitest";
import { FARM_CSS } from "./farmScene";
import { MTF_CSS, MIN_VERT_PX } from "./runner";

function shortBlock(): string {
  const at = MTF_CSS.indexOf("@media (max-height: 500px)");
  expect(at, "MTF_CSS 应有 max-height:500px 档").toBeGreaterThanOrEqual(0);
  const next = MTF_CSS.indexOf("@media", at + 1);
  return MTF_CSS.slice(at, next > 0 ? next : undefined);
}

describe("N-97 math-farm root×深关答案行", () => {
  it("矮横屏答案行 sticky 钉宿主可视段底", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.mtf-quizhost \.qz-choices \{ position: sticky; bottom: 0/);
  });

  it("应用题题面矮横屏收到 16px 正文红线(基础态 19px 不动)", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.mtf-word \{ font-size: 16px/);
    const base = MTF_CSS.slice(0, MTF_CSS.indexOf("@media"));
    expect(base).toMatch(/\.mtf-word \{[^}]*font-size: 19px/);
  });

  it("root 开着才重排:徽章/进度条/朗读/直达让位给题面+答案", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.mtf-quizhost:has\(\.qz-jump\) \.qz-wrap > \.qz-bar \{ display: none/);
    expect(block).toMatch(/\.mtf-quizhost:has\(\.qz-jump\) \.qz-say-row \{ order: 7/);
    expect(block).toMatch(/\.mtf-quizhost:has\(\.qz-jump\) \.qz-top \{ order: 8/);
    expect(block).toMatch(/\.mtf-quizhost:has\(\.qz-jump\) \.qz-jump \{ order: 9/);
  });

  it("N-44 既有钳位不回退:插图钳高(FARM_CSS)与竖式底线原样", () => {
    expect(FARM_CSS).toMatch(/\.mtf-illus:not\(\.mtf-illus-count\) \{ max-height: 56px/);
    const block = shortBlock();
    expect(block).toContain(`.mtf-vert-row { font-size: ${MIN_VERT_PX}px`);
    expect(MIN_VERT_PX).toBe(22);
  });
});
