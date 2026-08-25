// 绿芽保卫战 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

export type PlantKind = "sparkle" | "bubble";

export const PLANT_INFO: Record<
  PlantKind,
  { cost: number; hp: number; name: string }
> = {
  sparkle: { cost: 1, hp: 3, name: "闪光芽" },
  bubble: { cost: 2, hp: 4, name: "泡泡芽" },
};

export const LANES = 4;
export const PLANT_COLS = 8;

export function canAfford(dew: number, kind: PlantKind): boolean {
  return dew >= PLANT_INFO[kind].cost;
}

export interface BugSpawn {
  time: number;
  lane: number;
  hp: number;
  speed: number; // 格/秒
}

/** 固定的一局虫虫时间表(秒),平衡好且可测试。 */
export function buildWaveSchedule(): BugSpawn[] {
  return [
    { time: 4, lane: 1, hp: 3, speed: 0.5 },
    { time: 9, lane: 2, hp: 3, speed: 0.5 },
    { time: 14, lane: 0, hp: 3, speed: 0.5 },
    { time: 18, lane: 3, hp: 3, speed: 0.55 },
    { time: 23, lane: 2, hp: 4, speed: 0.55 },
    { time: 27, lane: 1, hp: 4, speed: 0.55 },
    { time: 31, lane: 0, hp: 4, speed: 0.6 },
    { time: 34, lane: 3, hp: 4, speed: 0.6 },
    { time: 38, lane: 1, hp: 5, speed: 0.65 },
    { time: 40, lane: 2, hp: 5, speed: 0.65 },
    { time: 44, lane: 0, hp: 5, speed: 0.65 },
    { time: 46, lane: 3, hp: 5, speed: 0.7 },
    { time: 49, lane: 2, hp: 6, speed: 0.7 },
    { time: 51, lane: 1, hp: 6, speed: 0.75 },
  ];
}

/** 泡泡打没打到虫(同车道,x 方向足够近,单位:格)。 */
export function bubbleHitsBug(bubbleX: number, bugX: number, hitRange = 0.3): boolean {
  return Math.abs(bubbleX - bugX) <= hitRange;
}

/** 虫子是否啃到了这一格的植物(单位:格)。 */
export function bugReachesPlant(bugX: number, plantCol: number): boolean {
  return bugX <= plantCol + 0.62 && bugX >= plantCol - 0.1;
}

/** 虫子走到 x <= 这个值就算进家门。 */
export const HOME_X = -0.25;

export function starsForPlantsLost(lost: number): 1 | 2 | 3 {
  if (lost === 0) return 3;
  if (lost <= 2) return 2;
  return 1;
}
