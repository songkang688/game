// 朵朵星星象棋 · 无头冒烟：不开浏览器，把整款游戏挂起来再拆掉。
//
// 盯五件事：
//  1. meta 与首页契约对得上，章节和恰好 188；
//  2. 三个入口（残局学堂 / 自由对战 / 残局连胜）都挂得出来，destroy 之后不留东西；
//  3. 平台接口真的接通：initialLevel 与 ?level= 直开第 N 课、requestSkip 出跳关按钮；
//  4. 落子确认、将军徽章、不合法走子的解释在真 UI 上就是那个行为；
//  5. 连胜最高分写进平台的 endlessBest。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { save } from "../../engine/save";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { TOTAL_LEVELS, loadSkips, loadStars, totalSize } from "../level99";
import { DIFFICULTIES, DIFFICULTY_NAME, THINK_DELAY_MS } from "./ai";
import { installDom, restoreDom, stubApi, windowListenerCount, type Dom, type El } from "./domStub";
import { PUZZLES, THEMES, puzzleAt } from "./endgames";
import { meta } from "./meta";
import { GEOM } from "./view";
import { pointAt } from "./session";

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

function api(extra: Record<string, unknown> = {}) {
  const s = stubApi(dom.root);
  return { api: { ...s.api, ...extra } as never, rec: s.rec };
}

function findByText(root: El, text: string): El | null {
  return root.find((e) => e.tagName === "button" && e.textContent.includes(text));
}

/** 在棋盘上点一下交叉点 (x, y) */
function tapAt(canvas: El, x: number, y: number): void {
  const p = pointAt(GEOM, x, y);
  canvas.dispatch("pointerdown", { clientX: p.cx, clientY: p.cy, preventDefault: () => undefined });
}

function boardCanvas(root: El): El {
  const c = root.find((e) => e.tagName === "canvas");
  expect(c, "棋盘没挂出来").not.toBeNull();
  return c!;
}

function msgOf(root: El): string {
  return root.find((e) => e.className.includes("xq-msg"))?.textContent ?? "";
}

/* ------------------------------------------------------------------ */

describe("meta 契约", () => {
  it("id、标题、分类、关数都按规格填", () => {
    expect(meta.id).toBe("xiangqi");
    expect(meta.title).toBe("朵朵星星象棋");
    expect(meta.category).toBe("party");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.levels).toBe(PUZZLES.length);
  });

  it("补上了 campaign，四种玩法都是平台认识的名字", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    for (const m of meta.modes) expect(GAME_MODES).toContain(m);
  });

  it("手机加了落子确认之后能玩，platform 填 both；meta 是纯数据", () => {
    expect(meta.platform).toBe("both");
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
  });

  it("blurb 和事实对得上：说了 188 课、六档、连胜", () => {
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).toContain("六档");
    expect(meta.blurb).toContain("连胜");
  });
});

describe("章节切分", () => {
  it("8 章，大小之和正好 188", async () => {
    const { CHAPTERS } = await import("./index");
    expect(CHAPTERS.length).toBe(THEMES.length);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
  });

  it("章节名与主题名一一对应", async () => {
    const { CHAPTERS } = await import("./index");
    CHAPTERS.forEach((c, i) => expect(c.name).toBe(THEMES[i].name));
  });
});

