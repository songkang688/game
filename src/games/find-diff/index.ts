import { meta } from "./meta";
export { meta };

import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { buildBoard, CHAPTERS, LEVELS, type DiffLevel } from "./levels";

const THEME_BG = [
  "linear-gradient(#fff4e6,#ffe8cc)",
  "linear-gradient(#e3fafc,#d3f9d8)",
  "linear-gradient(#e7f5ff,#d0f0fd)",
  "linear-gradient(#fff0f6,#ffdeeb)",
  "linear-gradient(#2b2a5e,#4a3f8f)",
  "linear-gradient(#fff9db,#fff3bf)",
];
const THEME_ACCENT = ["#d9480f", "#2b8a3e", "#1971c2", "#c2255c", "#ffe066", "#e8590c"];

const CSS = `
.fd-wrap{border-radius:16px;padding:12px;user-select:none;-webkit-user-select:none;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  display:flex;flex-direction:column;gap:10px;align-items:center;}
.fd-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fd-badge{font-size:14px;font-weight:800;background:#ffffffd9;border-radius:999px;padding:5px 12px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.fd-panels{display:flex;flex-direction:column;gap:10px;width:100%;align-items:center;}
.fd-panel{background:#ffffffec;border-radius:14px;padding:8px;box-shadow:0 3px 10px rgba(120,120,160,.18);}
.fd-label{text-align:center;font-size:12px;font-weight:800;color:#8a7aa8;margin-bottom:4px;}
.fd-grid{display:grid;gap:4px;}
.fd-cell{width:100%;aspect-ratio:1;border:none;border-radius:10px;background:#f6f2fb;cursor:pointer;
  font-size:clamp(18px,6vw,30px);display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .1s;font-family:inherit;position:relative;}
.fd-cell:active{transform:scale(.92);}
.fd-cell.fd-found{background:#d3f9d8;outline:3px solid #69db7c;}
.fd-cell.fd-found::after{content:"✓";position:absolute;right:2px;top:0;font-size:12px;color:#2b8a3e;font-weight:900;}
.fd-cell.fd-wrong{animation:fdShake .35s;}
@keyframes fdShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.fd-cell.fd-hintcell{animation:fdBlink .7s 3;}
@keyframes fdBlink{50%{background:#ffec99;}}
.fd-msg{min-height:20px;font-size:14px;font-weight:800;text-align:center;}
.fd-hint{border:none;border-radius:999px;padding:8px 18px;font-size:15px;font-weight:900;cursor:pointer;
  color:#fff;background:linear-gradient(180deg,#74c0fc,#4dabf7);box-shadow:0 4px 0 #1c7ed6;font-family:inherit;}
.fd-hint:active{transform:translateY(2px);box-shadow:0 2px 0 #1c7ed6;}
.fd-hint:disabled{opacity:.45;}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: DiffLevel = LEVELS[ctx.level];
  const board = buildBoard(ctx.level);
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let timerId: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let ended = false;
  let found = 0;
  let misses = 0;
  let hintLeft = 1;
  let timeLeft = cfg.timeSec;
  const foundSet = new Set<number>();

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "fd-wrap";
  wrap.style.background = THEME_BG[cfg.theme];
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="fd-top">
      <span class="fd-badge fd-count" style="color:${THEME_ACCENT[cfg.theme] === "#ffe066" ? "#8a6d00" : THEME_ACCENT[cfg.theme]}">🔍 0/${cfg.diffs}</span>
      <span class="fd-badge fd-miss" style="color:#c2255c">💗 ${"❤".repeat(cfg.maxMiss + 1)}</span>
      ${cfg.timeSec > 0 ? `<span class="fd-badge fd-time" style="color:#e8590c">⏰ ${cfg.timeSec}s</span>` : ""}
    </div>
    <div class="fd-panels">
      <div class="fd-panel">
        <div class="fd-label">原图（看这里）</div>
        <div class="fd-grid fd-grid-base" style="grid-template-columns:repeat(${cfg.cols},minmax(0,44px))"></div>
      </div>
      <div class="fd-panel">
        <div class="fd-label">找出下图不一样的 ${cfg.diffs} 个地方，点它！</div>
        <div class="fd-grid fd-grid-play" style="grid-template-columns:repeat(${cfg.cols},minmax(0,44px))"></div>
      </div>
    </div>
    <div class="fd-msg" style="color:${cfg.theme === 4 ? "#ffe066" : "#8a7aa8"}"></div>
    <button type="button" class="fd-hint">🔎 放大镜提示（1 次）</button>
  `;
  stage.appendChild(wrap);

  const countEl = wrap.querySelector(".fd-count") as HTMLElement;
  const missEl = wrap.querySelector(".fd-miss") as HTMLElement;
  const timeEl = wrap.querySelector(".fd-time") as HTMLElement | null;
  const baseGrid = wrap.querySelector(".fd-grid-base") as HTMLElement;
  const playGrid = wrap.querySelector(".fd-grid-play") as HTMLElement;
  const msgEl = wrap.querySelector(".fd-msg") as HTMLElement;
  const hintBtn = wrap.querySelector(".fd-hint") as HTMLButtonElement;

  msgEl.textContent = cfg.lookalike ? "小心！有些图案是双胞胎，长得很像～" : "上下对比，找到不一样的格子！";

  const playCells: HTMLButtonElement[] = [];
  board.base.forEach((emoji, i) => {
    const cell = document.createElement("div");
    cell.className = "fd-cell";
    cell.textContent = emoji;
    baseGrid.appendChild(cell);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fd-cell";
    btn.textContent = board.changed[i];
    btn.addEventListener("click", () => onCell(btn, i));
    playGrid.appendChild(btn);
    playCells.push(btn);
  });

  function updateHud(): void {
    countEl.textContent = `🔍 ${found}/${cfg.diffs}`;
    missEl.textContent = `💗 ${"❤".repeat(Math.max(0, cfg.maxMiss + 1 - misses))}${"🤍".repeat(Math.min(misses, cfg.maxMiss + 1))}`;
    if (timeEl) timeEl.textContent = `⏰ ${timeLeft}s`;
  }

  function finish(): void {
    ended = true;
    if (timerId) clearInterval(timerId);
    const got = rateBelow(misses, 0, 2);
    ctx.win(got, misses === 0 ? "一次都没点错，眼力真棒！" : `${cfg.diffs} 处不同全部找到！`);
  }

  function onCell(btn: HTMLButtonElement, i: number): void {
    if (ended || foundSet.has(i)) return;
    if (board.diffIdx.includes(i)) {
      foundSet.add(i);
      found++;
      ctx.sfx("coin");
      btn.classList.add("fd-found");
      msgEl.textContent = "找到啦！👀";
      updateHud();
      if (found >= cfg.diffs) later(() => finish(), 400);
    } else {
      misses++;
      ctx.sfx("oops");
      btn.classList.add("fd-wrong");
      later(() => btn.classList.remove("fd-wrong"), 400);
      msgEl.textContent = "这里上下是一样的，再仔细看看～";
      updateHud();
      if (misses > cfg.maxMiss) {
        ended = true;
        if (timerId) clearInterval(timerId);
        ctx.lose("眼睛累了吧？休息一下，我们再来找一次！");
      }
    }
  }

  hintBtn.addEventListener("click", () => {
    if (ended || hintLeft <= 0) return;
    const remaining = board.diffIdx.filter((i) => !foundSet.has(i));
    if (remaining.length === 0) return;
    hintLeft--;
    hintBtn.disabled = true;
    hintBtn.textContent = "🔎 提示用完啦";
    ctx.sfx("pop");
    playCells[remaining[0]].classList.add("fd-hintcell");
    later(() => playCells[remaining[0]].classList.remove("fd-hintcell"), 2200);
  });

  if (cfg.timeSec > 0) {
    timerId = setInterval(() => {
      if (destroyed || ended) return;
      timeLeft--;
      updateHud();
      if (timeLeft <= 0) {
        ended = true;
        if (timerId) clearInterval(timerId);
        ctx.lose("时间到啦！剩下的不同点下次一定能找到～");
      }
    }, 1000);
  }

  updateHud();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      if (timerId) clearInterval(timerId);
      wrap.remove();
    }
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "睁大眼睛，每一关都藏着新的不同点～",
    grandMessage: "99 关全部找完，你的眼睛比放大镜还厉害！",
    playLevel,
  });
}
