import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./quiz99.ts", import.meta.url)), "utf8");

describe("S-4 扩容 .qz-jump-input 44px", () => {
  it("管理员直达输入框 min-height 38→44", () => {
    expect(SRC).toMatch(/\.qz-jump-input \{[^}]*min-height: 44px/);
    expect(SRC).not.toMatch(/\.qz-jump-input \{[^}]*min-height: 38px/);
  });

  it("管理员直达钮 .qz-jump-go min-height 32→44（矮屏档不得回退）", () => {
    expect(SRC).toMatch(/\.qz-jump-go \{[^}]*min-height: 44px/);
    const short = SRC.slice(SRC.indexOf("@media (max-height: 500px)"));
    expect(short).toMatch(/\.qz-jump-go \{[^}]*min-height: 44px/);
  });
});
