/**
 * 花园国际象棋 · 花园居民棋子与花园装饰（纯函数出 SVG 字符串，零依赖零状态）。
 *
 * 六种棋子都是原创的「花园居民」造型（公有领域的棋子制式只借剪影高矮，不描任何皮肤）：
 *  - 兵=小蘑菇（圆帽加帽点）、马=小木马头（三束鬃毛）、象=尖顶小树（三层树冠）、
 *  - 车=石塔（垛口三齿）、后=盛开花冠（五瓣大花加宝石芯）、王=戴十字小冠的大花（最高的一颗）。
 *
 * 白方象牙白填充 + 暖灰描边 + 左上高光；黑方深可可填充 + 更深描边 + 高光减弱。
 * 每颗都带统一的椭圆底座与投影，立体感来自这三层，不靠 3D。
 * viewBox 固定 32×36，图元 ≤ 18 个，内联进 64 个格子也不吃性能。
 */
import type { PieceType } from "./board";

/** 一方棋子的整套配色 */
export interface PieceTone {
  /** 主体填充 */
  body: string;
  /** 底座与暗部 */
  shade: string;
  /** 描边 */
  line: string;
  /** 左上高光（白方亮、黑方弱） */
  hi: string;
  /** 蘑菇帽 / 木马鬃毛 */
  cap: string;
  /** 蘑菇帽上的帽点 */
  dot: string;
  /** 小树树干 */
  trunk: string;
  /** 石塔门洞 */
  door: string;
  /** 后与王的花瓣 */
  petal: string;
  /** 宝石与小树果子 */
  gem: string;
  /** 金冠与花芯 */
  gold: string;
  /** 金件描边 */
  goldLine: string;
}

/** 白方（朵朵）：象牙白 + 暖灰描边 */
export const TONE_WHITE: PieceTone = {
  body: "#FBF2E2",
  shade: "#E5CFAF",
  line: "#8A6E50",
  hi: "rgba(255,255,255,0.78)",
  cap: "#E8B98D",
  dot: "#FFF7EA",
  trunk: "#C79B67",
  door: "#C9AE86",
  petal: "#F6CFDD",
  gem: "#E8709F",
  gold: "#F2C14E",
  goldLine: "#B9892E",
};

/** 黑方（星星）：深可可 + 更深描边，高光弱化 */
export const TONE_BLACK: PieceTone = {
  body: "#57412F",
  shade: "#3E2C1E",
  line: "#2A1B10",
  hi: "rgba(255,255,255,0.28)",
  cap: "#39281A",
  dot: "#EBD9C2",
  trunk: "#3A2A1C",
  door: "#2A1C11",
  petal: "#8A6680",
  gem: "#E8709F",
  gold: "#E3AE45",
  goldLine: "#8A6420",
};

/** 素材契约用的纯十六进制色板（rgba 高光不在其列） */
export const ART_PALETTE: Record<string, string> = {
  whiteBody: TONE_WHITE.body,
  blackBody: TONE_BLACK.body,
  whiteLine: TONE_WHITE.line,
  blackLine: TONE_BLACK.line,
  gold: TONE_WHITE.gold,
  gem: TONE_WHITE.gem,
  stoneLight: "#F2E8D5",
  grassDark: "#A8C88E",
  fenceWood: "#9D7038",
  petalPink: "#F6AECB",
  sproutGreen: "#7FAE5C",
};

/** 花瓣的三个粉色深浅（吃子与升变的飘瓣轮着用） */
const PETAL_FILLS = ["#F6AECB", "#F9C4D9", "#F19BBE"];

function svgWrap(inner: string, viewBox = "0 0 32 36", cls = ""): string {
  const klass = cls ? ` class="${cls}"` : "";
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"${klass}>${inner}</svg>`;
}

/** 统一的投影 + 椭圆底座（先画在最底下） */
function plinth(t: PieceTone): string {
  return (
    `<ellipse cx="16" cy="33.2" rx="10" ry="2.4" fill="rgba(70,45,20,0.20)"/>` +
    `<ellipse cx="16" cy="31.2" rx="8.6" ry="2.8" fill="${t.shade}" stroke="${t.line}" stroke-width="1.2"/>`
  );
}

/**
 * 主体的两停层叠明暗（渐变等效，免 defs/id——这些 SVG 会内联很多份）：
 * 同一条路径叠三层：本色描边整形 → 半透明暗纱 → 向顶部左上内缩的本色亮层。
 * 效果是「顶亮、底与右缘留一圈暗」，光源左上 45° 的约定不变。
 */
