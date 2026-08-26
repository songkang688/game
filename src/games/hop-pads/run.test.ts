/**
 * 跳跳台 · 一局状态机的回归。
 *
 * 规格第十三节点名要的:连击累加与清零、弹簧台多跳、一次台消失、
 * 移动台必须用**落地时刻**的位置判定。
 */
import { describe, expect, it } from "vitest";
import { BASE_SCORE, flightTime, jumpDistance, powerForDistance } from "./physics";
import { EASY, makePad, onPad, padTick, type Pad } from "./pads";
import { createRun, currentPad, hop, requiredPower, type RunState } from "./run";
import { levelDifficulty } from "./levels";

/** 手搭一局:台序自己写死,不走生成器 */
function handRun(pads: Pad[]): RunState {
  return {
    seed: 1,
    difficulty: EASY,
    pads,
    index: 0,
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    hops: 0,
    alive: true,
  };
}

/** 一条笔直的稳台路,每座间隔 dist */
function straightPads(count: number, dist = 140, r = 40): Pad[] {
  const pads: Pad[] = [makePad({ kind: "steady", x: 0, z: 0, r: 46 })];
  for (let i = 1; i <= count; i++) pads.push(makePad({ kind: "steady", x: 0, z: dist * i, r }));
  return pads;
}

describe("连击与分数", () => {
  it("连着踩中圆心,连击一路加,分数按倍数涨", () => {
    let run = handRun(straightPads(4));
    const gains: number[] = [];
    for (let i = 0; i < 4; i++) {
      const step = hop(run, requiredPower(run));
      expect(step.result.verdict).toBe("perfect");
      gains.push(step.result.gained);
      run = step.state;
      expect(run.combo).toBe(i + 1);
    }
    expect(gains).toEqual([BASE_SCORE * 1, BASE_SCORE * 2, BASE_SCORE * 3, BASE_SCORE * 4]);
    expect(run.score).toBe(BASE_SCORE * (1 + 2 + 3 + 4));
    expect(run.perfects).toBe(4);
    expect(run.bestCombo).toBe(4);
    expect(run.hops).toBe(4);
    expect(run.alive).toBe(true);
  });

  it("站到边上连击立刻清零,人还站得住,基础分照拿", () => {
    let run = handRun(straightPads(4));
    run = hop(run, requiredPower(run)).state;
    run = hop(run, requiredPower(run)).state;
    expect(run.combo).toBe(2);

    // 少按一点,落在圆心外但还在台面上
    const short = powerForDistance(jumpDistance(requiredPower(run)) - 25);
    const step = hop(run, short);
    expect(step.result.verdict).toBe("edge");
    expect(step.result.gained).toBe(BASE_SCORE);
    expect(step.state.combo).toBe(0);
    expect(step.state.alive).toBe(true);
    // 最高连击还记着刚才那两连
    expect(step.state.bestCombo).toBe(2);

    // 清零之后重新攒,又从 1 连起算
    const again = hop(step.state, requiredPower(step.state));
    expect(again.state.combo).toBe(1);
    expect(again.result.gained).toBe(BASE_SCORE);
  });

  it("落空就地结束这一局,分数停在掉下去之前", () => {
    let run = handRun(straightPads(3));
    run = hop(run, requiredPower(run)).state;
    const before = run.score;
    const step = hop(run, 1);
    expect(step.result.verdict).toBe("miss");
    expect(step.state.alive).toBe(false);
    expect(step.state.score).toBe(before);
    expect(step.state.combo).toBe(0);
    // 掉下去之后再按也不会有事发生
    const dead = hop(step.state, 0.5);
    expect(dead.state).toBe(step.state);
    expect(dead.result.verdict).toBe("miss");
  });

  it("按得太轻同样是落空,不会瞬间判活", () => {
    const run = handRun(straightPads(3));
    expect(hop(run, 0).result.verdict).toBe("miss");
  });
});

describe("弹簧台自动多跳一次", () => {
  it("落到弹簧台会白送一跳,一口气前进两座、连击涨两级", () => {
    const pads = straightPads(4);
    pads[1] = makePad({ kind: "spring", x: 0, z: 140, r: 40 });
    let run = handRun(pads);
    const step = hop(run, requiredPower(run));
    run = step.state;
    expect(step.result.verdict).toBe("perfect");
    expect(step.result.bonus).not.toBeNull();
    expect(step.result.bonus?.verdict).toBe("perfect");
    expect(run.index).toBe(2);
    expect(run.combo).toBe(2);
    expect(run.hops).toBe(2);
    expect(run.score).toBe(BASE_SCORE * 1 + BASE_SCORE * 2);
    // 白送的那一跳把人放在下一座台的正中间
    expect(currentPad(run).z).toBe(280);
  });

  it("站到弹簧台边上一样会被弹走,只是连击先归了零", () => {
    const pads = straightPads(4);
    pads[1] = makePad({ kind: "spring", x: 0, z: 140, r: 40 });
    const run = handRun(pads);
    const short = powerForDistance(jumpDistance(requiredPower(run)) - 25);
    const step = hop(run, short);
    expect(step.result.verdict).toBe("edge");
    expect(step.result.bonus?.verdict).toBe("perfect");
    expect(step.state.index).toBe(2);
    expect(step.state.combo).toBe(1);
  });

  it("一串弹簧不会无限套娃", () => {
    const pads = straightPads(8);
    for (let i = 1; i <= 6; i++) pads[i] = makePad({ kind: "spring", x: 0, z: 140 * i, r: 40 });
    const run = handRun(pads);
    const step = hop(run, requiredPower(run));
    expect(step.state.index).toBeLessThanOrEqual(4);
    expect(step.state.alive).toBe(true);
  });
});

