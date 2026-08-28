/**
 * N-47 残留：菜单芯片 40→44。只改 shoot-range / alien-seek / adventure-king 菜单，
 * 不重写保龄/王子/坦克（已 44）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function minH(src: string, sel: string): number {
  const re = new RegExp(`${sel.replace(".", "\\.")}\\{[^}]*min-height:(\\d+)px`);
  const all = [...src.matchAll(new RegExp(re, "g"))];
  const last = all.at(-1);
  expect(last, `${sel} 应写 min-height`).toBeTruthy();
  return Number(last![1]);
}

describe("N-47 残留菜单芯片 ≥44", () => {
  it("shoot-range .shr-mode", () => {
    const src = readFileSync(new URL("./shoot-range/index.ts", import.meta.url), "utf8");
    expect(minH(src, ".shr-mode")).toBeGreaterThanOrEqual(44);
  });

  it("alien-seek .as-open 盖过 kit 40", () => {
    const src = readFileSync(new URL("./alien-seek/index.ts", import.meta.url), "utf8");
    expect(src).toMatch(/\.as-open,\.as-back\{min-height:44px;\}/);
  });

  it("adventure-king .ak-open / .ak-back", () => {
    const src = readFileSync(new URL("./adventure-king/index.ts", import.meta.url), "utf8");
    expect(minH(src, ".ak-open")).toBeGreaterThanOrEqual(44);
    expect(minH(src, ".ak-back")).toBeGreaterThanOrEqual(44);
  });
});