function duoTone(d: string, col: string, t: PieceTone, topY: number, s = 0.92): string {
  const tx = (15 * (1 - s)).toFixed(2);
  const ty = (topY * (1 - s)).toFixed(2);
  return (
    `<path d="${d}" fill="${col}" stroke="${t.line}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="rgba(56,34,16,0.14)"/>` +
    `<path d="${d}" fill="${col}" transform="matrix(${s} 0 0 ${s} ${tx} ${ty})"/>`
  );
}

/** 兵 · 小蘑菇：圆帽 + 三颗帽点，个头最矮 */
function pawnInner(t: PieceTone): string {
  return (
    plinth(t) +
    `<path d="M11.6 17.6 L11.2 29.4 Q16 31.4 20.8 29.4 L20.4 17.6 Z" fill="${t.body}" stroke="${t.line}" stroke-width="1.2"/>` +
    duoTone("M5 17.2 Q5 6.2 16 6.2 Q27 6.2 27 17.2 Q21.6 19.4 16 19.4 Q10.4 19.4 5 17.2 Z", t.cap, t, 6.2) +
    `<circle cx="11" cy="11.6" r="1.7" fill="${t.dot}"/>` +
    `<circle cx="17.6" cy="9.4" r="1.4" fill="${t.dot}"/>` +
    `<circle cx="21.8" cy="13.4" r="1.2" fill="${t.dot}"/>` +
    `<ellipse cx="10.4" cy="9.8" rx="2.6" ry="1.3" fill="${t.hi}" transform="rotate(-28 10.4 9.8)"/>`
  );
}

/** 马 · 小木马头：朝左的侧脸 + 背上三束鬃毛 */
function knightInner(t: PieceTone): string {
  return (
    plinth(t) +
    duoTone("M12.4 30 L12.4 20.4 Q12.4 18.4 10.6 17.6 L7.6 16.2 Q5.6 15.3 6.4 13.2 Q8.2 8.6 13.6 7.8 L16.8 4.6 L18.4 8.4 Q21.6 11 21.6 16 L21.6 30 Z", t.body, t, 4.6) +
    `<path d="M21.6 22 Q25.4 21 24 17.6 Q27 17 25.4 13.8 Q27.8 12.6 25.6 9.6 Q23.2 7.6 18.4 8.4 Q21.6 11 21.6 16 Z" fill="${t.cap}" stroke="${t.line}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<circle cx="12.2" cy="12.6" r="1.3" fill="${t.line}"/>` +
    `<circle cx="8.2" cy="14" r="0.8" fill="${t.line}"/>` +
    `<ellipse cx="14.6" cy="9.8" rx="2.4" ry="1.2" fill="${t.hi}" transform="rotate(-30 14.6 9.8)"/>`
  );
}

/** 象 · 尖顶小树：三层树冠 + 两颗果子，剪影是斜肩的尖三角 */
function bishopInner(t: PieceTone): string {
  return (
    plinth(t) +
    `<path d="M13.8 25 L13.4 30.4 L18.6 30.4 L18.2 25 Z" fill="${t.trunk}" stroke="${t.line}" stroke-width="1.1"/>` +
    duoTone("M16 2.6 L21.4 10.4 L18.8 10.4 L24 17.8 L20.8 17.8 L26.4 25.6 L5.6 25.6 L11.2 17.8 L8 17.8 L13.2 10.4 L10.6 10.4 Z", t.body, t, 2.6) +
    `<circle cx="13" cy="15" r="1.3" fill="${t.gem}"/>` +
    `<circle cx="19.4" cy="21.6" r="1.3" fill="${t.gem}"/>` +
    `<ellipse cx="13" cy="8.4" rx="2" ry="1.1" fill="${t.hi}" transform="rotate(-34 13 8.4)"/>`
  );
}

