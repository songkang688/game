/**
 * 朵星地产 · 1.3 整帧视觉契约（对照 docs/plan-1.3-step3-C-star-estate.md 第七节）。
 *
 * 用本目录的 domStub 把整张牌桌挂起来，假定时器推进动画，逐条钉住：
 * 1) 棋子不再是纯文本 emoji：token 内含 SVG 且 aria-label 含玩家名；
 * 2) 骰子掷出后显示点数与 dice 状态一致；
 * 3) houses=3 渲染 3 个房子、满级渲染酒店；
 * 4) 金币飞行节点在动画结束后被清理（无泄漏）；
 * 5) prefers-reduced-motion 下不加跳格动画类；
 * 6) 破产是「鞠躬收摊」仪式 + 席位卡印章，不是瞬间 opacity 0。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { KIT_PALETTE } from "../../art/kit";
import { byClass, install, walk, type FakeEl, type Harness } from "./domStub";
import { COIN_MS, DICE_ROLL_MS, HOP_MS, createTable, type TableOpts } from "./index";

/** 两个人类座位（谁都不自动跑），规则关掉卡片和拍卖，走位全靠 scriptedDice */
function mount(
  harness: Harness,
  scriptedDice: Array<[number, number]>,
  preset?: TableOpts["preset"]
): ReturnType<typeof createTable> {
  return createTable(harness.root as unknown as HTMLElement, {
    seats: [
      { name: "朵朵", emoji: "🌸", human: "duo", tier: "pro" },
      { name: "星星", emoji: "⭐", human: "star", tier: "pro" }
    ],
    rules: { build: true, cards: false, jail: true, mortgage: true, auction: false, fullSetDouble: true, maxRounds: 99 },
    seed: 7,
    preset,
    scriptedDice,
    goalText: "测试桌",
    sfx: () => {},
    onOver: () => {}
  });
}

function rollBtn(root: FakeEl): FakeEl {
  const btn = byClass(root, "se-btn-go")[0];
  if (!btn) throw new Error("没找到掷骰按钮");
  return btn;
}

let cleanup: Array<() => void> = [];

afterEach(() => {
  for (const fn of cleanup.reverse()) fn();
  cleanup = [];
  vi.useRealTimers();
});

function setup(opts: { reduced?: boolean } = {}): Harness {
  vi.useFakeTimers();
  const h = install(opts);
  cleanup.push(() => h.restore());
  return h;
}

describe("视觉契约 1 · 棋子立牌", () => {
  it("token 元素内含 SVG 子节点，aria-label 带玩家名和 emoji", () => {
    const h = setup();
    const table = mount(h, []);
    cleanup.push(() => table.destroy());
    const tokens = byClass(h.root, "se-token");
    expect(tokens.length).toBe(2);
    expect(tokens[0].innerHTML).toContain("<svg");
    expect(tokens[0].innerHTML).toContain("se-token-b");
    expect(tokens[0].getAttribute("aria-label")).toContain("朵朵");
    expect(tokens[0].getAttribute("aria-label")).toContain("🌸");
    expect(tokens[1].getAttribute("aria-label")).toContain("星星");
    // 形状差：朵朵是花、星星是星
    expect(tokens[0].innerHTML).toContain("se-token-flower");
    expect(tokens[1].innerHTML).toContain("se-token-star");
  });
});

describe("视觉契约 2 · 骰子", () => {
  it("掷出后 data-d1/d2 与 dice 状态一致，结果面点数对得上", () => {
    const h = setup();
    const table = mount(h, [[2, 4]]);
    cleanup.push(() => table.destroy());
    rollBtn(h.root).fire("click");
    vi.advanceTimersByTime(DICE_ROLL_MS + 300);
    const dice = byClass(h.root, "se-dice")[0];
    expect(dice.getAttribute("data-d1")).toBe("2");
    expect(dice.getAttribute("data-d2")).toBe("4");
    expect(dice.innerHTML).toContain('data-pips="2"');
    expect(dice.innerHTML).toContain('data-pips="4"');
    expect(table.state().players[0].pos).toBe(6);
  });

  it("双骰同点：结果面带金描边", () => {
    const h = setup();
    const table = mount(h, [[3, 3]]);
    cleanup.push(() => table.destroy());
    rollBtn(h.root).fire("click");
    vi.advanceTimersByTime(DICE_ROLL_MS + 300);
    const dice = byClass(h.root, "se-dice")[0];
    expect(dice.getAttribute("data-d1")).toBe("3");
    expect(dice.innerHTML).toContain(`stroke="${KIT_PALETTE.starGold}"`);
  });
});

describe("视觉契约 3 · 房屋", () => {
  it("houses=3 渲染 3 个小房子，满级渲染酒店节点", () => {
    const h = setup();
    const table = mount(h, [], [
      { tile: 1, owner: 0, houses: 3 },
      { tile: 3, owner: 0, houses: 5 }
    ]);
    cleanup.push(() => table.destroy());
    const tiles = byClass(h.root, "se-tile");
    expect(tiles.length).toBe(40);
    expect(tiles[1].innerHTML.split('class="se-house"').length - 1).toBe(3);
    expect(tiles[1].innerHTML).not.toContain("se-hotel");
    expect(tiles[3].innerHTML).toContain('class="se-hotel"');
    expect(tiles[3].getAttribute("aria-label")).toContain("大屋");
    // 拥有者小旗也在
    expect(tiles[1].innerHTML).toContain("se-flag");
  });
});

