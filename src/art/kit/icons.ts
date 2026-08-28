/**
 * 共享美术套件 · SVG 图标组(1.3 第 21 步 A 档 lianliankan 首建,归 A 档所有;
 * C 档 memory-cards 等只 import 不修改,可按下面的规范**新增**图标、不改已有导出)。
 *
 * 绘制规范(每枚四道工序,后来者照抄规范):
 *  1. 剪影路径:全部原创几何剪影,画在 0..100 的方框里,主剪影收进一条 path 的 d;
 *  2. 双色线性渐变填充:light → dark,左上往右下(x1y1 0,0 → x2y2 1,1);
 *  3. 1.5px 描边:stroke 取 dark 再加深 35%(shade(dark, -0.35)),圆角拐点;
 *  4. 左上小高光:白 55% 小椭圆,默认落在 (34,30),各图标可用 hx/hy/hr 微调。
 *
 * 产物是 innerHTML 直接可用的 <svg> 字符串(HTML 解析器会自动把 <svg> 放进
 * 正确的命名空间,所以不写 xmlns);渐变 id 按图标 id 稳定生成,同款图标共享
 * 同一份渐变定义。全部程序化矢量:零位图、零运行时依赖、零字体依赖,
 * 同款图案在任何机器上渲染一致。
 */
import { shade } from "./fruit";

export interface KitIcon {
  /** 稳定 id:渐变命名与外部映射都靠它 */
  id: string;
  /** 中文名:给 aria-label 与图鉴用 */
  name: string;
  /** 渐变浅色(左上) */
  light: string;
  /** 渐变深色(右下) */
  dark: string;
  /** 主剪影路径(0..100 方框) */
  d: string;
  /** 细节层:额外的 svg 元素字符串(可空) */
  extra?: string;
  /** 高光位置(默认 34,30,6) */
  hx?: number;
  hy?: number;
  hr?: number;
}

/** 统一描边宽度(规范第 3 道工序) */
export const ICON_STROKE_PX = 1.5;
/** 高光的透明度(规范第 4 道工序) */
export const ICON_GLINT_ALPHA = 0.55;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 五瓣小花剪影:五片圆瓣绕心排布,一条 path 画完 */
function flowerPath(cx: number, cy: number, rIn: number, rOut: number, petals = 5): string {
  const parts: string[] = [];
  for (let i = 0; i < petals; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / petals;
    const a0 = a - Math.PI / petals;
    const a1 = a + Math.PI / petals;
    const px0 = round2(cx + Math.cos(a0) * rIn);
    const py0 = round2(cy + Math.sin(a0) * rIn);
    const px1 = round2(cx + Math.cos(a1) * rIn);
    const py1 = round2(cy + Math.sin(a1) * rIn);
    const c0x = round2(cx + Math.cos(a - 0.42) * rOut * 1.28);
    const c0y = round2(cy + Math.sin(a - 0.42) * rOut * 1.28);
    const c1x = round2(cx + Math.cos(a + 0.42) * rOut * 1.28);
    const c1y = round2(cy + Math.sin(a + 0.42) * rOut * 1.28);
    parts.push(`${i === 0 ? `M${px0} ${py0}` : ""} C${c0x} ${c0y} ${c1x} ${c1y} ${px1} ${py1}`);
  }
  return `${parts.join(" ")} Z`;
}

/** 五角星剪影 */
function starPath(cx: number, cy: number, rOut: number, rIn: number, points = 5): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = round2(cx + Math.cos(a) * r);
    const y = round2(cy + Math.sin(a) * r);
    parts.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return `${parts.join(" ")} Z`;
}

/**
 * 四角星路径(中心在 0,0):两头尖、腰身内收,给流星星尘 / 消散星屑用。
 * 与 sparkle.ts 的 traceStar 同一个造型,这里是 SVG path 字符串版。
 */
export function starburstPath(r: number): string {
  const w = round2(r * 0.32);
  const R = round2(r);
  return `M0 ${-R} Q${w} ${-w} ${R} 0 Q${w} ${w} 0 ${R} Q${-w} ${w} ${-R} 0 Q${-w} ${-w} 0 ${-R} Z`;
}

