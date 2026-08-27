// 碰碰车大乱斗 · 1.2 升级件单测。
//
// 1.1 那批用例继续管着「地基」(动量守恒、边缘判定、188 关体检),
// 这一份只管 1.2 新长出来的六块东西,一块一块钉死:
//   ① 恢复系数被夹在 0.6–0.8;② 挨重撞后 0.3 秒失控旋转;③ 蓄力强撞(前摇 + 冷却);
//   ④ 三种场地机关(弹簧墙 / 旋转盘 / 油渍);⑤ 出界两段式(先打转两秒);⑥ 电脑车手四档。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AI_LABEL, AI_LEVELS, TRAITS, chooseCarAction, pickTarget, type AiLevel } from "./ai";
import { buildLevel, buildWave, waveSkill } from "./levels";
import {
  CHARGE_BOOST_MS,
  CHARGE_CD_MS,
  CHARGE_KICK_MAX,
  CHARGE_KICK_MIN,
  CHARGE_MIN_MS,
  CHARGE_MS,
  CAR_BOUNCE,
  DASH_BOUNCE,
  DEEP_MARGIN,
  ENDLESS_REVIVES,
  E_MAX,
  E_MIN,
  FALL_MARGIN,
  LIP_KO_IMPACT,
  SKID_MIN,
  SPIN_FULL_IMPACT,
  SPIN_MS,
  SPIN_TURNS_MAX,
  SPIN_TURNS_MIN,
  TEETER_CRAWL,
  TEETER_MS,
  TEETER_SLIDE,
  boundaryHit,
  chargeKick,
  chargeRatio,
  clampRestitution,
  createWorld,
  dropCar,
  hypot,
  keyToAction,
  makeCar,
  onSlick,
  onSpinner,
  resolveCollision,
  slickKeepAt,
  spinFaceAt,
  spinRateFor,
  springBounce,
  spinnerEffect,
  stepWorld,
  teeterCrawl,
  totalMomentum,
  type Body,
  type Field,
  type Intent,
  type Slick,
  type Spinner,
} from "./logic";

function rect(w = 100, h = 70, springs: Field["springs"] = []): Field {
  return { shape: "rect", w, h, springs, arcs: [] };
}

function hero(x: number, y: number, lives = 1) {
  return makeCar({ id: 0, name: "鸭梨", emoji: "🍐", color: "#e8558f", team: 0, x, y, lives });
}

function foe(x: number, y: number, lives = 1, id = 1) {
  return makeCar({ id, name: "糯糯", emoji: "🐰", color: "#f7a9c4", team: 1, x, y, lives });
}

const NO_INPUT: Intent = { dx: 0, dy: 0, dash: false, brake: false };
/** 往场内(左)推满舵 */
const PUSH_IN: Intent = { dx: -1, dy: 0, dash: false, brake: false };
/** 往场外(右)推满舵:顶人下场的那一下 */
const PUSH_OUT: Intent = { dx: 1, dy: 0, dash: false, brake: false };

function body(x: number, y: number, vx: number, vy: number, mass = 1): Body {
  return { x, y, vx, vy, r: 4.2, inv: 1 / mass };
}

// ---------------------------------------------------------------------------
// ① 恢复系数 0.6–0.8
// ---------------------------------------------------------------------------

