/**
 * 记忆翻翻乐 · 1.3 视觉层(第 21 步 C 档)。
 *
 * 只管「画成什么样」:配色板、动效时序、卡背纹样、图标后处理、翻回波浪时差。
 * 一行玩法判定都不在这儿——发牌 / 翻牌状态机 / 配对判定全在 `logic.ts`,本文件只 import 常量对表。
 * 全部纯函数 + 极窄的画布接口,单测拿假上下文就能逐笔验收。
 */
import { drawIcon, type Icon, type IconCtx, type Shape } from "./art";
import { shade as kitShade } from "../../art/kit/fruit";
import { traceStar } from "../../art/kit/sparkle";

// ---------------------------------------------------------------------------
// 一、配色板(四·补一规格表,一字不差)
// ---------------------------------------------------------------------------

export const MC_COLORS = {
  /** 卡背深色底(主题只换色相) */
  mcBackBase: "#4A3E78",
  /** 星月环形细线纹 */
  mcBackLine: "rgba(255,255,255,.35)",
  /** 1.5px 金描边 + 中心徽章 */
  mcBackGold: "#F0C25A",
  /** 卡面底 */
  mcFace: "#FFFDF6",
  /** 配对成功亮色收纳态 */
  mcMatchGlow: "rgba(255,214,120,.4)",
  /** 辅助提示柔光 */
  mcAssist: "rgba(159,217,139,.3)",
  /** 卡片软影 */
  mcShadow: "rgba(60,50,90,.18)",
} as const;

/**
 * 六套主题的卡背底色:与 `mcBackBase`(#4A3E78,HSL≈251°/32%/36%)同饱和同明度,
 * **只换色相**——纹样结构六套零变化,任何角度扫一眼都知道「这是记忆卡」。
 * 顺序跟 `packForTheme` 一样按 theme % 6 轮转。
 */
export const MC_BACK_BASES: readonly string[] = [
  "#795C3E", // 动物园 · 暖琥珀(H≈30°)
  "#793E4D", // 水果摊 · 深玫瑰(H≈345°)
  "#3E5779", // 交通工具 · 深海蓝(H≈215°)
  "#796A3E", // 乐器架 · 沉金(H≈45°)
  "#3E6A79", // 天气窗 · 墨青(H≈195°)
  "#4A3E78", // 朵朵一家 · 星夜紫(= mcBackBase)
];

export function backBaseForTheme(theme: number): string {
  const n = MC_BACK_BASES.length;
  const t = ((Math.floor(theme) % n) + n) % n;
  return MC_BACK_BASES[Math.max(0, t)];
}

/**
 * 把 #rrggbb 变深(amt<0)或提亮(amt>0);非 hex 原样返回,绝不抛错。
 * W7R2 N-4 收敛:混色引擎归一到 kit 单源(`art/kit/fruit.shade`,import 只读),
 * 本函数只保留「小数量纲 + 大写输出」的薄适配,行为与收敛前逐位一致
 * (visual21 用例钉死的 #C59C56 / #626272 等色值不变)。
 */
export function shade(hex: string, amt: number): string {
  const out = kitShade(hex, amt);
  return out === hex ? hex : out.toUpperCase();
}

// ---------------------------------------------------------------------------
// 二、动效时序(四·补三时序表;CSS 自定义属性从这里插值,一处定义两处同步)
// ---------------------------------------------------------------------------

export const MC_ANIM = {
  /** 3D 翻转 rotateY 时长 */
  flipMs: 180,
  /** reduced 淡入换面时长 */
  fadeMs: 120,
  /** 翻开瞬间上抬的距离 / 时长 */
  liftPx: 2,
  liftMs: 120,
  /** 配对成功两卡相互轻碰:各 3px 回弹 */
  bumpPx: 3,
  bumpMs: 200,
  /** 爱心星屑寿命 */
  sparkleMs: 320,
  /** 配对失败摇头:±3°(时序不变,只是表情) */
  shakeDeg: 3,
  shakeMs: 240,
  /** 记忆窗口呼吸边框周期 */
  breathMs: 1200,
  /** 集体翻回波浪:每卡交错 */
  waveStepMs: 30,
} as const;

/**
 * 翻回波浪的总交错上限:钉死 ≤ `coverDelayMs(2, false)`(既有窗口收尾 750ms),
 * 单测拿 logic 常量对表。波浪只是**视觉**上晚一点起翻,`startPlay` 解锁时机一毫秒不动。
 */
export const MC_WAVE_MAX_TOTAL_MS = 690;

/**
 * 第 slot 张卡在集体翻回时晚多少毫秒起翻。
 * 牌多就把步长压小,保证最后一张的交错 ≤ 上限;reduced 一律同步翻回(0ms)。
 */
