/** 三人组 r18 · N-104「◀ 回选关」触区 33px → ≥44（915×412 实测 .ld-back 76~109） */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-104 landlord-cards 回选关触区", () => {
  it(".ld-back 写了 min-height ≥44", () => {
    const rule = src.slice(src.indexOf(".ld-back{"), src.indexOf(".ld-back:active"));
    const mh = rule.match(/min-height:\s*([0-9.]+)px/);
    expect(mh, ".ld-back 必须写 min-height,padding 撑出来的 33px 手指按不准").not.toBeNull();
    expect(Number(mh?.[1])).toBeGreaterThanOrEqual(44);
  });
});
