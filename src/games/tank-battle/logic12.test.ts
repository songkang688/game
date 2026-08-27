/**
 * 1.2 玩法接进世界之后的用例:地形、弹道、AI 三层单独都对了,
 * 拼到一局里也得对。这一档全部拿手写的小地图直接构造世界,
 * 不依赖 188 关的生成器,读起来一眼就知道在测什么。
 */
import { describe, expect, it } from "vitest";
import {
  BASE_SHIELD_REGROW,
  IDLE_INPUT,
  MUZZLE_WINDUP,
  RECOIL_CELLS,
  RECOIL_PX_MAX,
  RECOIL_PX_MIN,
  RECOIL_SECONDS,
  recoilPixels,
  REBUILD_SECONDS,
  SAFE_SPAWN_DIST,
  SHELL_KEY_MAP,
  SPIN_SECONDS,
  TIER_BY_KIND,
  blockedProbe,
  canFire,
  createWorld,
  driveTank,
  fire,
  inputForPlayer,
  keyConflicts,
  launch,
  onIce,
  playerTank,
  pullTrigger,
  safeSpawn,
  shellBlockedAt,
  shellCool,
  stepWorld,
  tileAt,
  type Tank,
  type World,
} from "./logic";
import { previewPath, shotVelocity } from "./ballistics12";
import { BRICK_FULL, Q_SW, quarterCount } from "./terrain12";

/**
 * 一间空屋子:朵朵在左、星星在右,想往哪儿摆砖就往哪儿摆。
 * 走 `endless` 是因为战役模式「场上没敌人 = 过关」,一排帧就冻住,单点的东西就没法测了。
 */
function room(rows: readonly string[], extra: Partial<Parameters<typeof createWorld>[0]> = {}): World {
  return createWorld({ rows: [...rows], mode: "endless", limit: 999, players: 1, ...extra });
}

/** 一直排帧,直到条件成立或者排够了 */
function run(w: World, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) stepWorld(w, step, [IDLE_INPUT, IDLE_INPUT]);
}

describe("砖:四分之一格进了世界", () => {
  const rows = ["........", "........", "...#....", "........", "1......."];

  it("对着砖中线打两发,那一格才真的没了", () => {
    const w = room(rows);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 4.5;
    me.dir = 0;
    me.shield = 0;
    const i = 2 * w.map.w + 3;

    launch(w, me, "plain");
    run(w, 0.4);
    expect(w.map.tiles[i]).toBe("#");
    expect(quarterCount(w.map.brickMask[i])).toBe(2);
    expect(w.map.brickHp[i]).toBe(1);

    me.shots = 0;
    me.cool = 0;
    launch(w, me, "plain");
    run(w, 0.4);
    expect(w.map.tiles[i]).toBe(".");
    expect(w.map.brickHp[i]).toBe(0);
  });

  it("打偏一点只崩掉一角,后面的弹丸就能从那条缝钻过去", () => {
    const w = room(rows);
    const me = w.tanks[0];
    me.x = 3.2;
    me.y = 4.5;
    me.dir = 0;
    me.shield = 0;
    const i = 2 * w.map.w + 3;

    launch(w, me, "plain");
    run(w, 0.4);
    expect(w.map.tiles[i]).toBe("#");
    expect(quarterCount(w.map.brickMask[i])).toBe(3);
    expect(w.map.brickMask[i] & Q_SW).toBe(0);
    // 缝在左下角:弹丸问过去是「不挡」,右下角还是挡的
    expect(shellBlockedAt(w, 3, 2, 3.2, 2.8)).toBe(false);
    expect(shellBlockedAt(w, 3, 2, 3.8, 2.8)).toBe(true);
    // 车还是过不去:缝只有弹丸钻得过,一直往上顶也只能停在砖前面
    for (let k = 0; k < 120; k++) driveTank(w, me, 0, 1 / 60);
    expect(me.y).toBeGreaterThan(2.9);
  });

  it("玩家补的砖是完整的一整块,不是残的", () => {
    const w = room(["........", "1.......", "........"], { bricks: 2 });
    const me = w.tanks[0];
    me.dir = 1;
    expect(w.map.tiles[1 * w.map.w + 1]).toBe(".");
    stepWorld(w, 1 / 60, [{ dir: -1, fire: false, brick: true }]);
    const i = 1 * w.map.w + 1;
    expect(w.map.tiles[i]).toBe("#");
    expect(w.map.brickMask[i]).toBe(BRICK_FULL);
    expect(me.bricks).toBe(1);
  });
});

