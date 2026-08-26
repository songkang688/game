import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { save } from "../../engine/save";
import { CHAPTERS, LEVELS, type TugLevel } from "./levels";
import {
  CHANT_BURST,
  CHANT_OFFBEAT_FACTOR,
  STAR_PULL,
  SUPPLY_BUFF,
  SUPPLY_DEBUFF,
  SUPPLY_EVERY_MS,
  SUPPLY_MS,
  WIN_AT,
  adaptiveAiRate,
  chantReady,
  endlessAiRate,
  endlessHasLight,
  endlessPullPower,
  isNewRecord,
  mechanicsOf,
  nextChant,
  staminaPullFactor
} from "./logic";

const CSS = `
.rbg-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0E4, #FFE4EC); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbg-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; align-items: center; }
.rbg-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; font-weight: 800; font-size: 15px; box-shadow: 0 2px 6px rgba(200,120,120,.25); }
.rbg-badge.rbg-badge-right { padding: 4px 4px 4px 12px; }
.rbg-ava { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; box-shadow: 0 1px 4px rgba(120,80,120,.3); }
.rbg-puller { width: 42px; height: 42px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; box-shadow: 0 3px 8px rgba(120,80,120,.3); background: #fff; }
.rbg-team-red .rbg-puller { border-color: #FFB3B3; }
.rbg-team-blue .rbg-puller { border-color: #A9C6FF; }
.rbg-light { font-size: 26px; min-width: 34px; text-align: center; }
.rbg-field { position: relative; height: 110px; border-radius: 16px; background: linear-gradient(180deg, #E8F6DA 0 68%, #CFE8B8 68% 100%); overflow: hidden; margin-bottom: 8px; }
.rbg-team { position: absolute; top: 26px; font-size: 34px; transition: left .15s linear; }
.rbg-rope { position: absolute; top: 46px; height: 6px; background: #C9975A; border-radius: 3px; transition: left .15s linear, width .15s linear; }
.rbg-flag { position: absolute; top: 22px; font-size: 26px; transition: left .15s linear; }
.rbg-zone { position: absolute; top: 0; bottom: 0; width: 3px; background: rgba(200,80,80,.4); }
.rbg-starbtn { position: absolute; border: none; background: none; font-size: 34px; cursor: pointer; animation: rbgTwinkle .5s ease infinite alternate; padding: 2px; }
@keyframes rbgTwinkle { from { transform: scale(1); } to { transform: scale(1.25); } }
.rbg-supply { position: absolute; border: none; background: none; font-size: 32px; cursor: pointer; padding: 2px; animation: rbgDrop .3s ease; }
@keyframes rbgDrop { from { transform: translateY(-18px) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
.rbg-gear { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; min-height: 22px; }
.rbg-chip { display: inline-flex; align-items: center; gap: 5px; background: #ffffffd9; border-radius: 999px; padding: 3px 11px; font-size: 13px; font-weight: 800; color: #B0555F; box-shadow: 0 2px 5px rgba(190,120,130,.2); }
.rbg-chip-hot { background: linear-gradient(180deg, #FFE0B2, #FFC98A); color: #97551A; }
.rbg-meter { flex: 1; min-width: 100px; height: 14px; border-radius: 999px; background: #ffffffb8; overflow: hidden; box-shadow: inset 0 1px 3px rgba(160,110,110,.25); }
.rbg-meter-fill { height: 100%; width: 100%; border-radius: 999px; background: linear-gradient(90deg, #FFB38A, #F58B6E); transition: width .1s linear; }
.rbg-meter-low .rbg-meter-fill { background: linear-gradient(90deg, #F5A0A0, #E06A6A); }
.rbg-chant { width: 14px; height: 14px; border-radius: 50%; background: #F2A0B6; animation: rbgChant 1s ease-in-out infinite; }
@keyframes rbgChant { 0%,100% { transform: scale(.75); opacity: .55; } 50% { transform: scale(1.35); opacity: 1; } }
.rbg-ctrl { display: flex; justify-content: center; gap: 14px; }
.rbg-pull { flex: 1; max-width: 170px; height: 72px; border: none; border-radius: 20px; font-size: 22px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #FF8A8A, #E85555); cursor: pointer; box-shadow: 0 5px 0 #C23B3B; font-family: inherit; touch-action: manipulation; }
.rbg-pull:active { transform: translateY(3px); box-shadow: 0 2px 0 #C23B3B; }
.rbg-pull.rbg-blue { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rbg-pull.rbg-blue:active { box-shadow: 0 2px 0 #3B55C2; }
.rbg-msg { text-align: center; min-height: 22px; color: #C25555; font-weight: 700; margin-top: 8px; font-size: 15px; }
@media (max-width: 420px) {
  .rbg-pull { height: 64px; font-size: 19px; }
  .rbg-ctrl { gap: 10px; }
}
`;

