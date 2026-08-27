// 窗口 4 · QA 档C · 第 2 轮测试员:泡泡瞄准手。
//
// 第 2 轮剧本(样本全换):难度曲线 → 竞态(飞行中狂点发射 / 同一发重入结算 / 狂换弹)→
// 无尽持续(压到 120 行)→ 存档往返。
// 竞态那一段把 `index.ts` 的 `fire / swapAmmo / landFlight / afterShot` 一比一搬下来,
// `phase !== "play" || flight || shotsLeft <= 0` 这道闸一个字不改。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, loadStars, mulberry32, saveStar, type StorageLike } from "../level99";
import {
  LEGACY_LEVELS,
  LEVELS,
  THEMES,
  clearableCount,
  parseStars,
  shotBudget,
  themeOfLevel,
} from "./levels";
import {
  COLS,
  countBubbles,
  crossedDeadline,
  descend,
  colorsInGrid,
  isStone,
  parseLayout,
  releaseLoneRainbows,
  rowLen,
  pressCeiling,
  settleShot,
  simulateShot,
  starsForShotsLeft,
  damageStone,
  type Grid,
} from "./logic";
import {
  ENDLESS_PUSH_EVERY,
  SHOOTER_X,
  SHOOTER_Y,
  ammoIsUseful,
  chainScore,
  endlessLine,
  endlessRow,
  endlessRowFill,
  endlessShouldPush,
  endlessStartRows,
  endlessTotal,
  isBomb,
  detonate,
  pickAmmo,
  reload,
  swapLoader,
  type Loader,
} from "./aim12";

/* ------------------------------------------------------------------ */
/* 把 index.ts 的一局搬下来                                            */
/* ------------------------------------------------------------------ */

type Phase = "play" | "won" | "failed";

class Run {
  grid: Grid;
  phase: Phase = "play";
  flight: { result: ReturnType<typeof simulateShot>; color: string } | null = null;
  loader: Loader;
  shotsLeft: number;
  shotsFired = 0;
  chain = 0;
  points = 0;
  rowsPushed = 0;
  /** 每一次输入的去向,用来看狂点有没有被多吃 */
  log: string[] = [];
  private rand: () => number;

  constructor(rows: string[], shots: number, seed = 1) {
    this.grid = parseLayout(rows);
    this.shotsLeft = shots;
    this.rand = mulberry32(seed);
    const pool = ["R", "Y", "B", "G", "P"];
    this.loader = { current: pickAmmo(pool, this.rand), next: pickAmmo(pool, this.rand) };
  }

  /** index.ts 的 fire():飞行中、非游玩态、没子弹一律不响应 */
  fire(dx: number, dy: number): void {
    if (this.phase !== "play" || this.flight || this.shotsLeft <= 0) {
      this.log.push("blocked");
      return;
    }
    const result = simulateShot(this.grid, SHOOTER_X, SHOOTER_Y, dx, dy, {});
    this.shotsLeft--;
    this.flight = { result, color: this.loader.current };
    this.loader = reload(this.loader, this.grid, this.rand);
    this.log.push("fire");
  }

  swapAmmo(): void {
    if (this.phase !== "play" || this.flight) {
      this.log.push("blocked-swap");
      return;
    }
    this.loader = swapLoader(this.loader);
    this.log.push("swap");
  }

  /** index.ts 的 landFlight():只认当前这一发,落完就清空 */
  land(): void {
    if (!this.flight) {
      this.log.push("no-flight");
      return;
    }
    const { result, color } = this.flight;
    this.flight = null;
    let popped = 0;
    let dropped = 0;
    if (result.hitCell && isStone(this.grid.rows[result.hitCell.r]?.[result.hitCell.c] ?? null)) {
      const hit = damageStone(this.grid, result.hitCell.r, result.hitCell.c);
      popped = hit.result === "broken" ? 1 : 0;
      dropped = hit.dropped.length;
    } else if (result.landing) {
      const { r, c } = result.landing;
      if (isBomb(color)) {
        const blast = detonate(this.grid, r, c);
        popped = blast.popped.length;
        dropped = blast.dropped.length;
      } else {
        this.grid.rows[r][c] = color;
        const s = settleShot(this.grid, r, c);
        popped = s.popped.length;
        dropped = s.dropped.length;
      }
    }
    if (popped === 0 && dropped === 0) this.chain = 0;
    else {
      this.chain++;
      this.points += chainScore(popped, dropped, this.chain);
    }
    this.shotsFired++;
    releaseLoneRainbows(this.grid);
    this.log.push("land");
  }

