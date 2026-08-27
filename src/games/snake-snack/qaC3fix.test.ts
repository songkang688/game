// 档C · 第 3 轮监督修复员:发布前总闸。
//
// 三轮下来一共登记 9 条问题、落地 11 条改进,这一份是发车前最后一次逐条点名:
//  ① 前两轮清掉的(C1-01 / C2-02)不许回潮;
//  ② 三轮落地的曲线与提示都还在;
//  ③ 五款的硬约束(商标 0 / 无血无死亡 / 角色只用鸭梨康康 / 存档 key 只增不改 /
//     音效只走 api.play / 不许 three.js·CDN·Socket / destroy 收得干净)全款扫一遍;
//  ④ C3-01 的范围钉死在 1.0 老章,不许扩散。
//
// 扫源码这件事看着笨,但这几条恰恰是单测层面看不出来的:
// 商标、丧气话、外部依赖、忘了摘的监听,都只能靠扫。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  ENDLESS_PEAK_ROUND as SEEK_PEAK,
  endlessDifficulty as seekDifficulty,
  endlessMissPenalty,
} from "../alien-seek/logic";
import {
  ENDLESS_PEAK_ROUND as BOX_PEAK,
  buildEndless,
  endlessDifficulty as boxDifficulty,
  endlessPortalPairs,
  getLevel,
} from "../box-hamster/levels";
import { CELL_MIN, boardWidth, fitCell } from "../box-hamster/assist";
import { hasPortal } from "../box-hamster/logic";
import { LEVELS as BUBBLE_LEVELS, budgetBand } from "../bubble-aim/levels";
import { endlessPalette, endlessStartRows } from "../bubble-aim/aim12";
import { descend, parseLayout, rowLen } from "../bubble-aim/logic";
import {
  ENDLESS_PEAK_GARDEN as SNAKE_PEAK,
  LEGACY_LEVELS,
  LEVELS as SNAKE_LEVELS,
  endlessDifficulty as snakeDifficulty,
} from "./levels";
import { cellKey, wallSet } from "./logic";
import {
  ENDLESS_PEAK_ROUND as MEMORY_PEAK,
  endlessDecoys,
  endlessDifficulty as memoryDifficulty,
} from "../memory-cards/logic";

const GAMES = ["alien-seek", "box-hamster", "bubble-aim", "snake-snack", "memory-cards"];

/** 商标黑名单:一个字都不许出现在这五个目录里 */
const BRANDS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
  "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀",
];

/** 无血无死亡:这些词一个都不许出现在给孩子看的字里 */
const HARSH = ["血", "死亡", "杀死", "干掉", "尸", "你输了", "笨蛋", "废物"];

function dirOf(game: string): string {
  return fileURLToPath(new URL(`../${game}/`, import.meta.url));
}

function sourcesOf(game: string): Array<{ file: string; src: string }> {
  const dir = dirOf(game);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ file: `${game}/${f}`, src: readFileSync(dir + f, "utf8") }));
}

function indexOf(game: string): string {
  return readFileSync(dirOf(game) + "index.ts", "utf8");
}

/* ------------------------------------------------------------------ */
/* 一、三轮的结论一条都没回潮                                           */
/* ------------------------------------------------------------------ */

