/**
 * 军棋营地 · 1.3 第 2 轮 A 档复验契约（对 r1 严重 3-1 修复的全兵种加固）。
 *
 * r1-fix 只以司令一种兵种钉了 jq-mark 角标;第 2 轮 headless 实测明棋第 1 关
 * 盘上 7 枚翻开棋面全部带角标。本文件把「12 兵种 × 双方」全量钉死:
 * 每张翻开的棋面都带形状角标,去掉阵营色后双方仍互异——16px 灰度化也认得出是谁的子。
 */
import { describe, expect, it } from "vitest";
import { SIDE_COLOR, SIDE_DARK } from "./art";
import { faceHTML } from "./view";
import { idx, type Side } from "./board";
import { KINDS } from "./rules";

function stripSideColors(svg: string): string {
  let out = svg;
  for (const side of ["duo", "star"] as Side[]) {
    out = out.split(SIDE_COLOR[side]).join("#SIDE").split(SIDE_DARK[side]).join("#DARK");
  }
  return out;
}

describe("junqi-camp · 12 兵种双方角标全量互异（r2 复验加固）", () => {
  it("每个兵种翻开的棋面都带 jq-mark,去色后双方仍互异", () => {
    let id = 1;
    for (const kind of KINDS) {
      const duo = faceHTML(idx(6, 0), kind, { id: id++, side: "duo", kind });
      const star = faceHTML(idx(6, 0), kind, { id: id++, side: "star", kind });
      expect(duo, `${kind} 朵朵面缺角标`).toContain("jq-mark");
      expect(star, `${kind} 星星面缺角标`).toContain("jq-mark");
      expect(stripSideColors(duo), `${kind} 去色后双方同形`).not.toBe(stripSideColors(star));
    }
  });
});
