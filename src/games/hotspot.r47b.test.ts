import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r47 B · N-201 .oa-back / N-202 钓鱼 .fs-back", () => {
  it("N-201 光球回关 44 + 居中，不改 open/技能", () => {
    const s = read("orb-arena/index.ts");
    expect(s).toMatch(/\.oa-back\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.oa-back\{[^}]*display:inline-flex/s);
    expect(s).toContain(
      ".oa-open{border:none;border-radius:999px;padding:9px 18px;min-height:44px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;",
    );
    expect(s).toContain(".oa-btn{min-width:88px;min-height:46px;");
  });

  it("N-202 钓鱼回关 44 + 居中；果盆同名与暂停 veil 零改", () => {
    const fish = read("fishing-star/index.ts");
    expect(fish).toMatch(/\.fs-back\{[^}]*min-height:44px/s);
    expect(fish).toMatch(/\.fs-back\{[^}]*display:inline-flex/s);
    expect(fish).toContain('const go = button("fs-btn", "▶ 继续");');
    const stack = read("fruit-stack/index.ts");
    expect(stack).toContain(
      ".fs-back{border:none;border-radius:999px;padding:6px 12px;min-height:44px;font-size:14px;font-weight:900;",
    );
    expect(stack).toContain("color:#a8456a;");
  });

  it("不回退 820 菜单修；不改 l99；N-105 禁第四版", () => {
    expect(read("duo-arena/index.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("gomoku/view.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("level99.ts")).not.toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
