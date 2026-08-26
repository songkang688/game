import { meta } from "./meta";
export { meta };

// 花园国际象棋:一整套 FIDE 关键规则都自己写,没有引擎、没有走法库、没有 wasm。
//
// 四种玩法共用同一张棋盘 `createTable`:
//  - 闯关 188:八章,从「兵怎么走」一路教到易位、吃过路兵、升变、将杀和完整对局;
//  - 人机对战:四档搜索,地狱档是迭代加深 + alpha-beta + 置换表;
//  - 无尽:连胜挑战,对手逐场加深,记最高连胜;
//  - 双人同屏:朵朵执白、星星执黑,可以把棋盘翻过来。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { parseFen, squareName, startPosition, zobrist, type Color, type Position } from "./board";
import guide from "./guide";
import { CHAPTERS, endlessPlan, goalText, planFor, positionFor, rateLevel, type Goal, type LevelPlan } from "./levels";
import { legalMoves, makeMove, status, toSan, type Move } from "./rules";
import { TIERS, TIER_LABELS, chooseMove, type Tier } from "./search";
import { CSS as BOARD_CSS, createBoard, type BoardHandle } from "./view";

const SHELL_CSS = `
.cg-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FBF3E6,#F4EEF8);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.cg-menu{display:flex;flex-direction:column;gap:10px;align-items:center;padding:8px 4px 4px;}
.cg-title{font-size:19px;font-weight:900;color:#7a5f3e;text-align:center;}
.cg-sub{font-size:13px;font-weight:700;color:#7f684e;text-align:center;line-height:1.6;max-width:330px;}
.cg-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;width:100%;max-width:420px;}
.cg-mode{border:none;border-radius:16px;padding:14px 10px;font-size:16px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#c39a63,#a8804c);box-shadow:0 4px 0 #8a6839;}
.cg-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #8a6839;}
.cg-mode.cg-b{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a;}
.cg-mode.cg-c{background:linear-gradient(180deg,#4fa77c,#3d8c66);box-shadow:0 4px 0 #2e6d4f;}
.cg-mode.cg-d{background:linear-gradient(180deg,#a765c0,#8d51a5);box-shadow:0 4px 0 #6f3f83;}
.cg-tip{font-size:12px;font-weight:700;color:#93795a;text-align:center;line-height:1.6;max-width:330px;}
.cg-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px;}
.cg-pick{border:none;border-radius:14px;min-height:44px;padding:8px 13px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#6b5540;box-shadow:0 3px 0 rgba(150,125,95,.3);}
.cg-pick[aria-pressed="true"]{background:linear-gradient(180deg,#c39a63,#a8804c);color:#fff;}
`;

const AI_DELAY_MS = 420;

export interface TableResult {
  /** 白方（朵朵）赢了没有 */
  won: boolean;
  draw: boolean;
  plies: number;
  why: string;
}

export interface TableOptions {
  start: Position;
  goal: Goal;
  /** 黑方是电脑还是第二个人 */
  rival: "ai" | "human";
  tier: Tier;
  showHints: boolean;
  label: string;
  budget: number;
  onEnd: (r: TableResult) => void;
}

