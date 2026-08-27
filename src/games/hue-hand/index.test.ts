/**
 * 花色接龙 · 前端接线回归。
 *
 * 规格第十六节要「四种模式可玩」「destroy 干净」「360px 手牌可滑、按钮 ≥44px」,
 * 测试环境是 node,所以用自带的 `domStub.ts`:window 监听、定时器、DOM 节点都数得出来。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import {
  El,
  advance,
  fireWindow,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "./domStub";
import { buildDeck, cardLabel, type Card, type Color } from "./deck";
import { buildEndlessRound, dealRoundDeck } from "./levels";
import { createGame, legalPlays } from "./rules";
import {
  CATCH_DELAY_MS,
  CATCH_TICKS,
  createTable,
  cardWidthFor,
  duoScoreLine,
  meta,
  mount,
  versusTitle,
  type SeatCfg,
  type TableDone,
} from "./index";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
  wins: number;
  loses: number;
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [], wins: 0, loses: 0 };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {
      rec.wins += 1;
    },
    onLose: () => {
      rec.loses += 1;
    },
  } as unknown as GameApi;
  return rec;
}

/** 找到写着这段字的那个按钮(find 是先序,直接用会捞到外层容器) */
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

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("模块契约", () => {
  it("meta 按规格落地,四种模式都声明了", () => {
    expect(meta.id).toBe("hue-hand");
    expect(meta.title).toBe("花色接龙");
    expect(meta.emoji).toBe("🌈");
    expect(meta.category).toBe("party");
    expect(meta.levels).toBe(188);
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
  });

  it("挂上去就有三个模式入口和一张选关地图", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(byText("无尽连胜")).toBeTruthy();
    expect(byText("对战")).toBeTruthy();
    expect(byText("双人同屏")).toBeTruthy();
    expect(dom.root.querySelector(".l99-map")).toBeTruthy();
    handle.destroy();
  });
});

describe("对战牌桌", () => {
  it("开一桌:色条写清现在是什么颜色,手牌摊开,牌宽不低于 48px", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();

    const bar = dom.root.querySelector(".hh-colorbar");
    expect(bar?.textContent).toContain("现在是");
    expect(bar?.textContent).toMatch(/粉色|黄色|绿色|蓝色/);
    const cards = handCards();
    expect(cards.length).toBe(7);
    expect(Number.parseFloat(String(cards[0].style.width))).toBeGreaterThanOrEqual(48);
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(48);
    expect(dom.root.querySelector(".hh-deck")).toBeTruthy();
    handle.destroy();
  });

  it("点一张接不上的牌只会被温柔挡回来,牌还在手上", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();

    const dim = handCards().find((c) => c.className.includes("hh-card-dim"));
    if (dim) {
      dim.click();
      const say = dom.root.querySelector(".hh-say");
      expect(say?.className).toContain("hh-say-oops");
      expect(handCards().length).toBe(7);
      expect(rec.sounds).toContain("oops");
    }
    handle.destroy();
  });

  it("按 G 能摸牌,摸完手牌真的多了一张(或者换下一家)", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    const before = handCards().length;
    fireWindow(dom, "keydown", { key: "g" });
    const after = handCards().length;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(rec.sounds).toContain("pop");
    handle.destroy();
  });

  it("Esc 能暂停,再按一次接着玩", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    fireWindow(dom, "keydown", { key: "Escape" });
    expect(dom.root.querySelector(".hh-cover")?.textContent).toContain("歇一会儿");
    fireWindow(dom, "keydown", { key: "Escape" });
    expect(dom.root.querySelector(".hh-cover")).toBeNull();
    handle.destroy();
  });
});

describe("双人同屏的遮挡", () => {
  it("换人时先把手牌盖起来,按「我准备好了」才摊牌", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    expect(handCards().length).toBe(7);

    // 朵朵先走一手:能出就出,出不了就摸一张过掉
    const playable = handCards().find((c) => !c.className.includes("hh-card-dim"));
    if (playable) playable.click();
    else {
      fireWindow(dom, "keydown", { key: "g" });
      byText("先不出")?.click();
    }
    // 万能牌会先弹色环,随手挑一个颜色
    if (dom.root.querySelector(".hh-wheel")) {
      const swatch = dom.root.querySelector(".hh-swatch");
      swatch?.click();
    }

    const cover = dom.root.querySelector(".hh-cover");
    expect(cover?.textContent).toContain("轮到");
    expect(dom.root.querySelector(".hh-hidden")?.textContent).toContain("收起来");
    byText("我准备好了")?.click();
    expect(dom.root.querySelector(".hh-cover")).toBeNull();
    expect(handCards().length).toBeGreaterThan(0);
    handle.destroy();
  });
});

