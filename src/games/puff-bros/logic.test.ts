import { describe, expect, it } from "vitest";
import {
  ARENA_W,
  CEILING_Y,
  FLOOR_Y,
  ROW_GAP,
  ROW_H,
  WALL,
  buildLevel,
  buildVersusArena,
  buildWave,
  rowSurface,
  surfaceSpan,
  type ArenaDef,
  type MonsterDef,
  type PlatformDef,
} from "./arena";
import {
  BLOW_CD,
  BOT_LEVELS,
  BOT_PROFILES,
  BUBBLE_R,
  DIZZY_TIME,
  FLOAT_HEIGHT,
  HELD_LIFE,
  HURT_INVULN,
  KEY_MAP,
  MAX_ROUNDS,
  MONSTER_H,
  MOVE_SPEED,
  PLAYER_H,
  PLAYER_W,
  POP_RANGE,
  PUFF_VY,
  ROUNDS_TO_WIN,
  STRUGGLE_NEED,
  applyRound,
  autoVersusRound,
  blowReach,
  climbX,
  comboBonus,
  createWorld,
  drainEvents,
  emptyInput,
  endlessScore,
  isMatchOver,
  isPauseKey,
  jitter,
  jumpApex,
  jumpRange,
  keyToAction,
  matchWinner,
  newMatch,
  nextHop,
  popGapFromGround,
  popReach,
  restHeightAt,
  rowHeightIsClimbable,
  scoreLine,
  starGoals,
  starsForRun,
  stepWorld,
  summarize,
  supportChainOfPlayer,
  surfaceBelow,
  versusBotInput,
  winMessage,
  type BotLevel,
  type Input,
  type World,
} from "./logic";

// ---------------------------------------------------------------------------
// 测试用的小场地:一整条地板 + 两块叠起来的浮台
// ---------------------------------------------------------------------------

function platform(x: number, row: number, w: number, parent: number): PlatformDef {
  return { x, y: rowSurface(row), w, row, parent };
}

function testArena(over: Partial<ArenaDef> = {}): ArenaDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "测试场地",
    feature: "测试",
    hint: "测试",
    platforms: [platform(200, 1, 160, -1), platform(230, 2, 120, 0)],
    monsters: [],
    candies: [],
    spawns: [
      { x: 60, surface: -1 },
      { x: 580, surface: -1 },
    ],
    hearts: 3,
    parSeconds: 30,
    candyGoal: 1,
    timeLimit: 0,
    roundTarget: 3,
    ...over,
  };
}

function walker(x: number, surface: number, speed = 0): MonsterDef {
  const span = surfaceSpan(testArena().platforms, surface);
  return { kind: "walker", x, surface, minX: span.x0 + 20, maxX: span.x1 - 20, speed, dir: 1 };
}

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

/** 按住同一套键跑 seconds 秒 */
function run(w: World, seconds: number, inputs: Input[] = [emptyInput()], dt = 1 / 120): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWorld(w, dt, inputs);
}

// ---------------------------------------------------------------------------

describe("puff-bros 几何红线", () => {
  it("一次起跳的最高点明显超过层高,浮台才上得去", () => {
    expect(jumpApex()).toBeGreaterThan(ROW_H + PLAYER_H * 0.2);
    expect(rowHeightIsClimbable()).toBe(true);
  });

  it("一次起跳跨得过同一层两块浮台之间的缝", () => {
    expect(jumpRange()).toBeGreaterThan(ROW_GAP * 2);
  });

  it("站在地上就能噗到头顶飘停的泡泡(可解性的地基)", () => {
    expect(popGapFromGround()).toBeLessThan(popReach());
    expect(popReach()).toBe(BUBBLE_R + POP_RANGE);
  });

  it("泡泡飘停的高度小于层高,不会飘进上一层", () => {
    expect(FLOAT_HEIGHT).toBeLessThan(ROW_H);
  });

  it("一口气流吹得比机器人的开火距离更远", () => {
    expect(blowReach()).toBeGreaterThan(130);
  });
});

