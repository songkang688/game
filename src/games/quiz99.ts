/**
 * 学习类游戏共用的「答题关」运行器。
 * 每关若干道选择题：答错温柔鼓励、原题继续，答对夸奖前进；
 * 全部答完按答错次数评星（0 错=3 星，≤2 错=2 星，其余 1 星）；
 * 答错太多次则温柔失败，可重试本关（绝不批评孩子）。
 */
import type { PlayCtx, PlayHandle } from "./level99";
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
  /** 允许答错的总次数，超过则温柔失败（默认 3） */
  maxWrong?: number;
  /** 选项按钮更大（适合单字/数字） */
  bigChoices?: boolean;
}

const PRAISES = ["答对啦！真棒！", "好厉害呀！", "又快又准！", "太聪明啦！", "就是它！"];
const CHEERS = ["没关系，再想一想～", "差一点点，你可以的！", "别着急，慢慢来～", "再看一眼，答案就在里面！"];

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
.qz-msg { text-align: center; min-height: 24px; font-weight: 800; font-size: 15px; }
.qz-say-row { display: flex; justify-content: center; }
.qz-say { border: none; border-radius: 999px; background: #ffffffe6; cursor: pointer; font-family: inherit; font-weight: 900; font-size: 16px; padding: 10px 24px; min-height: 46px; box-shadow: 0 3px 0 rgba(120,120,160,.3); }
.qz-say:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(120,120,160,.3); }
`;

export function runQuiz(opts: QuizOptions): PlayHandle {
  const { stage, ctx, questions, theme } = opts;
  const maxWrong = opts.maxWrong ?? 3;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let index = 0;
  let wrong = 0;
  let streak = 0;
  let locked = false;

  const wrap = document.createElement("div");
  wrap.className = "qz-wrap";
  wrap.style.background = theme.bg;
  wrap.innerHTML = `
    <style>${QUIZ_CSS}</style>
    <div class="qz-top">
      <span class="qz-badge qz-progress" style="color:${theme.accent}">第 1 / ${questions.length} 题</span>
      <span class="qz-badge qz-streak" style="color:#e8590c">🔥 连对 0</span>
    </div>
    <div class="qz-bar"><div class="qz-fill" style="background:${theme.accent}"></div></div>
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

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function show(): void {
    const q = questions[index];
    progressEl.textContent = `第 ${index + 1} / ${questions.length} 题`;
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
      if (streak > 0 && streak % 4 === 0) {
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
          const got = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
          later(() => ctx.win(got as 1 | 2 | 3, wrong === 0
            ? "全部一次答对，太了不起啦！"
            : `${questions.length} 道题全部完成！`), 350);
        } else {
          show();
        }
      }, 850);
    } else {
      wrong++;
      streak = 0;
      ctx.sfx("oops");
      btn.classList.add("qz-wrong");
      btn.disabled = true;
      streakEl.textContent = "🔥 连对 0";
      if (wrong > maxWrong) {
        ended = true;
        later(() => ctx.lose("这一关的题目有点调皮，我们休息一下再来一次！"), 500);
        return;
      }
      const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      msgEl.textContent = cheer;
      speak(cheer);
    }
  }

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
