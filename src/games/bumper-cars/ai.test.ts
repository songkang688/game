// 碰碰车大乱斗 · 电脑车手单测。
// 决策是纯函数,所以「危险时会不会掉头」「冲刺按得聪明不聪明」这些
// 都能一条一条钉住,不用把整局跑完。
import { describe, expect, it } from "vitest";
import {
  AI_LABEL,
  CLIFF_MARGIN,
  TRAITS,
  chooseCarAction,
  cliffBlocker,
  cliffCoast,
  cliffGuard,
  huntersFor,
  nearestFoe,
  outwardDir,
  pickTarget,
  wobble,
  type AiLevel,
} from "./ai";
import { CAR_R, MAX_SPEED, createWorld, dropCar, hypot, makeCar, type Field, type Intent } from "./logic";

function rect(w = 100, h = 70, springs: Field["springs"] = []): Field {
  return { shape: "rect", w, h, springs, arcs: [] };
}

function hero(x: number, y: number) {
  return makeCar({ id: 0, name: "鸭梨", emoji: "🍐", color: "#e8558f", team: 0, x, y, lives: 3, ai: true });
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

describe("自保:电脑车不许自己开下悬崖", () => {
  /** 满油门朝右(= 朝开放边)冲 */
  const FLOOR_IT: Intent = { dx: 1, dy: 0, dash: true, brake: false, charge: true };

  it("离悬崖还远的时候一个字节都不改", () => {
    const me = hero(50, 35);
    const world = createWorld({ field: rect(), cars: [me] });
    expect(cliffGuard(world, me, FLOOR_IT)).toEqual(FLOOR_IT);
  });

  it("贴到台沿就把朝悬崖的那脚油门收回来,还点上刹车", () => {
    const me = hero(98, 35);
    me.vx = MAX_SPEED;
    const world = createWorld({ field: rect(), cars: [me] });
    const act = cliffGuard(world, me, FLOOR_IT);
    expect(act.dx, "还在往悬崖那边踩油门").toBeLessThan(0);
    expect(act.brake).toBe(true);
    expect(act.dash, "已经在往外飘了还按冲刺,等于给自己加一脚").toBe(false);
    expect(act.charge).toBe(false);
  });

  it("护栏那一边不算悬崖:四面都是护栏时压根不管", () => {
    const me = hero(99, 35);
    me.vx = MAX_SPEED;
    const railed = createWorld({ field: rect(100, 70, ["left", "right", "top", "bottom"]), cars: [me] });
    expect(cliffGuard(railed, me, FLOOR_IT)).toEqual(FLOOR_IT);
    // 只有右边装了护栏,危险的就只剩上下两条开放边
    const half = createWorld({ field: rect(100, 70, ["right"]), cars: [me] });
    expect(cliffGuard(half, me, FLOOR_IT)).toEqual(FLOOR_IT);
  });

  it("开得越快越早收:同一个位置,静止的还敢往外踩,飙起来就掰回来了", () => {
    const slow = hero(88, 35);
    const fast = hero(88, 35);
    fast.vx = MAX_SPEED;
    const w1 = createWorld({ field: rect(), cars: [slow] });
    const w2 = createWorld({ field: rect(), cars: [fast] });
    expect(cliffGuard(w1, slow, FLOOR_IT).dx).toBeGreaterThan(cliffGuard(w2, fast, FLOOR_IT).dx);
  });

  it("打滑和油渍上收车更慢,留出的距离要更宽", () => {
    const plain = hero(50, 35);
    const skidding = hero(50, 35);
    skidding.skid = 200;
    const world = createWorld({ field: rect(), cars: [plain, skidding] });
    expect(cliffCoast(world, skidding)).toBeGreaterThan(cliffCoast(world, plain));
    const icy = createWorld({ field: rect(), cars: [plain], keep: 0.86 });
    expect(cliffCoast(icy, plain)).toBeGreaterThan(cliffCoast(world, plain));
  });

  it("顶着一台已经挂在台沿的对手时让开,好把这一下推完", () => {
    // 对手贴在我的正外侧,而且它自己已经在台沿上了
    const me = hero(100 - CAR_R * 2 - 1, 35);
    const victim = foe(1, 100 - 1, 35);
    const world = createWorld({ field: rect(), cars: [me, victim] });
    expect(cliffBlocker(world, me, 1, 0)).toBe(true);
    expect(cliffGuard(world, me, FLOOR_IT)).toEqual(FLOOR_IT);
    // 同一台车挪回场地中间就不是挡墙了:再往外顶只会把自己送下去
    victim.x = 60;
    expect(cliffBlocker(world, me, 1, 0)).toBe(false);
  });

  it("飙着速度撞过去不算「顶着推」:自保照旧生效", () => {
    const me = hero(100 - CAR_R * 2 - 1, 35);
    me.vx = MAX_SPEED;
    const victim = foe(1, 100 - 1, 35);
    const world = createWorld({ field: rect(), cars: [me, victim] });
    expect(cliffGuard(world, me, FLOOR_IT).dx).toBeLessThan(FLOOR_IT.dx);
  });

  it("四个档位都不会自己开出场:满油门朝悬崖冲两秒也停得住", () => {
    for (const skill of [1, 2, 3, 4] as AiLevel[]) {
      const me = hero(50, 35);
      const world = createWorld({ field: rect(), cars: [me, foe(1, 50, 2)] });
      for (let tick = 0; tick < 240; tick++) {
        const act = chooseCarAction(world, 0, skill, tick);
        // 手动推进油门与位移,只验决策层:确认它不会一路踩到出界
        me.vx += act.dx * 52 * 0.016;
        me.vy += act.dy * 52 * 0.016;
        if (act.brake) {
          me.vx *= 0.98;
          me.vy *= 0.98;
        }
        me.vx *= 0.989;
        me.vy *= 0.989;
        me.x += me.vx * 0.016;
        me.y += me.vy * 0.016;
      }
      expect(me.y, `${skill} 档自己开出了场地上沿`).toBeGreaterThan(-CLIFF_MARGIN);
    }
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
