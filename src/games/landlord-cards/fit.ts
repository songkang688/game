/**
 * 鸭梨抢地主 1.2：把这一桌钳进「舞台真正看得见的那一段」。
 *
 * 第 2 轮测试员 W5R2-A-05：360×640 上「⏸ 暂停」的键心落在舞台裁切线以下 43px，
 * 真实坐标点不着——孩子想暂停只能退出重来。再往下到 320×568，叫地主那一排
 * 「不叫 / 1 分 / 2 分 / 3 分」四颗一起挂掉，连开局都开不了。
 * 根因的一半在平台（`.game-stage{overflow:hidden}`，禁改，交窗口1），
 * 另一半是本款自己这一桌太高，这个文件收的是后一半。
 *
 * 收的都是留白、字号与对家面板上的装饰小牌背；
 * 出牌那一排 48px、底下那一排 44px、以及手牌本身，一分不动——
 * 那三样是玩法本身，为了「装得下」把热区收到 44 以下等于换一种点不着。
 *
 * 为什么不能写成媒体查询：舞台比视口矮一大截（360×640 的机器上这一桌只分到 356px，
 * 视口却有 640px），按 `vh` 判会得出「屏幕够高，不用收」的错误结论。
 */

/** 第一档「挤一挤」：收留白与字号 */
export const TIGHT_CLASS = "ldc-tight";
/** 第二档「再挤挤」：对家面板上的小牌背收起来，只留「还剩几张」 */
export const TIGHTER_CLASS = "ldc-tighter";

/**
 * 从 `selfTop` 往下，舞台真正看得见的还剩多少像素。
 * 取最靠里那一层裁切祖先的下沿；一层都没有（用例里的裸节点）返回 `Infinity`，表示不用收。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/** 这一桌 `contentPx` 高、舞台只看得见 `room`，要不要再收一档 */
export function shouldTighten(room: number, contentPx: number): boolean {
  if (!Number.isFinite(room) || room <= 0) return false;
  return contentPx > room + 1;
}

/**
 * 该给这一桌挂几档。0 = 原样，1 = 挤一挤，2 = 再挤挤。
 * `measure(tier)` 要返回挂上第 tier 档之后这一桌有多高——真量，别估。
 */
export function pickTier(room: number, measure: (tier: 0 | 1 | 2) => number): 0 | 1 | 2 {
  if (!shouldTighten(room, measure(0))) return 0;
  if (!shouldTighten(room, measure(1))) return 1;
  return 2;
}

function clipperBottoms(wrap: HTMLElement, view: Window): number[] {
  const bottoms: number[] = [];
  for (let p = wrap.parentElement; p; p = p.parentElement) {
    const oy = view.getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") bottoms.push(p.getBoundingClientRect().bottom);
  }
  return bottoms;
}

/**
 * 量一次舞台可视高，装不下就逐档收紧。
 * `onTier` 在档位真的变了的时候叫一次——手牌扇的高度是 JS 摆出来的，
 * 不跟着重摆一次，CSS 收出来的那点空间会被扇形原样占回去。
 */
export function fitTableStage(
  wrap: HTMLElement,
  onTier?: (tier: 0 | 1 | 2) => void
): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const measurable = typeof wrap.getBoundingClientRect === "function" && !!view;
  let worn: 0 | 1 | 2 = 0;

  const wear = (tier: 0 | 1 | 2): void => {
    wrap.classList.toggle(TIGHT_CLASS, tier >= 1);
    wrap.classList.toggle(TIGHTER_CLASS, tier >= 2);
  };

  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先摘干净再量：量到的必须是「本来有多高」，不然收完装得下就以为本来就装得下
    wear(0);
    const room = visibleRoomPx(wrap.getBoundingClientRect().top, clipperBottoms(wrap, view));
    const tier = pickTier(room, (t) => {
      wear(t);
      return wrap.getBoundingClientRect().height;
    });
    wear(tier);
    if (tier !== worn) {
      worn = tier;
      onTier?.(tier);
    }
  };

  relayout();
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
      wear(0);
      worn = 0;
    },
  };
}
