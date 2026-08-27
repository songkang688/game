/**
 * 水果切切乐 · 1.3 视觉模块(第 20 步 B 档)。
 *
 * 这里只有绘制与装饰粒子,零玩法:切割判定仍用 `f.r` 的圆,本文件画出的
 * 专属剪影外接尺寸 ≤ SILHOUETTE_MAX_SCALE × r(画大不改判)。
 */

// ---- 配色板(规格四·补一之二) ----
export const FS_COLORS = {
  /** 砧板 / 舞台木纹底 */
  stage: "#F6EBDD",
  /** 上方轻纱幕布渐变 */
  curtain: "rgba(255,220,235,.5)",
  /** 刀光丝带芯 */
  trailCore: "#FFFFFF",
  /** 刀光丝带中层(主题粉) */
  trailMid: "#ff9eb5",
  /** 乌云娃娃主色(可爱灰蓝) */
  cloud: "#8B93A8",
  /** 冰果棱面 */
  ice: "#DDF2FF",
  /** 加倍果金边 */
  gold: "#F0C25A",
} as const;

// ---- 剪影与切面常量(规格四·补一,测试引用) ----
/** 新剪影的外接尺寸上限:≤ 1.15 × f.r,判定圆一个像素不动 */
export const SILHOUETTE_MAX_SCALE = 1.15;
/** 渲染半径低于这个像素数就省略籽点 / 皮孔等细节层 */
export const MIN_DETAIL_PX = 20;
/** 瓜瓜切面黑籽颗数 */
export const MELON_SEEDS = 6;
/** 瓜瓜切面白皮环厚度(相对 r) */
export const MELON_RIND_RATIO = 0.1;
/** 橙橙切面放射瓣数 */
export const CITRUS_SEGMENTS = 8;
/** 莓莓切面白芯放射细纹条数 */
export const BERRY_CORE_LINES = 12;
/** 柠柠切面瓣格数 */
export const LEMON_CELLS = 8;
/** 柠柠切面汁泡粒数 */
export const LEMON_BUBBLES = 5;
/** 桃桃切面中心核(相对 r 的椭圆长轴) */
export const PEACH_PIT_RATIO = 0.22;
/** 蕉蕉切面中心籽点粒数 */
export const BANANA_SEEDS = 3;
/** 切面的压扁比(切面椭圆 纵/横) */
export const FACE_SQUASH = 0.32;

// ---- 动效时序(规格四·补二,毫秒) ----
/** 刀光丝带尾迹时长 */
export const TRAIL_RIBBON_MS = 160;
/** 加倍果金边脉动周期 */
export const GOLD_PULSE_MS = 900;
/** 花瓣雨触发的连击数 */
export const PETAL_COMBO = 5;
/** 花瓣雨时长 */
export const PETAL_RAIN_MS = 1000;
/** 冰果寒气丝循环周期 */
export const ICE_WISP_MS = 1400;
/** 切面「亮一下再落定」保留的帧数 */
export const FACE_FLASH_FRAMES = 1;

/** 液滴颜色 = 对应果主色(和 FRUITS 表的 skin 一一对应) */
export const JUICE_COLORS: Record<string, string> = {
  桃桃: "#ffb3c1",
  橙橙: "#ffc46b",
  瓜瓜: "#8fd47a",
  莓莓: "#91a7ff",
  柠柠: "#ffe66b",
  蕉蕉: "#ffe66b",
};

/** 切中的液滴用哪种颜色:有映射用映射,没有(壳壳/令令等)跟果皮走。 */
export function juiceColorFor(name: string, fallbackSkin: string): string {
  return JUICE_COLORS[name] ?? fallbackSkin;
}

export type SliceFruitName = "桃桃" | "瓜瓜" | "橙橙" | "莓莓" | "柠柠";

