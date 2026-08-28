/**
 * 红蓝点点 · 闯关「点点」的贴纸脸（W8R2-01，1.3 窗口8 第 2 轮 C 档新增）。
 *
 * 闯关模式唯一的操作对象 `.rbt-dot` 在 1.2 时代是裸 emoji 直出（10 章 SKINS 的
 * mine/trap + 道具点 ❄️🧲）。这里只做渲染层换装：
 *  - 查得到贴纸 → 原 emoji 收进 sr-only（读屏念的一字不差），可见层摆 aria-hidden
 *    的 kit 贴纸 SVG；
 *  - 查不到 → 保持原样直出，永不抛错、永不拖垮玩法。
 *
 * 红线：`.rbt-dot` 62/56px 的热区、`makeDot` 的判定（读 `d.kind`）、号码标
 * `.rbt-dot-num` 与 aria-label 一个都不碰；本文件不开计时器、不加动画。
 */
import { hasSticker, sticker } from "../../art/kit/stickers";

/** 贴纸脸的专属样式：只新增自己的类，绝不出现 .rbt-dot 的宽高 */
export const DOT_ART_CSS = `
.rbt-dot-srglyph { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.rbt-dot-face { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; line-height: 0; }
.rbt-dot-face svg { width: 40px; height: 40px; display: block; }
@media (max-width: 420px) {
  .rbt-dot-face svg { width: 36px; height: 36px; }
}
`;

/**
 * 给一颗点点装脸。返回值 = 是否换上了贴纸（false 表示走了 emoji 兜底，
 * 调用方不需要区分，仅供用例断言覆盖率）。
 */
export function dotFace(el: HTMLElement, glyph: string): boolean {
  if (!hasSticker(glyph)) {
    el.textContent = glyph;
    return false;
  }
  const doc = el.ownerDocument;
  el.textContent = "";
  const sr = doc.createElement("span");
  sr.className = "rbt-dot-srglyph";
  sr.textContent = glyph;
  const face = doc.createElement("span");
  face.className = "rbt-dot-face";
  face.setAttribute("aria-hidden", "true");
  face.innerHTML = sticker(glyph, 40) ?? "";
  el.append(sr, face);
  return true;
}