/** 车 · 石塔：三齿垛口 + 拱门 + 两道砖缝 */
function rookInner(t: PieceTone): string {
  return (
    plinth(t) +
    duoTone("M9.6 12 L8.8 29.6 Q16 31.6 23.2 29.6 L22.4 12 Z", t.body, t, 12) +
    `<path d="M8 5 L11.4 5 L11.4 8.2 L14 8.2 L14 5 L18 5 L18 8.2 L20.6 8.2 L20.6 5 L24 5 L24 12 L8 12 Z" fill="${t.body}" stroke="${t.line}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M13.4 29.8 L13.4 23.6 Q16 21.2 18.6 23.6 L18.6 29.8 Z" fill="${t.door}"/>` +
    `<path d="M10 16 L22 16 M10.4 19.8 L21.6 19.8" stroke="${t.line}" stroke-width="0.9" opacity="0.45" fill="none"/>` +
    `<ellipse cx="11.8" cy="16.4" rx="1.3" ry="4" fill="${t.hi}"/>`
  );
}

/** 后 · 盛开花冠：五瓣大花 + 金边宝石芯，剪影是放射的星形 */
function queenInner(t: PieceTone): string {
  let petals = "";
  for (const a of [0, 72, 144, 216, 288]) {
    petals += `<g transform="rotate(${a} 16 11)"><ellipse cx="16" cy="5.6" rx="3.1" ry="4.6" fill="${t.petal}" stroke="${t.line}" stroke-width="1"/></g>`;
  }
  return (
    plinth(t) +
    duoTone("M11.4 30.2 L13 18.8 L19 18.8 L20.6 30.2 Q16 31.8 11.4 30.2 Z", t.body, t, 18.8) +
    petals +
    `<circle cx="16" cy="11" r="3" fill="${t.gem}" stroke="${t.goldLine}" stroke-width="1"/>` +
    `<circle cx="15" cy="10" r="0.9" fill="rgba(255,255,255,0.85)"/>` +
    `<ellipse cx="13.6" cy="22.6" rx="1.2" ry="3.2" fill="${t.hi}"/>`
  );
}

/** 王 · 戴十字小冠的大花：全场最高，圆瓣花簇 + 金冠加小十字 */
function kingInner(t: PieceTone): string {
  let petals = "";
  for (const a of [0, 60, 120, 180, 240, 300]) {
    const x = (16 + 5.6 * Math.cos((a * Math.PI) / 180)).toFixed(2);
    const y = (14 + 5.6 * Math.sin((a * Math.PI) / 180)).toFixed(2);
    petals += `<circle cx="${x}" cy="${y}" r="2.5" fill="${t.petal}" stroke="${t.line}" stroke-width="0.9"/>`;
  }
  return (
    plinth(t) +
    duoTone("M10.8 30.4 L12.6 16.4 L19.4 16.4 L21.2 30.4 Q16 32.2 10.8 30.4 Z", t.body, t, 16.4) +
    petals +
    `<circle cx="16" cy="14" r="3.4" fill="${t.gold}" stroke="${t.goldLine}" stroke-width="1"/>` +
    `<path d="M12.6 6.6 L12.6 3.4 L14.4 4.9 L16 2.6 L17.6 4.9 L19.4 3.4 L19.4 6.6 Z" fill="${t.gold}" stroke="${t.goldLine}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M16 0.4 L16 2.8 M14.9 1.5 L17.1 1.5" stroke="${t.goldLine}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="13.2" cy="21.8" rx="1.2" ry="3.4" fill="${t.hi}"/>`
  );
}

const PIECE_INNER: Record<PieceType, (t: PieceTone) => string> = {
  1: pawnInner,
  2: knightInner,
  3: bishopInner,
  4: rookInner,
  5: queenInner,
  6: kingInner,
};

/** 棋子内层图元（结算插画拼场景用，不带外层 <svg>） */
export function pieceInner(type: PieceType, white: boolean): string {
  return PIECE_INNER[type](white ? TONE_WHITE : TONE_BLACK);
}

/** 一颗棋子的完整内联 SVG；type 六种 × white 两色共 12 张，张张不同 */
export function pieceSVG(type: PieceType, white: boolean): string {
  return svgWrap(pieceInner(type, white));
}

/** 一片粉花瓣（吃子飘散 / 升变开花共用，tone 换三个深浅） */
export function petalSVG(tone = 0): string {
  const fill = PETAL_FILLS[((tone % 3) + 3) % 3];
  return svgWrap(
    `<path d="M6 0.8 Q10.6 3.4 9.4 7.8 Q8.4 11.2 6 11.2 Q3.6 11.2 2.6 7.8 Q1.4 3.4 6 0.8 Z" fill="${fill}" stroke="#D97CA1" stroke-width="0.8"/>` +
      `<path d="M6 3.2 Q6.4 6.4 6 9.6" stroke="rgba(255,255,255,0.7)" stroke-width="0.8" fill="none" stroke-linecap="round"/>`,
    "0 0 12 12"
  );
}

