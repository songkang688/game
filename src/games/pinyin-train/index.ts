import { meta } from "./meta";
export { meta };

import {
  chapterOf,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  TOTAL_LEVELS,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import {
  buildPickAll,
  buildQuestions,
  buildSpell,
  CHAPTERS,
  CHAPTER_THEMES,
  isPickAllLevel,
  isSpellLevel,
  levelTimeLimitMs,
} from "./levels";
import { runPickAll } from "./pickAll";
import { runQuizWithReview } from "./review";
import { runSpell } from "./spell";
import { runTimed } from "./timed";
import { openLevelOnMap, parseLevelParam, resolveInitialLevel } from "./runtime";

/** 壳层给的 `initialLevel`（1 基），没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

export function mount(api: GameApi): { destroy: () => void } {
  const host = document.createElement("div");
  api.root.appendChild(host);

  const game = mountLevelGame(
    { ...api, root: host },
    {
      id: meta.id,
      chapters: CHAPTERS,
      mapHint: "小火车呜呜开，每站都有新拼音～",
      grandMessage: "十一座车站全部到站，你是拼音小车长！",
      playLevel(stage, ctx) {
        const theme = CHAPTER_THEMES[ctx.chapterIndex] ?? CHAPTER_THEMES[CHAPTER_THEMES.length - 1];
        const run = (inner: HTMLElement, innerCtx: PlayCtx): PlayHandle | void => {
          if (isPickAllLevel(innerCtx.level)) {
            return runPickAll({ stage: inner, ctx: innerCtx, task: buildPickAll(innerCtx.level), theme });
          }
          if (isSpellLevel(innerCtx.level)) {
            return runSpell({ stage: inner, ctx: innerCtx, tasks: buildSpell(innerCtx.level), theme });
          }
          return runQuizWithReview({
            stage: inner,
            ctx: innerCtx,
            questions: buildQuestions(innerCtx.level),
            theme,
            level: innerCtx.level,
          });
        };
        return runTimed({ stage, ctx, limitMs: levelTimeLimitMs(ctx.level), accent: theme.accent, run });
      },
    }
  );

  // 壳层或地址栏点名了某一关就直接开进去，不用孩子在 188 个格子里自己找
  const target = resolveInitialLevel(
    wantedLevel(api),
    furthestPlayable(loadStars(meta.id), loadSkips(meta.id), TOTAL_LEVELS),
    TOTAL_LEVELS
  );
  if (target !== null) {
    try {
      openLevelOnMap(host, target, chapterOf(CHAPTERS, target));
    } catch (err) {
      console.warn("[一朵一星] pinyin-train 直开关卡失败，停在地图上:", err);
    }
  }

  return {
    destroy() {
      game.destroy();
      host.remove();
    },
  };
}