describe("puff-bros 键位", () => {
  it("朵朵是 WASD + F/G,星星是方向键 + L/K", () => {
    expect(KEY_MAP.KeyW).toEqual({ player: 0, action: "up" });
    expect(KEY_MAP.KeyA).toEqual({ player: 0, action: "left" });
    expect(KEY_MAP.KeyS).toEqual({ player: 0, action: "down" });
    expect(KEY_MAP.KeyD).toEqual({ player: 0, action: "right" });
    expect(KEY_MAP.KeyF).toEqual({ player: 0, action: "act" });
    expect(KEY_MAP.KeyG).toEqual({ player: 0, action: "sub" });
    expect(KEY_MAP.ArrowUp).toEqual({ player: 1, action: "up" });
    expect(KEY_MAP.ArrowLeft).toEqual({ player: 1, action: "left" });
    expect(KEY_MAP.ArrowDown).toEqual({ player: 1, action: "down" });
    expect(KEY_MAP.ArrowRight).toEqual({ player: 1, action: "right" });
    expect(KEY_MAP.KeyL).toEqual({ player: 1, action: "act" });
    expect(KEY_MAP.KeyK).toEqual({ player: 1, action: "sub" });
  });

  it("一个人玩的时候两套键位都归 1 号玩家", () => {
    expect(keyToAction("ArrowLeft", 1)).toEqual({ player: 0, action: "left" });
    expect(keyToAction("KeyA", 1)).toEqual({ player: 0, action: "left" });
  });

  it("人机对战时电脑占 2 号位,方向键那套也归真人不了", () => {
    expect(keyToAction("KeyF", 2, 1)).toEqual({ player: 0, action: "act" });
    expect(keyToAction("ArrowRight", 2, 1)).toEqual({ player: 0, action: "right" });
    expect(keyToAction("ArrowRight", 2, 2)).toEqual({ player: 1, action: "right" });
  });

  it("不认识的键返回 null,Esc 是暂停", () => {
    expect(keyToAction("KeyZ", 2)).toBeNull();
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyW")).toBe(false);
  });
});

describe("puff-bros 跳跃与单向浮台", () => {
  it("站着不动会稳稳待在地板上", () => {
    const w = createWorld(testArena(), { players: 1 });
    run(w, 1);
    expect(w.players[0].y).toBe(FLOOR_Y);
    expect(w.players[0].onGround).toBe(true);
    expect(w.players[0].surface).toBe(-1);
  });

  it("按住方向键会走,撞到墙就停下", () => {
    const w = createWorld(testArena(), { players: 1 });
    run(w, 0.5, [press({ right: true })]);
    expect(w.players[0].x).toBeCloseTo(60 + MOVE_SPEED * 0.5, 0);
    run(w, 6, [press({ left: true })]);
    expect(w.players[0].x).toBe(WALL + PLAYER_W / 2);
  });

  it("跳一下最高能上到 jumpApex,落回原地", () => {
    const w = createWorld(testArena(), { players: 1 });
    let highest = FLOOR_Y;
    for (let i = 0; i < 200; i++) {
      stepWorld(w, 1 / 120, [press({ up: i < 3 })]);
      highest = Math.min(highest, w.players[0].y);
    }
    expect(FLOOR_Y - highest).toBeGreaterThan(jumpApex() - 8);
    expect(FLOOR_Y - highest).toBeLessThanOrEqual(jumpApex() + 1);
    expect(w.players[0].y).toBe(FLOOR_Y);
  });

  it("按住跳不会一直弹:抬起来再按才会起跳第二下", () => {
    const w = createWorld(testArena(), { players: 1 });
    run(w, 1.2, [press({ up: true })]);
    expect(w.players[0].onGround).toBe(true);
    expect(w.players[0].vy).toBe(0);
  });

  it("站在浮台正下方起跳能顶穿上去", () => {
    const w = createWorld(testArena(), { players: 1 });
    const mid = climbX(w.def.platforms, 0);
    w.players[0].x = mid;
    for (let i = 0; i < 200; i++) stepWorld(w, 1 / 120, [press({ up: i < 3 })]);
    expect(w.players[0].surface).toBe(0);
    expect(w.players[0].y).toBe(rowSurface(1));
  });

  it("蹲着按跳能从脚下的浮台穿到下面一层,而且只穿一层", () => {
    const w = createWorld(testArena(), { players: 1 });
    const mid = climbX(w.def.platforms, 1);
    w.players[0].x = mid;
    w.players[0].y = rowSurface(2);
    w.players[0].surface = 1;
    run(w, 0.05, [press({ down: true, up: true })]);
    run(w, 1.2);
    expect(w.players[0].surface).toBe(0);
    expect(w.players[0].y).toBe(rowSurface(1));
  });

  it("走到浮台边上会自己掉下去", () => {
    const w = createWorld(testArena(), { players: 1 });
    w.players[0].x = 260;
    w.players[0].y = rowSurface(1);
    w.players[0].surface = 0;
    run(w, 1.6, [press({ left: true })]);
    expect(w.players[0].surface).toBe(-1);
    expect(w.players[0].y).toBe(FLOOR_Y);
  });

  it("头顶有天花板,再怎么跳也冲不出场地", () => {
    const w = createWorld(testArena(), { players: 1 });
    w.players[0].y = rowSurface(3);
    for (let i = 0; i < 60; i++) stepWorld(w, 1 / 120, [press({ up: i < 3 })]);
    expect(w.players[0].y - PLAYER_H).toBeGreaterThanOrEqual(CEILING_Y - 0.001);
  });
});

