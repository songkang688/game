import { describe, expect, it } from "vitest";
import {
  BEAM_CLEARANCE,
  MAX_GAP,
  MAX_PLATFORM_RISE,
  buildCoop,
  buildEndless,
  buildLevel,
  CHAPTERS,
  type LevelDef,
} from "./levels";
import {
  CROUCH_H,
  DASH_COOLDOWN,
  MOVE_SPEED,
  PLAYER_H,
  autoPlay,
  botInput,
  canStand,
  cleanRatio,
  createWorld,
  doorOpen,
  drainEvents,
  emptyInput,
  endlessScore,
  isPauseKey,
  jumpApex,
  jumpRange,
  keyToAction,
  metersOf,
  playerBox,
  remainingForDoor,
  safeGroundX,
  starGoals,
  starsForRun,
  stepWorld,
  summarize,
  winMessage,
  type Input,
  type World,
} from "./logic";

/** 测试专用的极简关卡:默认是一条什么都没有的干净直路 */
function level(over: Partial<LevelDef> = {}): LevelDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "测试小路",
    feature: "测试",
    hint: "测试",
    len: 1200,
    goalX: 1000,
    gaps: [],
    platforms: [],
    monsters: [],
    stains: [],
    sludges: [],
    sparkles: [],
    springs: [],
    beams: [],
    junks: [],
    litters: [],
    bins: [],
    mission: "sweep",
    weather: "clear",
    cart: null,
    haulGoal: 0,
    roles: false,
    messRate: 0,
    blocks: [],
    chaserSpeed: null,
    slippery: false,
    requiredRatio: 1,
    parSeconds: 20,
    sparkleGoal: 1,
    timeLimit: 0,
    hearts: 3,
    goalNeedsAll: false,
    ...over,
  };
}

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

/** 跑 seconds 秒,每帧都按同一组键 */
function run(w: World, seconds: number, inputs: Input[] = [emptyInput()]): void {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames && w.status === "playing"; i++) stepWorld(w, 1 / 60, inputs);
}

describe("poop-hero 物理与关卡红线", () => {
  it("一次起跳跳得比最高的平台还高", () => {
    expect(jumpApex()).toBeGreaterThan(MAX_PLATFORM_RISE + 15);
  });

  it("一次起跳跨得过最宽的断口", () => {
    expect(jumpRange()).toBeGreaterThan(MAX_GAP + 30);
  });

  it("蹲下来才钻得过管道:蹲着比管道矮,站着比管道高", () => {
    expect(CROUCH_H).toBeLessThan(BEAM_CLEARANCE);
    expect(PLAYER_H).toBeGreaterThan(BEAM_CLEARANCE);
  });
});

describe("poop-hero 双人键位", () => {
  it("朵朵是 W A S D + F/G", () => {
    expect(keyToAction("KeyW", 2)).toEqual({ player: 0, action: "up" });
    expect(keyToAction("KeyA", 2)).toEqual({ player: 0, action: "left" });
    expect(keyToAction("KeyS", 2)).toEqual({ player: 0, action: "down" });
    expect(keyToAction("KeyD", 2)).toEqual({ player: 0, action: "right" });
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "act" });
    expect(keyToAction("KeyG", 2)).toEqual({ player: 0, action: "sub" });
  });

  it("星星是方向键 + L/K", () => {
    expect(keyToAction("ArrowUp", 2)).toEqual({ player: 1, action: "up" });
    expect(keyToAction("ArrowLeft", 2)).toEqual({ player: 1, action: "left" });
    expect(keyToAction("ArrowDown", 2)).toEqual({ player: 1, action: "down" });
    expect(keyToAction("ArrowRight", 2)).toEqual({ player: 1, action: "right" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "act" });
    expect(keyToAction("KeyK", 2)).toEqual({ player: 1, action: "sub" });
  });

  it("一个人玩的时候两套键位都归 1 号玩家", () => {
    expect(keyToAction("ArrowRight", 1)).toEqual({ player: 0, action: "right" });
    expect(keyToAction("KeyL", 1)).toEqual({ player: 0, action: "act" });
    expect(keyToAction("KeyD", 1)).toEqual({ player: 0, action: "right" });
  });

  it("没绑定的键返回 null,Esc 是暂停", () => {
    expect(keyToAction("KeyZ", 2)).toBeNull();
    expect(keyToAction("Escape", 2)).toBeNull();
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyP")).toBe(false);
  });
});

