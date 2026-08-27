/**
 * 星星射击场 1.2 · 运行时与平台接线的用例。
 *
 * 这一份跑的是真的 `mount()`：用 `domStub` 搭一块 360px 宽的手机屏，
 * 把手指、键盘、rAF 全喂进去，验的是「按下去到底发生了什么」——
 * 按下预览抬起发射、出手前摇、命中顿感、两套准星、打不完的靶场、直达第 N 关、destroy 清干净。
 *
 * 场地是 1000×620 的逻辑坐标，画布是 360×223，所以缩放 0.36：
 * 用例里一律用 `at()` 把「场地上的某个点」折算成手指的 client 坐标，不写死像素。
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { save } from "../../engine/save";
import type { GameApi } from "../level99";
import {
  allText,
  findAll,
  findButton,
  findOne,
  install,
  type FakeEl,
  type Harness,
} from "./domStub";
import { CSS, TOUCH_LIFT_PX, aimFromPointer, feelNote, levelFromQuery, mount, targetLegend } from "./index";
import { FIELD_H, FIELD_W, AIM_BOUNDS } from "./logic";
import { buildLevel } from "./levels";
import { ARENA_SECONDS, COOP_SECONDS, DUO_NAME } from "./duo12";
import { ENDLESS_MISS_LIMIT } from "./endless12";
import { meta } from "./meta";

// ---------------------------------------------------------------------------
// 脚手架
// ---------------------------------------------------------------------------

interface Booted {
  h: Harness;
  handle: { openCampaignLevel: (n: number) => number; destroy: () => void };
  sounds: string[];
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

function boot(opts: { search?: string; initialLevel?: number } = {}): Booted {
  const h = install({ search: opts.search });
  const sounds: string[] = [];
  const stars: number[] = [];
  const api = {
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void sounds.push(n),
    addStars: (n: number) => {
      stars.push(n);
      return n;
    },
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    ...(opts.initialLevel === undefined ? {} : { initialLevel: opts.initialLevel }),
  } as unknown as GameApi;
  const handle = mount(api);
  live = { h, handle, sounds, stars };
  return live;
}

function canvas(h: Harness): FakeEl {
  const cv = findOne(h.root, "shr-cv");
  if (!cv) throw new Error("画布还没挂上来");
  return cv;
}

/** 场地坐标 → 手指 / 鼠标的 client 坐标（触屏时把「准星抬高」那一段折回去） */
function at(cv: FakeEl, fx: number, fy: number, touch = true): Record<string, unknown> {
  const rect = cv.getBoundingClientRect();
  const scale = cv.width / FIELD_W;
  const offY = (cv.height - FIELD_H * scale) / 2;
  const lift = touch ? TOUCH_LIFT_PX / scale : 0;
  return {
    pointerId: 1,
    pointerType: touch ? "touch" : "mouse",
    clientX: rect.left + ((fx * scale) / cv.width) * rect.width,
    clientY: rect.top + (((fy + lift) * scale + offY) / cv.height) * rect.height,
  };
}

/** HUD 上带这几个字的那一枚 chip */
function chip(h: Harness, needle: string): string {
  return findAll(h.root, "shr-chip").map((c) => c.textContent).find((t) => t.includes(needle)) ?? "";
}

/** 还剩几个必打靶 */
function left(h: Harness): number {
  return Number(/剩 (\d+) 个/.exec(chip(h, "🎯 剩"))?.[1] ?? -1);
}

/** 星星弹还剩几发 */
function ammo(h: Harness): number {
  return Number(/还剩 (\d+) 发/.exec(chip(h, "🌠"))?.[1] ?? -1);
}

function score(h: Harness): number {
  return Number(/🌟 (-?\d+) 分/.exec(chip(h, "🌟"))?.[1] ?? NaN);
}

function veilTitle(h: Harness): string {
  return findOne(h.root, "shr-veil-title")?.textContent ?? "";
}

function veilSub(h: Harness): string {
  return findOne(h.root, "shr-veil-sub")?.textContent ?? "";
}

