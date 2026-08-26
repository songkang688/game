// 彩虹跑跑 · 无头跑图模拟器(1.1 第 4 步新增)
//
// 把 index.ts 里那套「每 ROW_GAP 刷一行花样 → 障碍向下滚 → 到玩家身位判定」的循环
// 原样搬成不依赖 DOM 的纯计算,再配一个固定策略的自动玩家。
// 它回答的是一个很实际的问题:第 100–188 关这批新关,按人类够得着的操作密度,
// 到底跑不跑得完、大王打不打得死。
//
// 与渲染层的对齐点:JUMP_TIME / SLIDE_TIME / HIT_WINDOW / ROW_GAP 都从 logic.ts 取,
// 玩家身位、刷新位置、道具节奏与 index.ts 的常量保持一致。

import {
  BOARD_SECONDS,
  BOSSES,
  BossDef,
  HIT_WINDOW,
  JET_SECONDS,
  JUMP_TIME,
  LEVELS,
  LevelDef,
  MAGNET_SECONDS,
  MAX_HEARTS,
  ObstacleKind,
  PatternRow,
  PlayerAction,
  PowerKind,
  RAIL_SECONDS,
  ROLLER_SPEED_MULT,
  ROW_GAP,
  RunStats,
  SLIDE_TIME,
  bossDefeated,
  bossHitsOf,
  clampLane,
  completesPerfectRun,
  forkRows,
  isPerfectJump,
  missionDone,
  nextPerfectStreak,
  patternsForLevel,
  pickFork,
  railSpeedMult,
  smashesCrate,
  starsForLevel,
  wouldHit,
  zapperActive,
} from "./logic";
import type { Rng } from "../__tests__/campaignSim";
import { makeRng } from "../__tests__/campaignSim";

/** 画布尺寸:按 375×667 窄屏(最难的那一档)算,和 index.ts 的布局公式一致。 */
const SCREEN_W = 375;
const SCREEN_H = 640;
const PLAYER_Y = SCREEN_H * 0.78;
const laneX = (l: number): number => SCREEN_W * (0.5 + (l - 1) * 0.26);
const SPAWN_Y = -50;
const DESPAWN_Y = SCREEN_H + 60;
const DT = 1 / 60;
/** 一局最多算多少秒,防止哪天写出无限循环 */
const MAX_SECONDS = 90;

/** 只能换道躲的障碍(和 logic.ts 的 BLOCKING 同口径,这里只给 AI 打分用)。 */
const DODGE_ONLY: ReadonlySet<ObstacleKind> = new Set<ObstacleKind>([
  "rock",
  "cloudy",
  "roller",
  "zapper",
]);

export type SimPolicy =
  /** 正常打:该躲的躲、该铲的铲、节奏段追完美跳 */
  | "play"
  /**
   * 只保命:换道躲、老远就起跳(所以一次完美跳都打不出来)、遇箱子跳过去不铲。
   * 用来验证大王关真的有失败分支——活着跑到终点,但大王一点血都没掉。
   */
  | "survive"
  /** 摆烂:一直往前跑,什么都不做 */
  | "idle";

/** 正常打贴着障碍起跳(能吃到完美判定),只保命时老早就跳。 */
const JUMP_LEAD = { play: 0.16, survive: 0.45, idle: 0 };
const SLIDE_LEAD = { play: 0.22, survive: 0.45, idle: 0 };

export interface SimOptions {
  /** 随机源;不给就用 seed 造一个 */
  rng?: Rng;
  seed?: number;
  policy?: SimPolicy;
}

export interface SimResult {
  win: boolean;
  /** finish=跑到终点;hearts=心掉光;boss=终点前没打死大王;timeout=超时 */
  reason: "finish" | "hearts" | "boss" | "timeout";
  note: string;
  stats: RunStats;
  missionOk: boolean;
  /** 通关才有星级,没通关是 0 */
  stars: 0 | 1 | 2 | 3;
  heartsLeft: number;
  seconds: number;
  /** 一共刷了多少行花样 */
  rows: number;
  /** 大王关:打中了多少下 / 需要多少下 */
  bossHits: number;
  bossHp: number;
  /** 掉心分别是被哪种障碍打掉的,调关卡时用来定位 */
  hitBy: Partial<Record<ObstacleKind, number>>;
}

