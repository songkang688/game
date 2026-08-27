/**
 * 王子公主大冒险 · 纯逻辑层(不碰 DOM,可以在测试里整关跑完)。
 *
 * 这里放四样东西:
 *  1. 两位主角各自的物理:王子一段跳 + 挥剑近战,公主二段跳 + 会自己瞄准的星星;
 *  2. 小怪与首领的行为,以及「谁打得动谁」的克制关系 ——
 *     铠甲怪弹开星星只吃剑,幽灵穿过剑只吃星星,首领的护甲还会在两者之间来回换;
 *  3. 共享生命:两个人合用一条心条,受伤后有一段公共无敌时间,
 *     所以一个人替另一个人挡刀是划算的,不会两个人同时掉两颗心;
 *  4. 一个会自己打通关的小机器人 —— 测试靠它把 188 关真的玩到「胜」,
 *     单人模式下没被操作的那位也由它托管。
 *
 * 坐标同 levels.ts:x 向右,y 向下,地面上表面 y = 0,空中是负数;
 * 角色的 (x, y) 指「脚底中点」。
 */
import {
  BOSSES,
  groundSolidAt,
  type BossDef,
  type EnemyDef,
  type EnemyKind,
  type Gap,
  type LevelDef,
} from "./levels";
import {
  BLOCK_H,
  BLOCK_W,
  canPush,
  fallStep,
  freshGlide,
  glideStep,
  pushStep,
  type BlockState,
  type GlideState,
} from "./abilities";
import { checkpointsFor, respawnX, updateReached } from "./checkpoints";
import {
  consumeJump,
  freshJumpFeel,
  noteJumpPress,
  peekJump,
  takeJump,
  tickJumpFeel,
  type JumpFeel,
} from "./jumpFeel";

// ---------------------------------------------------------------------------
// 物理常量
// ---------------------------------------------------------------------------

export const GRAVITY = 2000;
export const MOVE_SPEED = 240;
/** 王子的起跳速度(全场跳得最矮的那个,关卡几何一律按他卡) */
export const PRINCE_JUMP_V = 660;
/** 公主第一段跳 */
export const PRINCESS_JUMP_V = 610;
/** 公主在半空中再蹬一下 */
export const PRINCESS_DOUBLE_V = 520;

export const HERO_W = 32;
export const HERO_H = 46;

/** 挥剑:出手快、伤害高、够不远 */
export const MELEE_TIME = 0.18;
export const MELEE_CD = 0.32;
export const MELEE_RANGE = 54;
export const MELEE_DAMAGE = 3;
/** 剑能往上够到的额外高度(跳起来砍蝙蝠靠它) */
export const MELEE_LIFT = 24;

/** 星星:飞得远、会自己瞄、伤害低一点 */
export const SHOT_SPEED = 430;
export const SHOT_CD = 0.42;
export const SHOT_DAMAGE = 2;
export const SHOT_LIFE = 1.5;
export const SHOT_R = 9;
/** 星星自动瞄准的最远距离 */
export const SHOT_AIM_RANGE = 520;
/** 星星纵向偏转的上限(斜太多就不像「平推一颗星」了) */
export const SHOT_MAX_VY = 300;

/** 怪吐出来的弹 */
export const ENEMY_SHOT_SPEED = 230;
export const ENEMY_SHOT_LIFE = 3.4;
export const TURRET_CD = 1.9;

export const STOMP_BOUNCE = 420;
export const STOMP_DAMAGE = 2;
/** 受伤后的公共无敌时间(两个人共用) */
export const HURT_INVULN = 1.5;
/** 被小云朵托回检查点之后的缓冲:让人站稳看清楚再说 */
export const CLOUD_GRACE = 2.4;
export const FALL_LIMIT = 260;
/** 滑地板的减速系数(越小越滑) */
export const SLIP_FRICTION = 3;
/** 物理最大子步长:再大的 dt 会被切开,保证快慢机上手感一致 */
export const MAX_SUBSTEP = 1 / 120;

export type HeroKind = "prince" | "princess";

export const HERO_KINDS: HeroKind[] = ["prince", "princess"];
export const HERO_NAMES: Record<HeroKind, string> = { prince: "王子", princess: "公主" };

/** 某位主角的起跳速度 */
export function jumpSpeedOf(kind: HeroKind): number {
  return kind === "prince" ? PRINCE_JUMP_V : PRINCESS_JUMP_V;
}

/** 某位主角一次起跳能上升的最高点(px) */
export function jumpApex(kind: HeroKind): number {
  const v = jumpSpeedOf(kind);
  return (v * v) / (2 * GRAVITY);
}

/** 某位主角一次起跳能跨过的水平距离(px) */
export function jumpRange(kind: HeroKind): number {
  return ((2 * jumpSpeedOf(kind)) / GRAVITY) * MOVE_SPEED;
}

/** 公主二段跳能摸到的最高点:第一段到顶后再蹬一下 */
export function doubleJumpApex(): number {
  return jumpApex("princess") + (PRINCESS_DOUBLE_V * PRINCESS_DOUBLE_V) / (2 * GRAVITY);
}

// ---------------------------------------------------------------------------
// 克制关系
// ---------------------------------------------------------------------------

export type DamageKind = "melee" | "shot" | "stomp";

export interface EnemyStat {
  hp: number;
  w: number;
  h: number;
  /** 会不会主动追人 */
  chases: boolean;
  /** 会不会吐弹 */
  shoots: boolean;
  label: string;
  emoji: string;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStat> = {
  slime: { hp: 3, w: 36, h: 30, chases: false, shoots: false, label: "果冻怪", emoji: "🟢" },
  bat: { hp: 3, w: 34, h: 26, chases: false, shoots: false, label: "小蝙蝠", emoji: "🦇" },
  armor: { hp: 6, w: 40, h: 40, chases: false, shoots: false, label: "铠甲怪", emoji: "🛡️" },
  ghost: { hp: 4, w: 34, h: 38, chases: false, shoots: false, label: "小幽灵", emoji: "👻" },
  turret: { hp: 4, w: 38, h: 42, chases: false, shoots: true, label: "水晶炮台", emoji: "🔮" },
};

/**
 * 这一击打不打得动这只怪。
 * 铠甲怪的壳会把星星弹开(只吃近战与踩),幽灵是虚体、剑会穿过去(只吃远程)。
 */
export function canDamage(kind: EnemyKind, by: DamageKind): boolean {
  if (kind === "armor") return by !== "shot";
  if (kind === "ghost") return by === "shot";
  return true;
}

/** 这位主角的普通攻击属于哪一类伤害 */
export function attackKindOf(hero: HeroKind): DamageKind {
  return hero === "prince" ? "melee" : "shot";
}

/** 这只怪该交给谁打(给提示与机器人用);两个人都行时返回 null */
export function counterFor(kind: EnemyKind): HeroKind | null {
  if (kind === "armor") return "prince";
  if (kind === "ghost") return "princess";
  return null;
}

// ---------------------------------------------------------------------------
// 输入
// ---------------------------------------------------------------------------

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** 攻击键:王子挥剑,公主放星星 */
  atk: boolean;
}

export function emptyInput(): Input {
  return { left: false, right: false, up: false, down: false, atk: false };
}

export type InputName = keyof Input;

/** 双人键位:王子 W A S D + F,公主 ↑←↓→ + L */
export const KEY_MAP: Record<string, { player: 0 | 1; action: InputName }> = {
  KeyW: { player: 0, action: "up" },
  KeyA: { player: 0, action: "left" },
  KeyS: { player: 0, action: "down" },
  KeyD: { player: 0, action: "right" },
  KeyF: { player: 0, action: "atk" },
  Space: { player: 0, action: "atk" },
  ArrowUp: { player: 1, action: "up" },
  ArrowLeft: { player: 1, action: "left" },
  ArrowDown: { player: 1, action: "down" },
  ArrowRight: { player: 1, action: "right" },
  KeyL: { player: 1, action: "atk" },
};

