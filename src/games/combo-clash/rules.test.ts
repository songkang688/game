import { describe, expect, it } from "vitest";
import { characterById, type Move } from "./frames";
import {
  CLASH_PRIORITY_GAP,
  COMBO_RESET_FRAMES,
  CORNER_MARGIN,
  GUARD_CRUSH_STUN,
  JUGGLE_LIMIT,
  LAND_CANCEL_WINDOW,
  LANDING_LAG,
  MAX_NORMAL_STUN,
  MAX_ROUNDS,
  ROUNDS_TO_WIN,
  THROW_INVULN_FRAMES,
  THROW_RANGE,
  WAKEUP_KINDS,
  airThrowConnects,
  bodyGap,
  canCancelInto,
  canCancelNow,
  canGuard,
  canSuperCancel,
  cancelWindowEnd,
  cancelWindowStart,
  clashOrHit,
  comboScale,
  comboTotalPower,
  cornerClamp,
  cornerHitStun,
  cornerKnockback,
  describeInput,
  facingTowards,
  forcedKnockdown,
  guardAfterBlock,
  guardBeats,
  guardBreakStun,
  guardCrush,
  guardRegen,
  hitStopFrames,
  holdingBack,
  hurtRect,
  inCancelWindow,
  inputOf,
  isActiveFrame,
  isCornered,
  isInvulnFrame,
  isResting,
  isValidCombo,
  juggleScale,
  landCancel,
  landingLagAfter,
  matchOver,
  matchResult,
  meterAfterGain,
  meterAfterSuper,
  movePhase,
  onBlockAdvantage,
  onHitAdvantage,
  overlapCenter,
  punishableOnBlock,
  pushApart,
  pushHistory,
  rateByVigor,
  readCommand,
  rectsOverlap,
  roundResult,
  scaledHitStun,
  scaledPower,
  shakeAmount,
  sparkCount,
  superCost,
  superCutinFrames,
  superLevelFor,
  techWindowOpen,
  throwConnects,
  throwInvuln,
  totalFrames,
  vigorAfter,
  wakeupFrames,
  wakeupOptions,
  wakeupShift,
  whiffCancelFails,
  worldBox
} from "./rules";

const duo = characterById("duoduo");
const L = duo.moves["5L"];
const H = duo.moves["5H"];
const S1 = duo.moves.s1;
const SV1 = duo.moves.sv1;
const SV2 = duo.moves.sv2;
const TH = duo.moves.throw;

