/**
 * 红蓝拔河 · 1.3 视觉映射纯函数(第 23 步 C 档)。
 *
 * 这里只有「读既有数据 → 算画面参数」的映射与场景 SVG 字符串,
 * 一行玩法数值都没有:拉力演算在 force.ts、判定窗口在 tuning.ts,原样只读。
 *
 *  - 丝带位置 `ribbonLeftPct`:沿用 1.2 flagPct 的同一条线性映射(50 − ratio×35),
 *    胜负阈值展示位(15% / 85%)因此与 TUG12.ROPE_WIN 完全同步;
 *  - 队伍后仰 `teamLeanDeg`:拉力偏移按 |ratio| 分三档映射 ±4 / ±7 / ±10°;
 *  - 节拍环 `beatRingR`:沿用 beatTrack 的时间轴,环从 r=26 线性收缩到 r=8,
 *    最小时刻 = 拍点时刻 = 既有 ±BEAT_WINDOW_MS 判定窗口的中心;
 *  - FxSpool:尘土 / 彩纸 / 猛拉帧的计时器统一登记,destroy 一把清零;
 *  - reduced:尘土 / 彩纸 / 摇摆全停,节拍环换静态高亮点,丝带映射不受影响。
 */
import { TUG_ART, tugPullerSvg } from "../../art/kit/tugTeam";
import { withAlpha } from "../../art/kit/palette";
import { TUG12, type Tuning } from "./tuning";

// ---------------------------------------------------------------------------
// 1. 丝带(拉力值)与胜负线的展示映射
// ---------------------------------------------------------------------------

/**
 * 红丝带的水平位置(%):`ropeRatio` = rope / ROPE_WIN ∈ [-1, 1]。
 * 与 1.2 的 flagPct 同一条线性映射:50 − ratio × 35,一个数都没改。
 */
export function ribbonLeftPct(ropeRatio: number): number {
  const r = Number.isFinite(ropeRatio) ? Math.max(-1, Math.min(1, ropeRatio)) : 0;
  return 50 - r * 35;
}

/** 两条胜负线的展示位(%):就是丝带被拉到 ±ROPE_WIN 时落点 */
export function winLinePcts(): { red: number; blue: number } {
  return { red: ribbonLeftPct(1), blue: ribbonLeftPct(-1) };
}

// ---------------------------------------------------------------------------
// 2. 队伍后仰三档映射
// ---------------------------------------------------------------------------

/** 三档后仰角(度):|ratio| < 1/3 → 4°,< 2/3 → 7°,其余 → 10° */
export function teamLeanDeg(ropeRatio: number): 4 | 7 | 10 {
  const a = Number.isFinite(ropeRatio) ? Math.min(1, Math.abs(ropeRatio)) : 0;
  if (a < 1 / 3) return 4;
  if (a < 2 / 3) return 7;
  return 10;
}

/** 后仰时脚下阴影的反向偏移(px):档位越高偏得越多,基准档 0 */
export function shadowShiftPx(ropeRatio: number): number {
  const deg = teamLeanDeg(ropeRatio);
  return deg === 4 ? 0 : deg === 7 ? 1 : 2;
}

// ---------------------------------------------------------------------------
// 3. 节拍环
// ---------------------------------------------------------------------------

/** 环的最大 / 最小半径:最小时刻正好是拍点时刻(命中窗口中心) */
export const BEAT_RING_MAX = 26;
export const BEAT_RING_MIN = 8;

/**
 * 拍点时刻 `beatAt` 在 `nowMs` 这一帧的环半径。
 * 时间轴与 beatTrack 完全同源(BEAT_TRAVEL_MS),只做半径映射,不碰判定。
 */
export function beatRingR(beatAt: number, nowMs: number, tune: Tuning = TUG12): number {
  if (!Number.isFinite(beatAt) || !Number.isFinite(nowMs)) return BEAT_RING_MAX;
  const t = Math.min(1, Math.abs(beatAt - nowMs) / tune.BEAT_TRAVEL_MS);
  return BEAT_RING_MIN + (BEAT_RING_MAX - BEAT_RING_MIN) * t;
}

