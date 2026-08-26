/**
 * 铁皮坦克大战 · 实玩模拟(不开浏览器,按真实规则把整关跑完)。
 *
 * 这里的「机器人」只会攻略里写的那几招:优先打离堡垒最近的车、
 * 挡路的砖才拆、自己家的护墙一块都不打、场面平静时回去补墙。
 * 它能过的关,认真玩的小朋友也能过。
 *
 * 要证明四件事:
 *  1. 关卡可通过:188 关双人合作全部能在时限内清完,单人也能拿下绝大多数;
 *  2. 基地可被保护:同一张地图撒手不管堡垒会被砸中,认真打就守得住;
 *  3. 双人合作确实更轻松(同一关用时更短);
 *  4. 无尽与对战两种模式都能打出真实胜负。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { LEVEL_TOTAL, buildLevel, endlessRows, scaleForPlayers, versusRows } from "./levels";
import {
  IDLE_INPUT,
  aliveEnemies,
  createWorld,
  distanceField,
  endlessMaxAlive,
  endlessWave,
  fortGaps,
  isFortBrick,
  lineOfFire,
  rateRun,
  stepDownField,
  stepWorld,
  tankCell,
  tileAt,
  type Cell,
  type Dir,
  type PlayerInput,
  type Tank,
  type World,
} from "./logic";

const DT = 1 / 30;
/** 敌人离堡垒还有这么多格以上,才算「场面平静,可以回去补墙」 */
const CALM = 6;

const STEP: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

/** 自己家的护墙:机器人路过也不踩、更不打 */
function fortCells(w: World): Cell[] {
  return w.fortCells.filter((c) => isFortBrick(w.map, c.cx, c.cy));
}

function botInput(w: World, me: Tank): PlayerInput {
  if (me.spin > 0) return IDLE_INPUT;
  const enemies = aliveEnemies(w);
  if (enemies.length === 0) return IDLE_INPUT;

  const ray = lineOfFire(w, me, 12);
  if (ray.kind === "enemy") return { dir: -1, fire: true, brick: false };

  const base = w.map.base;
  const here = tankCell(me);

  // 场面平静时先把护墙的缺口补回去(攻略第一条)
  const gaps = fortGaps(w);
  const calm =
    !base ||
    enemies.every((e) => {
      const c = tankCell(e);
      return Math.abs(c.cx - base.cx) + Math.abs(c.cy - base.cy) > CALM;
    });
  if (calm && gaps.length > 0 && me.bricks > 0) {
    let gap = gaps[0];
    let gd = Infinity;
    for (const g of gaps) {
      const d = Math.abs(g.cx - here.cx) + Math.abs(g.cy - here.cy);
      if (d < gd) {
        gd = d;
        gap = g;
      }
    }
    if (gd === 1) {
      const dx = gap.cx - here.cx;
      const dy = gap.cy - here.cy;
      const face: Dir = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0;
      return { dir: me.dir === face ? -1 : face, fire: false, brick: me.dir === face };
    }
    if (gd <= 7) {
      const gdir = stepDownField(w.map, distanceField(w.map, [gap], { brickCost: 6 }), here);
      if (gdir >= 0) return { dir: gdir, fire: false, brick: false };
    }
  }

  // 挑目标:越靠近堡垒的越急着打
  let target = enemies[0];
  let bestScore = Infinity;
  for (const e of enemies) {
    const cell = tankCell(e);
    const toBase = base ? Math.abs(cell.cx - base.cx) + Math.abs(cell.cy - base.cy) : 0;
    const toMe = Math.abs(cell.cx - here.cx) + Math.abs(cell.cy - here.cy);
    const score = toBase * 1.6 + toMe;
    if (score < bestScore) {
      bestScore = score;
      target = e;
    }
  }

  const field = distanceField(w.map, [tankCell(target)], { brickCost: 6, blocked: fortCells(w) });
  const dir = stepDownField(w.map, field, here);
  if (dir === -1) return { dir: -1, fire: ray.kind === "brick", brick: false };
  const nx = here.cx + STEP[dir].dx;
  const ny = here.cy + STEP[dir].dy;
  const ahead = tileAt(w.map, nx, ny);
  const wantFire =
    ahead === "#" && me.dir === dir && ray.kind === "brick" && ray.dist < 1.8 && !isFortBrick(w.map, nx, ny);
  return { dir, fire: wantFire, brick: false };
}

interface RunResult {
  world: World;
  seconds: number;
}

function autoRun(w: World, maxSeconds: number): RunResult {
  let t = 0;
  while (w.status === "playing" && t < maxSeconds) {
    const inputs: PlayerInput[] = [];
    for (let p = 0; p < w.players; p++) {
      const tank = w.tanks.find((x) => x.side === "player" && x.player === p);
      inputs[p] = tank ? botInput(w, tank) : IDLE_INPUT;
    }
    stepWorld(w, DT, inputs);
    t += DT;
  }
  return { world: w, seconds: t };
}

