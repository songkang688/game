/**
 * 朵星地产 · 1.3 视觉资产（`src/games/star-estate/art.ts`）
 *
 * 全部是「纯函数返回内联 SVG 字符串」：不碰 DOM、不建 canvas、不挂监听，
 * 颜色一律从共享素材包 `src/art/kit/` 的调色板推导（shade / tint 三阶光影）。
 * index.ts 只负责把这些字符串塞进节点；测试直接断言字符串结构。
 *
 * 视觉宪法要点（docs/plan-1.3-visual-bible.md）：
 * - 金币绝不是纯色圆：渐变币面 + 内圈亮环 + 星形压印 + 高光斑；
 * - 角色四位形状差（花 / 星 / 云 / 月），色弱模式下仍可区分；
 * - 骰子是「顶面亮、两侧各暗一阶」的伪 3D 三面体 + 红黑圆点；
 * - 无任何地产桌游商标元素，全部原创矢量。
 */

import { CHAR_COLORS, KIT_PALETTE, shade, tint } from "../../art/kit";

/** 立牌角色的四种剪影：朵朵=粉花、星星=金星、糯糯=月亮、云云=云朵 */
export type TokenKind = "flower" | "star" | "cloud" | "moon";

/** 席位 emoji → 立牌剪影（emoji 本身只进 aria-label，不再当棋子画） */
export function tokenKindOf(emoji: string): TokenKind {
  if (emoji === "🌸") return "flower";
  if (emoji === "⭐") return "star";
  if (emoji === "☁️") return "cloud";
  return "moon";
}

