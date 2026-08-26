// 五子棋 · 无头冒烟：不开浏览器，把整款游戏挂起来再拆掉。
//
// 盯四件事：
//  1. meta 与首页契约对得上，188 关章节和恰好是 188；
//  2. 三个玩法入口（解局学堂 / 自由对战 / 连胜挑战）都挂得出来，destroy 之后不留东西；
//  3. 平台接口真的接通了：requestSkip 出按钮、initialLevel 直开第 N 题、
//     旧存档 key 只读一次就搬走；
//  4. 落子确认与提示限次在真 UI 上也是那个行为。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { TOTAL_LEVELS, loadSkips, loadStars, totalSize } from "../level99";
import { DIFFICULTIES, DIFFICULTY_NAME } from "./ai";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { meta } from "./meta";
import { PUZZLES, THEMES } from "./puzzles";
import { LEGACY_CAMPAIGN_KEY } from "./session";
import { VIEW_W } from "./view";

let dom: Dom;

function boot(width = 800, coarse = false): void {
  dom = installDom(width, coarse);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
}

afterEach(() => {
  vi.useRealTimers();
  restoreDom();
  resetLevelExtras();
});

interface Spy {
  api: {
    root: HTMLElement;
    play: (n: string) => void;
    addStars: (n: number) => number;
    getStars: () => number;
    onWin: (stars: 1 | 2 | 3, msg?: string) => void;
    onLose: (msg?: string) => void;
  };
  played: string[];
  wins: Array<{ stars: number; msg?: string }>;
  loses: string[];
}

function fakeApi(root: El, extra: Record<string, unknown> = {}): Spy {
  const played: string[] = [];
  const wins: Array<{ stars: number; msg?: string }> = [];
  const loses: string[] = [];
  let stars = 0;
  return {
    api: {
      root: root as unknown as HTMLElement,
      play: (n: string) => played.push(n),
      addStars: (n: number) => (stars += n),
      getStars: () => stars,
      onWin: (s: 1 | 2 | 3, msg?: string) => wins.push({ stars: s, msg }),
      onLose: (msg?: string) => loses.push(msg ?? ""),
      ...extra,
    },
    played,
    wins,
    loses,
  };
}

/** 在棋盘上点一下 (x, y) 这个交叉点 */
function tapBoard(canvas: El, size: number, x: number, y: number): void {
  const cs = VIEW_W / (size + 1);
  const ev = { clientX: cs + x * cs, clientY: cs + y * cs, preventDefault: () => undefined };
  canvas.dispatch("pointerdown", ev);
  canvas.dispatch("pointerup", ev);
}

function findByText(root: El, text: string): El | null {
  return root.find((e) => e.tagName === "button" && e.textContent.includes(text));
}

function countStones(root: El): number {
  // 棋子只画在 canvas 上，靠「该谁下」的提示反推轮次更稳
  return root.find((e) => e.className.includes("gmk-turn"))?.textContent.length ?? 0;
}

