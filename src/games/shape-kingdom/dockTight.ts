/**
 * 常驻控件摞占掉太多地方时，把它收薄一档（1.2 窗口5 · 第 3 轮 · 档B，W5R3-B-01）。
 *
 * `.shk-dock` 钉在作图台底边常驻，是第 2 轮为了「交卷键永远够得着」修的（W5-B-10）。
 * 那一修没错，但它有个副作用在 320 宽的旧手机上撞了出来：钉住的那一摞会**盖住图形**。
 *
 * 真机实测 320×568 第 117 关（面积 6 的长方形）：作图台可视段 332px，`.shk-dock` 一块
 * 就 174px（`.shk-tools` 那三颗键在 256px 宽里排不下，折成两行占了 96px），
 * 于是图形只剩 158px 的窗口，而点阵本身高 201px——**任何一个滚动位置都看不全整张点阵**。
 * 逐档量下来：滚到顶 7/35 颗够得着，滚到底 28/35，每一档都有一片被 `.shk-readout` 压着。
 * 画长方形要先点一个角、再点对角，两颗点分处上下两端时得中途滚一次屏，
 * 五六岁的孩子画到一半屏一动，手上那个角就找不回来了。
 *
 * 修法不是把 dock 拆掉（那等于把 W5-B-10 退回去），而是**按量收薄**：
 * 只有在「图形高 > 可视段 − dock 高」时才挂 `TIGHT_DOCK_CLASS`，
 * 收的全是留白与字号（行距、按钮左右内边距、按钮字号），
 * **热区一个都不动**——`.shk-btn` 的 `min-height:44px` 在收薄档里原样重申了一遍。
 * 装得下的题（高屏、字少的题）一个像素都不变。
 */

/** 收薄档的记号，挂在 `.shk-draw` 宿主上，CSS 认它 */
export const TIGHT_DOCK_CLASS = "shk-dock-tight";

/**
 * 要不要收薄：钉住的那一摞把图形挤得看不全，就要。
 *
 * `viewportH` 是作图台**看得见**的那一段（`clientHeight`，已经被 `fitIntoStage` 钳过），
 * `boardH` 是图形自己的高，`dockH` 是常驻那一摞的高。
 * 图形能整张塞进「可视段减去 dock」剩下的窗口里就不收——留白是给孩子看的，能留就留。
 * 量不出数（测试桩 / 还没进 DOM）一律当不收，绝不凭空改样式。
 */
export function needsTightDock(viewportH: number, boardH: number, dockH: number): boolean {
  const nums = [viewportH, boardH, dockH];
  if (!nums.every((n) => Number.isFinite(n) && n > 0)) return false;
  return boardH > viewportH - dockH;
}

interface TightHosts {
  wrap: HTMLElement;
  board: HTMLElement | null;
  dock: HTMLElement | null;
}

function hosts(wrap: HTMLElement): TightHosts {
  const pick = (sel: string): HTMLElement | null =>
    typeof wrap.querySelector === "function" ? (wrap.querySelector(sel) as HTMLElement | null) : null;
  return { wrap, board: pick(".shk-board"), dock: pick(".shk-dock") };
}

function heightOf(el: HTMLElement | null): number {
  if (!el || typeof el.getBoundingClientRect !== "function") return 0;
  return el.getBoundingClientRect().height;
}

/**
 * 量一次、决定挂不挂记号。返回这一次是不是收薄档（用例靠它判）。
 *
 * 先把上一次的记号摘掉再量：带着收薄档量出来的 dock 是收完的高度，
 * 那样一旦收薄就再也退不回去（和 `fitIntoStage` 先清 `maxHeight` 是同一个道理）。
 */
export function applyTightDock(wrap: HTMLElement | null): boolean {
  if (!wrap) return false;
  const list = (wrap as { classList?: DOMTokenList }).classList;
  if (!list) return false;
  list.remove(TIGHT_DOCK_CLASS);
  const { board, dock } = hosts(wrap);
  const viewportH = typeof wrap.clientHeight === "number" ? wrap.clientHeight : 0;
  const tight = needsTightDock(viewportH, heightOf(board), heightOf(dock));
  if (tight) list.add(TIGHT_DOCK_CLASS);
  return tight;
}

/**
 * 收薄档的样式。挂在宿主上，作用范围仅限本款自己的选择器。
 *
 * `.shk-tools` 改成 `nowrap`：那三颗键折行才是 96px 的由来，一行排下就是 44px。
 * 排得下靠的是把左右内边距 18→8、字号 15→13 收掉（竖直方向一动不动，`min-height:44px`
 * 在这里重申一遍，免得以后有人改基线规则时顺手把它带走）。
 * 三颗键最宽的一档（「💡 提示 3/3」「🧹 重来」「✅ 我摆好了」）真机量到 235px，
 * 320 宽机上作图台内容宽 256px，还留着 21px 余量。
 */
export const TIGHT_DOCK_CSS = `
.${TIGHT_DOCK_CLASS} .shk-dock{gap:4px;}
.${TIGHT_DOCK_CLASS} .shk-tools{flex-wrap:nowrap;gap:6px;}
.${TIGHT_DOCK_CLASS} .shk-btn{padding:9px 8px;font-size:13px;min-height:44px;white-space:nowrap;}
.${TIGHT_DOCK_CLASS} .shk-readout{font-size:13px;line-height:1.35;min-height:16px;}
.${TIGHT_DOCK_CLASS} .shk-msg{font-size:14px;min-height:16px;}
.${TIGHT_DOCK_CLASS} .shk-hint{font-size:13px;line-height:1.45;padding:4px 8px;}
`;
