// 碰碰车大乱斗 · 188 关场地表单测。
// 关卡是生成出来的,所以「有没有死图」只能靠全量扫描来保证:
// 188 关逐关检查出生点、加速带、滚桶、对手阵容是不是都落在场地里、数量合不合理。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { AI_LEVELS } from "./ai";
import {
  ALL_LEVELS,
  CHAPTERS,
  arcsFor,
  buildArena,
  buildLevel,
  buildWave,
  chapterOfLevel,
  chapterStartLevel,
  ringPoints,
  springsFor,
  waveFoeCount,
  waveSkill,
} from "./levels";
import { CAR_R, edgeDistance, fieldRadius, hypot, inArc } from "./logic";

describe("章节切分", () => {
  it("八个主题章节,加起来正好 188 关", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "bumper-cars")).toBe(true);
  });

  it("每一章都有名字、emoji、粉彩色和一句话介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.size).toBeGreaterThan(10);
    }
  });

  it("关号到章节的换算和章节起点对得上", () => {
    expect(chapterOfLevel(0)).toBe(0);
    expect(chapterOfLevel(23)).toBe(0);
    expect(chapterOfLevel(24)).toBe(1);
    expect(chapterOfLevel(187)).toBe(7);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const start = chapterStartLevel(ci);
      expect(chapterOfLevel(start)).toBe(ci);
      expect(chapterOfLevel(start + CHAPTERS[ci].size - 1)).toBe(ci);
    }
  });
});

describe("188 关全量体检", () => {
  it("每一关的出生点都在场内,而且离悬崖有安全距离", () => {
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      const all = [lv.spawn, ...lv.foeSpawns];
      for (const p of all) {
        expect(edgeDistance(lv.field, p.x, p.y), `第 ${i + 1} 关出生点贴着悬崖`).toBeGreaterThan(CAR_R * 2);
      }
      expect(new Set(all.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size).toBe(all.length);
    }
  });

  it("每一关的对手数量、生命、限时都在合理范围", () => {
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      expect(lv.foes.length, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(1);
      expect(lv.foes.length, `第 ${i + 1} 关`).toBeLessThanOrEqual(5);
      expect(lv.foeSpawns.length).toBe(lv.foes.length);
      expect(lv.hearts).toBeGreaterThanOrEqual(3);
      expect(lv.seconds).toBeGreaterThanOrEqual(60);
      expect(lv.seconds).toBeLessThanOrEqual(150);
      for (const foe of lv.foes) {
        expect(foe.lives).toBeGreaterThanOrEqual(1);
        expect(foe.mass).toBeGreaterThan(0);
        // 1.2 起电脑车手有四档,最后一章的收官关会派出第四档的「卡角高手」
        expect(AI_LEVELS).toContain(foe.skill);
        expect(foe.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("同时出战的对手数不会超过场上的对手总数,前两章一次只来一台", () => {
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      expect(lv.hunters, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(1);
      expect(lv.hunters, `第 ${i + 1} 关`).toBeLessThanOrEqual(lv.foes.length);
      if (lv.chapter <= 1) expect(lv.hunters).toBe(1);
      else expect(lv.hunters).toBeLessThanOrEqual(2);
    }
  });

  it("生命数一章比一章给得多,后面的场地才敢放开撞", () => {
    const hearts = CHAPTERS.map((_, ci) => buildLevel(chapterStartLevel(ci)).hearts);
    for (let ci = 1; ci < hearts.length; ci++) {
      expect(hearts[ci], `第 ${ci + 1} 章的生命反而变少了`).toBeGreaterThanOrEqual(hearts[ci - 1]);
    }
    expect(hearts[hearts.length - 1]).toBeGreaterThan(hearts[0]);
  });

  it("加速带与滚桶都摆在场地里面", () => {
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      for (const pad of lv.pads) {
        const cx = pad.x + pad.w / 2;
        const cy = pad.y + pad.h / 2;
        expect(edgeDistance(lv.field, cx, cy), `第 ${i + 1} 关的加速带跑到场外了`).toBeGreaterThan(0);
        expect(hypot(pad.dx, pad.dy)).toBeCloseTo(1, 6);
        expect(pad.power).toBeGreaterThan(0);
      }
      for (const h of lv.hazards) {
        expect(edgeDistance(lv.field, h.x0, h.y0), `第 ${i + 1} 关的滚桶起点在场外`).toBeGreaterThan(0);
        expect(edgeDistance(lv.field, h.x1, h.y1), `第 ${i + 1} 关的滚桶终点在场外`).toBeGreaterThan(0);
        expect(h.r).toBeGreaterThan(1);
      }
    }
  });

  it("同一关生成两次结果完全一样(确定性)", () => {
    for (const i of [0, 37, 96, 143, 187]) {
      expect(JSON.stringify(buildLevel(i))).toBe(JSON.stringify(buildLevel(i)));
    }
  });

  it("越界的关号会被夹回 0..187", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(999).index).toBe(TOTAL_LEVELS - 1);
    expect(buildLevel(12.4).index).toBe(12);
  });

  it("对手数量在章节内只增不减", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const start = chapterStartLevel(ci);
      let prev = 0;
      for (let k = 0; k < CHAPTERS[ci].size; k++) {
        const n = buildLevel(start + k).foes.length;
        expect(n, `第 ${ci + 1} 章第 ${k + 1} 关对手变少了`).toBeGreaterThanOrEqual(prev);
        prev = n;
      }
    }
  });

  it("越往后越难:最后一章的对手比第一章多", () => {
    expect(buildLevel(187).foes.length).toBeGreaterThan(buildLevel(0).foes.length);
  });
});

