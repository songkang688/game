import { describe, expect, it } from "vitest";
import {
  AI_BLOCKING,
  AI_LEVELS,
  AI_MISTAKE_CHANCE,
  AI_REACTION_SECONDS,
  createBrain,
  decide,
  planFor,
  type AiView,
} from "./ai";
import { MAX_SPEED, createTrackGen, trackHasRoute, type Entity } from "./logic";
import {
  CONFETTI_MULT,
  FORK_LENGTH,
  HANDICAP_FULL_GAP,
  HANDICAP_MAX,
  HANDICAP_START_GAP,
  MAGNET_RADIUS,
  POWERUPS,
  POWERUP_KINDS,
  SHIELD_MAX,
  SPEED_CLOUD_MULT,
  TRACK_TIER_LABELS,
  TRACK_TIER_MULT,
  absorbCrash,
  applyPowerup,
  bestEndless,
  buildFork,
  createPowerupState,
  forkIsFair,
  handicapBadge,
  handicapMult,
  levelToSetup,
  magnetRadius,
  makeGhostSnapshot,
  parseGhostSnapshot,
  pickPowerup,
  planForks,
  powerupSpeedMult,
  serializeGhostSnapshot,
  tickPowerups,
} from "./rush12";

/* ---------------- 道具 ---------------- */

describe("1.2 温和道具", () => {
  it("四个道具都配齐了文案，且没有攻击伤害语义", () => {
    expect(POWERUP_KINDS).toHaveLength(4);
    const banned = /伤害|攻击|血|杀|打死|炸死/;
    for (const kind of POWERUP_KINDS) {
      const spec = POWERUPS[kind];
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.hint.length).toBeGreaterThan(0);
      expect(banned.test(spec.label + spec.hint)).toBe(false);
    }
  });

  it("只有减速彩纸是丢给对手的", () => {
    const toOpponent = POWERUP_KINDS.filter((k) => POWERUPS[k].toOpponent);
    expect(toOpponent).toEqual(["confetti"]);
  });

  it("吃加速云给自己加时间，不影响对手", () => {
    const r = pickPowerup(createPowerupState(), "speedCloud");
    expect(r.toOpponent).toBeNull();
    expect(r.self.speedCloud).toBeCloseTo(POWERUPS.speedCloud.seconds);
  });

  it("吃减速彩纸自己什么都不变，效果丢给对手", () => {
    const r = pickPowerup(createPowerupState(), "confetti");
    expect(r.self).toEqual(createPowerupState());
    expect(r.toOpponent).toBe("confetti");
  });

  it("护盾泡最多叠两层", () => {
    let s = createPowerupState();
    for (let i = 0; i < 5; i++) s = applyPowerup(s, "shieldBubble");
    expect(s.shield).toBe(SHIELD_MAX);
  });

  it("倒计时不会跑成负数", () => {
    const s = tickPowerups(applyPowerup(createPowerupState(), "magnetStar"), 999);
    expect(s.magnetStar).toBe(0);
  });

  it("加速云在时效内提速，过期就恢复", () => {
    const s = applyPowerup(createPowerupState(), "speedCloud");
    expect(powerupSpeedMult(s)).toBeCloseTo(SPEED_CLOUD_MULT);
    expect(powerupSpeedMult(tickPowerups(s, POWERUPS.speedCloud.seconds + 0.01))).toBe(1);
  });

  it("加速云和彩纸同时在身上就互相抵一部分", () => {
    const s = applyPowerup(applyPowerup(createPowerupState(), "speedCloud"), "confetti");
    expect(powerupSpeedMult(s)).toBeCloseTo(SPEED_CLOUD_MULT * CONFETTI_MULT);
    expect(powerupSpeedMult(s)).toBeLessThan(SPEED_CLOUD_MULT);
  });

  it("磁力星只在生效时给吸附半径", () => {
    expect(magnetRadius(createPowerupState())).toBe(0);
    expect(magnetRadius(applyPowerup(createPowerupState(), "magnetStar"))).toBe(MAGNET_RADIUS);
  });

  it("有护盾泡时撞击被挡下并消耗一层，没有就照常算一次撞击", () => {
    const withShield = applyPowerup(createPowerupState(), "shieldBubble");
    const a = absorbCrash(withShield);
    expect(a.blocked).toBe(true);
    expect(a.state.shield).toBe(0);
    const b = absorbCrash(a.state);
    expect(b.blocked).toBe(false);
  });

  it("同种道具是续时间不是叠倍率", () => {
    const s = applyPowerup(applyPowerup(createPowerupState(), "speedCloud"), "speedCloud");
    expect(s.speedCloud).toBeCloseTo(POWERUPS.speedCloud.seconds * 2);
    expect(powerupSpeedMult(s)).toBeCloseTo(SPEED_CLOUD_MULT);
  });
});

