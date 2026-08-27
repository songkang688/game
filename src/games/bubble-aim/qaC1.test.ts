// 窗口 4 · QA 档C · 第 1 轮测试员:泡泡瞄准手。
//
// 第 1 轮剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 → 无尽玩到结算 → 360px。
// 赢与输都用一个「和游戏走同一套结算函数」的机器人真打一局,不看单函数返回值。
import { describe, expect, it } from "vitest";
import { meta } from "./meta";
import {
  LEGACY_LEVELS,
  LEVELS,
  THEMES,
  THEME_SIZES,
  clearableCount,
  levelMechanisms,
  shotBudget,
  themeOfLevel,
  themeStart,
  type BubbleLevelDef,
} from "./levels";
import {
  H,
  R,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  crossedDeadline,
  damageStone,
  descend,
  failedSpeechLine,
  isStone,
  neighbors,
  parseLayout,
  pressCeiling,
  releaseLoneRainbows,
  rowLength,
  settleShot,
  simulateShot,
  starsForShotsLeft,
  wonSpeechLine,
  type Grid,
  type Obstacles,
  type ShotResult,
} from "./logic";
import {
  SHOOTER_X,
  SHOOTER_Y,
  endlessLine,
  endlessRow,
  endlessRowFill,
  endlessShouldPush,
  endlessStartRows,
  endlessTotal,
  lowestRow,
} from "./aim12";

/* ------------------------------------------------------------------ */
/* 一个和游戏共用结算函数的机器人                                       */
/* ------------------------------------------------------------------ */

function cloneGrid(g: Grid): Grid {
  return { rows: g.rows.map((row) => [...row]), flip: g.flip };
}

interface Outcome {
  won: boolean;
  shotsUsed: number;
  left: number;
  reason: "cleared" | "deadline" | "outOfShots";
}

/** `smart = false` 就是「摆烂」:永远朝正上方开一枪,不挑角度 */
function play(def: BubbleLevelDef, seed: number, smart: boolean): Outcome {
  const g = parseLayout(def.layout);
  const obs: Obstacles = { clouds: def.clouds, holes: def.holes };
  const dropQueue = [...(def.dropRows ?? [])];
  const dropEvery = def.dropEvery ?? 0;
  const pressEvery = def.pressEvery ?? 0;
  let pressLeft = pressEvery > 0 ? def.pressMax ?? 0 : 0;
  let rng = seed >>> 0;
  const rand = (): number => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const pickColor = (): string => {
    const pool = colorsInGrid(g);
    return pool[Math.floor(rand() * pool.length)] ?? "R";
  };
  // 弹药队列:当前一发 + 预告一发,和游戏里的装弹器一个口径
  let cur = pickColor();
  let next = pickColor();
  let fired = 0;

  for (let shot = 0; shot < def.shots; shot++) {
    releaseLoneRainbows(g);
    if (countBubbles(g) === 0) {
      return { won: true, shotsUsed: fired, left: def.shots - fired, reason: "cleared" };
    }

    let best: ShotResult | null = null;
    if (smart) {
      let bestScore = -Infinity;
      for (let deg = 20; deg <= 160; deg += 2.5) {
        const a = (deg * Math.PI) / 180;
        const res = simulateShot(g, SHOOTER_X, SHOOTER_Y, Math.cos(a), -Math.sin(a), obs);
        let score: number;
        if (res.swallowed) {
          score = -50;
        } else if (res.hitCell && isStone(g.rows[res.hitCell.r][res.hitCell.c])) {
          const sim = cloneGrid(g);
          const hit = damageStone(sim, res.hitCell.r, res.hitCell.c);
          score = hit.result === "broken" ? 3 + hit.dropped.length * 2.5 : 1;
        } else if (res.landing) {
          const sim = cloneGrid(g);
          sim.rows[res.landing.r][res.landing.c] = cur;
          const settle = settleShot(sim, res.landing.r, res.landing.c);
          const bonus = releaseLoneRainbows(sim).length;
          score =
            settle.popped.length > 0
              ? settle.popped.length * 2 + settle.dropped.length * 3 + bonus * 2
              : (neighbors(g, res.landing.r, res.landing.c).some(([nr, nc]) => {
                  const n = g.rows[nr][nc];
                  return n === cur || n === "W";
                })
                  ? 0.5
                  : -1) - res.landing.r * 0.15;
        } else {
          score = -30;
        }
        if (score > bestScore) {
          bestScore = score;
          best = res;
        }
      }
    } else {
      best = simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1, obs);
    }

    if (best && !best.swallowed) {
      if (best.hitCell && isStone(g.rows[best.hitCell.r][best.hitCell.c])) {
        damageStone(g, best.hitCell.r, best.hitCell.c);
      } else if (best.landing) {
        g.rows[best.landing.r][best.landing.c] = cur;
        settleShot(g, best.landing.r, best.landing.c);
      }
    }
    fired++;
    if (dropEvery > 0 && dropQueue.length > 0 && fired % dropEvery === 0) descend(g, dropQueue.shift()!);
    if (pressEvery > 0 && pressLeft > 0 && fired % pressEvery === 0) {
      pressCeiling(g);
      pressLeft--;
    }
    releaseLoneRainbows(g);
    if (countBubbles(g) === 0) {
      return { won: true, shotsUsed: fired, left: def.shots - fired, reason: "cleared" };
    }
    if (crossedDeadline(g)) {
      return { won: false, shotsUsed: fired, left: def.shots - fired, reason: "deadline" };
    }
    cur = next;
    if (!colorsInGrid(g).includes(cur)) cur = pickColor();
    next = pickColor();
  }
  releaseLoneRainbows(g);
  const won = countBubbles(g) === 0;
  return { won, shotsUsed: fired, left: 0, reason: won ? "cleared" : "outOfShots" };
}