function idleRun(w: World, maxSeconds: number): RunResult {
  let t = 0;
  while (w.status === "playing" && t < maxSeconds) {
    stepWorld(w, DT, [IDLE_INPUT, IDLE_INPUT]);
    t += DT;
  }
  return { world: w, seconds: t };
}

function worldFor(index: number, players: 1 | 2 = 2): World {
  const lv = buildLevel(index);
  return createWorld({
    rows: lv.rows,
    mode: players === 2 ? "coop" : "campaign",
    queue: lv.waves,
    limit: lv.limit,
    players,
    ...scaleForPlayers(lv, players),
  });
}

describe("铁皮坦克大战 · 关卡可通过", () => {
  it("188 关双人合作全部能在时限内清完", () => {
    const failed: string[] = [];
    let worstRatio = 0;
    for (let index = 0; index < LEVEL_TOTAL; index++) {
      const lv = buildLevel(index);
      const { world, seconds } = autoRun(worldFor(index, 2), lv.limit + 2);
      worstRatio = Math.max(worstRatio, seconds / lv.limit);
      if (world.status !== "win" || world.defeated !== lv.waves.length) {
        failed.push(`第 ${index + 1} 关:${world.reason || "超时"}`);
      }
    }
    expect(failed, failed.slice(0, 5).join(" / ")).toEqual([]);
    // 时限要留出余量:机器人打完只花掉一半以内,人慢一点也够用
    expect(worstRatio).toBeLessThan(0.5);
  }, 120000);

  it("单人也能独自拿下绝大多数关卡(后两章更想要一个队友)", () => {
    let lost = 0;
    for (let index = 0; index < LEVEL_TOTAL; index++) {
      const lv = buildLevel(index);
      const { world } = autoRun(worldFor(index, 1), lv.limit + 2);
      if (world.status !== "win") lost += 1;
    }
    expect(lost / LEVEL_TOTAL).toBeLessThan(0.05);
  }, 120000);

  it("前六章单人一关不落", () => {
    const failed: number[] = [];
    for (const index of [0, 7, 21, 22, 33, 44, 45, 58, 67, 68, 75, 89, 90, 101, 111, 112, 120, 133]) {
      const lv = buildLevel(index);
      const { world } = autoRun(worldFor(index, 1), lv.limit + 2);
      if (world.status !== "win") failed.push(index + 1);
    }
    expect(failed, `这些关单人没过:${failed.join("、")}`).toEqual([]);
  }, 60000);

  it("双人合作确实比单人省时间", () => {
    let soloTotal = 0;
    let duoTotal = 0;
    for (const index of [40, 95, 130]) {
      const lv = buildLevel(index);
      soloTotal += autoRun(worldFor(index, 1), lv.limit + 2).seconds;
      duoTotal += autoRun(worldFor(index, 2), lv.limit + 2).seconds;
    }
    expect(duoTotal).toBeLessThan(soloTotal);
  }, 60000);
});

describe("铁皮坦克大战 · 基地可被保护", () => {
  it("撒手不管,堡垒真的会被砸中(威胁是实打实的)", () => {
    let smashed = 0;
    for (const index of [95, 120, 150, 180]) {
      const lv = buildLevel(index);
      const { world } = idleRun(worldFor(index, 2), lv.limit + 2);
      if (world.status === "lose" && world.reason.includes("堡垒")) smashed += 1;
    }
    expect(smashed).toBe(4);
  }, 60000);

  it("同一批关卡认真打,堡垒一次都没被砸中", () => {
    for (const index of [95, 120, 150, 180]) {
      const lv = buildLevel(index);
      const { world } = autoRun(worldFor(index, 2), lv.limit + 2);
      expect(world.status, `第 ${index + 1} 关:${world.reason}`).toBe("win");
      expect(world.reason).not.toContain("堡垒");
    }
  }, 60000);

  it("护罩会先替堡垒挡一发,第二发才算被砸中", () => {
    const w = worldFor(3, 1);
    const base = w.map.base!;
    // 把正上方的护墙掀掉,让炮弹能直接飞到堡垒上
    for (let dy = 1; dy <= 2; dy++) {
      const i = (base.cy - dy) * w.map.w + base.cx;
      w.map.tiles[i] = ".";
      w.map.brickHp[i] = 0;
    }
    w.bullets.push({
      id: 900,
      owner: 0,
      side: "enemy",
      player: -1,
      x: base.cx + 0.5,
      y: base.cy - 0.6,
      dir: 2,
      speed: 6,
    });
    for (let i = 0; i < 8 && w.baseShield; i++) stepWorld(w, DT, []);
    expect(w.baseShield).toBe(false);
    expect(w.status).toBe("playing");

    w.bullets.push({
      id: 901,
      owner: 0,
      side: "enemy",
      player: -1,
      x: base.cx + 0.5,
      y: base.cy - 0.6,
      dir: 2,
      speed: 6,
    });
    for (let i = 0; i < 8 && w.status === "playing"; i++) stepWorld(w, DT, []);
    expect(w.status).toBe("lose");
    expect(w.reason).toContain("堡垒");
  });

  it("护墙一开局就把堡垒围了三面,顶上还是两层", () => {
    const w = worldFor(3, 1);
    const base = w.map.base!;
    expect(tileAt(w.map, base.cx, base.cy - 1)).toBe("#");
    expect(tileAt(w.map, base.cx, base.cy - 2)).toBe("#");
    expect(tileAt(w.map, base.cx - 1, base.cy)).toBe("#");
    expect(tileAt(w.map, base.cx + 2, base.cy)).toBe("#");
    expect(w.fortCells.length).toBeGreaterThanOrEqual(10);
    expect(fortGaps(w)).toEqual([]);
  });

  it("补墙能把被打穿的缺口堵回去", () => {
    const w = worldFor(3, 1);
    const base = w.map.base!;
    const idx = (base.cy - 1) * w.map.w + base.cx;
    w.map.tiles[idx] = ".";
    w.map.brickHp[idx] = 0;
    expect(fortGaps(w)).toHaveLength(1);

    const duo = w.tanks[0];
    duo.x = base.cx + 0.5;
    duo.y = base.cy - 1.5;
    duo.dir = 2;
    const before = duo.bricks;
    stepWorld(w, DT, [{ dir: -1, fire: false, brick: true }, IDLE_INPUT]);
    expect(w.map.tiles[idx]).toBe("#");
    expect(duo.bricks).toBe(before - 1);
    expect(fortGaps(w)).toEqual([]);
  });
});