describe("无尽与闯关入口", () => {
  it("无尽连胜点进去就能开局", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽连胜")?.click();
    expect(dom.root.querySelector(".hh-chip")?.textContent).toContain("连胜");
    expect(handCards().length).toBeGreaterThan(0);
    byText("回选关")?.click();
    expect(dom.root.querySelector(".l99-map")).toBeTruthy();
    handle.destroy();
  });

  it("无尽第 1 局发的是 dealRoundDeck 挑过的那副牌,而且开局一定有牌可接", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽连胜")?.click();

    const cfg = buildEndlessRound(1);
    const deck = dealRoundDeck(cfg, 0);
    const expected = createGame({ players: cfg.players, seed: cfg.seed, handSize: cfg.handSize, deck });
    const onScreen = handCards().map((c) => c.getAttribute("aria-label"));
    expect(onScreen).toEqual(expected.players[0].hand.map((c) => cardLabel(c)));
    expect(legalPlays(expected, 0).length).toBeGreaterThan(0);
    handle.destroy();
  });

  it("连胜断了重来会换一批牌:同一局的第 2 批发的不是同一副", () => {
    const cfg = buildEndlessRound(1);
    const first = dealRoundDeck(cfg, 0).map((c) => c.id).join(",");
    const second = dealRoundDeck(cfg, 1).map((c) => c.id).join(",");
    expect(second).not.toBe(first);
  });

  it("从地图点第 1 关能开出一桌牌", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")?.click();
    expect(dom.root.querySelector(".hh-colorbar")?.textContent).toContain("现在是");
    expect(handCards().length).toBeGreaterThan(0);
    handle.destroy();
  });
});

describe("键位提示与光标跟随", () => {
  it("提示行把 KEYS_P1 / KEYS_P2 认的键写全了,不再只写 A / D", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    const keys = dom.root.querySelector(".hh-keys")?.textContent ?? "";
    // 朵朵四个方向键都认:W / A / S / D
    for (const k of ["W", "A", "S", "D"]) expect(keys, `朵朵的 ${k}`).toContain(k);
    // 星星的上下也认,不只是左右
    for (const k of ["←", "→", "↑", "↓"]) expect(keys, `星星的 ${k}`).toContain(k);
    expect(keys).toContain("F 出牌");
    expect(keys).toContain("G 抽牌");
    expect(keys).toContain("L 出牌");
    expect(keys).toContain("K 抽牌");
    handle.destroy();
  });

  it("上下键和左右键挪的是同一个光标", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    const curIndex = (): number => handCards().findIndex((c) => c.className.includes("hh-card-cur"));
    expect(curIndex()).toBe(0);
    fireWindow(dom, "keydown", { key: "s" });
    expect(curIndex()).toBe(1);
    fireWindow(dom, "keydown", { key: "w" });
    expect(curIndex()).toBe(0);
    handle.destroy();
  });

  it("光标挪到哪张牌,就把哪张牌滚进视野(360px 上一行摆不下七张)", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    // 七张 50px 的牌加间距超过 360px,`.hh-hand` 必须横滑才看得到最右那张
    expect(handCards().length * (cardWidthFor(360) + 6)).toBeGreaterThan(360);

    fireWindow(dom, "keydown", { key: "a" }); // 从第 0 张往回绕到最后一张
    const cards = handCards();
    const cur = cards.findIndex((c) => c.className.includes("hh-card-cur"));
    expect(cur).toBe(cards.length - 1);
    expect(cards[cur].scrollCount).toBeGreaterThan(0);
    // 只带光标那一张进视野,别的牌不去动它
    for (let i = 0; i < cards.length; i++) {
      if (i !== cur) expect(cards[i].scrollCount, `第 ${i} 张不该被滚`).toBe(0);
    }
    handle.destroy();
  });
});

