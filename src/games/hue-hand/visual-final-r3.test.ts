/**
 * 花色接龙 · 1.3 窗口3 第 3 轮视觉验收(终验) · 测试员机器扫描。
 *
 * 终验三条防线(全部为静态源码断言,沉淀为长期回归网):
 *  1. 全目录非测试源码任何单行 fillText 不直出 emoji 图标字——第 2 轮台账清账的终态钉死
 *     (比第 1 轮 visual-scan 的 art.ts 限定更宽,覆盖 index/view 等全部绘制接入层);
 *  2. 前两轮沉淀的机器化视觉用例文件必须在库、非空且无 skip/only——终验口径:被删或被跳过按阻断处理;
 *  3. 商标黑名单终扫加严词(第 1 轮 23 词之外追加 16 词)全目录正式源码(含注释)零命中。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (f: string): string => fileURLToPath(new URL(f, import.meta.url));
const read = (f: string): string => readFileSync(here(f), "utf8");

/** 与第 1 轮 visual-scan 同一套 emoji 判定:BMP 符号区 + 代理对兜住补充平面 */
const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

/** 前两轮沉淀的机器化视觉用例(终验守卫对象) */
const GUARDED_TESTS = ["visual-scan.test.ts", "visual-fix-r1.test.ts", "visual-deep-r2.test.ts", "learner-copy.test.ts"];

/** 终验加严商标词(第 1 轮 23 词已由 visual-scan 钉住,此处只列增量) */
const EXTRA_MARKS = [
  "植物大战僵尸", "愤怒的小鸟", "水果忍者", "大鱼吃小鱼", "钢琴块", "Piano Tiles",
  "Subway Surf", "神庙逃亡", "Temple Run", "天天酷跑", "保卫萝卜", "贪吃蛇大作战",
  "球球大作战", "森林冰火人", "割绳子", "Cut the Rope",
];

const srcFiles = (): string[] =>
  readdirSync(here(".")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("1.3 视觉终验机器扫描(窗口3 · round3 tester)", () => {
  it("全目录非测试源码单行 fillText 零 emoji 直出(第 2 轮清账终态)", () => {
    const bad: string[] = [];
    for (const f of srcFiles()) {
      read(`./${f}`)
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
        .forEach((l) => {
          if (l.includes("fillText(") && EMOJI_RE.test(l)) bad.push(`${f}: ${l.slice(0, 80)}`);
        });
    }
    expect(bad).toEqual([]);
  });

  it("前两轮机器化视觉用例在库、非空、无 skip/only(被删或被跳过按阻断)", () => {
    for (const t of GUARDED_TESTS) {
      expect(existsSync(here(`./${t}`)), `${t} 不在库`).toBe(true);
      const src = read(`./${t}`);
      expect(src.length > 400, `${t} 疑似被清空`).toBe(true);
      expect(/\bit\(/.test(src), `${t} 不含用例`).toBe(true);
      for (const banned of ["it.skip(", "describe.skip(", "it.only(", "describe.only(", "xit(", "xdescribe(", "it.todo("]) {
        expect(src.includes(banned), `${t} 含 ${banned}`).toBe(false);
      }
    }
  });

  it("商标黑名单终扫加严词全目录零命中(含注释)", () => {
    for (const f of srcFiles()) {
      const src = read(`./${f}`).toLowerCase();
      for (const m of EXTRA_MARKS) expect(src.includes(m.toLowerCase()), `${f} 含「${m}」`).toBe(false);
    }
  });
});