interface SimObstacle {
  baseLane: number;
  kind: ObstacleKind;
  y: number;
  phase: number;
  /** 已经结算过(撞了/铲了/完美跳过),不再重复计 */
  done: boolean;
}

interface SimPickup {
  kind: "star" | "coin" | "rail" | PowerKind;
  lane: number;
  x: number;
  y: number;
}

function obstacleLane(o: SimObstacle): number {
  if (o.kind !== "cloudy") return o.baseLane;
  return clampLane(Math.round(o.baseLane + Math.sin(o.phase) * 1.2));
}

/** 云朵怪在 dt 秒之后会飘到哪条道(其他障碍不动)。 */
function laneAfter(o: SimObstacle, dt: number): number {
  if (o.kind !== "cloudy") return o.baseLane;
  return clampLane(Math.round(o.baseLane + Math.sin(o.phase + dt * 1.6) * 1.2));
}

/** 障碍相对路面的速度倍率。 */
function obstacleMult(kind: ObstacleKind): number {
  return kind === "roller" ? ROLLER_SPEED_MULT : 1;
}

function cloneRow(row: PatternRow): PatternRow {
  return {
    obstacles: row.obstacles.map((o) => ({ ...o })),
    stars: [...row.stars],
    coins: [...row.coins],
    rails: row.rails ? [...row.rails] : undefined,
    beat: row.beat,
  };
}

/**
 * 用固定策略把第 idx 关(0 起)跑一遍。
 * 返回胜负、任务完成情况与星级,失败时 note 里说清是怎么输的。
 */
