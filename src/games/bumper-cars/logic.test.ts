// 碰碰车大乱斗 · 物理与规则单测。
//
// 重点是物理:弹性碰撞必须动量守恒(不管弹性系数取多少),
// 完全弹性时还要动能守恒——这两条守恒律是整套手感的地基,先钉死它们。
import { describe, expect, it } from "vitest";
import {
  ACCEL,
  BRAKE_PER_SEC,
  CAR_R,
  DAMP_PER_SEC,
  DASH_CD_MS,
  IDLE,
  defaultShrink,
  FALL_MARGIN,
  MAX_SPEED,
  RESPAWN_MS,
  SKID_MIN,
  SKID_MS,
  axisFromHeld,
  boundaryHit,
  carActive,
  clampVec,
  createWorld,
  dampFactor,
  dropCar,
  edgeDistance,
  endlessLine,
  fieldRadius,
  foesGone,
  formatClock,
  hypot,
  inArc,
  insetAt,
  inPad,
  isPauseKey,
  kineticEnergy,
  keyToAction,
  lastTeamStanding,
  leader,
  levelCleared,
  levelForfeit,
  loseLine,
  makeCar,
  makeHazard,
  matchWinner,
  NO_SHRINK,
  openEdgeAt,
  overlapping,
  playerDown,
  playerKnocks,
  rateLevel,
  resolveCollision,
  respawnSpot,
  secondsLeft,
  separate,
  stepWorld,
  stickVector,
  timeUp,
  totalMomentum,
  turnOf,
  updateHazard,
  versusLine,
  winLine,
  worldEdge,
  type Body,
  type Field,
  type Intent,
} from "./logic";

function body(x: number, y: number, vx: number, vy: number, mass = 1, r = CAR_R): Body {
  return { x, y, vx, vy, r, inv: mass === 0 ? 0 : 1 / mass };
}

function rect(w = 100, h = 70, springs: Field["springs"] = []): Field {
  return { shape: "rect", w, h, springs, arcs: [] };
}

const NO_INPUT: Intent = { dx: 0, dy: 0, dash: false, brake: false };

function hero(x: number, y: number, lives = 1) {
  return makeCar({ id: 0, name: "朵朵", emoji: "🌸", color: "#e8558f", team: 0, x, y, lives });
}

function foe(x: number, y: number, lives = 1, id = 1) {
  return makeCar({ id, name: "糯糯", emoji: "🐰", color: "#f7a9c4", team: 1, x, y, lives });
}

// ---------------------------------------------------------------------------
// 碰撞物理
// ---------------------------------------------------------------------------

