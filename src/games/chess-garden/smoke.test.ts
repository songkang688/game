/**
 * 花园国际象棋 · 无头冒烟。
 *
 * 不开浏览器，用自带的 DOM 桩把整款游戏挂起来再拆掉，守四件事：
 *  1. meta 与首页契约对得上（id / 分类 / 四种模式 / 188 关 / 手游端游都能玩）；
 *  2. 棋盘视图真的能点着走子、能升变、能认输，AI 也会自己落子；
 *  3. `destroy` 之后监听、定时器、rAF 一个都不剩；
 *  4. 文案红线：不沾商标、没有血腥与死亡描写、失败只鼓励。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { TOTAL_LEVELS } from "../level99";
import { WHITE, fromFen, parseSquare } from "./board";
import {
  fireWindow,
  flushFrames,
  flushTimers,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
  type El,
} from "./domStub";
import GUIDE from "./guide";
import { AI_PLANS, judgeLevelMove, levelCleared } from "./index";
import { CHAPTERS, LEVELS, buildLevel, loseLine, winLine } from "./levels";
import { meta } from "./meta";
import { findMove, fromSan, legalMoves, toSan } from "./moves";
import { createGame, status } from "./rules";
import { AI_BLURB, AI_LABEL, AI_TIERS } from "./search";
import { SLIDE_MS, SLIDE_MS_REDUCED, boardOrder, createBoard, moveCursor } from "./view";

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

/** 只有人下的一块棋盘，测试里直接调 `playHuman` 走子 */
function soloBoard(fen: string | undefined, extra: Record<string, unknown> = {}) {
  const sfx: string[] = [];
  const handle = createBoard(dom.root as unknown as HTMLElement, {
    fen,
    seats: [
      { name: "朵朵", emoji: "🌸", color: "#fff", ai: null },
      { name: "星星", emoji: "⭐", color: "#eef", ai: null },
    ],
    banner: "测试",
    tip: "测试提示",
    aiDelayMs: 0,
    sfx: (n) => sfx.push(n),
    ...extra,
  } as never);
  return { handle, sfx };
}

describe("meta 契约", () => {
  it("id、标题、图标、分类、颜色、关数都按规格填", () => {
    expect(meta.id).toBe("chess-garden");
    expect(meta.title).toBe("花园国际象棋");
    expect(meta.emoji).toBe("♔");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#F0E6D8");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.levels).toBe(188);
  });

  it("四种玩法都声明了，而且都是平台认识的名字", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    for (const m of meta.modes) expect(GAME_MODES).toContain(m);
  });

  it("手游端游都能玩，meta 是纯数据没有函数混进来", () => {
    expect(meta.platform).toBe("both");
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
  });
});

describe("index 契约", () => {
  it("顶部 re-export 了 meta，并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("mount 之后有 188 关地图与三个模式按钮，destroy 之后一根监听都不剩", async () => {
    const { mount } = await import("./index");
    const before = windowListenerCount(dom);
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    expect(dom.root.children.length).toBeGreaterThan(0);
    expect(dom.root.byClass("cg-open")).toHaveLength(3);
    expect(dom.root.find((e) => e.className.includes("l99-map"))).not.toBeNull();
    flushFrames(dom, 4);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.root.children).toHaveLength(0);
  });

  it("进第 1 关能摆出棋盘，回地图之后棋盘拆干净", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    dom.root.find((e) => e.className.includes("l99-continue"))!.click();
    expect(dom.root.find((e) => e.className.includes("cg-board"))).not.toBeNull();
    expect(dom.root.byClass("cg-sq")).toHaveLength(64);
    dom.root.find((e) => e.className.includes("l99-back"))!.click();
    expect(dom.root.find((e) => e.className.includes("cg-board"))).toBeNull();
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("四档难度可以在模式条上切，选完按钮状态跟着变", async () => {
    const { mount } = await import("./index");
    const { api, played } = fakeApi(dom.root);
    const handle = mount(api);
    const picks = dom.root.byClass("cg-pick");
    expect(picks.length).toBe(AI_TIERS.length + 1);
    picks[3].click();
    expect(picks[3].getAttribute("aria-pressed")).toBe("true");
    expect(picks[0].getAttribute("aria-pressed")).toBe("false");
    expect(played).toContain("tap");
    handle.destroy();
  });

  it("人机对战 / 双人同屏 / 残局连胜开了再关，监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    const baseline = windowListenerCount(dom);
    for (const label of ["人机对战", "双人同屏", "残局连胜"]) {
      for (let i = 0; i < 2; i++) {
        dom.root.find((e) => e.className.includes("cg-open") && e.textContent.includes(label))!.click();
        flushTimers(dom, 4);
        flushFrames(dom, 4);
        dom.root.find((e) => e.className.includes("cg-back"))!.click();
      }
    }
    expect(windowListenerCount(dom)).toBe(baseline);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("AI_PLANS 把四档的深度与时间预算暴露出来了", () => {
    expect(Object.keys(AI_PLANS)).toEqual(["1", "2", "3", "4"]);
    expect(AI_PLANS[4].timeMs).toBe(200);
  });
});