/**
 * 键盘事件 code 翻译成「几号玩家的哪个动作」。
 * 单人模式下两套键位都开给当前操作的那一位(一个人玩的时候左右手都顺)。
 */
export function keyToAction(
  code: string,
  playerCount: number,
  active: number
): { player: number; action: InputName } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  if (playerCount <= 1) return { player: active, action: hit.action };
  return { player: hit.player, action: hit.action };
}

/** Tab 换人(单人模式) */
export function isSwapKey(code: string): boolean {
  return code === "Tab";
}

/** Esc 暂停 */
export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

// ---------------------------------------------------------------------------
// 世界状态
// ---------------------------------------------------------------------------

export interface HeroState {
  index: number;
  kind: HeroKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  /** 还能在半空中跳几次(公主 1,王子 0) */
  airJumps: number;
  attackT: number;
  attackCd: number;
  prevUp: boolean;
  prevAtk: boolean;
  /** 跳跃的输入宽容:土狼时间 + 跳跃缓冲(见 `jumpFeel.ts`) */
  jump: JumpFeel;
  ridingPlatform: number;
  /** 刚从浮台上蹲跳穿下去,这段时间内不再踩住浮台 */
  dropT: number;
  hurtFlash: number;
  kills: number;
  gems: number;
  /** 公主的滑翔额度(王子的永远是空的) */
  glide: GlideState;
  /** 这一帧正推着箱子 */
  pushing: boolean;
  /** 机器人托管时用来发现「卡住了」 */
  aiPrevX: number;
  aiStuckT: number;
}

export interface EnemyState {
  kind: EnemyKind;
  x: number;
  y: number;
  baseY: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  alive: boolean;
  t: number;
  hurtT: number;
  fireCd: number;
  /** 倒下时的小动画计时(渲染用) */
  fade: number;
}

export interface ShotState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** 主角打出去的 */
  friendly: boolean;
  owner: number;
  alive: boolean;
}

export interface PlatformState {
  baseX: number;
  x: number;
  prevX: number;
  y: number;
  w: number;
  moving: boolean;
  range: number;
  speed: number;
}

export interface GemState {
  x: number;
  y: number;
  ground: boolean;
  taken: boolean;
}

export type BossPhase = "rest" | "charge" | "volley" | "slam";

export interface BossState {
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  onGround: boolean;
  facing: 1 | -1;
  phase: BossPhase;
  phaseT: number;
  /** 当前护甲只吃哪一种攻击 */
  guard: DamageKind;
  guardT: number;
  guardSeconds: number;
  restSeconds: number;
  hurtT: number;
  alive: boolean;
  /** 招式轮换的游标 */
  cycle: number;
}

export type EventKind =
  | "jump"
  | "double"
  | "glide"
  | "push"
  | "bridge"
  | "shield"
  | "cloud"
  | "flag"
  | "slash"
  | "shoot"
  | "hit"
  | "block"
  | "defeat"
  | "gem"
  | "hurt"
  | "guard"
  | "bossHit"
  | "bossDown"
  | "slam"
  | "door"
  | "win"
  | "lose";

export interface WorldEvent {
  kind: EventKind;
  x: number;
  y: number;
  hero?: number;
  text?: string;
}

export type WorldStatus = "playing" | "won" | "lost";

export interface World {
  def: LevelDef;
  heroes: HeroState[];
  enemies: EnemyState[];
  shots: ShotState[];
  platforms: PlatformState[];
  gems: GemState[];
  spikes: Array<{ x: number; w: number }>;
  gaps: Gap[];
  /** 重箱子(只有王子推得动) */
  blocks: BlockState[];
  /** 检查点小旗的 x(至少两面) */
  flags: number[];
  /** 两个人都走过的最后一面旗(-1 = 一面都还没点亮) */
  reached: number;
  boss: BossState | null;
  /** 一个人玩的时候正在操作的是谁 */
  active: number;
  players: 1 | 2;
  time: number;
  hearts: number;
  /** 公共无敌计时 */
  invuln: number;
  kills: number;
  enemyTotal: number;
  gemsTaken: number;
  /** 上面三项里,真人自己那一份(一个人玩的时候搭档的那份不算) */
  playerKills: number;
  playerGems: number;
  /** 真人自己打中怪 / 首领的次数 —— 用来判「这一关是不是搭档一个人打完的」 */
  playerHits: number;
  status: WorldStatus;
  message: string;
  events: WorldEvent[];
}

function makeHero(index: number, kind: HeroKind, x: number): HeroState {
  return {
    index,
    kind,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    airJumps: kind === "princess" ? 1 : 0,
    attackT: 0,
    attackCd: 0,
    prevUp: false,
    prevAtk: false,
    jump: freshJumpFeel(),
    ridingPlatform: -1,
    dropT: 0,
    hurtFlash: 0,
    kills: 0,
    gems: 0,
    glide: freshGlide(),
    pushing: false,
    aiPrevX: x,
    aiStuckT: 0,
  };
}

function makeEnemy(def: EnemyDef): EnemyState {
  const stat = ENEMY_STATS[def.kind];
  return {
    kind: def.kind,
    x: def.x,
    y: def.y,
    baseY: def.y,
    minX: def.minX,
    maxX: def.maxX,
    speed: def.speed,
    dir: 1,
    hp: stat.hp,
    maxHp: stat.hp,
    alive: true,
    t: 0,
    hurtT: 0,
    fireCd: TURRET_CD * 0.6,
    fade: 0,
  };
}

function makeBoss(def: BossDef): BossState {
  return {
    kind: def.kind,
    x: def.x,
    y: 0,
    vx: 0,
    vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    onGround: true,
    facing: -1,
    phase: "rest",
    phaseT: def.restSeconds,
    guard: "melee",
    guardT: def.guardSeconds,
    guardSeconds: def.guardSeconds,
    restSeconds: def.restSeconds,
    hurtT: 0,
    alive: true,
    cycle: 0,
  };
}

export function createWorld(def: LevelDef, players: 1 | 2 = 1): World {
  return {
    def,
    heroes: [makeHero(0, "prince", 74), makeHero(1, "princess", 132)],
    enemies: def.enemies.map(makeEnemy),
    shots: [],
    platforms: def.platforms.map((p) => ({
      baseX: p.x,
      x: p.x,
      prevX: p.x,
      y: p.y,
      w: p.w,
      moving: p.kind === "move",
      range: p.range ?? 0,
      speed: p.speed ?? 0,
    })),
    gems: def.gems.map((g) => ({ x: g.x, y: g.y, ground: g.ground, taken: false })),
    spikes: def.spikes.map((s) => ({ x: s.x, w: s.w })),
    gaps: def.gaps,
    blocks: (def.blocks ?? []).map((b) => ({ x: b.x, y: b.y, vy: 0, bridge: false })),
    flags: checkpointsFor(def),
    reached: -1,
    boss: def.boss ? makeBoss(def.boss) : null,
    active: 0,
    players,
    time: 0,
    hearts: def.hearts,
    invuln: 0,
    kills: 0,
    enemyTotal: def.enemies.length,
    gemsTaken: 0,
    playerKills: 0,
    playerGems: 0,
    playerHits: 0,
    status: "playing",
    message: "",
    events: [],
  };
}

// ---------------------------------------------------------------------------
// 查询 helper
// ---------------------------------------------------------------------------

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function heroBox(h: HeroState): Box {
  return { x0: h.x - HERO_W / 2, x1: h.x + HERO_W / 2, y0: h.y - HERO_H, y1: h.y };
}

