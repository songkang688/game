/**
 * 共享美术套件 · 拼图场景画(1.3 窗口 7 R1 修复,C 档为 `puzzle-tiles` 首建,归 C 档所有)。
 *
 * 解决 A 档严重项「拼的是 emoji 不是画」:每套主题生成一张参数化 SVG 场景画,
 * 牌面内容 = 这张画按行列切出来的**图案切片**,emoji 降级为关卡数据里的主题钥匙,
 * 不再上屏。全部纯字符串、零位图、零运行时依赖:
 *  - 场景构图三层:① 底色 2 停线性渐变(上亮下沉)→ ② 3–5 个几何主体
 *    (光斑圆盘 + 远近两条山丘/波浪/尖峰带,全部 2 停渐变 + 1.5px 描边)→
 *    ③ 每格一枚贴纸小纹样(四角星/花瓣/水滴/圆环/三角,一格一枚保证切片互不撞脸)
 *    + 一圈边饰圆点;
 *  - 光源统一左上 45°:圆盘径向渐变心在 (.35,.35),高光小椭圆偏左上;
 *  - 同样入参永远同一字符串(内置确定性 PRNG),每一笔可被单测钉死;
 *  - 干扰块(托盘 decoy,块号 ≥ 行×列)用「同主题换色 alt 场景」的切片——
 *    看着像同一族画稿、又对不上真图,替代原来的陌生 emoji。
 *
 * 造型红线:全部几何原创构图,无任何官方角色/商标剪影(无多尖塔对称城堡、
 * 无影视角色轮廓);构图只有圆、带、星、瓣、滴、环、三角七种原语。
 */
import { shade } from "./fruit";

/** 场景画里一格的边长(viewBox 单位):切片视窗按它换算 */
export const PATTERN_CELL = 24;

/** 场景元素统一描边(1.5px,vector-effect 钉住屏幕像素) */
export const PATTERN_STROKE = "rgba(90,74,110,.35)";

type MotifKind = "petal" | "star" | "drop" | "ring" | "tri";
type BandKind = "hill" | "wave" | "peak";

interface ThemeSpec {
  /** 天空(底色)渐变:上亮下沉 */
  sky: [string, string];
  /** 远带 / 近带渐变 */
  far: [string, string];
  near: [string, string];
  /** 光斑圆盘(太阳 / 月亮 / 气球)渐变 */
  disc: [string, string];
  /** 贴纸三色轮换 */
  stickers: [string, string, string];
  motif: MotifKind;
  band: BandKind;
}

/** 十套主题,与 THEME_TILES 的十套图库一一对应(粉彩同族,互不撞色) */
const THEMES: readonly ThemeSpec[] = [
  // 0 花园
  { sky: ["#FFF8E6", "#FFE9F2"], far: ["#D9EFC8", "#C4E5B2"], near: ["#A8DDA0", "#8FCE86"], disc: ["#FFF1BD", "#FFD86E"], stickers: ["#FF9EC7", "#FFD86E", "#B7A3E8"], motif: "petal", band: "hill" },
  // 1 动物牧场
  { sky: ["#FFF3D8", "#FFE4C8"], far: ["#EBDCC2", "#DECBA8"], near: ["#CBB289", "#B89B6E"], disc: ["#FFF6C4", "#FFDF8E"], stickers: ["#E8A46B", "#A8DDA0", "#F4859F"], motif: "ring", band: "hill" },
  // 2 交通小城
  { sky: ["#E2F0FB", "#CDE4F6"], far: ["#E5E9EE", "#D0D8E2"], near: ["#B6C3D4", "#9DADC4"], disc: ["#FFF6C4", "#FFE9A0"], stickers: ["#F4859F", "#FFD86E", "#7FC8E8"], motif: "tri", band: "peak" },
  // 3 果园野餐
  { sky: ["#FFF9E0", "#FFEFC8"], far: ["#E1F3D2", "#CBE8B4"], near: ["#FFDDE4", "#FFC9D4"], disc: ["#FFE2CE", "#FFC29E"], stickers: ["#F4859F", "#FFD86E", "#A8DDA0"], motif: "drop", band: "wave" },
  // 4 星夜天象
  { sky: ["#DCE9FF", "#C2D3F2"], far: ["#B7C9EC", "#9EB3E2"], near: ["#8FA4D8", "#7A90CC"], disc: ["#FFF6D8", "#FFE9A8"], stickers: ["#FFFFFF", "#FFE9A8", "#C9D3DE"], motif: "star", band: "wave" },
  // 5 派对广场
  { sky: ["#FFE9F2", "#F3E1F8"], far: ["#FFD9E8", "#FFC2D9"], near: ["#E0D3F5", "#CCBCEE"], disc: ["#FFC2D9", "#FF9EC7"], stickers: ["#FFD86E", "#7FC8E8", "#F4859F"], motif: "tri", band: "wave" },
  // 6 山水画卷
  { sky: ["#F5EEDF", "#EAE0CD"], far: ["#CBDAC6", "#B6CBB0"], near: ["#93AC8E", "#7E9878"], disc: ["#FFF1BD", "#F5DE9A"], stickers: ["#A8BCA2", "#D8C9A8", "#8FA98A"], motif: "drop", band: "peak" },
  // 7 风车花田
  { sky: ["#DDF2F8", "#C9E8F2"], far: ["#D3EDC2", "#BCE3AC"], near: ["#FBF0C0", "#EFE1A0"], disc: ["#FFE9A8", "#FFD86E"], stickers: ["#F4859F", "#7FC8E8", "#FFD86E"], motif: "tri", band: "hill" },
  // 8 甜点铺子
  { sky: ["#FBEBD8", "#F8DFC8"], far: ["#FFE1E8", "#FFD0DC"], near: ["#F3E1F8", "#E5CCF0"], disc: ["#FFF6C4", "#FFE9A0"], stickers: ["#F4859F", "#C99B6E", "#FFD86E"], motif: "ring", band: "wave" },
  // 9 艺术长廊
  { sky: ["#F1E2FA", "#E4D3F5"], far: ["#E5EEFB", "#D3E2F6"], near: ["#FFE4E9", "#FFD0DA"], disc: ["#FFF3D8", "#FFE6A8"], stickers: ["#8E86E0", "#F4859F", "#FFD86E"], motif: "star", band: "wave" },
];

