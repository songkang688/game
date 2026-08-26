// 寻找外星朋友 · 1.2 手感层:点击容错、摆放校验、缩放拖动、望远镜提示。
//
// 这一层全是纯函数,一个 DOM 都不碰,index.ts 只负责把它们接到画面上。
// 1.1 的 logic.ts 管的是「场景数据与推理」,这里管的是「小朋友的手指点得准不准、看不看得清」。
import { SCENE_H, SCENE_W, dist, type Spot } from "./logic";

// ---------------------------------------------------------------------------
// 一、点击容错
// ---------------------------------------------------------------------------

/** 目标外圈这么多屏幕像素以内的点击都算数(手指按下去比看上去粗一圈) */
export const HIT_TOLERANCE_PX = 44;

/** 屏幕上的容错半径换算成场景坐标:画得越小,场景里要放宽得越多 */
export function toleranceInScene(viewScale: number, px: number = HIT_TOLERANCE_PX): number {
  const s = viewScale > 0 ? viewScale : 1;
  return px / s;
}

/**
 * 点到了哪个藏身点:圆外 tolerance 以内都算命中,几个挨得近就取圆心最近的那个。
 * 距离一样时取下标小的,保证同一次点击永远给同一个答案。
 */
export function pickNearestSpot(spots: Spot[], x: number, y: number, tolerance = 0): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < spots.length; i++) {
    const d = dist(x, y, spots[i].x, spots[i].y);
    if (d <= spots[i].r + Math.max(0, tolerance) && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** 连点空处几次给一句温和提示 */
export const EMPTY_TIPS_AFTER = 3;

/** 点空不扣星、不扣时间,这条常量是写给以后改代码的人看的 */
export const EMPTY_CLICK_PENALTY = 0;

const EMPTY_TIPS = [
  "点空了不要紧,一行一行慢慢扫过去,漏掉的地方就少啦。",
  "试试从上往下看,看到一半停一下再继续,眼睛不容易累。",
  "藏得深的话可以放大看看,右上角有放大镜。",
];

/**
 * 点空 streak 次之后要不要说句话:每满 3 次给一句,换着说。
 * 返回 null 表示这次不用说话。
 */
export function emptyClickTip(streak: number): string | null {
  if (streak <= 0 || streak % EMPTY_TIPS_AFTER !== 0) return null;
  return EMPTY_TIPS[(streak / EMPTY_TIPS_AFTER - 1) % EMPTY_TIPS.length];
}

// ---------------------------------------------------------------------------
// 二、摆放校验
// ---------------------------------------------------------------------------

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 顶栏(关号 + 计时)与底部时间条在场景坐标里占掉的高度 */
export const UI_TOP = 56;
export const UI_BOTTOM = 56;

/** 藏身点必须待在这块地里,才不会被顶栏 / 时间条压住 */
export const PLAY_AREA: Rect = {
  left: 6,
  top: UI_TOP,
  right: SCENE_W - 6,
  bottom: SCENE_H - UI_BOTTOM,
};

/** 每个目标至少露出这么多面积才算「看得见」 */
export const MIN_VISIBLE = 0.7;

/** 两个藏身点圆心之间除了两个半径还要再留这么多空 */
export const MIN_CENTER_GAP = 8;

/** 360px 宽的手机上,目标画出来至少这么大 */
export const MIN_TARGET_PX = 24;
export const PHONE_WIDTH = 360;

/** ∫₀ˣ √(r²−t²) dt:算圆和矩形交面积要用的那条积分 */
function arcIntegral(r: number, x: number): number {
  const t = Math.max(0, Math.min(r, x));
  return 0.5 * (t * Math.sqrt(Math.max(0, r * r - t * t)) + r * r * Math.asin(r > 0 ? t / r : 0));
}

/** 圆心在原点、半径 r 的圆,和第一象限矩形 [0,x]×[0,y] 的交面积(x、y 都 ≥ 0) */
function quarterArea(r: number, x: number, y: number): number {
  const ax = Math.min(x, r);
  const ay = Math.min(y, r);
  if (ax <= 0 || ay <= 0) return 0;
  if (ax * ax + ay * ay >= r * r) {
    // 矩形的角落在圆外:先是一条高为 ay 的方块,再接一段圆弧下面的面积
    const cut = Math.sqrt(Math.max(0, r * r - ay * ay));
    return ay * cut + (arcIntegral(r, ax) - arcIntegral(r, cut));
  }
  return ax * ay;
}

/** 带符号的象限面积,四个角加加减减就能拼出任意矩形 */
function signedQuarter(r: number, x: number, y: number): number {
  return Math.sign(x) * Math.sign(y) * quarterArea(r, Math.abs(x), Math.abs(y));
}

/** 一个圆和一个矩形的交面积(解析解,不用采样) */
export function circleRectArea(cx: number, cy: number, r: number, rect: Rect): number {
  const x0 = rect.left - cx;
  const x1 = rect.right - cx;
  const y0 = rect.top - cy;
  const y1 = rect.bottom - cy;
  const area =
    signedQuarter(r, x1, y1) - signedQuarter(r, x0, y1) - signedQuarter(r, x1, y0) + signedQuarter(r, x0, y0);
  return Math.max(0, area);
}

/** 这个藏身点有几成面积落在可玩区里 */
export function visibleFraction(spot: Spot, rect: Rect = PLAY_AREA): number {
  const full = Math.PI * spot.r * spot.r;
  if (full <= 0) return 0;
  return circleRectArea(spot.x, spot.y, spot.r, rect) / full;
}

/** 目标画到 360px 宽的手机上有多少像素直径 */
export function screenDiameter(spot: Spot, viewportWidth: number = PHONE_WIDTH): number {
  return spot.r * 2 * (viewportWidth / SCENE_W);
}

/**
 * 一张布局哪里不合格:返回中文毛病清单,空数组表示这张能用。
 * 单测拿它对上千张随机布局逐张断言。
 */
export function layoutIssues(spots: Spot[], rect: Rect = PLAY_AREA): string[] {
  const bad: string[] = [];
  spots.forEach((s, i) => {
    if (visibleFraction(s, rect) < MIN_VISIBLE) bad.push(`第 ${i} 个藏身点被挡住了大半`);
    if (screenDiameter(s) < MIN_TARGET_PX) bad.push(`第 ${i} 个藏身点在手机上画得太小`);
  });
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const need = spots[i].r + spots[j].r + MIN_CENTER_GAP;
      if (dist(spots[i].x, spots[i].y, spots[j].x, spots[j].y) < need) {
        bad.push(`第 ${i} 和第 ${j} 个藏身点挨得太近`);
      }
    }
  }
  return bad;
}

