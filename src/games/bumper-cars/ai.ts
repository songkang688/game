// 碰碰车大乱斗 · 电脑车手(四档)。
//
// 决策全是纯函数:同样的世界 + 同样的 tick 一定给出同样的动作,
// 所以无头单测可以直接用它把一整局打完,验证「真的分得出胜负」。
//
// 四档的差别不是靠数值加成作弊,而是靠「看得多远、想得多准」:
//  - 1 会瞎撞:朝最近的人直冲,不看悬崖也不看角度;
//  - 2 会追:方向稳了,懂得别把自己挂在场边;
//  - 3 会预判走位:按对手的速度取提前量,绕到它的悬崖侧,还会躲滚桶;
//  - 4 会卡边角逼出界:专挑离悬崖最近的对手,提前攒好蓄力,盯着正在打转的车补最后一下。
import {
  CAR_R,
  MAX_SPEED,
  boundaryHit,
  carActive,
  fieldCenter,
  hypot,
  worldEdge,
  type Car,
  type Intent,
  type World,
} from "./logic";

export type AiLevel = 1 | 2 | 3 | 4;

export const AI_LABEL: Record<AiLevel, string> = {
  1: "新手车手",
  2: "熟练车手",
  3: "冠军车手",
  4: "卡角高手",
};

/** 每一档的性格参数(导出是为了让调参单测能横向对比,运行时不改它) */
export interface Trait {
  /** 离边缘多近开始往回打方向 */
  edgeCare: number;
  /** 提前量:按当前外飘速度多留出几秒的刹车距离 */
  react: number;
  /** 多近才舍得按冲刺 */
  dashRange: number;
  /** 方向抖动幅度(越大越手抖) */
  jitter: number;
  /** 会不会绕到对手的悬崖侧 */
  flank: boolean;
  /** 会不会躲滚桶 */
  dodge: boolean;
  /** 预判走位:按对手当前速度往前推算几秒的落点(0 = 只追此刻的位置) */
  lead: number;
  /** 会不会攒蓄力去打强撞 */
  chargeUp: boolean;
  /** 会不会专挑「已经被逼到角落 / 正在打转」的对手下手 */
  corner: boolean;
  /**
   * 自己挂在台沿上打转时,往场内使出几成劲(0..1)。
   *
   * 打转时车轮悬空,`teeterCrawl` 只认方向摇杆压得有多满:
   * 新手一慌就乱打方向,劲使不到点子上,两秒里蹭不回台面;
   * 冠军会把车头对准场心一推到底,基本都能自己开回来。
   */
  lipSave: number;
}

export const TRAITS: Record<AiLevel, Trait> = {
  // 1 会瞎撞:油门踩死往前冲,不看悬崖也不看角度,冲刺要贴脸了才想起来按
  1: { edgeCare: 3, react: 0, dashRange: 9, jitter: 0.45, flank: false, dodge: false, lead: 0, chargeUp: false, corner: false, lipSave: 0.4 },
  // 2 会追:方向稳多了,也知道别把自己挂在边上,但还不会绕位
  2: { edgeCare: 8, react: 0.35, dashRange: 14, jitter: 0.2, flank: false, dodge: false, lead: 0, chargeUp: false, corner: false, lipSave: 0.6 },
  // 3 会预判走位:按对手速度取提前量,绕到它的悬崖侧,滚桶也躲得开
  3: { edgeCare: 12, react: 0.7, dashRange: 16, jitter: 0.06, flank: true, dodge: true, lead: 0.16, chargeUp: false, corner: false, lipSave: 0.95 },
  // 4 会卡边角逼出界:提前攒蓄力,专挑贴着悬崖和正在打转的对手补最后一下
  4: { edgeCare: 13, react: 0.85, dashRange: 18, jitter: 0.04, flank: true, dodge: true, lead: 0.24, chargeUp: true, corner: true, lipSave: 1 },
};

/** 四档从弱到强的顺序,给调参单测和难度选择器用 */
export const AI_LEVELS: AiLevel[] = [1, 2, 3, 4];

/** 确定性伪噪声:同一个 tick 与座位号永远得到同一个抖动 */
export function wobble(tick: number, salt: number): number {
  const t = Math.sin(tick * 12.9898 + salt * 78.233) * 43758.5453;
  return (t - Math.floor(t)) * 2 - 1;
}

