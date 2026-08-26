import { describe, expect, it } from "vitest";
import {
  ARENA_AI_BOMB_SLIP,
  ARENA_AI_HINTS,
  ARENA_AI_LABELS,
  ARENA_AI_LEVELS,
  ARENA_AI_MIN_REACTION,
  ARENA_AI_MISS,
  ARENA_AI_REACTION,
  ARENA_HANDICAP_FULL,
  ARENA_HANDICAP_MAX,
  ARENA_HANDICAP_START,
  SKILLS,
  SKILL_KINDS,
  STAGES,
  applyStage,
  arenaHandicap,
  arenaHandicapBadge,
  bestStreak,
  createArenaAi,
  createDefense,
  createSkill,
  defenseAiLevel,
  defenseNext,
  defenseStage,
  inStageShape,
  isMatchPoint,
  levelToArenaSetup,
  matchPointLine,
  planArenaTaps,
  pressSkill,
  shieldAbsorb,
  sparkleActive,
  stageById,
  tickSkill,
  type ArenaAiLevel,
} from "./arena12";
import { applyTap, buildRoundSchedule, matchState, roundWinner } from "./logic";

/* ---------------- 人机四档 ---------------- */

describe("1.2 人机四档", () => {
  it("四档齐了，每一档都有名字和说明", () => {
    expect(ARENA_AI_LEVELS).toEqual([0, 1, 2, 3]);
    for (const lv of ARENA_AI_LEVELS) {
      expect(ARENA_AI_LABELS[lv].length).toBeGreaterThan(0);
      expect(ARENA_AI_HINTS[lv].length).toBeGreaterThan(0);
    }
  });

  it("档位越高反应越快、漏点越少、误点炸弹越少", () => {
    for (let i = 1; i < ARENA_AI_LEVELS.length; i++) {
      const hi = ARENA_AI_LEVELS[i];
      const lo = ARENA_AI_LEVELS[i - 1];
      expect(ARENA_AI_REACTION[hi]).toBeLessThan(ARENA_AI_REACTION[lo]);
      expect(ARENA_AI_MISS[hi]).toBeLessThan(ARENA_AI_MISS[lo]);
      expect(ARENA_AI_BOMB_SLIP[hi]).toBeLessThan(ARENA_AI_BOMB_SLIP[lo]);
    }
  });

  it("地狱档也留出可反打的窗口，不是 0 秒完美反应", () => {
    for (const lv of ARENA_AI_LEVELS) {
      expect(ARENA_AI_REACTION[lv]).toBeGreaterThanOrEqual(ARENA_AI_MIN_REACTION);
    }
  });

  it("同一个 seed 出同一串计划（可复现）", () => {
    const sched = buildRoundSchedule(1234, 2);
    const a = planArenaTaps(createArenaAi(2, 99), sched);
    const b = planArenaTaps(createArenaAi(2, 99), sched);
    expect(a).toEqual(b);
  });

  it("电脑不会点到已经消失的目标", () => {
    const sched = buildRoundSchedule(555, 3);
    for (const lv of ARENA_AI_LEVELS) {
      for (const plan of planArenaTaps(createArenaAi(lv, 7), sched)) {
        const ev = sched[plan.index];
        expect(plan.at).toBeGreaterThanOrEqual(ev.t);
        expect(plan.at).toBeLessThanOrEqual(ev.t + ev.ttl + 1e-9);
      }
    }
  });

  it("固定 seed 下档位越高得分越高（相邻档单调）", () => {
    const score = (lv: ArenaAiLevel): number => {
      let total = 0;
      for (let seed = 1; seed <= 24; seed++) {
        const sched = buildRoundSchedule(seed * 31, 2);
        let s = 0;
        for (const plan of planArenaTaps(createArenaAi(lv, seed), sched)) {
          s = applyTap(s, plan.kind, false);
        }
        total += s;
      }
      return total;
    };
    const scores = ARENA_AI_LEVELS.map(score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });
});

/* ---------------- 技能 ---------------- */

describe("1.2 三个温和技能", () => {
  it("三个技能都配齐了前摇 / 冷却，且没有伤害语义", () => {
    expect(SKILL_KINDS).toHaveLength(3);
    const banned = /伤害|攻击|血|扣血|打死|杀/;
    for (const kind of SKILL_KINDS) {
      const spec = SKILLS[kind];
      expect(spec.windup).toBeGreaterThan(0);
      expect(spec.cooldown).toBeGreaterThan(0);
      expect(banned.test(spec.label + spec.hint)).toBe(false);
    }
  });

  it("按下去先进前摇，前摇里再按没用", () => {
    const s = pressSkill(createSkill("sparkle"));
    expect(s.phase).toBe("windup");
    expect(pressSkill(s)).toEqual(s);
  });

  it("星光冲刺走完前摇 → 生效 → 冷却 → 就绪", () => {
    const spec = SKILLS.sparkle;
    let s = pressSkill(createSkill("sparkle"));
    s = tickSkill(s, spec.windup);
    expect(s.phase).toBe("active");
    expect(sparkleActive(s)).toBe(true);
    s = tickSkill(s, spec.active);
    expect(s.phase).toBe("cooldown");
    expect(sparkleActive(s)).toBe(false);
    s = tickSkill(s, spec.cooldown);
    expect(s.phase).toBe("ready");
  });

  it("一帧掉太久也能连跨多个阶段，不会卡在负数", () => {
    const s = tickSkill(pressSkill(createSkill("sparkle")), 999);
    expect(s.phase).toBe("ready");
    expect(s.remain).toBe(0);
  });

  it("护盾泡没有生效时长，前摇结束直接拿一层并进冷却", () => {
    let s = pressSkill(createSkill("shieldBubble"));
    s = tickSkill(s, SKILLS.shieldBubble.windup);
    expect(s.phase).toBe("cooldown");
    expect(s.charges).toBe(1);
  });

  it("护盾泡挡下一次炸弹后就没了", () => {
    let s = tickSkill(pressSkill(createSkill("shieldBubble")), SKILLS.shieldBubble.windup);
    const first = shieldAbsorb(s);
    expect(first.blocked).toBe(true);
    expect(first.state.charges).toBe(0);
    s = first.state;
    expect(shieldAbsorb(s).blocked).toBe(false);
  });

  it("弹开波前摇最长，给对手看得见的预警", () => {
    expect(SKILLS.pushWave.windup).toBeGreaterThanOrEqual(SKILLS.sparkle.windup);
    expect(SKILLS.pushWave.windup).toBeGreaterThan(SKILLS.shieldBubble.windup);
  });

  it("没按过的技能一直是就绪，tick 不改状态", () => {
    const s = createSkill("pushWave");
    expect(tickSkill(s, 5)).toEqual(s);
  });
});

/* ---------------- 擂台 ---------------- */

describe("1.2 三张擂台", () => {
  it("三张擂台的形状与节奏各不相同", () => {
    expect(STAGES).toHaveLength(3);
    expect(new Set(STAGES.map((s) => s.shape)).size).toBe(3);
    expect(new Set(STAGES.map((s) => s.ttlMult)).size).toBe(3);
    expect(new Set(STAGES.map((s) => s.intervalMult)).size).toBe(3);
  });

  it("每张擂台都有名字与一句话说明", () => {
    for (const s of STAGES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.hint.length).toBeGreaterThan(0);
    }
  });

  it("认不出的擂台 id 退回第一张，不会崩", () => {
    expect(stageById("meadow").id).toBe("meadow");
    expect(stageById("nope" as never).id).toBe(STAGES[0].id);
  });

  it("形状裁剪：圆台四角不可点、中心可点", () => {
    expect(inStageShape("round", 0.5, 0.5)).toBe(true);
    expect(inStageShape("round", 0.02, 0.02)).toBe(false);
    expect(inStageShape("rect", 0.02, 0.02)).toBe(true);
    expect(inStageShape("rect", 1.4, 0.5)).toBe(false);
  });

  it("梯形台中间比两头宽", () => {
    expect(inStageShape("taper", 0.06, 0.5)).toBe(true);
    expect(inStageShape("taper", 0.06, 0.02)).toBe(false);
  });

  it("套用擂台后每个目标都落在可点区域里", () => {
    const sched = buildRoundSchedule(8080, 3);
    for (const stage of STAGES) {
      for (const ev of applyStage(sched, stage)) {
        expect(inStageShape(stage.shape, ev.x, ev.y)).toBe(true);
      }
    }
  });

  it("套用擂台会按倍率改存活时长与节奏，目标数量不变", () => {
    const sched = buildRoundSchedule(4242, 2);
    const fast = applyStage(sched, stageById("starPond"));
    expect(fast).toHaveLength(sched.length);
    expect(fast[fast.length - 1].t).toBeLessThan(sched[sched.length - 1].t);
    expect(fast[0].ttl).toBeLessThan(sched[0].ttl);
  });
});

