import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, type TapLevel } from "./levels";

export const meta = {
  id: "red-blue-tap",
  title: "红蓝点点",
  emoji: "🎈",
  category: "party" as const,
  color: "#4dabf7",
  blurb: "99 关六大赛场！抢蓝点、躲陷阱、双子点点，和小电脑拼手速！",
};

/** 各主题的「该抢的点」与「陷阱点」外观 */
const SKINS = [
  { mine: "🔵", trap: "🔴" },
  { mine: "🔵", trap: "🔴" },
  { mine: "⭐", trap: "🌑" },
  { mine: "⚡", trap: "🌩️" },
  { mine: "💙", trap: "❤️" },
  { mine: "👑", trap: "💣" },
];

const CSS = `
.rbt-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4F0FF, #FFE9F0); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbt-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
.rbt-badge { background: #fff; border-radius: 14px; padding: 5px 12px; font-weight: 800; font-size: 15px; box-shadow: 0 2px 6px rgba(120,140,200,.25); }
.rbt-me { color: #3576BF; }
.rbt-ai { color: #C24545; }
.rbt-arena { position: relative; height: 320px; border-radius: 16px; background: #ffffffa8; overflow: hidden; }
.rbt-dot { position: absolute; width: 62px; height: 62px; border: none; background: #fff; border-radius: 50%; font-size: 34px; cursor: pointer; box-shadow: 0 4px 10px rgba(100,120,180,.3); padding: 0; animation: rbtIn .18s ease; }
@keyframes rbtIn { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.rbt-dot:active { transform: scale(.88); }
.rbt-msg { text-align: center; min-height: 22px; color: #5B7FC9; font-weight: 700; margin-top: 10px; font-size: 15px; }
`;

interface Dot {
  el: HTMLButtonElement;
  trap: boolean;
  aiTimer: ReturnType<typeof setTimeout>;
  gone: boolean;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: TapLevel = LEVELS[ctx.level];
  const skin = SKINS[cfg.theme];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let meScore = 0;
  let aiScore = 0;
  const dots = new Set<Dot>();

  const wrap = document.createElement("div");
  wrap.className = "rbt-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="rbt-top">
      <span class="rbt-badge rbt-me">你 0</span>
      <span class="rbt-badge">先到 ${cfg.targetPoints} 分</span>
      <span class="rbt-badge rbt-ai">小电脑 0</span>
    </div>
    <div class="rbt-arena"></div>
    <div class="rbt-msg"></div>
  `;
  stage.appendChild(wrap);

  const arenaEl = wrap.querySelector(".rbt-arena") as HTMLElement;
  const meEl = wrap.querySelector(".rbt-me") as HTMLElement;
  const aiEl = wrap.querySelector(".rbt-ai") as HTMLElement;
  const msgEl = wrap.querySelector(".rbt-msg") as HTMLElement;

  msgEl.textContent = cfg.trapChance > 0
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
    meEl.textContent = `你 ${meScore}`;
    aiEl.textContent = `小电脑 ${aiScore}`;
  }

  function clearDots(): void {
    dots.forEach((d) => {
      clearTimeout(d.aiTimer);
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
      later(() => ctx.win(got as 1 | 2 | 3, `${meScore} 比 ${aiScore}，你赢了小电脑！`), 400);
    } else {
      later(() => ctx.lose("小电脑这局手快了一点，盯紧屏幕再来！"), 400);
    }
  }

  function score(mine: boolean, msg?: string): void {
    if (ended) return;
    if (mine) {
      meScore++;
      ctx.sfx("coin");
    } else {
      aiScore++;
      ctx.sfx("oops");
    }
    if (msg) msgEl.textContent = msg;
    renderTop();
    if (meScore >= cfg.targetPoints || aiScore >= cfg.targetPoints) {
      finish();
      return;
    }
    if (dots.size === 0) later(spawnRound, 550);
  }

  function removeDot(d: Dot): void {
    d.gone = true;
    clearTimeout(d.aiTimer);
    d.el.remove();
    dots.delete(d);
  }

  function spawnDot(trap: boolean): void {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "rbt-dot";
    el.textContent = trap ? skin.trap : skin.mine;
    el.style.left = `${6 + Math.random() * 72}%`;
    el.style.top = `${6 + Math.random() * 72}%`;
    const d: Dot = {
      el,
      trap,
      gone: false,
      aiTimer: setTimeout(() => {
        if (destroyed || ended || d.gone) return;
        removeDot(d);
        if (!trap) {
          // 小电脑抢走了
          score(false, "被小电脑抢走啦，再快一点！");
        } else if (dots.size === 0 && !ended) {
          later(spawnRound, 400);
        }
      }, trap ? cfg.aiDelayMs * 1.6 : cfg.aiDelayMs + Math.random() * 200),
    };
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (ended || d.gone) return;
      removeDot(d);
      if (trap) {
        score(false, `碰到 ${skin.trap} 啦，这可是陷阱！`);
      } else {
        ctx.sfx("pop");
        score(true, "抢到！");
      }
    });
    arenaEl.appendChild(el);
    dots.add(d);
  }

  function spawnRound(): void {
    if (ended || destroyed || dots.size > 0) return;
    const count = cfg.double ? 2 : 1;
    for (let i = 0; i < count; i++) {
      spawnDot(Math.random() < cfg.trapChance);
    }
    // 保证每轮至少有一个能抢的点
    if ([...dots].every((d) => d.trap)) spawnDot(false);
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

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "让小电脑得分越少，星星越多！",
    grandMessage: "99 场抢点大战全部获胜，你的手速天下第一！",
  });
}
