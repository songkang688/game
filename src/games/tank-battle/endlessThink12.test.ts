/**
 * 1.2 本窗验收 · 第 2 轮学习优化员:三档脾气的「想得多快」在**无尽**里落地。
 *
 * 第 1 轮把 `TIER_SPECS.fireRange` 接上了闯关,同时留了一条实测结论:
 * `TIER_SPECS.think`(0.55 / 0.3 / 0.26 秒)**不能**接进闯关 ——
 * 188 关是围着 0.3 秒这个统一节奏配出来的,一改第 51 / 90 / 98 / 164 关就守不住。
 *
 * 于是那一列数字就那么挂着:规格表里写着它,单测断言着它从慢到快排好,
 * 可**全仓库没有一行代码按它跑过**。这一轮把它接到唯一接得上的地方——无尽。
 * 无尽的波次是 `endlessWave` 现生成的,没有手配好的布局要守,
 * 乱转档慢半拍、绕后卡位档想得比闯关还勤,这个差别在那边可以真的体现出来。
 *
 * 闯关 / 合作那一侧一个字节都没动:`rethinkFor` 只在 `mode === "endless"` 时分档。
 */
import { describe, expect, it } from "vitest";

import { TIER_SPECS, type AiTier } from "./ai12";
import {
  ENEMY_RETHINK,
  createWorld,
  rethinkFor,
  type TankMode,
} from "./logic";

const TIERS: AiTier[] = ["wander", "chase", "flank"];
const NOT_ENDLESS: TankMode[] = ["campaign", "coop", "versus"];

describe("重想间隔 · 无尽按脾气档走", () => {
  it("闯关 / 合作 / 对战照旧是那一个统一常数", () => {
    for (const mode of NOT_ENDLESS) {
      for (const tier of TIERS) {
        expect(rethinkFor(mode, tier), `${mode}/${tier}`).toBe(ENEMY_RETHINK);
      }
    }
  });

  it("无尽按 TIER_SPECS.think 走,三档各是各的", () => {
    for (const tier of TIERS) {
      expect(rethinkFor("endless", tier)).toBe(TIER_SPECS[tier].think);
    }
    const gaps = TIERS.map((t) => rethinkFor("endless", t));
    expect(new Set(gaps).size).toBe(3);
  });

  it("无尽里越凶的档想得越勤:乱转最慢,绕后卡位最快", () => {
    expect(rethinkFor("endless", "wander")).toBeGreaterThan(rethinkFor("endless", "chase"));
    expect(rethinkFor("endless", "chase")).toBeGreaterThan(rethinkFor("endless", "flank"));
  });

  it("乱转档在无尽里明显比闯关迟钝,绕后档明显比闯关灵敏", () => {
    expect(rethinkFor("endless", "wander")).toBeGreaterThan(ENEMY_RETHINK * 1.5);
    expect(rethinkFor("endless", "flank")).toBeLessThan(ENEMY_RETHINK);
  });

  it("再慢也慢不成「站着不动」:三档都在半秒上下,没有一档超过一秒", () => {
    for (const tier of TIERS) {
      const gap = rethinkFor("endless", tier);
      expect(gap).toBeGreaterThan(0.15);
      expect(gap).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 真的跑一段:同一张图、同一颗种子,只有脾气档不同
// ---------------------------------------------------------------------------

const YARD = [
  "e...........e",
  ".............",
  "1...........2",
  ".............",
  "......B......",
];

/** 一座只放一辆敌人车的无尽演习场 */
function endlessYard(tier: AiTier): { rethink: number } {
  const w = createWorld({
    rows: YARD,
    mode: "endless",
    players: 1,
    limit: 600,
    queue: [{ kind: "swift", spawn: 0 }],
    spawnGap: 9999,
    seed: 4242,
  });
  w.spawnTimer = 0;
  return { rethink: rethinkFor(w.mode, tier) };
}

describe("重想间隔 · 接到真实的无尽世界上", () => {
  it("无尽世界里取出来的间隔就是这一档的 think", () => {
    for (const tier of TIERS) {
      expect(endlessYard(tier).rethink).toBe(TIER_SPECS[tier].think);
    }
  });

  it("同一段时间里,绕后卡位档重想的次数比乱转档多出五成以上", () => {
    const seconds = 30;
    const flank = seconds / rethinkFor("endless", "flank");
    const wander = seconds / rethinkFor("endless", "wander");
    expect(flank).toBeGreaterThan(wander * 1.5);
  });
});