/**
 * 图标组:16 枚原创小图案(≥ 12 的规格线之上再留余量,
 * 连连看单主题最多 14 种图案也各有各的款)。
 */
export const ICONS: readonly KitIcon[] = [
  {
    id: "flower",
    name: "小花",
    light: "#FFD9E6",
    dark: "#F4859F",
    d: flowerPath(50, 52, 12, 34),
    extra: `<circle cx="50" cy="52" r="11" fill="#FFE9A8" stroke="#D9A93E" stroke-width="1.5"/>`,
    hx: 34,
    hy: 32
  },
  {
    id: "star",
    name: "星星",
    light: "#FFF3C2",
    dark: "#F5B93E",
    d: starPath(50, 54, 40, 17),
    hx: 40,
    hy: 36
  },
  {
    id: "umbrella",
    name: "小伞",
    light: "#CFE6FF",
    dark: "#5FA0DC",
    d: "M12 54 A38 38 0 0 1 88 54 A12.7 12.7 0 0 0 62.7 54 A12.7 12.7 0 0 0 37.3 54 A12.7 12.7 0 0 0 12 54 Z",
    extra:
      `<path d="M50 54 L50 80 A8 8 0 0 1 34 80" fill="none" stroke="#8A6238" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="50" cy="14" r="3.5" fill="#5FA0DC"/>`,
    hx: 32,
    hy: 32
  },
  {
    id: "bell",
    name: "铃铛",
    light: "#FFE9B8",
    dark: "#EFA94E",
    d: "M50 16 C36 16 30 26 30 40 C30 52 25 58 19 64 L81 64 C75 58 70 52 70 40 C70 26 64 16 50 16 Z",
    extra:
      `<circle cx="50" cy="12" r="4.5" fill="none" stroke="#B27B32" stroke-width="3"/>` +
      `<circle cx="50" cy="72" r="6" fill="#F5B93E" stroke="#B27B32" stroke-width="1.5"/>`,
    hx: 40,
    hy: 30
  },
  {
    id: "berry",
    name: "果果",
    light: "#FFC9C2",
    dark: "#E8635A",
    d: "M50 26 C30 26 22 42 24 58 C26 74 38 84 50 84 C62 84 74 74 76 58 C78 42 70 26 50 26 Z",
    extra:
      `<path d="M50 26 C50 18 54 14 58 12" fill="none" stroke="#8A6238" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M58 20 C66 12 76 12 80 16 C76 24 66 26 58 20 Z" fill="#7AB84E" stroke="#4C7C36" stroke-width="1.5"/>`,
    hx: 36,
    hy: 40
  },
  {
    id: "cloud",
    name: "云朵",
    light: "#FFFFFF",
    dark: "#BFD9F2",
    d: "M26 70 A14 14 0 0 1 24 42 A18 18 0 0 1 57 33 A14 14 0 0 1 80 44 A13 13 0 0 1 77 70 Z",
    hx: 34,
    hy: 44
  },
  {
    id: "butterfly",
    name: "蝴蝶",
    light: "#EBD9FF",
    dark: "#A87BDD",
    d:
      "M50 50 C34 26 12 24 12 42 C12 56 32 62 46 58 C32 64 16 72 22 84 " +
      "C28 92 44 80 50 62 C56 80 72 92 78 84 C84 72 68 64 54 58 C68 62 88 56 88 42 C88 24 66 26 50 50 Z",
    extra:
      `<ellipse cx="50" cy="56" rx="4.5" ry="16" fill="#8A6238"/>` +
      `<path d="M46 42 C42 32 36 28 32 26 M54 42 C58 32 64 28 68 26" fill="none" stroke="#8A6238" stroke-width="2.5" stroke-linecap="round"/>`,
    hx: 30,
    hy: 38
  },
  {
    id: "hat",
    name: "帽子",
    light: "#D8F2C4",
    dark: "#6FB35A",
    d: "M24 60 C24 40 35 28 50 28 C65 28 76 40 76 60 Z",
    extra:
      `<rect x="24" y="50" width="52" height="8" rx="4" fill="#FFE9A8"/>` +
      `<rect x="10" y="58" width="80" height="10" rx="5" fill="#6FB35A" stroke="#47753A" stroke-width="1.5"/>`,
    hx: 38,
    hy: 36
  },
  {
    id: "cup",
    name: "茶杯",
    light: "#FFE3EE",
    dark: "#E58BB0",
    d: "M24 34 L76 34 C76 58 68 74 50 74 C32 74 24 58 24 34 Z",
    extra:
      `<path d="M76 40 C88 40 88 58 74 60" fill="none" stroke="#B75A82" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M42 26 C42 20 46 20 46 14 M56 26 C56 20 60 20 60 14" fill="none" stroke="#C9B8A0" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="50" cy="80" rx="26" ry="5" fill="#E8D5BC" stroke="#B79B72" stroke-width="1.5"/>`,
    hx: 36,
    hy: 42
  },
  {
    id: "moon",
    name: "月牙",
    light: "#FFF3C4",
    dark: "#F0C24B",
    d: "M64 10 A40 40 0 1 0 64 90 A32 32 0 1 1 64 10 Z",
    extra: `<path d="M72 24 Q75 27 78 30 Q75 33 72 36 Q69 33 66 30 Q69 27 72 24 Z" fill="#FFE9A8"/>`,
    hx: 30,
    hy: 34
  },
  {
    id: "fish",
    name: "小鱼",
    light: "#C4ECF2",
    dark: "#54AEC2",
    d:
      "M18 52 C28 34 46 28 62 36 C72 41 78 48 80 52 C78 56 72 63 62 68 C46 76 28 70 18 52 Z " +
      "M80 52 L94 38 C92 48 92 56 94 66 Z",
    extra:
      `<circle cx="34" cy="48" r="3.5" fill="#3B3B4F"/>` +
      `<path d="M52 40 C58 46 58 58 52 64" fill="none" stroke="rgba(59,59,79,.35)" stroke-width="2.5" stroke-linecap="round"/>`,
    hx: 32,
    hy: 42
  },
  {
    id: "leaf",
    name: "叶子",
    light: "#D9F2B8",
    dark: "#7AB84E",
    d: "M50 12 C74 24 84 48 74 68 C66 82 54 88 50 88 C46 88 34 82 26 68 C16 48 26 24 50 12 Z",
    extra:
      `<path d="M50 20 L50 84 M50 40 C42 44 38 50 36 56 M50 34 C58 38 62 44 64 50" ` +
      `fill="none" stroke="rgba(76,124,54,.5)" stroke-width="2.5" stroke-linecap="round"/>`,
    hx: 38,
    hy: 30
  },
  {
    id: "boat",
    name: "小船",
    light: "#FFD9B8",
    dark: "#E8894E",
    d: "M14 62 L86 62 C82 76 70 84 50 84 C30 84 18 76 14 62 Z",
    extra:
      `<path d="M52 12 L52 62" stroke="#8A6238" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M52 14 L52 56 L24 56 Z" fill="#FFF6E8" stroke="#C9A26E" stroke-width="1.5" stroke-linejoin="round"/>`,
    hx: 34,
    hy: 68
  },
  {
    id: "candy",
    name: "糖果",
    light: "#FFD9E2",
    dark: "#E86A8C",
    d: "M30 50 A20 20 0 1 0 70 50 A20 20 0 1 0 30 50 Z",
    extra:
      `<path d="M31 44 L15 34 C19 44 19 56 15 66 L31 56 Z" fill="#E86A8C" stroke="#B04964" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M69 44 L85 34 C81 44 81 56 85 66 L69 56 Z" fill="#E86A8C" stroke="#B04964" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M40 36 C48 46 48 56 42 64" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="4" stroke-linecap="round"/>`,
    hx: 40,
    hy: 40
  },
  {
    id: "kite",
    name: "风筝",
    light: "#D3E8FF",
    dark: "#6D8FE0",
    d: "M50 8 L78 42 L50 72 L22 42 Z",
    extra:
      `<path d="M50 8 L50 72 M22 42 L78 42" fill="none" stroke="rgba(59,59,79,.25)" stroke-width="2"/>` +
      `<path d="M50 72 C58 80 44 84 52 92" fill="none" stroke="#E8894E" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="55" cy="77" r="2.5" fill="#F4859F"/><circle cx="49" cy="87" r="2.5" fill="#F5B93E"/>`,
    hx: 40,
    hy: 30
  },
  {
    id: "acorn",
    name: "橡果",
    light: "#F2DBB8",
    dark: "#C89B5C",
    d: "M32 46 C32 68 40 82 50 82 C60 82 68 68 68 46 Z",
    extra:
      `<path d="M28 46 C28 32 38 24 50 24 C62 24 72 32 72 46 L28 46 Z" fill="#A9784F" stroke="#7A5638" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M50 24 C50 18 52 16 56 14" fill="none" stroke="#7A5638" stroke-width="3.5" stroke-linecap="round"/>`,
    hx: 40,
    hy: 56,
    hr: 5
  }
];

