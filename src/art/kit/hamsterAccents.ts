// 共享美术套件 · 仓鼠特征强化层(1.3 视觉升级 · 窗口 6 第 28 步 C 档落的文件)。
//
// W6R2-01 修复:A 档 16px 灰度实测里,双鼠正面(facing 2)3.5% 可分,
// 但侧/背朝向只有 1.2–2.0%(facing0 2.7% / facing1 2.0% / facing3 1.2%),
// 低于 3% 线——原头饰(小花无描边 / 呆毛细线)在 16px 下几乎化没了。
// kit 纪律是「只增不改」,hamsterSvg.ts 一个字不动——这里按 moleAccents 先例
// 做两组**头冠强化层**,由 box-hamster 的 visual.ts 在拼 SVG 字符串时注入:
//  - A 鼠(小花):花冠放大 + 每瓣墨描边 + 花芯描边,伸出头顶剪影之外;
//  - B 鼠(呆毛):双卷呆毛加粗成「墨底 + 色芯」双笔道,卷得更高更开,
//    剪影(细高的卷须)与花冠(圆实的团块)一眼分得开。
// 注入位置在 `</g></svg>` 之前(bhh-figure 组内),推箱前倾时头冠跟着身体转。
// 全部是纯字符串函数,零运行时依赖、零位图、不碰 DOM,不做任何判定。
//
// 描边宽度分级约定(W6R1-13:老 kit 文件冻结,先在本新文件立约,
// 解冻后再补进老文件注释;按**渲染尺寸**取档,不按画布视窗):
//  - 64px 渲染的常驻小件:1.2–1.5px;
//  - 128px 渲染的特写大件:2–3.5px;
//  - 16px 下必须认得出的关键差异件:≥2px(本文件呆毛墨底 4.2px、
//    背纹 3.2–5.6px 即此档——缩到 16px 后仍占得住一个像素)。

import { shade } from "./palette";
import type { HamsterFacing } from "./hamsterSvg";

/**
 * 各朝向头饰锚点。与 hamsterSvg.ts FACING_SPECS 里的 topper 同数——
 * 冻结文件不改,这里自带一份(moleAccents 自带 starPoints 的同款做法)。
 */
export const HAMSTER_TOPPER_ANCHOR: Record<HamsterFacing, readonly [number, number]> = {
  0: [32, 10],
  1: [33.5, 11.5],
  2: [32, 10.5],
  3: [30.5, 11.5],
};

/**
 * 各朝向头冠下潜量:背影(facing0)的头顶弧比锚点低得多(体路径顶 ≈23),
 * 头冠按锚点画会悬空,下潜 4.5 让它贴着双耳之间的头顶;其余朝向不动。
 */
export const CREST_DROP: Record<HamsterFacing, number> = { 0: 4.5, 1: 0, 2: 0, 3: 0 };

/** 花冠花瓣半径(原 1.9 → 3.0,16px 下一瓣能占住一个像素) */
export const FLOWER_CREST_PETAL_R = 3.0;
/** 花冠花瓣轨道半径(原 3.4 → 5.0,整朵直径约 16,伸出头顶) */
export const FLOWER_CREST_ORBIT = 5.0;
/** 呆毛双笔道:墨底宽 / 色芯宽(原单笔 1.7) */
export const COWLICK_CREST_INK_W = 4.2;
export const COWLICK_CREST_CORE_W = 2.0;

const F = (v: number): string => (Math.round(v * 10) / 10).toString();

/**
 * A 鼠花冠强化层:放大的五瓣花 + 每瓣墨描边 + 描边花芯,
 * 中心比原锚点再抬 2.2,整朵伸出头顶剪影之外(16px 下轮廓就不一样)。
 */
export function flowerCrestGroup(facing: HamsterFacing, color: string): string {
  const [ax, ay] = HAMSTER_TOPPER_ANCHOR[facing];
  /** 侧脸把花冠往鼻尖那侧偏 1.5(facing1 鼻朝右 / facing3 鼻朝左),
   *  和往背拱侧甩的呆毛错开落位,16px 暗像素不互相抵消 */
  const x = ax + (facing === 1 ? 1.5 : facing === 3 ? -1.5 : 0);
  const y = ay - 2.2 + CREST_DROP[facing];
  const ink = shade(color, -46);
  let petals = "";
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    petals +=
      `<circle cx="${F(x + Math.cos(a) * FLOWER_CREST_ORBIT)}" ` +
      `cy="${F(y + Math.sin(a) * FLOWER_CREST_ORBIT)}" r="${F(FLOWER_CREST_PETAL_R)}" ` +
      `fill="${color}" stroke="${ink}" stroke-width="1.2"/>`;
  }
  return (
    `<g data-part="flower-crest">` +
    petals +
    `<circle cx="${F(x)}" cy="${F(y)}" r="2.2" fill="#FFE9A8" stroke="${ink}" stroke-width="1.1"/>` +
    `</g>`
  );
}