/** 主题号安全归一:超界回落到 0(与 THEME_TILES 的兜底口径一致,id/种子/色板全跟着落) */
function normTheme(theme: number): number {
  return THEMES[theme] ? theme : 0;
}

/** alt(干扰)配色:天空压暗、远近带互换、贴纸轮换一位——像同族的另一张画稿 */
function altSpec(spec: ThemeSpec): ThemeSpec {
  return {
    sky: [shade(spec.sky[0], -0.08), shade(spec.sky[1], -0.16)],
    far: spec.near,
    near: spec.far,
    disc: [spec.disc[1], spec.disc[0]],
    stickers: [spec.stickers[1], spec.stickers[2], spec.stickers[0]],
    motif: spec.motif,
    band: spec.band,
  };
}

/** mulberry32:确定性 PRNG,同种子同序列 */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (v: number): string => String(Number(v.toFixed(1)));

/** 场景 <g> 的引用 id(切片 <use> 按它找画) */
export function patternSceneId(theme: number, rows: number, cols: number, alt = false): string {
  return `pzp-t${normTheme(theme)}-${rows}x${cols}${alt ? "-alt" : ""}`;
}

/** 一条横贯全宽的地形带:hill 圆丘 / wave 波浪 / peak 尖峰,收口填到画底 */
function bandPath(kind: BandKind, W: number, H: number, y: number, amp: number, bumps: number, rnd: () => number): string {
  const step = W / Math.max(1, bumps);
  let d = `M0 ${f1(y)}`;
  for (let i = 0; i < bumps; i++) {
    const x = i * step;
    const a = amp * (0.7 + rnd() * 0.6);
    if (kind === "hill") d += `Q${f1(x + step / 2)} ${f1(y - a)} ${f1(x + step)} ${f1(y)}`;
    else if (kind === "wave") d += `Q${f1(x + step / 2)} ${f1(i % 2 === 0 ? y - a : y + a * 0.7)} ${f1(x + step)} ${f1(y)}`;
    else d += `L${f1(x + step / 2)} ${f1(y - a)}L${f1(x + step)} ${f1(y)}`;
  }
  return `${d}L${f1(W)} ${f1(H)}L0 ${f1(H)}Z`;
}

