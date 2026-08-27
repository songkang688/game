/**
 * 便便超人 · 双人手柄的热区与摆放（窗口5 第2轮 档C · W5R2-C-02 阻断）。
 *
 * 测试员在双人分屏里逐档量 12 颗手柄：390 上 41px、360 上 37px、320 上 34px——
 * 颗颗低于手指按得准的 44px，而且整排 `◀ ⬇ ▶` 还掉在裁切线以下点不着。
 *
 * 两件事各有各的根：
 *
 * ① **尺寸**：一行并排两盘、每盘四列，360px 上每盘只分到 163px，四列摊完就是 37px。
 *    四列怎么算都不够，所以砍成三列——动作键 `💨 🧹` 从第四列挪到上面一行，
 *    同样 163px 摊三列是 51px，320px 上也有 45px，四档全部过 44。
 *
 * ② **掉出屏幕**：双人画布靠 `@media (max-height:620px)` 收到 224px，
 *    可 360×640 的机器屏高 640 压根不触发那一档，画布留着 280px，
 *    而 `.game-stage` 只分到 530px、平台顶栏再吃掉 116px。媒体查询问错了对象——
 *    要按舞台**真正看得见的那一段**摊，超出多少就从画布身上扣多少。
 *
 * 改完复量（CDP，`elementFromPoint` 逐颗验）：
 *
 * | 视口 | 手柄边长 | 12 颗够不着 | 全场够不着 | 裁掉 |
 * | --- | --- | --- | --- | --- |
 * | 390×844 | 56 | 0 | 0 | 0 |
 * | 360×720 | 51 | 0 | 0 | 4 |
 * | 360×640 | 51 | 0 | 0 | 4 |
 * | 320×640 | 45 | 0 | 0 | 4 |
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MIN_CANVAS_H,
  MIN_HOT,
  PAD_COLUMNS,
  PAD_COLUMNS_DUO,
  canvasRoomPx,
  padMetrics,
  padOverlaps,
} from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("export const PH_CSS = `"), SRC.indexOf("\n`;", SRC.indexOf("export const PH_CSS = `")));

const WIDTHS = [320, 360, 390, 414];

describe("便便超人 · 双人手柄的热区（W5R2-C-02）", () => {
  it("四档宽度上双人 12 颗手柄一颗不落地 ≥ 44px", () => {
    for (const w of WIDTHS) {
      expect(padMetrics(w, 2).key, `${w}px 上双人手柄只有 ${padMetrics(w, 2).key}px`).toBeGreaterThanOrEqual(MIN_HOT);
    }
    // 测试员量到的那三个数,一个都不许再出现
    for (const w of WIDTHS) expect([34, 37, 41]).not.toContain(padMetrics(w, 2).key);
  });

  it("单人那一档一个字没动:仍是四列、仍 ≥ 44px、摇杆和清扫钮仍隔着一个 gap", () => {
    for (const w of WIDTHS) {
      const m = padMetrics(w, 1);
      expect(m.columns).toBe(PAD_COLUMNS);
      expect(m.key).toBeGreaterThanOrEqual(MIN_HOT);
      expect(padOverlaps(m)).toBe(false);
      expect(m.actionLeft - m.joystickRight).toBe(m.gap);
    }
  });

  it("双人砍成三列,两盘并排还塞得进屏幕", () => {
    for (const w of WIDTHS) {
      const m = padMetrics(w, 2);
      expect(m.columns).toBe(PAD_COLUMNS_DUO);
      expect(m.actionsOwnRow).toBe(true);
      expect(padOverlaps(m)).toBe(false);
      // 两盘 + 中间空隙 + 左右各 12px 内边距,不许溢出
      expect(m.totalWidth + 24, `${w}px 上两盘并排放不下`).toBeLessThanOrEqual(w);
    }
  });

  it("拿不到视口宽度时按 360px 兜底,双人也不会算出低于下限的数", () => {
    for (const bad of [Number.NaN, 0, -100]) {
      expect(padMetrics(bad, 1).key).toBeGreaterThanOrEqual(MIN_HOT);
      expect(padMetrics(bad, 2).key).toBeGreaterThanOrEqual(MIN_HOT);
    }
  });

  it("双人六颗键各占各的格子,没有两颗叠在同一格", () => {
    const duo = SRC.slice(SRC.indexOf("layout.actionsOwnRow"), SRC.indexOf("const padButtons"));
    const cells = [...duo.matchAll(/col:\s*(\d+),\s*row:\s*(\d+)/g)].map((m) => `${m[1]}:${m[2]}`);
    // 前六条是双人分支
    const duoCells = cells.slice(0, 6);
    expect(duoCells).toHaveLength(6);
    expect(new Set(duoCells).size, "有两颗键落在同一格上").toBe(6);
    // 三列以内,不许再出现第四列
    for (const c of duoCells) expect(Number(c.split(":")[0])).toBeLessThanOrEqual(PAD_COLUMNS_DUO);
    // 动作键在自己那一行(第 2 行),移动键整排在第 3 行
    expect(duoCells).toContain("1:2");
    expect(duoCells).toContain("3:2");
    expect(duoCells).toContain("1:3");
    expect(duoCells).toContain("2:3");
    expect(duoCells).toContain("3:3");
  });

  it("列数交给 CSS 变量,别把三列写死在单人那一份上", () => {
    expect(CSS).toContain("--cols:4");
    expect(CSS).toContain('.ph-pads[data-players="2"]{--cols:3;}');
    expect(CSS).toContain("grid-template-columns:repeat(var(--cols),var(--k))");
    expect(SRC).toContain('pads.style.setProperty("--cols", String(layout.columns))');
  });

  it("CSS 里的 --k 兜底值也不许低于 44px", () => {
    for (const hit of CSS.matchAll(/--k:\s*(\d+)px/g)) {
      expect(Number(hit[1]), `CSS 里有一处把 --k 写成了 ${hit[1]}px`).toBeGreaterThanOrEqual(MIN_HOT);
    }
  });
});

describe("便便超人 · 画布按舞台看得见那一段收（W5R2-C-02 掉出屏幕那一半）", () => {
  it("装得下就别管", () => {
    expect(canvasRoomPx(600, 280, 640)).toBeNull();
    expect(canvasRoomPx(640.5, 280, 640)).toBeNull();
  });

  it("超出多少就从画布身上扣多少", () => {
    // 整块 520 / 画布 280 / 舞台只给 414(530 减掉平台顶栏 116),超 106
    expect(canvasRoomPx(520, 280, 414)).toBe(280 - 106);
    // 扣完之后整块落回舞台看得见的那一段以内
    const next = canvasRoomPx(520, 280, 414) as number;
    expect(520 - (280 - next)).toBeLessThanOrEqual(414);
  });

  it("再挤也给画布留 130px,不然看不清脚下的路", () => {
    expect(canvasRoomPx(900, 280, 200)).toBe(MIN_CANVAS_H);
    expect(MIN_CANVAS_H).toBeGreaterThanOrEqual(130);
  });

  it("量不到裁切线（jsdom / 高屏）就按兵不动", () => {
    expect(canvasRoomPx(640, 280, Number.POSITIVE_INFINITY)).toBeNull();
    expect(canvasRoomPx(640, 280, Number.NaN)).toBeNull();
    expect(canvasRoomPx(640, 280, 0)).toBeNull();
    expect(canvasRoomPx(Number.NaN, 280, 414)).toBeNull();
    expect(canvasRoomPx(640, 0, 414)).toBeNull();
  });

  it("钳之前先还原,不然量到的是上一次收完的高度,越量越小", () => {
    const fit = SRC.slice(SRC.indexOf("function fitCanvas()"), SRC.indexOf("const g = canvas.getContext"));
    expect(fit.indexOf('canvas.style.height = ""')).toBeLessThan(fit.indexOf("canvasRoomPx("));
  });

  it("第一帧再钳一次:目标条和桶图例是挂上去之后才量得准的", () => {
    expect(SRC).toContain("bag.raf(requestAnimationFrame(fitCanvas))");
  });

  it("转屏得重钳,而且挂在 bag 上,destroy 一把摘干净", () => {
    expect(SRC).toContain('bag.listen(window, "resize", fitCanvas)');
  });
});
