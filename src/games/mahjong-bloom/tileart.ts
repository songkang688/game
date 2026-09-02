/**
 * 花开麻将 · 牌面 SVG 生成器(纯函数,零 DOM)。
 *
 * 1.3 视觉升级的核心资产:把「数字 + 花色字」的印刷体牌面换成真正的麻将图案——
 * 筒子画同心圆饼、条子画竹节(1 条是小鸟)、万字是红数字汉字 + 黑「万」、
 * 字牌按传统配色(东南西北黑、中红、发绿、白=蓝色双线空框)、花牌画四季与梅兰竹菊。
 *
 * 统一规格:viewBox 28×38,线宽 2 上下,圆角收笔;
 * 配色取传统三色(青 / 红 / 蓝黑),樱花、金光等点缀色从共享素材包
 * `src/art/kit` 的调色板推导。本文件只生成字符串,插 DOM、挂事件都在 index.ts,
 * 和牌 / 算番 / 吃碰杠逻辑一个字都不碰。
 */
import { KIT_PALETTE, shade, tint } from "../../art/kit";
import { rankOf, suitOf, tileName } from "./tiles";

/** 传统青(筒环、竹竿、发财) */
export const ART_TEAL = "#1b7a65";
/** 传统红(红中、数字汉字、五条中间那根) */
export const ART_RED = "#c43b3b";
/** 传统蓝黑(万、东南西北、白板双线框) */
export const ART_INK = "#2b3a55";
/** 牌面画布规格,与 index.ts 里 `.mj-t-art` 的留白配套 */
export const ART_VIEW = { w: 28, h: 38 } as const;
/** 象牙白(饼芯、点缀),比纯白暖一点 */
const IVORY = "#fffef7";

function rr(n: number): number {
  return Math.round(n * 100) / 100;
}

function svgWrap(body: string): string {
  return (
    `<svg viewBox="0 0 ${ART_VIEW.w} ${ART_VIEW.h}" preserveAspectRatio="xMidYMid meet"` +
    ` focusable="false" aria-hidden="true">${body}</svg>`
  );
}

// ---------------------------------------------------------------------------
// 筒子:同心圆饼,按传统排布
// ---------------------------------------------------------------------------

/** 一个饼 = 外圈色环 + 内圈象牙 + 中心点,三层 */
function pipArt(cx: number, cy: number, r: number, color: string): string {
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${rr(r * 0.6)}" fill="${IVORY}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${rr(r * 0.26)}" fill="${shade(color, 0.15)}"/>`
  );
}