describe("puff-bros 泡泡糖气流", () => {
  it("吹一口会生出一颗往前飞的泡泡,而且有冷却", () => {
    const w = createWorld(testArena(), { players: 1 });
    run(w, 1 / 60, [press({ act: true })]);
    expect(w.bubbles).toHaveLength(1);
    expect(w.bubbles[0].vx).toBeGreaterThan(0);
    run(w, BLOW_CD * 0.5, [press({ act: true })]);
    expect(w.bubbles).toHaveLength(1);
    run(w, BLOW_CD, [press({ act: true })]);
    expect(w.bubbles.length).toBeGreaterThan(1);
  });

  it("同一帧里「转身 + 吹」会吹向转过去的那一边", () => {
    const w = createWorld(testArena(), { players: 1 });
    w.players[0].facing = 1;
    run(w, 1 / 120, [press({ left: true, act: true })]);
    expect(w.bubbles[0].vx).toBeLessThan(0);
  });

  it("空泡泡飘到离地面 FLOAT_HEIGHT 的地方停住", () => {
    const w = createWorld(testArena(), { players: 1 });
    run(w, 1 / 120, [press({ act: true })]);
    run(w, 2);
    const b = w.bubbles[0];
    expect(FLOOR_Y - b.y).toBeGreaterThan(FLOAT_HEIGHT - 8);
    expect(FLOOR_Y - b.y).toBeLessThan(FLOAT_HEIGHT + 8);
  });

  it("泡泡飘停的高度按脚下那块地面算,不会飘进上一层", () => {
    const plats = testArena().platforms;
    const overFloor = restHeightAt(plats, 100, 300);
    expect(FLOOR_Y - overFloor).toBeCloseTo(FLOAT_HEIGHT, 5);
    const overPlat = restHeightAt(plats, 280, rowSurface(1) - 20);
    expect(rowSurface(1) - overPlat).toBeCloseTo(FLOAT_HEIGHT, 5);
    expect(overPlat).toBeGreaterThan(rowSurface(2));
  });

  it("泡泡撞到墙就地停住,不会飞出场外", () => {
    const w = createWorld(testArena(), { players: 1 });
    w.players[0].x = ARENA_W - 80;
    run(w, 1 / 120, [press({ right: true, act: true })]);
    run(w, 0.3);
    expect(w.bubbles[0].x).toBeLessThanOrEqual(ARENA_W - WALL - BUBBLE_R + 0.001);
    expect(w.bubbles[0].shootT).toBe(0);
  });

  it("气流裹住咕噜怪:怪不动了,泡泡寿命换成 HELD_LIFE", () => {
    const w = createWorld(testArena({ monsters: [walker(160, -1)] }), { players: 1 });
    run(w, 1 / 120, [press({ act: true })]);
    run(w, 0.5);
    expect(w.monsters[0].state).toBe("bubbled");
    const held = w.bubbles.find((b) => b.hold?.kind === "monster");
    expect(held).toBeDefined();
    expect(held!.life).toBeLessThanOrEqual(HELD_LIFE);
    expect(held!.vx).toBe(0);
  });

  it("噗一下:裹着的咕噜怪变成糖果,清场数 +1", () => {
    const w = createWorld(testArena({ monsters: [walker(130, -1)] }), { players: 1 });
    run(w, 1 / 120, [press({ act: true })]);
    run(w, 1.2);
    const before = w.candies.length;
    run(w, 0.3, [press({ sub: true })]);
    expect(w.monsters[0].state).toBe("gone");
    expect(w.cleared).toBe(1);
    expect(w.players[0].pops).toBe(1);
    expect(w.candies.length).toBe(before + 1);
  });

  it("泡泡自己撑不住会破掉,咕噜怪回到自己那块地面上发懵", () => {
    const w = createWorld(testArena({ monsters: [walker(160, -1)] }), { players: 1 });
    run(w, 1 / 120, [press({ right: true, act: true })]);
    run(w, 0.5);
    expect(w.monsters[0].state).toBe("bubbled");
    run(w, HELD_LIFE + 0.4);
    expect(w.monsters[0].state).toBe("free");
    expect(w.monsters[0].surface).toBe(-1);
    expect(w.monsters[0].y).toBe(FLOOR_Y);
    expect(w.monsters[0].dizzy).toBeGreaterThan(0);
    expect(w.cleared).toBe(0);
  });

  it("咕噜怪被裹住的时候永远不会换地面(机器人导航靠这条)", () => {
    const def = testArena({ monsters: [walker(330, 0)] });
    const w = createWorld(def, { players: 1 });
    w.players[0].x = 220;
    w.players[0].y = rowSurface(1);
    w.players[0].surface = 0;
    run(w, 1 / 120, [press({ right: true, act: true })]);
    run(w, HELD_LIFE + 1);
    expect(w.monsters[0].surface).toBe(0);
    expect(w.monsters[0].y).toBe(rowSurface(1));
  });
});

