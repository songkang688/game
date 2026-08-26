import { meta } from "./meta";
export { meta };

import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { speak, stopSpeaking, whenSpeechReady } from "../speech";
import { CHAPTERS, LEVELS, buildBoards, movePermutation, type DiffBoard, type DiffLevel } from "./levels";

const THEME_BG = [
  "linear-gradient(#fff4e6,#ffe8cc)",
  "linear-gradient(#e3fafc,#d3f9d8)",
  "linear-gradient(#e7f5ff,#d0f0fd)",
  "linear-gradient(#fff0f6,#ffdeeb)",
  "linear-gradient(#2b2a5e,#4a3f8f)",
  "linear-gradient(#fff9db,#fff3bf)",
  "linear-gradient(#fff5f0,#ffe9e0)",
  "linear-gradient(#eef7ff,#e0f0ff)",
  "linear-gradient(#f0fbf8,#e4f7f2)",
  "linear-gradient(#faf3ff,#f3e8ff)",
];
const THEME_ACCENT = [
  "#d9480f", "#2b8a3e", "#1971c2", "#c2255c", "#ffe066", "#e8590c",
  "#b02a37", "#1c6fb8", "#0f8a72", "#7c3aed",
];

/** 每种玩法的一句话说明（开局就告诉孩子这一关的规则变了） */
export const MODE_HINTS: Record<DiffLevel["mode"], string> = {
  classic: "上下对比，找到不一样的格子！",
  triple: "三张图一起看：只有跟上面两张都不一样的才算数～",
  moving: "图案会自己换位置，不同点也跟着跑，盯紧了！",
  mirror: "下图是左右翻过来的，要按镜子里的位置去对～",
  rush: "一关连打好几轮，倒计时是共用的，加油！",
};

/** 结算时的鼓励语：一次没错就夸眼力，错过也只肯定完成度 */
export function finishLine(misses: number, totalDiffs: number, rounds: number): string {
  if (misses === 0) return rounds > 1 ? `${rounds} 轮一次都没点错，眼力真棒！` : "一次都没点错，眼力真棒！";
  return rounds > 1 ? `${rounds} 轮全部完成，一共找到 ${totalDiffs} 处不同！` : `${totalDiffs} 处不同全部找到！`;
}

