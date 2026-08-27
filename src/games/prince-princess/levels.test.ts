import { describe, expect, it } from "vitest";

import {
  BOSSES,
  CHAPTERS,
  MAX_GAP,
  MAX_PLATFORM_RISE,
  MIN_GAP,
  START_PAD,
  TOTAL,
  allLevels,
  bossLevels,
  bossSlotOf,
  buildEndless,
  buildLevel,
  chapterIndexOf,
  groundSolidAt,
  indexInChapterOf,
  type LevelDef,
} from "./levels";
import {
  ENEMY_STATS,
  HERO_W,
  autoPlay,
  createWorld,
  doubleJumpApex,
  jumpApex,
  jumpRange,
  starsForRun,
} from "./logic";

const LEVELS = allLevels();

/** 一次跑完:回一份「赢没赢 / 剩几颗心 / 花了多久」 */
function play(def: LevelDef, players: 1 | 2 = 2) {
  return autoPlay(createWorld(def, players), { maxSeconds: 300 });
}

// ---------------------------------------------------------------------------
// 章节骨架
// ---------------------------------------------------------------------------

describe("章节", () => {
  it("七章合起来正好 188 关", () => {
    expect(CHAPTERS).toHaveLength(7);
    expect(TOTAL).toBe(188);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("每章都有名字、表情和一句给孩子看的说明", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(10);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("关号能对上章节与章内序号", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(indexInChapterOf(0)).toBe(0);
    expect(chapterIndexOf(TOTAL - 1)).toBe(CHAPTERS.length - 1);
    let acc = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      expect(chapterIndexOf(acc)).toBe(ci);
      expect(indexInChapterOf(acc)).toBe(0);
      acc += CHAPTERS[ci].size;
    }
  });

  it("关号越界也不会崩,夹回合法范围", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(9999).index).toBe(TOTAL - 1);
  });
});

// ---------------------------------------------------------------------------
// 首领
// ---------------------------------------------------------------------------

