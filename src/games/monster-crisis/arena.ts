// 小怪物危机 1.2 —— 俯视竞技场引擎(纯逻辑,不碰 DOM、不发声、不吃随机数以外的外部状态)。
//
// 1.1 是「五条横道 + 摆建筑」的塔防;1.2 按第 13 步的分工改成
// **玩家角色亲自上场的动作防守**:家摆在场地正中间,小怪物从四面八方围上来,
// 鸭梨(和康康)在场上自由跑位、手动出手,每 3 波从三张成长卡里挑一张。
//
// 这里只管「世界怎么动」:
//  1. 走位 / 前摇出手 / 被撞转圈 + 短无敌(无血无伤无死亡);
//  2. 五种小怪物行为:直冲 / 绕行 / 远程吐泡泡 / 召唤小怪 / 精英护盾;
//  3. 怪、弹幕、粒子全部走对象池(`pool.ts`),借还平衡时池子不长个;
//  4. 四种模式的胜负:闯关 / 无尽 / 双人合作 / 一人一半的对战。
//
// 波次表直接读 `levels.ts` 的 188 关数据(一个字没改),只是同一张表在这里
// 从「第几条道」读成「从哪个方向围上来」。声音与飘字通过 `state.events` 往外递,
// 引擎自己不碰 `api.play`,更不会自建 AudioContext / setInterval。

import {
  CHAPTER_BOSSES,
  LANES,
  MONSTER_INFO,
  type MonsterKind,
  type WaveDef,
  clamp,
  monsterHp,
  mulberry32,
} from "./logic";
import { LEVELS, buildEndlessWave } from "./levels";
import {
  type GrowthCard,
  type GrowthId,
  type GrowthState,
  type HeroStats,
  applyGrowth,
  emptyGrowth,
  growthSeed,
  heroStats,
  rollGrowth,
  shouldOfferGrowth,
} from "./growth";
import { type Pool, createPool, swapRemove } from "./pool";

/* ------------------------------------------------------------------ */
/* 场地与常数                                                          */
/* ------------------------------------------------------------------ */

export const ARENA_W = 360;
export const ARENA_H = 240;

/** 家的半径:小怪物碰到这个圈就抱走一罐元气,然后变成小云朵飘走。 */
export const HOME_R = 26;

/** 主角的身体半径(判定圈,画面上要画得出来)。 */
export const HERO_R = 11;

/** 老怪表里的速度是「每秒几格」,一格 = 30 个场地单位。 */
export const SPEED_SCALE = 30;

/** 收集几颗元气糖换回一罐元气。 */
export const CRUMBS_PER_JAR = 6;

/** 被撞:转这么久的圈,再给这么久的无敌(转圈期间不能动也不能甩)。 */
export const SPIN_TIME = 0.7;
export const SPIN_INVULN = 1.35;

/** 颜料弹的飞行速度(场地单位/秒)。 */
export const BULLET_SPEED = 235;

/** 小怪物吐的泡泡飞得慢一些,给孩子躲的时间。 */
export const BUBBLE_SPEED = 96;

/** 两波之间的喘气时间。 */
export const PREP_SECONDS = 3.2;

/**
 * 出场表的时间轴压缩比。
 *
 * `levels.ts` 里那份出场时间是 1.1 塔防用的:怪要从右边一路走完整条道,
 * 所以放得很稀(一波八只能拖十六秒)。1.2 是围着家打的竞技场,出生圈离家近得多,
 * 照原速放的话场上永远只有一两只,不像动作游戏。这里把时间轴压紧,
 * 关卡数据一个数都不用改,场面就热闹起来了。
 */
export const SPAWN_TIME_SCALE = 0.5;

/** 双人合作 / 对战各打几波(打完就结算,绝不会卡在半路)。 */
export const COOP_WAVES = 6;
export const VERSUS_WAVES = 6;

/** 每场最多同时在场几只小怪物:再多也不放,免得低端机被压垮。 */
export const MONSTER_CAP = 46;

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* 小怪物:五种行为                                                     */
/* ------------------------------------------------------------------ */

export type Behavior = "rush" | "weave" | "spit" | "summon" | "elite";

/** 每种小怪物按哪套行为走。外形也按这个分家(见 index.ts 的画笔)。 */
export const BEHAVIOR_OF: Record<MonsterKind, Behavior> = {
  doodle: "rush",
  cotton: "rush",
  spinner: "weave",
  hopper: "weave",
  balloon: "spit",
  jelly: "summon",
  pumpkin: "elite",
  box: "elite",
  bossDoodle: "summon",
  bossCotton: "rush",
  bossPumpkin: "elite",
  bossCarousel: "weave",
  bossGear: "elite",
  bossCloud: "spit",
  bossFilm: "summon",
  bossRainbow: "elite",
};

/** 五种行为各自的一句话说明(图例 / 攻略 / 无障碍标签共用)。 */
export const BEHAVIOR_INFO: Record<Behavior, { name: string; emoji: string; tip: string }> = {
  rush: { name: "直冲怪", emoji: "🟩", tip: "闷头往家里冲,最好在半路就拦下来。" },
  weave: { name: "绕行怪", emoji: "🌀", tip: "画着圈绕过来,别追着屁股跑,站在它要去的地方等。" },
  spit: { name: "吐泡泡怪", emoji: "🎈", tip: "站远远地吐泡泡,被泡泡碰到会转圈圈,先躲再打。" },
  summon: { name: "召唤怪", emoji: "🍇", tip: "会变出小跟班,先把大的糊掉小的就不出来了。" },
  elite: { name: "护盾怪", emoji: "🛡️", tip: "正面顶着一块盾,绕到侧面或背后再甩才涂得上。" },
};

