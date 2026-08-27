/**
 * 雪球大作战 · 实玩模拟(不开浏览器,按真实规则一发一发打完整关)。
 *
 * 这里的「老手」只会攻略里教的那几招:算好落点、被掩体挡住就抬高角度、
 * 雪怪逼近就先堆一堵雪墙。它能打完的关,认真玩的小朋友也能打完。
 *
 * 要证明四件事:
 *  1. 188 关每一关都打得完,而且雪球给得够宽裕;
 *  2. 掩体挡得住雪球,抬高角度就能越过去;
 *  3. 双人对战与三档人机都能打出真实胜负,档次越高越难赢;
 *  4. 无尽的雪怪车轮战能一波一波顶下去。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  CHAPTERS,
  LEVEL_TOTAL,
  buildLevel,
  chapterIndexOf,
  duelMatch,
  endlessMatch,
  levelMatch,
} from "./levels";
import {
  GUARD_X,
  aiTurn,
  buildWall,
  createMatch,
  current,
  endlessTargets,
  flyShot,
  liveTargets,
  rateLevel,
  takeShot,
  type Match,
  type Target,
} from "./logic";
import { solvePower, type AiLevel, type ThrowSpec } from "./physics";

/** 老手愿意试的仰角,从顺手的平抛一直试到很陡的高抛 */
const ANGLES = [40, 50, 32, 58, 66, 25, 72, 78, 45, 35, 55, 62, 20, 84];

/** 先打最危险的:雪怪按离雪堡的远近排,灯笼排在后面 */
function pickTarget(match: Match): Target | undefined {
  const live = liveTargets(match);
  if (live.length === 0) return undefined;
  const monsters = live.filter((t) => t.kind === "monster");
  if (monsters.length > 0) return monsters.reduce((a, b) => (a.x < b.x ? a : b));
  return live.reduce((a, b) => (Math.abs(a.x) < Math.abs(b.x) ? a : b));
}

/** 找一发能真正打中这个靶子的角度与力度(会自己试抬高角度绕过掩体) */
function aimAt(match: Match, target: Target): { angle: number; power: number } | null {
  const me = current(match);
  const from = { x: me.x, y: me.y + 1.2, dir: me.dir, wind: match.wind };
  for (const angle of ANGLES) {
    const power = solvePower({ ...from, angle }, target.x, target.y);
    if (power === null) continue;
    const spec: ThrowSpec = { ...from, angle, power };
    const shot = flyShot(match, spec, me.id);
    if (shot.id === target.id) return { angle, power };
  }
  return null;
}

interface PlayResult {
  match: Match;
  shots: number;
  walls: number;
}

/** 老手把一关打完 */
function expertPlay(match: Match, maxTurns = 80): PlayResult {
  let shots = 0;
  let walls = 0;
  for (let i = 0; i < maxTurns && match.status === "playing"; i++) {
    const target = pickTarget(match);
    if (!target) break;
    const me = current(match);
    const aim = aimAt(match, target);
    if (aim) {
      takeShot(match, aim.angle, aim.power);
      shots += 1;
      continue;
    }
    // 打不中就先堆墙拖住雪怪,再想办法
    if (me.walls > 0 && target.kind === "monster") {
      buildWall(match);
      walls += 1;
      continue;
    }
    takeShot(match, 45, 70);
    shots += 1;
  }
  return { match, shots, walls };
}

describe("雪球大作战 · 188 关都打得完", () => {
  it("每一关老手都能在雪球用完前清干净", () => {
    const failed: string[] = [];
    let worstUsage = 0;
    for (let index = 0; index < LEVEL_TOTAL; index++) {
      const level = buildLevel(index);
      const match = createMatch(levelMatch(level));
      const { shots } = expertPlay(match);
      if (match.status !== "win") {
        failed.push(`第 ${index + 1} 关:${match.reason || "没打完"}`);
      }
      worstUsage = Math.max(worstUsage, shots / level.balls);
    }
    expect(failed, failed.slice(0, 6).join(" / ")).toEqual([]);
    // 雪球要给得宽裕:老手最多也就用掉八成,新手才有试错的余地
    expect(worstUsage).toBeLessThan(0.85);
  }, 120000);

  it("每一关的雪球都至少是靶子数的两倍", () => {
    for (let index = 0; index < LEVEL_TOTAL; index++) {
      const level = buildLevel(index);
      expect(level.balls, `第 ${index + 1} 关`).toBeGreaterThanOrEqual(level.targets.length * 2);
    }
  });

  it("老手打完通常能拿三星,说明评分口径是够得着的", () => {
    let three = 0;
    for (const index of [0, 20, 44, 70, 95, 120, 150, 175, 187]) {
      const level = buildLevel(index);
      const match = createMatch(levelMatch(level));
      const { shots } = expertPlay(match);
      if (rateLevel(level.balls - shots, level.balls) === 3) three += 1;
    }
    expect(three).toBeGreaterThanOrEqual(7);
  }, 60000);

  it("撒手不管的话,雪怪关会输给走过来的雪怪", () => {
    let lostToMonster = 0;
    const withMonsters = [70, 80, 140, 150, 170].filter((i) =>
      buildLevel(i).targets.some((t) => t.kind === "monster")
    );
    expect(withMonsters.length).toBeGreaterThan(2);
    for (const index of withMonsters) {
      const match = createMatch(levelMatch(buildLevel(index)));
      for (let i = 0; i < 60 && match.status === "playing"; i++) takeShot(match, 85, 5);
      if (match.status === "lose" && match.reason.includes("雪怪")) lostToMonster += 1;
    }
    expect(lostToMonster).toBeGreaterThanOrEqual(withMonsters.length - 1);
  }, 60000);
});

