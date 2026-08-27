/**
 * 星星合成 · 1.3 视觉素材(纯函数,零依赖)。
 *
 * 共享 art kit(`src/art/kit/`)未合入前,按 visual-bible 的口径把本款的
 * 绘制函数收在这一个文件里:星级角标、障碍花、奖杯都是内联 SVG 字符串,
 * 不引外部图片、不用 emoji,离线可用且不膨胀包体。
 * 这里只有「怎么画」,没有任何玩法数值。
 */

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number): string => clamp255(n).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** 把 #rrggbb 往白色方向提亮 amount(0–1) */
export function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** 把 #rrggbb 往黑色方向压暗 amount(0–1) */
export function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * 块面的对角渐变:左上提亮、右下压一点,再配上外面的深色厚度边,
 * 平涂色纸就变成有体积的「宝石面」。基调仍是 `tileColors` 的马卡龙色表。
 */
export function tileFaceCSS(bg: string): string {
  return `linear-gradient(135deg,${lightenHex(bg, 0.14)} 0%,${bg} 55%,${darkenHex(bg, 0.06)} 100%)`;
}

/**
 * 数值 → 星级档位。颜色、圈粗之外的第三条辨识通道:
 * 2/4 无星,8/16 铜星,32/64 银星,128/256 金星,512/1024 双金星,2048+ 彩虹星。
 */
export function starTier(value: number): number {
  if (value >= 2048) return 5;
  if (value >= 512) return 4;
  if (value >= 128) return 3;
  if (value >= 32) return 2;
  if (value >= 8) return 1;
  return 0;
}

/** 星级的叫法,给里程碑卡用 */
export const STAR_TIER_NAMES = ["无星", "铜星", "银星", "金星", "双金星", "彩虹星"] as const;

/** 24×24 视窗里的五角星顶点(外径 11、内径 4.6,朝上) */
const STAR_PTS = "12,1 14.7,8.3 22.5,8.6 16.4,13.4 18.5,20.9 12,16.6 5.5,20.9 7.6,13.4 1.5,8.6 9.3,8.3";

/** 铜 / 银 / 金三档的 [填充, 描边];彩虹档单独走渐变 */
const STAR_SKINS: Record<number, [string, string]> = {
  1: ["#E09A5F", "#A96A34"],
  2: ["#DCE3EC", "#93A2B5"],
  3: ["#FFD75E", "#D9A520"],
  4: ["#FFD75E", "#D9A520"]
};

/**
 * 星级角标:一颗带描边与高光点的五角星。
 * tier 4 画成两颗叠在一起的金星,tier 5 是彩虹渐变星;tier 0 没有星,返回空串。
 */
export function starBadgeSVG(tier: number, size = 16): string {
  if (tier <= 0) return "";
  const head = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">`;
  const shine = `<circle cx="9.4" cy="7.6" r="1.5" fill="#FFFFFF" opacity=".85"/>`;
  if (tier >= 5) {
    return (
      head +
      `<defs><linearGradient id="mgrb" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#FF8A80"/><stop offset=".25" stop-color="#FFD75E"/>` +
      `<stop offset=".5" stop-color="#8CE99A"/><stop offset=".75" stop-color="#74C0FC"/>` +
      `<stop offset="1" stop-color="#D0A9F5"/></linearGradient></defs>` +
      `<polygon points="${STAR_PTS}" fill="url(#mgrb)" stroke="#8A6A16" stroke-width="1.2" stroke-linejoin="round"/>` +
      shine +
      `</svg>`
    );
  }
  const [fill, edge] = STAR_SKINS[Math.min(4, tier)];
  const star = `<polygon points="${STAR_PTS}" fill="${fill}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"/>`;
  if (tier === 4) {
    return (
      head +
      `<g transform="translate(-1,1) scale(.8)">${star}</g>` +
      `<g transform="translate(7,6) scale(.62)">${star}</g>` +
      shine +
      `</svg>`
    );
  }
  return head + star + shine + `</svg>`;
}

/**
 * 障碍花:5 瓣粉花 + 黄芯高光 + 两片叶,替换掉跨平台不可控的系统 emoji。
 * 尺寸由调用方按格子大小传进来。
 */
export function flowerSVG(size = 20): string {
  const petals = [0, 72, 144, 216, 288]
    .map(
      (deg) =>
        `<ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" fill="#F48FB1" stroke="#DB6E96" stroke-width=".8" transform="rotate(${deg} 12 11)"/>`
    )
    .join("");
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    `<ellipse cx="6.2" cy="20" rx="3.6" ry="1.7" fill="#7FBF6A" transform="rotate(-22 6.2 20)"/>` +
    `<ellipse cx="17.8" cy="20" rx="3.6" ry="1.7" fill="#5F9E4C" transform="rotate(22 17.8 20)"/>` +
    petals +
    `<circle cx="12" cy="11" r="3.4" fill="#FFCF4D" stroke="#D9A520" stroke-width=".9"/>` +
    `<circle cx="10.9" cy="9.9" r="1.1" fill="#FFF3C8"/>` +
    `</svg>`
  );
}

/** 结算面板的小金杯:杯身渐层高光 + 双耳 + 底座 + 杯面一颗小星 */
export function trophySVG(size = 48): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    `<path d="M5 3.5h14v5.5a7 7 0 0 1-14 0z" fill="#FFD75E" stroke="#D9A520" stroke-width="1.1"/>` +
    `<path d="M5 4.5H2.6a.9.9 0 0 0-.9.9c0 2.8 1.7 4.6 3.9 5.1" fill="none" stroke="#D9A520" stroke-width="1.3"/>` +
    `<path d="M19 4.5h2.4a.9.9 0 0 1 .9.9c0 2.8-1.7 4.6-3.9 5.1" fill="none" stroke="#D9A520" stroke-width="1.3"/>` +
    `<rect x="10.4" y="15.4" width="3.2" height="2.6" fill="#E8B93C"/>` +
    `<rect x="7.2" y="18" width="9.6" height="2.6" rx="1" fill="#B8812F"/>` +
    `<polygon points="12,6 12.9,8.4 15.4,8.5 13.4,10 14.1,12.4 12,11 9.9,12.4 10.6,10 8.6,8.5 11.1,8.4" fill="#FFF6DA"/>` +
    `<circle cx="8.6" cy="6.4" r="1.2" fill="#FFF3C8" opacity=".9"/>` +
    `</svg>`
  );
}
