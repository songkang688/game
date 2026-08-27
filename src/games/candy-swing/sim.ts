// 糖果秋千的「无头仿真器」：把 index.ts 里 step() 的规则原样复刻一份，
// 不碰 DOM，供测试逐帧推演每一关是否真的能通关。
// 只被 *.test.ts 引用，不进游戏包。改这里时务必和 index.ts 的 step() 对齐。

import {
  type Link,
  type Particle,
  applyAcceleration,
  applyImpulse,
  attachedToAnchor,
  boardPosition,
  buildRope,
  circleRectOverlap,
  circlesOverlap,
  collideCircleRect,
  cutLinksNear,
  deactivateConnectedLinks,
  fanForceAt,
  fanOn,
  integrate,
  magnetForceAt,
  makeParticle,
  moveToward,
  nearestAnchoredLink,
  patrolPosition,
  retuneLinks,
  setVelocity,
  snipOccurred,
  solveLinks,
  springBounce,
  springNormal,
  stickyGripStep,
  teleport,
  velocityOf,
  winchScale,
  type StickyGrip,
} from "./physics";
import { LEVELS, type LevelDef } from "./levels";
import {
  MUSHROOM_R,
  createSticky,
  mushroomBounce,
  mushroomTriggers,
  stickyCatch,
  stickyRelease,
  tickSticky,
  type StickyState,
} from "./swing12";

export const CANDY_R = 16;
export const GRAVITY = 900;
export const DT = 1 / 120;
export const MOUTH_EAT_R = 42;
export const BUBBLE_CATCH_R = 50;
export const PORTAL_R = 24;
export const PORTAL_COOLDOWN = 0.45;
export const PUFF_RANGE = 130;
export const PUFF_SPEED = 320;
export const MOTH_BITE_DIST = 12;

interface WinchState {
  def: NonNullable<NonNullable<LevelDef["ropes"]>[number]["winch"]>;
  from: number;
  to: number;
  baseRests: number[];
}

export interface SimWorld {
  lv: LevelDef;
  ps: Particle[];
  links: Link[];
  t: number;
  inBubble: boolean;
  ate: boolean;
  failed: string;
  teleports: number;
  hooked: number;
  /** 全程离怪物嘴巴最近过多少（调参与诊断用） */
  minMouthD: number;
  /** 糖果第一次下落到怪物所在高度时的横坐标（调参用，没到过是 NaN） */
  crossX: number;
  collected: Set<number>;
  boards: Array<{
    def: NonNullable<LevelDef["boards"]>[number];
    x: number;
    y: number;
    prevX: number;
    prevY: number;
  }>;
  moths: Array<{ def: NonNullable<LevelDef["moths"]>[number]; x: number; y: number; chewT: number }>;
  gremlins: Array<{ def: NonNullable<LevelDef["gremlins"]>[number]; x: number; y: number }>;
  winches: WinchState[];
  bubblesUsed: boolean[];
  /** 1.2 粘性泡泡：挂住糖果的那一段时间 */
  sticky: StickyState;
  hooksUsed: boolean[];
  puffsLeft: number[];
  /** 1.2 黏黏泡：每个泡泡一份黏住状态 */
  grips: StickyGrip[];
  /** 1.2 弹簧蘑菇：每个蘑菇被踩了几次（诊断与用例断言用） */
  springHits: number[];
  /** 全程被黏住的总秒数（用例断言用） */
  stuckT: number;
  portalCooldown: number;
  ropeLinkRanges: Array<[number, number]>;
  cutAll: () => void;
  cutRope: (i: number) => void;
  pop: () => void;
  puff: (i: number) => void;
  candy: () => Particle;
}

export function makeSim(lvIndex: number): SimWorld {
  return makeSimFor(LEVELS[lvIndex]);
}

