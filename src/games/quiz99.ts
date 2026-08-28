/**
 * 学习类游戏共用的「答题关」运行器。
 * 每关若干道选择题：答错温柔鼓励、原题继续，答对夸奖前进；
 * 全部答完按答错次数评星（0 错=3 星，错得少=2 星，其余 1 星，长题组的阈值按题量放宽）；
 * 答错太多次则温柔失败，可重试本关（绝不批评孩子）。
 *
 * 1.1 起题量上限跟随 188 关框架：一关最多 188 道题，容错次数、连对奖励节奏、
 * 评星阈值都按题量自动缩放；被家长授权跳过的关重玩时会显示一条温柔的「跳过」提示。
 */
import { TOTAL_LEVELS, type PlayCtx, type PlayHandle } from "./level99";
// 契约文件只有常量与纯逻辑,不会把弹窗 UI 拖进答题壳的 chunk
import { clampJumpTarget, isRootOpen } from "../ui/root12Contract";
import { speak, speechReady, stopSpeaking, whenSpeechReady } from "./speech";

export interface QuizQuestion {
  /** 题干 HTML（可以是大表情、汉字、SVG…） */
  promptHTML: string;
  /** 朗读式引导语，例如「哪个是小猫的猫？」 */
  ask: string;
  /** 选项显示内容（文本或 HTML） */
  choices: string[];
  /** 正确选项下标 */
  correct: number;
  /** 答对时的补充说明（可选） */
  praise?: string;
}

export interface QuizTheme {
  bg: string;
  accent: string;
}

export interface QuizOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  questions: QuizQuestion[];
  theme: QuizTheme;
  /** 允许答错的总次数，超过则温柔失败（不传则按题量自动给：短题组仍是 3） */
  maxWrong?: number;
  /** 选项按钮更大（适合单字/数字） */
  bigChoices?: boolean;
  /** 本关此前被家长授权跳过过（不传则读 ctx.skipped） */
  skipped?: boolean;
}

/** 一关最多能塞的题量，跟随 188 关框架 */
export const MAX_QUESTIONS = TOTAL_LEVELS;

export const PRAISES = ["答对啦！真棒！", "好厉害呀！", "又快又准！", "太聪明啦！", "就是它！"];
export const CHEERS = ["没关系，再想一想～", "差一点点，你可以的！", "别着急，慢慢来～", "再看一眼，答案就在里面！"];
const HINT_LINE = "悄悄提示：一闪一闪的那个就是答案！";
/** 答错到上限时的收尾话：只安抚，不评价孩子 */
export const FAIL_LINE = "这一关的题目有点调皮，我们休息一下再来一次！";
/** 被跳过的关重玩时的提示：不提「跳过」当缺点，只当一次可以随时补回来的机会 */
export const SKIP_NOTE = "🏳️ 这一关之前跳过了，现在回来把它拿下吧！";

/**
 * 是否给「悄悄提示」（让正确选项一闪一闪）：
 * - 同一道题连错 2 次：孩子明显卡住了，指条路比让他乱猜更能学到东西；
 * - 或者总错数已到上限（再错一次就温柔失败）：最后一次机会不让孩子踩空。
 * 纯函数便于测试。
 */
export function shouldHint(wrongHere: number, wrongTotal: number, maxWrong: number): boolean {
  return wrongHere >= 2 || wrongTotal >= maxWrong;
}

/** 题量合法化：至少 1 道，最多 188 道（超出的直接截掉，绝不让长题组卡死一关） */
export function clampQuestions<T>(questions: readonly T[]): T[] {
  return questions.slice(0, MAX_QUESTIONS);
}

/**
 * 没显式给 maxWrong 时的容错次数：短题组维持 1.0 的 3 次，
 * 题量越大越宽松（188 题给 24 次），免得长关卡因为手滑一路重来。
 */
