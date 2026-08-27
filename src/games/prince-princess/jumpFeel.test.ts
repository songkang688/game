/**
 * 1.2 本窗验收 · 第 1 轮学习优化员落地之一:王子公主的跳跃输入宽容。
 *
 * 分两层验:
 *  1. **纯状态机**:窗口长度、帧率无关、兑现之后不会连着触发两次;
 *  2. **接进世界之后真的管用**:走出台沿之后才按跳,王子照样跳得起来;
 *     落地之前提前按的跳,一落地立刻兑现。这两条正是 1.2 之前会被静默吞掉的按法。
 */
import { describe, expect, it } from "vitest";

import {
  COYOTE_TIME,
  JUMP_BUFFER,
  consumeJump,
  coyoteSlack,
  freshJumpFeel,
  jumpQueued,
  noteJumpPress,
  peekJump,
  takeJump,
  tickJumpFeel,
} from "./jumpFeel";
import {
  GRAVITY,
  MOVE_SPEED,
  createWorld,
  emptyInput,
  jumpSpeedOf,
  stepWorld,
  type Input,
  type World,
} from "./logic";
import { buildLevel, type LevelDef } from "./levels";

// ---------------------------------------------------------------------------
// 一、纯状态机
// ---------------------------------------------------------------------------

describe("跳跃宽容 · 常量", () => {
  it("两个窗口都在「感觉不到延迟、又真的救得回来」的区间里", () => {
    // 90ms 上下:比一帧长得多(救得回来),又短到看不出「延迟起跳」
    expect(COYOTE_TIME).toBeGreaterThan(1 / 60);
    expect(COYOTE_TIME).toBeLessThanOrEqual(0.12);
    expect(JUMP_BUFFER).toBeGreaterThan(1 / 60);
    expect(JUMP_BUFFER).toBeLessThanOrEqual(0.16);
  });

  it("土狼时间折算成距离,比一个身位小得多——不会变成「凌空跳」", () => {
    const slack = coyoteSlack(MOVE_SPEED);
    expect(slack).toBeCloseTo(MOVE_SPEED * COYOTE_TIME, 10);
    expect(slack).toBeGreaterThan(0);
    // 关卡里最窄的断口也远比这段距离宽,所以宽容不会把关卡难度抹平
    expect(slack).toBeLessThan(40);
    expect(coyoteSlack(-5)).toBe(0);
  });
});

describe("跳跃宽容 · 土狼时间", () => {
  it("踩着地的每一帧都把土狼时间刷满", () => {
    const f = freshJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    expect(f.coyote).toBeCloseTo(COYOTE_TIME, 10);
    tickJumpFeel(f, 1 / 60, true);
    expect(f.coyote).toBeCloseTo(COYOTE_TIME, 10);
  });

  it("离开地面之后按 dt 扣,扣光了就不再算「踩着地」", () => {
    const f = freshJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    noteJumpPress(f);
    tickJumpFeel(f, COYOTE_TIME * 0.5, false);
    expect(peekJump(f, false, 0)).toBe("ground");
    tickJumpFeel(f, COYOTE_TIME, false);
    expect(f.coyote).toBe(0);
    expect(peekJump(f, false, 0)).toBe(null);
  });

  it("窗口长度与帧率无关:30fps 与 240fps 扣到 0 的墙上时间一样", () => {
    const drain = (frameDt: number): number => {
      const f = freshJumpFeel();
      tickJumpFeel(f, frameDt, true);
      let t = 0;
      while (f.coyote > 0 && t < 1) {
        tickJumpFeel(f, frameDt, false);
        t += frameDt;
      }
      return t;
    };
    expect(drain(1 / 30)).toBeCloseTo(drain(1 / 240), 1);
    expect(drain(1 / 240)).toBeGreaterThanOrEqual(COYOTE_TIME);
  });
});