/** 五角星顶点串（SVG polygon 的 points 属性） */
function starPts(cx: number, cy: number, rOut: number, rIn: number, points = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** 眼睛 + 腮红 + 微笑：四种立牌共用的五官层 */
function faceSVG(cx: number, cy: number, r: number): string {
  const ink = KIT_PALETTE.ink;
  const ex = r * 0.42;
  const er = Math.max(r * 0.14, 0.5);
  return (
    `<circle cx="${(cx - ex).toFixed(2)}" cy="${(cy - r * 0.1).toFixed(2)}" r="${er.toFixed(2)}" fill="${ink}"/>` +
    `<circle cx="${(cx + ex).toFixed(2)}" cy="${(cy - r * 0.1).toFixed(2)}" r="${er.toFixed(2)}" fill="${ink}"/>` +
    `<circle cx="${(cx - ex - er * 0.3).toFixed(2)}" cy="${(cy - r * 0.1 - er * 0.35).toFixed(2)}" r="${(er * 0.35).toFixed(2)}" fill="${KIT_PALETTE.cloud}"/>` +
    `<circle cx="${(cx + ex - er * 0.3).toFixed(2)}" cy="${(cy - r * 0.1 - er * 0.35).toFixed(2)}" r="${(er * 0.35).toFixed(2)}" fill="${KIT_PALETTE.cloud}"/>` +
    `<ellipse cx="${(cx - r * 0.66).toFixed(2)}" cy="${(cy + r * 0.26).toFixed(2)}" rx="${(r * 0.18).toFixed(2)}" ry="${(r * 0.11).toFixed(2)}" fill="${KIT_PALETTE.blush}" opacity=".6"/>` +
    `<ellipse cx="${(cx + r * 0.66).toFixed(2)}" cy="${(cy + r * 0.26).toFixed(2)}" rx="${(r * 0.18).toFixed(2)}" ry="${(r * 0.11).toFixed(2)}" fill="${KIT_PALETTE.blush}" opacity=".6"/>` +
    `<path d="M ${(cx - r * 0.22).toFixed(2)} ${(cy + r * 0.32).toFixed(2)} Q ${cx.toFixed(2)} ${(cy + r * 0.52).toFixed(2)} ${(cx + r * 0.22).toFixed(2)} ${(cy + r * 0.32).toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${Math.max(r * 0.1, 0.5).toFixed(2)}" stroke-linecap="round"/>`
  );
}

/** 四种 Q 版脑袋：花瓣 / 五角星 / 云朵 / 弯月，剪影互不混淆 */
function tokenHead(kind: TokenKind): string {
  if (kind === "flower") {
    const c = CHAR_COLORS.duoduo;
    let petals = "";
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const px = 12 + Math.cos(a) * 4.6;
      const py = 10 + Math.sin(a) * 4.6;
      petals += `<circle cx="${px.toFixed(2)}" cy="${(py + 0.7).toFixed(2)}" r="3.1" fill="${shade(c.primary, 0.22)}"/>`;
    }
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const px = 12 + Math.cos(a) * 4.6;
      const py = 10 + Math.sin(a) * 4.6;
      petals += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3.1" fill="${c.primary}"/>`;
    }
    return (
      petals +
      `<circle cx="9.6" cy="6.2" r="1.2" fill="${tint(c.primary, 0.5)}"/>` +
      `<circle cx="12" cy="10" r="4.6" fill="${c.secondary}" stroke="${c.outline}" stroke-width=".5"/>` +
      faceSVG(12, 10, 4.2)
    );
  }
  if (kind === "star") {
    const c = CHAR_COLORS.xingxing;
    return (
      `<polygon points="${starPts(12, 10.8, 7.4, 3.6)}" fill="${shade(c.primary, 0.28)}"/>` +
      `<polygon points="${starPts(12, 10, 7.4, 3.6)}" fill="${c.primary}" stroke="${c.primary}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<ellipse cx="8.8" cy="6.4" rx="1.6" ry=".8" fill="${tint(c.primary, 0.55)}" transform="rotate(-32 8.8 6.4)"/>` +
      `<circle cx="12" cy="10.6" r="3.9" fill="${c.secondary}" stroke="${c.outline}" stroke-width=".5"/>` +
      faceSVG(12, 10.6, 3.7)
    );
  }
  if (kind === "cloud") {
    const base = KIT_PALETTE.cloud;
    const line = shade(KIT_PALETTE.sky, 0.35);
    return (
      `<ellipse cx="12" cy="12.6" rx="7.6" ry="3.4" fill="${shade(KIT_PALETTE.sky, 0.12)}"/>` +
      `<circle cx="7.4" cy="10.6" r="3.4" fill="${base}"/>` +
      `<circle cx="16.6" cy="10.6" r="3.4" fill="${base}"/>` +
      `<circle cx="12" cy="8" r="4.6" fill="${base}"/>` +
      `<ellipse cx="12" cy="12" rx="7" ry="2.6" fill="${base}"/>` +
      `<ellipse cx="9" cy="6" rx="1.8" ry=".9" fill="${tint(KIT_PALETTE.sky, 0.7)}" transform="rotate(-24 9 6)"/>` +
      `<path d="M 4.6 11 Q 5.6 12.4 7 12.6" fill="none" stroke="${line}" stroke-width=".5" opacity=".5"/>` +
      faceSVG(12, 9.6, 4)
    );
  }
  const moon = KIT_PALETTE.lemon;
  return (
    `<path d="M 15.2 3.4 A 7 7 0 1 0 15.2 16.6 A 5.4 5.4 0 1 1 15.2 3.4 Z" fill="${shade(moon, 0.3)}" transform="translate(.4 .7)"/>` +
    `<path d="M 15.2 3.4 A 7 7 0 1 0 15.2 16.6 A 5.4 5.4 0 1 1 15.2 3.4 Z" fill="${moon}"/>` +
    `<ellipse cx="7.6" cy="6.2" rx="1.5" ry=".8" fill="${tint(moon, 0.6)}" transform="rotate(-38 7.6 6.2)"/>` +
    `<circle cx="10.4" cy="10" r="3.9" fill="${tint(moon, 0.55)}" stroke="${shade(moon, 0.42)}" stroke-width=".5"/>` +
    faceSVG(10.4, 10, 3.7)
  );
}

/**
 * 棋子立牌：24×30 —— 底部椭圆基座（席位色 + 暗沿 + 高光）+ 短圆身板 + Q 版脑袋。
 * 四位靠「花 / 星 / 云 / 月」的剪影 + 席位色双通道区分。
 */
export function tokenSVG(kind: TokenKind, seatColor: string): string {
  const bodyC = tint(seatColor, 0.35);
  return (
    `<svg viewBox="0 0 24 30" class="se-token-svg se-token-${kind}" aria-hidden="true" focusable="false">` +
    `<ellipse cx="12" cy="27.4" rx="8.6" ry="2.9" fill="${shade(seatColor, 0.38)}"/>` +
    `<ellipse cx="12" cy="26.4" rx="8.6" ry="2.9" fill="${seatColor}"/>` +
    `<ellipse cx="9.4" cy="25.4" rx="2.6" ry=".8" fill="${tint(seatColor, 0.5)}"/>` +
    `<path d="M 8.6 25.6 Q 8 19.4 9.6 16.6 L 14.4 16.6 Q 16 19.4 15.4 25.6 Q 12 26.8 8.6 25.6 Z" fill="${bodyC}" stroke="${shade(seatColor, 0.3)}" stroke-width=".5"/>` +
    `<ellipse cx="10.6" cy="19.4" rx="1.1" ry="1.8" fill="${tint(seatColor, 0.6)}"/>` +
    tokenHead(kind) +
    `</svg>`
  );
}

