import { describe, expect, it } from "vitest";
import {
  BOOMERANG_RANGE,
  BOOMERANG_SEC,
  GRAVITY,
  JUMP_V,
  MAX_FALL,
  ROPE_MAX,
  RUN_MAX,
  betterTime,
  boomerangDone,
  boomerangOffset,
  canGrab,
  clamp,
  dist,
  endlessFloor,
  endlessFloorTitle,
  fallStep,
  formatTime,
  initialAngVel,
  isNewTimeRecord,
  jumpDistance,
  landsOn,
  levelStars,
  parseBestTimes,
  patrolStep,
  pickAnchor,
  pointInRect,
  rectsOverlap,
  releaseVelocity,
  ropeAngle,
  ropeLength,
  runStep,
  serializeBestTimes,
  swingBottomSpeed,
  swingPoint,
  swingReach,
  swingStep,
  timeAttackStars,
} from "./logic";

describe("冒险小王 · 跑跳物理", () => {
  it("clamp 会把越界的值拉回区间,坏数据落到下界", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(30, 0, 10)).toBe(10);
    expect(clamp(Number.NaN, 2, 8)).toBe(2);
  });

  it("重力每帧加速,但下落速度有封顶", () => {
    expect(fallStep(0, 0.1)).toBeCloseTo(GRAVITY * 0.1, 6);
    expect(fallStep(880, 0.1)).toBe(MAX_FALL);
    expect(fallStep(MAX_FALL, 1)).toBe(MAX_FALL);
  });

  it("按住方向加速到上限,松手会被摩擦拉回 0", () => {
    expect(runStep(0, 1, 0.1)).toBeCloseTo(220, 6);
    expect(runStep(0, 1, 1)).toBe(RUN_MAX);
    expect(runStep(0, -1, 1)).toBe(-RUN_MAX);
    expect(runStep(100, 0, 0.1)).toBe(0);
    expect(runStep(-100, 0, 0.01)).toBeCloseTo(-74, 6);
    expect(runStep(0, 0, 0.1)).toBe(0);
  });

  it("满速起跳能跨过约 193 像素,比关卡里最宽的小坑还宽", () => {
    const d = jumpDistance();
    expect(d).toBeCloseTo((RUN_MAX * 2 * JUMP_V) / GRAVITY, 6);
    expect(d).toBeGreaterThan(180);
  });

  it("巡逻的守卫走到边界会掉头,不会跑出自己的石台", () => {
    let s = { x: 100, dir: 1 };
    for (let i = 0; i < 200; i++) {
      s = patrolStep(s.x, s.dir, 0.05, 120, 100, 180);
      expect(s.x).toBeGreaterThanOrEqual(100);
      expect(s.x).toBeLessThanOrEqual(180);
    }
    expect(patrolStep(180, 1, 0.1, 100, 100, 180).dir).toBe(-1);
    expect(patrolStep(100, -1, 0.1, 100, 100, 180).dir).toBe(1);
  });

  it("从上往下落才算踩到平台:往上飞或从下面穿过去都不算", () => {
    const plat = { x: 0, y: 300, w: 200 };
    expect(landsOn(298, 302, 200, 20, 54, plat)).toBe(true);
    expect(landsOn(298, 302, -200, 20, 54, plat)).toBe(false);
    expect(landsOn(320, 340, 200, 20, 54, plat)).toBe(false);
    expect(landsOn(298, 302, 200, 260, 294, plat)).toBe(false);
    expect(landsOn(280, 290, 200, 20, 54, plat)).toBe(false);
  });
});

