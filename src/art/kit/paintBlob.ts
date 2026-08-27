/**
 * 共享美术套件 · 颜料坨与画室木件（1.3 视觉升级 · 窗口8 第 26 步 A 档新增，独占文件，归 color-fun）。
 *
 * 约定：一个文件只归一个人，这一份归 color-fun（A 档）。
 * 全部是纯函数 + 常量，node 环境可测，不碰 DOM、不开计时器、无位图、无运行时依赖。
 *
 * 「纯色圆钮 → 颜料坨」的工序单（对应绘制规格 4.2）：
 *  ① 坨体：径向渐变（中心提亮 20% → 边缘本色），底色一层不动，叠层全走 background-image，
 *     调用方原来的 style.background 仍旧是那个 hex（既有断言零改动）；
 *  ② 高光：顶部偏左一枚白点（直径 = 坨径 30%）；
 *  ③ 阴影：底部一道挤压阴影弧（颜料被挤在木板上的那种下坠感）；
 *  ④ 木板：椭圆木质调色盘（木纹弧线 + 拇指孔 + 2px 深色描边）；
 *  ⑤ 画笔：笔尖蘸当前色的小画笔 SVG，选中哪坨笔尖就换哪色。
 */
import { shade } from "./palette";

/** 画室与调色盘的色板 token（规格 4.1 钉死的色值） */
export const STUDIO_TOKENS = {
  /** 调色盘木板 */
  paletteWood: "#d9a066",
  /** 木板边缘描边 / 深木纹 */
  paletteWoodDark: "#a06b3a",
  /** 颜料坨顶部高光点 */
  blobHighlight: "rgba(255,255,255,.55)",
  /** 颜料坨底部挤压阴影 */
  blobShadow: "rgba(0,0,0,.14)",
  /** 画架三脚与画框 */
  easelWood: "#c98d54",
  /** 画室墙面 */
  studioWall: "#f8f1e7",
  /** 画室地板线 */
  studioFloor: "#e6d8c4",
  /** 窗口透光斜带 */
  sunBeam: "rgba(255,233,168,.35)",
  /** 展墙射灯光晕 */
  galleryLight: "rgba(255,246,214,.5)",
  /** 选中颜料坨外圈亮环 */
  pickRing: "#ff8c42",
} as const;

/** 颜料坨最小直径（手指友好，规格第七节） */
export const BLOB_MIN_PX = 36;
/** 选中时坨体下沉的像素（规格 4.2 第 3 步） */
export const BLOB_SINK_PX = 2;
/** 高光点直径 = 坨径的 30%（规格 4.2 第 2 步） */
export const BLOB_HIGHLIGHT_RATIO = 0.3;
/** 中心提亮的百分比（径向渐变中心 → 边缘本色） */
export const BLOB_LIGHTEN_PCT = 20;
/** 颜料涟漪铺开时长（动效时序表第 1 行） */
export const RIPPLE_MS = 180;

/**
 * 颜料坨的叠层背景（background-image 一条字符串，逗号分层、上层在前）：
 * 顶部偏左高光点（直径 30%）→ 底部挤压阴影弧 → 径向渐变主体（中心提亮 20% → 边缘本色）。
 * 底色那层 style.background 留给调用方自己铺，坨体叠在上面——解析不了的 hex 也照样给得出叠层。
 */
export function blobLayers(hex: string): string {
  const lit = shade(hex, BLOB_LIGHTEN_PCT);
  const stop = Math.round((BLOB_HIGHLIGHT_RATIO * 100) / 2);
  return [
    `radial-gradient(circle at 34% 26%,${STUDIO_TOKENS.blobHighlight} 0 ${stop}%,rgba(255,255,255,0) ${stop + 1}%)`,
    `radial-gradient(ellipse at 50% 118%,${STUDIO_TOKENS.blobShadow} 0 42%,rgba(0,0,0,0) 43%)`,
    `radial-gradient(circle at 38% 32%,${lit} 0%,${hex} 72%)`,
  ].join(",");
}

/** 类名前缀只许字母与连字符，清洗后为空就落回 kit（跟 sparkle.ts / gem.ts 同规矩） */
function safePrefix(prefix: string): string {
  return prefix.replace(/[^a-z-]/gi, "") || "kit";
}

/**
 * 木质椭圆调色盘 CSS：`.{p}-board` 一族。
 * 木色底 + 三条弧形木纹线（repeating-radial-gradient 画的，不加子节点）+
 * 左端拇指孔圆洞 + 2px 深色描边；圆角收成长椭圆，孩子一眼认出「这是画画的木板」。
 * 只加皮肤：不写 width / height / min-*，装在里面的色块热区一个像素不动。
 */