/** 贴纸纹样:一格一枚,五种原语,统一细描边 + 确定性抖动 */
function motifSvg(kind: MotifKind, x: number, y: number, s: number, fill: string): string {
  const edge = `stroke="rgba(90,74,110,.3)" stroke-width="1" vector-effect="non-scaling-stroke"`;
  if (kind === "star") {
    const w = s * 0.32;
    const d =
      `M${f1(x)} ${f1(y - s)}Q${f1(x + w)} ${f1(y - w)} ${f1(x + s)} ${f1(y)}` +
      `Q${f1(x + w)} ${f1(y + w)} ${f1(x)} ${f1(y + s)}` +
      `Q${f1(x - w)} ${f1(y + w)} ${f1(x - s)} ${f1(y)}` +
      `Q${f1(x - w)} ${f1(y - w)} ${f1(x)} ${f1(y - s)}Z`;
    return `<path d="${d}" fill="${fill}" ${edge}/>`;
  }
  if (kind === "petal") {
    let out = "";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      out += `<circle cx="${f1(x + Math.cos(a) * s * 0.62)}" cy="${f1(y + Math.sin(a) * s * 0.62)}" r="${f1(s * 0.42)}" fill="${fill}" ${edge}/>`;
    }
    return `${out}<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.34)}" fill="#FFF6D8"/>`;
  }
  if (kind === "drop") {
    const d =
      `M${f1(x)} ${f1(y - s)}Q${f1(x + s * 0.95)} ${f1(y + s * 0.15)} ${f1(x)} ${f1(y + s)}` +
      `Q${f1(x - s * 0.95)} ${f1(y + s * 0.15)} ${f1(x)} ${f1(y - s)}Z`;
    return `<path d="${d}" fill="${fill}" ${edge}/>`;
  }
  if (kind === "ring") {
    return (
      `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.72)}" fill="none" stroke="${fill}" stroke-width="${f1(s * 0.5)}"/>` +
      `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.16)}" fill="${fill}"/>`
    );
  }
  const d = `M${f1(x)} ${f1(y - s)}L${f1(x + s * 0.9)} ${f1(y + s * 0.72)}L${f1(x - s * 0.9)} ${f1(y + s * 0.72)}Z`;
  return `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="1.2" stroke-linejoin="round"/>`;
}

/**
 * 一张场景画的 <g>(裸元素,由 patternDefsSvg 收进 <defs>):
 * 底色渐变 → 光斑圆盘(径向心 .35/.35 = 左上光源)→ 远带 → 近带 →
 * 每格贴纸 → 一圈边饰圆点。全确定性。
 */
function sceneGroup(theme: number, rows: number, cols: number, alt: boolean): string {
  const tn = normTheme(theme);
  const id = patternSceneId(tn, rows, cols, alt);
  const spec = alt ? altSpec(THEMES[tn]) : THEMES[tn];
  const W = cols * PATTERN_CELL;
  const H = rows * PATTERN_CELL;
  const rnd = mulberry(tn * 97 + rows * 13 + cols * 7 + (alt ? 5 : 0) + 11);
  const edge = `stroke="${PATTERN_STROKE}" stroke-width="1.5" vector-effect="non-scaling-stroke"`;

  const defs =
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${spec.sky[0]}"/><stop offset="1" stop-color="${spec.sky[1]}"/></linearGradient>` +
    `<radialGradient id="${id}-disc" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="${spec.disc[0]}"/><stop offset="1" stop-color="${spec.disc[1]}"/></radialGradient>` +
    `<linearGradient id="${id}-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${spec.far[0]}"/><stop offset="1" stop-color="${spec.far[1]}"/></linearGradient>` +
    `<linearGradient id="${id}-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${spec.near[0]}"/><stop offset="1" stop-color="${spec.near[1]}"/></linearGradient>`;

  // 光斑圆盘:上半区,带描边 + 左上高光小椭圆
  const dx = (0.22 + rnd() * 0.56) * W;
  const dy = (0.16 + rnd() * 0.14) * H;
  const dr = PATTERN_CELL * (0.5 + rnd() * 0.2);
  const disc =
    `<circle cx="${f1(dx)}" cy="${f1(dy)}" r="${f1(dr)}" fill="url(#${id}-disc)" ${edge}/>` +
    `<ellipse cx="${f1(dx - dr * 0.3)}" cy="${f1(dy - dr * 0.32)}" rx="${f1(dr * 0.3)}" ry="${f1(dr * 0.2)}" fill="#FFFFFF" opacity=".6"/>`;

  const farBand = `<path d="${bandPath(spec.band, W, H, H * 0.52, PATTERN_CELL * 0.42, Math.max(2, cols), rnd)}" fill="url(#${id}-far)" ${edge}/>`;
  const nearBand = `<path d="${bandPath(spec.band, W, H, H * 0.74, PATTERN_CELL * 0.5, Math.max(2, cols - 1), rnd)}" fill="url(#${id}-near)" ${edge}/>`;

  // 每格一枚贴纸:位置抖动 ±,颜色三色轮换——保证任意两块切片不撞脸
  let stickers = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.3 + rnd() * 0.4) * PATTERN_CELL;
      const y = (r + 0.3 + rnd() * 0.4) * PATTERN_CELL;
      const s = PATTERN_CELL * (0.16 + rnd() * 0.08);
      stickers += motifSvg(spec.motif, x, y, s, spec.stickers[(r * cols + c) % 3]);
    }
  }

  // 一圈边饰圆点(画框内衬),给边缘切片添识别点
  let border = "";
  for (let c = 0; c < cols; c++) {
    const cx = f1((c + 0.5) * PATTERN_CELL);
    border += `<circle cx="${cx}" cy="2" r="1.5" fill="${spec.stickers[c % 3]}" opacity=".55"/>`;
    border += `<circle cx="${cx}" cy="${f1(H - 2)}" r="1.5" fill="${spec.stickers[(c + 1) % 3]}" opacity=".55"/>`;
  }
  for (let r = 0; r < rows; r++) {
    const cy = f1((r + 0.5) * PATTERN_CELL);
    border += `<circle cx="2" cy="${cy}" r="1.5" fill="${spec.stickers[r % 3]}" opacity=".55"/>`;
    border += `<circle cx="${f1(W - 2)}" cy="${cy}" r="1.5" fill="${spec.stickers[(r + 2) % 3]}" opacity=".55"/>`;
  }

  return (
    `<g id="${id}">${defs}` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-sky)"/>` +
    disc + farBand + nearBand + stickers + border +
    `</g>`
  );
}

