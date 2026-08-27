// 共享美术套件 · 参数化 SVG 地鼠(1.3 视觉升级 · 窗口 6 第 18 步 B 档落的文件)。
//
// 给 DOM 游戏用的地鼠一家:圆头圆肩 + 大门牙两颗 + 圆爪扒洞沿 + 腮红,
// 全部是字符串模板函数,零运行时依赖、零位图、不碰 DOM,node 单测直接咬字符串。
//
// 参数化维度:
//  - gear 装备层(独立 <g data-part="gear-*">):素颜 / 小盾牌(木纹+金属边)/
//    安全帽(黄色+帽带)/ 小黑板(举牌,手写体算式);
//  - pose 姿态:up 正常冒头 / bonked 被敲(压扁 0.8 倍 + 吐舌笑 + 星星圈 3 颗,
//    喜感不痛苦)/ yawn 没被敲到缩回前打哈欠(闭眼张嘴 + 一滴瞌睡泡);
//  - fur 皮毛主色(金地鼠传金色就行),三停渐变顶光自动 +20%;
//  - sleepy 瞌睡眼皮、sparkle 闪光星芒,给瞌睡鼠 / 闪光鼠做剪影差异。
//
// 另带 bunnySvg():花花兔(长耳朵 + 郁金香),和地鼠剪影一眼可分,
// 提醒孩子「这只不能敲」。装备只按外面传的参数显示/隐藏,不做任何判定。

export type MoleGear = "none" | "shield" | "hat" | "board";
export type MolePose = "up" | "bonked" | "yawn";

export interface MoleSvgOpts {
  /** 装备层:素颜 / 盾牌 / 安全帽 / 小黑板 */
  gear?: MoleGear;
  /** 姿态:冒头 / 被敲压扁 / 打哈欠 */
  pose?: MolePose;
  /** 皮毛主色(#rrggbb) */
  fur?: string;
  /** gear === "board" 时黑板上的手写算式 */
  boardText?: string;
  /** 瞌睡鼠:半闭眼皮 + 瞌睡泡 */
  sleepy?: boolean;
  /** 闪光鼠:头顶星芒 */
  sparkle?: boolean;
  /** 固定像素尺寸;不给就 100% 吃满宿主容器 */
  size?: number;
}

/** 地鼠皮毛默认主色(与 mole-pop 的 --mp-mole 同源) */
export const MOLE_FUR = "#D9A06B";
/** 金地鼠皮毛 */
export const MOLE_FUR_GOLD = "#F2C14E";
/** 描边与豆豆眼的墨色 */
export const MOLE_INK = "#54402E";
/** 小黑板板面默认色(与 mole-pop 的 --mp-board 同源) */
export const MOLE_BOARD_FILL = "#4A3B2E";
/** 被敲星星圈固定 3 颗(规格钉死,喜感刚好、不喧宾夺主) */
export const BONK_STAR_COUNT = 3;
/** 被敲压扁倍率(纵向 0.8,只写在 transform 里,单测直接断言) */
export const BONK_SQUASH = 0.8;