describe("poop-hero 跑跳基本功", () => {
  it("开局站在地面上,心是满的", () => {
    const w = createWorld(level({ stains: [{ x: 400 }] }), 1);
    expect(w.status).toBe("playing");
    expect(w.hearts).toBe(3);
    expect(w.dirtTotal).toBe(1);
    expect(w.players[0].onGround).toBe(true);
    expect(w.players[0].y).toBe(0);
    expect(cleanRatio(w)).toBe(0);
  });

  it("按住右键会一直往右跑", () => {
    const w = createWorld(level(), 1);
    const x0 = w.players[0].x;
    run(w, 1, [press({ right: true })]);
    expect(w.players[0].x - x0).toBeGreaterThan(MOVE_SPEED * 0.85);
    expect(w.players[0].facing).toBe(1);
  });

  it("起跳高度接近理论值,落回地面还站得住", () => {
    const w = createWorld(level(), 1);
    let highest = 0;
    for (let i = 0; i < 60; i++) {
      stepWorld(w, 1 / 60, [press({ up: true })]);
      highest = Math.min(highest, w.players[0].y);
    }
    expect(-highest).toBeGreaterThan(jumpApex() * 0.9);
    run(w, 1);
    expect(w.players[0].onGround).toBe(true);
    expect(w.players[0].y).toBe(0);
  });

  it("按住跳只会起跳一次(要松手再按)", () => {
    const w = createWorld(level(), 1);
    run(w, 2.5, [press({ up: true })]);
    const jumps = drainEvents(w).filter((e) => e.kind === "jump").length;
    expect(jumps).toBe(1);
  });

  it("蹲下来身子会变矮", () => {
    const w = createWorld(level(), 1);
    run(w, 0.2, [press({ down: true })]);
    const box = playerBox(w.players[0]);
    expect(box.y1 - box.y0).toBe(CROUCH_H);
    run(w, 0.3);
    expect(playerBox(w.players[0]).y1 - playerBox(w.players[0]).y0).toBe(PLAYER_H);
  });

  it("管道底下站不起来,蹲着能钻过去", () => {
    const w = createWorld(level({ beams: [{ x: 200, w: 140 }] }), 1);
    run(w, 1.6, [press({ right: true, down: true })]);
    const p = w.players[0];
    expect(p.x).toBeGreaterThan(210);
    expect(canStand(w, p)).toBe(false);
    expect(p.crouch).toBe(true);
    run(w, 1.6, [press({ right: true, down: true })]);
    expect(w.players[0].x).toBeGreaterThan(345);
  });

  it("站着走会被管道挡住,过不去", () => {
    const w = createWorld(level({ beams: [{ x: 200, w: 140 }] }), 1);
    run(w, 2.5, [press({ right: true })]);
    expect(w.players[0].x).toBeLessThan(200);
  });
});

describe("poop-hero 清洁大作战", () => {
  it("冲刺清扫能把地上的污渍擦干净", () => {
    const w = createWorld(level({ stains: [{ x: 170 }] }), 1);
    run(w, 0.6, [press({ right: true, act: true })]);
    expect(w.stains[0].clean).toBe(true);
    expect(w.cleaned).toBe(1);
    expect(cleanRatio(w)).toBe(1);
    expect(w.players[0].cleaned).toBe(1);
  });

  it("扫一扫能扫掉正前方的污渍(不用挪地方)", () => {
    const w = createWorld(level({ stains: [{ x: 130 }] }), 1);
    const x0 = w.players[0].x;
    run(w, 0.3, [press({ sub: true })]);
    expect(w.stains[0].clean).toBe(true);
    expect(Math.abs(w.players[0].x - x0)).toBeLessThan(2);
  });

  it("踩中臭臭怪会变成小花,人还会弹起来", () => {
    const def = level({ monsters: [{ x: 300, minX: 300, maxX: 300, speed: 0 }] });
    const w = createWorld(def, 1);
    w.players[0].x = 300;
    w.players[0].y = -160;
    for (let i = 0; i < 60 && !w.monsters[0].clean; i++) stepWorld(w, 1 / 60, [emptyInput()]);
    expect(w.monsters[0].clean).toBe(true);
    expect(w.hearts).toBe(3);
    expect(w.players[0].vy).toBeLessThan(-200);
    expect(drainEvents(w).some((e) => e.kind === "flower")).toBe(true);
  });

  it("从侧面撞上臭臭怪会掉一颗心,并且有一小段无敌时间", () => {
    const def = level({ monsters: [{ x: 300, minX: 300, maxX: 300, speed: 0 }] });
    const w = createWorld(def, 1);
    run(w, 1.2, [press({ right: true })]);
    expect(w.hearts).toBe(2);
    expect(w.players[0].invuln).toBeGreaterThan(0);
    expect(w.monsters[0].clean).toBe(false);
    run(w, 0.4, [press({ right: true })]);
    expect(w.hearts).toBe(2);
  });

  it("冲刺撞上臭臭怪也能把它变成花,人不掉心", () => {
    const def = level({ monsters: [{ x: 190, minX: 190, maxX: 190, speed: 0 }] });
    const w = createWorld(def, 1);
    run(w, 0.26, [press({ right: true, act: true })]);
    expect(w.monsters[0].clean).toBe(true);
    expect(w.hearts).toBe(3);
  });

  it("捡到香香星会计数", () => {
    const w = createWorld(
      level({ sparkles: [{ x: 150, y: -44, ground: true }, { x: 260, y: -44, ground: true }] }),
      1
    );
    run(w, 1, [press({ right: true })]);
    expect(w.sparklesTaken).toBe(2);
    expect(w.players[0].sparkles).toBe(2);
    expect(w.sparkles.every((s) => s.taken)).toBe(true);
  });

  it("泥洼会把脚步拖慢,清干净以后就不拖了", () => {
    const dirty = createWorld(level({ sludges: [{ x: 90, w: 300 }] }), 1);
    const clean = createWorld(level(), 1);
    run(dirty, 1, [press({ right: true })]);
    run(clean, 1, [press({ right: true })]);
    expect(dirty.players[0].x).toBeLessThan(clean.players[0].x - 60);
  });

  it("冲刺能把滚过来的废纸团扫开,不掉心", () => {
    const w = createWorld(level({ junks: [{ x: 200, speed: 0 }] }), 1);
    run(w, 0.6, [press({ right: true, act: true })]);
    expect(w.junks[0].alive).toBe(false);
    expect(w.hearts).toBe(3);
  });

  it("直接撞上废纸团会掉一颗心", () => {
    const w = createWorld(level({ junks: [{ x: 200, speed: 0 }] }), 1);
    run(w, 0.8, [press({ right: true })]);
    expect(w.hearts).toBe(2);
  });
});

