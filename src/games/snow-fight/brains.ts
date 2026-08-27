/**
 * 雪球大作战 1.2 · 人机对手的脑子(纯函数:看一眼场面,给一组这一帧的输入)。
 *
 * 它和小朋友玩的是同一套规则——同样要蹲下搓雪、同样只能攥三颗、
 * 同样得站起来蓄力才扔得出去,也同样会被砸成雪人。三档的差别只有三件事:
 *
 *  - `angleTol`:准星摆到多接近就敢松手(手抖的档次摆不准);
 *  - `chargeErr`:力度按得准不准;
 *  - `react`:想一想要多久,以及看见对面蓄力了会不会蹲下躲;
 *  - `windRead`:**出手前把风算进去几成**——风向大师算满,初学者压根不看旗子。
 *
 * 没有任何「电脑专属特权」:它不会隔墙看人,也不会凭空变出雪球。
 */
import {
  MOVE_SPEED,
  coverBehind,
  liveFoes,
  throwSpecOf,
  type Arena,
  type Fighter,
  type Input12,
} from "./arena";
import { STEP_12, clamp12, flight, predictLanding, solveCharge, stepBall, type Vec2 } from "./throw12";
import { HAND_MAX, ballsLeftAt, depthAt, richestSpot } from "./economy";
import { blocksBall, rowBase } from "./covers12";
import { canAct } from "./snowman";
import type { AiLevel } from "./physics";

export interface AiTuning {
  name: string;
  desc: string;
  /** 准星摆到差几度以内就敢开始蓄力 */
  angleTol: number;
  /** 力度误差(比例) */
  chargeErr: number;
  /** 每次重新想一想要几秒 */
  react: number;
  /** 看见对面站起来蓄力,每秒有多大概率蹲下躲一发 */
  dodge: number;
  /** 蹲下躲一次要蹲多久(秒) */
  duckTime: number;
  /**
   * 算落点的时候把风算进去几成(0..1)。
   *
   * 三档的名字里就写着这一条:「风向大师」出手前会抬头看旗子,初学者压根想不到这一层。
   * 可它以前只是句话——`planThrow` 对三档一视同仁地按真实风速解力度,
   * 谁都是完美的风速补偿器,差别只剩一点随机手抖。
   * 现在初学者按「没有风」去算,风多大就偏多远;
   * 风向大师照旧算满,一发就能吃住 3 级横风。
   *
   * 注意这只影响**它脑子里怎么算**,雪球飞出去照样吃真实的风:
   * 电脑没有特权,它只是看得准或看不准。
   */
  windRead: number;
}

export const AI_12: Record<AiLevel, AiTuning> = {
  easy: {
    name: "雪团初学者",
    desc: "准星摆得慢,力度也常常拿不准,还不会看风向旗。",
    angleTol: 9,
    chargeErr: 0.24,
    react: 1.1,
    dodge: 0.05,
    duckTime: 0.35,
    windRead: 0,
  },
  normal: {
    name: "雪球好手",
    desc: "力度挺准,风也会看一眼,偶尔会蹲下躲一发。",
    angleTol: 5,
    chargeErr: 0.14,
    react: 0.72,
    dodge: 0.3,
    duckTime: 0.35,
    windRead: 0.6,
  },
  hard: {
    name: "风向大师",
    desc: "出手前把风算满,看见你蓄力就先蹲下。",
    angleTol: 2.4,
    chargeErr: 0.05,
    react: 0.36,
    dodge: 0.6,
    duckTime: 0.35,
    windRead: 1,
  },
};

function idle(): Input12 {
  return { move: 0, aim: 0, crouch: false, charging: false };
}

/** 对面那个人现在是不是正举着雪球准备扔 */
export function foeIsWindingUp(a: Arena, me: Fighter): boolean {
  return a.fighters.some((f) => f.id !== me.id && f.charge !== null && f.charge > 0.5);
}

/** 已经飞在半空、快砸到我头上的那一发,还有多久到?没有就是 Infinity */
export const DUCK_LOOKAHEAD = 1;
export const DUCK_RADIUS = 2.4;

/**
 * 有没有一发雪球正朝我飞过来。
 *
 * 「看见球飞过来就蹲下」是小朋友的本能,电脑也得有——不然后面几章雪怪一多,
 * 它就杵在那儿一发一发挨砸,一整关都在变雪人和暖手之间来回,连球都搓不出来。
 * 蹲下本身还顺手搓雪,躲这一下不亏。
 */