function hexParts(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 往白色方向提亮 k(0..1):三停渐变的「顶光」= 主色提亮 20% */
export function moleLighten(hex: string, k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const [r, g, b] = hexParts(hex);
  const m = (x: number): number => Math.round(x + (255 - x) * t);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** 往墨色方向压暗 k(0..1):渐变底部与轮廓阴影用 */
export function moleDarken(hex: string, k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const [r, g, b] = hexParts(hex);
  const m = (x: number): number => Math.round(x * (1 - t));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** 五角小星(星星圈与闪光星芒共用) */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// ---------------------------------------------------------------------------
// 装备层:每种装备一个独立 <g data-part="gear-*">,坐标基于 64×64 的地鼠画布
// ---------------------------------------------------------------------------

/** 小盾牌:木纹圆盾 + 金属包边 + 中心铆钉,抱在胸前 */
function shieldGroup(): string {
  return (
    `<g data-part="gear-shield">` +
    `<circle cx="32" cy="45" r="11" fill="#C89B6C" stroke="#9FA8B8" stroke-width="2.6"/>` +
    `<path d="M24 41a9 9 0 0 1 10-4M25 48a8 8 0 0 0 9 3" stroke="#A87B4F" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="32" cy="45" r="2.6" fill="#8E97A6"/>` +
    `</g>`
  );
}

/** 安全帽:黄色帽盔 + 帽檐 + 下巴帽带 */
function hatGroup(): string {
  return (
    `<g data-part="gear-hat">` +
    `<path d="M21 21a11 10 0 0 1 22 0z" fill="#F5C63C" stroke="#D9A413" stroke-width="1.2"/>` +
    `<rect x="18" y="20" width="28" height="3.6" rx="1.8" fill="#E8B424"/>` +
    `<path d="M30 12.6h4v7h-4z" fill="#FFDE6B"/>` +
    `<path d="M23 23c2 6 4 9 9 10 5-1 7-4 9-10" stroke="#D9A413" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
}

/** 小黑板:木框 + 深色板面 + 挂绳 + 手写体算式 */
function boardGroup(text: string, fill: string): string {
  return (
    `<g data-part="gear-board">` +
    `<path d="M22 6q10 -5 20 0" stroke="#B08355" stroke-width="1.6" fill="none"/>` +
    `<rect x="15" y="7" width="34" height="22" rx="3.4" fill="#C89B6C" stroke="#A87B4F" stroke-width="1.4"/>` +
    `<rect x="18" y="10" width="28" height="16" rx="2" fill="${fill}"/>` +
    `<text x="32" y="21.6" text-anchor="middle" font-size="10" font-weight="700" fill="#FFF6DE" font-family="'Comic Sans MS','Chalkboard SE','Segoe Print',cursive">${text}</text>` +
    `</g>`
  );
}

/** 被敲反馈:头顶转圈的 3 颗小星星(没有锤印、没有痛苦表达) */
function bonkStars(): string {
  const spots: Array<[number, number]> = [
    [14, 12],
    [32, 5],
    [50, 12],
  ];
  const stars = spots
    .slice(0, BONK_STAR_COUNT)
    .map(([x, y]) => `<polygon points="${starPoints(x, y, 4.4, 1.8)}" fill="#FFD75E"/>`)
    .join("");
  return `<g data-part="stars">${stars}</g>`;
}

// ---------------------------------------------------------------------------
// 地鼠主体
// ---------------------------------------------------------------------------

let gradSeq = 0;

/**
 * 生成一只参数化地鼠的 SVG 字符串。
 * 工序:①皮毛三停渐变主体 ②豆豆眼+腮红+大门牙 ③圆爪扒洞沿
 * ④装备层(独立 <g>) ⑤姿态帧(被敲压扁/吐舌/星星圈,或哈欠/瞌睡泡)。
 */
export function moleSvg(opts: MoleSvgOpts = {}): string {
  const gear: MoleGear = opts.gear ?? "none";
  const pose: MolePose = opts.pose ?? "up";
  const fur = opts.fur ?? MOLE_FUR;
  const gid = `mgrad${(gradSeq = (gradSeq + 1) % 1_000_000)}`;
  const sizeAttr =
    opts.size && Number.isFinite(opts.size)
      ? `width="${Math.round(opts.size)}" height="${Math.round(opts.size)}"`
      : `width="100%" height="100%"`;

  const defs =
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${moleLighten(fur, 0.2)}"/>` +
    `<stop offset="55%" stop-color="${fur}"/>` +
    `<stop offset="100%" stop-color="${moleDarken(fur, 0.16)}"/>` +
    `</linearGradient></defs>`;

  // ① 皮毛主体:圆头(窄顶)接圆肩(宽底)的两段贝塞尔轮廓
  const body =
    `<g data-part="body">` +
    `<path d="M14 58C14 44 17 29 24 21.5 28 17 36 17 40 21.5 47 29 50 44 50 58Z" ` +
    `fill="url(#${gid})" stroke="${MOLE_INK}" stroke-width="1.4"/>` +
    `<ellipse cx="32" cy="24.5" rx="9.4" ry="6.2" fill="${moleLighten(fur, 0.3)}" opacity=".55"/>` +
    `</g>`;

  // ② 面部:眼睛按姿态换(豆豆眼 / 眯眯笑 / 闭眼),腮红与大门牙常驻
  let eyes: string;
  if (pose === "bonked") {
    eyes =
      `<path d="M23.4 31.4q2.4-2.8 4.8 0M35.8 31.4q2.4-2.8 4.8 0" ` +
      `stroke="${MOLE_INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  } else if (pose === "yawn" || opts.sleepy) {
    eyes =
      `<path d="M23.4 32.4q2.4 2.2 4.8 0M35.8 32.4q2.4 2.2 4.8 0" ` +
      `stroke="${MOLE_INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  } else {
    eyes =
      `<circle cx="25.8" cy="31.6" r="2.3" fill="${MOLE_INK}"/><circle cx="38.2" cy="31.6" r="2.3" fill="${MOLE_INK}"/>` +
      `<circle cx="26.6" cy="30.8" r=".8" fill="#FFF"/><circle cx="39" cy="30.8" r=".8" fill="#FFF"/>`;
  }
  const mouth =
    pose === "yawn"
      ? `<g data-part="yawn"><ellipse cx="32" cy="42.5" rx="4.6" ry="5" fill="#7E5140"/><ellipse cx="32" cy="44.6" rx="2.6" ry="2" fill="#E58A80"/></g>`
      : `<path d="M27.6 40.6q4.4 3 8.8 0" stroke="${MOLE_INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
        `<g data-part="teeth"><rect x="28.3" y="40.2" width="3.4" height="5.2" rx="1.3" fill="#FFFDF3" stroke="${MOLE_INK}" stroke-width=".7"/>` +
        `<rect x="32.3" y="40.2" width="3.4" height="5.2" rx="1.3" fill="#FFFDF3" stroke="${MOLE_INK}" stroke-width=".7"/></g>`;
  const face =
    `<g data-part="face">` +
    eyes +
    `<ellipse cx="32" cy="36.6" rx="3" ry="2.2" fill="#E58A80"/>` +
    `<circle cx="20.6" cy="37.4" r="2.9" fill="#F2A9A0" opacity=".72"/>` +
    `<circle cx="43.4" cy="37.4" r="2.9" fill="#F2A9A0" opacity=".72"/>` +
    mouth +
    `</g>`;

  // ③ 圆爪一对,扒在洞沿上(画在装备层之下、前沿土堆之上)
  const paws =
    `<g data-part="paws">` +
    `<circle cx="18.5" cy="55.5" r="4.8" fill="${moleLighten(fur, 0.14)}" stroke="${MOLE_INK}" stroke-width="1.1"/>` +
    `<circle cx="45.5" cy="55.5" r="4.8" fill="${moleLighten(fur, 0.14)}" stroke="${MOLE_INK}" stroke-width="1.1"/>` +
    `<path d="M17 52.6v2.8M20 52.2v3M44 52.2v3M47 52.6v2.8" stroke="${MOLE_INK}" stroke-width=".9" stroke-linecap="round"/>` +
    `</g>`;

  // ④ 装备层(独立 <g>,外面按剩余敲击次数控制显隐,这里只管画)
  let gearLayer = "";
  if (gear === "shield") gearLayer = shieldGroup();
  else if (gear === "hat") gearLayer = hatGroup();
  else if (gear === "board") gearLayer = boardGroup(opts.boardText ?? "", MOLE_BOARD_FILL);

  // ⑤ 姿态附加帧
  let extras = "";
  if (pose === "bonked") {
    extras =
      bonkStars() +
      `<g data-part="tongue"><path d="M29.4 40.8q2.6 4.6 5.2 0z" fill="#F27D93" stroke="${MOLE_INK}" stroke-width=".7"/></g>`;
  } else if (pose === "yawn") {
    extras =
      `<g data-part="sleep-bubble"><circle cx="47.5" cy="15" r="4.6" fill="#CFE8FF" opacity=".85"/>` +
      `<circle cx="42.6" cy="21.4" r="2.2" fill="#CFE8FF" opacity=".7"/></g>`;
  }
  if (opts.sleepy && pose === "up") {
    extras += `<g data-part="drowse"><circle cx="46.5" cy="17" r="3.6" fill="#CFE8FF" opacity=".8"/></g>`;
  }
  if (opts.sparkle) {
    extras +=
      `<g data-part="sparkle"><polygon points="${starPoints(13, 20, 3.6, 1.4)}" fill="#FFF3B0"/>` +
      `<polygon points="${starPoints(51, 16, 2.8, 1.1)}" fill="#FFF3B0"/></g>`;
  }

  // 被敲:整只压扁 0.8 倍(绕脚底 y=58 缩放),吐舌笑,绝无痛苦表达
  const squashOpen = pose === "bonked" ? `<g transform="translate(0 11.6) scale(1 ${BONK_SQUASH})">` : "";
  const squashClose = pose === "bonked" ? `</g>` : "";

  return (
    `<svg class="ak-mole ak-mole-${gear} ak-mole-pose-${pose}" viewBox="0 0 64 64" ${sizeAttr} ` +
    `aria-hidden="true" focusable="false">` +
    defs +
    squashOpen +
    body +
    face +
    paws +
    gearLayer +
    squashClose +
    extras +
    `</svg>`
  );
}

/**
 * 单独一件装备的 SVG(独立 DOM 装备层用):同一套 <g data-part="gear-*">,
 * 自带 viewBox,「第一下敲掉装备」只动这个元素,地鼠层一根毛都不动。
 */
export function moleGearSvg(gear: Exclude<MoleGear, "none">, boardText = ""): string {
  const inner =
    gear === "shield" ? shieldGroup() : gear === "hat" ? hatGroup() : boardGroup(boardText, MOLE_BOARD_FILL);
  const viewBox = gear === "shield" ? "18 30 28 28" : gear === "hat" ? "14 8 36 20" : "12 2 40 30";
  return (
    `<svg class="ak-mole-gear ak-mole-gear-${gear}" viewBox="${viewBox}" width="100%" height="100%" ` +
    `aria-hidden="true" focusable="false">${inner}</svg>`
  );
}

/**
 * 花花兔:长耳朵 + 郁金香,剪影和地鼠一眼可分——它不参加游戏,不能敲。
 */
export function bunnySvg(opts: { size?: number } = {}): string {
  const sizeAttr =
    opts.size && Number.isFinite(opts.size)
      ? `width="${Math.round(opts.size)}" height="${Math.round(opts.size)}"`
      : `width="100%" height="100%"`;
  return (
    `<svg class="ak-bunny" viewBox="0 0 64 64" ${sizeAttr} aria-hidden="true" focusable="false">` +
    `<g data-part="bunny">` +
    `<ellipse cx="25" cy="16" rx="4.6" ry="11" fill="#FFF4F7" stroke="#D89AAE" stroke-width="1.2"/>` +
    `<ellipse cx="39" cy="16" rx="4.6" ry="11" fill="#FFF4F7" stroke="#D89AAE" stroke-width="1.2"/>` +
    `<ellipse cx="25" cy="17" rx="2.2" ry="7.4" fill="#FFC9D8"/>` +
    `<ellipse cx="39" cy="17" rx="2.2" ry="7.4" fill="#FFC9D8"/>` +
    `<path d="M15 58C15 42 20 27 32 27 44 27 49 42 49 58Z" fill="#FFF4F7" stroke="#D89AAE" stroke-width="1.4"/>` +
    `<circle cx="26.5" cy="37" r="2.1" fill="#54402E"/><circle cx="37.5" cy="37" r="2.1" fill="#54402E"/>` +
    `<circle cx="22" cy="42" r="2.6" fill="#FFC9D8" opacity=".8"/><circle cx="42" cy="42" r="2.6" fill="#FFC9D8" opacity=".8"/>` +
    `<path d="M30 42.5q2 1.8 4 0" stroke="#54402E" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `</g>` +
    `<g data-part="tulip">` +
    `<path d="M50 46q0 8-3 12" stroke="#7CC96B" stroke-width="1.8" fill="none"/>` +
    `<path d="M46 40q1-5 4-5 1.5 2 0 3.5 3-3 5 0-1 4-4.5 4-3.5 0-4.5-2.5z" fill="#F48FB1" stroke="#D8608C" stroke-width="1"/>` +
    `</g>` +
    `</svg>`
  );
}