const ENDLESS_CSS = `
.rge-bar { display: flex; justify-content: center; margin: 0 0 10px; }
.rge-open { border: none; border-radius: 999px; padding: 10px 20px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #FF9A9A, #E36A6A); box-shadow: 0 4px 0 #BF4A4A; }
.rge-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #BF4A4A; }
.rge-open:focus-visible { outline: 3px solid #8A2F2F; outline-offset: 3px; }
.rge-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.rge-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #B0555F; box-shadow: 0 3px 0 rgba(190,120,130,.28); }
.rge-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(190,120,130,.28); }
.rge-over { position: absolute; inset: 0; border-radius: 16px; background: rgba(255,248,250,.96); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rge-over-title { font-size: 22px; font-weight: 900; color: #B0555F; }
.rge-over-sub { font-size: 15px; font-weight: 700; color: #8F6068; line-height: 1.6; max-width: 300px; }
.rge-btn { border: none; border-radius: 18px; padding: 12px 24px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #FF9A9A, #E36A6A); box-shadow: 0 5px 0 #BF4A4A; }
.rge-btn.rge-ghost { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rge-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #BF4A4A; }
`;

/** 一局拔河的共同状态机；关卡模式与无尽模式共用同一套手感 */
interface TugRunOptions {
  cfg: TugLevel;
  /** 关卡头部的一句话提示 */
  hint: string;
  sfx: (name: "tap" | "coin" | "oops" | "win" | "jump" | "pop" | "meow") => void;
  onWin: (seconds: number) => void;
  onLose: () => void;
}

interface TugRun {
  root: HTMLElement;
  destroy: () => void;
}

