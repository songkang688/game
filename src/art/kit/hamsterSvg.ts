// 共享美术套件 · 参数化 SVG 仓鼠(1.3 视觉升级 · 窗口 6 第 18 步 C 档落的文件)。
//
// 纯字符串模板、零 DOM、零位图:圆滚身体 + 鼓腮帮 + 小圆耳 / 折耳 + 短尾巴,
// 四个朝向(上背影 / 下正脸 / 左右侧脸)各画各的路径,**不是 transform 翻转**;
// 推箱姿态前倾 12° + 双爪抵箱 + 后腿蹬地,滑冰姿态张开小爪 + 「哇」圆嘴。
// 咀嚼两帧输出成两组 class(`${chewClass}-a` / `-b`),动不动由宿主 CSS 决定
// (reduced-motion 时宿主把动画关掉,静态帧 a 常亮)。
//
// 颜色一律从传入的 style 派生(shade 提亮压暗),不在这里写死游戏皮肤。
import { shade } from "./palette";

/** 朝向沿用推箱的 Dir 约定:0 上 · 1 右 · 2 下 · 3 左 */
export type HamsterFacing = 0 | 1 | 2 | 3;
export type HamsterPose = "idle" | "push" | "slide";
export type HamsterEar = "round" | "fold";
export type HamsterTopper = "flower" | "cowlick";

/** 推箱姿态的前倾角(度):侧向朝向按此角度倾身 */
export const PUSH_LEAN_DEG = 12;

export interface HamsterStyle {
  /** 毛色主色 */
  fur: string;
  /** 肚皮 / 耳内色 */
  belly: string;
  /** 耳形:圆耳 / 折耳(剪影通道一) */
  ear: HamsterEar;
  /** 头饰:小花 / 呆毛(剪影通道二) */
  topper: HamsterTopper;
  /** 头饰配色 */
  topperColor: string;
}

export interface HamsterOpts {
  style: HamsterStyle;
  facing: HamsterFacing;
  pose?: HamsterPose;
  /**
   * 咀嚼两帧的 class 前缀:给了就输出 `${chewClass} ${chewClass}-a` 与 `-b`
   * 两组腮帮(左右交替鼓起),交给宿主 CSS 轮播;不给就只画静态腮帮。
   */
  chewClass?: string;
}

const F = (v: number): string => (Math.round(v * 10) / 10).toString();

/**
 * 圆滚身体(两段贝塞尔,宽高比约 1.1:1)。
 * 四个朝向四条路径,数字各不相同 —— 测试按路径字符串钉「不是翻转」。
 */
export function hamsterBodyPath(facing: HamsterFacing): string {
  switch (facing) {
    case 0: // 背影:比正脸稍圆一点,肩线更平
      return "M13.4 40.8 C14.2 17.6 49.8 17.6 50.6 40.8 C50.6 52.4 13.4 52.4 13.4 40.8 Z";
    case 1: // 右侧脸:鼻尖朝右,背拱在左
      return "M14.6 41.2 C14.6 20.6 38.2 13.6 49.2 27.4 C55.6 35.6 50.8 52.6 31 53.4 C17.8 53.9 14.6 48.4 14.6 41.2 Z";
    case 3: // 左侧脸:鼻尖朝左,背拱在右(独立路径,不是 scaleX 翻转)
      return "M49.4 41.2 C49.4 20.6 25.8 13.6 14.8 27.4 C8.4 35.6 13.2 52.6 33 53.4 C46.2 53.9 49.4 48.4 49.4 41.2 Z";
    default: // 2 正脸
      return "M12.8 39.6 C13.9 18.2 50.1 18.2 51.2 39.6 C51.2 51.6 12.8 51.6 12.8 39.6 Z";
  }
}

interface FacingSpec {
  /** 耳朵锚点(一只或两只) */
  ears: Array<[number, number]>;
  /** 头饰锚点 */
  topper: [number, number];
  /** 豆豆眼(背影没有) */
  eyes: Array<[number, number]>;
  /** 腮帮(正脸两团 / 侧脸单腮 / 背影没有) */
  cheeks: Array<[number, number]>;
  /** 嘴锚点(背影没有) */
  mouth: [number, number] | null;
  /** 尾巴锚点(正脸看不见) */
  tail: [number, number] | null;
  /** 推箱时双爪抵住的箱面位置 */
  pushPaws: Array<[number, number]>;
  /** 推箱时蹬地的后腿 */
  pushLeg: [number, number];
  /** 滑冰时张开的小爪 */
  slidePaws: Array<[number, number]>;
  /** idle 收在身前的小爪(背影收在身侧) */
  idlePaws: Array<[number, number]>;
}

