import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { save } from "../../engine/save";
import { CHAPTERS, LEVELS, type TapLevel } from "./levels";
import {
  ENDLESS_LIVES,
  FREEZE_FACTOR,
  FREEZE_ROUNDS,
  adaptiveAiDelay,
  endlessAiDelay,
  endlessDotCount,
  endlessTrapChance,
  inCombo,
  isNewRecord,
  mechanicsOf,
  pointsFor,
  sequenceGrace,
  sequenceLabels
} from "./logic";

/** 各主题的「该抢的点」与「陷阱点」外观 */
const SKINS = [
  { mine: "🔵", trap: "🔴" },
  { mine: "🔵", trap: "🔴" },
  { mine: "⭐", trap: "🌑" },
  { mine: "⚡", trap: "🌩️" },
  { mine: "💙", trap: "❤️" },
  { mine: "👑", trap: "💣" },
  // 1.1 新章
  { mine: "💠", trap: "🟥" },
  { mine: "🔷", trap: "🟪" },
  { mine: "🟦", trap: "🟫" },
  { mine: "🌟", trap: "💣" },
];

/** 道具点：❄️ 冻住对手一会儿，🧲 把下一个点直接吸过来 */
const POWER_SKIN = { freeze: "❄️", magnet: "🧲" };

const CSS = `
.rbt-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4F0FF, #FFE9F0); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbt-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
.rbt-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 5px 12px; font-weight: 800; font-size: 15px; box-shadow: 0 2px 6px rgba(120,140,200,.25); }
.rbt-badge.rbt-me { padding: 4px 12px 4px 4px; }
.rbt-badge.rbt-ai { padding: 4px 4px 4px 12px; }
.rbt-ava { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; box-shadow: 0 1px 4px rgba(100,120,180,.3); }
.rbt-me { color: #3576BF; }
.rbt-ai { color: #C24545; }
.rbt-gear { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 8px; min-height: 20px; }
.rbt-chip { background: #ffffffd6; border-radius: 999px; padding: 3px 11px; font-size: 13px; font-weight: 800; color: #5B7FC9; box-shadow: 0 2px 5px rgba(110,130,190,.2); }
.rbt-chip-hot { background: linear-gradient(180deg, #FFD9EC, #FFC2DF); color: #B23B76; }
.rbt-arena { position: relative; height: 320px; border-radius: 16px; background: #ffffffa8; overflow: hidden; }
.rbt-dot { position: absolute; width: 62px; height: 62px; border: none; background: #fff; border-radius: 50%; font-size: 34px; cursor: pointer; box-shadow: 0 4px 10px rgba(100,120,180,.3); padding: 0; animation: rbtIn .18s ease; }
@keyframes rbtIn { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.rbt-dot:active { transform: scale(.88); }
.rbt-dot:focus-visible { outline: 3px solid #2F4E86; outline-offset: 3px; }
.rbt-dot-num { position: absolute; right: -2px; bottom: -2px; min-width: 24px; height: 24px; border-radius: 12px; background: #fff; color: #3576BF; font-size: 15px; font-weight: 900; line-height: 24px; box-shadow: 0 2px 5px rgba(90,110,170,.35); }
.rbt-dot-next .rbt-dot-num { background: #FFD24D; color: #7A4B00; }
.rbt-dot-done { opacity: .35; filter: grayscale(1); }
.rbt-msg { text-align: center; min-height: 22px; color: #5B7FC9; font-weight: 700; margin-top: 10px; font-size: 15px; }
@media (max-width: 420px) {
  .rbt-arena { height: 280px; }
  .rbt-dot { width: 56px; height: 56px; font-size: 30px; }
}
`;

const ENDLESS_CSS = `
.rte-bar { display: flex; justify-content: center; margin: 0 0 10px; }
.rte-open { border: none; border-radius: 999px; padding: 10px 20px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 4px 0 #3B55C2; }
.rte-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #3B55C2; }
.rte-open:focus-visible { outline: 3px solid #263E7A; outline-offset: 3px; }
.rte-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.rte-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #3F5C9A; box-shadow: 0 3px 0 rgba(90,110,170,.28); }
.rte-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(90,110,170,.28); }
.rte-over { position: absolute; inset: 0; border-radius: 16px; background: rgba(248,251,255,.96); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rte-over-title { font-size: 22px; font-weight: 900; color: #3F5C9A; }
.rte-over-sub { font-size: 15px; font-weight: 700; color: #5E729B; line-height: 1.6; max-width: 300px; }
.rte-btn { border: none; border-radius: 18px; padding: 12px 24px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rte-btn.rte-ghost { background: linear-gradient(180deg, #F0A0C0, #DB6E9B); box-shadow: 0 5px 0 #B14E79; }
.rte-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #3B55C2; }
`;

