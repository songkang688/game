/**
 * N-36(trio-r9):识字描红关米字格矮横屏出屏,且没有逃生门。
 *
 * 真机实测(Chrome 无头,localStorage 种进度进第 102 关,免 root 行干扰):
 * 修前 915×412 米字格 `.wgd-pad` 底沿探出舞台 50px、宿主自滚 279 —— 而 `.wgd-pad` 写着
 * `touch-action:none`,手指落在格子上只描红、不带着壳一起滚,所以「滚一下再描下半个字」
 * 这条逃生门在格子上是关死的:下半个字**根本描不了**。同样的裁切量放在普通盘面上只是难看,
 * 放在手势面上是玩不下去,这也是它比 N-34/N-35 重一档的原因。
 *
 * 两件事一起修:
 * 1. 矮横屏(`max-height:500px`)改「格子在左、字卡/花园/提示在右」的双栏,把 915 的横向余量
 *    换成格子那一列的高度(纯 CSS grid 分区,DOM 顺序与读屏次序一个字不动);
 * 2. `padSizePx` 按可视余量把边长收到规格下限 `MIN_PAD_PX` 为止,收完再让 `fitQuizHost` 复位。
 *
 * 修后 915×412:格子 240×240 **整格首屏可见**(出屏 50→0),宿主自滚 279→10;
 * 竖屏三档与 1024×768 / 1280×800 逐像素原样(格子 300×300、出屏 0、自滚 0)。
 * 描红判定另测过:同一条归一化笔画,在钳过的 240px 格子与没钳的 300px 格子上
 * 都判「第 1 笔『竖』写好啦」、0/3→1/3,`padPoint` 按 box 取比例,收边长不动判定。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MIN_PAD_PX, WGD_CSS, padSizePx } from "./tracing";

const TRACING = readFileSync(new URL("./tracing.ts", import.meta.url), "utf8");

/** 取出某个媒体查询块的完整内容(括号配平) */
function mediaBlock(src: string, query: string): string {
  const start = src.indexOf(query);
  expect(start, `应有 ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let i = src.indexOf("{", start);
  const bodyStart = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(bodyStart, i + 1);
}

describe("N-36 描红面按可视余量收边长", () => {
  it("没溢出就一个像素都不收", () => {
    expect(padSizePx(300, 0)).toBe(300);
    expect(padSizePx(300, -20)).toBe(300);
    expect(padSizePx(300, Number.NaN)).toBe(300);
  });

  it("溢出多少收多少", () => {
    expect(padSizePx(300, 24)).toBe(276);
    expect(padSizePx(292, 12)).toBe(280);
  });

  it("收到规格下限就不再收(格子小过 240 就描不动了,剩下的交给宿主滚)", () => {
    expect(padSizePx(300, 999)).toBe(MIN_PAD_PX);
    expect(padSizePx(300, 100)).toBe(MIN_PAD_PX);
    expect(MIN_PAD_PX).toBe(240);
  });

  it("本来就比下限小的格子原样返回,只收不放", () => {
    // 极窄屏上 86vw 可能本就不到 240:这时候再「补」到 240 会把格子怼出屏幕
    expect(padSizePx(200, 30)).toBe(200);
    expect(padSizePx(200, 0)).toBe(200);
  });

  it("量不到尺寸时返回 0,由调用方跳过这次收(jsdom 里就是这一档)", () => {
    expect(padSizePx(0, 10)).toBe(0);
    expect(padSizePx(Number.NaN, 10)).toBe(0);
  });
});

describe("N-36 矮横屏双栏:把横向余量换成格子的高度", () => {
  const short = mediaBlock(WGD_CSS, "@media (max-height:500px)");

  it("矮横屏走双栏,格子独占左列、贯穿四行", () => {
    expect(short).toMatch(/\.wgd-trace\{[^}]*display:grid/);
    expect(short).toMatch(/grid-template-columns:auto minmax\(0,1fr\)/);
    // 四行都把左列让给 pad,格子才拿得到整段高度
    expect(short).toMatch(/grid-template-areas:"pad top" "pad card" "pad garden" "pad msg"/);
    expect(short).toMatch(/\.wgd-padwrap\{[^}]*grid-area:pad/);
  });

  it("双栏只改摆放,DOM 顺序与读屏次序一个字不动", () => {
    // grid-area 分区不搬 DOM;模板里四块的先后必须还是「抬头→字卡→格子→花园→提示」
    const order = [".wgd-top", ".wgd-card", ".wgd-padwrap", ".wgd-garden", ".wgd-msg"];
    let at = -1;
    for (const cls of order) {
      const next = TRACING.indexOf(`class="${cls.slice(1)}"`);
      expect(next, `模板里应有 ${cls}`).toBeGreaterThan(at);
      at = next;
    }
    // 没有人用 order / row-reverse 之类把朗读次序真的翻过来
    expect(short).not.toMatch(/order:\s*-?\d/);
    expect(short).not.toMatch(/direction:\s*rtl/);
  });

  it("竖屏与宽屏不进这个分支:只按高度收,不按宽度收", () => {
    expect(short).not.toMatch(/max-width/);
    // 默认档(1280×800 / 1024×768 / 竖屏)的格子尺寸原样
    expect(WGD_CSS).toMatch(/\.wgd-pad\{width:min\(72vw,300px\)/);
    expect(WGD_CSS).toMatch(/@media \(max-width:400px\)\{\s*\.wgd-pad\{width:min\(86vw,300px\)/);
  });

  it("花园那格在双栏里放开高度上限,不然右列自己又挤出一条内滚", () => {
    expect(short).toMatch(/\.wgd-garden\{[^}]*max-height:none/);
  });
});

describe("N-36 红线:手势面还是手势面,尺寸下限还在", () => {
  it("`.wgd-pad` 仍旧 touch-action:none —— 修的是「让它整格可见」,不是「让它能滚」", () => {
    expect(WGD_CSS).toMatch(/\.wgd-pad\{[^}]*touch-action:none/);
  });

  it("CSS 里的 min-width 兜住下限,inline 宽度再小也压不过它", () => {
    expect(WGD_CSS).toMatch(new RegExp(`\\.wgd-pad\\{[^}]*min-width:${MIN_PAD_PX}px`));
  });

  it("收边长前先把上次写死的宽度还回去,不然越量越小", () => {
    expect(TRACING).toMatch(/pad\.style\.width = "";/);
  });

  it("量的是格子自己探出多少,不是宿主一共溢出多少", () => {
    // 竖屏那档格子整格可见、只是底下花园要滚,收它是白收
    expect(TRACING).toMatch(/function padOverflowPx\(\)/);
    expect(TRACING).toMatch(/pad\.getBoundingClientRect\(\)\.bottom - visibleBottom/);
  });

  it("换字重排与窗口改尺寸都走收边长那条路,收完由 fitQuizHost 复位", () => {
    expect(TRACING).toMatch(/fitPad\(\);/);
    expect(TRACING).toMatch(/addEventListener\("resize", fitPad\)/);
    expect(TRACING).toMatch(/removeEventListener\("resize", fitPad\)/);
  });

  it("判定轨迹换算照旧按 box 取比例,收边长不动判分", () => {
    expect(TRACING).toMatch(/\(\(ev\.clientX - box\.left\) \/ w\) \* GRID/);
    expect(TRACING).toMatch(/\(\(ev\.clientY - box\.top\) \/ h\) \* GRID/);
  });
});