/** 直接拿一份关卡数据建仿真世界（调参时可以喂临时关卡） */
export function makeSimFor(lv: LevelDef): SimWorld {
  const ps: Particle[] = [makeParticle(lv.candy.x, lv.candy.y, false, 0.3)];
  const links: Link[] = [];
  const ropeLinkRanges: Array<[number, number]> = [];
  const winches: WinchState[] = [];
  const addRope = (
    ax: number,
    ay: number,
    totalLength?: number,
    winch?: WinchState["def"]
  ): void => {
    const dist = totalLength ?? Math.hypot(ps[0].x - ax, ps[0].y - ay);
    const segs = Math.max(3, Math.min(14, Math.round(dist / 16)));
    const build = buildRope(ax, ay, ps[0].x, ps[0].y, segs, totalLength);
    const base = ps.length;
    const linkBase = links.length;
    for (const p of build.particles) ps.push(p);
    for (const l of build.links) {
      links.push({ a: base + l.a, b: l.b === -1 ? 0 : base + l.b, rest: l.rest, active: true });
    }
    ropeLinkRanges.push([linkBase, links.length]);
    if (winch) {
      winches.push({
        def: winch,
        from: linkBase,
        to: links.length,
        baseRests: links.slice(linkBase).map((l) => l.rest),
      });
    }
  };
  for (const r of lv.ropes) addRope(r.x, r.y, r.length, r.winch);
  const w: SimWorld = {
    lv,
    ps,
    links,
    t: 0,
    inBubble: false,
    ate: false,
    failed: "",
    teleports: 0,
    hooked: 0,
    minMouthD: Infinity,
    crossX: NaN,
    collected: new Set(),
    boards: (lv.boards ?? []).map((def) => {
      const pos = boardPosition(def.x1, def.y1, def.x2, def.y2, def.period, 0);
      return { def, x: pos.x, y: pos.y, prevX: pos.x, prevY: pos.y };
    }),
    moths: (lv.moths ?? []).map((def) => ({ def, x: def.x, y: def.y, chewT: 0 })),
    gremlins: (lv.gremlins ?? []).map((def) => {
      const pos = patrolPosition(def.x1, def.y1, def.x2, def.y2, def.period, 0, def.offset ?? 0);
      return { def, x: pos.x, y: pos.y };
    }),
    winches,
    bubblesUsed: (lv.bubbles ?? []).map(() => false),
    sticky: createSticky(),
    hooksUsed: (lv.hooks ?? []).map(() => false),
    puffsLeft: (lv.balloons ?? []).map((b) => b.puffs),
    grips: (lv.stickies ?? []).map(() => ({ left: 0, used: false })),
    springHits: (lv.springs ?? []).map(() => 0),
    stuckT: 0,
    portalCooldown: 0,
    ropeLinkRanges,
    cutAll: () => {
      for (const l of links) l.active = false;
    },
    cutRope: (i: number) => {
      const range = ropeLinkRanges[i];
      if (!range) return;
      for (let k = range[0]; k < range[1]; k++) links[k].active = false;
    },
    pop: () => {
      w.inBubble = false;
    },
    puff: (i: number) => {
      const b = (lv.balloons ?? [])[i];
      if (!b || w.puffsLeft[i] <= 0) return;
      w.puffsLeft[i]--;
      const dx = b.dir === "left" ? -1 : b.dir === "right" ? 1 : 0;
      const dy = b.dir === "up" ? -1 : b.dir === "down" ? 1 : 0;
      const c = ps[0];
      if (Math.hypot(c.x - b.x, c.y - b.y) <= PUFF_RANGE) {
        applyImpulse(c, dx * PUFF_SPEED, dy * PUFF_SPEED, DT);
      }
    },
    candy: () => ps[0],
  };
  // 内部再挂一个 addRope 供挂钩用
  (w as unknown as { addRope: typeof addRope }).addRope = addRope;
  return w;
}