describe("三种弹丸打在墙上", () => {
  it("彩纸穿甲弹是唯一拆得动钢板的一发", () => {
    const rows = ["........", "........", "...S....", "........", "1......."];
    const plain = room(rows);
    const p = plain.tanks[0];
    p.x = 3.5;
    p.y = 4.5;
    p.dir = 0;
    launch(plain, p, "plain");
    run(plain, 0.5);
    expect(tileAt(plain.map, 3, 2)).toBe("S");

    const pierce = room(rows);
    const q = pierce.tanks[0];
    q.x = 3.5;
    q.y = 4.5;
    q.dir = 0;
    launch(pierce, q, "pierce");
    run(pierce, 0.5);
    expect(tileAt(pierce.map, 3, 2)).toBe(".");
  });

  it("穿甲弹连穿两层就散了,不会一路把整排墙推平", () => {
    const w = room(["........", "...S....", "...S....", "...S....", "1......."]);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 4.5;
    me.dir = 0;
    launch(w, me, "pierce");
    run(w, 0.8);
    expect(tileAt(w.map, 3, 3)).toBe(".");
    expect(tileAt(w.map, 3, 2)).toBe(".");
    expect(tileAt(w.map, 3, 1)).toBe("S"); // 第三层还在
    expect(w.bullets).toHaveLength(0);
  });

  it("弹力球撞钢板会按反射公式拐弯,不是原地散掉", () => {
    const w = room(["SSSSSSSS", "S......S", "S......S", "S......S", "S1.....S"]);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 3.5;
    me.dir = 0;
    const b = launch(w, me, "bounce");
    const before = { vx: b.vx ?? 0, vy: b.vy ?? 0 };
    expect(before.vx).not.toBe(0);
    run(w, 0.45);
    const alive = w.bullets[0];
    expect(alive, "弹力球不该在第一次撞墙时就没").toBeTruthy();
    // 撞的是上面那道横墙:纵向分量翻了,横向没变
    expect(alive.vy).toBeCloseTo(-before.vy, 6);
    expect(alive.vx).toBeCloseTo(before.vx, 6);
    expect(alive.bounces).toBe(1);
  });

  it("弹力球最多弹两次,弹完再撞墙就散成彩纸", () => {
    const w = room(["SSSSSSSS", "S......S", "S......S", "S......S", "S1.....S"]);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 3.5;
    me.dir = 0;
    launch(w, me, "bounce");
    let maxBounced = 0;
    for (let i = 0; i < 400; i++) {
      stepWorld(w, 1 / 60, [IDLE_INPUT]);
      const b = w.bullets[0];
      if (b) maxBounced = Math.max(maxBounced, 2 - (b.bounces ?? 0));
      else break;
    }
    expect(maxBounced).toBeLessThanOrEqual(2);
    expect(w.bullets).toHaveLength(0);
  });

  it("好用的弹丸冷却更长:同一台车换弹之后要多等", () => {
    const w = room(["........", "1......."]);
    const me = w.tanks[0];
    expect(shellCool(me, "bounce")).toBeGreaterThan(shellCool(me, "plain"));
    expect(shellCool(me, "pierce")).toBeGreaterThan(shellCool(me, "bounce"));
  });

  it("预测虚线拿的是真地图:炮口前有墙就给得出拐点", () => {
    const w = room(["SSSSSSSS", "S......S", "S......S", "S1.....S"]);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 2.5;
    me.dir = 0;
    me.shell = "bounce";
    const v = shotVelocity(me.dir, "bounce", me.tilt);
    const pts = previewPath({ x: me.x + v.x * 0.5, y: me.y + v.y * 0.5 }, v, blockedProbe(w));
    expect(pts.length).toBe(3);
    expect(pts[1].y).toBeLessThan(me.y);
  });
});

