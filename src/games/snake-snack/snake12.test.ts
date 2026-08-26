// 贪吃毛毛虫 · 1.2 单测:转向队列、速度曲线、四种机关、两种无尽档、打结收场、滑动与插值。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRID, LEVELS, endlessGarden, type SnakeLevel } from "./levels";
import { cellKey, cellXY, freeCells, reachableCells, spawnA, wallSet } from "./logic";
import {
  ENDLESS_PACES,
  FLOOR_MS,
  PACE_MODES,
  SWIPE_MIN,
  TURN_QUEUE_CAP,
  boardFullLine,
  endlessPaceLabel,
  endlessPaceTip,
  endlessTickMs,
  inBounds,
  isReverse,
  knotLine,
  knotReport,
  lerp,
  moveT,
  paceChangesStars,
  paceLabel,
  paceTip,
  pickSnack,
  portalExit,
  pushStone,
  pushTurn,
  queueTail,
  reachableNow,
  ringAround,
  ringCells,
  ringDoorOpen,
  ringDoorSet,
  ringHint,
  ringProgress,
  runSummary,
  sameDir,
  snackPool,
  speedCurveFor,
  starExpired,
  starHurry,
  starLeft,
  starTicksFor,
  stonePushable,
  stoneSet,
  swallowScale,
  swipeDir,
  takeTurn,
  tickMsAt,
  type Dir,
} from "./snake12";

const UP: Dir = [0, -1];
const DOWN: Dir = [0, 1];
const LEFT: Dir = [-1, 0];
const RIGHT: Dir = [1, 0];

/** 固定序列的假随机 */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("贪吃毛毛虫 1.2 · 转向输入队列", () => {
  it("最多缓存两个转向,第三个按下去不占坑", () => {
    expect(TURN_QUEUE_CAP).toBe(2);
    let q = pushTurn([], RIGHT, UP);
    q = pushTurn(q, RIGHT, LEFT);
    q = pushTurn(q, RIGHT, DOWN);
    expect(q).toEqual([UP, LEFT]);
  });

  it("同一拍里的反向输入直接丢弃,不会让虫子自己撞上自己", () => {
    // 正往右爬,先按上(进队),紧接着按下 —— 「下」是队尾「上」的反向,丢掉
    let q = pushTurn([], RIGHT, UP);
    q = pushTurn(q, RIGHT, DOWN);
    expect(q).toEqual([UP]);
    // 空队列时直接按反向也不生效
    expect(pushTurn([], RIGHT, LEFT)).toEqual([]);
    expect(isReverse(LEFT, RIGHT)).toBe(true);
    expect(isReverse(UP, RIGHT)).toBe(false);
  });

  it("连着按同一个方向不会把队列塞满", () => {
    let q: Dir[] = [];
    for (let i = 0; i < 10; i++) q = pushTurn(q, RIGHT, RIGHT);
    expect(q).toEqual([]);
    q = pushTurn(q, RIGHT, UP);
    for (let i = 0; i < 10; i++) q = pushTurn(q, RIGHT, UP);
    expect(q).toEqual([UP]);
  });

  it("按下的两个转向按拍依次生效 —— 「我明明按了」不再丢", () => {
    let q = pushTurn([], RIGHT, UP);
    q = pushTurn(q, RIGHT, LEFT);
    const first = takeTurn(q, RIGHT);
    expect(first.dir).toEqual(UP);
    const second = takeTurn(first.queue, first.dir);
    expect(second.dir).toEqual(LEFT);
    // 队列空了就照着原方向继续爬
    expect(takeTurn(second.queue, second.dir).dir).toEqual(LEFT);
  });

  it("队尾决定合法性:拐两次弯之后的掉头也拦得住", () => {
    expect(queueTail([], UP)).toEqual(UP);
    expect(queueTail([LEFT], UP)).toEqual(LEFT);
    // 往右爬 → 队里已有「上」「左」,再按「右」就是队尾「左」的反向
    const q = pushTurn(pushTurn([], RIGHT, UP), RIGHT, LEFT);
    expect(pushTurn(q, RIGHT, RIGHT)).toEqual(q);
    expect(sameDir(UP, [0, -1])).toBe(true);
  });

  it("兜底:万一队列里混进反向,走这一拍时也不会生效", () => {
    const bad = takeTurn([LEFT, UP], RIGHT);
    expect(bad.dir).toEqual(UP);
    expect(bad.queue).toEqual([]);
  });
});

