import { describe, expect, it } from "vitest";

import {
  BOSS_W,
  ENEMY_STATS,
  GRAVITY,
  HERO_H,
  HERO_W,
  HURT_INVULN,
  MELEE_RANGE,
  PRINCESS_DOUBLE_V,
  attackKindOf,
  autoPlay,
  bossInfoOf,
  canDamage,
  counterFor,
  createWorld,
  doorOpen,
  doubleJumpApex,
  drainEvents,
  emptyInput,
  endlessScore,
  heroBox,
  isPauseKey,
  isSwapKey,
  jumpApex,
  jumpRange,
  keyToAction,
  killRatio,
  meleeBox,
  metersOf,
  remainingForDoor,
  starGoals,
  starsForRun,
  stepWorld,
  summarize,
  swapActive,
  winMessage,
  type Input,
  type World,
} from "./logic";
import { MAX_GAP, buildLevel, type EnemyKind, type LevelDef } from "./levels";

// ---------------------------------------------------------------------------
// 造一个最小可跑的关:一条平地,想加什么再往里塞
// ---------------------------------------------------------------------------

function bareLevel(over: Partial<LevelDef> = {}): LevelDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "测试场",
    feature: "测试",
    hint: "测试",
    len: 1600,
    goalX: 1470,
    gaps: [],
    platforms: [],
    enemies: [],
    spikes: [],
    gems: [],
    boss: null,
    slippery: false,
    requiredRatio: 0,
    parSeconds: 40,
    gemGoal: 0,
    timeLimit: 0,
    hearts: 6,
    goalNeedsAll: false,
    ...over,
  };
}

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

/** 两位主角都用同一组按键跑 n 秒 */
function run(w: World, seconds: number, inputs: Input[] = [emptyInput(), emptyInput()]): void {
  const dt = 1 / 120;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    if (w.status !== "playing") return;
    stepWorld(w, dt, inputs);
  }
}

/**
 * 攻击是按下那一下触发的,按住不放只出一击 —— 想连打就得松手再按。
 * 这个 helper 每 6 帧松一次手,模拟孩子连点攻击键。
 */
function runMashing(w: World, seconds: number, who: number): void {
  const dt = 1 / 120;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    if (w.status !== "playing") return;
    const inputs = [emptyInput(), emptyInput()];
    inputs[who] = press({ atk: i % 6 < 3 });
    stepWorld(w, dt, inputs);
  }
}

function groundEnemy(kind: EnemyKind, x: number) {
  return { kind, x, minX: x, maxX: x, speed: 0, y: 0 };
}

// ---------------------------------------------------------------------------

describe("克制关系", () => {
  it("铠甲怪弹开星星,只吃近战和踩", () => {
    expect(canDamage("armor", "shot")).toBe(false);
    expect(canDamage("armor", "melee")).toBe(true);
    expect(canDamage("armor", "stomp")).toBe(true);
  });

  it("幽灵是虚体,剑穿过去,只吃远程", () => {
    expect(canDamage("ghost", "melee")).toBe(false);
    expect(canDamage("ghost", "stomp")).toBe(false);
    expect(canDamage("ghost", "shot")).toBe(true);
  });

  it("果冻怪、蝙蝠、炮台谁都打得动", () => {
    for (const kind of ["slime", "bat", "turret"] as EnemyKind[]) {
      expect(canDamage(kind, "melee")).toBe(true);
      expect(canDamage(kind, "shot")).toBe(true);
    }
  });

  it("提示里把铠甲怪派给王子、幽灵派给公主", () => {
    expect(counterFor("armor")).toBe("prince");
    expect(counterFor("ghost")).toBe("princess");
    expect(counterFor("slime")).toBeNull();
    expect(attackKindOf("prince")).toBe("melee");
    expect(attackKindOf("princess")).toBe("shot");
  });
});

