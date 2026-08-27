/**
 * 跳跳台 · 一局的状态机(纯函数,不碰 DOM)。
 *
 * `hop(state, power)` 收一个力度,吐出「新状态 + 这一跳发生了什么」,输入状态原样不动。
 * 闯关、无尽、对战、双人同屏、AI 幽灵全都跑这一份逻辑,所以手感只有一套。
 *
 * 两个时刻要分清楚:
 *  - **起跳那一刻**决定瞄准方向 `yaw`(角色只控制力度,方向自动对准台心);
 *  - **落地那一刻**决定台面在哪儿、有多大 —— 移动台与缩小台都按这一刻的快照判定。
 * 所以移动台要挑它滑到头、快换向的那一下起跳,这是本作真正的手上功夫。
 */
import {
  dist2d,
  flightTime,
  landPoint,
  powerForDistance,
  score,
  yawTo,
  type Point,
} from "./physics";
import {
  buildPads,
  leavePad,
  nextPad,
  onPad,
  padTick,
  type Difficulty,
  type Pad,
  type Verdict,
} from "./pads";

/** 台序往前预生成几座,画面上要能看到后面两三座 */
export const LOOKAHEAD = 6;

/** 弹簧台连着串的上限,免得一串弹簧无限套娃 */
export const SPRING_CHAIN_CAP = 3;

export interface RunState {
  seed: number;
  difficulty: Difficulty;
  /** pads[0] 是起始台,玩家现在站在 pads[index] */
  pads: Pad[];
  index: number;
  /** 局内时间(秒),移动台与缩小台都看它 */
  time: number;
  score: number;
  combo: number;
  bestCombo: number;
  /** 踩中圆心的次数 */
  perfects: number;
  /** 成功站住的座数 */
  hops: number;
  alive: boolean;
}

export interface HopResult {
  verdict: Verdict;
  power: number;
  yaw: number;
  /** 飞行时长(秒) */
  flight: number;
  from: Point;
  landing: Point;
  /** 落地那一刻的目标台快照 */
  target: Pad;
  targetIndex: number;
  gained: number;
  /** 这一跳之后的连击 */
  combo: number;
  /** 弹簧台白送的那一跳(没有就是 null) */
  bonus: HopResult | null;
}

/** 缩小台从「成为下一座目标」的那一刻开始缩,所以每次落地都要给下一座上一次发条 */
function armNext(pads: Pad[], index: number, time: number): void {
  const next = pads[index + 1];
  if (next && next.kind === "shrink") pads[index + 1] = { ...next, bornAt: time };
}

/** 开一局:生成起始台与前几座,给第一座目标上好发条 */
export function createRun(seed: number, difficulty: Difficulty): RunState {
  const pads = buildPads(seed, difficulty, LOOKAHEAD);
  armNext(pads, 0, 0);
  return {
    seed,
    difficulty,
    pads,
    index: 0,
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    hops: 0,
    alive: true,
  };
}

/** 台序不够长就接着生成(纯粹是懒生成,同 seed 结果一致) */
function ensure(pads: Pad[], upto: number, seed: number, difficulty: Difficulty): void {
  while (pads.length <= upto) {
    pads.push(nextPad(seed, pads.length - 1, difficulty, pads[pads.length - 1]));
  }
}

/** 玩家现在站的台面(当前时刻的快照) */
export function currentPad(run: RunState): Pad {
  return padTick(run.pads[run.index], run.time);
}

/** 下一座目标台的定义(还没落地,别拿它当快照用) */
export function targetPadDef(run: RunState): Pad | undefined {
  return run.pads[run.index + 1];
}

/** 起跳那一刻自动瞄准的方向 */
export function aimYaw(run: RunState): number {
  const def = targetPadDef(run);
  if (!def) return 0;
  return yawTo(currentPad(run), padTick(def, run.time));
}

/**
 * 正好踩中台心需要多大力度。
 * 移动台在飞行途中还会滑,所以用不动点迭代收敛几轮:力度决定飞行时长,
 * 飞行时长决定台子滑到哪儿,台子的位置又决定力度。
 */
