/**
 * 花色接龙 · 1.3 视觉契约(规格第七节)。
 *
 * 这一份只管「画得对不对」,玩法一行不碰:
 *  1. 功能牌卡面是 SVG 图标(五种互不相同),不再是文字缩写;
 *  2. 牌背统一成花背卡:牌堆三张微错位 + 数量徽章,对手手牌条同款,全场不再有字符占位;
 *  3. 万能牌卡底四色齐全(conic-gradient 花瓣转盘);
 *  4. 出牌/摸牌飞行替身到点自己收走;reduceMotion 一个替身都不造,直接落位;
 *  5. aria-label(cardLabel、牌堆、台面)一字不变,scrollIntoView 光标跟随保留。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { COLORS, COLOR_HEX, buildDeck, cardLabel, type Card, type CardKind, type Color } from "./deck";
import { COLOR_SHAPES, actionIconSVG, cardBackSVG, colorShapeSVG, lighten } from "./art";
import {
  CATCH_DELAY_MS,
  createTable,
  mount,
  paintCard,
  resultRanksHTML,
  spinOf,
  type SeatCfg,
  type TableDone,
} from "./index";
import { El, advance, fireWindow, installDom, restoreDom, type Dom } from "./domStub";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

function fakeApi(root: El): GameApi {
  return {
    root: root as unknown as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  } as unknown as GameApi;
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function handCards(): El[] {
  const hand = dom.root.querySelector(".hh-hand");
  return hand ? hand.children.filter((c) => c.className.includes("hh-card")) : [];
}

function styleText(): string {
  const style = dom.root.find((e) => e.tagName === "style");
  return style?.textContent ?? "";
}

function flyCount(): number {
  return dom.root.querySelectorAll(".hh-fly").length;
}

/** 从整副牌里挑一张,拿到的是副本,id 天然不重复 */
function pick(pool: Card[], match: (c: Card) => boolean): Card {
  const i = pool.findIndex(match);
  if (i < 0) throw new Error("牌堆里挑不到这张牌");
  return pool.splice(i, 1)[0];
}

const num = (color: Color, n: number) => (c: Card) => c.kind === "num" && c.color === color && c.num === n;
const ofKind = (k: CardKind) => (c: Card) => c.kind === k;

const HUMAN: SeatCfg = { kind: "human", name: "朵朵", avatar: "🌸", isImg: false, tier: "expert", keys: 0 };
const BOT: SeatCfg = { kind: "ai", name: "团团", avatar: "🐰", isImg: false, tier: "rookie", keys: 0 };

/** 两人桌:朵朵两张粉牌都接得上台面的粉 5,机器人两张蓝牌。末尾先被 pop,倒着排 */
function playableDeck(): Card[] {
  const pool = buildDeck();
  const mine = [pick(pool, num("pink", 1)), pick(pool, num("pink", 2))];
  const foe = [pick(pool, num("sky", 3)), pick(pool, num("sky", 4))];
  const top = pick(pool, num("pink", 5));
  const rest = [pick(pool, num("lemon", 6)), pick(pool, num("lemon", 7))];
  return [...rest, top, foe[1], mine[1], foe[0], mine[0]];
}

/** 朵朵手上一张万能 + 一张粉 2:点万能弹色环,挑绿就变色 */
function wildDeck(): Card[] {
  const pool = buildDeck();
  const mine = [pick(pool, ofKind("wild")), pick(pool, num("pink", 2))];
  const foe = [pick(pool, num("sky", 3)), pick(pool, num("sky", 4))];
  const top = pick(pool, num("pink", 5));
  const rest = [pick(pool, num("lemon", 6)), pick(pool, num("lemon", 7))];
  return [...rest, top, foe[1], mine[1], foe[0], mine[0]];
}

/** 朵朵两张绿牌接不上,摸到的柠檬 6 也接不上;机器人打掉一张粉牌就剩一张又不会喊 */
function catchDeck(): Card[] {
  const pool = buildDeck();
  const mine = [pick(pool, num("mint", 1)), pick(pool, num("mint", 2))];
  const foe = [pick(pool, num("pink", 3)), pick(pool, num("pink", 4))];
  const top = pick(pool, num("pink", 5));
  const firstDraw = pick(pool, num("lemon", 6));
  const rest = [pick(pool, num("lemon", 7)), pick(pool, num("lemon", 8))];
  return [...rest, firstDraw, top, foe[1], mine[1], foe[0], mine[0]];
}

