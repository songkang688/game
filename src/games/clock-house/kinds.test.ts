/**
 * 时钟小屋 1.2：题型分类与难度表巡检。
 *
 * 这一份盯的是「难度曲线是不是一张能读、能算的表」——
 * 区间要连续铺满 188 关、每一段权重加起来必须正好是 1、高段必须还在练经过时间与 24 小时制，
 * 以及前 99 关那三段写的是不是老代码真正产出的题型（写的和跑的不一样，这张表就成了摆设）。
 */
import { describe, expect, it } from "vitest";
import {
  ADVANCED_KINDS_BY_TYPE,
  CLOCK_TYPES,
  CLOCK_TYPE_NAMES,
  CORE_CLOCK_TYPES,
  DIFFICULTY_TABLE,
  KIND_TYPE,
  SENIOR_FROM,
  TABLE_DRIVEN_FROM,
  allocateSlots,
  bandOf,
  bandTypes,
  tableKinds,
  typeOfKind,
  type ClockKind,
  type ClockType,
} from "./kinds";
import { buildQuestions, legacyKindPool, questionCount, LEGACY_LEVELS } from "./levels";

const TOTAL = 188;
const LEGACY_KINDS: ClockKind[] = ["read", "set", "next"];

describe("时钟小屋 · 题型分类", () => {
  it("规格点名的 8 类题型一个不少，外加 1.1 留下来的日历共 9 类", () => {
    expect(CORE_CLOCK_TYPES).toEqual([
      "readFace",
      "setHands",
      "elapsed",
      "shiftTime",
      "convert1224",
      "unitConvert",
      "schedule",
      "timezone",
    ]);
    expect(CORE_CLOCK_TYPES).toHaveLength(8);
    expect(CLOCK_TYPES).toHaveLength(9);
    for (const t of CORE_CLOCK_TYPES) expect(CLOCK_TYPES).toContain(t);
    expect(CLOCK_TYPES).toContain("calendar");
    expect(new Set(CLOCK_TYPES).size).toBe(CLOCK_TYPES.length);
  });

  it("每一个题目种类都归了类，每一类都至少有一个种类撑着，而且都有中文名", () => {
    const covered = new Set<ClockType>();
    for (const [kind, type] of Object.entries(KIND_TYPE) as Array<[ClockKind, ClockType]>) {
      expect(CLOCK_TYPES, `${kind} 归到了不存在的题型`).toContain(type);
      expect(typeOfKind(kind)).toBe(type);
      covered.add(type);
    }
    expect([...covered].sort()).toEqual([...CLOCK_TYPES].sort());
    for (const t of CLOCK_TYPES) expect(CLOCK_TYPE_NAMES[t].length).toBeGreaterThan(1);
  });

  it("第 100 关往后可派的种类里，一个 1.0 老种类都没有（老形态是前 99 关专属）", () => {
    for (const type of CLOCK_TYPES) {
      const kinds = ADVANCED_KINDS_BY_TYPE[type];
      expect(kinds.length, `${type} 没有可派的种类`).toBeGreaterThan(0);
      for (const k of kinds) {
        expect(LEGACY_KINDS, `${type} 里混进了老种类 ${k}`).not.toContain(k);
        expect(typeOfKind(k), `${k} 挂错了题型`).toBe(type);
      }
    }
  });
});

describe("时钟小屋 · 关号 → 题型权重表", () => {
  it("八段区间首尾相接，正好铺满第 1–188 关，不重不漏", () => {
    expect(DIFFICULTY_TABLE.length).toBeGreaterThanOrEqual(8);
    expect(DIFFICULTY_TABLE[0].from).toBe(1);
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].to).toBe(TOTAL);
    for (let i = 0; i < DIFFICULTY_TABLE.length; i++) {
      const band = DIFFICULTY_TABLE[i];
      expect(band.from, `第 ${i + 1} 段区间反了`).toBeLessThanOrEqual(band.to);
      expect(band.title.length).toBeGreaterThan(2);
      if (i > 0) expect(band.from, `第 ${i + 1} 段和上一段没接上`).toBe(DIFFICULTY_TABLE[i - 1].to + 1);
    }
    for (let level = 1; level <= TOTAL; level++) {
      const band = bandOf(level);
      expect(level >= band.from && level <= band.to, `第 ${level} 关落不进任何一段`).toBe(true);
    }
  });

  it("每一段的题型权重之和正好是 1，而且每个权重都是正数", () => {
    for (const band of DIFFICULTY_TABLE) {
      const values = Object.entries(band.weights) as Array<[ClockType, number]>;
      expect(values.length, `${band.title} 一个题型都没列`).toBeGreaterThan(0);
      let sum = 0;
      for (const [type, w] of values) {
        expect(CLOCK_TYPES, `${band.title} 列了不存在的题型 ${type}`).toContain(type);
        expect(w, `${band.title} 的 ${type} 权重不是正数`).toBeGreaterThan(0);
        sum += w;
      }
      expect(sum, `${band.title} 的权重和是 ${sum}`).toBeCloseTo(1, 10);
    }
  });

  it("难度确实在往上走：入门段只读钟面，越往后花样越多", () => {
    expect(bandTypes(bandOf(1))).toEqual(["readFace"]);
    expect(bandTypes(bandOf(30))).toEqual(["readFace"]);
    const finale = bandTypes(bandOf(TOTAL));
    expect(finale.length, "最后一段应该是综合关").toBeGreaterThanOrEqual(6);
    expect(bandTypes(bandOf(110)).length).toBeGreaterThan(bandTypes(bandOf(20)).length);
  });

  it("高段（第 161 关往后）必须还在练经过时间与 24 小时制", () => {
    const senior = DIFFICULTY_TABLE.filter((b) => b.to >= SENIOR_FROM);
    expect(senior.length).toBeGreaterThanOrEqual(2);
    for (const band of senior) {
      expect(band.weights.elapsed, `${band.title} 少了经过时间`).toBeGreaterThan(0);
      expect(band.weights.convert1224, `${band.title} 少了 24 小时制`).toBeGreaterThan(0);
    }
    for (let level = SENIOR_FROM; level <= TOTAL; level++) {
      const w = bandOf(level).weights;
      expect((w.elapsed ?? 0) > 0 && (w.convert1224 ?? 0) > 0, `第 ${level} 关的那一段不达标`).toBe(true);
    }
  });

  it("六年级综合段真的什么都考：8 类核心题型至少覆盖 7 类", () => {
    const finale = new Set(bandTypes(bandOf(TOTAL)));
    const hit = CORE_CLOCK_TYPES.filter((t) => finale.has(t));
    expect(hit.length).toBeGreaterThanOrEqual(7);
  });
});

