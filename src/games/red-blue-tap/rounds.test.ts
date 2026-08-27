/**
 * 红蓝点点 · 1.2 回合内核单测。
 *
 * 这一份盯的是「公平」两个字:
 *  · 四种回合各自的判分(反应 / 顺序 / 颜色含反向 / 计数超量作废);
 *  · 两侧目标序列必须镜像;
 *  · 抢点只认同一个时钟源;
 *  · 60ms 去抖与「手掌拍」不给分;
 *  · AI 四档 600 / 420 / 300 / 220ms + 失误率,没有 0ms 完美反应;
 *  · 无尽三次失误结束、成绩记回合数。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  AI_MIN_REACTION_MS,
  AI_TIERS,
  COLOR_FACE,
  ENDLESS_MISS_LIMIT,
  LIVE_FLOOR_MS,
  PALM_WINDOW_MS,
  READY_MAX_MS,
  READY_MIN_MS,
  ROUND_KINDS,
  SLOT_COUNT,
  TAP_COLORS,
  TAP_DEBOUNCE_MS,
  aiMisses,
  aiReactionMs,
  aiTier,
  aiTierForDelay,
  buildRound,
  createDuel,
  createTapGate,
  endlessAiTier,
  endlessGapMs,
  endlessLiveMs,
  endlessRoundKind,
  endlessRounds,
  isMirrored,
  logicalSlot,
  mirrorPos,
  readyDelay,
  roundBrief,
  sideSequence,
  slotPos,
  type RoundKind,
  type RoundPlan,
  type Side
} from "./rounds";

/** 一个可以手动拨的钟:所有判定都从它取时间 */
function fakeClock(start = 1000): { now: () => number; set: (t: number) => void; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    set: (v: number) => {
      t = v;
    },
    advance: (ms: number) => {
      t += ms;
    }
  };
}

/** 每一种回合都抽 40 份计划来查性质 */
function samplePlans(kind: RoundKind, n = 40): RoundPlan[] {
  return Array.from({ length: n }, (_, i) => buildRound(kind, mulberry32(i + 1), { liveMs: 1500 }));
}

