// 碰碰车大乱斗 · 电脑车手单测。
// 决策是纯函数,所以「危险时会不会掉头」「冲刺按得聪明不聪明」这些
// 都能一条一条钉住,不用把整局跑完。
import { describe, expect, it } from "vitest";
import { AI_LABEL, TRAITS, chooseCarAction, huntersFor, nearestFoe, outwardDir, pickTarget, wobble, type AiLevel } from "./ai";
import { createWorld, dropCar, hypot, makeCar, type Field } from "./logic";

function rect(w = 100, h = 70): Field {
  return { shape: "rect", w, h, springs: [], arcs: [] };
}

function hero(x: number, y: number) {
  return makeCar({ id: 0, name: "朵朵", emoji: "🌸", color: "#e8558f", team: 0, x, y, lives: 3, ai: true });
}

function foe(id: number, x: number, y: number) {
  return makeCar({ id, name: `对手${id}`, emoji: "🐰", color: "#f7a9c4", team: 1, x, y, lives: 1, ai: true });
}

describe("三档电脑的性格", () => {
  it("三档都有中文名字,而且不重样", () => {
    const labels = [AI_LABEL[1], AI_LABEL[2], AI_LABEL[3]];
    expect(new Set(labels).size).toBe(3);
    for (const l of labels) expect(l.length).toBeGreaterThan(1);
  });

  it("档位越高越会看悬崖、手越稳", () => {
    expect(TRAITS[1].edgeCare).toBeLessThan(TRAITS[2].edgeCare);
    expect(TRAITS[2].edgeCare).toBeLessThan(TRAITS[3].edgeCare);
    expect(TRAITS[1].jitter).toBeGreaterThan(TRAITS[2].jitter);
    expect(TRAITS[2].jitter).toBeGreaterThan(TRAITS[3].jitter);
    expect(TRAITS[1].flank).toBe(false);
    expect(TRAITS[3].flank).toBe(true);
    expect(TRAITS[3].dodge).toBe(true);
  });

  it("档位越高越会留提前量:开得快就更早掉头", () => {
    expect(TRAITS[1].react).toBeLessThan(TRAITS[2].react);
    expect(TRAITS[2].react).toBeLessThan(TRAITS[3].react);
  });

  it("抖动是确定性的,而且落在 -1..1 之间", () => {
    for (let t = 0; t < 50; t++) {
      const v = wobble(t, 3);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(wobble(t, 3)).toBe(v);
    }
  });
});

describe("挑目标", () => {
  it("nearestFoe 只认对面队伍里还在场上的车", () => {
    const me = hero(10, 35);
    const near = foe(1, 20, 35);
    const far = foe(2, 90, 35);
    const world = createWorld({ field: rect(), cars: [me, near, far] });
    expect(nearestFoe(world, me)?.id).toBe(1);
    dropCar(world, 1);
    expect(nearestFoe(world, me)?.id).toBe(2);
  });

  it("会看悬崖的档位宁可多跑几步,也要挑站在边上的那台", () => {
    const me = hero(50, 35);
    const middle = foe(1, 58, 35);
    const onEdge = foe(2, 50, 5);
    const world = createWorld({ field: rect(), cars: [me, middle, onEdge] });
    expect(pickTarget(world, me, false)?.id).toBe(1);
    expect(pickTarget(world, me, true)?.id).toBe(2);
  });

  it("场上没对手时不会崩,只会回中间待命", () => {
    const me = hero(10, 10);
    const world = createWorld({ field: rect(), cars: [me] });
    const act = chooseCarAction(world, 0, 3, 0);
    expect(act.dx).toBeGreaterThan(0);
    expect(act.dy).toBeGreaterThan(0);
    expect(act.dash).toBe(false);
  });

  it("outwardDir 指的是「从场地中心往外」的方向", () => {
    const world = createWorld({ field: rect(100, 100), cars: [hero(50, 50)] });
    const d = outwardDir(world, 90, 50);
    expect(d.x).toBeCloseTo(1, 6);
    expect(d.y).toBeCloseTo(0, 6);
  });
});

