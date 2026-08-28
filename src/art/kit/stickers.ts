/**
 * 共享美术套件 · 教具贴纸图集（1.3 窗口8 第 1 轮 C 档修复新增，独占文件）。
 *
 * 修 W8R1-01 / 02 / 03 的公共底座：math-farm「数一数」计数物、word-garden
 * 看图认字 / 认字选图 / 数一数配图、kitty-care 喂饭道具，1.2 时代都是裸 emoji
 * 直出。题目数据一个字不动——这里给**渲染层**一张「emoji → 自绘 SVG 贴纸」的
 * 映射表，调用方查得到就换贴纸、查不到保持原样（永不抛错、永不拖垮玩法）。
 *
 * 统一工序沿 `crops.ts` 的既定规格：
 *  - 2px 深色描边（主色向黑压 45% 推导），细节件 0.8–1.5px；
 *  - 左上 25% 一块白色高光斑（全库光源左上 45° 约定）；
 *  - 主体底部一枚椭圆软投影；
 *  - 「渐变」用双色分面模拟（亮面 + 暗面两层填充），刻意不用 <defs>/<linearGradient>：
 *    同一页会铺几十枚相同贴纸（数一数 5 头小牛直排），重复 id 是隐患，分面没有这个坑。
 *
 * 纯函数 + 常量：吃 emoji 吐 SVG 字符串，不碰 DOM、不开计时器，node 环境可直接断言。
 * viewBox 统一 48×48。
 */
import { shade } from "./palette";

/** 贴纸色板（粉彩基调，主色向黑压 45% 即描边色） */
export const STICKER_PALETTE = {
  gold: "#ffd93d",
  orange: "#ff9f43",
  red: "#ff6b6b",
  rose: "#f783ac",
  pink: "#ffb3c1",
  skin: "#F2C09A",
  brown: "#b98a5e",
  wood: "#d9a066",
  green: "#7bc86c",
  greenDark: "#569a48",
  teal: "#63c7b2",
  blue: "#74c0fc",
  blueDeep: "#4A7FD8",
  lav: "#b197fc",
  gray: "#ced4da",
  cream: "#fff4e0",
  white: "#ffffff",
  ink: "#4A4458"
} as const;

const P = STICKER_PALETTE;
const INK = P.ink;

/** 主色 → 描边色（向黑压 45%，与 crops 同规） */
export function stickerOutline(main: string): string {
  return shade(main, -45);
}

const o = stickerOutline;

/** 底部软投影（统一件） */
function gs(cx = 24, cy = 42.5, rx = 13): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.2" fill="rgba(70,60,90,.12)"/>`;
}

/** 左上高光斑（统一件） */
function hi(cx: number, cy: number, rx = 3.2, ry = 2): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff" opacity=".45" transform="rotate(-24 ${cx} ${cy})"/>`;
}

/** 两粒眼睛 + 微笑（脸类共用） */
function faceDots(lx: number, rx: number, y: number, my: number, mw = 3.2): string {
  return (
    `<circle cx="${lx}" cy="${y}" r="1.7" fill="${INK}"/>` +
    `<circle cx="${rx}" cy="${y}" r="1.7" fill="${INK}"/>` +
    `<path d="M${(lx + rx) / 2 - mw} ${my} Q${(lx + rx) / 2} ${my + 2.6} ${(lx + rx) / 2 + mw} ${my}"` +
    ` fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`
  );
}

/** 腮红一对 */
function blush(lx: number, rx: number, y: number): string {
  return `<circle cx="${lx}" cy="${y}" r="2.2" fill="#F8B7CD" opacity=".65"/><circle cx="${rx}" cy="${y}" r="2.2" fill="#F8B7CD" opacity=".65"/>`;
}

// ---------------------------------------------------------------------------
// 动物脸骨架：头 + 耳 + 分面暗部 + 五官 + 每种动物的特征件
// ---------------------------------------------------------------------------

interface CritterSpec {
  /** 头部主色 */
  main: string;
  /** 耳型 */
  ear: "round" | "pointy" | "floppy" | "none";
  /** 内耳色（默认粉） */
  earInner?: string;
  /** 画在头后面的特征件（角 / 鬃毛 / 羊毛云…） */
  behind?: string;
  /** 画在头前面的特征件（口鼻 / 条纹 / 鸡冠…） */
  front?: string;
  /** 头半径微调 */
  rx?: number;
  ry?: number;
}

function critterFace(spec: CritterSpec): string {
  const out = o(spec.main);
  const rx = spec.rx ?? 14.5;
  const ry = spec.ry ?? 12.5;
  const earInner = spec.earInner ?? "#F8B7CD";
  let ears = "";
  if (spec.ear === "round") {
    ears =
      `<circle cx="12.5" cy="15" r="5.6" fill="${spec.main}" stroke="${out}" stroke-width="2"/>` +
      `<circle cx="35.5" cy="15" r="5.6" fill="${spec.main}" stroke="${out}" stroke-width="2"/>` +
      `<circle cx="12.5" cy="15" r="2.6" fill="${earInner}"/>` +
      `<circle cx="35.5" cy="15" r="2.6" fill="${earInner}"/>`;
  } else if (spec.ear === "pointy") {
    ears =
      `<path d="M8.5 20 L12 7.5 L20 14.5 Z" fill="${spec.main}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M39.5 20 L36 7.5 L28 14.5 Z" fill="${spec.main}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M11.5 16.5 L13 11.5 L16.5 14.5 Z" fill="${earInner}"/>` +
      `<path d="M36.5 16.5 L35 11.5 L31.5 14.5 Z" fill="${earInner}"/>`;
  } else if (spec.ear === "floppy") {
    ears =
      `<ellipse cx="10.5" cy="21" rx="4.6" ry="8.4" fill="${shade(spec.main, -14)}" stroke="${out}" stroke-width="2" transform="rotate(14 10.5 21)"/>` +
      `<ellipse cx="37.5" cy="21" rx="4.6" ry="8.4" fill="${shade(spec.main, -14)}" stroke="${out}" stroke-width="2" transform="rotate(-14 37.5 21)"/>`;
  }
  return (
    gs() +
    (spec.behind ?? "") +
    ears +
    `<ellipse cx="24" cy="26" rx="${rx}" ry="${ry}" fill="${spec.main}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 ${26 + ry} a${rx} ${ry} 0 0 0 ${rx * 0.92} -${ry * 0.55} a${rx * 1.2} ${ry * 1.2} 0 0 1 -${rx * 0.92} ${ry * 0.55}"` +
    ` fill="${shade(spec.main, -14)}" opacity=".8"/>` +
    (spec.front ?? "") +
    hi(16, 18)
  );
}

/** 猪/牛共用的椭圆口鼻 */
function snout(color: string, cy = 30): string {
  const out = o(color);
  return (
    `<ellipse cx="24" cy="${cy}" rx="6.4" ry="4.6" fill="${color}" stroke="${out}" stroke-width="1.5"/>` +
    `<circle cx="21.6" cy="${cy}" r="1.2" fill="${out}"/>` +
    `<circle cx="26.4" cy="${cy}" r="1.2" fill="${out}"/>`
  );
}

// ---------------------------------------------------------------------------
// 人物半身像骨架（数字花园之外的家人 / 小朋友字卡）
// ---------------------------------------------------------------------------

interface PersonSpec {
  /** 发色；null = 光头顶（爷爷） */
  hair: string | null;
  /** 发型 */
  hairdo: "short" | "buns" | "side" | "bald" | "bun" | "tuft";
  /** 上衣色 */
  coat: string;
  /** 戴眼镜 */
  glasses?: boolean;
  /** 额外件（举手的手 / 奶瓶…） */
  extra?: string;
  /** 头半径（宝宝更圆） */
  r?: number;
}

function personBust(spec: PersonSpec): string {
  const r = spec.r ?? 10.5;
  const coatOut = o(spec.coat);
  const hairOut = spec.hair ? o(spec.hair) : "#8a7a66";
  let hair = "";
  if (spec.hair && spec.hairdo === "short") {
    hair = `<path d="M${24 - r} ${17} A${r} ${r} 0 0 1 ${24 + r} ${17} L${24 + r - 1.5} ${19.5} Q24 ${11.5} ${24 - r + 1.5} ${19.5} Z" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (spec.hair && spec.hairdo === "buns") {
    hair =
      `<circle cx="${24 - r - 0.5}" cy="12.5" r="4" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5"/>` +
      `<circle cx="${24 + r + 0.5}" cy="12.5" r="4" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5"/>` +
      `<path d="M${24 - r} 17 A${r} ${r} 0 0 1 ${24 + r} 17 L${24 + r - 1} 20 Q24 12 ${24 - r + 1} 20 Z" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (spec.hair && spec.hairdo === "side") {
    hair = `<path d="M${24 - r} 18 Q22 ${16 - r} ${24 + r - 2} ${15.5} Q${24 + r + 1} 17 ${24 + r} 20 L${24 + r - 2} 18.5 Q24 13 ${24 - r + 1.6} 20.5 Z" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (spec.hair && spec.hairdo === "bun") {
    hair =
      `<circle cx="24" cy="10.5" r="4.2" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5"/>` +
      `<path d="M${24 - r} 17.5 A${r} ${r} 0 0 1 ${24 + r} 17.5 L${24 + r - 1} 20 Q24 12.5 ${24 - r + 1} 20 Z" fill="${spec.hair}" stroke="${hairOut}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (spec.hair && spec.hairdo === "tuft") {
    hair = `<path d="M22.5 11.5 Q24 7.5 27 9.5 Q25.5 10.5 25.4 12.6" fill="none" stroke="${spec.hair}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else if (spec.hairdo === "bald") {
    hair =
      `<path d="M${24 - r} 19 Q${24 - r - 1} 15 ${24 - r + 3} 14.5 L${24 - r + 3.5} 17.5 Z" fill="#e8e3da" stroke="${hairOut}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M${24 + r} 19 Q${24 + r + 1} 15 ${24 + r - 3} 14.5 L${24 + r - 3.5} 17.5 Z" fill="#e8e3da" stroke="${hairOut}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  const glasses = spec.glasses
    ? `<circle cx="19.5" cy="22.5" r="3.4" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
      `<circle cx="28.5" cy="22.5" r="3.4" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
      `<path d="M22.9 22.5 h2.2" stroke="${INK}" stroke-width="1.3"/>`
    : "";
  return (
    gs(24, 43, 12) +
    // 肩膀上衣
    `<path d="M11 44 Q11 33.5 24 33.5 Q37 33.5 37 44 Z" fill="${spec.coat}" stroke="${coatOut}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M28 34.4 Q34.5 36 35.8 42.5 L37 44 Q37 35 28.5 33.8 Z" fill="${shade(spec.coat, -14)}" opacity=".8"/>` +
    // 头
    `<circle cx="24" cy="22.5" r="${r}" fill="${P.skin}" stroke="${o(P.skin)}" stroke-width="2"/>` +
    hair +
    glasses +
    faceDots(19.5, 28.5, spec.glasses ? 22.8 : 22, 26.2) +
    blush(16.5, 31.5, 25.5) +
    (spec.extra ?? "") +
    hi(18, 15.5, 2.6, 1.6)
  );
}

// ---------------------------------------------------------------------------
// 通用小件（圆果 / 星星 / 叶片…），供多个贴纸复用
// ---------------------------------------------------------------------------

/** 五角星路径点 */
function starPts(cx: number, cy: number, r: number, r2 = r * 0.42): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r2;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** 四芒星（✨ 的火花） */
function sparkPts(cx: number, cy: number, r: number): string {
  const r2 = r * 0.3;
  return (
    `${cx},${cy - r} ${cx + r2},${cy - r2} ${cx + r},${cy} ${cx + r2},${cy + r2} ` +
    `${cx},${cy + r} ${cx - r2},${cy + r2} ${cx - r},${cy} ${cx - r2},${cy - r2}`
  );
}

/** 圆身水果（苹果 / 橘子 / 桃子的共用身体） */
function roundFruit(main: string, extras: string, leaf = true, stem = true): string {
  const out = o(main);
  return (
    gs() +
    `<circle cx="24" cy="27" r="13.5" fill="${main}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 40.5 a13.5 13.5 0 0 0 12.4 -18.8 a16 16 0 0 1 -12.4 18.8" fill="${shade(main, -14)}" opacity=".85"/>` +
    (stem ? `<path d="M24 14 Q23.4 10.5 25.6 8.6" fill="none" stroke="${P.brown}" stroke-width="2.2" stroke-linecap="round"/>` : "") +
    (leaf
      ? `<ellipse cx="29.5" cy="11.5" rx="4.8" ry="2.6" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.5" transform="rotate(-18 29.5 11.5)"/>`
      : "") +
    extras +
    hi(17.5, 20.5)
  );
}

/** 一片叶子（可旋转） */
function leafShape(cx: number, cy: number, len: number, rot: number, fill: string): string {
  const out = o(fill);
  return (
    `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<path d="M${cx} ${cy} q${len * 0.55} ${-len * 0.4} ${len} 0 q${-len * 0.45} ${len * 0.4} ${-len} 0 Z"` +
    ` fill="${fill}" stroke="${out}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M${cx + len * 0.12} ${cy} h${len * 0.72}" stroke="${out}" stroke-width="1" opacity=".6"/>` +
    `</g>`
  );
}

/** 朵状云（☁️ / 🌧️ / 🌤️ 共用） */
function cloudBody(cx: number, cy: number, s: number, fill: string): string {
  const out = o("#9aa7c4");
  return (
    `<path d="M${cx - 12 * s} ${cy + 5 * s}` +
    ` a${6 * s} ${6 * s} 0 0 1 ${2 * s} -${11 * s}` +
    ` a${7.4 * s} ${7.4 * s} 0 0 1 ${13.4 * s} -${2.6 * s}` +
    ` a${6 * s} ${6 * s} 0 0 1 ${8.6 * s} ${5.6 * s}` +
    ` a${4.6 * s} ${4.6 * s} 0 0 1 -${1.6 * s} ${8 * s} Z"` +
    ` fill="${fill}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M${cx - 4 * s} ${cy + 5 * s} h${14 * s} a${4.6 * s} ${4.6 * s} 0 0 0 ${1.4 * s} -${5 * s} a${8 * s} ${8 * s} 0 0 1 -${3 * s} ${5 * s} Z"` +
    ` fill="${shade(fill, -10)}" opacity=".8"/>`
  );
}

// ---------------------------------------------------------------------------
// 贴纸注册表：emoji（去 VS16）→ { 中文名, 画法 }
// ---------------------------------------------------------------------------

type Draw = () => string;

const REGISTRY: Record<string, { name: string; draw: Draw }> = {};

function reg(emoji: string, name: string, draw: Draw): void {
  REGISTRY[emoji.replace(/\uFE0F/g, "")] = { name, draw };
}

// ---- 自然天地 ---------------------------------------------------------------

reg("☀️", "太阳", () => {
  const out = o(P.gold);
  const rays: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const x1 = 24 + Math.cos(a) * 15;
    const y1 = 24 + Math.sin(a) * 15;
    const x2 = 24 + Math.cos(a) * 20;
    const y2 = 24 + Math.sin(a) * 20;
    rays.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${P.orange}" stroke-width="2.6" stroke-linecap="round"/>`);
  }
  return (
    rays.join("") +
    `<circle cx="24" cy="24" r="11.5" fill="${P.gold}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 35.5 a11.5 11.5 0 0 0 10.6 -16 a14 14 0 0 1 -10.6 16" fill="${shade(P.gold, -14)}" opacity=".8"/>` +
    faceDots(20, 28, 22.5, 26) +
    hi(18.5, 18.5)
  );
});

reg("🌙", "月亮", () => {
  const out = o(P.gold);
  return (
    `<path d="M31 8.5 A16.5 16.5 0 1 0 39.5 32 A13 13 0 0 1 31 8.5 Z"` +
    ` fill="${P.gold}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M17 37 A16.5 16.5 0 0 0 39.5 32 A13 13 0 0 1 26 34.5 Z" fill="${shade(P.gold, -13)}" opacity=".75"/>` +
    `<circle cx="18" cy="20" r="1.7" fill="${INK}"/>` +
    `<path d="M16.5 27 Q19 29 21.5 27" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<polygon points="${starPts(38, 12, 3.4)}" fill="${P.gold}" stroke="${out}" stroke-width="1"/>` +
    hi(15.5, 15)
  );
});

reg("💧", "水滴", () => {
  const out = o(P.blue);
  return (
    gs(24, 42, 9) +
    `<path d="M24 6.5 Q34.5 21 34.5 29 A10.5 10.5 0 0 1 13.5 29 Q13.5 21 24 6.5 Z"` +
    ` fill="${P.blue}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 39.5 A10.5 10.5 0 0 0 34.5 29 Q34.5 24 30 16.5 Q33 25 31 31.5 Q29 38.5 24 39.5 Z" fill="${shade(P.blue, -14)}" opacity=".8"/>` +
    `<ellipse cx="19.5" cy="26" rx="2.4" ry="4.2" fill="#ffffff" opacity=".6" transform="rotate(18 19.5 26)"/>`
  );
});

reg("🔥", "火苗", () => {
  const out = o(P.orange);
  return (
    gs(24, 42, 10) +
    `<path d="M24 5.5 Q27 12 31.5 16.5 Q37 22 36.5 29 A12.5 12.5 0 0 1 11.5 29 Q11.2 21 17 14.5 Q15.8 20 19.5 22 Q19 12 24 5.5 Z"` +
    ` fill="${P.orange}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 20 Q29.5 26 29.5 31.5 A5.5 5.5 0 0 1 18.5 31.5 Q18.5 25.5 24 20 Z" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    hi(17.5, 18, 2.4, 1.6)
  );
});

reg("⛰️", "大山", () => {
  const g = "#8fa88f";
  return (
    gs(24, 41.5, 17) +
    `<path d="M4.5 40 L18 13 L28 32 L24.5 40 Z" fill="${shade(g, -10)}" stroke="${o(g)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M18 13 L23.5 24 L20.8 24.5 L18.2 21 Z" fill="#f4f8f4" stroke="${o(g)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M17.5 40 L31 17.5 L43.5 40 Z" fill="${g}" stroke="${o(g)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M31 17.5 L36.5 27.5 L33.6 28 L31.2 25 L28.5 27.6 L26.4 26 Z" fill="#f4f8f4" stroke="${o(g)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M37 40 L43.5 40 L31 17.5 L29.8 19.6 Z" fill="${shade(g, -14)}" opacity=".7"/>` +
    hi(14, 24, 2.2, 1.4)
  );
});

reg("🌾", "麦穗", () => {
  const out = o(P.gold);
  const grain = (x: number, y: number, rot: number): string =>
    `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="4.4" fill="${P.gold}" stroke="${out}" stroke-width="1.2" transform="rotate(${rot} ${x} ${y})"/>`;
  return (
    gs(24, 43, 9) +
    `<path d="M24 43 Q23 28 24.5 12" fill="none" stroke="${P.wood}" stroke-width="2.2" stroke-linecap="round"/>` +
    grain(24.5, 10, 0) +
    grain(19.5, 15.5, -32) + grain(29.5, 15.5, 32) +
    grain(19, 22, -32) + grain(30, 22, 32) +
    grain(18.8, 28.5, -32) + grain(30.2, 28.5, 32) +
    leafShape(24, 36, 9, -152, P.green) +
    hi(20, 12, 1.8, 1.2)
  );
});

reg("🌳", "大树", () => {
  const out = o(P.green);
  return (
    gs(24, 43, 13) +
    `<path d="M21.5 43 L21.8 30 L26.2 30 L26.5 43 Z" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="15" cy="22.5" r="8.4" fill="${P.green}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="33" cy="22.5" r="8.4" fill="${P.green}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="24" cy="14.5" r="9.4" fill="${P.green}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="24" cy="21.5" r="9.5" fill="${P.green}"/>` +
    `<path d="M33 31 a8.4 8.4 0 0 0 7.6 -11 a11 11 0 0 1 -7.6 11" fill="${P.greenDark}" opacity=".75"/>` +
    hi(17.5, 12.5)
  );
});

/** 五瓣小花（🌸 与数一数配图共用画法） */
function blossomBody(petal: string): string {
  const out = o(petal);
  const petals: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    const x = 24 + Math.cos(a) * 9.6;
    const y = 24 + Math.sin(a) * 9.6;
    petals.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${petal}" stroke="${out}" stroke-width="1.8"/>`);
    petals.push(`<circle cx="${(x + 1.4).toFixed(1)}" cy="${(y + 1.6).toFixed(1)}" r="5.2" fill="${shade(petal, -8)}" opacity=".5"/>`);
  }
  return (
    petals.join("") +
    `<circle cx="24" cy="24" r="5.6" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.8"/>` +
    `<circle cx="22.4" cy="22.4" r="1.4" fill="#ffffff" opacity=".6"/>`
  );
}

reg("🌸", "花朵", () => gs(24, 42, 11) + blossomBody(P.pink));

reg("☁️", "白云", () => gs(24, 40, 14) + cloudBody(24, 27, 1.3, "#ffffff") + hi(16, 18, 3.6, 2.2));

reg("🌧️", "下雨", () => {
  const drop = (x: number, y: number): string =>
    `<path d="M${x} ${y} Q${x + 2.4} ${y + 3.6} ${x + 2.4} ${y + 5.2} A2.4 2.4 0 0 1 ${x - 2.4} ${y + 5.2} Q${x - 2.4} ${y + 3.6} ${x} ${y} Z"` +
    ` fill="${P.blue}" stroke="${o(P.blue)}" stroke-width="1.2" stroke-linejoin="round"/>`;
  return cloudBody(24, 20, 1.15, "#eef2fb") + drop(14, 32) + drop(24, 35) + drop(34, 32) + hi(16, 12, 3, 1.8);
});

reg("❄️", "雪花", () => {
  const c = "#9ecdf2";
  const arm = (rot: number): string =>
    `<g transform="rotate(${rot} 24 24)">` +
    `<path d="M24 24 L24 8.5 M24 12.5 L20 8.8 M24 12.5 L28 8.8 M24 18 L20.5 14.6 M24 18 L27.5 14.6"` +
    ` fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>` +
    `</g>`;
  return (
    `<g stroke="${shade(c, -30)}" stroke-width="4.4" opacity=".35">${arm(0)}${arm(60)}${arm(120)}${arm(180)}${arm(240)}${arm(300)}</g>` +
    arm(0) + arm(60) + arm(120) + arm(180) + arm(240) + arm(300) +
    `<circle cx="24" cy="24" r="3" fill="#ffffff" stroke="${c}" stroke-width="1.6"/>`
  );
});

/** 金色五角星本体（⭐ / 🌟 / 数一数星星共用） */
function goldStar(r: number, halo: boolean): string {
  const out = o(P.gold);
  return (
    (halo ? `<circle cx="24" cy="24" r="${r + 7}" fill="${P.gold}" opacity=".22"/>` : "") +
    `<polygon points="${starPts(24, 24, r)}" fill="${P.gold}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="${starPts(24, 24, r * 0.5, r * 0.21)}" fill="#ffffff" opacity=".55"/>` +
    `<circle cx="${24 - r * 0.3}" cy="${24 - r * 0.42}" r="1.6" fill="#ffffff" opacity=".8"/>`
  );
}

reg("⭐", "星星", () => goldStar(16, false));
reg("🌟", "亮星星", () => goldStar(14.5, true));

reg("✨", "小星光", () => {
  const out = o(P.gold);
  return (
    `<polygon points="${sparkPts(21, 26, 13)}" fill="${P.gold}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<polygon points="${sparkPts(35, 13, 6)}" fill="${P.gold}" stroke="${out}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<polygon points="${sparkPts(37, 33, 4.4)}" fill="${shade(P.gold, 18)}" stroke="${out}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<circle cx="17.5" cy="21.5" r="1.6" fill="#ffffff" opacity=".8"/>`
  );
});

reg("⚡", "闪电", () => {
  const out = o(P.gold);
  return (
    `<polygon points="27.5,4.5 13.5,27 21.5,27 18.5,43.5 34.5,20 25.5,20"` +
    ` fill="${P.gold}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="27.5,4.5 25.5,20 34.5,20 30.5,25.5 23,24 25,9 Z" fill="${shade(P.gold, 20)}" opacity=".7"/>` +
    hi(21, 13, 2, 1.3)
  );
});

reg("🌬️", "大风", () => {
  const c = "#8fb8dd";
  const line = (d: string, w: number): string =>
    `<path d="${d}" fill="none" stroke="${shade(c, -25)}" stroke-width="${w + 1.8}" stroke-linecap="round" opacity=".4"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  return (
    line("M6 16 H30 a5 5 0 1 0 -5 -5", 2.6) +
    line("M6 25 H38 a5.4 5.4 0 1 1 -5.4 5.4", 2.6) +
    line("M6 34 H24 a4.2 4.2 0 1 1 -4.2 4.2", 2.2) +
    `<circle cx="10" cy="16" r="1.5" fill="#ffffff" opacity=".8"/>`
  );
});

reg("🌤️", "晴天", () => {
  const out = o(P.gold);
  const rays: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    rays.push(
      `<path d="M${(19 + Math.cos(a) * 10.5).toFixed(1)} ${(17 + Math.sin(a) * 10.5).toFixed(1)} L${(19 + Math.cos(a) * 14.5).toFixed(1)} ${(17 + Math.sin(a) * 14.5).toFixed(1)}" stroke="${P.orange}" stroke-width="2.2" stroke-linecap="round"/>`
    );
  }
  return (
    rays.join("") +
    `<circle cx="19" cy="17" r="8" fill="${P.gold}" stroke="${out}" stroke-width="2"/>` +
    hi(15.5, 13, 2.2, 1.4) +
    cloudBody(28, 31, 0.95, "#ffffff")
  );
});

reg("🍃", "树叶", () =>
  gs(24, 40, 12) +
  leafShape(10, 22, 20, -18, P.green) +
  leafShape(22, 32, 16, 10, P.greenDark) +
  hi(15, 17, 2.4, 1.5));

reg("🌱", "小草", () => {
  const soil = `<ellipse cx="24" cy="39.5" rx="10.5" ry="4" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="2"/>`;
  return (
    gs(24, 42.5, 12) + soil +
    `<path d="M24 37 L24 26" stroke="${P.greenDark}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="18" cy="23" rx="6" ry="3.4" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.8" transform="rotate(-32 18 23)"/>` +
    `<ellipse cx="30" cy="23" rx="6" ry="3.4" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.8" transform="rotate(32 30 23)"/>` +
    hi(16, 20.5, 2, 1.2)
  );
});