describe("puff-bros 受伤与落地气浪", () => {
  it("站着蹭到咕噜怪会丢一颗心,而且有无敌时间", () => {
    const w = createWorld(testArena({ monsters: [walker(90, -1)] }), { players: 1 });
    run(w, 0.4, [press({ right: true })]);
    expect(w.hearts).toBe(2);
    expect(w.players[0].invuln).toBeGreaterThan(0);
    expect(w.players[0].invuln).toBeLessThanOrEqual(HURT_INVULN);
    const hearts = w.hearts;
    run(w, 0.6, [press({ right: true })]);
    expect(w.hearts).toBe(hearts);
  });

  it("发懵的咕噜怪撞上也不疼", () => {
    const w = createWorld(testArena({ monsters: [walker(90, -1)] }), { players: 1 });
    w.monsters[0].dizzy = DIZZY_TIME;
    run(w, 0.4, [press({ right: true })]);
    expect(w.hearts).toBe(3);
  });

  it("落地那一下带着气浪,把咕噜怪撞得发懵而不是自己挨打", () => {
    const w = createWorld(testArena({ monsters: [walker(64, -1)] }), { players: 1 });
    const p = w.players[0];
    p.y = FLOOR_Y - 90;
    p.vy = PUFF_VY + 200;
    p.onGround = false;
    run(w, 0.25);
    expect(w.hearts).toBe(3);
    expect(w.monsters[0].dizzy).toBeGreaterThan(0);
  });

  it("心用完就算失败", () => {
    const w = createWorld(testArena({ monsters: [walker(90, -1)], hearts: 1 }), { players: 1 });
    run(w, 0.4, [press({ right: true })]);
    expect(w.hearts).toBe(0);
    expect(w.status).toBe("lost");
    expect(w.message.length).toBeGreaterThan(4);
  });

  it("超过时间上限算失败", () => {
    const w = createWorld(testArena({ monsters: [walker(300, -1)], timeLimit: 2 }), { players: 1 });
    run(w, 2.4);
    expect(w.status).toBe("lost");
  });

  it("清空全部咕噜怪就通关", () => {
    const w = createWorld(testArena({ monsters: [walker(130, -1)] }), { players: 1 });
    run(w, 1 / 120, [press({ act: true })]);
    run(w, 1.2);
    run(w, 0.3, [press({ sub: true })]);
    expect(w.status).toBe("won");
    expect(drainEvents(w).some((e) => e.kind === "win")).toBe(true);
  });
});