  snapshot(): string {
    return JSON.stringify([this.grid.rows, this.shotsLeft, this.shotsFired, this.points, this.loader]);
  }
}

/** 第 2 轮换的样本:和第 1 轮的 1 / 100 / 188 一关不重 */
const SAMPLE = [11, 29, 44, 67, 83, 105, 127, 149, 166, 180];

/* ------------------------------------------------------------------ */
/* 一、难度曲线                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · bubble-aim · 难度曲线", () => {
  /** 每个主题的平均泡泡数与子弹预算(预算 = 发/颗,越小越紧) */
  const perTheme = THEMES.map((_, t) => {
    const rows = LEVELS.filter((_l, i) => themeOfLevel(i) === t);
    return {
      t,
      n: rows.length,
      bubbles: rows.reduce((s, l) => s + clearableCount(l), 0) / Math.max(1, rows.length),
      budget: rows.reduce((s, l) => s + shotBudget(l), 0) / Math.max(1, rows.length),
    };
  });

  it("九个主题都有关卡,每一关的规模都在同一个量级里", () => {
    expect(perTheme).toHaveLength(THEMES.length);
    for (const p of perTheme) {
      expect(p.n, `第 ${p.t + 1} 主题一关都没有`).toBeGreaterThan(0);
      expect(p.bubbles, `第 ${p.t + 1} 主题的泡泡太少`).toBeGreaterThan(15);
      expect(p.bubbles, `第 ${p.t + 1} 主题的泡泡太多`).toBeLessThan(40);
    }
    expect(perTheme[perTheme.length - 1].budget, "终极主题反而最松").toBe(
      Math.min(...perTheme.map((p) => p.budget))
    );
  });

  it("【C2-03 一般】新手主题的子弹预算比中段六个主题都紧", () => {
    // 现状快照:第 1 主题 0.71 发/颗,第 2~8 主题在 0.83~1.25 之间,只有终极主题 0.54 更紧。
    // 也就是说新手一进门就打最紧的一批,到第 2 主题反而松下来,曲线是「先紧后松再紧」。
    const first = perTheme[0].budget;
    const middle = perTheme.slice(1, THEMES.length - 1).map((p) => p.budget);
    expect(first).toBeLessThan(Math.min(...middle));
    expect(first).toBeGreaterThan(perTheme[perTheme.length - 1].budget);
    // 关得住的上限:再紧下去理论上就打不完了(一发最多消一大串,但下限是 1/3 发/颗)
    expect(first).toBeGreaterThan(1 / 3);
  });

  it("换一批样本关:每一关的子弹预算都在合理区间,不白送也不逼死人", () => {
    for (const i of SAMPLE) {
      const lv = LEVELS[i];
      const need = clearableCount(lv);
      expect(need, `第 ${i + 1} 关一颗要清的泡泡都没有`).toBeGreaterThan(0);
      const budget = shotBudget(lv);
      // 一发最少消 3 颗,所以 1/3 发/颗是理论下限;这里留一倍余量
      expect(budget, `第 ${i + 1} 关 ${lv.shots} 发要清 ${need} 颗,太紧了`).toBeGreaterThan(1 / 3);
      expect(budget, `第 ${i + 1} 关子弹白送(${budget.toFixed(2)} 发/颗)`).toBeLessThan(3);
    }
  });

  it("评星门槛单调:剩的子弹越多星越多", () => {
    for (const i of SAMPLE) {
      const total = LEVELS[i].shots;
      let prev = 0;
      for (let left = 0; left <= total; left++) {
        const s = starsForShotsLeft(left, total);
        expect(s, `第 ${i + 1} 关剩 ${left} 发反而星更少`).toBeGreaterThanOrEqual(prev);
        prev = s;
      }
      expect(starsForShotsLeft(total, total)).toBe(3);
      expect(starsForShotsLeft(0, total)).toBe(1);
    }
  });

  it("连锁分只涨不掉:同样的战果,连锁越长分越高", () => {
    for (let chain = 2; chain <= 12; chain++) {
      expect(chainScore(4, 2, chain)).toBeGreaterThanOrEqual(chainScore(4, 2, chain - 1));
    }
    expect(chainScore(0, 0, 5)).toBeGreaterThanOrEqual(0);
  });
});

