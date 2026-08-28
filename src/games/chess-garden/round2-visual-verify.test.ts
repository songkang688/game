/**
 * 花园国际象棋 · 1.3 第 2 轮 A 档复验契约（对 r1 5-3/5-4 修复的层叠顺序加固）。
 *
 * r1-fix 只断言了提级规则「存在」;第 2 轮实测发现 styles.css 里还有一段
 * `@media (max-width: 420px)` 把 `.cg-tip` 回降到 13px——提级规则必须排在
 * 这段媒体查询之后且特异性更高,窄屏上才真的是 14px(headless 实测已确认 win)。
 * 把「顺序」钉死,防止后续样式整理把追加段挪到媒体查询前面去。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SHEET = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");

describe("chess-garden · 提级规则压得住窄屏回降（r2 层叠顺序契约）", () => {
  it("cg- 提级追加段排在 420px 回降规则之后", () => {
    const demote = SHEET.indexOf(".cg-tip,\n  .cg-log-row {\n    font-size: 13px;\n  }");
    const coord = SHEET.indexOf(".cg-wrap .cg-coord {\n  font-size: 10.5px;\n}");
    const hud = SHEET.indexOf(".cg-wrap .cg-tool,\n.cg-wrap .cg-seat,\n.cg-wrap .cg-tip {\n  font-size: 14px;\n}");
    expect(demote).toBeGreaterThan(-1);
    expect(coord).toBeGreaterThan(demote);
    expect(hud).toBeGreaterThan(demote);
  });
});
