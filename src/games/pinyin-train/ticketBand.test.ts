/**
 * 拼音小火车 · 第 2 轮监督修复 TOP10（B 档第 1 轮移交建议）：
 * 车票类别色边条 5px → 8px（17–25px），360px 下三色类别更好认。
 *
 * 钉住三件事：
 *  ① 边条确实是 8px：起点 17px 不动、终点 22px → 25px，老 5px 写法退役；
 *  ② 加宽不吃字也不吃孔：25px ≤ padding-left（28 / 30px），
 *     打孔圆点（circle 3.5px at 11px）原样健在；
 *  ③ 六处票面（基础 + 声母/韵母/整读/声调/白票）与 quiz 皮肤全部同步换宽，
 *     热区/字号纪律照旧（不写 min-height / font-size）。
 */
import { describe, expect, it } from "vitest";
import { TRAIN_COLORS } from "../../art/kit/train";
import { QUIZ_SKIN_CSS, TICKET_CSS } from "./scene";

const BAND_RE = /linear-gradient\(90deg,transparent 0 17px,[^,]+ 17px 25px,transparent 25px\)/g;

describe("拼音小火车 R2 · TOP10 车票边条 8px", () => {
  it("边条 17–25px（8px 宽），老 5px（17–22px）写法一处不剩", () => {
    // TICKET_CSS：基础票 + 4 类别票 + 白票 = 6 处；quiz 皮肤：基础 + 4 类别 = 5 处
    expect([...TICKET_CSS.matchAll(BAND_RE)]).toHaveLength(6);
    expect([...QUIZ_SKIN_CSS.matchAll(BAND_RE)]).toHaveLength(5);
    expect(TICKET_CSS).not.toContain("17px 22px");
    expect(QUIZ_SKIN_CSS).not.toContain("17px 22px");
  });

  it("加宽不吃字不吃孔：边条终点在文字起点之内，打孔圆点原样", () => {
    // 文字起点：普通票 padding-left 28px、quiz 票 30px，都 > 25px
    expect(TICKET_CSS).toContain("padding-left:28px");
    expect(QUIZ_SKIN_CSS).toContain("padding-left:30px");
    // 打孔暗点没被挪也没被盖（11px ± 3.5px < 17px 边条起点）
    expect([...TICKET_CSS.matchAll(/radial-gradient\(circle 3\.5px at 11px 50%/g)]).toHaveLength(6);
  });

  it("三色类别齐活且热区/字号纪律照旧", () => {
    for (const band of [
      TRAIN_COLORS.initialOrange,
      TRAIN_COLORS.finalTeal,
      TRAIN_COLORS.wholePurple,
      TRAIN_COLORS.toneRed,
      TRAIN_COLORS.railGray
    ]) {
      expect(TICKET_CSS).toContain(`${band} 17px 25px`);
    }
    // 皮肤仍然不写 min-height / font-size：热区与字号由玩法既有常量守着
    expect(TICKET_CSS).not.toContain("min-height");
    expect(TICKET_CSS).not.toContain("font-size");
  });
});
