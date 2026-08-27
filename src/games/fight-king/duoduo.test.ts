/**
 * 梨康格斗王 · 鸭梨在格斗塔后段不再是墙（QA 第 3 轮 · 包 B · R3B-2）。
 *
 * 第 2 轮把默认出战从鸭梨换成康康，症状（默认角色推不动后段）没了，
 * 可**鸭梨本人一个数都没动**：第 3 轮测试员抽的后段八关里她有 6 关整片 0/8。
 * 鸭梨是对外两位主角之一、选人排里还排第 1 位，孩子点她进后段就推不动。
 *
 * 根因不在关卡表，也不在她那几个数值 —— 是她**两个必杀挂反了键**：
 * 「前 + 重」原来是对空招樱吹雪（够 64、收招 26 帧），「后 + 重」才是突进招追风踢。
 * 中距离最常按的就是「前 + 重」，于是她每按一次都在原地打空一记大收招的对空招；
 * 八位小伙伴里另外五位的对空招本来就挂在「后 + 重」，鸭梨是那两个例外之一。
 * 这一份把她接回同一套口径：**只换槽位，招式数值一个都没改。**
 *
 * 尺子和 `curve.test.ts` / `hero.test.ts` 是同一把：玩家一侧交给游戏自带最高档 lv4 的手，
 * 对手照配表取档位与增益，按 `roundsToWin` 打满，固定 seed，所以结果可复现。
 */
import { describe, expect, it } from "vitest";
import { aiInput, antiAirSlot, createBrain, type AiLevel } from "./ai";
import { createMatch, noBuff, stepMatch, type FighterBuff } from "./engine";
import { CHARACTERS, characterById } from "./frames";
import { foeIdOf, towerStage } from "./levels";
import { TOTAL_LEVELS } from "../level99";
import { TOWER_HERO_ID } from "./index";

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

/** 第 3 轮测试员点名「整片 0/8」的六关（0 基关号） */
const NAMED_WALLS = [124, 148, 159, 164, 175, 179];
/** 测试员本轮抽的后段八关（0 基） */
const LATE_EIGHT = [124, 132, 148, 159, 164, 175, 179, 187];
/** 鸭梨当对手的关（改她等于改这些关的难度） */
const DUO_IS_FOE: number[] = [];
for (let lv = 0; lv < TOTAL_LEVELS; lv++) if (foeIdOf(lv) === "duoduo") DUO_IS_FOE.push(lv);

describe("R3B-2 · 鸭梨后段不再整片 0/8", () => {
  it("测试员点名的六关，每一关都赢得下来", () => {
    // 改之前这六关逐关都是 0/8
    for (const lv of NAMED_WALLS) {
      expect(clearRate("duoduo", lv), `第 ${lv + 1} 关鸭梨一局都赢不下来`).toBeGreaterThan(0);
    }
    const total = NAMED_WALLS.reduce((s, lv) => s + clearRate("duoduo", lv), 0);
    expect(total, "六关合起来还是太薄").toBeGreaterThanOrEqual(10);
  }, 120000);

  it("不是只有抽到的那几关好看：后段 92 关逐关扫过去，没有一段成片的 0/8", () => {
    const row: number[] = [];
    for (let lv = 96; lv <= 187; lv++) row.push(clearRate("duoduo", lv));

    const zeros = row.filter((v) => v === 0).length;
    let run = 0;
    let worstRun = 0;
    for (const v of row) {
      run = v === 0 ? run + 1 : 0;
      worstRun = Math.max(worstRun, run);
    }
    // 改之前：92 关里 26 关是 0/8，最长连着 5 关 ≤1/8，合计只有 209/736
    expect(zeros, "后段还剩太多整片 0/8 的关").toBeLessThanOrEqual(4);
    expect(worstRun, "有连着几关都是 0/8 —— 这就是「从某关起整片 0/8」").toBeLessThanOrEqual(1);
    expect(row.reduce((a, b) => a + b, 0), "后段总胜数太低").toBeGreaterThanOrEqual(300);
  }, 180000);

  it("没有把她改成推土机：最后一关还是要认真打，前中段也没被削", () => {
    expect(clearRate("duoduo", 187), "第 188 关变成随手赢了").toBeLessThan(8);
    expect(clearRate("duoduo", 0, 4), "第 1 关反而打不过了").toBeGreaterThanOrEqual(3);
    expect(clearRate("duoduo", 99, 4), "第 100 关反而打不过了").toBeGreaterThanOrEqual(2);
  }, 120000);

  it("默认出战的康康仍旧是更稳的那一位，没被这一笔打残", () => {
    const duo = LATE_EIGHT.reduce((s, lv) => s + clearRate("duoduo", lv), 0);
    const star = LATE_EIGHT.reduce((s, lv) => s + clearRate(TOWER_HERO_ID, lv), 0);
    expect(star, "默认出战的康康反而不如鸭梨了").toBeGreaterThan(duo);
  }, 120000);

  it("鸭梨同时也是塔里 24 关的对手，那 24 关没有被顶成打不过", () => {
    expect(DUO_IS_FOE).toHaveLength(24);
    const row = DUO_IS_FOE.map((lv) => clearRate(TOWER_HERO_ID, lv));
    for (let i = 0; i < row.length; i++) {
      expect(row[i], `第 ${DUO_IS_FOE[i] + 1} 关（对手是鸭梨）默认角色一局都赢不下来`).toBeGreaterThan(0);
    }
    // 改之前 177 / 192，改之后 162 —— 难度是抬了一点，但没有塌
    expect(row.reduce((a, b) => a + b, 0), "鸭梨当对手的那 24 关整体被顶得太高").toBeGreaterThanOrEqual(140);
  }, 180000);
});