export function waveDelayMs(slot: number, total: number, reduced: boolean): number {
  if (reduced || total <= 1) return 0;
  const step = Math.min(MC_ANIM.waveStepMs, Math.floor(MC_WAVE_MAX_TOTAL_MS / (total - 1)));
  const s = Math.max(0, Math.min(Math.floor(slot), total - 1));
  return s * step;
}

// ---------------------------------------------------------------------------
// 三、卡背纹样(深色底 → 环形细线两圈 → 星月点缀 → 中心双星徽章 → 四角圆花)
//     金描边 1.5px 走 CSS(inset box-shadow),不跟画布拉伸变粗细。
// ---------------------------------------------------------------------------

/** 环形细线两圈:直径分别是卡宽的 62% / 78% */
export const MC_BACK_RING_RATIOS = [0.62, 0.78] as const;
/** 卡片实宽低于这个就省略四角圆花,只留纹样 + 中心徽章 */
export const MC_CORNER_MIN_PX = 48;
/** 金描边粗细(px,CSS 侧使用) */
export const MC_BACK_GOLD_PX = 1.5;

/** 画卡背要用到的极窄画布接口(真 2D 上下文天然满足;加一个二次曲线给爱心用) */
export interface McCtx extends IconCtx {
  quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => void;
}

export interface CardBackSpec {
  /** 主题深色底(只换色相) */
  base: string;
  rings: readonly [number, number];
  /** 小卡(<48px)省略四角圆花 */
  corners: boolean;
  /** 槽位花纹号 0..3:只转星点相位,结构零变化——跟 1.2 一样只跟位置走,不泄底 */
  variant: number;
}

export function cardBackSpec(theme: number, cardWidthPx: number, variant = 0): CardBackSpec {
  return {
    base: backBaseForTheme(theme),
    rings: [MC_BACK_RING_RATIOS[0], MC_BACK_RING_RATIOS[1]],
    corners: cardWidthPx >= MC_CORNER_MIN_PX,
    variant: ((Math.floor(variant) % 4) + 4) % 4,
  };
}

