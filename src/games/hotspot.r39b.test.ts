import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r39–r41 B 热区票", () => {
  it("N-177 / N-178 教案与大厅模式卡 44，不改 pick/go/over/pad", () => {
    const s = read("duo-vs-star/index.ts");
    expect(s).toMatch(/\.dvs-lessonbtn\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.dvs-mode\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.dvs-pick\{[^}]*min-height:44px/s);
    expect(s).toContain(".dvs-over button{border:none;border-radius:16px;padding:11px 22px;font-size:15.5px;font-weight:900;color:#fff;");
    expect(s).toContain(".dvs-go{display:block;width:100%;margin-top:12px;border:none;border-radius:18px;padding:13px;font-size:17px;");
    expect(s).toContain(".dvs-pad button{min-width:42px;min-height:42px");
  });

  it("N-180 .sn-open 44，不改 N-147 back 与 toggle", () => {
    const s = read("snake-snack/index.ts");
    expect(s).toMatch(/\.sn-open \{[^}]*min-height: 44px/);
    expect(s).toMatch(/\.sn-back \{[^}]*min-height: 44px/);
    expect(s).toMatch(/\.snk-toggle \{[^}]*min-height: 44px/);
  });

  it("N-181 .dr-softbtn 基规则 44，不回退 N-87/122/165/166", () => {
    const s = read("duo-rush/index.ts");
    expect(s).toMatch(/\.dr-softbtn \{[^}]*min-height: 44px/s);
    expect(s).toMatch(/\.dr-menu-cta \{[^}]*position: sticky; top: 0/s);
    expect(s).toContain("@media (max-width: 430px) and (min-height: 700px)");
    expect(s).toMatch(/\.dr-rules-close \{[^}]*min-height: 44px/s);
    expect(s).toMatch(/\.dr-resume \{[^}]*min-height: 44px/s);
    expect(s).toContain(".dr-btns button { flex: 1; min-height: 46px;");
  });

  it("N-183 .pcp-act 已 44；不改 btn / veil / --k", () => {
    const s = read("prince-princess/index.ts");
    expect(s).toMatch(/\.pcp-act\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.pcp-btn\{[^}]*min-height:44px/);
    expect(s).toContain(".pcp-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;");
    expect(s).toContain(".pcp-pads[data-players=\"2\"]{--k:44px;}");
  });

  it("N-184 .hh-catch 已 44；不改牌堆", () => {
    const s = read("hue-hand/index.ts");
    expect(s).toMatch(/\.hh-catch\{[^}]*min-height:44px/s);
    expect(s).toContain(".hh-deck{position:relative;width:66px;height:96px;border:none;cursor:pointer;padding:0;font-family:inherit;background:none;}");
  });

  it("不回退 N-174/175；N-105 禁第四版", () => {
    const tug = read("red-blue-tug/index.ts");
    expect(tug).toMatch(/\.rbg-pick \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(tug).toMatch(/\.rbg-btn \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("mahjong-bloom/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
