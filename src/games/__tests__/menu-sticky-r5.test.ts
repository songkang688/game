/**
 * r4 走查 C-8 菜单组的守门(r5 收尾):
 * duo-rush / duo-arena 菜单比矮横屏高,舞台能滚属可容忍,
 * 但「准备好,开跑 ▶」「开擂 ▶」主按钮不该要人先滚——CSS 里必须钉着 sticky。
 * brave-path 菜单没有单一主钮,四个模式钮就是主操作,
 * 矮横屏媒体查询把卡片和模式钮各收一号,四个钮都得进首屏。
 * 纯静态断言:改样式时把这几条一起改,别悄悄退回「要滚才够得着」。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GAMES_DIR = join(__dirname, "..");

function srcOf(game: string): string {
  return readFileSync(join(GAMES_DIR, game, "index.ts"), "utf8");
}

describe("菜单主按钮 sticky 置底(r4 C-8 菜单组)", () => {
  it("duo-rush:.dr-setup .dr-start 钉着 sticky,不用滚就点得到开跑", () => {
    const src = srcOf("duo-rush");
    const rule = /\.dr-setup \.dr-start\s*\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(rule, "开跑钮的 sticky 规则丢了").toContain("position: sticky");
    expect(rule).toContain("bottom");
  });

  it("duo-arena:.dua-setup .dua-start 钉着 sticky,不用滚就点得到开擂", () => {
    const src = srcOf("duo-arena");
    const rule = /\.dua-setup \.dua-start\s*\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(rule, "开擂钮的 sticky 规则丢了").toContain("position:sticky");
    expect(rule).toContain("bottom");
  });

  it("brave-path:矮横屏媒体查询收紧卡片与模式钮,四个模式钮进首屏", () => {
    const src = srcOf("brave-path");
    const mq = /@media\(min-width:700px\) and \(max-height:520px\)\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? "";
    expect(mq, "矮横屏压缩媒体查询丢了").not.toBe("");
    for (const sel of [".bvp-card", ".bvp-mode", ".bvp-mode-em", ".bvp-sub"]) {
      expect(mq, `${sel} 不在矮横屏压缩名单里`).toContain(sel);
    }
    // 英雄行的间距要归 CSS 管(内联样式媒体查询盖不掉)
    expect(src).not.toContain('line.style.marginTop = "10px"');
    expect(src).toContain("margin-top:10px");
  });
});
