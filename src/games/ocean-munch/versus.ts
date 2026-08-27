// 海底大胃王 · 对战「限时谁更胖」(1.2 第 10 步新增)
//
// 60 秒同池抢食,时间到谁的体型大谁赢。**只做人机,不做同屏双人**——
// 同屏双人要抢键位,和红蓝系那几款冲突;而且这一款的张力在「谁比谁大」,
// 两条人手鱼互相不能吃,反而变成各刷各的。
//
// 这里只放纯函数:三档 AI 的转向决策、胜负判定、结算文案。
// 真正的追逐、碰撞、画面都在 index.ts 的同一套竞技场循环里跑。

import { canSwallow, isPredator } from "./endless";

/** 一局对战多少秒。 */
export const VERSUS_SECONDS = 60;

/** 三档对手:乱游 / 会躲 / 会反杀。 */
export type RivalLevel = "wander" | "dodge" | "hunter";

export const RIVAL_LEVELS: readonly RivalLevel[] = ["wander", "dodge", "hunter"];

export interface RivalProfile {
  id: RivalLevel;
  name: string;
  emoji: string;
  blurb: string;
  /** 游速相对玩家的倍率 */
  speedMul: number;
  /** 能看见多远的小鱼 */
  sight: number;
  /** 会不会躲比自己大的东西(含玩家) */
  dodges: boolean;
  /** 比你大的时候会不会追过来咬你 */
  hunts: boolean;
  /** 决策抖动:越大越像在乱游 */
  jitter: number;
}

export const RIVAL_PROFILES: Record<RivalLevel, RivalProfile> = {
  wander: {
    id: "wander",
    name: "迷糊鱼",
    emoji: "🐟",
    blurb: "东游西逛,撞上什么吃什么",
    speedMul: 0.86,
    sight: 150,
    dodges: false,
    hunts: false,
    jitter: 0.9,
  },
  dodge: {
    id: "dodge",
    name: "灵灵鱼",
    emoji: "🐠",
    blurb: "抢食积极,看见大个子就闪",
    speedMul: 0.98,
    sight: 260,
    dodges: true,
    hunts: false,
    jitter: 0.35,
  },
  hunter: {
    id: "hunter",
    name: "刁刁鱼",
    emoji: "🦈",
    blurb: "自己长大了还会掉头来咬你",
    speedMul: 1.06,
    sight: 380,
    dodges: true,
    hunts: true,
    jitter: 0.12,
  },
};

export interface Spot {
  x: number;
  y: number;
  r: number;
}

export interface RivalView {
  /** 对手自己 */
  self: Spot;
  /** 玩家 */
  player: Spot;
  /** 视野里最近的、吃得下的小鱼(没有就 null) */
  prey: Spot | null;
  /** 视野里最近的、吃不下的大鱼(没有就 null) */
  threat: Spot | null;
  /** 池子尺寸,用来把自己拉回场内 */
  width: number;
  height: number;
}

export interface RivalMove {
  /** 单位向量;要是这一帧不想动就是 (0,0) */
  dx: number;
  dy: number;
  /** 要不要点一下冲刺 */
  dash: boolean;
}

function unit(dx: number, dy: number): { dx: number; dy: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { dx: 0, dy: 0 };
  return { dx: dx / len, dy: dy / len };
}

/**
 * 对手这一帧往哪游。优先级:
 *  1. 会躲的档:身边有吃不下的东西(包括长得比它大的玩家)就先闪开;
 *  2. 会反杀的档:自己比玩家大一圈时掉头追玩家;
 *  3. 视野里有吃得下的小鱼就去追;
 *  4. 什么都没有就顺着抖动乱游,顺便别贴着池壁。
 *
 * `rng` 只用来做抖动:同一个种子必须给出同一串动作。
 */
export function rivalSteer(profile: RivalProfile, view: RivalView, rng: () => number): RivalMove {
  const { self, player } = view;
  const jitterX = (rng() - 0.5) * profile.jitter;
  const jitterY = (rng() - 0.5) * profile.jitter;

  // 1. 躲
  if (profile.dodges) {
    const dangers: Spot[] = [];
    if (view.threat) dangers.push(view.threat);
    if (isPredator(self.r, player.r)) dangers.push(player);
    let closest: Spot | null = null;
    let best = Infinity;
    for (const d of dangers) {
      const dist = Math.hypot(d.x - self.x, d.y - self.y);
      if (dist < best) {
        best = dist;
        closest = d;
      }
    }
    if (closest && best < profile.sight * 0.65) {
      const away = unit(self.x - closest.x + jitterX * 40, self.y - closest.y + jitterY * 40);
      return { dx: away.dx, dy: away.dy, dash: best < 120 };
    }
  }

  // 2. 反杀
  if (profile.hunts && canSwallow(self.r, player.r)) {
    const chase = unit(player.x - self.x, player.y - self.y);
    const dist = Math.hypot(player.x - self.x, player.y - self.y);
    return { dx: chase.dx, dy: chase.dy, dash: dist > 140 };
  }

  // 3. 抢食
  if (view.prey) {
    const dist = Math.hypot(view.prey.x - self.x, view.prey.y - self.y);
    if (dist <= profile.sight) {
      const go = unit(view.prey.x - self.x + jitterX * 30, view.prey.y - self.y + jitterY * 30);
      return { dx: go.dx, dy: go.dy, dash: dist > profile.sight * 0.6 };
    }
  }

  // 4. 乱游:抖动 + 往池心带一点,免得贴着壁转圈
  const toCenter = unit(view.width / 2 - self.x, view.height / 2 - self.y);
  const wanderX = jitterX * 2 + toCenter.dx * 0.5;
  const wanderY = jitterY * 2 + toCenter.dy * 0.5;
  const go = unit(wanderX, wanderY);
  return { dx: go.dx, dy: go.dy, dash: false };
}

/* ------------------------------------------------------------------ */
/* 胜负与文案                                                          */
/* ------------------------------------------------------------------ */

export type VersusOutcome = "win" | "lose" | "draw";

/** 差不到 1 个像素就算平局——比到这个份上说「你俩一样胖」比分胜负好听。 */
export const DRAW_SLACK = 1;

export function versusOutcome(playerR: number, rivalR: number): VersusOutcome {
  if (Math.abs(playerR - rivalR) <= DRAW_SLACK) return "draw";
  return playerR > rivalR ? "win" : "lose";
}

export interface VersusCopy {
  title: string;
  line: string;
  lines: [string, string];
}

/** 结算文案:赢了夸,输了也只鼓励,一句批评都不留。 */
export function versusCopy(
  outcome: VersusOutcome,
  profile: RivalProfile,
  playerR: number,
  rivalR: number,
): VersusCopy {
  const me = Math.round(playerR);
  const it = Math.round(rivalR);
  const head = `你 ${me} · ${profile.name} ${it}`;
  if (outcome === "win") {
    return {
      title: "你更胖!赢啦",
      line: `${head}。你吃得又快又稳,${profile.name}都追不上你!`,
      lines: [head, `你吃得又快又稳,${profile.name}都追不上你!`],
    };
  }
  if (outcome === "draw") {
    return {
      title: "一样胖!平局",
      line: `${head}。你俩一样胖,再来一局分个高下?`,
      lines: [head, "你俩一样胖,再来一局分个高下?"],
    };
  }
  return {
    title: "这局它更胖一点",
    line: `${head}。下次盯着扎堆的小鱼连着吃,长得比它快!`,
    lines: [head, "下次盯着扎堆的小鱼连着吃,长得比它快!"],
  };
}