export function defaultMaxWrong(total: number): number {
  return Math.max(3, Math.ceil(Math.max(0, total) / 8));
}

/**
 * 评星：全对 3 星；错得少 2 星；其余 1 星。
 * 2 星阈值随题量放宽（题量的一成，至少 2 次），保证 188 题的关卡不会因为错 3 次就掉到 1 星。
 */
export function quizStars(wrong: number, total: number): 1 | 2 | 3 {
  if (wrong <= 0) return 3;
  const twoAt = Math.max(2, Math.round(Math.max(0, total) * 0.1));
  return wrong <= twoAt ? 2 : 1;
}

/** 连对多少题奖励一颗平台小星星：长题组把节奏放慢，避免一关刷出几十颗 */
export function bonusStreakStep(total: number): number {
  return total <= 24 ? 4 : 8;
}

/** 一关最多能拿到的连对奖励星数（长题组也不会通货膨胀） */
export const MAX_BONUS_PER_LEVEL = 8;

/** 进度徽章文案：长题组额外报一句还剩多少，孩子心里有数 */
export function quizProgressText(index: number, total: number): string {
  const head = `第 ${index + 1} / ${total} 题`;
  return total >= 20 ? `${head} · 还剩 ${Math.max(0, total - index - 1)}` : head;
}

/**
 * 直达第 N 题的控件该不该出现：只有管理员权限开着才出现，
 * 关着 / 过期时连 DOM 都不生成（和攻略按钮一个套路，单测环境保持干净）。
 */
export function quizJumpVisible(nowMs: number = Date.now()): boolean {
  return isRootOpen(nowMs);
}

/**
 * 输入框里的「第 N 题」→ 0 基题号；越界夹到 1..total，读不出数字返回 null。
 * 直达不改错题数、不改评星口径，只是把题号挪过去。
 */
export function quizJumpIndex(raw: string, total: number): number | null {
  const max = Number.isFinite(total) && total >= 1 ? Math.min(Math.floor(total), MAX_QUESTIONS) : 1;
  const n = clampJumpTarget(raw, max);
  return n === null ? null : n - 1;
}

/** 全部答完时的收尾夸奖（不批评、只肯定完成度） */
export function quizFinishLine(wrong: number, total: number): string {
  if (wrong === 0) return "全部一次答对，太了不起啦！";
  return `${total} 道题全部完成！`;
}

