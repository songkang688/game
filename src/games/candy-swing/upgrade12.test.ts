// 1.2 第 12 步 · B 档 `candy-swing` 新增用例。
// 老用例在 physics.test.ts 里一条都没动（只增不减），这一份专管 1.2 新加的东西：
// 切绳手感与 tunneling、一刀两断、两个新机关、糖果残影、188 关抽样「通关解 + 三星解」、
// 存档迁移、无尽甜甜塔、meta 与红线。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type Link,
  type Particle,
  circlesOverlap,
  comboLabel,
  countRopesCut,
  fadeAlpha,
  linksCrossedBySwipe,
  makeParticle,
  setVelocity,
  springBounce,
  springNormal,
  stickyGripStep,
  swipeSubSegments,
  velocityOf,
  whipImpulse,
} from "./physics";
import {
  FROZEN_LEVEL_COUNT,
  LEVELS,
  STAR_FIX_INDICES,
  chapterOf,
  mechanismKinds,
  type LevelDef,
} from "./levels";
import {
  makeSimFor,
  runSim,
  searchCutTimeFor,
  searchStarSolution,
} from "./sim";
import {
  makeTowerLevel,
  mulberry32,
  towerTier,
  towerTimeLimit,
  towerTitle,
} from "./endless";
import {
  LEGACY_SAVE_KEYS,
  MIRROR_SAVE_KEY,
  SAVE_KEY,
  mergeStars,
  needsMigration,
  normalizeStars,
  readProgress,
  writeProgress,
  type StorageLike,
} from "./progress";
import { meta } from "./meta";

/** 搭一条水平绳段，方便手搓切绳用例 */
function ropeAt(
  ax: number, ay: number, bx: number, by: number
): { ps: Particle[]; links: Link[] } {
  const ps = [makeParticle(ax, ay, true), makeParticle(bx, by)];
  const links: Link[] = [{ a: 0, b: 1, rest: Math.hypot(bx - ax, by - ay), active: true }];
  return { ps, links };
}

/* ================= 一、切绳手感与 tunneling ================= */

describe("candy-swing 1.2 划线连续采样（补 tunneling）", () => {
  it("swipeSubSegments：首尾点保真，相邻间距不超过 maxStep", () => {
    const pts = swipeSubSegments(0, 0, 300, 400, 12);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1].x).toBeCloseTo(300);
    expect(pts[pts.length - 1].y).toBeCloseTo(400);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      expect(d).toBeLessThanOrEqual(12 + 1e-9);
    }
    // 500px 的位移按 12px 细分，至少要切出 42 段
    expect(pts.length).toBeGreaterThanOrEqual(42);
  });

  it("swipeSubSegments：手指没动也返回两个点，不会除 0", () => {
    const pts = swipeSubSegments(80, 80, 80, 80, 12);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 80, y: 80 });
    expect(pts[1]).toEqual({ x: 80, y: 80 });
  });

  it("一帧划过大半个屏幕：路径上的三根绳一根都不漏（点半径判定会漏掉两根）", () => {
    const ps: Particle[] = [];
    const links: Link[] = [];
    for (const y of [120, 240, 360]) {
      const base = ps.length;
      ps.push(makeParticle(60, y, true), makeParticle(300, y, true));
      links.push({ a: base, b: base + 1, rest: 240, active: true });
    }
    // 手指一帧从左上冲到右下（真机上快划就是这种一步到位的事件）
    const hit = linksCrossedBySwipe(ps, links, 40, 60, 320, 420, 10, 12);
    expect(hit).toEqual([0, 1, 2]);

    // 同样两点，只在落点附近做「点半径」判定的话，三根绳一根都碰不到
    const nearEnds = links.filter((_, i) => {
      const my = ps[links[i].a].y;
      return Math.abs(my - 60) <= 24 || Math.abs(my - 420) <= 24;
    });
    expect(nearEnds).toHaveLength(0);
  });

  it("弧线快划：逐点喂折线能切到绳，直接连首尾的弦切不到", () => {
    // 绳挂在弧线鼓出来的那一侧，弦（首尾直线）离它 60px 开外
    const { ps, links } = ropeAt(150, 60, 210, 60);
    const arc = [
      { x: 60, y: 200 }, { x: 90, y: 120 }, { x: 140, y: 66 },
      { x: 200, y: 62 }, { x: 260, y: 120 }, { x: 300, y: 200 },
    ];
    const chord = linksCrossedBySwipe(
      ps, links, arc[0].x, arc[0].y, arc[arc.length - 1].x, arc[arc.length - 1].y, 10, 12
    );
    expect(chord, "拉直成弦就摸不到绳子").toEqual([]);

    let hitAny = false;
    for (let i = 1; i < arc.length; i++) {
      const h = linksCrossedBySwipe(ps, links, arc[i - 1].x, arc[i - 1].y, arc[i].x, arc[i].y, 10, 12);
      if (h.length > 0) hitAny = true;
    }
    expect(hitAny, "把中间采样点都喂进去就切得到").toBe(true);
  });

  it("linksCrossedBySwipe 只查不改：绳段的 active 一个都没动", () => {
    const { ps, links } = ropeAt(100, 200, 260, 200);
    const hit = linksCrossedBySwipe(ps, links, 180, 120, 180, 280, 10, 12);
    expect(hit).toEqual([0]);
    expect(links[0].active, "查询函数不许顺手把绳剪了").toBe(true);
  });

  it("whipImpulse：沿划线方向甩，划得越快甩得越狠但有封顶", () => {
    const slow = whipImpulse(1, 0, 100);
    const fast = whipImpulse(1, 0, 600);
    const crazy = whipImpulse(1, 0, 99999);
    expect(slow.vx).toBeGreaterThan(0);
    expect(slow.vy).toBe(0);
    expect(fast.vx).toBeGreaterThan(slow.vx);
    expect(crazy.vx).toBe(240);
    // 方向只看单位向量，长度无关
    const diag = whipImpulse(3, 4, 100);
    expect(Math.hypot(diag.vx, diag.vy)).toBeCloseTo(28);
    expect(diag.vx / diag.vy).toBeCloseTo(3 / 4);
  });

  it("whipImpulse：没划动 / 零速度就不甩", () => {
    expect(whipImpulse(0, 0, 500)).toEqual({ vx: 0, vy: 0 });
    expect(whipImpulse(1, 0, 0)).toEqual({ vx: 0, vy: 0 });
    expect(whipImpulse(1, 0, -5)).toEqual({ vx: 0, vy: 0 });
  });
});

