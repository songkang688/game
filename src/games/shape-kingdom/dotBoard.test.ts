/**
 * 形状王国 · 点阵作图台的宽度守门（1.2 窗口5 第 1 轮 · 档B）。
 *
 * 测试员 W5-B-03（严重）：作图关的点阵是 7 列，可画板只有 279px 宽、右边缘在
 * x=320，而第 7 列的点心在 x=387——比画板右缘还右 67px，五行的第 7 列全部够不着，
 * 「6×1 那种要横跨 6 格的解法在手机上摆不出来」。桌面上不复现，只坑手机。
 *
 * 根因是老的 `drawMetrics()` 先把格子撑满可用宽度、再往外加一个热区，
 * 整块板子必然溢出，被 flex 父级压扁之后绝对定位的点就落到板外。
 * 新的 `dotBoardMetrics()` 反过来先定死整块板子的宽度。这一份钉住三件事：
 * 板子不超宽、每一颗点的热区都整个落在板内、热区不小于 44px。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_DRAW_COLS, MIN_BOARD, MIN_HIT, dotBoardMetrics, drawMetrics } from "./draw";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}draw.ts`, "utf8");

/** 真机上跑得到的屏宽（320 是仍在服役的老安卓机） */
const VIEWPORTS = [320, 360, 390, 412, 768, 1280];
/** 作图关实际用的点阵：6 格宽、4 或 5 格高 */
const SHAPES: Array<[cols: number, rows: number]> = [
  [MAX_DRAW_COLS, 4],
  [MAX_DRAW_COLS, 5],
];

/** 这块屏上板子最多能占多宽（和实现里的口径一致） */
function roomFor(vw: number): number {
  return Math.max(MIN_BOARD, Math.min(360, vw - 40));
}

describe("形状王国 · 点阵作图台在手机上摆得下", () => {
  it("整块板子不超过可用宽度，最右一列不会被挤出板外", () => {
    for (const vw of VIEWPORTS) {
      for (const [cols, rows] of SHAPES) {
        const m = dotBoardMetrics(vw, cols, rows);
        const room = roomFor(vw);
        expect(m.width, `${vw}px ${cols}×${rows} 的板子超宽了`).toBeLessThanOrEqual(room + 0.001);
        expect(m.height, `${vw}px ${cols}×${rows} 的板子超高了`).toBeLessThanOrEqual(room + 0.001);
        expect(m.hit, `${vw}px 的热区缩水了`).toBeGreaterThanOrEqual(MIN_HIT);
        expect(m.unit).toBeGreaterThan(0);
      }
    }
  });

  it("每一颗点的热区都整个落在板子里（第 1 列和第 7 列都算）", () => {
    for (const vw of VIEWPORTS) {
      for (const [cols, rows] of SHAPES) {
        const m = dotBoardMetrics(vw, cols, rows);
        // 界面里点是这么摆的：pad = hit/2，左上角 = pad + n*unit - hit/2
        const pad = m.hit / 2;
        for (let c = 0; c <= cols; c++) {
          const left = pad + c * m.unit - m.hit / 2;
          expect(left, `${vw}px 第 ${c + 1} 列探到板子左边外面了`).toBeGreaterThanOrEqual(-0.001);
          expect(left + m.hit, `${vw}px 第 ${c + 1} 列探到板子右边外面了`)
            .toBeLessThanOrEqual(m.width + 0.001);
          // 点心（吸附判定用的那个坐标）也必须在板内
          expect(pad + c * m.unit).toBeLessThanOrEqual(m.width + 0.001);
        }
        for (let r = 0; r <= rows; r++) {
          const top = pad + r * m.unit - m.hit / 2;
          expect(top).toBeGreaterThanOrEqual(-0.001);
          expect(top + m.hit).toBeLessThanOrEqual(m.height + 0.001);
        }
      }
    }
  });

  it("这确实是修了一个真溢出：老口径在 360px 上要宽出去几十个像素", () => {
    // 留个反例在这里，说明这条用例不是空转的
    const old = drawMetrics(360, MAX_DRAW_COLS, 5);
    const oldWidth = old.unit * MAX_DRAW_COLS + old.hit;
    expect(oldWidth).toBeGreaterThan(roomFor(360));
    expect(dotBoardMetrics(360, MAX_DRAW_COLS, 5).width).toBeLessThanOrEqual(roomFor(360));
  });

  it("界面用的是新口径，板子也不许再被 flex 压扁", () => {
    const at = source.indexOf("function buildRectBoard");
    expect(at).toBeGreaterThan(-1);
    const body = source.slice(at, at + 400);
    expect(body).toContain("dotBoardMetrics(viewport()");
    expect(body).not.toContain("drawMetrics(viewport()");
    // 被压扁正是老毛病的一半：点按原像素摆，板子却缩了
    const rule = source.slice(source.indexOf(".shk-board{"), source.indexOf("}", source.indexOf(".shk-board{")));
    expect(rule).toContain("flex:none");
  });
});