export function layoutIsValid(spots: Spot[], rect: Rect = PLAY_AREA): boolean {
  return layoutIssues(spots, rect).length === 0;
}

// ---------------------------------------------------------------------------
// 三、缩放与拖动
// ---------------------------------------------------------------------------

export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 2.5;

export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 镜头:zoom 是放大倍数,cx / cy 是画面正中对着场景的哪一点 */
export interface View {
  zoom: number;
  cx: number;
  cy: number;
}

export const DEFAULT_VIEW: View = { zoom: 1, cx: SCENE_W / 2, cy: SCENE_H / 2 };

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** zoom = 1 时整张场景刚好铺满画布;再乘上 zoom 就是实际的「场景 → 屏幕」倍率 */
export function viewScale(vp: Viewport, zoom: number): number {
  const fit = Math.min(vp.width / SCENE_W, vp.height / SCENE_H) || 1;
  return fit * clampZoom(zoom);
}

function clampAxis(center: number, half: number, size: number): number {
  if (half * 2 >= size) return size / 2;
  return Math.max(half, Math.min(size - half, center));
}

/** 把镜头拉回合法范围:倍率夹住,而且不许把场景外的空白拖进画面正中 */
export function clampView(view: View, vp: Viewport): View {
  const zoom = clampZoom(view.zoom);
  const s = viewScale(vp, zoom);
  const halfW = vp.width / 2 / s;
  const halfH = vp.height / 2 / s;
  return {
    zoom,
    cx: clampAxis(Number.isFinite(view.cx) ? view.cx : SCENE_W / 2, halfW, SCENE_W),
    cy: clampAxis(Number.isFinite(view.cy) ? view.cy : SCENE_H / 2, halfH, SCENE_H),
  };
}

/** 屏幕上的一次点击落在场景的哪一点(缩放后也要点得准,靠的就是这个换算) */
export function screenToScene(
  clientX: number,
  clientY: number,
  vp: Viewport,
  view: View
): { x: number; y: number } {
  const s = viewScale(vp, view.zoom);
  return {
    x: view.cx + (clientX - vp.left - vp.width / 2) / s,
    y: view.cy + (clientY - vp.top - vp.height / 2) / s,
  };
}

/** 场景里的一点画在屏幕的哪里(和 screenToScene 互为反函数) */
export function sceneToScreen(x: number, y: number, vp: Viewport, view: View): { x: number; y: number } {
  const s = viewScale(vp, view.zoom);
  return {
    x: vp.left + vp.width / 2 + (x - view.cx) * s,
    y: vp.top + vp.height / 2 + (y - view.cy) * s,
  };
}