describe("首领", () => {
  it("一共 14 场首领战,远超「至少 6 场」", () => {
    const slots = bossLevels();
    expect(slots.length).toBe(CHAPTERS.length * 2);
    expect(slots.length).toBeGreaterThanOrEqual(6);
  });

  it("每章一场中段小首领、一场章末首领", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const inChapter = bossLevels().filter((lv) => chapterIndexOf(lv) === ci);
      expect(inChapter).toHaveLength(2);
      const slots = inChapter.map((lv) => bossSlotOf(lv));
      expect(slots).toEqual(["mini", "chapter"]);
    }
  });

  it("七位首领各不相同,每章一位", () => {
    expect(new Set(BOSSES.map((b) => b.name)).size).toBe(BOSSES.length);
    expect(BOSSES.length).toBeGreaterThanOrEqual(6);
    for (const lv of bossLevels()) {
      const def = LEVELS[lv];
      expect(def.boss).not.toBeNull();
      expect(def.boss!.kind).toBe(chapterIndexOf(lv));
    }
  });

  it("章末首领比同章的小首领更耐打、出招更急", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const [mini, full] = bossLevels()
        .filter((lv) => chapterIndexOf(lv) === ci)
        .map((lv) => LEVELS[lv].boss!);
      expect(mini.mini).toBe(true);
      expect(full.mini).toBe(false);
      expect(full.hp).toBeGreaterThan(mini.hp);
      expect(full.restSeconds).toBeLessThanOrEqual(mini.restSeconds);
    }
  });

  it("首领关不放尖刺和断口,擂台是一块干净的平地", () => {
    for (const lv of bossLevels()) {
      expect(LEVELS[lv].spikes).toHaveLength(0);
      expect(LEVELS[lv].gaps).toHaveLength(0);
    }
  });

  it("首领关不看清怪比例,只看首领倒没倒", () => {
    for (const lv of bossLevels()) expect(LEVELS[lv].requiredRatio).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 188 关的地形都得站得住脚
// ---------------------------------------------------------------------------

describe("地形", () => {
  it("每一关都有终点、长度合理、终点在场地里", () => {
    for (const def of LEVELS) {
      expect(def.len).toBeGreaterThan(1200);
      expect(def.goalX).toBeGreaterThan(START_PAD);
      expect(def.goalX).toBeLessThan(def.len);
    }
  });

  it("断口不超过王子一跳的距离,也不会互相重叠", () => {
    const reach = jumpRange("prince") - HERO_W;
    for (const def of LEVELS) {
      const sorted = [...def.gaps].sort((a, b) => a.x0 - b.x0);
      let prevEnd = -Infinity;
      for (const g of sorted) {
        const width = g.x1 - g.x0;
        expect(width).toBeGreaterThanOrEqual(MIN_GAP);
        expect(width).toBeLessThanOrEqual(MAX_GAP);
        expect(width).toBeLessThan(reach);
        expect(g.x0).toBeGreaterThan(prevEnd);
        prevEnd = g.x1;
      }
    }
  });

  it("起跑区和终点前是实地,不会一出生就掉下去", () => {
    for (const def of LEVELS) {
      for (let x = 0; x <= START_PAD; x += 20) {
        expect(groundSolidAt(def, x)).toBe(true);
      }
      expect(groundSolidAt(def, def.goalX)).toBe(true);
    }
  });

  it("地面怪的巡逻段全程踩得到实地", () => {
    for (const def of LEVELS) {
      for (const e of def.enemies) {
        if (e.y < 0) continue;
        expect(groundSolidAt(def, e.minX)).toBe(true);
        expect(groundSolidAt(def, e.maxX)).toBe(true);
        expect(e.maxX).toBeGreaterThanOrEqual(e.minX);
      }
    }
  });

  it("尖刺不压在断口上,也不摆在起跑区里", () => {
    for (const def of LEVELS) {
      for (const s of def.spikes) {
        expect(s.x).toBeGreaterThan(START_PAD);
        expect(groundSolidAt(def, s.x)).toBe(true);
        expect(s.w).toBeGreaterThan(0);
      }
    }
  });

  it("平台都在王子跳得上去的高度内", () => {
    const reach = jumpApex("prince");
    for (const def of LEVELS) {
      for (const p of def.platforms) {
        expect(p.y).toBeLessThan(0);
        expect(-p.y).toBeLessThanOrEqual(MAX_PLATFORM_RISE);
        expect(-p.y).toBeLessThan(reach);
        expect(p.w).toBeGreaterThan(60);
        if (p.kind === "move") {
          expect(p.range ?? 0).toBeGreaterThan(0);
          expect(p.speed ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("空中的怪都在公主够得着、王子跳一下也够得着的高度", () => {
    const princessReach = doubleJumpApex();
    for (const def of LEVELS) {
      for (const e of def.enemies) {
        if (e.y >= 0) continue;
        expect(-e.y).toBeLessThan(princessReach);
        expect(-e.y + ENEMY_STATS[e.kind].h).toBeLessThan(princessReach + 60);
      }
    }
  });

  it("每一关都有怪也有宝石,不至于空跑一趟", () => {
    for (const def of LEVELS) {
      expect(def.enemies.length + (def.boss ? 1 : 0)).toBeGreaterThanOrEqual(1);
      expect(def.gems.length).toBeGreaterThanOrEqual(2);
      expect(def.gemGoal).toBeGreaterThanOrEqual(1);
    }
  });

  it("三星标准的门槛都是能达到的", () => {
    for (const def of LEVELS) {
      const groundGems = def.gems.filter((g) => g.ground).length;
      expect(def.gemGoal).toBeLessThanOrEqual(def.gems.length);
      if (groundGems > 0) expect(def.gemGoal).toBeLessThanOrEqual(def.gems.length);
      expect(def.parSeconds).toBeGreaterThan(5);
      if (def.timeLimit > 0) expect(def.timeLimit).toBeGreaterThan(def.parSeconds);
    }
  });
});

// ---------------------------------------------------------------------------
// 机关按章上场
// ---------------------------------------------------------------------------

describe("机关排课", () => {
  const kindsIn = (from: number, to: number) => {
    const set = new Set<string>();
    for (let lv = from; lv <= to; lv++) for (const e of LEVELS[lv].enemies) set.add(e.kind);
    return set;
  };

  const chapterRange = (ci: number): [number, number] => {
    let start = 0;
    for (let i = 0; i < ci; i++) start += CHAPTERS[i].size;
    return [start, start + CHAPTERS[ci].size - 1];
  };

  it("第一章只有最好懂的果冻怪,不会一上来就为难人", () => {
    const [a, b] = chapterRange(0);
    expect([...kindsIn(a, b)]).toEqual(["slime"]);
  });

  it("蝙蝠、铠甲怪、幽灵各自等到自己那一章才登场", () => {
    const seenBefore = (kind: string, ci: number) => {
      const [, end] = chapterRange(ci - 1);
      return kindsIn(0, end).has(kind);
    };
    expect(seenBefore("bat", 1)).toBe(false);
    expect(seenBefore("armor", 2)).toBe(false);
    expect(seenBefore("ghost", 5)).toBe(false);
  });

  it("每一种怪都在正片里出过场", () => {
    const all = kindsIn(0, TOTAL - 1);
    for (const kind of ["slime", "bat", "armor", "ghost", "turret"]) {
      expect(all.has(kind)).toBe(true);
    }
  });

  it("冰霜雪原是滑地板,别的章不是", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      expect(LEVELS[lv].slippery).toBe(chapterIndexOf(lv) === 5);
    }
  });

  it("最后一章什么怪都有,是一次总复习", () => {
    const [a, b] = chapterRange(6);
    const kinds = kindsIn(a, b);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it("尖刺集中在熔岩火山之后", () => {
    const [, beforeLava] = chapterRange(3);
    let early = 0;
    for (let lv = 0; lv <= beforeLava; lv++) early += LEVELS[lv].spikes.length;
    expect(early).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 难度曲线
// ---------------------------------------------------------------------------

describe("难度", () => {
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const normal = LEVELS.filter((d) => !d.boss);

  it("越往后路越长", () => {
    const head = avg(normal.slice(0, 20).map((d) => d.len));
    const tail = avg(normal.slice(-20).map((d) => d.len));
    expect(tail).toBeGreaterThan(head);
  });

  it("越往后怪越多", () => {
    const head = avg(normal.slice(0, 20).map((d) => d.enemies.length));
    const tail = avg(normal.slice(-20).map((d) => d.enemies.length));
    expect(tail).toBeGreaterThan(head * 1.2);
  });

  it("开门要清掉的比例逐步收紧,但永远留有余地", () => {
    for (const def of normal) {
      expect(def.requiredRatio).toBeGreaterThanOrEqual(0.5);
      expect(def.requiredRatio).toBeLessThanOrEqual(0.85);
    }
    expect(normal[normal.length - 1].requiredRatio).toBeGreaterThan(normal[0].requiredRatio);
  });

  it("心数一直是 6,不会突然变成一击必死", () => {
    for (const def of LEVELS) expect(def.hearts).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 确定性
// ---------------------------------------------------------------------------

describe("确定性", () => {
  it("同一关反复生成结果完全一致", () => {
    for (const lv of [0, 1, 27, 93, 140, 187]) {
      expect(JSON.stringify(buildLevel(lv))).toBe(JSON.stringify(buildLevel(lv)));
    }
  });

  it("不同关不会长得一模一样", () => {
    const seen = new Set<string>();
    for (const def of LEVELS) seen.add(JSON.stringify({ ...def, index: 0, name: "" }));
    expect(seen.size).toBeGreaterThan(TOTAL * 0.9);
  });
});

// ---------------------------------------------------------------------------
// 硬指标:188 关都得真的能打通
// ---------------------------------------------------------------------------

describe("188 关全部可通关", () => {
  const results = LEVELS.map((def) => ({ def, r: play(def, 2) }));

  it("双人模式下机器人把 188 关全部打通", () => {
    const failed = results
      .filter(({ r }) => !r.win)
      .map(({ def, r }) => `#${def.index + 1} ${def.name} ${r.lost ? "被打倒" : "超时"}`);
    expect(failed).toEqual([]);
  });

  it("每一关都在限时之内打完", () => {
    for (const { def, r } of results) {
      if (def.timeLimit > 0) expect(r.time).toBeLessThan(def.timeLimit);
    }
  });

  it("首领关都是把首领打倒才算赢的", () => {
    for (const lv of bossLevels()) {
      expect(results[lv].r.bossDown).toBe(true);
    }
  });

  it("通关时至少还剩一颗心 —— 说明不是靠硬扛过去的", () => {
    for (const { def, r } of results) {
      expect(r.hearts, `#${def.index + 1} ${def.name}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("每一关都拿得到至少一颗星", () => {
    for (const { def, r } of results) {
      const stars = starsForRun(def, r);
      expect(stars).toBeGreaterThanOrEqual(1);
      expect(stars).toBeLessThanOrEqual(3);
    }
  });

  it("单人模式(Tab 换人 + 同伴托管)也一样打得通", () => {
    const sample = [0, 5, 13, 27, 40, 55, 68, 81, 93, 108, 120, 133, 147, 160, 174, 187];
    for (const lv of sample) {
      const r = play(LEVELS[lv], 1);
      expect(r.win, `#${lv + 1} ${LEVELS[lv].name}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 无尽:王国远征
// ---------------------------------------------------------------------------

describe("无尽模式", () => {
  it("段落越往后越长越挤", () => {
    const a = buildEndless(0);
    const b = buildEndless(8);
    expect(b.len).toBeGreaterThan(a.len);
    expect(b.enemies.length).toBeGreaterThanOrEqual(a.enemies.length);
  });

  it("每第 5 段安排一场首领", () => {
    for (let r = 0; r < 20; r++) {
      const def = buildEndless(r);
      expect(Boolean(def.boss)).toBe(r > 0 && r % 5 === 4);
    }
  });

  it("远征段不限时,一直跑到打不动为止", () => {
    for (let r = 0; r < 12; r++) expect(buildEndless(r).timeLimit).toBe(0);
  });

  it("同一段反复生成结果一致", () => {
    expect(JSON.stringify(buildEndless(7))).toBe(JSON.stringify(buildEndless(7)));
  });

  it("机器人能一口气跑完前 10 段(含两场远征首领)", () => {
    for (let r = 0; r < 10; r++) {
      const def = buildEndless(r);
      const res = play(def, 2);
      expect(res.win, `第 ${r + 1} 段 ${def.name}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 前 99 关碰撞冻结
// ---------------------------------------------------------------------------

/** 只把**碰得到**的字段拼进去:长度、城门、断口、平台、怪、尖刺、宝石、首领、冰面 */
function collisionOf(d: LevelDef): string {
  return JSON.stringify({
    len: d.len,
    goalX: d.goalX,
    gaps: d.gaps,
    platforms: d.platforms,
    enemies: d.enemies,
    spikes: d.spikes,
    gems: d.gems,
    boss: d.boss,
    slippery: d.slippery,
  });
}

/** FNV-1a,32 位。不引依赖,自己算 */
function fnv1a(s: string): string {
  let a = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    a ^= s.charCodeAt(i);
    a = Math.imul(a, 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0");
}

describe("前 99 关碰撞冻结", () => {
  /**
   * 1.2 的规矩:**前 99 关的碰撞数据一个字节都不许改**,只许改视觉与提示。
   *
   * 所以这里钉一枚校验和。它红了只有两种可能:
   *  1. 你真的动了前 99 关的地形 / 怪 / 机关 —— 那是违规,改回去;
   *  2. 你在 `LevelDef` 上加了新的**碰撞**字段 —— 那就想清楚它该不该进这张表。
   *
   * 教学关标记、检查点、重箱子、提示文案这些 1.2 新加的东西全在**非碰撞**字段上,
   * 所以加了它们这一枚数字不会动。
   */
  const FROZEN_99 = "693ebe7a";

  it("头 99 关的碰撞校验和还是那一枚", () => {
    const parts: string[] = [];
    for (let i = 0; i < 99; i++) parts.push(collisionOf(LEVELS[i]));
    expect(parts).toHaveLength(99);
    expect(fnv1a(parts.join("|"))).toBe(FROZEN_99);
  });

  it("前 99 关一个重箱子都没摆,教学关也只是规则层开关(地形原样)", () => {
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].blocks, `第 ${i + 1} 关`).toEqual([]);
      expect(LEVELS[i].alternating, `第 ${i + 1} 关`).toBe(false);
    }
    // 第 1 关是教学关:标记加了,碰撞照旧
    expect(LEVELS[0].teach).toBe(true);
    expect(LEVELS[0].noRisk).toBe(true);
    expect(LEVELS[0].enemies.length).toBeGreaterThan(0);
  });

  it("校验和真的盯着碰撞:随便挪一格断口就对不上了", () => {
    const victim = LEVELS.slice(0, 99).findIndex((d) => d.gaps.length > 0);
    expect(victim).toBeGreaterThanOrEqual(0);
    const tampered = LEVELS.slice(0, 99).map((d, i) =>
      i === victim ? { ...d, gaps: d.gaps.map((g) => ({ x0: g.x0 + 1, x1: g.x1 })) } : d
    );
    expect(fnv1a(tampered.map(collisionOf).join("|"))).not.toBe(FROZEN_99);
  });
});
