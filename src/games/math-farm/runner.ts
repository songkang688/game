/**
 * 算数小农场 1.2：一关的运行器。
 *
 * 答题壳 `quiz99.ts`、朗读 `speech.ts`、188 关框架 `level99.ts` 都是公共资产（只读），
 * 本款要的三件事——「分步提示」「答对欢呼」「关末错题回顾」——公共壳都没开口子，
 * 所以在自己目录里用现有 API 接：
 *
 *  1. **分步提示**：`quiz99` 连错 2 次会让正确选项一闪一闪并写一行通用提示（这套体验原样保留）。
 *     本款在同一时刻把那一行换成按题型给的**方法提示**，再错一次换成**拆一步**，并朗读同一句。
 *     做法是在关卡容器上挂一个捕获阶段的点击监听自己数错次数，题目切换靠 `MutationObserver`
 *     盯题面——**只读不改**壳的行为，不拦点击，也不碰判分。
 *  2. **答对欢呼**：同一个监听里认出答对，往舞台上放一只欢呼的农场小动物，几百毫秒后自己收走；
 *     答错什么都不加——不打红叉是这一款的红线。
 *  3. **错题回顾**：`playLevel` 拿到的 `ctx` 是本款自己的，于是把 `ctx.win` 代理一层：
 *     正题答完先不结算，按答错过的题型换一批「同类换数字」的新题再来一轮，回顾轮做完才把
 *     原来的星级报上去。回顾轮不判失败、不改星级，只当一次温柔的复习。
 *
 * `destroy` 负责把两轮的壳、监听、timer、欢呼节点一起收干净。
 */
import type { PlayCtx, PlayHandle } from "../level99";
import { runQuiz, type QuizOptions } from "../quiz99";
import { speak } from "../speech";
import type { MathQ } from "./gen";
import { methodHint, stepHint } from "./hints";
import type { MathKind } from "./kinds";
import { buildQuestions, makeReviewQuestions, typesOfKinds, CHAPTER_THEMES } from "./levels";
import { practiceLine, recordMistakes, type StorageLike } from "./mistakes";
import { fitIntoStage } from "./fit";
import { resetClippedScroll } from "./stageScroll";
import { createFarmLayer, type FarmLayer, type FarmVisualHooks } from "./farmLayer";

/** 连错几次给方法提示（和 `quiz99.shouldHint` 的门槛保持一致，两边同时发生） */
export const HINT_AFTER_WRONG = 2;

/** 再错一次就把题拆成两小步问 */
export const STEP_AFTER_WRONG = 3;

/** 回顾轮的开场白 */
export const REVIEW_NOTE = "📒 错题回顾：同类的题换个数字再来一遍，做完这一关就收工！";

/** 回顾轮做完时补在结算语后面的一句 */
export const REVIEW_DONE = "错题也回顾完啦！";

/** 答对时冒出来欢呼的农场小动物 */
export const CHEER_FACES = ["🐮", "🐑", "🐷", "🐔", "🦆", "🐰"];

/** 欢呼动画停留多久（毫秒） */
export const CHEER_MS = 900;

/** 竖式在 360px 窄屏上的最小字号（规格底线） */
export const MIN_VERT_PX = 22;

/**
 * 本款追加的样式，一律 `mtf-` 前缀，只往后贴，不动 `qz-` / `l99-` 任何既有规则。
 */
export const MTF_CSS = `
.mtf-vert { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 2px;
  font-variant-numeric: tabular-nums; letter-spacing: 4px; line-height: 1.25; }
.mtf-vert-row { font-size: 38px; font-weight: 900; }
.mtf-vert-rule { width: 100%; min-width: 116px; height: 4px; border-radius: 2px; background: #5c4a7d; margin: 4px 0 2px; }
.mtf-word { display: block; font-size: 19px; font-weight: 800; line-height: 1.6; max-height: 34vh; overflow-y: auto; }
.mtf-slot { color: #c2410c; }
.mtf-x { color: #1e40af; font-style: italic; }
.mtf-hint { font-size: 16px; line-height: 1.5; animation: mtfHintIn .3s ease-out; }
.mtf-step { font-size: 16px; line-height: 1.5; font-weight: 900; animation: mtfHintIn .3s ease-out; }
.mtf-review { text-align: center; font-size: 16px; font-weight: 800; color: #5c4a7d; line-height: 1.5;
  background: #ffffffcc; border-radius: 14px; padding: 8px 12px; margin-bottom: 6px; }
/* 答题壳自己的那一层宿主。本档五款里只有这一款原来把答题壳直接渲染进舞台,
   于是横过来拿的时候三颗选项整排掉在裁切线以下,而舞台是定高 + overflow hidden
   (平台文件,交窗口1),既不滚也没提示。宿主由 fitIntoStage() 钳进看得见的那一段,
   内容一高就在这儿滚。min-width 0 是给 flex 子项松绑,免得长题面把宿主撑出舞台。 */
.mtf-quizhost { min-width: 0; width: 100%; }
.mtf-cheer { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; font-size: 34px;
  pointer-events: none; animation: mtfCheer .9s ease-out; }
@keyframes mtfHintIn { from { opacity: .2; } to { opacity: 1; } }
@keyframes mtfCheer { 0% { opacity: 0; transform: translateY(10px); } 30% { opacity: 1; transform: translateY(-6px); }
  100% { opacity: 0; transform: translateY(-18px); } }
@media (max-width: 400px) {
  .mtf-vert-row { font-size: ${MIN_VERT_PX}px; letter-spacing: 3px; }
  .mtf-vert-rule { min-width: 84px; }
  .mtf-word { font-size: 17px; max-height: 28vh; }
}
@media (max-height: 500px) {
  .mtf-vert-row { font-size: ${MIN_VERT_PX}px; letter-spacing: 2px; }
  .mtf-vert-rule { margin: 2px 0 1px; }
  /* N-97:应用题题面收到正文红线 16px,两行从 77px 回到 ~58px,少挡一截。
     答案行钉底与 root 态重排属于换肤规则,按规矩放 FARM_CSS。 */
  .mtf-word { font-size: 16px; line-height: 1.45; }
}
@media (prefers-reduced-motion: reduce) {
  .mtf-hint { animation: none; }
  .mtf-step { animation: none; text-decoration: underline; }
  .mtf-cheer { animation: none; opacity: 1; }
}
`;

