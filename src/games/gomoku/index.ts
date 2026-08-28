import { meta } from "./meta";
export { meta };

// 五子棋 1.2：
//  · 解局学堂 188 —— 走平台的 188 关框架（关号 / 星级 / 攻略 / 跳关全归框架管），
//    第 100–188 题是 1.2 重做的真解局，每题带解法分类；
//  · 自由对战 —— 人机六档（菜鸟…地狱）+ 朵朵 VS 星星双人同屏；
//  · 连胜挑战 —— 从菜鸟起，赢一盘升一档，输一盘结束，最高连胜写平台 endlessBest。
// 规则、AI、对局状态都在旁边的纯逻辑模块里，这个文件只做「装配 + 画面」。
import {
  DIFFICULTIES,
  DIFFICULTY_BLURB,
  DIFFICULTY_NAME,
  THINK_DELAY_MS,
  bestMove,
  boardFull,
  findWinLine,
  makeBoard,
  other,
  setCell,
  type Board,
  type Difficulty,
  type Player,
} from "./ai";
import {
  PUZZLES,
  SOLUTION_KIND_NAME,
  THEMES,
  puzzleBoard,
  puzzleFailSpeechLine,
  puzzleKind,
  puzzleSolvedSpeechLine,
  type PuzzleDef,
} from "./puzzles";
import {
  CLAIM_WINDOW_MS,
  FORBIDDEN_NAME,
  claimResult,
  claimSecondsLeft,
  judgeMove,
  openClaim,
  pressClaim,
  tickClaim,
  type ClaimState,
} from "./rules";
import {
  TIER_SHORT,
  difficultyForLevel,
  emptyConfirm,
  hintArea,
  hintButtonHint,
  hintSpentLine,
  initialLevelOf,
  migrateLegacyCampaign,
  newHints,
  newStreak,
  prefersConfirm,
  pruneConfirm,
  puzzleStars,
  spendHint,
  streakDifficulty,
  streakOpening,
  streakStep,
  streakWinTitle,
  tapCell,
  type Cell,
  type ConfirmState,
  type HintState,
  type PlayKind,
  type StreakState,
} from "./session";
import { CSS, WIN_JUMP_GAP_MS, WIN_JUMP_MS, WIN_SWEEP_MS, createBoardView, type BoardView } from "./view";
import { hourglassSVG, spiritAvatarSVG, stoneIconSVG } from "./art";
import { prefersReducedMotion } from "../../engine/view25d";
import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { save } from "../../engine/save";
import { speak, stopSpeaking } from "../speech";
import guideBook from "./guide";

/** 188 关的章节 = 残局的 9 个主题（大小之和正好 188） */
export const CHAPTERS: Chapter[] = THEMES.map((th, t) => ({
  name: th.name,
  emoji: th.icon,
  color: th.tint,
  desc: th.blurb,
  size: PUZZLES.filter((p) => p.theme === t).length,
}));

/** 各档 AI 在禁手规则下「指出黑棋三三/四四」的概率：越强的越不会放过 */
export const CLAIM_RATE: Record<Difficulty, number> = {
  novice: 0,
  easy: 0.2,
  normal: 0.5,
  smart: 0.8,
  master: 1,
  hell: 1,
};

/** 解局里白棋用哪一档防守：够强才逼得出真解 */
const PUZZLE_DEFENDER: Difficulty = "smart";

