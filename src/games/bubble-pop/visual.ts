// 泡泡噗噗 · 1.3 视觉升级(第 19 步 B 档)纯视觉模块。
//
// 只管「怎么画」:token / 时序 / 皮肤 / 纹样 / 样式表,全是纯字符串与纯函数;
// 同色连消判定、塌陷时序、盘面数据一个字不碰(那些住在 logic.ts / collapse.ts)。
// 皮肤渐变与 A 档 balloon-pop 同源(src/art/kit/bubbleSkin.ts),三款观感一族。
import { BUBBLE_INNER_ARC, bubbleHighlight, bubbleSkin } from "../../art/kit/bubbleSkin";
import { CHAIN } from "./collapse";
import { BOLT, CHAMELEON_BASE, FROZEN_OFFSET, RAINBOW, STONE, isChameleon, isFrozen, isHidden } from "./logic";

// ---------------------------------------------------------------------------
// 基色与降级
// ---------------------------------------------------------------------------

/** 五色普通泡泡基色(沿用 1.2 的圆环色;双通道图案也沿用) */
export const BP_BASE = ["#FF9EC8", "#8FCBFF", "#9FE08D", "#FFD26E", "#C9A0F0"] as const;
export const BP_MARKS = ["●", "▲", "■", "★", "♥"] as const;

/** 特殊泡基色(取 1.2 各自渐变的深色端,观感不跳) */
export const BP_SPECIAL_BASE = {
  chain: "#FFA45C",
  stone: "#A8A296",
  bolt: "#FFD84D",
  hidden: "#4A4560",
} as const;

/** 彩虹泡的 conic 五色圈(保留 1.2 的顺序) */
export const BP_RAINBOW_CONIC = "conic-gradient(#FF9EC8, #FFD26E, #9FE08D, #8FCBFF, #C9A0F0, #FF9EC8)";

/** 动效时序表(四·补二):CSS 里写成自定义属性,测试盯这份常量 */
export const BP_TIMINGS = {
  /** 破裂第一阶段:鼓到 1.12 倍 */
  swellMs: 50,
  /** 破裂第二阶段:薄膜白环扩散 */
  ringMs: 120,
  /** 破裂第三阶段:水珠 4 滴溅落渐隐 */
  dropMs: 240,
  /** 连消波次:每波延迟 */
  waveStepMs: 40,
  /** 连消波次上限(低端机不掉帧) */
  waveMax: 6,
  /** 同波内随机抖动上限(只作用于展示) */
  waveJitterMs: 12,
  /** 彩虹泡旋转一圈 */
  rainbowSpinMs: 3000,
  /** 补位果冻落定 scaleY .92 → 1 */
  jellyMs: 90,
  /** 装饰气泡缓升一轮 */
  decorFloatMs: 8000,
  /** 连消数字跳动 */
  comboMs: 120,
} as const;

/** 冰冻圈 / 变色圈:1.2 的色觉双通道,颜色宽度原样保留 */
export const BP_FROZEN_RING = "inset 0 0 0 3px #9FD6FF";
export const BP_CHAMELEON_RING = "inset 0 0 0 3px #7FCF95";
/** 铁泡(石头)的浅色圈 */
export const BP_STONE_RING = "inset 0 0 0 2px rgba(255,255,255,.4)";

/** 泡径小于 32px 就挂 bp-tiny:副高光 / 铆钉这类点缀省略,纹样保留 */
export const BP_TINY_PX = 32;
export function bpIsTiny(cellPx: number): boolean {
  return cellPx > 0 && cellPx < BP_TINY_PX;
}

// ---------------------------------------------------------------------------
// 特殊泡本体纹样(SVG 程序化绘制,不再 emoji 直出;灰度下也一眼可分)
// ---------------------------------------------------------------------------

const SVG_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">`;

/** 彩虹泡中心白星:五角,直径约 40% 泡径(尺寸由 .bp-pat-star 控制) */
export function bpStarSvg(): string {
  return `${SVG_OPEN}<polygon class="bp-star" points="12,2.5 14.6,8.9 21.5,9.4 16.2,13.9 17.9,20.6 12,16.9 6.1,20.6 7.8,13.9 2.5,9.4 9.4,8.9" fill="rgba(255,255,255,.92)"/></svg>`;
}

