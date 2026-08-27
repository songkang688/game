/**
 * 勇者小路 1.2 · 迷宫小路 / 无尽之路 / 幽灵竞速 的单测。
 *
 * 最重要的一条：**随机 2000 张迷宫全部可解**。
 * 「可解」不是「看着像通的」，而是三条硬校验一起过：
 *  钥匙在门前拿得到、开门之后到得了终点、并且门确实拦在必经之路上。
 */
import { describe, expect, it } from "vitest";
import { makeFighter } from "./combat";
import { Cleanup, type TimerHost } from "./cleanup";
import { defaultSave, loadSave, writeSave, type HeroSave, type StorageLike } from "./logic";
import {
  REST_EVERY,
  SUPPLIES,
  SUPPLY_BUFF_CAP_PERMILLE,
  applySupply,
  floorsToRest,
  fullRoute,
  generateMaze,
  ghostIndexAt,
  ghostPace,
  ghostTotalMs,
  gridSpan,
  isRestFloor,
  judgeRace,
  ptKey,
  roadMaze,
  roadSize,
  rollSupplies,
  shortestPath,
  validateMaze,
  walkable,
  type Maze,
  type Pt
} from "./maze";

function neighbours(a: Pt, b: Pt): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

describe("迷宫生成", () => {
  it("同一个 seed + 同一个尺寸永远生成同一张图", () => {
    const a = generateMaze(20260826, 6, 6);
    const b = generateMaze(20260826, 6, 6);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("换个 seed 就换一张图", () => {
    const a = generateMaze(1, 6, 6);
    const b = generateMaze(2, 6, 6);
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });

  it("网格边长永远是奇数，内圈最少 2×2", () => {
    expect(gridSpan(2)).toBe(5);
    expect(gridSpan(7)).toBe(15);
    expect(gridSpan(0)).toBe(5);
    expect(gridSpan(Number.NaN)).toBe(5);
    for (const cells of [2, 3, 5, 9]) expect(gridSpan(cells) % 2).toBe(1);
  });

  it("外圈一整圈都是墙，孩子不会走出画面", () => {
    const m = generateMaze(77, 5, 5);
    for (let c = 0; c < m.cols; c++) {
      expect(m.walls[0][c]).toBe(true);
      expect(m.walls[m.rows - 1][c]).toBe(true);
    }
    for (let r = 0; r < m.rows; r++) {
      expect(m.walls[r][0]).toBe(true);
      expect(m.walls[r][m.cols - 1]).toBe(true);
    }
  });

  it("起点 / 终点 / 钥匙 / 门 四样互不重合，而且都站得住脚", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const m = generateMaze(seed, 5, 5);
      const spots = [m.start, m.exit, m.key, m.door];
      const keys = new Set(spots.map(ptKey));
      expect(keys.size).toBe(4);
      for (const [r, c] of spots) expect(walkable(m, r, c)).toBe(true);
    }
  });

  it("随机 2000 张迷宫全部可解（钥匙在门前可达 + 开门后终点可达 + 门确实拦路）", () => {
    const bad: number[] = [];
    for (let seed = 1; seed <= 2000; seed++) {
      const cells = 2 + (seed % 8);
      const rows = 2 + ((seed * 3) % 8);
      const check = validateMaze(generateMaze(seed, cells, rows));
      if (!check.ok) bad.push(seed);
    }
    expect(bad, `这些 seed 生成了走不通的迷宫：${bad.slice(0, 8).join("、")}`).toEqual([]);
  });

  it("不拿钥匙就到不了终点——门不是摆设", () => {
    for (let seed = 100; seed < 140; seed++) {
      const m = generateMaze(seed, 5, 5);
      expect(shortestPath(m, m.start, m.exit, true)).toBeNull();
      expect(shortestPath(m, m.start, m.key, true)).not.toBeNull();
      expect(shortestPath(m, m.key, m.exit, false)).not.toBeNull();
    }
  });

  it("fullRoute 是一条真能走的路：每一步只挪一格，且经过钥匙与终点", () => {
    for (let seed = 200; seed < 220; seed++) {
      const m = generateMaze(seed, 4, 4);
      const route = fullRoute(m) as Pt[];
      expect(route).not.toBeNull();
      expect(ptKey(route[0])).toBe(ptKey(m.start));
      expect(ptKey(route[route.length - 1])).toBe(ptKey(m.exit));
      expect(route.some((p) => ptKey(p) === ptKey(m.key))).toBe(true);
      for (let i = 1; i < route.length; i++) {
        expect(neighbours(route[i - 1], route[i])).toBe(true);
        expect(m.walls[route[i][0]][route[i][1]]).toBe(false);
      }
    }
  });

  it("走不到的地方老老实实返回 null，不抛异常", () => {
    const m: Maze = generateMaze(9, 3, 3);
    expect(shortestPath(m, m.start, [0, 0])).toBeNull();
    expect(shortestPath(m, [-1, -1], m.exit)).toBeNull();
  });
});

