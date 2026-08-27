/**
 * 运行时用例(1.2 新增):真的把一局挂起来跑几帧。
 *
 * 跑在 node 环境,DOM 桩在 `domStub.ts`。这里管的是纯逻辑管不到的那几件事:
 * `tkb-` 前缀与局部 style、双人两套摇杆在 360px 上不重叠且热区够大、
 * 换弹按钮、折叠小地图、平台直达第 N 关 / `?level=` / Skip 走 `requestSkip`、
 * 无尽成绩写 `recordEndlessBest`,以及 `destroy` 之后一根线都不留。
 */
import { afterEach, describe, expect, it } from "vitest";
import { allText, countNodes, findAll, findButton, findOne, install, type FakeEl, type Harness } from "./domStub";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";

let harness: Harness | null = null;

afterEach(() => {
  resetLevelExtras();
  harness?.restore();
  harness = null;
});

interface Mounted {
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

async function mountGame(
  h: Harness,
  opts: { initialLevel?: number; play?: (n: string) => void } = {}
): Promise<Mounted> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: opts.play ?? (() => {}),
    addStars: (n: number) => n,
    ...(opts.initialLevel === undefined ? {} : { initialLevel: opts.initialLevel }),
  } as never) as unknown as Mounted;
}

/**
 * 本款自己那一块 `<style>`(188 框架也会挂一块 `l99-` 的,不是我们的事)。
 * 找不到就返回空串,断言那边自然会炸。
 */
function styleText(root: FakeEl): string {
  let out = "";
  walkAll(root, (el) => {
    if (el.tagName === "style" && el.textContent.includes(".tkb-wrap")) out += el.textContent;
  });
  return out;
}

function walkAll(root: FakeEl, fn: (el: FakeEl) => void): void {
  fn(root);
  for (const kid of [...root.children]) walkAll(kid, fn);
}

/** 按完整文字找按钮:界面上同时挂着两个「跳过」时靠它分家 */
function buttonWithText(root: FakeEl, needle: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walkAll(root, (el) => {
    if (!hit && el.tagName === "button" && el.textContent.includes(needle)) hit = el;
  });
  return hit;
}

describe("画面外壳与样式", () => {
  it("样式是局部 <style>,类名一律 tkb- 前缀,没有裸的通用类名", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 3 });
    h.flush(2);

    const css = styleText(h.root);
    expect(css.length).toBeGreaterThan(200);
    // display:flex / block 会把浏览器自带的 [hidden] 顶掉,这几条压回去的规则必须在
    for (const cls of ["tkb-bar", "tkb-pads", "tkb-mode", "tkb-mini-cv"]) {
      expect(css, `${cls} 少了 [hidden] 兜底`).toContain(`.${cls}[hidden]`);
    }
    expect(css).toMatch(/\[hidden\][^{]*\{display:none;\}/);
    const classes = [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(10);
    for (const cls of classes) expect(cls, `${cls} 没带 tkb- 前缀`).toMatch(/^tkb-/);
    // 1.1 的老前缀不许再出现,不然两套样式会打架
    expect(css).not.toMatch(/\.tb-/);
    game.destroy();
  });

  it("战场是一块 canvas,而且真的一帧一帧在画", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 5 });
    h.flush(3);
    const canvas = findOne(h.root, "tkb-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBeGreaterThan(0);
    const ctx = canvas?.getContext("2d");
    const before = ctx?.strokes ?? 0;
    h.flush(4);
    expect((ctx?.strokes ?? 0) - before).toBeGreaterThan(0);
    game.destroy();
  });

  it("小地图默认折叠,点一下才展开,再点收回去", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 2 });
    h.flush(2);
    const mini = findOne(h.root, "tkb-mini-cv");
    const btn = findButton(h.root, "小地图");
    expect(mini?.hidden).toBe(true);
    expect(btn?.getAttribute("aria-expanded")).toBe("false");
    btn?.fire("click");
    h.flush(2);
    expect(mini?.hidden).toBe(false);
    expect(btn?.getAttribute("aria-expanded")).toBe("true");
    btn?.fire("click");
    expect(mini?.hidden).toBe(true);
    game.destroy();
  });
});

