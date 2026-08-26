import { meta } from "./meta";
export { meta };

import type { GameApi } from "../level99";

/** 开工占位:玩法在后续提交里补齐,先保证首页与构建不被半成品拖垮。 */
export function mount(api: GameApi): { destroy: () => void } {
  const box = document.createElement("div");
  box.style.cssText = "padding:24px;text-align:center;font-weight:800;color:#7a5da8;";
  box.textContent = "小怪物危机正在搭建中,马上就能开打啦!";
  api.root.appendChild(box);
  return { destroy: () => box.remove() };
}