export interface Pt {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

function angDist(a: number, b: number): number {
  const d = Math.abs((((a - b) % TAU) + TAU) % TAU);
  return d > Math.PI ? TAU - d : d;
}

/** 角度上的高斯鼓包:给正圆加凸脐 / 底尖 / 肩线用 */
function bump(a: number, center: number, width: number): number {
  const d = angDist(a, center) / width;
  return Math.exp(-d * d);
}

/**
 * 五果专属剪影(核心整改):按名字给出局部坐标下的采样点环。
 * - 桃桃:心形带尖(顶凹 0.12r、底尖 0.08r、两肩微鼓)
 * - 瓜瓜:宽椭圆(宽:高 = 1.25:1)
 * - 橙橙:正圆保留 + 顶部凸脐 0.1r
 * - 莓莓:倒水滴(圆肩在上、圆尖在下)
 * - 柠柠:橄榄形(两端小凸 0.08r)
 * 所有点都在 SILHOUETTE_MAX_SCALE × r 以内,判定圆不改。
 */
export function silhouettePoints(name: SliceFruitName, r: number, steps = 48): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (TAU * i) / steps - Math.PI / 2;
    let x: number;
    let y: number;
    if (name === "莓莓") {
      // 倒水滴:上半圆肩、下半收成圆尖
      const vy = Math.sin(a) >= 0 ? 1.04 : 0.88;
      y = Math.sin(a) * vy;
      const v = (y + 0.88) / (1.04 + 0.88);
      x = Math.cos(a) * 0.98 * (1 - 0.4 * Math.pow(Math.max(0, v), 1.7));
    } else {
      let rho: number;
      if (name === "桃桃") {
        // 顶凹 0.12r / 底尖 0.08r 是规格钉死的;两肩鼓 0.1r 把心形撑出来,20px 灰度下也别认成橙橙
        rho =
          0.96 -
          0.12 * bump(a, -Math.PI / 2, 0.5) +
          0.1 * (bump(a, -Math.PI / 2 - 0.95, 0.6) + bump(a, -Math.PI / 2 + 0.95, 0.6)) +
          0.08 * bump(a, Math.PI / 2, 0.34);
      } else if (name === "瓜瓜") {
        const sx = 1.12;
        const sy = 0.896;
        rho = (sx * sy) / Math.hypot(sy * Math.cos(a), sx * Math.sin(a));
      } else if (name === "橙橙") {
        rho = 0.99 + 0.1 * bump(a, -Math.PI / 2, 0.26);
      } else {
        // 柠柠:橄榄形 + 两端小凸
        const sx = 1.0;
        const sy = 0.8;
        rho =
          (sx * sy) / Math.hypot(sy * Math.cos(a), sx * Math.sin(a)) +
          0.08 * (bump(a, 0, 0.24) + bump(a, Math.PI, 0.24));
      }
      x = Math.cos(a) * rho;
      y = Math.sin(a) * rho;
    }
    pts.push({ x: x * r, y: y * r });
  }
  return pts;
}

/** 剪影离中心最远有多远(测「画大不改判」的上限用)。 */
export function silhouetteExtent(name: SliceFruitName, r: number): number {
  let max = 0;
  for (const p of silhouettePoints(name, r)) {
    max = Math.max(max, Math.hypot(p.x, p.y));
  }
  return max;
}

/** 把采样点环描成一条平滑闭合路径(中点二次曲线)。 */
export function traceSilhouette(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

/** #rrggbb 加深/提亮(和 index.ts 的 shade 同一规则,视觉模块自带一份免得互相引)。 */
export function shadeColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

/** 柠柠汁泡的固定摆位(伪随机会闪,写死更稳) */
const LEMON_BUBBLE_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [0.32, 0.4],
  [-0.38, 0.28],
  [0.14, -0.44],
  [-0.2, -0.3],
  [0.48, -0.12],
];

/**
 * 六种切面果肉(规格四·补一):在「未压扁」的局部坐标里画,
 * 调用方负责 translate/rotate;本函数自己处理切面椭圆的压扁。
 * name 不在六果之列(壳壳/令令/亮亮/双双)时走通用籽点切面。
 */
