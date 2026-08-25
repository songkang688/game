import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { CHAPTERS, LEVELS, type TugLevel } from "./levels";

const WIN_AT = 100;

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
.rbg-ctrl { display: flex; justify-content: center; gap: 14px; }
.rbg-pull { flex: 1; max-width: 170px; height: 72px; border: none; border-radius: 20px; font-size: 22px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #FF8A8A, #E85555); cursor: pointer; box-shadow: 0 5px 0 #C23B3B; font-family: inherit; touch-action: manipulation; }
.rbg-pull:active { transform: translateY(3px); box-shadow: 0 2px 0 #C23B3B; }
.rbg-pull.rbg-blue { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rbg-pull.rbg-blue:active { box-shadow: 0 2px 0 #3B55C2; }
.rbg-msg { text-align: center; min-height: 22px; color: #C25555; font-weight: 700; margin-top: 8px; font-size: 15px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: TugLevel = LEVELS[ctx.level];
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

  const wrap = document.createElement("div");
  wrap.className = "rbg-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="rbg-top">
      <span class="rbg-badge" style="color:#C24545"><img class="rbg-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />🔴 朵朵队 · 你</span>
      ${cfg.redlight ? '<span class="rbg-light">🟢</span>' : ""}
      <span class="rbg-badge rbg-badge-right" style="color:#3576BF">🔵 星星队 · 小电脑<img class="rbg-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
    </div>
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
  stage.appendChild(wrap);

  const flagEl = wrap.querySelector(".rbg-flag") as HTMLElement;
  const ropeEl = wrap.querySelector(".rbg-rope") as HTMLElement;
  const redEl = wrap.querySelector(".rbg-red") as HTMLElement;
  const blueEl = wrap.querySelector(".rbg-blue-team") as HTMLElement;
  const fieldEl = wrap.querySelector(".rbg-field") as HTMLElement;
  const lightEl = wrap.querySelector(".rbg-light") as HTMLElement | null;
  const msgEl = wrap.querySelector(".rbg-msg") as HTMLElement;

  msgEl.textContent = cfg.rhythm
    ? "左手右手轮着点，节奏对了才有力！"
    : cfg.redlight
      ? "看到 🟢 才能拉，🔴 时拉绳会打滑！"
      : cfg.star
        ? "狂点拉绳，⭐ 出现就赶紧抢！"
        : "狂点按钮，把小旗拉到你这边！";

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function render(): void {
    // pos +100 → 旗到左边 15%（你这边），-100 → 右边 85%
    const flagPct = 50 - (pos / WIN_AT) * 35;
    flagEl.style.left = `calc(${flagPct}% - 13px)`;
    ropeEl.style.left = `calc(${flagPct}% - 90px)`;
    ropeEl.style.width = "180px";
    redEl.style.left = `calc(${flagPct}% - 140px)`;
    blueEl.style.left = `calc(${flagPct}% + 66px)`;
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    if (won) {
      const secs = (performance.now() - startAt) / 1000;
      const got = secs <= 16 ? 3 : secs <= 28 ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `嘿咻！只用 ${Math.round(secs)} 秒就拔赢了小电脑！`), 400);
    } else {
      later(() => ctx.lose("绳子被拉走啦，点得再快一点、看准时机！"), 400);
    }
  }

  function pull(power: number): void {
    if (ended) return;
    if (cfg.redlight && !green) {
      pos = Math.max(-WIN_AT, pos - 6);
      ctx.sfx("oops");
      msgEl.textContent = "🔴 红灯拉绳打滑啦！等绿灯！";
      render();
      return;
    }
    pos = Math.min(WIN_AT, pos + power);
    ctx.sfx("tap");
    render();
    if (pos >= WIN_AT) finish(true);
  }

  function onHand(hand: "L" | "R"): void {
    if (ended) return;
    if (lastHand === hand) {
      msgEl.textContent = "要换另一只手啦，左右轮着来！";
      ctx.sfx("oops");
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
      btn.style.left = `${15 + Math.random() * 70}%`;
      btn.style.top = `${8 + Math.random() * 50}%`;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended) return;
        btn.remove();
        ctx.sfx("coin");
        msgEl.textContent = "⭐ 加油星！猛拉一大把！";
        pos = Math.min(WIN_AT, pos + 12);
        render();
        if (pos >= WIN_AT) finish(true);
      });
      fieldEl.appendChild(btn);
      later(() => btn.remove(), 1600);
    }, 2600);
    intervals.add(starSpawner);
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    pos = Math.max(-WIN_AT, pos - cfg.aiRate * dt);
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

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "拔得越快星星越多，六大赛场等你称王！",
    grandMessage: "99 场拔河全部胜利，大力士奖杯归你！",
  });
}
