/**
 * 弹弹小鸟 —— 世界步进(1.2 第 12 步 A 档:从 index.ts 抽出来的纯逻辑层)。
 *
 * 为什么要抽:1.1 的物理全写在 mount() 里,只有浏览器跑得到,
 * 单测只能测几个小工具函数,关卡「到底能不能通」谁也证明不了。
 * 现在世界步进是不依赖 DOM 的纯模块:
 * - index.ts 负责渲染 / 输入 / HUD,物理调这里;
 * - sim.ts 的弹道解算器调这里 → 单测里跑的就是线上同一套物理;
 * - **固定步长**:advance() 用 1/180 秒的定长子步,60fps 与 30fps 同一发弹道落点完全一致。
 *
 * 手感数值全部沿用 1.1(重力 460、出弓上限 560、弹性系数等),1.2 只新增
 * 材质连锁传伤、倾倒加成、技能触发窗口与形变反馈。
 */
import { BIRD_INFO, canTriggerSkill } from "./birds";
import {
  BALLOON_ROPE,
  type BirdKind,
  type BlockKind,
  type LevelDef,
  type PlatformDef,
  type PortalDef,
  type SlopeDef,
  type WindDef
} from "./levels";
import { MAT, breakSound, chainDamage, landingDamage, shatterShards, toppleBoost } from "./materials";
import {
  GRAVITY,
  GROUND_Y,
  WORLD_H,
  WORLD_W,
  boomerangVelocity,
  circleRectHit,
  circleSlopeHit,
  clamp,
  impactDamage,
  portalHop,
  shellBreak
} from "./physics";

export type WorldSound = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

/** 固定步长:1/180 秒。60fps 一帧走 3 步、30fps 一帧走 6 步,结果一模一样 */
export const FIXED_STEP = 1 / 180;
/** 一次 advance 最多补的步数,后台切回来不会一口气算几千步 */
export const MAX_CATCHUP_STEPS = 24;
/** TNT 爆炸半径 */
export const EXPLODE_R = 88;

/** 渲染 / 音效钩子。纯逻辑层自己不碰 DOM,也不调 Math.random */
export interface WorldFx {
  burst?: (x: number, y: number, colors: string[], count: number, speed: number, square: boolean) => void;
  sound?: (name: WorldSound, gap: number) => void;
  shake?: (amount: number) => void;
  /** 目标数量变化(HUD 刷新用) */
  changed?: () => void;
}

export interface RtBird {
  kind: BirdKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  power: number;
  gfactor: number;
  flying: boolean;
  dead: boolean;
  skillUsed: boolean;
  pierce: boolean;
  restT: number;
  age: number;
  portalCd: number;
}

export interface RtBlock {
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  supported: boolean;
  /** 形变反馈:刚挨过打的块会抖一下再倒,0..1,随时间衰减 */
  stress: number;
}

export interface RtBean {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  dead: boolean;
  held: RtBalloon | null;
}

export interface RtBalloon {
  x: number;
  y: number;
  baseY: number;
  r: number;
  phase: number;
  popped: boolean;
  bean: RtBean;
}

export interface RtBoulder {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
}

export interface RtPlatform {
  def: PlatformDef;
  x: number;
  y: number;
  dxm: number;
  dym: number;
}

/** createWorld 认的关卡形状(闯关关卡与无尽打靶塔通用) */
export interface WorldSource {
  blocks: LevelDef["blocks"];
  beans: LevelDef["beans"];
  slopes?: SlopeDef[];
  boulders?: LevelDef["boulders"];
  platforms?: PlatformDef[];
  balloons?: LevelDef["balloons"];
  winds?: WindDef[];
  portals?: PortalDef[];
}

export interface World {
  blocks: RtBlock[];
  beans: RtBean[];
  balloons: RtBalloon[];
  boulders: RtBoulder[];
  platforms: RtPlatform[];
  slopes: SlopeDef[];
  winds: WindDef[];
  portals: PortalDef[];
  /** 已经飞出去的小鸟(含分裂出来的小云) */
  birds: RtBird[];
  pendingBooms: Array<{ x: number; y: number }>;
  /** 世界时间(只在固定子步里累加,与真实帧率无关) */
  simT: number;
  /** advance 收到的总时长与已经走过的步数,用来把任意 dt 对齐到固定步长 */
  clock: number;
  steps: number;
  destroyed: number;
  totalDestructible: number;
  quality: number;
  fx: WorldFx;
}