describe("红蓝点点 1.2 · 四种回合都在", () => {
  it("回合类型正好四种,反应 / 顺序 / 颜色 / 计数一个不少", () => {
    expect(ROUND_KINDS).toEqual(["reaction", "order", "color", "count"]);
    expect(new Set(ROUND_KINDS).size).toBe(4);
  });

  it("每一种回合都给得出图形 + 文字双通道的指令", () => {
    for (const kind of ROUND_KINDS) {
      const brief = roundBrief(buildRound(kind, mulberry32(7)));
      expect(brief.icon.length).toBeGreaterThan(0);
      expect(brief.text.length).toBeGreaterThan(4);
      expect(brief.hint.length).toBeGreaterThan(4);
    }
  });

  it("一个人玩的时候反应回合不说「谁先点到」,因为没有对手", () => {
    const plan = buildRound("reaction", mulberry32(5));
    expect(roundBrief(plan, false).text).toContain("谁先点到");
    expect(roundBrief(plan, true).text).not.toContain("谁先点到");
    expect(roundBrief(plan, true).text).toContain("等它亮了再点");
  });

  it("颜色一律配形状:四种颜色四种形状,色弱也分得出", () => {
    const shapes = TAP_COLORS.map((c) => COLOR_FACE[c].shape);
    expect(shapes).toHaveLength(4);
    expect(new Set(shapes).size).toBe(4);
    for (const c of TAP_COLORS) expect(COLOR_FACE[c].hex).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("红蓝点点 1.2 · ① 反应回合", () => {
  it("只有一个格子该点,其它三个都是不许点的", () => {
    for (const plan of samplePlans("reaction")) {
      expect(plan.targets).toHaveLength(1);
      expect(plan.need).toBe(1);
      expect(plan.forbidden).toHaveLength(SLOT_COUNT - 1);
      expect(plan.forbidden).not.toContain(plan.targets[0]);
    }
  });

  it("亮灯之后先点的那一侧得分,慢的一侧一分都拿不到", () => {
    const clock = fakeClock();
    const plan = buildRound("reaction", mulberry32(3));
    const d = createDuel(plan, clock.now);
    const pos = slotPos("left", plan.targets[0]);
    clock.set(d.lightAt + 120);
    expect(d.tap("left", pos).outcome).toBe("win");
    clock.advance(40);
    expect(d.tap("right", slotPos("right", plan.targets[0])).outcome).toBe("win");
    const r = d.finish();
    expect(r.winner).toBe("left");
    expect(r.delta.left).toBe(1);
    expect(r.delta.right).toBe(0);
  });

  it("抢点(亮之前点)扣自己一分,而且这一轮不用再点了", () => {
    const clock = fakeClock();
    const plan = buildRound("reaction", mulberry32(5));
    const d = createDuel(plan, clock.now);
    const pos = slotPos("left", plan.targets[0]);
    clock.set(d.lightAt - 30);
    expect(d.tap("left", pos).outcome).toBe("early");
    clock.set(d.lightAt + 50);
    expect(d.tap("left", pos).outcome).toBe("ignored");
    clock.advance(10);
    d.tap("right", slotPos("right", plan.targets[0]));
    const r = d.finish();
    expect(r.delta.left).toBe(-1);
    expect(r.delta.right).toBe(1);
  });

  it("点错格子这一轮就过了,但不倒扣——输了只鼓励", () => {
    const clock = fakeClock();
    const plan = buildRound("reaction", mulberry32(9));
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 80);
    expect(d.tap("left", slotPos("left", plan.forbidden[0])).outcome).toBe("wrong");
    expect(d.finish().delta.left).toBe(0);
  });
});

describe("红蓝点点 1.2 · ② 顺序回合", () => {
  it("号码链至少两格,链上的格子彼此不重复", () => {
    for (const plan of samplePlans("order")) {
      expect(plan.order.length).toBeGreaterThanOrEqual(2);
      expect(new Set(plan.order).size).toBe(plan.order.length);
      expect(plan.need).toBe(plan.order.length);
    }
  });

  it("1 → 2 → 3 全点对才拿分,跳号立刻作废", () => {
    const clock = fakeClock();
    const plan = buildRound("order", mulberry32(11), { chain: 3 });
    const good = createDuel(plan, clock.now);
    clock.set(good.lightAt + 100);
    for (const slot of plan.order) {
      clock.advance(200);
      good.tap("left", slotPos("left", slot));
    }
    expect(good.finish().delta.left).toBe(1);

    const clock2 = fakeClock();
    const bad = createDuel(plan, clock2.now);
    clock2.set(bad.lightAt + 100);
    bad.tap("left", slotPos("left", plan.order[0]));
    clock2.advance(200);
    expect(bad.tap("left", slotPos("left", plan.order[2])).outcome).toBe("wrong");
    expect(bad.finish().delta.left).toBe(0);
  });

  it("链越长给的作答窗口越长,不然按顺序点根本来不及", () => {
    const short = buildRound("order", mulberry32(2), { chain: 2, liveMs: 1500 });
    const long = buildRound("order", mulberry32(2), { chain: 4, liveMs: 1500 });
    expect(long.liveMs).toBeGreaterThan(short.liveMs);
  });
});

describe("红蓝点点 1.2 · ③ 颜色指令回合(含「不要点红色」)", () => {
  it("正向指令只点指令色,反向指令一个指令色都不许碰", () => {
    let positives = 0;
    let negatives = 0;
    for (const plan of samplePlans("color", 60)) {
      expect(plan.commandColor).not.toBeNull();
      const cmd = plan.commandColor!;
      if (plan.negative) {
        negatives++;
        for (const s of plan.targets) expect(plan.slots[s]).not.toBe(cmd);
        for (const s of plan.forbidden) expect(plan.slots[s]).toBe(cmd);
      } else {
        positives++;
        for (const s of plan.targets) expect(plan.slots[s]).toBe(cmd);
        for (const s of plan.forbidden) expect(plan.slots[s]).not.toBe(cmd);
      }
      expect(plan.targets.length).toBeGreaterThan(0);
    }
    expect(positives).toBeGreaterThan(0);
    expect(negatives).toBeGreaterThan(0);
  });

  it("反向指令的文案真的说「不要点」,正向说「只点」", () => {
    const neg = samplePlans("color", 60).find((p) => p.negative)!;
    const pos = samplePlans("color", 60).find((p) => !p.negative)!;
    expect(roundBrief(neg).text).toContain("不要点");
    expect(roundBrief(pos).text).toContain("只点");
  });

  it("碰到不许点的颜色立刻作废,点满该点的才得分", () => {
    const clock = fakeClock();
    const plan = samplePlans("color", 60).find((p) => p.forbidden.length > 0)!;
    const bad = createDuel(plan, clock.now);
    clock.set(bad.lightAt + 90);
    expect(bad.tap("left", slotPos("left", plan.forbidden[0])).outcome).toBe("wrong");
    expect(bad.finish().delta.left).toBe(0);

    const clock2 = fakeClock();
    const good = createDuel(plan, clock2.now);
    clock2.set(good.lightAt + 90);
    for (const slot of plan.targets) {
      clock2.advance(180);
      good.tap("left", slotPos("left", slot));
    }
    expect(good.finish().delta.left).toBe(1);
  });
});

describe("红蓝点点 1.2 · ④ 计数回合(超过就作废)", () => {
  it("正好点满 N 个才算数", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(4), { need: 2 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 100);
    d.tap("left", 0);
    clock.advance(200);
    d.tap("left", 1);
    expect(d.finish().delta.left).toBe(1);
  });

  it("多点一个整轮作废——手快乱拍反而没分", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(4), { need: 2 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 100);
    d.tap("left", 0);
    clock.advance(200);
    d.tap("left", 1);
    clock.advance(200);
    expect(d.tap("left", 2).outcome).toBe("wrong");
    expect(d.finish().delta.left).toBe(0);
  });

  it("点不够也不给分,同一个格子再点一次只是「已经点过」", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(4), { need: 3 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 100);
    d.tap("left", 0);
    clock.advance(300);
    expect(d.tap("left", 0).outcome).toBe("repeat");
    expect(d.finish().delta.left).toBe(0);
  });

  it("计数回合不是抢快:两边都点得刚刚好就都加分", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(6), { need: 2 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 120);
    d.tap("left", 0);
    d.tap("right", 0);
    clock.advance(220);
    d.tap("left", 1);
    d.tap("right", 1);
    const r = d.finish();
    expect(r.delta.left).toBe(1);
    expect(r.delta.right).toBe(1);
  });
});