describe("无尽之路：楼层与休息点", () => {
  it("每 5 层一个休息点", () => {
    expect(REST_EVERY).toBe(5);
    for (const f of [5, 10, 15, 40, 100]) expect(isRestFloor(f)).toBe(true);
    for (const f of [0, 1, 4, 6, 9, 11]) expect(isRestFloor(f)).toBe(false);
  });

  it("floorsToRest 告诉你还差几层歇脚", () => {
    expect(floorsToRest(0)).toBe(5);
    expect(floorsToRest(3)).toBe(2);
    expect(floorsToRest(4)).toBe(1);
    expect(floorsToRest(5)).toBe(5);
  });

  it("同一个休息点永远是同样的三选一（可复现）", () => {
    for (const floor of [5, 10, 25]) {
      const a = rollSupplies(floor).map((s) => s.id);
      const b = rollSupplies(floor).map((s) => s.id);
      expect(b).toEqual(a);
    }
  });

  it("三样互不相同，而且至少有一样是回星芒的", () => {
    for (let floor = REST_EVERY; floor <= 200; floor += REST_EVERY) {
      const picked = rollSupplies(floor);
      expect(picked).toHaveLength(3);
      expect(new Set(picked.map((s) => s.id)).size).toBe(3);
      expect(picked.some((s) => s.kind === "heal")).toBe(true);
    }
  });

  it("补给池里没有「拿到就赢」的东西：攻防加成一律不超过 +8%", () => {
    for (const s of SUPPLIES) {
      if (s.kind === "power" || s.kind === "grit") {
        expect(s.amount).toBeLessThanOrEqual(SUPPLY_BUFF_CAP_PERMILLE);
      }
    }
  });

  it("补给作用在勇者身上：回血不会超过上限，也不改传进来的那个对象", () => {
    const hero = makeFighter({ name: "鸭梨", emoji: "🌸", element: "grass", maxHp: 100, atk: 20, def: 8, spd: 10, hp: 40 });
    const heal = SUPPLIES.find((s) => s.id === "spring");
    expect(heal).toBeDefined();
    const after = applySupply(hero, heal!);
    expect(after.hp).toBe(100);
    expect(hero.hp).toBe(40);

    const shield = SUPPLIES.find((s) => s.kind === "shield");
    expect(applySupply(hero, shield!).shield).toBe(shield!.amount);

    const power = SUPPLIES.find((s) => s.kind === "power");
    expect(applySupply(hero, power!).atk).toBeGreaterThan(hero.atk);
    expect(applySupply(hero, power!).atk).toBeLessThanOrEqual(Math.round(hero.atk * 1.08));

    const grit = SUPPLIES.find((s) => s.kind === "grit");
    expect(applySupply(hero, grit!).def).toBeGreaterThan(hero.def);
  });

  it("楼层迷宫可复现：同一趟 + 同一层永远同一张图，换层就换图", () => {
    const runSeed = 4242;
    expect(JSON.stringify(roadMaze(runSeed, 7))).toBe(JSON.stringify(roadMaze(runSeed, 7)));
    expect(JSON.stringify(roadMaze(runSeed, 7))).not.toBe(JSON.stringify(roadMaze(runSeed, 8)));
    expect(JSON.stringify(roadMaze(runSeed, 7))).not.toBe(JSON.stringify(roadMaze(runSeed + 1, 7)));
  });

  it("楼层越深图越大，但封顶 9×8，360px 上还塞得下", () => {
    expect(roadSize(1).cells).toBe(4);
    expect(roadSize(1).cells).toBeLessThanOrEqual(roadSize(30).cells);
    expect(roadSize(999).cells).toBe(9);
    expect(roadSize(999).cellRows).toBe(8);
  });

  it("第 1–188 层抽样，每一层的迷宫都可解", () => {
    const bad: number[] = [];
    for (let floor = 1; floor <= 188; floor += 1) {
      if (!validateMaze(roadMaze(20261212, floor)).ok) bad.push(floor);
    }
    expect(bad, `这些层的迷宫走不通：${bad.join("、")}`).toEqual([]);
  });
});

describe("幽灵竞速", () => {
  it("赢得越多，影子跑得越快，但有下限（不会快到追不上）", () => {
    expect(ghostPace(10).stepMs).toBeLessThan(ghostPace(0).stepMs);
    expect(ghostPace(999).stepMs).toBeGreaterThanOrEqual(180);
    expect(ghostPace(999).hesitateEvery).toBeGreaterThanOrEqual(4);
  });

  it("影子的位置只会往前走，最后停在终点", () => {
    const m = generateMaze(31, 5, 5);
    const route = fullRoute(m) as Pt[];
    const pace = ghostPace(0);
    let last = -1;
    for (let ms = 0; ms <= ghostTotalMs(route, pace) + 5000; ms += 137) {
      const idx = ghostIndexAt(route, ms, pace);
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
    }
    expect(last).toBe(route.length - 1);
  });

  it("影子跑完全程的时间比「每步都不犹豫」要长（它真的会停一下）", () => {
    const m = generateMaze(32, 5, 5);
    const route = fullRoute(m) as Pt[];
    const pace = ghostPace(0);
    expect(ghostTotalMs(route, pace)).toBeGreaterThan((route.length - 1) * pace.stepMs);
    expect(ghostTotalMs([[1, 1]], pace)).toBe(0);
  });

  it("竞速判定：快的赢、慢的输、一样就是平局", () => {
    expect(judgeRace(1000, 2000)).toBe("win");
    expect(judgeRace(2000, 1000)).toBe("lose");
    expect(judgeRace(1500, 1500)).toBe("tie");
    expect(judgeRace(Number.NaN, 1500)).toBe("lose");
  });
});

