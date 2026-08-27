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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
import GUIDE from "./guide";
import { buildLevel, loseLine, winLine } from "./levels";
import { meta } from "./meta";
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

/** 这一款棋盘那一层的样式在公共 `styles.css` 里，热区得直接读文件量 */
const SHEET = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");

/** 取某个选择器最后一次出现的规则体（后面的规则会覆盖前面的） */
function sheetRule(selector: string): string {
  const re = new RegExp(`(?:^|[},])\\s*\\${selector}\\s*\\{([^}]*)\\}`, "gm");
  let body = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(SHEET)) !== null) body = m[1];
  return body;
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
/* R2-PA-2 · 360px 上工具条的热区                                        */
/* ------------------------------------------------------------------ */

describe("R2-PA-2 · 360px 上棋盘工具条的热区", () => {
  it("💡 提示 / 🔄 翻转棋盘 / 🏳️ 认输 三个钮都 ≥ 44px", () => {
    const body = sheetRule(".cg-tool");
    expect(body, "styles.css 里找不到 .cg-tool").not.toBe("");
    const m = /(?:^|;)\s*min-height:\s*([\d.]+)px/.exec(body);
    expect(m, ".cg-tool 没有 min-height").not.toBeNull();
    expect(Number((m as RegExpExecArray)[1]), "工具条的热区又缩回 44px 以下了").toBeGreaterThanOrEqual(44);
  });

  it("长高之后字仍然是竖直居中的，版式不塌", () => {
    const body = sheetRule(".cg-tool");
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/justify-content:\s*center/);
  });

  it("三个钮在界面上真的挂着 .cg-tool，量的就是它们", () => {
    const { handle } = duoBoard(undefined, { allowFlip: true, allowResign: true });
    const tools = dom.root.byClass("cg-tool");
    expect(tools.map((t) => t.textContent).filter((t) => t.length > 0)).toEqual([
      "💡 提示：开",
      "🔄 翻转棋盘",
      "🏳️ 认输",
    ]);
    handle.destroy();
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
/* R2-PA-5 · 残局连胜里主动认输的收场话                                  */
/* ------------------------------------------------------------------ */

describe("R2-PA-5 · 残局连胜的收场话", () => {
  /** 进到残局连胜里，返回整款的句柄 */
  function openEndless(): { destroy: () => void } {
    const handle = mount(fakeApi().api as never);
    dom.root.find((e) => e.className.includes("cg-open") && e.textContent.includes("残局连胜"))!.click();
    flushTimers(dom, 4);
    return handle;
  }

  function overText(): string {
    return dom.root.find((e) => e.className.includes("cg-over-s"))?.textContent ?? "";
  }

  it("自己点认输，收场话说的是「你先收手了」，不是「被对方翻过来了」", () => {
    const handle = openEndless();
    dom.root.find((e) => e.className.includes("cg-tool--warn"))!.click();
    flushTimers(dom, 4);
    const line = overText();
    expect(line, "认输之后没有收场浮层").not.toBe("");
    expect(line, "认输和被翻盘还是共用一句").toContain("你先收手了");
    expect(line).not.toContain("被对方翻过来了");
    expect(line, "连过几局没写出来").toContain("你连过了 0 局");
    handle.destroy();
  });

  it("收场话里没有批评孩子的说法，也没有血腥字眼", () => {
    const handle = openEndless();
    dom.root.find((e) => e.className.includes("cg-tool--warn"))!.click();
    flushTimers(dom, 4);
    const line = overText();
    for (const bad of ["笨", "蠢", "废物", "活该", "血", "死掉", "杀死"]) {
      expect(line.includes(bad), `收场话里出现了「${bad}」`).toBe(false);
    }
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* 第 2 轮测试员 PA-CG-4 · 上屏文案里的「死」                             */
/* ------------------------------------------------------------------ */

describe("第 2 轮 PA-CG-4 · 上屏文案不出现死亡说法", () => {
  /** 上屏禁用词。「将杀」是这一款一直在用的术语，所以拦的是「死」不是「杀」 */
  const BANNED = ["死", "血", "尸", "阵亡", "牺牲", "残忍"];

  function clean(where: string, text: string): void {
    for (const bad of BANNED) {
      expect(text.includes(bad) ? `${where} 里出现了「${bad}」：${text}` : "干净").toBe("干净");
    }
  }

  it("卡片与整本攻略都干净，「死角」不许再回来", () => {
    clean("meta.title", meta.title);
    clean("meta.blurb", meta.blurb);
    expect(meta.blurb).not.toContain("死角");
    const lines = [GUIDE.title, ...GUIDE.general, ...GUIDE.entries.flatMap((e) => [e.title, ...e.tips])];
    expect(lines.length).toBeGreaterThan(20);
    for (const [i, text] of lines.entries()) clean(`攻略第 ${i + 1} 句`, text);
  });

  it("188 关的标题、提示、过关语、鼓励语一句一句扫过去", () => {
    for (let i = 0; i < 188; i++) {
      const spec = buildLevel(i);
      clean(`第 ${i + 1} 关标题`, spec.title);
      clean(`第 ${i + 1} 关提示`, spec.hint);
      for (const stars of [1, 2, 3]) clean(`第 ${i + 1} 关过关语`, winLine(spec, stars));
      clean(`第 ${i + 1} 关鼓励语`, loseLine(spec));
    }
  });

  it("源码里的中文字面量也扫一遍：注释放过，会上屏的字符串一个都不放过", () => {
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const files = ["index.ts", "view.ts", "levels.ts", "rules.ts", "moves.ts", "guide.ts", "meta.ts", "search.ts"];
    let scanned = 0;
    for (const f of files) {
      const src = readFileSync(dir + f, "utf8")
        // 先把注释整段抹掉：注释里的「锁死」「写死」是写代码的说法，不上屏
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
      for (const m of src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
        const text = m[1] ?? m[2] ?? "";
        if (!/[\u4e00-\u9fa5]/.test(text)) continue;
        scanned++;
        clean(`${f} 的字面量`, text);
      }
    }
    expect(scanned, "一条中文字面量都没扫到，筛子空转了").toBeGreaterThan(80);
  });

  it("闯关的目标句与残局连胜的提示语都改成了「将杀」", () => {
    const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(src).toContain("步之内将杀对方");
    expect(src).toContain("找出来把对方将杀");
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
