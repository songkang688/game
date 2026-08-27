/**
 * 进关时把「别人滚过的位置」还原成 0（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FBS-03）。
 *
 * 学习优化员的 `W5R2-LB-03` 给三款接了这套复位（`fishing-star` / `red-blue-tap` / `math-farm`），
 * 本款和 `shape-kingdom` 没接。竖屏四档复量下来这两款 `scrollTop` 确实都是 0——
 * **但那是碰巧，不是修好了**：竖屏上舞台看得见五六百像素，聚焦滚动推不动多少。
 *
 * 横过来拿就见分晓。真机 CDP 实测（第 140 关，🎯 与直接点节点两条路都一样）：
 *
 * ```
 * 视口       进关后 .game-stage.scrollTop  「🗺️ 选关」中心   elementFromPoint
 * 640×360   131                         y=15            SPAN.btn-back-label（壳顶栏）
 * 720×360   131                         y=15            SPAN.btn-back-label
 * 844×390   101                         y=45            BUTTON.btn.btn--back
 * ```
 *
 * 被顶到裁切线以上的那一排里有「🗺️ 选关」——**关内唯一的退出口**，
 * 而舞台是定高 + `overflow:hidden`（平台文件，交窗口1），用户没有任何手势能滚回去。
 *
 * 修法和另外三款一字不差：进关那一刻，地图已经换成关卡界面，那个位移在这一刻
 * 已经没有任何意义，归 0 就是了。只动 `scrollTop` / `scrollLeft`，
 * 不改任何人的样式、不改任何人的 DOM，一行平台文件都没碰。
 *
 * （和 `red-blue-tap/stageScroll.ts` 是同一份，两款各存一份是有意的：
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