export function enemyBox(e: EnemyState): Box {
  const stat = ENEMY_STATS[e.kind];
  const flying = e.baseY < 0;
  const y1 = flying ? e.y + stat.h / 2 : e.y;
  return { x0: e.x - stat.w / 2, x1: e.x + stat.w / 2, y0: y1 - stat.h, y1 };
}

export const BOSS_W = 92;
export const BOSS_H = 84;

export function bossBox(b: BossState): Box {
  return { x0: b.x - BOSS_W / 2, x1: b.x + BOSS_W / 2, y0: b.y - BOSS_H, y1: b.y };
}

/** 挥剑时剑扫过的范围 */
export function meleeBox(h: HeroState): Box | null {
  if (h.attackT <= 0) return null;
  const front = h.x + h.facing * (HERO_W / 2 + MELEE_RANGE / 2);
  return {
    x0: front - MELEE_RANGE / 2,
    x1: front + MELEE_RANGE / 2,
    y0: h.y - HERO_H - MELEE_LIFT,
    y1: h.y + 8,
  };
}

/**
 * 这一位现在是真人在操作吗。
 *
 * 两个人玩的时候两位都是真人;一个人玩的时候只有 `active` 那位是,
 * 另一位由 `botInput` 托管 —— 搭档的战果不能记在真人头上。
 */
export function humanHero(w: World, heroIndex: number): boolean {
  return w.players === 2 || heroIndex === w.active;
}

/** 打倒的小怪比例(0..1);没有小怪的关直接算 1 */
export function killRatio(w: World): number {
  return w.enemyTotal > 0 ? w.kills / w.enemyTotal : 1;
}

/** 城门开了没有:普通关看清怪比例,首领关看首领倒没倒 */
export function doorOpen(w: World): boolean {
  if (w.boss) return !w.boss.alive;
  return killRatio(w) >= w.def.requiredRatio - 1e-9;
}

/** 还差几只才能开门 */
export function remainingForDoor(w: World): number {
  if (w.boss) return w.boss.alive ? 1 : 0;
  const need = Math.ceil(w.enemyTotal * w.def.requiredRatio);
  return Math.max(0, need - w.kills);
}

/**
 * 从 x 往回找一块「站得稳」的地面:不光脚下是实心的,前后各留半个身位,
 * 免得摔下去以后被放回断口边缘,一动就又掉下去。
 */
export function safeGroundX(def: LevelDef, x: number): number {
  const roomy = (probe: number): boolean =>
    groundSolidAt(def, probe) &&
    groundSolidAt(def, Math.max(24, probe - 54)) &&
    groundSolidAt(def, Math.min(def.len - 24, probe + 28));
  const from = Math.min(Math.max(24, x), def.len - 24);
  for (let probe = from; probe > 24; probe -= 6) if (roomy(probe)) return probe;
  for (let probe = from; probe < def.len - 24; probe += 6) if (roomy(probe)) return probe;
  return 44;
}

function pushEvent(w: World, kind: EventKind, x: number, y: number, hero?: number, text?: string): void {
  if (w.events.length > 90) w.events.shift();
  w.events.push({ kind, x, y, hero, text });
}

/** 取走并清空事件队列(渲染层每帧调一次,用来放音效和特效) */
export function drainEvents(w: World): WorldEvent[] {
  const out = w.events;
  w.events = [];
  return out;
}

// ---------------------------------------------------------------------------
// 受伤与击倒
// ---------------------------------------------------------------------------

/**
 * 两个人共用一条心条:受伤后进入公共无敌,替对方挡刀是划算的。
 *
 * 画面上受伤 = **戴上小护盾闪一下**(`shield` 事件),没有任何受伤描写。
 * 教学关(`def.noRisk`)连心都不掉,只闪护盾 —— 站着不动一整天也不会输。
 */
function hurt(w: World, h: HeroState, fromX: number, why: string): void {
  if (w.invuln > 0 || w.status !== "playing") return;
  w.invuln = HURT_INVULN;
  h.hurtFlash = 0.55;
  const away: 1 | -1 = h.x >= fromX ? 1 : -1;
  h.vx = away * 190;
  h.vy = -250;
  h.onGround = false;
  pushEvent(w, "shield", h.x, h.y - 30, h.index);
  if (w.def.noRisk) return;
  w.hearts--;
  pushEvent(w, "hurt", h.x, h.y - 24, h.index);
  if (w.hearts <= 0) {
    w.status = "lost";
    w.message = why;
    pushEvent(w, "lose", h.x, h.y);
  }
}

/**
 * 掉下去 = 被一朵小云托回最近点亮的那面小旗。
 * **只挪人**:宝石、清怪数、已经开的城门统统保留,不许整关重来。
 */
function cloudBack(w: World, h: HeroState): void {
  const back = respawnX(w.def, w.flags, w.reached, h.x);
  h.x = back;
  h.y = -50;
  h.vy = 0;
  h.vx = 0;
  h.glide = freshGlide();
  w.invuln = Math.max(w.invuln, CLOUD_GRACE);
  pushEvent(w, "cloud", back, -70, h.index);
}

function defeatEnemy(w: World, e: EnemyState, by: HeroState | null): void {
  if (!e.alive) return;
  e.alive = false;
  e.fade = 0.6;
  w.kills++;
  if (by) {
    by.kills++;
    if (humanHero(w, by.index)) w.playerKills++;
  }
  pushEvent(w, "defeat", e.x, e.y - 20, by?.index);
  if (doorOpen(w) && !w.boss) pushEvent(w, "door", w.def.goalX, -40);
}

function damageEnemy(w: World, e: EnemyState, amount: number, by: DamageKind, hero: HeroState | null): void {
  if (!e.alive) return;
  if (!canDamage(e.kind, by)) {
    if (e.hurtT <= 0) {
      e.hurtT = 0.18;
      pushEvent(w, "block", e.x, e.y - 24, hero?.index);
    }
    return;
  }
  e.hp -= amount;
  e.hurtT = 0.22;
  if (hero && humanHero(w, hero.index)) w.playerHits++;
  pushEvent(w, "hit", e.x, e.y - 24, hero?.index);
  if (e.hp <= 0) defeatEnemy(w, e, hero);
}

function damageBoss(w: World, amount: number, by: DamageKind, hero: HeroState | null): void {
  const boss = w.boss;
  if (!boss || !boss.alive) return;
  // 踩首领不算伤害,只把人弹开
  if (by === "stomp") return;
  if (by !== boss.guard) {
    if (boss.hurtT <= 0) {
      boss.hurtT = 0.16;
      pushEvent(w, "block", boss.x, boss.y - BOSS_H, hero?.index);
    }
    return;
  }
  boss.hp -= amount;
  boss.hurtT = 0.22;
  if (hero && humanHero(w, hero.index)) w.playerHits++;
  pushEvent(w, "bossHit", boss.x, boss.y - BOSS_H, hero?.index);
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.alive = false;
    w.status = "won";
    w.message = "";
    pushEvent(w, "bossDown", boss.x, boss.y - BOSS_H / 2);
    pushEvent(w, "win", boss.x, -40);
  }
}

// ---------------------------------------------------------------------------
// 单步推进
// ---------------------------------------------------------------------------

function stepPlatforms(w: World): void {
  for (const pl of w.platforms) {
    pl.prevX = pl.x;
    if (!pl.moving || pl.range <= 0) continue;
    const omega = pl.speed / Math.max(20, pl.range);
    pl.x = pl.baseX + Math.sin(w.time * omega) * pl.range;
  }
}

