import { meta } from "./meta";
export { meta };

// 朵朵抢地主 —— 开工占位:玩法代码随后补上,先保证目录 meta.ts + index.ts 成对、首页不报错。
type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

export function mount(api: GameApi): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.textContent = "牌桌正在摆开,马上就好!";
  api.root.appendChild(wrap);
  return {
    destroy() {
      wrap.remove();
    },
  };
}
