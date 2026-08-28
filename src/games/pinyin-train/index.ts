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
import { fitQuizHost } from "./fit";
import { QUIZ_SKIN_CSS, buildScene, decorateQuizTickets, trainWatchCtx } from "./scene";

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
          // 答题屏归 `quiz99.ts` 渲（平台共享模块，禁改），但渲进哪个盒子是本款说了算。
          // 直接渲进舞台的话，矮屏上 `.qz-msg` 那一行整句掉在裁切线以下、又没有任何
          // 可滚祖先——孩子答完一题屏幕上什么都不会发生（W5R2-FC-01）。
          const host = document.createElement("div");
          // 网格 / flex 子项默认 min-width:auto，长题面会把宿主撑破，钳高之前先把这一格按住
          host.style.minWidth = "0";
          // 车票化选项的覆盖样式挂在宿主这个类名下（1.3 视觉皮肤，quiz99 一个字不动）
          host.className = "pyt-quizskin";
          // 火车舞台（纯视觉）：答对挂厢、答错轻晃、整关赢了鸣笛发车；
          // 舞台放在宿主上方，fitQuizHost 量的是宿主自己的头顶，钳位照旧
          const questions = buildQuestions(innerCtx.level);
          const scene = buildScene({ target: questions.length });
          const skin = document.createElement("style");
          skin.textContent = QUIZ_SKIN_CSS;
          inner.appendChild(skin);
          inner.appendChild(scene.el);
          inner.appendChild(host);
          const fit = fitQuizHost(host);
          const deco = decorateQuizTickets(host);
          const handle = runQuizWithReview({
            stage: host,
            // 只看不改的观察层：coin/oops 回声驱动挂厢与轻晃，win/lose 原样透传
            ctx: trainWatchCtx(innerCtx, scene, questions.map((q) => q.answer)),
            questions,
            theme,
            level: innerCtx.level,
          });
          return {
            destroy() {
              deco.dispose();
              fit.dispose();
              handle?.destroy?.();
              scene.destroy();
              skin.remove();
              host.remove();
            },
          };
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
