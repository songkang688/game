/**
 * 弹弹小鸟 —— 无头弹道解算器(1.2 第 12 步 A 档新增)。
 *
 * 用来回答一个 1.1 没法回答的问题:**这一关到底通不通得了?**
 * 做法不是「估算」,而是真的把 world.ts 跑一遍:
 * 1. 对每个还活着的目标反解抛射角(给定出弓速度,求能砸到它的两条弧线);
 * 2. 把候选弹道逐条在世界的**克隆体**上打一遍,挑掉豆最多的那发;
 * 3. 打完一只换下一只,豆清空就算「存在一条通关弹道」。
 *
 * 因为跑的是线上同一套固定步长物理,结论对玩家是有效的。
 */
import { BIRD_INFO } from "./birds";
import type { BirdKind, LevelDef } from "./levels";
import { GRAVITY, MAX_DRAG, SLING_X, SLING_Y, launchVelocity } from "./physics";
import {
  FIXED_STEP,
  allBirdsDone,
  beansAlive,
  cloneWorld,
  createWorld,
  launchBird,
  makeBird,
  stepWorld,
  triggerSkill,
  worldCalm,
  type World,
  type WorldSource
} from "./world";

/** 拉弓换算系数(与 launchVelocity 内部一致):速度 = 拉距 × K */
export const LAUNCH_K = 9.6;
/** 拉满能给到的最大出弓速度 */
export const MAX_REACH_SPEED = MAX_DRAG * LAUNCH_K;

export interface ShotPlan {
  dragX: number;
  dragY: number;
  /** 起飞后第几秒点屏幕放技能;null = 不放 */
  skillAt: number | null;
  /** 先等几秒再松手(移动平台要等它荡到位) */
  waitFor?: number;
}

export interface ShotOutcome {
  popped: number;
  destroyed: number;
  seconds: number;
  /** 全程离最近那颗豆最近有多近(用来给「差一点」的弹道打分) */
  nearest: number;
}

export interface SolveResult {
  solved: boolean;
  shots: ShotPlan[];
  beansLeft: number;
  /** 用掉几只小鸟 */
  used: number;
}

export interface SolveOptions {
  /** 每发最多模拟多少秒(超过就当这发打完了) */
  shotSeconds?: number;
  /** 每只小鸟最多试多少条候选弹道 */
  maxCandidates?: number;
  /** 技能触发时机的候选(秒) */
  skillTimes?: number[];
  /** 爬山法微调的轮数 */
  climbRounds?: number;
}

/** 出弓速度反推拉弓向量;拉不到(超过 MAX_DRAG)就返回 null */
export function velocityToDrag(vx: number, vy: number): { dragX: number; dragY: number } | null {
  const dragX = -vx / LAUNCH_K;
  const dragY = -vy / LAUNCH_K;
  if (Math.hypot(dragX, dragY) > MAX_DRAG + 1e-9) return null;
  return { dragX, dragY };
}

/**
 * 抛射反解:从弹弓以速度 speed 打到 (tx,ty),返回 0/1/2 条可行弹道的拉弓向量。
 * 经典公式 tanθ = (v² ± √(v⁴ - g(g·x² + 2y·v²))) / (g·x),y 轴向上为正。
 */
function aimOnce(
  tx: number,
  ty: number,
  speed: number,
  gfactor: number,
  fromX: number,
  fromY: number,
  sign: 1 | -1
): ShotPlan | null {
  const g = GRAVITY * gfactor;
  const dx = tx - fromX;
  const dy = fromY - ty;
  if (Math.abs(dx) < 1e-6) return null;
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * dx * dx + 2 * dy * v2);
  if (disc < 0) return null;
  const angle = Math.atan2(v2 + sign * Math.sqrt(disc), g * dx);
  const drag = velocityToDrag(speed * Math.cos(angle), -speed * Math.sin(angle));
  return drag ? { ...drag, skillAt: null } : null;
}

export function aimAt(
  tx: number,
  ty: number,
  speed: number,
  gfactor = 1,
  fromX = SLING_X,
  fromY = SLING_Y
): ShotPlan[] {
  const out: ShotPlan[] = [];
  for (const sign of [1, -1] as const) {
    let shot = aimOnce(tx, ty, speed, gfactor, fromX, fromY, sign);
    if (!shot) continue;
    // 小鸟其实是从「被拉开的那一点」起飞的,不是从弹弓中心;
    // 拿解出来的拉弓量把起点挪过去再解一次,两三轮就收敛。
    for (let i = 0; i < 3; i++) {
      const again = aimOnce(tx, ty, speed, gfactor, fromX + shot.dragX, fromY + shot.dragY, sign);
      if (!again) break;
      shot = again;
    }
    out.push(shot);
  }
  return out;
}

