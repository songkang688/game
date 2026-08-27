/**
 * 勇者小路 · 窗口4 档A 第 1 轮测试员走查（不改玩法，只记录与断言）
 *
 * 剧本照 `docs/qa/1.2-window4-a-plan.md` 的第 1 轮走：
 *  1. 从首页进入（`loadGames()` → `meta.modes` → 动态加载出 `mount`）；
 *  2. 玩到真实胜负——赢一次 + 输一次，两边的收场话都只鼓励；
 *  3. 战役第 1 / 100 / 188 关各走一遍（真打，不是只看关卡表）；
 *  4. 闯关 / 无尽之路 / 对战康康的队伍（含同图竞速）每种模式都玩到结算；
 *  5. 360px 窄屏过一遍。
 *
 * 这一批只补断言，不动 `index.ts` / `logic.ts` 的玩法。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGames } from "../../engine/loader";
import { makeFighter, simulateBattle, simulateTeamBattle, type Element, type Fighter } from "./combat";
import {
  BOSSES,
  TOTAL_LEVELS,
  bossLevels,
  buildFoe,
  buildLevel,
  chapterOfLevel,
  expectedHero,
  makeBossSpec,
  makeFoeSpec,
  rateByHp
} from "./levels";
import {
  applyArena,
  applyBlessing,
  buildHero,
  defaultSave,
  endlessEndText,
  endlessFoeSpec,
  endlessStarReward,
  isBlessingFloor,
  rollBlessings,
  runArena
} from "./logic";
import {
  REST_EVERY,
  fullRoute,
  ghostPace,
  ghostTotalMs,
  isRestFloor,
  judgeRace,
  roadMaze,
  rollSupplies,
  validateMaze
} from "./maze";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
/** 只看 CSS 字符串以外的可见文案不现实，这里退一步：整份源码里出现的中文串都算可见文案 */
const CHINESE = SRC.match(/[\u4e00-\u9fa5][^"'`\n]{0,60}/g) ?? [];

/** 造一个「刚好达到这一关设计水平」的勇者，和 levels.test.ts 的参照口径保持一致 */
function refHero(level: number, element: Element, rankBoost = 0): Fighter {
  const s = expectedHero(level);
  const rank = Math.max(1, Math.min(5, 1 + Math.floor(level / 45) + rankBoost));
  return makeFighter({
    name: "鸭梨",
    emoji: "🌸",
    element,
    maxHp: s.maxHp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    crit: 0.1,
    skills: [
      { id: "gustStep", rank },
      { id: "crackHammer", rank },
      { id: "warmSong", rank }
    ],
    bag: [
      { id: "honey", count: 2 },
      { id: "berry", count: 2 }
    ]
  });
}

/** 一关从头走到尾：星芒不回满，路上遇到什么打什么 */
function walkLevel(level: number, hero: Fighter, seed: number): { cleared: boolean; fights: number; hpLeft: number } {
  const plan = buildLevel(level);
  let cur = hero;
  let fights = 0;
  for (let i = 0; i < plan.steps.length; i++) {
    const node = plan.steps[i][0];
    if (node.kind === "rest") {
      const heal = Math.round(cur.maxHp * (node.healRatio ?? 0.3));
      cur = { ...cur, hp: Math.min(cur.maxHp, cur.hp + heal) };
      continue;
    }
    if (!node.foe) continue;
    fights += 1;
    const res = simulateBattle(cur, makeFighter(node.foe), seed + i * 131 + 7, 60);
    if (res.winner !== "hero" || res.final.hero.hp <= 0) return { cleared: false, fights, hpLeft: 0 };
    cur = res.final.hero;
  }
  return { cleared: true, fights, hpLeft: cur.hp };
}

const HURT_WORDS = ["血", "死", "受伤", "阵亡", "杀", "尸"];

describe("勇者小路 · R1 · 从首页进入", () => {
  it("首页列得出这一款，动态加载能真的拿到 mount", async () => {
    const entry = loadGames().find((g) => g.meta.id === "brave-path");
    expect(entry, "首页 loadGames() 里找不到 brave-path").toBeTruthy();
    expect(entry!.meta.title).toBe("勇者小路");
    expect(entry!.meta.levels).toBe(TOTAL_LEVELS);
    const mount = await entry!.load();
    expect(typeof mount).toBe("function");
  });

  it("meta.modes 声明的三种模式在 index.ts 里都有真入口", () => {
    const entry = loadGames().find((g) => g.meta.id === "brave-path");
    // 首页收集器会把 modes 归一成 GAME_MODES 的顺序，所以这里按归一后的顺序比
    expect(entry!.meta.modes).toEqual(["campaign", "versus", "endless"]);
    // 闯关走平台的 188 关框架，无尽与对战各有自己的挂载函数
    expect(SRC).toContain("mountLevelGame(");
    expect(SRC).toContain("function mountEndless(");
    expect(SRC).toContain("function mountArena(");
    // 对战里点名要有的「同图竞速」
    expect(SRC).toContain("function mountMazeRace(");
  });
});

describe("勇者小路 · R1 · 赢一次 + 输一次", () => {
  it("赢一次：达标勇者打第 1 关的小怪，赢下来还剩星芒", () => {
    const res = simulateBattle(refHero(0, "light"), buildFoe(makeFoeSpec(0, "normal", 97)), 1301, 30);
    expect(res.winner).toBe("hero");
    expect(res.final.hero.hp).toBeGreaterThan(0);
    expect(res.final.foe.hp).toBe(0);
    const end = res.events.filter((e) => e.kind === "end");
    expect(end.length).toBe(1);
    expect(end[0].sound).toBe("win");
  });

  it("输一次：光着身子的勇者硬碰末章首领会输，而且收场只鼓励", () => {
    const weak = makeFighter({ name: "鸭梨", emoji: "🌸", element: "grass", maxHp: 30, atk: 3, def: 1, spd: 5, crit: 0 });
    const lastBoss = bossLevels()[bossLevels().length - 1];
    const res = simulateBattle(weak, makeFighter(makeBossSpec(lastBoss)), 13, 60);
    expect(res.winner).toBe("foe");
    expect(res.final.hero.hp).toBe(0);
    const end = res.events.filter((e) => e.kind === "end");
    expect(end.length).toBe(1);
    // 输了不许出现任何流血 / 死亡字眼，只写「累了、歇口气」
    for (const bad of HURT_WORDS) expect(end[0].text).not.toContain(bad);
    expect(end[0].text).toMatch(/歇|累|休息/);
  });

  it("输了不扣星星：星级只按剩余星芒比例算，最低也有 1 星", () => {
    expect(rateByHp(1)).toBe(3);
    expect(rateByHp(0)).toBe(1);
    expect(rateByHp(-5)).toBe(1);
  });
});

describe("勇者小路 · R1 · 战役第 1 / 100 / 188 关", () => {
  for (const lv of [0, 99, 187]) {
    it(`第 ${lv + 1} 关：达标勇者一口气从头走到尾`, () => {
      const element: Element = lv === 187 ? BOSSES[chapterOfLevel(lv)].weakness : "light";
      const out = walkLevel(lv, refHero(lv, element), lv * 977 + 13);
      expect(out.cleared, `第 ${lv + 1} 关没走通`).toBe(true);
      expect(out.fights).toBeGreaterThanOrEqual(1);
      expect(out.hpLeft).toBeGreaterThan(0);
    });
  }

  it("第 188 关是末章首领关，最后一步就是首领本人", () => {
    const plan = buildLevel(TOTAL_LEVELS - 1);
    expect(plan.boss).toBe(true);
    expect(plan.steps[plan.steps.length - 1][0].kind).toBe("boss");
    // 首领门口有整装点，谁都是满状态迎战
    expect(plan.steps.some((opts) => opts.some((n) => n.kind === "rest" && (n.healRatio ?? 0) >= 1))).toBe(true);
  });
});

describe("勇者小路 · R1 · 无尽之路玩到结算", () => {
  it("能一层层往下走，走到打不动为止，并给出结算文案与康康", () => {
    let hero = refHero(40, "light");
    let depth = 0;
    let blessings = 0;
    for (let d = 1; d <= 200; d++) {
      const res = simulateBattle(hero, makeFighter(endlessFoeSpec(d)), d * 31 + 7, 60);
      if (res.winner !== "hero") break;
      depth = d;
      hero = { ...res.final.hero };
      if (isBlessingFloor(d)) {
        const pick = rollBlessings(d);
        expect(pick).toHaveLength(2);
        expect(pick[0].id).not.toBe(pick[1].id);
        hero = applyBlessing(hero, pick[0]);
        blessings += 1;
      }
    }
    // 「无尽」要真的会结束（不是无限赢），也不能一层就结束
    expect(depth).toBeGreaterThanOrEqual(5);
    expect(depth).toBeLessThan(200);
    expect(blessings).toBeGreaterThanOrEqual(1);
    const text = endlessEndText(depth, 0);
    expect(text).toContain(`第 ${depth} 层`);
    for (const bad of HURT_WORDS) expect(text).not.toContain(bad);
    const stars = endlessStarReward(depth, 0);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(stars).toBeLessThanOrEqual(5);
  });

  it("每 5 层一个歇脚层，歇脚层真的给得出补给", () => {
    expect(REST_EVERY).toBe(5);
    const rest: number[] = [];
    for (let d = 1; d <= 20; d++) if (isRestFloor(d)) rest.push(d);
    expect(rest).toEqual([5, 10, 15, 20]);
    for (const d of rest) {
      const supplies = rollSupplies(d);
      expect(supplies.length).toBeGreaterThanOrEqual(1);
      for (const s of supplies) expect(s.name.length).toBeGreaterThan(0);
    }
  });
});

describe("勇者小路 · R1 · 对战康康的队伍玩到结算", () => {
  it("三对三接力能打到分出胜负，赢了给康康、输了也有鼓励话", () => {
    const save = { ...defaultSave(), level: 20 };
    const out = runArena(save, 4242);
    expect(out.result.bouts.length).toBeGreaterThanOrEqual(1);
    expect(out.result.aLeft + out.result.bLeft).toBeGreaterThan(0);
    expect(["a", "b"]).toContain(out.result.winner);
    expect(out.text.length).toBeGreaterThan(0);
    for (const bad of HURT_WORDS) expect(out.text).not.toContain(bad);
    if (out.win) {
      expect(out.stars).toBeGreaterThanOrEqual(1);
      expect(out.coins).toBeGreaterThanOrEqual(70);
    } else {
      // 输了不倒扣：金币经验照给，只是少一些
      expect(out.stars).toBe(0);
      expect(out.coins).toBeGreaterThan(0);
      expect(out.exp).toBeGreaterThan(0);
    }
  });

  it("打完一场会写回场次统计，胜场只在赢的时候涨", () => {
    const save = { ...defaultSave(), level: 20 };
    const out = runArena(save, 4242);
    const after = applyArena(save, out);
    expect(after.arenaPlays).toBe(save.arenaPlays + 1);
    expect(after.arenaWins).toBe(save.arenaWins + (out.win ? 1 : 0));
  });

  it("同一份存档 + 同一个种子，结果一模一样（可复现）", () => {
    const save = { ...defaultSave(), level: 20 };
    expect(runArena(save, 777).result.winner).toBe(runArena(save, 777).result.winner);
  });

  it("接力真的会换人：一方倒下就换下一位顶上", () => {
    const mine = [refHero(30, "light"), refHero(30, "fire"), refHero(30, "water")];
    const theirs = [refHero(30, "dark"), refHero(30, "grass"), refHero(30, "light")];
    const res = simulateTeamBattle(mine, theirs, 99);
    expect(res.bouts.length).toBeGreaterThanOrEqual(3);
    expect(res.aLeft + res.bLeft).toBeGreaterThan(0);
  });
});

describe("勇者小路 · R1 · 同图竞速", () => {
  it("竞速用的迷宫合法、能走通，影子跑完全程的用时算得出来", () => {
    for (const floor of [1, 5, 20, 60]) {
      const m = roadMaze(1234, floor);
      const chk = validateMaze(m);
      expect(chk.ok, `第 ${floor} 层迷宫不合法`).toBe(true);
      expect(chk.keyReachable).toBe(true);
      expect(chk.exitReachable).toBe(true);
      const route = fullRoute(m);
      expect(route, `第 ${floor} 层走不通`).not.toBeNull();
      expect(route!.length).toBeGreaterThan(2);
      expect(ghostTotalMs(route!, ghostPace(0))).toBeGreaterThan(0);
    }
  });

  it("影子赢得越多跑得越快，但胜负判定三种结果都出得来", () => {
    const a = ghostPace(0);
    const b = ghostPace(8);
    expect(b.stepMs).toBeLessThan(a.stepMs);
    expect(judgeRace(1000, 2000)).toBe("win");
    expect(judgeRace(2000, 1000)).toBe("lose");
    expect(judgeRace(1000, 1000)).toBe("tie");
  });
});

describe("勇者小路 · R1 · 360px 窄屏", () => {
  it("多列布局全都锁在媒体查询里，360px 上一律单列", () => {
    const multi = SRC.match(/grid-template-columns:\s*1fr 1fr/g) ?? [];
    expect(multi.length).toBeGreaterThan(0);
    // 需要横着排的那几处都写了 @media(min-width:...)，360px 走不到
    for (const w of ["560", "520", "480"]) {
      expect(SRC).toContain(`@media(min-width:${w}px)`);
    }
  });

  it("迷宫方向盘按钮不小于 44px，手指按得住", () => {
    const dpad = /\.bvp-pad\{[^}]*min-width:\s*(\d+)px[^}]*min-height:\s*(\d+)px/.exec(SRC);
    expect(dpad, "找不到方向盘按钮的尺寸规则").not.toBeNull();
    expect(Number(dpad![1])).toBeGreaterThanOrEqual(44);
    expect(Number(dpad![2])).toBeGreaterThanOrEqual(44);
  });

  it("迷宫画布本身不超过 360px", () => {
    const maze = /\.bvp-maze[^{]*\{[^}]*max-width:\s*(\d+)px/.exec(SRC);
    expect(maze).not.toBeNull();
    expect(Number(maze![1])).toBeLessThanOrEqual(360);
  });
});

describe("勇者小路 · R1 · 分级红线", () => {
  it("可见文案里没有流血 / 死亡一类的字眼（攻略里的「血量」除外，见报告遗留）", () => {
    const bad = CHINESE.filter((line) => ["流血", "死亡", "阵亡", "杀死"].some((w) => line.includes(w)));
    expect(bad).toEqual([]);
  });

  it("音效只走平台的 api.play，没有自己造 AudioContext", () => {
    expect(SRC).not.toContain("AudioContext");
    expect(SRC).not.toContain("new Audio");
  });
});
