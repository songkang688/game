/**
 * 1.3 共享美术套件 · 小火车部件（纯字符串 SVG，不碰 DOM）。
 *
 * 第 24 步 C 档（pinyin-train）首建，一个文件只归一个人，这一份归 pinyin-train。
 * 参数化 车头 / 车厢 / 透视轨道 / 白烟 / 车票锯齿，全部纯函数、零依赖、输出确定，
 * node 环境可直接断言；调用方 innerHTML 即用。
 *
 * 造型红线：车头是本库粉彩原创——圆头锅炉 + 烟囱 + 排障器 + 大圆灯 + 驾驶室方窗，
 * 允许两条笑眼弯线，但**没有立体人脸浮雕**（根节点钉着 data-face="none"，
 * 不给车头画鼻子嘴巴照搬托马斯）。
 *
 * 声调正字法红线：车厢侧面的音节逐字符原样输出（只包 tspan 上色，不增删改字符），
 * 带调号的那个字母用 toneRed 加粗——颜色是助记通道，正字法一个字符都不动。
 */

/** 4.1 配色板：车头 / 车厢 / 三色助记 / 轨道 / 白烟 */
export const TRAIN_COLORS = {
  /** 车头锅炉主色 */
  locoRed: "#e8574e",
  /** 车头描边阴影 */
  locoRedDark: "#b93f38",
  /** 车厢车身底色 */
  carriageCream: "#fff4dd",
  /** 声母车票 / 车厢牌 */
  initialOrange: "#ff9f43",
  /** 韵母车票 / 车厢牌 */
  finalTeal: "#2ec4b6",
  /** 整体认读车票 */
  wholePurple: "#9b6dd6",
  /** 声调符号加粗色 */
  toneRed: "#e63946",
  /** 铁轨双线 */
  railGray: "#8d99ae",
  /** 枕木 */
  sleeperBrown: "#a06b3a",
  /** 烟囱白烟圈 */
  steamWhite: "rgba(255,255,255,.85)",
} as const;

/** 车厢 / 车票的语法类别：声母 / 韵母 / 整体认读 / 声调 / 其它（汉字词等） */
export type CarriageKind = "initial" | "final" | "whole" | "tone" | "plain";

/** 类别 → 助记色（颜色即语法） */
export function kindColor(kind: CarriageKind): string {
  switch (kind) {
    case "initial":
      return TRAIN_COLORS.initialOrange;
    case "final":
      return TRAIN_COLORS.finalTeal;
    case "whole":
      return TRAIN_COLORS.wholePurple;
    case "tone":
      return TRAIN_COLORS.toneRed;
    default:
      return TRAIN_COLORS.railGray;
  }
}

/**
 * 二十四个带调号的元音字形（ā á ǎ à ／ ō…ǜ）。
 * 只做**显示层**的「哪个字符戴着调号」检测，拼写规则永远归游戏侧 pinyin.ts。
 */
const TONED_CHARS = "āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ";

/** 音节里第一个戴调号的字符下标（没有返回 -1） */
export function tonedCharIndex(syllable: string): number {
  const chars = Array.from(String(syllable ?? ""));
  for (let i = 0; i < chars.length; i++) {
    if (TONED_CHARS.includes(chars[i])) return i;
  }
  return -1;
}

const INK = "#4a4460";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanPrefix(p: string | undefined, fallback: string): string {
  return (p ?? fallback).replace(/[^a-zA-Z0-9_-]/g, "");
}

/** 一只车轮：外圈深灰 + 内毂亮灰 + 辐条 4 根 */
function wheel(cx: number, cy: number, r: number): string {
  const hub = (r * 0.34).toFixed(1);
  const spokes = [0, 45, 90, 135]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const dx = (Math.cos(rad) * (r - 1.6)).toFixed(1);
      const dy = (Math.sin(rad) * (r - 1.6)).toFixed(1);
      return `<line x1="${(cx - Number(dx)).toFixed(1)}" y1="${(cy - Number(dy)).toFixed(1)}" x2="${(cx + Number(dx)).toFixed(1)}" y2="${(cy + Number(dy)).toFixed(1)}" stroke="#9aa0ad" stroke-width="1.4"/>`;
    })
    .join("");
  return (
    `<g class="kit-train-wheel">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#474956" stroke="#2f3038" stroke-width="1.6"/>` +
    spokes +
    `<circle cx="${cx}" cy="${cy}" r="${hub}" fill="#d7dbe2" stroke="#9aa0ad" stroke-width="1"/>` +
    `</g>`
  );
}