describe("视觉契约 4 · 金币飞行", () => {
  it("付租金时飞 3–5 枚渐变金币，动画结束后节点全部清理", () => {
    const h = setup();
    // 6 号格归星星，朵朵掷 2+4 落上去付过路费
    const table = mount(h, [[2, 4]], [{ tile: 6, owner: 1 }]);
    cleanup.push(() => table.destroy());
    rollBtn(h.root).fire("click");
    // 跳 6 格 + 落格停顿 + 错峰起飞窗口
    vi.advanceTimersByTime(HOP_MS * 7 + 170 + 320);
    const flying = byClass(h.root, "se-coin");
    expect(flying.length).toBeGreaterThanOrEqual(3);
    expect(flying.length).toBeLessThanOrEqual(5);
    expect(flying[0].innerHTML).toContain("Gradient"); // 金币含渐变（不是纯色圆）
    expect(flying[0].innerHTML).toContain("se-coin-arc"); // 抛物线内层
    vi.advanceTimersByTime(COIN_MS + 5 * 70 + 600);
    expect(byClass(h.root, "se-coin").length).toBe(0);
    expect(table.state().players[0].cash).toBeLessThan(1500);
  });
});

describe("视觉契约 5 · reduced-motion 降级", () => {
  it("prefers-reduced-motion 下不加跳格类、不喷金币，骰子直接给结果面", () => {
    const h = setup({ reduced: true });
    const table = mount(h, [[2, 4]], [{ tile: 6, owner: 1 }]);
    cleanup.push(() => table.destroy());
    rollBtn(h.root).fire("click");
    const token = byClass(h.root, "se-token")[0];
    expect(token.classList.contains("se-hop")).toBe(false);
    vi.advanceTimersByTime(50);
    expect(token.classList.contains("se-hop")).toBe(false);
    // 骰子无翻面动画，立即是结果面
    const dice = byClass(h.root, "se-dice")[0];
    expect(dice.classList.contains("se-dice-roll")).toBe(false);
    expect(dice.innerHTML).toContain('data-pips="2"');
    vi.advanceTimersByTime(3000);
    expect(token.classList.contains("se-hop")).toBe(false);
    expect(byClass(h.root, "se-coin").length).toBe(0);
  });

  it("正常动效下跳格进行中带 se-hop 类，跳完就摘掉", () => {
    const h = setup();
    const table = mount(h, [[2, 4]]);
    cleanup.push(() => table.destroy());
    rollBtn(h.root).fire("click");
    const token = byClass(h.root, "se-token")[0];
    vi.advanceTimersByTime(HOP_MS * 2);
    expect(token.classList.contains("se-hop")).toBe(true);
    vi.advanceTimersByTime(HOP_MS * 10);
    expect(token.classList.contains("se-hop")).toBe(false);
  });
});

describe("视觉契约 6 · 破产收摊仪式", () => {
  it("破产先鞠躬 0.6s 再变灰淡出，席位卡盖「已收摊」印章", () => {
    const h = setup();
    const table = mount(h, []);
    cleanup.push(() => table.destroy());
    const stamps = byClass(h.root, "se-stamp");
    expect(stamps.length).toBe(2);
    expect(stamps[1].hidden).toBe(true);
    // 星星收摊
    table.state().players[1].bankrupt = true;
    byClass(h.root, "se-tile")[0].fire("click"); // 任意点击触发重绘
    const token = byClass(h.root, "se-token")[1];
    expect(token.classList.contains("se-token-bow")).toBe(true);
    expect(token.classList.contains("se-token-out")).toBe(false); // 不是瞬间消失
    vi.advanceTimersByTime(700);
    expect(token.classList.contains("se-token-out")).toBe(true);
    expect(stamps[1].hidden).toBe(false);
    expect(stamps[1].innerHTML).toContain("已收摊");
    const cash = byClass(h.root, "se-seat-cash")[1];
    expect(cash.textContent).toContain("已收摊");
  });
});

describe("视觉契约 7 · 中心广场与消息气泡", () => {
  it("中心有星城广场装饰层，log 是气泡消息条", () => {
    const h = setup();
    const table = mount(h, []);
    cleanup.push(() => table.destroy());
    const plaza = byClass(h.root, "se-plaza")[0];
    expect(plaza.innerHTML).toContain("<svg");
    expect(plaza.getAttribute("aria-hidden")).toBe("true");
    const logEl = byClass(h.root, "se-log")[0];
    expect(logEl.innerHTML).toContain("se-log-line"); // 开局播报进了气泡条
  });

  it("盖房：拥有整组后建屋，出现落下动画类与尘土，尘土会清理", () => {
    const h = setup();
    // 朵朵拥有棉花巷整组（1、3），选中 1 号格直接盖
    const table = mount(h, [], [
      { tile: 1, owner: 0, houses: 0 },
      { tile: 3, owner: 0, houses: 0 }
    ]);
    cleanup.push(() => table.destroy());
    // 选中 1 号格
    byClass(h.root, "se-tile")[1].fire("click");
    // 「购买 / 建屋」按钮此时是建屋
    const buyBtn = byClass(h.root, "se-btn").find((b) => !b.classList.contains("se-btn-go") && b.textContent.includes("建屋"));
    expect(buyBtn, "建屋按钮没亮").toBeTruthy();
    (buyBtn as FakeEl).fire("click");
    expect(table.state().tiles[1].houses).toBe(1);
    const tiles = byClass(h.root, "se-tile");
    expect(tiles[1].innerHTML).toContain("se-drop");
    expect(byClass(h.root, "se-dust").length).toBe(2);
    vi.advanceTimersByTime(600);
    expect(byClass(h.root, "se-dust").length).toBe(0);
    // 再次重绘后落下动画类不再残留（不会每帧重播）
    byClass(h.root, "se-tile")[0].fire("click");
    let dropLeft = 0;
    walk(h.root, (el) => {
      if (el.innerHTML.includes("se-drop")) dropLeft++;
    });
    expect(dropLeft).toBe(0);
  });
});