describe("雪球大作战 · 掩体真的挡得住", () => {
  it("平抛会被冰砖挡下来,抬高角度就能越过去", () => {
    const match = createMatch({
      mode: "campaign",
      windPlan: [0],
      covers: [{ x: 20, w: 4, h: 9, hp: 3 }],
      targets: [{ x: 40, y: 2, r: 1.2 }],
      throwers: [{ seat: 0, x: 6, dir: 1, balls: 20, walls: 0 }],
    });
    const target = match.targets[0];
    const me = match.throwers[0].id;
    const flat = solvePower({ x: 6, y: 1.2, angle: 22, dir: 1, wind: 0 }, target.x, target.y);
    expect(flat).not.toBeNull();
    const blocked = flyShot(match, { x: 6, y: 1.2, angle: 22, dir: 1, wind: 0, power: flat! }, me);
    expect(blocked.hit).toBe("cover");

    const high = solvePower({ x: 6, y: 1.2, angle: 62, dir: 1, wind: 0 }, target.x, target.y);
    const over = flyShot(match, { x: 6, y: 1.2, angle: 62, dir: 1, wind: 0, power: high! }, me);
    expect(over.hit).toBe("lantern");
  });

  it("同一处砸够次数,掩体会碎掉", () => {
    const match = createMatch({
      mode: "campaign",
      windPlan: [0],
      covers: [{ x: 20, w: 4, h: 9, hp: 2 }],
      targets: [{ x: 40, y: 2, r: 1.2 }],
      throwers: [{ seat: 0, x: 6, dir: 1, balls: 20, walls: 0 }],
    });
    const power = solvePower({ x: 6, y: 1.2, angle: 22, dir: 1, wind: 0 }, 40, 2)!;
    takeShot(match, 22, power);
    expect(match.covers).toHaveLength(1);
    expect(match.covers[0].hp).toBe(1);
    takeShot(match, 22, power);
    expect(match.covers).toHaveLength(0);
  });

  it("堆起来的雪墙能把雪怪拦住,墙碎了它才继续走", () => {
    const match = createMatch({
      mode: "campaign",
      windPlan: [0],
      targets: [{ x: 24, y: 2, r: 1.3, kind: "monster", march: 3 }],
      throwers: [{ seat: 0, x: 6, dir: 1, balls: 20, walls: 2 }],
    });
    expect(buildWall(match)).toBe(true);
    const wall = match.covers.find((c) => c.kind === "snow");
    expect(wall).toBeTruthy();
    const monster = match.targets[0];
    const before = monster.x;
    // 雪怪走到墙前面
    while (monster.x - monster.r > wall!.x + wall!.w + 3 && match.status === "playing") {
      takeShot(match, 85, 5);
    }
    const atWall = monster.x;
    takeShot(match, 85, 5);
    expect(monster.x, "撞上雪墙那一步应该停住").toBe(atWall);
    expect(wall!.hp).toBeLessThan(wall!.maxHp);
    expect(atWall).toBeLessThan(before);
  });
});

