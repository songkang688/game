import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_LABELS,
  CHARACTERS,
  CHARACTER_IDS,
  METER_MAX,
  MOVE_SLOTS,
  NORMAL_SLOTS,
  SLOT_LABELS,
  SUPER_LV1_COST,
  SUPER_LV2_COST,
  characterById,
  charactersOf,
  totalFrames,
  type Archetype
} from "./frames";

describe("combo-clash · 角色与帧数据", () => {
  it("十位原创角色齐了,id 不重复", () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CHARACTER_IDS).size).toBe(CHARACTER_IDS.length);
  });

  it("体术 / 投射 / 抓投 / 蓄力四种打法都有人", () => {
    for (const a of ["rush", "zoner", "grappler", "charge"] as Archetype[]) {
      expect(charactersOf(a).length, `${ARCHETYPE_LABELS[a]}一个人都没有`).toBeGreaterThanOrEqual(2);
    }
  });

  it("每个人 12 个招式槽一个不缺,槽位名对得上", () => {
    for (const c of CHARACTERS) {
      for (const slot of MOVE_SLOTS) {
        const mv = c.moves[slot];
        expect(mv, `${c.name} 缺 ${slot}`).toBeTruthy();
        expect(mv.slot).toBe(slot);
        expect(SLOT_LABELS[slot].length).toBeGreaterThan(0);
      }
    }
  });

  it("每一招都是正经的三段帧:起手、命中、收招都大于 0", () => {
    for (const c of CHARACTERS) {
      for (const slot of MOVE_SLOTS) {
        const mv = c.moves[slot];
        expect(mv.startup, `${c.name}/${slot} 起手帧`).toBeGreaterThan(0);
        expect(mv.active, `${c.name}/${slot} 命中帧`).toBeGreaterThan(0);
        expect(mv.recovery, `${c.name}/${slot} 收招帧`).toBeGreaterThan(0);
        expect(totalFrames(mv)).toBe(mv.startup + mv.active + mv.recovery);
      }
    }
  });

  it("普通招都有取消窗口,投技没有(投中就是投中,接不下去)", () => {
    for (const c of CHARACTERS) {
      for (const slot of NORMAL_SLOTS) {
        const mv = c.moves[slot];
        if (slot === "throw" || slot === "airThrow") expect(mv.cancelLag).toBe(0);
        else expect(mv.cancelLag, `${c.name}/${slot} 应该有取消窗口`).toBeGreaterThan(0);
      }
      expect(c.moves.s1.cancelLag).toBeGreaterThan(0);
      expect(c.moves.sv1.cancelLag).toBe(0);
      expect(c.moves.sv2.cancelLag).toBe(0);
    }
  });

  it("上中下段分工正确:空中招是上段,蹲招是下段", () => {
    for (const c of CHARACTERS) {
      expect(c.moves.jL.height).toBe("high");
      expect(c.moves.jH.height).toBe("high");
      expect(c.moves["2L"].height).toBe("low");
      expect(c.moves["2H"].height).toBe("low");
      expect(c.moves["5L"].height).toBe("mid");
      expect(c.moves.throw.height).toBe("throw");
    }
  });

  it("超必:LV1 要 50 槽,LV2 要 100 槽,而且都有无敌帧", () => {
    for (const c of CHARACTERS) {
      expect(c.moves.sv1.meterCost).toBe(SUPER_LV1_COST);
      expect(c.moves.sv2.meterCost).toBe(SUPER_LV2_COST);
      expect(c.moves.sv2.power).toBeGreaterThan(c.moves.sv1.power);
      for (const slot of ["sv1", "sv2"] as const) {
        const mv = c.moves[slot];
        expect(mv.invulnFrom, `${c.name}/${slot} 没写无敌起始帧`).toBeGreaterThanOrEqual(0);
        expect(mv.invulnTo ?? -1).toBeGreaterThan(mv.invulnFrom ?? 0);
      }
      expect(SUPER_LV2_COST).toBe(METER_MAX);
    }
  });

  it("重击比轻击慢、更重、收招更大", () => {
    for (const c of CHARACTERS) {
      expect(c.moves["5H"].startup).toBeGreaterThan(c.moves["5L"].startup);
      expect(c.moves["5H"].power).toBeGreaterThan(c.moves["5L"].power);
      expect(c.moves["5H"].recovery).toBeGreaterThan(c.moves["5L"].recovery);
    }
  });

  it("抓投型的投技比体术型重,投射型的判定框比抓投型长", () => {
    const grap = charactersOf("grappler")[0];
    const rush = charactersOf("rush")[0];
    const zoner = charactersOf("zoner")[0];
    expect(grap.moves.throw.power).toBeGreaterThan(rush.moves.throw.power);
    expect(zoner.moves["5H"].box.w).toBeGreaterThan(grap.moves["5H"].box.w);
  });

  it("至少有一位会丢投射物,至少有一位有破防招", () => {
    expect(CHARACTERS.some((c) => c.moves.s1.projectile || c.moves.s2.projectile)).toBe(true);
    expect(CHARACTERS.some((c) => c.moves.s1.guardCrush || c.moves.s2.guardCrush)).toBe(true);
  });

  it("characterById 取不到也不会炸,退回第一位", () => {
    expect(characterById("duoduo").name).toBe("鸭梨");
    expect(characterById("谁啊").id).toBe(CHARACTERS[0].id);
  });

  it("三条槽的上限都是正数,元气各不相同(角色有胖有瘦)", () => {
    const vigors = new Set(CHARACTERS.map((c) => c.vigor));
    expect(vigors.size).toBeGreaterThanOrEqual(6);
    for (const c of CHARACTERS) {
      expect(c.vigor).toBeGreaterThan(0);
      expect(c.guardMax).toBeGreaterThan(0);
      expect(c.height).toBeGreaterThan(c.crouchHeight);
    }
  });

  it("招式名全是原创粉彩系,不带任何格斗商标或官方招式名", () => {
    const names = CHARACTERS.flatMap((c) => MOVE_SLOTS.map((s) => c.moves[s].name)).join("|");
    for (const bad of ["拳皇", "街霸", "波动", "升龙", "旋风腿", "必杀技·", "阿部"]) {
      expect(names.includes(bad), `招式名里出现了「${bad}」`).toBe(false);
    }
    expect(names).toContain("花瓣掌");
  });
});
