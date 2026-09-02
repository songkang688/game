/**
 * 果果叠叠乐 · 1.3 第 2 轮 A 档复验契约（对 r1 建议 B#9 修复的同源性加固）。
 *
 * 盆沿座位色内衬(朵朵 #a8306a / 星星 #28568f)的价值在「与座位条字色同源」——
 * 孩子在 HUD 认到的颜色和盆沿看到的是同一个。本文件从源码钉住三件事:
 *  ① 两个座位色在 HUD chip 与盆沿内衬里各出现一次以上(同源不许分叉);
 *  ② 内衬只刷上 60% 高——盆底留白,不跟果子堆抢注意力;
 *  ③ 内衬是 3px 细带,画在 drawRim 里(纯视觉层,物理盒不碰)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("fruit-stack · 盆沿内衬与座位条同源（r2 复验加固）", () => {
  it("座位色同源:HUD chip 与盆沿内衬用同一对色值", () => {
    expect(SRC).toContain(".fs-chip-p0{color:#a8306a");
    expect(SRC).toContain(".fs-chip-p1{color:#28568f");
    expect(SRC).toContain('opts.seat === 0 ? "#a8306a" : "#28568f"');
  });

  it("内衬是 3px 细带、只刷上 60% 高,落在 drawRim 纯视觉层", () => {
    const rim = SRC.slice(SRC.indexOf("function drawRim"), SRC.indexOf("function drawRim") + 1600);
    expect(rim).toContain('opts.seat === 0 ? "#a8306a" : "#28568f"');
    expect(rim).toContain("b.h * 0.6");
    expect(rim.match(/fillRect\(RIM, 0, 3, b\.h \* 0\.6\)/)).not.toBeNull();
    expect(rim.match(/fillRect\(b\.w - RIM - 3, 0, 3, b\.h \* 0\.6\)/)).not.toBeNull();
  });
});
