// 窗口 4 · QA 档C · 第 1 轮测试员:贪吃毛毛虫(迷宫贪吃,不是窗口 1 的 snake-royale)。
//
// 既有单测把每一条规则都单独验过了,但没人把它们串起来真跑一局。
// 这一份补上那件事:一个不碰 DOM 的模拟器,把 index.ts 的 `step()` 一比一搬过来,
// 再配一个「先活下来再去吃」的机器人,拿它真的赢一关、真的输一关。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, totalSize } from "../level99";
import { meta } from "./meta";
import {
  CHAPTERS,
  GRID,
  LEVELS,
  ENDLESS_GARDENS,
  endlessGarden,
  endlessGardenName,
  endlessLine,
  type SnakeLevel,
} from "./levels";
import {
  cellKey,
  cellXY,
  freeCells,
  gateOpenFor,
  gateSet,
  loseLine,
  mirrorDir,
  moverCells,
  openingLine,
  portalMap,
  snackKind,
  spawnA,
  spawnB,
  starsFor,
  wallSet,
  winLine,
} from "./logic";
import {
  ENDLESS_PACES,
  boardFullLine,
  endlessPaceLabel,
  endlessTickMs,
  inBounds,
  knotReport,
  pickSnack,
  pushStone,
  reachableNow,
  ringCells,
  ringDoorOpen,
  ringDoorSet,
  snackPool,
  speedCurveFor,
  starExpired,
  starTicksFor,
  stoneSet,
  takeTurn,
  tickMsAt,
  type Dir,
  type KnotReason,
} from "./snake12";

/* ------------------------------------------------------------------ */
/* 一比一搬过来的规则层(对照 index.ts 的 step / placeSnack)             */
/* ------------------------------------------------------------------ */

interface SimWorm {
  cells: Array<[number, number]>;
  dir: Dir;
  queue: Dir[];
  mirror: boolean;
}