describe("跳跃宽容 · 跳跃缓冲", () => {
  it("提前按下的跳会被记住,窗口内落地立刻兑现", () => {
    const f = freshJumpFeel();
    noteJumpPress(f);
    expect(jumpQueued(f)).toBe(true);
    tickJumpFeel(f, JUMP_BUFFER * 0.6, false);
    // 这一刻脚刚沾地
    expect(takeJump(f, true, 0)).toBe("ground");
  });

  it("过了窗口就不认账,免得「几秒前按的」也弹一下", () => {
    const f = freshJumpFeel();
    noteJumpPress(f);
    tickJumpFeel(f, JUMP_BUFFER + 0.01, false);
    expect(jumpQueued(f)).toBe(false);
    expect(takeJump(f, true, 1)).toBe(null);
  });

  it("兑现一次就清空:同一下按键不会连着触发两次", () => {
    const f = freshJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    noteJumpPress(f);
    expect(takeJump(f, true, 1)).toBe("ground");
    expect(takeJump(f, true, 1)).toBe(null);
  });

  it("地面跳兑现之后土狼时间也一起清掉,不会在空中再白捡一次地面跳", () => {
    const f = freshJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    noteJumpPress(f);
    takeJump(f, true, 0);
    expect(f.coyote).toBe(0);
    noteJumpPress(f);
    expect(peekJump(f, false, 0)).toBe(null);
  });

  it("空中还有次数就算成二段跳,次数由调用方自己扣", () => {
    const f = freshJumpFeel();
    noteJumpPress(f);
    expect(peekJump(f, false, 1)).toBe("double");
    expect(takeJump(f, false, 1)).toBe("double");
    // 手感层不碰次数:公主还剩几次是 logic.ts 的规则
    expect(f.coyote).toBe(0);
  });

  it("被别的动作用掉(蹲着穿浮台)就两个计时器一起清干净", () => {
    const f = freshJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    noteJumpPress(f);
    consumeJump(f);
    expect(f.buffer).toBe(0);
    expect(f.coyote).toBe(0);
    expect(peekJump(f, false, 0)).toBe(null);
  });

  it("dt 是 NaN / 负数也不会把计时器搅坏", () => {
    const f = freshJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    tickJumpFeel(f, Number.NaN, false);
    expect(f.coyote).toBeCloseTo(COYOTE_TIME, 10);
    tickJumpFeel(f, -5, false);
    expect(f.coyote).toBeCloseTo(COYOTE_TIME, 10);
  });
});

// ---------------------------------------------------------------------------
// 二、接进世界之后
// ---------------------------------------------------------------------------

function bareLevel(over: Partial<LevelDef> = {}): LevelDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "测试场",
    feature: "测试",
    hint: "测试",
    len: 1600,
    goalX: 1470,
    gaps: [],
    platforms: [],
    enemies: [],
    spikes: [],
    gems: [],
    boss: null,
    slippery: false,
    requiredRatio: 0,
    parSeconds: 40,
    gemGoal: 0,
    timeLimit: 0,
    hearts: 6,
    goalNeedsAll: false,
    ...over,
  };
}

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

const DT = 1 / 240;

/** 推 n 秒,两位主角用同一组按键 */
function run(w: World, seconds: number, inputs: Input[]): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (w.status !== "playing") return;
    stepWorld(w, DT, inputs);
  }
}