/** 骰子六个点数的圆点布局（前脸中心为原点，单位是偏移格） */
export const DIE_PIPS: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[0, 0]],
  [
    [-1, -1],
    [1, 1]
  ],
  [
    [-1, -1],
    [0, 0],
    [1, 1]
  ],
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ],
  [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1]
  ],
  [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1]
  ]
];

/**
 * 伪 3D 骰子：顶面最亮、前脸次之、右侧最暗（两阶暗面给体积），
 * 前脸圆角 + 红（1、4 点）/ 墨黑圆点 + 每颗点一粒高光。
 * `gold` 是「双骰同点」的金描边庆祝态。
 */
export function dieSVG(v: number, gold = false): string {
  const n = Math.max(1, Math.min(6, Math.round(v) || 1));
  const face = KIT_PALETTE.cloud;
  const top = tint(KIT_PALETTE.lilac, 0.82);
  const side = shade(tint(KIT_PALETTE.lilac, 0.6), 0.18);
  const pipC = n === 1 || n === 4 ? shade(KIT_PALETTE.coral, 0.18) : KIT_PALETTE.ink;
  let pips = "";
  for (const [dx, dy] of DIE_PIPS[n]) {
    const px = 12 + dx * 5;
    const py = 16 + dy * 5;
    pips +=
      `<circle class="se-die-pip" cx="${px}" cy="${py}" r="2.1" fill="${pipC}"/>` +
      `<circle cx="${px - 0.7}" cy="${py - 0.7}" r=".6" fill="${tint(pipC, 0.65)}"/>`;
  }
  return (
    `<svg viewBox="0 0 28 30" class="se-die" data-pips="${n}" aria-hidden="true" focusable="false">` +
    `<polygon points="2,6 7,1 27,1 22,6" fill="${top}"/>` +
    `<polygon points="22,6 27,1 27,21 22,26" fill="${side}"/>` +
    `<rect x="2" y="6" width="20" height="20" rx="4.5" fill="${face}" stroke="${gold ? KIT_PALETTE.starGold : shade(KIT_PALETTE.lilac, 0.05)}" stroke-width="${gold ? 2.2 : 1}"/>` +
    `<rect x="3.4" y="7.4" width="17.2" height="4.4" rx="2.2" fill="${tint(KIT_PALETTE.lilac, 0.9)}" opacity=".7"/>` +
    pips +
    `</svg>`
  );
}

let coinSeq = 0;

/**
 * 金币（飞行动画用的完整版）：径向金黄渐变币面 + 侧沿厚度 + 内圈亮环 +
 * 星形压印 + 左上高光斑。绝不是纯色圆。
 */
export function coinSVG(): string {
  const g = KIT_PALETTE.starGold;
  const id = `se-coin-g${++coinSeq}`;
  return (
    `<svg viewBox="0 0 20 20" class="se-coin-svg" aria-hidden="true" focusable="false">` +
    `<defs><radialGradient id="${id}" cx="38%" cy="32%" r="75%">` +
    `<stop offset="0%" stop-color="${tint(g, 0.55)}"/>` +
    `<stop offset="55%" stop-color="${g}"/>` +
    `<stop offset="100%" stop-color="${shade(g, 0.2)}"/>` +
    `</radialGradient></defs>` +
    `<circle cx="10" cy="10.9" r="8.6" fill="${shade(g, 0.42)}"/>` +
    `<circle cx="10" cy="10" r="8.6" fill="url(#${id})"/>` +
    `<circle cx="10" cy="10" r="6" fill="none" stroke="${tint(g, 0.65)}" stroke-width="1.1"/>` +
    `<polygon points="${starPts(10, 10, 4.2, 1.8)}" fill="${shade(g, 0.3)}"/>` +
    `<ellipse cx="6.8" cy="6" rx="2" ry="1" fill="${tint(g, 0.78)}" transform="rotate(-30 6.8 6)"/>` +
    `</svg>`
  );
}