describe("五子棋 · meta 契约", () => {
  it("id、分类、颜色、关数都按规格填", () => {
    expect(meta.id).toBe("gomoku");
    expect(meta.title).toBe("五子棋");
    expect(meta.emoji).toBe("⚫");
    expect(meta.category).toBe("party");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.levels).toBe(PUZZLES.length);
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

describe("五子棋 · 章节切分", () => {
  it("9 个主题章（≥8），大小之和正好 188", async () => {
    const { CHAPTERS } = await import("./index");
    expect(CHAPTERS.length).toBe(THEMES.length);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
  });

  it("章节名与主题名一一对应，每章至少 10 关", async () => {
    const { CHAPTERS } = await import("./index");
    CHAPTERS.forEach((c, i) => {
      expect(c.name).toBe(THEMES[i].name);
      expect(c.size).toBeGreaterThanOrEqual(10);
    });
  });
});

describe("五子棋 · 挂载与卸载", () => {
  beforeEach(() => boot());

  it("顶部 re-export 了 meta，并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("mount 之后有两个额外玩法入口 + 188 关地图，destroy 之后根节点清空", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    expect(findByText(dom.root, "自由对战")).not.toBeNull();
    expect(findByText(dom.root, "连胜挑战")).not.toBeNull();
    expect(dom.root.findAll((e) => e.className.includes("l99-node")).length).toBeGreaterThan(5);
    handle.destroy();
    expect(dom.root.children.length).toBe(0);
  });
});

describe("五子棋 · 平台接口", () => {
  beforeEach(() => boot());

  it("旧存档 key 在 mount 时被读走并删掉，星一颗都不少", async () => {
    const legacy = new Array<number>(TOTAL_LEVELS).fill(0);
    legacy[0] = 3;
    legacy[42] = 2;
    legacy[187] = 3;
    dom.storage.set(LEGACY_CAMPAIGN_KEY, JSON.stringify({ stars: legacy }));

    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    expect(dom.storage.get(LEGACY_CAMPAIGN_KEY)).toBeUndefined();
    const stars = loadStars("gomoku");
    expect(stars[0]).toBe(3);
    expect(stars[42]).toBe(2);
    expect(stars[187]).toBe(3);
    handle.destroy();
  });

  it("initialLevel 直接开第 N 题（1 基），不卡在选关地图", async () => {
    dom.storage.set("yiduo-yixing.l99.gomoku", JSON.stringify(new Array<number>(TOTAL_LEVELS).fill(1)));
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 120 }).api);
    expect(dom.root.allText()).toContain("第 120 关");
    expect(dom.root.find((e) => e.tagName === "canvas")).not.toBeNull();
    handle.destroy();
  });

  it("没给 initialLevel 就停在地图上，一个棋盘都不开", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    expect(dom.root.find((e) => e.tagName === "canvas")).toBeNull();
    handle.destroy();
  });

  it("initialLevel 越界时 clamp 到还能玩的那一关，不白屏", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 9999 }).api);
    // 新档只解锁第 1 关
    expect(dom.root.allText()).toContain("第 1 关");
    handle.destroy();
  });

  it("壳层注册了 requestSkip 就出跳关按钮，点完这一关记进跳关存档", async () => {
    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: (id, level) => {
        asked.push([id, level]);
        return Promise.resolve(true);
      },
    });
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    const skip = dom.root.find((e) => e.className.includes("l99-tool-skip"));
    expect(skip).not.toBeNull();
    skip!.dispatch("click", {});
    await Promise.resolve();
    await Promise.resolve();
    expect(asked).toEqual([["gomoku", 0]]);
    expect(loadSkips("gomoku")).toContain(0);
    handle.destroy();
  });

  it("没注册 requestSkip 时按钮自动隐藏", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    expect(dom.root.find((e) => e.className.includes("l99-tool-skip"))).toBeNull();
    handle.destroy();
  });
});

