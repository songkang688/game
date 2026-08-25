import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "从牧场数数出发，一路算到月光农庄～",
    grandMessage: "99 关全部通关，你是真正的算数小能手！",
    playLevel(stage, ctx) {
      return runQuiz({
        stage,
        ctx,
        questions: buildQuestions(ctx.level),
        theme: CHAPTER_THEMES[ctx.chapterIndex],
        bigChoices: true,
      });
    },
  });
}
