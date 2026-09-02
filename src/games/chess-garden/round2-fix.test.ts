/**
 * 花园国际象棋 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-4（一般 · r1 5-4 修复不彻底的尾巴②）：A 档 5-4 点名过「各款 pick 按钮」，
 * fs/ps/jq 的在 r1 已提级，本款 `.cg-pick` 13.5px 与结算正文 `.cg-over-s` 13.5px 漏网。
 * 修法：两类统一提到 ≥14px（同 5-4 口径）。
 *
 * r2-2（阻断 · 1.2 存量，r1 320 扫描漏检）：320px 视口上 `.cg-sq{min-width:40px}` 让
 * 8 列内容 320px 超出板箱 ≈292px，被 `.cg-board{overflow:hidden}` 裁掉——h 列仅 12px 可见、
 * 格中心 elementFromPoint 落空不可点。修法：styles.css 末尾追加 `.cg-wrap .cg-sq`
 * 把最小尺寸全部解除（min-height 一并归零，防 Chrome 经 aspect-ratio 把它传导回宽度，
 * 即 dark-chess r2-1 的同款病灶），`repeat(8,1fr)` 真收缩，八列全部回到板箱内。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** 局外屏（模式菜单 / 结算）的 SHELL_CSS 没导出，直接读源码量 */
const SHELL_SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

const SHEET = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");

describe("chess-garden · 局外屏字号 ≥14px（r2-4，r1 5-4 尾巴②）", () => {
  it("cg-pick / cg-over-s 的每条规则字号都 ≥14", () => {
    for (const cls of ["cg-pick", "cg-over-s"]) {
      const rules = [...SHELL_SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

describe("chess-garden · 320px h 列裁切修复（r2-2 阻断）", () => {
  /** 末尾追加的解除规则（带 cg-wrap 前缀，特异性 0,2,0 压得住基础规则的 0,1,0） */
  const unlock = SHEET.match(/\.cg-wrap \.cg-sq \{[^}]*\}/)?.[0] ?? "";

  it("追加段把 .cg-sq 的最小尺寸全部解除，且排在基础规则与 420px 断点之后", () => {
    expect(unlock, "styles.css 里找不到 .cg-wrap .cg-sq 解除规则").not.toBe("");
    expect(unlock).toMatch(/min-width:\s*0/);
    // min-height 必须一并归零：Chrome 会经 aspect-ratio 把 min-height 传导回宽度（r2-1 同款病灶）
    expect(unlock).toMatch(/min-height:\s*0/);
    const base = SHEET.indexOf(".cg-sq {");
    const narrow = SHEET.indexOf("@media (max-width: 420px)");
    const at = SHEET.indexOf(".cg-wrap .cg-sq {");
    expect(base).toBeGreaterThan(-1);
    expect(narrow).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(base);
    expect(at).toBeGreaterThan(narrow);
  });

  it("320px 算式：1fr 真收缩后八列全部回到板箱内（一格 ≈36.5px，登记实测口径）", () => {
    // 窗口 1 `.screen` 左右内边距 clamp(14px,4vw,32px)：320px 上 4vw=12.8 → 下限 14px 起作用
    const screenPad = 14;
    const modePad = 10; // .cg-mode 左右内边距
    const bleed = 10; // ≤420px 断点 .cg-board{margin-inline:-10px} 挣回来的宽度
    const inner = 320 - 2 * screenPad - 2 * modePad + 2 * bleed;
    const cell = inner / 8;
    // 修前：8 × min-width 40px = 320 > 292，h 列被 overflow:hidden 裁掉 70%
    expect(8 * 40).toBeGreaterThan(inner);
    // 修后：格宽跟随 1fr 轨道，八列恰好铺满板箱、零溢出
    expect(8 * cell).toBeLessThanOrEqual(inner);
    expect(cell).toBeCloseTo(36.5, 1);
    // 可读性兜底：收缩后的格宽仍不低于本款 34px 的窄屏红线口径
    expect(cell).toBeGreaterThanOrEqual(34);
  });
});

describe("chess-garden · 草绿壳卡（B 档 r2 一致性③）", () => {
  it("cg-wrap 带上家族壳卡，且按 B 档要求排在 r2-2 解除规则之后", () => {
    const card = SHEET.match(/\.cg-wrap \{\n  background: linear-gradient\(180deg, #f2f7ea, #eaf3e4\);[^}]*\}/)?.[0] ?? "";
    expect(card, "壳卡规则丢了").not.toBe("");
    expect(card).toContain("border-radius: 16px");
    expect(card).toContain("padding: 10px 6px");
    expect(SHEET.indexOf("background: linear-gradient(180deg, #f2f7ea, #eaf3e4)")).toBeGreaterThan(
      SHEET.indexOf(".cg-wrap .cg-sq {")
    );
  });

  it("≤420px 侧内衬必须归零：窄屏格宽实测值（36.5@320 / 41.4@360）一像素都不让", () => {
    const at = SHEET.lastIndexOf("@media (max-width: 420px)");
    expect(at).toBeGreaterThan(SHEET.indexOf("background: linear-gradient(180deg, #f2f7ea, #eaf3e4)"));
    const block = SHEET.slice(at);
    expect(block).toMatch(/\.cg-wrap \{\n    padding: 10px 0;/);
  });
});

describe("chess-garden · 记谱行字号 ≥14px（r2-7）", () => {
  it("cg-log-sum / cg-log-row 提级到 14px，追加段排在 420px 回降规则之后", () => {
    const rule = SHEET.match(/\.cg-wrap \.cg-log-sum,\n\.cg-wrap \.cg-log-row \{[^}]*\}/)?.[0] ?? "";
    expect(rule, "记谱行提级规则丢了").not.toBe("");
    const m = /font-size:\s*([\d.]+)px/.exec(rule);
    expect(m).not.toBeNull();
    expect(Number.parseFloat((m as RegExpExecArray)[1])).toBeGreaterThanOrEqual(14);
    // 层叠顺序：与 r2 tester 钉的 cg- 提级段同口径，必须压得住窄屏 13px 回降
    const demote = SHEET.indexOf(".cg-tip,\n  .cg-log-row {\n    font-size: 13px;\n  }");
    expect(demote).toBeGreaterThan(-1);
    expect(SHEET.indexOf(".cg-wrap .cg-log-sum")).toBeGreaterThan(demote);
  });
});
