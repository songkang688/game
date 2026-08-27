/**
 * 共享美术套件 · 木质画框与侦探小物（1.3 视觉升级 · 窗口8 C 档新增，独占文件）。
 *
 * find-diff「双画框舞台」用：木纹画框 CSS / 顶部挂牌 CSS / 麻绳中缝 SVG / 放大镜 SVG。
 * 全部是纯函数输出 CSS 或 SVG 字符串：不碰 DOM、不开计时器、无位图、无外链，node 可测。
 * 画框一族只加「相框皮肤」，绝不改动被装裱内容的盒模型语义——格子坐标一个像素不动。
 */

/** 画框与书桌的木色 token（与 palette.ts 的粉彩基调互补，木色单独成套） */
export const FRAME_TOKENS = {
  /** 画框木纹主色 */
  frameWood: "#c98d54",
  /** 框角描边 / 深木纹 */
  frameWoodDark: "#96622f",
  /** 画框内衬白边 */
  matteWhite: "#fffdf7",
  /** 侦探书桌桌面 */
  deskWood: "#a06b3a",
} as const;

/** 木框宽（px）与内衬白边宽（px）：CSS 与测试共用同一口径 */
export const FRAME_BORDER_PX = 8;
export const MATTE_PX = 4;

/** 类名前缀只许字母与连字符，清洗后为空就落回 kit（跟 sparkle.ts 同规矩） */
function safePrefix(prefix: string): string {
  return prefix.replace(/[^a-z-]/gi, "") || "kit";
}

/**
 * 木质画框 CSS：外框 8px 两色相间斜纹木纹 + 45° 斜接角线 + 内衬 4px 白边。
 * 只定义 `.{p}-framed` 一族类，调用方把类挂到自己的面板节点上即可；
 * 角线画在 ::before 装饰层上并 pointer-events:none，不挡任何点击。
 */
export function woodFrameCss(prefix: string): string {
  const p = safePrefix(prefix);
  const { frameWood, frameWoodDark, matteWhite } = FRAME_TOKENS;
  const b = FRAME_BORDER_PX;
  const miter = (angle: number, at: string): string =>
    `linear-gradient(${angle}deg,transparent 9px,${frameWoodDark} 9px,${frameWoodDark} 10.5px,transparent 10.5px) ${at}/16px 16px no-repeat`;
  return `
.${p}-framed{position:relative;border:${b}px solid transparent;border-radius:8px;
  background:linear-gradient(${matteWhite},${matteWhite}) padding-box,
    repeating-linear-gradient(45deg,${frameWood} 0 7px,${frameWoodDark} 7px 9px,${frameWood} 9px 14px) border-box;
  box-shadow:inset 0 0 0 ${MATTE_PX}px ${matteWhite},0 4px 12px rgba(96,64,32,.28);}
.${p}-framed::before{content:"";position:absolute;inset:-${b}px;border-radius:8px;pointer-events:none;
  background:${miter(135, "left top")},${miter(225, "right top")},${miter(45, "left bottom")},${miter(315, "right bottom")};}
`;
}

/**
 * 顶部小挂牌 CSS：圆角牌 + 左右两个钉点（radial-gradient 画的，不加子节点）。
 * 挂到画框顶部的标签节点上用；`display:table + margin:auto` 让它收身居中。
 */
export function plaqueCss(prefix: string): string {
  const p = safePrefix(prefix);
  const { frameWoodDark, matteWhite } = FRAME_TOKENS;
  return `
.${p}-plaque{display:table;margin:0 auto 3px;background:${matteWhite};border:2px solid ${frameWoodDark};
  border-radius:9px;padding:2px 16px;box-shadow:0 2px 4px rgba(96,64,32,.22);
  background-image:radial-gradient(circle at 7px 50%,${frameWoodDark} 2px,transparent 2.6px),
    radial-gradient(circle at calc(100% - 7px) 50%,${frameWoodDark} 2px,transparent 2.6px);}
`;
}

export interface RopeOpts {
  /** 画布宽（视口单位，最小 24） */
  w: number;
  /** 画布高（最小 8） */
  h: number;
  /** 麻绳色 */
  rope: string;
  /** 别针色 */
  pin: string;
  /** 别针个数（0–4，默认 2） */
  pins?: number;
}

/**
 * 一段微微下垂的麻绳 + 木夹小别针：双画框的中缝装饰。
 * 别针沿着绳子的二次贝塞尔弧线摆（y = midY + 2t(1-t)·sag），不会浮在绳外。
 */
export function ropeSVG(o: RopeOpts): string {
  const w = Math.max(24, o.w);
  const h = Math.max(8, o.h);
  const sag = Math.min(h * 0.42, w * 0.06);
  const midY = h * 0.3;
  const pins = Math.max(0, Math.min(4, Math.round(o.pins ?? 2)));
  const pinW = Math.max(4, Math.min(7, w * 0.05));
  const pinH = h * 0.52;
  const parts: string[] = [
    `<path d="M1 ${midY.toFixed(1)} Q ${(w / 2).toFixed(1)} ${(midY + sag * 2).toFixed(1)} ${(w - 1).toFixed(
      1
    )} ${midY.toFixed(1)}" fill="none" stroke="${o.rope}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="5 2.6"/>`,
  ];
  for (let i = 0; i < pins; i++) {
    const t = pins === 1 ? 0.5 : 0.14 + (0.72 / (pins - 1)) * i;
    const x = w * t;
    const y = midY + 2 * t * (1 - t) * sag * 2;
    parts.push(
      `<g class="kit-rope-pin"><rect x="${(x - pinW / 2).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="${pinW.toFixed(
        1
      )}" height="${pinH.toFixed(1)}" rx="${(pinW * 0.35).toFixed(1)}" fill="${o.pin}"/><circle cx="${x.toFixed(
        1
      )}" cy="${(y + pinH * 0.34).toFixed(1)}" r="${(pinW * 0.22).toFixed(1)}" fill="rgba(255,255,255,.55)"/></g>`
    );
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" aria-hidden="true">${parts.join("")}</svg>`;
}

export interface MagnifierOpts {
  /** 镜框描边色 */
  rim: string;
  /** 斜柄色 */
  handle: string;
  /** 镜片底色（默认半透明白，能透出底下的画面） */
  glass?: string;
  /** 附加 class（拼在 svg 上） */
  className?: string;
}

/**
 * 放大镜：圆镜框（描边 3）+ 45° 斜柄圆头 + 镜片高光弧两条。
 * viewBox 恒为 0 0 48 48，尺寸由外层容器决定；侦探元素原创，不摹任何形象。
 */
export function magnifierSVG(o: MagnifierOpts): string {
  const glass = o.glass ?? "rgba(255,255,255,.34)";
  const cls = ["kit-mag", o.className].filter(Boolean).join(" ");
  return (
    `<svg class="${cls}" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">` +
    `<line x1="31.5" y1="31.5" x2="43" y2="43" stroke="${o.handle}" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="20" cy="20" r="14" fill="${glass}" stroke="${o.rim}" stroke-width="3"/>` +
    `<path d="M11.5 16.4 A10 10 0 0 1 16.4 11.5" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M13.5 23.5 A8.4 8.4 0 0 1 14.9 14.9" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6" stroke-linecap="round"/>` +
    `</svg>`
  );
}
