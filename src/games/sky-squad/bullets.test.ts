import { describe, expect, it } from "vitest";
import {
  DEFAULT_DODGE,
  PATTERN_LABEL,
  PLAYER_HIT_R,
  PLAYER_ROW,
  SKY_H,
  SKY_W,
  bossX,
  buildVolley,
  findDodgePath,
  makeSpec,
  stepBullets,
  type PatternKind,
  type PhaseSpec,
} from "./bullets";
import { BOSSES } from "./levels";

const ORIGIN = { x: SKY_W / 2, y: 130 };

// ---------------------------------------------------------------------------
// 生成器本身
// ---------------------------------------------------------------------------

describe("sky-squad 弹幕生成器", () => {
  it("六种图案都能发出弹,而且都有中文名字", () => {
    const kinds: PatternKind[] = ["fan", "ring", "spiral", "sweep", "wall", "rain"];
    for (const kind of kinds) {
      const bullets = buildVolley(makeSpec(kind), 0, ORIGIN);
      expect(bullets.length).toBeGreaterThan(0);
      expect(PATTERN_LABEL[kind].length).toBeGreaterThan(1);
      for (const b of bullets) {
        expect(Number.isFinite(b.x)).toBe(true);
        expect(Number.isFinite(b.vx) && Number.isFinite(b.vy)).toBe(true);
        expect(b.r).toBeGreaterThan(3);
      }
    }
  });

  it("同一轮齐射每次生成完全一样(弹幕和玩家位置无关)", () => {
    for (const kind of ["ring", "rain", "wall", "spiral"] as PatternKind[]) {
      const a = buildVolley(makeSpec(kind), 5, ORIGIN);
      const b = buildVolley(makeSpec(kind), 5, ORIGIN);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("敌弹都是「低速大弹」:速度压在 160 以内,半径至少 10", () => {
    for (const boss of BOSSES) {
      for (const ph of boss.phases) {
        for (const spec of ph.patterns) {
          expect(spec.speed).toBeLessThanOrEqual(160);
          expect(spec.radius).toBeGreaterThanOrEqual(10);
          expect(spec.warn).toBeGreaterThan(0);
        }
      }
    }
  });

  it("环形弹匀匀铺满一圈,螺旋弹每轮都转过一个角度", () => {
    const ring = buildVolley(makeSpec("ring", { count: 12 }), 0, ORIGIN);
    expect(ring.length).toBe(12);
    const angles = ring.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo((Math.PI * 2) / 12, 4);
    }
    const spec = makeSpec("spiral", { count: 4, rotate: 0.5 });
    const a0 = Math.atan2(buildVolley(spec, 0, ORIGIN)[0].vy, buildVolley(spec, 0, ORIGIN)[0].vx);
    const a1 = Math.atan2(buildVolley(spec, 1, ORIGIN)[0].vy, buildVolley(spec, 1, ORIGIN)[0].vx);
    expect(Math.abs(a1 - a0)).toBeGreaterThan(0.1);
  });

  it("缺口墙一定留缺口,而且缺口比机身宽得多", () => {
    const spec = makeSpec("wall", { count: 11, gaps: 2, radius: 13 });
    for (let index = 0; index < 8; index++) {
      const row = buildVolley(spec, index, ORIGIN).map((b) => b.x).sort((a, b) => a - b);
      expect(row.length).toBeLessThan(11);
      let widest = row[0] * 2;
      for (let i = 1; i < row.length; i++) widest = Math.max(widest, row[i] - row[i - 1]);
      widest = Math.max(widest, (SKY_W - row[row.length - 1]) * 2);
      // 缺口净宽要装得下机身判定圆还有富余
      expect(widest - 2 * 13).toBeGreaterThan(PLAYER_HIT_R * 3);
    }
  });

  it("落雨弹永远至少留四条空泳道", () => {
    const lanes = 11;
    const spec = makeSpec("rain", { count: 20 });
    for (let index = 0; index < 12; index++) {
      const used = new Set(buildVolley(spec, index, ORIGIN).map((b) => Math.round((b.x / SKY_W) * lanes - 0.5)));
      expect(lanes - used.size).toBeGreaterThanOrEqual(4);
    }
  });

  it("Boss 横向摆动是时间的确定函数,不会飞出场地", () => {
    for (let t = 0; t < 20; t += 0.37) {
      const x = bossX(t, 140);
      expect(x).toBeGreaterThan(SKY_W / 2 - 141);
      expect(x).toBeLessThan(SKY_W / 2 + 141);
      expect(bossX(t, 140)).toBe(x);
    }
  });

  it("子弹先亮预警再起飞,飞出场地就回收", () => {
    const warned = buildVolley(makeSpec("fan", { warn: 0.5 }), 0, ORIGIN);
    const after = stepBullets(warned, 0.1);
    expect(after[0].x).toBe(warned[0].x);
    expect(after[0].warn).toBeCloseTo(0.4, 5);
    const flying = stepBullets(warned.map((b) => ({ ...b, warn: 0 })), 0.1);
    expect(flying[0].y).not.toBe(warned[0].y);
    const gone = stepBullets([{ ...warned[0], warn: 0, y: SKY_H + 60, vy: 400 }], 0.5);
    expect(gone.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 可躲避性:每个 Boss 的每个阶段都必须存在一条不被击中的路径
// ---------------------------------------------------------------------------

describe("sky-squad 弹幕可躲避性", () => {
  it("八位 Boss × 三个阶段,每一段都存在一条全程不被击中的移动路径", () => {
    expect(BOSSES.length).toBe(8);
    for (const boss of BOSSES) {
      expect(boss.phases.length).toBe(3);
      for (const ph of boss.phases) {
        const report = findDodgePath(ph, { duration: 14 });
        expect(
          report.ok,
          `${boss.name} 的「${ph.name}」躲不掉:第 ${report.survivedSteps}/${report.steps} 步就没路了`
        ).toBe(true);
        // 这一段确实喷了不少弹,不是「因为没弹所以躲得掉」
        expect(report.spawned).toBeGreaterThan(10);
        expect(report.path.length).toBe(report.steps + 1);
        for (const x of report.path) {
          expect(x).toBeGreaterThanOrEqual(DEFAULT_DODGE.margin - 1e-6);
          expect(x).toBeLessThanOrEqual(SKY_W - DEFAULT_DODGE.margin + 1e-6);
        }
      }
    }
  });

  it("求解器给出的路径回放一遍,确实一次都没被碰到", () => {
    const ph = BOSSES[7].phases[2];
    const opt = { ...DEFAULT_DODGE, duration: 12 };
    const report = findDodgePath(ph, opt);
    expect(report.ok).toBe(true);

    // 按报告里的横坐标逐帧回放同一套弹幕,自己再验一遍命中
    let bullets = stepBullets([], 0);
    const nextVolley = ph.patterns.map((p) => p.delay);
    const volley = ph.patterns.map(() => 0);
    let touched = 0;
    for (let k = 1; k <= report.steps; k++) {
      const t = k * opt.dt;
      for (let pi = 0; pi < ph.patterns.length; pi++) {
        while (t >= nextVolley[pi]) {
          bullets = bullets.concat(
            buildVolley(ph.patterns[pi], volley[pi], { x: bossX(nextVolley[pi], ph.swing), y: opt.bossY })
          );
          volley[pi]++;
          nextVolley[pi] += Math.max(0.05, ph.patterns[pi].interval);
        }
      }
      bullets = stepBullets(bullets, opt.dt);
      const px = report.path[k];
      for (const b of bullets) {
        if (b.warn > 0) continue;
        const dx = b.x - px;
        const dy = b.y - PLAYER_ROW;
        if (dx * dx + dy * dy < (b.r + PLAYER_HIT_R) * (b.r + PLAYER_HIT_R)) touched++;
      }
    }
    expect(touched).toBe(0);
  });

  it("生成器守着底线:缺口数写 0 也会被抬回 1,永远不会封死整行", () => {
    const sealed = buildVolley(makeSpec("wall", { count: 12, gaps: 0 }), 3, ORIGIN);
    expect(sealed.length).toBeLessThan(12);
  });

  it("求解器不是「怎么都说躲得掉」:缝隙窄到装不下机身就会老实报躲不掉", () => {
    // 缺口还在,但两侧大弹的半径把它吃得只剩负数,机身钻不过去
    const tight: PhaseSpec = {
      name: "窄缝墙(测试用)",
      until: 0,
      swing: 0,
      color: "#000000",
      shout: "",
      patterns: [makeSpec("wall", { count: 24, gaps: 1, radius: 22, speed: 150, interval: 0.5, warn: 0 })],
    };
    const report = findDodgePath(tight, { duration: 8 });
    expect(report.ok).toBe(false);
    expect(report.survivedSteps).toBeLessThan(report.steps);
  });

  it("弹速拉到不讲道理的高时也会判躲不掉(说明判定跟得上速度)", () => {
    const rush: PhaseSpec = {
      name: "超速环(测试用)",
      until: 0,
      swing: 0,
      color: "#000000",
      shout: "",
      patterns: [makeSpec("ring", { count: 90, speed: 900, radius: 18, interval: 0.25, warn: 0 })],
    };
    expect(findDodgePath(rush, { duration: 8 }).ok).toBe(false);
  });

  it("普通关的敌机弹幕更稀,同样躲得掉", () => {
    const light: PhaseSpec = {
      name: "小队弹幕",
      until: 0,
      swing: 60,
      color: "#EEE",
      shout: "",
      patterns: [
        makeSpec("fan", { count: 4, speed: 110, radius: 12, interval: 1.6 }),
        makeSpec("rain", { count: 3, speed: 118, radius: 12, interval: 1.4, delay: 0.6 }),
      ],
    };
    const report = findDodgePath(light, { duration: 16 });
    expect(report.ok).toBe(true);
    expect(report.spawned).toBeGreaterThan(20);
  });
});
