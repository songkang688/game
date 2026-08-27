import { describe, expect, it } from "vitest";
import { angleDelta, lenToRadius, normAngle, type Pt } from "./body";
import {
  AI_PARAMS,
  AI_TIERS,
  AI_TIER_LABELS,
  aiSteer,
  arcSafety,
  cutTarget,
  duelWins,
  predictHead,
  rayDanger,
  rng,
  simulateDuel,
  tierBlurb,
  type AiRival,
  type AiSelf,
  type AiTier,
  type AiView
} from "./ai";

function self(over: Partial<AiSelf> = {}): AiSelf {
  return { id: "me", x: 0, y: 0, angle: 0, length: 40, radius: lenToRadius(40), ...over };
}

function rival(id: string, head: Pt, angle: number, nodes: Pt[] = []): AiRival {
  return { id, alive: true, nodes, radius: 8, head, angle, length: 40, speed: 170 };
}

function view(over: Partial<AiView> = {}): AiView {
  return { self: self(), foods: [], orbs: [], others: [], zone: null, mapR: 800, cx: 0, cy: 0, ...over };
}

const fixed = (): number => 0.5;

describe("snake-royale · AI 档位表", () => {
  it("四档齐全,标签是中文", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    expect(AI_TIER_LABELS.rookie).toBe("菜鸟");
    expect(AI_TIER_LABELS.hell).toBe("地狱");
  });

  it("越高档看得越远、躲得越好、探路越长", () => {
    for (let i = 1; i < AI_TIERS.length; i++) {
      const lo = AI_PARAMS[AI_TIERS[i - 1]];
      const hi = AI_PARAMS[AI_TIERS[i]];
      expect(hi.sight).toBeGreaterThan(lo.sight);
      expect(hi.avoid).toBeGreaterThan(lo.avoid);
      expect(hi.lookAhead).toBeGreaterThan(lo.lookAhead);
    }
  });

  it("菜鸟完全不会躲,只有高档才会拦头和卡边界", () => {
    expect(AI_PARAMS.rookie.avoid).toBe(0);
    expect(AI_PARAMS.rookie.cut).toBe(0);
    expect(AI_PARAMS.normal.cut).toBe(0);
    expect(AI_PARAMS.pro.cut).toBeGreaterThan(0);
    expect(AI_PARAMS.hell.trap).toBeGreaterThan(0);
    expect(AI_PARAMS.pro.trap).toBe(0);
  });

  it("每一档都有一句给孩子看的说明,不出现商标", () => {
    for (const t of AI_TIERS) {
      const text = tierBlurb(t);
      expect(text.length).toBeGreaterThan(6);
      expect(text).not.toMatch(/贪吃蛇大作战|球球大作战|我的世界/);
    }
  });
});

