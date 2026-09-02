/**
 * 飞机小队 · 「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员报的 B1:`stepFoes` 先把飞出下边界的敌机 `hp` 清零、
 * 再按 `hp > 0` 去筛 `escaped`,筛子恒为空,`escapedTotal` 永远是 0,
 * 于是 180 个非 Boss 关摆烂就能三星。这里守两件事:
 *
 * 1. 敌机真的从下边界飞出去时,`escaped` 要记上;
 * 2. 战役关摆烂(不拖不按、只有自动射击)不能通关,更不能三星。
 *
 * 走的是真实路径:`createSortie` 排帧 → `stepFoes` → `onFinish`,
 * 再把结算灌进 `sortieCleared` / `starsForSortie`(与 `startSortie` 同一套算法)。
 */
import { afterEach, describe, expect, it } from "vitest";
import { install, type Harness } from "./domStub";
import { buildSortie, isBossLevel } from "./levels";
import { escapeLimit, sortieCleared, starsForSortie } from "./logic";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

interface Outcome {
  cleared: boolean;
  downed: number;
  total: number;
  escaped: number;
  bossDown: boolean;
  touched: number;
  bombs: number;
}

/** 摆烂跑一关:不碰画布、不按键,只让自动射击照常打 */
async function idleSortie(h: Harness, level: number, frames = 4000): Promise<Outcome> {
  const mod = await import("./index");
  const def = buildSortie(level - 1);
  let out: Outcome | null = null;
  const sortie = mod.createSortie({
    host: h.root as unknown as HTMLElement,
    players: 1,
    tint: "#EAF2FF",
    hint: def.hint,
    waves: def.waves,
    boss: def.boss,
    pickups: def.pickups,
    sfx: () => {},
    onFinish: (pilots, result) => {
      out = {
        cleared: result.cleared,
        downed: result.downed,
        total: result.total,
        escaped: result.escaped,
        bossDown: result.bossDown,
        touched: pilots[0].touched,
        bombs: pilots[0].bombsUsed,
      };
    },
  } as never);
  for (let i = 0; i < frames && out === null; i++) h.flush(1);
  sortie.destroy();
  if (out === null) throw new Error(`第 ${level} 关摆烂 ${frames} 帧还没收场`);
  return out;
}

describe("sky-squad · 放跑判罚(B1 回归)", () => {
  it("敌机从下边界飞出去要记进 escaped,不能被上一行的 hp 清零吃掉", async () => {
    const h = (harness = install());
    const out = await idleSortie(h, 1);
    expect(out.total).toBeGreaterThan(0);
    // 摆烂时打不完,剩下的都会从底下溜走 —— escaped 必须真的记上
    expect(out.escaped).toBeGreaterThan(0);
    expect(out.downed + out.escaped).toBe(out.total);
  });

  it("第 1 关摆烂:放跑超过容错,既不算通关也拿不到三星", async () => {
    const h = (harness = install());
    const out = await idleSortie(h, 1);
    const stat = {
      downed: out.downed,
      total: out.total,
      touched: out.touched,
      bombs: out.bombs,
      escaped: out.escaped,
      bossDown: out.bossDown,
    };
    expect(out.escaped).toBeGreaterThan(escapeLimit(out.total));
    expect(sortieCleared(stat, isBossLevel(0))).toBe(false);
    expect(starsForSortie(stat)).toBeLessThan(3);
  });

  it("全 188 关摆烂:一关都过不去", async () => {
    const passed: string[] = [];
    for (let i = 0; i < 188; i++) {
      harness?.restore();
      const h = (harness = install());
      const out = await idleSortie(h, i + 1);
      const stat = {
        downed: out.downed,
        total: out.total,
        touched: out.touched,
        bombs: out.bombs,
        escaped: out.escaped,
        bossDown: out.bossDown,
      };
      if (out.cleared && sortieCleared(stat, isBossLevel(i))) {
        passed.push(`第 ${i + 1} 关(放跑 ${out.escaped}/${out.total}、${starsForSortie(stat)} 星)`);
      }
    }
    expect(passed, `摆烂过关的:${passed.join("、")}`).toEqual([]);
  }, 180_000);
});
