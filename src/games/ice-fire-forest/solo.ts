/**
 * 冰冰火火森林 · 单人模式的控制切换(纯函数状态机,不碰 DOM)。
 *
 * 家里只有一个孩子的时候,这一款必须一个人也玩得下去 —— 这是本款 1.2 最要紧的一条。
 * 做法很简单,但每一条都得钉死:
 *
 *  1. 单人模式下**两套键位都开当前这一位**(WASD 和方向键都行),
 *     不用记「现在该按哪一套」;
 *  2. `Tab`(或屏幕中间上方那颗按钮)换人;
 *  3. **另一角色留在原地**,一步都不许自己动 —— 没有 AI 队友,
 *     因为这一款的谜题就是「谁先谁后」,AI 一插手就没得想了;
 *  4. 换人的一瞬间把两套 held 全清掉,不然上一位会带着「按住不放」的幽灵继续走。
 */
import type { Hero } from "./logic";

/** 换人的键 */
export const SWITCH_CODE = "Tab";

/** 触屏热区最小边长(像素):再小小孩的手指按不准 */
export const TOUCH_HIT_PX = 44;

export interface SoloState {
  /** 现在是不是单人模式 */
  solo: boolean;
  /** 单人模式下正在控制谁 */
  active: Hero;
}

export function initialSolo(): SoloState {
  return { solo: false, active: "ice" };
}

/** 单人 / 双人来回切;切回双人时把控制权交还给两套键位 */
export function toggleSolo(s: SoloState): SoloState {
  return { solo: !s.solo, active: s.active };
}

/** 换人(只在单人模式下有意义) */
export function switchHero(s: SoloState): SoloState {
  if (!s.solo) return s;
  return { solo: true, active: s.active === "ice" ? "fire" : "ice" };
}

/** 这个键是不是换人键 */
export function isSwitchCode(code: string): boolean {
  return code === SWITCH_CODE;
}

/**
 * 一次按键最后落到谁身上。
 * 双人模式听键位的主人的,单人模式一律给当前这一位。
 */
export function routeHero(s: SoloState, boundHero: Hero): Hero {
  return s.solo ? s.active : boundHero;
}

/** 这一位现在归玩家管吗(渲染层用它画那圈光环) */
export function isControlled(s: SoloState, hero: Hero): boolean {
  return !s.solo || s.active === hero;
}

/** 另一位现在在原地待命吗 */
export function isStandingBy(s: SoloState, hero: Hero): boolean {
  return s.solo && s.active !== hero;
}

/** 屏幕中间上方那颗换人按钮上写什么 */
export function switchButtonLabel(s: SoloState): string {
  if (!s.solo) return "🙋 一个人玩";
  return s.active === "ice" ? "🔁 换焰焰" : "🔁 换凛凛";
}

/** 换人按钮的读屏说明 */
export function switchButtonAria(s: SoloState): string {
  if (!s.solo) return "换成一个人玩:两套键位都开当前这一位,按 Tab 换人";
  return s.active === "ice"
    ? "现在控制凛凛,焰焰在原地待命;点一下换成焰焰"
    : "现在控制焰焰,凛凛在原地待命;点一下换成凛凛";
}

/** 切换之后播报给读屏的一句话 */
export function soloAnnounce(s: SoloState): string {
  if (!s.solo) return "双人模式,凛凛用 W A S D,焰焰用方向键。";
  const who = s.active === "ice" ? "凛凛" : "焰焰";
  const other = s.active === "ice" ? "焰焰" : "凛凛";
  return `一个人玩:现在控制${who},${other}在原地等你,按 Tab 换人。`;
}

/** 虚拟方向键那一栏的小标题 */
export function padLabel(s: SoloState, hero: Hero): string {
  const name = hero === "ice" ? "凛凛" : "焰焰";
  return isStandingBy(s, hero) ? `${name}(待命)` : name;
}
