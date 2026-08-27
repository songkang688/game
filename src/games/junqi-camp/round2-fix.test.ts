/**
 * 军棋军营 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-6（建议）：空位点位字 `.jq-empty .jq-face` 13px 低于正文下限 14px。
 * 虽是装饰性点位提示，但与 r1 5-4 已提级的 jq-sub/jq-tip/jq-chip 等同屏出现，
 * 统一口径提到 14px，不再单独登记豁免。
 *
 * B 档 r2 #8（可选微调采纳）：星星面底停 #9FBCE4→#93B2DE 再压一档，
 * 底停灰度差从 Δ≈32.7 拉到 ≥40（r1 的 ≥20 契约继续在跑，本处钉更紧的下限）。
 */
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("junqi-camp · 双方面板底停灰度差 ≥40（B 档 r2 #8 微调）", () => {
  it("底停 Δ≥40、顶停 Δ≥20：颜色通道在 16px 灰度化下留足余量", () => {
    const lum = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    const stops = (sel: string): string[] => {
      const rule = CSS.match(new RegExp(`\\.${sel} \\.jq-face\\{[^}]*\\}`))?.[0] ?? "";
      return rule.match(/#[0-9A-Fa-f]{6}(?=[,)])/g) ?? [];
    };
    const duo = stops("jq-duo");
    const star = stops("jq-star");
    expect(duo.length).toBeGreaterThanOrEqual(2);
    expect(star.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(lum(duo[0]) - lum(star[0]))).toBeGreaterThanOrEqual(20);
    expect(Math.abs(lum(duo[1]) - lum(star[1]))).toBeGreaterThanOrEqual(40);
  });
});

describe("junqi-camp · 空位点位字 ≥14px（r2-6）", () => {
  it(".jq-empty .jq-face 字号提到 14px，与全款 HUD 同口径", () => {
    // 行首锚定：别误中 .jq-cell.jq-camp.jq-empty .jq-face 那条只有 box-shadow 的规则
    const rule = CSS.match(/^\.jq-empty \.jq-face\{[^}]*\}/m)?.[0] ?? "";
    expect(rule, ".jq-empty .jq-face 规则丢了").not.toBe("");
    const m = /font-size:([\d.]+)px/.exec(rule);
    expect(m).not.toBeNull();
    expect(Number.parseFloat((m as RegExpExecArray)[1])).toBeGreaterThanOrEqual(14);
  });
});
