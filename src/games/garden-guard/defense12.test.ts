import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EARLY_CALL_MAX,
  ENDLESS_BOSS_EVERY,
  ENDLESS_PATHS,
  ENDLESS_SCENE_EVERY,
  FIXED_STEP,
  MAX_SUBSTEPS,
  SPEED_STEPS,
  THREAT_LABEL,
  TOWER_COUNTERS,
  bestWave,
  buildEndlessLevel,
  canHandle,
  countersFor,
  dominantTower,
  earlyCallBonus,
  endlessBossAt,
  endlessCount,
  endlessLine,
  endlessPathIndex,
  endlessPetalGrant,
  endlessPool,
  endlessWave,
  makeGuardRng,
  nextSpeed,
  planSteps,
  previewAdvice,
  speedLabel,
  threatsOf,
  towersWithUniqueNiche,
  wavePreview,
} from "./defense12";
import {
  GRID_COLS,
  GRID_ROWS,
  LEVELS,
  MONSTER_INFO,
  THEME_ORDER,
  TOWER_INFO,
  TOWER_KINDS,
  buildWaypoints,
  canPlace,
  pathLength,
  pathsCellSet,
  sellRefund,
  type MonsterKind,
} from "./logic";
import { simulateLevel } from "./sim";

/* ---------------- 克制关系 ---------------- */

describe("1.2 克制关系表", () => {
  it("每个威胁标签都有中文名（攻略要直接印出来）", () => {
    for (const tag of Object.keys(THREAT_LABEL) as Array<keyof typeof THREAT_LABEL>) {
      expect(THREAT_LABEL[tag].length).toBeGreaterThan(0);
    }
  });

  it("四类点名机制都能从怪物表里读出来", () => {
    expect(threatsOf("shieldy")).toContain("armor");
    expect(threatsOf("fasty")).toContain("swift");
    expect(threatsOf("flappy")).toContain("air");
    expect(threatsOf("splity")).toContain("split");
    expect(threatsOf("sneaky")).toContain("sneak");
    expect(threatsOf("healy")).toContain("heal");
  });

  it("四类怪都各有 BOSS 变体", () => {
    const bosses = (Object.keys(MONSTER_INFO) as MonsterKind[]).filter((k) => MONSTER_INFO[k].boss);
    const has = (tag: string): boolean => bosses.some((k) => threatsOf(k).includes(tag as never));
    expect(has("armor")).toBe(true);
    expect(has("swift")).toBe(true);
    expect(has("air")).toBe(true);
    expect(has("split")).toBe(true);
  });

  it("对空塔才打得到飞怪，地面塔一律够不着", () => {
    expect(canHandle("needle", "flappy")).toBe(true);
    expect(canHandle("bubble", "flappy")).toBe(true);
    expect(canHandle("boom", "flappy")).toBe(false);
    expect(canHandle("mist", "flappy")).toBe(false);
  });

  it("硬壳怪只有毒雾塔绕得过去", () => {
    expect(canHandle("mist", "shieldy")).toBe(true);
    expect(canHandle("needle", "shieldy")).toBe(false);
  });

  it("产出塔与光环塔不算「打得动」（它们不是输出位）", () => {
    expect(canHandle("sunny", "softy")).toBe(false);
    expect(canHandle("dew", "softy")).toBe(false);
  });

  it("对症判定：针针治快，毒雾治硬壳，花火治分身", () => {
    expect(countersFor("needle", "fasty")).toContain("swift");
    expect(countersFor("mist", "shieldy")).toContain("armor");
    expect(countersFor("boom", "splity")).toContain("split");
    expect(countersFor("dew", "shieldy")).toEqual([]);
  });
});

/* ---------------- 无支配塔 ---------------- */

describe("1.2 没有支配塔", () => {
  it("没有任何一种塔能通吃所有怪", () => {
    expect(dominantTower()).toBeNull();
  });

  it("每一种攻击塔都有别的塔顶不了的活", () => {
    const niche = towersWithUniqueNiche();
    for (const tower of TOWER_KINDS) {
      if (TOWER_INFO[tower].dmg <= 0 && !TOWER_INFO[tower].poison) continue;
      if (TOWER_COUNTERS[tower].length === 0) continue;
      expect(niche.length).toBeGreaterThan(0);
    }
    expect(niche).toContain("mist");
    expect(niche.length).toBeGreaterThanOrEqual(2);
  });

  it("抽样 10 关都能靠模拟器打赢（说明现有塔组不止一条解）", () => {
    const ids = [0, 10, 24, 40, 60, 80, 99, 130, 160, 187];
    const bad: number[] = [];
    for (const i of ids) {
      if (!simulateLevel(i).win) bad.push(i + 1);
    }
    expect(bad).toEqual([]);
  });

  it("一座塔都不种的话，抽样这几关都守不住（说明关卡不是白送）", () => {
    for (const i of [0, 40, 99, 187]) {
      expect(simulateLevel(i, { noTowers: true }).win, `第 ${i + 1} 关不种塔也能赢`).toBe(false);
    }
  });
});

