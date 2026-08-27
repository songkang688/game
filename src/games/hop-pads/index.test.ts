/**
 * 跳跳台 · 前端接线回归。
 *
 * 规格要的是「四种模式都能开」「掉下去先掉再结算,禁止瞬死」「destroy 干净」
 * 「360px 整块屏幕都是蓄力热区」「prefers-reduced-motion 不晃屏」。
 * 测试环境是 node,所以用自带的 `domStub.ts`:window 监听、rAF、DOM 节点都数得出来。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { El, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./domStub";
import { MAX_HOLD, powerForDistance } from "./physics";
import { requiredPower } from "./run";
import { levelDifficulty } from "./levels";
import { CHARGE_BAR_H, FALL_TIME, createStage, fitScale, meta, mount, project, type Stage } from "./index";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
  wins: number;
  loses: number;
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [], wins: 0, loses: 0 };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {
      rec.wins += 1;
    },
    onLose: () => {
      rec.loses += 1;
    },
  } as unknown as GameApi;
  return rec;
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

/** 用理想力度跳一次,并把飞行动画走完 */
function perfectJump(stage: Stage, settleMs = 2600): void {
  stage.tick(20);
  const p = requiredPower(stage.state());
  stage.press();
  stage.release(p * MAX_HOLD);
  stage.tick(settleMs);
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("模块契约", () => {
  it("meta 按规格落地,四种模式都声明了", () => {
    expect(meta.id).toBe("hop-pads");
    expect(meta.title).toBe("跳跳台");
    expect(meta.emoji).toBe("⭕");
    expect(meta.category).toBe("casual");
    expect(meta.color).toBe("#FFE0C8");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.blurb).toContain("蓄力");
  });
});

describe("投影与画布", () => {
  it("台心投在画面中央,越往前的台子画得越高", () => {
    const cam = { x: 0, z: 0, scale: 1, w: 360, h: 400, shake: 0 };
    const here = project(cam, 0, 0);
    expect(here.sx).toBe(180);
    expect(project(cam, 0, 200).sy).toBeLessThan(here.sy);
    expect(project(cam, 60, 0).sx).toBeGreaterThan(here.sx);
    // 跳到半空中,人画得更高
    expect(project(cam, 0, 0, 80).sy).toBeLessThan(here.sy);
  });

  it("360px 窄屏也给得出正经缩放,不会缩成 0", () => {
    expect(fitScale(360, 380)).toBeGreaterThan(0.5);
    expect(fitScale(360, 380)).toBeLessThan(fitScale(900, 700));
  });

  it("蓄力条比 12px 高", () => {
    expect(CHARGE_BAR_H).toBeGreaterThanOrEqual(12);
  });
});