const QUIZ_CSS = `
.qz-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; border-radius: 16px; padding: 14px; user-select: none; position: relative; min-height: 380px; display: flex; flex-direction: column; gap: 10px; }
.qz-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.qz-badge { background: #ffffffd9; border-radius: 999px; padding: 5px 12px; font-weight: 800; font-size: 14px; box-shadow: 0 2px 6px rgba(120,120,160,.2); }
.qz-bar { height: 10px; background: #ffffffb0; border-radius: 8px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.qz-fill { height: 100%; width: 0%; border-radius: 8px; transition: width .3s; }
.qz-prompt { background: #fff; border-radius: 18px; padding: 14px; text-align: center; font-size: 42px; font-weight: 900; box-shadow: 0 3px 10px rgba(120,120,160,.15); line-height: 1.3; min-height: 78px; display: flex; align-items: center; justify-content: center; }
.qz-ask { text-align: center; font-size: 17px; font-weight: 800; min-height: 24px; }
.qz-choices { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.qz-choice { min-width: 84px; min-height: 64px; border: none; border-radius: 18px; background: #fff; cursor: pointer; font-size: 26px; font-weight: 900; box-shadow: 0 4px 0 rgba(120,120,160,.3); font-family: inherit; padding: 8px 16px; transition: transform .12s; }
.qz-choice.qz-big { min-width: 96px; min-height: 80px; font-size: 34px; }
.qz-choice:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(120,120,160,.3); }
.qz-choice.qz-wrong { animation: qzShake .4s; opacity: .5; }
@keyframes qzShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.qz-choice.qz-right { animation: qzPop2 .4s; background: #E4F9E0; }
@keyframes qzPop2 { 50% { transform: scale(1.12); } }
.qz-choice.qz-hint { animation: qzTwinkle 1s ease-in-out infinite; box-shadow: 0 0 0 4px #ffd43b, 0 4px 0 rgba(120,120,160,.3); }
@keyframes qzTwinkle { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.qz-msg { text-align: center; min-height: 24px; font-weight: 800; font-size: 15px; }
.qz-skip { text-align: center; font-weight: 800; font-size: 14px; background: #ffffffcc; border-radius: 14px; padding: 6px 10px; }
.qz-choice:focus-visible, .qz-say:focus-visible { outline: 3px solid #3c2a6b; outline-offset: 3px; }
.qz-say-row { display: flex; justify-content: center; }
.qz-say { border: none; border-radius: 999px; background: #ffffffe6; cursor: pointer; font-family: inherit; font-weight: 900; font-size: 16px; padding: 10px 24px; min-height: 46px; box-shadow: 0 3px 0 rgba(120,120,160,.3); }
.qz-say:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(120,120,160,.3); }
.qz-jump { display: flex; gap: 6px; align-items: center; justify-content: center; flex-wrap: wrap; }
.qz-jump-input { width: 76px; min-height: 44px; border: 2px solid #e0d6f2; border-radius: 12px; padding: 0 8px; font-family: inherit; font-size: 15px; font-weight: 800; }
.qz-jump-go { border: none; border-radius: 999px; padding: 8px 16px; font-family: inherit; font-size: 14px; font-weight: 900; cursor: pointer; background: #ffffffe6; box-shadow: 0 3px 0 rgba(120,120,160,.3); min-height: 44px; display: inline-flex; align-items: center; }
.qz-jump-input:focus-visible, .qz-jump-go:focus-visible { outline: 3px solid #3c2a6b; outline-offset: 3px; }
/* L-1(trio-r5):横屏矮屏(915×412 一族)答题器整块比舞台可视段还高,选项钮掉到折叠线下。
   只收空隙与展示字号:题面从 42px 收到 26px 仍旧醒目,选项与朗读钮热区保持 ≥44px,
   题目说明(.qz-ask)那档正文 16px 红线不动。竖屏与平板(高 >500px)零变化。 */
@media (max-height: 500px) {
  .qz-wrap { min-height: 0; padding: 8px 10px; gap: 6px; }
  .qz-prompt { font-size: 26px; min-height: 44px; padding: 6px 10px; }
  /* 题面插图(形状图/钟面这类 svg)按配方收高:选项行必须进屏,插图缩一点不影响认读 */
  .qz-prompt svg, .qz-prompt img { max-height: 64px; width: auto; }
  /* N-44:农场竖式是 DOM(.mtf-vert)+题下作物卡(.mtf-illus),不是 svg,旧选择器漏了 */
  .qz-prompt .mtf-vert, .qz-wrap > .mtf-illus:not(.mtf-illus-count) { max-height: 64px; overflow: hidden; }
  .qz-choices { gap: 8px; }
  .qz-choice { min-height: 46px; font-size: 22px; padding: 4px 12px; }
  .qz-choice.qz-big { min-width: 84px; min-height: 48px; font-size: 26px; }
  .qz-msg { min-height: 18px; }
  .qz-ask { min-height: 20px; }
  .qz-say { min-height: 44px; padding: 6px 18px; }
  .qz-jump-go { min-height: 44px; padding: 8px 16px; }
  .qz-badge { padding: 3px 10px; }
  /* L-1 补账(trio-r7):紧凑档收完 915×412 仍差 43px——题面 76 + 选项 46 + 消息 18
     纵排挤不进 202px 的可视窗,选项钮下缘裁 11、答后反馈整行线下。
     再切「题面左 / 问句+朗读+选项+消息右」双栏:读题 → 作答同屏零滚动。
     span 4 恰好盖住右栏四个常驻项(跨到空行 Chrome 会把题面高摊进去凭空长高);
     可选行(跳关说明/直达)整行横跨,在不在都不错位。竖屏与平板零变化。 */
  .qz-wrap { display: grid; grid-template-columns: minmax(0,1fr) minmax(300px,55%); column-gap: 12px; row-gap: 4px; align-items: start; }
  .qz-top, .qz-bar, .qz-skip, .qz-jump { grid-column: 1/-1; }
  .qz-prompt { grid-column: 1; grid-row: span 4; align-self: stretch; }
  .qz-ask, .qz-say-row, .qz-choices, .qz-msg { grid-column: 2; }
}
`;

