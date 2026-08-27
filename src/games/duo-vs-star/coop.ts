/**
 * 朵朵大战星星 · 合作（纯函数 + 三关合作特训的数据）。
 *
 * 1.1 的 2v2 说是「组队」，其实两个人各打各的，谁都不需要谁。
 * 1.2 补上两个**只有两个人才做得到**的动作：
 *
 *  · **顶举**：队友踩到你头顶上，你按「上」——你自己不跳，把他往天上送一大截。
 *    用来抢高处的道具、抢先手，也用来把队友从围攻里顶出去。
 *  · **接应**：队友被撞飞到场边外面了，你按「下 + 副动作」甩一条星星绳过去，
 *    把他往场地里拉一把。拉回来的那一下最有成就感。
 *
 * 两个动作都只对**同队**的人生效，一个人怎么按都触发不了——
 * 合作特训三关的过关条件就只认这两个动作的次数，所以「单人过不了」这条是钉在规则里的。
 */
import type { Bounds } from "./knockback";
import { clamp } from "./knockback";

// ---------------------------------------------------------------------------
// 顶举
// ---------------------------------------------------------------------------

/** 队友站得多偏还算「踩在头顶上」（水平距离） */
export const LIFT_RANGE = 40;

/** 队友要落在头顶多高的范围里（世界单位，y 向下为正） */
export const LIFT_LIFT_MIN = 6;
export const LIFT_LIFT_MAX = 74;

/** 顶举一次要歇多久 */
export const LIFT_COOLDOWN = 1.1;

/** 顶举给的基准上升初速（负数 = 往上） */
export const LIFT_BASE_V = -700;

/** 顶举初速的上下限，谁顶谁都不会离谱 */
export const LIFT_MIN_V = -960;
export const LIFT_MAX_V = -430;

/** 顶举那一下顺带把两个人身上的击退值抹掉多少（互相打气） */
export const LIFT_RELIEF = 18;

/** 一个够顶举判定用的最小角色快照 */
export interface CoopActorView {
  x: number;
  y: number;
  team: number;
  onStage: boolean;
  /** 站在地上（顶举的人要站稳才顶得动） */
  onGround: boolean;
  /** 顶举 / 接应的冷却剩余时间 */
  cooldown: number;
}

/**
 * `rider` 是不是正踩在 `lifter` 头顶上、可以被顶一把。
 * 同队、都在场上、顶的人站稳了、位置对得上——四条都满足才行。
 */
export function canLift(lifter: CoopActorView, rider: CoopActorView): boolean {
  if (lifter === rider) return false;
  if (lifter.team !== rider.team) return false;
  if (!lifter.onStage || !rider.onStage) return false;
  if (!lifter.onGround) return false;
  if (lifter.cooldown > 0) return false;
  if (Math.abs(rider.x - lifter.x) > LIFT_RANGE) return false;
  const above = lifter.y - rider.y;
  return above >= LIFT_LIFT_MIN && above <= LIFT_LIFT_MAX;
}

/**
 * 顶举给多大的上升初速：顶的人力气越大送得越高，被顶的人越沉飞得越矮。
 * 上下限都夹住了，所以最轻的那位被最沉的那位顶也不会一下子顶出场外。
 */
export function liftVelocity(lifterPower: number, riderWeight: number): number {
  const p = clamp(Number.isFinite(lifterPower) ? lifterPower : 1, 0.5, 2);
  const w = clamp(Number.isFinite(riderWeight) ? riderWeight : 100, 40, 300);
  return clamp(LIFT_BASE_V * p * (100 / w), LIFT_MIN_V, LIFT_MAX_V);
}

// ---------------------------------------------------------------------------
// 接应
// ---------------------------------------------------------------------------

/** 甩星星绳够得着多远 */
export const CATCH_RANGE = 330;

/** 接应一次要歇多久 */
export const CATCH_COOLDOWN = 1.5;

/** 接应把队友往场地里拉多快 */
export const CATCH_PULL = 430;

/** 接应顺带把队友的下坠速度收掉多少（0.35 = 只剩三成五） */
export const CATCH_LIFT = 0.35;

/** 「安全区」——主平台的横向范围，出了这个范围才算需要接应 */
export interface SafeSpan {
  min: number;
  max: number;
  top: number;
}

/** 队友现在算不算「掉在外面了，等人拉一把」 */
export function inDanger(flyer: CoopActorView, zone: SafeSpan): boolean {
  if (!flyer.onStage) return false;
  if (flyer.onGround) return false;
  return flyer.x < zone.min || flyer.x > zone.max || flyer.y > zone.top;
}

/** `rescuer` 能不能把 `flyer` 拉回来 */
export function canCatch(rescuer: CoopActorView, flyer: CoopActorView, zone: SafeSpan): boolean {
  if (rescuer === flyer) return false;
  if (rescuer.team !== flyer.team) return false;
  if (!rescuer.onStage || rescuer.cooldown > 0) return false;
  if (!inDanger(flyer, zone)) return false;
  return Math.hypot(flyer.x - rescuer.x, flyer.y - rescuer.y) <= CATCH_RANGE;
}

/**
 * 星星绳拉一把之后队友的新速度：横着往场地中心拽，同时把下坠收掉大半。
 * 只改速度不改位置，所以拉回来还得他自己飘两下——配合，不是瞬移。
 */