describe("一块舞台跑起来", () => {
  function makeStage(extra: Partial<Parameters<typeof createStage>[1]> = {}): { stage: Stage; sounds: string[] } {
    const sounds: string[] = [];
    const host = new El("div") as unknown as HTMLElement;
    dom.root.appendChild(host as unknown as El);
    const stage = createStage(host, {
      seed: 4321,
      difficulty: levelDifficulty(0, 0),
      goal: 3,
      sfx: (n) => sounds.push(n),
      ...extra,
    });
    return { stage, sounds };
  }

  it("按住 → 松手 → 落地,状态一路走完", () => {
    const { stage, sounds } = makeStage();
    expect(stage.phase()).toBe("ready");
    stage.tick(20);
    stage.press();
    expect(stage.phase()).toBe("charging");
    const p = requiredPower(stage.state());
    stage.release(p * MAX_HOLD);
    expect(stage.phase()).toBe("flying");
    expect(sounds).toContain("jump");
    stage.tick(2600);
    expect(stage.phase()).toBe("ready");
    expect(stage.state().hops).toBe(1);
    expect(stage.state().perfects).toBe(1);
    stage.destroy();
  });

  it("连着跳到目标座数会触发 onGoal", () => {
    let reached = 0;
    const { stage } = makeStage({ onGoal: () => (reached += 1) });
    for (let i = 0; i < 3; i++) perfectJump(stage);
    expect(stage.state().hops).toBe(3);
    expect(reached).toBe(1);
    stage.destroy();
  });

  it("掉下去必须先播下落动画再结算,禁止瞬死", () => {
    let overAt = -1;
    let ticks = 0;
    const { stage, sounds } = makeStage({
      onOver: () => {
        overAt = ticks;
      },
    });
    stage.tick(20);
    stage.press();
    stage.release(MAX_HOLD); // 用满力,直接飞过头
    stage.tick(800);
    ticks = 800;
    expect(stage.phase()).toBe("falling");
    expect(overAt).toBe(-1);
    expect(sounds).toContain("oops");
    // 下落动画走完才结算
    stage.tick(FALL_TIME * 1000);
    ticks = 800 + FALL_TIME * 1000;
    expect(stage.phase()).toBe("over");
    expect(overAt).toBeGreaterThan(0);
    expect(stage.state().alive).toBe(false);
    stage.destroy();
  });

  it("落在台面边缘站得住,连击清零但不结束", () => {
    const { stage } = makeStage();
    perfectJump(stage);
    expect(stage.state().combo).toBe(1);
    stage.tick(20);
    const need = requiredPower(stage.state());
    stage.press();
    // 少按一点:落点还在台面上,只是没进圆心
    stage.release(powerForDistance(60 + 200 * need - 24) * MAX_HOLD);
    stage.tick(2600);
    expect(stage.state().alive).toBe(true);
    expect(stage.state().combo).toBe(0);
    expect(stage.state().hops).toBe(2);
    stage.destroy();
  });

  it("整块画面都是蓄力热区,按哪儿都算", () => {
    const { stage } = makeStage();
    const hot = dom.root.find((e) => e.className.includes("hp-hot"));
    expect(hot).toBeTruthy();
    expect(hot!.getAttribute("aria-label")).toContain("蓄力");
    hot!.dispatch("pointerdown");
    expect(stage.phase()).toBe("charging");
    stage.destroy();
  });

  it("画布给读屏软件念得出当前进度", () => {
    const { stage } = makeStage();
    perfectJump(stage);
    const canvas = dom.root.find((e) => e.className.includes("hp-canvas"))!;
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toContain("站住 1 座");
    expect(canvas.getAttribute("data-hops")).toBe("1");
    stage.destroy();
  });

  it("Esc 暂停,再按一次继续,暂停期间时间不走", () => {
    const { stage } = makeStage();
    const canvas = dom.root.find((e) => e.className.includes("hp-canvas"))!;
    perfectJump(stage);
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "Escape" });
    stage.tick(20);
    expect(canvas.getAttribute("data-paused")).toBe("1");
    expect(canvas.getAttribute("aria-label")).toContain("已暂停");
    const frozen = stage.state().time;
    stage.tick(600);
    expect(stage.state().time).toBe(frozen);
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "Escape" });
    stage.tick(60);
    expect(canvas.getAttribute("data-paused")).toBe("0");
    expect(stage.state().time).toBeGreaterThan(frozen);
    stage.destroy();
  });

  it("跳满目标座数后画面定格,再按也不会继续跳", () => {
    const { stage } = makeStage();
    for (let i = 0; i < 3; i++) perfectJump(stage);
    expect(stage.state().hops).toBe(3);
    stage.press();
    stage.release(600);
    stage.tick(2000);
    expect(stage.state().hops).toBe(3);
    stage.destroy();
  });

  it("认自己的键、不认别人的键", () => {
    const { stage } = makeStage({ keys: ["l"] });
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "f" });
    expect(stage.phase()).toBe("ready");
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "L" });
    expect(stage.phase()).toBe("charging");
    for (const f of dom.winListeners.get("keyup") ?? []) f({ key: "l" });
    expect(stage.phase()).toBe("flying");
    stage.destroy();
  });

  it("蓄过头能收力:按 G 卸掉力,人还站在原地,这一跳不算数", () => {
    const { stage, sounds } = makeStage();
    stage.tick(20);
    stage.press();
    stage.tick(900); // 一路按到快满力
    expect(stage.phase()).toBe("charging");
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "G" });
    expect(stage.phase()).toBe("ready");
    expect(sounds).toContain("tap");
    // 收力不消耗这一跳,座数与连击都不动
    stage.tick(600);
    expect(stage.state().hops).toBe(0);
    expect(stage.state().alive).toBe(true);
    // 收完力还能重新蓄,而且力度是从零开始重新数的
    perfectJump(stage);
    expect(stage.state().hops).toBe(1);
    expect(stage.state().perfects).toBe(1);
    stage.destroy();
  });

  it("收力只在蓄力时有效,站着按不会有任何事", () => {
    const { stage } = makeStage();
    expect(stage.cancel()).toBe(false);
    expect(stage.phase()).toBe("ready");
    stage.tick(20);
    stage.press();
    expect(stage.cancel()).toBe(true);
    expect(stage.cancel()).toBe(false);
    // 飞行途中按收力键不能把人从半空中拽回来
    stage.tick(20);
    stage.press();
    stage.release(300);
    expect(stage.phase()).toBe("flying");
    expect(stage.cancel()).toBe(false);
    expect(stage.phase()).toBe("flying");
    stage.destroy();
  });

  it("双人各收各的力:朵朵按 G、星星按 K,谁也收不掉对方的", () => {
    const duo = makeStage({ keys: ["f"], cancelKeys: ["g"] });
    const star = makeStage({ keys: ["l"], cancelKeys: ["k"] });
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "f" });
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "l" });
    expect([duo.stage.phase(), star.stage.phase()]).toEqual(["charging", "charging"]);
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "k" });
    expect([duo.stage.phase(), star.stage.phase()]).toEqual(["charging", "ready"]);
    for (const f of dom.winListeners.get("keydown") ?? []) f({ key: "g" });
    expect([duo.stage.phase(), star.stage.phase()]).toEqual(["ready", "ready"]);
    duo.stage.destroy();
    star.stage.destroy();
  });

  it("暂停期间时间不走,松手也不会偷偷起跳", () => {
    const { stage } = makeStage();
    stage.setPaused(true);
    stage.press();
    expect(stage.phase()).toBe("ready");
    stage.tick(500);
    expect(stage.state().hops).toBe(0);
    stage.setPaused(false);
    perfectJump(stage);
    expect(stage.state().hops).toBe(1);
    stage.destroy();
  });

  it("destroy 之后 window 监听、rAF、DOM 一样不剩", () => {
    const before = windowListenerCount(dom);
    const { stage } = makeStage();
    expect(windowListenerCount(dom)).toBeGreaterThan(before);
    perfectJump(stage);
    stage.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.cancelled.length).toBeGreaterThan(0);
    expect(dom.root.find((e) => e.className.includes("hp-stage"))).toBeNull();
  });

  it("飞到一半就 destroy 也不会留下东西", () => {
    const before = windowListenerCount(dom);
    const { stage } = makeStage();
    stage.tick(20);
    stage.press();
    stage.release(requiredPower(stage.state()) * MAX_HOLD);
    stage.tick(100);
    expect(stage.phase()).toBe("flying");
    stage.destroy();
    expect(windowListenerCount(dom)).toBe(before);
  });
});

