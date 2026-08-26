import { describe, expect, it } from "vitest";
import { assertTotal, totalSize, TOTAL_LEVELS } from "../level99";
import {
  ARENA_W,
  CHAPTERS,
  FLOOR_Y,
  MAX_PLATFORM_W,
  MIN_PLATFORM_W,
  PATROL_INSET,
  ROW_GAP,
  SUPPORT_INSET,
  TOTAL,
  VERSUS_ROUND_SECONDS,
  VERSUS_ROUND_TARGET,
  WALL,
  allLevels,
  buildLevel,
  buildVersusArena,
  buildWave,
  chapterIndexOf,
  indexInChapterOf,
  rowSurface,
  supportChain,
  surfaceSpan,
  surfaceSpans,
  surfaceY,
  type ArenaDef,
} from "./arena";
import { autoPlay, createWorld } from "./logic";

const LEVELS = allLevels();
const WAVES = Array.from({ length: 12 }, (_, i) => buildWave(i));
const DUELS = Array.from({ length: 12 }, (_, i) => buildVersusArena(i));

/**
 * 文案红线:
 *  - 原作名与它们的常见简称一个都不许出现,这个游戏是原创的;
 *  - 骂人的、吓人的词也不许出现,玩的人是一年级小朋友。
 */
const BANNED_WORDS = [
  "泡泡龙",
  "泡泡堂",
  "炸弹人",
  "恐龙快打",
  "泡泡对对碰",
  "Bubble",
  "bubble",
  "Bobble",
  "bobble",
  "Puzzle Bobble",
  "马里奥",
  "Mario",
  "笨",
  "蠢",
  "傻",
  "死",
  "打死",
  "血",
];

/** 每一关都得说人话:自家的词儿要出现,别人的名字一个都不能有 */
function checkCopy(def: ArenaDef): void {
  const text = `${def.name}${def.feature}${def.hint}`;
  for (const bad of BANNED_WORDS) {
    expect(text.includes(bad), `「${def.name}」的文案里出现了「${bad}」`).toBe(false);
  }
}

describe("puff-bros 章节切分", () => {
  it("正好 8 个主题章节,加起来 188 关", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(TOTAL).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "puff-bros")).toBe(true);
  });

  it("每章都有原创中文名、emoji、粉彩色和一句话介绍", () => {
    const names = new Set<string>();
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThanOrEqual(3);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThanOrEqual(10);
      expect(ch.size).toBeGreaterThan(0);
      for (const bad of BANNED_WORDS) expect(`${ch.name}${ch.desc}`.includes(bad)).toBe(false);
      names.add(ch.name);
    }
    expect(names.size).toBe(CHAPTERS.length);
  });

  it("chapterIndexOf / indexInChapterOf 在章节边界上对得上", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(indexInChapterOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(indexInChapterOf(24)).toBe(0);
    expect(chapterIndexOf(187)).toBe(CHAPTERS.length - 1);
    expect(indexInChapterOf(187)).toBe(CHAPTERS[CHAPTERS.length - 1].size - 1);
  });
});