const FACING_SPECS: Record<HamsterFacing, FacingSpec> = {
  0: {
    ears: [
      [21, 14.8],
      [43, 14.8],
    ],
    topper: [32, 10],
    eyes: [],
    cheeks: [],
    mouth: null,
    tail: [32, 51.5],
    pushPaws: [
      [24, 13],
      [40, 13],
    ],
    pushLeg: [32, 54.5],
    slidePaws: [
      [15.5, 42],
      [48.5, 42],
    ],
    idlePaws: [
      [17.5, 46],
      [46.5, 46],
    ],
  },
  1: {
    ears: [[27, 15.8]],
    topper: [33.5, 11.5],
    eyes: [[41.5, 27.5]],
    cheeks: [[40.5, 38.5]],
    mouth: [48.5, 35.5],
    tail: [13.6, 45.5],
    pushPaws: [
      [55, 33.5],
      [55, 43],
    ],
    pushLeg: [17, 51.5],
    slidePaws: [
      [50, 45],
      [34, 52],
    ],
    idlePaws: [
      [38, 51],
      [28, 51.5],
    ],
  },
  2: {
    ears: [
      [20.5, 15.5],
      [43.5, 15.5],
    ],
    topper: [32, 10.5],
    eyes: [
      [25, 31],
      [39, 31],
    ],
    cheeks: [
      [21.5, 39.5],
      [42.5, 39.5],
    ],
    mouth: [32, 37.5],
    tail: null,
    pushPaws: [
      [24, 54],
      [40, 54],
    ],
    pushLeg: [32, 17],
    slidePaws: [
      [15, 43],
      [49, 43],
    ],
    idlePaws: [
      [26.5, 50.5],
      [37.5, 50.5],
    ],
  },
  3: {
    ears: [[37, 15.8]],
    topper: [30.5, 11.5],
    eyes: [[22.5, 27.5]],
    cheeks: [[23.5, 38.5]],
    mouth: [15.5, 35.5],
    tail: [50.4, 45.5],
    pushPaws: [
      [9, 33.5],
      [9, 43],
    ],
    pushLeg: [47, 51.5],
    slidePaws: [
      [14, 45],
      [30, 52],
    ],
    idlePaws: [
      [26, 51],
      [36, 51.5],
    ],
  },
};

function earSvg(kind: HamsterEar, x: number, y: number, fur: string, belly: string): string {
  const line = shade(fur, -26);
  if (kind === "round") {
    return (
      `<circle cx="${F(x)}" cy="${F(y)}" r="5.2" fill="${fur}" stroke="${line}" stroke-width="1.3"/>` +
      `<circle cx="${F(x)}" cy="${F(y + 0.4)}" r="2.5" fill="${belly}"/>`
    );
  }
  // 折耳:一片往外下方折的小软耳,剪影带尖角,和圆耳一眼分得开
  return (
    `<path d="M${F(x - 5)} ${F(y + 2.5)} Q${F(x - 2.5)} ${F(y - 7)} ${F(x + 4.6)} ${F(y - 3.6)} ` +
    `Q${F(x + 5.8)} ${F(y + 2.2)} ${F(x + 0.8)} ${F(y + 4.2)} Z" fill="${fur}" stroke="${line}" stroke-width="1.3"/>` +
    `<path d="M${F(x - 2.4)} ${F(y + 1.6)} Q${F(x - 0.6)} ${F(y - 3.2)} ${F(x + 2.8)} ${F(y - 1.6)} ` +
    `Q${F(x + 3)} ${F(y + 1.4)} ${F(x + 0.4)} ${F(y + 2.4)} Z" fill="${belly}"/>`
  );
}