function makeTable(deck: Card[]): { destroy: () => void } {
  return createTable(dom.root as unknown as HTMLElement, {
    cfg: { players: 2, tiers: ["rookie"], kinds: ["num"], handSize: 2, seed: 4242, hint: "视觉" },
    deck,
    seats: [HUMAN, BOT],
    banner: "视觉",
    sfx: () => undefined,
    onDone: () => undefined,
  });
}

// ---------------------------------------------------------------------------
// 纯函数资产
// ---------------------------------------------------------------------------

describe("功能牌图标(纯 SVG)", () => {
  const KINDS: CardKind[] = ["skip", "reverse", "draw2", "wild", "wild4"];

  it("五种功能牌图标都是 SVG,而且互不相同", () => {
    const icons = KINDS.map((k) => actionIconSVG(k, "#F58FBB", 28));
    for (const [i, svg] of icons.entries()) {
      expect(svg, `${KINDS[i]} 不是 SVG`).toContain("<svg");
      expect(svg).toContain(`hh-icon-${KINDS[i]}`);
    }
    expect(new Set(icons).size).toBe(KINDS.length);
    expect(actionIconSVG("num", "#F58FBB", 28)).toBe("");
  });

  it("跳过是圆圈斜线,反转是双弯箭头,加二是两张小叠卡", () => {
    const skip = actionIconSVG("skip", "#54B584", 28);
    expect(skip).toContain("<circle");
    expect(skip).toContain("<line");
    const rev = actionIconSVG("reverse", "#54B584", 28);
    expect(rev.match(/<path /g)?.length).toBe(2);
    expect(rev.match(/<polygon /g)?.length).toBe(2);
    const d2 = actionIconSVG("draw2", "#54B584", 28);
    expect(d2.match(/<rect /g)?.length).toBe(2);
    expect(d2).toContain(">+2<");
  });

  it("万能是四色花瓣扇,加四同一朵花再带「+4」", () => {
    const wild = actionIconSVG("wild", "#000", 28);
    expect(wild.match(/hh-petal/g)?.length).toBe(4);
    for (const hex of Object.values(COLOR_HEX)) expect(wild).toContain(hex);
    const w4 = actionIconSVG("wild4", "#000", 28);
    expect(w4.match(/hh-petal/g)?.length).toBe(4);
    expect(w4).toContain(">+4<");
  });
});

describe("花背卡与四色符号(纯 SVG)", () => {
  it("花背卡:深紫渐变底 + 细白双框 + 中心四色小花", () => {
    const back = cardBackSVG();
    expect(back).toContain("hh-backsvg");
    expect(back).toContain("#5b4399");
    expect(back.match(/stroke="#fff"/g)?.length).toBe(2);
    expect(back.match(/hh-petal/g)?.length).toBe(4);
    for (const hex of Object.values(COLOR_HEX)) expect(back).toContain(hex);
  });

  it("四色符号第二通道:圆/方/三角/星一一对应,互不相同", () => {
    expect(new Set(Object.values(COLOR_SHAPES)).size).toBe(4);
    const svgs = COLORS.map((c) => colorShapeSVG(c, 10));
    expect(new Set(svgs).size).toBe(4);
    for (const c of COLORS) {
      expect(colorShapeSVG(c, 10)).toContain(`hh-shape-${COLOR_SHAPES[c]}`);
      expect(colorShapeSVG(c, 10)).toContain(COLOR_HEX[c]);
      expect(colorShapeSVG(c, 10, "#fff")).toContain('"#fff"');
    }
  });

  it("lighten 输出合法 #rrggbb,而且真的更亮", () => {
    const out = lighten("#F58FBB", 0.12);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    const sum = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(sum(out)).toBeGreaterThan(sum("#f58fbb"));
    expect(lighten("#000000", 1)).toBe("#ffffff");
  });
});

// ---------------------------------------------------------------------------
// paintCard 四层
// ---------------------------------------------------------------------------

