import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-85 / N-55 snow-fight 矮横屏键排 · 915×412", () => {
  it("闯关搓雪键 462/514、双人十二键 481/531 收进舞台:操作牌一行 + 画布宽上限", () => {
    // 修后实测:闯关键 327..373;双人十二键 340..386,均 ≥44 且过舞台裁切线之上
    expect(SRC).toContain('globalThis.matchMedia?.("(min-width:640px) and (max-height:500px)").matches ?? false');
    expect(SRC).toContain("Math.min(availW, shortLand ? 480 : 880)");
    expect(SRC).toContain(".snf-pad:not(.snf-pad-duo){flex-direction:row;align-items:center;gap:6px;padding:4px 6px;}");
    expect(SRC).toContain(".snf-pad-duo{flex-direction:row;align-items:center;}");
  });

  it("世界坐标与判定零触碰:flat/ys 拉伸公式原样,r11 双人并排媒体块保留", () => {
    expect(SRC).toContain("const flat = VIEW_H * s;");
    expect(SRC).toContain("Math.max(1, Math.min(MAX_STRETCH, want / flat))");
    expect(SRC).toContain(".snf-pads[data-duo]{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;max-width:none;flex-wrap:nowrap;}");
  });
});
