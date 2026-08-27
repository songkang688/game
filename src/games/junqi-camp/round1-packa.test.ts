/**
 * 军旗对决 · 窗口 2 第 1 轮验收 · 测试员包 A 的复现测试。
 *
 * 只记录、不改玩法。既有 `smoke.test.ts` 已经把 meta 契约、挂载/拆卸、点击选子、
 * 文案红线都测过了，这一份补走查铁则里剩下的几块：
 *  - 铁则 1：界面上真的赢一次（照参考解扛旗）、真的输一次（手数用完），再退出、再进来；
 *  - 铁则 2：第 1 / 100 / 188 关都从界面上点到结算；
 *  - 铁则 3：双人同屏两套键位到底认不认，以及 Esc 暂停封得住封不住；
 *  - 铁则 6：`destroy` 之后 AI 的 setTimeout 不再回来敲门。
 *
 * 标了「【已知问题】」的用例断言的是**当前行为**，修好之后会红，那时候连断言一起翻面。
 * 记在 `docs/qa/1.2-window2-round1-tester-packA.md` 的问题表里：
 *  - PA-JQ-1（严重）：双人同屏只有一个共用光标，康康的方向键在鸭梨回合照样拨得动它；
 *  - PA-JQ-2（一般，与 PA-JQ-1 同根）：康康那套 L / K 一个都没接，第二个人只能借鸭梨的 F / G。
 *    这两条第 1 轮修复员已一起修（每个座位各一个光标、键位按座位派发），
 *    「双人同屏键位」那一组断言已经翻成修好后的行为；
 *  - PA-JQ-3（一般）：暂停时按「确认」不落子，但已经选好的落点被悄悄丢掉了。
 *    第 2 轮学习优化员已修（`createBoard` 加 `isPaused` 通路），对应断言已翻成修好后的行为。
 *
 * `mount` / `createTable` 必须走顶部静态 import 并在文件里真的用到：这样
 * level99 → dialogs → audio 那条链会在装 DOM 桩之前求值完，
 * 不会撞上桩里没实现的 `document.addEventListener`。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CELLS, idx } from "./board";
import { fireWindow, installDom, restoreDom, windowListenerCount, type Dom, type El } from "./domStub";
import GUIDE from "./guide";
import { LOSE_LINE, createTable, mount, type TableResult } from "./index";
import { CHAPTERS, maxPliesOf, planFor, positionFor, rateLevel, solveLevel } from "./levels";
import { meta } from "./meta";
import { makeState, type Cell, type GameState, type Kind, type Side } from "./rules";
import { CSS as BOARD_CSS } from "./view";

let dom: Dom;

beforeEach(() => {
  // 360px + 减少动效：走查铁则 4 要的窄屏，顺便让翻子动画走短的那一档，测试跑得完
  dom = installDom(360, true);
});

afterEach(() => {
  restoreDom();
});

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, ms = 4000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pred()) return true;
    await sleep(15);
  }
  return pred();
}

function fakeApi() {
  const played: string[] = [];
  const won: string[] = [];
  const lost: string[] = [];
  return {
    played,
    won,
    lost,
    api: {
      root: dom.root as unknown as HTMLElement,
      play: (n: string) => played.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: (_s: number, why: string) => won.push(why),
      onLose: (why: string) => lost.push(why),
    },
  };
}

function cellsOnScreen(): El[] {
  return dom.root.findAll((e) => e.className.split(/\s+/).includes("jq-cell"));
}

function cursorAt(): number {
  return cellsOnScreen().findIndex((c) => c.className.split(/\s+/).includes("jq-cursor"));
}

function selectedAt(): number {
  return cellsOnScreen().findIndex((c) => c.className.split(/\s+/).includes("jq-sel"));
}

function key(k: string): void {
  fireWindow(dom, "keydown", { key: k, preventDefault: () => undefined });
}

function tap(text: string): void {
  const hit = dom.root.find((e) => e.textContent.includes(text));
  if (!hit) throw new Error(`界面上找不到「${text}」`);
  hit.dispatch("click", {});
}

/** 界面上走一步：点起点 → 点落点 → 再点一次落点当确认 */
function clickMove(from: number, to: number): void {
  const cs = cellsOnScreen();
  cs[from].dispatch("click", {});
  cs[to].dispatch("click", {});
  cs[to].dispatch("click", {});
}

function turnChipText(): string {
  return dom.root.find((e) => e.className === "jq-top")?.children[0]?.textContent ?? "";
}

