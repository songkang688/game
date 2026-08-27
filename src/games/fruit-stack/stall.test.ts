/**
 * 果果合成 · 「果盆再也停不下来」的回归网（`R3-PA-FS-1` / `R3-PA-FS-2`）。
 *
 * 第 3 轮走查记的是同一个根因：密堆里的果子会进入一个极限环 —— 重力把它压进接触、
 * 弹性再把它顶开一点点，速度长期卡在 `SETTLE_SPEED` 上方来回跑，`allSettled()` 永远回不了真。
 * 而这一款的两条判负通路（越线、果子用完）与电脑座位的出手时机全都挂在它上面：
 *
 *  - `index.ts` 的 `overLine(world)` 只看「已静止」的果子；
 *  - `index.ts` 的「果子用完 + `allSettled`」判负；
 *  - `stepAi()` 的 `if (!allSettled(world) || aiWait > 0) return;`。
 *
 * 于是第 188 关随机落点 20 盆全中「赢得了、再也输不了」，人机对战里电脑投到第 29 颗就永久停手。
 *
 * 修法是给 `stepPhysics` 加一道看门狗：整盆连续 `STALL_MS` 没停稳先开闸放能，
 * 撑满 `FREEZE_MS` 直接按停稳处理。看门狗只在解算自己打转时才醒，正常一盆碰不到，
 * 所以 188 关的难度标定一个数都没动（`smoke.test.ts` 那三道难度闸原样全绿）。
 */
import { describe, expect, it } from "vitest";
import { buildLevel } from "./levels";
import { dropFruit, nextFruit } from "./merge";
import {
  FREEZE_MS,
  STALL_MS,
  allSettled,
  createWorld,
  forceSettle,
  overLine,
  speedOf,
  stepPhysics,
  type World,
} from "./physics";

const FRAME_MS = 16;

function worldFor(index: number): World {
  const lv = buildLevel(index);
  return createWorld({ box: lv.box, lineY: lv.lineY, seed: lv.seed, tuning: lv.tuning, pullMs: 0, popMs: 0 });
}

/** 推帧到整盆停稳，回报用了多少毫秒；超过 limitMs 还没停就回报 null */
function runUntilSettled(world: World, limitMs = 20000): number | null {
  let ms = 0;
  while (ms < limitMs) {
    stepPhysics(world, FRAME_MS);
    ms += FRAME_MS;
    if (allSettled(world)) return ms;
  }
  return null;
}

describe("R3-PA-FS-1 · 每一盆都停得下来", () => {
  it("第 188 关随机落点连投 20 盆，盆盆都能在看门狗之内停稳", () => {
    const lv = buildLevel(187);
    const stuck: string[] = [];
    for (let bowl = 0; bowl < 20; bowl++) {
      const world = worldFor(187);
      let seed = 9000 + bowl * 37;
      let hung = false;
      for (let i = 0; i < lv.drops; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        const x = (seed / 4294967296) * lv.box.w;
        dropFruit(world, nextFruit(lv.seed, i, lv.maxDrop, lv.minDrop), x);
        if (runUntilSettled(world) === null) {
          stuck.push(`第 ${bowl + 1} 盆投到第 ${i + 1} 颗`);
          hung = true;
          break;
        }
      }
      expect(hung, `第 ${bowl + 1} 盆吊住了`).toBe(false);
    }
    expect(stuck).toEqual([]);
  });

  it("越线判定跟着回来了：堆满之后能真判输，不会一直吊着", () => {
    const lv = buildLevel(187);
    const world = worldFor(187);
    let over = false;
    for (let i = 0; i < lv.drops && !over; i++) {
      // 一颗压一颗地全投在正中央，最容易堆过警戒线
      dropFruit(world, nextFruit(lv.seed, i, lv.maxDrop, lv.minDrop), lv.box.w / 2);
      expect(runUntilSettled(world), `投到第 ${i + 1} 颗就停不下来了`).not.toBeNull();
      if (overLine(world)) over = true;
    }
    // 要么堆到越线判输，要么果子投完时整盆是停稳的 —— 两条路都通向结算
    expect(over || allSettled(world)).toBe(true);
  });
});

describe("看门狗本身的边界", () => {
  it("正常一盆根本唤不醒它：停稳时 stallMs 一直归零", () => {
    const lv = buildLevel(0);
    const world = worldFor(0);
    dropFruit(world, 0, lv.box.w / 2);
    runUntilSettled(world);
    expect(world.stallMs).toBe(0);
  });

  it("一直不停的世界会先被放能、再被按停，绝不超过 FREEZE_MS", () => {
    const world = worldFor(187);
    // 人为造一盆停不下来的：每一帧都把速度重新灌回去
    for (let i = 0; i < 6; i++) dropFruit(world, 2, 40 + i * 40);
    let ms = 0;
    let sawStall = false;
    while (ms < FREEZE_MS + 400 && !allSettled(world)) {
      for (const f of world.fruits) f.vy = Math.max(f.vy, 200);
      stepPhysics(world, FRAME_MS);
      ms += FRAME_MS;
      if (world.stallMs >= STALL_MS) sawStall = true;
    }
    expect(sawStall, "看门狗没有进入放能段").toBe(true);
    expect(ms, "撑过了 FREEZE_MS 还没按停").toBeLessThanOrEqual(FREEZE_MS + 400);
  });

  it("`forceSettle` 把速度清零、宽限期清掉，越线判定立刻算得出来", () => {
    const world = worldFor(187);
    dropFruit(world, 3, 100);
    stepPhysics(world, FRAME_MS);
    expect(allSettled(world)).toBe(false);
    forceSettle(world);
    expect(allSettled(world)).toBe(true);
    expect(world.stallMs).toBe(0);
    for (const f of world.fruits) {
      expect(speedOf(f)).toBe(0);
      expect(f.graceMs).toBe(0);
    }
  });

  it("放能只减不增：看门狗醒着的时候总动能不会变大", () => {
    const world = worldFor(187);
    for (let i = 0; i < 5; i++) dropFruit(world, 2, 50 + i * 50);
    world.stallMs = STALL_MS;
    let prev = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 40; i++) {
      // 关掉重力，只看解算本身会不会灌能量进来
      world.tuning.gravity = 0;
      world.stallMs = STALL_MS;
      stepPhysics(world, FRAME_MS);
      let e = 0;
      for (const f of world.fruits) e += 0.5 * f.mass * (f.vx * f.vx + f.vy * f.vy);
      expect(e).toBeLessThanOrEqual(prev + 1e-6);
      prev = e;
    }
  });
});