function storageOrNull(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** 现在这台机器默认要不要「点两次才落子」 */
function confirmDefault(cellPx: number): boolean {
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
  return prefersConfirm({ coarsePointer: coarse, maxTouchPoints: g.navigator?.maxTouchPoints, cellPx });
}

/* ---------------------------------------------------------------------------
 * 一张棋桌：自由对战 / 连胜 / 解局共用
 * ------------------------------------------------------------------------- */

export type EndReason = "five" | "moves" | "full" | "claim" | "overline";

export interface TableResult {
  winner: Player | 0;
  reason: EndReason;
}

interface TableOpts {
  api: GameApi;
  board: Board;
  size: number;
  /** 人拿哪一方；"both" 是双人同屏 */
  human: Player | "both";
  ai: Difficulty | null;
  forbidden: boolean;
  hints: HintState;
  /** 解局：黑棋最多还能走几步 */
  movesLeft?: number;
  puzzle?: PuzzleDef;
  headline: string;
  opening: string;
  onEnd: (r: TableResult) => void;
  /** 用掉一次提示（解局据此扣掉三星） */
  onHint?: () => void;
  /** 额外按钮：重摆 / 返回 */
  extras?: Array<{ cls: string; label: string; onClick: () => void }>;
}

interface Table {
  destroy: () => void;
}

/** 座位条计时的显示格式：m:ss */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 座位条上黑白双方叫什么（黑先白后） */
export function seatNames(o: Pick<TableOpts, "human" | "ai" | "puzzle">): [string, string] {
  if (o.human === "both") return ["朵朵 · 黑棋", "星星 · 白棋"];
  if (o.puzzle) return ["你 · 黑棋", "守方 · 白棋"];
  const aiName = o.ai ? DIFFICULTY_NAME[o.ai] : "白棋";
  return o.human === 2 ? [aiName, "你 · 白棋"] : ["你 · 黑棋", aiName];
}

/** 胜利结算仪式弹卡前要等的毫秒数：光带扫完 + 五连子逐颗跳完再亮相 */
export const CEREMONY_DELAY_MS = WIN_SWEEP_MS + WIN_JUMP_GAP_MS * 4 + WIN_JUMP_MS + 80;

function mountTable(host: HTMLElement, o: TableOpts): Table {
  const wrap = document.createElement("div");
  wrap.className = "gmk-wrap";
  const top = document.createElement("div");
  top.className = "gmk-top";
  const turnEl = document.createElement("span");
  turnEl.className = "gmk-badge gmk-turn";
  const modeEl = document.createElement("span");
  modeEl.className = "gmk-badge gmk-modelabel";
  modeEl.textContent = o.headline;
  top.append(turnEl, modeEl);
  wrap.appendChild(top);
  // 座位条：黑白双方各一枚棋子小图标 + 名字 + 计时，轮到谁谁金色描边
  const names = seatNames(o);
  const seats = document.createElement("div");
  seats.className = "gmk-seats";
  const seatEls: Array<{ box: HTMLElement; time: HTMLElement }> = [];
  // AI 落座的那一侧加一枚画制棋灵头像,名字里的 emoji 前缀改由头像承担(round2 N-01)
  const aiSeat = o.ai && !o.puzzle ? (o.human === 2 ? 1 : 2) : 0;
  for (const p of [1, 2] as const) {
    const box = document.createElement("div");
    box.className = "gmk-seat";
    const ico = document.createElement("span");
    ico.className = "gmk-seat-ico";
    ico.innerHTML = stoneIconSVG(p, 22);
    const name = document.createElement("span");
    name.className = "gmk-seat-name";
    name.textContent = names[p - 1];
    const time = document.createElement("span");
    time.className = "gmk-seat-time";
    time.textContent = fmtClock(0);
    if (p === aiSeat && o.ai) {
      const spirit = document.createElement("span");
      spirit.className = "gmk-seat-spirit";
      spirit.setAttribute("aria-hidden", "true");
      spirit.innerHTML = spiritAvatarSVG(o.ai, 20);
      name.textContent = names[p - 1].replace(/^\S+\s+/, "");
      box.append(ico, spirit, name, time);
    } else {
      box.append(ico, name, time);
    }
    seats.appendChild(box);
    seatEls.push({ box, time });
  }
  wrap.appendChild(seats);
  const boardHost = document.createElement("div");
  boardHost.className = "gmk-boardbox";
  wrap.appendChild(boardHost);
  // AI 思考时棋盘右上角的小沙漏（DOM 元素，reduced 下静止）
  const sand = document.createElement("div");
  sand.className = "gmk-sand";
  sand.hidden = true;
  sand.setAttribute("aria-hidden", "true");
  sand.innerHTML = hourglassSVG(20);
  boardHost.appendChild(sand);
  const btns = document.createElement("div");
  btns.className = "gmk-btns";
  wrap.appendChild(btns);
  const claimBar = document.createElement("div");
  claimBar.className = "gmk-claimbar";
  claimBar.hidden = true;
  wrap.appendChild(claimBar);
  const msgEl = document.createElement("div");
  msgEl.className = "gmk-msg";
  msgEl.textContent = o.opening;
  wrap.appendChild(msgEl);
  host.appendChild(wrap);

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "gmk-undo";
  undoBtn.textContent = "↩️ 悔棋";
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "gmk-hint";
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "gmk-confirm gmk-undo";
  btns.append(undoBtn, hintBtn, confirmBtn);
  for (const ex of o.extras ?? []) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = ex.cls;
    b.textContent = ex.label;
    b.addEventListener("click", ex.onClick);
    btns.appendChild(b);
  }

  const claimBtn = document.createElement("button");
  claimBtn.type = "button";
  claimBtn.className = "gmk-claim";
  const claimTip = document.createElement("span");
  claimTip.className = "gmk-claimtip";
  const passBtn = document.createElement("button");
  passBtn.type = "button";
  passBtn.className = "gmk-claim gmk-undo";
  passBtn.textContent = "不指出，继续下";
  claimBar.append(claimTip, claimBtn, passBtn);

  const board = o.board;
  let current: Player = 1;
  let hints = o.hints;
  const playKind: PlayKind = o.puzzle ? "puzzle" : "free";
  let confirmState: ConfirmState = emptyConfirm();
  let confirmOn = false;
  let history: Array<{ x: number; y: number; p: Player }> = [];
  let over = false;
  let thinking = false;
  let movesLeft = o.movesLeft ?? Number.POSITIVE_INFINITY;
  let claim: ClaimState | null = null;
  let claimTimer = 0;
  let aiTimer = 0;
  let ceremonyTimer = 0;
  let destroyed = false;

  // 双方用时（秒）：只在对局进行中给「当前轮到的一方」走表
  const clockSec: [number, number] = [0, 0];
  const clockTimer = window.setInterval(() => {
    if (destroyed || over || claim) return;
    clockSec[current - 1] += 1;
    seatEls[current - 1].time.textContent = fmtClock(clockSec[current - 1]);
  }, 1000);

  const view: BoardView = createBoardView(boardHost, {
    size: o.size,
    onTap: (cell) => onTap(cell),
  });
  view.update({ board, size: o.size, turn: 1, interactive: true });
  confirmOn = confirmDefault(view.cellPx());

  function humansTurn(): boolean {
    if (over || thinking || claim) return false;
    if (o.human === "both") return true;
    return current === o.human;
  }

  function tierLabel(): string {
    return o.ai ? DIFFICULTY_NAME[o.ai] : "👫 朵朵 VS 星星";
  }

  function refresh(): void {
    if (destroyed) return;
    if (over) {
      turnEl.textContent = "对局结束";
    } else if (claim) {
      turnEl.textContent = `⚖️ 白棋还有 ${claimSecondsLeft(claim, Date.now())} 秒可以指出禁手`;
    } else if (thinking) {
      turnEl.textContent = `${tierLabel()} 思考中…`;
    } else if (o.puzzle) {
      turnEl.textContent = current === 1 ? `⚫ 还可以走 ${movesLeft} 步` : "⚪ 白棋防守中…";
    } else if (o.human === "both") {
      turnEl.textContent = current === 1 ? "⚫ 该朵朵（黑棋）啦" : "⚪ 该星星（白棋）啦";
    } else {
      turnEl.textContent = current === 1 ? "⚫ 该黑棋啦" : "⚪ 该白棋啦";
    }
    turnEl.className = `gmk-badge gmk-turn${thinking && !over ? " gmk-think" : ""}`;
    seatEls[0].box.className = `gmk-seat${!over && current === 1 ? " gmk-seat-on" : ""}`;
    seatEls[1].box.className = `gmk-seat${!over && current === 2 ? " gmk-seat-on" : ""}`;
    sand.hidden = !thinking || over;
    undoBtn.disabled = history.length === 0 || over || thinking || claim !== null;
    hintBtn.textContent = `✨ 提示×${hints.left}`;
    hintBtn.disabled = hints.left <= 0 || !humansTurn();
    // 解局用提示要掉一颗星,这个代价点下去之前就得说清楚
    hintBtn.title = hintButtonHint(hints, playKind);
    hintBtn.setAttribute("aria-label", `${hintBtn.textContent}。${hintBtn.title}`);
    confirmBtn.textContent = confirmOn ? "✋ 确认落子：开" : "✋ 确认落子：关";
    // 预览点落空了（对手占了 / 悔棋把盘面改了）就在这里摘掉,
    // 免得状态层还指着一格已经有子的位置——视图层本来就不画它了
    confirmState = pruneConfirm(confirmState, (c) => board.cells[c.y * o.size + c.x] === 0);
    view.update({
      turn: current,
      interactive: humansTurn(),
      pending: confirmState.pending,
      confirm: confirmOn,
    });
  }

  function finish(winner: Player | 0, reason: EndReason): void {
    if (over) return;
    over = true;
    thinking = false;
    closeClaim();
    view.update({ interactive: false, pending: null });
    refresh();
    if (winner !== 0 && reason === "five") scheduleCeremony(winner);
    o.onEnd({ winner, reason });
  }

  /**
   * 胜利结算仪式：等胜利线扫光 + 五连子逐颗跳完，再弹结算卡
   * （胜方棋子大图 + 手数用时 + 复盘按钮，只展示不改任何对局数据）。
   * 连胜挑战那类自己会弹结算浮层的模式，检测到已有浮层就不再叠加。
   */
  function scheduleCeremony(winner: Player): void {
    const delay = prefersReducedMotion() ? 300 : CEREMONY_DELAY_MS;
    ceremonyTimer = window.setTimeout(() => {
      if (destroyed || host.querySelector?.(".gmk-over")) return;
      const ov = document.createElement("div");
      ov.className = "gmk-over gmk-ceremony";
      const img = document.createElement("span");
      img.className = "gmk-over-stoneimg";
      img.innerHTML = stoneIconSVG(winner, 72);
      const title = document.createElement("div");
      title.className = "gmk-over-title";
      title.textContent = `${names[winner - 1]}连成五颗！`;
      const sub = document.createElement("div");
      sub.className = "gmk-over-sub";
      sub.textContent = `本局共 ${history.length} 手 · 黑方用时 ${fmtClock(clockSec[0])} · 白方用时 ${fmtClock(clockSec[1])}`;
      const replay = document.createElement("button");
      replay.type = "button";
      replay.className = "gmk-over-btn";
      replay.textContent = "🔍 复盘棋盘";
      replay.addEventListener("click", () => {
        o.api.play("tap");
        ov.remove();
      });
      ov.append(img, title, sub, replay);
      wrap.appendChild(ov);
    }, delay);
  }

  // ---------------- 禁手申告 ----------------

  function closeClaim(): void {
    claim = null;
    claimBar.hidden = true;
    if (claimTimer) {
      clearInterval(claimTimer);
      claimTimer = 0;
    }
  }

  function resolveClaim(): void {
    if (!claim) return;
    const pressed = pressClaim(claim, Date.now());
    if (pressed.status !== "claimed") {
      closeClaim();
      return;
    }
    const r = claimResult(pressed);
    closeClaim();
    msgEl.textContent = r.text;
    o.api.play("oops");
    finish(2, "claim");
  }

  function skipClaim(): void {
    if (!claim) return;
    const kind = claim.kind;
    closeClaim();
    msgEl.textContent = `白棋放过了这一手${FORBIDDEN_NAME[kind]}，接着下！`;
    afterMoveContinue();
  }

  function openClaimWindow(kind: ClaimState["kind"], x: number, y: number): void {
    claim = openClaim(kind, x, y, Date.now());
    claimBar.hidden = false;
    claimBtn.textContent = `⚖️ 指出${FORBIDDEN_NAME[kind]}禁手`;
    view.update({ forbidden: { x, y } });
    msgEl.textContent = `黑棋这一手是${FORBIDDEN_NAME[kind]}，白棋有 8 秒可以指出来。`;
    o.api.play("meow");
    const aiWhite = o.ai !== null && o.human === 1;
    if (aiWhite) {
      // AI 白棋：越强越不会放过，而且要「想一下」再按，不能瞬间弹结算
      const rate = CLAIM_RATE[o.ai as Difficulty];
      const willClaim = Math.random() < rate;
      claimTimer = window.setInterval(() => {
        if (!claim) return;
        const left = claimSecondsLeft(claim, Date.now());
        claimTip.textContent = `还剩 ${left} 秒`;
        refresh();
        if (left <= 5 && willClaim) {
          resolveClaim();
          return;
        }
        if (tickClaim(claim, Date.now()).status === "expired") skipClaim();
      }, 400);
      claimBtn.disabled = true;
      passBtn.disabled = true;
      return;
    }
    claimBtn.disabled = false;
    passBtn.disabled = false;
    claimTimer = window.setInterval(() => {
      if (!claim) return;
      const left = claimSecondsLeft(claim, Date.now());
      claimTip.textContent = `还剩 ${left} 秒`;
      refresh();
      if (tickClaim(claim, Date.now()).status === "expired") skipClaim();
    }, 300);
    claimTip.textContent = `还剩 ${Math.round(CLAIM_WINDOW_MS / 1000)} 秒`;
  }

  // ---------------- 落子 ----------------

  function onTap(cell: Cell): void {
    const occupied = board.cells[cell.y * o.size + cell.x] !== 0;
    const r = tapCell(confirmState, cell, { confirm: confirmOn, myTurn: humansTurn(), occupied });
    confirmState = r.state;
    if (r.kind === "preview" || r.kind === "move") {
      o.api.play("tap");
      msgEl.textContent = "再点一次粉圈就落子，点别处可以换地方～";
      refresh();
      return;
    }
    if (r.kind !== "commit" || !r.cell) {
      refresh();
      return;
    }
    msgEl.textContent = "";
    play(r.cell.x, r.cell.y);
  }

  function play(x: number, y: number): void {
    const p = current;
    const verdict = judgeMove(board, x, y, p, { forbidden: o.forbidden });
    setCell(board, x, y, p);
    history.push({ x, y, p });
    view.drop(x, y);
    view.update({ lastMove: { x, y }, hint: null, pending: null });
    confirmState = emptyConfirm();
    o.api.play(p === 1 ? "tap" : "pop");

    if (verdict.win) {
      const line = findWinLine(board, x, y);
      view.update({ winLine: line });
      view.sweep();
      // 谜题模式：制胜点开一朵金色小花
      if (o.puzzle && p === 1) view.bloom(x, y);
      o.api.play("win");
      msgEl.textContent = verdict.text;
      finish(p, "five");
      return;
    }
    if (verdict.instantLoss) {
      msgEl.textContent = verdict.text;
      view.update({ forbidden: { x, y } });
      o.api.play("oops");
      finish(other(p), "overline");
      return;
    }
    if (verdict.claimable) {
      openClaimWindow(verdict.kind, x, y);
      refresh();
      return;
    }
    afterMoveContinue();
  }

  /** 一手棋（含放过禁手）之后：换人、判平局、排 AI */
  function afterMoveContinue(): void {
    if (over || destroyed) return;
    if (o.puzzle) {
      if (current === 1) {
        movesLeft--;
        if (movesLeft <= 0) {
          finish(2, "moves");
          return;
        }
        current = 2;
        refresh();
        scheduleAi(PUZZLE_DEFENDER);
        return;
      }
      current = 1;
      refresh();
      return;
    }
    if (boardFull(board)) {
      finish(0, "full");
      return;
    }
    current = other(current);
    refresh();
    if (o.ai && o.human !== "both" && current !== o.human) scheduleAi(o.ai);
  }

  function scheduleAi(level: Difficulty): void {
    thinking = true;
    refresh();
    clearTimeout(aiTimer);
    // 地狱档也要「看起来在想」：THINK_DELAY_MS 兜住最短思考时间
    aiTimer = window.setTimeout(() => {
      if (destroyed || over) return;
      const mv = bestMove(board, current, level, Math.random, { forbidden: o.forbidden });
      thinking = false;
      if (!mv) {
        finish(0, "full");
        return;
      }
      play(mv.x, mv.y);
    }, THINK_DELAY_MS[level]);
  }

  // ---------------- 提示 / 悔棋 ----------------

  function useHint(): void {
    if (!humansTurn()) return;
    const spent = spendHint(hints);
    if (!spent.ok) return;
    const asker: Player = o.human === "both" ? current : (o.human as Player);
    const mv = o.puzzle
      ? bestMove(board, asker, "master", () => 0, { forbidden: o.forbidden })
      : bestMove(board, asker, "smart", () => 0, { forbidden: o.forbidden });
    if (!mv) return;
    hints = spent.state;
    o.onHint?.();
    const area = hintArea(mv, o.size);
    view.update({ hint: area });
    o.api.play("coin");
    msgEl.textContent = hintSpentLine(area, hints, playKind);
    refresh();
  }

  function undo(): void {
    if (history.length === 0 || over || thinking || claim) return;
    const steps = o.human === "both" ? 1 : Math.min(2, history.length);
    for (let i = 0; i < steps; i++) {
      const mv = history.pop();
      if (!mv) break;
      setCell(board, mv.x, mv.y, 0);
      if (o.puzzle && mv.p === 1) movesLeft = Math.min(o.puzzle.moves, movesLeft + 1);
    }
    current = o.human === "both" ? (history.length % 2 === 0 ? 1 : 2) : ((o.human as Player) ?? 1);
    const last = history[history.length - 1];
    view.update({ lastMove: last ? { x: last.x, y: last.y } : null, hint: null, forbidden: null, winLine: null });
    confirmState = emptyConfirm();
    o.api.play("pop");
    msgEl.textContent = "悔棋成功，再想一想～";
    refresh();
  }

  undoBtn.addEventListener("click", undo);
  hintBtn.addEventListener("click", useHint);
  confirmBtn.addEventListener("click", () => {
    confirmOn = !confirmOn;
    confirmState = emptyConfirm();
    o.api.play("tap");
    msgEl.textContent = confirmOn
      ? "确认落子开着：点一下先预览，再点一次才真的落子。"
      : "确认落子关掉了：点哪儿就落哪儿。";
    refresh();
  });
  claimBtn.addEventListener("click", resolveClaim);
  passBtn.addEventListener("click", skipClaim);

  refresh();
  // 解局都是黑棋先走；自由对战里人执白就让 AI 先手
  if (o.ai && o.human === 2) scheduleAi(o.ai);

  return {
    destroy() {
      destroyed = true;
      clearTimeout(aiTimer);
      clearTimeout(ceremonyTimer);
      clearInterval(clockTimer);
      closeClaim();
      view.destroy();
      wrap.remove();
    },
  };
}

