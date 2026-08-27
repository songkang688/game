import { meta } from "./meta";
export { meta };

// 朵朵星星象棋 1.2：
//  · 残局闯关 188 课 —— 走平台的 188 关框架（课号 / 星级 / 攻略 / 跳关全归框架管），
//    8 章从「一车封路」一路练到「别走成和棋」，每课都有唯一主线解；
//  · 自由对战 —— 人机六档（小象学步…星海棋神）+ 朵朵 VS 星星双人同屏；
//  · 残局连胜 —— 一课接一课地解，错一次结束，最高连胜写平台 endlessBest。
// 规则、记谱、AI、对局状态都在旁边的纯逻辑模块里，这个文件只做「装配 + 画面」。
import {
  type Board,
  type Move,
  type Pos,
  type Side,
  PIECE_NAME,
  idx,
  initialBoard,
  other,
  statusOf,
} from "./logic";
import {
  type Difficulty,
  DIFFICULTIES,
  DIFFICULTY_BLURB,
  DIFFICULTY_NAME,
  PIECE_VALUE,
  THINK_DELAY_MS,
  TIER_SHORT,
  chooseMove,
  hintMove,
} from "./ai";
import { legalTargets, positionKey } from "./movegen";
import {
  type RecordEntry,
  illegalReason,
  judgeRecord,
  pushRecord,
  repeatWarning,
} from "./rules";
import { moveToChinese, recordLine } from "./notation";
import {
  type Endgame,
  CHAPTERS,
  PUZZLES,
  failText,
  goalText,
  headline,
  hintText,
  openingTip,
  puzzleAt,
  puzzleBoard,
  solvedText,
  starsFor,
} from "./endgames";
import {
  type AskState,
  type PickState,
  ENDLESS_REASON,
  agreeAsk,
  aiAgreesDraw,
  confirmDefault,
  difficultyForLevel,
  drawRefusalLine,
  emptyPick,
  initialLevelOf,
  newAsk,
  newStreak,
  streakPuzzle,
  streakStep,
  streakSummary,
  tapPoint,
  undoSteps,
  type StreakState,
} from "./session";
import { CSS, createBoardView, type BoardView } from "./view";
import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { save } from "../../engine/save";
import guideBook from "./guide";

export { CHAPTERS, difficultyForLevel };

/* ---- 头像：PNG 到位后自动使用，暂时用可爱占位 ---- */
const AVATAR_URLS = import.meta.glob("../../assets/avatars/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

type Mascot = "duoduo" | "xingxing" | "robot";

const MASCOT_NAME: Record<Mascot, string> = { duoduo: "朵朵", xingxing: "星星", robot: "棋灵象" };

function avatarHTML(who: Mascot, size = 30): string {
  const file = who === "duoduo" ? "duoduo-q.png" : who === "xingxing" ? "xingxing-q.png" : "";
  const url = file ? AVATAR_URLS[`../../assets/avatars/${file}`] : undefined;
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : who === "xingxing" ? "⭐" : "🐘";
  const bg = who === "duoduo" ? "#FFD9E8" : who === "xingxing" ? "#D9E6FF" : "#E4D9FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(
    size * 0.58,
  )}px;vertical-align:middle">${emoji}</span>`;
}

