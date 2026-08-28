// 数独花田的绘制资产:全部是「字符串进、SVG 字符串出」的纯函数,不碰 DOM、不碰全局。
// visual-bible 口径:收集物三阶光影(底色 + 暗部 + 高光)、全矢量代码化、不引位图。
// 注意:这些 SVG 会以 innerHTML 的形式在同一页面出现很多份,所以一律不用 <defs>/id,
// 渐变一概用「多层实心形状」堆出来,免得 id 撞车。

/** 花瓣主粉(玩家侧的庆祝色) */
export const PETAL_PINK = "#F5A8C6";
/** 花瓣浅蓝(对手 / 假人侧的庆祝色,和粉色一眼分得开) */
export const PETAL_BLUE = "#9BBDE8";
/** 花芯的暖黄 */
export const FLOWER_CORE = "#FFD866";
/** 叶片基准绿 */
export const LEAF_GREEN = "#7FBF6E";
/** 篱笆与田埂的深木色 */
export const WOOD_DARK = "#8A6142";
/** 篱笆亮面的浅木色 */
export const WOOD_LIGHT = "#C89A6B";
/** 枯叶棕(冲突提示的第二通道,色弱也认得出形状) */
export const WITHER_BROWN = "#B08A5E";

/** 把 #rrggbb 变亮(f>0)或变暗(f<0),f 取 -1..1;认不出的输入原样返回 */
export function shade(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || !Number.isFinite(f)) return hex;
  const num = Number.parseInt(m[1], 16);
  const one = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  const r = one(num >> 16);
  const g = one((num >> 8) & 255);
  const b = one(num & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** 两个 #rrggbb 按 t(0..1)混色:t=0 全是 a,t=1 全是 b;认不出的输入返回 a */
export function mix(a: string, b: string, t: number): string {
  const ma = /^#([0-9a-f]{6})$/i.exec(a);
  const mb = /^#([0-9a-f]{6})$/i.exec(b);
  if (!ma || !mb || !Number.isFinite(t)) return a;
  const na = Number.parseInt(ma[1], 16);
  const nb = Number.parseInt(mb[1], 16);
  const k = Math.max(0, Math.min(1, t));
  const one = (x: number, y: number): number => Math.round(x + (y - x) * k);
  const r = one(na >> 16, nb >> 16);
  const g = one((na >> 8) & 255, (nb >> 8) & 255);
  const bl = one(na & 255, nb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** 统一的外壳:占满宿主、对读屏隐身 */
function svgWrap(body: string, viewBox = "0 0 24 24"): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%"` +
    ` aria-hidden="true" focusable="false">${body}</svg>`
  );
}

/** 一片花瓣:暗部衬底 + 主色 + 高光三层,颜色随传入色走 */
export function petalSVG(color: string): string {
  const dark = shade(color, -0.18);
  const light = shade(color, 0.5);
  return svgWrap(
    `<path d="M12 1.5 C17.6 5.4 19.6 12 12 22.5 C4.4 12 6.4 5.4 12 1.5 Z" fill="${dark}"/>` +
      `<path d="M12 2.6 C16.8 6 18.3 12 12 20.8 C5.7 12 7.2 6 12 2.6 Z" fill="${color}"/>` +
      `<path d="M12 4.6 C14.6 7 15.3 11 12 16.8 C10.2 12.4 10.5 8 12 4.6 Z" fill="${light}" opacity=".8"/>`
  );
}

/** 一枚待放的花苞:茎 + 粉苞三阶 + 左右两片萼叶 */
export function budSVG(): string {
  return svgWrap(
    `<path d="M11.4 15 L11.4 21.4 L12.6 21.4 L12.6 15 Z" fill="#5E9950"/>` +
      `<path d="M12 2.4 C16.7 5.4 17.1 11 12 15.6 C6.9 11 7.3 5.4 12 2.4 Z" fill="${shade(PETAL_PINK, -0.16)}"/>` +
      `<path d="M12 3.5 C15.9 6 16.1 10.6 12 14.4 C7.9 10.6 8.1 6 12 3.5 Z" fill="${PETAL_PINK}"/>` +
      `<path d="M12 5 C13.9 7 14.1 10 12 12.8 C10.5 10 10.7 7 12 5 Z" fill="${shade(PETAL_PINK, 0.5)}"/>` +
      `<path d="M12 15.6 C9.3 13.6 6.9 13.8 5.7 15.7 C7.8 17.7 10.4 17.5 12 15.6 Z" fill="${LEAF_GREEN}"/>` +
      `<path d="M12 15.6 C14.7 13.6 17.1 13.8 18.3 15.7 C16.2 17.7 13.6 17.5 12 15.6 Z" fill="${shade(LEAF_GREEN, -0.16)}"/>`
  );
}

/** 一片托底的叶子:主色 + 暗色叶脉,颜色随宫色调过再传进来 */
export function leafSVG(color: string): string {
  const vein = shade(color, -0.24);
  return svgWrap(
    `<path d="M2.5 19 C5 8.5 15.5 5.4 21.5 7.4 C20 15.5 10.5 21 2.5 19 Z" fill="${color}"/>` +
      `<path d="M4 18.2 C7.5 13 13.5 9.4 19.5 8.2 C14 10.6 8.5 14.6 4 18.2 Z" fill="${vein}" opacity=".55"/>`
  );
}

/** 一朵开好的五瓣小花:每瓣两层(暗托 + 主色),花芯三层 */
export function flowerSVG(petalColor = PETAL_PINK, core = FLOWER_CORE): string {
  const dark = shade(petalColor, -0.16);
  let petals = "";
  for (let k = 0; k < 5; k++) {
    const a = k * 72;
    petals +=
      `<ellipse cx="12" cy="5.4" rx="3.7" ry="5.2" fill="${dark}" transform="rotate(${a} 12 12)"/>` +
      `<ellipse cx="12" cy="5.9" rx="3" ry="4.4" fill="${petalColor}" transform="rotate(${a} 12 12)"/>`;
  }
  return svgWrap(
    petals +
      `<circle cx="12" cy="12" r="3.5" fill="${shade(core, -0.22)}"/>` +
      `<circle cx="12" cy="11.6" r="2.8" fill="${core}"/>` +
      `<circle cx="11" cy="10.8" r="1" fill="#FFF3C2"/>`
  );
}

/** 一片卷边的枯叶:冲突提示除了变红,还有这个形状当第二通道 */
export function witherSVG(): string {
  return svgWrap(
    `<path d="M4 19 C5 11 11 5.4 20 5 C19 9 17.5 12.6 14.5 15.6 C17 15.1 18.6 14 20 12.4 C18 17.6 12 20.6 4 19 Z" fill="${WITHER_BROWN}"/>` +
      `<path d="M6 17.8 C8.5 12.4 12.5 8.8 17.5 6.8 C13 10.5 9.2 14.2 6 17.8 Z" fill="${shade(WITHER_BROWN, -0.3)}"/>`
  );
}

/** 一盏小灯泡:提示框的前缀图标 */
export function bulbSVG(): string {
  return svgWrap(
    `<circle cx="12" cy="9.6" r="6.4" fill="${shade(FLOWER_CORE, -0.12)}"/>` +
      `<circle cx="12" cy="9.2" r="5.6" fill="${FLOWER_CORE}"/>` +
      `<circle cx="10" cy="7.4" r="1.8" fill="#FFF3C2"/>` +
      `<path d="M9.5 15.2 L14.5 15.2 L14 19 L10 19 Z" fill="#9C8B66"/>` +
      `<rect x="10.2" y="19" width="3.6" height="1.7" rx=".8" fill="#7C6E50"/>`
  );
}

/** 一支小铅笔:笔杆 + 橡皮头 + 削出来的笔尖 */
export function pencilSVG(): string {
  return svgWrap(
    `<path d="M4 20 L5.4 15.4 L17 3.8 C18.2 2.6 20.1 2.6 21.2 3.8 C22.3 4.9 22.3 6.7 21.2 7.9 L9.5 19.5 L4 20 Z" fill="#F0B24C"/>` +
      `<path d="M17 3.8 C18.2 2.6 20.1 2.6 21.2 3.8 C22.3 4.9 22.3 6.7 21.2 7.9 L19 10 L15 6 Z" fill="#E27A8F"/>` +
      `<path d="M4 20 L5.4 15.4 L8.6 18.6 Z" fill="${WOOD_DARK}"/>`
  );
}

/** 一块小海绵:擦掉钮的图标,带气孔 */
export function spongeSVG(): string {
  return svgWrap(
    `<rect x="3" y="9" width="18" height="9" rx="3" fill="#8FD0E8"/>` +
      `<rect x="3" y="7" width="18" height="6.5" rx="3" fill="#B7E3F2"/>` +
      `<circle cx="8" cy="10.4" r="1" fill="#7FBEDA"/>` +
      `<circle cx="14" cy="9.6" r=".9" fill="#7FBEDA"/>` +
      `<circle cx="17.6" cy="11.4" r=".8" fill="#7FBEDA"/>` +
      `<circle cx="10.5" cy="14.5" r="1" fill="#79B7D3"/>`
  );
}

/** 角落的一丛小花:草垛 + 两片叶 + 三朵不同色的小花,当花田背景的静态装饰 */
export function clusterSVG(): string {
  const mini = (cx: number, cy: number, s: number, color: string): string => {
    const dark = shade(color, -0.16);
    let out = "";
    for (let k = 0; k < 5; k++) {
      const a = k * 72;
      out +=
        `<ellipse cx="${cx}" cy="${cy - s * 1.6}" rx="${s}" ry="${s * 1.5}" fill="${dark}" transform="rotate(${a} ${cx} ${cy})"/>` +
        `<ellipse cx="${cx}" cy="${cy - s * 1.4}" rx="${s * 0.8}" ry="${s * 1.2}" fill="${color}" transform="rotate(${a} ${cx} ${cy})"/>`;
    }
    return `${out}<circle cx="${cx}" cy="${cy}" r="${s * 0.9}" fill="${FLOWER_CORE}"/>`;
  };
  return svgWrap(
    `<path d="M2 34 C8 26 16 24 24 26 C34 22 42 26 46 32 L46 36 L2 36 Z" fill="#CFE8C4"/>` +
      `<path d="M10 32 C10 24 12 20 14 18 C16 20 17 25 16 32 Z" fill="${LEAF_GREEN}"/>` +
      `<path d="M34 32 C33 25 35 21 38 19 C39 22 39 27 37 32 Z" fill="${shade(LEAF_GREEN, -0.12)}"/>` +
      mini(14, 15, 3, PETAL_PINK) +
      mini(38, 16, 2.6, PETAL_BLUE) +
      mini(26, 22, 2.2, "#F3C46B"),
    "0 0 48 36"
  );
}
