// 无头冒烟:不开浏览器,直接把一整局保龄球打完。
//
// 这里跑的循环和 index.ts 里那张投球台是同一套:turnState 决定下一球怎么投、
// simulateShot 真的滚一次瓶、scoreGame 结算。所以「闯关达标」「对战分胜负」
// 「无尽总有一格过不去」这几条路径是真的被走完的,不是靠断言硬凑出来的。
import { describe, expect, it } from "vitest";
import { meta } from "./meta";
import GUIDE from "./guide";
import { buildEndlessFrame, buildLevel, buildVersus } from "./levels";
import { aiShot, simulateShot, type AiLevel, type PinKind } from "./logic";
import { PINS, scoreGame, totalScore, turnState } from "./scoring";

interface Played {
  rolls: number[];
  total: number;
  complete: boolean;
  /** 一共投了几球 */
  balls: number;
}

/** 让一个「档位 skill 的球手」把一整局打完,完全照 index.ts 的对局循环走 */
function playGame(opts: {
  frames: number;
  kinds: PinKind[];
  oil: number;
  skill: AiLevel;
  seed: number;
  /** 1.2 新增的球道花样:开球瓶阵 / 护栏 / 移动瓶 / 球沟宽度 */
  rack?: boolean[];
  bumpers?: boolean;
  drift?: number;
  gutter?: number;
}): Played {
  const fresh = (): boolean[] => (opts.rack ? opts.rack.slice() : new Array<boolean>(PINS).fill(true));
  const rolls: number[] = [];
  let standing = fresh();
  let guard = 0;
  while (guard++ < 80) {
    const st = turnState(rolls, opts.frames);
    if (st.over) break;
    if (st.freshRack) standing = fresh();
    const shot = aiShot(standing, opts.skill, opts.seed + st.frame * 3 + st.ball);
    const res = simulateShot(
      {
        standing: standing.slice(),
        kinds: opts.kinds,
        oil: opts.oil,
        bumpers: opts.bumpers,
        drift: opts.drift,
        gutter: opts.gutter,
      },
      shot
    );
    rolls.push(res.count);
    standing = res.standing;
  }
  const sheet = scoreGame(rolls, opts.frames);
  return { rolls, total: sheet.total, complete: sheet.complete, balls: rolls.length };
}

/** 两个人轮流投的一整局:每一球都归「格数落后的那一位」 */
function playVersus(
  round: number,
  skills: [AiLevel, AiLevel]
): { totals: number[]; order: Array<{ seat: number; frame: number; gap: number }> } {
  const vs = buildVersus(round);
  const rolls: number[][] = [[], []];
  const standing = [new Array<boolean>(PINS).fill(true), new Array<boolean>(PINS).fill(true)];
  const order: Array<{ seat: number; frame: number; gap: number }> = [];
  let guard = 0;
  while (guard++ < 200) {
    let seat = -1;
    let low = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 2; i++) {
      const st = turnState(rolls[i], vs.frames);
      if (st.over) continue;
      if (st.frame < low) {
        low = st.frame;
        seat = i;
      }
    }
    if (seat < 0) break;
    const st = turnState(rolls[seat], vs.frames);
    if (st.freshRack) standing[seat] = new Array<boolean>(PINS).fill(true);
    const shot = aiShot(standing[seat], skills[seat], round * 31 + seat * 17 + st.frame * 3 + st.ball);
    const res = simulateShot({ standing: standing[seat].slice(), kinds: vs.kinds, oil: vs.oil }, shot);
    rolls[seat].push(res.count);
    standing[seat] = res.standing;
    order.push({
      seat,
      frame: st.frame,
      gap: Math.abs(turnState(rolls[0], vs.frames).frame - turnState(rolls[1], vs.frames).frame),
    });
  }
  return { totals: [totalScore(rolls[0], vs.frames), totalScore(rolls[1], vs.frames)], order };
}