describe("手机 360px:两套摇杆", () => {
  it("单人一套摇杆,拉第二个人进来就变两套,而且左右各一套", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const game = await mountGame(h, { initialLevel: 4 });
    h.flush(2);
    expect(findAll(h.root, "tkb-pad")).toHaveLength(1);
    game.destroy();

    const h2 = install({ innerWidth: 360 });
    harness = h2;
    const two = await mountGame(h2);
    findButton(h2.root, "单人闯关")?.fire("click");
    h2.flush(2);
    expect(findButton(h2.root, "双人合作")).not.toBeNull();
    // 切成双人之后开一关,应当两套摇杆一起出来
    two.openCampaignLevel(6);
    h2.flush(2);
    expect(findAll(h2.root, "tkb-pad")).toHaveLength(2);
    const pads = findOne(h2.root, "tkb-pads");
    expect(pads?.className).toContain("tkb-pads-two");
    two.destroy();
  });

  it("摇杆和开火钮是分开的两块,热区都不小于 44px", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const game = await mountGame(h, { initialLevel: 7 });
    h.flush(2);
    const mod = await import("./index");
    expect(mod.TOUCH_MIN).toBeGreaterThanOrEqual(44);
    expect(mod.TOUCH_MIN_TWO).toBeGreaterThanOrEqual(44);

    const css = styleText(h.root);
    // 双人挤在窄屏上时那一套覆盖值,也得压在 44px 以上
    for (const m of css.matchAll(/min-(?:width|height):(\d+)px/g)) {
      expect(Number(m[1]), `热区 ${m[1]}px 太小`).toBeGreaterThanOrEqual(44);
    }
    // 方向键一块(4 颗),动作键另一块(发射 / 换弹 / 补墙),互不叠在一起
    expect(findAll(h.root, "tkb-dpad")).toHaveLength(1);
    expect(findAll(h.root, "tkb-acts-col")).toHaveLength(1);
    expect(findAll(h.root, "tkb-fire")).toHaveLength(1);
    expect(findAll(h.root, "tkb-shell")).toHaveLength(1);
    expect(findAll(h.root, "tkb-brick")).toHaveLength(1);
    game.destroy();
  });

  it("每一颗按钮都写了给读屏用的名字", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 9 });
    h.flush(2);
    for (const key of findAll(h.root, "tkb-key")) {
      expect(key.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(2);
    }
    game.destroy();
  });
});

describe("键盘:两套键位与换弹", () => {
  it("R / O 各换各的弹丸,按钮上的图案跟着变", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 11 });
    h.flush(2);
    const shellBtn = findOne(h.root, "tkb-shell");
    const first = shellBtn?.textContent;
    h.key("keydown", "KeyR");
    h.flush(2);
    expect(shellBtn?.textContent).not.toBe(first);
    // 单人局里 O 是 1 号位的键,场上没这个人,按了不该出事
    h.key("keydown", "KeyO");
    h.flush(2);
    expect(allText(h.root)).toContain("弹");
    game.destroy();
  });

  it("按住 W 车会往上开,松手就停;Esc 能暂停也能继续", async () => {
    const h = (harness = install());
    const game = await mountGame(h, { initialLevel: 12 });
    h.flush(2);
    h.key("keydown", "KeyW");
    h.flush(20);
    h.key("keyup", "KeyW");
    expect(findButton(h.root, "暂停")).not.toBeNull();
    h.key("keydown", "Escape");
    h.flush(1);
    expect(findOne(h.root, "tkb-over")).not.toBeNull();
    expect(findButton(h.root, "继续")).not.toBeNull();
    h.key("keydown", "Escape");
    h.flush(1);
    expect(findOne(h.root, "tkb-over")).toBeNull();
    game.destroy();
  });
});

