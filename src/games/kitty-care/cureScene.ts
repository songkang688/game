/**
 * 萌猫小屋 · 看病任务的纯视觉素材层（1.3 视觉升级 · 第 26 步 C 档新增）。
 *
 * 这里全是**纯函数与常量字符串**：小屋场景 SVG、照护道具自绘图标、
 * 三态立绘与 `curePlan` 进度的映射、窗台摆件与痊愈进度的映射、
 * 对话气泡尾巴的几何、爱心泡泡 / 彩纸的轨迹参数。
 * 不碰 DOM、不开计时器、不读存档——判定层（`tasks.ts`）一个字都不认识它。
 * 小猫立绘本体在共享套件 `src/art/kit/kittySvg.ts`（同为本步新增的独占文件）。
 */
import { KITTY_FURS, type KittyFur, type KittyState } from "../../art/kit/kittySvg";

// ---------------------------------------------------------------------------
// 三态立绘与照护进度的映射
// ---------------------------------------------------------------------------

/** 立绘状态随 `curePlan` 进度走：一步没做＝待照护，做起来了＝照护中，做完＝痊愈 */
export function kittyStateFor(step: number, done: boolean): KittyState {
  if (done) return "cured";
  return Math.floor(step) > 0 ? "caring" : "sick";
}

/** 毛色按局三选一（跟着关卡种子走，同一关每次进入一致） */
export function furForSeed(seed: number): KittyFur {
  const n = Math.floor(Number.isFinite(seed) ? seed : 0);
  return KITTY_FURS[((n % 3) + 3) % 3];
}

/** 三花斑位（0 / 1 两套固定）也跟种子走，绝不闪变 */
export function calicoVariantForSeed(seed: number): number {
  const n = Math.floor(Number.isFinite(seed) ? seed : 0);
  return ((Math.floor(n / 3) % 2) + 2) % 2;
}

// ---------------------------------------------------------------------------
// 步骤卡链：把 curePlan 的一条文本拆成「图标位 + 名字」（文本一字不丢）
// ---------------------------------------------------------------------------

/**
 * `curePlan` 给的文本是「🧻 擦擦小鼻子」「❓ 先看一看」「· · ·」三种。
 * 前两种拆出打头的符号当卡上的图标位；占位的「· · ·」整个当名字，不拆。
 */
export function splitStepText(text: string): { icon: string; label: string } {
  const t = (text ?? "").trim();
  if (!t || t === "· · ·") return { icon: "", label: t || "· · ·" };
  const sp = t.indexOf(" ");
  if (sp <= 0) return { icon: "", label: t };
  const head = t.slice(0, sp);
  if (/^[\p{L}\p{N}]/u.test(head)) return { icon: "", label: t };
  return { icon: head, label: t.slice(sp + 1) };
}

// ---------------------------------------------------------------------------
// 对话气泡尾巴：几何上真的指向小猫
// ---------------------------------------------------------------------------

export interface BoxLike {
  left: number;
  width: number;
}

/**
 * 尾巴该落在气泡横向的百分之几：指向目标（小猫立绘）的中心，
 * 夹在 8%..92% 之间免得戳出圆角。量不到（测试桩 / 还没排版）就居中。
 */
export function bubbleTailX(bubble?: BoxLike | null, target?: BoxLike | null): number {
  if (!bubble || !target || !(bubble.width > 0) || !(target.width > 0)) return 50;
  const center = target.left + target.width / 2;
  const pct = ((center - bubble.left) / bubble.width) * 100;
  return Math.round(Math.max(8, Math.min(92, pct)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 治愈仪式的台词与轨迹（reduced 下调用方只放静态那份）
// ---------------------------------------------------------------------------

/** 痊愈瞬间的呼噜特效字 */
export const PURR_TEXT = "咕噜咕噜";
/** 选错道具时小猫歪头说的那一声（不批评） */
export const MEOW_TEXT = "喵?";

/** 爱心泡泡 5 颗的轨迹参数（确定性：同 count 永远同一组） */
export function heartBubbleSpecs(count = 5): Array<{ leftPct: number; delayMs: number; sizePx: number }> {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => ({
    leftPct: 18 + ((i * 29) % 64),
    delayMs: i * 90,
    sizePx: 14 + ((i * 5) % 8)
  }));
}

export const CONFETTI_COLORS = ["#ffd93d", "#7bc86c", "#8fd6ff", "#ff8ba0", "#d0bfff"] as const;

/** 彩纸的轨迹参数（确定性，不掷骰子） */
export function confettiSpecs(count = 10): Array<{ leftPct: number; delayMs: number; color: string; tiltDeg: number }> {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => ({
    leftPct: (7 + i * 37) % 100,
    delayMs: i * 45,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    tiltDeg: ((i * 53) % 80) - 40
  }));
}

// ---------------------------------------------------------------------------
// 窗台摆件：痊愈次数越多，窗台越热闹（纯装饰，进度只读）
// ---------------------------------------------------------------------------

/** 摆件数量映射：0 天→0 件，往后每照顾好 2 天多一件，窗台最多摆 4 件 */
export function sillOrnaments(cured: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(cured) ? cured : 0));
  return Math.min(4, Math.ceil(n / 2));
}

