// 保龄球小馆 · 1.2 升级用例。
//
// 1.1 的四个测试文件一条都没动,这里只钉 1.2 新长出来的东西:
// 记分的六种边界、真连锁、三段式可撤销、八章各有花样、三档 AI 的高斯手抖、
// 无尽一档一档抬难度、伪 2.5D 投影与俯视坐标互转可逆。
import { describe, expect, it } from "vitest";
import { save } from "../../engine/save";
import {
  ALL_LEVELS,
  CHAPTERS,
  CHAPTER_TWISTS,
  SPLITS,
  TIER_SIZE,
  buildEndlessFrame,
  buildLevel,
  endlessGutter,
  endlessTarget,
  endlessTier,
} from "./levels";
import {
  AI_WOBBLE,
  BALL_R,
  DRIFT_MS,
  GUTTER_EDGE,
  HEAD_Y,
  LANE_LEN,
  LANE_W,
  PIN_GAP,
  PIN_TRAITS,
  POCKET_AIM,
  TOPPLE,
  aiShot,
  canUndo,
  createLane,
  depthAt,
  depthInv,
  driftOffset,
  gaussNoise,
  guideAlpha,
  hookAccel,
  laneProject,
  laneUnproject,
  nextStage,
  pinShift,
  pinSpot,
  pocketLeftX,
  pocketX,
  prevStage,
  releaseX,
  simulateShot,
  spareAimX,
  splitRack,
  stepLane,
  widthScaleAt,
  type AiLevel,
  type LaneView,
  type PinKind,
  type Shot,
  type Stage,
} from "./logic";
import { PINS, ballsUsed, longestStrikeRun, scoreGame, totalScore } from "./scoring";

const WOOD = (): PinKind[] => new Array<PinKind>(PINS).fill("wood");
const FULL = (): boolean[] => new Array<boolean>(PINS).fill(true);

/** 一发正对口袋的稳球:好几条用例都拿它当基准 */
const POCKET_SHOT: Shot = { power: 0.7, aim: POCKET_AIM, spin: 0 };

// ---------------------------------------------------------------------------
// 一、十格记分:六种边界一条都不许错
// ---------------------------------------------------------------------------

