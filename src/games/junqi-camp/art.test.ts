/**
 * 军旗对决 · 1.3 视觉契约用例（只增不减，旧测试一条不动）。
 *
 * 守六件事：
 *  1. 军衔条：12 种兵种各有一条、互不相同，星 / 杠 / 点数得出来（不认字也能比大小）；
 *  2. 牌背：盖着的子是统一 SVG 牌背，红蓝双方完全一致——暗棋信息一丝不漏是红线；
 *  3. 地形：行营帐篷、大本营碉堡、小山、铁轨（双钢轨 + 枕木）全是绘制资产，emoji 清零；
 *  4. 读屏：aria-label（describe）的文案与视觉升级前一字不差；
 *  5. 对撞演出：扑一步 → 摇两下 → 金光 / 烟云 / 升旗，收尾特效节点全部清干净；
 *     reduced-motion 下一个特效节点都不冒，直接翻面淡出；
 *  6. 360px：44px 热区与最小字号红线不动摇，缩到最小军衔条自动收起只留汉字。
 *
 * `createTable` 必须走顶部静态 import（level99 → dialogs → audio 那条链要在装 DOM 桩之前求值完）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allRankBadges,
  backSVG,
  crestSVG,
  hoistSVG,
  hqSVG,
  mountainSVG,
  rankBadgeSVG,
  smokeSVG,
  tentSVG,
} from "./art";
import { CAMP, CELLS, HQ, idx, type Pos } from "./board";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { createTable, type TableResult } from "./index";
import { KINDS, makeState, type Cell, type GameState, type Kind, type Side } from "./rules";
import { newGame } from "./setup";
import {
  ANIM,
  ANIM_FAST,
  CSS as BOARD_CSS,
  MIN_SCALE,
  TINY_SCALE,
  createBoard,
  faceHTML,
  type BoardHandle,
} from "./view";

let dom: Dom | null = null;

afterEach(() => {
  vi.useRealTimers();
  if (dom) restoreDom();
  dom = null;
});

function setup(width = 360, reduce = true): Dom {
  dom = installDom(width, reduce);
  return dom;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, ms = 4000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pred()) return true;
    await sleep(15);
  }
  return pred();
}

function cellsOnScreen(d: Dom): El[] {
  return d.root.findAll((e) => e.className.split(/\s+/).includes("jq-cell"));
}

function faceOf(d: Dom, p: Pos): El {
  return cellsOnScreen(d)[p].children[0];
}

function fxOnScreen(d: Dom, cls: string): El[] {
  return d.root.findAll((e) => e.className.split(/\s+/).includes(cls));
}

function put(cells: Cell[], at: Pos, side: Side, kind: Kind, id: number): void {
  cells[at] = { id, side, kind };
}

/** 一副能撞得起来的小残局：朵朵连长贴着星星排长，双方旗都在家 */
function skirmishState(): GameState {
  const cells = new Array<Cell>(CELLS).fill(null);
  put(cells, idx(6, 0), "duo", "lianzhang", 1);
  put(cells, idx(11, 1), "duo", "junqi", 2);
  put(cells, idx(6, 1), "star", "paizhang", 3);
  put(cells, idx(0, 1), "star", "junqi", 4);
  return makeState(cells, { turn: "duo" });
}

function mountBoard(state: GameState, viewer: Side | "all"): BoardHandle {
  return createBoard((dom as Dom).root as unknown as HTMLElement, {
    state,
    humans: ["duo"],
    viewer,
    onMove: () => undefined,
    onNote: () => undefined,
  });
}

/* ------------------------------------------------------------------ */
/* 军衔条：不认字的孩子也能比大小                                        */
/* ------------------------------------------------------------------ */

