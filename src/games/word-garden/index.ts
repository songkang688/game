import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export const meta = {
  id: "word-garden",
  title: "识字小花园",
  emoji: "🌸",
  category: "edu" as const,
  color: "#faa2c1",
  blurb: "六座花园 99 关！看图认字、拼音选字、数字汉字和组词，边种花边识字！",
};

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "每过一关，花园就多开一片花～",
    grandMessage: "六座花园全部开满花，你认识的字真多呀！",
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