describe("poop-hero 地形机关", () => {
  it("弹簧蘑菇弹得比自己跳还高", () => {
    const spring = createWorld(level({ springs: [{ x: 78 }] }), 1);
    let springHigh = 0;
    for (let i = 0; i < 120; i++) {
      stepWorld(spring, 1 / 60, [emptyInput()]);
      springHigh = Math.min(springHigh, spring.players[0].y);
    }
    expect(-springHigh).toBeGreaterThan(jumpApex() * 1.4);
  });

  it("会移动的浮台带着人一起走", () => {
    const def = level({
      platforms: [{ x: 200, y: -60, w: 140, kind: "move", range: 60, speed: 60 }],
    });
    const w = createWorld(def, 1);
    w.players[0].x = 270;
    w.players[0].y = -200;
    run(w, 0.5);
    expect(w.players[0].onGround).toBe(true);
    expect(w.players[0].y).toBe(-60);
    const x0 = w.players[0].x;
    run(w, 1);
    expect(Math.abs(w.players[0].x - x0)).toBeGreaterThan(5);
  });

  it("站在浮台上蹲着按跳,可以穿下去回到地面", () => {
    const def = level({ platforms: [{ x: 200, y: -60, w: 140, kind: "solid" }] });
    const w = createWorld(def, 1);
    w.players[0].x = 270;
    w.players[0].y = -200;
    run(w, 0.5);
    expect(w.players[0].y).toBe(-60);
    run(w, 0.1, [press({ down: true, up: true })]);
    run(w, 0.6);
    expect(w.players[0].y).toBe(0);
    expect(w.players[0].onGround).toBe(true);
  });

  it("掉进断口会掉一颗心,并被放回断口前面站得稳的地方", () => {
    const def = level({ gaps: [{ x0: 200, x1: 300 }] });
    const w = createWorld(def, 1);
    run(w, 2, [press({ right: true })]);
    expect(w.hearts).toBe(2);
    expect(w.players[0].x).toBeLessThan(200);
    expect(w.players[0].x).toBeGreaterThan(60);
  });

  it("safeGroundX 会避开断口边缘", () => {
    const def = level({ gaps: [{ x0: 200, x1: 300 }] });
    const back = safeGroundX(def, 260);
    expect(back).toBeLessThan(200);
    expect(back).toBeGreaterThan(40);
  });

  it("心掉光了这一局就结束,并留一句温柔的话", () => {
    const def = level({ gaps: [{ x0: 200, x1: 400 }] });
    const w = createWorld(def, 1);
    run(w, 12, [press({ right: true })]);
    expect(w.status).toBe("lost");
    expect(w.hearts).toBeLessThanOrEqual(0);
    expect(w.message.length).toBeGreaterThan(6);
    expect(w.message).not.toContain("笨");
  });

  it("臭味潮追上来会掉心,并把人往前推一段", () => {
    const w = createWorld(level({ chaserSpeed: 420 }), 1);
    run(w, 1.6);
    expect(w.hearts).toBeLessThan(3);
    expect(w.players[0].x).toBeGreaterThan(100);
  });

  it("超过时间上限就算这一关没完成", () => {
    const w = createWorld(level({ timeLimit: 3 }), 1);
    run(w, 4);
    expect(w.status).toBe("lost");
    expect(w.message).toContain("时间");
  });
});