export function makeBird(kind: BirdKind): RtBird {
  const info = BIRD_INFO[kind];
  return {
    kind,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: info.r,
    power: info.power,
    gfactor: info.gfactor,
    flying: false,
    dead: false,
    skillUsed: false,
    pierce: false,
    restT: 0,
    age: 0,
    portalCd: 0
  };
}

export function createWorld(def: WorldSource, fx: WorldFx = {}, quality = 1): World {
  const beans: RtBean[] = def.beans.map((b) => ({
    x: b.x,
    y: b.y,
    r: 10,
    vx: 0,
    vy: 0,
    dead: false,
    held: null
  }));
  const balloons: RtBalloon[] = (def.balloons ?? []).map((b, i) => {
    const bean: RtBean = { x: b.x, y: b.y + BALLOON_ROPE, r: 10, vx: 0, vy: 0, dead: false, held: null };
    const bal: RtBalloon = { x: b.x, y: b.y, baseY: b.y, r: 13, phase: i * 1.7, popped: false, bean };
    bean.held = bal;
    beans.push(bean);
    return bal;
  });
  const blocks: RtBlock[] = def.blocks.map((b) => ({
    kind: b.kind,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    vx: 0,
    vy: 0,
    hp: MAT[b.kind].hp,
    maxHp: MAT[b.kind].hp,
    dead: false,
    supported: false,
    stress: 0
  }));
  return {
    blocks,
    beans,
    balloons,
    boulders: (def.boulders ?? []).map((b) => ({ x: b.x, y: b.y, r: b.r, vx: 0, vy: 0, rot: 0 })),
    platforms: (def.platforms ?? []).map((p) => ({ def: p, x: p.x, y: p.y, dxm: 0, dym: 0 })),
    slopes: def.slopes ?? [],
    winds: def.winds ?? [],
    portals: def.portals ?? [],
    birds: [],
    pendingBooms: [],
    simT: 0,
    clock: 0,
    steps: 0,
    destroyed: 0,
    totalDestructible: blocks.length + balloons.length,
    quality,
    fx
  };
}

/** 深拷贝一份世界:弹道解算器要在同一个局面上试很多发,不能互相污染 */
export function cloneWorld(w: World): World {
  const beanMap = new Map<RtBean, RtBean>();
  const beans = w.beans.map((b) => {
    const copy: RtBean = { ...b, held: null };
    beanMap.set(b, copy);
    return copy;
  });
  const balloons = w.balloons.map((bal) => {
    const bean = beanMap.get(bal.bean);
    const copy: RtBalloon = { ...bal, bean: bean ?? { ...bal.bean, held: null } };
    if (bean && bal.bean.held === bal) bean.held = copy;
    return copy;
  });
  return {
    ...w,
    blocks: w.blocks.map((b) => ({ ...b })),
    beans,
    balloons,
    boulders: w.boulders.map((b) => ({ ...b })),
    platforms: w.platforms.map((p) => ({ ...p })),
    slopes: w.slopes,
    winds: w.winds,
    portals: w.portals,
    birds: w.birds.map((b) => ({ ...b })),
    pendingBooms: w.pendingBooms.map((b) => ({ ...b }))
  };
}

export function beansAlive(w: World): number {
  let n = 0;
  for (const b of w.beans) if (!b.dead) n++;
  return n;
}

/** 把弹弓上那只小鸟发射出去 */
export function launchBird(w: World, bird: RtBird, vx: number, vy: number): void {
  bird.vx = vx;
  bird.vy = vy;
  bird.flying = true;
  bird.age = 0;
  w.birds.push(bird);
}

function sound(w: World, name: WorldSound, gap = 0.07): void {
  w.fx.sound?.(name, gap);
}

function burst(w: World, x: number, y: number, colors: string[], count: number, speed: number, square: boolean): void {
  w.fx.burst?.(x, y, colors, Math.max(1, Math.round(count * clamp(w.quality, 0.2, 2))), speed, square);
}

export function popBean(w: World, bean: RtBean): void {
  if (bean.dead) return;
  bean.dead = true;
  burst(w, bean.x, bean.y, ["#A5D96C", "#7FBF4D", "#D3F0A8", "#FFFFFF"], 14, 150, false);
  sound(w, "coin", 0.03);
  w.fx.changed?.();
}