describe("卡面四层印刷质感", () => {
  function paint(card: Card): El {
    const el = new El("button");
    paintCard(el as unknown as HTMLElement, card, 60, 87);
    return el;
  }

  it("数字牌:对角渐变卡底 + 白内框 + 白椭圆 + 大数字 + 底部花色点缀", () => {
    const el = paint({ id: 1, kind: "num", color: "pink", num: 7 });
    expect(String(el.style.background)).toContain("linear-gradient(135deg");
    expect(String(el.style.background)).toContain(COLOR_HEX.pink);
    expect(el.querySelector(".hh-card-frame")).toBeTruthy();
    expect(el.querySelector(".hh-card-oval")).toBeTruthy();
    expect(el.querySelector(".hh-card-face")?.textContent).toBe("7");
    expect(el.querySelector(".hh-card-mark")?.querySelector("svg")).toBeTruthy();
    expect(styleTextOf(el)).toBe("");
  });

  /** paintCard 只画节点,不带 style 标签(样式都在共享 CSS 里) */
  function styleTextOf(el: El): string {
    return el.find((e) => e.tagName === "style")?.textContent ?? "";
  }

  it("功能牌中央是 SVG 图标,不再是文字缩写", () => {
    for (const kind of ["skip", "reverse", "draw2"] as CardKind[]) {
      const el = paint({ id: 2, kind, color: "mint", num: null });
      const icon = el.querySelector(".hh-card-icon");
      expect(icon?.querySelector(`.hh-icon-${kind}`), `${kind} 缺图标`).toBeTruthy();
      expect(el.querySelector(".hh-card-face")).toBeNull();
    }
  });

  it("角标带四色小符号,从卡面到形状一一对应(色弱第二通道)", () => {
    for (const color of COLORS) {
      const el = paint({ id: 3, kind: "num", color, num: 5 });
      const corner = el.querySelector(".hh-card-corner");
      expect(corner?.querySelector(`.hh-shape-${COLOR_SHAPES[color]}`), `${color} 角标缺符号`).toBeTruthy();
      const corner2 = el.querySelector(".hh-card-corner2");
      expect(corner2?.querySelector(`.hh-shape-${COLOR_SHAPES[color]}`)).toBeTruthy();
      expect(corner?.textContent).toContain("5");
    }
  });

  it("万能牌吃 hh-card-wild 四色卡底,加四卡面带「+4」;重画回有色牌会把类摘干净", () => {
    const el = paint({ id: 4, kind: "wild4", color: null, num: null });
    expect(el.className).toContain("hh-card-wild");
    expect(String(el.style.background)).toBe("");
    expect(el.textContent).toContain("+4");
    expect(el.querySelector(".hh-icon-wild4")).toBeTruthy();
    paintCard(el as unknown as HTMLElement, { id: 5, kind: "num", color: "sky", num: 3 }, 60, 87);
    expect(el.className).not.toContain("hh-card-wild");
  });

  it("落定微旋转按牌的 id 定死,±5° 之内", () => {
    for (const card of buildDeck()) {
      const deg = spinOf(card);
      expect(deg).toBeGreaterThanOrEqual(-5);
      expect(deg).toBeLessThanOrEqual(5);
      expect(deg).toBe(spinOf(card));
    }
  });
});

// ---------------------------------------------------------------------------
// 上桌:牌背、桌面、CSS 契约
// ---------------------------------------------------------------------------

