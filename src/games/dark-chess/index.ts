import { meta } from "./meta";
export { meta };

// 翻翻暗棋:同一套中国象棋棋子的另一种大众玩法。
//
// 四种玩法共用同一张 4×8 棋盘:
//  - 闯关 188:八章,从「翻子定阵营」一路教到「逼到无棋」和大师档;
//  - 人机对战:四档电脑随便挑;
//  - 无尽:连胜挑战,对手越打越强,记最高连胜;
//  - 双人同屏:盖着的子谁都看不见,天生适合两个人轮流点。
//
// 规则全部在 rules.ts 的纯函数里,界面只是把它画出来。明棋象棋在另一款游戏里,这里不下明棋。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { TIERS, TIER_LABELS, chooseAction, type Tier } from "./ai";
import guide from "./guide";
import { CHAPTERS, endlessPlan, planFor, rateLevel, setupFor, type LevelPlan } from "./levels";
import {
  QUIET_LIMIT,
  applyAction,
  legalActions,
  newGame,
  status,
  type Action,
  type GameState,
  type Side,
} from "./rules";
import { CSS as BOARD_CSS, createBoard, type BoardHandle } from "./view";

const SHELL_CSS = `
.dc-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FDF3E4,#F7EDF6);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.dc-menu{display:flex;flex-direction:column;gap:10px;align-items:center;padding:8px 4px 4px;}
.dc-title{font-size:19px;font-weight:900;color:#8a5a2b;text-align:center;}
.dc-sub{font-size:14px;font-weight:700;color:#8a6a48;text-align:center;line-height:1.6;max-width:330px;}
.dc-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;width:100%;max-width:420px;}
.dc-mode{border:none;border-radius:16px;padding:14px 10px;font-size:16px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#d99a4e,#bd7f37);box-shadow:0 4px 0 #9c6729;}
.dc-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #9c6729;}
.dc-mode.dc-b{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a;}
.dc-mode.dc-c{background:linear-gradient(180deg,#4fa77c,#3d8c66);box-shadow:0 4px 0 #2e6d4f;}
.dc-mode.dc-d{background:linear-gradient(180deg,#a765c0,#8d51a5);box-shadow:0 4px 0 #6f3f83;}
.dc-tip{font-size:14px;font-weight:700;color:#987a58;text-align:center;line-height:1.6;max-width:330px;}
.dc-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px;}
.dc-pick{border:none;border-radius:14px;min-height:44px;padding:8px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#7a5a34;box-shadow:0 3px 0 rgba(160,130,90,.3);}
.dc-pick[aria-pressed="true"]{background:linear-gradient(180deg,#d99a4e,#bd7f37);color:#fff;}
/* PT-6:平板/桌面(1024×768 实测菜单 96~424,舞台底 754,下方 330px 死白)整壳置顶难看。
   .game-stage 是 flex 列,auto 块向外边距只吸收正剩余空间——对局态内容超高时自动归 0,
   手机档不落媒体条件,零回归。 */
@media (min-width:700px) and (min-height:600px){
  .dc-frame{margin-block:auto;}
}
`;

const AI_DELAY_MS = 520;

/** 距离判和还剩这么多手时,顶栏才把倒数摆出来 */
export const QUIET_WARN_AT = 8;

/**
 * 距离手数上限还剩这么多手时,顶栏摆出另一枚倒数。
 *
 * 判和有 P2B-5 的倒数了,可「超过 `maxPlies` 就算平局收场」这条线一直一声不吭 ——
 * 第 6 / 7 章残局关上限只有 60 手,走到头一样是「怎么突然就结束了」。
 * 两条线同时逼近时只摆更紧的那一枚,顶栏不堆两个倒数。
 */
export const PLY_WARN_AT = 10;

export interface TableResult {
  /** 朵朵赢了没有 */
  won: boolean;
  draw: boolean;
  plies: number;
  why: string;
}