reg("🎋", "竹子", () => {
  const c = "#8fce8f";
  const out = o(c);
  const stalk = (x: number, h: number): string =>
    `<rect x="${x}" y="${44 - h}" width="5.6" height="${h}" rx="2.6" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M${x} ${44 - h + h * 0.33} h5.6 M${x} ${44 - h + h * 0.66} h5.6" stroke="${out}" stroke-width="1.4" opacity=".7"/>`;
  return (
    gs(24, 43.5, 13) +
    stalk(15, 34) +
    stalk(26.5, 27) +
    leafShape(20, 9, 11, -28, P.greenDark) +
    leafShape(30, 15, 10, 16, P.green) +
    hi(16.5, 13, 1.6, 3.4)
  );
});

reg("🌻", "向日葵", () => {
  const out = o(P.gold);
  const petals: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i;
    const x = 24 + Math.cos(a) * 11.5;
    const y = 21 + Math.sin(a) * 11.5;
    petals.push(
      `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5.4" ry="2.9" fill="${P.gold}" stroke="${out}" stroke-width="1.4" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
    );
  }
  return (
    gs(24, 43, 10) +
    `<path d="M24 43 Q23.5 36 24 31" fill="none" stroke="${P.greenDark}" stroke-width="2.4" stroke-linecap="round"/>` +
    leafShape(25, 38, 9, 24, P.green) +
    petals.join("") +
    `<circle cx="24" cy="21" r="7.4" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="2"/>` +
    `<circle cx="21.5" cy="19" r="1.1" fill="#ffffff" opacity=".5"/>` +
    `<path d="M20 22.5 h8 M24 18.5 v7" stroke="${o(P.brown)}" stroke-width="1" opacity=".5"/>`
  );
});

reg("🍄", "蘑菇", () => {
  const out = o(P.red);
  return (
    gs(24, 43, 12) +
    `<path d="M17.5 27 L19 41 Q24 43.5 29 41 L30.5 27 Z" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M27 27 L26.5 41.8 Q28 41.6 29 41 L30.5 27 Z" fill="${shade(P.cream, -12)}" opacity=".8"/>` +
    `<path d="M8.5 27 Q9 13.5 24 13.5 Q39 13.5 39.5 27 Q32 29.5 24 29.5 Q16 29.5 8.5 27 Z"` +
    ` fill="${P.red}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M30 28.9 Q35 28.3 39.5 27 Q39.2 18 32.5 15 Q36 20.5 34.5 25.5 Z" fill="${shade(P.red, -14)}" opacity=".8"/>` +
    `<circle cx="17" cy="20.5" r="2.6" fill="#ffffff" opacity=".9"/>` +
    `<circle cx="27" cy="17.5" r="2" fill="#ffffff" opacity=".9"/>` +
    `<circle cx="33" cy="23" r="1.7" fill="#ffffff" opacity=".9"/>` +
    hi(15, 16.5)
  );
});

reg("🌷", "郁金香", () => {
  const c = P.rose;
  const out = o(c);
  return (
    gs(24, 43, 10) +
    `<path d="M24 43 Q23.5 34 24 27" fill="none" stroke="${P.greenDark}" stroke-width="2.4" stroke-linecap="round"/>` +
    leafShape(23, 37, 10, -160, P.green) +
    `<path d="M15.5 10.5 Q15 22 19 26 Q24 29.5 29 26 Q33 22 32.5 10.5 L28.5 15.5 L24 9.5 L19.5 15.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M28 27.6 Q31 26 32 22 Q33 17 32.5 10.5 L30.5 13 Q31.5 22 28 27.6 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    hi(19, 15, 2.2, 1.5)
  );
});

reg("🍀", "四叶草", () => {
  const out = o(P.green);
  const leaf4 = (rot: number): string =>
    `<g transform="rotate(${rot} 24 23)">` +
    `<path d="M24 23 C16 15 8 19 12.5 26 C15.5 30.5 21 28 24 23 Z" fill="${P.green}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `</g>`;
  return (
    gs(24, 42, 11) +
    `<path d="M24 26 Q25.5 35 23 42" fill="none" stroke="${P.greenDark}" stroke-width="2.2" stroke-linecap="round"/>` +
    leaf4(0) + leaf4(90) + leaf4(180) + leaf4(270) +
    `<circle cx="24" cy="23" r="2" fill="${P.greenDark}"/>` +
    hi(16, 15, 2.4, 1.5)
  );
});

reg("🦋", "蝴蝶", () => {
  const a = P.lav;
  const b = P.rose;
  return (
    gs(24, 41, 12) +
    `<path d="M22 22 Q8 8 5.5 16 Q4 23 15 26 Q6.5 28 9 34.5 Q11.5 40 21 30 Z" fill="${a}" stroke="${o(a)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M26 22 Q40 8 42.5 16 Q44 23 33 26 Q41.5 28 39 34.5 Q36.5 40 27 30 Z" fill="${b}" stroke="${o(b)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="12.5" cy="18" r="2.2" fill="#ffffff" opacity=".7"/>` +
    `<circle cx="35.5" cy="18" r="2.2" fill="#ffffff" opacity=".7"/>` +
    `<ellipse cx="24" cy="26" rx="2.6" ry="7.4" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="1.6"/>` +
    `<path d="M22.5 19.5 Q20 14 17.5 12.5 M25.5 19.5 Q28 14 30.5 12.5" fill="none" stroke="${o(P.brown)}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="17.5" cy="12.5" r="1.3" fill="${o(P.brown)}"/><circle cx="30.5" cy="12.5" r="1.3" fill="${o(P.brown)}"/>`
  );
});

reg("🐞", "瓢虫", () => {
  const out = o(P.red);
  return (
    gs(24, 41, 12) +
    `<circle cx="24" cy="17" r="6.4" fill="${INK}" stroke="${shade(INK, -20)}" stroke-width="1.6"/>` +
    `<path d="M20 12 Q17 8 14.5 7.5 M28 12 Q31 8 33.5 7.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="14.5" cy="7.5" r="1.2" fill="${INK}"/><circle cx="33.5" cy="7.5" r="1.2" fill="${INK}"/>` +
    `<circle cx="21.8" cy="15.5" r="1.3" fill="#ffffff"/><circle cx="26.2" cy="15.5" r="1.3" fill="#ffffff"/>` +
    `<path d="M9.5 28 A14.5 13.5 0 0 1 38.5 28 A14.5 13.5 0 0 1 9.5 28 Z" fill="${P.red}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 14.8 V41.2" stroke="${out}" stroke-width="1.8"/>` +
    `<path d="M24 41.4 A14.5 13.5 0 0 0 38.5 28 A16 15 0 0 1 24 41.4 Z" fill="${shade(P.red, -14)}" opacity=".75"/>` +
    `<circle cx="17" cy="25" r="2.4" fill="${INK}"/><circle cx="31" cy="25" r="2.4" fill="${INK}"/>` +
    `<circle cx="19.5" cy="33" r="2" fill="${INK}"/><circle cx="28.5" cy="33" r="2" fill="${INK}"/>` +
    hi(16.5, 22)
  );
});

// ---- 动物朋友（脸类） --------------------------------------------------------

reg("🐮", "小牛", () =>
  critterFace({
    main: "#f2e6d4",
    ear: "round",
    earInner: "#e8c9a0",
    behind:
      `<path d="M17.5 12.5 Q13.5 9.5 14.5 4.5 Q19.5 5.5 20.5 11 Z" fill="#e4ddd2" stroke="${o("#e4ddd2")}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M30.5 12.5 Q34.5 9.5 33.5 4.5 Q28.5 5.5 27.5 11 Z" fill="#e4ddd2" stroke="${o("#e4ddd2")}" stroke-width="1.8" stroke-linejoin="round"/>`,
    front:
      `<path d="M31 15.5 Q38 15 38.2 22 Q38 27.5 32.5 27 Q29.5 24 30 20 Z" fill="#c9a06e" opacity=".7"/>` +
      faceDots(17.5, 30.5, 21.5, 24, 2.2) +
      `<ellipse cx="24" cy="31.5" rx="8.2" ry="5.2" fill="#f2cfc4" stroke="${o("#f2cfc4")}" stroke-width="1.5"/>` +
      `<ellipse cx="20.6" cy="31.2" rx="1.3" ry="1.7" fill="${o("#f2cfc4")}"/>` +
      `<ellipse cx="27.4" cy="31.2" rx="1.3" ry="1.7" fill="${o("#f2cfc4")}"/>` +
      blush(13.5, 34.5, 26)
  }));

reg("🐑", "小羊", () => {
  const wool = "#f4f0e6";
  const wo = o(wool);
  const puffs: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
    puffs.push(`<circle cx="${(24 + Math.cos(a) * 12.5).toFixed(1)}" cy="${(24 + Math.sin(a) * 11).toFixed(1)}" r="6.4" fill="${wool}" stroke="${wo}" stroke-width="1.8"/>`);
  }
  return (
    gs() +
    puffs.join("") +
    `<circle cx="24" cy="24" r="12" fill="${wool}"/>` +
    `<ellipse cx="10.5" cy="26" rx="3" ry="4.6" fill="#d8c4b2" stroke="${o("#d8c4b2")}" stroke-width="1.5" transform="rotate(20 10.5 26)"/>` +
    `<ellipse cx="37.5" cy="26" rx="3" ry="4.6" fill="#d8c4b2" stroke="${o("#d8c4b2")}" stroke-width="1.5" transform="rotate(-20 37.5 26)"/>` +
    `<ellipse cx="24" cy="27" rx="8.4" ry="7.4" fill="#efe0d2" stroke="${o("#efe0d2")}" stroke-width="1.8"/>` +
    faceDots(20.5, 27.5, 25, 29, 2.4) +
    blush(17.5, 30.5, 28.5) +
    hi(16, 15)
  );
});

reg("🐴", "小马", () =>
  critterFace({
    main: "#d9a066",
    ear: "pointy",
    earInner: "#f2d0b0",
    behind: `<path d="M24 6 Q31 6.5 33.5 13.5 L29 12.5 Q31 16 30 19.5 L24 12.5 Z" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="1.8" stroke-linejoin="round"/>`,
    front:
      `<path d="M20 10.5 Q24 7.5 28 10.5 L27 14.5 Q24 12.5 21 14.5 Z" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="1.6" stroke-linejoin="round"/>` +
      faceDots(18, 30, 21.5, 24, 2.4) +
      `<ellipse cx="24" cy="31" rx="7" ry="5" fill="#efd3b3" stroke="${o("#efd3b3")}" stroke-width="1.5"/>` +
      `<circle cx="21.4" cy="30.5" r="1.2" fill="${o("#d9a066")}"/><circle cx="26.6" cy="30.5" r="1.2" fill="${o("#d9a066")}"/>`
  }));

reg("🐶", "小狗", () =>
  critterFace({
    main: "#e8c9a0",
    ear: "floppy",
    front:
      faceDots(18, 30, 22, 25.5, 2.6) +
      `<ellipse cx="24" cy="29.5" rx="5.6" ry="4" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.4"/>` +
      `<ellipse cx="24" cy="27.8" rx="2.2" ry="1.7" fill="${INK}"/>` +
      blush(15.5, 32.5, 27)
  }));

reg("🐱", "小猫", () =>
  critterFace({
    main: "#f4c07c",
    ear: "pointy",
    front:
      faceDots(18, 30, 22, 25.5, 2.6) +
      `<path d="M22.4 28.4 L25.6 28.4 L24 30.4 Z" fill="#e8837c" stroke="${o("#e8837c")}" stroke-width="1"/>` +
      `<path d="M8.5 25 L15.5 26 M8.5 30 L15.5 29 M39.5 25 L32.5 26 M39.5 30 L32.5 29"` +
      ` stroke="${o("#f4c07c")}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M17 12.5 q3.4 -1.2 6 1.8 M31 12.5 q-3.4 -1.2 -6 1.8" fill="none" stroke="${o("#f4c07c")}" stroke-width="1.1" opacity=".5"/>` +
      blush(15.5, 32.5, 27)
  }));

reg("🐰", "兔子", () => {
  const c = "#f6f0f4";
  const out = o(c);
  return (
    gs() +
    `<ellipse cx="16" cy="10" rx="4.6" ry="9.4" fill="${c}" stroke="${out}" stroke-width="2" transform="rotate(-10 16 10)"/>` +
    `<ellipse cx="32" cy="10" rx="4.6" ry="9.4" fill="${c}" stroke="${out}" stroke-width="2" transform="rotate(10 32 10)"/>` +
    `<ellipse cx="16.6" cy="10.5" rx="2" ry="6" fill="#f8ccd8" transform="rotate(-10 16.6 10.5)"/>` +
    `<ellipse cx="31.4" cy="10.5" rx="2" ry="6" fill="#f8ccd8" transform="rotate(10 31.4 10.5)"/>` +
    `<ellipse cx="24" cy="27" rx="14" ry="12" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 39 a14 12 0 0 0 12.8 -6.6 a16 14 0 0 1 -12.8 6.6" fill="${shade(c, -10)}" opacity=".8"/>` +
    faceDots(18, 30, 24, 27.5, 2.4) +
    `<path d="M22.6 29.8 L25.4 29.8 L24 31.6 Z" fill="#e8837c"/>` +
    `<path d="M24 31.6 q-2 2.4 -4 1 M24 31.6 q2 2.4 4 1" fill="none" stroke="${out}" stroke-width="1.2" stroke-linecap="round"/>` +
    blush(15.5, 32.5, 29) +
    hi(16, 19)
  );
});

reg("🐷", "小猪", () =>
  critterFace({
    main: "#f8b7c6",
    ear: "pointy",
    earInner: "#f090a8",
    front: faceDots(17.5, 30.5, 21.5, 24, 2) + snout("#f090a8", 29.5) + blush(14.5, 33.5, 27.5)
  }));

reg("🐔", "小鸡", () =>
  critterFace({
    main: "#f8e3b0",
    ear: "none",
    behind:
      `<circle cx="18.5" cy="9" r="3.6" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.6"/>` +
      `<circle cx="24.5" cy="7" r="4" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.6"/>` +
      `<circle cx="30.5" cy="9" r="3.6" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.6"/>`,
    front:
      `<polygon points="24,26 20.5,30.5 27.5,30.5" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<circle cx="18.5" cy="22.5" r="1.7" fill="${INK}"/><circle cx="29.5" cy="22.5" r="1.7" fill="${INK}"/>` +
      `<path d="M13 15.5 Q10 17.5 10.5 21 L14.5 19.5" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.3" stroke-linejoin="round"/>` +
      blush(15, 33, 26.5)
  }));

reg("🐢", "乌龟", () => {
  const sh = "#8fbc6f";
  const skin = "#c3dba0";
  return (
    gs(24, 41.5, 15) +
    `<ellipse cx="38" cy="27.5" rx="5.4" ry="4.6" fill="${skin}" stroke="${o(skin)}" stroke-width="2"/>` +
    `<circle cx="39.6" cy="26" r="1.4" fill="${INK}"/>` +
    `<path d="M37.5 29.5 q2 1.4 3.8 0" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="13" cy="38" rx="3.4" ry="2.6" fill="${skin}" stroke="${o(skin)}" stroke-width="1.8"/>` +
    `<ellipse cx="28" cy="38.5" rx="3.4" ry="2.6" fill="${skin}" stroke="${o(skin)}" stroke-width="1.8"/>` +
    `<path d="M7.5 32 Q6 29.5 8 28.5 L11 30.5 Z" fill="${skin}" stroke="${o(skin)}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M8 32.5 A16.5 13.5 0 0 1 37 26 Q38 32.5 33 35.5 Q24 39.5 13.5 36.5 Q9.5 35 8 32.5 Z"` +
    ` fill="${sh}" stroke="${o(sh)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M15.5 35.8 L18 26.5 L26 24.5 L32 28 L33 35.4 M18 26.5 L14 22 M26 24.5 L25.5 18.6 M32 28 L36.4 25.5"` +
    ` fill="none" stroke="${o(sh)}" stroke-width="1.3" opacity=".65"/>` +
    hi(15, 24, 2.8, 1.7)
  );
});

reg("🐻", "小熊", () =>
  critterFace({
    main: "#c99b6a",
    ear: "round",
    earInner: "#e8c9a0",
    front:
      faceDots(18, 30, 22, 25.5, 2.6) +
      `<ellipse cx="24" cy="29.5" rx="6" ry="4.4" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.4"/>` +
      `<ellipse cx="24" cy="27.6" rx="2.2" ry="1.7" fill="${INK}"/>` +
      blush(15, 33, 27)
  }));

reg("🐘", "大象", () => {
  const c = "#b8c4dd";
  const out = o(c);
  return (
    gs() +
    `<ellipse cx="9.5" cy="24" rx="7" ry="9.4" fill="${shade(c, -8)}" stroke="${out}" stroke-width="2"/>` +
    `<ellipse cx="38.5" cy="24" rx="7" ry="9.4" fill="${shade(c, -8)}" stroke="${out}" stroke-width="2"/>` +
    `<ellipse cx="10.5" cy="24.5" rx="3.6" ry="6" fill="#dcc6d2" opacity=".8"/>` +
    `<ellipse cx="37.5" cy="24.5" rx="3.6" ry="6" fill="#dcc6d2" opacity=".8"/>` +
    `<ellipse cx="24" cy="24" rx="13.5" ry="12" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 36 a13.5 12 0 0 0 12.4 -6.8 a15.5 14 0 0 1 -12.4 6.8" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M21.5 28 Q20.5 36 24.5 40.5 Q27 43 29.5 41.5 Q26.5 40 26.4 36 Q26.3 31.5 26.5 28 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M22.6 32 h3.7 M22.5 35.5 h3.8" stroke="${out}" stroke-width="1" opacity=".6"/>` +
    `<circle cx="18.5" cy="22.5" r="1.7" fill="${INK}"/><circle cx="29.5" cy="22.5" r="1.7" fill="${INK}"/>` +
    blush(14.5, 33.5, 26) +
    hi(17, 16)
  );
});

reg("🐯", "老虎", () =>
  critterFace({
    main: "#f4b04c",
    ear: "round",
    earInner: "#f8dcb0",
    front:
      `<path d="M16 13.5 L18.5 17.5 L14.5 17 Z M32 13.5 L29.5 17.5 L33.5 17 Z M24 10.6 L25.8 14.6 L22.2 14.6 Z"` +
      ` fill="${o("#f4b04c")}" opacity=".85"/>` +
      `<path d="M9.8 23 L14 24.2 M9.8 29 L14 28 M38.2 23 L34 24.2 M38.2 29 L34 28" stroke="${o("#f4b04c")}" stroke-width="2" stroke-linecap="round" opacity=".85"/>` +
      faceDots(18, 30, 22, 25.5, 2.4) +
      `<ellipse cx="24" cy="29.5" rx="5.4" ry="4" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.4"/>` +
      `<path d="M22.5 27.8 L25.5 27.8 L24 29.6 Z" fill="#d4756c"/>` +
      `<path d="M20 31.8 q0.5 1.6 2 1.2 M28 31.8 q-0.5 1.6 -2 1.2" fill="none" stroke="${o(P.cream)}" stroke-width="1" stroke-linecap="round"/>`
  }));

reg("🐸", "青蛙", () => {
  const c = "#8fce6f";
  const out = o(c);
  return (
    gs() +
    `<circle cx="14.5" cy="13.5" r="6.4" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="33.5" cy="13.5" r="6.4" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="14.5" cy="13.5" r="3.4" fill="#ffffff" stroke="${out}" stroke-width="1.2"/>` +
    `<circle cx="33.5" cy="13.5" r="3.4" fill="#ffffff" stroke="${out}" stroke-width="1.2"/>` +
    `<circle cx="15" cy="14" r="1.7" fill="${INK}"/><circle cx="33" cy="14" r="1.7" fill="${INK}"/>` +
    `<path d="M9.5 26 A14.5 12.5 0 0 1 38.5 26 A14.5 12 0 0 1 9.5 26 Z" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 38 A14.5 12 0 0 0 38.5 26 A16.5 14 0 0 1 24 38" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M17 28.5 Q24 33.5 31 28.5" fill="none" stroke="${out}" stroke-width="1.6" stroke-linecap="round"/>` +
    blush(13.5, 34.5, 28) +
    hi(16, 21)
  );
});

// ---- 动物朋友（侧身类） ------------------------------------------------------

reg("🐦", "小鸟", () => {
  const c = "#7fc8e8";
  const out = o(c);
  return (
    gs(24, 41, 11) +
    `<path d="M31 30 L42 24.5 L33.5 34 Z" fill="${shade(c, -12)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cx="21" cy="24" r="12.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M21 36.5 a12.5 12.5 0 0 0 11.5 -17.4 a14.5 14.5 0 0 1 -11.5 17.4" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M17 24 Q10 26.5 12.5 33 Q18 34.5 22.5 30 Z" fill="${shade(c, -12)}" stroke="${out}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<polygon points="8.5,20 3.5,22.5 8.8,24.4" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="14.5" cy="20" r="1.8" fill="${INK}"/>` +
    `<circle cx="15.2" cy="19.3" r="0.6" fill="#ffffff"/>` +
    `<path d="M18 40.5 L18 36.5 M23 40.8 L23 37" stroke="${P.orange}" stroke-width="1.8" stroke-linecap="round"/>` +
    hi(14, 16)
  );
});

reg("🐟", "小鱼", () => {
  const c = "#7fc8e8";
  const out = o(c);
  return (
    gs(24, 40, 12) +
    `<path d="M36 24 L45 16.5 Q44.5 24 45 31.5 Z" fill="${shade(c, -10)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<ellipse cx="22" cy="24" rx="16" ry="11" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M22 35 a16 11 0 0 0 14.7 -6.2 a18 13 0 0 1 -14.7 6.2" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M20 16.5 Q24 12 28.5 15 L26 19.5 Z" fill="${shade(c, -10)}" stroke="${out}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M20 24 Q24 20.5 27.5 24 Q24 27.5 20 24 Z" fill="${shade(c, -12)}" opacity=".7"/>` +
    `<circle cx="12" cy="21.5" r="1.9" fill="${INK}"/>` +
    `<circle cx="12.7" cy="20.8" r="0.6" fill="#ffffff"/>` +
    `<path d="M9 27.5 q2.6 1.6 5 0" fill="none" stroke="${out}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="6" cy="13.5" r="1.6" fill="none" stroke="${c}" stroke-width="1.2"/>` +
    hi(13, 17.5, 2.6, 1.6)
  );
});

reg("🐛", "毛毛虫", () => {
  const c = "#a8d878";
  const out = o(c);
  const seg = (x: number, y: number, r: number, dark: boolean): string =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark ? shade(c, -10) : c}" stroke="${out}" stroke-width="1.8"/>`;
  return (
    gs(24, 41, 15) +
    seg(38, 35, 5.4, true) +
    seg(31.5, 33, 6, false) +
    seg(24.5, 31.5, 6.6, true) +
    seg(17, 30.5, 7, false) +
    `<circle cx="11.5" cy="24.5" r="8.4" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M8 17 Q6 13.5 4.5 12.5 M15 17 Q17 13.5 18.5 12.5" fill="none" stroke="${out}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="4.5" cy="12.5" r="1.3" fill="${out}"/><circle cx="18.5" cy="12.5" r="1.3" fill="${out}"/>` +
    faceDots(8.5, 14.5, 23, 26.5, 2) +
    blush(6, 17, 27.5) +
    hi(8.5, 19, 2, 1.3)
  );
});

reg("🦆", "鸭子", () => {
  const c = "#f8dc8c";
  const out = o(c);
  return (
    gs(24, 40.5, 14) +
    `<path d="M34 28 L43.5 24 Q42.5 31 38 33.5 Z" fill="${shade(c, -10)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M9 27 A14.5 11.5 0 0 0 38 28.5 Q30 24.5 26.5 27.5 Q18 34 9 27 Z" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round" transform="translate(0 6)"/>` +
    `<circle cx="15" cy="17.5" r="8.6" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M8 19.5 Q3 19 1.8 21.8 Q4.5 24.5 9 23.5 L13 21.5 Z" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M14 30.5 Q7 32 8 37 Q15 39 20.5 34.5 Z" fill="${shade(c, -12)}" stroke="${out}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="14" cy="15" r="1.8" fill="${INK}"/>` +
    `<circle cx="14.7" cy="14.3" r="0.6" fill="#ffffff"/>` +
    `<path d="M20 15.5 q2 -4.5 -1 -8" fill="none" stroke="${out}" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>` +
    hi(11, 11.5, 2.2, 1.4)
  );
});

reg("🦢", "白鹅", () => {
  const c = "#faf7f2";
  const out = "#a99f92";
  const neck = "M15 31 Q8.5 24 12.5 16.5 Q16 10.5 21.5 12";
  return (
    gs(24, 41.5, 15) +
    `<ellipse cx="27" cy="31.5" rx="14" ry="8.8" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M27 40.3 a14 8.8 0 0 0 12.9 -5 a16 10.4 0 0 1 -12.9 5" fill="${shade(c, -9)}" opacity=".85"/>` +
    `<path d="M23 27.5 Q35 24 38 31.5 Q31.5 37 23.5 34 Z" fill="#ffffff" stroke="${out}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="${neck}" fill="none" stroke="${out}" stroke-width="7.6" stroke-linecap="round"/>` +
    `<path d="${neck}" fill="none" stroke="${c}" stroke-width="5.6" stroke-linecap="round"/>` +
    `<circle cx="22.5" cy="12.5" r="4.8" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<polygon points="26.8,11 32.5,12.5 27,14.6" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="23.8" cy="11.4" r="1.4" fill="${INK}"/>` +
    `<path d="M8 42.5 Q13 40.5 18 42.5 Q23 44.5 28 42.5" fill="none" stroke="#a8d4ee" stroke-width="2" stroke-linecap="round" opacity=".9"/>` +
    hi(20.5, 9.5, 1.8, 1.1)
  );
});

reg("🦉", "猫头鹰", () => {
  const c = "#b98a5e";
  const out = o(c);
  return (
    gs() +
    `<path d="M12 12 L15.5 5.5 L19 12 Z M36 12 L32.5 5.5 L29 12 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<ellipse cx="24" cy="25" rx="14.5" ry="16" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 41 a14.5 16 0 0 0 13.3 -9 a16 17.5 0 0 1 -13.3 9" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M24 31 Q17 27.5 15.5 33.5 Q17.5 39 24 38.5 Q30.5 39 32.5 33.5 Q31 27.5 24 31 Z" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.5"/>` +
    `<path d="M20 33.5 h2.4 M25.6 33.5 h2.4 M21.5 36.3 h2.4" stroke="${o(P.cream)}" stroke-width="1" opacity=".7"/>` +
    `<circle cx="17.5" cy="19.5" r="6" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.6"/>` +
    `<circle cx="30.5" cy="19.5" r="6" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.6"/>` +
    `<circle cx="17.5" cy="19.5" r="2.4" fill="${INK}"/><circle cx="30.5" cy="19.5" r="2.4" fill="${INK}"/>` +
    `<circle cx="18.3" cy="18.7" r="0.8" fill="#ffffff"/><circle cx="31.3" cy="18.7" r="0.8" fill="#ffffff"/>` +
    `<polygon points="24,24 21.8,27.5 26.2,27.5" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.3" stroke-linejoin="round"/>` +
    hi(15, 12)
  );
});

