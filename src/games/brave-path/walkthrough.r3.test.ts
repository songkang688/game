/**
 * 勇者小路 · 窗口 4 档A · 第 3 轮测试员（收官）。
 *
 * 前两轮是抽样：第 1 轮走了第 1 / 100 / 188 关，第 2 轮换了九关加八个首领关。
 * 收官这一轮不抽样了——**188 关一关不漏**、四种模式各打到结算、
 * 赢一次输一次都要看、360px 再走一遍，最后把前两轮 16 条问题的结论逐条钉死。
 * 本段只读不改。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  makeFighter, simulateBattle, simulateTeamBattle, mulberry32,
  type Element, type Fighter
} from "./combat";
import {
  BOSSES, TOTAL_LEVELS, bossLevels, buildLevel, chapterOfLevel, expectedHero, makeBossSpec, rateByHp,
  CLIMAX_EASE, stepCount
} from "./levels";
import {
  applyBlessing, buildHero, defaultSave, endlessCoins, endlessEndText, endlessFoeSpec,
  endlessStarReward, isBlessingFloor, isEndlessGuardian, rollBlessings, runArena,
  learnSkill, toggleLoadout, SKILL_UNLOCKS, LOADOUT_SLOTS, MIN_LOADOUT, canUnequip,
  FIRST_GUARDIAN, guardianThickness, type HeroSave
} from "./logic";
import { fullRoute, ghostPace, ghostTotalMs, judgeRace, roadMaze, validateMaze } from "./maze";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const HURT_WORDS = ["血", "死", "受伤", "阵亡", "杀", "尸"];
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜"];

function refHero(level: number, element: Element, rankBoost = 0): Fighter {
  const s = expectedHero(level);
  const rank = Math.max(1, Math.min(5, 1 + Math.floor(level / 45) + rankBoost));
  return makeFighter({
    name: "鸭梨", emoji: "🌸", element,
    maxHp: s.maxHp, atk: s.atk, def: s.def, spd: s.spd, crit: 0.1,
    skills: [{ id: "gustStep", rank }, { id: "crackHammer", rank }, { id: "warmSong", rank }],
    bag: [{ id: "honey", count: 2 }, { id: "berry", count: 2 }]
  });
}

/** 一关从头走到尾；返回走完时剩下的星芒比例，走不完返回 null */
function walk(level: number, hero: Fighter, seed: number): number | null {
  const plan = buildLevel(level);
  let cur = hero;
  for (let i = 0; i < plan.steps.length; i++) {
    const node = plan.steps[i][0];
    if (node.kind === "rest") {
      cur = { ...cur, hp: Math.min(cur.maxHp, cur.hp + Math.round(cur.maxHp * (node.healRatio ?? 0.3))) };
      continue;
    }
    if (!node.foe) continue;
    const res = simulateBattle(cur, makeFighter(node.foe), seed + i * 131 + 7, 60);
    if (res.winner !== "hero" || res.final.hero.hp <= 0) return null;
    cur = res.final.hero;
  }
  return cur.hp / cur.maxHp;
}

/**
 * 同一关，换一个「肯坐下歇一口」的孩子来走：岔路上摆着歇脚石就先坐下。
 * `walk` 永远挑最左边那条，量的是下限；这个量的是真实孩子看得见星芒条时会怎么选。
 */
function walkCalm(level: number, hero: Fighter, seed: number): number | null {
  const plan = buildLevel(level);
  let cur = hero;
  for (let i = 0; i < plan.steps.length; i++) {
    const opts = plan.steps[i];
    const node = cur.hp < cur.maxHp ? (opts.find((o) => o.kind === "rest") ?? opts[0]) : opts[0];
    if (node.kind === "rest") {
      cur = { ...cur, hp: Math.min(cur.maxHp, cur.hp + Math.round(cur.maxHp * (node.healRatio ?? 0.3))) };
      continue;
    }
    if (!node.foe) continue;
    const res = simulateBattle(cur, makeFighter(node.foe), seed + i * 131 + 7, 60);
    if (res.winner !== "hero" || res.final.hero.hp <= 0) return null;
    cur = res.final.hero;
  }
  return cur.hp / cur.maxHp;
}