/**
 * 一块画板的场景库(藏在 0×0 SVG 的 <defs> 里,不占布局):
 * 正图 + alt 干扰图各一张,切片全靠 <use> 引用,整板只存一份画。
 */
export function patternDefsSvg(theme: number, rows: number, cols: number): string {
  return (
    `<svg class="pzv-scenedefs" width="0" height="0" aria-hidden="true" focusable="false">` +
    `<defs>${sceneGroup(theme, rows, cols, false)}${sceneGroup(theme, rows, cols, true)}</defs></svg>`
  );
}

/** 块号 → 切片视窗:块号 ≥ 行×列的是托盘干扰块,取 alt 场景的对应格 */
function slicePos(rows: number, cols: number, home: number): { r: number; c: number; alt: boolean } {
  const total = rows * cols;
  const alt = home >= total;
  const pos = alt ? home % total : home;
  return { r: Math.floor(pos / cols), c: pos % cols, alt };
}

/**
 * 方形切片(预览小样 / 底图虚影用):viewBox 直接裁场景画的这一格。
 * CSS 给 .pzv-slice 撑满容器即可,16px 的预览格也照裁不误。
 */
export function patternSliceSvg(theme: number, rows: number, cols: number, home: number): string {
  const p = slicePos(rows, cols, home);
  return (
    `<svg class="pzv-slice" viewBox="${p.c * PATTERN_CELL} ${p.r * PATTERN_CELL} ${PATTERN_CELL} ${PATTERN_CELL}" ` +
    `preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<use href="#${patternSceneId(theme, rows, cols, p.alt)}"/></svg>`
  );
}

/**
 * 嵌进齿边皮肤的切片(由 pieceSkinSvg 用齿形路径裁剪):
 * 视窗四周各多裁 overhangU(= 齿形半径换算成画面单位),凸齿上也有画,拼合无缝。
 * x/y/w/h 是皮肤坐标系里的落位(像素)。
 */
export function patternSliceNestedSvg(
  theme: number,
  rows: number,
  cols: number,
  home: number,
  x: number,
  y: number,
  w: number,
  h: number,
  overhangU: number
): string {
  const p = slicePos(rows, cols, home);
  const vb =
    `${f1(p.c * PATTERN_CELL - overhangU)} ${f1(p.r * PATTERN_CELL - overhangU)} ` +
    `${f1(PATTERN_CELL + 2 * overhangU)} ${f1(PATTERN_CELL + 2 * overhangU)}`;
  return (
    `<svg class="pzv-slice" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" viewBox="${vb}" ` +
    `preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<use href="#${patternSceneId(theme, rows, cols, p.alt)}"/></svg>`
  );
}
