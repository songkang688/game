/** 三人组 r18 · N-101 赛中触屏键柱进 412（915×412 实测原 400~746 全线下） */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 切出矮横屏媒体块（数括号找配对收尾） */
function landscapeBlock(s: string): string {
  const at = s.indexOf("@media (max-height:520px) and (orientation:landscape)");
  expect(at, "矮横屏媒体块丢了(N-26 会回退)").toBeGreaterThan(-1);
  const from = s.indexOf("{", at) + 1;
  let depth = 1;
  let i = from;
  for (; i < s.length && depth > 0; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth--;
  }
  return s.slice(from, i - 1);
}

describe("N-101 duo-vs-star 赛中触屏键柱", () => {
  it("键柱放画布那一行(grid-row:2)两侧,不再排画布下方", () => {
    const block = landscapeBlock(src);
    const pads = block.match(/\.dvs-pads\s*\{([^}]*)\}/);
    expect(pads, "矮横屏块里找不到 .dvs-pads").not.toBeNull();
    expect(pads?.[1]).toContain("grid-row:2");
    expect(pads?.[1], "回到 grid-row:4 就是把 14 键重新压回 412 线下").not.toContain("grid-row:4");
  });

  it("两键一行竖码且热区 ≥44(七键一柱 360px 高装不进 412)", () => {
    const block = landscapeBlock(src);
    expect(block).toContain(".dvs-pads .dvs-pad{flex-direction:row;flex-wrap:wrap");
    const btn = block.match(/\.dvs-pads \.dvs-pad button\s*\{([^}]*)\}/);
    expect(btn, "矮横屏块里找不到键钮规则").not.toBeNull();
    const mh = btn?.[1].match(/min-height:\s*([0-9.]+)px/);
    expect(mh, "键钮必须写 min-height").not.toBeNull();
    expect(Number(mh?.[1])).toBeGreaterThanOrEqual(44);
  });
});