describe("平台接线", () => {
  it("levelFromQuery 只认合法的 ?level=", async () => {
    const mod = await import("./index");
    expect(mod.levelFromQuery("?level=42")).toBe(42);
    expect(mod.levelFromQuery("?a=1&level=7")).toBe(7);
    expect(mod.levelFromQuery("?level=0")).toBeNull();
    expect(mod.levelFromQuery("?level=abc")).toBeNull();
    expect(mod.levelFromQuery("?other=3")).toBeNull();
    expect(mod.levelFromQuery(null)).toBeNull();
    expect(mod.levelFromQuery("")).toBeNull();
  });

  it("地址栏带 ?level= 就直接开那一关,不停在选关地图", async () => {
    const h = (harness = install({ search: "?level=33" }));
    const game = await mountGame(h);
    h.flush(2);
    expect(allText(h.root)).toContain("第 33 关");
    expect(findOne(h.root, "tkb-canvas")).not.toBeNull();
    game.destroy();
  });

  it("openCampaignLevel 越界就夹住,返回真正打开的那一关", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    h.flush(1);
    expect(game.openCampaignLevel(1)).toBe(1);
    h.flush(1);
    expect(game.openCampaignLevel(188)).toBe(188);
    h.flush(1);
    expect(game.openCampaignLevel(0)).toBe(1);
    h.flush(1);
    expect(game.openCampaignLevel(9999)).toBe(188);
    h.flush(1);
    expect(allText(h.root)).toContain("第 188 关");
    game.destroy();
  });

  it("跳关走平台的 requestSkip:壳层没注册就不挂这个按钮", async () => {
    const h = (harness = install());
    resetLevelExtras();
    const game = await mountGame(h, { initialLevel: 20 });
    h.flush(2);
    expect(buttonWithText(h.root, "跳过")).toBeNull();
    game.destroy();
  });

  it("注册了 requestSkip:按钮出现,家长放行之后直接进下一关", async () => {
    const h = (harness = install());
    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: (id, level) => {
        asked.push([id, level]);
        return Promise.resolve(true);
      },
    });
    const game = await mountGame(h, { initialLevel: 20 });
    h.flush(2);
    const skip = buttonWithText(h.root, "跳过 第 20 关");
    expect(skip).not.toBeNull();
    skip?.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    h.flush(2);
    // 关号是 0 基的,和 188 框架内部一致
    expect(asked).toEqual([["tank-battle", 19]]);
    expect(allText(h.root)).toContain("第 21 关");
    game.destroy();
  });

  it("家长没放行就留在原地,一关都不跳", async () => {
    const h = (harness = install());
    registerLevelExtras({ requestSkip: () => Promise.resolve(false) });
    const game = await mountGame(h, { initialLevel: 20 });
    h.flush(2);
    buttonWithText(h.root, "跳过 第 20 关")?.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    h.flush(2);
    expect(allText(h.root)).toContain("第 20 关");
    game.destroy();
  });
});

