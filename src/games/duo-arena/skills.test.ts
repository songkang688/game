import { describe, expect, it } from "vitest";
import {
  DASH_SPEED_SCALE,
  GRAB_ACTIVE,
  GRAB_BASE_RADIUS,
  GRAB_BURST_RADIUS,
  GRAB_RECOVER,
  GRAB_WINDUP,
  SKILLS,
  SKILL_ORDER,
  WAVE_PUSH,
  WAVE_SPIN_SECONDS,
  canCast,
  canGrab,
  castSkill,
  cooldownRatio,
  createSkillState,
  grabPhase,
  grabRadius,
  isProtected,
  isSkillActive,
  nextSkill,
  pushedPosition,
  skillPhase,
  tickSkills,
  waveJustFired,
} from "./skills";

describe("出手三段", () => {
  it("前摇 → 生效 → 后摇 → 回到待机,三段都看得见", () => {
    expect(grabPhase(null, 1)).toBe("idle");
    expect(grabPhase(0, 0.05)).toBe("windup");
    expect(grabPhase(0, GRAB_WINDUP + 0.01)).toBe("active");
    expect(grabPhase(0, GRAB_WINDUP + GRAB_ACTIVE + 0.01)).toBe("recover");
    expect(grabPhase(0, GRAB_WINDUP + GRAB_ACTIVE + GRAB_RECOVER + 0.01)).toBe("idle");
  });

  it("三段都有肉眼可辨的长度,合起来不到一秒", () => {
    for (const d of [GRAB_WINDUP, GRAB_ACTIVE, GRAB_RECOVER]) {
      expect(d).toBeGreaterThanOrEqual(0.1);
    }
    expect(GRAB_WINDUP + GRAB_ACTIVE + GRAB_RECOVER).toBeLessThan(1);
  });

  it("出手期间不能再出手 —— 无脑连点没有任何好处", () => {
    expect(canGrab(null, 0)).toBe(true);
    expect(canGrab(0, 0.05)).toBe(false);
    expect(canGrab(0, GRAB_WINDUP + 0.05)).toBe(false);
    expect(canGrab(0, GRAB_WINDUP + GRAB_ACTIVE + 0.05)).toBe(false);
    expect(canGrab(0, GRAB_WINDUP + GRAB_ACTIVE + GRAB_RECOVER + 0.001)).toBe(true);
  });

  it("只有生效那一段抓取范围才变大", () => {
    expect(grabRadius(null, 0)).toBe(GRAB_BASE_RADIUS);
    expect(grabRadius(0, 0.05)).toBe(GRAB_BASE_RADIUS);
    expect(grabRadius(0, GRAB_WINDUP + 0.05)).toBe(GRAB_BURST_RADIUS);
    expect(GRAB_BURST_RADIUS).toBeGreaterThan(GRAB_BASE_RADIUS);
  });
});

