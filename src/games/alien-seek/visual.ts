// 寻找外星朋友 · 1.3 视觉层(C 档视觉升级)。
//
// 这里放的全是「怎么画」:配色板、图层序、六只外星朋友的差异化规格、
// 藏匿点掀开动画、UFO 找到仪式、通缉令小卡的排版——全部纯数据与纯函数,
// 不碰 DOM 也不碰 canvas,index.ts 只负责把这里算出来的东西描到画布上。
//
// 红线:这一层绝不读写坐标 / 命中判定 / 计时 / 存档,视觉测试只咬这里。
import type { Spot, SpotKind } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色板(1.3 规格表原样落成常量,动一个色值单测就红)
// ---------------------------------------------------------------------------

export const AS_PALETTE = {
  /** 星云双色径向渐变两端 */
  asNebulaA: "#2E2A55",
  asNebulaB: "#4A3E78",
  /** 亮星与流星尾迹 */
  asStar: "#FFF3C9",
  /** 两层丘陵剪影 */
  asHillFar: "#3E3A66",
  asHillNear: "#524A80",
  /** UFO 光束锥 */
  asBeam: "rgba(180,230,255,.4)",
  /** 通缉令小卡底 */
  asCard: "rgba(255,255,255,.9)",
  /** 夜景统一落影 */
  asShadow: "rgba(30,26,60,.3)",
} as const;

/**
 * 六只外星朋友的身体主色:沿用 1.1 起就有的 tint 数组,一个色号都不能动——
 * 玩家存档里「第 i 个藏身点的朋友长什么色」全靠 tint % 6 对上。
 */
export const ALIEN_TINTS = ["#8fe0c4", "#a9d8ff", "#ffd28f", "#d9bcff", "#b6e89a", "#ffb6c9"] as const;

