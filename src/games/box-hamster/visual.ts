// 推箱小仓鼠 · 1.3 视觉层(C 档视觉升级)。
//
// 这里放的全是「怎么画」:--bh- 配色 token、格内层级、木箱 / 礼物盒 SVG、
// 三种移动(推 / 滑 / 传)的视觉分类、动效时序表、章节主题角标、HUD 小图标。
// 全部纯数据与纯函数,不碰 DOM;index.ts 只负责把这里算出来的东西挂上去。
//
// 红线:这一层绝不读写推箱判定 / 冰面滑行 / 传送逻辑 / 关卡数据 / 撤销与步数,
// 平移的功能动画时长仍走 assist.ts 的 moveDuration,一个数都不改。
import { shade } from "../../art/kit/palette";
import {
  hamsterSvg,
  type HamsterFacing,
  type HamsterPose,
  type HamsterStyle,
} from "../../art/kit/hamsterSvg";
import {
  cowlickCrestGroup,
  dorsalStripeGroup,
  flowerCrestGroup,
  injectFigureAccents,
} from "../../art/kit/hamsterAccents";
import { bodyFontUpliftCss, touchUpliftCss } from "../../art/kit/uiTouch";
import { PUSH_MS, WALK_MS } from "./assist";
import type { Board, Dir, MoveOutcome } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色 token(四·补一规格表原样落成常量,动一个色值单测就红)
// ---------------------------------------------------------------------------

export const BH_TOKENS = {
  "--bh-floor": "#F8F1E4",
  "--bh-wall": "#C89B6C",
  "--bh-ice": "#DDF2FF",
  "--bh-goal": "#B8E39B",
  "--bh-box": "#D9A06B",
  "--bh-gift": "#F4859F",
  "--bh-portal-in": "#9F8FF0",
  "--bh-portal-out": "#F0C25A",
  "--bh-hamster-a": "#E8B27A",
  "--bh-hamster-b": "#C9CFEA",
} as const;

/** 立柱投影 / 箱侧面统一「主色 -22%」的换算档 */
export const SIDE_SHADE = -22;
/** 栅栏立柱色 = 墙主色 -22% */
export const WALL_POST = shade(BH_TOKENS["--bh-wall"], SIDE_SHADE);
/** 木箱侧面色 = 箱主色 -22% */
export const BOX_SIDE = shade(BH_TOKENS["--bh-box"], SIDE_SHADE);

/**
 * 格内层级(z-index 从低到高):
 * ① 地形底(地板/冰/草窝)→ ② 传送门旋涡 → ③ 箱子/礼物盒 → ④ 仓鼠 →
 * ⑤ 尘土/擦痕/彩带 → ⑥ 完成金光。
 */
export const BH_LAYER_Z = {
  terrain: 0,
  portal: 1,
  box: 2,
  hamster: 3,
  fx: 4,
  gold: 5,
} as const;

// ---------------------------------------------------------------------------
// 二、动效时序表(四·补三;平移时长沿用 assist 的既有常量,不另立数)
// ---------------------------------------------------------------------------

export const BH_TIMINGS = {
  /** 功能平移:沿用既有 moveDuration 的两档,这里只是登记对照 */
  moveWalkMs: WALK_MS,
  movePushMs: PUSH_MS,
  /** 推箱尘土两粒 */
  dustMs: 240,
  /** 冰面擦痕渐隐 */
  scratchMs: 300,
  /** 传送旋入旋出 */
  teleportMs: 200,
  /** 礼物盒金光脉冲一圈 */
  giftPulseMs: 500,
  /** 腮帮咀嚼两帧一轮 */
  chewMs: 1200,
  /** 完成转圈彩带 */
  winSpinMs: 800,
} as const;

/** 最小格兜底:格子边长 ≤ 28px 时省略尘土,只留推箱姿态 */
export const DUST_MIN_CELL = 28;

/** 这一格的边长下要不要冒尘土(reduced 一律不生成) */
export function shouldShowDust(cellPx: number, reducedMotion: boolean): boolean {
  return !reducedMotion && cellPx > DUST_MIN_CELL;
}

