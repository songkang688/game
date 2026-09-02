import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const MATCH = readFileSync(fileURLToPath(new URL("./match.ts", import.meta.url)), "utf8");

describe("N-121 / N-122 duo-rush 模式键与竖屏 CTA", () => {
  it("开跑/怎么玩/关规则 min-height 44", () => {
    expect(INDEX).toMatch(/\.dr-start\s*\{[^}]*min-height:\s*44px/s);
    expect(INDEX).toMatch(/\.dr-softbtn\s*\{[^}]*min-height:\s*44px/s);
    expect(INDEX).toMatch(/\.dr-rules-close\s*\{[^}]*min-height:\s*44px/s);
  });

  it("N-122 竖屏钉 CTA 底,不回退 N-87 矮横屏顶钉与 N-40 赛道 sticky", () => {
    expect(INDEX).toContain("@media (max-width: 430px) and (min-height: 700px)");
    const portrait = INDEX.slice(INDEX.indexOf("@media (max-width: 430px) and (min-height: 700px)"));
    expect(portrait).toContain("position: sticky; bottom: 0");
    expect(INDEX).toMatch(/\.dr-menu-cta \{[^}]*position: sticky; top: 0/s);
    expect(INDEX).toContain(".dr-btns");
    expect(MATCH).not.toContain("dr-menu-cta");
  });
});