/** 一张能真正下完的棋盘 */
export function createTable(host: HTMLElement, opts: TableOptions): { destroy: () => void } {
  let pos = opts.start;
  const history: number[] = [zobrist(pos)];
  const sanLog: string[] = [];
  let plies = 0;
  let captures = 0;
  let castled = false;
  let promoted = false;
  let tookEnPassant = false;

  const wrap = document.createElement("div");
  wrap.className = "cg-wrap";
  host.appendChild(wrap);

  const top = document.createElement("div");
  top.className = "cg-top";
  const turnChip = document.createElement("span");
  turnChip.className = "cg-chip cg-turn";
  const goalChip = document.createElement("span");
  goalChip.className = "cg-chip";
  goalChip.textContent = goalText({ goal: opts.goal } as LevelPlan);
  const labelChip = document.createElement("span");
  labelChip.className = "cg-chip";
  labelChip.textContent = opts.label;
  top.append(turnChip, goalChip, labelChip);
  wrap.appendChild(top);

  const boardHost = document.createElement("div");
  wrap.appendChild(boardHost);

  const note = document.createElement("div");
  note.className = "cg-note";
  wrap.appendChild(note);

  const log = document.createElement("div");
  log.className = "cg-log";
  wrap.appendChild(log);

  const row = document.createElement("div");
  row.className = "cg-row";
  const flipBtn = document.createElement("button");
  flipBtn.type = "button";
  flipBtn.className = "cg-btn";
  flipBtn.textContent = "翻转棋盘";
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "cg-btn";
  pauseBtn.textContent = "暂停";
  row.append(flipBtn, pauseBtn);
  wrap.appendChild(row);

  let finished = false;
  let paused = false;
  let destroyed = false;
  let flipped = false;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let board: BoardHandle | null = null;

  function setNote(t: string): void {
    note.textContent = t;
  }

  function renderHud(): void {
    const who = pos.turn === "w" ? "朵朵（白）" : opts.rival === "ai" ? "小对手（黑）" : "星星（黑）";
    turnChip.textContent = paused ? "已暂停" : `轮到${who}`;
    turnChip.className = pos.turn === "w" ? "cg-chip cg-turn cg-hot" : "cg-chip cg-turn";
    log.textContent = sanLog.slice(-8).join("  ");
  }

  function goalMet(): boolean {
    switch (opts.goal.kind) {
      case "capture":
        return captures >= opts.goal.count;
      case "castle":
        return castled;
      case "promote":
        return promoted;
      case "enpassant":
        return tookEnPassant;
      case "mate":
      case "game":
        return status(pos, history).kind === "checkmate" && pos.turn === "b";
      case "draw":
        return status(pos, history).kind !== "playing" && status(pos, history).kind !== "checkmate";
      default:
        return false;
    }
  }

  function finish(won: boolean, draw: boolean, why: string): void {
    if (finished) return;
    finished = true;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    opts.onEnd({ won, draw, plies, why });
  }

  function checkEnd(): void {
    if (finished) return;
    if (goalMet()) {
      finish(true, false, "任务完成，漂亮！");
      return;
    }
    const st = status(pos, history);
    if (st.kind === "checkmate") {
      finish(st.winner === "w", false, st.winner === "w" ? "将杀！这一局是你的。" : "这一局对方先收官了，下一局早点让王回家。");
      return;
    }
    if (st.kind === "stalemate") {
      finish(false, true, "对方一步都走不了又没被将，这是逼和，算平局。");
      return;
    }
    if (st.kind === "draw") {
      const why =
        st.why === "fifty" ? "五十回合没吃子也没动兵，判和。" : st.why === "repetition" ? "同一个局面出现三次，判和。" : "子力不够将杀啦，判和。";
      finish(false, true, why);
      return;
    }
    if (plies >= opts.budget) {
      finish(false, true, "手数用完啦，这一关先算平局收场。");
    }
  }

  function play(m: Move): void {
    if (finished || paused) return;
    const before = pos;
    sanLog.push(`${Math.floor(plies / 2) + 1}${pos.turn === "w" ? "." : "…"}${toSan(before, m)}`);
    if (before.turn === "w") {
      if (m.capture) captures += 1;
      if (m.castle) castled = true;
      if (m.promo) promoted = true;
      if (m.ep) tookEnPassant = true;
    }
    pos = makeMove(before, m);
    history.push(zobrist(pos));
    plies += 1;
    board?.setLast(m);
    setNote(`${before.turn === "w" ? "朵朵" : "对手"}走了 ${squareName(m.from)} → ${squareName(m.to)}。`);
    renderHud();
    checkEnd();
    if (!finished) scheduleAi();
  }

  function scheduleAi(): void {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if (finished || destroyed || paused) return;
    if (opts.rival !== "ai" || pos.turn !== "b") return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (finished || destroyed) return;
      const m = chooseMove(pos, opts.tier, plies * 7 + 3);
      if (!m) {
        checkEnd();
        return;
      }
      play(m);
    }, AI_DELAY_MS);
  }

  const humans: Color[] = opts.rival === "human" ? ["w", "b"] : ["w"];
  board = createBoard(boardHost, {
    get: () => pos,
    humans,
    showHints: opts.showHints,
    flipped,
    onHumanMove: play,
    onNote: setNote,
  });

  const onFlip = (): void => {
    flipped = !flipped;
    board?.destroy();
    boardHost.innerHTML = "";
    board = createBoard(boardHost, {
      get: () => pos,
      humans,
      showHints: opts.showHints,
      flipped,
      onHumanMove: play,
      onNote: setNote,
    });
  };
  const onPause = (): void => {
    paused = !paused;
    pauseBtn.textContent = paused ? "继续" : "暂停";
    renderHud();
    if (!paused) scheduleAi();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() === "escape") {
      onPause();
      e.preventDefault();
    }
  };
  flipBtn.addEventListener("click", onFlip);
  pauseBtn.addEventListener("click", onPause);
  window.addEventListener("keydown", onKey);

  setNote(`轮到白方，${legalMoves(pos).length} 手可走。`);
  renderHud();
  checkEnd();
  if (!finished) scheduleAi();

  return {
    destroy() {
      destroyed = true;
      finished = true;
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = null;
      flipBtn.removeEventListener("click", onFlip);
      pauseBtn.removeEventListener("click", onPause);
      window.removeEventListener("keydown", onKey);
      board?.destroy();
      board = null;
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const plan = planFor(ctx.level);
  const handle = createTable(stage, {
    start: positionFor(ctx.level),
    goal: plan.goal,
    rival: "ai",
    tier: plan.tier,
    showHints: plan.showHints,
    label: `第 ${ctx.level + 1} 关 · ${plan.hint}`,
    budget: plan.budget,
    onEnd: ({ won, plies, why }) => {
      if (won) ctx.win(rateLevel(plies, plan.budget), why);
      else ctx.lose(why || "这一题差一点点，换个思路再来一次。");
    },
  });
  return { destroy: () => handle.destroy() };
}

export function mount(api: GameApi): { destroy: () => void } {
  let child: { destroy: () => void } | null = null;
  const wrap = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = `${BOARD_CSS}\n${SHELL_CSS}`;
  wrap.appendChild(style);
  const view = document.createElement("div");
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  let tier: Tier = "normal";

  function clear(): void {
    child?.destroy();
    child = null;
    view.innerHTML = "";
  }

  function backBar(label: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "cg-row";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "cg-btn";
    back.textContent = "◀ 换个玩法";
    back.addEventListener("click", () => {
      api.play("tap");
      showMenu();
    });
    const tag = document.createElement("span");
    tag.className = "cg-chip";
    tag.textContent = label;
    row.append(back, tag);
    return row;
  }

  function showMenu(): void {
    clear();
    const menu = document.createElement("div");
    menu.className = "cg-menu";
    const title = document.createElement("div");
    title.className = "cg-title";
    title.textContent = "♔ 花园国际象棋";
    const sub = document.createElement("div");
    sub.className = "cg-sub";
    sub.textContent = "王、后、车、象、马、兵，各有各的走法。记得易位、吃过路兵和升变。";
    menu.append(title, sub);

    const grid = document.createElement("div");
    grid.className = "cg-modes";
    const modes: Array<{ label: string; cls: string; run: () => void }> = [
      { label: "🚩 闯关 188", cls: "", run: startCampaign },
      { label: "♾️ 无尽连胜", cls: "cg-b", run: startEndless },
      { label: "⚔️ 人机对战", cls: "cg-c", run: startVersus },
      { label: "👫 双人同屏", cls: "cg-d", run: startTwoPlayer },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cg-mode ${m.cls}`;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        api.play("tap");
        m.run();
      });
      grid.appendChild(btn);
    }
    menu.appendChild(grid);

    const picks = document.createElement("div");
    picks.className = "cg-picks";
    for (const t of TIERS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cg-pick";
      b.textContent = TIER_LABELS[t];
      b.setAttribute("aria-pressed", String(t === tier));
      b.addEventListener("click", () => {
        tier = t;
        api.play("tap");
        showMenu();
      });
      picks.appendChild(b);
    }
    menu.appendChild(picks);

    const tip = document.createElement("div");
    tip.className = "cg-tip";
    tip.textContent = `朵朵执白：WASD 移光标，F 落子，G 取消｜星星执黑：方向键 + L / K｜Esc 暂停。无尽最高连胜 ${
      save.getGameProgress(meta.id).endlessBest
    } 场`;
    menu.appendChild(tip);
    view.appendChild(menu);
  }

  function startCampaign(): void {
    clear();
    view.appendChild(backBar("闯关 188"));
    const host = document.createElement("div");
    view.appendChild(host);
    child = mountLevelGame(
      { ...api, root: host },
      {
        id: meta.id,
        chapters: CHAPTERS,
        playLevel,
        guide,
        mapHint: "先想对方能怎么应，再决定自己走哪一手。",
        grandMessage: "188 关全部走完，花园杯的奖杯归朵朵和星星啦！",
      }
    );
  }

  function startMatch(label: string, rival: "ai" | "human", t: Tier): void {
    clear();
    view.appendChild(backBar(label));
    const host = document.createElement("div");
    view.appendChild(host);
    const runOne = (): void => {
      child?.destroy();
      host.innerHTML = "";
      child = createTable(host, {
        start: startPosition(),
        goal: { kind: "game" },
        rival,
        tier: t,
        showHints: true,
        label,
        budget: 300,
        onEnd: ({ won, draw, why }) => {
          api.play(won ? "win" : draw ? "pop" : "oops");
          if (won) api.onWin(3, why);
          else api.onLose(why);
          runOne();
        },
      });
    };
    runOne();
  }

  function startVersus(): void {
    startMatch(`人机对战 · ${TIER_LABELS[tier]}`, "ai", tier);
  }
  function startTwoPlayer(): void {
    startMatch("双人同屏", "human", "normal");
  }

  function startEndless(): void {
    clear();
    view.appendChild(backBar("无尽连胜"));
    const host = document.createElement("div");
    view.appendChild(host);
    let streak = 0;
    const runOne = (): void => {
      child?.destroy();
      host.innerHTML = "";
      const p = endlessPlan(streak);
      child = createTable(host, {
        start: parseFen(p.fen),
        goal: { kind: "game" },
        rival: "ai",
        tier: p.tier,
        showHints: true,
        label: `连胜 ${streak} · ${TIER_LABELS[p.tier]}`,
        budget: 300,
        onEnd: ({ won }) => {
          if (won) {
            streak += 1;
            api.play("coin");
            runOne();
            return;
          }
          api.play("oops");
          const best = save.recordEndlessBest(meta.id, streak);
          api.onLose(`这一轮连胜 ${streak} 场，历史最好 ${best} 场。再来一轮准能更远。`);
          streak = 0;
          runOne();
        },
      });
    };
    runOne();
  }

  showMenu();

  return {
    destroy() {
      clear();
      wrap.remove();
    },
  };
}
