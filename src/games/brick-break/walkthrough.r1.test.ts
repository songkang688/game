/**
 * 碰碰砖块 · 窗口4 档A 第 1 轮测试员走查（不改玩法，只记录与断言）
 *
 * 剧本：首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽砖塔玩到结算 → 360px 窄屏。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGames } from "../../engine/loader";
import { mulberry32 } from "../level99";
import { COLS, LEVELS } from "./levels";
import {
  BALL_R,
  H,
  KIND,
  MIN_BOUNCE_DEG,
  PADDLE_Y,
  TOWER_COLS,
  TOWER_FLOOR,
  TOWER_START_ROWS,
  W,
  isBreakableKind,
  makeTower,
  simulateLevel,
  towerBottomY,
  towerBreak,
  towerSpeed,
  towerTick
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 闯关里的爱心数：球掉出场三次就收工（和 index.ts 的 `lives = 3` 对齐） */
const LIVES = 3;

/** 还剩几块「该打的」砖 */
function bricksLeft(cfg: (typeof LEVELS)[number]): number {
  let n = 0;
  for (const row of cfg.layout) {
    for (const v of row) {
      if (cfg.goal === "pattern" ? v === KIND.PATTERN : isBreakableKind(v)) n++;
    }
  }
  return n;
}

describe("碰碰砖块 · R1 · 从首页进入", () => {
  it("首页列得出这一款，动态加载能真的拿到 mount", async () => {
    const entry = loadGames().find((g) => g.meta.id === "brick-break");
    expect(entry, "首页 loadGames() 里找不到 brick-break").toBeTruthy();
    expect(entry!.meta.title).toBe("碰碰砖块");
    expect(entry!.meta.levels).toBe(LEVELS.length);
    expect(typeof (await entry!.load())).toBe("function");
  });

  it("meta.modes 声明的闯关 / 无尽在 index.ts 里都有真入口", () => {
    const entry = loadGames().find((g) => g.meta.id === "brick-break");
    expect(entry!.meta.modes).toEqual(["campaign", "endless"]);
    expect(SRC).toContain("mountLevelGame(");
    expect(SRC).toContain("function mountTower(");
    // 无尽成绩要落盘，退出重进还看得见
    expect(SRC).toContain("recordEndlessBest(");
  });
});

describe("碰碰砖块 · R1 · 赢一次 + 输一次", () => {
  it("赢一次：第 1 关被会追球的假玩家清干净，一颗爱心都没掉", () => {
    const res = simulateLevel(LEVELS[0], { seed: 1000 });
    expect(res.won).toBe(true);
    expect(res.left).toBe(0);
    expect(res.brickHits).toBeGreaterThan(0);
    expect(res.misses).toBeLessThan(LIVES);
    // 三星就是一颗爱心都没掉
    expect(LIVES - res.misses).toBe(3);
  });

  it("输一次：球拍一动不动，球会真的掉出场并把三颗爱心掉光", () => {
    const res = simulateLevel(LEVELS[0], { seed: 5, paddleSpeed: 0, maxSeconds: 60 });
    expect(res.won).toBe(false);
    expect(res.misses).toBeGreaterThanOrEqual(LIVES);
    expect(res.left).toBeGreaterThan(0);
  });

  it("输了的收场话只鼓励，不批评，也不扣星星", () => {
    const lose = /ctx\.lose\("([^"]+)"\)/.exec(SRC);
    expect(lose, "找不到失败文案").not.toBeNull();
    for (const bad of ["笨", "差", "失败", "输了", "不行"]) expect(lose![1]).not.toContain(bad);
    expect(lose![1]).toMatch(/下一局|再来|试试/);
  });
});

describe("碰碰砖块 · R1 · 战役第 1 / 100 / 188 关", () => {
  for (const lv of [0, 99, 187]) {
    it(`第 ${lv + 1} 关：假玩家打得完，全程球角度没平过 20°`, () => {
      const res = simulateLevel(LEVELS[lv], { seed: 1000 + lv });
      expect(res.won, `第 ${lv + 1} 关还剩 ${res.left} 块`).toBe(true);
      expect(res.left).toBe(0);
      expect(res.minAngleDeg).toBeGreaterThanOrEqual(MIN_BOUNCE_DEG - 1);
      expect(bricksLeft(LEVELS[lv])).toBeGreaterThan(0);
    });
  }

  it("第 188 关是十章的最后一关，砖阵参数还在球台里", () => {
    const cfg = LEVELS[LEVELS.length - 1];
    expect(cfg.layout[0]).toHaveLength(COLS);
    expect(cfg.paddleW).toBeGreaterThan(BALL_R * 2);
    expect(cfg.paddleW).toBeLessThan(W);
    expect(cfg.ballSpeed).toBeGreaterThan(0);
    expect(cfg.layout.length * 18 + 42).toBeLessThan(PADDLE_Y);
  });

  it("同一关重进砖阵一模一样（确定性 seed，孩子重玩不会换题）", () => {
    expect(JSON.stringify(LEVELS[99].layout)).toBe(JSON.stringify(LEVELS[99].layout));
    const a = simulateLevel(LEVELS[99], { seed: 4321 });
    const b = simulateLevel(LEVELS[99], { seed: 4321 });
    expect(a).toEqual(b);
  });
});

