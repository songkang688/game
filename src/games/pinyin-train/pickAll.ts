/**
 * 挑拣车厢：1.1 新增的多选玩法（第 100–188 关专用）。
 *
 * 和前 99 关的「三选一」完全不同：一整车卡片里，要把**全部**符合条件的都挑出来，
 * 多挑、漏挑都算一次没挑对。提交后只报「还差几个 / 多挑了几个」，
 * 不指名道姓说哪个错——孩子自己再判断一遍，这才是练出来的。
 */
import { rateBelow, type PlayCtx, type PlayHandle } from "../level99";
import type { QuizTheme } from "../quiz99";
import { speak, speechReady, stopSpeaking, whenSpeechReady } from "../speech";
import type { PickAllTask } from "./levels";
import { TICKET_CSS, buildScene, classifyToken } from "./scene";

/** 挑拣车厢要朗读的整句话：题目加判断方法，听一遍就知道该挑什么 */
export function pickAllSpeech(task: PickAllTask): string {
  return `${task.title}。${task.hint}`;
}

export interface PickAllOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  task: PickAllTask;
  theme: QuizTheme;
}

/** 提交结果：漏了几个、多挑了几个 */
export interface PickAllVerdict {
  missing: number;
  extra: number;
  ok: boolean;
}

/** 对一次提交打分（纯函数，便于测试） */
export function judgePickAll(picked: readonly string[], correct: readonly string[]): PickAllVerdict {
  const want = new Set(correct);
  const got = new Set(picked);
  let missing = 0;
  let extra = 0;
  for (const c of want) if (!got.has(c)) missing++;
  for (const p of got) if (!want.has(p)) extra++;
  return { missing, extra, ok: missing === 0 && extra === 0 };
}

/** 提交后的一句话反馈：只说差多少，不说哪个错，也绝不批评 */
export function pickAllFeedback(v: PickAllVerdict): string {
  if (v.ok) return "全挑对啦！";
  if (v.missing > 0 && v.extra > 0) return `还差 ${v.missing} 个没挑到，另外有 ${v.extra} 个再想想～`;
  if (v.missing > 0) return `方向对了，还差 ${v.missing} 个没挑到～`;
  return `挑得有点多啦，有 ${v.extra} 个再看看～`;
}