function topperSvg(kind: HamsterTopper, x: number, y: number, color: string): string {
  if (kind === "flower") {
    let petals = "";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      petals += `<circle cx="${F(x + Math.cos(a) * 3.4)}" cy="${F(y + Math.sin(a) * 3.4)}" r="1.9" fill="${color}"/>`;
    }
    return `<g class="bhh-topper bhh-topper-flower">${petals}<circle cx="${F(x)}" cy="${F(y)}" r="1.6" fill="#FFE9A8"/></g>`;
  }
  // 呆毛:一根打卷的小毛,加一根短的,剪影和小花完全不同
  return (
    `<g class="bhh-topper bhh-topper-cowlick" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round">` +
    `<path d="M${F(x)} ${F(y + 3)} Q${F(x - 1.6)} ${F(y - 4.2)} ${F(x - 5)} ${F(y - 2.6)}"/>` +
    `<path d="M${F(x + 0.6)} ${F(y + 3)} Q${F(x + 2.4)} ${F(y - 2.8)} ${F(x + 5)} ${F(y - 2.2)}"/>` +
    `</g>`
  );
}

function eyeSvg(x: number, y: number, wide: boolean): string {
  const r = wide ? 3 : 2.3;
  return (
    `<circle cx="${F(x)}" cy="${F(y)}" r="${r}" fill="#3A2B1E"/>` +
    `<circle cx="${F(x - 0.8)}" cy="${F(y - 0.9)}" r="0.8" fill="#fff"/>` +
    (wide ? `<circle cx="${F(x)}" cy="${F(y)}" r="${r + 1.1}" fill="none" stroke="#fff" stroke-width="0.9"/>` : "")
  );
}

function mouthSvg(pose: HamsterPose, x: number, y: number, ink: string): string {
  if (pose === "slide") {
    // 「哇」的小圆嘴
    return (
      `<g class="bhh-mouth-wow"><circle cx="${F(x)}" cy="${F(y + 1)}" r="2.6" fill="#8A4A3A"/>` +
      `<circle cx="${F(x)}" cy="${F(y + 1.8)}" r="1.1" fill="#C9766A"/></g>`
    );
  }
  if (pose === "push") {
    // 咬紧牙关的小直线
    return `<path class="bhh-mouth-grit" d="M${F(x - 2.4)} ${F(y + 0.6)} L${F(x + 2.4)} ${F(y + 0.6)}" stroke="${ink}" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
  }
  // 三瓣嘴
  return (
    `<g class="bhh-mouth-tri" fill="none" stroke="${ink}" stroke-width="1.2" stroke-linecap="round">` +
    `<path d="M${F(x)} ${F(y)} L${F(x)} ${F(y - 1.8)}"/>` +
    `<path d="M${F(x - 2.6)} ${F(y + 0.4)} Q${F(x)} ${F(y + 2.6)} ${F(x + 2.6)} ${F(y + 0.4)}"/>` +
    `</g>`
  );
}

function cheeksSvg(spec: FacingSpec, fur: string, chewClass?: string): string {
  if (spec.cheeks.length === 0) return "";
  const hi = shade(fur, 14);
  const line = shade(fur, -16);
  const one = (x: number, y: number, r: number): string =>
    `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r)}" fill="${hi}" stroke="${line}" stroke-width="1"/>`;
  const frame = (bigFirst: boolean): string =>
    spec.cheeks
      .map(([x, y], i) => {
        const big = spec.cheeks.length === 1 ? bigFirst : bigFirst === (i === 0);
        return one(x, y, big ? 6.8 : 5.4);
      })
      .join("");
  if (!chewClass) return `<g class="bhh-cheeks">${frame(true)}</g>`;
  // 两帧咀嚼:a 帧左鼓右瘪,b 帧左瘪右鼓;轮不轮播由宿主 CSS 决定
  return (
    `<g class="bhh-cheeks ${chewClass} ${chewClass}-a">${frame(true)}</g>` +
    `<g class="bhh-cheeks ${chewClass} ${chewClass}-b">${frame(false)}</g>`
  );
}

function pawsSvg(spec: FacingSpec, pose: HamsterPose, fur: string): string {
  const fill = shade(fur, -8);
  const line = shade(fur, -28);
  const paw = (x: number, y: number, r: number): string =>
    `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r)}" fill="${fill}" stroke="${line}" stroke-width="1"/>`;
  if (pose === "push") {
    // 双爪抵住箱面 + 后腿蹬地
    const paws = spec.pushPaws.map(([x, y]) => paw(x, y, 3)).join("");
    const [lx, ly] = spec.pushLeg;
    return (
      `<g class="bhh-paws bhh-paws-push">${paws}` +
      `<ellipse cx="${F(lx)}" cy="${F(ly)}" rx="4.4" ry="2.3" fill="${fill}" stroke="${line}" stroke-width="1"/></g>`
    );
  }
  if (pose === "slide") {
    // 张开的小爪(带三根小指头线)
    const paws = spec.slidePaws
      .map(
        ([x, y]) =>
          paw(x, y, 3.2) +
          `<path d="M${F(x - 1.6)} ${F(y - 2.6)} l-0.8 -2 M${F(x)} ${F(y - 3)} l0 -2.1 M${F(x + 1.6)} ${F(y - 2.6)} l0.8 -2" stroke="${line}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`
      )
      .join("");
    return `<g class="bhh-paws bhh-paws-slide">${paws}</g>`;
  }
  return `<g class="bhh-paws bhh-paws-idle">${spec.idlePaws.map(([x, y]) => paw(x, y, 2.6)).join("")}</g>`;
}