/* ---------------- 让分 ---------------- */

describe("1.2 让分开关", () => {
  it("默认关闭时永远 1 倍，也不显示提示", () => {
    expect(arenaHandicap(false, 0, 100)).toBe(1);
    expect(arenaHandicapBadge(false)).toBeNull();
  });

  it("领先方拿不到让分，差距太小也不给", () => {
    expect(arenaHandicap(true, 20, 5)).toBe(1);
    expect(arenaHandicap(true, 5, 5 + ARENA_HANDICAP_START)).toBe(1);
  });

  it("让分封顶 8%", () => {
    expect(arenaHandicap(true, 0, ARENA_HANDICAP_FULL)).toBeCloseTo(1 + ARENA_HANDICAP_MAX);
    expect(arenaHandicap(true, 0, 9999)).toBeCloseTo(1 + ARENA_HANDICAP_MAX);
  });

  it("开着时 HUD 有提示", () => {
    expect(arenaHandicapBadge(true)).toContain("让分");
  });
});

/* ---------------- 守擂无尽 ---------------- */

describe("1.2 守擂无尽", () => {
  it("每两场升一档，封顶地狱", () => {
    expect(defenseAiLevel(1)).toBe(0);
    expect(defenseAiLevel(2)).toBe(0);
    expect(defenseAiLevel(3)).toBe(1);
    expect(defenseAiLevel(7)).toBe(3);
    expect(defenseAiLevel(99)).toBe(3);
    expect(defenseAiLevel(Number.NaN)).toBe(0);
  });

  it("守擂难度随场次单调不减", () => {
    let prev = -1;
    for (let n = 1; n <= 20; n++) {
      const lv = defenseAiLevel(n);
      expect(lv).toBeGreaterThanOrEqual(prev);
      prev = lv;
    }
  });

  it("三张擂台在守擂里轮换", () => {
    expect(defenseStage(1).id).toBe(STAGES[0].id);
    expect(defenseStage(4).id).toBe(STAGES[0].id);
    expect(new Set([1, 2, 3].map((n) => defenseStage(n).id)).size).toBe(3);
  });

  it("赢了连胜 +1 进下一场，输了当场结束", () => {
    let d = createDefense();
    d = defenseNext(d, true);
    d = defenseNext(d, true);
    expect(d.streak).toBe(2);
    expect(d.round).toBe(3);
    d = defenseNext(d, false);
    expect(d.over).toBe(true);
    expect(d.streak).toBe(2);
    expect(defenseNext(d, true)).toEqual(d);
  });

  it("连胜纪录只增不减", () => {
    expect(bestStreak(5, 3)).toBe(5);
    expect(bestStreak(5, 8)).toBe(8);
    expect(bestStreak(5, Number.NaN)).toBe(5);
  });
});