/* ---------------- 分岔 ---------------- */

describe("1.2 赛道分岔与合流", () => {
  it("两条支路长度完全相同，合流点同一米", () => {
    const fork = buildFork(400, 12345);
    expect(fork.mergeAt).toBe(fork.at + FORK_LENGTH);
    expect(fork.length).toBe(FORK_LENGTH);
    for (const br of fork.branches) {
      for (const e of br.entities) {
        expect(e.at).toBeGreaterThanOrEqual(fork.at);
        expect(e.at).toBeLessThanOrEqual(fork.mergeAt);
      }
    }
  });

  it("两条支路难度确实不一样，而且都走得通", () => {
    const fork = buildFork(400, 999);
    const [a, b] = fork.branches;
    expect(a.difficulty).not.toBe(b.difficulty);
    expect(trackHasRoute(a.entities, MAX_SPEED)).toBe(true);
    expect(trackHasRoute(b.entities, MAX_SPEED)).toBe(true);
  });

  it("稳路不是永远在左边（不让孩子形成盲选肌肉记忆）", () => {
    const sides = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      sides.add(buildFork(400, seed).branches[0].difficulty);
    }
    expect(sides.size).toBeGreaterThan(1);
  });

  it("公平性校验对每一个种子都成立", () => {
    for (let seed = 1; seed <= 60; seed++) {
      expect(forkIsFair(buildFork(300 + seed * 13, seed))).toBe(true);
    }
  });

  it("公平性校验能抓出被改坏的合流点", () => {
    const fork = buildFork(400, 7);
    expect(forkIsFair({ ...fork, mergeAt: fork.mergeAt + 10 })).toBe(false);
  });

  it("排分岔口按固定间距且可复现", () => {
    const a = planForks(0, 1200, 42);
    const b = planForks(0, 1200, 42);
    expect(a.map((f) => f.at)).toEqual(b.map((f) => f.at));
    expect(a.length).toBeGreaterThan(2);
    for (let i = 1; i < a.length; i++) {
      expect(a[i].at - a[i - 1].at).toBeGreaterThanOrEqual(FORK_LENGTH);
    }
  });
});

/* ---------------- 幽灵快照 ---------------- */

describe("1.2 幽灵快照", () => {
  it("自己的和对手的两种来源都能存", () => {
    const self = makeGhostSnapshot("self", 520, 12.5, "朵朵");
    const rival = makeGhostSnapshot("rival", 610, 13.2, "星星");
    expect(self?.source).toBe("self");
    expect(rival?.source).toBe("rival");
  });

  it("序列化 → 反序列化能原样回来", () => {
    const snap = makeGhostSnapshot("rival", 777, 18.34, "星星");
    expect(snap).not.toBeNull();
    const back = parseGhostSnapshot(serializeGhostSnapshot(snap!));
    expect(back).toEqual(snap);
  });

  it("坏数据一律当作没有幽灵", () => {
    expect(parseGhostSnapshot(null)).toBeNull();
    expect(parseGhostSnapshot("")).toBeNull();
    expect(parseGhostSnapshot("{oops")).toBeNull();
    expect(parseGhostSnapshot(JSON.stringify({ v: 1, source: "self", dist: 1, seconds: 1 }))).toBeNull();
    expect(parseGhostSnapshot(JSON.stringify({ v: 2, source: "x", dist: 1, seconds: 1 }))).toBeNull();
  });

  it("成绩非法就不生成快照", () => {
    expect(makeGhostSnapshot("self", 0, 10, "朵朵")).toBeNull();
    expect(makeGhostSnapshot("self", 100, 0, "朵朵")).toBeNull();
    expect(makeGhostSnapshot("self", Number.NaN, 10, "朵朵")).toBeNull();
  });
});