/** 推箱前倾:侧向按 ±12° 转,上下朝向往前压半格(2D 里没法绕横轴转) */
function poseTransform(facing: HamsterFacing, pose: HamsterPose): string {
  if (pose !== "push") return "";
  if (facing === 1) return ` transform="rotate(${PUSH_LEAN_DEG} 32 40)"`;
  if (facing === 3) return ` transform="rotate(-${PUSH_LEAN_DEG} 32 40)"`;
  return facing === 0 ? ` transform="translate(0 -1.8)"` : ` transform="translate(0 1.8)"`;
}

/**
 * 画一只仓鼠。输出 64×64 viewBox 的 `<svg>` 字符串:
 * 底影椭圆(格宽 60% / 高 14%)→ 尾巴 → 身体(三停渐变,顶光 +20%)→
 * 肚皮 / 背毛 → 耳朵 → 头饰 → 腮帮(两帧)→ 眼睛 → 嘴 → 爪子。
 */
export function hamsterSvg(opts: HamsterOpts): string {
  const { style, facing } = opts;
  const pose: HamsterPose = opts.pose ?? "idle";
  const spec = FACING_SPECS[facing];
  const line = shade(style.fur, -26);
  const gid = `bhh-g-${style.ear}-${style.topper}-${facing}-${pose}`;

  const defs =
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${shade(style.fur, 20)}"/>` +
    `<stop offset="0.55" stop-color="${style.fur}"/>` +
    `<stop offset="1" stop-color="${shade(style.fur, -14)}"/>` +
    `</linearGradient></defs>`;

  const shadow = `<ellipse class="bhh-shadow" cx="32" cy="56.5" rx="19.2" ry="4.5" fill="rgba(90,60,30,.18)"/>`;

  const tail = spec.tail
    ? `<circle class="bhh-tail" cx="${F(spec.tail[0])}" cy="${F(spec.tail[1])}" r="3.2" fill="${shade(style.fur, 18)}" stroke="${line}" stroke-width="1.1"/>`
    : "";

  const body = `<path class="bhh-body" d="${hamsterBodyPath(facing)}" fill="url(#${gid})" stroke="${line}" stroke-width="1.5"/>`;

  // 正脸给肚皮,背影给一块浅背毛,侧脸都不用
  const patch =
    facing === 2
      ? `<ellipse class="bhh-belly" cx="32" cy="45.5" rx="9.5" ry="6.5" fill="${style.belly}"/>`
      : facing === 0
        ? `<ellipse class="bhh-back" cx="32" cy="34" rx="12" ry="10" fill="${shade(style.fur, 12)}"/>`
        : "";

  const ears = spec.ears.map(([x, y]) => earSvg(style.ear, x, y, style.fur, style.belly)).join("");
  const topper = topperSvg(style.topper, spec.topper[0], spec.topper[1], style.topperColor);
  const cheeks = cheeksSvg(spec, style.fur, opts.chewClass);
  const eyes = spec.eyes.map(([x, y]) => eyeSvg(x, y, pose === "slide")).join("");
  const mouth = spec.mouth ? mouthSvg(pose, spec.mouth[0], spec.mouth[1], shade(style.fur, -52)) : "";
  const paws = pawsSvg(spec, pose, style.fur);

  return (
    `<svg class="bhh" viewBox="0 0 64 64" aria-hidden="true" data-facing="${facing}" data-pose="${pose}">` +
    defs +
    shadow +
    `<g class="bhh-figure"${poseTransform(facing, pose)}>` +
    tail +
    body +
    patch +
    ears +
    topper +
    cheeks +
    eyes +
    mouth +
    paws +
    `</g></svg>`
  );
}
