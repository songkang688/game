import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-56 sky-squad 双人合作只抬热区", () => {
  it("暂停/判定点开关 min-height 44,双人摇杆 --k 44", () => {
    expect(SRC).toMatch(/\.sks-back\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.sks-opt\{[^}]*min-height:44px/);
    expect(SRC).toContain('.sks-pads[data-players="2"]{--k:44px;}');
    expect(SRC).not.toContain("--k:36px");
    expect(SRC).not.toContain("--k:34px");
  });

  it("不重钳画布高度公式", () => {
    expect(SRC).toContain("canvasBoxHeight");
  });

  it("U-19 单人摇杆也是 44,中高视口钉垫", () => {
    expect(SRC).toContain(".sks-pads{display:flex;justify-content:center;gap:10px;margin-top:6px;--k:44px;flex-wrap:wrap;}");
    expect(SRC).toContain("@media (max-height:840px)");
  });

  it("模式键也满 44", () => {
    expect(SRC).toMatch(/\.sks-mode\{[^}]*min-height:44px/);
  });
});
