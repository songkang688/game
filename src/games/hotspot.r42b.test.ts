import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r42 B · N-186 / N-187 记忆翻牌入口与齿轮", () => {
  it("N-186 .mmc-open 44，不改翻牌规则与 N-69 卡钳、N-180 sn-open", () => {
    const s = read("memory-cards/index.ts");
    expect(s).toMatch(/\.mmc-open \{[^}]*min-height: 44px/);
    expect(s).toContain("@media (min-width: 640px) and (max-height: 500px)");
    expect(s).toContain(".mmc-card { aspect-ratio: auto; min-height: 44px; height: clamp(48px, 16dvh, 72px); }");
    expect(read("snake-snack/index.ts")).toMatch(/\.sn-open \{[^}]*min-height: 44px/);
  });

  it("N-187 .mmc-toggle 44，不改 N-134 shr-toggle 与 snk-toggle", () => {
    const s = read("memory-cards/index.ts");
    expect(s).toMatch(/\.mmc-toggle \{[^}]*min-height: 44px/);
    expect(read("shoot-range/index.ts")).toMatch(/\.shr-toggle\{[^}]*min-height:44px/);
    expect(read("snake-snack/index.ts")).toMatch(/\.snk-toggle \{[^}]*min-height: 44px/);
  });

  it("不回退 N-177/180/174 与果盆中间档；N-105 禁第四版", () => {
    expect(read("duo-vs-star/index.ts")).toMatch(/\.dvs-lessonbtn\{[^}]*min-height:44px/s);
    expect(read("red-blue-tug/index.ts")).toMatch(/\.rbg-pick \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(read("fruit-stack/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("mahjong-bloom/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