describe("视觉契约 · 军衔条 rankBadgeSVG", () => {
  it("十二种兵种军衔条非空、都是 SVG、互不相同", () => {
    const badges = allRankBadges();
    expect(Object.keys(badges)).toHaveLength(12);
    for (const k of KINDS) {
      expect(badges[k].length, `${k} 的军衔条是空的`).toBeGreaterThan(0);
      expect(badges[k], `${k} 的军衔条不是 SVG`).toContain("<svg");
    }
    expect(new Set(Object.values(badges)).size, "有两个兵种的军衔条长一样").toBe(12);
  });

  it("星 / 杠 / 点数得出来：司令 3 星、军长 2 星、师长 1 星，旅团营 3/2/1 杠，连 2 点排 1 点", () => {
    const count = (s: string, token: string): number => s.split(token).length - 1;
    expect(count(rankBadgeSVG("siling"), "<polygon")).toBe(3);
    expect(count(rankBadgeSVG("junzhang"), "<polygon")).toBe(2);
    expect(count(rankBadgeSVG("shizhang"), "<polygon")).toBe(1);
    expect(count(rankBadgeSVG("lvzhang"), "<rect")).toBe(3);
    expect(count(rankBadgeSVG("tuanzhang"), "<rect")).toBe(2);
    expect(count(rankBadgeSVG("yingzhang"), "<rect")).toBe(1);
    expect(count(rankBadgeSVG("lianzhang"), "<circle")).toBe(2);
    expect(count(rankBadgeSVG("paizhang"), "<circle")).toBe(1);
  });

  it("棋子面板三层齐全：军衔条在上、汉字在下，汉字一个不丢", () => {
    for (const k of KINDS) {
      const html = faceHTML(idx(6, 0), k, { id: 1, side: "duo", kind: k });
      expect(html).toContain("jq-rank");
      expect(html).toContain(rankBadgeSVG(k));
      expect(html).toContain("jq-han");
    }
    expect(faceHTML(idx(6, 0), "siling", { id: 1, side: "duo", kind: "siling" })).toContain("司令");
    expect(faceHTML(idx(6, 0), "gongbing", { id: 1, side: "star", kind: "gongbing" })).toContain("工兵");
  });
});

/* ------------------------------------------------------------------ */
/* 牌背与地形：emoji 清零，暗棋不泄密                                    */
/* ------------------------------------------------------------------ */

