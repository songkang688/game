/**
 * 朵朵大战星星 · 合作动作与合作特训三课的单测。
 *
 * 这一份守的是 1.2 最要紧的一条设计：顶举与接应**只有两个人才做得到**。
 * 所以下面既有纯函数的边界断言，也真的开一局只有一个人的对局，
 * 让他把所有键都按满一分钟，看看配合次数是不是一次都涨不上去。
 */
import { describe, expect, it } from "vitest";
import { emptyInput, type Input } from "./ai";
import {
  CATCH_COOLDOWN,
  CATCH_PULL,
  CATCH_RANGE,
  COOP_LESSONS,
  LIFT_COOLDOWN,
  LIFT_LIFT_MAX,
  LIFT_LIFT_MIN,
  LIFT_MAX_V,
  LIFT_MIN_V,
  LIFT_RANGE,
  canCatch,
  canLift,
  catchReachesOut,
  catchVelocity,
  inDanger,
  lessonById,
  lessonCleared,
  lessonProgress,
  liftApex,
  liftVelocity,
  rateLesson,
  type CoopActorView,
  type SafeSpan,
} from "./coop";
import { GRAVITY, JUMP_V, coopTally, createMatch, safeZone, stepMatch, type MatchConfig } from "./battle";
import { STAGES, stageById } from "./stages";
import { ROSTER, fighterById } from "./roster";

const ZONE: SafeSpan = { min: 300, max: 660, top: 380 };

function actor(over: Partial<CoopActorView> = {}): CoopActorView {
  return { x: 480, y: 358, team: 0, onStage: true, onGround: true, cooldown: 0, ...over };
}

function press(over: Partial<Input>): Input {
  return { ...emptyInput(), ...over };
}

describe("顶举", () => {
  it("队友正踩在头顶上、自己站稳了才顶得动", () => {
    const lifter = actor();
    const rider = actor({ y: lifter.y - 40, onGround: false });
    expect(canLift(lifter, rider)).toBe(true);
  });

  it("对手踩到头顶上也顶不动，自己踩自己更不行", () => {
    const lifter = actor();
    const foe = actor({ y: lifter.y - 40, team: 1, onGround: false });
    expect(canLift(lifter, foe)).toBe(false);
    expect(canLift(lifter, lifter)).toBe(false);
  });

  it("站偏了、够不着头顶、或者自己没站稳，都顶不动", () => {
    const lifter = actor();
    expect(canLift(lifter, actor({ x: lifter.x + LIFT_RANGE + 1, y: lifter.y - 40 }))).toBe(false);
    expect(canLift(lifter, actor({ y: lifter.y - LIFT_LIFT_MAX - 1 }))).toBe(false);
    expect(canLift(lifter, actor({ y: lifter.y - LIFT_LIFT_MIN + 1 }))).toBe(false);
    expect(canLift(actor({ onGround: false }), actor({ y: 318 }))).toBe(false);
    expect(canLift(actor({ onStage: false }), actor({ y: 318 }))).toBe(false);
  });

  it("刚顶过还在冷却里就顶不动，冷却是正数", () => {
    expect(LIFT_COOLDOWN).toBeGreaterThan(0);
    expect(canLift(actor({ cooldown: LIFT_COOLDOWN }), actor({ y: 318, onGround: false }))).toBe(false);
  });

  it("顶举初速：力气越大送得越高，被顶的越沉飞得越矮，上下限都夹住", () => {
    const strong = liftVelocity(1.3, 100);
    const weak = liftVelocity(0.8, 100);
    expect(strong).toBeLessThan(weak); // 负数 = 往上，越小越高
    expect(liftVelocity(1, 80)).toBeLessThan(liftVelocity(1, 130));
    for (const f of ROSTER) {
      for (const g of ROSTER) {
        const v = liftVelocity(f.power, g.weight);
        expect(v).toBeGreaterThanOrEqual(LIFT_MIN_V);
        expect(v).toBeLessThanOrEqual(LIFT_MAX_V);
      }
    }
  });

  it("被顶一把比自己起跳高出一大截——这就是非要两个人不可的那点甜头", () => {
    for (const f of ROSTER) {
      const own = liftApex(JUMP_V * f.jump, GRAVITY);
      const lifted = liftApex(liftVelocity(1, f.weight), GRAVITY);
      expect(lifted).toBeGreaterThan(own * 1.15);
    }
  });
});

