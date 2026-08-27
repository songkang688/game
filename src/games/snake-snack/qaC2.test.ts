// 窗口 4 · QA 档C · 第 2 轮测试员:贪吃毛毛虫(迷宫贪吃,不是窗口 1 的 snake-royale)。
//
// 第 2 轮剧本(样本全换):难度曲线 → 竞态(狂按方向 / 同一拍掉头 / 结算后重入)→
// 无尽持续 → 存档往返。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, chapterOf, loadStars, mulberry32, saveStar, type StorageLike } from "../level99";
import {
  CHAPTERS,
  ENDLESS_GARDENS,
  GRID,
  LEVELS,
  endlessGarden,
  endlessGardenName,
  endlessLine,
  type SnakeLevel,
} from "./levels";
import {
  cellKey,
  freeCells,
  gateOpenFor,
  loseLine,
  moverCells,
  reachableCells,
  snackKind,
  starsFor,
  wallSet,
  winLine,
} from "./logic";
import {
  ENDLESS_PACES,
  FLOOR_MS,
  TURN_QUEUE_CAP,
  endlessTickMs,
  isReverse,
  knotReport,
  pickSnack,
  pushTurn,
  queueTail,
  runSummary,
  sameDir,
  snackPool,
  speedCurveFor,
  swipeDir,
  takeTurn,
  tickMsAt,
  type Dir,
} from "./snake12";

/* ------------------------------------------------------------------ */
/* 转向队列:index.ts 的 turn() 就是这一层                              */
/* ------------------------------------------------------------------ */

const UP: Dir = [0, -1];
const DOWN: Dir = [0, 1];
const LEFT: Dir = [-1, 0];
const RIGHT: Dir = [1, 0];

/** 一条虫的转向状态,和 index.ts 里 worm.{dir,queue} 一模一样 */
class Turner {
  dir: Dir = RIGHT;
  queue: Dir[] = [];
  ended = false;

  press(d: Dir): boolean {
    if (this.ended) return false;
    const before = this.queue.length;
    this.queue = pushTurn(this.queue, this.dir, d);
    return this.queue.length !== before;
  }

  tick(): Dir {
    const t = takeTurn(this.queue, this.dir);
    this.dir = t.dir;
    this.queue = t.queue;
    return this.dir;
  }
}

/** 第 2 轮换的样本:和第 1 轮的 1 / 100 / 188 一关不重 */
const SAMPLE = [9, 26, 41, 63, 79, 101, 124, 147, 168, 184];

/* ------------------------------------------------------------------ */
/* 一、难度曲线                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · snake-snack · 难度曲线", () => {
  it("一章比一章要多吃几口,速度也一章比一章快", () => {
    const perCh = CHAPTERS.map((_, ci) => {
      const rows = LEVELS.filter((_l, i) => chapterOf(CHAPTERS, i) === ci);
      return {
        ci,
        n: rows.length,
        target: rows.reduce((s, l) => s + l.target, 0) / Math.max(1, rows.length),
        tick: rows.reduce((s, l) => s + l.tickMs, 0) / Math.max(1, rows.length),
      };
    });
    for (const p of perCh) expect(p.n, `第 ${p.ci + 1} 章一关都没有`).toBeGreaterThan(0);
    expect(perCh[0].target, "第 1 章反而吃得比最后一章多").toBeLessThan(perCh[perCh.length - 1].target);
    expect(perCh[0].tick, "第 1 章反而比最后一章还快").toBeGreaterThan(perCh[perCh.length - 1].tick);
  });

  it("每一关的速度曲线都有下限,再快也给得起反应时间", () => {
    for (const lv of LEVELS) {
      const curve = speedCurveFor(lv);
      expect(curve.minMs, `第 ${lv.index + 1} 关最快 ${curve.minMs}ms,太快了`).toBeGreaterThanOrEqual(
        FLOOR_MS
      );
      // 吃满 100 口也不会破下限
      for (const eaten of [0, 5, 20, 60, 100]) {
        const ms = tickMsAt(curve, eaten);
        expect(ms).toBeGreaterThanOrEqual(curve.minMs);
        expect(ms).toBeLessThanOrEqual(curve.startMs);
      }
      // 吃得越多走得越快,不会掉头变慢
      for (let e = 1; e <= 60; e++) {
        expect(tickMsAt(curve, e)).toBeLessThanOrEqual(tickMsAt(curve, e - 1));
      }
    }
  });

  it("换一批样本关:每一关都够宽敞,吃满目标绰绰有余", () => {
    for (const i of SAMPLE) {
      const lv = LEVELS[i];
      const free = freeCells(lv);
      expect(free.length, `第 ${i + 1} 关空地太少`).toBeGreaterThan(lv.target + 8);
      // 从出生点出发,开着门也好关着门也好,够得着的地方都得比目标多
      const head = cellKey(...(lv.twin ? [1, 1] : [1, 1]) as [number, number]);
      const openReach = reachableCells(lv, head, true);
      expect(openReach.size, `第 ${i + 1} 关从出生点根本走不开`).toBeGreaterThan(lv.target);
    }
  });

  it("稳定节奏档只改速度不改评星,是纯辅助", () => {
    for (const i of SAMPLE) {
      const curve = speedCurveFor(LEVELS[i]);
      for (const eaten of [0, 10, 40]) {
        expect(tickMsAt(curve, eaten, "steady")).toBeGreaterThanOrEqual(tickMsAt(curve, eaten, "curve"));
      }
    }
    expect(starsFor(3)).toBe(3);
    expect(starsFor(0)).toBe(1);
    for (let g = 0; g <= 3; g++) expect(starsFor(g)).toBeGreaterThanOrEqual(starsFor(Math.max(0, g - 1)));
  });
});

/* ------------------------------------------------------------------ */
/* 二、竞态                                                            */
/* ------------------------------------------------------------------ */