describe("红蓝点点 1.2 · 公平性:两侧镜像", () => {
  it("每一种回合的每一份计划,两侧的目标序列都严格镜像", () => {
    for (const kind of ROUND_KINDS) {
      for (const plan of samplePlans(kind, 30)) {
        expect(isMirrored(plan), `${kind} 的计划不镜像`).toBe(true);
      }
    }
  });

  it("镜像映射是自反的,左右两侧点的是同一批逻辑格子", () => {
    for (let pos = 0; pos < SLOT_COUNT; pos++) {
      expect(mirrorPos(mirrorPos(pos))).toBe(pos);
      expect(logicalSlot("left", pos)).toBe(pos);
      expect(logicalSlot("right", pos)).toBe(SLOT_COUNT - 1 - pos);
    }
    const plan = buildRound("order", mulberry32(21), { chain: 3 });
    const asSlots = (side: Side) => sideSequence(plan, side).map((p) => logicalSlot(side, p));
    expect(asSlots("left")).toEqual(asSlots("right"));
    expect(sideSequence(plan, "left")).not.toEqual(sideSequence(plan, "right"));
  });

  it("同一个逻辑格子在两侧屏幕上的位序左右翻转,手指走的距离一样", () => {
    const plan = buildRound("color", mulberry32(33));
    for (const slot of plan.targets) {
      expect(slotPos("left", slot) + slotPos("right", slot)).toBe(SLOT_COUNT - 1);
    }
  });
});

