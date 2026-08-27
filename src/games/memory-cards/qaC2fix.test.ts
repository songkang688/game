// 档C · 第 2 轮监督修复员:回归总闸。
//
// 第 1 轮清掉的、第 2 轮落地的,本轮结束前逐条再钉一遍;
// 顺带把这一档的三条硬约束(存档 key 只增不改 / 音效只走 api.play / 不许引外部依赖)
// 用源码扫描盯住——这三条一旦破了,单测层面看不出来,只能靠扫。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ENDLESS_PEAK_ROUND as SEEK_PEAK,
  endlessDifficulty as seekDifficulty,
  endlessMissPenalty,
  endlessSeconds,
  endlessTargetCount,
} from "../alien-seek/logic";
import { buildEndlessRound } from "../alien-seek/levels";
import {
  ENDLESS_PEAK_ROUND as BOX_PEAK,
  buildEndless,
  endlessDifficulty as boxDifficulty,
} from "../box-hamster/levels";
import { CELL_MIN, boardWidth, fitCell } from "../box-hamster/assist";
import { LEVELS as BUBBLE_LEVELS, THEMES, budgetBand, budgetNote } from "../bubble-aim/levels";
import { endlessStartRows } from "../bubble-aim/aim12";
import { COLS, descend, parseLayout, rowLen } from "../bubble-aim/logic";
import {
  ENDLESS_PEAK_GARDEN as SNAKE_PEAK,
  endlessDifficulty as snakeDifficulty,
  endlessGarden,
} from "../snake-snack/levels";
import { endlessDifficulty as memoryDifficulty } from "./logic";
import { mulberry32 } from "../level99";

const GAMES = ["alien-seek", "box-hamster", "bubble-aim", "snake-snack", "memory-cards"];

function readSrc(game: string, file: string): string {
  return readFileSync(new URL(`../${game}/${file}`, import.meta.url), "utf8");
}

function indexOf(game: string): string {
  return readSrc(game, "index.ts");
}

describe("档C R2 修复 · 前两轮的结论一条都没回潮", () => {
  it("C1-01(box-hamster 360px 溢出)仍然是 0:窄屏逐关都摆得下", () => {
    for (const width of [320, 360, 390, 414]) {
      for (let cols = 5; cols <= 13; cols++) {
        const cell = fitCell(cols, width);
        expect(boardWidth(cols, cell), `${width}px / ${cols} 列`).toBeLessThanOrEqual(width);
        expect(cell, `${width}px / ${cols} 列的格子太小`).toBeGreaterThanOrEqual(CELL_MIN);
      }
    }
  });

  it("C2-01(alien-seek 无尽第 20 轮冻住)已清:曲线撑到第 36 轮", () => {
    expect(seekDifficulty(SEEK_PEAK)).toBeGreaterThan(seekDifficulty(20));
    expect(SEEK_PEAK).toBe(36);
    for (let r = 2; r <= 200; r++) {
      expect(seekDifficulty(r)).toBeGreaterThanOrEqual(seekDifficulty(r - 1));
    }
    // 罚时不再跟着 chapter 循环,而且咬不掉五分之一的时间
    for (let r = 1; r <= 200; r++) {
      expect(buildEndlessRound(r).penalty).toBe(endlessMissPenalty(r));
      expect(endlessMissPenalty(r)).toBeLessThanOrEqual(endlessSeconds(r) / 5);
    }
    expect(endlessTargetCount(999)).toBe(8);
  });

  it("C2-02(bubble-aim 无尽清屏补货抛异常)已清:两种奇偶都补得上", () => {
    for (const pushes of [0, 1]) {
      const g = parseLayout(endlessStartRows(["R", "Y", "B"], mulberry32(3), 4));
      for (let k = 0; k < pushes; k++) descend(g, "R".repeat(rowLen(g.flip ^ 1, 0)));
      expect(g.flip).toBe(pushes % 2);
      expect(() => {
        for (const line of endlessStartRows(["R", "Y", "B"], mulberry32(5), 2, g.flip ^ 1)) {
          descend(g, line);
        }
      }, `压过 ${pushes} 行`).not.toThrow();
    }
    // 老口径(不传 flip)照旧,parseLayout 那条路没被带歪
    expect(endlessStartRows(["R"], mulberry32(1), 2).map((l) => l.length)).toEqual([COLS, COLS - 1]);
  });

  it("C2-03(bubble-aim 新手主题最紧却不吭声)已缓解:整章挂提醒 + 简介讲明", () => {
    for (let i = 0; i < 17; i++) {
      expect(budgetBand(BUBBLE_LEVELS[i]), BUBBLE_LEVELS[i].name).toBe("偏紧");
      expect(budgetNote(BUBBLE_LEVELS[i])).not.toBe("");
    }
    expect(THEMES[0].blurb).toContain("子弹");
  });

  it("box-hamster / snake-snack / memory-cards 三条无尽曲线也都撑过第 30 轮", () => {
    expect(BOX_PEAK).toBeGreaterThanOrEqual(30);
    expect(SNAKE_PEAK).toBeGreaterThanOrEqual(30);
    expect(boxDifficulty(BOX_PEAK)).toBeGreaterThan(boxDifficulty(14));
    expect(snakeDifficulty(SNAKE_PEAK)).toBeGreaterThan(snakeDifficulty(16));
    expect(memoryDifficulty(34)).toBeGreaterThan(memoryDifficulty(8));
    // 造得出来、玩得下去
    expect(buildEndless(BOX_PEAK).reference.length).toBeGreaterThan(0);
    expect(endlessGarden(SNAKE_PEAK).target).toBeGreaterThan(endlessGarden(16).target);
  });
});

