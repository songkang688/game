import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { save } from "../../engine/save";
import { scorePop, spawnRippleAtDot } from "./fx";
import { CAMPAIGN_VISUAL_CSS } from "./skin";
import { CHAPTERS, LEVELS, type TapLevel } from "./levels";
import { resetClippedScroll } from "./stageScroll";
import {
  FREEZE_FACTOR,
  FREEZE_ROUNDS,
  adaptiveAiDelay,
  inCombo,
  mechanicsOf,
  pointsFor,
  sequenceGrace,
  sequenceLabels
} from "./logic";
import {
  READY_MIN_MS,
  aiMisses,
  aiTier,
  aiTierForDelay,
  createTapGate
} from "./rounds";
import { mountEndless, mountVersus } from "./arena";

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
/* 又窄又矮的机器上，竞技场上面那一截（比分条 + 道具芯片）在 320px 宽会各折成两三行,
   一共吃掉 150 多像素，把竞技场顶到舞台裁切线以下——而点是随机摆的，
   落在下半截的那颗就按不着，表现成「时灵时不灵」。这里只收留白与字号，
   .rbt-dot 的热区一分不动（那是这一款唯一的操作对象）。 */
@media (max-width: 420px) and (max-height: 700px) {
  .rbt-top { margin-bottom: 4px; }
  .rbt-badge { padding: 3px 8px; font-size: 13px; }
  .rbt-badge.rbt-ai { padding: 3px 3px 3px 8px; }
  .rbt-ava { width: 22px; height: 22px; }
  .rbt-gear { gap: 4px; margin-bottom: 4px; min-height: 0; }
  .rbt-chip { padding: 2px 8px; font-size: 12px; }
  .rbt-msg { margin-top: 4px; min-height: 18px; font-size: 14px; }
}
`;

export const ENDLESS_CSS = `
.rte-bar { display: flex; justify-content: center; margin: 0 0 10px; }
/* display:flex 的优先级高过浏览器自带的 [hidden]{display:none}，
   不补这一条 bar.hidden = true 就是写了等于没写：真机上关卡在跑时这一条
   照旧 60px 高、两颗入口 elementFromPoint 全命中（W5R2-FB-03）。 */
.rte-bar[hidden] { display: none; }
/* min-height 是钉着的，不是靠 padding 凑的：竖屏上这两颗的文字折成两行，量出来 ≥44px，
   看着达标；横过来拿一行就排得下，高度当场掉回 10+20+10=40px（真机全量扫 1901 颗键，
   全场只有这两颗破底线，出现在横屏三档的地图 / 关内 / 侧模式共 9 处）。
   而它们是双人与无尽两个模式仅有的入口。 */
