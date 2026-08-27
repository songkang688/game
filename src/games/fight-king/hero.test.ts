/**
 * 梨康格斗王 · 格斗塔默认出战角色（QA 第 2 轮 · 包 B · R2B-3）。
 *
 * 第 2 轮验收拿仓库自带那把尺量出来：格斗塔从第 125 关起一路 0/8，
 * 可**换个小伙伴立刻 4~6/8** —— 关卡表不是墙，固定用 `CHARACTERS[0]` 开局的默认主角才是。
 * 第 1 轮的 B-10（后段是墙）与 B-11（角色强弱被守擂增益压平）是同一个根。
 *
 * 尺子和 `curve.test.ts` 是同一把：玩家一侧交给游戏自带最高档 lv4 的手，
 * 对手照配表取档位与增益，按 `roundsToWin` 打满，固定 seed，所以结果可复现。
 */
import { afterEach, describe, expect, it } from "vitest";
import { aiInput, createBrain, type AiLevel } from "./ai";
import { createMatch, noBuff, stepMatch, type FighterBuff } from "./engine";
import { CHARACTERS, characterById } from "./frames";
import { foeIdOf, towerStage } from "./levels";
import { SWAP_HINT_AFTER, SWAP_HINT_TEXT, TOWER_HERO_ID, mount } from "./index";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { resetMigration } from "./progress";

/** 打一个回合，返回赢家（0 = 玩家，1 = 守擂者，-1 = 平） */
function playRound(
  heroId: string,
  foeId: string,
  foeAi: AiLevel,
  buff: FighterBuff,
  seed: number,
  limitSec: number
): number {
  const s = createMatch(heroId, foeId, { config: { timeLimit: 60 * limitSec }, buffs: [noBuff(), buff] });
  const me = createBrain(4, seed * 13 + 7);
  const foe = createBrain(foeAi, seed * 29 + 3);
  let frames = 0;
  while (!s.over && frames < 60 * (limitSec + 10)) {
    stepMatch(s, [aiInput(me, s, 0), aiInput(foe, s, 1)]);
    frames++;
  }
  return s.winner;
}

/** 某个角色用 lv4 的手打这一关 games 次，返回赢了几次 */
function clearRate(heroId: string, level: number, games = 8): number {
  const st = towerStage(level);
  let wins = 0;
  for (let g = 1; g <= games; g++) {
    const won = [0, 0];
    for (let r = 0; r < 5 && won[0] < st.roundsToWin && won[1] < st.roundsToWin; r++) {
      const w = playRound(heroId, foeIdOf(level), st.aiLevel, st.foeBuff, g * 100 + r, st.timeLimitSec);
      if (w === 0) won[0] += 1;
      else if (w === 1) won[1] += 1;
    }
    if (won[0] >= st.roundsToWin) wins += 1;
  }
  return wins;
}

/** 验收点名的四关（0 基关号） */
const WALL_LEVELS = [124, 159, 175, 187];

describe("格斗塔后段不再是墙", () => {
  it("默认出战角色在第 125 / 160 / 176 / 188 关都不再整片 0 胜", () => {
    for (const lv of WALL_LEVELS) {
      expect(clearRate(TOWER_HERO_ID, lv), `第 ${lv + 1} 关默认角色一局都赢不下来`).toBeGreaterThan(0);
    }
  }, 120000);

  it("换成原来那位默认角色确实推不动 —— 这条对比是本次修复的由来", () => {
    // 关卡表没动，动的只是「默认派谁上场」：同样的关、同样的尺子，两个人差得出来
    const before = WALL_LEVELS.reduce((s, lv) => s + clearRate(CHARACTERS[0].id, lv), 0);
    const after = WALL_LEVELS.reduce((s, lv) => s + clearRate(TOWER_HERO_ID, lv), 0);
    expect(after, "换了默认角色之后并没有变好").toBeGreaterThan(before);
  }, 120000);

  it("前中段照样打得过，不是把默认角色换成一台推土机", () => {
    expect(clearRate(TOWER_HERO_ID, 0, 4)).toBeGreaterThanOrEqual(3);
    expect(clearRate(TOWER_HERO_ID, 99, 4)).toBeGreaterThanOrEqual(2);
    // 后段仍旧要打得认真：全塔最后一关不该是随手 8/8
    expect(clearRate(TOWER_HERO_ID, 187)).toBeLessThan(8);
  }, 120000);

  it("默认角色是八位里现成的一位，没有新增角色也没有改数值", () => {
    expect(CHARACTERS.some((c) => c.id === TOWER_HERO_ID)).toBe(true);
    expect(CHARACTERS).toHaveLength(8);
    expect(characterById(TOWER_HERO_ID).name).toBe("康康");
  });
});

describe("换人通道与提示", () => {
  let dom: Dom;
  let live: { destroy: () => void } | null = null;

  afterEach(() => {
    live?.destroy();
    live = null;
    restoreDom();
  });

  function openTower(): El {
    dom = installDom(360);
    resetMigration();
    let stars = 0;
    live = mount({
      root: dom.root as unknown as HTMLElement,
      play: () => undefined,
      addStars: (n: number) => (stars += n),
      getStars: () => stars,
      onWin: () => undefined,
      onLose: () => undefined,
    } as unknown as Parameters<typeof mount>[0]);
    const btn = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes("格斗塔")).pop();
    btn!.click();
    return dom.root;
  }

  it("塔里默认高亮的就是默认出战角色", () => {
    const root = openTower();
    const on = root.querySelectorAll(".fk-ch-on");
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toContain(characterById(TOWER_HERO_ID).name);
  });

  it("八位小伙伴的换人通道还在，点谁就换谁", () => {
    const root = openTower();
    const picks = root.querySelectorAll(".fk-ch");
    expect(picks).toHaveLength(8);
    const nuonuo = picks.find((b) => b.textContent.includes("糯糯"))!;
    nuonuo.click();
    const on = root.querySelectorAll(".fk-ch-on");
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toContain("糯糯");
  });

  it("「换个小伙伴试试」那一行平时是空的，不占地方", () => {
    const root = openTower();
    const tip = root.querySelector(".fk-swap");
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toBe("");
    const css = root.find((e) => e.tagName === "style")?.textContent ?? "";
    expect(css).toContain(".fk-swap:empty{display:none;}");
  });
});

describe("提示与角色介绍的文案", () => {
  it("连败提示只鼓励、不批评，也不带商标", () => {
    expect(SWAP_HINT_AFTER).toBeGreaterThanOrEqual(2);
    expect(SWAP_HINT_TEXT).toContain("换个小伙伴");
    for (const bad of ["笨", "菜", "废物", "没用", "死", "拳皇", "街霸"]) {
      expect(SWAP_HINT_TEXT.includes(bad), `「${bad}」出现在换人提示里`).toBe(false);
    }
  });

  it("鸭梨的介绍不再把她说成「新手先选她准没错」", () => {
    const duoduo = characterById(CHARACTERS[0].id);
    expect(duoduo.name).toBe("鸭梨");
    expect(duoduo.style).not.toContain("新手先选");
    expect(duoduo.style.length).toBeGreaterThan(8);
  });

  it("默认出战这件事在选人说明里讲了出来", () => {
    expect(characterById(TOWER_HERO_ID).style).toContain("格斗塔");
  });
});
