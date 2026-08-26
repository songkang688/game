import { describe, expect, it } from "vitest";
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
  nearestActiveLink,
  nearestAnchoredLink,
  patrolPosition,
  retuneLinks,
  segmentsIntersect,
  segmentsWithinDistance,
  snipOccurred,
  solveLinks,
  starsForCollected,
  teleport,
  winchScale,
} from "./physics";
import {
  CHAPTERS,
  CHAPTER_SIZES,
  LEGACY_CHAPTER_SIZES,
  LEVELS,
  chapterOf,
  chapterStart,
  failedSpeechLine,
  isLedge,
  mechanismKinds,
  totalStars,
  wonSpeechLine,
} from "./levels";
import {
  makeSim,
  makeSimFor,
  playRecipe,
  playRecipeFor,
  runSim,
  searchCutTime,
} from "./sim";

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

/* ------------------------------------------------------------------ */
/* 1.1 新增用例：前 99 关冻结、四个新章、五种新机关                      */
/* ------------------------------------------------------------------ */

/** FNV-1a 32 位哈希：给前 99 关的 JSON 拍一张「指纹照」 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

describe("candy-swing 1.1 发条绳纯函数", () => {
  it("winchScale：offset 时刻最短，半周期后最长，周期首尾相接", () => {
    expect(winchScale(0.8, 1.4, 4, 0)).toBeCloseTo(0.8);
    expect(winchScale(0.8, 1.4, 4, 2)).toBeCloseTo(1.4);
    expect(winchScale(0.8, 1.4, 4, 4)).toBeCloseTo(0.8);
    expect(winchScale(0.8, 1.4, 4, 1)).toBeCloseTo(1.1);
    // 相位偏移把整条曲线平移
    expect(winchScale(0.8, 1.4, 4, 1.5, 1.5)).toBeCloseTo(0.8);
    // 没上发条（period ≤ 0）就一直是最长，等于普通绳
    expect(winchScale(0.8, 1.4, 0, 3)).toBe(1.4);
  });

  it("winchScale 始终落在 min..max 之间", () => {
    for (let t = 0; t < 6; t += 0.13) {
      const v = winchScale(0.7, 1.6, 3.1, t);
      expect(v).toBeGreaterThanOrEqual(0.7 - 1e-9);
      expect(v).toBeLessThanOrEqual(1.6 + 1e-9);
    }
  });

  it("retuneLinks 只改指定区间，越界与缺省安全", () => {
    const links: Link[] = [0, 1, 2, 3].map((i) => ({ a: i, b: i + 1, rest: 10, active: true }));
    retuneLinks(links, 1, 3, [10, 10], 1.5);
    expect(links.map((l) => l.rest)).toEqual([10, 15, 15, 10]);
    // to 超出数组长度时不越界报错
    retuneLinks(links, 2, 99, [10, 10], 2);
    expect(links[2].rest).toBe(20);
    expect(links[3].rest).toBe(20);
  });

  it("发条绳真的把糖果一收一放（绳短时吊得高，绳长时垂得低）", () => {
    const settle = (scale: number): number => {
      const build = buildRope(100, 0, 100, 120, 6);
      const ps = [makeParticle(100, 120, false, 0.3), ...build.particles];
      const links: Link[] = build.links.map((l) => ({
        a: 1 + l.a,
        b: l.b === -1 ? 0 : 1 + l.b,
        rest: l.rest,
        active: true,
      }));
      retuneLinks(links, 0, links.length, links.map((l) => l.rest), scale);
      for (let i = 0; i < 1200; i++) {
        integrate(ps, 0, 900, 1 / 120);
        solveLinks(ps, links, 6);
      }
      return ps[0].y;
    };
    const short = settle(0.7);
    const long = settle(1.3);
    expect(short).toBeLessThan(100);
    expect(long).toBeGreaterThan(140);
    expect(long - short).toBeGreaterThan(50);
  });
});

describe("candy-swing 1.1 风扇气流纯函数", () => {
  it("fanOn：不填周期就是常开，填了就按占空比一开一关", () => {
    expect(fanOn(undefined, 0.5, 0, 3)).toBe(true);
    expect(fanOn(0, 0.5, 0, 3)).toBe(true);
    expect(fanOn(2, 0.5, 0, 0.4)).toBe(true);
    expect(fanOn(2, 0.5, 0, 1.4)).toBe(false);
    expect(fanOn(2, 0.5, 0, 2.4)).toBe(true);
    // 相位偏移整体平移；duty 到头就是常开 / 常关
    expect(fanOn(2, 0.5, 1, 1.4)).toBe(true);
    expect(fanOn(2, 1, 0, 1.9)).toBe(true);
    expect(fanOn(2, 0, 0, 0.1)).toBe(false);
  });

  it("fanForceAt：风道外没有风，风道里朝 dir 推", () => {
    const box = [100, 100, 200, 120] as const;
    expect(fanForceAt(...box, "right", 800, 50, 150)).toEqual({ fx: 0, fy: 0 });
    expect(fanForceAt(...box, "right", 800, 150, 400)).toEqual({ fx: 0, fy: 0 });
    const right = fanForceAt(...box, "right", 800, 110, 150);
    expect(right.fx).toBeGreaterThan(0);
    expect(right.fy).toBe(0);
    const up = fanForceAt(...box, "up", 800, 150, 210);
    expect(up.fy).toBeLessThan(0);
    expect(up.fx).toBe(0);
    const left = fanForceAt(...box, "left", 800, 290, 150);
    expect(left.fx).toBeLessThan(0);
    const down = fanForceAt(...box, "down", 800, 150, 110);
    expect(down.fy).toBeGreaterThan(0);
  });

  it("fanForceAt：离出风口越远风越弱，最远端仍剩 55%", () => {
    const near = fanForceAt(100, 100, 200, 120, "right", 800, 100, 150);
    const far = fanForceAt(100, 100, 200, 120, "right", 800, 300, 150);
    expect(near.fx).toBeCloseTo(800);
    expect(far.fx).toBeCloseTo(800 * 0.55);
    const mid = fanForceAt(100, 100, 200, 120, "right", 800, 200, 150);
    expect(mid.fx).toBeLessThan(near.fx);
    expect(mid.fx).toBeGreaterThan(far.fx);
  });
});

describe("candy-swing 1.1 糖霜磁铁纯函数", () => {
  it("magnetForceAt：半径外没劲，半径内朝磁铁吸，越近越强", () => {
    expect(magnetForceAt(200, 200, 100, 1200, 400, 200)).toEqual({ fx: 0, fy: 0 });
    const far = magnetForceAt(200, 200, 100, 1200, 280, 200);
    const near = magnetForceAt(200, 200, 100, 1200, 240, 200);
    expect(far.fx).toBeLessThan(0);
    expect(near.fx).toBeLessThan(far.fx);
    expect(near.fy).toBeCloseTo(0);
    // 正正落在磁铁上不产生无穷大
    expect(magnetForceAt(200, 200, 100, 1200, 200, 200)).toEqual({ fx: 0, fy: 0 });
  });

  it("magnetForceAt：负 strength 是推力，方向正好相反", () => {
    const pull = magnetForceAt(200, 200, 120, 1000, 200, 260);
    const push = magnetForceAt(200, 200, 120, -1000, 200, 260);
    expect(pull.fy).toBeLessThan(0);
    expect(push.fy).toBeGreaterThan(0);
    expect(push.fy).toBeCloseTo(-pull.fy);
  });

  it("磁铁的悬停点：吸力正好抵消重力的那个距离", () => {
    const radius = 400;
    const strength = 1300;
    const hover = radius * (1 - 900 / strength);
    const at = magnetForceAt(180, 100, radius, strength, 180, 100 + hover);
    expect(-at.fy).toBeCloseTo(900, 5);
  });
});

describe("candy-swing 1.1 加速度与巡逻纯函数", () => {
  it("applyAcceleration：一步积分后速度约等于 a·dt，钉住的粒子不动", () => {
    const p = makeParticle(100, 100);
    applyAcceleration(p, 600, 0, 1 / 120);
    integrate([p], 0, 0, 1 / 120);
    expect(((p.x - p.px) * 120)).toBeGreaterThan(4);
    const pinned = makeParticle(50, 50, true);
    applyAcceleration(pinned, 900, 900, 1 / 120);
    expect(pinned.x).toBe(50);
    expect(pinned.y).toBe(50);
  });

  it("patrolPosition：两端点、中点与相位偏移", () => {
    expect(patrolPosition(0, 10, 100, 10, 4, 0)).toEqual({ x: 0, y: 10 });
    const half = patrolPosition(0, 10, 100, 10, 4, 2);
    expect(half.x).toBeCloseTo(100);
    expect(patrolPosition(0, 10, 100, 10, 4, 4).x).toBeCloseTo(0);
    expect(patrolPosition(0, 10, 100, 50, 4, 1).y).toBeCloseTo(30);
    // offset 把相位往前挪
    expect(patrolPosition(0, 10, 100, 10, 4, 0, 2).x).toBeCloseTo(100);
    // period ≤ 0 就站着不动
    expect(patrolPosition(0, 10, 100, 10, 0, 3)).toEqual({ x: 0, y: 10 });
  });

  it("patrolPosition 永远待在两点之间，不会跑出巡逻线", () => {
    for (let t = 0; t < 8; t += 0.17) {
      const p = patrolPosition(60, 300, 300, 340, 3.4, t);
      expect(p.x).toBeGreaterThanOrEqual(60 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(300 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(300 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(340 + 1e-9);
    }
  });
});

describe("candy-swing 1.1 前 99 关冻结（老玩家进度一点不受影响）", () => {
  it("前 99 关逐字节与 1.0 一致（冻结哈希）", () => {
    // 该指纹取自 1.0 的 levels.ts（origin/game-1.1 上的 candy-swing），谁都不许动前 99 关
    const json = JSON.stringify(LEVELS.slice(0, 99));
    expect(json.length).toBe(36913);
    expect(fnv1a(json)).toBe("6e226fe7");
  });

  it("前 99 关的章节切分与 1.0 完全一致", () => {
    expect(LEGACY_CHAPTER_SIZES).toEqual([17, 17, 17, 16, 16, 16]);
    expect(CHAPTER_SIZES.slice(0, 6)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(chapterStart(6)).toBe(99);
  });

  it("前 99 关一个 1.1 新机关都没有", () => {
    for (let i = 0; i < 99; i++) {
      const lv = LEVELS[i];
      const kinds = mechanismKinds(lv);
      for (const k of ["winch", "ledge", "fan", "magnet", "gremlin"]) {
        expect(kinds, `第 ${i + 1} 关不该有 ${k}`).not.toContain(k);
      }
    }
  });

  it("1.0 老存档（长度 99 的星级数组）读进来补 0 到 188，第 100 关自然解锁", () => {
    // 复刻 index.ts 的 loadProgress + levelUnlocked 规则
    const legacy = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
    const stars = LEVELS.map((_, i) => {
      const v = legacy[i];
      return typeof v === "number" ? Math.max(0, Math.min(3, Math.round(v))) : 0;
    });
    expect(stars).toHaveLength(188);
    expect(stars.slice(0, 99)).toEqual(legacy);
    expect(stars.slice(99).every((s) => s === 0)).toBe(true);
    const unlocked = (i: number): boolean => i === 0 || stars[i - 1] > 0;
    for (let i = 0; i < 99; i++) expect(unlocked(i), `第 ${i + 1} 关保持解锁`).toBe(true);
    expect(unlocked(99), "打过第 99 关就能进发条钟楼").toBe(true);
    expect(unlocked(100), "再往后还得逐关解锁").toBe(false);
  });
});

describe("candy-swing 1.1 四个新章（发条钟楼 / 泡泡浮岛 / 星糖工厂 / 月光大巡游）", () => {
  it("新四章共 89 关：23 + 22 + 22 + 22，接在第 100 关起", () => {
    expect(CHAPTER_SIZES.slice(6)).toEqual([23, 22, 22, 22]);
    expect(CHAPTER_SIZES.slice(6).reduce((a, b) => a + b, 0)).toBe(89);
    expect(chapterStart(6)).toBe(99);
    expect(chapterStart(7)).toBe(122);
    expect(chapterStart(8)).toBe(144);
    expect(chapterStart(9)).toBe(166);
    expect(chapterOf(99)).toBe(6);
    expect(chapterOf(187)).toBe(9);
  });

  it("新章的名字、主题与介绍都在", () => {
    expect(CHAPTERS.slice(6).map((c) => c.name)).toEqual([
      "发条钟楼", "泡泡浮岛", "星糖工厂", "月光大巡游",
    ]);
    expect(CHAPTERS.slice(6).map((c) => c.theme)).toEqual([
      "clock", "isle", "starfac", "moonfair",
    ]);
    for (const ch of CHAPTERS.slice(6)) expect(ch.blurb.length).toBeGreaterThan(6);
  });

  it("每章都把自己的招牌机关用上了", () => {
    const kindsOf = (c: number): Set<string> =>
      new Set(
        LEVELS.slice(chapterStart(c), chapterStart(c) + CHAPTER_SIZES[c]).flatMap(mechanismKinds)
      );
    expect(kindsOf(6).has("winch"), "发条钟楼要有发条绳").toBe(true);
    expect(kindsOf(6).has("ledge"), "发条钟楼要有高台").toBe(true);
    expect(kindsOf(7).has("fan"), "泡泡浮岛要有风扇").toBe(true);
    expect(kindsOf(8).has("magnet"), "星糖工厂要有磁铁").toBe(true);
    expect(kindsOf(8).has("gremlin"), "星糖工厂要有咕噜噜").toBe(true);
    const finale = kindsOf(9);
    for (const k of ["winch", "fan", "magnet", "gremlin"]) {
      expect(finale.has(k), `月光大巡游少了 ${k}`).toBe(true);
    }
  });

  it("五种新机关每种至少 8 关用到", () => {
    const count = new Map<string, number>();
    for (const lv of LEVELS) {
      for (const k of mechanismKinds(lv)) count.set(k, (count.get(k) ?? 0) + 1);
    }
    for (const kind of ["winch", "ledge", "fan", "magnet", "gremlin"]) {
      expect(count.get(kind) ?? 0, `新机关 ${kind} 出现次数`).toBeGreaterThanOrEqual(8);
    }
  });

  it("压轴章「月光大巡游」每关至少 3 种机关，最后一关至少 5 种", () => {
    for (let i = chapterStart(9); i < LEVELS.length; i++) {
      const kinds = mechanismKinds(LEVELS[i]);
      expect(kinds.length, `第 ${i + 1} 关只有 ${kinds.join(",")}`).toBeGreaterThanOrEqual(3);
    }
    expect(mechanismKinds(LEVELS[187]).length).toBeGreaterThanOrEqual(5);
  });

  it("isLedge：静止的木板才算高台，会跑的不算", () => {
    expect(isLedge({ x1: 100, y1: 300, x2: 100, y2: 300, w: 90, h: 14, period: 4 })).toBe(true);
    expect(isLedge({ x1: 100, y1: 300, x2: 220, y2: 300, w: 90, h: 14, period: 4 })).toBe(false);
    expect(isLedge({ x1: 100, y1: 300, x2: 100, y2: 380, w: 90, h: 14, period: 4 })).toBe(false);
  });

  it("新机关的元素都在画布内，风道也不出界", () => {
    for (const lv of LEVELS) {
      for (const f of lv.fans ?? []) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.x + f.w).toBeLessThanOrEqual(360);
        expect(f.y + f.h).toBeLessThanOrEqual(480);
        expect(f.power).toBeGreaterThan(0);
      }
      for (const mg of lv.magnets ?? []) {
        expect(mg.x).toBeGreaterThanOrEqual(0);
        expect(mg.x).toBeLessThanOrEqual(360);
        expect(mg.y).toBeGreaterThanOrEqual(0);
        expect(mg.y).toBeLessThanOrEqual(480);
        expect(mg.radius).toBeGreaterThan(0);
      }
      for (const g of lv.gremlins ?? []) {
        for (const [x, y] of [[g.x1, g.y1], [g.x2, g.y2]]) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(360);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(480);
        }
        expect(g.period).toBeGreaterThan(0);
      }
      for (const r of lv.ropes) {
        if (!r.winch) continue;
        expect(r.winch.min).toBeGreaterThan(0);
        expect(r.winch.max).toBeGreaterThan(r.winch.min);
        expect(r.winch.period).toBeGreaterThan(0);
      }
    }
  });

  it("咕噜噜开局够不到糖果，巡逻全程也不会蹭到锚点", () => {
    for (const lv of LEVELS) {
      for (const g of lv.gremlins ?? []) {
        for (let t = 0; t < g.period; t += g.period / 24) {
          const p = patrolPosition(g.x1, g.y1, g.x2, g.y2, g.period, t, g.offset ?? 0);
          if ((g.delay ?? 0) <= 0) {
            expect(
              circlesOverlap(lv.candy.x, lv.candy.y, 16, p.x, p.y, g.radius),
              `${lv.name} 开局就被咕噜噜抓住`
            ).toBe(false);
          }
        }
      }
    }
  });
});

describe("candy-swing 1.1 新机关在真实规则下确实起作用", () => {
  it("风扇真的把糖果吹出一大段横向位移", () => {
    const withFan = LEVELS.findIndex((lv, i) => i >= 99 && (lv.fans ?? []).length > 0);
    expect(withFan).toBeGreaterThan(0);
    const lv = LEVELS[withFan];
    const blown = playRecipe(withFan);
    expect(blown.ate).toBe(true);
    const noFan = playRecipeFor({ ...lv, fans: [] });
    expect(noFan.ate, "拆掉风扇就该吹不到嘴巴").toBe(false);
  });

  it("磁铁真的把糖果拽向自己（拆掉磁铁就过不了）", () => {
    const idx = LEVELS.findIndex((lv, i) => i >= 99 && (lv.magnets ?? []).length > 0);
    expect(idx).toBeGreaterThan(0);
    const lv = LEVELS[idx];
    expect(playRecipe(idx).ate).toBe(true);
    expect(playRecipeFor({ ...lv, magnets: [] }).ate, "拆掉磁铁就该过不了").toBe(false);
  });

  it("发条绳真的在动：拆掉发条后同样的时机剪就掉不进嘴里", () => {
    const idx = LEVELS.findIndex(
      (lv, i) => i >= 99 && lv.ropes.some((r) => r.winch) && lv.solve.kind === "cut"
    );
    expect(idx).toBeGreaterThan(0);
    const lv = LEVELS[idx];
    expect(playRecipe(idx).ate).toBe(true);
    const still = playRecipeFor({
      ...lv,
      ropes: lv.ropes.map(({ winch: _w, ...rest }) => rest),
      // 发条一停，绳长永远是最短那档，糖果吊在半空
      monster: { x: lv.monster.x, y: 40 },
    });
    expect(still.ate).toBe(false);
  });

  it("捣蛋鬼咕噜噜真的会抢糖：把它挪到糖果头上就直接抢走", () => {
    const idx = LEVELS.findIndex((lv, i) => i >= 99 && (lv.gremlins ?? []).length > 0);
    expect(idx).toBeGreaterThan(0);
    const lv = LEVELS[idx];
    const robbed = playRecipeFor({
      ...lv,
      gremlins: [
        { x1: lv.candy.x, y1: lv.candy.y + 60, x2: lv.candy.x, y2: lv.candy.y + 60, period: 3, radius: 30 },
      ],
      solve: { kind: "cut", t: 0.2, time: 6 },
    });
    expect(robbed.ate).toBe(false);
    expect(robbed.failed).toBe("gremlin");
  });

  it("高台真的托得住糖果：站上去就不会直接掉下去", () => {
    const idx = LEVELS.findIndex(
      (lv, i) => i >= 99 && (lv.boards ?? []).some(isLedge)
    );
    expect(idx).toBeGreaterThan(0);
    const lv = LEVELS[idx];
    const ledge = (lv.boards ?? []).find(isLedge)!;
    const w = makeSimFor({
      ...lv,
      candy: { x: ledge.x1 + ledge.w / 2, y: ledge.y1 - 60 },
      ropes: [{ x: ledge.x1 + ledge.w / 2, y: ledge.y1 - 120 }],
      gremlins: [],
      fans: [],
      magnets: [],
      spikes: [],
    });
    w.cutAll();
    runSim(w, 2.5);
    expect(w.candy().y).toBeLessThan(ledge.y1);
    expect(w.failed).toBe("");
  });
});

describe("candy-swing 1.1 第 100–188 关抽样加严", () => {
  it("第 100 关（发条落锤）三颗星全收，且发条确实在伸缩", () => {
    const w = playRecipe(99);
    expect(w.ate).toBe(true);
    expect(w.collected.size).toBe(3);
    expect(LEVELS[99].ropes[0].winch).toBeTruthy();
  });

  it("第 145 关按配方能通关，且用到了新机关", () => {
    const w = playRecipe(144);
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
    const kinds = mechanismKinds(LEVELS[144]);
    expect(
      kinds.some((k) => ["winch", "ledge", "fan", "magnet", "gremlin"].includes(k)),
      `第 145 关机关：${kinds.join(",")}`
    ).toBe(true);
  });

  it("第 188 关（毕业大巡游）是五种以上机关的大合奏，且能通关", () => {
    const kinds = mechanismKinds(LEVELS[187]);
    expect(kinds.length).toBeGreaterThanOrEqual(5);
    const w = playRecipe(187);
    expect(w.failed).toBe("");
    expect(w.ate).toBe(true);
  });

  it("第 100–188 关每关都有名字、提示和 1-3 颗星，且名字不与老关卡撞车", () => {
    const names = new Set<string>();
    for (const lv of LEVELS) {
      expect(names.has(lv.name), `关卡名重复：${lv.name}`).toBe(false);
      names.add(lv.name);
    }
    for (let i = 99; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      expect(lv.name.length, `第 ${i + 1} 关没名字`).toBeGreaterThan(1);
      expect(lv.tip.length, `第 ${i + 1} 关没提示`).toBeGreaterThan(4);
      expect(lv.stars.length).toBeGreaterThanOrEqual(1);
      expect(lv.stars.length).toBeLessThanOrEqual(3);
    }
  });

  it("失败文案只鼓励不批评，新机关的抢糖文案也一样", () => {
    for (const reason of ["糖果碰到刺啦！", "咕噜噜把糖果抢走啦！", "糖果掉出去啦！"]) {
      const line = failedSpeechLine(reason);
      expect(line.startsWith(reason)).toBe(true);
      expect(line).toContain("没关系");
      for (const bad of ["笨", "不行", "真差", "又错"]) expect(line).not.toContain(bad);
    }
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