describe("冒险小王 · 抓钩与荡绳", () => {
  it("绳子够得着、锚点在上方、又在朝向前方才挂得上", () => {
    expect(canGrab(0, 0, 100, -100)).toBe(true);
    expect(canGrab(0, 0, 100, -100, ROPE_MAX, -1)).toBe(false);
    expect(canGrab(0, 0, -100, -100, ROPE_MAX, -1)).toBe(true);
    expect(canGrab(0, 0, 0, -120)).toBe(true);
    expect(canGrab(0, 0, 100, 100)).toBe(false);
    expect(canGrab(0, 0, 300, -100)).toBe(false);
  });

  it("挑锚点永远挑够得着里面最近的那个,都够不着返回 -1", () => {
    const anchors = [
      { x: 200, y: -60 },
      { x: 80, y: -80 },
      { x: 150, y: -150 },
    ];
    expect(pickAnchor(anchors, 0, 0)).toBe(1);
    expect(pickAnchor(anchors, 0, 0, 60)).toBe(-1);
    expect(pickAnchor([], 0, 0)).toBe(-1);
  });

  it("绳长与角度跟 swingPoint 是一对互逆的换算", () => {
    const ax = 300;
    const ay = 100;
    const px = 380;
    const py = 260;
    const len = ropeLength(px, py, ax, ay);
    const angle = ropeAngle(px, py, ax, ay);
    expect(len).toBeCloseTo(dist(px, py, ax, ay), 6);
    const back = swingPoint(ax, ay, len, angle);
    expect(back.x).toBeCloseTo(px, 6);
    expect(back.y).toBeCloseTo(py, 6);
    expect(ropeAngle(300, 260, 300, 100)).toBeCloseTo(0, 6);
  });

  it("单摆会朝正下方回摆,角速度先增后减", () => {
    let s = { angle: 0.6, angVel: 0 };
    const first = swingStep(s, 200, 0.016, GRAVITY, 0);
    expect(first.angVel).toBeLessThan(0);
    expect(first.angle).toBeLessThan(0.6);
    // 一路摆到另一侧:不加阻尼时最大摆角不会超过起始摆角
    let maxAngle = 0.6;
    s = { angle: 0.6, angVel: 0 };
    let crossed = false;
    for (let i = 0; i < 400; i++) {
      s = swingStep(s, 200, 0.004, GRAVITY, 0);
      maxAngle = Math.max(maxAngle, Math.abs(s.angle));
      if (s.angle < 0) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(maxAngle).toBeLessThan(0.63);
  });

  it("阻尼会把摆动一点点吃掉,越荡越小", () => {
    let damped = { angle: 0.8, angVel: 0 };
    let free = { angle: 0.8, angVel: 0 };
    for (let i = 0; i < 500; i++) {
      damped = swingStep(damped, 200, 0.008, GRAVITY, 0.6);
      free = swingStep(free, 200, 0.008, GRAVITY, 0);
    }
    expect(Math.abs(damped.angVel)).toBeLessThan(Math.abs(free.angVel));
  });

  it("最低点松手是纯水平飞出去,最高点松手几乎不给速度", () => {
    const bottom = releaseVelocity(0, 2, 200);
    expect(bottom.vx).toBeCloseTo(400, 6);
    expect(bottom.vy).toBeCloseTo(0, 6);
    const side = releaseVelocity(Math.PI / 2, 1, 100);
    expect(side.vx).toBeCloseTo(0, 6);
    expect(side.vy).toBeCloseTo(-100, 6);
  });

  it("挂上绳的瞬间只有切向速度会变成转动", () => {
    // 人在锚点正下方向右跑:速度全是切向的
    expect(initialAngVel(0, 200, 200, 0)).toBeCloseTo(1, 6);
    // 人在锚点正下方往下掉:速度全是径向的,转不起来
    expect(initialAngVel(0, 200, 0, 300)).toBeCloseTo(0, 6);
  });

  it("能量守恒:绳越长、起始角越大,荡到底速度越快,飞得也越远", () => {
    expect(swingBottomSpeed(200, Math.PI / 3)).toBeCloseTo(Math.sqrt(2 * GRAVITY * 100), 6);
    expect(swingBottomSpeed(200, 0)).toBe(0);
    expect(swingBottomSpeed(240, 1)).toBeGreaterThan(swingBottomSpeed(200, 1));
    expect(swingReach(200, 1)).toBeGreaterThan(swingReach(200, 0.5));
    expect(swingReach(200, 0)).toBe(0);
  });

  it("绳长 230、起摆 60 度时荡出去的距离能覆盖最宽的裂口", () => {
    expect(swingReach(ROPE_MAX, Math.PI / 3, 60)).toBeGreaterThan(160);
  });
});

describe("冒险小王 · 回旋镖", () => {
  it("飞出去再飞回手里:出手与收手时都在原点", () => {
    expect(boomerangOffset(0, 1).x).toBeCloseTo(0, 6);
    expect(boomerangOffset(BOOMERANG_SEC, 1).x).toBeCloseTo(0, 6);
    expect(boomerangOffset(BOOMERANG_SEC / 2, 1).x).toBeCloseTo(BOOMERANG_RANGE, 6);
  });

  it("朝哪边扔就往哪边飞,超时后位移被夹住不会乱飘", () => {
    expect(boomerangOffset(BOOMERANG_SEC / 2, -1).x).toBeCloseTo(-BOOMERANG_RANGE, 6);
    expect(boomerangOffset(99, 1).x).toBeCloseTo(0, 6);
    expect(Math.abs(boomerangOffset(0.3, 1).y)).toBeLessThan(BOOMERANG_RANGE * 0.2);
  });

  it("飞满一圈才算收回", () => {
    expect(boomerangDone(0)).toBe(false);
    expect(boomerangDone(BOOMERANG_SEC - 0.01)).toBe(false);
    expect(boomerangDone(BOOMERANG_SEC)).toBe(true);
  });
});

describe("冒险小王 · 碰撞、评星与纪录", () => {
  it("矩形相交与点在矩形内", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: 11, y: 0, w: 10, h: 10 })).toBe(false);
    expect(pointInRect(5, 5, a)).toBe(true);
    expect(pointInRect(-1, 5, a)).toBe(false);
  });

  it("神器全收又没受伤才三星", () => {
    expect(levelStars(3, 0)).toBe(3);
    expect(levelStars(3, 1)).toBe(2);
    expect(levelStars(2, 0)).toBe(1);
    expect(levelStars(0, 4)).toBe(1);
  });

  it("速通评星按目标时间打分", () => {
    expect(timeAttackStars(10, 20)).toBe(3);
    expect(timeAttackStars(18, 20)).toBe(2);
    expect(timeAttackStars(25, 20)).toBe(1);
  });

  it("时间排版成两位小数,负数与坏值当 0", () => {
    expect(formatTime(12500)).toBe("12.50 秒");
    expect(formatTime(0)).toBe("0.00 秒");
    expect(formatTime(-9)).toBe("0.00 秒");
    expect(formatTime(Number.NaN)).toBe("0.00 秒");
  });

  it("速通纪录取更小的那个,没有纪录时任何成绩都算新纪录", () => {
    expect(betterTime(0, 5000)).toBe(5000);
    expect(betterTime(5000, 6000)).toBe(5000);
    expect(betterTime(5000, 4200)).toBe(4200);
    expect(betterTime(5000, 0)).toBe(5000);
    expect(isNewTimeRecord(0, 100)).toBe(true);
    expect(isNewTimeRecord(100, 200)).toBe(false);
    expect(isNewTimeRecord(200, 100)).toBe(true);
    expect(isNewTimeRecord(100, 0)).toBe(false);
  });

  it("速通存档:坏数据、缺项、超长都能整理成定长数组", () => {
    expect(parseBestTimes(null, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseBestTimes("不是 JSON", 3)).toEqual([0, 0, 0]);
    expect(parseBestTimes("{}", 3)).toEqual([0, 0, 0]);
    expect(parseBestTimes(JSON.stringify([1200, "x", -5, 900]), 3)).toEqual([1200, 0, 0]);
    expect(parseBestTimes(JSON.stringify([1200]), 3)).toEqual([1200, 0, 0]);
    expect(serializeBestTimes([1200.4, Number.NaN, -3])).toBe("[1200,0,0]");
    expect(parseBestTimes(serializeBestTimes([1, 2, 3]), 3)).toEqual([1, 2, 3]);
  });
});

