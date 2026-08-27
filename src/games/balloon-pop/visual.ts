/**
 * 气球砰砰 · 1.3 视觉层(A 档视觉升级)。
 *
 * 这里放的全是「怎么画」:--blp- 配色 token、三层渐变皮肤的取色、
 * 贝塞尔气球线、特殊气球(铁壳 / 双子 / 礼物)的本体差异件、
 * 爆炸三阶段时序、橡皮裂片参数、远近纵深与天空云层 / 夜关月亮星子。
 * 全部纯数据与纯函数,不碰 DOM;index.ts 只把这里算出来的字符串挂上去。
 *
 * 红线:这一层绝不读写上升速度 / 风力 AirCfg(只读方向做映射)、连锁规则、
 * 目标判定、dataset 状态镜像、aria-label 语义、关卡表与存档,一个数都不改。
 */
import { balloonSkin, balloonSkinLayers } from "../../art/kit/balloonSkin";
import { shade } from "../../art/kit/palette";
import type { BalloonKind } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色 token(四·补一规格表原样落成常量,动一个色值单测就红)
// ---------------------------------------------------------------------------

export const BLP_TOKENS = {
  "--blp-sky-top": "#DFF2FF",
  "--blp-sky-bottom": "#FFF4FA",
  "--blp-cloud": "rgba(255,255,255,.65)",
  "--blp-night-sky": "#2E2A55",
  "--blp-moon": "#FFF3C9",
} as const;

/** 夜关天空的收底色(与 --blp-night-sky 同族,渐变下摆) */
export const NIGHT_SKY_LOW = "#5A4E8C";

