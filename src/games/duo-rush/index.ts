import { meta } from "./meta";
export { meta };

// 朵星双人冲刺 —— 2.5D 双人分屏无尽竞速。
// 两个人各占半屏，各自三条车道向远处收拢；赛道是同一份，比的完全是操作。
// 玩法状态机在 match.ts，透视投影在 view25d.ts，键位在 keys.ts，
// 这里只干三件事：把画面画出来、把输入接进去、离开时清干净。
import { AI_HINTS, AI_LABELS, AI_LEVELS, type AiLevel } from "./ai";
import {
  type Action,
  type Seat,
  isPauseKey,
  isWatchedKey,
  resolveKey,
  seatAtPoint,
  swipeAction,
} from "./keys";
import {
  BOOST_SECONDS,
  COIN_RACE_TARGET,
  CRASH_LIMIT,
  GHOST_KEY,
  GHOST_MIN_DIST,
  JUMP_SECONDS,
  SLIDE_SECONDS,
  type Entity,
  type GhostRecord,
  type RaceMode,
  betterGhost,
  makeGhostRecord,
  parseGhostRecord,
  serializeGhostRecord,
} from "./logic";
import {
  type MatchState,
  type Runner,
  applyAction,
  createMatch,
  drainEvents,
  livesLeft,
  stepMatch,
} from "./match";
import {
  DRAW_DISTANCE,
  GRID_SPACING,
  JUMP_LIFT_RATIO,
  RUNNER_Z,
  type Rect,
  type SplitLayout,
  fogAlpha,
  gridLineZs,
  groundY,
  horizonY,
  jumpArc,
  laneWidthAt,
  paneRects,
  parallaxOffset,
  project,
  slideSquash,
  stageSize,
} from "./view25d";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---- 头像：PNG 到位后自动使用，暂时用可爱占位 ---- */
const AVATAR_URLS = import.meta.glob("../../assets/avatars/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function avatarUrl(who: "duoduo" | "xingxing"): string | undefined {
  return AVATAR_URLS[`../../assets/avatars/${who === "duoduo" ? "duoduo-q.png" : "xingxing-q.png"}`];
}