describe("combo-clash · 几何与判定框", () => {
  it("朝右时框往前长,朝左时整个镜像过去", () => {
    const box = { x: 10, y: 20, w: 30, h: 40 };
    expect(worldBox(100, 0, 1, box)).toEqual({ x: 110, y: 20, w: 30, h: 40 });
    expect(worldBox(100, 0, -1, box)).toEqual({ x: 60, y: 20, w: 30, h: 40 });
  });

  it("矩形重叠:边贴边不算重叠", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsOverlap(a, { x: 9, y: 0, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it("重叠中心落在两个框中间", () => {
    const c = overlapCenter({ x: 0, y: 0, w: 10, h: 10 }, { x: 6, y: 0, w: 10, h: 10 });
    expect(c.x).toBe(8);
  });

  it("蹲下的受击框比站着矮", () => {
    const stand = hurtRect(100, 0, 15, 70, 45, "stand");
    const crouch = hurtRect(100, 0, 15, 70, 45, "crouch");
    expect(crouch.h).toBeLessThan(stand.h);
    expect(crouch.x).toBe(85);
  });

  it("面朝对手、身体净距离与推挤都算得对", () => {
    expect(facingTowards(100, 200)).toBe(1);
    expect(facingTowards(200, 100)).toBe(-1);
    expect(bodyGap(100, 150, 15, 15)).toBe(20);
    expect(bodyGap(100, 120, 15, 15)).toBe(0);
    expect(pushApart(100, 120, 15, 15)).toBe(5);
    expect(pushApart(100, 200, 15, 15)).toBe(0);
  });
});

describe("combo-clash · 三段帧推进", () => {
  it("起手 → 命中 → 收招 → 结束,一段都不会跳", () => {
    expect(movePhase(L, 0)).toBe("startup");
    expect(movePhase(L, L.startup - 1)).toBe("startup");
    expect(movePhase(L, L.startup)).toBe("active");
    expect(movePhase(L, L.startup + L.active - 1)).toBe("active");
    expect(movePhase(L, L.startup + L.active)).toBe("recovery");
    expect(movePhase(L, totalFrames(L))).toBe("done");
  });

  it("判定框只在 active 那几帧生效", () => {
    for (let f = 0; f < totalFrames(L); f++) {
      const shouldHit = f >= L.startup && f < L.startup + L.active;
      expect(isActiveFrame(L, f), `第 ${f} 帧`).toBe(shouldHit);
    }
  });

  it("超必有无敌帧,普通招没有", () => {
    expect(isInvulnFrame(SV1, 0)).toBe(true);
    expect(isInvulnFrame(SV1, (SV1.invulnTo ?? 0) + 1)).toBe(false);
    expect(isInvulnFrame(L, 0)).toBe(false);
  });

  it("帧数差:重击被挡下比轻击亏,收招大的招会被确反", () => {
    expect(onBlockAdvantage(L)).toBeGreaterThan(onBlockAdvantage(H));
    expect(onHitAdvantage(L)).toBeGreaterThan(onBlockAdvantage(L));
    expect(punishableOnBlock(duo.moves["2H"])).toBe(true);
    expect(punishableOnBlock(L)).toBe(false);
  });
});

describe("combo-clash · 上中下段与站蹲挡的四种组合", () => {
  it("上段:站着挡得住,蹲着挡不住", () => {
    expect(guardBeats("high", false)).toBe(true);
    expect(guardBeats("high", true)).toBe(false);
  });

  it("下段:蹲着挡得住,站着挡不住", () => {
    expect(guardBeats("low", true)).toBe(true);
    expect(guardBeats("low", false)).toBe(false);
  });

  it("中段站蹲都能挡,投技谁都挡不住", () => {
    expect(guardBeats("mid", true)).toBe(true);
    expect(guardBeats("mid", false)).toBe(true);
    expect(guardBeats("throw", true)).toBe(false);
    expect(guardBeats("throw", false)).toBe(false);
  });

  it("空中不能防御;不按后方向也不算格挡", () => {
    expect(canGuard("air", "mid", true)).toBe(false);
    expect(canGuard("stand", "mid", false)).toBe(false);
    expect(canGuard("stand", "mid", true)).toBe(true);
    expect(canGuard("crouch", "high", true)).toBe(false);
  });

  it("按住远离对手的方向就是格挡", () => {
    expect(holdingBack(1, true, false)).toBe(true);
    expect(holdingBack(1, false, true)).toBe(false);
    expect(holdingBack(-1, false, true)).toBe(true);
    expect(holdingBack(-1, true, true)).toBe(false);
  });
});

describe("combo-clash · 取消窗口", () => {
  it("窗口从命中帧第一帧开始,到 cancelLag 结束", () => {
    expect(cancelWindowStart(L)).toBe(L.startup);
    expect(cancelWindowEnd(L)).toBe(L.startup + L.active - 1 + L.cancelLag);
  });

  it("命中了才开窗口:窗口内能取消,窗口外不行", () => {
    expect(inCancelWindow(L, L.startup, true)).toBe(true);
    expect(inCancelWindow(L, cancelWindowEnd(L), true)).toBe(true);
    expect(inCancelWindow(L, cancelWindowEnd(L) + 1, true)).toBe(false);
    expect(inCancelWindow(L, L.startup - 1, true)).toBe(false);
  });

  it("空振取消一律失败,只能老实收招", () => {
    expect(inCancelWindow(L, L.startup, false)).toBe(false);
    expect(inCancelWindow(L, L.startup + 2, false)).toBe(false);
    expect(whiffCancelFails(L, L.startup + 2, false)).toBe(true);
    expect(whiffCancelFails(L, L.startup + 2, true)).toBe(false);
  });

  it("取消表是单向的:轻能接重,重接不回轻", () => {
    expect(canCancelInto(L, H)).toBe(true);
    expect(canCancelInto(H, L)).toBe(false);
    expect(canCancelInto(H, S1)).toBe(true);
    expect(canCancelInto(S1, SV1)).toBe(true);
    expect(canCancelInto(SV1, H)).toBe(false);
    expect(canCancelInto(TH, L)).toBe(false);
  });

  it("类别和窗口两个条件要同时满足", () => {
    expect(canCancelNow(L, H, L.startup + 1, true)).toBe(true);
    expect(canCancelNow(L, H, L.startup + 1, false)).toBe(false);
    expect(canCancelNow(H, L, H.startup + 1, true)).toBe(false);
  });
});

describe("combo-clash · 超级取消与三条槽", () => {
  it("只有必杀能超级取消,普通招不行", () => {
    expect(canSuperCancel(S1, 100)).toBe(2);
    expect(canSuperCancel(H, 100)).toBe(0);
    expect(canSuperCancel(SV1, 100)).toBe(0);
  });

  it("LV1 要 50 槽,LV2 要 100 槽,不够就是 0", () => {
    expect(canSuperCancel(S1, 49)).toBe(0);
    expect(canSuperCancel(S1, 50)).toBe(1);
    expect(canSuperCancel(S1, 99)).toBe(1);
    expect(superLevelFor(100)).toBe(2);
    expect(superCost(1)).toBe(50);
    expect(superCost(2)).toBe(100);
    expect(superCost(0)).toBe(0);
  });

  it("放完超必扣槽,涨槽封顶 100", () => {
    expect(meterAfterSuper(100, 2)).toBe(0);
    expect(meterAfterSuper(70, 1)).toBe(20);
    expect(meterAfterGain(95, 20)).toBe(100);
    expect(meterAfterGain(10, -50)).toBe(0);
  });

  it("护盾:挡一下掉一块,掉光就是破防,而且硬直显著变长", () => {
    expect(guardAfterBlock(30, 12)).toBe(18);
    expect(guardAfterBlock(5, 12)).toBe(0);
    expect(guardCrush(0)).toBe(true);
    expect(guardCrush(1)).toBe(false);
    expect(guardBreakStun()).toBe(GUARD_CRUSH_STUN);
    expect(guardBreakStun()).toBeGreaterThan(MAX_NORMAL_STUN);
    expect(guardBreakStun()).toBeGreaterThan(H.blockStun * 3);
  });

  it("不挡的时候护盾会慢慢回,但不会超上限", () => {
    expect(guardRegen(50, 100, 10)).toBeGreaterThan(50);
    expect(guardRegen(99.9, 100, 100)).toBe(100);
  });
});

describe("combo-clash · 跳入落地接", () => {
  it("空中招命中过才有落地取消窗口", () => {
    expect(landCancel(true, 0)).toBe(true);
    expect(landCancel(true, LAND_CANCEL_WINDOW - 1)).toBe(true);
    expect(landCancel(true, LAND_CANCEL_WINDOW)).toBe(false);
    expect(landCancel(false, 0)).toBe(false);
  });

  it("空振落地要站满全部落地硬直", () => {
    expect(landingLagAfter(false)).toBe(LANDING_LAG);
    expect(landingLagAfter(true)).toBeLessThan(LANDING_LAG);
  });
});

describe("combo-clash · 对拼", () => {
  it("优先级差 ≤ 1 就火花互退", () => {
    const mk = (priority: number): Move => ({ ...L, priority });
    expect(clashOrHit(mk(3), mk(3))).toBe("clash");
    expect(clashOrHit(mk(3), mk(4))).toBe("clash");
    expect(clashOrHit(mk(5), mk(3))).toBe("a");
    expect(clashOrHit(mk(3), mk(5))).toBe("b");
    expect(CLASH_PRIORITY_GAP).toBe(1);
  });
});

describe("combo-clash · 倒地与起身三选一", () => {
  it("三种起身都在,受身窗口关了就只剩两种", () => {
    expect(WAKEUP_KINDS).toHaveLength(3);
    expect(wakeupOptions(true)).toHaveLength(3);
    expect(wakeupOptions(false)).toEqual(["inPlace", "backRoll"]);
  });

  it("受身起得最快,后跳起来最慢但能拉开距离", () => {
    expect(wakeupFrames("tech")).toBeLessThan(wakeupFrames("inPlace"));
    expect(wakeupFrames("inPlace")).toBeLessThan(wakeupFrames("backRoll"));
    expect(wakeupShift("backRoll")).toBeGreaterThan(0);
    expect(wakeupShift("tech")).toBe(0);
  });

  it("受身窗口只有倒地后那几帧", () => {
    expect(techWindowOpen(0)).toBe(true);
    expect(techWindowOpen(9)).toBe(true);
    expect(techWindowOpen(10)).toBe(false);
    expect(techWindowOpen(-1)).toBe(false);
  });

  it("起身前 4 帧投技无敌", () => {
    expect(THROW_INVULN_FRAMES).toBe(4);
    expect(throwInvuln(0)).toBe(true);
    expect(throwInvuln(3)).toBe(true);
    expect(throwInvuln(4)).toBe(false);
  });

  it("投技:要贴身,而且对手不能在硬直、倒地或投无敌里", () => {
    expect(throwConnects(THROW_RANGE, "idle", false, false)).toBe(true);
    expect(throwConnects(THROW_RANGE + 1, "idle", false, false)).toBe(false);
    expect(throwConnects(4, "hitstun", false, false)).toBe(false);
    expect(throwConnects(4, "idle", true, false)).toBe(false);
    expect(throwConnects(4, "idle", false, true)).toBe(false);
  });

  it("跳投:两个人都得在空中", () => {
    expect(airThrowConnects(10, true, true, "jump")).toBe(true);
    expect(airThrowConnects(10, true, false, "idle")).toBe(false);
    expect(airThrowConnects(99, true, true, "jump")).toBe(false);
  });
});

describe("combo-clash · 贴边", () => {
  it("会被夹在场地里,并报告贴到了哪一边", () => {
    expect(cornerClamp(-20, 15, 600)).toEqual({ x: 15, atCorner: "left" });
    expect(cornerClamp(700, 15, 600)).toEqual({ x: 585, atCorner: "right" });
    expect(cornerClamp(300, 15, 600)).toEqual({ x: 300, atCorner: null });
  });

  it("离边够近就算贴边", () => {
    expect(isCornered(20, 15, 600)).toBe(true);
    expect(isCornered(300, 15, 600)).toBe(false);
    expect(isCornered(600 - 15 - CORNER_MARGIN + 1, 15, 600)).toBe(true);
  });

  it("贴边连段更厚:硬直加长、击退打折", () => {
    expect(cornerHitStun(20, true)).toBeGreaterThan(cornerHitStun(20, false));
    expect(cornerKnockback(10, true)).toBeLessThan(cornerKnockback(10, false));
  });
});

describe("combo-clash · 连段衰减与无限连防护", () => {
  it("连段越往后削得越少", () => {
    expect(comboScale(0)).toBe(1);
    expect(comboScale(1)).toBeLessThan(1);
    expect(comboScale(5)).toBeLessThan(comboScale(2));
    expect(comboScale(50)).toBeGreaterThan(0);
  });

  it("空中连衰减比地面连更狠", () => {
    expect(juggleScale(2)).toBeLessThan(comboScale(2));
    expect(juggleScale(0)).toBe(1);
  });

  it("威力与硬直都跟着连段递减,但不会掉到 0", () => {
    expect(scaledPower(20, 0)).toBe(20);
    expect(scaledPower(20, 3)).toBeLessThan(20);
    expect(scaledPower(20, 3, true)).toBeLessThan(scaledPower(20, 3, false));
    expect(scaledPower(1, 9)).toBeGreaterThanOrEqual(1);
    expect(scaledHitStun(30, 5)).toBeLessThan(30);
    expect(scaledHitStun(8, 20)).toBeGreaterThanOrEqual(7);
  });

  it("超过八段强制倒地", () => {
    expect(JUGGLE_LIMIT).toBe(8);
    expect(forcedKnockdown(7)).toBe(false);
    expect(forcedKnockdown(8)).toBe(true);
  });

  it("一串连段接不接得起来,纯函数能算出来", () => {
    expect(isValidCombo([L, H, S1, SV1])).toBe(true);
    expect(isValidCombo([H, L])).toBe(false);
    expect(isValidCombo([L, L])).toBe(false);
    expect(isValidCombo([])).toBe(false);
    expect(comboTotalPower([L, H, S1])).toBeGreaterThan(0);
    expect(comboTotalPower([L, H, S1], true)).toBeLessThan(comboTotalPower([L, H, S1]));
    expect(COMBO_RESET_FRAMES).toBeGreaterThan(0);
  });
});

describe("combo-clash · 元气与三局两胜", () => {
  it("元气见底是坐下休息,不是别的", () => {
    expect(vigorAfter(10, 4)).toBe(6);
    expect(vigorAfter(3, 9)).toBe(0);
    expect(isResting(0)).toBe(true);
    expect(isResting(1)).toBe(false);
  });

  it("回合结果:谁先见底谁输,时间到了比元气,一样就平", () => {
    expect(roundResult(50, 0)).toBe(0);
    expect(roundResult(0, 50)).toBe(1);
    expect(roundResult(0, 0)).toBe(-1);
    expect(roundResult(40, 20)).toBe(0);
    expect(roundResult(20, 40)).toBe(1);
    expect(roundResult(30, 30)).toBe(-1);
  });

  it("BO3:先赢两回合拿下整场", () => {
    expect(ROUNDS_TO_WIN).toBe(2);
    expect(matchOver([1, 1])).toBe(false);
    expect(matchOver([2, 1])).toBe(true);
    expect(matchResult([2, 0])).toBe(0);
    expect(matchResult([1, 2])).toBe(1);
    expect(matchResult([1, 1])).toBe(-1);
    expect(MAX_ROUNDS).toBeGreaterThan(ROUNDS_TO_WIN);
  });

  it("闯关按剩余元气评星", () => {
    expect(rateByVigor(100, 100)).toBe(3);
    expect(rateByVigor(40, 100)).toBe(2);
    expect(rateByVigor(5, 100)).toBe(1);
    expect(rateByVigor(0, 0)).toBe(1);
  });
});

describe("combo-clash · 手感与减弱动效", () => {
  it("减弱动效下顿帧为 0、抖动为 0、火花更少", () => {
    expect(hitStopFrames(H, false)).toBe(H.hitStop);
    expect(hitStopFrames(H, true)).toBe(0);
    expect(shakeAmount(20, false)).toBeGreaterThan(0);
    expect(shakeAmount(20, true)).toBe(0);
    expect(sparkCount(20, true)).toBeLessThanOrEqual(sparkCount(20, false));
    expect(superCutinFrames(true)).toBe(0);
    expect(superCutinFrames(false)).toBeGreaterThan(0);
    expect(superCutinFrames(false)).toBeLessThanOrEqual(20);
  });
});

describe("combo-clash · 简化指令与输入历史", () => {
  it("「下 → 前 + 重」在窗口内成立", () => {
    const hist = [inputOf({ down: true }), inputOf({}), inputOf({ right: true, heavy: true })];
    expect(readCommand(hist, 1)).toBe(true);
    expect(readCommand(hist, -1)).toBe(false);
  });

  it("只按前 + 重、或者中间隔太久都不算", () => {
    expect(readCommand([inputOf({ right: true, heavy: true })], 1)).toBe(false);
    const long = [inputOf({ down: true }), ...Array.from({ length: 20 }, () => inputOf({})), inputOf({ right: true, heavy: true })];
    expect(readCommand(long, 1)).toBe(false);
  });

  it("输入历史看得懂,而且不会被连续同一帧刷屏", () => {
    expect(describeInput(inputOf({ down: true, heavy: true }), 1)).toBe("↓重");
    expect(describeInput(inputOf({ right: true }), 1)).toBe("前");
    expect(describeInput(inputOf({ right: true }), -1)).toBe("后");
    expect(describeInput(inputOf({}), 1)).toBe("·");
    let h = pushHistory([], "前");
    h = pushHistory(h, "前");
    h = pushHistory(h, "轻");
    h = pushHistory(h, "·");
    expect(h).toEqual(["前", "轻"]);
    let long: string[] = [];
    for (let i = 0; i < 40; i++) long = pushHistory(long, `第${i}`);
    expect(long.length).toBeLessThanOrEqual(12);
  });
});