describe("poop-hero 净化门与胜负", () => {
  it("没清干净的时候走到门口不算过关", () => {
    const def = level({ stains: [{ x: 400 }], requiredRatio: 1 });
    const w = createWorld(def, 1);
    w.players[0].x = def.goalX - 20;
    expect(doorOpen(w)).toBe(false);
    expect(remainingForDoor(w)).toBe(1);
    run(w, 0.5);
    expect(w.status).toBe("playing");
  });

  it("清干净以后走到门口就过关", () => {
    const def = level({ stains: [{ x: 400 }], requiredRatio: 1 });
    const w = createWorld(def, 1);
    w.players[0].x = 360;
    run(w, 0.4, [press({ right: true, act: true })]);
    expect(doorOpen(w)).toBe(true);
    expect(remainingForDoor(w)).toBe(0);
    w.players[0].x = def.goalX - 30;
    run(w, 0.2);
    expect(w.status).toBe("won");
    expect(summarize(w).win).toBe(true);
  });

  it("双人合作要两个人一起站到净化门前才算赢", () => {
    const def = level({ requiredRatio: 0, goalNeedsAll: true, hearts: 5 });
    const w = createWorld(def, 2);
    w.players[0].x = def.goalX;
    run(w, 0.2);
    expect(w.status).toBe("playing");
    w.players[1].x = def.goalX - 20;
    run(w, 0.2);
    expect(w.status).toBe("won");
  });
});

describe("poop-hero 三星评分与结算文案", () => {
  const def = level({ parSeconds: 30, sparkleGoal: 5 });

  it("清洁度、用时、香香星三条都达成给 3 星", () => {
    const r = { win: true, cleanPct: 100, cleaned: 6, dirtTotal: 6, sparkles: 5, time: 20, hearts: 3 };
    expect(starGoals(def, r)).toEqual({ clean: true, time: true, sparkle: true });
    expect(starsForRun(def, r)).toBe(3);
  });

  it("达成两条给 2 星", () => {
    const r = { win: true, cleanPct: 100, cleaned: 6, dirtTotal: 6, sparkles: 2, time: 20, hearts: 2 };
    expect(starsForRun(def, r)).toBe(2);
  });

  it("只达成一条或一条都没有都给 1 星(过关最少也有 1 星)", () => {
    const one = { win: true, cleanPct: 60, cleaned: 4, dirtTotal: 6, sparkles: 1, time: 22, hearts: 1 };
    const none = { win: true, cleanPct: 60, cleaned: 4, dirtTotal: 6, sparkles: 1, time: 99, hearts: 1 };
    expect(starGoals(def, one)).toEqual({ clean: false, time: true, sparkle: false });
    expect(starsForRun(def, one)).toBe(1);
    expect(starsForRun(def, none)).toBe(1);
  });

  it("过关文案只夸奖和给建议,不出现批评的话", () => {
    const full = winMessage(def, {
      win: true,
      cleanPct: 100,
      cleaned: 6,
      dirtTotal: 6,
      sparkles: 6,
      time: 12,
      hearts: 3,
    });
    expect(full).toContain("真棒");
    const partial = winMessage(def, {
      win: true,
      cleanPct: 60,
      cleaned: 3,
      dirtTotal: 6,
      sparkles: 1,
      time: 99,
      hearts: 1,
    });
    expect(partial).toContain("下次试试");
    for (const bad of ["笨", "蠢", "傻", "屎", "恶心"]) {
      expect(full.includes(bad)).toBe(false);
      expect(partial.includes(bad)).toBe(false);
    }
  });

  it("无尽模式的清洁分把清洁数、香香星和距离都算进去", () => {
    expect(endlessScore(0, 0, 0)).toBe(0);
    expect(endlessScore(3, 2, 40)).toBe(3 * 10 + 2 * 5 + 10);
    expect(endlessScore(3, 2, 40)).toBeGreaterThan(endlessScore(2, 2, 40));
    expect(metersOf(2000)).toBe(100);
    expect(metersOf(-50)).toBe(0);
  });

  it("事件队列取一次就清空(渲染层每帧消费)", () => {
    const w = createWorld(level(), 1);
    run(w, 0.2, [press({ up: true })]);
    expect(drainEvents(w).length).toBeGreaterThan(0);
    expect(drainEvents(w).length).toBe(0);
  });
});

