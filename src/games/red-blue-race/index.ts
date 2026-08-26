import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { save } from "../../engine/save";
import { CHAPTERS, LEVELS, TRACK_LEN, type Obstacle, type ObstacleType, type RaceLevel } from "./levels";
import {
  ITEM_BOOST,
  ITEM_SLOW_FACTOR,
  ITEM_SLOW_MS,
  adaptiveAiSpeed,
  comboMultiplier,
  endlessChaserSpeed,
  endlessGapMeters,
  inZone,
  isNewRecord,
  mechanicsOf,
  nextCombo,
  staminaStepFactor
} from "./logic";

const OB_EMOJI: Record<ObstacleType, string> = {
  puddle: "💧",
  hurdle: "🚧",
  hill: "⛰️",
  star: "⭐",
  item: "🎁",
};

const CSS = `
.rbr-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E8F8E0, #FFF7E0); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbr-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
.rbr-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; font-weight: 700; color: #4E8A3E; box-shadow: 0 2px 6px rgba(110,170,90,.25); font-size: 14px; }
.rbr-badge.rbr-badge-right { padding: 4px 4px 4px 12px; }
.rbr-ava { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; box-shadow: 0 1px 4px rgba(90,130,80,.3); }
.rbr-runner-img { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; box-shadow: 0 3px 8px rgba(90,110,80,.35); background: #fff; display: block; }
.rbr-runner.rbr-me .rbr-runner-img { border-color: #FFB3B3; }
.rbr-runner.rbr-airun .rbr-runner-img { border-color: #A9C6FF; }
.rbr-lane { position: relative; height: 56px; border-radius: 14px; margin-bottom: 8px; overflow: hidden; }
.rbr-lane-red { background: linear-gradient(180deg, #FFE4E4, #FFD4D4); }
.rbr-lane-blue { background: linear-gradient(180deg, #E0EEFF, #D0E4FF); }
.rbr-finish { position: absolute; right: 4px; top: 0; bottom: 0; display: flex; align-items: center; font-size: 22px; }
.rbr-runner { position: absolute; top: 50%; transform: translateY(-50%); font-size: 30px; transition: left .12s linear; }
.rbr-runner.rbr-jump { animation: rbrJump .45s ease; }
@keyframes rbrJump { 0%,100% { transform: translateY(-50%); } 50% { transform: translateY(-110%); } }
.rbr-ob { position: absolute; top: 4px; font-size: 17px; opacity: .9; transition: opacity .2s ease; }
.rbr-ob-gone { opacity: .22; filter: grayscale(1); }
.rbr-hill { position: absolute; top: 0; bottom: 0; background: rgba(160,130,80,.18); border-radius: 8px; }
.rbr-gear { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; min-height: 22px; }
.rbr-chip { display: inline-flex; align-items: center; gap: 5px; background: #ffffffd9; border-radius: 999px; padding: 3px 11px; font-size: 13px; font-weight: 800; color: #4E7A46; box-shadow: 0 2px 5px rgba(110,150,90,.2); }
.rbr-stam { flex: 1; min-width: 110px; height: 14px; border-radius: 999px; background: #ffffffb8; overflow: hidden; box-shadow: inset 0 1px 3px rgba(90,120,70,.22); }
.rbr-stam-fill { height: 100%; width: 100%; border-radius: 999px; background: linear-gradient(90deg, #8FD98A, #59B96F); transition: width .1s linear; }
.rbr-stam-low .rbr-stam-fill { background: linear-gradient(90deg, #FFC48F, #F08A5D); }
.rbr-beat { width: 14px; height: 14px; border-radius: 50%; background: #F5B3D0; box-shadow: 0 0 0 0 rgba(245,179,208,.7); animation: rbrBeat 1s ease-in-out infinite; }
@keyframes rbrBeat { 0%,100% { transform: scale(.75); opacity: .55; } 50% { transform: scale(1.35); opacity: 1; } }
.rbr-ctrl { display: flex; justify-content: center; gap: 16px; margin-top: 6px; }
.rbr-run { flex: 1; max-width: 200px; height: 68px; border: none; border-radius: 20px; font-size: 24px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #FF8A8A, #E85555); cursor: pointer; box-shadow: 0 5px 0 #C23B3B; font-family: inherit; touch-action: manipulation; }
.rbr-run:active { transform: translateY(3px); box-shadow: 0 2px 0 #C23B3B; }
.rbr-jump-btn { width: 110px; height: 68px; border: none; border-radius: 20px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #7FBFFF, #4D97E8); cursor: pointer; box-shadow: 0 5px 0 #3576BF; font-family: inherit; touch-action: manipulation; }
.rbr-jump-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #3576BF; }
.rbr-msg { text-align: center; min-height: 20px; color: #4E8A3E; font-weight: 700; margin-top: 8px; font-size: 14px; }
@media (max-width: 420px) {
  .rbr-run { font-size: 20px; height: 62px; }
  .rbr-jump-btn { width: 92px; height: 62px; font-size: 18px; }
  .rbr-ctrl { gap: 10px; }
}
`;