/** 2–9 筒的传统排布:纵列 / 斜线 / 四角 / 四角加中 / 三行三列 */
const PIES: Record<number, ReadonlyArray<readonly [number, number, number, string]>> = {
  2: [
    [14, 10.5, 4.6, ART_TEAL],
    [14, 27.5, 4.6, ART_INK]
  ],
  3: [
    [8, 9.5, 4.2, ART_INK],
    [14, 19, 4.2, ART_RED],
    [20, 28.5, 4.2, ART_TEAL]
  ],
  4: [
    [8.5, 10.5, 4.3, ART_INK],
    [19.5, 10.5, 4.3, ART_TEAL],
    [8.5, 27.5, 4.3, ART_TEAL],
    [19.5, 27.5, 4.3, ART_INK]
  ],
  5: [
    [8.5, 10.5, 3.9, ART_INK],
    [19.5, 10.5, 3.9, ART_TEAL],
    [14, 19, 3.9, ART_RED],
    [8.5, 27.5, 3.9, ART_TEAL],
    [19.5, 27.5, 3.9, ART_INK]
  ],
  6: [
    [8.5, 9.5, 3.9, ART_TEAL],
    [19.5, 9.5, 3.9, ART_TEAL],
    [8.5, 19, 3.9, ART_RED],
    [19.5, 19, 3.9, ART_RED],
    [8.5, 28.5, 3.9, ART_RED],
    [19.5, 28.5, 3.9, ART_RED]
  ],
  7: [
    [6.8, 7.2, 3.4, ART_TEAL],
    [14, 9.8, 3.4, ART_TEAL],
    [21.2, 12.4, 3.4, ART_TEAL],
    [8.5, 22.5, 3.4, ART_RED],
    [19.5, 22.5, 3.4, ART_RED],
    [8.5, 30.8, 3.4, ART_RED],
    [19.5, 30.8, 3.4, ART_RED]
  ],
  8: [
    [8.5, 7.4, 3.3, ART_INK],
    [19.5, 7.4, 3.3, ART_INK],
    [8.5, 15.1, 3.3, ART_INK],
    [19.5, 15.1, 3.3, ART_INK],
    [8.5, 22.8, 3.3, ART_INK],
    [19.5, 22.8, 3.3, ART_INK],
    [8.5, 30.5, 3.3, ART_INK],
    [19.5, 30.5, 3.3, ART_INK]
  ],
  9: [
    [7, 9.5, 3.3, ART_TEAL],
    [14, 9.5, 3.3, ART_TEAL],
    [21, 9.5, 3.3, ART_TEAL],
    [7, 19, 3.3, ART_RED],
    [14, 19, 3.3, ART_RED],
    [21, 19, 3.3, ART_RED],
    [7, 28.5, 3.3, ART_INK],
    [14, 28.5, 3.3, ART_INK],
    [21, 28.5, 3.3, ART_INK]
  ]
};

function pieArt(r: number): string {
  if (r === 1) {
    // 一筒是一张大饼:青环 + 象牙 + 红芯 + 花点一圈
    let dots = "";
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * (Math.PI / 180);
      dots += `<circle cx="${rr(14 + Math.cos(a) * 8.6)}" cy="${rr(19 + Math.sin(a) * 8.6)}" r="0.8" fill="${IVORY}"/>`;
    }
    return (
      `<circle cx="14" cy="19" r="10.6" fill="${ART_TEAL}"/>` +
      dots +
      `<circle cx="14" cy="19" r="7" fill="${IVORY}"/>` +
      `<circle cx="14" cy="19" r="5" fill="${ART_RED}"/>` +
      `<circle cx="14" cy="19" r="2.6" fill="${IVORY}"/>` +
      `<circle cx="14" cy="19" r="1.4" fill="${ART_TEAL}"/>`
    );
  }
  return (PIES[r] ?? []).map(([cx, cy, rad, c]) => pipArt(cx, cy, rad, c)).join("");
}

// ---------------------------------------------------------------------------
// 条子:竹节棒(1 条按传统画一只小鸟)
// ---------------------------------------------------------------------------

/** 一根竹子 = 圆角主干 + 两道竹节线 + 一条高光 */
function stickArt(cx: number, cy: number, h: number, color: string): string {
  const w = 3.8;
  const x = rr(cx - w / 2);
  const y = rr(cy - h / 2);
  const band = shade(color, 0.28);
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.7" fill="${color}"/>` +
    `<rect x="${x}" y="${rr(cy - h / 6 - 0.6)}" width="${w}" height="1.2" fill="${band}"/>` +
    `<rect x="${x}" y="${rr(cy + h / 6 - 0.6)}" width="${w}" height="1.2" fill="${band}"/>` +
    `<rect x="${rr(x + 0.8)}" y="${rr(y + 1.1)}" width="0.9" height="${rr(h - 2.2)}" rx="0.45" fill="${tint(color, 0.5)}"/>`
  );
}

