/**
 * 把 visualViewport 高度写到 --vv-h，给 .game-screen 用。
 * 390 竖屏地址栏伸缩时 100dvh 偶发仍按大视口，会裁掉 .l99-view 底。
 */
export function syncVisualViewportHeight(root: HTMLElement = document.documentElement): void {
  const vv = (globalThis as { visualViewport?: { height?: number } }).visualViewport;
  const fallback = (globalThis as { innerHeight?: number }).innerHeight;
  const h = vv && typeof vv.height === "number" && vv.height > 0 ? vv.height : fallback;
  if (typeof h === "number" && h > 0) root.style.setProperty("--vv-h", `${Math.round(h)}px`);
}

export function bindVisualViewportHeight(): () => void {
  const apply = (): void => syncVisualViewportHeight();
  apply();
  const vv = globalThis.visualViewport;
  window.addEventListener("resize", apply);
  vv?.addEventListener("resize", apply);
  return () => {
    window.removeEventListener("resize", apply);
    vv?.removeEventListener("resize", apply);
  };
}