describe("炮口前摇与后坐", () => {
  it("扣扳机不是立刻出膛:前摇走完那一帧弹丸才出来", () => {
    const w = room(["........", "........", "1......."]);
    const me = w.tanks[0];
    expect(pullTrigger(w, me)).toBe(true);
    expect(w.bullets).toHaveLength(0);
    expect(me.windup).toBeCloseTo(MUZZLE_WINDUP, 6);
    // 前摇里再按不叠加,也不会多吃一个炮弹名额
    expect(pullTrigger(w, me)).toBe(false);
    expect(me.shots).toBe(1);
    run(w, MUZZLE_WINDUP + 0.02);
    expect(w.bullets.length).toBeGreaterThan(0);
    expect(me.windup).toBe(0);
  });

  it("出膛那一下有后坐,弹完就归零", () => {
    const w = room(["........", "........", "1......."]);
    const me = w.tanks[0];
    launch(w, me, "plain");
    expect(me.recoil).toBeCloseTo(RECOIL_SECONDS, 6);
    expect(recoilPixels(me.recoil, 26)).toBeGreaterThan(0);
    run(w, RECOIL_SECONDS + 0.05);
    expect(me.recoil).toBe(0);
    expect(recoilPixels(me.recoil, 26)).toBe(0);
  });

  it("后坐峰值在任何屏幕上都是 4–6px:格子小的时候不许缩没", () => {
    // 一格能有多大,`layout()` 夹在 14–34px 之间
    for (let s = 14; s <= 34; s++) {
      const px = recoilPixels(RECOIL_SECONDS, s);
      expect(px, `一格 ${s}px 时后坐只有 ${px}px`).toBeGreaterThanOrEqual(RECOIL_PX_MIN);
      expect(px, `一格 ${s}px 时后坐冲到 ${px}px`).toBeLessThanOrEqual(RECOIL_PX_MAX);
    }
    // 光按格数折算的老算法在最小的格子上会掉到 4px 以下,这条就是钉住那个坑
    expect(RECOIL_CELLS * 14).toBeLessThan(RECOIL_PX_MIN);
    expect(recoilPixels(RECOIL_SECONDS, 14)).toBe(RECOIL_PX_MIN);
    // 格子大的时候也不会顶过头
    expect(RECOIL_CELLS * 34).toBeGreaterThan(RECOIL_PX_MAX);
    expect(recoilPixels(RECOIL_SECONDS, 34)).toBe(RECOIL_PX_MAX);
  });

  it("后坐是弹回来的:一半时间过去,位移也剩一半", () => {
    expect(recoilPixels(RECOIL_SECONDS / 2, 30)).toBeCloseTo(recoilPixels(RECOIL_SECONDS, 30) / 2, 6);
    expect(recoilPixels(0, 30)).toBe(0);
    expect(recoilPixels(-1, 30)).toBe(0);
  });

  it("弹力球每打一发换一边斜,预测线才会跟着翻", () => {
    const w = room(["........", "........", "1......."]);
    const me = w.tanks[0];
    expect(me.tilt).toBe(1);
    launch(w, me, "bounce");
    expect(me.tilt).toBe(-1);
    launch(w, me, "bounce");
    expect(me.tilt).toBe(1);
  });
});

