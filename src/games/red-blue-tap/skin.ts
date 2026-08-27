/**
 * 红蓝点点 · 1.3 视觉皮肤（B 档 · 只动皮不动骨）。
 *
 * 这一份只有两种东西：
 *  1. CSS 文本（`VISUAL_CSS` 贴在对战 / 无尽的 ARENA_CSS 后面，
 *     `CAMPAIGN_VISUAL_CSS` 贴在闯关外壳的样式后面）；
 *  2. 纯视图函数（信号灯该长什么样、领先方是谁、反应耗时怎么算）——
 *     全部只读输入，一个玩法状态都不写。
 *
 * 硬规矩（对应 shell.test.ts 与本步红线）：
 *  · 不开计时器：所有动效走 CSS animation，收尸靠 animationend（见 fx.ts）；
 *  · 不碰热区几何：按键 / 点点的宽高、内边距、边框宽一个像素不出现在这里，
 *    立面与描边一律走 box-shadow / border-color；
 *  · 所有类名 `rbt-` 前缀；动效时长全部写成 `--rbt-*` 自定义属性集中管理。
 *
 * DOM 层级（z-index 从低到高）：
 *  ① 场地底 + 中线分界（gap ::before/::after） → ② 双按垫（普通流）
 *  → ③ 波纹层 z5（pointer-events:none） → ④ 中央信号灯 z7
 *  → ⑤ 计分牌 / 反应气泡 z6 → ⑥ 顶栏（普通流） → ⑦ 倒计时浮层 z9
 *  → 结算浮层 z10 压轴。
 */
import { PASTEL, shade, withAlpha } from "../../art/kit/palette";
import {
  JELLY_RIPPLE_MS,
  JELLY_SQUASH_MS,
  jellyPressTransform
} from "../../art/kit/jellyBtn";
import { SPARK_MS, sparkleCss } from "../../art/kit/sparkle";
import { COLOR_FACE, type RoundPlan } from "./rounds";

// ---------------------------------------------------------------------------
// 动效时序表（规格四·补三）——全部只作用于视觉层
// ---------------------------------------------------------------------------

/** 信号灯预备呼吸周期 */
export const SIGNAL_BREATH_MS = 800;
/** 出题爆亮光环一闪 */
export const SIGNAL_FLASH_MS = 120;
/** 计分翻页 */
export const SCORE_FLIP_MS = 120;
/** 连对流光一圈 */
export const STREAK_FLOW_MS = 900;
/** 连对几次给流光 */
export const STREAK_FLOW_NEED = 3;
/**
 * 开局倒计时的总预算：钉死等于 restart() 里既有的 `later(nextRound, 700)`。
 * 玩法节奏一毫秒不改，3-2-1 是压进这 700ms 里的纯视觉（每字约 230ms），
 * 不是把出题往后推 1800ms。
 */
export const COUNTDOWN_BUDGET_MS = 700;
/** 每个倒计时数字占的时长 */
export const COUNTDOWN_STEP_MS = 230;

/** 窄屏上信号灯直径至少占视口宽的比例（规格七：≥ 22%） */
export const SIGNAL_MIN_VW = 22;

// ---------------------------------------------------------------------------
// 配色 token（规格四·补一）：集中在这里，CSS 里只见 var()
// ---------------------------------------------------------------------------

/** `--rbt-*` 自定义属性一次配齐，对战与闯关两个壳共用同一份 */
export const RBT_TOKEN_DECL = [
  `--rbt-red: ${PASTEL.red}`,
  `--rbt-red-deep: ${shade(PASTEL.red, -12)}`,
  `--rbt-blue: ${PASTEL.blue}`,
  `--rbt-blue-deep: ${shade(PASTEL.blue, -12)}`,
  `--rbt-signal-idle: ${PASTEL.idleGray}`,
  `--rbt-signal-ready: ${PASTEL.readyYellow}`,
  `--rbt-ripple-good: ${withAlpha(PASTEL.starGold, 0.6)}`,
  `--rbt-ripple-miss: rgba(150,150,160,.3)`,
  `--rbt-divider: linear-gradient(180deg, ${PASTEL.blue} 0%, ${PASTEL.blue} 44%, ${PASTEL.red} 56%, ${PASTEL.red} 100%)`,
  `--rbt-squash-ms: ${JELLY_SQUASH_MS}ms`,
  `--rbt-ripple-ms: ${JELLY_RIPPLE_MS}ms`,
  `--rbt-breath-ms: ${SIGNAL_BREATH_MS}ms`,
  `--rbt-flash-ms: ${SIGNAL_FLASH_MS}ms`,
  `--rbt-flip-ms: ${SCORE_FLIP_MS}ms`,
  `--rbt-spark-ms: ${SPARK_MS}ms`,
  `--rbt-flow-ms: ${STREAK_FLOW_MS}ms`,
  `--rbt-count-ms: ${COUNTDOWN_BUDGET_MS}ms`,
  `--rbt-signal-size: 86px`
].join("; ");