/** 迷你金币（地格价签用）：三层结构（侧沿 + 币面 + 内环高光），轻量不带渐变 */
export function coinTagSVG(): string {
  const g = KIT_PALETTE.starGold;
  return (
    `<svg viewBox="0 0 10 10" class="se-cointag" aria-hidden="true" focusable="false">` +
    `<circle cx="5" cy="5.5" r="4.2" fill="${shade(g, 0.4)}"/>` +
    `<circle cx="5" cy="5" r="4.2" fill="${g}"/>` +
    `<circle cx="5" cy="5" r="2.6" fill="none" stroke="${tint(g, 0.6)}" stroke-width=".9"/>` +
    `<circle cx="3.6" cy="3.4" r=".9" fill="${tint(g, 0.8)}"/>` +
    `</svg>`
  );
}

/** 拥有者小旗：旗杆 + 玩家色三角旗 + 旗面暗折，替代旧的色点 */
export function flagSVG(color: string): string {
  return (
    `<svg viewBox="0 0 10 14" class="se-flag" aria-hidden="true" focusable="false">` +
    `<line x1="2" y1="1.6" x2="2" y2="13" stroke="${KIT_PALETTE.cocoa}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="2" cy="1.6" r="1" fill="${KIT_PALETTE.starGold}"/>` +
    `<polygon points="2.8,2.4 9.4,4.6 2.8,6.8" fill="${color}"/>` +
    `<polygon points="2.8,4.6 6.2,5.7 2.8,6.8" fill="${shade(color, 0.25)}"/>` +
    `</svg>`
  );
}

/** 小房子：三角屋顶 + 方身 + 门窗点 + 底沿暗阶。`drop` 时带落下动画类。 */
export function houseSVG(drop = false): string {
  const body = tint(KIT_PALETTE.grassDeep, 0.15);
  const roof = shade(KIT_PALETTE.grassDeep, 0.35);
  return (
    `<svg viewBox="0 0 12 12" class="se-house${drop ? " se-drop" : ""}" aria-hidden="true" focusable="false">` +
    `<rect x="2.6" y="5.6" width="6.8" height="5.6" rx=".8" fill="${body}"/>` +
    `<rect x="2.6" y="10" width="6.8" height="1.2" rx=".6" fill="${shade(body, 0.28)}"/>` +
    `<polygon points="1.4,6 6,1.4 10.6,6" fill="${roof}"/>` +
    `<polygon points="3,5.2 6,2.2 9,5.2" fill="${tint(roof, 0.25)}"/>` +
    `<rect x="5.1" y="7.6" width="1.8" height="3.4" rx=".7" fill="${shade(roof, 0.2)}"/>` +
    `<circle cx="3.9" cy="7.4" r=".7" fill="${KIT_PALETTE.lemon}"/>` +
    `<circle cx="8.1" cy="7.4" r=".7" fill="${KIT_PALETTE.lemon}"/>` +
    `</svg>`
  );
}

/** 满级大屋（酒店）：两层红金小楼 + 楼层带 + 金星招牌 + 门窗 */
export function hotelSVG(drop = false): string {
  const body = shade(KIT_PALETTE.coral, 0.12);
  const roof = shade(KIT_PALETTE.coral, 0.4);
  return (
    `<svg viewBox="0 0 18 14" class="se-hotel${drop ? " se-drop" : ""}" aria-hidden="true" focusable="false">` +
    `<rect x="2.4" y="4.6" width="13.2" height="8.6" rx="1" fill="${body}"/>` +
    `<rect x="2.4" y="8.4" width="13.2" height="1.1" fill="${shade(body, 0.25)}"/>` +
    `<rect x="2.4" y="11.9" width="13.2" height="1.3" rx=".6" fill="${shade(body, 0.32)}"/>` +
    `<polygon points="1.2,5 9,1 16.8,5" fill="${roof}"/>` +
    `<polygon points="3.4,4.4 9,1.8 14.6,4.4" fill="${tint(roof, 0.22)}"/>` +
    `<rect x="7.8" y="9.6" width="2.4" height="3.4" rx=".8" fill="${shade(roof, 0.2)}"/>` +
    `<circle cx="5" cy="6.8" r=".8" fill="${KIT_PALETTE.lemon}"/>` +
    `<circle cx="13" cy="6.8" r=".8" fill="${KIT_PALETTE.lemon}"/>` +
    `<circle cx="5" cy="10.6" r=".8" fill="${KIT_PALETTE.lemon}"/>` +
    `<circle cx="13" cy="10.6" r=".8" fill="${KIT_PALETTE.lemon}"/>` +
    `<polygon points="${starPts(9, 5.6, 2, 0.9)}" fill="${KIT_PALETTE.starGold}"/>` +
    `</svg>`
  );
}