/** 一直走帧,直到条件成立(或者到顶) */
function until(h: Harness, ok: () => boolean, maxFrames = 400, ms = 16): number {
  for (let i = 1; i <= maxFrames; i++) {
    h.flush(1, ms);
    if (ok()) return i;
  }
  return -1;
}

/** 对着场地上的一点按下再抬手(默认的「按下预览 + 抬起发射」) */
function tap(cv: FakeEl, fx: number, fy: number, touch = true, pointerId = 1): void {
  const p = { ...at(cv, fx, fy, touch), pointerId };
  cv.fire("pointerdown", p);
  cv.fire("pointerup", p);
}

/**
 * 稳稳打一发:瞄准、抬手、然后等够 40 帧。
 * 40 帧(0.64 秒)比「前摇 + 冷却 + 散布收干净」还长一点,
 * 所以每一发都是散布 0 的状态出手——用例才不用跟随机数赌。
 */
function aimAndFire(h: Harness, cv: FakeEl, fx: number, fy: number, frames = 40): void {
  tap(cv, fx, fy);
  h.flush(frames);
}

/** 进某个模式:0 = 无尽,1 = 比一比,2 = 一起打 */
function openMode(h: Harness, index: number): void {
  findAll(h.root, "shr-mode")[index].fire("click");
}

function back(h: Harness): void {
  findButton(h.root, "← 返回")?.fire("click");
}