describe("棋盘视图", () => {
  it("64 个格子按翻转与否排出不同的顺序，但格子还是那 64 个", () => {
    const normal = boardOrder(false);
    const flipped = boardOrder(true);
    expect(normal).toHaveLength(64);
    expect(normal[0]).toBe(parseSquare("a8"));
    expect(flipped[0]).toBe(parseSquare("h1"));
    expect([...normal].sort((a, b) => a - b)).toEqual([...flipped].sort((a, b) => a - b));
  });

  it("键盘光标翻转棋盘之后方向也跟着翻，按上去就是往上", () => {
    const e4 = parseSquare("e4");
    expect(moveCursor(e4, 0, 1, false)).toBe(parseSquare("e5"));
    expect(moveCursor(e4, 0, 1, true)).toBe(parseSquare("e3"));
    expect(moveCursor(e4, 1, 0, false)).toBe(parseSquare("f4"));
    // 走到边上就停住，不会绕到另一边去
    expect(moveCursor(parseSquare("a1"), -1, -1, false)).toBe(parseSquare("a1"));
    expect(moveCursor(parseSquare("h8"), 1, 1, false)).toBe(parseSquare("h8"));
  });

  it("走子滑行时长落在规格要求的 150–220ms 里", () => {
    expect(SLIDE_MS).toBeGreaterThanOrEqual(150);
    expect(SLIDE_MS).toBeLessThanOrEqual(220);
    expect(SLIDE_MS_REDUCED).toBeLessThan(SLIDE_MS);
  });

  it("点一个棋子再点落点就走子，记谱跟着长出来", () => {
    const { handle, sfx } = soloBoard(undefined);
    const squares = dom.root.byClass("cg-sq");
    expect(squares).toHaveLength(64);
    const at = (name: string) => squares[boardOrder(false).indexOf(parseSquare(name))];
    at("e2").click();
    expect(handle.snapshot().selected).toBe(parseSquare("e2"));
    at("e4").click();
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4"]);
    expect(handle.snapshot().turn).not.toBe(WHITE);
    expect(sfx).toContain("tap");
    handle.destroy();
  });

  it("点自己的另一个子会改选，点空格会取消选择", () => {
    const { handle } = soloBoard(undefined);
    const order = boardOrder(false);
    const squares = dom.root.byClass("cg-sq");
    const at = (name: string) => squares[order.indexOf(parseSquare(name))];
    at("e2").click();
    at("d2").click();
    expect(handle.snapshot().selected).toBe(parseSquare("d2"));
    at("d2").click();
    expect(handle.snapshot().selected).toBe(-1);
    handle.destroy();
  });

  it("兵走到底线会弹出四选一，挑哪个就升成哪个", () => {
    const { handle } = soloBoard("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    const order = boardOrder(false);
    const squares = dom.root.byClass("cg-sq");
    squares[order.indexOf(parseSquare("b7"))].click();
    squares[order.indexOf(parseSquare("b8"))].click();
    const picks = dom.root.byClass("cg-promo-b");
    expect(picks).toHaveLength(4);
    expect(picks.map((p) => p.textContent).join("")).toContain("马");
    picks[3].click();
    expect(handle.game.history[0].san).toBe("b8=N");
    expect(dom.root.find((e) => e.className.includes("cg-promo"))).toBeNull();
    handle.destroy();
  });

  it("朵朵 WASD + F 走白棋，星星 方向键 + L 走黑棋", () => {
    const { handle } = soloBoard(undefined);
    const press = (key: string) => fireWindow(dom, "keydown", { key, preventDefault: () => undefined });
    // 光标开局在 e1，往上两格到 e3？先到 e2 选中兵
    press("w");
    expect(handle.snapshot().cursor).toBe(parseSquare("e2"));
    press("f");
    expect(handle.snapshot().selected).toBe(parseSquare("e2"));
    press("w");
    press("w");
    press("f");
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4"]);
    // 轮到黑方：光标停在 e4，方向键往上走到 e7 挑起兵，再往下两格落到 e5
    press("ArrowUp");
    press("ArrowUp");
    press("ArrowUp");
    expect(handle.snapshot().cursor).toBe(parseSquare("e7"));
    press("l");
    press("ArrowDown");
    press("ArrowDown");
    press("l");
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4", "e5"]);
    expect(handle.snapshot().turn).toBe(WHITE);
    handle.destroy();
  });

  it("Esc 暂停会把棋局停住，点「继续下棋」再放行", () => {
    const { handle } = soloBoard(undefined);
    fireWindow(dom, "keydown", { key: "Escape", preventDefault: () => undefined });
    const pause = dom.root.find((e) => e.className.includes("cg-promo-t"))!;
    expect(pause.textContent).toContain("先歇一下");
    // 暂停时点格子不生效
    const order = boardOrder(false);
    dom.root.byClass("cg-sq")[order.indexOf(parseSquare("e2"))].click();
    expect(handle.game.history).toHaveLength(0);
    dom.root.find((e) => e.className.includes("cg-promo-b"))!.click();
    dom.root.byClass("cg-sq")[order.indexOf(parseSquare("e2"))].click();
    expect(handle.snapshot().selected).toBe(parseSquare("e2"));
    handle.destroy();
  });

  it("提示开关与认输按钮都在，认输之后局面就锁住了", () => {
    let over = 0;
    const { handle } = soloBoard(undefined, { allowResign: true, allowFlip: true, onOver: () => over++ });
    const hint = dom.root.byClass("cg-tool")[0];
    expect(hint.textContent).toContain("提示");
    hint.click();
    expect(hint.getAttribute("aria-pressed")).toBe("false");
    dom.root.find((e) => e.className.includes("cg-tool--warn"))!.click();
    expect(over).toBe(1);
    expect(handle.snapshot().over).toBe(true);
    expect(handle.playHuman(findMove(handle.game.pos, parseSquare("e2"), parseSquare("e4"))!)).toBe(false);
    handle.destroy();
  });

  it("轮到 AI 时它会自己落子，destroy 之后排着的定时器不再开火", () => {
    let asked = 0;
    const { handle } = soloBoard(undefined, {
      seats: [
        { name: "朵朵", emoji: "🌸", color: "#fff", ai: null },
        { name: "电脑", emoji: "🤖", color: "#eef", ai: 1 },
      ],
      aiDelayMs: 200,
      think: (game: { pos: unknown }) => {
        asked++;
        return fromSan(game.pos as never, "e5");
      },
    });
    handle.playHuman(findMove(handle.game.pos, parseSquare("e2"), parseSquare("e4"))!);
    expect(dom.timers.size).toBe(1);
    flushTimers(dom, 2);
    expect(asked).toBe(1);
    expect(handle.game.history.map((h) => h.san)).toEqual(["e4", "e5"]);
    handle.playHuman(findMove(handle.game.pos, parseSquare("d2"), parseSquare("d4"))!);
    handle.destroy();
    expect(flushTimers(dom, 4)).toBeLessThanOrEqual(1);
    expect(handle.game.history).toHaveLength(3);
  });

  it("judge 说这一手不行就退回去，棋盘一点不动，只给一句鼓励", () => {
    const { handle, sfx } = soloBoard(undefined, {
      judge: () => ({ ok: false, msg: "换一手试试，这一步之后就抓不住了。" }),
    });
    expect(handle.playHuman(findMove(handle.game.pos, parseSquare("e2"), parseSquare("e4"))!)).toBe(false);
    expect(handle.game.history).toHaveLength(0);
    expect(handle.snapshot().tip).toContain("换一手试试");
    expect(sfx).toContain("oops");
    handle.destroy();
  });

  it("reset 能把题面重新摆好", () => {
    const { handle } = soloBoard("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    handle.playHuman(fromSan(handle.game.pos, "Ra8")!);
    expect(handle.snapshot().over).toBe(true);
    handle.reset("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    expect(handle.snapshot().over).toBe(false);
    expect(handle.game.history).toHaveLength(0);
    handle.destroy();
  });

  it("将杀之后会报结算，并且给出 win 音效", () => {
    let result = "";
    const { handle, sfx } = soloBoard("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", {
      onOver: (st: { kind: string }) => (result = st.kind),
    });
    handle.playHuman(fromSan(handle.game.pos, "Ra8")!);
    expect(result).toBe("checkmate");
    expect(sfx).toContain("win");
    handle.destroy();
  });

  it("destroy 可以重复调用，也不会炸", () => {
    const { handle } = soloBoard(undefined);
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
    expect(dom.root.children).toHaveLength(0);
  });
});

describe("闯关判定", () => {
  it("杀棋题：走对了放行，别的走法一律退回并给一句鼓励", () => {
    const spec = LEVELS.find((s) => s.kind === "mate" && s.plies === 1 && !s.require)!;
    const right = createGame(spec.fen);
    expect(judgeLevelMove(spec, fromSan(right.pos, spec.solution)!, right).ok).toBe(true);
    // 同一道题里随便挑一手不是解的棋，必须被判回去
    const other = createGame(spec.fen);
    const idle = legalMoves(other.pos).find((m) => toSan(m, other.pos) !== spec.solution)!;
    const verdict = judgeLevelMove(spec, idle, other);
    expect(verdict.ok).toBe(false);
    expect(verdict.msg!.length).toBeGreaterThan(4);
    for (const bad of ["笨", "错了", "失败"]) expect(verdict.msg!.includes(bad)).toBe(false);
  });

  it("规定首着的关卡：不是那一类走法就不认，提示里点名这一关要练什么", () => {
    const spec = LEVELS.find((s) => s.require)!;
    const game = createGame(spec.fen);
    expect(judgeLevelMove(spec, fromSan(game.pos, spec.solution)!, game).ok).toBe(true);
    const other = createGame(spec.fen);
    const wrong = legalMoves(other.pos).find((m) => toSan(m, other.pos) !== spec.solution)!;
    const verdict = judgeLevelMove(spec, wrong, other);
    expect(verdict.ok).toBe(false);
    expect(verdict.msg).toContain(spec.title);
  });

  it("和棋题：走成对应的和棋才算过", () => {
    const stale = LEVELS.find((s) => s.kind === "stalemate")!;
    const game = createGame(stale.fen);
    const move = fromSan(game.pos, stale.solution)!;
    expect(judgeLevelMove(stale, move, game).ok).toBe(true);
  });

  it("levelCleared 按题型认结果，不会把和棋当成过关", () => {
    const mate = LEVELS.find((s) => s.kind === "mate")!;
    expect(levelCleared(mate, status(fromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1")))).toBe(true);
    expect(levelCleared(mate, status(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")))).toBe(false);
    const stale = LEVELS.find((s) => s.kind === "stalemate")!;
    expect(levelCleared(stale, status(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")))).toBe(true);
  });
});

describe("文案红线", () => {
  /** 棋类相关的商业名号一个都不许出现（引擎名、赛事名、商业下棋 App） */
  const BANNED = [
    "stockfish",
    "leela",
    "alphazero",
    "fritz",
    "houdini",
    "komodo",
    "chess.com",
    "lichess",
    "chessbase",
    "天天象棋",
    "弈城",
    "野狐",
    "新东方",
    "国际棋联",
    "世锦赛",
    "大师赛",
    "卡斯帕罗夫",
    "卡尔森",
    "俄罗斯方块",
    "愤怒的小鸟",
    "超级玛丽",
    "马里奥",
    "宝可梦",
    "奥特曼",
    "原神",
    "王者荣耀",
    "我的世界",
    "minecraft",
    "tetris",
  ];
  /** 血腥、死亡与批评的说法一个都不许有 */
  const UGLY = ["血", "死掉", "杀死", "尸", "干掉", "弄死", "笨", "蠢", "废物", "没用", "赌"];

  function allText(): string[] {
    const out: string[] = [meta.title, meta.blurb, GUIDE.title, ...GUIDE.general];
    for (const e of GUIDE.entries) out.push(e.title, ...e.tips);
    for (const c of CHAPTERS) out.push(c.name, c.desc);
    for (const spec of LEVELS) out.push(spec.title, spec.hint);
    for (let i = 0; i < 188; i += 23) {
      const spec = buildLevel(i);
      out.push(winLine(spec, 0), winLine(spec, 3), loseLine(spec));
    }
    for (const t of AI_TIERS) out.push(AI_LABEL[t], AI_BLURB[t]);
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

  it("没有血腥与死亡描写，也没有批评孩子的话", () => {
    for (const line of allText()) {
      for (const w of UGLY) expect(line.includes(w), `「${w}」出现在：${line}`).toBe(false);
    }
  });

  it("攻略结构完整：通用心得 3–6 条、八章条目、覆盖第 1 关到第 188 关", () => {
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

  it("攻略只讲思路，不把任何一关的答案着法抄进去", () => {
    const tips = GUIDE.general.concat(GUIDE.entries.flatMap((e) => e.tips)).join(" ");
    for (const spec of LEVELS) {
      expect(tips.includes(spec.solution), `第 ${spec.index + 1} 关的答案写进攻略了`).toBe(false);
    }
  });

  it("360px 下每一句提示都不长到会溢出", () => {
    for (const line of allText()) {
      expect(line.length, `这一句在 360px 上太长了：${line}`).toBeLessThanOrEqual(64);
    }
  });
});
