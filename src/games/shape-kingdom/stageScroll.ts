/**
 * 进关时把「别人滚过的位置」还原成 0（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FBS-03）。
 *
 * 学习优化员的 `W5R2-LB-03` 给三款接了这套复位（`fishing-star` / `red-blue-tap` / `math-farm`），
 * 本款和 `music-stars` 没接。竖屏四档复量下来这两款 `scrollTop` 确实都是 0——
 * **但那是碰巧，不是修好了**：竖屏上舞台看得见五六百像素，聚焦滚动推不动多少；
 * 横过来拿舞台一下矮到 264px，`music-stars` 当场就带进来 131px，把关内唯一的退出口
 * 「🗺️ 选关」顶到裁切线以上（见那一款的 `stageScroll.ts`）。
 *
 * 本款这一轮量到的是 0，可它和 `music-stars` 只差在内容高矮上——同一个坑，
 * 差的只是这一关的题够不够高。与其等下一道题把它撞出来，不如把同一行接上。
 * 只动 `scrollTop` / `scrollLeft`，不改任何人的样式、不改任何人的 DOM。
 *
 * （和 `red-blue-tap/stageScroll.ts` 是同一份，各款各存一份是有意的：
 * 抽成共用文件得放到 `src/games/` 根上，那是跨窗口的共用目录，本档不许动。）
 */

/**
 * 把自己以及所有还在滚着的祖先的滚动位移归 0。
 * 已经是 0 的一个都不碰（免得打断正常的滚动惯性）。
 * 返回真的动过的次数，用例靠它判空转。
 */
export function resetClippedScroll(el: HTMLElement | null): number {
  let moved = 0;
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    if (typeof p.scrollTop === "number" && p.scrollTop !== 0) {
      p.scrollTop = 0;
      moved += 1;
    }
    if (typeof p.scrollLeft === "number" && p.scrollLeft !== 0) {
      p.scrollLeft = 0;
      moved += 1;
    }
  }
  return moved;
}