export function paletteBoardCss(prefix: string): string {
  const p = safePrefix(prefix);
  const { paletteWood, paletteWoodDark } = STUDIO_TOKENS;
  return `
.${p}-board{border:2px solid ${paletteWoodDark};border-radius:999px;box-sizing:border-box;
  background:radial-gradient(circle at 9% 34%,${paletteWoodDark} 0 7px,rgba(0,0,0,.28) 7px 8px,rgba(0,0,0,0) 9px),
    repeating-radial-gradient(ellipse at 14% 50%,rgba(160,107,58,0) 0 13px,rgba(160,107,58,.22) 13px 14.5px,rgba(160,107,58,0) 14.5px 30px),
    linear-gradient(${shade(paletteWood, 8)},${paletteWood});
  box-shadow:0 4px 0 rgba(120,80,40,.32),inset 0 2px 0 rgba(255,255,255,.35);}
`;
}

/**
 * 画笔小图标 SVG（viewBox 0 0 32 32，尺寸由外层容器定）：
 * 木杆 + 银箍 + 蘸了 `tipColor` 的笔毛——选中哪坨颜料，笔尖就是哪个颜色。
 * 笔毛挂着 `kit-brush-tip` 类，调用方想只换色不重画也找得到它。
 */
export function brushDipSVG(tipColor: string): string {
  const wood = STUDIO_TOKENS.easelWood;
  return (
    `<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">` +
    `<line x1="26" y1="4" x2="17" y2="14.6" stroke="${shade(wood, -12)}" stroke-width="5.6" stroke-linecap="round"/>` +
    `<line x1="25.4" y1="4.4" x2="17" y2="14.2" stroke="${wood}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<line x1="16.6" y1="15" x2="13.9" y2="18.2" stroke="#9aa0a6" stroke-width="6" stroke-linecap="round"/>` +
    `<path class="kit-brush-tip" d="M13.6 17.4 Q10 20.4 6.4 25.8 Q9.8 24.8 12.2 22.8 Q14.6 20.8 15.8 19.6 Z"` +
    ` fill="${tipColor}" stroke="rgba(0,0,0,.14)" stroke-width=".6"/>` +
    `</svg>`
  );
}

/**
 * 颜料滴角标的轮廓路径（尖尾朝上的水滴：圆 + 两条贝塞尔收到尖点）。
 * `(cx, cy)` 是滴身圆心、`r` 是圆半径，尖点在 `cy - 1.8r`。
 * 只产出 path 的 d 字符串，描边色（= 目标色的双通道助记）由调用方挂。
 */
export function dropBadgePath(cx: number, cy: number, r: number): string {
  const n = (v: number): string => String(Number(v.toFixed(1)));
  const tipY = cy - r * 1.8;
  return (
    `M${n(cx)} ${n(tipY)}` +
    ` C${n(cx + r * 0.55)} ${n(cy - r * 1.25)} ${n(cx + r)} ${n(cy - r * 0.55)} ${n(cx + r)} ${n(cy)}` +
    ` A${n(r)} ${n(r)} 0 1 1 ${n(cx - r)} ${n(cy)}` +
    ` C${n(cx - r)} ${n(cy - r * 0.55)} ${n(cx - r * 0.55)} ${n(cy - r * 1.25)} ${n(cx)} ${n(tipY)}` +
    ` Z`
  );
}

/** 涟漪要铺满 `w × h` 的包围盒时的半径（= 对角线长，向上取整） */
export function rippleRadius(w: number, h: number): number {
  const a = Number.isFinite(w) ? Math.abs(w) : 0;
  const b = Number.isFinite(h) ? Math.abs(h) : 0;
  return Math.ceil(Math.hypot(a, b));
}

/**
 * 从点击点 `(cx, cy)` 铺到区域包围盒最远角要走的半径。
 * 点在盒内时 ≤ 对角线全长；量出来是 0（退化盒）也至少给 4，涟漪不至于看不见。
 */
export function rippleReach(
  cx: number,
  cy: number,
  box: { x: number; y: number; width: number; height: number }
): number {
  let far = 0;
  for (const x of [box.x, box.x + box.width]) {
    for (const y of [box.y, box.y + box.height]) {
      far = Math.max(far, Math.hypot(x - cx, y - cy));
    }
  }
  return Math.max(4, Math.ceil(far));
}