describe("红蓝点点 1.2 · 公平性:同一个时钟源", () => {
  it("两侧的时间戳都由对局自己盖,谁也塞不进自己的表", () => {
    const clock = fakeClock(500);
    const plan = buildRound("reaction", mulberry32(15));
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 10);
    const a = d.tap("left", slotPos("left", plan.targets[0]));
    const b = d.tap("right", slotPos("right", plan.targets[0]));
    expect(a.t).toBe(b.t);
    expect(a.t).toBe(clock.now());
    // 同一时刻两侧都点到:先调用的那一侧算赢,不存在两边各按各的表
    expect(a.outcome).toBe("win");
    expect(d.finish().winner).toBe("left");
  });

  it("亮灯时刻只有一个,两侧的预备窗口完全一样长", () => {
    const clock = fakeClock(0);
    const plan = buildRound("count", mulberry32(17));
    const d = createDuel(plan, clock.now);
    expect(d.lightAt).toBe(plan.readyMs);
    expect(d.closeAt).toBe(plan.readyMs + plan.liveMs);
  });
});

describe("红蓝点点 1.2 · 防乱拍", () => {
  it("同一个按钮 60ms 内的重复输入只算一次", () => {
    const gate = createTapGate();
    expect(gate.accept(0, 0).ok).toBe(true);
    expect(gate.accept(0, TAP_DEBOUNCE_MS - 1).reason).toBe("debounce");
    expect(gate.accept(0, TAP_DEBOUNCE_MS).ok).toBe(true);
    expect(TAP_DEBOUNCE_MS).toBe(60);
  });

  it("自动连点器按 20ms 一下狂点,一秒钟也只算得到 60ms 一次的份", () => {
    const gate = createTapGate();
    let ok = 0;
    for (let t = 0; t <= 1000; t += 20) if (gate.accept(2, t).ok) ok++;
    expect(ok).toBeLessThanOrEqual(Math.ceil(1000 / TAP_DEBOUNCE_MS) + 1);
    expect(ok).toBeGreaterThan(0);
  });

  it("一巴掌盖住好几个点:后面的不算,前面刚给的也一起收回", () => {
    const gate = createTapGate();
    expect(gate.accept(0, 0).ok).toBe(true);
    const second = gate.accept(1, 20);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("palm");
    expect(second.revoke).toContain(0);
    // 隔开一点点再点另一个就是正常操作
    expect(gate.accept(2, 20 + PALM_WINDOW_MS).ok).toBe(true);
  });

  it("实战里用手掌拍两个格子,一分都拿不到", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(8), { need: 2 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 100);
    expect(d.tap("left", 0).outcome).toBe("good");
    clock.advance(15);
    expect(d.tap("left", 1).outcome).toBe("palm");
    clock.advance(15);
    // 一巴掌下去这一轮就作废了，后面的手指再落下来也不算
    expect(d.tap("left", 2).outcome).toBe("ignored");
    expect(d.finish().delta.left).toBe(0);
  });

  it("反应回合里一巴掌盖住四个格子:压中了也白搭,分会被收回去", () => {
    const clock = fakeClock();
    const plan = buildRound("reaction", mulberry32(19));
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 90);
    // 一巴掌下去,四个格子几乎同时响,其中一个正好是该点的那个
    const order = [plan.targets[0], ...plan.forbidden];
    expect(d.tap("left", slotPos("left", order[0])).outcome).toBe("win");
    clock.advance(8);
    expect(d.tap("left", slotPos("left", order[1])).outcome).toBe("palm");
    const r = d.finish();
    expect(r.delta.left).toBe(0);
    expect(r.winner).toBeNull();
  });

  it("被判手掌拍之后这一轮就没份了,再点也不算", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(23), { need: 2 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 90);
    d.tap("left", 0);
    clock.advance(10);
    expect(d.tap("left", 1).outcome).toBe("palm");
    clock.advance(400);
    expect(d.tap("left", 2).outcome).toBe("ignored");
    expect(d.finish().delta.left).toBe(0);
  });

  it("一侧被判手掌拍不牵连另一侧", () => {
    const clock = fakeClock();
    const plan = buildRound("count", mulberry32(8), { need: 2 });
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 100);
    d.tap("left", 0);
    d.tap("right", 0);
    clock.advance(10);
    expect(d.tap("left", 1).outcome).toBe("palm");
    clock.advance(300);
    expect(d.tap("right", 1).outcome).toBe("good");
    const r = d.finish();
    expect(r.delta.left).toBe(0);
    expect(r.delta.right).toBe(1);
  });
});