/* ---------------------------------------------------------------------------
 * 解局学堂 188：走框架
 * ------------------------------------------------------------------------- */

/** 一道题的题面（解法分类 + 限步），不剧透正解坐标 */
export function puzzleHeadline(p: PuzzleDef, level: number): string {
  return `${THEMES[p.theme].icon} 第 ${level + 1} 题 · ${SOLUTION_KIND_NAME[puzzleKind(p)]}`;
}

function playLevel(host: HTMLElement, ctx: PlayCtx): PlayHandle {
  const p = PUZZLES[Math.max(0, Math.min(PUZZLES.length - 1, ctx.level))];
  let table: Table | null = null;
  let hintUsed = false;
  let dead = false;
  let retryTimer = 0;

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
    table = mountTable(host, {
      api,
      board: puzzleBoard(p),
      size: p.size,
      human: 1,
      ai: null,
      forbidden: false,
      hints: newHints("puzzle"),
      movesLeft: p.moves,
      puzzle: p,
      onHint: () => {
        hintUsed = true;
      },
      headline: puzzleHeadline(p, ctx.level),
      opening: `${p.tip}（${p.moves} 步内连成五，提示只有 1 次）`,
      extras: [
        {
          cls: "gmk-retry",
          label: "🔄 重摆",
          onClick: () => {
            if (dead) return;
            ctx.sfx("tap");
            stopSpeaking();
            hintUsed = false;
            start();
          },
        },
      ],
      onEnd: (r) => {
        if (dead) return;
        if (r.winner === 1) {
          const got = puzzleStars(hintUsed);
          speak(puzzleSolvedSpeechLine(hintUsed));
          retryTimer = window.setTimeout(() => {
            if (dead) return;
            ctx.win(
              got,
              hintUsed
                ? "解开啦！下次不用提示就能拿 3 星。"
                : `不用提示就解开——这是一道${SOLUTION_KIND_NAME[puzzleKind(p)]}。`
            );
          }, 900);
        } else {
          const opening = bestMove(puzzleBoard(p), 1, "smart", () => 0);
          speak(puzzleFailSpeechLine(opening));
          retryTimer = window.setTimeout(() => {
            if (dead) return;
            ctx.lose("步数用完啦～先想清楚每一步逼白棋挡在哪，再动手，点「再试本关」重来。");
          }, 900);
        }
      },
    });
  }

  start();
  return {
    destroy() {
      dead = true;
      clearTimeout(retryTimer);
      table?.destroy();
      table = null;
    },
  };
}