/** 精英怪正面那块盾能挡几下(挡一下掉一格,掉光就没盾了)。 */
const SHIELD_HITS: Partial<Record<MonsterKind, number>> = {
  pumpkin: 4,
  box: 6,
  bossPumpkin: 10,
  bossGear: 12,
  bossRainbow: 14,
};

/** 盾只挡「正面来的」:子弹方向和它前进方向的夹角超过这个余弦值才算正面。 */
const SHIELD_FRONT_DOT = -0.3;

/** 身体半径:大怪更大一圈,一眼看出来惹不起。 */
export function monsterRadius(kind: MonsterKind, small: boolean): number {
  const spec = MONSTER_INFO[kind];
  if (spec.boss) return small ? 20 : 26;
  return kind === "cotton" || kind === "box" ? 14 : 11.5;
}

/**
 * 竞技场里的血量:老怪表按「等效关号」算完再折一道。
 * 大怪折得最狠 —— 站着不动挨打的塔防节奏没了,再按老血量算就成了磨到手酸。
 */
export function arenaHp(kind: MonsterKind, levelIdx: number, small = false): number {
  const base = monsterHp(kind, levelIdx);
  const spec = MONSTER_INFO[kind];
  if (spec.boss) return Math.max(24, Math.round(base * (small ? 0.3 : 0.46)));
  return Math.max(3, Math.round(base * 0.78));
}

/* ------------------------------------------------------------------ */
/* 无尽:小 boss 节奏与换场景                                            */
/* ------------------------------------------------------------------ */

/** 无尽每 5 波来一只小 boss。 */
export function isSmallBossWave(wave: number): boolean {
  return wave > 0 && wave % 5 === 0;
}

/** 第几波该派哪只小 boss(按波数往后翻名单,翻完就停在最后一只)。 */
export function smallBossKind(wave: number): MonsterKind {
  const i = Math.max(0, Math.floor(wave / 5) - 1);
  return CHAPTER_BOSSES[Math.min(CHAPTER_BOSSES.length - 1, i)];
}

/** 无尽每 10 波换一次场景(0 基场景号)。 */
export function endlessScene(wave: number): number {
  return Math.max(0, Math.floor(Math.max(1, wave) - 1) / 10) | 0;
}

/** 场景一共几套皮(和 index.ts 的配色表长度一致)。 */
export const SCENE_COUNT = 8;

/**
 * 无尽第 n 波的出场表:直接用 `levels.ts` 的数据,
 * 逢 5 的倍数再加一只小 boss(逢 8 那只大怪是老数据自带的,留着当惊喜)。
 */
export function arenaEndlessWave(wave: number): WaveDef {
  const base = buildEndlessWave(wave);
  if (!isSmallBossWave(wave)) return base;
  const kind = smallBossKind(wave);
  const at = base.spawns.reduce((m, s) => Math.max(m, s.time), 0) * 0.4 + 1.2;
  const spawns = [...base.spawns, { time: Math.round(at * 10) / 10, lane: (wave / 5) % LANES, kind }];
  spawns.sort((a, b) => a.time - b.time);
  return { spawns, tail: base.tail };
}

/* ------------------------------------------------------------------ */
/* 状态                                                                */
/* ------------------------------------------------------------------ */

export type ArenaMode = "campaign" | "endless" | "coop" | "versus";

export interface ArenaHero {
  idx: number;
  /** 守哪个家(对战里 0 守左边、1 守右边;其它模式都是 0) */
  side: number;
  x: number;
  y: number;
  /** 朝向(单位向量) */
  fx: number;
  fy: number;
  /** 装填冷却 */
  cd: number;
  /** 出手前摇:>0 表示正在抬手,时间到了颜料弹才飞出去 */
  windup: number;
  /** 被撞之后转圈的剩余时间(转圈时不能动、不能甩) */
  spin: number;
  invuln: number;
  /** 身上还剩几个护盾泡 */
  shields: number;
  shieldCd: number;
  growth: GrowthState;
  stats: HeroStats;
  /** 捡到的元气糖(攒够 CRUMBS_PER_JAR 换回一罐元气) */
  crumbs: number;
  popped: number;
  /** 走位用的朝向缓存:站着不动时保持上一次的朝向 */
  moving: boolean;
}

export interface ArenaMonster {
  active: boolean;
  kind: MonsterKind;
  behavior: Behavior;
  side: number;
  x: number;
  y: number;
  /** 前进方向(盾的正面就朝这边) */
  fx: number;
  fy: number;
  hp: number;
  maxHp: number;
  shield: number;
  shieldMax: number;
  speed: number;
  r: number;
  phase: number;
  /** 行为计时:吐泡泡 / 召唤的下一次还有多久 */
  timer: number;
  /** 还能召唤几只小跟班 */
  summons: number;
  boss: boolean;
  small: boolean;
  /** 刚被涂到时闪一下 */
  hitFlash: number;
  /** 盾刚挡住时闪一下 */
  blockFlash: number;
  /** 撞到人之后自己也愣一会儿,免得贴着人连撞 */
  stagger: number;
}

export interface ArenaBullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  /** true = 小怪物吐的泡泡(打人),false = 主角的颜料弹(打怪) */
  foe: boolean;
  side: number;
  r: number;
}

export interface ArenaCrumb {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  side: number;
}

export type ParticleKind = "cloud" | "spark" | "ring";

export interface ArenaParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: ParticleKind;
  emoji: string;
}