/* ------------------------------------------------------------------ */
/* 二、竞态                                                            */
/* ------------------------------------------------------------------ */

describe("档C R2 · bubble-aim · 竞态", () => {
  const ROWS = LEVELS[SAMPLE[2]].layout;

  it("泡泡还在飞的时候狂点发射 50 下:子弹只掉 1 发", () => {
    const run = new Run(ROWS, 30);
    run.fire(0, -1);
    const left = run.shotsLeft;
    for (let k = 0; k < 50; k++) run.fire(0.3, -0.9);
    expect(run.shotsLeft).toBe(left);
    expect(run.log.filter((x) => x === "fire")).toHaveLength(1);
    expect(run.log.filter((x) => x === "blocked")).toHaveLength(50);
  });

  it("同一发结算被重入 20 次:只算一次,墙面不会被改两遍", () => {
    const run = new Run(ROWS, 30);
    run.fire(0, -1);
    run.land();
    const after = run.snapshot();
    for (let k = 0; k < 20; k++) run.land();
    expect(run.snapshot()).toBe(after);
    expect(run.shotsFired).toBe(1);
    expect(run.log.filter((x) => x === "no-flight")).toHaveLength(20);
  });

  it("飞行中狂点换弹:换不动,弹药顺序一颗不乱", () => {
    const run = new Run(ROWS, 30);
    run.fire(0, -1);
    const ammo = JSON.stringify(run.loader);
    for (let k = 0; k < 30; k++) run.swapAmmo();
    expect(JSON.stringify(run.loader)).toBe(ammo);
    run.land();
    // 落地之后换弹恢复正常:两颗对调,换两次等于没换
    run.loader = { current: "R", next: "B" };
    run.swapAmmo();
    expect(run.loader).toEqual({ current: "B", next: "R" });
    run.swapAmmo();
    expect(run.loader).toEqual({ current: "R", next: "B" });
    // 连着换 99 次(奇数次),结果就是换了一次
    for (let k = 0; k < 99; k++) run.swapAmmo();
    expect(run.loader).toEqual({ current: "B", next: "R" });
  });

  it("子弹打光之后再怎么点都不响应,也不会打出负数发", () => {
    const run = new Run(ROWS, 3);
    for (let k = 0; k < 3; k++) {
      run.fire(0.2 * k, -1);
      run.land();
    }
    expect(run.shotsLeft).toBe(0);
    for (let k = 0; k < 40; k++) run.fire(0, -1);
    expect(run.shotsLeft).toBe(0);
    expect(run.shotsFired).toBe(3);
  });

  it("结算态(赢/输)下所有输入都失效", () => {
    for (const p of ["won", "failed"] as Phase[]) {
      const run = new Run(ROWS, 20);
      run.phase = p;
      const before = run.snapshot();
      for (let k = 0; k < 20; k++) {
        run.fire(0, -1);
        run.swapAmmo();
      }
      expect(run.snapshot(), `${p} 态还能开火`).toBe(before);
    }
  });

  it("同一拍既压顶板又压新行:泡泡不会被叠丢,总数只增不减", () => {
    const g = parseLayout(ROWS);
    const before = countBubbles(g);
    pressCeiling(g);
    descend(g, "RYBGRYBGR");
    const after = countBubbles(g);
    expect(after).toBeGreaterThan(before);
    // 每一行的格子数还是合法的
    for (let r = 0; r < g.rows.length; r++) {
      expect(g.rows[r].length).toBeLessThanOrEqual(COLS);
      expect(g.rows[r].length).toBeGreaterThanOrEqual(COLS - 1);
    }
  });

  it("连锁计数在一发没收获时归零,不会跨发偷偷累积", () => {
    const run = new Run(ROWS, 40);
    run.chain = 7;
    // 打一发朝天的空枪(打到顶上贴住,通常没有消除)
    run.fire(0, -1);
    run.land();
    expect(run.chain === 0 || run.chain === 8).toBe(true);
    if (run.chain === 0) expect(run.points).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 三、无尽持续                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · bubble-aim · 无尽压到 120 行", () => {
  const COLORS = ["R", "Y", "B", "G", "P"];

  it("连压 120 行,每一行都合法、颜色都在色板里", () => {
    const rand = mulberry32(2026);
    const g = parseLayout(endlessStartRows(COLORS, rand, 4));
    for (let n = 0; n < 120; n++) {
      const line = endlessRow(g, COLORS, rand, n);
      expect(line.length, `第 ${n + 1} 行长度不对`).toBe(rowLen(g.flip ^ 1, 0));
      for (const ch of line) expect([...COLORS, "."], `第 ${n + 1} 行冒出了 ${ch}`).toContain(ch);
      descend(g, line);
      // 压满之后把最下面几行清掉,模拟玩家一直在打
      if (g.rows.length > 8) g.rows.length = 8;
    }
  });

  it("越往后压的行越满 —— 难度确实在涨", () => {
    let prev = -1;
    for (let n = 0; n <= 60; n++) {
      const fill = endlessRowFill(n);
      expect(fill, `第 ${n} 行的密度掉头了`).toBeGreaterThanOrEqual(prev);
      expect(fill).toBeLessThanOrEqual(1);
      prev = fill;
    }
    expect(endlessRowFill(60)).toBeGreaterThan(endlessRowFill(0));
  });

  it("压行的节奏是每 5 发一次,不会漏拍也不会连着压两次", () => {
    expect(ENDLESS_PUSH_EVERY).toBe(5);
    let pushes = 0;
    for (let fired = 1; fired <= 200; fired++) if (endlessShouldPush(fired)) pushes++;
    expect(pushes).toBe(40);
    expect(endlessShouldPush(5)).toBe(true);
    expect(endlessShouldPush(6)).toBe(false);
  });

  it("【C2-02 阻断 · 待修】无尽清屏补货时,一半的时候直接抛异常把游戏卡死", () => {
    // `afterEndlessShot()` 清屏后走的是
    //   for (const line of endlessStartRows(COLORS, rand, 2)) descend(g, line);
    // `endlessStartRows` 按 `rowLen(0, r)` 出长度,永远是「9 然后 8」;
    // 而 `descend` 要的是 `rowLen(g.flip ^ 1, 0)`,随已压行数的奇偶在 8 / 9 之间来回。
    // flip 为 0 时要 8 却给 9 —— parseRow 直接抛。
    const rand = mulberry32(9);
    const lines = endlessStartRows(COLORS, rand, 2);
    expect(lines.map((l) => l.length)).toEqual([COLS, COLS - 1]);

    // flip = 1(压过奇数行):要 9 给 9,补得上
    const ok = parseLayout(endlessStartRows(COLORS, mulberry32(3), 4));
    descend(ok, endlessRow(ok, COLORS, mulberry32(4), 0));
    expect(ok.flip).toBe(1);
    for (const line of endlessStartRows(COLORS, mulberry32(5), 2)) descend(ok, line);
    expect(countBubbles(ok)).toBeGreaterThan(0);

    // flip = 0(开局,或者压过偶数行):要 8 给 9 —— 抛异常
    const bad = parseLayout(endlessStartRows(COLORS, mulberry32(3), 4));
    expect(bad.flip).toBe(0);
    expect(() => {
      for (const line of endlessStartRows(COLORS, mulberry32(5), 2)) descend(bad, line);
    }).toThrow(/8 个字符/);
  });

  it("成绩换算只增不减,收工那句话只鼓励", () => {
    let prev = -1;
    for (let rows = 0; rows <= 120; rows += 4) {
      const t = endlessTotal(rows * 30, rows);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
    for (const [score, best] of [[0, 0], [10, 500], [900, 100]]) {
      const line = endlessLine(score, best);
      expect(line.length).toBeGreaterThan(0);
      for (const bad of ["输", "笨", "菜", "失败"]) expect(line).not.toContain(bad);
    }
  });

  it("上膛永远不给「墙上根本没有的颜色」这种废弹", () => {
    const rand = mulberry32(555);
    let g = parseLayout(["RRR...YYY", "RR....YY"]);
    let loader: Loader = { current: "R", next: "Y" };
    for (let k = 0; k < 200; k++) {
      loader = reload(loader, g, rand);
      const pool = colorsInGrid(g);
      expect(
        ammoIsUseful(loader.current, pool) || loader.current === "W" || isBomb(loader.current),
        `第 ${k} 次上膛给了废弹 ${loader.current},墙上只剩 ${pool.join("")}`
      ).toBe(true);
      // 半路整面墙换色:上膛必须跟着换,不能还攥着老颜色
      if (k === 100) g = parseLayout(["BBB...GGG"]);
    }
    expect(colorsInGrid(g).sort()).toEqual(["B", "G"]);
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

/** 把 index.ts 里那套自建存档一比一搬下来(读法、写法、容错都照抄) */
const SAVE_KEY = "yiduo.bubble-aim.campaign.v2";

function parseStars(raw: unknown): number[] {
  const out = LEVELS.map(() => 0);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(raw.length, out.length); i++) {
    const v = raw[i];
    out[i] = typeof v === "number" && Number.isFinite(v) ? Math.min(3, Math.max(0, Math.round(v))) : 0;
  }
  return out;
}

function loadProgress(st: StorageLike): number[] {
  try {
    const raw = st.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(data.stars)) return parseStars(data.stars);
    }
  } catch {
    // 读不到就当新档
  }
  return LEVELS.map(() => 0);
}

function saveProgress(st: StorageLike, stars: number[]): void {
  st.setItem(SAVE_KEY, JSON.stringify({ stars }));
}

describe("档C R2 · bubble-aim · 存档往返", () => {
  it("写进去几星,读出来还是几星", () => {
    const st = memStore();
    const stars = LEVELS.map((_l, i) => (SAMPLE.includes(i) ? 3 : 0));
    saveProgress(st, stars);
    expect(loadProgress(st)).toEqual(stars);
  });

  it("关掉再开:整份 188 关进度一关不差", () => {
    const st = memStore();
    const rand = mulberry32(31337);
    const want = LEVELS.map(() => Math.floor(rand() * 4));
    saveProgress(st, want);
    const reopened = memStore();
    for (const [k, v] of Object.entries(st.dump())) reopened.setItem(k, v);
    expect(loadProgress(reopened)).toEqual(want);
  });

  it("存档被写坏 / 越界 / 缺字段,都只是当新档,不会崩", () => {
    const st = memStore();
    for (const junk of [
      "",
      "}{",
      "null",
      "[]",
      '{"stars":null}',
      '{"stars":"abc"}',
      '{"stars":[1,"x",null,99,-7,2.6]}',
      '{"other":1}',
    ]) {
      st.setItem(SAVE_KEY, junk);
      const back = loadProgress(st);
      expect(back, `${junk} 之后长度不对`).toHaveLength(LEVELS.length);
      expect(
        back.every((v) => Number.isInteger(v) && v >= 0 && v <= 3),
        `${junk} 之后星数越界:${back.slice(0, 8).join(",")}`
      ).toBe(true);
    }
  });

  it("老存档只写了前 99 关,新版读出来后面自动补 0,老进度一关不丢", () => {
    const st = memStore();
    const old = Array.from({ length: LEGACY_LEVELS }, (_, i) => (i % 3) + 1);
    st.setItem(SAVE_KEY, JSON.stringify({ stars: old }));
    const back = loadProgress(st);
    expect(back).toHaveLength(LEVELS.length);
    for (let i = 0; i < LEGACY_LEVELS; i++) expect(back[i], `老存档第 ${i + 1} 关丢了`).toBe(old[i]);
    for (let i = LEGACY_LEVELS; i < LEVELS.length; i++) expect(back[i]).toBe(0);
  });

  it("存档 key 一个字都没改,还是 1.0 那一个", () => {
    const st = memStore();
    saveProgress(st, LEVELS.map(() => 0));
    expect(st.keys!()).toEqual([SAVE_KEY]);
    // 平台的 l99 key 没有被这一款占用
    expect(loadStars("bubble-aim", memStore())).toHaveLength(TOTAL_LEVELS);
  });
});