/**
 * 车头（侧视朝右，viewBox 120×84）。
 * 部件齐全且各有类名可断言：锅炉 kit-train-boiler、烟囱 kit-train-chimney、
 * 排障器 kit-train-cowcatcher、大圆灯 kit-train-lamp、驾驶室 kit-train-cab、
 * 车轮 kit-train-wheel ×2、挂钩 kit-train-hook。
 * 笑眼是两条弯线（kit-train-eye），根节点 data-face="none"——无人脸浮雕。
 */
export function loco(size = 120, idPrefix?: string): string {
  const w = Number.isFinite(size) && size > 0 ? size : 120;
  const h = (w * 84) / 120;
  const pre = cleanPrefix(idPrefix, "kitLoco");
  const C = TRAIN_COLORS;
  return (
    `<svg viewBox="0 0 120 84" width="${w.toFixed(1)}" height="${h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-face="none" class="kit-train-loco">` +
    `<defs>` +
    `<linearGradient id="${pre}-boiler" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#f47c74"/><stop offset=".55" stop-color="${C.locoRed}"/><stop offset="1" stop-color="${C.locoRedDark}"/>` +
    `</linearGradient>` +
    `</defs>` +
    // 底盘 + 挂钩短杆（在车尾，车厢往左挂）
    `<rect x="12" y="52" width="98" height="10" rx="4" fill="${C.locoRedDark}" stroke="#8f2f29" stroke-width="1.4"/>` +
    `<g class="kit-train-hook"><line x1="12" y1="57" x2="2" y2="57" stroke="#5b5560" stroke-width="3.4" stroke-linecap="round"/><circle cx="2.6" cy="57" r="2.6" fill="#5b5560"/></g>` +
    // 排障器：三角裙板 + 两道横档
    `<g class="kit-train-cowcatcher"><path d="M104 54 L118 76 L94 76 Z" fill="${C.locoRedDark}" stroke="#8f2f29" stroke-width="1.4"/><line x1="100" y1="66" x2="113" y2="66" stroke="#f0b9b4" stroke-width="1.6"/><line x1="97" y1="71" x2="116" y2="71" stroke="#f0b9b4" stroke-width="1.6"/></g>` +
    // 驾驶室：方窗 + 圆角屋顶
    `<g class="kit-train-cab">` +
    `<rect x="14" y="20" width="32" height="34" rx="4" fill="${C.locoRed}" stroke="${C.locoRedDark}" stroke-width="2"/>` +
    `<rect x="10" y="15" width="40" height="8" rx="4" fill="${C.locoRedDark}"/>` +
    `<rect x="20" y="27" width="15" height="13" rx="3" fill="#cdeefb" stroke="${C.locoRedDark}" stroke-width="1.6" class="kit-train-window"/>` +
    `</g>` +
    // 圆头锅炉：纵向渐变 + 左上高光弧 + 金色箍环
    `<g class="kit-train-boiler">` +
    `<rect x="44" y="26" width="60" height="30" rx="15" fill="url(#${pre}-boiler)" stroke="${C.locoRedDark}" stroke-width="2"/>` +
    `<path d="M50 32 Q60 27 72 28" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".55" class="kit-train-shine"/>` +
    `<rect x="93" y="25" width="7" height="32" rx="3" fill="#f2b705" stroke="#c69104" stroke-width="1.2"/>` +
    // 笑眼弯线两条：独立造型，不是人脸浮雕
    `<path d="M62 40 q3 3.4 6 0" fill="none" stroke="#7c2620" stroke-width="2" stroke-linecap="round" class="kit-train-eye"/>` +
    `<path d="M74 40 q3 3.4 6 0" fill="none" stroke="#7c2620" stroke-width="2" stroke-linecap="round" class="kit-train-eye"/>` +
    `</g>` +
    // 烟囱：顶口外扩
    `<path class="kit-train-chimney" d="M82 26 L84 12 L80 12 Q78 12 78 9 L78 8 Q78 6 80 6 L94 6 Q96 6 96 8 L96 9 Q96 12 94 12 L90 12 L92 26 Z" fill="#5b5560" stroke="#3f3a48" stroke-width="1.4"/>` +
    // 蒸汽小圆顶
    `<path d="M60 26 Q66 18 72 26 Z" fill="${C.locoRedDark}"/>` +
    // 大圆灯：金色 + 白高光点
    `<g class="kit-train-lamp"><circle cx="106" cy="40" r="6.5" fill="#ffd166" stroke="#c69104" stroke-width="1.6"/><circle cx="104" cy="38" r="1.9" fill="#ffffff"/></g>` +
    wheel(34, 66, 13) +
    wheel(66, 68, 10) +
    wheel(92, 68, 10) +
    `</svg>`
  );
}

