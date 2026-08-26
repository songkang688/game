import { describe, expect, it } from "vitest";
import {
  AIM_BOUNDS,
  FIELD_W,
  FRIEND_PENALTY,
  MUZZLE_X,
  MUZZLE_Y,
  SHOT_GRAVITY,
  accuracy,
  accuracyGrade,
  aimToVelocity,
  canFire,
  comboMultiplier,
  duelResult,
  fireGun,
  gradeWord,
  isOrderViolation,
  isPauseKey,
  keyToAction,
  makeGun,
  makeTarget,
  nextOrder,
  nudgeAim,
  ringScore,
  roundMessage,
  scoreForHit,
  segmentCircleHit,
  segmentRectHit,
  shotPoint,
  startReload,
  starsForRound,
  stepGun,
  stepTarget,
  tideScore,
  tideWave,
  traceShot,
  type Target,
} from "./logic";

// ---------------------------------------------------------------------------
// 弹道
// ---------------------------------------------------------------------------

describe("shoot-range 弹道反解", () => {
  it("星星弹在预计飞行时间落在准星上(瞄哪打哪)", () => {
    const cases = [
      { x: 500, y: 200 },
      { x: 120, y: 420 },
      { x: 940, y: 80 },
      { x: 500, y: 600 },
    ];
    for (const aim of cases) {
      const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, aim.x, aim.y);
      const p = shotPoint(shot, shot.flight);
      expect(Math.abs(p.x - aim.x)).toBeLessThan(1e-6);
      expect(Math.abs(p.y - aim.y)).toBeLessThan(1e-6);
    }
  });

  it("有下坠:同一条弹道在中途比直线更高一点点,末端才追平", () => {
    const aim = { x: 500, y: 120 };
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, aim.x, aim.y);
    const mid = shotPoint(shot, shot.flight / 2);
    const straightMidY = (MUZZLE_Y + aim.y) / 2;
    // y 越小越高:抬了仰角补偿下坠,所以中途在直线上方
    expect(mid.y).toBeLessThan(straightMidY);
    expect(shot.g).toBe(SHOT_GRAVITY);
  });

  it("越远的靶飞行时间越长", () => {
    const near = aimToVelocity(MUZZLE_X, MUZZLE_Y, 500, 560);
    const far = aimToVelocity(MUZZLE_X, MUZZLE_Y, 60, 80);
    expect(far.flight).toBeGreaterThan(near.flight);
  });
});

// ---------------------------------------------------------------------------
// 命中判定
// ---------------------------------------------------------------------------

