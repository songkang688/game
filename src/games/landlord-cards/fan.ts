// 鸭梨抢地主 —— 扇形手牌的摆放与框选,纯几何计算。
//
// 手牌越多扇得越开、每张露出的宽度越窄;框选时用「每张露出来的那一条」判断有没有被圈住,
// 这样孩子横着一划,划过的每一张都会被选中,而不是只选到最上面那一张。

export interface FanSlot {
  /** 相对扇形容器左上角的位置 */
  x: number;
  y: number;
  /** 旋转角度(度) */
  rot: number;
}

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 手牌区宽度决定一张牌多大。
 * 17 张牌摆满时,每张露出来的那一条宽度只由容器宽度决定,跟牌本身多大无关,
 * 所以牌画大一点只会更好认,不会更挤——上限 66px 是怕宽屏上大得像扑克教具。
 */
export function cardWidthFor(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 44;
  return Math.max(36, Math.min(66, Math.round(width / 7)));
}

/** 牌的高宽比 */
export const CARD_RATIO = 1.42;

export function cardHeightFor(cardW: number): number {
  return Math.round(cardW * CARD_RATIO);
}

/** 扇形容器要多高才装得下(牌高 + 选中时上抬的空间 + 两端下沉) */
export function fanHeightFor(cardW: number): number {
  return Math.round(cardHeightFor(cardW) + cardW * 0.5 + 10);
}

/**
 * 算出每张牌摆在哪:整体居中,牌多了就叠得更紧,两端微微向外转、向下沉。
 * n 张牌返回 n 个位置,顺序与手牌顺序一致(后面的盖在前面上面)。
 */
export function fanLayout(n: number, width: number, cardW: number): FanSlot[] {
  if (n <= 0 || width <= 0) return [];
  if (n === 1) return [{ x: Math.max(0, (width - cardW) / 2), y: 0, rot: 0 }];

  const span = Math.max(cardW * 0.24, width - cardW);
  const step = Math.min(cardW * 0.7, span / (n - 1));
  const total = step * (n - 1);
  const x0 = Math.max(0, (width - total - cardW) / 2);
  const spread = Math.min(26, n * 1.8);

  const slots: FanSlot[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5; // -0.5 .. 0.5
    slots.push({
      x: x0 + step * i,
      y: t * t * cardW * 1.4,
      rot: t * spread,
    });
  }
  return slots;
}

/** 把随手拖出来的两点整理成左上 / 右下 */
export function normBox(x1: number, y1: number, x2: number, y2: number): Box {
  return {
    x1: Math.min(x1, x2),
    y1: Math.min(y1, y2),
    x2: Math.max(x1, x2),
    y2: Math.max(y1, y2),
  };
}

/** 拖得够远才算「框选」,不然就当成普通的点一下 */
export function isDragBox(box: Box, threshold = 12): boolean {
  return box.x2 - box.x1 >= threshold || box.y2 - box.y1 >= threshold;
}

/**
 * 框住了哪几张牌:用每张「露出来的那一条」和框做相交判断。
 * 最后一张没有被盖住,整张都算它的。
 */
export function boxHits(slots: readonly FanSlot[], cardW: number, cardH: number, box: Box): number[] {
  const out: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const left = slots[i].x;
    const right = i === slots.length - 1 ? left + cardW : Math.max(slots[i + 1].x, left + 1);
    const top = slots[i].y;
    const bottom = top + cardH;
    if (right > box.x1 && left < box.x2 && bottom > box.y1 && top < box.y2) out.push(i);
  }
  return out;
}

/**
 * 点到了第几张:从最上面(最后一张)往回找,谁露出来的那一条被点中就是谁。
 * lifts 是每张牌被挑起来的高度(选中的牌会往上抬),点选时要跟着抬。
 */
export function hitIndex(
  slots: readonly FanSlot[],
  cardW: number,
  cardH: number,
  x: number,
  y: number,
  lifts: readonly number[] = []
): number {
  for (let i = slots.length - 1; i >= 0; i--) {
    const left = slots[i].x;
    const right = i === slots.length - 1 ? left + cardW : Math.max(slots[i + 1].x, left + 1);
    const top = slots[i].y - (lifts[i] ?? 0);
    if (x >= left && x < right && y >= top && y <= top + cardH) return i;
  }
  return -1;
}

/** 键盘光标左右移动后落在第几张(到头就停住,不绕圈,免得小朋友晕) */
export function moveCursor(cursor: number, delta: number, n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(n - 1, cursor + delta));
}
