/**
 * N-47(trio-r11):首页玩法/设备芯片热区 ≥44。矮屏 media 已在 homeFirstScreen 钉过；
 * 这里钉 home.ts 源样式，防止 extra CSS 把芯片再收到 44 以下。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HOME = readFileSync(new URL("./home.ts", import.meta.url), "utf8");
const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("N-47 壳层模式芯片热区 ≥44", () => {
  it("home.ts 玩法芯片 min-height ≥44", () => {
    const m = /\.mode-chips \.tab\{[^}]*min-height:(\d+)px/.exec(HOME);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });

  it("home.ts 设备芯片 min-height ≥44", () => {
    const m = /\.platform-chips \.tab\{[^}]*min-height:(\d+)px/.exec(HOME);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });

  it("styles.css 矮横屏档芯片仍 ≥44", () => {
    const start = CSS.indexOf("@media (max-height: 500px)");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = CSS.slice(start, start + 4500);
    expect(block).toMatch(/\.home-screen \.mode-chips \.tab[\s\S]*?min-height:\s*44px/);
  });
});