describe("键位", () => {
  it("王子走 WASD+F,公主走方向键+L", () => {
    expect(keyToAction("KeyA", 2, 0)).toEqual({ player: 0, action: "left" });
    expect(keyToAction("KeyF", 2, 0)).toEqual({ player: 0, action: "atk" });
    expect(keyToAction("ArrowRight", 2, 0)).toEqual({ player: 1, action: "right" });
    expect(keyToAction("KeyL", 2, 0)).toEqual({ player: 1, action: "atk" });
  });

  it("单人时两套键位都落到当前操作的那一位身上", () => {
    expect(keyToAction("KeyA", 1, 0)).toEqual({ player: 0, action: "left" });
    // 换到公主之后,WASD 和方向键一起归公主
    expect(keyToAction("KeyA", 1, 1)).toEqual({ player: 1, action: "left" });
    expect(keyToAction("ArrowLeft", 1, 1)).toEqual({ player: 1, action: "left" });
    expect(keyToAction("KeyL", 1, 0)).toEqual({ player: 0, action: "atk" });
  });

  it("Tab 换人,Esc 暂停", () => {
    expect(isSwapKey("Tab")).toBe(true);
    expect(isSwapKey("KeyA")).toBe(false);
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyA")).toBe(false);
  });

  it("不认识的键返回 null", () => {
    expect(keyToAction("F5", 2, 0)).toBeNull();
  });
});

describe("跳跃", () => {
  it("王子跳得比公主一段跳高,公主二段跳整体更高", () => {
    expect(jumpApex("prince")).toBeGreaterThan(jumpApex("princess"));
    expect(doubleJumpApex()).toBeGreaterThan(jumpApex("prince"));
  });

  it("王子一跳的水平距离盖得住关卡里最宽的断口", () => {
    expect(jumpRange("prince")).toBeGreaterThan(MAX_GAP + HERO_W);
  });

  it("公主在空中能再蹬一下,王子不能", () => {
    const w = createWorld(bareLevel(), 2);
    const [prince, princess] = w.heroes;
    expect(prince.airJumps).toBe(0);
    expect(princess.airJumps).toBe(1);

    // 起跳 -> 松开 -> 再按:公主的 vy 会被重新拉成上升
    run(w, 0.05, [press({ up: true }), press({ up: true })]);
    run(w, 0.25, [emptyInput(), emptyInput()]);
    const beforeVy = princess.vy;
    stepWorld(w, 1 / 120, [emptyInput(), press({ up: true })]);
    expect(princess.vy).toBeLessThan(beforeVy);
    // 同一帧里重力已经往回加了一点,所以只对得上「差一帧重力」
    expect(princess.vy).toBeCloseTo(-PRINCESS_DOUBLE_V + GRAVITY / 120, 3);
    expect(princess.airJumps).toBe(0);
  });

  it("落地后二段跳会重新充能", () => {
    const w = createWorld(bareLevel(), 2);
    const princess = w.heroes[1];
    run(w, 0.05, [emptyInput(), press({ up: true })]);
    run(w, 0.2, [emptyInput(), emptyInput()]);
    stepWorld(w, 1 / 120, [emptyInput(), press({ up: true })]);
    expect(princess.airJumps).toBe(0);
    run(w, 2, [emptyInput(), emptyInput()]);
    expect(princess.onGround).toBe(true);
    expect(princess.airJumps).toBe(1);
  });

  it("重力把人一直往下拉,落地就停在地面高度", () => {
    const w = createWorld(bareLevel(), 2);
    w.heroes[0].y = -200;
    w.heroes[0].onGround = false;
    stepWorld(w, 1 / 120, [emptyInput(), emptyInput()]);
    expect(w.heroes[0].vy).toBeCloseTo(GRAVITY / 120, 3);
    run(w, 2);
    expect(w.heroes[0].y).toBe(0);
    expect(w.heroes[0].onGround).toBe(true);
  });
});