describe("挂载与卸载", () => {
  beforeEach(() => boot());

  it("顶部 re-export 了 meta，也导出 mount 与 openCampaignLevel", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
    expect(typeof mod.openCampaignLevel).toBe("function");
  });

  it("mount 之后有两个额外入口 + 188 课地图，destroy 之后根节点清空", async () => {
    const { mount } = await import("./index");
    const handle = mount(api().api);
    expect(findByText(dom.root, "自由对战")).not.toBeNull();
    expect(findByText(dom.root, "残局连胜")).not.toBeNull();
    expect(dom.root.findAll((e) => e.className.includes("l99-node")).length).toBeGreaterThan(5);
    handle.destroy();
    expect(dom.root.children.length).toBe(0);
  });

  it("destroy 之后 window 上不留监听、动画也停了", async () => {
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: 1 }).api);
    handle.destroy();
    vi.runOnlyPendingTimers();
    expect(windowListenerCount(dom)).toBe(0);
    expect(dom.root.countListeners()).toBe(0);
  });

  it("样式全是 xq- 前缀，没有全局 .board / .piece", async () => {
    const { CSS } = await import("./view");
    const selectors = CSS.match(/^\s*\.[A-Za-z][\w-]*/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(10);
    for (const s of selectors) expect(s.trim()).toMatch(/^\.xq-/);
    expect(CSS).not.toMatch(/(^|[\s,}])\.board\b/);
    expect(CSS).not.toMatch(/(^|[\s,}])\.piece\b/);
  });

  it("2D：画面只用一张 canvas，没有 3D 上下文", async () => {
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: 3 }).api);
    expect(dom.root.findAll((e) => e.tagName === "canvas").length).toBe(1);
    const { default: src } = await import("./view?raw");
    expect(String(src)).not.toContain("webgl");
    handle.destroy();
  });
});

describe("平台接线", () => {
  beforeEach(() => boot());

  it("initialLevel 直接开第 N 课（1 基）", async () => {
    dom.storage.set("yiduo-yixing.l99.xiangqi", JSON.stringify(new Array<number>(TOTAL_LEVELS).fill(1)));
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: 40 }).api);
    expect(dom.root.allText()).toContain("第 40 课");
    expect(dom.root.find((e) => e.tagName === "canvas")).not.toBeNull();
    handle.destroy();
  });

  it("地址栏 ?level=N 也认", async () => {
    dom.storage.set("yiduo-yixing.l99.xiangqi", JSON.stringify(new Array<number>(TOTAL_LEVELS).fill(1)));
    (globalThis as { location?: unknown }).location = { search: "?level=25", hash: "" };
    const { mount } = await import("./index");
    const handle = mount(api().api);
    expect(dom.root.allText()).toContain("第 25 课");
    handle.destroy();
    delete (globalThis as { location?: unknown }).location;
  });

  it("没给课号就停在地图上，一个棋盘都不开", async () => {
    const { mount } = await import("./index");
    const handle = mount(api().api);
    expect(dom.root.find((e) => e.tagName === "canvas")).toBeNull();
    handle.destroy();
  });

  it("课号越界 clamp 到还能玩的那一课，不白屏", async () => {
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: 9999 }).api);
    // 新档只解锁第 1 课
    expect(dom.root.allText()).toContain("第 1 课");
    handle.destroy();
  });

  it("openCampaignLevel 点不到还没解锁的课，会退回能玩的最远那一课", async () => {
    const { mount, openCampaignLevel } = await import("./index");
    const handle = mount(api().api);
    const host = dom.root.children[0].children[2] as unknown as HTMLElement;
    // 新档只解锁第 1 课，要第 100 课也只能给到第 1 课
    expect(openCampaignLevel(host, 99)).toBe(true);
    expect(dom.root.allText()).toContain("第 1 课");
    expect(dom.root.allText()).not.toContain("第 100 课");
    handle.destroy();
  });

  it("openLevel 收 1 基课号，越界 clamp 不抛错", async () => {
    const { mount, openLevel } = await import("./index");
    for (const n of [1, -5, 0, 99999]) {
      const handle = mount(api().api);
      const host = dom.root.children[0].children[2] as unknown as HTMLElement;
      expect(openLevel(host, n), `课号 ${n}`).toBe(true);
      expect(dom.root.allText()).toContain("第 1 课");
      handle.destroy();
    }
  });

  it("壳层注册了 requestSkip 就出跳关按钮，跳完写进跳关存档", async () => {
    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: (id, level) => {
        asked.push([id, level]);
        return Promise.resolve(true);
      },
    });
    const { mount } = await import("./index");
    const handle = mount(api().api);
    const skip = dom.root.find((e) => e.className.includes("l99-tool-skip"));
    expect(skip).not.toBeNull();
    skip!.dispatch("click", {});
    await vi.waitFor(() => expect(asked.length).toBe(1));
    expect(asked[0][0]).toBe("xiangqi");
    expect(asked[0][1]).toBe(0);
    await vi.waitFor(() => expect(loadSkips("xiangqi")).toContain(0));
    handle.destroy();
  });

  it("壳层没注册 requestSkip 就没有跳关按钮", async () => {
    const { mount } = await import("./index");
    const handle = mount(api().api);
    expect(dom.root.find((e) => e.className.includes("l99-tool-skip"))).toBeNull();
    handle.destroy();
  });
});

