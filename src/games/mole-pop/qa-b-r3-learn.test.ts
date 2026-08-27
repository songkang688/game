/**
 * 窗口4 · 档B · 第 3 轮学习优化员 —— 地鼠嘭嘭(mole-pop)。
 *
 * 落地 B3-L3:战役第 6 章有一整章「算术地洞」(举算式牌的地鼠),
 * 夜市却一摊都没有——`endlessWave` 从头到尾不带 `quizChance`。
 * 越守越只剩「看见就拍」这一件事。这一轮每隔 7 摊摆一个算式摊。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ENDLESS_QUIZ_EVERY,
  ENDLESS_QUIZ_FROM,
  QUIZ_GAP_FLOOR_MS,
  QUIZ_UP_FLOOR_MS,
  endlessWave,
  isQuizStall,
  stallConfig,
} from "./levels";
import { nightMarketChart } from "./rhythm";

describe("档B R3-L3 · 夜市:每隔七摊来一个算式摊", () => {
  it("第 14 摊之前一摊算式都没有:开局的手感原样不动", () => {
    for (let n = 1; n < ENDLESS_QUIZ_FROM; n++) {
      expect(isQuizStall(n), `第 ${n} 摊就出算式了`).toBe(false);
      expect(stallConfig(n), `第 ${n} 摊被改了`).toEqual(endlessWave(n));
    }
  });

  it("到点之后每 7 摊来一个,不多不少", () => {
    const stalls: number[] = [];
    for (let n = 1; n <= 200; n++) if (isQuizStall(n)) stalls.push(n);
    expect(stalls.slice(0, 4)).toEqual([14, 21, 28, 35]);
    for (let i = 1; i < stalls.length; i++) {
      expect(stalls[i] - stalls[i - 1], "两个算式摊挨得不是 7 摊").toBe(ENDLESS_QUIZ_EVERY);
    }
    // 算式摊是少数派:七摊里只有一摊,不会喧宾夺主
    expect(stalls.length / 200).toBeLessThan(0.2);
  });

  it("算式摊只考心算:金鼠/兔子/瞌睡/盾牌一只都不来凑热闹", () => {
    for (let n = 1; n <= 300; n++) {
      if (!isQuizStall(n)) continue;
      const cfg = stallConfig(n);
      expect(cfg.quizChance, `第 ${n} 摊不是满场算式`).toBe(1);
      expect(cfg.goldChance).toBe(0);
      expect(cfg.bunnyChance).toBe(0);
      expect(cfg.sleepyChance).toBe(0);
      expect(cfg.shieldChance).toBe(0);
      // 算式牌得看得清,不能又黑灯又心算
      expect(cfg.night, `第 ${n} 摊又黑灯又要心算`).toBe(false);
    }
  });

  it("算式摊一定比同期的普通摊慢,而且慢到有地板", () => {
    for (let n = 1; n <= 300; n++) {
      if (!isQuizStall(n)) continue;
      const cfg = stallConfig(n);
      const base = endlessWave(n);
      expect(cfg.upMsMin, `第 ${n} 摊没比普通摊慢`).toBeGreaterThan(base.upMsMin);
      expect(cfg.gapMs).toBeGreaterThan(base.gapMs);
      expect(cfg.upMsMin, `第 ${n} 摊快得来不及算`).toBeGreaterThanOrEqual(QUIZ_UP_FLOOR_MS);
      expect(cfg.gapMs, `第 ${n} 摊两只挨得太紧`).toBeGreaterThanOrEqual(QUIZ_GAP_FLOOR_MS);
      expect(cfg.upMsMax).toBeGreaterThan(cfg.upMsMin);
      // 台面上最多三只:算式牌多了就成了找茬游戏
      expect(cfg.maxConcurrent).toBeGreaterThanOrEqual(2);
      expect(cfg.maxConcurrent).toBeLessThanOrEqual(3);
    }
  });

  it("算式摊的目标分够得着:排出来的算式鼠比目标分多得多", () => {
    for (let n = 1; n <= 300; n++) {
      if (!isQuizStall(n)) continue;
      const cfg = stallConfig(n);
      const chart = nightMarketChart(cfg, n, n * 7919 + 13);
      const quiz = chart.filter((note) => note.kind === "quiz").length;
      expect(quiz, `第 ${n} 摊排出来的不是算式鼠`).toBe(chart.length);
      // 算式鼠里对得上得数的大约一半,所以要留出两倍以上的余量
      expect(quiz, `第 ${n} 摊只排了 ${quiz} 只却要 ${cfg.target} 分`).toBeGreaterThanOrEqual(
        cfg.target * 2,
      );
      expect(cfg.target, `第 ${n} 摊的目标分比普通摊还高`).toBeLessThan(endlessWave(n).target + 1);
    }
  });

  it("普通摊一个数都没动:算式摊只是盖在难度曲线上的一层皮", () => {
    for (let n = 1; n <= 300; n++) {
      if (isQuizStall(n)) continue;
      expect(stallConfig(n), `第 ${n} 摊被算式摊带偏了`).toEqual(endlessWave(n));
    }
  });

  it("夜市真的换成了 stallConfig,而且招牌会告诉孩子这是算式摊", () => {
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(src).toContain("stallConfig(wave)");
    expect(src).toContain("isQuizStall(wave)");
    expect(src).toContain("算式摊");
  });
});
