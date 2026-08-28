import { meta } from "./meta";
export { meta };

// 花园国际象棋:8×8 的完整国际象棋,FIDE 关键规则一条不少
// (六种走法 / 王车易位 / 吃过路兵 / 升变四选一 / 将杀 / 逼和 / 50 回合 / 三次重复 / 子力不足)。
//
// 四种玩法共用同一块棋盘 `createBoard`:
//  - 闯关:188 关八章,从兵的走法一路练到四步杀,最后一章还要学会怎么把局面走成和棋;
//  - 人机对战:菜鸟 / 普通 / 高手 / 地狱四档,可以选执白还是执黑;
//  - 无尽:一局接一局的残局连胜,对手逐场加深;
//  - 双人同屏:朵朵执白、星星执黑,可以随时翻转棋盘。
//
// 走法、判胜负、AI 全部自己写,没有走法库、没有 wasm、没有外部引擎,断网照样下。
import { save } from "../../engine/save";
import { mulberry32, mountLevelGame, type GameApi, type PlayCtx } from "../level99";
import { overSceneSVG } from "./art";
import { BLACK, WHITE, type Color } from "./board";
import GUIDE from "./guide";
import {
  CHAPTERS,
  buildLevel,
  endlessAtTop,
  endlessLap,
  endlessStart,
  endlessThinkMs,
  endlessTier,
  loseLine,
  rateLevel,
  winLine,
  type LevelSpec,
} from "./levels";
import { makeMove, toSan, type Move } from "./moves";
import { insufficientMaterial, status, type Game, type Status } from "./rules";
import { AI_BLURB, AI_LABEL, AI_TIERS, TIER_PLAN, chooseMove, forcesMate, type AiTier } from "./search";
import { createBoard, type BoardHandle, type Judgement, type SeatPlan } from "./view";

const DUO: SeatPlan = { name: "朵朵", emoji: "🌸", color: "#F7DCE8", ai: null };
const XING: SeatPlan = { name: "星星", emoji: "⭐", color: "#DCE6F7", ai: null };

function aiSeat(tier: AiTier): SeatPlan {
  return { name: AI_LABEL[tier], emoji: "🤖", color: "#E4E0F2", ai: tier };
}

const SHELL_CSS = `
.cg-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#FBF3E8,#F3F0FA);display:flex;flex-direction:column;gap:8px;}
.cg-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.cg-back{border:none;border-radius:999px;min-height:44px;padding:8px 14px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#8a6a3f;box-shadow:0 3px 0 rgba(150,120,80,.28);}
.cg-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(150,120,80,.28);}
.cg-back:focus-visible,.cg-open:focus-visible,.cg-pick:focus-visible{outline:3px solid #d98c4a;outline-offset:2px;}
.cg-chip{font-size:14px;font-weight:900;color:#7a5f3c;}
.cg-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
.cg-bar[hidden],.cg-picks[hidden]{display:none;}
.cg-open{border:none;border-radius:999px;min-height:44px;padding:9px 15px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#d9a86a,#b8843f);box-shadow:0 4px 0 #97682c;}
.cg-open:active{transform:translateY(2px);box-shadow:0 2px 0 #97682c;}
.cg-open--duo{background:linear-gradient(180deg,#e7a0c0,#c9749c);box-shadow:0 4px 0 #a75b7f;}
.cg-open--en{background:linear-gradient(180deg,#9aa8e0,#6f7fc4);box-shadow:0 4px 0 #56659f;}
.cg-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.cg-pick{border:none;border-radius:14px;min-height:44px;padding:8px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#6e553a;box-shadow:0 3px 0 rgba(160,130,90,.35);}
.cg-pick[aria-pressed="true"]{background:linear-gradient(180deg,#d9a86a,#b8843f);color:#fff;box-shadow:0 3px 0 #97682c;}
.cg-over{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:18px 12px;}
.cg-over-t{font-size:20px;font-weight:900;color:#8a6a3f;}
.cg-over-s{font-size:14px;font-weight:700;color:#5d4a35;line-height:1.6;max-width:340px;}
.cg-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cg-btn{border:none;border-radius:16px;min-height:44px;padding:10px 20px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#d9a86a,#b8843f);box-shadow:0 4px 0 #97682c;}
.cg-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #97682c;}
.cg-over-art{width:min(230px,72vw);margin:0 auto;}
.cg-over-art svg{width:100%;height:auto;display:block;}
/* r5 N-8:矮横屏模式壳的边距收一号,给盘面多让些高 */
@media(min-width:700px) and (max-height:520px){
  .cg-mode{padding:6px 10px;gap:6px;}
}
`;

