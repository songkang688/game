/**
 * 1.3 共享美术套件 · 参数化三态小猫（纯字符串 SVG，不碰 DOM）。
 *
 * 第 26 步 C 档（kitty-care）首建，独占文件：一个文件只归一个人。
 * `kitty(state, fur, size)` 纯函数返回完整 `<svg>` 标记串，调用方 innerHTML 即用：
 *  - 三态立绘：sick＝耳朵耷拉 25° + 眼睑半闭 + 头顶灰色小旋涡（只是蔫蔫的，不痛苦）；
 *    caring＝眼睛全开 + 尾巴组挂摆动类（动画由调用方 CSS 控制，reduced 里全停）；
 *    cured＝整猫跳起 6px、四爪离地 + 弯月眼 + 头顶爱心，底部投影缩小 20%；
 *  - 三种毛色：橘（背纹三条弧）/ 灰（尾环两圈）/ 三花（两块斑，斑位固定两套
 *    `variant 0|1`，同参数输出永远一致，绝不闪变）；
 *  - 圆脸 + 立耳（内耳粉）+ 大眼（虹膜 + 双高光）+ 短须每侧三根 1px 弧线 +
 *    圆胖身 + 前爪两只 + 贝塞尔 S 形卷尾；统一 2px 深毛色描边；
 *  - 类名与渐变 id 都带 `prefix`（默认 kit），各款游戏换成自己的样式前缀即可。
 * 造型完全原创，不参考任何现成猫形象。零依赖、输出确定，node 环境可直接断言。
 * 色板走公共 `palette.ts`（只 import 不改）。
 */
import { shade, withAlpha } from "./palette";

export type KittyState = "sick" | "caring" | "cured";
export type KittyFur = "orange" | "gray" | "calico";

export const KITTY_STATES: readonly KittyState[] = ["sick", "caring", "cured"];
export const KITTY_FURS: readonly KittyFur[] = ["orange", "gray", "calico"];

/** 毛色 token（规格 4.1）：coat＝底色，deep＝条纹 / 斑纹 / 描边基准 */
export const KITTY_COLORS: Record<KittyFur, { coat: string; deep: string }> = {
  orange: { coat: "#f4a259", deep: "#d1813a" },
  gray: { coat: "#b8bdc9", deep: "#8d94a5" },
  calico: { coat: "#fff8f0", deep: "#d8b894" }
};

/** 内耳粉 / 鼻头粉 / 头顶爱心（规格 4.1） */
export const KITTY_PINK = { ear: "#ffb3c1", nose: "#ff8ba0", heart: "#ff8ba0" } as const;
/** 三花的两块斑用色（规格 4.1：橘斑 + 黑斑） */
export const CALICO_PATCH = { warm: "#f4a259", dark: "#4a4a55" } as const;

export interface KittyOpts {
  /** 三花斑位（0 / 1 两套固定，其他值一律取模），橘 / 灰不看它 */
  variant?: number;
  /** 类名与渐变 id 的前缀（各款游戏换成自己的样式前缀，默认 kit） */
  prefix?: string;
}

/** 痊愈跳起的高度（px，viewBox 坐标） */
export const KITTY_JUMP_PX = 6;
/** 底部投影基准横径；痊愈时缩小 20% */
export const KITTY_SHADOW_RX = 34;

function clampSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 120;
  return Math.max(24, Math.min(480, Math.round(size)));
}

function cleanPrefix(prefix: string | undefined): string {
  const p = (prefix ?? "kit").replace(/[^a-z0-9-]/gi, "");
  return p.length > 0 ? p : "kit";
}

/** 三花两套固定斑位（头上一块暖斑 + 身上一块深斑，两套镜像错位） */
function calicoPatches(variant: number): string {
  const v = ((Math.floor(Number.isFinite(variant) ? variant : 0) % 2) + 2) % 2;
  if (v === 0) {
    return `
    <path d="M40 27 q12 -12 25 -2 q-10 10 -25 8 z" fill="${CALICO_PATCH.warm}" opacity="0.92"/>
    <ellipse cx="73" cy="84" rx="12" ry="8.5" fill="${CALICO_PATCH.dark}" opacity="0.82"/>`;
  }
  return `
    <path d="M80 27 q-12 -12 -25 -2 q10 10 25 8 z" fill="${CALICO_PATCH.dark}" opacity="0.82"/>
    <ellipse cx="47" cy="84" rx="12" ry="8.5" fill="${CALICO_PATCH.warm}" opacity="0.92"/>`;
}