// ---------------------------------------------------------------------------
// 三、双仓鼠款式与仓鼠 SVG(耳形 + 头饰双剪影通道,16px 灰度也分得开)
// ---------------------------------------------------------------------------

export const BH_HAMSTER_STYLES: readonly HamsterStyle[] = [
  {
    fur: BH_TOKENS["--bh-hamster-a"],
    belly: "#F9EBD6",
    ear: "round",
    topper: "flower",
    topperColor: BH_TOKENS["--bh-gift"],
  },
  {
    fur: BH_TOKENS["--bh-hamster-b"],
    belly: "#F0F3FB",
    ear: "fold",
    topper: "cowlick",
    topperColor: "#8FA0D6",
  },
];

/**
 * 第 who 只仓鼠在某朝向 / 姿态下的 SVG(咀嚼两帧挂 bxh-chew,轮播归 CSS)。
 * W6R2-01:侧/背朝向 16px 灰度 1.2–2.0% 偏弱,按 moleAccents 先例叠加
 * 头冠强化层(A 鼠花冠放大加描边 / B 鼠呆毛加粗成墨底色芯双笔道),
 * 注入 bhh-figure 组内跟随推箱前倾;hamsterSvg.ts 冻结不动。
 */
export function bhHamsterSvg(who: number, facing: HamsterFacing, pose: HamsterPose): string {
  const style = BH_HAMSTER_STYLES[who % BH_HAMSTER_STYLES.length];
  const svg = hamsterSvg({ style, facing, pose, chewClass: "bxh-chew" });
  const groups =
    style.topper === "flower"
      ? [flowerCrestGroup(facing, style.topperColor)]
      : [dorsalStripeGroup(facing, style.fur), cowlickCrestGroup(facing, style.topperColor)];
  return injectFigureAccents(svg, groups);
}

// ---------------------------------------------------------------------------
// 四、木箱与礼物盒(2.5D 双面:顶面亮、侧面 -22% 暗)
// ---------------------------------------------------------------------------

/** 木箱:木板纹三条 + 四角铁片 + 顶亮侧暗 */
export function boxSvg(): string {
  const main = BH_TOKENS["--bh-box"];
  const top = shade(main, 16);
  const line = shade(main, -14);
  const edge = shade(main, -32);
  const plate = "#9AA7BC";
  const plateLine = "#7C8AA0";
  const plates = [
    [11, 24],
    [45, 24],
    [11, 48],
    [45, 48],
  ]
    .map(
      ([x, y]) =>
        `<rect x="${x}" y="${y}" width="8" height="8" rx="1.6" fill="${plate}" stroke="${plateLine}" stroke-width="1"/>` +
        `<circle cx="${x + 4}" cy="${y + 4}" r="1" fill="${plateLine}"/>`
    )
    .join("");
  return (
    `<svg class="bxh-box-svg" viewBox="0 0 64 64" aria-hidden="true">` +
    // 顶面(亮)与右侧面(-22% 暗):2.5D 双面
    `<polygon class="bxh-box-top" points="9,22 16,11 57,11 50,22" fill="${top}" stroke="${edge}" stroke-width="1.4"/>` +
    `<polygon class="bxh-box-side" points="50,22 57,11 57,47 50,58" fill="${BOX_SIDE}" stroke="${edge}" stroke-width="1.4"/>` +
    // 正面主体 + 三条木板纹
    `<rect x="9" y="22" width="41" height="36" rx="2.5" fill="${main}" stroke="${edge}" stroke-width="1.6"/>` +
    `<g class="bxh-box-planks" stroke="${line}" stroke-width="1.4">` +
    `<line x1="10.5" y1="31" x2="48.5" y2="31"/>` +
    `<line x1="10.5" y1="40" x2="48.5" y2="40"/>` +
    `<line x1="10.5" y1="49" x2="48.5" y2="49"/>` +
    `</g>` +
    plates +
    `</svg>`
  );
}

/**
 * 到位的礼物盒:缎带 + 蝴蝶结 + 一圈金光。
 * fresh=true 时金光带脉冲类(刚归位那一下才放一圈),否则只留静态金边;
 * reduced 下 CSS 把脉冲关掉,静态金边仍在。
 */