/* ================= 二、一刀两断 ================= */

describe("candy-swing 1.2 一刀两断", () => {
  it("countRopesCut：同一根绳上连切三段只算一根", () => {
    const ranges: Array<[number, number]> = [[0, 6], [6, 11]];
    expect(countRopesCut([1, 2, 3], ranges)).toBe(1);
  });

  it("countRopesCut：两根绳各切一段算两根", () => {
    const ranges: Array<[number, number]> = [[0, 6], [6, 11]];
    expect(countRopesCut([2, 8], ranges)).toBe(2);
    expect(countRopesCut([0, 5, 6, 10], ranges)).toBe(2);
  });

  it("countRopesCut：挂钩后长出来的绳段不在任何区间里，不计数也不报错", () => {
    const ranges: Array<[number, number]> = [[0, 4]];
    expect(countRopesCut([9, 10], ranges)).toBe(0);
    expect(countRopesCut([], ranges)).toBe(0);
  });

  it("comboLabel：一根不给奖励，两根起有文案，且都是鼓励口气", () => {
    expect(comboLabel(0)).toBe("");
    expect(comboLabel(1)).toBe("");
    expect(comboLabel(2)).toBe("一刀两断！");
    expect(comboLabel(3)).toBe("一刀三断！");
    expect(comboLabel(5)).toBe(comboLabel(4));
    for (const n of [2, 3, 4]) {
      for (const bad of ["笨", "差", "错", "失败"]) expect(comboLabel(n)).not.toContain(bad);
    }
  });

  it("真实几何：一刀横过两根平行绳，切中两根", () => {
    const ps: Particle[] = [];
    const links: Link[] = [];
    const ranges: Array<[number, number]> = [];
    for (const x of [140, 220]) {
      const base = ps.length;
      const from = links.length;
      ps.push(makeParticle(x, 60, true), makeParticle(x, 300));
      links.push({ a: base, b: base + 1, rest: 240, active: true });
      ranges.push([from, links.length]);
    }
    const hit = linksCrossedBySwipe(ps, links, 100, 180, 270, 180, 10, 12);
    expect(countRopesCut(hit, ranges)).toBe(2);
    expect(comboLabel(countRopesCut(hit, ranges))).toBe("一刀两断！");
  });
});

/* ================= 三、新机关①「黏黏泡」 ================= */

describe("candy-swing 1.2 新机关 · 黏黏泡", () => {
  it("糖果撞进来就被黏住 hold 秒", () => {
    const r = stickyGripStep({ left: 0, used: false }, 1.2, 200, 200, 16, 200, 200, 30, 1 / 120);
    expect(r.grabbed).toBe(true);
    expect(r.gripped).toBe(true);
    expect(r.grip.left).toBeCloseTo(1.2);
  });

  it("离得远就不黏；黏住期间倒计时，到点自动放开", () => {
    const far = stickyGripStep({ left: 0, used: false }, 1.2, 20, 20, 16, 300, 400, 30, 1 / 120);
    expect(far.gripped).toBe(false);
    expect(far.grabbed).toBe(false);

    let grip = { left: 0.05, used: false };
    let released = false;
    for (let i = 0; i < 20 && !released; i++) {
      const r = stickyGripStep(grip, 1.2, 200, 200, 16, 200, 200, 30, 1 / 60);
      grip = r.grip;
      released = r.released;
    }
    expect(released, "时间到要自己放开，不能一直扣着糖果").toBe(true);
    expect(grip.left).toBe(0);
    expect(grip.used).toBe(true);
  });

  it("一次性机关：放开之后再撞也不黏了", () => {
    const again = stickyGripStep({ left: 0, used: true }, 1.2, 200, 200, 16, 200, 200, 30, 1 / 120);
    expect(again.grabbed).toBe(false);
    expect(again.gripped).toBe(false);
    // hold ≤ 0 当作没这机关
    const dead = stickyGripStep({ left: 0, used: false }, 0, 200, 200, 16, 200, 200, 30, 1 / 120);
    expect(dead.gripped).toBe(false);
  });

  it("纯函数：不改传进去的那份状态", () => {
    const grip = { left: 0, used: false };
    stickyGripStep(grip, 1.2, 200, 200, 16, 200, 200, 30, 1 / 120);
    expect(grip).toEqual({ left: 0, used: false });
  });

  it("真实规则下：黏黏泡确实把糖果钉在原地", () => {
    const lv: LevelDef = {
      name: "黏黏泡试验", tip: "试验",
      candy: { x: 180, y: 150 },
      monster: { x: 180, y: 430 },
      ropes: [{ x: 180, y: 60 }],
      stars: [{ x: 180, y: 300 }],
      stickies: [{ x: 180, y: 240, radius: 30, hold: 1 }],
      solve: { kind: "cut", t: 0.2 },
    };
    const w = makeSimFor(lv);
    w.cutAll();
    runSim(w, 0.9);
    expect(w.stuckT, "应该被黏住过").toBeGreaterThan(0.3);
    expect(Math.abs(w.candy().x - 180)).toBeLessThan(2);
    expect(Math.abs(w.candy().y - 240)).toBeLessThan(2);
    // 放开之后还是会掉下去，不会永远挂着
    runSim(w, 4);
    expect(w.ate).toBe(true);
  });
});

