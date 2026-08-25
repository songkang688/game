import { describe, expect, it } from "vitest";
import {
  type Link,
  type Particle,
  applyImpulse,
  attachedToAnchor,
  boardPosition,
  buildRope,
  circleRectOverlap,
  circlesOverlap,
  collideCircleRect,
  cutLinksNear,
  deactivateConnectedLinks,
  integrate,
  makeParticle,
  moveToward,
  nearestActiveLink,
  nearestAnchoredLink,
  segmentsIntersect,
  snipOccurred,
  solveLinks,
  starsForCollected,
  teleport,
} from "./physics";
import {
  CHAPTERS,
  CHAPTER_SIZE,
  LEVELS,
  chapterOf,
  mechanismKinds,
  totalStars,
  type LevelDef,
} from "./levels";

describe("candy-swing 线段相交（剪绳判定）", () => {
  it("十字交叉相交", () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
  });
  it("平行不相交", () => {
    expect(segmentsIntersect(0, 0, 10, 0, 0, 5, 10, 5)).toBe(false);
  });
  it("差一点碰到不算相交", () => {
    expect(segmentsIntersect(0, 0, 4, 4, 5, 0, 10, 0)).toBe(false);
  });
  it("端点刚好落在线段上算相交", () => {
    expect(segmentsIntersect(0, 0, 10, 0, 5, 0, 5, 10)).toBe(true);
  });
});

describe("candy-swing Verlet 绳链", () => {
  function makeWorld(): { ps: Particle[]; links: Link[] } {
    const build = buildRope(100, 0, 100, 100, 5);
    const ps = [makeParticle(100, 100, false, 0.3), ...build.particles];
    const links: Link[] = build.links.map((l) => ({
      a: 1 + l.a,
      b: l.b === -1 ? 0 : 1 + l.b,
      rest: l.rest,
      active: true,
    }));
    return { ps, links };
  }

  it("buildRope 均分绳长并接到糖果(-1)", () => {
    const build = buildRope(0, 0, 0, 100, 5);
    expect(build.particles).toHaveLength(5);
    expect(build.particles[0].pinned).toBe(true);
    expect(build.links).toHaveLength(5);
    expect(build.links[build.links.length - 1].b).toBe(-1);
    for (const l of build.links) expect(l.rest).toBeCloseTo(20);
  });

  it("挂着的糖果在重力下基本不掉（绳子拉住）", () => {
    const { ps, links } = makeWorld();
    for (let i = 0; i < 600; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
    }
    const candy = ps[0];
    expect(candy.y).toBeLessThan(140);
    expect(candy.y).toBeGreaterThan(80);
  });

  it("剪断所有绳段后糖果自由下落", () => {
    const { ps, links } = makeWorld();
    for (const l of links) l.active = false;
    const y0 = ps[0].y;
    for (let i = 0; i < 120; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
    }
    expect(ps[0].y - y0).toBeGreaterThan(300);
  });

  it("钉住的锚点不动", () => {
    const { ps, links } = makeWorld();
    for (let i = 0; i < 200; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
    }
    expect(ps[1].x).toBe(100);
    expect(ps[1].y).toBe(0);
  });

  it("摆动的糖果会往回荡（钟摆行为）", () => {
    const build = buildRope(100, 0, 20, 60, 6, 100);
    const ps = [makeParticle(20, 60, false, 0.3), ...build.particles];
    const links: Link[] = build.links.map((l) => ({
      a: 1 + l.a,
      b: l.b === -1 ? 0 : 1 + l.b,
      rest: l.rest,
      active: true,
    }));
    let maxX = 20;
    for (let i = 0; i < 400; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
      maxX = Math.max(maxX, ps[0].x);
    }
    expect(maxX).toBeGreaterThan(120);
  });
});

describe("candy-swing 碰撞", () => {
  it("圆与矩形重叠判定", () => {
    expect(circleRectOverlap(50, 50, 10, 55, 40, 30, 30)).toBe(true);
    expect(circleRectOverlap(10, 10, 5, 40, 40, 30, 30)).toBe(false);
    expect(circleRectOverlap(36, 36, 6, 40, 40, 30, 30)).toBe(true);
  });

  it("圆与圆重叠判定", () => {
    expect(circlesOverlap(0, 0, 10, 15, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 25, 0, 10)).toBe(false);
  });

  it("糖果撞木板会被推出并反弹", () => {
    const p = makeParticle(50, 90, false, 0.3);
    p.py = 80;
    const hit = collideCircleRect(p, 16, 0, 100, 200, 16, 0.35);
    expect(hit).toBe(true);
    expect(p.y).toBeLessThanOrEqual(100 - 16 + 0.001);
    expect(p.y - p.py).toBeLessThan(0);
  });

  it("踩在木板上会被带着走", () => {
    const p = makeParticle(50, 85, false, 0.3);
    const x0 = p.x;
    collideCircleRect(p, 16, 0, 100, 200, 16, 0.35, 5, 0);
    expect(p.x).toBeGreaterThan(x0);
  });
});

