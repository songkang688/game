import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export const meta = {
  id: "math-farm",
  title: "算数小农场",
  emoji: "🐮",
  category: "edu" as const,
  color: "#8ce99a",
  blurb: "六大农场 99 关！数一数、加减法、凑十破十、连加连减，喂饱全部小动物！",
};

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
