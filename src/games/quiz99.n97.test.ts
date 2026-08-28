/**
 * N-97 守门:root×深关(math-farm L188 一族)答题宿主被 fitIntoStage 钳成内滚后,
 * 选项排初见掉出 915×412 视口(实测 394~440,视口底 412)。
 * 修法:矮屏档 .qz-choices 钉宿主可视底(滚动祖先=宿主自身 overflow-y:auto,sticky 合法),
 * .qz-msg 用 order 挪到选项条上方防止被钉底条永久盖住。
 * 附 PT-5:math-farm 布景层包含块必须是舞台自己,不许爬到 .l99-wrap 盖住 stagebar。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const QUIZ = readFileSync(fileURLToPath(new URL("./quiz99.ts", import.meta.url)), "utf8");
const FARM_LAYER = readFileSync(fileURLToPath(new URL("./math-farm/farmLayer.ts", import.meta.url)), "utf8");

function shortBlock(src: string): string {
  const start = src.indexOf("@media (max-height: 500px)");
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf("`;", start));
}

describe("N-97 quiz99 矮屏选项钉宿主底", () => {
  it("500 档 .qz-choices sticky 钉底,带防透字渐变与可滚提示阴影", () => {
    const block = shortBlock(QUIZ);
    expect(block).toMatch(/\.qz-choices \{ position: sticky; bottom: 0; z-index: 2; order: 99;/);
    expect(block).toContain("box-shadow: 0 -6px 10px -6px rgba(90,74,128,.28);");
  });

  it("500 档 .qz-msg 的 order 在选项条上方(夸奖/提示不许被钉底条盖死)", () => {
    expect(shortBlock(QUIZ)).toMatch(/\.qz-msg \{ order: 98; \}/);
  });

  it("L-1/N-44 既有 500 档规则原文未动(测试只增不减)", () => {
    const block = shortBlock(QUIZ);
    expect(block).toContain(".qz-wrap { min-height: 0; padding: 8px 10px; gap: 6px; }");
    expect(block).toContain(".qz-prompt .mtf-vert, .qz-wrap > .mtf-illus:not(.mtf-illus-count) { max-height: 64px; overflow: hidden; }");
  });
});

describe("PT-5 math-farm 布景包含块", () => {
  it("挂载时给舞台补 position:relative,卸载时还原", () => {
    expect(FARM_LAYER).toContain('if (stageStyle && !hadPosition) stageStyle.position = "relative";');
    expect(FARM_LAYER).toContain('if (stageStyle && !hadPosition && stageStyle.position === "relative") stageStyle.position = "";');
  });
});