/** 用给定的四个方向键，把共用光标一路敲到目标格 */
function driveCursorTo(target: number, keys: [string, string, string, string]): void {
  const [up, down, left, right] = keys;
  for (let guard = 0; guard < 40 && cursorAt() !== target; guard++) {
    const cur = cursorAt();
    const dr = Math.floor(target / 5) - Math.floor(cur / 5);
    const dc = (target % 5) - (cur % 5);
    if (dr !== 0) key(dr > 0 ? down : up);
    else key(dc > 0 ? right : left);
  }
}

/** 完全照 index.ts 里 playLevel 的参数摆一张战役棋盘 */
function campaignTable(level: number) {
  const plan = planFor(level);
  const state = positionFor(level);
  const ends: TableResult[] = [];
  const table = createTable(dom.root as unknown as HTMLElement, {
    state,
    rival: plan.garrison ? "garrison" : "ai",
    tier: plan.tier,
    viewer: plan.hidden ? "duo" : "all",
    label: `第 ${level + 1} 关 · ${plan.budget} 手内扛旗`,
    maxPlies: maxPliesOf(plan),
    timeoutIsLoss: true,
    seed: plan.seed,
    hint: plan.hint,
    onEnd: (r) => ends.push(r),
  });
  return { plan, state, ends, table };
}

/** 照参考解在界面上把一关走完 */
async function playSolution(level: number, state: GameState, ends: TableResult[]): Promise<void> {
  const solution = solveLevel(level);
  expect(solution, `第 ${level + 1} 关搜不出参考解`).not.toBeNull();
  for (const move of solution!) {
    if (ends.length > 0) break;
    const before = state.plies;
    clickMove(move.from, move.to);
    await waitFor(() => state.plies > before || ends.length > 0);
    // 等这一手的翻子动画放完，棋盘解冻，同时给对面的 AI 留出落子时间
    await waitFor(() => state.turn === "duo" || state.outcome !== null || ends.length > 0);
    await sleep(260);
  }
  await waitFor(() => ends.length > 0);
}

const DUEL_START = idx(1, 1);
const DUEL_SIDESTEP = idx(1, 2);
const STAR_FLAG = idx(0, 1);
const STAR_START = idx(10, 1);
const DUO_FLAG = idx(11, 1);

/**
 * 双人同屏用的一副小残局：两边各一枚连长，各自守着对面大本营门口的旗。
 * 谁先扛回旗子谁赢，两个人都真的要走一手，键位归属才验得出来。
 */
function duelState(): GameState {
  const cells = new Array<Cell>(CELLS).fill(null);
  let id = 1;
  const put = (at: number, side: Side, kind: Kind): void => {
    cells[at] = { id: id++, side, kind };
  };
  put(DUO_FLAG, "duo", "junqi");
  put(idx(11, 3), "duo", "dilei");
  put(STAR_FLAG, "star", "junqi");
  put(idx(0, 3), "star", "dilei");
  put(DUEL_START, "duo", "lianzhang");
  put(STAR_START, "star", "lianzhang");
  return makeState(cells, { turn: "duo" });
}

/** 照 index.ts 里 startTwoPlayer 的参数摆一张双人同屏的棋盘（局面换成上面那副小残局） */
function duelTable() {
  const state = duelState();
  const ends: TableResult[] = [];
  const notes: string[] = [];
  const table = createTable(dom.root as unknown as HTMLElement, {
    state,
    rival: "human",
    tier: "normal",
    viewer: "all",
    label: "双人同屏 · 明棋",
    maxPlies: 400,
    timeoutIsLoss: false,
    seed: 7889,
    hint: "同屏就下明棋：两个人都看得见，轮流点自己那一边。",
    onEnd: (r) => ends.push(r),
  });
  const origNote = dom.root.find((e) => e.className === "jq-note");
  return { state, ends, notes, table, note: () => origNote?.textContent ?? "" };
}

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 1：真赢一次、真输一次、退出再进                          */
/* ------------------------------------------------------------------ */