/** 与 index.ts 的 step() 保持一致的一帧仿真 */
export function stepSim(w: SimWorld): void {
  const prev = w.t;
  w.t += DT;
  if (w.portalCooldown > 0) w.portalCooldown -= DT;

  for (const b of w.boards) {
    b.prevX = b.x;
    b.prevY = b.y;
    const pos = boardPosition(b.def.x1, b.def.y1, b.def.x2, b.def.y2, b.def.period, w.t);
    b.x = pos.x;
    b.y = pos.y;
  }
  for (const g of w.gremlins) {
    const pos = patrolPosition(
      g.def.x1, g.def.y1, g.def.x2, g.def.y2,
      g.def.period, w.t, g.def.offset ?? 0
    );
    g.x = pos.x;
    g.y = pos.y;
  }
  for (const wi of w.winches) {
    const scale = winchScale(wi.def.min, wi.def.max, wi.def.period, w.t, wi.def.offset ?? 0);
    retuneLinks(w.links, wi.from, wi.to, wi.baseRests, scale);
  }

  const playing = !w.ate && w.failed === "";
  if (playing) {
    for (const s of w.lv.scissors ?? []) {
      const offset = s.offset ?? s.period;
      if (snipOccurred(s.period, offset, prev, w.t)) {
        cutLinksNear(w.ps, w.links, s.x, s.y, s.radius);
      }
    }
    for (const m of w.moths) {
      if (w.t < m.def.delay) continue;
      const li = nearestAnchoredLink(w.ps, w.links, m.x, m.y);
      if (li < 0) continue;
      const link = w.links[li];
      const tx = (w.ps[link.a].x + w.ps[link.b].x) / 2;
      const ty = (w.ps[link.a].y + w.ps[link.b].y) / 2;
      const dist = Math.hypot(tx - m.x, ty - m.y);
      if (dist > MOTH_BITE_DIST) {
        const mv = moveToward(m.x, m.y, tx, ty, m.def.speed, DT);
        m.x = mv.x;
        m.y = mv.y;
        m.chewT = 0;
      } else {
        m.chewT += DT;
        if (m.chewT >= m.def.chew) {
          link.active = false;
          m.chewT = 0;
        }
      }
    }
  }

  integrate(w.ps, 0, GRAVITY, DT);
  const c = w.ps[0];
  if (w.inBubble) {
    c.y += (-260 - GRAVITY) * DT * DT;
    const upSpeed = (c.py - c.y) / DT;
    if (upSpeed > 95) c.py = c.y + 95 * DT;
  }
  if (w.sticky.held) {
    // 挂住期间原地不动，到点把攒下的速度还回去
    teleport(c, c.px, c.py);
    const before = w.sticky;
    w.sticky = tickSticky(w.sticky, DT);
    if (!w.sticky.held) {
      const out = stickyRelease(before);
      c.px = c.x - out.vx * DT;
      c.py = c.y - out.vy * DT;
    }
  }
  for (const f of w.lv.fans ?? []) {
    if (!fanOn(f.period, f.duty ?? 0.5, f.offset ?? 0, w.t)) continue;
    const force = fanForceAt(f.x, f.y, f.w, f.h, f.dir, f.power, c.x, c.y);
    applyAcceleration(c, force.fx, force.fy, DT);
  }
  for (const mg of w.lv.magnets ?? []) {
    const force = magnetForceAt(mg.x, mg.y, mg.radius, mg.strength, c.x, c.y);
    applyAcceleration(c, force.fx, force.fy, DT);
  }
  solveLinks(w.ps, w.links, 6);

  for (const b of w.boards) {
    collideCircleRect(c, CANDY_R, b.x, b.y, b.def.w, b.def.h, 0.35, b.x - b.prevX, b.y - b.prevY);
  }

  if (!playing) return;

  // 1.2 黏黏泡：黏住期间把糖果钉在泡泡中心，速度归零
  (w.lv.stickies ?? []).forEach((st, i) => {
    const r = stickyGripStep(w.grips[i], st.hold, c.x, c.y, CANDY_R, st.x, st.y, st.radius, DT);
    w.grips[i] = r.grip;
    if (r.gripped) {
      w.stuckT += DT;
      c.x = st.x;
      c.y = st.y;
      setVelocity(c, 0, 0, DT);
    }
  });

  // 1.2 弹簧蘑菇：踩到就换个方向弹走
  (w.lv.springs ?? []).forEach((sp, i) => {
    if (!circlesOverlap(c.x, c.y, CANDY_R, sp.x, sp.y, sp.radius)) return;
    const n = springNormal(sp.dir);
    const v = velocityOf(c, DT);
    const out = springBounce(v.vx, v.vy, n.nx, n.ny, sp.bounce, sp.minOut);
    // 先推出伞盖再给速度，免得下一帧又判一次
    const push = sp.radius + CANDY_R + 1;
    c.x = sp.x + n.nx * push;
    c.y = sp.y + n.ny * push;
    setVelocity(c, out.vx, out.vy, DT);
    w.springHits[i]++;
  });

  // 传送门（单向）
  if (w.portalCooldown <= 0 && !attachedToAnchor(w.ps, w.links)) {
    for (const p of w.lv.portals ?? []) {
      if (Math.hypot(c.x - p.ax, c.y - p.ay) <= PORTAL_R) {
        deactivateConnectedLinks(w.links, 0);
        teleport(c, p.bx, p.by);
        w.portalCooldown = PORTAL_COOLDOWN;
        w.teleports++;
        break;
      }
    }
  }

  // 挂钩
  (w.lv.hooks ?? []).forEach((h, i) => {
    if (w.hooksUsed[i]) return;
    if (circlesOverlap(c.x, c.y, CANDY_R, h.x, h.y, h.radius - CANDY_R)) {
      w.hooksUsed[i] = true;
      w.hooked++;
      const dist = Math.hypot(c.x - h.x, c.y - h.y);
      (w as unknown as { addRope: (x: number, y: number, len?: number) => void })
        .addRope(h.x, h.y, Math.max(dist * 0.95, 55));
    }
  });

  // 泡泡（接住时吸收大部分冲量，软着陆）；带 sticky 的是 1.2 的粘性泡泡
  (w.lv.bubbles ?? []).forEach((b, i) => {
    if (w.bubblesUsed[i]) return;
    if (circlesOverlap(c.x, c.y, CANDY_R, b.x, b.y, BUBBLE_CATCH_R - CANDY_R)) {
      w.bubblesUsed[i] = true;
      if (b.sticky && b.sticky > 0) {
        w.sticky = stickyCatch(w.sticky, (c.x - c.px) / DT, (c.y - c.py) / DT, b.sticky);
        teleport(c, b.x, b.y);
      } else {
        w.inBubble = true;
        c.px = c.x - (c.x - c.px) * 0.25;
        c.py = c.y - (c.y - c.py) * 0.25;
      }
    }
  });

  // 弹簧蘑菇：压上伞面就沿朝向弹开
  for (const m of w.lv.mushrooms ?? []) {
    if (!circlesOverlap(c.x, c.y, CANDY_R, m.x, m.y, MUSHROOM_R)) continue;
    const vx = (c.x - c.px) / DT;
    const vy = (c.y - c.py) / DT;
    if (!mushroomTriggers(vx, vy, m.dir)) continue;
    const out = mushroomBounce(vx, vy, m.dir);
    c.px = c.x - out.vx * DT;
    c.py = c.y - out.vy * DT;
  }

  // 星星
  w.lv.stars.forEach((s, i) => {
    if (circlesOverlap(c.x, c.y, 16, s.x, s.y, 14)) w.collected.add(i);
  });

  // 刺
  for (const sp of w.lv.spikes ?? []) {
    if (circleRectOverlap(c.x, c.y, CANDY_R - 2, sp.x, sp.y, sp.w, sp.h)) {
      w.failed = "spike";
      return;
    }
  }

  // 捣蛋鬼咕噜噜抢糖
  for (const g of w.gremlins) {
    if (w.t < (g.def.delay ?? 0)) continue;
    if (circlesOverlap(c.x, c.y, CANDY_R, g.x, g.y, g.def.radius)) {
      w.failed = "gremlin";
      return;
    }
  }

  // 怪物嘴巴
  const dMouth = Math.hypot(c.x - w.lv.monster.x, c.y - (w.lv.monster.y + 4));
  if (dMouth < w.minMouthD) w.minMouthD = dMouth;
  if (Number.isNaN(w.crossX) && c.y >= w.lv.monster.y + 4) w.crossX = c.x;
  if (dMouth <= MOUTH_EAT_R) {
    w.ate = true;
    return;
  }

  if (c.y > 480 + 60 || c.x < -60 || c.x > 360 + 60 || c.y < -80) {
    w.failed = "out";
    return;
  }

  // 无尽「甜甜塔」的限时（闯关模式不填 timeLimit，永远不会走到这里）
  if (w.lv.timeLimit !== undefined && w.t > w.lv.timeLimit) {
    w.failed = "time";
  }
}

