/**
 * 时钟小屋 1.2：一关的运行器。
 *
 * 答题壳 `quiz99.ts`、朗读 `speech.ts`、188 关框架 `level99.ts` 都是公共资产（只读），
 * 本款要的两件事——「按题型给方法提示」和「关末错题回顾」——公共壳都没开口子，
 * 所以在自己目录里用现有 API 接：
 *
 *  1. **方法提示**：`quiz99` 连错 2 次会让正确选项一闪一闪并写一行通用提示（这套体验原样保留）。
 *     本款在同一时刻把那一行换成按题型给的**方法**，并朗读同一句。做法是在关卡容器上挂一个
 *     捕获阶段的点击监听自己数错次数，题目切换靠 `MutationObserver` 盯题面——**只读不改**壳的行为。
 *  2. **错题回顾**：`playLevel` 拿到的 `ctx` 是本款自己的，于是把 `ctx.win` 代理一层：
 *     正题答完先不结算，换一批「同类换数字」的题再来一轮，回顾轮做完才把原来的星级报上去。
 *     回顾轮不判失败、不改星级，只当一次温柔的复习。
 *
 * `destroy` 负责把两轮的壳、监听、timer、可拖钟面一起收干净。
 */
import type { PlayCtx, PlayHandle } from "../level99";
import { runQuiz } from "../quiz99";
import { speak } from "../speech";
import { mountDial, type DialHandle } from "./dial";
import { methodHint } from "./hints";
import { typeOfKind, type ClockKind } from "./kinds";
import { buildQuestions, makeReviewQuestions, CHAPTER_THEMES, type ClockQ } from "./levels";
import { recordMistakes } from "./mistakes";

/** 连错几次给方法提示（和 `quiz99.shouldHint` 的门槛保持一致，两边同时发生） */
export const HINT_AFTER_WRONG = 2;

/** 回顾轮的开场白 */
export const REVIEW_NOTE = "📒 错题回顾：同类的题换个数字再来一遍，做完这一关就收工！";

/** 回顾轮做完时补在结算语后面的一句 */
export const REVIEW_DONE = "错题也回顾完啦！";

/** 手机 360px 上钟面的最小直径（规格底线） */
export const MIN_FACE_PX = 200;

/**
 * 本款追加的样式，一律 `clk-` 前缀，只往后贴，不动 `qz-` / `l99-` 任何既有规则。
 */
export const CLK_CSS = `
.clk-dial-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.clk-dial-title { font-size: 18px; font-weight: 900; line-height: 1.5; word-break: keep-all; }
.clk-dial-read { font-size: 16px; font-weight: 800; color: #5c4a7d; }
.clk-face { width: min(62vw, 240px); min-width: ${MIN_FACE_PX}px; height: auto; touch-action: none; }
.clk-face-mini { width: 76px; height: 76px; }
.clk-toggle { min-height: 44px; min-width: 44px; border: none; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 15px; font-weight: 800; padding: 10px 18px; color: #5c4a7d;
  background: #ffffffe6; box-shadow: 0 3px 0 rgba(120,120,160,.3); }
.clk-toggle:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(120,120,160,.3); }
.clk-toggle:focus-visible, .clk-face:focus-visible { outline: 3px solid #3c2a6b; outline-offset: 3px; }
.clk-hint { font-size: 16px; line-height: 1.5; animation: clkHintIn .3s ease-out; }
.clk-review { text-align: center; font-size: 16px; font-weight: 800; color: #5c4a7d; line-height: 1.5;
  background: #ffffffcc; border-radius: 14px; padding: 8px 12px; margin-bottom: 6px; }
@keyframes clkHintIn { from { opacity: .2; } to { opacity: 1; } }
@media (max-width: 400px) {
  .clk-face { width: min(78vw, 240px); }
  .clk-face-mini { width: 68px; height: 68px; }
  .clk-dial-title { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .clk-hint { animation: none; }
  .clk-face-svg .clk-hand { transition: none; }
}
`;

interface HelperHandle {
  destroy: () => void;
}

/**
 * 关卡辅助层：数错次数给方法提示、接管可拖钟面。
 * 全程只读 `quiz99` 渲染出来的 DOM，不改它的判分，也不拦它的点击。
 */
