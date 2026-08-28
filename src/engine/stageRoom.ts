/**
 * 量「这一屏还剩多少地方给玩法」。
 *
 * 手机竖屏上壳层顶栏 + 188 关抬头会吃掉一大截，游戏如果按 `innerHeight - 300`
 * 这种猜的数去排画布，就会把球桌 / 果盆画出舞台，而 `.game-stage` 以前还
 * `overflow:hidden`，划也划不回来。这里只认真正裁人的那一层。
 */

export interface StageRoom {
  w: number;
  h: number;
}

function classOf(node: { className?: unknown } | null): string {
  if (!node) return "";
  const raw = node.className;
  return typeof raw === "string" ? raw : "";
}

function closestClass(start: HTMLElement, token: string): HTMLElement | null {
  let n: HTMLElement | null = start;
  while (n) {
    if (classOf(n).split(/\s+/).includes(token)) return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * 从宿主往上找 `.game-stage`，减去 `.l99-stagebar` 的高度，得到画布可用宽高。
 * 量不到（单测桩、还没挂上壳）就退回 fallback，永不抛、永不返回非正数。
 */
export function stagePlayRoom(
  host: HTMLElement | null | undefined,
  fallback: StageRoom = { w: 360, h: 420 }
): StageRoom {
  const fw = Number.isFinite(fallback.w) && fallback.w > 0 ? fallback.w : 360;
  const fh = Number.isFinite(fallback.h) && fallback.h > 0 ? fallback.h : 420;
  if (!host) return { w: fw, h: fh };

  const stage = closestClass(host, "game-stage");
  const wrap = closestClass(host, "l99-stage-wrap");
  const bar = wrap?.querySelector?.(".l99-stagebar") as HTMLElement | null;
  const hostW = host.clientWidth;
  const stageW = stage?.clientWidth ?? 0;
  const w = hostW > 0 ? hostW : stageW > 0 ? stageW : fw;

  const stageH = stage?.clientHeight ?? 0;
  const barH = bar && typeof bar.offsetHeight === "number" ? Math.max(0, bar.offsetHeight) : 0;
  // 舞台上下白边 4px×2，再留一点给内边距，避免画布贴死圆角
  const chrome = 16;
  const h = stageH > 0 ? stageH - barH - chrome : fh;
  return {
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h))
  };
}