reg("🐝", "小蜜蜂", () => {
  const c = P.gold;
  const out = o(c);
  return (
    gs(24, 40, 12) +
    `<ellipse cx="16.5" cy="12" rx="7.4" ry="4.6" fill="#dcecf8" stroke="#9ab4cc" stroke-width="1.5" transform="rotate(-28 16.5 12)"/>` +
    `<ellipse cx="28" cy="10.5" rx="7.4" ry="4.6" fill="#eef6fc" stroke="#9ab4cc" stroke-width="1.5" transform="rotate(-8 28 10.5)"/>` +
    `<ellipse cx="26" cy="27" rx="14" ry="10.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M22 17.5 Q19.5 22 19.5 27 Q19.5 32 22 36.6 L27 37.4 Q23.8 32 23.8 27 Q23.8 22 27 16.8 Z" fill="${INK}"/>` +
    `<path d="M31 18.6 Q28.5 22.5 28.5 27 Q28.5 31.5 31 35.6 L35.5 33.5 Q33 30.5 33 27 Q33 23.5 35.5 20.6 Z" fill="${INK}"/>` +
    `<circle cx="12" cy="24" r="7" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M9 18 Q7 14.5 5 13.5 M14 17.5 Q14.5 13.5 16.5 12" fill="none" stroke="${out}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="5" cy="13.5" r="1.2" fill="${out}"/><circle cx="16.5" cy="12" r="1.2" fill="${out}"/>` +
    faceDots(9.5, 14.5, 22.5, 26, 1.8) +
    hi(9, 20, 1.8, 1.2)
  );
});

// ---- 身体和宝贝 -------------------------------------------------------------

reg("✋", "小手", () => {
  const c = P.skin;
  const out = o(c);
  return (
    gs(24, 43, 11) +
    `<path d="M15.5 27 L15.5 15 A2.6 2.6 0 0 1 20.7 15 L20.7 12 A2.7 2.7 0 0 1 26.1 12 L26.1 13.5 A2.6 2.6 0 0 1 31.3 13.5 L31.3 17 A2.5 2.5 0 0 1 36.3 17 L36.3 30 Q36.3 40 26.5 40 Q18 40 15.8 33 L11.5 26.5 A2.4 2.4 0 0 1 15.5 24 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M26.5 40 Q34 39.5 35.8 32 L36.3 22 Q34.5 32.5 30 36 Q28.5 38.5 26.5 40 Z" fill="${shade(c, -12)}" opacity=".7"/>` +
    `<path d="M20.7 15 V23 M26.1 14 V23 M31.3 17 V23.5" stroke="${out}" stroke-width="1.2" opacity=".55"/>` +
    hi(19, 18, 2.2, 3.2)
  );
});

reg("👄", "嘴巴", () => {
  const c = "#f06a8a";
  const out = o(c);
  return (
    gs(24, 38, 13) +
    `<path d="M8 24 Q13 15.5 19 18.5 Q22 20.5 24 20.5 Q26 20.5 29 18.5 Q35 15.5 40 24 Q34 34.5 24 34.5 Q14 34.5 8 24 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 34.5 Q34 34.5 40 24 Q36 31.5 27 32.6 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M9.5 24 Q24 27.5 38.5 24" fill="none" stroke="${out}" stroke-width="1.6" stroke-linecap="round"/>` +
    hi(15, 20, 3, 1.7)
  );
});

reg("👂", "耳朵", () => {
  const c = P.skin;
  const out = o(c);
  return (
    gs(24, 41, 10) +
    `<path d="M17 20 Q16 8.5 25.5 8 Q34.5 7.5 34 17.5 Q33.6 24 28.5 29 Q25 32.5 25 37 A5.4 5.4 0 0 1 14.3 36.6"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M22 19.5 Q22.5 13 28 13.5 Q30.5 14 29.8 18.5 Q29.4 22 26 25.5" fill="none" stroke="${out}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
    hi(21, 12, 2.6, 1.6)
  );
});

reg("👀", "眼睛", () => {
  const out = "#8a8098";
  const eye = (cx: number): string =>
    `<ellipse cx="${cx}" cy="24" rx="9" ry="11" fill="#ffffff" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="${cx + 2.4}" cy="26" r="4" fill="${INK}"/>` +
    `<circle cx="${cx + 3.6}" cy="24.6" r="1.3" fill="#ffffff"/>`;
  return gs(24, 40, 14) + eye(13.5) + eye(34.5) + hi(9.5, 16, 2, 2.8);
});

reg("🦶", "小脚", () => {
  const c = P.skin;
  const out = o(c);
  return (
    gs(24, 41.5, 14) +
    `<path d="M13 14 Q22 8.5 28.5 15 Q33 20 32.5 27 L36.5 30.5 Q40.5 34.5 37 38.5 Q32 42.5 22 41 Q12.5 39.5 11 30 Q9.8 21 13 14 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M22 41 Q32 42.5 37 38.5 Q39.5 35.5 37.5 32.5 Q36 38 28 38.6 Q24.5 40.5 22 41 Z" fill="${shade(c, -12)}" opacity=".7"/>` +
    `<circle cx="12.6" cy="11.5" r="3.2" fill="${c}" stroke="${out}" stroke-width="1.6"/>` +
    `<circle cx="19" cy="9.5" r="2.4" fill="${c}" stroke="${out}" stroke-width="1.5"/>` +
    `<circle cx="24.5" cy="10" r="2.2" fill="${c}" stroke="${out}" stroke-width="1.5"/>` +
    `<circle cx="29.3" cy="11.8" r="2" fill="${c}" stroke="${out}" stroke-width="1.4"/>` +
    hi(17, 17, 2.6, 3.4)
  );
});

reg("🦷", "牙齿", () => {
  const c = "#fdfdfa";
  const out = "#a8a4b8";
  return (
    gs(24, 42, 11) +
    `<path d="M12 15.5 Q13 7.5 19.5 8 Q23 8.3 24 10.5 Q25 8.3 28.5 8 Q35 7.5 36 15.5 Q36.8 22 33.5 30 Q31.5 39.5 28.5 39.5 Q26 39.5 26 32 Q26 28.5 24 28.5 Q22 28.5 22 32 Q22 39.5 19.5 39.5 Q16.5 39.5 14.5 30 Q11.2 22 12 15.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M33.5 30 Q36.8 22 36 15.5 Q35.5 11.5 33 9.5 Q34.5 15 33.2 21.5 Q32.2 26.5 31.5 30.8 Z" fill="#d8d4e4" opacity=".8"/>` +
    hi(18, 13, 3, 2)
  );
});

/** 心形路径（❤️ / 💖 共用） */
function heartPath(cx: number, cy: number, s: number): string {
  return (
    `M${cx} ${cy + 14 * s}` +
    ` C${cx - 16 * s} ${cy + 2 * s} ${cx - 13 * s} ${cy - 12 * s} ${cx - 6.5 * s} ${cy - 12 * s}` +
    ` C${cx - 2.5 * s} ${cy - 12 * s} ${cx} ${cy - 9 * s} ${cx} ${cy - 6.5 * s}` +
    ` C${cx} ${cy - 9 * s} ${cx + 2.5 * s} ${cy - 12 * s} ${cx + 6.5 * s} ${cy - 12 * s}` +
    ` C${cx + 13 * s} ${cy - 12 * s} ${cx + 16 * s} ${cy + 2 * s} ${cx} ${cy + 14 * s} Z`
  );
}

reg("❤️", "爱心", () => {
  const out = o(P.red);
  return (
    gs(24, 42, 12) +
    `<path d="${heartPath(24, 22, 1.25)}" fill="${P.red}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 39.5 C34 30 40 22 37.5 14.5 Q40.5 24 31 33.5 Q27.5 37 24 39.5 Z" fill="${shade(P.red, -14)}" opacity=".75"/>` +
    `<ellipse cx="17" cy="16.5" rx="3.4" ry="2.2" fill="#ffffff" opacity=".55" transform="rotate(-28 17 16.5)"/>`
  );
});

reg("🧍", "人儿", () => {
  const coat = P.teal;
  return (
    gs(24, 43.5, 10) +
    `<circle cx="24" cy="12" r="6.6" fill="${P.skin}" stroke="${o(P.skin)}" stroke-width="2"/>` +
    `<path d="M17.5 12 A6.6 6.6 0 0 1 30.5 11.4 L30 13 Q24 8.5 18.2 13.6 Z" fill="#8a6f52" stroke="${o("#8a6f52")}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<circle cx="21.8" cy="12.6" r="1.2" fill="${INK}"/><circle cx="26.2" cy="12.6" r="1.2" fill="${INK}"/>` +
    `<path d="M22.4 15.4 q1.6 1.4 3.2 0" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M18.5 20.5 L29.5 20.5 Q31.5 20.5 31.2 24 L30.2 31 L17.8 31 L16.8 24 Q16.5 20.5 18.5 20.5 Z"` +
    ` fill="${coat}" stroke="${o(coat)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M17.2 21.5 L13.8 29.5 M30.8 21.5 L34.2 29.5" stroke="${P.skin}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M21 31 L20.5 42 M27 31 L27.5 42" stroke="#7a90c4" stroke-width="4" stroke-linecap="round"/>` +
    `<ellipse cx="20" cy="43" rx="3.2" ry="1.7" fill="${INK}"/><ellipse cx="28" cy="43" rx="3.2" ry="1.7" fill="${INK}"/>` +
    hi(20.5, 8, 1.8, 1.1)
  );
});

// ---- 家人与小朋友（人物半身像） ----------------------------------------------

reg("👨", "爸爸", () => personBust({ hair: "#5a4632", hairdo: "side", coat: P.blueDeep }));
reg("👩", "妈妈", () => personBust({ hair: "#6b4a3a", hairdo: "bun", coat: P.rose }));
reg("👴", "爷爷", () => personBust({ hair: null, hairdo: "bald", coat: "#8fa88f", glasses: true }));
reg("👵", "奶奶", () => personBust({ hair: "#d8d4cc", hairdo: "bun", coat: P.lav, glasses: true }));
reg("👦", "哥哥", () => personBust({ hair: "#4a3a2a", hairdo: "short", coat: P.teal }));
reg("👧", "姐姐", () => personBust({ hair: "#6b4a3a", hairdo: "buns", coat: P.pink }));
reg("🧒", "弟弟", () => personBust({ hair: "#5a4632", hairdo: "short", coat: P.gold }));
reg("👶", "宝宝", () =>
  personBust({ hair: "#8a6f52", hairdo: "tuft", coat: P.cream, r: 11.5 }));
reg("🙋", "举手的我", () =>
  personBust({
    hair: "#4a3a2a",
    hairdo: "short",
    coat: P.orange,
    extra:
      `<path d="M33.5 36 Q40.5 30 40.5 20" fill="none" stroke="${P.orange}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="40.5" cy="17" r="3.8" fill="${P.skin}" stroke="${o(P.skin)}" stroke-width="1.8"/>`
  }));

// ---- 门 / 车 / 船…（生活物件） ----------------------------------------------

reg("🚪", "大门", () => {
  const frame = "#8a6f52";
  const door = P.wood;
  return (
    gs(24, 43, 13) +
    `<path d="M13 42.5 L13 10 Q13 7.5 15.5 7.5 L32.5 7.5 Q35 7.5 35 10 L35 42.5 Z" fill="${frame}" stroke="${o(frame)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M16.5 42.5 L16.5 12.5 Q16.5 11 18 11 L30 11 Q31.5 11 31.5 12.5 L31.5 42.5 Z" fill="${door}" stroke="${o(door)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M28 42.5 L28 11 L30 11 Q31.5 11 31.5 12.5 L31.5 42.5 Z" fill="${shade(door, -14)}" opacity=".8"/>` +
    `<rect x="19.5" y="15" width="9" height="10" rx="1.5" fill="none" stroke="${o(door)}" stroke-width="1.3" opacity=".6"/>` +
    `<circle cx="28.2" cy="28.5" r="1.8" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    hi(20, 14, 2, 3)
  );
});

reg("🚗", "汽车", () => {
  const c = P.red;
  const out = o(c);
  return (
    gs(24, 41, 17) +
    `<path d="M13.5 25 Q15.5 15.5 24 15.5 Q32.5 15.5 34.5 25 Z" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M17.5 24 Q18.8 18.5 24 18.5 L24 24 Z" fill="#cfe8f8" stroke="${out}" stroke-width="1.4"/>` +
    `<path d="M30.5 24 Q29.2 18.5 25.8 18.5 L25.8 24 Z" fill="#cfe8f8" stroke="${out}" stroke-width="1.4"/>` +
    `<path d="M6 32.5 Q6 25 13 25 L35 25 Q42 25 42 32.5 L42 35.5 Q42 37.5 40 37.5 L8 37.5 Q6 37.5 6 35.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M8 37.5 L40 37.5 Q42 37.5 42 35.5 L42 33.5 L6 33.5 L6 35.5 Q6 37.5 8 37.5 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<circle cx="14.5" cy="37.5" r="4.6" fill="${INK}" stroke="${shade(INK, -25)}" stroke-width="1.6"/>` +
    `<circle cx="14.5" cy="37.5" r="1.9" fill="${P.gray}"/>` +
    `<circle cx="33.5" cy="37.5" r="4.6" fill="${INK}" stroke="${shade(INK, -25)}" stroke-width="1.6"/>` +
    `<circle cx="33.5" cy="37.5" r="1.9" fill="${P.gray}"/>` +
    `<circle cx="39.5" cy="29.5" r="1.7" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1"/>` +
    hi(11.5, 27.5)
  );
});

reg("⛵", "小船", () => {
  const sail = "#fdfaf2";
  const hull = P.wood;
  return (
    `<path d="M23 7 L23 29" stroke="${o(hull)}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M21.5 9 Q10.5 17 10 28.5 L21.5 28.5 Z" fill="${sail}" stroke="#a99f92" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M25 7.5 Q36.5 15.5 37 28.5 L25 28.5 Z" fill="${shade(sail, -8)}" stroke="#a99f92" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M8 31.5 L40 31.5 L35.5 39.5 Q35 40.5 33.5 40.5 L14.5 40.5 Q13 40.5 12.5 39.5 Z"` +
    ` fill="${hull}" stroke="${o(hull)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M14.5 40.5 L33.5 40.5 Q35 40.5 35.5 39.5 L37.5 36 L11 36 L12.5 39.5 Q13 40.5 14.5 40.5 Z" fill="${shade(hull, -14)}" opacity=".8"/>` +
    `<path d="M4 44 Q9 41.5 14 44 Q19 46.5 24 44 Q29 41.5 34 44 Q39 46.5 44 44" fill="none" stroke="#7fc8e8" stroke-width="2.2" stroke-linecap="round"/>` +
    hi(15, 15, 2.4, 3.2)
  );
});

reg("☂️", "雨伞", () => {
  const c = P.rose;
  const out = o(c);
  return (
    gs(24, 43, 10) +
    `<path d="M24 6 Q39 7 42 22 Q37.5 19 33 22 Q28.5 19 24 22 Q19.5 19 15 22 Q10.5 19 6 22 Q9 7 24 6 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M33 22 Q37.5 19 42 22 Q40 12 31 8.5 Q35.5 14 34.5 20.8 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M24 6 V4.5" stroke="${out}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M24 22 L24 37 A4 4 0 0 1 16 37" fill="none" stroke="${o(P.wood)}" stroke-width="2.4" stroke-linecap="round"/>` +
    hi(15.5, 11, 3, 1.8)
  );
});

reg("📖", "书本", () => {
  const page = "#fdfaf0";
  const cover = P.blueDeep;
  return (
    gs(24, 41, 16) +
    `<path d="M24 13.5 Q15 8.5 6.5 11 L6.5 36.5 Q15 34 24 39 Q33 34 41.5 36.5 L41.5 11 Q33 8.5 24 13.5 Z"` +
    ` fill="${cover}" stroke="${o(cover)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M23 16 Q15.5 11.5 9 13.5 L9 33.5 Q16 32 23 36 Z" fill="${page}" stroke="#c8bfae" stroke-width="1.4"/>` +
    `<path d="M25 16 Q32.5 11.5 39 13.5 L39 33.5 Q32 32 25 36 Z" fill="${shade(page, -6)}" stroke="#c8bfae" stroke-width="1.4"/>` +
    `<path d="M12 18.5 Q17 17.5 20.5 19.5 M12 23.5 Q17 22.5 20.5 24.5 M12 28.5 Q17 27.5 20.5 29.5 M27.5 19.5 Q31 17.5 36 18.5 M27.5 24.5 Q31 22.5 36 23.5"` +
    ` fill="none" stroke="#b0a894" stroke-width="1.2" stroke-linecap="round"/>` +
    hi(13, 14.5, 2.6, 1.5)
  );
});

reg("✏️", "铅笔", () => {
  const body = P.gold;
  return (
    gs(24, 42, 13) +
    `<g transform="rotate(45 24 24)">` +
    `<rect x="17.5" y="1" width="13" height="7" rx="2.4" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.8"/>` +
    `<rect x="17.5" y="7.5" width="13" height="4" fill="${P.gray}" stroke="${o(P.gray)}" stroke-width="1.5"/>` +
    `<rect x="17.5" y="11" width="13" height="22" fill="${body}" stroke="${o(body)}" stroke-width="1.8"/>` +
    `<path d="M26 11 h4.5 v22 h-4.5 Z" fill="${shade(body, -14)}" opacity=".75"/>` +
    `<path d="M17.5 33 L30.5 33 L24 45 Z" fill="${P.skin}" stroke="${o(P.skin)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M21.5 38.5 L26.5 38.5 L24 45 Z" fill="${INK}"/>` +
    `</g>` +
    hi(17, 13, 1.8, 3.2)
  );
});

reg("💡", "灯泡", () => {
  const glass = "#fff2c4";
  const out = o(P.gold);
  const ray = (x1: number, y1: number, x2: number, y2: number): string =>
    `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${P.orange}" stroke-width="2.2" stroke-linecap="round"/>`;
  return (
    gs(24, 43.5, 8) +
    ray(8.5, 9, 12.5, 12.5) + ray(39.5, 9, 35.5, 12.5) + ray(5.5, 22, 10.5, 22) + ray(42.5, 22, 37.5, 22) +
    `<circle cx="24" cy="20" r="11.5" fill="${glass}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 31.5 a11.5 11.5 0 0 0 10.6 -16 a13.5 13.5 0 0 1 -10.6 16" fill="${shade(glass, -12)}" opacity=".75"/>` +
    `<path d="M20 26.5 Q20 22 24 22 Q28 22 28 26.5" fill="none" stroke="${P.orange}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M19.5 31 L28.5 31 L27.5 39 Q27 40.5 25.5 40.5 L22.5 40.5 Q21 40.5 20.5 39 Z" fill="${P.gray}" stroke="${o(P.gray)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M20 33.8 h8.2 M20.4 36.6 h7.4" stroke="${o(P.gray)}" stroke-width="1.1" opacity=".7"/>` +
    hi(19, 14)
  );
});

reg("⚽", "皮球", () => {
  const out = "#8a8098";
  const patch = (points: string): string =>
    `<polygon points="${points}" fill="${INK}" opacity=".88"/>`;
  return (
    gs(24, 42.5, 12) +
    `<circle cx="24" cy="25" r="15.5" fill="#fdfdfd" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 40.5 a15.5 15.5 0 0 0 14.3 -21.3 a17.5 17.5 0 0 1 -14.3 21.3" fill="#d8d4e4" opacity=".8"/>` +
    patch("24,18.5 30,23 27.8,29.5 20.2,29.5 18,23") +
    patch("11,17.5 15.5,15 17.5,19 14,22.5 10.2,21") +
    patch("32.5,15 37,17.5 37.8,21.5 34,22.5 30.5,19") +
    patch("13,32.5 17.5,34 17,38.5 12.5,36.8") +
    patch("35,32.5 30.5,34 31,38.5 35.5,36.8") +
    hi(17.5, 16.5)
  );
});

reg("🏠", "小房子", () => {
  const wall = P.cream;
  const roof = P.red;
  return (
    gs(24, 43, 15) +
    `<path d="M10.5 22 L10.5 40.5 L37.5 40.5 L37.5 22 Z" fill="${wall}" stroke="${o(wall)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M33 22 L33 40.5 L37.5 40.5 L37.5 22 Z" fill="${shade(wall, -12)}" opacity=".8"/>` +
    `<path d="M6.5 23 L24 8 L41.5 23 Z" fill="${roof}" stroke="${o(roof)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 8 L41.5 23 L35.5 23 L22 11.5 Z" fill="${shade(roof, -13)}" opacity=".75"/>` +
    `<rect x="14" y="26" width="7" height="7" rx="1.4" fill="#cfe8f8" stroke="${o("#cfe8f8")}" stroke-width="1.5"/>` +
    `<path d="M17.5 26 v7 M14 29.5 h7" stroke="${o("#cfe8f8")}" stroke-width="1" opacity=".7"/>` +
    `<path d="M26.5 40.5 L26.5 30 Q26.5 28 28.5 28 L31 28 Q33 28 33 30 L33 40.5 Z" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cx="31.4" cy="35" r="1" fill="${o(P.wood)}"/>` +
    hi(15, 13, 2.6, 1.6)
  );
});

reg("🤝", "握手", () => {
  const a = P.skin;
  const b = "#e0a87c";
  return (
    gs(24, 38, 15) +
    `<path d="M3.5 18 L14 14.5 L21 20 L14.5 27 L5 24 Z" fill="${P.teal}" stroke="${o(P.teal)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M44.5 18 L34 14.5 L27 20 L33.5 27 L43 24 Z" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M13.5 19.5 Q19 14.5 23 18.5 L30.5 25.5 Q32.5 27.5 30.5 29.5 Q28.5 31.2 26.8 29.6 Q28 31.8 26 33.4 Q24 35 22.4 33.2 Q23 35.5 20.8 36.6 Q18.8 37.5 17.4 35.6 L12.5 29 Q10.5 26 13.5 19.5 Z"` +
    ` fill="${a}" stroke="${o(a)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M34.5 19.5 Q29 15.5 25.5 18 L20 22.5 Q18 24.5 20 26.5 Q22 28.5 24.5 26.5 L27 24.5 L33 30 Q35.5 27 34.5 19.5 Z"` +
    ` fill="${b}" stroke="${o(b)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M26.8 29.6 L23.5 26.4 M22.4 33.2 L19.6 30.2" stroke="${o(a)}" stroke-width="1.2" opacity=".6"/>` +
    hi(16, 20, 2.4, 1.5)
  );
});

reg("💖", "闪亮爱心", () => {
  const c = P.rose;
  return (
    gs(24, 41, 12) +
    `<path d="${heartPath(24, 23, 1.1)}" fill="${c}" stroke="${o(c)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 38.4 C33 30 38 23 36 16 Q38.5 24.5 30 33 Q27 36 24 38.4 Z" fill="${shade(c, -14)}" opacity=".75"/>` +
    `<polygon points="${sparkPts(9.5, 12, 4.4)}" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<polygon points="${sparkPts(39.5, 15, 3.6)}" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<ellipse cx="18" cy="17.5" rx="3" ry="1.9" fill="#ffffff" opacity=".6" transform="rotate(-28 18 17.5)"/>`
  );
});

reg("😄", "笑脸", () => {
  const c = P.gold;
  const out = o(c);
  return (
    gs(24, 42.5, 12) +
    `<circle cx="24" cy="24" r="15.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 39.5 a15.5 15.5 0 0 0 14.3 -21.3 a17.5 17.5 0 0 1 -14.3 21.3" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<path d="M15 20 Q17.5 16.5 20 20 M28 20 Q30.5 16.5 33 20" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M15.5 26 Q24 34.5 32.5 26 Q31 32.5 24 32.5 Q17 32.5 15.5 26 Z" fill="#ffffff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    blush(13, 35, 25) +
    hi(17, 15.5)
  );
});

reg("👍", "点赞", () => {
  const c = P.skin;
  const out = o(c);
  return (
    gs(24, 42, 12) +
    `<path d="M17.5 22.5 L23 12.5 Q24 8 27 8.5 Q30 9.5 29 14.5 L28 19.5 L36.5 19.5 Q40.5 19.5 40 23.5 Q41.5 26 39.5 28.5 Q40.5 31.5 38 33.5 Q38 37.5 34 37.5 L23 37.5 Q19.5 37.5 17.5 35 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M34 37.5 Q38 37.5 38 33.5 Q40.5 31.5 39.5 28.5 Q41.5 26 40 23.5 Q39.5 27 37 27.5 Q39 30.5 36 32.5 Q37 36.5 33 36 Z" fill="${shade(c, -12)}" opacity=".7"/>` +
    `<rect x="8.5" y="21" width="8" height="17" rx="2.6" fill="${P.teal}" stroke="${o(P.teal)}" stroke-width="2"/>` +
    hi(21.5, 15, 2, 2.8)
  );
});

reg("🍼", "奶瓶", () => {
  const milk = "#fdf6ea";
  return (
    gs(24, 43, 10) +
    `<ellipse cx="24" cy="8.5" rx="3.6" ry="4" fill="#f4b8c4" stroke="${o("#f4b8c4")}" stroke-width="1.8"/>` +
    `<rect x="17.5" y="11.5" width="13" height="4.6" rx="2" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.8"/>` +
    `<path d="M16.5 20 Q13.5 24 13.5 29 L13.5 38 Q13.5 42 17.5 42 L30.5 42 Q34.5 42 34.5 38 L34.5 29 Q34.5 24 31.5 20 Q30 17.5 25.5 17.3 L22.5 17.3 Q18 17.5 16.5 20 Z"` +
    ` fill="${milk}" stroke="#b8ad9c" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M30.5 42 Q34.5 42 34.5 38 L34.5 29 Q34.5 24 31.5 20 Q33 26 32.5 33 Q32.2 40 28.5 41.4 Z" fill="#e8ddc8" opacity=".8"/>` +
    `<path d="M17 27.5 h5 M17 32.5 h5 M17 37.5 h5" stroke="#b8ad9c" stroke-width="1.3" stroke-linecap="round"/>` +
    hi(19.5, 22.5, 2.2, 3)
  );
});