describe("攻击", () => {
  it("王子挥剑时剑域探到身前,不挥就没有", () => {
    const w = createWorld(bareLevel(), 2);
    const prince = w.heroes[0];
    expect(meleeBox(prince)).toBeNull();
    stepWorld(w, 1 / 120, [press({ atk: true }), emptyInput()]);
    const box = meleeBox(prince);
    expect(box).not.toBeNull();
    expect(box!.x1).toBeGreaterThan(prince.x + HERO_W / 2);
    expect(box!.x1 - prince.x).toBeLessThanOrEqual(HERO_W / 2 + MELEE_RANGE + 1);
  });

  it("王子几剑能砍倒一只果冻怪,公主的星星也能", () => {
    const near = 260;
    for (const who of [0, 1]) {
      const w = createWorld(bareLevel({ enemies: [groundEnemy("slime", near)] }), 2);
      w.heroes[who].x = near - 40;
      w.heroes[who].facing = 1;
      runMashing(w, 4, who);
      expect(w.enemies[0].alive).toBe(false);
      expect(w.kills).toBe(1);
    }
  });

  it("公主的星星打在铠甲怪身上只会被弹开", () => {
    const w = createWorld(bareLevel({ enemies: [groundEnemy("armor", 300)] }), 2);
    w.heroes[1].x = 220;
    w.heroes[1].facing = 1;
    runMashing(w, 3, 1);
    expect(w.enemies[0].alive).toBe(true);
    expect(w.enemies[0].hp).toBe(ENEMY_STATS.armor.hp);
  });

  it("王子的剑砍不动幽灵,公主一星一星能磨掉", () => {
    const melee = createWorld(bareLevel({ enemies: [{ kind: "ghost", x: 300, minX: 300, maxX: 300, speed: 0, y: -40 }] }), 2);
    melee.heroes[0].x = 250;
    melee.heroes[0].facing = 1;
    runMashing(melee, 3, 0);
    expect(melee.enemies[0].alive).toBe(true);

    const shot = createWorld(bareLevel({ enemies: [{ kind: "ghost", x: 300, minX: 300, maxX: 300, speed: 0, y: -40 }] }), 2);
    shot.heroes[1].x = 230;
    shot.heroes[1].facing = 1;
    runMashing(shot, 4, 1);
    expect(shot.enemies[0].alive).toBe(false);
  });

  it("打不动的那一下会给出 block 事件,好让界面提示换人", () => {
    const w = createWorld(bareLevel({ enemies: [groundEnemy("armor", 290)] }), 2);
    w.heroes[1].x = 220;
    w.heroes[1].facing = 1;
    run(w, 2, [emptyInput(), press({ atk: true })]);
    const kinds = drainEvents(w).map((e) => e.kind);
    expect(kinds).toContain("block");
  });
});

describe("共享生命", () => {
  it("谁挨打都扣同一条心条", () => {
    const w = createWorld(bareLevel({ enemies: [groundEnemy("slime", 200)] }), 2);
    const start = w.hearts;
    w.heroes[1].x = 200;
    run(w, 0.2);
    expect(w.hearts).toBe(start - 1);
  });

  it("受伤后有一段公共无敌,不会被连着扣光", () => {
    const w = createWorld(bareLevel({ enemies: [groundEnemy("slime", 200), groundEnemy("slime", 230)] }), 2);
    w.heroes[0].x = 200;
    w.heroes[1].x = 230;
    run(w, 0.2);
    expect(w.hearts).toBe(5);
    expect(w.invuln).toBeGreaterThan(0);
    expect(w.invuln).toBeLessThanOrEqual(HURT_INVULN);
  });

  it("心掉光就算输,并给出一句能看懂的原因", () => {
    const w = createWorld(bareLevel({ hearts: 1, enemies: [groundEnemy("slime", 200)] }), 2);
    w.heroes[0].x = 200;
    run(w, 0.2);
    expect(w.status).toBe("lost");
    expect(w.message.length).toBeGreaterThan(0);
  });

  it("掉进断口会扣心并被送回实地上", () => {
    const w = createWorld(bareLevel({ gaps: [{ x0: 400, x1: 470 }] }), 2);
    w.heroes[0].x = 435;
    w.heroes[0].y = 0;
    w.heroes[0].onGround = false;
    run(w, 2.5);
    expect(w.hearts).toBe(5);
    expect(w.heroes[0].y).toBeLessThanOrEqual(0);
    expect(Math.abs(w.heroes[0].x - 435)).toBeGreaterThan(20);
  });

  it("踩到尖刺扣心", () => {
    const w = createWorld(bareLevel({ spikes: [{ x: 300, w: 60 }] }), 2);
    w.heroes[0].x = 330;
    run(w, 0.2);
    expect(w.hearts).toBe(5);
  });
});