export function popBalloon(w: World, bal: RtBalloon): void {
  if (bal.popped) return;
  bal.popped = true;
  w.destroyed++;
  if (!bal.bean.dead && bal.bean.held === bal) bal.bean.held = null;
  burst(w, bal.x, bal.y, ["#FFC1D8", "#FFE3A9", "#C9E8FF"], 12, 130, false);
  sound(w, "pop", 0.03);
}

export function destroyBlock(w: World, block: RtBlock): void {
  if (block.dead) return;
  // 1.1 岩壳块两段连锁:外壳碎掉不算拆除,露出更脆的晶核,再打一次才倒
  const inner = shellBreak(block.kind);
  if (inner) {
    const shellMat = MAT[block.kind];
    burst(
      w,
      block.x + block.w / 2,
      block.y + block.h / 2,
      [shellMat.fill, shellMat.edge, "#FFFFFF"],
      shatterShards(block.kind, w.quality),
      150,
      true
    );
    block.kind = inner;
    block.hp = MAT[inner].hp;
    block.maxHp = MAT[inner].hp;
    block.stress = 1;
    sound(w, breakSound("shell"), 0.05);
    return;
  }
  block.dead = true;
  w.destroyed++;
  const m = MAT[block.kind];
  burst(
    w,
    block.x + block.w / 2,
    block.y + block.h / 2,
    [m.fill, m.edge, "#FFFFFF"],
    shatterShards(block.kind, w.quality),
    140,
    true
  );
  if (block.kind === "tnt") {
    w.pendingBooms.push({ x: block.x + block.w / 2, y: block.y + block.h / 2 });
  } else {
    sound(w, breakSound(block.kind), 0.05);
  }
}

/** 给方块记一次伤:掉血、记形变,血空了就碎 */
function hurtBlock(w: World, block: RtBlock, damage: number): void {
  if (damage <= 0 || block.dead) return;
  block.hp -= damage;
  block.stress = clamp(block.stress + damage / Math.max(1, block.maxHp), 0, 1);
  if (block.hp <= 0) destroyBlock(w, block);
}

