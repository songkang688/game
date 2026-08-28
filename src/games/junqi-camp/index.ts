import { meta } from "./meta";
export { meta };

// 军旗对决：二人军棋（陆战棋）电子暗棋。
//
// 四种玩法共用同一张 12×5 的棋盘与同一套电子裁判：
//  - 闯关 188：八章布阵残局，从明棋比大小一路教到军旗杯；
//  - 人机对战：四档电脑，暗棋，只看得到自己的子；
//  - 无尽：连胜挑战，对手一场比一场强，记最高连胜；
//  - 双人同屏：明棋，两个人轮流点，谁先扛回旗子谁赢。
//
// 规则全在 rules.ts 的纯函数里，这里只负责把它接成能玩的四个入口。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { TIERS, TIER_LABELS, TIER_SETUP, TIER_TIPS, chooseMove, type Tier } from "./ai";
import { crestSVG } from "./art";
import guide from "./guide";
import {
  CHAPTERS,
  endlessGame,
  endlessPlan,
  maxPliesOf,
  planFor,
  positionFor,
  rateLevel,
} from "./levels";
import { applyMove, status, type GameState, type Move, type Side } from "./rules";
import { newGame } from "./setup";
import { CSS as BOARD_CSS, createBoard, type BoardHandle, type CombatShow } from "./view";

const SHELL_CSS = `
.jq-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  background:linear-gradient(180deg,#F4F8EC,#EAF1F7);border-radius:16px;padding:10px;
  user-select:none;-webkit-user-select:none;}
.jq-menu{display:flex;flex-direction:column;gap:10px;align-items:center;padding:8px 4px 4px;}
.jq-title{font-size:19px;font-weight:900;color:#5c6b45;text-align:center;}
.jq-sub{font-size:14px;font-weight:700;color:#6f7c59;text-align:center;line-height:1.6;max-width:330px;}
.jq-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;width:100%;max-width:420px;}
.jq-mode{border:none;border-radius:16px;padding:14px 10px;font-size:16px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#8FBF63,#71A248);box-shadow:0 4px 0 #5c8639;}
.jq-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #5c8639;}
.jq-mode.jq-b{background:linear-gradient(180deg,#5F8FD0,#4B76B4);box-shadow:0 4px 0 #3b5e92;}
.jq-mode.jq-c{background:linear-gradient(180deg,#D89A54,#BC7F3C);box-shadow:0 4px 0 #9a662d;}
.jq-mode.jq-d{background:linear-gradient(180deg,#A473C4,#8B5AAB);box-shadow:0 4px 0 #6f4589;}
.jq-tip{font-size:14px;font-weight:700;color:#7a8663;text-align:center;line-height:1.6;max-width:340px;}
.jq-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:4px;}
.jq-pick{border:none;border-radius:14px;min-height:44px;padding:8px 13px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffe0;color:#5f6b4b;box-shadow:0 3px 0 rgba(120,130,100,.28);}
.jq-pick[aria-pressed="true"]{background:linear-gradient(180deg,#8FBF63,#71A248);color:#fff;}
.jq-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.jq-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#5f6b4b;
  box-shadow:0 2px 6px rgba(120,130,100,.22);white-space:nowrap;}
.jq-chip.jq-hot{background:#FFF0DE;color:#A9531F;}
.jq-note{text-align:center;min-height:20px;font-size:14px;font-weight:700;color:#61704b;margin-top:8px;line-height:1.5;}
.jq-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.jq-crest{display:inline-flex;align-items:center;gap:4px;background:#fff;border-radius:999px;padding:5px 10px;
  font-size:14px;font-weight:800;color:#5f6b4b;box-shadow:0 2px 6px rgba(120,130,100,.22);white-space:nowrap;}
.jq-crest svg{display:block;}
`;

const AI_DELAY_MS = 560;

/** 输了只鼓励，不批评 */
export const LOSE_LINE = "旗子这次没扛回来，下一盘先修条铁路。";

export interface TableResult {
  /** 朵朵赢了没有 */
  won: boolean;
  draw: boolean;
  /** 朵朵走了几手 */
  duoMoves: number;
  why: string;
}

