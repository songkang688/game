import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, CHAPTER_THEMES, levelTimeLimitMs } from "./levels";
import { playWordLevel } from "./runner";
import { runTimed } from "./timed";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "每过一关，花园就多开一片花～",
    grandMessage: "十一座花园全部开满花，你认识的字真多呀！",
    playLevel(stage, ctx) {
      const theme = CHAPTER_THEMES[ctx.chapterIndex] ?? CHAPTER_THEMES[CHAPTER_THEMES.length - 1];
      const run = (host: HTMLElement, inner: PlayCtx): PlayHandle | void => playWordLevel(host, inner);
      return runTimed({ stage, ctx, limitMs: levelTimeLimitMs(ctx.level), accent: theme.accent, run });
    },
  });
}
