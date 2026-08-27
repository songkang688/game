/**
 * 守门：矮屏上「涂一块滚两趟」得治（窗口5 第 3 轮档A，`W5R3-TA-02`，严重）。
 *
 * 第 3 轮测试员 A13 实测（Chrome headless + CDP）：
 *   320×568 第 181 关这一屏 **701px 塞进 282px 的窗口**（横屏更狠：614px 塞进 142 / 172px）。
 *   **每一颗按钮都够得着**（慢拖 204/204、222/222 全救回），坏的不是够不着，是
 *   「选色 → 涂色」这一个动作被拆成「滚下去选色 → 滚上来涂 → 再滚下去」。
 *   通关机器人在这一档上开锅 14 次一次没配出目标色、0/6 收场；
 *   同一个机器人在 390×844 上 9–10 次就过了。
 *
 * 根因量得很实：画布 180px（已经在 `CANVAS_MIN_PX` 底线上）＋ 调色锅那一排 105px ＝ 285px
 * ＞ 滚动视口 282px，于是 `canPinCanvas()` 判「钉不住」，画布**不再跟着滚**——
 * 这一款本来靠「把画钉在滚动区顶上」才让选色和涂色待在同一屏里。
 *
 * 修法是**内容再收一档**（`clf-tighter`）：只收调色锅那一排与几条装饰行的留白、字号、
 * 色点直径，把最高那一排压回「钉得住」的高度。**热区一个都不动**。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANVAS_MIN_PX, CLF_CSS, canPinCanvas, canvasBoxPx, needsTighter, pinnableCanvasPx } from "./ui";

const UI = readFileSync(fileURLToPath(new URL("./ui.ts", import.meta.url)), "utf8");

/** 从样式里抠出一条规则的声明块 */
function rule(selector: string): string {
  const i = CLF_CSS.indexOf(`${selector}{`);
  if (i < 0) return "";
  return CLF_CSS.slice(i + selector.length + 1, CLF_CSS.indexOf("}", i));
}

/** 「再挤挤」那一整段（排在 reduced-motion 之后，好稳稳盖住「挤一挤」的同名声明） */
const TIGHTER = CLF_CSS.slice(CLF_CSS.indexOf(".clf-wrap.clf-tighter{"));

describe("涂色小屋 · 画布钉不住就得再收一档（needsTighter）", () => {
  it("320×568 第 181 关那一幕：视口 282、画布 180、调色锅那一排 105 —— 差 3px，钉不住", () => {
    expect(canPinCanvas(282, 180, 105)).toBe(false);
    expect(needsTighter(282, 180, 105)).toBe(true);
  });

  it("横屏 640×360 / 844×390：视口 142 / 172，同样钉不住", () => {
    expect(needsTighter(142, 180, 105)).toBe(true);
    expect(needsTighter(172, 180, 105)).toBe(true);
  });

  it("360×640 / 390×844 本来就钉得住：这一档一次都不许挂", () => {
    expect(canPinCanvas(354, 180, 105)).toBe(true);
    expect(needsTighter(354, 180, 105)).toBe(false);
    expect(needsTighter(556, 180, 105)).toBe(false);
  });

  it("收完这一档真的救得回来：调色锅那一排压到 85px，282−180=102 ≥ 85", () => {
    expect(needsTighter(282, 180, 85)).toBe(false);
    expect(canPinCanvas(282, 180, 85)).toBe(true);
  });

  it("量不出来就一动不动——不拿一个量不准的数去改高屏上本来就对的行为", () => {
    expect(needsTighter(Number.NaN, 180, 105)).toBe(false);
    expect(needsTighter(282, 180, 0)).toBe(false);
    expect(needsTighter(282, 0, 105)).toBe(false);
    expect(needsTighter(0, 180, 105)).toBe(false);
  });
});