type DotKind = "mine" | "trap" | "freeze" | "magnet";

interface Dot {
  el: HTMLButtonElement;
  kind: DotKind;
  /** 序列点的号码（1 基），普通点为 0 */
  label: number;
  aiTimer: ReturnType<typeof setTimeout> | null;
  gone: boolean;
}

function placeDot(el: HTMLElement): void {
  el.style.left = `${6 + Math.random() * 72}%`;
  el.style.top = `${6 + Math.random() * 72}%`;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: TapLevel = LEVELS[ctx.level];
  const skin = SKINS[cfg.theme] ?? SKINS[0];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let meScore = 0;
  let aiScore = 0;
  let streak = 0;
  let frozen = 0;
  let magnetReady = false;
  /** 序列链：下一个该拍的号码（1 基），0 表示这一轮不是序列链 */
  let seqNext = 0;
  const dots = new Set<Dot>();
  const gears = mechanicsOf(cfg);

  const wrap = document.createElement("div");
  wrap.className = "rbt-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="rbt-top">
      <span class="rbt-badge rbt-me"><img class="rbt-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" /><span class="rbt-me-score">朵朵(你) 0</span></span>
      <span class="rbt-badge">先到 ${cfg.targetPoints} 分</span>
      <span class="rbt-badge rbt-ai"><span class="rbt-ai-score">星星(电脑) 0</span><img class="rbt-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
    </div>
    ${gears.length ? `<div class="rbt-gear"></div>` : ""}
    <div class="rbt-arena"></div>
    <div class="rbt-msg"></div>
  `;
  stage.appendChild(wrap);

  const arenaEl = wrap.querySelector(".rbt-arena") as HTMLElement;
  const meEl = wrap.querySelector(".rbt-me-score") as HTMLElement;
  const aiEl = wrap.querySelector(".rbt-ai-score") as HTMLElement;
  const msgEl = wrap.querySelector(".rbt-msg") as HTMLElement;
  const gearEl = wrap.querySelector(".rbt-gear") as HTMLElement | null;

  let comboChip: HTMLElement | null = null;
  if (gearEl) {
    for (const name of gears) {
      const chip = document.createElement("span");
      chip.className = "rbt-chip";
      chip.textContent =
        name === "连击加成"
          ? `💫 连抢 ${cfg.comboNeed} 个进连击`
          : name === "道具点"
            ? "🧲 场上会冒道具点"
            : name === "序列抢点"
              ? `🔢 按 1→${cfg.sequence} 的顺序拍`
              : "🧠 小电脑会读招";
      gearEl.appendChild(chip);
      if (name === "连击加成") comboChip = chip;
    }
  }

  msgEl.textContent = gears.length
    ? `本关新玩法：${gears.join(" + ")}，看清楚再出手！`
    : cfg.trapChance > 0
      ? `抢 ${skin.mine}，${skin.trap} 是陷阱别碰！`
      : `${skin.mine} 一冒出来就抢先拍！`;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderTop(): void {
    meEl.textContent = `朵朵(你) ${meScore}`;
    aiEl.textContent = `星星(电脑) ${aiScore}`;
    if (comboChip) {
      const hot = inCombo(streak, cfg);
      comboChip.classList.toggle("rbt-chip-hot", hot);
      comboChip.textContent = hot ? `💫 连击 ${streak} · 双倍分！` : `💫 连抢 ${cfg.comboNeed} 个进连击（${streak}）`;
    }
  }

  function clearDots(): void {
    dots.forEach((d) => {
      if (d.aiTimer) clearTimeout(d.aiTimer);
      d.el.remove();
    });
    dots.clear();
  }

  function finish(): void {
    if (ended) return;
    ended = true;
    clearDots();
    if (meScore >= cfg.targetPoints) {
      const got = aiScore <= 2 ? 3 : aiScore <= cfg.targetPoints - 2 ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `${meScore} 比 ${aiScore}，朵朵队赢下这一局，抢点的判断很到位！`), 400);
    } else {
      later(() => ctx.lose("这局星星队分数高一点～视线放在屏幕中间用余光扫，连击一起来分数就追上了！"), 400);
    }
  }

  /** 记分：mine=true 是你得分，stake 是这一下值几个基础分 */
  function score(mine: boolean, stake: number, msg?: string): void {
    if (ended) return;
    if (mine) {
      meScore += pointsFor(streak, stake, cfg);
      streak++;
      ctx.sfx("coin");
    } else {
      aiScore += stake;
      streak = 0;
      ctx.sfx("oops");
    }
    if (msg) msgEl.textContent = msg;
    renderTop();
    if (meScore >= cfg.targetPoints || aiScore >= cfg.targetPoints) {
      finish();
      return;
    }
    if (dots.size === 0) later(spawnRound, 520);
  }

  function removeDot(d: Dot): void {
    d.gone = true;
    if (d.aiTimer) clearTimeout(d.aiTimer);
    d.el.remove();
    dots.delete(d);
  }

  /** 本轮小电脑的出手时间：读招 + 冻结都算进去 */
  function roundDelay(): number {
    let delay = adaptiveAiDelay(cfg, meScore, aiScore);
    if (frozen > 0) delay *= FREEZE_FACTOR;
    return delay;
  }

  function makeDot(kind: DotKind, label: number): Dot {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "rbt-dot";
    el.textContent =
      kind === "freeze" ? POWER_SKIN.freeze : kind === "magnet" ? POWER_SKIN.magnet : kind === "trap" ? skin.trap : skin.mine;
    if (label > 0) {
      const tag = document.createElement("span");
      tag.className = "rbt-dot-num";
      tag.textContent = String(label);
      el.appendChild(tag);
      el.setAttribute("aria-label", `${label} 号点`);
    }
    placeDot(el);
    const d: Dot = { el, kind, label, aiTimer: null, gone: false };
    arenaEl.appendChild(el);
    dots.add(d);
    return d;
  }

  function markSeqNext(): void {
    dots.forEach((d) => d.el.classList.toggle("rbt-dot-next", d.label === seqNext));
  }

  /** 普通轮：一到两个可抢的点 + 可能的陷阱点，小电脑到点就抢 */
  function spawnNormalRound(): void {
    const delay = roundDelay();
    if (frozen > 0) {
      frozen--;
      msgEl.textContent = "❄️ 小电脑被冻住啦，趁现在多抢几个！";
    }
    const count = cfg.double ? 2 : 1;
    const kinds: DotKind[] = [];
    for (let i = 0; i < count; i++) kinds.push(Math.random() < cfg.trapChance ? "trap" : "mine");
    // 保证每轮至少有一个能抢的点
    if (!kinds.some((k) => k === "mine")) kinds.push("mine");

    for (const kind of kinds) {
      const d = makeDot(kind, 0);
      d.aiTimer = setTimeout(() => {
        if (destroyed || ended || d.gone) return;
        removeDot(d);
        if (kind === "mine") {
          score(false, 1, "被小电脑抢走啦，再快一点！");
        } else if (dots.size === 0 && !ended) {
          later(spawnRound, 400);
        }
      }, kind === "trap" ? delay * 1.6 : delay + Math.random() * 200);
      d.el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended || d.gone) return;
        removeDot(d);
        if (kind === "trap") {
          score(false, 1, `碰到 ${skin.trap} 啦，这可是陷阱！`);
        } else {
          ctx.sfx("pop");
          score(true, 1, inCombo(streak + 1, cfg) ? "连击中，双倍分！" : "抢到！");
        }
      });
    }
  }

  /** 道具轮：只冒一个 ❄️ 或 🧲，抢到手才有用，错过就没了 */
  function spawnPowerRound(): void {
    const kind: DotKind = Math.random() < 0.5 ? "freeze" : "magnet";
    const d = makeDot(kind, 0);
    const delay = roundDelay();
    d.aiTimer = setTimeout(() => {
      if (destroyed || ended || d.gone) return;
      removeDot(d);
      msgEl.textContent = "道具点飞走啦，下一个别错过！";
      later(spawnRound, 380);
    }, delay + 260);
    d.el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (ended || d.gone) return;
      removeDot(d);
      ctx.sfx("pop");
      if (kind === "freeze") {
        frozen = FREEZE_ROUNDS;
        msgEl.textContent = "❄️ 冻住小电脑！接下来两轮它慢半拍！";
      } else {
        magnetReady = true;
        msgEl.textContent = "🧲 磁铁到手！下一个点自动吸过来！";
      }
      later(spawnRound, 380);
    });
  }

  /** 磁铁轮：下一个点不用比手速，自己飞过来 */
  function spawnMagnetRound(): void {
    magnetReady = false;
    const d = makeDot("mine", 0);
    d.el.classList.add("rbt-dot-next");
    later(() => {
      if (destroyed || ended || d.gone) return;
      removeDot(d);
      ctx.sfx("pop");
      score(true, 1, "🧲 磁铁把它吸过来啦！");
    }, 420);
  }

  /** 序列轮：号码点一次全冒出来，必须 1→2→3 按顺序拍，拍错就把分让出去 */
  function spawnSequenceRound(chain: number): void {
    const delay = roundDelay() + sequenceGrace(chain);
    if (frozen > 0) frozen--;
    seqNext = 1;
    const labels = sequenceLabels(chain);
    const created: Dot[] = labels.map((n) => makeDot("mine", n));
    markSeqNext();

    const expire = setTimeout(() => {
      if (destroyed || ended) return;
      created.forEach((d) => { if (!d.gone) removeDot(d); });
      seqNext = 0;
      score(false, 1, "号码还没拍完就被抢走啦，先看清顺序再动手！");
    }, delay);
    timeouts.add(expire);

    for (const d of created) {
      d.aiTimer = null;
      d.el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended || d.gone || seqNext === 0) return;
        if (d.label !== seqNext) {
          const want = seqNext;
          clearTimeout(expire);
          timeouts.delete(expire);
          created.forEach((x) => { if (!x.gone) removeDot(x); });
          seqNext = 0;
          score(false, 1, `这一串轮到 ${want} 号啦，慢一点看清号码，下一串一定拍得对！`);
          return;
        }
        d.el.classList.add("rbt-dot-done");
        removeDot(d);
        ctx.sfx("pop");
        seqNext++;
        markSeqNext();
        if (seqNext > chain) {
          clearTimeout(expire);
          timeouts.delete(expire);
          seqNext = 0;
          score(true, chain, `${chain} 个号码一次拍对，漂亮！`);
        }
      });
    }
  }

  function spawnRound(): void {
    if (ended || destroyed || dots.size > 0) return;
    if (magnetReady) {
      spawnMagnetRound();
      return;
    }
    if ((cfg.powerChance ?? 0) > 0 && Math.random() < (cfg.powerChance ?? 0)) {
      spawnPowerRound();
      return;
    }
    const chain = cfg.sequence ?? 0;
    if (chain > 1) {
      spawnSequenceRound(chain);
      return;
    }
    spawnNormalRound();
  }

  later(spawnRound, 700);
  renderTop();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      clearDots();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽模式「霓虹抢点」：一轮比一轮快，丢完三颗爱心就结束
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let over = false;
  let round = 0;
  let score = 0;
  let streak = 0;
  let lives = ENDLESS_LIVES;
  let best = save.getGameProgress(meta.id).endlessBest;
  const live = new Set<Dot>();

  const wrap = document.createElement("div");
  wrap.className = "rbt-wrap";
  wrap.innerHTML = `
    <style>${CSS}${ENDLESS_CSS}</style>
    <div class="rte-head">
      <button class="rte-back" type="button">🗺️ 回关卡</button>
      <span class="rbt-chip rte-score">0 分</span>
      <span class="rbt-chip rte-lives"></span>
      <span class="rbt-chip rte-best"></span>
    </div>
    <div class="rbt-arena"></div>
    <div class="rbt-msg">抢到 🌟 加分，碰到 💣 扣一颗心，被抢走也扣一颗心！</div>
  `;
  host.appendChild(wrap);

  const arenaEl = wrap.querySelector(".rbt-arena") as HTMLElement;
  const scoreEl = wrap.querySelector(".rte-score") as HTMLElement;
  const livesEl = wrap.querySelector(".rte-lives") as HTMLElement;
  const bestEl = wrap.querySelector(".rte-best") as HTMLElement;
  const msgEl = wrap.querySelector(".rbt-msg") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderTop(): void {
    scoreEl.textContent = `${score} 分${streak >= 4 ? " · 连击双倍" : ""}`;
    livesEl.textContent = "❤️".repeat(Math.max(0, lives)) || "💔";
    bestEl.textContent = best > 0 ? `🏅 最高 ${best}` : "🏅 还没有纪录";
  }

  function clearDots(): void {
    live.forEach((d) => {
      if (d.aiTimer) clearTimeout(d.aiTimer);
      d.el.remove();
    });
    live.clear();
  }

  function loseHeart(msg: string): void {
    lives--;
    api.play("oops");
    streak = 0;
    msgEl.textContent = msg;
    renderTop();
    if (lives <= 0) finish();
    else if (live.size === 0) later(spawnRound, 460);
  }

  function finish(): void {
    if (over) return;
    over = true;
    clearDots();
    const record = isNewRecord(score, best);
    if (record) best = save.recordEndlessBest(meta.id, score);
    const bonus = Math.min(6, Math.floor(score / 15));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");

    const ov = document.createElement("div");
    ov.className = "rte-over";
    ov.innerHTML = `
      <div style="font-size:46px;line-height:1">${record ? "🏅" : "💫"}</div>
      <div class="rte-over-title">${record ? `新纪录 ${score} 分！` : `这轮拿了 ${score} 分`}</div>
      <div class="rte-over-sub">${
        record
          ? `撑到第 ${round} 轮，眼神和手速都很稳！${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`
          : `最高纪录 ${best} 分，再来一轮就有机会追上它！${bonus > 0 ? `这轮也拿到 ${bonus} 颗小星星。` : ""}`
      }</div>
    `;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "rte-btn";
    again.textContent = "🔁 再抢一轮";
    again.addEventListener("click", () => {
      api.play("tap");
      ov.remove();
      restart();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "rte-btn rte-ghost";
    back.textContent = "🗺️ 回关卡";
    back.addEventListener("click", () => {
      api.play("tap");
      onExit();
    });
    btns.append(again, back);
    ov.appendChild(btns);
    wrap.appendChild(ov);
  }

  function removeDot(d: Dot): void {
    d.gone = true;
    if (d.aiTimer) clearTimeout(d.aiTimer);
    d.el.remove();
    live.delete(d);
  }

  function spawnRound(): void {
    if (over || destroyed || live.size > 0) return;
    round++;
    const delay = endlessAiDelay(round);
    const trap = endlessTrapChance(round);
    const count = endlessDotCount(round);
    const kinds: DotKind[] = [];
    for (let i = 0; i < count; i++) kinds.push(Math.random() < trap ? "trap" : "mine");
    if (!kinds.some((k) => k === "mine")) kinds[0] = "mine";

    for (const kind of kinds) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "rbt-dot";
      el.textContent = kind === "trap" ? "💣" : "🌟";
      placeDot(el);
      const d: Dot = { el, kind, label: 0, aiTimer: null, gone: false };
      arenaEl.appendChild(el);
      live.add(d);
      d.aiTimer = setTimeout(() => {
        if (destroyed || over || d.gone) return;
        removeDot(d);
        if (kind === "mine") loseHeart("被小电脑抢走一个，稳住！");
        else if (live.size === 0) later(spawnRound, 380);
      }, kind === "trap" ? delay * 1.5 : delay);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (over || d.gone) return;
        removeDot(d);
        if (kind === "trap") {
          loseHeart("碰到 💣 啦，看清楚再出手！");
          return;
        }
        streak++;
        score += streak >= 4 ? 2 : 1;
        api.play("pop");
        msgEl.textContent = streak >= 4 ? `连击 ${streak}，双倍分！` : "抢到！";
        renderTop();
        if (live.size === 0) later(spawnRound, 340);
      });
    }
  }

  function restart(): void {
    over = false;
    round = 0;
    score = 0;
    streak = 0;
    lives = ENDLESS_LIVES;
    clearDots();
    msgEl.textContent = "抢到 🌟 加分，碰到 💣 扣一颗心，被抢走也扣一颗心！";
    renderTop();
    later(spawnRound, 600);
  }

  (wrap.querySelector(".rte-back") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  renderTop();
  later(spawnRound, 700);

  return {
    destroy() {
      destroyed = true;
      over = true;
      clearDots();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const barStyle = document.createElement("style");
  barStyle.textContent = ENDLESS_CSS;
  const bar = document.createElement("div");
  bar.className = "rte-bar";
  const levelHost = document.createElement("div");
  const endlessHost = document.createElement("div");
  endlessHost.hidden = true;
  root.append(barStyle, bar, levelHost, endlessHost);
  api.root.appendChild(root);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "rte-open";
  bar.appendChild(openBtn);

  let endless: { destroy: () => void } | null = null;

  function refreshBtn(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    openBtn.textContent = best > 0 ? `♾️ 霓虹抢点 · 最高 ${best} 分` : "♾️ 霓虹抢点 · 点我开抢！";
  }

  function closeEndless(): void {
    endless?.destroy();
    endless = null;
    endlessHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBtn();
  }

  openBtn.addEventListener("click", () => {
    if (endless) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    endlessHost.hidden = false;
    endless = mountEndless(endlessHost, api, closeEndless);
  });
  refreshBtn();

  const level = mountLevelGame({ ...api, root: levelHost }, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "让小电脑得分越少，星星越多！",
    grandMessage: "188 场抢点大战全部获胜，你的手速天下第一！",
  });

  return {
    destroy() {
      endless?.destroy();
      endless = null;
      level.destroy();
      root.remove();
    },
  };
}