/* ================= 四、新机关②「弹簧蘑菇」 ================= */

describe("candy-swing 1.2 新机关 · 弹簧蘑菇", () => {
  it("往下砸朝上的蘑菇会被弹上去", () => {
    const out = springBounce(0, 400, 0, -1, 1, 100);
    expect(out.vy).toBeLessThan(0);
    expect(out.vy).toBeCloseTo(-400);
  });

  it("保底弹力：几乎没速度蹭一下也弹得动", () => {
    const out = springBounce(0, 5, 0, -1, 1, 180);
    expect(-out.vy).toBeGreaterThanOrEqual(180);
  });

  it("换方向而不是原路返回：切向速度保留一部分", () => {
    const out = springBounce(200, 300, 0, -1, 1, 100);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.vx).toBeLessThan(200);
    expect(out.vy).toBeLessThan(0);
    // 侧墙上朝右的蘑菇：往左撞过来的糖果被推回右边
    const wall = springBounce(-260, 40, 1, 0, 1, 150);
    expect(wall.vx).toBeGreaterThan(0);
  });

  it("bounce 倍数放大法向速度；零向量的蘑菇原样返回", () => {
    const weak = springBounce(0, 300, 0, -1, 0.5, 0);
    const strong = springBounce(0, 300, 0, -1, 1.4, 0);
    expect(-strong.vy).toBeGreaterThan(-weak.vy);
    expect(springBounce(11, 22, 0, 0, 1, 100)).toEqual({ vx: 11, vy: 22 });
  });

  it("springNormal：四个朝向都是单位向量", () => {
    expect(springNormal("up")).toEqual({ nx: 0, ny: -1 });
    expect(springNormal("down")).toEqual({ nx: 0, ny: 1 });
    expect(springNormal("left")).toEqual({ nx: -1, ny: 0 });
    expect(springNormal("right")).toEqual({ nx: 1, ny: 0 });
  });

  it("真实规则下：蘑菇把掉下来的糖果弹起来并送进嘴里", () => {
    const lv: LevelDef = {
      name: "弹簧试验", tip: "试验",
      candy: { x: 90, y: 150 },
      monster: { x: 250, y: 300 },
      ropes: [{ x: 90, y: 60 }],
      stars: [{ x: 160, y: 300 }],
      springs: [{ x: 90, y: 420, radius: 22, dir: "right", bounce: 1, minOut: 320 }],
      solve: { kind: "cut", t: 0.2 },
    };
    const w = makeSimFor(lv);
    w.cutAll();
    runSim(w, 6);
    expect(w.springHits[0], "糖果该踩到蘑菇").toBeGreaterThan(0);
    expect(w.candy().x, "被朝右的蘑菇弹开之后应该在右边").toBeGreaterThan(90);
  });

  it("setVelocity / velocityOf 是一对：设进去多少读出来就是多少", () => {
    const p = makeParticle(100, 100);
    setVelocity(p, 240, -120, 1 / 120);
    const v = velocityOf(p, 1 / 120);
    expect(v.vx).toBeCloseTo(240);
    expect(v.vy).toBeCloseTo(-120);
    // 钉住的粒子不接受速度
    const pin = makeParticle(50, 50, true);
    setVelocity(pin, 300, 300, 1 / 120);
    expect(velocityOf(pin, 1 / 120)).toEqual({ vx: 0, vy: 0 });
  });
});

/* ================= 五、糖果残影 ================= */

describe("candy-swing 1.2 糖果残影 300ms 淡出", () => {
  it("fadeAlpha：刚出生是 1，半程 0.5，到寿命归 0 并夹住", () => {
    expect(fadeAlpha(0, 0.3)).toBe(1);
    expect(fadeAlpha(0.15, 0.3)).toBeCloseTo(0.5);
    expect(fadeAlpha(0.3, 0.3)).toBe(0);
    expect(fadeAlpha(9, 0.3)).toBe(0);
    expect(fadeAlpha(0.1, 0)).toBe(0);
  });
});

/* ================= 六、188 关抽样可解性（通关解 + 三星解） ================= */

/**
 * 抽样 36 关，横跨 10 个章节，含规格点名的第 100 / 145 / 188 关。
 * 三星解用 sim.ts 的 searchStarSolution 随机化搜索（固定种子，结论可复现）。
 */
const SAMPLE = [
  0, 6, 13, 20, 27, 34, 41, 48, 55, 62, 69, 76,
  83, 90, 97, 99, 104, 110, 116, 121, 127, 133, 139, 144,
  150, 155, 160, 165, 170, 174, 178, 181, 183, 185, 186, 187,
];

/**
 * 前 99 关是 1.0 的冻结数据（一个字节都不许动），
 * 这几关的星星摆位偏离所有可达轨迹，搜出来最多两颗。
 * 列成白名单是为了「不许再多」：将来谁把某关改坏了，这里会红。
 */
const FROZEN_TWO_STAR_ONLY = new Set([5, 11, 17, 23, 29, 31, 39, 47, 57, 58, 78, 79, 83, 84, 91]);

