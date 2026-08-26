import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi } from "../level99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES, LEGACY_CHAPTER_COUNT } from "./levels";
import { buildDrawTasks, isDrawLevel, runDrawRound } from "./draw";
import { runQuizWithReview } from "./review";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "帮国王认全王国里的形状，再一路量到坐标方位岛～",
    grandMessage: "188 关全部通关，国王封你为形状小骑士！",
    playLevel(stage, ctx) {
      const theme = CHAPTER_THEMES[ctx.chapterIndex];
      // 后 4 章每隔几关夹一关动手作图：拖点画长方形 / 补对称 / 拼骨牌
      if (isDrawLevel(ctx.chapterIndex, ctx.indexInChapter, LEGACY_CHAPTER_COUNT)) {
        return runDrawRound({ stage, ctx, theme, tasks: buildDrawTasks(ctx.level) });
      }
      return runQuizWithReview({
        stage,
        ctx,
        theme,
        level: ctx.level,
        questions: buildQuestions(ctx.level),
      });
    },
  });
}
