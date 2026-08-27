/**
 * 关卡元素规范表的用例(1.2 核心交付)。
 *
 * 这里管两件事:
 *  1. 表本身自洽 —— 六个含义角色的**形状两两不同、描边色两两不同**,
 *     只有「可踩」有亮顶边、只有「奖励」会发光;
 *  2. 表**盖得住全 188 关**:遍历每一关真实摆出来的每一种元素,
 *     都能查到规范条目,一个漏网的都没有。加了新机关忘了登记,这里当场红。
 */
import { describe, expect, it } from "vitest";

import {
  ELEMENT_KINDS,
  ELEMENT_ROLES,
  ELEMENT_ROLE_OF,
  ELEMENT_SPECS,
  elementsInLevel,
  enemyElementKind,
  legendLines,
  specFor,
  specOfRole,
  type ElementKind,
} from "./elements";
import { ELEMENT_TABLE, elementTableTips } from "./guide";
import GUIDE from "./guide";
import { allLevels, buildEndless, TOTAL } from "./levels";

const LEVELS = allLevels();

describe("元素规范表 · 表本身", () => {
  it("六个含义角色都在,顺序固定", () => {
    expect(ELEMENT_ROLES).toEqual(["hazard", "stand", "push", "reward", "exit", "checkpoint"]);
    for (const role of ELEMENT_ROLES) {
      const spec = ELEMENT_SPECS[role];
      expect(spec.role).toBe(role);
      expect(spec.label.length).toBeGreaterThan(1);
      expect(spec.rule.length).toBeGreaterThan(8);
      expect(spec.icon.length).toBeGreaterThan(0);
      expect(spec.strokeWidth).toBeGreaterThanOrEqual(2);
      expect(spec.fill).toMatch(/^#[0-9A-F]{6}$/i);
      expect(spec.stroke).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("形状两两不同、描边色两两不同 —— 看不清颜色也认得出轮廓", () => {
    const shapes = ELEMENT_ROLES.map((r) => ELEMENT_SPECS[r].shape);
    const strokes = ELEMENT_ROLES.map((r) => ELEMENT_SPECS[r].stroke);
    const fills = ELEMENT_ROLES.map((r) => ELEMENT_SPECS[r].fill);
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(new Set(strokes).size).toBe(strokes.length);
    expect(new Set(fills).size).toBe(fills.length);
  });

  it("只有「可踩」有亮顶边,只有「奖励」会发光", () => {
    for (const role of ELEMENT_ROLES) {
      const spec = ELEMENT_SPECS[role];
      expect(Boolean(spec.topLight)).toBe(role === "stand");
      expect(Boolean(spec.glow)).toBe(role === "reward");
    }
  });

  it("每一种具体元素都登记了含义角色,查得到规范", () => {
    expect(ELEMENT_KINDS.length).toBeGreaterThanOrEqual(16);
    for (const kind of ELEMENT_KINDS) {
      const spec = specFor(kind);
      expect(ELEMENT_ROLES).toContain(spec.role);
      expect(spec).toBe(specOfRole(ELEMENT_ROLE_OF[kind]));
    }
  });

  it("五种小怪都映射到「危险」,宝石是「奖励」,城门是「出口」", () => {
    for (const k of ["slime", "bat", "armor", "ghost", "turret"]) {
      expect(specFor(enemyElementKind(k)).role).toBe("hazard");
    }
    expect(specFor("gem").role).toBe("reward");
    expect(specFor("door").role).toBe("exit");
    expect(specFor("heavyBlock").role).toBe("push");
    expect(specFor("checkpointFlag").role).toBe("checkpoint");
  });
});

describe("元素规范表 · 盖得住全 188 关", () => {
  it("188 关里出现过的每一种元素都有规范条目", () => {
    const seen = new Set<ElementKind>();
    for (const def of LEVELS) for (const kind of elementsInLevel(def)) seen.add(kind);
    expect(seen.size).toBeGreaterThan(0);
    for (const kind of seen) {
      expect(ELEMENT_ROLE_OF[kind], `${kind} 没登记`).toBeDefined();
      expect(specFor(kind).shape.length).toBeGreaterThan(0);
    }
  });

  it("登记表里没有一条是「摆了却从没出现过」的死条目", () => {
    const seen = new Set<ElementKind>();
    for (const def of LEVELS) for (const kind of elementsInLevel(def)) seen.add(kind);
    for (let r = 0; r < 12; r++) for (const kind of elementsInLevel(buildEndless(r))) seen.add(kind);
    const dead = ELEMENT_KINDS.filter((k) => !seen.has(k));
    expect(dead).toEqual([]);
  });

  it("每一关至少认得出「能站」「奖励」「出口」「休息点」四样", () => {
    for (const def of LEVELS) {
      const roles = new Set(elementsInLevel(def).map((k) => ELEMENT_ROLE_OF[k]));
      expect(roles.has("stand"), `#${def.index + 1}`).toBe(true);
      expect(roles.has("reward"), `#${def.index + 1}`).toBe(true);
      expect(roles.has("exit"), `#${def.index + 1}`).toBe(true);
      expect(roles.has("checkpoint"), `#${def.index + 1}`).toBe(true);
    }
  });

  it("重箱子只在第 100 关起出现 —— 前 99 关碰撞数据不许动", () => {
    for (let lv = 0; lv < 99; lv++) {
      expect(LEVELS[lv].blocks, `#${lv + 1}`).toEqual([]);
      expect(elementsInLevel(LEVELS[lv])).not.toContain("heavyBlock");
    }
    const later = LEVELS.slice(99).filter((d) => d.blocks.length > 0);
    expect(later.length).toBeGreaterThan(5);
  });
});

describe("元素规范表 · 写进了攻略", () => {
  it("攻略里有一条覆盖全 188 关的规范表词条", () => {
    const entry = GUIDE.entries.find((e) => e.title.includes("关卡元素规范表"));
    expect(entry).toBeDefined();
    expect(entry!.from).toBe(1);
    expect(entry!.to).toBe(TOTAL);
    for (const role of ELEMENT_ROLES) {
      const spec = ELEMENT_SPECS[role];
      expect(entry!.tips.some((t) => t.includes(spec.label))).toBe(true);
    }
  });

  it("攻略里的图例和渲染层用的是同一张表", () => {
    expect(ELEMENT_TABLE.map((e) => e.role)).toEqual(ELEMENT_ROLES);
    expect(legendLines()).toHaveLength(ELEMENT_ROLES.length);
    for (const line of elementTableTips()) expect(line.length).toBeLessThanOrEqual(46);
  });

  it("攻略正文里没有任何死伤字眼", () => {
    const all = [...GUIDE.general, ...GUIDE.entries.flatMap((e) => [e.title, ...e.tips])].join("");
    for (const word of ["死", "杀", "血腥", "失败"]) expect(all).not.toContain(word);
  });
});
