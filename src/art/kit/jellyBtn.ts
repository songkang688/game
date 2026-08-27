/**
 * 共享美术套件 · 果冻按钮样式生成（1.3 视觉升级 · 窗口8 B 档新增）。
 *
 * 工序单（对应 red-blue-tap 规格四·补二）：
 *  1. 径向渐变主体：中心亮 → 边缘压深 12%；
 *  2. 顶部弧形高光带：白 30%、约占钮高 22%；
 *  3. 深色描边 + 底部 3px 立面（2.5D 厚度）——立面走 box-shadow，不改盒子几何；
 *  4. 按下态 transform：scale(0.94) + 底部压扁 scaleY(0.97)，60ms 回弹；
 *  5. 波纹参数：触点圆从 0 扩散到 1.4 倍按钮宽、240ms 渐隐。
 *
 * 只输出字符串，不碰 DOM；热区（宽高 / 内边距 / 边框宽）一个像素都不出现在这里。
 */
import { shade, withAlpha } from "./palette";

/** 边缘往深压多少（工序 1） */
export const JELLY_EDGE_SHADE = -12;
/** 高光带占按钮高度的比例（工序 2） */
export const JELLY_GLOSS_RATIO = 0.22;
/** 底部立面厚度 px（工序 3，走 box-shadow） */
export const JELLY_FACE_PX = 3;
/** 按下回弹时长 ms（工序 4） */
export const JELLY_SQUASH_MS = 60;
/** 按下整体缩放（工序 4） */
export const JELLY_PRESS_SCALE = 0.94;
/** 按下底部压扁（工序 4） */
export const JELLY_PRESS_SQUASH_Y = 0.97;
/** 波纹扩散到按钮宽的倍数（工序 5） */
export const JELLY_RIPPLE_SPREAD = 1.4;
/** 波纹时长 ms（工序 5） */
export const JELLY_RIPPLE_MS = 240;

/** 果冻主体填充：顶部弧形高光带压在径向渐变上面，两层一次给全 */
export function jellyFill(hex: string): string {
  const glossStop = Math.round(JELLY_GLOSS_RATIO * 100);
  const gloss = `radial-gradient(ellipse 130% 58% at 50% -14%, ${withAlpha("#FFFFFF", 0.3)} 0 ${glossStop + 18}%, rgba(255,255,255,0) ${glossStop + 19}%)`;
  const body = `radial-gradient(circle at 50% 36%, ${shade(hex, 10)} 0%, ${hex} 52%, ${shade(hex, JELLY_EDGE_SHADE)} 100%)`;
  return `${gloss}, ${body}`;
}

export interface JellyStyle {
  /** 多层背景：高光带 + 径向渐变主体 */
  background: string;
  /** 深色描边色（描边宽度归按钮自己的 CSS 管，这里绝不碰几何） */
  borderColor: string;
  /** 底部 3px 立面色（配 `0 ${JELLY_FACE_PX}px 0` 的 box-shadow 用） */
  faceColor: string;
}

/** 按一个主色配齐果冻三件套：填充、描边色、立面色 */
export function jellyStyle(hex: string): JellyStyle {
  return {
    background: jellyFill(hex),
    borderColor: shade(hex, -28),
    faceColor: shade(hex, -34)
  };
}

/** 按下态的 transform：只有 transform，一个几何属性都没有 */
export function jellyPressTransform(): string {
  return `translateY(2px) scale(${JELLY_PRESS_SCALE}) scaleY(${JELLY_PRESS_SQUASH_Y})`;
}