describe("candy-swing 1.2 关卡可解性抽样（36 关，含第 100 / 145 / 188 关）", () => {
  it("抽样 ≥ 30 关、覆盖全部 10 个章节，且点名的三关都在里面", () => {
    expect(SAMPLE.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SAMPLE).size).toBe(SAMPLE.length);
    for (const i of [99, 144, 187]) expect(SAMPLE).toContain(i);
    const chapters = new Set(SAMPLE.map(chapterOf));
    expect(chapters.size, `只覆盖了章节 ${[...chapters].join(",")}`).toBe(10);
  });

  it("抽样的每一关都存在通关解", () => {
    for (const i of SAMPLE) {
      const r = searchStarSolution(LEVELS[i], { tMax: 3, tries: 700 });
      expect(r.win, `第 ${i + 1} 关「${LEVELS[i].name}」搜不到通关解`).toBe(true);
    }
  }, 120000);

  it("抽样的每一关都存在三星解（前 99 关里的冻结例外单独列名）", () => {
    for (const i of SAMPLE) {
      const lv = LEVELS[i];
      const r = searchStarSolution(lv, { tMax: 3, tries: 900 });
      if (FROZEN_TWO_STAR_ONLY.has(i)) {
        expect(i, "冻结例外只能出现在前 99 关").toBeLessThan(FROZEN_LEVEL_COUNT);
        expect(r.bestStars, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(2);
        continue;
      }
      expect(
        r.bestStars,
        `第 ${i + 1} 关「${lv.name}」搜不到三星解（只到 ${r.bestStars}/${lv.stars.length}）`
      ).toBe(lv.stars.length);
    }
  }, 180000);

  it("第 100 / 145 / 188 关：通关解与三星解都在", () => {
    for (const i of [99, 144, 187]) {
      const lv = LEVELS[i];
      const r = searchStarSolution(lv, { tMax: 3, tries: 900 });
      expect(r.win, `第 ${i + 1} 关`).toBe(true);
      expect(r.bestStars, `第 ${i + 1} 关三星解`).toBe(lv.stars.length);
    }
  }, 60000);
});

describe("candy-swing 1.2 三星补位表只动 100 关之后", () => {
  it("补位表里没有一个下标落进冻结的前 99 关", () => {
    expect(STAR_FIX_INDICES.length).toBeGreaterThan(0);
    for (const i of STAR_FIX_INDICES) {
      expect(i, `补位表碰了第 ${i + 1} 关`).toBeGreaterThanOrEqual(FROZEN_LEVEL_COUNT);
      expect(i).toBeLessThan(LEVELS.length);
    }
  });

  it("补位后的星星还是 3 颗、还在画布内、彼此不重叠", () => {
    for (const i of STAR_FIX_INDICES) {
      const st = LEVELS[i].stars;
      expect(st, `第 ${i + 1} 关`).toHaveLength(3);
      for (const s of st) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(360);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(480);
      }
      for (let a = 0; a < st.length; a++) {
        for (let b = a + 1; b < st.length; b++) {
          expect(
            Math.hypot(st[a].x - st[b].x, st[a].y - st[b].y),
            `第 ${i + 1} 关两颗星叠在一起了`
          ).toBeGreaterThan(24);
        }
      }
    }
  });
});

/* ================= 七、存档迁移（两代老 key 不许丢星） ================= */