describe("场地机关", () => {
  it("第一章两侧都有护栏,最后一章四面都是悬崖", () => {
    expect(springsFor(0, 0)).toEqual(["left", "right"]);
    expect(springsFor(7, 3)).toEqual([]);
  });

  it("第二章的护栏缺口每关换一边", () => {
    const gaps = [0, 1, 2, 3].map((k) => springsFor(1, k).length);
    expect(gaps.every((n) => n === 3)).toBe(true);
    expect(springsFor(1, 0)).not.toEqual(springsFor(1, 1));
  });

  it("圆台的护栏弧段是合法的圈数区间", () => {
    for (let k = 0; k < 8; k++) {
      const arcs = arcsFor(k, 0.6);
      for (const a of arcs) {
        expect(a.from).toBeGreaterThanOrEqual(0);
        expect(a.from).toBeLessThanOrEqual(1);
        expect(a.to).toBeGreaterThanOrEqual(0);
        expect(a.to).toBeLessThanOrEqual(1);
      }
      // 缺口一定存在:总有一个方向是没有护栏的
      const covered = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].filter((t) =>
        arcs.some((a) => inArc(a, t))
      );
      expect(covered.length).toBeLessThan(8);
    }
  });

  it("冰面章节的车滑得更远(阻尼更小)", () => {
    const ice = buildLevel(chapterStartLevel(5));
    const grass = buildLevel(0);
    expect(ice.keep).toBeGreaterThan(grass.keep);
  });

  it("有滚桶的章节真的摆了滚桶,而且是会动的", () => {
    const site = buildLevel(chapterStartLevel(4));
    expect(site.hazards.length).toBeGreaterThan(0);
    expect(site.hazards.some((h) => h.speed > 0)).toBe(true);
  });

  it("重量级对手只在中后段出现,而且要撞两次", () => {
    const heavyEarly = buildLevel(2).foes.some((f) => f.lives > 1);
    const heavyLate = buildLevel(187).foes.some((f) => f.lives > 1);
    expect(heavyEarly).toBe(false);
    expect(heavyLate).toBe(true);
  });

  it("ringPoints 把出生点均匀撒在一个圈上", () => {
    const pts = ringPoints(50, 50, 20, 4);
    expect(pts).toHaveLength(4);
    for (const p of pts) expect(hypot(p.x - 50, p.y - 50)).toBeCloseTo(20, 6);
  });
});

describe("对战场地", () => {
  it("五张图轮着来,同一局号永远是同一张", () => {
    const names = [1, 2, 3, 4, 5].map((r) => buildArena(r).name);
    expect(new Set(names).size).toBe(5);
    expect(buildArena(6).name).toBe(buildArena(1).name);
    expect(JSON.stringify(buildArena(3))).toBe(JSON.stringify(buildArena(3)));
  });

  it("两个出生点对称、都在场内,而且离得够远", () => {
    for (let r = 1; r <= 5; r++) {
      const arena = buildArena(r);
      expect(arena.spawns).toHaveLength(2);
      const [a, b] = arena.spawns;
      expect(edgeDistance(arena.field, a.x, a.y)).toBeGreaterThan(CAR_R * 2);
      expect(edgeDistance(arena.field, b.x, b.y)).toBeGreaterThan(CAR_R * 2);
      expect(hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(CAR_R * 6);
      expect(arena.seconds).toBeGreaterThan(30);
      expect(arena.hint.length).toBeGreaterThan(8);
    }
  });

  it("圆形对战场的护栏留了缺口,不然谁也撞不出去", () => {
    const round = [1, 2, 3, 4, 5].map(buildArena).filter((a) => a.field.shape === "round");
    expect(round.length).toBeGreaterThan(0);
    for (const arena of round) {
      expect(fieldRadius(arena.field)).toBeGreaterThan(20);
      const covered = [0, 0.2, 0.4, 0.6, 0.8].filter((t) => arena.field.arcs.some((a) => inArc(a, t)));
      expect(covered.length).toBeLessThan(5);
    }
  });
});

describe("无尽车海", () => {
  it("波次越高对手越多,最多七台", () => {
    let prev = 0;
    for (let w = 1; w <= 20; w++) {
      const n = waveFoeCount(w);
      expect(n).toBeGreaterThanOrEqual(prev);
      expect(n).toBeLessThanOrEqual(7);
      prev = n;
    }
    expect(waveFoeCount(1)).toBe(1);
    expect(waveFoeCount(30)).toBe(7);
  });

  it("波次越高电脑越强", () => {
    expect(waveSkill(1)).toBe(1);
    expect(waveSkill(4)).toBe(2);
    expect(waveSkill(9)).toBe(3);
  });

  it("每一波的场地都合法,而且玩家有三条命", () => {
    for (let w = 1; w <= 10; w++) {
      const lv = buildWave(w);
      expect(lv.foes.length).toBe(waveFoeCount(w));
      expect(lv.hearts).toBe(3);
      expect(lv.seconds).toBe(0);
      expect(edgeDistance(lv.field, lv.spawn.x, lv.spawn.y)).toBeGreaterThan(CAR_R * 2);
      for (const p of lv.foeSpawns) {
        expect(edgeDistance(lv.field, p.x, p.y)).toBeGreaterThan(CAR_R * 2);
      }
    }
  });

  it("波次越高护栏越短,场地越危险", () => {
    const early = buildWave(1).field.arcs[0];
    const late = buildWave(7).field.arcs[0];
    expect(late.to - late.from).toBeLessThan(early.to - early.from);
  });
});