describe("开车决策", () => {
  it("被推向悬崖时会把车头掰回场内", () => {
    const me = hero(6, 35);
    me.vx = -20;
    const world = createWorld({ field: rect(), cars: [me, foe(1, 50, 35)] });
    const act = chooseCarAction(world, 0, 3, 0);
    expect(act.dx).toBeGreaterThan(0.4);
    expect(act.brake).toBe(true);
  });

  it("同样的位置,开得越快掉头掰得越狠", () => {
    const slow = hero(22, 35);
    const fast = hero(22, 35);
    fast.vx = -28;
    const w1 = createWorld({ field: rect(), cars: [slow, foe(1, 9, 18)] });
    const w2 = createWorld({ field: rect(), cars: [fast, foe(1, 9, 18)] });
    // 慢的时候还敢往悬崖那侧追,飙起来就只想着往回打方向
    expect(chooseCarAction(w2, 0, 3, 0).dx).toBeGreaterThan(chooseCarAction(w1, 0, 3, 0).dx);
  });

  it("已经顶上对手了就顺着往外推,不再绕位", () => {
    // 对手贴在我外侧(更靠近上边缘),这一脚应该继续往上顶
    const me = hero(50, 40);
    const target = foe(1, 50, 33);
    const world = createWorld({ field: rect(), cars: [me, target] });
    const act = chooseCarAction(world, 0, 3, 0);
    expect(act.dy).toBeLessThan(-0.8);
  });

  it("输出的方向向量长度不会超过 1", () => {
    const world = createWorld({ field: rect(), cars: [hero(30, 30), foe(1, 60, 40), foe(2, 20, 60)] });
    for (const skill of [1, 2, 3] as AiLevel[]) {
      for (let tick = 0; tick < 20; tick++) {
        const act = chooseCarAction(world, 0, skill, tick);
        expect(hypot(act.dx, act.dy)).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("已经退场的车不会再发出任何指令", () => {
    const me = hero(50, 35);
    const world = createWorld({ field: rect(), cars: [me, foe(1, 60, 35)] });
    dropCar(world, 0);
    expect(chooseCarAction(world, 0, 3, 0)).toEqual({ dx: 0, dy: 0, dash: false, brake: false });
  });

  it("冲刺:冠军档只在推力指着悬崖时才按,新手贴上去就按", () => {
    // 对手在我和悬崖之间:这一撞的方向正对着场外
    const me = hero(50, 40);
    const target = foe(1, 50, 28);
    const world = createWorld({ field: rect(), cars: [me, target] });
    const good = chooseCarAction(world, 0, 3, 0);
    expect(good.dash).toBe(true);
    // 换成对手在里侧:撞过去只会把它推回场中央,冠军档不浪费冷却
    const me2 = hero(50, 26);
    const inner = foe(1, 50, 33);
    const world2 = createWorld({ field: rect(), cars: [me2, inner] });
    expect(chooseCarAction(world2, 0, 3, 0).dash).toBe(false);
    expect(chooseCarAction(world2, 0, 1, 0).dash).toBe(true);
  });

  it("巡逻模式只绕圈,不冲刺", () => {
    const me = foe(1, 20, 20);
    const world = createWorld({ field: rect(100, 100), cars: [hero(50, 50), me] });
    world.cars[1] = me;
    const act = chooseCarAction(world, 1, 3, 5, "patrol");
    expect(act.dash).toBe(false);
    expect(hypot(act.dx, act.dy)).toBeCloseTo(1, 3);
  });
});

describe("车轮战名额", () => {
  it("闯关时同时出战的对手数量有上限", () => {
    const world = createWorld({
      field: rect(),
      cars: [hero(50, 35), foe(1, 60, 35), foe(2, 70, 35), foe(3, 80, 35)],
    });
    expect(huntersFor(world, 1, 0).size).toBe(1);
    expect(huntersFor(world, 2, 0).size).toBe(2);
    expect(huntersFor(world, 9, 0).size).toBe(3);
  });

  it("名额每几秒轮换一次,不会永远是同一台车", () => {
    const world = createWorld({
      field: rect(),
      cars: [hero(50, 35), foe(1, 60, 35), foe(2, 70, 35), foe(3, 80, 35)],
    });
    const seen = new Set<number>();
    for (let t = 0; t < 20000; t += 4000) {
      for (const i of huntersFor(world, 1, t)) seen.add(i);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("退场的车不会再占名额", () => {
    const world = createWorld({ field: rect(), cars: [hero(50, 35), foe(1, 60, 35), foe(2, 70, 35)] });
    dropCar(world, 1);
    const hunters = huntersFor(world, 2, 0);
    expect(hunters.has(1)).toBe(false);
    expect(hunters.has(2)).toBe(true);
  });

  it("对手全退场时名额是空的", () => {
    const world = createWorld({ field: rect(), cars: [hero(50, 35), foe(1, 60, 35)] });
    dropCar(world, 1);
    expect(huntersFor(world, 2, 0).size).toBe(0);
  });
});
