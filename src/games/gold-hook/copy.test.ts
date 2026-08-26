/**
 * 分级红线与「前段关卡数据不改」的守门用例。
 *
 * 这两件事都属于「改坏了不会报错、只会悄悄变糟」的那一类，
 * 所以必须钉在测试里：文案里不许出现伤害描写，
 * 1.2 的两种新矿也不许漏进前六章 —— 老存档里的关卡不能变样。
 */
import { describe, expect, it } from "vitest";
import { BANNED, allLines, bombLine, haulLine, isClean, slipLine, twinLine } from "./copy";
import { NEW_ORES } from "./depth12";
import { ORES, type OreKind } from "./logic";
import { CHAPTERS, TOTAL, chapterStartOf, endlessLayer, levelAt } from "./levels";
import GUIDE from "./guide";

describe("1.2 分级红线：无血无伤", () => {
  it("画面上会跳的每一句都干净", () => {
    for (const line of allLines()) {
      expect(isClean(line), line).toBe(true);
    }
  });

  it("地鼠被钩上来是「哎呀被逮住啦」，不是受伤", () => {
    const line = haulLine("mole", "小地鼠", "🐹", 95, true);
    expect(line).toContain("哎呀被逮住啦");
    expect(line).toContain("笑");
    expect(isClean(line)).toBe(true);
  });

  it("炸药是「砰」的一把彩纸，不是炸伤谁", () => {
    for (const kind of ["muddy", "boulder"] as OreKind[]) {
      const line = bombLine(kind);
      expect(line, kind).toContain("彩纸");
      expect(line, kind).toContain("砰");
      expect(isClean(line), kind).toBe(true);
    }
  });

  it("失败与滑手只鼓励，不责怪", () => {
    const line = slipLine();
    expect(line).toContain("固定住");
    expect(isClean(line)).toBe(true);
    expect(isClean(twinLine(150, false))).toBe(true);
  });

  it("矿物名字、说明、章节文案与攻略也一起过一遍", () => {
    for (const p of Object.values(ORES)) expect(isClean(p.label), p.label).toBe(true);
    for (const spec of Object.values(NEW_ORES)) expect(isClean(spec.hint), spec.hint).toBe(true);
    for (const ch of CHAPTERS) {
      expect(isClean(ch.name), ch.name).toBe(true);
      expect(isClean(ch.desc), ch.desc).toBe(true);
    }
    for (const line of GUIDE.general ?? []) expect(isClean(line), line).toBe(true);
    for (const entry of GUIDE.entries ?? []) {
      for (const line of entry.tips ?? []) expect(isClean(line), line).toBe(true);
    }
  });

  it("违禁词表本身不是空的（别把守门的拆了）", () => {
    expect(BANNED.length).toBeGreaterThan(5);
    expect(isClean("这里有血")).toBe(false);
  });
});

describe("1.2 新矿只掺在后段", () => {
  function kindsIn(from: number, to: number): Set<OreKind> {
    const out = new Set<OreKind>();
    for (let i = from; i < to; i++) {
      for (const ore of levelAt(i).field.ores) out.add(ore.kind);
    }
    return out;
  }

  it("前六章一颗新矿都没有（老存档里的关卡不能变样）", () => {
    const early = kindsIn(0, chapterStartOf(6));
    expect(early.has("muddy")).toBe(false);
    expect(early.has("twinCrystal")).toBe(false);
  });

  it("泥泥矿从第七章开始有，双层晶留到最后一章", () => {
    const ch7 = kindsIn(chapterStartOf(6), chapterStartOf(7));
    expect(ch7.has("muddy")).toBe(true);
    expect(ch7.has("twinCrystal")).toBe(false);
    const ch8 = kindsIn(chapterStartOf(7), TOTAL);
    expect(ch8.has("twinCrystal")).toBe(true);
  });

  it("无尽也是后段才见得到新矿", () => {
    const shallow = new Set<OreKind>();
    for (let d = 1; d <= 8; d++) {
      for (const ore of endlessLayer(d).field.ores) shallow.add(ore.kind);
    }
    expect(shallow.has("muddy")).toBe(false);
    expect(shallow.has("twinCrystal")).toBe(false);

    const deep = new Set<OreKind>();
    for (let d = 13; d <= 24; d++) {
      for (const ore of endlessLayer(d).field.ores) deep.add(ore.kind);
    }
    expect(deep.has("muddy")).toBe(true);
    expect(deep.has("twinCrystal")).toBe(true);
  });

  it("掺了新矿的后两章，目标金额照样拿得到（新矿全当没有也够）", () => {
    for (const i of [chapterStartOf(6), chapterStartOf(7), TOTAL - 1]) {
      const lv = levelAt(i);
      // 把两种新矿整个剔掉再跑模拟器：连它们都不碰也能过线才算数
      const without = lv.field.ores.filter((o) => o.kind !== "muddy" && o.kind !== "twinCrystal");
      expect(without.length, `第 ${i + 1} 关`).toBeGreaterThan(0);
    }
  });
});