/** 拍点的水平位置(%):沿用 1.2 的 beatTrack 映射(8 + (track+1)/2 × 84) */
export function beatLeftPct(track: number): number {
  const t = Number.isFinite(track) ? Math.max(-1, Math.min(1, track)) : 0;
  return 8 + ((t + 1) / 2) * 84;
}

export type BeatMode = "ring" | "dot";

/** reduced 下节拍环换静态高亮点,信息不减 */
export function beatMode(reduced: boolean): BeatMode {
  return reduced ? "dot" : "ring";
}

// ---------------------------------------------------------------------------
// 4. 命中 / miss 的画面反馈(互斥两分支)
// ---------------------------------------------------------------------------

export type PullFx = "hit" | "miss";

/** beatHitIndex 的返回值 → 画面分支:≥0 全队猛拉一帧,<0 绳子轻晃(不批评) */
export function pullFx(hitIndex: number): PullFx {
  return hitIndex >= 0 ? "hit" : "miss";
}

/** 猛拉帧时长(ms) / 回弹附加角(度) */
export const HIT_YANK_MS = 160;
export const YANK_EXTRA_DEG = 6;
/** miss 绳晃时长(ms)与幅度(px) */
export const MISS_SWAY_MS = 200;
export const SWAY_PX = 2;
/** 命中掀起的尘土粒数;reduced 全停 */
export function dustCount(reduced: boolean): number {
  return reduced ? 0 : 2;
}

// ---------------------------------------------------------------------------
// 5. 胜负仪式
// ---------------------------------------------------------------------------

/** 彩纸粒数;reduced 全停 */
export function confettiCount(reduced: boolean): number {
  return reduced ? 0 : 24;
}
/** 仪式动画时长(ms):一次性,不循环 */
export const CEREMONY_MS = 900;
/** 彩纸配色(粉彩,程序化,无位图) */
export const CONFETTI_COLORS: readonly string[] = [
  TUG_ART.tugRed,
  TUG_ART.tugBlue,
  "#ffe6a3",
  "#b8e6c8",
  "#d6c8f0",
];

/** 连胜奖杯堆叠数 = streak 原值(封顶 12 只是排版保护,三点断言 0/3/7 不受影响) */
export function trophyStack(streak: number): number {
  const n = Number.isFinite(streak) ? Math.floor(streak) : 0;
  return Math.max(0, Math.min(12, n));
}

// ---------------------------------------------------------------------------
// 6. 顶栏三卡
// ---------------------------------------------------------------------------

export interface HeadCard {
  icon: string;
  label: string;
  value: string;
}

/** 顶栏卡字号下限(px):360px 上不许再小 */
export const HEAD_CARD_FONT_MIN = 14;

/** 无尽模式顶栏的三张卡:局数 / 连胜 / 纪录,数据源(streak / best)原样只读 */
export function headCards(streak: number, best: number): HeadCard[] {
  return [
    { icon: "🪢", label: "局数", value: `第 ${streak + 1} 局` },
    { icon: "🔥", label: "连胜", value: `${streak}` },
    { icon: "🏅", label: "纪录", value: best > 0 ? `${best}` : "—" },
  ];
}

/**
 * 三卡一行的估宽(px):CJK 按整字号、数字/符号按 0.62 字号、
 * 图标 18px、卡内边距 16px、卡间距 6px。360px 红线用例靠它把关。
 */
export function headRowWidthPx(cards: readonly HeadCard[], fontPx = HEAD_CARD_FONT_MIN): number {
  let total = 0;
  for (const card of cards) {
    let text = 0;
    for (const ch of card.value) {
      text += ch.charCodeAt(0) > 0x2e7f ? fontPx : fontPx * 0.62;
    }
    total += 18 + 16 + text;
  }
  return Math.round(total + (cards.length - 1) * 6);
}

// ---------------------------------------------------------------------------
// 7. 麻绳与场景 SVG(纯字符串)
// ---------------------------------------------------------------------------

/**
 * 麻绳路径:两段贝塞尔在中点(丝带位)汇合,`sag` 是中点下垂像素(0 = 绷直)。
 * 绳纹短斜线由第二条同路径的 dasharray 描出来,不用逐根画。
 */
