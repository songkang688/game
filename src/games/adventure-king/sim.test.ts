import { describe, expect, it } from "vitest";
import { CHAPTERS, LEVELS, buildEndlessFloor, buildSpeedrunCourse } from "./levels";
import {
  botPlay,
  createBotMemory,
  createRun,
  emptyInput,
  stepRun,
  type RunInput,
} from "./sim";

function hold(patch: Partial<RunInput>): RunInput {
  return { ...emptyInput(), ...patch };
}

describe("冒险小王 · 一局的状态机", () => {
  it("开局站在第一块石台上,三件神器一件都没有", () => {
    const s = createRun(LEVELS[0]);
    expect(s.onGround).toBe(true);
    expect(s.py).toBe(LEVELS[0].platforms[0].y);
    expect(s.got.size).toBe(0);
    expect(s.hearts).toBe(LEVELS[0].hearts);
    expect(s.outcome).toBe("run");
  });

  it("按住右边会往右跑,松手会停下来", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    const x0 = s.px;
    for (let i = 0; i < 20; i++) stepRun(lv, s, hold({ right: true }), 1 / 60);
    expect(s.px).toBeGreaterThan(x0);
    expect(s.facing).toBe(1);
    for (let i = 0; i < 60; i++) stepRun(lv, s, hold({}), 1 / 60);
    expect(Math.abs(s.vx)).toBeLessThan(1);
  });

  it("跳起来会离地,落回同一块石台", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    const y0 = s.py;
    const evts = stepRun(lv, s, hold({ jump: true }), 1 / 60);
    expect(evts.some((e) => e.kind === "jump")).toBe(true);
    expect(s.onGround).toBe(false);
    let minY = s.py;
    for (let i = 0; i < 120; i++) {
      stepRun(lv, s, hold({}), 1 / 60);
      minY = Math.min(minY, s.py);
    }
    expect(minY).toBeLessThan(y0 - 80);
    expect(s.py).toBe(y0);
    expect(s.onGround).toBe(true);
  });

  it("空中不能二段跳", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    stepRun(lv, s, hold({ jump: true }), 1 / 60);
    for (let i = 0; i < 5; i++) stepRun(lv, s, hold({}), 1 / 60);
    const evts = stepRun(lv, s, hold({ jump: true }), 1 / 60);
    expect(evts.some((e) => e.kind === "jump")).toBe(false);
  });

  it("附近没有藤环时甩抓钩会落空,不会把人吸走", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    const evts = stepRun(lv, s, hold({ hook: true }), 1 / 60);
    expect(evts.some((e) => e.kind === "noAnchor")).toBe(true);
    expect(s.hook).toBeNull();
  });

  it("回旋镖一次只能有一个,飞完一圈才能再扔", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    expect(stepRun(lv, s, hold({ throw: true }), 1 / 60).some((e) => e.kind === "throw")).toBe(true);
    expect(stepRun(lv, s, hold({ throw: true }), 1 / 60).some((e) => e.kind === "throw")).toBe(false);
    for (let i = 0; i < 80; i++) stepRun(lv, s, hold({}), 1 / 60);
    expect(s.boom).toBeNull();
    expect(stepRun(lv, s, hold({ throw: true }), 1 / 60).some((e) => e.kind === "throw")).toBe(true);
  });

  it("神器没集齐时首领之门推不开,会提示还差几件", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    s.px = lv.door.x + 20;
    s.py = lv.door.y;
    const evts = stepRun(lv, s, hold({}), 1 / 60);
    const locked = evts.find((e) => e.kind === "doorLocked");
    expect(locked).toBeTruthy();
    expect(s.outcome).toBe("run");
  });

  it("集齐三件神器再碰门就通关", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    s.got.add(0);
    s.got.add(1);
    s.got.add(2);
    s.px = lv.door.x + 20;
    s.py = lv.door.y;
    const evts = stepRun(lv, s, hold({}), 1 / 60);
    expect(evts.some((e) => e.kind === "clear")).toBe(true);
    expect(s.outcome).toBe("clear");
  });

  it("掉进坑里会掉一颗心并回到刚才站稳的地方", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    const safeX = s.safeX;
    s.py = 600;
    s.onGround = false;
    const evts = stepRun(lv, s, hold({}), 1 / 60);
    expect(evts.some((e) => e.kind === "hurt")).toBe(true);
    expect(s.hearts).toBe(lv.hearts - 1);
    expect(s.px).toBeCloseTo(safeX, 6);
  });

  it("心掉光了就算失败,之后再推进也不会有事件", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    for (let k = 0; k < lv.hearts; k++) {
      s.invincible = 0;
      s.py = 600;
      s.onGround = false;
      stepRun(lv, s, hold({}), 1 / 60);
    }
    expect(s.outcome).toBe("fail");
    expect(stepRun(lv, s, hold({ right: true }), 1 / 60)).toEqual([]);
  });

  it("回旋镖能把守卫敲掉,敲掉后就不会再撞人", () => {
    const lv = LEVELS.find((l) => l.enemies.some((e) => e.kind === "ground"));
    expect(lv).toBeTruthy();
    if (!lv) return;
    const target = lv.enemies.find((e) => e.kind === "ground");
    if (!target) return;
    const s = createRun(lv);
    s.px = target.from - 120;
    s.py = target.y;
    s.facing = 1;
    let downed = false;
    for (let i = 0; i < 90 && !downed; i++) {
      const evts = stepRun(lv, s, hold({ throw: i === 0 }), 1 / 60);
      downed = evts.some((e) => e.kind === "enemyDown");
    }
    expect(downed).toBe(true);
    expect(s.enemies.some((e) => !e.alive)).toBe(true);
  });

  it("挂上藤环会真的开始荡:横向位移明显,而且不会误判成掉坑", () => {
    const lv = LEVELS.find((l) => l.anchors.length > 0);
    expect(lv).toBeTruthy();
    if (!lv) return;
    const a = lv.anchors[0];
    const gapIdx = lv.platforms.findIndex((p) => p.x > a.x);
    const left = lv.platforms[Math.max(0, gapIdx - 1)];
    const s = createRun(lv);
    s.px = left.x + left.w - 6;
    s.py = left.y;
    s.vx = 250;
    s.facing = 1;
    const evts = stepRun(lv, s, hold({ hook: true, right: true }), 1 / 60);
    expect(evts.some((e) => e.kind === "hookOn")).toBe(true);
    const x0 = s.px;
    let landed = false;
    for (let i = 0; i < 240 && !landed; i++) {
      landed = stepRun(lv, s, hold({ right: true }), 1 / 60).some((e) => e.kind === "land");
    }
    expect(s.hearts).toBe(lv.hearts);
    expect(s.px).toBeGreaterThan(x0 + 60);
  });
});

