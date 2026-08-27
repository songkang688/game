/**
 * 找不同 · 盘面贴纸映射（W8R1-04 专项第一步，1.3 窗口8 第 2 轮 C 档新增）。
 *
 * 题库（levels.ts / scene12.ts）一个字节不动、SHA-256 快照用例原样：这里只给
 * **渲染层**一张「emoji → kit 贴纸」的查表，paintCell 画格子时现查现换。
 *
 * 按整张盘面门控，绝不出「半贴纸半 emoji」的混排图：
 *  - 一关的上图 / 图② / 下图里出现的每一种 emoji 都有贴纸 → 整关换贴纸；
 *  - 差一张都算没配齐 → 整关保持 1.2 的 emoji 直出，视觉与判定都与旧版一致。
 * 双胞胎替换（LOOKALIKE）换出来的图案本来就在盘面里，所以按盘面收集天然覆盖。
 *
 * 无障碍：贴纸一律 aria-hidden，原 emoji 收进 sr-only（读屏念的一字不差）；
 * 可点的格子自己的「第 x 行第 y 个」标签不受影响。
 *
 * 红线：不碰 diffIdx / sameCell 判定、不碰 26px 热区、不开计时器、不加动画。
 * 第 1–3 章（水果 / 萌宠 / 海底）本轮已配齐图集；第 4–10 章贴纸挂第 3 轮，
 * 配齐一章亮一章，这个文件一行都不用再改。
 */
import { hasSticker, sticker } from "../../art/kit/stickers";
import type { CellView, Scene } from "./scene12";

/** 贴纸相对字号的补偿：贴纸画布带留白（软投影 / 描边），放大一点才与 emoji 等大 */
export const STICKER_FONT_RATIO = 1.12;

/** 盘面贴纸的专属样式：只新增自己的类，绝不碰 .fdf-cell / .fdf-glyph 的几何 */
export const BOARD_ART_CSS = `
.fdf-glyph-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0;}
.fdf-glyph svg{display:block;}
`;

/** 这一关盘面上出现的每一种图案是不是都有贴纸（整关门控） */
export function sceneStickersReady(scene: Pick<Scene, "left" | "second" | "right">): boolean {
  const all: ReadonlyArray<readonly CellView[]> = [scene.left, scene.second ?? [], scene.right];
  for (const cells of all) {
    for (const c of cells) {
      if (!hasSticker(c.emoji)) return false;
    }
  }
  return true;
}

/**
 * 一枚盘面图案的 HTML（贴纸档）。`style` 是 paintCell 算好的字号 + 位移/缩放/翻转
 * transform，贴纸与 emoji 走同一份 transform——「挪位置 / 变大小 / 换朝向」的差异
 * 照样成立。个别图案查不到贴纸时兜底回 1.2 的原样写法，绝不空格子。
 */
export function glyphHTML(emoji: string, fontPx: number, style: string): string {
  const svg = sticker(emoji, Math.round(fontPx * STICKER_FONT_RATIO));
  if (!svg) return `<span class="fdf-glyph" style="${style}">${emoji}</span>`;
  return (
    `<span class="fdf-glyph-sr">${emoji}</span>` +
    `<span class="fdf-glyph" aria-hidden="true" style="${style}">${svg}</span>`
  );
}
