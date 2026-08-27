/**
 * 识字小花园 1.3 · 奖励花花瓣渐变（W8R1-06，只画不判）。
 *
 * A 档报告：`flowerSvg` 的花瓣是单色平涂（CSS 已有投影与花心高光，独缺
 * 「≥2 停渐变」）。`art/kit/flower.ts` 归 A 档独占、只读，所以在本款消费端
 * 给它的 `<g>` 片段做装饰：塞一个 2 停径向渐变（花心系 userSpaceOnUse，
 * 瓣根深 → 瓣尖亮，光感沿用左上受光的约定），把五片花瓣的平涂 fill 换成
 * 渐变引用。花心、三点蕊、路径几何、帧序一个字节不动。
 */
import { shade } from "../../art/kit/palette";

/** 瓣尖提亮的幅度（palette.shade 的百分比语义） */
export const PETAL_TIP_LIGHT = 14;
/** 瓣根压深的幅度 */
export const PETAL_ROOT_DARK = -16;

export interface FlowerShadeOpts {
  /** 花心位置与全开瓣长（照抄 flowerSvg 的同名参数） */
  cx: number;
  cy: number;
  r: number;
  /** 花瓣平涂色（要替换的那一个 fill） */
  petal: string;
  /** 渐变 id 前缀：同一页多朵花各给各的，别撞 id */
  idPrefix: string;
}

/**
 * `flowerSvg(...)` 的 `<g>` 片段 → 花瓣挂 2 停径向渐变。
 * 找不到平涂 fill（上游改版）就原样返回，绝不画坏。
 */
export function shadeFlower(fragment: string, o: FlowerShadeOpts): string {
  const flat = `fill="${o.petal}"`;
  if (!fragment.includes(flat)) return fragment;
  const id = `${o.idPrefix}-petal`;
  const defs =
    `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse"` +
    ` cx="${o.cx}" cy="${o.cy}" r="${o.r}">` +
    `<stop offset="0.3" stop-color="${shade(o.petal, PETAL_ROOT_DARK)}"/>` +
    `<stop offset="1" stop-color="${shade(o.petal, PETAL_TIP_LIGHT)}"/>` +
    `</radialGradient></defs>`;
  const swapped = fragment.split(flat).join(`fill="url(#${id})"`);
  // defs 塞进 <g ...> 开标签之后，片段依旧是一个完整的 <g>
  return swapped.replace(">", `>${defs}`);
}
