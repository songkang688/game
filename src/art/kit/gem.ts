/**
 * 共享美术套件 · 宝石表面（1.3 视觉升级 · 窗口8 第 25 步 B 档新增）。
 *
 * 约定：一个文件只归一个人，这一份归 shape-kingdom（B 档）。
 * 全部是纯函数 + 常量，node 环境可测，不碰 DOM、不带运行时依赖。
 *
 * 「四色平涂 → 宝石质感」的工序单（对应绘制规格 4.2）：
 *  ① 表面：形状原轮廓内填三停线性渐变（135°，受光在左上）——轮廓零改动，只换填充；
 *  ② 切面高光：中央偏左上一枚小三角（白 35% 透明度，尺寸 = 块宽 22%）；
 *  ③ 描边：1.5px 同色系最深色 + 底部 2px 暗边条（2.5D 厚度）——
 *     两样都走 box-shadow inset，原来的 border 盒子几何一个像素不动；
 *  ④ 小格降级：格宽 < 32px 省略切面三角，保留渐变 + 描边（360px 规则）。
 */

/** 宝石三停渐变（受光 → 本色 → 暗部），下标即 p0–p3 */
export const GEM_STOPS: readonly (readonly [string, string, string])[] = [
  /** gemRed（p0） */
  ["#ff6b6b", "#e14b4b", "#b93a3a"],
  /** gemBlue（p1） */
  ["#5b9bff", "#3d78e0", "#2c5cb8"],
  /** gemGreen（p2） */
  ["#7bc86c", "#569a48", "#3f7a34"],
  /** gemYellow（p3） */
  ["#ffd93d", "#f4a83a", "#d18a2a"],
] as const;

/** 一共几种宝石色（拼骨牌的 piece % GEM_COUNT 用它取模） */
export const GEM_COUNT = GEM_STOPS.length;

/** 切面高光的透明度（白 35%） */
export const GEM_FACET_ALPHA = 0.35;
/** 切面高光的尺寸 = 块宽的 22% */
export const GEM_FACET_RATIO = 0.22;
/** 格宽低于这个像素就省略切面三角（保留渐变 + 描边） */
export const GEM_FACET_MIN_PX = 32;
/** 描边粗细（走 box-shadow inset，不占盒子） */
export const GEM_EDGE_PX = 1.5;
/** 底部暗边条厚度（2.5D 厚度，同样走 box-shadow inset） */
export const GEM_BOTTOM_PX = 2;

function stopsAt(index: number): readonly [string, string, string] {
  const n = GEM_STOPS.length;
  const i = Number.isFinite(index) ? Math.abs(Math.trunc(index)) % n : 0;
  return GEM_STOPS[i];
}

/** 第 index 色的三停渐变（135°，受光在左上） */
export function gemGradient(index: number): string {
  const [light, mid, dark] = stopsAt(index);
  return `linear-gradient(135deg,${light} 0%,${mid} 55%,${dark} 100%)`;
}

/** 第 index 色的描边色 = 该色系最深一停 */
export function gemEdge(index: number): string {
  return stopsAt(index)[2];
}

/** 第 index 色的本色（做骨牌架小剪影这类实心填充用） */
export function gemBody(index: number): string {
  return stopsAt(index)[1];
}

/** 这个格宽要不要画切面三角（360px 小格降级的判据） */
export function gemFacetVisible(cellPx: number): boolean {
  return Number.isFinite(cellPx) && cellPx >= GEM_FACET_MIN_PX;
}

/** 切面三角的边长（像素，= 块宽 22%，四舍五入） */
export function gemFacetSize(cellPx: number): number {
  return Math.max(0, Math.round((Number.isFinite(cellPx) ? cellPx : 0) * GEM_FACET_RATIO));
}

/**
 * 宝石格的通用 CSS。`prefix` 用调用方自己的样式前缀（形状王国传 "shk"）。
 * 生成的类：
 *  - `.{p}-gem-p0..3`：三停渐变 + 1.5px 最深色描边 + 底部 2px 暗边（全走 inset
 *    box-shadow，原 border 几何零改动，判定格与热区一个像素不动）；
 *  - `::after` 切面高光三角（clip-path 三角，白 35%，pointer-events 天生跟随宿主，
 *    尺寸用块宽 22% 的百分比写死，格子多大三角就多大）；
 *  - `.{p}-gem-small` 挂在棋盘上：小格降级，切面三角整块不画。
 */
export function gemCellCss(prefix: string): string {
  const p = prefix.replace(/[^a-z-]/gi, "");
  const per = GEM_STOPS.map((stops, i) => {
    const dark = stops[2];
    return `.${p}-gem-p${i}{background:${gemGradient(i)};border-color:${dark};
  box-shadow:inset 0 0 0 ${GEM_EDGE_PX}px ${dark},inset 0 -${GEM_BOTTOM_PX}px 0 ${dark};}`;
  }).join("\n");
  const pct = Math.round(GEM_FACET_RATIO * 100);
  return `
${per}
.${p}-gem-p0::after,.${p}-gem-p1::after,.${p}-gem-p2::after,.${p}-gem-p3::after{
  content:"";position:absolute;left:24%;top:18%;width:${pct}%;height:${pct}%;
  background:rgba(255,255,255,${GEM_FACET_ALPHA});
  clip-path:polygon(0 0,100% 0,0 100%);pointer-events:none;}
.${p}-gem-small .${p}-gem-p0::after,.${p}-gem-small .${p}-gem-p1::after,
.${p}-gem-small .${p}-gem-p2::after,.${p}-gem-small .${p}-gem-p3::after{content:none;}
`;
}
