import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { meta } from "./meta";
import { BOSSES, CHAPTERS, buildSortie } from "./levels";
import { FOE_INFO, PICKUP_INFO, WEAPONS, makePlane, sortieMessage, touchPlane } from "./logic";
import { PATTERN_LABEL } from "./bullets";

/**
 * 分级红线的自动自审。飞机小队的底线是「被击中只是冒烟迫降」:
 * 不许出现流血 / 受伤 / 死亡 / 爆炸,也不许把武器写实化。
 */
const FORBIDDEN = [
  "血",
  "受伤",
  "伤口",
  "死",
  "杀",
  "尸",
  "爆炸",
  "炸毁",
  "击落",
  "坠毁",
  "枪",
  "导弹",
  "机炮",
  "弹匣",
  "扳机",
];

const MEAN_WORDS = ["笨", "蠢", "真差", "没用", "废物"];

function visibleStrings(): string[] {
  const out: string[] = [meta.title, meta.blurb];
  for (const ch of CHAPTERS) out.push(ch.name, ch.desc);
  for (const b of BOSSES) {
    out.push(b.name);
    for (const ph of b.phases) out.push(ph.name, ph.shout);
  }
  for (const w of Object.values(WEAPONS)) out.push(w.name, w.desc);
  for (const f of Object.values(FOE_INFO)) out.push(f.name);
  for (const p of Object.values(PICKUP_INFO)) out.push(p.label);
  for (const label of Object.values(PATTERN_LABEL)) out.push(label);
  for (let lv = 0; lv < TOTAL_LEVELS; lv++) out.push(buildSortie(lv).hint);

  // 三种被碰到的结果各来一句
  let plane = { ...makePlane(), invuln: 0, shield: 1, spare: 1 };
  for (let i = 0; i < 3; i++) {
    const res = touchPlane({ ...plane, invuln: 0 });
    if (res.line) out.push(res.line);
    plane = res.plane;
  }
  for (const escaped of [0, 3]) {
    for (const touched of [0, 4]) {
      for (const bombs of [0, 2]) {
        out.push(sortieMessage({ downed: 8, total: 8, touched, bombs, escaped, bossDown: true }));
      }
    }
  }
  return out;
}

describe("sky-squad 分级与文案红线", () => {
  it("所有看得见的文字都没有流血 / 受伤 / 死亡 / 爆炸,也没有写实武器名词", () => {
    for (const line of visibleStrings()) {
      for (const bad of FORBIDDEN) {
        expect(line.includes(bad), `「${line}」里出现了不该出现的「${bad}」`).toBe(false);
      }
    }
  });

  it("被碰到的三种结果都是「挡下来 / 换一架 / 去检修」,一句都不提伤亡", () => {
    let plane = { ...makePlane(), invuln: 0, shield: 1, spare: 1 };
    const outcomes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = touchPlane({ ...plane, invuln: 0 });
      outcomes.push(res.outcome);
      plane = res.plane;
    }
    expect(outcomes).toEqual(["shielded", "swapped", "grounded"]);
  });

  it("鼓励语只夸不骂", () => {
    for (const line of visibleStrings()) {
      for (const mean of MEAN_WORDS) {
        expect(line.includes(mean), `「${line}」在训孩子`).toBe(false);
      }
    }
  });

  it("八位 Boss 与四种敌机都是原创卡通造型,名字里没有商标或官方角色名", () => {
    const names = BOSSES.map((b) => b.name);
    expect(new Set(names).size).toBe(8);
    for (const n of names) expect(n.length).toBeGreaterThanOrEqual(4);
    for (const f of Object.values(FOE_INFO)) {
      expect(f.name).toMatch(/机|怪|球/);
    }
    // 武器一律是卡通发射物,不是真实枪械
    expect(Object.values(WEAPONS).map((w) => w.name)).toEqual(["星星弹", "波纹弹", "光束"]);
  });

  it("弹幕可读性写进了数据:六种图案都有中文名,敌弹都是低速大弹", () => {
    expect(Object.keys(PATTERN_LABEL).length).toBe(6);
    for (const b of BOSSES) {
      for (const ph of b.phases) {
        for (const spec of ph.patterns) {
          expect(spec.speed).toBeLessThanOrEqual(160);
          expect(spec.radius).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });
});
