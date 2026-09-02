/**
 * 亮豆迷宫 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项③/⑥：四只幽灵配色两两不同、全是马卡龙淡彩（每通道 ≥ 120），
 *     与街机官方四色(饱和红/粉/青/橙)保持距离——不许有任何一个通道压到 0 档饱和色；
 *  ② 专项①：玩家不是「纯圆两点眼」——身体必须走 ≥ 3 停径向渐变，还有呆毛与高光点眼；
 *  ③ 幽灵三态(normal/fright/eyes)绘制序列两两不同,normal 有顶部高光。
 */
import { describe, expect, it } from "vitest";
import { drawGhostFigure, drawPlayerFigure } from "./art";
import { GHOST_COLORS } from "./ghosts";

function recordCtx(): { g: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const fmt = (v: unknown): string => (typeof v === "number" ? v.toFixed(1) : String(v));
  const g = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        return (...args: unknown[]) => {
          calls.push(`${prop}(${args.map(fmt).join(",")})`);
          if (prop === "createRadialGradient" || prop === "createLinearGradient") {
            return { addColorStop: (o: number, c: string) => calls.push(`stop(${fmt(o)},${c})`) };
          }
          return undefined;
        };
      },
      set(_t, prop, v) {
        calls.push(`${String(prop)}=${fmt(v)}`);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("专项③/⑥:幽灵配色", () => {
  it("四色两两不同,且每个 RGB 通道 ≥ 120(马卡龙淡彩,不撞街机饱和色)", () => {
    const colors = Object.values(GHOST_COLORS);
    expect(new Set(colors.map((c) => c.toLowerCase())).size).toBe(4);
    for (const c of colors) {
      const n = Number.parseInt(c.slice(1), 16);
      const [r, gg, b] = [n >> 16, (n >> 8) & 255, n & 255];
      expect(Math.min(r, gg, b), `${c} 有通道压到饱和档`).toBeGreaterThanOrEqual(120);
    }
  });
});

describe("专项①:玩家不是纯圆两点眼", () => {
  it("身体 ≥ 3 停径向渐变 + 呆毛(quadraticCurveTo) + 眼上高光点(三个圆)", () => {
    const { g, calls } = recordCtx();
    drawPlayerFigure(g, { x: 50, y: 50, r: 16, dir: "right", mouth: 0.3, flash: false, shield: false, sad: false });
    expect(calls.some((c) => c.startsWith("createRadialGradient("))).toBe(true);
    expect(calls.filter((c) => c.startsWith("stop(")).length, "渐变 ≥ 3 停").toBeGreaterThanOrEqual(3);
    expect(calls.some((c) => c.startsWith("quadraticCurveTo(")), "呆毛没画").toBe(true);
    // 眼白 + 深瞳 + 高光点:嘴形扇形之外还有 ≥ 3 个 arc
    expect(calls.filter((c) => c.startsWith("arc(")).length).toBeGreaterThanOrEqual(4);
  });

  it("flash 帧与普通帧的渐变停色不同(无敌闪白有实现)", () => {
    const a = recordCtx();
    drawPlayerFigure(a.g, { x: 0, y: 0, r: 16, dir: "up", mouth: 0.2, flash: false, shield: false, sad: false });
    const b = recordCtx();
    drawPlayerFigure(b.g, { x: 0, y: 0, r: 16, dir: "up", mouth: 0.2, flash: true, shield: false, sad: false });
    const stops = (calls: string[]): string => calls.filter((c) => c.startsWith("stop(")).join("|");
    expect(stops(a.calls)).not.toBe(stops(b.calls));
  });
});

describe("幽灵三态互异", () => {
  const base = { x: 40, y: 40, r: 15, color: "#FF9AB0", pupil: { dx: 1, dy: 0 }, starMark: false, warnRing: false };

  it("normal / fright / eyes 的绘制序列两两不同", () => {
    const seqs = new Set<string>();
    for (const mood of ["normal", "fright", "eyes"] as const) {
      const { g, calls } = recordCtx();
      drawGhostFigure(g, { ...base, mood });
      seqs.add(calls.join(";"));
    }
    expect(seqs.size).toBe(3);
  });

  it("normal 态有顶部高光(rgba 白 0.32)与瞳孔随向偏移", () => {
    const { g, calls } = recordCtx();
    drawGhostFigure(g, { ...base, mood: "normal" });
    expect(calls.some((c) => c.includes("rgba(255,255,255,0.32)"))).toBe(true);
    const { g: g2, calls: calls2 } = recordCtx();
    drawGhostFigure(g2, { ...base, mood: "normal", pupil: { dx: -1.2, dy: 0 } });
    expect(calls.join(";")).not.toBe(calls2.join(";"));
  });
});