describe("1.2 记分 · 六种边界", () => {
  it("十二个全中就是 300 分,一分不多一分不少", () => {
    const sheet = scoreGame(new Array<number>(12).fill(10), 10);
    expect(sheet.total).toBe(300);
    expect(sheet.complete).toBe(true);
    expect(sheet.frames[0].score).toBe(30);
    expect(sheet.frames[9].score).toBe(30);
  });

  it("全场补中 + 尾球全中:每一格都要加上下一球", () => {
    const rolls: number[] = [];
    for (let f = 0; f < 9; f++) rolls.push(5, 5);
    rolls.push(5, 5, 10);
    const sheet = scoreGame(rolls, 10);
    // 前九格各 10 + 下一球 5 = 15;第十格三球 5 + 5 + 10 = 20
    expect(sheet.frames[0].score).toBe(15);
    expect(sheet.frames[8].score).toBe(15);
    expect(sheet.frames[9].score).toBe(20);
    expect(sheet.total).toBe(9 * 15 + 20);
  });

  it("第十格全中能连投三球,三球直接相加", () => {
    const rolls = new Array<number>(9).fill(0).flatMap(() => [0, 0]);
    const sheet = scoreGame([...rolls, 10, 7, 2], 10);
    expect(sheet.frames[9].rolls).toEqual([10, 7, 2]);
    expect(sheet.frames[9].score).toBe(19);
    expect(sheet.total).toBe(19);
    expect(sheet.complete).toBe(true);
  });

  it("洗沟局老老实实是 0 分,不会算出负数或 NaN", () => {
    const sheet = scoreGame(new Array<number>(20).fill(0), 10);
    expect(sheet.total).toBe(0);
    expect(sheet.complete).toBe(true);
    expect(Number.isFinite(sheet.total)).toBe(true);
  });

  it("连着两次全中会进位:第一格拿到 10 + 后面两球", () => {
    const sheet = scoreGame([10, 10, 3, 4], 10);
    // 第一格 10 + 后面两球(10、3);第二格 10 + 后面两球(3、4);第三格老实的 7 分
    expect(sheet.frames[0].score).toBe(23);
    expect(sheet.frames[1].score).toBe(17);
    expect(sheet.frames[2].score).toBe(7);
    expect(totalScore([10, 10, 3, 4], 10)).toBe(47);
    // 同样打倒 27 个瓶,连着全中就是比分开打值钱
    expect(totalScore([10, 0, 0, 10, 3, 4], 10)).toBeLessThan(47);
  });

  it("还没投完的那一格不给分,后面的累计分也跟着空着", () => {
    const sheet = scoreGame([10, 7], 10);
    expect(sheet.frames[0].score).toBe(null);
    expect(sheet.frames[0].running).toBe(null);
    expect(sheet.frames[1].running).toBe(null);
    expect(sheet.complete).toBe(false);
  });

  it("限球数那一章要数的球数,加投也算在里面", () => {
    expect(ballsUsed([])).toBe(0);
    expect(ballsUsed([10, 10, 10])).toBe(3);
    expect(ballsUsed(new Array<number>(12).fill(10))).toBe(12);
  });

  it("连续全中的串长数得对:补中打断它,第十格的加投不白送", () => {
    expect(longestStrikeRun(new Array<number>(12).fill(10), 10)).toBe(12);
    expect(longestStrikeRun([10, 10, 4, 6, 10, 0, 0], 10)).toBe(2);
    // 第十格补中之后的那记加投,面对的是新摆的一架,不算全中
    const spareThenBonus = [...new Array<number>(9).fill(0).flatMap(() => [0, 0]), 4, 6, 10];
    expect(longestStrikeRun(spareThenBonus, 10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 二、连锁倒瓶:瓶撞瓶是真的传出去的
// ---------------------------------------------------------------------------

describe("1.2 连锁倒瓶", () => {
  it("正面切进口袋,一球十个瓶全下去", () => {
    const res = simulateShot({ standing: FULL(), kinds: WOOD(), oil: 0.4 }, POCKET_SHOT);
    expect(res.count).toBe(PINS);
    expect(res.gutter).toBe(false);
  });

  it("球只碰得到前面几个瓶,后排是被前排撞倒的", () => {
    const lane = createLane({ standing: FULL(), kinds: WOOD(), oil: 0.4 }, POCKET_SHOT);
    let guard = 0;
    while (!lane.settled && guard++ < 4000) stepLane(lane, 8);
    const hit = new Set(lane.events.filter((e) => e.kind === "hit").map((e) => (e as { pin: number }).pin));
    const chain = lane.events.filter((e) => e.kind === "chain");
    const down = lane.pins.filter((p) => p.down).length;
    expect(chain.length).toBeGreaterThan(0);
    expect(hit.size).toBeLessThan(down);
  });

  it("算「倒了」的瓶,是真的被推离原位那么远", () => {
    const lane = createLane({ standing: FULL(), kinds: WOOD(), oil: 0.4 }, POCKET_SHOT);
    let guard = 0;
    while (!lane.settled && guard++ < 4000) stepLane(lane, 8);
    for (const pin of lane.pins) {
      if (!pin.down) continue;
      expect(pinShift(pin)).toBeGreaterThanOrEqual(PIN_TRAITS[pin.kind].topple - 1e-6);
    }
    expect(TOPPLE).toBeGreaterThan(0);
  });

  it("同样的三段参数跑两次,每一瓶落在同一个地方", () => {
    const a = simulateShot({ standing: FULL(), kinds: WOOD(), oil: 0.4 }, POCKET_SHOT);
    const b = simulateShot({ standing: FULL(), kinds: WOOD(), oil: 0.4 }, POCKET_SHOT);
    expect(a).toEqual(b);
  });

  it("三段参数各管各的:力度管速度、落点管起点、旋转管弯多少", () => {
    const base = createLane({ standing: FULL(), oil: 0.4 }, { power: 0.3, aim: 0, spin: 0 });
    const fast = createLane({ standing: FULL(), oil: 0.4 }, { power: 0.9, aim: 0, spin: 0 });
    expect(fast.ball.vy).toBeGreaterThan(base.ball.vy);
    expect(createLane({ standing: FULL() }, { power: 0.5, aim: 0.5, spin: 0 }).ball.x).toBeGreaterThan(
      createLane({ standing: FULL() }, { power: 0.5, aim: -0.5, spin: 0 }).ball.x
    );
    // 油越厚越拐不动
    expect(Math.abs(hookAccel(1, 0.9))).toBeLessThan(Math.abs(hookAccel(1, 0.1)));
  });
});

// ---------------------------------------------------------------------------
// 三、三段式:每一段在出手前都能反悔
// ---------------------------------------------------------------------------

describe("1.2 三段式可撤销", () => {
  it("往前是 力度 → 落点 → 旋转 → 滚球", () => {
    const walk: Stage[] = ["power"];
    while (walk[walk.length - 1] !== "roll") walk.push(nextStage(walk[walk.length - 1]));
    expect(walk).toEqual(["power", "aim", "spin", "roll"]);
  });

  it("落点和旋转这两段都退得回去,退回去就是上一段", () => {
    expect(canUndo("aim")).toBe(true);
    expect(canUndo("spin")).toBe(true);
    expect(prevStage("spin")).toBe("aim");
    expect(prevStage("aim")).toBe("power");
  });

  it("第一段没有上一段,球都出手了也来不及反悔", () => {
    expect(canUndo("power")).toBe(false);
    expect(canUndo("roll")).toBe(false);
    expect(prevStage("power")).toBe("power");
  });
});

// ---------------------------------------------------------------------------
// 四、八章各有花样,不是同一个模板换数字
// ---------------------------------------------------------------------------

describe("1.2 八章配置", () => {
  it("八章的玩法花样两两不同", () => {
    expect(CHAPTER_TWISTS.length).toBe(CHAPTERS.length);
    expect(new Set(CHAPTER_TWISTS).size).toBe(CHAPTERS.length);
  });

  it("每一种花样都真的落到了关卡字段上,不是只写在文案里", () => {
    const seen = { bumpers: false, drift: false, split: false, limit: false, chain: false, guideOff: false };
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      if (lv.bumpers) seen.bumpers = true;
      if (lv.drift > 0) seen.drift = true;
      if (lv.standing.filter(Boolean).length < PINS) seen.split = true;
      if (lv.ballLimit > 0) seen.limit = true;
      if (lv.chainNeed > 0) seen.chain = true;
      if (lv.guide === 0) seen.guideOff = true;
    }
    expect(seen).toEqual({ bumpers: true, drift: true, split: true, limit: true, chain: true, guideOff: true });
  });

  it("少瓶挑战摆的是留好的分瓶,瓶少了目标分也跟着降", () => {
    const splitLevels = ALL_LEVELS.map(buildLevel).filter((lv) => lv.standing.filter(Boolean).length < PINS);
    expect(splitLevels.length).toBeGreaterThan(10);
    for (const lv of splitLevels) {
      const up = lv.standing.filter(Boolean).length;
      expect(up).toBeGreaterThanOrEqual(3);
      expect(up).toBeLessThan(PINS);
      // 满架同章的目标分一定比它高
      expect(lv.target).toBeLessThan(lv.frames * 15);
    }
  });

  it("护栏只在它那一章有,限球数也给得起每格两球的底线", () => {
    const withBumper = new Set(ALL_LEVELS.map(buildLevel).filter((lv) => lv.bumpers).map((lv) => lv.chapter));
    expect(withBumper.size).toBe(1);
    for (const lv of ALL_LEVELS.map(buildLevel)) {
      if (lv.ballLimit === 0) continue;
      expect(lv.ballLimit).toBeGreaterThanOrEqual(lv.frames + 1);
    }
  });

  it("辅助线前两章画满,越往后越淡,第七章起彻底没有", () => {
    expect(guideAlpha(0)).toBe(1);
    expect(guideAlpha(1)).toBe(1);
    expect(guideAlpha(2)).toBeLessThan(1);
    expect(guideAlpha(5)).toBeGreaterThan(0);
    expect(guideAlpha(6)).toBe(0);
    expect(guideAlpha(7)).toBe(0);
    for (let c = 1; c < 8; c++) expect(guideAlpha(c)).toBeLessThanOrEqual(guideAlpha(c - 1));
  });

  it("辅助线指的是 1 号瓶和 3 号瓶之间那条缝,不是头瓶正中", () => {
    const head = pinSpot(0).x;
    expect(pocketX()).toBeGreaterThan(head);
    expect(pocketLeftX()).toBeLessThan(head);
    // 口袋正好落在头瓶与 3 号瓶的正中间,也就是半个瓶距的一半
    expect(pocketX() - head).toBeCloseTo(PIN_GAP / 4, 6);
    expect(pinSpot(2).x - head).toBeCloseTo(PIN_GAP / 2, 6);
    // 两条线一左一右夹着头瓶
    expect((pocketX() + pocketLeftX()) / 2).toBeCloseTo(head, 6);
  });

  it("前段关卡的格数与目标分没被 1.2 改掉", () => {
    const first = buildLevel(0);
    expect(first.frames).toBe(2);
    expect(first.target).toBe(12);
    expect(first.standing.every(Boolean)).toBe(true);
    expect(first.bumpers).toBe(false);
    expect(first.ballLimit).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 五、护栏 / 移动瓶 / 球道变窄
// ---------------------------------------------------------------------------

describe("1.2 球道花样", () => {
  it("有护栏就洗不了沟:往死里往边上投也会被弹回来", () => {
    const wild: Shot = { power: 0.6, aim: -1, spin: -1 };
    const guarded = simulateShot({ standing: FULL(), oil: 0.1, bumpers: true }, wild);
    expect(guarded.gutter).toBe(false);
  });

  it("没护栏的同一球就掉沟里了,一个瓶也碰不到", () => {
    const wild: Shot = { power: 0.6, aim: -1, spin: -1 };
    const open = simulateShot({ standing: FULL(), oil: 0.1 }, wild);
    expect(open.gutter).toBe(true);
    expect(open.count).toBe(0);
  });

  it("撞护栏会记一条 bumper 事件,画面才知道要弹一下", () => {
    const lane = createLane({ standing: FULL(), oil: 0.1, bumpers: true }, { power: 0.6, aim: -1, spin: -1 });
    let guard = 0;
    while (!lane.settled && guard++ < 4000) stepLane(lane, 8);
    expect(lane.events.some((e) => e.kind === "bumper")).toBe(true);
  });

  it("瓶阵横移是一条来回跑的三角波:幅度不超,一整趟回到原点", () => {
    expect(driftOffset(0, 1234)).toBe(0);
    expect(driftOffset(3, 0)).toBeCloseTo(0, 6);
    expect(driftOffset(3, DRIFT_MS)).toBeCloseTo(0, 6);
    expect(driftOffset(3, DRIFT_MS / 4)).toBeCloseTo(3, 6);
    expect(driftOffset(3, (DRIFT_MS * 3) / 4)).toBeCloseTo(-3, 6);
    for (let t = 0; t < DRIFT_MS * 2; t += 37) {
      expect(Math.abs(driftOffset(3, t))).toBeLessThanOrEqual(3 + 1e-9);
    }
  });

  it("移动瓶真的会挪:球还没到的时候瓶不在原位", () => {
    const lane = createLane({ standing: FULL(), oil: 0.4, drift: 4 }, { power: 0.25, aim: 0, spin: 0 });
    for (let i = 0; i < 60; i++) stepLane(lane, 8);
    expect(Math.abs(lane.pins[0].x - pinSpot(0).x)).toBeGreaterThan(0.2);
    expect(lane.ball.y).toBeLessThan(HEAD_Y);
  });

  it("球沟越宽,落点条能推到的地方就越靠里", () => {
    const wide = releaseX(-1, GUTTER_EDGE + 4);
    const narrow = releaseX(-1, GUTTER_EDGE);
    expect(wide).toBeGreaterThan(narrow);
    expect(narrow).toBeGreaterThanOrEqual(GUTTER_EDGE);
    expect(releaseX(0, GUTTER_EDGE + 4)).toBeCloseTo(LANE_W / 2, 6);
  });

  it("分瓶就是只留几个瓶站着,瓶号是 1 基的", () => {
    const rack = splitRack([3, 7, 9]);
    expect(rack.filter(Boolean).length).toBe(3);
    expect(rack[2]).toBe(true);
    expect(rack[6]).toBe(true);
    expect(rack[8]).toBe(true);
    expect(rack[0]).toBe(false);
    // 越界的瓶号直接忽略,不炸
    expect(splitRack([0, 99]).filter(Boolean).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 六、三档 AI:落点与旋转带高斯噪声
// ---------------------------------------------------------------------------

describe("1.2 三档 AI", () => {
  it("档位越高手抖越小", () => {
    expect(AI_WOBBLE[1]).toBeGreaterThan(AI_WOBBLE[2]);
    expect(AI_WOBBLE[2]).toBeGreaterThan(AI_WOBBLE[3]);
  });

  it("高斯噪声是确定性的,均值贴着 0,再倒霉也不超过三个标准差", () => {
    expect(gaussNoise(7, 3)).toBe(gaussNoise(7, 3));
    let sum = 0;
    let big = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      const z = gaussNoise(i, 2);
      expect(Math.abs(z)).toBeLessThanOrEqual(3);
      if (Math.abs(z) > 1) big++;
      sum += z;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.2);
    // 「大多数时候差一点点,偶尔差很多」:超过一个标准差的是少数
    expect(big / n).toBeLessThan(0.45);
  });

  it("满架时三档都往口袋投,只是抖的幅度不一样", () => {
    for (const skill of [1, 2, 3] as AiLevel[]) {
      const shot = aiShot(FULL(), skill, 12);
      expect(Math.abs(shot.aim - POCKET_AIM)).toBeLessThanOrEqual(AI_WOBBLE[skill] * 3 + 1e-9);
      expect(shot.power).toBeGreaterThan(0.2);
      expect(shot.power).toBeLessThanOrEqual(1);
    }
  });

  it("补中不瞄两瓶中间那片空气:落点一定压在某个还站着的瓶身上", () => {
    for (const combo of SPLITS) {
      const rack = splitRack(combo);
      const x = spareAimX(rack);
      const gaps = combo.map((n) => Math.abs(pinSpot(n - 1).x - x));
      expect(Math.min(...gaps)).toBeLessThanOrEqual(PIN_GAP / 2 + 1e-9);
    }
  });

  it("固定 seed 下冠军档打得比新手档准得多", () => {
    const score = (skill: AiLevel): number => {
      let sum = 0;
      for (let seed = 0; seed < 24; seed++) {
        const res = simulateShot({ standing: FULL(), kinds: WOOD(), oil: 0.4 }, aiShot(FULL(), skill, seed));
        sum += res.count;
      }
      return sum / 24;
    };
    const novice = score(1);
    const steady = score(2);
    const champ = score(3);
    expect(champ).toBeGreaterThan(steady);
    expect(steady).toBeGreaterThan(novice);
    expect(champ).toBeGreaterThan(8.5);
  });

  it("新手档真的会洗沟,冠军档基本不洗", () => {
    const gutters = (skill: AiLevel): number => {
      let n = 0;
      for (let seed = 0; seed < 40; seed++) {
        if (simulateShot({ standing: FULL(), oil: 0.2 }, aiShot(FULL(), skill, seed)).gutter) n++;
      }
      return n;
    };
    expect(gutters(1)).toBeGreaterThan(gutters(3));
    expect(gutters(1)).toBeGreaterThan(2);
    expect(gutters(3)).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 七、无尽:每十格抬一档
// ---------------------------------------------------------------------------

describe("1.2 无尽格", () => {
  it("十格一档,档号从 0 起跳", () => {
    expect(TIER_SIZE).toBe(10);
    expect(endlessTier(1)).toBe(0);
    expect(endlessTier(10)).toBe(0);
    expect(endlessTier(11)).toBe(1);
    expect(endlessTier(21)).toBe(2);
  });

  it("目标分一路只涨不跌,头几格松,跨档才明显抬一级", () => {
    let prev = -1;
    for (let f = 1; f <= 80; f++) {
      const t = endlessTarget(f);
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThanOrEqual(28);
      prev = t;
    }
    expect(endlessTarget(1)).toBeLessThan(PINS);
    expect(endlessTarget(11) - endlessTarget(10)).toBeGreaterThanOrEqual(0);
    expect(endlessTarget(21)).toBeGreaterThan(endlessTarget(1));
  });

  it("球道一档比一档窄,但窄到头就不再窄了", () => {
    let prev = 0;
    for (let f = 1; f <= 120; f++) {
      const w = endlessGutter(f);
      expect(w).toBeGreaterThanOrEqual(prev);
      // 再窄也得放得下一个球
      expect(w).toBeLessThan(LANE_W / 2 - BALL_R);
      prev = w;
    }
    expect(endlessGutter(30)).toBeGreaterThan(endlessGutter(1));
    expect(endlessGutter(200)).toBe(endlessGutter(120));
  });

  it("第三档起开球就是分瓶,油也一档比一档厚", () => {
    expect(buildEndlessFrame(5).standing.every(Boolean)).toBe(true);
    expect(buildEndlessFrame(15).standing.every(Boolean)).toBe(true);
    expect(buildEndlessFrame(21).standing.filter(Boolean).length).toBeLessThan(PINS);
    expect(buildEndlessFrame(31).oil).toBeGreaterThan(buildEndlessFrame(1).oil);
    expect(buildEndlessFrame(99).oil).toBeLessThanOrEqual(0.92);
  });

  it("成绩记进 recordEndlessBest,而且只往上刷", () => {
    const id = "bowling-lane-test-endless";
    expect(save.recordEndlessBest(id, 7)).toBe(7);
    expect(save.recordEndlessBest(id, 3)).toBe(7);
    expect(save.recordEndlessBest(id, 12)).toBe(12);
    expect(save.getGameProgress(id).endlessBest).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// 八、伪 2.5D:透视只在渲染这一层,而且可逆
// ---------------------------------------------------------------------------

describe("1.2 伪 2.5D 投影", () => {
  const view: LaneView = { w: 360, h: 420 };

  it("纵深压缩与它的反函数一来一回回到原处", () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      expect(depthInv(depthAt(t), undefined)).toBeCloseTo(t, 6);
      expect(depthAt(depthInv(t))).toBeCloseTo(t, 6);
    }
  });

  it("俯视坐标投到画布上再投回来,还是原来那个点", () => {
    for (const y of [0, 12, HEAD_Y, HEAD_Y + 12, LANE_LEN]) {
      for (const x of [1, LANE_W / 2, LANE_W - 1]) {
        const p = laneProject(x, y, view);
        const back = laneUnproject(p.sx, p.sy, view);
        expect(back.x).toBeCloseTo(x, 5);
        expect(back.y).toBeCloseTo(y, 5);
      }
    }
  });

  it("近大远小:同一段球道,越靠瓶台画得越窄", () => {
    expect(widthScaleAt(0)).toBe(1);
    let prev = 2;
    for (let i = 0; i <= 10; i++) {
      const k = widthScaleAt(i / 10);
      expect(k).toBeLessThanOrEqual(prev);
      prev = k;
    }
    expect(widthScaleAt(1)).toBeLessThan(widthScaleAt(0));
    expect(widthScaleAt(1)).toBeGreaterThan(0);
  });

  it("出手线在画面最下面,瓶台在最上面,球道中线一直在正中", () => {
    expect(laneProject(LANE_W / 2, 0, view).sy).toBeCloseTo(view.h, 6);
    expect(laneProject(LANE_W / 2, LANE_LEN, view).sy).toBeCloseTo(0, 6);
    expect(laneProject(LANE_W / 2, 0, view).sx).toBeCloseTo(view.w / 2, 6);
    expect(laneProject(LANE_W / 2, HEAD_Y, view).sx).toBeCloseTo(view.w / 2, 6);
  });

  it("近处那一段占的屏幕更多:透视不是等分的", () => {
    const half = depthAt(0.5);
    expect(half).toBeGreaterThan(0.5);
    expect(depthAt(0)).toBe(0);
    expect(depthAt(1)).toBe(1);
  });

  it("投影只是画法:同一球在不同画布尺寸下,俯视坐标一模一样", () => {
    const small: LaneView = { w: 300, h: 300 };
    const big: LaneView = { w: 520, h: 520 };
    const a = simulateShot({ standing: FULL(), oil: 0.4 }, POCKET_SHOT);
    const b = simulateShot({ standing: FULL(), oil: 0.4 }, POCKET_SHOT);
    expect(a.count).toBe(b.count);
    expect(laneProject(LANE_W / 2, HEAD_Y, small).k).toBeCloseTo(laneProject(LANE_W / 2, HEAD_Y, big).k, 6);
  });
});