/**
 * 「还有这么久砸到我」小于多少就该蹲下(秒)。
 *
 * 这一条以前是 `0.15 + react`,方向**是反的**:反应慢的档次 `react` 大,
 * 阈值反而高,于是初学者在球还有 1.25 秒才到的时候就蹲下了,
 * 风向大师要等到 0.51 秒才动。可 `incomingIn` 最多只往前看 `DUCK_LOOKAHEAD`(1 秒),
 * 1.25 秒的阈值等于「只要有球飞过来就一定蹲」——三档里最迟钝的那个反而躲得最干净,
 * 说明书上写的「档次差的是看得多晚」在防守这一侧从来没成立过。
 *
 * 现在按人的常识来:反应时间是**从看见到动起来的延迟**,
 * 留给自己的余量就少这么多。反应越慢的人越是等球快到脸上才蹲,
 * 也就越容易蹲晚了。下限 0.12 秒是「最后一刻扑一下」,
 * 让最菜的档次也保留一点本能,不至于站着挨完一整局。
 */
export function duckWhenUnder(react: number): number {
  return Math.max(0.12, DUCK_LOOKAHEAD - Math.max(0, react));
}

export function incomingIn(a: Arena, me: Fighter): number {
  let soonest = Infinity;
  for (const b of a.balls) {
    if (b.owner === me.id) continue;
    if (b.owner < 0 && me.ai !== null) continue; // 雪人对手不砸自己人
    if ((me.x - b.x) * Math.sign(b.vx || 1) < 0) continue;
    let ball = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    for (let t = 0; t < DUCK_LOOKAHEAD; t += STEP_12 * 4) {
      ball = stepBall(ball, STEP_12 * 4, a.wind);
      if (ball.y < -0.5) break;
      if (Math.hypot(ball.x - me.x, ball.y - 1) <= DUCK_RADIUS) {
        soonest = Math.min(soonest, t);
        break;
      }
    }
  }
  return soonest;
}

/** 每扔几颗就找对手本人一次 */
export const RIVAL_EVERY = 3;

/**
 * 这一帧想打的东西,按先后排一排。顺序和攻略里教小朋友的一模一样:
 *
 *  1. 隔三差五冲对手本人来一发——砸中他要僵 1.5 秒,这 1.5 秒够你从容打一盏灯笼。
 *     光顾着打灯笼的话两边就成了各扔各的,「躲」这一拍根本用不上;
 *  2. 先拦正往雪堡走的那一个,越靠前越急;
 *  3. 剩下的挑最近的打。
 *
 * 排成一排而不是只挑一个,是因为最想打的那个未必扔得着(掩体挡着 / 够不到),
 * 挡住了就顺着往下挑,而不是杵在原地。
 */
export function targetOrder(a: Arena, me: Fighter): Vec2[] {
  const foeSeat = 1 - me.seat;
  const pool = liveFoes(a, foeSeat);
  const list = pool.length > 0 ? pool : liveFoes(a).filter((f) => f.owner !== me.seat);
  const marching = list.filter((f) => f.march > 0).sort((p, q) => p.x - q.x);
  const rest = list
    .filter((f) => f.march <= 0)
    .sort((p, q) => Math.abs(p.x - me.x) - Math.abs(q.x - me.x));
  const foes = [...marching, ...rest].map((f) => ({ x: f.x, y: f.y + rowBase(f.row) }));
  const rival = a.fighters.find((f) => f.id !== me.id && canAct(f.hit));
  const out: Vec2[] = [];
  if (rival && (foes.length === 0 || me.thrown % RIVAL_EVERY === RIVAL_EVERY - 1)) {
    out.push({ x: rival.x, y: 0.9 });
  }
  out.push(...foes);
  return out;
}

/** 最想打的那一个(HUD 与用例用) */
export function pickTarget(a: Arena, me: Fighter): Vec2 | null {
  return targetOrder(a, me)[0] ?? null;
}

/** 电脑愿意试的仰角:先试顺手的平抛,不行再一路抬高越过掩体 */
export const TRY_ANGLES: readonly number[] = [30, 38, 46, 54, 62, 70, 76];

/** 它以为的风:真实风速乘上「看了几成旗子」 */
export function believedWind(wind: number, windRead: number): number {
  return wind * clamp12(windRead, 0, 1);
}

/**
 * 这一发该怎么扔:挑角度、解力度,还要**在脑子里飞一遍**看看撞不撞掩体。
 *
 * 少了「飞一遍」这一步,电脑会永远选最顺手的平抛,然后一整局把雪球全砸在中间那堵墙上——
 * 越是「准」的档次越吃亏,因为它连歪都不会歪过去。人是会抬高角度绕过去的,它也得会。
 *
 * `windRead` 是它**以为**的风占真实风的几成。整个规划(解力度、脑内试飞)都按这个信念走,
 * 球飞出去却吃真实的风——不看旗子的档次于是一发一发往下风偏,和小朋友犯的是同一个错。
 */