/** 在已经挂好的 188 关地图上，替玩家点开第 N 关（锁着就停在能玩的最远那一关） */
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

/* ---------------------------------------------------------------------------
 * 自由对战 & 连胜挑战
 * ------------------------------------------------------------------------- */

function segment(
  host: HTMLElement,
  label: string,
  items: Array<{ v: string; text: string }>,
  initial: string,
  onPick: (v: string) => void
): HTMLElement {
  const box = document.createElement("div");
  const cap = document.createElement("div");
  cap.className = "gmk-label";
  cap.textContent = label;
  const seg = document.createElement("div");
  seg.className = "gmk-seg";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = it.v === initial ? "gmk-on" : "";
    b.textContent = it.text;
    b.setAttribute("data-v", it.v);
    b.addEventListener("click", () => {
      for (const other2 of Array.from(seg.children)) (other2 as HTMLElement).className = "";
      b.className = "gmk-on";
      onPick(it.v);
    });
    seg.appendChild(b);
  }
  box.append(cap, seg);
  host.appendChild(box);
  return seg;
}

function mountFree(
  host: HTMLElement,
  api: GameApi,
  back: () => void,
  startTier: Difficulty = "normal"
): { destroy: () => void } {
  const root = document.createElement("div");
  root.className = "gmk-wrap";
  host.appendChild(root);
  let table: Table | null = null;
  let panel: HTMLElement | null = null;

  let size = 15;
  let tier: Difficulty | "pvp" = startTier;
  let forbidden = false;

  function showSetup(): void {
    table?.destroy();
    table = null;
    root.innerHTML = "";
    panel = document.createElement("div");
    panel.className = "gmk-panel";
    root.appendChild(panel);

    segment(
      panel,
      "🎯 棋盘大小",
      [
        { v: "9", text: "9×9 入门" },
        { v: "15", text: "15×15 标准" },
      ],
      String(size),
      (v) => {
        size = Number(v);
        api.play("tap");
      }
    );

    const blurb = document.createElement("div");
    blurb.className = "gmk-tierblurb";
    blurb.textContent = DIFFICULTY_BLURB[tier === "pvp" ? "normal" : tier];
    segment(
      panel,
      "🤝 和谁下（六档，从菜鸟到地狱）",
      [
        ...DIFFICULTIES.map((d) => ({ v: d, text: DIFFICULTY_NAME[d] })),
        { v: "pvp", text: "👫 朵朵 VS 星星" },
      ],
      tier,
      (v) => {
        tier = v as Difficulty | "pvp";
        blurb.textContent =
          v === "pvp" ? "两个人轮流点棋盘，黑棋先下，谁先连成五颗谁赢。" : DIFFICULTY_BLURB[v as Difficulty];
        api.play("tap");
      }
    );
    panel.appendChild(blurb);

    segment(
      panel,
      "🚫 禁手规则（只约束黑棋，可开关）",
      [
        { v: "off", text: "关（推荐）" },
        { v: "on", text: "开 · 白棋能指出禁手" },
      ],
      forbidden ? "on" : "off",
      (v) => {
        forbidden = v === "on";
        api.play("tap");
      }
    );

    const go = document.createElement("button");
    go.type = "button";
    go.className = "gmk-start";
    go.textContent = "开始下棋 ▶";
    go.addEventListener("click", () => {
      api.play("jump");
      startGame();
    });
    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "gmk-start";
    leave.style.background = "#FFE0C2";
    leave.style.color = "#9A5A20";
    leave.style.boxShadow = "0 5px 0 #E0B98C";
    leave.textContent = "🧩 回解局学堂";
    leave.addEventListener("click", back);
    panel.append(go, leave);
  }

  function startGame(): void {
    root.innerHTML = "";
    panel = null;
    const ai = tier === "pvp" ? null : tier;
    table = mountTable(root, {
      api,
      board: makeBoard(size),
      size,
      human: tier === "pvp" ? "both" : 1,
      ai,
      forbidden,
      hints: newHints("free"),
      headline: ai ? DIFFICULTY_NAME[ai] : "👫 朵朵 VS 星星",
      opening: ai
        ? `你执黑棋先下。${DIFFICULTY_BLURB[ai]}。提示每局 3 次，只圈一片区域哦。`
        : "🌸 朵朵执黑先下，⭐ 星星执白，轮流点棋盘落子！",
      extras: [{ cls: "gmk-back", label: "🔧 换玩法", onClick: () => showSetup() }],
      onEnd: (r) => {
        const win = r.winner;
        if (win === 0) {
          api.onWin(1, boardFullLine(size, ai));
        } else if (!ai) {
          api.onWin(
            1,
            r.reason === "claim"
              ? "⚪ 星星指出了黑棋的禁手，这一局星星赢！"
              : r.reason === "overline"
                ? "⚫ 黑棋连成了六颗，长连禁手，这一局星星赢！"
                : win === 1
                  ? "⚫ 朵朵连成五颗，赢啦！"
                  : "⚪ 星星连成五颗，赢啦！"
          );
        } else if (win === 1) {
          const stars: 1 | 2 | 3 = ai === "novice" || ai === "easy" ? 2 : 3;
          api.onWin(stars, `你把${TIER_SHORT[ai]}档的棋灵赢下来了！再往上挑一档试试。`);
        } else {
          api.onLose(
            r.reason === "claim"
              ? "白棋指出了你的禁手～开着禁手时，黑棋别一手同时做两个三。"
              : `${TIER_SHORT[ai]}档这局占了先手。先守住它的活三，再找自己的双威胁。`
          );
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

/**
 * 满盘和棋的结算话术（纯函数，便于测试）。
 *
 * 15 路自由对战里两档旗鼓相当时，和棋是很常见的收场（相邻档实测能到四成以上）：
 * 两边都会「必成五、必挡五」，谁都逼不出双威胁，就一路下满 225 手。
 * 原来只有「棋盘下满了，握手言和！」一句，孩子听完不知道下一步该改什么，
 * 于是这里按棋盘大小给一条真能改变结果的建议。
 */
export function boardFullLine(size: number, ai: Difficulty | null): string {
  const head = `${size} 路棋盘下满了，握手言和！`;
  if (!ai) return `${head}两边都守得很紧，谁都没让对方连成五颗。`;
  return (
    head +
    (size >= 15
      ? "两边都会挡活四，15 路又特别宽，很容易下成和棋。想分个胜负，可以换 9×9 入门盘，格子少一点，五颗更快连得上。"
      : "两边都守住了对方的活三。下一盘先做双威胁：一手棋同时开两个活三，对手只挡得住一边。")
  );
}

/** 连胜挑战的结算话术（纯函数，便于测试） */
export function streakSummary(s: StreakState, best: number): string {
  if (s.wins <= 0) return `第一盘就没拿下，再来一次！历史最高连胜 ${best} 盘。`;
  if (s.wins >= best) return `连赢 ${s.wins} 盘，刷新纪录！下一次目标 ${s.wins + 1} 盘。`;
  return `连赢 ${s.wins} 盘，离最高纪录 ${best} 盘还差 ${best - s.wins} 盘。`;
}

function mountStreak(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const root = document.createElement("div");
  root.className = "gmk-wrap";
  host.appendChild(root);
  let table: Table | null = null;
  let streak: StreakState = newStreak(save.getGameProgress(meta.id).endlessBest);
  let nextTimer = 0;
  let dead = false;

  function overPanel(title: string, sub: string, label: string, onClick: () => void): void {
    const ov = document.createElement("div");
    ov.className = "gmk-over";
    const t = document.createElement("div");
    t.className = "gmk-over-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "gmk-over-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gmk-over-btn";
    b.textContent = label;
    b.addEventListener("click", () => {
      ov.remove();
      onClick();
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "gmk-over-btn";
    home.style.background = "linear-gradient(180deg,#5470C0,#4560AB)";
    home.style.boxShadow = "0 4px 0 #34498A";
    home.textContent = "🧩 回解局学堂";
    home.addEventListener("click", back);
    ov.append(t, s, b, home);
    root.appendChild(ov);
  }

  function startRound(): void {
    table?.destroy();
    root.innerHTML = "";
    const tier = streakDifficulty(streak.wins);
    table = mountTable(root, {
      api,
      board: makeBoard(15),
      size: 15,
      human: 1,
      ai: tier,
      forbidden: false,
      hints: newHints("free"),
      headline: `🔥 连胜 ${streak.wins} · ${DIFFICULTY_NAME[tier]}`,
      // 这一档什么脾气,整局都看得见——不再只在上一盘的结算浮层上闪一次
      opening: streakOpening(streak, DIFFICULTY_BLURB[tier]),
      extras: [{ cls: "gmk-back", label: "🧩 回解局学堂", onClick: back }],
      onEnd: (r) => {
        if (dead) return;
        const outcome = r.winner === 1 ? "win" : r.winner === 0 ? "draw" : "loss";
        const prevBest = streak.best;
        streak = streakStep(streak, outcome);
        if (!streak.over) {
          const nextTier = streakDifficulty(streak.wins);
          api.addStars(1);
          overPanel(
            streakWinTitle(prevBest, streak),
            `下一位是${DIFFICULTY_NAME[nextTier]}。${DIFFICULTY_BLURB[nextTier]}。`,
            "继续挑战 ▶",
            () => {
              api.play("jump");
              startRound();
            }
          );
          return;
        }
        const best = save.recordEndlessBest(meta.id, streak.wins);
        overPanel("🔥 连胜结束", streakSummary(streak, best), "🔁 从菜鸟再来", () => {
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
      clearTimeout(nextTimer);
      table?.destroy();
      table = null;
      root.remove();
    },
  };
}

/* ---------------------------------------------------------------------------
 * 挂载
 * ------------------------------------------------------------------------- */

export function mount(api: GameApi): { destroy: () => void } {
  // 老玩家的自建战役存档只读这一次，搬进框架的 l99 存档后旧 key 就删掉
  migrateLegacyCampaign(storageOrNull(), meta.id);

  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "gmk-modebar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const freeBtn = document.createElement("button");
  freeBtn.type = "button";
  freeBtn.className = "gmk-mode";
  freeBtn.textContent = "♟️ 自由对战 · 六档 + 双人";
  const streakBtn = document.createElement("button");
  streakBtn.type = "button";
  streakBtn.className = "gmk-mode gmk-mode-streak";
  bar.append(freeBtn, streakBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const b = save.getGameProgress(meta.id).endlessBest;
    streakBtn.textContent = b > 0 ? `🔥 连胜挑战 · 最好 ${b} 盘` : "🔥 连胜挑战 · 从菜鸟打起";
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

  // 壳层给了关号（initialLevel / 地址栏 / hash）就照它派活：解局直开第 N 题，
  // 自由对战按同一个关号映射出对手档位——关号越大对手越强。
  const hint = (api as unknown as { initialLevel?: number }).initialLevel;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  const want = initialLevelOf(hint, loc?.search ?? "", loc?.hash ?? "");
  // 没给关号就沿用 1.1 的默认档（普通），别把新玩家直接扔给菜鸟或地狱
  const freeTier: Difficulty = want < 0 ? "normal" : difficultyForLevel(want);

  freeBtn.addEventListener("click", () => openMode((h, a, b) => mountFree(h, a, b, freeTier)));
  streakBtn.addEventListener("click", () => openMode(mountStreak));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "每题都在限定步数内必胜，不用提示解开才是 3 星～",
      grandMessage: "188 道残局全部解开，你的算杀已经很有大师样子了！",
      guide: guideBook,
      guideTitle: "五子棋 · 解局手记",
    }
  );

  if (want >= 0) openCampaignLevel(levelHost, want);

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      stopSpeaking();
      root.remove();
    },
  };
}

/** 给壳层用：直接开打第 n 题（1 基），越界 clamp */
export function openLevel(host: HTMLElement, n: number): boolean {
  return openCampaignLevel(host, Math.max(0, Math.round(n) - 1));
}