describe("shoot-range 命中判定", () => {
  it("线段穿过圆返回最早接触参数,擦不到就是 null", () => {
    expect(segmentCircleHit(0, 0, 100, 0, 50, 0, 10)).toBeCloseTo(0.4, 5);
    expect(segmentCircleHit(0, 0, 100, 0, 50, 40, 10)).toBeNull();
    // 线段整段都在圆里
    expect(segmentCircleHit(48, 0, 52, 0, 50, 0, 10)).toBe(0);
    // 圆在线段延长线上(线段还没够到)
    expect(segmentCircleHit(0, 0, 10, 0, 90, 0, 10)).toBeNull();
  });

  it("线段与矩形相交判定认得穿过、起点在内、完全错开三种情况", () => {
    const rect = { x: 40, y: 40, w: 40, h: 40 };
    expect(segmentRectHit(0, 60, 200, 60, rect)).toBeCloseTo(0.2, 5);
    expect(segmentRectHit(50, 50, 200, 60, rect)).toBe(0);
    expect(segmentRectHit(0, 0, 30, 0, rect)).toBeNull();
  });

  it("对准靶心开火必中,而且落点几乎就是靶心", () => {
    const target = makeTarget(1, "bull", 500, 220, 46);
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, target.x, target.y);
    const res = traceShot(shot, [target]);
    expect(res.targetId).toBe(1);
    expect(res.blocked).toBe(false);
    // 扫掠是先碰到圆边,offset 接近半径而不是 0;真正判环靠瞄准点偏差
    expect(res.offset).toBeLessThanOrEqual(target.r + 1);
  });

  it("瞄到靶子外面就打空", () => {
    const target = makeTarget(1, "bull", 500, 220, 40);
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, 120, 220);
    const res = traceShot(shot, [target]);
    expect(res.targetId).toBeNull();
    expect(res.blocked).toBe(false);
  });

  it("木板挡在前面时星星弹停在木板上,不会穿过去打到靶", () => {
    const target = makeTarget(7, "bull", 500, 180, 46);
    const block = { x: 420, y: 300, w: 160, h: 30 };
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, target.x, target.y);
    const res = traceShot(shot, [target], [block]);
    expect(res.blocked).toBe(true);
    expect(res.targetId).toBeNull();
    expect(res.y).toBeGreaterThan(295);
  });

  it("挪开木板的射线角度就能打到同一个靶", () => {
    const target = makeTarget(7, "bull", 300, 180, 46);
    const block = { x: 470, y: 300, w: 120, h: 30 };
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, target.x, target.y);
    const res = traceShot(shot, [target], [block]);
    expect(res.blocked).toBe(false);
    expect(res.targetId).toBe(7);
  });

  it("已经打掉的靶不再参与命中判定,后面的靶会接住这一发", () => {
    const front = makeTarget(1, "bull", 500, 320, 50);
    const back = makeTarget(2, "bull", 500, 160, 50);
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, 500, 160);
    expect(traceShot(shot, [front, back]).targetId).toBe(1);
    expect(traceShot(shot, [{ ...front, alive: false }, back]).targetId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 靶子移动
// ---------------------------------------------------------------------------

describe("shoot-range 靶子移动", () => {
  it("气球一路往上飘,飘出顶部会从底下重新升起", () => {
    let t = makeTarget(1, "balloon", 500, 100, 30, { vy: -120 });
    const first = stepTarget(t, 0.1);
    expect(first.y).toBeLessThan(t.y);
    t = { ...t, y: 62 };
    const wrapped = stepTarget(t, 0.5);
    expect(wrapped.y).toBeGreaterThan(400);
  });

  it("飞碟碰到左右边界会掉头,不会飞出场地", () => {
    const t = makeTarget(2, "ufo", 100, 200, 40, { vx: -400 });
    const next = stepTarget(t, 0.2);
    expect(next.vx).toBeGreaterThan(0);
    expect(next.x - next.r).toBeGreaterThanOrEqual(60 - 1e-6);
    const right = stepTarget(makeTarget(3, "ufo", FIELD_W - 100, 200, 40, { vx: 400 }), 0.2);
    expect(right.vx).toBeLessThan(0);
  });

  it("已经打掉的靶不再移动", () => {
    const t: Target = { ...makeTarget(4, "robot", 300, 200, 40, { vx: 200 }), alive: false };
    expect(stepTarget(t, 1).x).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// 计分与评级
// ---------------------------------------------------------------------------

describe("shoot-range 计分与评级", () => {
  it("同心圆靶越靠圆心环数越高", () => {
    expect(ringScore(0, 40)).toBe(10);
    expect(ringScore(12, 40)).toBe(8);
    expect(ringScore(24, 40)).toBe(6);
    expect(ringScore(38, 40)).toBe(4);
  });

  it("连击倍率每连中一发涨一点,最高封顶 2 倍", () => {
    expect(comboMultiplier(0)).toBeCloseTo(1, 5);
    expect(comboMultiplier(5)).toBeCloseTo(1.5, 5);
    expect(comboMultiplier(10)).toBeCloseTo(2, 5);
    expect(comboMultiplier(99)).toBeCloseTo(2, 5);
    expect(comboMultiplier(-3)).toBeCloseTo(1, 5);
  });

  it("打中好人靶是扣分,而且不受连击倍率影响", () => {
    expect(scoreForHit("friend", 0, 40, 0)).toBe(-FRIEND_PENALTY);
    expect(scoreForHit("friend", 0, 40, 10)).toBe(-FRIEND_PENALTY);
    expect(scoreForHit("bull", 0, 40, 10)).toBe(40);
    expect(scoreForHit("bull", 0, 40, 0)).toBe(20);
  });

  it("命中率评级分四档,零发不算负数", () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(9, 10)).toBeCloseTo(0.9, 5);
    expect(accuracyGrade(1)).toBe("S");
    expect(accuracyGrade(0.85)).toBe("A");
    expect(accuracyGrade(0.65)).toBe("B");
    expect(accuracyGrade(0.2)).toBe("C");
    for (const g of ["S", "A", "B", "C"] as const) {
      expect(gradeWord(g).length).toBeGreaterThan(3);
    }
  });

  it("三星要「不犯规 + 命中率九成」,碰了好人靶最多一星", () => {
    expect(starsForRound({ shots: 10, hits: 10, remaining: 0, friendHits: 0, orderMistakes: 0 })).toBe(3);
    expect(starsForRound({ shots: 10, hits: 8, remaining: 0, friendHits: 0, orderMistakes: 0 })).toBe(2);
    expect(starsForRound({ shots: 10, hits: 10, remaining: 0, friendHits: 1, orderMistakes: 0 })).toBe(1);
    expect(starsForRound({ shots: 10, hits: 10, remaining: 0, friendHits: 0, orderMistakes: 2 })).toBe(2);
    expect(starsForRound({ shots: 20, hits: 8, remaining: 0, friendHits: 0, orderMistakes: 0 })).toBe(1);
  });

  it("结算文案带命中率与评级,犯规了会点出来但不训人", () => {
    const clean = roundMessage({ shots: 10, hits: 10, remaining: 0, friendHits: 0, orderMistakes: 0 });
    expect(clean).toContain("100%");
    expect(clean).toContain("S");
    const oops = roundMessage({ shots: 10, hits: 6, remaining: 0, friendHits: 2, orderMistakes: 0 });
    expect(oops).toContain("好人靶");
    expect(oops).not.toContain("笨");
  });
});

// ---------------------------------------------------------------------------
// 星星弹夹与换弹节奏
// ---------------------------------------------------------------------------

describe("shoot-range 换弹节奏", () => {
  it("打空弹夹会自动开始换弹,换弹期间发不出星星弹", () => {
    let gun = makeGun(2, 1, 0);
    gun = fireGun(gun).gun;
    gun = fireGun(gun).gun;
    expect(gun.mag).toBe(0);
    expect(gun.reloadLeft).toBeCloseTo(1, 5);
    expect(canFire(gun)).toBe(false);
    expect(fireGun(gun).fired).toBe(false);
    gun = stepGun(gun, 1.01);
    expect(gun.mag).toBe(2);
    expect(canFire(gun)).toBe(true);
  });

  it("主动换弹能提前装满,弹夹是满的时候按了没反应", () => {
    let gun = makeGun(6, 1, 0);
    expect(startReload(gun)).toBe(gun);
    gun = fireGun(gun).gun;
    gun = startReload(gun);
    expect(gun.reloadLeft).toBeGreaterThan(0);
    gun = stepGun(gun, 1.2);
    expect(gun.mag).toBe(6);
  });

  it("两发之间有最短间隔,连点也打不出连发", () => {
    let gun = makeGun(6, 1, 0.2);
    gun = fireGun(gun).gun;
    expect(fireGun(gun).fired).toBe(false);
    gun = stepGun(gun, 0.21);
    expect(fireGun(gun).fired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 编号靶顺序
// ---------------------------------------------------------------------------

describe("shoot-range 编号靶顺序", () => {
  it("下一个该打的永远是还立着的最小号", () => {
    const list = [
      makeTarget(0, "number", 200, 200, 40, { order: 1 }),
      makeTarget(1, "number", 400, 200, 40, { order: 2 }),
      makeTarget(2, "number", 600, 200, 40, { order: 3 }),
    ];
    expect(nextOrder(list)).toBe(1);
    const afterFirst = list.map((t) => (t.order === 1 ? { ...t, alive: false } : t));
    expect(nextOrder(afterFirst)).toBe(2);
    expect(nextOrder(afterFirst.map((t) => ({ ...t, alive: false })))).toBe(0);
  });

  it("打错顺序算犯规,按顺序打不算;普通靶怎么打都不算犯规", () => {
    const list = [
      makeTarget(0, "number", 200, 200, 40, { order: 1 }),
      makeTarget(1, "number", 400, 200, 40, { order: 2 }),
    ];
    expect(isOrderViolation(list, list[1])).toBe(true);
    expect(isOrderViolation(list, list[0])).toBe(false);
    expect(isOrderViolation(list, makeTarget(9, "bull", 500, 200, 40))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 准星微调与键位
// ---------------------------------------------------------------------------

describe("shoot-range 准星与键位", () => {
  it("键盘微调不会把准星推出场地", () => {
    expect(nudgeAim({ x: AIM_BOUNDS.x0, y: 300 }, -999, 0).x).toBe(AIM_BOUNDS.x0);
    expect(nudgeAim({ x: AIM_BOUNDS.x1, y: 300 }, 999, 0).x).toBe(AIM_BOUNDS.x1);
    expect(nudgeAim({ x: 500, y: AIM_BOUNDS.y0 }, 0, -999).y).toBe(AIM_BOUNDS.y0);
    expect(nudgeAim({ x: 500, y: 300 }, 20, -20)).toEqual({ x: 520, y: 280 });
  });

  it("双人时两套键位互不抢占,单人时两套都归 1 号玩家", () => {
    expect(keyToAction("KeyA", 2)).toEqual({ player: 0, action: "left" });
    expect(keyToAction("ArrowLeft", 2)).toEqual({ player: 1, action: "left" });
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "fire" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "fire" });
    expect(keyToAction("KeyG", 2)?.action).toBe("reload");
    expect(keyToAction("KeyK", 2)?.action).toBe("reload");
    expect(keyToAction("ArrowLeft", 1)?.player).toBe(0);
    expect(keyToAction("Space", 2)).toBeNull();
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyP")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 无尽靶潮与分屏对战
// ---------------------------------------------------------------------------

describe("shoot-range 无尽靶潮", () => {
  it("波数越高靶越多越快,种类逐步解锁,数量有上限", () => {
    const w1 = tideWave(1);
    const w6 = tideWave(6);
    const w40 = tideWave(40);
    expect(w1.kinds).toEqual(["bull"]);
    expect(w6.kinds).toContain("robot");
    expect(w6.count).toBeGreaterThan(w1.count);
    expect(w6.speed).toBeGreaterThan(w1.speed);
    expect(w40.count).toBeLessThanOrEqual(12);
    expect(w40.speed).toBeLessThanOrEqual(2.4);
    expect(w40.seconds).toBeGreaterThanOrEqual(9);
  });

  it("好人靶第 5 波才混进来,而且比例封顶三成", () => {
    expect(tideWave(4).friendChance).toBe(0);
    expect(tideWave(6).friendChance).toBeGreaterThan(0);
    expect(tideWave(60).friendChance).toBeLessThanOrEqual(0.3);
  });

  it("无尽得分随清靶数与波数单调上升,命中率给加成", () => {
    expect(tideScore(10, 3, 1)).toBeGreaterThan(tideScore(10, 3, 0));
    expect(tideScore(20, 3, 0.5)).toBeGreaterThan(tideScore(10, 3, 0.5));
    expect(tideScore(10, 5, 0.5)).toBeGreaterThan(tideScore(10, 3, 0.5));
    expect(tideScore(0, 1, 0)).toBe(0);
  });
});

describe("shoot-range 分屏对战", () => {
  it("先比命中率,命中率一样比命中数,再一样才平手", () => {
    const a = { name: "朵朵", hits: 8, shots: 10, friendHits: 0 };
    const b = { name: "星星", hits: 6, shots: 10, friendHits: 0 };
    expect(duelResult(a, b).winner).toBe(0);
    expect(duelResult(b, a).winner).toBe(1);
    const same = duelResult({ ...a }, { ...a, name: "星星" });
    expect(same.winner).toBe(-1);
    expect(same.line).toContain("平手");
    const moreHits = duelResult({ name: "朵朵", hits: 8, shots: 10, friendHits: 0 }, { name: "星星", hits: 4, shots: 5, friendHits: 0 });
    expect(moreHits.winner).toBe(0);
  });

  it("误打好人靶按少算一发有效命中处理,足以逆转胜负", () => {
    const clean = { name: "朵朵", hits: 7, shots: 10, friendHits: 0 };
    const sloppy = { name: "星星", hits: 8, shots: 10, friendHits: 2 };
    const res = duelResult(clean, sloppy);
    expect(res.winner).toBe(0);
    expect(res.accB).toBeCloseTo(0.6, 5);
    expect(res.line).toContain("朵朵");
  });
});