describe("candy-swing 新机关纯逻辑", () => {
  it("applyImpulse 增加速度", () => {
    const p = makeParticle(100, 100);
    applyImpulse(p, 240, 0, 1 / 120);
    // 一步积分后速度应是 240 px/s 附近（有阻尼）
    integrate([p], 0, 0, 1 / 120);
    const vx = (p.x - p.px) * 120;
    expect(vx).toBeGreaterThan(200);
  });

  it("teleport 保留速度", () => {
    const p = makeParticle(50, 50);
    p.px = 47;
    p.py = 52; // 速度 (3, -2) px/step
    teleport(p, 200, 300);
    expect(p.x).toBe(200);
    expect(p.y).toBe(300);
    expect(p.x - p.px).toBeCloseTo(3);
    expect(p.y - p.py).toBeCloseTo(-2);
  });

  it("attachedToAnchor：连着锚点算挂着，剪断后拖尾不算", () => {
    const build = buildRope(0, 0, 0, 80, 4);
    const ps = [makeParticle(0, 80, false, 0.3), ...build.particles];
    const links: Link[] = build.links.map((l) => ({
      a: 1 + l.a,
      b: l.b === -1 ? 0 : 1 + l.b,
      rest: l.rest,
      active: true,
    }));
    expect(attachedToAnchor(ps, links)).toBe(true);
    // 剪断最靠近锚点的一段：糖果只剩拖尾
    links[0].active = false;
    expect(attachedToAnchor(ps, links)).toBe(false);
  });

  it("deactivateConnectedLinks 收走拖尾", () => {
    const build = buildRope(0, 0, 0, 80, 4);
    const ps = [makeParticle(0, 80, false, 0.3), ...build.particles];
    const links: Link[] = build.links.map((l) => ({
      a: 1 + l.a,
      b: l.b === -1 ? 0 : 1 + l.b,
      rest: l.rest,
      active: true,
    }));
    links[0].active = false;
    const n = deactivateConnectedLinks(links, 0);
    expect(n).toBeGreaterThan(0);
    expect(links.every((l) => !l.active)).toBe(true);
    expect(ps.length).toBeGreaterThan(0);
  });

  it("cutLinksNear 只剪半径内的绳段", () => {
    const build = buildRope(0, 0, 0, 120, 6);
    const ps = [makeParticle(0, 120, false, 0.3), ...build.particles];
    const links: Link[] = build.links.map((l) => ({
      a: 1 + l.a,
      b: l.b === -1 ? 0 : 1 + l.b,
      rest: l.rest,
      active: true,
    }));
    const cut = cutLinksNear(ps, links, 0, 10, 15);
    expect(cut).toBeGreaterThan(0);
    // 靠近糖果一端的绳段不受影响
    const last = links[links.length - 1];
    expect(last.active).toBe(true);
  });

  it("snipOccurred 按周期触发", () => {
    expect(snipOccurred(2, 2, 1.9, 2.05)).toBe(true);
    expect(snipOccurred(2, 2, 2.1, 3.9)).toBe(false);
    expect(snipOccurred(2, 2, 3.9, 4.05)).toBe(true);
    expect(snipOccurred(2, 0.5, 0.4, 0.6)).toBe(true);
    expect(snipOccurred(2, 2, 0, 1)).toBe(false);
  });

  it("nearestActiveLink 找最近绳段且跳过剪断的", () => {
    const build = buildRope(0, 0, 0, 100, 5);
    const ps = [makeParticle(0, 100, false, 0.3), ...build.particles];
    const links: Link[] = build.links.map((l) => ({
      a: 1 + l.a,
      b: l.b === -1 ? 0 : 1 + l.b,
      rest: l.rest,
      active: true,
    }));
    const near = nearestActiveLink(ps, links, 0, 0);
    expect(near).toBe(0);
    links[0].active = false;
    const next = nearestActiveLink(ps, links, 0, 0);
    expect(next).not.toBe(0);
    for (const l of links) l.active = false;
    expect(nearestActiveLink(ps, links, 0, 0)).toBe(-1);
  });

  it("moveToward 匀速接近并到达", () => {
    let pos = { x: 0, y: 0, arrived: false };
    for (let i = 0; i < 300 && !pos.arrived; i++) {
      pos = moveToward(pos.x, pos.y, 30, 40, 60, 1 / 60);
    }
    expect(pos.arrived).toBe(true);
    expect(pos.x).toBe(30);
    expect(pos.y).toBe(40);
  });
});