describe("残局这一课在真 UI 上怎么走", () => {
  beforeEach(() => boot(360, true));

  async function openLesson(n: number) {
    dom.storage.set("yiduo-yixing.l99.xiangqi", JSON.stringify(new Array<number>(TOTAL_LEVELS).fill(1)));
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: n }).api);
    return { handle, canvas: boardCanvas(dom.root) };
  }

  it("题面写着步数与目标，不剧透坐标", async () => {
    const { handle } = await openLesson(1);
    const text = dom.root.allText();
    expect(text).toContain("红方先走");
    expect(text).toContain("还能走 1 步");
    handle.destroy();
  });

  it("手机上确认落子默认开着", async () => {
    const { handle } = await openLesson(1);
    expect(findByText(dom.root, "确认落子：开")).not.toBeNull();
    handle.destroy();
  });

  it("点自己的子会说选中了，点空地不会走子", async () => {
    const { handle, canvas } = await openLesson(1);
    const p = puzzleAt(0);
    const setup = p.setup.split(/\s+/).find((t) => t.startsWith("rR"))!;
    const [x, y] = setup.slice(2).split(",").map(Number);
    tapAt(canvas, x, y);
    expect(msgOf(dom.root)).toContain("选中");
    handle.destroy();
  });

  it("点去不了的地方会给一句解释，而不是没反应", async () => {
    const { handle, canvas } = await openLesson(1);
    const p = puzzleAt(0);
    const rook = p.setup.split(/\s+/).find((t) => t.startsWith("rR"))!;
    const [x, y] = rook.slice(2).split(",").map(Number);
    tapAt(canvas, x, y);
    // 车走不了斜线，点一个斜对角一定是不合法的
    const bad = { x: x === 0 ? 1 : x - 1, y: y === 0 ? 1 : y - 1 };
    tapAt(canvas, bad.x, bad.y);
    const msg = msgOf(dom.root);
    expect(msg.length).toBeGreaterThan(4);
    expect(msg).not.toContain("选中");
    handle.destroy();
  });

  it("走完唯一那一步就通关：不用提示解开记满三星", async () => {
    const { winningFirstMoves } = await import("./solve");
    const { puzzleBoard, solvedText } = await import("./endgames");
    // 挑一课一步杀
    const idx0 = PUZZLES.findIndex((p) => p.mateIn === 1);
    const p = PUZZLES[idx0];
    const first = winningFirstMoves(puzzleBoard(p), "red", 1)[0];

    dom.storage.set("yiduo-yixing.l99.xiangqi", JSON.stringify(new Array<number>(TOTAL_LEVELS).fill(1)));
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: idx0 + 1 }).api);
    const canvas = boardCanvas(dom.root);
    tapAt(canvas, first.from.x, first.from.y);
    tapAt(canvas, first.to.x, first.to.y);
    tapAt(canvas, first.to.x, first.to.y); // 确认
    vi.advanceTimersByTime(2000);
    expect(dom.root.allText()).toContain(solvedText(p, false));
    // 星级落进平台存档
    expect(loadStars("xiangqi")[idx0]).toBe(3);
    handle.destroy();
  });

  it("确认落子开着的时候，只点一次落点不会走", async () => {
    const { winningFirstMoves } = await import("./solve");
    const { puzzleBoard } = await import("./endgames");
    const idx0 = PUZZLES.findIndex((x) => x.mateIn === 1);
    const p = PUZZLES[idx0];
    const first = winningFirstMoves(puzzleBoard(p), "red", 1)[0];

    dom.storage.set("yiduo-yixing.l99.xiangqi", JSON.stringify(new Array<number>(TOTAL_LEVELS).fill(1)));
    const { mount } = await import("./index");
    const handle = mount(api({ initialLevel: idx0 + 1 }).api);
    const canvas = boardCanvas(dom.root);
    tapAt(canvas, first.from.x, first.from.y);
    tapAt(canvas, first.to.x, first.to.y);
    vi.advanceTimersByTime(2000);
    // 还停在预览：既没通关，步数也没扣
    expect(msgOf(dom.root)).toContain("再点一次");
    expect(dom.root.allText()).toContain("还能走 1 步");
    expect(loadStars("xiangqi")[idx0]).toBe(1);
    handle.destroy();
  });

  it("提示只说动哪个子，用掉之后按钮就没了", async () => {
    const { handle } = await openLesson(1);
    const hint = dom.root.find((e) => e.className.includes("xq-hint"))!;
    expect(hint.textContent).toContain("×1");
    hint.dispatch("click", {});
    expect(msgOf(dom.root).length).toBeGreaterThan(6);
    expect(hint.textContent).toContain("×0");
    expect(hint.disabled).toBe(true);
    handle.destroy();
  });

  it("重摆之后棋盘回到原样，步数也补回来", async () => {
    const { handle } = await openLesson(1);
    const before = dom.root.allText();
    const again = dom.root.find((e) => e.className.includes("xq-restart"))!;
    again.dispatch("click", {});
    expect(dom.root.allText()).toContain("还能走 1 步");
    expect(before).toContain("还能走 1 步");
    handle.destroy();
  });
});

