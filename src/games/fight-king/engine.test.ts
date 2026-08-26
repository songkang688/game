/**
 * 朵星格斗王 —— 对局状态机的整局回归测试。
 *
 * 这里不再单看某个纯函数，而是真的把比赛跑起来：
 * 走位、起跳、出招、格挡、破防、投技、受身、连段上限、顿帧、真实胜负，
 * 每一条都用"跑若干帧然后看状态"的方式验证。
 */
import { describe, expect, it } from "vitest";
import { aiInput, createBrain } from "./ai";
import {
  charOf,
  createMatch,
  currentMove,
  gapBetween,
  inputOf,
  moveUsable,
  neutralInput,
  pickMove,
  stepMatch,
  superReady,
  vigorRatio,
  type FighterState,
  type InputFrame,
  type MatchState
} from "./engine";
import {
  CHARACTERS,
  METER_MAX,
  STAGE_WIDTH,
  WALL_MARGIN,
  activeBoxAt,
  characterById,
  type MoveSlot
} from "./frames";
import {
  COMBO_LIMIT,
  NORMAL_WAKEUP_FRAMES,
  THROW_PROTECT_FRAMES,
  TECH_WINDOW,
  comboScale,
  movePhase,
  scaledPower,
  type Facing
} from "./rules";
import { cancelTargets, emptyContext } from "./training";

const N = neutralInput();

/** 跑若干帧，每帧用同一份输入 */
function run(s: MatchState, frames: number, i0: InputFrame = N, i1: InputFrame = N): MatchState {
  for (let i = 0; i < frames; i++) stepMatch(s, [i0, i1]);
  return s;
}

/** 跑若干帧，输入由回调按帧决定 */
function runWith(
  s: MatchState,
  frames: number,
  fn: (frame: number, s: MatchState) => [InputFrame, InputFrame]
): MatchState {
  for (let i = 0; i < frames; i++) stepMatch(s, fn(i, s));
  return s;
}

/** 一号位"追着打"：离得远就往前走，贴上了就按轻击 */
function chase(s: MatchState): [InputFrame, InputFrame] {
  const gap = gapBetween(s.fighters[0], s.fighters[1]);
  return [gap > 10 ? inputOf({ right: true }) : inputOf({ light: true }), N];
}

/** 把两个人摆到指定位置（测试专用，直接改坐标最省事） */
function place(s: MatchState, x0: number, x1: number): MatchState {
  s.fighters[0].x = x0;
  s.fighters[1].x = x1;
  return s;
}

function freshMatch(a = "duoduo", b = "xingxing", timeLimit = 60 * 90): MatchState {
  return createMatch(a, b, { config: { timeLimit } });
}

/* ------------------------------------------------------------------ */
/* 一、开局与选招                                                      */
/* ------------------------------------------------------------------ */

describe("开局", () => {
  it("两个人分站两边、面对面、元气满格", () => {
    const s = freshMatch();
    expect(s.fighters[0].x).toBeLessThan(s.fighters[1].x);
    expect(s.fighters[0].facing).toBe(1);
    expect(s.fighters[1].facing).toBe(-1);
    expect(s.fighters[0].vigor).toBe(characterById("duoduo").vigor);
    expect(s.fighters[1].vigor).toBe(characterById("xingxing").vigor);
    expect(s.over).toBe(false);
    expect(vigorRatio(s.fighters[0])).toBe(1);
  });

  it("增益能改元气上限", () => {
    const s = createMatch("duoduo", "xingxing", {
      buffs: [
        { vigorMul: 1, powerMul: 1, speedMul: 1 },
        { vigorMul: 1.5, powerMul: 1, speedMul: 1 }
      ]
    });
    expect(s.fighters[1].maxVigor).toBe(Math.round(characterById("xingxing").vigor * 1.5));
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
  });

  it("什么都不按，谁都不会掉元气", () => {
    const s = run(freshMatch(), 300);
    expect(s.fighters[0].vigor).toBe(s.fighters[0].maxVigor);
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
    expect(s.over).toBe(false);
  });
});