/** 场上离我最近、还活着的对手 */
export function nearestFoe(world: World, me: Car): Car | null {
  let best: Car | null = null;
  let bestD = Infinity;
  for (const c of world.cars) {
    if (c.id === me.id || c.team === me.team || !carActive(c)) continue;
    const d = hypot(c.x - me.x, c.y - me.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * 挑这一帧要收拾谁:近的好追,但**已经站在悬崖边上的那台更值得追**——
 * 一样是撞一下,把它撞下去的收益高得多。新手档想不到这一层,只会追最近的。
 */
export function pickTarget(world: World, me: Car, edgeMinded: boolean, cornerMinded = false): Car | null {
  if (!edgeMinded) return nearestFoe(world, me);
  let best: Car | null = null;
  let bestScore = Infinity;
  for (const c of world.cars) {
    if (c.id === me.id || c.team === me.team || !carActive(c)) continue;
    let score = hypot(c.x - me.x, c.y - me.y) * 0.6 + worldEdge(world, c.x, c.y) * 1.4;
    // 有人已经在场边打转:补一下就出局,这是全场最划算的目标。
    // 卡角档看得更死,再远也要赶过去。
    if (c.teeter > 0) score -= cornerMinded ? 80 : 45;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** 按对手当前速度往前推 lead 秒的落点:这就是「预判走位」 */
export function leadPoint(foe: Car, lead: number): { x: number; y: number } {
  if (lead <= 0) return { x: foe.x, y: foe.y };
  return { x: foe.x + foe.vx * lead, y: foe.y + foe.vy * lead };
}

/**
 * 从场地中心指向某个点的单位向量:这就是「把它往外推」的方向,
 * 也是电脑判断该绕到哪一侧的依据。
 */
export function outwardDir(world: World, x: number, y: number): { x: number; y: number } {
  const c = fieldCenter(world.field);
  const dx = x - c.x;
  const dy = y - c.y;
  const len = hypot(dx, dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** 夹在 0..1 之间 */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 闯关时谁上场开打:对手不会一拥而上围殴玩家,
 * 每隔几秒轮换一次「出战名额」,其余的车在外圈绕着等下一轮。
 * 纯函数,给定同样的世界与时间一定给出同样的名单。
 */
export function huntersFor(world: World, maxHunters: number, timeMs: number): Set<number> {
  const out = new Set<number>();
  const hero = world.cars.find((c) => c.team === 0 && carActive(c));
  const foes: Array<{ i: number; d: number }> = [];
  world.cars.forEach((c, i) => {
    if (c.team === 0 || !carActive(c)) return;
    foes.push({ i, d: hero ? hypot(c.x - hero.x, c.y - hero.y) : i });
  });
  if (foes.length === 0) return out;
  foes.sort((a, b) => a.d - b.d || a.i - b.i);
  const slots = Math.max(1, Math.min(maxHunters, foes.length));
  // 每 4 秒把名额往后挪一位,免得永远是同一台车在追
  const shift = Math.floor(Math.max(0, timeMs) / 4000) % foes.length;
  for (let k = 0; k < slots; k++) out.add(foes[(shift + k) % foes.length].i);
  return out;
}

/** 没轮到自己出战时怎么开:沿着中圈慢慢兜,别贴着悬崖也别挡着队友 */
function patrolIntent(world: World, me: Car, tick: number): Intent {
  const center = fieldCenter(world.field);
  const dx = me.x - center.x;
  const dy = me.y - center.y;
  const dist = Math.max(0.001, hypot(dx, dy));
  const ring = Math.min(world.field.w, world.field.h) * 0.3;
  // 切向绕圈 + 往目标半径靠拢
  const tanX = -dy / dist;
  const tanY = dx / dist;
  const pull = (ring - dist) / Math.max(1, ring);
  const vx = tanX * 0.8 + (dx / dist) * pull;
  const vy = tanY * 0.8 + (dy / dist) * pull;
  const n = Math.max(0.001, hypot(vx, vy));
  const shake = 0.12 * wobble(tick, me.id + 5);
  const cos = Math.cos(shake);
  const sin = Math.sin(shake);
  const bx = vx / n;
  const by = vy / n;
  return { dx: bx * cos - by * sin, dy: bx * sin + by * cos, dash: false, brake: false };
}

/**
 * 一台电脑车这一帧想干什么。
 *
 * 整个决策是一次**加权混合**,不是一堆互相打架的 if:
 * 「追着对手的内侧打」和「把车头掰回场内」两个方向按危险程度调配比例,
 * 所以电脑不会在两种想法之间来回抽风,开出来的线路是连贯的。
 * tick 只用来产生确定性抖动,不影响任何物理量;
 * mode 传 "patrol" 时这台车这一轮不出战,只在外圈兜圈子等下一轮。
 */
export function chooseCarAction(
  world: World,
  index: number,
  skill: AiLevel,
  tick: number,
  mode: "hunt" | "patrol" = "hunt"
): Intent {
  const me = world.cars[index];
  if (!me || !carActive(me)) return { dx: 0, dy: 0, dash: false, brake: false };
  const trait = TRAITS[skill];
  if (mode === "patrol") return patrolIntent(world, me, tick);
  const center = fieldCenter(world.field);

  const myEdge = worldEdge(world, me.x, me.y);
  const backLen = Math.max(0.001, hypot(center.x - me.x, center.y - me.y));
  const inX = (center.x - me.x) / backLen;
  const inY = (center.y - me.y) / backLen;
  // 沿着「往场外」方向的速度分量:正数就是正在被推向悬崖
  const speedOut = -(me.vx * inX + me.vy * inY);

  // 0. 自己正挂在台沿上打转:这两秒里没有别的事好做,只有把方向死死顶向场心。
  //    档位越低越慌,劲使不满,两秒一到车就滑下去了。
  if (me.teeter > 0) {
    // 要顶的是「离台沿最近的那条法线」,不是场心方向:挂在角上的时候这两个差着 45°,
    // 对着场心猛推反而蹭不回台面。
    const lip = boundaryHit(world.field, me.x, me.y, world.inset);
    const bx = lip.nx === 0 && lip.ny === 0 ? inX : lip.nx;
    const by = lip.nx === 0 && lip.ny === 0 ? inY : lip.ny;
    const shake = trait.jitter * 0.6 * wobble(tick, me.id + 9);
    const cos = Math.cos(shake);
    const sin = Math.sin(shake);
    const k = trait.lipSave;
    return { dx: (bx * cos - by * sin) * k, dy: (bx * sin + by * cos) * k, dash: false, brake: false };
  }

  const foe = pickTarget(world, me, trait.flank, trait.corner);
  if (!foe) {
    // 场上没人可撞就回中间待命,别停在悬崖边上等着挨撞
    return { dx: inX * 0.6, dy: inY * 0.6, dash: false, brake: backLen < me.r };
  }

  // 1. 站到对手的内侧:从这里撞过去,推力正好指着最近的悬崖。
  //    高档位会按对手的速度取一点提前量(预判走位),低档位只追它此刻的位置。
  const gap = hypot(foe.x - me.x, foe.y - me.y);
  const push = outwardDir(world, foe.x, foe.y);
  const touch = (me.r + foe.r) * 1.7;
  // 贴上去之后就别再预判了,不然车头会一直偏在旁边蹭不实
  const aimAt = gap < touch ? { x: foe.x, y: foe.y } : leadPoint(foe, trait.lead);
  let tx = aimAt.x;
  let ty = aimAt.y;
  if (trait.flank) {
    if (gap < touch) {
      // 已经顶上了:别再绕位,顺着「场心 → 对手」的方向一路把它推下去
      tx = foe.x + push.x * touch;
      ty = foe.y + push.y * touch;
    } else {
      tx = aimAt.x - push.x * (me.r + foe.r) * 1.05;
      ty = aimAt.y - push.y * (me.r + foe.r) * 1.05;
    }
  }
  const chaseLen = Math.max(0.001, hypot(tx - me.x, ty - me.y));
  let dx = (tx - me.x) / chaseLen;
  let dy = (ty - me.y) / chaseLen;

  // 2. 危险权重:越靠边、被推得越狠,往回打方向的比重就越大。
  //    留出的余量按外飘速度算——开得越快,越要提前掉头。
  const need = trait.edgeCare + Math.max(0, speedOut) * trait.react + me.r;
  let danger = clamp01((need - myEdge) / Math.max(1, need));
  if (danger > 0) {
    dx = dx * (1 - danger) + inX * danger;
    dy = dy * (1 - danger) + inY * danger;
    const n = Math.max(0.001, hypot(dx, dy));
    dx /= n;
    dy /= n;
  }

  // 3. 躲开滚桶:近距离时把方向往侧面掰一点(只有冠军档会算这一步)
  if (trait.dodge) {
    for (const h of world.hazards) {
      const hx = me.x - h.x;
      const hy = me.y - h.y;
      const d = hypot(hx, hy);
      if (d > h.r + me.r * 2.6 || d < 0.001) continue;
      dx += (hx / d) * 0.7;
      dy += (hy / d) * 0.7;
    }
    const n = Math.max(0.001, hypot(dx, dy));
    dx /= n;
    dy /= n;
  }

  // 4. 手抖:档位越低方向越飘
  const shake = trait.jitter * wobble(tick, me.id + 1);
  const cos = Math.cos(shake);
  const sin = Math.sin(shake);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  // 5. 冲刺:新手看见人就冲;熟练与冠军会先确认「我在里、它在外」,
  //    这一撞的推力才真的指向悬崖,不然只是白白交掉冷却。
  const toFoeX = (foe.x - me.x) / Math.max(0.001, gap);
  const toFoeY = (foe.y - me.y) / Math.max(0.001, gap);
  const aligned = rx * toFoeX + ry * toFoeY;
  const pushingOut = toFoeX * push.x + toFoeY * push.y;
  const goodAngle = trait.flank ? pushingOut > 0.15 : true;
  const dash = me.dashCd <= 0 && gap < trait.dashRange && aligned > 0.62 && goodAngle;

  // 6. 被顶向悬崖时点一脚刹车,把外飘的速度先吃掉
  const brake = speedOut > MAX_SPEED * 0.2 && myEdge < need;

  // 7. 蓄力冲撞(只有卡角档会用):对手还有一段距离时先按住攒力,
  //    等真的贴上去、角度也对了再松手,那一下正好把它顶下台。
  //    自己还在危险区就别攒了——蓄力期间车会慢下来,那正是最不该慢的时候。
  const chargeWindow = trait.chargeUp && me.chargeCd <= 0 && danger < 0.35 && goodAngle;
  const charge = chargeWindow && gap > touch * 0.92 && gap < trait.dashRange * 2.2;

  return { dx: rx, dy: ry, dash, brake, charge };
}
