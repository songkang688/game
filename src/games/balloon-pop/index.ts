import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, type BalloonLevel } from "./levels";

export const meta = {
  id: "balloon-pop",
  title: "气球砰砰",
  emoji: "🎈",
  category: "casual" as const,
  color: "#ff8fab",
  blurb: "99 关六大天空！颜色指令、数字顺序、乌云捣乱、彩虹清屏！",
};

const H = 420;

const BALLOON_COLORS = [
  { name: "红", css: "radial-gradient(circle at 35% 30%, #FFB3B3, #F0605F)", key: "#F0605F" },
  { name: "黄", css: "radial-gradient(circle at 35% 30%, #FFF0B3, #F5C142)", key: "#F5C142" },
  { name: "蓝", css: "radial-gradient(circle at 35% 30%, #B3D9FF, #4F94E8)", key: "#4F94E8" },
  { name: "绿", css: "radial-gradient(circle at 35% 30%, #C9F0B3, #6BBB4E)", key: "#6BBB4E" },
  { name: "紫", css: "radial-gradient(circle at 35% 30%, #E3CCFF, #9E6BD9)", key: "#9E6BD9" },
];

type Kind = "normal" | "cloud" | "rainbow";

interface Balloon {
  el: HTMLButtonElement;
  y: number;
  x: number;
  kind: Kind;
  color: number;
  num: number;
  sway: number;
  gone: boolean;
}

