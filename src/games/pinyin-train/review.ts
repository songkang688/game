/**
 * 错题回顾：1.2 新增（答题关专用）。
 *
 * 一关答完，如果中间错过题，就用**同类新题**再加练几道：
 * 错过声调题就再来一道声调题，错过易混淆就再来一道同组的。
 * 加练轮只练不判负 —— 成绩早在正题那一轮定下来了，复习答不答得对都不扣，
 * 免得孩子把「回顾」当成第二次考试。
 *
 * 哪些题型总出错会按 `yiduo-yixing.` 前缀存在本地，下次遇到老毛病多练一道。
 * 这里**不改** `quiz99.ts`：错题是靠自己传进去的 `ctx.sfx` 回声听出来的
 * （答对一声 coin、答错一声 oops），公共答题器一个字没动。
 */
import type { PlayCtx, PlayHandle, StorageLike } from "../level99";
import { runQuiz, type QuizOptions, type QuizTheme } from "../quiz99";
import { buildReviewQuestions, type PinyinKind, type PinyinQ } from "./levels";

// ---------------------------------------------------------------------------
// 错题本（纯函数 + 本地存档）
// ---------------------------------------------------------------------------

/** 错题本的 key：和平台其它存档一样走 `yiduo-yixing.` 前缀，互不打架 */
export const WRONG_KEY = "yiduo-yixing.pinyin-train.wrong.v1";

/** 题型 → 累计错过多少次 */
export type WrongBook = Record<string, number>;

/** 同一种题型最多记到多少次（免得数字无限涨） */
export const WRONG_CAP = 99;

/** 错过几次算「老毛病」，回顾时多练一道 */
export const CHRONIC_AT = 3;

/** 一次回顾最多加练几道（再多孩子会累） */
export const REVIEW_MAX = 4;

/** 把任意来源的存档值整理成干净的错题本（坏数据一律当空本子） */
export function migrateWrongBook(parsed: unknown): WrongBook {
  const out: WrongBook = {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!k || typeof v !== "number" || !Number.isFinite(v)) continue;
    const n = Math.round(v);
    if (n > 0) out[k] = Math.min(WRONG_CAP, n);
  }
  return out;
}

function browserStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    // 隐私模式等场景：这一次会话不记错题，游戏照玩
    return null;
  }
}

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  return storage === undefined ? browserStorage() : storage;
}

/** 读错题本 */
export function loadWrongBook(storage?: StorageLike | null): WrongBook {
  const store = resolveStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(WRONG_KEY);
    return raw ? migrateWrongBook(JSON.parse(raw) as unknown) : {};
  } catch {
    return {};
  }
}

/** 写错题本（写不进去也不影响继续玩） */
export function saveWrongBook(book: WrongBook, storage?: StorageLike | null): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(WRONG_KEY, JSON.stringify(migrateWrongBook(book)));
  } catch {
    // 存不进去就算了
  }
}

/** 把这一关错过的题型记进本子，返回记完之后的本子 */
export function recordWrongKinds(kinds: readonly string[], storage?: StorageLike | null): WrongBook {
  const book = loadWrongBook(storage);
  let touched = false;
  for (const k of kinds) {
    if (!k) continue;
    book[k] = Math.min(WRONG_CAP, (book[k] ?? 0) + 1);
    touched = true;
  }
  // 全对的那一关不留脚印：没错过就不碰存档
  if (touched) saveWrongBook(book, storage);
  return book;
}

/** 错得最多的几种题型（并列时按名字排，结果稳定可测） */
export function topWrongKinds(book: WrongBook, n = 3): string[] {
  return Object.entries(book)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, n))
    .map(([k]) => k);
}

/**
 * 这一关该回顾哪些题型：本关错得多的排前面，老毛病（历史错过 ≥3 次）多练一道。
 * 返回的是「要出的题型清单」，长度就是加练的题数。
 */
export function reviewPlan(missed: readonly PinyinKind[], book: WrongBook = {}, max = REVIEW_MAX): PinyinKind[] {
  const times = new Map<PinyinKind, number>();
  for (const k of missed) times.set(k, (times.get(k) ?? 0) + 1);
  const order = [...times.keys()].sort(
    (a, b) => (times.get(b) ?? 0) - (times.get(a) ?? 0) || (book[b] ?? 0) - (book[a] ?? 0) || a.localeCompare(b)
  );
  const out: PinyinKind[] = [];
  for (const kind of order) {
    if (out.length >= max) break;
    out.push(kind);
    if ((book[kind] ?? 0) >= CHRONIC_AT && out.length < max) out.push(kind);
  }
  return out.slice(0, Math.max(0, max));
}