function attachHelper(
  stage: HTMLElement,
  questions: readonly ClockQ[],
  onFirstWrong: (kind: ClockKind) => void
): HelperHandle {
  const prompt = stage.querySelector(".qz-prompt");
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const offs: Array<() => void> = [];
  let observer: MutationObserver | null = null;
  let dial: DialHandle | null = null;
  let index = 0;
  let wrongHere = 0;
  let reported = false;
  let dead = false;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
  }

  function wireDial(): void {
    dial?.destroy();
    dial = null;
    const svg = prompt?.querySelector("[data-clk-dial]");
    if (svg) dial = mountDial(svg);
  }

  function advance(): void {
    if (dead) return;
    index = Math.min(index + 1, Math.max(0, questions.length - 1));
    wrongHere = 0;
    reported = false;
    const msg = stage.querySelector(".qz-msg");
    if (msg instanceof HTMLElement) msg.classList.remove("clk-hint");
    wireDial();
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
    wrongHere++;
    if (!reported) {
      reported = true;
      onFirstWrong(q.kind);
    }
    if (wrongHere < HINT_AFTER_WRONG) return;
    const line = methodHint(q.kind);
    // 壳自己那行通用提示排在我们后面（它的监听挂在按钮上，我们是容器捕获阶段），
    // 所以排一个 0ms 的 timer 落到它之后，把同一行换成方法提示，并朗读同一句。
    later(() => {
      const msg = stage.querySelector(".qz-msg");
      if (msg instanceof HTMLElement) {
        msg.textContent = line;
        msg.classList.add("clk-hint");
      }
      speak(line);
    }, 0);
  };

  stage.addEventListener("click", onClick, true);
  offs.push(() => stage.removeEventListener("click", onClick, true));

  if (prompt && typeof MutationObserver === "function") {
    observer = new MutationObserver(() => advance());
    observer.observe(prompt, { childList: true });
  }
  wireDial();

  return {
    destroy() {
      dead = true;
      observer?.disconnect();
      observer = null;
      while (offs.length) offs.pop()?.();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      dial?.destroy();
      dial = null;
    },
  };
}

/** 一关：正题一轮 + 错题回顾一轮 */
export function playClockLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const theme = CHAPTER_THEMES[ctx.chapterIndex] ?? CHAPTER_THEMES[0];
  const style = stage.ownerDocument.createElement("style");
  style.textContent = CLK_CSS;
  stage.appendChild(style);

  let quiz: PlayHandle | null = null;
  let helper: HelperHandle | null = null;
  let banner: HTMLElement | null = null;
  let destroyed = false;
  let reviewing = false;
  const wrongKinds: ClockKind[] = [];

  function dropRound(): void {
    helper?.destroy();
    helper = null;
    try {
      quiz?.destroy?.();
    } catch (err) {
      console.warn("[一朵一星] clock-house 关卡清理出错:", err);
    }
    quiz = null;
    banner?.remove();
    banner = null;
  }

  function noteWrong(kind: ClockKind): void {
    if (!wrongKinds.includes(kind)) wrongKinds.push(kind);
  }

  function startReview(stars: 1 | 2 | 3, msg?: string): void {
    const questions = makeReviewQuestions(wrongKinds, ctx.level, 0, mainQuestions.map((q) => q.promptHTML));
    if (questions.length === 0) {
      ctx.win(stars, msg);
      return;
    }
    dropRound();
    banner = stage.ownerDocument.createElement("div");
    banner.className = "clk-review";
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
      // 回顾轮只复习不判失败：容错次数给到远超题量，错几次都能做完
      maxWrong: questions.length * 20 + 20,
      skipped: false,
    });
    helper = attachHelper(stage, questions, () => {});
    speak(REVIEW_NOTE);
  }

  const mainCtx: PlayCtx = {
    ...ctx,
    win(stars, msg) {
      if (destroyed) return;
      if (reviewing || wrongKinds.length === 0) {
        ctx.win(stars, msg);
        return;
      }
      reviewing = true;
      recordMistakes(wrongKinds.map(typeOfKind));
      startReview(stars, msg);
    },
  };

  const mainQuestions = buildQuestions(ctx.level);
  quiz = runQuiz({ stage, ctx: mainCtx, questions: mainQuestions, theme });
  helper = attachHelper(stage, mainQuestions, noteWrong);

  return {
    destroy() {
      destroyed = true;
      dropRound();
      style.remove();
    },
  };
}