export function simulateLevel(idx: number, opts: SimOptions = {}): SimResult {
  const def: LevelDef = LEVELS[idx];
  const rng: Rng = opts.rng ?? makeRng(opts.seed ?? idx + 1);
  const policy: SimPolicy = opts.policy ?? "play";
  const boss: BossDef | null = def.boss ? BOSSES[def.boss] : null;
  const pool = patternsForLevel(def);
  // 任务决定「顺路要不要绕过去」:铲箱/打大王要主动找箱子,节奏任务要主动找栅栏
  const wantsCrates = policy === "play" && (def.mission.type === "smash" || def.mission.type === "boss");
  const wantsJumps = policy === "play" && (def.mission.type === "perfect" || def.mission.type === "boss");

  const stats: RunStats = {
    coins: 0,
    stars: 0,
    dodged: 0,
    heartsLost: 0,
    smashed: 0,
    perfectRuns: 0,
    bossHits: 0,
  };

  const obstacles: SimObstacle[] = [];
  const pickups: SimPickup[] = [];
  let pending: PatternRow[] = [];

  let dist = 0;
  let time = 0;
  let rowDist = 0;
  let rows = 0;
  let lane = 1;
  let action: PlayerAction = "run";
  let actionTimer = 0;
  let jumpElapsed = 0;
  // 一次跳只判一次完美:落地前顺带带过的第二道障碍不参与连击
  let jumpJudged = false;
  let hearts = MAX_HEARTS;
  let invincible = 2;
  let magnetTimer = 0;
  let jetTimer = 0;
  let boardTimer = 0;
  let railTimer = 0;
  let perfectStreak = 0;
  let powerTimer = 7;
  // 分岔口:每隔一段路出现一次
  let forkTimer = def.fork ? 5 : Infinity;

  function spawnRow(row: PatternRow): void {
    for (const o of row.obstacles) {
      obstacles.push({ baseLane: o.lane, kind: o.kind, y: SPAWN_Y, phase: rng() * Math.PI * 2, done: false });
    }
    for (const l of row.stars) pickups.push({ kind: "star", lane: l, x: laneX(l), y: SPAWN_Y });
    for (const l of row.coins) pickups.push({ kind: "coin", lane: l, x: laneX(l), y: SPAWN_Y });
    if (def.rails) {
      for (const l of row.rails ?? []) pickups.push({ kind: "rail", lane: l, x: laneX(l), y: SPAWN_Y });
    }
  }

  /** 某条道在接下来一段时间里的危险度(越大越不该走)。 */
  function laneCost(target: number, speed: number): number {
    let cost = Math.abs(target - lane) * 0.6;
    for (const o of obstacles) {
      if (o.done) continue;
      const v = speed * obstacleMult(o.kind);
      const t = (PLAYER_Y - o.y) / v;
      if (t < -0.05 || t > 1.4) continue;
      // 云朵怪会飘,按「到达身位前后那一小段」可能占的道一起算,别贴着它走
      const tt = Math.max(0, t);
      const occupies =
        o.kind === "cloudy"
          ? laneAfter(o, tt) === target ||
            laneAfter(o, tt - 0.14) === target ||
            laneAfter(o, tt + 0.14) === target
          : o.baseLane === target;
      if (!occupies) continue;
      const near = 1 / (t + 0.12);
      if (o.kind === "zapper") {
        cost += zapperActive(time + t, o.phase) ? 40 * near : 1;
      } else if (DODGE_ONLY.has(o.kind)) {
        cost += 40 * near;
      } else if (o.kind === "crate" && wantsCrates) {
        // 铲箱任务和大王关:箱子是分数来源,专门往它那条道挤
        cost -= 3;
      } else if ((o.kind === "hurdle" || o.kind === "pit") && wantsJumps) {
        cost -= 1.5;
      } else {
        // 跳/趴能解决的障碍只是「要占用一个动作」,不是致命的
        cost += 2;
      }
    }
    for (const p of pickups) {
      if (p.lane !== target) continue;
      const t = (PLAYER_Y - p.y) / speed;
      if (t < 0 || t > 1.4) continue;
      if (p.kind === "coin") cost -= def.mission.type === "coins" ? 2.2 : 1.2;
      else if (p.kind === "star") cost -= def.mission.type === "stars" ? 4.5 : 2.2;
      else if (p.kind === "rail") cost -= 1.5;
      else cost -= 3;
    }
    return cost;
  }

  /** 当前道上最近的一个「要用动作解决」的障碍。 */
  function nextActionable(speed: number): { kind: ObstacleKind; t: number } | null {
    let best: { kind: ObstacleKind; t: number } | null = null;
    for (const o of obstacles) {
      if (o.done) continue;
      if (obstacleLane(o) !== lane) continue;
      if (o.kind === "hurdle" || o.kind === "pit" || o.kind === "bar" || o.kind === "crate") {
        const t = (PLAYER_Y - o.y) / (speed * obstacleMult(o.kind));
        if (t < 0 || t > 0.6) continue;
        if (!best || t < best.t) best = { kind: o.kind, t };
      }
    }
    return best;
  }

  /** 现在这一瞬间踏进 target 道会不会立刻挨打。 */
  function safeToEnter(target: number): boolean {
    for (const o of obstacles) {
      if (o.done) continue;
      const here =
        o.kind === "cloudy"
          ? obstacleLane(o) === target || laneAfter(o, 0.16) === target
          : o.baseLane === target;
      if (!here) continue;
      if (Math.abs(o.y - PLAYER_Y) >= HIT_WINDOW + 18) continue;
      if (o.kind === "zapper" && !zapperActive(time, o.phase)) continue;
      // 已经在做的动作能解决就不算危险
      if (!wouldHit(o.kind, action)) continue;
      return false;
    }
    return true;
  }

  /** 包一层再比:直接写 action === "jump" 会被类型收窄误判成永假。 */
  const actionIs = (k: PlayerAction): boolean => action === k;

  function think(speed: number): void {
    if (policy === "idle") return;
    // 1. 三条道都算一遍,挑最划算的那条,然后往它的方向挪一格。
    //    只比较左右邻居会被「中间道暂时不能走」卡住,过不到对面那条空道。
    let bestLane = lane;
    let bestCost = laneCost(lane, speed) - 0.4;
    for (const cand of [0, 1, 2]) {
      if (cand === lane) continue;
      const c = laneCost(cand, speed);
      if (c < bestCost) {
        bestCost = c;
        bestLane = cand;
      }
    }
    if (bestLane !== lane) {
      const step = bestLane > lane ? 1 : -1;
      const next = clampLane(lane + step);
      if (safeToEnter(next)) lane = next;
    }

    // 2. 该跳就跳、该趴就趴
    const next = nextActionable(speed);
    if (!next) return;
    const jumpLead = JUMP_LEAD[policy];
    const slideLead = SLIDE_LEAD[policy];
    const jump = (): void => {
      if (action === "jump") return;
      action = "jump";
      actionTimer = JUMP_TIME;
      jumpElapsed = 0;
      jumpJudged = false;
    };
    if (next.kind === "hurdle" || next.kind === "pit") {
      // 贴到跟前再起跳:既躲得过,又能吃到完美跳判定
      if (next.t <= jumpLead) jump();
      return;
    }
    if (next.kind === "bar") {
      if (action !== "slide" && next.t <= slideLead) {
        action = "slide";
        actionTimer = SLIDE_TIME;
      }
      return;
    }
    // 彩纸箱:正常打就铲碎(顺便给大王掉血),只保命时跳过去更省事
    if (policy === "survive") {
      if (next.t <= jumpLead) jump();
    } else if (action !== "slide" && next.t <= slideLead) {
      action = "slide";
      actionTimer = SLIDE_TIME;
    }
  }

  const hitBy: Partial<Record<ObstacleKind, number>> = {};

  function takeHit(kind: ObstacleKind): void {
    if (invincible > 0 || jetTimer > 0) return;
    if (boardTimer > 0) {
      boardTimer = 0;
      invincible = 1.5;
      return;
    }
    hearts--;
    stats.heartsLost++;
    invincible = 1.5;
    hitBy[kind] = (hitBy[kind] ?? 0) + 1;
  }

  let reason: SimResult["reason"] = "timeout";

  while (time < MAX_SECONDS) {
    time += DT;
    invincible = Math.max(0, invincible - DT);
    magnetTimer = Math.max(0, magnetTimer - DT);
    jetTimer = Math.max(0, jetTimer - DT);
    boardTimer = Math.max(0, boardTimer - DT);
    railTimer = Math.max(0, railTimer - DT);

    const frac = Math.min(1, dist / def.len);
    const speed = def.speed * (1 + frac * 0.1) * railSpeedMult(railTimer);
    dist += speed * DT;

    if (dist >= def.len) {
      reason = boss && !bossDefeated(boss, stats) ? "boss" : "finish";
      break;
    }

    if (actionTimer > 0) {
      actionTimer -= DT;
      if (actionIs("jump")) jumpElapsed += DT;
      if (actionTimer <= 0) action = "run";
    }

    // 刷行:和 index.ts 一样,先把待刷队列排空再抽下一组花样
    rowDist += speed * DT;
    if (rowDist >= ROW_GAP) {
      rowDist = 0;
      if (pending.length === 0) {
        const pat = pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : [];
        pending = pat.map(cloneRow);
      }
      const row = pending.shift();
      if (row) {
        spawnRow(row);
        rows++;
      }
    }

    // 分岔口:走到牌子前,按当时站的道决定接下来那几行
    if (forkTimer !== Infinity) {
      forkTimer -= DT;
      if (forkTimer <= 0) {
        forkTimer = 6 + rng() * 3;
        pending = forkRows(pickFork(rng()), lane).map(cloneRow);
      }
    }

    // 道具
    if (def.powerups.length > 0) {
      powerTimer -= DT;
      if (powerTimer <= 0) {
        powerTimer = 8 + rng() * 4;
        const kind = def.powerups[Math.floor(rng() * def.powerups.length)];
        const l = Math.floor(rng() * 3);
        pickups.push({ kind, lane: l, x: laneX(l), y: -60 });
      }
    }

    think(speed);

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += speed * DT * obstacleMult(o.kind);
      if (o.kind === "cloudy") o.phase += DT * 1.6;
      if (o.y > DESPAWN_Y) {
        obstacles.splice(i, 1);
        stats.dodged++;
        continue;
      }
      if (o.done) continue;
      if (obstacleLane(o) !== lane || Math.abs(o.y - PLAYER_Y) >= HIT_WINDOW) continue;

      // 铲碎彩纸箱
      if (smashesCrate(o.kind, action)) {
        o.done = true;
        stats.smashed = (stats.smashed ?? 0) + 1;
        stats.bossHits = bossHitsOf(stats);
        obstacles.splice(i, 1);
        continue;
      }
      // 完美跳:栅栏和坑洞才算
      if (actionIs("jump") && (o.kind === "hurdle" || o.kind === "pit")) {
        o.done = true;
        if (jumpJudged) continue;
        jumpJudged = true;
        const perfect = isPerfectJump(jumpElapsed);
        if (completesPerfectRun(perfectStreak, perfect)) {
          stats.perfectRuns = (stats.perfectRuns ?? 0) + 1;
          stats.bossHits = bossHitsOf(stats);
        }
        perfectStreak = nextPerfectStreak(perfectStreak, perfect);
        continue;
      }
      if (invincible > 0 || jetTimer > 0) continue;
      if (o.kind === "zapper" && !zapperActive(time, o.phase)) continue;
      if (!wouldHit(o.kind, action)) continue;
      o.done = true;
      obstacles.splice(i, 1);
      takeHit(o.kind);
      if (hearts <= 0) break;
    }
    if (hearts <= 0) {
      reason = "hearts";
      break;
    }

    const px = laneX(lane);
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += speed * DT;
      // 磁铁把 300 像素内的糖果和星星拉过来,和渲染层同一条公式
      if (magnetTimer > 0 && (p.kind === "coin" || p.kind === "star")) {
        const dx = px - p.x;
        const dy = PLAYER_Y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 300) {
          p.x += (dx / (d || 1)) * 500 * DT;
          p.y += (dy / (d || 1)) * 500 * DT;
        }
      }
      if (p.y > DESPAWN_Y) {
        pickups.splice(i, 1);
        continue;
      }
      if (Math.hypot(p.x - px, p.y - PLAYER_Y) >= 44) continue;
      pickups.splice(i, 1);
      if (p.kind === "coin") stats.coins++;
      else if (p.kind === "star") stats.stars++;
      else if (p.kind === "rail") railTimer = RAIL_SECONDS;
      else if (p.kind === "magnet") magnetTimer = MAGNET_SECONDS;
      else if (p.kind === "jet") jetTimer = JET_SECONDS;
      else boardTimer = BOARD_SECONDS;
    }
  }

  const missionOk = missionDone(def.mission, stats);
  const win = reason === "finish";
  const note =
    reason === "hearts"
      ? `第 ${Math.round(dist)}/${def.len} 像素处心掉光了`
      : reason === "boss"
        ? `跑到终点时只打中大王 ${bossHitsOf(stats)}/${boss?.hp ?? 0} 下`
        : reason === "timeout"
          ? `${MAX_SECONDS} 秒还没跑完`
          : "通关";

  return {
    win,
    reason,
    note,
    stats,
    missionOk,
    stars: win ? starsForLevel(missionOk, stats.heartsLost) : 0,
    heartsLeft: Math.max(0, hearts),
    seconds: time,
    rows,
    bossHits: bossHitsOf(stats),
    bossHp: boss?.hp ?? 0,
    hitBy,
  };
}
