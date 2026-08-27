/**
 * 1.3 共享美术套件 · 六剪影水果（本文件归第 20 步 A 档 fruit-catch 所有，
 * B 档 fruit-slice 只 import 不修改；剪影函数签名 ctx/x/y/r/kind 定了就不改）。
 *
 * 每种水果五道工序（见 plan-1.3-step20-A 四·补二）：
 *  1. 落影小椭圆（drawFruitShadow，下落中不画、着地弹跳帧才画）；
 *  2. 专属剪影路径（fruitOutline：心形圆 / 月牙 / 六球簇 / 正圆 / 倒水滴 / 葫芦形）；
 *  3. 三停径向渐变（主色 +18% 高光偏左上 → 主体 → 边缘 -14%）；
 *  4. 细节层：叶 / 褐点 / 藤须 / 皮孔点阵 / 籽点 / 蒂叶（直径 < 18px 省略本层）；
 *  5. 1.5px 描边 + 左上高光斑一粒。
 *
 * 全部程序化矢量绘制：零位图、零运行时依赖；光源统一左上 45°。
 */

export const FRUIT_KINDS = ["apple", "banana", "grape", "orange", "strawberry", "pear"] as const;
export type FruitKitKind = (typeof FRUIT_KINDS)[number];

/** 六种水果主色（apple/banana/grape 与 step 文档四·补一的 fc* token 逐字一致） */
export const FRUIT_MAIN: Readonly<Record<FruitKitKind, string>> = {
  apple: "#F06B6B",
  banana: "#F5D442",
  grape: "#9F7AD8",
  orange: "#F7A94B",
  strawberry: "#F2647E",
  pear: "#B9D96C"
};

/** 渲染直径低于这个像素数就省略细节层（皮孔 / 籽点 / 藤须等） */
export const FRUIT_DETAIL_MIN_PX = 18;
/** 统一描边宽度 */
export const FRUIT_OUTLINE_PX = 1.5;
/** 三停径向渐变的三个 stop：高光 +18%、主体、边缘 -14% */
export const FRUIT_GRADIENT_STOPS = [0.18, 0, -0.14] as const;
/** 统一落影色（与 fruit-catch 的 fcShadow 一致） */
export const FRUIT_SHADOW_COLOR = "rgba(90,74,60,.16)";

/**
 * 给合法 #rrggbb 推导明暗：amount 取 -1..1，正往白走、负往黑走。
 * 非法输入原样返回、不抛异常。
 */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m || !Number.isFinite(amount)) return hex;
  const n = parseInt(m[1], 16);
  const mix = (v: number): number => {
    const target = amount >= 0 ? 255 : 0;
    const k = Math.min(1, Math.abs(amount));
    return Math.round(v + (target - v) * k);
  };
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export interface FruitPoint {
  x: number;
  y: number;
}

/** 两个角度的最短角距 */
function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** 上下不对称的「宽度剖面」采样：右侧从顶到底，再左侧从底回顶 */
function lobeOutline(r: number, widthOf: (v: number) => number, steps: number): FruitPoint[] {
  const half = Math.max(6, Math.floor(steps / 2));
  const pts: FruitPoint[] = [];
  for (let i = 0; i <= half; i++) {
    const v = -1 + (2 * i) / half;
    pts.push({ x: widthOf(v) * r, y: v * r });
  }
  for (let i = half - 1; i >= 1; i--) {
    const v = -1 + (2 * i) / half;
    pts.push({ x: -widthOf(v) * r, y: v * r });
  }
  return pts;
}

/** 葡萄六球簇的球心与半径（相对 r） */
export function grapeBerries(r: number): Array<{ x: number; y: number; r: number }> {
  return [
    { x: -0.5 * r, y: -0.38 * r, r: 0.4 * r },
    { x: 0, y: -0.44 * r, r: 0.42 * r },
    { x: 0.5 * r, y: -0.38 * r, r: 0.4 * r },
    { x: -0.27 * r, y: 0.12 * r, r: 0.41 * r },
    { x: 0.27 * r, y: 0.12 * r, r: 0.41 * r },
    { x: 0, y: 0.58 * r, r: 0.4 * r }
  ];
}

/**
 * 六种剪影的外轮廓采样（中心 0,0、y 向下、大小 r）。
 * 这是「剪影层面互不相同」的单一事实来源：绘制与测试都吃它。
 */