const RULES_HTML = `
  <h3>🎯 怎么赢</h3>
  <p>让对方的<b>将 / 帅</b>没地方逃、没人来救（将死），或者对方<b>一步棋都走不了</b>（困毙），你就赢了。困毙也算赢，不是出错哦。</p>
  <h3>🖐️ 怎么走</h3>
  <p>① 点自己的棋子，棋盘上会亮出<b>绿色小圆点</b>；<br>② 点小圆点，会先出现一个<b>半透明的预览子</b>；<br>③ <b>再点一次</b>才真的落子（手机默认开着确认，桌面可以关掉）。</p>
  <h3>🍵 吃子是什么意思</h3>
  <p>走到对方棋子的位置上，那个子就下场了 —— 在这里我们说它<b>请回家休息</b>。棋子只是回家，没有谁受伤。</p>
  <h3>♟️ 每个棋子怎么走</h3>
  <p>🤴 <b>帅 / 将</b>：九宫格内直走一格。两个将帅不能在同一条线上照面（飞将）。</p>
  <p>🛡️ <b>仕 / 士</b>：九宫内斜走一格。</p>
  <p>🐘 <b>相 / 象</b>：走「田」字，不能过河；田字中心有子叫「塞象眼」，走不了。</p>
  <p>🐴 <b>马</b>：走「日」字；马脚边紧挨着子叫「蹩马腿」，那个方向跳不过去。</p>
  <p>🚗 <b>车</b>：直线走多远都行，但不能越子。</p>
  <p>💥 <b>炮</b>：走法同车；<b>吃子必须隔一个「炮架」</b>。</p>
  <p>🌾 <b>兵 / 卒</b>：一次一步向前；<b>过河后</b>可以左右横走，永远不能后退。</p>
  <h3>⚠️ 两条容易忘的规则</h3>
  <p>👉 <b>将军要应</b>：垫一个子、吃掉将军的子，或者把将帅挪开，三选一。<br>
  👉 <b>不许一直将军</b>：同一招将军把同一个局面走出三次，判走的人输 —— 换一条进攻路线才是本事。同一个局面来回走三次算和棋。</p>
  <h3>📖 记谱怎么读</h3>
  <p>棋盘下面那一条是<b>中文纵线记谱</b>：红方从自己右手边数「一~九」，黑方数「1~9」。「炮二平五」＝二线上的炮平移到五线；「马8进7」＝黑方 8 线的马向前跳到 7 线。</p>
`;

/* ------------------------------------------------------------------ */
/* 一张棋桌：自由对战 / 残局 / 连胜共用                                 */
/* ------------------------------------------------------------------ */

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "resign"
  | "draw"
  | "repetition"
  | "perpetual"
  | "moves";

export interface TableResult {
  /** 谁赢了；和棋是 null */
  winner: Side | null;
  reason: EndReason;
}

interface TableOpts {
  api: GameApi;
  board: Board;
  /** 人执哪一方；"both" 是双人同屏 */
  human: Side | "both";
  ai: Difficulty | null;
  /** 残局：红方最多还能走几步 */
  movesLeft?: number;
  puzzle?: Endgame;
  headline: string;
  opening: string;
  extras?: Array<{ cls: string; label: string; onClick: () => void }>;
  onEnd: (r: TableResult) => void;
  onHint?: () => void;
}

interface Table {
  destroy: () => void;
  /** 单测用：直接点某个交叉点 */
  tap: (x: number, y: number) => void;
}