describe("时钟小屋 · 题位分配", () => {
  it("分出去的题位加起来正好是题量，一个都不多一个都不少", () => {
    for (const band of DIFFICULTY_TABLE) {
      for (let count = 1; count <= 12; count++) {
        for (let rotate = 0; rotate < 5; rotate++) {
          const alloc = allocateSlots(band, count, rotate);
          const sum = alloc.reduce((s, x) => s + x.slots, 0);
          expect(sum, `${band.title} 题量 ${count} 分出了 ${sum} 个题位`).toBe(count);
          for (const x of alloc) expect(x.slots).toBeGreaterThan(0);
        }
      }
    }
    expect(allocateSlots(DIFFICULTY_TABLE[0], 0)).toEqual([]);
  });

  it("权重最大的题型拿到的题位不会比别人少", () => {
    for (const band of DIFFICULTY_TABLE) {
      const alloc = allocateSlots(band, 10);
      if (alloc.length < 2) continue;
      const top = bandTypes(band)[0];
      const topSlots = alloc.find((x) => x.type === top)?.slots ?? 0;
      for (const x of alloc) expect(topSlots, `${band.title}: ${top} 反而比 ${x.type} 少`).toBeGreaterThanOrEqual(x.slots);
    }
  });

  it("余数题位按关号轮着给，权重小的题型不会被永远饿死", () => {
    const band = DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1];
    const seen = new Set<ClockType>();
    for (let rotate = 0; rotate < 12; rotate++) {
      for (const x of allocateSlots(band, 9, rotate)) seen.add(x.type);
    }
    expect(seen.size, "轮一圈下来这一段的题型应该都出得来").toBe(bandTypes(band).length);
  });

  it("tableKinds 排出来的种类数正好等于题量，而且都是第 100 关之后该有的种类", () => {
    for (let level = TABLE_DRIVEN_FROM - 1; level < TOTAL; level++) {
      const count = questionCount(level);
      const kinds = tableKinds(level, count);
      expect(kinds, `第 ${level + 1} 关`).toHaveLength(count);
      for (const k of kinds) {
        expect(LEGACY_KINDS, `第 ${level + 1} 关混进老种类 ${k}`).not.toContain(k);
        expect(ADVANCED_KINDS_BY_TYPE[typeOfKind(k)], `第 ${level + 1} 关的 ${k} 不该出现`).toContain(k);
      }
      // 同一关重排结果必须一致
      expect(tableKinds(level, count)).toEqual(kinds);
    }
  });
});

describe("时钟小屋 · 难度表和真正跑出来的题对得上", () => {
  it("前三段写的题型，就是前 99 关老代码真正产出的题型", () => {
    for (const band of DIFFICULTY_TABLE.filter((b) => b.to < TABLE_DRIVEN_FROM)) {
      const listed = new Set(bandTypes(band));
      const actual = new Set<ClockType>();
      for (let level = band.from - 1; level <= band.to - 1; level++) {
        for (const k of legacyKindPool(level)) actual.add(typeOfKind(k));
        for (const q of buildQuestions(level)) actual.add(typeOfKind(q.kind));
      }
      expect([...actual].sort(), `${band.title} 表里写的和真跑出来的不一样`).toEqual([...listed].sort());
    }
    expect(LEGACY_LEVELS).toBe(TABLE_DRIVEN_FROM - 1);
  });

  it("第 100 关往后，每一关真正出的题型都在这一段的权重表里", () => {
    for (let level = TABLE_DRIVEN_FROM - 1; level < TOTAL; level++) {
      const listed = new Set(bandTypes(bandOf(level + 1)));
      for (const q of buildQuestions(level)) {
        expect(listed.has(typeOfKind(q.kind)), `第 ${level + 1} 关出了表外的 ${q.kind}`).toBe(true);
      }
    }
  });

  it("188 关跑一遍，8 类核心题型每一类都真的出现过", () => {
    const seen = new Set<ClockType>();
    for (let level = 0; level < TOTAL; level++) {
      for (const q of buildQuestions(level)) seen.add(typeOfKind(q.kind));
    }
    for (const t of CORE_CLOCK_TYPES) expect(seen.has(t), `${CLOCK_TYPE_NAMES[t]} 一次都没出现`).toBe(true);
    expect(seen.has("calendar")).toBe(true);
  });
});