/* ---------------- 波次预览 ---------------- */

describe("1.2 波次预览", () => {
  it("同种怪合并计数，BOSS 排最前面", () => {
    const items = wavePreview([
      { kind: "softy", count: 3, gap: 1 },
      { kind: "boss1", count: 1, gap: 1 },
      { kind: "softy", count: 2, gap: 1 },
    ]);
    expect(items[0].kind).toBe("boss1");
    expect(items.find((i) => i.kind === "softy")?.count).toBe(5);
  });

  it("预览会把这一波的难点标出来", () => {
    const items = wavePreview([{ kind: "flappy", count: 4, gap: 1 }]);
    expect(items[0].threats).toContain("air");
    expect(previewAdvice(items)).toContain("飞");
  });

  it("空波不会崩，给一句普通提示", () => {
    expect(wavePreview([])).toEqual([]);
    expect(previewAdvice([]).length).toBeGreaterThan(0);
  });

  it("188 关每一关的每一波都预览得出来", () => {
    for (const lv of LEVELS) {
      for (const wave of lv.waves) {
        const items = wavePreview(wave);
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((i) => i.count > 0)).toBe(true);
      }
    }
  });

  it("提前召唤按秒给奖励，有封顶，提前 0 秒没有奖励", () => {
    expect(earlyCallBonus(0)).toBe(0);
    expect(earlyCallBonus(-5)).toBe(0);
    expect(earlyCallBonus(3)).toBe(3);
    expect(earlyCallBonus(999)).toBe(EARLY_CALL_MAX);
  });
});

/* ---------------- 速度控制 ---------------- */

describe("1.2 速度控制", () => {
  it("只有 1× 和 2× 两档，点一下循环", () => {
    expect(SPEED_STEPS).toEqual([1, 2]);
    expect(nextSpeed(1)).toBe(2);
    expect(nextSpeed(2)).toBe(1);
    expect(nextSpeed(7)).toBe(1);
    expect(speedLabel(1)).toContain("正常");
    expect(speedLabel(2)).toContain("2");
  });

  it("2× 跑 t 秒的子步数与 1× 跑 2t 秒完全一致（结果必然一样）", () => {
    let carryFast = 0;
    let carrySlow = 0;
    let fast = 0;
    let slow = 0;
    for (let i = 0; i < 240; i++) {
      const a = planSteps(carryFast, 1 / 60, 2);
      carryFast = a.rest;
      fast += a.steps;
      for (let k = 0; k < 2; k++) {
        const b = planSteps(carrySlow, 1 / 60, 1);
        carrySlow = b.rest;
        slow += b.steps;
      }
    }
    expect(fast).toBe(slow);
  });

  it("卡了一大帧也不会一次补太多子步", () => {
    const plan = planSteps(0, 5, 2);
    expect(plan.steps).toBe(MAX_SUBSTEPS);
  });

  it("不满一个固定步就先攒着，攒够了再走", () => {
    const a = planSteps(0, FIXED_STEP / 3, 1);
    expect(a.steps).toBe(0);
    expect(a.rest).toBeGreaterThan(0);
    const b = planSteps(a.rest, FIXED_STEP, 1);
    expect(b.steps).toBe(1);
  });
});

/* ---------------- 无尽守到底 ---------------- */