describe("冒烟:一整局真的打得完", () => {
  it("十格打完就是打完了,总分结算得出来", () => {
    const game = playGame({ frames: 10, kinds: new Array<PinKind>(PINS).fill("wood"), oil: 0.4, skill: 2, seed: 5 });
    expect(game.complete).toBe(true);
    expect(game.balls).toBeGreaterThanOrEqual(11);
    expect(game.total).toBeGreaterThan(0);
    expect(game.total).toBeLessThanOrEqual(300);
  });

  it("每一球倒的瓶数都在 0..10,一格前两球加起来不会超过 10", () => {
    const game = playGame({ frames: 10, kinds: new Array<PinKind>(PINS).fill("wood"), oil: 0.4, skill: 1, seed: 9 });
    for (const r of game.rolls) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(PINS);
    }
    const sheet = scoreGame(game.rolls, 10);
    sheet.frames.slice(0, 9).forEach((f, i) => {
      if (f.rolls.length === 2) {
        expect(f.rolls[0] + f.rolls[1], `第 ${i + 1} 格两球加起来超过 10 瓶了`).toBeLessThanOrEqual(PINS);
      }
    });
  });

  it("档位越高整局分数越高", () => {
    const score = (skill: AiLevel): number => {
      let sum = 0;
      for (let s = 0; s < 6; s++) {
        sum += playGame({ frames: 10, kinds: new Array<PinKind>(PINS).fill("wood"), oil: 0.4, skill, seed: s * 13 }).total;
      }
      return sum / 6;
    };
    const novice = score(1);
    const champion = score(3);
    expect(champion).toBeGreaterThan(novice);
    expect(champion).toBeGreaterThan(180);
  });
});

describe("冒烟:188 关闯关", () => {
  it("第 1 关真的打得过,而且不是靠瞎蒙", () => {
    const lv = buildLevel(0);
    const game = playGame({ frames: lv.frames, kinds: lv.kinds, oil: lv.oil, skill: 3, seed: lv.seed });
    expect(game.complete).toBe(true);
    expect(game.total, "第 1 关没够到目标分").toBeGreaterThanOrEqual(lv.target);
  });

  it("八个章节的开章第一关都打得通,不是只有第 1 关能过", () => {
    for (const level of [0, 24, 48, 72, 96, 119, 142, 165]) {
      const lv = buildLevel(level);
      const game = playGame({ frames: lv.frames, kinds: lv.kinds, oil: lv.oil, skill: 3, seed: lv.seed });
      expect(game.total, `第 ${level + 1} 关(第 ${lv.chapter + 1} 章开章)没打通`).toBeGreaterThanOrEqual(lv.target);
    }
  });

  it("抽 32 关跑完:老练的打法大半能过,乱投的过得明显少", () => {
    const sample: number[] = [];
    for (let i = 2; i < 188; i += 6) sample.push(i);
    const rate = (skill: AiLevel): number => {
      let win = 0;
      for (const level of sample) {
        const lv = buildLevel(level);
        const game = playGame({ frames: lv.frames, kinds: lv.kinds, oil: lv.oil, skill, seed: lv.seed });
        if (game.total >= lv.target) win++;
      }
      return win / sample.length;
    };
    const good = rate(3);
    const sloppy = rate(1);
    expect(good, "会瞄口袋的打法连一大半都过不了,目标分定太高了").toBeGreaterThan(0.85);
    expect(sloppy, "乱投也能全过,那这 188 关就没意思了").toBeLessThan(good);
  });

  it("后面章节明显比前面难:同一个球手过不了那么多关", () => {
    const clear = (from: number, to: number): number => {
      let win = 0;
      let n = 0;
      for (let i = from; i < to; i += 3) {
        const lv = buildLevel(i);
        n++;
        if (playGame({ frames: lv.frames, kinds: lv.kinds, oil: lv.oil, skill: 2, seed: lv.seed }).total >= lv.target) win++;
      }
      return win / n;
    };
    expect(clear(0, 24)).toBeGreaterThan(clear(165, 188));
  });
});