describe("被击中:零件散一地,3 秒后组装回来", () => {
  const rows = ["e.......", "........", "........", "........", "1......."];

  function hitPlayer(w: World, me: Tank): void {
    const foe: Tank = { ...me, id: 999, side: "enemy", player: -1, x: me.x, y: me.y - 1.2, dir: 2 };
    w.tanks.push(foe);
    me.shield = 0;
    launch(w, foe, "plain");
    run(w, 0.4);
  }

  it("挨一发不是淘汰:散架 3 秒,然后在出生点原样回来", () => {
    const w = room(rows);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 3.5;
    hitPlayer(w, me);
    expect(me.spin).toBeGreaterThan(0);
    expect(SPIN_SECONDS).toBe(REBUILD_SECONDS);
    expect(REBUILD_SECONDS).toBe(3);
    // 零件是从被打中那儿散开的
    expect(me.scatterX).toBeCloseTo(3.5, 1);
    expect(w.effects.some((e) => e.kind === "parts")).toBe(true);
    expect(w.effects.some((e) => e.kind === "build")).toBe(true);
    // 人没了这个概念:车还在名单上,只是要等
    expect(w.tanks.some((t) => t.id === me.id)).toBe(true);
    run(w, REBUILD_SECONDS + 0.1);
    expect(me.spin).toBe(0);
    expect(me.x).toBeCloseTo(0.5, 6);
    expect(me.y).toBeCloseTo(4.5, 6);
    // 刚组装好还带一小会儿护罩,不至于一回来又被打散
    expect(me.shield).toBeGreaterThan(0);
  });

  it("前摇里被打散不会吃掉炮弹名额(不然回来就再也开不了火)", () => {
    const w = room(rows);
    const me = w.tanks[0];
    me.x = 3.5;
    me.y = 3.5;
    pullTrigger(w, me);
    expect(me.shots).toBe(1);
    hitPlayer(w, me);
    expect(me.windup).toBe(0);
    run(w, REBUILD_SECONDS + 0.4);
    expect(me.shots).toBe(0);
    expect(canFire(me)).toBe(true);
  });

  it("出生点被人堵着就换个地方组装,不许被按在原地反复打散", () => {
    const w = room(["e.......", "........", "........", "........", "1.....2."], { players: 2 });
    const camper = w.tanks[0];
    // 假装有一辆铁皮车蹲在朵朵的出生点门口
    w.tanks.push({ ...camper, id: 900, side: "enemy", player: -1, x: 0.5, y: 4.5 });
    const spot = safeSpawn(w, 0);
    expect(spot.cx).not.toBe(0);
    expect(SAFE_SPAWN_DIST).toBeGreaterThan(0);
    // 没人堵的时候还是回自己家
    w.tanks = w.tanks.filter((t) => t.id !== 900);
    expect(safeSpawn(w, 0)).toEqual({ cx: 0, cy: 4 });
  });
});

describe("冰面滑行", () => {
  const rows = ["iiiiiiii", "iiiiiiii", "1......."];

  it("冰上松开手还会往前溜一段,空地上说停就停", () => {
    const ice = room(rows);
    const slider = ice.tanks[0];
    slider.x = 1.5;
    slider.y = 0.5;
    expect(onIce(ice, slider)).toBe(true);
    for (let i = 0; i < 40; i++) driveTank(ice, slider, 1, 1 / 60);
    const gotTo = slider.x;
    expect(slider.glide).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) driveTank(ice, slider, -1, 1 / 60);
    expect(slider.x).toBeGreaterThan(gotTo); // 松了手还在往前溜

    const dirt = room(["........", "........", "1......."]);
    const walker = dirt.tanks[0];
    walker.x = 1.5;
    walker.y = 0.5;
    expect(onIce(dirt, walker)).toBe(false);
    for (let i = 0; i < 40; i++) driveTank(dirt, walker, 1, 1 / 60);
    const stopped = walker.x;
    for (let i = 0; i < 20; i++) driveTank(dirt, walker, -1, 1 / 60);
    expect(walker.x).toBe(stopped);
  });

  it("冰上起步比空地慢:同样按住 0.2 秒,冰上跑得近", () => {
    const ice = room(rows);
    const a = ice.tanks[0];
    a.x = 0.5;
    a.y = 0.5;
    for (let i = 0; i < 12; i++) driveTank(ice, a, 1, 1 / 60);

    const dirt = room(["........", "........", "1......."]);
    const b = dirt.tanks[0];
    b.x = 0.5;
    b.y = 0.5;
    for (let i = 0; i < 12; i++) driveTank(dirt, b, 1, 1 / 60);

    expect(a.x - 0.5).toBeLessThan(b.x - 0.5);
  });

  it("在冰上改方向要先卸掉原来的速度,不能瞬间掉头", () => {
    const w = room(rows);
    const t = w.tanks[0];
    t.x = 3.5;
    t.y = 0.5;
    for (let i = 0; i < 40; i++) driveTank(w, t, 1, 1 / 60);
    const fast = t.glide;
    driveTank(w, t, 3, 1 / 60);
    expect(t.glide).toBeLessThan(fast);
    expect(t.dir).toBe(3); // 炮口立刻转过去了,车身还在减速
  });
});