/** 连锁泡闪电纹:两段折线、白 65%、宽 2(触发连锁时由高亮类点亮一帧) */
export function bpChainZigzagSvg(): string {
  return `${SVG_OPEN}<polyline class="bp-zigzag" points="9.5,4 14.5,11.5 9.5,12.5 14.5,20" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** 铁泡铆钉两点(点缀,bp-tiny 时省略;金属纵纹在 background 里,纹样保留) */
export function bpStoneRivetsSvg(): string {
  return `${SVG_OPEN}<circle class="bp-rivet" cx="8" cy="9" r="1.6" fill="rgba(255,255,255,.75)"/><circle class="bp-rivet" cx="16" cy="15" r="1.6" fill="rgba(255,255,255,.75)"/></svg>`;
}

/** 闪电泡:实心白闪电(和连锁泡的细折线区分开) */
export function bpBoltSvg(): string {
  return `${SVG_OPEN}<polygon class="bp-boltfill" points="13.5,3 6.5,13.5 11,13.5 9.5,21 17.5,10.5 12.8,10.5" fill="rgba(255,255,255,.9)"/></svg>`;
}

/** 冰冻泡:六臂冰晶纹(冰圈之外的第二识别通道) */
export function bpFrostSvg(): string {
  return `${SVG_OPEN}<g class="bp-frost" stroke="rgba(255,255,255,.85)" stroke-width="1.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5.9" y1="8.5" x2="18.1" y2="15.5"/><line x1="5.9" y1="15.5" x2="18.1" y2="8.5"/></g></svg>`;
}

/** 隐藏泡:小灯笼剪影(白 45%),「先点亮再消」的语义 */
export function bpLanternSvg(): string {
  return `${SVG_OPEN}<g class="bp-lantern" fill="rgba(255,255,255,.45)"><rect x="10" y="4" width="4" height="2" rx="1"/><ellipse cx="12" cy="12" rx="5" ry="6"/><rect x="10" y="18" width="4" height="2.4" rx="1"/></g></svg>`;
}

/** 变色泡:循环箭头(「每步换一种颜色」的语义) */
export function bpCycleSvg(): string {
  return `${SVG_OPEN}<g class="bp-cycle" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 12a6 6 0 1 1-2.2-4.6"/><polyline points="18.6,4.6 18.6,8 15.2,8"/></g></svg>`;
}

// ---------------------------------------------------------------------------
// 每颗泡泡的皮肤参数(纯函数,盘面数据只读)
// ---------------------------------------------------------------------------

export interface BpCellSkin {
  background: string;
  boxShadow: string;
  /** 本体差异纹样(SVG 字符串,空串 = 无纹样) */
  pattern: string;
  /** 纹样容器的附加类(控制尺寸) */
  patternClass: string;
  /** 双通道图案字符(普通色泡的 ●▲■★♥) */
  mark: string;
  /** 是不是彩虹泡(要挂旋转类) */
  rainbow: boolean;
}

const EMPTY_SKIN: BpCellSkin = { background: "", boxShadow: "", pattern: "", patternClass: "", mark: "", rainbow: false };

/** 沿用 1.2 的柔和外投影强度(基色 + 40% 透明) */
function drop(color: string): string {
  return `0 2px 5px ${color}66`;
}

