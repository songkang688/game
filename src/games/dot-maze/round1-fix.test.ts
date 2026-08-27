/**
 * 豆豆迷宫 · 1.3 第 1 轮 C 档修复契约。
 *
 *  ① A 档 5-4（一般）：HUD 小字 <14px——chip / note / sub / tip 全部提到 ≥14px，
 *     窄屏媒体查询里也不许再降回去；
 *  ② A 档 6-1 / B 档 #6（建议·商标向）：幽灵剪影差异化——裙边四尖改三尖（齿距 r/1.5）、
 *     头顶加与豆豆勇士同款的小呆毛，与街机官方幽灵的剪影距离拉开。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { darkenColor, drawGhostFigure } from "./art";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 记录式 canvas 桩：把每次调用记成 "op(args)" 字符串 */
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

describe("dot-maze · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("chip / note / sub / tip 的每一条规则字号都 ≥14", () => {
    for (const cls of ["dmz-chip", "dmz-note", "dmz-sub", "dmz-tip"]) {
      const rules = [...SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

describe("dot-maze · 幽灵剪影差异化（A 档 6-1 / B 档 #6 修复）", () => {
  const base = { x: 40, y: 40, r: 15, color: "#FF9AB0", pupil: { dx: 1, dy: 0 }, starMark: false, warnRing: false };

  it("裙边改三尖:身体路径的 lineTo 数 = 1 + 3×2（不再是四齿的 9 笔）", () => {
    const { g, calls } = recordCtx();
    drawGhostFigure(g, { ...base, mood: "normal" });
    const firstStroke = calls.findIndex((c) => c.startsWith("quadraticCurveTo("));
    const bodyCalls = calls.slice(0, firstStroke === -1 ? calls.length : firstStroke);
    const lineTos = bodyCalls.filter((c) => c.startsWith("lineTo(")).length;
    expect(lineTos).toBe(7);
  });

  it("normal 与 fright 都长着头顶呆毛（quadraticCurveTo 一笔），eyes 态没有", () => {
    for (const mood of ["normal", "fright"] as const) {
      const { g, calls } = recordCtx();
      drawGhostFigure(g, { ...base, mood });
      expect(
        calls.some((c) => c.startsWith("quadraticCurveTo(")),
        `${mood} 态缺呆毛`
      ).toBe(true);
    }
    const { g, calls } = recordCtx();
    drawGhostFigure(g, { ...base, mood: "eyes" });
    expect(calls.some((c) => c.startsWith("quadraticCurveTo("))).toBe(false);
  });

  it("呆毛描边取身体色加深两成，认不出的颜色串原样兜底", () => {
    expect(darkenColor("#FF9AB0", 0.8)).toBe("rgb(204,123,141)");
    expect(darkenColor("rgba(1,2,3,.5)", 0.8)).toBe("rgba(1,2,3,.5)");
    const { g, calls } = recordCtx();
    drawGhostFigure(g, { ...base, mood: "normal" });
    expect(calls.some((c) => c === "set:strokeStyle=rgb(204,123,141)")).toBe(true);
  });
});