reg("🥰", "爱你的脸", () => {
  const c = P.gold;
  const heart = (x: number, y: number, s: number): string =>
    `<path d="${heartPath(x, y, s)}" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.1" stroke-linejoin="round"/>`;
  return (
    gs(24, 42.5, 12) +
    `<circle cx="24" cy="25" r="14.5" fill="${c}" stroke="${o(c)}" stroke-width="2"/>` +
    `<path d="M24 39.5 a14.5 14.5 0 0 0 13.4 -20 a16.5 16.5 0 0 1 -13.4 20" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<path d="M17 23 Q19.5 20 22 23 M26 23 Q28.5 20 31 23" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>` +
    `<path d="M20 28.5 Q24 32.5 28 28.5" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>` +
    heart(8.5, 12, 0.42) + heart(39.5, 14, 0.36) + heart(35, 5.8, 0.3) +
    blush(15.5, 32.5, 28) +
    hi(17.5, 17)
  );
});

// ---- 数字花园的号码牌 ---------------------------------------------------------

function keycap(label: string): Draw {
  return () => {
    const c = P.lav;
    const out = o(c);
    return (
      gs(24, 43, 13) +
      `<rect x="7.5" y="6.5" width="33" height="35" rx="8" fill="${c}" stroke="${out}" stroke-width="2"/>` +
      `<path d="M14 41.5 L33.5 41.5 Q40.5 41.5 40.5 33 L40.5 26 Q40 37.5 30 39.2 Q21 40.8 14 41.5 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
      `<rect x="11.5" y="10.5" width="25" height="27" rx="5.4" fill="#ffffff" opacity=".92"/>` +
      `<text x="24" y="33" text-anchor="middle" font-size="${label.length > 1 ? 17 : 20}" font-weight="900" font-family="inherit" fill="${shade(c, -38)}">${label}</text>` +
      hi(13.5, 10.5, 3, 1.8)
    );
  };
}

reg("1️⃣", "数字一", keycap("1"));
reg("2️⃣", "数字二", keycap("2"));
reg("3️⃣", "数字三", keycap("3"));
reg("4️⃣", "数字四", keycap("4"));
reg("5️⃣", "数字五", keycap("5"));
reg("6️⃣", "数字六", keycap("6"));
reg("7️⃣", "数字七", keycap("7"));
reg("8️⃣", "数字八", keycap("8"));
reg("9️⃣", "数字九", keycap("9"));
reg("🔟", "数字十", keycap("10"));

// ---- 吃的喝的 ---------------------------------------------------------------

reg("🍎", "苹果", () => roundFruit(P.red, ""));
reg("🍑", "桃子", () =>
  roundFruit(
    "#f8b7a0",
    `<path d="M24 15 Q23.5 26 24.5 39" fill="none" stroke="${o("#f8b7a0")}" stroke-width="1.4" opacity=".5"/>`
  ));
reg("🍊", "橘子", () =>
  roundFruit(
    P.orange,
    `<circle cx="18" cy="30" r="0.9" fill="${o(P.orange)}" opacity=".4"/>` +
      `<circle cx="24" cy="33" r="0.9" fill="${o(P.orange)}" opacity=".4"/>` +
      `<circle cx="30" cy="30" r="0.9" fill="${o(P.orange)}" opacity=".4"/>` +
      `<circle cx="21" cy="36" r="0.9" fill="${o(P.orange)}" opacity=".4"/>` +
      `<circle cx="27" cy="37" r="0.9" fill="${o(P.orange)}" opacity=".4"/>`
  ));

reg("🍐", "梨子", () => {
  const c = "#cede6f";
  const out = o(c);
  return (
    gs() +
    `<path d="M24 9 Q28 9 28.5 15 Q29 19.5 32.5 23.5 Q36.5 28 36.5 32.5 A12.5 12.5 0 0 1 11.5 32.5 Q11.5 28 15.5 23.5 Q19 19.5 19.5 15 Q20 9 24 9 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 45 A12.5 12.5 0 0 0 36.5 32.5 Q36.5 28 32.5 23.5 Q35 30 34 35.5 Q32.5 43 24 45 Z" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<path d="M24 9.5 Q23.2 6 25.6 4" fill="none" stroke="${P.brown}" stroke-width="2.2" stroke-linecap="round"/>` +
    leafShape(28, 7.5, 8, -20, P.green) +
    hi(18, 27)
  );
});

reg("🍉", "西瓜", () => {
  const rind = "#6fbf5e";
  const flesh = "#ff7e7e";
  return (
    gs(24, 42, 17) +
    `<path d="M5.5 21.5 L42.5 21.5 A18.5 18.5 0 0 1 5.5 21.5 Z" fill="${rind}" stroke="${o(rind)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M8.3 21.5 L39.7 21.5 A15.7 15.7 0 0 1 8.3 21.5 Z" fill="#f8f2d8"/>` +
    `<path d="M10.4 21.5 L37.6 21.5 A13.6 13.6 0 0 1 10.4 21.5 Z" fill="${flesh}" stroke="${o(flesh)}" stroke-width="1.2"/>` +
    `<path d="M28.5 34.4 A13.6 13.6 0 0 0 37.6 21.5 L33.8 21.5 A10 12.6 0 0 1 28.5 34.4 Z" fill="${shade(flesh, -13)}" opacity=".75"/>` +
    `<ellipse cx="17.5" cy="25.5" rx="1.2" ry="1.9" fill="${INK}" transform="rotate(18 17.5 25.5)"/>` +
    `<ellipse cx="24" cy="29" rx="1.2" ry="1.9" fill="${INK}"/>` +
    `<ellipse cx="30.5" cy="25.5" rx="1.2" ry="1.9" fill="${INK}" transform="rotate(-18 30.5 25.5)"/>` +
    hi(15, 24.5, 2.6, 1.5)
  );
});

reg("🫘", "豆豆", () => {
  const c = "#c47b5a";
  const out = o(c);
  const bean = (cx: number, cy: number, rot: number, fill: string): string =>
    `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<path d="M${cx - 8} ${cy - 3} Q${cx - 9} ${cy - 11} ${cx} ${cy - 11} Q${cx + 9.5} ${cy - 11} ${cx + 8.5} ${cy + 1} Q${cx + 7.5} ${cy + 11} ${cx - 1.5} ${cy + 10} Q${cx - 9.5} ${cy + 9} ${cx - 5} ${cy + 2.5} Q${cx - 7.5} ${cy + 1} ${cx - 8} ${cy - 3} Z"` +
    ` fill="${fill}" stroke="${o(fill)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<ellipse cx="${cx - 3.5}" cy="${cy - 5.5}" rx="2.4" ry="1.5" fill="#ffffff" opacity=".45" transform="rotate(-24 ${cx - 3.5} ${cy - 5.5})"/>` +
    `</g>`;
  return gs(24, 42, 14) + bean(15, 20, -14, c) + bean(32, 30, 12, "#a85a48");
});

reg("🥬", "大白菜", () => {
  const leaf = "#9fce7f";
  const stem = "#eef6dc";
  return (
    gs(24, 43, 11) +
    `<path d="M13 14 Q9.5 8.5 15 7 Q19 6 20.5 10 Q22 6 26 6.5 Q30 7 29.5 11 Q34 8 36.5 12 Q39 16 34.5 19 L32 39 L16 39 Z"` +
    ` fill="${leaf}" stroke="${o(leaf)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M34.5 19 Q39 16 36.5 12 Q35 9.5 32 10 Q35.5 14 31.5 17.5 L29.5 38 L32 39 Z" fill="${shade(leaf, -12)}" opacity=".8"/>` +
    `<path d="M17 39 Q15 24 18.5 15.5 Q21.5 22 21 39 Z M27.5 39 Q26.5 22 29.5 15 Q32.5 23 31 39 Z" fill="${stem}" stroke="${o(leaf)}" stroke-width="1.3" stroke-linejoin="round" opacity=".9"/>` +
    `<path d="M15.5 38 Q15 42 18 42 L30 42 Q33 42 32.5 38 Z" fill="${stem}" stroke="${o(leaf)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    hi(16, 12, 2.4, 1.5)
  );
});

reg("🥚", "鸡蛋", () => {
  const c = "#fbf2df";
  return (
    gs(24, 42, 11) +
    `<path d="M24 7 Q34.5 7 36 24 Q37 40 24 40 Q11 40 12 24 Q13.5 7 24 7 Z"` +
    ` fill="${c}" stroke="#c4b49a" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 40 Q37 40 36 24 Q35.4 16.5 32.5 12 Q34.5 20 33 29 Q31.5 38.5 24 40 Z" fill="#e4d6bc" opacity=".8"/>` +
    `<ellipse cx="18.5" cy="16.5" rx="3.2" ry="4.6" fill="#ffffff" opacity=".7" transform="rotate(16 18.5 16.5)"/>`
  );
});

reg("🍖", "大肉肉", () => {
  const meat = "#d4826a";
  const bone = "#f6f1e4";
  return (
    gs(24, 42, 14) +
    `<circle cx="37" cy="13" r="4" fill="${bone}" stroke="#b8ad96" stroke-width="1.8"/>` +
    `<circle cx="42" cy="18" r="4" fill="${bone}" stroke="#b8ad96" stroke-width="1.8"/>` +
    `<path d="M33 14.5 L39.5 21" stroke="${bone}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M9 34.5 Q4.5 25 13 17.5 Q21 10.5 30.5 15.5 Q39 20 34.5 30 Q30 39.5 19.5 39.5 Q12 39.5 9 34.5 Z"` +
    ` fill="${meat}" stroke="${o(meat)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M19.5 39.5 Q30 39.5 34.5 30 Q37.5 23 33.5 18.5 Q36 26.5 30 33.5 Q25 39 17.5 39.2 Z" fill="${shade(meat, -14)}" opacity=".8"/>` +
    `<path d="M14 24 Q19 19.5 25.5 21.5" fill="none" stroke="#f2c4b0" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>` +
    hi(14.5, 20.5)
  );
});

reg("🍵", "热茶", () => {
  const cup = "#f4f7ee";
  const tea = "#a8c86f";
  return (
    gs(24, 42.5, 13) +
    `<path d="M12 36.5 Q17 39.5 24 39.5 Q31 39.5 36 36.5 L38.5 38.5 Q31.5 42.5 24 42.5 Q16.5 42.5 9.5 38.5 Z" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M11.5 20 L36.5 20 Q36 32 30 36.5 Q24 40 18 36.5 Q12 32 11.5 20 Z" fill="${cup}" stroke="#b0ab98" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M30 36.5 Q36 32 36.5 20 L33 20 Q33 30.5 28 35 Q29 36 30 36.5 Z" fill="#ddd8c4" opacity=".8"/>` +
    `<ellipse cx="24" cy="20.5" rx="12.5" ry="3.4" fill="${tea}" stroke="${o(tea)}" stroke-width="1.6"/>` +
    `<path d="M18 14 Q16.5 10.5 18.5 7.5 M25 14 Q23.5 10.5 25.5 7.5 M32 14 Q30.5 10.5 32.5 7.5"` +
    ` fill="none" stroke="#b8c4cc" stroke-width="2" stroke-linecap="round" opacity=".85"/>` +
    hi(17.5, 19.5, 2.8, 1.2)
  );
});

reg("🍬", "糖果", () => {
  const c = P.rose;
  const out = o(c);
  return (
    gs(24, 39.5, 13) +
    `<path d="M10.5 20 L4.5 15.5 Q9.5 13.5 10.8 17.8 L12.5 21.5 Z M10.5 28 L4.5 32.5 Q9.5 34.5 10.8 30.2 L12.5 26.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="1.7" stroke-linejoin="round" transform="rotate(-10 12 24)"/>` +
    `<path d="M37.5 20 L43.5 15.5 Q38.5 13.5 37.2 17.8 L35.5 21.5 Z M37.5 28 L43.5 32.5 Q38.5 34.5 37.2 30.2 L35.5 26.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="1.7" stroke-linejoin="round" transform="rotate(10 36 24)"/>` +
    `<ellipse cx="24" cy="24" rx="12" ry="10" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 34 a12 10 0 0 0 11 -14.5 a13.5 11.5 0 0 1 -11 14.5" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<path d="M18 15.5 Q16 24 18.5 32.5 M24.5 14.2 Q22.5 24 25 33.8 M31 15.5 Q29.5 24 31.5 32.5"` +
    ` fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".75"/>` +
    hi(18, 18)
  );
});

reg("🍜", "热汤面", () => {
  const bowl = "#e88a7a";
  return (
    gs(24, 43, 14) +
    `<path d="M35 6.5 L20 18 M42 10.5 L26 19.5" stroke="${P.wood}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M8.5 21 L39.5 21 Q39 32.5 32.5 37 L15.5 37 Q9 32.5 8.5 21 Z" fill="${bowl}" stroke="${o(bowl)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M32.5 37 Q39 32.5 39.5 21 L36 21 Q36 31 30 36 Z" fill="${shade(bowl, -13)}" opacity=".8"/>` +
    `<path d="M10.5 21 Q13 17.5 17 19.5 Q20 21.5 24 19 Q28 16.5 31 19.5 Q34 22.5 37.5 21" fill="none" stroke="#f8ecd4" stroke-width="3.6" stroke-linecap="round"/>` +
    `<path d="M12 22.5 Q16 20.5 20 22.2 M26 21.5 Q30 20 34 22" fill="none" stroke="#eeddb8" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M17 33.5 L31 33.5 Q33.5 33.5 33 36 L32.5 37 L15.5 37 L15 36 Q14.5 33.5 17 33.5 Z" fill="#ffffff" opacity=".25"/>` +
    `<path d="M15 12 Q13.5 9 15.5 6.5" fill="none" stroke="#c8ccd4" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>` +
    hi(13.5, 24, 2.6, 1.6)
  );
});

reg("🍞", "面包", () => {
  const c = "#e8b878";
  const lit = "#f6dcae";
  return (
    gs(24, 41.5, 15) +
    `<path d="M7 24 Q7 13.5 17 13.5 L31 13.5 Q41 13.5 41 24 L41 36 Q41 38.5 38.5 38.5 L9.5 38.5 Q7 38.5 7 36 Z"` +
    ` fill="${c}" stroke="${o(c)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M9.5 38.5 L38.5 38.5 Q41 38.5 41 36 L41 33 L7 33 L7 36 Q7 38.5 9.5 38.5 Z" fill="${shade(c, -14)}" opacity=".75"/>` +
    `<path d="M10 24.5 Q10 16.5 17.5 16.5 L26 16.5 Q26 24 20 26.5 Q13.5 29 10 24.5 Z" fill="${lit}" opacity=".85"/>` +
    `<path d="M15 21 Q17 19 19.5 21 M23 21 Q25 19 27.5 21 M31 21 Q33 19 35.5 21" fill="none" stroke="${o(c)}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>` +
    hi(13.5, 18.5)
  );
});

reg("🍲", "一锅香", () => {
  const pot = "#d9825f";
  return (
    gs(24, 43, 15) +
    `<path d="M14 13 Q12.5 9.5 14.5 6.5 M24 13 Q22.5 9.5 24.5 6.5 M34 13 Q32.5 9.5 34.5 6.5"` +
    ` fill="none" stroke="#c8ccd4" stroke-width="2" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M5.5 20 L42.5 20 L42.5 22.5 Q42.5 24.5 40.5 24.5 L7.5 24.5 Q5.5 24.5 5.5 22.5 Z" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M9 24.5 L39 24.5 Q38.5 36 31.5 40 L16.5 40 Q9.5 36 9 24.5 Z" fill="${pot}" stroke="${o(pot)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M31.5 40 Q38.5 36 39 24.5 L35.5 24.5 Q35.5 34 29 39 Z" fill="${shade(pot, -14)}" opacity=".8"/>` +
    `<circle cx="16" cy="17" r="2.8" fill="#9fce7f" stroke="${o("#9fce7f")}" stroke-width="1.3"/>` +
    `<circle cx="24.5" cy="15.5" r="3.2" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.3"/>` +
    `<circle cx="32.5" cy="17" r="2.6" fill="#f4b8c4" stroke="${o("#f4b8c4")}" stroke-width="1.3"/>` +
    hi(13.5, 28, 2.6, 1.6)
  );
});

/** 弯身小虾（🦐 与 🍤 共用：一只温柔的粉橙虾） */
function shrimpBody(): string {
  const c = "#f8a07c";
  const out = o(c);
  const spine = "M16 12.5 Q35 12 35.5 25.5 Q35.8 36.5 23 38";
  return (
    gs(24, 42, 13) +
    // 触须与小足
    `<path d="M12 9 Q5.5 9.5 3.5 14 M12.5 11.5 Q7 13.5 6 18.5" fill="none" stroke="${out}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M12 19.5 L9.5 23 M15 21.5 L13 25.5 M18.5 22.5 L17.5 26.5" stroke="${out}" stroke-width="1.4" stroke-linecap="round"/>` +
    // 卷曲的身体：深描边一层 + 主色一层（圆头笔）
    `<path d="${spine}" fill="none" stroke="${out}" stroke-width="12.6" stroke-linecap="round"/>` +
    `<path d="${spine}" fill="none" stroke="${c}" stroke-width="9.8" stroke-linecap="round"/>` +
    // 体节三道
    `<path d="M27.5 8.5 Q29.5 13 28.5 17.5 M33.5 13 Q35.5 18 34 23 M35 24 Q37.5 29.5 34.5 34" fill="none" stroke="${out}" stroke-width="1.3" opacity=".55" stroke-linecap="round"/>` +
    // 尾扇
    `<path d="M23 38 L14 33.5 L16.5 39 L11 41.5 L21 43.5 Z" fill="${shade(c, -8)}" stroke="${out}" stroke-width="1.7" stroke-linejoin="round"/>` +
    `<circle cx="13.5" cy="14" r="1.8" fill="${INK}"/>` +
    `<circle cx="14.2" cy="13.3" r="0.6" fill="#ffffff"/>` +
    hi(19, 9, 3, 1.7)
  );
}

reg("🦐", "小虾", shrimpBody);
reg("🍤", "小虾仁", shrimpBody);

reg("🍪", "小饼干", () => {
  const c = "#e0aa6e";
  const out = o(c);
  const chip = (x: number, y: number, r: number): string =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#7a5138" stroke="${shade("#7a5138", -20)}" stroke-width="1"/>`;
  return (
    gs(24, 42, 13) +
    `<circle cx="24" cy="25" r="15" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 40 a15 15 0 0 0 13.8 -20.6 a17 17 0 0 1 -13.8 20.6" fill="${shade(c, -13)}" opacity=".8"/>` +
    chip(17, 19, 2.4) + chip(28.5, 16.5, 2.1) + chip(32, 27, 2.4) + chip(21, 30, 2.2) + chip(26, 35.5, 1.8) + chip(13, 27.5, 1.8) +
    hi(17, 15.5)
  );
});

reg("🍚", "白米饭", () => {
  const bowl = "#7fa8d8";
  const rice = "#fdfaf2";
  return (
    gs(24, 42.5, 14) +
    `<path d="M14 15.5 Q24 9.5 34 15.5 Q38.5 18 38.5 21 L9.5 21 Q9.5 18 14 15.5 Z" fill="${rice}" stroke="#c8bfae" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="16.5" cy="16.5" r="1.4" fill="#ffffff" stroke="#d8cfc0" stroke-width=".8"/>` +
    `<circle cx="24" cy="13.5" r="1.4" fill="#ffffff" stroke="#d8cfc0" stroke-width=".8"/>` +
    `<circle cx="31.5" cy="16.5" r="1.4" fill="#ffffff" stroke="#d8cfc0" stroke-width=".8"/>` +
    `<path d="M8.5 21 L39.5 21 Q39 32.5 32 37 L16 37 Q9 32.5 8.5 21 Z" fill="${bowl}" stroke="${o(bowl)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M32 37 Q39 32.5 39.5 21 L36 21 Q36 31 29.5 36 Z" fill="${shade(bowl, -13)}" opacity=".8"/>` +
    `<path d="M12 26 Q24 29 36 26" fill="none" stroke="${o(bowl)}" stroke-width="1.3" opacity=".5"/>` +
    hi(14, 24, 2.6, 1.6)
  );
});

reg("🥛", "温牛奶", () => {
  const milk = "#fdfaf2";
  const glass = "#dce8f2";
  return (
    gs(24, 43, 10) +
    `<path d="M14.5 8.5 L33.5 8.5 L31.5 41 Q31.4 42.5 29.8 42.5 L18.2 42.5 Q16.6 42.5 16.5 41 Z"` +
    ` fill="${glass}" stroke="#a0b4c4" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M16 16 L32 16 L30.6 40 Q30.5 41 29.5 41 L18.5 41 Q17.5 41 17.4 40 Z" fill="${milk}"/>` +
    `<path d="M29 41 Q30.5 41 30.6 40 L32 16 L29.5 16 L28 40.5 Z" fill="#e4dcc8" opacity=".9"/>` +
    `<ellipse cx="24" cy="16" rx="8" ry="2.2" fill="#ffffff" stroke="#d8cfc0" stroke-width="1"/>` +
    `<path d="M15.5 11 Q17 13.5 15.8 16 M24 10.5 Q25.5 13 24.3 15.5" fill="none" stroke="#c8ccd4" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
    hi(19.5, 22, 2, 4.4)
  );
});

reg("🍗", "煮鸡肉", () => {
  const meat = "#e0a25e";
  const bone = "#f6f1e4";
  return (
    gs(24, 41.5, 13) +
    `<circle cx="38.5" cy="10.5" r="3.4" fill="${bone}" stroke="#b8ad96" stroke-width="1.7"/>` +
    `<circle cx="43" cy="15" r="3.4" fill="${bone}" stroke="#b8ad96" stroke-width="1.7"/>` +
    `<path d="M34.5 14.5 L39.8 19.5" stroke="${bone}" stroke-width="4.2" stroke-linecap="round"/>` +
    `<path d="M8 30.5 Q5 21.5 12.5 15.5 Q20.5 9.5 29 14 Q36.5 18 33.5 27 Q30.5 36.5 20.5 37.5 Q11 38.5 8 30.5 Z"` +
    ` fill="${meat}" stroke="${o(meat)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M20.5 37.5 Q30.5 36.5 33.5 27 Q35.5 20.5 31.5 16.5 Q33.5 24.5 28 31 Q23.5 36.5 17.5 37.4 Z" fill="${shade(meat, -14)}" opacity=".8"/>` +
    `<path d="M12.5 22.5 Q16.5 18.5 22 19.5" fill="none" stroke="#f2d0a0" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>` +
    hi(13.5, 18.5)
  );
});

reg("🥩", "小肉粒", () => {
  const meat = "#e88a8a";
  const fat = "#f8e0d8";
  return (
    gs(24, 41, 15) +
    `<path d="M6.5 22 Q6.5 12.5 17 11.5 Q28 10.5 36 14.5 Q43 18 41 26 Q39 34.5 28.5 36.5 Q17 38.5 10.5 32.5 Q6.5 29 6.5 22 Z"` +
    ` fill="${meat}" stroke="${o(meat)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M28.5 36.5 Q39 34.5 41 26 Q42.3 20.5 38.5 17 Q40 25.5 33 31.5 Q28 35.5 25 36.8 Z" fill="${shade(meat, -13)}" opacity=".8"/>` +
    `<path d="M12 20.5 Q17 15.5 25 16.5 Q20 21.5 24.5 25.5 Q18 28 12 24.5 Q11 22.5 12 20.5 Z" fill="${fat}" opacity=".9"/>` +
    `<path d="M28 22 Q33 20 36 23.5" fill="none" stroke="${fat}" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>` +
    hi(14, 16.5)
  );
});

reg("🧀", "奶酪块", () => {
  const c = P.gold;
  const out = o(c);
  return (
    gs(24, 41.5, 15) +
    `<path d="M5.5 31 Q22 15.5 42.5 20 L42.5 36 Q42.5 38.5 40 38.5 L8 38.5 Q5.5 38.5 5.5 36 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M8 38.5 L40 38.5 Q42.5 38.5 42.5 36 L42.5 33.5 L5.5 33.5 L5.5 36 Q5.5 38.5 8 38.5 Z" fill="${shade(c, -15)}" opacity=".8"/>` +
    `<path d="M5.5 31 Q22 15.5 42.5 20 L42.5 23 Q23 19 7.8 32.8 Q6 32.5 5.5 31 Z" fill="${shade(c, 22)}" opacity=".9"/>` +
    `<circle cx="16" cy="30" r="2.8" fill="${shade(c, -22)}" opacity=".85"/>` +
    `<circle cx="27" cy="27.5" r="2.2" fill="${shade(c, -22)}" opacity=".85"/>` +
    `<circle cx="35.5" cy="30.5" r="1.8" fill="${shade(c, -22)}" opacity=".85"/>` +
    `<circle cx="22" cy="34.5" r="1.7" fill="${shade(c, -22)}" opacity=".85"/>` +
    hi(12.5, 25.5)
  );
});

reg("🍋", "酸柠檬", () => {
  const c = "#f4d44c";
  const out = o(c);
  return (
    gs() +
    `<path d="M9 27 Q9 17.5 18 15.5 Q15.5 12 19.5 11 Q23 10.5 23.5 14 Q31 13.5 35.5 18.5 Q40 23.5 38 30.5 Q41 32 39 35 Q37 37.5 34 36 Q28 41.5 19.5 39 Q9 35.5 9 27 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M19.5 39 Q28 41.5 34 36 Q37.5 32.5 38 27.5 Q35 34.5 27 36.6 Q22.5 37.8 17.5 36.5 Z" fill="${shade(c, -13)}" opacity=".8"/>` +
    leafShape(26, 9, 8, -14, P.green) +
    hi(15, 21)
  );
});

reg("🥦", "西兰花", () => {
  const flor = "#5fa860";
  const stem = "#b8d89a";
  const out = o(flor);
  return (
    gs(24, 43, 12) +
    `<path d="M20 27 L18.5 40 Q18.4 42 20.4 42 L27.6 42 Q29.6 42 29.5 40 L28 27 Z" fill="${stem}" stroke="${o(stem)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M26 27.5 L26.8 41.8 L27.6 42 Q29.6 42 29.5 40 L28 27.5 Z" fill="${shade(stem, -12)}" opacity=".8"/>` +
    `<circle cx="13.5" cy="20" r="7.4" fill="${flor}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="34.5" cy="20" r="7.4" fill="${flor}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="24" cy="13.5" r="8.4" fill="${flor}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="24" cy="20" r="8" fill="${flor}"/>` +
    `<path d="M34.5 27.4 a7.4 7.4 0 0 0 6.8 -9.6 a9.5 9.5 0 0 1 -6.8 9.6" fill="${shade(flor, -16)}" opacity=".8"/>` +
    `<circle cx="17" cy="14.5" r="1.2" fill="${shade(flor, -20)}" opacity=".7"/>` +
    `<circle cx="26.5" cy="10.5" r="1.2" fill="${shade(flor, -20)}" opacity=".7"/>` +
    `<circle cx="31" cy="16.5" r="1.2" fill="${shade(flor, -20)}" opacity=".7"/>` +
    `<circle cx="12" cy="22" r="1.1" fill="${shade(flor, -20)}" opacity=".7"/>` +
    hi(17.5, 10, 2.4, 1.5)
  );
});

reg("🥣", "饭碗", () => {
  const bowl = "#f4a86c";
  const out = o(bowl);
  return (
    gs(24, 42.5, 14) +
    `<ellipse cx="24" cy="20" rx="16.5" ry="4.4" fill="#fdf2e0" stroke="${out}" stroke-width="2"/>` +
    `<path d="M7.5 20.5 L40.5 20.5 Q39.5 33 32 37.5 L16 37.5 Q8.5 33 7.5 20.5 Z" fill="${bowl}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M32 37.5 Q39.5 33 40.5 20.5 L37 20.5 Q36.5 31 30 36.5 Z" fill="${shade(bowl, -13)}" opacity=".8"/>` +
    `<path d="M11 26.5 Q24 30 37 26.5" fill="none" stroke="${out}" stroke-width="1.4" opacity=".5"/>` +
    `<path d="M15 37.5 L33 37.5 L32 40.5 Q31.7 41.5 30.5 41.5 L17.5 41.5 Q16.3 41.5 16 40.5 Z" fill="${shade(bowl, -20)}" stroke="${out}" stroke-width="1.5" stroke-linejoin="round"/>` +
    hi(13, 23.5, 3, 1.7)
  );
});

reg("🪶", "羽毛逗猫棒", () => {
  const quill = P.teal;
  const out = o(quill);
  return (
    gs(24, 42, 11) +
    `<path d="M33 5.5 Q43 7 41.5 18 Q40 28.5 30 33.5 Q24.5 36 20 34.5 Q17.5 30 19.5 24 Q23 13 33 5.5 Z"` +
    ` fill="${quill}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M30 33.5 Q40 28.5 41.5 18 Q42.3 12 39 8.5 Q40.5 17.5 34.5 25.5 Q31 30.5 26.5 33.8 Q28.3 34.2 30 33.5 Z" fill="${shade(quill, -13)}" opacity=".8"/>` +
    `<path d="M35.5 10.5 Q28.5 20 22.5 31" fill="none" stroke="${out}" stroke-width="1.4" opacity=".7"/>` +
    `<path d="M28 14.5 L32.5 17 M24.5 20 L30 22.5 M22 26 L27.5 28" fill="none" stroke="${out}" stroke-width="1.1" opacity=".5"/>` +
    `<path d="M21 33.5 L12.5 43" stroke="${o(P.wood)}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="12.5" cy="43" r="2.2" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.3"/>` +
    hi(30, 11, 2.6, 1.6)
  );
});

reg("🐾", "小爪印", () => {
  const c = "#c99b6a";
  const out = o(c);
  const toe = (x: number, y: number, r: number): string =>
    `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.25}" fill="${c}" stroke="${out}" stroke-width="1.7"/>`;
  return (
    toe(12, 15, 4) + toe(24, 11.5, 4.4) + toe(36, 15, 4) +
    `<path d="M13 30.5 Q14 22.5 24 22.5 Q34 22.5 35 30.5 Q35.8 37 29.5 38.5 Q26.5 39.2 24 38 Q21.5 39.2 18.5 38.5 Q12.2 37 13 30.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 38 Q26.5 39.2 29.5 38.5 Q35.8 37 35 30.5 Q34.6 27 32.5 25.2 Q34 31.5 29.8 34.8 Q27 37 24 38 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    hi(18, 26, 2.6, 1.6)
  );
});

// ---- 红蓝点点 · 闯关信号章（W8R2-01：SKINS mine/trap + 道具点的渲染层贴纸） ----

/** 圆形信号点（🔵 / 🔴 共用）：大圆 + 底部暗弧分面 + 左上高光 */
function signalDot(main: string): string {
  const out = o(main);
  return (
    gs(24, 42.5, 13) +
    `<circle cx="24" cy="25" r="14.5" fill="${main}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 39.5 a14.5 14.5 0 0 0 13.3 -20.2 a17 17 0 0 1 -13.3 20.2" fill="${shade(main, -16)}" opacity=".8"/>` +
    `<ellipse cx="18" cy="18.5" rx="4.4" ry="2.8" fill="#ffffff" opacity=".5" transform="rotate(-24 18 18.5)"/>`
  );
}

reg("🔵", "蓝圆点", () => signalDot(P.blue));
reg("🔴", "红圆点", () => signalDot(P.red));

/** 圆角色块（🟥🟦🟪🟫 共用）：圆角方 + 底部暗面 + 顶部釉光带 */
function colorTile(main: string): string {
  const out = o(main);
  return (
    gs(24, 42.5, 13) +
    `<rect x="10" y="11" width="28" height="28" rx="7.5" fill="${main}" stroke="${out}" stroke-width="2"/>` +
    `<rect x="11" y="28" width="26" height="10" rx="5.5" fill="${shade(main, -15)}" opacity=".7"/>` +
    `<rect x="13.5" y="14" width="21" height="7.5" rx="3.75" fill="#ffffff" opacity=".3"/>` +
    hi(16.5, 16.5)
  );
}

reg("🟥", "红色块", () => colorTile(P.red));
reg("🟦", "蓝色块", () => colorTile(P.blueDeep));
reg("🟪", "紫色块", () => colorTile(P.lav));
reg("🟫", "棕色块", () => colorTile(P.brown));

/** 菱形宝钻（🔷 / 💠 共用骨架）：菱形 + 上亮下暗两停分面 */
function gemDiamond(main: string, inner: string): string {
  const out = o(main);
  return (
    gs(24, 42.5, 12) +
    `<polygon points="24,7.5 39.5,24 24,40.5 8.5,24" fill="${main}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="24,7.5 39.5,24 24,24" fill="${shade(main, 18)}" opacity=".65"/>` +
    `<polygon points="24,40.5 8.5,24 24,24" fill="${shade(main, -16)}" opacity=".7"/>` +
    inner +
    `<ellipse cx="18.5" cy="17" rx="3" ry="1.9" fill="#ffffff" opacity=".55" transform="rotate(-38 18.5 17)"/>`
  );
}

reg("🔷", "蓝宝钻", () => gemDiamond(P.blue, ""));
reg("💠", "花芯钻", () =>
  gemDiamond(
    P.teal,
    `<polygon points="24,15.5 32,24 24,32.5 16,24" fill="none" stroke="#ffffff" stroke-width="1.8" opacity=".75" stroke-linejoin="round"/>` +
      `<circle cx="24" cy="24" r="2.6" fill="#ffffff" opacity=".85"/>`
  ));

reg("💙", "蓝爱心", () => {
  const out = o(P.blue);
  return (
    gs(24, 42, 12) +
    `<path d="${heartPath(24, 22, 1.25)}" fill="${P.blue}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 39.5 C34 30 40 22 37.5 14.5 Q40.5 24 31 33.5 Q27.5 37 24 39.5 Z" fill="${shade(P.blue, -14)}" opacity=".75"/>` +
    `<ellipse cx="17" cy="16.5" rx="3.4" ry="2.2" fill="#ffffff" opacity=".55" transform="rotate(-28 17 16.5)"/>`
  );
});

reg("🌑", "睡月亮", () => {
  const c = "#8089a6";
  const out = o(c);
  return (
    gs(24, 42.5, 12) +
    `<circle cx="24" cy="24" r="14.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 38.5 a14.5 14.5 0 0 0 13.3 -20.2 a17 17 0 0 1 -13.3 20.2" fill="${shade(c, -16)}" opacity=".8"/>` +
    `<circle cx="15.5" cy="20" r="2.6" fill="${shade(c, -10)}" opacity=".7"/>` +
    `<circle cx="30" cy="14.5" r="1.8" fill="${shade(c, -10)}" opacity=".7"/>` +
    `<circle cx="32.5" cy="30.5" r="2.2" fill="${shade(c, -10)}" opacity=".7"/>` +
    `<path d="M18 26.5 q2 2 4 0 M26 26.5 q2 2 4 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M22.5 31.5 q1.5 1.4 3 0" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<ellipse cx="18" cy="15.5" rx="3.4" ry="2.1" fill="#ffffff" opacity=".4" transform="rotate(-24 18 15.5)"/>`
  );
});

reg("🌩️", "雷雨云", () => {
  const bolt = P.gold;
  return (
    cloudBody(24, 17, 1.05, "#dfe6f2") +
    `<polygon points="27,24 18.5,35.5 23,35.5 21,44 30,32.5 25.5,32.5"` +
    ` fill="${bolt}" stroke="${o(bolt)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<polygon points="27,24 25.5,32.5 30,32.5 28,35 24.2,34 25.4,26.5 Z" fill="${shade(bolt, 20)}" opacity=".7"/>` +
    hi(16.5, 10.5, 3, 1.8)
  );
});

reg("👑", "小皇冠", () => {
  const c = P.gold;
  const out = o(c);
  return (
    gs(24, 41.5, 14) +
    `<path d="M9.5 35 L8.5 17.5 L17 25 L24 12.5 L31 25 L39.5 17.5 L38.5 35 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M38.5 35 L39.5 17.5 L36 20.6 L35.5 35 Z" fill="${shade(c, -15)}" opacity=".75"/>` +
    `<path d="M10 38.5 L38 38.5 L38.2 34.5 L9.8 34.5 Z" fill="${shade(c, -8)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="10" r="2.6" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.4"/>` +
    `<circle cx="8.8" cy="15.5" r="2.2" fill="${P.teal}" stroke="${o(P.teal)}" stroke-width="1.3"/>` +
    `<circle cx="39.2" cy="15.5" r="2.2" fill="${P.teal}" stroke="${o(P.teal)}" stroke-width="1.3"/>` +
    `<circle cx="24" cy="30" r="2.4" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.3"/>` +
    hi(14.5, 22, 2.6, 1.6)
  );
});

reg("💣", "小炸弹", () => {
  const c = "#5f6678";
  const out = o(c);
  return (
    gs(24, 43, 12) +
    `<circle cx="23" cy="28" r="13" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M23 41 a13 13 0 0 0 11.9 -18.1 a15.5 15.5 0 0 1 -11.9 18.1" fill="${shade(c, -18)}" opacity=".8"/>` +
    `<path d="M28.5 16.5 L31.5 12.5 Q33.5 9.5 36.5 10.5" fill="none" stroke="${o(P.wood)}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<rect x="26.4" y="14.6" width="6.4" height="4" rx="1.6" fill="${shade(c, -10)}" stroke="${out}" stroke-width="1.4" transform="rotate(-42 29.6 16.6)"/>` +
    `<polygon points="${sparkPts(39, 8.5, 5)}" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<ellipse cx="17.5" cy="22" rx="4" ry="2.6" fill="#ffffff" opacity=".45" transform="rotate(-24 17.5 22)"/>`
  );
});

reg("🧲", "磁铁", () => {
  const c = P.red;
  const out = o(c);
  const tip = "#eef2fa";
  return (
    gs(24, 42.5, 13) +
    `<path d="M13 39.5 L13 21.5 A11 11 0 0 1 35 21.5 L35 39.5 L27 39.5 L27 21.5 A3 3 0 0 0 21 21.5 L21 39.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M35 39.5 L35 21.5 A11 11 0 0 0 29.5 12 Q33 15.5 32.2 21.5 L32.2 39.5 Z" fill="${shade(c, -15)}" opacity=".75"/>` +
    `<rect x="13" y="33" width="8" height="6.5" fill="${tip}" stroke="${out}" stroke-width="1.6"/>` +
    `<rect x="27" y="33" width="8" height="6.5" fill="${tip}" stroke="${out}" stroke-width="1.6"/>` +
    `<path d="M13.5 44 L15 42 M17 45 L17 42.8 M20.5 44 L19 42 M27.5 44 L29 42 M31 45 L31 42.8 M34.5 44 L33 42" ` +
    `stroke="${P.blue}" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>` +
    `<ellipse cx="17" cy="14.5" rx="3" ry="1.9" fill="#ffffff" opacity=".5" transform="rotate(-30 17 14.5)"/>`
  );
});

// ---- 找不同图鉴 · 第 1–3 章（W8R1-04 专项：水果果园 / 萌宠乐园 / 海底世界） ----

reg("🍌", "香蕉", () => {
  const c = "#f4cf4c";
  const out = o(c);
  return (
    gs(24, 42.5, 13) +
    `<path d="M12 10.5 Q9 27.5 21.5 36 Q32.5 43 40.5 34.5 Q42.2 32.3 39.4 32 Q27.5 33.5 19.8 24.5 Q13.8 17.5 15.6 11.2 Q16 9 13.8 9.6 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M21.5 36 Q32.5 43 40.5 34.5 Q41.5 33.2 40.4 32.6 Q33 39 22.8 33.6 Q15 29.4 12.6 20 Q13.6 30.5 21.5 36 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M15.8 15 Q14.8 24.5 21 30.5" fill="none" stroke="${shade(c, -8)}" stroke-width="1.4" opacity=".7"/>` +
    `<path d="M12.6 9.9 L15.3 10.7" stroke="${o(P.wood)}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="40" cy="33.6" r="1.7" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="1"/>` +
    hi(17.5, 14.5, 2.4, 1.5)
  );
});

reg("🍇", "葡萄", () => {
  const c = "#a583e8";
  const out = o(c);
  const grape = (x: number, y: number): string =>
    `<circle cx="${x}" cy="${y}" r="5.6" fill="${c}" stroke="${out}" stroke-width="1.8"/>`;
  return (
    gs(24, 43, 11) +
    `<path d="M24 14.5 Q23.5 9.5 26.5 6.5" fill="none" stroke="${o(P.wood)}" stroke-width="2.2" stroke-linecap="round"/>` +
    leafShape(29, 10, 9, -12, P.green) +
    grape(17, 19.5) + grape(31, 19.5) +
    grape(24, 17.5) +
    grape(13.5, 27.5) + grape(24, 28) + grape(34.5, 27.5) +
    grape(18.5, 35.5) + grape(29.5, 35.5) +
    `<circle cx="24" cy="41" r="5.6" fill="${shade(c, -12)}" stroke="${out}" stroke-width="1.8"/>` +
    `<circle cx="15.2" cy="17.8" r="1.8" fill="#ffffff" opacity=".55"/>` +
    `<circle cx="12" cy="25.8" r="1.5" fill="#ffffff" opacity=".45"/>`
  );
});

reg("🍓", "草莓", () => {
  const c = P.red;
  const out = o(c);
  const seed = (x: number, y: number): string =>
    `<ellipse cx="${x}" cy="${y}" rx="1" ry="1.5" fill="#ffe9a8" stroke="${out}" stroke-width=".5"/>`;
  return (
    gs(24, 43, 11) +
    `<path d="M24 42 Q10.5 33.5 10.5 21.5 Q10.5 14.5 24 14.5 Q37.5 14.5 37.5 21.5 Q37.5 33.5 24 42 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 42 Q37.5 33.5 37.5 21.5 Q37.5 17.5 33 16 Q35.5 22 32.5 30 Q29.5 37.5 24 42 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    seed(18, 22) + seed(30, 22) + seed(24, 27) + seed(15.5, 28.5) + seed(32, 28.5) + seed(20, 34) + seed(28, 34) +
    `<path d="M24 15.5 L18 10.5 L23 12.5 L24 7.5 L25 12.5 L30 10.5 Z" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    hi(17, 18.5, 2.8, 1.7)
  );
});

reg("🍍", "菠萝", () => {
  const c = "#f2bd4a";
  const out = o(c);
  const spike = (rot: number): string =>
    `<path d="M24 13.5 L20.5 4.5 L24 7 L27.5 4.5 Z" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.5" stroke-linejoin="round" transform="rotate(${rot} 24 13.5)"/>`;
  return (
    gs(24, 43.5, 11) +
    spike(-48) + spike(48) + spike(-24) + spike(24) + spike(0) +
    `<ellipse cx="24" cy="29" rx="11.5" ry="13.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 42.5 a11.5 13.5 0 0 0 10.5 -18.8 a13.5 16 0 0 1 -10.5 18.8" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M15 21 L33.5 36 M13.5 27 L30 39.5 M18.5 17.5 L35 31 M13.8 33 L24.5 41.8 M22 16.2 L35.4 27.2"` +
    ` stroke="${shade(c, -18)}" stroke-width="1.2" opacity=".6"/>` +
    `<path d="M33 21 L14.5 36 M34.5 27 L18 39.5 M29.5 17.5 L13 31 M34.2 33 L23.5 41.8 M26 16.2 L12.6 27.2"` +
    ` stroke="${shade(c, -18)}" stroke-width="1.2" opacity=".6"/>` +
    hi(17.5, 21, 2.6, 1.6)
  );
});

reg("🥝", "奇异果", () => {
  const rind = "#a58453";
  const flesh = "#9ccb62";
  return (
    gs(24, 43, 12) +
    `<circle cx="24" cy="25" r="14.5" fill="${rind}" stroke="${o(rind)}" stroke-width="2"/>` +
    `<path d="M24 39.5 a14.5 14.5 0 0 0 13.3 -20.2 a17 17 0 0 1 -13.3 20.2" fill="${shade(rind, -14)}" opacity=".8"/>` +
    `<circle cx="24" cy="25" r="11" fill="${flesh}" stroke="${shade(flesh, -20)}" stroke-width="1.2"/>` +
    `<circle cx="24" cy="25" r="4" fill="#f4f8e8"/>` +
    `<circle cx="24" cy="17.5" r="1.1" fill="${INK}"/><circle cx="24" cy="32.5" r="1.1" fill="${INK}"/>` +
    `<circle cx="17.5" cy="21.2" r="1.1" fill="${INK}"/><circle cx="30.5" cy="21.2" r="1.1" fill="${INK}"/>` +
    `<circle cx="17.5" cy="28.8" r="1.1" fill="${INK}"/><circle cx="30.5" cy="28.8" r="1.1" fill="${INK}"/>` +
    `<ellipse cx="19" cy="19" rx="2.6" ry="1.6" fill="#ffffff" opacity=".4" transform="rotate(-24 19 19)"/>`
  );
});

reg("🍒", "樱桃", () => {
  const c = P.red;
  const out = o(c);
  return (
    gs(24, 43, 13) +
    `<path d="M27 7.5 Q19 14.5 16.5 25 M27 7.5 Q30.5 17 32.5 26" fill="none" stroke="${P.green}" stroke-width="2.2" stroke-linecap="round"/>` +
    leafShape(30, 9.5, 9, -28, P.green) +
    `<circle cx="15.5" cy="31" r="7.4" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M15.5 38.4 a7.4 7.4 0 0 0 6.8 -10.3 a8.8 8.8 0 0 1 -6.8 10.3" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<circle cx="32.5" cy="33" r="7.4" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M32.5 40.4 a7.4 7.4 0 0 0 6.8 -10.3 a8.8 8.8 0 0 1 -6.8 10.3" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<circle cx="13" cy="28.5" r="1.7" fill="#ffffff" opacity=".6"/>` +
    `<circle cx="30" cy="30.5" r="1.7" fill="#ffffff" opacity=".6"/>`
  );
});

reg("🐼", "熊猫", () => {
  const white = "#f6f3ec";
  const dark = "#4a4458";
  return (
    gs() +
    `<circle cx="12.5" cy="14.5" r="5.6" fill="${dark}" stroke="${o(dark)}" stroke-width="2"/>` +
    `<circle cx="35.5" cy="14.5" r="5.6" fill="${dark}" stroke="${o(dark)}" stroke-width="2"/>` +
    `<ellipse cx="24" cy="26" rx="14.5" ry="12.5" fill="${white}" stroke="${o(white)}" stroke-width="2"/>` +
    `<path d="M24 38.5 a14.5 12.5 0 0 0 13.3 -6.9 a17 15 0 0 1 -13.3 6.9" fill="${shade(white, -12)}" opacity=".8"/>` +
    `<ellipse cx="17" cy="24" rx="4.6" ry="5.4" fill="${dark}" transform="rotate(-12 17 24)"/>` +
    `<ellipse cx="31" cy="24" rx="4.6" ry="5.4" fill="${dark}" transform="rotate(12 31 24)"/>` +
    `<circle cx="17.8" cy="23.6" r="1.6" fill="#ffffff"/><circle cx="30.2" cy="23.6" r="1.6" fill="#ffffff"/>` +
    `<circle cx="17.8" cy="23.6" r=".8" fill="${dark}"/><circle cx="30.2" cy="23.6" r=".8" fill="${dark}"/>` +
    `<ellipse cx="24" cy="30.5" rx="2.2" ry="1.7" fill="${dark}"/>` +
    `<path d="M21 33.8 Q24 36.2 27 33.8" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    hi(16, 17.5)
  );
});

reg("🦊", "狐狸", () =>
  critterFace({
    main: "#f0975a",
    ear: "pointy",
    earInner: "#f8d0b0",
    front:
      `<ellipse cx="16" cy="29.5" rx="6" ry="5" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.4"/>` +
      `<ellipse cx="32" cy="29.5" rx="6" ry="5" fill="${P.cream}" stroke="${o(P.cream)}" stroke-width="1.4"/>` +
      `<circle cx="18" cy="23.5" r="1.7" fill="${INK}"/><circle cx="30" cy="23.5" r="1.7" fill="${INK}"/>` +
      `<path d="M22.2 29.5 L25.8 29.5 L24 31.7 Z" fill="${INK}"/>` +
      `<path d="M24 31.7 q-1.8 2.2 -3.6 1 M24 31.7 q1.8 2.2 3.6 1" fill="none" stroke="${o("#f0975a")}" stroke-width="1.2" stroke-linecap="round"/>`
  }));

reg("🐙", "章鱼", () => {
  const c = P.rose;
  const out = o(c);
  const leg = (d: string): string =>
    `<path d="${d}" fill="none" stroke="${out}" stroke-width="6" stroke-linecap="round" opacity=".45"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="4.2" stroke-linecap="round"/>`;
  return (
    gs(24, 43.5, 14) +
    leg("M13 28 Q9.5 36.5 13.5 41") +
    leg("M20 31 Q18.5 38.5 22 42.5") +
    leg("M28 31 Q29.5 38.5 26 42.5") +
    leg("M35 28 Q38.5 36.5 34.5 41") +
    `<path d="M10.5 24 Q10.5 10.5 24 10.5 Q37.5 10.5 37.5 24 L37.5 28.5 Q37.5 31.5 34.5 31.5 L13.5 31.5 Q10.5 31.5 10.5 28.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M34.5 31.5 Q37.5 31.5 37.5 28.5 L37.5 24 Q37.5 15 30.5 12 Q35 16.5 34.8 24 L34.8 31.4 Z" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<circle cx="18.5" cy="22.5" r="2" fill="${INK}"/><circle cx="29.5" cy="22.5" r="2" fill="${INK}"/>` +
    `<path d="M21 27 Q24 29.4 27 27" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    blush(14.5, 33.5, 25.5) +
    hi(17, 14.5)
  );
});

reg("🦀", "螃蟹", () => {
  const c = "#f07a5a";
  const out = o(c);
  return (
    gs(24, 42, 14) +
    `<path d="M9 20 Q4.5 18 4.5 12.5 Q10.5 13 12.5 17.5 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M39 20 Q43.5 18 43.5 12.5 Q37.5 13 35.5 17.5 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cx="11" cy="19.5" r="4.4" fill="${c}" stroke="${out}" stroke-width="1.8"/>` +
    `<circle cx="37" cy="19.5" r="4.4" fill="${c}" stroke="${out}" stroke-width="1.8"/>` +
    `<path d="M8 32 L4.5 35 M11 35 L8.5 38.5 M40 32 L43.5 35 M37 35 L39.5 38.5"` +
    ` stroke="${out}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="30" rx="12.5" ry="9" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 39 a12.5 9 0 0 0 11.5 -5 a15 11 0 0 1 -11.5 5" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M19 22.5 L19 17.5 M29 22.5 L29 17.5" stroke="${out}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="19" cy="16" r="2.6" fill="#ffffff" stroke="${out}" stroke-width="1.4"/>` +
    `<circle cx="29" cy="16" r="2.6" fill="#ffffff" stroke="${out}" stroke-width="1.4"/>` +
    `<circle cx="19" cy="16" r="1.1" fill="${INK}"/><circle cx="29" cy="16" r="1.1" fill="${INK}"/>` +
    `<path d="M21 31.5 Q24 33.8 27 31.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    hi(17.5, 26)
  );
});

reg("🐬", "海豚", () => {
  const c = "#6db4e8";
  const out = o(c);
  return (
    gs(24, 42, 14) +
    `<path d="M25.5 12.5 Q26 6.5 31 7 Q28.5 9.5 29 13.5 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M10.5 30 L4.5 25.5 Q7.5 30.5 6 35.5 Q10.5 33.5 12.5 31 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M8.5 29.5 Q13 12.5 30 11.5 Q41.5 11 40.5 17.5 Q39.8 21.8 32.5 23 Q28.5 32 18.5 33 Q11 33.7 8.5 29.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M18.5 33 Q28.5 32 32.5 23 Q38.5 22 40.2 18.5 Q38 26.5 29 29.5 Q23 31.5 15.5 32.7 Q17 33.1 18.5 33 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M12 27.5 Q17 18.5 27 16" fill="none" stroke="#eaf5fd" stroke-width="3.6" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M25 20.5 Q22 25 24.5 28.5" fill="none" stroke="${out}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
    `<circle cx="33.5" cy="16" r="1.8" fill="${INK}"/>` +
    `<path d="M37.5 19.5 Q39.5 19 40.3 17.8" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
    hi(29, 13, 2.4, 1.5)
  );
});

reg("🐳", "鲸鱼", () => {
  const c = "#7aa8e8";
  const out = o(c);
  return (
    gs(24, 43, 15) +
    `<path d="M20 8 Q21.5 4.5 24 4 Q23.5 6.5 24.5 8 Z M28 8 Q29.5 4.5 32 4 Q31.5 6.5 32.5 8 Z" fill="${P.blue}" stroke="${o(P.blue)}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M26 11.5 Q26 8.5 26 8" fill="none" stroke="${o(P.blue)}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M38.5 26 Q44 22.5 44 16.5 Q39 18.5 36.5 22 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M6.5 29 Q6.5 12.5 23 12.5 Q37 12.5 39 24 Q39.8 28.5 37 31.5 Q34 34.5 28 35 L12 35 Q6.5 33 6.5 29 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M28 35 Q34 34.5 37 31.5 Q39.8 28.5 39 24 Q38.2 19.5 34.5 16.5 Q37 21.5 35.5 27.5 Q33.8 33.5 25.5 34.8 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    `<path d="M9 30.5 Q13 28.5 17 30.5 M11 33 Q14.5 31.4 18 33" fill="none" stroke="#e8f2fc" stroke-width="2" stroke-linecap="round" opacity=".9"/>` +
    `<circle cx="15" cy="22.5" r="2" fill="${INK}"/>` +
    `<path d="M11.5 27 Q14 29 16.5 27" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    blush(11, 20, 25.5) +
    hi(15, 16.5)
  );
});

reg("🦑", "鱿鱼", () => {
  const c = P.lav;
  const out = o(c);
  const leg = (d: string): string =>
    `<path d="${d}" fill="none" stroke="${out}" stroke-width="4.6" stroke-linecap="round" opacity=".45"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`;
  return (
    gs(24, 43.5, 12) +
    leg("M15.5 31 Q12.5 37.5 15 42") +
    leg("M20 32.5 Q19 38.5 21.5 42.8") +
    leg("M28 32.5 Q29 38.5 26.5 42.8") +
    leg("M32.5 31 Q35.5 37.5 33 42") +
    `<path d="M24 4.5 Q31 9.5 30.5 18 L17.5 18 Q17 9.5 24 4.5 Z" fill="${shade(c, -8)}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M16.5 17.5 Q15.5 30 24 31.5 Q32.5 30 31.5 17.5 Q28 15.5 24 15.5 Q20 15.5 16.5 17.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 31.5 Q32.5 30 31.5 17.5 Q29.8 16.5 28 16 Q30.5 27 22 30.9 Q23 31.4 24 31.5 Z" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<circle cx="20.5" cy="23" r="2.2" fill="#ffffff"/><circle cx="27.5" cy="23" r="2.2" fill="#ffffff"/>` +
    `<circle cx="20.9" cy="23.3" r="1.1" fill="${INK}"/><circle cx="27.1" cy="23.3" r="1.1" fill="${INK}"/>` +
    `<path d="M22.5 27.2 Q24 28.4 25.5 27.2" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
    hi(20, 8.5, 2.2, 1.4)
  );
});

reg("🐚", "贝壳", () => {
  const c = "#f4c9b0";
  const out = o(c);
  return (
    gs(24, 42.5, 12) +
    `<path d="M20.5 41 L16.5 36 Q7 26 8.5 15.5 Q8.9 12.5 12 13.5 Q16.5 15 19 19.5 Q20.5 13.5 24 9.5 Q27.5 13.5 29 19.5 Q31.5 15 36 13.5 Q39.1 12.5 39.5 15.5 Q41 26 31.5 36 L27.5 41 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M27.5 41 L31.5 36 Q41 26 39.5 15.5 Q39.3 14 38.2 13.6 Q39.5 24.5 31 33.5 Q28 36.8 25 40.2 Z" fill="${shade(c, -13)}" opacity=".8"/>` +
    `<path d="M24 39.5 L24 12.5 M20 38 Q13.5 27 12 17 M28 38 Q34.5 27 36 17" fill="none" stroke="${out}" stroke-width="1.4" opacity=".65"/>` +
    hi(17, 19, 2.6, 1.6)
  );
});

// ---- 找不同图鉴 · 第 4 章 甜品小屋（W8R1-04 余量 · 第 3 轮终验按稿补齐） ----

reg("🍰", "奶油蛋糕", () => {
  // 双胞胎 🍰↔🎂 的区分位：三角切片 + 顶上单颗草莓（🎂 是整圆双层 + 蜡烛）
  const cream = "#fff3df";
  const sponge = "#f6d7a0";
  const jam = P.rose;
  return (
    gs(24, 42, 15) +
    `<ellipse cx="24" cy="39.5" rx="16.5" ry="3.2" fill="#eef2fa" stroke="#a8b4cc" stroke-width="1.5"/>` +
    // 奶油外壳（沿两条上边形成霜盖）
    `<path d="M28 8 L43 38.5 L7 38.5 Z" fill="${cream}" stroke="${o(sponge)}" stroke-width="2" stroke-linejoin="round"/>` +
    // 蛋糕坯
    `<path d="M28 16.5 L39 38.5 L10.5 38.5 Z" fill="${sponge}"/>` +
    // 夹心果酱层
    `<path d="M18.6 25.5 L34.5 25.5 L36.7 30 L16.4 30 Z" fill="${jam}" opacity=".85"/>` +
    // 底部暗面
    `<path d="M12 35.5 L38 35.5 L39 38.5 L10.5 38.5 Z" fill="${shade(sponge, -16)}" opacity=".7"/>` +
    // 顶上的草莓（区分位）
    `<circle cx="28" cy="6.8" r="3.4" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.6"/>` +
    `<ellipse cx="27" cy="5.6" rx="1" ry=".7" fill="#ffe9a8"/>` +
    hi(21, 20, 2.8, 1.7)
  );
});

reg("🎂", "生日蛋糕", () => {
  // 双胞胎 🎂↔🍰 的区分位：整圆双层 + 蜡烛（🍰 是三角切片 + 草莓）
  const lower = "#f4a8bc";
  const upper = "#f8c6d4";
  const candle = "#8ecbe8";
  return (
    gs(24, 43, 16) +
    `<ellipse cx="24" cy="40" rx="17.5" ry="3.2" fill="#eef2fa" stroke="#a8b4cc" stroke-width="1.5"/>` +
    // 下层
    `<path d="M7.5 29 L40.5 29 L40.5 38 Q40.5 40 38.5 40 L9.5 40 Q7.5 40 7.5 38 Z" fill="${lower}" stroke="${o(lower)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M36.5 29 L40.5 29 L40.5 38 Q40.5 40 38.5 40 L34.5 40 Q36.5 39.5 36.5 37.5 Z" fill="${shade(lower, -14)}" opacity=".8"/>` +
    // 下层奶油帘
    `<path d="M7.5 29 L40.5 29 L40.5 30.5 Q37.5 33.5 34.8 30.5 Q32 33.5 29.2 30.5 Q26.5 33.5 24 30.5 Q21.5 33.5 18.8 30.5 Q16 33.5 13.2 30.5 Q10.5 33.5 7.5 30.5 Z" fill="${P.cream}" stroke="${o(lower)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    // 上层
    `<path d="M12 20 L36 20 L36 29 L12 29 Z" fill="${upper}" stroke="${o(upper)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M12 20 L36 20 L36 21.5 Q33.5 24 31.5 21.5 Q29.5 24 27.5 21.5 Q25.8 24 24 21.5 Q22.2 24 20.5 21.5 Q18.5 24 16.5 21.5 Q14.5 24 12 21.5 Z" fill="${P.cream}" stroke="${o(upper)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    // 三根蜡烛（区分位）
    `<rect x="16" y="11.5" width="3" height="8.5" rx="1.2" fill="${candle}" stroke="${o(candle)}" stroke-width="1.2"/>` +
    `<rect x="22.5" y="10" width="3" height="10" rx="1.2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    `<rect x="29" y="11.5" width="3" height="8.5" rx="1.2" fill="#b0e0a8" stroke="${o("#b0e0a8")}" stroke-width="1.2"/>` +
    `<ellipse cx="17.5" cy="9" rx="1.5" ry="2.2" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width=".9"/>` +
    `<ellipse cx="24" cy="7.4" rx="1.5" ry="2.2" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width=".9"/>` +
    `<ellipse cx="30.5" cy="9" rx="1.5" ry="2.2" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width=".9"/>` +
    hi(16, 24.5, 2.6, 1.6)
  );
});

reg("🧁", "纸杯蛋糕", () => {
  const cup = "#f0a8c0";
  const cream = "#fff3df";
  return (
    gs(24, 43, 12) +
    // 纸杯（带竖褶）
    `<path d="M12.5 27 L35.5 27 L32.5 41 Q32 42.5 30.5 42.5 L17.5 42.5 Q16 42.5 15.5 41 Z" fill="${cup}" stroke="${o(cup)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M17.8 27.5 L19.5 42 M23.9 27.5 L24 42 M30 27.5 L28.5 42" fill="none" stroke="${shade(cup, -16)}" stroke-width="1.3" opacity=".65"/>` +
    `<path d="M31.5 27.5 L35.5 27 L32.5 41 Q32 42.5 30.5 42.5 L29 42.5 Q31.7 39 31.5 27.5 Z" fill="${shade(cup, -14)}" opacity=".7"/>` +
    // 奶油三叠
    `<ellipse cx="24" cy="25.5" rx="12.5" ry="5.4" fill="${cream}" stroke="${o("#f6d7a0")}" stroke-width="1.8"/>` +
    `<ellipse cx="24" cy="20" rx="9" ry="4.8" fill="${cream}" stroke="${o("#f6d7a0")}" stroke-width="1.8"/>` +
    `<path d="M18.5 16.5 Q19.5 11.5 24 11.5 Q28.5 11.5 29.5 16.5 Q27 19 24 18.6 Q21 19 18.5 16.5 Z" fill="${cream}" stroke="${o("#f6d7a0")}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M29 21.5 Q31.5 23.5 30.5 26.5" fill="none" stroke="${shade("#f6d7a0", -8)}" stroke-width="1.2" opacity=".7"/>` +
    // 樱桃
    `<circle cx="24" cy="9.5" r="2.8" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.4"/>` +
    `<path d="M24.3 7 Q24.8 5 26.3 4.4" fill="none" stroke="${P.green}" stroke-width="1.5" stroke-linecap="round"/>` +
    hi(19, 14, 2.2, 1.4)
  );
});

reg("🍩", "甜甜圈", () => {
  // 双胞胎 🍩↔🍪 的区分位：中孔 + 粉糖霜披挂（🍪 无孔、巧克力豆）
  const dough = "#e8b878";
  const icing = P.rose;
  const sprinkle = (x: number, y: number, rot: number, c: string): string =>
    `<rect x="${x}" y="${y}" width="3.4" height="1.5" rx=".75" fill="${c}" transform="rotate(${rot} ${x + 1.7} ${y + 0.75})"/>`;
  return (
    gs(24, 42.5, 14) +
    `<path fill-rule="evenodd" d="M24 10.5 A15 15 0 1 0 24.01 10.5 Z M24 19.5 A6 6 0 1 1 23.99 19.5 Z" fill="${dough}" stroke="${o(dough)}" stroke-width="2"/>` +
    `<path d="M24 40.5 a15 15 0 0 0 13.8 -20.6 a17 17 0 0 1 -13.8 20.6" fill="${shade(dough, -13)}" opacity=".75"/>` +
    // 糖霜披挂（带波浪下摆，同样留中孔）
    `<path fill-rule="evenodd" d="M9.4 24 Q9.4 11 24 11 Q38.6 11 38.6 24 Q38.6 27 36 27.5 Q33.5 28 32.5 25.5 Q31 22.5 29 25 Q27 27.8 24.5 26 Q22 24.2 20 26.5 Q18 28.8 15.5 27 Q13 25.2 11.8 26.5 Q9.4 28 9.4 24 Z M24 19.5 A6 6 0 1 1 23.99 19.5 Z" fill="${icing}" stroke="${o(icing)}" stroke-width="1.8"/>` +
    `<circle cx="24" cy="25.5" r="6" fill="none" stroke="${o(dough)}" stroke-width="1.6" opacity=".55"/>` +
    sprinkle(15, 17, -24, "#fff3df") + sprinkle(22, 13.5, 10, P.teal) + sprinkle(30, 16.5, 28, P.gold) +
    sprinkle(33.5, 22, -40, "#fff3df") + sprinkle(13, 22.5, 36, P.gold) +
    hi(16.5, 15.5, 2.8, 1.7)
  );
});

reg("🍫", "巧克力", () => {
  const choc = "#8a5a3c";
  const foil = "#f0e6d4";
  return (
    gs(24, 42.5, 12) +
    // 巧克力板
    `<rect x="12" y="7.5" width="24" height="26" rx="2.5" fill="${choc}" stroke="${o(choc)}" stroke-width="2"/>` +
    `<path d="M24.2 8 L23.8 33 M12.5 16 L35.5 16 M12.5 24.5 L35.5 24.5" stroke="${shade(choc, -22)}" stroke-width="1.5" opacity=".8"/>` +
    `<path d="M14.5 10 L21.5 10 M14.5 18.5 L21.5 18.5 M26.5 10 L33.5 10 M26.5 18.5 L33.5 18.5" stroke="${shade(choc, 22)}" stroke-width="1.4" opacity=".7"/>` +
    // 下半的包装纸（锯齿口）
    `<path d="M11 28.5 L15 31.5 L19 28.5 L23 31.5 L27 28.5 L31 31.5 L35 28.5 L37 30 L37 40 Q37 42 35 42 L13 42 Q11 42 11 40 Z" fill="${foil}" stroke="${o("#d8c8a8")}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<rect x="11.6" y="33.5" width="24.8" height="4.6" fill="${P.teal}" opacity=".85"/>` +
    `<path d="M33 31 L37 30 L37 40 Q37 42 35 42 L32.5 42 Q34 41 33.8 38 Z" fill="${shade(foil, -12)}" opacity=".75"/>` +
    hi(16, 11, 2.4, 1.5)
  );
});

reg("🍭", "棒棒糖", () => {
  // 双胞胎 🍭↔🍬 的区分位：圆盘糖 + 小木棒竖构图（🍬 是双扭糖纸横构图）
  const c = P.rose;
  const out = o(c);
  return (
    gs(24, 42.5, 9) +
    `<path d="M24 31.5 L24 43" stroke="${o(P.wood)}" stroke-width="3.2" stroke-linecap="round"/>` +
    `<circle cx="24" cy="19.5" r="12.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 32 a12.5 12.5 0 0 0 11.5 -17.4 a14.5 14.5 0 0 1 -11.5 17.4" fill="${shade(c, -13)}" opacity=".8"/>` +
    // 白色螺旋纹
    `<path d="M24 19.5 a2.6 2.6 0 0 1 2.6 2.6 a5.2 5.2 0 0 1 -10.4 0 a7.8 7.8 0 0 1 7.8 -7.8 a10.4 10.4 0 0 1 9.5 5.9" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>` +
    hi(18.5, 13, 2.8, 1.7)
  );
});

reg("🍮", "焦糖布丁", () => {
  const flan = "#f8ce7a";
  const caramel = "#c97b3d";
  return (
    gs(24, 42.5, 15) +
    `<ellipse cx="24" cy="39" rx="16.5" ry="3.4" fill="#eef2fa" stroke="#a8b4cc" stroke-width="1.5"/>` +
    // 布丁身（上窄下宽）
    `<path d="M14.5 15.5 L33.5 15.5 Q36 15.5 36.5 18 L38.5 34 Q39 37.5 35.5 37.5 L12.5 37.5 Q9 37.5 9.5 34 L11.5 18 Q12 15.5 14.5 15.5 Z" fill="${flan}" stroke="${o(flan)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M33 16 L36.5 18 L38.5 34 Q39 37.5 35.5 37.5 L32 37.5 Q35 36.5 34.6 32.5 Z" fill="${shade(flan, -14)}" opacity=".75"/>` +
    // 焦糖顶（波浪下摆）
    `<path d="M14.5 15.5 L33.5 15.5 Q36 15.5 36.5 18 L37 22 Q34.5 25.5 32.5 22.5 Q30.5 19.5 28.5 23 Q26.5 26.5 24 23.5 Q21.5 20.5 19.5 23.5 Q17.5 26.5 15.5 23 Q13.5 19.5 11.2 22.5 L11.5 18 Q12 15.5 14.5 15.5 Z" fill="${caramel}" stroke="${o(caramel)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    hi(17, 19, 2.8, 1.7)
  );
});

// ---- 找不同图鉴 · 第 5 章 夜空营地（W8R1-04 余量 · 第 3 轮终验按稿补齐） ----

reg("🪐", "光环星球", () => {
  const c = P.lav;
  const out = o(c);
  const ring = P.teal;
  return (
    // 光环后半（从星球背后穿过）
    `<g transform="rotate(-16 24 24)">` +
    `<path d="M5 24 A19 6.4 0 0 1 43 24" fill="none" stroke="${o(ring)}" stroke-width="5.6" opacity=".5"/>` +
    `<path d="M5 24 A19 6.4 0 0 1 43 24" fill="none" stroke="${ring}" stroke-width="4"/>` +
    `</g>` +
    `<circle cx="24" cy="24" r="11.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 35.5 a11.5 11.5 0 0 0 10.6 -16 a14 14 0 0 1 -10.6 16" fill="${shade(c, -15)}" opacity=".8"/>` +
    `<path d="M13.5 20.5 Q24 17.5 34.5 20.5 M14.5 29 Q24 31.5 33.5 29" fill="none" stroke="${shade(c, 16)}" stroke-width="2" stroke-linecap="round" opacity=".75"/>` +
    // 光环前半（盖在星球前）
    `<g transform="rotate(-16 24 24)">` +
    `<path d="M5 24 A19 6.4 0 0 0 43 24" fill="none" stroke="${o(ring)}" stroke-width="5.6" opacity=".5"/>` +
    `<path d="M5 24 A19 6.4 0 0 0 43 24" fill="none" stroke="${ring}" stroke-width="4"/>` +
    `</g>` +
    hi(18.5, 17.5)
  );
});

reg("🌈", "彩虹", () => {
  const bands: Array<[string, number]> = [
    [P.red, 17.5],
    [P.gold, 13.6],
    [P.green, 9.7],
    [P.blue, 5.8],
  ];
  return (
    bands
      .map(
        ([c, r]) =>
          `<path d="M${24 - r} 33.5 A${r} ${r} 0 0 1 ${24 + r} 33.5" fill="none" stroke="${o(String(c))}" stroke-width="5.4" stroke-linecap="round" opacity=".35"/>` +
          `<path d="M${24 - r} 33.5 A${r} ${r} 0 0 1 ${24 + r} 33.5" fill="none" stroke="${c}" stroke-width="3.9" stroke-linecap="round"/>`
      )
      .join("") +
    cloudBody(9, 33.5, 0.62, "#ffffff") +
    cloudBody(39, 33.5, 0.62, "#ffffff") +
    hi(15, 22, 2.2, 1.4)
  );
});

reg("🌠", "流星", () => {
  // 双胞胎 🌠↔✨ 的区分位：单颗星 + 长拖尾（✨ 是三星簇无拖尾）
  const c = P.gold;
  const out = o(c);
  const tail = "#ffe9a8";
  return (
    `<path d="M22 24.5 L43 5 L27.5 28.5 Z" fill="${tail}" stroke="${o(tail)}" stroke-width="1.6" stroke-linejoin="round" opacity=".9"/>` +
    `<path d="M26.5 30.5 L44 15.5 L31 33 Z" fill="${tail}" opacity=".6"/>` +
    `<polygon points="${starPts(17, 31, 10)}" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="${starPts(17, 31, 5, 2.1)}" fill="#ffffff" opacity=".55"/>` +
    `<circle cx="38" cy="9" r="1.3" fill="${tail}"/>` +
    `<circle cx="33.5" cy="20" r="1.1" fill="${tail}" opacity=".8"/>` +
    hi(14, 27, 1.8, 1.2)
  );
});

reg("🔭", "望远镜", () => {
  const tube = P.blueDeep;
  const out = o(tube);
  return (
    gs(24, 43.5, 13) +
    // 三脚架
    `<path d="M22.5 30 L14 43 M25.5 30 L33 43 M24 30 L24 41" fill="none" stroke="${o(P.wood)}" stroke-width="2.6" stroke-linecap="round"/>` +
    // 主镜筒（斜指右上）
    `<g transform="rotate(-38 24 24)">` +
    `<rect x="9" y="19.5" width="30" height="9" rx="3" fill="${tube}" stroke="${out}" stroke-width="2"/>` +
    `<rect x="9" y="24.2" width="30" height="4" rx="2" fill="${shade(tube, -15)}" opacity=".7"/>` +
    `<rect x="33.5" y="18" width="6" height="12" rx="2.2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.6"/>` +
    `<rect x="6" y="21" width="4.5" height="6" rx="1.8" fill="${shade(tube, -20)}" stroke="${out}" stroke-width="1.4"/>` +
    `</g>` +
    `<circle cx="24" cy="27.5" r="2.6" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.4"/>` +
    `<polygon points="${starPts(40, 8, 3.2)}" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1"/>` +
    hi(15.5, 22, 2.2, 1.4)
  );
});

// ---- 找不同图鉴 · 第 6 章 玩具城堡（W8R1-04 余量 · 第 3 轮终验按稿补齐） ----

reg("🧸", "玩具熊", () => {
  // 通用简笔坐姿泰迪：圆耳圆身 + 缝线肚兜，无衣饰无纽扣（去色剪影自查过，避开任何知名熊形象）
  const c = "#c99b6a";
  const out = o(c);
  const belly = "#f0dcc0";
  return (
    gs(24, 43.5, 13) +
    // 耳朵
    `<circle cx="15.5" cy="9.5" r="4.6" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="32.5" cy="9.5" r="4.6" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="15.5" cy="9.5" r="2" fill="${belly}"/>` +
    `<circle cx="32.5" cy="9.5" r="2" fill="${belly}"/>` +
    // 手臂
    `<ellipse cx="10.5" cy="28.5" rx="4" ry="6.4" fill="${c}" stroke="${out}" stroke-width="2" transform="rotate(18 10.5 28.5)"/>` +
    `<ellipse cx="37.5" cy="28.5" rx="4" ry="6.4" fill="${c}" stroke="${out}" stroke-width="2" transform="rotate(-18 37.5 28.5)"/>` +
    // 腿
    `<ellipse cx="15" cy="39" rx="5.4" ry="4.2" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<ellipse cx="33" cy="39" rx="5.4" ry="4.2" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<ellipse cx="14.5" cy="39.5" rx="2.4" ry="1.9" fill="${belly}"/>` +
    `<ellipse cx="33.5" cy="39.5" rx="2.4" ry="1.9" fill="${belly}"/>` +
    // 身体与肚兜
    `<ellipse cx="24" cy="31.5" rx="10" ry="9.6" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 41.1 a10 9.6 0 0 0 9.2 -13.6 a12 11.5 0 0 1 -9.2 13.6" fill="${shade(c, -14)}" opacity=".75"/>` +
    `<ellipse cx="24" cy="32.5" rx="5.6" ry="5.4" fill="${belly}"/>` +
    // 头
    `<circle cx="24" cy="15.5" r="9.6" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 25.1 a9.6 9.6 0 0 0 8.8 -13.4 a11.5 11.5 0 0 1 -8.8 13.4" fill="${shade(c, -14)}" opacity=".75"/>` +
    // 口鼻与缝线
    `<ellipse cx="24" cy="18.5" rx="4.2" ry="3.2" fill="${belly}"/>` +
    `<path d="M22.6 17.5 L25.4 17.5 L24 19.2 Z" fill="${INK}"/>` +
    `<path d="M24 19.2 L24 20.6 M22.5 21.6 Q24 22.6 25.5 21.6" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>` +
    `<circle cx="20" cy="14" r="1.5" fill="${INK}"/><circle cx="28" cy="14" r="1.5" fill="${INK}"/>` +
    `<path d="M24 27.5 L24 30" stroke="${out}" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>` +
    hi(19, 10, 2.4, 1.5)
  );
});

reg("🚂", "小火车头", () => {
  // 双胞胎 🚂↔🚗 的区分位：烟囱 + 冒烟 + 圆锅炉（🚗 是无烟囱的轿车）
  const body = P.teal;
  const out = o(body);
  const cab = P.red;
  return (
    gs(24, 42.5, 15) +
    // 烟囱冒的烟
    `<circle cx="13" cy="9" r="3.4" fill="#eef2fa" stroke="#b8c4d8" stroke-width="1.4"/>` +
    `<circle cx="17.5" cy="6" r="2.4" fill="#eef2fa" stroke="#b8c4d8" stroke-width="1.2"/>` +
    // 车厢（右侧驾驶室）
    `<path d="M28 12.5 L38 12.5 Q39.5 12.5 39.5 14 L39.5 31 L28 31 Z" fill="${cab}" stroke="${o(cab)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="30.5" y="16" width="6" height="5.6" rx="1.4" fill="#dff3fa" stroke="${o(cab)}" stroke-width="1.4"/>` +
    `<path d="M26.5 12.5 L41 12.5 Q42.5 12.5 42.5 11 Q42.5 9.5 41 9.5 L28 9.5 Q26.5 9.5 26.5 11 Z" fill="${shade(cab, -12)}" stroke="${o(cab)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // 锅炉
    `<path d="M8.5 20.5 Q8.5 16.5 12.5 16.5 L26 16.5 Q28 16.5 28 18.5 L28 31 L8.5 31 Z" fill="${body}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M22 16.5 L26 16.5 Q28 16.5 28 18.5 L28 31 L24 31 Q25.5 24 22 16.5 Z" fill="${shade(body, -14)}" opacity=".75"/>` +
    // 烟囱（区分位）
    `<path d="M10.5 16.5 L10.5 11.5 Q10.5 10 12 10 L14 10 Q15.5 10 15.5 11.5 L15.5 16.5 Z" fill="${shade(body, -18)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    // 车灯
    `<circle cx="9.8" cy="23.5" r="2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.3"/>` +
    // 底盘与轮子
    `<rect x="6.5" y="31" width="35" height="4" rx="2" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="1.8"/>` +
    `<circle cx="13" cy="37.5" r="4" fill="#5f6678" stroke="${o("#5f6678")}" stroke-width="1.8"/>` +
    `<circle cx="24" cy="37.5" r="4" fill="#5f6678" stroke="${o("#5f6678")}" stroke-width="1.8"/>` +
    `<circle cx="35" cy="37.5" r="4" fill="#5f6678" stroke="${o("#5f6678")}" stroke-width="1.8"/>` +
    `<circle cx="13" cy="37.5" r="1.5" fill="${P.gold}"/><circle cx="24" cy="37.5" r="1.5" fill="${P.gold}"/><circle cx="35" cy="37.5" r="1.5" fill="${P.gold}"/>` +
    hi(13, 19.5, 2.4, 1.5)
  );
});

reg("✈️", "小飞机", () => {
  // 双胞胎 ✈️↔🚁 的区分位：固定翼 + 尾翼（🚁 是顶置旋翼 + 尾桨）
  const body = P.blue;
  const out = o(body);
  return (
    gs(24, 41, 15) +
    // 尾翼
    `<path d="M7 12.5 L13.5 12.5 L15.5 24 L7.5 24 Q10 18 7 12.5 Z" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    // 机身（右为机头）
    `<path d="M6.5 27.5 Q6.5 21.5 14 21.5 L33 21.5 Q39.5 21.5 42 25 Q43 26.5 41 28.5 Q37.5 32 31 32 L12 32 Q6.5 32 6.5 27.5 Z" fill="${body}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M31 32 Q37.5 32 41 28.5 Q43 26.5 42 25 Q40.5 29 33 30 L14 30.5 Q23 32 31 32 Z" fill="${shade(body, -14)}" opacity=".75"/>` +
    // 机翼（伸向观者下方）
    `<path d="M19 25.5 L30 25.5 L24.5 35.5 L14.5 35.5 Z" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    // 舷窗与驾驶舱
    `<circle cx="17" cy="25.5" r="1.9" fill="#dff3fa" stroke="${out}" stroke-width="1.2"/>` +
    `<circle cx="24" cy="25.5" r="1.9" fill="#dff3fa" stroke="${out}" stroke-width="1.2"/>` +
    `<path d="M36 22.5 Q39.5 23.5 41 25.5 Q38.5 26.5 36 25.5 Z" fill="#dff3fa" stroke="${out}" stroke-width="1.2" stroke-linejoin="round"/>` +
    hi(13, 24, 2.4, 1.4)
  );
});

reg("🚁", "直升机", () => {
  // 双胞胎 🚁↔✈️ 的区分位：顶置旋翼（🚁 独有）
  const body = P.orange;
  const out = o(body);
  return (
    gs(24, 42, 14) +
    // 顶置旋翼（区分位）
    `<path d="M6 8.5 L42 8.5" stroke="${o("#8fa2b8")}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M24 9 L24 14" stroke="${out}" stroke-width="2.2"/>` +
    `<circle cx="24" cy="9" r="2" fill="#8fa2b8" stroke="${o("#8fa2b8")}" stroke-width="1.3"/>` +
    // 尾梁与尾桨
    `<path d="M30 22 L42 19.5 L42 23 L30 25.5 Z" fill="${shade(body, -10)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M42 14.5 L42 27.5" stroke="${o("#8fa2b8")}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="42" cy="21" r="1.7" fill="#8fa2b8" stroke="${o("#8fa2b8")}" stroke-width="1.2"/>` +
    // 机舱
    `<path d="M9 22.5 Q9 14 19 14 L26 14 Q34 14 34 22.5 Q34 30.5 25.5 30.5 L16 30.5 Q9 30.5 9 22.5 Z" fill="${body}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M25.5 30.5 Q34 30.5 34 22.5 Q34 17 30.5 15.2 Q32.5 19 31.5 24 Q30.2 29.5 22 30.3 Q23.8 30.5 25.5 30.5 Z" fill="${shade(body, -14)}" opacity=".75"/>` +
    // 大舷窗
    `<path d="M11.5 20.5 Q12.5 16.5 17.5 16.5 L20 16.5 L20 24 L13 24 Q11.5 23 11.5 20.5 Z" fill="#dff3fa" stroke="${out}" stroke-width="1.4" stroke-linejoin="round"/>` +
    // 起落橇
    `<path d="M17 30.5 L17 34.5 M28 30.5 L28 34.5" stroke="${out}" stroke-width="2"/>` +
    `<path d="M12 35.5 L33.5 35.5" stroke="${out}" stroke-width="2.4" stroke-linecap="round"/>` +
    hi(15, 17.5, 2.4, 1.5)
  );
});

reg("🏀", "篮球", () => {
  // 双胞胎 🏀↔⚽ 的区分位：橙底弧线球缝（⚽ 是黑白五边形）
  const c = "#f08c3a";
  const out = o(c);
  const seam = shade(c, -32);
  return (
    gs(24, 42.5, 13) +
    `<circle cx="24" cy="25" r="14.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 39.5 a14.5 14.5 0 0 0 13.3 -20.2 a17 17 0 0 1 -13.3 20.2" fill="${shade(c, -14)}" opacity=".75"/>` +
    `<path d="M24 10.5 L24 39.5 M9.5 25 L38.5 25" fill="none" stroke="${seam}" stroke-width="1.8"/>` +
    `<path d="M13.5 14.5 Q19.5 25 13.5 35.5 M34.5 14.5 Q28.5 25 34.5 35.5" fill="none" stroke="${seam}" stroke-width="1.8"/>` +
    hi(17.5, 17)
  );
});

reg("🎈", "气球", () => {
  const c = P.red;
  const out = o(c);
  return (
    `<ellipse cx="24" cy="18.5" rx="11" ry="13" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 31.5 a11 13 0 0 0 10.1 -18.2 a13 15.5 0 0 1 -10.1 18.2" fill="${shade(c, -14)}" opacity=".75"/>` +
    `<path d="M21.5 31 L26.5 31 L25 34 L23 34 Z" fill="${c}" stroke="${out}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M24 34 Q20 39 23.5 44" fill="none" stroke="${out}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<ellipse cx="19" cy="11.5" rx="3.2" ry="4.6" fill="#ffffff" opacity=".5" transform="rotate(22 19 11.5)"/>`
  );
});

reg("🥁", "小鼓", () => {
  const shell = P.rose;
  const out = o(shell);
  return (
    gs(24, 43, 15) +
    // 交叉鼓棒
    `<path d="M10 7.5 L25 19 M38 7.5 L23 19" stroke="${o(P.wood)}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="10" cy="7.5" r="2.4" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.3"/>` +
    `<circle cx="38" cy="7.5" r="2.4" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.3"/>` +
    // 鼓身
    `<path d="M9.5 22 L9.5 36 Q9.5 40.5 24 40.5 Q38.5 40.5 38.5 36 L38.5 22 Z" fill="${shell}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M34 22 L38.5 22 L38.5 36 Q38.5 39.2 31 40.2 Q35.5 38.5 35 34.5 Z" fill="${shade(shell, -14)}" opacity=".75"/>` +
    // 绷绳锯齿
    `<path d="M11 24.5 L17.5 35.5 L24 24.5 L30.5 35.5 L37 24.5" fill="none" stroke="${P.gold}" stroke-width="1.8" stroke-linejoin="round"/>` +
    // 鼓面
    `<ellipse cx="24" cy="22" rx="14.5" ry="4.6" fill="#fff6e8" stroke="${out}" stroke-width="2"/>` +
    `<ellipse cx="24" cy="22" rx="10.5" ry="3.1" fill="none" stroke="#e0d2b8" stroke-width="1.2"/>` +
    hi(16, 20.5, 2.8, 1.5)
  );
});

// ---- 找不同图鉴 · 第 7 章 三图侦探社（W8R1-04 余量 · FLIPPABLE ▲六张非对称剪影） ----

reg("🔍", "放大镜", () => {
  // FLIPPABLE ▲：手柄偏右下，剪影左右非对称
  const ring = P.gold;
  const glass = "#dff3fa";
  return (
    gs(24, 42, 12) +
    `<path d="M25.5 25.5 L38.5 38.5" stroke="${o(P.wood)}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M25.5 25.5 L38.5 38.5" stroke="${P.wood}" stroke-width="5.2" stroke-linecap="round"/>` +
    `<circle cx="18" cy="18" r="11.5" fill="${glass}" stroke="${o(ring)}" stroke-width="5.4"/>` +
    `<circle cx="18" cy="18" r="11.5" fill="none" stroke="${ring}" stroke-width="3.2"/>` +
    `<path d="M12 14.5 Q14.5 10.5 19 10.5" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M22 23.5 Q19 24.8 15.5 24" fill="none" stroke="#a8ccd8" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`
  );
});

reg("🧩", "拼图块", () => {
  // FLIPPABLE ▲：凸耳只在上边与右边，剪影左右非对称
  const c = P.teal;
  const out = o(c);
  return (
    gs(24, 42.5, 13) +
    `<path d="M11 15 L18.5 15 Q17 9.5 21 8 Q26 6.5 26.5 11 Q26.8 13.5 25 15 L34 15 Q36 15 36 17 L36 23.5 Q41.5 22 43 26 Q44.5 31 40 31.5 Q37.5 31.8 36 30 L36 37 Q36 39 34 39 L13 39 Q11 39 11 37 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M31 15.5 L34 15 Q36 15 36 17 L36 23.5 Q37.5 23 38.5 23.5 L38 30 L36 30 L36 37 Q36 39 34 39 L28.5 39 Q33 37.5 32.8 30 Q32.7 22 31 15.5 Z" fill="${shade(c, -14)}" opacity=".7"/>` +
    `<circle cx="17.5" cy="22" r="1.6" fill="#ffffff" opacity=".65"/>` +
    `<circle cx="22.5" cy="28.5" r="1.3" fill="#ffffff" opacity=".45"/>` +
    hi(16, 18, 2.6, 1.6)
  );
});

reg("🗝️", "老钥匙", () => {
  // FLIPPABLE ▲：齿花全偏右侧，剪影左右非对称
  const c = P.gold;
  const out = o(c);
  return (
    gs(24, 42.5, 10) +
    `<circle cx="20" cy="13.5" r="7.4" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="20" cy="13.5" r="3.2" fill="#fdf6ee" stroke="${out}" stroke-width="1.6"/>` +
    `<path d="M20 20.9 L20 40" stroke="${out}" stroke-width="5.6" stroke-linecap="round"/>` +
    `<path d="M20 20.9 L20 40" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M21.5 32 L28 32 Q29.5 32 29.5 33.5 Q29.5 35 28 35 L21.5 35 Z M21.5 37 L26 37 Q27.5 37 27.5 38.5 Q27.5 40 26 40 L21.5 40 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="1.7" stroke-linejoin="round"/>` +
    `<path d="M24.5 8 Q27 9.5 27.2 12" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`
  );
});

reg("📜", "卷轴", () => {
  // FLIPPABLE ▲：上下卷筒的卷芯都露在右端，剪影左右非对称
  const paper = "#f6e8c8";
  const out = o("#d8bc8a");
  return (
    gs(24, 42.5, 13) +
    `<path d="M13.5 13.5 L34.5 13.5 L34.5 34.5 L13.5 34.5 Z" fill="${paper}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M30.5 13.5 L34.5 13.5 L34.5 34.5 L30.5 34.5 Q32 24 30.5 13.5 Z" fill="${shade(paper, -10)}" opacity=".75"/>` +
    `<path d="M17.5 19.5 L30 19.5 M17.5 24 L30 24 M17.5 28.5 L26 28.5" stroke="${shade(paper, -34)}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>` +
    // 上卷筒：卷芯螺旋露在右端
    `<rect x="10" y="8" width="26" height="6.5" rx="3.25" fill="${paper}" stroke="${out}" stroke-width="1.8"/>` +
    `<circle cx="37.5" cy="11.2" r="3.6" fill="${shade(paper, -8)}" stroke="${out}" stroke-width="1.7"/>` +
    `<circle cx="37.5" cy="11.2" r="1.3" fill="${shade(paper, -26)}"/>` +
    // 下卷筒：同侧卷芯
    `<rect x="10" y="33.5" width="26" height="6.5" rx="3.25" fill="${paper}" stroke="${out}" stroke-width="1.8"/>` +
    `<circle cx="37.5" cy="36.7" r="3.6" fill="${shade(paper, -8)}" stroke="${out}" stroke-width="1.7"/>` +
    `<circle cx="37.5" cy="36.7" r="1.3" fill="${shade(paper, -26)}"/>` +
    hi(15.5, 10.5, 2.2, 1.2)
  );
});

reg("🕯️", "小蜡烛", () => {
  const wax = "#fff3df";
  const out = o("#e8cf9e");
  return (
    gs(24, 43, 12) +
    // 烛台碟与提环
    `<ellipse cx="24" cy="40" rx="12.5" ry="3" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.8"/>` +
    `<circle cx="37" cy="37.5" r="2.8" fill="none" stroke="${o(P.gold)}" stroke-width="2"/>` +
    // 烛身与蜡泪
    `<path d="M18.5 17 L29.5 17 L29.5 39 L18.5 39 Z" fill="${wax}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M26.5 17 L29.5 17 L29.5 39 L26.5 39 Q27.5 28 26.5 17 Z" fill="${shade(wax, -10)}" opacity=".8"/>` +
    `<path d="M18.5 17 L29.5 17 L29.5 20 Q27.5 23.5 26 20.5 Q24.5 17.5 23 21 Q21.5 24.5 19.8 21 L18.5 20 Z" fill="#fffdf8" stroke="${out}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M18.5 20.5 Q17 22.5 17.5 25 Q19 24.5 19 21.5 Z" fill="#fffdf8" stroke="${out}" stroke-width="1.2" stroke-linejoin="round"/>` +
    // 烛芯与火苗
    `<path d="M24 14 L24 16.5" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M24 5.5 Q27.8 9.5 26.5 12.5 A3.4 3.4 0 0 1 20.5 11 Q20.8 8 24 5.5 Z" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<ellipse cx="23.8" cy="11" rx="1.4" ry="2" fill="${P.gold}"/>` +
    hi(20.5, 24, 1.8, 1.2)
  );
});

reg("🎩", "礼帽", () => {
  const c = "#5f6678";
  const out = o(c);
  return (
    gs(24, 42, 15) +
    `<path d="M13.5 12 Q24 8.5 34.5 12 L34 32 L14 32 Z" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M31 11.2 L34.5 12 L34 32 L30.5 32 Q31.5 21 31 11.2 Z" fill="${shade(c, -16)}" opacity=".8"/>` +
    `<rect x="13.6" y="26" width="20.8" height="6" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.6"/>` +
    `<path d="M8 32 Q24 29.5 40 32 Q41.5 32.5 41 34.5 Q40 37 36 36.5 Q24 34.5 12 36.5 Q8 37 7 34.5 Q6.5 32.5 8 32 Z" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    hi(18, 14.5, 3, 1.8)
  );
});

reg("🧭", "指南针", () => {
  const rim = P.gold;
  const face = "#fdf6ee";
  return (
    gs(24, 43, 13) +
    `<circle cx="24" cy="14.5" r="2.6" fill="none" stroke="${o(rim)}" stroke-width="2"/>` +
    `<circle cx="24" cy="27" r="14" fill="${rim}" stroke="${o(rim)}" stroke-width="2"/>` +
    `<path d="M24 41 a14 14 0 0 0 12.8 -19.5 a16.5 16.5 0 0 1 -12.8 19.5" fill="${shade(rim, -14)}" opacity=".75"/>` +
    `<circle cx="24" cy="27" r="10.4" fill="${face}" stroke="${o(rim)}" stroke-width="1.6"/>` +
    `<path d="M24 17.8 L24 20.6 M24 33.4 L24 36.2 M14.8 27 L17.6 27 M30.4 27 L33.2 27" stroke="${o(rim)}" stroke-width="1.5" stroke-linecap="round"/>` +
    // 指针（红端指东北）
    `<polygon points="30.5,20.5 25.8,28.8 22.2,25.2" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<polygon points="17.5,33.5 22.2,25.2 25.8,28.8" fill="#c8d4e0" stroke="${o("#c8d4e0")}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="27" r="1.9" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    hi(18, 21, 2.4, 1.5)
  );
});

reg("📒", "黄笔记本", () => {
  // FLIPPABLE ▲；双胞胎 📒↔📕 的区分位：金黄封面 + 左侧线圈 + 右上角书签标签
  const cover = P.gold;
  const out = o(cover);
  return (
    gs(24, 42.5, 12) +
    // 右上角书签标签（区分位）
    `<path d="M29 6.5 L35 6.5 L35 14 L32 11.8 L29 14 Z" fill="${P.rose}" stroke="${o(P.rose)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<rect x="13" y="9.5" width="22" height="30" rx="2.5" fill="${cover}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M31 9.5 L35 9.5 L35 37 Q35 39.5 32.5 39.5 L29 39.5 Q32 38.5 31.8 34 Z" fill="${shade(cover, -13)}" opacity=".75"/>` +
    // 左侧线圈（区分位）
    `<path d="M13.5 14 L9.5 14 M13.5 20 L9.5 20 M13.5 26 L9.5 26 M13.5 32 L9.5 32 M13.5 38 L9.5 38" stroke="${o("#8fa2b8")}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<rect x="17.5" y="17" width="13" height="10" rx="1.6" fill="#fdf6ee" stroke="${out}" stroke-width="1.4"/>` +
    `<path d="M19.5 20.5 L28.5 20.5 M19.5 23.5 L25.5 23.5" stroke="#c8b88a" stroke-width="1.3" stroke-linecap="round"/>` +
    hi(17, 12.5, 2.4, 1.4)
  );
});

reg("📕", "红课本", () => {
  // FLIPPABLE ▲；双胞胎 📕↔📒 的区分位：正红封面 + 右侧白书页口 + 底部丝带书签
  const cover = P.red;
  const out = o(cover);
  return (
    gs(24, 43, 12) +
    // 右侧书页口（区分位）
    `<path d="M31 11.5 L37.5 11.5 Q39.5 11.5 39.5 13.5 L39.5 35.5 Q39.5 37.5 37.5 37.5 L31 37.5 Z" fill="#fdf6ee" stroke="${o("#d8ccb0")}" stroke-width="1.8"/>` +
    `<path d="M35.4 14 L35.4 35 M37.6 14.5 L37.6 34.5" stroke="#d8ccb0" stroke-width="1" opacity=".8"/>` +
    // 封面（书脊在左）
    `<path d="M11 9.5 L30 9.5 Q33 9.5 33 12.5 L33 36.5 Q33 39.5 30 39.5 L11 39.5 Q8.5 39.5 8.5 37 L8.5 12 Q8.5 9.5 11 9.5 Z" fill="${cover}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M13 9.5 L13 39.5" stroke="${shade(cover, -20)}" stroke-width="2"/>` +
    `<path d="M29 9.5 L30 9.5 Q33 9.5 33 12.5 L33 36.5 Q33 39.5 30 39.5 L26.5 39.5 Q29.5 38.5 29.4 34 Z" fill="${shade(cover, -14)}" opacity=".75"/>` +
    `<circle cx="21.5" cy="19" r="4.2" fill="none" stroke="${P.gold}" stroke-width="1.8"/>` +
    // 底部丝带书签（区分位）
    `<path d="M24.5 39.5 L24.5 46 L27.5 43.6 L30.5 46 L30.5 39.5 Z" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.4" stroke-linejoin="round"/>` +
    hi(15.5, 13.5, 2.2, 1.4)
  );
});

// ---- 找不同图鉴 · 第 8 章 旋转灯塔（W8R1-04 余量 · FLIPPABLE ▲五张非对称剪影） ----

reg("🌀", "小旋涡", () => {
  // FLIPPABLE ▲；双胞胎 🌀↔🌪️ 的区分位：圆盘螺旋 + 尾巴甩向右侧（🌪️ 是上宽下尖漏斗）
  const c = P.blue;
  const out = o(c);
  const spiral =
    "M24 24 a3 3 0 0 1 3 3 a5.6 5.6 0 0 1 -11.2 0 a8.4 8.4 0 0 1 8.4 -8.4 a11.6 11.6 0 0 1 11.6 11.6 a14 14 0 0 1 -8 12.6";
  return (
    gs(24, 43.5, 12) +
    `<path d="${spiral}" fill="none" stroke="${out}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="${spiral}" fill="none" stroke="${c}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M37 15 Q40.5 17.5 41.5 21" fill="none" stroke="${shade(c, 18)}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>` +
    `<circle cx="15" cy="14.5" r="1.6" fill="${shade(c, 18)}" opacity=".85"/>` +
    hi(17.5, 16, 2.2, 1.4)
  );
});

reg("🚦", "红绿灯", () => {
  const box = "#5f6678";
  const out = o(box);
  return (
    gs(24, 43.5, 10) +
    `<path d="M24 40 L24 44" stroke="${out}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<rect x="15.5" y="6.5" width="17" height="34" rx="4.5" fill="${box}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M28.5 6.5 L30 6.5 Q32.5 6.5 32.5 9.5 L32.5 37.5 Q32.5 40.5 30 40.5 L27 40.5 Q29.8 39.5 29.7 35 Z" fill="${shade(box, -16)}" opacity=".8"/>` +
    `<path d="M15.5 11 Q11 12 10.5 15.5 L15.5 15.5 Z M15.5 20.5 Q11 21.5 10.5 25 L15.5 25 Z M15.5 30 Q11 31 10.5 34.5 L15.5 34.5 Z" fill="${shade(box, -8)}" stroke="${out}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="13.5" r="4" fill="${P.red}" stroke="${o(P.red)}" stroke-width="1.6"/>` +
    `<circle cx="24" cy="23.5" r="4" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.6"/>` +
    `<circle cx="24" cy="33.5" r="4" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.6"/>` +
    `<circle cx="22.6" cy="12.2" r="1.2" fill="#ffffff" opacity=".65"/>` +
    `<circle cx="22.6" cy="22.2" r="1.2" fill="#ffffff" opacity=".65"/>` +
    `<circle cx="22.6" cy="32.2" r="1.2" fill="#ffffff" opacity=".65"/>` +
    hi(19, 9, 1.8, 1.1)
  );
});

reg("🛟", "救生圈", () => {
  const ring = "#fdf6ee";
  const out = o("#d8ccb0");
  const stripe = P.red;
  const seg = (a0: number): string => {
    const r = 11;
    const x1 = 24 + Math.cos(a0) * r;
    const y1 = 24 + Math.sin(a0) * r;
    const x2 = 24 + Math.cos(a0 + Math.PI / 5) * r;
    const y2 = 24 + Math.sin(a0 + Math.PI / 5) * r;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${stripe}" stroke-width="7.6"/>`;
  };
  return (
    gs(24, 42.5, 13) +
    `<circle cx="24" cy="24" r="16.4" fill="none" stroke="${o(P.gold)}" stroke-width="1.6" stroke-dasharray="3.4 2.6"/>` +
    `<path fill-rule="evenodd" d="M24 9.5 A14.5 14.5 0 1 0 24.01 9.5 Z M24 17.5 A6.5 6.5 0 1 1 23.99 17.5 Z" fill="${ring}" stroke="${out}" stroke-width="2"/>` +
    seg(-Math.PI / 2 - Math.PI / 10) + seg(0 - Math.PI / 10) + seg(Math.PI / 2 - Math.PI / 10) + seg(Math.PI - Math.PI / 10) +
    `<circle cx="24" cy="24" r="14.5" fill="none" stroke="${out}" stroke-width="2"/>` +
    `<circle cx="24" cy="24" r="6.5" fill="none" stroke="${out}" stroke-width="2"/>` +
    hi(16.5, 15, 2.6, 1.6)
  );
});

reg("⚓", "船锚", () => {
  const c = P.blueDeep;
  const out = o(c);
  return (
    gs(24, 43, 13) +
    `<circle cx="24" cy="9.5" r="3.4" fill="none" stroke="${out}" stroke-width="5"/>` +
    `<circle cx="24" cy="9.5" r="3.4" fill="none" stroke="${c}" stroke-width="2.6"/>` +
    `<path d="M24 13 L24 36" stroke="${out}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M24 13 L24 36" stroke="${c}" stroke-width="3.8" stroke-linecap="round"/>` +
    `<path d="M15 20.5 L33 20.5" stroke="${out}" stroke-width="5.4" stroke-linecap="round"/>` +
    `<path d="M15 20.5 L33 20.5" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M10 27.5 Q11.5 39.5 24 40.5 Q36.5 39.5 38 27.5 L42 30.5 Q41 42.5 24 44 Q7 42.5 6 30.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M38 27.5 L42 30.5 Q41.5 36.5 36 40.5 Q39.5 35.5 38.6 29.5 Z" fill="${shade(c, -15)}" opacity=".8"/>` +
    `<path d="M6 30.5 L11.5 28.5 M42 30.5 L36.5 28.5" stroke="${out}" stroke-width="2" stroke-linecap="round"/>` +
    hi(20.5, 7.5, 1.8, 1.1)
  );
});

reg("🪁", "小风筝", () => {
  // FLIPPABLE ▲：菱形斜置 + 尾穗甩向左下，剪影左右非对称
  const c = P.rose;
  const out = o(c);
  const bow = (x: number, y: number, rot: number): string =>
    `<path d="M${x - 3} ${y - 1.8} L${x + 3} ${y + 1.8} M${x - 3} ${y + 1.8} L${x + 3} ${y - 1.8}"` +
    ` stroke="${P.gold}" stroke-width="2.2" stroke-linecap="round" transform="rotate(${rot} ${x} ${y})"/>`;
  return (
    // 斜置菱形（右上高、左下低）
    `<polygon points="25,4.5 38.5,17 26,30 9.5,15.5" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="25,4.5 38.5,17 26,30 24.8,16" fill="${shade(c, -13)}" opacity=".7"/>` +
    `<path d="M25 4.5 L26 30 M9.5 15.5 L38.5 17" fill="none" stroke="${out}" stroke-width="1.6" opacity=".75"/>` +
    `<circle cx="25.4" cy="16.4" r="2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    // 尾线与蝴蝶结（甩向左下）
    `<path d="M26 30 Q22 36.5 15.5 39 Q10 41 7 44" fill="none" stroke="${out}" stroke-width="1.7" stroke-linecap="round"/>` +
    bow(20.5, 35, -18) + bow(12, 40.5, -32) +
    hi(18, 11, 2.6, 1.6)
  );
});

reg("🎐", "风铃", () => {
  // FLIPPABLE ▲：纸签被风吹向右侧，剪影左右非对称
  const dome = "#bfe3f4";
  const out = o("#8fb8d8");
  return (
    `<path d="M21 4 L21 8.5" stroke="${o(P.wood)}" stroke-width="2" stroke-linecap="round"/>` +
    // 玻璃铃身
    `<path d="M12.5 17 Q12.5 8.5 21 8.5 Q29.5 8.5 29.5 17 Q29.5 22.5 21 22.5 Q12.5 22.5 12.5 17 Z"` +
    ` fill="${dome}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M21 22.5 Q29.5 22.5 29.5 17 Q29.5 11.5 25 9.5 Q27.5 13 26.5 17.5 Q25.5 21.5 19 22.3 Q20 22.5 21 22.5 Z" fill="${shade(dome, -12)}" opacity=".7"/>` +
    `<path d="M15.5 11.5 Q17.5 9.5 20 9.5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".85"/>` +
    // 铃舌与纸签（吹向右）
    `<path d="M21 22.5 L22.5 27.5" stroke="${out}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<circle cx="23" cy="29" r="2.2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.3"/>` +
    `<path d="M23.5 30.5 Q31 33.5 33.5 41 Q33.9 43 31.9 43.5 Q26 44.5 24.5 38.5 Q23.5 34.5 23 30.9 Z"` +
    ` fill="#fdf6ee" stroke="${o("#d8ccb0")}" stroke-width="1.7" stroke-linejoin="round"/>` +
    `<path d="M27 35 Q29 37.5 29.5 40.5" fill="none" stroke="${P.rose}" stroke-width="1.5" stroke-linecap="round" opacity=".8"/>` +
    // 风的示意线（左侧）
    `<path d="M7 26 Q11 25 14 26.5 M5.5 31 Q9.5 30 12.5 31.5" fill="none" stroke="#a8ccd8" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>` +
    hi(16.5, 12, 2, 1.3)
  );
});

reg("🌪️", "龙卷风", () => {
  // FLIPPABLE ▲；双胞胎 🌪️↔🌀 的区分位：上宽下尖漏斗 + 尾尖甩向右（🌀 是圆盘螺旋）
  const c = "#9fb8d8";
  const out = o(c);
  return (
    gs(27, 44, 8) +
    `<path d="M7.5 8.5 Q24 3.5 40.5 8.5 Q43 9.5 40.5 11 Q33 14.5 15 13.5 Q19 16.5 32 16.5 Q35 17 32.5 19 Q26 23 17.5 21.5 Q21 24.5 28.5 24.5 Q31.5 25 29.5 27.5 Q25.5 31 20.5 30 Q23 33 27 33 Q29.5 33.5 27.5 36 Q25 39 26.5 42.5"` +
    ` fill="none" stroke="${out}" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M7.5 8.5 Q24 3.5 40.5 8.5 Q43 9.5 40.5 11 Q33 14.5 15 13.5 Q19 16.5 32 16.5 Q35 17 32.5 19 Q26 23 17.5 21.5 Q21 24.5 28.5 24.5 Q31.5 25 29.5 27.5 Q25.5 31 20.5 30 Q23 33 27 33 Q29.5 33.5 27.5 36 Q25 39 26.5 42.5"` +
    ` fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="40" cy="20" r="1.5" fill="${shade(c, 14)}" opacity=".85"/>` +
    `<circle cx="11" cy="26" r="1.3" fill="${shade(c, 14)}" opacity=".7"/>` +
    hi(15, 7.5, 2.4, 1.4)
  );
});

reg("🛶", "小木舟", () => {
  // FLIPPABLE ▲：右端船头高翘 + 船桨斜靠右舷，剪影左右非对称
  const hull = P.wood;
  const out = o(hull);
  return (
    gs(24, 43, 15) +
    // 船桨（斜靠右）
    `<path d="M31 8 L36.5 28" stroke="${o("#c9a06a")}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<ellipse cx="30" cy="6.5" rx="3" ry="4.4" fill="#c9a06a" stroke="${o("#c9a06a")}" stroke-width="1.6" transform="rotate(16 30 6.5)"/>` +
    // 船体：右头高翘
    `<path d="M5.5 25 Q13 29.5 24 29.5 Q35 29.5 41 24 Q43.5 21.5 43 26 Q42 34 34 37.5 Q28.5 39.5 19 39.5 Q9 39 6.5 31.5 Q5 27.5 5.5 25 Z"` +
    ` fill="${hull}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M34 37.5 Q42 34 43 26 Q43.2 23.5 42 24 Q41 31.5 32.5 35.5 Q26 38.3 17 37.8 Q23 39.8 28.5 39 Q31.5 38.5 34 37.5 Z" fill="${shade(hull, -15)}" opacity=".8"/>` +
    `<path d="M10 31.5 Q24 34.5 38 30 M12.5 35 Q24 37.2 35 33.5" fill="none" stroke="${shade(hull, -22)}" stroke-width="1.3" opacity=".65"/>` +
    // 水波
    `<path d="M8 42.5 Q12 40.8 16 42.5 M28 43 Q32 41.3 36 43" fill="none" stroke="${P.blue}" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>` +
    hi(13, 27.5, 2.6, 1.4)
  );
});

reg("🧿", "蓝玻璃珠", () => {
  // 通用蓝白同心圆装饰珠（不做任何符号细节）
  const c = P.blueDeep;
  const out = o(c);
  return (
    gs(24, 42.5, 12) +
    `<circle cx="24" cy="24" r="14.5" fill="${c}" stroke="${out}" stroke-width="2"/>` +
    `<path d="M24 38.5 a14.5 14.5 0 0 0 13.3 -20.2 a17 17 0 0 1 -13.3 20.2" fill="${shade(c, -16)}" opacity=".8"/>` +
    `<circle cx="24" cy="24" r="9" fill="#fdf6ee" stroke="${o("#d8ccb0")}" stroke-width="1.4"/>` +
    `<circle cx="24" cy="24" r="5.2" fill="${P.blue}" stroke="${o(P.blue)}" stroke-width="1.4"/>` +
    `<ellipse cx="17.5" cy="16.5" rx="4" ry="2.5" fill="#ffffff" opacity=".55" transform="rotate(-26 17.5 16.5)"/>`
  );
});

// ---- 找不同图鉴 · 第 9 章 镜像水面（W8R1-04 余量 · 🌊 走 ▲ 非对称浪头） ----

reg("🪞", "小镜子", () => {
  const frame = P.gold;
  const glass = "#dff3fa";
  return (
    gs(24, 43, 12) +
    // 手柄（偏右下）
    `<path d="M29 30.5 L34.5 41.5" stroke="${o(frame)}" stroke-width="6.4" stroke-linecap="round"/>` +
    `<path d="M29 30.5 L34.5 41.5" stroke="${frame}" stroke-width="4" stroke-linecap="round"/>` +
    // 椭圆镜面
    `<ellipse cx="22.5" cy="19.5" rx="11.5" ry="13.5" fill="${glass}" stroke="${o(frame)}" stroke-width="5.6"/>` +
    `<ellipse cx="22.5" cy="19.5" rx="11.5" ry="13.5" fill="none" stroke="${frame}" stroke-width="3.4"/>` +
    `<circle cx="22.5" cy="4.6" r="1.7" fill="${frame}" stroke="${o(frame)}" stroke-width="1.2"/>` +
    `<path d="M16.5 14 Q19 10.5 23 10" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>` +
    `<path d="M27.5 26.5 Q24 28.5 20 27.8" fill="none" stroke="#a8ccd8" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`
  );
});

reg("🫧", "泡泡串", () => {
  // 双胞胎 🫧↔💧 的区分位：大小三连泡（💧 是单颗水滴）
  const c = "#bfe3f4";
  const out = o("#8fb8d8");
  const bubble = (x: number, y: number, r: number): string =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity=".55" stroke="${out}" stroke-width="1.8"/>` +
    `<path d="M${x - r * 0.62} ${y - r * 0.28} Q${x - r * 0.32} ${y - r * 0.72} ${x + r * 0.1} ${y - r * 0.72}" fill="none" stroke="#ffffff" stroke-width="${Math.max(1.4, r * 0.2)}" stroke-linecap="round" opacity=".9"/>`;
  return (
    bubble(18, 27, 11.5) + bubble(35, 14.5, 7) + bubble(35.5, 33.5, 4.6) +
    `<circle cx="27.5" cy="42" r="1.6" fill="${c}" stroke="${out}" stroke-width="1.2"/>`
  );
});

reg("🌊", "浪花", () => {
  // FLIPPABLE ▲：浪头向左卷、浪尾向右摊，剪影左右非对称
  const c = P.blue;
  const out = o(c);
  return (
    gs(24, 43, 15) +
    `<path d="M42.5 39.5 L5.5 39.5 Q4.5 30 9.5 22.5 Q15 14.5 25 13 Q34 11.5 39 16.5 Q42.5 20.5 40 25 Q37.5 29 33 28 Q29 27 28.5 23 Q28.2 20 30.5 18.5 Q26 18.5 22.5 22 Q18.5 26 20 32 Q21 36.5 25.5 38 Q34 40.5 42.5 36.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M42.5 39.5 L42.5 36.5 Q34 40.5 25.5 38 Q30 40 36 39.7 Z M39 16.5 Q42.5 20.5 40 25 Q38.5 27.5 36 28 Q39 24 37.5 20 Q36.5 17.5 34 16 Q37 15.5 39 16.5 Z" fill="${shade(c, -14)}" opacity=".8"/>` +
    // 浪尖泡沫
    `<circle cx="30" cy="14" r="2.2" fill="#eaf5fd" stroke="${out}" stroke-width="1.3"/>` +
    `<circle cx="36.5" cy="13.5" r="1.7" fill="#eaf5fd" stroke="${out}" stroke-width="1.2"/>` +
    `<circle cx="9" cy="20" r="1.6" fill="#eaf5fd" stroke="${out}" stroke-width="1.2"/>` +
    `<path d="M11 30 Q14.5 27 18 29.5 M24 34.5 Q28 32.5 32 34" fill="none" stroke="#eaf5fd" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>` +
    hi(14, 18.5, 2.6, 1.6)
  );
});

reg("🪷", "莲花", () => {
  // 双胞胎 🪷↔🪸 的区分位：整朵花 + 荷叶座（🪸 是分叉珊瑚枝）
  const c = P.rose;
  const out = o(c);
  return (
    gs(24, 43, 14) +
    // 荷叶座
    `<path d="M7 38 Q24 33 41 38 Q33 42.5 24 42.5 Q15 42.5 7 38 Z" fill="${P.green}" stroke="${o(P.green)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    // 侧瓣两对
    `<path d="M8.5 20 Q17 21.5 19.5 30 Q20.5 34.5 16.5 35.5 Q11 36.5 9.5 30 Q8.5 25.5 8.5 20 Z" fill="${shade(c, 12)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M39.5 20 Q31 21.5 28.5 30 Q27.5 34.5 31.5 35.5 Q37 36.5 38.5 30 Q39.5 25.5 39.5 20 Z" fill="${shade(c, 12)}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M14 13.5 Q21 17 21.5 27 Q21.5 32 17.5 31 Q13 29.5 12.5 22.5 Q12.2 17.5 14 13.5 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M34 13.5 Q27 17 26.5 27 Q26.5 32 30.5 31 Q35 29.5 35.5 22.5 Q35.8 17.5 34 13.5 Z" fill="${c}" stroke="${out}" stroke-width="1.8" stroke-linejoin="round"/>` +
    // 中瓣
    `<path d="M24 8.5 Q29.5 15 29 25.5 Q28.5 33.5 24 33.5 Q19.5 33.5 19 25.5 Q18.5 15 24 8.5 Z" fill="${shade(c, 18)}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 33.5 Q28.5 33.5 29 25.5 Q29.3 19.5 26.5 13 Q27.5 21 25.5 28.5 Q24.8 31.5 22.5 33.2 Q23.2 33.5 24 33.5 Z" fill="${shade(c, -8)}" opacity=".65"/>` +
    `<ellipse cx="24" cy="34" rx="4.6" ry="2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    hi(21, 14.5, 2, 1.3)
  );
});

reg("🪸", "珊瑚枝", () => {
  // 双胞胎 🪸↔🪷 的区分位：分叉的枝（🪷 是整朵花）
  const c = "#f4977c";
  const out = o(c);
  const arm = (d: string, w: number): string =>
    `<path d="${d}" fill="none" stroke="${out}" stroke-width="${w + 3.2}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  return (
    gs(24, 43.5, 14) +
    // 沙丘底座
    `<path d="M9 43.5 Q24 38.5 39 43.5 Z" fill="#f2d9a8" stroke="${o("#f2d9a8")}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // 主干与分枝
    arm("M24 41 Q23.5 30 24 22 Q24.3 15 27 10.5", 5.2) +
    arm("M24 30 Q17.5 27.5 14.5 21 Q13 17.5 13.5 13.5", 4.2) +
    arm("M24 33 Q31 31.5 34.5 25.5 Q36.5 22 36 18.5", 4.2) +
    arm("M15.5 24 Q11.5 23 9.5 19.5", 3.2) +
    arm("M33 27 Q37.5 27 40.5 24.5", 3.2) +
    // 枝头圆芽
    `<circle cx="27.5" cy="9.5" r="2.6" fill="${shade(c, 16)}" stroke="${out}" stroke-width="1.4"/>` +
    `<circle cx="13.5" cy="12.5" r="2.3" fill="${shade(c, 16)}" stroke="${out}" stroke-width="1.4"/>` +
    `<circle cx="36.5" cy="17.5" r="2.3" fill="${shade(c, 16)}" stroke="${out}" stroke-width="1.4"/>` +
    `<circle cx="9" cy="18.5" r="1.9" fill="${shade(c, 16)}" stroke="${out}" stroke-width="1.3"/>` +
    `<circle cx="41.5" cy="23.5" r="1.9" fill="${shade(c, 16)}" stroke="${out}" stroke-width="1.3"/>` +
    // 小气泡
    `<circle cx="40" cy="9" r="1.6" fill="none" stroke="#a8ccd8" stroke-width="1.3" opacity=".85"/>` +
    `<circle cx="42.5" cy="4.5" r="1.1" fill="none" stroke="#a8ccd8" stroke-width="1.1" opacity=".7"/>` +
    hi(20.5, 17, 1.8, 1.1)
  );
});

// ---- 找不同图鉴 · 第 10 章 连环挑战场（W8R1-04 余量收官 · FLIPPABLE ▲四张非对称） ----

reg("⏱️", "小秒表", () => {
  // FLIPPABLE ▲；双胞胎 ⏱️↔⌛ 的区分位：表冠按钮偏右上（⌛ 是细沙腰木框）
  const rim = P.blueDeep;
  const face = "#fdf6ee";
  return (
    gs(24, 43, 12) +
    `<g transform="rotate(26 24 27)">` +
    // 表冠（旋转后偏向右上）
    `<rect x="21.6" y="8" width="4.8" height="5" rx="1.4" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.5"/>` +
    `<rect x="22.8" y="12.5" width="2.4" height="3" fill="${o(rim)}"/>` +
    `<circle cx="24" cy="27" r="12.8" fill="${rim}" stroke="${o(rim)}" stroke-width="2"/>` +
    `</g>` +
    `<path d="M28 39.2 a12.8 12.8 0 0 0 7.5 -19.5 a15 15 0 0 1 -7.5 19.5" fill="${shade(rim, -15)}" opacity=".8" transform="rotate(26 24 27)"/>` +
    `<circle cx="24" cy="27" r="9.4" fill="${face}" stroke="${o(rim)}" stroke-width="1.5"/>` +
    `<path d="M24 19.4 L24 21.6 M24 32.4 L24 34.6 M16.4 27 L18.6 27 M29.4 27 L31.6 27" stroke="${o(rim)}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M24 27 L28.6 21.8" stroke="${P.red}" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="24" cy="27" r="1.7" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.1"/>` +
    hi(18.5, 20.5, 2.2, 1.4)
  );
});

reg("🏅", "小奖牌", () => {
  // FLIPPABLE ▲：绶带整体甩向左上，奖章坠在右下，剪影左右非对称
  const ribbon = P.red;
  const medal = P.gold;
  return (
    gs(27, 43.5, 11) +
    `<polygon points="12,4.5 20.5,4.5 24.5,21 13.5,23.5 10,14 13.5,13" fill="${ribbon}" stroke="${o(ribbon)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<polygon points="20.5,4.5 28.5,4.5 30.5,17.5 24.5,21" fill="${shade(ribbon, -16)}" stroke="${o(ribbon)}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cx="27.5" cy="30" r="11" fill="${medal}" stroke="${o(medal)}" stroke-width="2"/>` +
    `<path d="M27.5 41 a11 11 0 0 0 10.1 -15.3 a13 13 0 0 1 -10.1 15.3" fill="${shade(medal, -14)}" opacity=".8"/>` +
    `<circle cx="27.5" cy="30" r="7.6" fill="none" stroke="${shade(medal, -22)}" stroke-width="1.4"/>` +
    `<polygon points="${starPts(27.5, 30, 5.2)}" fill="#fff6d8" stroke="${o(medal)}" stroke-width="1.3" stroke-linejoin="round"/>` +
    hi(22.5, 23.5, 2.2, 1.4)
  );
});

reg("🎯", "小箭靶", () => {
  const red = P.red;
  return (
    gs(23, 43, 14) +
    `<circle cx="23" cy="26" r="14.5" fill="${red}" stroke="${o(red)}" stroke-width="2"/>` +
    `<path d="M23 40.5 a14.5 14.5 0 0 0 13.3 -20.2 a17 17 0 0 1 -13.3 20.2" fill="${shade(red, -14)}" opacity=".75"/>` +
    `<circle cx="23" cy="26" r="10" fill="#fdf6ee" stroke="${o("#d8ccb0")}" stroke-width="1.6"/>` +
    `<circle cx="23" cy="26" r="5.8" fill="${red}" stroke="${o(red)}" stroke-width="1.5"/>` +
    `<circle cx="23" cy="26" r="2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.2"/>` +
    // 飞镖（从右上方射中靶心旁）
    `<path d="M27 21.5 L38 9" stroke="${o(P.wood)}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<polygon points="25.6,23.2 29.5,21.5 27.5,19.4" fill="#8fa2b8" stroke="${o("#8fa2b8")}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<polygon points="36,6.5 41.5,5 40,10.5 36.5,11.5" fill="${P.teal}" stroke="${o(P.teal)}" stroke-width="1.4" stroke-linejoin="round"/>` +
    hi(16.5, 18, 2.4, 1.5)
  );
});

reg("🎲", "小骰子", () => {
  const top = "#fdf6ee";
  const out = o("#c8bfae");
  const pip = (x: number, y: number, rx = 2, ry = 1.6, rot = 0): string =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}" transform="rotate(${rot} ${x} ${y})"/>`;
  return (
    gs(24, 43.5, 13) +
    // 2.5D 三面体
    `<polygon points="24,6.5 37.5,13 24,19.5 10.5,13" fill="${top}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="10.5,13 24,19.5 24,38.5 10.5,32" fill="${shade(top, -10)}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="37.5,13 24,19.5 24,38.5 37.5,32" fill="${shade(top, -20)}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    // 顶面 1 点 / 左面 2 点 / 右面 3 点
    pip(24, 13, 2.6, 1.7) +
    pip(16, 22.5, 1.9, 1.5, -8) + pip(18.5, 28.5, 1.9, 1.5, -8) +
    pip(28.5, 23.5, 1.9, 1.5, 8) + pip(30.5, 27.5, 1.9, 1.5, 8) + pip(32.5, 31.5, 1.9, 1.5, 8) +
    hi(18, 10.5, 2.4, 1.3)
  );
});

reg("🚀", "小火箭", () => {
  // FLIPPABLE ▲：斜飞 + 尾焰甩向一侧，剪影左右非对称；圆头圆窗通用简笔（去色剪影自查）
  const body = "#eef2fa";
  const trim = P.rose;
  return (
    `<g transform="rotate(38 24 24)">` +
    // 尾焰（偏向一侧）
    `<path d="M21 36 Q17.5 41.5 20.5 46 Q22 42.5 24 41 Q23.5 44 26 46.5 Q29.5 42 26.5 36 Z" fill="${P.orange}" stroke="${o(P.orange)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M22.5 36.5 Q21.5 40.5 23.8 43 Q25.5 40 24.8 36.5 Z" fill="${P.gold}"/>` +
    // 側鳍
    `<path d="M19.5 25 Q13.5 28 13 35.5 Q17 33.5 19.5 33 Z" fill="${trim}" stroke="${o(trim)}" stroke-width="1.7" stroke-linejoin="round"/>` +
    `<path d="M28.5 25 Q34.5 28 35 35.5 Q31 33.5 28.5 33 Z" fill="${trim}" stroke="${o(trim)}" stroke-width="1.7" stroke-linejoin="round"/>` +
    // 机身与鼻锥
    `<path d="M24 3.5 Q30.5 9.5 30.5 20 Q30.5 30 28 36 L20 36 Q17.5 30 17.5 20 Q17.5 9.5 24 3.5 Z" fill="${body}" stroke="${o("#b8c4d8")}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M28 36 Q30.5 30 30.5 20 Q30.5 12.5 27 7 Q28.5 14 28.2 21.5 Q27.8 30 25.5 36 Z" fill="${shade(body, -10)}" opacity=".8"/>` +
    `<path d="M24 3.5 Q27.5 6.5 29.3 11.5 Q26.8 9.5 21 9.8 Q22 6 24 3.5 Z" fill="${trim}" stroke="${o(trim)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // 圆舷窗
    `<circle cx="24" cy="17.5" r="4.2" fill="#bfe3f4" stroke="${o(P.blue)}" stroke-width="2"/>` +
    `<path d="M21.8 16 Q23 14.5 24.8 14.5" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>` +
    `</g>` +
    hi(14, 14, 2.2, 1.4)
  );
});

reg("💎", "亮宝石", () => {
  const c = P.teal;
  const out = o(c);
  return (
    gs(24, 42.5, 13) +
    `<polygon points="14,13 34,13 41,23 24,41 7,23" fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="14,13 19.5,23 7,23" fill="${shade(c, 16)}" opacity=".75"/>` +
    `<polygon points="34,13 41,23 28.5,23" fill="${shade(c, -12)}" opacity=".7"/>` +
    `<polygon points="19.5,23 24,41 7,23" fill="${shade(c, -8)}" opacity=".6"/>` +
    `<polygon points="28.5,23 41,23 24,41" fill="${shade(c, -20)}" opacity=".7"/>` +
    `<path d="M14 13 L19.5 23 L24 13 L28.5 23 L34 13 M7 23 L41 23" fill="none" stroke="${out}" stroke-width="1.4" opacity=".8"/>` +
    `<ellipse cx="17" cy="17.5" rx="3.2" ry="1.9" fill="#ffffff" opacity=".6" transform="rotate(-24 17 17.5)"/>`
  );
});

reg("🔔", "小铃铛", () => {
  const c = P.gold;
  const out = o(c);
  return (
    gs(24, 43, 13) +
    `<circle cx="24" cy="8.5" r="2.6" fill="${c}" stroke="${out}" stroke-width="1.7"/>` +
    `<path d="M13 26.5 Q13 11.5 24 11.5 Q35 11.5 35 26.5 Q35 30 37.5 31.5 Q38.5 32.5 37.5 33.5 L10.5 33.5 Q9.5 32.5 10.5 31.5 Q13 30 13 26.5 Z"` +
    ` fill="${c}" stroke="${out}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M30 12.8 Q35 17 35 26.5 Q35 30 37.5 31.5 Q38.5 32.5 37.5 33.5 L32 33.5 Q33.5 32 32.2 30.5 Q30.5 28.5 30.8 24 Q31.2 17 30 12.8 Z" fill="${shade(c, -14)}" opacity=".75"/>` +
    `<circle cx="24" cy="37" r="3.2" fill="${P.brown}" stroke="${o(P.brown)}" stroke-width="1.6"/>` +
    hi(18, 16, 2.6, 1.6)
  );
});

reg("🏁", "终点旗", () => {
  // FLIPPABLE ▲：旗杆在左、方格旗面全幅甩向右，剪影左右非对称
  const cream = "#fdf6ee";
  const dark = "#4a4458";
  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) {
        cells.push(`<rect x="${14 + c * 6.3}" y="${8.5 + r * 5.5}" width="6.3" height="5.5" fill="${dark}"/>`);
      }
    }
  }
  return (
    gs(20, 44, 11) +
    `<g transform="rotate(-5 14 8)">` +
    `<rect x="14" y="8.5" width="25.2" height="16.5" fill="${cream}" stroke="${o("#c8bfae")}" stroke-width="2"/>` +
    cells.join("") +
    `</g>` +
    `<path d="M12.5 6 L12.5 43" stroke="${o(P.wood)}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M12.5 6 L12.5 43" stroke="${P.wood}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="12.5" cy="5" r="2.2" fill="${P.gold}" stroke="${o(P.gold)}" stroke-width="1.4"/>` +
    hi(17.5, 12, 2, 1.3)
  );
});