describe("贪吃毛毛虫 1.2 · 速度曲线与稳定档", () => {
  it("每关的初速就是关卡表里的 tickMs,加速有封顶", () => {
    const curve = speedCurveFor(LEVELS[0]);
    expect(curve.startMs).toBe(LEVELS[0].tickMs);
    expect(curve.minMs).toBeGreaterThanOrEqual(FLOOR_MS);
    expect(curve.minMs).toBeLessThan(curve.startMs);
    expect(tickMsAt(curve, 0)).toBe(curve.startMs);
    expect(tickMsAt(curve, 4)).toBeLessThan(curve.startMs);
    expect(tickMsAt(curve, 999)).toBe(curve.minMs);
  });

  it("稳定速度辅助档整关一个节奏,而且不动三星标准", () => {
    const curve = speedCurveFor(LEVELS[120]);
    for (const eaten of [0, 5, 20, 100]) {
      expect(tickMsAt(curve, eaten, "steady")).toBe(curve.startMs);
    }
    expect(paceChangesStars()).toBe(false);
    expect(PACE_MODES).toEqual(["curve", "steady"]);
    for (const m of PACE_MODES) {
      expect(paceLabel(m).length).toBeGreaterThan(3);
      expect(paceTip(m)).not.toMatch(/[A-Za-z]/);
    }
  });

  it("188 关每一关的曲线都跑得动:再快也不快过底线", () => {
    for (const lv of LEVELS) {
      const curve = speedCurveFor(lv);
      expect(curve.startMs).toBeGreaterThanOrEqual(FLOOR_MS);
      expect(tickMsAt(curve, 50)).toBeGreaterThanOrEqual(FLOOR_MS);
      expect(tickMsAt(curve, 50, "steady")).toBe(curve.startMs);
    }
  });
});

describe("贪吃毛毛虫 1.2 · 机关一 星门", () => {
  it("踩进一扇星门就从对面那扇钻出来,两个方向都通", () => {
    const lv = LEVELS[130];
    const [ax, ay, bx, by] = lv.portals![0];
    expect(portalExit(lv, ax, ay)).toEqual([bx, by]);
    expect(portalExit(lv, bx, by)).toEqual([ax, ay]);
    expect(portalExit(lv, 0, 0)).toBeNull();
    expect(portalExit(LEVELS[0], ax, ay)).toBeNull();
  });
});

