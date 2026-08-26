/**
 * 组字工坊：1.1 新增的两步组字玩法（偏旁推字园专用）。
 *
 * 和前 99 关的「一步选答案」不同，这里每个字要走两步：
 *   第一步看字义挑偏旁（清 / 晴 / 睛 / 请 / 情 都带「青」，全靠偏旁分家）；
 *   第二步挑另一半部件，两步都对，字才算造出来。
 * 挑错只轻轻晃一下并提示往哪个方向想，从不说孩子错。
 */
import { rateBelow, type PlayCtx, type PlayHandle } from "../level99";
import type { QuizTheme } from "../quiz99";
import { speak, speechReady, stopSpeaking, whenSpeechReady } from "../speech";
import type { BuildCharRound, BuildCharTask } from "./levels";

export interface BuildCharOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  task: BuildCharTask;
  theme: QuizTheme;
}

/** 一轮里某一步的判定（纯函数，便于测试） */
export function checkStep(round: BuildCharRound, step: "radical" | "part", picked: string): boolean {
  return step === "radical" ? picked === round.radical : picked === round.part;
}

/** 每一轮都合法：正确项在选项里，选项互不相同 */
export function isRoundSolvable(round: BuildCharRound): boolean {
  const rOk = round.radicalChoices.includes(round.radical) &&
    new Set(round.radicalChoices).size === round.radicalChoices.length;
  const pOk = round.partChoices.includes(round.part) &&
    new Set(round.partChoices).size === round.partChoices.length;
  return rOk && pOk && round.char.length > 0 && round.word.includes(round.char);
}

/** 挑错时的提示：只指方向，不说哪个错 */
export function stepHint(step: "radical" | "part", clue: string): string {
  return step === "radical" ? `再想想字的意思：${clue}` : "偏旁挑对啦，另一半再看看～";
}

const CSS = `
.bc-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:10px;min-height:380px;user-select:none;-webkit-user-select:none;}
.bc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}
.bc-badge{background:#ffffffd9;border-radius:999px;padding:5px 12px;font-weight:800;font-size:14px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.bc-clue{text-align:center;font-size:17px;font-weight:800;line-height:1.5;}
.bc-slots{display:flex;align-items:center;justify-content:center;gap:10px;}
.bc-slot{width:74px;height:74px;border-radius:18px;background:#fff;display:flex;align-items:center;
  justify-content:center;font-size:36px;font-weight:900;color:#4a4460;box-shadow:0 3px 10px rgba(120,120,160,.2);
  border:3px dashed #dcd6ea;}
.bc-slot.bc-filled{border-style:solid;border-color:#69db7c;background:#f4fff2;}
.bc-plus{font-size:26px;font-weight:900;color:#a79fc0;}
.bc-arrow{font-size:22px;font-weight:900;color:#a79fc0;}
.bc-made{border:3px solid #ffd8a8;background:#fff9f0;}
.bc-step{text-align:center;font-size:15px;font-weight:800;}
.bc-choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.bc-pick{border:none;border-radius:18px;min-width:82px;min-height:72px;cursor:pointer;font-family:inherit;
  font-size:32px;font-weight:900;color:#4a4460;background:#fff;box-shadow:0 4px 0 rgba(120,120,160,.3);
  transition:transform .12s;}
.bc-pick:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.bc-pick.bc-bad{animation:bcShake .38s;opacity:.55;}
@keyframes bcShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.bc-pick.bc-good{background:#e4f9e0;animation:bcPop .35s;}
@keyframes bcPop{50%{transform:scale(1.14)}}
.bc-msg{min-height:24px;text-align:center;font-size:15px;font-weight:800;}
.bc-say-row{display:flex;justify-content:center;}
.bc-say{border:none;border-radius:999px;background:#ffffffe6;cursor:pointer;font-family:inherit;font-weight:900;
  font-size:16px;padding:10px 22px;min-height:44px;box-shadow:0 3px 0 rgba(120,120,160,.3);}
.bc-say:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.bc-pick:focus-visible,.bc-say:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@media (max-width:420px){
  .bc-slot{width:62px;height:62px;font-size:30px;}
  .bc-pick{min-width:70px;min-height:62px;font-size:27px;}
}
@media (prefers-reduced-motion:reduce){.bc-pick.bc-good{animation:none;}}
`;