// ---------------------------------------------------------------------------
// 接线
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 平台接线", () => {
  it("挂载之后 188 关地图和三个模式入口都在,四种模式一个都不缺", () => {
    const { h } = boot();
    const modes = findAll(h.root, "shr-mode");
    expect(modes).toHaveLength(3);
    expect(modes.map((m) => m.textContent).join(" ")).toContain("打不完的靶场");
    expect(modes.map((m) => m.textContent).join(" ")).toContain("比一比");
    expect(modes.map((m) => m.textContent).join(" ")).toContain("一起打");
    // 闯关是第四种:地图和「开始冒险」都在
    expect(allText(h.root)).toContain("开始冒险");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
  });

  it("三个模式各进一次都进得去,标题各不相同——versus 和 twoPlayer 不再是同一个东西", () => {
    const { h } = boot();
    const titles: string[] = [];
    for (const i of [0, 1, 2]) {
      openMode(h, i);
      titles.push(findOne(h.root, "shr-title")?.textContent ?? "");
      back(h);
    }
    expect(titles[0]).toContain("打不完的靶场");
    expect(titles[1]).toContain("比一比");
    expect(titles[2]).toContain("一起打");
    expect(new Set(titles).size).toBe(3);
    // 一起打有目标分,比一比没有;两局的时长也不一样
    openMode(h, 2);
    expect(allText(h.root)).toContain(`${COOP_SECONDS} 秒内一起够到`);
    expect(chip(h, "🎯 目标")).toMatch(/🎯 目标 \d+ 分/);
    back(h);
    openMode(h, 1);
    expect(allText(h.root)).toContain(`${ARENA_SECONDS} 秒比分数`);
  });

  it("openCampaignLevel(n) 直达第 N 关,越界会夹回 1..188", () => {
    const { h, handle } = boot();
    expect(handle.openCampaignLevel(42)).toBe(42);
    expect(findOne(h.root, "shr-title")?.textContent).toContain("第 42 关");
    expect(handle.openCampaignLevel(0)).toBe(1);
    expect(findOne(h.root, "shr-title")?.textContent).toContain("第 1 关");
    expect(handle.openCampaignLevel(9999)).toBe(188);
    expect(findOne(h.root, "shr-title")?.textContent).toContain("第 188 关");
    // 直达关照样是一整套靶场:画布、HUD、触屏键都在
    expect(findOne(h.root, "shr-cv")).not.toBeNull();
    expect(findAll(h.root, "shr-key").length).toBeGreaterThan(0);
  });

  it("壳层给了 initialLevel 就直接开在那一关,不用先点地图", () => {
    const { h } = boot({ initialLevel: 60 });
    expect(findOne(h.root, "shr-title")?.textContent).toContain("第 60 关");
  });

  it("壳层没给就退回地址栏的 ?level=,读不出数字就老老实实留在地图上", () => {
    expect(levelFromQuery("?level=7")).toBe(7);
    expect(levelFromQuery("?level=7.4&x=1")).toBe(7);
    expect(levelFromQuery("?level=abc")).toBeNull();
    expect(levelFromQuery("?level=0")).toBeNull();
    expect(levelFromQuery("")).toBeNull();
    expect(levelFromQuery(null)).toBeNull();

    const { h } = boot({ search: "?level=33" });
    expect(findOne(h.root, "shr-title")?.textContent).toContain("第 33 关");
  });

  it("destroy 把 rAF、window 监听、朗读和整棵节点树都清干净,再调一次也不炸", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(3);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(0);

    handle.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    expect(h.root.children).toHaveLength(0);
    // 清完之后再走几帧不会有任何东西复活
    h.flush(5);
    expect(h.pendingFrames()).toBe(0);
    expect(() => handle.destroy()).not.toThrow();
  });

  it("进了模式再 destroy,模式里那一层也一起收走", () => {
    const { h, handle } = boot();
    openMode(h, 0);
    h.flush(3);
    expect(findOne(h.root, "shr-cv")).not.toBeNull();
    handle.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    expect(h.root.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 手机上的瞄准
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 按下预览 + 抬起发射", () => {
  it("默认是按住只挪准星、抬手才发射——手指按下去的那一刻一发都没出去", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const cv = canvas(h);
    const t = buildLevel(0).targets[0];

    cv.fire("pointerdown", at(cv, t.x, t.y));
    h.flush(6);
    expect(ammo(h)).toBe(9);
    expect(left(h)).toBe(3);

    cv.fire("pointerup", at(cv, t.x, t.y));
    expect(ammo(h)).toBe(8);
  });

  it("准星画在手指上方 24 像素,手指自己不会压住要打的靶", () => {
    const scale = 0.36;
    const onFinger = aimFromPointer(500 * scale, 300 * scale, scale, 0, 0, false);
    const withTouch = aimFromPointer(500 * scale, 300 * scale, scale, 0, 0, true);
    expect(onFinger.x).toBeCloseTo(500, 5);
    expect(onFinger.y).toBeCloseTo(300, 5);
    // 抬起来的是逻辑单位,折算回屏幕正好是 24 个 CSS 像素
    expect(withTouch.x).toBeCloseTo(500, 5);
    expect((onFinger.y - withTouch.y) * scale).toBeCloseTo(TOUCH_LIFT_PX, 5);
    // 抬到顶也不会被抬出场地
    expect(aimFromPointer(0, 0, scale, 0, 0, true).y).toBe(AIM_BOUNDS.y0);
  });

  it("按一下开关就变成「按下就打」,按下的那一刻星星弹立刻出去", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const toggle = findOne(h.root, "shr-toggle");
    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
    toggle?.fire("click");
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    expect(toggle?.textContent).toContain("直发");
    expect(toggle?.getAttribute("aria-label")).toContain("按下就直接发射");

    const cv = canvas(h);
    const t = buildLevel(0).targets[0];
    cv.fire("pointerdown", at(cv, t.x, t.y));
    expect(ammo(h)).toBe(8);
  });

  it("抬手打中一个靶:剩余靶数少一个、分数涨上来、连击接上", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const cv = canvas(h);
    const t = buildLevel(0).targets[0];

    tap(cv, t.x, t.y);
    expect(until(h, () => left(h) === 2, 20)).toBeGreaterThan(0);
    expect(score(h)).toBeGreaterThan(0);
    expect(chip(h, "🔥")).toContain("1 连 ×1.1");
  });

  it("三发清完三个靶就过关,星级和分数都报给平台", () => {
    const { h, handle, stars } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const cv = canvas(h);
    const targets = buildLevel(0).targets;

    targets.forEach((t, i) => {
      aimAndFire(h, cv, t.x, t.y);
      // 最后一发打完这一局就收了,HUD 跟着一起撤,只剩结算面板
      if (i < targets.length - 1) expect(left(h)).toBe(targets.length - 1 - i);
    });
    expect(veilTitle(h)).toContain("第 1 关过关");
    expect(veilSub(h)).toContain("命中率");
    // 一发不浪费、一个不许打的靶都没碰,就是三星
    expect(stars.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 手感三件套接到运行时了没有
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 手感接到运行时", () => {
  it("出手有前摇:扳机扣下去的那一帧靶子还立着,几帧之后星星弹才真的到", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const cv = canvas(h);
    const t = buildLevel(0).targets[0];

    tap(cv, t.x, t.y);
    // 扳机已经扣下(弹药扣了一发),但这一帧靶子还没倒
    expect(ammo(h)).toBe(8);
    expect(left(h)).toBe(3);
    h.flush(1);
    expect(left(h)).toBe(3);

    const frames = until(h, () => left(h) === 2, 12);
    expect(frames).toBeGreaterThan(0);
    // 70ms 的前摇,16ms 一帧,再怎么算也不该超过 6 帧
    expect(frames).toBeLessThanOrEqual(6);
  });

  it("打中会顿一下:同样再补一发,先打中过的那次要多花几帧才打得出来", () => {
    function framesForSecondShot(firstHits: boolean): number {
      const { h, handle } = boot();
      handle.openCampaignLevel(1);
      h.flush(1);
      const cv = canvas(h);
      const [a, b] = buildLevel(0).targets;

      // 第一发:要么打中 a,要么故意打向没有靶的左下角。两边都只走 6 帧,
      // 起跑线一样齐,量出来的差值才干净
      tap(cv, firstHits ? a.x : AIM_BOUNDS.x0, firstHits ? a.y : AIM_BOUNDS.y1);
      h.flush(6);
      expect(left(h)).toBe(firstHits ? 2 : 3);
      const want = left(h) - 1;
      const n = until(h, () => {
        tap(cv, b.x, b.y);
        return left(h) === want;
      }, 60);
      live?.handle.destroy();
      live?.h.restore();
      live = null;
      return n;
    }

    const afterHit = framesForSecondShot(true);
    const afterMiss = framesForSecondShot(false);
    expect(afterHit).toBeGreaterThan(0);
    expect(afterMiss).toBeGreaterThan(0);
    // 顿感是 4–6 帧,顿的时候冷却和前摇都不走,所以整整多出来这么几帧
    expect(afterHit - afterMiss).toBeGreaterThanOrEqual(3);
    expect(afterHit - afterMiss).toBeLessThanOrEqual(8);
  });

  it("两发之间有冷却:连点点不出连发,一发的星星弹就是一发", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const cv = canvas(h);
    const t = buildLevel(0).targets[0];
    // 同一帧里连点十下,只该扣掉一发
    for (let i = 0; i < 10; i++) tap(cv, t.x, t.y);
    expect(ammo(h)).toBe(8);
  });

  it("星星弹打光了也只说「就差一点点」,一句批评都没有", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);
    const cv = canvas(h);
    // 对着没有靶的角落一发发打完预算(打空弹夹还要等装星星,所以每发多留几帧)
    expect(ammo(h)).toBe(9);
    for (let i = 0; i < 20 && veilTitle(h) === ""; i++) {
      aimAndFire(h, cv, AIM_BOUNDS.x0, AIM_BOUNDS.y1, 70);
    }
    expect(veilTitle(h)).toContain("差一点点");
    expect(veilSub(h)).toContain("星星弹用完");
    expect(veilSub(h)).not.toMatch(/失败|输了|笨|不行/);
  });
});