// ---------------------------------------------------------------------------
// 对战 / 无尽的视觉层 CSS（贴在 ARENA_CSS 后面，后来者同权重时赢）
// ---------------------------------------------------------------------------

export const VISUAL_CSS = `
.rbt-vs { ${RBT_TOKEN_DECL}; }
.rbt-vs-body { position: relative; }
.rbt-vs-side { position: relative; transition: filter .3s ease; }
.rbt-vs-over { z-index: 10; }

/* ── 场地中线：红蓝渐变相接 + 中央小闪电标（① 层） ───────────────── */
.rbt-vs-gap { position: relative; }
.rbt-vs-gap::before { content: ""; position: absolute; left: 50%; top: 4%; bottom: 4%; width: 4px; transform: translateX(-50%); border-radius: 2px; background: var(--rbt-divider); opacity: .5; }
.rbt-vs-gap::after { content: "⚡"; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 15px; text-shadow: 0 1px 0 #ffffff; }

/* 领先方那一侧轻微亮 4%：只由 renderScore 读比分映射出类名，分数一个字不写 */
.rbt-lead-l .rbt-vs-side-left, .rbt-lead-r .rbt-vs-side-right { filter: brightness(1.04); }

/* ── 果冻按垫（② 层）：填充 / 描边色 / 立面全走 paintPad 落的 var，
      宽高 / 内边距 / 边框宽一个都不碰 ───────────────────────────── */
.rbt-key, .rbt-key-lit { background: var(--rbt-key-bg, #E7EBF3); border-color: var(--rbt-key-line, #D9DEEA); box-shadow: 0 3px 0 var(--rbt-key-face, rgba(90,110,170,.22)); transition: color .18s ease, transform var(--rbt-squash-ms) cubic-bezier(.34,1.56,.64,1), box-shadow var(--rbt-squash-ms) ease-out; }
/* 按下 squash：只有 transform 与立面阴影，几何零改动，60ms 回弹 */
.rbt-key:active, .rbt-key-lit:active { transform: ${jellyPressTransform()}; box-shadow: 0 1px 0 var(--rbt-key-face, rgba(90,110,170,.22)); }

/* ── 波纹层（③ 层，pointer-events: none）───────────────────────── */
.rbt-ripple { position: absolute; left: var(--rbt-rip-x, 50%); top: var(--rbt-rip-y, 50%); width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%, -50%) scale(0); pointer-events: none; z-index: 5; animation: rbtRipple var(--rbt-ripple-ms) ease-out forwards; will-change: transform, opacity; }
.rbt-ripple-good { border: 3px dashed var(--rbt-ripple-good); box-shadow: 0 0 10px var(--rbt-ripple-good); }
.rbt-ripple-miss { border: 2px solid var(--rbt-ripple-miss); box-shadow: none; }
@keyframes rbtRipple { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(var(--rbt-rip-scale, 8.4)); opacity: 0; } }

/* ── 中央信号灯（④ 层）：待机灰 → 预备黄呼吸 → 出题爆亮 + 光环一闪 ── */
.rbt-signal { position: absolute; left: 50%; top: 0; transform: translate(-50%, -56%) scale(.8); width: var(--rbt-signal-size); height: var(--rbt-signal-size); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: calc(var(--rbt-signal-size) * .4); font-weight: 900; color: #ffffff; text-shadow: 0 1px 2px rgba(40,60,110,.35); background: var(--rbt-signal-fill, var(--rbt-signal-idle)); border: 3px solid #ffffff; box-shadow: inset 0 4px 0 rgba(255,255,255,.35), inset 0 -6px 0 rgba(40,60,110,.12), 0 4px 12px rgba(90,110,170,.3); pointer-events: none; z-index: 7; opacity: .4; transition: background .2s ease, opacity .2s ease; }
.rbt-signal-ready { opacity: 1; background: var(--rbt-signal-ready); animation: rbtLampBreath var(--rbt-breath-ms) ease-in-out infinite; }
.rbt-signal-live { opacity: 1; background: var(--rbt-signal-hue, var(--rbt-signal-ready)); animation: rbtLampLive 460ms ease-out forwards; }
@keyframes rbtLampBreath { 0%, 100% { transform: translate(-50%, -56%) scale(.96); } 50% { transform: translate(-50%, -56%) scale(1.05); } }
/* 前 26%（≈120ms = --rbt-flash-ms）是爆亮 + 白色光环一闪，之后缩小让出按垫 */
@keyframes rbtLampLive {
  0% { transform: translate(-50%, -56%) scale(1.12); box-shadow: 0 0 0 0 rgba(255,255,255,.9), 0 4px 12px rgba(90,110,170,.3); opacity: 1; }
  26% { transform: translate(-50%, -56%) scale(1.04); box-shadow: 0 0 0 16px rgba(255,255,255,0), 0 4px 12px rgba(90,110,170,.3); opacity: 1; }
  100% { transform: translate(-50%, -70%) scale(.44); opacity: 0; }
}

/* ── 计分牌（⑤ 层）：翻页数字 + 红蓝双侧小旗 ─────────────────────── */
.rbt-scorecard { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; padding: 1px 8px; border-radius: 10px; background: linear-gradient(180deg, #FFFFFF, #EEF3FC); box-shadow: inset 0 -3px 0 rgba(90,110,170,.14), 0 2px 6px rgba(90,110,170,.22); }
.rbt-card-l { border-bottom: 3px solid var(--rbt-blue); }
.rbt-card-r { border-bottom: 3px solid var(--rbt-red); }
.rbt-flag { width: 10px; height: 13px; flex: 0 0 auto; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 70%, 0 100%); }
.rbt-flag-l { background: linear-gradient(180deg, var(--rbt-blue), var(--rbt-blue-deep)); }
.rbt-flag-r { background: linear-gradient(180deg, var(--rbt-red), var(--rbt-red-deep)); }
.rbt-flip { animation: rbtFlip var(--rbt-flip-ms) ease-in-out; }
@keyframes rbtFlip { 0% { transform: rotateX(84deg); } 100% { transform: rotateX(0deg); } }

/* ── 反应耗时小气泡（⑤ 层）：读既有统计值，纯展示 ─────────────────── */
.rbt-bubble { position: absolute; left: 50%; bottom: calc(100% + 4px); transform: translateX(-50%); background: #ffffffee; color: #3F5C9A; font-size: 14px; font-weight: 900; line-height: 1.2; border-radius: 999px; padding: 2px 9px; white-space: nowrap; pointer-events: none; z-index: 6; box-shadow: 0 2px 6px rgba(90,110,170,.3); animation: rbtBubbleUp 700ms ease-out forwards; }
.rbt-bubble-fast { color: #B26A00; background: #FFF6E0ee; }
@keyframes rbtBubbleUp { 0% { opacity: 0; transform: translateX(-50%) translateY(6px); } 18% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-14px); } }

/* ── 连对 ${STREAK_FLOW_NEED} 次：按垫边缘流光一圈 ──────────────────── */
.rbt-pad-flow .rbt-key { animation: rbtFlow var(--rbt-flow-ms) ease-out; }
@keyframes rbtFlow {
  0% { box-shadow: 0 3px 0 var(--rbt-key-face, rgba(90,110,170,.22)), 0 0 0 0 var(--rbt-ripple-good); }
  55% { box-shadow: 0 3px 0 var(--rbt-key-face, rgba(90,110,170,.22)), 0 0 14px 4px var(--rbt-ripple-good); }
  100% { box-shadow: 0 3px 0 var(--rbt-key-face, rgba(90,110,170,.22)), 0 0 0 0 rgba(255,214,120,0); }
}

/* ── 顶栏卡片化（⑥ 层）─────────────────────────────────────────── */
.rbt-vs-tag { background: linear-gradient(180deg, #FFFFFF, #F0F4FC); box-shadow: 0 2px 6px rgba(90,110,170,.18), inset 0 -2px 0 rgba(90,110,170,.1); }

/* ── 开局倒计时浮层（⑦ 层）：压进既有 700ms 间隙，绝不推迟出题 ────── */
.rbt-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; pointer-events: none; z-index: 9; animation: rbtCountFade var(--rbt-count-ms) linear forwards; }
.rbt-count-num { font-size: 56px; font-weight: 900; color: #3F5C9A; text-shadow: 0 3px 0 #ffffff, 0 6px 14px rgba(90,110,170,.4); opacity: 0; animation: rbtCountNum ${COUNTDOWN_STEP_MS}ms cubic-bezier(.34,1.56,.64,1) forwards; }
.rbt-count-num:nth-child(2) { animation-delay: ${COUNTDOWN_STEP_MS}ms; }
.rbt-count-num:nth-child(3) { animation-delay: ${COUNTDOWN_STEP_MS * 2}ms; }
@keyframes rbtCountNum { 0% { opacity: 0; transform: scale(.4); } 45% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1); } }
@keyframes rbtCountFade { 0%, 90% { opacity: 1; } 100% { opacity: 0; } }

/* ── 星屑（得分方按垫上放 5 颗，走 art-kit 的 CSS 等价） ─────────── */
${sparkleCss("rbt")}

/* ── 窄屏：信号灯仍占视觉中心（直径 ≥ ${SIGNAL_MIN_VW}% 视口宽） ──── */
@media (max-width: 420px) {
  .rbt-vs { --rbt-signal-size: max(${SIGNAL_MIN_VW}vw, 80px); }
}
@media (max-width: 420px) and (max-height: 700px) {
  .rbt-vs { --rbt-signal-size: max(${SIGNAL_MIN_VW}vw, 72px); }
}

/* ── prefers-reduced-motion：squash / 波纹 / 流光 / 翻页 / 星屑全停，
      信号变色保留全强度（预备恒定黄、出题静态变色不缩不闪） ──────── */
@media (prefers-reduced-motion: reduce) {
  .rbt-signal { transition: none; }
  .rbt-signal-ready { animation: none; }
  .rbt-signal-live { animation: none; opacity: 1; transform: translate(-50%, -56%) scale(.6); }
  .rbt-key, .rbt-key-lit { transition: color .3s linear; }
  .rbt-key:active, .rbt-key-lit:active { transform: none; border-color: var(--rbt-key-press, #5D6F96); }
  .rbt-ripple, .rbt-bubble { display: none; }
  .rbt-flip { animation: none; }
  .rbt-pad-flow .rbt-key { animation: none; box-shadow: 0 3px 0 var(--rbt-key-face, rgba(90,110,170,.22)), 0 0 0 3px var(--rbt-ripple-good); }
  .rbt-count-num { animation: none; opacity: 0; }
  .rbt-count::after { content: "预备…"; font-size: 24px; font-weight: 900; color: #3F5C9A; }
}
`;