describe("贪吃毛毛虫 1.2 · 机关二 可推的小石头", () => {
  const walls = new Set<number>([cellKey(5, 5)]);

  it("顶一下就滑一格,原来那格空出来", () => {
    const stones = new Set([cellKey(3, 3)]);
    const after = pushStone(stones, 3, 3, RIGHT, { walls });
    expect(after).not.toBeNull();
    expect(after!.has(cellKey(4, 3))).toBe(true);
    expect(after!.has(cellKey(3, 3))).toBe(false);
    expect(after!.size).toBe(1);
  });

  it("对面是墙 / 是别的石头 / 是虫身就推不动,原地停住不算撞", () => {
    const stones = new Set([cellKey(4, 5), cellKey(3, 8), cellKey(4, 8)]);
    expect(pushStone(stones, 4, 5, RIGHT, { walls })).toBeNull();
    expect(pushStone(stones, 3, 8, RIGHT, { walls })).toBeNull();
    expect(
      pushStone(stones, 3, 3, RIGHT, { walls })
    ).toBeNull(); // 那格根本没石头
    const body = new Set([cellKey(5, 8)]);
    expect(pushStone(stones, 4, 8, RIGHT, { walls, blocked: body })).toBeNull();
  });

  it("推到边上就顶死了,不会被推出园子", () => {
    const stones = new Set([cellKey(GRID - 1, 4)]);
    expect(pushStone(stones, GRID - 1, 4, RIGHT, { walls })).toBeNull();
    expect(stonePushable(stones, GRID - 1, 4, LEFT, { walls })).toBe(true);
    expect(inBounds(GRID, 0)).toBe(false);
    expect(inBounds(0, 0)).toBe(true);
  });

  it("巡逻花园后半章真的摆了石头,而且没压在墙上或出生段", () => {
    const withStones = LEVELS.slice(144, 166).filter((lv) => (lv.stones?.length ?? 0) > 0);
    expect(withStones.length).toBeGreaterThan(0);
    const spawn = new Set(spawnA().map(([x, y]) => cellKey(x, y)));
    for (const lv of withStones) {
      const w = wallSet(lv);
      for (const [x, y] of lv.stones!) {
        expect(inBounds(x, y)).toBe(true);
        expect(w.has(cellKey(x, y))).toBe(false);
        expect(spawn.has(cellKey(x, y))).toBe(false);
      }
      expect(stoneSet(lv).size).toBe(lv.stones!.length);
    }
  });

  it("前 99 关一块石头都没有", () => {
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].stones).toBeUndefined();
      expect(LEVELS[i].ring).toBeUndefined();
      expect(LEVELS[i].ringDoor).toBeUndefined();
    }
  });
});

describe("贪吃毛毛虫 1.2 · 机关三 限时星星果", () => {
  it("能撑几拍按速度折算,越快的关给的拍数越多", () => {
    expect(starTicksFor(300)).toBeGreaterThan(8);
    expect(starTicksFor(180)).toBeGreaterThan(starTicksFor(300));
    expect(starTicksFor(99999)).toBe(8);
  });

  it("倒数到零就溜走,最后几拍会提醒你快一点", () => {
    const limit = starTicksFor(300);
    expect(starLeft(0, limit)).toBe(limit);
    expect(starExpired(0, limit)).toBe(false);
    expect(starExpired(limit, limit)).toBe(true);
    expect(starHurry(0, limit)).toBe(false);
    expect(starHurry(limit - 1, limit)).toBe(true);
    expect(starHurry(limit, limit)).toBe(false);
  });
});

describe("贪吃毛毛虫 1.2 · 机关四 绕圈才能开的门", () => {
  it("绕着花坛走满一圈门才开,少一格都不行", () => {
    const ring = ringAround(4, 3);
    expect(ring).toHaveLength(8);
    const visited = new Set(ring.slice(0, 7));
    expect(ringProgress(ring, visited)).toBe(7);
    expect(ringDoorOpen(ring, visited)).toBe(false);
    visited.add(ring[7]);
    expect(ringDoorOpen(ring, visited)).toBe(true);
    expect(ringHint(ring, new Set(ring.slice(0, 5)))).toContain("3");
    expect(ringHint(ring, visited)).toContain("开");
  });

  it("贴边的花坛少几格也照样能绕,不会算出走不完的圈", () => {
    expect(ringAround(0, 0)).toHaveLength(3);
    expect(ringAround(GRID - 1, GRID - 1)).toHaveLength(3);
    // 没有圈的关卡,门当作一直开着
    expect(ringDoorOpen([], new Set())).toBe(true);
    expect(ringHint([], new Set())).toBe("");
  });

  it("无尽露水园后几座真的摆了花坛和小门,门后那格只有开门才进得去", () => {
    const g = endlessGarden(26); // (26-1)%5===0 → 露水园,k 已经够大
    expect(g.ring?.length).toBe(8);
    expect(g.ringDoor?.length).toBe(1);
    const ring = ringCells(g);
    const doors = ringDoorSet(g);
    const walls = wallSet(g);
    for (const k of ring) expect(walls.has(k)).toBe(false);
    doors.forEach((k) => expect(walls.has(k)).toBe(false));
    const from = cellKey(spawnA()[0][0], spawnA()[0][1]);
    const shut = reachableNow(g, from, { gateOpen: true, ringOpen: false });
    const open = reachableNow(g, from, { gateOpen: true, ringOpen: true });
    expect(shut.size).toBeLessThan(open.size);
    doors.forEach((k) => {
      expect(shut.has(k)).toBe(false);
      expect(open.has(k)).toBe(true);
    });
  });

  it("绕圈那一圈本身走得到,门永远开得了", () => {
    for (const n of [6, 11, 16, 21, 26, 31]) {
      const g = endlessGarden(n);
      if (!g.ring) continue;
      const from = cellKey(spawnA()[0][0], spawnA()[0][1]);
      const shut = reachableNow(g, from, { gateOpen: true, ringOpen: false });
      for (const k of ringCells(g)) expect(shut.has(k)).toBe(true);
    }
  });
});

