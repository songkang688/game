/**
 * 飞机小队 1.2 的纯逻辑用例:弹幕语法、判定盒、火力成长、
 * Boss 三阶段时间线与可躲避性、对象池、云海远征、前 99 关不变。
 * 运行时那一层(DOM / rAF / 双人输入 / destroy)在 runtime12.test.ts。
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CORE_DOT_R,
  DEFAULT_CUE,
  GRAZE_R,
  MAX_BULLET_SPEED,
  MIN_BULLET_RADIUS,
  MIN_BULLET_WARN,
  PATTERN_KINDS,
  PATTERN_LABEL,
  PATTERN_SHAPE,
  PLANE_ART,
  PLAYER_HIT_R,
  PLAYER_ROW,
  PLAYER_SPEED,
  SKY_W,
  aimedDodgeable,
  bossTimeline,
  buildVolley,
  bulletTouch,
  compileDecl,
  compileDecks,
  cueOf,
  expandDecl,
  findDodgePath,
  guideStar,
  hitBoxRatio,
  makeSpec,
  type PatternDecl,
  type PatternKind,
} from "./bullets";
import { BOSSES, buildSortie } from "./levels";
import { Pool, makeBulletPool, makePuffPool, makeShotPool, spawnPooled } from "./pool";
import {
  LINK_DIST,
  POWER_MAX,
  POWER_TRACKS,
  TRACK_INFO,
  coopLink,
  dropOneLevel,
  emptyPower,
  planDps,
  powerLevel,
  shotPlan,
  steer,
  upgrade,
} from "./power";
import {
  SEGMENTS,
  SUPPLY_EVERY,
  difficultyAt,
  expeditionLine,
  expeditionPlan,
  expeditionScore,
  legAt,
} from "./expedition";
import { PICKUP_INFO, PICKUP_TRACK, TOUCH_LIFT, applyPickup, dragTarget, makePlane, touchPlane } from "./logic";

const ORIGIN = { x: SKY_W / 2, y: 130 };

// ---------------------------------------------------------------------------
// 一、弹幕语法
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 弹幕语法", () => {
  it("一段 JSON 就是一个图案:parse 出来的对象能直接编译成弹幕", () => {
    const json = '{"pattern":"fan","count":7,"speed":120,"delay":0.5,"arc":90}';
    const spec = compileDecl(JSON.parse(json) as PatternDecl);
    expect(spec.kind).toBe("fan");
    expect(spec.count).toBe(7);
    expect(spec.speed).toBe(120);
    expect(spec.delay).toBe(0.5);
    // arc 写的是角度,编译成弧度
    expect(spec.spread).toBeCloseTo(Math.PI / 2, 6);
    const bullets = expandDecl(JSON.parse(json) as PatternDecl, 0, ORIGIN);
    expect(bullets.length).toBe(7);
  });

  it("语法层守着可读性底线:弹太快 / 太小 / 没预警都会被夹回来", () => {
    const wild = compileDecl({ pattern: "ring", count: -3, speed: 9000, radius: 1, warn: 0, interval: 0 });
    expect(wild.speed).toBe(MAX_BULLET_SPEED);
    expect(wild.radius).toBeGreaterThanOrEqual(MIN_BULLET_RADIUS);
    expect(wild.warn).toBeGreaterThanOrEqual(MIN_BULLET_WARN);
    expect(wild.count).toBeGreaterThanOrEqual(1);
    expect(wild.interval).toBeGreaterThan(0);
    // 认不出来的图案名不抛错,退回扇形(关卡数据写错也不能让孩子白屏)
    expect(compileDecl({ pattern: "nonsense" as PatternKind }).kind).toBe("fan");
  });

  it("八种基础图案都发得出弹、都有中文名、形状两两不同", () => {
    expect(PATTERN_KINDS.length).toBeGreaterThanOrEqual(6);
    expect(PATTERN_KINDS.length).toBe(8);
    const shapes = new Set<string>();
    for (const kind of PATTERN_KINDS) {
      const bullets = expandDecl({ pattern: kind, count: 8 }, 0, ORIGIN);
      expect(bullets.length, `${kind} 一发都没发出来`).toBeGreaterThan(0);
      expect(PATTERN_LABEL[kind].length).toBeGreaterThan(1);
      for (const b of bullets) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        expect(Number.isFinite(b.vx) && Number.isFinite(b.vy)).toBe(true);
        expect(b.shape).toBe(PATTERN_SHAPE[kind]);
      }
      shapes.add(PATTERN_SHAPE[kind]);
    }
    // 形状必须两两不同 —— 不能只靠颜色分辨弹型
    expect(shapes.size).toBe(PATTERN_KINDS.length);
  });

  it("展开是纯函数:同样的声明 + 同样的轮次 = 同样的子弹", () => {
    for (const kind of PATTERN_KINDS) {
      const d: PatternDecl = { pattern: kind, count: 9, speed: 118, arc: 70, rotate: 24 };
      expect(JSON.stringify(expandDecl(d, 4, ORIGIN))).toBe(JSON.stringify(expandDecl(d, 4, ORIGIN)));
    }
  });

  it("锁定弹真的朝锁定点飞,不给锁定点就锁「指路星」", () => {
    const aim = { x: 60, y: PLAYER_ROW };
    const locked = expandDecl({ pattern: "aimed", count: 1, speed: 120 }, 0, ORIGIN, { aim });
    const ang = Math.atan2(locked[0].vy, locked[0].vx);
    expect(ang).toBeCloseTo(Math.atan2(aim.y - ORIGIN.y, aim.x - ORIGIN.x), 6);

    const star = guideStar(3);
    const auto = expandDecl({ pattern: "aimed", count: 1, speed: 120 }, 3, ORIGIN);
    expect(Math.atan2(auto[0].vy, auto[0].vx)).toBeCloseTo(
      Math.atan2(star.y - ORIGIN.y, star.x - ORIGIN.x),
      6
    );
    expect(star.x).toBeGreaterThan(0);
    expect(star.x).toBeLessThan(SKY_W);
  });

  it("锁定弹的预警足够长:侧身一步就让得开(所以它不是甩不掉的追踪弹)", () => {
    const spec = compileDecl({ pattern: "aimed", count: 3, speed: 130, radius: 12, warn: 0.5 });
    expect(aimedDodgeable(spec)).toBe(true);
    // 预警砍到接近 0 就该判定为让不开
    expect(aimedDodgeable({ ...spec, warn: 0.05, radius: 20 }, PLAYER_SPEED)).toBe(false);
    // 战役里凡是用锁定弹的地方,都必须过这条线
    for (let lv = 0; lv < 188; lv++) {
      for (const w of buildSortie(lv).waves) {
        if (w.fire.kind !== "aimed") continue;
        expect(aimedDodgeable(w.fire), `第 ${lv + 1} 关的锁定弹让不开`).toBe(true);
      }
    }
  });

  it("十字弹的四条胳膊之间永远留着空扇区", () => {
    for (let index = 0; index < 6; index++) {
      const arms = expandDecl({ pattern: "cross", count: 8, rotate: 20 }, index, ORIGIN);
      const angles = arms.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
      const uniq = [...new Set(angles.map((a) => a.toFixed(4)))];
      expect(uniq.length).toBe(4);
      for (let i = 1; i < uniq.length; i++) {
        expect(Number(uniq[i]) - Number(uniq[i - 1])).toBeGreaterThan(1);
      }
    }
  });

  it("compileDecks 一次编译一整套(Boss 一个阶段就是若干套叠起来)", () => {
    const deck = compileDecks([
      { pattern: "ring", count: 11 },
      { pattern: "rain", count: 4, delay: 0.9 },
      { pattern: "cross", count: 4, delay: 2 },
    ]);
    expect(deck.map((s) => s.kind)).toEqual(["ring", "rain", "cross"]);
    expect(deck[1].delay).toBeCloseTo(0.9, 6);
  });
});

// ---------------------------------------------------------------------------
// 二、判定盒与擦弹
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 判定盒", () => {
  it("判定圆比机身画面小得多:横向不到三成,面积不到一成", () => {
    const ratio = hitBoxRatio();
    expect(PLAYER_HIT_R * 2).toBeLessThan(PLANE_ART.width);
    expect(ratio.width).toBeLessThan(0.3);
    expect(ratio.area).toBeLessThan(0.1);
    // 画出来的判定核心不能比判定圆还大,不然孩子会以为核心边缘也算中
    expect(CORE_DOT_R).toBeLessThanOrEqual(PLAYER_HIT_R);
  });

  it("碰到 / 擦过 / 还早着分得清清楚楚", () => {
    const r = 12;
    expect(bulletTouch(0, 0, r)).toBe("hit");
    expect(bulletTouch(PLAYER_HIT_R + r - 1, 0, r)).toBe("hit");
    expect(bulletTouch(PLAYER_HIT_R + r + 2, 0, r)).toBe("graze");
    expect(bulletTouch(GRAZE_R + r + 2, 0, r)).toBe("clear");
    // 擦弹的判定环一定比命中环宽,不然「好险!」永远触发不了
    expect(GRAZE_R).toBeGreaterThan(PLAYER_HIT_R * 2);
  });
});

// ---------------------------------------------------------------------------
// 三、火力成长
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 火力成长", () => {
  it("四条线各有上限,吃满了不再涨", () => {
    expect(POWER_TRACKS).toEqual(["spread", "homing", "pierce", "wing"]);
    for (const t of POWER_TRACKS) {
      let levels = emptyPower();
      for (let i = 0; i < 9; i++) levels = upgrade(levels, t).levels;
      expect(levels[t]).toBe(TRACK_INFO[t].cap);
      expect(upgrade(levels, t).upgraded).toBe(false);
    }
    let full = emptyPower();
    for (const t of POWER_TRACKS) for (let i = 0; i < TRACK_INFO[t].cap; i++) full = upgrade(full, t).levels;
    expect(powerLevel(full)).toBe(POWER_MAX);
  });

  it("被碰到只掉一级(掉最高的那条),而且永远掉不到负数", () => {
    let levels = upgrade(upgrade(emptyPower(), "spread").levels, "spread").levels;
    levels = upgrade(levels, "wing").levels;
    expect(powerLevel(levels)).toBe(3);
    const once = dropOneLevel(levels);
    expect(once.track).toBe("spread");
    expect(powerLevel(once.levels)).toBe(2);
    let now = once.levels;
    for (let i = 0; i < 8; i++) now = dropOneLevel(now).levels;
    expect(powerLevel(now)).toBe(0);
    expect(dropOneLevel(now).track).toBeNull();
  });

  it("四条线各自改变的是不同的东西,没有一条碾压另外三条", () => {
    const base = shotPlan(emptyPower());
    expect(base.count).toBe(1);
    expect(base.pierce).toBe(1);
    expect(base.homing).toBe(0);
    expect(base.wingmen).toBe(0);

    const spread = shotPlan({ ...emptyPower(), spread: 3 });
    expect(spread.count).toBe(4);
    expect(spread.lanes.length).toBe(4);
    expect(shotPlan({ ...emptyPower(), pierce: 2 }).pierce).toBe(3);
    expect(shotPlan({ ...emptyPower(), homing: 2 }).homing).toBeGreaterThan(0);
    expect(shotPlan({ ...emptyPower(), wing: 5 }).wingmen).toBe(TRACK_INFO.wing.cap);
    // 我方弹的形状随成长线变,而且和敌弹那八种形状完全不重叠
    const myShapes = new Set([base.shape, spread.shape, shotPlan({ ...emptyPower(), pierce: 1 }).shape]);
    for (const shape of myShapes) expect(Object.values(PATTERN_SHAPE)).not.toContain(shape);

    const solos = POWER_TRACKS.map((t) => planDps({ ...emptyPower(), [t]: TRACK_INFO[t].cap }));
    expect(Math.max(...solos)).toBeLessThan(Math.min(...solos) * 3);
  });

  it("追踪弹拐得很慢:一帧最多拐 rate*dt,而且速度大小不变", () => {
    const before = { vx: 0, vy: -500 };
    const after = steer(before.vx, before.vy, 300, 100, 100, 400, 0.8, 1 / 60);
    expect(Math.hypot(after.vx, after.vy)).toBeCloseTo(500, 4);
    const turn = Math.abs(Math.atan2(after.vy, after.vx) - Math.atan2(before.vy, before.vx));
    expect(turn).toBeLessThanOrEqual(0.8 / 60 + 1e-9);
    // rate 为 0 就是直线
    expect(steer(0, -500, 300, 100, 100, 400, 0, 0.1)).toEqual(before);
  });

  it("关内道具接到成长线上,吃到就升,升满不炸", () => {
    expect(PICKUP_TRACK.power).toBe("spread");
    expect(PICKUP_TRACK.wing).toBe("wing");
    expect(PICKUP_TRACK.homing).toBe("homing");
    expect(PICKUP_TRACK.pierce).toBe("pierce");
    expect(PICKUP_TRACK.shield).toBeUndefined();
    let plane = makePlane();
    expect(powerLevel(plane.levels)).toBe(0);
    plane = applyPickup(plane, "power");
    plane = applyPickup(plane, "homing");
    plane = applyPickup(plane, "pierce");
    expect(powerLevel(plane.levels)).toBe(3);
    for (let i = 0; i < 9; i++) plane = applyPickup(plane, "pierce");
    expect(plane.levels.pierce).toBe(TRACK_INFO.pierce.cap);
    for (const info of Object.values(PICKUP_INFO)) expect(info.label.length).toBeGreaterThan(1);
  });

  it("被碰到:掉一级 + 打个转 + 短无敌,而不是这一趟直接结束", () => {
    const grown = applyPickup(applyPickup(makePlane(), "power"), "wing");
    const hit = touchPlane({ ...grown, invuln: 0, shield: 0, spare: 2 });
    expect(hit.outcome).toBe("swapped");
    expect(hit.spin).toBeGreaterThan(0);
    expect(hit.plane.invuln).toBeGreaterThan(0);
    expect(powerLevel(hit.plane.levels)).toBe(powerLevel(grown.levels) - 1);
    expect(hit.plane.spare).toBe(1);
    expect(hit.line).not.toMatch(/坠|炸|伤|死/);
  });

  it("合作的配合价值:两机靠近才合流,越近越粗,离远了就没有", () => {
    const levels = upgrade(emptyPower(), "spread").levels;
    const far = coopLink({ x: 60, y: 600, levels }, { x: 420, y: 600, levels });
    expect(far.linked).toBe(false);
    const near = coopLink({ x: 220, y: 600, levels }, { x: 260, y: 600, levels });
    expect(near.linked).toBe(true);
    expect(near.damage).toBeGreaterThan(1);
    expect(near.x).toBeCloseTo(240, 6);
    const closer = coopLink({ x: 236, y: 600, levels }, { x: 244, y: 600, levels });
    expect(closer.width).toBeGreaterThan(near.width);
    // 边界:刚好 LINK_DIST 还算合流
    expect(coopLink({ x: 100, y: 600, levels }, { x: 100 + LINK_DIST, y: 600, levels }).linked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 四、Boss 三阶段时间线
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 Boss 时间线", () => {
  it("八位 Boss 都是三阶段,而且每一段前面都挂着一个不发弹的预告", () => {
    for (const boss of BOSSES) {
      expect(boss.phases.length).toBe(3);
      const line = bossTimeline(boss);
      expect(line.length).toBe(6);
      for (let i = 0; i < line.length; i += 2) {
        expect(line[i].kind).toBe("cue");
        expect(line[i].firing).toBe(false);
        expect(line[i].seconds).toBeGreaterThanOrEqual(0.8);
        expect(line[i + 1].kind).toBe("phase");
        expect(line[i + 1].firing).toBe(true);
      }
      // 时间线首尾相接,不留缝
      for (let i = 1; i < line.length; i++) {
        expect(line[i].at).toBeCloseTo(line[i - 1].at + line[i - 1].seconds, 6);
      }
    }
  });

  it("每位 Boss 的每个阶段都写了预告动作与预告词,三种动作都用上了", () => {
    const moves = new Set<string>();
    for (const boss of BOSSES) {
      for (const ph of boss.phases) {
        const cue = cueOf(ph);
        expect(ph.cue, `${boss.name} 的「${ph.name}」没写预告`).toBeDefined();
        expect(cue.call.length).toBeGreaterThan(5);
        expect(cue.seconds).toBeGreaterThanOrEqual(0.8);
        moves.add(cue.move);
      }
    }
    expect(moves.size).toBe(3);
    // 没写预告也有兜底,永远存在安全窗口
    expect(cueOf({ name: "x", until: 0, patterns: [], swing: 0, color: "#fff", shout: "" }).seconds).toBe(
      DEFAULT_CUE.seconds
    );
  });

  it("24 个阶段逐个模拟:每一帧都存在可行走位,没有无解弹幕", () => {
    for (const boss of BOSSES) {
      for (const ph of boss.phases) {
        const report = findDodgePath(ph, { duration: 16 });
        expect(
          report.ok,
          `${boss.name} 的「${ph.name}」躲不掉:第 ${report.survivedSteps}/${report.steps} 步就没路了`
        ).toBe(true);
        expect(report.spawned).toBeGreaterThan(10);
        expect(report.path.length).toBe(report.steps + 1);
      }
    }
  });

  it("三套弹幕叠着来的收尾阶段也躲得掉(而且确实是三套)", () => {
    const heavy = BOSSES.flatMap((b) => b.phases).filter((p) => p.patterns.length >= 3);
    expect(heavy.length).toBeGreaterThanOrEqual(2);
    for (const ph of heavy) {
      expect(findDodgePath(ph, { duration: 18 }).ok, `「${ph.name}」三套叠起来躲不掉`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 五、对象池
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 对象池", () => {
  it("1000 次生成回收之后,池子一个对象都没多造", () => {
    const pool = makeBulletPool(64);
    const spec = makeSpec("ring", { count: 10 });
    for (let round = 0; round < 1000; round++) {
      for (const b of buildVolley(spec, round, ORIGIN)) spawnPooled(pool, b);
      pool.sweep(() => false);
      expect(pool.size).toBe(0);
    }
    const stats = pool.stats();
    // 一轮 10 发,复用之后总共只造过 10 个
    expect(stats.created).toBe(10);
    expect(pool.footprint).toBe(10);
    expect(stats.refused).toBe(0);
  });

  it("三种池子都不膨胀:粒子与我方弹同样只造一批", () => {
    const puffs = makePuffPool(40);
    const shots = makeShotPool(40);
    for (let i = 0; i < 1000; i++) {
      for (let k = 0; k < 6; k++) {
        puffs.acquire();
        shots.acquire();
      }
      puffs.sweep(() => false);
      shots.sweep(() => false);
    }
    expect(puffs.stats().created).toBe(6);
    expect(shots.stats().created).toBe(6);
    expect(puffs.footprint).toBe(6);
    expect(shots.footprint).toBe(6);
  });

  it("到顶就拒发,不会把内存吃干净;取出来的对象一定是干净的", () => {
    const pool = new Pool<{ n: number }>(() => ({ n: 0 }), (o) => void (o.n = 0), 3);
    for (let i = 0; i < 3; i++) {
      const item = pool.acquire();
      expect(item).not.toBeNull();
      item!.n = 99;
    }
    expect(pool.acquire()).toBeNull();
    expect(pool.stats().refused).toBe(1);
    pool.clear();
    expect(pool.size).toBe(0);
    // 回收再取出来,字段被重置过
    expect(pool.acquire()?.n).toBe(0);
    pool.drop();
    expect(pool.footprint).toBe(0);
  });

  it("sweep 只挪指针:活着的顺序不变,死掉的进闲置槽", () => {
    const pool = new Pool<{ id: number; dead: boolean }>(
      () => ({ id: 0, dead: false }),
      (o) => {
        o.id = 0;
        o.dead = false;
      },
      20
    );
    for (let i = 0; i < 10; i++) {
      const item = pool.acquire();
      if (item) {
        item.id = i;
        item.dead = i % 3 === 0;
      }
    }
    pool.sweep((o) => !o.dead);
    expect(pool.live.map((o) => o.id)).toEqual([1, 2, 4, 5, 7, 8]);
    expect(pool.footprint).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 六、云海远征
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 云海远征", () => {
  it("同一颗种子拼出来的航线永远一模一样,不同种子会不一样", () => {
    expect(JSON.stringify(expeditionPlan(1234, 24))).toBe(JSON.stringify(expeditionPlan(1234, 24)));
    const a = expeditionPlan(1234, 24).map((l) => l.segment.id).join(",");
    const b = expeditionPlan(8888, 24).map((l) => l.segment.id).join(",");
    expect(a).not.toBe(b);
  });

  it("段落是拼出来的,不是同一段加速:连着两段不重样,六种段落都会出现", () => {
    const plan = expeditionPlan(2024, 40);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].segment.id, `第 ${i + 1} 段和上一段撞了`).not.toBe(plan[i - 1].segment.id);
    }
    const seen = new Set(plan.map((l) => l.segment.id));
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(seen.has("supply")).toBe(true);
    for (const seg of SEGMENTS) {
      expect(seg.name.length).toBeGreaterThan(1);
      expect(seg.call.length).toBeGreaterThan(5);
      expect(compileDecl(seg.fire).speed).toBeLessThanOrEqual(MAX_BULLET_SPEED);
    }
  });

  it("难度曲线单调不减且封顶,开火间隔有下限", () => {
    let prev = 0;
    for (let i = 0; i < 200; i++) {
      const d = difficultyAt(i);
      expect(d).toBeGreaterThanOrEqual(prev);
      expect(d).toBeLessThanOrEqual(2.6);
      prev = d;
    }
    for (const leg of expeditionPlan(5, 60)) {
      expect(leg.fireGap).toBeGreaterThanOrEqual(0.95);
      expect(leg.foesPerWave).toBeLessThanOrEqual(11);
      expect(leg.waves).toBeGreaterThanOrEqual(1);
    }
  });

  it("每四段必有一朵补给云,而且白送一条成长线", () => {
    const plan = expeditionPlan(77, 20);
    for (const leg of plan) {
      const isSupply = leg.index > 0 && leg.index % SUPPLY_EVERY === SUPPLY_EVERY - 1;
      expect(leg.segment.id === "supply", `第 ${leg.index + 1} 段补给云对不上`).toBe(isSupply);
      if (isSupply) {
        expect(leg.reward).not.toBeNull();
        expect(POWER_TRACKS).toContain(leg.reward);
        // 补给云要松:开火间隔明显比战斗段长
        expect(leg.fireGap).toBeGreaterThan(2.4);
      } else {
        expect(leg.reward).toBeNull();
      }
    }
    // 四条成长线都会轮到
    const rewards = new Set(expeditionPlan(77, 80).map((l) => l.reward).filter(Boolean));
    expect(rewards.size).toBe(POWER_TRACKS.length);
  });

  it("远征成绩:段数是大头,战果与擦弹都算分,而且封顶", () => {
    expect(expeditionScore(1, 0, 0)).toBe(0);
    expect(expeditionScore(5, 0, 0)).toBeGreaterThan(expeditionScore(3, 0, 0));
    expect(expeditionScore(5, 10, 0)).toBeGreaterThan(expeditionScore(5, 0, 0));
    expect(expeditionScore(5, 0, 10)).toBeGreaterThan(expeditionScore(5, 0, 0));
    expect(expeditionScore(5, 0, 99999) - expeditionScore(5, 0, 0)).toBe(300);
    for (const line of [expeditionLine(1, 3, 0), expeditionLine(9, 40, 20), expeditionLine(4, 12, 2)]) {
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toMatch(/血|伤|死|爆炸|笨|真差/);
    }
  });

  it("远征每一段的弹幕都躲得掉", () => {
    for (const leg of expeditionPlan(99, 12)) {
      const report = findDodgePath(
        { name: leg.segment.name, until: 0, swing: 60, color: "#eee", shout: "", patterns: [compileDecl(leg.segment.fire)] },
        { duration: 12 }
      );
      expect(report.ok, `「${leg.segment.name}」这一段躲不掉`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 七、手机与回归
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 手机与回归", () => {
  it("拖动时飞机停在手指上方 40px,而且照样夹在场地里", () => {
    const at = dragTarget(240, 600);
    expect(TOUCH_LIFT).toBe(40);
    expect(at.y).toBe(560);
    expect(at.x).toBe(240);
    // 关掉偏移就是跟手
    expect(dragTarget(240, 600, 0).y).toBe(600);
    // 拖到画面外也不会把飞机甩出去
    const corner = dragTarget(-999, -999);
    expect(corner.x).toBeGreaterThan(0);
    expect(corner.y).toBeGreaterThan(0);
    expect(dragTarget(9999, 9999).x).toBeLessThan(SKY_W);
  });

  it("前 99 关的编队 / 弹幕 / 道具 / 提示一个字节都没动", () => {
    const rows: string[] = [];
    for (let lv = 0; lv < 99; lv++) {
      const d = buildSortie(lv);
      rows.push(JSON.stringify({ c: d.chapter, w: d.waves, p: d.pickups, h: d.hint, b: d.boss?.id ?? null }));
    }
    const sha = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    // 这串指纹是 1.1 收尾时的前 99 关。1.2 只在第六章起换新图案,前面一律照旧
    expect(sha).toBe("6975efefbedfe296f5978914f35b5778727448ee7761a9fe972cb82ab9431a9a");
  });

  it("新图案只在第六章之后上场,前面还是 1.1 那四种", () => {
    const kindsBefore = new Set<string>();
    for (let lv = 0; lv < 120; lv++) for (const w of buildSortie(lv).waves) kindsBefore.add(w.fire.kind);
    expect(kindsBefore.has("aimed")).toBe(false);
    expect(kindsBefore.has("cross")).toBe(false);
    const kindsAfter = new Set<string>();
    for (let lv = 120; lv < 188; lv++) for (const w of buildSortie(lv).waves) kindsAfter.add(w.fire.kind);
    expect(kindsAfter.has("aimed")).toBe(true);
  });
});