export function explode(w: World, cx: number, cy: number): void {
  w.fx.shake?.(0.5);
  burst(w, cx, cy, ["#FFB864", "#FF8FA0", "#FFE9A8", "#FFFFFF"], 26, 260, false);
  sound(w, "pop", 0);
  sound(w, "oops", 0.02);
  for (const bl of w.blocks) {
    if (bl.dead) continue;
    const bx = bl.x + bl.w / 2;
    const by = bl.y + bl.h / 2;
    const d = Math.hypot(bx - cx, by - cy);
    if (d > EXPLODE_R + Math.max(bl.w, bl.h) / 2) continue;
    const fall = 1 - clamp(d / (EXPLODE_R + 20), 0, 1);
    const dn = Math.max(d, 8);
    bl.vx += ((bx - cx) / dn) * 340 * fall;
    bl.vy += ((by - cy) / dn) * 300 * fall - 90 * fall;
    hurtBlock(w, bl, 110 * fall * (0.6 + MAT[bl.kind].vuln * 0.4));
  }
  for (const bean of w.beans) {
    if (!bean.dead && Math.hypot(bean.x - cx, bean.y - cy) < EXPLODE_R + bean.r) popBean(w, bean);
  }
  for (const bal of w.balloons) {
    if (!bal.popped && Math.hypot(bal.x - cx, bal.y - cy) < EXPLODE_R + bal.r) popBalloon(w, bal);
  }
  for (const bo of w.boulders) {
    const d = Math.hypot(bo.x - cx, bo.y - cy);
    if (d < EXPLODE_R + bo.r) {
      const dn = Math.max(d, 8);
      bo.vx += ((bo.x - cx) / dn) * 240;
      bo.vy += ((bo.y - cy) / dn) * 200 - 60;
    }
  }
  for (const bird of w.birds) {
    if (bird.dead) continue;
    const d = Math.hypot(bird.x - cx, bird.y - cy);
    if (d < EXPLODE_R + bird.r) {
      const dn = Math.max(d, 8);
      bird.vx += ((bird.x - cx) / dn) * 180;
      bird.vy += ((bird.y - cy) / dn) * 160 - 40;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 技能                                                                */
/* ------------------------------------------------------------------ */

/** 现在场上有没有一只在触发窗口内、可以放技能的小鸟 */
export function skillReadyBird(w: World): RtBird | null {
  return w.birds.find((b) => canTriggerSkill(b)) ?? null;
}

/** 空中点按:给窗口内的小鸟放技能。返回放技能的那只(没有就 null) */
export function triggerSkill(w: World): RtBird | null {
  const bird = skillReadyBird(w);
  if (!bird) return null;
  bird.skillUsed = true;
  if (bird.kind === "split") {
    bird.r = 7;
    bird.power = 0.6;
    const sp = Math.hypot(bird.vx, bird.vy);
    const a = Math.atan2(bird.vy, bird.vx);
    for (const off of [-0.3, 0.3]) {
      const clone = makeBird("split");
      clone.flying = true;
      clone.skillUsed = true;
      clone.r = 7;
      clone.power = 0.6;
      clone.x = bird.x;
      clone.y = bird.y + (off < 0 ? -6 : 6);
      clone.vx = Math.cos(a + off) * sp;
      clone.vy = Math.sin(a + off) * sp;
      clone.age = bird.age;
      w.birds.push(clone);
    }
    burst(w, bird.x, bird.y, ["#D9CCF7", "#FFFFFF", "#B9A8ED"], 12, 120, false);
  } else if (bird.kind === "slam") {
    bird.vx *= 0.2;
    bird.vy = Math.max(bird.vy, 0) + 520;
    bird.power *= 1.75;
    burst(w, bird.x, bird.y, ["#B5DDF9", "#FFFFFF"], 10, 110, false);
  } else if (bird.kind === "drill") {
    const sp = Math.max(Math.hypot(bird.vx, bird.vy), 60);
    const scale = Math.min(900, sp * 1.75) / sp;
    bird.vx *= scale;
    bird.vy *= scale;
    bird.pierce = true;
    bird.power *= 1.45;
    burst(w, bird.x, bird.y, ["#FFE0B0", "#FFC978", "#FFFFFF"], 10, 110, false);
  } else if (bird.kind === "boomerang") {
    const v = boomerangVelocity(bird.vx, bird.vy);
    bird.vx = v.vx;
    bird.vy = v.vy;
    bird.power *= 1.3;
    burst(w, bird.x, bird.y, ["#C3E8CF", "#8FD1A8", "#FFFFFF"], 12, 120, false);
  }
  sound(w, "tap", 0);
  return bird;
}

/* ------------------------------------------------------------------ */
/* 物理子步                                                            */
/* ------------------------------------------------------------------ */

function stepPlatforms(w: World): void {
  for (const p of w.platforms) {
    const t = (w.simT * Math.PI * 2) / p.def.period;
    const nx = p.def.x + p.def.dx * Math.sin(t);
    const ny = p.def.y + p.def.dy * Math.sin(t);
    p.dxm = nx - p.x;
    p.dym = ny - p.y;
    p.x = nx;
    p.y = ny;
  }
}

function stepBlocks(w: World, h: number): void {
  const blocks = w.blocks;
  for (const bl of blocks) {
    if (bl.dead) continue;
    bl.stress = Math.max(0, bl.stress - h * 1.4);
    bl.vy += GRAVITY * h;
    bl.x += bl.vx * h;
    bl.y += bl.vy * h;
    bl.supported = false;

    // 地面(摩擦按时间衰减,与子步频率无关)
    if (bl.y + bl.h > GROUND_Y) {
      const impact = bl.vy;
      bl.y = GROUND_Y - bl.h;
      bl.vy = 0;
      bl.vx *= Math.exp(-MAT[bl.kind].friction * h);
      bl.supported = true;
      hurtBlock(w, bl, landingDamage(impact, MAT[bl.kind].vuln));
      if (bl.dead) continue;
    }
    // 斜坡(近似:块底中心贴着坡面)
    for (const s of w.slopes) {
      const cx = bl.x + bl.w / 2;
      if (cx < s.x || cx > s.x + s.w) continue;
      const sy = s.dir === "up-right" ? s.y + s.h - ((cx - s.x) / s.w) * s.h : s.y + ((cx - s.x) / s.w) * s.h;
      if (bl.y + bl.h > sy && bl.y + bl.h < sy + 26) {
        bl.y = sy - bl.h;
        bl.vy = 0;
        bl.vx += (s.dir === "up-right" ? -1 : 1) * 60 * h;
        bl.supported = true;
      }
    }
    // 移动平台:站上去就跟着走
    for (const p of w.platforms) {
      if (bl.vy >= -1 && bl.x + bl.w > p.x + 4 && bl.x < p.x + p.def.w - 4) {
        const bottom = bl.y + bl.h;
        if (bottom > p.y - 2 && bottom < p.y + p.def.h + 8) {
          bl.y = p.y - bl.h;
          bl.vy = 0;
          bl.x += p.dxm;
          bl.supported = true;
        }
      }
    }
  }

  // 方块互相堆叠(两轮迭代,轴向最小分离)。1.2:相对速度超过门槛就按材质传伤,
  // 抽掉承重柱之后上面整片塌下来,砸到谁谁掉血 —— 这就是连锁倒塌。
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < blocks.length; i++) {
      const a = blocks[i];
      if (a.dead) continue;
      for (let j = i + 1; j < blocks.length; j++) {
        const b = blocks[j];
        if (b.dead) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox <= 0 || oy <= 0) continue;
        const relV = Math.hypot(a.vx - b.vx, a.vy - b.vy);
        if (relV > 0) {
          hurtBlock(w, a, chainDamage(relV, MAT[a.kind].vuln));
          hurtBlock(w, b, chainDamage(relV, MAT[b.kind].vuln));
          if (a.dead || b.dead) continue;
        }
        if (oy <= ox) {
          const top = a.y < b.y ? a : b;
          const bot = top === a ? b : a;
          if (bot.supported || bot.vy === 0) {
            top.y -= oy;
            top.vy = 0;
            top.supported = true;
            top.vx = top.vx * 0.6 + bot.vx * 0.4;
          } else {
            top.y -= oy / 2;
            bot.y += oy / 2;
            const avg = (top.vy + bot.vy) / 2;
            top.vy = avg;
            bot.vy = avg;
          }
        } else {
          const push = ox / 2;
          if (a.x < b.x) {
            a.x -= push;
            b.x += push;
          } else {
            a.x += push;
            b.x -= push;
          }
          const avg = (a.vx + b.vx) / 2;
          a.vx = avg;
          b.vx = avg;
        }
      }
    }
  }
}

