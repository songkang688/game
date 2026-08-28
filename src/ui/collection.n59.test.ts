/**
 * N-59 收藏册 915×412 双栏：页签/知道啦 44、预览限高。关闭 44 勿回退。≠ N-48 跨路由。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./collection.ts", import.meta.url)), "utf8");

describe("N-59 收藏册矮横屏布局", () => {
  it("页签与知道啦 min-height ≥44，关闭钮仍 44×44", () => {
    expect(SRC).toMatch(/\.collection-tab\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.collection-done\{[^}]*min-height:44px/);
    expect(SRC).not.toMatch(/\.collection-done\{[^}]*min-height:42px/);
    expect(SRC).toMatch(/\.collection-close\{[^}]*width:44px/);
    expect(SRC).toMatch(/\.collection-close\{[^}]*height:44px/);
  });

  it("矮屏档收预览高度，宽屏双栏不改成纵排", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    const short = SRC.slice(SRC.indexOf("@media (max-height:500px)"));
    expect(short).toMatch(/\.collection-preview\{[^}]*max-height:108px/);
    expect(short).toMatch(/\.collection-canvas\{[^}]*height:84px/);
    expect(short.slice(0, 900)).not.toContain("flex-direction:column");
  });
});
