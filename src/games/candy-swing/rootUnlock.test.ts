import { describe, expect, it } from "vitest";
import { unlockedWithRoot } from "./rootUnlock";

describe("unlockedWithRoot:管理员权限开着全关可进", () => {
  it("root 开:原本锁着的关也放行", () => {
    expect(unlockedWithRoot(true, false)).toBe(true);
    expect(unlockedWithRoot(true, true)).toBe(true);
  });
  it("root 关:完全跟着原判定走", () => {
    expect(unlockedWithRoot(false, true)).toBe(true);
    expect(unlockedWithRoot(false, false)).toBe(false);
  });
});
