/**
 * 豆豆迷宫 · 1.3 第 2 轮 A 档复验契约（对 r1 建议 6-1 修复的小尺寸加固）。
 *
 * 深度走查项「缩到 16px 再看一次」的机器化沉淀:r1-fix 在 r=15 验证过三尖裙边
 * 与呆毛,这里把半径压到 r=8(直径 16px)——三尖裙边不许退化、三种情绪的指令
 * 序列仍两两互异、呆毛描边有 1.5px 下限保底(细过这个数在深底上就看不见了)。
 */
import { describe, expect, it } from "vitest";
import { drawGhostFigure, type GhostFigureMood } from "./art";

function recordCtx(): { g: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const g = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        calls.push(`${prop}(${JSON.stringify(args)})`);
      };
    },
    set(t, prop: string, v) {
      t[prop] = v;
      calls.push(`set:${prop}=${String(v)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

const base = { x: 40, y: 40, r: 8, color: "#FF9AB0", pupil: { dx: 1, dy: 0 }, starMark: false, warnRing: false };

describe("dot-maze · 幽灵 16px 直径下的剪影鲁棒性（r2 深挖沉淀）", () => {
  it("r=8 时三尖裙边不退化(身体 lineTo 仍 7 笔),呆毛描边有 1.5px 下限", () => {
    const { g, calls } = recordCtx();
    drawGhostFigure(g, { ...base, mood: "normal" });
    const firstQuad = calls.findIndex((c) => c.startsWith("quadraticCurveTo("));
    const bodyCalls = calls.slice(0, firstQuad === -1 ? calls.length : firstQuad);
    expect(bodyCalls.filter((c) => c.startsWith("lineTo(")).length).toBe(7);
    // max(1.5, 8*0.12=0.96) → 1.5px 下限生效
    expect(calls).toContain("set:lineWidth=1.5");
  });

  it("r=8 时 normal / fright / eyes 三态指令序列仍两两互异", () => {
    const seq = (mood: GhostFigureMood): string => {
      const { g, calls } = recordCtx();
      drawGhostFigure(g, { ...base, mood });
      return calls.join("|");
    };
    const normal = seq("normal");
    const fright = seq("fright");
    const eyes = seq("eyes");
    expect(normal).not.toBe(fright);
    expect(fright).not.toBe(eyes);
    expect(normal).not.toBe(eyes);
  });
});
