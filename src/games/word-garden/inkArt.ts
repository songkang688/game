/**
 * 识字小花园 1.3 · 视觉胶水层（窗口8 A 档新增，纯视觉，不碰判定）。
 *
 * 这里只放「画出来长什么样」的纯函数：宣纸米字格的 SVG、笔顺预演的取点、
 * 花园横条的数据映射。**笔顺数据与描红判定一个字节都不经过这里**——
 * `previewPath` 原样返回笔顺数据的点集（单测逐点钉死），谁也别想在预演里
 * 画出一条跟教材不一样的笔。
 */
import { flowerTier, pickFlowerColorIndex } from "../../art/kit/flower";
import { GRID, type Point, type Stroke, type StrokeChar } from "./strokes";

/** 规格 4.1 配色板：写字台专用 token */
export const WG_TOKENS = {
  /** 宣纸底色 */
  paperWarm: "#fdf6e9",
  /** 米字格外框红 */
  gridRed: "#d94f4f",
  /** 米字虚线淡红 */
  gridRedFaint: "rgba(217,79,79,.35)",
  /** 已写完笔画墨色 */
  inkDone: "#3a3a4a",
  /** 当前笔画亮色 */
  inkActive: "#ff8c42",
  /** 笔顺预演箭头与呼吸点 */
  guideBlue: "#6db3f2",
  /** 花瓣粉 */
  petalPink: "#ffb3c1",
  /** 花心黄 */
  petalCore: "#ffd93d",
  /** 花园横条草地 */
  gardenGreen: "#b8e986",
  /** 部件木质字卡 */
  woodCard: "#d9a066",
} as const;

/** 毛笔基准宽（米字格坐标系；判定容差与这个数无关） */
export const INK_BASE_W = 7;

/** 理想笔画重采样步长（只影响渲染平滑度） */
export const INK_RESAMPLE_STEP = 4;

/** 预演箭头的本地坐标（朝 +x，配合 translate+rotate 用） */
export const ARROW_POINTS = "0,-3.2 7.2,0 0,3.2";

/**
 * 笔顺预演走的路径 = 笔顺数据的路径，原样返回、逐点相等（教育正确性红线，
 * 单测钉死）。预演箭头只沿这条线走，绝不自创新路。
 */
export function previewPath(stroke: Stroke): readonly Point[] {
  return stroke.points;
}

/** 呼吸点的位置 = 当前笔画的起笔点（同样原样取数据） */
export function guideDotAt(stroke: Stroke): Point {
  return stroke.points[0];
}

/** 二次缓入缓出（预演箭头 600ms 用的曲线） */
export function easeInOutQuad(k: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 0));
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
}

/**
 * 沿折线按弧长取点：`t ∈ [0,1]`，返回位置与该处切向角度（度）。
 * t=0 恰是起笔点、t=1 恰是收笔点（单测钉着）。
 */
export function pointAlong(points: readonly Point[], t: number): { x: number; y: number; angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0][0], y: points[0][1], angle: 0 };
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const len = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
    lens.push(len);
    total += len;
  }
  const k = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  let target = k * total;
  for (let i = 0; i < lens.length; i++) {
    const seg = lens[i];
    if (target <= seg || i === lens.length - 1) {
      const r = seg === 0 ? 0 : Math.max(0, Math.min(1, target / seg));
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      return {
        x: ax + (bx - ax) * r,
        y: ay + (by - ay) * r,
        angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI,
      };
    }
    target -= seg;
  }
  const last = points[points.length - 1];
  return { x: last[0], y: last[1], angle: 0 };
}

/**
 * 宣纸米字格（一整段 SVG 字符串，调用方 innerHTML 即用）：
 * 暖白渐变纸底（顶亮底暗）+ 三处极淡纤维噪点 + 红色圆角外框（粗 2）
 * + 米字虚线（1px 十字与对角）。全部走 wgd- 类名，颜色见 WG_TOKENS。
 */
export function paperGridSvg(): string {
  const g = GRID;
  const m = g / 2;
  return (
    `<defs><linearGradient id="wgdPaperGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fffbf2"/>` +
    `<stop offset=".55" stop-color="${WG_TOKENS.paperWarm}"/>` +
    `<stop offset="1" stop-color="#f5efe2"/>` +
    `</linearGradient></defs>` +
    `<rect x="1.5" y="1.5" width="${g - 3}" height="${g - 3}" rx="7" fill="url(#wgdPaperGrad)"/>` +
    `<path d="M 16 24 q 7 -3 13 1" class="wgd-fiber"/>` +
    `<path d="M 70 78 q 8 2 12 -3" class="wgd-fiber"/>` +
    `<path d="M 30 62 q 5 3 11 0" class="wgd-fiber"/>` +
    `<rect x="2" y="2" width="${g - 4}" height="${g - 4}" rx="6" class="wgd-grid-edge"/>` +
    `<line x1="2" y1="${m}" x2="${g - 2}" y2="${m}" class="wgd-grid-line"/>` +
    `<line x1="${m}" y1="2" x2="${m}" y2="${g - 2}" class="wgd-grid-line"/>` +
    `<line x1="2" y1="2" x2="${g - 2}" y2="${g - 2}" class="wgd-grid-line"/>` +
    `<line x1="${g - 2}" y1="2" x2="2" y2="${g - 2}" class="wgd-grid-line"/>`
  );
}

/** 花园横条的繁茂档：没开花是空地，开了就发芽，全开成花丛 */
export function gardenStage(bloomed: number, total: number): "soil" | "sprout" | "meadow" {
  const n = Math.max(0, bloomed);
  if (n === 0) return "soil";
  if (n < total) return "sprout";
  return "meadow";
}

/** 花园小字卡上的原文：该字 + 拼音（教育断言钉着「字一个不许错」） */
export function gardenCardLabel(char: string, pinyin: string): string {
  return `${char}（${pinyin}）`;
}

export interface GardenFlower {
  char: string;
  pinyin: string;
  /** 三色下标（粉 / 黄 / 紫），按字的笔画档位映射、相邻不撞色 */
  colorIndex: number;
}

/**
 * 本局写过的字 → 花园里的花：写成几个字就有几朵（0/3/全部映射单测钉着），
 * 花色按笔画档位取三色、相邻两朵不同色。只读 chars，不改任何数据。
 */
export function gardenFlowers(chars: readonly StrokeChar[], bloomed: number): GardenFlower[] {
  const n = Math.max(0, Math.min(bloomed, chars.length));
  const out: GardenFlower[] = [];
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const c = chars[i];
    const idx = pickFlowerColorIndex(flowerTier(c.strokes.length), prev);
    out.push({ char: c.char, pinyin: c.pinyin, colorIndex: idx });
    prev = idx;
  }
  return out;
}