describe("碰碰砖块 · R1 · 无尽砖塔玩到结算", () => {
  it("砖塔会一直往下压，手慢就会触底收工（真结算，不是玩不完）", () => {
    const rand = mulberry32(9);
    let t = makeTower(rand);
    expect(t.rows).toHaveLength(TOWER_START_ROWS);
    let frames = 0;
    while (!t.over && frames < 60 * 600) {
      t = towerTick(t, 1 / 60, rand);
      frames++;
    }
    expect(t.over).toBe(true);
    expect(towerBottomY(t)).toBeGreaterThanOrEqual(TOWER_FLOOR);
    expect(frames / 60).toBeLessThan(600);
  });

  it("手快就能一直玩下去：每 0.1 秒清一块，10 分钟都压不到底", () => {
    const rand = mulberry32(9);
    let t = makeTower(rand);
    let frames = 0;
    while (!t.over && frames < 60 * 600) {
      t = towerTick(t, 1 / 60, rand);
      if (frames % 6 === 0) {
        outer: for (let r = t.rows.length - 1; r >= 0; r--) {
          for (let c = 0; c < TOWER_COLS; c++) {
            if (t.rows[r][c] !== KIND.EMPTY) {
              t = towerBreak(t, r, c, true).state;
              break outer;
            }
          }
        }
      }
      frames++;
    }
    expect(t.over).toBe(false);
    expect(t.rowsCleared).toBeGreaterThan(20);
    expect(t.score).toBeGreaterThan(0);
    expect(t.spawned).toBeGreaterThan(TOWER_START_ROWS);
  });

  it("清得越多压得越快，但速度有上限，不会突然吓人一跳", () => {
    expect(towerSpeed(0)).toBeLessThan(towerSpeed(5));
    expect(towerSpeed(5)).toBeLessThan(towerSpeed(15));
    expect(towerSpeed(1000)).toBe(towerSpeed(10000));
    expect(towerSpeed(1000)).toBeLessThanOrEqual(26);
  });

  it("清掉一整排会加分，而且清得越多一排越值钱", () => {
    const rand = mulberry32(3);
    let t = makeTower(rand);
    const before = t.score;
    let cleared = 0;
    for (let r = t.rows.length - 1; r >= 0 && cleared < 1; r--) {
      for (let c = 0; c < TOWER_COLS; c++) {
        const out = towerBreak(t, r, c, true);
        t = out.state;
        cleared += out.clearedRows;
      }
    }
    expect(cleared).toBeGreaterThanOrEqual(1);
    expect(t.score).toBeGreaterThan(before);
  });
});

describe("碰碰砖块 · R1 · 360px 窄屏", () => {
  it("球台就是 360×430，砖阵铺满 8 列刚好不溢出", () => {
    expect(W).toBe(360);
    expect(H).toBe(430);
    expect(COLS).toBe(8);
    expect((W / COLS) * COLS).toBe(W);
  });

  it("无尽砖塔也是 8 列，底线在球拍上方留出手的空间", () => {
    expect(TOWER_COLS).toBe(COLS);
    expect(TOWER_FLOOR).toBeLessThan(PADDLE_Y);
    expect(PADDLE_Y - TOWER_FLOOR).toBeGreaterThanOrEqual(40);
  });

  it("画布靠 viewBox 缩放，没有写死大于 360 的宽度", () => {
    const widths = (SRC.match(/(?:^|[^-\w])width:\s*(\d+)px/g) ?? []).map((s) => Number(/(\d+)/.exec(s)![1]));
    for (const w of widths) expect(w).toBeLessThanOrEqual(360);
  });
});

describe("碰碰砖块 · R1 · 分级红线", () => {
  it("音效只走平台的 api.play，没有自己造 AudioContext", () => {
    expect(SRC).not.toContain("AudioContext");
    expect(SRC).not.toContain("new Audio");
  });

  it("没有引入 three.js / CDN / Socket，也没有联网请求", () => {
    for (const bad of ["three", "socket", "fetch(", "XMLHttpRequest", "http://", "https://"]) {
      expect(SRC.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });
});