// ---------------------------------------------------------------------------
// 键盘
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 键盘与暂停", () => {
  it("F 发射、G 装星星、WASD 挪准星,Esc 收出暂停面板", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    h.flush(1);

    h.key("keydown", "KeyF");
    expect(ammo(h)).toBe(8);
    h.flush(8);

    h.key("keydown", "KeyG");
    expect(chip(h, "🧺")).not.toBe("");

    h.key("keydown", "KeyA");
    h.flush(4);
    h.key("keyup", "KeyA");

    h.key("keydown", "Escape");
    expect(veilTitle(h)).toContain("休息一下");
    // 暂停里按不出星星弹
    const before = ammo(h);
    h.key("keydown", "KeyF");
    expect(ammo(h)).toBe(before);

    findButton(h.root, "继续 ▶")?.fire("click");
    expect(veilTitle(h)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 双人同屏
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 双人同屏", () => {
  it("一套靶两套准星:HUD 分成两列,两个人各报各的分", () => {
    const { h } = boot();
    openMode(h, 1);
    h.flush(1);
    const cols = findAll(h.root, "shr-chip").map((c) => c.textContent);
    expect(cols.some((t) => t.startsWith(`${DUO_NAME[0]} `))).toBe(true);
    expect(cols.some((t) => t.startsWith(`${DUO_NAME[1]} `))).toBe(true);
    // 一人一套触屏键,名字写在自己那一格上
    const pads = findAll(h.root, "shr-pad");
    expect(pads).toHaveLength(2);
    expect(findAll(h.root, "shr-pad-name").map((n) => n.textContent).join(" ")).toContain("WASD");
    expect(findAll(h.root, "shr-pad-name").map((n) => n.textContent).join(" ")).toContain("方向键");
  });

  it("两根手指能同时按:左半边算朵朵的,右半边算星星的,谁也不抢谁", () => {
    const { h } = boot();
    openMode(h, 1);
    h.flush(1);
    const cv = canvas(h);

    const dd = { ...at(cv, 250, 300), pointerId: 11 };
    const xx = { ...at(cv, 750, 300), pointerId: 22 };
    // 两根手指同时按住,再一起抬起来
    cv.fire("pointerdown", dd);
    cv.fire("pointerdown", xx);
    cv.fire("pointerup", dd);
    cv.fire("pointerup", xx);
    h.flush(8);

    const cols = findAll(h.root, "shr-chip").map((c) => c.textContent);
    expect(cols.find((t) => t.startsWith(DUO_NAME[0]))).toContain("/1");
    expect(cols.find((t) => t.startsWith(DUO_NAME[1]))).toContain("/1");
  });

  it("键盘两套键位并行:F 只动朵朵,L 只动星星", () => {
    const { h } = boot();
    openMode(h, 1);
    h.flush(1);

    h.key("keydown", "KeyF");
    h.flush(8);
    let cols = findAll(h.root, "shr-chip").map((c) => c.textContent);
    expect(cols.find((t) => t.startsWith(DUO_NAME[0]))).toContain("/1");
    expect(cols.find((t) => t.startsWith(DUO_NAME[1]))).toContain("/0");

    h.key("keydown", "KeyL");
    h.flush(8);
    cols = findAll(h.root, "shr-chip").map((c) => c.textContent);
    expect(cols.find((t) => t.startsWith(DUO_NAME[1]))).toContain("/1");
  });

  it("比一比 60 秒到点出胜负,一起打是合起来算、谁也不用输", () => {
    const { h } = boot();
    openMode(h, 1);
    // 一帧 50ms,跑满 60 秒
    expect(until(h, () => veilTitle(h) !== "", 1400, 50)).toBeGreaterThan(0);
    expect(veilTitle(h)).toMatch(/赢啦|平手/);
    expect(veilSub(h)).toContain("分");
    expect(veilSub(h)).not.toMatch(/输了|你不行/);
    back(h);

    openMode(h, 2);
    expect(until(h, () => veilTitle(h) !== "", 1700, 50)).toBeGreaterThan(0);
    expect(veilTitle(h)).toMatch(/一起做到啦|差一点点/);
    expect(veilSub(h)).toContain("合起来");
  });
});

