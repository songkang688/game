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
  CHAPTER_SIZES,
  LEVELS,
  chapterOf,
  chapterStart,
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

describe("candy-swing 关卡与章节数据（99 关 · 6 主题）", () => {
  it("正好 99 关、6 个主题章节，大小与下标换算一致", () => {
    expect(LEVELS.length).toBe(99);
    expect(CHAPTERS.length).toBe(6);
    expect(CHAPTER_SIZES.length).toBe(6);
    expect(CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    for (const n of CHAPTER_SIZES) expect(n).toBeGreaterThanOrEqual(16);
    for (let c = 0; c < 6; c++) {
      expect(chapterOf(chapterStart(c))).toBe(c);
      expect(chapterOf(chapterStart(c) + CHAPTER_SIZES[c] - 1)).toBe(c);
    }
    expect(chapterOf(0)).toBe(0);
    expect(chapterOf(98)).toBe(5);
  });

  it("六个章节主题各不相同", () => {
    const themes = new Set(CHAPTERS.map((c) => c.theme));
    expect(themes.size).toBe(6);
  });

  it("每关 1-3 颗星、至少 1 根绳、带通关配方", () => {
    for (const lv of LEVELS) {
      expect(lv.stars.length).toBeGreaterThanOrEqual(1);
      expect(lv.stars.length).toBeLessThanOrEqual(3);
      expect(lv.ropes.length).toBeGreaterThanOrEqual(1);
      expect(lv.solve, `${lv.name} 缺配方`).toBeTruthy();
    }
  });

  it("机关种类 ≥ 8 种且都有关卡用到，每种至少出现 8 关", () => {
    const count = new Map<string, number>();
    for (const lv of LEVELS) {
      for (const k of mechanismKinds(lv)) count.set(k, (count.get(k) ?? 0) + 1);
    }
    expect(count.size).toBeGreaterThanOrEqual(8);
    for (const kind of [
      "multiRope", "bubble", "spike", "hook", "board",
      "portal", "balloon", "scissors", "moth",
    ]) {
      expect(count.get(kind) ?? 0, `机关 ${kind} 出现次数`).toBeGreaterThanOrEqual(8);
    }
  });

  it("最终章（彩虹嘉年华）每关至少 3 种机关，压轴关至少 5 种", () => {
    for (let i = chapterStart(5); i < LEVELS.length; i++) {
      const kinds = mechanismKinds(LEVELS[i]);
      expect(kinds.length, `第 ${i + 1} 关只有 ${kinds.join(",")}`).toBeGreaterThanOrEqual(3);
    }
    expect(mechanismKinds(LEVELS[98]).length).toBeGreaterThanOrEqual(5);
  });

  it("关卡布局互不相同（忽略名字与提示）", () => {
    const sigs = new Set(
      LEVELS.map((lv) => {
        const { name: _n, tip: _t, solve: _s, ...rest } = lv;
        return JSON.stringify(rest);
      })
    );
    expect(sigs.size).toBe(LEVELS.length);
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
  ropeLinkRanges: Array<[number, number]>;
  cutAll: () => void;
  cutRope: (i: number) => void;
  pop: () => void;
  puff: (i: number) => void;
  candy: () => Particle;
}

function makeSim(lvIndex: number): SimWorld {
  const lv = LEVELS[lvIndex];
  const ps: Particle[] = [makeParticle(lv.candy.x, lv.candy.y, false, 0.3)];
  const links: Link[] = [];
  const ropeLinkRanges: Array<[number, number]> = [];
  const addRope = (ax: number, ay: number, totalLength?: number): void => {
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

/* ================ 99 关全量可解性:按每关 solve 配方逐帧仿真 ================ */

const DEFAULT_TIME: Record<string, number> = {
  wait: 12,
  cut: 8,
  low: 8,
  lowPop: 12,
  hookRelay: 12,
  ropeRelay: 16,
  cutPuff: 10,
  relaySettle: 16,
};

function playRecipe(index: number): SimWorld {
  const lv = LEVELS[index];
  const s = lv.solve;
  const w = makeSim(index);
  const time = ("time" in s ? s.time : undefined) ?? DEFAULT_TIME[s.kind] ?? 12;
  let cut1 = false;
  let cut2 = false;
  let preCut = false;
  let puffed = false;
  let popped = false;
  let hookedAt = -1;
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
      default:
        break;
    }
  });
  return w;
}

describe("candy-swing 99 关全量可解性（按配方逐帧仿真）", () => {
  LEVELS.forEach((lv, i) => {
    it(`第 ${i + 1} 关「${lv.name}」按配方可通关`, () => {
      if (lv.solve.kind === "search") {
        expect(
          searchCutTime(i, lv.solve.tMax),
          `${lv.name} 找不到能过关的剪绳时机`
        ).not.toBeNull();
      } else {
        const w = playRecipe(i);
        expect(w.failed, `${lv.name} 中途失败:${w.failed}`).toBe("");
        expect(w.ate, `${lv.name} 没吃到糖果`).toBe(true);
      }
    });
  });
});

describe("candy-swing 抽样加严验证", () => {
  it("第 1 关（直直落）收满 3 星", () => {
    const w = playRecipe(0);
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBe(3);
  });

  it("星空传送门确实发生一次传送", () => {
    const w = playRecipe(18);
    expect(w.teleports).toBe(1);
    expect(w.ate).toBe(true);
  });

  it("泡泡电梯确实坐上了泡泡", () => {
    const w = playRecipe(3);
    expect(w.inBubble).toBe(true);
    expect(w.ate).toBe(true);
  });

  it("挂钩接力确实被钩住并二次剪断", () => {
    const w = playRecipe(5);
    expect(w.hooked).toBe(1);
    expect(w.ate).toBe(true);
  });

  it("糖果蛾关:一直不动手,蛾子最终咬断支撑绳", () => {
    const idx = 34; // 第三章第 1 关「糖果蛾来了」
    expect(LEVELS[idx].moths?.length).toBeGreaterThan(0);
    const w = makeSim(idx);
    runSim(w, 30);
    // 蛾子专咬连着锚点的绳:最终糖果不再挂着(掉进嘴/掉落失败都算)
    const stillHanging =
      !w.ate && w.failed === "" && attachedToAnchor(w.ps, w.links);
    expect(stillHanging).toBe(false);
  });

  it("超级大糖厂全流程:传送+挂钩都发生", () => {
    const w = playRecipe(41); // 第三章第 8 关 B24
    expect(w.teleports).toBe(1);
    expect(w.hooked).toBe(1);
    expect(w.ate).toBe(true);
  });
});
