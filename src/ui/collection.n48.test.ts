/**
 * N-48 收藏册 overlay 跨路由(曾误号 N-42,与 puff 暂停热区同号)。
 * 源码钉子:hashchange → close;close 里摘监听。不碰 puff / N-42。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./collection.ts", import.meta.url)), "utf8");

describe("N-48 收藏册 overlay 跨路由", () => {
  it("开面板挂 hashchange,路由一变就 close", () => {
    expect(SRC).toMatch(/addEventListener\("hashchange", onRouteChange\)/);
    expect(SRC).toMatch(/function onRouteChange\(\): void \{\s*close\(\);/);
  });

  it("close 里摘掉 hashchange,不留孤儿监听", () => {
    expect(SRC).toMatch(/removeEventListener\("hashchange", onRouteChange\)/);
    const closeBody = /function close\(\): void \{([\s\S]*?)\n    opts\?\.onClose/.exec(SRC)?.[1] ?? "";
    expect(closeBody).toContain('removeEventListener("hashchange"');
  });
});

describe("N-59 收藏册矮横屏页签/完成钮 44", () => {
  it("页签与知道啦钉 44,关闭钮 44 不动", () => {
    expect(SRC).toMatch(/\.collection-tab\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.collection-done\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.collection-close\{[^}]*width:44px/);
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".collection-preview{flex:0 0 132px");
  });
});
