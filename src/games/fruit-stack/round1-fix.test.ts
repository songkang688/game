/**
 * 合果盆栽 · 1.3 第 1 轮 C 档修复契约。
 *
 *  ① A 档 5-4（一般）：HUD 小字 <14px——chip / btn / bowlname / next / result-slot /
 *     tip / veil-s / back / open / pick 全部提到 ≥14px，窄屏媒体查询里也不许再降回去；
 *  ② B 档 #9（建议·双人剪影）：双盆本体同款——盆口两侧内沿各刷一道 3px 座位色内衬
 *     （与座位条字色同源：朵朵 #a8306a / 星星 #28568f），纯视觉描边、碰撞盒不变。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { El, flushFrames, installDom, restoreDom, type Dom } from "./domStub";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

let dom: Dom;

beforeEach(() => {
  dom = installDom(420);
});

afterEach(() => {
  restoreDom();
});
const CLASSES = [
  "fs-chip",
  "fs-btn",
  "fs-bowlname",
  "fs-next",
  "fs-result-slot",
  "fs-tip",
  "fs-veil-s",
  "fs-back",
  "fs-open",
  "fs-pick",
];

describe("fruit-stack · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("清单里每个类的每条规则字号都 ≥14", () => {
    for (const cls of CLASSES) {
      const rules = [...SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

describe("fruit-stack · 双盆座位色内衬（B 档 #9 修复）", () => {
  it("双人同屏一帧下来，两种座位内衬色都真的刷上了盆沿", async () => {
    const fills: string[] = [];
    const orig = El.prototype.getContext;
    const rec = new Proxy(
      { fillStyle: "" },
      {
        get(t: Record<string, unknown>, prop) {
          if (typeof prop !== "string") return undefined;
          if (prop in t) return t[prop];
          return (...args: unknown[]) => {
            if (prop === "fillRect") fills.push(String(t.fillStyle));
            if (prop === "createRadialGradient" || prop === "createLinearGradient") {
              return { addColorStop: () => undefined };
            }
            void args;
            return undefined;
          };
        },
        set(t: Record<string, unknown>, prop, v) {
          if (typeof prop === "string") t[prop] = v;
          return true;
        },
      }
    ) as unknown as CanvasRenderingContext2D;
    El.prototype.getContext = (() => rec) as typeof El.prototype.getContext;
    try {
      const { mount } = await import("./index");
      const api = {
        root: dom.root as unknown as HTMLElement,
        play: () => undefined,
        addStars: () => 0,
        getStars: () => 0,
        onWin: () => undefined,
        onLose: () => undefined,
      } as unknown as GameApi;
      const handle = mount(api);
      const btns = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes("双人同屏"));
      expect(btns.length, "找不到双人同屏入口").toBeGreaterThan(0);
      btns[btns.length - 1].dispatch("click");
      flushFrames(dom, 4);
      expect(fills, "朵朵盆的内衬色没刷上").toContain("#a8306a");
      expect(fills, "星星盆的内衬色没刷上").toContain("#28568f");
      handle.destroy();
    } finally {
      El.prototype.getContext = orig;
    }
  });
});
