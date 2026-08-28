/**
 * S-2(trio-r5):l99 星级从 ★ 字符改 12×12 内联 SVG。
 * 窗口 1/2/3/5 四窗点名的跨窗老账:10–12px 的字符星在手机上只剩一团糊点。
 * 钉住:SVG 星形在场且随容器字号缩放、双态类名不变、字号不再往 12px 以下压、
 * S-4 顺手账(管理员跳关输入框热区 38→44)不许回退。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { starRowHTML } from "./level99";

const SRC = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");

describe("S-2 星级 SVG", () => {
  it("星是 12×12 viewBox 的内联 SVG,尺寸 1em 跟着容器字号走", () => {
    const html = starRowHTML(2);
    expect(html).toContain('viewBox="0 0 12 12"');
    expect(html).toContain('width="1em"');
    expect(html).toContain('height="1em"');
    expect(html).toContain('fill="currentColor"');
    expect(html).not.toContain("★");
  });

  it("亮灭仍由 l99-star / l99-star-on 双态类决定,3 颗一排", () => {
    const two = starRowHTML(2);
    expect(two.match(/class="l99-star l99-star-on"/g)?.length).toBe(2);
    expect(two.match(/<svg /g)?.length).toBe(3);
    expect(starRowHTML(0).match(/l99-star-on/g) ?? []).toHaveLength(0);
    expect(starRowHTML(3).match(/l99-star-on/g)?.length).toBe(3);
  });

  it("装饰星对读屏隐藏(关卡按钮的 aria-label 已经把星数念出来了)", () => {
    expect(starRowHTML(1)).toContain('aria-hidden="true"');
  });

  it("节点星 12px 起步,窄屏块不许再把它往下压", () => {
    expect(SRC).toMatch(/\.l99-node-stars\{font-size:12px/);
    // 老毛病:@media (max-width:420px) 里曾把 .l99-node-stars 压到 10px
    const narrow = /@media \(max-width:420px\)\{([\s\S]*?)\n\}/.exec(SRC);
    expect(narrow?.[1] ?? "").not.toContain("l99-node-stars");
  });

  it("S-4:管理员跳关输入框热区 ≥44px", () => {
    const m = /\.l99-jump-input\{[^}]*min-height:(\d+)px/.exec(SRC);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });
});

describe("N-37 关内管理员抬头矮横屏收紧", () => {
  it("max-height:500px 档把关内跳过/直达收成一行，小字不占竖向空间", () => {
    const start = SRC.indexOf("@media (max-height:500px)");
    expect(start).toBeGreaterThan(0);
    const block = SRC.slice(start, start + 1400);
    expect(block).toContain(".l99-stagebar .l99-tools{flex-wrap:nowrap");
    expect(block).toContain(".l99-stagebar .l99-jump{flex-wrap:nowrap");
    expect(block).toContain(".l99-stagebar .l99-jump-note");
    expect(block).toContain("clip:rect(0 0 0 0)");
  });
});