describe("三个温和技能", () => {
  it("就是加速、护盾泡、弹开波,一个都不多", () => {
    expect(SKILL_ORDER).toEqual(["dash", "shield", "wave"]);
    expect(SKILLS.dash.name).toBe("加速");
    expect(SKILLS.shield.name).toBe("护盾泡");
    expect(SKILLS.wave.name).toBe("弹开波");
  });

  it("每一招都有前摇、有冷却,文案里没有任何伤害或血量说法", () => {
    const banned = ["伤害", "血", "扣血", "死", "受伤", "攻击力"];
    for (const id of SKILL_ORDER) {
      const s = SKILLS[id];
      expect(s.windup, `${s.name} 没有前摇`).toBeGreaterThan(0);
      expect(s.active).toBeGreaterThan(0);
      expect(s.cooldown, `${s.name} 冷却太短`).toBeGreaterThanOrEqual(5);
      for (const w of banned) {
        expect(`${s.name}${s.blurb}`.includes(w), `${s.name} 的说明里出现了「${w}」`).toBe(false);
      }
    }
  });

  it("弹开波前摇最长,对面看得见、来得及开护盾", () => {
    expect(SKILLS.wave.windup).toBeGreaterThan(SKILLS.dash.windup);
    expect(SKILLS.wave.windup).toBeGreaterThan(SKILLS.shield.windup);
    expect(SKILLS.wave.windup).toBeGreaterThanOrEqual(0.3);
    expect(SKILLS.shield.windup).toBeLessThan(SKILLS.wave.windup);
  });

  it("一个键轮流放三招,放完自动轮到下一招", () => {
    expect(nextSkill("dash")).toBe("shield");
    expect(nextSkill("shield")).toBe("wave");
    expect(nextSkill("wave")).toBe("dash");

    let st = createSkillState(0);
    expect(st.current).toBe("dash");
    const cast = castSkill(st, 0);
    expect(cast.started).toBe(true);
    st = tickSkills(cast.state, SKILLS.dash.windup + SKILLS.dash.active + 0.01);
    expect(st.current).toBe("shield");
    expect(st.casting).toBeNull();
  });

  it("放招期间按不动第二次,冷却没走完也放不出来", () => {
    let st = createSkillState(0);
    const first = castSkill(st, 0);
    st = first.state;
    expect(canCast(st, 0.05)).toBe(false);
    expect(castSkill(st, 0.05).started).toBe(false);

    const doneAt = SKILLS.dash.windup + SKILLS.dash.active;
    st = tickSkills(st, doneAt + 0.01);
    // 轮到护盾泡了,它是好的
    expect(canCast(st, doneAt + 0.01)).toBe(true);
    // 但加速本身还在冷却里
    expect(skillPhase(st, "dash", doneAt + 0.01)).toBe("cooldown");
    expect(cooldownRatio(st, "dash", doneAt + 0.01)).toBeGreaterThan(0.9);
    expect(cooldownRatio(st, "dash", doneAt + SKILLS.dash.cooldown + 0.1)).toBe(0);
  });

  it("前摇里还不算生效,生效结束就失效", () => {
    const st = castSkill(createSkillState(0), 0).state;
    expect(skillPhase(st, "dash", 0.05)).toBe("windup");
    expect(isSkillActive(st, "dash", 0.05)).toBe(false);
    expect(isSkillActive(st, "dash", SKILLS.dash.windup + 0.01)).toBe(true);
    expect(isSkillActive(st, "dash", SKILLS.dash.windup + SKILLS.dash.active + 0.01)).toBe(false);
  });

  it("护盾泡生效时挡得住,冷却时挡不住", () => {
    let st = createSkillState(0);
    st.current = "shield";
    st = castSkill(st, 0).state;
    expect(isProtected(st, 0.05)).toBe(false); // 还在前摇
    expect(isProtected(st, SKILLS.shield.windup + 0.5)).toBe(true);
    expect(isProtected(st, SKILLS.shield.windup + SKILLS.shield.active + 0.1)).toBe(false);
  });

  it("弹开波只在前摇结束那一帧推一次,不会连推", () => {
    let st = createSkillState(0);
    st.current = "wave";
    st = castSkill(st, 0).state;
    const w = SKILLS.wave.windup;
    expect(waveJustFired(st, 0, 0.05)).toBe(false);
    expect(waveJustFired(st, w - 0.02, w + 0.01)).toBe(true);
    expect(waveJustFired(st, w + 0.01, w + 0.05)).toBe(false);
  });

  it("被弹开是沿着连线推走并转个圈,不是受伤", () => {
    const p = pushedPosition({ x: 0.6, y: 0.5 }, { x: 0.4, y: 0.5 });
    expect(p.x).toBeCloseTo(0.6 + WAVE_PUSH, 6);
    expect(p.y).toBeCloseTo(0.5, 6);
    // 完全重叠时也有确定的方向,不会算出 NaN
    const q = pushedPosition({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(Number.isFinite(q.x)).toBe(true);
    expect(Number.isFinite(q.y)).toBe(true);
    expect(WAVE_SPIN_SECONDS).toBeGreaterThan(0);
    expect(WAVE_SPIN_SECONDS).toBeLessThanOrEqual(1);
  });

  it("加速只是跑快一点,不会快到看不清", () => {
    expect(DASH_SPEED_SCALE).toBeGreaterThan(1);
    expect(DASH_SPEED_SCALE).toBeLessThanOrEqual(1.8);
  });
});