/** token 落成 CSS 自定义属性声明(铺在 .blp-wrap 上) */
export function tokensCss(): string {
  return Object.entries(BLP_TOKENS)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

/** 五色主色:key 与 1.2 完全一致(HUD 指令色 / 彩纸 / aria 名字都读它) */
export const BALLOON_COLORS = [
  { name: "红", key: "#F0605F" },
  { name: "黄", key: "#F5C142" },
  { name: "蓝", key: "#4F94E8" },
  { name: "绿", key: "#6BBB4E" },
  { name: "紫", key: "#9E6BD9" },
] as const;

/** 机关气球的代表色(气球结 / 裂片 / 皮肤主色用;色值与 1.2 的渐变收底色一致) */
export const KIND_KEYS: Partial<Record<BalloonKind, string>> = {
  cloud: "#9A9AAE",
  rainbow: "#9E6BD9",
  chain: "#F08C42",
  gift: "#E8A33D",
};

/** 这颗气球的主色(普通三兄弟按五色,机关球按代表色) */
export function balloonKey(kind: BalloonKind, colorIdx: number): string {
  return KIND_KEYS[kind] ?? BALLOON_COLORS[colorIdx].key;
}

/** 五色气球的三层渐变皮肤 */
export function colorSkin(colorIdx: number): string {
  return balloonSkin(BALLOON_COLORS[colorIdx].key);
}

/**
 * 机关气球的本体皮肤;普通 / 铁壳 / 双子返回 null(它们走五色皮肤,
 * 铁壳再由 ironSkin 叠条纹)。彩虹保留六色转轮,但顶上加同一枚主高光,
 * 保证「任何状态下不许出现平涂气球」对它也成立。
 */
export function kindSkin(kind: BalloonKind): string | null {
  if (kind === "rainbow") {
    const [hi] = balloonSkinLayers(KIND_KEYS.rainbow as string);
    return `${hi}, conic-gradient(#F0605F, #F5C142, #6BBB4E, #4F94E8, #9E6BD9, #F0605F)`;
  }
  const key = KIND_KEYS[kind];
  return key ? balloonSkin(key) : null;
}

/** 气球结的颜色 = 主色压暗一档(和主体收边同档) */
export function knotColor(base: string): string {
  return shade(base, -12);
}

// ---------------------------------------------------------------------------
// 二、贝塞尔气球线(读既有风向只做映射,一个逻辑数都不改)
// ---------------------------------------------------------------------------

/** 控制点 x 偏移 = 风向常量 × 6px */
export const STRING_WIND_BEND_PX = 6;
/** 无风也有一点垂坠弧,不回到 1.2 的死直线 */
export const STRING_SLACK_PX = 2;
/** 气球线画布尺寸(px) */
export const STRING_W = 12;
export const STRING_H = 16;

/** windDir ∈ {-1, 0, 1}:风向 × 6px;无风给 2px 垂坠 */
export function stringControlOffsetPx(windDir: number): number {
  return windDir === 0 ? STRING_SLACK_PX : windDir * STRING_WIND_BEND_PX;
}

/** 二次贝塞尔垂坠弧的 path d */
export function stringPathD(windDir: number): string {
  const midX = STRING_W / 2 + stringControlOffsetPx(windDir);
  return `M${STRING_W / 2} 0 Q${midX} ${STRING_H / 2} ${STRING_W / 2} ${STRING_H}`;
}

/** 内联 SVG 气球线(挂在气球底缘下方) */
export function stringSvg(windDir: number): string {
  return (
    `<svg class="blp-string" width="${STRING_W}" height="${STRING_H}" viewBox="0 0 ${STRING_W} ${STRING_H}" aria-hidden="true">` +
    `<path d="${stringPathD(windDir)}" fill="none" stroke="rgba(120,100,90,.55)" stroke-width="1.5" stroke-linecap="round"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 三、特殊气球本体差异(颜色 + 图案双通道,光圈另有 box-shadow 保留)
// ---------------------------------------------------------------------------

/** 装饰件最小可见尺寸:far 缩放后低于 8px 的铆钉 / 蝴蝶结自动省略 */
export const MIN_DECOR_PX = 8;
/** 铆钉直径(近景) */
export const RIVET_PX = 8;
/** 蝴蝶结直径(近景) */
export const BOW_PX = 8;
/** 铁壳纵纹条宽 */
export const IRON_STRIPE_PX = 3;
/** 双子副球缩放(主球 100%) */
export const TWIN_BUDDY_SCALE = 0.82;
/** 礼盒尺寸 */
export const GIFT_BOX_W = 12;
export const GIFT_BOX_H = 10;

/** 这个装饰件在当前缩放下画不画(低于 8px 省略) */
export function decorVisible(basePx: number, scale = 1): boolean {
  return basePx * scale >= MIN_DECOR_PX;
}

/**
 * 铁壳气球皮肤:金属灰纵纹(3px 条宽)+ 铆钉两点(深灰圆 + 白高光点)
 * 叠在五色三层皮肤上;far 缩放下铆钉低于 8px 自动省略。
 */
export function ironSkin(base: string, scale = 1): string {
  const rivet = (x: number, y: number): string =>
    `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,.9) 0 1px, #5B6472 1.4px 3px, rgba(91,100,114,0) 4px)`;
  const rivets = decorVisible(RIVET_PX, scale) ? [rivet(34, 60), rivet(66, 60)] : [];
  const stripes = `repeating-linear-gradient(90deg, rgba(122,130,144,.28) 0 ${IRON_STRIPE_PX}px, rgba(255,255,255,0) ${IRON_STRIPE_PX}px ${IRON_STRIPE_PX * 2}px)`;
  return [...rivets, stripes, ...balloonSkinLayers(base)].join(", ");
}

/** 双子连结丝带:一条弧线,近景再加蝴蝶结小结(far 低于 8px 省略) */
export function twinRibbonSvg(base: string, scale = 1): string {
  const tone = shade(base, -18);
  const bow = decorVisible(BOW_PX, scale)
    ? `<circle cx="18" cy="6" r="2.4" fill="${tone}"/><path d="M15 4 L18 6 L15 8 Z" fill="${tone}"/><path d="M21 4 L18 6 L21 8 Z" fill="${tone}"/>`
    : "";
  return (
    `<svg class="blp-ribbon" width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">` +
    `<path d="M2 10 Q12 0 22 10" fill="none" stroke="${tone}" stroke-width="1.6" stroke-linecap="round"/>${bow}` +
    `</svg>`
  );
}

/** 礼物气球下挂的小礼盒:盒体主色 + 缎带十字,近景加顶部蝴蝶结 */
export function giftBoxSvg(scale = 1): string {
  const body = KIND_KEYS.gift as string;
  const ribbon = "#E85D8A";
  const bow = decorVisible(BOW_PX, scale)
    ? `<path d="M4 1.5 Q6 -0.5 6 2 Q6 -0.5 8 1.5 Q7 2.6 6 2.4 Q5 2.6 4 1.5 Z" fill="${ribbon}"/>`
    : "";
  return (
    `<svg class="blp-giftbox" width="${GIFT_BOX_W}" height="${GIFT_BOX_H + 2}" viewBox="0 0 ${GIFT_BOX_W} ${GIFT_BOX_H + 2}" aria-hidden="true">` +
    `<rect x="0" y="2" width="${GIFT_BOX_W}" height="${GIFT_BOX_H}" rx="2" fill="${body}" stroke="${shade(body, -20)}" stroke-width="0.6"/>` +
    `<rect x="${GIFT_BOX_W / 2 - 1}" y="2" width="2" height="${GIFT_BOX_H}" fill="${ribbon}"/>` +
    `<rect x="0" y="${2 + GIFT_BOX_H / 2 - 1}" width="${GIFT_BOX_W}" height="2" fill="${ribbon}"/>${bow}` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 三·补、特殊球徽记(W6R1-12 修复):替代 1.2 贴在球面上的 emoji 小图标
// ---------------------------------------------------------------------------

/** 徽记基准尺寸(近景 12px;far 0.72 缩到 8.6px,仍在 8px 最小可见线上) */
export const KIND_BADGE_PX = 12;
/** 徽记描边宽(球主色压暗 30%) */
export const KIND_BADGE_STROKE = 1.2;
/** 徽记底形白色(与数字衬牌同族,压住球面渐变保可读) */
export const KIND_BADGE_FILL = "rgba(255,255,255,.92)";

/**
 * 特殊球身份徽记:12px 白底形 + 1.2px 主色描边的内联 SVG。
 * 形状语言(全几何原创,涂黑仍认得):护盾=盾形五边、双子=双圆相扣、
 * 礼物=礼盒加十字缎带、连锁=三连小圆、乌云=三弧云朵、彩虹=三色拱弧。
 * 挂点沿用 LABEL_TOP_PCT=55(躲开 22% 高度的主高光);低于 8px 自动省略。
 * 普通五色球没有徽记(身份=颜色,不加噪)。
 */
export function kindBadgeSvg(kind: BalloonKind, colorIdx: number, scale = 1): string {
  if (!decorVisible(KIND_BADGE_PX, scale)) return "";
  const tone = shade(balloonKey(kind, colorIdx), -30);
  const fill = KIND_BADGE_FILL;
  const sw = KIND_BADGE_STROKE;
  const round = `stroke-linejoin="round" stroke-linecap="round"`;
  const shapes: Partial<Record<BalloonKind, string>> = {
    iron:
      `<path d="M6 1.4 L10.2 3 V6.2 Q10.2 9.3 6 10.9 Q1.8 9.3 1.8 6.2 V3 Z" fill="${fill}" stroke="${tone}" stroke-width="${sw}" ${round}/>` +
      `<path d="M6 3.4 V8.8 M3.6 6.1 H8.4" stroke="${tone}" stroke-width="${sw}" ${round}/>`,
    twin:
      `<circle cx="4.3" cy="6" r="2.6" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>` +
      `<circle cx="7.7" cy="6" r="2.6" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>`,
    gift:
      `<rect x="2.6" y="4.6" width="6.8" height="5.2" rx="1" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>` +
      `<rect x="2" y="2.8" width="8" height="2" rx=".9" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>` +
      `<path d="M6 2.8 V9.8" stroke="${tone}" stroke-width="${sw}" ${round}/>`,
    chain:
      `<circle cx="2.9" cy="6" r="1.9" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>` +
      `<circle cx="6" cy="6" r="1.9" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>` +
      `<circle cx="9.1" cy="6" r="1.9" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>`,
    cloud:
      `<path d="M3.2 8.6 Q1.5 8.6 1.5 7.1 Q1.5 5.7 2.9 5.6 Q3.1 3.6 5.2 3.6 Q6.9 3.6 7.3 5 Q8 4.6 8.9 5.1 Q10.5 5.3 10.5 6.9 Q10.5 8.6 8.9 8.6 Z" fill="${fill}" stroke="${tone}" stroke-width="${sw}" ${round}/>`,
    rainbow:
      `<circle cx="6" cy="6" r="5" fill="${fill}" stroke="${tone}" stroke-width="${sw}"/>` +
      `<path d="M2.9 8.3 A3.1 3.1 0 0 1 9.1 8.3" fill="none" stroke="#F0605F" stroke-width="${sw}" ${round}/>` +
      `<path d="M4.2 8.3 A1.8 1.8 0 0 1 7.8 8.3" fill="none" stroke="#F5C142" stroke-width="${sw}" ${round}/>` +
      `<path d="M5.4 8.3 A0.6 0.6 0 0 1 6.6 8.3" fill="none" stroke="#4F94E8" stroke-width="${sw}" ${round}/>`,
  };
  const body = shapes[kind];
  if (!body) return "";
  const size = Math.round(KIND_BADGE_PX * scale);
  return (
    `<svg class="blp-kbadge" width="${size}" height="${size}" viewBox="0 0 ${KIND_BADGE_PX} ${KIND_BADGE_PX}" aria-hidden="true">` +
    body +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 四、动效时序表(四·补二;CSS 里全部写成自定义属性)
// ---------------------------------------------------------------------------

export const BLP_TIMINGS = {
  /** 爆炸鼓胀:1.15 倍,ease-out;reduced 直接进入消失 */
  swellMs: 60,
  /** 白闪一帧:step;reduced 也保留(功能反馈) */
  flashMs: 16,
  /** 橡皮裂片:放射旋转渐隐,ease-out;reduced 不生成 */
  shardMs: 320,
  /** 礼盒缓落:ease-in;reduced 立即落定 */
  giftDropMs: 500,
  /** 礼盒常驻摆动 ±3°:sin 往复;reduced 静止 */
  giftSwayMs: 1100,
  /** 软云慢层平移(0.1× 视差) */
  cloudSlowMs: 52000,
  /** 软云快层平移(0.2× 视差,速度是慢层两倍) */
  cloudFastMs: 26000,
} as const;

/** 爆炸鼓胀的峰值倍率 */
export const SWELL_SCALE = 1.15;
/** 礼盒摆动幅度(度) */
export const GIFT_SWAY_DEG = 3;
/** 两层软云的视差档 */
export const CLOUD_PARALLAX = [0.1, 0.2] as const;

/** 爆炸三阶段总时长(鼓胀 + 白闪 + 裂片),预算 ≤ 400ms 不拖连点节奏 */
export function burstTotalMs(): number {
  return BLP_TIMINGS.swellMs + BLP_TIMINGS.flashMs + BLP_TIMINGS.shardMs;
}

/** 动效时长落成 CSS 自定义属性声明(铺在 .blp-wrap 上) */
export function timingsCss(): string {
  return (
    `--blp-swell-ms: ${BLP_TIMINGS.swellMs}ms; ` +
    `--blp-flash-ms: ${BLP_TIMINGS.flashMs}ms; ` +
    `--blp-shard-ms: ${BLP_TIMINGS.shardMs}ms; ` +
    `--blp-gift-drop-ms: ${BLP_TIMINGS.giftDropMs}ms; ` +
    `--blp-gift-sway-ms: ${BLP_TIMINGS.giftSwayMs}ms; ` +
    `--blp-cloud-slow-ms: ${BLP_TIMINGS.cloudSlowMs}ms; ` +
    `--blp-cloud-fast-ms: ${BLP_TIMINGS.cloudFastMs}ms;`
  );
}

// ---------------------------------------------------------------------------
// 五、橡皮裂片(同色小月牙,放射抛物线 + 旋转)
// ---------------------------------------------------------------------------

/** 裂片数量:5 片;reduced 下 0 片 */
export const SHARD_COUNT = 5;

export function shardCount(reduced: boolean): number {
  return reduced ? 0 : SHARD_COUNT;
}

export interface ShardVec {
  dx: number;
  dy: number;
  rot: number;
}

/** 5 片等分圆周起跳,终点带一截下坠(抛物线感),奇偶反向旋转 */
export function shardVectors(n = SHARD_COUNT): ShardVec[] {
  const out: ShardVec[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
    const dist = 38 + (i % 2) * 10;
    out.push({
      dx: Math.round(Math.cos(a) * dist),
      dy: Math.round(Math.sin(a) * dist + 18),
      rot: (i % 2 === 0 ? 1 : -1) * (120 + i * 20),
    });
  }
  return out;
}

/** 彩纸升级:星星 / 圆点混合,星星用的五角 clip-path */
export const STAR_CLIP =
  "polygon(50% 0%, 63% 34%, 98% 38%, 72% 62%, 80% 96%, 50% 76%, 20% 96%, 28% 62%, 2% 38%, 37% 34%)";

// ---------------------------------------------------------------------------
// 六、远近纵深与天空装饰
// ---------------------------------------------------------------------------

/** 远景气球加一点 blur(视觉纵深;逻辑速度一个数不改) */
export const FAR_BLUR_PX = 0.6;
/** 远景摆动幅度 = 近景 60%(只乘在渲染的 marginLeft 上) */
export const FAR_SWAY_RATIO = 0.6;

/** 夜关星子的固定位置(百分比;避开顶部 HUD 与月亮) */
export const NIGHT_STARS: ReadonlyArray<readonly [number, number]> = [
  [10, 22],
  [26, 9],
  [44, 26],
  [58, 12],
  [72, 30],
  [90, 20],
];

/** 天空装饰层:两层软云;夜里再加月亮与星子。纯字符串,index 只负责挂 */
export function skyDecorHtml(night: boolean): string {
  const clouds = `<i class="blp-cloudpuff blp-cloud-a"></i><i class="blp-cloudpuff blp-cloud-b"></i>`;
  if (!night) return clouds;
  const stars = NIGHT_STARS.map(([x, y]) => `<i class="blp-starlet" style="left:${x}%; top:${y}%"></i>`).join("");
  return `${clouds}<i class="blp-moon"></i>${stars}`;
}

/** 白天天空(读 token) */
export const SKY_DAY = "linear-gradient(180deg, var(--blp-sky-top), var(--blp-sky-bottom))";
/** 夜关天空(读 token) */
export const SKY_NIGHT = `linear-gradient(180deg, var(--blp-night-sky), ${NIGHT_SKY_LOW})`;

// ---------------------------------------------------------------------------
// 七、数字 / 算式衬牌(文字躲开主高光)
// ---------------------------------------------------------------------------

/** 衬牌垂直位置:主高光在 22% 高度,文字放到 55% 高度处 */
export const LABEL_TOP_PCT = 55;
/** 白底圆角衬牌不透明度 */
export const LABEL_PLATE_ALPHA = 0.82;