/**
 * 面具图标:连连看「伪装关」的盖脸用,单独放、不进 ICONS,
 * 免得跟牌面图案撞款认错。
 */
export const MASK_ICON: KitIcon = {
  id: "mask",
  name: "面具",
  light: "#E7E0F5",
  dark: "#8B7BB8",
  d:
    "M50 34 C34 26 14 30 12 46 C10 60 24 70 36 66 C42 64 46 58 50 58 " +
    "C54 58 58 64 64 66 C76 70 90 60 88 46 C86 30 66 26 50 34 Z",
  extra:
    `<ellipse cx="33" cy="48" rx="8" ry="6" fill="#FFFDF6"/>` +
    `<ellipse cx="67" cy="48" rx="8" ry="6" fill="#FFFDF6"/>`,
  hx: 28,
  hy: 38,
  hr: 5
};

/** 按 id 找图标(找不到就退回第一枚,绝不返回 undefined) */
export function iconById(id: string): KitIcon {
  return ICONS.find((i) => i.id === id) ?? ICONS[0];
}

export interface IconSvgOpts {
  /** 渐变 id 的去重后缀;缺省用图标自己的 id(同款共享同一份渐变定义) */
  uid?: string;
  /** 额外加在 <svg> 上的 class */
  cls?: string;
}