describe("雪球大作战 · 对战与人机", () => {
  function duel(level: AiLevel, seed: number): Match {
    const match = createMatch(duelMatch(level));
    const rand = mulberry32(seed);
    for (let i = 0; i < 120 && match.status === "playing"; i++) {
      if (current(match).ai) {
        aiTurn(match, rand);
        continue;
      }
      const foe = liveTargets(match, 1);
      if (foe.length === 0) break;
      const target = foe.reduce((a, b) => (Math.abs(a.x - current(match).x) < Math.abs(b.x - current(match).x) ? a : b));
      const aim = aimAt(match, target);
      if (aim) takeShot(match, aim.angle, aim.power);
      else takeShot(match, 45, 80);
    }
    return match;
  }

  it("人机对战一定分得出胜负", () => {
    for (const level of ["easy", "normal", "hard"] as AiLevel[]) {
      const match = duel(level, 42);
      expect(match.status, level).toBe("win");
      expect(match.reason.length).toBeGreaterThan(3);
    }
  }, 60000);

  it("档次越高越难赢:低档 AI 被打爆,高档能追回来", () => {
    let easyLeft = 0;
    let hardLeft = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      easyLeft += liveTargets(duel("easy", seed), 0).length;
      hardLeft += liveTargets(duel("hard", seed), 0).length;
    }
    // 剩下的自家灯笼越多,说明对手越没打中我
    expect(easyLeft).toBeGreaterThan(hardLeft);
  }, 60000);

  it("双人对战没有电脑,谁先砸完对面三盏灯笼谁赢", () => {
    const match = createMatch(duelMatch(null));
    expect(match.throwers.every((t) => t.ai === null)).toBe(true);
    // 让鸭梨一路打过去
    for (let i = 0; i < 60 && match.status === "playing"; i++) {
      const seat = current(match).seat;
      const foe = liveTargets(match, 1 - seat);
      if (foe.length === 0) break;
      if (seat === 1) {
        // 康康这一方站着不动,只是把回合让出去
        takeShot(match, 85, 5);
        continue;
      }
      const target = foe.reduce((a, b) => (a.x < b.x ? a : b));
      const aim = aimAt(match, target);
      if (aim) takeShot(match, aim.angle, aim.power);
      else takeShot(match, 45, 80);
    }
    expect(match.status).toBe("win");
    expect(match.winner).toBe(0);
    expect(liveTargets(match, 1)).toHaveLength(0);
  }, 30000);

  it("砸中对手只是让他变一会儿雪人,不掉任何东西", () => {
    const match = createMatch({
      mode: "versus",
      windPlan: [0],
      targets: [
        { x: 3, y: 2.4, owner: 0 },
        { x: 50, y: 2.4, owner: 1 },
      ],
      throwers: [
        { seat: 0, x: 10, dir: 1, balls: -1, walls: 0 },
        { seat: 1, x: 40, dir: -1, balls: -1, walls: 0 },
      ],
    });
    const foe = match.throwers[1];
    const power = solvePower({ x: 10, y: 1.2, angle: 40, dir: 1, wind: 0 }, foe.x, 0.4);
    const out = takeShot(match, 40, power!);
    expect(out?.shot.hit).toBe("player");
    expect(foe.bumps).toBe(1);
    expect(match.targets.every((t) => !t.melted)).toBe(true);
    expect(out?.line).not.toMatch(/输|死|血|伤|疼/);
    // 被砸中的一方歇一回合,所以还是鸭梨先扔
    expect(current(match).seat).toBe(0);
  });
});

describe("雪球大作战 · 无尽车轮战", () => {
  it("一波一波往上加,能靠打和堆墙撑过好几波", () => {
    const rand = mulberry32(2026);
    let wave = 1;
    let match = createMatch(endlessMatch(endlessTargets(wave, rand)));
    let melted = 0;
    while (wave <= 6 && match.status === "playing") {
      expertPlay(match, 60);
      melted += match.melted;
      if (match.status !== "playing") break;
      wave += 1;
      match = createMatch(endlessMatch(endlessTargets(wave, rand)));
    }
    expect(wave).toBeGreaterThan(4);
    expect(melted).toBeGreaterThan(12);
  }, 60000);

  it("雪怪越线就这一轮结束,雪堡不会被无限打", () => {
    const match = createMatch(endlessMatch([{ x: 20, y: 2, r: 1.3, kind: "monster", march: 3 }]));
    for (let i = 0; i < 30 && match.status === "playing"; i++) takeShot(match, 85, 5);
    expect(match.status).toBe("lose");
    expect(match.reason).toContain("雪怪");
    expect(match.targets[0].x).toBeLessThanOrEqual(GUARD_X + 1.3);
  });
});

describe("雪球大作战 · 章节切分", () => {
  it("八章合计 188 关,关号能算回章节", () => {
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(LEVEL_TOTAL);
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(LEVEL_TOTAL - 1)).toBe(CHAPTERS.length - 1);
  });
});