describe("puff-bros 对战规则", () => {
  function duelWorld(): World {
    return createWorld(buildVersusArena(0), { players: 2 });
  }

  it("对战场地上两个人互为对手,气流能把对手裹起来", () => {
    const w = duelWorld();
    expect(w.rivalry).toBe(true);
    w.players[0].x = 200;
    w.players[1].x = 260;
    run(w, 1 / 120, [press({ right: true, act: true }), emptyInput()]);
    run(w, 0.4, [emptyInput(), emptyInput()]);
    expect(w.players[1].trapped).toBe(true);
  });

  it("戳破裹着对手的泡泡就得一分", () => {
    const w = duelWorld();
    w.players[0].x = 200;
    w.players[1].x = 260;
    run(w, 1 / 120, [press({ right: true, act: true }), emptyInput()]);
    run(w, 1.0, [press({ right: true }), emptyInput()]);
    run(w, 0.3, [press({ sub: true }), emptyInput()]);
    expect(w.players[0].pops).toBe(1);
    expect(w.players[1].trapped).toBe(false);
    expect(w.players[1].respawnT).toBeGreaterThan(0);
  });

  it("被裹住的人猛按方向键能自己挣扎出来", () => {
    const w = duelWorld();
    w.players[0].x = 200;
    w.players[1].x = 260;
    run(w, 1 / 120, [press({ right: true, act: true }), emptyInput()]);
    run(w, 0.4, [emptyInput(), emptyInput()]);
    expect(w.players[1].trapped).toBe(true);
    for (let i = 0; i < STRUGGLE_NEED + 2; i++) {
      // 一次「按下」才算挣扎一下,所以左右交替按、中间要松开
      stepWorld(w, 1 / 60, [emptyInput(), press({ left: i % 2 === 0, right: i % 2 === 1 })]);
      stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);
    }
    expect(w.players[1].trapped).toBe(false);
    expect(w.players[0].pops).toBe(0);
  });

  it("自己吹的泡泡裹不住自己", () => {
    const w = duelWorld();
    run(w, 2, [press({ act: true }), emptyInput()]);
    expect(w.players[0].trapped).toBe(false);
  });

  it("先拿到 roundTarget 分就赢下这一局", () => {
    const w = duelWorld();
    w.players[0].pops = w.def.roundTarget - 1;
    w.players[0].x = 200;
    w.players[1].x = 260;
    run(w, 1 / 120, [press({ right: true, act: true }), emptyInput()]);
    run(w, 1.0, [press({ right: true }), emptyInput()]);
    run(w, 0.3, [press({ sub: true }), emptyInput()]);
    expect(w.status).toBe("won");
    expect(w.roundWinner).toBe(0);
  });

  it("时间到了按比分定胜负,平了就算平局", () => {
    const w = createWorld(buildVersusArena(0), { players: 2 });
    run(w, 1);
    w.time = w.def.timeLimit - 0.02;
    w.players[0].pops = 2;
    w.players[1].pops = 1;
    run(w, 0.2);
    expect(w.status).toBe("won");
    expect(w.roundWinner).toBe(0);

    const t = createWorld(buildVersusArena(1), { players: 2 });
    t.time = t.def.timeLimit - 0.02;
    run(t, 0.2);
    expect(t.roundWinner).toBe(-1);
  });
});

