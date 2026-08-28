// 共享美术套件 · 地鼠特征强化层(1.3 视觉升级 · 窗口 6 第 27 步 C 档落的文件)。
//
// W6R1-05 / W6R1-06 修复:A 档 16px 灰度实测里,闪光鼠(星芒 #FFF3B0 过淡)、
// 盾鼠(盾木色 #C89B6C 灰度≈皮毛)与普通鼠 0% 可分,瞌睡鼠 0.8%。
// kit 纪律是「只增不改」,moleSvg.ts 一个字不动——这里做三组**叠加层**,
// 由 mole-pop 的 visual.ts 在拼 SVG 字符串时注入到 `</svg>` 之前:
//  - 闪光鼠:头顶天线星(伸出头部剪影之外,剪影级差异)+ 描边加深的星芒;
//  - 盾鼠:冷灰钢盾面盖在木盾之上(灰度与皮毛拉开)+ 深描边 + 左上高光;
//  - 瞌睡鼠:闭眼弧加粗 + 瞌睡泡加描边,不再靠一颗淡蓝泡说话。
// 全部是纯字符串函数,零运行时依赖、零位图、不碰 DOM,不做任何判定。

import { MOLE_INK } from "./moleSvg";

/** 天线星与强化星芒的实心金(比 #FFF3B0 深两档,16px 灰度咬得住) */
export const FLASH_STAR_FILL = "#F2B705";
/** 强化星芒描边(与地鼠主体同一支墨) */
export const FLASH_STAR_INK = MOLE_INK;
/** 钢盾面主色三停(顶亮 → 主体 → 底暗) */
export const SHIELD_STEEL = { lit: "#DDE3EC", body: "#9FA8B8", dark: "#6E7787" } as const;
/** 钢盾深描边 */
export const SHIELD_STEEL_INK = "#4C5566";
/** 瞌睡泡加深后的填色与描边 */
export const DROWSE_BUBBLE_FILL = "#BFE0FF";
export const DROWSE_BUBBLE_INK = "#5E86B8";

/** 五角小星(与 moleSvg 同一画法,这里自带一份免得改老文件) */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/**
 * 闪光鼠强化层:头顶天线 + 天线星伸出头部剪影之外(16px 下轮廓就不一样),
 * 两侧星芒改实心金 + 墨描边(灰度通道拉开)。坐标基于 64×64 地鼠画布。
 */
export function flashCrestGroup(): string {
  return (
    `<g data-part="flash-crest">` +
    `<path d="M32 17.5v-7" stroke="${FLASH_STAR_INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<polygon points="${starPoints(32, 7.5, 4.8, 1.9)}" fill="${FLASH_STAR_FILL}" stroke="${FLASH_STAR_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<polygon points="${starPoints(13, 20, 4, 1.6)}" fill="${FLASH_STAR_FILL}" stroke="${FLASH_STAR_INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<polygon points="${starPoints(51, 16, 3.2, 1.3)}" fill="${FLASH_STAR_FILL}" stroke="${FLASH_STAR_INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `</g>`
  );
}

/**
 * 钢盾面:三停冷灰(顶亮/主体/底暗)盖在原木盾正上方(同心同径),
 * 深描边 + 双圈 + 中心铆钉 + 左上高光弧。灰度与皮毛(#D9A06B≈中灰)拉开。
 */
export function shieldSteelGroup(): string {
  return (
    `<g data-part="shield-steel">` +
    `<circle cx="32" cy="45" r="11" fill="${SHIELD_STEEL.body}" stroke="${SHIELD_STEEL_INK}" stroke-width="2.2"/>` +
    `<path d="M23.6 41.5a9.4 9.4 0 0 1 8.4-5.9 9.4 9.4 0 0 1 8.4 5.9" fill="none" stroke="${SHIELD_STEEL.lit}" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M24.4 49.5a9.4 9.4 0 0 0 15.2 0" fill="none" stroke="${SHIELD_STEEL.dark}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="32" cy="45" r="6.6" fill="none" stroke="${SHIELD_STEEL_INK}" stroke-width="1.3"/>` +
    `<circle cx="32" cy="45" r="2.7" fill="${SHIELD_STEEL_INK}"/>` +
    `<path d="M25.4 40a8.6 8.6 0 0 1 5-3.4" stroke="rgba(255,255,255,.9)" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
}

/**
 * 瞌睡强化层:闭眼弧加粗盖在原弧上 + 三颗带描边的瞌睡泡
 * (原来那颗 #CFE8FF 的淡泡留在底下当柔光)。
 */
export function drowseBoldGroup(): string {
  return (
    `<g data-part="drowse-bold">` +
    `<path d="M23.4 32.4q2.4 2.2 4.8 0M35.8 32.4q2.4 2.2 4.8 0" ` +
    `stroke="${MOLE_INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="46.5" cy="16.5" r="4.4" fill="${DROWSE_BUBBLE_FILL}" stroke="${DROWSE_BUBBLE_INK}" stroke-width="1.5"/>` +
    `<circle cx="42" cy="22.8" r="2.4" fill="${DROWSE_BUBBLE_FILL}" stroke="${DROWSE_BUBBLE_INK}" stroke-width="1.2"/>` +
    `<circle cx="50.4" cy="10.2" r="1.6" fill="${DROWSE_BUBBLE_FILL}" stroke="${DROWSE_BUBBLE_INK}" stroke-width="1"/>` +
    `</g>`
  );
}

/** 把一组强化层注入到 SVG 字符串的 `</svg>` 之前(找不到闭标签就原样返回) */
export function injectAccents(svg: string, groups: string[]): string {
  const at = svg.lastIndexOf("</svg>");
  if (at < 0 || groups.length === 0) return svg;
  return svg.slice(0, at) + groups.join("") + svg.slice(at);
}
