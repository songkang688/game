/** 三人组 r16 · N-87 模式菜单 CTA 钉进矮横屏（≠ N-40 赛道 .dr-btns） */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const MATCH = readFileSync(fileURLToPath(new URL("./match.ts", import.meta.url)), "utf8");

describe("N-87 duo-rush 模式菜单怎么玩/收藏册", () => {
  it("菜单三颗主钮包进 .dr-menu-cta,矮屏提到顶并排,热区 44", () => {
    expect(INDEX).toContain('class="dr-menu-cta"');
    expect(INDEX).toContain("dr-rulesbtn");
    expect(INDEX).toContain("dr-collectbtn");
    expect(INDEX).toContain(".dr-menu-cta");
    expect(INDEX).toContain("order: -1");
    expect(INDEX).toContain("min-height: 44px");
    const cta = INDEX.slice(INDEX.indexOf(".dr-menu-cta"), INDEX.indexOf(".dr-keys { display: none; }"));
    expect(cta).toContain("position: sticky");
    expect(cta).toContain("top: 0");
  });

  it("U-3 竖屏 480 档同样把菜单 CTA 钉顶", () => {
    expect(INDEX).toContain("@media (max-width: 480px)");
  });

  it("不回退 N-40 赛道 .dr-btns sticky,赛道数学零触碰", () => {
    expect(INDEX).toContain(".dr-btns");
    expect(INDEX).toContain("position: sticky; bottom: 0");
    expect(MATCH).not.toContain("dr-menu-cta");
    expect(MATCH).not.toContain("sticky");
  });
});
