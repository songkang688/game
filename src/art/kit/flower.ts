/**
 * 共享美术套件 · 五瓣花（1.3 视觉升级 · 窗口8 A 档新增，独占文件，归 word-garden）。
 *
 * 参数化五瓣花 + 五帧展开：花瓣绕心均布（每瓣转 72°）、瓣尖圆润、瓣根收窄，
 * 花心圆 + 三点蕊。纯字符串 SVG、无 DOM、无计时器，node 环境可直接断言。
 * 展开帧按「瓣长 0.2 / 0.45 / 0.7 / 0.9 / 1.0 倍」定死，动画层照着这五帧走。
 */

/** 五帧展开的瓣长比例（缓出：前段跨得大、后段收得细） */
export const BLOOM_FRAMES = [0.2, 0.45, 0.7, 0.9, 1] as const;

/** 一朵花固定五瓣，每瓣转 72° */
export const PETAL_COUNT = 5;

/** 难度三色：粉 / 黄 / 紫（花心统一 #ffd93d，见 word-garden 规格 4.1） */
export const FLOWER_TRIO = ["#ffb3c1", "#ffe066", "#d0bfff"] as const;

/** 花心色（规格 token petalCore） */
export const FLOWER_CORE = "#ffd93d";

/**
 * 字的难度档位 → 三色下标：笔画少（≤2）走粉、中等（3-4）走黄、多（≥5）走紫。
 * 只是配色映射，跟判定与关卡数据无关。
 */
export function flowerTier(strokeCount: number): number {
  const n = Number.isFinite(strokeCount) ? strokeCount : 0;
  if (n <= 2) return 0;
  if (n <= 4) return 1;
  return 2;
}

/**
 * 同局相邻两朵不许撞色：想用的档位色跟上一朵一样时顺移一位。
 * `prev` 传上一朵的三色下标；第一朵传 -1。
 */
export function pickFlowerColorIndex(tier: number, prev: number): number {
  const want = ((Math.round(tier) % 3) + 3) % 3;
  return want === prev ? (want + 1) % 3 : want;
}

function n2(v: number): string {
  return (Object.is(v, -0) ? 0 : v).toFixed(2);
}

/**
 * 一片花瓣的路径：从花心出发，两段三次曲线兜出「瓣根收窄、瓣尖圆润」的轮廓。
 * `angleDeg` 是瓣尖朝向（0° 朝右、逆时针为负 y 向上的 SVG 屏幕系）；
 * `scale` 是展开比例（取 BLOOM_FRAMES 里的值做逐帧展开）。
 */
export function petalPath(cx: number, cy: number, r: number, angleDeg: number, scale: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const len = r * scale;
  const half = r * 0.42 * scale;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const px = -uy;
  const py = ux;
  const tipX = cx + ux * len;
  const tipY = cy + uy * len;
  // 瓣根两侧的控制点收窄（0.35），瓣尖两侧的控制点放宽（0.9）让尖头圆起来
  const c1x = cx + px * half * 0.35 + ux * len * 0.25;
  const c1y = cy + py * half * 0.35 + uy * len * 0.25;
  const c2x = tipX + px * half * 0.9 - ux * len * 0.25;
  const c2y = tipY + py * half * 0.9 - uy * len * 0.25;
  const c3x = tipX - px * half * 0.9 - ux * len * 0.25;
  const c3y = tipY - py * half * 0.9 - uy * len * 0.25;
  const c4x = cx - px * half * 0.35 + ux * len * 0.25;
  const c4y = cy - py * half * 0.35 + uy * len * 0.25;
  return (
    `M ${n2(cx)} ${n2(cy)} ` +
    `C ${n2(c1x)} ${n2(c1y)} ${n2(c2x)} ${n2(c2y)} ${n2(tipX)} ${n2(tipY)} ` +
    `C ${n2(c3x)} ${n2(c3y)} ${n2(c4x)} ${n2(c4y)} ${n2(cx)} ${n2(cy)} Z`
  );
}

export interface FlowerOpts {
  /** 花心位置（所在 SVG 的视口坐标） */
  cx: number;
  cy: number;
  /** 全开时的瓣长（视口单位） */
  r: number;
  /** 花瓣色 */
  petal: string;
  /** 花心色；不传用 FLOWER_CORE */
  core?: string;
  /** 展开帧下标 0-4（对应 BLOOM_FRAMES）；不传直接全开 */
  frame?: number;
  /** 附加 class（拼在 g 上） */
  className?: string;
}

/**
 * 一朵五瓣花：`<g>` 里从底到顶是五片花瓣 → 花心圆 → 三点蕊。
 * 同一组参数输出确定，逐帧字符串互不相同（有单测钉着）。
 */
export function flowerSvg(o: FlowerOpts): string {
  const frame = o.frame === undefined ? BLOOM_FRAMES.length - 1 : Math.max(0, Math.min(BLOOM_FRAMES.length - 1, Math.round(o.frame)));
  const scale = BLOOM_FRAMES[frame];
  const core = o.core ?? FLOWER_CORE;
  const cls = ["kit-flower", o.className].filter(Boolean).join(" ");
  const petals: string[] = [];
  for (let i = 0; i < PETAL_COUNT; i++) {
    const angle = -90 + i * (360 / PETAL_COUNT);
    petals.push(`<path d="${petalPath(o.cx, o.cy, o.r, angle, scale)}" fill="${o.petal}"/>`);
  }
  const coreR = o.r * 0.3 * (0.6 + 0.4 * scale);
  const dotR = Math.max(0.3, o.r * 0.07);
  const dots: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = ((-90 + i * 120) * Math.PI) / 180;
    const dx = o.cx + Math.cos(a) * coreR * 0.45;
    const dy = o.cy + Math.sin(a) * coreR * 0.45;
    dots.push(`<circle cx="${n2(dx)}" cy="${n2(dy)}" r="${n2(dotR)}" fill="#e8590c" opacity=".7"/>`);
  }
  return (
    `<g class="${cls}" data-frame="${frame}">` +
    petals.join("") +
    `<circle cx="${n2(o.cx)}" cy="${n2(o.cy)}" r="${n2(coreR)}" fill="${core}"/>` +
    dots.join("") +
    `</g>`
  );
}
