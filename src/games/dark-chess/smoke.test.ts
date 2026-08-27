// 翻翻暗棋 · 无头冒烟：不开浏览器，把整款游戏挂起来再拆掉。
//
// 守三件事：
//  1. meta 与首页契约对得上；
//  2. `mount(api)` 能挂出菜单 / 188 关地图 / 棋盘，`destroy` 之后一根监听都不剩；
//  3. 文案红线：没有商标，没有死亡描写，没有批评孩子的话。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { TOTAL_LEVELS } from "../level99";
import { fireWindow, installDom, restoreDom, windowListenerCount, type Dom, type El } from "./domStub";
import GUIDE from "./guide";
import { CHAPTERS } from "./levels";
import { meta } from "./meta";
import { TIERS, TIER_LABELS } from "./ai";
import { BLUE_LABEL, RED_LABEL } from "./board";
import { CSS as BOARD_CSS } from "./view";

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

describe("翻翻暗棋 · meta 契约", () => {
  it("id、分类、颜色、关数都按规格填", () => {
    expect(meta.id).toBe("dark-chess");
    expect(meta.title).toBe("翻翻暗棋");
    expect(meta.emoji).toBe("🀄️");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#F6DFC5");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.blurb.length).toBeGreaterThan(10);
    expect(meta.blurb.length).toBeLessThanOrEqual(60);
  });

  it("四种玩法都声明了，而且都是平台认识的名字", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    for (const m of meta.modes) expect(GAME_MODES).toContain(m);
  });

  it("手游端游都能玩，meta 是纯数据", () => {
    expect(meta.platform).toBe("both");
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
  });
});

describe("翻翻暗棋 · index 契约", () => {
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
    const modes = dom.root.findAll((e) => e.className.split(/\s+/).includes("dc-mode"));
    expect(modes).toHaveLength(4);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.root.children).toHaveLength(0);
  });

  it("进人机对战能摆出 32 格棋盘，退出去清得干净", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    const versus = dom.root.find((e) => e.textContent.includes("人机对战"))!;
    versus.dispatch("click", {});
    const cells = dom.root.findAll((e) => e.className.includes("dc-cell"));
    expect(cells.length).toBe(32);
    const back = dom.root.find((e) => e.textContent.includes("换个玩法"))!;
    back.dispatch("click", {});
    expect(dom.root.findAll((e) => e.className.includes("dc-cell"))).toHaveLength(0);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("反复进出对战，window 上的监听不会越攒越多", async () => {
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

  it("点一格能真的翻子，键盘 Esc 能暂停", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    dom.root.find((e) => e.textContent.includes("人机对战"))!.dispatch("click", {});
    const cells = dom.root.findAll((e) => e.className.includes("dc-cell"));
    expect(cells[0].textContent).toBe("🌸");
    cells[0].dispatch("click", {});
    // 翻子动画结束前先不改字，动画过后这一格一定不再是背面
    expect(dom.root.find((e) => e.className.includes("dc-note"))?.textContent).toContain("翻开");
    fireWindow(dom, "keydown", { key: "Escape", preventDefault: () => undefined });
    expect(dom.root.find((e) => e.className.includes("dc-turn"))?.textContent).toBe("已暂停");
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("360px 上棋盘一行八格，格子与按钮都够手指点", () => {
    // 8 列 1fr，格子与按钮的 min-height 都写死到 44px
    expect(BOARD_CSS).toContain("grid-template-columns:repeat(8,1fr)");
    expect(BOARD_CSS).toContain(".dc-cell{position:relative;aspect-ratio:1/1;min-height:44px;");
    expect(BOARD_CSS).toContain("min-height:44px;}");
    expect(BOARD_CSS).not.toContain("min-height:40px");
  });

  it("窄屏把格间距收到 3px，把宽度还给棋格", () => {
    expect(BOARD_CSS).toContain("@media (max-width:400px)");
    expect(BOARD_CSS).toContain(".dc-board{gap:3px;}");
    // 360px 视口下 8 列 + 7 道 3px 间距，单格宽度比 4px 间距时多回来将近 1px
    const cell = (gap: number): number => (360 - gap * 7) / 8;
    expect(cell(3)).toBeGreaterThan(cell(4));
    expect(cell(3)).toBeGreaterThan(42);
  });
});

describe("翻翻暗棋 · 文案红线", () => {
  const BANNED = [
    "三国杀",
    "斗地主",
    "大富翁",
    "天天象棋",
    "JJ",
    "腾讯棋牌",
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
  const UGLY = ["死", "杀", "阵亡", "笨", "蠢", "废物", "没用", "下注", "赌"];

  function allText(): string[] {
    const out: string[] = [meta.title, meta.blurb, GUIDE.title, ...GUIDE.general];
    for (const e of GUIDE.entries) out.push(e.title, ...e.tips);
    for (const c of CHAPTERS) out.push(c.name, c.desc);
    for (const t of TIERS) out.push(TIER_LABELS[t]);
    out.push(...Object.values(RED_LABEL), ...Object.values(BLUE_LABEL));
    return out.filter((s) => s.length > 0);
  }

  it("全部可见文案不沾任何商标", () => {
    for (const line of allText()) {
      const low = line.toLowerCase();
      for (const w of BANNED) {
        expect(low.includes(w.toLowerCase()), `「${w}」出现在：${line}`).toBe(false);
      }
    }
  });

  it("不写死亡、不批评孩子", () => {
    for (const line of allText()) {
      for (const w of UGLY) {
        expect(line.includes(w), `「${w}」出现在：${line}`).toBe(false);
      }
    }
  });

  it("攻略结构完整：八章条目覆盖第 1 关到第 188 关", () => {
    expect(GUIDE.gameId).toBe(meta.id);
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(3);
    expect(GUIDE.entries).toHaveLength(8);
    expect(GUIDE.entries[0].from).toBe(1);
    expect(GUIDE.entries[GUIDE.entries.length - 1].to).toBe(188);
    for (const e of GUIDE.entries) {
      expect(e.from).toBeLessThanOrEqual(e.to);
      expect(e.tips.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("攻略里点明了和明棋象棋的关系", () => {
    expect(GUIDE.general.join("")).toContain("象棋");
  });

  it("章节名与说明在 360px 上不会撑破一行", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeLessThanOrEqual(8);
      expect(c.desc.length).toBeLessThanOrEqual(30);
    }
  });
});