describe("接应", () => {
  it("飘到台子外面、又没站在地上，才算需要人拉一把", () => {
    expect(inDanger(actor({ x: ZONE.min - 30, onGround: false }), ZONE)).toBe(true);
    expect(inDanger(actor({ y: ZONE.top + 40, onGround: false }), ZONE)).toBe(true);
    expect(inDanger(actor({ x: 480, y: 300, onGround: false }), ZONE)).toBe(false);
    expect(inDanger(actor({ x: ZONE.min - 30, onGround: true }), ZONE)).toBe(false);
    expect(inDanger(actor({ x: ZONE.min - 30, onStage: false, onGround: false }), ZONE)).toBe(false);
  });

  it("只拉得动同队的人，够不着就拉不了，冷却里也拉不了", () => {
    const flyer = actor({ x: ZONE.min - 40, onGround: false });
    expect(canCatch(actor(), flyer, ZONE)).toBe(true);
    expect(canCatch(actor(), { ...flyer, team: 1 }, ZONE)).toBe(false);
    expect(canCatch(actor({ cooldown: CATCH_COOLDOWN }), flyer, ZONE)).toBe(false);
    expect(canCatch(actor(), { ...flyer, x: ZONE.min - CATCH_RANGE - 200 }, ZONE)).toBe(false);
    expect(canCatch(actor(), actor(), ZONE)).toBe(false);
  });

  it("星星绳把人往场地中心拽，同时把下坠收掉大半", () => {
    const left = catchVelocity(ZONE.min - 50, -300, 500, ZONE);
    expect(left.vx).toBeGreaterThanOrEqual(CATCH_PULL);
    expect(left.vy).toBeLessThan(500);
    expect(left.vy).toBeGreaterThan(0);
    const right = catchVelocity(ZONE.max + 50, 300, 500, ZONE);
    expect(right.vx).toBeLessThanOrEqual(-CATCH_PULL);
  });

  it("已经在往上飞的队友，拉一把不会把他按下来", () => {
    const up = catchVelocity(ZONE.min - 50, 0, -400, ZONE);
    expect(up.vy).toBe(-400);
  });

  it("每张场地的绳子长度都是够得着弹飞线的（不然接应就是摆设）", () => {
    for (const stage of STAGES) {
      const zone = safeZone(stage);
      expect(catchReachesOut({ ...zone }, stage.bounds)).toBe(true);
    }
  });
});

describe("合作特训三课", () => {
  it("正好三课，每一课的过关条件都非配合动作不可", () => {
    expect(COOP_LESSONS).toHaveLength(3);
    for (const lesson of COOP_LESSONS) {
      expect(lesson.goal.lifts + lesson.goal.catches).toBeGreaterThan(0);
      expect(lesson.timeLimit).toBeGreaterThan(0);
      expect(stageById(lesson.stageId).id).toBe(lesson.stageId);
      expect(lesson.howto.length).toBeGreaterThan(8);
    }
  });

  it("三课分别教顶举、接应、两样一起用", () => {
    const [one, two, three] = COOP_LESSONS;
    expect(one.goal.lifts).toBeGreaterThan(0);
    expect(one.goal.catches).toBe(0);
    expect(two.goal.catches).toBeGreaterThan(0);
    expect(two.goal.lifts).toBe(0);
    expect(three.goal.lifts).toBeGreaterThan(0);
    expect(three.goal.catches).toBeGreaterThan(0);
  });

  it("按 id 找课，找不到退回第一课", () => {
    expect(lessonById(COOP_LESSONS[1].id).name).toBe(COOP_LESSONS[1].name);
    expect(lessonById("没有这一课").id).toBe(COOP_LESSONS[0].id);
  });

  it("两项都做够才算过，差一次都不算", () => {
    const lesson = COOP_LESSONS[2];
    expect(lessonCleared({ lifts: lesson.goal.lifts, catches: lesson.goal.catches }, lesson)).toBe(true);
    expect(lessonCleared({ lifts: lesson.goal.lifts, catches: lesson.goal.catches - 1 }, lesson)).toBe(false);
    expect(lessonCleared({ lifts: 0, catches: 0 }, lesson)).toBe(false);
    expect(lessonCleared({ lifts: 99, catches: 99 }, lesson)).toBe(true);
  });

  it("进度条文案只写这一课要求的项目，而且不会超过目标数", () => {
    expect(lessonProgress({ lifts: 1, catches: 5 }, COOP_LESSONS[0])).toBe("顶举 1/3");
    expect(lessonProgress({ lifts: 9, catches: 9 }, COOP_LESSONS[2])).toBe("顶举 2/2 · 接应 2/2");
  });

  it("评星只看被撞出去几次，最少也有一颗", () => {
    expect(rateLesson(0)).toBe(3);
    expect(rateLesson(1)).toBe(2);
    expect(rateLesson(5)).toBe(1);
  });
});