export interface TableOptions {
  state: GameState;
  /** 星星那边是电脑还是第二个人 */
  rival: "ai" | "human";
  tier: Tier;
  showCounter: boolean;
  label: string;
  /** 超过这个手数就当平局收场 */
  maxPlies: number;
  seed: number;
  onEnd: (r: TableResult) => void;
}

/** 一张能真正下完的棋盘（闯关、对战、无尽、双人都用它） */
export function createTable(host: HTMLElement, opts: TableOptions): { destroy: () => void } {
  const state = opts.state;
  const wrap = document.createElement("div");
  wrap.className = opts.rival === "human" ? "dc-wrap dc-duoplay" : "dc-wrap";
  host.appendChild(wrap);

  const top = document.createElement("div");
  top.className = "dc-top";
  const turnChip = document.createElement("span");
  turnChip.className = "dc-chip dc-turn";
  const labelChip = document.createElement("span");
  labelChip.className = "dc-chip";
  labelChip.textContent = opts.label;
  const plyChip = document.createElement("span");
  plyChip.className = "dc-chip";
  const quietChip = document.createElement("span");
  quietChip.className = "dc-chip dc-quiet";
  quietChip.hidden = true;
  const capChip = document.createElement("span");
  capChip.className = "dc-chip dc-cap";
  capChip.hidden = true;
  top.append(turnChip, labelChip, plyChip, quietChip, capChip);
  wrap.appendChild(top);

  const boardHost = document.createElement("div");
  wrap.appendChild(boardHost);

  const note = document.createElement("div");
  note.className = "dc-note";
  wrap.appendChild(note);

  const row = document.createElement("div");
  row.className = "dc-row";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "dc-btn";
  cancelBtn.textContent = "取消选择";
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "dc-btn";
  pauseBtn.textContent = "暂停";
  row.append(cancelBtn, pauseBtn);
  wrap.appendChild(row);

  let finished = false;
  let paused = false;
  let destroyed = false;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let board: BoardHandle | null = null;

  function setNote(text: string): void {
    note.textContent = text;
  }

  function renderHud(): void {
    const who = state.turn === "duo" ? "朵朵" : opts.rival === "ai" ? "小对手" : "星星";
    turnChip.textContent = paused ? "已暂停" : `轮到${who}`;
    turnChip.className = state.turn === "duo" ? "dc-chip dc-turn dc-hot" : "dc-chip dc-turn";
    plyChip.textContent = `第 ${state.plies + 1} 手`;
    // 双人同屏时两个人的取消键不一样,按钮上写轮到的那位那一套
    cancelBtn.textContent =
      opts.rival === "human" && state.turn === "star" ? "取消选择 (K)" : "取消选择 (G)";
    // 连着 QUIET_LIMIT 手不吃不翻就判和。快到线了才把倒数摆出来 ——
    // 一上来就挂个计数会喧宾夺主,可到了跟前不说一声,孩子只会觉得「怎么突然就结束了」。
    // 手数走到上限也算收场了(finish() 就是按这条线收的),两枚倒数一起收回去
    const playing = status(state).kind === "playing" && state.plies < opts.maxPlies;
    const left = QUIET_LIMIT - state.quiet;
    const capLeft = opts.maxPlies - state.plies;
    const nearQuiet = playing && left <= QUIET_WARN_AT;
    const nearCap = playing && capLeft <= PLY_WARN_AT;
    // 两条线都快到了就只说更紧的那一条,顶栏不堆两个倒数
    const showQuiet = nearQuiet && (!nearCap || left <= capLeft);
    quietChip.hidden = !showQuiet;
    if (showQuiet) quietChip.textContent = `再 ${left} 手不吃不翻就算和`;
    const showCap = nearCap && !showQuiet;
    capChip.hidden = !showCap;
    if (showCap) capChip.textContent = `再 ${capLeft} 手就到手数上限`;
  }

  function finish(): void {
    if (finished) return;
    const st = status(state);
    if (st.kind === "playing" && state.plies < opts.maxPlies) return;
    finished = true;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if (st.kind === "win") {
      // 谢幕只有画面：输方鞠躬、赢方列队、金花瓣雨。onEnd 的时序一毫秒都不挪
      const winColor = state.colors[st.side];
      if (winColor) board?.flourish({ kind: "win", winner: winColor });
      opts.onEnd({
        won: st.side === "duo",
        draw: false,
        plies: state.plies,
        why: st.side === "duo" ? "把对方的将请去休息啦！" : "这一盘对方先收官了，下一盘先把兵留住。",
      });
      return;
    }
    if (st.kind === "draw") {
      board?.flourish({ kind: "draw" });
      opts.onEnd({ won: false, draw: true, plies: state.plies, why: "连着二十手不吃不翻，这一盘算平局。" });
      return;
    }
    board?.flourish({ kind: "draw" });
    opts.onEnd({ won: false, draw: true, plies: state.plies, why: "手数用完啦，这一盘算平局收场。" });
  }

  function afterAction(a: Action): void {
    const before = state.cells[a.type === "move" ? a.to : a.at];
    const wasCapture = a.type === "move" && before !== null;
    const res = applyAction(state, a);
    if (!res.ok) {
      setNote(res.message);
      board?.refresh();
      return;
    }
    const spot = a.type === "flip" ? a.at : a.to;
    setNote(res.message);
    // 走子 / 吃子把出发格也交给动画层：棋子从哪来就从哪滑过去
    board?.animate(
      a.type === "flip" ? "flip" : wasCapture ? "capture" : "flip",
      spot,
      () => {
        if (destroyed) return;
        board?.refresh();
        renderHud();
        finish();
        if (!finished) scheduleAi();
      },
      a.type === "move" ? a.from : undefined
    );
  }

  function scheduleAi(): void {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if (finished || destroyed || paused) return;
    if (opts.rival !== "ai" || state.turn !== "star") return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (finished || destroyed) return;
      const a = chooseAction(state, "star", opts.tier, opts.seed);
      if (!a) {
        finish();
        return;
      }
      afterAction(a);
    }, AI_DELAY_MS);
  }

  const humans: Side[] = opts.rival === "human" ? ["duo", "star"] : ["duo"];
  board = createBoard(boardHost, {
    state,
    humans,
    showCounter: opts.showCounter,
    onHumanAction: (a) => {
      if (paused || finished) return;
      afterAction(a);
    },
    onNote: setNote,
  });

  const onCancel = (): void => {
    board?.cancel();
    setNote("取消选择啦，重新点一枚。");
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
  cancelBtn.addEventListener("click", onCancel);
  pauseBtn.addEventListener("click", onPause);
  window.addEventListener("keydown", onKey);

  setNote(legalActions(state, state.turn).length > 0 ? "先翻一枚盖着的棋子吧。" : "");
  renderHud();
  finish();
  if (!finished) scheduleAi();

  return {
    destroy() {
      destroyed = true;
      finished = true;
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = null;
      cancelBtn.removeEventListener("click", onCancel);
      pauseBtn.removeEventListener("click", onPause);
      window.removeEventListener("keydown", onKey);
      board?.destroy();
      board = null;
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const plan: LevelPlan = planFor(ctx.level);
  const handle = createTable(stage, {
    state: setupFor(ctx.level),
    rival: "ai",
    tier: plan.tier,
    showCounter: plan.showCounter,
    label: `第 ${ctx.level + 1} 关 · ${TIER_LABELS[plan.tier]}`,
    maxPlies: plan.maxPlies,
    seed: plan.seed,
    onEnd: ({ won, plies, why }) => {
      if (won) ctx.win(rateLevel(plies, plan.maxPlies), why);
      else ctx.lose(why || "这一盘差一点点，下一盘先把兵留住。");
    },
  });
  return { destroy: () => handle.destroy() };
}

export function mount(api: GameApi): { destroy: () => void } {
  let child: { destroy: () => void } | null = null;
  const wrap = document.createElement("div");
  wrap.className = "dc-frame";
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
    row.className = "dc-row";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "dc-btn";
    back.textContent = "◀ 换个玩法";
    back.addEventListener("click", () => {
      api.play("tap");
      showMenu();
    });
    const tag = document.createElement("span");
    tag.className = "dc-chip";
    tag.textContent = label;
    row.append(back, tag);
    return row;
  }

  function showMenu(): void {
    clear();
    const menu = document.createElement("div");
    menu.className = "dc-menu";
    const title = document.createElement("div");
    title.className = "dc-title";
    title.textContent = "🀄️ 翻翻暗棋";
    const sub = document.createElement("div");
    sub.className = "dc-sub";
    sub.textContent = "棋子盖着排成四行。先翻到哪种颜色就是你的，兵能请将休息，炮要隔一个吃。";
    menu.append(title, sub);

    const grid = document.createElement("div");
    grid.className = "dc-modes";
    const modes: Array<{ label: string; cls: string; run: () => void }> = [
      { label: "🚩 闯关 188", cls: "", run: startCampaign },
      { label: "♾️ 无尽连胜", cls: "dc-b", run: startEndless },
      { label: "⚔️ 人机对战", cls: "dc-c", run: startVersus },
      { label: "👫 双人同屏", cls: "dc-d", run: startTwoPlayer },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dc-mode ${m.cls}`;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        api.play("tap");
        m.run();
      });
      grid.appendChild(btn);
    }
    menu.appendChild(grid);

    const picks = document.createElement("div");
    picks.className = "dc-picks";
    for (const t of TIERS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dc-pick";
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
    tip.className = "dc-tip";
    tip.textContent = `朵朵：WASD 移光标，F 确认，G 取消｜星星：方向键 + L / K｜Esc 暂停。无尽最高连胜 ${
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
        mapHint: "翻子看运气，走子看脑子，兵能请将去休息。",
        grandMessage: "188 关全部翻完，暗棋杯的奖杯归朵朵和星星啦！",
      }
    );
  }

  function startVersus(): void {
    clear();
    view.appendChild(backBar(`人机对战 · ${TIER_LABELS[tier]}`));
    const host = document.createElement("div");
    view.appendChild(host);
    let seed = 4200;
    const runOne = (): void => {
      child?.destroy();
      host.innerHTML = "";
      seed += 97;
      child = createTable(host, {
        state: newGame(seed),
        rival: "ai",
        tier,
        showCounter: true,
        label: `对战 · ${TIER_LABELS[tier]}`,
        maxPlies: 240,
        seed,
        onEnd: ({ won, draw, why }) => {
          api.play(won ? "win" : "oops");
          if (won) api.onWin(3, why);
          else if (draw) api.onLose(why);
          else api.onLose(why);
          runOne();
        },
      });
    };
    runOne();
  }

  function startTwoPlayer(): void {
    clear();
    view.appendChild(backBar("双人同屏"));
    const host = document.createElement("div");
    view.appendChild(host);
    let seed = 7700;
    const runOne = (): void => {
      child?.destroy();
      host.innerHTML = "";
      seed += 89;
      child = createTable(host, {
        state: newGame(seed),
        rival: "human",
        tier: "normal",
        showCounter: true,
        label: "双人同屏",
        maxPlies: 240,
        seed,
        onEnd: ({ won, draw, why }) => {
          api.play(won ? "win" : "pop");
          if (draw) api.onLose(why);
          else api.onWin(2, won ? "朵朵赢下这一盘！" : "星星赢下这一盘！");
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
        state: newGame(p.seed),
        rival: "ai",
        tier: p.tier,
        showCounter: true,
        label: `连胜 ${streak} · ${TIER_LABELS[p.tier]}`,
        maxPlies: 240,
        seed: p.seed,
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
