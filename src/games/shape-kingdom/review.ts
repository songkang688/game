/**
 * 形状王国 · 错题回顾与三级提示（1.2 新增，选择题关专用）。
 *
 * 一关答完，中间错过的知识点会用**同类新题**再加练几道：错过面积就再来一道面积，
 * 错过展开图就再来一张新的展开图。加练轮只练不判负——成绩在正题那一轮就定下来了，
 * 回顾答成什么样都不扣，免得孩子把「回顾」当成第二场考试。
 *
 * 哪些题型总栽跟头会按 `yiduo-yixing.` 前缀记在本地，下次遇到老毛病多练一道。
 *
 * 提示条挂在答题器外面，三级依次是「考什么 → 给公式 → 给第一步的结果」，
 * 交给 `hints.ts` 的 `safeHints` 过一遍，任何一级都不会把答案漏出去。
 *
 * 这里**不改** `quiz99.ts`：进度是靠自己传进去的 `ctx.sfx` 回声听出来的
 * （答对一声 coin、答错一声 oops），公共答题器一个字没动。
 */
import type { PlayCtx, PlayHandle, StorageLike } from "../level99";
import { runQuiz, type QuizOptions, type QuizTheme } from "../quiz99";
import { buildReviewQuestions, type ShapeQ, type ShapeQKind } from "./levels";
import { HINT_LABELS, safeHints, type HintTrio } from "./hints";
import { fitIntoStage } from "./draw";
import { resetClippedScroll } from "./stageScroll";

// ---------------------------------------------------------------------------
// 错题本（纯函数 + 本地存档）
// ---------------------------------------------------------------------------

/** 错题本的 key：和平台其它存档一样走 `yiduo-yixing.` 前缀，互不打架 */
export const WRONG_KEY = "yiduo-yixing.shape-kingdom.wrong.v1";

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
export function reviewPlan(missed: readonly ShapeQKind[], book: WrongBook = {}, max = REVIEW_MAX): ShapeQKind[] {
  const times = new Map<ShapeQKind, number>();
  for (const k of missed) times.set(k, (times.get(k) ?? 0) + 1);
  const order = [...times.keys()].sort(
    (a, b) => (times.get(b) ?? 0) - (times.get(a) ?? 0) || (book[b] ?? 0) - (book[a] ?? 0) || a.localeCompare(b)
  );
  const out: ShapeQKind[] = [];
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
// 三级提示条
// ---------------------------------------------------------------------------

/** 按钮上该写什么：已经翻到第几级、还有没有下一级 */
export function hintButtonLabel(level: number): string {
  if (level >= HINT_LABELS.length) return "💡 提示（已到底）";
  return `💡 提示 ${level + 1}/${HINT_LABELS.length}`;
}

/** 第 n 级提示要显示的整行文字（n 从 1 起） */
export function hintLine(hints: HintTrio, answer: string, n: number): string {
  const i = Math.max(1, Math.min(HINT_LABELS.length, n)) - 1;
  return `${HINT_LABELS[i]}：${safeHints(hints, answer)[i]}`;
}

const REVIEW_CSS = `
.shk-round{margin:0 0 8px;display:flex;flex-direction:column;gap:6px;
  font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.shk-banner{padding:8px 12px;border-radius:14px;background:#ffffffd9;text-align:center;
  font-weight:800;font-size:14px;line-height:1.5;}
.shk-hintbar{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;}
.shk-hintbtn{border:none;border-radius:14px;padding:10px 16px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffe6;color:#5f4a8a;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.shk-hintbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.shk-hintbtn:disabled{opacity:.5;cursor:default;}
.shk-hintbtn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.shk-hinttext{flex:1 1 220px;min-width:0;font-size:14px;font-weight:700;line-height:1.6;
  background:#ffffffcc;border-radius:12px;padding:6px 10px;text-align:center;}
/* 答题器自己没有滚动兜底，题面 + 三颗选项在 640 高的机器上比舞台看得见的那一段还高，
   最后一个选项就落到裁切线以下点不着（测试员 W5-B-01：第 100 关「22 厘米」低 54px，
   万一它就是正解，这一关直接卡死）。答题器的 .qz-wrap 是公共文件生的、本档不许动，
   但它挂在哪儿是本款说了算——给它一个本款自己的宿主，再由 fitIntoStage 钳住宿主。 */
.shk-quizhost{min-width:0;}
/* N-37 残余:root 直达行叠在深关题面上,三张选项 top 453。只收本款宿主,clock/识字不走这条。 */
@media (max-height:500px){
  .l99-stage-wrap:has(.l99-jump) .shk-round{margin:0 0 2px;gap:2px;}
  .l99-stage-wrap:has(.l99-jump) .shk-banner{padding:3px 8px;font-size:13px;}
  .l99-stage-wrap:has(.l99-jump) .shk-hinttext{padding:4px 8px;font-size:13px;line-height:1.35;}
  .l99-stage-wrap:has(.l99-jump) .shk-quizhost .qz-prompt{font-size:20px;min-height:36px;padding:2px 8px;}
  .l99-stage-wrap:has(.l99-jump) .shk-quizhost .qz-prompt svg,
  .l99-stage-wrap:has(.l99-jump) .shk-quizhost .qz-prompt img{max-height:40px;}
}
`;

export interface ReviewOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  questions: ShapeQ[];
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
  build?: (level: number, kinds: readonly ShapeQKind[], round?: number) => ShapeQ[];
}