describe("puff-bros 三局两胜赛制", () => {
  it("先赢两局就拿下整场", () => {
    let m = newMatch();
    expect(matchWinner(m)).toBe(-1);
    expect(isMatchOver(m)).toBe(false);
    m = applyRound(m, 0, [3, 1]);
    expect(matchWinner(m)).toBe(-1);
    m = applyRound(m, 0, [3, 2]);
    expect(m.rounds).toEqual([ROUNDS_TO_WIN, 0]);
    expect(matchWinner(m)).toBe(0);
    expect(isMatchOver(m)).toBe(true);
  });

  it("1:1 之后第三局才定胜负", () => {
    let m = applyRound(applyRound(newMatch(), 0), 1);
    expect(matchWinner(m)).toBe(-1);
    m = applyRound(m, 1);
    expect(matchWinner(m)).toBe(1);
  });

  it("一直平局也不会没完没了:打满 MAX_ROUNDS 就按总分定", () => {
    let m = newMatch();
    for (let i = 0; i < MAX_ROUNDS; i++) m = applyRound(m, -1, [1, 0]);
    expect(m.played).toBe(MAX_ROUNDS);
    expect(isMatchOver(m)).toBe(true);
    expect(matchWinner(m)).toBe(0);
  });

  it("局数和总分都一样就是真平局", () => {
    let m = newMatch();
    for (let i = 0; i < MAX_ROUNDS; i++) m = applyRound(m, -1, [1, 1]);
    expect(matchWinner(m)).toBe(-1);
  });

  it("比分能读成一句话", () => {
    const m = applyRound(newMatch(), 0);
    expect(scoreLine(m, ["朵朵", "星星"])).toBe("朵朵 1 : 0 星星");
  });
});

describe("puff-bros 评分", () => {
  const def = buildLevel(0);

  it("用时、糖果、不丢心三样都做到才是三星", () => {
    const base = {
      win: true,
      cleared: def.monsters.length,
      monsterTotal: def.monsters.length,
      candies: def.candyGoal,
      time: def.parSeconds - 1,
      hearts: def.hearts,
      startHearts: def.hearts,
    };
    expect(starsForRun(def, base)).toBe(3);
    expect(starsForRun(def, { ...base, time: def.parSeconds + 10 })).toBe(2);
    expect(starsForRun(def, { ...base, time: def.parSeconds + 10, candies: 0 })).toBe(1);
    expect(starGoals(def, { ...base, hearts: 1 }).safe).toBe(false);
  });

  it("夸奖只夸做到的部分,没做到的说成「下次试试」", () => {
    const msg = winMessage(def, {
      win: true,
      cleared: def.monsters.length,
      monsterTotal: def.monsters.length,
      candies: 0,
      time: def.parSeconds + 20,
      hearts: 1,
      startHearts: def.hearts,
    });
    expect(msg).toContain("下次试试");
    expect(msg).not.toContain("笨");
  });

  it("无尽分与连击加成都是单调的", () => {
    expect(endlessScore(0, 0, 0)).toBe(0);
    expect(endlessScore(3, 2, 1)).toBeGreaterThan(endlessScore(3, 2, 0));
    expect(endlessScore(4, 0, 0)).toBeGreaterThan(endlessScore(3, 0, 0));
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(3)).toBeGreaterThan(comboBonus(2));
    expect(comboBonus(999)).toBeLessThanOrEqual(60);
  });

  it("summarize 如实报告战况", () => {
    const w = createWorld(testArena({ monsters: [walker(130, -1)] }), { players: 1 });
    run(w, 1 / 120, [press({ act: true })]);
    run(w, 1.2);
    run(w, 0.3, [press({ sub: true })]);
    const s = summarize(w);
    expect(s.win).toBe(true);
    expect(s.cleared).toBe(1);
    expect(s.monsterTotal).toBe(1);
    expect(s.startHearts).toBe(3);
  });
});