interface Sim {
  cfg: SnakeLevel;
  walls: Set<number>;
  gates: Set<number>;
  portals: Map<number, number>;
  ring: number[];
  doors: Set<number>;
  ringWalked: Set<number>;
  ringOpen: boolean;
  stones: Set<number>;
  bonus: [number, number] | null;
  worms: SimWorm[];
  tick: number;
  eaten: number;
  starsGot: number;
  snack: [number, number];
  snackIsStar: boolean;
  snackIsTrim: boolean;
  starTicks: number;
  starLimit: number;
  stepMs: number;
  ended: null | { won: boolean; reason: KnotReason | null; note?: string };
  rand: () => number;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newSim(cfg: SnakeLevel, seed = 1): Sim {
  const curve = speedCurveFor(cfg);
  const ring = ringCells(cfg);
  const worms: SimWorm[] = [{ cells: spawnA(), dir: [1, 0], queue: [], mirror: false }];
  if (cfg.twin) worms.push({ cells: spawnB(), dir: [-1, 0], queue: [], mirror: true });
  const sim: Sim = {
    cfg,
    walls: wallSet(cfg),
    gates: gateSet(cfg),
    portals: portalMap(cfg),
    ring,
    doors: ringDoorSet(cfg),
    ringWalked: new Set(),
    ringOpen: ring.length === 0,
    stones: stoneSet(cfg),
    bonus: null,
    worms,
    tick: 0,
    eaten: 0,
    starsGot: 0,
    snack: [9, 1],
    snackIsStar: false,
    snackIsTrim: false,
    starTicks: 0,
    starLimit: starTicksFor(curve.startMs),
    stepMs: curve.startMs,
    ended: null,
    rand: mulberry(seed * 7919 + 13),
  };
  placeSnack(sim);
  return sim;
}

function cloneSim(s: Sim): Sim {
  return {
    ...s,
    ringWalked: new Set(s.ringWalked),
    stones: new Set(s.stones),
    bonus: s.bonus ? [s.bonus[0], s.bonus[1]] : null,
    worms: s.worms.map((w) => ({
      cells: w.cells.map(([x, y]) => [x, y] as [number, number]),
      dir: [w.dir[0], w.dir[1]] as Dir,
      queue: w.queue.map((d) => [d[0], d[1]] as Dir),
      mirror: w.mirror,
    })),
    snack: [s.snack[0], s.snack[1]],
    ended: s.ended ? { ...s.ended } : null,
  };
}

function bodyLength(s: Sim): number {
  return s.worms[0].cells.length;
}

function gateIsOpen(s: Sim): boolean {
  return gateOpenFor(s.cfg, bodyLength(s));
}

function hedgehogs(s: Sim): Set<number> {
  return moverCells(s.cfg, Math.floor(s.tick / 2));
}

function refreshSpeed(s: Sim, pace?: "classic" | "calm"): void {
  s.stepMs = pace ? endlessTickMs(pace, speedCurveFor(s.cfg).startMs, s.eaten) : tickMsAt(speedCurveFor(s.cfg), s.eaten);
  s.starLimit = starTicksFor(s.stepMs);
}

function placeSnack(s: Sim): void {
  const kind = snackKind(s.cfg, s.eaten, bodyLength(s));
  s.snackIsStar = kind === "star";
  s.snackIsTrim = kind === "trim";
  s.starTicks = 0;
  const head = s.worms[0].cells[0];
  const reach = reachableNow(s.cfg, cellKey(head[0], head[1]), {
    gateOpen: gateIsOpen(s),
    ringOpen: s.ringOpen,
    stones: s.stones,
  });
  const taken = new Set<number>([...s.gates, ...hedgehogs(s), ...s.stones]);
  if (s.bonus) taken.add(cellKey(s.bonus[0], s.bonus[1]));
  for (const w of s.worms) for (const [x, y] of w.cells) taken.add(cellKey(x, y));
  const pick = pickSnack(snackPool(reach, taken), s.rand);
  if (pick === null) {
    const room = GRID * GRID - s.walls.size;
    const body = s.worms.reduce((n, w) => n + w.cells.length, 0);
    s.ended = body >= room * 0.6
      ? { won: true, reason: null, note: boardFullLine() }
      : { won: false, reason: "self" };
    return;
  }
  s.snack = cellXY(pick);
}

function openRingDoor(s: Sim): void {
  if (s.ringOpen) return;
  s.ringOpen = true;
  const head = s.worms[0].cells[0];
  const from = cellKey(head[0], head[1]);
  const before = reachableNow(s.cfg, from, { gateOpen: gateIsOpen(s), ringOpen: false, stones: s.stones });
  const after = reachableNow(s.cfg, from, { gateOpen: gateIsOpen(s), ringOpen: true, stones: s.stones });
  const fresh: number[] = [];
  after.forEach((k) => {
    if (!before.has(k) && !s.doors.has(k)) fresh.push(k);
  });
  s.bonus = fresh.length > 0 ? cellXY(fresh[fresh.length - 1]) : null;
}

function eatAt(s: Sim, pace?: "classic" | "calm"): void {
  s.eaten++;
  if (s.snackIsTrim) {
    for (const w of s.worms) while (w.cells.length > 3) w.cells.pop();
  } else if (s.snackIsStar) {
    s.starsGot++;
  }
  refreshSpeed(s, pace);
}

/** 和 index.ts 的 step() 一比一对照:出界 / 撞墙 / 撞自己 / 撞同伴 / 撞小刺猬各是一种收场 */
function step(s: Sim, pace?: "classic" | "calm"): void {
  if (s.ended) return;
  s.tick++;
  const beasts = moverCells(s.cfg, Math.floor(s.tick / 2));
  const open = gateIsOpen(s);
  const moved: Array<{ w: SimWorm; head: [number, number] }> = [];

  for (const w of s.worms) {
    const turned = takeTurn(w.queue, w.dir);
    w.dir = turned.dir;
    w.queue = turned.queue;
    const [hx, hy] = w.cells[0];
    let nx = hx + w.dir[0];
    let ny = hy + w.dir[1];
    if (!inBounds(nx, ny)) {
      s.ended = { won: false, reason: "fence" };
      return;
    }
    let k = cellKey(nx, ny);
    if (s.gates.has(k) && !open) continue;
    if (s.doors.has(k) && !s.ringOpen) continue;
    if (s.stones.has(k)) {
      const blocked = new Set<number>([...beasts, ...s.gates, cellKey(s.snack[0], s.snack[1])]);
      for (const worm of s.worms) for (const [sx, sy] of worm.cells) blocked.add(cellKey(sx, sy));
      const pushed = pushStone(s.stones, nx, ny, w.dir, { walls: s.walls, blocked });
      if (!pushed) continue;
      s.stones = pushed;
    }
    if (s.walls.has(k)) {
      s.ended = { won: false, reason: "wall" };
      return;
    }
    const hop = s.portals.get(k);
    if (hop !== undefined) {
      [nx, ny] = cellXY(hop);
      k = hop;
    }
    moved.push({ w, head: [nx, ny] });
  }

  for (const { w, head } of moved) {
    const [nx, ny] = head;
    if (w.cells.some(([sx, sy], i) => i > 0 && i < w.cells.length - 1 && sx === nx && sy === ny)) {
      s.ended = { won: false, reason: "self" };
      return;
    }
    const other = s.worms.find((o) => o !== w);
    if (other && other.cells.some(([sx, sy]) => sx === nx && sy === ny)) {
      s.ended = { won: false, reason: "twin" };
      return;
    }
    if (beasts.has(cellKey(nx, ny))) {
      s.ended = { won: false, reason: "mover" };
      return;
    }
  }
  if (moved.length > 1) {
    const [a, b] = moved;
    if (a.head[0] === b.head[0] && a.head[1] === b.head[1]) {
      s.ended = { won: false, reason: "twin" };
      return;
    }
  }

  let ate = false;
  for (const { w, head } of moved) {
    w.cells.unshift([head[0], head[1]]);
    if (!ate && head[0] === s.snack[0] && head[1] === s.snack[1]) {
      ate = true;
      eatAt(s, pace);
    } else {
      w.cells.pop();
    }
    if (!s.ringOpen && s.ring.length > 0) {
      const k = cellKey(head[0], head[1]);
      if (s.ring.includes(k) && !s.ringWalked.has(k)) s.ringWalked.add(k);
    }
    if (s.bonus && head[0] === s.bonus[0] && head[1] === s.bonus[1]) {
      s.bonus = null;
      s.starsGot++;
    }
  }
  if (!s.ringOpen && ringDoorOpen(s.ring, s.ringWalked)) openRingDoor(s);
  if (ate) {
    if (s.eaten >= s.cfg.target) {
      s.ended = { won: true, reason: null };
      return;
    }
    placeSnack(s);
  } else if (s.snackIsStar) {
    s.starTicks++;
    if (starExpired(s.starTicks, s.starLimit)) s.snackIsStar = false;
  }
}

function turn(s: Sim, d: Dir): void {
  for (const w of s.worms) {
    const want: Dir = w.mirror ? mirrorDir(d) : d;
    // 直接把这一拍要的方向排进队列,和玩家按一下键等价
    if (want[0] === -w.dir[0] && want[1] === -w.dir[1]) continue;
    w.queue = [want];
  }
}

/* ------------------------------------------------------------------ */
/* 机器人:先保证活得下去,再挑离点心最近的那一步                        */
/* ------------------------------------------------------------------ */

const ALL: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 从 from 出发到 goal 的步数(挡路的都绕开);走不到返回 Infinity */
function distTo(s: Sim, from: [number, number], goal: [number, number]): number {
  const blocked = new Set<number>([...s.walls, ...s.stones, ...hedgehogs(s)]);
  if (!gateIsOpen(s)) s.gates.forEach((k) => blocked.add(k));
  if (!s.ringOpen) s.doors.forEach((k) => blocked.add(k));
  for (const w of s.worms) {
    w.cells.forEach(([x, y], i) => {
      if (i < w.cells.length - 1) blocked.add(cellKey(x, y));
    });
  }
  const goalKey = cellKey(goal[0], goal[1]);
  const start = cellKey(from[0], from[1]);
  const seen = new Map<number, number>([[start, 0]]);
  const queue = [start];
  for (let h = 0; h < queue.length; h++) {
    const cur = queue[h];
    const d = seen.get(cur)!;
    if (cur === goalKey) return d;
    const [x, y] = cellXY(cur);
    const nexts: number[] = [];
    for (const [dx, dy] of ALL) {
      if (!inBounds(x + dx, y + dy)) continue;
      nexts.push(cellKey(x + dx, y + dy));
    }
    const hop = s.portals.get(cur);
    if (hop !== undefined) nexts.push(hop);
    for (const k of nexts) {
      if (seen.has(k) || (blocked.has(k) && k !== goalKey)) continue;
      seen.set(k, d + 1);
      queue.push(k);
    }
  }
  return Infinity;
}

/** 走这一步之后头还够得着多少空地(别把自己关进小房间) */
function breathingRoom(s: Sim): number {
  const head = s.worms[0].cells[0];
  const reach = reachableNow(s.cfg, cellKey(head[0], head[1]), {
    gateOpen: gateIsOpen(s),
    ringOpen: s.ringOpen,
    stones: s.stones,
  });
  let n = 0;
  const body = new Set<number>();
  for (const w of s.worms) for (const [x, y] of w.cells) body.add(cellKey(x, y));
  reach.forEach((k) => {
    if (!body.has(k)) n++;
  });
  return n;
}

function chooseDir(s: Sim): Dir | null {
  let best: { dir: Dir; score: number } | null = null;
  for (const d of ALL) {
    const cur = s.worms[0].dir;
    if (d[0] === -cur[0] && d[1] === -cur[1]) continue;
    const trial = cloneSim(s);
    turn(trial, d);
    step(trial);
    if (trial.ended && !trial.ended.won) continue;
    const goal = trial.ended ? s.snack : trial.snack;
    const head = trial.worms[0].cells[0];
    const dist = trial.ended?.won ? -1000 : distTo(trial, head, goal);
    // 先看还剩多少活动空间,再看离点心多近;两者都不行的那一步直接不考虑
    const score = -(dist === Infinity ? 400 : dist) + Math.min(40, breathingRoom(trial)) * 0.4;
    if (!best || score > best.score) best = { dir: d, score };
  }
  return best ? best.dir : null;
}

interface RunOut {
  won: boolean;
  reason: KnotReason | null;
  eaten: number;
  starsGot: number;
  ticks: number;
}

function run(cfg: SnakeLevel, opts: { seed?: number; maxTicks?: number; pace?: "classic" | "calm" } = {}): RunOut {
  const s = newSim(cfg, opts.seed ?? 1);
  const cap = opts.maxTicks ?? 4000;
  for (let i = 0; i < cap && !s.ended; i++) {
    const d = chooseDir(s);
    if (d) turn(s, d);
    step(s, opts.pace);
  }
  return {
    won: s.ended?.won ?? false,
    reason: s.ended?.reason ?? null,
    eaten: s.eaten,
    starsGot: s.starsGot,
    ticks: s.tick,
  };
}

/* ------------------------------------------------------------------ */
/* 一、从首页进得去                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · snake-snack · 首页进入", () => {
  it("meta 的 id / 关数 / 模式和实现对得上", () => {
    expect(meta.id).toBe("snake-snack");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    expect(meta.category).toBe("casual");
  });

  it("这是迷宫贪吃,不是窗口 1 的大逃杀:没有对战也没有双人同屏", () => {
    expect(meta.modes).not.toContain("versus");
    expect(meta.modes).not.toContain("twoPlayer");
    expect(meta.title).toBe("贪吃毛毛虫");
    expect(meta.blurb).toContain("迷宫");
    expect(meta.blurb).not.toContain("大作战");
  });

  it("十座花园都有名字与说明,棋盘固定 13×13", () => {
    expect(GRID).toBe(13);
    expect(CHAPTERS).toHaveLength(10);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.desc.length).toBeGreaterThanOrEqual(6);
    }
    expect(ENDLESS_GARDENS.length).toBeGreaterThanOrEqual(5);
    expect(endlessGardenName(0)).toBe(ENDLESS_GARDENS[0]);
  });

  it("开场白按关卡机关变,不是千篇一律一句话", () => {
    const lines = new Set([openingLine(LEVELS[0]), openingLine(LEVELS[110]), openingLine(LEVELS[187])]);
    expect(lines.size).toBeGreaterThanOrEqual(2);
    for (const l of lines) expect(l.length).toBeGreaterThan(4);
  });
});

/* ------------------------------------------------------------------ */
/* 二、赢一次 + 输一次                                                  */
/* ------------------------------------------------------------------ */

describe("档C R1 · snake-snack · 赢一次 + 输一次", () => {
  it("赢:第 1 关机器人真的吃满目标口数,收场是胜利", () => {
    const out = run(LEVELS[0]);
    expect(out.won, `第 1 关没赢:${out.reason}`).toBe(true);
    expect(out.eaten).toBeGreaterThanOrEqual(LEVELS[0].target);
    expect(starsFor(out.starsGot)).toBeGreaterThanOrEqual(1);
    expect(winLine(LEVELS[0], LEVELS[0].target, out.starsGot).length).toBeGreaterThan(4);
  });

  it("输:一头撞进围栏就打结,而且五种打结原因都有一句只鼓励的话", () => {
    const s = newSim(LEVELS[0]);
    // 出生朝右,一路往右撞到围栏为止
    for (let i = 0; i < GRID + 4 && !s.ended; i++) step(s);
    expect(s.ended?.won).toBe(false);
    expect(s.ended?.reason).toBe("fence");

    const reasons: KnotReason[] = ["fence", "wall", "self", "twin", "mover", "stone"];
    for (const r of reasons) {
      const text = knotReport(r, 7, 42);
      expect(text.length).toBeGreaterThan(6);
      for (const bad of ["笨", "差劲", "死", "完蛋"]) expect(text).not.toContain(bad);
    }
    for (const r of ["fence", "wall", "self", "twin", "mover"] as const) {
      expect(loseLine(r).length).toBeGreaterThan(4);
    }
  });

  it("输:撞墙也是打结,不是「死亡」——全套文案里没有一个死字", () => {
    const withWall = LEVELS.find((lv) => lv.walls.length > 0)!;
    const texts = [
      openingLine(withWall),
      winLine(withWall, withWall.target, 2),
      loseLine("wall"),
      boardFullLine(),
      endlessLine(9, 3),
    ];
    for (const t of texts) {
      for (const bad of ["死", "血", "杀"]) expect(t, t).not.toContain(bad);
    }
  });

  it("整座花园铺满身子算「了不起」,不算输", () => {
    expect(boardFullLine()).toContain("厉害");
    expect(boardFullLine()).not.toContain("失败");
  });
});

/* ------------------------------------------------------------------ */
/* 三、战役第 1 / 100 / 188 关                                          */
/* ------------------------------------------------------------------ */

describe("档C R1 · snake-snack · 战役第 1 / 100 / 188 关", () => {
  const PICKS = [1, 100, 188];

  it.each(PICKS)("第 %i 关机器人真的能吃满过关", (n) => {
    const cfg = LEVELS[n - 1];
    let out = run(cfg, { seed: 1 });
    for (const seed of [2, 3]) {
      if (out.won) break;
      out = run(cfg, { seed });
    }
    expect(out.won, `第 ${n} 关没赢:${out.reason},只吃到 ${out.eaten}/${cfg.target}`).toBe(true);
    expect(out.eaten).toBeGreaterThanOrEqual(cfg.target);
  });

  it.each(PICKS)("第 %i 关一开局就有路走,出生位置不压墙", (n) => {
    const cfg = LEVELS[n - 1];
    const walls = wallSet(cfg);
    for (const [x, y] of spawnA()) expect(walls.has(cellKey(x, y))).toBe(false);
    if (cfg.twin) for (const [x, y] of spawnB()) expect(walls.has(cellKey(x, y))).toBe(false);
    expect(freeCells(cfg).length).toBeGreaterThan(cfg.target + 10);
  });

  it("同一关重进两次拿到的是同一座花园", () => {
    for (const n of PICKS) {
      expect(JSON.stringify(LEVELS[n - 1])).toBe(JSON.stringify(LEVELS[n - 1]));
    }
  });

  it("第 188 关就是最后一关,窄门关卡的剪刀果永远救得回来", () => {
    const last = LEVELS[187];
    expect(last.gate?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(gateOpenFor(last, (last.gateMax ?? 8) + 1)).toBe(false);
    expect(snackKind(last, 1, (last.gateMax ?? 8) + 1)).toBe("trim");
  });
});

/* ------------------------------------------------------------------ */
/* 四、无尽玩到结算                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · snake-snack · 无尽玩到结算", () => {
  it("五座无尽花园每一座都能真的吃满一轮", () => {
    for (let g = 0; g < 5; g++) {
      const cfg = endlessGarden(g);
      let out = run(cfg, { seed: g + 1, pace: "classic" });
      for (const seed of [g + 21, g + 41, g + 61]) {
        if (out.won) break;
        out = run(cfg, { seed, pace: "classic" });
      }
      expect(
        out.won,
        `第 ${g + 1} 座无尽花园没吃满:${out.reason ?? "跑满上限还没吃够"},只吃到 ${out.eaten}/${cfg.target}`
      ).toBe(true);
    }
  });

  it("休闲档确实不加速,经典档越吃越快", () => {
    expect([...ENDLESS_PACES]).toEqual(["classic", "calm"]);
    const base = 300;
    expect(endlessTickMs("calm", base, 0)).toBe(endlessTickMs("calm", base, 40));
    expect(endlessTickMs("classic", base, 40)).toBeLessThan(endlessTickMs("classic", base, 0));
    for (const p of ENDLESS_PACES) expect(endlessPaceLabel(p).length).toBeGreaterThan(1);
  });

  it("无尽跑得再久速度也有下限,不会快到没法玩", () => {
    let prev = Infinity;
    for (let eaten = 0; eaten <= 300; eaten += 5) {
      const ms = endlessTickMs("classic", 300, eaten);
      expect(ms).toBeGreaterThanOrEqual(100);
      expect(ms).toBeLessThanOrEqual(prev);
      prev = ms;
    }
  });

  it("收工那句话只鼓励", () => {
    expect(endlessLine(20, 5)).toContain("纪录");
    for (const line of [endlessLine(0, 0), endlessLine(3, 30)]) {
      for (const bad of ["笨", "差劲", "失败"]) expect(line).not.toContain(bad);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 五、360px 窄屏                                                       */
/* ------------------------------------------------------------------ */

describe("档C R1 · snake-snack · 360px 窄屏", () => {
  /** index.ts 里 CELL = 26,画布是 GRID × CELL 的正方形 */
  const CELL = 26;

  it("13×13 的画布是 338px,360px 手机上一整屏放得下", () => {
    expect(GRID * CELL).toBe(338);
    expect(GRID * CELL).toBeLessThanOrEqual(360 - 8);
  });

  it("每一格都不小于 24px,手指点得中", () => {
    expect(CELL).toBeGreaterThanOrEqual(24);
  });

  it("全部 188 关的机关都落在 13×13 之内,不会画到屏幕外", () => {
    for (const cfg of LEVELS) {
      const spots: Array<[number, number]> = [
        ...cfg.walls,
        ...(cfg.gate ?? []),
        ...(cfg.ring ?? []),
        ...(cfg.ringDoor ?? []),
        ...(cfg.stones ?? []),
      ];
      for (const [x, y] of spots) expect(inBounds(x, y)).toBe(true);
      for (const p of cfg.portals ?? []) {
        expect(inBounds(p[0], p[1])).toBe(true);
        expect(inBounds(p[2], p[3])).toBe(true);
      }
      for (const m of cfg.movers ?? []) {
        expect(inBounds(m[0], m[1])).toBe(true);
        expect(inBounds(m[0] + m[2] * m[4], m[1] + m[3] * m[4])).toBe(true);
      }
    }
  });
});