const CSS = `
.blp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.blp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.blp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #C75A82; box-shadow: 0 2px 6px rgba(210,120,160,.25); font-size: 14px; }
.blp-sky { position: relative; height: ${H}px; border-radius: 16px; overflow: hidden; }
.blp-balloon { position: absolute; width: 56px; height: 68px; border: none; border-radius: 50% 50% 46% 46%; cursor: pointer; font-size: 22px; font-weight: 900; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.3); padding: 0; }
.blp-balloon::after { content: ""; position: absolute; left: 50%; bottom: -12px; width: 2px; height: 12px; background: rgba(120,100,90,.5); }
.blp-balloon:active { transform: scale(.9); }
.blp-pop { animation: blpPop .22s ease forwards; pointer-events: none; }
@keyframes blpPop { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
.blp-msg { text-align: center; min-height: 20px; color: #C75A82; font-weight: 700; margin-top: 8px; font-size: 14px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BalloonLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let raf = 0;
  let lastTime = 0;
  let destroyed = false;
  let ended = false;
  let popped = 0;
  let mistakes = 0;
  let escaped = 0;
  let targetColor = Math.floor(Math.random() * BALLOON_COLORS.length);
  let targetNum = 1;
  let sincePops = 0;
  const balloons: Balloon[] = [];

  const wrap = document.createElement("div");
  wrap.className = "blp-wrap";
  wrap.style.background = cfg.night
    ? "linear-gradient(180deg, #3E4578, #7A6BA8)"
    : "linear-gradient(180deg, #DFF1FF, #FFE9F3)";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="blp-top">
      <span class="blp-badge blp-score">🎈 0 / ${cfg.target}</span>
      <span class="blp-badge blp-order"></span>
      <span class="blp-badge blp-life">💗💗💗</span>
    </div>
    <div class="blp-sky" style="background:${cfg.night ? "linear-gradient(180deg,#2E3560,#5A4E8C)" : "linear-gradient(180deg,#C5E8FF,#F0F8FF)"}"></div>
    <div class="blp-msg"></div>
  `;
  stage.appendChild(wrap);

  const skyEl = wrap.querySelector(".blp-sky") as HTMLElement;
  const scoreEl = wrap.querySelector(".blp-score") as HTMLElement;
  const orderEl = wrap.querySelector(".blp-order") as HTMLElement;
  const lifeEl = wrap.querySelector(".blp-life") as HTMLElement;
  const msgEl = wrap.querySelector(".blp-msg") as HTMLElement;

  msgEl.textContent =
    cfg.mode === "color"
      ? "看清指令颜色再戳！"
      : cfg.mode === "number"
        ? "按 1→2→3→4→5 的顺序戳气球！"
        : cfg.cloudChance > 0
          ? "乌云球 ☁️ 不能戳哦！"
          : "气球飘上来就戳破它！";

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderTop(): void {
    scoreEl.textContent = `🎈 ${popped} / ${cfg.target}`;
    lifeEl.textContent = "💗".repeat(Math.max(0, 3 - mistakes)) + "🤍".repeat(Math.min(3, mistakes));
    if (cfg.mode === "color") {
      orderEl.textContent = `🎯 戳${BALLOON_COLORS[targetColor].name}色`;
      orderEl.style.color = BALLOON_COLORS[targetColor].key;
    } else if (cfg.mode === "number") {
      orderEl.textContent = `🎯 下一个：${targetNum}`;
    } else {
      orderEl.textContent = `🌤️ 可飘走 ${Math.max(0, cfg.escapes - escaped)}`;
    }
  }

  function finish(won: boolean, reason?: string): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    if (won) {
      const bad = mistakes + Math.max(0, escaped - 1);
      const got = bad === 0 ? 3 : bad <= 2 ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `砰砰砰！${cfg.target} 个气球全部搞定！`), 350);
    } else {
      later(() => ctx.lose(reason ?? "气球飞走的有点多，站到它们下面早点戳！"), 350);
    }
  }

  function isTarget(b: Balloon): boolean {
    if (b.kind !== "normal") return false;
    if (cfg.mode === "color") return b.color === targetColor;
    if (cfg.mode === "number") return b.num === targetNum;
    return true;
  }

  function removeBalloon(b: Balloon, popAnim: boolean): void {
    b.gone = true;
    if (popAnim) {
      b.el.classList.add("blp-pop");
      later(() => b.el.remove(), 240);
    } else {
      b.el.remove();
    }
  }

  function popNormal(b: Balloon): void {
    ctx.sfx("pop");
    popped++;
    sincePops++;
    removeBalloon(b, true);
    if (cfg.mode === "number") {
      targetNum = targetNum >= 5 ? 1 : targetNum + 1;
    } else if (cfg.mode === "color" && sincePops >= 4) {
      sincePops = 0;
      let next = Math.floor(Math.random() * BALLOON_COLORS.length);
      if (next === targetColor) next = (next + 1) % BALLOON_COLORS.length;
      targetColor = next;
      msgEl.textContent = `指令换啦：现在戳${BALLOON_COLORS[targetColor].name}色！`;
    }
    renderTop();
    if (popped >= cfg.target) finish(true);
  }

  function onBalloon(b: Balloon): void {
    if (ended || b.gone) return;
    if (b.kind === "cloud") {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent = "☁️ 乌云球不能戳！";
      removeBalloon(b, true);
      renderTop();
      if (mistakes >= 3) finish(false, "乌云球戳到三次啦，看清楚再出手～");
      return;
    }
    if (b.kind === "rainbow") {
      ctx.sfx("coin");
      msgEl.textContent = "🌈 彩虹清屏！";
      let cleared = 0;
      for (const other of balloons) {
        if (!other.gone && other.kind === "normal") {
          if (cfg.mode === "free" || isTarget(other)) {
            cleared++;
            popped++;
          }
          removeBalloon(other, true);
        }
      }
      removeBalloon(b, true);
      if (cleared >= 4) ctx.bonusStars(1);
      renderTop();
      if (popped >= cfg.target) finish(true);
      return;
    }
    if (!isTarget(b)) {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent = cfg.mode === "color"
        ? `现在要戳${BALLOON_COLORS[targetColor].name}色的！`
        : `要按顺序，下一个是 ${targetNum}！`;
      renderTop();
      if (mistakes >= 3) finish(false, "戳错三次啦，看清指令再出手，你可以的！");
      return;
    }
    popNormal(b);
  }

  function spawn(): void {
    if (ended || destroyed) return;
    const r = Math.random();
    let kind: Kind = "normal";
    if (r < cfg.cloudChance) kind = "cloud";
    else if (r < cfg.cloudChance + cfg.rainbowChance) kind = "rainbow";
    const color = Math.floor(Math.random() * BALLOON_COLORS.length);
    const num = 1 + Math.floor(Math.random() * 5);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "blp-balloon";
    if (kind === "cloud") {
      el.style.background = "radial-gradient(circle at 35% 30%, #E8E8EE, #9A9AAE)";
      el.textContent = "☁️";
    } else if (kind === "rainbow") {
      el.style.background = "conic-gradient(#F0605F, #F5C142, #6BBB4E, #4F94E8, #9E6BD9, #F0605F)";
      el.textContent = "🌈";
    } else {
      el.style.background = BALLOON_COLORS[color].css;
      el.textContent = cfg.mode === "number" ? String(num) : "";
    }
    const b: Balloon = {
      el,
      x: 8 + Math.random() * 76,
      y: H + 40,
      kind,
      color,
      num,
      sway: Math.random() * Math.PI * 2,
      gone: false,
    };
    el.style.left = `${b.x}%`;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onBalloon(b);
    });
    skyEl.appendChild(el);
    balloons.push(b);
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.gone) {
        balloons.splice(i, 1);
        continue;
      }
      b.y -= cfg.riseSpeed * dt;
      b.sway += dt * 2;
      b.el.style.top = `${b.y}px`;
      b.el.style.marginLeft = `${Math.sin(b.sway) * 8}px`;
      if (b.y < -80) {
        const wasTarget = isTarget(b);
        removeBalloon(b, false);
        balloons.splice(i, 1);
        if (wasTarget) {
          escaped++;
          renderTop();
          if (escaped > cfg.escapes) {
            finish(false);
            return;
          }
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  const spawner = setInterval(() => spawn(), cfg.spawnMs);
  intervals.add(spawner);
  spawn();
  renderTop();
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
    mapHint: "不戳错、不放跑气球，就能拿 3 星！",
    grandMessage: "99 关气球全部砰砰完，天空都被你点亮啦！",
  });
}
