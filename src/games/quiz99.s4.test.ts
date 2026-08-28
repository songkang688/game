import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./quiz99.ts", import.meta.url)), "utf8");
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("S-4 扩容 .qz-jump-input 44px", () => {
  it("管理员直达输入框 min-height 38→44", () => {
    expect(SRC).toMatch(/\.qz-jump-input \{[^}]*min-height: 44px/);
    expect(SRC).not.toMatch(/\.qz-jump-input \{[^}]*min-height: 38px/);
  });

  it("同排直达钮 .qz-jump-go 也钉 44(r11 root×拼音 135 量到高 32)", () => {
    expect(SRC).toMatch(/\.qz-jump-go \{[^}]*min-height: 44px/);
  });

  it("矮屏档不得把直达钮热区压回去", () => {
    const short = SRC.slice(SRC.indexOf("@media (max-height: 500px)"));
    expect(short).toMatch(/\.qz-jump-go \{[^}]*min-height: 44px/);
  });

  it("关内抬头直达钮(.l99-jump .l99-tool)同样 44,不改 N-37 :has 规则", () => {
    expect(L99).toContain(".l99-jump .l99-tool{min-height:44px;");
    expect(L99).toContain(".l99-stagebar:has(.l99-jump)");
  });
});