function prefersReducedMotion(): boolean {
  try {
    return !!(globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
  } catch {
    return false;
  }
}

function pointerEnv(): { coarsePointer?: boolean; maxTouchPoints?: number } {
  const g = globalThis as {
    matchMedia?: (q: string) => { matches: boolean };
    navigator?: { maxTouchPoints?: number };
  };
  let coarse: boolean | undefined;
  try {
    coarse = g.matchMedia?.("(pointer: coarse)")?.matches;
  } catch {
    coarse = undefined;
  }
  return { coarsePointer: coarse, maxTouchPoints: g.navigator?.maxTouchPoints };
}

/** 子力差（求和判断用） */
function materialDiff(board: Board): number {
  let s = 0;
  for (const p of board) {
    if (!p) continue;
    s += p.side === "red" ? PIECE_VALUE[p.type] : -PIECE_VALUE[p.type];
  }
  return s;
}

/** 盘上还剩多少子（求和门槛按这个放宽：残棋不必凑满 40 手） */
function pieceCount(board: Board): number {
  let n = 0;
  for (const p of board) if (p) n++;
  return n;
}

function mountTable(host: HTMLElement, o: TableOpts): Table {
  const wrap = document.createElement("div");
  wrap.className = "xq-wrap";
  const top = document.createElement("div");
  top.className = "xq-top";
  const redEl = document.createElement("span");
  redEl.className = "xq-player xq-red";
  const blackEl = document.createElement("span");
  blackEl.className = "xq-player xq-black";
  const tagEl = document.createElement("span");
  tagEl.className = "xq-player";
  tagEl.textContent = o.headline;
  top.append(redEl, blackEl, tagEl);
  wrap.appendChild(top);
  const boardHost = document.createElement("div");
  wrap.appendChild(boardHost);
  const recordEl = document.createElement("div");
  recordEl.className = "xq-record";
  wrap.appendChild(recordEl);
  const btns = document.createElement("div");
  btns.className = "xq-btns";
  wrap.appendChild(btns);
  const askEl = document.createElement("div");
  askEl.className = "xq-btns xq-hidden";
  wrap.appendChild(askEl);
  const msgEl = document.createElement("div");
  msgEl.className = "xq-msg";
  msgEl.textContent = o.opening;
  wrap.appendChild(msgEl);
  host.appendChild(wrap);

  const twoPlayer = o.human === "both";
  let board = o.board;
  let current: Side = "red";
  let pick: PickState = emptyPick();
  let targets: Pos[] = [];
  let history: Array<{ board: Board; current: Side; entries: RecordEntry[] }> = [];
  let entries: RecordEntry[] = [];
  const startKey = positionKey(board, "red");
  let over = false;
  let thinking = false;
  let aiTimer = 0;
  let dead = false;
  let confirmOn = confirmDefault(pointerEnv());
  let movesLeft = o.movesLeft ?? Number.POSITIVE_INFINITY;
  let ask: AskState | null = null;
  let hintLeft = o.puzzle ? 1 : 2;

  const view: BoardView = createBoardView(boardHost, board, {
    reduceMotion: prefersReducedMotion(),
    onTap: (p) => onTap(p.x, p.y),
  });

  function mascotOf(side: Side): Mascot {
    if (twoPlayer) return side === "red" ? "duoduo" : "xingxing";
    return side === o.human ? "duoduo" : "robot";
  }

  function sideLabel(side: Side): string {
    return side === "red" ? "红方" : "黑方";
  }

  function humansTurn(): boolean {
    if (over || thinking || ask) return false;
    if (twoPlayer) return true;
    return current === o.human;
  }

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "xq-undo";
  undoBtn.textContent = "↩️ 悔棋";
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "xq-confirm";
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "xq-hint";
  const resignBtn = document.createElement("button");
  resignBtn.type = "button";
  resignBtn.className = "xq-resign";
  resignBtn.textContent = "🏳️ 认输";
  const drawBtn = document.createElement("button");
  drawBtn.type = "button";
  drawBtn.className = "xq-draw";
  drawBtn.textContent = "🤝 求和";
  btns.append(undoBtn, confirmBtn, hintBtn);
  if (!o.puzzle) btns.append(resignBtn, drawBtn);
  for (const ex of o.extras ?? []) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = ex.cls;
    b.textContent = ex.label;
    b.addEventListener("click", ex.onClick);
    btns.appendChild(b);
  }

  function refresh(): void {
    if (dead) return;
    const redM = mascotOf("red");
    const blackM = mascotOf("black");
    redEl.innerHTML = `${avatarHTML(redM)} ${MASCOT_NAME[redM]} · 红`;
    blackEl.innerHTML = `${avatarHTML(blackM)} ${MASCOT_NAME[blackM]} · 黑`;
    redEl.classList.toggle("xq-turn", !over && current === "red");
    blackEl.classList.toggle("xq-turn", !over && current === "black");
    if (o.puzzle) {
      tagEl.textContent = over
        ? o.headline
        : `${o.headline} · 还能走 ${Number.isFinite(movesLeft) ? movesLeft : "∞"} 步`;
    }
    undoBtn.disabled = history.length === 0 || over || thinking || !!ask;
    confirmBtn.textContent = confirmOn ? "✋ 确认落子：开" : "✋ 确认落子：关";
    hintBtn.textContent = `✨ 提示×${hintLeft}`;
    hintBtn.disabled = hintLeft <= 0 || !humansTurn();
    resignBtn.disabled = over || thinking;
    drawBtn.disabled = over || thinking || !!ask;
    view.update({
      board,
      selected: pick.from,
      pending: pick.pending,
      targets,
      interactive: humansTurn(),
    });
  }

  function renderRecord(): void {
    recordEl.innerHTML = "";
    const from = Math.max(0, entries.length - 24);
    for (let i = from; i < entries.length; i++) {
      const e = entries[i];
      const chip = document.createElement("span");
      chip.className = `xq-step ${e.side === "red" ? "xq-step-red" : "xq-step-black"}`;
      chip.textContent = recordLine(i + 1, e.side, e.text);
      recordEl.appendChild(chip);
    }
    recordEl.scrollLeft = recordEl.scrollWidth;
  }

  function finish(winner: Side | null, reason: EndReason, text: string): void {
    if (over) return;
    over = true;
    thinking = false;
    pick = emptyPick();
    targets = [];
    clearTimeout(aiTimer);
    msgEl.textContent = text;
    view.update({
      interactive: false,
      pending: null,
      selected: null,
      targets: [],
      dim: reason === "checkmate" || reason === "stalemate",
    });
    refresh();
    o.onEnd({ winner, reason });
  }

  /** 走一步：记谱、判将军 / 将死 / 长将 / 重复局面，然后交给对方 */
  function doMove(move: Move): void {
    // 先存一份，悔棋才有得退
    history.push({ board: board.slice(), current, entries: entries.slice() });
    if (history.length > 40) history.shift();
    const text = moveToChinese(board, move);
    const captured = board[idx(move.to.x, move.to.y)];
    entries = pushRecord(entries, board, move, current, text);
    const next = board.slice();
    next[idx(move.to.x, move.to.y)] = next[idx(move.from.x, move.from.y)];
    next[idx(move.from.x, move.from.y)] = null;
    board = next;
    pick = emptyPick();
    targets = [];
    o.api.play(captured ? "coin" : "pop");
    const mover = current;
    current = other(current);
    renderRecord();

    const st = statusOf(board, current);
    view.update({
      board,
      lastMove: move,
      checkSide: st === "check" || st === "checkmate" ? current : null,
    });

    if (o.puzzle && mover === "red") movesLeft--;

    if (st === "checkmate" || st === "stalemate") {
      const how = st === "checkmate" ? "将死" : "困毙";
      const winner = mover;
      const tip =
        st === "stalemate"
          ? `${sideLabel(current)}一步棋都走不了 —— 这叫困毙，同样算${sideLabel(winner)}赢，不是出错哦。`
          : `${sideLabel(winner)}${how}了对手！`;
      o.api.play("win");
      finish(winner, st, tip);
      return;
    }

    const verdict = judgeRecord(startKey, entries);
    if (verdict.kind === "perpetual") {
      o.api.play("oops");
      finish(other(verdict.loser as Side), "perpetual", verdict.text);
      return;
    }
    if (verdict.kind === "repetition") {
      o.api.play("meow");
      finish(null, "repetition", verdict.text);
      return;
    }

    if (o.puzzle && mover === "red" && movesLeft <= 0) {
      o.api.play("oops");
      finish("black", "moves", failText(o.puzzle));
      return;
    }

    // 差一次就要收局：提前说一句，别等判负 / 判和了才知道自己在绕圈
    const warning = repeatWarning(startKey, entries);

    if (st === "check") {
      o.api.play("jump");
      view.flashCheck();
      const who = twoPlayer ? MASCOT_NAME[mascotOf(current)] : sideLabel(current);
      msgEl.textContent = warning.kind === "none"
        ? `⚔️ 将军！${who}要马上应将：垫一个子、吃掉它，或者把将帅挪开。`
        : `⚔️ 将军！${warning.text}`;
    } else if (warning.kind !== "none") {
      msgEl.textContent = `🔁 ${warning.text}`;
    } else {
      const capturedText = captured
        ? `请${captured.side === "red" ? "红" : "黑"}${PIECE_NAME[captured.side][captured.type]}回家休息`
        : "";
      msgEl.textContent = `${sideLabel(mover)} ${text}${capturedText ? ` —— ${capturedText}` : ""}`;
    }
    refresh();
    scheduleAi();
  }

  function scheduleAi(): void {
    if (over || dead) return;
    if (o.puzzle) {
      if (current !== "black") return;
    } else if (!o.ai || twoPlayer || current === o.human) {
      return;
    }
    const tier: Difficulty = o.puzzle ? "hard" : (o.ai as Difficulty);
    thinking = true;
    refresh();
    msgEl.textContent = o.puzzle
      ? "⚫ 黑方在找活路…"
      : `${DIFFICULTY_NAME[tier]} 正在想…`;
    clearTimeout(aiTimer);
    // 再快的档也要「看得见在想」：THINK_DELAY_MS 兜住最短思考时间
    aiTimer = window.setTimeout(() => {
      if (dead || over) return;
      const mv = chooseMove(board, current, tier);
      thinking = false;
      if (!mv) {
        const st = statusOf(board, current);
        finish(other(current), st === "stalemate" ? "stalemate" : "checkmate", "这一局结束啦！");
        return;
      }
      doMove(mv);
    }, THINK_DELAY_MS[tier]);
  }

  function onTap(x: number, y: number): void {
    if (dead || over) return;
    const at = { x, y };
    const cell = board[idx(x, y)];
    const res = tapPoint(pick, at, {
      confirm: confirmOn,
      myTurn: humansTurn(),
      mine: !!cell && cell.side === current,
      legalTarget: targets.some((t) => t.x === x && t.y === y),
    });
    pick = res.state;
    switch (res.kind) {
      case "select":
      case "reselect": {
        targets = legalTargets(board, x, y);
        o.api.play("tap");
        const p = board[idx(x, y)]!;
        msgEl.textContent = targets.length
          ? `选中了${PIECE_NAME[p.side][p.type]}，绿色小圆点都是它能去的地方。`
          : `这个${PIECE_NAME[p.side][p.type]}暂时没地方走，换一个试试。`;
        break;
      }
      case "clear":
        targets = [];
        break;
      case "preview":
      case "movePreview":
        o.api.play("tap");
        msgEl.textContent = "再点一次这个位置就落子，点别处可以换地方。";
        break;
      case "commit":
        if (res.move) doMove({ from: res.move.from, to: res.move.to });
        return;
      case "illegal": {
        const why = pick.from ? illegalReason(board, pick.from, at, current) : null;
        o.api.play("oops");
        msgEl.textContent = why ? why.text : "那里去不了，看看绿色小圆点。";
        break;
      }
      default:
        break;
    }
    refresh();
  }

  /* ---------------- 悔棋 / 认输 / 求和 ---------------- */

  function applyUndo(): void {
    const steps = undoSteps(twoPlayer, history.length);
    for (let i = 0; i < steps; i++) {
      const snap = history.pop();
      if (!snap) break;
      board = snap.board;
      current = snap.current;
      entries = snap.entries;
    }
    if (o.puzzle) movesLeft = Math.min(o.puzzle.mateIn, movesLeft + 1);
    pick = emptyPick();
    targets = [];
    o.api.play("pop");
    msgEl.textContent = "悔棋成功，这一步重新想一想。";
    renderRecord();
    view.update({ board, checkSide: null, lastMove: null });
    refresh();
  }

  function showAsk(a: AskState): void {
    ask = a;
    askEl.innerHTML = "";
    askEl.classList.remove("xq-hidden");
    const label = document.createElement("span");
    label.className = "xq-step";
    const asker = MASCOT_NAME[mascotOf(a.from)];
    label.textContent = a.kind === "undo" ? `${asker}想悔一步棋，对方同意吗？` : `${asker}想和棋，对方同意吗？`;
    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "xq-undo";
    yes.textContent = "👍 同意";
    yes.addEventListener("click", () => {
      const who = a.from === "red" ? "black" : "red";
      const agreed = agreeAsk(a, who);
      closeAsk();
      if (!agreed.agreed) return;
      if (a.kind === "undo") applyUndo();
      else finish(null, "draw", "两边都同意，这一局握手言和。");
    });
    const no = document.createElement("button");
    no.type = "button";
    no.className = "xq-restart";
    no.textContent = "🙅 不同意";
    no.addEventListener("click", () => {
      closeAsk();
      msgEl.textContent = a.kind === "undo" ? "对方不同意悔棋，接着下吧。" : "对方想继续下，那就接着下。";
    });
    askEl.append(label, yes, no);
    refresh();
  }

  function closeAsk(): void {
    ask = null;
    askEl.innerHTML = "";
    askEl.classList.add("xq-hidden");
    refresh();
  }

  undoBtn.addEventListener("click", () => {
    if (history.length === 0 || over || thinking || ask) return;
    o.api.play("tap");
    if (twoPlayer) {
      // 双人同屏：两边都点头才退回去
      showAsk(newAsk("undo", current, true));
      return;
    }
    applyUndo();
  });

  confirmBtn.addEventListener("click", () => {
    confirmOn = !confirmOn;
    pick = emptyPick();
    o.api.play("tap");
    msgEl.textContent = confirmOn
      ? "确认落子开着：先点出预览子，再点一次才真的走。"
      : "确认落子关掉了：点哪里就走哪里，小心手滑。";
    refresh();
  });

  hintBtn.addEventListener("click", () => {
    if (hintLeft <= 0 || !humansTurn()) return;
    hintLeft--;
    o.api.play("coin");
    o.onHint?.();
    if (o.puzzle) {
      msgEl.textContent = hintText(o.puzzle);
    } else {
      const mv = hintMove(board, current);
      msgEl.textContent = mv
        ? `试试动一下${PIECE_NAME[current][board[idx(mv.from.x, mv.from.y)]!.type]}，它现在最有机会。`
        : "现在没什么好主意，先把将帅护住。";
    }
    refresh();
  });

  resignBtn.addEventListener("click", () => {
    if (over || thinking) return;
    o.api.play("tap");
    const loser = twoPlayer ? current : (o.human as Side);
    finish(other(loser), "resign", `${sideLabel(loser)}认输了。下一盘换个开局，说不定就赢回来。`);
  });

  drawBtn.addEventListener("click", () => {
    if (over || thinking || ask) return;
    o.api.play("tap");
    if (twoPlayer) {
      showAsk(newAsk("draw", current, true));
      return;
    }
    // 人机：子力差不多、又下够了这个盘面该走的手数，电脑才点头。
    // 门槛与说辞都走 session.ts 的纯函数,不再在这里抄第二份规则
    const diff = materialDiff(board);
    const pieces = pieceCount(board);
    if (aiAgreesDraw(diff, entries.length, pieces)) {
      finish(null, "draw", "对手同意和棋，这一局平分秋色。");
    } else {
      msgEl.textContent = drawRefusalLine(diff, entries.length, pieces);
    }
  });

  renderRecord();
  refresh();
  // 残局与人机都可能是电脑先手
  scheduleAi();

  return {
    destroy() {
      dead = true;
      clearTimeout(aiTimer);
      view.destroy();
      wrap.remove();
    },
    tap: (x, y) => onTap(x, y),
  };
}

