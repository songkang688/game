import { describe, expect, it } from "vitest";
import {
  type Link,
  type Particle,
  boardPosition,
  buildRope,
  circleRectOverlap,
  circlesOverlap,
  collideCircleRect,
  integrate,
  makeParticle,
  segmentsIntersect,
  solveLinks,
  starsForCollected,
} from "./physics";
import { LEVELS, totalStars } from "./levels";

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
    expect(build.particles).toHaveLength(5); // 锚点 + 4 个绳结
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
    // 挂着最多被拉长一点点，绝不会自由落体
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
    // 1 秒自由落体约 450px（有阻尼略少）
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
    // 从左边放开，应荡过中线(100)到右边
    expect(maxX).toBeGreaterThan(120);
  });
});

describe("candy-swing 碰撞", () => {
  it("圆与矩形重叠判定", () => {
    expect(circleRectOverlap(50, 50, 10, 55, 40, 30, 30)).toBe(true);
    expect(circleRectOverlap(10, 10, 5, 40, 40, 30, 30)).toBe(false);
    // 刚好擦到角
    expect(circleRectOverlap(36, 36, 6, 40, 40, 30, 30)).toBe(true);
  });

  it("圆与圆重叠判定", () => {
    expect(circlesOverlap(0, 0, 10, 15, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 25, 0, 10)).toBe(false);
  });

  it("糖果撞木板会被推出并反弹", () => {
    const p = makeParticle(50, 90, false, 0.3);
    p.py = 80; // 向下运动
    const hit = collideCircleRect(p, 16, 0, 100, 200, 16, 0.35);
    expect(hit).toBe(true);
    expect(p.y).toBeLessThanOrEqual(100 - 16 + 0.001);
    // 反弹后向上（新速度 y 分量为负）
    expect(p.y - p.py).toBeLessThan(0);
  });

  it("踩在木板上会被带着走", () => {
    const p = makeParticle(50, 85, false, 0.3);
    const x0 = p.x;
    collideCircleRect(p, 16, 0, 100, 200, 16, 0.35, 5, 0);
    expect(p.x).toBeGreaterThan(x0);
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
    expect(starsForCollected(27, 27)).toBe(3);
    expect(starsForCollected(22, 27)).toBe(3);
    expect(starsForCollected(14, 27)).toBe(2);
    expect(starsForCollected(5, 27)).toBe(1);
    expect(starsForCollected(0, 0)).toBe(1);
  });
});