/**
 * 车厢（viewBox 96×72）：圆角车身（奶油底）+ 语法类别色顶边条 + 侧面音节大字
 * （戴调号的字母 toneRed 加粗）+ 双轮 + 前后挂钩短杆。
 * 音节文字逐字符原样进 tspan，textContent 不增不减——正字法钉死。
 */
export function carriage(syllable: string, kind: CarriageKind, size = 96, idPrefix?: string): string {
  const w = Number.isFinite(size) && size > 0 ? size : 96;
  const h = (w * 72) / 96;
  const pre = cleanPrefix(idPrefix, "kitCar");
  const C = TRAIN_COLORS;
  const band = kindColor(kind);
  const chars = Array.from(String(syllable ?? ""));
  const toneAt = tonedCharIndex(syllable);
  const fontSize = chars.length >= 5 ? 19 : chars.length >= 4 ? 22 : 26;
  const text = chars
    .map((ch, i) =>
      i === toneAt
        ? `<tspan fill="${C.toneRed}" font-weight="900" class="kit-train-tonechar">${esc(ch)}</tspan>`
        : `<tspan>${esc(ch)}</tspan>`
    )
    .join("");
  return (
    `<svg viewBox="0 0 96 72" width="${w.toFixed(1)}" height="${h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" overflow="visible" class="kit-train-carriage" data-kind="${kind}">` +
    // 前后挂钩短杆：车厢彼此挂成一列
    `<g class="kit-train-hook"><line x1="90" y1="52" x2="96" y2="52" stroke="#5b5560" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="52" x2="6" y2="52" stroke="#5b5560" stroke-width="3" stroke-linecap="round"/><circle cx="95" cy="52" r="2.2" fill="#5b5560"/></g>` +
    // 车身：奶油底 + 深棕描边
    `<rect x="6" y="14" width="84" height="42" rx="9" fill="${C.carriageCream}" stroke="#a58a5f" stroke-width="2" class="kit-train-body"/>` +
    // 语法类别色顶边条（id 隔离的圆角裁切）
    `<defs><clipPath id="${pre}-band"><rect x="6" y="14" width="84" height="42" rx="9"/></clipPath></defs>` +
    `<rect x="6" y="14" width="84" height="10" fill="${band}" clip-path="url(#${pre}-band)" class="kit-train-band"/>` +
    // 音节大字：overflow visible，调号不裁切
    `<text x="48" y="46" text-anchor="middle" font-size="${fontSize}" font-weight="800" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif" fill="${INK}" overflow="visible" class="kit-train-syllable">${text}</text>` +
    wheel(28, 61, 8) +
    wheel(68, 61, 8) +
    `</svg>`
  );
}

/**
 * 枕木横坐标：从近处（x0）向灭点按 `ratio` 等比递减的间距铺过去。
 * 第 k 格间距 = gap0 · ratio^k —— 2.5D 纵深就是这一串数。
 */
export function sleeperXs(count: number, x0: number, gap0: number, ratio = 0.85): number[] {
  const n = Math.max(0, Math.floor(count));
  const out: number[] = [];
  let x = x0;
  let gap = gap0;
  for (let i = 0; i < n; i++) {
    out.push(Number(x.toFixed(2)));
    x += gap;
    gap *= ratio;
  }
  return out;
}

export interface RailwayOpts {
  /** 画布宽（近端在左、灭点在右） */
  width: number;
  height: number;
  /** 灭点（默认在右上 92% 宽、22% 高——隧道口） */
  vanishX?: number;
  vanishY?: number;
  /** 枕木根数 */
  sleepers?: number;
  /** 间距等比（默认 0.85） */
  ratio?: number;
}