function spawnEnemyShot(w: World, e: EnemyState, targetX: number, targetY: number): void {
  const sy = e.y - ENEMY_STATS[e.kind].h * 0.55;
  const dx = targetX - e.x;
  const dy = targetY - sy;
  const dist = Math.max(40, Math.hypot(dx, dy));
  w.shots.push({
    x: e.x,
    y: sy,
    vx: (dx / dist) * ENEMY_SHOT_SPEED,
    vy: (dy / dist) * ENEMY_SHOT_SPEED,
    life: ENEMY_SHOT_LIFE,
    friendly: false,
    owner: -1,
    alive: true,
  });
  pushEvent(w, "shoot", e.x, sy);
}

function stepEnemies(w: World, dt: number): void {
  for (const e of w.enemies) {
    if (e.fade > 0) e.fade = Math.max(0, e.fade - dt);
    if (!e.alive) continue;
    e.t += dt;
    if (e.hurtT > 0) e.hurtT = Math.max(0, e.hurtT - dt);

    if (e.kind === "turret") {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        e.fireCd = TURRET_CD;
        // 朝最近的那位主角吐一发
        let best = w.heroes[0];
        for (const h of w.heroes) if (Math.abs(h.x - e.x) < Math.abs(best.x - e.x)) best = h;
        if (Math.abs(best.x - e.x) < 620) spawnEnemyShot(w, e, best.x, best.y - HERO_H * 0.5);
      }
      continue;
    }

    if (e.maxX > e.minX) {
      e.x += e.dir * e.speed * dt;
      if (e.x <= e.minX) {
        e.x = e.minX;
        e.dir = 1;
      } else if (e.x >= e.maxX) {
        e.x = e.maxX;
        e.dir = -1;
      }
    }
    if (e.baseY < 0) {
      // 飞行怪上下飘一点,飘动幅度不会把它带到剑够得着的高度以下
      e.y = e.baseY + Math.sin(e.t * 2.2) * 12;
    }
  }
}

function stepShots(w: World, dt: number): void {
  for (const s of w.shots) {
    if (!s.alive) continue;
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.life <= 0 || s.x < -60 || s.x > w.def.len + 60 || s.y > 80 || s.y < -420) s.alive = false;
  }
  if (w.shots.length > 60) w.shots = w.shots.filter((s) => s.alive);
}

function applyHorizontal(w: World, h: HeroState, input: Input, dt: number): void {
  const def = w.def;
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (dir !== 0) h.facing = dir > 0 ? 1 : -1;

  const target = MOVE_SPEED * dir;
  if (def.slippery && h.onGround) {
    h.vx += (target - h.vx) * Math.min(1, SLIP_FRICTION * dt);
  } else if (h.onGround) {
    h.vx = target;
  } else {
    h.vx += (target - h.vx) * Math.min(1, 6 * dt);
  }

  h.x += h.vx * dt;
  meetBlocks(w, h, dir === 0 ? 0 : dir > 0 ? 1 : -1, dt);
  if (h.x < 16) {
    h.x = 16;
    h.vx = 0;
  }
  if (h.x > def.len - 16) {
    h.x = def.len - 16;
    h.vx = 0;
  }
}

/**
 * 撞上重箱子:王子顶着走(推),公主被挡在外面(但箱子只有 `BLOCK_H` 高,跳过去就是了)。
 * 架成桥的箱子不挡人也不再推得动。
 */
function meetBlocks(w: World, h: HeroState, dir: -1 | 0 | 1, dt: number): void {
  h.pushing = false;
  for (const b of w.blocks) {
    if (b.bridge) continue;
    const top = b.y - BLOCK_H;
    // 站在箱子顶上不算撞
    if (h.y <= top + 2) continue;
    if (h.y - HERO_H >= b.y) continue;
    const half = BLOCK_W / 2 + HERO_W / 2;
    if (Math.abs(h.x - b.x) >= half) continue;
    const fromLeft = h.x < b.x;
    const moved = pushStep(b, h, dir, dt);
    if (moved.pushed) {
      b.x = moved.x;
      h.pushing = true;
      if (Math.abs(h.vx) > moved.limit) h.vx = Math.sign(h.vx) * moved.limit;
      pushEvent(w, "push", b.x, b.y - BLOCK_H, h.index);
    }
    // 不管推没推动,人都不许穿进箱子里
    h.x = fromLeft ? Math.min(h.x, b.x - half) : Math.max(h.x, b.x + half);
  }
}

/** 箱子脚下托着它的那一面(地面 0 / 台面负数);断口上就是 null */
function blockSupportY(w: World, b: BlockState): number | null {
  let best: number | null = null;
  for (const pl of w.platforms) {
    if (b.x <= pl.x - 6 || b.x >= pl.x + pl.w + 6) continue;
    if (pl.y < b.y - 2) continue;
    if (best === null || pl.y < best) best = pl.y;
  }
  if (groundSolidAt(w.def, b.x) && b.y <= 2) {
    if (best === null || best > 0) best = 0;
  } else if (groundSolidAt(w.def, b.x) && (best === null || best > 0)) {
    best = 0;
  }
  return best;
}

function stepBlocks(w: World, dt: number): void {
  for (let i = 0; i < w.blocks.length; i++) {
    const before = w.blocks[i];
    if (before.bridge) continue;
    const next = fallStep(before, blockSupportY(w, before), GRAVITY, dt);
    w.blocks[i] = next;
    if (next.bridge && !before.bridge) pushEvent(w, "bridge", next.x, next.y - BLOCK_H);
  }
}

/** 这颗宝石现在被箱子压着吗(压着就捡不到,得先让王子把箱子推开) */
export function gemCovered(w: World, g: { x: number; y: number }): boolean {
  return w.blocks.some(
    (b) =>
      !b.bridge &&
      g.x > b.x - BLOCK_W / 2 &&
      g.x < b.x + BLOCK_W / 2 &&
      g.y > b.y - BLOCK_H - 4 &&
      g.y < b.y + 4
  );
}

/** 这个 x 有没有踩得住的地面(架好的桥也算实地) */
export function solidAtX(w: World, x: number): boolean {
  if (groundSolidAt(w.def, x)) return true;
  return w.blocks.some((b) => b.bridge && x > b.x - BLOCK_W / 2 && x < b.x + BLOCK_W / 2);
}

function applyVertical(w: World, h: HeroState, input: Input, dt: number): void {
  const def = w.def;
  const prevFeet = h.y;
  h.vy += GRAVITY * dt;
  // 公主的滑翔:空中按住跳键,最多飘 2 秒
  const glided = glideStep(h.glide, {
    kind: h.kind,
    onGround: h.onGround,
    holding: input.up,
    vy: h.vy,
    dt,
  });
  if (glided.glide.active && !h.glide.active) pushEvent(w, "glide", h.x, h.y - 24, h.index);
  h.vy = glided.vy;
  h.glide = glided.glide;
  h.y += h.vy * dt;
  h.onGround = false;
  h.ridingPlatform = -1;

  // 重箱子的顶面也是「可踩」:从上往下落才踩得住
  for (const b of w.blocks) {
    if (h.vy < 0) continue;
    const top = b.y - BLOCK_H;
    if (h.x <= b.x - BLOCK_W / 2 - HERO_W * 0.3 || h.x >= b.x + BLOCK_W / 2 + HERO_W * 0.3) continue;
    if (prevFeet <= top + 6 && h.y >= top) {
      h.y = top;
      h.vy = 0;
      h.onGround = true;
    }
  }

  // 空中平台(单向:只有从上往下落才踩得住)
  for (let i = 0; i < w.platforms.length; i++) {
    const pl = w.platforms[i];
    if (h.vy < 0 || h.dropT > 0) continue;
    const within = h.x > pl.x - HERO_W * 0.35 && h.x < pl.x + pl.w + HERO_W * 0.35;
    if (!within) continue;
    if (prevFeet <= pl.y + 6 && h.y >= pl.y) {
      h.y = pl.y;
      h.vy = 0;
      h.onGround = true;
      h.ridingPlatform = i;
      h.x += pl.x - pl.prevX;
    }
  }

  // 地面:只有「上一刻还在地面之上」才踩得住,
  // 否则掉进断口以后会被对面的地面从下面接住,像是穿墙一样弹上来
  if (!h.onGround && h.vy >= 0 && prevFeet <= 0.01 && h.y >= 0 && solidAtX(w, h.x)) {
    h.y = 0;
    h.vy = 0;
    h.onGround = true;
  }

  if (h.onGround) {
    h.airJumps = h.kind === "princess" ? 1 : 0;
    h.glide = freshGlide();
  }

  if (h.y > FALL_LIMIT) {
    hurt(w, h, h.x, "心用完啦!小云朵把大家送回起点,再来一遍就好。");
    cloudBack(w, h);
  }
}

