/**
 * 花园国际象棋 · 窗口 2 第 1 轮验收 · 测试员包 A 的复现测试。
 *
 * 只记录、不改玩法。既有 smoke.test.ts 已经把走子、升变、认输、AI 落子都测过了，
 * 这一份补走查铁则里剩下的三块：
 *  - 铁则 1：界面上真的赢一次（将杀）、真的输一次（被将杀），再退出、再进来；
 *  - 铁则 2：第 1 / 100 / 188 关都摆得出题面，判定与结算文案都在；
 *  - 铁则 3：双人同屏两套键位互不抢占，以及 Esc 暂停的进出方式。
 *
 * 标了「【已知问题】」的用例断言的是**当前行为**，修好之后会红，那时候连断言一起翻面。
 * 记在 `docs/qa/1.2-window2-round1-tester-packA.md` 的问题表里：
 *  - PA-CG-1（一般）：Esc 只能进暂停，再按一次不恢复，得用鼠标点「继续下棋」；
 *  - PA-CG-2（一般）：规格里朵朵的 G 与星星的 K（取消选中）没接；
 *  - PA-CG-3（一般）：`mount` 的 destroy 不回收注入到 document.head 的 `cg-shell-style`。
 *
 * 第 2 轮学习优化员已把 PA-CG-1 / PA-CG-2 / PA-CG-3 三条落地，对应的断言都已翻成修好后的行为。
 */
// `mount` 必须走顶部静态 import 并在文件里被真正用到：这样 level99 → dialogs → audio
// 那条链会在装 DOM 桩之前、`document` 还是 undefined 的时候求值完，
// 不会撞上桩里没实现的 `document.addEventListener`。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "./index";
import { BLACK, WHITE, parseSquare } from "./board";
import {
  fireWindow,
  flushTimers,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
  type El,
} from "./domStub";
import { buildLevel, loseLine, winLine } from "./levels";
import { fromSan } from "./moves";
import { boardOrder, createBoard } from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

function fakeApi() {
  const played: string[] = [];
  return {
    played,
    api: {
      root: dom.root as unknown as HTMLElement,
      play: (n: string) => played.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined,
    },
  };
}

/** 双人同屏的一块棋盘：朵朵执白、星星执黑，两边都是真人 */
function duoBoard(fen?: string, extra: Record<string, unknown> = {}) {
  const overs: string[] = [];
  const handle = createBoard(dom.root as unknown as HTMLElement, {
    fen,
    seats: [
      { name: "朵朵", emoji: "🌸", color: "#fff", ai: null },
      { name: "星星", emoji: "⭐", color: "#eef", ai: null },
    ],
    banner: "双人同屏",
    tip: "轮流走。",
    aiDelayMs: 0,
    sfx: () => undefined,
    onOver: (st: { kind: string }) => overs.push(st.kind),
    ...extra,
  } as never);
  return { handle, overs };
}

function press(key: string): void {
  fireWindow(dom, "keydown", { key, preventDefault: () => undefined });
}

function squareAt(name: string): El {
  return dom.root.byClass("cg-sq")[boardOrder(false).indexOf(parseSquare(name))];
}

/* ------------------------------------------------------------------ */
/* PA-CG · 铁则 1：真的赢一次、真的输一次                                */
/* ------------------------------------------------------------------ */