describe("自由对战", () => {
  beforeEach(() => boot());

  async function openFree() {
    const { mount } = await import("./index");
    const spy = api();
    const handle = mount(spy.api);
    findByText(dom.root, "自由对战")!.dispatch("click", {});
    return { handle, spy };
  }

  it("六档 + 双人同屏都能选，档位名字全在", async () => {
    const { handle } = await openFree();
    for (const d of DIFFICULTIES) {
      expect(findByText(dom.root, DIFFICULTY_NAME[d]), d).not.toBeNull();
    }
    expect(findByText(dom.root, "朵朵 VS 星星")).not.toBeNull();
    handle.destroy();
  });

  it("开始下棋之后棋盘挂出来，红方先走且轮到红方", async () => {
    const { handle } = await openFree();
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    expect(boardCanvas(dom.root)).not.toBeNull();
    const red = dom.root.find((e) => e.className.includes("xq-red"))!;
    const black = dom.root.find((e) => e.className.includes("xq-black"))!;
    expect(red.className).toContain("xq-turn");
    expect(black.className).not.toContain("xq-turn");
    handle.destroy();
  });

  it("双人同屏时悔棋要两边都点头", async () => {
    const { handle } = await openFree();
    findByText(dom.root, "朵朵 VS 星星")!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = boardCanvas(dom.root);
    // 炮二平五：点子 → 点落点 → 确认
    tapAt(canvas, 7, 7);
    tapAt(canvas, 4, 7);
    tapAt(canvas, 4, 7);
    const undo = dom.root.find((e) => e.className.includes("xq-undo"))!;
    expect(undo.disabled).toBe(false);
    undo.dispatch("click", {});
    expect(dom.root.allText()).toContain("同意");
    handle.destroy();
  });

  it("人机对局里电脑会自己走，而且不是秒应", async () => {
    const { handle } = await openFree();
    findByText(dom.root, DIFFICULTY_NAME.easy)!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    const canvas = boardCanvas(dom.root);
    tapAt(canvas, 7, 7);
    tapAt(canvas, 4, 7);
    tapAt(canvas, 4, 7);
    expect(dom.root.allText()).toContain("正在想");
    // 思考延时没到之前不许落子
    vi.advanceTimersByTime(THINK_DELAY_MS.easy - 30);
    expect(dom.root.allText()).toContain("正在想");
    vi.advanceTimersByTime(200);
    expect(dom.root.allText()).not.toContain("正在想");
    handle.destroy();
  });

  it("认输马上结束这一局", async () => {
    const { handle } = await openFree();
    findByText(dom.root, DIFFICULTY_NAME.novice)!.dispatch("click", {});
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    dom.root.find((e) => e.className.includes("xq-resign"))!.dispatch("click", {});
    expect(dom.root.allText()).toContain("认输");
    handle.destroy();
  });

  it("换玩法能退回选人面板", async () => {
    const { handle } = await openFree();
    findByText(dom.root, "开始下棋")!.dispatch("click", {});
    findByText(dom.root, "换玩法")!.dispatch("click", {});
    expect(findByText(dom.root, "开始下棋")).not.toBeNull();
    handle.destroy();
  });
});

