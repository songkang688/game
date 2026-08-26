// 1.1：连连看 99 → 188 的新场馆、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, mulberry32, totalSize, TOTAL_LEVELS } from "../level99";
import {
  anyMove,
  applyGravity,
  createBoard,
  findPath,
  MASK_FACE,
  maskKey,
  pickMasked,
  removePair,
  rotateBoard,
  shuffleBoard,
  solveBoard,
  tilesLeft,
  type BoardSpec,
} from "./board";
import { boardSeed, CHAPTERS, LEGACY_CHAPTER_SIZES, LEGACY_LEVELS, LEVELS, THEME_EMOJIS, turnsOf } from "./levels";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);
/** 四座新场馆的关号区间（0 基，含头不含尾） */
const CH = { spin: [99, 122], turn: [122, 144], mask: [144, 166], grav: [166, 188] } as const;

function specOf(level: number): BoardSpec {
  const cfg = LEVELS[level];
  return { rows: cfg.rows, cols: cfg.cols, kinds: cfg.kinds, gravity: cfg.gravity, maxTurns: turnsOf(cfg) };
}

/** 把某一关真跑一遍自动玩家：能不能把整块棋盘连干净 */
function playOut(level: number, seed: number) {
  const cfg = LEVELS[level];
  return solveBoard(specOf(level), mulberry32(seed), {
    shuffles: cfg.shuffles,
    autoShuffleFree: cfg.autoShuffleFree,
    // 原地打转超过 20 次就当这一关设计有问题
    autoShuffleCap: 20,
    // 旋转馆按真机节奏，每走几步就转一次，转完照样要连得完
    rotateEveryMoves: cfg.rotateMs ? 5 : 0,
  });
}

describe("连连看 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "果园入门", "萌宠动物园", "玩具馆", "海洋馆", "星光夜市", "彩虹广场",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("d1ccc46");
  });

  it("前 99 关一律没有任何 1.1 新机制字段，也没有新方向的重力", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.maxTurns).toBeUndefined();
      expect(lv.rotateMs).toBeUndefined();
      expect(lv.disguise).toBeUndefined();
      expect(lv.disguiseMs).toBeUndefined();
      expect(["none", "down", "left"]).toContain(lv.gravity);
      expect(turnsOf(lv)).toBe(2);
      expect(lv.theme).toBeLessThan(6);
    }
  });

  it("前六套主题图案与 1.0 一模一样", () => {
    expect(THEME_EMOJIS[0][0]).toBe("🍎");
    expect(THEME_EMOJIS[5][0]).toBe("🌈");
    expect(fnv(JSON.stringify(THEME_EMOJIS.slice(0, 6)))).toBe("eaadf554");
  });
});

describe("连连看 · 1.1 新场馆", () => {
  it("总关数 188，末尾追加了 4 座全新场馆共 89 关", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(totalSize(CHAPTERS)).toBe(188);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["风车旋转馆", "一拐直通道", "伪装迷影阁", "四方重力场"]);
  });

  it("新场馆文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四座新场馆的机制各不相同：旋转 / 一拐 / 面具 / 四方重力", () => {
    for (let lv = CH.spin[0]; lv < CH.spin[1]; lv++) {
      expect(LEVELS[lv].rotateMs ?? 0).toBeGreaterThan(0);
      // 只有正方形棋盘转得起来
      expect(LEVELS[lv].rows).toBe(LEVELS[lv].cols);
    }
    for (let lv = CH.turn[0]; lv < CH.turn[1]; lv++) expect(turnsOf(LEVELS[lv])).toBe(1);
    for (let lv = CH.mask[0]; lv < CH.mask[1]; lv++) {
      expect(LEVELS[lv].disguise ?? 0).toBeGreaterThan(0);
      expect(LEVELS[lv].disguiseMs ?? 0).toBeGreaterThanOrEqual(3500);
    }
    const dirs = new Set<string>();
    for (let lv = CH.grav[0]; lv < CH.grav[1]; lv++) dirs.add(LEVELS[lv].gravity);
    expect(dirs).toEqual(new Set(["up", "right", "down", "left"]));
    // 旋转只在旋转馆出现，别的章不会莫名其妙转起来
    for (const lv of NEW_LEVELS) {
      if (chapterOf(CHAPTERS, lv) !== 6) expect(LEVELS[lv].rotateMs).toBeUndefined();
    }
  });

  it("四套新主题图案各 14 个、互不重样，也不会撞上面具", () => {
    expect(THEME_EMOJIS).toHaveLength(10);
    for (const pool of THEME_EMOJIS) {
      expect(pool.length).toBeGreaterThanOrEqual(14);
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool).not.toContain(MASK_FACE);
    }
    const fresh = THEME_EMOJIS.slice(6).flat();
    const old = new Set(THEME_EMOJIS.slice(0, 6).flat());
    // 新场馆基本换了一批图案（允许极个别通用图案重复）
    expect(fresh.filter((e) => old.has(e)).length).toBeLessThanOrEqual(4);
  });

  it("第 100–188 关棋盘都合法：格子成双、图案够用、时间够走完", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect((cfg.rows * cfg.cols) % 2).toBe(0);
      expect(cfg.kinds).toBeLessThanOrEqual(THEME_EMOJIS[cfg.theme].length);
      expect(cfg.kinds).toBeGreaterThanOrEqual(8);
      // 图案种类要够配对：每种至少能摊到一对
      expect(cfg.kinds * 2).toBeLessThanOrEqual(cfg.rows * cfg.cols);
      expect(cfg.shuffles).toBeGreaterThanOrEqual(3);
      // 每消一对留 2 秒以上，窄屏慢慢点也来得及
      expect(cfg.seconds).toBeGreaterThanOrEqual((cfg.rows * cfg.cols) / 2 * 2);
      expect(cfg.seconds).toBeLessThanOrEqual(320);
      expect([1, 2]).toContain(turnsOf(cfg));
      expect((cfg.disguise ?? 0)).toBeLessThanOrEqual(0.45);
    }
  });

  it("新场馆内部难度递进：图案更多、时间给得更足", () => {
    const spans = [CH.spin, CH.turn, CH.mask, CH.grav];
    for (const [from, to] of spans) {
      expect(LEVELS[from].kinds).toBeLessThan(LEVELS[to - 1].kinds);
      expect(LEVELS[from].seconds).toBeLessThan(LEVELS[to - 1].seconds);
    }
    expect((LEVELS[CH.mask[0]].disguise ?? 0)).toBeLessThan(LEVELS[CH.mask[1] - 1].disguise ?? 0);
    expect(LEVELS[CH.spin[0]].rotateMs as number).toBeGreaterThan(LEVELS[CH.spin[1] - 1].rotateMs as number);
  });
});