describe("prefers-reduced-motion", () => {
  it("默认会有落地镜头下沉", () => {
    const host = new El("div") as unknown as HTMLElement;
    dom.root.appendChild(host as unknown as El);
    const stage = createStage(host, { seed: 99, difficulty: levelDifficulty(0, 0), sfx: () => undefined });
    stage.tick(20);
    stage.press();
    stage.release(requiredPower(stage.state()) * MAX_HOLD);
    stage.tick(700);
    expect(Math.abs(stage.camera().shake)).toBeGreaterThan(0);
    stage.destroy();
  });

  it("开了减少动效就一点都不晃", () => {
    restoreDom();
    dom = installDom(360, true);
    const host = new El("div") as unknown as HTMLElement;
    dom.root.appendChild(host as unknown as El);
    const stage = createStage(host, { seed: 99, difficulty: levelDifficulty(0, 0), sfx: () => undefined });
    stage.tick(20);
    stage.press();
    stage.release(requiredPower(stage.state()) * MAX_HOLD);
    stage.tick(700);
    expect(stage.camera().shake).toBe(0);
    expect(stage.state().hops).toBe(1);
    stage.destroy();
  });
});

describe("四种模式都开得出来", () => {
  it("首页三个模式按钮 + 188 关地图都在", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(byText("无尽跳")).toBeTruthy();
    expect(byText("幽灵对战")).toBeTruthy();
    expect(byText("双人同屏")).toBeTruthy();
    expect(dom.root.find((e) => e.className.includes("l99-map"))).toBeTruthy();
    expect(dom.root.textContent).toContain("/188 关");
    handle.destroy();
  });

  it("闯关第 1 关进得去,画布与提示都有", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")!.dispatch("click");
    expect(dom.root.find((e) => e.className.includes("hp-canvas"))).toBeTruthy();
    expect(dom.root.textContent).toContain("站住");
    flushFrames(dom, 6);
    handle.destroy();
    expect(dom.root.children.length).toBe(0);
  });

  it("无尽模式开得起来,再退回来", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽跳")!.dispatch("click");
    expect(dom.root.findAll((e) => e.className.includes("hp-canvas"))).toHaveLength(1);
    flushFrames(dom, 4);
    byText("返回")!.dispatch("click");
    expect(dom.root.findAll((e) => e.className.includes("hp-canvas"))).toHaveLength(0);
    handle.destroy();
  });

  it("对战要先挑对手,挑完才开跳", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("幽灵对战")!.dispatch("click");
    expect(dom.root.textContent).toContain("地狱");
    expect(dom.root.findAll((e) => e.className.includes("hp-canvas"))).toHaveLength(0);
    byText("开跳")!.dispatch("click");
    expect(dom.root.findAll((e) => e.className.includes("hp-canvas"))).toHaveLength(1);
    expect(dom.root.textContent).toContain("幽灵");
    flushFrames(dom, 4);
    handle.destroy();
  });

  it("双人同屏是上下两块,朵朵 F、星星 L", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")!.dispatch("click");
    expect(dom.root.findAll((e) => e.className.includes("hp-canvas"))).toHaveLength(2);
    expect(dom.root.textContent).toContain("朵朵");
    expect(dom.root.textContent).toContain("星星");
    expect(dom.root.textContent).toContain("F");
    expect(dom.root.textContent).toContain("L");
    flushFrames(dom, 4);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("壳里的返回钮也够手指点:44px 起,和模式钮一个线", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const css = dom.root.find((e) => e.tagName === "style")?.textContent ?? "";
    expect(css).toMatch(/\.hp-back\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.hp-open\{[^}]*min-height:44px/);
    expect(css).not.toContain("min-height:40px");
    handle.destroy();
  });

  it("每种玩法的说明行都写了收力键", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")!.dispatch("click");
    expect(dom.root.textContent).toContain("收力");
    flushFrames(dom, 4);
    handle.destroy();

    const h2 = mount(fakeApi(dom.root).api);
    byText("无尽跳")!.dispatch("click");
    expect(dom.root.textContent).toContain("收力");
    flushFrames(dom, 4);
    h2.destroy();

    const h3 = mount(fakeApi(dom.root).api);
    byText("双人同屏")!.dispatch("click");
    expect(dom.root.textContent).toContain("朵朵按 G");
    expect(dom.root.textContent).toContain("星星按 K");
    flushFrames(dom, 4);
    h3.destroy();
  });

  it("整个游戏 destroy 之后什么都不剩", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")!.dispatch("click");
    flushFrames(dom, 8);
    handle.destroy();
    expect(dom.root.children.length).toBe(0);
    expect(windowListenerCount(dom)).toBe(0);
  });
});