/** 这一关此刻还需要打掉哪些点:活着的豆 + 冲天炮 + 结构底层承重块 */
function targetsOf(w: World): Array<{ x: number; y: number; weight: number }> {
  const pts: Array<{ x: number; y: number; weight: number }> = [];
  for (const bean of w.beans) {
    if (!bean.dead) pts.push({ x: bean.x, y: bean.y, weight: 3 });
  }
  for (const bl of w.blocks) {
    if (bl.dead) continue;
    const cx = bl.x + bl.w / 2;
    const cy = bl.y + bl.h / 2;
    if (bl.kind === "tnt") pts.push({ x: cx, y: cy, weight: 3 });
    // 细高的承重柱:打倒它上面整片都会塌
    else if (bl.h >= bl.w * 1.8) pts.push({ x: cx, y: bl.y + bl.h * 0.3, weight: 2 });
  }
  return pts;
}

function dedupe(shots: ShotPlan[], limit: number): ShotPlan[] {
  const seen = new Set<string>();
  const out: ShotPlan[] = [];
  for (const s of shots) {
    const key = `${Math.round(s.dragX * 2)}/${Math.round(s.dragY * 2)}/${s.skillAt ?? "-"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** 给这只小鸟列候选弹道:先按目标反解,再补一把扇形兜底 */
export function candidateShots(w: World, kind: BirdKind, limit = 46): ShotPlan[] {
  const gfactor = BIRD_INFO[kind].gfactor;
  const speeds = [0.55, 0.68, 0.8, 0.9, 1].map((f) => f * MAX_REACH_SPEED - 0.001);
  const aimed: ShotPlan[] = [];
  const targets = targetsOf(w).sort((a, b) => b.weight - a.weight);
  for (const t of targets) {
    for (const s of speeds) {
      // 直接瞄准,以及稍微打高一点(越过前排掩体)
      aimed.push(...aimAt(t.x, t.y, s, gfactor));
      aimed.push(...aimAt(t.x, t.y - 26, s, gfactor));
    }
  }
  // 扇形兜底:万一目标全被挡住,总还有一把常规角度
  const fan: ShotPlan[] = [];
  for (let a = -1.35; a <= -0.06; a += 0.11) {
    for (const s of [0.75, 0.9, 1]) {
      const speed = s * MAX_REACH_SPEED - 0.001;
      const drag = velocityToDrag(Math.cos(a) * speed, Math.sin(a) * speed);
      if (drag) fan.push({ ...drag, skillAt: null });
    }
  }
  return dedupe([...aimed, ...fan], limit);
}

/** 在世界上真打一发(会修改这个世界),返回这发的战果 */
export function playShot(w: World, kind: BirdKind, shot: ShotPlan, maxSeconds = 5): ShotOutcome {
  const beansBefore = beansAlive(w);
  const destroyedBefore = w.destroyed;
  // 先等平台荡到位再松手
  const wait = Math.max(0, shot.waitFor ?? 0);
  for (let t = 0; t < wait; t += FIXED_STEP) stepWorld(w, FIXED_STEP);

  const bird = makeBird(kind);
  bird.x = SLING_X + shot.dragX;
  bird.y = SLING_Y + shot.dragY;
  const v = launchVelocity(shot.dragX, shot.dragY);
  launchBird(w, bird, v.vx, v.vy);

  let t = 0;
  let skillFired = shot.skillAt === null;
  let calmT = 0;
  let nearest = Infinity;
  while (t < maxSeconds) {
    stepWorld(w, FIXED_STEP);
    t += FIXED_STEP;
    for (const b of w.birds) {
      if (b.dead || !b.flying) continue;
      for (const bean of w.beans) {
        if (bean.dead) continue;
        const d = Math.hypot(b.x - bean.x, b.y - bean.y);
        if (d < nearest) nearest = d;
      }
    }
    if (!skillFired && shot.skillAt !== null && bird.age >= shot.skillAt) {
      triggerSkill(w);
      skillFired = true;
    }
    if (beansAlive(w) === 0) break;
    if (allBirdsDone(w)) {
      if (worldCalm(w)) {
        calmT += FIXED_STEP;
        if (calmT > 0.35) break;
      } else {
        calmT = 0;
      }
    }
  }
  return {
    popped: beansBefore - beansAlive(w),
    destroyed: w.destroyed - destroyedBefore,
    seconds: t,
    nearest: Number.isFinite(nearest) ? nearest : 999
  };
}

/** 打掉的豆最值钱;拆掉的结构次之;「差一点就蹭到」也给一点分,爬山法才有坡可爬 */
function scoreOutcome(o: ShotOutcome): number {
  return o.popped * 1000 + o.destroyed * 7 + Math.max(0, 240 - o.nearest) * 0.5;
}

/**
 * 贪心搜索一条通关路线:每只小鸟都挑「这发打掉最多豆」的那条弹道。
 * 找到就返回具体的拉弓向量序列——那是一条**真的能通关**的弹道。
 */
export function findSolution(level: WorldSource & { birds: BirdKind[] }, opts: SolveOptions = {}): SolveResult {
  const shotSeconds = opts.shotSeconds ?? 4.6;
  const maxCandidates = opts.maxCandidates ?? 46;
  const skillTimes = opts.skillTimes ?? [0.22, 0.42, 0.62];
  const climbRounds = opts.climbRounds ?? 16;
  const world = createWorld(level);
  const shots: ShotPlan[] = [];

  for (let i = 0; i < level.birds.length; i++) {
    if (beansAlive(world) === 0) break;
    const kind = level.birds[i];
    const need = beansAlive(world);
    const plain = candidateShots(world, kind, maxCandidates);
    const canSkill = kind !== "straight";
    const timed = world.platforms.length > 0 || world.balloons.some((b) => !b.popped);

    const evaluate = (shot: ShotPlan): { shot: ShotPlan; score: number; popped: number } => {
      const probe = cloneWorld(world);
      const out = playShot(probe, kind, shot, shotSeconds);
      return { shot, score: scoreOutcome(out), popped: out.popped };
    };

    let best: { shot: ShotPlan; score: number; popped: number } | null = null;
    const ranked: Array<{ shot: ShotPlan; score: number; popped: number }> = [];
    for (const shot of plain) {
      const r = evaluate(shot);
      ranked.push(r);
      if (!best || r.score > best.score) best = r;
      if (r.popped >= need) break; // 一发清台,不用再试了
    }
    // 前几条最有希望的弹道再配上技能时机试一遍
    if (canSkill && best && best.popped < need) {
      ranked.sort((a, b) => b.score - a.score);
      for (const cand of ranked.slice(0, 4)) {
        for (const at of skillTimes) {
          const r = evaluate({ ...cand.shot, skillAt: at });
          if (r.score > best.score) best = r;
          if (r.popped >= need) break;
        }
        if (best.popped >= need) break;
      }
    }
    // 爬山法微调:风区、移动平台这类会把抛物线算歪的关,靠一点点挪角度/等时机补回来
    if (best && best.popped < need) {
      for (let round = 0; round < climbRounds && best.popped < need; round++) {
        const step = round < climbRounds / 2 ? 2.2 : 0.9;
        const neighbours: ShotPlan[] = [
          { ...best.shot, dragX: best.shot.dragX + step },
          { ...best.shot, dragX: best.shot.dragX - step },
          { ...best.shot, dragY: best.shot.dragY + step },
          { ...best.shot, dragY: best.shot.dragY - step }
        ];
        if (timed) {
          const wait = best.shot.waitFor ?? 0;
          neighbours.push({ ...best.shot, waitFor: wait + 0.45 });
          if (wait > 0) neighbours.push({ ...best.shot, waitFor: Math.max(0, wait - 0.45) });
        }
        let improved = false;
        for (const n of neighbours) {
          if (Math.hypot(n.dragX, n.dragY) > MAX_DRAG) continue;
          const r = evaluate(n);
          if (r.score > best.score + 1e-6) {
            best = r;
            improved = true;
            if (r.popped >= need) break;
          }
        }
        if (!improved && step < 1) break;
      }
    }
    if (!best) break;
    playShot(world, kind, best.shot, shotSeconds);
    shots.push(best.shot);
  }

  return {
    solved: beansAlive(world) === 0,
    shots,
    beansLeft: beansAlive(world),
    used: shots.length
  };
}

/** 关卡可解性:只要贪心搜索能清台就算过 */
export function isSolvable(level: LevelDef, opts?: SolveOptions): boolean {
  return findSolution(level, opts).solved;
}
