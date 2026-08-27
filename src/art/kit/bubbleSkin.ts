// 共享美术套件 · 泡泡皮肤(1.3 第 19 步 B 档落的文件,与 A 档 balloonSkin 同族规格)。
//
// 整改线的核心:泡泡/气球不能是平涂圆。这里输出三层叠加的立体皮肤:
//   ① 主高光斑  radial-gradient(circle at 30% 24%, 白 80% → 40% 处透明)
//   ② 主体明暗  radial-gradient(circle at 50% 46%, shade(base,+10) → shade(base,-12) 94%)
//   ③ 底部内缘反光弧  inset box-shadow 白 20%(写在返回的样式对象里)
// 纯字符串输出、零 DOM、零依赖;bubble-pop / balloon-pop / bubble-aim 三款共用
// 同一套渐变规格,观感同族。kit 里别人的文件只 import 不修改,新能力落在本文件。

import { shade } from "./palette";

/** 主高光斑圆心(左上 30%, 24%):三款泡泡类游戏共用,别各写各的魔法数 */
export const BUBBLE_HIGHLIGHT_X = "30%";
export const BUBBLE_HIGHLIGHT_Y = "24%";

/** 主体明暗:中心透亮 +10,边缘压暗 -12(shade 百分比) */
export const BUBBLE_LIGHTEN = 10;
export const BUBBLE_DARKEN = -12;

/** 底部内缘反光弧:泡泡下缘一道白 20% 的内阴影,像水面反上来的光 */
export const BUBBLE_INNER_ARC = "inset 0 -2px 4px rgba(255,255,255,.2)";

/** 泡径小于它(px)就省略副高光小月牙,只留主高光(手机小格降级) */
export const BUBBLE_CRESCENT_MIN_PX = 32;

export interface BubbleSkinStyle {
  /** 两层 radial-gradient 叠加:上层主高光斑,下层主体明暗 */
  background: string;
  /** 底部内缘反光弧(调用方可以在后面再叠自己的圈与外阴影) */
  boxShadow: string;
}

/** 主高光斑:左上白 80% → 40% 处透明 */
export function bubbleHighlight(): string {
  return `radial-gradient(circle at ${BUBBLE_HIGHLIGHT_X} ${BUBBLE_HIGHLIGHT_Y}, rgba(255,255,255,.8), transparent 40%)`;
}

/** 主体明暗:中心透亮(+10) → 边缘深(-12,94% 处收边) */
export function bubbleBody(base: string): string {
  return `radial-gradient(circle at 50% 46%, ${shade(base, BUBBLE_LIGHTEN)}, ${shade(base, BUBBLE_DARKEN)} 94%)`;
}

/** 三层叠加的泡泡皮肤:①+② 进 background,③ 进 boxShadow */
export function bubbleSkin(base: string): BubbleSkinStyle {
  return {
    background: `${bubbleHighlight()}, ${bubbleBody(base)}`,
    boxShadow: BUBBLE_INNER_ARC,
  };
}

/** 这颗泡泡要不要画副高光小月牙(泡径 < 32px 省略,只留主高光) */
export function bubbleCrescentVisible(sizePx: number): boolean {
  return sizePx >= BUBBLE_CRESCENT_MIN_PX;
}
