import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "帮国王认全王国里的每一种形状～",
    grandMessage: "99 关全部通关，国王封你为形状小骑士！",
    playLevel(stage, ctx) {
      return runQuiz({
        stage,
        ctx,
        questions: buildQuestions(ctx.level),
        theme: CHAPTER_THEMES[ctx.chapterIndex],
      });
    },
  });
}