/** 花纹层：橘＝背纹三条弧，灰＝尾环两圈，三花＝两块固定斑 */
function furPattern(fur: KittyFur, variant: number, deep: string): { body: string; head: string; tail: string } {
  if (fur === "orange") {
    return {
      body: `
    <g stroke="${deep}" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M46 68 q3 7 -1 13"/>
      <path d="M58 65 q3 8 -1 15"/>
      <path d="M70 68 q3 7 -1 13"/>
    </g>`,
      head: "",
      tail: ""
    };
  }
  if (fur === "gray") {
    return {
      body: "",
      head: "",
      tail: `
    <g stroke="${deep}" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M100 82 q6 1 9 -3"/>
      <path d="M97 68 q6 0 9 -4"/>
    </g>`
    };
  }
  return { body: "", head: calicoPatches(variant), tail: "" };
}

/**
 * 画一只三态小猫。纯函数：同样的参数永远给同一串 SVG。
 * `state` / `fur` 传了认不得的值就落回 sick / orange，绝不抛错——
 * 视觉层坏了也不能拖垮玩法。
 */
export function kitty(state: KittyState, fur: KittyFur, size = 120, opts: KittyOpts = {}): string {
  const st: KittyState = KITTY_STATES.includes(state) ? state : "sick";
  const fu: KittyFur = KITTY_FURS.includes(fur) ? fur : "orange";
  const px = clampSize(size);
  const p = cleanPrefix(opts.prefix);
  const variant = opts.variant ?? 0;
  const { coat, deep } = KITTY_COLORS[fu];
  const outline = shade(deep, -22);
  const belly = shade(coat, 30);
  const gradId = `${p}KittyCoat-${fu}-${st}`;
  const pattern = furPattern(fu, variant, deep);

  // 三态差异集中算好，模板里只做内插
  const jump = st === "cured" ? -KITTY_JUMP_PX : 0;
  const shadowRx = st === "cured" ? KITTY_SHADOW_RX * 0.8 : KITTY_SHADOW_RX;
  const pawY = st === "cured" ? 104 : 108;

  // 耳朵：sick 耷拉 25°，其余立着
  const earLeft = st === "sick" ? ` transform="rotate(-25 46 30)"` : "";
  const earRight = st === "sick" ? ` transform="rotate(25 74 30)"` : "";

  // 眼睛三态：sick 半闭（下垂弧）/ caring 全开（虹膜 + 双高光）/ cured 弯月
  const eyes =
    st === "sick"
      ? `
    <g class="${p}-kitty-eyes" stroke="#3b3347" stroke-width="3.4" fill="none" stroke-linecap="round">
      <path d="M44 45 q5.5 4.5 11 0"/>
      <path d="M65 45 q5.5 4.5 11 0"/>
    </g>`
      : st === "cured"
        ? `
    <g class="${p}-kitty-eyes" stroke="#3b3347" stroke-width="3.4" fill="none" stroke-linecap="round">
      <path d="M44 46 q5.5 -6.5 11 0"/>
      <path d="M65 46 q5.5 -6.5 11 0"/>
    </g>`
        : `
    <g class="${p}-kitty-eyes">
      <circle cx="49.5" cy="44" r="5.2" fill="#3b3347"/>
      <circle cx="51.4" cy="42.2" r="1.7" fill="#ffffff"/>
      <circle cx="47.8" cy="45.8" r="0.9" fill="#ffffff"/>
      <circle cx="70.5" cy="44" r="5.2" fill="#3b3347"/>
      <circle cx="72.4" cy="42.2" r="1.7" fill="#ffffff"/>
      <circle cx="68.8" cy="45.8" r="0.9" fill="#ffffff"/>
    </g>`;

  // 嘴：cured 开心张嘴，其余小 ω
  const mouth =
    st === "cured"
      ? `<path d="M55 56 q5 6 10 0" stroke="#3b3347" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      : `<path d="M55.5 56 q2.2 3 4.5 0 q2.3 3 4.5 0" stroke="#3b3347" stroke-width="2" fill="none" stroke-linecap="round"/>`;

  // 头顶记号：sick 灰旋涡 / cured 爱心（caring 什么都不顶）
  const topper =
    st === "sick"
      ? `
    <path class="${p}-kitty-swirl" d="M52 8 q8 -7 15 -1 q6 5 0 10 q-6 4 -9 -1 q-2 -4 3 -5"
      stroke="#9aa0ad" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      : st === "cured"
        ? `
    <path class="${p}-kitty-heart" d="M60 3 c-2.8 -4.6 -10.5 -2.7 -10.5 2.8 c0 4.6 6.5 7.6 10.5 11.4
      c4 -3.8 10.5 -6.8 10.5 -11.4 c0 -5.5 -7.7 -7.4 -10.5 -2.8 z" fill="${KITTY_PINK.heart}"/>`
        : "";

  // 尾巴：caring 挂摆动类（动画由调用方 CSS 决定，reduced 里不动）
  const tailCls = st === "caring" ? `${p}-kitty-tail ${p}-kitty-sway` : `${p}-kitty-tail`;

  return `<svg viewBox="0 0 120 120" width="${px}" height="${px}" class="${p}-kitty-svg" data-state="${st}" data-fur="${fu}" aria-hidden="true">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(coat, 8)}"/>
      <stop offset="1" stop-color="${coat}"/>
    </linearGradient>
  </defs>
  <ellipse class="${p}-kitty-shadow" cx="60" cy="113" rx="${shadowRx}" ry="5.5" fill="${withAlpha("#6b5136", 0.18)}"/>
  <g class="${p}-kitty-pose" transform="translate(0 ${jump})">
    <g class="${tailCls}">
      <path d="M86 92 q24 3 22 -20 q-1 -13 -13 -15" stroke="${coat}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M86 92 q24 3 22 -20 q-1 -13 -13 -15" stroke="${outline}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.35"/>${pattern.tail}
    </g>
    <g class="${p}-kitty-body">
      <ellipse cx="60" cy="88" rx="30" ry="24" fill="url(#${gradId})" stroke="${outline}" stroke-width="2"/>${pattern.body}
      <ellipse cx="60" cy="94" rx="15" ry="10.5" fill="${belly}"/>
      <ellipse cx="48" cy="${pawY}" rx="8.5" ry="5" fill="${coat}" stroke="${outline}" stroke-width="2"/>
      <ellipse cx="72" cy="${pawY}" rx="8.5" ry="5" fill="${coat}" stroke="${outline}" stroke-width="2"/>
    </g>
    <g class="${p}-kitty-head">
      <g class="${p}-kitty-ear"${earLeft}>
        <path d="M39 32 L45 9 L58 26 Z" fill="${coat}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M43.5 28 L46.5 16.5 L53 25 Z" fill="${KITTY_PINK.ear}"/>
      </g>
      <g class="${p}-kitty-ear"${earRight}>
        <path d="M81 32 L75 9 L62 26 Z" fill="${coat}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M76.5 28 L73.5 16.5 L67 25 Z" fill="${KITTY_PINK.ear}"/>
      </g>
      <circle cx="60" cy="46" r="27" fill="url(#${gradId})" stroke="${outline}" stroke-width="2"/>${pattern.head}${eyes}
      <path d="M57 51.5 l6 0 l-3 4.4 z" fill="${KITTY_PINK.nose}"/>
      ${mouth}
      <g class="${p}-kitty-whiskers" stroke="${shade(deep, -8)}" stroke-width="1" fill="none" stroke-linecap="round">
        <path d="M35 46 q-9 -2 -16 -5"/>
        <path d="M35 50 q-9 0 -17 0"/>
        <path d="M35 54 q-9 2 -16 5"/>
        <path d="M85 46 q9 -2 16 -5"/>
        <path d="M85 50 q9 0 17 0"/>
        <path d="M85 54 q9 2 16 5"/>
      </g>
    </g>${topper}
  </g>
</svg>`;
}