/* ---------------- 平台接线与赛点 ---------------- */

describe("1.2 平台接线与赛点", () => {
  it("第 N 关映射成人机档 + 擂台，四档都覆盖得到", () => {
    const levels = new Set([1, 47, 48, 100, 141, 188].map((n) => levelToArenaSetup(n).aiLevel));
    expect(levels).toEqual(new Set([0, 1, 2, 3]));
  });

  it("越界与非法值 clamp 回合法范围", () => {
    expect(levelToArenaSetup(0).aiLevel).toBe(0);
    expect(levelToArenaSetup(99999).aiLevel).toBe(3);
    expect(levelToArenaSetup(Number.NaN).aiLevel).toBe(0);
    expect(levelToArenaSetup(1).label.length).toBeGreaterThan(0);
  });

  it("赛点判定：1:0 / 0:1 / 1:1 都是赛点，0:0 不是", () => {
    expect(isMatchPoint(0, 0)).toBe(false);
    expect(isMatchPoint(1, 0)).toBe(true);
    expect(isMatchPoint(0, 1)).toBe(true);
    expect(isMatchPoint(1, 1)).toBe(true);
  });

  it("赛点提示语点名领先的那一位", () => {
    expect(matchPointLine(0, 0, ["朵朵", "星星"])).toBeNull();
    expect(matchPointLine(1, 0, ["朵朵", "星星"])).toContain("朵朵");
    expect(matchPointLine(0, 1, ["朵朵", "星星"])).toContain("星星");
    expect(matchPointLine(1, 1, ["朵朵", "星星"])).toContain("赛点");
  });

  it("三局两胜赛制与既有胜负判定接得上", () => {
    expect(matchState([roundWinner(5, 3), roundWinner(9, 2)])).toEqual({ done: true, winner: 0 });
    expect(matchState([roundWinner(1, 1)])).toEqual({ done: false, sudden: false });
  });
});

/* ---------------- 两个半场没有系统性优势 ---------------- */

describe("1.2 左右 / 上下没有系统性优势", () => {
  it("两个半场共用同一份时间表，逐个目标完全相同", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const top = buildRoundSchedule(seed, 2);
      const bottom = buildRoundSchedule(seed, 2);
      expect(top).toEqual(bottom);
    }
  });

  it("同档人机自我对弈 60 局，两边胜率都落在 40%–60%", () => {
    let winTop = 0;
    let played = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const sched = buildRoundSchedule(seed * 17, 2);
      const scoreOf = (aiSeed: number): number => {
        let s = 0;
        for (const plan of planArenaTaps(createArenaAi(1, aiSeed), sched)) {
          s = applyTap(s, plan.kind, false);
        }
        return s;
      };
      const a = scoreOf(seed * 3 + 1);
      const b = scoreOf(seed * 3 + 2);
      if (a === b) continue;
      played++;
      if (a > b) winTop++;
    }
    expect(played).toBeGreaterThan(30);
    const rate = winTop / played;
    expect(rate).toBeGreaterThanOrEqual(0.4);
    expect(rate).toBeLessThanOrEqual(0.6);
  });
});
