// 泡泡瞄准手 · 1.3 视觉层(第 19 步 C 档视觉升级)。
//
// 这里放的全是「怎么画」:ba 配色 token、图层序、动效时序表、瞄准点串采样、
// 炮台角度换算、reduced 分支与各种纯 painter。全部纯数据与纯函数;
// index.ts 只负责把这里算出来的东西画上 canvas。
//
// 红线:这一层绝不读写发射角度换算 / 反弹 / 贴附 / 掉落判定 / 关卡数据;
// 瞄准点串的每个坐标都来自 simulateShot→previewPath 的既有物理输出,
// 这里只做「沿折线取样」,一个物理点都不自己算。

// ---------------------------------------------------------------------------
// 一、配色 token(四·补一规格表原样落成常量,动一个色值单测就红)
// ---------------------------------------------------------------------------

export const BA_COLORS = {
  /** 背景双色渐变(无尽墙用;战役保留各主题自己的天空色) */
  baBgTop: "#F3EAFB",
  baBgBottom: "#E3F0FA",
  /** 顶部藤蔓装饰带 */
  baVine: "#9FD98B",
  /** 吊灯暖光 */
  baLamp: "#FFE2B8",
  /** 炮台木质底座 */
  baWood: "#C89B6C",
  /** 石泡棱面主色 */
  baStone: "#B9AFA4",
  /** 炸弹黑猫主色(可爱不阴森) */
  baCat: "#5A5468",
  /** 统一落影 */
  baShadow: "rgba(93,84,110,.16)",
} as const;

/**
 * 图层序(draw 从底到顶):① 背景渐变+光斑 → ② 顶部藤蔓吊灯 → ③ 网格泡泡串 →
 * ④ 掉落串拖尾 → ⑤ 飞行泡 → ⑥ 瞄准点串(功能件) → ⑦ 发射器炮台 →
 * ⑧ 星花/飘分 → ⑨ HUD。色觉标记(colorMark)跟泡泡本体同层,永不被装饰盖住。
 */
export const BA_LAYERS = {
  background: 0,
  vineLamp: 1,
  gridBubbles: 2,
  /** 色觉辅助标记与泡泡本体同层(画在本体面子上,装饰不许盖) */
  colorMark: 2,
  fallTrail: 3,
  flight: 4,
  aimDots: 5,
  shooter: 6,
  sparkFx: 7,
  hud: 8,
} as const;

// ---------------------------------------------------------------------------
// 二、动效时序表(四·补三;毫秒写死成常量,测试直接引用)
// ---------------------------------------------------------------------------

export const BA_TIMINGS = {
  /** 待命泡弹跳:±2px、700ms 一个 sin 周期;reduced 静止 */
  idleBounceMs: 700,
  idleBounceAmpPx: 2,
  /** 换弹旋转交换(纯视觉过渡,逻辑交换时机不变) */
  swapMs: 150,
  /** 引信星火循环;reduced 静止火点 */
  fuseMs: 400,
  /** 彩虹环一圈;reduced 静止 */
  rainbowSpinMs: 2400,
  /** 掉落串拖尾渐隐帧数;reduced 不生成 */
  trailFrames: 3,
  /** 瞄准点串点径:起点 4px 沿路径递减到 2px(窄屏下限,功能件常驻) */
  aimDotMaxR: 4,
  aimDotMinR: 2,
} as const;

// ---------------------------------------------------------------------------
// 三、reduced 分支(弹跳/旋转/星火/拖尾全停;静态体积与瞄准点串保留)
// ---------------------------------------------------------------------------

/** 待命泡上下轻弹的偏移(px):sin 周期 700ms、±2px;reduced 恒 0 */
export function bounceOffset(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.sin((tMs / BA_TIMINGS.idleBounceMs) * Math.PI * 2) * BA_TIMINGS.idleBounceAmpPx;
}

/** 彩虹环旋转角(弧度):2400ms 一圈 linear;reduced 恒 0(静止环) */
export function rainbowSpinAngle(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((tMs % BA_TIMINGS.rainbowSpinMs) / BA_TIMINGS.rainbowSpinMs) * Math.PI * 2;
}

