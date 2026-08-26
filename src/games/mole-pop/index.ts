import { meta } from "./meta";
export { meta };

// 地鼠嘭嘭:188 关十大地洞闯关 + 无尽地鼠场。
// 1.1 新机制:出题地鼠(算式牌)、连击槽(嘭嘭时间)、护盾鼠(连打两下)、夜视关(月光圈)。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  buildQuizCard,
  CHAPTERS,
  endlessWave,
  LEVELS,
  quizTarget,
  type MoleLevel,
  type QuizCard,
} from "./levels";
import {
  levelTips,
  loseLine,
  roundStars,
  torchHoles,
  usesHearts,
  winLine,
  type RoundResult,
} from "./logic";
import {
  BUNNY_TEXT,
  JUDGE_LABEL,
  MOLE_SPECS,
  TimerBag,
  breakCombo,
  buildChart,
  bunnyPenalty,
  comboMultiplier,
  hitPoints,
  hitScore,
  judgeHit,
  moleTimeline,
  nightMarketChart,
  nightMarketLine,
  nightMarketStall,
  type ChartNote,
  type MoleKind,
} from "./rhythm";

interface HoleState {
  kind: MoleKind | null;
  /** 出题地鼠举的牌子 */
  card: QuizCard | null;
  /** 帽子鼠 / 铁盔鼠已经被敲过几下 */
  hits: number;
  /** 冒头的时刻（本关内的毫秒计时） */
  spawnAt: number;
  /** 这一只的停留期 */
  upMs: number;
  /** 已经在往回缩了（还能擦边打到） */
  dropping: boolean;
}

const CSS = `
.mp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAF6D8, #F7EFD8); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.mp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.mp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #8A7A3E; box-shadow: 0 2px 6px rgba(170,150,90,.25); font-size: 14px; }
.mp-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mp-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #C8E06E, #8FBB4E); border-radius: 8px; transition: width .3s; }
.mp-quiz { text-align: center; font-weight: 900; font-size: 16px; color: #5B5EA6; background: #fff; border-radius: 14px; padding: 6px 10px; margin-bottom: 8px; box-shadow: 0 2px 6px rgba(120,120,200,.22); }
.mp-quiz b { font-size: 21px; color: #C2456F; }
.mp-combo { height: 9px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mp-combofill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFC46B, #F0714A); border-radius: 8px; transition: width .2s; }
.mp-combo.mp-combo-on .mp-combofill { background: linear-gradient(90deg, #FF9A3C, #E8452C); animation: mpBlaze .5s ease infinite alternate; }
@keyframes mpBlaze { from { opacity: .7; } to { opacity: 1; } }
.mp-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.mp-hole { aspect-ratio: 1; min-width: 56px; min-height: 56px; border: none; border-radius: 50%; cursor: pointer; font-size: clamp(30px, 11vw, 52px); background: radial-gradient(circle at 50% 62%, #9A7B4F 0 42%, #C9A876 46% 60%, #E4D3AE 64%); display: flex; align-items: center; justify-content: center; padding: 0; transition: transform .08s, filter .3s; }
.mp-hole:active { transform: scale(.93); }
/* 命中不震屏,只让洞口轻轻下沉三帧 */
.mp-hole.mp-sink { transform: translateY(3px) scale(.97); }
.mp-hole .mp-face { transform: translateY(6px); animation: mpUp .18s ease; }
/* 缩回中:还能擦边打到,所以要看得见它在往下走 */
.mp-hole .mp-face-drop { transform: translateY(22px); opacity: .55; }
.mp-hole .mp-card { font-size: clamp(15px, 5.4vw, 24px); font-weight: 900; color: #4A4A7A; background: #FFF8E4; border-radius: 10px; padding: 3px 7px; box-shadow: 0 2px 5px rgba(90,80,50,.3); }
@keyframes mpUp { from { transform: translateY(26px); opacity: .4; } to { transform: translateY(6px); opacity: 1; } }
.mp-wrap.mp-night { background: linear-gradient(180deg, #2B2C46, #3C3A55); }
.mp-wrap.mp-night .mp-badge { background: #4B4A6B; color: #FFF0C0; }
.mp-wrap.mp-night .mp-msg { color: #FFE9A8; }
.mp-wrap.mp-night .mp-hole { filter: brightness(.32); }
.mp-wrap.mp-night .mp-hole.mp-lit { filter: none; box-shadow: 0 0 16px 7px rgba(255,240,170,.8); }
.mp-msg { text-align: center; min-height: 20px; color: #8A7A3E; font-weight: 700; margin-top: 10px; font-size: 14px; }
.mp-bar-modes { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 0 0 10px; }
.mp-open { border: none; border-radius: 999px; padding: 9px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #8FBB4E, #6F9C36); box-shadow: 0 4px 0 #567A28; }
.mp-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #567A28; }
.mp-mode { max-width: 680px; margin: 0 auto; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.mp-mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
.mp-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #6F8C42; box-shadow: 0 3px 0 rgba(110,150,60,.3); }
.mp-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(110,150,60,.3); }
.mp-chip { background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 800; font-size: 14px; color: #6F8C42; box-shadow: 0 2px 6px rgba(130,170,90,.25); }
.mp-over { text-align: center; padding: 26px 16px; background: #fff; border-radius: 18px; box-shadow: 0 4px 14px rgba(150,170,110,.25); }
.mp-over-t { font-size: 22px; font-weight: 900; color: #6F8C42; margin-bottom: 8px; }
.mp-over-s { font-size: 15px; font-weight: 700; color: #8A7A3E; line-height: 1.6; margin-bottom: 14px; }
@media (max-width: 380px) { .mp-board { gap: 12px; } .mp-badge { font-size: 14px; padding: 4px 8px; } }
@media (prefers-reduced-motion: reduce) {
  .mp-hole .mp-face { animation: none; }
  .mp-hole.mp-sink { transform: none; }
  .mp-combo.mp-combo-on .mp-combofill { animation: none; }
}
`;