/** 第 i 件摆件长什么样（四种小玩意儿轮着来，全部原创小物） */
export function sillOrnamentSvg(index: number): string {
  const i = ((Math.floor(index) % 4) + 4) % 4;
  const inner =
    i === 0
      ? `<path d="M5 9 h6 l-1 5 h-4 z" fill="#d1813a"/><path d="M8 9 q-4 -6 -6 -3 q3 1 6 3 z" fill="#7bc86c"/><path d="M8 9 q4 -6 6 -3 q-3 1 -6 3 z" fill="#5aa84e"/>`
      : i === 1
        ? `<path d="M8 2 l1.8 3.8 4.2 .6 -3 3 .7 4.2 -3.7 -2 -3.7 2 .7 -4.2 -3 -3 4.2 -.6 z" fill="#ffd93d" stroke="#e0b429" stroke-width="1"/>`
        : i === 2
          ? `<circle cx="8" cy="9" r="5.5" fill="#ff8ba0"/><path d="M3.5 7.5 q4.5 -3 9 0 M3 10 q5 -3 10 0 M4.5 12.5 q3.5 -2.5 7 0" stroke="#e56f87" stroke-width="1.1" fill="none"/>`
          : `<path d="M3 9 q4 -5 8 0 q-4 5 -8 0 z" fill="#8fd6ff"/><path d="M11 9 l3.5 -2.5 v5 z" fill="#5db7e8"/><circle cx="6" cy="8.4" r=".9" fill="#3c5a8a"/>`;
  return `<svg viewBox="0 0 16 16" width="16" height="16" data-ornament="${i}" aria-hidden="true">${inner}</svg>`;
}

// ---------------------------------------------------------------------------
// 小屋场景（窗 + 阳光斜带 + 相框 + 猫爬架剪影 + 地毯 + 猫窝）
// ---------------------------------------------------------------------------

/** 小屋墙面 / 地毯的配色 token（规格 4.1） */
export const ROOM_COLORS = { wall: "#fdf2ec", rug: "#f2c6c2" } as const;

/**
 * 整块场景层的标记串（调用方 innerHTML 即用；层本身 pointer-events:none）。
 * 窗台摆件数量走 `sillOrnaments(cured)`——痊愈进度只读，别处一个字不碰。
 */