function stepBoulders(w: World, h: number): void {
  for (const bo of w.boulders) {
    bo.vy += GRAVITY * h;
    bo.x += bo.vx * h;
    bo.y += bo.vy * h;
    bo.rot += (bo.vx / bo.r) * h;

    if (bo.y + bo.r > GROUND_Y) {
      bo.y = GROUND_Y - bo.r;
      bo.vy = bo.vy > 90 ? -bo.vy * 0.2 : 0;
      bo.vx *= Math.exp(-0.5 * h);
    }
    if (bo.x < bo.r + 4) {
      bo.x = bo.r + 4;
      bo.vx = Math.abs(bo.vx) * 0.4;
    }
    if (bo.x > WORLD_W - bo.r - 4) {
      bo.x = WORLD_W - bo.r - 4;
      bo.vx = -Math.abs(bo.vx) * 0.4;
    }
    for (const s of w.slopes) {
      const hit = circleSlopeHit(bo.x, bo.y, bo.r, s);
      if (hit) {
        bo.x += hit.nx * hit.depth;
        bo.y += hit.ny * hit.depth;
        const vn = bo.vx * hit.nx + bo.vy * hit.ny;
        if (vn < 0) {
          bo.vx -= hit.nx * vn;
          bo.vy -= hit.ny * vn;
        }
      }
    }
    for (const bl of w.blocks) {
      if (bl.dead) continue;
      const hit = circleRectHit(bo.x, bo.y, bo.r, bl.x, bl.y, bl.w, bl.h);
      if (!hit) continue;
      const relVx = bo.vx - bl.vx;
      const relVy = bo.vy - bl.vy;
      const rel = relVx * hit.nx + relVy * hit.ny;
      bo.x += hit.nx * hit.depth;
      bo.y += hit.ny * hit.depth;
      if (rel < 0) {
        const speed = -rel;
        if (speed > 110) {
          bl.vx -= hit.nx * speed * 0.6;
          bl.vy -= hit.ny * speed * 0.4;
          hurtBlock(w, bl, impactDamage(speed, 1.5, MAT[bl.kind].vuln));
          sound(w, "tap", 0.1);
        }
        bo.vx -= hit.nx * rel * 1.25;
        bo.vy -= hit.ny * rel * 1.25;
        bo.vx *= 0.9;
        bo.vy *= 0.9;
      }
    }
    for (const bean of w.beans) {
      if (bean.dead || bean.held) continue;
      if (Math.hypot(bean.x - bo.x, bean.y - bo.y) < bean.r + bo.r) {
        const rel = Math.hypot(bo.vx - bean.vx, bo.vy - bean.vy);
        if (rel > 55) popBean(w, bean);
      }
    }
  }
}