export type ArenaEventType =
  | "pop"
  | "hit"
  | "block"
  | "steal"
  | "spin"
  | "shieldPop"
  | "jar"
  | "wave"
  | "boss"
  | "draft"
  | "fire"
  | "over";

export interface ArenaEvent {
  type: ArenaEventType;
  /** 给 UI 的一句话(要飘字的才有) */
  text?: string;
  hero?: number;
  side?: number;
  x?: number;
  y?: number;
}

export interface ArenaDraft {
  hero: number;
  cards: GrowthCard[];
}

export interface ArenaResult {
  /** 单家模式:守住了没有;对战:0 号是不是赢家 */
  win: boolean;
  /** 对战专用:赢家下标,平局是 -1 */
  winner: number;
  jars: number[];
  maxJars: number;
  wavesCleared: number;
  waveTotal: number;
  popped: number;
  elapsed: number;
  /** 哪个方向漏得最多(0..LANES-1),没漏过是 -1 */
  weakSide: number;
}

export interface ArenaInput {
  /** 摇杆:-1..1 */
  mx: number;
  my: number;
  /** 技能钮按住不放 */
  fire: boolean;
}

export interface ArenaOptions {
  mode: ArenaMode;
  /** 闯关 / 合作 / 对战:固定波表;无尽:留空,用 makeWave */
  waves?: WaveDef[];
  makeWave?: (wave: number) => WaveDef;
  /** 每一波按哪个「等效关号」算血量 */
  levelIdxFor?: (wave: number) => number;
  levelIdx?: number;
  heroes?: 1 | 2;
  jars?: number;
  seed?: number;
  /** 开局先发一次三选一(闯关一关只有 2–5 波,不开局发就可能一整关都没成长) */
  openingDraft?: boolean;
  particleCap?: number;
}

interface SpawnEntry {
  time: number;
  kind: MonsterKind;
  lane: number;
  side: number;
  small: boolean;
}

export interface ArenaState {
  mode: ArenaMode;
  heroes: ArenaHero[];
  monsters: ArenaMonster[];
  bullets: ArenaBullet[];
  crumbs: ArenaCrumb[];
  particles: ArenaParticle[];
  homes: Array<{ x: number; y: number }>;
  jars: number[];
  maxJars: number;
  /** 每个方向漏了几只(结算文案点名用) */
  leaks: number[];
  wave: number;
  wavesCleared: number;
  waveTotal: number;
  phase: "prep" | "wave" | "draft" | "over";
  prepLeft: number;
  waveTime: number;
  spawnIdx: number;
  queue: SpawnEntry[];
  drafts: ArenaDraft[];
  draftCount: number;
  scene: number;
  popped: number;
  elapsed: number;
  events: ArenaEvent[];
  result: ArenaResult | null;
  seed: number;
  particleCap: number;
  pools: {
    monsters: Pool<ArenaMonster>;
    bullets: Pool<ArenaBullet>;
    crumbs: Pool<ArenaCrumb>;
    particles: Pool<ArenaParticle>;
  };
  rng: () => number;
  levelIdxFor: (wave: number) => number;
  makeWave: (wave: number) => WaveDef;
}

/* ------------------------------------------------------------------ */
/* 建场                                                                */
/* ------------------------------------------------------------------ */

function blankMonster(): ArenaMonster {
  return {
    active: false,
    kind: "doodle",
    behavior: "rush",
    side: 0,
    x: 0,
    y: 0,
    fx: -1,
    fy: 0,
    hp: 1,
    maxHp: 1,
    shield: 0,
    shieldMax: 0,
    speed: 0,
    r: 11,
    phase: 0,
    timer: 0,
    summons: 0,
    boss: false,
    small: false,
    hitFlash: 0,
    blockFlash: 0,
    stagger: 0,
  };
}

function resetMonster(m: ArenaMonster): void {
  m.active = false;
  m.hp = 1;
  m.maxHp = 1;
  m.shield = 0;
  m.shieldMax = 0;
  m.summons = 0;
  m.timer = 0;
  m.hitFlash = 0;
  m.blockFlash = 0;
  m.stagger = 0;
  m.boss = false;
  m.small = false;
}

function blankBullet(): ArenaBullet {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, foe: false, side: 0, r: 4 };
}

function resetBullet(b: ArenaBullet): void {
  b.active = false;
  b.life = 0;
  b.dmg = 0;
  b.foe = false;
}

function blankCrumb(): ArenaCrumb {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, side: 0 };
}

function resetCrumb(c: ArenaCrumb): void {
  c.active = false;
  c.life = 0;
}

function blankParticle(): ArenaParticle {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, kind: "spark", emoji: "" };
}

function resetParticle(p: ArenaParticle): void {
  p.active = false;
  p.life = 0;
  p.emoji = "";
}

function makeHero(idx: number, side: number, homes: Array<{ x: number; y: number }>): ArenaHero {
  const home = homes[side] ?? homes[0];
  const growth = emptyGrowth();
  return {
    idx,
    side,
    x: home.x + (idx === 0 ? -46 : 46),
    y: home.y + (idx === 0 ? 34 : -34),
    fx: 1,
    fy: 0,
    cd: 0,
    windup: 0,
    spin: 0,
    invuln: 0,
    shields: 0,
    shieldCd: 0,
    growth,
    stats: heroStats(growth),
    crumbs: 0,
    popped: 0,
    moving: false,
  };
}

