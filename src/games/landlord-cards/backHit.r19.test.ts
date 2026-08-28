/** N-104:landlord-cards「回选关」h=33 抬到 44 红线(开局+出牌两态共用同一条规则) */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-104 landlord-cards 返回键热区", () => {
  it(".ld-back 带 min-height:44px", () => {
    const rule = SRC.slice(SRC.indexOf(".ld-back{"), SRC.indexOf(".ld-back:active"));
    expect(rule).toContain("min-height:44px");
  });
});