describe("按键组合选招", () => {
  const duo = characterById("duoduo");
  const ground = { airborne: false, meter: 0 };

  it("地面：轻 / 重 / 蹲轻 / 蹲重", () => {
    expect(pickMove(duo, inputOf({ light: true }), 1, ground)).toBe("5L");
    expect(pickMove(duo, inputOf({ heavy: true }), 1, ground)).toBe("5H");
    expect(pickMove(duo, inputOf({ down: true, light: true }), 1, ground)).toBe("2L");
    expect(pickMove(duo, inputOf({ down: true, heavy: true }), 1, ground)).toBe("2H");
  });

  it("前 / 后 加攻击键出必杀", () => {
    expect(pickMove(duo, inputOf({ right: true, light: true }), 1, ground)).toBe("s1");
    expect(pickMove(duo, inputOf({ right: true, heavy: true }), 1, ground)).toBe("s2");
    expect(pickMove(duo, inputOf({ left: true, heavy: true }), 1, ground)).toBe("s3");
    // 朝左时前后互换
    expect(pickMove(duo, inputOf({ left: true, light: true }), -1, ground)).toBe("s1");
    expect(pickMove(duo, inputOf({ right: true, heavy: true }), -1, ground)).toBe("s3");
  });

  it("轻重一起按是转圈摔；蹲着一起按且满槽才是超必杀", () => {
    expect(pickMove(duo, inputOf({ light: true, heavy: true }), 1, ground)).toBe("throw");
    expect(pickMove(duo, inputOf({ down: true, light: true, heavy: true }), 1, ground)).toBe("throw");
    expect(pickMove(duo, inputOf({ down: true, light: true, heavy: true }), 1, { airborne: false, meter: METER_MAX })).toBe(
      "super"
    );
  });

  it("空中只出得了跳跃攻击，有空中必杀的角色才多一招", () => {
    const air = { airborne: true, meter: 0 };
    expect(pickMove(duo, inputOf({ light: true }), 1, air)).toBe("jL");
    expect(pickMove(duo, inputOf({ heavy: true }), 1, air)).toBe("jH");
    // 朵朵没有空中必杀，前+重还是跳重击
    expect(pickMove(duo, inputOf({ right: true, heavy: true }), 1, air)).toBe("jH");
    // 星星的流星踢是空中专用
    const xing = characterById("xingxing");
    expect(pickMove(xing, inputOf({ right: true, heavy: true }), 1, air)).toBe("s2");
    // 在地上就出不了空中必杀
    expect(pickMove(xing, inputOf({ right: true, heavy: true }), 1, ground)).toBe("5H");
  });

  it("什么都不按就不出招", () => {
    expect(pickMove(duo, N, 1, ground)).toBeNull();
    expect(pickMove(duo, inputOf({ right: true }), 1, ground)).toBeNull();
  });

  it("moveUsable 会拦下姿势不对和能量不够的招", () => {
    const s = freshMatch("xingxing", "duoduo");
    const f = s.fighters[0];
    expect(moveUsable(f, "5L")).toBe(true);
    expect(moveUsable(f, "s2")).toBe(false); // 流星踢是空中专用
    expect(moveUsable(f, "super")).toBe(false); // 没能量
    f.meter = METER_MAX;
    expect(moveUsable(f, "super")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 二、走位与跳跃                                                      */
/* ------------------------------------------------------------------ */

describe("走位", () => {
  it("往前走会靠近对手，往后走会拉开", () => {
    const s = freshMatch();
    const before = gapBetween(s.fighters[0], s.fighters[1]);
    run(s, 30, inputOf({ right: true }));
    expect(gapBetween(s.fighters[0], s.fighters[1])).toBeLessThan(before);
    const mid = gapBetween(s.fighters[0], s.fighters[1]);
    run(s, 30, inputOf({ left: true }));
    expect(gapBetween(s.fighters[0], s.fighters[1])).toBeGreaterThan(mid);
  });

  it("走到底也出不了场地，两个人的身体不会叠在一起", () => {
    const s = freshMatch();
    run(s, 900, inputOf({ right: true }), inputOf({ left: true }));
    for (const f of s.fighters) {
      const half = charOf(f).halfWidth;
      expect(f.x).toBeGreaterThanOrEqual(WALL_MARGIN + half - 0.01);
      expect(f.x).toBeLessThanOrEqual(STAGE_WIDTH - WALL_MARGIN - half + 0.01);
    }
    const need = charOf(s.fighters[0]).halfWidth + charOf(s.fighters[1]).halfWidth;
    expect(Math.abs(s.fighters[0].x - s.fighters[1].x)).toBeGreaterThanOrEqual(need - 0.5);
  });

  it("按上会起跳，抛物线走完自己落地", () => {
    const s = freshMatch();
    stepMatch(s, [inputOf({ up: true }), N]);
    expect(s.fighters[0].airborne).toBe(true);
    let peak = 0;
    for (let i = 0; i < 120 && s.fighters[0].airborne; i++) {
      stepMatch(s, [N, N]);
      peak = Math.max(peak, s.fighters[0].y);
    }
    expect(peak).toBeGreaterThan(60);
    expect(s.fighters[0].airborne).toBe(false);
    expect(s.fighters[0].y).toBe(0);
  });

  it("啾啾跳得比墩墩高得多", () => {
    const jump = (id: string): number => {
      const s = createMatch(id, "duoduo", { config: { timeLimit: 0 } });
      stepMatch(s, [inputOf({ up: true }), N]);
      let peak = 0;
      for (let i = 0; i < 200 && s.fighters[0].airborne; i++) {
        stepMatch(s, [N, N]);
        peak = Math.max(peak, s.fighters[0].y);
      }
      return peak;
    };
    expect(jump("jiujiu")).toBeGreaterThan(jump("dundun") * 1.5);
  });

  it("按住后退键就是格挡姿势", () => {
    const s = freshMatch();
    run(s, 5, inputOf({ left: true }));
    expect(s.fighters[0].blocking).toBe(true);
    run(s, 5, inputOf({ right: true }));
    expect(s.fighters[0].blocking).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 三、命中、格挡、破防                                                */
/* ------------------------------------------------------------------ */

describe("命中", () => {
  it("轻击打中站着不动的人：元气下降、对手进硬直、有 hit 事件", () => {
    const s = place(freshMatch(), 400, 450);
    const before = s.fighters[1].vigor;
    let hit = false;
    runWith(s, 40, () => {
      if (s.events.some((e) => e.type === "hit")) hit = true;
      return [inputOf({ light: true }), N];
    });
    expect(hit).toBe(true);
    expect(s.fighters[1].vigor).toBeLessThan(before);
    expect(s.fighters[0].combo).toBeGreaterThanOrEqual(1);
  });

  it("命中会产生顿帧，顿帧期间整个世界定格", () => {
    const s = place(freshMatch(), 400, 450);
    let frameAtStop = -1;
    let stopSeen = false;
    for (let i = 0; i < 40; i++) {
      stepMatch(s, [inputOf({ light: true }), N]);
      if (s.hitStop > 0 && !stopSeen) {
        stopSeen = true;
        frameAtStop = s.frame;
      }
    }
    expect(stopSeen).toBe(true);
    // 顿帧那几帧里 frame 不会往前走
    const s2 = place(freshMatch(), 400, 450);
    let frozen = 0;
    let prev = s2.frame;
    for (let i = 0; i < 40; i++) {
      stepMatch(s2, [inputOf({ light: true }), N]);
      if (s2.frame === prev) frozen++;
      prev = s2.frame;
    }
    expect(frozen).toBeGreaterThan(0);
    expect(frameAtStop).toBeGreaterThan(0);
  });

  it("打空了不掉元气，攻击方照样要收招", () => {
    const s = place(freshMatch(), 200, 700);
    run(s, 40, inputOf({ light: true }));
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
    expect(s.fighters[0].combo).toBe(0);
  });

  it("命中会同时给双方涨能量，攻击方涨得多", () => {
    const s = place(freshMatch(), 400, 450);
    run(s, 40, inputOf({ light: true }));
    expect(s.fighters[0].meter).toBeGreaterThan(0);
    expect(s.fighters[1].meter).toBeGreaterThan(0);
    expect(s.fighters[0].meter).toBeGreaterThan(s.fighters[1].meter);
  });

  it("一直追着打能把能量攒满，攒满就放得出超必杀", () => {
    const s = place(freshMatch("duoduo", "xingxing", 0), 400, 450);
    runWith(s, 900, (_i, st) => chase(st));
    expect(s.fighters[0].meter).toBe(METER_MAX);
    expect(superReady(s.fighters[0])).toBe(true);
  });

  it("墩墩一下比闪闪重得多（只比第一下，不比出手快慢）", () => {
    const firstHitPower = (id: string): number => {
      const s = place(createMatch(id, "duoduo", { config: { timeLimit: 0 } }), 400, 450);
      const before = s.fighters[1].vigor;
      for (let i = 0; i < 120; i++) {
        stepMatch(s, [inputOf({ heavy: true }), N]);
        if (s.fighters[1].vigor < before) break;
      }
      return before - s.fighters[1].vigor;
    };
    expect(firstHitPower("dundun")).toBeGreaterThan(firstHitPower("shanshan"));
  });
});

describe("格挡与破防", () => {
  it("按住后退键能挡下中段重击，元气一点不掉，但格挡槽会掉", () => {
    const s = place(freshMatch(), 810, 856);
    const guardBefore = s.fighters[1].guard;
    let blocked = false;
    runWith(s, 60, () => {
      if (s.events.some((e) => e.type === "block")) blocked = true;
      return [inputOf({ heavy: true }), inputOf({ right: true })];
    });
    expect(blocked).toBe(true);
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
    expect(s.fighters[1].guard).toBeLessThan(guardBefore);
  });

  it("站着挡不住下段扫堂腿", () => {
    const s = place(freshMatch(), 810, 856);
    run(s, 80, inputOf({ down: true, heavy: true }), inputOf({ right: true }));
    expect(s.fighters[1].vigor).toBeLessThan(s.fighters[1].maxVigor);
  });

  it("蹲着挡得住下段", () => {
    const s = place(freshMatch(), 810, 856);
    run(s, 80, inputOf({ down: true, heavy: true }), inputOf({ right: true, down: true }));
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
  });

  it("一直挡重击，格挡槽掉光就破防", () => {
    const s = place(freshMatch(), 810, 856);
    let broke = false;
    runWith(s, 600, () => {
      if (s.events.some((e) => e.type === "guardbreak")) broke = true;
      return [inputOf({ heavy: true }), inputOf({ right: true })];
    });
    expect(broke).toBe(true);
  });

  it("破防之后格挡槽会回满，不会一破再破卡死", () => {
    const s = place(freshMatch(), 810, 856);
    runWith(s, 600, () => [inputOf({ heavy: true }), inputOf({ right: true })]);
    expect(s.fighters[1].guard).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 四、投技与受身                                                      */
/* ------------------------------------------------------------------ */

describe("投技", () => {
  it("贴身按轻+重能抱摔，摔完对手倒地", () => {
    const s = place(freshMatch(), 420, 450);
    let thrown = false;
    runWith(s, 60, () => {
      if (s.events.some((e) => e.type === "throw")) thrown = true;
      return [inputOf({ light: true, heavy: true }), N];
    });
    expect(thrown).toBe(true);
    expect(s.fighters[1].vigor).toBeLessThan(s.fighters[1].maxVigor);
  });

  it("离得远就抓空，什么也不会发生", () => {
    const s = place(freshMatch(), 200, 700);
    run(s, 60, inputOf({ light: true, heavy: true }));
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
  });

  it("对手在硬直里就抓不到（投技保护）", () => {
    const s = place(freshMatch(), 420, 450);
    s.fighters[1].phase = "blockstun";
    s.fighters[1].stun = 200;
    run(s, 30, inputOf({ light: true, heavy: true }));
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
  });

  it("跳在空中的人抓不到", () => {
    const s = place(freshMatch(), 420, 450);
    runWith(s, 40, (i) => [inputOf({ light: true, heavy: true }), i === 0 ? inputOf({ up: true }) : N]);
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
  });
});

describe("受身", () => {
  it("倒地那一下按轻击能更快爬起来", () => {
    function framesToStand(tech: boolean): number {
      const s = place(freshMatch(), 810, 856);
      // 先用扫堂腿把对手放倒
      let downAt = -1;
      for (let i = 0; i < 200; i++) {
        stepMatch(s, [inputOf({ down: true, heavy: true }), N]);
        if (s.fighters[1].phase === "knockdown") {
          downAt = i;
          break;
        }
      }
      expect(downAt).toBeGreaterThanOrEqual(0);
      let stood = 0;
      for (let i = 0; i < 200; i++) {
        const techPress = tech && s.fighters[1].downFrames <= TECH_WINDOW;
        stepMatch(s, [N, techPress ? inputOf({ light: true }) : N]);
        stood++;
        if (s.fighters[1].phase !== "knockdown") break;
      }
      return stood;
    }
    const quick = framesToStand(true);
    const slow = framesToStand(false);
    expect(quick).toBeLessThan(slow);
  });

  it("倒在地上的人打不到：站旁边一直点也没法把他按在地上", () => {
    const s = place(freshMatch(), 810, 856);
    // 先放倒
    for (let i = 0; i < 200; i++) {
      stepMatch(s, [inputOf({ down: true, heavy: true }), N]);
      if (s.fighters[1].phase === "knockdown") break;
    }
    expect(s.fighters[1].phase).toBe("knockdown");
    const vigorWhenDown = s.fighters[1].vigor;
    let downFramesSeen = 0;
    for (let i = 0; i < 200; i++) {
      stepMatch(s, [inputOf({ light: true }), N]);
      if (s.fighters[1].phase === "knockdown") downFramesSeen++;
      else break;
    }
    // 躺着的这段时间一点元气都不会再掉
    expect(s.fighters[1].vigor).toBe(vigorWhenDown);
    expect(downFramesSeen).toBeLessThan(80);
    expect(s.fighters[1].phase).not.toBe("knockdown");
  });

  it("倒地的人一定爬得起来，不会永远躺着", () => {
    const s = place(freshMatch(), 810, 856);
    for (let i = 0; i < 200; i++) {
      stepMatch(s, [inputOf({ down: true, heavy: true }), N]);
      if (s.fighters[1].phase === "knockdown") break;
    }
    run(s, 120);
    expect(s.fighters[1].phase).not.toBe("knockdown");
  });
});

/* ------------------------------------------------------------------ */
/* 五、连段与无限连防护                                                */
/* ------------------------------------------------------------------ */

describe("连段", () => {
  it("轻击命中后取消成重击，连段计数变成 2", () => {
    const s = place(freshMatch(), 400, 450);
    let best = 0;
    runWith(s, 60, () => {
      best = Math.max(best, s.fighters[0].combo);
      // 打中之前按轻，打中之后立刻改按重
      return [s.fighters[0].combo === 0 ? inputOf({ light: true }) : inputOf({ heavy: true }), N];
    });
    expect(best).toBeGreaterThanOrEqual(2);
  });

  it("连段第二段比第一段轻（连段递减是真生效的）", () => {
    const s = place(freshMatch(), 400, 450);
    const drops: number[] = [];
    let prev = s.fighters[1].vigor;
    runWith(s, 90, () => {
      if (s.fighters[1].vigor < prev) {
        drops.push(prev - s.fighters[1].vigor);
        prev = s.fighters[1].vigor;
      }
      return [inputOf({ light: true }), N];
    });
    expect(drops.length).toBeGreaterThanOrEqual(3);
    expect(drops[drops.length - 1]).toBeLessThanOrEqual(drops[0]);
  });

  it("无限连防护：怎么乱按，一段连段都超不过上限", () => {
    const s = place(freshMatch("lvlvdou", "dundun"), 400, 452);
    let best = 0;
    runWith(s, 900, (i) => {
      best = Math.max(best, s.fighters[0].combo);
      // 轮着按轻 / 重 / 蹲轻 / 蹲重，尽最大努力接长
      const pattern = i % 4;
      if (pattern === 0) return [inputOf({ light: true }), N];
      if (pattern === 1) return [inputOf({ heavy: true }), N];
      if (pattern === 2) return [inputOf({ down: true, light: true }), N];
      return [inputOf({ down: true, heavy: true }), N];
    });
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThanOrEqual(COMBO_LIMIT);
  });

  it("无限连防护：挨打的人一定会有能动的帧，不会被锁死到结束", () => {
    const s = place(freshMatch("lvlvdou", "dundun"), 400, 452);
    let freeFrames = 0;
    runWith(s, 900, (i) => {
      const d = s.fighters[1];
      if (d.phase === "idle" || d.phase === "walk" || d.phase === "crouch" || d.phase === "jump") freeFrames++;
      return [i % 2 === 0 ? inputOf({ light: true }) : inputOf({ heavy: true }), N];
    });
    expect(freeFrames).toBeGreaterThan(60);
  });

  it("同一招在同一段连段里不会被取消成自己", () => {
    const s = place(freshMatch(), 400, 450);
    let sawRepeatCancel = false;
    let lastSlot: string | null = null;
    runWith(s, 200, () => {
      const f = s.fighters[0];
      if (f.phase === "attack" && f.frame === 0 && f.slot === lastSlot && f.comboUsed.filter((x) => x === f.slot).length > 1) {
        sawRepeatCancel = true;
      }
      lastSlot = f.slot;
      return [inputOf({ light: true }), N];
    });
    expect(sawRepeatCancel).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 五之二、连段上限 6 的实证                                            */
/* ------------------------------------------------------------------ */

/** 某个槽位对应哪一组按键（面朝方向决定"前 / 后"是哪个方向键） */
function keysFor(slot: MoveSlot, facing: Facing): InputFrame {
  const fwd = facing === 1 ? "right" : "left";
  const back = facing === 1 ? "left" : "right";
  switch (slot) {
    case "5L":
      return inputOf({ light: true });
    case "5H":
      return inputOf({ heavy: true });
    case "2L":
      return inputOf({ down: true, light: true });
    case "2H":
      return inputOf({ down: true, heavy: true });
    case "s1":
      return inputOf({ [fwd]: true, light: true } as Partial<InputFrame>);
    case "s2":
      return inputOf({ [fwd]: true, heavy: true } as Partial<InputFrame>);
    case "s3":
      return inputOf({ [back]: true, heavy: true } as Partial<InputFrame>);
    case "super":
      return inputOf({ down: true, light: true, heavy: true });
    case "throw":
      return inputOf({ light: true, heavy: true });
    default:
      return N;
  }
}

/**
 * 真的能打出来的那一套：绿绿豆的 轻 → 蹲轻 → 重 → 必杀一 → 必杀二 → 必杀三。
 * 六段刚好顶到上限，第七段无论按什么都接不上去。
 */
const SIX_HIT: MoveSlot[] = ["5L", "2L", "5H", "s1", "s2", "s3"];

/** 按计划表打一套连段：每一段打中之后立刻按下一段的键 */
function runCombo(s: MatchState, plan: MoveSlot[], frames = 240): { best: number; drops: number[] } {
  let best = 0;
  const drops: number[] = [];
  let prev = s.fighters[1].vigor;
  for (let i = 0; i < frames; i++) {
    const f = s.fighters[0];
    let input = N;
    if (f.combo === 0 && f.phase !== "attack") input = keysFor(plan[0], f.facing);
    else if (f.phase === "attack" && f.hitDone) {
      const next = plan[f.comboUsed.length];
      if (next) input = keysFor(next, f.facing);
    }
    stepMatch(s, [input, N]);
    if (s.fighters[1].vigor < prev) {
      drops.push(prev - s.fighters[1].vigor);
      prev = s.fighters[1].vigor;
    }
    best = Math.max(best, s.fighters[0].combo);
  }
  return { best, drops };
}

describe("连段上限 6 的实证", () => {
  it("绿绿豆的 轻→蹲轻→重→必杀一→必杀二→必杀三 真的能打满 6 段", () => {
    const s = place(freshMatch("lvlvdou", "dundun", 0), 400, 448);
    expect(runCombo(s, SIX_HIT).best).toBe(COMBO_LIMIT);
  });

  it("打满 6 段之后取消表就空了，第七段一招都接不上", () => {
    const s = place(freshMatch("lvlvdou", "dundun", 0), 400, 448);
    let cappedTargets: string[] | null = null;
    let step = 0;
    for (let i = 0; i < 240; i++) {
      const f = s.fighters[0];
      let input = N;
      if (f.combo === 0 && f.phase !== "attack") input = keysFor(SIX_HIT[0], f.facing);
      else if (f.phase === "attack" && f.hitDone) {
        const ch = charOf(f);
        const targets = cancelTargets(ch, ch.moves[f.slot!], {
          ...emptyContext(),
          hitDone: true,
          used: f.comboUsed,
          hits: f.combo,
          // 能量给满，证明"接不上"是上限拦的，不是能量不够
          meter: METER_MAX,
          airborne: f.airborne
        });
        if (f.combo >= COMBO_LIMIT && cappedTargets === null) cappedTargets = targets;
        const next = SIX_HIT[(step = f.comboUsed.length)];
        if (next) input = keysFor(next, f.facing);
      }
      stepMatch(s, [input, N]);
    }
    expect(step).toBe(COMBO_LIMIT);
    expect(cappedTargets).toEqual([]);
  });

  it("六段的伤害一段比一段轻，最后一段砍到第一段的一半以下", () => {
    const s = place(freshMatch("lvlvdou", "dundun", 0), 400, 448);
    const { best, drops } = runCombo(s, SIX_HIT);
    expect(best).toBe(COMBO_LIMIT);
    expect(drops.length).toBeGreaterThanOrEqual(COMBO_LIMIT);
    const six = drops.slice(0, COMBO_LIMIT);
    // 后面几段的原始威力更高，所以不逐段比大小：直接对着递减公式一段一段核
    const raw = SIX_HIT.map((slot) => characterById("lvlvdou").moves[slot].power);
    expect(six).toEqual(raw.map((p, i) => scaledPower(p, i)));
    expect(six.reduce((a, b) => a + b, 0)).toBeLessThan(raw.reduce((a, b) => a + b, 0) * 0.8);
    // 第一段原样进账，第六段只剩一半
    expect(six[0]).toBe(raw[0]);
    expect(six[5]).toBe(Math.round(raw[5] * comboScale(5)));
  });
});

/* ------------------------------------------------------------------ */
/* 五之三、判定框只在命中帧、倒地无敌、投技保护                        */
/* ------------------------------------------------------------------ */

describe("判定框只在命中帧存在", () => {
  it("元气下降只会发生在攻击方的 active 段里，起手和收招一下都碰不到人", () => {
    const s = place(freshMatch("dundun", "xingxing"), 400, 452);
    const phases = new Set<string>();
    let prevVigor = s.fighters[1].vigor;
    for (let i = 0; i < 300; i++) {
      stepMatch(s, [inputOf({ heavy: true }), N]);
      if (s.fighters[1].vigor < prevVigor) {
        prevVigor = s.fighters[1].vigor;
        // 判定就发生在这一帧推进之后的那个 frame 上
        const f = s.fighters[0];
        const mv = f.slot ? charOf(f).moves[f.slot] : null;
        phases.add(mv ? movePhase(mv, f.frame) : "none");
      }
    }
    expect(phases.size).toBeGreaterThan(0);
    expect([...phases]).toEqual(["active"]);
  });

  it("判定框是按帧长出来的：命中帧第一帧比最后一帧短", () => {
    const mv = characterById("dundun").moves["5H"];
    const first = activeBoxAt(mv, mv.startup);
    const last = activeBoxAt(mv, mv.startup + mv.active - 1);
    expect(first.w).toBeLessThan(last.w);
    expect(last.w).toBe(mv.box.w);
    // 起手帧与收招帧不参与判定，返回的是数据表原框（画预告用）
    expect(activeBoxAt(mv, 0)).toEqual(mv.box);
    expect(activeBoxAt(mv, mv.startup + mv.active + 1)).toEqual(mv.box);
  });
});

describe("倒地无敌与投技保护", () => {
  it("倒在地上到爬起来这一段有无敌帧，站旁边一直点也打不动他", () => {
    const s = place(freshMatch("dundun", "xingxing"), 400, 448);
    // 先摔一下让对手倒地
    runWith(s, 20, () => [inputOf({ light: true, heavy: true }), N]);
    expect(s.fighters[1].phase).toBe("knockdown");
    const vigorAtDown = s.fighters[1].vigor;
    let sawInvuln = false;
    runWith(s, 90, () => {
      if (s.fighters[1].invuln > 0) sawInvuln = true;
      return [inputOf({ light: true }), N];
    });
    expect(sawInvuln).toBe(true);
    // 倒地 + 起身无敌这段时间里，元气一点没掉
    expect(s.fighters[1].vigor).toBe(vigorAtDown);
  });

  it("被摔过之后有一段抓不到的保护帧，贴着身子按投也投不上第二下", () => {
    const s = place(freshMatch("dundun", "xingxing"), 400, 448);
    runWith(s, 20, () => [inputOf({ light: true, heavy: true }), N]);
    // 保护帧从"躺着"一直盖到"爬起来之后还有一小段"
    expect(s.fighters[1].throwProtect).toBeGreaterThan(THROW_PROTECT_FRAMES);
    expect(s.fighters[1].throwProtect).toBeLessThanOrEqual(NORMAL_WAKEUP_FRAMES + THROW_PROTECT_FRAMES);
    let throws = 0;
    runWith(s, 600, () => {
      throws += s.events.filter((e) => e.type === "throw").length;
      const gap = gapBetween(s.fighters[0], s.fighters[1]);
      return [gap > 8 ? inputOf({ right: true }) : inputOf({ light: true, heavy: true }), N];
    });
    // 600 帧（10 秒）贴身狂按投，摔到的次数远少于"每次抓都成功"的那种无限投
    expect(throws).toBeLessThan(8);
  });
});

/* ------------------------------------------------------------------ */
/* 六、训练模式、减弱动效、真实胜负                                    */
/* ------------------------------------------------------------------ */

describe("训练模式", () => {
  it("元气不掉、比赛不结束，但连段照样能练", () => {
    const s = place(createMatch("duoduo", "xingxing", { config: { training: true, timeLimit: 0 } }), 400, 450);
    run(s, 600, inputOf({ light: true }));
    expect(s.fighters[1].vigor).toBe(s.fighters[1].maxVigor);
    expect(s.over).toBe(false);
    expect(s.fighters[0].bestCombo).toBeGreaterThanOrEqual(1);
  });
});

describe("减弱动效", () => {
  it("开启后屏幕抖动恒为 0", () => {
    const s = place(
      createMatch("dundun", "xingxing", { config: { reducedMotion: true, timeLimit: 0 } }),
      400,
      452
    );
    let maxShake = 0;
    runWith(s, 200, () => {
      maxShake = Math.max(maxShake, s.shake);
      return [inputOf({ heavy: true }), N];
    });
    expect(maxShake).toBe(0);
  });

  it("不开启时命中会抖一下", () => {
    const s = place(createMatch("dundun", "xingxing", { config: { timeLimit: 0 } }), 400, 452);
    let maxShake = 0;
    runWith(s, 200, () => {
      maxShake = Math.max(maxShake, s.shake);
      return [inputOf({ heavy: true }), N];
    });
    expect(maxShake).toBeGreaterThan(0);
  });
});

describe("真实胜负", () => {
  it("一直追着打站着不动的人，最后一定打到元气见底", () => {
    const s = place(freshMatch("duoduo", "xingxing", 60 * 120), 400, 450);
    let frames = 0;
    while (!s.over && frames < 60 * 130) {
      stepMatch(s, chase(s));
      frames++;
    }
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.fighters[1].vigor).toBe(0);
  });

  it("高手档 AI 打站桩也能赢下来", () => {
    const s = freshMatch("duoduo", "xingxing", 60 * 120);
    const brain = createBrain(2, 99);
    let frames = 0;
    while (!s.over && frames < 60 * 130) {
      stepMatch(s, [N, aiInput(brain, s, 1)]);
      frames++;
    }
    expect(s.over).toBe(true);
    expect(s.winner).toBe(1);
  });

  it("时间到了按剩余元气判定，一样多就是平局", () => {
    const s = createMatch("duoduo", "duoduo", { config: { timeLimit: 30 } });
    run(s, 60);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(-1);
    expect(s.events.some((e) => e.type === "timeup") || s.frame >= 30).toBe(true);
  });

  it("比赛结束后再推进也不会出事", () => {
    const s = createMatch("duoduo", "duoduo", { config: { timeLimit: 20 } });
    run(s, 60);
    const snapshot = JSON.stringify(s.fighters.map((f: FighterState) => [f.x, f.vigor]));
    run(s, 120, inputOf({ light: true }), inputOf({ heavy: true }));
    expect(JSON.stringify(s.fighters.map((f: FighterState) => [f.x, f.vigor]))).toBe(snapshot);
  });

  it("八个角色两两都能开局并推进 300 帧不报错", () => {
    for (const a of CHARACTERS) {
      for (const b of CHARACTERS) {
        const s = createMatch(a.id, b.id, { config: { timeLimit: 60 * 30 } });
        const b0 = createBrain(1, a.name.length * 13 + 1);
        const b1 = createBrain(2, b.name.length * 7 + 3);
        for (let i = 0; i < 300 && !s.over; i++) {
          stepMatch(s, [aiInput(b0, s, 0), aiInput(b1, s, 1)]);
        }
        for (const f of s.fighters) {
          expect(Number.isFinite(f.x), `${a.id} vs ${b.id}`).toBe(true);
          expect(f.vigor).toBeGreaterThanOrEqual(0);
          expect(f.y).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("当前招式查询在没出招时返回空", () => {
    const s = freshMatch();
    expect(currentMove(s.fighters[0])).toBeNull();
    stepMatch(s, [inputOf({ light: true }), N]);
    expect(currentMove(s.fighters[0])?.slot).toBe("5L");
  });
});