describe("puff-bros 支撑树导航", () => {
  it("nextHop 顺着 parent 一层一层往上爬", () => {
    const plats = testArena().platforms;
    expect(nextHop(plats, -1, -1)).toBeNull();
    expect(nextHop(plats, -1, 0)).toEqual({ kind: "up", platform: 0 });
    expect(nextHop(plats, -1, 1)).toEqual({ kind: "up", platform: 0 });
    expect(nextHop(plats, 0, 1)).toEqual({ kind: "up", platform: 1 });
  });

  it("回下面一层走「穿下去」这条路", () => {
    const plats = testArena().platforms;
    expect(nextHop(plats, 1, -1)).toEqual({ kind: "down" });
    expect(nextHop(plats, 1, 0)).toEqual({ kind: "down" });
    expect(nextHop(plats, 0, -1)).toEqual({ kind: "down" });
  });

  it("跨到另一条支撑链上要先退回公共的地面", () => {
    const plats = [platform(60, 1, 120, -1), platform(400, 1, 120, -1)];
    expect(nextHop(plats, 0, 1)).toEqual({ kind: "down" });
    expect(nextHop(plats, -1, 1)).toEqual({ kind: "up", platform: 1 });
  });

  it("surfaceBelow 找的是正下方最近的那块地面", () => {
    const plats = testArena().platforms;
    expect(surfaceBelow(plats, 100, 100)).toBe(-1);
    expect(surfaceBelow(plats, 280, rowSurface(1) - 20)).toBe(0);
    expect(surfaceBelow(plats, 280, rowSurface(2) - 20)).toBe(1);
    expect(surfaceBelow(plats, 280, rowSurface(1) + 20)).toBe(-1);
  });

  it("supportChainOfPlayer 从脚下一路数到地板", () => {
    const w = createWorld(testArena(), { players: 1 });
    w.players[0].surface = 1;
    expect(supportChainOfPlayer(w, w.players[0])).toEqual([1, 0, -1]);
  });
});