export interface HelperHandle {
  destroy: () => void;
}

/**
 * 玩法之外的两个接缝，只给用例换零件用；线上跑的永远是 `quiz99` 与 `localStorage`。
 */
export interface FarmDeps {
  /** 答题壳（默认 `quiz99` 的 `runQuiz`） */
  runner?: (opts: QuizOptions) => PlayHandle;
  /** 错题本存哪儿（默认 `localStorage`） */
  storage?: StorageLike | null;
}

/**
 * 关卡辅助层：数错次数给两级提示、答对放一只欢呼的小动物。
 * 全程只读 `quiz99` 渲染出来的 DOM，不改它的判分，也不拦它的点击。
 * 1.3 起多一个可选的 `visual` 口子：换题 / 答对 / 答错时喊农场视觉层一声，
 * 视觉层只画不判，这里的计数、提示、朗读一行没变。
 */
export function attachFarmHelper(
  stage: HTMLElement,
  questions: readonly MathQ[],
  onFirstWrong: (q: MathQ) => void,
  visual?: FarmVisualHooks
): HelperHandle {
  const prompt = stage.querySelector(".qz-prompt");
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const offs: Array<() => void> = [];
  let observer: MutationObserver | null = null;
  let cheer: HTMLElement | null = null;
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

  function dropCheer(): void {
    cheer?.remove();
    cheer = null;
  }

  function advance(): void {
    if (dead) return;
    index = Math.min(index + 1, Math.max(0, questions.length - 1));
    wrongHere = 0;
    reported = false;
    const msg = stage.querySelector(".qz-msg");
    if (msg instanceof HTMLElement) msg.classList.remove("mtf-hint", "mtf-step");
    dropCheer();
    visual?.onQuestion(index);
  }

  /** 答对了：让一只农场小动物冒出来欢呼一下（答错什么都不加，绝不打红叉） */
  function cheerUp(): void {
    dropCheer();
    const el = stage.ownerDocument.createElement("div");
    el.className = "mtf-cheer";
    el.setAttribute("aria-hidden", "true");
    el.textContent = `${CHEER_FACES[index % CHEER_FACES.length]} 🎉`;
    const wrap = stage.querySelector(".qz-wrap");
    (wrap instanceof HTMLElement ? wrap : stage).appendChild(el);
    cheer = el;
    later(dropCheer, CHEER_MS);
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
      cheerUp();
      visual?.onCorrect(index);
      // 没有 MutationObserver 的环境靠这条自己跟上题号（壳答对 850ms 后才换题）
      if (!observer) later(advance, 900);
      return;
    }
    wrongHere++;
    visual?.onWrong(index);
    if (!reported) {
      reported = true;
      onFirstWrong(q);
    }
    if (wrongHere < HINT_AFTER_WRONG) return;
    const line = wrongHere >= STEP_AFTER_WRONG ? stepHint(q.kind, q.spec) : methodHint(q.kind);
    const cls = wrongHere >= STEP_AFTER_WRONG ? "mtf-step" : "mtf-hint";
    // 壳自己那行通用提示排在我们后面（它的监听挂在按钮上，我们是容器捕获阶段），
    // 所以排一个 0ms 的 timer 落到它之后，把同一行换成本款的提示，并朗读同一句。
    later(() => {
      const msg = stage.querySelector(".qz-msg");
      if (msg instanceof HTMLElement) {
        msg.textContent = line;
        msg.classList.remove("mtf-hint", "mtf-step");
        msg.classList.add(cls);
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

  return {
    destroy() {
      dead = true;
      observer?.disconnect();
      observer = null;
      while (offs.length) offs.pop()?.();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      dropCheer();
    },
  };
}

/** 一关：正题一轮 + 错题回顾一轮 */
export function playFarmLevel(stage: HTMLElement, ctx: PlayCtx, deps: FarmDeps = {}): PlayHandle {
  const runRound = deps.runner ?? runQuiz;
  const theme = CHAPTER_THEMES[ctx.chapterIndex] ?? CHAPTER_THEMES[0];
  const style = stage.ownerDocument.createElement("style");
  style.textContent = MTF_CSS;
  stage.appendChild(style);
  // 地图上「🎯 跳到当前关」留下的 scrollTop 会被带进关内，把 `🗺️ 选关` 顶到裁切线
  // 以上（W5-B-09）。进关这一刻归 0。
  resetClippedScroll(stage);

  // 答题壳挂在本款自己的宿主里,宿主再钳进舞台看得见的那一段:内容一高就在这里滚,
  // 而不是被舞台默默裁掉(真机 844×390 上三颗选项整排掉在线外,一处都滚不动)。
  // 回顾横幅留在宿主外面不跟着滚,孩子滑题面时那句话一直看得见。
  const quizHost = stage.ownerDocument.createElement("div");
  quizHost.className = "mtf-quizhost";
  stage.appendChild(quizHost);
  const fit = fitIntoStage(quizHost);

  let quiz: PlayHandle | null = null;
  let helper: HelperHandle | null = null;
  let farm: FarmLayer | null = null;
  let banner: HTMLElement | null = null;
  let destroyed = false;
  let reviewing = false;
  const wrongKinds: MathKind[] = [];

  function dropRound(): void {
    helper?.destroy();
    helper = null;
    farm?.destroy();
    farm = null;
    try {
      quiz?.destroy?.();
    } catch (err) {
      console.warn("[一朵一星] math-farm 关卡清理出错:", err);
    }
    quiz = null;
    banner?.remove();
    banner = null;
  }

  function noteWrong(q: MathQ): void {
    if (!wrongKinds.includes(q.kind)) wrongKinds.push(q.kind);
  }

  function startReview(stars: 1 | 2 | 3, msg?: string): void {
    const questions = makeReviewQuestions(
      wrongKinds,
      ctx.level,
      0,
      mainQuestions.map((q) => q.promptHTML)
    );
    if (questions.length === 0) {
      ctx.win(stars, msg);
      return;
    }
    dropRound();
    banner = stage.ownerDocument.createElement("div");
    banner.className = "mtf-review";
    banner.textContent = `${REVIEW_NOTE} ${practiceLine(typesOfKinds(wrongKinds))}`;
    stage.insertBefore(banner, quizHost);
    const finish = (): void => {
      if (destroyed) return;
      ctx.win(stars, `${msg ?? ""} ${REVIEW_DONE}`.trim());
    };
    const reviewCtx: PlayCtx = { ...ctx, skipped: false, win: finish, lose: finish };
    quiz = runRound({
      stage: quizHost,
      ctx: reviewCtx,
      questions,
      theme,
      // 回顾轮只复习不判失败：容错次数给到远超题量，错几次都能做完
      maxWrong: questions.length * 20 + 20,
      skipped: false,
      bigChoices: true,
    });
    farm = createFarmLayer(stage, questions);
    helper = attachFarmHelper(stage, questions, () => {}, farm);
    // 横幅一挂上来这一屏就长高一截,钳位跟着重算
    fit.relayout();
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
      recordMistakes(typesOfKinds(wrongKinds), deps.storage);
      startReview(stars, msg);
    },
  };

  const mainQuestions = buildQuestions(ctx.level);
  quiz = runRound({
    stage: quizHost,
    ctx: mainCtx,
    questions: mainQuestions,
    theme,
    bigChoices: true,
  });
  farm = createFarmLayer(stage, mainQuestions);
  helper = attachFarmHelper(stage, mainQuestions, noteWrong, farm);
  fit.relayout();

  // 换一道题题面高度就变(竖式 38px 三行 vs 一行文字题差着 60 多像素),钳位得跟着走。
  // 盯宿主的子树就够:quiz99 换题是重建 .qz-prompt / .qz-choices 的孩子。
  // 没有 MutationObserver 的环境(测试桩)什么都不做——那儿也量不出高度。
  let watcher: MutationObserver | null = null;
  if (typeof MutationObserver === "function") {
    watcher = new MutationObserver(() => fit.relayout());
    watcher.observe(quizHost, { childList: true, subtree: true, characterData: true });
  }

  return {
    destroy() {
      destroyed = true;
      watcher?.disconnect();
      watcher = null;
      fit.dispose();
      dropRound();
      quizHost.remove();
      style.remove();
    },
  };
}