describe("中途退出再进来，进度续得上", () => {
  function fakeStore(): StorageLike & { raw: Map<string, string> } {
    const raw = new Map<string, string>();
    return {
      raw,
      getItem: (k) => raw.get(k) ?? null,
      setItem: (k, v) => {
        raw.set(k, v);
      },
      removeItem: (k) => {
        raw.delete(k);
      }
    };
  }

  it("走到一半退出：等级 / 金币 / 背包 / 无尽纪录一样都不丢", () => {
    const store = fakeStore();
    const mid: HeroSave = {
      ...defaultSave(),
      level: 17,
      exp: 42,
      coins: 318,
      bag: [
        { id: "berry", count: 2 },
        { id: "honey", count: 1 }
      ],
      endlessBest: 23,
      arenaWins: 4,
      arenaPlays: 9
    };
    writeSave(mid, store);

    const back = loadSave(store);
    expect(back.level).toBe(17);
    expect(back.exp).toBe(42);
    expect(back.coins).toBe(318);
    expect(back.endlessBest).toBe(23);
    expect(back.arenaWins).toBe(4);
    expect(back.bag).toEqual(mid.bag);
  });

  it("存档被写坏了也不白屏，退回一份全新的存档", () => {
    const store = fakeStore();
    store.setItem("yiduo-yixing.bravepath", "{这不是 JSON");
    expect(loadSave(store).level).toBe(defaultSave().level);
  });

  it("无尽纪录只增不减：新一趟走得浅，纪录还是旧的那个", () => {
    const deep: HeroSave = { ...defaultSave(), endlessBest: 30 };
    const shallowRun = 12;
    const next = { ...deep, endlessBest: Math.max(deep.endlessBest, shallowRun) };
    expect(next.endlessBest).toBe(30);
  });
});

describe("destroy 归零", () => {
  /** 假宿主：不真的排队，只记账，方便断言「一件都不剩」 */
  function fakeHost(): TimerHost & { live: () => number } {
    let next = 1;
    const timers = new Set<number>();
    const intervals = new Set<number>();
    const frames = new Set<number>();
    return {
      setTimeout: () => {
        const id = next++;
        timers.add(id);
        return id;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
      setInterval: () => {
        const id = next++;
        intervals.add(id);
        return id;
      },
      clearInterval: (id) => {
        intervals.delete(id);
      },
      requestAnimationFrame: () => {
        const id = next++;
        frames.add(id);
        return id;
      },
      cancelAnimationFrame: (id) => {
        frames.delete(id);
      },
      live: () => timers.size + intervals.size + frames.size
    };
  }

  it("定时器 / 循环 / rAF / 监听，destroy 之后一件都不剩", () => {
    const host = fakeHost();
    const cleanup = new Cleanup(host);
    const listeners: string[] = [];
    const target = {
      addEventListener: (type: string) => listeners.push(type),
      removeEventListener: (type: string) => {
        const i = listeners.indexOf(type);
        if (i >= 0) listeners.splice(i, 1);
      }
    };

    cleanup.after(100, () => undefined);
    cleanup.every(50, () => undefined);
    cleanup.frame(() => undefined);
    cleanup.on(target, "keydown", () => undefined);
    cleanup.on(target, "pointerup", () => undefined);
    expect(cleanup.pending()).toBe(5);
    expect(host.live()).toBe(3);
    expect(listeners).toHaveLength(2);

    cleanup.destroy();
    expect(cleanup.pending()).toBe(0);
    expect(host.live()).toBe(0);
    expect(listeners).toHaveLength(0);
    expect(cleanup.dead).toBe(true);
  });

  it("destroy 之后再排的定时器不会再触发回调", () => {
    const fired: string[] = [];
    let queued: (() => void) | null = null;
    const host: TimerHost = {
      setTimeout: (fn) => {
        queued = fn;
        return 1;
      },
      clearTimeout: () => undefined
    };
    const cleanup = new Cleanup(host);
    cleanup.after(10, () => fired.push("late"));
    cleanup.destroy();
    (queued as unknown as () => void)?.();
    expect(fired).toEqual([]);
  });

  it("清理函数自己抛异常也不影响后面的清理", () => {
    const cleanup = new Cleanup(fakeHost());
    const done: string[] = [];
    cleanup.own(() => done.push("a"));
    cleanup.own(() => {
      throw new Error("清理时摔了一跤");
    });
    cleanup.own(() => done.push("c"));
    expect(() => cleanup.destroy()).not.toThrow();
    expect(done).toContain("a");
    expect(done).toContain("c");
    expect(cleanup.pending()).toBe(0);
  });
});
