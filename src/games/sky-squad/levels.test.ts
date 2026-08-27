import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import { SKY_W, findDodgePath } from "./bullets";
import { BOSSES, CHAPTERS, bossLevelOf, buildEndlessWave, buildSortie, formationSlot, isBossLevel } from "./levels";
import { FOE_INFO } from "./logic";

describe("sky-squad 188 关战役", () => {
  it("八个章节加起来正好 188 关", () => {
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "sky-squad")).toBe(true);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(CHAPTERS.every((c) => c.size > 0 && c.desc.length > 0)).toBe(true);
  });

  it("每一章的最后一关是那一章的大 Boss,八章八位不重样", () => {
    expect(BOSSES.length).toBe(CHAPTERS.length);
    const ids = new Set(BOSSES.map((b) => b.id));
    expect(ids.size).toBe(8);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const lv = bossLevelOf(ci);
      expect(isBossLevel(lv)).toBe(true);
      expect(isBossLevel(lv - 1)).toBe(false);
      const def = buildSortie(lv);
      expect(def.boss?.id).toBe(BOSSES[ci].id);
      expect(def.chapter).toBe(ci);
    }
  });

  it("每位 Boss 都是三阶段,血量一章比一章厚", () => {
    for (let i = 0; i < BOSSES.length; i++) {
      const boss = BOSSES[i];
      expect(boss.phases.length).toBe(3);
      expect(boss.phases[2].until).toBe(0);
      expect(boss.phases[0].until).toBeGreaterThan(boss.phases[1].until);
      for (const ph of boss.phases) {
        expect(ph.patterns.length).toBeGreaterThanOrEqual(1);
        // 1.2 起后几章的收尾阶段允许三套弹幕叠着来(仍然逐段验过可躲避性)
        expect(ph.patterns.length).toBeLessThanOrEqual(3);
        expect(ph.shout.length).toBeGreaterThan(4);
      }
      if (i > 0) expect(boss.hp).toBeGreaterThan(BOSSES[i - 1].hp);
    }
  });

  it("Boss 关的三段弹幕逐段都躲得掉(每章都验一遍)", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const def = buildSortie(bossLevelOf(ci));
      expect(def.boss).not.toBeNull();
      for (const ph of def.boss?.phases ?? []) {
        const report = findDodgePath(ph, { duration: 12 });
        expect(report.ok, `第 ${ci + 1} 章「${ph.name}」躲不掉`).toBe(true);
      }
    }
  });

  it("每一关都能生成,敌机种类合法、波次数量合理", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const def = buildSortie(lv);
      expect(def.level).toBe(lv);
      expect(def.chapter).toBe(chapterOf(CHAPTERS, lv));
      expect(def.waves.length).toBeGreaterThanOrEqual(1);
      expect(def.waves.length).toBeLessThanOrEqual(4);
      for (const w of def.waves) {
        expect(w.kinds.length).toBe(w.count);
        for (const k of w.kinds) expect(FOE_INFO[k]).toBeDefined();
        expect(w.fire.speed).toBeLessThanOrEqual(160);
        expect(w.fire.radius).toBeGreaterThanOrEqual(10);
        expect(w.fireGap).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("普通关的敌机弹幕同样躲得掉(抽查每章几关)", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 11) {
      const def = buildSortie(lv);
      if (def.boss) continue;
      for (const w of def.waves) {
        const report = findDodgePath(
          { name: "小队弹幕", until: 0, swing: 60, color: "#eee", shout: "", patterns: [w.fire] },
          { duration: 10 }
        );
        expect(report.ok, `第 ${lv + 1} 关的敌机弹幕躲不掉`).toBe(true);
      }
    }
  });

  it("同一关重复生成结果完全一致(确定性随机)", () => {
    for (const lv of [0, 23, 71, 140, 187]) {
      expect(JSON.stringify(buildSortie(lv))).toBe(JSON.stringify(buildSortie(lv)));
    }
  });

  it("敌机种类随章节解锁,第一章不会一上来就丢大肚运输机", () => {
    const kindsIn = (from: number, to: number): Set<string> => {
      const out = new Set<string>();
      for (let lv = from; lv < to; lv++) {
        for (const w of buildSortie(lv).waves) for (const k of w.kinds) out.add(k);
      }
      return out;
    };
    expect(kindsIn(0, 12).has("tanker")).toBe(false);
    expect(kindsIn(0, 12).has("kite")).toBe(false);
    expect(kindsIn(96, 120).has("tanker")).toBe(true);
  });

  it("Boss 关一定给护盾,免得卡在最后一关反复重来", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      expect(buildSortie(bossLevelOf(ci)).pickups).toContain("shield");
    }
  });

  it("难度往上走:后期敌机更多、开火更密", () => {
    const foesOf = (lv: number): number => buildSortie(lv).waves.reduce((s, w) => s + w.count, 0);
    const gapOf = (lv: number): number => buildSortie(lv).waves[0].fireGap;
    expect(foesOf(180)).toBeGreaterThan(foesOf(1));
    expect(gapOf(180)).toBeLessThan(gapOf(1));
  });

  it("四种编队都把飞机摆在画面上方、横向不出界", () => {
    for (const f of ["line", "vee", "arc", "column"] as const) {
      for (let i = 0; i < 8; i++) {
        const slot = formationSlot(f, i, 8, SKY_W);
        expect(slot.y).toBeLessThan(0);
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.x).toBeLessThan(SKY_W);
      }
    }
  });

  it("无尽波次的编队与弹幕也确定且合法", () => {
    const a = buildEndlessWave(6, ["scout", "puff"], 7, 1.3);
    const b = buildEndlessWave(6, ["scout", "puff"], 7, 1.3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.count).toBe(7);
    expect(a.kinds.length).toBe(7);
    expect(a.fire.speed).toBeLessThanOrEqual(160);
  });
});
