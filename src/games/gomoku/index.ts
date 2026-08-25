// 五子棋 —— 自由对战（15×15/9×9，人机三档 + 双人 + 禁手可选）
// 与「棋谜战役」：16 个 9×9 残局，限定步数内连成五，带提示与进度存档。
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
import { PUZZLES, puzzleBoard } from "./puzzles";

export const meta = {
  id: "gomoku",
  title: "五子棋",
  emoji: "⚫",
  category: "casual" as const,
  color: "#F6E3C5",
  blurb: "自由对战加 16 关棋谜战役，先连成五颗就是小棋王！",
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

type Mode = "easy" | "normal" | "smart" | "pvp";
type PlayKind = "free" | "puzzle";

const CAMPAIGN_KEY = "yiduo.gomoku.campaign.v1";

interface CampaignProgress {
  stars: number[];
}

function loadCampaign(): CampaignProgress {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(data.stars)) {
        const arr = data.stars as unknown[];
        return {
          stars: PUZZLES.map((_, i) => {
            const v = arr[i];
            return typeof v === "number" ? Math.max(0, Math.min(3, Math.round(v))) : 0;
          }),
        };
      }
    }
  } catch {
    // 读不到就当新档
  }
  return { stars: PUZZLES.map(() => 0) };
}

function saveCampaign(p: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(p));
  } catch {
    // 忽略
  }
}

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let aiTimer = 0;
  let endTimer = 0;

  // 设置
  let boardSize = 15;
  let mode: Mode = "normal";
  let forbiddenOn = false;
  let playKind: PlayKind = "free";

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

  // 战役状态
  const campaign = loadCampaign();
  let puzzleIndex = 0;
  let movesLeft = 0;
  let hintUsedInPuzzle = false;
  let campaignDoneReported = false;

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
      .gm-retry { background: #FFD9C4; color: #A0522D; }
      .gm-back { background: #FFE0C2; color: #9A5A20; }
      .gm-msg { text-align: center; min-height: 20px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .gm-hidden { display: none; }
      .gm-pz-total { text-align: center; font-weight: 700; color: #A8743C; font-size: 14px; margin-bottom: 8px; }
      .gm-pz-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .gm-pz { border: none; border-radius: 14px; padding: 8px 2px 6px; background: #FFFDF8; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); display: flex; flex-direction: column; align-items: center; gap: 1px; }
      .gm-pz:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,.12); }
      .gm-pz .n { font-size: 16px; font-weight: 800; color: #A8743C; }
      .gm-pz .s { font-size: 10px; letter-spacing: 1px; color: #E8A93C; }
      .gm-pz .m { font-size: 10px; color: #B08A5C; }
      .gm-pz.locked { background: rgba(255,255,255,.5); box-shadow: none; cursor: default; }
      .gm-pz.locked .n { color: #C4B49B; }
    </style>
    <div class="gm-panel gm-setup">
      <div>
        <div class="gm-group-label">🎮 玩法</div>
        <div class="gm-seg gm-kind">
          <button type="button" data-v="free" class="on">♟️ 自由对战</button>
          <button type="button" data-v="puzzle">🧩 棋谜战役</button>
        </div>
      </div>
      <div class="gm-free-opts">
        <div>
          <div class="gm-group-label">🎯 棋盘大小</div>
          <div class="gm-seg gm-size">
            <button type="button" data-v="9">9×9 入门</button>
            <button type="button" data-v="15" class="on">15×15 标准</button>
          </div>
        </div>
        <div style="margin-top:14px">
          <div class="gm-group-label">🤝 和谁下</div>
          <div class="gm-seg gm-mode">
            <button type="button" data-v="easy">🐱 棋灵喵·简单</button>
            <button type="button" data-v="normal" class="on">🦊 棋灵狐·普通</button>
            <button type="button" data-v="smart">🐲 棋灵龙·聪明</button>
            <button type="button" data-v="pvp">👫 双人对战</button>
          </div>
        </div>
        <div style="margin-top:14px">
          <div class="gm-group-label">🚫 禁手规则（大孩子玩法）</div>
          <div class="gm-seg gm-forbid">
            <button type="button" data-v="off" class="on">关（推荐）</button>
            <button type="button" data-v="on">开</button>
          </div>
        </div>
        <button class="gm-start" type="button" style="margin-top:14px; width:100%">开始下棋 ▶</button>
      </div>
      <div class="gm-puzzle-list gm-hidden">
        <div class="gm-group-label">🧩 棋谜战役 · 残局闯关（黑棋 N 步内连五）</div>
        <div class="gm-pz-total"></div>
        <div class="gm-pz-grid"></div>
      </div>
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
        <button class="gm-retry gm-hidden" type="button">🔄 重摆</button>
        <button class="gm-back" type="button">🔧 换玩法</button>
      </div>
      <div class="gm-msg">点棋盘落子，按住可以滑动瞄准～</div>
    </div>
  `;
  api.root.appendChild(wrap);

  const setupEl = wrap.querySelector(".gm-setup") as HTMLElement;
  const freeOptsEl = wrap.querySelector(".gm-free-opts") as HTMLElement;
  const puzzleListEl = wrap.querySelector(".gm-puzzle-list") as HTMLElement;
  const pzTotalEl = wrap.querySelector(".gm-pz-total") as HTMLElement;
  const pzGridEl = wrap.querySelector(".gm-pz-grid") as HTMLElement;
  const gameEl = wrap.querySelector(".gm-game") as HTMLElement;
  const canvas = wrap.querySelector(".gm-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const turnEl = wrap.querySelector(".gm-turn") as HTMLElement;
  const modeLabelEl = wrap.querySelector(".gm-modelabel") as HTMLElement;
  const msgEl = wrap.querySelector(".gm-msg") as HTMLElement;
  const undoBtn = wrap.querySelector(".gm-undo") as HTMLButtonElement;
  const hintBtn = wrap.querySelector(".gm-hint") as HTMLButtonElement;
  const retryBtn = wrap.querySelector(".gm-retry") as HTMLButtonElement;
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
  segInit(".gm-kind", (v) => {
    playKind = v as PlayKind;
    freeOptsEl.classList.toggle("gm-hidden", playKind !== "free");
    puzzleListEl.classList.toggle("gm-hidden", playKind !== "puzzle");
    if (playKind === "puzzle") renderPuzzleList();
  });
  segInit(".gm-size", (v) => { boardSize = Number(v); });
  segInit(".gm-mode", (v) => { mode = v as Mode; });
  segInit(".gm-forbid", (v) => { forbiddenOn = v === "on"; });

  function cellSize(): number {
    return W / (boardSize + 1);
  }

  function puzzleUnlocked(i: number): boolean {
    return i === 0 || campaign.stars[i - 1] > 0;
  }

  function renderPuzzleList(): void {
    const total = campaign.stars.reduce((a, b) => a + b, 0);
    pzTotalEl.textContent = `⭐ ${total} / ${PUZZLES.length * 3} · 不用提示解开可得 3 星`;
    pzGridEl.innerHTML = "";
    PUZZLES.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const unlocked = puzzleUnlocked(i);
      btn.className = unlocked ? "gm-pz" : "gm-pz locked";
      const got = campaign.stars[i];
      btn.innerHTML = unlocked
        ? `<span class="n">${i + 1}</span><span class="s">${"★".repeat(got)}${"☆".repeat(3 - got)}</span><span class="m">${p.moves} 步</span>`
        : `<span class="n">🔒</span><span class="s">&nbsp;</span><span class="m">&nbsp;</span>`;
      if (unlocked) {
        btn.addEventListener("click", () => {
          api.play("jump");
          startPuzzle(i);
        });
      }
      pzGridEl.appendChild(btn);
    });
  }

  function humanTurn(): boolean {
    if (gameOver) return false;
    if (playKind === "puzzle") return current === 1 && !aiThinking;
    if (mode === "pvp") return true;
    return current === 1 && !aiThinking;
  }

  function modeLabel(): string {
    if (playKind === "puzzle") {
      return `🧩 第 ${puzzleIndex + 1} 谜 · ${PUZZLES[puzzleIndex].name}`;
    }
    if (mode === "easy") return "🐱 棋灵喵·简单";
    if (mode === "normal") return "🦊 棋灵狐·普通";
    if (mode === "smart") return "🐲 棋灵龙·聪明";
    return "👫 双人对战";
  }

  function updateHud(): void {
    if (playKind === "puzzle") {
      if (gameOver) {
        turnEl.textContent = winner === 1 ? "🎉 解开啦！" : "😢 差一点点";
      } else {
        turnEl.textContent = aiThinking ? "⚪ 白棋防守中…" : `⚫ 还可以走 ${movesLeft} 步`;
      }
    } else if (gameOver) {
      if (winner === 0) turnEl.textContent = "🤝 平局";
      else turnEl.textContent = winner === 1 ? "⚫ 黑棋赢啦！" : "⚪ 白棋赢啦！";
    } else if (aiThinking) {
      turnEl.textContent =
        mode === "easy" ? "🐱 棋灵喵思考中…" :
        mode === "smart" ? "🐲 棋灵龙思考中…" : "🦊 棋灵狐思考中…";
    } else {
      turnEl.textContent = current === 1 ? "⚫ 该黑棋啦" : "⚪ 该白棋啦";
    }
    modeLabelEl.textContent = modeLabel();
    undoBtn.disabled = history.length === 0 || gameOver || aiThinking;
    const hintAllowed = playKind === "puzzle" || mode === "normal" || mode === "smart";
    const hintUsable = hintAllowed && hintLeft > 0 && !gameOver && humanTurn();
    hintBtn.disabled = !hintUsable;
    hintBtn.textContent = `✨ 提示×${hintLeft}`;
    hintBtn.style.display = hintAllowed ? "" : "none";
    retryBtn.classList.toggle("gm-hidden", playKind !== "puzzle");
  }

  function resetGameState(): void {
    current = 1;
    history = [];
    gameOver = false;
    winner = 0;
    winLine = null;
    hintCell = null;
    aiThinking = false;
    ghost = null;
    lastMove = null;
    reported = false;
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    setupEl.classList.add("gm-hidden");
    gameEl.classList.remove("gm-hidden");
  }

  function startGame(): void {
    playKind = "free";
    board = makeBoard(boardSize);
    hintLeft = 1;
    resetGameState();
    msgEl.textContent =
      mode === "pvp"
        ? "黑棋先下，轮流点棋盘落子！"
        : "你执黑棋先下，点棋盘落子，按住可滑动瞄准～";
    updateHud();
  }

  function startPuzzle(index: number): void {
    playKind = "puzzle";
    puzzleIndex = index;
    const p = PUZZLES[index];
    boardSize = p.size;
    board = puzzleBoard(p);
    movesLeft = p.moves;
    hintUsedInPuzzle = false;
    hintLeft = 1;
    resetGameState();
    msgEl.textContent = `${p.tip}（${p.moves} 步内连成五）`;
    updateHud();
  }

  function backToSetup(): void {
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    gameEl.classList.add("gm-hidden");
    setupEl.classList.remove("gm-hidden");
    if (playKind === "puzzle") renderPuzzleList();
    api.play("tap");
  }

  function finishFreeGame(win: Player | 0): void {
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
        const stars: 1 | 2 | 3 = mode === "easy" ? 2 : 3;
        api.onWin(
          stars,
          mode === "smart"
            ? "居然赢了棋灵龙，你是真正的棋王！"
            : mode === "normal"
              ? "赢了棋灵狐，去挑战棋灵龙吧！"
              : "赢了棋灵喵，继续挑战棋灵狐吧！"
        );
      } else {
        api.onLose(
          mode === "easy"
            ? "棋灵喵这局赢了，再来一盘！"
            : mode === "smart"
              ? "棋灵龙太厉害了，先去棋谜战役练练！"
              : "棋灵狐好厉害，再试一次！"
        );
      }
    }, 1300);
  }

  function finishPuzzle(solved: boolean): void {
    gameOver = true;
    winner = solved ? 1 : 2;
    aiThinking = false;
    api.play(solved ? "win" : "oops");
    if (solved) {
      const got = hintUsedInPuzzle ? 2 : 3;
      const wasAll = campaign.stars.every((s) => s > 0);
      campaign.stars[puzzleIndex] = Math.max(campaign.stars[puzzleIndex], got);
      saveCampaign(campaign);
      msgEl.textContent = hintUsedInPuzzle
        ? "解开啦！下次不用提示能拿 3 星哦"
        : "太棒了，不用提示就解开，3 星到手！";
      const nowAll = campaign.stars.every((s) => s > 0);
      clearTimeout(endTimer);
      endTimer = window.setTimeout(() => {
        if (destroyed) return;
        if (!wasAll && nowAll && !campaignDoneReported) {
          campaignDoneReported = true;
          const total = campaign.stars.reduce((a, b) => a + b, 0);
          const ratio = total / (PUZZLES.length * 3);
          const rating: 1 | 2 | 3 = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : 1;
          api.onWin(rating, `棋谜战役 ${PUZZLES.length} 关全部解开，共 ${total} 星！`);
          backToSetup();
        } else if (puzzleIndex + 1 < PUZZLES.length) {
          startPuzzle(puzzleIndex + 1);
        } else {
          backToSetup();
        }
      }, 1600);
    } else {
      msgEl.textContent = "没关系！点「重摆」再想一想～";
    }
    updateHud();
  }

  function placeStone(x: number, y: number): void {
    setCell(board, x, y, current);
    history.push({ x, y, p: current });
    lastMove = { x, y };
    hintCell = null;
    api.play(current === 1 ? "tap" : "pop");
    const line = findWinLine(board, x, y);

    if (playKind === "puzzle") {
      if (line) {
        winLine = line;
        finishPuzzle(current === 1);
        return;
      }
      if (current === 1) {
        movesLeft--;
        if (movesLeft <= 0) {
          finishPuzzle(false);
          return;
        }
        current = 2;
        updateHud();
        scheduleAi("smart");
      } else {
        current = 1;
        updateHud();
      }
      return;
    }

    if (line) {
      winLine = line;
      finishFreeGame(current);
      return;
    }
    if (boardFull(board)) {
      finishFreeGame(0);
      return;
    }
    current = other(current);
    updateHud();
    if (mode !== "pvp" && current === 2) scheduleAi(mode as Difficulty);
  }

  function scheduleAi(difficulty: Difficulty): void {
    aiThinking = true;
    updateHud();
    clearTimeout(aiTimer);
    aiTimer = window.setTimeout(() => {
      if (destroyed || gameOver) return;
      const mv = bestMove(board, 2, difficulty);
      aiThinking = false;
      if (!mv) {
        if (playKind === "puzzle") finishPuzzle(false);
        else finishFreeGame(0);
        return;
      }
      placeStone(mv.x, mv.y);
    }, 550);
  }

  function tryHumanMove(x: number, y: number): void {
    if (!humanTurn()) return;
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return;
    if (board.cells[y * boardSize + x] !== 0) return;
    if (playKind === "free" && forbiddenOn && current === 1) {
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
    if (hintLeft <= 0 || !humanTurn()) return;
    const mv = playKind === "puzzle" ? bestMove(board, 1, "smart", () => 0) : hintMove(board, 1);
    if (!mv) return;
    hintLeft--;
    if (playKind === "puzzle") hintUsedInPuzzle = true;
    hintCell = mv;
    hintShownAt = animTime;
    api.play("coin");
    msgEl.textContent = "✨ 闪光的位置是好棋！";
    updateHud();
  }

  function undo(): void {
    if (history.length === 0 || gameOver || aiThinking) return;
    if (playKind === "puzzle") {
      // 战役里悔一个来回（黑+白），步数还回来
      const count = Math.min(2, history.length);
      for (let i = 0; i < count; i++) {
        const mv = history.pop();
        if (mv) {
          setCell(board, mv.x, mv.y, 0);
          if (mv.p === 1) movesLeft = Math.min(PUZZLES[puzzleIndex].moves, movesLeft + 1);
        }
      }
      current = 1;
    } else {
      const count = mode === "pvp" ? 1 : Math.min(2, history.length);
      for (let i = 0; i < count; i++) {
        const mv = history.pop();
        if (mv) setCell(board, mv.x, mv.y, 0);
      }
      current = mode === "pvp" ? (history.length % 2 === 0 ? 1 : 2) : 1;
    }
    const last = history[history.length - 1];
    lastMove = last ? { x: last.x, y: last.y } : null;
    hintCell = null;
    api.play("pop");
    msgEl.textContent = "悔棋成功，再想一想～";
    updateHud();
  }

  // ---------- 绘制 ----------

  function drawBoard(): void {
    const n = boardSize;
    const cs = cellSize();
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
    ctx.fillStyle = "#B9854E";
    const starPts = n === 15 ? [3, 7, 11] : [2, 4, 6];
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
      ctx.strokeStyle = "rgba(150, 110, 70, 0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
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
    if (lastMove && !winLine) {
      const cx = cs + lastMove.x * cs;
      const cy = cs + lastMove.y * cs;
      ctx.strokeStyle = "#FF7EA8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.44 + 3 + Math.sin(animTime * 5) * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  retryBtn.addEventListener("click", () => {
    api.play("tap");
    startPuzzle(puzzleIndex);
  });
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