export function roomScene(cured: number): string {
  const pieces = Array.from({ length: sillOrnaments(cured) }, (_, i) => sillOrnamentSvg(i)).join("");
  return `<div class="ktc-scn-beam"></div>
<div class="ktc-scn-window"><svg viewBox="0 0 96 86" aria-hidden="true">
  <rect x="4" y="2" width="88" height="72" rx="7" fill="#e8cdb4"/>
  <rect x="10" y="8" width="76" height="60" rx="4" fill="#cdeafd"/>
  <circle cx="66" cy="26" r="9" fill="#ffe9a8"/>
  <path d="M14 46 q12 -8 24 0 q12 8 22 0" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.8" stroke-linecap="round"/>
  <rect x="45" y="8" width="6" height="60" fill="#e8cdb4"/>
  <rect x="10" y="35" width="76" height="6" fill="#e8cdb4"/>
  <rect x="0" y="74" width="96" height="8" rx="3" fill="#d9b790"/>
</svg><div class="ktc-scn-sill">${pieces}</div></div>
<div class="ktc-scn-frames"><svg viewBox="0 0 72 34" aria-hidden="true">
  <rect x="2" y="4" width="28" height="26" rx="4" fill="#fff" stroke="#d9b790" stroke-width="3"/>
  <path d="M10 22 q6 -10 8 -4 q3 -7 6 4 z" fill="#f4a259"/>
  <circle cx="13" cy="13" r="2.6" fill="#ffd93d"/>
  <rect x="42" y="2" width="28" height="30" rx="4" fill="#fff" stroke="#d9b790" stroke-width="3"/>
  <circle cx="56" cy="15" r="6" fill="#ffb3c1"/>
  <path d="M52 26 q4 -4 8 0" stroke="#e56f87" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg></div>
<div class="ktc-scn-tree"><svg viewBox="0 0 88 96" aria-hidden="true">
  <g fill="#8a6f5a" opacity="0.55">
    <rect x="8" y="88" width="72" height="8" rx="4"/>
    <rect x="22" y="30" width="9" height="60"/>
    <rect x="56" y="12" width="9" height="78"/>
    <rect x="8" y="26" width="38" height="8" rx="4"/>
    <rect x="42" y="8" width="38" height="8" rx="4"/>
    <circle cx="16" cy="20" r="6"/>
    <path d="M66 8 q6 -8 10 0 q-5 3 -10 0 z"/>
  </g>
</svg></div>
<div class="ktc-scn-rug"></div>
<div class="ktc-scn-bed"><svg viewBox="0 0 74 40" aria-hidden="true">
  <path d="M4 22 q0 -14 33 -14 q33 0 33 14 l-4 12 q-29 8 -58 0 z" fill="#e8a87c"/>
  <path d="M10 24 q0 -9 27 -9 q27 0 27 9 q-6 8 -27 8 q-21 0 -27 -8 z" fill="#fdf2ec"/>
  <path d="M14 24 q10 -6 22 0 q-8 6 -22 0 z" fill="#f2c6c2"/>
</svg></div>`;
}

// ---------------------------------------------------------------------------
// 照护道具自绘图标：一件一个样，双色渐变 + 描边（按钮文案与热区零改动）
// ---------------------------------------------------------------------------

interface ToolArt {
  key: string;
  from: string;
  to: string;
  inner: string;
}

const INK = "#8a5a1e";