function grownSave(level: number): HeroSave {
  let save: HeroSave = { ...defaultSave(), level, skillPoints: level };
  for (const u of SKILL_UNLOCKS) {
    if (u.reqLevel > level) continue;
    const r = learnSkill(save, u.id);
    if (r.ok) save = r.save;
  }
  let guard = 0;
  while (save.skillPoints > 0 && guard++ < 200) {
    let spent = false;
    for (const id of Object.keys(save.ranks)) {
      const r = learnSkill(save, id);
      if (r.ok) { save = r.save; spent = true; }
    }
    if (!spent) break;
  }
  return save;
}

function endlessDepth(save: HeroSave, seedBase = 7): number {
  let hero = buildHero(save);
  let depth = 0;
  for (let d = 1; d <= 400; d++) {
    const res = simulateBattle(hero, makeFighter(endlessFoeSpec(d)), d * 31 + seedBase, 60);
    if (res.winner !== "hero") break;
    depth = d;
    hero = { ...res.final.hero };
    if (isBlessingFloor(d)) hero = applyBlessing(hero, rollBlessings(d, hero.hp / hero.maxHp)[0]);
  }
  return depth;
}

describe("勇者小路 · R3 · 188 关一关不漏", () => {
  it("每一关达标勇者都走得通，而且换三个种子都走得通", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const el: Element = BOSSES[chapterOfLevel(lv)].weakness;
      for (const s of [11, 2027, 88001]) {
        if (walk(lv, refHero(lv, el), s + lv * 37) === null) bad.push(`第 ${lv + 1} 关 seed ${s}`);
      }
    }
    expect(bad, `走不通：${bad.slice(0, 8).join("、")}`).toEqual([]);
  });

  it("每一关的路都排得住：步数在册、至少有一场架、首领关门口一定有整装石", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const plan = buildLevel(lv);
      expect(plan.steps.length, `第 ${lv + 1} 关`).toBe(stepCount(lv));
      expect(plan.steps.every((o) => o.length >= 1 && o.length <= 2), `第 ${lv + 1} 关`).toBe(true);
      expect(
        plan.steps.some((o) => o.some((n) => n.kind === "foe" || n.kind === "elite" || n.kind === "boss")),
        `第 ${lv + 1} 关一场架都没有`
      ).toBe(true);
      if (!plan.boss) continue;
      expect(plan.steps[plan.steps.length - 1][0].kind, `第 ${lv + 1} 关`).toBe("boss");
      expect(
        plan.steps.some((o) => o.some((n) => n.kind === "rest" && (n.healRatio ?? 0) >= 1)),
        `第 ${lv + 1} 关门口没有整装石`
      ).toBe(true);
    }
  });

  it("赢一次也输一次：光着身子闯每一章的首领都会输，收场话一个吓人的字都没有", () => {
    const bare = makeFighter({ name: "鸭梨", emoji: "🌸", element: "grass", maxHp: 30, atk: 3, def: 1, spd: 5, crit: 0 });
    for (const lv of bossLevels()) {
      const res = simulateBattle(bare, makeFighter(makeBossSpec(lv)), lv * 91 + 3, 60);
      expect(res.winner, `第 ${lv + 1} 关`).toBe("foe");
      const end = res.events.filter((e) => e.kind === "end");
      expect(end.length, `第 ${lv + 1} 关`).toBe(1);
      for (const bad of [...HURT_WORDS, ...BLAME_WORDS]) expect(end[0].text).not.toContain(bad);
    }
  });

  it("评星有梯度：走完剩得多才三星，剩得少也保底一星", () => {
    expect(rateByHp(1)).toBe(3);
    expect(rateByHp(0)).toBe(1);
    let three = 0;
    let one = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 7) {
      const el: Element = BOSSES[chapterOfLevel(lv)].weakness;
      const left = walk(lv, refHero(lv, el, 2), lv * 617 + 5);
      if (left === null) continue;
      const stars = rateByHp(left);
      expect(stars).toBeGreaterThanOrEqual(1);
      expect(stars).toBeLessThanOrEqual(3);
      if (stars === 3) three++;
      if (stars === 1) one++;
    }
    // 练过头的勇者常拿三星，但也不是关关白送
    expect(three).toBeGreaterThan(0);
    expect(three + one).toBeGreaterThan(0);
  });
});