/**
 * 透视轨道：双线向右收窄到灭点，枕木随距离变密变短。
 * 返回一段 `<g>`，调用方拼进自己的场景 SVG。
 */
export function railway(opts: RailwayOpts): string {
  const W = opts.width;
  const H = opts.height;
  const vx = opts.vanishX ?? W * 0.92;
  const vy = opts.vanishY ?? H * 0.22;
  const ratio = opts.ratio ?? 0.85;
  const count = opts.sleepers ?? 9;
  const C = TRAIN_COLORS;
  // 近端两条钢轨的锚点（左下）
  const aY = H - 4;
  const bY = H - 16;
  const at = (x: number, y0: number): number => y0 + ((vy - y0) * x) / (vx || 1);
  const xs = sleeperXs(count, 6, (vx - 6) * 0.24, ratio);
  const sleepers = xs
    .filter((x) => x < vx - 8)
    .map((x) => {
      const t = x / (vx || 1);
      const yTop = at(x, bY);
      const yBot = at(x, aY);
      const wSleeper = Math.max(1.2, 5 * (1 - t));
      return `<line class="kit-rail-sleeper" x1="${x.toFixed(1)}" y1="${(yBot + 2 * (1 - t)).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(yTop - 2 * (1 - t)).toFixed(1)}" stroke="${C.sleeperBrown}" stroke-width="${wSleeper.toFixed(1)}"/>`;
    })
    .join("");
  return (
    `<g class="kit-railway" aria-hidden="true">` +
    sleepers +
    `<line class="kit-rail-line" x1="0" y1="${aY}" x2="${vx.toFixed(1)}" y2="${vy.toFixed(1)}" stroke="${C.railGray}" stroke-width="3"/>` +
    `<line class="kit-rail-line" x1="0" y1="${bY}" x2="${vx.toFixed(1)}" y2="${vy.toFixed(1)}" stroke="${C.railGray}" stroke-width="2.2"/>` +
    `</g>`
  );
}

/**
 * 一朵白烟：三档大小圆（r=4/6/8），沿烟囱上方贝塞尔漂移放大淡出交给调用方 CSS。
 */
export function steamPuff(): string {
  const C = TRAIN_COLORS;
  return (
    `<g class="kit-steam-puff" aria-hidden="true">` +
    `<circle class="kit-steam-c1" cx="0" cy="0" r="4" fill="${C.steamWhite}"/>` +
    `<circle class="kit-steam-c2" cx="-5" cy="-9" r="6" fill="${C.steamWhite}"/>` +
    `<circle class="kit-steam-c3" cx="3" cy="-19" r="8" fill="${C.steamWhite}"/>` +
    `</g>`
  );
}

/**
 * 车票锯齿 clip-path：左右两条竖边各 `teeth` 个锯齿的 `polygon(...)`（百分比坐标）。
 * 配 CSS `clip-path` 即得车票裁形；左侧圆孔由调用方叠一个圆点伪元素。
 */
export function ticketZigzag(teeth = 7, depth = 4): string {
  const n = Math.max(2, Math.floor(teeth));
  const d = Math.max(1, Math.min(12, depth));
  const pts: string[] = [];
  // 顶边（左→右）
  pts.push(`${d}% 0%`, `${100 - d}% 0%`);
  // 右边（上→下）锯齿
  for (let i = 0; i < n; i++) {
    const y0 = (i / n) * 100;
    const y1 = ((i + 1) / n) * 100;
    pts.push(`${100 - d}% ${y0.toFixed(1)}%`, `100% ${((y0 + y1) / 2).toFixed(1)}%`, `${100 - d}% ${y1.toFixed(1)}%`);
  }
  // 底边（右→左）
  pts.push(`${d}% 100%`);
  // 左边（下→上）锯齿
  for (let i = n - 1; i >= 0; i--) {
    const y0 = ((i + 1) / n) * 100;
    const y1 = (i / n) * 100;
    pts.push(`${d}% ${y0.toFixed(1)}%`, `0% ${((y0 + y1) / 2).toFixed(1)}%`, `${d}% ${y1.toFixed(1)}%`);
  }
  return `polygon(${pts.join(", ")})`;
}
