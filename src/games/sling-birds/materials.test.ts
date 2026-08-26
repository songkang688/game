/**
 * 1.2 第 12 步 A 档新增:材质硬度表与连锁倒塌的纯函数。
 */
import { describe, expect, it } from "vitest";
import {
  CHAIN_MIN_SPEED,
  LAND_MIN_SPEED,
  MAT,
  breakSound,
  chainDamage,
  hardnessRank,
  landingDamage,
  shatterShards,
  toppleBoost
} from "./materials";
import type { BlockKind } from "./levels";

const KINDS: BlockKind[] = ["wood", "stone", "ice", "glass", "tnt", "shell", "core"];

describe("sling-birds 1.2 材质硬度表", () => {
  it("石头最硬、木头居中、冰块最脆(硬度与易碎系数方向相反)", () => {
    expect(MAT.stone.hp).toBeGreaterThan(MAT.wood.hp);
    expect(MAT.wood.hp).toBeGreaterThan(MAT.ice.hp);
    expect(MAT.ice.vuln).toBeGreaterThan(MAT.wood.vuln);
    expect(MAT.wood.vuln).toBeGreaterThan(MAT.stone.vuln);
  });

  it("硬度名次从软到硬排,玻璃最软、石头最硬", () => {
    expect(hardnessRank("glass")).toBeLessThan(hardnessRank("ice"));
    expect(hardnessRank("ice")).toBeLessThan(hardnessRank("wood"));
    expect(hardnessRank("wood")).toBeLessThan(hardnessRank("stone"));
  });

  it("每种材质都填齐了硬度 / 碎片 / 音效 / 摩擦", () => {
    for (const k of KINDS) {
      expect(MAT[k].hp, k).toBeGreaterThan(0);
      expect(MAT[k].shards, k).toBeGreaterThanOrEqual(10);
      expect(["pop", "tap", "oops"], k).toContain(MAT[k].sound);
      expect(MAT[k].friction, k).toBeGreaterThan(0);
    }
  });

  it("石头几乎推不动,冰面滑得最远(摩擦最小)", () => {
    expect(MAT.stone.push).toBeLessThan(MAT.wood.push);
    expect(MAT.ice.friction).toBeLessThan(MAT.wood.friction);
  });

  it("脆材质碎得更响亮:冰和玻璃用 pop,木头用 tap", () => {
    expect(breakSound("ice")).toBe("pop");
    expect(breakSound("glass")).toBe("pop");
    expect(breakSound("wood")).toBe("tap");
  });

  it("碎片数按画质缩放,再省也至少留 3 片(reduced-motion 也看得出碎了)", () => {
    expect(shatterShards("glass")).toBe(MAT.glass.shards);
    expect(shatterShards("glass", 0.35)).toBeLessThan(MAT.glass.shards);
    expect(shatterShards("glass", 0)).toBe(3);
    expect(shatterShards("wood", 0.01)).toBeGreaterThanOrEqual(3);
  });
});

describe("sling-birds 1.2 连锁倒塌传伤", () => {
  it("慢慢靠上去不掉血,砸下来才掉血", () => {
    expect(chainDamage(0, 1)).toBe(0);
    expect(chainDamage(CHAIN_MIN_SPEED, 1)).toBe(0);
    expect(chainDamage(CHAIN_MIN_SPEED + 100, 1)).toBeGreaterThan(0);
  });

  it("砸得越快越疼,脆材质更吃亏", () => {
    expect(chainDamage(400, 1)).toBeGreaterThan(chainDamage(300, 1));
    expect(chainDamage(400, MAT.ice.vuln)).toBeGreaterThan(chainDamage(400, MAT.stone.vuln));
  });

  it("门槛比 1.1 的 260 低,三层塔塌下来足以压碎下面的木头", () => {
    expect(CHAIN_MIN_SPEED).toBeLessThan(260);
    // 自由落体 1.5 格砖(约 66px)大约 246px/s,要能真的传伤
    const fall = Math.sqrt(2 * 460 * 66);
    expect(chainDamage(fall, MAT.wood.vuln)).toBeGreaterThan(0);
  });

  it("落地伤害:轻轻落地不掉血,摔狠了才碎", () => {
    expect(landingDamage(LAND_MIN_SPEED - 1, 1)).toBe(0);
    expect(landingDamage(LAND_MIN_SPEED + 200, 1)).toBeGreaterThan(0);
    expect(landingDamage(500, MAT.glass.vuln)).toBeGreaterThan(landingDamage(500, MAT.stone.vuln));
  });

  it("细高柱子更容易被撞倒,方方正正的块没有加成", () => {
    expect(toppleBoost(26, 26)).toBe(1);
    expect(toppleBoost(14, 61)).toBeGreaterThan(1);
    expect(toppleBoost(14, 61)).toBeGreaterThan(toppleBoost(14, 30));
    expect(toppleBoost(14, 999)).toBeLessThanOrEqual(1.9);
    expect(toppleBoost(0, 0)).toBe(1);
  });
});
