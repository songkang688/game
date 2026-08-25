import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export const meta = {
  id: "pinyin-train",
  title: "拼音小火车",
  emoji: "🚂",
  category: "edu" as const,
  color: "#74c0fc",
  blurb: "六大车站 99 关！单韵母、声母、双胞胎字母、声调和音节，一站站开到终点！",
};

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "小火车呜呜开，每站都有新拼音～",
    grandMessage: "六大车站全部到站，你是拼音小车长！",
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
