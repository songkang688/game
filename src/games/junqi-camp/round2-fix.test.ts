/**
 * 军棋军营 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-6（建议）：空位点位字 `.jq-empty .jq-face` 13px 低于正文下限 14px。
 * 虽是装饰性点位提示，但与 r1 5-4 已提级的 jq-sub/jq-tip/jq-chip 等同屏出现，
 * 统一口径提到 14px，不再单独登记豁免。
 */
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("junqi-camp · 空位点位字 ≥14px（r2-6）", () => {
  it(".jq-empty .jq-face 字号提到 14px，与全款 HUD 同口径", () => {
    const rule = CSS.match(/\.jq-empty \.jq-face\{[^}]*\}/)?.[0] ?? "";
    expect(rule, ".jq-empty .jq-face 规则丢了").not.toBe("");
    const m = /font-size:([\d.]+)px/.exec(rule);
    expect(m).not.toBeNull();
    expect(Number.parseFloat((m as RegExpExecArray)[1])).toBeGreaterThanOrEqual(14);
  });
});
