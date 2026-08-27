/**
 * 翻翻暗棋 · 1.3 视觉契约（只增不减，旧测试一例不动）。
 *
 * 守住四条线：
 *  1. 信息红线——红蓝双方翻开前的牌背完全一致（除木纹相位），一个兵种字都不许漏；
 *  2. 教学红线——14 张棋面两两不同，战力点数与 `RANK` 一字不差；
 *  3. 时序红线——`animate()` 的 done 回调还是 flip 200ms / capture 180ms / 弱动效 80ms，
 *     两面翻转与花瓣只是画面，外面的串行逻辑一毫秒都感觉不到差别；
 *  4. 无障碍红线——格子 aria-label 文案不变，counterLine 全文进读屏，弱动效降级覆盖到全部新动画。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KINDS, RANK, indexOf, labelOf, type Cell, type Color, type Kind } from "./board";
import { FACTION, backSVG, miniPieceSVG, petalSVG, pieceFaceSVG } from "./art";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { createTable } from "./index";
import { applyAction, makeState, newGame, type GameState } from "./rules";
import { CSS as BOARD_CSS, counterIconsHTML, counterLine, createBoard, type BoardHandle } from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
  delete (globalThis as { matchMedia?: unknown }).matchMedia;
  vi.useRealTimers();
});

/** 视图只认 globalThis.matchMedia，这里按测试需要装一个「弱动效已开」的桩 */
function forceReduced(): void {
  (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
}

function blank(): Cell[] {
  return new Array(32).fill(null);
}

function place(cells: Cell[], r: number, c: number, color: Color, kind: Kind, covered = false): number {
  const i = indexOf(r, c);
  cells[i] = { color, kind, covered };
  return i;
}

function mountBoard(state: GameState, showCounter = false): BoardHandle {
  return createBoard(dom.root as unknown as HTMLElement, {
    state,
    humans: ["duo", "star"],
    showCounter,
    onHumanAction: () => undefined,
    onNote: () => undefined,
  });
}

function cellEls(): El[] {
  return dom.root.findAll((e) => e.className.includes("dc-cell"));
}

/** 抹掉木纹相位（class="dcg" 两条 path 的 d），剩下的字节应当逐格相同 */
function stripGrain(svg: string): string {
  return svg.replace(/<path class="dcg" d="[^"]*"/g, '<path class="dcg"');
}

describe("牌背 · 信息红线", () => {
  it("盖着的格子渲染层是 SVG 牌背带「暗」字印章，不再是 emoji", () => {
    const board = mountBoard(newGame(31));
    const b = cellEls()[0];
    expect(b.innerHTML).toContain("<svg");
    expect(b.innerHTML).toContain("暗");
    expect(b.innerHTML).not.toContain("🌸");
    // r3 起格子文字口径统一走 aria-label（读屏正文兼测试契约）；
    // 真实 DOM 里总被 innerHTML 抹掉的 textContent 降级桩已清理，桩层恒空
    expect(b.getAttribute("aria-label")).toContain("还盖着");
    expect(b.textContent).toBe("");
    board.destroy();
  });

  it("32 张牌背除木纹相位外结构完全一致，而相位真的在变", () => {
    const norm = stripGrain(backSVG(0));
    const raws = new Set<string>();
    for (let i = 0; i < 32; i++) {
      expect(stripGrain(backSVG(i))).toBe(norm);
      raws.add(backSVG(i));
    }
    expect(raws.size).toBeGreaterThan(1);
  });

  it("红蓝双方翻开前的牌背无差异，也不夹带任何兵种与阵营信息", () => {
    const state = newGame(31);
    const board = mountBoard(state);
    const redAt = state.cells.findIndex((c) => c !== null && c.covered && c.color === "red");
    const blueAt = state.cells.findIndex((c) => c !== null && c.covered && c.color === "blue");
    const els = cellEls();
    expect(stripGrain(els[redAt].innerHTML)).toBe(stripGrain(els[blueAt].innerHTML));
    const back = backSVG(0);
    for (const color of ["red", "blue"] as Color[]) {
      for (const kind of KINDS) expect(back).not.toContain(labelOf(color, kind));
      expect(back).not.toContain(FACTION[color].ring);
    }
    board.destroy();
  });
});

describe("棋面 · 图形化兵种", () => {
  it("2 色 × 7 兵种共 14 张棋面两两不同", () => {
    const all: string[] = [];
    for (const color of ["red", "blue"] as Color[]) {
      for (const kind of KINDS) all.push(pieceFaceSVG(color, kind));
    }
    expect(new Set(all).size).toBe(14);
  });

  it("战力点数与 RANK 一字不差：帅 7 点一路数到兵 1 点", () => {
    for (const color of ["red", "blue"] as Color[]) {
      for (const kind of KINDS) {
        const dots = (pieceFaceSVG(color, kind).match(/class="dcp"/g) ?? []).length;
        expect(dots, `${color} ${kind} 的点数`).toBe(RANK[kind]);
      }
    }
  });

  it("炮有隔子吃的虚线小弧，其他兵种没有", () => {
    for (const color of ["red", "blue"] as Color[]) {
      for (const kind of KINDS) {
        expect(pieceFaceSVG(color, kind).includes('class="dcarc"'), `${color} ${kind}`).toBe(kind === "cannon");
      }
    }
  });

  it("汉字主体保留（认字教学），红蓝阵营色是两组合法且不同的色值", () => {
    for (const color of ["red", "blue"] as Color[]) {
      for (const kind of KINDS) expect(pieceFaceSVG(color, kind)).toContain(labelOf(color, kind));
      for (const v of Object.values(FACTION[color])) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(FACTION.red.ring).not.toBe(FACTION.blue.ring);
    expect(FACTION.red.deep).not.toBe(FACTION.blue.deep);
  });

  it("翻开的格子渲染层用上棋面 SVG，aria-label 三种文案一字不变", () => {
    const cells = blank();
    const at = place(cells, 0, 0, "red", "general");
    place(cells, 1, 1, "blue", "horse", true);
    const board = mountBoard(makeState(cells, { colors: { duo: "red", star: "blue" } }));
    const els = cellEls();
    expect(els[at].innerHTML).toContain("<svg");
    expect(els[at].innerHTML).toContain("帅");
    expect(els[at].getAttribute("aria-label")).toBe("第 1 行第 1 列 红帅");
    expect(els[indexOf(1, 1)].getAttribute("aria-label")).toBe("第 2 行第 2 列 还盖着");
    expect(els[indexOf(2, 2)].getAttribute("aria-label")).toBe("第 3 行第 3 列 空格");
    board.destroy();
  });
});

describe("翻面两段式与回调时序", () => {
  /** 双方各留一枚将（盖着），再加一枚要动的子——settle 不会提前判胜负 */
  function flipBoard(): { state: GameState; at: number } {
    const cells = blank();
    const at = place(cells, 1, 2, "red", "horse", true);
    place(cells, 0, 7, "red", "general", true);
    place(cells, 3, 7, "blue", "general", true);
    return { state: makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" }), at };
  }

  it("前半段还是牌背，中点换成棋面再转回来——正反两张脸", () => {
    vi.useFakeTimers();
    const { state, at } = flipBoard();
    const board = mountBoard(state);
    const el = cellEls()[at];
    expect(el.innerHTML).toContain("暗");
    applyAction(state, { type: "flip", at });
    let done = 0;
    board.animate("flip", at, () => {
      done += 1;
    });
    expect(el.className).toContain("dc-flip1");
    expect(el.innerHTML).toContain("暗");
    vi.advanceTimersByTime(100);
    expect(el.innerHTML).toContain("傌");
    expect(el.className).toContain("dc-flip2");
    expect(el.className).not.toContain("dc-flip1");
    expect(done).toBe(0);
    vi.advanceTimersByTime(100);
    expect(done).toBe(1);
    expect(el.className).not.toContain("dc-flip2");
    board.destroy();
  });

  it("flip 的 done 回调还是踩在 200ms 上", () => {
    vi.useFakeTimers();
    const { state, at } = flipBoard();
    const board = mountBoard(state);
    applyAction(state, { type: "flip", at });
    let done = 0;
    board.animate("flip", at, () => {
      done += 1;
    });
    vi.advanceTimersByTime(199);
    expect(done).toBe(0);
    vi.advanceTimersByTime(1);
    expect(done).toBe(1);
    board.destroy();
  });

  /** 红俥贴脸吃蓝兵，双方的将都盖着押后 */
  function captureBoard(): { state: GameState; from: number; to: number } {
    const cells = blank();
    const from = place(cells, 0, 0, "red", "chariot");
    const to = place(cells, 0, 1, "blue", "soldier");
    place(cells, 3, 0, "red", "general", true);
    place(cells, 3, 7, "blue", "general", true);
    return { state: makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" }), from, to };
  }

  it("capture 的 done 回调还是踩在 180ms 上；攻方滑行、目标退场带 3 片花瓣，收尾清干净", () => {
    vi.useFakeTimers();
    const { state, from, to } = captureBoard();
    const board = mountBoard(state);
    applyAction(state, { type: "move", from, to });
    let done = 0;
    board.animate("capture", to, () => {
      done += 1;
    }, from);
    const els = cellEls();
    expect(els[from].className).toContain("dc-slide");
    expect(els[to].className).toContain("dc-gone");
    expect(els[to].children.filter((c) => c.className.includes("dc-petal"))).toHaveLength(3);
    vi.advanceTimersByTime(179);
    expect(done).toBe(0);
    vi.advanceTimersByTime(1);
    expect(done).toBe(1);
    expect(els[to].children.filter((c) => c.className.includes("dc-petal"))).toHaveLength(0);
    expect(els[from].className).not.toContain("dc-slide");
    expect(els[from].style.transform ?? "").toBe("");
    board.destroy();
  });

  it("弱动效沿用 80ms 短时长，吃子不飞花瓣", () => {
    vi.useFakeTimers();
    forceReduced();
    const { state, from, to } = captureBoard();
    const board = mountBoard(state);
    applyAction(state, { type: "move", from, to });
    let done = 0;
    board.animate("capture", to, () => {
      done += 1;
    }, from);
    expect(cellEls()[to].children.filter((c) => c.className.includes("dc-petal"))).toHaveLength(0);
    vi.advanceTimersByTime(79);
    expect(done).toBe(0);
    vi.advanceTimersByTime(1);
    expect(done).toBe(1);
    board.destroy();
  });
});

describe("可吃提示 · 只画 movesFrom 给的答案", () => {
  it("选中后能吃的目标格有小箭头，空格只有绿高亮", () => {
    const cells = blank();
    const me = place(cells, 0, 0, "red", "chariot");
    const prey = place(cells, 0, 1, "blue", "soldier");
    place(cells, 3, 0, "red", "general", true);
    place(cells, 3, 7, "blue", "general", true);
    const board = mountBoard(makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" }));
    cellEls()[me].dispatch("click", {});
    const els = cellEls();
    expect(els[prey].className).toContain("dc-can");
    expect(els[prey].className).toContain("dc-eat");
    const empty = indexOf(1, 0);
    expect(els[empty].className).toContain("dc-can");
    expect(els[empty].className).not.toContain("dc-eat");
    board.destroy();
  });

  it("选中炮画出跳吃的虚线弧，取消选择就整层收起", () => {
    const cells = blank();
    const gun = place(cells, 0, 0, "red", "cannon");
    place(cells, 0, 1, "red", "soldier", true); // 炮架（盖着的也算）
    place(cells, 0, 2, "blue", "horse");
    place(cells, 3, 0, "red", "general", true);
    place(cells, 3, 7, "blue", "general", true);
    const board = mountBoard(makeState(cells, { colors: { duo: "red", star: "blue" }, turn: "duo" }));
    cellEls()[gun].dispatch("click", {});
    const arcs = dom.root.find((e) => e.className.includes("dc-arcs"))!;
    expect(arcs.hidden).toBe(false);
    expect(arcs.innerHTML).toContain("<path");
    expect(arcs.innerHTML).toContain("stroke-dasharray");
    board.cancel("duo");
    expect(arcs.hidden).toBe(true);
    expect(arcs.innerHTML).toBe("");
    board.destroy();
  });
});

describe("记牌面板 · 图标化", () => {
  it("每色一排七枚迷你棋子图标，文本行与读屏契约原样保留", () => {
    const board = mountBoard(newGame(31), true);
    const spans = dom.root.find((e) => e.className.includes("dc-count"))!.children;
    expect(spans).toHaveLength(2);
    const full: Record<Kind, number> = { general: 1, guard: 2, elephant: 2, chariot: 2, horse: 2, cannon: 2, soldier: 5 };
    expect(spans[0].textContent).toBe(counterLine("red", full));
    expect(spans[0].getAttribute("aria-label")).toBe(counterLine("red", full));
    expect((spans[0].innerHTML.match(/class="dc-ck/g) ?? []).length).toBe(7);
    expect((spans[1].innerHTML.match(/class="dc-ck/g) ?? []).length).toBe(7);
    board.destroy();
  });

  it("翻光的兵种灰下去划一道线，没翻光的照亮", () => {
    const cells = blank();
    place(cells, 0, 0, "red", "general", true); // 红只剩帅没露面
    place(cells, 3, 7, "blue", "general"); // 蓝全露过了
    const board = mountBoard(makeState(cells, { colors: { duo: "red", star: "blue" } }), true);
    const spans = dom.root.find((e) => e.className.includes("dc-count"))!.children;
    expect((spans[0].innerHTML.match(/dc-off/g) ?? []).length).toBe(6);
    expect((spans[1].innerHTML.match(/dc-off/g) ?? []).length).toBe(7);
    expect(miniPieceSVG("red", "soldier", true)).toContain('class="dcx"');
    expect(miniPieceSVG("red", "soldier", false)).not.toContain('class="dcx"');
    expect(counterIconsHTML("red", { ...{ general: 1, guard: 0, elephant: 0, chariot: 0, horse: 0, cannon: 0, soldier: 0 } })).toContain("dc-off");
    board.destroy();
  });
});

describe("结算演出 · 只有画面没有数据", () => {
  function endBoard(): { state: GameState; red: number; blue: number; covered: number } {
    const cells = blank();
    const red = place(cells, 0, 0, "red", "general");
    const blue = place(cells, 0, 2, "blue", "soldier");
    const covered = place(cells, 1, 1, "blue", "horse", true);
    return { state: makeState(cells, { colors: { duo: "red", star: "blue" } }), red, blue, covered };
  }

  it("赢棋：输方翻开的子鞠躬变灰，赢方列队，盖着的子不参加（不泄露）", () => {
    const { state, red, blue, covered } = endBoard();
    const board = mountBoard(state);
    board.flourish({ kind: "win", winner: "red" });
    const els = cellEls();
    expect(els[red].className).toContain("dc-parade");
    expect(els[blue].className).toContain("dc-bow");
    expect(els[covered].className).not.toContain("dc-bow");
    expect(els[covered].className).not.toContain("dc-parade");
    board.destroy();
  });

  it("赢棋下金花瓣雨，最多 12 片；弱动效整层不放", () => {
    const { state } = endBoard();
    const board = mountBoard(state);
    board.flourish({ kind: "win", winner: "red" });
    const rain = dom.root.find((e) => e.className.includes("dc-rain"))!;
    expect(rain).toBeTruthy();
    expect((rain.innerHTML.match(/class="dc-petal"/g) ?? []).length).toBeLessThanOrEqual(12);
    board.destroy();

    forceReduced();
    const quiet = mountBoard(endBoard().state);
    quiet.flourish({ kind: "win", winner: "red" });
    expect(dom.root.find((e) => e.className.includes("dc-rain"))).toBeNull();
    quiet.destroy();
  });

  it("和棋：双方各留一枚翻开的棋子相对碰杯", () => {
    const { state, red, blue } = endBoard();
    const board = mountBoard(state);
    board.flourish({ kind: "draw" });
    const els = cellEls();
    expect(els[red].className).toContain("dc-cheer-l");
    expect(els[blue].className).toContain("dc-cheer-r");
    expect(BOARD_CSS).toContain(".dc-cell.dc-cheer-l{transform:rotate(-15deg);}");
    expect(BOARD_CSS).toContain(".dc-cell.dc-cheer-r{transform:rotate(15deg);}");
    board.destroy();
  });

  it("createTable 收官时自动谢幕，onEnd 的结果一个字没变", () => {
    const cells = blank();
    const red = place(cells, 0, 0, "red", "general");
    const blue = place(cells, 0, 2, "blue", "soldier");
    const state = makeState(cells, { colors: { duo: "red", star: "blue" }, winner: "duo" });
    let why = "";
    let won = false;
    const handle = createTable(dom.root as unknown as HTMLElement, {
      state,
      rival: "human",
      tier: "rookie",
      showCounter: false,
      label: "测试盘",
      maxPlies: 400,
      seed: 7,
      onEnd: (r) => {
        why = r.why;
        won = r.won;
      },
    });
    expect(won).toBe(true);
    expect(why).toBe("把对方的将请去休息啦！");
    const els = cellEls();
    expect(els[red].className).toContain("dc-parade");
    expect(els[blue].className).toContain("dc-bow");
    handle.destroy();
  });
});

describe("CSS 红线 · 热区 / 窄屏 / 弱动效", () => {
  it("44px 热区与窄屏 gap 收缩逻辑原样保留", () => {
    // r2-1 回归修复：44px 热区从格子本体（会被 aspect-ratio 传导成固定宽）挪到 ::before 扩展点击区
    expect(BOARD_CSS).toContain(".dc-cell{position:relative;aspect-ratio:1/1;min-width:0;min-height:0;");
    expect(BOARD_CSS).toContain(".dc-cell:not(.dc-empty)::before");
    expect(BOARD_CSS).toContain("@media (max-width:400px)");
    expect(BOARD_CSS).toContain(".dc-board{gap:3px;}");
    expect(BOARD_CSS).not.toContain("min-height:40px");
  });

  it("窄屏棋子自动收起点数只留汉字（第二通道让位给认字主体）", () => {
    const narrow = BOARD_CSS.indexOf("@media (max-width:400px)");
    const hideDots = BOARD_CSS.indexOf(".dc-face g.dcd{display:none;}");
    expect(narrow).toBeGreaterThan(-1);
    expect(hideDots).toBeGreaterThan(narrow);
  });

  it("弱动效降级覆盖到全部新增动画：翻面 / 花瓣 / 列队缩时长，花瓣雨直接不放", () => {
    const reduced = BOARD_CSS.slice(BOARD_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reduced).toContain(".dc-cell{transition-duration:.06s;}");
    expect(reduced).toContain(".dc-cell.dc-flip2,.dc-petal,.dc-cell.dc-parade{animation-duration:.05s;}");
    expect(reduced).toContain(".dc-rain .dc-petal{animation:none;opacity:0;}");
  });

  it("倒数 chip 的沙漏是绘制资产 data URI，双色 chip 区分保留", () => {
    expect(BOARD_CSS).toContain(".dc-chip.dc-quiet::before,.dc-chip.dc-cap::before{");
    expect(BOARD_CSS).toContain("data:image/svg+xml");
    expect(BOARD_CSS).toContain(".dc-chip.dc-quiet{background:#EDE7FF");
    expect(BOARD_CSS).toContain(".dc-chip.dc-cap{background:#FFF0D6");
  });

  it("花瓣三阶光影齐全：底色、描边脉络、高光缺一不可", () => {
    for (const tone of ["pink", "gold"] as const) {
      const svg = petalSVG(tone);
      expect((svg.match(/#[0-9a-f]{6}/gi) ?? []).length).toBeGreaterThanOrEqual(3);
      expect(svg).toContain("<ellipse"); // 高光
      expect(svg).toContain("stroke="); // 描边
    }
    expect(petalSVG("pink")).not.toBe(petalSVG("gold"));
  });
});