export interface TableOptions {
  state: GameState;
  /** 对面是电脑、是第二个人，还是按兵不动的守备队 */
  rival: "ai" | "human" | "garrison";
  tier: Tier;
  /** 看棋的视角："all" 就是明棋 */
  viewer: Side | "all";
  label: string;
  /** 超过这么多手就收场 */
  maxPlies: number;
  /** 手数用完算输（闯关）还是算和（对战） */
  timeoutIsLoss: boolean;
  seed: number;
  hint?: string;
  onEnd: (r: TableResult) => void;
}

/** 一张能真正下完的棋盘（四种玩法都用它） */
export function createTable(host: HTMLElement, opts: TableOptions): { destroy: () => void } {
  const state = opts.state;
  const wrap = document.createElement("div");
  wrap.className = opts.rival === "human" ? "jq-wrap jq-duoplay" : "jq-wrap";
  host.appendChild(wrap);

  const top = document.createElement("div");
  top.className = "jq-top";
  const turnChip = document.createElement("span");
  turnChip.className = "jq-chip jq-hot";
  const labelChip = document.createElement("span");
  labelChip.className = "jq-chip";
  labelChip.textContent = opts.label;
  const plyChip = document.createElement("span");
  plyChip.className = "jq-chip";
  // 双方军旗徽标 + 各自还剩几枚棋子（小旗 SVG 见 art.ts）
  const duoCrest = document.createElement("span");
  duoCrest.className = "jq-crest";
  const starCrest = document.createElement("span");
  starCrest.className = "jq-crest";
  top.append(turnChip, labelChip, plyChip, duoCrest, starCrest);
  wrap.appendChild(top);

  const boardHost = document.createElement("div");
  wrap.appendChild(boardHost);

  const note = document.createElement("div");
  note.className = "jq-note";
  wrap.appendChild(note);

  const row = document.createElement("div");
  row.className = "jq-row";
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "jq-btn";
  pauseBtn.textContent = "⏸️ 暂停 (Esc)";
  pauseBtn.setAttribute("aria-pressed", "false");
  row.appendChild(pauseBtn);
  wrap.appendChild(row);

  let finished = false;
  let paused = false;
  let destroyed = false;
  let duoMoves = 0;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let board: BoardHandle | null = null;

  function setNote(text: string): void {
    note.textContent = text;
  }

  function renderHud(): void {
    const who = state.turn === "duo" ? "朵朵" : opts.rival === "human" ? "星星" : "小对手";
    turnChip.textContent = paused ? "已暂停" : `轮到${who}`;
    turnChip.className = state.turn === "duo" ? "jq-chip jq-hot" : "jq-chip";
    const left = Math.max(0, opts.maxPlies - state.plies);
    plyChip.textContent = `还剩 ${left} 手`;
    const countOf = (side: Side): number =>
      state.cells.reduce((n, c) => n + (c && c.side === side ? 1 : 0), 0);
    const starName = opts.rival === "human" ? "星星" : "小对手";
    duoCrest.innerHTML = `${crestSVG("duo")}<b>${countOf("duo")}</b>`;
    duoCrest.setAttribute("aria-label", `朵朵还有 ${countOf("duo")} 枚棋子`);
    starCrest.innerHTML = `${crestSVG("star")}<b>${countOf("star")}</b>`;
    starCrest.setAttribute("aria-label", `${starName}还有 ${countOf("star")} 枚棋子`);
  }

  function finish(): void {
    if (finished) return;
    const st = status(state);
    const timeUp = state.plies >= opts.maxPlies;
    if (st.kind === "playing" && !timeUp) return;
    finished = true;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if (st.kind === "win") {
      opts.onEnd({
        won: st.side === "duo",
        draw: false,
        duoMoves,
        why: st.side === "duo" ? "旗子扛回来啦！" : LOSE_LINE,
      });
      return;
    }
    if (st.kind === "draw") {
      opts.onEnd({ won: false, draw: true, duoMoves, why: st.why });
      return;
    }
    opts.onEnd({
      won: false,
      draw: !opts.timeoutIsLoss,
      duoMoves,
      why: opts.timeoutIsLoss ? LOSE_LINE : "手数用完啦，这一盘算平局收场。",
    });
  }

  function commit(move: Move): void {
    if (destroyed || finished || paused) return;
    const before = state.cells.slice();
    const mover = state.turn;
    const res = applyMove(state, move);
    if (!res.ok) {
      setNote(res.message);
      board?.refresh();
      return;
    }
    if (mover === "duo") duoMoves += 1;
    const show: CombatShow | null = res.combat
      ? {
          from: move.from,
          to: move.to,
          attacker: res.combat.attacker.kind,
          defender: res.combat.defender.kind,
          outcome: res.combat.outcome,
          flagTaken: res.combat.flagTaken,
        }
      : null;
    setNote(res.message);
    board?.animateMove(before, move, show, () => {
      if (destroyed) return;
      board?.refresh();
      renderHud();
      finish();
      if (!finished) scheduleAi();
    });
  }

  function scheduleAi(): void {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if (finished || destroyed || paused) return;
    if (opts.rival !== "ai" || state.turn !== "star") return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (finished || destroyed || paused) return;
      const move = chooseMove(state, "star", opts.tier, opts.seed + state.plies);
      if (!move) {
        finish();
        return;
      }
      commit(move);
    }, AI_DELAY_MS);
  }

  const twoHumans = opts.rival === "human";
  /** 单人局里方向键与 L / K 也归朵朵，老键位一条都不丢 */
  const starSeat: Side = twoHumans ? "star" : "duo";

  board = createBoard(boardHost, {
    state,
    humans: twoHumans ? ["duo", "star"] : ["duo"],
    viewer: opts.viewer,
    onMove: commit,
    onNote: setNote,
    isPaused: () => paused,
  });

  function togglePause(): void {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    pauseBtn.setAttribute("aria-pressed", String(paused));
    renderHud();
    // 让棋盘把「确认 / 取消」也一起翻面：点不动的钮不该看起来还能点
    board?.refresh();
    if (!paused) scheduleAi();
  }

  // 两套键位各管各的座位：朵朵 WASD + F / G，星星 方向键 + L / K
  const DUO_MOVE: Record<string, [number, number]> = {
    w: [-1, 0],
    s: [1, 0],
    a: [0, -1],
    d: [0, 1],
  };
  const STAR_MOVE: Record<string, [number, number]> = {
    arrowup: [-1, 0],
    arrowdown: [1, 0],
    arrowleft: [0, -1],
    arrowright: [0, 1],
  };

  const onKey = (e: KeyboardEvent): void => {
    if (destroyed || finished) return;
    const key = (e.key || "").toLowerCase();
    if (DUO_MOVE[key]) {
      board?.moveCursor(DUO_MOVE[key][0], DUO_MOVE[key][1], "duo");
      e.preventDefault?.();
      return;
    }
    if (STAR_MOVE[key]) {
      board?.moveCursor(STAR_MOVE[key][0], STAR_MOVE[key][1], starSeat);
      e.preventDefault?.();
      return;
    }
    if (key === "f" || key === "l") {
      board?.activate(undefined, key === "f" ? "duo" : starSeat);
      e.preventDefault?.();
      return;
    }
    if (key === "g" || key === "k") {
      board?.cancel(key === "g" ? "duo" : starSeat);
      e.preventDefault?.();
      return;
    }
    if (key === "escape") {
      togglePause();
      e.preventDefault?.();
    }
  };

  pauseBtn.addEventListener("click", togglePause);
  window.addEventListener("keydown", onKey);

  setNote(opts.hint ?? "点一枚自己的棋子，再点亮着的落点，最后按确认。");
  renderHud();
  finish();
  if (!finished) scheduleAi();

  return {
    destroy() {
      destroyed = true;
      finished = true;
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = null;
      pauseBtn.removeEventListener("click", togglePause);
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
    state: positionFor(ctx.level),
    rival: plan.garrison ? "garrison" : "ai",
    tier: plan.tier,
    viewer: plan.hidden ? "duo" : "all",
    label: `第 ${ctx.level + 1} 关 · ${plan.budget} 手内扛旗`,
    maxPlies: maxPliesOf(plan),
    timeoutIsLoss: true,
    seed: plan.seed,
    hint: plan.hint,
    onEnd: ({ won, duoMoves, why }) => {
      if (won) ctx.win(rateLevel(duoMoves, plan.budget), why);
      else ctx.lose(why || LOSE_LINE);
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
    row.className = "jq-row";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "jq-btn";
    back.textContent = "◀ 换个玩法";
    back.addEventListener("click", () => {
      api.play("tap");
      showMenu();
    });
    const tag = document.createElement("span");
    tag.className = "jq-chip";
    tag.textContent = label;
    row.append(back, tag);
    return row;
  }

  function showMenu(): void {
    clear();
    const menu = document.createElement("div");
    menu.className = "jq-menu";
    const title = document.createElement("div");
    title.className = "jq-title";
    title.textContent = "🎖️ 军旗对决";
    const sub = document.createElement("div");
    sub.className = "jq-sub";
    sub.textContent =
      "铁路上想推多远推多远，行营里谁也撞不着。工兵排雷、炸弹同尽，把对方大本营里的旗子请回来。";
    menu.append(title, sub);

    const grid = document.createElement("div");
    grid.className = "jq-modes";
    const modes: Array<{ label: string; cls: string; run: () => void }> = [
      { label: "🚩 闯关 188", cls: "", run: startCampaign },
      { label: "⚔️ 人机对战", cls: "jq-b", run: startVersus },
      { label: "♾️ 无尽连胜", cls: "jq-c", run: startEndless },
      { label: "👫 双人同屏", cls: "jq-d", run: startTwoPlayer },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `jq-mode ${m.cls}`;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        api.play("tap");
        m.run();
      });
      grid.appendChild(btn);
    }
    menu.appendChild(grid);

    const picks = document.createElement("div");
    picks.className = "jq-picks";
    for (const t of TIERS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "jq-pick";
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
    tip.className = "jq-tip";
    tip.textContent = `${TIER_LABELS[tier]}：${TIER_TIPS[tier]}｜WASD / 方向键挪光标，F 确认，G 取消，Esc 暂停。无尽最高连胜 ${
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
        mapHint: "铁路直着走，工兵会拐弯，旗子在对面的大本营里。",
        grandMessage: "188 关全部扛下来，军旗杯的奖杯归朵朵和星星啦！",
      }
    );
  }

  function startVersus(): void {
    clear();
    view.appendChild(backBar(`人机对战 · ${TIER_LABELS[tier]}`));
    const host = document.createElement("div");
    view.appendChild(host);
    let seed = 4300;
    const runOne = (): void => {
      child?.destroy();
      host.innerHTML = "";
      seed += 101;
      child = createTable(host, {
        state: newGame(seed, { starSkill: TIER_SETUP[tier], duoSkill: 1 }),
        rival: "ai",
        tier,
        viewer: "duo",
        label: `对战 · ${TIER_LABELS[tier]}`,
        maxPlies: 400,
        timeoutIsLoss: false,
        seed,
        hint: "对面全是背面，撞过一次就看得见了。",
        onEnd: ({ won, draw, why }) => {
          api.play(won ? "win" : "oops");
          if (won) api.onWin(3, why);
          else api.onLose(draw ? why : LOSE_LINE);
          runOne();
        },
      });
    };
    runOne();
  }

  function startTwoPlayer(): void {
    clear();
    view.appendChild(backBar("双人同屏 · 明棋"));
    const host = document.createElement("div");
    view.appendChild(host);
    let seed = 7800;
    const runOne = (): void => {
      child?.destroy();
      host.innerHTML = "";
      seed += 89;
      child = createTable(host, {
        state: newGame(seed),
        rival: "human",
        tier: "normal",
        viewer: "all",
        label: "双人同屏 · 明棋",
        maxPlies: 400,
        timeoutIsLoss: false,
        seed,
        hint: "同屏就下明棋：两个人都看得见，轮流点自己那一边。",
        onEnd: ({ won, draw, why }) => {
          api.play(draw ? "pop" : "win");
          if (draw) api.onLose(why);
          else api.onWin(2, won ? "朵朵扛回旗子啦！" : "星星扛回旗子啦！");
          runOne();
        },
      });
    };
    runOne();
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
        state: endlessGame(streak),
        rival: "ai",
        tier: p.tier,
        viewer: "duo",
        label: `连胜 ${streak} · ${TIER_LABELS[p.tier]}`,
        maxPlies: 400,
        timeoutIsLoss: false,
        seed: p.seed,
        hint: "赢一盘对手就换一档，越往后越难。",
        onEnd: ({ won }) => {
          if (won) {
            streak += 1;
            api.play("coin");
            runOne();
            return;
          }
          api.play("oops");
          const best = save.recordEndlessBest(meta.id, streak);
          api.onLose(`这一轮连胜 ${streak} 场，历史最好 ${best} 场。${LOSE_LINE}`);
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