describe("连连看 · 第 100–188 关逐关可解（自动玩家真跑一遍）", () => {
  it("第 100–129 关：自动玩家能把整块棋盘连干净", () => {
    for (let lv = 99; lv < 129; lv++) {
      const res = playOut(lv, boardSeed(lv));
      expect(res.cleared, `第 ${lv + 1} 关剩下 ${res.left} 个连不掉`).toBe(true);
      expect(res.moves).toBe((LEVELS[lv].rows * LEVELS[lv].cols) / 2);
      expect(res.shufflesUsed).toBeLessThanOrEqual(20);
    }
  }, 30000);

  it("第 130–159 关：自动玩家能把整块棋盘连干净", () => {
    for (let lv = 129; lv < 159; lv++) {
      const res = playOut(lv, boardSeed(lv));
      expect(res.cleared, `第 ${lv + 1} 关剩下 ${res.left} 个连不掉`).toBe(true);
      expect(res.moves).toBe((LEVELS[lv].rows * LEVELS[lv].cols) / 2);
    }
  }, 30000);

  it("第 160–188 关：自动玩家能把整块棋盘连干净", () => {
    for (let lv = 159; lv < 188; lv++) {
      const res = playOut(lv, boardSeed(lv));
      expect(res.cleared, `第 ${lv + 1} 关剩下 ${res.left} 个连不掉`).toBe(true);
      expect(res.moves).toBe((LEVELS[lv].rows * LEVELS[lv].cols) / 2);
    }
  }, 30000);

  it("换一批发牌种子也照样连得完（不是只有一副牌运气好）", () => {
    for (const lv of [99, 110, 121, 130, 143, 150, 165, 170, 180, 187]) {
      for (const salt of [1, 2, 3]) {
        const res = playOut(lv, boardSeed(lv) + salt * 7919);
        expect(res.cleared, `第 ${lv + 1} 关 第 ${salt} 副牌剩 ${res.left}`).toBe(true);
      }
    }
  }, 30000);

  it("旋转馆真的转过：自动玩家一路转下来仍然全清", () => {
    for (const lv of [99, 105, 115, 121]) {
      const res = playOut(lv, boardSeed(lv));
      expect(res.rotations).toBeGreaterThan(0);
      expect(res.cleared).toBe(true);
    }
  });
});

