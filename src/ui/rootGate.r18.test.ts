/**
 * trio-r18(N-93):915×412 上管理员密码门内容 463px 超过弹窗 max-height 379px,
 * 「打开」主按钮落在弹窗卷轴下方,不滚看不见 —— 唯一 CTA 必须在第一屏。
 * 修法:矮横屏收 .rootgate 间距、放宽容器让四颗时长胶囊排成一行。
 * 这里钉住:压缩只走矮横屏媒体分支、热区常量不降、密码红线不因此松动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./rootGate.ts", import.meta.url)), "utf8");

describe("N-93 管理员密码门矮横屏收进一屏", () => {
  it("有 max-height:500px 分支,收间距 + 时长胶囊单行", () => {
    const at = SRC.indexOf("@media (max-height:500px)");
    expect(at).toBeGreaterThan(-1);
    const block = SRC.slice(at, SRC.indexOf("`;", at));
    expect(block).toContain(".rootgate{max-width:min(560px,84vw);gap:6px}");
    expect(block).toContain(".rootgate-durs{flex-wrap:nowrap}");
  });

  it("热区不降:输入框/按钮 46、时长胶囊 44 原样保留", () => {
    expect(SRC).toContain(".rootgate-input{min-height:46px");
    expect(SRC).toMatch(/\.rootgate-dur\{min-height:44px/);
    expect(SRC).toContain(".rootgate-btn{min-height:46px");
    // 矮横屏分支里不许写更小的 min-height / font-size
    const block = SRC.slice(SRC.indexOf("@media (max-height:500px)"), SRC.indexOf("`;"));
    expect(block).not.toMatch(/min-height:\s*([0-3]?\d)px/);
    expect(block).not.toMatch(/font-size/);
  });

  it("密码红线没被松动:密码只进参数,不进任何存储", () => {
    // 顶部注释里那句「绝不写进 localStorage」是说明;这里查的是真实 API 调用
    expect(SRC).not.toMatch(/localStorage\.|sessionStorage\.|document\.cookie/);
    expect(SRC).toContain("input.value = \"\"");
  });
});
