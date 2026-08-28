// 果果合成 · 1.3 视觉资产库(只管画,不碰玩法数值)。
//
// 三件事:
//  1. `paintFruit`:11 级果子各自的纹理 + 统一的脸(微笑 / 担忧),全部矢量绘制,原创造型;
//  2. `fruitSprite`:把果卡预渲染成 offscreen 贴图并缓存 —— 11 种果 × 60fps 不许逐帧画纹理,
//     主画布只 `drawImage`,合并动画的缩放直接缩放贴图;
//  3. `createFx`:合并爆汁的果汁粒子(对象池 ≤ JUICE_MAX)、升级扩散环、金星、飘字与顶级震屏,
//     `reduced` 为真时一颗粒子都不出,全部效果静默跳过。
//
// 依赖只有同目录 `merge.ts` 的 CHAIN(半径与配色是玩法字段,这里只读不写)。
import { CHAIN, TOP_LEVEL } from "./merge";

/** 脸的两种状态:平时眯眼微笑;堆到警戒线附近全体睁眼担忧 */
export type Face = "smile" | "worry";

/** 贴图半边长 = 半径 × 它:叶子和蒂探出果身,得多留一圈 */
export const SPRITE_PAD = 1.5;

/** 五官与描边的墨色 */
export const FACE_INK = "#6b4148";

/** 每一级果子的提亮色与纹理色(主体色/描边色在 CHAIN 里,那是玩法字段) */
export interface FruitStyle {
  /** 径向渐变左上提亮色 */
  hi: string;
  /** 纹理主色(条纹 / 籽点 / 网纹) */
  detail: string;
}

/** 下标即等级:籽 莓 柑 桃 梨 苹 橙 柚 瓜 玉瓜 团圆瓜 */
export const FRUIT_STYLE: readonly FruitStyle[] = [
  { hi: "#f2d9b8", detail: "#a97e52" },
  { hi: "#ffb3c6", detail: "#ffe9c9" },
  { hi: "#ffd399", detail: "#e08f38" },
  { hi: "#ffd2d8", detail: "#e87e92" },
  { hi: "#e7f2b6", detail: "#a9c063" },
  { hi: "#ff9d94", detail: "#d14e4e" },
  { hi: "#ffc276", detail: "#ffdcae" },
  { hi: "#fbe79a", detail: "#fdf2c4" },
  { hi: "#bce7c2", detail: "#e6f6df" },
  { hi: "#cdf0dd", detail: "#5f9a7e" },
  { hi: "#a4dc93", detail: "#3f8a44" },
];

function clampLevel(level: number): number {
  const v = Math.round(level);
  return v < 0 ? 0 : v > TOP_LEVEL ? TOP_LEVEL : v;
}

