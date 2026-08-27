/**
 * 果果合成 · 「这一局收不了场」的**整局**回归网（`R3-PA-FS-1` / `R3-PA-FS-2`）。
 *
 * 同目录的 `stall.test.ts` 盯的是物理那一层：`stepPhysics` 的看门狗会不会醒、
 * 醒了会不会放能、撑满 `FREEZE_MS` 会不会强制停稳。那一层是根因，但**不是孩子看到的东西**。
 *
 * 孩子看到的是「这一局到底收不收得了场」，而从根因走到收场要穿过三段 index.ts 的接线：
 *
 *  - `update()` 里 `overLine(world)` 判越线 —— 只看「已静止」的果子；
 *  - `update()` 里「果子用完 + `allSettled`」判收摊；
 *  - `stepAi()` 里 `if (!allSettled(world) || aiWait > 0) return;` —— 电脑等自己那盆停稳才想下一手。
 *
 * 第三段一直没有网。第 2 名测试员记的 `R3-PA-FS-2` 就落在这里：电脑那盆一进死状态，
 * `aiTarget` 永远是 `null`，电脑再也不出手；对战的 `drops` 是 9999，也不存在「果子用完」，
 * 于是人一次都不碰键的话，这一局怎么等都不会结束。哪天有人把看门狗调松、或者把
 * `stepAi` 的等待条件改回去，物理那一层的网未必红，这一张会红。
 *
 * 所以这张网**从界面上驱动**：点进模式、按键投果、一帧一帧推，只认「结算浮层出没出来」。
 * 拿掉 `stepPhysics` 的看门狗，下面每一条都会红。
 *
 * 顶部先静态 import 一次 index，让 level99 / audio 那条链在真 node 下加载完，
 * 之后再装 DOM 桩，免得撞上桩里没有的 `document.addEventListener`。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { mount } from "./index";
import { El, flushFrames, installDom, restoreDom, type Dom } from "./domStub";
import { buildLevel } from "./levels";
import { dropFruit, nextFruit } from "./merge";
import { allSettled, createWorld, overLine, stepPhysics } from "./physics";

const FRAME_MS = 16;

let dom: Dom;

function fakeApi(root: El): GameApi {
  return {
    root: root as unknown as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  } as unknown as GameApi;
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

/** 按一下键（keydown + keyup 都发，和真键盘一样） */
function key(code: string): void {
  for (const type of ["keydown", "keyup"]) {
    for (const f of Array.from(dom.winListeners.get(type) ?? [])) {
      f({ code, preventDefault: () => undefined });
    }
  }
}

beforeEach(() => {
  dom = installDom(420);
});

afterEach(() => {
  restoreDom();
});

describe("R3-PA-FS-1 · 界面上真按，收得了场", () => {
  it("无尽果盆一路按 F 投下去，一定会走到「盆装满啦」", () => {
    const handle = mount(fakeApi(dom.root));
    byText("无尽果盆")!.dispatch("click");
    let frames = 0;
    let over = false;
    while (frames < 8000 && !over) {
      key("KeyF");
      flushFrames(dom, 1, FRAME_MS);
      frames++;
      over = dom.root.textContent.includes("盆装满啦");
    }
    expect(over, `投了 ${frames} 帧也没出结算浮层，这一盆吊住了`).toBe(true);
    handle.destroy();
  });
});

describe("R3-PA-FS-2 · 人一次都不碰键，电脑也不会永久停手", () => {
  it("人机对战里电脑自己把一局打完", () => {
    const handle = mount(fakeApi(dom.root));
    byText("人机对战")!.dispatch("click");
    let frames = 0;
    let ended = false;
    while (frames < 40000 && !ended) {
      flushFrames(dom, 1, FRAME_MS);
      frames++;
      const t = dom.root.textContent;
      ended = t.includes("赢下第") || t.includes("这一局打平") || t.includes("拿下整场");
    }
    expect(ended, `空转 ${frames} 帧这一局还没结束，电脑停手了`).toBe(true);
    handle.destroy();
  });
});

describe("R3-PA-FS-1 · 随机落点，盆盆都停得下来", () => {
  // stall.test.ts 只跑了第 188 关；这里把第 1 关与中段的第 132 关也带上，
  // 三种盆宽 / 弹性 / 果子档都过一遍
  for (const index of [0, 131]) {
    it(`第 ${index + 1} 关随机落点连投 20 盆，一盆都不吊住`, () => {
      const lv = buildLevel(index);
      const stuck: string[] = [];
      for (let bowl = 0; bowl < 20; bowl++) {
        const world = createWorld({
          box: lv.box,
          lineY: lv.lineY,
          seed: lv.seed,
          tuning: lv.tuning,
          pullMs: 0,
          popMs: 0,
        });
        let seed = 7000 + bowl * 101 + index;
        for (let i = 0; i < lv.drops; i++) {
          seed = (seed * 1103515245 + 12345) >>> 0;
          dropFruit(world, nextFruit(lv.seed, i, lv.maxDrop, lv.minDrop), (seed / 4294967296) * lv.box.w);
          let ms = 0;
          while (ms < 8000 && !allSettled(world)) {
            stepPhysics(world, FRAME_MS);
            ms += FRAME_MS;
          }
          if (!allSettled(world)) {
            stuck.push(`第 ${bowl + 1} 盆投到第 ${i + 1} 颗`);
            break;
          }
          if (overLine(world)) break;
        }
      }
      expect(stuck).toEqual([]);
    });
  }
});