describe("窄屏与按钮尺寸", () => {
  it("360px 下手牌是横向可滑的一条,牌不小于 48px", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    const css = styleText();
    expect(css).toContain(".hh-hand{display:flex;gap:6px;overflow-x:auto");
    expect(cardWidthFor(320)).toBeGreaterThanOrEqual(48);
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(48);
    expect(cardWidthFor(768)).toBeGreaterThanOrEqual(48);
    handle.destroy();
  });

  it("「就一张」钮固定右下角,按钮与字号都够大", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const css = styleText();
    expect(css).toContain(".hh-one{position:absolute;right:10px;bottom:10px");
    expect(css).toMatch(/\.hh-one\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.hh-btn\{[^}]*min-height:44px/);
    // 字号一律 ≥13px
    for (const m of css.matchAll(/font-size:(\d+)px/g)) {
      expect(Number(m[1]), `字号 ${m[1]}px 太小了`).toBeGreaterThanOrEqual(13);
    }
    handle.destroy();
  });

  it("动效照顾 prefers-reduced-motion", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(styleText()).toContain("@media (prefers-reduced-motion:reduce)");
    handle.destroy();
  });
});

describe("闯关的手数限制", () => {
  const HUMAN: SeatCfg = { kind: "human", name: "朵朵", avatar: "🌸", isImg: false, tier: "expert", keys: 0 };
  const BOT: SeatCfg = { kind: "ai", name: "团团", avatar: "🐰", isImg: false, tier: "rookie", keys: 0 };

  /** 从整副牌里挑一张还没用过的,拿到的是副本,id 天然不重复 */
  function deal(pool: Card[], color: Color | null, num: number | null): Card {
    const i = pool.findIndex((c) => c.kind === "num" && c.color === color && c.num === num);
    if (i < 0) throw new Error(`牌堆里没有 ${color} ${num}`);
    return pool.splice(i, 1)[0];
  }

  /**
   * 摆一副顺序完全确定的牌:2 人各摸 2 张,台面翻出粉 5。
   * 朵朵手上两张绿牌都接不上,只能摸牌;摸上来的第一张是粉 9,正好能出。
   * 数组末尾先被 pop,所以发牌顺序要倒着排。
   */
  function riggedDeck(): Card[] {
    const pool = buildDeck();
    const mine = [deal(pool, "mint", 1), deal(pool, "mint", 2)];
    const foe = [deal(pool, "sky", 3), deal(pool, "sky", 4)];
    const top = deal(pool, "pink", 5);
    const firstDraw = deal(pool, "pink", 9);
    const rest = [deal(pool, "lemon", 6), deal(pool, "lemon", 7)];
    return [...rest, firstDraw, top, foe[1], mine[1], foe[0], mine[0]];
  }

  function riggedTable(max: number, onDone: (r: TableDone) => void): { destroy: () => void } {
    return createTable(dom.root as unknown as HTMLElement, {
      cfg: { players: 2, tiers: ["rookie"], kinds: ["num"], handSize: 2, seed: 4242, hint: "试手数" },
      deck: riggedDeck(),
      seats: [HUMAN, BOT],
      banner: "试手数",
      turnLimit: { seat: 0, max },
      sfx: () => undefined,
      onDone,
    });
  }

  function colorBarText(): string {
    return dom.root.querySelector(".hh-colorbar")?.textContent ?? "";
  }

  it("色条上写着自己还剩几手,摸一张就少一手", () => {
    const table = riggedTable(9, () => undefined);
    expect(colorBarText()).toContain("还剩 9 手");
    fireWindow(dom, "keydown", { key: "g" });
    expect(colorBarText()).toContain("还剩 8 手");
    table.destroy();
  });

  it("摸上来顺手打掉的那张只算一手,不重复扣", () => {
    const table = riggedTable(9, () => undefined);
    fireWindow(dom, "keydown", { key: "g" });
    expect(colorBarText()).toContain("还剩 8 手");
    const play = byText("出这张");
    expect(play).toBeTruthy();
    play?.click();
    // 出的就是刚摸上来的粉 9:台面换成 9,手数还是停在 8
    expect(colorBarText()).toContain("还剩 8 手");
    expect(dom.root.querySelector(".hh-top")?.textContent).toContain("9");
    table.destroy();
  });

  it("手数用光就收桌,按没打完算,不给赢家分", () => {
    let done: TableDone | null = null;
    const table = riggedTable(1, (r) => {
      done = r;
    });
    expect(colorBarText()).toContain("还剩 1 手");
    fireWindow(dom, "keydown", { key: "g" });
    expect(dom.root.querySelector(".hh-say")?.textContent).toContain("手数用完");
    advance(dom, 900);

    const r = done as TableDone | null;
    expect(r).toBeTruthy();
    expect(r?.winner).toBe(-1);
    expect(r?.gained).toBe(0);
    // 记的是朵朵自己动的手数,不是全桌加起来的步数
    expect(r?.actions[0]).toBe(1);
    expect(r?.actions.length).toBe(2);
    table.destroy();
  });

  it("不限手数的对战桌不会冒出手数提示", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    expect(colorBarText()).toContain("现在是");
    expect(colorBarText()).not.toContain("还剩");
    handle.destroy();
  });
});

