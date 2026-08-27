// 保龄球小馆 · 球道物理与操作单测。
//
// 物理这一层最要紧的是两件事:碰撞必须动量守恒(不管弹性系数取多少),
// 以及「一瓶撞一瓶」的连锁是真的算出来的。剩下的三段式操作、键位、评星
// 都是纯函数,一条一条钉住。
import { describe, expect, it } from "vitest";
import {
  AI_LABEL,
  AI_WOBBLE,
  BALL_R,
  DECK_END,
  GUTTER_EDGE,
  HEAD_Y,
  LANE_W,
  PIN_GAP,
  PIN_TRAITS,
  POCKET_AIM,
  ROW_GAP,
  STAGE_LABEL,
  STAGE_MS,
  aiShot,
  aimForX,
  aimFromSweep,
  cleanShot,
  createLane,
  dampFactor,
  downCount,
  endlessLine,
  fullRack,
  hookAccel,
  hypot,
  isPauseKey,
  keyToAction,
  loseLine,
  makePin,
  nextStage,
  pinShift,
  pinSpot,
  powerFromSweep,
  rateLevel,
  releaseSpeed,
  releaseX,
  resolveHit,
  separate,
  shotLine,
  simulateShot,
  spinFromSweep,
  standingAfter,
  stepLane,
  sweep,
  versusLine,
  winLine,
  wobble,
  type PinKind,
  type Shot,
} from "./logic";
import { PINS } from "./scoring";

interface Circle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  inv: number;
}

function circle(x: number, y: number, vx: number, vy: number, mass: number, r = 2.4): Circle {
  return { x, y, vx, vy, r, inv: 1 / mass };
}

function momentum(bodies: Circle[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const b of bodies) {
    const m = 1 / b.inv;
    x += m * b.vx;
    y += m * b.vy;
  }
  return { x, y };
}

function energy(bodies: Circle[]): number {
  let e = 0;
  for (const b of bodies) e += (0.5 / b.inv) * (b.vx * b.vx + b.vy * b.vy);
  return e;
}