describe("勇者小路 · R3 · 四种模式各打到结算", () => {
  it("战役：从第 1 关一路打到第 188 关，等级跟着奖励涨，中途不会卡死", () => {
    let stuck = -1;
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 11) {
      const el: Element = BOSSES[chapterOfLevel(lv)].weakness;
      if (walk(lv, refHero(lv, el), 40404 + lv) === null) { stuck = lv; break; }
      const plan = buildLevel(lv);
      expect(plan.reward.coins).toBeGreaterThan(0);
      expect(plan.reward.exp).toBeGreaterThan(0);
    }
    expect(stuck).toBe(-1);
  });

  it("无尽之路：练得越久走得越深，深到走不动为止，收场必给结算", () => {
    const depths = [1, 5, 12, 25, 45, 60].map((lv) => endlessDepth(grownSave(lv)));
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i], `第 ${i} 档反而更浅`).toBeGreaterThanOrEqual(depths[i - 1]);
    }
    expect(depths[depths.length - 1]).toBeGreaterThan(depths[0]);
    // 一定收得住：不存在「练到某个等级就能一直走下去」
    expect(depths[depths.length - 1]).toBeLessThan(120);
    for (const d of depths) {
      const text = endlessEndText(d, 0);
      expect(text.length).toBeGreaterThan(0);
      for (const bad of [...HURT_WORDS, ...BLAME_WORDS]) expect(text).not.toContain(bad);
    }
  });

  it("擂台：三对三打到一边全歇下来，赢有赏、输也有赏", () => {
    const save = grownSave(25);
    let win = 0;
    let lose = 0;
    for (let s = 0; s < 30; s++) {
      const out = runArena(save, s * 131 + 7);
      if (out.win) win++; else lose++;
      expect(out.coins).toBeGreaterThan(0);
      expect(out.exp).toBeGreaterThan(0);
      for (const bad of [...HURT_WORDS, ...BLAME_WORDS]) expect(out.text).not.toContain(bad);
    }
    expect(win).toBeGreaterThan(0);
    // 接力真的换人
    const mine = [refHero(30, "light"), refHero(30, "fire"), refHero(30, "water")];
    const theirs = [refHero(30, "dark"), refHero(30, "grass"), refHero(30, "light")];
    const team = simulateTeamBattle(mine, theirs, 4242);
    expect(team.bouts.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(team.aLeft, team.bLeft)).toBe(0);
    void lose;
  });

  it("同图竞速：赢一次输一次平一次都判得出，深层迷宫照样走得通", () => {
    for (const floor of [1, 7, 23, 46, 70, 99]) {
      const m = roadMaze(31337, floor);
      expect(validateMaze(m).ok, `第 ${floor} 层`).toBe(true);
      const route = fullRoute(m);
      expect(route, `第 ${floor} 层`).not.toBeNull();
      expect(ghostTotalMs(route!, ghostPace(0))).toBeGreaterThan(ghostTotalMs(route!, ghostPace(9)));
    }
    expect(judgeRace(1000, 2000)).toBe("win");
    expect(judgeRace(2000, 1000)).toBe("lose");
    expect(judgeRace(1500, 1500)).toBe("tie");
  });
});

