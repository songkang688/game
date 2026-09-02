import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TABLE_CHROME_PX } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-62 merge-2048 四向", () => {
  it("桌面家当预留够一排四向,矮屏钉 .mg-pad", () => {
    expect(TABLE_CHROME_PX).toBeGreaterThanOrEqual(200);
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".mg-pad{position:sticky;bottom:0");
  });
});