describe("踩敌", () => {
  it("从上方落到果冻怪身上能把它踩扁并弹起来", () => {
    const w = createWorld(bareLevel({ enemies: [groundEnemy("slime", 400)] }), 2);
    const prince = w.heroes[0];
    prince.x = 400;
    prince.y = -120;
    prince.vy = 200;
    prince.onGround = false;
    run(w, 1.2);
    expect(w.kills).toBeGreaterThanOrEqual(1);
    expect(w.hearts).toBe(6);
  });
});

describe("城门", () => {
  it("没打够比例时门不开,打够了就开", () => {
    const enemies = [groundEnemy("slime", 300), groundEnemy("slime", 500)];
    const w = createWorld(bareLevel({ enemies, requiredRatio: 0.5 }), 2);
    expect(doorOpen(w)).toBe(false);
    expect(remainingForDoor(w)).toBe(1);
    w.enemies[0].alive = false;
    w.kills = 1;
    expect(killRatio(w)).toBe(0.5);
    expect(doorOpen(w)).toBe(true);
    expect(remainingForDoor(w)).toBe(0);
  });

  it("门开着走到城门就通关", () => {
    const w = createWorld(bareLevel({ requiredRatio: 0 }), 2);
    expect(doorOpen(w)).toBe(true);
    w.heroes[0].x = w.def.goalX;
    run(w, 0.05);
    expect(w.status).toBe("won");
  });

  it("goalNeedsAll 的关要两位都到齐", () => {
    const w = createWorld(bareLevel({ requiredRatio: 0, goalNeedsAll: true }), 2);
    w.heroes[0].x = w.def.goalX;
    run(w, 0.05);
    expect(w.status).toBe("playing");
    w.heroes[1].x = w.def.goalX;
    run(w, 0.05);
    expect(w.status).toBe("won");
  });

  it("超时算输", () => {
    const w = createWorld(bareLevel({ timeLimit: 1, requiredRatio: 1, enemies: [groundEnemy("slime", 900)] }), 2);
    run(w, 1.4);
    expect(w.status).toBe("lost");
  });
});

describe("首领", () => {
  const bossLevel = () =>
    bareLevel({
      boss: { kind: 0, x: 900, hp: 20, guardSeconds: 4, restSeconds: 3, mini: true },
    });

  it("护甲只吃对应那一种攻击,另一种被弹开", () => {
    const w = createWorld(bossLevel(), 2);
    const boss = w.boss!;
    boss.guard = "melee";
    const hp = boss.hp;

    // 星星打在「只吃近战」的护甲上:掉不了血
    w.heroes[1].x = boss.x - 200;
    w.heroes[1].facing = 1;
    runMashing(w, 1, 1);
    expect(boss.hp).toBe(hp);
  });

  it("换成对的人打就能掉血,打倒即通关", () => {
    const w = createWorld(bossLevel(), 2);
    const boss = w.boss!;
    boss.guard = "melee";
    boss.guardSeconds = 999;
    boss.guardT = 999;
    boss.phase = "rest";
    boss.phaseT = 999;
    w.heroes[0].x = boss.x - BOSS_W / 2 - 30;
    w.heroes[0].facing = 1;
    runMashing(w, 6, 0);
    expect(boss.alive).toBe(false);
    expect(w.status).toBe("won");
  });

  it("踩首领不算伤害", () => {
    const w = createWorld(bossLevel(), 2);
    const boss = w.boss!;
    const hp = boss.hp;
    w.heroes[0].x = boss.x;
    w.heroes[0].y = -180;
    w.heroes[0].vy = 300;
    w.heroes[0].onGround = false;
    run(w, 0.6);
    expect(boss.hp).toBe(hp);
  });

  it("首领关的门只认首领倒没倒", () => {
    const w = createWorld(bossLevel(), 2);
    expect(doorOpen(w)).toBe(false);
    expect(remainingForDoor(w)).toBe(1);
    w.boss!.alive = false;
    expect(doorOpen(w)).toBe(true);
  });

  it("每个首领都有名字、表情和一句战前提示", () => {
    for (let k = 0; k < 7; k++) {
      const info = bossInfoOf({ kind: k } as never);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.emoji.length).toBeGreaterThan(0);
      expect(info.taunt.length).toBeGreaterThan(6);
    }
  });
});