const CSS = `
.pk-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:10px;min-height:380px;user-select:none;-webkit-user-select:none;}
.pk-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}
.pk-badge{background:#ffffffd9;border-radius:999px;padding:5px 12px;font-weight:800;font-size:14px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.pk-title{text-align:center;font-size:20px;font-weight:900;}
.pk-hint{text-align:center;font-size:14px;font-weight:700;line-height:1.5;}
.pk-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.pk-chip{border:none;border-radius:16px;padding:12px 16px;min-width:74px;min-height:56px;cursor:pointer;
  font-family:inherit;font-size:20px;font-weight:900;color:#4a4460;background:#fff;
  box-shadow:0 4px 0 rgba(120,120,160,.3);transition:transform .12s;}
.pk-chip:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.pk-chip.pk-on{outline:4px solid #ff8fc0;background:#fff0f6;transform:translateY(2px);}
.pk-chip.pk-good{background:#e4f9e0;outline:4px solid #69db7c;}
.pk-chip.pk-shake{animation:pkShake .38s;}
@keyframes pkShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.pk-bottom{display:flex;flex-direction:column;align-items:center;gap:8px;}
.pk-go{border:none;border-radius:18px;padding:12px 30px;font-size:18px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 5px 0 #8f2c5c;}
.pk-go:active{transform:translateY(3px);box-shadow:0 2px 0 #8f2c5c;}
.pk-msg{min-height:24px;font-size:15px;font-weight:800;text-align:center;}
.pk-say-row{display:flex;justify-content:center;position:sticky;top:4px;z-index:3;}
.pk-say{border:none;border-radius:999px;background:#ffffffe6;cursor:pointer;font-family:inherit;font-weight:900;
  font-size:16px;padding:10px 24px;min-height:46px;box-shadow:0 3px 0 rgba(120,120,160,.3);}
.pk-say:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.pk-chip:focus-visible,.pk-go:focus-visible,.pk-say:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@media (max-width:420px){
  .pk-chip{font-size:17px;min-width:64px;min-height:50px;padding:10px 12px;}
  .pk-title{font-size:18px;}
}
/* N-35 配方 G:矮横屏舞台左、选票右;380 下限在 412 高档会把票挤下线 */
@media (max-height:500px){
  .pk-wrap{min-height:0;padding:8px;gap:6px;}
  .pk-title{font-size:17px;}
  .pk-go{position:sticky;bottom:0;z-index:2;}
}
@media (max-height:500px) and (min-width:640px){
  .pk-wrap{display:grid;grid-template-columns:minmax(168px,34%) minmax(0,1fr);
    grid-template-rows:auto auto auto auto 1fr auto;gap:6px 10px;align-items:start;}
  .pk-top{grid-column:1/-1;grid-row:1;}
  .pk-title{grid-column:2;grid-row:2;}
  .pk-hint{grid-column:2;grid-row:3;}
  .pk-say-row{grid-column:2;grid-row:4;position:static;}
  .pyt-scene{grid-column:1;grid-row:2 / span 5;height:auto !important;min-height:0;align-self:stretch;}
  .pk-chips{grid-column:2;grid-row:5;}
  .pk-bottom{grid-column:2;grid-row:6;}
}
/* N-35 续:双栏之后 915×412 还剩裁 67,「✅ 就挑这些」漏出裁切线 17px。
   跟拼写关同一个原因:右栏一列叠了标题 + 提示 + 票排 + 交卷区,四层还是超。
   跟拼写关同一套修法:矮横屏宽档收起装饰用的火车画面,票排独占宽栏,
   标题 / 提示 / 交卷区收进右侧固定栏。窄一点的矮横屏还是走上面那套。 */
@media (max-height:500px) and (min-width:760px){
  .pk-wrap{
    grid-template-columns:minmax(0,1fr) minmax(232px,300px);
    grid-template-rows:auto auto auto auto 1fr;
  }
  .pk-wrap>.pyt-scene{display:none;}
  .pk-chips{grid-column:1;grid-row:2 / -1;max-height:calc(100dvh - 200px);min-height:64px;overflow-y:auto;}
  .pk-title{grid-column:2;grid-row:2;}
  .pk-hint{grid-column:2;grid-row:3;}
  .pk-say-row{grid-column:2;grid-row:4;}
  .pk-bottom{grid-column:2;grid-row:5;align-self:start;}
}
`;