describe("「就一张」的抢按窗口", () => {
  const HUMAN: SeatCfg = { kind: "human", name: "朵朵", avatar: "🌸", isImg: false, tier: "expert", keys: 0 };
  /** 高手档才会点破别人忘喊 */
  const HUNTER: SeatCfg = { kind: "ai", name: "点点", avatar: "🦊", isImg: false, tier: "expert", keys: 0 };

  /** 朵朵手上两张粉牌,打掉一张就剩一张 —— 正好落进「可以被点破」的窗口 */
  function riggedDeck(): Card[] {
    const pool = buildDeck();
    const pick = (color: Color, num: number): Card => {
      const i = pool.findIndex((c) => c.kind === "num" && c.color === color && c.num === num);
      return pool.splice(i, 1)[0];
    };
    const mine = [pick("pink", 1), pick("pink", 2)];
    const foe = [pick("sky", 3), pick("sky", 4)];
    const top = pick("pink", 7);
    const rest = [pick("lemon", 6), pick("lemon", 8)];
    return [...rest, top, foe[1], mine[1], foe[0], mine[0]];
  }

  function oneBtn(): El | null {
    return dom.root.querySelector(".hh-one");
  }

  function openWindow(): { destroy: () => void } {
    const table = createTable(dom.root as unknown as HTMLElement, {
      cfg: { players: 2, tiers: ["expert"], kinds: ["num"], handSize: 2, seed: 4242, hint: "抢按" },
      deck: riggedDeck(),
      seats: [HUMAN, HUNTER],
      banner: "抢按",
      sfx: () => undefined,
      onDone: () => undefined,
    });
    // 打掉第一张,手上只剩一张又没喊
    handCards()[0].click();
    return table;
  }

  it("有人盯着的时候钮上摆倒数,一格一格往下走", () => {
    const table = openWindow();
    expect(oneBtn()?.textContent).toBe(`☝️ 就一张 ${CATCH_TICKS}`);
    expect(oneBtn()?.className).toContain("hh-one-hot");
    advance(dom, CATCH_DELAY_MS / CATCH_TICKS);
    expect(oneBtn()?.getAttribute("data-left")).toBe(String(CATCH_TICKS - 1));
    advance(dom, CATCH_DELAY_MS / CATCH_TICKS);
    expect(oneBtn()?.getAttribute("data-left")).toBe("1");
    table.destroy();
  });

  it("喊掉了就不再催,钮收回去", () => {
    const table = openWindow();
    expect(oneBtn()).toBeTruthy();
    oneBtn()?.click();
    expect(oneBtn()).toBeNull();
    expect(dom.root.querySelector(".hh-say")?.textContent).toContain("喊得漂亮");
    advance(dom, CATCH_DELAY_MS + 200);
    // 喊过了就罚不到:手上还是那一张
    expect(dom.root.querySelector(".hh-say")?.textContent).not.toContain("罚抽");
    table.destroy();
  });

  it("窗口时长一毫秒没动:倒数走完照旧被点破,难度没被这条改动碰过", () => {
    const table = openWindow();
    advance(dom, CATCH_DELAY_MS - 1);
    expect(dom.root.querySelector(".hh-say")?.textContent).not.toContain("罚抽");
    advance(dom, 2);
    expect(dom.root.querySelector(".hh-say")?.textContent).toContain("罚抽 2 张");
    expect(CATCH_DELAY_MS).toBe(1800);
    table.destroy();
  });

  it("没人会点破的桌子不摆倒数", () => {
    const table = createTable(dom.root as unknown as HTMLElement, {
      cfg: { players: 2, tiers: ["rookie"], kinds: ["num"], handSize: 2, seed: 4242, hint: "抢按" },
      deck: riggedDeck(),
      // 新手档从来不点破别人
      seats: [HUMAN, { ...HUNTER, tier: "rookie" }],
      banner: "抢按",
      sfx: () => undefined,
      onDone: () => undefined,
    });
    handCards()[0].click();
    expect(oneBtn()?.textContent).toBe("☝️ 就一张");
    expect(oneBtn()?.className).not.toContain("hh-one-hot");
    table.destroy();
  });
});