const SHELL_STYLE_ID = "cg-shell-style";
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
  buttons: Array<{ label: string; onClick: () => void }>,
  artHTML?: string
): void {
  host.innerHTML = "";
  const box = el("div", "cg-over");
  if (artHTML) {
    // 结算插画：赢家的王戴花环，和棋是双王并立加一只白鸽
    const art = el("div", "cg-over-art");
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = artHTML;
    box.appendChild(art);
  }
  box.append(el("div", "cg-over-t", title), el("div", "cg-over-s", sub));
  const row = el("div", "cg-row");
  for (const b of buttons) {
    const btn = button("cg-btn", b.label);
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  host.appendChild(box);
}

// ---------------------------------------------------------------------------
// 闯关:一关一道题
// ---------------------------------------------------------------------------

/**
 * 这一手对不对。规则很简单：
 *  - 规定首着的关卡（易位课 / 过路兵课 / 升变课）第一手必须走那一类；
 *  - 杀棋题：走完之后**还得保得住**剩下步数内的强制杀；
 *  - 和棋题：走完就要变成对应的那种和棋。
 * 玩家想到的杀法和参考解不一样也算对，只要还是强制杀。
 */
export function judgeLevelMove(spec: LevelSpec, move: Move, game: Game): Judgement {
  const pos = game.pos;
  const played = game.history.length;
  if (spec.require && played === 0 && toSan(move, pos) !== spec.solution) {
    return { ok: false, msg: `这一关要用「${spec.title}」那一手开局，再看看提示。` };
  }
  if (spec.kind === "mate") {
    const remaining = Math.max(1, spec.plies - played);
    if (!forcesMate(pos, move, remaining)) return { ok: false, msg: loseLine(spec) };
    return { ok: true };
  }
  if (spec.kind === "repetition") {
    const want = spec.line[played % spec.line.length];
    if (toSan(move, pos) !== want) return { ok: false, msg: "循环走岔了，回到同一个圈里再来一遍。" };
    return { ok: true };
  }
  const next = makeMove(pos, move);
  if (spec.kind === "stalemate") {
    return status(next).kind === "stalemate" ? { ok: true } : { ok: false, msg: loseLine(spec) };
  }
  if (spec.kind === "material") {
    return insufficientMaterial(next) ? { ok: true } : { ok: false, msg: loseLine(spec) };
  }
  // 50 回合：不许吃子、不许动兵，走完刚好数满
  return status(next).kind === "fifty" ? { ok: true } : { ok: false, msg: loseLine(spec) };
}

/** 这一关算不算过了 */
export function levelCleared(spec: LevelSpec, st: Status): boolean {
  if (spec.kind === "mate") return st.kind === "checkmate" && st.winner === WHITE;
  if (spec.kind === "stalemate") return st.kind === "stalemate";
  if (spec.kind === "material") return st.kind === "material";
  if (spec.kind === "fifty") return st.kind === "fifty";
  return st.kind === "repetition";
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const spec = buildLevel(ctx.level);
  const rand = mulberry32(spec.index * 7919 + 13);
  let mistakes = 0;
  let settled = false;
  let board: BoardHandle | null = null;

  const goalText =
    spec.kind === "mate"
      ? `${Math.ceil(spec.plies / 2)} 步之内将杀对方`
      : spec.kind === "stalemate"
        ? "一步走成逼和"
        : spec.kind === "material"
          ? "一步走成子力不足和"
          : spec.kind === "fifty"
            ? "一步把 50 回合和棋定下来"
            : "连将两个循环，走成三次重复和";

  board = createBoard(stage, {
    fen: spec.fen,
    seats: [DUO, aiSeat(spec.tier)],
    banner: `${CHAPTERS[spec.chapterIndex].emoji} 第 ${spec.index + 1} 关 · ${spec.title}`,
    tip: `${goalText}。${spec.hint}`,
    showHints: spec.chapterIndex <= 3,
    allowFlip: false,
    allowResign: false,
    // r5 N-8:重摆钮并进盘面头部工具排,不再挂在盘下面吃「整盘可见」的高预算
    extraTools: [
      {
        label: "♻️ 重摆题面",
        onClick: () => {
          ctx.sfx("tap");
          mistakes++;
          board?.reset(spec.fen);
        },
      },
    ],
    sfx: (n) => ctx.sfx(n),
    aiDelayMs: 260,
    judge: (move, _pos, game) => {
      const verdict = judgeLevelMove(spec, move, game);
      if (!verdict.ok) mistakes++;
      return verdict;
    },
    think: (game) => chooseMove(game.pos, spec.tier, rand),
    onOver: (st) => {
      if (settled) return;
      settled = true;
      if (levelCleared(spec, st)) ctx.win(rateLevel(mistakes), winLine(spec, mistakes));
      else ctx.lose("这一局走岔了，把棋子放回题面重来一次就好。");
    },
  });

  return {
    destroy() {
      settled = true;
      board?.destroy();
      board = null;
    },
  };
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
  const wrap = el("div", "cg-mode");
  const head = el("div", "cg-mhead");
  const back = button("cg-back", "◀ 回选关");
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "cg-chip", title);
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
// 对战:人机四档 / 双人同屏
// ---------------------------------------------------------------------------

interface VersusOptions {
  tier: AiTier | null;
  /** 人执哪一边（双人同屏忽略） */
  side: Color;
}

function mountVersus(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  cfg: VersusOptions
): { destroy: () => void } {
  const label = cfg.tier ? `🤖 人机对战 · ${AI_LABEL[cfg.tier]}` : "👫 双人同屏";
  const shell = makeShell(host, api, onBack, label);
  let round = 1;
  const score: [number, number] = [0, 0];
  let board: BoardHandle | null = null;
  const rand = mulberry32(20260807);

  function seats(): [SeatPlan, SeatPlan] {
    if (cfg.tier === null) return [DUO, XING];
    return cfg.side === WHITE ? [DUO, aiSeat(cfg.tier)] : [aiSeat(cfg.tier), DUO];
  }

  function start(): void {
    board?.destroy();
    board = null;
    shell.stage.innerHTML = "";
    shell.chip.textContent = `${label} · 第 ${round} 局 · ${score[0]}:${score[1]}`;
    board = createBoard(shell.stage, {
      seats: seats(),
      banner: `第 ${round} 局`,
      tip: cfg.tier
        ? `你执${cfg.side === WHITE ? "白" : "黑"}。白方先走，点一个自己的棋子再点落点。`
        : "朵朵执白先走，星星执黑。手机点选，键盘朵朵 WASD+F 选、G 取消；星星 方向键+L 选、K 取消。",
      showHints: true,
      allowFlip: true,
      allowResign: true,
      flipped: cfg.tier !== null && cfg.side === BLACK,
      sfx: (n) => api.play(n),
      think: (game, seat) => {
        const tier = seats()[seat].ai;
        if (tier === null) return null;
        return chooseMove(game.pos, tier, rand);
      },
      onOver: (st) => {
        if (st.winner === WHITE) score[0]++;
        else if (st.winner === BLACK) score[1]++;
        const humanWon = cfg.tier === null ? false : st.winner === cfg.side;
        if (humanWon) {
          api.play("win");
          api.addStars(2);
        }
        const title =
          st.winner === 0 ? "🤝 这一局和棋" : st.winner === WHITE ? "🌸 白方赢了这一局" : "⭐ 黑方赢了这一局";
        const sub = `${st.text} 总比分 白 ${score[0]} : 黑 ${score[1]}。`;
        overBox(
          shell.stage,
          title,
          sub,
          [
            {
              label: "▶ 再来一局",
              onClick: () => {
                api.play("tap");
                round++;
                start();
              },
            },
            {
              label: "◀ 回选关",
              onClick: () => {
                api.play("tap");
                onBack();
              },
            },
          ],
          overSceneSVG(st.winner === 0 ? "draw" : st.winner === WHITE ? "white" : "black")
        );
      },
    });
  }

  start();

  return {
    destroy() {
      board?.destroy();
      board = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:一局接一局的残局连胜
// ---------------------------------------------------------------------------

/**
 * 残局连胜那条 chip 上的字。
 * 对手第 10 局起就封顶了、题面池跑满一轮也会从头再来——
 * 后段不会更难、也不会更新鲜，那就在这里说明白，别让人以为还在加码。
 */
export function endlessChip(round: number, best: number): string {
  const label = AI_LABEL[endlessTier(round)];
  const lap = endlessLap(round);
  const top = endlessAtTop(round) ? " · 已到最高档" : "";
  const laps = lap > 1 ? ` · 题面第 ${lap} 轮` : "";
  return `♾️ 残局连胜 · 第 ${round} 局 · ${label}${top}${laps} · 最好 ${best} 局`;
}

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 残局连胜");
  let round = 1;
  let best = save.getGameProgress(meta.id).endlessBest;
  let board: BoardHandle | null = null;
  const rand = mulberry32(9931);

  function finish(reason: string): void {
    const reached = Math.max(0, round - 1);
    best = save.recordEndlessBest(meta.id, reached);
    board?.destroy();
    board = null;
    api.play("oops");
    overBox(
      shell.stage,
      "♾️ 连胜到此为止",
      `${reason}你连过了 ${reached} 局，最好成绩 ${best} 局。歇口气再来，棋感一会儿就回来了。`,
      [
        {
          label: "🔁 从第 1 局再来",
          onClick: () => {
            api.play("tap");
            round = 1;
            start();
          },
        },
        {
          label: "◀ 回选关",
          onClick: () => {
            api.play("tap");
            onBack();
          },
        },
      ]
    );
  }

  function start(): void {
    board?.destroy();
    board = null;
    shell.stage.innerHTML = "";
    const tier = endlessTier(round);
    const thinkMs = endlessThinkMs(round);
    const atTop = endlessAtTop(round);
    shell.chip.textContent = endlessChip(round, best);
    board = createBoard(shell.stage, {
      fen: endlessStart(round),
      seats: [DUO, aiSeat(tier)],
      banner: `第 ${round} 局 · 对手 ${AI_LABEL[tier]}${atTop ? "（已到最高档）" : ""}`,
      tip: "白方有赢法，找出来把对方将杀。和棋或者输掉，连胜就断了。",
      showHints: round <= 3,
      allowResign: true,
      sfx: (n) => api.play(n),
      think: (game) => chooseMove(game.pos, tier, rand, { timeMs: thinkMs }),
      onOver: (st) => {
        if (st.kind === "checkmate" && st.winner === WHITE) {
          best = save.recordEndlessBest(meta.id, round);
          api.addStars(1);
          api.play("coin");
          round++;
          start();
          return;
        }
        // 自己收的手和被对方翻盘不是一回事,收场话分开说
        finish(
          st.kind === "resign"
            ? st.winner === BLACK
              ? "这一局你先收手了。"
              : "对手先收手了，这一局不按连胜算。"
            : st.winner === 0
              ? "这一局走成和棋了。"
              : "这一局被对方翻过来了。"
        );
      },
    });
  }

  start();

  return {
    destroy() {
      board?.destroy();
      board = null;
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
  const bar = el("div", "cg-bar");
  const picks = el("div", "cg-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let tier: AiTier = 2;
  let side: Color = WHITE;

  const aiBtn = button("cg-open", "🤖 人机对战");
  const duoBtn = button("cg-open cg-open--duo", "👫 双人同屏");
  const endlessBtn = button("cg-open cg-open--en", "♾️ 残局连胜");
  bar.append(aiBtn, duoBtn, endlessBtn);

  const pickBtns: HTMLButtonElement[] = [];
  for (const t of AI_TIERS) {
    const btn = button("cg-pick", `🤖 ${AI_LABEL[t]}`);
    btn.setAttribute("aria-label", `电脑难度：${AI_LABEL[t]}，${AI_BLURB[t]}`);
    btn.addEventListener("click", () => {
      api.play("tap");
      tier = t;
      refreshBar();
    });
    pickBtns.push(btn);
    picks.appendChild(btn);
  }
  const sideBtn = button("cg-pick", "🌸 我执白");
  sideBtn.addEventListener("click", () => {
    api.play("tap");
    side = side === WHITE ? BLACK : WHITE;
    refreshBar();
  });
  picks.appendChild(sideBtn);

  function refreshBar(): void {
    const b = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = b > 0 ? `♾️ 残局连胜 · 最好 ${b} 局` : "♾️ 残局连胜";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[tier]}`;
    sideBtn.textContent = side === WHITE ? "🌸 我执白" : "⭐ 我执黑";
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

  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, { tier, side })));
  duoBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, { tier: null, side: WHITE })));
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
      mapHint: "先数对方的王有几个逃跑格，再决定这一手堵哪一格。",
      grandMessage: "188 关全部通关，六种棋子和三条特殊规则你都拿下了！",
      guideTitle: "花园国际象棋 · 走子手册",
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

/** 四档 AI 的思考参数（模式面板与单测共用） */
export const AI_PLANS = TIER_PLAN;