describe("红蓝点点 1.2 · 亮灯节奏", () => {
  it("预备时长永远在下限与上限之间,禁止无预警闪现", () => {
    for (let i = 0; i < 200; i++) {
      const ms = readyDelay(mulberry32(i));
      expect(ms).toBeGreaterThanOrEqual(READY_MIN_MS);
      expect(ms).toBeLessThanOrEqual(READY_MAX_MS);
    }
    expect(readyDelay(() => 0)).toBe(READY_MIN_MS);
    expect(readyDelay(() => 1)).toBe(READY_MAX_MS);
  });

  it("每一份计划都自带预备与作答窗口,窗口有地板", () => {
    for (const kind of ROUND_KINDS) {
      for (const plan of samplePlans(kind, 20)) {
        expect(plan.readyMs).toBeGreaterThanOrEqual(READY_MIN_MS);
        expect(plan.liveMs).toBeGreaterThanOrEqual(LIVE_FLOOR_MS);
      }
    }
    expect(buildRound("reaction", mulberry32(1), { liveMs: 10 }).liveMs).toBe(LIVE_FLOOR_MS);
  });
});

describe("红蓝点点 1.2 · AI 四档", () => {
  it("四档反应时间正好是 600 / 420 / 300 / 220ms,一档比一档快", () => {
    expect(AI_TIERS.map((t) => t.reactionMs)).toEqual([600, 420, 300, 220]);
    for (let i = 1; i < AI_TIERS.length; i++) {
      expect(AI_TIERS[i].reactionMs).toBeLessThan(AI_TIERS[i - 1].reactionMs);
    }
  });

  it("每一档都会失手,没有失误率为 0 的完美电脑", () => {
    for (const t of AI_TIERS) {
      expect(t.missRate).toBeGreaterThan(0);
      expect(t.missRate).toBeLessThan(0.5);
    }
    for (let i = 1; i < AI_TIERS.length; i++) {
      expect(AI_TIERS[i].missRate).toBeLessThan(AI_TIERS[i - 1].missRate);
    }
  });

  it("出手时间带抖动但永远大于 0,压不到人做不到的地步", () => {
    for (let tier = 0; tier < AI_TIERS.length; tier++) {
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const ms = aiReactionMs(tier, mulberry32(i * 31 + tier));
        expect(ms).toBeGreaterThanOrEqual(AI_MIN_REACTION_MS);
        expect(ms).toBeGreaterThan(0);
        seen.add(ms);
      }
      expect(seen.size).toBeGreaterThan(5);
      // 极端运气也不会变成 0ms
      expect(aiReactionMs(tier, () => 0)).toBeGreaterThanOrEqual(AI_MIN_REACTION_MS);
    }
  });

  it("档位越界会被夹回四档之内", () => {
    expect(aiTier(-3).key).toBe(AI_TIERS[0].key);
    expect(aiTier(99).key).toBe(AI_TIERS[3].key);
    expect(aiTier(Number.NaN).key).toBe(AI_TIERS[0].key);
  });

  it("失误率是真的会触发的:固定种子跑 400 轮,最慢的一档失手明显更多", () => {
    const count = (tier: number) => {
      let n = 0;
      for (let i = 0; i < 400; i++) if (aiMisses(tier, mulberry32(i + 1))) n++;
      return n;
    };
    const gentle = count(0);
    const ace = count(3);
    expect(gentle).toBeGreaterThan(0);
    expect(ace).toBeGreaterThan(0);
    expect(gentle).toBeGreaterThan(ace);
  });

  it("1.1 关卡表里的出手时间能折算成四档,越快的关档位越高", () => {
    expect(aiTierForDelay(1400)).toBe(0);
    expect(aiTierForDelay(800)).toBe(1);
    expect(aiTierForDelay(620)).toBe(2);
    expect(aiTierForDelay(500)).toBe(3);
    expect(aiTierForDelay(Number.NaN)).toBe(0);
  });
});

