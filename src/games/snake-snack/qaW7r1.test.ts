/**
 * 贪吃小蛇 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 蛇身走 kit 圆节毛毛虫(不再是方块虫);
 * ② 零食全自绘:emoji 字符只当「哪一种」的钥匙,画面全是矢量(专项①);
 * ③ 体积笔 ball() 是三停渐变、亮心偏左上(专项② + kit 光照约定)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSnack } from "./visual13";
import { SNACK_EMOJI } from "./snake12";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const VIS_SRC = readFileSync(fileURLToPath(new URL("./visual13.ts", import.meta.url)), "utf8");

interface Rec {
  ops: string[];
  texts: string[];
}

/** 只记录关心的调用;paintSnack 只需要这些成员 */
function stubCtx(rec: Rec): CanvasRenderingContext2D {
  const noop = (name: string) => (...args: unknown[]) => {
    rec.ops.push(name);
    if (name === "fillText" && typeof args[0] === "string") rec.texts.push(args[0]);
  };
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop: string) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return (...args: unknown[]) => {
          void args;
          rec.ops.push(prop);
          return { addColorStop: () => undefined };
        };
      }
      return noop(prop);
    },
    set() {
      return true;
    },
  });
}

describe("窗口7 R1 · snake-snack 专项①:蛇与零食不许 emoji 直出", () => {
  it("index.ts 蛇身走 kit drawCaterpillar", () => {
    expect(SRC.includes('from "../../art/kit/caterpillar"')).toBe(true);
    expect(SRC).toContain("drawCaterpillar");
  });

  it("五款零食 paintSnack 全程零 fillText(纯矢量)", () => {
    for (const kind of SNACK_EMOJI) {
      const rec: Rec = { ops: [], texts: [] };
      paintSnack(stubCtx(rec), 3, 3, 24, kind, 1);
      expect(rec.texts).toEqual([]);
      expect(rec.ops.filter((o) => o === "fill" || o === "stroke").length).toBeGreaterThan(0);
    }
  });
});

describe("窗口7 R1 · snake-snack 专项②:体积笔三停渐变", () => {
  it("ball() 用三停径向渐变且亮心偏左上(-0.35r)", () => {
    const seg = VIS_SRC.slice(VIS_SRC.indexOf("function ball"), VIS_SRC.indexOf("function ball") + 600);
    expect(seg).toContain("createRadialGradient(cx - r * 0.35, cy - r * 0.35");
    expect((seg.match(/addColorStop/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