describe("一次台跳走即消失", () => {
  it("离开一次台之后它就塌了,回头再落算落空", () => {
    const pads = straightPads(3);
    pads[0] = makePad({ kind: "once", x: 0, z: 0, r: 46 });
    const run = handRun(pads);
    expect(run.pads[0].alive).toBe(true);
    const step = hop(run, requiredPower(run));
    expect(step.state.pads[0].alive).toBe(false);
    expect(onPad({ x: 0, z: 0 }, step.state.pads[0])).toBe("miss");
    // 原状态没被改坏
    expect(run.pads[0].alive).toBe(true);
  });

  it("稳台跳走之后还留在原地", () => {
    const run = handRun(straightPads(3));
    const step = hop(run, requiredPower(run));
    expect(step.state.pads[0].alive).toBe(true);
  });
});

describe("移动台按落地那一刻判定", () => {
  const slider = makePad({ kind: "slider", x: 0, z: 140, r: 40, amp: 25, period: 4, phase: 0 });

  it("台子在飞行途中滑走了,判定看的是落地那一刻的位置", () => {
    const run = handRun([makePad({ kind: "steady", x: 0, z: 0, r: 46 }), slider]);
    // 正对着「起跳那一刻」的台心按力度
    const power = powerForDistance(140);
    const step = hop(run, power);
    const landTime = flightTime(power);

    // 落点没变,可就是这段时间里台子横着挪开了
    expect(step.result.landing.z).toBeCloseTo(140, 8);
    expect(step.result.target.x).toBeCloseTo(padTick(slider, landTime).x, 10);
    expect(step.result.target.x).toBeGreaterThan(10);
    // 拿起跳那一刻的台子来看是完美,按落地那一刻算就只是边缘 —— 判定必须用后者
    expect(onPad(step.result.landing, padTick(slider, 0))).toBe("perfect");
    expect(step.result.verdict).toBe("edge");
  });

  it("同样一座台不滑动的话,这一跳就是完美 —— 差别只在于它动了", () => {
    const still = { ...slider, amp: 0 };
    const run = handRun([makePad({ kind: "steady", x: 0, z: 0, r: 46 }), still]);
    expect(hop(run, powerForDistance(140)).result.verdict).toBe("perfect");
  });

  it("requiredPower 会算上飞行途中的位移,收敛到当下最好的那个力度", () => {
    const run = handRun([makePad({ kind: "steady", x: 0, z: 0, r: 46 }), slider]);
    const p = requiredPower(run);
    const landAt = padTick(slider, flightTime(p));
    // 收敛条件:用这个力度飞过去,射程正好等于落地那一刻台心的距离
    expect(jumpDistance(p)).toBeCloseTo(Math.hypot(landAt.x, landAt.z), 4);
    expect(hop(run, p).result.verdict).not.toBe("miss");
  });

  it("挑台子快换向的那一下起跳,照样能踩中圆心", () => {
    // 相位选成「飞行区间正好对称地跨过一个端点」,起跳与落地时台子在同一个位置
    const p0 = powerForDistance(Math.hypot(25 * Math.sin(1.1529), 140));
    const dw = (Math.PI * 2 * flightTime(p0)) / 4;
    const timed = { ...slider, phase: Math.PI / 2 - dw / 2 };
    const run = handRun([makePad({ kind: "steady", x: 0, z: 0, r: 46 }), timed]);
    expect(hop(run, requiredPower(run)).result.verdict).toBe("perfect");
  });
});

describe("缩小台越拖越小", () => {
  it("下一座缩小台从玩家落地那一刻才开始缩", () => {
    const pads = straightPads(3);
    pads[2] = makePad({ kind: "shrink", x: 0, z: 280, r: 40, shrink: 10, minR: 16 });
    let run = handRun(pads);
    expect(run.pads[1].kind).toBe("steady");
    run = hop(run, requiredPower(run)).state;
    // 上了第 1 座台,第 2 座的缩小时钟从这一刻起走
    expect(run.pads[2].bornAt).toBeCloseTo(run.time, 10);
    expect(padTick(run.pads[2], run.time).r).toBe(40);
    expect(padTick(run.pads[2], run.time + 1).r).toBe(30);
  });
});

describe("整局跑起来", () => {
  it("createRun 按 seed 造台序,一路用理想力度能连跳很多座", () => {
    let run = createRun(2024, levelDifficulty(0, 0.3));
    for (let i = 0; i < 30 && run.alive; i++) run = hop(run, requiredPower(run)).state;
    expect(run.alive).toBe(true);
    expect(run.hops).toBe(30);
    expect(run.perfects).toBe(30);
    expect(run.combo).toBe(30);
  });

  it("台序会自动往前接,永远有下一座可跳", () => {
    let run = createRun(99, levelDifficulty(7, 0.5));
    for (let i = 0; i < 25 && run.alive; i++) {
      expect(run.pads.length).toBeGreaterThan(run.index + 1);
      run = hop(run, requiredPower(run)).state;
    }
    expect(run.alive).toBe(true);
  });

  it("hop 不会改坏传进去的状态(纯函数)", () => {
    const run = createRun(7, levelDifficulty(3, 0.5));
    const snapshot = JSON.stringify(run);
    hop(run, 0.6);
    hop(run, requiredPower(run));
    expect(JSON.stringify(run)).toBe(snapshot);
  });
});