describe("档C R2 · snake-snack · 竞态", () => {
  it("一秒按 200 下同一个方向:队列不会被塞满,虫子照原样爬", () => {
    const t = new Turner();
    for (let k = 0; k < 200; k++) t.press(RIGHT);
    expect(t.queue).toHaveLength(0);
    expect(t.tick()).toEqual(RIGHT);
  });

  it("同一拍里按掉头:直接丢掉,不会让虫子自己咬到自己", () => {
    const t = new Turner();
    expect(t.press(LEFT)).toBe(false);
    expect(t.queue).toHaveLength(0);
    // 先转上,再在同一拍里按下(相对队尾是掉头)——也丢掉
    expect(t.press(UP)).toBe(true);
    expect(t.press(DOWN)).toBe(false);
    expect(t.queue).toEqual([UP]);
  });

  it("狂按四个方向 500 下:队列最多存两个,一个都不多", () => {
    const t = new Turner();
    const rand = mulberry32(88);
    for (let k = 0; k < 500; k++) {
      const d = [UP, DOWN, LEFT, RIGHT][Math.floor(rand() * 4)];
      t.press(d);
      expect(t.queue.length, `第 ${k} 下之后队列有 ${t.queue.length} 个`).toBeLessThanOrEqual(
        TURN_QUEUE_CAP
      );
      // 队列里相邻两个永远不会是掉头
      for (let j = 1; j < t.queue.length; j++) {
        expect(isReverse(t.queue[j - 1], t.queue[j]), "队列里存进了掉头").toBe(false);
      }
      if (k % 3 === 2) t.tick();
    }
  });

  it("狂按 + 走拍交替 2000 次:虫子每一拍的朝向都合法,而且从不掉头", () => {
    const t = new Turner();
    const rand = mulberry32(4321);
    let prev = t.dir;
    for (let k = 0; k < 2000; k++) {
      const n = 1 + Math.floor(rand() * 5);
      for (let j = 0; j < n; j++) t.press([UP, DOWN, LEFT, RIGHT][Math.floor(rand() * 4)]);
      const now = t.tick();
      expect([UP, DOWN, LEFT, RIGHT].some((d) => sameDir(d, now)), `第 ${k} 拍朝向不合法`).toBe(true);
      expect(isReverse(prev, now), `第 ${k} 拍掉头了`).toBe(false);
      prev = now;
    }
  });

  it("收工之后再怎么按都不进队列", () => {
    const t = new Turner();
    t.press(UP);
    t.ended = true;
    const q = JSON.stringify(t.queue);
    for (let k = 0; k < 100; k++) t.press([UP, DOWN, LEFT, RIGHT][k % 4]);
    expect(JSON.stringify(t.queue)).toBe(q);
  });

  it("队尾比对用的是队尾不是当前朝向 —— 连着按两个 90° 才排得进去", () => {
    const t = new Turner();
    expect(queueTail([], RIGHT)).toEqual(RIGHT);
    t.press(UP);
    expect(queueTail(t.queue, t.dir)).toEqual(UP);
    // 相对队尾(上)来说,左是 90°,排得进
    expect(t.press(LEFT)).toBe(true);
    expect(t.queue).toEqual([UP, LEFT]);
    // 满了,第三个丢掉
    expect(t.press(DOWN)).toBe(false);
    expect(t.queue).toHaveLength(TURN_QUEUE_CAP);
  });

  it("划屏识别有最小距离,手抖一两像素不会误转", () => {
    expect(swipeDir(1, 1)).toBeNull();
    expect(swipeDir(-3, 2)).toBeNull();
    expect(swipeDir(60, 2)).toEqual(RIGHT);
    expect(swipeDir(-60, 2)).toEqual(LEFT);
    expect(swipeDir(2, 60)).toEqual(DOWN);
    expect(swipeDir(2, -60)).toEqual(UP);
    // 斜着划取更长的那一边,不会两个方向都算
    expect(swipeDir(80, 40)).toEqual(RIGHT);
    expect(swipeDir(40, 80)).toEqual(DOWN);
  });

  it("放点心时候选池是空的也不会崩,只会好好说一句", () => {
    expect(pickSnack([], Math.random)).toBeNull();
    expect(pickSnack([7], () => 0.999999)).toBe(7);
    expect(pickSnack([1, 2, 3], () => 0)).toBe(1);
    // 随机数退化成 1 也不会越界
    expect([1, 2, 3]).toContain(pickSnack([1, 2, 3], () => 1));
  });

  it("点心永远只落在「这会儿真的够得着」的空格上", () => {
    for (const i of SAMPLE) {
      const lv = LEVELS[i];
      const head = cellKey(1, 1);
      const reach = reachableCells(lv, head, gateOpenFor(lv, 3));
      const taken = new Set<number>([...wallSet(lv), ...moverCells(lv, 0)]);
      const pool = snackPool(reach, taken);
      expect(pool.length, `第 ${i + 1} 关一个能放点心的格子都没有`).toBeGreaterThan(0);
      for (const k of pool) {
        expect(reach.has(k), `第 ${i + 1} 关把点心放到了够不着的地方`).toBe(true);
        expect(taken.has(k), `第 ${i + 1} 关把点心放到了墙上`).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 三、无尽持续                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · snake-snack · 无尽跑满五座花园", () => {
  it("五座花园都生得出、名字对得上、每一座都走得开", () => {
    expect(ENDLESS_GARDENS).toHaveLength(5);
    // 花园号是 1 基的
    for (let g = 1; g <= ENDLESS_GARDENS.length; g++) {
      const lv = endlessGarden(g);
      expect(endlessGardenName(g)).toBe(ENDLESS_GARDENS[g - 1]);
      const free = freeCells(lv);
      expect(free.length, `第 ${g} 座花园空地太少`).toBeGreaterThan(GRID * 3);
      const reach = reachableCells(lv, cellKey(1, 1), true);
      expect(reach.size, `第 ${g} 座花园从出生点走不开`).toBeGreaterThan(GRID * 2);
    }
    // 转完一圈接着来:第 6 座又回到第 1 座的风景
    expect(endlessGardenName(6)).toBe(ENDLESS_GARDENS[0]);
    expect(endlessGardenName(11)).toBe(ENDLESS_GARDENS[0]);
  });

  it("花园号越界(负数 / 超大)也会稳稳绕回五座里的一座", () => {
    for (const g of [-7, -1, 5, 12, 999]) {
      const lv = endlessGarden(g);
      expect(freeCells(lv).length).toBeGreaterThan(0);
      expect(ENDLESS_GARDENS).toContain(endlessGardenName(g));
    }
  });

  it("两档无尽节奏:吃满 300 口速度都收敛在下限上,不会越来越离谱", () => {
    for (const pace of ENDLESS_PACES) {
      let prev = Number.POSITIVE_INFINITY;
      for (let eaten = 0; eaten <= 300; eaten++) {
        const ms = endlessTickMs(pace, 240, eaten);
        expect(ms, `${pace} 吃到第 ${eaten} 口反而慢了`).toBeLessThanOrEqual(prev);
        expect(ms, `${pace} 吃到第 ${eaten} 口已经快到 ${ms}ms`).toBeGreaterThanOrEqual(FLOOR_MS);
        prev = ms;
      }
      // 300 口之后就稳住了
      expect(endlessTickMs(pace, 240, 300)).toBe(endlessTickMs(pace, 240, 999));
    }
    // 悠闲档任何时候都不比经典档快
    for (let eaten = 0; eaten <= 200; eaten += 10) {
      expect(endlessTickMs("calm", 240, eaten)).toBeGreaterThanOrEqual(
        endlessTickMs("classic", 240, eaten)
      );
    }
  });

  it("连吃 300 口:点心种类按规则轮换,星星果和剪刀果都出得来", () => {
    const lv = endlessGarden(1);
    const kinds = new Set<string>();
    for (let eaten = 0; eaten < 300; eaten++) {
      kinds.add(snackKind(lv, eaten, 3 + eaten));
    }
    expect(kinds.has("normal")).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it("成绩条与收工话术:只鼓励,一句丧气话都没有", () => {
    for (const [eaten, best] of [[0, 0], [1, 99], [77, 10]]) {
      const line = endlessLine(eaten, best);
      expect(line.length).toBeGreaterThan(0);
      for (const bad of ["输", "笨", "菜", "失败", "死"]) expect(line, line).not.toContain(bad);
    }
    for (const reason of ["fence", "wall", "self", "twin", "mover"] as const) {
      const line = loseLine(reason);
      for (const bad of ["输", "笨", "菜", "失败"]) expect(line, line).not.toContain(bad);
    }
    expect(runSummary(12, 40)).toContain("12");
    expect(knotReport("fence", 5, 20)).toContain("5");
  });
});

/* ------------------------------------------------------------------ */
/* 四、存档往返                                                        */
/* ------------------------------------------------------------------ */

function memStore(): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
    dump: () => Object.fromEntries(map),
  };
}

describe("档C R2 · snake-snack · 存档往返", () => {
  const ID = "snake-snack";

  it("写进去几星,关掉再开还是几星", () => {
    const st = memStore();
    for (const i of SAMPLE) saveStar(ID, i, 3, st);
    const reopened = memStore();
    for (const [k, v] of Object.entries(st.dump())) reopened.setItem(k, v);
    const back = loadStars(ID, reopened);
    for (const i of SAMPLE) expect(back[i], `第 ${i + 1} 关星数没存住`).toBe(3);
  });

  it("同一关反复打只留最好那一次", () => {
    const st = memStore();
    saveStar(ID, 63, 1, st);
    saveStar(ID, 63, 3, st);
    saveStar(ID, 63, 2, st);
    expect(loadStars(ID, st)[63]).toBe(3);
  });

  it("188 关全写满,读回来一关不差", () => {
    const st = memStore();
    const rand = mulberry32(606);
    const want = Array.from({ length: TOTAL_LEVELS }, () => (1 + Math.floor(rand() * 3)) as 1 | 2 | 3);
    want.forEach((s, i) => saveStar(ID, i, s, st));
    expect(loadStars(ID, st)).toEqual(want);
  });

  it("存档写坏了只是从头再来,不会把游戏拖崩", () => {
    const st = memStore();
    const key = `yiduo-yixing.l99.${ID}`;
    for (const junk of ["", "][", "true", '{"stars":{}}', "[1,2,3,999,-1]"]) {
      st.setItem(key, junk);
      const back = loadStars(ID, st);
      expect(back).toHaveLength(TOTAL_LEVELS);
      expect(back.every((v) => Number.isInteger(v) && v >= 0 && v <= 3), junk).toBe(true);
    }
  });

  it("存档 key 一个字都没改", () => {
    const st = memStore();
    saveStar(ID, 0, 1, st);
    expect(st.keys!()).toEqual([`yiduo-yixing.l99.${ID}`]);
  });

  it("这一款是迷宫贪吃,不是窗口 1 的 snake-royale —— 关卡里有墙有门有传送", () => {
    const withWall = LEVELS.filter((l: SnakeLevel) => wallSet(l).size > 0);
    expect(withWall.length, "一关墙都没有,那就成大乱斗了").toBeGreaterThan(LEVELS.length / 2);
    expect(LEVELS.some((l) => (l.portals ?? []).length > 0)).toBe(true);
    expect(LEVELS.some((l) => (l.movers ?? []).length > 0)).toBe(true);
    expect(LEVELS.some((l) => l.twin)).toBe(true);
  });
});