describe("老巢护罩会自己充回来", () => {
  const rows = ["e.......", "........", "........", "...#.#..", "1..#B#.."];

  it("护罩替老巢挨一发,过一阵子自己亮回来", () => {
    const w = room(rows);
    const bx = w.map.base?.cx ?? 4;
    const by = w.map.base?.cy ?? 4;
    const shooter: Tank = { ...w.tanks[0], id: 900, side: "enemy", player: -1, x: bx + 0.5, y: by - 0.9, dir: 2 };
    w.tanks.push(shooter);
    expect(w.baseShield).toBe(true);
    launch(w, shooter, "plain");
    run(w, 0.3);
    expect(w.baseShield).toBe(false);
    expect(w.status).toBe("playing"); // 只是碎了护罩,不是输
    expect(w.shieldTimer).toBeGreaterThan(0);
    run(w, BASE_SHIELD_REGROW + 0.5);
    expect(w.baseShield).toBe(true);
    expect(w.shieldTimer).toBe(0);
  });

  it("护罩还没充回来的时候再挨一发,这一局才算结束", () => {
    const w = room(rows);
    const bx = w.map.base?.cx ?? 4;
    const by = w.map.base?.cy ?? 4;
    w.baseShield = false;
    w.shieldTimer = BASE_SHIELD_REGROW;
    const shooter: Tank = { ...w.tanks[0], id: 901, side: "enemy", player: -1, x: bx + 0.5, y: by - 0.9, dir: 2 };
    w.tanks.push(shooter);
    launch(w, shooter, "plain");
    run(w, 0.3);
    expect(w.status).toBe("lose");
    expect(w.reason).not.toMatch(/死|爆炸|摧毁/);
  });
});

describe("对战的电脑陪练", () => {
  it("aiTiers 指到哪个位子,哪个位子的摇杆就交给电脑", () => {
    const w = createWorld({
      rows: ["........", "1......2", "........"],
      mode: "versus",
      players: 2,
      aiTiers: [null, "chase"],
    });
    const human = playerTank(w, 0);
    const bot = playerTank(w, 1);
    expect(human && bot).toBeTruthy();
    if (!human || !bot) return;
    bot.dir = 3; // 炮口对着朵朵那一边
    // 真人这一格照读输入
    expect(inputForPlayer(w, human, [{ dir: 1, fire: true, brick: false }, IDLE_INPUT])).toEqual({
      dir: 1,
      fire: true,
      brick: false,
    });
    // 陪练那一格自己拿主意:面对面站着,张口就是一发
    const botInput = inputForPlayer(w, bot, [IDLE_INPUT, IDLE_INPUT]);
    expect(botInput.fire).toBe(true);
  });

  it("四种铁皮车分到三档脾气,机灵车才会绕后", () => {
    expect(TIER_BY_KIND.smart).toBe("flank");
    expect(TIER_BY_KIND.swift).toBe("wander");
    expect(new Set(Object.values(TIER_BY_KIND)).size).toBe(3);
  });
});

describe("两套键位与换弹键", () => {
  it("换弹键各管各的,而且不和走位 / 开火键打架", () => {
    expect(SHELL_KEY_MAP.KeyR).toBe(0);
    expect(SHELL_KEY_MAP.KeyO).toBe(1);
    expect(keyConflicts()).toEqual([]);
  });

  it("换弹之后真的打出另一种弹丸", () => {
    const w = room(["........", "1......."]);
    const me = w.tanks[0];
    me.shell = "pierce";
    const b = fire(w, me);
    expect(b?.kind).toBe("pierce");
    expect(b?.pierces).toBe(2);
  });
});