/** 给定格子值,算出这颗泡泡的全部视觉参数;盘面上不许存在平涂泡 */
export function bpCellSkin(v: number): BpCellSkin {
  if (v < 0) return EMPTY_SKIN;
  if (v === RAINBOW) {
    return {
      background: BP_RAINBOW_CONIC,
      boxShadow: `${BUBBLE_INNER_ARC}, 0 2px 8px rgba(150,120,220,.5)`,
      pattern: bpStarSvg(),
      patternClass: "bp-pat-star",
      mark: "",
      rainbow: true,
    };
  }
  if (v === CHAIN) {
    const s = bubbleSkin(BP_SPECIAL_BASE.chain);
    return {
      background: s.background,
      boxShadow: `${s.boxShadow}, 0 2px 8px rgba(230,140,60,.5)`,
      pattern: bpChainZigzagSvg(),
      patternClass: "",
      mark: "",
      rainbow: false,
    };
  }
  if (v === STONE) {
    // 铁泡:主高光 + 金属纵纹(3px 条) + 主体明暗,圈保留
    return {
      background: `${bubbleHighlight()}, repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 3px, rgba(70,64,58,.18) 3px 6px), radial-gradient(circle at 50% 46%, #C6C1B4, #8F897D 94%)`,
      boxShadow: `${BP_STONE_RING}, ${BUBBLE_INNER_ARC}, 0 2px 5px rgba(120,110,100,.4)`,
      pattern: bpStoneRivetsSvg(),
      patternClass: "",
      mark: "",
      rainbow: false,
    };
  }
  if (v === BOLT) {
    const s = bubbleSkin(BP_SPECIAL_BASE.bolt);
    return {
      background: s.background,
      boxShadow: `${s.boxShadow}, 0 2px 8px rgba(230,180,40,.5)`,
      pattern: bpBoltSvg(),
      patternClass: "",
      mark: "",
      rainbow: false,
    };
  }
  if (isFrozen(v)) {
    const s = bubbleSkin(BP_BASE[v - FROZEN_OFFSET] ?? BP_BASE[0]);
    return {
      background: s.background,
      boxShadow: `${BP_FROZEN_RING}, ${s.boxShadow}, 0 2px 5px rgba(120,180,230,.4)`,
      pattern: bpFrostSvg(),
      patternClass: "",
      mark: "",
      rainbow: false,
    };
  }
  if (isHidden(v)) {
    const s = bubbleSkin(BP_SPECIAL_BASE.hidden);
    return {
      background: s.background,
      boxShadow: `${s.boxShadow}, 0 2px 6px rgba(60,50,80,.5)`,
      pattern: bpLanternSvg(),
      patternClass: "",
      mark: "",
      rainbow: false,
    };
  }
  if (isChameleon(v)) {
    const base = BP_BASE[v - CHAMELEON_BASE] ?? BP_BASE[0];
    const s = bubbleSkin(base);
    return {
      background: s.background,
      boxShadow: `${BP_CHAMELEON_RING}, ${s.boxShadow}, ${drop(base)}`,
      pattern: bpCycleSvg(),
      patternClass: "",
      mark: "",
      rainbow: false,
    };
  }
  const base = BP_BASE[v] ?? BP_BASE[0];
  const s = bubbleSkin(base);
  return {
    background: s.background,
    boxShadow: `${s.boxShadow}, ${drop(base)}`,
    pattern: "",
    patternClass: "",
    mark: BP_MARKS[v] ?? BP_MARKS[0],
    rainbow: false,
  };
}

// ---------------------------------------------------------------------------
// 视觉样式表(体积层)
// ---------------------------------------------------------------------------

/** 追加在 1.2 布局样式之后的视觉升级样式(体积 / 纹样 / 旋转 / 降级) */
export function bpVisualCss(): string {
  const t = BP_TIMINGS;
  return `
.bp-wrap { --bp-spin-ms:${t.rainbowSpinMs}ms; }
.bp-cell { position: relative; }
.bp-cell::before { content: ""; position: absolute; left: 18%; top: 18%; width: 22%; height: 12%; border-radius: 50%; background: rgba(255,255,255,.45); transform: rotate(-24deg); pointer-events: none; z-index: 1; }
.bp-cell.bp-empty::before, .bp-tiny .bp-cell::before, .bp-cell.bp-rainbow::before { content: none; }
.bbp-mark { position: relative; z-index: 1; }
.bp-pat { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1; }
.bp-pat svg { width: 52%; height: 52%; display: block; }
.bp-pat.bp-pat-star svg { width: 40%; height: 40%; }
.bp-tiny .bp-rivet { display: none; }
.bp-cell.bp-rainbow { overflow: hidden; }
.bp-rainbow::after { content: ""; position: absolute; inset: -22%; border-radius: 50%; background: ${BP_RAINBOW_CONIC}; animation: bpSpinRot var(--bp-spin-ms) linear infinite; z-index: 0; }
@keyframes bpSpinRot { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .bp-rainbow::after { animation: none; }
}
`;
}