describe("档C R2 修复 · 三条硬约束的源码总闸", () => {
  it("存档 key 只增不改:五款还是那几把老钥匙,没冒出新的", () => {
    // 只有 bubble-aim 自己开了一把 key(1.0 就有的),另外四款一律走 engine/save
    expect(indexOf("bubble-aim")).toContain('const SAVE_KEY = "yiduo.bubble-aim.campaign.v2"');
    for (const g of GAMES) {
      const src = indexOf(g);
      const keys = [...src.matchAll(/"(yiduo\.[^"]+)"/g)].map((m) => m[1]);
      const allowed = new Set(["yiduo.bubble-aim.campaign.v2"]);
      for (const k of keys) expect(allowed.has(k), `${g} 冒出了新存档 key「${k}」`).toBe(true);
      // 其余读写一律走 save.getGameProgress / save.recordEndlessBest
      const direct = src.split("localStorage.").length - 1;
      expect(direct, `${g} 直接动了 localStorage ${direct} 处`).toBe(g === "bubble-aim" ? 2 : 0);
    }
  });

  it("音效只走 api.play(...),没有 new Audio / AudioContext", () => {
    for (const g of GAMES) {
      const src = indexOf(g);
      expect(src, `${g} 自己造了 Audio`).not.toContain("new Audio");
      expect(src, `${g} 自己开了 AudioContext`).not.toMatch(/AudioContext/);
      expect(src, `${g} 一次 api.play 都没有`).toContain("api.play(");
    }
  });

  it("不许 three.js / CDN / Socket", () => {
    for (const g of GAMES) {
      for (const f of ["index.ts", "logic.ts", "levels.ts", "meta.ts"]) {
        let src = "";
        try {
          src = readSrc(g, f);
        } catch {
          continue;
        }
        for (const bad of ["three", "THREE", "WebSocket", "socket.io", "EventSource", "http://", "https://"]) {
          expect(src.includes(bad), `${g}/${f} 里出现了「${bad}」`).toBe(false);
        }
      }
    }
  });

  it("五款的 destroy 都收得干净:加了几个监听就摘几个", () => {
    for (const g of GAMES) {
      const src = indexOf(g);
      const add = src.split("addEventListener(").length - 1;
      const remove = src.split("removeEventListener(").length - 1;
      expect(add, `${g} 一个监听都没加?`).toBeGreaterThan(0);
      // window / document 上挂的必须摘掉;挂在自己 DOM 上的随 wrap.remove() 一起走
      const onGlobal = [...src.matchAll(/(window|document)\.addEventListener\(/g)].length;
      expect(remove, `${g} 在 window/document 上挂了 ${onGlobal} 个监听,只摘了 ${remove} 个`)
        .toBeGreaterThanOrEqual(onGlobal);
      expect(src, `${g} 的 destroy 里没有清场`).toMatch(/destroy\(\)\s*\{/);
    }
  });

  it("计时器与帧都有对应的清理", () => {
    for (const g of GAMES) {
      const src = indexOf(g);
      if (src.includes("setInterval(")) expect(src, `${g} 有 setInterval 没 clear`).toContain("clearInterval(");
      if (src.includes("requestAnimationFrame(")) {
        expect(src, `${g} 有 rAF 没 cancel`).toContain("cancelAnimationFrame(");
      }
    }
  });
});
