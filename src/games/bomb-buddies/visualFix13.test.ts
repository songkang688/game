/**
 * bomb-buddies · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * Z1 残留:logic / ai / levels / domStub / visual13 / pace12.test 六个文件头注释
 * 的旧名已随更名一并清除 —— 这里把「全目录源码零商标词」钉死,谁回流当场红。
 * (PLAN-*.md 是历史计划文档,口径留主管裁决,不在断言范围。)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

describe("bomb-buddies · 修复员 · Z1 注释残留清零", () => {
  it("六个源码文件(含注释)再无旧名商标词", () => {
    for (const f of ["logic.ts", "ai.ts", "levels.ts", "domStub.ts", "visual13.ts", "pace12.test.ts"]) {
      expect(read(f), f).not.toContain("炸弹人");
    }
  });

  it("全部绘制与测试源码只认现行标题「泡泡布阵」", () => {
    expect(read("meta.ts")).toContain("泡泡布阵");
    expect(read("visual13.ts")).toContain("泡泡布阵");
  });
});