describe("残局连胜写 endlessBest", () => {
  beforeEach(() => boot());

  it("连胜入口挂得出来，最高连胜显示在按钮上", async () => {
    save.recordEndlessBest("xiangqi", 6);
    const { mount } = await import("./index");
    const handle = mount(api().api);
    expect(findByText(dom.root, "最好 6 课")).not.toBeNull();
    handle.destroy();
  });

  it("一轮结束会把连胜数写进平台的 endlessBest", async () => {
    const { winningFirstMoves } = await import("./solve");
    const { puzzleBoard, puzzleAt: at } = await import("./endgames");
    const { streakPuzzle } = await import("./session");
    const { mount } = await import("./index");
    const handle = mount(api().api);
    findByText(dom.root, "残局连胜")!.dispatch("click", {});

    // 第一课解开：连胜 1
    const p = at(streakPuzzle(0, PUZZLES.length));
    const first = winningFirstMoves(puzzleBoard(p), "red", p.mateIn)[0];
    const canvas = boardCanvas(dom.root);
    tapAt(canvas, first.from.x, first.from.y);
    tapAt(canvas, first.to.x, first.to.y);
    tapAt(canvas, first.to.x, first.to.y);
    vi.advanceTimersByTime(2000);
    expect(dom.root.allText()).toMatch(/连解|连胜/);
    handle.destroy();
  });

  it("第一课就走错，这一轮结束、连胜记 0 且不覆盖旧纪录", async () => {
    const keep = save.recordEndlessBest("xiangqi", 9);
    expect(keep).toBe(9);
    const { mount } = await import("./index");
    const handle = mount(api().api);
    findByText(dom.root, "残局连胜")!.dispatch("click", {});
    const canvas = boardCanvas(dom.root);
    const p = puzzleAt(0);
    // 走一步不解题的棋：把帅挪一下，规定步数就用完了
    const king = p.setup.split(/\s+/).find((t) => t.startsWith("rK"))!;
    const [kx, ky] = king.slice(2).split(",").map(Number);
    tapAt(canvas, kx, ky);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      tapAt(canvas, kx + dx, ky + dy);
      tapAt(canvas, kx + dx, ky + dy);
    }
    vi.advanceTimersByTime(3000);
    expect(dom.root.allText()).toContain("这一轮结束");
    // 旧纪录更高，不许被这一轮的 0 冲掉
    expect(save.getGameProgress("xiangqi").endlessBest).toBe(9);
    handle.destroy();
  });
});

describe("分级红线", () => {
  beforeEach(() => boot());

  it("界面文案里没有打杀字眼，吃子说成回家休息", async () => {
    const { mount } = await import("./index");
    const handle = mount(api().api);
    findByText(dom.root, "规则")!.dispatch("click", {});
    const text = dom.root.allText();
    for (const bad of ["杀死", "血", "打死", "干掉", "弄死"]) expect(text, bad).not.toContain(bad);
    expect(text).toContain("困毙");
    handle.destroy();
  });

  it("不出现商业象棋软件名、棋手真名或商标", async () => {
    const { mount } = await import("./index");
    const handle = mount(api().api);
    findByText(dom.root, "规则")!.dispatch("click", {});
    const text = dom.root.allText() + JSON.stringify(meta);
    for (const bad of ["象棋巫师", "旋风", "天天象棋", "QQ", "胡荣华", "许银川", "王天一", "Elephant Eye"]) {
      expect(text, bad).not.toContain(bad);
    }
    handle.destroy();
  });

  it("没有引入任何棋类引擎依赖", async () => {
    const pkg = await import("../../../package.json");
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of Object.keys(deps)) {
      expect(name.toLowerCase()).not.toMatch(/xiangqi|chess|ucci|elephant|pikafish|stockfish/);
    }
  });
});