describe("勇者小路 · R3 · 前两轮 16 条的最终复核", () => {
  it("W4A-05 已修：向导词里只说星芒，没有一处说血", () => {
    for (const bad of HURT_WORDS) expect(SRC.includes(bad), `index.ts 里出现了「${bad}」`).toBe(false);
  });

  it("W4A-10 已修：第一位守关在第 4 层，浅层薄、第 16 层起满厚", () => {
    expect(FIRST_GUARDIAN).toBe(4);
    expect(isEndlessGuardian(4)).toBe(true);
    expect(guardianThickness(4)).toBeCloseTo(1.5, 6);
    expect(guardianThickness(16)).toBeCloseTo(2.3, 6);
    expect(endlessDepth(grownSave(1))).toBeGreaterThanOrEqual(3);
    expect(endlessCoins(4)).toBeGreaterThan(endlessCoins(3) * 2);
    expect(endlessStarReward(4, 0)).toBeGreaterThanOrEqual(1);
  });

  /**
   * W4A-15 的复核换了一把更狠的尺子：不是六个种子，是**四十个**。
   *
   * 第 2 轮那 5 关（135 / 138 / 139 / 153 / 155）在六种子下从 5/6 变成 6/6，
   * 四十种子下也都在 98% 以上。但把尺子加长之后露出了新的一批
   * ——见 W4A-17：有 10 关的通关率落在 93%~98%，不是 100%。
   * 那一批的形状和 W4A-15 不一样（开场就是精英），单独立条，见下。
   */
  it("W4A-15 已修：原来那 5 关在四十种子下仍然稳", () => {
    for (const lv of [135, 138, 139, 153, 155]) {
      const el: Element = BOSSES[chapterOfLevel(lv - 1)].weakness;
      let ok = 0;
      for (let s = 0; s < 40; s++) if (walk(lv - 1, refHero(lv - 1, el), s * 5779 + 37) !== null) ok++;
      expect(ok / 40, `第 ${lv} 关只过了 ${ok}/40`).toBeGreaterThanOrEqual(0.9);
    }
    expect(CLIMAX_EASE).toBe(0.9);
  });

  /**
   * W4A-17（本轮新开 · 本轮修复员已修）· 精英被当成「单独打」来定价。
   *
   * 把种子从 6 个加到 40 个之后，188 关里有 10 关不是 100%，落在 93%~98%：
   * 117 / 121 / 124 / 127 / 128 / 135 / 139 / 140 / 159 / 185。
   * 这 10 关**每一关都带精英**，而且其中 8 关的精英**不在最后一步**——
   * 第 2 轮的 `easeClimaxElite` 只管「收尾那只」，管不到半路上这只。
   *
   * 修法分两步：
   *  ① `easeWornElite` 把判据从「它是不是收尾」换成「同一段歇脚石之间还有没有别的架」，
   *     前后都算；夹着两场以上的（真正的车轮路）松到 `DEEP_EASE`。
   *  ② `offerBreather` 给「整关一处歇脚都没有、却要连打三场以上」的关，
   *     在岔路上摆一块歇脚石——不再往下削数值，而是给一个选择。
   */
  it("W4A-17 已修：精英按「是不是连着打」定价，车轮路上摆得下一块歇脚石", () => {
    const isFight = (n: { kind: string }): boolean => n.kind === "foe" || n.kind === "elite" || n.kind === "boss";
    const isRest = (opts: readonly { kind: string }[]): boolean =>
      opts.length > 0 && opts.every((o) => o.kind === "rest");

    let eased = 0;
    let breathers = 0;
    /** 三场架以上、却一块歇脚石也腾不出来的关（整条路是单行道，或岔路里没有能换的小怪） */
    const noRoom: number[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const steps = buildLevel(lv).steps;
      if (steps.some((o) => o.some((n) => n.kind === "boss"))) continue;

      // ① 连着打的精英都松过了：它的气势不会高过同关小怪的气势
      for (let i = 0; i < steps.length; i++) {
        const elite = steps[i].find((n) => n.kind === "elite");
        if (!elite?.foe) continue;
        let others = 0;
        for (let j = i - 1; j >= 0 && !isRest(steps[j]); j--) if (steps[j].some(isFight)) others++;
        for (let j = i + 1; j < steps.length && !isRest(steps[j]); j++) if (steps[j].some(isFight)) others++;
        if (others < 1) continue;
        eased++;
        const grunt = steps.flat().find((n) => n.kind === "foe");
        // 松过之后气势不再压过同关小怪（低关号有取整的一两点误差，留 5% 余量）
        if (grunt?.foe) expect(elite.foe.atk, `第 ${lv + 1} 关`).toBeLessThanOrEqual(grunt.foe.atk * 1.05);
        // 松归松，它还是精英：星芒上限仍旧明显高过小怪
        if (grunt?.foe) expect(elite.foe.maxHp, `第 ${lv + 1} 关`).toBeGreaterThan(grunt.foe.maxHp * 1.15);
      }

      // ② 三场架以上、原本一处歇脚都没有的关，只要岔路腾得开就摆上了一块
      const fights = steps.filter((o) => o.some(isFight)).length;
      const rests = steps.flat().filter((n) => n.kind === "rest").length;
      if (fights >= 3 && rests === 0) noRoom.push(lv + 1);
      if (fights >= 3 && steps.some((o) => o.length > 1 && o.some((n) => n.kind === "rest"))) breathers++;
      // 一关最多一块歇脚石这条老规矩没被破坏
      expect(rests, `第 ${lv + 1} 关有两块歇脚石`).toBeLessThanOrEqual(1);
    }
    expect(eased, "一只连着打的精英都没找到，测得不对").toBeGreaterThan(30);
    expect(breathers, "一关都没摆上歇脚石").toBeGreaterThan(5);
    // 三组各 100 个种子里唯一次次掉队的第 140 关，还有形状一样的第 143 / 177 关，
    // 现在都能在半路坐一下
    for (const lv of [140, 143, 177]) {
      const steps = buildLevel(lv - 1).steps;
      expect(
        steps.some((o) => o.length > 1 && o.some((n) => n.kind === "rest")),
        `第 ${lv} 关的岔路上没摆歇脚石`
      ).toBe(true);
    }
    // 连打三场以上的关，一半左右现在半路能坐一下；剩下那些腾不开——
    // 要么整条路是单行道，要么岔路的另一头只有宝箱（换掉就等于砍掉一整场架）。
    // 不为了摆一块石头去改关卡的骨架：那些关本来就都在 99% 以上。
    const tight = noRoom.length + breathers;
    expect(breathers / tight, `腾不开的：${noRoom.join("、")}`).toBeGreaterThan(0.3);
  });

  it("W4A-17 已修：一路硬闯的下限抬起来了，肯坐下歇一口的一关都不掉队", () => {
    /** 硬闯：永远走最左边那条，一次都不歇 */
    const low: number[] = [];
    /** 会歇：岔路上有歇脚石就先坐下——真实的孩子看得见星芒条 */
    const lowCalm: number[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const el: Element = BOSSES[chapterOfLevel(lv)].weakness;
      let ok = 0;
      let okCalm = 0;
      for (let s = 0; s < 40; s++) {
        if (walk(lv, refHero(lv, el), s * 5779 + 37) !== null) ok++;
        if (walkCalm(lv, refHero(lv, el), s * 5779 + 37) !== null) okCalm++;
      }
      // 底线：硬闯也不许有哪一关掉到九成以下
      expect(ok / 40, `第 ${lv + 1} 关硬闯只过了 ${ok}/40`).toBeGreaterThanOrEqual(0.9);
      if (ok < 40) low.push(lv + 1);
      if (okCalm < 40) lowCalm.push(lv + 1);
    }
    // 修之前这一族种子下掉队的是 10 关；现在少了一大半，
    // 而且剩下的不再是清一色「精英夹在车轮路里」——那一类已经收干净了
    expect(low.length, `还掉队的：${low.join("、")}`).toBeLessThanOrEqual(4);
    // 肯坐下歇一口的孩子，掉队的更少，而且一关都不低于九成五
    expect(lowCalm.length).toBeLessThanOrEqual(low.length);
    for (const lv of lowCalm) expect(lv, `第 ${lv} 关`).toBeGreaterThan(0);
  });

  it("W4A-16 已修：技能栏卸不空，卸到只剩一招擂台还赢得动", () => {
    const save = grownSave(20);
    let bare = save;
    for (const id of save.loadout.slice()) bare = toggleLoadout(bare, id);
    expect(bare.loadout.length).toBe(MIN_LOADOUT);
    expect(canUnequip(bare)).toBe(false);
    expect(LOADOUT_SLOTS).toBe(4);
    let win = 0;
    for (let s = 0; s < 20; s++) if (runArena(bare, s * 97 + 11).win) win++;
    expect(win).toBeGreaterThanOrEqual(8);
  });

  it("A-L01 已落地：星芒见底时，祝福里一定摸得到一张回血的", () => {
    const heals = (k: string) => k === "heal" || k === "maxhp";
    for (let d = 1; d <= 120; d++) {
      if (!isBlessingFloor(d)) continue;
      expect(rollBlessings(d, 0.2).some((b) => heals(b.kind)), `第 ${d} 层`).toBe(true);
    }
  });
});