/* ------------------------------------------------------------------ */
/* 残局闯关 188 课                                                     */
/* ------------------------------------------------------------------ */

function playLevel(host: HTMLElement, ctx: PlayCtx): PlayHandle {
  const p: Endgame = puzzleAt(ctx.level);
  let table: Table | null = null;
  let hintUsed = false;
  let retries = 0;
  let dead = false;
  let settleTimer = 0;

  const api: GameApi = {
    root: host,
    play: (n) => ctx.sfx(n),
    addStars: (n) => {
      ctx.bonusStars(n);
      return n;
    },
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  };

  function start(): void {
    table?.destroy();
    host.innerHTML = "";
    table = mountTable(host, {
      api,
      board: puzzleBoard(p),
      human: "red",
      ai: null,
      movesLeft: p.mateIn,
      puzzle: p,
      headline: headline(p),
      opening: openingTip(p),
      onHint: () => {
        hintUsed = true;
      },
      extras: [
        {
          cls: "xq-restart",
          label: "🔄 重摆",
          onClick: () => {
            if (dead) return;
            retries++;
            ctx.sfx("tap");
            start();
          },
        },
      ],
      onEnd: (r) => {
        if (dead) return;
        const solved = r.winner === "red" && (r.reason === "checkmate" || r.reason === "stalemate");
        settleTimer = window.setTimeout(() => {
          if (dead) return;
          if (solved) ctx.win(starsFor(hintUsed, retries), solvedText(p, hintUsed));
          else ctx.lose(failText(p));
        }, 900);
      },
    });
  }

  start();
  return {
    destroy() {
      dead = true;
      clearTimeout(settleTimer);
      table?.destroy();
      table = null;
    },
  };
}