reg("⌛", "沙漏", () => {
  // 双胞胎 ⌛↔⏱️ 的区分位：细沙腰 + 上下木框（⏱️ 是圆表盘 + 表冠）
  const glass = "#dff3fa";
  const gout = o("#8fb8d8");
  const sand = P.gold;
  return (
    gs(24, 43.5, 12) +
    `<path d="M15 10.5 L33 10.5 L33 14 Q33 20.5 26.8 24 Q33 27.5 33 34 L33 37.5 L15 37.5 L15 34 Q15 27.5 21.2 24 Q15 20.5 15 14 Z"` +
    ` fill="${glass}" stroke="${gout}" stroke-width="2" stroke-linejoin="round"/>` +
    // 上仓余沙 / 沙流 / 下仓沙堆
    `<path d="M18 13 L30 13 Q29.5 18 24 20.5 Q18.5 18 18 13 Z" fill="${sand}" stroke="${o(sand)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M24 24 L24 32" stroke="${sand}" stroke-width="1.8" stroke-dasharray="2.2 1.6" stroke-linecap="round"/>` +
    `<path d="M17 35.5 Q24 28.5 31 35.5 Q27.5 36.5 24 36.5 Q20.5 36.5 17 35.5 Z" fill="${sand}" stroke="${o(sand)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    // 上下木框（区分位）
    `<rect x="12" y="6" width="24" height="4.6" rx="2.2" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.8"/>` +
    `<rect x="12" y="37.4" width="24" height="4.6" rx="2.2" fill="${P.wood}" stroke="${o(P.wood)}" stroke-width="1.8"/>` +
    `<path d="M29 15 Q30.5 18.5 27.5 21.5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>` +
    hi(18, 8, 2, 1.2)
  );
});