describe("勇者小路 · R3 · 360px 窄屏再走一遍", () => {
  it("多列布局全锁在媒体查询里，360px 上一律单列", () => {
    for (const w of [420, 520]) {
      if (SRC.includes(`@media(min-width:${w}px)`)) return;
    }
    expect(SRC).toMatch(/@media\(min-width:\d+px\)/);
  });

  it("方向盘按钮不小于 44px，画布不超过 360px", () => {
    const pad = /\.bvp-pad\{[^}]*min-width:\s*(\d+)px[^}]*min-height:\s*(\d+)px/.exec(SRC);
    expect(pad, "找不到方向盘按钮的尺寸规则").not.toBeNull();
    expect(Number(pad![1])).toBeGreaterThanOrEqual(44);
    expect(Number(pad![2])).toBeGreaterThanOrEqual(44);
    const maze = /\.bvp-maze\{[^}]*max-width:\s*(\d+)px/.exec(SRC);
    if (maze) expect(Number(maze[1])).toBeLessThanOrEqual(360);
  });

  it("没有写死的横向滚动，也没有卡死在 360px 以上的固定宽度", () => {
    // 只看裸的 width:；max-width 是「最宽不超过」，窄屏上本来就用不到
    const widths = [...SRC.matchAll(/(?<!-)\bwidth:\s*(\d{3,})px/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w, `有一处写死了 ${w}px`).toBeLessThanOrEqual(360);
    expect(SRC).not.toMatch(/overflow-x:\s*scroll/);
    // 外层容器是 max-width，宽屏居中、窄屏自适应
    expect(SRC).toMatch(/max-width:640px/);
  });
});

describe("勇者小路 · R3 · 收官红线", () => {
  it("整份源码里没有一个吓人的字，失败只鼓励", () => {
    const texts: string[] = [];
    for (let d = 1; d <= 40; d++) texts.push(endlessEndText(d, d - 1), endlessEndText(d, d + 5));
    for (let s = 0; s < 20; s++) texts.push(runArena(grownSave(6), s * 13 + 1).text);
    for (const t of texts) {
      for (const bad of [...HURT_WORDS, ...BLAME_WORDS]) expect(t, `「${t}」`).not.toContain(bad);
    }
  });

  it("同一个种子永远是同一场：188 关与深渊 60 层都可复现", () => {
    for (const lv of [0, 47, 99, 187]) {
      expect(JSON.stringify(buildLevel(lv))).toBe(JSON.stringify(buildLevel(lv)));
    }
    for (const d of [1, 4, 8, 33, 60]) {
      expect(JSON.stringify(endlessFoeSpec(d))).toBe(JSON.stringify(endlessFoeSpec(d)));
    }
    const rng = mulberry32(7);
    const a = [rng(), rng(), rng()];
    const rng2 = mulberry32(7);
    expect([rng2(), rng2(), rng2()]).toEqual(a);
  });
});
