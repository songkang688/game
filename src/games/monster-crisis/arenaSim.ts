// 小怪物危机 1.2 —— 竞技场的无头陪练。
//
// 用一套写死的、完全确定性的「像样操作」把一局从头打到尾:
// 走位到目标外侧(精英怪的盾在正面,从外侧打才涂得上)、一直出手、
// 三选一按固定优先级挑。用来回答两件事:
//   1. 188 关在新玩法下真的守得住吗(抽样跑);
//   2. 四种模式是不是都能真的走到结算。
//
// 顺便当反面教材:`act: false` 时站着不动一手不出,必须真的守不住,
// 说明关卡不是白送的。这里只依赖 `arena.ts`,不碰 DOM,也不吃时间。

import {
  type ArenaInput,
  type ArenaResult,
  type ArenaState,
  HERO_R,
  chooseGrowth,
  stepArena,
} from "./arena";
import { type GrowthCard, type GrowthId } from "./growth";

export interface BotOptions {
  /** false = 站着不动也不出手 */
  act?: boolean;
  /** 按人指定谁动谁不动(对战里让一边摆烂,验证「先失守者输」) */
  acts?: boolean[];
  /** 超时保护(秒) */
  maxSeconds?: number;
  dt?: number;
  /** 三选一怎么挑;不给就按固定优先级 */
  pick?: (cards: GrowthCard[]) => GrowthId;
}

/** 固定优先级:攻速 > 多向 > 范围 > 吸附 > 护盾,保证回放一致。 */
const PICK_ORDER: GrowthId[] = ["rapid", "multi", "range", "magnet", "shield"];

export function defaultPick(cards: GrowthCard[]): GrowthId {
  for (const id of PICK_ORDER) {
    if (cards.some((c) => c.id === id)) return id;
  }
  return cards[0].id;
}

/** 站位:待在目标的「外侧」——从家往外看,人在怪的后面,盾正好背对着自己。 */
function desiredSpot(
  mx: number,
  my: number,
  homeX: number,
  homeY: number,
  standoff: number
): { x: number; y: number } {
  const dx = mx - homeX;
  const dy = my - homeY;
  const d = Math.hypot(dx, dy) || 1;
  return { x: mx + (dx / d) * standoff, y: my + (dy / d) * standoff };
}

function botInput(state: ArenaState, heroIdx: number): ArenaInput {
  const h = state.heroes[heroIdx];
  if (!h) return { mx: 0, my: 0, fire: false };
  const home = state.homes[h.side] ?? state.homes[0];

  // 最该管的那只:离家最近的
  let target: { x: number; y: number; r: number } | null = null;
  let bestD = Infinity;
  for (const m of state.monsters) {
    if (!m.active || m.side !== h.side) continue;
    const d = Math.hypot(m.x - home.x, m.y - home.y);
    if (d < bestD) {
      bestD = d;
      target = m;
    }
  }
  if (!target) {
    const dx = home.x - h.x;
    const dy = home.y - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 40) return { mx: 0, my: 0, fire: true };
    return { mx: dx / d, my: dy / d, fire: true };
  }

  const spot = desiredSpot(target.x, target.y, home.x, home.y, 44);
  let vx = spot.x - h.x;
  let vy = spot.y - h.y;
  const len = Math.hypot(vx, vy);
  if (len > 1) {
    vx /= len;
    vy /= len;
  } else {
    vx = 0;
    vy = 0;
  }

  // 别贴脸:太近就往外推一把(被撞会转圈,转圈就是白站着)
  for (const m of state.monsters) {
    if (!m.active || m.side !== h.side) continue;
    const dx = h.x - m.x;
    const dy = h.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d < HERO_R + m.r + 12 && d > 0.001) {
      vx += (dx / d) * 1.8;
      vy += (dy / d) * 1.8;
    }
  }
  const out = Math.hypot(vx, vy);
  return out > 0.001 ? { mx: vx / out, my: vy / out, fire: true } : { mx: 0, my: 0, fire: true };
}

/** 把一局打完,返回结算。超时也会给一个结算(算没守住),测试永远不会挂住。 */
export function runArena(state: ArenaState, opts: BotOptions = {}): ArenaResult {
  const act = opts.act !== false;
  const dt = opts.dt ?? 1 / 30;
  const maxSeconds = opts.maxSeconds ?? 900;
  const pick = opts.pick ?? defaultPick;
  const idle: ArenaInput = { mx: 0, my: 0, fire: false };

  const acting = (i: number): boolean => (opts.acts ? opts.acts[i] !== false : act);

  let guard = 0;
  const maxSteps = Math.ceil(maxSeconds / dt);
  while (state.phase !== "over" && guard++ < maxSteps) {
    if (state.drafts.length > 0) {
      const d = state.drafts[0];
      chooseGrowth(state, d.hero, acting(d.hero) ? pick(d.cards) : d.cards[0].id);
      continue;
    }
    const inputs: ArenaInput[] = state.heroes.map((h) => (acting(h.idx) ? botInput(state, h.idx) : idle));
    stepArena(state, dt, inputs);
  }

  if (!state.result) {
    return {
      win: false,
      winner: -1,
      jars: state.jars.slice(),
      maxJars: state.maxJars,
      wavesCleared: state.wavesCleared,
      waveTotal: state.waveTotal,
      popped: state.popped,
      elapsed: state.elapsed,
      weakSide: -1,
    };
  }
  return state.result;
}