/**
 * B 鼠呆毛强化层:双卷呆毛「墨底 + 色芯」双笔道,卷须比原来更高更开
 * (最高点抬到锚点上方约 10,左右各甩出约 7),剪影是细高的卷须,
 * 和 A 鼠圆实的花冠团块在 16px 灰度上拉得开。
 * 侧脸朝向卷须往「背拱」那一侧甩(facing1 背在左 / facing3 背在右),
 * 不压到脸,也让两只鼠的暗像素错开落位。
 */
export function cowlickCrestGroup(facing: HamsterFacing, color: string): string {
  const [x, y0] = HAMSTER_TOPPER_ANCHOR[facing];
  const y = y0 + CREST_DROP[facing];
  const ink = shade(color, -44);
  /** facing3 鼻尖朝左、背拱在右:整组卷须水平镜向(数值镜像,不用 transform) */
  const m = facing === 3 ? -1 : 1;
  const d1 = `M${F(x)} ${F(y + 3)} Q${F(x - 2.2 * m)} ${F(y - 6.4)} ${F(x - 7 * m)} ${F(y - 4.8)}`;
  const d2 = `M${F(x + 0.8 * m)} ${F(y + 3)} Q${F(x + 3.4 * m)} ${F(y - 5)} ${F(x + 7 * m)} ${F(y - 3.8)}`;
  const d3 = `M${F(x + 0.2 * m)} ${F(y + 2.4)} Q${F(x + 0.6 * m)} ${F(y - 6.2)} ${F(x - 1.8 * m)} ${F(y - 9.8)}`;
  const pass = (w: number, stroke: string): string =>
    `<g fill="none" stroke="${stroke}" stroke-width="${F(w)}" stroke-linecap="round">` +
    `<path d="${d1}"/><path d="${d2}"/><path d="${d3}"/></g>`;
  return (
    `<g data-part="cowlick-crest">` +
    pass(COWLICK_CREST_INK_W, ink) +
    pass(COWLICK_CREST_CORE_W, color) +
    `</g>`
  );
}

/**
 * B 鼠背纹:仓鼠经典的深色背中线(照着侏儒仓鼠的背纹画)。
 * 背影(facing0)整条脊线,侧脸(facing1/3)沿背拱一小段;
 * 正脸(facing2)从正面看不见,不画——语义自洽。
 * 背影朝向头冠贴头后剪影增量有限,这条背纹是灰度第二通道。
 */
export function dorsalStripeGroup(facing: HamsterFacing, fur: string): string {
  const stripe = shade(fur, -30);
  if (facing === 0) {
    return (
      `<g data-part="dorsal-stripe">` +
      `<path d="M32 23.5 Q32.8 34 32 48.5" fill="none" stroke="${stripe}" ` +
      `stroke-width="5.6" stroke-linecap="round"/>` +
      `</g>`
    );
  }
  if (facing === 1) {
    return (
      `<g data-part="dorsal-stripe">` +
      `<path d="M17.8 36 Q19.2 21.5 30.5 17.6" fill="none" stroke="${stripe}" ` +
      `stroke-width="3.2" stroke-linecap="round"/>` +
      `</g>`
    );
  }
  if (facing === 3) {
    return (
      `<g data-part="dorsal-stripe">` +
      `<path d="M46.2 36 Q44.8 21.5 33.5 17.6" fill="none" stroke="${stripe}" ` +
      `stroke-width="3.2" stroke-linecap="round"/>` +
      `</g>`
    );
  }
  return "";
}

/**
 * 把强化层注入到仓鼠 SVG 的 `</g></svg>` 之前(即 bhh-figure 组内最后),
 * 推箱前倾 / 上下压身的 poseTransform 会带着头冠一起动;
 * 找不到闭标签或没有组就原样返回。
 */
export function injectFigureAccents(svg: string, groups: string[]): string {
  const at = svg.lastIndexOf("</g></svg>");
  if (at < 0 || groups.length === 0) return svg;
  return svg.slice(0, at) + groups.join("") + svg.slice(at);
}