describe("贪吃毛毛虫 1.2 · 运行时可达与放点心", () => {
  it("石头挡着的格子这会儿走不到,搬开就走得到了", () => {
    // 一条竖墙只留一个口,拿石头把口堵上
    const lv: SnakeLevel = {
      target: 5,
      tickMs: 300,
      walls: Array.from({ length: GRID }, (_, y) => [9, y] as [number, number]).filter(([, y]) => y !== 6 && y !== 0),
    };
    const from = cellKey(1, 6);
    const free = reachableNow(lv, from, { gateOpen: true, ringOpen: true });
    const blocked = reachableNow(lv, from, {
      gateOpen: true, ringOpen: true, stones: new Set([cellKey(9, 0), cellKey(9, 6)]),
    });
    expect(blocked.size).toBeLessThan(free.size);
  });

  it("点心只放在够得着又没被占的格子上,满盘了也有句软话", () => {
    const lv = LEVELS[0];
    const from = cellKey(spawnA()[0][0], spawnA()[0][1]);
    const reach = reachableNow(lv, from, { gateOpen: true, ringOpen: true });
    const taken = new Set(spawnA().map(([x, y]) => cellKey(x, y)));
    const pool = snackPool(reach, taken);
    expect(pool.length).toBeGreaterThan(0);
    for (const k of taken) expect(pool).not.toContain(k);
    const pick = pickSnack(pool, seq([0.5]));
    expect(pick).not.toBeNull();
    expect(pool).toContain(pick!);
    expect(pickSnack([], Math.random)).toBeNull();
    expect(boardFullLine()).toContain("厉害");
    expect(boardFullLine()).not.toMatch(/输|失败|笨/);
  });

  it("运行时可达和关卡设计层的连通性各管各的,1.1 的关卡校验没被改坏", () => {
    for (const n of [0, 60, 120, 150, 180]) {
      const lv = LEVELS[n];
      const from = cellKey(spawnA()[0][0], spawnA()[0][1]);
      expect(reachableNow(lv, from, { gateOpen: true, ringOpen: true }).size)
        .toBe(reachableCells(lv, from, true).size);
      expect(reachableCells(lv, from, true).size).toBe(freeCells(lv).length);
    }
  });
});

describe("贪吃毛毛虫 1.2 · 两种无尽档", () => {
  it("经典档越吃越快,休闲档一直是开局那个速度", () => {
    expect(ENDLESS_PACES).toEqual(["classic", "calm"]);
    expect(endlessTickMs("classic", 300, 0)).toBe(300);
    expect(endlessTickMs("classic", 300, 12)).toBeLessThan(300);
    expect(endlessTickMs("classic", 300, 999)).toBeGreaterThanOrEqual(FLOOR_MS);
    for (const eaten of [0, 10, 50, 300]) {
      expect(endlessTickMs("calm", 300, eaten)).toBe(300);
    }
  });

  it("两档都有中文说明,选哪档都不带贬义", () => {
    for (const p of ENDLESS_PACES) {
      expect(endlessPaceLabel(p)).not.toMatch(/[A-Za-z]/);
      expect(endlessPaceTip(p)).not.toMatch(/[A-Za-z]/);
      expect(endlessPaceTip(p).length).toBeGreaterThan(8);
    }
    expect(endlessPaceLabel("calm")).toContain("休闲");
    expect(endlessPaceLabel("classic")).toContain("经典");
  });
});