function fakeStore(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("candy-swing 1.2 存档 key 迁移", () => {
  it("主 key 用统一前缀，两代老 key 都还认得", () => {
    expect(SAVE_KEY).toBe("yiduo-yixing.candy-swing.campaign.v2");
    expect(LEGACY_SAVE_KEYS).toContain("yiduo.candy-swing.campaign.v2");
    expect(LEGACY_SAVE_KEYS).toContain("candy-swing.campaign.v2");
    expect(LEGACY_SAVE_KEYS).not.toContain(SAVE_KEY);
  });

  it("只有老档：读出来一颗星都不少", () => {
    const legacy = Array.from({ length: 120 }, (_, i) => (i % 3) + 1);
    const store = fakeStore({
      "yiduo.candy-swing.campaign.v2": JSON.stringify({ stars: legacy }),
    });
    const p = readProgress(store, LEVELS.length);
    expect(p.stars).toHaveLength(LEVELS.length);
    expect(p.stars.slice(0, 120)).toEqual(legacy);
    expect(p.stars.slice(120).every((s) => s === 0)).toBe(true);
    expect(needsMigration(store, LEVELS.length)).toBe(true);
  });

  it("新老都有：逐关取最大，两边的战绩都保住", () => {
    const store = fakeStore({
      [SAVE_KEY]: JSON.stringify({ stars: [3, 0, 1] }),
      "yiduo.candy-swing.campaign.v2": JSON.stringify({ stars: [1, 2, 0] }),
      "candy-swing.campaign.v2": JSON.stringify({ stars: [0, 0, 3] }),
    });
    const p = readProgress(store, 4);
    expect(p.stars).toEqual([3, 2, 3, 0]);
  });

  it("迁移后主 key 与上一代 key 同步写，装回旧版也看得到最新进度", () => {
    const store = fakeStore({
      [MIRROR_SAVE_KEY]: JSON.stringify({ stars: [2, 3] }),
    });
    const p = readProgress(store, 3);
    writeProgress(store, p);
    expect(JSON.parse(store.data[SAVE_KEY]).stars).toEqual([2, 3, 0]);
    expect(JSON.parse(store.data[MIRROR_SAVE_KEY]).stars).toEqual([2, 3, 0]);
    expect(MIRROR_SAVE_KEY).toBe("yiduo.candy-swing.campaign.v2");
    // 写过一次之后就不再需要迁移
    expect(needsMigration(store, 3)).toBe(false);
  });

  it("最早那一代没前缀的 key 只读不写，不会被反向污染", () => {
    const store = fakeStore({ "candy-swing.campaign.v2": JSON.stringify({ stars: [3, 3] }) });
    const p = readProgress(store, 3);
    expect(p.stars).toEqual([3, 3, 0]);
    writeProgress(store, { stars: [3, 3, 1] });
    expect(store.data["candy-swing.campaign.v2"]).toBe(JSON.stringify({ stars: [3, 3] }));
    expect(JSON.parse(store.data[SAVE_KEY]).stars).toEqual([3, 3, 1]);
  });

  it("坏档 / 空档 / 隐私模式都当新档，不抛异常", () => {
    expect(readProgress(null, 5).stars).toEqual([0, 0, 0, 0, 0]);
    expect(readProgress(fakeStore({ [SAVE_KEY]: "{{坏掉的 JSON" }), 3).stars).toEqual([0, 0, 0]);
    expect(readProgress(fakeStore({ [SAVE_KEY]: JSON.stringify({ stars: "呃" }) }), 2).stars)
      .toEqual([0, 0]);
    expect(needsMigration(null, 3)).toBe(false);
  });

  it("normalizeStars / mergeStars：越界夹紧、脏数据当 0、合并只增不减", () => {
    expect(normalizeStars([5, -2, 1.6, "x", null, undefined], 6)).toEqual([3, 0, 2, 0, 0, 0]);
    expect(normalizeStars(null, 3)).toEqual([0, 0, 0]);
    expect(mergeStars([1, 0, 3], [0, 2])).toEqual([1, 2, 3]);
    expect(mergeStars([], [1, 1])).toEqual([1, 1]);
  });
});

/* ================= 八、无尽「甜甜塔」 ================= */

describe("candy-swing 1.2 无尽甜甜塔", () => {
  it("mulberry32：同种子同序列、不同种子不同序列，输出在 [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const va = [a(), a(), a()];
    expect(va).toEqual([b(), b(), b()]);
    expect(va).not.toEqual([c(), c(), c()]);
    for (const v of va) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("限时逐层收紧，但不会紧到没法玩（封底 8 秒）", () => {
    expect(towerTimeLimit(1)).toBe(18);
    expect(towerTimeLimit(2)).toBeLessThan(towerTimeLimit(1));
    for (let w = 1; w < 60; w++) {
      expect(towerTimeLimit(w + 1)).toBeLessThanOrEqual(towerTimeLimit(w));
      expect(towerTimeLimit(w)).toBeGreaterThanOrEqual(8);
    }
    expect(towerTimeLimit(999)).toBe(8);
  });

  it("机关档位与层名随层数往上走", () => {
    expect(towerTier(1)).toBe(1);
    expect(towerTier(4)).toBe(2);
    expect(towerTier(7)).toBe(3);
    expect(towerTier(10)).toBe(4);
    expect(towerTier(14)).toBe(5);
    expect(towerTier(40)).toBe(6);
    for (let w = 1; w < 40; w++) expect(towerTier(w + 1)).toBeGreaterThanOrEqual(towerTier(w));
    expect(towerTitle(1)).toBe("糖霜层");
    expect(towerTitle(11)).not.toBe(towerTitle(1));
    expect(towerTitle(999).length).toBeGreaterThan(1);
  });

  it("同种子同层完全一样，换一层就换个样", () => {
    expect(makeTowerLevel(7, 5)).toEqual(makeTowerLevel(7, 5));
    expect(JSON.stringify(makeTowerLevel(7, 5))).not.toBe(JSON.stringify(makeTowerLevel(7, 6)));
    expect(JSON.stringify(makeTowerLevel(7, 5))).not.toBe(JSON.stringify(makeTowerLevel(8, 5)));
  });

  it("每层都在画布内、带限时、三颗星、至少一根绳", () => {
    for (const seed of [1, 2026, 90210]) {
      for (let w = 1; w <= 24; w++) {
        const lv = makeTowerLevel(seed, w);
        const pts = [
          lv.candy, lv.monster, ...lv.stars, ...lv.ropes,
          ...(lv.stickies ?? []), ...(lv.springs ?? []), ...(lv.bubbles ?? []),
        ];
        for (const p of pts) {
          expect(p.x, `${seed}/${w}`).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(360);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(480);
        }
        expect(lv.stars).toHaveLength(3);
        expect(lv.ropes.length).toBeGreaterThanOrEqual(1);
        expect(lv.timeLimit).toBe(towerTimeLimit(w));
        expect(lv.name).toContain(`第 ${w} 层`);
        expect(
          Math.hypot(lv.candy.x - lv.monster.x, lv.candy.y - lv.monster.y),
          "开局糖果不能贴着嘴巴"
        ).toBeGreaterThan(50);
      }
    }
  });

  it("机关随层数解锁：低层清清爽爽，高层黏黏泡与弹簧蘑菇都上场", () => {
    const kinds = (seed: number, w: number): string[] => mechanismKinds(makeTowerLevel(seed, w));
    expect(kinds(3, 1)).toEqual([]);
    expect(kinds(3, 7)).toContain("multiRope");
    expect(kinds(3, 11)).toContain("sticky");
    expect(kinds(3, 15)).toContain("spring");
    const top = kinds(3, 22);
    expect(top).toContain("sticky");
    expect(top).toContain("spring");
    expect(makeTowerLevel(3, 22).springs).toHaveLength(2);
  });

  it("前 24 层随便换种子都存在通关解（三颗种子 × 24 层）", () => {
    for (const seed of [1, 2026, 90210]) {
      for (let w = 1; w <= 24; w++) {
        const lv = makeTowerLevel(seed, w);
        expect(
          searchCutTimeFor(lv, 3.2, 0.05),
          `甜甜塔 种子 ${seed} 第 ${w} 层找不到通关时机`
        ).not.toBeNull();
      }
    }
  }, 120000);

  it("限时真的会判负：把限时压到 0.5 秒就来不及", () => {
    const lv = { ...makeTowerLevel(5, 1), timeLimit: 0.5 };
    const w = makeSimFor(lv);
    runSim(w, 4);
    expect(w.failed).toBe("time");
    expect(w.ate).toBe(false);
  });

  it("黏黏泡摆在啾啾正上方：被黏住的糖果放开就掉进嘴里", () => {
    for (const seed of [11, 22, 33]) {
      const lv = makeTowerLevel(seed, 13);
      const st = lv.stickies?.[0];
      expect(st, `种子 ${seed} 第 13 层该有黏黏泡`).toBeTruthy();
      expect(Math.abs(st!.x - lv.monster.x), "黏黏泡横向要对准嘴巴").toBeLessThanOrEqual(28);
      expect(st!.y, "黏黏泡要在嘴巴上方").toBeLessThan(lv.monster.y);
      expect(st!.hold).toBeGreaterThan(0);
      // 直接把糖果放进黏黏泡里，看放开之后会不会自己落进嘴
      const test: LevelDef = {
        ...lv,
        candy: { x: st!.x, y: st!.y },
        ropes: [{ x: st!.x, y: 40, length: Math.max(20, st!.y - 40) }],
        springs: [],
      };
      const w = makeSimFor(test);
      w.cutAll();
      runSim(w, 6);
      expect(w.stuckT, `种子 ${seed} 没被黏住`).toBeGreaterThan(0);
      expect(w.ate, `种子 ${seed} 黏黏泡放开后没送进嘴里`).toBe(true);
    }
  });
});

/* ================= 九、meta / 模式矩阵 / 红线 ================= */

describe("candy-swing 1.2 meta 与红线", () => {
  it("meta：闯关 + 无尽两种模式，手游端游都能玩，188 关不变", () => {
    expect(meta.id).toBe("candy-swing");
    expect(meta.levels).toBe(188);
    expect(meta.levels).toBe(LEVELS.length);
    expect([...meta.modes]).toEqual(["campaign", "endless"]);
    expect([...meta.modes]).not.toContain("versus");
    expect(meta.platform).toBe("both");
  });

  it("blurb 与事实对齐：说了 188 关、说了无尽、说了两个新机关", () => {
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).toContain("无尽");
    expect(meta.blurb).toContain("黏黏泡");
    expect(meta.blurb).toContain("弹簧蘑菇");
    expect(meta.blurb.length).toBeLessThanOrEqual(60);
  });

  it("1.2 新机关登记进 mechanismKinds，且前 99 关一个都没有", () => {
    const withSticky: LevelDef = {
      ...LEVELS[0],
      stickies: [{ x: 100, y: 100, radius: 30, hold: 1 }],
      springs: [{ x: 40, y: 300, radius: 22, dir: "right", bounce: 1, minOut: 200 }],
    };
    const kinds = mechanismKinds(withSticky);
    expect(kinds).toContain("sticky");
    expect(kinds).toContain("spring");
    for (let i = 0; i < FROZEN_LEVEL_COUNT; i++) {
      const k = mechanismKinds(LEVELS[i]);
      expect(k, `第 ${i + 1} 关`).not.toContain("sticky");
      expect(k, `第 ${i + 1} 关`).not.toContain("spring");
    }
  });

  it("文案里没有同类割绳商业作品的角色名与作品名", () => {
    const blacklist = [
      "割绳子", "青蛙", "小怪物欧姆", "Om Nom", "愤怒的小鸟", "水果忍者",
      "植物大战僵尸", "超级玛丽", "马里奥", "俄罗斯方块", "我的世界",
    ];
    const texts = [
      meta.title, meta.blurb,
      ...LEVELS.flatMap((lv) => [lv.name, lv.tip]),
      ...Array.from({ length: 20 }, (_, i) => makeTowerLevel(1, i + 1)).flatMap((lv) => [lv.name, lv.tip]),
      comboLabel(2), comboLabel(3), comboLabel(4), towerTitle(1), towerTitle(21),
    ];
    for (const t of texts) {
      for (const bad of blacklist) {
        expect(t, `命中商标：${bad}`).not.toContain(bad);
      }
    }
  });

  it("无血无死亡：全库文案不出现血、死、打败这类词", () => {
    const bad = ["血", "死亡", "杀", "尸"];
    for (const lv of LEVELS) {
      for (const t of [lv.name, lv.tip]) {
        for (const b of bad) expect(t, `${lv.name} 里有「${b}」`).not.toContain(b);
      }
    }
  });

  it("糖果收集半径够宽容：星星离轨迹 24px 以内仍然收得到", () => {
    // index.ts / sim.ts 用的是 circlesOverlap(cx, cy, 16, sx, sy, 14)，即 30px
    expect(circlesOverlap(100, 100, 16, 124, 100, 14)).toBe(true);
    expect(circlesOverlap(100, 100, 16, 131, 100, 14)).toBe(false);
  });
});

/* ================= 十、index.ts 静态巡检（destroy / CSS / 热区 / 音效） ================= */

const DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(join(DIR, "index.ts"), "utf8");
const GLOBAL_CSS = readFileSync(join(DIR, "..", "..", "styles.css"), "utf8");

describe("candy-swing 1.2 destroy 与资源清理", () => {
  it("挂上去的每个 pointer 监听都在 destroy 里摘掉了", () => {
    const added = [...INDEX_SRC.matchAll(/(canvas|window)\.addEventListener\("([a-z]+)"/g)]
      .map((m) => `${m[1]}:${m[2]}`);
    expect(added.length).toBeGreaterThanOrEqual(4);
    const destroyBody = INDEX_SRC.slice(INDEX_SRC.indexOf("    destroy() {"));
    for (const key of new Set(added)) {
      const [target, type] = key.split(":");
      expect(
        destroyBody.includes(`${target}.removeEventListener("${type}"`),
        `destroy 里漏摘 ${key}`
      ).toBe(true);
    }
  });

  it("destroy 里 rAF、朗读、指针捕获、物理数组都归了零", () => {
    const destroyBody = INDEX_SRC.slice(INDEX_SRC.indexOf("    destroy() {"));
    expect(destroyBody).toContain("cancelAnimationFrame(raf)");
    expect(destroyBody).toContain("raf = 0");
    expect(destroyBody).toContain("stopSpeaking()");
    expect(destroyBody).toContain("endPointer()");
    expect(destroyBody).toContain("wrap.remove()");
    for (const arr of ["particles", "links", "stickies", "springs", "ropeLinkRanges"]) {
      expect(destroyBody, `destroy 没清 ${arr}`).toContain(`${arr} = []`);
    }
    expect(destroyBody).toContain("ghosts.length = 0");
  });

  it("音效只走 api.play，没有自建 AudioContext；也没有裸 setInterval", () => {
    expect(INDEX_SRC).not.toContain("AudioContext");
    expect(INDEX_SRC).not.toContain("new Audio(");
    expect(INDEX_SRC).not.toContain("setInterval(");
    const sounds = [...INDEX_SRC.matchAll(/api\.play\("([a-z]+)"\)/g)].map((m) => m[1]);
    expect(sounds.length).toBeGreaterThan(5);
    for (const s of new Set(sounds)) {
      expect(["tap", "win", "oops", "coin", "pop", "meow", "jump"]).toContain(s);
    }
  });
});

describe("candy-swing 1.2 样式与热区（360px）", () => {
  it("1.2 新加的类名一律 cds- 前缀，而且全在本款局部 style 里", () => {
    const classes = new Set(
      [...INDEX_SRC.matchAll(/\.(cds-[a-z0-9-]+)/g)].map((m) => m[1])
    );
    expect(classes.size).toBeGreaterThanOrEqual(6);
    for (const c of classes) expect(c.startsWith("cds-")).toBe(true);
    // 全局 styles.css 一个字都没动
    expect(GLOBAL_CSS).not.toContain("cds-");
    expect(GLOBAL_CSS).not.toContain(".cs-wrap");
  });

  it("关卡目标与星星数一行显示且字号 ≥ 14px", () => {
    expect(INDEX_SRC).toContain(".cds-hud { display: flex;");
    const hud = INDEX_SRC.match(/\.cds-hud \.cs-badge \{ font-size: (\d+)px/);
    expect(hud).not.toBeNull();
    expect(Number(hud![1])).toBeGreaterThanOrEqual(14);
    // 提示行本来就是 14px
    expect(INDEX_SRC).toContain(".cs-msg { text-align: center; min-height: 20px;");
    expect(INDEX_SRC).toMatch(/\.cs-msg \{[^}]*font-size: 1[4-9]px/);
  });

  it("暂停/攻略这类按钮的热区 ≥ 44px，且划线扫过去不会误触", () => {
    const tap = INDEX_SRC.match(/\.cds-tap \{ min-height: (\d+)px; min-width: (\d+)px; font-size: (\d+)px/);
    expect(tap).not.toBeNull();
    expect(Number(tap![1])).toBeGreaterThanOrEqual(44);
    expect(Number(tap![2])).toBeGreaterThanOrEqual(44);
    expect(Number(tap![3])).toBeGreaterThanOrEqual(14);
    expect(INDEX_SRC).toContain("cds-tap cs-retry");
    expect(INDEX_SRC).toContain("cds-tap cs-back");
    // 只认「原地轻点」的包装还在
    expect(INDEX_SRC).toContain("tapOnly(retryBtn, retryLevel)");
    expect(INDEX_SRC).toMatch(/tapOnly\(backBtn/);
  });

  it("手指划出屏幕边缘安全收尾：抓指针 + 释放 + cancel 都接住了", () => {
    expect(INDEX_SRC).toContain("canvas.setPointerCapture(e.pointerId)");
    expect(INDEX_SRC).toContain("canvas.releasePointerCapture(activePointerId)");
    expect(INDEX_SRC).toContain("onPointerCancel");
    expect(INDEX_SRC).toContain("pointerDown = false");
  });

  it("连续采样与 prefers-reduced-motion 都接上了", () => {
    expect(INDEX_SRC).toContain("getCoalescedEvents");
    expect(INDEX_SRC).toContain("(prefers-reduced-motion: reduce)");
    expect(INDEX_SRC).toContain("lessMotion");
    // 残影寿命就是规格要求的 300ms
    expect(INDEX_SRC).toContain("const CANDY_GHOST_MS = 300");
    // 接糖三段演出不超过 700ms
    const eat = INDEX_SRC.match(/const EAT_SHOW_MS = (\d+)/);
    expect(eat).not.toBeNull();
    expect(Number(eat![1])).toBeLessThanOrEqual(700);
    expect(INDEX_SRC).toContain("eatShowSkipped");
  });

  it("平台直达第 N 关的入口在（自建地图不走 mountLevelGame）", () => {
    expect(INDEX_SRC).toContain("openCampaignLevel(n: number)");
    expect(INDEX_SRC).toContain('save.recordEndlessBest("candy-swing"');
  });
});

/* ================= 十一、两版 12-B 合流：swing12 的机关也得能玩 ================= */

// 同一格 12-B 有两份实现落在同一条分支上（见 UPGRADE-1.2.md）：
// swing12.ts 那一版把粘性泡泡写成 bubbles[i].sticky、弹簧蘑菇写成 mushrooms[]。
// 合流后 sim.ts 两套字段都认，这一组用例盯住「跑起来的游戏和仿真是同一套规则」。

describe("candy-swing 1.2 合流后 swing12 的机关在仿真里生效", () => {
  it("粘性泡泡（bubbles[].sticky）先把糖果挂住，到点再松手落进嘴里", () => {
    const lv: LevelDef = {
      name: "粘性泡泡试验", tip: "试验",
      candy: { x: 180, y: 150 },
      monster: { x: 180, y: 430 },
      ropes: [{ x: 180, y: 60 }],
      stars: [{ x: 180, y: 320 }],
      bubbles: [{ x: 180, y: 250, sticky: 1 }],
      solve: { kind: "cut", t: 0.2 },
    };
    const w = makeSimFor(lv);
    w.cutAll();
    runSim(w, 0.85);
    expect(w.sticky.held, "该被粘住").toBe(true);
    expect(Math.abs(w.candy().y - 250), "挂住期间原地不动").toBeLessThan(3);
    runSim(w, 4);
    expect(w.sticky.held).toBe(false);
    expect(w.ate, "松手之后还是会掉进嘴里").toBe(true);
  });

  it("普通泡泡（不带 sticky）还是 1.1 的软着陆，不会被当成粘性泡泡", () => {
    const lv: LevelDef = {
      name: "普通泡泡", tip: "试验",
      candy: { x: 180, y: 150 },
      monster: { x: 180, y: 430 },
      ropes: [{ x: 180, y: 60 }],
      stars: [{ x: 180, y: 320 }],
      bubbles: [{ x: 180, y: 250 }],
      solve: { kind: "cut", t: 0.2 },
    };
    const w = makeSimFor(lv);
    w.cutAll();
    runSim(w, 0.85);
    expect(w.sticky.held).toBe(false);
    expect(w.inBubble).toBe(true);
  });

  it("弹簧蘑菇（mushrooms[]）把掉下来的糖果改道", () => {
    const base: LevelDef = {
      name: "蘑菇试验", tip: "试验",
      candy: { x: 120, y: 150 },
      monster: { x: 300, y: 460 },
      ropes: [{ x: 120, y: 60 }],
      stars: [{ x: 200, y: 300 }],
      solve: { kind: "cut", t: 0.2 },
    };
    const withMushroom: LevelDef = {
      ...base,
      mushrooms: [{ x: 120, y: 360, dir: "right" }],
    };
    const plain = makeSimFor(base);
    plain.cutAll();
    runSim(plain, 1.6);
    const bounced = makeSimFor(withMushroom);
    bounced.cutAll();
    runSim(bounced, 1.6);
    expect(bounced.candy().x, "朝右的蘑菇该把糖果推向右边").toBeGreaterThan(plain.candy().x + 20);
  });

  it("两套机关字段可以同时出现在一关里，互不打架", () => {
    const lv: LevelDef = {
      name: "混编试验", tip: "试验",
      candy: { x: 180, y: 150 },
      monster: { x: 180, y: 440 },
      ropes: [{ x: 180, y: 60 }],
      stars: [{ x: 180, y: 320 }],
      bubbles: [{ x: 180, y: 230, sticky: 0.6 }],
      stickies: [{ x: 180, y: 330, radius: 28, hold: 0.6 }],
      mushrooms: [{ x: 40, y: 400, dir: "right" }],
      springs: [{ x: 320, y: 400, radius: 22, dir: "left", bounce: 1, minOut: 200 }],
      solve: { kind: "cut", t: 0.2 },
    };
    const w = makeSimFor(lv);
    w.cutAll();
    runSim(w, 6);
    expect(w.stuckT, "黏黏泡与粘性泡泡都该轮到过").toBeGreaterThan(0);
    expect(w.ate).toBe(true);
  });
});

describe("candy-swing 1.2 合流后 swing12 的机关在运行时也接上了", () => {
  it("index.ts 直接用 swing12 的纯函数，跑起来的规则和 sim.ts 一模一样", () => {
    for (const fn of ["stickyCatch", "stickyRelease", "tickSticky", "mushroomBounce", "mushroomTriggers"]) {
      expect(INDEX_SRC, `index.ts 没接 swing12 的 ${fn}`).toContain(fn);
    }
    expect(INDEX_SRC).toContain('from "./swing12"');
    // 关卡里两套机关字段都要建运行时状态
    expect(INDEX_SRC).toContain("level.mushrooms ?? []");
    expect(INDEX_SRC).toContain("sticky: b.sticky");
  });

  it("粘性泡泡有倒计时圈、蘑菇有朝向箭头，孩子看得见规则", () => {
    expect(INDEX_SRC).toContain("stickyProgress(bubbleSticky");
    expect(INDEX_SRC).toContain("function drawMushrooms()");
    expect(INDEX_SRC).toContain("drawMushrooms()");
  });

  it("destroy 里这两套新状态也清干净了", () => {
    const destroyBody = INDEX_SRC.slice(INDEX_SRC.indexOf("    destroy() {"));
    expect(destroyBody).toContain("mushrooms = []");
    expect(destroyBody).toContain("bubbleSticky = createSticky()");
    expect(destroyBody).toContain("bubbleStickyAt = null");
  });
});