describe("poop-hero 世界步进的稳定性", () => {
  it("一次给很大的 dt 也不会穿过地面", () => {
    const w = createWorld(level(), 1);
    stepWorld(w, 1.5, [press({ right: true })]);
    expect(w.players[0].y).toBeLessThanOrEqual(0);
    expect(w.players[0].x).toBeLessThan(1200);
  });

  it("结算以后再怎么按都不会继续改状态", () => {
    const w = createWorld(level({ timeLimit: 1 }), 1);
    run(w, 2);
    expect(w.status).toBe("lost");
    const snapshot = w.players[0].x;
    run(w, 2, [press({ right: true })]);
    expect(w.players[0].x).toBe(snapshot);
  });

  it("冲刺有冷却,按住也不会一直冲", () => {
    const w = createWorld(level(), 1);
    run(w, 0.05, [press({ act: true })]);
    expect(w.players[0].dashCd).toBeGreaterThan(0);
    expect(w.players[0].dashCd).toBeLessThanOrEqual(DASH_COOLDOWN);
    const dashes = drainEvents(w).filter((e) => e.kind === "dash").length;
    expect(dashes).toBe(1);
  });
});

describe("poop-hero 机器人实打实通关", () => {
  it("第 1 关能被打通", () => {
    const def = buildLevel(0);
    const r = autoPlay(createWorld(def, 1), { maxSeconds: 120 });
    expect(r.win).toBe(true);
    expect(r.lost).toBe(false);
    expect(r.timedOut).toBe(false);
    expect(r.cleanPct).toBeGreaterThanOrEqual(Math.round(def.requiredRatio * 100) - 1);
  });

  it("八个章节各抽两关都能打通", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      let start = 0;
      for (let i = 0; i < ci; i++) start += CHAPTERS[i].size;
      for (const lv of [start, start + CHAPTERS[ci].size - 1]) {
        const def = buildLevel(lv);
        const r = autoPlay(createWorld(def, 1), { maxSeconds: 150 });
        expect(r.win, `第 ${lv + 1} 关(${def.name})打不通`).toBe(true);
        expect(r.time, `第 ${lv + 1} 关超时`).toBeLessThan(def.timeLimit);
      }
    }
  });

  it("全部 188 关都能打通,而且都在时间上限之内", () => {
    for (let lv = 0; lv < 188; lv++) {
      const def = buildLevel(lv);
      const r = autoPlay(createWorld(def, 1), { maxSeconds: 150 });
      expect(r.win, `第 ${lv + 1} 关(${def.name})打不通`).toBe(true);
      expect(r.time).toBeLessThan(def.timeLimit);
    }
  });

  it("标准用时定得合理:机器人一路清一路跑,都能压在标准时间以内", () => {
    for (const lv of [0, 30, 60, 90, 120, 150, 187]) {
      const def = buildLevel(lv);
      const r = autoPlay(createWorld(def, 1), { maxSeconds: 150 });
      expect(r.time, `第 ${lv + 1} 关标准用时太紧`).toBeLessThanOrEqual(def.parSeconds);
    }
  });

  it("无尽模式的前几段街区都跑得通", () => {
    for (let r = 0; r < 4; r++) {
      const res = autoPlay(createWorld(buildEndless(r), 1), { maxSeconds: 150 });
      expect(res.win, `无尽第 ${r + 1} 段跑不通`).toBe(true);
      expect(res.cleaned).toBeGreaterThan(0);
    }
  });

  it("双人合作图两个人一起能清到 100% 并一起到门口", () => {
    for (let r = 0; r < 3; r++) {
      const def = buildCoop(r);
      const w = createWorld(def, 2);
      const res = autoPlay(w, { maxSeconds: 150 });
      expect(res.win, `合作第 ${r + 1} 关打不通`).toBe(true);
      expect(res.cleanPct).toBe(100);
      expect(w.players).toHaveLength(2);
      expect(w.players[0].cleaned + w.players[1].cleaned).toBe(w.cleaned);
    }
  });

  it("机器人在没事可做的空路上也不会乱按(输入是确定的)", () => {
    const w = createWorld(level(), 1);
    const a = botInput(w, 0);
    const b = botInput(w, 0);
    expect(a).toEqual(b);
    expect(a.right).toBe(true);
  });
});
