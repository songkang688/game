/**
 * 勇者小路 · 窗口 4 档A · 第 2 轮学习优化员：A-L11。
 *
 * 技能栏原来能一个一个卸干净。卸干净之后星星那边照样带三个随等级涨阶的技能，
 * 朵朵只剩平砍——20 级的擂台胜率从 20/20 掉到 4/20，而孩子从界面上看不出
 * 是自己把招式卸光了，只会觉得「这游戏突然打不赢了」。
 *
 * 改法：`toggleLoadout` 留一条下限，学会一招之后身上至少留一招；
 * 界面点最后那一招时换一句专门的话，而不是照搬「位置只有 4 个」。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LOADOUT_SLOTS, MIN_LOADOUT, SKILL_UNLOCKS, buildHero, canUnequip, defaultSave,
  learnSkill, runArena, toggleLoadout, type HeroSave
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 一个「一路正常玩过来」的存档 */
function grown(level: number): HeroSave {
  let save: HeroSave = { ...defaultSave(), level, skillPoints: level };
  for (const u of SKILL_UNLOCKS) {
    if (u.reqLevel > level) continue;
    const r = learnSkill(save, u.id);
    if (r.ok) save = r.save;
  }
  return save;
}

describe("勇者小路 · A-L11 · 身上至少留一招", () => {
  it("卸到只剩一招就卸不动了，存档原样返回", () => {
    const save = grown(20);
    let cur = save;
    for (const id of save.loadout.slice()) cur = toggleLoadout(cur, id);
    expect(cur.loadout.length).toBe(MIN_LOADOUT);
    expect(canUnequip(cur)).toBe(false);
    expect(toggleLoadout(cur, cur.loadout[0])).toBe(cur);
  });

  it("还剩两招时照样卸得动——下限只挡最后那一下", () => {
    const save = grown(20);
    expect(save.loadout.length).toBe(LOADOUT_SLOTS);
    expect(canUnequip(save)).toBe(true);
    const one = toggleLoadout(save, save.loadout[0]);
    expect(one.loadout.length).toBe(LOADOUT_SLOTS - 1);
    expect(canUnequip(one)).toBe(true);
  });

  it("换招还是换得了：先下一个再上另一个，一次都不会被下限卡住", () => {
    let save = grown(60);
    expect(save.loadout.length).toBe(LOADOUT_SLOTS);
    const spare = Object.keys(save.ranks).find((id) => !save.loadout.includes(id))!;
    const dropped = save.loadout[0];
    save = toggleLoadout(save, dropped);
    save = toggleLoadout(save, spare);
    expect(save.loadout).toContain(spare);
    expect(save.loadout).not.toContain(dropped);
    expect(save.loadout.length).toBe(LOADOUT_SLOTS);
  });

  it("一招都还没学会的时候，下限不会平白无故冒出来挡路", () => {
    const fresh = defaultSave();
    expect(fresh.loadout).toEqual([]);
    // 没学过的招上不了阵，这条老规矩不变
    expect(toggleLoadout(fresh, "sunBloom")).toBe(fresh);
    const learned = learnSkill(fresh, "gustStep");
    expect(learned.ok).toBe(true);
    if (!learned.ok) return;
    // 学会第一招会自动上阵，而这一招就卸不下来了
    expect(learned.save.loadout).toEqual(["gustStep"]);
    expect(canUnequip(learned.save)).toBe(false);
  });

  it("身上留着一招，擂台就还打得赢——这正是下限守住的东西", () => {
    const save = grown(20);
    let one = save;
    for (const id of save.loadout.slice()) one = toggleLoadout(one, id);
    expect(one.loadout.length).toBe(1);
    let win = 0;
    for (let s = 0; s < 20; s++) if (runArena(one, s * 131 + 7).win) win++;
    expect(win).toBeGreaterThanOrEqual(10);
  });

  it("上场的勇者身上真的带着那一招，不是只在存档里挂个名", () => {
    const save = grown(12);
    let one = save;
    for (const id of save.loadout.slice()) one = toggleLoadout(one, id);
    const hero = buildHero(one);
    expect(hero.skills.map((s) => s.id)).toEqual(one.loadout);
    expect(hero.skills.length).toBe(1);
  });

  it("界面对「卸最后一招」换了一句专门的话，不再照搬「位置只有 4 个」", () => {
    expect(SRC).toContain("身上至少留一招");
    expect(SRC).toContain(`上阵位置只有 ${"${LOADOUT_SLOTS}"} 个`);
  });
});
