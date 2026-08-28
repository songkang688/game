/** N-106:monster-crisis 矮横屏双人摇杆 370~462/甩弹 379~453 切底——fixed 钉视口下角 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-106 monster-crisis 矮横屏摇杆/甩弹钉底", () => {
  it("500 高档把 .mcr-pad fixed 到视口两下角(sticky 在 l99-host 链失效,禁回退)", () => {
    const block = SRC.split("@media (max-height:500px) and (min-width:700px)")[1] ?? "";
    expect(block).toContain(".mcr-pad{position:fixed;bottom:10px;");
    expect(block).toContain(".mcr-pad:first-child{left:10px;right:auto;}");
    expect(block).toContain(".mcr-pad:last-child{left:auto;right:10px;}");
  });

  it("摇杆组 z-index 压在 .mcr-layer(z9)之下,暂停/技能卡浮层盖得住键", () => {
    const block = SRC.split("@media (max-height:500px) and (min-width:700px)")[1] ?? "";
    const m = /\.mcr-pad\{[^}]*z-index:(\d+)/.exec(block);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThan(9);
  });

  it("单人态(stick/fire 直接挂 .mcr-pads 下)同样钉两下角", () => {
    const block = SRC.split("@media (max-height:500px) and (min-width:700px)")[1] ?? "";
    expect(block).toContain(".mcr-pads > .mcr-stick{position:fixed;bottom:14px;left:14px;");
    expect(block).toContain(".mcr-pads > .mcr-fire{position:fixed;bottom:22px;right:16px;");
  });
});