/** 引信星火相位 0..1:400ms 循环 linear;reduced 恒 0(静止火点) */
export function fuseSparkPhase(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return (tMs % BA_TIMINGS.fuseMs) / BA_TIMINGS.fuseMs;
}

/** 掉落串拖尾帧数:reduced 不生成拖尾 */
export function trailFrames(reduced: boolean): number {
  return reduced ? 0 : BA_TIMINGS.trailFrames;
}

/**
 * 换弹交换进度 0..1(easeInOut):150ms 走完;reduced 瞬时到位。
 * 只做视觉过渡 —— 逻辑上 swapLoader 早在按下那一刻就换完了。
 */
export function swapProgress(elapsedMs: number, reduced: boolean): number {
  if (reduced) return 1;
  const t = Math.max(0, Math.min(1, elapsedMs / BA_TIMINGS.swapMs));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---------------------------------------------------------------------------
// 四、瞄准点串(功能件,reduced 也保留)
// ---------------------------------------------------------------------------

export interface AimDot {
  x: number;
  y: number;
  /** 沿整条预览路径的进度 0..1(点径映射用) */
  t: number;
}

/** 点串取样间隔(px) */
export const AIM_DOT_SPACING = 16;

/**
 * 把既有物理预览折线变成渐隐圆点串:只沿给定顶点做线性取样,
 * 每个点都落在 path 的线段上 —— 不改一个物理坐标,更不自己算反弹。
 */
export function aimDots(
  path: ReadonlyArray<{ x: number; y: number }>,
  spacing: number = AIM_DOT_SPACING
): AimDot[] {
  if (path.length < 2) return [];
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return [];
  const out: AimDot[] = [];
  const gap = Math.max(4, spacing);
  for (let s = 0; s <= total; s += gap) {
    let rest = s;
    for (let i = 0; i < segLens.length; i++) {
      if (rest > segLens[i]) {
        rest -= segLens[i];
        continue;
      }
      const k = segLens[i] > 0 ? rest / segLens[i] : 0;
      const a = path[i];
      const b = path[i + 1];
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, t: s / total });
      break;
    }
  }
  return out;
}

/** 点径映射:路径起点 4px 线性递减到终点 2px(窄屏可见性下限) */
export function aimDotRadius(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return BA_TIMINGS.aimDotMaxR - (BA_TIMINGS.aimDotMaxR - BA_TIMINGS.aimDotMinR) * k;
}

/** 反弹点星花标记:就是预览折线的中间顶点(物理反射点),原样返回 */
export function bounceStars(
  path: ReadonlyArray<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return path.slice(1, Math.max(1, path.length - 1)).map((p) => ({ x: p.x, y: p.y }));
}

// ---------------------------------------------------------------------------
// 五、炮台角度(只读瞄准方向,不写回)
// ---------------------------------------------------------------------------

/** 炮管旋转角(弧度):直接读既有瞄准方向向量,canvas 直接 rotate 用 */
export function barrelAngle(aim: { readonly dx: number; readonly dy: number }): number {
  return Math.atan2(aim.dy, aim.dx);
}

// ---------------------------------------------------------------------------
// 六、飘分轻弹入场
// ---------------------------------------------------------------------------

/**
 * 飘字轻弹入场缩放:寿命剩余比例 k(1=刚出现,0=散尽)。
 * 刚出现的前 15% 从 0.6 弹到 1,之后恒 1;reduced 不走这里(index 直接给 1)。
 */
export function floatPopScale(k: number): number {
  const born = 1 - Math.max(0, Math.min(1, k));
  if (born >= 0.15) return 1;
  const t = born / 0.15;
  return 0.6 + 0.4 * t + 0.15 * Math.sin(t * Math.PI) * (1 - t);
}

/** 顶板下压越多层,藤架阴影越深(0 层 0.16 → 每层 +0.05,封顶 0.4) */
export function vineShadowAlpha(pressedLayers: number): number {
  return Math.min(0.4, 0.16 + Math.max(0, pressedLayers) * 0.05);
}