describe("1.2 无尽守到底", () => {
  it("同 seed 同波次生成完全一样的编成", () => {
    expect(endlessWave(12, 733)).toEqual(endlessWave(12, 733));
    expect(makeGuardRng(5)()).toBe(makeGuardRng(5)());
  });

  it("怪的种类是一波波解锁的，第一波只有最基础的那种", () => {
    expect(endlessPool(1)).toEqual(["softy"]);
    expect(endlessPool(9)).toContain("shieldy");
    expect(endlessPool(30).length).toBeGreaterThan(endlessPool(5).length);
  });

  it("数量随波数上涨但有封顶（不会变成卡成幻灯片的一大堆）", () => {
    expect(endlessCount(1)).toBeLessThan(endlessCount(10));
    expect(endlessCount(999)).toBeLessThanOrEqual(30);
  });

  it("每 10 波来一只 BOSS，且会换着来", () => {
    expect(endlessBossAt(1)).toBeNull();
    expect(endlessBossAt(ENDLESS_BOSS_EVERY)).not.toBeNull();
    expect(endlessBossAt(ENDLESS_BOSS_EVERY * 2)).not.toBe(endlessBossAt(ENDLESS_BOSS_EVERY));
  });

  it("每一波的编成都不是空的，只只有效", () => {
    for (let n = 1; n <= 40; n++) {
      const wave = endlessWave(n);
      expect(wave.length, `第 ${n} 波是空的`).toBeGreaterThan(0);
      for (const e of wave) {
        expect(MONSTER_INFO[e.kind]).toBeTruthy();
        expect(e.count).toBeGreaterThan(0);
        expect(e.gap).toBeGreaterThan(0);
      }
    }
  });

  it("越往后给的启动花瓣越多（不然后面根本摆不起）", () => {
    expect(endlessPetalGrant(20)).toBeGreaterThan(endlessPetalGrant(1));
  });

  it("最好成绩取大，结算话术只鼓励", () => {
    expect(bestWave(9, 3)).toBe(9);
    expect(bestWave(9, 14)).toBe(14);
    for (const [w, b] of [[1, 0], [5, 12], [20, 20]]) {
      const line = endlessLine(w, b);
      expect(line.length).toBeGreaterThan(4);
      expect(line).not.toMatch(/死|输了|失败|笨/);
    }
  });
});

/* ---------------- 无尽关卡拼装 ---------------- */

describe("1.2 无尽关卡拼装", () => {
  it("拼出来的每一波都是一份能直接开打的关卡", () => {
    for (let n = 1; n <= 24; n++) {
      const def = buildEndlessLevel(n);
      expect(def.paths.length).toBe(1);
      expect(def.waves.length).toBe(1);
      expect(def.waves[0].length).toBeGreaterThan(0);
      expect(def.startPetals).toBeGreaterThan(0);
      expect(def.name).toContain(`${n}`);
      expect(THEME_ORDER).toContain(def.theme);
    }
  });

  it("路线全在格子里，而且首尾都贴着边（怪要能进来、也要能走到花那儿）", () => {
    for (const path of ENDLESS_PATHS) {
      for (const [c, r] of path) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(GRID_COLS);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(GRID_ROWS);
      }
      // 每一段都得是横平竖直的，斜着走会从塔的射程缝里钻过去
      for (let i = 1; i < path.length; i++) {
        const same = path[i][0] === path[i - 1][0] || path[i][1] === path[i - 1][1];
        expect(same).toBe(true);
      }
      expect(path[0][0]).toBe(0);
      expect(path[path.length - 1][0]).toBe(GRID_COLS - 1);
    }
  });

  it("每条无尽路线都够长，塔有得打（不是三步就到花前）", () => {
    for (const path of ENDLESS_PATHS) {
      expect(pathLength(buildWaypoints(path))).toBeGreaterThan(12);
    }
  });

  it("每 4 波换一次场景，三条路线都会轮到", () => {
    expect(endlessPathIndex(1)).toBe(endlessPathIndex(ENDLESS_SCENE_EVERY));
    expect(endlessPathIndex(ENDLESS_SCENE_EVERY + 1)).not.toBe(endlessPathIndex(1));
    const seen = new Set<number>();
    for (let n = 1; n <= ENDLESS_SCENE_EVERY * ENDLESS_PATHS.length; n++) seen.add(endlessPathIndex(n));
    expect(seen.size).toBe(ENDLESS_PATHS.length);
  });

  it("同 seed 拼出来的关一模一样（换一个 seed 就换一批怪）", () => {
    expect(buildEndlessLevel(7, 733)).toEqual(buildEndlessLevel(7, 733));
    expect(buildEndlessLevel(7, 733).waves[0]).not.toEqual(buildEndlessLevel(7, 999).waves[0]);
  });

  it("无尽路线不会把整张图堵死，塔位还剩一大半", () => {
    for (const path of ENDLESS_PATHS) {
      const blocked = pathsCellSet([path]);
      let free = 0;
      for (let c = 0; c < GRID_COLS; c++) {
        for (let r = 0; r < GRID_ROWS; r++) {
          if (canPlace(c, r, blocked, new Set())) free++;
        }
      }
      expect(free).toBeGreaterThan((GRID_COLS * GRID_ROWS) / 2);
    }
  });
});

