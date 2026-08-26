// 花园国际象棋 · 无头冒烟：不开浏览器，把整款游戏挂起来再拆掉。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { TOTAL_LEVELS } from "../level99";
import { fireWindow, installDom, restoreDom, windowListenerCount, type Dom, type El } from "./domStub";
import GUIDE from "./guide";
import { CHAPTERS, goalText, planFor } from "./levels";
import { meta } from "./meta";
import { TIERS, TIER_BLURB, TIER_LABELS } from "./search";
import { CSS as BOARD_CSS, PIECE_NAME } from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

function fakeApi(root: El) {
  const played: string[] = [];
  let stars = 0;
  return {
    api: {
      root: root as unknown as HTMLElement,
      play: (n: string) => played.push(n),
      addStars: (n: number) => (stars += n),
      getStars: () => stars,
      onWin: () => undefined,
      onLose: () => undefined,
    },
    played,
  };
}

describe("花园国际象棋 · meta 契约", () => {
  it("id、分类、颜色、关数都按规格填", () => {
    expect(meta.id).toBe("chess-garden");
    expect(meta.title).toBe("花园国际象棋");
    expect(meta.emoji).toBe("♔");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#F0E6D8");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.blurb.length).toBeGreaterThan(10);
    expect(meta.blurb.length).toBeLessThanOrEqual(60);
  });

  it("四种玩法都声明了，手游端游都能玩", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    for (const m of meta.modes) expect(GAME_MODES).toContain(m);
    expect(meta.platform).toBe("both");
  });

  it("meta 是纯数据", () => {
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
  });
});

describe("花园国际象棋 · index 契约", () => {
  it("顶部 re-export 了 meta，并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("mount 之后有四个玩法入口，destroy 之后一根监听都不剩", async () => {
    const { mount } = await import("./index");
    const before = windowListenerCount(dom);
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    expect(dom.root.findAll((e) => e.className.split(/\s+/).includes("cg-mode"))).toHaveLength(4);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.root.children).toHaveLength(0);
  });

  it("进人机对战能摆出 64 格棋盘，退出去清得干净", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    dom.root.find((e) => e.textContent.includes("人机对战"))!.dispatch("click", {});
    expect(dom.root.findAll((e) => e.className.includes("cg-sq")).length).toBe(64);
    dom.root.find((e) => e.textContent.includes("换个玩法"))!.dispatch("click", {});
    expect(dom.root.findAll((e) => e.className.includes("cg-sq"))).toHaveLength(0);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("反复进出双人同屏，监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    const baseline = windowListenerCount(dom);
    for (let i = 0; i < 3; i++) {
      dom.root.find((e) => e.textContent.includes("双人同屏"))!.dispatch("click", {});
      dom.root.find((e) => e.textContent.includes("换个玩法"))!.dispatch("click", {});
    }
    expect(windowListenerCount(dom)).toBe(baseline);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("点一枚白兵能选中，再点落点就真的走了", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    dom.root.find((e) => e.textContent.includes("双人同屏"))!.dispatch("click", {});
    const squares = dom.root.findAll((e) => e.className.includes("cg-sq"));
    // 屏幕第 6 行第 5 列是 e2，下标 6*8+4 = 52
    squares[52].dispatch("click", {});
    expect(dom.root.findAll((e) => e.className.includes("cg-sel")).length).toBe(1);
    squares[36].dispatch("click", {}); // e4
    expect(dom.root.find((e) => e.className.includes("cg-note"))?.textContent).toContain("e2");
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("翻转棋盘之后仍然是 64 格，监听没有翻倍", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    dom.root.find((e) => e.textContent.includes("双人同屏"))!.dispatch("click", {});
    const before = windowListenerCount(dom);
    dom.root.find((e) => e.textContent === "翻转棋盘")!.dispatch("click", {});
    expect(dom.root.findAll((e) => e.className.includes("cg-sq")).length).toBe(64);
    expect(windowListenerCount(dom)).toBe(before);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("Esc 能暂停", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    dom.root.find((e) => e.textContent.includes("双人同屏"))!.dispatch("click", {});
    fireWindow(dom, "keydown", { key: "Escape", preventDefault: () => undefined });
    expect(dom.root.find((e) => e.className.includes("cg-turn"))?.textContent).toBe("已暂停");
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("360px 上棋盘八列铺满，格子与按钮都够手指点", () => {
    expect(BOARD_CSS).toContain("grid-template-columns:repeat(8,1fr)");
    expect(BOARD_CSS).toContain("min-height:36px");
    expect(BOARD_CSS).toContain("min-height:44px");
  });
});

describe("花园国际象棋 · 文案红线", () => {
  const BANNED = [
    "stockfish",
    "chess.js",
    "lichess",
    "chess.com",
    "天天象棋",
    "三国杀",
    "斗地主",
    "大富翁",
    "愤怒的小鸟",
    "植物大战僵尸",
    "水果忍者",
    "地铁跑酷",
    "森林冰火人",
    "屁王兄弟",
    "拳皇",
    "街霸",
    "超级玛丽",
    "马里奥",
    "割绳子",
    "俄罗斯方块",
    "tetris",
    "贪吃蛇大作战",
    "球球大作战",
    "我的世界",
    "minecraft",
    "pac-man",
    "吃豆人",
    "宝可梦",
    "皮卡丘",
    "奥特曼",
    "喜羊羊",
    "蛋仔",
    "原神",
    "王者荣耀",
  ];
  const UGLY = ["血", "尸", "笨", "蠢", "废物", "没用", "下注", "赌"];

  function allText(): string[] {
    const out: string[] = [meta.title, meta.blurb, GUIDE.title, ...GUIDE.general];
    for (const e of GUIDE.entries) out.push(e.title, ...e.tips);
    for (const c of CHAPTERS) out.push(c.name, c.desc);
    for (const t of TIERS) out.push(TIER_LABELS[t], TIER_BLURB[t]);
    out.push(...Object.values(PIECE_NAME));
    for (let lv = 0; lv < 188; lv += 7) {
      const p = planFor(lv);
      out.push(p.hint, goalText(p));
    }
    return out.filter((s) => s.length > 0);
  }

  it("全部可见文案不沾任何商标、引擎名或商业下棋 App 名", () => {
    for (const line of allText()) {
      const low = line.toLowerCase();
      for (const w of BANNED) {
        expect(low.includes(w.toLowerCase()), `「${w}」出现在：${line}`).toBe(false);
      }
    }
  });

  it("没有血腥，也没有批评孩子的话", () => {
    for (const line of allText()) {
      for (const w of UGLY) {
        expect(line.includes(w), `「${w}」出现在：${line}`).toBe(false);
      }
    }
  });

  it("攻略结构完整：八章条目覆盖第 1 关到第 188 关", () => {
    expect(GUIDE.gameId).toBe(meta.id);
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(3);
    expect(GUIDE.general.length).toBeLessThanOrEqual(6);
    expect(GUIDE.entries).toHaveLength(8);
    expect(GUIDE.entries[0].from).toBe(1);
    expect(GUIDE.entries[GUIDE.entries.length - 1].to).toBe(188);
    for (const e of GUIDE.entries) {
      expect(e.from).toBeLessThanOrEqual(e.to);
      expect(e.tips.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("章节名与说明在 360px 上不会撑破一行", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeLessThanOrEqual(8);
      expect(c.desc.length).toBeLessThanOrEqual(30);
    }
  });
});