/** 在已经挂好的 188 课地图上，替玩家点开第 N 课（锁着就停在能玩的最远那一课） */
export function openCampaignLevel(host: HTMLElement, level: number): boolean {
  const stars = loadStars(meta.id);
  const skips = loadSkips(meta.id);
  const want = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  const target = Math.min(want, furthestPlayable(stars, skips, TOTAL_LEVELS));
  const ci = chapterOf(CHAPTERS, target);
  const tabs = host.querySelectorAll?.(".l99-tab");
  const tab = tabs?.[ci] as HTMLButtonElement | undefined;
  tab?.click?.();
  const nodes = host.querySelectorAll?.(".l99-node");
  const node = nodes?.[target - chapterStart(CHAPTERS, ci)] as HTMLButtonElement | undefined;
  if (!node || node.disabled) return false;
  node.click();
  return true;
}

/* ------------------------------------------------------------------ */
/* 自由对战                                                            */
/* ------------------------------------------------------------------ */

function segment(
  host: HTMLElement,
  label: string,
  items: Array<{ v: string; text: string }>,
  initial: string,
  onPick: (v: string) => void,
): HTMLElement {
  const box = document.createElement("div");
  const cap = document.createElement("div");
  cap.className = "xq-label";
  cap.textContent = label;
  const seg = document.createElement("div");
  seg.className = "xq-seg";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = it.v === initial ? "xq-on" : "";
    b.textContent = it.text;
    b.setAttribute("data-v", it.v);
    b.addEventListener("click", () => {
      for (const sib of Array.from(seg.children)) (sib as HTMLElement).className = "";
      b.className = "xq-on";
      onPick(it.v);
    });
    seg.appendChild(b);
  }
  box.append(cap, seg);
  host.appendChild(box);
  return seg;
}

