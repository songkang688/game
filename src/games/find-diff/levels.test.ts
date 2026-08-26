import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import {
  CHAPTERS,
  LEVELS,
  THEME_POOLS,
  buildBoard,
  buildBoards,
  buildRushBoards,
  mirrorIndex,
  movePermutation,
} from "./levels";
import { MODE_HINTS, finishLine } from "./index";

describe("找不同 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关双图合法：不同点数量正确且只在标记处不同", () => {
    for (let i = 0; i < 99; i++) {
      const cfg = LEVELS[i];
      const { base, changed, diffIdx } = buildBoard(i);
      const n = cfg.rows * cfg.cols;
      expect(base).toHaveLength(n);
      expect(changed).toHaveLength(n);
      expect(diffIdx).toHaveLength(cfg.diffs);
      expect(cfg.diffs).toBeLessThan(n / 2);
      const diffSet = new Set(diffIdx);
      for (let k = 0; k < n; k++) {
        if (diffSet.has(k)) expect(changed[k]).not.toBe(base[k]);
        else expect(changed[k]).toBe(base[k]);
      }
    }
  });

  it("图案都来自本章主题池（或双胞胎替换）", () => {
    const all = new Set(THEME_POOLS.flat().concat(["🎂", "🍬", "🍪", "🌟", "🌠"]));
    for (const i of [0, 20, 40, 55, 70, 98]) {
      const { base, changed } = buildBoard(i);
      for (const e of base.concat(changed)) expect(all.has(e)).toBe(true);
    }
  });

  it("抽 20 关机器校验：标记处必不同、其余格子完全一样、diff 下标有序", () => {
    const samples = [0, 8, 12, 16, 20, 24, 30, 36, 42, 49, 55, 61, 67, 70, 74, 80, 86, 90, 94, 98];
    expect(samples).toHaveLength(20);
    for (const i of samples) {
      const cfg = LEVELS[i];
      const { base, changed, diffIdx } = buildBoard(i);
      expect(diffIdx).toHaveLength(cfg.diffs);
      expect([...diffIdx]).toEqual([...diffIdx].sort((a, b) => a - b));
      const diffSet = new Set(diffIdx);
      base.forEach((e, k) => {
        if (diffSet.has(k)) expect(changed[k]).not.toBe(e);
        else expect(changed[k]).toBe(e);
      });
    }
  });

  it("同一关重试布局一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildBoard(i))).toBe(JSON.stringify(buildBoard(i)));
    }
  });

  it("六章玩法各不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return `${lv.theme}|${lv.rows}x${lv.cols}|${lv.lookalike ? "像" : ""}|${lv.timeSec > 0 ? "限时" : ""}`;
    };
    const sigs = new Set([sig(2), sig(19), sig(36), sig(55), sig(70), sig(95)]);
    expect(sigs.size).toBe(6);
    // 后期章节有双胞胎替换和时间限制
    expect(LEVELS[55].lookalike).toBe(true);
    expect(LEVELS[70].timeSec).toBeGreaterThan(0);
  });

  it("难度递进：棋盘变大、不同点变多、时间变紧", () => {
    expect(LEVELS[0].rows * LEVELS[0].cols).toBeLessThan(LEVELS[98].rows * LEVELS[98].cols);
    expect(LEVELS[0].diffs).toBeLessThan(LEVELS[98].diffs);
    expect(LEVELS[98].timeSec).toBeLessThan(LEVELS[83].timeSec);
    expect(LEVELS[0].maxMiss).toBeGreaterThan(LEVELS[98].maxMiss);
  });
});

// ---------------------------------------------------------------------------
// 1.1：第 100–188 关（三图侦探社 / 旋转灯塔 / 镜像水面 / 连环挑战场）
// ---------------------------------------------------------------------------