describe("五子棋 · 自由对战", () => {
  beforeEach(() => boot());

  async function openFree(): Promise<{ spy: Spy; handle: { destroy: () => void } }> {
    const { mount } = await import("./index");
    const spy = fakeApi(dom.root);
    const handle = mount(spy.api);
    findByText(dom.root, "自由对战")!.dispatch("click", {});
    return { spy, handle };
  }

  it("六档人机 + 双人同屏都在选项里", async () => {
    const { handle } = await openFree();
    for (const d of DIFFICULTIES) {
      expect(findByText(dom.root, DIFFICULTY_NAME[d])).not.toBeNull();
    }
    expect(findByText(dom.root, "朵朵 VS 星星")).not.toBeNull();
    handle.destroy();
  });

  it("壳层给的关号会映射成自由对战的对手档位：第 161 关派地狱档", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 161 }).api);
    findByText(dom.root, "自由对战")!.dispatch("click", {});
    expect(findByText(dom.root, DIFFICULTY_NAME.hell)!.className).toContain("gmk-on");
    expect(findByText(dom.root, DIFFICULTY_NAME.normal)!.className).not.toContain("gmk-on");
    handle.destroy();
  });

  it("没给关号时自由对战默认普通档", async () => {
    const { handle } = await openFree();
    expect(findByText(dom.root, DIFFICULTY_NAME.normal)!.className).toContain("gmk-on");
    handle.destroy();
  });

  it("桌面上点一下就落子（确认默认关）", async () => {
    const { handle } = await openFree();
    findByText(dom.root, DIFFICULTY_NAME.novice)!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    expect(findByText(dom.root, "确认落子：关")).not.toBeNull();
    tapBoard(canvas, 15, 7, 7);
    // 黑棋落完就轮到 AI 想
    expect(dom.root.allText()).toContain("思考中");
    handle.destroy();
  });

  it("手机上要点两次：第一次只是预览", async () => {
    restoreDom();
    boot(360, true);
    const { handle } = await openFree();
    findByText(dom.root, DIFFICULTY_NAME.novice)!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    expect(findByText(dom.root, "确认落子：开")).not.toBeNull();
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    tapBoard(canvas, 15, 7, 7);
    expect(dom.root.allText()).toContain("再点一次粉圈");
    expect(dom.root.allText()).not.toContain("思考中");
    tapBoard(canvas, 15, 7, 7);
    expect(dom.root.allText()).toContain("思考中");
    handle.destroy();
  });

  it("「确认落子」按钮能手动切换，切完立刻生效", async () => {
    const { handle } = await openFree();
    findByText(dom.root, DIFFICULTY_NAME.novice)!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const toggle = findByText(dom.root, "确认落子：关")!;
    toggle.dispatch("click", {});
    expect(toggle.textContent).toContain("确认落子：开");
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    tapBoard(canvas, 15, 7, 7);
    expect(dom.root.allText()).toContain("再点一次粉圈");
    handle.destroy();
  });

  it("提示每局 3 次，用完变灰，而且只说方位不报坐标", async () => {
    const { handle } = await openFree();
    findByText(dom.root, "朵朵 VS 星星")!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    tapBoard(canvas, 15, 7, 7);
    const hint = dom.root.find((e) => e.className.includes("gmk-hint"))!;
    expect(hint.textContent).toContain("×3");
    for (let i = 3; i > 0; i--) {
      expect(hint.disabled).toBe(false);
      hint.dispatch("click", {});
    }
    expect(hint.textContent).toContain("×0");
    expect(hint.disabled).toBe(true);
    const msg = dom.root.find((e) => e.className.includes("gmk-msg"))!.textContent;
    expect(msg).toContain("棋盘");
    expect(msg).not.toMatch(/第\s*\d+\s*[列行]/);
    handle.destroy();
  });

  it("双人同屏黑白轮流，没有 AI 抢着下", async () => {
    const { handle } = await openFree();
    findByText(dom.root, "朵朵 VS 星星")!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    expect(dom.root.allText()).toContain("该朵朵");
    tapBoard(canvas, 15, 7, 7);
    expect(dom.root.allText()).toContain("该星星");
    tapBoard(canvas, 15, 8, 7);
    expect(dom.root.allText()).toContain("该朵朵");
    expect(countStones(dom.root)).toBeGreaterThan(0);
    handle.destroy();
  });

  it("开着禁手规则时，黑棋踩三三会给白棋一个 8 秒的申告窗口", async () => {
    const { spy, handle } = await openFree();
    findByText(dom.root, "朵朵 VS 星星")!.dispatch("click", {});
    findByText(dom.root, "9×9 入门")!.dispatch("click", {});
    findByText(dom.root, "白棋能指出禁手")!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    // 黑棋摆出双活三的形，白棋下在四个角上（凑不成任何线）
    const black: Array<[number, number]> = [[2, 2], [3, 3], [4, 2], [4, 3]];
    const white: Array<[number, number]> = [[0, 0], [0, 8], [8, 0], [8, 8]];
    for (let i = 0; i < black.length; i++) {
      tapBoard(canvas, 9, black[i][0], black[i][1]);
      tapBoard(canvas, 9, white[i][0], white[i][1]);
    }
    // (4,4) 同时做出两个活三 —— 三三禁手
    tapBoard(canvas, 9, 4, 4);
    expect(dom.root.allText()).toContain("三三");
    const claim = findByText(dom.root, "指出三三禁手");
    expect(claim).not.toBeNull();
    expect(findByText(dom.root, "不指出，继续下")).not.toBeNull();
    expect(dom.root.allText()).toContain("秒");
    claim!.dispatch("click", {});
    expect(spy.wins.length).toBe(1);
    expect(spy.wins[0].msg).toContain("禁手");
    handle.destroy();
  });

  it("白棋放过禁手就接着下，不判负", async () => {
    const { spy, handle } = await openFree();
    findByText(dom.root, "朵朵 VS 星星")!.dispatch("click", {});
    findByText(dom.root, "9×9 入门")!.dispatch("click", {});
    findByText(dom.root, "白棋能指出禁手")!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    const black: Array<[number, number]> = [[2, 2], [3, 3], [4, 2], [4, 3]];
    const white: Array<[number, number]> = [[0, 0], [0, 8], [8, 0], [8, 8]];
    for (let i = 0; i < black.length; i++) {
      tapBoard(canvas, 9, black[i][0], black[i][1]);
      tapBoard(canvas, 9, white[i][0], white[i][1]);
    }
    tapBoard(canvas, 9, 4, 4);
    findByText(dom.root, "不指出，继续下")!.dispatch("click", {});
    expect(spy.wins.length).toBe(0);
    expect(spy.loses.length).toBe(0);
    expect(dom.root.allText()).toContain("该星星");
    handle.destroy();
  });

  it("悔棋按钮开局是灰的，落子之后才能按", async () => {
    const { handle } = await openFree();
    findByText(dom.root, "朵朵 VS 星星")!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const undo = dom.root.find((e) => e.className.includes("gmk-undo") && !e.className.includes("gmk-confirm"))!;
    expect(undo.disabled).toBe(true);
    tapBoard(dom.root.find((e) => e.tagName === "canvas")!, 15, 7, 7);
    expect(undo.disabled).toBe(false);
    handle.destroy();
  });
});