function stepBalloons(w: World): void {
  for (const bal of w.balloons) {
    if (bal.popped) continue;
    bal.y = bal.baseY + Math.sin(w.simT * 2 + bal.phase) * 3;
    if (!bal.bean.dead && bal.bean.held === bal) {
      bal.bean.x = bal.x + Math.sin(w.simT * 1.6 + bal.phase) * 2;
      bal.bean.y = bal.y + BALLOON_ROPE;
    }
    for (const bird of w.birds) {
      if (!bird.dead && bird.flying && Math.hypot(bird.x - bal.x, bird.y - bal.y) < bird.r + bal.r) {
        popBalloon(w, bal);
        break;
      }
    }
    if (bal.popped) continue;
    for (const bl of w.blocks) {
      if (bl.dead) continue;
      if (Math.hypot(bl.vx, bl.vy) > 90 && circleRectHit(bal.x, bal.y, bal.r, bl.x, bl.y, bl.w, bl.h)) {
        popBalloon(w, bal);
        break;
      }
    }
  }
}

function stepBeans(w: World, h: number): void {
  for (const bean of w.beans) {
    if (bean.dead || bean.held) continue;
    bean.vy += GRAVITY * h;
    bean.x += bean.vx * h;
    bean.y += bean.vy * h;

    if (bean.x < -20 || bean.x > WORLD_W + 20 || bean.y > WORLD_H + 30) {
      popBean(w, bean);
      continue;
    }
    if (bean.y + bean.r > GROUND_Y) {
      if (bean.vy > 300) {
        popBean(w, bean);
        continue;
      }
      bean.y = GROUND_Y - bean.r;
      bean.vy = bean.vy > 70 ? -bean.vy * 0.25 : 0;
      bean.vx *= Math.exp(-4 * h);
    }
    for (const s of w.slopes) {
      const hit = circleSlopeHit(bean.x, bean.y, bean.r, s);
      if (hit) {
        bean.x += hit.nx * hit.depth;
        bean.y += hit.ny * hit.depth;
        const vn = bean.vx * hit.nx + bean.vy * hit.ny;
        if (vn < 0) {
          bean.vx -= hit.nx * vn;
          bean.vy -= hit.ny * vn;
        }
      }
    }
    for (const p of w.platforms) {
      const hit = circleRectHit(bean.x, bean.y, bean.r, p.x, p.y, p.def.w, p.def.h);
      if (hit && hit.ny < -0.5 && bean.vy >= 0) {
        bean.y = p.y - bean.r;
        bean.vy = 0;
        bean.x += p.dxm;
        if (p.dym > 0) bean.y += p.dym;
      }
    }
    for (const bl of w.blocks) {
      if (bl.dead) continue;
      const hit = circleRectHit(bean.x, bean.y, bean.r, bl.x, bl.y, bl.w, bl.h);
      if (!hit) continue;
      const rel = Math.hypot(bean.vx - bl.vx, bean.vy - bl.vy);
      if (rel > 95 || hit.depth > 7) {
        popBean(w, bean);
        break;
      }
      bean.x += hit.nx * hit.depth;
      bean.y += hit.ny * hit.depth;
      const vn = (bean.vx - bl.vx) * hit.nx + (bean.vy - bl.vy) * hit.ny;
      if (vn < 0) {
        bean.vx -= hit.nx * vn;
        bean.vy -= hit.ny * vn;
      }
    }
  }
}