describe("一个人过不了合作特训", () => {
  function soloCfg(): MatchConfig {
    return {
      stageId: COOP_LESSONS[0].stageId,
      slots: [{ charId: "duoduo", team: 0, control: "p1", stocks: 9 }],
      stocks: 9,
      timeLimit: 0,
      itemEvery: 0,
      seed: 31,
    };
  }

  it("一个人把所有键按满一分钟，顶举和接应一次都涨不上去", () => {
    const s = createMatch(soloCfg());
    const all = press({ up: true, down: true, left: true, right: true, light: true, heavy: true });
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 60; i++) {
      // 每隔几帧松一下，保证「按下的那一下」判定一直在触发，不是被 prev 吃掉了
      stepMatch(s, dt, { 0: i % 3 === 0 ? emptyInput() : all });
    }
    const tally = coopTally(s, 0);
    expect(tally).toEqual({ lifts: 0, catches: 0 });
    expect(lessonCleared(tally, COOP_LESSONS[0])).toBe(false);
    expect(lessonCleared(tally, COOP_LESSONS[1])).toBe(false);
  });

  it("两个人站对位置，一按「上」就顶举成功，配合次数立刻涨一次", () => {
    const s = createMatch({
      ...soloCfg(),
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 0, control: "p2", stocks: 9 },
      ],
    });
    // 先落地站稳
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const [lifter, rider] = s.actors;
    expect(lifter.onGround).toBe(true);
    rider.x = lifter.x;
    rider.y = lifter.y - 40;
    rider.onGround = false;
    rider.platIndex = -1;
    rider.vy = 0;
    stepMatch(s, 1 / 60, { 0: press({ up: true }) });
    expect(s.events.some((e) => e.kind === "lift")).toBe(true);
    expect(coopTally(s, 0).lifts).toBe(1);
    // 顶的人自己没跳起来，被顶的那位飞出去了
    expect(rider.vy).toBeLessThan(-400);
    expect(lifter.onGround).toBe(true);
  });

  it("两个人一起才接得住：队友飘出台子外面，按「下 + 重击」把他拉回来", () => {
    const s = createMatch({
      ...soloCfg(),
      stageId: COOP_LESSONS[1].stageId,
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 0, control: "p2", stocks: 9 },
      ],
    });
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const zone = safeZone(s.stage);
    const [rescuer, flyer] = s.actors;
    rescuer.x = (zone.min + zone.max) / 2;
    flyer.x = zone.min - 60;
    flyer.y = zone.top + 20;
    flyer.onGround = false;
    flyer.platIndex = -1;
    flyer.vx = -260;
    flyer.vy = 320;
    stepMatch(s, 1 / 60, { 0: press({ down: true, heavy: true }) });
    expect(s.events.some((e) => e.kind === "catch")).toBe(true);
    expect(coopTally(s, 0).catches).toBe(1);
    expect(flyer.vx).toBeGreaterThan(0); // 被往场地里拽了
  });

  it("对手掉出去了也接不住——星星绳只认自己队友", () => {
    const s = createMatch({
      ...soloCfg(),
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 1, control: "p2", stocks: 9 },
      ],
    });
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const zone = safeZone(s.stage);
    const [rescuer, foe] = s.actors;
    rescuer.x = (zone.min + zone.max) / 2;
    foe.x = zone.min - 60;
    foe.y = zone.top + 20;
    foe.onGround = false;
    foe.platIndex = -1;
    foe.vx = -260;
    stepMatch(s, 1 / 60, { 0: press({ down: true, heavy: true }) });
    expect(s.events.some((e) => e.kind === "catch")).toBe(false);
    expect(coopTally(s, 0).catches).toBe(0);
  });

  it("队友的脑袋是一小块软平台：跳上去站得住，不会直接穿过去", () => {
    const s = createMatch({
      ...soloCfg(),
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 0, control: "p2", stocks: 9 },
      ],
    });
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const [lifter, rider] = s.actors;
    rider.x = lifter.x;
    rider.y = lifter.y - 90;
    rider.vy = 60;
    rider.onGround = false;
    rider.platIndex = -1;
    for (let i = 0; i < 30 && rider.ride < 0; i++) stepMatch(s, 1 / 60, {});
    expect(rider.ride).toBe(lifter.index);
    expect(rider.onGround).toBe(true);
    // 站着不动就一直站得住，有的是工夫喊队友顶一下
    for (let i = 0; i < 60; i++) stepMatch(s, 1 / 60, {});
    expect(rider.ride).toBe(lifter.index);
  });

  it("对手的脑袋踩不住——这条路只通向配合", () => {
    const s = createMatch({
      ...soloCfg(),
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 1, control: "p2", stocks: 9 },
      ],
    });
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const [under, over] = s.actors;
    over.safe = 0;
    over.x = under.x;
    over.y = under.y - 90;
    over.vy = 60;
    over.onGround = false;
    over.platIndex = -1;
    for (let i = 0; i < 30; i++) stepMatch(s, 1 / 60, {});
    expect(over.ride).toBe(-1);
  });

  it("站在队友头顶上按「上」就是顶举，不是自己起跳", () => {
    const s = createMatch({
      ...soloCfg(),
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 0, control: "p2", stocks: 9 },
      ],
    });
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const [lifter, rider] = s.actors;
    rider.x = lifter.x;
    rider.y = lifter.y - 90;
    rider.vy = 60;
    rider.onGround = false;
    rider.platIndex = -1;
    for (let i = 0; i < 30 && rider.ride < 0; i++) stepMatch(s, 1 / 60, {});
    expect(rider.ride).toBe(lifter.index);
    stepMatch(s, 1 / 60, { 0: press({ up: true }) });
    expect(coopTally(s, 0).lifts).toBe(1);
    expect(rider.ride).toBe(-1);
    expect(rider.vy).toBeLessThan(-400);
    expect(lifter.onGround).toBe(true);
  });

  it("被顶起来的队友飞得比自己起跳高得多", () => {
    const s = createMatch({
      ...soloCfg(),
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 9 },
        { charId: "xingxing", team: 0, control: "p2", stocks: 9 },
      ],
    });
    for (let i = 0; i < 120; i++) stepMatch(s, 1 / 60, {});
    const [lifter, rider] = s.actors;
    const floor = rider.y;
    rider.x = lifter.x;
    rider.y = lifter.y - 90;
    rider.vy = 60;
    rider.onGround = false;
    rider.platIndex = -1;
    for (let i = 0; i < 30 && rider.ride < 0; i++) stepMatch(s, 1 / 60, {});
    stepMatch(s, 1 / 60, { 0: press({ up: true }) });
    let top = rider.y;
    for (let i = 0; i < 60; i++) {
      stepMatch(s, 1 / 60, {});
      top = Math.min(top, rider.y);
    }
    const own = (JUMP_V * fighterById("xingxing").jump) ** 2 / (2 * GRAVITY);
    expect(floor - top).toBeGreaterThan(own);
  });

  it("合作特训里两个人同队，一局不会因为「只剩一队」被判提前结束", () => {
    const s = createMatch({
      ...soloCfg(),
      timeLimit: 20,
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 3 },
        { charId: "xingxing", team: 0, control: "p2", stocks: 3 },
      ],
    });
    for (let i = 0; i < 60 * 5; i++) stepMatch(s, 1 / 60, {});
    expect(s.over).toBe(false);
    expect(fighterById(s.actors[0].slot.charId).name).toBe("朵朵");
  });
});