export function runSim(
  w: SimWorld,
  seconds: number,
  onStep?: (w: SimWorld) => void
): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (w.ate || w.failed !== "") return;
    onStep?.(w);
    stepSim(w);
  }
}

/** 在 [0, tMax] 中搜索一个"剪断所有绳"的时机使得过关 */
export function searchCutTime(lvIndex: number, tMax: number, step = 0.1): number | null {
  return searchCutTimeFor(LEVELS[lvIndex], tMax, step);
}

export function searchCutTimeFor(lv: LevelDef, tMax: number, step = 0.1): number | null {
  for (let tc = 0; tc <= tMax + 1e-9; tc += step) {
    const w = makeSimFor(lv);
    let cutDone = false;
    runSim(w, tc + 8, (world) => {
      if (!cutDone && world.t >= tc) {
        cutDone = true;
        world.cutAll();
      }
    });
    if (w.ate) return tc;
  }
  return null;
}

/* ---------------- 1.2：三星解搜索 ---------------- */

export interface StarSearchResult {
  /** 搜到过至少一条通关路线 */
  win: boolean;
  /** 所有通关路线里收到最多的星数 */
  bestStars: number;
  /** 一共试了多少条路线（找到满星就提前收工） */
  tries: number;
}

/** 固定种子的伪随机，保证「三星解存在」这个结论每次跑都一样 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 随机化搜索一条「既能通关、又能把星星收满」的操作路线。
 * 一条路线 = 每根绳各自的剪断时刻 + 可选的戳泡泡 / 点气球时刻。
 * 先拿关卡自带的配方打底（那条一定能通关），再撒随机路线找收得更多的。
 * 找到满星立刻收工，所以简单关几乎不花时间。
 */
