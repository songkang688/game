/**
 * 引擎统一出口,游戏子代理从 "../../engine" 导入即可。
 */
export type {
  GameAPI,
  GameCategory,
  GameMeta,
  GameModule,
  SoundName
} from "./types";
export { CATEGORY_LABELS, CATEGORY_ORDER } from "./types";
export { playSound, toggleSound } from "./audio";
export { save, SaveStore, SAVE_KEY } from "./save";
export type { StorageLike, GameProgress, BestStars } from "./save";
export { createLoop, attachCanvas } from "./loop";
export type { LoopController, CanvasHandle } from "./loop";
export { collectGames, loadGames } from "./loader";