/** 对战:两个家各占半边,中间那条线谁也不许越过。 */
export function homesFor(mode: ArenaMode): Array<{ x: number; y: number }> {
  if (mode === "versus") {
    return [
      { x: ARENA_W * 0.25, y: ARENA_H / 2 },
      { x: ARENA_W * 0.75, y: ARENA_H / 2 },
    ];
  }
  return [{ x: ARENA_W / 2, y: ARENA_H / 2 }];
}

/** 主角能跑的范围:对战里各守各的半场。 */
export function heroBounds(mode: ArenaMode, side: number): { x0: number; x1: number; y0: number; y1: number } {
  if (mode === "versus") {
    return side === 0
      ? { x0: HERO_R, x1: ARENA_W / 2 - HERO_R, y0: HERO_R, y1: ARENA_H - HERO_R }
      : { x0: ARENA_W / 2 + HERO_R, x1: ARENA_W - HERO_R, y0: HERO_R, y1: ARENA_H - HERO_R };
  }
  return { x0: HERO_R, x1: ARENA_W - HERO_R, y0: HERO_R, y1: ARENA_H - HERO_R };
}

/** 第 lane 个方向、第 wave 波:小怪物从家外面这一圈的哪个点围上来(确定性)。 */
export function spawnPoint(
  mode: ArenaMode,
  side: number,
  lane: number,
  wave: number
): { x: number; y: number; angle: number } {
  const home = homesFor(mode)[side] ?? homesFor(mode)[0];
  const half = mode === "versus";
  const rx = half ? ARENA_W * 0.25 + 16 : ARENA_W / 2 + 14;
  const ry = ARENA_H / 2 + 14;
  const angle = ((lane + 0.5) / LANES) * TAU + wave * 0.41 + (side === 1 ? Math.PI : 0);
  return { x: home.x + Math.cos(angle) * rx, y: home.y + Math.sin(angle) * ry, angle };
}

export function createArena(opts: ArenaOptions): ArenaState {
  const mode = opts.mode;
  const homes = homesFor(mode);
  const heroCount = opts.heroes ?? (mode === "coop" || mode === "versus" ? 2 : 1);
  const jars = opts.jars ?? (mode === "campaign" ? 4 : 5);
  const seed = (opts.seed ?? 20250813) >>> 0;
  const levelIdx = opts.levelIdx ?? 0;
  const waves = opts.waves ?? [];
  const waveTotal = opts.makeWave ? 0 : waves.length;

  const heroes: ArenaHero[] = [];
  for (let i = 0; i < heroCount; i++) {
    heroes.push(makeHero(i, mode === "versus" ? i : 0, homes));
  }

  const state: ArenaState = {
    mode,
    heroes,
    monsters: [],
    bullets: [],
    crumbs: [],
    particles: [],
    homes,
    jars: homes.map(() => jars),
    maxJars: jars,
    leaks: new Array<number>(LANES).fill(0),
    wave: 0,
    wavesCleared: 0,
    waveTotal,
    phase: "prep",
    prepLeft: PREP_SECONDS,
    waveTime: 0,
    spawnIdx: 0,
    queue: [],
    drafts: [],
    draftCount: 0,
    scene: 0,
    popped: 0,
    elapsed: 0,
    events: [],
    result: null,
    seed,
    particleCap: opts.particleCap ?? 60,
    pools: {
      monsters: createPool(blankMonster, resetMonster, 24),
      bullets: createPool(blankBullet, resetBullet, 32),
      crumbs: createPool(blankCrumb, resetCrumb, 16),
      particles: createPool(blankParticle, resetParticle, 32),
    },
    rng: mulberry32(seed),
    levelIdxFor: opts.levelIdxFor ?? (() => levelIdx),
    makeWave: opts.makeWave ?? ((n: number) => waves[Math.min(n - 1, waves.length - 1)] ?? { spawns: [], tail: 0 }),
  };

  if (opts.openingDraft) offerDrafts(state);
  return state;
}

/** 闯关第 n 关(0 基)的竞技场。 */
export function createCampaignArena(levelIdx: number, opts: Partial<ArenaOptions> = {}): ArenaState {
  const def = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIdx))];
  return createArena({
    mode: "campaign",
    waves: def.waves,
    levelIdx,
    jars: def.homeHp + 1,
    seed: levelIdx * 7919 + 1013,
    openingDraft: true,
    ...opts,
  });
}

/* ------------------------------------------------------------------ */
/* 三选一                                                              */
/* ------------------------------------------------------------------ */

function offerDrafts(state: ArenaState): void {
  const drafts: ArenaDraft[] = [];
  for (const h of state.heroes) {
    const cards = rollGrowth(growthSeed(state.seed + h.idx * 7717, state.draftCount), h.growth);
    if (cards.length > 0) drafts.push({ hero: h.idx, cards });
  }
  state.draftCount++;
  if (drafts.length === 0) return;
  state.drafts = drafts;
  state.phase = "draft";
  state.events.push({ type: "draft" });
}