/** 极小的确定性伪随机:同一个种子永远给同一串,贴图与网纹才可复现、可断言 */
function makeRand(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 果卡绘制(中心在原点,半径 r)
// ---------------------------------------------------------------------------

/** 把后续绘制夹进果身圆里(网纹 / 条纹不许探出果皮) */
function clipBody(g: CanvasRenderingContext2D, r: number, fn: () => void): void {
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();
  fn();
  g.restore();
}

/** 统一叶梗:一根短梗加一片叶(沿用 1.2 的原创规格) */
function paintStemLeaf(g: CanvasRenderingContext2D, r: number): void {
  g.strokeStyle = "#6ea86b";
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.moveTo(0, -r);
  g.lineTo(0, -r * 1.24);
  g.stroke();
  g.fillStyle = "#8fc98a";
  g.beginPath();
  g.ellipse(r * 0.24, -r * 1.18, r * 0.26, r * 0.14, -0.5, 0, Math.PI * 2);
  g.fill();
}

/** 统一的脸:微笑是两条眯眼弧 + 上弯嘴 + 腮红;担忧是两点眼 + 皱眉 + 小圆嘴 */
function paintFace(g: CanvasRenderingContext2D, r: number, face: Face): void {
  const lw = Math.max(1, r * 0.07);
  g.strokeStyle = FACE_INK;
  g.fillStyle = FACE_INK;
  g.lineWidth = lw;
  g.lineCap = "round";
  if (face === "smile") {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(side * r * 0.3, r * 0.02, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, r * 0.16, r * 0.16, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  } else {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(side * r * 0.28, r * 0.02, Math.max(0.8, r * 0.075), 0, Math.PI * 2);
      g.fill();
      // 皱眉:眉头朝中间压下来
      g.beginPath();
      g.moveTo(side * r * 0.42, -r * 0.22);
      g.lineTo(side * r * 0.16, -r * 0.12);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, r * 0.26, Math.max(0.8, r * 0.09), 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = face === "smile" ? "rgba(255,122,148,.4)" : "rgba(255,122,148,.24)";
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * r * 0.5, r * 0.14, r * 0.14, r * 0.085, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** 每一级的专属纹理:必须一眼认出这一级是什么果 */
function paintTexture(g: CanvasRenderingContext2D, level: number, r: number): void {
  const st = FRUIT_STYLE[level];
  const rand = makeRand(level + 11);
  switch (level) {
    case 0: {
      // 籽:淡色种皮竖椭圆 + 两道弧纹,顶上还有一片对生的小子叶
      clipBody(g, r, () => {
        g.fillStyle = "rgba(255,248,235,.3)";
        g.beginPath();
        g.ellipse(0, r * 0.05, r * 0.55, r * 0.75, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = st.detail;
        g.lineWidth = Math.max(1, r * 0.06);
        for (const k of [-0.35, 0.4]) {
          g.beginPath();
          g.arc(r * k, r * 0.1, r * 0.55, Math.PI * 1.25, Math.PI * 1.7);
          g.stroke();
        }
      });
      g.fillStyle = "#a5d69b";
      g.beginPath();
      g.ellipse(-r * 0.3, -r * 1.12, r * 0.22, r * 0.12, 0.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 1: {
      // 莓:奶黄小籽点撒一圈 + 顶部三片绿萼
      g.fillStyle = st.detail;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rand() * 0.5;
        const d = r * (0.32 + rand() * 0.4);
        g.beginPath();
        g.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.9 + r * 0.08, r * 0.07, r * 0.1, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#7cb87a";
      for (const k of [-0.4, 0, 0.4]) {
        g.beginPath();
        g.moveTo(r * k * 0.5, -r * 0.86);
        g.lineTo(r * (k - 0.16), -r * 0.6);
        g.lineTo(r * (k + 0.16), -r * 0.6);
        g.closePath();
        g.fill();
      }
      break;
    }
    case 2: {
      // 柑:顶部小蒂 + 四条淡瓣线从蒂心散开
      clipBody(g, r, () => {
        g.strokeStyle = st.detail;
        g.globalAlpha = 0.4;
        g.lineWidth = Math.max(1, r * 0.05);
        for (const k of [-0.62, -0.22, 0.22, 0.62]) {
          g.beginPath();
          g.moveTo(0, -r * 0.72);
          g.quadraticCurveTo(r * k * 1.1, 0, r * k, r * 0.9);
          g.stroke();
        }
        g.globalAlpha = 1;
      });
      g.fillStyle = "#8f6b3c";
      g.beginPath();
      g.arc(0, -r * 0.8, r * 0.1, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 3: {
      // 桃:一道竖向裂缝弧 + 一侧渐变腮
      g.fillStyle = "rgba(238,110,135,.26)";
      g.beginPath();
      g.arc(r * 0.34, r * 0.12, r * 0.46, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = st.detail;
      g.lineWidth = Math.max(1, r * 0.07);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, -r * 0.94);
      g.quadraticCurveTo(r * 0.2, -r * 0.55, r * 0.06, -r * 0.18);
      g.stroke();
      break;
    }
    case 4: {
      // 梨:上窄下宽 —— 顶上叠一个提亮的小圆当上半身,再撒几粒皮孔点
      g.fillStyle = "rgba(255,255,240,.22)";
      g.beginPath();
      g.arc(0, -r * 0.48, r * 0.58, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = st.detail;
      for (let i = 0; i < 6; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * (0.25 + rand() * 0.5);
        g.beginPath();
        g.arc(Math.cos(a) * d, Math.sin(a) * d * 0.8 + r * 0.15, Math.max(0.8, r * 0.045), 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 5: {
      // 苹:竖长高光条 + 顶部凹陷弧
      g.fillStyle = "rgba(255,255,255,.28)";
      g.beginPath();
      g.ellipse(-r * 0.32, 0, r * 0.15, r * 0.55, 0.08, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = st.detail;
      g.lineWidth = Math.max(1, r * 0.07);
      g.beginPath();
      g.arc(0, -r * 0.62, r * 0.34, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
      break;
    }
    case 6: {
      // 橙:浅色皮孔点阵 + 底部小脐圈
      g.fillStyle = st.detail;
      g.globalAlpha = 0.55;
      for (let i = 0; i < 12; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * Math.sqrt(rand()) * 0.78;
        g.beginPath();
        g.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.8, r * 0.04), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = CHAIN[level].edge;
      g.lineWidth = Math.max(1, r * 0.05);
      g.beginPath();
      g.arc(0, r * 0.58, r * 0.12, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case 7: {
      // 柚:厚皮 —— 大一圈的淡色内圆 + 稀疏皮孔 + 顶部小凸起
      g.fillStyle = st.detail;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(0, r * 0.06, r * 0.74, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.4;
      for (let i = 0; i < 7; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * (0.82 + rand() * 0.1);
        g.beginPath();
        g.arc(Math.cos(a) * d * 0.92, Math.sin(a) * d * 0.92, Math.max(0.8, r * 0.035), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = FRUIT_STYLE[level].hi;
      g.beginPath();
      g.arc(0, -r * 0.88, r * 0.14, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 8: {
      // 瓜:哈密瓜网纹,八条浅色随机短弧
      clipBody(g, r, () => {
        g.strokeStyle = st.detail;
        g.lineWidth = Math.max(1, r * 0.05);
        g.globalAlpha = 0.85;
        for (let i = 0; i < 8; i++) {
          const cx = (rand() * 2 - 1) * r * 0.7;
          const cy = (rand() * 2 - 1) * r * 0.7;
          const rr = r * (0.25 + rand() * 0.4);
          const a0 = rand() * Math.PI * 2;
          g.beginPath();
          g.arc(cx, cy, rr, a0, a0 + 1.1 + rand());
          g.stroke();
        }
        g.globalAlpha = 1;
      });
      break;
    }
    case 9: {
      // 玉瓜:玉色切面 —— 淡芯圆 + 八条放射细线 + 一圈深色小籽
      g.fillStyle = "rgba(255,255,255,.4)";
      g.beginPath();
      g.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = st.detail;
      g.globalAlpha = 0.4;
      g.lineWidth = Math.max(1, r * 0.035);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
        g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = "#3f6f57";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.6;
        g.beginPath();
        g.ellipse(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.05, r * 0.08, a, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    default: {
      // 团圆瓜:深浅绿相间的八道瓜纹 + 顶部卷曲小蒂
      clipBody(g, r, () => {
        g.fillStyle = st.detail;
        g.globalAlpha = 0.8;
        const n = 8;
        for (let i = 0; i < n; i++) {
          const x = -r + ((i + 0.5) * 2 * r) / n;
          const w = r * 0.11;
          g.beginPath();
          g.moveTo(x - w, -r);
          g.quadraticCurveTo(x + (i % 2 === 0 ? w : -w) * 2.2, 0, x - w, r);
          g.lineTo(x + w, r);
          g.quadraticCurveTo(x + (i % 2 === 0 ? w : -w) * 2.2 + w * 2, 0, x + w, -r);
          g.closePath();
          g.fill();
        }
        g.globalAlpha = 1;
      });
      g.strokeStyle = "#5c8a4c";
      g.lineWidth = Math.max(1, r * 0.06);
      g.beginPath();
      g.arc(r * 0.22, -r * 1.1, r * 0.12, Math.PI * 0.3, Math.PI * 1.9);
      g.stroke();
      break;
    }
  }
}

/**
 * 画一张完整果卡(中心在原点):径向渐变主体 → 专属纹理 → 底部内侧环境影
 * → 白高光 → 描边 → 叶梗 → 脸。纯函数,不读全局、不留状态。
 */
export function paintFruit(g: CanvasRenderingContext2D, level: number, r: number, face: Face): void {
  const lvl = clampLevel(level);
  const kind = CHAIN[lvl];
  const st = FRUIT_STYLE[lvl];

  // 主体:左上高光 → 主色 → 边缘压暗
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.12, 0, 0, r * 1.02);
  grad.addColorStop(0, st.hi);
  grad.addColorStop(0.55, kind.color);
  grad.addColorStop(1, kind.edge);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();

  paintTexture(g, lvl, r);

  // 底部内侧环境影:让果子看起来是「坐」在盆里的
  clipBody(g, r, () => {
    g.fillStyle = "rgba(80,45,80,.12)";
    g.beginPath();
    g.ellipse(0, r * 0.82, r * 0.85, r * 0.36, 0, 0, Math.PI * 2);
    g.fill();
  });

  // 白高光(沿用 1.2 规格)
  g.fillStyle = "rgba(255,255,255,.55)";
  g.beginPath();
  g.arc(-r * 0.3, -r * 0.34, r * 0.28, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = kind.edge;
  g.lineWidth = Math.max(1, r * 0.09);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();

  paintStemLeaf(g, r);
  paintFace(g, r, face);
}

// ---------------------------------------------------------------------------
// 贴图缓存
// ---------------------------------------------------------------------------

export interface FruitSprite {
  canvas: HTMLCanvasElement;
  /** 缓存键(等级|脸|量化后的像素密度),测试拿它证明走了贴图路径 */
  key: string;
}

const spriteCache = new Map<string, FruitSprite>();

/** 缓存最多留这么多张;换布局(缩放变了)会换一批键,旧的一起清 */
const SPRITE_CACHE_MAX = 96;

/** 把「世界单位 → 设备像素」的比例夹住并量化,布局微调不至于重画一整套 */
export function spriteScaleKey(scale: number): number {
  const clamped = scale < 0.5 ? 0.5 : scale > 4 ? 4 : scale;
  return Math.round(clamped * 8) / 8;
}

/**
 * 取(或预渲染)一张果卡贴图:等级 + 脸 + 像素密度唯一确定一张。
 * 贴图按 `CHAIN[level].r × scale` 的分辨率画,主画布 drawImage 时再按目标半径缩放。
 */
export function fruitSprite(level: number, scale: number, face: Face): FruitSprite {
  const lvl = clampLevel(level);
  const q = spriteScaleKey(scale);
  const key = `${lvl}|${face}|${q}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const r = CHAIN[lvl].r;
  const half = Math.max(2, Math.ceil(r * SPRITE_PAD * q));
  const canvas = document.createElement("canvas");
  canvas.width = half * 2;
  canvas.height = half * 2;
  const g = canvas.getContext("2d");
  if (g) {
    g.setTransform(q, 0, 0, q, half, half);
    paintFruit(g, lvl, r, face);
  }

  if (spriteCache.size >= SPRITE_CACHE_MAX) spriteCache.clear();
  const entry: FruitSprite = { canvas, key };
  spriteCache.set(key, entry);
  return entry;
}

/** 现在缓存里有哪些键(测试用) */
export function spriteCacheKeys(): string[] {
  return [...spriteCache.keys()];
}

/** 清空贴图缓存(测试隔离用;运行时不需要调) */
export function clearSpriteCache(): void {
  spriteCache.clear();
}

// ---------------------------------------------------------------------------
// 警戒线闪烁
// ---------------------------------------------------------------------------

/** 警戒线的闪烁透明度:reduced 恒定 1,否则随时间呼吸(沿用 1.2 的节奏) */
export function blinkAlpha(tMs: number, reduced: boolean): number {
  return reduced ? 1 : 0.45 + 0.55 * Math.abs(Math.sin(tMs / 260));
}

// ---------------------------------------------------------------------------
// 合并爆汁 fx:果汁粒子 / 扩散环 / 金星 / 飘字 / 顶级震屏
// ---------------------------------------------------------------------------

/** 果汁粒子对象池上限 */
export const JUICE_MAX = 20;
/** 一滴果汁的寿命(毫秒):抛物线下落着淡出 */
export const JUICE_MS = 320;
/** 白色扩散环时长(毫秒) */
export const RING_MS = 250;
/** 金星时长(毫秒) */
export const STAR_MS = 550;
/** 飘字时长(毫秒) */
export const TEXT_MS = 720;
/** 顶级合成的震屏时长(毫秒),振幅 2px */
export const SHAKE_MS = 160;
/** 合成到这一级以上(后三级:瓜 / 玉瓜 / 团圆瓜)追加金星与放大飘字 */
export const BIG_LEVEL = TOP_LEVEL - 2;

/** 彩虹光环的五个色阶(顶级合成专用) */
export const RAINBOW = ["#ff8f8f", "#ffc46e", "#f9ec8f", "#8fd6a0", "#9fb8f2"] as const;

interface JuiceDrop {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  r: number;
  color: string;
}

interface RingFx {
  active: boolean;
  x: number;
  y: number;
  r0: number;
  t: number;
  life: number;
  rainbow: boolean;
}

interface StarFx {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  r: number;
}

interface FloatFx {
  active: boolean;
  x: number;
  y: number;
  text: string;
  big: boolean;
  t: number;
}

export interface FxCounts {
  juice: number;
  rings: number;
  stars: number;
  texts: number;
}

export interface Fx {
  /** 一次合并:在接触点迸果汁、升扩散环;大果加金星与放大飘字;顶级再加震屏与彩虹环 */
  burst: (x: number, y: number, level: number, score: number, top: boolean) => void;
  update: (dtMs: number) => void;
  draw: (g: CanvasRenderingContext2D) => void;
  counts: () => FxCounts;
  /** 当前震屏偏移;没在震(或 reduced)恒为 0,0 */
  shakeOffset: () => { x: number; y: number };
  readonly shakeLeft: number;
}

function paintStarShape(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/**
 * 建一套合并演出。`reduced` 为真时 `burst` 是空操作:不出粒子、不震屏、不飘字,
 * 计数恒为 0 —— 弱动效开关一次接全部新增动画。
 */
export function createFx(reduced: boolean, seed = 7): Fx {
  const rand = makeRand(seed);
  const juice: JuiceDrop[] = [];
  const rings: RingFx[] = [];
  const stars: StarFx[] = [];
  const texts: FloatFx[] = [];
  let shakeLeft = 0;

  function takeJuice(): JuiceDrop | null {
    for (const d of juice) if (!d.active) return d;
    if (juice.length >= JUICE_MAX) return null;
    const d: JuiceDrop = { active: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, r: 0, color: "#fff" };
    juice.push(d);
    return d;
  }

  function take<T extends { active: boolean }>(pool: T[], make: () => T, cap: number): T | null {
    for (const item of pool) if (!item.active) return item;
    if (pool.length >= cap) return null;
    const item = make();
    pool.push(item);
    return item;
  }

  function burst(x: number, y: number, level: number, score: number, top: boolean): void {
    if (reduced) return;
    const lvl = clampLevel(level);
    const kind = CHAIN[lvl];

    // 果汁:4–6 滴同色系水滴,向两侧上方迸出再抛物线落下
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const d = takeJuice();
      if (!d) break;
      d.active = true;
      d.t = 0;
      d.x = x;
      d.y = y;
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.8;
      const sp = 70 + rand() * 90;
      d.vx = Math.cos(a) * sp;
      d.vy = Math.sin(a) * sp;
      d.r = 2 + rand() * 2;
      d.color = rand() < 0.5 ? kind.color : kind.edge;
    }

    // 新果出生的白色扩散环
    const ring = take(rings, () => ({ active: false, x: 0, y: 0, r0: 0, t: 0, life: RING_MS, rainbow: false }), 8);
    if (ring) {
      ring.active = true;
      ring.t = 0;
      ring.x = x;
      ring.y = y;
      ring.r0 = kind.r;
      ring.life = RING_MS;
      ring.rainbow = false;
    }

    // 飘字:所有合成都有 +分,后三级放大
    if (score > 0) {
      const ft = take(texts, () => ({ active: false, x: 0, y: 0, text: "", big: false, t: 0 }), 8);
      if (ft) {
        ft.active = true;
        ft.t = 0;
        ft.x = x;
        ft.y = y - kind.r * 0.6;
        ft.text = `+${score}`;
        ft.big = lvl >= BIG_LEVEL;
      }
    }

    // 后三级:金星两颗
    if (lvl >= BIG_LEVEL) {
      for (const side of [-1, 1]) {
        const s = take(stars, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, r: 0 }), 6);
        if (!s) break;
        s.active = true;
        s.t = 0;
        s.x = x + side * kind.r * 0.4;
        s.y = y - kind.r * 0.3;
        s.vx = side * (30 + rand() * 30);
        s.vy = -(60 + rand() * 50);
        s.r = 6 + rand() * 3;
      }
    }

    // 顶级:轻震一次 + 彩虹光环一圈
    if (top) {
      shakeLeft = SHAKE_MS;
      const rb = take(rings, () => ({ active: false, x: 0, y: 0, r0: 0, t: 0, life: RING_MS, rainbow: false }), 8);
      if (rb) {
        rb.active = true;
        rb.t = 0;
        rb.x = x;
        rb.y = y;
        rb.r0 = kind.r;
        rb.life = RING_MS * 1.8;
        rb.rainbow = true;
      }
    }
  }

  function update(dtMs: number): void {
    const dt = Math.max(0, dtMs);
    shakeLeft = Math.max(0, shakeLeft - dt);
    const sec = dt / 1000;
    for (const d of juice) {
      if (!d.active) continue;
      d.t += dt;
      if (d.t >= JUICE_MS) {
        d.active = false;
        continue;
      }
      d.vy += 900 * sec;
      d.x += d.vx * sec;
      d.y += d.vy * sec;
    }
    for (const ring of rings) {
      if (!ring.active) continue;
      ring.t += dt;
      if (ring.t >= ring.life) ring.active = false;
    }
    for (const s of stars) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= STAR_MS) {
        s.active = false;
        continue;
      }
      s.vy += 500 * sec;
      s.x += s.vx * sec;
      s.y += s.vy * sec;
    }
    for (const ft of texts) {
      if (!ft.active) continue;
      ft.t += dt;
      if (ft.t >= TEXT_MS) ft.active = false;
    }
  }

  function draw(g: CanvasRenderingContext2D): void {
    for (const d of juice) {
      if (!d.active) continue;
      const p = d.t / JUICE_MS;
      g.globalAlpha = 1 - p;
      g.fillStyle = d.color;
      g.beginPath();
      g.arc(d.x, d.y, Math.max(0.5, d.r * (1 - 0.35 * p)), 0, Math.PI * 2);
      g.fill();
    }
    for (const ring of rings) {
      if (!ring.active) continue;
      const p = ring.t / ring.life;
      const rr = ring.r0 * (0.5 + 1.4 * p);
      if (ring.rainbow) {
        for (let i = 0; i < RAINBOW.length; i++) {
          g.globalAlpha = (1 - p) * 0.9;
          g.strokeStyle = RAINBOW[i];
          g.lineWidth = 3;
          g.beginPath();
          g.arc(ring.x, ring.y, rr + i * 4, 0, Math.PI * 2);
          g.stroke();
        }
      } else {
        g.globalAlpha = 1 - p;
        g.strokeStyle = "#ffffff";
        g.lineWidth = 3.5 * (1 - p) + 1;
        g.beginPath();
        g.arc(ring.x, ring.y, rr, 0, Math.PI * 2);
        g.stroke();
      }
    }
    for (const s of stars) {
      if (!s.active) continue;
      const p = s.t / STAR_MS;
      g.globalAlpha = 1 - p * p;
      g.fillStyle = "#ffd34e";
      paintStarShape(g, s.x, s.y, s.r * (1 - 0.25 * p), p * 2.4);
      g.fill();
      g.strokeStyle = "#e0a92c";
      g.lineWidth = 1;
      g.stroke();
    }
    for (const ft of texts) {
      if (!ft.active) continue;
      const p = ft.t / TEXT_MS;
      g.globalAlpha = 1 - p;
      g.fillStyle = ft.big ? "#c9762c" : "#a8456a";
      g.font = `900 ${ft.big ? 17 : 12}px system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "bottom";
      g.fillText(ft.text, ft.x, ft.y - p * 26);
    }
    g.globalAlpha = 1;
  }

  function counts(): FxCounts {
    return {
      juice: juice.filter((d) => d.active).length,
      rings: rings.filter((x) => x.active).length,
      stars: stars.filter((x) => x.active).length,
      texts: texts.filter((x) => x.active).length,
    };
  }

  function shakeOffset(): { x: number; y: number } {
    if (shakeLeft <= 0) return { x: 0, y: 0 };
    const k = shakeLeft / SHAKE_MS;
    return { x: 2 * Math.sin(shakeLeft * 0.35) * k, y: 1.4 * Math.sin(shakeLeft * 0.53) * k };
  }

  return {
    burst,
    update,
    draw,
    counts,
    shakeOffset,
    get shakeLeft() {
      return shakeLeft;
    },
  };
}