export function catchVelocity(
  flyerX: number,
  vx: number,
  vy: number,
  zone: SafeSpan
): { vx: number; vy: number } {
  const mid = (zone.min + zone.max) / 2;
  const dir: 1 | -1 = flyerX < mid ? 1 : -1;
  const nx = Number.isFinite(vx) ? vx : 0;
  const ny = Number.isFinite(vy) ? vy : 0;
  return {
    vx: dir === 1 ? Math.max(nx, CATCH_PULL) : Math.min(nx, -CATCH_PULL),
    vy: ny > 0 ? ny * CATCH_LIFT : ny,
  };
}

// ---------------------------------------------------------------------------
// 合作特训三关
// ---------------------------------------------------------------------------

export interface CoopGoal {
  /** 要顶举成功几次 */
  lifts: number;
  /** 要接应成功几次 */
  catches: number;
}

export interface CoopLesson {
  id: string;
  name: string;
  emoji: string;
  stageId: string;
  /** 一句话说明这一关在教什么 */
  brief: string;
  /** 做给小朋友看的操作提示 */
  howto: string;
  /** 过关条件：只认配合动作，一个人做不到 */
  goal: CoopGoal;
  /** 陪练的小电脑（0 = 场上只有你们俩） */
  sparring: number;
  /** 限时（秒） */
  timeLimit: number;
  /** 道具间隔（秒），0 = 不掉道具 */
  itemEvery: number;
}

/**
 * 三关合作特训。过关条件是「顶举 / 接应 各做够几次」，
 * 这两个动作都要**队友在场**才触发得了，所以一个人按到天亮也过不去
 * —— `coop.test.ts` 会真的模拟一遍单人操作来验这条。
 */
export const COOP_LESSONS: CoopLesson[] = [
  {
    id: "lift-up",
    name: "一起往上顶",
    emoji: "🙌",
    stageId: "cloud-square",
    brief: "第一课：踩到同伴头顶上，让他把你顶到高处去。",
    howto: "一个人站稳别动，另一个人跳到他头顶；站着的那位按「上」，就把同伴顶上去啦。",
    goal: { lifts: 3, catches: 0 },
    sparring: 0,
    timeLimit: 90,
    itemEvery: 0,
  },
  {
    id: "catch-rope",
    name: "拉住好朋友",
    emoji: "🤲",
    stageId: "night-hops",
    brief: "第二课：同伴飘到场边外面了，甩一条星星绳把他拽回来。",
    howto: "同伴掉出台子边缘时，你站在台子上按「下 + 副动作」（1P 是 S+G，2P 是 ↓+K）。",
    goal: { lifts: 0, catches: 3 },
    sparring: 0,
    timeLimit: 110,
    itemEvery: 0,
  },
  {
    id: "duo-combo",
    name: "配合默契考",
    emoji: "🤝",
    stageId: "allstar-arena",
    brief: "结业课：一边应付陪练，一边把顶举和接应都用出来。",
    howto: "两样都要做到：顶举两次、接应两次。陪练不会手下留情，互相照应着来。",
    goal: { lifts: 2, catches: 2 },
    sparring: 1,
    timeLimit: 140,
    itemEvery: 6,
  },
];

/** 按 id 找一课，找不到就退回第一课，绝不返回 undefined */
export function lessonById(id: string): CoopLesson {
  return COOP_LESSONS.find((l) => l.id === id) ?? COOP_LESSONS[0];
}

export interface CoopTally {
  lifts: number;
  catches: number;
}

/** 这一课过了吗（两项都做够才算） */
export function lessonCleared(tally: CoopTally, lesson: CoopLesson): boolean {
  return tally.lifts >= lesson.goal.lifts && tally.catches >= lesson.goal.catches;
}

/** 还差多少（给 HUD 显示「顶举 1/3」这种进度） */
export function lessonProgress(tally: CoopTally, lesson: CoopLesson): string {
  const parts: string[] = [];
  if (lesson.goal.lifts > 0) {
    parts.push(`顶举 ${Math.min(tally.lifts, lesson.goal.lifts)}/${lesson.goal.lifts}`);
  }
  if (lesson.goal.catches > 0) {
    parts.push(`接应 ${Math.min(tally.catches, lesson.goal.catches)}/${lesson.goal.catches}`);
  }
  return parts.join(" · ");
}

/** 一课能拿几颗星：一次没被撞出去 3 颗，掉一次 2 颗，再多 1 颗 */
export function rateLesson(outs: number): 1 | 2 | 3 {
  if (outs <= 0) return 3;
  if (outs === 1) return 2;
  return 1;
}

/**
 * 顶举能把人送多高（世界单位）。给合作特训的提示语和测试用：
 * 顶一把比自己起跳高出一大截，这就是「非要两个人不可」的那点甜头。
 */
export function liftApex(v: number, gravity = 1250): number {
  const speed = Math.abs(Number.isFinite(v) ? v : 0);
  return (speed * speed) / (2 * Math.max(1, gravity));
}

/** 接应的绳子够不够得着这条弹飞线外面的队友（画提示圈用） */
export function catchReachesOut(zone: SafeSpan, bounds: Bounds): boolean {
  const mid = (zone.min + zone.max) / 2;
  return Math.min(mid - bounds.left, bounds.right - mid) > CATCH_RANGE;
}