describe("1.2 · 恢复系数被夹在 0.6–0.8 之间", () => {
  it("超出上下限的值会被夹回来,非数字取中间值", () => {
    expect(clampRestitution(0.1)).toBe(E_MIN);
    expect(clampRestitution(1.5)).toBe(E_MAX);
    expect(clampRestitution(0.7)).toBeCloseTo(0.7, 10);
    expect(clampRestitution(Number.NaN)).toBeCloseTo((E_MIN + E_MAX) / 2, 10);
  });

  it("车对车用的两个系数(普通撞 / 冲刺撞)本身就在范围内", () => {
    for (const e of [CAR_BOUNCE, DASH_BOUNCE]) {
      expect(e).toBeGreaterThanOrEqual(E_MIN);
      expect(e).toBeLessThanOrEqual(E_MAX);
    }
  });

  it("夹过之后的碰撞照样动量守恒,而且撞完动能只会变少", () => {
    for (const raw of [0.2, 0.6, 0.75, 0.8, 2]) {
      const a = body(0, 0, 24, 6, 1.4);
      const b = body(8, 1, -6, 0, 0.9);
      const before = totalMomentum([a, b]);
      const beforeE = 0.5 * 1.4 * (24 * 24 + 6 * 6) + 0.5 * 0.9 * 36;
      resolveCollision(a, b, clampRestitution(raw));
      const after = totalMomentum([a, b]);
      const afterE = 0.5 * 1.4 * (a.vx * a.vx + a.vy * a.vy) + 0.5 * 0.9 * (b.vx * b.vx + b.vy * b.vy);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
      expect(afterE).toBeLessThanOrEqual(beforeE + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// ② 0.3 秒失控旋转
// ---------------------------------------------------------------------------

describe("1.2 · 挨重撞会失控旋转 0.3 秒", () => {
  it("撞得越狠转得越快,到顶就不再快了", () => {
    const soft = spinRateFor(SPIN_FULL_IMPACT * 0.2, 1);
    const hard = spinRateFor(SPIN_FULL_IMPACT, 1);
    const over = spinRateFor(SPIN_FULL_IMPACT * 5, 1);
    expect(soft).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(soft);
    expect(over).toBeCloseTo(hard, 10);
    expect(Math.abs(hard) / (Math.PI * 2)).toBeCloseTo(SPIN_TURNS_MAX, 10);
    expect(Math.abs(spinRateFor(0, 1)) / (Math.PI * 2)).toBeCloseTo(SPIN_TURNS_MIN, 10);
  });

  it("正负号决定往哪边转,两台车转的方向相反", () => {
    expect(spinRateFor(20, -1)).toBeCloseTo(-spinRateFor(20, 1), 10);
  });

  it("spinFaceAt 是纯函数:同样的时间一定得到同样的车头朝向", () => {
    const rate = spinRateFor(30, 1);
    expect(spinFaceAt(0, rate, 1000)).toBeCloseTo(rate, 10);
    expect(spinFaceAt(0.5, rate, 0)).toBeCloseTo(0.5, 10);
    expect(spinFaceAt(0.5, rate, -50)).toBeCloseTo(0.5, 10);
  });

  it("一记重撞真的会把双方都打进 0.3 秒的失控旋转", () => {
    const a = hero(50, 35);
    const b = foe(56, 35);
    a.vx = 30;
    const world = createWorld({ field: rect(), cars: [a, b] });
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(a.spin).toBeGreaterThan(0);
    expect(b.spin).toBeGreaterThan(0);
    expect(a.spin).toBeLessThanOrEqual(SPIN_MS);
    // 转到时间就自己停,车头也不再乱飘
    for (let i = 0; i < 40; i++) stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(b.spin).toBe(0);
    expect(b.spinRate).toBe(0);
  });

  it("轻轻蹭一下不会失控旋转", () => {
    const a = hero(50, 35);
    const b = foe(58.2, 35);
    a.vx = SKID_MIN * 0.2;
    const world = createWorld({ field: rect(), cars: [a, b] });
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(b.spin).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ③ 蓄力强撞
// ---------------------------------------------------------------------------

describe("1.2 · 蓄力强撞:有前摇也有冷却", () => {
  it("蓄力量按住的时间线性涨,0.8 秒封顶", () => {
    expect(chargeRatio(0)).toBe(0);
    expect(chargeRatio(CHARGE_MS / 2)).toBeCloseTo(0.5, 10);
    expect(chargeRatio(CHARGE_MS)).toBe(1);
    expect(chargeRatio(CHARGE_MS * 3)).toBe(1);
  });

  it("没按够最短时间就松手,什么也放不出来(手一抖不会白交冷却)", () => {
    expect(chargeKick(CHARGE_MIN_MS - 1)).toBe(0);
    expect(chargeKick(CHARGE_MIN_MS)).toBeGreaterThan(0);
    expect(chargeKick(CHARGE_MS)).toBeCloseTo(CHARGE_KICK_MAX, 10);
    expect(chargeKick(CHARGE_MIN_MS)).toBeGreaterThanOrEqual(CHARGE_KICK_MIN);
    expect(chargeKick(CHARGE_MS * 0.5)).toBeLessThan(chargeKick(CHARGE_MS));
  });

  it("按住的时候车明显慢下来:这就是给对手看的前摇", () => {
    const plain = hero(20, 35);
    const holding = hero(20, 50);
    const world = createWorld({ field: rect(), cars: [plain, holding] });
    const go: Intent = { dx: 1, dy: 0, dash: false, brake: false };
    for (let i = 0; i < 12; i++) stepWorld(world, 16, [go, { ...go, charge: true }]);
    expect(holding.charge).toBeGreaterThan(0);
    expect(hypot(holding.vx, holding.vy)).toBeLessThan(hypot(plain.vx, plain.vy) * 0.8);
  });

  it("松手那一下真的推出去了,而且立刻进冷却", () => {
    const car = hero(20, 35);
    const world = createWorld({ field: rect(), cars: [car] });
    const go: Intent = { dx: 1, dy: 0, dash: false, brake: false };
    for (let i = 0; i < 60; i++) stepWorld(world, 16, [{ ...go, charge: true }]);
    const held = car.charge;
    const before = hypot(car.vx, car.vy);
    stepWorld(world, 16, [go]);
    expect(held).toBeCloseTo(CHARGE_MS, 5);
    expect(hypot(car.vx, car.vy)).toBeGreaterThan(before + CHARGE_KICK_MAX * 0.5);
    expect(car.charge).toBe(0);
    expect(car.chargeCd).toBeCloseTo(CHARGE_CD_MS, 5);
    expect(car.dashT).toBeGreaterThanOrEqual(CHARGE_BOOST_MS - 16);
    expect(world.events.some((e) => e.kind === "charge")).toBe(true);
  });

  it("冷却没走完就攒不起来,冷却一到又能攒了", () => {
    const car = hero(20, 35);
    const world = createWorld({ field: rect(), cars: [car] });
    car.chargeCd = 400;
    stepWorld(world, 16, [{ dx: 1, dy: 0, dash: false, brake: false, charge: true }]);
    expect(car.charge).toBe(0);
    for (let i = 0; i < 30; i++) stepWorld(world, 16, [NO_INPUT]);
    expect(car.chargeCd).toBe(0);
    stepWorld(world, 16, [{ dx: 1, dy: 0, dash: false, brake: false, charge: true }]);
    expect(car.charge).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ④ 三种场地机关
// ---------------------------------------------------------------------------

describe("1.2 · 场地机关之一:弹簧墙", () => {
  it("往外撞才会被弹,往里开不受影响", () => {
    expect(springBounce(-10)).toBeGreaterThan(10);
    expect(springBounce(6)).toBe(6);
    expect(springBounce(0)).toBe(0);
    expect(springBounce(-10, 0.5)).toBeCloseTo(5, 10);
  });
});

describe("1.2 · 场地机关之二:旋转盘", () => {
  const sp: Spinner = { x: 50, y: 35, r: 10, rate: 0.5, push: 12 };

  it("只有站在盘子上才吃得到效果", () => {
    expect(onSpinner(sp, 50, 35)).toBe(true);
    expect(onSpinner(sp, 50, 44.9)).toBe(true);
    expect(onSpinner(sp, 50, 46)).toBe(false);
    const off = spinnerEffect(sp, 50, 46, 16);
    expect(off).toEqual({ faceDelta: 0, ax: 0, ay: 0 });
  });

  it("车头按盘子的转速转,推力是切向的(不会把车往盘心吸也不会往外甩)", () => {
    const eff = spinnerEffect(sp, 56, 35, 1000);
    expect(eff.faceDelta).toBeCloseTo(sp.rate * Math.PI * 2, 10);
    // 切向 = 与半径垂直
    const dot = eff.ax * 6 + eff.ay * 0;
    expect(dot).toBeCloseTo(0, 10);
    expect(hypot(eff.ax, eff.ay)).toBeCloseTo(sp.push, 10);
  });

  it("反向盘子把车头往另一边转", () => {
    const back: Spinner = { ...sp, rate: -0.5 };
    expect(spinnerEffect(back, 56, 35, 1000).faceDelta).toBeCloseTo(-sp.rate * Math.PI * 2, 10);
  });

  it("正好停在盘心时只转车头,不会算出 NaN", () => {
    const eff = spinnerEffect(sp, sp.x, sp.y, 100);
    expect(eff.ax).toBe(0);
    expect(eff.ay).toBe(0);
    expect(Number.isFinite(eff.faceDelta)).toBe(true);
  });

  it("接进世界之后,踩上盘子的车真的会被带着转", () => {
    const car = hero(56, 35);
    const world = createWorld({ field: rect(), cars: [car], spinners: [sp] });
    const face0 = car.face;
    stepWorld(world, 32, [NO_INPUT]);
    expect(car.face).not.toBe(face0);
    expect(world.events.some((e) => e.kind === "spinner")).toBe(true);
  });
});

describe("1.2 · 场地机关之三:油渍", () => {
  const oil: Slick = { x: 50, y: 35, r: 12, keep: 0.9 };

  it("只有踩在油上摩擦才变小,踩到好几摊算最滑的那摊", () => {
    expect(onSlick(oil, 50, 35)).toBe(true);
    expect(onSlick(oil, 50, 48)).toBe(false);
    expect(slickKeepAt([oil], 50, 48, 0.5)).toBe(0.5);
    expect(slickKeepAt([oil], 50, 35, 0.5)).toBeCloseTo(0.9, 10);
    expect(slickKeepAt([oil, { ...oil, keep: 0.95 }], 50, 35, 0.5)).toBeCloseTo(0.95, 10);
  });

  it("再滑也滑不过 0.995,车最终一定停得下来", () => {
    expect(slickKeepAt([{ ...oil, keep: 1 }], 50, 35, 0.5)).toBeLessThanOrEqual(0.995);
  });

  it("接进世界之后,同样松手滑行,踩到油的那台滑得明显更远", () => {
    const dry = hero(20, 20);
    const wet = hero(20, 50);
    dry.vx = 24;
    wet.vx = 24;
    const world = createWorld({ field: rect(), cars: [dry, wet], slicks: [{ x: 40, y: 50, r: 22, keep: 0.94 }] });
    const x0 = wet.x;
    for (let i = 0; i < 40; i++) stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(wet.x - x0).toBeGreaterThan(dry.x - 20);
    expect(world.events.some((e) => e.kind === "slick")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ⑤ 出界两段式
// ---------------------------------------------------------------------------

describe("1.2 · 出界两段式:先打转两秒", () => {
  it("蹭出场边的第一下只是打转,人还在场上", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    car.x = 100 + FALL_MARGIN + 0.2;
    stepWorld(world, 16, [NO_INPUT]);
    expect(car.out).toBe(false);
    expect(car.teeter).toBeCloseTo(TEETER_MS, 5);
    expect(car.teeters).toBe(1);
    expect(world.events.some((e) => e.kind === "teeter")).toBe(true);
  });

  it("两秒里撒手不管,时间一到才滑出场外", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    car.x = 100 + FALL_MARGIN + 0.2;
    let elapsed = 0;
    while (!car.out && elapsed < 6000) {
      stepWorld(world, 16, [NO_INPUT]);
      elapsed += 16;
    }
    expect(car.out).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(TEETER_MS);
    expect(elapsed).toBeLessThan(TEETER_MS + 400);
  });

  it("这两秒里把方向推满就能自己开回场上", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    car.x = 100 + FALL_MARGIN + 0.2;
    stepWorld(world, 16, [PUSH_IN]);
    expect(car.teeter).toBeGreaterThan(0);
    for (let i = 0; i < 120 && car.teeter > 0; i++) stepWorld(world, 16, [PUSH_IN]);
    expect(car.out).toBe(false);
    expect(car.teeter).toBe(0);
    expect(boundaryHit(world.field, car.x, car.y, 0).depth).toBeLessThanOrEqual(0);
    expect(world.events.some((e) => e.kind === "rescue")).toBe(true);
  });

  it("方向推得不够满就蹭不回来:蹭回来的速度按摇杆压得多满算", () => {
    expect(teeterCrawl(1)).toBeCloseTo(TEETER_CRAWL - TEETER_SLIDE, 10);
    expect(teeterCrawl(0)).toBeCloseTo(-TEETER_SLIDE, 10);
    expect(teeterCrawl(-1)).toBeCloseTo(-TEETER_SLIDE, 10);
    expect(teeterCrawl(2)).toBeCloseTo(teeterCrawl(1), 10);
    expect(teeterCrawl(0.5)).toBeLessThan(teeterCrawl(1));
  });

  it("打转的时候再被结结实实往外顶一下,立刻出局", () => {
    const a = hero(96, 35, 2);
    const b = foe(80, 35, 1);
    const world = createWorld({ field: rect(), cars: [a, b] });
    a.x = 100 + FALL_MARGIN + 0.2;
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(a.teeter).toBeGreaterThan(0);
    // 对手从场内踩着油门一记重撞:方向朝外,冲击远超门槛
    b.x = a.x - (a.r + b.r) * 0.95;
    b.y = a.y;
    b.vx = 40;
    stepWorld(world, 16, [NO_INPUT, PUSH_OUT]);
    expect(a.out).toBe(true);
    expect(b.score).toBe(1);
  });

  it("打转的时候被轻轻蹭一下不算出局,只是白蹭掉一点距离", () => {
    const a = hero(96, 35, 2);
    const b = foe(80, 35, 1);
    const world = createWorld({ field: rect(), cars: [a, b] });
    a.x = 100 + FALL_MARGIN + 0.2;
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    b.x = a.x - (a.r + b.r) * 0.95;
    b.y = a.y;
    b.vx = LIP_KO_IMPACT * 0.4;
    stepWorld(world, 16, [NO_INPUT, NO_INPUT]);
    expect(a.out).toBe(false);
    expect(a.teeter).toBeGreaterThan(0);
  });

  it("整台车都被顶到台沿外面就不用等两秒了", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    car.x = 100 + FALL_MARGIN + 0.2;
    stepWorld(world, 16, [NO_INPUT]);
    expect(car.teeter).toBeGreaterThan(0);
    car.x = 100 + DEEP_MARGIN + 0.5;
    stepWorld(world, 16, [NO_INPUT]);
    expect(car.out).toBe(true);
  });

  it("弹簧护栏那一边不会让人打转:撞上去直接弹回场内", () => {
    const car = hero(2, 35, 2);
    const world = createWorld({ field: rect(100, 70, ["left"]), cars: [car] });
    car.x = -FALL_MARGIN - 1;
    car.vx = -30;
    stepWorld(world, 16, [NO_INPUT]);
    expect(car.teeter).toBe(0);
    expect(car.out).toBe(false);
    expect(car.vx).toBeGreaterThan(0);
  });

  it("真的出局时,打转 / 蓄力 / 旋转的状态都会被清干净", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    car.teeter = 500;
    car.charge = 300;
    car.spin = 200;
    car.spinRate = 4;
    dropCar(world, 0);
    expect(car.teeter).toBe(0);
    expect(car.charge).toBe(0);
    expect(car.spin).toBe(0);
    expect(car.spinRate).toBe(0);
    expect(car.out).toBe(true);
  });

  it("复活之后是一台干干净净的车,不会带着上一次的打转状态回来", () => {
    const car = hero(50, 35, 2);
    const world = createWorld({ field: rect(), cars: [car] });
    car.x = 100 + FALL_MARGIN + 0.2;
    for (let i = 0; i < 400 && !car.out; i++) stepWorld(world, 16, [NO_INPUT]);
    expect(car.out).toBe(true);
    for (let i = 0; i < 200 && car.out; i++) stepWorld(world, 16, [NO_INPUT]);
    expect(car.out).toBe(false);
    expect(car.teeter).toBe(0);
    expect(car.spin).toBe(0);
    expect(car.charge).toBe(0);
  });

  it("无尽模式一台车一共有三次上场机会", () => {
    expect(ENDLESS_REVIVES).toBe(3);
    expect(buildWave(1).hearts).toBe(ENDLESS_REVIVES);
    expect(buildWave(9).hearts).toBe(ENDLESS_REVIVES);
  });
});

// ---------------------------------------------------------------------------
// ⑥ 电脑车手四档
// ---------------------------------------------------------------------------

describe("1.2 · 电脑车手四档", () => {
  it("四档都有自己的中文名,顺序表也是四条", () => {
    expect(AI_LEVELS).toEqual([1, 2, 3, 4]);
    const labels = AI_LEVELS.map((l) => AI_LABEL[l]);
    expect(new Set(labels).size).toBe(4);
  });

  it("四档比三档更会看悬崖、手更稳、预判更远", () => {
    expect(TRAITS[4].edgeCare).toBeGreaterThan(TRAITS[3].edgeCare);
    expect(TRAITS[4].jitter).toBeLessThan(TRAITS[3].jitter);
    expect(TRAITS[4].react).toBeGreaterThan(TRAITS[3].react);
    expect(TRAITS[4].lead).toBeGreaterThan(TRAITS[3].lead);
    expect(TRAITS[4].chargeUp).toBe(true);
    expect(TRAITS[4].corner).toBe(true);
    expect(TRAITS[1].chargeUp).toBe(false);
  });

  it("档位越高,挂在台沿上越使得出劲(这就是四档最难被顶下去的原因)", () => {
    for (let i = 1; i < AI_LEVELS.length; i++) {
      expect(TRAITS[AI_LEVELS[i]].lipSave).toBeGreaterThan(TRAITS[AI_LEVELS[i - 1]].lipSave);
    }
    // 两秒里能往回蹭多远:新手连半个车身都蹭不回来,四档绰绰有余
    const reach = (level: AiLevel) => teeterCrawl(TRAITS[level].lipSave) * (TEETER_MS / 1000);
    expect(reach(1)).toBeLessThan(FALL_MARGIN);
    expect(reach(2)).toBeLessThan(FALL_MARGIN);
    expect(reach(3)).toBeGreaterThan(FALL_MARGIN);
    expect(reach(4)).toBeGreaterThan(FALL_MARGIN);
  });

  it("自己在打转的时候,电脑只干一件事:把方向顶向最近的台沿法线", () => {
    const me = makeCar({ id: 0, name: "鸭梨", emoji: "🍐", color: "#e8558f", team: 0, x: 101, y: 35, lives: 1, ai: true });
    const other = makeCar({ id: 1, name: "糯糯", emoji: "🐰", color: "#f7a9c4", team: 1, x: 20, y: 35, lives: 1, ai: true });
    const world = createWorld({ field: rect(), cars: [me, other] });
    me.teeter = TEETER_MS;
    const want = chooseCarAction(world, 0, 4, 3);
    expect(want.dx).toBeLessThan(0);
    expect(want.dash).toBe(false);
    expect(hypot(want.dx, want.dy)).toBeCloseTo(TRAITS[4].lipSave, 6);
  });

  it("卡角高手会放着近的不打,专挑正在打转的那台补最后一下", () => {
    const me = makeCar({ id: 0, name: "鸭梨", emoji: "🍐", color: "#e8558f", team: 0, x: 50, y: 35, lives: 1, ai: true });
    const near = makeCar({ id: 1, name: "近", emoji: "🐰", color: "#f7a9c4", team: 1, x: 58, y: 35, lives: 1, ai: true });
    const lip = makeCar({ id: 2, name: "远", emoji: "🐻", color: "#c4a9f7", team: 1, x: 95, y: 35, lives: 1, ai: true });
    lip.teeter = TEETER_MS;
    const world = createWorld({ field: rect(), cars: [me, near, lip] });
    expect(pickTarget(world, me, true, true)?.id).toBe(2);
    // 不看悬崖的低档位还是只认最近的
    expect(pickTarget(world, me, false)?.id).toBe(1);
  });

  it("无尽波次的难度是往上走的,后面才请得动四档", () => {
    const skills = [1, 3, 6, 10, 14].map((w) => waveSkill(w));
    for (let i = 1; i < skills.length; i++) expect(skills[i]).toBeGreaterThanOrEqual(skills[i - 1]);
    expect(waveSkill(1)).toBe(1);
    expect(waveSkill(20)).toBe(4);
  });

  it("闯关只有最后一章的收官关才派四档,前面七章还是 1.1 的档位", () => {
    let fourth = 0;
    for (let i = 0; i < 188; i++) {
      const lv = buildLevel(i);
      for (const f of lv.foes) {
        if (f.skill === 4) {
          fourth++;
          expect(lv.chapter).toBe(7);
        }
      }
    }
    expect(fourth).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 双人输入
// ---------------------------------------------------------------------------

describe("1.2 · 双人同屏输入不串台", () => {
  it("两套键位各归各的座位,冲撞键也分得清是谁按的", () => {
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "dash" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "dash" });
    expect(keyToAction("KeyG", 2)).toEqual({ player: 0, action: "brake" });
    expect(keyToAction("KeyK", 2)).toEqual({ player: 1, action: "brake" });
  });

  it("同一帧里两个座位的蓄力互不影响", () => {
    const a = hero(20, 20);
    const b = makeCar({ id: 1, name: "康康", emoji: "👓", color: "#3f7fd6", team: 1, x: 20, y: 55, lives: 1 });
    const world = createWorld({ field: rect(), cars: [a, b] });
    const go: Intent = { dx: 1, dy: 0, dash: false, brake: false };
    for (let i = 0; i < 20; i++) stepWorld(world, 16, [{ ...go, charge: true }, go]);
    expect(a.charge).toBeGreaterThan(0);
    expect(b.charge).toBe(0);
    expect(b.chargeCd).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 关卡里的新机关
// ---------------------------------------------------------------------------

describe("1.2 · 188 关里真的摆上了新机关", () => {
  it("旋转盘与油渍都落在场地里,而且后面的章节才出现", () => {
    let withSpinner = 0;
    let withSlick = 0;
    for (let i = 0; i < 188; i++) {
      const lv = buildLevel(i);
      if (lv.spinners.length > 0) withSpinner++;
      if (lv.slicks.length > 0) withSlick++;
      for (const sp of lv.spinners) {
        expect(sp.r).toBeGreaterThan(0);
        expect(boundaryHit(lv.field, sp.x, sp.y, 0).depth).toBeLessThan(0);
      }
      for (const sl of lv.slicks) {
        expect(sl.keep).toBeGreaterThan(lv.keep);
        expect(boundaryHit(lv.field, sl.x, sl.y, 0).depth).toBeLessThan(0);
      }
    }
    expect(withSpinner).toBeGreaterThan(0);
    expect(withSlick).toBeGreaterThan(0);
    expect(buildLevel(0).spinners.length).toBe(0);
    expect(buildLevel(0).slicks.length).toBe(0);
  });
});

/**
 * 1.2 监督修复员补的 360px 版面守门用例。
 *
 * 规格第八节写死两条硬指标:双人同屏时左右各一套控件、**热区 ≥ 44px**;
 * 比分 / 剩余车数一行显示、**字号 ≥ 14px**。这两条此前一条断言都没有,
 * 结果窄屏那一档把冲撞键收到了 38px、矮屏那一档收到了 35px,芯片一路缩到 11px。
 * 已经改回来了,这里把它钉住:以后谁再为了挤版面去动这几个数,先在这儿变红。
 */
describe("360px 版面:热区与字号的硬指标", () => {
  const css = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

  /** 把 `.选择器{...}` 那一整块声明取出来(同一个选择器可能出现在多个 @media 里) */
  function blocks(selector: string): string[] {
    const out: string[] = [];
    const needle = `${selector}{`;
    let at = css.indexOf(needle);
    while (at >= 0) {
      const end = css.indexOf("}", at);
      out.push(css.slice(at + needle.length, end));
      at = css.indexOf(needle, end);
    }
    return out;
  }

  function numbers(decls: string[], prop: string): number[] {
    const out: number[] = [];
    for (const d of decls) {
      for (const m of d.matchAll(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([\\d.]+)px`, "g"))) {
        out.push(Number(m[1]));
      }
    }
    return out;
  }

  it("冲撞键 / 刹车键在每一档屏幕下都不低于 44px", () => {
    const decls = blocks(".bc-acts button");
    expect(decls.length, "找不到动作键的样式").toBeGreaterThanOrEqual(3);
    const heights = numbers(decls, "height");
    expect(heights.length).toBeGreaterThanOrEqual(3);
    for (const h of heights) expect(h, `动作键高度 ${h}px 低于 44px 热区`).toBeGreaterThanOrEqual(44);
    for (const w of numbers(decls, "width")) {
      expect(w, `动作键宽度 ${w}px 低于 44px 热区`).toBeGreaterThanOrEqual(44);
    }
  });

  it("摇杆本体在最窄的一档也还有 86px,够放下一根手指", () => {
    const sizes = numbers(blocks(".bc-stick"), "width");
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    for (const s of sizes) expect(s, `摇杆 ${s}px 太小`).toBeGreaterThanOrEqual(86);
  });

  it("比分 / 剩余车数的芯片字号在每一档都不小于 14px", () => {
    const fonts = numbers(blocks(".bc-chip"), "font-size");
    expect(fonts.length, "芯片一条字号都没写").toBeGreaterThanOrEqual(1);
    for (const f of fonts) expect(f, `芯片字号 ${f}px 小于 14px`).toBeGreaterThanOrEqual(14);
  });

  it("窄屏 / 矮屏两档 @media 都还在,只是不再拿热区和字号开刀", () => {
    expect(css).toContain("@media (max-width:420px)");
    expect(css).toContain("@media (max-height:720px)");
    // 矮屏那一档仍然要为摇杆让出竖向空间,场地的预留值不能改回去
    expect(css).toMatch(/window\.innerHeight \|\| 700\) - 320/);
  });
});
