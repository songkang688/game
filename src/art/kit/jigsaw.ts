/**
 * 共享美术套件 · 拼图齿形生成器(1.3 第 21 步 B 档 `puzzle-tiles` 首建,归 B 档所有)。
 *
 * 输入块在网格里的位置,输出这一块的经典「蘑菇头」凹凸齿轮廓:
 * - 每条内边的凸 / 凹由确定性哈希决定:同一关卡(同 seed)两次生成一字不差,
 *   且相邻两块对同一条边算出来的方向天然互补(一块凸出去,另一块就凹进来);
 * - 边缘块对外的边是平边;
 * - 齿形半径 = 块宽 18%,块宽小于 40px 时降到 14% 防止齿与齿粘连;
 * - 齿颈宽 = 齿半径的 55%,三段三次贝塞尔画出「蘑菇头」标准齿。
 *
 * 纯字符串几何,不碰 DOM:齿边只是视觉裁剪层,块的逻辑坐标与拖拽热区不归它管。
 */

/** 大块齿形半径:块宽的百分比 */
export const JIGSAW_RADIUS_PCT = 18;
/** 小块(块宽 < 40px)的齿形半径百分比,防粘连 */
export const JIGSAW_RADIUS_SMALL_PCT = 14;
/** 「小块」的块宽阈值(px) */
export const JIGSAW_SMALL_PX = 40;
/** 齿颈宽 = 齿半径 × 这个比例 */
export const JIGSAW_NECK_RATIO = 0.55;

/** 这一块宽 cellPx 像素时用哪一档齿形半径(百分比) */
export function jigsawRadiusPct(cellPx: number): number {
  return Number.isFinite(cellPx) && cellPx > 0 && cellPx < JIGSAW_SMALL_PX
    ? JIGSAW_RADIUS_SMALL_PCT
    : JIGSAW_RADIUS_PCT;
}

/** 1=凸(齿伸出去) -1=凹(缺口凹进来) 0=平边(网格外缘) */
export type TabDir = -1 | 0 | 1;

export interface JigsawTabs {
  top: TabDir;
  right: TabDir;
  bottom: TabDir;
  left: TabDir;
}

/** 整数确定性哈希:同一条内边永远同一个凸凹,不掺 Math.random */
function edgeBit(seed: number, kind: number, a: number, b: number): TabDir {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(kind + 1, 0x85ebca6b);
  h ^= Math.imul(a + 1, 0xc2b2ae35) ^ Math.imul(b + 1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h & 1) === 0 ? 1 : -1;
}

/**
 * 第 (r,c) 块四条边的凸凹。
 * 同一条内边只哈希一次:上块的 bottom 与下块的 top、左块的 right 与右块的 left
 * 读的是同一个哈希值的正反面,所以相邻块自动互补。
 */
export function jigsawTabs(rows: number, cols: number, r: number, c: number, seed = 1): JigsawTabs {
  // 水平内边(row r 的上边)归 (r,c) 的 top 正向持有
  const top: TabDir = r <= 0 ? 0 : edgeBit(seed, 0, r, c);
  const bottom: TabDir = r >= rows - 1 ? 0 : (-edgeBit(seed, 0, r + 1, c) as TabDir);
  const left: TabDir = c <= 0 ? 0 : edgeBit(seed, 1, r, c);
  const right: TabDir = c >= cols - 1 ? 0 : (-edgeBit(seed, 1, r, c + 1) as TabDir);
  return { top, right, bottom, left };
}

const fmt = (x: number): string => String(Math.round(x * 100) / 100);

/**
 * 一条边的路径段(局部坐标):从 (0,0) 走到 (len,0),齿在 v>0 一侧乘上方向 d。
 * 蘑菇头 = 左颈、头、右颈三段三次贝塞尔;平边就一条直线。
 */
function edgeSegments(len: number, rad: number, d: TabDir, map: (u: number, v: number) => [number, number]): string {
  const pt = (u: number, v: number): string => {
    const [x, y] = map(u, v * d);
    return `${fmt(x)} ${fmt(y)}`;
  };
  if (d === 0) return `L ${pt(len, 0)}`;
  const m = len / 2;
  const r = rad;
  const n = (JIGSAW_NECK_RATIO * r) / 2; // 半颈宽
  return (
    `L ${pt(m - 0.62 * r, 0)} ` +
    `C ${pt(m - 0.18 * r, 0.02 * r)} ${pt(m - 0.12 * r, 0.24 * r)} ${pt(m - n, 0.52 * r)} ` +
    `C ${pt(m - 0.94 * r, 0.98 * r)} ${pt(m + 0.94 * r, 0.98 * r)} ${pt(m + n, 0.52 * r)} ` +
    `C ${pt(m + 0.12 * r, 0.24 * r)} ${pt(m + 0.18 * r, 0.02 * r)} ${pt(m + 0.62 * r, 0)} ` +
    `L ${pt(len, 0)}`
  );
}

/**
 * 第 (r,c) 块的 SVG 路径 d:块身占 [origin, origin+size]²,齿最多伸出半径这么远。
 * size 传真实块宽(px)时自动套 18% / 14% 两档;齿形只由 (rows,cols,r,c,seed) 决定。
 * origin 只是整体平移(clip-path 想用在放大 pad 的皮肤层上时传 pad),不改齿形。
 */
export function jigsawD(rows: number, cols: number, r: number, c: number, size: number, seed = 1, origin = 0): string {
  const s = Number.isFinite(size) && size > 0 ? size : 100;
  const o = Number.isFinite(origin) ? origin : 0;
  const rad = (s * jigsawRadiusPct(s)) / 100;
  const t = jigsawTabs(rows, cols, r, c, seed);
  // 顺时针:上(左→右) 右(上→下) 下(右→左) 左(下→上),外法线各不相同
  const top = edgeSegments(s, rad, t.top, (u, v) => [o + u, o - v]);
  const right = edgeSegments(s, rad, t.right, (u, v) => [o + s + v, o + u]);
  const bottom = edgeSegments(s, rad, t.bottom, (u, v) => [o + s - u, o + s + v]);
  const left = edgeSegments(s, rad, t.left, (u, v) => [o - v, o + s - u]);
  return `M ${fmt(o)} ${fmt(o)} ${top} ${right} ${bottom} ${left} Z`;
}

/** 同一块的 CSS `clip-path: path(...)` 值(与 jigsawD 同一条轮廓) */
export function jigsawClipPath(rows: number, cols: number, r: number, c: number, size: number, seed = 1, origin = 0): string {
  return `path("${jigsawD(rows, cols, r, c, size, seed, origin)}")`;
}