export function giftSvg(fresh: boolean): string {
  const ribbon = BH_TOKENS["--bh-gift"];
  const ribbonDark = shade(ribbon, -18);
  const body = "#FFF3F6";
  const lid = "#FFE1EA";
  const gold = "#F7C948";
  const ringCls = fresh ? "bxh-gift-ring bxh-gift-pulse" : "bxh-gift-ring";
  return (
    `<svg class="bxh-gift-svg" viewBox="0 0 64 64" aria-hidden="true">` +
    `<circle class="${ringCls}" cx="32" cy="36" r="25" fill="none" stroke="${gold}" stroke-width="2.5"/>` +
    `<rect x="11" y="27" width="42" height="30" rx="3.5" fill="${body}" stroke="${ribbonDark}" stroke-width="1.6"/>` +
    `<rect x="8.5" y="19" width="47" height="10" rx="3" fill="${lid}" stroke="${ribbonDark}" stroke-width="1.6"/>` +
    `<rect class="bxh-gift-ribbon" x="28.5" y="19" width="7" height="38" fill="${ribbon}"/>` +
    // 蝴蝶结:两个环 + 中心结
    `<g class="bxh-gift-bow">` +
    `<path d="M32 16 C24 8.5 17.5 12 21.5 17.5 C24 20.5 29 19 32 16 Z" fill="${ribbon}" stroke="${ribbonDark}" stroke-width="1.2"/>` +
    `<path d="M32 16 C40 8.5 46.5 12 42.5 17.5 C40 20.5 35 19 32 16 Z" fill="${ribbon}" stroke="${ribbonDark}" stroke-width="1.2"/>` +
    `<circle cx="32" cy="16.5" r="2.6" fill="${ribbonDark}"/>` +
    `</g></svg>`
  );
}

/** 这一格的棋子皮:到位 = 礼物盒(bh-done 语义不变),没到位 = 木箱 */
export function boxPieceSvg(done: boolean, fresh: boolean): string {
  return done ? giftSvg(fresh) : boxSvg();
}

// ---------------------------------------------------------------------------
// 五、三种移动的视觉语义(推 / 滑 / 传一眼可分;只读 MoveOutcome,不改一个字)
// ---------------------------------------------------------------------------

export type BhMoveKind = "walk" | "push" | "slide" | "teleport";

/**
 * 从规则层的走步结果分类视觉表现:
 * - 仓鼠被传送、或被推的箱子最后一跳是传送门配对 → teleport;
 * - 推了箱子 → push;
 * - 自由走却滑出不止一格 → slide(冰面);
 * - 其余 → walk。
 */
export function classifyMove(b: Pick<Board, "portal">, out: MoveOutcome): BhMoveKind {
  if (out.teleported) return "teleport";
  if (out.pushed) {
    const bp = out.boxPath;
    if (bp.length >= 2 && b.portal[bp[bp.length - 2]] === bp[bp.length - 1]) return "teleport";
    return "push";
  }
  return out.path.length > 1 ? "slide" : "walk";
}

/** 三种移动各自的附加类;walk 是本务动画,不加戏 */
export const MOVE_FX_CLASS: Record<BhMoveKind, string> = {
  walk: "",
  push: "bxh-fx-push",
  slide: "bxh-fx-slide",
  teleport: "bxh-fx-tp",
};

/** 这一步之后仓鼠摆什么姿态(28px 兜底省略的是尘土,姿态永远保留) */
export function poseForKind(kind: BhMoveKind): HamsterPose {
  return kind === "push" ? "push" : kind === "slide" ? "slide" : "idle";
}

/** 推箱尘土两粒:从箱底往推动的反方向飘(dir 是推动方向) */
export function dustHtml(dir: Dir): string {
  const dx = [0, -1, 0, 1][dir];
  const dy = [1, 0, -1, 0][dir];
  const one = (k: number, spread: number): string =>
    `<span class="bxh-dust" style="--ddx:${dx * 46 + spread}%;--ddy:${dy * 46 + Math.abs(dx) * spread}%;--dd:${k * 40}ms"></span>`;
  return one(0, -18) + one(1, 18);
}