/** 公主放星星:出手时自动挑一个够得着的目标,微微斜着飞过去 */
function spawnHeroShot(w: World, h: HeroState): void {
  const sy = h.y - HERO_H * 0.6;
  let aimY = sy;
  let bestD = Infinity;
  for (const e of w.enemies) {
    if (!e.alive || !canDamage(e.kind, "shot")) continue;
    const rel = (e.x - h.x) * h.facing;
    if (rel < 0 || rel > SHOT_AIM_RANGE) continue;
    if (rel < bestD) {
      bestD = rel;
      const box = enemyBox(e);
      aimY = (box.y0 + box.y1) / 2;
    }
  }
  const boss = w.boss;
  if (boss && boss.alive) {
    const rel = (boss.x - h.x) * h.facing;
    if (rel >= 0 && rel < SHOT_AIM_RANGE && rel < bestD) aimY = boss.y - BOSS_H / 2;
  }
  const dx = Math.max(60, bestD);
  let vy = ((aimY - sy) / dx) * SHOT_SPEED;
  vy = Math.max(-SHOT_MAX_VY, Math.min(SHOT_MAX_VY, vy));
  w.shots.push({
    x: h.x + h.facing * (HERO_W / 2 + 6),
    y: sy,
    vx: h.facing * SHOT_SPEED,
    vy,
    life: SHOT_LIFE,
    friendly: true,
    owner: h.index,
    alive: true,
  });
  pushEvent(w, "shoot", h.x, sy, h.index);
}

function applyActions(w: World, h: HeroState, input: Input, dt: number): void {
  if (h.attackT > 0) h.attackT = Math.max(0, h.attackT - dt);
  if (h.attackCd > 0) h.attackCd = Math.max(0, h.attackCd - dt);
  if (h.hurtFlash > 0) h.hurtFlash = Math.max(0, h.hurtFlash - dt);
  if (h.dropT > 0) h.dropT = Math.max(0, h.dropT - dt);

  // 跳的输入宽容(`jumpFeel.ts`):按下沿先进缓冲,踩着地就把土狼时间刷满,
  // 然后这一帧再决定那一下跳兑不兑现。放宽的只有「什么时候算数」,
  // 跳多高、公主能跳几次,规则一个字没变。
  tickJumpFeel(h.jump, dt, h.onGround);
  if (input.up && !h.prevUp) noteJumpPress(h.jump);
  h.prevUp = input.up;

  const wants = peekJump(h.jump, h.onGround, h.airJumps);
  if (wants === "ground" && h.onGround && input.down && h.ridingPlatform >= 0) {
    // 按着下再按跳:从浮台上穿下去。这一下按键被穿台用掉了,不再兑现成跳
    consumeJump(h.jump);
    h.onGround = false;
    h.ridingPlatform = -1;
    h.dropT = 0.3;
    h.y += 6;
    h.vy = 60;
  } else if (wants) {
    takeJump(h.jump, h.onGround, h.airJumps);
    if (wants === "ground") {
      h.vy = -jumpSpeedOf(h.kind);
      h.onGround = false;
      pushEvent(w, "jump", h.x, h.y, h.index);
    } else {
      // 公主的二段跳
      h.airJumps--;
      h.vy = -PRINCESS_DOUBLE_V;
      pushEvent(w, "double", h.x, h.y - 10, h.index);
    }
  }

  if (input.atk && !h.prevAtk && h.attackCd <= 0) {
    h.attackCd = h.kind === "prince" ? MELEE_CD : SHOT_CD;
    if (h.kind === "prince") {
      h.attackT = MELEE_TIME;
      pushEvent(w, "slash", h.x + h.facing * 34, h.y - 22, h.index);
    } else {
      h.attackT = MELEE_TIME;
      spawnHeroShot(w, h);
    }
  }
  h.prevAtk = input.atk;
}

function interactions(w: World, h: HeroState, dt: number): void {
  const box = heroBox(h);

  // 宝石(被箱子压着的那颗捡不到,得先让王子把箱子推开)
  for (const g of w.gems) {
    if (g.taken) continue;
    if (gemCovered(w, g)) continue;
    if (Math.abs(g.x - h.x) < 28 && g.y > box.y0 - 24 && g.y < box.y1 + 20) {
      g.taken = true;
      w.gemsTaken++;
      h.gems++;
      if (humanHero(w, h.index)) w.playerGems++;
      pushEvent(w, "gem", g.x, g.y, h.index);
    }
  }

  // 挥剑
  const blade = h.kind === "prince" ? meleeBox(h) : null;
  if (blade) {
    for (const e of w.enemies) {
      if (!e.alive) continue;
      if (overlaps(blade, enemyBox(e))) damageEnemy(w, e, MELEE_DAMAGE, "melee", h);
    }
    if (w.boss?.alive && overlaps(blade, bossBox(w.boss))) damageBoss(w, MELEE_DAMAGE, "melee", h);
  }

  // 撞到怪:从上面落下去算踩,其余算受伤
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const ebox = enemyBox(e);
    if (!overlaps(box, ebox)) continue;
    const stompable = canDamage(e.kind, "stomp") && e.baseY >= 0;
    if (stompable && h.vy > 40 && box.y1 - h.vy * dt <= ebox.y0 + 6) {
      damageEnemy(w, e, STOMP_DAMAGE, "stomp", h);
      h.vy = -STOMP_BOUNCE;
      h.onGround = false;
    } else {
      hurt(w, h, e.x, "怪物有点厉害!换个节奏,两个人配合着来。");
    }
  }

  // 首领的身体本身就有碰撞伤害
  const boss = w.boss;
  if (boss?.alive && overlaps(box, bossBox(boss))) {
    if (h.vy > 60 && box.y1 - h.vy * dt <= boss.y - BOSS_H + 8) {
      h.vy = -STOMP_BOUNCE * 0.8;
      h.onGround = false;
    } else {
      hurt(w, h, boss.x, "首领撞过来啦!先拉开距离,看准护甲颜色再上。");
    }
  }

  // 尖刺
  for (const s of w.spikes) {
    if (h.y > -6 && h.x > s.x - 8 && h.x < s.x + s.w + 8) {
      hurt(w, h, h.x, "被尖刺扎到啦!下次早一点起跳。");
      break;
    }
  }
}