/* ---------------- 让分 ---------------- */

describe("1.2 让分助推", () => {
  it("默认关闭时永远是 1 倍", () => {
    expect(handicapMult(false, 0, 10000)).toBe(1);
    expect(handicapBadge(false)).toBeNull();
  });

  it("领先的一方拿不到助推", () => {
    expect(handicapMult(true, 500, 100)).toBe(1);
  });

  it("差距很小时也不给助推", () => {
    expect(handicapMult(true, 100, 100 + HANDICAP_START_GAP - 1)).toBe(1);
  });

  it("助推封顶 8%，落后再多也不会超", () => {
    expect(handicapMult(true, 0, HANDICAP_FULL_GAP)).toBeCloseTo(1 + HANDICAP_MAX);
    expect(handicapMult(true, 0, 100000)).toBeCloseTo(1 + HANDICAP_MAX);
  });

  it("助推随差距单调不减", () => {
    let prev = 0;
    for (let gap = 0; gap <= 300; gap += 10) {
      const m = handicapMult(true, 0, gap);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it("开着让分时 HUD 有提示", () => {
    expect(handicapBadge(true)).toContain("让分");
  });
});

/* ---------------- 关卡映射与无尽 ---------------- */

describe("1.2 平台接线", () => {
  it("第 N 关映射成赛道档 + 人机档，四档都覆盖得到", () => {
    const tiers = new Set([1, 47, 48, 100, 141, 188].map((n) => levelToSetup(n).tier));
    expect(tiers).toEqual(new Set([0, 1, 2, 3]));
    expect(levelToSetup(1).tier).toBe(0);
    expect(levelToSetup(188).tier).toBe(3);
  });

  it("越界与非法值 clamp 回合法范围", () => {
    expect(levelToSetup(0).tier).toBe(0);
    expect(levelToSetup(-5).tier).toBe(0);
    expect(levelToSetup(9999).tier).toBe(3);
    expect(levelToSetup(Number.NaN).tier).toBe(0);
  });

  it("四个难度档都有名字，倍率单调上升", () => {
    const tiers = [0, 1, 2, 3] as const;
    for (const t of tiers) expect(TRACK_TIER_LABELS[t].length).toBeGreaterThan(0);
    for (let i = 1; i < tiers.length; i++) {
      expect(TRACK_TIER_MULT[tiers[i]]).toBeGreaterThan(TRACK_TIER_MULT[tiers[i - 1]]);
    }
  });

  it("无尽成绩只增不减", () => {
    expect(bestEndless(500, 300)).toBe(500);
    expect(bestEndless(500, 900)).toBe(900);
    expect(bestEndless(500, Number.NaN)).toBe(500);
    expect(bestEndless(Number.NaN, 120)).toBe(120);
  });
});

/* ---------------- 四档人机 ---------------- */

describe("1.2 段位式人机（四档）", () => {
  function view(partial: Partial<AiView>): AiView {
    return {
      lane: 1,
      dist: 0,
      speed: 60,
      jumping: false,
      sliding: false,
      entities: [],
      from: 0,
      ...partial,
    };
  }

  it("四档齐了，且档位越高反应越快、失误越少", () => {
    expect(AI_LEVELS).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < AI_LEVELS.length; i++) {
      const hi = AI_LEVELS[i];
      const lo = AI_LEVELS[i - 1];
      expect(AI_REACTION_SECONDS[hi]).toBeLessThan(AI_REACTION_SECONDS[lo]);
      expect(AI_MISTAKE_CHANCE[hi]).toBeLessThan(AI_MISTAKE_CHANCE[lo]);
    }
  });

  it("只有领跑档会卡位，其它三档都不卡", () => {
    expect(AI_BLOCKING).toEqual({ 0: false, 1: false, 2: false, 3: true });
  });

  it("领跑档也保留反应延迟，不是 0 帧完美反应", () => {
    expect(AI_REACTION_SECONDS[3]).toBeGreaterThan(0);
  });

  it("卡位只在对手那条道对自己也安全时才做", () => {
    // 中间道有石头逼我换道，对手在 0 道；0 道是空的 → 领跑档会去抢 0 道
    const entities: Entity[] = [{ kind: "rock", lane: 1, at: 80 }];
    const v = view({ entities, lane: 1, dist: 60, speed: 60, rivalLane: 0 });
    expect(planFor(v, false, true)).toBe("left");
  });

  it("对手那条道过不去时，领跑档不会为了卡人把自己撞上去", () => {
    const entities: Entity[] = [
      { kind: "rock", lane: 0, at: 80 },
      { kind: "rock", lane: 1, at: 80 },
    ];
    const v = view({ entities, lane: 1, dist: 60, speed: 60, rivalLane: 0 });
    expect(planFor(v, false, true)).toBe("right");
  });

  it("不开卡位时同一局面不会去抢对手的道", () => {
    const entities: Entity[] = [{ kind: "coin", lane: 0, at: 80 }];
    const v = view({ entities, lane: 1, dist: 60, speed: 60, rivalLane: 0 });
    expect(planFor(v, false, false)).toBeNull();
  });

  it("四档跑同一条赛道，档位越高撞得越少（固定 seed）", () => {
    const gen = createTrackGen(2024);
    const entities = gen.ensure(2600);
    const crashes = (level: 0 | 1 | 2 | 3): number => {
      const brain = createBrain(level, 77);
      let lane = 1;
      let dist = 0;
      let jumpUntil = -1;
      let slideUntil = -1;
      let hits = 0;
      let safeUntil = -1;
      const dt = 1 / 60;
      for (let t = 0; t < 40; t += dt) {
        const speed = 70;
        dist += speed * dt;
        const action = decide(
          brain,
          { lane, dist, speed, jumping: t < jumpUntil, sliding: t < slideUntil, entities, from: 0 },
          t,
        );
        if (action === "left") lane = Math.max(0, lane - 1);
        else if (action === "right") lane = Math.min(2, lane + 1);
        else if (action === "jump" && t >= jumpUntil) jumpUntil = t + 0.62;
        else if (action === "slide" && t >= slideUntil) slideUntil = t + 0.55;
        for (const e of entities) {
          if (e.at <= dist - speed * dt || e.at > dist) continue;
          if (e.lane !== lane) continue;
          if (e.kind === "coin" || e.kind === "boost") continue;
          const ok =
            (e.kind === "hurdle" || e.kind === "pit") && t < jumpUntil
              ? true
              : e.kind === "gate" && t < slideUntil;
          if (!ok && t >= safeUntil) {
            hits++;
            safeUntil = t + 1.4;
          }
        }
      }
      return hits;
    };
    expect(crashes(3)).toBeLessThanOrEqual(crashes(0));
    expect(crashes(2)).toBeLessThanOrEqual(crashes(0));
  });
});

/**
 * 1.2 监督修复员补的守门用例。
 *
 * 本款没有伤害:撞一下只是踉跄一步、少一次机会。上面的道具用例已经守住了
 * 道具文案,这里把**攻略整本**也守起来——原先第三章有一句写着「对手的血量」,
 * 既不合红线也说错了(那一格显示的是还剩几次机会)。
 */
describe("攻略通篇没有伤害语义", () => {
  it("通用心得与每一章的提示都不说血 / 伤 / 杀", async () => {
    const guide = (await import("./guide")).default;
    const lines = [
      guide.title,
      ...guide.general,
      ...guide.entries.flatMap((e) => [e.title, ...e.tips]),
    ];
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) {
      expect(line, `这句有伤害语义:${line}`).not.toMatch(/血|伤害|杀|打死|炸死|尸/);
    }
  });
});