describe("弹性碰撞:守恒律", () => {
  it("等质量正碰,总动量一点没变", () => {
    const a = body(0, 0, 20, 0);
    const b = body(CAR_R * 1.5, 0, -6, 0);
    const before = totalMomentum([a, b]);
    const impact = resolveCollision(a, b, 1);
    const after = totalMomentum([a, b]);
    expect(impact).toBeGreaterThan(0);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it("不同质量、斜着撞,动量照样守恒", () => {
    const a = body(0, 0, 14, 9, 1.8);
    const b = body(CAR_R, CAR_R, -3, -11, 0.7);
    const before = totalMomentum([a, b]);
    resolveCollision(a, b, 0.63);
    const after = totalMomentum([a, b]);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it("弹性系数取任何值,动量都守恒", () => {
    for (const e of [0, 0.25, 0.5, 0.75, 1, 1.2]) {
      const a = body(0, 0, 17, -4, 1.3);
      const b = body(CAR_R * 1.2, CAR_R * 0.4, -5, 6, 2.1);
      const before = totalMomentum([a, b]);
      resolveCollision(a, b, e);
      const after = totalMomentum([a, b]);
      expect(after.x, `e=${e}`).toBeCloseTo(before.x, 10);
      expect(after.y, `e=${e}`).toBeCloseTo(before.y, 10);
    }
  });

  it("完全弹性(e=1)时动能也守恒", () => {
    const a = body(0, 0, 22, 5, 1.4);
    const b = body(CAR_R * 1.3, CAR_R * 0.6, -7, 2, 0.9);
    const before = kineticEnergy([a, b]);
    resolveCollision(a, b, 1);
    expect(kineticEnergy([a, b])).toBeCloseTo(before, 8);
  });

  it("弹性系数小于 1 时动能变少(能量被车身吃掉一部分)", () => {
    const a = body(0, 0, 22, 0);
    const b = body(CAR_R * 1.3, 0, -4, 0);
    const before = kineticEnergy([a, b]);
    resolveCollision(a, b, 0.4);
    expect(kineticEnergy([a, b])).toBeLessThan(before);
  });

  it("背对着跑开的两台车不算碰撞", () => {
    const a = body(0, 0, -10, 0);
    const b = body(CAR_R, 0, 10, 0);
    expect(resolveCollision(a, b, 1)).toBe(0);
  });

  it("离得够远就没有碰撞", () => {
    const a = body(0, 0, 10, 0);
    const b = body(CAR_R * 4, 0, -10, 0);
    expect(overlapping(a, b)).toBe(false);
    expect(resolveCollision(a, b, 1)).toBe(0);
  });

  it("两个钉死的物体互相不理会", () => {
    const a = body(0, 0, 5, 0, 0);
    const b = body(CAR_R, 0, -5, 0, 0);
    expect(resolveCollision(a, b, 1)).toBe(0);
  });

  it("撞上钉死的柱子:车被弹开,柱子纹丝不动", () => {
    const car = body(0, 0, 18, 0);
    const pillar = body(CAR_R * 1.4, 0, 0, 0, 0);
    const impact = resolveCollision(car, pillar, 1);
    expect(impact).toBeGreaterThan(0);
    expect(car.vx).toBeLessThan(0);
    expect(pillar.vx).toBe(0);
  });
});

describe("重叠分离", () => {
  it("叠在一起的两台车会被推开,轻的那台退得多", () => {
    const a = body(0, 0, 0, 0, 1);
    const b = body(CAR_R, 0, 0, 0, 3);
    separate(a, b);
    expect(hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(a.r + b.r);
    expect(Math.abs(a.x)).toBeGreaterThan(Math.abs(b.x - CAR_R));
  });

  it("完全重合也不会算出 NaN", () => {
    const a = body(10, 10, 0, 0);
    const b = body(10, 10, 0, 0);
    separate(a, b);
    expect(Number.isFinite(a.x) && Number.isFinite(b.x)).toBe(true);
    expect(hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0);
  });
});

describe("阻尼与限速", () => {
  it("阻尼系数按秒折算:一秒正好掉到设定比例", () => {
    expect(dampFactor(0.5, 1000)).toBeCloseTo(0.5, 10);
    expect(dampFactor(0.5, 500)).toBeCloseTo(Math.SQRT1_2, 10);
    expect(dampFactor(0.5, 0)).toBe(1);
  });

  it("刹车比自然阻尼掉得快得多", () => {
    expect(dampFactor(BRAKE_PER_SEC, 300)).toBeLessThan(dampFactor(DAMP_PER_SEC, 300));
  });

  it("clampVec 只削长度不改方向", () => {
    const v = clampVec(30, 40, 10);
    expect(hypot(v.x, v.y)).toBeCloseTo(10, 10);
    expect(v.y / v.x).toBeCloseTo(40 / 30, 10);
    const keep = clampVec(3, 4, 10);
    expect(keep).toEqual({ x: 3, y: 4 });
  });
});

// ---------------------------------------------------------------------------
// 场地边缘
// ---------------------------------------------------------------------------

describe("场地边缘判定", () => {
  it("方形场地:场内 depth 为负,越界为正", () => {
    const f = rect();
    expect(boundaryHit(f, 50, 35).depth).toBeLessThan(0);
    expect(boundaryHit(f, -3, 35).depth).toBeCloseTo(3, 10);
    expect(boundaryHit(f, 104, 35).depth).toBeCloseTo(4, 10);
  });

  it("方形场地:角上取越界最深的那条边", () => {
    const f = rect();
    const hit = boundaryHit(f, -2, -9);
    expect(hit.depth).toBeCloseTo(9, 10);
    expect(hit.ny).toBe(1);
  });

  it("装了弹簧护栏的边会被标出来", () => {
    const f = rect(100, 70, ["left"]);
    expect(boundaryHit(f, -2, 35).spring).toBe(true);
    expect(boundaryHit(f, 102, 35).spring).toBe(false);
  });

  it("圆形场地按半径判定,法线指向圆心", () => {
    const f: Field = { shape: "round", w: 100, h: 100, springs: [], arcs: [] };
    expect(fieldRadius(f)).toBe(50);
    const hit = boundaryHit(f, 105, 50);
    expect(hit.depth).toBeCloseTo(5, 10);
    expect(hit.nx).toBeCloseTo(-1, 10);
  });

  it("圆形护栏弧段支持跨过 0 度", () => {
    expect(inArc({ from: 0.9, to: 0.1 }, 0.95)).toBe(true);
    expect(inArc({ from: 0.9, to: 0.1 }, 0.05)).toBe(true);
    expect(inArc({ from: 0.9, to: 0.1 }, 0.5)).toBe(false);
    expect(turnOf(-Math.PI)).toBeCloseTo(0.5, 10);
  });

  it("edgeDistance 就是 depth 取反,场内为正", () => {
    const f = rect();
    expect(edgeDistance(f, 50, 35)).toBeCloseTo(35, 10);
    expect(edgeDistance(f, 50, -5)).toBeCloseTo(-5, 10);
  });
});

describe("缩圈:边缘会一圈圈化掉", () => {
  it("开始之前一点都不缩,之后按速度线性往里化,到顶就不再化了", () => {
    const s = { after: 1000, rate: 2, max: 10 };
    expect(insetAt(s, 0)).toBe(0);
    expect(insetAt(s, 1000)).toBe(0);
    expect(insetAt(s, 2000)).toBeCloseTo(2, 10);
    expect(insetAt(s, 4000)).toBeCloseTo(6, 10);
    expect(insetAt(s, 60000)).toBe(10);
    expect(insetAt(NO_SHRINK, 60000)).toBe(0);
  });

  it("默认缩圈表:比赛过半才开始化,时间到那一刻正好化满", () => {
    const f = rect(120, 80);
    const s = defaultShrink(f, 60000);
    expect(insetAt(s, 30000)).toBe(0);
    expect(insetAt(s, 45000)).toBeCloseTo(s.max / 2, 6);
    expect(insetAt(s, 60000)).toBeCloseTo(s.max, 6);
    expect(s.max).toBeCloseTo(20, 6);
  });

  it("方场缩圈后,原本安全的位置会变成场外", () => {
    const f = rect(100, 70);
    expect(edgeDistance(f, 6, 35)).toBeCloseTo(6, 10);
    expect(edgeDistance(f, 6, 35, 10)).toBeCloseTo(-4, 10);
    expect(boundaryHit(f, 6, 35, 10).nx).toBe(1);
  });

  it("圆台缩圈后半径变小,判定跟着往里收", () => {
    const f: Field = { shape: "round", w: 100, h: 100, springs: [], arcs: [] };
    expect(edgeDistance(f, 95, 50)).toBeCloseTo(5, 10);
    expect(edgeDistance(f, 95, 50, 12)).toBeCloseTo(-7, 10);
  });

  it("停在边上不动的车,会被化过来的边缘吃掉", () => {
    const car = hero(6, 35);
    const world = createWorld({
      field: rect(),
      cars: [car],
      limit: 20000,
      shrink: { after: 0, rate: 4, max: 20 },
    });
    for (let t = 0; t < 3000; t += 32) stepWorld(world, 32, [IDLE]);
    expect(world.inset).toBeGreaterThan(6);
    expect(car.out || car.gone).toBe(true);
  });

  it("传了 NO_SHRINK 的场地永远不缩", () => {
    const world = createWorld({ field: rect(), cars: [hero(6, 35)], limit: 20000, shrink: NO_SHRINK });
    for (let t = 0; t < 5000; t += 32) stepWorld(world, 32, [IDLE]);
    expect(world.inset).toBe(0);
    expect(carActive(world.cars[0])).toBe(true);
  });

  it("worldEdge 读的是当前这一刻的边,不是原始场地的边", () => {
    const world = createWorld({ field: rect(), cars: [hero(50, 35)], shrink: { after: 0, rate: 5, max: 12 } });
    expect(worldEdge(world, 10, 35)).toBeCloseTo(10, 10);
    for (let t = 0; t < 1000; t += 32) stepWorld(world, 32, [IDLE]);
    expect(worldEdge(world, 10, 35)).toBeLessThan(6);
  });
});

describe("加速带与移动障碍", () => {
  it("加速带只在矩形范围内生效", () => {
    const pad = { x: 10, y: 10, w: 20, h: 8, dx: 1, dy: 0, power: 40 };
    expect(inPad(pad, 15, 12)).toBe(true);
    expect(inPad(pad, 31, 12)).toBe(false);
  });

  it("滚桶在两个端点之间匀速往返,折返时速度反向", () => {
    const h = makeHazard({ x0: 0, y0: 10, x1: 20, y1: 10, r: 4, speed: 10, phase: 0 });
    updateHazard(h, 0);
    expect(h.x).toBeCloseTo(0, 6);
    updateHazard(h, 1000);
    expect(h.x).toBeCloseTo(10, 6);
    expect(h.vx).toBeCloseTo(10, 6);
    updateHazard(h, 3000);
    expect(h.x).toBeCloseTo(10, 6);
    expect(h.vx).toBeCloseTo(-10, 6);
    updateHazard(h, 4000);
    expect(h.x).toBeCloseTo(0, 6);
  });

  it("速度为 0 的柱子永远待在原地", () => {
    const h = makeHazard({ x0: 30, y0: 30, x1: 30, y1: 30, r: 5, speed: 0, phase: 0.3 });
    updateHazard(h, 12345);
    expect(h.x).toBe(30);
    expect(h.vx).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 一局的推进
// ---------------------------------------------------------------------------

describe("stepWorld:开车", () => {
  it("踩油门会加速,方向也记下来了", () => {
    const car = hero(50, 35);
    const world = createWorld({ field: rect(), cars: [car] });
    stepWorld(world, 32, [{ dx: 1, dy: 0, dash: false, brake: false }]);
    expect(car.vx).toBeGreaterThan(0);
    expect(car.x).toBeGreaterThan(50);
    expect(car.face).toBeCloseTo(0, 6);
  });

  it("油门推不过自驾限速", () => {
    const car = hero(50, 35);
    const world = createWorld({ field: rect(400, 400) });
    world.cars = [car];
    for (let i = 0; i < 200; i++) stepWorld(world, 16, [{ dx: 1, dy: 0, dash: false, brake: false }]);
    expect(hypot(car.vx, car.vy)).toBeLessThanOrEqual(MAX_SPEED + 0.001);
  });

  it("被外力撞飞时允许超速,油门不会把这股劲削掉", () => {
    const car = hero(200, 200);
    const world = createWorld({ field: rect(400, 400), cars: [car] });
    car.vx = MAX_SPEED * 2;
    stepWorld(world, 16, [{ dx: 1, dy: 0, dash: false, brake: false }]);
    expect(car.vx).toBeGreaterThan(MAX_SPEED);
  });

  it("松开油门会被阻尼慢慢拉住", () => {
    const car = hero(50, 35);
    car.vx = 20;
    const world = createWorld({ field: rect(), cars: [car] });
    for (let i = 0; i < 10; i++) stepWorld(world, 32, [NO_INPUT]);
    expect(car.vx).toBeLessThan(20);
    expect(car.vx).toBeGreaterThan(0);
  });

  it("刹车停得比松油门快", () => {
    const a = hero(50, 35);
    const b = hero(50, 35);
    a.vx = 20;
    b.vx = 20;
    const w1 = createWorld({ field: rect(), cars: [a] });
    const w2 = createWorld({ field: rect(), cars: [b] });
    for (let i = 0; i < 8; i++) {
      stepWorld(w1, 32, [NO_INPUT]);
      stepWorld(w2, 32, [{ dx: 0, dy: 0, dash: false, brake: true }]);
    }
    expect(b.vx).toBeLessThan(a.vx);
  });

  it("冲刺给一脚推力,而且有冷却", () => {
    const car = hero(50, 35);
    car.vx = 10;
    const world = createWorld({ field: rect(300, 300), cars: [car] });
    stepWorld(world, 16, [{ dx: 1, dy: 0, dash: true, brake: false }]);
    const boosted = car.vx;
    expect(boosted).toBeGreaterThan(10 + ACCEL * 0.016);
    expect(car.dashCd).toBeGreaterThan(0);
    const before = car.vx;
    stepWorld(world, 16, [{ dx: 1, dy: 0, dash: true, brake: false }]);
    expect(car.vx - before).toBeLessThan(DASH_CD_MS);
    expect(world.events.filter((e) => e.kind === "dash")).toHaveLength(1);
  });

  it("打滑的时候油门几乎使不上劲", () => {
    const a = hero(50, 35);
    const b = hero(50, 35);
    b.skid = SKID_MS;
    const w1 = createWorld({ field: rect(), cars: [a] });
    const w2 = createWorld({ field: rect(), cars: [b] });
    for (let i = 0; i < 4; i++) {
      stepWorld(w1, 32, [{ dx: 1, dy: 0, dash: false, brake: false }]);
      stepWorld(w2, 32, [{ dx: 1, dy: 0, dash: false, brake: false }]);
    }
    expect(b.vx).toBeLessThan(a.vx * 0.6);
  });

  it("重撞会让双方一起打滑", () => {
    const a = hero(50, 35);
    const b = foe(50 + CAR_R * 1.6, 35);
    a.vx = MAX_SPEED;
    b.vx = -MAX_SPEED;
    const world = createWorld({ field: rect(), cars: [a, b] });
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(Math.max(a.skid, b.skid)).toBeGreaterThan(0);
    expect(world.events.some((e) => e.kind === "bump")).toBe(true);
  });

  it("踩上加速带会被推一把", () => {
    const car = hero(20, 35);
    const world = createWorld({
      field: rect(),
      cars: [car],
      pads: [{ x: 10, y: 25, w: 30, h: 20, dx: 1, dy: 0, power: 120 }],
    });
    for (let i = 0; i < 8; i++) stepWorld(world, 32, [NO_INPUT]);
    expect(car.vx).toBeGreaterThan(5);
    expect(world.events.some((e) => e.kind === "boost")).toBe(true);
  });
});

describe("stepWorld:掉出场地", () => {
  it("越过开放边就算掉下去,功劳记给最后把它往悬崖顶的人", () => {
    // 1.2 起是两段式:先在台沿上打转,松着手不管,两秒到了才真的下去。
    const a = hero(50, 35);
    const b = foe(50, 35, 1);
    const world = createWorld({ field: rect(), cars: [a, b] });
    b.x = 99;
    b.y = 35;
    b.lastPushBy = a.id;
    b.lastPushAt = world.time;
    b.vx = 40;
    for (let i = 0; i < 100 && !b.gone; i++) stepWorld(world, 32, [NO_INPUT, NO_INPUT]);
    expect(b.gone).toBe(true);
    expect(a.score).toBe(1);
    expect(levelCleared(world)).toBe(true);
  });

  it("对手一头撞在停着不动的车上、再自己开下悬崖:这一台不算停着那位撞飞的", () => {
    // 第 3 轮 S5:玩家零输入,结算却写「撞飞 1 台对手车」。
    // 右边是悬崖,玩家停在场地中间不动,对手从左边一头撞上来再自己冲出去。
    const a = hero(60, 35);
    const b = foe(60 - CAR_R * 2, 35, 1);
    b.vx = MAX_SPEED;
    const world = createWorld({ field: rect(100, 70, ["top", "bottom"]), cars: [a, b] });
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(b.lastPushBy, "撞上来的那一下不该给停着的车记功").toBe(-1);
    // 撞完之后把它挪到台沿上,松手让它自己滑下去
    b.x = 100 - FALL_MARGIN * 0.5;
    b.y = 35;
    for (let i = 0; i < 200 && !b.gone; i++) stepWorld(world, 32, [NO_INPUT, NO_INPUT]);
    expect(b.gone).toBe(true);
    expect(a.score, "对手自己下的场,却记在玩家头上").toBe(0);
    expect(world.events.some((e) => e.kind === "out" && e.by === 0)).toBe(false);
  });

  it("把它顶回场地里侧的那一撞是帮忙,不是功劳", () => {
    // 对手贴着右侧悬崖,玩家从外侧往场内顶它——这一下不该记成撞飞
    const a = hero(96, 35);
    const b = foe(96 - CAR_R * 2, 35, 1);
    a.vx = -MAX_SPEED;
    const world = createWorld({ field: rect(100, 70, ["top", "bottom"]), cars: [a, b] });
    stepWorld(world, 16, [{ dx: -1, dy: 0, dash: false, brake: false }, NO_INPUT]);
    expect(b.lastPushBy).toBe(-1);
  });

  it("被撞得满场飞、恰好撞到别人身上,也不算自己的战绩", () => {
    // 玩家这一帧一个键都没按,只是带着速度滑过去
    const a = hero(60 - CAR_R * 2, 35);
    const b = foe(60, 35, 1);
    a.vx = MAX_SPEED;
    const world = createWorld({ field: rect(100, 70, ["top", "bottom"]), cars: [a, b] });
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(b.lastPushBy).toBe(-1);
    // 换成踩着油门顶上去,同样的一撞就算数了
    const c = hero(60 - CAR_R * 2, 35);
    const d = foe(60, 35, 1);
    c.vx = MAX_SPEED;
    const w2 = createWorld({ field: rect(100, 70, ["top", "bottom"]), cars: [c, d] });
    stepWorld(w2, 16, [{ dx: 1, dy: 0, dash: false, brake: false }, NO_INPUT]);
    expect(d.lastPushBy).toBe(c.id);
  });

  it("自己冲下去不给对手加分", () => {
    const a = hero(50, 35, 2);
    const b = foe(50, 35);
    const world = createWorld({ field: rect(), cars: [a, b] });
    a.x = 105;
    for (let i = 0; i < 100 && !a.out; i++) stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(a.out).toBe(true);
    expect(b.score).toBe(0);
    expect(a.falls).toBe(1);
  });

  it("openEdgeAt 只认没装护栏的那几条边", () => {
    // 左右有护栏,上下是悬崖:站在最靠近左护栏的地方,最近的悬崖仍是上边
    const only = openEdgeAt(rect(100, 70, ["left", "right"]), 2, 20);
    expect(only?.oy).toBe(-1);
    expect(only?.dist).toBe(20);
    // 四面都是护栏就没有悬崖
    expect(openEdgeAt(rect(100, 70, ["left", "right", "top", "bottom"]), 2, 2)).toBe(null);
    // 圆台:车所在的方位角落在护栏弧段上就不算悬崖
    const round: Field = { shape: "round", w: 100, h: 100, springs: [], arcs: [{ from: 0.9, to: 0.1 }] };
    expect(openEdgeAt(round, 90, 50)).toBe(null);
    expect(openEdgeAt(round, 10, 50)?.ox).toBeCloseTo(-1, 6);
  });

  it("弹簧护栏那一边只会把车弹回来", () => {
    const car = hero(2, 35);
    const world = createWorld({ field: rect(100, 70, ["left"]), cars: [car] });
    car.x = -1;
    car.vx = -30;
    stepWorld(world, 16, [NO_INPUT]);
    expect(car.out).toBe(false);
    expect(car.x).toBeGreaterThanOrEqual(0);
    expect(car.vx).toBeGreaterThan(0);
    expect(world.events.some((e) => e.kind === "wall")).toBe(true);
  });

  it("车轮压线但没越过 FALL_MARGIN 时还有救", () => {
    const car = hero(50, 35);
    const world = createWorld({ field: rect(), cars: [car] });
    car.x = 100 + FALL_MARGIN * 0.5;
    stepWorld(world, 16, [NO_INPUT]);
    expect(car.out).toBe(false);
  });

  it("还有命就复活,复活点在场内", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    dropCar(world, 0);
    expect(car.out).toBe(true);
    expect(carActive(car)).toBe(false);
    for (let i = 0; i < RESPAWN_MS / 32 + 2; i++) stepWorld(world, 32, [NO_INPUT]);
    expect(car.out).toBe(false);
    expect(edgeDistance(world.field, car.x, car.y)).toBeGreaterThan(CAR_R);
    expect(world.events.some((e) => e.kind === "respawn")).toBe(true);
  });

  it("复活点会挑一个离别人远的位置", () => {
    const a = hero(50, 35, 2);
    const b = foe(50, 35);
    const world = createWorld({ field: rect(), cars: [a, b] });
    const spot = respawnSpot(world, a);
    expect(edgeDistance(world.field, spot.x, spot.y)).toBeGreaterThan(CAR_R * 2 - 0.001);
    expect(hypot(spot.x - b.x, spot.y - b.y)).toBeGreaterThan(CAR_R * 2);
  });
});

describe("胜负与计时", () => {
  it("对手全退场又是玩家顶下去的才算通关,自己全退场算失败", () => {
    const a = hero(50, 35);
    const b = foe(50, 35);
    const world = createWorld({ field: rect(), cars: [a, b] });
    expect(levelCleared(world)).toBe(false);
    expect(playerDown(world)).toBe(false);
    // 这一下记在玩家名下:场面清空 = 通关
    b.lastPushBy = a.id;
    b.lastPushAt = world.time;
    dropCar(world, 1);
    expect(a.score).toBe(1);
    expect(foesGone(world)).toBe(true);
    expect(levelCleared(world)).toBe(true);
    expect(levelForfeit(world)).toBe(false);
    dropCar(world, 0);
    expect(playerDown(world)).toBe(true);
  });

  it("对手自己开下去、把场面清空了也不算玩家赢", () => {
    // 附录 C 点名的那条口子:电脑车互相顶,一台被另一台顶下去就等于替玩家清场。
    const a = hero(50, 35);
    const b = foe(50, 35);
    const c = makeCar({ id: 2, name: "云云", emoji: "☁️", color: "#8fb8e8", team: 1, x: 70, y: 35 });
    const world = createWorld({ field: rect(), cars: [a, b, c] });
    // 一台自己开下去,另一台被队友顶下去:两次出局都不该记到玩家头上
    dropCar(world, 1);
    c.lastPushBy = b.id;
    c.lastPushAt = world.time;
    dropCar(world, 2);
    expect(playerKnocks(world)).toBe(0);
    expect(foesGone(world), "场面确实清空了").toBe(true);
    expect(levelCleared(world), "一台都没撞飞却判了通关").toBe(false);
    expect(levelForfeit(world)).toBe(true);
  });

  it("对战里只剩一队还有车时分出胜负", () => {
    const a = hero(30, 35);
    const b = makeCar({ id: 1, name: "星星", emoji: "⭐", color: "#3f7fd6", team: 1, x: 70, y: 35 });
    const world = createWorld({ field: rect(), cars: [a, b] });
    expect(lastTeamStanding(world)).toBe(-1);
    dropCar(world, 1);
    expect(lastTeamStanding(world)).toBe(0);
  });

  it("限时会走完并报出剩余秒数", () => {
    const world = createWorld({ field: rect(), cars: [hero(50, 35)], limit: 2000 });
    expect(secondsLeft(world)).toBe(2);
    stepWorld(world, 32, [NO_INPUT]);
    expect(timeUp(world)).toBe(false);
    for (let i = 0; i < 100; i++) stepWorld(world, 32, [NO_INPUT]);
    expect(timeUp(world)).toBe(true);
    expect(secondsLeft(world)).toBe(0);
  });

  it("一帧最多推进 32 毫秒,切后台回来不会瞬移", () => {
    const car = hero(50, 35);
    car.vx = MAX_SPEED;
    const world = createWorld({ field: rect(400, 400), cars: [car] });
    stepWorld(world, 5000, [NO_INPUT]);
    expect(world.time).toBeLessThanOrEqual(32);
    expect(car.x).toBeLessThan(200 + MAX_SPEED * 0.033 + 0.01);
  });
});

describe("赛制与评分", () => {
  it("先拿到目标分的那一队夺冠", () => {
    expect(matchWinner([2, 1], 3)).toBe(-1);
    expect(matchWinner([3, 1], 3)).toBe(0);
    expect(matchWinner([1, 4], 3)).toBe(1);
  });

  it("时间到按比分判,打平返回 -1", () => {
    expect(leader([2, 1])).toBe(0);
    expect(leader([1, 2])).toBe(1);
    expect(leader([2, 2])).toBe(-1);
  });

  it("评星:又快又稳三星,掉过一次两星,勉强过关一星", () => {
    expect(rateLevel(60, 100, 0, 2)).toBe(3);
    expect(rateLevel(20, 100, 1, 2)).toBe(2);
    expect(rateLevel(2, 100, 3, 2)).toBe(1);
    expect(rateLevel(90, 100, 2, 2)).toBe(1);
  });

  it("一台都没撞飞的那一关最多一星:星星不能是坐在旁边等来的", () => {
    expect(rateLevel(90, 100, 0, 0)).toBe(1);
    expect(rateLevel(90, 100, 0, 1)).toBe(3);
  });
});

describe("文案", () => {
  it("过关的话会把成绩说清楚", () => {
    expect(winLine(30, 0, 3)).toContain("3");
    expect(winLine(10, 2, 4)).toContain("2");
  });

  it("一台都没撞飞就不写「撞飞 N 台」,更不夸走位和刹车", () => {
    for (const line of [winLine(65, 0, 0), winLine(20, 2, 0)]) {
      expect(line).not.toMatch(/撞飞 \d+ 台/);
      expect(line).not.toContain("走位和刹车");
      expect(line).toContain("对手自己开下了悬崖");
      expect(line).toContain("一台都没撞飞");
    }
    // 真撞飞了才发那句表扬
    expect(winLine(65, 0, 1)).toContain("撞飞 1 台");
    expect(winLine(65, 0, 1)).toContain("走位和刹车");
  });

  it("失败文案只鼓励,不批评", () => {
    for (const line of [loseLine("fall"), loseLine("time"), loseLine("empty")]) {
      expect(line.length).toBeGreaterThan(10);
      for (const bad of ["笨", "不行", "太差", "又输"]) expect(line).not.toContain(bad);
    }
  });

  it("对手自己下场的那一关:如实说清楚,不夸没做过的事", () => {
    const line = loseLine("empty");
    expect(line).toContain("自己开下悬崖");
    expect(line).toContain("一台都没顶出场");
    expect(line).not.toMatch(/撞飞 \d+ 台/);
    expect(line).not.toContain("走位和刹车");
  });

  it("对战与无尽的成绩播报都带上数字", () => {
    expect(versusLine([2, 1], ["朵朵", "星星"])).toBe("朵朵 2 比 1 星星");
    expect(endlessLine(5, 4)).toContain("5");
    expect(endlessLine(2, 6)).toContain("6");
  });
});

describe("键位与摇杆", () => {
  it("朵朵是 WASD + F/G,星星是方向键 + L/K", () => {
    expect(keyToAction("KeyW", 2)).toEqual({ player: 0, action: "up" });
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "dash" });
    expect(keyToAction("KeyG", 2)).toEqual({ player: 0, action: "brake" });
    expect(keyToAction("ArrowLeft", 2)).toEqual({ player: 1, action: "left" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "dash" });
    expect(keyToAction("KeyK", 2)).toEqual({ player: 1, action: "brake" });
    expect(keyToAction("KeyZ", 2)).toBeNull();
  });

  it("一个人玩的时候两套键位都归自己", () => {
    expect(keyToAction("ArrowUp", 1)).toEqual({ player: 0, action: "up" });
    expect(keyToAction("KeyL", 1)).toEqual({ player: 0, action: "dash" });
  });

  it("Esc 是暂停键", () => {
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyP")).toBe(false);
  });

  it("斜着按两个方向不会比直着走更快", () => {
    const straight = axisFromHeld([true, false, false, false]);
    const diagonal = axisFromHeld([true, true, false, false]);
    expect(hypot(straight.dx, straight.dy)).toBeCloseTo(1, 10);
    expect(hypot(diagonal.dx, diagonal.dy)).toBeCloseTo(1, 10);
    expect(axisFromHeld([true, false, true, false])).toEqual({ dx: 0, dy: 0 });
  });

  it("虚拟摇杆有死区,推到底也只算满舵", () => {
    expect(stickVector(2, 0, 40)).toEqual({ dx: 0, dy: 0 });
    const full = stickVector(90, 0, 40);
    expect(full.dx).toBeCloseTo(1, 10);
    const half = stickVector(20, 0, 40);
    expect(half.dx).toBeCloseTo(0.5, 10);
  });

  it("计时器按 mm:ss 显示", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("打滑门槛", () => {
  it("轻轻蹭一下不会打滑", () => {
    const a = hero(50, 35);
    const b = foe(50 + CAR_R * 1.9, 35);
    a.vx = 3;
    const world = createWorld({ field: rect(), cars: [a, b] });
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(a.skid).toBe(0);
    expect(b.skid).toBe(0);
    expect(SKID_MIN).toBeGreaterThan(0);
  });
});