const ENDLESS_CSS = `
.rbe-bar { display: flex; justify-content: center; margin: 0 0 10px; }
.rbe-open { border: none; border-radius: 999px; padding: 10px 20px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #6FC98A, #46A06A); box-shadow: 0 4px 0 #358554; }
.rbe-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #358554; }
.rbe-open:focus-visible { outline: 3px solid #2A5B3C; outline-offset: 3px; }
.rbe-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E7F4FF, #FFF1E6); border-radius: 20px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbe-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.rbe-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #3F7A5C; box-shadow: 0 3px 0 rgba(80,140,110,.28); }
.rbe-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(80,140,110,.28); }
.rbe-chip { background: #fff; border-radius: 999px; padding: 5px 12px; font-size: 14px; font-weight: 800; color: #3F7A5C; box-shadow: 0 2px 6px rgba(110,160,130,.24); }
.rbe-lane { position: relative; height: 96px; border-radius: 16px; overflow: hidden; background: linear-gradient(180deg, #FFF6DE 0 62%, #E6F2CF 62% 100%); margin-bottom: 8px; }
.rbe-ground { position: absolute; left: 0; right: 0; top: 62%; height: 3px; background: rgba(150,170,120,.5); }
.rbe-me, .rbe-chaser { position: absolute; top: 30%; transform: translateY(-30%); transition: left .1s linear; }
.rbe-face { width: 42px; height: 42px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; background: #fff; display: block; box-shadow: 0 3px 8px rgba(110,130,90,.32); }
.rbe-me .rbe-face { border-color: #FFB3B3; }
.rbe-chaser .rbe-face { border-color: #A9C6FF; }
.rbe-me.rbe-jump { animation: rbeJump .42s ease; }
@keyframes rbeJump { 0%,100% { transform: translateY(-30%); } 50% { transform: translateY(-95%); } }
.rbe-ob { position: absolute; top: 40%; font-size: 22px; transition: left .1s linear; }
.rbe-gap { height: 12px; border-radius: 999px; background: #ffffffc4; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(120,140,100,.25); }
.rbe-gap-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #F0946E, #F6C46A, #7FD08C); transition: width .1s linear; }
.rbe-msg { text-align: center; min-height: 20px; font-size: 14px; font-weight: 700; color: #3F7A5C; margin-top: 8px; }
.rbe-over { position: absolute; inset: 0; border-radius: 20px; background: rgba(255,252,246,.96); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rbe-over-title { font-size: 22px; font-weight: 900; color: #3F7A5C; }
.rbe-over-sub { font-size: 15px; font-weight: 700; color: #5E7F6C; line-height: 1.6; max-width: 300px; }
.rbe-over-btn { border: none; border-radius: 18px; padding: 12px 24px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #6FC98A, #46A06A); box-shadow: 0 5px 0 #358554; }
.rbe-over-btn.rbe-ghost { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rbe-over-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #358554; }
@media (max-width: 420px) {
  .rbe-lane { height: 84px; }
  .rbe-face { width: 36px; height: 36px; }
}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: RaceLevel = LEVELS[ctx.level];
  let destroyed = false;
  let ended = false;
  let raf = 0;
  let lastTime = 0;
  let me = 0;
  let ai = 0;
  let stunnedUntil = 0;
  let jumping = false;
  const clearedObs = new Set<Obstacle>();
  const obEls = new Map<Obstacle, HTMLElement>();
  const aiPaused = new Set<Obstacle>();
  let aiPauseUntil = 0;
  // 1.1 新机制的运行时状态
  const staminaMax = cfg.stamina ?? 0;
  let stamina = staminaMax;
  let combo = 0;
  let lastTapAt = 0;
  let aiSlowUntil = 0;
  let meSlowUntil = 0;

  const gears = mechanicsOf(cfg);

  const wrap = document.createElement("div");
  wrap.className = "rbr-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="rbr-top">
      <span class="rbr-badge"><img class="rbr-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />🔴 朵朵 · 你的赛道</span>
      <span class="rbr-badge rbr-badge-right rbr-ai">🔵 星星 · 小电脑<img class="rbr-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
    </div>
    <div class="rbr-lane rbr-lane-red">
      <div class="rbr-finish">🏁</div>
      <div class="rbr-runner rbr-me" style="left:0%"><img class="rbr-runner-img" src="${AVATAR_URLS.duoduo}" alt="朵朵在奔跑" /></div>
    </div>
    <div class="rbr-lane rbr-lane-blue">
      <div class="rbr-finish">🏁</div>
      <div class="rbr-runner rbr-airun" style="left:0%"><img class="rbr-runner-img" src="${AVATAR_URLS.xingxing}" alt="星星在奔跑" /></div>
    </div>
    ${gears.length ? `<div class="rbr-gear"></div>` : ""}
    <div class="rbr-ctrl">
      <button class="rbr-run" type="button">跑！跑！跑！</button>
      <button class="rbr-jump-btn" type="button">🦘 跳！</button>
    </div>
    <div class="rbr-msg">狂点「跑」，遇到 💧🚧 提前按「跳」！</div>
  `;
  stage.appendChild(wrap);

  const redLane = wrap.querySelector(".rbr-lane-red") as HTMLElement;
  const meEl = wrap.querySelector(".rbr-me") as HTMLElement;
  const aiEl = wrap.querySelector(".rbr-airun") as HTMLElement;
  const msgEl = wrap.querySelector(".rbr-msg") as HTMLElement;
  const runBtn = wrap.querySelector(".rbr-run") as HTMLButtonElement;
  const jumpBtn = wrap.querySelector(".rbr-jump-btn") as HTMLButtonElement;
  const gearEl = wrap.querySelector(".rbr-gear") as HTMLElement | null;

  // 新机关的仪表盘：体力条 / 连击 / 读招提示
  let stamBox: HTMLElement | null = null;
  let stamFill: HTMLElement | null = null;
  let comboChip: HTMLElement | null = null;
  if (gearEl) {
    if (staminaMax > 0) {
      stamBox = document.createElement("div");
      stamBox.className = "rbr-stam";
      stamBox.setAttribute("role", "img");
      stamBox.setAttribute("aria-label", "体力条");
      stamFill = document.createElement("div");
      stamFill.className = "rbr-stam-fill";
      stamBox.appendChild(stamFill);
      const tag = document.createElement("span");
      tag.className = "rbr-chip";
      tag.textContent = "💨 体力";
      gearEl.append(tag, stamBox);
    }
    if (cfg.beatMs) {
      const beat = document.createElement("span");
      beat.className = "rbr-beat";
      beat.style.animationDuration = `${cfg.beatMs}ms`;
      comboChip = document.createElement("span");
      comboChip.className = "rbr-chip";
      comboChip.textContent = "🎵 连击 0";
      gearEl.append(beat, comboChip);
    }
    if (cfg.obstacles.some((o) => o.type === "item")) {
      const tag = document.createElement("span");
      tag.className = "rbr-chip";
      tag.textContent = "🎁 礼物箱靠抢";
      gearEl.appendChild(tag);
    }
    if (cfg.aiAdapt) {
      const tag = document.createElement("span");
      tag.className = "rbr-chip";
      tag.textContent = "🧠 小电脑会读招";
      gearEl.appendChild(tag);
    }
  }

  if (gears.length) {
    msgEl.textContent = `本关新玩法：${gears.join(" + ")}，看清楚再冲！`;
  }

  // 画机关
  for (const ob of cfg.obstacles) {
    if (ob.type === "hill") {
      const zone = document.createElement("div");
      zone.className = "rbr-hill";
      zone.style.left = `${ob.pos}%`;
      zone.style.width = `${ob.len}%`;
      redLane.appendChild(zone);
    }
    const mark = document.createElement("div");
    mark.className = "rbr-ob";
    mark.style.left = `${ob.pos}%`;
    mark.textContent = OB_EMOJI[ob.type];
    redLane.appendChild(mark);
    obEls.set(ob, mark);
  }

  function fadeOb(ob: Obstacle): void {
    obEls.get(ob)?.classList.add("rbr-ob-gone");
  }

  function renderGear(): void {
    if (stamFill && staminaMax > 0) {
      const pct = Math.max(0, Math.min(1, stamina / staminaMax));
      stamFill.style.width = `${pct * 100}%`;
      stamBox?.classList.toggle("rbr-stam-low", pct < 0.35);
    }
    if (comboChip) comboChip.textContent = `🎵 连击 ${combo}`;
  }

  function render(): void {
    meEl.style.left = `${Math.min(92, me * 0.92)}%`;
    aiEl.style.left = `${Math.min(92, ai * 0.92)}%`;
    renderGear();
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (won) {
      const got = ai <= 70 ? 3 : ai <= 88 ? 2 : 1;
      setTimeout(() => { if (!destroyed) ctx.win(got as 1 | 2 | 3, `朵朵先冲线！星星跑到 ${Math.round(ai)} 米，节奏咬得很紧。`); }, 350);
    } else {
      setTimeout(() => { if (!destroyed) ctx.lose("这局星星先到线～节奏稳住、障碍提前起跳，差距一段就能追回来！"); }, 350);
    }
  }

  function onRun(): void {
    if (ended) return;
    const now = performance.now();
    if (now < stunnedUntil) return;
    if (cfg.beatMs) {
      combo = nextCombo(combo, lastTapAt ? now - lastTapAt : cfg.beatMs, cfg);
    }
    lastTapAt = now;

    const tired = staminaMax > 0 && stamina < 1;
    let step = cfg.tapStep * comboMultiplier(combo, cfg.comboMax ?? 0) * staminaStepFactor(stamina, cfg);
    if (now < meSlowUntil) step *= ITEM_SLOW_FACTOR;
    for (const ob of cfg.obstacles) {
      if (ob.type === "hill" && inZone(me, ob)) step *= 0.5;
    }
    if (staminaMax > 0) stamina = Math.max(0, stamina - 1);
    if (tired) msgEl.textContent = "💨 体力见底啦，松开手喘两口再冲！";

    const before = me;
    me = Math.min(TRACK_LEN, me + step);
    // 撞机关检查
    for (const ob of cfg.obstacles) {
      if (clearedObs.has(ob)) continue;
      if (ob.type === "star" && before < ob.pos && me >= ob.pos) {
        clearedObs.add(ob);
        fadeOb(ob);
        me = Math.min(TRACK_LEN, me + 8);
        ctx.sfx("coin");
        msgEl.textContent = "⭐ 踩到星星，咻——冲刺！";
      } else if (ob.type === "item" && before < ob.pos && me >= ob.pos) {
        clearedObs.add(ob);
        fadeOb(ob);
        me = Math.min(TRACK_LEN, me + ITEM_BOOST);
        aiSlowUntil = now + ITEM_SLOW_MS;
        ctx.sfx("coin");
        msgEl.textContent = "🎁 礼物箱抢到手！小电脑要打滑一小会儿！";
      } else if ((ob.type === "puddle" || ob.type === "hurdle") && !jumping && before < ob.pos && me >= ob.pos) {
        clearedObs.add(ob);
        fadeOb(ob);
        if (ob.type === "puddle") {
          me = Math.max(0, ob.pos - 2);
          stunnedUntil = performance.now() + 800;
          ctx.sfx("oops");
          msgEl.textContent = "💧 踩进水坑打滑啦！下次提前按「跳」！";
        } else {
          me = Math.max(0, ob.pos - 4);
          stunnedUntil = performance.now() + 600;
          ctx.sfx("oops");
          msgEl.textContent = "🚧 撞上栏架弹回来啦！提前按「跳」！";
        }
      }
    }
    ctx.sfx("tap");
    render();
    if (me >= TRACK_LEN) finish(true);
  }

  function onJump(): void {
    if (ended) return;
    const now = performance.now();
    if (now < stunnedUntil || jumping) return;
    jumping = true;
    meEl.classList.add("rbr-jump");
    ctx.sfx("jump");
    // 前方 8 米内有水坑/栏架就跃过去
    const target = cfg.obstacles.find(
      (ob) => (ob.type === "puddle" || ob.type === "hurdle") && !clearedObs.has(ob) && ob.pos >= me && ob.pos <= me + 8
    );
    if (target) {
      clearedObs.add(target);
      fadeOb(target);
      me = Math.min(TRACK_LEN, target.pos + target.len + 1);
      msgEl.textContent = "跳得漂亮！";
    } else {
      me = Math.min(TRACK_LEN, me + 1.5);
    }
    render();
    setTimeout(() => {
      jumping = false;
      meEl.classList.remove("rbr-jump");
    }, 450);
    if (me >= TRACK_LEN) finish(true);
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (staminaMax > 0) {
      stamina = Math.min(staminaMax, stamina + (cfg.staminaRegen ?? 0) * dt);
    }
    if (now >= aiPauseUntil) {
      let speed = adaptiveAiSpeed(cfg, me, ai);
      if (now < aiSlowUntil) speed *= ITEM_SLOW_FACTOR;
      for (const ob of cfg.obstacles) {
        if (ob.type === "hill" && inZone(ai, ob)) speed *= 0.7;
      }
      const before = ai;
      ai = Math.min(TRACK_LEN, ai + speed * dt);
      for (const ob of cfg.obstacles) {
        if (!(before < ob.pos && ai >= ob.pos)) continue;
        // 礼物箱是抢的：小电脑先冲到就归它，反过来轮到你打滑
        if (ob.type === "item" && !clearedObs.has(ob)) {
          clearedObs.add(ob);
          fadeOb(ob);
          ai = Math.min(TRACK_LEN, ai + ITEM_BOOST);
          meSlowUntil = now + ITEM_SLOW_MS;
          msgEl.textContent = "🎁 礼物箱被小电脑抢先啦，稳住节奏追回来！";
        } else if ((ob.type === "puddle" || ob.type === "hurdle") && !aiPaused.has(ob)) {
          // 小电脑遇到水坑/栏架会停顿一下（它也会犯难）
          aiPaused.add(ob);
          aiPauseUntil = now + 550;
        }
      }
    }
    render();
    if (ai >= TRACK_LEN) {
      finish(false);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  runBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onRun();
  });
  jumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onJump();
  });
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "d") { onRun(); e.preventDefault(); }
    if (e.key === " " || e.key === "ArrowUp") { onJump(); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  render();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽模式「星轨长跑」：赛道没有终点，身后的追赶者越跑越快，被追上就结束
// ---------------------------------------------------------------------------

/** 玩家在跑道上的固定站位（百分比），机关与追赶者都相对它滚动 */
const VIEW_ME_PCT = 30;
/** 视野里能看到前方多少米 */
const VIEW_AHEAD = 45;
/** 开局领先追赶者多少米 */
const START_GAP = 28;

interface EndlessOb {
  type: ObstacleType;
  pos: number;
  el: HTMLElement;
  gone: boolean;
}

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  let destroyed = false;
  let over = false;
  let raf = 0;
  let lastTime = 0;
  let dist = 0;
  let chaser = -START_GAP;
  let jumping = false;
  let stunnedUntil = 0;
  let chaserSlowUntil = 0;
  let picked = 0;
  const obs: EndlessOb[] = [];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let best = save.getGameProgress(meta.id).endlessBest;

  const wrap = document.createElement("div");
  wrap.className = "rbe-wrap";
  wrap.innerHTML = `
    <style>${ENDLESS_CSS}</style>
    <div class="rbe-head">
      <button class="rbe-back" type="button">🗺️ 回关卡</button>
      <span class="rbe-chip rbe-dist">0 米</span>
      <span class="rbe-chip rbe-best"></span>
    </div>
    <div class="rbe-gap"><div class="rbe-gap-fill" style="width:100%"></div></div>
    <div class="rbe-lane">
      <div class="rbe-ground"></div>
      <div class="rbe-chaser" style="left:0%"><img class="rbe-face" src="${AVATAR_URLS.xingxing}" alt="星星在追你" /></div>
      <div class="rbe-me" style="left:${VIEW_ME_PCT}%"><img class="rbe-face" src="${AVATAR_URLS.duoduo}" alt="朵朵在长跑" /></div>
    </div>
    <div class="rbr-ctrl">
      <button class="rbr-run" type="button">跑！跑！跑！</button>
      <button class="rbr-jump-btn" type="button">🦘 跳！</button>
    </div>
    <div class="rbe-msg">一直往前跑，星星在后面追！💧🚧 要跳，🎁⭐ 要抢！</div>
  `;
  const style = document.createElement("style");
  style.textContent = CSS;
  wrap.appendChild(style);
  host.appendChild(wrap);

  const laneEl = wrap.querySelector(".rbe-lane") as HTMLElement;
  const meEl = wrap.querySelector(".rbe-me") as HTMLElement;
  const chaserEl = wrap.querySelector(".rbe-chaser") as HTMLElement;
  const distEl = wrap.querySelector(".rbe-dist") as HTMLElement;
  const bestEl = wrap.querySelector(".rbe-best") as HTMLElement;
  const gapFill = wrap.querySelector(".rbe-gap-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".rbe-msg") as HTMLElement;
  const runBtn = wrap.querySelector(".rbr-run") as HTMLButtonElement;
  const jumpBtn = wrap.querySelector(".rbr-jump-btn") as HTMLButtonElement;

  bestEl.textContent = best > 0 ? `🏅 最远 ${best} 米` : "🏅 还没有纪录";

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const KINDS: ObstacleType[] = ["puddle", "hurdle", "item", "star", "hurdle", "puddle", "item"];
  let nextPos = 34;
  let kindCursor = 0;

  function refill(): void {
    while (nextPos < dist + VIEW_AHEAD + 40) {
      const type = KINDS[kindCursor++ % KINDS.length];
      const el = document.createElement("div");
      el.className = "rbe-ob";
      el.textContent = OB_EMOJI[type];
      laneEl.appendChild(el);
      obs.push({ type, pos: nextPos, el, gone: false });
      nextPos += endlessGapMeters(nextPos) * (0.8 + Math.random() * 0.5);
    }
  }

  function dropOb(o: EndlessOb): void {
    o.gone = true;
    o.el.remove();
  }

  function render(): void {
    for (const o of obs) {
      if (o.gone) continue;
      o.el.style.left = `${VIEW_ME_PCT + ((o.pos - dist) / VIEW_AHEAD) * (100 - VIEW_ME_PCT)}%`;
    }
    const gap = dist - chaser;
    chaserEl.style.left = `${Math.max(1, VIEW_ME_PCT - (gap / VIEW_AHEAD) * (100 - VIEW_ME_PCT))}%`;
    gapFill.style.width = `${Math.max(0, Math.min(100, (gap / START_GAP) * 100))}%`;
    distEl.textContent = `${Math.floor(dist)} 米`;
  }

  function finish(): void {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    const score = Math.floor(dist);
    const record = isNewRecord(score, best);
    if (record) best = save.recordEndlessBest(meta.id, score);
    // 长跑奖励：每 100 米一颗小星星，最多 6 颗，别把关卡星星比下去
    const bonus = Math.min(6, Math.floor(score / 100));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");

    const ov = document.createElement("div");
    ov.className = "rbe-over";
    ov.innerHTML = `
      <div style="font-size:46px;line-height:1">${record ? "🏅" : "☁️"}</div>
      <div class="rbe-over-title">${record ? `新纪录 ${score} 米！` : `这趟跑了 ${score} 米`}</div>
      <div class="rbe-over-sub">${
        record
          ? `抢到 ${picked} 个礼物箱，节奏保持得真好！${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`
          : `最远纪录 ${best} 米，再跑一趟就有机会追上它！${bonus > 0 ? `这趟也拿到 ${bonus} 颗小星星。` : ""}`
      }</div>
    `;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "rbe-over-btn";
    again.textContent = "🔁 再跑一趟";
    again.addEventListener("click", () => {
      api.play("tap");
      restart();
      ov.remove();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "rbe-over-btn rbe-ghost";
    back.textContent = "🗺️ 回关卡";
    back.addEventListener("click", () => {
      api.play("tap");
      onExit();
    });
    btns.append(again, back);
    ov.appendChild(btns);
    wrap.appendChild(ov);
  }

  function restart(): void {
    over = false;
    dist = 0;
    chaser = -START_GAP;
    picked = 0;
    stunnedUntil = 0;
    chaserSlowUntil = 0;
    nextPos = 34;
    kindCursor = 0;
    for (const o of obs) o.el.remove();
    obs.length = 0;
    bestEl.textContent = best > 0 ? `🏅 最远 ${best} 米` : "🏅 还没有纪录";
    msgEl.textContent = "一直往前跑，星星在后面追！💧🚧 要跳，🎁⭐ 要抢！";
    refill();
    render();
    lastTime = 0;
    raf = requestAnimationFrame(loop);
  }

  function onRun(): void {
    if (over || destroyed) return;
    const now = performance.now();
    if (now < stunnedUntil) return;
    const before = dist;
    dist += 1.7;
    for (const o of obs) {
      if (o.gone || !(before < o.pos && dist >= o.pos)) continue;
      if (o.type === "star") {
        dropOb(o);
        dist += 8;
        api.play("coin");
        msgEl.textContent = "⭐ 星星冲刺！";
      } else if (o.type === "item") {
        dropOb(o);
        picked++;
        dist += ITEM_BOOST;
        chaserSlowUntil = now + ITEM_SLOW_MS;
        api.play("coin");
        msgEl.textContent = "🎁 礼物箱到手，星星慢下来啦！";
      } else if (!jumping) {
        dropOb(o);
        dist = Math.max(before, o.pos - 2);
        stunnedUntil = now + (o.type === "puddle" ? 700 : 550);
        api.play("oops");
        msgEl.textContent = o.type === "puddle" ? "💧 打滑了！提前按「跳」" : "🚧 撞栏了！提前按「跳」";
      }
    }
    api.play("tap");
    refill();
    render();
  }

  function onJump(): void {
    if (over || destroyed) return;
    const now = performance.now();
    if (now < stunnedUntil || jumping) return;
    jumping = true;
    meEl.classList.add("rbe-jump");
    api.play("jump");
    const target = obs.find((o) => !o.gone && (o.type === "puddle" || o.type === "hurdle") && o.pos >= dist && o.pos <= dist + 9);
    if (target) {
      dropOb(target);
      dist = target.pos + 5;
      msgEl.textContent = "跳得漂亮！";
    } else {
      dist += 1.5;
    }
    later(() => {
      jumping = false;
      meEl.classList.remove("rbe-jump");
    }, 420);
    refill();
    render();
  }

  function loop(now: number): void {
    if (destroyed || over) return;
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
    lastTime = now;
    let speed = endlessChaserSpeed(dist);
    if (now < chaserSlowUntil) speed *= ITEM_SLOW_FACTOR;
    chaser += speed * dt;
    render();
    if (chaser >= dist) {
      finish();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  runBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onRun();
  });
  jumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onJump();
  });
  (wrap.querySelector(".rbe-back") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    onExit();
  });
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "d") { onRun(); e.preventDefault(); }
    if (e.key === " " || e.key === "ArrowUp") { onJump(); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  refill();
  render();
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      over = true;
      cancelAnimationFrame(raf);
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  // 无尽模式挂在关卡地图上面，关卡框架照旧挂进自己的子容器，level99.ts 一行不改
  const root = document.createElement("div");
  const bar = document.createElement("div");
  bar.className = "rbe-bar";
  const barStyle = document.createElement("style");
  barStyle.textContent = ENDLESS_CSS;
  const levelHost = document.createElement("div");
  const endlessHost = document.createElement("div");
  endlessHost.hidden = true;
  root.append(barStyle, bar, levelHost, endlessHost);
  api.root.appendChild(root);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "rbe-open";
  bar.appendChild(openBtn);

  let endless: { destroy: () => void } | null = null;

  function refreshBtn(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    openBtn.textContent = best > 0 ? `♾️ 星轨长跑 · 最远 ${best} 米` : "♾️ 星轨长跑 · 点我开跑！";
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
    mapHint: "赢得越多、甩开小电脑越远，星星越多！",
    grandMessage: "188 场比赛全部夺冠，你就是赛跑总冠军！",
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