/**
 * 把一枚图标拼成 innerHTML 直接可用的 <svg> 字符串。
 * 四道工序按规范排:渐变定义 → 剪影(渐变填充 + 1.5px 描边)→ 细节层 → 左上高光。
 */
export function iconSvg(icon: KitIcon, opts: IconSvgOpts = {}): string {
  const gid = `kitg-${icon.id}${opts.uid ? `-${opts.uid}` : ""}`;
  const stroke = shade(icon.dark, -0.35);
  const hx = icon.hx ?? 34;
  const hy = icon.hy ?? 30;
  const hr = icon.hr ?? 6;
  return (
    `<svg viewBox="0 0 100 100" class="kit-icon${opts.cls ? ` ${opts.cls}` : ""}" aria-hidden="true" focusable="false">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${icon.light}"/><stop offset="1" stop-color="${icon.dark}"/>` +
    `</linearGradient></defs>` +
    `<path d="${icon.d}" fill="url(#${gid})" stroke="${stroke}" stroke-width="${ICON_STROKE_PX}" stroke-linejoin="round" stroke-linecap="round"/>` +
    (icon.extra ?? "") +
    `<ellipse cx="${hx}" cy="${hy}" rx="${round2(hr * 1.5)}" ry="${hr}" transform="rotate(-24 ${hx} ${hy})" fill="rgba(255,255,255,${ICON_GLINT_ALPHA})"/>` +
    `</svg>`
  );
}