function mountFree(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const root = document.createElement("div");
  root.className = "xq-wrap";
  host.appendChild(root);
  let table: Table | null = null;
  let tier: Difficulty | "pvp" = "normal";
  let humanSide: Side = "red";

  function showSetup(): void {
    table?.destroy();
    table = null;
    root.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "xq-panel";
    root.appendChild(panel);

    const blurb = document.createElement("div");
    blurb.className = "xq-tierblurb";
    blurb.textContent = DIFFICULTY_BLURB[tier === "pvp" ? "normal" : tier];
    segment(
      panel,
      "🤝 和谁下（六档，从小象学步到星海棋神）",
      [
        ...DIFFICULTIES.map((d) => ({ v: d, text: DIFFICULTY_NAME[d] })),
        { v: "pvp", text: "👫 朵朵 VS 星星" },
      ],
      tier,
      (v) => {
        tier = v as Difficulty | "pvp";
        blurb.textContent =
          v === "pvp"
            ? "两个人轮流点棋盘，红棋先走；悔棋和求和都要两边都点头。"
            : DIFFICULTY_BLURB[v as Difficulty];
        api.play("tap");
      },
    );
    panel.appendChild(blurb);

    segment(
      panel,
      "🔴 你拿哪边（红棋先走）",
      [
        { v: "red", text: "🔴 我拿红棋先走" },
        { v: "black", text: "⚫ 我拿黑棋后走" },
      ],
      humanSide,
      (v) => {
        humanSide = v as Side;
        api.play("tap");
      },
    );

    const go = document.createElement("button");
    go.type = "button";
    go.className = "xq-start";
    go.textContent = "开始下棋 ▶";
    go.addEventListener("click", () => {
      api.play("jump");
      startGame();
    });
    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "xq-start";
    leave.style.background = "#FFE0C2";
    leave.style.color = "#8A4E19";
    leave.style.boxShadow = "0 5px 0 #E0B98C";
    leave.textContent = "🧩 回残局学堂";
    leave.addEventListener("click", back);
    panel.append(go, leave);
  }

  function startGame(): void {
    root.innerHTML = "";
    const ai = tier === "pvp" ? null : tier;
    table = mountTable(root, {
      api,
      board: initialBoard(),
      human: ai ? humanSide : "both",
      ai,
      headline: ai ? DIFFICULTY_NAME[ai] : "👫 朵朵 VS 星星",
      opening: ai
        ? `${DIFFICULTY_BLURB[ai]}。红棋先走，点自己的子看看它能去哪。`
        : "🌸 朵朵执红先走，⭐ 星星执黑。悔棋和求和都要两边都同意。",
      extras: [{ cls: "xq-back", label: "🔧 换玩法", onClick: () => showSetup() }],
      onEnd: (r) => {
        if (r.winner === null) {
          api.onWin(1, r.reason === "draw" ? "握手言和，这一局谁也没输。" : "同一个局面来回三次，判和。");
          return;
        }
        if (!ai) {
          const who = r.winner === "red" ? "朵朵（红）" : "星星（黑）";
          api.onWin(1, `${who}赢下了这一局，再来一盘！`);
          return;
        }
        if (r.winner === humanSide) {
          const stars: 1 | 2 | 3 = ai === "novice" || ai === "easy" ? 2 : 3;
          api.onWin(stars, `你赢了${TIER_SHORT[ai]}！往上挑一档试试。`);
        } else {
          api.onLose(`${TIER_SHORT[ai]}这一局占了上风。记住：先护住将帅，再找它没保护的子。`);
        }
      },
    });
  }

  showSetup();
  return {
    destroy() {
      table?.destroy();
      table = null;
      root.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 残局连胜（替代真·无尽，理由见 session.ENDLESS_REASON）               */
/* ------------------------------------------------------------------ */

function mountStreak(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const root = document.createElement("div");
  root.className = "xq-wrap";
  host.appendChild(root);
  let table: Table | null = null;
  let streak: StreakState = newStreak(save.getGameProgress(meta.id).endlessBest);
  let dead = false;

  function overPanel(title: string, sub: string, label: string, onClick: () => void): void {
    const ov = document.createElement("div");
    ov.className = "xq-over";
    const t = document.createElement("div");
    t.className = "xq-over-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "xq-over-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "xq-over-btn";
    b.textContent = label;
    b.addEventListener("click", () => {
      ov.remove();
      onClick();
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "xq-over-btn";
    home.textContent = "🧩 回残局学堂";
    home.addEventListener("click", back);
    ov.append(t, s, b, home);
    root.appendChild(ov);
  }

  function startRound(): void {
    table?.destroy();
    root.innerHTML = "";
    const p = puzzleAt(streakPuzzle(streak.wins, PUZZLES.length));
    table = mountTable(root, {
      api,
      board: puzzleBoard(p),
      human: "red",
      ai: null,
      movesLeft: p.mateIn,
      puzzle: p,
      headline: `🔥 连胜 ${streak.wins} · ${headline(p)}`,
      opening: `${goalText(p)}。解错一课这一轮就结束，最高连胜会记下来。`,
      onEnd: (r) => {
        if (dead) return;
        const solved = r.winner === "red" && (r.reason === "checkmate" || r.reason === "stalemate");
        streak = streakStep(streak, solved);
        if (!streak.over) {
          api.addStars(1);
          overPanel(
            `🎉 连解 ${streak.wins} 课！`,
            "下一课马上来，越往后越难。",
            "继续挑战 ▶",
            () => {
              api.play("jump");
              startRound();
            },
          );
          return;
        }
        const best = save.recordEndlessBest(meta.id, streak.wins);
        overPanel("🔥 这一轮结束", streakSummary(streak, best), "🔁 从头再来", () => {
          api.play("jump");
          streak = newStreak(best);
          startRound();
        });
      },
    });
  }

  startRound();
  return {
    destroy() {
      dead = true;
      table?.destroy();
      table = null;
      root.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "xq-modebar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  const rulesEl = document.createElement("div");
  rulesEl.className = "xq-rules xq-hidden";
  rulesEl.innerHTML = `<button class="xq-rules-close" type="button">✖ 关闭</button>
    <h3 style="margin-top:2px">📖 朵朵星星象棋 · 规则</h3>${RULES_HTML}`;
  root.append(style, bar, levelHost, modeHost, rulesEl);
  api.root.appendChild(root);

  const freeBtn = document.createElement("button");
  freeBtn.type = "button";
  freeBtn.className = "xq-mode";
  freeBtn.textContent = "♟️ 自由对战 · 六档 + 双人";
  const streakBtn = document.createElement("button");
  streakBtn.type = "button";
  streakBtn.className = "xq-mode xq-mode-streak";
  const rulesBtn = document.createElement("button");
  rulesBtn.type = "button";
  rulesBtn.className = "xq-mode";
  rulesBtn.textContent = "📖 规则";
  bar.append(freeBtn, streakBtn, rulesBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const b = save.getGameProgress(meta.id).endlessBest;
    streakBtn.textContent = b > 0 ? `🔥 残局连胜 · 最好 ${b} 课` : "🔥 残局连胜 · 一课接一课";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (h: HTMLElement, a: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  freeBtn.addEventListener("click", () => openMode(mountFree));
  streakBtn.addEventListener("click", () => openMode(mountStreak));
  rulesBtn.addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("xq-hidden");
  });
  (rulesEl.querySelector(".xq-rules-close") as HTMLButtonElement | null)?.addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("xq-hidden");
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "每一课都能在规定步数内赢下来，不用提示解开才是 3 星。",
      grandMessage: "188 课残局全部解开，你的算杀已经很有样子了！",
      guide: guideBook,
      guideTitle: "象棋 · 残局手记",
    },
  );

  // 壳层给了 initialLevel（或者地址栏 / hash 带 level=N）就直接开第 N 课
  const hint = (api as unknown as { initialLevel?: number }).initialLevel;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  const want = initialLevelOf(hint, loc?.search ?? "", loc?.hash ?? "");
  if (want >= 0) openCampaignLevel(levelHost, want);

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}

/** 给壳层用：直接开打第 n 课（1 基），越界 clamp */
export function openLevel(host: HTMLElement, n: number): boolean {
  return openCampaignLevel(host, Math.max(0, Math.round(n) - 1));
}

/** 真·无尽为什么不做（导出便于测试与文档一致） */
export { ENDLESS_REASON };