describe("PA-JQ · 真实胜负", () => {
  it("第 1 关照参考解扛回旗子，是真赢，星数按省下的手数给", async () => {
    const { plan, state, ends } = campaignTable(0);
    await playSolution(0, state, ends);
    expect(ends, "走完参考解也没收场").toHaveLength(1);
    expect(ends[0].won, "扛回旗子了却没判赢").toBe(true);
    expect(ends[0].why).toBe("旗子扛回来啦！");
    expect(ends[0].duoMoves).toBe(solveLevel(0)!.length);
    expect(ends[0].duoMoves).toBeLessThanOrEqual(plan.budget);
    // 3 手的预算里用掉 2 手：够二星，但离三星门槛（1 手）还差一点
    expect(rateLevel(ends[0].duoMoves, plan.budget)).toBe(2);
  });

  it("手数用完就是真输，收场话只鼓励、不批评", async () => {
    const plan = planFor(0);
    const state = positionFor(0);
    const ends: TableResult[] = [];
    createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "garrison",
      tier: plan.tier,
      viewer: "all",
      label: "手数卡到 1 手",
      maxPlies: 1,
      timeoutIsLoss: true,
      seed: plan.seed,
      onEnd: (r) => ends.push(r),
    });
    const first = solveLevel(0)![0];
    clickMove(first.from, first.to);
    await waitFor(() => ends.length > 0);
    expect(ends, "手数用完了却没收场").toHaveLength(1);
    expect(ends[0].won).toBe(false);
    expect(ends[0].draw).toBe(false);
    expect(ends[0].why).toBe(LOSE_LINE);
    for (const bad of ["笨", "蠢", "废", "太差", "活该", "死", "输惨"]) {
      expect(ends[0].why.includes(bad), `失败文案里出现了「${bad}」`).toBe(false);
    }
  });

  it("四个玩法进去再退出来，来回两遍都还是好的", () => {
    const handle = mount(fakeApi().api);
    const entries = ["闯关 188", "人机对战", "无尽连胜", "双人同屏"];
    for (let round = 0; round < 2; round++) {
      for (const label of entries) {
        tap(label);
        const hasBoard = cellsOnScreen().length === CELLS;
        const hasMap = dom.root.find((e) => e.className.includes("l99-map")) !== null;
        expect(hasBoard || hasMap, `第 ${round + 1} 遍点「${label}」没开出东西`).toBe(true);
        tap("换个玩法");
        expect(
          dom.root.findAll((e) => e.className.split(/\s+/).includes("jq-mode")),
          `第 ${round + 1} 遍从「${label}」退回来菜单不全`
        ).toHaveLength(4);
      }
    }
    handle.destroy();
    expect(dom.root.children, "退出没拆干净").toHaveLength(0);
    expect(windowListenerCount(dom), "退出还留着 window 监听").toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 2：战役第 1 / 100 / 188 关                              */
/* ------------------------------------------------------------------ */

describe("PA-JQ · 战役 1 / 100 / 188 关", () => {
  for (const human of [1, 100, 188]) {
    it(
      `第 ${human} 关在界面上点到结算，而且是真赢`,
      async () => {
        const level = human - 1;
        const { plan, state, ends } = campaignTable(level);
        expect(cellsOnScreen(), "棋盘没摆满 60 格").toHaveLength(CELLS);
        expect(
          dom.root.find((e) => e.textContent.includes(`第 ${human} 关`)),
          "顶上没写清楚这是第几关"
        ).not.toBeNull();
        expect(
          cellsOnScreen().some((c) => c.className.includes("jq-duo")),
          "鸭梨一枚能动的子都没有"
        ).toBe(true);
        await playSolution(level, state, ends);
        expect(ends, `第 ${human} 关走完参考解没收场`).toHaveLength(1);
        expect(ends[0].won, `第 ${human} 关扛回旗子了却没判赢`).toBe(true);
        expect(ends[0].duoMoves, `第 ${human} 关超了 ${plan.budget} 手`).toBeLessThanOrEqual(plan.budget);
      },
      30000
    );
  }

  it("三关的难度台阶对得上章节表：前面是守备队残局，第 188 关是地狱档实战", () => {
    const first = planFor(0);
    const mid = planFor(99);
    const last = planFor(187);
    expect(first.garrison).toBe(true);
    expect(mid.garrison).toBe(true);
    expect(last.garrison).toBe(false);
    expect(last.tier).toBe("hell");
    expect(last.hidden, "第 188 关应当是暗棋").toBe(true);
    expect(CHAPTERS[last.chapter].name).toBe("军旗杯");
    // 实战关要算上对面的手，所以上限是预算的两倍
    expect(maxPliesOf(last)).toBe(last.budget * 2);
    expect(maxPliesOf(first)).toBe(first.budget);
  });
});

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 3：双人同屏的两套键位                                    */
/* ------------------------------------------------------------------ */

describe("PA-JQ · 双人同屏键位", () => {
  it("鸭梨那套管用：WASD 挪光标、F 选子、G 取消", () => {
    const { table } = duelTable();
    expect(cursorAt(), "光标不在自己家门口").toBe(idx(9, 2));
    driveCursorTo(DUEL_START, ["w", "s", "a", "d"]);
    expect(cursorAt()).toBe(DUEL_START);
    key("f");
    expect(selectedAt(), "F 没选中鸭梨的连长").toBe(DUEL_START);
    key("g");
    expect(selectedAt(), "G 没把选中取消掉").toBe(-1);
    table.destroy();
  });

  it("两套键位各管各的光标：鸭梨回合里康康的方向键拨不走鸭梨的光标", () => {
    const { state, table } = duelTable();
    expect(state.turn).toBe("duo");
    const home = cursorAt();
    key("ArrowUp");
    key("ArrowUp");
    expect(cursorAt(), "康康的方向键把鸭梨的光标拨走了").toBe(home);
    key("w");
    expect(cursorAt(), "鸭梨自己的 W 反而不管用了").toBe(home - 5);
    key("s");
    expect(cursorAt()).toBe(home);
    table.destroy();
  });

  it("轮到康康时反过来也一样：鸭梨的 WASD 拨不走康康的光标", async () => {
    const { state, ends, table } = duelTable();
    clickMove(DUEL_START, DUEL_SIDESTEP);
    await waitFor(() => state.turn === "star");
    await sleep(120);
    expect(ends, "第一手就收场了，后面验不了").toHaveLength(0);

    const here = cursorAt();
    key("w");
    key("w");
    expect(cursorAt(), "鸭梨的 WASD 把康康的光标拨走了").toBe(here);
    key("ArrowDown");
    expect(cursorAt(), "康康自己的方向键不管用了").toBe(here + 5);
    table.destroy();
  });

  it("鸭梨回合里康康先挪好自己的光标，换手之后那一格还在", async () => {
    const { state, ends, table } = duelTable();
    // 鸭梨回合：康康先把自己的光标往下挪两格，鸭梨这边看不出任何变化
    const duoHome = cursorAt();
    key("ArrowDown");
    key("ArrowDown");
    expect(cursorAt(), "康康的方向键串到鸭梨的光标上了").toBe(duoHome);

    clickMove(DUEL_START, DUEL_SIDESTEP);
    await waitFor(() => state.turn === "star");
    await sleep(120);
    expect(ends, "第一手就收场了，后面验不了").toHaveLength(0);
    // 换手之后画面上换成康康那一个光标，刚才挪的两格记着
    expect(cursorAt(), "康康换手之后光标没接上刚才挪的两格").toBe(idx(4, 2));
    table.destroy();
  });

  it("康康那套 L / K 接上了：L 确认、K 取消，都只管康康自己", async () => {
    const { state, ends, table } = duelTable();
    clickMove(DUEL_START, DUEL_SIDESTEP);
    await waitFor(() => state.turn === "star");
    await sleep(120);
    expect(ends, "第一手就收场了，后面验不了").toHaveLength(0);

    driveCursorTo(STAR_START, ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    expect(cursorAt(), "方向键没把康康的光标挪到自己的连长上").toBe(STAR_START);
    key("f");
    expect(selectedAt(), "轮到康康，鸭梨的 F 却选中了子").toBe(-1);
    key("l");
    expect(selectedAt(), "L 没选中康康的连长").toBe(STAR_START);
    key("g");
    expect(selectedAt(), "轮到康康，鸭梨的 G 却取消掉了").toBe(STAR_START);
    key("k");
    expect(selectedAt(), "K 没把康康的选中取消掉").toBe(-1);
    table.destroy();
  });

  it("鸭梨回合里康康按 L / K 一概不生效", () => {
    const { state, table } = duelTable();
    expect(state.turn).toBe("duo");
    driveCursorTo(DUEL_START, ["w", "s", "a", "d"]);
    key("l");
    expect(selectedAt(), "康康的 L 替鸭梨选了子").toBe(-1);
    key("f");
    expect(selectedAt()).toBe(DUEL_START);
    key("k");
    expect(selectedAt(), "康康的 K 取消掉了鸭梨的选中").toBe(DUEL_START);
    key("g");
    expect(selectedAt()).toBe(-1);
    table.destroy();
  });

  it("两个人各走一手，康康扛回旗子就真收场", async () => {
    const { state, ends, table } = duelTable();
    clickMove(DUEL_START, DUEL_SIDESTEP);
    await waitFor(() => state.turn === "star");
    await sleep(120);
    expect(turnChipText()).toContain("康康");

    clickMove(STAR_START, DUO_FLAG);
    await waitFor(() => ends.length > 0);
    expect(ends, "旗子被扛走了却没收场").toHaveLength(1);
    // createTable 站在鸭梨这一边报结果：康康赢了就是 won=false、不是平局
    expect(ends[0].won).toBe(false);
    expect(ends[0].draw).toBe(false);
    expect(state.outcome?.winner).toBe("star");
    table.destroy();
  });

  it("单人局里两套键位都归鸭梨，方向键与 L / K 老路不断", () => {
    const state = duelState();
    const ends: TableResult[] = [];
    const table = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "garrison",
      tier: "rookie",
      viewer: "all",
      label: "单人 · 守备队",
      maxPlies: 400,
      timeoutIsLoss: false,
      seed: 61,
      onEnd: (r) => ends.push(r),
    });
    const home = cursorAt();
    key("ArrowUp");
    expect(cursorAt(), "单人局里方向键失灵了").toBe(home - 5);
    key("s");
    expect(cursorAt(), "单人局里 WASD 与方向键不是同一个光标").toBe(home);
    driveCursorTo(DUEL_START, ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    key("l");
    expect(selectedAt(), "单人局里 L 也该管用").toBe(DUEL_START);
    key("k");
    expect(selectedAt(), "单人局里 K 也该管用").toBe(-1);
    table.destroy();
  });

  it("Esc 能来回切，暂停时落子被挡住", async () => {
    const { state, table } = duelTable();
    key("Escape");
    expect(turnChipText()).toBe("已暂停");
    const before = state.plies;
    clickMove(DUEL_START, DUEL_SIDESTEP);
    await sleep(120);
    expect(state.plies, "暂停时还是把子走了").toBe(before);
    key("Escape");
    expect(turnChipText()).toContain("轮到鸭梨");
    clickMove(DUEL_START, DUEL_SIDESTEP);
    await waitFor(() => state.plies > before);
    expect(state.plies, "恢复之后走不动了").toBe(before + 1);
    table.destroy();
  });

  it("暂停时按确认既不落子，也不会把选好的落点丢掉", () => {
    const { state, table } = duelTable();
    const cs = cellsOnScreen();
    cs[DUEL_START].dispatch("click", {});
    cs[DUEL_SIDESTEP].dispatch("click", {});
    expect(cellsOnScreen()[DUEL_SIDESTEP].className, "没选出待确认的落点").toContain("jq-pending");
    key("Escape");
    tap("确认");
    expect(state.plies, "暂停时按确认真把子走了").toBe(0);
    expect(
      cellsOnScreen()[DUEL_SIDESTEP].className.includes("jq-pending"),
      "暂停时按确认把选好的落点丢掉了"
    ).toBe(true);
    expect(selectedAt(), "暂停时按确认连选中也一起丢了").toBe(DUEL_START);
    table.destroy();
  });

  it("暂停期间点格子、挪光标、取消键一概不接，恢复之后接着走那一步", async () => {
    const { state, table } = duelTable();
    const cs = cellsOnScreen();
    cs[DUEL_START].dispatch("click", {});
    cs[DUEL_SIDESTEP].dispatch("click", {});
    const cursorBefore = cursorAt();
    key("Escape");
    // 暂停期间的四种输入
    cellsOnScreen()[DUEL_START].dispatch("click", {});
    key("ArrowUp");
    key("w");
    key("g");
    expect(cursorAt(), "暂停期间光标被挪走了").toBe(cursorBefore);
    expect(selectedAt(), "暂停期间选中被拨掉了").toBe(DUEL_START);
    expect(cellsOnScreen()[DUEL_SIDESTEP].className, "暂停期间落点被拨掉了").toContain("jq-pending");
    expect(state.plies, "暂停期间把子走了").toBe(0);
    // 恢复之后原来那一步照样按得下去
    key("Escape");
    key("f");
    await waitFor(() => state.plies > 0);
    expect(state.plies, "恢复之后原来选好的那一步走不出去").toBe(1);
    table.destroy();
  });

  it("恢复之后取消键照旧管用，不会被暂停那道闸卡死", () => {
    const { table } = duelTable();
    const cs = cellsOnScreen();
    cs[DUEL_START].dispatch("click", {});
    key("Escape");
    key("g");
    expect(selectedAt(), "暂停期间取消键还生效").toBe(DUEL_START);
    key("Escape");
    key("g");
    expect(selectedAt(), "恢复之后取消键失灵了").toBe(-1);
    table.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* L3A-7 / L3A-8 · 暂停时看得出为什么点不动；工具钮读屏听得懂             */
/* ------------------------------------------------------------------ */

describe("L3A-7 · 暂停时确认 / 取消要看得出是停用的", () => {
  function toolBtn(text: string): El {
    const hit = dom.root.find((e) => e.tagName === "button" && e.textContent.includes(text));
    if (!hit) throw new Error(`工具条上找不到「${text}」`);
    return hit;
  }

  it("没暂停的时候两个钮是常态：不带 jq-off，aria-disabled 是 false", () => {
    const { table } = duelTable();
    for (const t of ["确认", "取消"]) {
      expect(toolBtn(t).className, `${t} 一开局就是灰的`).not.toContain("jq-off");
      expect(toolBtn(t).getAttribute("aria-disabled")).toBe("false");
    }
    table.destroy();
  });

  it("按下暂停两个钮一起变灰，恢复之后又亮回来", () => {
    const { table } = duelTable();
    key("Escape");
    for (const t of ["确认", "取消"]) {
      expect(toolBtn(t).className, `暂停了 ${t} 还是亮的`).toContain("jq-off");
      expect(toolBtn(t).getAttribute("aria-disabled"), `${t} 没告诉读屏它停用了`).toBe("true");
    }
    key("Escape");
    for (const t of ["确认", "取消"]) {
      expect(toolBtn(t).className, `恢复之后 ${t} 还灰着`).not.toContain("jq-off");
      expect(toolBtn(t).getAttribute("aria-disabled")).toBe("false");
    }
    table.destroy();
  });

  it("点屏幕上的暂停钮也一样，钮自己的 aria-pressed 跟着翻面", () => {
    const { table } = duelTable();
    const pause = toolBtn("暂停");
    expect(pause.getAttribute("aria-pressed")).toBe("false");
    pause.dispatch("click", {});
    expect(pause.getAttribute("aria-pressed")).toBe("true");
    expect(toolBtn("确认").className, "点钮暂停之后确认还是亮的").toContain("jq-off");
    toolBtn("继续").dispatch("click", {});
    expect(toolBtn("确认").className).not.toContain("jq-off");
    table.destroy();
  });

  it("变灰只是外观：暂停照旧不落子，恢复之后选好的那一步照样走得出去", async () => {
    const { state, table } = duelTable();
    const cs = cellsOnScreen();
    cs[DUEL_START].dispatch("click", {});
    cs[DUEL_SIDESTEP].dispatch("click", {});
    key("Escape");
    tap("确认");
    expect(state.plies, "变灰了却还是把子走了").toBe(0);
    expect(cellsOnScreen()[DUEL_SIDESTEP].className, "变灰的同时把落点也丢了").toContain("jq-pending");
    key("Escape");
    key("f");
    await waitFor(() => state.plies > 0);
    expect(state.plies, "恢复之后原来那一步走不出去").toBe(1);
    table.destroy();
  });

  it("L3A-8：缩放与回家三个钮都配了读屏说明，不再只念符号", () => {
    const { table } = duelTable();
    const labels = ["把棋盘缩小一点", "把棋盘放大一点", "把画面移回自己这半边"];
    for (const label of labels) {
      expect(
        dom.root.find((e) => e.getAttribute("aria-label") === label),
        `工具条上没有「${label}」这句读屏说明`
      ).not.toBeNull();
    }
    expect(toolBtn("➖").getAttribute("aria-label")).toBe("把棋盘缩小一点");
    expect(toolBtn("➕").getAttribute("aria-label")).toBe("把棋盘放大一点");
    table.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 4：360px 宽                                             */
/* ------------------------------------------------------------------ */

describe("PA-JQ · 360px 宽", () => {
  /** 没写 min-height 的按钮，用 padding×2 + 字号×1.2 估个可点高度 */
  function hitHeight(css: string, selector: string): number {
    const m = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(css);
    if (!m) return Number.NaN;
    const body = m[1];
    const min = /min-height:\s*([\d.]+)px/.exec(body);
    if (min) return Number(min[1]);
    const pad = /padding:\s*([\d.]+)px/.exec(body);
    const font = /font-size:\s*([\d.]+)px/.exec(body);
    if (!pad || !font) return Number.NaN;
    return Number(pad[1]) * 2 + Number(font[1]) * 1.2;
  }

  it("四个玩法入口、难度键、工具条按钮都够 44px", () => {
    const handle = mount(fakeApi().api);
    const style = dom.root.find((e) => e.tagName === "style");
    const css = style?.textContent ?? "";
    expect(css.length, "样式没注进来").toBeGreaterThan(100);
    expect(hitHeight(css, ".jq-mode"), "玩法入口够不到 44px").toBeGreaterThanOrEqual(44);
    expect(hitHeight(css, ".jq-pick"), "难度键够不到 44px").toBeGreaterThanOrEqual(44);
    expect(hitHeight(css, ".jq-btn"), "确认/取消/缩放键够不到 44px").toBeGreaterThanOrEqual(44);
    expect(BOARD_CSS, "格子没写最小点击尺寸").toContain("min-width:44px");
    handle.destroy();
  });

  it("360px 上不横向溢出：菜单每一块的宽度上限都塞得进去", () => {
    const handle = mount(fakeApi().api);
    const css = dom.root.find((e) => e.tagName === "style")?.textContent ?? "";
    // 外壳左右各 10px padding，能用的净宽是 340
    const usable = 360 - 10 * 2;
    for (const m of css.matchAll(/max-width:(\d+)px/g)) {
      const w = Number(m[1]);
      // 420 那两处是「够宽就长到 420」的上限，窄屏下由 width:100% 兜着，不算溢出
      if (w > usable) expect(w, `max-width:${w}px 需要 width:100% 兜底`).toBe(420);
    }
    expect(css).toContain("minmax(140px,1fr)");
    // 340 的净宽正好排得下两列 140，不会被挤成横向滚动
    expect(Math.floor(usable / 140)).toBeGreaterThanOrEqual(2);
    handle.destroy();
  });

  it("窄屏进对战照样点得动：棋盘 60 格都在，工具条也在", () => {
    const handle = mount(fakeApi().api);
    tap("人机对战");
    expect(cellsOnScreen()).toHaveLength(CELLS);
    expect(dom.root.find((e) => e.textContent.includes("确认")), "工具条没了").not.toBeNull();
    expect(dom.root.find((e) => e.textContent.includes("回自己这边")), "回家键没了").not.toBeNull();
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 5：meta 与实现对不对得上                                 */
/* ------------------------------------------------------------------ */

describe("PA-JQ · meta 与实现", () => {
  it("meta.modes 四种玩法，菜单上就有四个入口，一一对得上", () => {
    const handle = mount(fakeApi().api);
    const labels = dom.root
      .findAll((e) => e.className.split(/\s+/).includes("jq-mode"))
      .map((e) => e.textContent);
    expect(labels).toHaveLength(meta.modes.length);
    const wants: Record<string, string> = {
      campaign: "闯关 188",
      versus: "人机对战",
      endless: "无尽连胜",
      twoPlayer: "双人同屏",
    };
    for (const mode of meta.modes) {
      expect(labels.some((l) => l.includes(wants[mode])), `menu 上找不到 ${mode} 的入口`).toBe(true);
    }
    handle.destroy();
  });

  it("meta.levels 与章节表加起来一致，界面上写的也是 188", () => {
    expect(CHAPTERS.reduce((a, c) => a + c.size, 0)).toBe(meta.levels);
    const handle = mount(fakeApi().api);
    expect(
      dom.root.find((e) => e.textContent.includes("闯关 188")),
      "菜单上没写 188"
    ).not.toBeNull();
    handle.destroy();
  });

  it("blurb 里承诺的四件事，实现里都找得到", () => {
    expect(meta.blurb).toContain("铁路");
    expect(meta.blurb).toContain("工兵");
    expect(meta.blurb).toContain("炸弹");
    expect(meta.blurb).toContain("旗");
    expect(BOARD_CSS, "棋盘上没画铁路").toContain("jq-rail");
    const guideText = [...GUIDE.general, ...GUIDE.entries.flatMap((e) => e.tips)].join("");
    expect(guideText).toContain("工兵");
    expect(guideText).toContain("炸弹");
    expect(CHAPTERS.map((c) => c.name)).toContain("工兵排雷");
    expect(CHAPTERS.map((c) => c.name)).toContain("炸弹同尽");
  });

  it("platform=both 站得住：指针和键盘两条路都接了", () => {
    expect(meta.platform).toBe("both");
    const { state, table } = duelTable();
    // 键盘这条路
    key("w");
    expect(cursorAt()).toBe(idx(8, 2));
    // 指针这条路
    cellsOnScreen()[DUEL_START].dispatch("click", {});
    expect(selectedAt()).toBe(DUEL_START);
    expect(state.plies).toBe(0);
    table.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 6：destroy 之后什么都不剩                                */
/* ------------------------------------------------------------------ */

describe("PA-JQ · destroy 之后", () => {
  it("拆掉棋盘之后 AI 的 setTimeout 不再回来落子", async () => {
    // 轮到康康，AI 已经排上 560ms 之后的那一手
    const state = duelState();
    state.turn = "star";
    const ends: TableResult[] = [];
    const table = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "ai",
      tier: "rookie",
      viewer: "duo",
      label: "对战 · 拆了之后",
      maxPlies: 400,
      timeoutIsLoss: false,
      seed: 4401,
      onEnd: (r) => ends.push(r),
    });
    table.destroy();
    await sleep(900);
    expect(state.plies, "拆了之后 AI 还偷偷走了一手").toBe(0);
    expect(ends, "拆了之后还回调了结算").toHaveLength(0);
    expect(dom.root.children, "棋盘没从页面上摘掉").toHaveLength(0);
    expect(windowListenerCount(dom), "keydown 监听没摘").toBe(0);
  });

  it("拆掉之后键盘再敲也没人接", () => {
    const { state, table } = duelTable();
    table.destroy();
    key("w");
    key("f");
    key("Escape");
    expect(state.plies).toBe(0);
    expect(cellsOnScreen(), "格子还留在页面上").toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("整款 mount 之后拆掉：样式跟着走，document.head 不留东西", () => {
    const handle = mount(fakeApi().api);
    // 样式是挂在自己的 wrap 里的，不是塞进 document.head
    expect(dom.root.find((e) => e.tagName === "style"), "样式没注进来").not.toBeNull();
    expect(dom.head.children, "往 document.head 里塞东西了").toHaveLength(0);
    handle.destroy();
    expect(dom.root.find((e) => e.tagName === "style"), "拆完样式还在").toBeNull();
    expect(dom.head.children).toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* PA-JQ · 铁则 7：界面上跑出来的文案                                    */
/* ------------------------------------------------------------------ */

describe("PA-JQ · 屏幕上的文案", () => {
  const BANNED = [
    "四国军棋",
    "三国杀",
    "斗地主",
    "天天象棋",
    "腾讯",
    "网易",
    "qq游戏",
    "jj",
    "俄罗斯方块",
    "tetris",
    "2048",
    "我的世界",
    "minecraft",
    "pac-man",
    "pacman",
    "吃豆人",
    "任天堂",
    "nintendo",
    "sony",
    "sega",
    "blizzard",
    "王者荣耀",
    "和平精英",
    "原神",
  ];
  const UGLY = ["血", "死", "尸", "杀", "阵亡", "击毙", "残杀", "干掉", "笨", "蠢", "废物"];

  function screenText(): string[] {
    const out: string[] = [];
    dom.root.findAll(() => true).forEach((e) => {
      const t = e.textContent.trim();
      if (t.length > 0) out.push(t);
    });
    return out;
  }

  it("菜单、棋盘、提示条上的字，一个商标都不沾", () => {
    const handle = mount(fakeApi().api);
    const menu = screenText();
    tap("双人同屏");
    const board = screenText();
    handle.destroy();
    for (const line of [...menu, ...board]) {
      const low = line.toLowerCase();
      for (const w of BANNED) {
        expect(low.includes(w.toLowerCase()), `「${w}」出现在屏幕上：${line}`).toBe(false);
      }
    }
  });

  it("菜单、棋盘、提示条上的字，不写血也不写死", () => {
    const handle = mount(fakeApi().api);
    const menu = screenText();
    tap("人机对战");
    const board = screenText();
    handle.destroy();
    for (const line of [...menu, ...board]) {
      for (const w of UGLY) {
        expect(line.includes(w), `「${w}」出现在屏幕上：${line}`).toBe(false);
      }
    }
  });

  it("对撞之后棋子是「回营休息」，不是别的说法", async () => {
    const { state, table } = duelTable();
    clickMove(DUEL_START, STAR_FLAG);
    await waitFor(() => state.outcome !== null);
    const note = dom.root.find((e) => e.className === "jq-note")?.textContent ?? "";
    for (const w of UGLY) expect(note.includes(w), `对撞播报里出现了「${w}」：${note}`).toBe(false);
    expect(GUIDE.general.join("")).toContain("回营休息");
    table.destroy();
  });
});
