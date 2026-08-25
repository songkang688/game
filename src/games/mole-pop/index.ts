import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, type MoleLevel } from "./levels";

type MoleKind = "normal" | "sleepy" | "gold" | "bunny";

interface HoleState {
  kind: MoleKind | null;
  hideAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const CSS = `
.mp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAF6D8, #F7EFD8); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.mp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.mp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #8A7A3E; box-shadow: 0 2px 6px rgba(170,150,90,.25); font-size: 14px; }
.mp-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mp-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #C8E06E, #8FBB4E); border-radius: 8px; transition: width .3s; }
.mp-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mp-hole { aspect-ratio: 1; border: none; border-radius: 50%; cursor: pointer; font-size: clamp(30px, 11vw, 52px); background: radial-gradient(circle at 50% 62%, #9A7B4F 0 42%, #C9A876 46% 60%, #E4D3AE 64%); display: flex; align-items: center; justify-content: center; padding: 0; transition: transform .08s; }
.mp-hole:active { transform: scale(.93); }
.mp-hole .mp-face { transform: translateY(6px); animation: mpUp .18s ease; }
@keyframes mpUp { from { transform: translateY(26px); opacity: .4; } to { transform: translateY(6px); opacity: 1; } }
.mp-msg { text-align: center; min-height: 20px; color: #8A7A3E; font-weight: 700; margin-top: 10px; font-size: 14px; }
`;

const FACE: Record<MoleKind, string> = {
  normal: "🐹",
  sleepy: "😴",
  gold: "🌟",
  bunny: "🐰",
};

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MoleLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let destroyed = false;
  let ended = false;
  let score = 0;
  let mistakes = 0;
  let timeLeft = cfg.duration;
  const holes: HoleState[] = Array.from({ length: 9 }, () => ({ kind: null, hideAt: 0, timer: null }));

  const wrap = document.createElement("div");
  wrap.className = "mp-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mp-top">
      <span class="mp-badge mp-score">🔨 0 / ${cfg.target}</span>
      <span class="mp-badge mp-time">⏰ ${cfg.duration}s</span>
      ${cfg.bunnyChance > 0 ? '<span class="mp-badge mp-heart">💗💗💗</span>' : ""}
    </div>
    <div class="mp-bar"><div class="mp-fill"></div></div>
    <div class="mp-board"></div>
    <div class="mp-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".mp-board") as HTMLElement;
  const scoreEl = wrap.querySelector(".mp-score") as HTMLElement;
  const timeEl = wrap.querySelector(".mp-time") as HTMLElement;
  const heartEl = wrap.querySelector(".mp-heart") as HTMLElement | null;
  const fillEl = wrap.querySelector(".mp-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mp-msg") as HTMLElement;

  const tips: string[] = [];
  if (cfg.sleepyChance > 0) tips.push("😴 瞌睡鼠待得久");
  if (cfg.goldChance > 0) tips.push("🌟 金地鼠一只顶两只");
  if (cfg.bunnyChance > 0) tips.push("🐰 小兔子不能拍");
  msgEl.textContent = tips.length > 0 ? tips.join("；") + "！" : "地鼠冒头就拍它！";

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
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

  function renderHole(i: number): void {
    const h = holes[i];
    holeEls[i].innerHTML = h.kind ? `<span class="mp-face">${FACE[h.kind]}</span>` : "";
  }

  function renderTop(): void {
    scoreEl.textContent = `🔨 ${score} / ${cfg.target}`;
    timeEl.textContent = `⏰ ${timeLeft}s`;
    if (heartEl) heartEl.textContent = "💗".repeat(Math.max(0, 3 - mistakes)) + "🤍".repeat(Math.min(3, mistakes));
    fillEl.style.width = `${Math.min(100, (score / cfg.target) * 100)}%`;
  }

  function hideMole(i: number): void {
    const h = holes[i];
    h.kind = null;
    if (h.timer) { clearTimeout(h.timer); h.timer = null; }
    renderHole(i);
  }

  function spawn(): void {
    if (ended || destroyed) return;
    const active = holes.filter((h) => h.kind !== null).length;
    if (active >= cfg.maxConcurrent) return;
    const free: number[] = [];
    holes.forEach((h, i) => { if (h.kind === null) free.push(i); });
    if (free.length === 0) return;
    const i = free[Math.floor(Math.random() * free.length)];
    const r = Math.random();
    let kind: MoleKind = "normal";
    if (r < cfg.bunnyChance) kind = "bunny";
    else if (r < cfg.bunnyChance + cfg.goldChance) kind = "gold";
    else if (r < cfg.bunnyChance + cfg.goldChance + cfg.sleepyChance) kind = "sleepy";
    const h = holes[i];
    h.kind = kind;
    const stay = cfg.upMsMin + Math.random() * (cfg.upMsMax - cfg.upMsMin);
    const ms = kind === "sleepy" ? stay * 1.8 : kind === "bunny" ? stay * 1.4 : stay;
    h.timer = setTimeout(() => {
      h.timer = null;
      if (!destroyed && !ended) hideMole(i);
    }, ms);
    timeouts.add(h.timer);
    renderHole(i);
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    holes.forEach((_, i) => hideMole(i));
    if (won) {
      const frac = timeLeft / cfg.duration;
      const got = mistakes === 0 && frac >= 0.12 ? 3 : mistakes <= 1 ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `拍中 ${cfg.target} 分，还剩 ${timeLeft} 秒，好快的手！`), 350);
    } else {
      later(() => ctx.lose(mistakes >= 3
        ? "小兔子被拍到三次啦，下次看清楚再出手～"
        : `时间到，拍到了 ${score} 分，再快一点点就赢了！`), 350);
    }
  }

  function onHole(i: number): void {
    if (ended) return;
    const h = holes[i];
    if (!h.kind) {
      ctx.sfx("tap");
      return;
    }
    if (h.kind === "bunny") {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent = "哎呀，那是小兔子！轻轻放它回家～";
      hideMole(i);
      renderTop();
      if (mistakes >= 3) finish(false);
      return;
    }
    const gain = h.kind === "gold" ? 2 : 1;
    score += gain;
    ctx.sfx(h.kind === "gold" ? "coin" : "pop");
    if (h.kind === "gold") msgEl.textContent = "🌟 金地鼠 +2！";
    hideMole(i);
    renderTop();
    if (score >= cfg.target) finish(true);
  }

  const clock = setInterval(() => {
    if (ended || destroyed) return;
    timeLeft--;
    renderTop();
    if (timeLeft <= 0) finish(score >= cfg.target);
  }, 1000);
  intervals.add(clock);

  const spawner = setInterval(() => spawn(), cfg.gapMs);
  intervals.add(spawner);
  later(() => spawn(), 350);
  renderTop();

  return {
    destroy() {
      destroyed = true;
      ended = true;
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
    mapHint: "不拍错、留点时间，就能拿 3 星！",
    grandMessage: "99 关地鼠全部拍完，锤子小冠军就是你！",
  });
}
