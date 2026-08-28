import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("N-13 / N-14 配方 F（7779 补 c14c）", () => {
  it("fruit-stack 舞台余量再减 HUD/提示/键排", () => {
    const src = read("./fruit-stack/index.ts");
    expect(src).toContain("stageH - chrome");
    expect(src).toContain("pad.offsetHeight");
  });

  it("bumper-cars 减摇杆排且暂停/回选关 44px", () => {
    const src = read("./bumper-cars/index.ts");
    expect(src).toContain("stageH - hudH - below");
    expect(src).toContain("pads.offsetHeight");
    expect(src).toContain("min-height:44px");
    expect(src).toContain("@media (max-height:500px) and (min-width:640px)");
  });
});

describe("C-8 / N-45 补帐", () => {
  it("duo-arena 开擂钮矮横屏 sticky", () => {
    expect(read("./duo-arena/index.ts")).toContain(".dua-start{position:sticky;bottom:0");
  });

  it("duo-rush 菜单开跑钮钉在屏内（N-87 先合版：CTA 行提顶 sticky），赛道 match 仍无布局串", () => {
    // r16 N-87(30cc10ab) 把「开跑随表单 sticky bottom」升级成「怎么玩/收藏册/开跑提顶并排 sticky top」，
    // 用户不变量一致：矮横屏菜单主按钮不滚就点得到。撞车取先合版，断言跟着主干走。
    const src = read("./duo-rush/index.ts");
    expect(src).toContain(".dr-menu-cta");
    expect(src).toContain("position: sticky; top: 0");
    expect(src).toContain(".dr-menu-cta .dr-softbtn, .dr-menu-cta .dr-start");
    expect(read("./duo-rush/match.ts")).not.toContain("dr-btns");
  });

  it("gold-hook 商店货架自滚、接着挖钉 footer（主干 N-45 = gdh-veil--shop）", () => {
    const style = read("./gold-hook/style.ts");
    const src = read("./gold-hook/index.ts");
    expect(style).toContain(".gdh-shopfoot");
    expect(style).toContain("position:sticky");
    expect(src).toContain("foot.append(purse, close)");
    expect(src).toContain("gdh-veil--shop");
  });

  it("puff 余量不够时不再用 VIEW_MIN 顶破六键", () => {
    expect(read("./puff-bros/index.ts")).toContain("const cap = room > 0 ? room : VIEW_MIN");
  });
});