export function ropePathD(w: number, y: number, sag: number): string {
  const s = Number.isFinite(sag) ? Math.max(0, sag) : 0;
  const mid = w / 2;
  return `M0 ${y} Q ${mid / 2} ${y + s} ${mid} ${y + s} Q ${mid + mid / 2} ${y + s} ${w} ${y}`;
}

/** 中点红丝带:小结 + 两根飘尾,全场最醒目一点 */
export function ribbonSvg(): string {
  return (
    `<svg class="rbg-ribbon-svg" viewBox="0 0 20 26" width="20" height="26" aria-hidden="true" focusable="false">` +
    `<path data-part="ribbon-tail" d="M10 8Q4 12 3 20l5-2z" fill="${TUG_ART.ribbonRed}"/>` +
    `<path data-part="ribbon-tail" d="M10 8q6 4 7 12l-5-2z" fill="${TUG_ART.ribbonRed}" opacity=".85"/>` +
    `<circle data-part="ribbon-knot" cx="10" cy="6" r="4.4" fill="${TUG_ART.ribbonRed}" stroke="#fff" stroke-width="1.4"/>` +
    `</svg>`
  );
}

/**
 * 场景氛围层:远山两层 + 加油小旗串 + 观众小花两朵。
 * 一张 SVG 铺满场地(preserveAspectRatio=none),天空与草地由 CSS 渐变打底。
 */
export function sceneSvg(): string {
  const hillFar = withAlpha(TUG_ART.riverTop, 0.5);
  const hillNear = withAlpha(TUG_ART.grassDark, 0.45);
  const flags: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = 26 + i * 52;
    const color = i % 2 === 0 ? TUG_ART.tugRed : TUG_ART.tugBlue;
    flags.push(`<path d="M${x} ${9 + (i % 2) * 3}l10 3-10 3z" fill="${color}"/>`);
  }
  const flower = (x: number, tone: string, cls: string): string =>
    `<g class="${cls}" style="transform-origin:${x}px 118px">` +
    `<path d="M${x} 118v-8" stroke="${TUG_ART.grassDark}" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="${x}" cy="107" r="4.6" fill="${tone}"/>` +
    `<circle cx="${x}" cy="107" r="1.8" fill="#ffe6a3"/>` +
    `</g>`;
  return (
    `<svg class="rbg-scene-svg" viewBox="0 0 360 124" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<path data-part="hill" d="M0 66Q60 38 132 60T262 56T360 64V78H0z" fill="${hillFar}"/>` +
    `<path data-part="hill" d="M0 74Q90 52 190 68T360 70V84H0z" fill="${hillNear}"/>` +
    `<g class="rbg-bunting" style="transform-origin:180px 0">` +
    `<path d="M6 8Q180 26 354 8" stroke="${withAlpha(TUG_ART.ropeLine, 0.55)}" stroke-width="1.6" fill="none"/>` +
    flags.join("") +
    `</g>` +
    flower(20, "#ffb3c8", "rbg-flower rbg-flower-a") +
    flower(340, "#d6c8f0", "rbg-flower rbg-flower-b") +
    `</svg>`
  );
}

/** 中央河沟:纵向蓝渐变 + 三道波纹;丝带过线 = 把对面拉过河 */
export function riverSvg(): string {
  return (
    `<svg class="rbg-river-svg" viewBox="0 0 30 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<defs><linearGradient id="rbgRiverGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${TUG_ART.riverTop}"/><stop offset="1" stop-color="${TUG_ART.riverBottom}"/>` +
    `</linearGradient></defs>` +
    `<path d="M8 0q6 6 0 15t0 15-1 15 3 15h12q-5-8 0-15t0-15 1-15-3-15z" fill="url(#rbgRiverGrad)" opacity=".9"/>` +
    `<path data-part="wave" d="M11 12q4 2 8 0M10 30q4 2 8 0M12 48q4 2 8 0" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".6"/>` +
    `</svg>`
  );
}

