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
      pattern: "",
      patternClass: "",
      mark: "🌈",
      rainbow: true,
    };
  }
  if (v === CHAIN) {
    const s = bubbleSkin(BP_SPECIAL_BASE.chain);
    return {
      background: s.background,
      boxShadow: `${s.boxShadow}, 0 2px 8px rgba(230,140,60,.5)`,
      pattern: "",
      patternClass: "",
      mark: "🎇",
      rainbow: false,
    };
  }
  if (v === STONE) {
    // 铁泡:主高光 + 金属纵纹(3px 条) + 主体明暗,圈保留
    return {
      background: `${bubbleHighlight()}, repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 3px, rgba(70,64,58,.18) 3px 6px), radial-gradient(circle at 50% 46%, #C6C1B4, #8F897D 94%)`,
      boxShadow: `${BP_STONE_RING}, ${BUBBLE_INNER_ARC}, 0 2px 5px rgba(120,110,100,.4)`,
      pattern: "",
      patternClass: "",
      mark: "🪨",
      rainbow: false,
    };
  }
  if (v === BOLT) {
    const s = bubbleSkin(BP_SPECIAL_BASE.bolt);
    return {
      background: s.background,
      boxShadow: `${s.boxShadow}, 0 2px 8px rgba(230,180,40,.5)`,
      pattern: "",
      patternClass: "",
      mark: "⚡",
      rainbow: false,
    };
  }
  if (isFrozen(v)) {
    const s = bubbleSkin(BP_BASE[v - FROZEN_OFFSET] ?? BP_BASE[0]);
    return {
      background: s.background,
      boxShadow: `${BP_FROZEN_RING}, ${s.boxShadow}, 0 2px 5px rgba(120,180,230,.4)`,
      pattern: "",
      patternClass: "",
      mark: "🧊",
      rainbow: false,
    };
  }
  if (isHidden(v)) {
    const s = bubbleSkin(BP_SPECIAL_BASE.hidden);
    return {
      background: s.background,
      boxShadow: `${s.boxShadow}, 0 2px 6px rgba(60,50,80,.5)`,
      pattern: "",
      patternClass: "",
      mark: "🏮",
      rainbow: false,
    };
  }
  if (isChameleon(v)) {
    const base = BP_BASE[v - CHAMELEON_BASE] ?? BP_BASE[0];
    const s = bubbleSkin(base);
    return {
      background: s.background,
      boxShadow: `${BP_CHAMELEON_RING}, ${s.boxShadow}, ${drop(base)}`,
      pattern: "",
      patternClass: "",
      mark: "🦎",
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

/** 追加在 1.2 布局样式之后的视觉升级样式(体积 / 降级) */
export function bpVisualCss(): string {
  return `
.bp-cell { position: relative; }
.bp-cell::before { content: ""; position: absolute; left: 18%; top: 18%; width: 22%; height: 12%; border-radius: 50%; background: rgba(255,255,255,.45); transform: rotate(-24deg); pointer-events: none; z-index: 1; }
.bp-cell.bp-empty::before, .bp-tiny .bp-cell::before, .bp-cell.bp-rainbow::before { content: none; }
.bbp-mark { position: relative; z-index: 1; }
`;
}
