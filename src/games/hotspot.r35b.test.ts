import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r35–r37 B 热区票", () => {
  it("N-165 / N-166 冲刺关规则关闭与暂停继续，不回退 N-87/122", () => {
    const s = read("duo-rush/index.ts");
    expect(s).toMatch(/\.dr-rules-close \{[^}]*min-height: 44px/s);
    expect(s).toMatch(/\.dr-resume \{[^}]*min-height: 44px/s);
    expect(s).toMatch(/\.dr-menu-cta \{[^}]*position: sticky; top: 0/s);
    expect(s).toContain("@media (max-width: 430px) and (min-height: 700px)");
    expect(s).toContain(".dr-btns button { flex: 1; min-height: 46px;");
  });

  it("N-168 岔路口 .bvp-opt 44，不改 N-150 与 34 图标", () => {
    const s = read("brave-path/index.ts");
    expect(s).toMatch(/\.bvp-opt\{[^}]*min-height:44px/s);
    expect(s).toContain(".bvp-opt-em{font-size:27px;line-height:1;display:block;width:34px;height:34px");
    expect(s).toContain(".bvp-btn,.bvp-btn-sm,.bvp-act{min-height:44px;}");
    expect(s).toContain('touchUpliftCss([".bvp-btn"])');
  });

  it("N-169 泡泡选角 .pfb-pick 44，不改 veil / open / --k", () => {
    const s = read("puff-bros/index.ts");
    expect(s).toMatch(/\.pfb-pick\{[^}]*min-height:\$\{TOUCH_MIN\}px/s);
    expect(s).toMatch(/\.pfb-open\{[^}]*min-height:\$\{TOUCH_MIN\}px/);
    expect(s).toContain(".pfb-pads[data-pads=\"2\"]{--k:${TOUCH_MIN}px;");
  });

  it("N-171 钩子结算跳数行 44，不改 TALLY_MS 与飞画布", () => {
    const st = read("gold-hook/style.ts");
    expect(st).toMatch(/\.gdh-tally\{[^}]*min-height:\$\{TOUCH_MIN\}px/s);
    expect(st).toContain(".gdh-tally-fly{display:block;margin:0 auto;width:140px;height:44px;}");
    expect(read("gold-hook/depth12.ts")).toContain("export const TALLY_MS = 640;");
  });

  it("N-172 冒险王选章卡 44，不改走廊垫与网格列", () => {
    const s = read("adventure-king/index.ts");
    expect(s).toMatch(/\.ak-card\{[^}]*min-height:44px/s);
    expect(s).toContain(".ak-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}");
    expect(s).toContain("@media (min-width:560px){.ak-grid{grid-template-columns:repeat(4,1fr);}}");
    expect(s).toContain(".advk-pad2 button{border:none;border-radius:14px;min-height:52px;");
  });
});