// ---------------------------------------------------------------------------
// 打不完的靶场
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 打不完的靶场", () => {
  it("靶子一个接一个自己冒出来,不用清完一批才续下一批", () => {
    const { h } = boot();
    openMode(h, 0);
    h.flush(1);
    expect(left(h)).toBe(0);
    // 一发没打,场上照样会越来越多
    const first = until(h, () => left(h) >= 1, 200, 50);
    expect(first).toBeGreaterThan(0);
    expect(until(h, () => left(h) >= 3, 200, 50)).toBeGreaterThan(0);
    expect(chip(h, "🎈 跑掉")).toContain(`/${ENDLESS_MISS_LIMIT}`);
  });

  it(`跑掉 ${ENDLESS_MISS_LIMIT} 个就收工,成绩走 save.recordEndlessBest`, () => {
    const { h } = boot();
    save.recordEndlessBest(meta.id, 777);
    openMode(h, 0);
    // 一发不打,靶子待够 ttl 就自己走掉
    expect(until(h, () => veilTitle(h) !== "", 1600, 50)).toBeGreaterThan(0);
    expect(veilTitle(h)).toContain("这一轮到这儿");
    expect(veilSub(h)).toContain("撑了");
    // 读回来的就是 save 里那份最好成绩,证明这一局真的过了 recordEndlessBest
    expect(veilSub(h)).toContain("最好成绩 777 分");
    expect(save.getGameProgress(meta.id).endlessBest).toBe(777);

    back(h);
    expect(findAll(h.root, "shr-mode")[0].textContent).toContain("最好 777 分");
  });

  it("收工面板给的是「再来一轮」和「返回」,再来一轮能重新开一局", () => {
    const { h } = boot();
    openMode(h, 0);
    expect(until(h, () => veilTitle(h) !== "", 1600, 50)).toBeGreaterThan(0);
    findButton(h.root, "🔁 再来一轮")?.fire("click");
    expect(veilTitle(h)).toBe("");
    expect(chip(h, "🎈 跑掉")).toContain(`0/${ENDLESS_MISS_LIMIT}`);
    expect(left(h)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 360px 与样式
// ---------------------------------------------------------------------------

describe("shoot-range 1.2 · 360px 与样式红线", () => {
  it("类名一律 shr- 前缀,样式只放在自己的局部 <style> 里", () => {
    const classes = [...CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(20);
    for (const c of classes) expect(c, `${c} 没带 shr- 前缀`).toMatch(/^shr-/);

    const { h } = boot();
    const styles: FakeEl[] = [];
    const walkAll = (node: FakeEl): void => {
      if (node.tagName === "style") styles.push(node);
      for (const kid of node.children) walkAll(kid);
    };
    walkAll(h.root);
    expect(styles.length).toBeGreaterThan(0);
    for (const s of styles) expect(s.parentElement).not.toBeNull();
  });

  it("暂停和预览不在横滑区里:chip 再多也把它们挤不出屏幕", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    const tools = findOne(h.root, "shr-tools");
    expect(tools).not.toBeNull();
    const inTools = tools?.children.map((c) => c.textContent) ?? [];
    expect(inTools.join(" ")).toContain("预览");
    expect(inTools.join(" ")).toContain("⏸️");
    // 横滑的那一块里只有 chip,一个按钮都没有
    const hud = findOne(h.root, "shr-hud");
    expect(hud?.children.every((c) => c.className.includes("shr-chip"))).toBe(true);
  });

  it("模式条离开地图就得真的消失:display:flex 会盖掉浏览器自带的 [hidden]", () => {
    // 这一条是踩过的坑:`.shr-modebar{display:flex}` 的优先级压过 UA 的 [hidden]{display:none},
    // 不补这条规则,进了关卡模式条还杵在那儿,360px 上白占两百多像素
    expect(CSS).toMatch(/\.shr-modebar\[hidden\][^{]*\{[^}]*display:none/);
    for (const cls of ["shr-bar", "shr-hud", "shr-pads"]) {
      expect(CSS, `${cls} 也是 display:flex,一样要补 [hidden]`).toContain(`.${cls}[hidden]`);
    }
  });

  it("HUD 是一行横滑不折行,所有字号都不小于 14px", () => {
    expect(CSS).toContain("flex-wrap:nowrap");
    expect(CSS).toContain("overflow-x:auto");
    const sizes = [...CSS.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(8);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    // 窄屏那一档只收内边距,不许再把字压小
    const narrow = /@media \(max-width:420px\)\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
    expect(narrow).not.toContain("font-size");
  });

  it("360px 的屏上画布铺满一行,触屏键都有 aria-label,按钮都是 button", () => {
    const { h, handle } = boot();
    handle.openCampaignLevel(1);
    const cv = canvas(h);
    expect(cv.width).toBe(360);
    expect(cv.height).toBeGreaterThan(180);
    // 画布高度按场地比例来,不会把靶场压扁
    expect(cv.height / cv.width).toBeCloseTo(FIELD_H / FIELD_W, 1);

    const keys = findAll(h.root, "shr-key");
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const k of keys) {
      expect(k.tagName).toBe("button");
      expect(k.getAttribute("aria-label") ?? "").not.toBe("");
    }
    expect(findOne(h.root, "shr-toggle")?.getAttribute("aria-pressed")).not.toBeNull();
  });

  it("图鉴与手感说明都是嘉年华口吻,没有写实武器、没有伤害描写", () => {
    const text = `${targetLegend().join(" ")} ${feelNote()} ${CSS}`;
    expect(text).not.toMatch(/枪|弹夹里的子弹|瞄准镜|狙击|血|伤害|击杀|死/);
    expect(targetLegend().join(" ")).toContain("分裂靶");
    expect(targetLegend().join(" ")).toContain("护盾靶");
    expect(targetLegend().join(" ")).toContain("彩虹靶");
    expect(targetLegend().join(" ")).toContain("花朵靶");
    expect(feelNote()).toContain("蓄力");
  });
});

/**
 * 1.2 监督修复员补的 360px 热区守门用例。
 *
 * 这一款的版面本来就是合规的(`--k` 单人 46px、双人与窄屏 44px、
 * 芯片与提示语一律 14px),但此前**一条断言都没有** —— 合规靠的是当时写代码的人细心,
 * 不是靠用例兜着。补上,免得以后有人为了挤版面把 `--k` 调到 40 都没人拦。
 */
describe("360px 热区与字号:双人同屏时两套控件各自够大", () => {
  const css = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

  function values(prop: string): number[] {
    const out: number[] = [];
    for (const m of css.matchAll(new RegExp(`${prop}\\s*:\\s*([\\d.]+)px`, "g"))) out.push(Number(m[1]));
    return out;
  }

  it("虚拟键盘的格子边长 `--k` 在每一档下都不低于 44px", () => {
    const ks = values("--k");
    expect(ks.length, "一条 --k 都没有").toBeGreaterThanOrEqual(3);
    for (const k of ks) expect(k, `虚拟键格子 ${k}px 低于 44px 热区`).toBeGreaterThanOrEqual(44);
    // 双人同屏那一档单独写过一次:两套控件并排也不许缩水
    expect(css).toContain('.shr-pads[data-players="2"]{--k:44px;}');
    // 格子是用 --k 铺出来的,不是各写一个死数
    expect(css).toContain("grid-template-columns:repeat(3,var(--k))");
    expect(css).toContain("grid-auto-rows:var(--k)");
  });

  it("HUD 芯片、提示语、准星标题的字号都不小于 14px", () => {
    for (const sel of [".shr-chip", ".shr-tip", ".shr-pad-name"]) {
      const at = css.indexOf(`${sel}{`);
      expect(at, `找不到 ${sel}`).toBeGreaterThan(0);
      const decl = css.slice(at, css.indexOf("}", at));
      const m = decl.match(/font-size:\s*([\d.]+)px/);
      expect(m, `${sel} 没写字号`).not.toBeNull();
      expect(Number(m![1]), `${sel} 的字号小于 14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("窄屏那一档只收内边距,不动热区字号", () => {
    const at = css.indexOf("@media (max-width:420px)");
    expect(at).toBeGreaterThan(0);
    const block = css.slice(at, css.indexOf("}\n@media", at) + 1);
    expect(block).toContain("--k:44px");
    expect(block, "窄屏档不该再压字号").not.toMatch(/font-size/);
  });
});
