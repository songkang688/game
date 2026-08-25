// 五子棋 —— 15×15 标准棋盘（可切 9×9 入门），人机两档 + 同屏双人，
// 支持悔棋、提示、禁手开关、五连高亮。
import {
  type Board,
  type Difficulty,
  type Player,
  bestMove,
  boardFull,
  findWinLine,
  hintMove,
  isForbidden,
  makeBoard,
  other,
  setCell,
} from "./ai";

export const meta = {
  id: "gomoku",
  title: "五子棋",
  emoji: "⚫",
  category: "casual" as const,
  color: "#F6E3C5",
  blurb: "黑白棋子排排站，先连成五颗就是小棋王！",
};

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const W = 380;

type Mode = "easy" | "normal" | "pvp";

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let aiTimer = 0;
  let endTimer = 0;

  // 设置
  let boardSize = 15;
  let mode: Mode = "normal";
  let forbiddenOn = false;

  // 对局状态
  let board: Board = makeBoard(boardSize);
  let current: Player = 1;
  let history: Array<{ x: number; y: number; p: Player }> = [];
  let gameOver = false;
  let winner: Player | 0 = 0;
  let winLine: Array<[number, number]> | null = null;
  let hintLeft = 1;
  let hintCell: { x: number; y: number } | null = null;
  let hintShownAt = 0;
  let aiThinking = false;
  let ghost: { x: number; y: number } | null = null;
  let lastMove: { x: number; y: number } | null = null;
  let animTime = 0;
  let reported = false;

  const wrap = document.createElement("div");
  wrap.className = "gm-wrap";
  wrap.innerHTML = `
    <style>
      .gm-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF6E8, #FFEAF2); border-radius: 20px; padding: 12px; max-width: 420px; margin: 0 auto; user-select: none; }
      .gm-panel { display: flex; flex-direction: column; gap: 14px; padding: 10px 6px; }
      .gm-group-label { font-weight: 800; color: #A8743C; font-size: 15px; margin-bottom: 6px; }
      .gm-seg { display: flex; gap: 8px; flex-wrap: wrap; }
      .gm-seg button { flex: 1; min-width: 90px; border: 3px solid #EED9B8; background: #FFFDF8; border-radius: 16px; padding: 10px 8px; font-size: 15px; font-weight: 700; color: #8A6B45; cursor: pointer; }
      .gm-seg button.on { border-color: #F2A0C0; background: #FFE4EF; color: #C2497E; }
      .gm-start { border: none; border-radius: 18px; padding: 14px; font-size: 19px; font-weight: 800; background: #FFB3CD; color: #86285A; cursor: pointer; box-shadow: 0 5px 0 #E890B2; }
      .gm-start:active { transform: translateY(3px); box-shadow: 0 2px 0 #E890B2; }
      .gm-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
      .gm-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #A8743C; box-shadow: 0 2px 6px rgba(180,130,80,.2); font-size: 14px; white-space: nowrap; }
      .gm-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; box-shadow: 0 4px 14px rgba(190,140,90,.25); }
      .gm-btns { display: flex; gap: 8px; margin-top: 10px; }
      .gm-btns button { flex: 1; border: none; border-radius: 14px; padding: 10px 6px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); }
      .gm-btns button:disabled { opacity: .45; cursor: default; }
      .gm-undo { background: #CDE6FF; color: #2A6099; }
      .gm-hint { background: #D9F2C4; color: #4A7A2A; }
      .gm-back { background: #FFE0C2; color: #9A5A20; }
      .gm-msg { text-align: center; min-height: 20px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .gm-hidden { display: none; }
    </style>
    <div class="gm-panel gm-setup">
      <div>
        <div class="gm-group-label">🎯 棋盘大小</div>
        <div class="gm-seg gm-size">
          <button type="button" data-v="9">9×9 入门</button>
          <button type="button" data-v="15" class="on">15×15 标准</button>
        </div>
      </div>
      <div>
        <div class="gm-group-label">🤝 和谁下</div>
        <div class="gm-seg gm-mode">
          <button type="button" data-v="easy">🐱 棋灵喵·简单</button>
          <button type="button" data-v="normal" class="on">🦊 棋灵狐·普通</button>
          <button type="button" data-v="pvp">👫 双人对战</button>
        </div>
      </div>
      <div>
        <div class="gm-group-label">🚫 禁手规则（大孩子玩法）</div>
        <div class="gm-seg gm-forbid">
          <button type="button" data-v="off" class="on">关（推荐）</button>
          <button type="button" data-v="on">开</button>
        </div>
      </div>
      <button class="gm-start" type="button">开始下棋 ▶</button>
    </div>
    <div class="gm-game gm-hidden">
      <div class="gm-top">
        <span class="gm-badge gm-turn">⚫ 该黑棋啦</span>
        <span class="gm-badge gm-modelabel"></span>
      </div>
      <canvas class="gm-canvas" width="${W}" height="${W}"></canvas>
      <div class="gm-btns">
        <button class="gm-undo" type="button">↩️ 悔棋</button>
        <button class="gm-hint" type="button">✨ 提示×1</button>
        <button class="gm-back" type="button">🔧 换玩法</button>
      </div>
      <div class="gm-msg">点棋盘落子，按住可以滑动瞄准～</div>
    </div>
  `;
  api.root.appendChild(wrap);

  const setupEl = wrap.querySelector(".gm-setup") as HTMLElement;
  const gameEl = wrap.querySelector(".gm-game") as HTMLElement;
  const canvas = wrap.querySelector(".gm-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const turnEl = wrap.querySelector(".gm-turn") as HTMLElement;
  const modeLabelEl = wrap.querySelector(".gm-modelabel") as HTMLElement;
  const msgEl = wrap.querySelector(".gm-msg") as HTMLElement;
  const undoBtn = wrap.querySelector(".gm-undo") as HTMLButtonElement;
  const hintBtn = wrap.querySelector(".gm-hint") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".gm-back") as HTMLButtonElement;

  function segInit(selector: string, onPick: (v: string) => void): void {
    const seg = wrap.querySelector(selector) as HTMLElement;
    seg.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      for (const b of Array.from(seg.querySelectorAll("button"))) b.classList.remove("on");
      btn.classList.add("on");
      api.play("tap");
      onPick(btn.dataset.v!);
    });
  }
  segInit(".gm-size", (v) => { boardSize = Number(v); });
  segInit(".gm-mode", (v) => { mode = v as Mode; });
  segInit(".gm-forbid", (v) => { forbiddenOn = v === "on"; });

  function cellSize(): number {
    return W / (boardSize + 1);
  }

  function humanTurn(): boolean {
    if (gameOver) return false;
    if (mode === "pvp") return true;
    return current === 1 && !aiThinking;
  }

  function modeLabel(): string {
    if (mode === "easy") return "🐱 棋灵喵·简单";
    if (mode === "normal") return "🦊 棋灵狐·普通";
    return "👫 双人对战";
  }

  function updateHud(): void {
    if (gameOver) {
      if (winner === 0) turnEl.textContent = "🤝 平局";
      else turnEl.textContent = winner === 1 ? "⚫ 黑棋赢啦！" : "⚪ 白棋赢啦！";
    } else if (aiThinking) {
      turnEl.textContent = mode === "easy" ? "🐱 棋灵喵思考中…" : "🦊 棋灵狐思考中…";
    } else {
      turnEl.textContent = current === 1 ? "⚫ 该黑棋啦" : "⚪ 该白棋啦";
    }
    modeLabelEl.textContent = modeLabel();
    undoBtn.disabled = history.length === 0 || gameOver || aiThinking;
    const hintUsable = mode === "normal" && hintLeft > 0 && !gameOver && humanTurn();
    hintBtn.disabled = !hintUsable;
    hintBtn.textContent = `✨ 提示×${hintLeft}`;
    hintBtn.style.display = mode === "normal" ? "" : "none";
  }

  function startGame(): void {
    board = makeBoard(boardSize);
    current = 1;
    history = [];
    gameOver = false;
    winner = 0;
    winLine = null;
    hintLeft = 1;
    hintCell = null;
    aiThinking = false;
    ghost = null;
    lastMove = null;
    reported = false;
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    setupEl.classList.add("gm-hidden");
    gameEl.classList.remove("gm-hidden");
    msgEl.textContent =
      mode === "pvp"
        ? "黑棋先下，轮流点棋盘落子！"
        : "你执黑棋先下，点棋盘落子，按住可滑动瞄准～";
    updateHud();
  }

  function backToSetup(): void {
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    gameEl.classList.add("gm-hidden");
    setupEl.classList.remove("gm-hidden");
    api.play("tap");
  }

  function finishGame(win: Player | 0): void {
    gameOver = true;
    winner = win;
    aiThinking = false;
    updateHud();
    if (reported) return;
    reported = true;
    if (win !== 0) api.play(mode !== "pvp" && win === 2 ? "oops" : "win");
    clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (destroyed) return;
      if (win === 0) {
        api.onWin(1, "棋盘下满了，握手言和！");
      } else if (mode === "pvp") {
        api.onWin(1, win === 1 ? "⚫ 黑棋小朋友赢啦！" : "⚪ 白棋小朋友赢啦！");
      } else if (win === 1) {
        const stars: 1 | 2 | 3 = mode === "normal" ? 3 : 2;
        api.onWin(stars, mode === "normal" ? "赢了棋灵狐，真是小棋王！" : "赢了棋灵喵，继续挑战棋灵狐吧！");
      } else {
        api.onLose(mode === "easy" ? "棋灵喵这局赢了，再来一盘！" : "棋灵狐好厉害，再试一次！");
      }
    }, 1300);
  }

  function placeStone(x: number, y: number): void {
    setCell(board, x, y, current);
    history.push({ x, y, p: current });
    lastMove = { x, y };
    hintCell = null;
    api.play(current === 1 ? "tap" : "pop");
    const line = findWinLine(board, x, y);
    if (line) {
      winLine = line;
      finishGame(current);
      return;
    }
    if (boardFull(board)) {
      finishGame(0);
      return;
    }
    current = other(current);
    updateHud();
    if (mode !== "pvp" && current === 2) scheduleAi();
  }

  function scheduleAi(): void {
    aiThinking = true;
    updateHud();
    clearTimeout(aiTimer);
    aiTimer = window.setTimeout(() => {
      if (destroyed || gameOver) return;
      const mv = bestMove(board, 2, mode as Difficulty);
      aiThinking = false;
      if (!mv) {
        finishGame(0);
        return;
      }
      placeStone(mv.x, mv.y);
    }, 550);
  }

  function tryHumanMove(x: number, y: number): void {
    if (!humanTurn()) return;
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return;
    if (board.cells[y * boardSize + x] !== 0) return;
    if (forbiddenOn && current === 1) {
      const f = isForbidden(board, x, y);
      if (f.forbidden) {
        api.play("oops");
        msgEl.textContent = `这里是${f.reason}，黑棋不能下哦！`;
        return;
      }
    }
    msgEl.textContent = "";
    placeStone(x, y);
  }

  function useHint(): void {
    if (mode !== "normal" || hintLeft <= 0 || !humanTurn()) return;
    const mv = hintMove(board, 1);
    if (!mv) return;
    hintLeft--;
    hintCell = mv;
    hintShownAt = animTime;
    api.play("coin");
    msgEl.textContent = "✨ 闪光的位置是好棋！";
    updateHud();
  }

  function undo(): void {
    if (history.length === 0 || gameOver || aiThinking) return;
    const count = mode === "pvp" ? 1 : Math.min(2, history.length);
    for (let i = 0; i < count; i++) {
      const mv = history.pop();
      if (mv) setCell(board, mv.x, mv.y, 0);
    }
    const last = history[history.length - 1];
    lastMove = last ? { x: last.x, y: last.y } : null;
    current = mode === "pvp" ? (history.length % 2 === 0 ? 1 : 2) : 1;
    hintCell = null;
    api.play("pop");
    msgEl.textContent = "悔棋成功，再想一想～";
    updateHud();
  }

  // ---------- 绘制 ----------

  function drawBoard(): void {
    const n = boardSize;
    const cs = cellSize();
    // 粉彩木纹
    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, "#F9E4C3");
    g.addColorStop(0.5, "#F5D9AE");
    g.addColorStop(1, "#F2D2A4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = "rgba(200, 155, 95, 0.18)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-20, i * 64 + 10);
      ctx.bezierCurveTo(W * 0.3, i * 64 - 16, W * 0.6, i * 64 + 34, W + 20, i * 64 + 4);
      ctx.stroke();
    }
    // 网格
    ctx.strokeStyle = "#C79A66";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) {
      const p = cs + i * cs;
      ctx.beginPath();
      ctx.moveTo(cs, p);
      ctx.lineTo(cs + (n - 1) * cs, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, cs);
      ctx.lineTo(p, cs + (n - 1) * cs);
      ctx.stroke();
    }
    // 星位
    ctx.fillStyle = "#B9854E";
    const starPts =
      n === 15 ? [3, 7, 11] : [2, 4, 6];
    for (const sy of starPts) {
      for (const sx of starPts) {
        ctx.beginPath();
        ctx.arc(cs + sx * cs, cs + sy * cs, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStone(x: number, y: number, p: Player, alpha = 1): void {
    const cs = cellSize();
    const cx = cs + x * cs;
    const cy = cs + y * cs;
    const r = cs * 0.44;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy + 1.5, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120, 80, 40, 0.25)";
    ctx.fill();
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.15, cx, cy, r);
    if (p === 1) {
      grad.addColorStop(0, "#7E6E80");
      grad.addColorStop(1, "#453A4A");
    } else {
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(1, "#F2E8DA");
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (p === 2) {
      ctx.strokeStyle = "rgba(190, 160, 120, 0.7)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // 高光
    ctx.fillStyle = p === 1 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw(): void {
    drawBoard();
    const n = boardSize;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = board.cells[y * n + x];
        if (c === 1 || c === 2) drawStone(x, y, c as Player);
      }
    }
    const cs = cellSize();
    // 最后一手标记
    if (lastMove && !winLine) {
      const cx = cs + lastMove.x * cs;
      const cy = cs + lastMove.y * cs;
      ctx.strokeStyle = "#FF7EA8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.44 + 3 + Math.sin(animTime * 5) * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 提示
    if (hintCell && !gameOver && animTime - hintShownAt < 5) {
      const cx = cs + hintCell.x * cs;
      const cy = cs + hintCell.y * cs;
      const pulse = 1 + Math.sin(animTime * 6) * 0.15;
      ctx.strokeStyle = "#67B54B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.44 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(120, 200, 90, 0.25)";
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.44 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // 落子预览
    if (ghost && humanTurn() && board.cells[ghost.y * n + ghost.x] === 0) {
      drawStone(ghost.x, ghost.y, current, 0.45);
      const cx = cs + ghost.x * cs;
      const cy = cs + ghost.y * cs;
      ctx.strokeStyle = "#FF9DBE";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cx - cs, cy);
      ctx.lineTo(cx + cs, cy);
      ctx.moveTo(cx, cy - cs);
      ctx.lineTo(cx, cy + cs);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 五连高亮
    if (winLine) {
      const glow = 0.55 + Math.sin(animTime * 6) * 0.35;
      const [x0, y0] = winLine[0];
      const [x1, y1] = winLine[winLine.length - 1];
      ctx.strokeStyle = `rgba(255, 200, 60, ${glow})`;
      ctx.lineWidth = cs * 0.9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cs + x0 * cs, cs + y0 * cs);
      ctx.lineTo(cs + x1 * cs, cs + y1 * cs);
      ctx.stroke();
      for (const [x, y] of winLine) {
        drawStone(x, y, board.cells[y * n + x] as Player);
        const cx = cs + x * cs;
        const cy = cs + y * cs;
        ctx.fillStyle = `rgba(255, 240, 150, ${glow})`;
        ctx.font = `${Math.round(cs * 0.5)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⭐", cx, cy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }
  }

  function tick(now: number): void {
    if (destroyed) return;
    animTime = now / 1000;
    if (!gameEl.classList.contains("gm-hidden")) draw();
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------

  function eventCell(e: PointerEvent): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * W;
    const cs = cellSize();
    const x = Math.round(px / cs - 1);
    const y = Math.round(py / cs - 1);
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return null;
    return { x, y };
  }

  let pressing = false;
  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    pressing = true;
    ghost = eventCell(e);
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!pressing) return;
    ghost = eventCell(e);
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!pressing) return;
    pressing = false;
    const cell = ghost ?? eventCell(e);
    ghost = null;
    if (cell) tryHumanMove(cell.x, cell.y);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", () => { pressing = false; ghost = null; });

  (wrap.querySelector(".gm-start") as HTMLButtonElement).addEventListener("click", () => {
    api.play("jump");
    startGame();
  });
  undoBtn.addEventListener("click", undo);
  hintBtn.addEventListener("click", useHint);
  backBtn.addEventListener("click", backToSetup);

  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(aiTimer);
      clearTimeout(endTimer);
      wrap.remove();
    },
  };
}
