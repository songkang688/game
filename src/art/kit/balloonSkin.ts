// 共享美术套件 · 气球皮肤(balloonSkin):输入主色,输出三层渐变叠加的 background 字符串。
// (1.3 视觉升级 · 窗口 6 第 19 步 A 档落的文件;别的游戏只 import,要新能力另起文件。)
//
// 约定:三层从上到下 ①左上主高光 ②右下弱反光 ③主体明暗(中心亮 +8 → 边缘暗 -12),
// 任何一层都不许退化成纯色平涂;明暗换算统一走 palette 的 shade(),
// 纯字符串、零 DOM、零依赖,DOM 气球 / Canvas 气球都能直接拿去铺 background。

import { shade } from "./palette";

/** 左上主高光圆心(百分比):光从左上来,全库统一 */
export const SKIN_HIGHLIGHT_AT = { x: 28, y: 22 } as const;
/** 右下弱反光圆心(百分比):环境反光,弱一档 */
export const SKIN_REFLECT_AT = { x: 72, y: 78 } as const;
/** 主体明暗圆心(百分比):比几何中心略偏上,球感更足 */
export const SKIN_BODY_AT = { x: 45, y: 40 } as const;
/** 主体中心亮档:shade(base, +8) */
export const SKIN_LIGHTEN = 8;
/** 主体边缘暗档:shade(base, -12) */
export const SKIN_DARKEN = -12;

/**
 * 三层渐变(顶 → 底):
 * ① 左上主高光:白 .85 → 38% 处透明
 * ② 右下弱反光:白 .18 → 30% 处透明
 * ③ 主体明暗:中心 shade(base,+8) → 92% 处 shade(base,-12)
 */
export function balloonSkinLayers(base: string): [string, string, string] {
  return [
    `radial-gradient(circle at ${SKIN_HIGHLIGHT_AT.x}% ${SKIN_HIGHLIGHT_AT.y}%, rgba(255,255,255,.85), rgba(255,255,255,0) 38%)`,
    `radial-gradient(circle at ${SKIN_REFLECT_AT.x}% ${SKIN_REFLECT_AT.y}%, rgba(255,255,255,.18), rgba(255,255,255,0) 30%)`,
    `radial-gradient(circle at ${SKIN_BODY_AT.x}% ${SKIN_BODY_AT.y}%, ${shade(base, SKIN_LIGHTEN)}, ${shade(base, SKIN_DARKEN)} 92%)`,
  ];
}

/** 三层叠加成一条 background 字符串(顶层在前,CSS 语义) */
export function balloonSkin(base: string): string {
  return balloonSkinLayers(base).join(", ");
}

/** 把 background 字符串按「括号外的逗号」拆回图层(测试与调试用) */
export function splitLayers(bg: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of bg) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