/** 屋檐色带屋顶：斜切屋檐 + 屋脊暗沿 + 顶部高光，替代平色带 */
export function roofSVG(color: string): string {
  return (
    `<svg viewBox="0 0 40 10" preserveAspectRatio="none" class="se-roof" aria-hidden="true" focusable="false">` +
    `<polygon points="0,10 4,2 36,2 40,10" fill="${color}"/>` +
    `<polygon points="0,10 2,6.4 38,6.4 40,10" fill="${shade(color, 0.18)}"/>` +
    `<rect x="5" y="2.6" width="30" height="1.6" rx=".8" fill="${tint(color, 0.45)}"/>` +
    `</svg>`
  );
}

/** 车站底纹：两根铁轨 + 枕木 */
export function railTexSVG(): string {
  const c = shade("#d9d3c4", 0.32);
  let ties = "";
  for (let i = 0; i < 4; i++) {
    ties += `<rect x="6" y="${3 + i * 5}" width="20" height="1.6" rx=".8" fill="${c}" opacity=".55"/>`;
  }
  return (
    `<svg viewBox="0 0 32 22" preserveAspectRatio="none" class="se-tex se-tex-rail" aria-hidden="true" focusable="false">` +
    ties +
    `<rect x="10" y="1" width="2" height="20" rx="1" fill="${c}"/>` +
    `<rect x="20" y="1" width="2" height="20" rx="1" fill="${c}"/>` +
    `</svg>`
  );
}

/** 公用设施底纹：三道水波弧 */
export function rippleTexSVG(): string {
  const c = shade(KIT_PALETTE.gem, 0.1);
  let waves = "";
  for (let i = 0; i < 3; i++) {
    const y = 5 + i * 6;
    waves += `<path d="M 2 ${y} Q 8 ${y - 3.4} 14 ${y} T 26 ${y}" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`;
  }
  return (
    `<svg viewBox="0 0 28 22" preserveAspectRatio="none" class="se-tex se-tex-ripple" aria-hidden="true" focusable="false">` +
    waves +
    `</svg>`
  );
}

/** 抵押纸条：斜贴的米色纸条 + 「抵押中」字样（配合灰罩用） */
export function mortNoteSVG(): string {
  const paper = tint(KIT_PALETTE.peach, 0.55);
  return (
    `<svg viewBox="0 0 36 14" class="se-mortnote" aria-hidden="true" focusable="false">` +
    `<rect x="1" y="2.4" width="34" height="10" rx="2" fill="${shade(paper, 0.22)}"/>` +
    `<rect x="1" y="1.4" width="34" height="10" rx="2" fill="${paper}" stroke="${shade(paper, 0.35)}" stroke-width=".6"/>` +
    `<text x="18" y="9.6" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${KIT_PALETTE.cocoa}">抵押中</text>` +
    `</svg>`
  );
}

/**
 * 中心「星城广场」装饰底图：四角草地 + 环形道路（带白虚线）+
 * 中央喷泉（水盆 + 金星 + 水花弧），整体低饱和不抢文字。
 */
export function plazaSVG(): string {
  const road = tint(KIT_PALETTE.peach, 0.45);
  const water = tint(KIT_PALETTE.gem, 0.55);
  const grass = KIT_PALETTE.grass;
  return (
    `<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" class="se-plaza-svg" aria-hidden="true" focusable="false">` +
    `<g opacity=".5">` +
    `<ellipse cx="6" cy="6" rx="26" ry="20" fill="${grass}"/>` +
    `<ellipse cx="114" cy="6" rx="26" ry="20" fill="${grass}"/>` +
    `<ellipse cx="6" cy="114" rx="26" ry="20" fill="${grass}"/>` +
    `<ellipse cx="114" cy="114" rx="26" ry="20" fill="${grass}"/>` +
    `<circle cx="14" cy="12" r="3" fill="${shade(grass, 0.2)}"/>` +
    `<circle cx="106" cy="110" r="3" fill="${shade(grass, 0.2)}"/>` +
    `<circle cx="60" cy="60" r="42" fill="none" stroke="${road}" stroke-width="11"/>` +
    `<circle cx="60" cy="60" r="42" fill="none" stroke="${KIT_PALETTE.cloud}" stroke-width="1.4" stroke-dasharray="6 7"/>` +
    `<circle cx="60" cy="60" r="17" fill="${water}" stroke="${shade(water, 0.18)}" stroke-width="1.6"/>` +
    `<circle cx="60" cy="60" r="12" fill="${tint(water, 0.5)}"/>` +
    `<path d="M 50 56 Q 55 51 60 56" fill="none" stroke="${KIT_PALETTE.cloud}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M 60 66 Q 65 61 70 66" fill="none" stroke="${KIT_PALETTE.cloud}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<polygon points="${starPts(60, 60, 7.4, 3.2)}" fill="${KIT_PALETTE.starGold}"/>` +
    `<polygon points="${starPts(60, 58.6, 4.4, 1.9)}" fill="${tint(KIT_PALETTE.starGold, 0.45)}"/>` +
    `</g>` +
    `</svg>`
  );
}

