import { meta } from "./meta";
export { meta };

// 朵朵星星象棋 —— 标准中国象棋：双人同屏（朵朵 vs 星星）+ 简单电脑。
// 大棋子、点选或拖动、合法落点高亮、将军提示、悔棋一档、图文规则页。
import {
  type Board,
  type Move,
  type Pos,
  type Side,
  PIECE_NAME,
  aiMove,
  applyMove,
  describeMove,
  idx,
  inCheck,
  initialBoard,
  legalMoves,
  other,
  statusOf,
} from "./logic";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---- 头像：PNG 到位后自动使用，暂时用可爱占位 ---- */
const AVATAR_URLS = import.meta.glob("../../assets/avatars/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

type Mascot = "duoduo" | "xingxing" | "robot";

function avatarHTML(who: Mascot, size = 32): string {
  const file = who === "duoduo" ? "duoduo-q.png" : who === "xingxing" ? "xingxing-q.png" : "";
  const url = file ? AVATAR_URLS[`../../assets/avatars/${file}`] : undefined;
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : who === "xingxing" ? "⭐" : "🐘";
  const bg = who === "duoduo" ? "#FFD9E8" : who === "xingxing" ? "#D9E6FF" : "#E4D9FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(size * 0.58)}px;vertical-align:middle">${emoji}</span>`;
}

const MASCOT_NAME: Record<Mascot, string> = { duoduo: "朵朵", xingxing: "星星", robot: "棋灵象" };

/* ---- 画布几何 ---- */
const M = 22; // 边距
const C = 44; // 交叉点间距
const W = M * 2 + C * 8; // 396
const H = M * 2 + C * 9; // 440
const R = 20; // 棋子半径

function px(x: number): number {
  return M + x * C;
}
function py(y: number): number {
  return M + y * C;
}

type ModeKind = "pvp" | "ai";

const RULES_HTML = `
  <h3>🎯 怎么赢</h3>
  <p>把对方的<b>将 / 帅</b>抓住就赢啦！让对方的将帅<b>没地方逃、没人来救</b>（将死），或者对方<b>一步棋都走不了</b>（困毙），你就是大赢家！</p>
  <h3>❌ 怎么输</h3>
  <p>反过来，自己的将帅被将死、或者轮到自己却无棋可走，就输啦。别难过，点「再来一局」马上翻盘！</p>
  <h3>🖐️ 怎么操作</h3>
  <p>① 点一下<b>自己的棋子</b>，棋盘上会亮出<b>绿色小圆点</b>；<br>② 点绿点，棋子就走过去（也可以<b>按住棋子拖</b>过去）；<br>③ 走错了？每步之后可以按一次「↩️ 悔棋」。</p>
  <h3>♟️ 每个棋子怎么走</h3>
  <p>🤴 <b>帅 / 将</b>：只能待在九宫格里，每次直着走一格。两个将帅不能在同一条线上光着脸对望哦（飞将）！</p>
  <p>🛡️ <b>仕 / 士</b>：在九宫里沿斜线走一格，是将帅的小保镖。</p>
  <p>🐘 <b>相 / 象</b>：走「田」字（斜着跨两格），不能过河；田字中心有棋子就被「塞象眼」，走不动。</p>
  <p>🐴 <b>马</b>：走「日」字。马脚边紧挨着一个棋子时会被「蹩马腿」，那个方向就跳不过去。</p>
  <p>🚗 <b>车</b>：横冲直撞！直线随便走多远，但不能跳过棋子。</p>
  <p>💥 <b>炮</b>：平时走法和车一样；<b>吃子必须隔一个「炮架」</b>，像跳山打靶——隔山打！</p>
  <p>🐣 <b>兵 / 卒</b>：一次一步只能向前；<b>过了河</b>就能左右横走，但永远不能后退。</p>
  <h3>⚠️ 特别规则</h3>
  <p>👉 <b>将军</b>：你的棋子下一步能吃到对方将帅，就大喊「将军！」，对方必须马上想办法（逃跑、垫子或吃掉你）。<br>👉 <b>不能送将</b>：会让自己被将军的棋，棋盘不让你走，放心大胆试！</p>
`;

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let aiTimer = 0;
  let endTimer = 0;

  // 设置
  let modeKind: ModeKind = "pvp";
  let duoduoSide: Side = "red"; // 双人：朵朵执哪边
  let humanSide: Side = "red"; // 打电脑：玩家执哪边

  // 对局状态
  let board: Board = initialBoard();
  let current: Side = "red";
  let selected: Pos | null = null;
  let targets: Pos[] = [];
  let lastMove: Move | null = null;
  let gameOver = false;
  let aiThinking = false;
  let animTime = 0;
  let checkFlashUntil = 0;
  let undoSnap: { board: Board; current: Side; lastMove: Move | null } | null = null;
  let captured: { red: string[]; black: string[] } = { red: [], black: [] };
  let dragging: { from: Pos; x: number; y: number } | null = null;

  const wrap = document.createElement("div");
  wrap.className = "xq-wrap";
  wrap.innerHTML = `
    <style>
      .xq-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF3E2, #FFE9F1); border-radius: 20px; padding: 12px; max-width: 440px; margin: 0 auto; user-select: none; }
      .xq-panel { display: flex; flex-direction: column; gap: 14px; padding: 10px 6px; }
      .xq-label { font-weight: 800; color: #A8743C; font-size: 15px; margin-bottom: 6px; }
      .xq-seg { display: flex; gap: 8px; flex-wrap: wrap; }
      .xq-seg button { flex: 1; min-width: 100px; border: 3px solid #EED9B8; background: #FFFDF8; border-radius: 16px; padding: 12px 8px; font-size: 15px; font-weight: 700; color: #8A6B45; cursor: pointer; font-family: inherit; }
      .xq-seg button.on { border-color: #F2A0C0; background: #FFE4EF; color: #C2497E; }
      .xq-start { border: none; border-radius: 18px; padding: 15px; font-size: 20px; font-weight: 800; background: #FFB3CD; color: #86285A; cursor: pointer; box-shadow: 0 5px 0 #E890B2; width: 100%; font-family: inherit; }
      .xq-start:active { transform: translateY(3px); box-shadow: 0 2px 0 #E890B2; }
      .xq-rulesbtn { border: none; border-radius: 16px; padding: 12px; font-size: 16px; font-weight: 800; background: #CDE6FF; color: #2A6099; cursor: pointer; box-shadow: 0 4px 0 #9CC5EE; width: 100%; font-family: inherit; }
      .xq-rulesbtn:active { transform: translateY(2px); box-shadow: 0 2px 0 #9CC5EE; }
      .xq-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; }
      .xq-player { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 16px; padding: 5px 10px; font-weight: 800; font-size: 14px; box-shadow: 0 2px 6px rgba(180,130,80,.2); border: 3px solid transparent; }
      .xq-player.red { color: #C0392B; }
      .xq-player.black { color: #3A3A55; }
      .xq-player.turn { border-color: #FFC46B; background: #FFF6E0; }
      .xq-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; box-shadow: 0 4px 14px rgba(190,140,90,.3); }
      .xq-btns { display: flex; gap: 8px; margin-top: 10px; }
      .xq-btns button { flex: 1; border: none; border-radius: 14px; padding: 11px 4px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); font-family: inherit; }
      .xq-btns button:disabled { opacity: .45; cursor: default; }
      .xq-undo { background: #CDE6FF; color: #2A6099; }
      .xq-restart { background: #FFD9C4; color: #A0522D; }
      .xq-help { background: #D9F2C4; color: #4A7A2A; }
      .xq-back { background: #FFE0C2; color: #9A5A20; }
      .xq-msg { text-align: center; min-height: 22px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .xq-cap { display: flex; gap: 3px; flex-wrap: wrap; min-height: 18px; font-size: 13px; margin: 2px 4px; opacity: .85; }
      .xq-hidden { display: none; }
      .xq-rules { position: absolute; inset: 0; background: #FFF9F0; border-radius: 20px; padding: 14px; overflow-y: auto; z-index: 5; }
      .xq-rules h3 { color: #C2497E; margin: 12px 0 4px; font-size: 17px; }
      .xq-rules p { color: #7A5A3A; font-size: 14.5px; line-height: 1.7; margin: 6px 0; }
      .xq-rules-close { position: sticky; top: 0; float: right; border: none; border-radius: 14px; background: #FFB3CD; color: #86285A; font-size: 15px; font-weight: 800; padding: 9px 16px; cursor: pointer; box-shadow: 0 3px 0 #E890B2; font-family: inherit; }
      .xq-wrap { position: relative; }
    </style>
    <div class="xq-panel xq-setup">
      <div>
        <div class="xq-label">🎮 和谁下棋</div>
        <div class="xq-seg xq-mode">
          <button type="button" data-v="pvp" class="on">👫 朵朵 VS 星星</button>
          <button type="button" data-v="ai">🐘 挑战棋灵象</button>
        </div>
      </div>
      <div class="xq-opt-pvp">
        <div class="xq-label">🔴 谁拿红棋（红棋先走）</div>
        <div class="xq-seg xq-pvpside">
          <button type="button" data-v="red" class="on">🌸 朵朵拿红棋</button>
          <button type="button" data-v="black">⭐ 星星拿红棋</button>
        </div>
      </div>
      <div class="xq-opt-ai xq-hidden">
        <div class="xq-label">🔴 你拿哪边（红棋先走）</div>
        <div class="xq-seg xq-aiside">
          <button type="button" data-v="red" class="on">🔴 我拿红棋先走</button>
          <button type="button" data-v="black">⚫ 我拿黑棋后走</button>
        </div>
      </div>
      <button class="xq-rulesbtn" type="button">📖 怎么玩（点我看规则）</button>
      <button class="xq-start" type="button">开始下棋 ▶</button>
    </div>
    <div class="xq-game xq-hidden">
      <div class="xq-top">
        <span class="xq-player red xq-p-red"></span>
        <span class="xq-player black xq-p-black"></span>
      </div>
      <div class="xq-cap xq-cap-top"></div>
      <canvas class="xq-canvas" width="${W}" height="${H}"></canvas>
      <div class="xq-cap xq-cap-bottom"></div>
      <div class="xq-btns">
        <button class="xq-undo" type="button">↩️ 悔棋</button>
        <button class="xq-restart" type="button">🔄 重开</button>
        <button class="xq-help" type="button">📖 规则</button>
        <button class="xq-back" type="button">🔧 换玩法</button>
      </div>
      <div class="xq-msg">红棋先走，点自己的棋子试试！</div>
    </div>
    <div class="xq-rules xq-hidden">
      <button class="xq-rules-close" type="button">✖ 关闭</button>
      <h3 style="margin-top:2px">📖 朵朵星星象棋 · 规则</h3>
      ${RULES_HTML}
    </div>
  `;
  api.root.appendChild(wrap);

  const setupEl = wrap.querySelector(".xq-setup") as HTMLElement;
  const gameEl = wrap.querySelector(".xq-game") as HTMLElement;
  const rulesEl = wrap.querySelector(".xq-rules") as HTMLElement;
  const optPvp = wrap.querySelector(".xq-opt-pvp") as HTMLElement;
  const optAi = wrap.querySelector(".xq-opt-ai") as HTMLElement;
  const canvas = wrap.querySelector(".xq-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const pRedEl = wrap.querySelector(".xq-p-red") as HTMLElement;
  const pBlackEl = wrap.querySelector(".xq-p-black") as HTMLElement;
  const capTopEl = wrap.querySelector(".xq-cap-top") as HTMLElement;
  const capBottomEl = wrap.querySelector(".xq-cap-bottom") as HTMLElement;
  const msgEl = wrap.querySelector(".xq-msg") as HTMLElement;
  const undoBtn = wrap.querySelector(".xq-undo") as HTMLButtonElement;
  const restartBtn = wrap.querySelector(".xq-restart") as HTMLButtonElement;
  const helpBtn = wrap.querySelector(".xq-help") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".xq-back") as HTMLButtonElement;

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
  segInit(".xq-mode", (v) => {
    modeKind = v as ModeKind;
    optPvp.classList.toggle("xq-hidden", modeKind !== "pvp");
    optAi.classList.toggle("xq-hidden", modeKind !== "ai");
  });
  segInit(".xq-pvpside", (v) => { duoduoSide = v as Side; });
  segInit(".xq-aiside", (v) => { humanSide = v as Side; });

  /** 某一边由谁来扮演。 */
  function mascotOf(side: Side): Mascot {
    if (modeKind === "pvp") {
      return side === duoduoSide ? "duoduo" : "xingxing";
    }
    return side === humanSide ? "duoduo" : "robot";
  }

  function isHumanSide(side: Side): boolean {
    return modeKind === "pvp" || side === humanSide;
  }

  function humanTurn(): boolean {
    return !gameOver && !aiThinking && isHumanSide(current);
  }

  function sideLabel(side: Side): string {
    return side === "red" ? "红方" : "黑方";
  }

  function updateHud(): void {
    const redM = mascotOf("red");
    const blackM = mascotOf("black");
    pRedEl.innerHTML = `${avatarHTML(redM, 30)} ${MASCOT_NAME[redM]} · 红`;
    pBlackEl.innerHTML = `${avatarHTML(blackM, 30)} ${MASCOT_NAME[blackM]} · 黑`;
    pRedEl.classList.toggle("turn", !gameOver && current === "red");
    pBlackEl.classList.toggle("turn", !gameOver && current === "black");
    undoBtn.disabled = !undoSnap || gameOver || aiThinking;
    // 被吃的子：上排显示黑方损失，下排显示红方损失
    capTopEl.textContent = captured.black.length ? `⚫ 被吃：${captured.black.join(" ")}` : "";
    capBottomEl.textContent = captured.red.length ? `🔴 被吃：${captured.red.join(" ")}` : "";
  }

  function resetGame(): void {
    board = initialBoard();
    current = "red";
    selected = null;
    targets = [];
    lastMove = null;
    gameOver = false;
    aiThinking = false;
    undoSnap = null;
    captured = { red: [], black: [] };
    dragging = null;
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    const redM = mascotOf("red");
    msgEl.textContent = `${MASCOT_NAME[redM]}拿红棋先走！点棋子看看它能去哪`;
    updateHud();
    maybeAiTurn();
  }

  function startGame(): void {
    setupEl.classList.add("xq-hidden");
    gameEl.classList.remove("xq-hidden");
    resetGame();
  }

  function backToSetup(): void {
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    gameEl.classList.add("xq-hidden");
    setupEl.classList.remove("xq-hidden");
    api.play("tap");
  }

  function finishGame(loser: Side, how: "checkmate" | "stalemate"): void {
    gameOver = true;
    aiThinking = false;
    selected = null;
    targets = [];
    updateHud();
    const winner = other(loser);
    const winM = mascotOf(winner);
    const howText = how === "checkmate" ? "将死" : "困毙";
    msgEl.textContent = `🎉 ${MASCOT_NAME[winM]}（${sideLabel(winner)}）${howText}了对手！`;
    clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (destroyed) return;
      if (modeKind === "pvp") {
        api.onWin(1, `🎉 ${MASCOT_NAME[winM]}赢啦！${sideLabel(loser)}被${howText}，再来一盘！`);
      } else if (isHumanSide(winner)) {
        api.onWin(3, `太厉害了！你${howText}了棋灵象，是真正的小棋王！`);
      } else {
        api.onLose(`棋灵象这盘赢了（${howText}）。记住：将帅要藏好，再来挑战！`);
      }
    }, 1400);
    api.play(modeKind === "ai" && !isHumanSide(winner) ? "oops" : "win");
  }

  /** 走完一步后的公共处理。 */
  function afterMove(move: Move): void {
    const movedDesc = describeMove(board, move);
    const capturedPiece = board[idx(move.to.x, move.to.y)];
    if (capturedPiece) {
      const name = PIECE_NAME[capturedPiece.side][capturedPiece.type];
      captured[capturedPiece.side].push(name);
      api.play("coin");
    } else {
      api.play("pop");
    }
    board = applyMove(board, move);
    lastMove = move;
    selected = null;
    targets = [];
    current = other(current);
    const st = statusOf(board, current);
    if (st === "checkmate" || st === "stalemate") {
      finishGame(current, st);
      return;
    }
    if (st === "check") {
      checkFlashUntil = animTime + 2.2;
      api.play("jump");
      msgEl.textContent = `⚔️ 将军！${MASCOT_NAME[mascotOf(current)]}（${sideLabel(current)}）快保护将帅！`;
    } else {
      msgEl.textContent = movedDesc;
    }
    updateHud();
    maybeAiTurn();
  }

  function maybeAiTurn(): void {
    if (gameOver || modeKind !== "ai" || isHumanSide(current)) return;
    aiThinking = true;
    updateHud();
    msgEl.textContent = "🐘 棋灵象晃着鼻子思考中…";
    clearTimeout(aiTimer);
    aiTimer = window.setTimeout(() => {
      if (destroyed || gameOver) return;
      const mv = aiMove(board, current);
      aiThinking = false;
      if (!mv) {
        finishGame(current, inCheck(board, current) ? "checkmate" : "stalemate");
        return;
      }
      afterMove(mv);
    }, 650);
  }

  function trySelect(x: number, y: number): boolean {
    const p = board[idx(x, y)];
    if (!p || p.side !== current || !humanTurn()) return false;
    selected = { x, y };
    targets = legalMoves(board, x, y);
    api.play("tap");
    if (targets.length === 0) {
      msgEl.textContent = `这个${PIECE_NAME[p.side][p.type]}现在没有能走的地方，换一个试试`;
    } else {
      msgEl.textContent = "绿色圆点都是它能去的地方！";
    }
    return true;
  }

  function tryMoveTo(x: number, y: number): boolean {
    if (!selected || !humanTurn()) return false;
    if (!targets.some((t) => t.x === x && t.y === y)) return false;
    // 悔棋一档：记录走子前的局面
    undoSnap = {
      board: board.slice(),
      current,
      lastMove: lastMove ? { from: { ...lastMove.from }, to: { ...lastMove.to } } : null,
    };
    afterMove({ from: selected, to: { x, y } });
    return true;
  }

  function undo(): void {
    if (!undoSnap || gameOver || aiThinking) return;
    board = undoSnap.board;
    current = undoSnap.current;
    lastMove = undoSnap.lastMove;
    undoSnap = null;
    selected = null;
    targets = [];
    // 重算被吃列表
    captured = { red: [], black: [] };
    const now = new Map<string, number>();
    for (const p of board) {
      if (p) now.set(p.side + p.type, (now.get(p.side + p.type) ?? 0) + 1);
    }
    const full = initialBoard();
    const start = new Map<string, number>();
    for (const p of full) {
      if (p) start.set(p.side + p.type, (start.get(p.side + p.type) ?? 0) + 1);
    }
    for (const [key, cnt] of start) {
      const side = key.slice(0, key.length - 1) as Side;
      const type = key.slice(-1) as keyof (typeof PIECE_NAME)["red"];
      const missing = cnt - (now.get(key) ?? 0);
      for (let i = 0; i < missing; i++) captured[side].push(PIECE_NAME[side][type]);
    }
    api.play("pop");
    msgEl.textContent = "悔棋成功！这一步重新想一想～";
    updateHud();
  }

  /* ---------------- 绘制 ---------------- */

  function drawBoardBg(): void {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#F7E2BC");
    g.addColorStop(1, "#F0D3A2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#B9854E";
    ctx.lineWidth = 1.6;
    // 横线 10 条
    for (let y = 0; y < 10; y++) {
      ctx.beginPath();
      ctx.moveTo(px(0), py(y));
      ctx.lineTo(px(8), py(y));
      ctx.stroke();
    }
    // 竖线：两侧贯通，中间在楚河汉界断开
    for (let x = 0; x < 9; x++) {
      if (x === 0 || x === 8) {
        ctx.beginPath();
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(9));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(4));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px(x), py(5));
        ctx.lineTo(px(x), py(9));
        ctx.stroke();
      }
    }
    // 外框加粗
    ctx.lineWidth = 3;
    ctx.strokeRect(px(0) - 4, py(0) - 4, C * 8 + 8, C * 9 + 8);
    ctx.lineWidth = 1.6;
    // 九宫斜线
    for (const top of [0, 7]) {
      ctx.beginPath();
      ctx.moveTo(px(3), py(top));
      ctx.lineTo(px(5), py(top + 2));
      ctx.moveTo(px(5), py(top));
      ctx.lineTo(px(3), py(top + 2));
      ctx.stroke();
    }
    // 楚河汉界
    ctx.fillStyle = "#A8743C";
    ctx.font = `700 ${Math.round(C * 0.5)}px "Kaiti SC", "STKaiti", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const midY = (py(4) + py(5)) / 2;
    ctx.fillText("楚 河", px(2), midY);
    ctx.fillText("汉 界", px(6), midY);
    // 炮位与兵位小标记
    const marks: Array<[number, number]> = [
      [1, 2], [7, 2], [1, 7], [7, 7],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
    ];
    ctx.strokeStyle = "#C79A66";
    ctx.lineWidth = 1.4;
    for (const [mx, my] of marks) {
      const cx = px(mx);
      const cy = py(my);
      const d = 5;
      const gpx = 3;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        if ((mx === 0 && sx < 0) || (mx === 8 && sx > 0)) continue;
        ctx.beginPath();
        ctx.moveTo(cx + sx * gpx, cy + sy * (gpx + d));
        ctx.lineTo(cx + sx * gpx, cy + sy * gpx);
        ctx.lineTo(cx + sx * (gpx + d), cy + sy * gpx);
        ctx.stroke();
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawPiece(cx: number, cy: number, side: Side, name: string, alpha = 1, lift = 0): void {
    ctx.globalAlpha = alpha;
    // 影子
    ctx.beginPath();
    ctx.arc(cx, cy + 3, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120, 80, 40, .3)";
    ctx.fill();
    const yy = cy - lift;
    // 木质圆饼
    const g = ctx.createRadialGradient(cx - R * 0.35, yy - R * 0.4, R * 0.15, cx, yy, R);
    g.addColorStop(0, "#FFF9EC");
    g.addColorStop(1, side === "red" ? "#FFE3CE" : "#EDE7DA");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, yy, R, 0, Math.PI * 2);
    ctx.fill();
    // 双圈
    ctx.strokeStyle = side === "red" ? "#C0392B" : "#3A3A55";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, yy, R - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, yy, R - 5, 0, Math.PI * 2);
    ctx.stroke();
    // 字
    ctx.fillStyle = side === "red" ? "#C0392B" : "#3A3A55";
    ctx.font = `800 ${Math.round(R * 1.05)}px "Kaiti SC", "STKaiti", "PingFang SC", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, cx, yy + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }

  function draw(): void {
    drawBoardBg();
    // 上一步标记
    if (lastMove) {
      for (const p of [lastMove.from, lastMove.to]) {
        ctx.strokeStyle = "rgba(255, 150, 60, .9)";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px(p.x) - R - 2, py(p.y) - R - 2, (R + 2) * 2, (R + 2) * 2);
      }
    }
    // 棋子
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const p = board[idx(x, y)];
        if (!p) continue;
        if (dragging && dragging.from.x === x && dragging.from.y === y) continue;
        const isSel = selected && selected.x === x && selected.y === y;
        const lift = isSel ? 3 + Math.sin(animTime * 5) * 1.5 : 0;
        drawPiece(px(x), py(y), p.side, PIECE_NAME[p.side][p.type], 1, lift);
        if (isSel) {
          ctx.strokeStyle = "#FF7EA8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px(x), py(y) - lift, R + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // 合法落点
    if (selected && !gameOver) {
      for (const t of targets) {
        const cx = px(t.x);
        const cy = py(t.y);
        const hasEnemy = !!board[idx(t.x, t.y)];
        const pulse = 1 + Math.sin(animTime * 5) * 0.12;
        if (hasEnemy) {
          ctx.strokeStyle = "rgba(230, 90, 90, .95)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(cx, cy, (R + 4) * pulse, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(90, 190, 90, .85)";
          ctx.beginPath();
          ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    // 将军红光
    if (!gameOver && animTime < checkFlashUntil) {
      const king = ((): Pos | null => {
        for (let y = 0; y < 10; y++) {
          for (let x = 3; x <= 5; x++) {
            const p = board[idx(x, y)];
            if (p && p.type === "K" && p.side === current) return { x, y };
          }
        }
        return null;
      })();
      if (king) {
        const glow = 0.4 + Math.abs(Math.sin(animTime * 7)) * 0.5;
        ctx.strokeStyle = `rgba(255, 60, 60, ${glow})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(px(king.x), py(king.y), R + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // 拖动中的棋子跟随手指
    if (dragging) {
      const p = board[idx(dragging.from.x, dragging.from.y)];
      if (p) drawPiece(dragging.x, dragging.y - 14, p.side, PIECE_NAME[p.side][p.type], 0.9, 0);
    }
  }

  function tick(now: number): void {
    if (destroyed) return;
    animTime = now / 1000;
    if (!gameEl.classList.contains("xq-hidden")) draw();
    raf = requestAnimationFrame(tick);
  }

  /* ---------------- 输入 ---------------- */

  function eventPoint(e: PointerEvent): { cx: number; cy: number; x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * W;
    const cy = ((e.clientY - rect.top) / rect.height) * H;
    const x = Math.round((cx - M) / C);
    const y = Math.round((cy - M) / C);
    if (x < 0 || x > 8 || y < 0 || y > 9) return null;
    if (Math.hypot(cx - px(x), cy - py(y)) > C * 0.52) return null;
    return { cx, cy, x, y };
  }

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (gameOver || !humanTurn()) return;
    const pt = eventPoint(e);
    if (!pt) return;
    // 已选中且点到合法落点 → 直接走
    if (selected && targets.some((t) => t.x === pt.x && t.y === pt.y)) {
      tryMoveTo(pt.x, pt.y);
      return;
    }
    // 点到自己的子 → 选中并允许拖动
    if (trySelect(pt.x, pt.y)) {
      dragging = { from: { x: pt.x, y: pt.y }, x: pt.cx, y: pt.cy };
      return;
    }
    // 点到空处 → 取消选择
    selected = null;
    targets = [];
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    dragging.x = ((e.clientX - rect.left) / rect.width) * W;
    dragging.y = ((e.clientY - rect.top) / rect.height) * H;
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    const from = dragging.from;
    dragging = null;
    const pt = eventPoint(e);
    // 拖到别的点：若合法就落子；拖回原地当作点选保留
    if (pt && (pt.x !== from.x || pt.y !== from.y)) {
      if (!tryMoveTo(pt.x, pt.y)) {
        api.play("oops");
        msgEl.textContent = "那里去不了哦，看看绿色圆点！";
      }
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", () => { dragging = null; });

  (wrap.querySelector(".xq-start") as HTMLButtonElement).addEventListener("click", () => {
    api.play("jump");
    startGame();
  });
  (wrap.querySelector(".xq-rulesbtn") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("xq-hidden");
  });
  (wrap.querySelector(".xq-rules-close") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("xq-hidden");
  });
  helpBtn.addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("xq-hidden");
  });
  undoBtn.addEventListener("click", undo);
  restartBtn.addEventListener("click", () => {
    api.play("tap");
    resetGame();
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
