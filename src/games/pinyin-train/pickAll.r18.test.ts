/**
 * trio-r18(N-94):挑拣车厢(多音字多选,第 150 关族)整块内容 ~320px,
 * 915×412 舞台槽位只有 ~190px ——「✅ 就挑这些」380–428 全程在裁切线(342)下、
 * 390×844 也差 7px 把反馈行挤出屏,且没有任何可滚祖先(root 开/关都一样)。
 * 修法:把 .pk-wrap 交给本目录实战过的 fitQuizHost(W5R2-FC-01 同款):
 * 装不下才钳高 + 自滚,装得下自动还原。这里钉住:
 *  1. runPickAll 真挂了 fitQuizHost,destroy 里有 dispose(不留孤儿监听);
 *  2. 「再听一遍」sticky top 与「就挑这些」sticky bottom 保留(卷轴里仍随手可点);
 *  3. 玩法零触碰:判分纯函数原样。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { judgePickAll } from "./pickAll";

const SRC = readFileSync(fileURLToPath(new URL("./pickAll.ts", import.meta.url)), "utf8");

describe("N-94 挑拣车厢装不下时能滚", () => {
  it("挂上了 fitQuizHost,销毁时 dispose", () => {
    expect(SRC).toMatch(/import \{ fitQuizHost \} from "\.\/fit"/);
    expect(SRC).toContain("const fit = fitQuizHost(wrap);");
    const destroyBody = SRC.slice(SRC.indexOf("destroy() {"));
    expect(destroyBody).toContain("fit.dispose();");
  });

  it("竖屏基准布局不动:min-height:380px 仍在默认块", () => {
    expect(SRC).toContain("min-height:380px");
  });

  it("卷轴两端的 sticky 快捷键保留", () => {
    expect(SRC).toContain(".pk-say-row{display:flex;justify-content:center;position:sticky;top:4px");
    expect(SRC).toContain(".pk-go{position:sticky;bottom:0;z-index:2;}");
  });

  it("判分纯函数零触碰:多挑漏挑口径与 1.1 一致", () => {
    expect(judgePickAll(["长大", "校长"], ["长大", "校长"])).toEqual({ missing: 0, extra: 0, ok: true });
    expect(judgePickAll(["长大"], ["长大", "校长"])).toEqual({ missing: 1, extra: 0, ok: false });
    expect(judgePickAll(["长大", "白云"], ["长大", "校长"])).toEqual({ missing: 1, extra: 1, ok: false });
  });
});
