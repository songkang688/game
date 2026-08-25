import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export const meta = {
  id: "shape-kingdom",
  title: "形状王国",
  emoji: "🏰",
  category: "edu" as const,
  color: "#b197fc",
  blurb: "六大王国区域 99 关！认形状、辨颜色、比大小、数边数还有图形大搜数！",
};

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