const STICKS: Record<number, ReadonlyArray<readonly [number, number, number]>> = {
  2: [
    [14, 11, 12],
    [14, 27, 12]
  ],
  3: [
    [14, 9.5, 11],
    [8.5, 27, 11],
    [19.5, 27, 11]
  ],
  4: [
    [9, 10.5, 11],
    [19, 10.5, 11],
    [9, 27.5, 11],
    [19, 27.5, 11]
  ],
  5: [
    [8.5, 10.5, 10],
    [19.5, 10.5, 10],
    [14, 19, 10],
    [8.5, 27.5, 10],
    [19.5, 27.5, 10]
  ],
  6: [
    [7.5, 11, 11],
    [14, 11, 11],
    [20.5, 11, 11],
    [7.5, 27, 11],
    [14, 27, 11],
    [20.5, 27, 11]
  ],
  7: [
    [14, 8, 9],
    [7.5, 19.5, 9],
    [14, 19.5, 9],
    [20.5, 19.5, 9],
    [7.5, 30, 9],
    [14, 30, 9],
    [20.5, 30, 9]
  ],
  8: [
    [7.5, 8, 9],
    [14, 8, 9],
    [20.5, 8, 9],
    [10.5, 19, 9],
    [17.5, 19, 9],
    [7.5, 30, 9],
    [14, 30, 9],
    [20.5, 30, 9]
  ],
  9: [
    [7.5, 8, 9],
    [14, 8, 9],
    [20.5, 8, 9],
    [7.5, 19, 9],
    [14, 19, 9],
    [20.5, 19, 9],
    [7.5, 30, 9],
    [14, 30, 9],
    [20.5, 30, 9]
  ]
};

function sticksArt(r: number): string {
  const spots = STICKS[r] ?? [];
  let out = "";
  spots.forEach(([cx, cy, h], i) => {
    // 传统配色:5 条中间一根红,9 条中间一行红
    const red = (r === 5 && i === 2) || (r === 9 && i >= 3 && i <= 5);
    out += stickArt(cx, cy, h, red ? ART_RED : ART_TEAL);
  });
  // 第一根竹子顶端冒一片小叶芽
  const first = spots[0] ?? ([14, 19, 10] as const);
  const topY = rr(first[1] - first[2] / 2 - 0.4);
  out += `<path d="M${first[0]} ${topY} q2.6 -2.6 5 -1.4 q-1.6 2.8 -5 1.4 Z" fill="${tint(ART_TEAL, 0.35)}"/>`;
  return out;
}

/** 1 条:简笔小鸟——青身红尾圆头,落在一截竹枝上 */
function birdArt(): string {
  return (
    `<rect x="7" y="30" width="14" height="2.2" rx="1.1" fill="${shade(ART_TEAL, 0.25)}"/>` +
    `<path d="M10 21 L3.6 16.4 Q3 23 8.6 24.6 Z" fill="${ART_RED}"/>` +
    `<path d="M9.4 23.4 Q8 14.6 15 13.2 Q21.4 12.2 20.6 19.4 Q19.8 25.8 14.4 26.6 Q10.4 27 9.4 23.4 Z" fill="${ART_TEAL}"/>` +
    `<path d="M12 19.6 Q15.6 16.4 18.4 18.2 Q16 22.4 12 21.6 Z" fill="${tint(ART_TEAL, 0.35)}"/>` +
    `<circle cx="18.2" cy="15.6" r="3.5" fill="${tint(ART_TEAL, 0.2)}"/>` +
    `<circle cx="19.2" cy="14.9" r="0.9" fill="${ART_INK}"/>` +
    `<path d="M21.4 15 L24.8 16.4 L21.2 17.6 Z" fill="${KIT_PALETTE.starGold}"/>` +
    `<path d="M13.5 26.6 L13.5 30 M16.5 26.2 L16.5 30" stroke="${shade(ART_TEAL, 0.3)}" stroke-width="1.2" stroke-linecap="round" fill="none"/>`
  );
}

// ---------------------------------------------------------------------------
// 万字与字牌
// ---------------------------------------------------------------------------

/** 万:上红色数字汉字、下黑「万」,楷感靠 900 字重 */
function wanArt(r: number): string {
  const n = "一二三四五六七八九"[r - 1] ?? "?";
  return (
    `<text x="14" y="11" font-size="14" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${ART_RED}">${n}</text>` +
    `<text x="14" y="27.5" font-size="13" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${ART_INK}">万</text>`
  );
}