function stepBirds(w: World, h: number): void {
  for (const bird of w.birds) {
    if (bird.dead || !bird.flying) continue;
    bird.age += h;

    for (const wd of w.winds) {
      if (bird.x > wd.x && bird.x < wd.x + wd.w && bird.y > wd.y && bird.y < wd.y + wd.h) {
        bird.vx += wd.fx * h;
        bird.vy += wd.fy * h;
      }
    }
    bird.vy += GRAVITY * bird.gfactor * h;
    bird.x += bird.vx * h;
    bird.y += bird.vy * h;

    // 1.1 传送门:钻进任意一口就从另一口飞出,速度不变;出门后有短冷却
    if (bird.portalCd > 0) {
      bird.portalCd -= h;
    } else {
      for (const p of w.portals) {
        const hop = portalHop(bird.x, bird.y, bird.vx, bird.vy, p);
        if (hop) {
          burst(w, bird.x, bird.y, ["#B8A6F2", "#7FD8E8", "#FFFFFF"], 10, 110, false);
          bird.x = hop.x;
          bird.y = hop.y;
          bird.portalCd = 0.3;
          burst(w, bird.x, bird.y, ["#B8A6F2", "#7FD8E8", "#FFFFFF"], 10, 110, false);
          sound(w, "jump", 0.15);
          break;
        }
      }
    }

    if (bird.pierce && Math.hypot(bird.vx, bird.vy) < 150) bird.pierce = false;

    // 地面
    let onGround = false;
    if (bird.y + bird.r > GROUND_Y) {
      bird.y = GROUND_Y - bird.r;
      if (bird.vy > 70) {
        bird.vy = -bird.vy * 0.36;
        bird.vx *= 0.82;
        sound(w, "tap", 0.12);
        burst(w, bird.x, GROUND_Y, ["#FFFFFF", "#EFE6D8"], 4, 60, false);
      } else {
        bird.vy = 0;
        // 落地后继续往前滚,慢慢停下
        bird.vx *= Math.exp(-1.9 * h);
      }
      onGround = true;
    }
    if (bird.x < bird.r && bird.vx < 0) {
      bird.x = bird.r;
      bird.vx = Math.abs(bird.vx) * 0.4;
    }
    // 斜坡
    for (const s of w.slopes) {
      const hit = circleSlopeHit(bird.x, bird.y, bird.r, s);
      if (hit) {
        bird.x += hit.nx * hit.depth;
        bird.y += hit.ny * hit.depth;
        const vn = bird.vx * hit.nx + bird.vy * hit.ny;
        if (vn < 0) {
          bird.vx -= hit.nx * vn * 1.3;
          bird.vy -= hit.ny * vn * 1.3;
          bird.vx *= 0.94;
          bird.vy *= 0.94;
        }
        onGround = true;
      }
    }
    // 移动平台
    for (const p of w.platforms) {
      const hit = circleRectHit(bird.x, bird.y, bird.r, p.x, p.y, p.def.w, p.def.h);
      if (hit) {
        bird.x += hit.nx * hit.depth;
        bird.y += hit.ny * hit.depth;
        const vn = bird.vx * hit.nx + bird.vy * hit.ny;
        if (vn < 0) {
          bird.vx -= hit.nx * vn * 1.4;
          bird.vy -= hit.ny * vn * 1.4;
          sound(w, "tap", 0.12);
        }
      }
    }
    // 方块
    for (const bl of w.blocks) {
      if (bl.dead) continue;
      const hit = circleRectHit(bird.x, bird.y, bird.r, bl.x, bl.y, bl.w, bl.h);
      if (!hit) continue;
      const relVx = bird.vx - bl.vx;
      const relVy = bird.vy - bl.vy;
      const rel = relVx * hit.nx + relVy * hit.ny;
      bird.x += hit.nx * hit.depth;
      bird.y += hit.ny * hit.depth;
      if (rel < 0) {
        const speed = -rel;
        const m = MAT[bl.kind];
        // 1.2:侧面撞细高柱子多给一点推力,柱子会被撞倒而不是原地掉血
        const sideways = Math.abs(hit.nx) > Math.abs(hit.ny) ? toppleBoost(bl.w, bl.h) : 1;
        bl.vx -= hit.nx * speed * m.push * sideways;
        bl.vy -= hit.ny * speed * m.push * 0.7;
        hurtBlock(w, bl, impactDamage(speed, bird.power, m.vuln));
        const died = bl.dead;
        if (died) {
          // 打碎方块:损失一点速度,继续往前冲(钻头模式几乎不减速)
          const keep = bird.pierce ? 0.9 : 0.72;
          bird.vx *= keep;
          bird.vy *= keep;
        } else {
          bird.vx -= hit.nx * rel * 1.34;
          bird.vy -= hit.ny * rel * 1.34;
          bird.vx *= 0.94;
          bird.vy *= 0.94;
        }
        if (speed > 60) sound(w, bl.kind === "glass" || bl.kind === "ice" ? "pop" : "tap", 0.08);
      }
    }
    // 滚石
    for (const bo of w.boulders) {
      const d = Math.hypot(bird.x - bo.x, bird.y - bo.y);
      if (d < bird.r + bo.r && d > 0.01) {
        const nx = (bird.x - bo.x) / d;
        const ny = (bird.y - bo.y) / d;
        const depth = bird.r + bo.r - d;
        bird.x += nx * depth;
        bird.y += ny * depth;
        const rel = (bird.vx - bo.vx) * nx + (bird.vy - bo.vy) * ny;
        if (rel < 0) {
          bo.vx += nx * rel * 0.7;
          bo.vy += ny * rel * 0.4;
          bird.vx -= nx * rel * 1.2;
          bird.vy -= ny * rel * 1.2;
          sound(w, "tap", 0.1);
        }
      }
    }
    // 绿绿豆
    for (const bean of w.beans) {
      if (bean.dead) continue;
      if (Math.hypot(bird.x - bean.x, bird.y - bean.y) < bird.r + bean.r) {
        if (Math.hypot(bird.vx, bird.vy) > 26) popBean(w, bean);
      }
    }

    // 停下 / 出界 → 这只小鸟退场
    const sp = Math.hypot(bird.vx, bird.vy);
    if (onGround && sp < 26) bird.restT += h;
    else bird.restT = 0;
    if (bird.restT > 0.85 || bird.age > 12 || bird.x > WORLD_W + 40 || bird.y > WORLD_H + 60) {
      bird.dead = true;
      if (bird.x < WORLD_W + 20 && bird.y < WORLD_H + 20) {
        burst(w, bird.x, bird.y, ["#FFFFFF", BIRD_INFO[bird.kind].color], 8, 90, false);
      }
    }
  }
}