describe("PA-CG · 一局棋的真实胜负", () => {
  it("白方一步杀：走出来就报将杀，赢的那一句是夸奖", () => {
    const { handle, overs } = duoBoard("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    expect(handle.snapshot().turn).toBe(WHITE);
    handle.playHuman(fromSan(handle.game.pos, "Ra8")!);
    expect(overs, "白方一步杀没有报结算").toEqual(["checkmate"]);
    expect(handle.snapshot().over).toBe(true);
    const line = winLine(buildLevel(0), 1);
    expect(line.length).toBeGreaterThan(4);
    for (const bad of ["笨", "废", "输了活该"]) expect(line.includes(bad)).toBe(false);
    handle.destroy();
  });

  it("黑方一步杀：轮到白方就已经被将死，输的那一句只鼓励", () => {
    // 白王在角落，黑车一步落到底线就是将杀
    const { handle, overs } = duoBoard("r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1");
    expect(handle.snapshot().turn).toBe(BLACK);
    handle.playHuman(fromSan(handle.game.pos, "Ra1")!);
    expect(overs, "黑方一步杀没有报结算").toEqual(["checkmate"]);
    const line = loseLine(buildLevel(0));
    expect(line.length).toBeGreaterThan(4);
    for (const bad of ["笨", "废", "太差", "活该"]) expect(line.includes(bad)).toBe(false);
    handle.destroy();
  });

  it("赢完拆掉再摆一局，题面回到开局，不带上一局的记谱", () => {
    for (let round = 0; round < 2; round++) {
      const { handle, overs } = duoBoard("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
      expect(handle.game.history, `第 ${round + 1} 局开局就带着记谱`).toHaveLength(0);
      handle.playHuman(fromSan(handle.game.pos, "Ra8")!);
      expect(overs).toEqual(["checkmate"]);
      handle.destroy();
      expect(dom.root.children, `第 ${round + 1} 局没拆干净`).toHaveLength(0);
      expect(windowListenerCount(dom)).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* PA-CG · 铁则 2：第 1 / 100 / 188 关                                   */
/* ------------------------------------------------------------------ */

describe("PA-CG · 第 1 / 100 / 188 关", () => {
  it("三关的题面都摆得出 64 格，参考解也真的是一手合法棋", () => {
    for (const level of [0, 99, 187]) {
      const spec = buildLevel(level);
      const { handle } = duoBoard(spec.fen);
      expect(dom.root.byClass("cg-sq"), `第 ${level + 1} 关棋盘不是 64 格`).toHaveLength(64);
      const move = fromSan(handle.game.pos, spec.solution);
      expect(move, `第 ${level + 1} 关的参考解「${spec.solution}」在题面上走不出来`).not.toBeNull();
      expect(handle.playHuman(move!), `第 ${level + 1} 关的参考解被判回去了`).toBe(true);
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${level + 1} 关拆完还留着监听`).toBe(0);
    }
  });

  it("三关的过关语与鼓励语都干净、都不空", () => {
    for (const level of [0, 99, 187]) {
      const spec = buildLevel(level);
      for (const line of [winLine(spec, 1), winLine(spec, 5), loseLine(spec)]) {
        expect(line.length, `第 ${level + 1} 关有一句是空的`).toBeGreaterThan(4);
        for (const bad of ["笨", "蠢", "废物", "血", "死掉", "杀死"]) {
          expect(line.includes(bad), `第 ${level + 1} 关的「${line}」踩了红线`).toBe(false);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* PA-CG · 铁则 3：双人同屏键位                                          */
/* ------------------------------------------------------------------ */

describe("PA-CG · 双人同屏键位互不抢占", () => {
  it("轮到白方时星星的方向键和 L 一概不认", () => {
    const { handle } = duoBoard();
    expect(handle.snapshot().turn).toBe(WHITE);
    const cursor = handle.snapshot().cursor;
    press("ArrowUp");
    press("ArrowLeft");
    expect(handle.snapshot().cursor, "白方回合被星星的方向键挪了光标").toBe(cursor);
    press("l");
    expect(handle.snapshot().selected, "白方回合被星星的 L 选中了子").toBe(-1);
    handle.destroy();
  });

  it("轮到黑方时朵朵的 WASD 和 F 一概不认", () => {
    const { handle } = duoBoard();
    handle.playHuman(fromSan(handle.game.pos, "e4")!);
    expect(handle.snapshot().turn).toBe(BLACK);
    const cursor = handle.snapshot().cursor;
    press("w");
    press("a");
    expect(handle.snapshot().cursor, "黑方回合被朵朵的 WASD 挪了光标").toBe(cursor);
    press("f");
    expect(handle.snapshot().selected, "黑方回合被朵朵的 F 选中了子").toBe(-1);
    handle.destroy();
  });

  it("换手之后另一套键立刻接管，一人一套互不打架", () => {
    const { handle } = duoBoard();
    press("w");
    press("f");
    press("w");
    press("w");
    press("f");
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4"]);
    press("ArrowUp");
    press("ArrowUp");
    press("ArrowUp");
    press("l");
    press("ArrowDown");
    press("ArrowDown");
    press("l");
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4", "e5"]);
    handle.destroy();
  });

  it("朵朵的 G 与星星的 K 都能把选中的子放回去", () => {
    const { handle } = duoBoard();
    press("w");
    press("f");
    expect(handle.snapshot().selected).toBe(parseSquare("e2"));
    press("g");
    expect(handle.snapshot().selected, "G 没能取消选中").toBe(-1);
    handle.playHuman(fromSan(handle.game.pos, "e4")!);
    press("ArrowUp");
    press("ArrowUp");
    press("ArrowUp");
    press("l");
    expect(handle.snapshot().selected).toBeGreaterThanOrEqual(0);
    press("k");
    expect(handle.snapshot().selected, "K 没能取消选中").toBe(-1);
    handle.destroy();
  });

  it("取消键只认自己那一套：白方回合按 K 不算数，黑方回合按 G 也不算数", () => {
    const { handle } = duoBoard();
    press("w");
    press("f");
    const picked = handle.snapshot().selected;
    expect(picked).toBe(parseSquare("e2"));
    press("k");
    expect(handle.snapshot().selected, "白方回合被星星的 K 取消了选中").toBe(picked);
    press("g");
    expect(handle.snapshot().selected).toBe(-1);
    handle.playHuman(fromSan(handle.game.pos, "e4")!);
    press("ArrowUp");
    press("ArrowUp");
    press("ArrowUp");
    press("l");
    const black = handle.snapshot().selected;
    expect(black).toBeGreaterThanOrEqual(0);
    press("g");
    expect(handle.snapshot().selected, "黑方回合被朵朵的 G 取消了选中").toBe(black);
    handle.destroy();
  });

  it("取消之后还能重新选一颗子走棋，记谱不会因为取消多出一手", () => {
    const { handle } = duoBoard();
    press("w");
    press("f");
    press("g");
    expect(handle.game.history, "取消键把棋走出去了").toHaveLength(0);
    press("a");
    press("f");
    press("w");
    press("w");
    press("f");
    expect(handle.game.history.map((h) => h.san)).toEqual(["d4"]);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-CG · Esc 暂停                                                     */
/* ------------------------------------------------------------------ */

describe("PA-CG · Esc 暂停", () => {
  it("暂停之后点格子、按键都动不了棋", () => {
    const { handle } = duoBoard();
    press("Escape");
    expect(dom.root.find((e) => e.className.includes("cg-promo-t"))!.textContent).toContain("先歇一下");
    squareAt("e2").click();
    expect(handle.snapshot().selected, "暂停期间点格子还能选中").toBe(-1);
    const cursor = handle.snapshot().cursor;
    press("w");
    press("f");
    expect(handle.snapshot().cursor, "暂停期间键盘还能挪光标").toBe(cursor);
    expect(handle.game.history, "暂停期间还能走子").toHaveLength(0);
    handle.destroy();
  });

  it("暂停期间电脑也不落子，恢复之后才接着想", () => {
    const { handle } = duoBoard(undefined, {
      seats: [
        { name: "朵朵", emoji: "🌸", color: "#fff", ai: null },
        { name: "电脑", emoji: "🤖", color: "#eef", ai: 1 },
      ],
      aiDelayMs: 200,
      think: (game: { pos: unknown }) => fromSan(game.pos as never, "e5"),
    });
    handle.playHuman(fromSan(handle.game.pos, "e4")!);
    press("Escape");
    flushTimers(dom, 4);
    expect(handle.game.history.map((h) => h.san), "暂停期间电脑还是落了子").toEqual(["e4"]);
    dom.root.find((e) => e.className.includes("cg-promo-b"))!.click();
    flushTimers(dom, 4);
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4", "e5"]);
    handle.destroy();
  });

  it("Esc 是开关：再按一次就退出暂停，和另外四款一个口径", () => {
    const { handle } = duoBoard();
    press("Escape");
    expect(dom.root.find((e) => e.className.includes("cg-promo-t"))).not.toBeNull();
    press("Escape");
    expect(dom.root.find((e) => e.className.includes("cg-promo-t")), "再按一次 Esc 没退出暂停").toBeNull();
    // 退出暂停之后棋接着下得动
    press("w");
    press("f");
    press("w");
    press("w");
    press("f");
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4"]);
    handle.destroy();
  });

  it("暂停 / 恢复来回 20 次之后棋照样走得动，也不会卡在遮罩里", () => {
    const { handle } = duoBoard();
    for (let i = 0; i < 20; i++) {
      press("Escape");
      expect(dom.root.find((e) => e.className.includes("cg-promo-t")), `第 ${i + 1} 次没暂停住`).not.toBeNull();
      press("Escape");
      expect(dom.root.find((e) => e.className.includes("cg-promo-t")), `第 ${i + 1} 次没恢复`).toBeNull();
    }
    press("w");
    press("f");
    press("w");
    press("w");
    press("f");
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4"]);
    handle.destroy();
  });

  it("Esc 恢复之后电脑接着想，不会漏掉那一手", () => {
    const { handle } = duoBoard(undefined, {
      seats: [
        { name: "朵朵", emoji: "🌸", color: "#fff", ai: null },
        { name: "电脑", emoji: "🤖", color: "#eef", ai: 1 },
      ],
      aiDelayMs: 200,
      think: (game: { pos: unknown }) => fromSan(game.pos as never, "e5"),
    });
    handle.playHuman(fromSan(handle.game.pos, "e4")!);
    press("Escape");
    flushTimers(dom, 4);
    expect(handle.game.history.map((h) => h.san), "暂停期间电脑还是落了子").toEqual(["e4"]);
    press("Escape");
    flushTimers(dom, 4);
    expect(handle.game.history.map((h) => h.san), "Esc 恢复之后电脑没接着走").toEqual(["e4", "e5"]);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-CG · 退出再进                                                     */
/* ------------------------------------------------------------------ */

describe("PA-CG · 退出再进", () => {
  it("整款拆掉再挂一次，模式条与 188 关地图都还在", () => {
    for (let i = 0; i < 2; i++) {
      const handle = mount(fakeApi().api as never);
      expect(dom.root.byClass("cg-open"), `第 ${i + 1} 次进来模式条不全`).toHaveLength(3);
      expect(dom.root.find((e) => e.className.includes("l99-map")), `第 ${i + 1} 次进来没有地图`).not.toBeNull();
      handle.destroy();
      expect(dom.root.children, `第 ${i + 1} 次退出没拆干净`).toHaveLength(0);
      expect(windowListenerCount(dom), `第 ${i + 1} 次退出还留着监听`).toBe(0);
    }
  });

  it("destroy 会把注入 document.head 的 cg-shell-style 一起带走", () => {
    const handle = mount(fakeApi().api as never);
    expect(dom.head.children.some((c) => c.id === "cg-shell-style")).toBe(true);
    handle.destroy();
    expect(
      dom.head.children.some((c) => c.id === "cg-shell-style"),
      "destroy 之后样式标签仍留在 document.head"
    ).toBe(false);
  });

  it("来回进出 5 次，head 里始终最多一份样式，最后一次拆完归零", () => {
    for (let i = 0; i < 5; i++) {
      const handle = mount(fakeApi().api as never);
      expect(
        dom.head.children.filter((c) => c.id === "cg-shell-style"),
        `第 ${i + 1} 次进来 head 里的样式不是一份`
      ).toHaveLength(1);
      handle.destroy();
      expect(
        dom.head.children.filter((c) => c.id === "cg-shell-style"),
        `第 ${i + 1} 次退出没把样式带走`
      ).toHaveLength(0);
    }
  });

  it("进到某个模式里再退出来，样式还在；整款拆掉才带走", () => {
    const handle = mount(fakeApi().api as never);
    const open = (label: string): void => {
      dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(label)).pop()!.click();
    };
    open("残局连胜");
    expect(dom.head.children.filter((c) => c.id === "cg-shell-style"), "进模式又多注了一份").toHaveLength(1);
    dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes("回选关")).pop()!.click();
    expect(
      dom.head.children.some((c) => c.id === "cg-shell-style"),
      "只是退出模式，整款还开着，样式不该被带走"
    ).toBe(true);
    handle.destroy();
    expect(dom.head.children.some((c) => c.id === "cg-shell-style")).toBe(false);
  });
});