export function searchStarSolution(
  lv: LevelDef,
  opts: { tMax?: number; tries?: number; seed?: number } = {}
): StarSearchResult {
  const tMax = opts.tMax ?? 3;
  const tries = opts.tries ?? 220;
  const rand = rng(opts.seed ?? 0x5eed);
  const want = lv.stars.length;

  // 打底：关卡自带配方
  const baseline = playRecipeFor(lv);
  let win = baseline.ate;
  let bestStars = baseline.ate ? baseline.collected.size : 0;
  if (win && bestStars >= want) return { win, bestStars, tries: 1 };

  const nRopes = lv.ropes.length;
  const nBalloons = (lv.balloons ?? []).length;
  const hasBubble = (lv.bubbles ?? []).length > 0;

  let n = 1;
  for (; n <= tries; n++) {
    const acts: Array<{ at: number; run: (w: SimWorld) => void }> = [];
    // 每根绳一个剪断时刻；三分之一的路线让所有绳同时断（最常见的玩法）
    const together = rand() < 0.34 ? +(rand() * tMax).toFixed(2) : NaN;
    for (let r = 0; r < nRopes; r++) {
      const at = Number.isNaN(together) ? +(rand() * tMax).toFixed(2) : together;
      acts.push({ at, run: (w) => w.cutRope(r) });
    }
    if (hasBubble && rand() < 0.7) {
      acts.push({ at: +(rand() * (tMax + 3)).toFixed(2), run: (w) => w.pop() });
    }
    for (let b = 0; b < nBalloons; b++) {
      if (rand() < 0.7) {
        acts.push({ at: +(rand() * (tMax + 3)).toFixed(2), run: (w) => w.puff(b) });
      }
    }
    acts.sort((a, b) => a.at - b.at);

    const w = makeSimFor(lv);
    let k = 0;
    runSim(w, tMax + 9, (world) => {
      while (k < acts.length && world.t >= acts[k].at) acts[k++].run(world);
    });
    if (!w.ate) continue;
    win = true;
    if (w.collected.size > bestStars) bestStars = w.collected.size;
    if (bestStars >= want) break;
  }
  return { win, bestStars, tries: n };
}

const DEFAULT_TIME: Record<string, number> = {
  wait: 12,
  cut: 8,
  low: 8,
  lowPop: 12,
  hookRelay: 12,
  ropeRelay: 16,
  cutPuff: 10,
  relaySettle: 16,
  timeline: 14,
};

/** 按关卡自带的 solve 配方逐帧仿真，返回终局世界 */
export function playRecipe(index: number): SimWorld {
  return playRecipeFor(LEVELS[index]);
}

/** 配方在仿真里真正落下的一次操作（冒烟脚本据此把事件驱动的配方翻成定时动作表） */
export interface RecipeAct {
  at: number;
  do: "cut" | "cutRope" | "pop" | "puff";
  i?: number;
}

