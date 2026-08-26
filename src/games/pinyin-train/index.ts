import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { runQuiz } from "../quiz99";
import {
  buildPickAll,
  buildQuestions,
  CHAPTERS,
  CHAPTER_THEMES,
  isPickAllLevel,
  levelTimeLimitMs,
} from "./levels";
import { runPickAll } from "./pickAll";
import { runTimed } from "./timed";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "小火车呜呜开，每站都有新拼音～",
    grandMessage: "十座车站全部到站，你是拼音小车长！",
    playLevel(stage, ctx) {
      const theme = CHAPTER_THEMES[ctx.chapterIndex] ?? CHAPTER_THEMES[CHAPTER_THEMES.length - 1];
      const run = (host: HTMLElement, inner: PlayCtx): PlayHandle | void =>
        isPickAllLevel(inner.level)
          ? runPickAll({ stage: host, ctx: inner, task: buildPickAll(inner.level), theme })
          : runQuiz({
              stage: host,
              ctx: inner,
              questions: buildQuestions(inner.level),
              theme,
              bigChoices: true,
            });
      return runTimed({ stage, ctx, limitMs: levelTimeLimitMs(ctx.level), accent: theme.accent, run });
    },
  });
}
