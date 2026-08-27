/**
 * 康康射击场 · 「玩家一发都不打」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 *
 * 跑的是真机那条路:`mount()` + `openCampaignLevel(n)`,靶子照常飘、照常巡逻,
 * 手指一次都不落在画布上。判定链走的是 `createField()` 里那一套——
 * `finish("cleared")` 只在**打中一发之后**才有机会触发,所以这里守的是:
 * 摆烂只会走到「时间到」判负,或者压根不结算(不限时的关),永远走不到「过关」。
 *
 * 脚手架与 `platform12.test.ts` 同款(同一份 `domStub`、同一套 `boot()`),
 * 不另造第二套模拟。
 */
import { afterEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { findAll, findOne, install, type Harness } from "./domStub";
import { mount } from "./index";
import { buildLevel } from "./levels";

interface Booted {
  h: Harness;
  handle: { openCampaignLevel: (n: number) => number; destroy: () => void };
  stars: number[];
}

let live: Booted | null = null;

afterEach(() => {
  try {
    live?.handle.destroy();
  } catch {
    // 用例自己已经 destroy 过就算了
  }
  live?.h.restore();
  live = null;
});

function boot(): Booted {
  const h = install();
  const stars: number[] = [];
  const api = {
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: (n: number) => {
      stars.push(n);
      return n;
    },
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
  } as unknown as GameApi;
  const handle = mount(api) as unknown as Booted["handle"];
  live = { h, handle, stars };
  return live;
}

function veilTitle(h: Harness): string {
  return findOne(h.root, "shr-veil-title")?.textContent ?? "";
}

function veilSub(h: Harness): string {
  return findOne(h.root, "shr-veil-sub")?.textContent ?? "";
}

/** HUD 上「🎯 剩 N 个」的那个数 */
function left(h: Harness): number {
  const chip = findAll(h.root, "shr-chip").map((c) => c.textContent).find((t) => t.includes("🎯 剩")) ?? "";
  return Number(/剩 (\d+) 个/.exec(chip)?.[1] ?? -1);
}

/**
 * 直达第 n 关(1 基)之后一发都不打,只把帧放过去。
 * 一帧按 50ms 走,1000 帧 = 50 秒 —— 比战役里最长的限时(40 秒)还宽裕。
 */
function idleLevel(b: Booted, n: number, frames = 1000): string {
  b.handle.openCampaignLevel(n);
  b.h.flush(1);
  for (let f = 0; f < frames; f++) {
    b.h.flush(1, 50);
    const title = veilTitle(b.h);
    if (title) return title;
  }
  return "";
}

describe("康康射击场 · 摆烂:一发都不打", () => {
  it("第 1 关零输入:50 秒过去,靶子一个没少,也没有任何结算", () => {
    const b = boot();
    // 第 1 关不限时(限时是第八章以后才有的),摆烂就是干等,永远走不到结算
    expect(buildLevel(0).seconds).toBe(0);
    expect(idleLevel(b, 1), "第 1 关摆烂居然结算了").toBe("");
    expect(left(b.h), "一发没打,必打靶却少了").toBe(buildLevel(0).need);
    expect(b.stars, "一发没打却发了星星").toEqual([]);
  });

  it("第 188 关零输入:限时的关摆烂只会走到「就差一点点」,靶子还全在", () => {
    const b = boot();
    const def = buildLevel(187);
    expect(def.seconds).toBeGreaterThan(0);
    const title = idleLevel(b, 188);
    expect(title, "第 188 关摆烂居然结算成过关了").not.toContain("过关");
    expect(title).toContain("就差一点点");
    expect(veilSub(b.h)).toContain("时间到");
    // 一发没打,场上必然还留着靶(分裂靶按一个算,所以只比 need 少不比 need 多)
    expect(veilSub(b.h)).toMatch(/还剩 [1-9]\d* 个靶/);
    expect(def.need).toBeGreaterThan(0);
    expect(b.stars).toEqual([]);
  });

  it("全 188 关零输入:一关都打不出「过关」", () => {
    const b = boot();
    const passed: number[] = [];
    for (let n = 1; n <= 188; n++) {
      if (idleLevel(b, n).includes("过关")) passed.push(n);
    }
    expect(passed, `摆烂过关的:第 ${passed.join(" / ")} 关`).toEqual([]);
    expect(b.stars, "整轮摆烂扫下来居然发出过星星").toEqual([]);
  }, 60000);

  it("限时的关摆烂一律判负,不限时的关摆烂就一直不结算 —— 两条路都不通向过关", () => {
    const b = boot();
    let timed = 0;
    let untimed = 0;
    // 每一章挑一关,九章全覆盖
    for (const n of [1, 21, 41, 61, 81, 100, 120, 140, 160, 188]) {
      const title = idleLevel(b, n);
      if (buildLevel(n - 1).seconds > 0) {
        expect(title, `第 ${n} 关限时 ${buildLevel(n - 1).seconds} 秒,摆烂却没判负`).toContain("就差一点点");
        timed++;
      } else {
        expect(title, `第 ${n} 关不限时,摆烂却结算了`).toBe("");
        untimed++;
      }
    }
    expect(timed).toBeGreaterThan(0);
    expect(untimed).toBeGreaterThan(0);
  }, 30000);
});