// ---------------------------------------------------------------------------
// 闯关（index.ts）的视觉层 CSS：果冻点点 + 计分牌卡片 + 波纹
// ---------------------------------------------------------------------------

export const CAMPAIGN_VISUAL_CSS = `
.rbt-wrap { ${RBT_TOKEN_DECL}; }
/* 果冻点点：径向渐变 + 高光带 + 内描边 + 3px 立面，全走 background / box-shadow，
   62/72px 的热区一个像素不动（描边用 inset 阴影，绝不用会撑大盒子的 border） */
.rbt-arena .rbt-dot { background: radial-gradient(ellipse 130% 58% at 50% -14%, rgba(255,255,255,.5) 0 40%, rgba(255,255,255,0) 41%), radial-gradient(circle at 50% 36%, #FFFFFF 0%, #F4F7FF 52%, ${shade("#F4F7FF", -12)} 100%); box-shadow: inset 0 0 0 2px rgba(70,90,150,.16), 0 3px 0 rgba(70,90,150,.2), 0 4px 10px rgba(100,120,180,.3); transition: transform var(--rbt-squash-ms) cubic-bezier(.34,1.56,.64,1); }
.rbt-wrap .rbt-dot:active { transform: ${jellyPressTransform()}; }
.rbt-arena { position: relative; }
/* B 档 TOP9（第 1 轮移交）：闯关场地氛围底——5 个淡色圆点错落铺底，金蓝交替、
   透明度 ≤ .12，纯静态零动效；写成 background-image 长手不碰底色与热区，
   选择器带 .rbt-wrap 压过基础壳 background 简写里的 image:none */
.rbt-wrap .rbt-arena { background-image:
  radial-gradient(circle at 18% 22%, ${withAlpha(PASTEL.starGold, 0.1)} 0 3.5px, rgba(0,0,0,0) 4px),
  radial-gradient(circle at 78% 16%, ${withAlpha(PASTEL.blue, 0.08)} 0 2.6px, rgba(0,0,0,0) 3.1px),
  radial-gradient(circle at 62% 64%, ${withAlpha(PASTEL.starGold, 0.1)} 0 4px, rgba(0,0,0,0) 4.5px),
  radial-gradient(circle at 30% 78%, ${withAlpha(PASTEL.blue, 0.08)} 0 2.8px, rgba(0,0,0,0) 3.3px),
  radial-gradient(circle at 88% 82%, ${withAlpha(PASTEL.starGold, 0.1)} 0 3.2px, rgba(0,0,0,0) 3.7px); }
/* 计分牌卡片化：me / ai 两枚徽章带红蓝立面，比分变化时轻弹一下 */
.rbt-badge.rbt-me { box-shadow: 0 2px 6px rgba(120,140,200,.25), inset 0 -3px 0 var(--rbt-blue); }
.rbt-badge.rbt-ai { box-shadow: 0 2px 6px rgba(120,140,200,.25), inset 0 -3px 0 var(--rbt-red); }
.rbt-pop { display: inline-block; animation: rbtScorePop var(--rbt-flip-ms) ease-in-out; }
@keyframes rbtScorePop { 0% { transform: scale(.82); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
/* 波纹与星屑复用对战场那一套类名（样式再声明一遍：两个壳不共享 style 节点） */
.rbt-ripple { position: absolute; left: var(--rbt-rip-x, 50%); top: var(--rbt-rip-y, 50%); width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%, -50%) scale(0); pointer-events: none; z-index: 5; animation: rbtRipple var(--rbt-ripple-ms) ease-out forwards; }
.rbt-ripple-good { border: 3px dashed var(--rbt-ripple-good); box-shadow: 0 0 10px var(--rbt-ripple-good); }
.rbt-ripple-miss { border: 2px solid var(--rbt-ripple-miss); box-shadow: none; }
@keyframes rbtRipple { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(var(--rbt-rip-scale, 8.4)); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .rbt-wrap .rbt-dot:active { transform: none; }
  .rbt-arena .rbt-dot { transition: none; }
  .rbt-ripple { display: none; }
  .rbt-pop { animation: none; }
}
`;