describe("红蓝点点 1.2 · 无尽「点到手软」", () => {
  it("头四轮把四种回合各过一遍,之后随机", () => {
    const first = [1, 2, 3, 4].map((r) => endlessRoundKind(r, mulberry32(r)));
    expect(first).toEqual(ROUND_KINDS);
    const later = new Set<RoundKind>();
    for (let i = 5; i < 200; i++) later.add(endlessRoundKind(i, mulberry32(i)));
    expect(later.size).toBe(4);
  });

  it("节奏一轮比一轮快,但作答窗口和喘息都有地板", () => {
    expect(endlessLiveMs(1)).toBeGreaterThan(endlessLiveMs(20));
    expect(endlessLiveMs(9999)).toBe(LIVE_FLOOR_MS);
    expect(endlessGapMs(1)).toBeGreaterThan(endlessGapMs(20));
    expect(endlessGapMs(9999)).toBe(320);
    expect(endlessLiveMs(Number.NaN)).toBe(endlessLiveMs(1));
  });

  it("失误三次就结束,陪练的档位随轮数升到顶", () => {
    expect(ENDLESS_MISS_LIMIT).toBe(3);
    expect(endlessAiTier(1)).toBe(0);
    expect(endlessAiTier(8)).toBe(1);
    expect(endlessAiTier(18)).toBe(2);
    expect(endlessAiTier(30)).toBe(3);
    expect(endlessAiTier(9999)).toBe(3);
  });

  it("成绩记的是撑过的回合数,负数与脏数据都归零", () => {
    expect(endlessRounds(17)).toBe(17);
    expect(endlessRounds(-4)).toBe(0);
    expect(endlessRounds(Number.NaN)).toBe(0);
    expect(endlessRounds(12.8)).toBe(12);
  });

  it("三次失误的完整走法:第三次一到就该收工", () => {
    let misses = 0;
    let cleared = 0;
    for (let round = 1; round <= 20 && misses < ENDLESS_MISS_LIMIT; round++) {
      const clock = fakeClock();
      const kind = endlessRoundKind(round, mulberry32(round));
      const plan = buildRound(kind, mulberry32(round * 7), { liveMs: endlessLiveMs(round) });
      const d = createDuel(plan, clock.now, ["left"]);
      clock.set(d.lightAt + 120);
      // 单数轮好好点,双数轮故意点错
      const seq = plan.kind === "order" ? plan.order : plan.targets.slice(0, plan.need);
      if (round % 2 === 1) {
        for (const slot of seq) {
          d.tap("left", slotPos("left", slot));
          clock.advance(200);
        }
      } else if (plan.forbidden.length > 0) {
        d.tap("left", slotPos("left", plan.forbidden[0]));
      } else {
        for (const slot of plan.targets) {
          d.tap("left", slotPos("left", slot));
          clock.advance(200);
        }
      }
      if (d.finish().delta.left > 0) cleared++;
      else misses++;
    }
    expect(misses).toBe(ENDLESS_MISS_LIMIT);
    expect(cleared).toBeGreaterThan(0);
  });
});

describe("红蓝点点 1.2 · 边界与稳态", () => {
  it("窗口关掉之后再点什么都不算", () => {
    const clock = fakeClock();
    const plan = buildRound("reaction", mulberry32(41));
    const d = createDuel(plan, clock.now);
    clock.set(d.closeAt + 5);
    expect(d.tap("left", slotPos("left", plan.targets[0])).outcome).toBe("ignored");
    expect(d.finish().delta.left).toBe(0);
  });

  it("结算是幂等的,调两次拿到同一份结果", () => {
    const clock = fakeClock();
    const plan = buildRound("reaction", mulberry32(43));
    const d = createDuel(plan, clock.now);
    clock.set(d.lightAt + 100);
    d.tap("left", slotPos("left", plan.targets[0]));
    const a = d.finish();
    const b = d.finish();
    expect(a).toEqual(b);
    expect(d.settled()).toBe(true);
  });

  it("同一份种子生成的计划完全一样(可复现)", () => {
    for (const kind of ROUND_KINDS) {
      expect(buildRound(kind, mulberry32(77))).toEqual(buildRound(kind, mulberry32(77)));
    }
  });
});