describe("R3B-2 · 这一笔到底改了什么（只换槽位，一个数没改）", () => {
  it("鸭梨的对空招挂到「后 + 重」，「前 + 重」是突进招", () => {
    const duo = characterById("duoduo");
    expect(duo.moves.s2.name).toBe("追风踢");
    expect(duo.moves.s2.advance, "「前 + 重」不是突进招").toBeGreaterThan(0);
    expect(duo.moves.s2.launch, "「前 + 重」不该是对空招").toBe(0);
    expect(duo.moves.s3.name).toBe("樱吹雪");
    expect(duo.moves.s3.launch, "「后 + 重」不是对空招").toBeGreaterThan(0);
    expect(duo.moves.s3.advance).toBe(0);
  });

  it("对空招挂在「后 + 重」是八位里的多数口径，鸭梨不再是例外", () => {
    const onS3 = CHARACTERS.filter((c) => {
      const s = createMatch(c.id, c.id, { buffs: [noBuff(), noBuff()] });
      return antiAirSlot(s.fighters[0]) === "s3";
    });
    expect(onS3.map((c) => c.id)).toContain("duoduo");
    expect(onS3.length, "对空招挂「后 + 重」的人反而成了少数").toBeGreaterThanOrEqual(6);
  });

  it("两招的数值一个都没动，换的只是槽位", () => {
    const duo = characterById("duoduo");
    const chase = duo.moves.s2;
    expect([chase.startup, chase.active, chase.recovery, chase.power, chase.hitStun]).toEqual([13, 5, 22, 13, 22]);
    expect([chase.knockback, chase.advance, chase.knockdown]).toEqual([8.5, 52, true]);
    expect(chase.box).toEqual({ x: 26, y: 24, w: 84, h: 36 });

    const petal = duo.moves.s3;
    expect([petal.startup, petal.active, petal.recovery, petal.power, petal.hitStun]).toEqual([8, 7, 26, 11, 26]);
    expect([petal.launch, petal.knockback, petal.priority]).toEqual([9, 3.2, 7]);
    expect(petal.box).toEqual({ x: 12, y: 40, w: 52, h: 74 });

    // 看家招 花瓣旋 与超必杀原样在 s1 / super 上，四个必杀一个没多也没少
    expect(duo.moves.s1.name).toBe("花瓣旋");
    expect(duo.moves.super.name).toBe("漫天花雨");
    expect(new Set([duo.moves.s1.name, chase.name, petal.name, duo.moves.super.name]).size).toBe(4);
  });

  it("别人的槽位一个都没碰，八位小伙伴也还是八位", () => {
    expect(CHARACTERS).toHaveLength(8);
    expect(characterById("xingxing").moves.s2.name).toBe("流星踢");
    expect(characterById("xingxing").moves.s3.name).toBe("转身星芒");
    expect(characterById("nuonuo").moves.s2.name).toBe("年糕拉伸");
    expect(characterById("yunyun").moves.s2.name).toBe("上升气流");
  });
});
