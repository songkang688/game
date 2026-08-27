/**
 * 进关时把「别人滚过的位置」还原成 0（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 选关地图上按「🎯 跳到当前关」会 `scrollIntoView` 把当前节点滚进视区，
 * 点节点时浏览器自带的聚焦滚动也会做同一件事——两条路都会给 `.game-stage`
 * 留下一个非 0 的 `scrollTop`。紧接着进关，**这个位移没有任何东西会还原它**，
 * 而 `.game-stage` 是定高 + `overflow:hidden`（平台文件，交窗口1），
 * 于是关内 UI 顶部被硬裁掉一截，用户也没有任何手势能滚回去。
 *
 * 本款上被裁掉的是 `🗺️ 选关`（退不回地图）；矮到 320×640 时 `📖 攻略` 与
 * `⏭️ 跳过` 也一起挂掉。测试员 W5-B-09（严重）。真机复量：320×640 第 188 关
 * `scrollTop=87`，`🗺️ 选关` 的中心点落到 y=37，`elementFromPoint` 拿回
 * `HEADER.game-topbar`；360×640 第 188 关 `scrollTop=60`，同样一颗挂在 y=64。
 *
 * 修法只有一行的分量：进关那一刻，地图已经换成关卡界面，那个位移在这一刻
 * **已经没有任何意义**，归 0 就是了。只动 `scrollTop` / `scrollLeft`，
 * 不改任何人的样式、不改任何人的 DOM，一行平台文件都没碰。
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