/** 冰面擦痕:一条顺着滑行方向的短亮线,300ms 渐隐 */
export function scratchHtml(dir: Dir): string {
  const rot = dir === 0 || dir === 2 ? 90 : 0;
  return `<span class="bxh-scratch" style="--rot:${rot}deg"></span>`;
}

/** 传送入口的旋入小闪(出口的旋出直接加在棋子上) */
export function teleportInHtml(): string {
  return `<span class="bxh-tp-in"></span>`;
}

/** 过关彩带:六片小纸屑,颜色与落点写死成表,reduced 下 CSS 关动画变静态彩带 */
export function confettiHtml(): string {
  const pieces: Array<[string, number, number, number]> = [
    [BH_TOKENS["--bh-gift"], -34, -46, -50],
    ["#F7C948", 26, -54, 40],
    ["#8fe0c4", -18, -30, 25],
    ["#a9d8ff", 38, -26, -35],
    ["#d9bcff", -42, -12, 60],
    ["#ffd75e", 12, -40, -15],
  ];
  return pieces
    .map(
      ([c, tx, ty, rot], i) =>
        `<span class="bxh-confetti" style="--c:${c};--ctx:${tx}%;--cty:${ty}%;--crot:${rot}deg;--cd:${i * 40}ms"></span>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// 六、章节主题角标(木屋 / 冰窖 / 花园轮换,纯装饰)
// ---------------------------------------------------------------------------

export interface BhTheme {
  id: "cabin" | "cellar" | "garden";
  label: string;
  /** 舞台底色 */
  tint: string;
  /** 角标 SVG */
  deco: string;
  /**
   * 舞台底纹(B 档 TOP-9):整幅 background 值,tint 收底。
   * 峰值透明度 ≤8%,只给毯面一层材质层次,不与棋盘/HUD 争眼。
   */
  mat: string;
}

/**
 * 花园底纹:三瓣小花,96px 平铺,6% 透明度(纯装饰)。
 * 用三粒 radial-gradient 拼瓣而不是 data-URI SVG——全库硬约束禁止源码里
 * 出现外链协议字样(qaC3fix 扫描),渐变写法也和另两主题的底纹同族。
 */
const GARDEN_PETAL = (x: number, y: number): string =>
  `radial-gradient(circle at ${x}% ${y}%, rgba(244,133,159,.06) 0 5px, rgba(244,133,159,0) 6px) 0 0 / 96px 96px repeat`;
const GARDEN_MAT_TILE = [GARDEN_PETAL(50, 42), GARDEN_PETAL(43, 53), GARDEN_PETAL(57, 53)].join(", ");

const CABIN_DECO =
  `<svg viewBox="0 0 32 32" aria-hidden="true">` +
  `<path d="M4 15 L16 5 L28 15 Z" fill="#C98A5B" stroke="#8F5B33" stroke-width="1.4"/>` +
  `<rect x="7" y="15" width="18" height="12" rx="1.5" fill="#EFD3AC" stroke="#8F5B33" stroke-width="1.4"/>` +
  `<rect x="13.5" y="19" width="5" height="8" rx="1" fill="#B97F4F"/>` +
  `<circle cx="22" cy="21" r="2.2" fill="#FFF3D8" stroke="#8F5B33" stroke-width="1"/></svg>`;

const CELLAR_DECO =
  `<svg viewBox="0 0 32 32" aria-hidden="true">` +
  `<g stroke="#7FBBE8" stroke-width="2" stroke-linecap="round" fill="none">` +
  `<path d="M16 4 L16 28 M6 10 L26 22 M26 10 L6 22"/>` +
  `<path d="M16 8 L13 11 M16 8 L19 11 M16 24 L13 21 M16 24 L19 21"/></g>` +
  `<circle cx="16" cy="16" r="2.4" fill="#BFE2F8"/></svg>`;

const GARDEN_DECO =
  `<svg viewBox="0 0 32 32" aria-hidden="true">` +
  `<path d="M16 18 Q13 26 8 28" stroke="#7CB86A" stroke-width="2" fill="none" stroke-linecap="round"/>` +
  `<g fill="#F4859F">` +
  `<circle cx="16" cy="8" r="3.4"/><circle cx="22.5" cy="12.5" r="3.4"/><circle cx="20" cy="19.5" r="3.4"/>` +
  `<circle cx="12" cy="19.5" r="3.4"/><circle cx="9.5" cy="12.5" r="3.4"/></g>` +
  `<circle cx="16" cy="14" r="3" fill="#FFE9A8"/></svg>`;

export const BH_THEMES: readonly BhTheme[] = [
  {
    id: "cabin",
    label: "木屋",
    tint: "#FFF6E6",
    deco: CABIN_DECO,
    // 45° 木纹:亮暗 ±4% 两段 12px 条,24px 一个周期
    mat:
      "repeating-linear-gradient(45deg, rgba(143,91,51,.04) 0 12px, rgba(255,255,255,.04) 12px 24px), #FFF6E6",
  },
  {
    id: "cellar",
    label: "冰窖",
    tint: "#EAF5FD",
    deco: CELLAR_DECO,
    // 两粒白光斑,峰值 .08,像冰面反着天光
    mat:
      "radial-gradient(circle at 26% 30%, rgba(255,255,255,.08), rgba(255,255,255,0) 32%), " +
      "radial-gradient(circle at 64% 58%, rgba(255,255,255,.08), rgba(255,255,255,0) 36%), #EAF5FD",
  },
  {
    id: "garden",
    label: "花园",
    tint: "#EDF6E4",
    deco: GARDEN_DECO,
    mat: `${GARDEN_MAT_TILE}, #EDF6E4`,
  },
];