export function runPickAll(opts: PickAllOptions): PlayHandle {
  const { stage, ctx, task, theme } = opts;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const picked = new Set<string>();
  let destroyed = false;
  let ended = false;
  let wrong = 0;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  /** 结算专用：ended 已经置位，只要没被销毁就一定要报出胜负 */
  function settle(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "pk-wrap";
  wrap.style.background = theme.bg;
  wrap.innerHTML = `
    <style>${CSS}${TICKET_CSS}</style>
    <div class="pk-top">
      <span class="pk-badge pk-count" style="color:${theme.accent}">已挑 0 个</span>
      <span class="pk-badge pk-life" style="color:#b84708">💗 ${"❤".repeat(task.maxWrong + 1)}</span>
    </div>
    <div class="pk-title" style="color:${theme.accent}">🚃 ${task.title}</div>
    <div class="pk-hint" style="color:${theme.accent}">${task.hint}</div>
    <div class="pk-say-row"><button type="button" class="pk-say pyt-horn" style="color:${theme.accent}" hidden>📢 再听一遍</button></div>
    <div class="pk-chips"></div>
    <div class="pk-bottom">
      <button type="button" class="pk-go">✅ 就挑这些</button>
      <div class="pk-msg" style="color:${theme.accent}"></div>
    </div>
  `;
  stage.appendChild(wrap);

  // 火车舞台（纯视觉）：挑对整车后，正确卡片逐一挂厢、鸣笛发车
  const scene = buildScene({ target: task.correct.length });
  wrap.insertBefore(scene.el, wrap.querySelector(".pk-chips"));

  const chipsEl = wrap.querySelector(".pk-chips") as HTMLElement;
  const countEl = wrap.querySelector(".pk-count") as HTMLElement;
  const lifeEl = wrap.querySelector(".pk-life") as HTMLElement;
  const msgEl = wrap.querySelector(".pk-msg") as HTMLElement;
  const goBtn = wrap.querySelector(".pk-go") as HTMLButtonElement;
  const sayBtn = wrap.querySelector(".pk-say") as HTMLButtonElement;

  // 朗读：进关自动读一遍题目与判断方法；没有中文语音包时按钮不出现，照样能挑
  const line = pickAllSpeech(task);
  sayBtn.addEventListener("click", () => {
    if (!destroyed) speak(line);
  });
  let speechOn = speechReady();
  if (speechOn) sayBtn.hidden = false;
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
    if (!speechOn) {
      speechOn = true;
      if (!destroyed && !ended) speak(line);
    }
  });
  speak(line);

  const chipEls = new Map<string, HTMLButtonElement>();
  for (const chip of task.chips) {
    const btn = document.createElement("button");
    btn.type = "button";
    // 车票三色助记只按文字长相分类上色，正确与否绝不从颜色上漏出去
    btn.className = `pk-chip pyt-ticket pyt-tk-${classifyToken(chip)}`;
    btn.textContent = chip;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", `${chip}，还没挑中`);
    btn.addEventListener("click", () => toggle(chip));
    chipsEl.appendChild(btn);
    chipEls.set(chip, btn);
  }

  function updateHud(): void {
    countEl.textContent = `已挑 ${picked.size} 个`;
    lifeEl.textContent = `💗 ${"❤".repeat(Math.max(0, task.maxWrong + 1 - wrong))}${"🤍".repeat(
      Math.min(wrong, task.maxWrong + 1)
    )}`;
  }

  function toggle(chip: string): void {
    if (ended) return;
    const btn = chipEls.get(chip);
    if (!btn) return;
    ctx.sfx("tap");
    if (picked.has(chip)) picked.delete(chip);
    else picked.add(chip);
    const on = picked.has(chip);
    btn.classList.toggle("pk-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", `${chip}，${on ? "已挑中" : "还没挑中"}`);
    updateHud();
  }

  function submit(): void {
    if (ended) return;
    if (picked.size === 0) {
      msgEl.textContent = "先点几张卡片，再按这个按钮～";
      return;
    }
    const verdict = judgePickAll([...picked], task.correct);
    if (verdict.ok) {
      ended = true;
      ctx.sfx("coin");
      for (const c of task.correct) chipEls.get(c)?.classList.add("pk-good");
      // 纯视觉：挑对的整车逐一挂厢，随后鸣笛发车
      for (const c of task.correct) scene.hook(c);
      settle(() => scene.depart(), 320);
      msgEl.textContent = pickAllFeedback(verdict);
      const got = rateBelow(wrong, 0, 1);
      settle(() => ctx.win(got, wrong === 0 ? "一次就全挑对，眼力真准！" : "全挑对啦，这一车稳稳到站！"), 700);
      return;
    }
    wrong++;
    ctx.sfx("oops");
    updateHud();
    // 纯视觉：车厢轻晃不脱钩 + 站牌「再听一遍」
    scene.wobble();
    for (const btn of chipEls.values()) {
      btn.classList.add("pk-shake");
    }
    later(() => {
      for (const btn of chipEls.values()) btn.classList.remove("pk-shake");
    }, 400);
    if (wrong > task.maxWrong) {
      ended = true;
      msgEl.textContent = "这一车有点难挑～";
      settle(() => ctx.lose("这一车的卡片有点狡猾，歇一口气我们再挑一次！"), 500);
      return;
    }
    msgEl.textContent = pickAllFeedback(verdict);
  }

  goBtn.addEventListener("click", submit);
  updateHud();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      unwatchSpeech();
      stopSpeaking();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      scene.destroy();
      wrap.remove();
    },
  };
}
