/**
 * 萌猫小屋 · 猫的状态机（1.2 从 `index.ts` 抽出来的纯函数）。
 *
 * 这里只管「猫现在是什么心情、摆什么表情、要不要躲进纸箱」，一行 DOM 都不碰，
 * 所以整份可以单测。渲染那一半在 `catArt.ts` 与 `index.ts`。
 *
 * 1.2 最重要的改动：**心情掉到 0 不再判负**。
 * 猫会躲进纸箱，安抚三次就自己出来，本关最高星降一档，但关卡照常往下走——
 * 这一款没有任何一条路会走到「照顾失败」。
 */

/** 猫的表情状态：开心 / 好奇 / 困 / 委屈 / 躲进纸箱（没有难过与哭泣） */
export type CatFace = "happy" | "curious" | "sleepy" | "pouty" | "hiding";

/** 五种表情都配一张脸与一句旁白（旁白只描述状态，不责备孩子） */
export const FACE_INFO: Record<CatFace, { emoji: string; label: string }> = {
  happy: { emoji: "😻", label: "开心" },
  curious: { emoji: "😺", label: "好奇" },
  sleepy: { emoji: "😴", label: "困了" },
  pouty: { emoji: "🙀", label: "有点委屈" },
  hiding: { emoji: "📦", label: "躲进纸箱" }
};

/** 躲进纸箱之后要安抚几次才肯出来 */
export const SOOTHE_TO_RETURN = 3;

export interface CatState {
  /** 这只猫叫什么（原创角色：团团 / 糯糯 / 煤球） */
  name: string;
  face: CatFace;
  /** 心情值；`moodMax === 0` 表示本关根本不看心情 */
  mood: number;
  moodMax: number;
  /** 正躲在纸箱里 */
  hiding: boolean;
  /** 躲进去之后已经被安抚了几次 */
  soothed: number;
  /** 本关一共躲过几次（用来决定最高星降不降档） */
  hideCount: number;
  /** 刚被摸了一下，正在呼噜 */
  purring: boolean;
}

/**
 * 猫身上会发生的事：
 * - `done` 做完一件事、`miss` 做岔了一次（只歪头，不难过）
 * - `soothe` 安抚一下（躲着的时候用它把猫哄出来）
 * - `pet` 摸一摸（呼噜）、`yawn` 打哈欠（困）、`peek` 看到新东西（好奇）
 * - `settle` 回到平静
 */
export type CatEvent = "done" | "miss" | "soothe" | "pet" | "yawn" | "peek" | "settle";

export function createCat(name: string, moodStart = 0, moodMax = 0): CatState {
  const max = Math.max(0, Math.floor(moodMax));
  const start = Math.max(0, Math.min(max, Math.floor(moodStart)));
  return {
    name,
    face: "curious",
    mood: max > 0 ? start : 0,
    moodMax: max,
    hiding: false,
    soothed: 0,
    hideCount: 0,
    purring: false
  };
}

function clampMood(mood: number, max: number): number {
  return Math.max(0, Math.min(max, mood));
}

/**
 * 推进一步状态机（纯函数：进去一个状态，出来一个新状态，原状态不动）。
 *
 * 躲在纸箱里的时候只认 `soothe`：任务侧看到 `hiding` 就该暂停，
 * 安抚满 `SOOTHE_TO_RETURN` 次，猫带着回到一半的心情自己走出来。
 */
export function catAfter(state: CatState, event: CatEvent): CatState {
  const next: CatState = { ...state, purring: false };

  if (state.hiding) {
    if (event !== "soothe") return next;
    const soothed = state.soothed + 1;
    if (soothed < SOOTHE_TO_RETURN) {
      return { ...next, soothed, face: "hiding" };
    }
    // 出箱：心情回到一半，重新开始照顾
    return {
      ...next,
      hiding: false,
      soothed: 0,
      face: "curious",
      mood: state.moodMax > 0 ? Math.max(1, Math.ceil(state.moodMax / 2)) : 0
    };
  }

  switch (event) {
    case "done":
      next.mood = clampMood(state.mood + 1, state.moodMax);
      next.face = "happy";
      break;
    case "miss":
      next.mood = clampMood(state.mood - 2, state.moodMax);
      // 做错只歪头（好奇），心情很低的时候最多是委屈，绝不出现难过或哭泣
      next.face = state.moodMax > 0 && next.mood <= Math.max(1, state.moodMax * 0.3) ? "pouty" : "curious";
      break;
    case "soothe":
      next.mood = clampMood(state.mood + 2, state.moodMax);
      next.face = "happy";
      break;
    case "pet":
      next.purring = true;
      next.face = "happy";
      break;
    case "yawn":
      next.face = "sleepy";
      break;
    case "peek":
      next.face = "curious";
      break;
    default:
      next.face = state.moodMax > 0 && state.mood <= Math.max(1, state.moodMax * 0.3) ? "pouty" : "curious";
      break;
  }

  if (next.moodMax > 0 && next.mood <= 0) {
    // 心情见底：躲进纸箱等安抚，绝不判负、绝不重来
    next.hiding = true;
    next.soothed = 0;
    next.face = "hiding";
    next.hideCount = state.hideCount + 1;
  }
  return next;
}

/** 现在这只猫画什么脸 */
export function faceOf(state: CatState): CatFace {
  return state.face;
}

/** 心情条上的百分比（没有心情条的关返回 1，条子不显示） */
export function moodRatio(state: CatState): number {
  if (state.moodMax <= 0) return 1;
  return Math.max(0, Math.min(1, state.mood / state.moodMax));
}

/** 躲纸箱时还差几次安抚 */
export function soothesLeft(state: CatState): number {
  return state.hiding ? Math.max(0, SOOTHE_TO_RETURN - state.soothed) : 0;
}

/**
 * 本关最高能拿几星：躲过纸箱就降一档（3 → 2），但永远保底 1 星。
 * 「降一档」只降一次，躲第二次不会继续往下掉——不叠加惩罚。
 */
export function starCap(cats: readonly CatState[]): 1 | 2 | 3 {
  return cats.some((c) => c.hideCount > 0) ? 2 : 3;
}

/** 最终星级：先按失误数评，再被最高星封顶，最低 1 星 */
export function finalStars(mistakes: number, cap: 1 | 2 | 3): 1 | 2 | 3 {
  const base: 1 | 2 | 3 = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  return Math.max(1, Math.min(cap, base)) as 1 | 2 | 3;
}

/** 状态栏上那句话：只描述猫在干嘛，不评价孩子 */
export function catLine(state: CatState): string {
  if (state.hiding) {
    const left = soothesLeft(state);
    return `${state.name}钻进纸箱啦～轻轻摸摸它，还差 ${left} 次就出来`;
  }
  switch (state.face) {
    case "happy":
      return state.purring ? `${state.name}眯着眼打呼噜` : `${state.name}开心得尾巴都翘起来了`;
    case "sleepy":
      return `${state.name}打了个哈欠，有点困了`;
    case "pouty":
      return `${state.name}把耳朵放平了，想被哄一哄`;
    default:
      return `${state.name}歪着头看你，好奇得很`;
  }
}
