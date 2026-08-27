/**
 * 共享美术套件 · 木牌（1.3 视觉升级 · 窗口8 A 档新增，独占文件）。
 *
 * 圆角木牌 + 顶部钉点 + 居中文字的通用 SVG 片段：clock-house 拿它当钟面数字牌，
 * 别的游戏要挂路牌 / 计分牌也能用。纯字符串输出、无 DOM、无计时器，node 可测。
 */

export interface WoodSignOpts {
  /** 牌面中心点（所在 SVG 的视口坐标） */
  cx: number;
  cy: number;
  /** 牌面宽高 */
  w: number;
  h: number;
  /** 牌上的字（调用方自己保证是安全文本，这里只放数字 / 中文） */
  text: string;
  /** 字号（视口单位） */
  fontSize: number;
  /** 牌底色 */
  fill: string;
  /** 牌边描边色 */
  edge: string;
  /** 钉点色 */
  nail: string;
  /** 文字色 */
  ink: string;
  /** 圆角半径；不传按短边 22% */
  rx?: number;
  /** 描边宽；不传按牌宽 8%（至少 0.6） */
  strokeWidth?: number;
  /** 附加 class（会拼在 g 上） */
  className?: string;
}

/** 钉点半径与牌宽的比例 */
export const NAIL_RATIO = 0.09;

/** 一块木牌：`<g>` 里从底到顶是牌面 → 钉点 → 文字 */
export function woodSignSVG(o: WoodSignOpts): string {
  const rx = o.rx ?? Math.min(o.w, o.h) * 0.22;
  const sw = o.strokeWidth ?? Math.max(0.6, o.w * 0.08);
  const x = o.cx - o.w / 2;
  const y = o.cy - o.h / 2;
  const nailR = Math.max(0.5, o.w * NAIL_RATIO);
  const nailY = y + nailR + sw;
  const cls = ["kit-woodsign", o.className].filter(Boolean).join(" ");
  return (
    `<g class="${cls}">` +
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${o.w.toFixed(2)}" height="${o.h.toFixed(2)}" rx="${rx.toFixed(
      2
    )}" fill="${o.fill}" stroke="${o.edge}" stroke-width="${sw.toFixed(2)}"/>` +
    `<circle cx="${o.cx.toFixed(2)}" cy="${nailY.toFixed(2)}" r="${nailR.toFixed(2)}" fill="${o.nail}"/>` +
    `<text x="${o.cx.toFixed(2)}" y="${(o.cy + o.fontSize * 0.38).toFixed(2)}" font-size="${o.fontSize}" font-weight="800" text-anchor="middle" fill="${o.ink}">${o.text}</text>` +
    `</g>`
  );
}