/** 选一张成长卡。选完最后一个人就自动继续开打。 */
export function chooseGrowth(state: ArenaState, hero: number, id: GrowthId): boolean {
  const at = state.drafts.findIndex((d) => d.hero === hero);
  if (at < 0) return false;
  if (!state.drafts[at].cards.some((c) => c.id === id)) return false;
  const h = state.heroes[hero];
  if (!h) return false;
  h.growth = applyGrowth(h.growth, id);
  h.stats = heroStats(h.growth);
  if (h.stats.shields > h.shields && h.shieldCd <= 0) h.shields = h.stats.shields;
  state.drafts.splice(at, 1);
  if (state.drafts.length === 0 && state.phase === "draft") {
    state.phase = "prep";
    state.prepLeft = PREP_SECONDS;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* 出怪                                                                */
/* ------------------------------------------------------------------ */

function queueWave(state: ArenaState, wave: number): void {
  const def = state.makeWave(wave);
  const sides = state.mode === "versus" ? [0, 1] : [0];
  const queue: SpawnEntry[] = [];
  const smallBoss = state.mode === "endless" && isSmallBossWave(wave) ? smallBossKind(wave) : null;
  for (const side of sides) {
    for (const s of def.spawns) {
      const small = smallBoss !== null && s.kind === smallBoss && !!MONSTER_INFO[s.kind].boss;
      queue.push({ time: s.time * SPAWN_TIME_SCALE, kind: s.kind, lane: s.lane, side, small });
    }
  }
  queue.sort((a, b) => a.time - b.time || a.side - b.side);
  state.queue = queue;
  state.spawnIdx = 0;
  state.waveTime = 0;
  state.wave = wave;
  state.scene = state.mode === "endless" ? endlessScene(wave) % SCENE_COUNT : state.scene;
}

function spawnMonster(
  state: ArenaState,
  kind: MonsterKind,
  side: number,
  lane: number,
  wave: number,
  small: boolean,
  at?: { x: number; y: number }
): ArenaMonster | null {
  const live = state.monsters.length;
  if (live >= MONSTER_CAP) return null;
  const spec = MONSTER_INFO[kind];
  const m = state.pools.monsters.acquire();
  const point = at ?? spawnPoint(state.mode, side, lane, wave);
  const home = state.homes[side] ?? state.homes[0];
  m.active = true;
  m.kind = kind;
  m.behavior = BEHAVIOR_OF[kind];
  m.side = side;
  m.x = point.x;
  m.y = point.y;
  const dx = home.x - m.x;
  const dy = home.y - m.y;
  const d = Math.hypot(dx, dy) || 1;
  m.fx = dx / d;
  m.fy = dy / d;
  const levelIdx = state.levelIdxFor(wave);
  m.hp = arenaHp(kind, levelIdx, small);
  m.maxHp = m.hp;
  m.shieldMax = m.behavior === "elite" ? SHIELD_HITS[kind] ?? 4 : 0;
  m.shield = m.shieldMax;
  m.speed = spec.speed * SPEED_SCALE * (small ? 0.9 : 1);
  m.r = monsterRadius(kind, small);
  m.phase = state.rng() * TAU;
  m.timer = m.behavior === "spit" ? 1.1 : m.behavior === "summon" ? 3 : 0;
  m.summons = m.behavior === "summon" ? (spec.boss ? 5 : 3) : 0;
  m.boss = !!spec.boss;
  m.small = small;
  m.hitFlash = 0;
  m.blockFlash = 0;
  m.stagger = 0;
  state.monsters.push(m);
  if (m.boss) {
    state.events.push({
      type: "boss",
      text: `${small ? "小" : ""}${spec.name}来啦!把它糊成${spec.becomes}!`,
      side,
    });
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* 小玩意儿:弹幕 / 元气糖 / 粒子                                        */
/* ------------------------------------------------------------------ */

function addBullet(
  state: ArenaState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  dmg: number,
  foe: boolean,
  side: number
): void {
  const b = state.pools.bullets.acquire();
  b.active = true;
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  b.life = life;
  b.dmg = dmg;
  b.foe = foe;
  b.side = side;
  b.r = foe ? 6 : 4.5;
  state.bullets.push(b);
}

function addCrumb(state: ArenaState, x: number, y: number, side: number): void {
  const c = state.pools.crumbs.acquire();
  c.active = true;
  c.x = x;
  c.y = y;
  c.vx = (state.rng() - 0.5) * 24;
  c.vy = (state.rng() - 0.5) * 24;
  c.life = 9;
  c.side = side;
  state.crumbs.push(c);
}

function addParticle(state: ArenaState, x: number, y: number, kind: ParticleKind, emoji = ""): void {
  if (state.particles.length >= state.particleCap) return;
  const p = state.pools.particles.acquire();
  p.active = true;
  p.x = x;
  p.y = y;
  p.vx = (state.rng() - 0.5) * 40;
  p.vy = kind === "cloud" ? -26 - state.rng() * 18 : (state.rng() - 0.5) * 40;
  p.maxLife = kind === "cloud" ? 1.1 : kind === "ring" ? 0.45 : 0.6;
  p.life = p.maxLife;
  p.kind = kind;
  p.emoji = emoji;
  state.particles.push(p);
}

/* ------------------------------------------------------------------ */
/* 每帧推进                                                            */
/* ------------------------------------------------------------------ */

function nearestMonster(state: ArenaState, x: number, y: number, side: number, maxDist: number): ArenaMonster | null {
  let best: ArenaMonster | null = null;
  let bestD = maxDist * maxDist;
  for (const m of state.monsters) {
    if (!m.active || m.side !== side) continue;
    const d = (m.x - x) * (m.x - x) + (m.y - y) * (m.y - y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function heroFire(state: ArenaState, h: ArenaHero): void {
  const stats = h.stats;
  // 自动瞄准:射程内最近的那只(孩子不用同时管走位和瞄准),没有目标就朝着脸冲的方向甩
  const target = nearestMonster(state, h.x, h.y, h.side, stats.reach * 1.15);
  let ax = h.fx;
  let ay = h.fy;
  if (target) {
    const dx = target.x - h.x;
    const dy = target.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    ax = dx / d;
    ay = dy / d;
  }
  const base = Math.atan2(ay, ax);
  const n = Math.max(1, Math.round(stats.shots));
  const life = stats.reach / BULLET_SPEED;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * stats.spread;
    const a = base + off;
    addBullet(
      state,
      h.x + Math.cos(a) * (HERO_R + 3),
      h.y + Math.sin(a) * (HERO_R + 3),
      Math.cos(a) * BULLET_SPEED,
      Math.sin(a) * BULLET_SPEED,
      life,
      stats.damage,
      false,
      h.side
    );
  }
  state.events.push({ type: "fire", hero: h.idx, x: h.x, y: h.y });
}

function bumpHero(state: ArenaState, h: ArenaHero, x: number, y: number): void {
  if (h.invuln > 0 || h.spin > 0) return;
  if (h.shields > 0) {
    h.shields--;
    h.shieldCd = h.stats.shieldRecharge;
    h.invuln = 0.55;
    addParticle(state, h.x, h.y, "ring");
    state.events.push({ type: "shieldPop", hero: h.idx, x: h.x, y: h.y });
    return;
  }
  h.spin = SPIN_TIME;
  h.invuln = SPIN_INVULN;
  h.windup = 0;
  addParticle(state, h.x, h.y, "ring");
  state.events.push({ type: "spin", hero: h.idx, text: "哎呀,转晕啦!站稳再来。", x, y });
}

function stepHeroes(state: ArenaState, dt: number, inputs: ArenaInput[]): void {
  for (const h of state.heroes) {
    const input = inputs[h.idx] ?? { mx: 0, my: 0, fire: false };
    h.invuln = Math.max(0, h.invuln - dt);
    if (h.shieldCd > 0) {
      h.shieldCd -= dt;
      if (h.shieldCd <= 0 && h.shields < h.stats.shields) h.shields = Math.min(h.stats.shields, h.shields + 1);
    }
    if (h.spin > 0) {
      h.spin -= dt;
      h.moving = false;
      continue;
    }

    const len = Math.hypot(input.mx, input.my);
    h.moving = len > 0.05;
    if (h.moving) {
      const nx = input.mx / len;
      const ny = input.my / len;
      const scale = Math.min(1, len);
      const bounds = heroBounds(state.mode, h.side);
      h.x = clamp(h.x + nx * h.stats.speed * scale * dt, bounds.x0, bounds.x1);
      h.y = clamp(h.y + ny * h.stats.speed * scale * dt, bounds.y0, bounds.y1);
      h.fx = nx;
      h.fy = ny;
    }

    if (h.cd > 0) h.cd -= dt;
    if (h.windup > 0) {
      h.windup -= dt;
      if (h.windup <= 0) heroFire(state, h);
    } else if (input.fire && h.cd <= 0) {
      h.cd = h.stats.reload;
      h.windup = h.stats.windup;
    }
  }
}

function stepMonsters(state: ArenaState, dt: number): void {
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const m = state.monsters[i];
    if (!m.active) {
      swapRemove(state.monsters, i);
      continue;
    }
    if (m.hitFlash > 0) m.hitFlash -= dt;
    if (m.blockFlash > 0) m.blockFlash -= dt;
    if (m.stagger > 0) m.stagger -= dt;

    const home = state.homes[m.side] ?? state.homes[0];
    const dx = home.x - m.x;
    const dy = home.y - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    let ux = dx / dist;
    let uy = dy / dist;

    let speed = m.speed;
    if (m.stagger > 0) speed *= 0.25;

    if (m.behavior === "weave") {
      // 绕行:一边靠近一边画大 S,越近绕得越浅,不然永远进不了门
      const swing = Math.sin(state.elapsed * 1.7 + m.phase) * 0.85 * Math.min(1, dist / 90);
      const a = Math.atan2(uy, ux) + swing;
      ux = Math.cos(a);
      uy = Math.sin(a);
    } else if (m.behavior === "spit") {
      m.timer -= dt;
      const range = 96;
      if (dist < range) {
        // 站定吐泡泡;吐够三口再往前挪一截,不会赖在原地不动
        speed = m.timer < -1.2 ? m.speed * 0.5 : 0;
        if (m.timer <= 0) {
          m.timer = 2.3;
          const hero = nearestHero(state, m.x, m.y, m.side);
          const tx = hero ? hero.x : home.x;
          const ty = hero ? hero.y : home.y;
          const d = Math.hypot(tx - m.x, ty - m.y) || 1;
          addBullet(
            state,
            m.x,
            m.y,
            ((tx - m.x) / d) * BUBBLE_SPEED,
            ((ty - m.y) / d) * BUBBLE_SPEED,
            2.6,
            0,
            true,
            m.side
          );
        }
      }
    } else if (m.behavior === "summon") {
      m.timer -= dt;
      if (m.timer <= 0 && m.summons > 0) {
        m.timer = 3.4;
        m.summons--;
        const baby = spawnMonster(state, "doodle", m.side, 0, state.wave, false, {
          x: m.x + (state.rng() - 0.5) * 26,
          y: m.y + (state.rng() - 0.5) * 26,
        });
        if (baby) {
          baby.hp = Math.max(3, Math.round(baby.hp * 0.7));
          baby.maxHp = baby.hp;
          addParticle(state, baby.x, baby.y, "ring");
        }
      }
    }

    if (speed > 0) {
      m.x += ux * speed * dt;
      m.y += uy * speed * dt;
      m.fx = ux;
      m.fy = uy;
    }

    // 到家了:抱走一罐元气,自己变成小云朵飘走
    if (Math.hypot(home.x - m.x, home.y - m.y) <= HOME_R + m.r * 0.6) {
      const lane = laneOfPoint(state, m);
      state.leaks[lane] = (state.leaks[lane] ?? 0) + 1;
      state.jars[m.side] = Math.max(0, state.jars[m.side] - 1);
      addParticle(state, m.x, m.y, "cloud", "☁️");
      state.events.push({
        type: "steal",
        side: m.side,
        text: `${MONSTER_INFO[m.kind].name}抱走一罐元气,还剩 ${state.jars[m.side]} 罐!`,
        x: m.x,
        y: m.y,
      });
      killMonster(state, i, false);
      continue;
    }

    // 撞到人:人转圈 + 短无敌,怪自己也愣一下并弹开一点
    for (const h of state.heroes) {
      if (h.side !== m.side) continue;
      const hd = Math.hypot(h.x - m.x, h.y - m.y);
      if (hd > HERO_R + m.r) continue;
      if (h.invuln <= 0 && h.spin <= 0) {
        bumpHero(state, h, m.x, m.y);
        m.stagger = 0.75;
        const push = (HERO_R + m.r - hd + 6) || 6;
        const nx = (m.x - h.x) / (hd || 1);
        const ny = (m.y - h.y) / (hd || 1);
        m.x += nx * push;
        m.y += ny * push;
      }
    }
  }
}

function nearestHero(state: ArenaState, x: number, y: number, side: number): ArenaHero | null {
  let best: ArenaHero | null = null;
  let bestD = Infinity;
  for (const h of state.heroes) {
    if (h.side !== side) continue;
    const d = (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** 这只怪是从哪个方向来的(结算文案点名「哪边漏得最多」)。 */
function laneOfPoint(state: ArenaState, m: { x: number; y: number; side: number }): number {
  const home = state.homes[m.side] ?? state.homes[0];
  const a = Math.atan2(m.y - home.y, m.x - home.x);
  const norm = (a + TAU) % TAU;
  return Math.min(LANES - 1, Math.floor((norm / TAU) * LANES));
}

/** 把第 i 只怪收走:pop = 被涂成花花(掉元气糖 + 记分),否则只是离场。 */
function killMonster(state: ArenaState, i: number, pop: boolean): void {
  const m = state.monsters[i];
  if (!m) return;
  if (pop) {
    state.popped++;
    addParticle(state, m.x, m.y, "cloud", "☁️");
    addParticle(state, m.x, m.y, "spark");
    const drops = m.boss ? 4 : 1;
    for (let k = 0; k < drops; k++) addCrumb(state, m.x, m.y, m.side);
    state.events.push({ type: "pop", side: m.side, x: m.x, y: m.y });
  }
  m.active = false;
  swapRemove(state.monsters, i);
  state.pools.monsters.release(m);
}

function stepBullets(state: ArenaState, dt: number): void {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let done = b.life <= 0 || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20;

    if (!done && b.foe) {
      for (const h of state.heroes) {
        if (h.side !== b.side) continue;
        if (Math.hypot(h.x - b.x, h.y - b.y) > HERO_R + b.r) continue;
        bumpHero(state, h, b.x, b.y);
        done = true;
        break;
      }
    } else if (!done) {
      for (let j = state.monsters.length - 1; j >= 0; j--) {
        const m = state.monsters[j];
        if (!m.active || m.side !== b.side) continue;
        if (Math.hypot(m.x - b.x, m.y - b.y) > m.r + b.r) continue;
        // 精英怪正面那块盾:迎面来的先掉盾,绕到侧后方才涂得上
        const dirLen = Math.hypot(b.vx, b.vy) || 1;
        const dot = ((b.vx / dirLen) * m.fx + (b.vy / dirLen) * m.fy);
        if (m.shield > 0 && dot < SHIELD_FRONT_DOT) {
          m.shield--;
          m.blockFlash = 0.16;
          addParticle(state, b.x, b.y, "spark");
          state.events.push({ type: "block", x: b.x, y: b.y });
        } else {
          m.hp -= b.dmg;
          m.hitFlash = 0.14;
          addParticle(state, b.x, b.y, "spark");
          state.events.push({ type: "hit", x: b.x, y: b.y });
          if (m.hp <= 0) killMonster(state, j, true);
        }
        done = true;
        break;
      }
    }

    if (done) {
      b.active = false;
      swapRemove(state.bullets, i);
      state.pools.bullets.release(b);
    }
  }
}

function stepCrumbs(state: ArenaState, dt: number): void {
  for (let i = state.crumbs.length - 1; i >= 0; i--) {
    const c = state.crumbs[i];
    c.life -= dt;
    let taken = false;
    const h = nearestHero(state, c.x, c.y, c.side);
    if (h) {
      const d = Math.hypot(h.x - c.x, h.y - c.y);
      if (d <= h.stats.magnet) {
        // 吸附:进了吸附圈就被拽着走,越近拽得越快
        const pull = 150 + 260 * (1 - d / Math.max(1, h.stats.magnet));
        c.vx += ((h.x - c.x) / (d || 1)) * pull * dt;
        c.vy += ((h.y - c.y) / (d || 1)) * pull * dt;
      }
      if (d <= HERO_R + 5) {
        taken = true;
        h.crumbs++;
        if (h.crumbs % CRUMBS_PER_JAR === 0 && state.jars[h.side] < state.maxJars) {
          state.jars[h.side]++;
          state.events.push({ type: "jar", hero: h.idx, side: h.side, text: "元气糖攒够啦,家里多回来一罐元气!" });
        }
      }
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vx *= 0.94;
    c.vy *= 0.94;
    if (taken || c.life <= 0) {
      c.active = false;
      swapRemove(state.crumbs, i);
      state.pools.crumbs.release(c);
    }
  }
}

function stepParticles(state: ArenaState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.93;
    if (p.kind !== "cloud") p.vy *= 0.93;
    if (p.life <= 0) {
      p.active = false;
      swapRemove(state.particles, i);
      state.pools.particles.release(p);
    }
  }
}

function settle(state: ArenaState, win: boolean, winner = -1): void {
  if (state.result) return;
  state.phase = "over";
  let weak = -1;
  let most = 0;
  for (let i = 0; i < state.leaks.length; i++) {
    if (state.leaks[i] > most) {
      most = state.leaks[i];
      weak = i;
    }
  }
  state.result = {
    win,
    winner,
    jars: state.jars.slice(),
    maxJars: state.maxJars,
    wavesCleared: state.wavesCleared,
    waveTotal: state.waveTotal,
    popped: state.popped,
    elapsed: state.elapsed,
    weakSide: weak,
  };
  state.events.push({ type: "over" });
}

function checkLost(state: ArenaState): boolean {
  if (state.mode === "versus") {
    const down0 = state.jars[0] <= 0;
    const down1 = state.jars[1] <= 0;
    if (down0 && down1) {
      settle(state, false, -1);
      return true;
    }
    if (down0 || down1) {
      settle(state, down1, down1 ? 0 : 1);
      return true;
    }
    return false;
  }
  if (state.jars[0] <= 0) {
    settle(state, false, -1);
    return true;
  }
  return false;
}

function finishWave(state: ArenaState): void {
  state.wavesCleared++;
  state.events.push({ type: "wave", text: `第 ${state.wavesCleared} 波挡下来啦!` });

  if (state.waveTotal > 0 && state.wavesCleared >= state.waveTotal) {
    if (state.mode === "versus") {
      const a = state.jars[0];
      const b = state.jars[1];
      settle(state, a >= b, a === b ? -1 : a > b ? 0 : 1);
    } else {
      settle(state, true);
    }
    return;
  }

  if (shouldOfferGrowth(state.wavesCleared)) {
    offerDrafts(state);
    if (state.phase === "draft") return;
  }
  state.phase = "prep";
  state.prepLeft = PREP_SECONDS;
}

/** 推进一帧。`inputs[i]` 对应第 i 个主角;返回本帧攒下的事件(读完就清空)。 */
export function stepArena(state: ArenaState, dt: number, inputs: ArenaInput[] = []): ArenaEvent[] {
  state.events = [];
  if (state.phase === "over") return state.events;

  const step = Math.min(0.05, Math.max(0, dt));
  state.elapsed += step;

  if (state.phase === "draft") {
    // 选卡时世界停住,但粒子照样飘完,免得画面上一堆东西定住很怪
    stepParticles(state, step);
    return state.events;
  }

  if (state.phase === "prep") {
    state.prepLeft -= step;
    stepParticles(state, step);
    stepCrumbs(state, step);
    stepHeroes(state, step, inputs);
    stepBullets(state, step);
    if (state.prepLeft <= 0) {
      queueWave(state, state.wave + 1);
      state.phase = "wave";
      state.events.push({ type: "wave", text: `第 ${state.wave} 波来啦!` });
    }
    return state.events;
  }

  state.waveTime += step;
  while (state.spawnIdx < state.queue.length && state.queue[state.spawnIdx].time <= state.waveTime) {
    const s = state.queue[state.spawnIdx++];
    spawnMonster(state, s.kind, s.side, s.lane, state.wave, s.small);
  }

  stepHeroes(state, step, inputs);
  stepMonsters(state, step);
  stepBullets(state, step);
  stepCrumbs(state, step);
  stepParticles(state, step);

  if (checkLost(state)) return state.events;
  if (state.spawnIdx >= state.queue.length && state.monsters.length === 0) finishWave(state);
  return state.events;
}

/* ------------------------------------------------------------------ */
/* 给 UI 的只读查询                                                     */
/* ------------------------------------------------------------------ */

/** 顶上那一行:第几波 / 还剩几罐元气。 */
export function waveLabel(state: ArenaState): string {
  if (state.phase === "draft") return "🎁 挑一张成长卡";
  if (state.phase === "prep") return `🛠️ 喘口气 ${Math.max(0, Math.ceil(state.prepLeft))} 秒`;
  if (state.waveTotal > 0) return `🌊 第 ${state.wave}/${state.waveTotal} 波`;
  return `♾️ 第 ${state.wave} 波`;
}

/** 同时在场的东西加起来有多少(性能用例读这个)。 */
export function liveCount(state: ArenaState): number {
  return state.monsters.length + state.bullets.length + state.crumbs.length + state.particles.length;
}

/** 池子一共造过多少对象(「1000 次生成回收后池不膨胀」的用例读这个)。 */
export function poolFootprint(state: ArenaState): number {
  return (
    state.pools.monsters.created +
    state.pools.bullets.created +
    state.pools.crumbs.created +
    state.pools.particles.created
  );
}

/** 场上清空:destroy 时把借出去的全还回去,不拖着一堆对象不放。 */
export function disposeArena(state: ArenaState): void {
  state.monsters.length = 0;
  state.bullets.length = 0;
  state.crumbs.length = 0;
  state.particles.length = 0;
  state.pools.monsters.clear();
  state.pools.bullets.clear();
  state.pools.crumbs.clear();
  state.pools.particles.clear();
  state.events = [];
  state.drafts = [];
  state.phase = "over";
}