describe("puff-bros 人机三档", () => {
  it("正好三档,越难反应越快、瞄得越远", () => {
    expect(BOT_LEVELS).toEqual(["easy", "normal", "hard"]);
    const [e, n, h] = BOT_LEVELS.map((k) => BOT_PROFILES[k]);
    expect(e.react).toBeGreaterThan(n.react);
    expect(n.react).toBeGreaterThan(h.react);
    expect(e.blowRange).toBeLessThan(n.blowRange);
    expect(n.blowRange).toBeLessThan(h.blowRange);
    expect(e.duty).toBeLessThan(h.duty);
    for (const p of [e, n, h]) {
      expect(p.name.length).toBeGreaterThanOrEqual(3);
      expect(p.blurb.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("抖动是确定性的:同样的种子和时间片给同一个数", () => {
    expect(jitter(1234, 5, 7)).toBe(jitter(1234, 5, 7));
    expect(jitter(1234, 5, 7)).not.toBe(jitter(1234, 5, 8));
    for (let i = 0; i < 50; i++) {
      const v = jitter(99, i, i * 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("同一个世界喂两次,人机给出一模一样的键", () => {
    const w = createWorld(buildVersusArena(0), { players: 2 });
    run(w, 1.5, [emptyInput(), emptyInput()]);
    expect(versusBotInput(w, 1, "hard")).toEqual(versusBotInput(w, 1, "hard"));
  });

  it("被裹住的人机会自己挣扎(左右交替按)", () => {
    const w = createWorld(buildVersusArena(0), { players: 2 });
    w.players[1].trapped = true;
    const a = versusBotInput(w, 1, "normal");
    w.time += 0.12;
    const b = versusBotInput(w, 1, "normal");
    expect(a.left || a.right).toBe(true);
    expect(a.left).not.toBe(b.left);
  });

  it("大师打新手,八张场地下来赢得又多又稳", () => {
    let hardWins = 0;
    let easyWins = 0;
    let hardPts = 0;
    let easyPts = 0;
    for (let i = 0; i < 8; i++) {
      const w = createWorld(buildVersusArena(i), { players: 2 });
      const r = autoVersusRound(w, ["hard", "easy"]);
      if (r.winner === 0) hardWins++;
      else if (r.winner === 1) easyWins++;
      hardPts += r.scores[0];
      easyPts += r.scores[1];
    }
    expect(hardWins).toBeGreaterThan(easyWins);
    expect(hardPts).toBeGreaterThan(easyPts);
  });

  it("熟练打新手也占上风", () => {
    let normalPts = 0;
    let easyPts = 0;
    for (let i = 0; i < 6; i++) {
      const r = autoVersusRound(createWorld(buildVersusArena(i), { players: 2 }), ["normal", "easy"]);
      normalPts += r.scores[0];
      easyPts += r.scores[1];
    }
    expect(normalPts).toBeGreaterThan(easyPts);
  });

  it("每一局都在时限内分出结果,不会卡住不动", () => {
    for (const level of BOT_LEVELS) {
      const w = createWorld(buildVersusArena(2), { players: 2 });
      const r = autoVersusRound(w, [level, level]);
      expect(r.timedOut, `${level} 对局没结束`).toBe(false);
      expect(r.time).toBeLessThanOrEqual(w.def.timeLimit + 0.5);
    }
  });
});

describe("puff-bros 物理稳定性", () => {
  it("大 dt 会被切成小步,结果跟小步逐帧推进几乎一样", () => {
    const make = (): World => {
      const w = createWorld(testArena({ monsters: [walker(300, -1, 40)] }), { players: 1 });
      w.players[0].x = 120;
      return w;
    };
    const fine = make();
    const coarse = make();
    // 0.25 秒是 stepWorld 一次最多推进的时间(再长会被截断,见下一条)
    for (let i = 0; i < 60; i++) stepWorld(fine, 1 / 240, [press({ right: true })]);
    stepWorld(coarse, 0.25, [press({ right: true })]);
    expect(Math.abs(fine.players[0].x - coarse.players[0].x)).toBeLessThan(2);
    expect(Math.abs(fine.monsters[0].x - coarse.monsters[0].x)).toBeLessThan(2);
  });

  it("离谱的 dt 不会把人甩出场地", () => {
    const w = createWorld(testArena(), { players: 1 });
    for (let i = 0; i < 20; i++) stepWorld(w, 5, [press({ right: true, up: true })]);
    expect(w.players[0].x).toBeLessThanOrEqual(ARENA_W - WALL);
    expect(w.players[0].x).toBeGreaterThanOrEqual(WALL);
    expect(w.players[0].y).toBeLessThanOrEqual(FLOOR_Y);
  });

  it("咕噜怪永远待在自己那段巡逻区里", () => {
    const w = createWorld(buildLevel(60), { players: 1 });
    run(w, 12);
    for (const m of w.monsters) {
      expect(m.x).toBeGreaterThanOrEqual(m.minX - 0.01);
      expect(m.x).toBeLessThanOrEqual(m.maxX + 0.01);
      expect(m.y).toBeLessThanOrEqual(FLOOR_Y + 0.01);
      expect(m.y - MONSTER_H).toBeGreaterThanOrEqual(CEILING_Y - 0.01);
    }
  });

  it("破掉的泡泡会被回收,不会无限堆积", () => {
    const w = createWorld(buildWave(0), { players: 1 });
    for (let i = 0; i < 60 * 40; i++) stepWorld(w, 1 / 60, [press({ act: true, sub: true })]);
    expect(w.bubbles.length).toBeLessThan(24);
  });

  it("没有输入时世界完全静止(除了怪自己巡逻)", () => {
    const w = createWorld(testArena(), { players: 1 });
    const x = w.players[0].x;
    run(w, 3);
    expect(w.players[0].x).toBe(x);
    expect(w.bubbles).toHaveLength(0);
    expect(w.status).toBe("playing");
  });
});
