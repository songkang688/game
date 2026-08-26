/**
 * 限时特快：1.1 新增机制（第 100–188 关的后三站）。
 *
 * 给任意一种关卡玩法套一层整关倒计时：时间条走完就温柔收尾，
 * 文案只说「先靠站休息」，绝不说孩子慢。孩子自己过关时倒计时立刻停表。
 */
import type { PlayCtx, PlayHandle } from "../level99";

/** 时间到的收尾话：只安抚，不评价 */
export const TIME_UP_LINE = "时间到啦，小火车先靠站休息一下，下次发车一定更顺！";

/** 剩余时间显示成 分:秒 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** 剩余时间是不是进入「最后冲刺」（≤20%，时间条变色提醒） */
export function isRushing(leftMs: number, limitMs: number): boolean {
  if (limitMs <= 0) return false;
  return leftMs <= limitMs * 0.2;
}

export interface TimedOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  /** 整关时限（毫秒）；<=0 就不套倒计时，直接跑里面的玩法 */
  limitMs: number;
  accent: string;
  /** 真正的关卡玩法；传进去的 ctx 已经接管了胜负，用它就行 */
  run: (stage: HTMLElement, ctx: PlayCtx) => PlayHandle | void;
}

const CSS = `
.tm-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:900;font-size:14px;
  font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.tm-clock{background:#ffffffd9;border-radius:999px;padding:4px 12px;box-shadow:0 2px 6px rgba(120,120,160,.2);
  white-space:nowrap;}
.tm-track{flex:1;height:10px;border-radius:8px;background:#ffffffb0;overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.08);}
.tm-fill{height:100%;width:100%;border-radius:8px;transition:width .25s linear;}
.tm-bar.tm-rush .tm-clock{color:#c92a2a;animation:tmPulse 1s ease-in-out infinite;}
@keyframes tmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@media (prefers-reduced-motion:reduce){.tm-bar.tm-rush .tm-clock{animation:none;}}
`;

const TICK_MS = 250;

/** 给一种玩法套上整关倒计时；limitMs <= 0 时原样直跑，不加任何 UI */
export function runTimed(opts: TimedOptions): PlayHandle {
  const { stage, ctx, limitMs, accent } = opts;
  if (limitMs <= 0) {
    const plain = opts.run(stage, ctx);
    return { destroy: () => plain?.destroy?.() };
  }

  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const startedAt = Date.now();

  const bar = document.createElement("div");
  bar.className = "tm-bar";
  bar.innerHTML = `
    <style>${CSS}</style>
    <span class="tm-clock" style="color:${accent}">⏱️ ${formatClock(limitMs)}</span>
    <span class="tm-track"><span class="tm-fill" style="background:${accent}"></span></span>
  `;
  bar.setAttribute("role", "timer");
  bar.setAttribute("aria-label", "本关倒计时");
  stage.appendChild(bar);
  const clockEl = bar.querySelector(".tm-clock") as HTMLElement;
  const fillEl = bar.querySelector(".tm-fill") as HTMLElement;

  const inner = document.createElement("div");
  stage.appendChild(inner);

  function stop(): void {
    finished = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  const timedCtx: PlayCtx = {
    ...ctx,
    win: (stars, msg) => {
      stop();
      ctx.win(stars, msg);
    },
    lose: (msg) => {
      stop();
      ctx.lose(msg);
    },
  };

  const handle = opts.run(inner, timedCtx);

  function tick(): void {
    if (finished) return;
    const left = limitMs - (Date.now() - startedAt);
    clockEl.textContent = `⏱️ ${formatClock(left)}`;
    fillEl.style.width = `${Math.max(0, Math.min(100, (left / limitMs) * 100))}%`;
    bar.classList.toggle("tm-rush", isRushing(left, limitMs));
    if (left <= 0) {
      stop();
      ctx.lose(TIME_UP_LINE);
      return;
    }
    timer = setTimeout(tick, TICK_MS);
  }
  timer = setTimeout(tick, TICK_MS);

  return {
    destroy() {
      stop();
      handle?.destroy?.();
      bar.remove();
      inner.remove();
    },
  };
}