export function drawCrossSection(
  ctx: CanvasRenderingContext2D,
  name: string,
  r: number,
  flesh: string,
  skin: string,
): void {
  const faceFlesh = name === "桃桃" ? "#ffdf9e" : name === "瓜瓜" ? "#ff7383" : flesh;
  const fleshR = name === "瓜瓜" ? 0.98 - MELON_RIND_RATIO : 0.84;
  // 外圈白瓤 / 白皮环
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.98, r * 0.98 * FACE_SQUASH, 0, 0, TAU);
  ctx.fill();
  // 果肉
  ctx.fillStyle = faceFlesh;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * fleshR, r * fleshR * FACE_SQUASH, 0, 0, TAU);
  ctx.fill();
  // 细节统一在压扁坐标系里按圆画
  ctx.save();
  ctx.scale(1, FACE_SQUASH);
  ctx.beginPath();
  ctx.arc(0, 0, r * fleshR, 0, TAU);
  ctx.clip();
  if (name === "瓜瓜") {
    // 红瓤 + 黑籽 6 粒(弧形排布)
    ctx.fillStyle = "#3a3a4a";
    for (let i = 0; i < MELON_SEEDS; i++) {
      const a = Math.PI * (0.16 + (0.68 * i) / (MELON_SEEDS - 1));
      const d = r * (i % 2 === 0 ? 0.52 : 0.38);
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d - r * 0.08, r * 0.05, r * 0.09, a + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
  } else if (name === "橙橙") {
    // 放射八瓣 + 瓣间细线 + 中轴白膜
    ctx.strokeStyle = shadeColor("#ffc46b", -46);
    ctx.lineWidth = r * 0.04;
    ctx.lineCap = "round";
    for (let i = 0; i < CITRUS_SEGMENTS; i++) {
      const a = (TAU * i) / CITRUS_SEGMENTS + Math.PI / CITRUS_SEGMENTS;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16);
      ctx.lineTo(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(r * 0.8, 0);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, TAU);
    ctx.fill();
  } else if (name === "桃桃") {
    // 黄瓤放射纹 + 中心核 0.22r + 核纹两道
    ctx.strokeStyle = shadeColor("#ffdf9e", -30);
    ctx.lineWidth = r * 0.035;
    for (let i = 0; i < 8; i++) {
      const a = (TAU * i) / 8 + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.stroke();
    }
    ctx.fillStyle = "#c47a4a";
    ctx.strokeStyle = "#a05c32";
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * PEACH_PIT_RATIO, r * PEACH_PIT_RATIO * 0.82, 0.3, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (const off of [-0.35, 0.45]) {
      ctx.beginPath();
      ctx.arc(r * off * 0.2, 0, r * PEACH_PIT_RATIO * 0.6, off - 0.8, off + 0.9);
      ctx.stroke();
    }
  } else if (name === "莓莓") {
    // 白芯放射细纹 12 条 + 外圈籽点
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.26, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = r * 0.03;
    for (let i = 0; i < BERRY_CORE_LINES; i++) {
      const a = (TAU * i) / BERRY_CORE_LINES;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14);
      ctx.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
      ctx.stroke();
    }
    ctx.fillStyle = shadeColor("#91a7ff", -50);
    for (let i = 0; i < 8; i++) {
      const a = (TAU * i) / 8 + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76, r * 0.045, 0, TAU);
      ctx.fill();
    }
  } else if (name === "柠柠") {
    // 瓣格 8 格 + 汁泡点 5 粒
    ctx.strokeStyle = shadeColor("#fff9d6", -52);
    ctx.lineWidth = r * 0.035;
    ctx.lineCap = "round";
    for (let i = 0; i < LEMON_CELLS; i++) {
      const a = (TAU * i) / LEMON_CELLS;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
      ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      ctx.stroke();
      // 格壁之间再补一条弧,拼出「瓣格」而不只是放射线
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.46, a + 0.12, a + TAU / LEMON_CELLS - 0.12);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const [bx, by] of LEMON_BUBBLE_SPOTS) {
      ctx.beginPath();
      ctx.arc(bx * r, by * r, r * 0.05, 0, TAU);
      ctx.fill();
    }
  } else if (name === "蕉蕉") {
    // 圆切面 + 中心籽点三粒
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8a6a3e";
    for (let i = 0; i < BANANA_SEEDS; i++) {
      ctx.beginPath();
      ctx.arc((i - 1) * r * 0.2, 0, r * 0.05, 0, TAU);
      ctx.fill();
    }
  } else {
    // 壳壳 / 令令 / 亮亮 / 双双:通用籽点切面
    ctx.fillStyle = shadeColor(skin, -42);
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6 + 0.4;
      const d = r * (i % 2 === 0 ? 0.5 : 0.28);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.045, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- 冰冻 / 加倍的视觉映射(只读效果状态,绝不写回) ----

export interface FxState {
  readonly freezeTimer: number;
  readonly doubleTimer: number;
}

/**
 * 效果状态 → 视觉参数。只读输入(冰冻 / 加倍的计时归 update 管),
 * 返回 0..1 的脉动相位;reduced 时相位钉在 0.5(静态金边 / 静止寒气)。
 */
export function auraFor(
  state: FxState,
  timeMs: number,
  reduced: boolean,
): { frozen: boolean; doubled: boolean; goldPulse01: number; wisp01: number } {
  const cyc = (period: number): number => 0.5 + 0.5 * Math.sin((timeMs / period) * TAU);
  return {
    frozen: state.freezeTimer > 0,
    doubled: state.doubleTimer > 0,
    goldPulse01: reduced ? 0.5 : cyc(GOLD_PULSE_MS),
    wisp01: reduced ? 0.5 : cyc(ICE_WISP_MS),
  };
}

// ---- 花瓣雨(combo ≥ PETAL_COMBO 时飘 1 秒,reduced 关) ----

interface Petal {
  x01: number;
  speed: number;
  sway: number;
  phase: number;
  size: number;
  spin: number;
}

// ---------------------------------------------------------------------------
// 果王头顶徽记(窗口 7 R1 修复 A-6):自绘小皇冠替裸 emoji 身份牌
// ---------------------------------------------------------------------------

/**
 * 果王珠色 = 身份通道:大果王(会翻镜湖)金珠、令牌果王粉珠、回旋果王蓝珠。
 * 只读 spec 的既有布尔位,不添任何玩法字段。
 */
export function kingBeadColor(spec: { flips?: boolean; decrees?: boolean }): string {
  if (spec.flips) return "#FFE9A8";
  if (spec.decrees) return "#F4859F";
  return "#7FC8E8";
}

/**
 * 自绘小皇冠:宽 0.7r × 高 0.42r,三尖齿 + 齿顶圆珠 3 粒,
 * 2 停线性渐变(#FFE9A8 → #E8A62E)+ 1.5px 描边 #C7861F + 底边束带 + 左上小高光。
 * 画在果王本体的平移/摆动坐标系里(落位 -1.12r,与原 emoji 同位),随本体同角度摆。
 */
export function drawKingCrown(ctx: CanvasRenderingContext2D, r: number, bead: string): void {
  const w = r * 0.7;
  const h = r * 0.42;
  const cy = -r * 1.12;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  const shoulder = top + h * 0.28;
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, "#FFE9A8");
  g.addColorStop(1, "#E8A62E");
  ctx.beginPath();
  ctx.moveTo(-w / 2, bot);
  ctx.lineTo(-w / 2, shoulder);
  ctx.lineTo(-w * 0.25, cy);
  ctx.lineTo(0, top);
  ctx.lineTo(w * 0.25, cy);
  ctx.lineTo(w / 2, shoulder);
  ctx.lineTo(w / 2, bot);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#C7861F";
  ctx.lineWidth = Math.max(1.5, r * 0.03);
  ctx.lineJoin = "round";
  ctx.stroke();
  // 齿顶圆珠 3 粒(珠 r = 冠宽 × 0.07,珠色分果王)
  ctx.fillStyle = bead;
  for (const [bx, by] of [[-w / 2, shoulder], [0, top], [w / 2, shoulder]] as const) {
    ctx.beginPath();
    ctx.arc(bx, by, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // 底边束带
  ctx.fillStyle = "#C7861F";
  ctx.beginPath();
  ctx.rect(-w / 2, bot - h * 0.18, w, h * 0.18);
  ctx.fill();
  // 左上小高光(光源左上 45° 约定)
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.26, cy - h * 0.04, w * 0.09, h * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class PetalRain {
  private petals: Petal[] = [];
  private ageMs = 0;
  private color = "#ffb3c1";

  /** 触发一场同色花瓣雨;reduced 直接不下,正在下也不重复铺。 */
  burst(color: string, reduced: boolean, rand: () => number = Math.random): void {
    if (reduced) return;
    if (this.petals.length > 0) return;
    this.color = color;
    this.ageMs = 0;
    for (let i = 0; i < 14; i++) {
      this.petals.push({
        x01: rand(),
        speed: 0.75 + rand() * 0.5,
        sway: 14 + rand() * 22,
        phase: rand() * TAU,
        size: 5 + rand() * 4,
        spin: (rand() - 0.5) * 6,
      });
    }
  }

  update(dtMs: number): void {
    if (this.petals.length === 0) return;
    this.ageMs += dtMs;
    if (this.ageMs >= PETAL_RAIN_MS) this.petals.length = 0;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.petals.length === 0) return;
    const t = this.ageMs / PETAL_RAIN_MS;
    ctx.fillStyle = this.color;
    for (const p of this.petals) {
      const x = p.x01 * w + Math.sin(p.phase + t * 5) * p.sway;
      const y = t * p.speed * (h + 60) - 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.phase + t * p.spin);
      ctx.globalAlpha = 0.85 * (1 - t * t);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  count(): number {
    return this.petals.length;
  }

  clear(): void {
    this.petals.length = 0;
  }
}