/** 五角星路径(卡背徽章 / 收纳印花共用) */
export function traceStar5(ctx: IconCtx, x: number, y: number, r: number, rot = 0): void {
  const inner = r * 0.46;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : inner;
    const a = rot - Math.PI / 2 + (Math.PI * i) / 5;
    const px = x + rr * Math.cos(a);
    const py = y + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 四角圆花:五瓣白点围一颗金心 */
function paintRosette(ctx: McCtx, x: number, y: number, r: number): void {
  ctx.fillStyle = MC_COLORS.mcBackLine;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + r * 1.5 * Math.cos(a), y + r * 1.5 * Math.sin(a), r * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = MC_COLORS.mcBackGold;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 把整块卡背画进 w×h:主题只换 `spec.base` 底色,笔顺 / 笔数 / 纹样结构六套完全一致
 * (单测拿两套主题对照调用序断言)。
 */
export function paintCardBack(ctx: McCtx, w: number, h: number, spec: CardBackSpec): void {
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  // ① 深色底 + 上半一层极淡提亮(同色相,只做明度层次)
  ctx.fillStyle = spec.base;
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.beginPath();
  ctx.rect(0, 0, w, h * 0.5);
  ctx.fill();
  // ② 环形细线两圈(直径 62% / 78% 卡宽)
  ctx.strokeStyle = MC_COLORS.mcBackLine;
  ctx.lineWidth = 1.2;
  for (const ratio of spec.rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, (ratio * w) / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 外圈八颗小星点(variant 只转相位,结构不变——跟 1.2 一样只跟位置走)
  const dotR = (spec.rings[1] * w) / 2;
  ctx.fillStyle = MC_COLORS.mcBackLine;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + (spec.variant * Math.PI) / 16;
    ctx.beginPath();
    ctx.arc(cx + dotR * Math.cos(a), cy + dotR * Math.sin(a), 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 内圈左上一弯小月牙(「星月纹样」的月)
  const ringR = (spec.rings[0] * w) / 2;
  const moonR = w * 0.07;
  const mx = cx - ringR * 0.71;
  const my = cy - ringR * 0.71;
  ctx.fillStyle = MC_COLORS.mcBackLine;
  ctx.beginPath();
  ctx.arc(mx, my, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = spec.base;
  ctx.beginPath();
  ctx.arc(mx + moonR * 0.45, my - moonR * 0.2, moonR * 0.82, 0, Math.PI * 2);
  ctx.fill();
  // ③ 中心「朵朵星星」双星徽章:大星是朵朵,小星是星星,底色细描把两星分层
  ctx.fillStyle = MC_COLORS.mcBackGold;
  traceStar5(ctx, cx - w * 0.055, cy + h * 0.012, w * 0.16, 0);
  ctx.fill();
  traceStar5(ctx, cx + w * 0.12, cy - h * 0.055, w * 0.095, 0.35);
  ctx.fill();
  ctx.strokeStyle = spec.base;
  ctx.lineWidth = 1;
  traceStar5(ctx, cx + w * 0.12, cy - h * 0.055, w * 0.095, 0.35);
  ctx.stroke();
  // ④ 四角圆花角饰(小卡省略,徽章保留)
  if (spec.corners) {
    const ix = w * 0.13;
    const iy = w * 0.13;
    paintRosette(ctx, ix, iy, w * 0.045);
    paintRosette(ctx, w - ix, iy, w * 0.045);
    paintRosette(ctx, ix, h - iy, w * 0.045);
    paintRosette(ctx, w - ix, h - iy, w * 0.045);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 四、图标后处理:软影 → 逐 shape 描边(独立层) → 原 drawIcon(调用不变) → 高光
// ---------------------------------------------------------------------------

/** 图标绘制区统一占卡面画布的 64%(包围盒归一化后再画) */
export const MC_ICON_FILL_RATIO = 0.64;
/** 描边可见粗细(px):独立层实现,shape 数据一个数值不碰 */
export const MC_OUTLINE_PX = 1.5;
/** 描边取该 shape 自己的颜色压深 20% */
export const MC_OUTLINE_DARKEN = -0.2;
/** 左上高光小斑(图标宽 10%) */
export const MC_HIGHLIGHT = "rgba(255,255,255,.55)";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 一个形状占到的包围盒(圆弧按真正画出来的那一段采样,折线加上笔宽的余量) */
function shapeBounds(s: Shape): number[] {
  switch (s.t) {
    case "c":
      return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
    case "e":
      return [s.x - s.rx, s.y - s.ry, s.x + s.rx, s.y + s.ry];
    case "r":
      return [s.x, s.y, s.x + s.w, s.y + s.h];
    case "a": {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const half = s.w / 2;
      for (let k = 0; k <= 24; k++) {
        const a = s.from + ((s.to - s.from) * k) / 24;
        const px = s.x + (s.r + half) * Math.cos(a);
        const py = s.y + (s.r + half) * Math.sin(a);
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
      return [minX, minY, maxX, maxY];
    }
    case "l": {
      const xs = s.pts.filter((_, i) => i % 2 === 0);
      const ys = s.pts.filter((_, i) => i % 2 === 1);
      const half = s.w / 2;
      return [
        Math.min(...xs) - half,
        Math.min(...ys) - half,
        Math.max(...xs) + half,
        Math.max(...ys) + half,
      ];
    }
    default: {
      const xs = s.pts.filter((_, i) => i % 2 === 0);
      const ys = s.pts.filter((_, i) => i % 2 === 1);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
}

/** 整个图标在 0..100 图稿坐标里的包围盒 */
export function iconBounds(icon: Icon): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of icon.shapes) {
    const [x0, y0, x1, y1] = shapeBounds(s);
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

export interface IconLayout {
  /** 传给 drawIcon 的 size:0..100 图稿 × (effSize/100) = 画布像素 */
  effSize: number;
  /** 画之前 translate 的量(把包围盒摆到画布正中) */
  dx: number;
  dy: number;
  box: Bounds;
}

/** 包围盒归一化:不同图稿留白不一,统一缩放到画布的 64% 并居中 */
export function iconLayout(icon: Icon, size: number): IconLayout {
  const box = iconBounds(icon);
  const bw = Math.max(1, box.maxX - box.minX);
  const bh = Math.max(1, box.maxY - box.minY);
  const k = (size * MC_ICON_FILL_RATIO) / Math.max(bw, bh);
  const dx = (size - bw * k) / 2 - box.minX * k;
  const dy = (size - bh * k) / 2 - box.minY * k;
  return { effSize: k * 100, dx, dy, box };
}

/** 沿一个 shape 的轮廓走一遍路径(跟 drawIcon 同一套走法,但只描不填) */
function traceShape(ctx: IconCtx, s: Shape): void {
  ctx.beginPath();
  switch (s.t) {
    case "c":
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      break;
    case "e":
      ctx.ellipse(s.x, s.y, s.rx, s.ry, s.a ?? 0, 0, Math.PI * 2);
      break;
    case "r":
      if (ctx.roundRect) ctx.roundRect(s.x, s.y, s.w, s.h, s.rd ?? 0);
      else ctx.rect(s.x, s.y, s.w, s.h);
      break;
    case "p":
      for (let i = 0; i + 1 < s.pts.length; i += 2) {
        if (i === 0) ctx.moveTo(s.pts[0], s.pts[1]);
        else ctx.lineTo(s.pts[i], s.pts[i + 1]);
      }
      ctx.closePath();
      break;
    case "l":
      for (let i = 0; i + 1 < s.pts.length; i += 2) {
        if (i === 0) ctx.moveTo(s.pts[0], s.pts[1]);
        else ctx.lineTo(s.pts[i], s.pts[i + 1]);
      }
      break;
    default:
      ctx.arc(s.x, s.y, s.r, s.from, s.to);
      break;
  }
}

/**
 * 图标统一后处理(在 `drawIcon` 输出之上叠加,原调用一笔不改):
 * ① 底部软影椭圆(图标宽 70% × 高 12%) → ② 逐 shape 描边 1.5px(取本 shape 颜色压深 20%,
 * 独立层,画在填充下面) → ③ 原样调用 `drawIcon` → ④ 左上高光小斑(图标宽 10%)。
 */
export function drawIconDeluxe(ctx: IconCtx, icon: Icon, size: number): void {
  const layout = iconLayout(icon, size);
  const k = layout.effSize / 100;
  const bw = (layout.box.maxX - layout.box.minX) * k;
  const cx = layout.dx + ((layout.box.minX + layout.box.maxX) / 2) * k;
  const bottom = layout.dy + layout.box.maxY * k;

  // ① 底部软影(先落影,人后到)
  ctx.save();
  ctx.fillStyle = MC_COLORS.mcShadow;
  ctx.beginPath();
  ctx.ellipse(cx, Math.min(size - 2, bottom + bw * 0.04), bw * 0.35, Math.max(1.5, bw * 0.06), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ② 描边独立层:同一套路径描一圈深 20% 的边,shape 数据一个数值不碰
  ctx.save();
  ctx.translate(layout.dx, layout.dy);
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const rim = (MC_OUTLINE_PX * 2) / Math.max(0.01, k);
  for (const s of icon.shapes) {
    if (s.t === "l" || s.t === "a") {
      ctx.strokeStyle = shade(s.s, MC_OUTLINE_DARKEN);
      ctx.lineWidth = s.w + rim;
    } else {
      ctx.strokeStyle = shade(s.f, MC_OUTLINE_DARKEN);
      ctx.lineWidth = rim;
    }
    traceShape(ctx, s);
    ctx.stroke();
  }
  ctx.restore();

  // ③ 原图标:drawIcon 原样调用,内部笔顺一笔不变
  ctx.save();
  ctx.translate(layout.dx, layout.dy);
  drawIcon(ctx, icon, layout.effSize);
  ctx.restore();

  // ④ 左上高光小斑(图标宽 10%)
  ctx.save();
  ctx.fillStyle = MC_HIGHLIGHT;
  ctx.beginPath();
  ctx.ellipse(
    layout.dx + (layout.box.minX + (layout.box.maxX - layout.box.minX) * 0.24) * k,
    layout.dy + (layout.box.minY + (layout.box.maxY - layout.box.minY) * 0.16) * k,
    Math.max(1.5, bw * 0.05),
    Math.max(1, bw * 0.032),
    -0.5,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 五、配对成功的爱心 + 星屑(一次性小画布,CSS 负责 320ms 放大淡出)
// ---------------------------------------------------------------------------

/** 爱心用色(和收纳态一个暖调) */
export const MC_BURST_HEART = "#F58FB0";

/** 爱心路径(两瓣圆肩 + 尖底) */
export function traceHeart(ctx: McCtx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.quadraticCurveTo(x - r * 1.4, y + r * 0.1, x - r * 0.9, y - r * 0.5);
  ctx.quadraticCurveTo(x - r * 0.45, y - r * 1.05, x, y - r * 0.35);
  ctx.quadraticCurveTo(x + r * 0.45, y - r * 1.05, x + r * 0.9, y - r * 0.5);
  ctx.quadraticCurveTo(x + r * 1.4, y + r * 0.1, x, y + r);
  ctx.closePath();
}

/**
 * 两卡之间冒出的小爱心与四颗金星屑(星屑走 kit 公共件 `sparkle.traceStar`)。
 * reduced 一笔都不画——配对反馈由亮色收纳态兜底,不靠粒子。
 */
export function paintMatchBurst(ctx: McCtx, size: number, reduced: boolean): void {
  if (reduced) return;
  const c = size / 2;
  ctx.save();
  ctx.fillStyle = MC_BURST_HEART;
  traceHeart(ctx, c, c - size * 0.02, size * 0.18);
  ctx.fill();
  ctx.fillStyle = MC_COLORS.mcBackGold;
  const orbit = size * 0.34;
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * (2 * i + 1)) / 4;
    traceStar(
      ctx as unknown as CanvasRenderingContext2D,
      c + orbit * Math.cos(a),
      c + orbit * Math.sin(a),
      size * 0.09
    );
    ctx.fill();
  }
  ctx.restore();
}