const CSS = `
.fd-wrap{border-radius:16px;padding:12px;user-select:none;-webkit-user-select:none;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  display:flex;flex-direction:column;gap:10px;align-items:center;}
.fd-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fd-badge{font-size:14px;font-weight:800;background:#ffffffd9;border-radius:999px;padding:5px 12px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.fd-panels{display:flex;flex-direction:column;gap:10px;width:100%;align-items:center;}
.fd-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;}
.fd-panel{background:#ffffffec;border-radius:14px;padding:8px;box-shadow:0 3px 10px rgba(120,120,160,.18);}
.fd-label{text-align:center;font-size:12px;font-weight:800;color:#8a7aa8;margin-bottom:4px;}
.fd-grid{display:grid;gap:4px;}
.fd-cell{width:100%;aspect-ratio:1;border:none;border-radius:10px;background:#f6f2fb;cursor:pointer;
  font-size:clamp(18px,6vw,30px);display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .1s;font-family:inherit;position:relative;}
.fd-grid-mini .fd-cell{font-size:clamp(14px,4.4vw,22px);border-radius:8px;}
.fd-cell:active{transform:scale(.92);}
.fd-cell.fd-found{background:#d3f9d8;outline:3px solid #69db7c;}
.fd-cell.fd-found::after{content:"✓";position:absolute;right:2px;top:0;font-size:12px;color:#2b8a3e;font-weight:900;}
.fd-cell.fd-wrong{animation:fdShake .35s;}
@keyframes fdShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.fd-cell.fd-hintcell{animation:fdBlink .7s 3;}
@keyframes fdBlink{50%{background:#ffec99;}}
.fd-cell.fd-slide{animation:fdSlide .45s;}
@keyframes fdSlide{from{transform:translateX(-10px);opacity:.35}to{transform:translateX(0);opacity:1}}
.fd-msg{min-height:20px;font-size:14px;font-weight:800;text-align:center;}
.fd-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.fd-hint{border:none;border-radius:999px;padding:8px 18px;font-size:15px;font-weight:900;cursor:pointer;
  color:#fff;background:linear-gradient(180deg,#74c0fc,#4dabf7);box-shadow:0 4px 0 #1c7ed6;font-family:inherit;}
.fd-hint:active{transform:translateY(2px);box-shadow:0 2px 0 #1c7ed6;}
.fd-hint:disabled{opacity:.45;}
.fd-say{border:none;border-radius:999px;padding:8px 18px;font-size:15px;font-weight:900;cursor:pointer;
  min-height:44px;color:#7a5aa0;background:#ffffffe6;box-shadow:0 4px 0 rgba(120,90,160,.3);font-family:inherit;}
.fd-say:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(120,90,160,.3);}
.fd-cell:focus-visible,.fd-hint:focus-visible,.fd-say:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
@media (prefers-reduced-motion:reduce){
  .fd-cell.fd-slide{animation:none;}
  .fd-cell.fd-hintcell{animation:none;background:#ffec99;}
}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: DiffLevel = LEVELS[ctx.level];
  const boards: DiffBoard[] = buildBoards(ctx.level);
  const rounds = boards.length;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let timerId: ReturnType<typeof setInterval> | null = null;
  let moveId: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let ended = false;
  let roundIndex = 0;
  let board = boards[0];
  let found = 0;
  let foundTotal = 0;
  let misses = 0;
  let hintLeft = rounds > 1 ? rounds : 1;
  let timeLeft = cfg.timeSec;
  let moveStep = 0;
  /** perm[显示位置] = 棋盘真实下标；不动的模式就是恒等映射 */
  let perm: number[] = movePermutation(cfg.rows, cfg.cols, 0);
  let foundSet = new Set<number>();

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  const accent = THEME_ACCENT[cfg.theme];
  const softAccent = accent === "#ffe066" ? "#8a6d00" : accent;
  const msgColor = cfg.theme === 4 ? "#ffe066" : "#8a7aa8";
  const cellWidth = cfg.mode === "triple" ? 34 : 44;

  const wrap = document.createElement("div");
  wrap.className = "fd-wrap";
  wrap.style.background = THEME_BG[cfg.theme];
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="fd-top">
      <span class="fd-badge fd-count" style="color:${softAccent}">🔍 0/${cfg.diffs}</span>
      <span class="fd-badge fd-miss" style="color:#c2255c">💗 ${"❤".repeat(cfg.maxMiss + 1)}</span>
      ${rounds > 1 ? `<span class="fd-badge fd-round" style="color:#7c3aed">🎬 第 1/${rounds} 轮</span>` : ""}
      ${cfg.timeSec > 0 ? `<span class="fd-badge fd-time" style="color:#e8590c">⏰ ${cfg.timeSec}s</span>` : ""}
    </div>
    <div class="fd-panels"></div>
    <div class="fd-msg" style="color:${msgColor}"></div>
    <div class="fd-btns">
      <button type="button" class="fd-hint">🔎 放大镜提示（${hintLeft} 次）</button>
      <button type="button" class="fd-say" hidden>🔈 再听一遍</button>
    </div>
  `;
  stage.appendChild(wrap);

  const countEl = wrap.querySelector(".fd-count") as HTMLElement;
  const missEl = wrap.querySelector(".fd-miss") as HTMLElement;
  const roundEl = wrap.querySelector(".fd-round") as HTMLElement | null;
  const timeEl = wrap.querySelector(".fd-time") as HTMLElement | null;
  const panelsEl = wrap.querySelector(".fd-panels") as HTMLElement;
  const msgEl = wrap.querySelector(".fd-msg") as HTMLElement;
  const hintBtn = wrap.querySelector(".fd-hint") as HTMLButtonElement;
  const sayBtn = wrap.querySelector(".fd-say") as HTMLButtonElement;

  msgEl.textContent = cfg.lookalike && cfg.mode === "classic"
    ? "小心！有些图案是双胞胎，长得很像～"
    : MODE_HINTS[cfg.mode];

  const askLine =
    cfg.mode === "rush"
      ? `一共 ${rounds} 轮，每轮找出 ${cfg.diffs} 个不一样的地方！`
      : `找出下面 ${cfg.diffs} 个不一样的地方，找到就点它！`;
  sayBtn.addEventListener("click", () => speak(askLine));
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
    if (!destroyed && !ended) speak(askLine);
  });

  let playCells: HTMLButtonElement[] = [];

  function makeGrid(mini: boolean): HTMLElement {
    const grid = document.createElement("div");
    grid.className = `fd-grid${mini ? " fd-grid-mini" : ""}`;
    grid.style.gridTemplateColumns = `repeat(${cfg.cols},minmax(0,${mini ? 30 : cellWidth}px))`;
    return grid;
  }

  function makePanel(label: string, mini: boolean): { panel: HTMLElement; grid: HTMLElement } {
    const panel = document.createElement("div");
    panel.className = "fd-panel";
    const cap = document.createElement("div");
    cap.className = "fd-label";
    cap.textContent = label;
    const grid = makeGrid(mini);
    panel.append(cap, grid);
    return { panel, grid };
  }

  /** 上面的参考图（只看不点） */
  function fillStatic(grid: HTMLElement, cells: string[], slide: boolean): void {
    grid.innerHTML = "";
    perm.forEach((src) => {
      const cell = document.createElement("div");
      cell.className = `fd-cell${slide ? " fd-slide" : ""}`;
      cell.textContent = cells[src];
      grid.appendChild(cell);
    });
  }

  /** 下面那张可点的图 */
  function fillPlay(grid: HTMLElement, cells: string[], slide: boolean): void {
    grid.innerHTML = "";
    playCells = [];
    perm.forEach((src, pos) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `fd-cell${slide ? " fd-slide" : ""}${foundSet.has(src) ? " fd-found" : ""}`;
      btn.textContent = cells[src];
      btn.setAttribute("aria-label", `第 ${Math.floor(pos / cfg.cols) + 1} 行第 ${(pos % cfg.cols) + 1} 个`);
      btn.addEventListener("click", () => onCell(btn, src));
      grid.appendChild(btn);
      playCells[src] = btn;
    });
  }

  let refA: HTMLElement | null = null;
  let refB: HTMLElement | null = null;
  let playGrid: HTMLElement;

  function layout(): void {
    panelsEl.innerHTML = "";
    if (cfg.mode === "triple") {
      const row = document.createElement("div");
      row.className = "fd-row";
      const a = makePanel("图 ①", true);
      const b = makePanel("图 ②", true);
      row.append(a.panel, b.panel);
      panelsEl.appendChild(row);
      refA = a.grid;
      refB = b.grid;
      const c = makePanel(`图 ③：跟上面两张都不同的有 ${cfg.diffs} 个，点它！`, false);
      panelsEl.appendChild(c.panel);
      playGrid = c.grid;
      return;
    }
    const top = makePanel(cfg.mode === "mirror" ? "原图（下面是它的镜子像）" : "原图（看这里）", false);
    panelsEl.appendChild(top.panel);
    refA = top.grid;
    refB = null;
    const bottom = makePanel(`找出下图不一样的 ${cfg.diffs} 个地方，点它！`, false);
    panelsEl.appendChild(bottom.panel);
    playGrid = bottom.grid;
  }

  function paint(slide: boolean): void {
    // 镜像模式下，下图本身就已经是上图左右翻转后的样子，上图照常显示即可
    if (refA) fillStatic(refA, board.base, slide);
    if (refB && board.second) fillStatic(refB, board.second, slide);
    fillPlay(playGrid, board.changed, slide);
  }

  function updateHud(): void {
    countEl.textContent = `🔍 ${found}/${cfg.diffs}`;
    missEl.textContent = `💗 ${"❤".repeat(Math.max(0, cfg.maxMiss + 1 - misses))}${"🤍".repeat(Math.min(misses, cfg.maxMiss + 1))}`;
    if (roundEl) roundEl.textContent = `🎬 第 ${roundIndex + 1}/${rounds} 轮`;
    if (timeEl) timeEl.textContent = `⏰ ${timeLeft}s`;
  }

  function stopTimers(): void {
    if (timerId) clearInterval(timerId);
    if (moveId) clearInterval(moveId);
    timerId = null;
    moveId = null;
  }

  function finish(): void {
    ended = true;
    stopTimers();
    const got = rateBelow(misses, 0, 2);
    ctx.win(got, finishLine(misses, foundTotal, rounds));
  }

  function nextRound(): void {
    roundIndex++;
    board = boards[roundIndex];
    found = 0;
    foundSet = new Set<number>();
    perm = movePermutation(cfg.rows, cfg.cols, 0);
    paint(true);
    updateHud();
    msgEl.textContent = `第 ${roundIndex + 1} 轮开始，继续加油！`;
    ctx.sfx("pop");
  }

  function onCell(btn: HTMLButtonElement, i: number): void {
    if (ended || foundSet.has(i)) return;
    if (board.diffIdx.includes(i)) {
      foundSet.add(i);
      found++;
      foundTotal++;
      ctx.sfx("coin");
      btn.classList.add("fd-found");
      msgEl.textContent = "找到啦！👀";
      updateHud();
      if (found >= cfg.diffs) {
        if (roundIndex + 1 < rounds) later(() => nextRound(), 500);
        else later(() => finish(), 400);
      }
    } else {
      misses++;
      ctx.sfx("oops");
      btn.classList.add("fd-wrong");
      later(() => btn.classList.remove("fd-wrong"), 400);
      msgEl.textContent =
        cfg.mode === "triple"
          ? "这一格跟上面某张是一样的，再比比看～"
          : cfg.mode === "mirror"
            ? "别忘了左右是反的，照着镜子再看一眼～"
            : "这里上下是一样的，再仔细看看～";
      updateHud();
      if (misses > cfg.maxMiss) {
        ended = true;
        stopTimers();
        ctx.lose("眼睛累了吧？休息一下，我们再来找一次！");
      }
    }
  }

  layout();
  paint(false);

  hintBtn.addEventListener("click", () => {
    if (ended || hintLeft <= 0) return;
    const remaining = board.diffIdx.filter((i) => !foundSet.has(i));
    if (remaining.length === 0) return;
    hintLeft--;
    hintBtn.textContent = hintLeft > 0 ? `🔎 放大镜提示（${hintLeft} 次）` : "🔎 提示用完啦";
    hintBtn.disabled = hintLeft <= 0;
    ctx.sfx("pop");
    const target = playCells[remaining[0]];
    if (!target) return;
    target.classList.add("fd-hintcell");
    later(() => target.classList.remove("fd-hintcell"), 2200);
  });

  if (cfg.timeSec > 0) {
    timerId = setInterval(() => {
      if (destroyed || ended) return;
      timeLeft--;
      updateHud();
      if (timeLeft <= 0) {
        ended = true;
        stopTimers();
        ctx.lose("时间到啦！剩下的不同点下次一定能找到～");
      }
    }, 1000);
  }

  if (cfg.moveEverySec > 0) {
    moveId = setInterval(() => {
      if (destroyed || ended) return;
      moveStep++;
      perm = movePermutation(cfg.rows, cfg.cols, moveStep);
      paint(true);
      ctx.sfx("tap");
    }, cfg.moveEverySec * 1000);
  }

  updateHud();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      unwatchSpeech();
      stopSpeaking();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      stopTimers();
      wrap.remove();
    }
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "睁大眼睛，每一关都藏着新的不同点～",
    grandMessage: "188 关全部找完，你的眼睛比放大镜还厉害！",
    playLevel,
  });
}