describe("冒险小王 · 无尽遗迹难度", () => {
  it("越往下石台越多、坑越宽、守卫越多,但都有封顶", () => {
    const f1 = endlessFloor(1);
    const f10 = endlessFloor(10);
    const f99 = endlessFloor(99);
    expect(f10.platforms).toBeGreaterThan(f1.platforms);
    expect(f10.gapMax).toBeGreaterThan(f1.gapMax);
    expect(f10.enemies).toBeGreaterThan(f1.enemies);
    expect(f99.platforms).toBeLessThanOrEqual(12);
    expect(f99.gapMax).toBeLessThanOrEqual(300);
    expect(f99.enemies).toBeLessThanOrEqual(7);
  });

  it("难度曲线单调不回头,层号非法也不会崩", () => {
    let prev = endlessFloor(1);
    for (let f = 2; f <= 60; f++) {
      const cur = endlessFloor(f);
      expect(cur.platforms).toBeGreaterThanOrEqual(prev.platforms);
      expect(cur.gapMax).toBeGreaterThanOrEqual(prev.gapMax);
      expect(cur.enemies).toBeGreaterThanOrEqual(prev.enemies);
      prev = cur;
    }
    expect(endlessFloor(-5).platforms).toBe(endlessFloor(1).platforms);
  });

  it("层名每 4 层换一次石壁", () => {
    expect(endlessFloorTitle(1)).toBe("第 1 层 · 苔痕层");
    expect(endlessFloorTitle(5)).toBe("第 5 层 · 石纹层");
    expect(endlessFloorTitle(21)).toBe("第 21 层 · 苔痕层");
  });
});