/** 以场景上的某一点为锚缩放:那一点在屏幕上不动 */
export function zoomAt(view: View, factor: number, anchorX: number, anchorY: number, vp: Viewport): View {
  const zoom = clampZoom(view.zoom * (Number.isFinite(factor) && factor > 0 ? factor : 1));
  const s0 = viewScale(vp, view.zoom);
  const s1 = viewScale(vp, zoom);
  return clampView(
    {
      zoom,
      cx: anchorX - (anchorX - view.cx) * (s0 / s1),
      cy: anchorY - (anchorY - view.cy) * (s0 / s1),
    },
    vp
  );
}

/** 拖动:手指在屏幕上挪了多少像素,镜头就反向挪多少场景单位 */
export function panView(view: View, dxPx: number, dyPx: number, vp: Viewport): View {
  const s = viewScale(vp, view.zoom);
  return clampView({ zoom: view.zoom, cx: view.cx - dxPx / s, cy: view.cy - dyPx / s }, vp);
}

/** 双指缩放:按两指间距的比例算新倍率 */
export function pinchZoom(startZoom: number, startDist: number, nowDist: number): number {
  if (!(startDist > 0) || !(nowDist > 0)) return clampZoom(startZoom);
  return clampZoom(startZoom * (nowDist / startDist));
}

// ---------------------------------------------------------------------------
// 四、望远镜提示
// ---------------------------------------------------------------------------

/** 每关能用几次望远镜 */
export const HINTS_PER_LEVEL = 2;

export const TELESCOPE_COLS = 3;
export const TELESCOPE_ROWS = 2;

export interface Region extends Rect {
  col: number;
  row: number;
  label: string;
}

const COL_WORDS = ["左边", "中间", "右边"];
const ROW_WORDS = ["上半", "下半"];

/** 目标落在哪一片:整张场景切成 3×2,望远镜只把范围缩到这一片,不点名目标本体 */
export function telescopeRegion(x: number, y: number): Region {
  const cw = SCENE_W / TELESCOPE_COLS;
  const rh = SCENE_H / TELESCOPE_ROWS;
  const col = Math.max(0, Math.min(TELESCOPE_COLS - 1, Math.floor(x / cw)));
  const row = Math.max(0, Math.min(TELESCOPE_ROWS - 1, Math.floor(y / rh)));
  return {
    col,
    row,
    left: col * cw,
    top: row * rh,
    right: (col + 1) * cw,
    bottom: (row + 1) * rh,
    label: `${COL_WORDS[col]}${ROW_WORDS[row]}那一片`,
  };
}

/** 望远镜的说明文字:只说范围,不说是哪个藏身点 */
export function hintText(region: Region): string {
  return `望远镜看到啦:它就在${region.label},再仔细找找看!`;
}

/** 把镜头对准某一片(倍率取「刚好装下这一片」,但不超过上限) */
export function telescopeView(region: Region, vp: Viewport): View {
  const fit = Math.min(vp.width / SCENE_W, vp.height / SCENE_H) || 1;
  const w = Math.max(1, region.right - region.left);
  const h = Math.max(1, region.bottom - region.top);
  const want = Math.min(vp.width / w, vp.height / h) / fit;
  return clampView(
    { zoom: clampZoom(want), cx: (region.left + region.right) / 2, cy: (region.top + region.bottom) / 2 },
    vp
  );
}

/** 还剩几次望远镜 */
export function hintsLeft(used: number): number {
  return Math.max(0, HINTS_PER_LEVEL - Math.max(0, Math.round(used)));
}

export function canUseHint(used: number): boolean {
  return hintsLeft(used) > 0;
}

/** 用过望远镜就封顶两星(不倒扣,已经拿到的一星二星照算) */
export function starsAfterHints(stars: 1 | 2 | 3, hintsUsed: number): 1 | 2 | 3 {
  if (hintsUsed > 0 && stars === 3) return 2;
  return stars;
}

// ---------------------------------------------------------------------------
// 五、清单栏
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  /** 藏身点下标 */
  spot: number;
  role: "alien" | "clue";
  name: string;
  found: boolean;
}

/** 清单栏要画的缩略图条目:找到过的打勾 */
export function checklistItems(
  targets: readonly { spot: number; role: "alien" | "clue"; name: string }[],
  found: ReadonlySet<number> | ReadonlyMap<number, number>
): ChecklistItem[] {
  return targets.map((t) => ({ ...t, found: found.has(t.spot) }));
}

/** 清单栏的无障碍读法 */
export function checklistLabel(item: ChecklistItem): string {
  return `${item.role === "alien" ? "外星朋友" : "线索物"}${item.name}${item.found ? ",已找到" : ",还没找到"}`;
}