export function runQuiz(opts: QuizOptions): PlayHandle {
  const { stage, ctx, theme } = opts;
  const questions = clampQuestions(opts.questions);
  const maxWrong = opts.maxWrong ?? defaultMaxWrong(questions.length);
  const streakStep = bonusStreakStep(questions.length);
  const wasSkipped = opts.skipped ?? ctx.skipped ?? false;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let index = 0;
  let wrong = 0;
  let wrongHere = 0;
  let streak = 0;
  let bonusGiven = 0;
  let locked = false;

  if (questions.length === 0) {
    // 题目没生成出来也不许白屏：给一句温柔的话，孩子可以回地图换一关
    const empty = document.createElement("div");
    empty.className = "qz-wrap";
    empty.style.background = theme.bg;
    empty.innerHTML = `<style>${QUIZ_CSS}</style><div class="qz-msg" style="color:${theme.accent}">这一关的题目还在路上，先回地图挑一关玩吧！</div>`;
    stage.appendChild(empty);
    return {
      destroy() {
        empty.remove();
      }
    };
  }

  const wrap = document.createElement("div");
  wrap.className = "qz-wrap";
  wrap.style.background = theme.bg;
  wrap.innerHTML = `
    <style>${QUIZ_CSS}</style>
    <div class="qz-top">
      <span class="qz-badge qz-progress" style="color:${theme.accent}">${quizProgressText(0, questions.length)}</span>
      <span class="qz-badge qz-streak" style="color:#b84708">🔥 连对 0</span>
    </div>
    <div class="qz-bar"><div class="qz-fill" style="background:${theme.accent}"></div></div>
    ${wasSkipped ? `<div class="qz-skip" style="color:${theme.accent}">${SKIP_NOTE}</div>` : ""}
    <div class="qz-prompt"></div>
    <div class="qz-ask" style="color:${theme.accent}"></div>
    <div class="qz-say-row"><button type="button" class="qz-say" style="color:${theme.accent}" hidden>🔈 再听一遍</button></div>
    <div class="qz-choices"></div>
    <div class="qz-msg" style="color:${theme.accent}"></div>
  `;
  stage.appendChild(wrap);

  const progressEl = wrap.querySelector(".qz-progress") as HTMLElement;
  const streakEl = wrap.querySelector(".qz-streak") as HTMLElement;
  const fillEl = wrap.querySelector(".qz-fill") as HTMLElement;
  const promptEl = wrap.querySelector(".qz-prompt") as HTMLElement;
  const askEl = wrap.querySelector(".qz-ask") as HTMLElement;
  const choicesEl = wrap.querySelector(".qz-choices") as HTMLElement;
  const msgEl = wrap.querySelector(".qz-msg") as HTMLElement;
  const sayBtn = wrap.querySelector(".qz-say") as HTMLButtonElement;

  // 朗读：题目切换自动读 ask；没有中文语音包时按钮保持隐藏、全程静默
  sayBtn.addEventListener("click", () => {
    if (!ended && index < questions.length) speak(questions[index].ask);
  });
  let speechOn = speechReady();
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
    if (!speechOn) {
      // 语音包姗姗来迟：补读当前这道题
      speechOn = true;
      if (!destroyed && !ended && index < questions.length) speak(questions[index].ask);
    }
  });

  /**
   * 直达第 N 题:只有管理员权限开着时才生成控件,关着时连 DOM 都不出现。
   * 直达不改错题数、不改评星口径,只是把题号挪过去。
   */
  function attachRootJump(): void {
    if (!quizJumpVisible()) return;
    const row = document.createElement("div");
    row.className = "qz-jump";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = String(questions.length);
    input.className = "qz-jump-input";
    input.value = "1";
    input.setAttribute("aria-label", `直达第几题,1 到 ${questions.length}`);
    const go = document.createElement("button");
    go.type = "button";
    go.className = "qz-jump-go";
    go.textContent = "🎫 直达这题";
    const jump = (): void => {
      if (ended || destroyed) return;
      const target = quizJumpIndex(input.value, questions.length);
      if (target === null) return;
      input.value = String(target + 1);
      index = target;
      show();
    };
    go.addEventListener("click", jump);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        jump();
      }
    });
    row.append(input, go);
    wrap.insertBefore(row, promptEl);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function show(): void {
    const q = questions[index];
    progressEl.textContent = quizProgressText(index, questions.length);
    streakEl.textContent = `🔥 连对 ${streak}`;
    fillEl.style.width = `${(index / questions.length) * 100}%`;
    promptEl.innerHTML = q.promptHTML;
    askEl.textContent = q.ask;
    choicesEl.innerHTML = "";
    q.choices.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `qz-choice${opts.bigChoices ? " qz-big" : ""}`;
      btn.innerHTML = c;
      btn.addEventListener("click", () => onChoice(btn, i));
      choicesEl.appendChild(btn);
    });
    wrongHere = 0;
    locked = false;
    speak(q.ask);
  }

  function onChoice(btn: HTMLButtonElement, i: number): void {
    if (locked || ended) return;
    const q = questions[index];
    ctx.sfx("tap");
    if (i === q.correct) {
      locked = true;
      streak++;
      ctx.sfx("coin");
      btn.classList.add("qz-right");
      let praise = q.praise ?? PRAISES[Math.floor(Math.random() * PRAISES.length)];
      if (streak > 0 && streak % streakStep === 0 && bonusGiven < MAX_BONUS_PER_LEVEL) {
        bonusGiven++;
        ctx.bonusStars(1);
        praise = `🔥 连对 ${streak} 题，奖励一颗小星星！`;
      }
      msgEl.textContent = praise;
      speak(praise);
      streakEl.textContent = `🔥 连对 ${streak}`;
      later(() => {
        index++;
        if (index >= questions.length) {
          ended = true;
          fillEl.style.width = "100%";
          const got = quizStars(wrong, questions.length);
          later(() => ctx.win(got, quizFinishLine(wrong, questions.length)), 350);
        } else {
          show();
        }
      }, 850);
    } else {
      wrong++;
      wrongHere++;
      streak = 0;
      ctx.sfx("oops");
      btn.classList.add("qz-wrong");
      btn.disabled = true;
      streakEl.textContent = "🔥 连对 0";
      if (wrong > maxWrong) {
        ended = true;
        later(() => ctx.lose(FAIL_LINE), 500);
        return;
      }
      if (shouldHint(wrongHere, wrong, maxWrong)) {
        // 孩子卡住了：让正确选项一闪一闪,不让最后一次机会踩空
        const rightBtn = choicesEl.children[q.correct];
        if (rightBtn instanceof HTMLElement) rightBtn.classList.add("qz-hint");
        msgEl.textContent = HINT_LINE;
        speak(HINT_LINE);
        return;
      }
      const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      msgEl.textContent = cheer;
      speak(cheer);
    }
  }

  attachRootJump();
  show();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      unwatchSpeech();
      stopSpeaking();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    }
  };
}