describe("连连看 · 1.1 棋盘纯函数", () => {
  it("发牌：内圈铺满、四周留空边、每种图案都成双", () => {
    const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 }, mulberry32(5));
    expect(b.R).toBe(8);
    expect(b.C).toBe(8);
    expect(tilesLeft(b)).toBe(36);
    for (let c = 0; c < b.C; c++) {
      expect(b.grid[0][c]).toBe(-1);
      expect(b.grid[b.R - 1][c]).toBe(-1);
    }
    const count = new Map<number, number>();
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 6; c++) count.set(b.grid[r][c], (count.get(b.grid[r][c]) ?? 0) + 1);
    for (const n of count.values()) expect(n % 2).toBe(0);
  });

  it("连线拐点数：0 只走直线、1 只准一个角、2 才是老规则", () => {
    const b = createBoard({ rows: 3, cols: 3, kinds: 1, gravity: "none", maxTurns: 2 }, mulberry32(1));
    // 清空内圈，自己摆两个角上的棋子
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) b.grid[r][c] = -1;
    b.grid[1][1] = 0;
    b.grid[1][3] = 0;
    expect(findPath(b, [1, 1], [1, 3], 0)).not.toBeNull();
    b.grid[1][2] = 1;
    expect(findPath(b, [1, 1], [1, 3], 0)).toBeNull();
    // 绕一个角就能连上（走空边）
    expect(findPath(b, [1, 1], [1, 3], 2)).not.toBeNull();
    b.grid[3][1] = 0;
    expect(findPath(b, [1, 1], [3, 1], 1)).not.toBeNull();
  });

  it("四向重力：图案分别往下、上、左、右靠拢，个数一个不少", () => {
    const dirs = ["down", "up", "left", "right"] as const;
    for (const dir of dirs) {
      const b = createBoard({ rows: 4, cols: 4, kinds: 4, gravity: dir, maxTurns: 2 }, mulberry32(9));
      removePair(b, [2, 2], [3, 3]);
      const before = tilesLeft(b);
      applyGravity(b, dir);
      expect(tilesLeft(b)).toBe(before);
      const line = (): number[] => {
        if (dir === "down") return [b.grid[1][2], b.grid[4][2]];
        if (dir === "up") return [b.grid[4][2], b.grid[1][2]];
        if (dir === "left") return [b.grid[2][4], b.grid[2][1]];
        return [b.grid[2][1], b.grid[2][4]];
      };
      // 靠拢方向的最外侧一定是满的，另一头才是空的
      const [away, toward] = line();
      expect(toward).toBeGreaterThanOrEqual(0);
      expect(away).toBe(-1);
    }
  });

  it("风车旋转：只对正方形生效，转四次回到原样，图案一个不丢", () => {
    const b = createBoard({ rows: 4, cols: 4, kinds: 4, gravity: "none", maxTurns: 2 }, mulberry32(3));
    const snapshot = JSON.stringify(b.grid);
    expect(rotateBoard(b)).toBe(true);
    expect(JSON.stringify(b.grid)).not.toBe(snapshot);
    expect(tilesLeft(b)).toBe(16);
    rotateBoard(b);
    rotateBoard(b);
    rotateBoard(b);
    expect(JSON.stringify(b.grid)).toBe(snapshot);
    const rect = createBoard({ rows: 4, cols: 6, kinds: 6, gravity: "none", maxTurns: 2 }, mulberry32(3));
    expect(rotateBoard(rect)).toBe(false);
  });

  it("洗牌：图案总数不变，并且尽量洗出至少还有一步能走的局面", () => {
    for (let seed = 0; seed < 20; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 1 }, mulberry32(seed));
      const before = tilesLeft(b);
      expect(shuffleBoard(b, mulberry32(seed + 100), 1)).toBe(true);
      expect(tilesLeft(b)).toBe(before);
      expect(anyMove(b, 1)).not.toBeNull();
    }
  });

  it("面具只挡住眼睛，不改棋盘：戴上面具前后能连的对子一模一样", () => {
    for (let seed = 0; seed < 12; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 }, mulberry32(seed));
      const before = JSON.stringify(anyMove(b, 2));
      const masks = pickMasked(b, 0.35, mulberry32(seed + 7));
      expect(masks.size).toBe(Math.round(36 * 0.35));
      for (const key of masks) expect(key).toMatch(/^\d+,\d+$/);
      expect(JSON.stringify(anyMove(b, 2))).toBe(before);
    }
    const empty = createBoard({ rows: 4, cols: 4, kinds: 4, gravity: "none", maxTurns: 2 }, mulberry32(1));
    expect(pickMasked(empty, 0, mulberry32(1)).size).toBe(0);
    expect(maskKey(3, 5)).toBe("3,5");
  });

  it("自动玩家诚实：洗牌次数为 0 的死局会如实报告没清完", () => {
    const spec: BoardSpec = { rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 0 };
    const res = solveBoard(spec, mulberry32(4), { shuffles: 0 });
    expect(res.cleared).toBe(false);
    expect(res.left).toBeGreaterThan(0);
    // 老关卡（两次拐弯 + 三次洗牌）照样连得完
    const ok = solveBoard(
      { rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 },
      mulberry32(4),
      { shuffles: 3 }
    );
    expect(ok.cleared).toBe(true);
  });
});
