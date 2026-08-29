import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SKY_H } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-121 balloon-pop 模式键触区", () => {
  it("kit 40 守门保留,叠一条 44,SKY_H 与 C-8 钳高不回退", () => {
    expect(SRC).toContain('touchUpliftCss([".blp-open", ".blp-back"])');
    expect(SRC).toContain(".blp-open,.blp-back{min-height:44px;}");
    expect(SKY_H).toBe(420);
    expect(SRC).toContain(".blp-sky { max-height: max(96px, calc(100dvh - 200px)); }");
  });
});