describe("puff-bros 188 关生成器", () => {
  it("正好生成 188 关,关号连续、章节对得上", () => {
    expect(LEVELS).toHaveLength(188);
    LEVELS.forEach((def, i) => {
      expect(def.index).toBe(i);
      expect(def.kind).toBe("campaign");
      expect(def.chapterIndex).toBe(chapterIndexOf(i));
    });
  });

  it("同一关生成两次结果完全一样(确定性)", () => {
    for (const i of [0, 47, 99, 143, 187]) {
      expect(JSON.stringify(buildLevel(i))).toBe(JSON.stringify(buildLevel(i)));
    }
  });

  it("关号越界会被夹回 0..187,不会崩", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(999).index).toBe(187);
    expect(buildLevel(3.4).index).toBe(3);
  });

  it("怪物越往后越多,速度越往后越快", () => {
    expect(LEVELS[0].monsters.length).toBeGreaterThanOrEqual(3);
    expect(LEVELS[187].monsters.length).toBeGreaterThan(LEVELS[0].monsters.length);
    const slow = Math.max(...LEVELS[0].monsters.map((m) => m.speed));
    const fast = Math.max(...LEVELS[187].monsters.map((m) => m.speed));
    expect(fast).toBeGreaterThan(slow);
  });

  it("新品种是一章一章解锁的,不会在教之前先冒出来", () => {
    for (const def of LEVELS) {
      for (const m of def.monsters) {
        if (m.kind === "hopper") expect(def.chapterIndex, `第 ${def.index + 1} 关`).toBeGreaterThanOrEqual(1);
        if (m.kind === "chaser") expect(def.chapterIndex, `第 ${def.index + 1} 关`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("标准用时、时间上限、心数都留足余量", () => {
    for (const def of LEVELS) {
      expect(def.parSeconds).toBeGreaterThanOrEqual(10);
      expect(def.timeLimit).toBeGreaterThan(def.parSeconds * 2);
      expect(def.hearts).toBe(5);
      expect(def.candyGoal).toBeGreaterThanOrEqual(2);
      expect(def.candyGoal).toBeLessThanOrEqual(def.candies.length + def.monsters.length);
    }
  });

  it("关卡名和提示语都是原创中文,不蹭任何原作名", () => {
    for (const def of LEVELS) {
      checkCopy(def);
      expect(def.name.startsWith(CHAPTERS[def.chapterIndex].name)).toBe(true);
      expect(def.hint.length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("puff-bros 支撑树", () => {
  const arenas = [...LEVELS, ...WAVES, ...DUELS];

  it("每块浮台都架在下一层的某块(或地板)上,中点压在 parent 的跨度里", () => {
    for (const def of arenas) {
      def.platforms.forEach((p, i) => {
        const where = `${def.name} 第 ${i} 块浮台`;
        expect(p.parent, where).toBeLessThan(i);
        expect(p.parent, where).toBeGreaterThanOrEqual(-1);
        expect(p.w, where).toBeGreaterThanOrEqual(MIN_PLATFORM_W);
        expect(p.w, where).toBeLessThanOrEqual(MAX_PLATFORM_W);
        expect(p.x, where).toBeGreaterThanOrEqual(WALL);
        expect(p.x + p.w, where).toBeLessThanOrEqual(ARENA_W - WALL);
        expect(p.y, where).toBe(rowSurface(p.row));

        const parentRow = p.parent < 0 ? 0 : def.platforms[p.parent].row;
        expect(parentRow, `${where} 的 parent 不在下一层`).toBe(p.row - 1);

        // 站在 parent 上对着这个中点起跳一定顶得上来
        const mid = p.x + p.w / 2;
        const sup = surfaceSpan(def.platforms, p.parent);
        expect(mid, `${where} 的中点悬空了`).toBeGreaterThanOrEqual(sup.x0 + SUPPORT_INSET - 1);
        expect(mid, `${where} 的中点悬空了`).toBeLessThanOrEqual(sup.x1 - SUPPORT_INSET + 1);
      });
    }
  });

  it("同一层的浮台之间都留着掉得下去的缝", () => {
    for (const def of arenas) {
      const byRow = new Map<number, typeof def.platforms>();
      def.platforms.forEach((p) => {
        const row = byRow.get(p.row) ?? [];
        row.push(p);
        byRow.set(p.row, row);
      });
      for (const row of byRow.values()) {
        const sorted = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w);
          expect(gap, `${def.name} 同层浮台贴太近`).toBeGreaterThanOrEqual(ROW_GAP);
        }
      }
    }
  });

  it("任意一块地面顺着 parent 都能一路数回地板", () => {
    for (const def of arenas) {
      for (const s of surfaceSpans(def.platforms)) {
        const chain = supportChain(def.platforms, s.id);
        expect(chain[0]).toBe(s.id);
        expect(chain[chain.length - 1], `${def.name} 的支撑链没落到地板`).toBe(-1);
        expect(new Set(chain).size, `${def.name} 的支撑链绕圈了`).toBe(chain.length);
      }
    }
  });

  it("咕噜怪的巡逻区完整落在自己那块地面上,而且离出生角落远远的", () => {
    for (const def of [...LEVELS, ...WAVES]) {
      for (const m of def.monsters) {
        const span = surfaceSpan(def.platforms, m.surface);
        expect(m.minX, `${def.name} 巡逻左端`).toBeGreaterThanOrEqual(span.x0 + PATROL_INSET - 1);
        expect(m.maxX, `${def.name} 巡逻右端`).toBeLessThanOrEqual(span.x1 - PATROL_INSET + 1);
        expect(m.x).toBeGreaterThanOrEqual(m.minX);
        expect(m.x).toBeLessThanOrEqual(m.maxX);
        expect(m.speed).toBeGreaterThan(0);
        for (const spawn of def.spawns) {
          if (spawn.surface !== m.surface) continue;
          expect(Math.abs(spawn.x - m.x), `${def.name} 的咕噜怪堵在出生点上`).toBeGreaterThan(46);
        }
      }
    }
  });

  it("糖果都摆在某块地面的上方,捡得到", () => {
    for (const def of [...LEVELS, ...WAVES, ...DUELS]) {
      for (const c of def.candies) {
        const span = surfaceSpan(def.platforms, c.surface);
        expect(c.x).toBeGreaterThanOrEqual(span.x0);
        expect(c.x).toBeLessThanOrEqual(span.x1);
        expect(surfaceY(def.platforms, c.surface)).toBeLessThanOrEqual(FLOOR_Y);
      }
    }
  });
});

describe("puff-bros 无尽与对战的场地", () => {
  it("无尽一波比一波难,而且不限时", () => {
    expect(WAVES[0].kind).toBe("endless");
    expect(WAVES[11].monsters.length).toBeGreaterThan(WAVES[0].monsters.length);
    for (const def of WAVES) {
      expect(def.timeLimit).toBe(0);
      expect(def.hearts).toBe(3);
      checkCopy(def);
    }
  });

  it("对战场地左右完全对称,谁都不吃亏", () => {
    for (const def of DUELS) {
      expect(def.kind).toBe("versus");
      expect(def.monsters).toHaveLength(0);
      expect(def.timeLimit).toBe(VERSUS_ROUND_SECONDS);
      expect(def.roundTarget).toBe(VERSUS_ROUND_TARGET);
      expect(def.spawns).toHaveLength(2);
      expect(def.spawns[0].x + def.spawns[1].x).toBe(ARENA_W);
      checkCopy(def);

      const mids = def.platforms.map((p) => p.x + p.w / 2).sort((a, b) => a - b);
      for (let i = 0; i < mids.length / 2; i++) {
        const left = mids[i];
        const right = mids[mids.length - 1 - i];
        expect(Math.abs(left + right - ARENA_W), `${def.name} 不对称`).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 可解性:硬性要求。不是检查数据长得对不对,而是让机器人真的把每一关打通。
// ---------------------------------------------------------------------------

describe("puff-bros 可解性(机器人逐关实打实通关)", () => {
  it("第 1 关能被打通", () => {
    const def = buildLevel(0);
    const r = autoPlay(createWorld(def, { players: 1 }), { maxSeconds: def.timeLimit });
    expect(r.win).toBe(true);
    expect(r.lost).toBe(false);
    expect(r.timedOut).toBe(false);
    expect(r.cleared).toBe(def.monsters.length);
  });

  it("全部 188 关都能一个人打通,而且都在时间上限之内", () => {
    const failed: string[] = [];
    for (let lv = 0; lv < TOTAL; lv++) {
      const def = buildLevel(lv);
      const r = autoPlay(createWorld(def, { players: 1 }), { maxSeconds: def.timeLimit });
      if (!r.win || r.time > def.timeLimit) {
        failed.push(`#${lv + 1}(${def.name})清了 ${r.cleared}/${def.monsters.length}`);
      }
    }
    expect(failed).toEqual([]);
  });

  it("两个人一起也能打通(合作时不会互相添乱)", () => {
    const failed: string[] = [];
    for (let lv = 0; lv < TOTAL; lv += 7) {
      const def = buildLevel(lv);
      const r = autoPlay(createWorld(def, { players: 2 }), { maxSeconds: def.timeLimit });
      if (!r.win) failed.push(`#${lv + 1} 清了 ${r.cleared}/${def.monsters.length}`);
    }
    expect(failed).toEqual([]);
  });

  it("无尽模式前十二波也都清得完", () => {
    const failed: string[] = [];
    for (let wave = 0; wave < 12; wave++) {
      const def = buildWave(wave);
      const r = autoPlay(createWorld(def, { players: 1 }), { maxSeconds: 180 });
      if (!r.win) failed.push(`第 ${wave + 1} 波清了 ${r.cleared}/${def.monsters.length}`);
    }
    expect(failed).toEqual([]);
  });

  it("标准用时定得合理:抽查的关卡机器人都能压在标准时间以内", () => {
    for (const lv of [0, 30, 60, 90, 120, 150, 187]) {
      const def = buildLevel(lv);
      const r = autoPlay(createWorld(def, { players: 1 }), { maxSeconds: def.timeLimit });
      expect(r.time, `第 ${lv + 1} 关标准用时太紧`).toBeLessThanOrEqual(def.parSeconds);
    }
  });
});
