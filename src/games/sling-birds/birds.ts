/**
 * 弹弹小鸟 —— 五只原创小鸟的资料与「空中技能触发窗口」(1.2 第 12 步 A 档抽出)。
 *
 * 1.1 时这些数据写在 index.ts 里,技能能不能触发只看一个 skillUsed 布尔值;
 * 1.2 把触发窗口写成常量(起手保护 + 有效期上限),world.ts 与单测共用同一份判定。
 */
import type { BirdKind } from "./levels";

export interface BirdInfo {
  name: string;
  skill: string;
  color: string;
  belly: string;
  dark: string;
  r: number;
  power: number;
  gfactor: number;
  hint: string;
}

/** 数值与 1.1 完全一致,只是换了个家 */
export const BIRD_INFO: Record<BirdKind, BirdInfo> = {
  straight: {
    name: "糯糯",
    skill: "直球",
    color: "#FFD9E6",
    belly: "#FFF1F6",
    dark: "#B36B85",
    r: 10,
    power: 1.25,
    gfactor: 0.75,
    hint: "糯糯又稳又结实:瞄准了直接弹出去!"
  },
  split: {
    name: "云云",
    skill: "分裂",
    color: "#D9CCF7",
    belly: "#F0EAFD",
    dark: "#7B68A8",
    r: 9,
    power: 0.95,
    gfactor: 1,
    hint: "飞行时点一下屏幕,云云会分裂成三朵小云!"
  },
  slam: {
    name: "墩墩",
    skill: "下砸",
    color: "#B5DDF9",
    belly: "#E3F3FE",
    dark: "#4E7FA6",
    r: 10,
    power: 1.05,
    gfactor: 1,
    hint: "飞行时点一下屏幕,墩墩会咚——地砸下来!"
  },
  drill: {
    name: "闪闪",
    skill: "加速钻",
    color: "#FFE0B0",
    belly: "#FFF2DC",
    dark: "#A87840",
    r: 8,
    power: 0.95,
    gfactor: 1,
    hint: "飞行时点一下屏幕,闪闪会加速往前钻!"
  },
  boomerang: {
    name: "卷卷",
    skill: "回旋",
    color: "#C3E8CF",
    belly: "#E9F8EE",
    dark: "#4F8A66",
    r: 9,
    power: 1.1,
    gfactor: 1,
    hint: "飞行时点一下屏幕,卷卷会掉头往回冲,专打堡垒的背面!"
  }
};

/** 有技能可以在空中触发的小鸟(糯糯是纯直球,不算能力鸟) */
export const SKILL_BIRDS: BirdKind[] = ["split", "slam", "drill", "boomerang"];

/**
 * 触发窗口(秒,以小鸟离开弹弓开始计时):
 * - 起手保护:刚出弓的 0.08s 内点屏幕不算数。松手那一下手指往往还压在屏幕上,
 *   没有这段保护,技能会在弹弓正上方白白放掉。
 * - 有效期:飞了 5.5s 还没点就当放弃,免得小鸟在地上滚着还能突然分裂。
 */
export const SKILL_ARM_TIME = 0.08;
export const SKILL_WINDOW_END = 5.5;

export interface SkillCandidate {
  kind: BirdKind;
  flying: boolean;
  dead: boolean;
  skillUsed: boolean;
  age: number;
}

/** 这只小鸟此刻能不能放技能(窗口内、还活着、在飞、没放过、不是直球) */
export function canTriggerSkill(bird: SkillCandidate): boolean {
  if (bird.dead || !bird.flying || bird.skillUsed) return false;
  if (!SKILL_BIRDS.includes(bird.kind)) return false;
  return bird.age >= SKILL_ARM_TIME && bird.age <= SKILL_WINDOW_END;
}

/** 窗口还剩多少秒(不在窗口内返回 0),HUD 上那圈倒计时用 */
export function skillWindowLeft(bird: SkillCandidate): number {
  if (!canTriggerSkill(bird)) return 0;
  return Math.max(0, SKILL_WINDOW_END - bird.age);
}