/** 字牌:东南西北黑字,中红、发绿、白=蓝色双线空框 */
function honorArt(r: number): string {
  const ch = tileName(30 + r);
  if (r === 7) {
    return (
      `<rect x="5.5" y="6.5" width="17" height="25" rx="2.6" fill="none" stroke="${ART_INK}" stroke-width="2"/>` +
      `<rect x="9" y="10.5" width="10" height="17" rx="1.6" fill="none" stroke="${tint(ART_INK, 0.35)}" stroke-width="1.3"/>`
    );
  }
  if (r === 5) {
    return (
      `<rect x="7" y="6" width="14" height="26" rx="2.4" fill="none" stroke="${tint(ART_RED, 0.55)}" stroke-width="1.2"/>` +
      `<text x="14" y="19.5" font-size="16" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${ART_RED}">${ch}</text>`
    );
  }
  if (r === 6) {
    return `<text x="14" y="19.5" font-size="16" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${ART_TEAL}">${ch}</text>`;
  }
  return (
    `<circle cx="14" cy="19" r="11.6" fill="none" stroke="${tint(ART_INK, 0.78)}" stroke-width="1.2"/>` +
    `<text x="14" y="19.5" font-size="16" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${ART_INK}">${ch}</text>`
  );
}

// ---------------------------------------------------------------------------
// 花牌:真的画一朵花 + 角标字
// ---------------------------------------------------------------------------

/** 春夏秋冬梅兰竹菊各一个主色调,全部取自共享调色板 */
const FLOWER_TONES: readonly string[] = [
  KIT_PALETTE.candyDeep,
  KIT_PALETTE.starGold,
  KIT_PALETTE.peach,
  KIT_PALETTE.sky,
  KIT_PALETTE.blush,
  KIT_PALETTE.lilac,
  KIT_PALETTE.mint,
  KIT_PALETTE.lemon
];

function flowerArt(r: number): string {
  const tone = FLOWER_TONES[r - 1] ?? KIT_PALETTE.candy;
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (-90 + i * 72) * (Math.PI / 180);
    out += `<circle cx="${rr(14 + Math.cos(a) * 5.4)}" cy="${rr(22 + Math.sin(a) * 5.4)}" r="3.6" fill="${tone}" stroke="${shade(tone, 0.25)}" stroke-width="0.8"/>`;
  }
  out += `<circle cx="14" cy="22" r="2.6" fill="${KIT_PALETTE.starGold}" stroke="${shade(KIT_PALETTE.starGold, 0.3)}" stroke-width="0.8"/>`;
  const ch = tileName(40 + r);
  const chColor = r <= 4 ? ART_RED : ART_TEAL;
  out += `<text x="7" y="8" font-size="8" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${chColor}">${ch}</text>`;
  return out;
}

// ---------------------------------------------------------------------------
// 对外出口
// ---------------------------------------------------------------------------

/**
 * 一张牌的牌面图案。任何合法 id 都返回含 `<svg` 的非空字符串;
 * 认不出的 id 画一个空框兜底,绝不抛异常。
 */
export function tileArtSVG(id: number): string {
  const s = suitOf(id);
  const r = rankOf(id);
  if (s === "m" && r >= 1 && r <= 9) return svgWrap(wanArt(r));
  if (s === "p" && r >= 1 && r <= 9) return svgWrap(pieArt(r));
  if (s === "s" && r >= 1 && r <= 9) return svgWrap(r === 1 ? birdArt() : sticksArt(r));
  if (s === "z" && r >= 1 && r <= 7) return svgWrap(honorArt(r));
  if (s === "f" && r >= 1 && r <= 8) return svgWrap(flowerArt(r));
  return svgWrap(`<rect x="4.5" y="6" width="19" height="26" rx="3" fill="none" stroke="${ART_INK}" stroke-width="2"/>`);
}