export function fruitOutline(kind: FruitKitKind, r: number, steps = 40): FruitPoint[] {
  if (!Number.isFinite(r) || r <= 0) return [];
  if (kind === "orange") {
    // 正圆：细节靠脐点与皮孔点阵
    const pts: FruitPoint[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }
  if (kind === "apple") {
    // 心形圆：顶部凹陷 + 双肩微鼓 + 底部小凹
    const pts: FruitPoint[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const dTop = angDist(a, -Math.PI / 2);
      const dBot = angDist(a, Math.PI / 2);
      const rho =
        r *
        (0.94 +
          0.06 * Math.cos(2 * (a + Math.PI / 2)) -
          0.26 * Math.exp(-((dTop / 0.4) ** 2)) -
          0.05 * Math.exp(-((dBot / 0.28) ** 2)));
      pts.push({ x: Math.cos(a) * rho, y: Math.sin(a) * rho * 0.96 });
    }
    return pts;
  }
  if (kind === "banana") {
    // 月牙弯：外弧鼓、内弧收，两端收尖
    const cy = -0.55 * r;
    const rOut = 1.18 * r;
    const rInMid = 0.68 * r;
    const a0 = 0.42;
    const a1 = Math.PI - 0.42;
    const half = Math.max(6, Math.floor(steps / 2));
    const pts: FruitPoint[] = [];
    for (let i = 0; i <= half; i++) {
      const a = a0 + ((a1 - a0) * i) / half;
      pts.push({ x: Math.cos(a) * rOut, y: cy + Math.sin(a) * rOut });
    }
    for (let i = half; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / half;
      const taper = Math.sin(((a - a0) / (a1 - a0)) * Math.PI);
      const rIn = rOut - (rOut - rInMid) * taper;
      pts.push({ x: Math.cos(a) * rIn, y: cy + Math.sin(a) * rIn });
    }
    return pts;
  }
  if (kind === "grape") {
    // 六球簇的并集轮廓：沿每个方向取「射线打到最远球面」的距离
    const berries = grapeBerries(r);
    const pts: FruitPoint[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      let best = 0.3 * r;
      for (const b of berries) {
        const t = ux * b.x + uy * b.y;
        const disc = t * t - (b.x * b.x + b.y * b.y - b.r * b.r);
        if (disc >= 0) best = Math.max(best, t + Math.sqrt(disc));
      }
      pts.push({ x: ux * best, y: uy * best });
    }
    return pts;
  }
  if (kind === "strawberry") {
    // 倒水滴：顶宽、往下收成圆尖
    return lobeOutline(r, (v) => {
      const base = Math.sqrt(Math.max(0, 1 - v * v));
      return base * (0.95 - 0.38 * Math.max(0, v));
    }, steps);
  }
  // pear：上窄下宽的葫芦形（脖颈细、下腹鼓）
  return lobeOutline(r, (v) => {
    const base = Math.sqrt(Math.max(0, 1 - v * v));
    const k = (v + 1) / 2;
    return base * (0.5 + 0.42 * k * k + 0.1 * k);
  }, steps);
}

/** 把采样轮廓铺成一条闭合路径 */
function tracePath(ctx: CanvasRenderingContext2D, pts: readonly FruitPoint[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** 三停径向渐变皮：高光偏左上（光源左上 45°） */
function skinGradient(
  ctx: CanvasRenderingContext2D,
  r: number,
  base: string
): CanvasGradient {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.12, 0, 0, r * 1.15);
  g.addColorStop(0, shade(base, FRUIT_GRADIENT_STOPS[0]));
  g.addColorStop(0.55, shade(base, FRUIT_GRADIENT_STOPS[1]));
  g.addColorStop(1, shade(base, FRUIT_GRADIENT_STOPS[2]));
  return g;
}

/** 左上高光斑一粒 */
function highlightDab(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();
}

const LEAF_GREEN = "#7BC47F";
const STEM_BROWN = "#8A6A3F";

/** 小叶片（蒂叶 / 苹果叶共用） */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = LEAF_GREEN;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 各水果的细节层（直径 < FRUIT_DETAIL_MIN_PX 时被 drawKitFruit 跳过） */
function detailLayer(ctx: CanvasRenderingContext2D, kind: FruitKitKind, r: number, base: string): void {
  const dark = shade(base, -0.3);
  if (kind === "apple") {
    ctx.strokeStyle = STEM_BROWN;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.lineTo(0, -r * 1.02);
    ctx.stroke();
    leaf(ctx, r * 0.3, -r * 0.92, r * 0.3, -Math.PI / 6);
  } else if (kind === "banana") {
    // 两端褐点 + 一条纵脊线
    ctx.fillStyle = "#8A6A3F";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * Math.cos(0.42) * 1.14 * r, -0.55 * r + Math.sin(0.42) * 1.14 * r, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = shade(base, -0.18);
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, -0.55 * r, 0.93 * r, 0.65, Math.PI - 0.65);
    ctx.stroke();
  } else if (kind === "grape") {
    // 藤须：一小段卷曲
    ctx.strokeStyle = LEAF_GREEN;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.82);
    ctx.quadraticCurveTo(r * 0.24, -r * 1.06, r * 0.42, -r * 0.9);
    ctx.stroke();
    // 球与球的分界高光
    ctx.fillStyle = "rgba(255,255,255,.22)";
    for (const b of grapeBerries(r)) {
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "orange") {
    // 脐点 + 皮孔点阵
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, -r * 0.86, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    for (const [px, py] of [[-0.42, -0.1], [0.12, -0.4], [0.4, 0.16], [-0.14, 0.36], [0.02, -0.02], [-0.3, 0.28]] as const) {
      ctx.beginPath();
      ctx.arc(px * r, py * r, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "strawberry") {
    // 籽点 + 蒂叶
    ctx.fillStyle = "rgba(255,244,214,.85)";
    for (const [px, py] of [[-0.4, -0.28], [0, -0.34], [0.4, -0.28], [-0.26, 0.1], [0.26, 0.1], [0, 0.44]] as const) {
      ctx.beginPath();
      ctx.ellipse(px * r, py * r, r * 0.06, r * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [lx, rot] of [[-0.3, Math.PI / 4], [0, 0], [0.3, -Math.PI / 4]] as const) {
      leaf(ctx, lx * r, -r * 0.92, r * 0.26, rot + Math.PI / 2);
    }
  } else {
    // pear：短梗 + 两粒雀斑
    ctx.strokeStyle = STEM_BROWN;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(r * 0.12, -r * 1.12);
    ctx.stroke();
    ctx.fillStyle = dark;
    for (const [px, py] of [[-0.2, 0.32], [0.26, 0.44]] as const) {
      ctx.beginPath();
      ctx.arc(px * r, py * r, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    leaf(ctx, -r * 0.2, -r * 1.0, r * 0.26, Math.PI / 7);
  }
}

export interface KitFruitOpts {
  /** 慢旋弧度（reduced-motion 时调用方传 0） */
  rot?: number;
  /** 覆盖主色（主题换色只换皮，不换剪影） */
  color?: string;
  /** 强制开 / 关细节层；不传则按 r*2 >= FRUIT_DETAIL_MIN_PX 自动判断 */
  detail?: boolean;
  /** 整体透明度（落空渐隐用） */
  alpha?: number;
}

/**
 * 画一颗自绘水果（中心 x,y、大小 r、种类 kind）。
 * 签名 ctx/x/y/r/kind 是 B 档 fruit-slice 的对齐基准，定了就不改。
 */
export function drawKitFruit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  kind: FruitKitKind,
  opts: KitFruitOpts = {}
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  const base = opts.color && /^#([0-9a-fA-F]{6})$/.test(opts.color) ? opts.color : FRUIT_MAIN[kind];
  const detailOn = opts.detail ?? r * 2 >= FRUIT_DETAIL_MIN_PX;
  ctx.save();
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, opts.alpha));

  if (kind === "grape") {
    // 六球簇逐球上皮，比并集轮廓更有体积
    const berries = grapeBerries(r);
    for (const b of berries) {
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.12, b.x, b.y, b.r * 1.1);
      g.addColorStop(0, shade(base, FRUIT_GRADIENT_STOPS[0]));
      g.addColorStop(0.55, base);
      g.addColorStop(1, shade(base, FRUIT_GRADIENT_STOPS[2]));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(base, -0.34);
      ctx.lineWidth = FRUIT_OUTLINE_PX;
      ctx.stroke();
    }
  } else {
    const pts = fruitOutline(kind, r);
    tracePath(ctx, pts);
    ctx.fillStyle = skinGradient(ctx, r, base);
    ctx.fill();
    ctx.strokeStyle = shade(base, -0.34);
    ctx.lineWidth = FRUIT_OUTLINE_PX;
    ctx.stroke();
  }

  if (detailOn) detailLayer(ctx, kind, r, base);
  highlightDab(ctx, -r * 0.38, -r * 0.44, r * 0.2, r * 0.13);
  ctx.restore();
}

/** 落影小椭圆：下落中不画，着地弹跳帧才画 */
export function drawFruitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string = FRUIT_SHADOW_COLOR
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.05, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