describe("视觉契约 · 牌背与地形", () => {
  it("盖着的子是 SVG 牌背，红蓝双方完全一致（不泄露）", () => {
    const back = backSVG();
    expect(back).toContain("<svg");
    expect(back).toContain("polygon"); // 五角星压纹
    // faceHTML 对任何一方的盖子都返回同一张牌背
    expect(faceHTML(idx(3, 0), null, { id: 1, side: "duo", kind: "siling" })).toBe(back);
    expect(faceHTML(idx(8, 4), null, { id: 2, side: "star", kind: "gongbing" })).toBe(back);

    // 棋盘级复核：朵朵视角看星星、星星视角看朵朵，两边的牌背 HTML 一字不差
    const d = setup(360, true);
    const seen = new Set<string>();
    for (const viewer of ["duo", "star"] as const) {
      const handle = mountBoard(newGame(11), viewer);
      const backs = cellsOnScreen(d).filter((c) => c.className.split(/\s+/).includes("jq-back"));
      expect(backs, `${viewer} 视角该有 25 张牌背`).toHaveLength(25);
      for (const c of backs) seen.add(c.children[0].innerHTML);
      handle.destroy();
    }
    expect(seen.size, "两边的牌背长得不一样，暗棋信息泄露了").toBe(1);
    expect([...seen][0]).toBe(back);
  });

  it("行营是帐篷、大本营是碉堡（SVG），双方碉堡只差旗色", () => {
    const d = setup(360, true);
    const handle = mountBoard(makeState(new Array<Cell>(CELLS).fill(null)), "all");
    for (const p of [...CAMP.duo, ...CAMP.star]) {
      expect(faceOf(d, p).innerHTML, `行营 ${p} 不是帐篷`).toBe(tentSVG());
    }
    for (const p of HQ.duo) expect(faceOf(d, p).innerHTML, `大本营 ${p} 不是碉堡`).toBe(hqSVG("duo"));
    for (const p of HQ.star) expect(faceOf(d, p).innerHTML, `大本营 ${p} 不是碉堡`).toBe(hqSVG("star"));
    expect(hqSVG("duo")).not.toBe(hqSVG("star"));
    handle.destroy();
  });

  it("棋盘上 emoji 占位清零：🎖️ / ⛺ / 🏠 / ⛰️ 一个都不剩", () => {
    const d = setup(360, true);
    const handle = mountBoard(newGame(7), "duo");
    // 扫棋盘子树（格子、地形、连线都在里面）；工具条按钮文字是另一回事，旧测试还点名要 ➖ ➕
    const board = d.root.find((e) => e.className.split(/\s+/).includes("jq-board")) as El;
    expect(board).not.toBeNull();
    for (const e of board.findAll(() => true)) {
      for (const emoji of ["🎖", "⛺", "🏠", "⛰"]) {
        expect(e.textContent.includes(emoji), `文本里还有 ${emoji}`).toBe(false);
        expect(e.innerHTML.includes(emoji), `HTML 里还有 ${emoji}`).toBe(false);
      }
    }
    const hills = fxOnScreen(d, "jq-mountain");
    expect(hills).toHaveLength(2);
    for (const h of hills) expect(h.innerHTML).toContain("<svg");
    expect(mountainSVG()).toContain("<svg");
    handle.destroy();
  });

  it("aria-label（describe）文案与视觉升级前一字不差", () => {
    const d = setup(360, true);
    const handle = mountBoard(skirmishState(), "duo");
    const cells = cellsOnScreen(d);
    expect(cells[idx(11, 1)].getAttribute("aria-label")).toBe("第 12 行第 2 列，大本营，朵朵的军旗");
    expect(cells[idx(6, 1)].getAttribute("aria-label")).toBe("第 7 行第 2 列，星星的盖着的子");
    expect(cells[idx(9, 1)].getAttribute("aria-label")).toBe("第 10 行第 2 列，行营，空格");
    expect(cells[idx(4, 2)].getAttribute("aria-label")).toBe("第 5 行第 3 列，空格");
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* 铁轨与沙盘氛围                                                       */
/* ------------------------------------------------------------------ */

describe("视觉契约 · 铁轨与沙盘", () => {
  it("铁路线是真铁轨：双钢轨 + 枕木，横竖两个方向都有", () => {
    expect(BOARD_CSS).toContain(".jq-line.jq-rail");
    expect(BOARD_CSS).toContain("repeating-linear-gradient");
    expect(BOARD_CSS).toContain(".jq-line.jq-rail.jq-vline");
    const d = setup(360, true);
    const handle = mountBoard(makeState(new Array<Cell>(CELLS).fill(null)), "all");
    const rails = d.root.findAll((e) => e.className.split(/\s+/).includes("jq-rail"));
    expect(rails.length).toBeGreaterThan(0);
    expect(rails.some((e) => e.className.split(/\s+/).includes("jq-vline")), "竖向铁轨没换枕木方向").toBe(true);
    expect(rails.some((e) => !e.className.split(/\s+/).includes("jq-vline")), "横向铁轨丢了").toBe(true);
    handle.destroy();
  });

  it("上下半场叠了极淡的等高线纹，主底色不变", () => {
    expect(BOARD_CSS).toContain("radial-gradient(circle at");
    expect(BOARD_CSS).toContain("#E9F1FB");
    expect(BOARD_CSS).toContain("#FBF0E7");
  });

  it("360px 红线不动摇：44px 热区、12px 底线字号、行营圆大本营方都还在", () => {
    expect(BOARD_CSS).toContain("min-width:44px");
    expect(BOARD_CSS).toContain("min-height:44px");
    expect(BOARD_CSS).toContain(".jq-cell.jq-camp .jq-face{border-radius:50%;}");
    expect(BOARD_CSS).toContain(".jq-cell.jq-hq .jq-face");
    expect(BOARD_CSS).toContain("prefers-reduced-motion");
    expect(TINY_SCALE).toBeGreaterThan(MIN_SCALE);
  });

  it("缩到最小态军衔条自动收起（jq-tiny），放大又回来", () => {
    expect(BOARD_CSS).toContain(".jq-tiny .jq-rank{display:none;}");
    const d = setup(360, true);
    const handle = mountBoard(newGame(3), "all");
    const stage = (): El => d.root.find((e) => e.className.split(/\s+/).includes("jq-stage")) as El;
    expect(stage().className).not.toContain("jq-tiny");
    handle.zoom(-0.15);
    handle.zoom(-0.15);
    expect(handle.scale()).toBe(MIN_SCALE);
    expect(stage().className, "缩到最小没收起军衔条").toContain("jq-tiny");
    handle.zoom(0.3);
    expect(stage().className, "放大之后军衔条没回来").not.toContain("jq-tiny");
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* 对撞演出：碰撞后退场，特效节点用完就清                                */
/* ------------------------------------------------------------------ */

describe("视觉契约 · 对撞演出", () => {
  const MOVE = { from: idx(6, 0), to: idx(6, 1) };

  function cleanupCheck(d: Dom): void {
    expect(fxOnScreen(d, "jq-fx"), "动画收尾特效节点没清干净").toHaveLength(0);
    for (const bad of ["jq-lunge", "jq-shake", "jq-winner", "jq-gone", "jq-open", "jq-hide"]) {
      expect(
        d.root.find((e) => e.className.includes(bad)),
        `动画收尾 ${bad} 类还挂在格子上`
      ).toBeNull();
    }
  }

  it("吃子对撞：攻方扑一步 → 输方摇两下 → 赢方金光、输方淡出，收尾全清", () => {
    vi.useFakeTimers();
    const d = setup(800, false);
    const state = skirmishState();
    const before = state.cells.slice();
    const handle = mountBoard(state, "all");
    let doneCount = 0;
    handle.animateMove(
      before,
      MOVE,
      { ...MOVE, attacker: "lianzhang", defender: "paizhang", outcome: "attacker" },
      () => (doneCount += 1)
    );
    // 第一段：两子翻开，攻方向右扑
    expect(cellsOnScreen(d)[MOVE.from].className).toContain("jq-open");
    expect(cellsOnScreen(d)[MOVE.from].className).toContain("jq-lunge-r");
    expect(cellsOnScreen(d)[MOVE.to].className).toContain("jq-open");
    vi.advanceTimersByTime(ANIM.flip);
    // 第二段：要回营的排长左右摇，扑的姿势收回
    expect(cellsOnScreen(d)[MOVE.to].className).toContain("jq-shake");
    expect(cellsOnScreen(d)[MOVE.from].className).not.toContain("jq-lunge-r");
    vi.advanceTimersByTime(ANIM.hold);
    // 第三段：排长淡出回营，连长亮金光
    expect(cellsOnScreen(d)[MOVE.to].className).toContain("jq-gone");
    expect(cellsOnScreen(d)[MOVE.from].className).toContain("jq-winner");
    vi.advanceTimersByTime(ANIM.fade);
    expect(doneCount).toBe(1);
    cleanupCheck(d);
    handle.destroy();
  });

  it("炸弹同尽：落点升起一朵卡通烟云（圆云 + 小星星），动画完清场", () => {
    vi.useFakeTimers();
    const d = setup(800, false);
    const state = skirmishState();
    const before = state.cells.slice();
    const handle = mountBoard(state, "all");
    let doneCount = 0;
    handle.animateMove(
      before,
      MOVE,
      { ...MOVE, attacker: "zhadan", defender: "paizhang", outcome: "both" },
      () => (doneCount += 1)
    );
    vi.advanceTimersByTime(ANIM.flip + ANIM.hold);
    const smoke = fxOnScreen(d, "jq-smoke");
    expect(smoke, "同尽没升烟云").toHaveLength(1);
    expect(smoke[0].innerHTML).toContain("<svg");
    expect(smokeSVG()).toContain("circle"); // 圆滚滚的云朵，不是写实表现
    expect(cellsOnScreen(d)[MOVE.from].className).toContain("jq-gone");
    expect(cellsOnScreen(d)[MOVE.to].className).toContain("jq-gone");
    vi.advanceTimersByTime(ANIM.fade);
    expect(doneCount).toBe(1);
    cleanupCheck(d);
    handle.destroy();
  });

  it("扛旗成功升起小旗，旗色跟着扛旗的一方；杆子用完就撤", () => {
    vi.useFakeTimers();
    const d = setup(800, false);
    const state = skirmishState();
    const before = state.cells.slice();
    const handle = mountBoard(state, "all");
    handle.animateMove(
      before,
      MOVE,
      { ...MOVE, attacker: "lianzhang", defender: "junqi", outcome: "attacker", flagTaken: true },
      () => undefined
    );
    const hoist = fxOnScreen(d, "jq-hoist");
    expect(hoist, "扛旗没升旗").toHaveLength(1);
    expect(hoist[0].innerHTML).toContain("fx-flag");
    expect(hoist[0].innerHTML).toBe(hoistSVG("duo"));
    expect(hoistSVG("duo")).not.toBe(hoistSVG("star"));
    vi.advanceTimersByTime(ANIM.flip + ANIM.hold + ANIM.fade);
    cleanupCheck(d);
    handle.destroy();
  });

  it("平移走子有滑动克隆：起点先藏住，克隆滑到落点，收尾清掉", () => {
    vi.useFakeTimers();
    const d = setup(800, false);
    const state = skirmishState();
    const before = state.cells.slice();
    const slide = { from: idx(6, 0), to: idx(7, 0) };
    const handle = mountBoard(state, "all");
    let doneCount = 0;
    handle.animateMove(before, slide, null, () => (doneCount += 1));
    const ghost = fxOnScreen(d, "jq-glide");
    expect(ghost, "平移没生成滑动克隆").toHaveLength(1);
    expect(ghost[0].className).toContain("jq-duo");
    expect(ghost[0].innerHTML).toContain("连长");
    expect(cellsOnScreen(d)[slide.from].className, "起点的真棋子没藏住").toContain("jq-hide");
    vi.advanceTimersByTime(16);
    expect(ghost[0].style.top, "克隆没往落点滑").toBe(`${(7 * 100) / 12}%`);
    vi.advanceTimersByTime(ANIM.fade);
    expect(doneCount).toBe(1);
    cleanupCheck(d);
    handle.destroy();
  });

  it("reduced-motion：对撞直接翻面淡出，特效节点一个都不冒", () => {
    vi.useFakeTimers();
    const d = setup(360, true);
    const state = skirmishState();
    const before = state.cells.slice();
    const handle = mountBoard(state, "all");
    let doneCount = 0;
    handle.animateMove(
      before,
      MOVE,
      { ...MOVE, attacker: "zhadan", defender: "paizhang", outcome: "both", flagTaken: false },
      () => (doneCount += 1)
    );
    expect(fxOnScreen(d, "jq-fx")).toHaveLength(0);
    expect(cellsOnScreen(d)[MOVE.from].className).not.toContain("jq-lunge");
    vi.advanceTimersByTime(ANIM_FAST.flip);
    expect(cellsOnScreen(d)[MOVE.to].className).not.toContain("jq-shake");
    vi.advanceTimersByTime(ANIM_FAST.hold);
    expect(fxOnScreen(d, "jq-fx"), "reduced 下还是冒了烟云").toHaveLength(0);
    expect(cellsOnScreen(d)[MOVE.from].className).not.toContain("jq-winner");
    expect(cellsOnScreen(d)[MOVE.to].className, "reduced 下也要直接淡出").toContain("jq-gone");
    vi.advanceTimersByTime(ANIM_FAST.fade);
    expect(doneCount).toBe(1);
    cleanupCheck(d);
    handle.destroy();
  });

  it("reduced-motion：平移走子不生成滑动克隆，直接换面", () => {
    vi.useFakeTimers();
    const d = setup(360, true);
    const state = skirmishState();
    const before = state.cells.slice();
    const handle = mountBoard(state, "all");
    let doneCount = 0;
    handle.animateMove(before, { from: idx(6, 0), to: idx(7, 0) }, null, () => (doneCount += 1));
    expect(fxOnScreen(d, "jq-glide")).toHaveLength(0);
    expect(d.root.find((e) => e.className.includes("jq-hide"))).toBeNull();
    vi.advanceTimersByTime(Math.max(30, ANIM_FAST.fade));
    expect(doneCount).toBe(1);
    cleanupCheck(d);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* HUD：双方军旗徽标 + 剩余棋子数                                        */
/* ------------------------------------------------------------------ */

describe("视觉契约 · HUD 军旗徽标", () => {
  it("顶部有双方小军旗与剩余棋子数，吃子之后数字跟着掉", async () => {
    const d = setup(360, true);
    const state = skirmishState();
    const ends: TableResult[] = [];
    const table = createTable(d.root as unknown as HTMLElement, {
      state,
      rival: "human",
      tier: "normal",
      viewer: "all",
      label: "视觉契约",
      maxPlies: 400,
      timeoutIsLoss: false,
      seed: 7,
      onEnd: (r) => ends.push(r),
    });
    const crests = d.root.findAll((e) => e.className.split(/\s+/).includes("jq-crest"));
    expect(crests, "顶上该有双方各一枚军旗徽标").toHaveLength(2);
    for (const c of crests) {
      expect(c.innerHTML).toContain("<svg");
      expect(c.innerHTML).toContain("<b>2</b>");
    }
    expect(crests[0].getAttribute("aria-label")).toBe("朵朵还有 2 枚棋子");
    expect(crests[1].getAttribute("aria-label")).toBe("星星还有 2 枚棋子");
    // 连长吃掉排长：星星那枚徽标的数字从 2 掉到 1
    const cells = cellsOnScreen(d);
    cells[idx(6, 0)].dispatch("click", {});
    cells[idx(6, 1)].dispatch("click", {});
    cells[idx(6, 1)].dispatch("click", {});
    await waitFor(() => crests[1].innerHTML.includes("<b>1</b>"));
    expect(crests[1].innerHTML, "吃子之后星星的剩余数没掉").toContain("<b>1</b>");
    expect(crests[0].innerHTML).toContain("<b>2</b>");
    table.destroy();
  });

  it("双方徽标形状同款、旗色不同（色弱下还有数字兜底）", () => {
    expect(crestSVG("duo")).toContain("<svg");
    expect(crestSVG("star")).toContain("<svg");
    expect(crestSVG("duo")).not.toBe(crestSVG("star"));
  });
});