describe("candy-swing 关卡数据完整性", () => {
  it("至少 8 关，每关 1-3 颗星", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(8);
    for (const lv of LEVELS) {
      expect(lv.stars.length).toBeGreaterThanOrEqual(1);
      expect(lv.stars.length).toBeLessThanOrEqual(3);
      expect(lv.ropes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("元素都在画布内", () => {
    for (const lv of LEVELS) {
      const pts = [lv.candy, lv.monster, ...lv.stars, ...lv.ropes];
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

  it("特色机关齐全：双绳、气泡、刺、移动木板、挂钩都有关卡用到", () => {
    expect(LEVELS.some((lv) => lv.ropes.length >= 2)).toBe(true);
    expect(LEVELS.some((lv) => (lv.bubbles ?? []).length > 0)).toBe(true);
    expect(LEVELS.some((lv) => (lv.spikes ?? []).length > 0)).toBe(true);
    expect(LEVELS.some((lv) => (lv.boards ?? []).length > 0)).toBe(true);
    expect(LEVELS.some((lv) => (lv.hooks ?? []).length > 0)).toBe(true);
  });

  it("totalStars 统计正确", () => {
    const manual = LEVELS.reduce((s, lv) => s + lv.stars.length, 0);
    expect(totalStars()).toBe(manual);
  });
});

describe("candy-swing 关卡可玩性仿真（剪断即掉落进嘴）", () => {
  /** 用真实物理仿真第 1 关：剪断绳子后糖果应落进怪物嘴巴 */
  it("第 1 关：剪断后糖果落进嘴巴并收到 3 颗星", () => {
    const lv = LEVELS[0];
    const ps: Particle[] = [makeParticle(lv.candy.x, lv.candy.y, false, 0.3)];
    const links: Link[] = [];
    for (const r of lv.ropes) {
      const build = buildRope(r.x, r.y, lv.candy.x, lv.candy.y, 8);
      const base = ps.length;
      for (const p of build.particles) ps.push(p);
      for (const l of build.links) {
        links.push({ a: base + l.a, b: l.b === -1 ? 0 : base + l.b, rest: l.rest, active: true });
      }
    }
    // 先让绳子稳定
    for (let i = 0; i < 120; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
    }
    // 剪断全部绳段
    for (const l of links) l.active = false;
    const collected = new Set<number>();
    let ate = false;
    for (let i = 0; i < 600 && !ate; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
      lv.stars.forEach((s, si) => {
        if (circlesOverlap(ps[0].x, ps[0].y, 16, s.x, s.y, 14)) collected.add(si);
      });
      if (Math.hypot(ps[0].x - lv.monster.x, ps[0].y - (lv.monster.y + 4)) <= 42) ate = true;
    }
    expect(ate).toBe(true);
    expect(collected.size).toBe(3);
  });

  interface SimWorld {
    ps: Particle[];
    links: Link[];
    addRope: (ax: number, ay: number, totalLength?: number) => void;
  }

  /** 按游戏同样的规则搭建关卡物理世界（糖果是 ps[0]） */
  function buildWorld(lvIndex: number): SimWorld {
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
    return { ps, links, addRope };
  }

  function stepWorld(w: SimWorld, inBubble: boolean): void {
    const dt = 1 / 120;
    integrate(w.ps, 0, 900, dt);
    if (inBubble) {
      const c = w.ps[0];
      c.y += (-260 - 900) * dt * dt;
      const up = (c.py - c.y) / dt;
      if (up > 95) c.py = c.y + 95 * dt;
    }
    solveLinks(w.ps, w.links, 6);
  }

  it("第 2 关（荡一荡）：荡到低点剪断，飞进嘴巴", () => {
    const lv = LEVELS[1];
    const w = buildWorld(1);
    const c = w.ps[0];
    let cut = false;
    let ate = false;
    for (let i = 0; i < 120 * 6 && !ate; i++) {
      stepWorld(w, false);
      const vx = c.x - c.px;
      // 标准玩法：荡过最低点、向右运动时剪断
      if (!cut && c.x >= lv.ropes[0].x && vx > 0) {
        cut = true;
        for (const l of w.links) l.active = false;
      }
      if (cut && Math.hypot(c.x - lv.monster.x, c.y - (lv.monster.y + 4)) <= 42) ate = true;
    }
    expect(cut).toBe(true);
    expect(ate).toBe(true);
  });

  it("第 4 关（泡泡电梯）：剪断双绳→落进泡泡→飘上去被吃掉", () => {
    const lv = LEVELS[3];
    const w = buildWorld(3);
    const c = w.ps[0];
    const bubble = lv.bubbles![0];
    // 稳定后直接剪断双绳
    for (let i = 0; i < 60; i++) stepWorld(w, false);
    for (const l of w.links) l.active = false;
    let inBubble = false;
    let ate = false;
    for (let i = 0; i < 120 * 8 && !ate; i++) {
      stepWorld(w, inBubble);
      if (!inBubble && circlesOverlap(c.x, c.y, 16, bubble.x, bubble.y, 50 - 16)) inBubble = true;
      if (Math.hypot(c.x - lv.monster.x, c.y - (lv.monster.y + 4)) <= 42) ate = true;
    }
    expect(inBubble).toBe(true);
    expect(ate).toBe(true);
  });

  it("第 5 关（小心刺刺）：低点剪断飞向右侧缺口，不碰刺", () => {
    const lv = LEVELS[4];
    const w = buildWorld(4);
    const c = w.ps[0];
    let cut = false;
    let ate = false;
    let spiked = false;
    for (let i = 0; i < 120 * 6 && !ate && !spiked; i++) {
      stepWorld(w, false);
      const vx = c.x - c.px;
      if (!cut && c.x >= lv.ropes[0].x && vx > 0) {
        cut = true;
        for (const l of w.links) l.active = false;
      }
      if (!cut) continue;
      for (const sp of lv.spikes ?? []) {
        if (circleRectOverlap(c.x, c.y, 14, sp.x, sp.y, sp.w, sp.h)) spiked = true;
      }
      if (Math.hypot(c.x - lv.monster.x, c.y - (lv.monster.y + 4)) <= 42) ate = true;
    }
    expect(spiked).toBe(false);
    expect(ate).toBe(true);
  });

  it("第 6 关（挂钩接力）：低点剪断→挂钩接住→荡到右边再剪→进嘴", () => {
    const lv = LEVELS[5];
    const w = buildWorld(5);
    const c = w.ps[0];
    const hook = lv.hooks![0];
    let cut1 = false;
    let hooked = false;
    let cut2 = false;
    let ate = false;
    for (let i = 0; i < 120 * 10 && !ate; i++) {
      stepWorld(w, false);
      const vx = c.x - c.px;
      if (!cut1 && c.x >= lv.ropes[0].x && vx > 0) {
        cut1 = true;
        for (const l of w.links) l.active = false;
      }
      if (cut1 && !hooked && circlesOverlap(c.x, c.y, 16, hook.x, hook.y, hook.radius - 16)) {
        hooked = true;
        const dist = Math.hypot(c.x - hook.x, c.y - hook.y);
        w.addRope(hook.x, hook.y, Math.max(dist * 0.95, 55));
      }
      // 第二剪：荡到挂钩右侧尽头（几乎停住）再剪
      if (hooked && !cut2 && c.x >= hook.x + 40 && Math.abs(vx) < 0.3) {
        cut2 = true;
        for (const l of w.links) l.active = false;
      }
      if (cut2 && Math.hypot(c.x - lv.monster.x, c.y - (lv.monster.y + 4)) <= 42) ate = true;
    }
    expect(hooked).toBe(true);
    expect(cut2).toBe(true);
    expect(ate).toBe(true);
  });

  it("第 3 关（双绳）：全剪断后直落进嘴", () => {
    const lv = LEVELS[2];
    const ps: Particle[] = [makeParticle(lv.candy.x, lv.candy.y, false, 0.3)];
    const links: Link[] = [];
    for (const r of lv.ropes) {
      const build = buildRope(r.x, r.y, lv.candy.x, lv.candy.y, 9);
      const base = ps.length;
      for (const p of build.particles) ps.push(p);
      for (const l of build.links) {
        links.push({ a: base + l.a, b: l.b === -1 ? 0 : base + l.b, rest: l.rest, active: true });
      }
    }
    for (let i = 0; i < 120; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
    }
    for (const l of links) l.active = false;
    let ate = false;
    for (let i = 0; i < 600 && !ate; i++) {
      integrate(ps, 0, 900, 1 / 120);
      solveLinks(ps, links, 6);
      if (Math.hypot(ps[0].x - lv.monster.x, ps[0].y - (lv.monster.y + 4)) <= 42) ate = true;
    }
    expect(ate).toBe(true);
  });
});