.rte-open { border: none; border-radius: 999px; padding: 10px 20px; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 4px 0 #3B55C2; }
.rte-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #3B55C2; }
.rte-open:focus-visible { outline: 3px solid #263E7A; outline-offset: 3px; }
.rte-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.rte-back { border: none; border-radius: 999px; padding: 7px 13px; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #3F5C9A; box-shadow: 0 3px 0 rgba(90,110,170,.28); }
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
  /** 1.2 · 每个点一个号，去抖与「手掌拍」连坐都按这个号认 */
  id: number;
  /** 1.2 · 已经亮起来了吗；预备期间点下去只会被小云朵挡一下 */
  live: boolean;
}

/**
 * 1.2 · 两个点之间至少岔开这么多（相对场地的百分比）。
 * 场地宽高都在 300px 上下，30% 折算过去差不多 90px，
 * 够 72px 的点之间留出 24px 的隔离带，一只手掌盖不住两个。
 */
const DOT_GAP_PCT = 30;

/** 1.2 · 预备到亮灯的这一段：短了就是无预警闪现，长了小孩会走神 */
const CAMPAIGN_READY_MAX_MS = 820;

function campaignReadyMs(): number {
  return Math.round(READY_MIN_MS + Math.random() * (CAMPAIGN_READY_MAX_MS - READY_MIN_MS));
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

/** 摆一个点：躲开这一轮已经摆过的位置，摆不开就用最后一次的落点 */
/** 竞技场里那颗点多大（`.rbt-arena .rbt-dot`，四档视口都是这个数） */
export const DOT_PX = 72;

/** 点离场地边沿至少留这么多，免得贴着圆角 */
export const DOT_EDGE_PX = 4;

/** 点能落在场地的哪一段（相对场地的百分比） */
export interface DotSpan {
  min: number;
  span: number;
}

/** 两个方向各一段 */
export interface DotBand {
  x: DotSpan;
  y: DotSpan;
}

/** 量不到场地时退回 1.2 原来那对写死的数字（还没挂上 DOM、测试桩） */
const LEGACY_SPAN: DotSpan = { min: 6, span: 72 };

/**
 * 点能落在场地的哪一段：**整颗点（含热区）必须留在场内**。
 *
 * 原来写死的是 `6% + random × 72%`，那对数字是按「场地 300px 上下」定的。
 * 场地一收到 105px（横过来拿那三档），78% 就是 82px，再加 72px 的点整颗探出场外 22px
 * （真机量到最大 +24px），而 `.rbt-arena{overflow:hidden}` 会把它裁掉半颗——
 * 看得见一半、按下去却在场外。所以改成按真实像素倒推百分比。
 *
 * 纯函数，用例直接喂数字。
 */
export function dotBandPct(boxPx: number, dotPx = DOT_PX, edgePx = DOT_EDGE_PX): DotSpan {
  if (!Number.isFinite(boxPx) || boxPx <= 0) return { ...LEGACY_SPAN };
  const usable = boxPx - dotPx - edgePx * 2;
  // 场地比一颗点还矮：贴边摆，至少整颗在场内
  if (usable <= 0) return { min: 0, span: 0 };
  return { min: (edgePx / boxPx) * 100, span: (usable / boxPx) * 100 };
}

/** 这一刻这块场地的两个方向各能摆在哪一段 */
export function arenaBand(el: HTMLElement): DotBand {
  return { x: dotBandPct(el.clientWidth), y: dotBandPct(el.clientHeight) };
}

const FULL_BAND: DotBand = { x: LEGACY_SPAN, y: LEGACY_SPAN };

function placeDot(el: HTMLElement, taken: Array<[number, number]> = [], band: DotBand = FULL_BAND): void {
  const roll = (): [number, number] => [
    band.x.min + Math.random() * band.x.span,
    band.y.min + Math.random() * band.y.span,
  ];
  let [x, y] = roll();
  for (let tries = 0; tries < 24; tries++) {
    if (taken.every(([px, py]) => Math.hypot(px - x, py - y) >= DOT_GAP_PCT)) break;
    [x, y] = roll();
  }
  taken.push([x, y]);
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
}

/** 竞技场再矮也得摆得开三行点，低于这个高度宁可让它被裁一点也不再收 */
export const ARENA_MIN_PX = 216;

/**
 * 竞技场该多高：CSS 给的高度与「舞台看得见的那一段」取小，再守住 ARENA_MIN_PX 的下限。
 * 纯函数，用例直接喂数字。
 */
export function arenaHeightPx(cssHeight: number, room: number): number {
  if (!Number.isFinite(room) || room <= 0) return cssHeight;
  return Math.max(ARENA_MIN_PX, Math.min(cssHeight, Math.floor(room)));
}

/** 竞技场再挤也得装得下一整颗点（含两边各 4px 边距），低于它就没得玩了 */
export const ARENA_FLOOR_PX = DOT_PX + DOT_EDGE_PX * 2;

/**
 * 竞技场**最终**多高。
 *
 * `arenaHeightPx()` 守着 `ARENA_MIN_PX = 216`（低于它三行点摆不开）。
 * 这条策略在竖屏上是对的，横过来拿就变成了**宁可让它掉出屏幕也要 216**：
 * 真机 844×390 / 740×360 / 640×360 上可视段只有 105…135px，硬撑 216
 * 等于把下面一半点摆到裁切线外面——而这一款故意不给滚动条（连点游戏，
 * 能滚就会「想点却滚走了」），够不着就是真的够不着，整局作废。
 * 14 轮 × 逐颗 `elementFromPoint` 量到 10/10、11/11、6/11 颗按不着。
 *
 * 摆得小一点还能玩，摆到屏幕外面就没得玩了。所以：要得到 216 就照旧，
 * 要不到就退到「装得下就行」，底线是**装得下一整颗点**。
 */
export function arenaBoxPx(cssHeight: number, room: number): number {
  const pref = arenaHeightPx(cssHeight, room);
  if (!Number.isFinite(room) || room <= 0) return pref;
  if (pref <= room) return pref;
  return Math.max(ARENA_FLOOR_PX, Math.floor(room));
}

/**
 * 竞技场下面还压着多少（排在它后面的那一行 `.rbt-msg`）。
 * 收场地时得把这一截让出来，不然提示整行掉在裁切线以下——
 * 「加油」「答对啦」那几句正是孩子最需要看见的。
 *
 * 量的是**后面的兄弟**而不是父元素的下沿：父元素有可能就是那条裁切线本身
 * （用例里的假链就是这么搭的），拿它算等于把自己头顶那一段又减一遍。
 */
function belowPx(el: HTMLElement): number {
  if (typeof el.getBoundingClientRect !== "function") return 0;
  let low = Number.NEGATIVE_INFINITY;
  for (let s = el.nextElementSibling; s; s = s.nextElementSibling) {
    const rect = (s as HTMLElement).getBoundingClientRect?.();
    if (rect) low = Math.max(low, rect.bottom);
  }
  if (!Number.isFinite(low)) return 0;
  return Math.max(0, low - el.getBoundingClientRect().bottom);
}

/**
 * 把竞技场压进舞台看得见的那一段。
 *
 * 点是按**百分比**摆在竞技场里的（`placeDot` 写的是 `left/top: n%`），所以只要竞技场
 * 本身不超出可视范围，每一颗点就都按得到；反过来，竞技场一被裁，落在下半截的点就是
 * 真的按不到——这一款整个玩法就是「按亮起来的那颗点」，按不到等于这一局作废。
 * 320×640 上实测：竞技场高 280、上面那一截（本款的无尽入口条 + 壳层关卡条在窄屏折行）
 * 把它顶到 y=416，舞台底边只到 626，**下面 70px 里的点一颗都按不着**，而点又是随机摆的，
 * 所以是「时灵时不灵」——比一直坏更难查。
 *
 * 不走滚动条：这是个连点游戏，能滚就会「想点却滚走了」。直接收高度，点跟着百分比回来。
 * 返回拆监听的函数。
 */
/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`（平台文件，禁改），不减这一刀就白多算 4px
 * ——而这一款的点是按百分比摆的、竞技场又不许滚，那 4px 里的点就是真的按不着。
 * 量不出宽度（测试桩 / 老浏览器）就当没有，绝不把裁切线算成 NaN。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

export function fitArena(el: HTMLElement): () => void {
  const view = el.ownerDocument?.defaultView ?? null;
  if (!view || typeof el.getBoundingClientRect !== "function") return () => {};
  const relayout = (): void => {
    el.style.height = "";
    const css = el.getBoundingClientRect().height;
    let bottom = Number.POSITIVE_INFINITY;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = view.getComputedStyle(p);
      const oy = cs.overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") {
        bottom = Math.min(bottom, clipBottomPx(p.getBoundingClientRect().bottom, cs.borderBottomWidth));
      }
    }
    if (!Number.isFinite(bottom)) return;
    const next = arenaBoxPx(css, bottom - el.getBoundingClientRect().top - belowPx(el));
    if (next < css) el.style.height = `${next}px`;
  };
  relayout();
  view.addEventListener("resize", relayout);
  return () => view.removeEventListener("resize", relayout);
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
  /** 1.2 · 防乱拍的门：同一个点 60ms 内只算一次，一巴掌拍多个点连一分都不给 */
  const gate = createTapGate();
  /** 1.2 · 每个点刚刚给出去多少分，被判成「手掌拍」时要照这份账收回来 */
  const awarded = new Map<number, number>();
  /** 1.2 · 小电脑的档位：由本关的出手时间折算，四档各有各的失误率 */
  const tier = aiTierForDelay(cfg.aiDelayMs);
  let dotSeq = 0;

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
  // 地图上「🎯 跳到当前关」留下的 scrollTop 会被带进关内，把双人 / 无尽这两颗
  // 入口顶到裁切线以上（W5-B-09）。进关这一刻归 0。
  resetClippedScroll(wrap);

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
  function score(mine: boolean, stake: number, msg?: string, dotId?: number): void {
    if (ended) return;
    if (mine) {
      const gained = pointsFor(streak, stake, cfg);
      meScore += gained;
      if (dotId !== undefined) awarded.set(dotId, gained);
      streak++;
      ctx.sfx("coin");
    } else {
      aiScore += stake;
      streak = 0;
      ctx.sfx("oops");
    }
    if (msg) msgEl.textContent = msg;
    renderTop();
    // 计分徽章轻弹一下（纯视觉，reduced 不弹）
    scorePop(mine ? meEl : aiEl);
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

  /**
   * 1.2 · 每一下点击都得先过这道门：
   *  · 同一个点 60ms 内的重复输入（连点器、手指抖）只算一次；
   *  · 同一只手掌同时盖住好几个点时，这一下不算，刚给出去的分也一并收回。
   * 亮灯之前点下去只是被小云朵挡一下，不扣分，文案也不批评。
   */
  function passGate(d: Dot): boolean {
    if (!d.live) {
      msgEl.textContent = "☁️ 还没亮呢，小云朵先挡一下，等亮了再点～";
      return false;
    }
    const v = gate.accept(d.id, nowMs());
    if (v.reason === "debounce") return false;
    if (v.reason === "palm") {
      let back = 0;
      for (const id of v.revoke) {
        back += awarded.get(id) ?? 0;
        awarded.delete(id);
      }
      if (back > 0) {
        meScore = Math.max(0, meScore - back);
        renderTop();
      }
      msgEl.textContent = "☁️ 一整只手拍上去不算分哦，一个一个点才有效！";
      ctx.sfx("oops");
      return false;
    }
    return true;
  }

  /**
   * 1.2 · 让点先「预备」再「亮」：亮之前不判分，也不给小电脑出手，
   * 禁止无预警闪现，免得变成比运气。
   */
  function lightUp(created: Dot[], arm: (d: Dot) => void): void {
    for (const d of created) d.el.classList.add("rbt-dot-ready");
    later(() => {
      for (const d of created) {
        if (d.gone) continue;
        d.live = true;
        d.el.classList.remove("rbt-dot-ready");
        d.el.classList.add("rbt-dot-live");
        arm(d);
      }
    }, campaignReadyMs());
  }

  /**
   * 1.2 · 小电脑按四档失误率出手：一档也不给完美反应，
   * 失手时它会「手滑」，把这一个点让出更多时间给孩子。
   */
  function armAi(d: Dot, ms: number, fire: () => void, canMiss = true): void {
    d.aiTimer = setTimeout(() => {
      if (destroyed || ended || d.gone) return;
      if (canMiss && aiMisses(tier, Math.random)) {
        msgEl.textContent = `星星（${aiTier(tier).name}）手滑了一下，快抢！`;
        armAi(d, Math.max(220, ms * 0.75), fire, false);
        return;
      }
      fire();
    }, ms);
  }

  /** 本轮小电脑的出手时间：读招 + 冻结都算进去 */
  function roundDelay(): number {
    let delay = adaptiveAiDelay(cfg, meScore, aiScore);
    if (frozen > 0) delay *= FREEZE_FACTOR;
    return delay;
  }

  function makeDot(kind: DotKind, label: number, taken: Array<[number, number]> = []): Dot {
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
    // 每摆一颗都按当下的场地量一次:转屏之后场地就不是原来那个了
    placeDot(el, taken, arenaBand(arenaEl));
    const d: Dot = { el, kind, label, aiTimer: null, gone: false, id: dotSeq++, live: false };
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

    const taken: Array<[number, number]> = [];
    const created = kinds.map((kind) => makeDot(kind, 0, taken));
    for (const d of created) {
      d.el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended || d.gone) return;
        if (!passGate(d)) return;
        // 波纹要在点被摘掉之前读它的位置：抢对金色星环、碰陷阱灰色淡纹
        spawnRippleAtDot(arenaEl, d.el, d.kind !== "trap");
        removeDot(d);
        if (d.kind === "trap") {
          score(false, 1, `碰到 ${skin.trap} 啦，这可是陷阱！`);
        } else {
          ctx.sfx("pop");
          score(true, 1, inCombo(streak + 1, cfg) ? "连击中，双倍分！" : "抢到！", d.id);
        }
      });
    }
    lightUp(created, (d) => {
      armAi(
        d,
        d.kind === "trap" ? delay * 1.6 : delay + Math.random() * 200,
        () => {
          removeDot(d);
          if (d.kind === "mine") {
            score(false, 1, "被小电脑抢走啦，再快一点！");
          } else if (dots.size === 0 && !ended) {
            later(spawnRound, 400);
          }
        },
        d.kind === "mine"
      );
    });
  }

  /** 道具轮：只冒一个 ❄️ 或 🧲，抢到手才有用，错过就没了 */
  function spawnPowerRound(): void {
    const kind: DotKind = Math.random() < 0.5 ? "freeze" : "magnet";
    const d = makeDot(kind, 0);
    const delay = roundDelay();
    lightUp([d], () => {
      armAi(
        d,
        delay + 260,
        () => {
          removeDot(d);
          msgEl.textContent = "道具点飞走啦，下一个别错过！";
          later(spawnRound, 380);
        },
        false
      );
    });
    d.el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (ended || d.gone) return;
      if (!passGate(d)) return;
      spawnRippleAtDot(arenaEl, d.el, true);
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
      spawnRippleAtDot(arenaEl, d.el, true);
      removeDot(d);
      ctx.sfx("pop");
      score(true, 1, "🧲 磁铁把它吸过来啦！");
    }, 420);
  }

  /** 序列轮：号码点一次全冒出来，必须 1→2→3 按顺序拍，拍错就把分让出去 */
  function spawnSequenceRound(chain: number): void {
    const delay = roundDelay() + sequenceGrace(chain);
    if (frozen > 0) frozen--;
    seqNext = 0;
    const labels = sequenceLabels(chain);
    const taken: Array<[number, number]> = [];
    const created: Dot[] = labels.map((n) => makeDot("mine", n, taken));

    // 预备期间号码就摆好了，可以先看清顺序；亮了才开始计时、才判分
    let expire: ReturnType<typeof setTimeout> | null = null;
    lightUp(created, () => {
      if (seqNext !== 0) return;
      seqNext = 1;
      markSeqNext();
      expire = setTimeout(() => {
        if (destroyed || ended) return;
        created.forEach((d) => { if (!d.gone) removeDot(d); });
        seqNext = 0;
        score(false, 1, "号码还没拍完就被抢走啦，先看清顺序再动手！");
      }, delay);
      timeouts.add(expire);
    });

    function stopExpire(): void {
      if (!expire) return;
      clearTimeout(expire);
      timeouts.delete(expire);
      expire = null;
    }

    for (const d of created) {
      d.aiTimer = null;
      d.el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended || d.gone) return;
        if (!passGate(d)) return;
        if (seqNext === 0) return;
        if (d.label !== seqNext) {
          const want = seqNext;
          spawnRippleAtDot(arenaEl, d.el, false);
          stopExpire();
          created.forEach((x) => { if (!x.gone) removeDot(x); });
          seqNext = 0;
          score(false, 1, `这一串轮到 ${want} 号啦，慢一点看清号码，下一串一定拍得对！`);
          return;
        }
        spawnRippleAtDot(arenaEl, d.el, true);
        d.el.classList.add("rbt-dot-done");
        removeDot(d);
        ctx.sfx("pop");
        seqNext++;
        markSeqNext();
        if (seqNext > chain) {
          stopExpire();
          seqNext = 0;
          score(true, chain, `${chain} 个号码一次拍对，漂亮！`, d.id);
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
  // 竞技场比舞台看得见的那一段高的时候，落在下半截的点是真按不到的（见 fitArena）
  const fitArenaOff = fitArena(arenaEl);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      clearDots();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      fitArenaOff();
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const barStyle = document.createElement("style");
  // 1.3 视觉层（果冻点点 / 波纹 / 计分弹跳）贴在 1.2 规则后面，老规则一条不动
  barStyle.textContent = ENDLESS_CSS + CSS_V12 + CAMPAIGN_VISUAL_CSS;
  const bar = document.createElement("div");
  bar.className = "rte-bar";
  const levelHost = document.createElement("div");
  const sideHost = document.createElement("div");
  sideHost.hidden = true;
  root.append(barStyle, bar, levelHost, sideHost);
  api.root.appendChild(root);

  const versusBtn = document.createElement("button");
  versusBtn.type = "button";
  versusBtn.className = "rte-open";
  versusBtn.textContent = "⚔️ 双人对战 · 谁更准";
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "rte-open";
  bar.append(versusBtn, openBtn);

  let side: { destroy: () => void } | null = null;
  /** 关卡正在跑没有：两颗侧模式入口靠它挡住，别把关卡层只藏不销毁（W5R2-FB-03） */
  let inLevel = false;

  function refreshBtn(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    openBtn.textContent = best > 0 ? `♾️ 点到手软 · 最好 ${best} 轮` : "♾️ 点到手软 · 点我开抢！";
  }

  function closeSide(): void {
    side?.destroy();
    side = null;
    sideHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = inLevel;
    refreshBtn();
  }

  function openSide(mountFn: (host: HTMLElement, api: GameApi, onExit: () => void) => { destroy: () => void }): void {
    // 关卡正在跑就不许再开一层。`bar.hidden` 只是让手指够不着,焦点残留、
    // 壳层补发的 click、自动化脚本照样能把它点响 —— 点响了关卡层就只被 hidden 藏起来,
    // 秒表、小电脑的 AI、点的生灭全都不停:真机上关内分数在对战屏后面 2.5 秒走了一分。
    if (side || inLevel) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    sideHost.hidden = false;
    side = mountFn(sideHost, api, closeSide);
  }

  versusBtn.addEventListener("click", () => openSide(mountVersus));
  openBtn.addEventListener("click", () => openSide(mountEndless));
  refreshBtn();

  const level = mountLevelGame({ ...api, root: levelHost }, {
    id: meta.id,
    chapters: CHAPTERS,
    // 关卡在跑时把模式条收起来:一来它本来就不该在关卡上面(点一下就两套一起跑),
    // 二来横过来拿的时候这一整条 50px 正是竞技场缺的那一截 —— 收要排在
    // playLevel() 之前,竞技场是在里面按可视高收的,量早了这 50px 没人认领。
    playLevel: (stage, ctx) => {
      bar.hidden = true;
      inLevel = true;
      const handle = playLevel(stage, ctx);
      return {
        destroy: () => {
          inLevel = false;
          handle?.destroy?.();
          // 侧模式开着的时候这一条本来就该收着,别替它放回来
          if (!side) bar.hidden = false;
        },
      };
    },
    mapHint: "让小电脑得分越少，星星越多！",
    grandMessage: "188 场抢点大战全部获胜，又准又稳，了不起！",
  });

  return {
    destroy() {
      side?.destroy();
      side = null;
      level.destroy();
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 1.2 追加的样式：一律 `rbt-` 前缀（拔河那款用的是 rbg 前缀，不会撞），
// 只贴在 1.1 的规则后面，一条老规则都不改。
// ---------------------------------------------------------------------------

const CSS_V12 = `
.rbt-dot-ready { opacity: .5; filter: grayscale(.7); box-shadow: 0 2px 6px rgba(100,120,180,.2); }
.rbt-dot-ready::after { content: "预备"; position: absolute; left: 50%; top: -18px; transform: translateX(-50%); font-size: 11px; font-weight: 900; color: #6E7FA8; background: #ffffffdd; border-radius: 999px; padding: 1px 7px; }
.rbt-dot-live { animation: rbtLightOn .22s ease; }
@keyframes rbtLightOn { from { transform: scale(.86); } to { transform: scale(1); } }
.rbt-arena .rbt-dot { width: 72px; height: 72px; font-size: 36px; }
@media (max-width: 420px) {
  .rbt-arena .rbt-dot { width: 72px; height: 72px; font-size: 32px; }
  .rbt-arena { height: 300px; }
}
@media (prefers-reduced-motion: reduce) {
  .rbt-dot { animation: none; }
  .rbt-dot-live { animation: none; transition: opacity .3s linear, filter .3s linear; }
}
`;