function avatarHTML(who: "duoduo" | "xingxing", size = 26): string {
  const url = avatarUrl(who);
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : "⭐";
  const bg = who === "duoduo" ? "#FFD9E8" : "#D9E6FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(size * 0.58)}px;vertical-align:middle">${emoji}</span>`;
}

/**
 * 「小屋·收藏」面板是第 6 步另一位同学在做的，可能还没进仓库。
 * 用 glob 探一眼：文件不在就连按钮都不出现，绝不因为缺模块把这一款打崩。
 */
const COLLECTION_MODULES = import.meta.glob("../../ui/collection.ts");
const COLLECTION_PATH = "../../ui/collection.ts";

function hasCollection(): boolean {
  return typeof COLLECTION_MODULES[COLLECTION_PATH] === "function";
}

async function openCollectionSafely(): Promise<void> {
  const loader = COLLECTION_MODULES[COLLECTION_PATH];
  if (typeof loader !== "function") return;
  try {
    const mod = (await loader()) as { openCollection?: (scope?: string) => void };
    mod.openCollection?.("duo-rush");
  } catch {
    // 面板加载不出来就当没这个按钮，比赛照常跑
  }
}

/* ---------------- 配色 ---------------- */

interface Theme {
  sky: [string, string];
  farHill: string;
  nearHill: string;
  /** 路两边的草地（近处、远处） */
  field: [string, string];
  /** 路面本身 */
  road: string;
  /** 路面上的标线颜色（"r,g,b"，透明度按远近另算） */
  mark: string;
  roadEdge: string;
  ink: string;
  hud: string;
}

const THEMES: [Theme, Theme] = [
  {
    sky: ["#FFF3F8", "#FFD3E6"],
    farHill: "#F6C2D9",
    nearHill: "#EDA3C3",
    field: ["#F3B9D2", "#E79FC0"],
    road: "#FFF1F7",
    mark: "236,158,192",
    roadEdge: "#F4AECC",
    ink: "#C2497E",
    hud: "rgba(255,255,255,.85)",
  },
  {
    sky: ["#F1F7FF", "#CFE2FF"],
    farHill: "#B7D2F4",
    nearHill: "#98BCEA",
    field: ["#AFCCF0", "#93B6E4"],
    road: "#F2F8FF",
    mark: "146,180,226",
    roadEdge: "#9CC0EA",
    ink: "#3A6BB0",
    hud: "rgba(255,255,255,.85)",
  },
];

const MODE_LABELS: Record<RaceMode, string> = {
  rush: "无尽竞速",
  ghost: "幽灵对战",
  endless: "无尽对战",
  coins: "抢金币赛",
};

const RULES_HTML = `
  <h3>🏁 四种赛制</h3>
  <p><b>🏁 无尽竞速</b>：两个人一直往前跑，<b>先撞满 ${CRASH_LIMIT} 次的人输</b>，跑得再远也救不回来。<br>
  <b>👻 幽灵对战</b>：和自己上一次的最好成绩赛跑，半透明的小影子就是上一次的你，<b>跑得比它远就赢</b>。<br>
  <b>♾️ 无尽对战</b>：各有 ${CRASH_LIMIT} 颗心，都用完了比谁跑得远。<br>
  <b>🪙 抢金币赛</b>：撞了不掉心但会绊一下，<b>先吃到 ${COIN_RACE_TARGET} 枚金币</b>的人获胜。</p>
  <h3>⌨️ 两个人怎么分键</h3>
  <p>朵朵用左手：<b>W 跳 / A 左道 / S 下滑 / D 右道</b>。<br>
  星星用右手：<b>↑ 跳 / ← 左道 / ↓ 下滑 / → 右道</b>。<br>
  两套键完全分开，同时按也不会串台。<b>Esc</b> 随时暂停。</p>
  <h3>📱 手机怎么玩</h3>
  <p>画面切成两半，<b>各自在自己那半边滑</b>：上滑跳、下滑滚、左右滑换道，和键盘一模一样。</p>
  <h3>🚧 四种障碍</h3>
  <p>🪨 <b>大石头</b>：跳不过也钻不过，只能<b>提前换道</b>。<br>
  🚧 <b>矮木栏</b>：按<b>跳</b>跃过去。<br>
  🕳️ <b>泥坑</b>：也要<b>跳</b>，踩进去就摔。<br>
  🎏 <b>高横杆</b>：架得高，要按<b>下滑</b>钻过去，跳起来反而撞得更结实。</p>
  <h3>🪙 路上的好东西</h3>
  <p>🪙 金币：吃一枚加 1 分。⚡ 加速带：踩上去冲刺 ${BOOST_SECONDS} 秒，超车全靠它。</p>
  <h3>🤖 一个人也能玩</h3>
  <p>选「电脑对手」就有三档：<b>新手</b>反应慢还爱愣神，<b>稳当</b>基本不失误，<b>高手</b>几乎不出错——但它也有反应延迟，抓住那半拍就能超过去。</p>
  <h3>📈 小提醒</h3>
  <p>速度会随距离一直往上涨（有封顶，不会快到反应不过来）。能换道就别跳，跳在半空中没法再改主意。</p>
`;

/* ---------------- 幽灵存档 ---------------- */

function loadGhost(): GhostRecord | null {
  try {
    return parseGhostRecord(localStorage.getItem(GHOST_KEY));
  } catch {
    return null;
  }
}

function saveGhost(rec: GhostRecord): void {
  try {
    localStorage.setItem(GHOST_KEY, serializeGhostRecord(rec));
  } catch {
    // 隐私模式写不进去就算了，比赛不受影响
  }
}

/* ---------------- 挂载 ---------------- */

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let endTimer = 0;
  let countTimer = 0;

  let mode: RaceMode = "rush";
  /** null = 两个真人；数字 = 电脑档位 */
  let aiLevel: AiLevel | null = null;
  let state: MatchState | null = null;
  let running = false;
  let paused = false;
  let ghost: GhostRecord | null = loadGhost();

  const wrap = document.createElement("div");
  wrap.className = "dr-wrap";
  wrap.innerHTML = `
    <style>
      .dr-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FFEEF6); border-radius: 20px; padding: 12px; max-width: 1000px; margin: 0 auto; user-select: none; position: relative; }
      .dr-panel { display: flex; flex-direction: column; gap: 12px; padding: 8px 4px; }
      .dr-label { font-weight: 800; color: #4A7AA8; font-size: 15px; margin-bottom: 6px; }
      .dr-seg { display: flex; gap: 8px; flex-wrap: wrap; }
      .dr-seg button { flex: 1 1 150px; min-height: 48px; border: 3px solid #BFDDF2; background: #FDFEFF; border-radius: 16px; padding: 10px 8px; font-size: 15px; font-weight: 700; color: #4A7AA8; cursor: pointer; font-family: inherit; }
      .dr-seg button.on { border-color: #F2A0C0; background: #FFE4EF; color: #C2497E; }
      .dr-hint { color: #6E86A0; font-size: 13.5px; margin: 8px 2px 0; min-height: 19px; line-height: 1.5; }
      .dr-ghostline { color: #8A6AB0; font-size: 13.5px; font-weight: 700; margin: 0 2px; min-height: 19px; }
      .dr-start { border: none; border-radius: 18px; padding: 15px; font-size: 20px; font-weight: 800; background: #8FD3FF; color: #14496E; cursor: pointer; box-shadow: 0 5px 0 #64AEE0; width: 100%; font-family: inherit; }
      .dr-start:active { transform: translateY(3px); box-shadow: 0 2px 0 #64AEE0; }
      .dr-softbtn { border: none; border-radius: 16px; padding: 12px; font-size: 16px; font-weight: 800; background: #D9F2C4; color: #4A7A2A; cursor: pointer; box-shadow: 0 4px 0 #ADD68E; width: 100%; font-family: inherit; }
      .dr-softbtn:active { transform: translateY(2px); box-shadow: 0 2px 0 #ADD68E; }
      .dr-collectbtn { background: #FFE7C2; color: #9A5A20; box-shadow: 0 4px 0 #E2BE87; }
      .dr-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; background: #EAF3FF; }
      .dr-keys { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 8px 0 2px; font-size: 13px; font-weight: 700; }
      .dr-keys span { background: #fff; border-radius: 12px; padding: 5px 10px; box-shadow: 0 2px 5px rgba(90,140,190,.18); }
      .dr-keys .k1 { color: #C2497E; }
      .dr-keys .k2 { color: #3A6BB0; }
      .dr-btns { display: flex; gap: 8px; margin-top: 8px; }
      .dr-btns button { flex: 1; min-height: 46px; border: none; border-radius: 14px; padding: 11px 4px; font-size: 14.5px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); font-family: inherit; }
      .dr-pause { background: #E3E8FF; color: #4A55A8; }
      .dr-again { background: #D9F2C4; color: #4A7A2A; }
      .dr-back { background: #FFE0C2; color: #9A5A20; }
      .dr-msg { text-align: center; min-height: 22px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14.5px; line-height: 1.5; }
      .dr-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 84px; font-weight: 900; color: #FF7EA8; text-shadow: 0 4px 0 rgba(255,255,255,.85); z-index: 4; pointer-events: none; }
      .dr-pausepanel { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(244,250,255,.94); border-radius: 20px; z-index: 5; }
      .dr-pausepanel h3 { color: #C2497E; font-size: 22px; margin: 0; }
      .dr-pausepanel p { color: #4A6A8A; font-size: 14.5px; margin: 0; text-align: center; padding: 0 18px; line-height: 1.6; }
      .dr-resume { border: none; border-radius: 16px; padding: 13px 28px; font-size: 17px; font-weight: 800; background: #8FD3FF; color: #14496E; cursor: pointer; box-shadow: 0 4px 0 #64AEE0; font-family: inherit; }
      .dr-rules { position: absolute; inset: 0; background: #F4FAFF; border-radius: 20px; padding: 14px; overflow-y: auto; z-index: 6; }
      .dr-rules h3 { color: #C2497E; margin: 12px 0 4px; font-size: 17px; }
      .dr-rules p { color: #4A6A8A; font-size: 14.5px; line-height: 1.75; margin: 6px 0; }
      .dr-rules-close { position: sticky; top: 0; float: right; border: none; border-radius: 14px; background: #8FD3FF; color: #14496E; font-size: 15px; font-weight: 800; padding: 9px 16px; cursor: pointer; box-shadow: 0 3px 0 #64AEE0; font-family: inherit; }
      /* 放在最后:上面几条盖层自带 display:flex,权重一样时靠顺序压住它们 */
      .dr-wrap .dr-hidden { display: none; }
    </style>
    <div class="dr-panel dr-setup">
      <div>
        <div class="dr-label">🏁 选比赛方式</div>
        <div class="dr-seg dr-mode">
          <button type="button" data-v="rush" class="on">🏁 无尽竞速 · 先撞 ${CRASH_LIMIT} 次者输</button>
          <button type="button" data-v="ghost">👻 幽灵对战 · 追上次的自己</button>
          <button type="button" data-v="endless">♾️ 无尽对战 · 比谁远</button>
          <button type="button" data-v="coins">🪙 抢金币赛 · 先到 ${COIN_RACE_TARGET}</button>
        </div>
      </div>
      <div class="dr-rivalbox">
        <div class="dr-label">🙋 选对手</div>
        <div class="dr-seg dr-rival">
          <button type="button" data-v="human" class="on">${avatarHTML("xingxing", 22)} 两个人一起玩</button>
          <button type="button" data-v="0">🤖 电脑 · ${AI_LABELS[0]}</button>
          <button type="button" data-v="1">🤖 电脑 · ${AI_LABELS[1]}</button>
          <button type="button" data-v="2">🤖 电脑 · ${AI_LABELS[2]}</button>
        </div>
        <p class="dr-hint"></p>
      </div>
      <p class="dr-ghostline"></p>
      <button class="dr-softbtn dr-rulesbtn" type="button">📖 怎么玩（点我看规则）</button>
      <button class="dr-softbtn dr-collectbtn dr-hidden" type="button">🎁 我的收藏册</button>
      <button class="dr-start" type="button">准备好，开跑 ▶</button>
    </div>
    <div class="dr-game dr-hidden">
      <canvas class="dr-canvas" role="img" aria-label="两人分屏赛道"></canvas>
      <div class="dr-keys">
        <span class="k1">${avatarHTML("duoduo", 18)} 朵朵 W 跳 · A 左 · S 滑 · D 右</span>
        <span class="k2">${avatarHTML("xingxing", 18)} 星星 ↑ 跳 · ← 左 · ↓ 滑 · → 右</span>
        <span>📱 各自在自己那半边滑动</span>
      </div>
      <div class="dr-btns">
        <button class="dr-pause" type="button">⏸ 暂停</button>
        <button class="dr-again" type="button">🔄 再来一局</button>
        <button class="dr-back" type="button">🔧 换玩法</button>
      </div>
      <div class="dr-msg"></div>
      <div class="dr-count dr-hidden"></div>
      <div class="dr-pausepanel dr-hidden">
        <h3>⏸ 暂停中</h3>
        <p>喝口水、揉揉手指，准备好再继续。<br>按 Esc 或点下面的按钮回到比赛。</p>
        <button class="dr-resume" type="button">▶ 继续比赛</button>
      </div>
    </div>
    <div class="dr-rules dr-hidden">
      <button class="dr-rules-close" type="button">✖ 关闭</button>
      <h3 style="margin-top:2px">📖 朵星双人冲刺 · 规则</h3>
      ${RULES_HTML}
    </div>
  `;
  api.root.appendChild(wrap);

  const pick = <T extends HTMLElement>(sel: string): T => wrap.querySelector(sel) as T;
  const setupEl = pick(".dr-setup");
  const gameEl = pick(".dr-game");
  const rulesEl = pick(".dr-rules");
  const countEl = pick(".dr-count");
  const pauseEl = pick(".dr-pausepanel");
  const msgEl = pick(".dr-msg");
  const hintEl = pick(".dr-hint");
  const ghostLineEl = pick(".dr-ghostline");
  const rivalBox = pick(".dr-rivalbox");
  const collectBtn = pick<HTMLButtonElement>(".dr-collectbtn");
  const canvas = pick<HTMLCanvasElement>(".dr-canvas");
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  if (hasCollection()) collectBtn.classList.remove("dr-hidden");

  /* ---------------- 画布尺寸 ---------------- */

  let size = { width: 360, height: 320, layout: "column" as SplitLayout };
  let panes: [Rect, Rect] = paneRects(size, size.layout);

  function relayout(): void {
    const avail = wrap.clientWidth - 24;
    size = stageSize(avail > 0 ? avail : 360);
    panes = paneRects(size, size.layout);
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  relayout();

  let ro: ResizeObserver | null = null;
  const onResize = (): void => relayout();
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => relayout());
    ro.observe(wrap);
  } else {
    window.addEventListener("resize", onResize);
  }

  /* ---------------- 头像 ---------------- */

  const avatarImgs: Array<HTMLImageElement | null> = [null, null];
  for (const [i, who] of (["duoduo", "xingxing"] as const).entries()) {
    const url = avatarUrl(who);
    if (!url) continue;
    const img = new Image();
    img.src = url;
    avatarImgs[i] = img;
  }

  function avatarReady(i: number): HTMLImageElement | null {
    const img = avatarImgs[i];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  /* ---------------- 设置面板 ---------------- */

  function refreshHint(): void {
    if (mode === "ghost") {
      hintEl.textContent = "幽灵对战是一个人的项目，对手就是上一次的自己。";
    } else if (aiLevel === null) {
      hintEl.textContent = "两个人一起玩：朵朵用左手 W A S D，星星用右手方向键。";
    } else {
      hintEl.textContent = `电脑 · ${AI_LABELS[aiLevel]}：${AI_HINTS[aiLevel]}`;
    }
    rivalBox.style.opacity = mode === "ghost" ? "0.45" : "1";
    for (const b of Array.from(wrap.querySelectorAll<HTMLButtonElement>(".dr-rival button"))) {
      b.disabled = mode === "ghost";
    }
    ghostLineEl.textContent = ghost
      ? `👻 上一次的最好成绩：${ghost.dist} 米（用了 ${ghost.seconds} 秒）`
      : `👻 还没有幽灵。先跑一局 ${GHOST_MIN_DIST} 米以上，它就会记下来。`;
  }

  function bindSeg(sel: string, onPick: (value: string) => void): void {
    pick(sel).addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn || btn.disabled) return;
      for (const b of Array.from(wrap.querySelectorAll(`${sel} button`))) b.classList.remove("on");
      btn.classList.add("on");
      api.play("tap");
      onPick(btn.dataset.v ?? "");
    });
  }

  bindSeg(".dr-mode", (v) => {
    mode = v as RaceMode;
    refreshHint();
  });
  bindSeg(".dr-rival", (v) => {
    aiLevel = v === "human" ? null : (Number(v) as AiLevel);
    refreshHint();
  });
  refreshHint();

  /* ---------------- 开局与收尾 ---------------- */

  function startRace(): void {
    clearTimeout(endTimer);
    clearTimeout(countTimer);
    const seed = (Math.random() * 0xffffffff) >>> 0;
    state = createMatch({ mode, seed, aiLevel, ghost });
    running = false;
    paused = false;
    pauseEl.classList.add("dr-hidden");
    setupEl.classList.add("dr-hidden");
    gameEl.classList.remove("dr-hidden");
    relayout();
    msgEl.textContent = openingLine();
    let n = 3;
    countEl.classList.remove("dr-hidden");
    countEl.textContent = "3";
    api.play("tap");
    const step = (): void => {
      if (destroyed) return;
      n--;
      if (n <= 0) {
        countEl.classList.add("dr-hidden");
        running = true;
        api.play("jump");
        return;
      }
      countEl.textContent = String(n);
      api.play("tap");
      countTimer = window.setTimeout(step, 700);
    };
    countTimer = window.setTimeout(step, 700);
  }

  function openingLine(): string {
    if (mode === "rush") return `两条赛道一模一样，先撞满 ${CRASH_LIMIT} 次的人输！`;
    if (mode === "ghost") {
      return ghost
        ? `追上那个半透明的自己——超过 ${ghost.dist} 米就赢了！`
        : "第一次跑，先把成绩留下来，下一局就有幽灵陪你了。";
    }
    if (mode === "coins") return `先吃到 ${COIN_RACE_TARGET} 枚金币就赢！`;
    return "三颗心用完就定格，比谁跑得远！";
  }

  function rememberGhost(s: MatchState): void {
    const rec = makeGhostRecord(s.runners[0].dist, s.time);
    if (!rec) return;
    const best = betterGhost(ghost, rec);
    if (best && best !== ghost) {
      ghost = best;
      saveGhost(best);
    }
  }

  function resultLine(s: MatchState): string {
    const [a, b] = s.runners;
    const meters = Math.floor(a.dist);
    if (s.winner === -1) {
      return `不分胜负！两个人都跑了 ${meters} 米，再来一局分高下。`;
    }
    if (s.mode === "ghost") {
      const best = s.ghost?.dist ?? 0;
      if (s.winner === 0) {
        return s.ghost
          ? `👻 追过去了！这一次 ${meters} 米，上一次只有 ${best} 米。`
          : `这一趟 ${meters} 米已经记下来啦，下一局就能和这个影子赛跑。`;
      }
      return `这一次 ${meters} 米，上一次跑到 ${best} 米。差的这一段，下一局补回来。`;
    }
    const w = s.winner === 0 ? a : b;
    const l = s.winner === 0 ? b : a;
    if (s.mode === "coins") {
      return `${w.emoji} ${w.name}先抢到 ${COIN_RACE_TARGET} 枚金币，获胜！`;
    }
    if (s.mode === "rush") {
      return `${w.emoji} ${w.name}赢啦！${l.name}先撞满了 ${CRASH_LIMIT} 次（${w.name} ${Math.floor(w.dist)} 米 / ${l.name} ${Math.floor(l.dist)} 米）。`;
    }
    return `${w.emoji} ${w.name}赢啦！跑了 ${Math.floor(w.dist)} 米，对手 ${Math.floor(l.dist)} 米。`;
  }

  function onMatchOver(s: MatchState): void {
    running = false;
    rememberGhost(s);
    refreshHint();
    const text = resultLine(s);
    msgEl.textContent = text;
    api.play("win");
    clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (destroyed) return;
      api.onWin(1, text);
    }, 1600);
  }

  /* ---------------- 绘制 ---------------- */

  function drawSky(pane: Rect, theme: Theme, dist: number): void {
    const hy = horizonY(pane);
    const g = ctx.createLinearGradient(0, pane.y, 0, hy + 6);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, pane.y, pane.width, hy - pane.y + 6);
    drawHills(pane, dist, theme.farHill, 0.06, pane.height * 0.16, hy + 2);
    drawHills(pane, dist, theme.nearHill, 0.16, pane.height * 0.1, hy + 2);
  }

  /** 远景视差层：一条平滑的周期曲线，所以左右接缝天然对得上 */
  function drawHills(
    pane: Rect,
    dist: number,
    color: string,
    factor: number,
    amp: number,
    baseY: number,
  ): void {
    const period = Math.max(60, pane.width * 0.75);
    const off = parallaxOffset(dist, factor, period);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pane.x, baseY);
    for (let x = 0; x <= pane.width; x += 6) {
      const t = ((x + off) / period) * Math.PI * 2;
      const h = amp * (0.55 + 0.3 * Math.sin(t) + 0.15 * Math.sin(t * 2.3 + 1.1));
      ctx.lineTo(pane.x + x, baseY - h);
    }
    ctx.lineTo(pane.x + pane.width, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /** 路面半宽（单位：车道）。最外侧车道中心在 1 车道处，多出来的就是路肩 */
  const ROAD_HALF = 1.55;

  function drawRoad(pane: Rect, theme: Theme, dist: number): void {
    const hy = horizonY(pane);
    const by = groundY(pane);
    // 路两边的草地
    const g = ctx.createLinearGradient(0, hy, 0, pane.y + pane.height);
    g.addColorStop(0, theme.field[1]);
    g.addColorStop(1, theme.field[0]);
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, hy, pane.width, pane.y + pane.height - hy);

    // 路面梯形
    const nearL = project(pane, 0, 1 - ROAD_HALF);
    const nearR = project(pane, 0, 1 + ROAD_HALF);
    const farL = project(pane, DRAW_DISTANCE, 1 - ROAD_HALF);
    const farR = project(pane, DRAW_DISTANCE, 1 + ROAD_HALF);
    ctx.fillStyle = theme.road;
    ctx.beginPath();
    ctx.moveTo(nearL.x, by + 2);
    ctx.lineTo(nearR.x, by + 2);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.closePath();
    ctx.fill();

    // 横向网格线：跟着人往后掠
    ctx.lineWidth = 1.5;
    for (const z of gridLineZs(dist, GRID_SPACING)) {
      const a = 1 - fogAlpha(z);
      if (a <= 0.02) continue;
      const l = project(pane, z, 1 - ROAD_HALF);
      const r = project(pane, z, 1 + ROAD_HALF);
      ctx.strokeStyle = `rgba(${theme.mark},${(0.3 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }

    // 车道分隔虚线：一段一段画，近处长远处短，透视自然
    for (const lane of [0.5, 1.5]) {
      for (const z of gridLineZs(dist, GRID_SPACING)) {
        const a = 1 - fogAlpha(z);
        if (a <= 0.02) continue;
        const p1 = project(pane, z, lane);
        const p2 = project(pane, z + GRID_SPACING * 0.5, lane);
        ctx.strokeStyle = `rgba(${theme.mark},${(0.85 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 7 * p1.scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // 路肩
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.roadEdge;
    for (const lane of [1 - ROAD_HALF, 1 + ROAD_HALF]) {
      const p1 = project(pane, 0, lane);
      const p2 = project(pane, DRAW_DISTANCE, lane);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  function drawFog(pane: Rect, theme: Theme): void {
    const hy = horizonY(pane);
    const band = pane.height * 0.3;
    const g = ctx.createLinearGradient(0, hy, 0, hy + band);
    g.addColorStop(0, theme.sky[1]);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, hy, pane.width, band);
  }

  function drawEntity(pane: Rect, e: Entity, z: number): void {
    const zz = Math.max(0, z);
    const p = project(pane, zz, e.lane);
    // 所有尺寸都按「这个深度上一条车道有多宽」换算，横竖分屏一个样
    const u = laneWidthAt(pane, zz);
    const alpha = 1 - fogAlpha(z);
    if (alpha <= 0.03 || u < 0.4) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (e.kind === "pit") {
      ctx.fillStyle = "#7A5638";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.42, u * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4A3020";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.33, u * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "rock") {
      ctx.fillStyle = "rgba(60,60,90,.2)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.36, u * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9E9188";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - u * 0.28, u * 0.34, u * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#C4B9B0";
      ctx.beginPath();
      ctx.ellipse(p.x - u * 0.1, p.y - u * 0.38, u * 0.15, u * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "hurdle") {
      // 矮木栏：横杆贴着地面 → 跳过去
      const w = u * 0.4;
      const barY = p.y - u * 0.3;
      const th = u * 0.09;
      ctx.fillStyle = "#C98C51";
      ctx.fillRect(p.x - w, barY, w * 0.16, u * 0.3);
      ctx.fillRect(p.x + w - w * 0.16, barY, w * 0.16, u * 0.3);
      ctx.fillStyle = "#E8B27A";
      ctx.fillRect(p.x - w, barY, w * 2, th);
      ctx.fillStyle = "#FFF3E4";
      ctx.fillRect(p.x - w * 0.34, barY, w * 0.68, th);
    } else if (e.kind === "gate") {
      // 高横杆：杆架在半空 → 要下滑钻过去
      const w = u * 0.42;
      const top = p.y - u * 0.95;
      const th = u * 0.2;
      ctx.fillStyle = "#8FB9E8";
      ctx.fillRect(p.x - w, top, w * 0.15, u * 0.95);
      ctx.fillRect(p.x + w - w * 0.15, top, w * 0.15, u * 0.95);
      ctx.fillStyle = "#5C8FCB";
      ctx.fillRect(p.x - w, top, w * 2, th);
      ctx.fillStyle = "#EAF3FF";
      ctx.fillRect(p.x - w * 0.6, top + th * 0.3, w * 1.2, th * 0.34);
    } else if (e.kind === "coin") {
      const cy = p.y - u * 0.42;
      ctx.fillStyle = "rgba(60,60,90,.12)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.14, u * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F1B93A";
      ctx.beginPath();
      ctx.ellipse(p.x, cy, u * 0.16, u * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFE39B";
      ctx.beginPath();
      ctx.ellipse(p.x, cy, u * 0.085, u * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "boost") {
      ctx.fillStyle = "rgba(126,220,150,.8)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.42, u * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3E9B63";
      for (let i = 0; i < 2; i++) {
        const dy = p.y - u * 0.05 - i * u * 0.13;
        ctx.beginPath();
        ctx.moveTo(p.x - u * 0.2, dy);
        ctx.lineTo(p.x, dy - u * 0.13);
        ctx.lineTo(p.x + u * 0.2, dy);
        ctx.lineTo(p.x, dy - u * 0.05);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRunner(pane: Rect, s: MatchState, r: Runner, seat: Seat, theme: Theme): void {
    const p = project(pane, RUNNER_Z, r.laneFloat);
    const jumpT = r.jumpUntil > s.time ? 1 - (r.jumpUntil - s.time) / JUMP_SECONDS : 0;
    const slideT = r.slideUntil > s.time ? 1 - (r.slideUntil - s.time) / SLIDE_SECONDS : 0;
    const lift = jumpArc(jumpT) * pane.height * JUMP_LIFT_RATIO * p.scale;
    const squash = slideT > 0 ? slideSquash(slideT) : 1;
    const base = laneWidthAt(pane, RUNNER_Z) * 0.6;
    const bodyH = base * squash;
    const shake = r.bump > 0 ? Math.sin(s.time * 42) * base * 0.12 * r.bump : 0;
    const cx = p.x + shake;
    const cy = p.y - lift - bodyH / 2;

    ctx.save();
    // 影子
    ctx.fillStyle = "rgba(60,60,90,.2)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, base * 0.42 * (1 - jumpArc(jumpT) * 0.4), base * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    const blink = s.time < r.safeUntil && Math.floor(s.time * 9) % 2 === 0;
    if (r.ghost) ctx.globalAlpha = 0.45;
    else if (blink) ctx.globalAlpha = 0.3;

    if (r.out && !r.ghost) {
      ctx.font = `${Math.round(base)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😵", cx, cy);
    } else if (r.ghost) {
      ctx.font = `${Math.round(base)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👻", cx, cy);
    } else {
      const img = avatarReady(seat);
      const bounce = Math.abs(Math.sin(s.time * 11)) * base * 0.07;
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy - bounce, base / 2, bodyH / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, cx - base / 2, cy - bounce - bodyH / 2, base, bodyH);
        ctx.restore();
      } else {
        ctx.fillStyle = seat === 0 ? "#FFC6DC" : "#B9D4FA";
        ctx.beginPath();
        ctx.ellipse(cx, cy - bounce, base / 2, bodyH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.round(base * 0.62)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(r.emoji, cx, cy - bounce);
      }
      // 加速尾焰
      if (s.time < r.boostUntil) {
        ctx.fillStyle = "rgba(255,214,90,.85)";
        ctx.font = `${Math.round(base * 0.5)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💨", cx - base * 0.72, cy);
      }
      // 下滑时地面扬起一道小尘
      if (slideT > 0) {
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.beginPath();
        ctx.ellipse(cx - base * 0.5, p.y, base * 0.3, base * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    void theme;
  }

  function drawHud(pane: Rect, s: MatchState, r: Runner, seat: Seat, theme: Theme): void {
    const fs = Math.max(11, Math.min(17, Math.round(pane.height * 0.085)));
    const pad = Math.round(fs * 0.5);
    const lives = livesLeft(s, seat);
    const hearts = r.ghost ? "👻" : "❤️".repeat(lives) + "🤍".repeat(Math.max(0, CRASH_LIMIT - lives));
    const text = `${r.emoji} ${r.name}　${Math.floor(r.dist)} 米　🪙 ${r.coins}　${hearts}`;
    ctx.save();
    ctx.font = `800 ${fs}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    const w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = theme.hud;
    ctx.beginPath();
    ctx.roundRect(pane.x + pad, pane.y + pad, w, fs + pad * 1.4, 10);
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(text, pane.x + pad * 2, pane.y + pad + (fs + pad * 1.4) / 2);
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  function drawPane(pane: Rect, s: MatchState, seat: Seat): void {
    const r = s.runners[seat];
    const theme = THEMES[seat];
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();
    drawSky(pane, theme, r.dist);
    drawRoad(pane, theme, r.dist);

    // 远的先画、近的后画，遮挡关系才对
    const entities = s.gen.ensure(r.dist + DRAW_DISTANCE + 40);
    const visible: Array<{ e: Entity; z: number }> = [];
    for (let i = r.resolved; i < entities.length; i++) {
      const z = entities[i].at - r.dist;
      if (z > DRAW_DISTANCE) break;
      if (z < -1) continue;
      visible.push({ e: entities[i], z });
    }
    for (let i = visible.length - 1; i >= 0; i--) drawEntity(pane, visible[i].e, visible[i].z);

    drawRunner(pane, s, r, seat, theme);
    drawFog(pane, theme);
    drawHud(pane, s, r, seat, theme);

    if (r.out) {
      ctx.fillStyle = "rgba(60,60,90,.42)";
      ctx.fillRect(pane.x, pane.y, pane.width, pane.height);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${Math.round(pane.height * 0.1)}px "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        r.ghost ? `幽灵跑完了 ${Math.floor(r.dist)} 米` : `${Math.floor(r.dist)} 米 · 停下了`,
        pane.x + pane.width / 2,
        pane.y + pane.height / 2,
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
  }

  function drawDivider(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (size.layout === "column") {
      ctx.moveTo(0, size.height / 2);
      ctx.lineTo(size.width, size.height / 2);
    } else {
      ctx.moveTo(size.width / 2, 0);
      ctx.lineTo(size.width / 2, size.height);
    }
    ctx.stroke();
    ctx.restore();
  }

  function render(): void {
    if (!state) return;
    ctx.clearRect(0, 0, size.width, size.height);
    drawPane(panes[0], state, 0);
    drawPane(panes[1], state, 1);
    drawDivider();
  }

  const LANE_NAMES = ["左道", "中道", "右道"];
  let lastLabelAt = 0;

  /** 画面是 canvas，读屏软件看不见，所以每 0.2 秒把两个人的处境写成一句话挂上去。 */
  function refreshAriaLabel(s: MatchState, now: number): void {
    if (now - lastLabelAt < 200) return;
    lastLabelAt = now;
    const part = (seat: Seat): string => {
      const r = s.runners[seat];
      return `${r.name}${LANE_NAMES[r.lane]}${Math.floor(r.dist)}米金币${r.coins}剩${livesLeft(s, seat)}`;
    };
    canvas.setAttribute("aria-label", `${part(0)}，${part(1)}`);
  }

  /* ---------------- 主循环 ---------------- */

  const SOUND_OF: Partial<Record<string, SoundName>> = {
    coin: "coin",
    boost: "pop",
    jump: "jump",
    slide: "tap",
    crash: "oops",
  };

  function playEvents(s: MatchState): void {
    const played = new Set<string>();
    for (const ev of drainEvents(s)) {
      const sound = SOUND_OF[ev];
      if (!sound || played.has(ev)) continue;
      played.add(ev);
      api.play(sound);
    }
  }

  let lastFrame = 0;
  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    const s = state;
    if (s && !gameEl.classList.contains("dr-hidden")) {
      if (running && !paused && !s.over) {
        stepMatch(s, dt);
        playEvents(s);
        if (s.over) onMatchOver(s);
      } else {
        drainEvents(s);
      }
      render();
      refreshAriaLabel(s, now);
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------------- 输入 ---------------- */

  function seatCanPlay(seat: Seat): boolean {
    if (!state) return false;
    if (seat === 1 && (state.ai !== null || state.runners[1].ghost)) return false;
    return true;
  }

  function doAction(seat: Seat, action: Action): void {
    if (!state || !running || paused || state.over) return;
    if (!seatCanPlay(seat)) return;
    applyAction(state, seat, action);
    playEvents(state);
  }

  function setPaused(next: boolean): void {
    if (!state || !running || state.over) return;
    paused = next;
    pauseEl.classList.toggle("dr-hidden", !paused);
    api.play("tap");
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (gameEl.classList.contains("dr-hidden")) return;
    if (isPauseKey(e.key)) {
      if (running && !state?.over) {
        e.preventDefault();
        e.stopPropagation();
        setPaused(!paused);
      }
      return;
    }
    const hit = resolveKey(e.code);
    if (!hit) return;
    if (isWatchedKey(e.code)) e.preventDefault();
    doAction(hit.seat, hit.action);
  };
  window.addEventListener("keydown", onKeyDown);

  /* 手机：左右（或上下）半屏各自识别滑动 */
  const touches = new Map<number, { seat: Seat; x: number; y: number; used: boolean }>();

  const rectOf = (): DOMRect => canvas.getBoundingClientRect();

  const onPointerDown = (e: PointerEvent): void => {
    const rect = rectOf();
    const x = ((e.clientX - rect.left) / rect.width) * size.width;
    const y = ((e.clientY - rect.top) / rect.height) * size.height;
    touches.set(e.pointerId, { seat: seatAtPoint(x, y, size, size.layout), x, y, used: false });
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    const t = touches.get(e.pointerId);
    if (!t || t.used) return;
    const rect = rectOf();
    const x = ((e.clientX - rect.left) / rect.width) * size.width;
    const y = ((e.clientY - rect.top) / rect.height) * size.height;
    const action = swipeAction(x - t.x, y - t.y);
    if (!action) return;
    t.used = true;
    doAction(t.seat, action);
  };

  const onPointerUp = (e: PointerEvent): void => {
    const t = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (!t || t.used) return;
    doAction(t.seat, "jump"); // 没滑动就当轻点一下，跳一下
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  /* ---------------- 按钮 ---------------- */

  pick<HTMLButtonElement>(".dr-start").addEventListener("click", () => {
    api.play("jump");
    startRace();
  });
  pick<HTMLButtonElement>(".dr-again").addEventListener("click", () => {
    api.play("tap");
    startRace();
  });
  pick<HTMLButtonElement>(".dr-pause").addEventListener("click", () => setPaused(!paused));
  pick<HTMLButtonElement>(".dr-resume").addEventListener("click", () => setPaused(false));
  pick<HTMLButtonElement>(".dr-back").addEventListener("click", () => {
    clearTimeout(endTimer);
    clearTimeout(countTimer);
    if (state && !state.over) rememberGhost(state);
    state = null;
    running = false;
    paused = false;
    pauseEl.classList.add("dr-hidden");
    countEl.classList.add("dr-hidden");
    gameEl.classList.add("dr-hidden");
    setupEl.classList.remove("dr-hidden");
    refreshHint();
    api.play("tap");
  });
  pick<HTMLButtonElement>(".dr-rulesbtn").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("dr-hidden");
  });
  pick<HTMLButtonElement>(".dr-rules-close").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("dr-hidden");
  });
  collectBtn.addEventListener("click", () => {
    api.play("tap");
    void openCollectionSafely();
  });

  raf = requestAnimationFrame((t) => {
    lastFrame = t;
    raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(endTimer);
      clearTimeout(countTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      ro?.disconnect();
      ro = null;
      touches.clear();
      state = null;
      wrap.remove();
    },
  };
}

/** 供设置面板与攻略引用：三档电脑的名字（避免文案与逻辑各写一份） */
export const AI_CHOICES = AI_LEVELS.map((level) => ({
  level,
  label: AI_LABELS[level],
  hint: AI_HINTS[level],
}));

/** 供外部（冒烟脚本）确认当前赛制名字 */
export function modeLabel(m: RaceMode): string {
  return MODE_LABELS[m];
}