export function runQuizWithReview(opts: ReviewOptions, deps: ReviewDeps = {}): PlayHandle {
  const runner = deps.runner ?? runQuiz;
  const build = deps.build ?? buildReviewQuestions;
  const { stage, ctx, questions, theme, level } = opts;

  let handle: PlayHandle | void;
  let panel: HTMLElement | null = null;
  let destroyed = false;
  let cleared = 0;
  let hintLevel = 0;
  const missed: ShapeQKind[] = [];

  // 提示条：题面在答题器里，提示条在它上面，两边靠 sfx 回声对齐到同一道题
  const wrap = document.createElement("div");
  wrap.className = "shk-round";
  const style = document.createElement("style");
  style.textContent = REVIEW_CSS;
  wrap.appendChild(style);
  const banner = document.createElement("div");
  banner.className = "shk-banner";
  banner.style.color = theme.accent;
  banner.hidden = true;
  wrap.appendChild(banner);
  const hintBar = document.createElement("div");
  hintBar.className = "shk-hintbar";
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "shk-hintbtn";
  hintBtn.textContent = hintButtonLabel(0);
  const hintText = document.createElement("span");
  hintText.className = "shk-hinttext";
  hintText.style.color = theme.accent;
  hintText.hidden = true;
  hintBar.append(hintBtn, hintText);
  wrap.appendChild(hintBar);
  stage.appendChild(wrap);
  // 先把地图带进来的滚动位移归零，再钳宿主（钳位量的是位置，带着位移量出来的可视段是错的）
  resetClippedScroll(wrap);
  panel = wrap;

  // 答题器挂在本款自己的宿主里，宿主再钳进舞台看得见的那一段：内容一高就在这里滚，
  // 而不是被舞台默默裁掉。提示条留在宿主外面不跟着滚，孩子滑题面时提示一直看得见。
  const quizHost = document.createElement("div");
  quizHost.className = "shk-quizhost";
  stage.appendChild(quizHost);
  const fit = fitIntoStage(quizHost);

  /** 提示条跟着的那道题（回顾轮换过题库之后指的就是回顾题） */
  let live: ShapeQ[] = questions;

  function resetHint(): void {
    hintLevel = 0;
    hintText.hidden = true;
    hintText.textContent = "";
    const has = Boolean(live[cleared]?.hints);
    hintBtn.disabled = !has;
    hintBtn.textContent = hintButtonLabel(0);
    hintBar.hidden = !has;
    // 换一道题题面高度就变，钳位跟着重算一次
    fit.relayout();
  }

  hintBtn.addEventListener("click", () => {
    const q = live[cleared];
    if (!q?.hints || hintLevel >= HINT_LABELS.length) return;
    hintLevel++;
    hintText.hidden = false;
    hintText.textContent = hintLine(q.hints, q.answer, hintLevel);
    hintBtn.textContent = hintButtonLabel(hintLevel);
    hintBtn.disabled = hintLevel >= HINT_LABELS.length;
    ctx.sfx("tap");
  });

  function dropHandle(): void {
    try {
      handle?.destroy?.();
    } catch (err) {
      console.warn("[一朵一星] shape-kingdom 回顾切换时清理出错:", err);
    }
    handle = undefined;
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
    live = reviewQs;
    cleared = 0;
    resetHint();
    banner.hidden = false;
    banner.textContent = reviewIntro(reviewQs.length);
    const tail = msg ? `${msg} ` : "";
    const reviewCtx: PlayCtx = {
      ...ctx,
      // 回顾轮不判负：不管答成什么样，都按正题那一轮的成绩过关
      sfx: (name) => {
        if (name === "coin") {
          cleared++;
          resetHint();
        }
        ctx.sfx(name);
      },
      win: () => ctx.win(stars, `${tail}${REVIEW_DONE_LINE}`),
      lose: () => ctx.win(stars, `${tail}${REVIEW_TRIED_LINE}`),
    };
    handle = runner({ stage: quizHost, ctx: reviewCtx, questions: reviewQs, theme, maxWrong: reviewQs.length * 2 });
    fit.relayout();
  }

  const trackedCtx: PlayCtx = {
    ...ctx,
    sfx: (name) => {
      // 公共答题器答对响一声 coin、答错响一声 oops，靠这两声就能知道栽在哪一道
      if (name === "coin") {
        cleared++;
        resetHint();
      } else if (name === "oops" && cleared < questions.length) {
        missed.push(questions[cleared].kind);
      }
      ctx.sfx(name);
    },
    win: (stars, msg) => finish(stars, msg),
    lose: (msg) => {
      recordWrongKinds(missed, deps.storage);
      ctx.lose(msg);
    },
  };

  resetHint();
  handle = runner({ stage: quizHost, ctx: trackedCtx, questions, theme });
  fit.relayout();

  return {
    destroy() {
      destroyed = true;
      dropHandle();
      fit.dispose();
      quizHost.remove();
      panel?.remove();
      panel = null;
    },
  };
}
