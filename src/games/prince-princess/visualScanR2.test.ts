/**
 * prince-princess · 1.3 窗口 5 第 2 轮视觉测试员 · 复验补测。
 *
 * R2 对账确认 S1/S2(小怪 / BOSS emoji)已由 fixer 矢量化清零;
 * 剩余画布 emoji 全部走 `emoji()` 助手(能力 / 状态小 icon、指路、粒子飘字 = G4/L-1 遗留,
 * 以及 R2 新发现的门锁 🔒 24px 字形,见 docs/qa/1.3-window5-round2-tester.md N2)。
 * 这里给两道只降不升的水位闸:后续 C 档把 N2 / G4 换矢量时数字只会变小,
 * 谁再往画布上添 emoji 字形当场红。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "index.ts"), "utf8");

describe("prince-princess · 窗口5 R2 复验补测(静态)", () => {
  it("R2:emoji() 助手调用点水位只降不升(基线 11 = G4 小 icon/指路/飘字 + N2 门锁)", () => {
    const n = (src.match(/emoji\((g|ctx),/g) ?? []).length;
    expect(n).toBeLessThanOrEqual(11);
  });

  it("R2:门锁 🔒 字形水位只降不升(基线 1,N2 建议复用 iff drawPadlock 思路矢量化)", () => {
    const n = (src.match(/🔒/g) ?? []).length;
    expect(n).toBeLessThanOrEqual(1);
  });
});