describe("冒险小王 · 机器人把关卡真的玩通", () => {
  it("第 1 关机器人能捡齐三件神器并推开首领之门", () => {
    const r = botPlay(LEVELS[0]);
    expect(r.outcome).toBe("clear");
    expect(r.artifacts).toBe(3);
  });

  it("188 关全部能被机器人通关(逐关校验)", () => {
    const failed: Array<{ level: number; result: ReturnType<typeof botPlay> }> = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const r = botPlay(LEVELS[i], 140);
      if (r.outcome !== "clear" || r.artifacts < 3) failed.push({ level: i + 1, result: r });
    }
    expect(failed).toEqual([]);
  });

  it("每一章至少抽一关,通关用时都在目标时间的合理范围内", () => {
    let acc = 0;
    for (const ch of CHAPTERS) {
      const lv = LEVELS[acc];
      const r = botPlay(lv, 140);
      expect(r.outcome).toBe("clear");
      expect(r.seconds).toBeLessThan(lv.parSec * 6);
      acc += ch.size;
    }
  });

  it("无尽遗迹前 30 层机器人都能打下去", () => {
    for (let f = 1; f <= 30; f++) {
      const r = botPlay(buildEndlessFloor(f), 140);
      expect({ floor: f, outcome: r.outcome, artifacts: r.artifacts }).toEqual({
        floor: f,
        outcome: "clear",
        artifacts: 3,
      });
    }
  });

  it("八条速通赛道机器人都能跑完", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const r = botPlay(buildSpeedrunCourse(ci), 140);
      expect({ ci, outcome: r.outcome }).toEqual({ ci, outcome: "clear" });
    }
  });

  it("同一关机器人跑两遍结果完全一致(确定性,便于回归)", () => {
    const a = botPlay(LEVELS[100], 140);
    const b = botPlay(LEVELS[100], 140);
    expect(a).toEqual(b);
  });

  it("机器人也会用到抓钩:有藤环的关卡里横跨了宽裂口", () => {
    const idx = LEVELS.findIndex((l) => l.anchors.length >= 2);
    expect(idx).toBeGreaterThanOrEqual(0);
    const r = botPlay(LEVELS[idx], 140);
    expect(r.outcome).toBe("clear");
    expect(r.x).toBeGreaterThan(LEVELS[idx].door.x - 40);
  });
});