export function requiredPower(run: RunState, iters = 6): number {
  const def = targetPadDef(run);
  if (!def) return 0.5;
  const from = currentPad(run);
  let p = powerForDistance(dist2d(from, padTick(def, run.time)));
  for (let k = 0; k < iters; k++) {
    p = powerForDistance(dist2d(from, padTick(def, run.time + flightTime(p))));
  }
  return p;
}

interface HopOpts {
  /** 弹簧台送的那一跳:直接把人送到台心,算完美 */
  assisted?: boolean;
  /** 弹簧串了几次了 */
  chain?: number;
}

function hopOnce(run: RunState, power: number, opts: HopOpts = {}): { state: RunState; result: HopResult } {
  const from = currentPad(run);
  const def = targetPadDef(run);
  const flight = flightTime(power);
  const landTime = run.time + flight;

  // 没有下一座台(理论上不会,ensure 一直在补)时按落空处理,绝不抛异常
  if (!def) {
    const landing = landPoint(from, power, 0);
    return {
      state: { ...run, alive: false, combo: 0, time: landTime },
      result: {
        verdict: "miss",
        power,
        yaw: 0,
        flight,
        from,
        landing,
        target: run.pads[run.index],
        targetIndex: run.index + 1,
        gained: 0,
        combo: 0,
        bonus: null,
      },
    };
  }

  const yaw = yawTo(from, padTick(def, run.time));
  const target = padTick(def, landTime);
  const landing = opts.assisted ? { x: target.x, z: target.z } : landPoint(from, power, yaw);
  const verdict: Verdict = opts.assisted ? "perfect" : onPad(landing, target);

  if (verdict === "miss") {
    return {
      state: { ...run, alive: false, combo: 0, time: landTime },
      result: {
        verdict,
        power,
        yaw,
        flight,
        from,
        landing,
        target,
        targetIndex: run.index + 1,
        gained: 0,
        combo: 0,
        bonus: null,
      },
    };
  }

  const perfect = verdict === "perfect";
  const combo = perfect ? run.combo + 1 : 0;
  const gained = score(combo, perfect);
  const pads = run.pads.slice();
  // 跳走了:一次台在这一刻塌掉
  pads[run.index] = leavePad(pads[run.index]);
  const index = run.index + 1;
  ensure(pads, index + LOOKAHEAD, run.seed, run.difficulty);
  armNext(pads, index, landTime);

  const state: RunState = {
    ...run,
    pads,
    index,
    time: landTime,
    score: run.score + gained,
    combo,
    bestCombo: Math.max(run.bestCombo, combo),
    perfects: run.perfects + (perfect ? 1 : 0),
    hops: run.hops + 1,
    alive: true,
  };

  return {
    state,
    result: { verdict, power, yaw, flight, from, landing, target, targetIndex: index, gained, combo, bonus: null },
  };
}

/**
 * 跳一次。落到弹簧台上会自动再弹一跳,那一跳稳稳踩中下一座的圆心
 * (连击也跟着 +1),串联最多 `SPRING_CHAIN_CAP` 次。
 */
export function hop(run: RunState, power: number, opts: HopOpts = {}): { state: RunState; result: HopResult } {
  if (!run.alive) {
    return {
      state: run,
      result: {
        verdict: "miss",
        power,
        yaw: 0,
        flight: 0,
        from: currentPad(run),
        landing: currentPad(run),
        target: run.pads[run.index],
        targetIndex: run.index,
        gained: 0,
        combo: 0,
        bonus: null,
      },
    };
  }

  const step = hopOnce(run, power, opts);
  const landed = step.state.pads[step.state.index];
  const chain = opts.chain ?? 0;
  if (
    step.result.verdict !== "miss" &&
    landed &&
    landed.kind === "spring" &&
    chain < SPRING_CHAIN_CAP
  ) {
    const boost = hop(step.state, requiredPower(step.state), { assisted: true, chain: chain + 1 });
    return { state: boost.state, result: { ...step.result, bonus: boost.result } };
  }
  return step;
}

/** 这一局一共前进了多少「座」(弹簧送的那一跳也算) */
export function padsCleared(run: RunState): number {
  return run.index;
}
