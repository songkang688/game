import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * N-30(trio-r7):无尽古堡矮横屏 13 控件折叠线下的修复守门。
 * 病根:古堡壳把 head/hud/board/mini/say/tools/pad/album 全部纵向堆叠,
 * 915×412 一族矮横屏下 D-pad 与四个工具钮全在折叠线下(实测裁 348 / 8 可点控件线下)。
 * 修法(配方 G):竖屏保持原顺序;max-height:500px 档由 .advk-mid 切「左棋盘 / 右控件」双栏,
 * 房间格按可视余量钳宽(11×7 房间,高≈宽×7/11)。
 * 这里锁三件事:双栏结构还在、横屏钳宽还在、D-pad 热区没有跌破 44px。
 */

const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("adventure-king 无尽古堡矮横屏双栏(N-30)", () => {
  it("DOM:棋盘和小地图进左栏,说话行/工具钮/方向盘/陈列进右栏", () => {
    expect(SRC).toMatch(/left\.append\(board,\s*mini\)/);
    expect(SRC).toMatch(/side\.append\(say,\s*tools,\s*pad,\s*album\)/);
    expect(SRC).toMatch(/mid\.append\(left,\s*side\)/);
    expect(SRC).toMatch(/wrap\.append\(head,\s*hud,\s*mid\)/);
  });

  it("CSS:max-height:500px 档把 .advk-mid 切成横向双栏", () => {
    const media = SRC.match(/@media \(max-height:500px\)\{([\s\S]*?)\n\}/);
    expect(media, "缺 @media (max-height:500px) 档").toBeTruthy();
    const body = media![1];
    expect(body).toMatch(/\.advk-mid\{[^}]*flex-direction:row/);
    expect(body).toMatch(/\.advk-side\{[^}]*display:grid/);
  });

  it("CSS:矮横屏房间格按可视余量钳宽(clamp 上限仍是原 420px)", () => {
    expect(SRC).toMatch(/\.advk-room\{max-width:clamp\(220px,calc\(\(100dvh - 214px\)\*11\/7\),420px\);\}/);
  });

  it("CSS:矮横屏 D-pad 热区不跌破 44px", () => {
    expect(SRC).toMatch(/\.advk-side \.advk-pad2 button\{min-height:44px;\}/);
  });

  it("竖屏默认三个包装都是纵向 flex(原顺序逐像素不变)", () => {
    expect(SRC).toMatch(/\.advk-mid,\.advk-left,\.advk-side\{display:flex;flex-direction:column;gap:8px;min-width:0;\}/);
  });
});