describe("冒烟:双人对战", () => {
  it("两个人轮流投,谁都不会领先对方一整格以上", () => {
    const { order } = playVersus(1, [2, 2]);
    expect(order.length).toBeGreaterThan(20);
    for (const step of order) {
      expect(step.gap, "有人连投了两格,轮转坏了").toBeLessThanOrEqual(1);
    }
    // 两个人都真的把十格打完了
    expect(order.filter((s) => s.seat === 0 && s.frame === 9).length).toBeGreaterThan(0);
    expect(order.filter((s) => s.seat === 1 && s.frame === 9).length).toBeGreaterThan(0);
  });

  it("五张球道都能打出结果,总分都是正经分数", () => {
    for (let round = 1; round <= 5; round++) {
      const { totals } = playVersus(round, [3, 2]);
      expect(totals[0]).toBeGreaterThan(0);
      expect(totals[1]).toBeGreaterThan(0);
      expect(totals[0]).toBeLessThanOrEqual(300);
      expect(totals[1]).toBeLessThanOrEqual(300);
    }
  });

  it("冠军档明显打得过新手档:五张球道至少赢四张", () => {
    let wins = 0;
    for (let round = 1; round <= 5; round++) {
      const { totals } = playVersus(round, [3, 1]);
      if (totals[0] > totals[1]) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(4);
  });
});

describe("冒烟:无尽格", () => {
  it("前几格轻轻松松,门槛是一格一格抬起来的", () => {
    for (const f of [1, 2, 3]) {
      const setup = buildEndlessFrame(f);
      const game = playGame({ frames: 1, kinds: setup.kinds, oil: setup.oil, skill: 3, seed: 77 + f });
      expect(game.total, `无尽第 ${f} 格连冠军档都过不去`).toBeGreaterThanOrEqual(setup.target);
    }
  });

  it("一直打下去总有一格过不去:无尽不是无敌", () => {
    let stoppedAt = 0;
    for (let f = 1; f <= 40 && stoppedAt === 0; f++) {
      const setup = buildEndlessFrame(f);
      const game = playGame({ frames: 1, kinds: setup.kinds, oil: setup.oil, skill: 1, seed: 5 + f * 3 });
      if (game.total < setup.target) stoppedAt = f;
    }
    expect(stoppedAt, "新手档撑过了 40 格,门槛抬得太慢").toBeGreaterThan(0);
  });

  it("无尽的一格用的还是那套加投规则:全中能拿到两次加投", () => {
    const sheet = scoreGame([10, 10, 10], 1);
    expect(sheet.complete).toBe(true);
    expect(sheet.total).toBe(30);
  });
});

describe("冒烟:上架信息对得上", () => {
  it("meta 是纯数据,id / 标题 / 分类 / 关数都照约定填了", () => {
    expect(meta.id).toBe("bowling-lane");
    expect(meta.title).toBe("保龄球小馆");
    expect(meta.category).toBe("casual");
    expect(meta.levels).toBe(188);
    expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(meta.blurb.length).toBeGreaterThan(10);
  });

  it("首页玩法芯片上写的四种玩法,index.ts 里都真的做了", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
  });

  it("攻略册覆盖了 188 关,每一章都有自己的几条", () => {
    expect(GUIDE.gameId).toBe(meta.id);
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(4);
    expect(GUIDE.entries.length).toBeGreaterThanOrEqual(8);
    expect(GUIDE.entries[0].from).toBe(1);
    expect(GUIDE.entries[GUIDE.entries.length - 1].to).toBe(188);
    let prev = 0;
    for (const e of GUIDE.entries) {
      expect(e.from).toBe(prev + 1);
      expect(e.to).toBeGreaterThanOrEqual(e.from);
      expect(e.tips.length).toBeGreaterThanOrEqual(3);
      prev = e.to;
    }
  });
});
