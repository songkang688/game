/**
 * 梨康格斗王 —— 格斗塔难度台阶的实打实回归。
 *
 * 配表测试（`levels.test.ts`）只看数字长什么样，这一份真的把两个 AI 摆上台打完整关：
 * 玩家一侧用游戏自带的最高档（lv4）当"手很好的孩子"，对手一侧照配表取档位与增益，
 * 按 `roundsToWin` 打满回合数，固定 seed，所以结果是确定的、可复现的。
 *
 * 守的是第 1 轮验收记下的 B-10：第 6 章曾经**同时**把 AI 档从"灵巧"抬到"老练"、
 * 把回合数从 1 抬到 2，两级台阶叠在一起，第 132 关起一路打不过。
 */
import { describe, expect, it } from "vitest";
import { aiInput, createBrain, type AiLevel } from "./ai";
import { createMatch, noBuff, stepMatch, type FighterBuff } from "./engine";
import { foeIdOf, towerStage } from "./levels";

/** 打一个回合，返回赢家（0 = 玩家，1 = 守擂者，-1 = 平） */
function playRound(foeId: string, foeAi: AiLevel, buff: FighterBuff, seed: number, limitSec: number): number {
  const s = createMatch("duoduo", foeId, { config: { timeLimit: 60 * limitSec }, buffs: [noBuff(), buff] });
  const me = createBrain(4, seed * 13 + 7);
  const foe = createBrain(foeAi, seed * 29 + 3);
  let frames = 0;
  while (!s.over && frames < 60 * (limitSec + 10)) {
    stepMatch(s, [aiInput(me, s, 0), aiInput(foe, s, 1)]);
    frames++;
  }
  return s.winner;
}

/** 用 lv4 的手打这一关 games 次（每次按 roundsToWin 打满回合），返回赢了几次 */
function clearRate(level: number, games = 10): number {
  const st = towerStage(level);
  let wins = 0;
  for (let g = 1; g <= games; g++) {
    const won = [0, 0];
    for (let r = 0; r < 5 && won[0] < st.roundsToWin && won[1] < st.roundsToWin; r++) {
      const w = playRound(foeIdOf(level), st.aiLevel, st.foeBuff, g * 100 + r, st.timeLimitSec);
      if (w === 0) won[0] += 1;
      else if (w === 1) won[1] += 1;
    }
    if (won[0] >= st.roundsToWin) wins += 1;
  }
  return wins;
}

describe("格斗塔难度台阶（真打，不是看数字）", () => {
  it("第 132 关不再是断崖：lv4 的手十局里赢得下来好几局", () => {
    // 台阶错开之前这里是 2/10，错开之后 5/10
    expect(clearRate(131)).toBeGreaterThanOrEqual(3);
  });

  it("第 116 关到第 132 关之间是台阶不是悬崖：胜率跌幅有上限", () => {
    const before = clearRate(115);
    const after = clearRate(131);
    expect(before).toBeGreaterThanOrEqual(6);
    expect(before - after, "一章之内胜率不该掉掉一大半").toBeLessThanOrEqual(4);
  });

  it("前中段一路都打得过", () => {
    expect(clearRate(0, 4)).toBeGreaterThanOrEqual(3);
    expect(clearRate(99, 4)).toBeGreaterThanOrEqual(2);
  });
});