/** 走一个固定子步(h 必须是定长,外面用 advance 驱动) */
export function stepWorld(w: World, h: number): void {
  w.simT += h;
  stepPlatforms(w);
  stepBlocks(w, h);
  stepBoulders(w, h);
  stepBalloons(w);
  stepBeans(w, h);
  stepBirds(w, h);
  let guard = 0;
  while (w.pendingBooms.length > 0 && guard++ < 24) {
    const boom = w.pendingBooms.shift();
    if (boom) explode(w, boom.x, boom.y);
  }
}

/**
 * 按真实帧间隔推进世界:把 dt 累到时钟上,再补足 1/180 秒的固定子步。
 * 同样的总时长,60fps 与 30fps 走过的子步数完全一样 → 弹道落点一致。
 */
export function advance(w: World, dt: number): void {
  if (!(dt > 0)) return;
  w.clock += dt;
  const target = Math.floor(w.clock / FIXED_STEP + 1e-9);
  let n = 0;
  while (w.steps < target && n < MAX_CATCHUP_STEPS) {
    stepWorld(w, FIXED_STEP);
    w.steps++;
    n++;
  }
  // 掉帧太狠时直接对齐,不把欠账一直背下去
  if (w.steps < target) w.steps = target;
}

/** 场上是不是都静下来了(判负前要等这个) */
export function worldCalm(w: World): boolean {
  for (const bl of w.blocks) {
    if (!bl.dead && Math.hypot(bl.vx, bl.vy) > 26) return false;
  }
  for (const bean of w.beans) {
    if (!bean.dead && !bean.held && Math.hypot(bean.vx, bean.vy) > 26) return false;
  }
  // 滚石还在滚就可能撞倒方块/压到豆子,先别急着判负
  for (const bo of w.boulders) {
    if (Math.hypot(bo.vx, bo.vy) > 26) return false;
  }
  return true;
}

/** 所有飞出去的小鸟都退场了 */
export function allBirdsDone(w: World): boolean {
  return w.birds.every((b) => b.dead);
}