function stepShotHits(w: World): void {
  for (const s of w.shots) {
    if (!s.alive) continue;
    const sbox: Box = { x0: s.x - SHOT_R, x1: s.x + SHOT_R, y0: s.y - SHOT_R, y1: s.y + SHOT_R };
    if (s.friendly) {
      const owner = w.heroes[s.owner] ?? null;
      for (const e of w.enemies) {
        if (!e.alive) continue;
        if (!overlaps(sbox, enemyBox(e))) continue;
        damageEnemy(w, e, SHOT_DAMAGE, "shot", owner);
        s.alive = false;
        break;
      }
      if (s.alive && w.boss?.alive && overlaps(sbox, bossBox(w.boss))) {
        damageBoss(w, SHOT_DAMAGE, "shot", owner);
        s.alive = false;
      }
    } else {
      for (const h of w.heroes) {
        if (!overlaps(sbox, heroBox(h))) continue;
        hurt(w, h, s.x, "被打中啦!炮弹是直线飞的,跳一下就躲开了。");
        s.alive = false;
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 首领
// ---------------------------------------------------------------------------

function bossVolley(w: World, boss: BossState): void {
  const target = w.heroes.reduce((a, b) => (Math.abs(a.x - boss.x) <= Math.abs(b.x - boss.x) ? a : b));
  for (let i = -1; i <= 1; i++) {
    const sy = boss.y - BOSS_H * 0.6;
    const dx = target.x - boss.x;
    const dy = target.y - HERO_H * 0.5 - sy + i * 46;
    const dist = Math.max(60, Math.hypot(dx, dy));
    w.shots.push({
      x: boss.x,
      y: sy,
      vx: (dx / dist) * ENEMY_SHOT_SPEED,
      vy: (dy / dist) * ENEMY_SHOT_SPEED,
      life: ENEMY_SHOT_LIFE,
      friendly: false,
      owner: -1,
      alive: true,
    });
  }
  pushEvent(w, "shoot", boss.x, boss.y - BOSS_H * 0.6);
}

function stepBoss(w: World, dt: number): void {
  const boss = w.boss;
  if (!boss || !boss.alive) return;
  const def = w.def;
  if (boss.hurtT > 0) boss.hurtT = Math.max(0, boss.hurtT - dt);

  // 护甲来回换:红色只吃剑,蓝色只吃星星 —— 逼着两个人轮流上
  boss.guardT -= dt;
  if (boss.guardT <= 0) {
    boss.guardT = boss.guardSeconds;
    boss.guard = boss.guard === "melee" ? "shot" : "melee";
    pushEvent(w, "guard", boss.x, boss.y - BOSS_H - 20, undefined, boss.guard === "melee" ? "melee" : "shot");
  }

  const target = w.heroes.reduce((a, b) => (Math.abs(a.x - boss.x) <= Math.abs(b.x - boss.x) ? a : b));
  boss.facing = target.x >= boss.x ? 1 : -1;

  boss.phaseT -= dt;
  switch (boss.phase) {
    case "rest":
      boss.vx *= 1 - Math.min(1, 6 * dt);
      if (boss.phaseT <= 0) {
        boss.cycle = (boss.cycle + 1) % 3;
        boss.phase = boss.cycle === 0 ? "charge" : boss.cycle === 1 ? "volley" : "slam";
        boss.phaseT = boss.phase === "charge" ? 1.5 : boss.phase === "volley" ? 0.7 : 1.1;
        if (boss.phase === "volley") bossVolley(w, boss);
        if (boss.phase === "slam") {
          boss.vy = -560;
          boss.onGround = false;
        }
      }
      break;
    case "charge":
      boss.vx = boss.facing * 210;
      if (boss.phaseT <= 0) {
        boss.phase = "rest";
        boss.phaseT = boss.restSeconds;
      }
      break;
    case "volley":
      boss.vx *= 1 - Math.min(1, 6 * dt);
      if (boss.phaseT <= 0) {
        boss.phase = "rest";
        boss.phaseT = boss.restSeconds;
      }
      break;
    case "slam":
      boss.vx = boss.facing * 120;
      if (boss.onGround && boss.vy >= 0 && boss.phaseT <= 0.6) {
        pushEvent(w, "slam", boss.x, boss.y);
        boss.phase = "rest";
        // 落地后多歇一会儿:这就是玩家凑上去输出的窗口
        boss.phaseT = boss.restSeconds + 0.7;
      }
      break;
    default:
      break;
  }

  boss.vy += GRAVITY * dt;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.onGround = false;
  if (boss.y >= 0) {
    boss.y = 0;
    boss.vy = 0;
    boss.onGround = true;
  }
  const left = 260;
  const right = def.len - 120;
  if (boss.x < left) {
    boss.x = left;
    boss.vx = Math.abs(boss.vx);
  }
  if (boss.x > right) {
    boss.x = right;
    boss.vx = -Math.abs(boss.vx);
  }
}

// ---------------------------------------------------------------------------
// 结束判定
// ---------------------------------------------------------------------------

function checkGoal(w: World): void {
  if (w.status !== "playing") return;
  if (w.boss) return; // 首领关在首领倒下那一刻就赢了
  if (!doorOpen(w)) return;
  const atDoor = w.heroes.filter((h) => Math.abs(h.x - w.def.goalX) < 64 && h.y > -170);
  const need = w.def.goalNeedsAll ? w.heroes.length : 1;
  if (atDoor.length < need) return;
  // 一个人玩的时候城门只认你手上这位:搭档先跑到也得等你走过来。
  // 不加这一条的话「站着不动让搭档跑完全程」就是通关捷径(第 3 轮 B2:188 关里 110 关中招)。
  if (w.players === 1 && !atDoor.some((h) => h.index === w.active)) return;
  w.status = "won";
  w.message = "";
  pushEvent(w, "win", w.def.goalX, -40);
}

function stepOnce(w: World, dt: number, inputs: Input[]): void {
  if (w.status !== "playing") return;
  w.time += dt;
  if (w.invuln > 0) w.invuln = Math.max(0, w.invuln - dt);
  stepPlatforms(w);
  stepBlocks(w, dt);
  stepEnemies(w, dt);
  stepShots(w, dt);
  stepBoss(w, dt);
  if (w.status !== "playing") return;

  for (let i = 0; i < w.heroes.length; i++) {
    const h = w.heroes[i];
    const input = inputs[i] ?? emptyInput();
    applyActions(w, h, input, dt);
    applyHorizontal(w, h, input, dt);
    applyVertical(w, h, input, dt);
    interactions(w, h, dt);
    if (w.status !== "playing") return;
  }

  // 两个人都走过一面小旗,那面旗才点亮
  const lit = updateReached(w.flags, w.reached, w.heroes.map((h) => h.x));
  if (lit > w.reached) {
    w.reached = lit;
    pushEvent(w, "flag", w.flags[lit], -60);
  }

  stepShotHits(w);
  if (w.status !== "playing") return;

  if (w.def.timeLimit > 0 && w.time > w.def.timeLimit) {
    w.status = "lost";
    w.message = "时间到啦!这段路有点长,下次挑最近的怪先打。";
    pushEvent(w, "lose", w.heroes[0].x, w.heroes[0].y);
    return;
  }
  checkGoal(w);
}

/** 推进世界。任意 dt 都会被切成不超过 MAX_SUBSTEP 的小步,保证物理稳定 */
export function stepWorld(w: World, dt: number, inputs: Input[]): void {
  let left = Math.max(0, Math.min(0.25, dt));
  let guard = 0;
  while (left > 1e-6 && w.status === "playing" && guard++ < 64) {
    const step = Math.min(MAX_SUBSTEP, left);
    stepOnce(w, step, inputs);
    left -= step;
  }
}

/** 单人模式换人 */
export function swapActive(w: World): number {
  w.active = (w.active + 1) % w.heroes.length;
  return w.active;
}

// ---------------------------------------------------------------------------
// 结算
// ---------------------------------------------------------------------------

export interface RunSummary {
  win: boolean;
  kills: number;
  enemyTotal: number;
  killPct: number;
  gems: number;
  time: number;
  hearts: number;
  bossDown: boolean;
  /** 一个人玩(另一位由搭档托管)吗 */
  solo?: boolean;
  /** 这些是真人自己的那一份 */
  playerKills?: number;
  playerGems?: number;
  playerHits?: number;
}

export function summarize(w: World): RunSummary {
  return {
    win: w.status === "won",
    kills: w.kills,
    enemyTotal: w.enemyTotal,
    killPct: Math.round(killRatio(w) * 100),
    gems: w.gemsTaken,
    time: w.time,
    hearts: w.hearts,
    bossDown: w.boss ? !w.boss.alive : false,
    solo: w.players === 1,
    playerKills: w.playerKills,
    playerGems: w.playerGems,
    playerHits: w.playerHits,
  };
}

/**
 * 「清怪」这一条算不算到你头上。
 *
 * 一个人玩的时候搭档会帮着打,这没问题;但一关下来自己一下都没打中,
 * 就不该按「路上的怪一只不剩」给星 —— 那是搭档的功劳。
 * 没有怪也没有首领的纯跑图关不受这条约束。
 */
function ownHandInFight(def: LevelDef, r: RunSummary): boolean {
  if (!r.solo) return true;
  if (r.enemyTotal === 0 && !def.boss) return true;
  return (r.playerHits ?? 0) > 0;
}

/** 三条三星标准分别达成了没有:清怪 / 用时 / 宝石 */
export function starGoals(def: LevelDef, r: RunSummary): { clear: boolean; time: boolean; gem: boolean } {
  return {
    clear: (r.enemyTotal === 0 || r.kills >= r.enemyTotal) && ownHandInFight(def, r),
    time: r.time <= def.parSeconds,
    gem: r.gems >= def.gemGoal,
  };
}

/** 三条都达成 3 星,两条 2 星,其余 1 星 */
export function starsForRun(def: LevelDef, r: RunSummary): 1 | 2 | 3 {
  const g = starGoals(def, r);
  const met = (g.clear ? 1 : 0) + (g.time ? 1 : 0) + (g.gem ? 1 : 0);
  if (met >= 3) return 3;
  if (met === 2) return 2;
  return 1;
}

/** 过关时给孩子看的一句夸奖(只夸做到的部分,没做到的说成「下次可以试试」) */
export function winMessage(def: LevelDef, r: RunSummary): string {
  const g = starGoals(def, r);
  const done: string[] = [];
  const next: string[] = [];
  // 搭档打的、搭档捡的都照实说,不往真人身上安
  const byPartner = r.solo === true && (r.playerHits ?? 0) <= 0;
  const gemsByPartner = r.solo === true ? Math.max(0, r.gems - (r.playerGems ?? r.gems)) : 0;
  if (def.boss) done.push(byPartner ? "首领是搭档打倒的" : "把首领打倒啦");
  const allDown = r.enemyTotal === 0 || r.kills >= r.enemyTotal;
  if (allDown && byPartner && r.enemyTotal > 0) next.push("这一路的怪都是搭档打倒的,下回你也上去砍两下");
  else if (g.clear) done.push("路上的怪一只不剩");
  else if (!allDown) next.push(`还剩 ${r.enemyTotal - r.kills} 只没打倒`);
  if (g.time) done.push(`只用了 ${Math.round(r.time)} 秒`);
  else next.push(`用时 ${Math.round(r.time)} 秒,标准是 ${def.parSeconds} 秒`);
  if (g.gem) done.push(gemsByPartner > 0 ? `宝石收了 ${r.gems} 颗(搭档帮着捡了 ${gemsByPartner} 颗)` : `宝石收了 ${r.gems} 颗`);
  else next.push(`宝石差 ${Math.max(0, def.gemGoal - r.gems)} 颗`);
  const head = done.length ? `${done.join("、")},真棒!` : "顺利通过啦!";
  return next.length ? `${head}下次试试:${next.join(";")}。` : head;
}

/** 无尽模式的远征分:打倒的怪、宝石和跑过的距离各算一点 */
export function endlessScore(kills: number, gems: number, meters: number): number {
  return kills * 12 + gems * 5 + Math.floor(Math.max(0, meters) / 4);
}

/** 无尽模式跑了多少米(1 米 = 20 像素,给孩子一个好读的数) */
export function metersOf(pixels: number): number {
  return Math.max(0, Math.floor(pixels / 20));
}

// ---------------------------------------------------------------------------
// 会自己通关的小机器人(测试用,单人模式下也由它托管没被操作的那位)
// ---------------------------------------------------------------------------

interface AiTarget {
  x: number;
  y: number;
  /** 目标的半宽,用来算「站多远刚好够得着又碰不到」 */
  halfW: number;
  /** 这是不是一个「要打」的目标 */
  hostile: boolean;
  /** 现在打得动吗 */
  reachable: boolean;
  /** 它正在朝我冲过来,得先躲 */
  dangerous: boolean;
}

/**
 * 单人托管的搭档跟真人之间的绳子。
 *
 * 城门已经只认真人手上那位了(见 `checkGoal`),但搭档跑的还是和真人一模一样的
 * 全功能 AI:自己清怪、自己捡宝、自己一路冲到城门口。孩子把手放开,一关的活
 * 全让小伙伴干完了 —— 帮忙可以,包场不行。所以再给搭档系上一根绳子:
 * 只接真人身边的活,绝不越过真人往城门那头开路。
 */
const ESCORT_LEASH = 220;
/** 比真人还超前这么多的怪,搭档不接;落在真人身后的漏网之鱼倒是照打不误 */
const ESCORT_ENGAGE = 300;
/** 没仗打的时候站在真人身后半步等着 */
const ESCORT_FOLLOW_GAP = 60;

/** 搭档闲着的时候站哪儿:真人朝出发点那一侧半步,免得替真人开路 */
function escortSpot(w: World, leader: HeroState): number {
  const toGoal = Math.sign(w.def.goalX - leader.x) || 1;
  return leader.x - toGoal * ESCORT_FOLLOW_GAP;
}

/**
 * 这位主角现在该盯着谁。
 *
 * `leader` 不为空表示这是单人模式里托管的搭档,真人手上那位是 `leader`:
 * 这时只接真人身边的活,没活干就回到真人身边待着,不会自己奔向城门。
 */
function chooseTarget(w: World, h: HeroState, leader: HeroState | null): AiTarget {
  const my = attackKindOf(h.kind);
  /** 这个位置算不算「真人身边」:比真人超前太多就不算,身后多远都算 */
  const nearLeader = (x: number): boolean => {
    if (!leader) return true;
    const toGoal = Math.sign(w.def.goalX - leader.x) || 1;
    return (x - leader.x) * toGoal <= ESCORT_ENGAGE;
  };
  const idle = (): AiTarget => ({
    x: leader ? escortSpot(w, leader) : w.def.goalX,
    y: 0,
    halfW: 0,
    hostile: false,
    reachable: false,
    dangerous: false,
  });
  const boss = w.boss;
  if (boss?.alive) {
    if (!nearLeader(boss.x)) return idle();
    const side = h.x <= boss.x ? -1 : 1;
    return {
      x: boss.x,
      y: boss.y - BOSS_H / 2,
      halfW: BOSS_W / 2,
      hostile: true,
      // 护甲不对口就退开等它换回来
      reachable: boss.guard === my,
      // 首领正朝我这一侧冲锋:先让开
      dangerous: boss.phase === "charge" && boss.facing === side,
    };
  }

  let best: EnemyState | null = null;
  let bestD = Infinity;
  let fallback: EnemyState | null = null;
  let fallbackD = Infinity;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    if (!nearLeader(e.x)) continue;
    const d = Math.abs(e.x - h.x);
    if (canDamage(e.kind, my)) {
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    } else if (d < fallbackD) {
      fallbackD = d;
      fallback = e;
    }
  }

  if (best && (!doorOpen(w) || bestD < 320)) {
    const box = enemyBox(best);
    return {
      x: best.x,
      y: (box.y0 + box.y1) / 2,
      halfW: ENEMY_STATS[best.kind].w / 2,
      hostile: true,
      reachable: true,
      dangerous: false,
    };
  }
  if (!doorOpen(w) && fallback) {
    // 自己打不动这只,那就跟过去,让搭档来收拾
    return { x: fallback.x - 90, y: 0, halfW: 0, hostile: false, reachable: false, dangerous: false };
  }
  return idle();
}

/**
 * 前面一小段路上有没有断口。
 *
 * 这个「一小段」有多长很要命:看得太远就会**起跳过早**,
 * 王子一跳只有 `jumpRange("prince")≈158`,最宽的断口 118 —— 提前 56 起跳会正好摔进坑里。
 * 1.1 靠「摔下去就地放回坑边」把这个毛病盖住了(第二次自然贴着边起跳);
 * 1.2 改成回检查点以后盖不住了,所以这里把预判距离收到贴边起跳。
 */
const GAP_LOOKAHEAD = 30;

function gapAhead(def: LevelDef, x: number, face: number): boolean {
  return groundSolidAt(def, x) && !groundSolidAt(def, x + face * GAP_LOOKAHEAD);
}

/** 前面一小段路上有没有尖刺 */
function spikeAhead(w: World, h: HeroState, face: number): boolean {
  return w.spikes.some((s) => {
    const rel = (s.x - h.x) * face;
    return rel > -10 && rel < 76 && h.y > -24;
  });
}

/**
 * 前面挡着一个推不动的重箱子(公主专属烦恼)。
 * 箱子只有 `BLOCK_H` 高,跳上去就过去了 —— 托管的同伴不能被它卡住。
 */
function blockAhead(w: World, h: HeroState, face: number): boolean {
  if (canPush(h.kind)) return false;
  return w.blocks.some((b) => {
    if (b.bridge) return false;
    const rel = (b.x - h.x) * face;
    if (rel < 0 || rel > BLOCK_W / 2 + HERO_W / 2 + 26) return false;
    return h.y > b.y - BLOCK_H + 2 && h.y - HERO_H < b.y;
  });
}

/** 有没有敌方炮弹正朝这位主角飞过来 */
function shotIncoming(w: World, h: HeroState): boolean {
  return w.shots.some((s) => {
    if (!s.alive || s.friendly) return false;
    const dx = s.x - h.x;
    if (Math.abs(dx) > 190) return false;
    if (Math.sign(s.vx) === Math.sign(dx)) return false;
    return Math.abs(s.y - (h.y - HERO_H * 0.5)) < 62;
  });
}

/**
 * 机器人这一帧要按什么键。
 *
 * 单人模式里没被真人操作的那位走「托管搭档」的分支:帮忙打真人身边的怪,
 * 但被 `ESCORT_LEASH` 拴在真人身边,不会替真人把关走完(见 `chooseTarget`)。
 */
export function botInput(w: World, heroIndex = 0, dt = 1 / 60): Input {
  const input = emptyInput();
  const h = w.heroes[heroIndex];
  if (!h || w.status !== "playing") return input;
  const def = w.def;
  const leader = humanHero(w, heroIndex) ? null : w.heroes[w.active] ?? null;
  const target = chooseTarget(w, h, leader);

  /**
   * 站位:永远待在自己原来那一侧,绝不为了绕后而从怪身上穿过去。
   * 王子贴到「刚好够得着又碰不到」的距离,公主站远处放星星,
   * 打不动或者对面正在冲锋的时候一律往后撤。滑地板上刹不住车,距离再放宽一截。
   */
  const side: 1 | -1 = h.x <= target.x ? -1 : 1;
  const slip = def.slippery ? 70 : 0;
  let wantX = target.x;
  if (target.hostile) {
    let standoff: number;
    if (!target.reachable || target.dangerous) standoff = 330 + slip;
    // 王子的站位不能加滑地板余量:剑就那么长,站远了永远砍空
    else if (h.kind === "prince") standoff = target.halfW + HERO_W / 2 + 16;
    else standoff = target.halfW + 170 + slip;
    wantX = target.x + side * standoff;
  }
  // 绳子只拴住「往城门那头跑」的方向:搭档想退到多远都行(公主放星星本来就要站得远),
  // 但绝不能越过真人去替他开路。
  if (leader) {
    const toGoal = Math.sign(def.goalX - leader.x) || 1;
    if ((wantX - leader.x) * toGoal > ESCORT_LEASH) wantX = leader.x + toGoal * ESCORT_LEASH;
  }
  wantX = Math.max(50, Math.min(def.len - 50, wantX));

  const dx = wantX - h.x;
  const dir = dx > 14 ? 1 : dx < -14 ? -1 : 0;
  input.right = dir > 0;
  input.left = dir < 0;
  const face = dir !== 0 ? dir : h.facing;

  // 卡在墙角 / 平台边上原地磨蹭超过一会儿就跳一下换个姿势
  if (Math.abs(h.x - h.aiPrevX) < 1.2) h.aiStuckT += dt;
  else h.aiStuckT = 0;
  h.aiPrevX = h.x;

  const towardTarget = Math.sign(target.x - h.x) || h.facing;
  const needClimb = target.hostile && target.y < h.y - 56 && Math.abs(target.x - h.x) < 260;
  const jumpNow =
    gapAhead(def, h.x, face) ||
    spikeAhead(w, h, face) ||
    blockAhead(w, h, face) ||
    shotIncoming(w, h) ||
    (needClimb && h.onGround) ||
    (h.aiStuckT > 0.5 && h.onGround);
  if (jumpNow && (h.onGround || h.airJumps > 0)) input.up = true;

  // 站定了但脸朝反方向:轻轻挪一下把脸转过去,不然剑和星星都打在空气上
  if (target.hostile && target.reachable && !target.dangerous && dir === 0 && towardTarget !== h.facing) {
    input.right = towardTarget > 0;
    input.left = towardTarget < 0;
  }

  // 攻击:王子贴身砍,公主隔着老远放
  if (target.hostile && target.reachable && !target.dangerous) {
    const rel = (target.x - h.x) * (h.facing || 1);
    if (h.kind === "prince") {
      const near = Math.abs(target.x - h.x) < target.halfW + MELEE_RANGE + HERO_W / 2;
      if (near && rel > -HERO_W && Math.abs(target.y - (h.y - HERO_H / 2)) < 72) input.atk = true;
    } else if (rel > 0 && rel < SHOT_AIM_RANGE) {
      input.atk = true;
    }
  }

  return input;
}

export interface AutoPlayResult extends RunSummary {
  lost: boolean;
  steps: number;
  timedOut: boolean;
}

/** 让机器人把这个世界玩到底(测试里用来验「真的能通关」) */
export function autoPlay(w: World, opts: { dt?: number; maxSeconds?: number } = {}): AutoPlayResult {
  const dt = opts.dt ?? 1 / 60;
  const maxSeconds = opts.maxSeconds ?? 200;
  let steps = 0;
  const limit = Math.ceil(maxSeconds / dt);
  while (w.status === "playing" && steps < limit) {
    const inputs = w.heroes.map((_, i) => botInput(w, i, dt));
    stepWorld(w, dt, inputs);
    steps++;
  }
  const summary = summarize(w);
  return { ...summary, lost: w.status === "lost", steps, timedOut: w.status === "playing" };
}

/** 首领的名字与配色(渲染与文案共用) */
export function bossInfoOf(boss: BossState) {
  return BOSSES[boss.kind % BOSSES.length];
}