// ---------------------------------------------------------------------------
// 纯视图函数：只读玩法数据，产出「画什么」
// ---------------------------------------------------------------------------

export interface SignalFace {
  /** 信号灯上显示的剪影：形状优先于颜色（色觉双通道） */
  glyph: string;
  /** 信号灯的底色 */
  hex: string;
}

/**
 * 这一轮信号灯亮什么。只读 `RoundPlan`：
 *  · 反应轮亮目标格子的颜色 + 形状（黄▲ / 蓝● …，形状本身就是第二通道）；
 *  · 颜色轮亮指令色的形状，反向指令再叠一个 🚫（三角 vs 圆靠 COLOR_FACE 天生分开）；
 *  · 顺序轮亮「1→n」、计数轮亮「×n」。
 */
export function signalFace(plan: RoundPlan): SignalFace {
  if (plan.kind === "reaction") {
    const c = plan.slots[plan.targets[0]] ?? "yellow";
    const f = COLOR_FACE[c];
    return { glyph: f.shape, hex: f.hex };
  }
  if (plan.kind === "order") return { glyph: `1→${plan.need}`, hex: COLOR_FACE.blue.hex };
  if (plan.kind === "color" && plan.commandColor) {
    const f = COLOR_FACE[plan.commandColor];
    return { glyph: plan.negative ? `🚫${f.shape}` : f.shape, hex: f.hex };
  }
  return { glyph: `×${plan.need}`, hex: COLOR_FACE.green.hex };
}

/** 领先方是谁：只读比分，平局给 null。映射到「那一侧亮 4%」的类名 */
export function leadSide(left: number, right: number): "left" | "right" | null {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) return null;
  return left > right ? "left" : "right";
}

/** 这一下的反应耗时：读对局既有的时间戳（res.t 与 duel.lightAt），不碰任何统计 */
export function reactionMsOf(tapT: number, lightAt: number): number {
  if (!Number.isFinite(tapT) || !Number.isFinite(lightAt)) return 0;
  return Math.max(0, Math.round(tapT - lightAt));
}