describe("碰撞:动量守恒", () => {
  it("正撞:不管弹性取多少,总动量都不变", () => {
    for (const bounce of [0, 0.35, 0.7, 1]) {
      const a = circle(0, 0, 30, 0, 12, 4.3);
      const b = circle(6, 0, 0, 0, 1.5);
      const before = momentum([a, b]);
      resolveHit(a, b, bounce);
      const after = momentum([a, b]);
      expect(after.x).toBeCloseTo(before.x, 8);
      expect(after.y).toBeCloseTo(before.y, 8);
    }
  });

  it("斜撞一样守恒,而且被撞的那一个真的动了", () => {
    const a = circle(0, 0, 20, 14, 12, 4.3);
    const b = circle(4, 4, 0, 0, 1.5);
    const before = momentum([a, b]);
    const force = resolveHit(a, b, 0.7);
    const after = momentum([a, b]);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    expect(force).toBeGreaterThan(0);
    expect(hypot(b.vx, b.vy)).toBeGreaterThan(5);
  });

  it("完全弹性(bounce=1)时动能也守恒", () => {
    const a = circle(0, 0, 25, 0, 3);
    const b = circle(4.8, 0, -5, 0, 1.5);
    const e0 = energy([a, b]);
    resolveHit(a, b, 1);
    expect(energy([a, b])).toBeCloseTo(e0, 6);
  });

  it("正在分开的两个圆不会被再撞一次", () => {
    const a = circle(0, 0, -10, 0, 3);
    const b = circle(4, 0, 10, 0, 3);
    expect(resolveHit(a, b, 0.7)).toBe(0);
    expect(a.vx).toBe(-10);
  });

  it("越重的球把瓶撞得越飞", () => {
    const light = circle(6, 0, 0, 0, 1.5);
    const heavy = circle(6, 0, 0, 0, 1.5);
    resolveHit(circle(0, 0, 30, 0, 4, 4.3), light, 0.7);
    resolveHit(circle(0, 0, 30, 0, 20, 4.3), heavy, 0.7);
    expect(heavy.vx).toBeGreaterThan(light.vx);
  });

  it("叠在一起的两个圆会按质量比例被分开", () => {
    const a = circle(0, 0, 0, 0, 12, 4.3);
    const b = circle(3, 0, 0, 0, 1.5);
    separate(a, b);
    expect(hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(a.r + b.r, 6);
    // 轻的那个被推得多
    expect(Math.abs(b.x - 3)).toBeGreaterThan(Math.abs(a.x));
  });

  it("阻尼系数:每秒保留 0.25 就是一秒后只剩四分之一", () => {
    expect(dampFactor(0.25, 1000)).toBeCloseTo(0.25, 8);
    expect(dampFactor(0.25, 0)).toBeCloseTo(1, 8);
    expect(dampFactor(1, 5000)).toBeCloseTo(1, 8);
  });
});

describe("瓶阵摆位", () => {
  it("十个瓶摆成正三角,头瓶在正中间", () => {
    const head = pinSpot(0);
    expect(head.x).toBeCloseTo(LANE_W / 2, 6);
    expect(head.y).toBeCloseTo(HEAD_Y, 6);
    for (let i = 0; i < PINS; i++) {
      const p = pinSpot(i);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(LANE_W);
      expect(p.y).toBeGreaterThanOrEqual(HEAD_Y);
      expect(p.y).toBeLessThanOrEqual(HEAD_Y + ROW_GAP * 3 + 0.001);
    }
  });

  it("同一排相邻两瓶正好隔 12,四排一共十个瓶", () => {
    expect(pinSpot(2).x - pinSpot(1).x).toBeCloseTo(PIN_GAP, 6);
    expect(pinSpot(5).x - pinSpot(4).x).toBeCloseTo(PIN_GAP, 6);
    expect(pinSpot(9).x - pinSpot(8).x).toBeCloseTo(PIN_GAP, 6);
    const rows = new Set<number>();
    for (let i = 0; i < PINS; i++) rows.add(Math.round(pinSpot(i).y));
    expect(rows.size).toBe(4);
  });

  it("瓶阵左右对称:最左和最右的角瓶到中线一样远", () => {
    const left = pinSpot(6);
    const right = pinSpot(9);
    expect(LANE_W / 2 - left.x).toBeCloseTo(right.x - LANE_W / 2, 6);
  });

  it("五种瓶各有自己的重量与脾气,名字不重样", () => {
    const kinds: PinKind[] = ["wood", "iron", "ice", "spring", "balloon"];
    const names = kinds.map((k) => PIN_TRAITS[k].name);
    expect(new Set(names).size).toBe(kinds.length);
    expect(PIN_TRAITS.iron.mass).toBeGreaterThan(PIN_TRAITS.wood.mass);
    expect(PIN_TRAITS.balloon.mass).toBeLessThan(PIN_TRAITS.wood.mass);
    expect(PIN_TRAITS.ice.keep).toBeGreaterThan(PIN_TRAITS.wood.keep);
    expect(PIN_TRAITS.spring.bounce).toBeGreaterThan(PIN_TRAITS.wood.bounce);
    expect(PIN_TRAITS.iron.topple).toBeGreaterThan(PIN_TRAITS.wood.topple);
  });

  it("刚摆好的瓶站在自己的点上,一点都没偏", () => {
    const pin = makePin(4, "ice");
    expect(pinShift(pin)).toBe(0);
    expect(pin.down).toBe(false);
    expect(pin.kind).toBe("ice");
    expect(pin.mass).toBe(PIN_TRAITS.ice.mass);
  });
});

describe("出手参数", () => {
  it("落点 -1 靠左沟、+1 靠右沟、0 在正中间", () => {
    expect(releaseX(0)).toBeCloseTo(LANE_W / 2, 6);
    expect(releaseX(-1)).toBeCloseTo(GUTTER_EDGE + BALL_R, 6);
    expect(releaseX(1)).toBeCloseTo(LANE_W - GUTTER_EDGE - BALL_R, 6);
    expect(aimForX(releaseX(0.4))).toBeCloseTo(0.4, 6);
  });

  it("力度越大出手越快", () => {
    expect(releaseSpeed(1)).toBeGreaterThan(releaseSpeed(0.5));
    expect(releaseSpeed(0.5)).toBeGreaterThan(releaseSpeed(0));
  });

  it("油越厚旋转越拐不动,方向跟着旋转的正负走", () => {
    expect(hookAccel(1, 0)).toBeGreaterThan(hookAccel(1, 0.9));
    expect(hookAccel(-1, 0.2)).toBeLessThan(0);
    expect(hookAccel(0, 0)).toBe(0);
  });

  it("非法的投球参数会被夹回合法范围", () => {
    const s = cleanShot({ power: 5, aim: -9, spin: Number.NaN });
    expect(s.power).toBe(1);
    expect(s.aim).toBe(-1);
    expect(s.spin).toBe(0);
  });
});

describe("滚一球", () => {
  it("球会一路往前滚,旋转让它往一边拐", () => {
    const lane = createLane(fullRack(undefined, 0), { power: 0.6, aim: 0, spin: 1 });
    const x0 = lane.ball.x;
    for (let i = 0; i < 60; i++) stepLane(lane, 8);
    expect(lane.ball.y).toBeGreaterThan(10);
    expect(lane.ball.x).toBeGreaterThan(x0);
  });

  it("球滚出边线就掉进球沟,一个瓶也打不到", () => {
    const r = simulateShot(fullRack(), { power: 0.8, aim: -1, spin: -1 });
    expect(r.gutter).toBe(true);
    expect(r.count).toBe(0);
  });

  it("对着口袋来一球:十个瓶全倒", () => {
    const r = simulateShot(fullRack(undefined, 0.4), { power: 0.7, aim: POCKET_AIM, spin: 0 });
    expect(r.count).toBe(PINS);
    expect(r.standing.every((s) => !s)).toBe(true);
  });

  it("同样的投球跑两次结果完全一样(确定性)", () => {
    const shot: Shot = { power: 0.63, aim: 0.17, spin: -0.28 };
    const a = simulateShot(fullRack(), shot);
    const b = simulateShot(fullRack(), shot);
    expect(a.down).toEqual(b.down);
    expect(a.count).toBe(b.count);
  });

  it("上一球已经打掉的瓶不会再倒一次", () => {
    const standing = new Array<boolean>(PINS).fill(false);
    standing[6] = true;
    const r = simulateShot({ standing }, { power: 0.7, aim: -0.42, spin: 0 });
    expect(r.count).toBeLessThanOrEqual(1);
    expect(r.down.filter(Boolean).length).toBe(r.count);
    for (let i = 0; i < PINS; i++) if (i !== 6) expect(r.down[i]).toBe(false);
  });

  it("连锁:只让球碰到头瓶,后排的瓶也会被带倒", () => {
    const standing = new Array<boolean>(PINS).fill(false);
    standing[0] = true;
    standing[1] = true;
    standing[3] = true;
    const r = simulateShot({ standing, oil: 0.4 }, { power: 1, aim: -0.05, spin: 0 });
    // 只有头瓶挨了球,2 号、4 号是被撞倒的
    expect(r.count).toBeGreaterThanOrEqual(2);
  });

  it("铁瓶比木瓶难推:同样一球倒得更少", () => {
    const shot: Shot = { power: 0.55, aim: POCKET_AIM, spin: 0 };
    const wood = simulateShot(fullRack(), shot);
    const iron = simulateShot(fullRack(new Array<PinKind>(PINS).fill("iron")), shot);
    expect(iron.count).toBeLessThan(wood.count);
  });

  it("冰瓶被撞后滑得比木瓶远", () => {
    function slide(kind: PinKind): number {
      const standing = new Array<boolean>(PINS).fill(false);
      standing[0] = true;
      const kinds = new Array<PinKind>(PINS).fill("wood");
      kinds[0] = kind;
      const lane = createLane({ standing, kinds, oil: 0.4 }, { power: 0.5, aim: 0, spin: 0 });
      // 把球收走,单看这一瓶挨了同样一脚之后自己能滑多远
      lane.ball.gone = true;
      lane.pins[0].vy = 10;
      for (let i = 0; i < 500 && !lane.settled; i++) stepLane(lane, 8);
      return pinShift(lane.pins[0]);
    }
    expect(slide("ice")).toBeGreaterThan(slide("wood"));
  });

  it("一球算完就停,不会永远算下去", () => {
    const lane = createLane(fullRack(), { power: 0.7, aim: 0.2, spin: 0 });
    let steps = 0;
    while (!lane.settled && steps < 2000) {
      stepLane(lane, 8);
      steps++;
    }
    expect(lane.settled).toBe(true);
    expect(lane.ball.y).toBeGreaterThan(HEAD_Y);
    expect(steps).toBeLessThan(2000);
  });

  it("暂停(dt=0)时什么都不会动", () => {
    const lane = createLane(fullRack(), { power: 0.7, aim: 0, spin: 0 });
    const y = lane.ball.y;
    stepLane(lane, 0);
    expect(lane.ball.y).toBe(y);
    expect(lane.time).toBe(0);
  });

  it("倒了的瓶会从「还站着」的名单里消失", () => {
    const lane = createLane(fullRack(), { power: 0.8, aim: POCKET_AIM, spin: 0 });
    for (let i = 0; i < 900 && !lane.settled; i++) stepLane(lane, 8);
    expect(downCount(lane) + standingAfter(lane).filter(Boolean).length).toBe(PINS);
  });

  it("飞出瓶台的瓶会被挡板拦住,不会跑到画面外面去", () => {
    const lane = createLane(fullRack(), { power: 1, aim: POCKET_AIM, spin: 0 });
    for (let i = 0; i < 900 && !lane.settled; i++) stepLane(lane, 8);
    for (const pin of lane.pins) {
      expect(pin.x).toBeGreaterThanOrEqual(0);
      expect(pin.x).toBeLessThanOrEqual(LANE_W);
      expect(pin.y).toBeLessThanOrEqual(DECK_END + 0.001);
    }
  });
});

describe("三段式操作", () => {
  it("指针来回跑:半程到顶,一整程回到起点", () => {
    expect(sweep(0, 1000)).toBeCloseTo(0, 6);
    expect(sweep(500, 1000)).toBeCloseTo(1, 6);
    expect(sweep(1000, 1000)).toBeCloseTo(0, 6);
    expect(sweep(1500, 1000)).toBeCloseTo(1, 6);
    expect(sweep(250, 1000)).toBeCloseTo(0.5, 6);
  });

  it("三段指针分别换算成力度、落点、旋转", () => {
    expect(powerFromSweep(0.8)).toBeCloseTo(0.8, 6);
    expect(aimFromSweep(0.5)).toBeCloseTo(0, 6);
    expect(aimFromSweep(0)).toBeCloseTo(-1, 6);
    expect(spinFromSweep(1)).toBeCloseTo(1, 6);
  });

  it("三段按顺序走:蓄力 → 落点 → 旋转 → 滚球", () => {
    expect(nextStage("power")).toBe("aim");
    expect(nextStage("aim")).toBe("spin");
    expect(nextStage("spin")).toBe("roll");
    expect(STAGE_LABEL.power.length).toBeGreaterThan(1);
    expect(STAGE_MS.spin).toBeLessThan(STAGE_MS.power);
  });
});

describe("电脑球手", () => {
  it("三档都有中文名字,而且不重样", () => {
    const labels = [AI_LABEL[1], AI_LABEL[2], AI_LABEL[3]];
    expect(new Set(labels).size).toBe(3);
    expect(AI_WOBBLE[1]).toBeGreaterThan(AI_WOBBLE[2]);
    expect(AI_WOBBLE[2]).toBeGreaterThan(AI_WOBBLE[3]);
  });

  it("抖动是确定性的,落在 -1..1 之间", () => {
    for (let t = 0; t < 30; t++) {
      const v = wobble(t, 2);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(wobble(t, 2)).toBe(v);
    }
  });

  it("满架时冠军档瞄的是口袋,不是正中间", () => {
    const full = new Array<boolean>(PINS).fill(true);
    const shot = aiShot(full, 3, 0);
    expect(Math.abs(shot.aim - POCKET_AIM)).toBeLessThan(0.1);
    expect(shot.power).toBeGreaterThan(0.3);
  });

  it("补中时会瞄向还站着的那几瓶", () => {
    const left = new Array<boolean>(PINS).fill(false);
    left[6] = true;
    left[3] = true;
    const shot = aiShot(left, 3, 1);
    expect(shot.aim).toBeLessThan(0);
    const right = new Array<boolean>(PINS).fill(false);
    right[9] = true;
    expect(aiShot(right, 3, 1).aim).toBeGreaterThan(0);
  });

  it("档位越高手越稳:同一回合冠军档离口袋更近", () => {
    const full = new Array<boolean>(PINS).fill(true);
    let novice = 0;
    let champion = 0;
    for (let t = 0; t < 40; t++) {
      novice += Math.abs(aiShot(full, 1, t).aim - POCKET_AIM);
      champion += Math.abs(aiShot(full, 3, t).aim - POCKET_AIM);
    }
    expect(champion).toBeLessThan(novice);
  });
});

describe("评分与文案", () => {
  it("超出目标越多星越多", () => {
    expect(rateLevel(30, 30)).toBe(1);
    expect(rateLevel(36, 30)).toBe(2);
    expect(rateLevel(45, 30)).toBe(3);
    expect(rateLevel(29, 30)).toBe(1);
  });

  it("播报会区分全中、补中、洗澡球和球沟", () => {
    expect(shotLine(10, true, false)).toContain("全中");
    expect(shotLine(0, true, true)).toContain("球沟");
    expect(shotLine(0, true, false)).toContain("没碰到");
    expect(shotLine(3, false, false)).toContain("补上");
  });

  it("胜负文案里带着分数,而且失败只鼓励不批评", () => {
    expect(winLine(120, 100, 3)).toContain("120");
    const lose = loseLine(60, 100);
    expect(lose).toContain("40");
    expect(lose).toContain("别急");
    expect(versusLine([80, 60], ["鸭梨", "康康"])).toBe("鸭梨 80 比 60 康康");
    expect(endlessLine(9, 9)).toContain("刷新");
    expect(endlessLine(3, 9)).toContain("9");
  });
});

describe("键位", () => {
  it("鸭梨用 WASD + F/G,康康用方向键 + L/K", () => {
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "confirm" });
    expect(keyToAction("KeyG", 2)).toEqual({ player: 0, action: "cancel" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "confirm" });
    expect(keyToAction("KeyK", 2)).toEqual({ player: 1, action: "cancel" });
    expect(keyToAction("ArrowLeft", 2)).toEqual({ player: 1, action: "left" });
  });

  it("一个人玩的时候两套键位都归 0 号玩家", () => {
    expect(keyToAction("ArrowUp", 1)?.player).toBe(0);
    expect(keyToAction("KeyL", 1)).toEqual({ player: 0, action: "confirm" });
  });

  it("空格谁按都算停指针,双人局里也归 0 号玩家", () => {
    expect(keyToAction("Space", 1)).toEqual({ player: 0, action: "confirm" });
    expect(keyToAction("Space", 2)).toEqual({ player: 0, action: "confirm" });
  });

  it("不认识的键返回 null,Esc 是暂停", () => {
    expect(keyToAction("KeyZ", 2)).toBeNull();
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyP")).toBe(false);
  });
});
