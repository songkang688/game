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
  segmentsWithinDistance,
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
  failedSpeechLine,
  mechanismKinds,
  totalStars,
  wonSpeechLine,
} from "./levels";
import { makeSim, playRecipe, runSim, searchCutTime } from "./sim";

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

describe("candy-swing 割绳判定带(线段间距,≥20px 线宽)", () => {
  it("真正相交时距离为 0,任何容差都命中", () => {
    expect(segmentsWithinDistance(0, 0, 10, 10, 0, 10, 10, 0, 0)).toBe(true);
  });
  it("平行相距 8px:10px 半宽命中,5px 半宽不命中", () => {
    expect(segmentsWithinDistance(0, 0, 40, 0, 0, 8, 40, 8, 10)).toBe(true);
    expect(segmentsWithinDistance(0, 0, 40, 0, 0, 8, 40, 8, 5)).toBe(false);
  });
  it("擦着绳段端点划过(端点距 6px)也能割断", () => {
    // 手指竖着划,离绳段右端点 6px
    expect(segmentsWithinDistance(46, -20, 46, 20, 0, 0, 40, 0, 10)).toBe(true);
    expect(segmentsWithinDistance(46, -20, 46, 20, 0, 0, 40, 0, 4)).toBe(false);
  });
  it("离得远(25px)不误割", () => {
    expect(segmentsWithinDistance(0, 25, 40, 25, 0, 0, 40, 0, 10)).toBe(false);
  });
  it("零长度手指轨迹(原地点一下)按点到线段距离算", () => {
    expect(segmentsWithinDistance(20, 9, 20, 9, 0, 0, 40, 0, 10)).toBe(true);
    expect(segmentsWithinDistance(20, 30, 20, 30, 0, 0, 40, 0, 10)).toBe(false);
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

describe("candy-swing 关卡与章节数据（188 关 · 10 主题）", () => {
  it("正好 188 关、10 个主题章节，大小与下标换算一致", () => {
    expect(LEVELS.length).toBe(188);
    expect(CHAPTERS.length).toBe(10);
    expect(CHAPTER_SIZES.length).toBe(10);
    expect(CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(188);
    for (const n of CHAPTER_SIZES) expect(n).toBeGreaterThanOrEqual(16);
    for (let c = 0; c < CHAPTERS.length; c++) {
      expect(chapterOf(chapterStart(c))).toBe(c);
      expect(chapterOf(chapterStart(c) + CHAPTER_SIZES[c] - 1)).toBe(c);
    }
    expect(chapterOf(0)).toBe(0);
    expect(chapterOf(98)).toBe(5);
    expect(chapterOf(187)).toBe(9);
  });

  it("每个章节主题各不相同", () => {
    const themes = new Set(CHAPTERS.map((c) => c.theme));
    expect(themes.size).toBe(CHAPTERS.length);
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

  it("彩虹嘉年华（1.0 的最终章）每关至少 3 种机关，压轴关至少 5 种", () => {
    for (let i = chapterStart(5); i < chapterStart(6); i++) {
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

// 完整规则仿真搬到 ./sim.ts（无头复刻 index.ts 的 step()），这里直接用。

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

describe("candy-swing 结算朗读文案", () => {
  it("过关朗读报星数", () => {
    expect(wonSpeechLine(3)).toBe("过关啦！啾啾吃到糖果，得到 3 颗星！");
  });

  it("失败朗读先说原因再安抚", () => {
    expect(failedSpeechLine("糖果碰到刺啦！")).toBe("糖果碰到刺啦！没关系，点一下屏幕再来一次！");
  });
});