describe("档C R3 修复 · 三轮结论逐条点名", () => {
  it("C1-01(box-hamster 360px 溢出)仍然是 0", () => {
    for (const width of [320, 360, 390, 414]) {
      for (let cols = 5; cols <= 13; cols++) {
        const cell = fitCell(cols, width);
        expect(boardWidth(cols, cell), `${width}px / ${cols} 列`).toBeLessThanOrEqual(width);
        expect(cell, `${width}px / ${cols} 列的格子太小`).toBeGreaterThanOrEqual(CELL_MIN);
      }
    }
  });

  it("C2-02(bubble-aim 无尽清屏补货抛异常)仍然清着:两种奇偶都补得上", () => {
    for (const pushes of [0, 1, 2, 3]) {
      const g = parseLayout(endlessStartRows(endlessPalette(0, ["R", "Y", "G"]), mulberry32(3), 4));
      for (let k = 0; k < pushes; k++) descend(g, "R".repeat(rowLen(g.flip ^ 1, 0)));
      expect(g.flip).toBe(pushes % 2);
      expect(() => {
        for (const line of endlessStartRows(endlessPalette(pushes, ["R", "Y", "G", "B", "P"]), mulberry32(5), 2, g.flip ^ 1)) {
          descend(g, line);
        }
      }, `压过 ${pushes} 行`).not.toThrow();
    }
  });

  it("C2-03(bubble-aim 新手主题最紧却不吭声)仍然缓解着:整章挂着提醒", () => {
    for (let i = 0; i < 17; i++) {
      expect(budgetBand(BUBBLE_LEVELS[i]), BUBBLE_LEVELS[i].name).toBe("偏紧");
    }
  });

  it("四条无尽曲线都还撑着,而且到顶轮次全部来自导出常量", () => {
    for (const [name, peak, at, before] of [
      ["alien-seek", SEEK_PEAK, seekDifficulty, 20],
      ["box-hamster", BOX_PEAK, boxDifficulty, 14],
      ["snake-snack", SNAKE_PEAK, snakeDifficulty, 16],
      ["memory-cards", MEMORY_PEAK, memoryDifficulty, 34],
    ] as Array<[string, number, (n: number) => number, number]>) {
      expect(peak, `${name} 太早到顶`).toBeGreaterThanOrEqual(30);
      expect(at(peak), `${name} 延段没生效`).toBeGreaterThan(at(before));
      expect(at(peak), `${name} 到顶之后还在涨`).toBe(at(peak + 50));
    }
    expect(endlessMissPenalty(200)).toBeGreaterThan(0);
  });

  it("L3-01(box-hamster 无尽漩涡)仍然逐仓兑现,战役数据仍然一字未改", () => {
    for (let r = 10; r <= 40; r += 2) {
      if (endlessPortalPairs(r) === 0) continue;
      expect(hasPortal(buildEndless(r)), `第 ${r + 1} 仓没摆出漩涡`).toBe(true);
    }
    let h = 2166136261 >>> 0;
    let len = 0;
    for (let i = 0; i < 188; i++) {
      const s = JSON.stringify(getLevel(i));
      len += s.length;
      for (let k = 0; k < s.length; k++) {
        h ^= s.charCodeAt(k);
        h = Math.imul(h, 16777619) >>> 0;
      }
    }
    expect(len).toBe(350140);
    expect(h.toString(16), "战役 188 关被改动了").toBe("5c778938");
  });

  it("L3-02 / L3-03 都还在:独苗卡按轮上,无尽开局仍然是 3 色", () => {
    expect(endlessDecoys(29)).toBe(0);
    expect(endlessDecoys(30)).toBe(1);
    expect(endlessDecoys(MEMORY_PEAK)).toBe(3);
    expect(endlessPalette(0, ["R", "Y", "G", "B", "P"])).toHaveLength(3);
    expect(endlessPalette(10, ["R", "Y", "G", "B", "P"])).toHaveLength(5);
  });

  it("C3-01 的范围钉死在 1.0 老章:新章一格重复都没有", () => {
    for (let i = LEGACY_LEVELS; i < SNAKE_LEVELS.length; i++) {
      const lv = SNAKE_LEVELS[i];
      expect(wallSet(lv).size, `第 ${i + 1} 关有重复的墙格`).toBe(lv.walls.length);
    }
    // 老章那 88 格只是重复,不是多出来的墙
    SNAKE_LEVELS.forEach((lv, i) => {
      expect(wallSet(lv).size, `第 ${i + 1} 关`).toBe(
        new Set(lv.walls.map(([x, y]) => cellKey(x, y))).size
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/* 二、硬约束:五款全目录扫一遍                                          */
/* ------------------------------------------------------------------ */

describe("档C R3 修复 · 硬约束全款扫描", () => {
  it("商标黑名单 29 个词,五款全目录 0 命中", () => {
    for (const g of GAMES) {
      for (const { file, src } of sourcesOf(g)) {
        for (const brand of BRANDS) {
          expect(src.includes(brand), `${file} 里出现了商标「${brand}」`).toBe(false);
        }
      }
    }
  });

  it("无血无死亡:五款全目录不许出现那几个字", () => {
    for (const g of GAMES) {
      for (const { file, src } of sourcesOf(g)) {
        for (const w of HARSH) {
          expect(src.includes(w), `${file} 里出现了「${w}」`).toBe(false);
        }
      }
    }
  });

  it("角色只有鸭梨和康康:双人局的座位名没被换掉", () => {
    const seats = readFileSync(dirOf("memory-cards") + "logic.ts", "utf8");
    expect(seats).toContain('["鸭梨", "康康"]');
    for (const g of GAMES) {
      const src = indexOf(g);
      // 出现了「鸭梨」就必须同时有「康康」(两个人一起玩的那几款)
      if (src.includes("鸭梨")) expect(src, `${g} 只有鸭梨没有康康`).toContain("康康");
    }
  });

  it("存档 key 只增不改:还是那一把老钥匙", () => {
    expect(indexOf("bubble-aim")).toContain('const SAVE_KEY = "yiduo.bubble-aim.campaign.v2"');
    for (const g of GAMES) {
      for (const { file, src } of sourcesOf(g)) {
        const keys = [...src.matchAll(/"(yiduo[.-][^"]+)"/g)].map((m) => m[1]);
        for (const k of keys) {
          expect(k === "yiduo.bubble-aim.campaign.v2", `${file} 冒出了新存档 key「${k}」`).toBe(true);
        }
      }
      const direct = indexOf(g).split("localStorage.").length - 1;
      expect(direct, `${g} 直接动了 localStorage ${direct} 处`).toBe(g === "bubble-aim" ? 2 : 0);
    }
  });

  it("音效只走 api.play(...)", () => {
    for (const g of GAMES) {
      for (const { file, src } of sourcesOf(g)) {
        expect(src.includes("new Audio"), `${file} 自己造了 Audio`).toBe(false);
        expect(src.includes("AudioContext"), `${file} 自己开了 AudioContext`).toBe(false);
      }
      expect(indexOf(g), `${g} 一次 api.play 都没有`).toContain("api.play(");
    }
  });

  it("不许 three.js / CDN / Socket / eval", () => {
    for (const g of GAMES) {
      for (const { file, src } of sourcesOf(g)) {
        for (const bad of ["three.js", "THREE.", "WebSocket", "socket.io", "EventSource", "http://", "https://", "eval(", "new Function("]) {
          expect(src.includes(bad), `${file} 里出现了「${bad}」`).toBe(false);
        }
        expect(src.includes("import(\"http"), `${file} 动态引了外链`).toBe(false);
      }
    }
  });

  it("destroy 收得干净:全局监听摘干净、计时器与帧都有对应的清理", () => {
    for (const g of GAMES) {
      const src = indexOf(g);
      expect(src, `${g} 没有 destroy`).toMatch(/destroy\(\)\s*\{/);
      const onGlobal = [...src.matchAll(/(window|document)\.addEventListener\(/g)].length;
      const remove = src.split("removeEventListener(").length - 1;
      expect(remove, `${g} 在 window/document 上挂了 ${onGlobal} 个监听,只摘了 ${remove} 个`)
        .toBeGreaterThanOrEqual(onGlobal);
      if (src.includes("setInterval(")) expect(src, `${g} 有 setInterval 没 clear`).toContain("clearInterval(");
      if (src.includes("requestAnimationFrame(")) {
        expect(src, `${g} 有 rAF 没 cancel`).toContain("cancelAnimationFrame(");
      }
    }
  });

  it("帧循环的总闸还在:排下一帧写在回调开头,中途抛异常也不会把循环掐断", () => {
    // 这是第 2 轮修 C2-02 时一并加的护栏:rAF 排帧必须在 destroyed 判断之后、业务逻辑之前
    for (const g of ["alien-seek", "bubble-aim", "snake-snack"]) {
      const src = indexOf(g);
      const m = /function (frame|tick)\(([^)]*)\)[^{]*\{([\s\S]{0,220})/.exec(src);
      expect(m, `${g} 找不到帧回调`).not.toBeNull();
      expect(m?.[3] ?? "", `${g} 的排帧不在回调开头`).toContain("requestAnimationFrame(");
    }
  });
});
