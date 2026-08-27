import { meta } from "./meta";
export { meta };

// 梨康台球:美式八球的简化落地。
//
// 四种玩法共用同一张球桌 `createTable`:
//  - 闯关:188 关八章,前七章是一杆一杆的技巧关(直线 / 库边 / 分组 / 母球控制 / 组合球 /
//    指定袋 / 残局),第八章「球房杯」是完整的一局八球对电脑;
//  - 人机对战:三局两胜,电脑四档可选;
//  - 无尽:一局一局的残局,失误即止,记最高连过;
//  - 双人同屏:鸭梨和康康轮流出杆。
//
// 规则、犯规、胜负全部走 rules.ts 的纯函数,画面上看到的每一次滚球都是 physics.ts 真算出来的,
// 和单测跑的是同一套代码。
import { save } from "../../engine/save";
import { mulberry32, mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { AI_BLURB, AI_LABEL, AI_TIERS, aiCuePlacement, chooseShot, type AiTier } from "./ai";
import GUIDE from "./guide";
import {
  CHAPTERS,
  buildEndlessLevel,
  buildLevel,
  levelSuccess,
  loseLine,
  rateLevel,
  winLine,
  type LevelSpec,
} from "./levels";
import { restoreCue } from "./match";
import { cloneBalls, type Ball, type ShotResult, type Vec } from "./physics";
import {
  GROUP_LABEL,
  createMatch,
  legalTarget,
  remainingOf,
  resolveShot,
  type MatchState,
} from "./rules";
import { createTable, type SeatPlan, type ShotIntent, type TableHandle } from "./view";

const P_NAME = ["鸭梨", "康康"];
const P_EMOJI = ["🍐", "👓"];
const P_COLOR = ["#e8558f", "#3f7fd6"];

const SHELL_CSS = `
.ps-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#eefaf1,#fdf1f6);display:flex;flex-direction:column;gap:8px;}
.ps-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.ps-back{border:none;border-radius:999px;min-height:44px;padding:8px 14px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#3f8f68;box-shadow:0 3px 0 rgba(90,150,120,.28);}
.ps-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(90,150,120,.28);}
.ps-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.ps-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
.ps-bar[hidden],.ps-picks[hidden]{display:none;}
.ps-open{border:none;border-radius:999px;min-height:44px;padding:9px 15px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7fc9a2,#4fa87f);box-shadow:0 4px 0 #3b8062;}
.ps-open:active{transform:translateY(2px);box-shadow:0 2px 0 #3b8062;}
.ps-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.ps-open--ai{background:linear-gradient(180deg,#8fb8e8,#5f8fd0);box-shadow:0 4px 0 #4a72a8;}
.ps-open--en{background:linear-gradient(180deg,#b39ae8,#8a6fd0);box-shadow:0 4px 0 #6b53a8;}
.ps-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.ps-pick{border:none;border-radius:14px;min-height:44px;padding:8px 13px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#3d6152;box-shadow:0 3px 0 rgba(120,160,140,.35);}
.ps-pick[aria-pressed="true"]{background:linear-gradient(180deg,#7fc9a2,#4fa87f);color:#fff;box-shadow:0 3px 0 #3b8062;}
.ps-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.ps-over{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:18px 12px;}
.ps-over-t{font-size:20px;font-weight:900;color:#3f8f68;}
.ps-over-s{font-size:13.5px;font-weight:700;color:#43604f;line-height:1.6;max-width:340px;}
`;

const SHELL_STYLE_ID = "ps-shell-style";
/** 现在有几处正用着这份样式:进出多少次都只注一份,最后一个走的人负责带走 */
let shellCssUsers = 0;

/** 注一次样式并占一份引用,返回「这一份用完了」的回调（重复调用无害） */
function acquireShellCss(host: HTMLElement): () => void {
  shellCssUsers++;
  if (!document.getElementById(SHELL_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = SHELL_STYLE_ID;
    style.textContent = SHELL_CSS;
    (document.head ?? host).appendChild(style);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    shellCssUsers = Math.max(0, shellCssUsers - 1);
    if (shellCssUsers === 0) document.getElementById(SHELL_STYLE_ID)?.remove();
  };
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = document.createElement("button") as HTMLButtonElement;
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  return b;
}

function overBox(
  host: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; onClick: () => void }>
): void {
  host.innerHTML = "";
  const box = el("div", "ps-over");
  box.append(el("div", "ps-over-t", title), el("div", "ps-over-s", sub));
  const row = el("div", "ps-row");
  for (const b of buttons) {
    const btn = button("ps-btn", b.label);
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  host.appendChild(box);
}

// ---------------------------------------------------------------------------
// 技巧关(前七章):一杆一杆打,打歪了把球放回去重来
// ---------------------------------------------------------------------------

function playSkillLevel(stage: HTMLElement, ctx: PlayCtx, spec: LevelSpec): { destroy: () => void } {
  let remaining = spec.targetIds.slice();
  let shotsUsed = 0;
  let snapshot = cloneBalls(spec.balls);
  let table: TableHandle | null = null;
  let done = false;

  table = createTable(stage, {
    balls: cloneBalls(spec.balls),
    seats: [{ name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null }],
    turn: 0,
    banner: `${CHAPTERS[spec.chapterIndex].emoji} 第 ${spec.index + 1} 关`,
    tip: `${spec.hint} 还能出 ${spec.shots} 杆。`,
    showAim: spec.showAim,
    allowSpin: spec.chapterIndex >= 3,
    requireCall: spec.calledPocket !== null,
    freeBall: false,
    target: spec.requireGroup ?? "any",
    sfx: (n: SoundName) => ctx.sfx(n),
    onSettled: (res: ShotResult) => {
      if (done) return;
      shotsUsed++;
      const check = levelSuccess({ ...spec, targetIds: remaining }, res);
      if (check.ok) {
        remaining = remaining.filter((id) => !res.potted.some((p) => p.id === id));
        if (remaining.length === 0) {
          done = true;
          ctx.win(rateLevel(shotsUsed, spec.shots), winLine(shotsUsed));
          return;
        }
        snapshot = cloneBalls(res.balls);
        const cuePotted = res.potted.some((p) => p.kind === "cue");
        if (cuePotted) snapshot = restoreCue(snapshot, { x: 44, y: 50 });
        table?.update({
          balls: snapshot,
          tip: `进了！还剩 ${remaining.length} 颗，还能出 ${Math.max(0, spec.shots - shotsUsed)} 杆。`,
        });
        return;
      }
      if (shotsUsed >= spec.shots) {
        done = true;
        ctx.lose(loseLine(check.reason));
        return;
      }
      // 这一杆不算数:球放回上一杆之前的位置,再给一次机会
      table?.update({
        balls: cloneBalls(snapshot),
        tip: `${check.reason}还能出 ${spec.shots - shotsUsed} 杆。`,
      });
    },
  });

  return {
    destroy() {
      done = true;
      table?.destroy();
      table = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 完整一局八球:闯关第八章、人机对战、双人同屏共用
// ---------------------------------------------------------------------------

interface RackOptions {
  seats: [SeatPlan, SeatPlan];
  tiers: [AiTier | null, AiTier | null];
  banner: string;
  seed: number;
  requireCall?: boolean;
  threeFoulLoss?: boolean;
  sfx: (n: SoundName) => void;
  onOver: (winner: 0 | 1, m: MatchState) => void;
}

function runRack(host: HTMLElement, opts: RackOptions): { destroy: () => void } {
  let m = createMatch({
    seed: opts.seed,
    requireCall: opts.requireCall ?? true,
    threeFoulLoss: opts.threeFoulLoss ?? true,
  });
  const rand = mulberry32(opts.seed * 131 + 7);
  let table: TableHandle | null = null;
  let closed = false;

  function targetOf(state: MatchState): "warm" | "cool" | "black" | "any" {
    const t = legalTarget(state);
    return t === "cue" ? "any" : t;
  }

  function groupNote(state: MatchState): string {
    const g = state.groups[state.turn];
    if (g === null) return "台面还开放着，进了谁就打谁那一组。";
    return remainingOf(state.balls, g) === 0
      ? "自己那一组清完啦，指定一个袋把黑星球送进去。"
      : `你打${GROUP_LABEL[g]}，还剩 ${remainingOf(state.balls, g)} 颗。`;
  }

  /** 轮到电脑而且拿到自由球时，电脑自己把母球摆好 */
  function settleFreeBall(): void {
    if (!m.freeBall) return;
    const tier = opts.tiers[m.turn];
    if (tier === null) return;
    const group = m.groups[m.turn];
    const pos = aiCuePlacement({
      balls: m.balls,
      group,
      ownCleared: group !== null && remainingOf(m.balls, group) === 0,
      requireCall: m.requireCall,
    });
    m = { ...m, balls: restoreCue(m.balls, pos), freeBall: false };
  }

  function push(): void {
    settleFreeBall();
    table?.update({
      balls: m.balls,
      turn: m.turn,
      tip: `${m.message} ${groupNote(m)}`,
      freeBall: m.freeBall,
      target: targetOf(m),
    });
  }

  table = createTable(host, {
    balls: m.balls,
    seats: opts.seats,
    turn: m.turn,
    banner: opts.banner,
    tip: m.message,
    showAim: true,
    allowSpin: true,
    requireCall: m.requireCall,
    freeBall: false,
    target: targetOf(m),
    sfx: opts.sfx,
    onFreeBall: (pos: Vec) => {
      m = { ...m, balls: restoreCue(m.balls, pos), freeBall: false };
    },
    aiThink: (balls: Ball[], seat: number): ShotIntent | null => {
      const tier = opts.tiers[seat];
      if (tier === null) return null;
      if (m.phase === "break") {
        const rack = balls.filter((b) => b.kind !== "cue" && !b.potted);
        const cue = balls.find((b) => b.kind === "cue");
        let apex = rack[0];
        for (const b of rack) if (b.x < apex.x) apex = b;
        return {
          angle: cue && apex ? Math.atan2(apex.y - cue.y, apex.x - cue.x) + (rand() - 0.5) * 0.05 : 0,
          power: 0.92,
          spin: 0,
          calledPocket: null,
        };
      }
      const group = m.groups[seat];
      const shot = chooseShot(
        {
          balls,
          group,
          ownCleared: group !== null && remainingOf(balls, group) === 0,
          requireCall: m.requireCall,
        },
        tier,
        rand
      );
      return { angle: shot.angle, power: shot.power, spin: shot.spin, calledPocket: shot.calledPocket };
    },
    onSettled: (res: ShotResult, shot: ShotIntent) => {
      if (closed) return;
      m = resolveShot({ ...m, calledPocket: shot.calledPocket }, res);
      if (m.phase === "over") {
        const winner = (m.winner === 1 ? 1 : 0) as 0 | 1;
        opts.onOver(winner, m);
        return;
      }
      push();
    },
  });

  return {
    destroy() {
      closed = true;
      table?.destroy();
      table = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const spec = buildLevel(ctx.level);
  if (spec.kind !== "rack") return playSkillLevel(stage, ctx, spec);
  const tier = Math.min(4, Math.max(1, spec.aiTier)) as AiTier;
  let settled = false;
  const handle = runRack(stage, {
    seats: [
      { name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null },
      { name: AI_LABEL[tier], emoji: "🤖", color: P_COLOR[1], ai: tier },
    ],
    tiers: [null, tier],
    banner: `🏆 第 ${spec.index + 1} 关 · ${AI_LABEL[tier]}`,
    seed: spec.index + 3,
    // 第六章已经练过指定袋，这里照常要指定；但闯关不用「三次犯规直接判负」这条，
    // 手滑几下也能把一局打完，输赢还是看谁先清完。
    requireCall: true,
    threeFoulLoss: false,
    sfx: (n) => ctx.sfx(n),
    onOver: (winner, m) => {
      if (settled) return;
      settled = true;
      if (winner === 0) {
        const stars = m.fouls[0] === 0 ? 3 : m.fouls[0] === 1 ? 2 : 1;
        ctx.win(stars, `赢下这一局！${AI_LABEL[tier]}也拦不住你。`);
      } else {
        ctx.lose("这一局让对手先清完了，换个顺序再来一局就好。");
      }
    },
  });
  return handle;
}

// ---------------------------------------------------------------------------
// 模式外壳
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  const releaseCss = acquireShellCss(host);
  const wrap = el("div", "ps-mode");
  const head = el("div", "ps-mhead");
  const back = button("ps-back", "◀ 回选关");
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "ps-chip", title);
  head.append(back, chip);
  const stage = el("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return {
    stage,
    chip,
    destroy: () => {
      wrap.remove();
      releaseCss();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:三局两胜(对电脑或者双人同屏)
// ---------------------------------------------------------------------------

function mountVersus(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  tier: AiTier | null
): { destroy: () => void } {
  const label = tier ? `🤖 人机对战 · ${AI_LABEL[tier]}` : "👫 双人同屏";
  const shell = makeShell(host, api, onBack, `${label} · 三局两胜`);
  let round = 1;
  const wins: [number, number] = [0, 0];
  let game: { destroy: () => void } | null = null;

  function start(): void {
    game?.destroy();
    game = null;
    shell.stage.innerHTML = "";
    shell.chip.textContent = `${label} · 第 ${round} 局 · ${wins[0]}:${wins[1]}`;
    game = runRack(shell.stage, {
      seats: [
        { name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null },
        tier
          ? { name: AI_LABEL[tier], emoji: "🤖", color: P_COLOR[1], ai: tier }
          : { name: P_NAME[1], emoji: P_EMOJI[1], color: P_COLOR[1], ai: null },
      ],
      tiers: [null, tier],
      banner: `第 ${round} 局`,
      seed: round * 13 + 5,
      sfx: (n) => api.play(n),
      onOver: (winner) => {
        wins[winner]++;
        game?.destroy();
        game = null;
        const names = [P_NAME[0], tier ? AI_LABEL[tier] : P_NAME[1]];
        const over = wins[0] >= 2 || wins[1] >= 2;
        if (winner === 0) {
          api.play("win");
          api.addStars(over ? 3 : 1);
        } else {
          api.play("oops");
        }
        const title = over
          ? `🏆 ${names[wins[0] >= 2 ? 0 : 1]}拿下这一盘！`
          : `✅ 第 ${round} 局是${names[winner]}的`;
        const sub = over
          ? `总比分 ${wins[0]}:${wins[1]}。再开一盘，球堆会重新摆过。`
          : `总比分 ${wins[0]}:${wins[1]}，继续下一局。`;
        overBox(shell.stage, title, sub, [
          {
            label: over ? "🔁 再来一盘" : "▶ 下一局",
            onClick: () => {
              api.play("tap");
              if (over) {
                wins[0] = 0;
                wins[1] = 0;
                round = 1;
              } else {
                round++;
              }
              start();
            },
          },
          { label: "◀ 回选关", onClick: () => { api.play("tap"); onBack(); } },
        ]);
      },
    });
  }

  start();

  return {
    destroy() {
      game?.destroy();
      game = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:一局一局的残局,失误即止
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽残局");
  let round = 1;
  let best = save.getGameProgress(meta.id).endlessBest;
  let table: TableHandle | null = null;

  function start(): void {
    table?.destroy();
    table = null;
    shell.stage.innerHTML = "";
    const spec = buildEndlessLevel(round);
    let remaining = spec.targetIds.slice();
    let snapshot = cloneBalls(spec.balls);
    shell.chip.textContent = `♾️ 无尽残局 · 第 ${round} 局 · 最好 ${best} 局`;
    table = createTable(shell.stage, {
      balls: cloneBalls(spec.balls),
      seats: [{ name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null }],
      turn: 0,
      banner: `第 ${round} 局`,
      tip: `${spec.hint} 一杆打空就结束，最多 ${spec.shots} 杆。`,
      showAim: spec.showAim,
      allowSpin: true,
      requireCall: false,
      freeBall: false,
      target: "warm",
      sfx: (n) => api.play(n),
      onSettled: (res) => {
        const check = levelSuccess({ ...spec, targetIds: remaining }, res);
        if (check.ok) {
          remaining = remaining.filter((id) => !res.potted.some((p) => p.id === id));
          if (remaining.length === 0) {
            best = save.recordEndlessBest(meta.id, round);
            api.addStars(1);
            api.play("coin");
            round++;
            start();
            return;
          }
          snapshot = cloneBalls(res.balls);
          table?.update({ balls: snapshot, tip: `进了！还剩 ${remaining.length} 颗。` });
          return;
        }
        const reached = Math.max(0, round - 1);
        best = save.recordEndlessBest(meta.id, reached);
        table?.destroy();
        table = null;
        api.play("oops");
        overBox(
          shell.stage,
          "🎱 这一杆没打成",
          `${check.reason}你连过了 ${reached} 局，最好成绩 ${best} 局。歇口气再来，手感一会儿就回来了。`,
          [
            {
              label: "🔁 从第 1 局再来",
              onClick: () => {
                api.play("tap");
                round = 1;
                start();
              },
            },
            { label: "◀ 回选关", onClick: () => { api.play("tap"); onBack(); } },
          ]
        );
      },
    });
  }

  start();

  return {
    destroy() {
      table?.destroy();
      table = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const releaseCss = acquireShellCss(api.root);
  const root = el("div");
  const bar = el("div", "ps-bar");
  const picks = el("div", "ps-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let tier: AiTier = 2;

  const aiBtn = button("ps-open ps-open--ai", "🤖 人机对战");
  const duoBtn = button("ps-open", "👫 双人同屏");
  const endlessBtn = button("ps-open ps-open--en", "♾️ 无尽残局");
  bar.append(aiBtn, duoBtn, endlessBtn);

  const pickBtns: HTMLButtonElement[] = [];
  for (const t of AI_TIERS) {
    const btn = button("ps-pick", `🤖 ${AI_LABEL[t]}`);
    btn.setAttribute("aria-label", `电脑难度：${AI_LABEL[t]}，${AI_BLURB[t]}`);
    btn.addEventListener("click", () => {
      api.play("tap");
      tier = t;
      refreshBar();
    });
    pickBtns.push(btn);
    picks.appendChild(btn);
  }

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽残局 · 最好 ${best} 局` : "♾️ 无尽残局";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[tier]}`;
    pickBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(AI_TIERS[i] === tier)));
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    picks.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    picks.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, tier)));
  duoBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, null)));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        picks.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) {
              bar.hidden = false;
              picks.hidden = false;
            }
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "瞄的是目标球后面的那个影子点，不是球心；力度够用就好，母球才停得住。",
      grandMessage: "188 关全部通关，这张球桌上的每条线你都走过一遍啦！",
      guideTitle: "梨康台球 · 出杆手册",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
      releaseCss();
    },
  };
}