/** 章节 → 主题:七章按 木屋 / 冰窖 / 花园 轮换 */
export function themeOf(chapterIndex: number): BhTheme {
  const i = Math.max(0, Math.round(chapterIndex));
  return BH_THEMES[i % BH_THEMES.length];
}

// ---------------------------------------------------------------------------
// 七、HUD 小图标:撤销 = 小时钟回转
// ---------------------------------------------------------------------------

export function undoIconSvg(): string {
  return (
    `<svg class="bxh-undo-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">` +
    `<path class="bxh-undo-arrow" d="M5.5 4.5 L5.5 9 L10 9"/>` +
    `<path d="M5.8 8.8 A8 8 0 1 1 4 13"/>` +
    `<path class="bxh-undo-hands" d="M12 8.5 L12 12.5 L15 14"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 八、样式表(token 与时序全部落成 CSS 自定义属性,reduced 一段收尾)
// ---------------------------------------------------------------------------

export function bhVisualCss(): string {
  const t = BH_TOKENS;
  const wall = t["--bh-wall"];
  const ice = t["--bh-ice"];
  const goal = t["--bh-goal"];
  const tokens = Object.entries(t)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `
/* ---- 1.3 视觉层(C 档):token 与时序集中管理 ---- */
.bh-wrap{${tokens}--bxh-dust-ms:${BH_TIMINGS.dustMs}ms;--bxh-scratch-ms:${BH_TIMINGS.scratchMs}ms;
  --bxh-tp-ms:${BH_TIMINGS.teleportMs}ms;--bxh-gift-ms:${BH_TIMINGS.giftPulseMs}ms;
  --bxh-chew-ms:${BH_TIMINGS.chewMs}ms;--bxh-cheer-ms:${BH_TIMINGS.winSpinMs}ms;}
/* ---- 地形:地板 / 栅栏墙 / 冰面 / 草窝 / 传送门 ---- */
.bh-cell{background:var(--bh-floor);overflow:visible;}
.bh-wall{border-radius:5px;background:
  linear-gradient(180deg,${shade(wall, 18)} 0 13%,rgba(0,0,0,0) 13%),
  repeating-linear-gradient(90deg,${WALL_POST} 0 11%,rgba(0,0,0,0) 11% 33.34%),
  ${wall};
  box-shadow:inset 0 -4px 0 ${shade(wall, -30)},inset 0 2px 0 ${shade(wall, 26)};}
.bh-ice{background:
  radial-gradient(circle at 26% 30%,rgba(255,255,255,.9) 0 6%,rgba(255,255,255,0) 9%),
  radial-gradient(circle at 64% 58%,rgba(255,255,255,.85) 0 5%,rgba(255,255,255,0) 8%),
  radial-gradient(circle at 40% 76%,rgba(255,255,255,.8) 0 4%,rgba(255,255,255,0) 7%),
  linear-gradient(135deg,rgba(255,255,255,0) 36%,rgba(255,255,255,.45) 46%,rgba(255,255,255,.45) 56%,rgba(255,255,255,0) 66%),
  var(--bh-ice);
  box-shadow:inset 0 0 0 2px ${shade(ice, -10)};}
.bh-goal{background:
  radial-gradient(circle,rgba(0,0,0,0) 0 42%,var(--bh-goal) 46% 72%,rgba(0,0,0,0) 76%),
  var(--bh-floor);box-shadow:none;}
.bh-goal::after{content:"";position:absolute;inset:24%;border:2px dashed ${shade(goal, -30)};
  border-radius:50%;opacity:.8;animation:bxhbreath 1.8s ease-in-out infinite;pointer-events:none;}
.bh-goal.bh-ice{background:
  radial-gradient(circle,rgba(0,0,0,0) 0 42%,var(--bh-goal) 46% 72%,rgba(0,0,0,0) 76%),
  var(--bh-ice);}
.bh-portal{background:var(--bh-floor);box-shadow:none;}
.bh-portal::before{content:"";position:absolute;inset:11%;border-radius:50%;z-index:${BH_LAYER_Z.portal};
  background:conic-gradient(var(--bh-portal-in),rgba(255,255,255,.9),var(--bh-portal-in),rgba(255,255,255,.9),var(--bh-portal-in));
  animation:bxhswirl 2.4s linear infinite;opacity:.92;pointer-events:none;}
.bxh-portal-out::before{
  background:conic-gradient(var(--bh-portal-out),rgba(255,255,255,.9),var(--bh-portal-out),rgba(255,255,255,.9),var(--bh-portal-out));
  animation-direction:reverse;}
.bh-portal::after{content:"";position:absolute;inset:34%;border-radius:50%;
  background:rgba(255,255,255,.92);pointer-events:none;z-index:${BH_LAYER_Z.portal};}
.bh-done{background:var(--bh-floor);box-shadow:inset 0 0 0 2px #F7C948;}
/* ---- 棋子与格内层级 ---- */
.bxh-piece{display:block;width:94%;height:94%;pointer-events:none;position:relative;}
.bxh-piece svg{display:block;width:100%;height:100%;}
.bxh-box{z-index:${BH_LAYER_Z.box};}
.bxh-hamster{z-index:${BH_LAYER_Z.hamster};}
.bxh-gift-ring{opacity:.55;transform-origin:50% 50%;}
.bxh-gift-pulse{animation:bxhgold var(--bxh-gift-ms) ease-out;}
/* ---- 三种移动语义:推(尘土)/ 滑(擦痕)/ 传(旋入旋出) ---- */
.bxh-dust{position:absolute;left:42%;bottom:6%;width:15%;height:15%;border-radius:50%;
  background:${shade(t["--bh-box"], -8)};opacity:0;z-index:${BH_LAYER_Z.fx};pointer-events:none;
  animation:bxhdust var(--bxh-dust-ms) ease-out forwards;animation-delay:var(--dd,0ms);}
.bxh-scratch{position:absolute;left:16%;top:47%;width:68%;height:6%;border-radius:99px;
  background:rgba(255,255,255,.95);box-shadow:0 0 4px rgba(255,255,255,.8);z-index:${BH_LAYER_Z.fx};
  transform:rotate(var(--rot,0deg));pointer-events:none;
  animation:bxhscratch var(--bxh-scratch-ms) linear forwards;}
.bxh-tp-out{animation:bxhtpout var(--bxh-tp-ms) ease-in-out;}
.bxh-tp-in{position:absolute;inset:14%;border-radius:50%;z-index:${BH_LAYER_Z.fx};pointer-events:none;
  background:radial-gradient(circle,rgba(255,255,255,.9) 0 30%,var(--bh-portal-in) 60%,rgba(255,255,255,0) 72%);
  animation:bxhtpin var(--bxh-tp-ms) ease-in-out forwards;}
/* ---- 腮帮咀嚼两帧(a 帧常亮打底,reduced 关动画后就停在 a 帧) ---- */
.bxh-chew-a{opacity:1;animation:bxhchew var(--bxh-chew-ms) steps(1,end) infinite;}
.bxh-chew-b{opacity:0;animation:bxhchew var(--bxh-chew-ms) steps(1,end) infinite;
  animation-delay:calc(var(--bxh-chew-ms) / -2);}
/* ---- 过关:仓鼠抱腮转圈 + 彩带 ---- */
.bxh-win .bxh-hamster{animation:bxhcheer var(--bxh-cheer-ms) ease-out;}
.bxh-confetti{position:absolute;left:48%;top:38%;width:11%;height:17%;border-radius:2px;
  background:var(--c,#F7C948);z-index:${BH_LAYER_Z.gold};pointer-events:none;opacity:0;
  animation:bxhconfetti var(--bxh-cheer-ms) ease-out forwards;animation-delay:var(--cd,0ms);}
/* ---- 章节主题角标与 HUD 卡片 ---- */
.bxh-theme{position:absolute;right:8px;top:8px;width:30px;height:30px;opacity:.95;
  pointer-events:none;z-index:2;}
.bxh-theme svg{display:block;width:100%;height:100%;}
.bh-hud{background:#ffffffc9;border-radius:14px;padding:6px 8px;
  box-shadow:0 3px 8px rgba(170,140,100,.16);}
/* 360px 上媒体查询会把字压到 12px,这里兜底 HUD 字号 ≥14px(排在媒体查询之后生效) */
.bh-chip,.bh-btn{font-size:14px;}
.bxh-undo{display:inline-flex;align-items:center;gap:4px;}
.bxh-undo-icon{width:15px;height:15px;flex:none;}
@keyframes bxhdust{0%{opacity:.9;transform:translate(0,0) scale(1);}
  100%{opacity:0;transform:translate(var(--ddx,-30%),var(--ddy,20%)) scale(.4);}}
@keyframes bxhscratch{0%{opacity:.95;}100%{opacity:0;}}
@keyframes bxhtpout{0%{transform:scale(.2) rotate(-300deg);opacity:.2;}
  100%{transform:scale(1) rotate(0deg);opacity:1;}}
@keyframes bxhtpin{0%{opacity:.9;transform:scale(1) rotate(0deg);}
  100%{opacity:0;transform:scale(.15) rotate(280deg);}}
@keyframes bxhgold{0%{opacity:.9;transform:scale(.5);}70%{opacity:.5;}
  100%{opacity:.55;transform:scale(1);}}
@keyframes bxhchew{0%,49.9%{opacity:1;}50%,100%{opacity:0;}}
@keyframes bxhcheer{0%{transform:rotate(0) scale(1);}55%{transform:rotate(300deg) scale(1.12);}
  100%{transform:rotate(360deg) scale(1);}}
@keyframes bxhconfetti{0%{opacity:0;transform:translate(0,0) rotate(0);}12%{opacity:1;}
  100%{opacity:0;transform:translate(var(--ctx,0),var(--cty,-40%)) rotate(var(--crot,40deg));}}
@keyframes bxhswirl{from{transform:rotate(0);}to{transform:rotate(360deg);}}
@keyframes bxhbreath{0%,100%{opacity:.8;transform:scale(1);}50%{opacity:.4;transform:scale(.92);}}
/* ---- reduced:咀嚼 / 旋涡 / 脉冲 / 转圈 / 彩带 / 呼吸全停,静态层次保留 ---- */
@media (prefers-reduced-motion:reduce){
  .bh-portal::before,.bxh-portal-out::before,.bh-goal::after,
  .bxh-chew-a,.bxh-chew-b,.bxh-gift-pulse,
  .bxh-win .bxh-hamster,.bxh-confetti{animation:none;}
  .bxh-confetti{opacity:.85;}
}
${touchUpliftCss([".bh-mode", ".bh-btn"])}
.bh-mode,.bh-btn{min-height:44px;}
${bodyFontUpliftCss([".bh-tag", ".bh-tip"])}
`;
}