// ---------------------------------------------------------------------------
// 出口
// ---------------------------------------------------------------------------

/** emoji 归一化：去掉 VS16 变体符（☂️ 与 ☂ 查到同一张贴纸） */
export function normalizeEmoji(emoji: string): string {
  return typeof emoji === "string" ? emoji.replace(/\uFE0F/g, "") : "";
}

/** 已收录的 emoji 列表（归一化后），给覆盖率用例点名 */
export const STICKER_EMOJIS: readonly string[] = Object.keys(REGISTRY);

/** 有没有这张贴纸 */
export function hasSticker(emoji: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, normalizeEmoji(emoji));
}

/** 贴纸的中文名（aria 文案用）；没有返回 null */
export function stickerName(emoji: string): string | null {
  return REGISTRY[normalizeEmoji(emoji)]?.name ?? null;
}

/**
 * 贴纸本体：`sticker("🐮", 30)` → 完整 `<svg>` 字符串；没收录返回 null。
 * 纯函数：同参数永远同输出；非法尺寸夹回 8px 起；不含 id / defs，
 * 同一页重复铺几十枚也不会撞 id。
 */
export function sticker(emoji: string, size = 32): string | null {
  const hit = REGISTRY[normalizeEmoji(emoji)];
  if (!hit) return null;
  const s = Math.max(8, Math.round(Number.isFinite(size) && size > 0 ? size : 32));
  return (
    // data-sticker 放中文名不放 emoji 字符：贴纸的使命就是让页面上一个裸 emoji 都不剩
    `<svg viewBox="0 0 48 48" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg"` +
    ` aria-hidden="true" data-sticker="${hit.name}" role="img">${hit.draw()}</svg>`
  );
}
