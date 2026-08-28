/**
 * N-68(trio-r8)· 三图侦探社矮横屏并排的守门。
 *
 * 病根:915×412 第 100 关族沿用竖排(上排两参考图 + 下图在底),参考图在屏、
 * 要点的下图 `.fdf-cell-play` 整排(r14 实测 471/501/531)折叠线下。
 * 修法:真横屏时三图并排——两张参考图仍横排一行、整行在左,下图(右图)在右,
 * 参考图格子按舞台可视余量摊高(miniCellPxRow)。
 * 浏览器复证 915×412 第 100/110 关三张图全同屏(250..336)、下图格裁 0 线下 0;
 * 390×844 竖排原样、1024×768 并排同绿;第 1/40 关双图并排(L-1)零回归。
 * seed、差异答案、判定零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { miniCellPxRow, PANEL_CHROME_ROW_PX } from "./runtime";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("find-diff · 三图矮横屏并排(N-68)", () => {
  it("tripleRow 只认「三图 + 真横屏」,双图的 rowLayout 口径原样", () => {
    expect(SRC).toContain(
      "const tripleRow = triple && panelsSideBySide(view.innerWidth ?? 360, view.innerHeight ?? 640);"
    );
    expect(SRC).toContain(
      "const rowLayout = !triple && panelsSideBySide(view.innerWidth ?? 360, view.innerHeight ?? 640);"
    );
  });

  it("并排三件套都接上:布局类、格子回涨口径、参考图高度钳", () => {
    expect(SRC).toContain('if (tripleRow) root.classList.add("fdf-triplerow");');
    expect(SRC).toContain("PLAY_CELL_PX, rowLayout || tripleRow)");
    expect(SRC).toContain(
      "if (tripleRow) miniPx = Math.min(miniPx, miniCellPxRow(scene.rows, stageRoomPx(root)));"
    );
  });

  it("方位词跟着换:挂牌与提示里的「上面两张」变「左边两张」", () => {
    expect(SRC).toMatch(/\.replace\(\/上面两张\/g, "左边两张"\)/);
    expect(SRC).toContain('if (!rowLayout && !tripleRow) return text;');
  });

  it("miniCellPxRow:按可视余量摊高,夹在 22–32,量不出返回上限", () => {
    // 余量充足 → 顶到 32 上限
    expect(miniCellPxRow(3, 1000)).toBe(32);
    // 915×412 实测口径:余量 ~267,3 行 → (267-179)/3 = 29
    expect(miniCellPxRow(3, PANEL_CHROME_ROW_PX + 88)).toBe(29);
    // 挤到没地方也不跌破 22(看得清才谈得上找不同)
    expect(miniCellPxRow(3, PANEL_CHROME_ROW_PX + 10)).toBe(22);
    // 量不出余量(jsdom / 没有裁切祖先)→ 上限,别冤枉钳
    expect(miniCellPxRow(3, Number.POSITIVE_INFINITY)).toBe(32);
    expect(miniCellPxRow(3, Number.NaN)).toBe(32);
  });
});
