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
export { stagePlayRoom } from "./stageRoom";
export type { StageRoom } from "./stageRoom";
// 1.2 的两块共享基建也从这里出口:约定是「从 ../../engine 导入」,
// 只放在各自文件里的话,别的窗口按约定拿不到,多半会各造一份
export {
  MODE_KINDS,
  MODE_KIND_LABELS,
  VERSUS_KIND_LABELS,
  assertModeMenu,
  availableModes,
  compatFromMeta,
  describeModes,
  filterModeEntries,
  modeButtonLabel,
  modeEntryKeys,
  pickInitialMode
} from "./playModes";
export type { ModeCompat, ModeEntry, ModeKind, VersusKind } from "./playModes";
export {
  DEFAULT_FOV,
  DEFAULT_HORIZON,
  MAX_SCALE,
  MIN_SCALE,
  REDUCED_MOTION_QUERY,
  defaultCamera,
  focalLength,
  fogAlpha,
  groundGridDepths,
  horizonY,
  installView25dCss,
  prefersReducedMotion,
  project,
  respectReducedMotion,
  roadQuad,
  sanitizeCamera,
  scaleAtDepth
} from "./view25d";
export type { MediaQueryLike, Projected, View25dCamera } from "./view25d";