/** 回顾开场白：只说「再来几道」，不提「你错了几道」 */
export function reviewIntro(count: number): string {
  return `🔁 错题回顾：再来 ${count} 道同类的小题，答不答得对都不影响刚才的成绩～`;
}

/** 回顾答完的收尾话 */
export const REVIEW_DONE_LINE = "回顾也做完啦，这几种题以后就不怕了！";
/** 回顾没全对时的收尾话：照样只鼓励 */
export const REVIEW_TRIED_LINE = "回顾练过一遍就有印象了，下次再遇到会更快！";

// ---------------------------------------------------------------------------
// 玩法：正题一轮 + 回顾一轮
// ---------------------------------------------------------------------------

const REVIEW_CSS = `
.pyt-review{margin:0 0 8px;padding:8px 12px;border-radius:14px;background:#ffffffd9;text-align:center;
  font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-weight:800;font-size:14px;line-height:1.5;}
`;

export interface ReviewOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  questions: PinyinQ[];
  theme: QuizTheme;
  /** 当前关（0 基）：回顾题按它换种子，重玩不重样 */
  level: number;
}

export interface ReviewDeps {
  /** 答题器（默认就是公共的 `runQuiz`，测试里换成桩） */
  runner?: (opts: QuizOptions) => PlayHandle;
  /** 存档（默认 localStorage；传 null 表示这一次不落盘） */
  storage?: StorageLike | null;
  /** 回顾题生成器（默认 `buildReviewQuestions`） */
  build?: (level: number, kinds: readonly PinyinKind[], round?: number) => PinyinQ[];
}

export function runQuizWithReview(opts: ReviewOptions, deps: ReviewDeps = {}): PlayHandle {
  const runner = deps.runner ?? runQuiz;
  const build = deps.build ?? buildReviewQuestions;
  const { stage, ctx, questions, theme, level } = opts;

  let handle: PlayHandle | void;
  let banner: HTMLElement | null = null;
  let destroyed = false;
  let cleared = 0;
  const missed: PinyinKind[] = [];

  function dropHandle(): void {
    try {
      handle?.destroy?.();
    } catch (err) {
      console.warn("[一朵一星] pinyin-train 回顾切换时清理出错:", err);
    }
    handle = undefined;
  }

  function showBanner(count: number): void {
    const el = document.createElement("div");
    el.className = "pyt-review";
    el.style.color = theme.accent;
    const style = document.createElement("style");
    style.textContent = REVIEW_CSS;
    el.appendChild(style);
    const line = document.createElement("span");
    line.textContent = reviewIntro(count);
    el.appendChild(line);
    stage.appendChild(el);
    banner = el;
  }

  function finish(stars: 1 | 2 | 3, msg?: string): void {
    const book = loadWrongBook(deps.storage);
    const plan = reviewPlan(missed, book);
    recordWrongKinds(missed, deps.storage);
    if (destroyed || plan.length === 0) {
      ctx.win(stars, msg);
      return;
    }
    const reviewQs = build(level, plan, 1);
    if (reviewQs.length === 0) {
      ctx.win(stars, msg);
      return;
    }
    dropHandle();
    showBanner(reviewQs.length);
    const tail = msg ? `${msg} ` : "";
    const reviewCtx: PlayCtx = {
      ...ctx,
      // 回顾轮不判负：不管答成什么样，都按正题那一轮的成绩过关
      win: () => ctx.win(stars, `${tail}${REVIEW_DONE_LINE}`),
      lose: () => ctx.win(stars, `${tail}${REVIEW_TRIED_LINE}`),
    };
    handle = runner({
      stage,
      ctx: reviewCtx,
      questions: reviewQs,
      theme,
      bigChoices: true,
      maxWrong: reviewQs.length * 2,
    });
  }

  const trackedCtx: PlayCtx = {
    ...ctx,
    sfx: (name) => {
      // 公共答题器答对响一声 coin、答错响一声 oops，靠这两声就能知道栽在哪一道
      if (name === "coin") cleared++;
      else if (name === "oops" && cleared < questions.length) missed.push(questions[cleared].kind);
      ctx.sfx(name);
    },
    win: (stars, msg) => finish(stars, msg),
    lose: (msg) => {
      recordWrongKinds(missed, deps.storage);
      ctx.lose(msg);
    },
  };

  handle = runner({ stage, ctx: trackedCtx, questions, theme, bigChoices: true });

  return {
    destroy() {
      destroyed = true;
      dropHandle();
      banner?.remove();
      banner = null;
    },
  };
}