describe("换人", () => {
  it("Tab 在两位之间来回切", () => {
    const w = createWorld(bareLevel(), 1);
    expect(w.active).toBe(0);
    expect(swapActive(w)).toBe(1);
    expect(swapActive(w)).toBe(0);
  });
});

describe("结算", () => {
  const def = bareLevel({ parSeconds: 40, gemGoal: 3 });

  it("三条都做到给三星", () => {
    const r = { win: true, kills: 5, enemyTotal: 5, killPct: 100, gems: 3, time: 30, hearts: 4, bossDown: false };
    expect(starGoals(def, r)).toEqual({ clear: true, time: true, gem: true });
    expect(starsForRun(def, r)).toBe(3);
  });

  it("做到两条给两星,一条给一星", () => {
    const two = { win: true, kills: 5, enemyTotal: 5, killPct: 100, gems: 3, time: 90, hearts: 1, bossDown: false };
    expect(starsForRun(def, two)).toBe(2);
    const one = { win: true, kills: 1, enemyTotal: 5, killPct: 20, gems: 0, time: 90, hearts: 1, bossDown: false };
    expect(starsForRun(def, one)).toBe(1);
  });

  it("过关的话把没做到的那条说成「下次试试」,不说重话", () => {
    const r = { win: true, kills: 2, enemyTotal: 5, killPct: 40, gems: 0, time: 99, hearts: 1, bossDown: false };
    const msg = winMessage(def, r);
    expect(msg).toContain("下次");
    expect(msg).not.toContain("失败");
  });

  it("summarize 把世界折成一张成绩单", () => {
    const w = createWorld(bareLevel({ enemies: [groundEnemy("slime", 300), groundEnemy("slime", 600)] }), 2);
    w.kills = 1;
    w.gemsTaken = 2;
    const r = summarize(w);
    expect(r.enemyTotal).toBe(2);
    expect(r.killPct).toBe(50);
    expect(r.gems).toBe(2);
  });

  it("远征分随着战果单调上涨", () => {
    expect(endlessScore(0, 0, 0)).toBe(0);
    expect(endlessScore(3, 0, 0)).toBeGreaterThan(endlessScore(2, 0, 0));
    expect(endlessScore(0, 3, 0)).toBeGreaterThan(endlessScore(0, 2, 0));
    expect(endlessScore(0, 0, 400)).toBeGreaterThan(endlessScore(0, 0, 100));
    expect(metersOf(200)).toBe(10);
    expect(metersOf(-50)).toBe(0);
  });
});

describe("包围盒", () => {
  it("主角盒子以脚为底、往上一个身位", () => {
    const w = createWorld(bareLevel(), 2);
    const box = heroBox(w.heroes[0]);
    expect(box.y1 - box.y0).toBe(HERO_H);
    expect(box.x1 - box.x0).toBe(HERO_W);
  });
});

describe("机器人", () => {
  it("能自己把第一关打通", () => {
    const w = createWorld(buildLevel(0), 2);
    const r = autoPlay(w, { maxSeconds: 200 });
    expect(r.win).toBe(true);
    expect(r.timedOut).toBe(false);
  });

  it("单人模式下另一位由机器人托管,一样能通关", () => {
    const w = createWorld(buildLevel(3), 1);
    const r = autoPlay(w, { maxSeconds: 200 });
    expect(r.win).toBe(true);
  });

  it("同一关跑两遍结果一模一样(没有藏起来的随机)", () => {
    const a = autoPlay(createWorld(buildLevel(11), 2), { maxSeconds: 200 });
    const b = autoPlay(createWorld(buildLevel(11), 2), { maxSeconds: 200 });
    expect(a.steps).toBe(b.steps);
    expect(a.kills).toBe(b.kills);
    expect(a.hearts).toBe(b.hearts);
  });
});