export function playRecipeFor(lv: LevelDef, onAct?: (act: RecipeAct) => void): SimWorld {
  const s = lv.solve;
  const w = makeSimFor(lv);
  if (onAct) {
    const raw = { cutAll: w.cutAll, cutRope: w.cutRope, pop: w.pop, puff: w.puff };
    const stamp = (): number => +w.t.toFixed(3);
    w.cutAll = () => {
      onAct({ at: stamp(), do: "cut" });
      raw.cutAll();
    };
    w.cutRope = (i) => {
      onAct({ at: stamp(), do: "cutRope", i });
      raw.cutRope(i);
    };
    w.pop = () => {
      onAct({ at: stamp(), do: "pop" });
      raw.pop();
    };
    w.puff = (i) => {
      onAct({ at: stamp(), do: "puff", i });
      raw.puff(i);
    };
  }
  const time = ("time" in s ? s.time : undefined) ?? DEFAULT_TIME[s.kind] ?? 12;
  let cut1 = false;
  let cut2 = false;
  let preCut = false;
  let puffed = false;
  let popped = false;
  let hookedAt = -1;
  let actIndex = 0;
  runSim(w, time, (world) => {
    const c = world.candy();
    const vx = c.x - c.px;
    const vy = c.y - c.py;
    switch (s.kind) {
      case "wait":
        break;
      case "cut":
        if (!cut1 && world.t >= (s.t ?? 0.5)) {
          cut1 = true;
          world.cutAll();
        }
        break;
      case "low":
        if (!cut1 && s.dir * (c.x - lv.ropes[0].x) >= 0 && s.dir * vx > 0) {
          cut1 = true;
          world.cutAll();
        }
        break;
      case "lowPop":
        if (!cut1 && s.dir * (c.x - lv.ropes[0].x) >= 0 && s.dir * vx > 0) {
          cut1 = true;
          world.cutAll();
        }
        if (cut1 && !popped && world.inBubble && s.dir * (c.x - s.popX) >= 0) {
          popped = true;
          world.pop();
        }
        break;
      case "hookRelay": {
        const d2 = s.dir2 ?? s.dir;
        if (!cut1 && s.dir * (c.x - lv.ropes[0].x) >= 0 && s.dir * vx > 0) {
          cut1 = true;
          world.cutAll();
        }
        const hook = lv.hooks![0];
        if (world.hooked > 0 && !cut2 && d2 * (c.x - hook.x) >= 40 && Math.abs(vx) < 0.3) {
          cut2 = true;
          world.cutAll();
        }
        break;
      }
      case "ropeRelay": {
        const d2 = s.dir2 ?? s.dir;
        if (!preCut && world.t >= 0.3) {
          preCut = true;
          world.cutRope(s.rope);
        }
        const other = lv.ropes[1 - s.rope];
        if (preCut && !cut1 && s.dir * (c.x - other.x) >= 0 && s.dir * vx > 0) {
          cut1 = true;
          world.cutAll();
        }
        const hook = lv.hooks![0];
        if (world.hooked > 0 && !cut2 && d2 * (c.x - hook.x) >= 40 && Math.abs(vx) < 0.3) {
          cut2 = true;
          world.cutAll();
        }
        break;
      }
      case "cutPuff":
        if (!cut1 && world.t >= (s.t ?? 0.3)) {
          cut1 = true;
          world.cutAll();
        }
        if (cut1 && !puffed) {
          const ready = s.afterTeleport
            ? w.teleports > 0
            : world.t >= (s.puffAt ?? (s.t ?? 0.3) + 0.06);
          if (ready) {
            puffed = true;
            world.puff(0);
          }
        }
        break;
      case "relaySettle":
        if (!cut1 && world.t >= (s.t ?? 0.5)) {
          cut1 = true;
          world.cutAll();
        }
        if (world.hooked > 0 && hookedAt < 0) hookedAt = world.t;
        if (
          world.hooked > 0 && !cut2 && world.t > hookedAt + (s.settle ?? 1.5) &&
          Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5
        ) {
          cut2 = true;
          world.cutAll();
        }
        break;
      case "timeline":
        while (actIndex < s.acts.length && world.t >= s.acts[actIndex].at) {
          const act = s.acts[actIndex];
          actIndex++;
          if (act.do === "cut") world.cutAll();
          else if (act.do === "cutRope") world.cutRope(act.i ?? 0);
          else if (act.do === "pop") world.pop();
          else if (act.do === "puff") world.puff(act.i ?? 0);
        }
        break;
      default:
        break;
    }
  });
  return w;
}