describe("贪吃毛毛虫 1.2 · 打结歇会儿", () => {
  it("撞了叫「打了个结」,一句难听话都没有", () => {
    for (const r of ["fence", "wall", "self", "twin", "mover", "stone"] as const) {
      const line = knotLine(r);
      expect(line).toContain("结");
      expect(line).not.toMatch(/[A-Za-z]/);
      expect(line).not.toMatch(/死|输|血|笨|太差|没用|不行/);
    }
  });

  it("收场先说这一趟的好事:活了多久、吃了几口", () => {
    expect(runSummary(7, 42)).toContain("42");
    expect(runSummary(7, 42)).toContain("7");
    expect(runSummary(-3, -9)).toContain("0");
    const report = knotReport("self", 12, 88);
    expect(report.indexOf("88")).toBeLessThan(report.indexOf("结"));
    expect(report).toContain("12");
  });
});

describe("贪吃毛毛虫 1.2 · 滑动转向与插值", () => {
  it("手指划得够远才算转向,横竖取幅度大的那一边", () => {
    expect(swipeDir(3, 4)).toBeNull();
    expect(swipeDir(60, 10)).toEqual(RIGHT);
    expect(swipeDir(-60, 10)).toEqual(LEFT);
    expect(swipeDir(10, 60)).toEqual(DOWN);
    expect(swipeDir(10, -60)).toEqual(UP);
    expect(SWIPE_MIN).toBeGreaterThanOrEqual(16);
  });

  it("虫身按格插值,关掉动效只是不画中间帧,状态机还是同一套", () => {
    expect(moveT(0, 200)).toBe(0);
    expect(moveT(100, 200)).toBeCloseTo(0.5, 6);
    expect(moveT(400, 200)).toBe(1);
    expect(moveT(0, 200, true)).toBe(1);
    expect(lerp(2, 6, 0.25)).toBe(3);
  });

  it("吃下去的那一口会顺着身子鼓一路,不是整条一起胖", () => {
    expect(swallowScale(0, 0)).toBeGreaterThan(1);
    expect(swallowScale(5, 0)).toBe(1);
    expect(swallowScale(2, 2)).toBeGreaterThan(swallowScale(3, 2));
  });
});

describe("贪吃毛毛虫 1.2 · 收尾", () => {
  it("188 关一关不少,前 99 关的生成参数没被动过", () => {
    expect(LEVELS).toHaveLength(188);
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].twin).toBeUndefined();
      expect(LEVELS[i].portals).toBeUndefined();
      expect(LEVELS[i].movers).toBeUndefined();
      expect(LEVELS[i].gate).toBeUndefined();
    }
  });

  it("抽样几关都摆得下目标口数的点心", () => {
    for (const n of [0, 40, 98, 110, 150, 187]) {
      const lv = LEVELS[n];
      const from = cellKey(spawnA()[0][0], spawnA()[0][1]);
      const reach = reachableNow(lv, from, { gateOpen: true, ringOpen: true, stones: stoneSet(lv) });
      expect(reach.size).toBeGreaterThan(lv.target + 6);
      reach.forEach((k) => {
        const [x, y] = cellXY(k);
        expect(inBounds(x, y)).toBe(true);
      });
    }
  });

  it("destroy 里 rAF、定时器、键盘和指针监听都收干净了", () => {
    const src = readFileSync("src/games/snake-snack/index.ts", "utf8");
    expect(src).toContain("cancelAnimationFrame");
    expect(src).toContain("clearTimeout");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain('removeEventListener("pointerdown"');
    expect(src).toContain('removeEventListener("pointerup"');
  });
});