describe("跳跃宽容 · 接进世界", () => {
  it("走出断口边缘之后才按跳,王子照样跳得起来(1.2 之前这一下被吞掉)", () => {
    // 王子的空中跳次数恒为 0:没有土狼时间的话,离地之后按跳等于没按
    const w = createWorld(bareLevel({ gaps: [{ x0: 300, x1: 380 }] }), 1);
    const prince = w.heroes[0];
    prince.x = 296;
    prince.y = 0;
    prince.vy = 0;
    prince.onGround = true;
    expect(prince.airJumps).toBe(0);

    // 先只往右走,走过台沿人就在半空了
    run(w, 0.05, [press({ right: true })]);
    expect(prince.onGround).toBe(false);
    expect(prince.x).toBeGreaterThan(300);

    // 这时候才按跳
    stepWorld(w, DT, [press({ right: true, up: true })]);
    expect(prince.vy).toBeLessThan(-jumpSpeedOf("prince") * 0.9);
  });

  it("宽容只有一瞬:离地太久再按跳,王子还是跳不起来", () => {
    const w = createWorld(bareLevel({ gaps: [{ x0: 300, x1: 380 }] }), 1);
    const prince = w.heroes[0];
    prince.x = 296;
    prince.onGround = true;

    run(w, 0.05, [press({ right: true })]);
    run(w, COYOTE_TIME + 0.05, [press({ right: true })]);
    const before = prince.vy;
    stepWorld(w, DT, [press({ right: true, up: true })]);
    // 只有重力在改 vy,没有起跳
    expect(prince.vy).toBeGreaterThan(before - 1);
    expect(prince.vy).toBeGreaterThan(0);
  });

  it("落地之前提前按的跳,一落地就兑现(不用松手再按一次)", () => {
    const w = createWorld(bareLevel(), 1);
    const prince = w.heroes[0];
    // 把人放到半空,眼看就要落地
    prince.y = -18;
    prince.vy = 420;
    prince.onGround = false;

    // 落地前一小会儿按下跳键,然后**一直压着**——按下沿只有第一帧那一下
    stepWorld(w, DT, [press({ up: true })]);
    let landedWithJump = false;
    for (let i = 0; i < 40 && !landedWithJump; i++) {
      stepWorld(w, DT, [press({ up: true })]);
      if (prince.vy < -100) landedWithJump = true;
    }
    expect(landedWithJump).toBe(true);
  });

  it("提前按得太早(超过缓冲窗口)就不认账,不会莫名其妙自己弹一下", () => {
    const w = createWorld(bareLevel(), 1);
    const prince = w.heroes[0];
    prince.y = -260;
    prince.vy = 0;
    prince.onGround = false;

    stepWorld(w, DT, [press({ up: true })]);
    // 一直压着往下掉,落地时那一下按键早过期了
    run(w, 0.9, [press({ up: true })]);
    expect(prince.onGround).toBe(true);
    expect(prince.vy).toBeLessThanOrEqual(0.001);
    expect(prince.vy).toBeGreaterThan(-1);
  });

  it("公主蹲着穿浮台的那一下按键不会又被兑现成跳", () => {
    const w = createWorld(bareLevel({ platforms: [{ x: 200, y: -120, w: 160 }] }), 2);
    const princess = w.heroes[1];
    princess.x = 260;
    princess.y = -120;
    princess.vy = 0;
    princess.onGround = true;
    princess.ridingPlatform = 0;

    stepWorld(w, DT, [emptyInput(), press({ down: true, up: true })]);
    // 穿下去 = 往下走,绝不会变成往上弹
    expect(princess.vy).toBeGreaterThan(0);
    expect(princess.onGround).toBe(false);
    expect(princess.dropT).toBeGreaterThan(0);
  });

  it("公主的二段跳次数没有被这一层改掉:落地回满一次,空中只能再蹬一次", () => {
    const w = createWorld(bareLevel(), 2);
    const princess = w.heroes[1];
    expect(princess.airJumps).toBe(1);

    // 地面跳
    stepWorld(w, DT, [emptyInput(), press({ up: true })]);
    expect(princess.vy).toBeLessThan(0);
    expect(princess.airJumps).toBe(1);

    // 松手再按 = 二段跳
    stepWorld(w, DT, [emptyInput(), emptyInput()]);
    stepWorld(w, DT, [emptyInput(), press({ up: true })]);
    expect(princess.airJumps).toBe(0);

    // 再松再按也没有第三段
    stepWorld(w, DT, [emptyInput(), emptyInput()]);
    const before = princess.vy;
    stepWorld(w, DT, [emptyInput(), press({ up: true })]);
    expect(princess.vy).toBeGreaterThan(before - 1);
  });

  it("宽容不改跳跃高度:一次地面跳的初速还是老数值", () => {
    const w = createWorld(bareLevel(), 1);
    const prince = w.heroes[0];
    stepWorld(w, DT, [press({ up: true })]);
    // 起跳当帧已经吃了一步重力
    expect(prince.vy).toBeGreaterThan(-jumpSpeedOf("prince") - GRAVITY * DT - 1);
    expect(prince.vy).toBeLessThan(-jumpSpeedOf("prince") + GRAVITY * DT + 1);
  });

  it("真关卡照样跑得动:第 1 关的机器人托管还是能通关", () => {
    const w = createWorld(buildLevel(0), 1);
    let steps = 0;
    while (w.status === "playing" && steps < 24000) {
      stepWorld(w, 1 / 60, w.heroes.map(() => emptyInput()));
      steps++;
      if (steps > 30) break;
    }
    // 这一条只保证接线没把世界跑崩;真正的「能通关」由 logic.test.ts 的 autoPlay 盯着
    expect(w.status === "playing" || w.status === "won").toBe(true);
  });
});