export function runBuildChar(opts: BuildCharOptions): PlayHandle {
  const { stage, ctx, task, theme } = opts;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let roundIdx = 0;
  let step: "radical" | "part" = "radical";
  let wrong = 0;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  function settle(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "bc-wrap";
  wrap.style.background = theme.bg;
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bc-top">
      <span class="bc-badge bc-progress" style="color:${theme.accent}"></span>
      <span class="bc-badge bc-life" style="color:#b84708"></span>
    </div>
    <div class="bc-clue" style="color:${theme.accent}"></div>
    <div class="bc-slots">
      <span class="bc-slot bc-slot-r"></span>
      <span class="bc-plus">+</span>
      <span class="bc-slot bc-slot-p"></span>
      <span class="bc-arrow">→</span>
      <span class="bc-slot bc-made bc-slot-c">?</span>
    </div>
    <div class="bc-step" style="color:${theme.accent}"></div>
    <div class="bc-say-row"><button type="button" class="bc-say" style="color:${theme.accent}" hidden>🔈 读一读</button></div>
    <div class="bc-choices"></div>
    <div class="bc-msg" style="color:${theme.accent}"></div>
  `;
  stage.appendChild(wrap);

  const progressEl = wrap.querySelector(".bc-progress") as HTMLElement;
  const lifeEl = wrap.querySelector(".bc-life") as HTMLElement;
  const clueEl = wrap.querySelector(".bc-clue") as HTMLElement;
  const slotR = wrap.querySelector(".bc-slot-r") as HTMLElement;
  const slotP = wrap.querySelector(".bc-slot-p") as HTMLElement;
  const slotC = wrap.querySelector(".bc-slot-c") as HTMLElement;
  const stepEl = wrap.querySelector(".bc-step") as HTMLElement;
  const choicesEl = wrap.querySelector(".bc-choices") as HTMLElement;
  const msgEl = wrap.querySelector(".bc-msg") as HTMLElement;
  const sayBtn = wrap.querySelector(".bc-say") as HTMLButtonElement;

  /** 没有中文语音包时按钮一直藏着，拼字一点不受影响 */
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
  });
  if (speechReady()) sayBtn.hidden = false;
  sayBtn.addEventListener("click", () => speak(clueEl.textContent ?? ""));

  function updateHud(): void {
    progressEl.textContent = `🧩 第 ${Math.min(roundIdx + 1, task.rounds.length)}/${task.rounds.length} 个字`;
    lifeEl.textContent = `💗 ${"❤".repeat(Math.max(0, task.maxWrong + 1 - wrong))}${"🤍".repeat(
      Math.min(wrong, task.maxWrong + 1)
    )}`;
  }

  function render(): void {
    const round = task.rounds[roundIdx];
    updateHud();
    clueEl.textContent = `「${round.word}」的这个字：${round.clue}`;
    speak(clueEl.textContent);
    slotR.textContent = step === "part" ? round.radical : "?";
    slotR.classList.toggle("bc-filled", step === "part");
    slotP.textContent = "?";
    slotP.classList.remove("bc-filled");
    slotC.textContent = "?";
    stepEl.textContent = step === "radical" ? "第一步：这个字该用哪个偏旁？" : "第二步：另一半是哪个部件？";
    choicesEl.innerHTML = "";
    const list = step === "radical" ? round.radicalChoices : round.partChoices;
    for (const opt of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bc-pick";
      btn.textContent = opt;
      btn.setAttribute("aria-label", step === "radical" ? `偏旁 ${opt}` : `部件 ${opt}`);
      btn.addEventListener("click", () => onPick(btn, opt));
      choicesEl.appendChild(btn);
    }
  }

  function onPick(btn: HTMLButtonElement, opt: string): void {
    if (ended) return;
    const round = task.rounds[roundIdx];
    ctx.sfx("tap");
    if (!checkStep(round, step, opt)) {
      wrong++;
      ctx.sfx("oops");
      btn.classList.add("bc-bad");
      btn.disabled = true;
      msgEl.textContent = stepHint(step, round.clue);
      updateHud();
      if (wrong > task.maxWrong) {
        ended = true;
        settle(() => ctx.lose("这几个字挺会藏的，喝口水我们再拼一次！"), 500);
      }
      return;
    }
    btn.classList.add("bc-good");
    ctx.sfx("coin");
    if (step === "radical") {
      slotR.textContent = round.radical;
      slotR.classList.add("bc-filled");
      msgEl.textContent = "偏旁对了！意思的方向找准啦～";
      step = "part";
      later(render, 500);
      return;
    }
    slotP.textContent = round.part;
    slotP.classList.add("bc-filled");
    slotC.textContent = round.char;
    msgEl.textContent = `拼成啦：${round.char}（${round.word}）`;
    later(() => {
      roundIdx++;
      step = "radical";
      if (roundIdx >= task.rounds.length) {
        ended = true;
        const got = rateBelow(wrong, 0, 2);
        settle(
          () => ctx.win(got, wrong === 0 ? "一个字都没拼错，偏旁全认得！" : "全部拼好啦，这园子交给你放心！"),
          400
        );
        return;
      }
      render();
    }, 900);
  }

  render();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      unwatchSpeech();
      stopSpeaking();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}