/* ---------------- 点名关与退款 ---------------- */

describe("1.2 点名关与退款规则", () => {
  it("第 100 / 145 / 188 关都能靠模拟器打通", () => {
    for (const n of [100, 145, 188]) {
      expect(simulateLevel(n - 1).win, `第 ${n} 关模拟打不过`).toBe(true);
    }
  });

  it("卖塔退六成、至少退 1 片，越升级退得越多（点错不会毁一局）", () => {
    for (const kind of TOWER_KINDS) {
      expect(sellRefund(kind, 1)).toBeGreaterThanOrEqual(1);
      expect(sellRefund(kind, 1)).toBeLessThan(TOWER_INFO[kind].cost);
      expect(sellRefund(kind, 3)).toBeGreaterThan(sellRefund(kind, 1));
    }
  });
});

/* ---------------- 监督修复员补的守门用例 ---------------- */

/**
 * 1.2 监督修复员第 3 轮:钉住「本文件里的东西没有一样进了游戏」。
 *
 * `defense12.ts` 写在 1.2 早期,把守塔这一轮要做的几件事的**规格**先定了下来。
 * 后来这几件事各自落到了别的文件里,本文件就整个没接线了:
 *
 * | 规格(本文件)        | 真正接线的实现                   |
 * | -------------------- | -------------------------------- |
 * | 波次预告 `wavePreview` | `wave12.ts` 的同名函数(返回结构不同) |
 * | 提前召唤 `earlyCallBonus` | `wave12.ts` 的同名函数(签名与上限都不同) |
 * | 变速定步长 `planSteps` | `wave12.ts` 的 `accumulateSteps` |
 * | 克制表 `THREAT_LABEL` / `countersFor` | `towers12.ts` 那一套 |
 *
 * 而且两份的数**对不上**:
 *  - 提前召唤上限:本文件 12 片,接线的 `wave12` 是 6 片;
 *    连入参含义都反了(本文件收「提前了几秒」,接线的收「还剩几秒」)。
 *  - 一帧最多补几步:本文件 `MAX_SUBSTEPS` 是 8,接线的 `MAX_STEPS_PER_FRAME` 是 16。
 *
 * 玩家不会因此出错——跑的一直是 `wave12` / `towers12` 那份,它们各自有用例盯着。
 * 但下一个人很可能来调本文件的常量,调完发现游戏里毫无反应。
 * 这里把「谁接线」写成断言。删本文件要连它的用例一起删,那是「用例只减不增」,
 * 超出监督修复员的权限,已列进 R3 报告交主管。
 */
describe("这份守塔规格里,有哪几节真的进了游戏", () => {
  const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");

  it("玩法代码一律不 import 本文件", () => {
    for (const f of ["index.ts", "logic.ts", "wave12.ts", "towers12.ts", "hud12.ts", "endless.ts", "fx12.ts", "sim.ts"]) {
      expect(read(f), `${f} 不该 import defense12`).not.toMatch(/from\s+"\.\/defense12"/);
    }
  });

  it("index.ts 的波次预告 / 提前召唤 / 变速接的都是 wave12 那一套", () => {
    const index = read("index.ts");
    expect(index).toMatch(/from\s+"\.\/wave12"/);
    for (const name of ["wavePreview", "earlyCallBonus", "accumulateSteps", "SPEED_STEP"]) {
      expect(index, `index.ts 没接 wave12 的 ${name}`).toContain(name);
    }
    // 本文件独有的那几个名字一个都不该出现在玩法代码里
    for (const name of ["planSteps", "MAX_SUBSTEPS", "SPEED_STEPS", "EARLY_CALL_PER_SEC"]) {
      expect(index, `index.ts 用到了没接线的 ${name}`).not.toContain(name);
    }
  });

  it("两份的数确实对不上——这正是不能照着本文件调参的理由", async () => {
    const wave12 = await import("./wave12");
    // 提前召唤:上限一个 12 一个 6,入参含义还相反
    expect(EARLY_CALL_MAX).toBe(12);
    expect(wave12.EARLY_CALL_MAX_BONUS).toBe(6);
    expect(EARLY_CALL_MAX).not.toBe(wave12.EARLY_CALL_MAX_BONUS);
    // 一帧最多补几步:8 对 16
    expect(MAX_SUBSTEPS).toBe(8);
    expect(wave12.MAX_STEPS_PER_FRAME).toBe(16);
  });
});