export function planThrow(
  a: Arena,
  me: Fighter,
  target: Vec2,
  fromX?: number,
  windRead = 1
): { angle: number; charge: number } | null {
  const base = throwSpecOf(me);
  const from = { x: fromX ?? base.x, y: base.y, dir: me.dir };
  const skip = coverBehind(a, me);
  const wind = believedWind(a.wind, windRead);
  for (const angle of TRY_ANGLES) {
    const charge = solveCharge({ ...from, angle }, target.x, wind, target.y);
    if (charge === null) continue;
    const path = flight({ ...from, angle, charge }, { wind, groundY: target.y, sampleEvery: 2 });
    let blocked = false;
    for (const p of path.points) {
      if ((p.x - target.x) * me.dir >= 0) break;
      for (const c of a.covers) {
        if (c.id === skip) continue;
        if (blocksBall(c, p)) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (!blocked) return { angle, charge };
  }
  return null;
}

/** 站得太近了吗:连最轻的一发都会飞过头,那就该往后退两步 */
export function tooCloseFor(a: Arena, me: Fighter, target: Vec2): boolean {
  const base = throwSpecOf(me);
  const soft = predictLanding({ x: base.x, y: base.y, dir: me.dir, angle: 62, charge: 0 }, a.wind, target.y);
  return (soft.x - target.x) * me.dir > 0;
}

/** 往前压的时候,和最靠前的靶子之间至少留这么宽 */
export const FRONT_GAP = 4;

/**
 * 这一帧允许站在哪一段里。
 *
 * 人只会朝自己面朝的方向扔,所以**越过靶子就等于放它过去**:
 * 压得太靠前,走过来的雪人从背后溜进雪堡,自己却只能干看着。
 * 所以往前压的上限永远卡在「最靠前那个靶子往回 `FRONT_GAP` 格」。
 */
export function standRange(a: Arena, me: Fighter): { lo: number; hi: number } {
  let lo = me.minX;
  let hi = me.maxX;
  for (const f of liveFoes(a)) {
    if (f.owner === me.seat) continue;
    if (me.dir === 1) hi = Math.min(hi, f.x - FRONT_GAP);
    else lo = Math.max(lo, f.x + FRONT_GAP);
  }
  return me.dir === 1 ? { lo: me.minX, hi: Math.max(me.minX, hi) } : { lo: Math.min(me.maxX, lo), hi: me.maxX };
}

/** 挑落脚点时每隔多远试一个 */
export const SEEK_STEP = 0.5;
/**
 * 落脚点要「站歪半格也还打得出去」才算数。
 *
 * 只要求「正好站这儿能打」会挑出一个**刚好够得着**的极限位置:
 * 前后差半步就够不着了,而走路是一帧 0.1 格、到了附近就停,
 * 于是它停在离那个点 0.2 格的地方,永远差这一口气,一整关杵着不动。
 * 要求左右各让开这么多也成立,挑出来的就是有余量的位置。
 */
export const SEEK_MARGIN = 0.6;

/**
 * 现在这个位置扔不出去,该挪到哪儿去?
 *
 * 把自己能走的那一段半格半格试一遍,挑「站在那儿(前后让半格也)有角度」的位置里
 * 离得最近的一个,一样近就优先往前压。整段都试不出来就先压到最前面——
 * 离得近总是更容易找到角度。
 *
 * 返回的是**一个位置**而不是一个方向:方向会来回打架——
 * 往后退一步有角度、退到了又变成往前压有角度,于是它在原地左右横跳一整局。
 * 认准一个位置走到底就不会了。
 */
export function seekSpot(a: Arena, me: Fighter, target: Vec2, windRead = 1): number {
  let best = -1;
  let bestCost = Infinity;
  const zone = standRange(a, me);
  for (let x = zone.lo; x <= zone.hi + 1e-6; x += SEEK_STEP) {
    const stand = clamp12(x, zone.lo, zone.hi);
    const hand = stand + me.dir * 0.6;
    if (!planThrow(a, me, target, hand, windRead)) continue;
    if (!planThrow(a, me, target, hand - SEEK_MARGIN, windRead)) continue;
    if (!planThrow(a, me, target, hand + SEEK_MARGIN, windRead)) continue;
    // 一样近的时候偏向「往前压」:压上去视野好,也更容易找到下一个角度
    const cost = Math.abs(stand - me.x) + ((stand - me.x) * me.dir < 0 ? 0.6 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = stand;
    }
  }
  if (best >= 0) return best;
  return tooCloseFor(a, me, target) ? zone.lo : zone.hi;
}

/**
 * 这一帧电脑想干什么。
 * 会顺手把「这一发打算怎么扔」记在 `me.plan` 上——那是它自己的小本子,不是全局状态。
 *
 * `level` 默认取这个人自己的档次;用例把它当「认真玩的小朋友」驱动真人座位时,
 * 可以显式传一档进来,而不用去改 `me.ai`(改了雪人对手就不认它是真人了)。
 */
export function aiInput(a: Arena, me: Fighter, dt: number, level: AiLevel | null = me.ai): Input12 {
  if (!level || !canAct(me.hit)) return idle();
  const tune = AI_12[level];
  me.think = Math.max(0, me.think - dt);

  // 手空了就一路蹲到攥满三颗:一颗一颗地补最容易被抓着打
  if (me.hands.balls <= 0) me.refilling = true;
  if (me.hands.balls >= HAND_MAX) me.refilling = false;
  if (me.refilling) {
    me.plan = null;
    if (ballsLeftAt(a.field, me.x) <= 0) {
      // 脚下挖秃了:先挪到雪厚的地方,这就是它的「阵地选择」
      const spot = richestSpot(a.field, me.x, 10);
      if (Math.abs(spot - me.x) > MOVE_SPEED * dt) {
        return { move: Math.sign(spot - me.x), aim: 0, crouch: false, charging: false };
      }
    }
    if (depthAt(a.field, me.x) > 0.02) return { move: 0, aim: 0, crouch: true, charging: false };
  }

  // 对面举着雪球:蹲下躲一发(蹲着还顺手搓雪,一举两得)
  if (me.duck > 0) {
    me.duck = Math.max(0, me.duck - dt);
    me.plan = null;
    return { move: 0, aim: 0, crouch: true, charging: false };
  }
  // 已经飞过来的那一发不看档次,谁都会躲——档次差的是「看得多晚」
  const eta = incomingIn(a, me);
  if (eta < duckWhenUnder(tune.react)) {
    me.duck = Math.max(0.1, eta + 0.1);
    me.plan = null;
    return { move: 0, aim: 0, crouch: true, charging: false };
  }
  if (foeIsWindingUp(a, me) && a.rand() < tune.dodge * dt) {
    me.duck = tune.duckTime;
    me.plan = null;
    return { move: 0, aim: 0, crouch: true, charging: false };
  }

  if (!me.plan && me.think <= 0) {
    const wish = targetOrder(a, me);
    let aim: { angle: number; charge: number } | null = null;
    for (const t of wish) {
      aim = planThrow(a, me, t, undefined, tune.windRead);
      if (aim) break;
    }
    if (aim) {
      const err = (a.rand() * 2 - 1) * tune.chargeErr;
      me.plan = {
        angle: aim.angle + (a.rand() * 2 - 1) * tune.angleTol * 0.6,
        charge: clamp12(aim.charge * (1 + err), 0.05, 1.2),
      };
      me.seek = -1;
    } else if (wish.length > 0 && (me.seek < 0 || Math.abs(me.x - me.seek) < 0.5)) {
      // 一个都扔不着:照着最想打的那个挪阵地
      me.seek = seekSpot(a, me, wish[wish.length - 1], tune.windRead);
    }
    me.think = tune.react;
  }
  const plan = me.plan;
  // 没角度就往定好的位置走。这里必须**每一帧**都走——
  // 只在「想一想」的那一帧走的话,它半秒才挪一小步,一整局都在原地磨蹭,
  // 反应越快的档次反而越磨蹭,三档强弱就反过来了。
  if (!plan) {
    const zone = standRange(a, me);
    const dest = clamp12(me.seek >= 0 ? me.seek : me.x + me.dir * 2, zone.lo, zone.hi);
    const gap = dest - me.x;
    // 「到了」的判定要比一帧走的距离还小,不然它会停在目标点前面一小截
    const near = Math.max(0.02, MOVE_SPEED * dt * 0.9);
    return { move: Math.abs(gap) <= near ? 0 : Math.sign(gap), aim: 0, crouch: false, charging: false };
  }

  const diff = plan.angle - me.aim;
  if (Math.abs(diff) > tune.angleTol) {
    return { move: 0, aim: Math.sign(diff), crouch: false, charging: false };
  }
  // 准星到位了:按住蓄力,按够了就松手
  if ((me.charge ?? 0) < plan.charge) {
    return { move: 0, aim: 0, crouch: false, charging: true };
  }
  me.plan = null;
  me.think = tune.react;
  return { move: 0, aim: 0, crouch: false, charging: false };
}

/** 给画面用的一句自我介绍 */
export function aiTitle(level: AiLevel): string {
  const t = AI_12[level];
  return `${t.name}(${t.desc})`;
}