function runTug(opts: TugRunOptions): TugRun {
  const cfg = opts.cfg;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let destroyed = false;
  let ended = false;
  let raf = 0;
  let lastTime = 0;
  /** -100(小电脑赢) .. +100(你赢)，0 为中线 */
  let pos = 0;
  let green = true;
  let lastHand: "L" | "R" | null = null;
  let startAt = 0;
  // 1.1 新机制的运行时状态
  const staminaMax = cfg.stamina ?? 0;
  let stamina = staminaMax;
  let chant = 0;
  let lastPullAt = 0;
  let buffUntil = 0;
  let debuffUntil = 0;

  const gears = mechanicsOf(cfg);

  const wrap = document.createElement("div");
  wrap.className = "rbg-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="rbg-top">
      <span class="rbg-badge" style="color:#C24545"><img class="rbg-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />🔴 朵朵队 · 你</span>
      ${cfg.redlight ? '<span class="rbg-light">🟢</span>' : ""}
      <span class="rbg-badge rbg-badge-right" style="color:#3576BF">🔵 星星队 · 小电脑<img class="rbg-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
    </div>
    ${gears.length ? `<div class="rbg-gear"></div>` : ""}
    <div class="rbg-field">
      <div class="rbg-zone" style="left:15%"></div>
      <div class="rbg-zone" style="right:15%"></div>
      <div class="rbg-team rbg-red rbg-team-red"><img class="rbg-puller" src="${AVATAR_URLS.duoduo}" alt="朵朵在拔河" /></div>
      <div class="rbg-rope"></div>
      <div class="rbg-flag">🚩</div>
      <div class="rbg-team rbg-blue-team rbg-team-blue"><img class="rbg-puller" src="${AVATAR_URLS.xingxing}" alt="星星在拔河" /></div>
    </div>
    <div class="rbg-ctrl">
      ${cfg.rhythm
        ? '<button class="rbg-pull rbg-left" type="button">👈 左手</button><button class="rbg-pull rbg-blue rbg-right" type="button">右手 👉</button>'
        : '<button class="rbg-pull rbg-only" type="button">🪢 用力拉！</button>'}
    </div>
    <div class="rbg-msg"></div>
  `;

  const flagEl = wrap.querySelector(".rbg-flag") as HTMLElement;
  const ropeEl = wrap.querySelector(".rbg-rope") as HTMLElement;
  const redEl = wrap.querySelector(".rbg-red") as HTMLElement;
  const blueEl = wrap.querySelector(".rbg-blue-team") as HTMLElement;
  const fieldEl = wrap.querySelector(".rbg-field") as HTMLElement;
  const lightEl = wrap.querySelector(".rbg-light") as HTMLElement | null;
  const msgEl = wrap.querySelector(".rbg-msg") as HTMLElement;
  const gearEl = wrap.querySelector(".rbg-gear") as HTMLElement | null;

  let stamBox: HTMLElement | null = null;
  let stamFill: HTMLElement | null = null;
  let chantChip: HTMLElement | null = null;
  if (gearEl) {
    if (staminaMax > 0) {
      const tag = document.createElement("span");
      tag.className = "rbg-chip";
      tag.textContent = "💪 体力";
      stamBox = document.createElement("div");
      stamBox.className = "rbg-meter";
      stamBox.setAttribute("role", "img");
      stamBox.setAttribute("aria-label", "体力条");
      stamFill = document.createElement("div");
      stamFill.className = "rbg-meter-fill";
      stamBox.appendChild(stamFill);
      gearEl.append(tag, stamBox);
    }
    if (cfg.chantMs) {
      const dot = document.createElement("span");
      dot.className = "rbg-chant";
      dot.style.animationDuration = `${cfg.chantMs}ms`;
      chantChip = document.createElement("span");
      chantChip.className = "rbg-chip";
      chantChip.textContent = `📣 齐心 0/${cfg.chantMax ?? 8}`;
      gearEl.append(dot, chantChip);
    }
    if (cfg.supply) {
      const tag = document.createElement("span");
      tag.className = "rbg-chip";
      tag.textContent = "🧤 会掉补给";
      gearEl.appendChild(tag);
    }
    if (cfg.aiAdapt) {
      const tag = document.createElement("span");
      tag.className = "rbg-chip";
      tag.textContent = "🧠 小电脑会反扑";
      gearEl.appendChild(tag);
    }
  }

  msgEl.textContent = opts.hint;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderGear(): void {
    if (stamFill && staminaMax > 0) {
      const pct = Math.max(0, Math.min(1, stamina / staminaMax));
      stamFill.style.width = `${pct * 100}%`;
      stamBox?.classList.toggle("rbg-meter-low", pct < 0.35);
    }
    if (chantChip) {
      const max = cfg.chantMax ?? 8;
      chantChip.textContent = `📣 齐心 ${chant}/${max}`;
      chantChip.classList.toggle("rbg-chip-hot", chant >= max - 2);
    }
  }

  function render(): void {
    // pos +100 → 旗到左边 15%（你这边），-100 → 右边 85%
    const flagPct = 50 - (pos / WIN_AT) * 35;
    flagEl.style.left = `calc(${flagPct}% - 13px)`;
    ropeEl.style.left = `calc(${flagPct}% - 90px)`;
    ropeEl.style.width = "180px";
    redEl.style.left = `calc(${flagPct}% - 140px)`;
    blueEl.style.left = `calc(${flagPct}% + 66px)`;
    renderGear();
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    if (won) opts.onWin((performance.now() - startAt) / 1000);
    else opts.onLose();
  }

  function pull(power: number): void {
    if (ended) return;
    if (cfg.redlight && !green) {
      pos = Math.max(-WIN_AT, pos - 6);
      chant = 0;
      opts.sfx("oops");
      msgEl.textContent = "🔴 红灯拉绳打滑啦！等绿灯！";
      render();
      return;
    }
    const now = performance.now();
    let real = power * staminaPullFactor(stamina, cfg);
    if (cfg.chantMs) {
      chant = nextChant(chant, lastPullAt ? now - lastPullAt : cfg.chantMs, cfg);
      if (chant === 0) {
        real *= CHANT_OFFBEAT_FACTOR;
        msgEl.textContent = "号子没跟上，跟着「嘿—哟」的拍子拉才使得上劲！";
      }
    }
    if (now < buffUntil) real *= SUPPLY_BUFF;
    if (staminaMax > 0) {
      if (stamina < 1) msgEl.textContent = "💪 体力见底啦，松一下手喘口气再拉！";
      stamina = Math.max(0, stamina - 1);
    }
    lastPullAt = now;

    pos = Math.min(WIN_AT, pos + real);
    opts.sfx("tap");
    if (chantReady(chant, cfg)) {
      chant = 0;
      pos = Math.min(WIN_AT, pos + CHANT_BURST);
      opts.sfx("coin");
      msgEl.textContent = "📣 齐心攒满，嘿——猛拉一大把！";
    }
    render();
    if (pos >= WIN_AT) finish(true);
  }

  function onHand(hand: "L" | "R"): void {
    if (ended) return;
    if (lastHand === hand) {
      msgEl.textContent = "要换另一只手啦，左右轮着来！";
      opts.sfx("oops");
      return;
    }
    lastHand = hand;
    pull(cfg.pullPower);
  }

  if (cfg.rhythm) {
    (wrap.querySelector(".rbg-left") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onHand("L");
    });
    (wrap.querySelector(".rbg-right") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onHand("R");
    });
  } else {
    (wrap.querySelector(".rbg-only") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pull(cfg.pullPower);
    });
  }

  if (cfg.redlight && lightEl) {
    const flip = () => {
      if (ended || destroyed) return;
      green = !green;
      lightEl.textContent = green ? "🟢" : "🔴";
      later(flip, green ? 1800 + Math.random() * 1400 : 900 + Math.random() * 700);
    };
    later(flip, 2000);
  }

  if (cfg.star) {
    const starSpawner = setInterval(() => {
      if (ended || destroyed) return;
      if (fieldEl.querySelector(".rbg-starbtn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rbg-starbtn";
      btn.textContent = "⭐";
      btn.setAttribute("aria-label", "抢加油星");
      btn.style.left = `${15 + Math.random() * 70}%`;
      btn.style.top = `${8 + Math.random() * 50}%`;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended) return;
        btn.remove();
        opts.sfx("coin");
        msgEl.textContent = "⭐ 加油星！猛拉一大把！";
        pos = Math.min(WIN_AT, pos + STAR_PULL);
        render();
        if (pos >= WIN_AT) finish(true);
      });
      fieldEl.appendChild(btn);
      later(() => btn.remove(), 1600);
    }, 2600);
    intervals.add(starSpawner);
  }

  if (cfg.supply) {
    // 补给：抢到手力气变大，抢慢了就轮到星星队占便宜
    const supplySpawner = setInterval(() => {
      if (ended || destroyed) return;
      if (fieldEl.querySelector(".rbg-supply")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rbg-supply";
      btn.textContent = "🧤";
      btn.setAttribute("aria-label", "抢防滑粉");
      btn.style.left = `${18 + Math.random() * 62}%`;
      btn.style.top = `${10 + Math.random() * 48}%`;
      let taken = false;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended || taken) return;
        taken = true;
        btn.remove();
        opts.sfx("coin");
        buffUntil = performance.now() + SUPPLY_MS;
        msgEl.textContent = "🧤 防滑粉到手！接下来几秒力气更大！";
      });
      fieldEl.appendChild(btn);
      later(() => {
        if (taken) return;
        taken = true;
        btn.remove();
        if (ended || destroyed) return;
        debuffUntil = performance.now() + SUPPLY_MS;
        msgEl.textContent = "💧 补给被星星队抢走啦，脚下有点滑，稳住！";
      }, 1500);
    }, SUPPLY_EVERY_MS);
    intervals.add(supplySpawner);
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (staminaMax > 0) {
      stamina = Math.min(staminaMax, stamina + (cfg.staminaRegen ?? 0) * dt);
    }
    let rate = adaptiveAiRate(cfg, pos);
    if (now < debuffUntil) rate *= SUPPLY_DEBUFF;
    pos = Math.max(-WIN_AT, pos - rate * dt);
    render();
    if (pos <= -WIN_AT) {
      finish(false);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  startAt = performance.now();
  render();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    root: wrap,
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      intervals.forEach((t) => clearInterval(t));
      intervals.clear();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: TugLevel = LEVELS[ctx.level];
  const gears = mechanicsOf(cfg);
  let done = false;
  const run = runTug({
    cfg,
    hint: gears.length
      ? `本关新玩法：${gears.join(" + ")}，看清楚再发力！`
      : cfg.rhythm
        ? "左手右手轮着点，节奏对了才有力！"
        : cfg.redlight
          ? "看到 🟢 才能拉，🔴 时拉绳会打滑！"
          : cfg.star
            ? "狂点拉绳，⭐ 出现就赶紧抢！"
            : "狂点按钮，把小旗拉到你这边！",
    sfx: (name) => ctx.sfx(name),
    onWin: (secs) => {
      if (done) return;
      done = true;
      const got = secs <= 16 ? 3 : secs <= 28 ? 2 : 1;
      setTimeout(() => ctx.win(got as 1 | 2 | 3, `嘿咻！只用 ${Math.round(secs)} 秒，朵朵队赢啦！星星队也好棒！`), 400);
    },
    onLose: () => {
      if (done) return;
      done = true;
      setTimeout(() => ctx.lose("这局星星队赢啦，朵朵队也好棒！看准时机再拉一次！"), 400);
    }
  });
  stage.appendChild(run.root);
  return { destroy: () => run.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式「绳王连胜」：赢一局就来一个更大力气的对手，输一局才结束
// ---------------------------------------------------------------------------

function endlessLevel(round: number): TugLevel {
  return {
    aiRate: endlessAiRate(round),
    pullPower: endlessPullPower(round),
    star: round >= 2,
    redlight: endlessHasLight(round),
    rhythm: false,
    theme: 9,
    supply: round >= 5
  };
}

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  let destroyed = false;
  let round = 0;
  let wins = 0;
  let run: TugRun | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();

  const wrap = document.createElement("div");
  wrap.className = "rbg-wrap";
  wrap.innerHTML = `
    <style>${CSS}${ENDLESS_CSS}</style>
    <div class="rge-head">
      <button class="rge-back" type="button">🗺️ 回关卡</button>
      <span class="rbg-chip rge-round"></span>
      <span class="rbg-chip rge-best"></span>
    </div>
    <div class="rge-stage"></div>
  `;
  host.appendChild(wrap);

  const stageEl = wrap.querySelector(".rge-stage") as HTMLElement;
  const roundEl = wrap.querySelector(".rge-round") as HTMLElement;
  const bestEl = wrap.querySelector(".rge-best") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderHead(): void {
    roundEl.textContent = `🪢 第 ${round + 1} 局 · 已连胜 ${wins}`;
    bestEl.textContent = best > 0 ? `🏅 最高连胜 ${best}` : "🏅 还没有纪录";
  }

  function gameOver(): void {
    run?.destroy();
    run = null;
    const record = isNewRecord(wins, best);
    if (record) best = save.recordEndlessBest(meta.id, wins);
    const bonus = Math.min(6, Math.floor(wins / 2));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");

    const ov = document.createElement("div");
    ov.className = "rge-over";
    ov.innerHTML = `
      <div style="font-size:46px;line-height:1">${record ? "🏅" : "🪢"}</div>
      <div class="rge-over-title">${record ? `新纪录 ${wins} 连胜！` : `这趟连胜 ${wins} 局`}</div>
      <div class="rge-over-sub">${
        record
          ? `一局比一局难，你居然扛住了 ${wins} 个对手！${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`
          : `最高连胜 ${best} 局，换口气再来一趟就有机会追上！${bonus > 0 ? `这趟也拿到 ${bonus} 颗小星星。` : ""}`
      }</div>
    `;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "rge-btn";
    again.textContent = "🔁 再拔一趟";
    again.addEventListener("click", () => {
      api.play("tap");
      ov.remove();
      round = 0;
      wins = 0;
      startRound();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "rge-btn rge-ghost";
    back.textContent = "🗺️ 回关卡";
    back.addEventListener("click", () => {
      api.play("tap");
      onExit();
    });
    btns.append(again, back);
    ov.appendChild(btns);
    wrap.appendChild(ov);
    renderHead();
  }

  function startRound(): void {
    if (destroyed) return;
    run?.destroy();
    stageEl.innerHTML = "";
    const cfg = endlessLevel(round);
    renderHead();
    run = runTug({
      cfg,
      hint:
        round === 0
          ? "赢一局就来一个更大力气的对手，看你能连胜几局！"
          : `第 ${round + 1} 个对手力气更大了，${cfg.redlight ? "还带红绿灯裁判，" : ""}稳住节奏！`,
      sfx: (name) => api.play(name),
      onWin: () => {
        wins++;
        round++;
        api.play("win");
        renderHead();
        later(startRound, 700);
      },
      onLose: () => later(gameOver, 400)
    });
    stageEl.appendChild(run.root);
  }

  (wrap.querySelector(".rge-back") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  startRound();

  return {
    destroy() {
      destroyed = true;
      run?.destroy();
      run = null;
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
  bar.className = "rge-bar";
  const levelHost = document.createElement("div");
  const endlessHost = document.createElement("div");
  endlessHost.hidden = true;
  root.append(barStyle, bar, levelHost, endlessHost);
  api.root.appendChild(root);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "rge-open";
  bar.appendChild(openBtn);

  let endless: { destroy: () => void } | null = null;

  function refreshBtn(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    openBtn.textContent = best > 0 ? `♾️ 绳王连胜 · 最高 ${best} 局` : "♾️ 绳王连胜 · 点我开拔！";
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
    mapHint: "拔得越快星星越多，十大赛场等你称王！",
    grandMessage: "188 场拔河全部胜利，大力士奖杯归你！",
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