describe("涂色小屋 · 收完第二档画布让到哪儿为止（pinnableCanvasPx）", () => {
  it("上限是「视口减掉后面最高那一排」", () => {
    expect(pinnableCanvasPx(400, 105, 320)).toBe(295);
  });

  it("下限仍旧是 CANVAS_MIN_PX——再收线稿里的小块就点不准了", () => {
    expect(pinnableCanvasPx(200, 105, 320)).toBe(CANVAS_MIN_PX);
    expect(pinnableCanvasPx(142, 85, 320)).toBe(CANVAS_MIN_PX);
  });

  it("本来就比上限还矮就照原样返回，不平白把画放大", () => {
    expect(pinnableCanvasPx(600, 105, 240)).toBe(240);
    expect(pinnableCanvasPx(282, 85, 180)).toBe(180);
  });

  it("量不出来就原样返回", () => {
    expect(pinnableCanvasPx(Number.NaN, 105, 240)).toBe(240);
    expect(pinnableCanvasPx(400, 0, 240)).toBe(240);
  });

  it("和 canvasBoxPx 串起来：320×568 上画布仍旧停在底线 180，不会被这一档放大", () => {
    const box = canvasBoxPx(282, 701 - 180, 180);
    expect(box).toBe(CANVAS_MIN_PX);
    expect(pinnableCanvasPx(282, 85, box)).toBe(CANVAS_MIN_PX);
  });
});

describe("涂色小屋 ·「再挤挤」这一档不许动热区", () => {
  it("这一档真的存在，而且排在「挤一挤」后面才盖得住", () => {
    expect(TIGHTER).not.toBe("");
    expect(CLF_CSS.indexOf(".clf-wrap.clf-tight{")).toBeLessThan(CLF_CSS.indexOf(".clf-wrap.clf-tighter{"));
  });

  it("一个热区选择器都不许出现", () => {
    for (const sel of [".clf-tool", ".clf-swatch-dot", ".clf-primary{", ".clf-zoom", ".clf-pick", ".clf-swatch{"]) {
      expect(TIGHTER.includes(sel), `「再挤挤」这一档动了热区 ${sel}`).toBe(false);
    }
  });

  it("基准样式里那几个 44px 的热区原样还在", () => {
    expect(rule(".clf-tool")).toContain("min-height:44px");
    expect(rule(".clf-swatch-dot")).toContain("width:44px");
    expect(rule(".clf-primary")).toContain("min-height:44px");
    expect(rule(".clf-zoom")).toContain("min-height:44px");
  });

  it("字号不许收到基准样式自己的下限（12px）以下", () => {
    for (const m of TIGHTER.matchAll(/font-size:(\d+)px/g)) {
      expect(Number(m[1]), "「再挤挤」把字收得比基准样式还小了").toBeGreaterThanOrEqual(12);
    }
  });

  it("收的正是那一排最高的：调色锅的留白、锅本身、三原色的圆点与名字", () => {
    expect(TIGHTER).toContain(".clf-wrap.clf-tighter .clf-mixer{");
    expect(TIGHTER).toContain(".clf-wrap.clf-tighter .clf-pot{");
    expect(TIGHTER).toContain(".clf-wrap.clf-tighter .clf-primary-dot{");
  });
});

describe("涂色小屋 · 第二档怎么接进去的（源码巡检）", () => {
  const fit = UI.slice(UI.indexOf("export function fitColoringStage"));

  it("钳之前先把这一档也还原，不然越量越小", () => {
    expect(fit.slice(0, fit.indexOf("const bottoms"))).toContain('wrap.classList.remove("clf-tighter")');
  });

  it("顺序不许换：先「挤一挤」+ 收画布框，钉不住才轮到「再挤挤」", () => {
    expect(fit.indexOf('wrap.classList.add("clf-tight")')).toBeLessThan(fit.indexOf("needsTighter("));
    expect(fit.indexOf("needsTighter(")).toBeLessThan(fit.indexOf('wrap.style.overflowY = "auto"'));
  });

  it("收完这一档要重量一次，而且不许把画布长到又钉不住", () => {
    const at = fit.indexOf('wrap.classList.add("clf-tighter")');
    expect(at).toBeGreaterThan(-1);
    const body = fit.slice(at, at + 700);
    expect(body).toContain("pinnableCanvasPx(");
    expect(body).toContain("tallestTailPx(wrap, stageBox)");
  });

  it("装得下的高屏上这一档一个字节都不写", () => {
    expect(fit).toContain("if (wrap.scrollHeight <= room + 1) return;");
    expect(fit.indexOf("if (wrap.scrollHeight <= room + 1) return;")).toBeLessThan(fit.indexOf("needsTighter("));
  });
});