/** 牌背压纹:四瓣小花(4 个花瓣椭圆 + 花芯),盖在绿渐变底上 */
export function backArtSVG(): string {
  const petal = tint("#2e7d5b", 0.62);
  let petals = "";
  for (let i = 0; i < 4; i++) {
    petals += `<ellipse cx="6" cy="3.2" rx="1.9" ry="2.7" fill="${petal}" transform="rotate(${i * 90} 6 6)"/>`;
  }
  return (
    `<svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">${petals}` +
    `<circle cx="6" cy="6" r="1.3" fill="${tint("#2e7d5b", 0.85)}"/></svg>`
  );
}

/** 胡牌开花的主花:五瓣樱花 + 金色花芯 */
export function bloomFlowerSVG(): string {
  let petals = "";
  for (let i = 0; i < 5; i++) {
    petals +=
      `<g transform="rotate(${i * 72} 24 24)">` +
      `<path d="M24 5 C29.6 9 30.4 16 24 21.4 C17.6 16 18.4 9 24 5 Z" fill="${KIT_PALETTE.candy}" stroke="${KIT_PALETTE.candyDeep}" stroke-width="1.2"/></g>`;
  }
  return (
    `<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">${petals}` +
    `<circle cx="24" cy="24" r="4.6" fill="${KIT_PALETTE.starGold}" stroke="${shade(KIT_PALETTE.starGold, 0.3)}" stroke-width="1"/>` +
    `<circle cx="22.6" cy="22.6" r="1.3" fill="${tint(KIT_PALETTE.starGold, 0.6)}"/></svg>`
  );
}

/** 单片飘落的花瓣,i 只决定深浅两色交替 */
export function petalSVG(i: number): string {
  const tone = i % 2 === 0 ? KIT_PALETTE.candy : KIT_PALETTE.blush;
  return (
    `<svg viewBox="0 0 14 14" focusable="false" aria-hidden="true">` +
    `<path d="M7 0.8 C10.8 3.6 11.4 8.8 7 13.2 C2.6 8.8 3.2 3.6 7 0.8 Z" fill="${tone}" stroke="${shade(tone, 0.2)}" stroke-width="0.6" opacity="0.92"/></svg>`
  );
}

/** 流局那片落叶 */
export function leafSVG(): string {
  return (
    `<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">` +
    `<path d="M2.2 13.4 C2.8 6.4 8 2.2 14 2.4 C13.4 9.2 8.4 13.6 2.2 13.4 Z" fill="#c9954e" stroke="#8a5a32" stroke-width="0.8"/>` +
    `<path d="M3.8 12 C6.4 9.4 9.4 6.6 12.4 4.4" stroke="#8a5a32" stroke-width="0.9" fill="none" stroke-linecap="round"/></svg>`
  );
}

/**
 * 圈风罗盘:四个方位点,点亮当前圈风(1=东右 2=南下 3=西左 4=北上)。
 * 越界的输入夹回 1–4,绝不抛异常。
 */
export function compassSVG(active: number): string {
  const a = Math.min(4, Math.max(1, Math.round(Number.isFinite(active) ? active : 1)));
  const pts: ReadonlyArray<readonly [number, number]> = [
    [16.4, 10],
    [10, 16.4],
    [3.6, 10],
    [10, 3.6]
  ];
  let dots = "";
  pts.forEach(([x, y], i) => {
    dots +=
      i + 1 === a
        ? `<circle cx="${x}" cy="${y}" r="2.9" fill="${KIT_PALETTE.starGold}" stroke="${shade(KIT_PALETTE.starGold, 0.35)}" stroke-width="0.9"/>`
        : `<circle cx="${x}" cy="${y}" r="1.6" fill="${tint(ART_TEAL, 0.55)}"/>`;
  });
  return (
    `<svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">` +
    `<circle cx="10" cy="10" r="8.8" fill="#f2faf4" stroke="${ART_TEAL}" stroke-width="1.4"/>` +
    `<circle cx="10" cy="10" r="1.3" fill="${ART_TEAL}"/>${dots}</svg>`
  );
}