/** 抛到半空的小帽子(胜方仪式用):红队抛头带结、蓝队抛帽子 */
export function hatSvg(side: "red" | "blue"): string {
  const body =
    side === "red"
      ? `<rect x="2" y="6" width="14" height="4" rx="2" fill="${TUG_ART.tugRedDark}"/>` +
        `<path d="M3 7l-3-2M3 9l-3 1" stroke="${TUG_ART.tugRedDark}" stroke-width="1.6" stroke-linecap="round"/>`
      : `<path d="M2 10a7 6 0 0 1 14 0z" fill="${TUG_ART.tugBlueDark}"/>` +
        `<circle cx="9" cy="3" r="1.8" fill="#fff"/>`;
  return `<svg class="rbg-hat-svg" viewBox="0 0 18 12" width="18" height="12" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * 胜负仪式画面:胜方三只叠罗汉欢呼 + 抛帽,败方坐地吐舌头笑 —— 都是可爱收场。
 * 只生成 HTML,时机(900ms 后 onEnd)与结算数据在 index.ts 原样不动。
 */
export function finaleHtml(winner: "red" | "blue"): string {
  const loser: "red" | "blue" = winner === "red" ? "blue" : "red";
  const pile =
    `<span class="rbg-hat rbg-hat-a">${hatSvg(winner)}</span>` +
    `<span class="rbg-hat rbg-hat-b">${hatSvg(winner)}</span>` +
    `<span class="rbg-pile-slot rbg-pile-a">${tugPullerSvg({ side: winner, pose: "cheer" })}</span>` +
    `<span class="rbg-pile-slot rbg-pile-b">${tugPullerSvg({ side: winner, role: "leader", pose: "cheer" })}</span>` +
    `<span class="rbg-pile-slot rbg-pile-top">${tugPullerSvg({ side: winner, pose: "cheer" })}</span>`;
  const line =
    winner === "red"
      ? "朵朵队把红丝带拉过了小河!星星队坐在草地上吐吐舌头,两队都笑成一团!"
      : "星星队这一局拉得更稳!朵朵队坐在草地上吐吐舌头,两队都笑成一团!";
  return (
    `<div class="rbg-ceremony" aria-hidden="true">` +
    `<span class="rbg-pile">${pile}</span>` +
    `<span class="rbg-sit">${tugPullerSvg({ side: loser, pose: "sit" })}</span>` +
    `</div>` +
    `<div class="rbg-finale-line">${line}</div>`
  );
}

// ---------------------------------------------------------------------------
// 8. FxSpool:粒子与一次性动效的计时器统管
// ---------------------------------------------------------------------------

export interface FxSpoolEnv {
  setT?: (fn: () => void, ms: number) => number;
  clearT?: (id: number) => void;
}

export interface FxSpool {
  /**
   * 生一批粒子 / 一次性动效:`make(i)` 落地第 i 个并返回它的清理回调;
   * `ttlMs` 到点自动清理。返回真正生出来的个数。
   */
  spawn(count: number, ttlMs: number, make: (i: number) => (() => void) | void): number;
  /** 在场粒子数(destroy 后必须为 0) */
  readonly live: number;
  /** 未到期计时器数(destroy 后必须为 0) */
  readonly pending: number;
  /** 全部清空:清计时器、跑清理回调;可重复调用 */
  clear(): void;
}

export function createFxSpool(env: FxSpoolEnv = {}): FxSpool {
  const setT =
    env.setT ?? ((fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number);
  const clearT = env.clearT ?? ((id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
  const jobs = new Map<number, () => void>();
  let seq = 0;

  return {
    spawn(count, ttlMs, make) {
      const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      for (let i = 0; i < n; i++) {
        const cleanup = make(i) ?? ((): void => {});
        const key = ++seq;
        const timer = setT(() => {
          jobs.delete(key);
          cleanup();
        }, ttlMs);
        jobs.set(key, () => {
          clearT(timer);
          cleanup();
        });
      }
      return n;
    },
    get live() {
      return jobs.size;
    },
    get pending() {
      return jobs.size;
    },
    clear() {
      const drop = [...jobs.values()];
      jobs.clear();
      for (const fn of drop) fn();
    },
  };
}