/** 名次金奖杯：杯身渐层 + 双耳 + 底座 + 星星徽记 */
export function trophySVG(): string {
  const g = KIT_PALETTE.starGold;
  return (
    `<svg viewBox="0 0 20 20" class="se-trophy" aria-hidden="true" focusable="false">` +
    `<path d="M 3 3 Q 1 3 1.4 5.6 Q 1.8 8.4 5 9" fill="none" stroke="${shade(g, 0.28)}" stroke-width="1.5"/>` +
    `<path d="M 17 3 Q 19 3 18.6 5.6 Q 18.2 8.4 15 9" fill="none" stroke="${shade(g, 0.28)}" stroke-width="1.5"/>` +
    `<path d="M 4.6 2 L 15.4 2 Q 15.4 9 12 11 L 8 11 Q 4.6 9 4.6 2 Z" fill="${g}"/>` +
    `<path d="M 5.8 2.8 Q 6 8 8.4 10.2 L 8 11 Q 4.6 9 4.6 2 L 5.8 2 Z" fill="${tint(g, 0.5)}"/>` +
    `<rect x="8.6" y="11" width="2.8" height="2.6" fill="${shade(g, 0.22)}"/>` +
    `<rect x="5.6" y="13.6" width="8.8" height="2" rx=".9" fill="${shade(g, 0.32)}"/>` +
    `<rect x="4.6" y="15.6" width="10.8" height="2.2" rx="1" fill="${KIT_PALETTE.cocoa}"/>` +
    `<polygon points="${starPts(10, 5.6, 2.4, 1.05)}" fill="${shade(g, 0.38)}"/>` +
    `</svg>`
  );
}

/** 「已收摊」圆印章：双圈 + 竖排字，盖在破产席位卡上（鼓励口径，无羞辱） */
export function stampSVG(): string {
  const c = shade(KIT_PALETTE.coral, 0.15);
  return (
    `<svg viewBox="0 0 40 40" class="se-stamp-svg" aria-hidden="true" focusable="false">` +
    `<circle cx="20" cy="20" r="18" fill="none" stroke="${c}" stroke-width="2.4"/>` +
    `<circle cx="20" cy="20" r="14.4" fill="none" stroke="${c}" stroke-width="1"/>` +
    `<text x="20" y="24.6" text-anchor="middle" font-size="12" font-weight="bold" fill="${c}">已收摊</text>` +
    `</svg>`
  );
}

export interface ResultBarRow {
  name: string;
  color: string;
  worth: number;
  /** 名次第一名挂奖杯 */
  win?: boolean;
}

/** 结算净资产条形对比：四色横条按比例伸长，第一名带金奖杯 */
export function resultBarsHTML(rows: ResultBarRow[]): string {
  const max = Math.max(1, ...rows.map((r) => r.worth));
  const bars = rows
    .map((r) => {
      const w = Math.max(4, Math.round((r.worth / max) * 100));
      return (
        `<div class="se-bar-row">` +
        `<span class="se-bar-name">${r.name}</span>` +
        `<span class="se-bar-track"><i class="se-bar-fill" style="width:${w}%;background:linear-gradient(180deg,${tint(r.color, 0.25)},${r.color})"></i></span>` +
        `<b class="se-bar-val">${r.worth}</b>` +
        `<span class="se-bar-cup">${r.win ? trophySVG() : ""}</span>` +
        `</div>`
      );
    })
    .join("");
  return `<div class="se-bars">${bars}</div>`;
}