/** 护理柜 12 件的图形（键 = `levels.ts` CURE_TOOLS 的名字，只画不判定） */
const TOOL_ART: Record<string, ToolArt> = {
  看看小鼻子: {
    key: "nose",
    from: "#ffd7e0",
    to: "#ff8ba0",
    inner: `<path d="M12 12 l8 0 l-4 6 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="20" cy="19" r="7.5" fill="none" stroke="#4a7fd8" stroke-width="2.4"/>
      <path d="M25.5 24.5 L30 29" stroke="#4a7fd8" stroke-width="3" stroke-linecap="round"/>`
  },
  看看饭碗: {
    key: "bowlcheck",
    from: "#ffe9c9",
    to: "#f4a259",
    inner: `<path d="M6 16 h20 a10 10 0 0 1 -20 0 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <ellipse cx="16" cy="16" rx="10" ry="2.6" fill="#fff3dd"/>
      <path d="M12 10 q1.6 -2.4 0 -4.8 M18 10 q1.6 -2.4 0 -4.8" stroke="#c9b797" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  },
  看看小爪子: {
    key: "paw",
    from: "#ffd9b8",
    to: "#e8a87c",
    inner: `<ellipse cx="16" cy="20" rx="7.5" ry="6" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="8.5" cy="12" r="3" fill="url(#G)" stroke="${INK}" stroke-width="1.2"/>
      <circle cx="16" cy="9.5" r="3" fill="url(#G)" stroke="${INK}" stroke-width="1.2"/>
      <circle cx="23.5" cy="12" r="3" fill="url(#G)" stroke="${INK}" stroke-width="1.2"/>`
  },
  摸摸毛: {
    key: "fur",
    from: "#f4efff",
    to: "#c9b8ec",
    inner: `<path d="M6 20 q5 -12 20 -8 q-2 12 -14 12 q-5 0 -6 -4 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M10 17 q3 -3 7 -3 M12 21 q3 -3 8 -3" stroke="#9c8ac2" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M23 8 q3 -3 5 0" stroke="#9c8ac2" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  },
  喝点温水: {
    key: "water",
    from: "#d9f0ff",
    to: "#8fd6ff",
    inner: `<path d="M9 7 h14 l-2 18 h-10 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M10.5 14 q3 2 5.5 0 q3 -2 5.5 0" stroke="#4a7fd8" stroke-width="1.6" fill="none"/>
      <path d="M13 4 q1.4 -2 0 -3.4 M19 4 q1.4 -2 0 -3.4" stroke="#a9c8e8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  },
  盖上小毯子: {
    key: "blanket",
    from: "#ffe3ec",
    to: "#f2b8cd",
    inner: `<rect x="5" y="9" width="22" height="15" rx="4" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M5 14 h22" stroke="#e08bab" stroke-width="2"/>
      <path d="M5 19 h22" stroke="#fff" stroke-width="2" opacity="0.7"/>
      <rect x="5" y="9" width="8" height="15" rx="4" fill="#fff" opacity="0.35"/>`
  },
  轻轻拔小刺: {
    key: "tweezer",
    from: "#e6f4ea",
    to: "#a8d8b4",
    inner: `<path d="M10 4 q-3 10 4 20 M22 4 q3 10 -4 20" stroke="url(#G)" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <circle cx="16" cy="5.5" r="2.6" fill="#7bc86c" stroke="${INK}" stroke-width="1.2"/>
      <path d="M15 27 l2 -4 l2 4 z" fill="#c9a06a"/>`
  },
  戴手套梳毛: {
    key: "comb",
    from: "#fff3c9",
    to: "#f0c25a",
    inner: `<rect x="5" y="9" width="22" height="6" rx="3" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M8 15 v9 M13 15 v9 M18 15 v9 M23 15 v9" stroke="#c99a3a" stroke-width="2.2" stroke-linecap="round"/>`
  },
  换成软软的饭: {
    key: "softmeal",
    from: "#ffe9c9",
    to: "#f4a259",
    inner: `<path d="M5 18 h22 a11 11 0 0 1 -22 0 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M9 18 q2 -7 7 -7 q5 0 7 7 z" fill="#fff3dd" stroke="${INK}" stroke-width="1.2"/>
      <path d="M25 7 q4 1 3 5" stroke="#c9b797" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
  },
  安安静静休息: {
    key: "rest",
    from: "#e4e0f7",
    to: "#b9aede",
    inner: `<path d="M20 5 a9 9 0 1 0 7 14 a8 8 0 0 1 -7 -14 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <rect x="4" y="21" width="16" height="7" rx="3.5" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`
  },
  擦擦小鼻子: {
    key: "tissue",
    from: "#f2fbff",
    to: "#cfeaff",
    inner: `<rect x="5" y="14" width="22" height="12" rx="3" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M11 14 q2 -8 5 -6 q4 2 2 6 z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
      <rect x="12" y="17" width="8" height="2.4" rx="1.2" fill="#8fb8d8"/>`
  },
  带去看兽医: {
    key: "vet",
    from: "#e3f6ec",
    to: "#a8ddc3",
    inner: `<path d="M6 14 L16 5 L26 14 v12 h-20 z" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
      <path d="M16 15 c-1.6 -2.6 -6 -1.5 -6 1.6 c0 2.6 3.7 4.3 6 6.4 c2.3 -2.1 6 -3.8 6 -6.4 c0 -3.1 -4.4 -4.2 -6 -1.6 z" fill="#ff8ba0"/>`
  }
};

/** 兜底图标：认不得的名字给一颗圆底爪印，绝不空着 */
const FALLBACK_ART: ToolArt = {
  key: "care",
  from: "#fff3dd",
  to: "#ffd9a8",
  inner: `<circle cx="16" cy="16" r="12" fill="url(#G)" stroke="${INK}" stroke-width="1.4"/>
    <ellipse cx="16" cy="19" rx="4.4" ry="3.6" fill="#e8a87c"/>
    <circle cx="10.5" cy="13.5" r="2" fill="#e8a87c"/>
    <circle cx="16" cy="12" r="2" fill="#e8a87c"/>
    <circle cx="21.5" cy="13.5" r="2" fill="#e8a87c"/>`
};

/** 一共画了几种道具图标（测试用） */
export const TOOL_ICON_COUNT = Object.keys(TOOL_ART).length;

/**
 * 照护道具图标：双色渐变 + 描边的 28×28 小图。
 * 键是护理柜里那件东西的名字；渐变 id 按 key 隔离，同屏多枚不打架。
 */
export function toolIconSvg(name: string): string {
  const art = TOOL_ART[name] ?? FALLBACK_ART;
  const gid = `ktcTool-${art.key}`;
  return `<svg viewBox="0 0 32 32" class="ktc-toolsvg" data-tool="${art.key}" aria-hidden="true">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${art.from}"/><stop offset="1" stop-color="${art.to}"/>
  </linearGradient></defs>
  ${art.inner.replaceAll("url(#G)", `url(#${gid})`)}
</svg>`;
}