describe("牌都用完了的那一局", () => {
  const HUMAN: SeatCfg = { kind: "human", name: "朵朵", avatar: "🌸", isImg: false, tier: "expert", keys: 0 };
  const BOT: SeatCfg = { kind: "ai", name: "团团", avatar: "🐰", isImg: false, tier: "rookie", keys: 0 };

  /**
   * 摆一副刚好发完就见底的牌:2 人各 1 张,台面翻出粉 7,抽牌堆一张不剩。
   * 两个人手上一张粉色 / 7 都没有,谁也接不上 —— 这就是 R3B-1 说的那个死局面。
   * 数组末尾先被 pop,所以顺序要倒着排。
   */
  function emptyDeck(): Card[] {
    const pool = buildDeck();
    const pick = (color: Color, num: number): Card => {
      const i = pool.findIndex((c) => c.kind === "num" && c.color === color && c.num === num);
      return pool.splice(i, 1)[0];
    };
    const mine = pick("mint", 3);
    const foe = pick("sky", 5);
    const top = pick("pink", 7);
    return [top, foe, mine];
  }

  it("摸不到牌就收成平局:winner = -1,一分都不给", () => {
    let done: TableDone | null = null;
    const table = createTable(dom.root as unknown as HTMLElement, {
      cfg: { players: 2, tiers: ["rookie"], kinds: ["num"], handSize: 1, seed: 4242, hint: "牌用完" },
      deck: emptyDeck(),
      seats: [HUMAN, BOT],
      banner: "牌用完",
      sfx: () => undefined,
      onDone: (r) => {
        done = r;
      },
    });
    fireWindow(dom, "keydown", { key: "g" });
    expect(dom.root.querySelector(".hh-say")?.textContent).toContain("这一局算平局");
    advance(dom, 900);

    const r = done as TableDone | null;
    expect(r).toBeTruthy();
    expect(r?.winner).toBe(-1);
    expect(r?.gained).toBe(0);
    table.destroy();
  });

  it("对战结算标题分得清赢 / 输 / 平", () => {
    expect(versusTitle(0)).toContain("你先出完");
    expect(versusTitle(1)).toContain("这局被");
    expect(versusTitle(-1)).toContain("平手");
    expect(versusTitle(-1)).not.toContain("输");
  });

  it("双人同屏的平局单记一格「平 N」,两边胜场都不涨", () => {
    expect(duoScoreLine([0, 0], 0)).toBe("朵朵 0 : 0 星星");
    expect(duoScoreLine([1, 0], 0)).toBe("朵朵 1 : 0 星星");
    expect(duoScoreLine([1, 0], 2)).toBe("朵朵 1 : 0 星星 · 平 2");
  });
});

describe("destroy 收得干净", () => {
  it("玩过一桌之后 destroy:监听、定时器、DOM 全清", () => {
    const rec = fakeApi(dom.root);
    const before = windowListenerCount(dom);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    fireWindow(dom, "keydown", { key: "g" });
    advance(dom, 900);
    expect(windowListenerCount(dom)).toBeGreaterThan(before);

    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.timers.size).toBe(0);
    expect(dom.root.children.length).toBe(0);
    expect(dom.root.countListeners()).toBe(0);
  });

  it("destroy 之后再走时钟,不会再有人偷偷改 DOM", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    handle.destroy();
    advance(dom, 5000);
    expect(dom.root.children.length).toBe(0);
    expect(dom.timers.size).toBe(0);
  });
});
