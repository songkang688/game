/**
 * r5 N-2/N-3/N-4 回合必点钮组的守门(配方 E):
 * flight-chess / star-estate / hero-cards 都是「回合制,每回合必点一颗钮」,
 * 三档视口(390×844 / 1024×768 / 915×412)进关不滚就要看见并点到它。
 *
 * 修法三件套,断言钉住别悄悄退回:
 * 1. 操作排合抱 sticky 容器(对战/无尽模式舞台可滚时贴底常驻;
 *    闯关壳 .l99-stage overflow:hidden 粘不住,那边靠 2/3 兜底);
 * 2. 盘面/弹性区按舞台可视余量钳(fitBoard / fitZones + resize 重量);
 * 3. 矮横屏媒体查询改双栏或收紧,一屏装下。
 * 另钉 flight-chess 的病根:骰面 SVG 没有 width/height 属性,
 * .fc-dice 若退回 min-width,76% 会循环解析回 300×150 固有值把盒子撑成海报大。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GAMES_DIR = join(__dirname, "..");

function srcOf(game: string): string {
  return readFileSync(join(GAMES_DIR, game, "index.ts"), "utf8");
}

const SHORT_LAND_MQ = /@media \(min-width:700px\) and \(max-height:520px\)\{([\s\S]*?)\n\}/;

describe("N-2 flight-chess:掷骰子进首屏", () => {
  const src = srcOf("flight-chess");

  it("骰面盒宽高定死,不给 76% 循环解析的机会", () => {
    const rule = /\.fc-dice\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(rule).toContain("width:56px");
    expect(rule).toContain("height:56px");
    expect(rule).not.toContain("min-width");
  });

  it("掷骰+选棋合抱 sticky 操作条", () => {
    const rule = /\.fc-actions\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(rule).toContain("position:sticky");
    expect(src).toContain('actions.className = "fc-actions"');
  });

  it("盘面按舞台余量钳宽(fitBoard + resize 重量 + destroy 摘监听)", () => {
    expect(src).toContain("function fitBoard");
    expect(src).toContain("stageClipBottom(wrap)");
    expect(src).toContain('window.addEventListener("resize", fitBoard)');
    expect(src).toContain('window.removeEventListener("resize", fitBoard)');
  });

  it("矮横屏走盘左控件右双栏", () => {
    const mq = SHORT_LAND_MQ.exec(src)?.[1] ?? "";
    expect(mq).toContain(".fc-wrap{display:grid");
    expect(mq).toContain(".fc-boardwrap{grid-column:1");
  });
});

describe("N-3 star-estate:结束回合进首屏", () => {
  const src = srcOf("star-estate");

  it("常规排+竞拍排合抱 sticky 操作条", () => {
    const rule = /\.se-actions\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(rule).toContain("position:sticky");
    expect(src).toContain('actions.className = "se-actions"');
  });

  it("盘面按舞台余量钳宽(fitBoard + resize 重量 + destroy 摘监听)", () => {
    expect(src).toContain("function fitBoard");
    expect(src).toContain('window.addEventListener("resize", fitBoard)');
    expect(src).toContain('window.removeEventListener("resize", fitBoard)');
  });

  it("矮横屏走盘左控件右双栏,房契抽屉限高内滚", () => {
    const mq = SHORT_LAND_MQ.exec(src)?.[1] ?? "";
    expect(mq).toContain(".se-wrap{display:grid");
    expect(mq).toContain("overflow-y:auto");
  });

  it("≤480px 三颗按钮收窄,结束回合不折到第二行", () => {
    const mq = /@media \(max-width:480px\)\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? "";
    expect(mq).toContain(".se-btn{min-width:80px");
  });
});

describe("N-4 hero-cards:手牌首排+确定/结束回合进首屏", () => {
  const src = srcOf("hero-cards");

  it("fitZones 按「战报→战况区→手牌区」顺序钳高,区内滚动", () => {
    expect(src).toContain("function fitZones");
    expect(src).toContain("FIT_FLOORS");
    const order = /const zones[\s\S]*?\[logEl,[\s\S]*?\[seatRow,[\s\S]*?\[handEl,/.test(src);
    expect(order, "钳的顺序应是战报最先、手牌最后").toBe(true);
    expect(src).toContain('window.addEventListener("resize", fitZones)');
    expect(src).toContain('window.removeEventListener("resize", fitZones)');
  });

  it("手牌区兜底下限装得下一整排可点的牌(≥ 卡高 84 + 内衬)", () => {
    const m = /hand:\s*(\d+)/.exec(src);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(84 + 14);
  });

  it("手牌换行铺排零回归(PR50 钉的 flex-wrap 还在)", () => {
    const rule = /\.hc-hand\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(rule).toContain("flex-wrap:wrap");
  });

  it("矮横屏与 ≤480px 各有一档压缩媒体查询", () => {
    expect(SHORT_LAND_MQ.test(src)).toBe(true);
    expect(/@media \(max-width:480px\)\{/.test(src)).toBe(true);
  });
});