/** 三个种子里有一个赢就算这关打得通(弹药颜色是随机的) */
function playBest(def: BubbleLevelDef): Outcome {
  let out = play(def, 1, true);
  for (const seed of [2, 3]) {
    if (out.won) break;
    out = play(def, seed, true);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 一、从首页进得去                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · bubble-aim · 首页进入", () => {
  it("meta 的 id / 关数 / 模式和实现对得上", () => {
    expect(meta.id).toBe("bubble-aim");
    expect(meta.levels).toBe(LEVELS.length);
    expect(LEVELS).toHaveLength(188);
    expect(THEME_SIZES.reduce((a, b) => a + b, 0)).toBe(188);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    expect(meta.category).toBe("casual");
    expect(meta.platform).toBe("both");
  });

  it("九个主题世界都有名字、图标和一句话说明", () => {
    expect(THEMES).toHaveLength(THEME_SIZES.length);
    THEMES.forEach((t, i) => {
      expect(t.name.length).toBeGreaterThan(1);
      expect(t.icon.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThanOrEqual(8);
      expect(themeOfLevel(themeStart(i))).toBe(i);
    });
    expect(themeOfLevel(0)).toBe(0);
    expect(themeOfLevel(187)).toBe(THEMES.length - 1);
  });

  it("每一关都有名字、提示和子弹数,进去不会是空关", () => {
    for (const lv of LEVELS) {
      expect(lv.name.trim().length).toBeGreaterThan(0);
      expect(lv.tip.trim().length).toBeGreaterThan(0);
      expect(lv.shots).toBeGreaterThan(0);
      expect(clearableCount(lv)).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、赢一次 + 输一次                                                  */
/* ------------------------------------------------------------------ */

describe("档C R1 · bubble-aim · 赢一次 + 输一次", () => {
  it("赢:第 1 关机器人在子弹数以内打空全场", () => {
    const out = playBest(LEVELS[0]);
    expect(out.won).toBe(true);
    expect(out.reason).toBe("cleared");
    expect(out.shotsUsed).toBeLessThanOrEqual(LEVELS[0].shots);
    const stars = starsForShotsLeft(out.left, LEVELS[0].shots);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(wonSpeechLine(stars).length).toBeGreaterThan(4);
  });

  it("输:一直朝天上直射的摆烂打法确实过不去(说明这一关真有失败分支)", () => {
    // 挑一批不同主题的关,证明「随便乱打也能过」不成立
    const picks = [0, 20, 60, 110, 150, 187];
    let lost = 0;
    for (const i of picks) {
      const out = play(LEVELS[i], 1, false);
      if (!out.won) lost++;
    }
    expect(lost, "摆烂打法居然全通了,这批关卡没有失败分支").toBeGreaterThanOrEqual(picks.length - 1);
  });

  it("输了只鼓励:两种失败原因的话里都没有一句批评", () => {
    for (const reason of ["子弹用完啦", "泡泡压到底线啦"]) {
      const line = failedSpeechLine(reason);
      expect(line.length).toBeGreaterThan(4);
      for (const bad of ["笨", "差劲", "不行", "又输"]) expect(line).not.toContain(bad);
    }
  });

  it("剩弹越多星越高,而且不会给出 0 星", () => {
    const total = 20;
    expect(starsForShotsLeft(total, total)).toBe(3);
    expect(starsForShotsLeft(0, total)).toBe(1);
    let prev = 0;
    for (let left = 0; left <= total; left++) {
      const s = starsForShotsLeft(left, total);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

/* ------------------------------------------------------------------ */
/* 三、战役第 1 / 100 / 188 关                                          */
/* ------------------------------------------------------------------ */

describe("档C R1 · bubble-aim · 战役第 1 / 100 / 188 关", () => {
  const PICKS = [1, 100, 188];

  it.each(PICKS)("第 %i 关能进、能打通、布局合法", (n) => {
    const def = LEVELS[n - 1];
    const g = parseLayout(def.layout);
    expect(countBubbles(g)).toBeGreaterThan(0);
    expect(crossedDeadline(g)).toBe(false);
    const out = playBest(def);
    expect(out.won, `第 ${n} 关机器人没打通`).toBe(true);
    expect(out.shotsUsed).toBeLessThanOrEqual(def.shots);
  });

  it.each(PICKS)("第 %i 关的机关标签和布局里真有的东西一致", (n) => {
    const def = LEVELS[n - 1];
    const mech = levelMechanisms(def);
    const flat = def.layout.join("");
    expect(mech.includes("stone")).toBe(flat.includes("S"));
    expect(mech.includes("rainbow")).toBe(flat.includes("W"));
    expect(mech.includes("cloud")).toBe((def.clouds?.length ?? 0) > 0);
    expect(shotBudget(def)).toBeGreaterThan(0);
  });

  it("第 100 关起是 1.1 追加的新主题,前 99 关一关不动", () => {
    expect(LEGACY_LEVELS).toBe(99);
    expect(themeOfLevel(LEGACY_LEVELS)).toBeGreaterThanOrEqual(6);
    // 前 99 关不带 1.1 的三个新机关
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(LEVELS[i].pressEvery ?? 0).toBe(0);
      expect(LEVELS[i].bankTargets ?? []).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、无尽玩到结算                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · bubble-aim · 无尽玩到结算", () => {
  const colors = ["R", "Y", "B", "G", "P"];
  const mkRand = (seed: number) => {
    let s = seed >>> 0;
    return (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  it("开局四行是真的有泡泡的行,一进去就有东西打", () => {
    const rows = endlessStartRows(colors, mkRand(9));
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.length).toBeGreaterThan(0);
      expect(row.replace(/\./g, "").length).toBeGreaterThan(0);
    }
  });

  it("每 5 发压下来一行,连压 40 行都能压得动、行长交替对得上", () => {
    const g = parseLayout(endlessStartRows(colors, mkRand(3)));
    const rand = mkRand(11);
    let pushed = 0;
    for (let shot = 1; shot <= 200; shot++) {
      if (!endlessShouldPush(shot)) continue;
      const row = endlessRow(g, colors, rand, pushed);
      descend(g, row);
      pushed++;
      // 顶行长度只会是 8 或 9,压完还得对得上
      expect([8, 9]).toContain(rowLength(g, 0));
    }
    expect(pushed).toBe(40);
    expect(lowestRow(g)).toBeGreaterThan(0);
  });

  it("越往后压下来的行越满,难度是往上走的", () => {
    expect(endlessRowFill(0)).toBeLessThan(endlessRowFill(20));
    let prev = -1;
    for (let n = 0; n <= 40; n++) {
      const f = endlessRowFill(n);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeLessThanOrEqual(1);
      prev = f;
    }
  });

  it("成绩算得出来,结算那句话只鼓励", () => {
    expect(endlessTotal(0, 0)).toBeGreaterThanOrEqual(0);
    expect(endlessTotal(120, 9)).toBeGreaterThan(endlessTotal(120, 3));
    expect(endlessLine(300, 100)).toContain("纪录");
    for (const line of [endlessLine(0, 0), endlessLine(10, 900)]) {
      for (const bad of ["笨", "差劲", "又输"]) expect(line).not.toContain(bad);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 五、360px 窄屏                                                       */
/* ------------------------------------------------------------------ */

describe("档C R1 · bubble-aim · 360px 窄屏", () => {
  it("画布本来就按 360×480 设计,泡泡圆心全部落在画布里", () => {
    expect(W).toBe(360);
    expect(H).toBe(480);
    for (const lv of LEVELS) {
      const g = parseLayout(lv.layout);
      for (let r = 0; r < g.rows.length; r++) {
        for (let c = 0; c < rowLength(g, r); c++) {
          if (!g.rows[r][c]) continue;
          const p = cellCenter(g, r, c);
          expect(p.x, `${lv.name} 第 ${r} 行第 ${c} 列冒出左边`).toBeGreaterThanOrEqual(R - 1);
          expect(p.x, `${lv.name} 第 ${r} 行第 ${c} 列冒出右边`).toBeLessThanOrEqual(W - R + 1);
        }
      }
    }
  });

  it("发射台在画布正中偏下,不会被泡泡糊住", () => {
    expect(SHOOTER_X).toBeCloseTo(W / 2, 6);
    expect(SHOOTER_Y).toBeGreaterThan(H * 0.8);
    expect(SHOOTER_Y).toBeLessThan(H);
  });

  it("障碍物一律留在画布内,360px 上不会有半个云飘到屏幕外", () => {
    for (const lv of LEVELS) {
      for (const cl of lv.clouds ?? []) {
        expect(cl.x).toBeGreaterThanOrEqual(0);
        expect(cl.x + cl.w).toBeLessThanOrEqual(W);
      }
      for (const hole of lv.holes ?? []) {
        expect(hole.x).toBeGreaterThan(0);
        expect(hole.x).toBeLessThan(W);
        expect(hole.y).toBeGreaterThan(0);
        expect(hole.y).toBeLessThan(H);
      }
    }
  });
});