interface RoundOpts {
  cfg: MoleLevel;
  /** 顶部左边那颗徽章前面的小标题，例如「♾️ 第 3 波」 */
  banner?: string;
  /** 本轮的谱面；不给就按 cfg 现生成一张（同一关每次都一样，便于练） */
  chart?: ChartNote[];
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onDone: (result: RoundResult) => void;
}

/** 谱面推进的心跳（毫秒）：够细，摸得出 120ms 的 Perfect 窗口 */
const TICK_MS = 40;

/**
 * 一轮地鼠：闯关关卡和无尽波次共用这一套。
 * 结束时通过 onDone 交出战报，由外面决定是过关、下一波还是收摊。
 */
function createRound(stage: HTMLElement, opts: RoundOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  const bag = new TimerBag();
  const chart = opts.chart ?? buildChart(cfg, 1, 0);
  let cursor = 0;
  /** 本关已经走了多少毫秒（谱面按它推进） */
  let clockMs = 0;
  let destroyed = false;
  let ended = false;
  let score = 0;
  /** 手感分：判定档 × 连击倍率，只影响演出与结算文案，不动过关线 */
  let styleScore = 0;
  let mistakes = 0;
  let streak = 0;
  let bestCombo = 0;
  let blazeUntil = 0;
  let timeLeft = cfg.duration;
  let torchCenter = 4;
  let quizNow = cfg.quizChance ? quizTarget(Math.max(0, cfg.target - 8), Math.random) : 0;
  const holes: HoleState[] = Array.from({ length: 9 }, () => ({
    kind: null,
    card: null,
    hits: 0,
    spawnAt: 0,
    upMs: 0,
    dropping: false,
  }));

  const wrap = document.createElement("div");
  wrap.className = `mp-wrap${cfg.night ? " mp-night" : ""}`;
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mp-top">
      <span class="mp-badge mp-score">🔨 0 / ${cfg.target}</span>
      <span class="mp-badge mp-time">⏰ ${cfg.duration}s</span>
      <span class="mp-badge mp-style">✨ 手感 0 · ×1</span>
      ${opts.banner ? `<span class="mp-badge mp-banner">${opts.banner}</span>` : ""}
      ${usesHearts(cfg) ? '<span class="mp-badge mp-heart">💗💗💗</span>' : ""}
    </div>
    ${cfg.quizChance ? '<div class="mp-quiz">🧮 这一轮请拍出 <b class="mp-qnum">0</b></div>' : ""}
    <div class="mp-bar"><div class="mp-fill"></div></div>
    ${cfg.comboTarget ? '<div class="mp-combo"><div class="mp-combofill"></div></div>' : ""}
    <div class="mp-board"></div>
    <div class="mp-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".mp-board") as HTMLElement;
  const scoreEl = wrap.querySelector(".mp-score") as HTMLElement;
  const timeEl = wrap.querySelector(".mp-time") as HTMLElement;
  const styleEl = wrap.querySelector(".mp-style") as HTMLElement;
  const heartEl = wrap.querySelector(".mp-heart") as HTMLElement | null;
  const fillEl = wrap.querySelector(".mp-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mp-msg") as HTMLElement;
  const quizNumEl = wrap.querySelector(".mp-qnum") as HTMLElement | null;
  const comboEl = wrap.querySelector(".mp-combo") as HTMLElement | null;
  const comboFillEl = wrap.querySelector(".mp-combofill") as HTMLElement | null;

  msgEl.textContent = levelTips(cfg);

  function later(fn: () => void, ms: number): void {
    bag.after(() => {
      if (!destroyed) fn();
    }, ms);
  }

  const holeEls: HTMLButtonElement[] = [];
  for (let i = 0; i < 9; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mp-hole";
    btn.addEventListener("click", () => onHole(i));
    boardEl.appendChild(btn);
    holeEls.push(btn);
  }

  function blazing(): boolean {
    return blazeUntil > Date.now();
  }

  function renderHole(i: number): void {
    const h = holes[i];
    if (!h.kind) {
      holeEls[i].innerHTML = "";
      return;
    }
    const dropCls = h.dropping ? " mp-face-drop" : "";
    if (h.kind === "quiz" && h.card) {
      holeEls[i].innerHTML = `<span class="mp-face mp-card${dropCls}">${h.card.expr}</span>`;
      return;
    }
    if ((h.kind === "shield" || h.kind === "hat") && h.hits > 0) {
      holeEls[i].innerHTML = `<span class="mp-face${dropCls}">🐹</span>`;
      return;
    }
    holeEls[i].innerHTML = `<span class="mp-face${dropCls}">${MOLE_SPECS[h.kind].emoji}</span>`;
  }

  function renderTorch(): void {
    if (!cfg.night) return;
    const lit = new Set(torchHoles(torchCenter));
    holeEls.forEach((el, i) => el.classList.toggle("mp-lit", lit.has(i)));
  }

  function renderTop(): void {
    scoreEl.textContent = `🔨 ${score} / ${cfg.target}`;
    timeEl.textContent = `⏰ ${timeLeft}s`;
    styleEl.textContent = `✨ 手感 ${styleScore} · ×${comboMultiplier(streak)}`;
    if (heartEl) heartEl.textContent = "💗".repeat(Math.max(0, 3 - mistakes)) + "🤍".repeat(Math.min(3, mistakes));
    fillEl.style.width = `${Math.min(100, (score / cfg.target) * 100)}%`;
    if (quizNumEl) quizNumEl.textContent = String(quizNow);
    if (comboEl && comboFillEl && cfg.comboTarget) {
      const on = blazing();
      comboEl.classList.toggle("mp-combo-on", on);
      comboFillEl.style.width = on ? "100%" : `${Math.min(100, (streak / cfg.comboTarget) * 100)}%`;
    }
  }

  function hideMole(i: number): void {
    const h = holes[i];
    h.kind = null;
    h.card = null;
    h.hits = 0;
    h.dropping = false;
    renderHole(i);
  }

  function anyCorrectUp(): boolean {
    return holes.some((h) => h.kind === "quiz" && h.card?.correct);
  }

  function nextQuiz(): void {
    quizNow = quizTarget(Math.max(0, cfg.target - 8), Math.random);
    // 换题时把台面上的旧牌子收走,免得孩子照着上一轮的答案拍
    holes.forEach((h, i) => { if (h.kind === "quiz") hideMole(i); });
  }

  /** 谱面里的一只上场:洞被占了就就近换一个空洞,一个都没有就跳过这一拍 */
  function spawnNote(note: ChartNote): void {
    if (ended || destroyed) return;
    if (holes.filter((h) => h.kind !== null).length >= cfg.maxConcurrent) return;
    let i = note.hole;
    if (holes[i].kind !== null) {
      const free = holes.map((h, k) => (h.kind === null ? k : -1)).filter((k) => k >= 0);
      if (free.length === 0) return;
      i = free[Math.floor(Math.random() * free.length)];
    }
    const h = holes[i];
    h.kind = note.kind;
    h.card = note.kind === "quiz" ? buildQuizCard(quizNow, !anyCorrectUp() || Math.random() < 0.45, Math.random) : null;
    h.hits = 0;
    h.spawnAt = clockMs;
    h.upMs = note.upMs;
    h.dropping = false;
    renderHole(i);
  }

  /** 每一拍:把到点的地鼠放上来,把该缩的缩回去(漏打的清连击) */
  function tick(): void {
    if (ended || destroyed) return;
    clockMs += TICK_MS;
    while (cursor < chart.length && chart[cursor].at <= clockMs) spawnNote(chart[cursor++]);
    holes.forEach((h, i) => {
      if (!h.kind) return;
      const line = moleTimeline(h.spawnAt, h.upMs);
      if (clockMs >= line.goneAt) {
        const missed = MOLE_SPECS[h.kind].hittable;
        hideMole(i);
        if (missed && streak > 0) {
          streak = breakCombo();
          renderTop();
        }
        return;
      }
      if (!h.dropping && clockMs >= line.dropAt) {
        h.dropping = true;
        renderHole(i);
      }
    });
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    holes.forEach((_, i) => hideMole(i));
    const result: RoundResult = { won, score, mistakes, timeLeft, bestCombo };
    later(() => opts.onDone(result), 350);
  }

  function scored(gain: number): void {
    score += blazing() ? gain * 2 : gain;
    streak++;
    bestCombo = Math.max(bestCombo, streak);
    if (cfg.comboTarget && streak >= cfg.comboTarget) {
      streak = 0;
      blazeUntil = Date.now() + (cfg.comboMs ?? 5000);
      opts.sfx("coin");
      msgEl.textContent = "🔥 嘭嘭时间！这一小会儿一只顶两只！";
      later(() => { if (!ended) renderTop(); }, (cfg.comboMs ?? 5000) + 60);
    }
    renderTop();
    if (score >= cfg.target) finish(true);
  }

  function stumble(msg: string): void {
    mistakes++;
    streak = breakCombo();
    opts.sfx("oops");
    msgEl.textContent = msg;
    renderTop();
    if (mistakes >= 3) finish(false);
  }

  function onHole(i: number): void {
    if (ended) return;
    const h = holes[i];
    if (!h.kind) {
      opts.sfx("tap");
      return;
    }
    if (h.kind === "bunny") {
      hideMole(i);
      // 花花兔不参加游戏:扣一分、断连击,但话说得温和,不批评
      score = bunnyPenalty(score);
      stumble(BUNNY_TEXT);
      return;
    }

    const judge = judgeHit(clockMs - h.spawnAt, h.upMs);
    if (judge === "miss") {
      opts.sfx("tap");
      return;
    }

    if (h.kind === "quiz") {
      const card = h.card;
      hideMole(i);
      if (card?.correct) {
        opts.sfx("pop");
        msgEl.textContent = `🧮 ${card.expr} = ${quizNow}，算得真准！`;
        award(judge, 1);
        if (!ended) nextQuiz();
      } else {
        stumble(`这只举的是 ${card?.expr ?? "别的算式"}，得数不是 ${quizNow}，再找找看～`);
      }
      return;
    }

    const spec = MOLE_SPECS[h.kind];
    if (spec.hits > 1 && h.hits === 0) {
      h.hits = 1;
      opts.sfx("tap");
      msgEl.textContent = h.kind === "hat" ? "🎩 帽子飞啦，再补一下！" : "🪖 头盔掀掉啦，再补一下！";
      renderHole(i);
      return;
    }

    opts.sfx(spec.base >= 2 ? "coin" : "pop");
    const kindLine =
      h.kind === "gold"
        ? "🌟 金地鼠 +2！"
        : h.kind === "shield"
          ? "🛡️ 铁盔鼠拿下 +2！"
          : h.kind === "hat"
            ? "🎩 帽子鼠拿下 +2！"
            : h.kind === "flash"
              ? "✨ 闪光鼠!手真快!"
              : "";
    msgEl.textContent = `${kindLine}${kindLine ? " · " : ""}${JUDGE_LABEL[judge]}`;
    sink(i);
    hideMole(i);
    award(judge, spec.base);
  }

  /** 命中顿感:洞口轻轻下沉三帧就收,不震屏 */
  function sink(i: number): void {
    holeEls[i].classList.add("mp-sink");
    bag.after(() => holeEls[i].classList.remove("mp-sink"), 3 * 16);
  }

  /** 记一次命中:过关线按底分算(和 1.1 一样),判定档与连击只加手感分 */
  function award(judge: ReturnType<typeof judgeHit>, base: number): void {
    styleScore += hitScore(judge, base) * comboMultiplier(streak);
    scored(hitPoints(judge, base));
  }

  bag.every(() => {
    if (ended || destroyed) return;
    timeLeft--;
    renderTop();
    if (timeLeft <= 0) finish(score >= cfg.target);
  }, 1000);

  bag.every(tick, TICK_MS);

  if (cfg.night) {
    renderTorch();
    bag.every(() => {
      torchCenter = Math.floor(Math.random() * 9);
      renderTorch();
    }, Math.max(1200, cfg.torchMs ?? 2400));
  }
  renderTop();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      bag.clearAll();
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MoleLevel = LEVELS[ctx.level];
  const round = createRound(stage, {
    cfg,
    // 每一关的谱面由关号定种子:同一关每次都是同一张,练熟了就能背下来
    chart: buildChart(cfg, ctx.level * 7919 + 1, ctx.level),
    sfx: ctx.sfx,
    onDone: (result) => {
      if (result.won) ctx.win(roundStars(result, cfg.duration), winLine(cfg, result));
      else ctx.lose(loseLine(cfg, result));
    },
  });
  return { destroy: () => round.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽地鼠场
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "mp-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "mp-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mp-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "mp-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let wave = 1;
  let round: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(sub: string): void {
    round?.destroy();
    round = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "mp-over";
    box.innerHTML = `<div class="mp-over-t">地鼠们回家啦</div><div class="mp-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "mp-open";
    again.textContent = "🔁 从第 1 摊再来";
    again.addEventListener("click", () => {
      api.play("tap");
      wave = 1;
      startWave();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startWave(): void {
    round?.destroy();
    stage.innerHTML = "";
    chip.textContent = `🏮 ${nightMarketStall(wave)} · 第 ${wave} 摊 · 最好 ${best} 摊`;
    const cfg = endlessWave(wave);
    round = createRound(stage, {
      cfg,
      banner: `🏮 第 ${wave} 摊`,
      chart: nightMarketChart(cfg, wave, Math.floor(Math.random() * 1e6) + 1),
      sfx: (n) => api.play(n),
      onDone: (result) => {
        if (result.won) {
          best = save.recordEndlessBest(meta.id, wave);
          api.addStars(1);
          wave++;
          startWave();
        } else {
          const reached = Math.max(0, wave - 1);
          best = save.recordEndlessBest(meta.id, reached);
          showOver(nightMarketLine(reached, best));
        }
      },
    });
  }

  startWave();

  return {
    destroy() {
      round?.destroy();
      round = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "mp-bar-modes";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "mp-open";
  bar.appendChild(endlessBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `🏮 无尽地鼠夜市 · 最好 ${best} 摊` : "🏮 无尽地鼠夜市 · 点我开锤！";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  endlessBtn.addEventListener("click", () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "命中率满分、再留点时间，3 星就到手！",
      grandMessage: "188 关地鼠全部拍完，你的反应和判断都练出来了！",
      guideTitle: "地鼠嘭嘭 · 锤子手册",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
