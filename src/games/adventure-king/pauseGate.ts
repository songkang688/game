/**
 * 外壳暂停面板的接线板。
 *
 * `src/ui/gameShell.ts` 上有一颗 ⏸ 按钮，Esc 没被游戏接住时也会弹出同一张
 * 「先歇一会儿」面板。弹之前它会调游戏的 `pause()`、关掉时调 `resume()`——
 * 游戏不接这一对，面板就只是挡在屏幕前面，后面该跑的照跑：
 * 计时继续走、敌人继续动，孩子一边看着「暂停」一边把这一关输掉。
 *
 * 这一款的闯关、无尽、对战各是一个独立的屏，各有各的循环，
 * `mount()` 并不知道孩子当下在哪一个。所以每个屏开场时把自己的
 * 「停 / 继续」挂到这张接线板上，离场时摘掉；`mount()` 只管把
 * `freezeAll` / `thawAll` 交给外壳。
 */

export interface PauseGate {
  freeze: () => void;
  thaw: () => void;
}

const LIVE = new Set<PauseGate>();

/** 开一个屏就挂一条，返回「摘掉」的函数交给该屏的 destroy */
export function registerGate(gate: PauseGate): () => void {
  LIVE.add(gate);
  return () => {
    LIVE.delete(gate);
  };
}

/** 外壳弹面板时调：所有还开着的屏一起停住 */
export function freezeAll(): void {
  for (const gate of [...LIVE]) gate.freeze();
}

/** 关掉面板时调：原样接着玩 */
export function thawAll(): void {
  for (const gate of [...LIVE]) gate.thaw();
}

/** 用例用：现在挂着几个屏（每个屏 destroy 之后必须归零） */
export function liveGates(): number {
  return LIVE.size;
}