describe("花背牌堆与对手手牌条", () => {
  it("牌堆是三张微错位的花背 + 数量徽章,全场不再有 🂠 字符", () => {
    const handle = mount(fakeApi(dom.root));
    byText("对战")?.click();
    byText("开打")?.click();
    const deck = dom.root.querySelector(".hh-deck");
    expect(deck?.querySelectorAll(".hh-backsvg").length).toBe(3);
    expect(deck?.querySelector(".hh-deck-count")?.textContent).toContain("张");
    expect(deck?.getAttribute("aria-label")).toMatch(/^牌堆还有 \d+ 张,点一下摸牌$/);
    expect(dom.root.textContent).not.toContain("🂠");
    handle.destroy();
  });

  it("对手手牌条与牌堆是同款花背;CSS 里有 −20° 椭圆和四色转盘", () => {
    const handle = mount(fakeApi(dom.root));
    byText("对战")?.click();
    byText("开打")?.click();
    const foeBack = dom.root.querySelector(".hh-back-c")?.querySelector(".hh-backsvg");
    const deckBack = dom.root.querySelector(".hh-deck")?.querySelector(".hh-backsvg");
    expect(foeBack).toBeTruthy();
    expect(foeBack?.getAttribute("viewBox")).toBe(deckBack?.getAttribute("viewBox"));
    const css = styleText();
    expect(css).toContain("rotate(-20deg)");
    expect(css).toMatch(/\.hh-card-wild\{background:conic-gradient/);
    for (const hex of Object.values(COLOR_HEX)) expect(css).toContain(hex);
    handle.destroy();
  });

  it("弃牌堆垫牌只在出过牌后出现,顶牌读法一字不变", () => {
    const table = makeTable(playableDeck());
    expect(dom.root.querySelectorAll(".hh-heap-c").length).toBe(0);
    expect(dom.root.querySelector(".hh-top")?.getAttribute("aria-label")).toBe("台面上是粉色 5");
    handCards()[0].click();
    expect(dom.root.querySelectorAll(".hh-heap-c").length).toBe(1);
    expect(String(dom.root.querySelector(".hh-heap-c")?.style.transform)).toContain("rotate(-6deg)");
    expect(dom.root.querySelector(".hh-top")?.getAttribute("aria-label")).toBe("台面上是粉色 1");
    table.destroy();
  });
});

// ---------------------------------------------------------------------------
// 飞行动画与变色仪式
// ---------------------------------------------------------------------------

describe("出牌/摸牌飞行", () => {
  it("出牌立刻有飞行替身,到点自己收走", () => {
    const table = makeTable(playableDeck());
    handCards()[0].click();
    expect(flyCount()).toBe(1);
    expect(dom.root.querySelector(".hh-fly")?.querySelector(".hh-fly-arc")).toBeTruthy();
    advance(dom, 500);
    expect(flyCount()).toBe(0);
    table.destroy();
  });

  it("摸牌从牌堆飞进手里,替身同样收走", () => {
    const table = makeTable(catchDeck());
    fireWindow(dom, "keydown", { key: "g" });
    advance(dom, 20);
    expect(flyCount()).toBe(1);
    advance(dom, 420);
    expect(flyCount()).toBe(0);
    table.destroy();
  });

  it("reduceMotion:出牌/摸牌一个替身都不造,牌桌直接落位", () => {
    restoreDom();
    dom = installDom(360, true);
    const table = makeTable(playableDeck());
    handCards()[0].click();
    expect(flyCount()).toBe(0);
    expect(dom.root.querySelector(".hh-top")?.getAttribute("aria-label")).toBe("台面上是粉色 1");
    fireWindow(dom, "keydown", { key: "g" });
    advance(dom, 30);
    expect(flyCount()).toBe(0);
    table.destroy();
  });

  it("变色仪式:万能牌选色后色条荡一圈波纹,到点收走;reduceMotion 直接切", () => {
    const table = makeTable(wildDeck());
    expect(dom.root.querySelector(".hh-colorbar-dot")?.querySelector("svg")).toBeTruthy();
    handCards()[0].click();
    const swatches = dom.root.querySelectorAll(".hh-swatch");
    expect(swatches.length).toBe(4);
    expect(swatches[2].querySelector("svg")).toBeTruthy();
    swatches[2].click(); // 挑绿色,和台面的粉色不一样
    expect(dom.root.querySelector(".hh-colorwave")).toBeTruthy();
    advance(dom, 500);
    expect(dom.root.querySelector(".hh-colorwave")).toBeNull();
    table.destroy();

    restoreDom();
    dom = installDom(360, true);
    const quiet = makeTable(wildDeck());
    handCards()[0].click();
    dom.root.querySelectorAll(".hh-swatch")[2].click();
    expect(dom.root.querySelector(".hh-colorwave")).toBeNull();
    quiet.destroy();
  });

  it("点破成功:对手盒子抖一下,罚牌花背连着飞过去", () => {
    const table = makeTable(catchDeck());
    fireWindow(dom, "keydown", { key: "g" }); // 摸到接不上的,换机器人
    advance(dom, 1400); // 机器人出掉一张粉牌只剩一张又不会喊,它自己的出牌替身也已收走
    const catchBtn = byText("点破他");
    expect(flyCount()).toBe(0);
    expect(catchBtn).toBeTruthy();
    catchBtn?.click();
    expect(dom.root.querySelector(".hh-foe-p1")?.className).toContain("hh-shake");
    advance(dom, 70);
    expect(flyCount()).toBe(2);
    expect(dom.root.querySelector(".hh-fly")?.querySelector(".hh-backsvg")).toBeTruthy();
    advance(dom, 600);
    expect(flyCount()).toBe(0);
    expect(dom.root.querySelector(".hh-foe-p1")?.className).not.toContain("hh-shake");
    table.destroy();
  });

  it("忘喊被 AI 点破的罚抽,窗口时长一毫秒没动", () => {
    expect(CATCH_DELAY_MS).toBe(1800);
  });
});

// ---------------------------------------------------------------------------
// 结算名次
// ---------------------------------------------------------------------------

describe("结算名次列表", () => {
  const seat = (name: string, kind: "human" | "ai"): SeatCfg => ({
    kind,
    name,
    avatar: kind === "human" ? "🌸" : "🐰",
    isImg: false,
    tier: "normal",
    keys: 0,
  });

  function fakeDone(winner: number, handSizes: number[], scores: number[]): TableDone {
    const cardPool = buildDeck();
    return {
      state: {
        players: handSizes.map((n) => ({ hand: cardPool.slice(0, n) })),
      },
      winner,
      gained: 0,
      scores,
      actions: handSizes.map(() => 1),
    } as unknown as TableDone;
  }

  it("胜者排头带卡扇与彩带,其他人是头像 + 剩牌小图 + 分数", () => {
    const seats = [seat("朵朵", "human"), seat("团团", "ai"), seat("圆圆", "ai")];
    const html = resultRanksHTML(seats, fakeDone(0, [0, 2, 4], [0, 9, 20]));
    const box = new El("div");
    box.innerHTML = html;
    const ranks = box.querySelectorAll(".hh-rank");
    expect(ranks.length).toBe(3);
    expect(ranks[0].className).toContain("hh-rank-win");
    expect(ranks[0].textContent).toContain("朵朵");
    expect(ranks[0].textContent).toContain("先出完");
    expect(ranks[0].querySelectorAll(".hh-fan-c").length).toBe(5);
    expect(box.querySelectorAll(".hh-confetti-p").length).toBe(12);
    expect(ranks[1].textContent).toContain("剩 2 张 · 9 分");
    expect(ranks[1].querySelectorAll(".hh-mini").length).toBe(2);
    expect(ranks[2].textContent).toContain("剩 4 张 · 20 分");
    handleRankFaces(ranks);
  });

  function handleRankFaces(ranks: El[]): void {
    for (const r of ranks) expect(r.querySelector(".hh-face"), "名次行缺头像").toBeTruthy();
  }

  it("平局与机器人赢:不撒彩带,名次按剩牌少到多", () => {
    const seats = [seat("朵朵", "human"), seat("团团", "ai")];
    const draw = new El("div");
    draw.innerHTML = resultRanksHTML(seats, fakeDone(-1, [3, 1], [12, 4]));
    expect(draw.querySelector(".hh-confetti")).toBeNull();
    expect(draw.querySelectorAll(".hh-rank")[0].textContent).toContain("团团");
    const botWin = new El("div");
    botWin.innerHTML = resultRanksHTML(seats, fakeDone(1, [3, 0], [12, 0]));
    expect(botWin.querySelector(".hh-confetti")).toBeNull();
    expect(botWin.querySelectorAll(".hh-rank")[0].className).toContain("hh-rank-win");
  });
});

// ---------------------------------------------------------------------------
// 无障碍与读法契约
// ---------------------------------------------------------------------------

describe("读法与光标契约不变", () => {
  it("手牌 aria-label 就是 cardLabel,一字不差;光标跟随还在", () => {
    const table = makeTable(playableDeck());
    const labels = handCards().map((c) => c.getAttribute("aria-label"));
    expect(labels).toEqual(["粉色 1", "粉色 2"]);
    expect(labels[0]).toBe(cardLabel({ id: 0, kind: "num", color: "pink", num: 1 }));
    fireWindow(dom, "keydown", { key: "a" });
    const cards = handCards();
    const cur = cards.findIndex((c) => c.className.includes("hh-card-cur"));
    expect(cards[cur].scrollCount).toBeGreaterThan(0);
    table.destroy();
  });

  it("新加的动画都有 reduceMotion 关闸(CSS 媒体块全覆盖)", () => {
    const handle = mount(fakeApi(dom.root));
    const css = styleText();
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reduced).toContain(".hh-fly{display:none;}");
    expect(reduced).toContain(".hh-colorwave{display:none;}");
    expect(reduced).toContain(".hh-colorbar-dot,.hh-bubble-in,.hh-fly-arc,.hh-confetti-p{animation:none;}");
    handle.destroy();
  });
});
