// 军旗对决 · 无头冒烟：不开浏览器，把整款游戏挂起来、走两步、再拆干净。
//
// 守四件事：
//  1. meta 与首页契约对得上；
//  2. `mount(api)` 能挂出菜单 / 188 关地图 / 棋盘，`destroy` 之后一根监听都不剩；
//  3. 棋盘上点得动：选子 → 选落点 → 确认，键盘 F / G / Esc 也管用；
//  4. 文案红线：没有商标，不写伤亡，失败只鼓励。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { TOTAL_LEVELS } from "../level99";
import { TIERS, TIER_LABELS, TIER_TIPS } from "./ai";
import { CELLS, idx } from "./board";
import { fireWindow, installDom, restoreDom, windowListenerCount, type Dom, type El } from "./domStub";
import GUIDE, { TWO_PLAYER_NOTE } from "./guide";
import { LOSE_LINE } from "./index";
import { CHAPTERS } from "./levels";
import { meta } from "./meta";
import { LABEL } from "./rules";
import { CSS as BOARD_CSS, MIN_SCALE, PIECE_FONT, VIEW_INFO } from "./view";

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

function find(text: string): El {
  const hit = dom.root.find((e) => e.textContent.includes(text));
  if (!hit) throw new Error(`界面上找不到「${text}」`);
  return hit;
}

function cellsOnScreen(): El[] {
  return dom.root.findAll((e) => e.className.split(/\s+/).includes("jq-cell"));
}