describe("snake-royale · 探路", () => {
  it("空地上一路干净", () => {
    expect(arcSafety(self(), 0, 1, [], 800)).toBe(1);
    expect(rayDanger({ x: 0, y: 0 }, 0, 200, "me", [], 800)).toBe(0);
  });

  it("正前方有身体就会算出危险,而且越近越危险", () => {
    const near = rival("bot", { x: 900, y: 900 }, 0, [{ x: 60, y: 0 }]);
    const far = rival("bot", { x: 900, y: 900 }, 0, [{ x: 200, y: 0 }]);
    const sNear = arcSafety(self(), 0, 1.2, [near], 800);
    const sFar = arcSafety(self(), 0, 1.2, [far], 800);
    expect(sNear).toBeLessThan(1);
    expect(sNear).toBeLessThan(sFar);
  });

  it("拐开就能躲过正前方那一段身体", () => {
    const wall: Pt[] = [];
    for (let i = -3; i <= 3; i++) wall.push({ x: 120, y: i * 10 });
    const bot = rival("bot", { x: 900, y: 900 }, 0, wall);
    const straight = arcSafety(self(), 0, 1.2, [bot], 800);
    const turned = arcSafety(self(), -3.1, 1.2, [bot], 800);
    expect(turned).toBeGreaterThan(straight);
  });

  it("已经休息的蛇不再挡路", () => {
    const resting: AiRival = { ...rival("bot", { x: 900, y: 900 }, 0, [{ x: 60, y: 0 }]), alive: false };
    expect(arcSafety(self(), 0, 1.2, [resting], 800)).toBe(1);
  });

  it("快贴到围栏也算有点危险,但没有撞身体那么严重", () => {
    const s = arcSafety(self({ x: 780, y: 0 }), 0, 1.2, [], 800);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThan(0);
  });

  it("预测对手一秒后的位置", () => {
    const r = rival("bot", { x: 0, y: 0 }, 0);
    const p = predictHead(r, 1);
    expect(p.x).toBeCloseTo(170, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(predictHead(r, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("snake-royale · 拦头", () => {
  it("低档根本不会去拦", () => {
    const v = view({ others: [rival("bot", { x: 200, y: 0 }, Math.PI / 2)] });
    expect(cutTarget(v, AI_PARAMS.rookie)).toBeNull();
    expect(cutTarget(v, AI_PARAMS.normal)).toBeNull();
  });

  it("高档会切到对手前进方向的前面,而不是追它的头", () => {
    const bot = rival("bot", { x: 200, y: 0 }, Math.PI / 2);
    const out = cutTarget(view({ others: [bot] }), AI_PARAMS.pro);
    expect(out).not.toBeNull();
    // 对手朝 +y 走,拦截点必须在它前面(y 更大)
    expect(out?.point.y).toBeGreaterThan(bot.head.y);
  });

  it("对手在身后就不掉头去追", () => {
    const behind = rival("bot", { x: -200, y: 0 }, 0);
    expect(cutTarget(view({ others: [behind] }), AI_PARAMS.hell)).toBeNull();
  });

  it("看不见那么远的对手就不理会", () => {
    const faraway = rival("bot", { x: 5000, y: 0 }, 0);
    expect(cutTarget(view({ others: [faraway] }), AI_PARAMS.pro)).toBeNull();
  });

  it("地狱档会把对手回中心的路先占住(卡边界)", () => {
    const nearWall = rival("bot", { x: 700, y: 0 }, Math.PI / 2);
    const v = view({ self: self({ x: 400, y: 0 }), others: [nearWall], mapR: 800 });
    const hellPoint = cutTarget(v, AI_PARAMS.hell)?.point;
    const proPoint = cutTarget(v, AI_PARAMS.pro)?.point;
    expect(hellPoint).toBeDefined();
    expect(proPoint).toBeDefined();
    // 地狱档的拦截点更靠中心一侧
    expect(hellPoint!.x).toBeLessThan(proPoint!.x);
  });
});

describe("snake-royale · 一帧决策", () => {
  it("菜鸟朝最近的豆直走", () => {
    const move = aiSteer(view({ foods: [{ x: 100, y: 100 }, { x: -400, y: 0 }] }), "rookie", fixed);
    expect(Math.abs(angleDelta(move.target, Math.PI / 4))).toBeLessThan(0.4);
  });

  it("场上什么都没有也能给出一个合法角度", () => {
    for (const t of AI_TIERS) {
      const move = aiSteer(view(), t, fixed);
      expect(Number.isFinite(move.target)).toBe(true);
      expect(move.target).toBe(normAngle(move.target));
    }
  });

  it("会躲的档看到正前方的身体就不会直冲过去", () => {
    const wall: Pt[] = [];
    for (let i = -4; i <= 4; i++) wall.push({ x: 130, y: i * 9 });
    const v = view({ foods: [{ x: 400, y: 0 }], others: [rival("bot", { x: 900, y: 900 }, 0, wall)] });
    const dumb = aiSteer(v, "rookie", fixed);
    const smart = aiSteer(v, "hell", fixed);
    expect(Math.abs(dumb.target)).toBeLessThan(0.25);
    expect(Math.abs(smart.target)).toBeGreaterThan(Math.abs(dumb.target));
  });

  it("圈外的时候会往圈心挪", () => {
    const v = view({
      self: self({ x: 600, y: 0, angle: 0 }),
      zone: { cx: 0, cy: 0, radius: 200 }
    });
    const move = aiSteer(v, "pro", fixed);
    // 圈心在 -x 方向,所以要往回拐
    expect(Math.abs(move.target)).toBeGreaterThan(0.05);
  });

  it("长度不够富裕就不会乱按加速", () => {
    const v = view({ self: self({ length: 20 }), others: [rival("bot", { x: 300, y: 0 }, Math.PI / 2)] });
    expect(aiSteer(v, "hell", fixed).boost).toBe(false);
  });

  it("同样的输入和随机源,结果一模一样", () => {
    const v = view({ foods: [{ x: 50, y: 80 }], others: [rival("bot", { x: 200, y: 30 }, 1)] });
    const a = aiSteer(v, "hell", rng(7));
    const b = aiSteer(v, "hell", rng(7));
    expect(a).toEqual(b);
  });
});

describe("snake-royale · 固定 seed 对局", () => {
  it("同一个 seed 跑两次结果完全一样", () => {
    const a = simulateDuel("pro", "normal", 12345);
    const b = simulateDuel("pro", "normal", 12345);
    expect(a).toEqual(b);
  });

  it("一局总能分出结果,不会无限跑", () => {
    const r = simulateDuel("hell", "rookie", 999);
    expect(r.steps).toBeGreaterThan(0);
    expect(["a", "b", "draw"]).toContain(r.winner);
  });

  it("地狱档打菜鸟档 20 局,胜率明显更高", () => {
    const out = duelWins("hell", "rookie", 20);
    expect(out.a + out.b + out.draw).toBe(20);
    expect(out.a).toBeGreaterThanOrEqual(14);
    expect(out.a).toBeGreaterThan(out.b * 2);
  });

  it("相邻档位一路单调:普通 > 菜鸟,高手 > 普通,地狱 > 高手", () => {
    const pairs: [AiTier, AiTier][] = [
      ["normal", "rookie"],
      ["pro", "normal"],
      ["hell", "pro"]
    ];
    for (const [hi, lo] of pairs) {
      const out = duelWins(hi, lo, 20);
      expect(out.a).toBeGreaterThan(out.b);
    }
  });

  it("隔一档打也是高档赢面大", () => {
    expect(duelWins("hell", "normal", 20).a).toBeGreaterThan(duelWins("hell", "normal", 20).b);
  });

  it("随机源是固定 seed 的,同 seed 同序列", () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 5; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