/** 1.0 的前 99 关章节切分，硬编码做回归断言 */
const LEGACY_CHAPTER_SNAPSHOT = [
  { name: "水果果园", size: 17 },
  { name: "萌宠乐园", size: 17 },
  { name: "海底世界", size: 17 },
  { name: "甜品小屋", size: 16 },
  { name: "夜空营地", size: 16 },
  { name: "玩具城堡", size: 16 },
];

const NEW_FROM = 99;
const NEW_LEVELS = Array.from({ length: 188 - NEW_FROM }, (_, i) => NEW_FROM + i);
const TRIPLE = Array.from({ length: 23 }, (_, i) => 99 + i);
const MOVING = Array.from({ length: 22 }, (_, i) => 122 + i);
const MIRROR = Array.from({ length: 22 }, (_, i) => 144 + i);
const RUSH = Array.from({ length: 22 }, (_, i) => 166 + i);

describe("找不同 · 1.1 第 100–188 关", () => {
  it("前 99 关章节切分与 1.0 完全一致（回归）", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => ({ name: c.name, size: c.size }))).toEqual(LEGACY_CHAPTER_SNAPSHOT);
    expect(CHAPTERS.slice(0, 6).reduce((s, c) => s + c.size, 0)).toBe(99);
  });

  it("末尾追加 4 个全新章节共 89 关，总数正好 188", () => {
    const extra = CHAPTERS.slice(6);
    expect(extra).toHaveLength(4);
    expect(extra.reduce((s, c) => s + c.size, 0)).toBe(89);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("新章节都配齐了 emoji、粉彩色、一句话介绍和专属表情池", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
    }
    expect(THEME_POOLS).toHaveLength(10);
    for (const pool of THEME_POOLS.slice(6)) {
      expect(pool.length).toBeGreaterThanOrEqual(8);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("前 99 关的生成参数一字未改，且模式一律是经典双图", () => {
    const legacySizes = [17, 17, 17, 16, 16, 16];
    expect(legacySizes.reduce((a, b) => a + b, 0)).toBe(99);
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].mode, `第 ${i + 1} 关`).toBe("classic");
      expect(LEVELS[i].decoys).toBe(0);
      expect(LEVELS[i].moveEverySec).toBe(0);
      expect(LEVELS[i].rounds).toBe(1);
      expect(LEVELS[i].theme).toBeLessThan(6);
      expect(buildBoards(i)).toHaveLength(1);
    }
    // 1.0 的具体档位抽样回归
    expect(LEVELS[0]).toMatchObject({ rows: 3, cols: 3, diffs: 2, maxMiss: 5, timeSec: 0, lookalike: false, theme: 0 });
    expect(LEVELS[98]).toMatchObject({ rows: 5, cols: 5, maxMiss: 3, lookalike: true, theme: 5 });
  });

  it("四个新章节各占一种全新玩法，且都不是经典双图", () => {
    for (const i of TRIPLE) expect(LEVELS[i].mode, `第 ${i + 1} 关`).toBe("triple");
    for (const i of MOVING) expect(LEVELS[i].mode, `第 ${i + 1} 关`).toBe("moving");
    for (const i of MIRROR) expect(LEVELS[i].mode, `第 ${i + 1} 关`).toBe("mirror");
    for (const i of RUSH) expect(LEVELS[i].mode, `第 ${i + 1} 关`).toBe("rush");
    expect(new Set(NEW_LEVELS.map((i) => LEVELS[i].mode)).size).toBe(4);
    for (const i of NEW_LEVELS) expect(LEVELS[i].mode).not.toBe("classic");
  });

  it("第 100–188 关逐关可解：每一轮都恰好有 diffs 个可点中的不同点", () => {
    for (const level of NEW_LEVELS) {
      const cfg = LEVELS[level];
      const n = cfg.rows * cfg.cols;
      const rounds = buildBoards(level);
      expect(rounds.length, `第 ${level + 1} 关`).toBe(cfg.rounds);
      for (const b of rounds) {
        expect(b.base, `第 ${level + 1} 关`).toHaveLength(n);
        expect(b.changed).toHaveLength(n);
        expect(b.diffIdx).toHaveLength(cfg.diffs);
        expect([...b.diffIdx]).toEqual([...b.diffIdx].sort((a, c) => a - c));
        expect(new Set(b.diffIdx).size).toBe(cfg.diffs);
        expect(cfg.diffs).toBeLessThan(n / 2);
        for (const i of b.diffIdx) {
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(n);
        }
      }
    }
  });

  it("三图侦探社：答案格跟上面两张都不同，干扰格只跟其中一张不同", () => {
    for (const level of TRIPLE) {
      const cfg = LEVELS[level];
      const b = buildBoard(level);
      expect(b.second, `第 ${level + 1} 关`).toBeDefined();
      expect(b.decoyIdx).toHaveLength(cfg.decoys);
      const diffSet = new Set(b.diffIdx);
      const decoySet = new Set(b.decoyIdx);
      // 答案格与干扰格不重叠
      for (const i of b.diffIdx) expect(decoySet.has(i), `第 ${level + 1} 关 ${i}`).toBe(false);
      b.base.forEach((e, i) => {
        if (diffSet.has(i)) {
          expect(b.changed[i], `第 ${level + 1} 关 ${i}`).not.toBe(e);
          expect(b.changed[i]).not.toBe(b.second![i]);
          expect(b.second![i]).toBe(e);
        } else if (decoySet.has(i)) {
          expect(b.second![i], `第 ${level + 1} 关 ${i}`).not.toBe(e);
          expect(b.changed[i]).toBe(e);
        } else {
          expect(b.changed[i]).toBe(e);
          expect(b.second![i]).toBe(e);
        }
      });
    }
  });

  it("三图侦探社：干扰差异真的存在（不是白给的三图）", () => {
    for (const level of TRIPLE) {
      expect(LEVELS[level].decoys, `第 ${level + 1} 关`).toBeGreaterThanOrEqual(2);
      expect(LEVELS[level].diffs + LEVELS[level].decoys).toBeLessThanOrEqual(
        LEVELS[level].rows * LEVELS[level].cols
      );
    }
  });

  it("旋转灯塔：位置置换是双射，转一圈能回到原样", () => {
    for (const level of MOVING) {
      const cfg = LEVELS[level];
      expect(cfg.moveEverySec, `第 ${level + 1} 关`).toBeGreaterThan(0);
      const n = cfg.rows * cfg.cols;
      for (const step of [0, 1, 2, 3, 7]) {
        const perm = movePermutation(cfg.rows, cfg.cols, step);
        expect(perm).toHaveLength(n);
        expect(new Set(perm).size, `第 ${level + 1} 关 step=${step}`).toBe(n);
        for (const v of perm) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(n);
        }
      }
      expect(movePermutation(cfg.rows, cfg.cols, 0)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("旋转灯塔：换位置只是挪格子，不同点一个都不会丢", () => {
    for (const level of MOVING) {
      const cfg = LEVELS[level];
      const b = buildBoard(level);
      for (const step of [1, 2, 5]) {
        const perm = movePermutation(cfg.rows, cfg.cols, step);
        // 显示位置换了，但每个位置上下两张对不对得上没变
        const visibleDiffs = perm.filter((src) => b.base[src] !== b.changed[src]);
        expect(visibleDiffs, `第 ${level + 1} 关 step=${step}`).toHaveLength(cfg.diffs);
      }
    }
  });

  it("镜像水面：没被动手脚的格子刚好等于上图的镜像位置", () => {
    for (const level of MIRROR) {
      const cfg = LEVELS[level];
      const b = buildBoard(level);
      const diffSet = new Set(b.diffIdx);
      for (let j = 0; j < b.changed.length; j++) {
        const src = mirrorIndex(j, cfg.cols);
        if (diffSet.has(j)) expect(b.changed[j], `第 ${level + 1} 关 ${j}`).not.toBe(b.base[src]);
        else expect(b.changed[j], `第 ${level + 1} 关 ${j}`).toBe(b.base[src]);
      }
    }
  });

  it("mirrorIndex：照两次镜子回到原位，整行是一个双射", () => {
    for (const cols of [3, 4, 5, 6]) {
      for (let i = 0; i < cols * 4; i++) {
        expect(mirrorIndex(mirrorIndex(i, cols), cols)).toBe(i);
      }
      const row = Array.from({ length: cols }, (_, c) => mirrorIndex(c, cols));
      expect(new Set(row).size).toBe(cols);
      expect(mirrorIndex(0, cols)).toBe(cols - 1);
    }
  });

  it("连环挑战场：每关 2–4 轮，各轮布局互不相同", () => {
    for (const level of RUSH) {
      const cfg = LEVELS[level];
      expect(cfg.rounds, `第 ${level + 1} 关`).toBeGreaterThanOrEqual(2);
      expect(cfg.rounds).toBeLessThanOrEqual(4);
      const rounds = buildRushBoards(level);
      expect(rounds).toHaveLength(cfg.rounds);
      const sigs = new Set(rounds.map((b) => b.changed.join("")));
      expect(sigs.size, `第 ${level + 1} 关各轮不该长一样`).toBe(cfg.rounds);
      // 命数要够撑完全部轮次
      expect(cfg.maxMiss).toBeGreaterThanOrEqual(cfg.rounds);
      expect(cfg.timeSec).toBeGreaterThan(0);
    }
  });

  it("新章节的图案全部来自各自的主题池", () => {
    for (const level of NEW_LEVELS) {
      const pool = new Set(THEME_POOLS[LEVELS[level].theme]);
      for (const b of buildBoards(level)) {
        for (const e of b.base.concat(b.changed, b.second ?? [])) {
          expect(pool.has(e), `第 ${level + 1} 关出现了不属于本章的图案 ${e}`).toBe(true);
        }
      }
    }
  });

  it("第 100–188 关同一关重试布局一致（确定性生成）", () => {
    for (const level of [99, 121, 122, 143, 144, 165, 166, 187]) {
      expect(JSON.stringify(buildBoards(level))).toBe(JSON.stringify(buildBoards(level)));
    }
  });

  it("四种新玩法都有专属说明，且失败文案只鼓励不批评", () => {
    expect(Object.keys(MODE_HINTS)).toHaveLength(5);
    for (const mode of ["triple", "moving", "mirror", "rush"] as const) {
      expect(MODE_HINTS[mode].length).toBeGreaterThan(8);
      expect(MODE_HINTS[mode]).not.toMatch(/笨|差|不行|错了/);
    }
    // 1.1 第 12 步：夸奖改成说得清的「命中率满分」，不再用「真棒」这类空泛低幼夸法
    expect(finishLine(0, 5, 1)).toContain("命中率满分");
    expect(finishLine(0, 5, 3)).toContain("3 轮");
    expect(finishLine(2, 12, 3)).toContain("3 轮");
    for (const line of [finishLine(0, 5, 1), finishLine(0, 5, 3), finishLine(2, 12, 3)]) {
      expect(line).not.toMatch(/可惜|失误|太差|笨|真棒|宝宝|乖乖/);
    }
  });

  it("新章节明显更难：限时更紧、机制更绕，但命数仍然够用", () => {
    for (const level of NEW_LEVELS) {
      const cfg = LEVELS[level];
      expect(cfg.maxMiss).toBeGreaterThanOrEqual(3);
      expect(cfg.diffs).toBeGreaterThanOrEqual(3);
      if (cfg.mode !== "triple") expect(cfg.timeSec).toBeGreaterThan(0);
    }
    // 后段每章都会加限时
    expect(LEVELS[121].timeSec).toBeGreaterThan(0);
    expect(LEVELS[143].timeSec).toBeLessThan(LEVELS[122].timeSec);
    expect(LEVELS[187].timeSec).toBeLessThan(LEVELS[166].timeSec);
  });
});