describe("模式入口", () => {
  it("三种额外玩法都开得起来,而且都回得去选关", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    h.flush(2);
    for (const label of ["无尽守老巢", "双人对战"]) {
      findButton(h.root, label)?.fire("click");
      h.flush(4);
      expect(findOne(h.root, "tkb-canvas"), `${label} 没起来`).not.toBeNull();
      findButton(h.root, "回选关")?.fire("click");
      h.flush(2);
      expect(findOne(h.root, "tkb-canvas")).toBeNull();
    }
    // 合作是个开关:按一下拉星星进来
    const coop = findButton(h.root, "单人闯关");
    coop?.fire("click");
    h.flush(1);
    expect(findButton(h.root, "双人合作")).not.toBeNull();
    game.destroy();
  });

  it("对战可以挑场地、也可以叫电脑陪练,叫了陪练就只留一套摇杆", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    h.flush(2);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(3);
    expect(findAll(h.root, "tkb-pad")).toHaveLength(2);
    expect(findButton(h.root, "镜面冰场")).not.toBeNull();
    expect(findButton(h.root, "转盘广场")).not.toBeNull();

    findButton(h.root, "陪练·追人")?.fire("click");
    h.flush(3);
    expect(findAll(h.root, "tkb-pad")).toHaveLength(1);
    game.destroy();
  });

  it("换场地 / 换陪练是原地换一茬,不会在后台留下上一局", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    h.flush(2);

    findButton(h.root, "无尽守老巢")?.fire("click");
    h.flush(3);
    findButton(h.root, "冰原老巢")?.fire("click");
    h.flush(3);
    expect(findAll(h.root, "tkb-canvas")).toHaveLength(1);
    findButton(h.root, "回选关")?.fire("click");
    h.flush(2);
    expect(findAll(h.root, "tkb-canvas")).toHaveLength(0);

    findButton(h.root, "双人对战")?.fire("click");
    h.flush(3);
    findButton(h.root, "转盘广场")?.fire("click");
    h.flush(3);
    findButton(h.root, "陪练·乱转")?.fire("click");
    h.flush(3);
    expect(findAll(h.root, "tkb-canvas")).toHaveLength(1);
    expect(findAll(h.root, "tkb-pad")).toHaveLength(1);
    findButton(h.root, "回选关")?.fire("click");
    h.flush(2);
    expect(findAll(h.root, "tkb-canvas")).toHaveLength(0);
    expect(h.pendingFrames()).toBe(0);
    game.destroy();
  });

  it("无尽有两张场地可挑,成绩记在 recordEndlessBest 那条线上", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    h.flush(2);
    findButton(h.root, "无尽守老巢")?.fire("click");
    h.flush(4);
    expect(findButton(h.root, "老场地")).not.toBeNull();
    expect(findButton(h.root, "冰原老巢")).not.toBeNull();

    const { save } = await import("../../engine/save");
    save.recordEndlessBest("tank-battle", 5);
    findButton(h.root, "回选关")?.fire("click");
    h.flush(2);
    expect(findButton(h.root, "最好 第 5 波")).not.toBeNull();
    game.destroy();
  });
});

describe("destroy 归零", () => {
  it("打几帧再退出:rAF、window 监听、节点全部清干净", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const game = await mountGame(h, { initialLevel: 15 });
    h.flush(8);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);
    expect(countNodes(h.root)).toBeGreaterThan(1);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
    expect(h.pendingTimers()).toBe(0);
  });

  it("反复进出三种玩法,监听不会越挂越多", async () => {
    const h = (harness = install());
    const game = await mountGame(h);
    let peak = 0;
    for (const label of ["无尽守老巢", "双人对战", "无尽守老巢"]) {
      findButton(h.root, label)?.fire("click");
      h.flush(5);
      peak = Math.max(peak, h.windowListeners());
      findButton(h.root, "回选关")?.fire("click");
      h.flush(2);
    }
    // 每一轮的峰值都一样(keydown / keyup / blur / resize 四个)
    expect(peak).toBe(4);
    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
  });

  it("退出之后彻底哑掉:音效只走 api.play,再按键一声不响", async () => {
    const h = (harness = install());
    const heard: string[] = [];
    const game = await mountGame(h, { initialLevel: 18, play: (n) => heard.push(n) });
    h.flush(3);
    h.key("keydown", "KeyF");
    h.flush(30);
    expect(heard.length).toBeGreaterThan(0);

    game.destroy();
    heard.length = 0;
    h.key("keydown", "KeyF");
    h.key("keydown", "KeyR");
    h.flush(40);
    expect(heard).toEqual([]);
  });
});
