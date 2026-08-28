/**
 * 星星消消乐 · 视觉资产（1.3 视觉升级）。
 *
 * 全部是纯函数，只产出 SVG / HTML 字符串，不碰 DOM、不碰任何玩法状态：
 *  - starTokenSVG()：六色「星星家族」棋子。每颗 = 渐变五角星主体（顶亮）+ 深色描边 +
 *    左上高光斑 + 一张脸；六色各配微差形状（尖角星/心形/花形/圆角星/胖星/六芒星），
 *    形状+颜色双通道，色弱的孩子靠轮廓也分得清；
 *  - specialOverlaySVG()：四种特殊块图案（横向火箭腰带/纵向火箭腰带/炸弹圆/同类清皇冠），
 *    全部画进 SVG，不再是「emoji+emoji」双字符叠加；
 *  - rainbowStarSVG()：彩虹星 = 七彩渐变大星 + 白芯 + 皇冠，缓慢旋转（reduced 静止）；
 *  - gearSVG()：四种机关罩（冰晶/藤蔓/糖霜两档/砖缝高光），替换 emoji 角标；
 *  - themeClassOf()：背景按关卡段换主题（粉黄晨光 → 青绿森林 → 星夜）；
 *  - celebrationHTML()：过关三星仪式（三星逐颗砸下 + 星屑雨 ≤ 20，reduced 无雨）。
 *
 * 共享 art kit（src/art/kit/）还没建，按视觉宪法先落在本目录；建成后把这里换成 import。
 */

// ---------------------------------------------------------------------------
// 调色小工具
// ---------------------------------------------------------------------------