describe("candy-swing 木板运动与评级", () => {
  it("boardPosition 起点终点来回", () => {
    const a = boardPosition(0, 0, 100, 0, 2, 0);
    expect(a.x).toBeCloseTo(0);
    const b = boardPosition(0, 0, 100, 0, 2, 1);
    expect(b.x).toBeCloseTo(100);
    const c = boardPosition(0, 0, 100, 0, 2, 2);
    expect(c.x).toBeCloseTo(0);
  });

  it("starsForCollected 阈值", () => {
    expect(starsForCollected(72, 72)).toBe(3);
    expect(starsForCollected(58, 72)).toBe(3);
    expect(starsForCollected(36, 72)).toBe(2);
    expect(starsForCollected(10, 72)).toBe(1);
    expect(starsForCollected(0, 0)).toBe(1);
  });
});

describe("candy-swing 关卡与章节数据", () => {
  it("至少 24 关、3 个章节，每章 8 关", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(24);
    expect(CHAPTERS.length).toBe(3);
    expect(CHAPTER_SIZE * CHAPTERS.length).toBe(LEVELS.length);
    expect(chapterOf(0)).toBe(0);
    expect(chapterOf(8)).toBe(1);
    expect(chapterOf(23)).toBe(2);
  });

  it("三个章节主题各不相同", () => {
    const themes = new Set(CHAPTERS.map((c) => c.theme));
    expect(themes.size).toBe(3);
  });

  it("每关 1-3 颗星、至少 1 根绳", () => {
    for (const lv of LEVELS) {
      expect(lv.stars.length).toBeGreaterThanOrEqual(1);
      expect(lv.stars.length).toBeLessThanOrEqual(3);
      expect(lv.ropes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("机关种类 ≥ 8 种且都有关卡用到", () => {
    const all = new Set<string>();
    for (const lv of LEVELS) for (const k of mechanismKinds(lv)) all.add(k);
    expect(all.size).toBeGreaterThanOrEqual(8);
    for (const kind of [
      "multiRope", "bubble", "spike", "hook", "board",
      "portal", "balloon", "scissors", "moth",
    ]) {
      expect(all.has(kind), `缺少机关 ${kind}`).toBe(true);
    }
  });

  it("后半程（第 13 关起）每关至少 3 种机关同时出现", () => {
    for (let i = 12; i < LEVELS.length; i++) {
      const kinds = mechanismKinds(LEVELS[i]);
      expect(kinds.length, `第 ${i + 1} 关只有 ${kinds.join(",")}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("元素都在画布内", () => {
    for (const lv of LEVELS) {
      const pts: Array<{ x: number; y: number }> = [
        lv.candy, lv.monster, ...lv.stars, ...lv.ropes,
        ...(lv.hooks ?? []), ...(lv.bubbles ?? []),
        ...(lv.balloons ?? []), ...(lv.scissors ?? []),
        ...(lv.moths ?? []),
      ];
      for (const p of lv.portals ?? []) {
        pts.push({ x: p.ax, y: p.ay }, { x: p.bx, y: p.by });
      }
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(360);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(480);
      }
    }
  });

  it("糖果开局不会直接碰到怪物嘴巴或刺", () => {
    for (const lv of LEVELS) {
      const d = Math.hypot(lv.candy.x - lv.monster.x, lv.candy.y - lv.monster.y);
      expect(d).toBeGreaterThan(50);
      for (const sp of lv.spikes ?? []) {
        expect(circleRectOverlap(lv.candy.x, lv.candy.y, 18, sp.x, sp.y, sp.w, sp.h)).toBe(false);
      }
    }
  });

  it("关卡名字互不相同", () => {
    const names = new Set(LEVELS.map((l) => l.name));
    expect(names.size).toBe(LEVELS.length);
  });

  it("totalStars 统计正确", () => {
    const manual = LEVELS.reduce((s, lv) => s + lv.stars.length, 0);
    expect(totalStars()).toBe(manual);
  });
});

// ==================== 完整规则仿真（与游戏 step 一致） ====================

const CANDY_R = 16;
const GRAVITY = 900;
const DT = 1 / 120;
const MOUTH_EAT_R = 42;
const BUBBLE_CATCH_R = 50;
const PORTAL_R = 24;
const PORTAL_COOLDOWN = 0.45;
const PUFF_RANGE = 130;
const PUFF_SPEED = 320;
const MOTH_BITE_DIST = 12;

interface SimWorld {
  lv: LevelDef;
  ps: Particle[];
  links: Link[];
  t: number;
  inBubble: boolean;
  ate: boolean;
  failed: string;
  teleports: number;
  hooked: number;
  collected: Set<number>;
  boards: Array<{ def: NonNullable<LevelDef["boards"]>[number]; x: number; y: number; prevX: number; prevY: number }>;
  moths: Array<{ def: NonNullable<LevelDef["moths"]>[number]; x: number; y: number; chewT: number }>;
  bubblesUsed: boolean[];
  hooksUsed: boolean[];
  puffsLeft: number[];
  portalCooldown: number;
  cutAll: () => void;
  puff: (i: number) => void;
  candy: () => Particle;
}

function makeSim(lvIndex: number): SimWorld {
  const lv = LEVELS[lvIndex];
  const ps: Particle[] = [makeParticle(lv.candy.x, lv.candy.y, false, 0.3)];
  const links: Link[] = [];
  const addRope = (ax: number, ay: number, totalLength?: number): void => {
    const dist = totalLength ?? Math.hypot(ps[0].x - ax, ps[0].y - ay);
    const segs = Math.max(3, Math.min(14, Math.round(dist / 16)));
    const build = buildRope(ax, ay, ps[0].x, ps[0].y, segs, totalLength);
    const base = ps.length;
    for (const p of build.particles) ps.push(p);
    for (const l of build.links) {
      links.push({ a: base + l.a, b: l.b === -1 ? 0 : base + l.b, rest: l.rest, active: true });
    }
  };
  for (const r of lv.ropes) addRope(r.x, r.y, r.length);
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
    collected: new Set(),
    boards: (lv.boards ?? []).map((def) => {
      const pos = boardPosition(def.x1, def.y1, def.x2, def.y2, def.period, 0);
      return { def, x: pos.x, y: pos.y, prevX: pos.x, prevY: pos.y };
    }),
    moths: (lv.moths ?? []).map((def) => ({ def, x: def.x, y: def.y, chewT: 0 })),
    bubblesUsed: (lv.bubbles ?? []).map(() => false),
    hooksUsed: (lv.hooks ?? []).map(() => false),
    puffsLeft: (lv.balloons ?? []).map((b) => b.puffs),
    portalCooldown: 0,
    cutAll: () => {
      for (const l of links) l.active = false;
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
function stepSim(w: SimWorld): void {
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
  solveLinks(w.ps, w.links, 6);

  for (const b of w.boards) {
    collideCircleRect(c, CANDY_R, b.x, b.y, b.def.w, b.def.h, 0.35, b.x - b.prevX, b.y - b.prevY);
  }

  if (!playing) return;

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

  // 泡泡（接住时吸收大部分冲量，软着陆）
  (w.lv.bubbles ?? []).forEach((b, i) => {
    if (w.bubblesUsed[i]) return;
    if (circlesOverlap(c.x, c.y, CANDY_R, b.x, b.y, BUBBLE_CATCH_R - CANDY_R)) {
      w.bubblesUsed[i] = true;
      w.inBubble = true;
      c.px = c.x - (c.x - c.px) * 0.25;
      c.py = c.y - (c.y - c.py) * 0.25;
    }
  });

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

  // 怪物嘴巴
  if (Math.hypot(c.x - w.lv.monster.x, c.y - (w.lv.monster.y + 4)) <= MOUTH_EAT_R) {
    w.ate = true;
    return;
  }

  if (c.y > 480 + 60 || c.x < -60 || c.x > 360 + 60 || c.y < -80) {
    w.failed = "out";
  }
}

function runSim(
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
function searchCutTime(lvIndex: number, tMax: number, step = 0.1): number | null {
  for (let tc = 0; tc <= tMax + 1e-9; tc += step) {
    const w = makeSim(lvIndex);
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

describe("candy-swing 关卡可解性仿真", () => {
  it("第 1 关（直直落）：剪断后直落进嘴并收满 3 星", () => {
    const w = makeSim(0);
    let cut = false;
    runSim(w, 8, (world) => {
      if (!cut && world.t >= 0.5) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBe(3);
  });

  it("第 2 关（荡一荡）：低点剪断飞进嘴", () => {
    const w = makeSim(1);
    let cut = false;
    runSim(w, 8, (world) => {
      const c = world.candy();
      const vx = c.x - c.px;
      if (!cut && c.x >= world.lv.ropes[0].x && vx > 0) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.ate).toBe(true);
  });

  it("第 3 关（双绳结）：全剪断直落进嘴", () => {
    const w = makeSim(2);
    let cut = false;
    runSim(w, 8, (world) => {
      if (!cut && world.t >= 0.5) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.ate).toBe(true);
  });

  it("第 4 关（泡泡电梯）：剪断双绳→泡泡→飘上去被吃", () => {
    const w = makeSim(3);
    let cut = false;
    runSim(w, 10, (world) => {
      if (!cut && world.t >= 0.5) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.inBubble).toBe(true);
    expect(w.ate).toBe(true);
  });

  it("第 5 关（小心刺刺）：低点剪断飞向右侧缺口，不碰刺", () => {
    const w = makeSim(4);
    let cut = false;
    runSim(w, 8, (world) => {
      const c = world.candy();
      const vx = c.x - c.px;
      if (!cut && c.x >= world.lv.ropes[0].x && vx > 0) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
  });

  it("第 6 关（挂钩接力）：剪→挂钩接住→再剪→进嘴", () => {
    const w = makeSim(5);
    let cut1 = false;
    let cut2 = false;
    runSim(w, 12, (world) => {
      const c = world.candy();
      const vx = c.x - c.px;
      if (!cut1 && c.x >= world.lv.ropes[0].x && vx > 0) {
        cut1 = true;
        world.cutAll();
      }
      const hook = world.lv.hooks![0];
      if (world.hooked > 0 && !cut2 && c.x >= hook.x + 40 && Math.abs(vx) < 0.3) {
        cut2 = true;
        world.cutAll();
      }
    });
    expect(w.hooked).toBe(1);
    expect(cut2).toBe(true);
    expect(w.ate).toBe(true);
  });

  it("第 7 关（调皮木板）：存在能穿过木板空档的剪绳时机", () => {
    expect(searchCutTime(6, 3.2)).not.toBeNull();
  });

  it("第 10 关（星空传送门）：剪断→传送→落进嘴，3 星全收", () => {
    const w = makeSim(9);
    let cut = false;
    runSim(w, 8, (world) => {
      if (!cut && world.t >= 0.3) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.teleports).toBe(1);
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBe(3);
  });

  it("第 11 关（呼呼气球）：剪断后点气球吹过刺坑", () => {
    const w = makeSim(10);
    let cut = false;
    let puffed = false;
    runSim(w, 8, (world) => {
      if (!cut && world.t >= 0.1) {
        cut = true;
        world.cutAll();
      }
      if (cut && !puffed && world.t >= 0.16) {
        puffed = true;
        world.puff(0);
      }
    });
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBeGreaterThanOrEqual(2);
  });

  it("第 12 关（咔嚓剪刀）：不用动手，剪刀自动剪断后直落进嘴", () => {
    const w = makeSim(11);
    runSim(w, 8);
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBe(3);
  });

  it("第 13 关（夜泡电梯）：剪双绳→泡泡软接→升到嘴边", () => {
    const w = makeSim(12);
    let cut = false;
    runSim(w, 10, (world) => {
      if (!cut && world.t >= 0.5) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.inBubble).toBe(true);
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
  });

  it("第 14 关（穿星之旅）：传送→泡泡→上楼进嘴", () => {
    const w = makeSim(13);
    let cut = false;
    runSim(w, 12, (world) => {
      if (!cut && world.t >= 0.3) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.teleports).toBe(1);
    expect(w.inBubble).toBe(true);
    expect(w.ate).toBe(true);
  });

  it("第 15 关（星夜钩月）：赶在剪刀咔嚓前完成挂钩接力", () => {
    const w = makeSim(14);
    let cut1 = false;
    let cut2 = false;
    runSim(w, 12, (world) => {
      const c = world.candy();
      const vx = c.x - c.px;
      if (!cut1 && c.x >= world.lv.ropes[0].x && vx > 0) {
        cut1 = true;
        world.cutAll();
      }
      const hook = world.lv.hooks![0];
      if (world.hooked > 0 && !cut2 && c.x >= hook.x + 40 && Math.abs(vx) < 0.3) {
        cut2 = true;
        world.cutAll();
      }
    });
    expect(w.hooked).toBe(1);
    expect(w.ate).toBe(true);
  });

  it("第 16 关（午夜过山车）：存在避开木板的剪绳时机", () => {
    expect(searchCutTime(15, 3)).not.toBeNull();
  });

  it("第 17 关（糖果蛾来了）：赶在蛾子咬绳前剪断直落", () => {
    const w = makeSim(16);
    let cut = false;
    runSim(w, 8, (world) => {
      if (!cut && world.t >= 0.4) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
  });

  it("第 17 关：一直不动手，糖果蛾最终会咬断支撑绳让糖果掉落", () => {
    const w = makeSim(16);
    runSim(w, 30);
    // 蛾子专咬连着锚点的绳：最终糖果不再挂着（掉进嘴/掉落失败都算）
    const stillHanging =
      !w.ate && w.failed === "" && attachedToAnchor(w.ps, w.links);
    expect(stillHanging).toBe(false);
  });

  it("第 18 关（蛾口夺糖）：剪断双绳坐泡泡上楼，蛾子来不及", () => {
    const w = makeSim(17);
    let cut = false;
    runSim(w, 10, (world) => {
      if (!cut && world.t >= 0.5) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.inBubble).toBe(true);
    expect(w.ate).toBe(true);
  });

  it("第 19 关（工厂传送带）：存在穿过双层木板的剪绳时机", () => {
    expect(searchCutTime(18, 6.4)).not.toBeNull();
  });

  it("第 20 关（甜蜜配送）：快剪→传送→直落进嘴", () => {
    const w = makeSim(19);
    let cut = false;
    runSim(w, 8, (world) => {
      if (!cut && world.t >= 0.3) {
        cut = true;
        world.cutAll();
      }
    });
    expect(w.teleports).toBe(1);
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBeGreaterThanOrEqual(2);
  });

  it("第 21 关（剪刀车间）：存在合适的剪绳时机穿过木板", () => {
    expect(searchCutTime(20, 2.1)).not.toBeNull();
  });

  it("第 22 关（钩子流水线）：镜像挂钩接力，蛾子来之前完成", () => {
    const w = makeSim(21);
    let cut1 = false;
    let cut2 = false;
    runSim(w, 12, (world) => {
      const c = world.candy();
      const vx = c.x - c.px;
      if (!cut1 && c.x <= world.lv.ropes[0].x && vx < 0) {
        cut1 = true;
        world.cutAll();
      }
      const hook = world.lv.hooks![0];
      if (world.hooked > 0 && !cut2 && c.x <= hook.x - 40 && Math.abs(vx) < 0.3) {
        cut2 = true;
        world.cutAll();
      }
    });
    expect(w.hooked).toBe(1);
    expect(w.ate).toBe(true);
  });

  it("第 23 关（风暴车间）：传送后马上吹气球，糖果飞进嘴", () => {
    const w = makeSim(22);
    let cut = false;
    let puffed = false;
    runSim(w, 10, (world) => {
      if (!cut && world.t >= 0.3) {
        cut = true;
        world.cutAll();
      }
      if (!puffed && world.teleports > 0) {
        puffed = true;
        world.puff(0);
      }
    });
    expect(w.teleports).toBe(1);
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
  });

  it("第 24 关（超级大糖厂）：剪→传送→挂钩→再剪→进嘴", () => {
    const w = makeSim(23);
    let cut1 = false;
    let cut2 = false;
    let hookedAt = -1;
    runSim(w, 16, (world) => {
      const c = world.candy();
      if (!cut1 && world.t >= 0.5) {
        cut1 = true;
        world.cutAll();
      }
      if (world.hooked > 0 && hookedAt < 0) hookedAt = world.t;
      const vx = c.x - c.px;
      const vy = c.y - c.py;
      if (
        world.hooked > 0 && !cut2 && world.t > hookedAt + 1.5 &&
        Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5
      ) {
        cut2 = true;
        world.cutAll();
      }
    });
    expect(w.teleports).toBe(1);
    expect(w.hooked).toBe(1);
    expect(cut2).toBe(true);
    expect(w.ate).toBe(true);
  });
});