/** draw 的图层序,从底到顶;index.ts 按这个顺序画,测试按这个顺序钉 */
export const LAYER_ORDER = [
  "nebula",
  "starfield",
  "hillFar",
  "hillNear",
  "spots",
  "aliens",
  "effects",
  "wantedCards",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 二、颜色小工具(纯计算)
// ---------------------------------------------------------------------------

function hexParts(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 两个 #rrggbb 按 k(0..1)混色,k=1 时完全是 b */
export function mixHex(a: string, b: string, k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const [ar, ag, ab] = hexParts(a);
  const [br, bg, bb] = hexParts(b);
  const m = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

/** 往白色方向提亮 k(0..1):径向渐变的「顶光」就是主色提亮 22% */
export function lightenHex(hex: string, k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const [r, g, b] = hexParts(hex);
  const m = (x: number): number => Math.round(x + (255 - x) * t);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** 明度(0..1,感知加权):对比度自查用它,不追求色度学上的严格 */
export function luma(hex: string): number {
  const [r, g, b] = hexParts(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** 外星人身体主色和夜空底的明度差至少要有这么多,不然夜里认不出朋友 */
export const MIN_ALIEN_BG_GAP = 0.2;

/** 某个 tint 相对星云底(两端取平均)的明度差 */
export function alienBackdropGap(tint: string): number {
  const bg = (luma(AS_PALETTE.asNebulaA) + luma(AS_PALETTE.asNebulaB)) / 2;
  return luma(tint) - bg;
}

/**
 * 藏匿点内腔(B 档第 1 轮建议级,窗口 6 第 2 轮 C 档清偿):
 * 八种藏身处的「里面」统一用这支夜靛色,不再按藏身处主色各调各的——
 * 「里面都是同一个夜晚」,孩子扫一眼就知道哪里是能藏东西的开口。
 */
export const AS_CAVITY_CORE = "#3E3A66";
/** 内腔边缘停 = 中心往黑方向压 18%(掀开后内腔不再近乎平涂) */
export const AS_CAVITY_EDGE = mixHex(AS_CAVITY_CORE, "#000000", 0.18);

/** 内腔渐变只需要 ctx 会造径向渐变;结构化收窄类型,测试拿桩就能验 */
export interface RadialGradFactory {
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): CanvasGradient;
}

/** 内腔 2 停径向渐变:中心 AS_CAVITY_CORE → 边缘 -18%,由调用方给开口圆心与半径 */
export function cavityGrad(
  c2d: RadialGradFactory,
  cx: number,
  cy: number,
  rad: number
): CanvasGradient {
  const g = c2d.createRadialGradient(cx, cy, Math.max(1, rad * 0.12), cx, cy, Math.max(2, rad));
  g.addColorStop(0, AS_CAVITY_CORE);
  g.addColorStop(1, AS_CAVITY_EDGE);
  return g;
}

// ---------------------------------------------------------------------------
// 三、六只外星朋友的规格(剪影级差异,不是换色)
// ---------------------------------------------------------------------------

export type AlienBodyKind = "roundChubby" | "tallSlim" | "bigEars" | "mushroom" | "squareHead" | "winged";
export type AlienEyeKind = "cyclops" | "triple" | "droopy" | "beads" | "boxy" | "starry";
export type AlienFeatureKind = "singleAntenna" | "twinAntenna" | "halo" | "twinTail" | "tripleAerial" | "spiralWing";
export type AlienIdleKind = "blink" | "antenna" | "wing";

/** idle 小动作的三档周期(毫秒,规格表钉死) */
export const IDLE_BLINK_MS = 3000;
export const IDLE_ANTENNA_MS = 1400;
export const IDLE_WING_MS = 600;

export interface AlienSpec {
  id: string;
  body: AlienBodyKind;
  eyes: AlienEyeKind;
  feature: AlienFeatureKind;
  idle: { kind: AlienIdleKind; periodMs: number; phaseMs: number };
}

/**
 * 六份 spec 集中在这一个数组里,以后要加第七只就在这里加一行。
 * phaseMs 六只互不相等:同屏好几只时小动作错开,画面才不像机器人列队。
 */
export const ALIEN_SPECS: readonly AlienSpec[] = [
  {
    id: "cyclops-chubby",
    body: "roundChubby",
    eyes: "cyclops",
    feature: "singleAntenna",
    idle: { kind: "antenna", periodMs: IDLE_ANTENNA_MS, phaseMs: 0 },
  },
  {
    id: "triple-tall",
    body: "tallSlim",
    eyes: "triple",
    feature: "twinAntenna",
    idle: { kind: "blink", periodMs: IDLE_BLINK_MS, phaseMs: 500 },
  },
  {
    id: "eared-halo",
    body: "bigEars",
    eyes: "droopy",
    feature: "halo",
    idle: { kind: "blink", periodMs: IDLE_BLINK_MS, phaseMs: 1100 },
  },
  {
    id: "mushroom-twintail",
    body: "mushroom",
    eyes: "beads",
    feature: "twinTail",
    idle: { kind: "blink", periodMs: IDLE_BLINK_MS, phaseMs: 1700 },
  },
  {
    id: "square-aerials",
    body: "squareHead",
    eyes: "boxy",
    feature: "tripleAerial",
    idle: { kind: "antenna", periodMs: IDLE_ANTENNA_MS, phaseMs: 800 },
  },
  {
    id: "winged-spiral",
    body: "winged",
    eyes: "starry",
    feature: "spiralWing",
    idle: { kind: "wing", periodMs: IDLE_WING_MS, phaseMs: 300 },
  },
];

// ---------------------------------------------------------------------------
// 四、剪影与特征件:输出「画法指令」而不是直接画,单测才能两两比对
// ---------------------------------------------------------------------------

/**
 * 画法指令:M/L/Q 同 SVG;A 是圆弧(cx cy r a0 a1);E 是整颗椭圆(cx cy rx ry);Z 闭合。
 * 坐标全部相对锚点(脚底中心在 y=+0.55s 附近),单位是 size。
 */
export type PathCmd =
  | ["M", number, number]
  | ["L", number, number]
  | ["Q", number, number, number, number]
  | ["A", number, number, number, number, number]
  | ["E", number, number, number, number]
  | ["Z"];

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** 六种身体的剪影路径:路径级差异,禁止只换色 */
export function alienSilhouette(spec: AlienSpec, size: number): PathCmd[] {
  const s = size;
  switch (spec.body) {
    case "roundChubby":
      // ① 独眼圆胖:一颗横着的糯米团
      return [["E", 0, r2(s * 0.05), r2(s * 0.78), r2(s * 0.62)]];
    case "tallSlim":
      // ② 三眼瘦高:竖长豆荚
      return [["E", 0, r2(-s * 0.1), r2(s * 0.44), r2(s * 0.88)]];
    case "bigEars":
      // ③ 大耳朵:圆脑袋 + 两片大耳
      return [
        ["E", 0, 0, r2(s * 0.6), r2(s * 0.56)],
        ["E", r2(-s * 0.72), r2(-s * 0.34), r2(s * 0.24), r2(s * 0.42)],
        ["E", r2(s * 0.72), r2(-s * 0.34), r2(s * 0.24), r2(s * 0.42)],
      ];
    case "mushroom":
      // ④ 蘑菇头:宽菌盖 + 收腰小身子
      return [
        ["M", r2(-s * 0.78), r2(-s * 0.1)],
        ["Q", r2(-s * 0.82), r2(-s * 0.95), 0, r2(-s * 0.95)],
        ["Q", r2(s * 0.82), r2(-s * 0.95), r2(s * 0.78), r2(-s * 0.1)],
        ["Q", r2(s * 0.4), r2(s * 0.02), r2(s * 0.34), r2(s * 0.16)],
        ["Q", r2(s * 0.36), r2(s * 0.6), 0, r2(s * 0.62)],
        ["Q", r2(-s * 0.36), r2(s * 0.6), r2(-s * 0.34), r2(s * 0.16)],
        ["Q", r2(-s * 0.4), r2(s * 0.02), r2(-s * 0.78), r2(-s * 0.1)],
        ["Z"],
      ];
    case "squareHead":
      // ⑤ 方脑袋:圆角方块
      return [
        ["M", r2(-s * 0.62), r2(-s * 0.42)],
        ["Q", r2(-s * 0.62), r2(-s * 0.68), r2(-s * 0.36), r2(-s * 0.68)],
        ["L", r2(s * 0.36), r2(-s * 0.68)],
        ["Q", r2(s * 0.62), r2(-s * 0.68), r2(s * 0.62), r2(-s * 0.42)],
        ["L", r2(s * 0.62), r2(s * 0.34)],
        ["Q", r2(s * 0.62), r2(s * 0.6), r2(s * 0.36), r2(s * 0.6)],
        ["L", r2(-s * 0.36), r2(s * 0.6)],
        ["Q", r2(-s * 0.62), r2(s * 0.6), r2(-s * 0.62), r2(s * 0.34)],
        ["Z"],
      ];
    case "winged":
      // ⑥ 小翅膀:圆身子(翅膀在特征件里,扇起来要单独转角度)
      return [["E", 0, 0, r2(s * 0.56), r2(s * 0.52)]];
  }
}

/** 剪影的比对指纹:单测拿它断言六只两两长得不一样 */
export function silhouetteKey(spec: AlienSpec, size = 20): string {
  return JSON.stringify(alienSilhouette(spec, size));
}

export interface FeaturePart {
  kind: AlienFeatureKind | "wing";
  /** 会随 idle 摆动的件(触角 / 翅膀),index.ts 按 pose 转它 */
  sway: boolean;
  cmds: PathCmd[];
}

/** 特征件(触角 / 光环 / 尾巴 / 天线 / 翅膀)的画法指令 */
export function featureParts(spec: AlienSpec, size: number): FeaturePart[] {
  const s = size;
  switch (spec.feature) {
    case "singleAntenna":
      return [
        {
          kind: "singleAntenna",
          sway: true,
          cmds: [
            ["M", 0, r2(-s * 0.5)],
            ["Q", r2(s * 0.12), r2(-s * 1.0), 0, r2(-s * 1.22)],
            ["A", 0, r2(-s * 1.34), r2(s * 0.14), 0, r2(Math.PI * 2)],
          ],
        },
      ];
    case "twinAntenna":
      return [-1, 1].map((d): FeaturePart => ({
        kind: "twinAntenna",
        sway: true,
        cmds: [
          ["M", r2(d * s * 0.2), r2(-s * 0.86)],
          ["Q", r2(d * s * 0.5), r2(-s * 1.28), r2(d * s * 0.38), r2(-s * 1.46)],
          ["A", r2(d * s * 0.38), r2(-s * 1.54), r2(s * 0.11), 0, r2(Math.PI * 2)],
        ],
      }));
    case "halo":
      return [
        {
          kind: "halo",
          sway: false,
          cmds: [["E", 0, r2(-s * 0.98), r2(s * 0.46), r2(s * 0.13)]],
        },
      ];
    case "twinTail":
      return [-1, 1].map((d): FeaturePart => ({
        kind: "twinTail",
        sway: true,
        cmds: [
          ["M", r2(d * s * 0.22), r2(s * 0.5)],
          ["Q", r2(d * s * 0.62), r2(s * 0.72), r2(d * s * 0.52), r2(s * 0.95)],
          ["Q", r2(d * s * 0.46), r2(s * 1.06), r2(d * s * 0.3), r2(s * 0.98)],
        ],
      }));
    case "tripleAerial":
      return [-1, 0, 1].map((d): FeaturePart => ({
        kind: "tripleAerial",
        sway: true,
        cmds: [
          ["M", r2(d * s * 0.3), r2(-s * 0.66)],
          ["L", r2(d * s * 0.44), r2(-s * 1.1)],
          ["A", r2(d * s * 0.44), r2(-s * 1.18), r2(s * 0.08), 0, r2(Math.PI * 2)],
        ],
      }));
    case "spiralWing": {
      const spiral: PathCmd[] = [["M", 0, r2(-s * 0.5)]];
      // 螺旋触角:半径一圈圈收小的折线圈
      for (let k = 0; k <= 14; k++) {
        const a = -Math.PI / 2 + (k / 14) * Math.PI * 3;
        const rr = s * (0.34 - k * 0.017);
        spiral.push(["L", r2(Math.cos(a) * rr), r2(-s * 0.95 + Math.sin(a) * rr)]);
      }
      const wing = (d: number): FeaturePart => ({
        kind: "wing",
        sway: true,
        cmds: [
          ["M", r2(d * s * 0.5), r2(-s * 0.08)],
          ["Q", r2(d * s * 1.02), r2(-s * 0.42), r2(d * s * 0.92), r2(s * 0.18)],
          ["Q", r2(d * s * 0.72), r2(s * 0.34), r2(d * s * 0.48), r2(s * 0.2)],
          ["Z"],
        ],
      });
      return [{ kind: "spiralWing", sway: false, cmds: spiral }, wing(-1), wing(1)];
    }
  }
}

// ---------------------------------------------------------------------------
// 五、姿态:idle 小动作与 peek 探头,全部只读 spec,一个字段都不写
// ---------------------------------------------------------------------------

/** peek 探头态露出身体的几成(只画上半身;这只改画法,命中判定与它无关) */
export const PEEK_REVEAL = 0.55;

export interface AlienPose {
  /** 露出几成身体(peek 探头 = PEEK_REVEAL,找到后 = 1) */
  reveal: number;
  /** 0 睁眼 → 1 全闭 */
  blink: number;
  /** 触角摆角系数 -1..1 */
  antennaSwing: number;
  /** 翅膀扇动系数 -1..1 */
  wingAngle: number;
  /** peek 时眼睛左右瞟 -1..1 */
  eyeShift: number;
}

/**
 * 这一刻该摆什么姿势。reduced(系统关动画)时全部静止,只保留静态层次。
 * 只读 peek / spec,绝不往参数里写东西——peek 的语义归玩法层管。
 */
export function alienPose(spec: AlienSpec, peek: boolean, tMs: number, reduced: boolean): AlienPose {
  const reveal = peek ? PEEK_REVEAL : 1;
  if (reduced) return { reveal, blink: 0, antennaSwing: 0, wingAngle: 0, eyeShift: 0 };
  const period = spec.idle.periodMs;
  const ph = ((tMs + spec.idle.phaseMs) % period) / period;
  const wavePh = Math.sin(ph * Math.PI * 2);
  return {
    reveal,
    // 眨眼:周期末尾快速合上再睁开,其他时间睁着
    blink: spec.idle.kind === "blink" && ph > 0.9 ? Math.sin(((ph - 0.9) / 0.1) * Math.PI) : 0,
    antennaSwing: spec.idle.kind === "antenna" ? wavePh : 0,
    wingAngle: spec.idle.kind === "wing" ? wavePh : 0,
    eyeShift: peek ? Math.sin((tMs / 900) * Math.PI * 2) : 0,
  };
}

// ---------------------------------------------------------------------------
// 六、缓动与动效时序(毫秒写死成常量,测试直接引用)
// ---------------------------------------------------------------------------

export function easeOutQuad(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return 1 - (1 - t) * (1 - t);
}

export function easeOutCubic(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBack(k: number): number {
  const t = Math.max(0, Math.min(1, k)) - 1;
  const c = 1.70158;
  return 1 + (c + 1) * t * t * t + c * t * t;
}

export function easeIn(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t;
}

/** 藏匿点拨开两瓣 */
export const UNCOVER_MS = 240;
/** 点错轻晃 + 问号云 */
export const WRONG_SHAKE_MS = 320;
/** UFO 仪式三段:飘入 / 光束 / 挥手上升,总和必须 ≤ 1200 */
export const UFO_ENTER_MS = 400;
export const UFO_BEAM_MS = 300;
export const UFO_RISE_MS = 500;
export const UFO_TOTAL_MS = UFO_ENTER_MS + UFO_BEAM_MS + UFO_RISE_MS;

// ---------------------------------------------------------------------------
// 七、藏匿点空间感:掀开 / 点错都只算「画的偏移」,命中区一个像素不碰
// ---------------------------------------------------------------------------

export interface UncoverPose {
  /** 两瓣掀开的角度(弧度),草丛 / 花丛式拨开用 */
  flapAngle: number;
  /** 盖子 / 帘子抬起多少(相对 r 的比例),木箱 / 帐篷式用 */
  lift: number;
  /** 内腔开口露出几成(0 关着 → 1 全开) */
  gap: number;
}

/** 每种藏身点掀开的方式(纯画法参数;进度 0..1,缓动 easeOutQuad) */
export function uncoverPose(kind: SpotKind, progress: number): UncoverPose {
  const k = easeOutQuad(progress);
  switch (kind) {
    case "花丛":
    case "云朵":
      // 拨开两瓣
      return { flapAngle: k * 0.55, lift: 0, gap: k };
    case "木箱":
    case "水缸":
      // 掀盖
      return { flapAngle: k * 0.35, lift: k * 0.3, gap: k };
    case "帐篷":
    case "信箱":
      // 掀门帘 / 开口
      return { flapAngle: k * 0.5, lift: k * 0.12, gap: k };
    case "树洞":
    case "石头":
      // 洞口 / 石缝亮开
      return { flapAngle: 0, lift: 0, gap: k };
  }
}

/**
 * 只读 Spot 的 kind 算掀开姿态;单测会拿冻结的 Spot 断言 x / y / r 前后不变。
 */
export function spotUncover(s: Spot, progress: number): UncoverPose {
  return uncoverPose(s.kind, progress);
}

export interface WrongPose {
  /** 水平轻晃的画面偏移(场景单位) */
  shakeX: number;
  /** 问号云的透明度 */
  cloudAlpha: number;
  /** 问号云弹出的缩放(easeOutBack) */
  cloudScale: number;
  done: boolean;
}

/** 点错的反馈:轻晃 + 问号云(不批评);reduced 时不晃,只出一帧静态问号云 */
export function wrongPose(tMs: number, reduced: boolean): WrongPose {
  if (reduced) {
    const inside = tMs <= WRONG_SHAKE_MS;
    return { shakeX: 0, cloudAlpha: inside ? 1 : 0, cloudScale: 1, done: !inside };
  }
  const k = Math.max(0, Math.min(1, tMs / WRONG_SHAKE_MS));
  return {
    shakeX: Math.sin(k * Math.PI * 4) * (1 - k) * 5,
    cloudAlpha: 1 - k * 0.25,
    cloudScale: easeOutBack(k),
    done: k >= 1,
  };
}

// ---------------------------------------------------------------------------
// 八、UFO 找到仪式(全程 ≤ 1200ms,不阻塞点击;reduced 走静态分支)
// ---------------------------------------------------------------------------

export interface CeremonyFrame {
  phase: "enter" | "beam" | "rise" | "done" | "static";
  /** UFO 飘入进度 0..1(easeOutCubic) */
  ufoT: number;
  /** 光束锥展开 0..1 */
  beamK: number;
  /** 外星人上升 0..1 */
  riseK: number;
  /** 挥手摆角 -1..1 */
  waveK: number;
}

/** 找到仪式某一毫秒该画成什么样;reduced = 静态光圈 + 挥手一帧 */
export function ceremonyAt(tMs: number, reduced: boolean): CeremonyFrame {
  if (reduced) return { phase: "static", ufoT: 1, beamK: 1, riseK: 0, waveK: 1 };
  if (tMs >= UFO_TOTAL_MS) return { phase: "done", ufoT: 1, beamK: 1, riseK: 1, waveK: 0 };
  if (tMs < UFO_ENTER_MS) {
    return { phase: "enter", ufoT: easeOutCubic(tMs / UFO_ENTER_MS), beamK: 0, riseK: 0, waveK: 0 };
  }
  if (tMs < UFO_ENTER_MS + UFO_BEAM_MS) {
    const k = (tMs - UFO_ENTER_MS) / UFO_BEAM_MS;
    return { phase: "beam", ufoT: 1, beamK: easeOutQuad(k), riseK: 0, waveK: Math.sin(k * Math.PI * 2) };
  }
  const k = (tMs - UFO_ENTER_MS - UFO_BEAM_MS) / UFO_RISE_MS;
  return { phase: "rise", ufoT: 1, beamK: 1, riseK: easeOutQuad(k), waveK: Math.sin(k * Math.PI * 3) };
}

// ---------------------------------------------------------------------------
// 九、通缉令小卡(缩略图):圆角卡 + 别针 + 半身像 + 名字条
// ---------------------------------------------------------------------------

export interface WantedCardLayout {
  w: number;
  h: number;
  radius: number;
  parts: ReadonlyArray<"pin" | "portrait" | "nameStrip">;
  pin: { x: number; y: number; r: number };
  portrait: { x: number; y: number; size: number };
  nameStrip: { x: number; y: number; w: number; h: number };
}

/** 40×40 逻辑格里的通缉令排版(drawThumb 按它画,测试按它断言) */
export function wantedCardLayout(w = 40, h = 40): WantedCardLayout {
  return {
    w,
    h,
    radius: Math.round(w * 0.18),
    parts: ["pin", "portrait", "nameStrip"],
    pin: { x: w / 2, y: h * 0.1, r: Math.max(2, w * 0.07) },
    portrait: { x: w / 2, y: h * 0.52, size: w * 0.3 },
    nameStrip: { x: w * 0.12, y: h * 0.78, w: w * 0.76, h: h * 0.14 },
  };
}

// ---------------------------------------------------------------------------
// 十、HUD
// ---------------------------------------------------------------------------

/** 计时字号下限(360px 手机上也要 ≥ 14px 才看得清) */
export const HUD_TIMER_MIN_PX = 14;