/** 把 #rrggbb 往白（amt>0）或黑（amt<0）方向调，越界自动夹回 */
export function shade(hex: string, amt: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const one = (v: number): number => {
    const t = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(t)));
  };
  const r = one((n >> 16) & 255);
  const g = one((n >> 8) & 255);
  const b = one(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// 星星家族：六色 × 六形 × 三款脸
// ---------------------------------------------------------------------------

export type StarShape = "sharp" | "heart" | "flower" | "round" | "chubby" | "burst";
export type StarFace = "smile" | "eyes" | "wink";

export interface StarStyle {
  /** 中文色名（读屏 / 文案想换叫法时用它，目前读屏仍钉死 emoji 名） */
  name: string;
  /** 主体色（渐变的中段） */
  base: string;
  shape: StarShape;
  face: StarFace;
}

/**
 * 与 index.ts 的 TOKENS 顺序对齐（0⭐ 1💖 2🍀 3🌙 4🍊），第 6 色留给将来。
 * 形状是第二辨识通道：同色深浅变化时轮廓仍互不相同。
 */
export const STAR_STYLES: StarStyle[] = [
  { name: "金黄", base: "#FFC93E", shape: "sharp", face: "eyes" },
  { name: "粉红", base: "#FF8FBE", shape: "heart", face: "smile" },
  { name: "嫩绿", base: "#63CC85", shape: "flower", face: "wink" },
  { name: "天蓝", base: "#6FA8DC", shape: "round", face: "smile" },
  { name: "橙橙", base: "#FFA35C", shape: "chubby", face: "eyes" },
  { name: "紫罗兰", base: "#B08CE8", shape: "burst", face: "wink" },
];

/** 星形多边形顶点（viewBox 32×32，中心 16,16，顶点朝上） */
function starPts(spikes: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let k = 0; k < spikes * 2; k++) {
    const r = k % 2 === 0 ? outerR : innerR;
    const a = (Math.PI * k) / spikes - Math.PI / 2;
    pts.push(`${(16 + r * Math.cos(a)).toFixed(2)},${(16.6 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** 六种主体轮廓：互不相同的 path / polygon（fill 与 stroke 由外面填） */
export function starBodyShape(shape: StarShape, fill: string, stroke: string): string {
  const attr = `fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"`;
  if (shape === "heart") {
    return `<path class="mst-body" d="M16 28.5 C7.5 22.5 3.5 17 5.5 11.5 C7 7.5 12 6 16 10.5 C20 6 25 7.5 26.5 11.5 C28.5 17 24.5 22.5 16 28.5 Z" ${attr}/>`;
  }
  const table: Record<Exclude<StarShape, "heart">, string> = {
    sharp: starPts(5, 13.6, 5.4),
    flower: starPts(8, 12.4, 9.6),
    round: starPts(5, 12.4, 7.2),
    chubby: starPts(5, 12.0, 8.4),
    burst: starPts(6, 13.0, 7.0),
  };
  return `<polygon class="mst-body" points="${table[shape]}" ${attr}/>`;
}

/** 三款脸：闭眼微笑 / 圆眼 / 眨眼，配一对小腮红 */
export function starFaceSVG(face: StarFace, ink: string): string {
  const blush =
    `<circle cx="10.6" cy="19.2" r="1.7" fill="#FF9FB6" opacity=".55"/>` +
    `<circle cx="21.4" cy="19.2" r="1.7" fill="#FF9FB6" opacity=".55"/>`;
  if (face === "smile") {
    return (
      `<g class="mst-face mst-face-smile">` +
      `<path d="M10.6 16.2 q1.6 1.8 3.2 0" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      `<path d="M18.2 16.2 q1.6 1.8 3.2 0" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      `<path d="M13.6 20.4 q2.4 2.2 4.8 0" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      blush + `</g>`
    );
  }
  if (face === "eyes") {
    return (
      `<g class="mst-face mst-face-eyes">` +
      `<circle cx="12.2" cy="16.4" r="1.7" fill="${ink}"/><circle cx="12.8" cy="15.8" r=".6" fill="#fff"/>` +
      `<circle cx="19.8" cy="16.4" r="1.7" fill="${ink}"/><circle cx="20.4" cy="15.8" r=".6" fill="#fff"/>` +
      `<path d="M14.2 20.4 q1.8 1.6 3.6 0" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      blush + `</g>`
    );
  }
  return (
    `<g class="mst-face mst-face-wink">` +
    `<circle cx="12.2" cy="16.4" r="1.7" fill="${ink}"/><circle cx="12.8" cy="15.8" r=".6" fill="#fff"/>` +
    `<path d="M18.2 16.4 q1.6 -1.6 3.2 0" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M13.8 20.2 q2.2 2.4 4.4 .2" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
    blush + `</g>`
  );
}

/** 左上高光斑：伪立体的唯一光源，方向全家统一 */
function glossSVG(): string {
  return `<ellipse class="mst-gloss" cx="11.6" cy="10.2" rx="2.8" ry="1.8" fill="#fff" opacity=".7" transform="rotate(-24 11.6 10.2)"/>`;
}

/** 主体渐变（顶亮 +15% 以上）：id 按色号取，重复出现内容一致，渲染无歧义 */
function gradDef(color: number, base: string): string {
  return (
    `<defs><linearGradient id="mstg${color}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${shade(base, 0.34)}"/>` +
    `<stop offset=".55" stop-color="${base}"/>` +
    `<stop offset="1" stop-color="${shade(base, -0.06)}"/>` +
    `</linearGradient></defs>`
  );
}

/**
 * 一颗普通棋子：渐变星主体 + 描边 + 高光 + 脸。
 * face / shape 不传就按色号查 STAR_STYLES（第二通道的默认分配）。
 */
export function starTokenSVG(color: number, face?: StarFace, shape?: StarShape): string {
  const st = STAR_STYLES[color] ?? STAR_STYLES[0];
  const useShape = shape ?? st.shape;
  const useFace = face ?? st.face;
  const ink = shade(st.base, -0.62);
  return (
    `<svg class="mst-star mst-star-${useShape}" viewBox="0 0 32 32" aria-hidden="true">` +
    gradDef(color, st.base) +
    starBodyShape(useShape, `url(#mstg${color})`, shade(st.base, -0.25)) +
    glossSVG() +
    starFaceSVG(useFace, ink) +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 特殊块：图案画进 SVG，不再是双 emoji 拼接
// ---------------------------------------------------------------------------

/** 1 横向火箭 / 2 纵向火箭 / 3 炸弹 / 4 同类清（皇冠，彩虹星戴） */
export type SpecialKind = 1 | 2 | 3 | 4;

/** 特殊块的叠加图案（一段 <g>，叠在主体之上） */
export function specialOverlaySVG(kind: SpecialKind): string {
  if (kind === 1) {
    // 横向消：星星戴左右箭头腰带
    return (
      `<g class="mst-ovl mst-ovl-h">` +
      `<rect x="3.5" y="13.6" width="25" height="5.6" rx="2.8" fill="#fff" opacity=".9"/>` +
      `<polygon points="4.2,16.4 9.6,13.2 9.6,19.6" fill="#7A5AA0"/>` +
      `<polygon points="27.8,16.4 22.4,13.2 22.4,19.6" fill="#7A5AA0"/>` +
      `<rect x="12.2" y="15.3" width="7.6" height="2.2" rx="1.1" fill="#7A5AA0" opacity=".85"/>` +
      `</g>`
    );
  }
  if (kind === 2) {
    // 纵向消：上下箭头腰带
    return (
      `<g class="mst-ovl mst-ovl-v">` +
      `<rect x="13.2" y="3.5" width="5.6" height="25" rx="2.8" fill="#fff" opacity=".9"/>` +
      `<polygon points="16,4.2 12.8,9.6 19.2,9.6" fill="#7A5AA0"/>` +
      `<polygon points="16,27.8 12.8,22.4 19.2,22.4" fill="#7A5AA0"/>` +
      `<rect x="14.9" y="12.2" width="2.2" height="7.6" rx="1.1" fill="#7A5AA0" opacity=".85"/>` +
      `</g>`
    );
  }
  if (kind === 3) {
    // 爆炸：圆润卡通炸弹的引线 + 火花点（主体由 tokenSVG 换成炸弹圆）
    return (
      `<g class="mst-ovl mst-ovl-bomb">` +
      `<path d="M18.5 8.2 q1.2 -3.4 4.6 -3.2" fill="none" stroke="#8C7B63" stroke-width="1.8" stroke-linecap="round"/>` +
      `<polygon points="23.1,1.4 24.2,3.6 26.6,4 24.9,5.7 25.3,8.1 23.1,7 21,8.1 21.4,5.7 19.7,4 22.1,3.6" fill="#FFD34D" stroke="#E8A400" stroke-width=".8"/>` +
      `</g>`
    );
  }
  // 同类清：星星戴皇冠
  return (
    `<g class="mst-ovl mst-ovl-crown">` +
    `<polygon points="9.6,8.6 10.8,3.4 13.6,6.4 16,2.4 18.4,6.4 21.2,3.4 22.4,8.6" fill="#FFD34D" stroke="#E8A400" stroke-width="1" stroke-linejoin="round"/>` +
    `<circle cx="13" cy="7" r=".9" fill="#FF8FBE"/><circle cx="19" cy="7" r=".9" fill="#6FA8DC"/>` +
    `</g>`
  );
}

/**
 * 一格棋子的完整 SVG：普通星 / 戴腰带的火箭星 / 炸弹圆。
 * `special` 取 board.ts 的编号（0 普通、1 横火箭、2 纵火箭、3 炸弹）。
 */
export function tokenSVG(color: number, special = 0): string {
  if (special === 3) {
    // 星星变炸弹圆：保住主色（辨色通道），圆润卡通、无写实爆炸
    const st = STAR_STYLES[color] ?? STAR_STYLES[0];
    const body = shade(st.base, -0.38);
    const ink = "#FFF6E8";
    return (
      `<svg class="mst-star mst-star-bomb mst-sp-3" viewBox="0 0 32 32" aria-hidden="true">` +
      `<circle cx="16" cy="18" r="10.6" fill="${body}" stroke="${shade(st.base, -0.58)}" stroke-width="1.8"/>` +
      `<circle cx="16" cy="18" r="10.6" fill="none" stroke="${st.base}" stroke-width="1.2" opacity=".5"/>` +
      `<ellipse cx="12" cy="13.6" rx="2.8" ry="1.8" fill="#fff" opacity=".55" transform="rotate(-24 12 13.6)"/>` +
      `<circle cx="12.6" cy="17.6" r="1.6" fill="${ink}"/><circle cx="19.4" cy="17.6" r="1.6" fill="${ink}"/>` +
      `<path d="M13.4 21.8 q2.6 2.2 5.2 0" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      specialOverlaySVG(3) +
      `</svg>`
    );
  }
  if (special === 1 || special === 2) {
    const st = STAR_STYLES[color] ?? STAR_STYLES[0];
    return (
      `<svg class="mst-star mst-star-${st.shape} mst-sp-${special}" viewBox="0 0 32 32" aria-hidden="true">` +
      gradDef(color, st.base) +
      starBodyShape(st.shape, `url(#mstg${color})`, shade(st.base, -0.25)) +
      glossSVG() +
      specialOverlaySVG(special) +
      `</svg>`
    );
  }
  return starTokenSVG(color);
}

/** 彩虹星：七彩渐变大星 + 白芯，戴同类清皇冠；主体缓慢旋转（reduced 静止） */
export function rainbowStarSVG(): string {
  return (
    `<svg class="mst-star mst-rainbowstar" viewBox="0 0 32 32" aria-hidden="true">` +
    `<defs><linearGradient id="mstrb" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#FF7E7E"/><stop offset=".18" stop-color="#FFB35C"/>` +
    `<stop offset=".36" stop-color="#FFE06A"/><stop offset=".54" stop-color="#7EDD8E"/>` +
    `<stop offset=".72" stop-color="#6FB5FF"/><stop offset=".9" stop-color="#B08CE8"/>` +
    `<stop offset="1" stop-color="#FF8FBE"/>` +
    `</linearGradient></defs>` +
    `<g class="mst-spin">` +
    `<polygon points="${starPts(5, 13.8, 6.4)}" fill="url(#mstrb)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="16" cy="16.6" r="4.2" fill="#fff" opacity=".92"/>` +
    `</g>` +
    specialOverlaySVG(4) +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 机关：绘制的冰 / 藤 / 霜 / 砖，替换 emoji 角标
// ---------------------------------------------------------------------------

export type GearKind = "ice" | "vine" | "frost1" | "frost2" | "brick";

/** 六向霜花（一朵雪花纹），糖霜两档共用 */
function flakeSVG(cx: number, cy: number, r: number, opacity: number): string {
  let arms = "";
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI * k) / 3;
    const x2 = (cx + r * Math.cos(a)).toFixed(2);
    const y2 = (cy + r * Math.sin(a)).toFixed(2);
    const mx = (cx + r * 0.62 * Math.cos(a)).toFixed(2);
    const my = (cy + r * 0.62 * Math.sin(a)).toFixed(2);
    const bx = (r * 0.28 * Math.cos(a + Math.PI / 2)).toFixed(2);
    const by = (r * 0.28 * Math.sin(a + Math.PI / 2)).toFixed(2);
    arms +=
      `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}"/>` +
      `<line x1="${mx}" y1="${my}" x2="${(Number(mx) + Number(bx)).toFixed(2)}" y2="${(Number(my) + Number(by)).toFixed(2)}"/>` +
      `<line x1="${mx}" y1="${my}" x2="${(Number(mx) - Number(bx)).toFixed(2)}" y2="${(Number(my) - Number(by)).toFixed(2)}"/>`;
  }
  return `<g stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity="${opacity}">${arms}<circle cx="${cx}" cy="${cy}" r="1.1" fill="#fff" stroke="none"/></g>`;
}

/** 一种机关的罩层 SVG（盖满整格，pointer-events 由 CSS 关掉） */
export function gearSVG(kind: GearKind): string {
  const open = `<svg class="mst-gearsvg mst-gear-${kind}" viewBox="0 0 32 32" preserveAspectRatio="none" aria-hidden="true">`;
  if (kind === "ice") {
    // 半透明冰晶罩：多边形冰面 + 白色裂角高光
    return (
      open +
      `<polygon points="2,6 10,2 22,2 30,6 30,26 22,30 10,30 2,26" fill="#CFEFFF" opacity=".58" stroke="#8ED2F2" stroke-width="1.6"/>` +
      `<polyline points="6,10 12,14 10,20" fill="none" stroke="#fff" stroke-width="1.4" opacity=".85" stroke-linecap="round"/>` +
      `<polyline points="24,8 20,13 25,18" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7" stroke-linecap="round"/>` +
      `<polygon points="4,7 11,3.4 8,9.4" fill="#fff" opacity=".5"/>` +
      `</svg>`
    );
  }
  if (kind === "vine") {
    // 绿藤缠绕角：两根曲线 + 叶片
    return (
      open +
      `<path d="M2 10 Q10 4 16 2.5" fill="none" stroke="#5FA765" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M29.5 16 Q28 25 22 29.5" fill="none" stroke="#5FA765" stroke-width="2.4" stroke-linecap="round"/>` +
      `<ellipse cx="7.5" cy="6.4" rx="3.1" ry="1.7" fill="#7CC97F" transform="rotate(-28 7.5 6.4)"/>` +
      `<ellipse cx="13" cy="3.6" rx="2.5" ry="1.4" fill="#93D896" transform="rotate(-14 13 3.6)"/>` +
      `<ellipse cx="27.6" cy="22" rx="3.1" ry="1.7" fill="#7CC97F" transform="rotate(64 27.6 22)"/>` +
      `<ellipse cx="24.6" cy="27.2" rx="2.5" ry="1.4" fill="#93D896" transform="rotate(46 24.6 27.2)"/>` +
      `</svg>`
    );
  }
  if (kind === "frost1") {
    return open + flakeSVG(16, 16, 9.5, 0.85) + `</svg>`;
  }
  if (kind === "frost2") {
    // 双层：中央大霜花 + 角上小霜花，比单层更密
    return open + flakeSVG(16, 16, 10.5, 0.95) + flakeSVG(26, 6, 4.5, 0.8) + flakeSVG(6, 26, 4.5, 0.8) + `</svg>`;
  }
  // 砖：条纹底子由 CSS 保留，这里补砖缝高光，去掉 emoji 角标
  return (
    open +
    `<g stroke="#E8DCC8" stroke-width="1.1" opacity=".65">` +
    `<line x1="1" y1="10.5" x2="31" y2="10.5"/><line x1="1" y1="21.5" x2="31" y2="21.5"/>` +
    `<line x1="10.5" y1="1" x2="10.5" y2="10.5"/><line x1="21.5" y1="10.5" x2="21.5" y2="21.5"/>` +
    `<line x1="10.5" y1="21.5" x2="10.5" y2="31"/>` +
    `</g>` +
    `<line x1="2" y1="2.4" x2="30" y2="2.4" stroke="#fff" stroke-width="1.4" opacity=".4"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 关卡主题查表 & 过关仪式
// ---------------------------------------------------------------------------

/** 背景按关卡段换主题：0 基关号 → 粉黄晨光 / 青绿森林 / 星夜 */
export function themeClassOf(level: number): string {
  if (level < 63) return "mst-theme-dawn";
  if (level < 126) return "mst-theme-forest";
  return "mst-theme-night";
}

/** 星屑雨的颜色轮换表（确定性，测试可复现） */
const RAIN_COLORS = ["#FFC93E", "#FF8FBE", "#63CC85", "#6FA8DC", "#B08CE8"];

/**
 * 过关三星仪式的内层 HTML：三颗星逐颗砸下（0.15s 间隔、easeOutBack 由 CSS 给）+
 * 星屑雨 ≤ 20 粒。`reduced` 时星星静止直亮、雨为 0。纯函数，位置与延迟全部确定性。
 */
export function celebrationHTML(stars: number, reduced: boolean): string {
  const got = Math.max(1, Math.min(3, Math.round(stars)));
  const slots = [0, 1, 2]
    .map((k) => {
      const lit = k < got;
      const delay = reduced ? 0 : k * 0.15;
      return (
        `<span class="mst-cheer-star${lit ? " mst-lit" : " mst-dim"}" style="animation-delay:${delay.toFixed(2)}s">` +
        starTokenSVG(lit ? 0 : 5) +
        `</span>`
      );
    })
    .join("");
  let rain = "";
  if (!reduced) {
    for (let k = 0; k < 20; k++) {
      const left = (k * 37 + 11) % 100;
      const delay = ((k * 53) % 40) / 100;
      const color = RAIN_COLORS[k % RAIN_COLORS.length];
      rain +=
        `<span class="mst-rain" style="left:${left}%;animation-delay:${delay.toFixed(2)}s;background:${color}"></span>`;
    }
  }
  return `<div class="mst-cheer-row">${slots}</div>${rain}`;
}