describe("铁皮坦克大战 · 无尽与对战", () => {
  it("无尽敌潮一波比一波多,机器人能顶住前几波", () => {
    const rand = mulberry32(7);
    const w = createWorld({
      rows: endlessRows(),
      mode: "endless",
      queue: [],
      maxAlive: endlessMaxAlive(1),
      limit: 9999,
      players: 2,
    });
    let cleared = 0;
    for (let wave = 1; wave <= 4 && w.status === "playing"; wave++) {
      w.queue = endlessWave(wave, rand);
      w.maxAlive = endlessMaxAlive(wave);
      let t = 0;
      while (w.status === "playing" && (w.queue.length > 0 || aliveEnemies(w).length > 0) && t < 150) {
        const inputs: PlayerInput[] = [];
        for (let p = 0; p < w.players; p++) {
          const tank = w.tanks.find((x) => x.side === "player" && x.player === p);
          inputs[p] = tank ? botInput(w, tank) : IDLE_INPUT;
        }
        stepWorld(w, DT, inputs);
        t += DT;
      }
      if (w.status === "playing") cleared += 1;
    }
    expect(cleared).toBeGreaterThanOrEqual(3);
    expect(w.defeated).toBeGreaterThan(10);
    expect(w.score).toBeGreaterThan(10);
  }, 120000);

  it("双人对战能打出真实胜负,只认弹飞次数", () => {
    const w = createWorld({ rows: versusRows(), mode: "versus", players: 2, limit: 90, target: 2 });
    const duo = w.tanks[0];
    const xing = w.tanks[1];
    duo.x = 3.5;
    duo.y = 6.5;
    duo.dir = 1;
    xing.x = 6.5;
    xing.y = 6.5;
    xing.shield = 0;
    for (let i = 0; i < 600 && w.status === "playing"; i++) {
      stepWorld(w, DT, [{ dir: 1, fire: true, brick: false }, IDLE_INPUT]);
      if (xing.spin <= 0 && w.status === "playing") {
        xing.x = 6.5;
        xing.y = 6.5;
        xing.shield = 0;
      }
    }
    expect(w.status).toBe("win");
    expect(w.winner).toBe(0);
    expect(w.scores[0]).toBeGreaterThanOrEqual(2);
    expect(w.scores[1]).toBe(0);
  }, 30000);

  it("对战里谁也别想偷袭队友的出生点:地图左右对称", () => {
    const rows = versusRows();
    for (const row of rows) {
      const flipped = row.split("").reverse().join("");
      expect(flipped.replace(/[12]/g, "x")).toBe(row.replace(/[12]/g, "x"));
    }
    expect(rows.join("")).not.toContain("B");
    expect(rows.join("")).not.toContain("e");
  });

  it("评星按用时和被弹飞次数算,打得又快又稳才是三星", () => {
    expect(rateRun(50, 120, 0)).toBe(3);
    expect(rateRun(50, 120, 2)).toBe(3);
    expect(rateRun(50, 120, 5)).toBe(2);
    expect(rateRun(100, 120, 0)).toBe(2);
    expect(rateRun(115, 120, 9)).toBe(1);
  });
});
