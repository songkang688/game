import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MIN_BODY_PX,
  MIN_CONTROL_PX,
  MIN_LINE_HEIGHT,
  MIN_SAFE_BOTTOM_PX,
  MIN_TITLE_PX_AT_360,
  MOBILE_CSS_MARKERS,
  NARROW_BREAKPOINT,
  WRAP_RULES,
  applyMobileTextVars,
  clampBodyPx,
  clampControlPx,
  clampLineHeight,
  isNarrow,
  safeBottom,
  titleClamp
} from "./mobileText";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("手机文字硬指标", () => {
  it("正文字号下限是 16px,控件是 14px", () => {
    expect(MIN_BODY_PX).toBe(16);
    expect(MIN_CONTROL_PX).toBe(14);
    expect(MIN_CONTROL_PX).toBeLessThan(MIN_BODY_PX);
  });

  it("360px 时标题不小于 20px,行高不小于 1.4", () => {
    expect(MIN_TITLE_PX_AT_360).toBe(20);
    expect(MIN_LINE_HEIGHT).toBe(1.4);
  });

  it("验收视口就是 360px", () => {
    expect(NARROW_BREAKPOINT).toBe(360);
  });

  it("正文字号夹取:小的抬上来,大的原样留着", () => {
    expect(clampBodyPx(12)).toBe(16);
    expect(clampBodyPx(16)).toBe(16);
    expect(clampBodyPx(21)).toBe(21);
  });

  it("控件字号夹取同理", () => {
    expect(clampControlPx(10)).toBe(14);
    expect(clampControlPx(18)).toBe(18);
  });

  it("行高夹取", () => {
    expect(clampLineHeight(1)).toBe(1.4);
    expect(clampLineHeight(1.8)).toBe(1.8);
  });

  it("脏值不会算出 NaN", () => {
    expect(clampBodyPx(Number.NaN)).toBe(16);
    expect(clampControlPx(Number.POSITIVE_INFINITY)).toBe(14);
    expect(clampLineHeight(Number.NaN)).toBe(1.4);
  });

  it("标题 clamp() 串的下限永远不低于 20px", () => {
    expect(titleClamp()).toBe("clamp(20px, 5.4vw, 30px)");
    expect(titleClamp(14)).toContain("clamp(20px");
    expect(titleClamp(24, 40)).toBe("clamp(24px, 5.4vw, 40px)");
  });

  it("标题 clamp() 的上限不会被写反", () => {
    expect(titleClamp(28, 20)).toBe("clamp(28px, 5.4vw, 28px)");
  });

  it("底部安全区至少 12px,并交给 env() 兜底", () => {
    expect(MIN_SAFE_BOTTOM_PX).toBe(12);
    expect(safeBottom()).toBe("max(12px, env(safe-area-inset-bottom))");
    expect(safeBottom(20)).toBe("max(20px, env(safe-area-inset-bottom))");
  });

  it("窄屏判定:360 及以下算窄,宽屏与脏值不算", () => {
    expect(isNarrow(320)).toBe(true);
    expect(isNarrow(360)).toBe(true);
    expect(isNarrow(361)).toBe(false);
    expect(isNarrow(0)).toBe(false);
    expect(isNarrow(Number.NaN)).toBe(false);
  });

  it("换行规则不许用 nowrap 把汉字挤成竖条", () => {
    expect(WRAP_RULES).toContain("overflow-wrap: anywhere");
    expect(WRAP_RULES).toContain("word-break: break-word");
    expect(WRAP_RULES.join("")).not.toContain("nowrap");
  });

  it("applyMobileTextVars 把约定写成 CSS 变量,传空也不炸", () => {
    const written = new Map<string, string>();
    applyMobileTextVars({ style: { setProperty: (k, v) => void written.set(k, v) } });
    expect(written.get("--mt-body")).toBe("16px");
    expect(written.get("--mt-line")).toBe("1.4");
    expect(written.get("--mt-title")).toBe(titleClamp());
    expect(written.get("--mt-safe-bottom")).toBe(safeBottom());
    expect(() => applyMobileTextVars(null)).not.toThrow();
  });
});

describe("styles.css 巡检", () => {
  it("1.2 的手机文字区块在", () => {
    for (const marker of MOBILE_CSS_MARKERS) {
      expect(CSS, `styles.css 里缺少 ${marker}`).toContain(marker);
    }
  });

  it("底部安全区用了 env(safe-area-inset-bottom)", () => {
    expect(CSS).toContain("env(safe-area-inset-bottom)");
  });

  it("长文案能断行", () => {
    expect(CSS).toContain("overflow-wrap: anywhere");
    expect(CSS).toContain("word-break: break-word");
  });

  it("有 360px 的媒体查询分支", () => {
    expect(CSS).toMatch(/@media\s*\(max-width:\s*360px\)/);
  });

  it("游戏名没有被 nowrap 挤住", () => {
    expect(CSS).not.toMatch(/\.card-title\s*\{[^}]*white-space:\s*nowrap/);
    // 小卡上的名字宽屏用省略号,窄屏必须放开成两行
    const narrow = CSS.slice(CSS.search(/@media\s*\(max-width:\s*360px\)/));
    expect(narrow).toMatch(/\.recent-name\s*\{[^}]*white-space:\s*normal/);
  });

  it("无障碍相关的老规则一条都没被删", () => {
    expect(CSS).toContain(".sr-only");
    expect(CSS).toContain(":focus-visible");
    expect(CSS).toContain("prefers-reduced-motion");
  });

  it("index.html 的 viewport 覆盖了刘海屏", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain("viewport-fit=cover");
  });
});
