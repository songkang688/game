import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "滴答滴答，一层一层爬上时钟小屋，顶楼还有时刻表要读～",
    grandMessage: "188 关全部通关，你是时间小管家！",
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