describe("军旗对决 · meta 契约", () => {
  it("id、分类、颜色、关数都按规格填", () => {
    expect(meta.id).toBe("junqi-camp");
    expect(meta.title).toBe("军旗对决");
    expect(meta.emoji).toBe("🎖️");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#E6F0D8");
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

describe("军旗对决 · index 契约", () => {
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
    const modes = dom.root.findAll((e) => e.className.split(/\s+/).includes("jq-mode"));
    expect(modes).toHaveLength(4);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.root.children).toHaveLength(0);
  });

  it("进人机对战能摆出 60 格棋盘，退出去清得干净", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    find("人机对战").dispatch("click", {});
    expect(cellsOnScreen()).toHaveLength(CELLS);
    find("换个玩法").dispatch("click", {});
    expect(cellsOnScreen()).toHaveLength(0);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("反复进出对战，window 上的监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    const baseline = windowListenerCount(dom);
    for (let i = 0; i < 3; i++) {
      find("双人同屏").dispatch("click", {});
      find("换个玩法").dispatch("click", {});
    }
    expect(windowListenerCount(dom)).toBe(baseline);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("闯关能挂出 188 关的地图", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    find("闯关 188").dispatch("click", {});
    const nodes = dom.root.findAll((e) => (e.getAttribute("aria-label") ?? "").includes("第 1 关"));
    expect(nodes.length).toBeGreaterThan(0);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("点一枚子会亮出落点，再点落点要按确认才走", async () => {
    const { createTable } = await import("./index");
    const { positionFor } = await import("./levels");
    const table = createTable(dom.root as unknown as HTMLElement, {
      state: positionFor(0),
      rival: "garrison",
      tier: "rookie",
      viewer: "all",
      label: "测试",
      maxPlies: 4,
      timeoutIsLoss: true,
      seed: 1,
      onEnd: () => undefined,
    });
    const cells = cellsOnScreen();
    const mine = cells.findIndex((c) => c.className.includes("jq-duo"));
    expect(mine).toBeGreaterThanOrEqual(0);
    cells[mine].dispatch("click", {});
    expect(cellsOnScreen().filter((c) => c.className.includes("jq-target")).length).toBeGreaterThan(0);
    const target = cellsOnScreen().findIndex((c) => c.className.includes("jq-target"));
    cellsOnScreen()[target].dispatch("click", {});
    expect(cellsOnScreen()[target].className).toContain("jq-pending");
    // 还没确认，棋子仍然在原地
    expect(cellsOnScreen()[mine].className).toContain("jq-duo");
    table.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("键盘 F 确认、G 取消、Esc 暂停都接上了", async () => {
    const { createTable } = await import("./index");
    const { positionFor } = await import("./levels");
    const table = createTable(dom.root as unknown as HTMLElement, {
      state: positionFor(0),
      rival: "garrison",
      tier: "rookie",
      viewer: "all",
      label: "测试",
      maxPlies: 4,
      timeoutIsLoss: true,
      seed: 1,
      onEnd: () => undefined,
    });
    const key = (k: string): void => fireWindow(dom, "keydown", { key: k, preventDefault: () => undefined });
    const cells = cellsOnScreen();
    const mine = cells.findIndex((c) => c.className.includes("jq-duo"));
    cells[mine].dispatch("click", {});
    key("g");
    expect(cellsOnScreen().some((c) => c.className.includes("jq-sel"))).toBe(false);
    key("w");
    key("d");
    key("Escape");
    expect(dom.root.find((e) => e.className.includes("jq-chip"))?.textContent).toBe("已暂停");
    key("Escape");
    table.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("守备队关按参考解走完真的过关，而且清得干净", async () => {
    // 这一条顺便把 prefers-reduced-motion 那条路径走一遍：翻子动画走短的那一档
    restoreDom();
    dom = installDom(360, true);
    const { createTable } = await import("./index");
    const { positionFor, solveLevel } = await import("./levels");
    let ended: { won: boolean } | null = null;
    const state = positionFor(2);
    const table = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "garrison",
      tier: "rookie",
      viewer: "all",
      label: "测试",
      maxPlies: 6,
      timeoutIsLoss: true,
      seed: 1,
      onEnd: (r) => (ended = r),
    });
    const solution = solveLevel(2)!;
    for (const move of solution) {
      const cells = cellsOnScreen();
      cells[move.from].dispatch("click", {});
      cells[move.to].dispatch("click", {});
      cells[move.to].dispatch("click", {});
      await new Promise((r) => setTimeout(r, 320));
    }
    await new Promise((r) => setTimeout(r, 320));
    expect(ended, "这一关应该过了").not.toBeNull();
    expect((ended as unknown as { won: boolean }).won).toBe(true);
    table.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("360px 上棋子够手指点，字也看得清", () => {
    expect(BOARD_CSS).toContain("min-height:44px");
    expect(BOARD_CSS).toContain("min-width:44px");
    expect(PIECE_FONT * MIN_SCALE).toBeGreaterThanOrEqual(12);
    expect(VIEW_INFO.minPieceFont).toBeGreaterThanOrEqual(12);
    expect(VIEW_INFO.rows).toBe(12);
    expect(VIEW_INFO.cols).toBe(5);
    expect(VIEW_INFO.camps).toBe(10);
    expect(VIEW_INFO.hqs).toBe(4);
  });

  it("铁路画粗线、公路画细线，行营是圆的、大本营是方的", () => {
    expect(BOARD_CSS).toContain(".jq-line.jq-rail");
    expect(BOARD_CSS).toContain(".jq-cell.jq-camp .jq-face{border-radius:50%;}");
    expect(BOARD_CSS).toContain(".jq-cell.jq-hq .jq-face");
    expect(BOARD_CSS).toContain("prefers-reduced-motion");
  });

  it("暗棋时对方是一张背面，明棋时两边都看得见", async () => {
    const { createTable } = await import("./index");
    const { newGame } = await import("./setup");
    const hidden = createTable(dom.root as unknown as HTMLElement, {
      state: newGame(11),
      rival: "ai",
      tier: "rookie",
      viewer: "duo",
      label: "暗棋",
      maxPlies: 4,
      timeoutIsLoss: false,
      seed: 3,
      onEnd: () => undefined,
    });
    expect(cellsOnScreen().filter((c) => c.className.includes("jq-back")).length).toBe(25);
    hidden.destroy();
    const open = createTable(dom.root as unknown as HTMLElement, {
      state: newGame(11),
      rival: "human",
      tier: "rookie",
      viewer: "all",
      label: "明棋",
      maxPlies: 4,
      timeoutIsLoss: false,
      seed: 3,
      onEnd: () => undefined,
    });
    expect(cellsOnScreen().filter((c) => c.className.includes("jq-back")).length).toBe(0);
    expect(cellsOnScreen().filter((c) => c.className.includes("jq-star")).length).toBe(25);
    open.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("行营与大本营在棋盘上画出来了", async () => {
    const { createTable } = await import("./index");
    const { positionFor } = await import("./levels");
    const table = createTable(dom.root as unknown as HTMLElement, {
      state: positionFor(0),
      rival: "garrison",
      tier: "rookie",
      viewer: "all",
      label: "测试",
      maxPlies: 4,
      timeoutIsLoss: true,
      seed: 1,
      onEnd: () => undefined,
    });
    const cells = cellsOnScreen();
    expect(cells.filter((c) => c.className.includes("jq-camp"))).toHaveLength(10);
    expect(cells.filter((c) => c.className.includes("jq-hq"))).toHaveLength(4);
    expect(cells[idx(9, 1)].className).toContain("jq-camp");
    expect(cells[idx(11, 1)].className).toContain("jq-hq");
    table.destroy();
  });
});

describe("军旗对决 · 文案红线", () => {
  const BANNED = [
    "三国杀",
    "斗地主",
    "天天象棋",
    "腾讯棋牌",
    "四国军棋",
    "JJ",
    "开心消消乐",
    "愤怒的小鸟",
    "植物大战僵尸",
    "水果忍者",
    "地铁跑酷",
    "拳皇",
    "超级玛丽",
    "马里奥",
    "俄罗斯方块",
    "tetris",
    "我的世界",
    "minecraft",
    "pac-man",
    "宝可梦",
    "皮卡丘",
    "奥特曼",
    "喜羊羊",
    "蛋仔",
    "原神",
    "王者荣耀",
  ];
  const UGLY = ["死", "杀", "阵亡", "牺牲", "打仗", "开火", "笨", "蠢", "废物", "没用", "下注", "赌"];

  function allText(): string[] {
    const out: string[] = [meta.title, meta.blurb, GUIDE.title, ...GUIDE.general, TWO_PLAYER_NOTE, LOSE_LINE];
    for (const e of GUIDE.entries) out.push(e.title, ...e.tips);
    for (const c of CHAPTERS) out.push(c.name, c.desc);
    for (const t of TIERS) out.push(TIER_LABELS[t], TIER_TIPS[t]);
    out.push(...Object.values(LABEL));
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

  it("去军事化：不写伤亡，不批评孩子", () => {
    for (const line of allText()) {
      for (const w of UGLY) {
        expect(line.includes(w), `「${w}」出现在：${line}`).toBe(false);
      }
    }
  });

  it("被撞下场一律叫「回营休息」，失败文案只鼓励", () => {
    expect(GUIDE.general.join("")).toContain("回营休息");
    expect(LOSE_LINE).toBe("旗子这次没扛回来，下一盘先修条铁路。");
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

  it("攻略把这一款的两条自家规定和遮挡方案都写清楚了", () => {
    const all = [...GUIDE.general, ...GUIDE.entries.flatMap((e) => e.tips)].join("");
    expect(all).toContain("炸弹撞上军旗");
    expect(all).toContain("行营里不放子");
    expect(TWO_PLAYER_NOTE).toContain("明棋");
    expect(TWO_PLAYER_NOTE).toContain("人机对战");
  });

  it("攻略里点明了这一款不是象棋那一路", () => {
    expect(GUIDE.general.join("")).toContain("铁路");
    expect(GUIDE.title).toContain("铁路");
  });
});