/** 可走点的小绿芽（形状通道，配合 cg-sq--hint 的颜色通道） */
export function sproutSVG(): string {
  return svgWrap(
    `<ellipse cx="8" cy="14.6" rx="3.2" ry="1" fill="rgba(94,138,68,0.35)"/>` +
      `<path d="M8 14.4 Q7.6 10.4 8 7.2" stroke="#5E8A44" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `<path d="M8 8.4 Q3.4 8.2 2.6 4 Q7 4.4 8 8.4 Z" fill="#7FAE5C" stroke="#5E8A44" stroke-width="0.8"/>` +
      `<path d="M8 6.8 Q12.6 6.4 13.4 2.2 Q8.8 2.8 8 6.8 Z" fill="#8FBB6C" stroke="#5E8A44" stroke-width="0.8"/>`,
    "0 0 16 16"
  );
}

/** 可吃格的四角小三角（拉满整格，与小绿芽形状互不相同） */
export function captureMarkSVG(): string {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0 L11 0 L0 11 Z M40 0 L40 11 L29 0 Z M0 40 L0 29 L11 40 Z M40 40 L29 40 L40 29 Z" fill="#E05A4E" opacity="0.82"/></svg>`;
}

/** 篱笆四角的小花盆（陶盆 + 三朵小粉花） */
export function potSVG(): string {
  return svgWrap(
    `<path d="M5 9.6 L6.2 17.6 Q10 19 13.8 17.6 L15 9.6 Z" fill="#C97B4A" stroke="#8F5430" stroke-width="1"/>` +
      `<rect x="4" y="7.4" width="12" height="2.8" rx="1.3" fill="#D98D5C" stroke="#8F5430" stroke-width="1"/>` +
      `<path d="M10 7.6 L10 5.2" stroke="#5E8A44" stroke-width="1.2" stroke-linecap="round"/>` +
      `<circle cx="7.4" cy="4.6" r="1.7" fill="#F6AECB"/>` +
      `<circle cx="12.6" cy="4.2" r="1.7" fill="#F6AECB"/>` +
      `<circle cx="10" cy="2.9" r="1.7" fill="#F6AECB"/>` +
      `<circle cx="10" cy="4.4" r="1.5" fill="#F2C14E"/>`,
    "0 0 20 20"
  );
}

/** 结算插画：赢家王戴花环；和棋是双王并立加一只白鸽 */
export function overSceneSVG(kind: "white" | "black" | "draw"): string {
  if (kind === "draw") {
    const dove =
      `<g class="cg-art-dove">` +
      `<path d="M70 16 Q76 12 82 15 Q78 17 76 21 Q72 26 64 24 Q58 23 54 26 Q56 21 62 20 Q66 19 70 16 Z" fill="#FBFBF4" stroke="#9FB0C4" stroke-width="1"/>` +
      `<path d="M66 17 Q70 10 78 9 Q74 14 70 16 Z" fill="#EDF1F5" stroke="#9FB0C4" stroke-width="1"/>` +
      `<circle cx="79" cy="15" r="0.9" fill="#5B6B80"/>` +
      `<path d="M82 15 L85.4 16 L82 17 Z" fill="#F2C14E"/>` +
      `</g>`;
    return svgWrap(
      dove +
        `<g transform="translate(34 36) scale(0.95)">${pieceInner(6, true)}</g>` +
        `<g transform="translate(74 36) scale(0.95)">${pieceInner(6, false)}</g>`,
      "0 0 140 84",
      "cg-art-scene"
    );
  }
  let flowers = "";
  for (const [x, y] of [
    [70, 13],
    [101, 44],
    [70, 75],
    [39, 44],
  ]) {
    flowers += `<circle cx="${x}" cy="${y}" r="3.6" fill="#F6AECB" stroke="#D97CA1" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1.5" fill="#F2C14E"/>`;
  }
  const wreath =
    `<g class="cg-art-wreath">` +
    `<circle cx="70" cy="44" r="31" fill="none" stroke="#7FAE5C" stroke-width="6" stroke-dasharray="11 8" stroke-linecap="round"/>` +
    flowers +
    `</g>`;
  return svgWrap(
    wreath + `<g transform="translate(53.2 24) scale(1.05)">${pieceInner(6, kind === "white")}</g>`,
    "0 0 140 84",
    "cg-art-scene"
  );
}
