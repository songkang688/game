import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r22–r26 B 热区票 CSS ≥44", () => {
  it("N-133 无尽回关 / N-139 对手芯片", () => {
    expect(read("red-blue-race/index.ts")).toMatch(/\.rbe-back \{[^}]*min-height: 44px/s);
    expect(read("red-blue-race/index.ts")).toMatch(/\.rbv-foe \{[^}]*min-height: 44px/s);
  });

  it("N-134 打靶返回不回退 N-124 toggle 44 与 500 画布钳", () => {
    const s = read("shoot-range/index.ts");
    expect(s).toMatch(/\.shr-back\{[^}]*min-height:44px/);
    expect(s).toContain(".shr-toggle{border:none;border-radius:999px;min-height:44px");
    expect(s).toContain(".shr-cv{height:min(140px,36dvh);}");
  });

  it("N-135 保龄/钓鱼/光球 回选关", () => {
    expect(read("bowling-lane/index.ts")).toMatch(/\.bl-back\{[^}]*min-height:44px/);
    expect(read("fishing-star/index.ts")).toMatch(/\.fs-back\{[^}]*min-height:44px/);
    expect(read("orb-arena/index.ts")).toMatch(/\.oa-back\{[^}]*min-height:44px/);
  });

  it("N-139 mole-pop 开/返回后盖 44（N-47 40 字面量仍在）", () => {
    const s = read("mole-pop/index.ts");
    expect(s).toContain(".mp-open, .mp-back { min-height: 40px; }");
    expect(s).toContain(".mp-open, .mp-back { min-height: 44px; }");
  });

  it("不回退 N-121/122 接果气球冲刺", () => {
    expect(read("fruit-catch/index.ts")).toMatch(/\.frc-open \{[^}]*min-height: 44px/s);
    expect(read("balloon-pop/index.ts")).toContain(".blp-open,.blp-back{min-height:44px;}");
    expect(read("duo-rush/index.ts")).toContain("@media (max-width: 430px) and (min-height: 700px)");
  });
});