describe("五子棋 · 连胜挑战", () => {
  beforeEach(() => boot());

  it("从菜鸟档打起，标题写着连胜 0", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    findByText(dom.root, "连胜挑战")!.dispatch("click", {});
    const text = dom.root.allText();
    expect(text).toContain("连胜 0");
    expect(text).toContain(DIFFICULTY_NAME.novice);
    handle.destroy();
  });

  it("连胜挑战不新增 localStorage key，成绩走平台存档", async () => {
    const { mount } = await import("./index");
    const before = new Set(dom.storage.keys());
    const handle = mount(fakeApi(dom.root).api);
    findByText(dom.root, "连胜挑战")!.dispatch("click", {});
    const added = Array.from(dom.storage.keys()).filter((k) => !before.has(k));
    for (const k of added) expect(k.startsWith("yiduo-yixing.")).toBe(true);
    expect(added.some((k) => k.includes("streak"))).toBe(false);
    handle.destroy();
  });
});

describe("五子棋 · 解局学堂", () => {
  beforeEach(() => boot());

  it("开一道题就有棋盘、题面写着解法分类与限步", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 1 }).api);
    const text = dom.root.allText();
    expect(dom.root.find((e) => e.tagName === "canvas")).not.toBeNull();
    expect(text).toContain("步内连成五");
    expect(text).toContain("提示只有 1 次");
    handle.destroy();
  });

  it("解局的提示只有 1 次，用掉就没了", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 1 }).api);
    const hint = dom.root.find((e) => e.className.includes("gmk-hint"))!;
    expect(hint.textContent).toContain("×1");
    hint.dispatch("click", {});
    expect(hint.textContent).toContain("×0");
    expect(hint.disabled).toBe(true);
    handle.destroy();
  });

  it("有「重摆」按钮，点了棋盘还在", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 1 }).api);
    const retry = findByText(dom.root, "重摆")!;
    retry.dispatch("click", {});
    expect(dom.root.find((e) => e.tagName === "canvas")).not.toBeNull();
    handle.destroy();
  });
});

describe("五子棋 · 文案红线", () => {
  beforeEach(() => boot());

  it("界面上没有商标、没有死亡描写、没有批评孩子的话", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root, { initialLevel: 1 }).api);
    const text = dom.root.allText();
    for (const bad of ["死", "杀死", "笨", "蠢", "垃圾", "宝可梦", "马里奥"]) {
      expect(text.includes(bad)).toBe(false);
    }
    handle.destroy();
  });
});
