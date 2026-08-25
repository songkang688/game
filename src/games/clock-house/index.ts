import { mountLevelGame, type GameApi } from "../level99";
import { runQuiz } from "../quiz99";
import { buildQuestions, CHAPTERS, CHAPTER_THEMES } from "./levels";

export const meta = {
  id: "clock-house",
  title: "时钟小屋",
  emoji: "🕒",
  category: "edu" as const,
  color: "#ffa94d",
  blurb: "六层小屋 99 关！整点半点、1 刻 3 刻、拨针找钟面，还有时间小推理！",
};

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "滴答滴答，一层一层爬上时钟小屋～",
    grandMessage: "99 关全部通关，你是时间小管家！",
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
