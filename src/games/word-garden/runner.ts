/**
 * 识字小花园 1.2：一关的运行器。
 *
 * 答题壳 `quiz99.ts`、朗读 `speech.ts`、188 关框架 `level99.ts` 都是公共资产（只读），
 * 本款要的「关末错题换题型复查」公共壳没开口子，所以在自己目录里用现有 API 接：
 *
 *  1. **认错字**：在关卡容器上挂一个**捕获阶段**的点击监听，自己数哪一道点错了；
 *     题目切换靠 `MutationObserver` 盯题面。全程**只读**壳渲染出来的 DOM，
 *     不拦点击、不改判分、不动壳里那套「连错两次让正确项一闪一闪」的体验。
 *  2. **复查轮**：`playLevel` 拿到的 `ctx` 是本款自己的，于是把 `ctx.win` 代理一层：
 *     正题答完先不结算，把答错过的**字**用**另一种题型**再考一轮，复查做完才把
 *     原来的星级报上去。复查轮不判失败、不改星级，只当一次温柔的回头看。
 *
 * `destroy` 负责把两轮的壳、监听、timer 一起收干净。
 */
import type { PlayCtx, PlayHandle } from "../level99";
import { runQuiz } from "../quiz99";
import { speak } from "../speech";
import { runBuildChar } from "./buildChar";
import {
  buildCharTask,
  buildQuestions,
  buildReviewRound,
  CHAPTER_THEMES,
  isBuildCharLevel,
  isTraceLevel,
  questionFocus,
  traceCharCount,
  type WordKind,
  type WordQ,
} from "./levels";
import { traceTask } from "./strokes";
import { recordMistakes } from "./mistakes";
import { runTracing } from "./tracing";

/** 复查轮的开场白 */
export const REVIEW_NOTE = "📒 错题本翻一翻：刚才不太有把握的字，换个问法再见一面～";

/** 复查轮做完时补在结算语后面的一句 */
export const REVIEW_DONE = "错题也都回头看过啦！";

/** 复查轮的提示条样式（`wgd-` 前缀，只往后贴） */
export const REVIEW_CSS = `
.wgd-review{text-align:center;font-size:16px;font-weight:800;color:#5c4a7d;line-height:1.5;
  background:#ffffffcc;border-radius:14px;padding:8px 12px;margin-bottom:6px;
  font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
`;

interface WatcherHandle {
  destroy: () => void;
}

/**
 * 只读地盯着答题壳：记下每一道题第一次点错时考的是哪个字。
 * 同一道题错几次只记一次 —— 错题本要的是「哪个字没把握」，不是罚抄次数。
 */
function watchWrong(
  stage: HTMLElement,
  questions: readonly WordQ[],
  onWrong: (focus: string, kind: WordKind) => void
): WatcherHandle {
  const prompt = stage.querySelector(".qz-prompt");
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let observer: MutationObserver | null = null;
  let index = 0;
  let reported = false;
  let dead = false;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
  }

  function advance(): void {
    if (dead) return;
    index = Math.min(index + 1, Math.max(0, questions.length - 1));
    reported = false;
  }

  const onClick = (ev: Event): void => {
    if (dead) return;
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest(".qz-choice");
    const row = btn?.parentElement;
    if (!btn || !row) return;
    const at = Array.prototype.indexOf.call(row.children, btn);
    const q = questions[index];
    if (!q || at < 0) return;
    if (at === q.correct) {
      // 没有 MutationObserver 的环境靠这条自己跟上题号（壳答对 850ms 后才换题）
      if (!observer) later(advance, 900);
      return;
    }
    if (reported) return;
    reported = true;
    onWrong(questionFocus(q), q.kind);
  };

  stage.addEventListener("click", onClick, true);

  if (prompt && typeof MutationObserver === "function") {
    observer = new MutationObserver(() => advance());
    observer.observe(prompt, { childList: true });
  }

  return {
    destroy() {
      dead = true;
      observer?.disconnect();
      observer = null;
      stage.removeEventListener("click", onClick, true);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    },
  };
}

/** 一关：正题一轮 + 错题换题型复查一轮 */
function playQuizLevel(stage: HTMLElement, ctx: PlayCtx, theme: (typeof CHAPTER_THEMES)[number]): PlayHandle {
  const style = stage.ownerDocument.createElement("style");
  style.textContent = REVIEW_CSS;
  stage.appendChild(style);

  let quiz: PlayHandle | null = null;
  let watcher: WatcherHandle | null = null;
  let banner: HTMLElement | null = null;
  let destroyed = false;
  let reviewing = false;
  const wrong: Array<{ focus: string; kind: WordKind }> = [];

  function dropRound(): void {
    watcher?.destroy();
    watcher = null;
    try {
      quiz?.destroy?.();
    } catch (err) {
      console.warn("[一朵一星] word-garden 关卡清理出错:", err);
    }
    quiz = null;
    banner?.remove();
    banner = null;
  }

  function noteWrong(focus: string, kind: WordKind): void {
    if (!focus) return;
    if (wrong.some((w) => w.focus === focus)) return;
    wrong.push({ focus, kind });
  }

  function startReview(stars: 1 | 2 | 3, msg?: string): void {
    const questions = buildReviewRound(wrong, ctx.level);
    if (questions.length === 0) {
      ctx.win(stars, msg);
      return;
    }
    dropRound();
    banner = stage.ownerDocument.createElement("div");
    banner.className = "wgd-review";
    banner.textContent = REVIEW_NOTE;
    stage.appendChild(banner);
    const finish = (): void => {
      if (destroyed) return;
      ctx.win(stars, `${msg ?? ""} ${REVIEW_DONE}`.trim());
    };
    const reviewCtx: PlayCtx = { ...ctx, skipped: false, win: finish, lose: finish };
    quiz = runQuiz({
      stage,
      ctx: reviewCtx,
      questions,
      theme,
      // 复查轮只回头看，不判失败：容错次数给到远超题量，错几次都能做完
      maxWrong: questions.length * 20 + 20,
      bigChoices: true,
      skipped: false,
    });
    watcher = watchWrong(stage, questions, () => {});
    speak(REVIEW_NOTE);
  }

  const mainCtx: PlayCtx = {
    ...ctx,
    win(stars, msg) {
      if (destroyed) return;
      if (reviewing || wrong.length === 0) {
        ctx.win(stars, msg);
        return;
      }
      reviewing = true;
      recordMistakes(wrong.map((w) => w.focus));
      startReview(stars, msg);
    },
  };

  const questions = buildQuestions(ctx.level);
  quiz = runQuiz({ stage, ctx: mainCtx, questions, theme, bigChoices: true });
  watcher = watchWrong(stage, questions, noteWrong);

  return {
    destroy() {
      destroyed = true;
      dropRound();
      style.remove();
    },
  };
}

/** 一关到底走哪套玩法：描红台 / 组字工坊 / 答题 + 复查 */
export function playWordLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const theme = CHAPTER_THEMES[ctx.chapterIndex] ?? CHAPTER_THEMES[CHAPTER_THEMES.length - 1];
  if (isTraceLevel(ctx.level)) {
    return runTracing({ stage, ctx, chars: traceTask(ctx.level, traceCharCount(ctx.level)).chars, theme });
  }
  if (isBuildCharLevel(ctx.level)) {
    return runBuildChar({ stage, ctx, task: buildCharTask(ctx.level), theme });
  }
  return playQuizLevel(stage, ctx, theme);
}
