/**
 * 红蓝跑道 1.2：把这一屏钳进「舞台真正看得见的那一段」。
 *
 * 第 2 轮测试员 W5R2-A-02：360×720 起「🦘 跳」的键心落在舞台裁切线以下点不着，
 * 360×640 上左脚 / 右脚 / 跳三颗全挂——触屏玩家在这两档视口上跳不了。
 * 根因的一半在平台（`.game-stage{overflow:hidden}` 与 `.l99-stage-wrap`，禁改，交窗口1），
 * 另一半是本款自己这一屏太高，这个文件收的是后一半。
 *
 * 两条硬规矩：
 *  1. **不给它挂滚动条。** 这是个连点游戏，能滚就会「想按却滑走了」——
 *     跑动键是玩法本身，手指落在哪儿就得是哪儿。所以只收高度，不做滚动兜底
 *     （这一点和涂色小屋刚好相反，那边慢慢涂，滚得起）。
 *  2. **热区一分不动。** 收的是抬头条、赛道条、留白与字号；
 *     最狠的一档里跑动键仍有 52px、让分开关仍是 44px，都在触屏口径之上。
 *
 * 为什么不能写成媒体查询：舞台比视口矮一大截（360×640 的机器上这一屏只分到 302px，
 * 视口却有 640px），按 `vh` 判会得出「屏幕够高，不用收」的错误结论——
 * 那正是这条缺陷一直没被 CSS 挡住的原因。只能实测祖先裁切线。
 */

/** 第一档「挤一挤」：收留白与字号，跑动键从两行改一行 */
export const TIGHT_CLASS = "rbr-tight";
/** 第二档「再挤挤」：连抬头条的头像徽章一起收起来，赛道再矮一点 */
export const TIGHTER_CLASS = "rbr-tighter";

/**
 * 从 `selfTop` 往下，舞台真正看得见的还剩多少像素。
 * 取最靠里那一层裁切祖先的下沿；一层都没有（用例里的裸节点）返回 `Infinity`，表示不用收。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/** 这一屏 `contentPx` 高、舞台只看得见 `room`，要不要再收一档 */
export function shouldTighten(room: number, contentPx: number): boolean {
  if (!Number.isFinite(room) || room <= 0) return false;
  return contentPx > room + 1;
}

/**
 * 该给这一屏挂几档。0 = 原样，1 = 挤一挤，2 = 再挤挤。
 * `measure(tier)` 要返回挂上第 tier 档之后这一屏有多高——真量，别估。
 */
export function pickTier(room: number, measure: (tier: 0 | 1 | 2) => number): 0 | 1 | 2 {
  if (!shouldTighten(room, measure(0))) return 0;
  if (!shouldTighten(room, measure(1))) return 1;
  return 2;
}

/** 一层层往上找会裁切的祖先，收集它们的下沿 */
function clipperBottoms(wrap: HTMLElement, view: Window): number[] {
  const bottoms: number[] = [];
  for (let p = wrap.parentElement; p; p = p.parentElement) {
    const oy = view.getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") bottoms.push(p.getBoundingClientRect().bottom);
  }
  return bottoms;
}

/**
 * 量一次舞台可视高，装不下就逐档收紧，装得下就把档位摘干净。
 * 返回 `relayout`（仪表盘长出新芯片、换模式、转屏之后再叫一次）与 `dispose`（`destroy` 时拆监听）。
 */
export function fitRaceStage(wrap: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const measurable = typeof wrap.getBoundingClientRect === "function" && !!view;

  const wear = (tier: 0 | 1 | 2): void => {
    wrap.classList.toggle(TIGHT_CLASS, tier >= 1);
    wrap.classList.toggle(TIGHTER_CLASS, tier >= 2);
  };

  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先摘干净再量：量到的必须是「本来有多高」，不然收完装得下就以为本来就装得下,越量越松
    wear(0);
    const room = visibleRoomPx(wrap.getBoundingClientRect().top, clipperBottoms(wrap, view));
    wear(
      pickTier(room, (tier) => {
        wear(tier);
        return wrap.getBoundingClientRect().height;
      })
    );
  };

  relayout();
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
      wear(0);
    },
  };
}
