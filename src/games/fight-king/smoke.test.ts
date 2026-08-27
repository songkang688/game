/**
 * 梨康格斗王 —— 无头冒烟：把整个界面真的挂起来点一遍。
 *
 * 这一份盯的是"接线"，不是玩法数字（那些在 engine / rules / ai 那几份里）：
 *  · 五个入口点得开、退得回；
 *  · 训练场的读数是真的接在引擎上、假人三选一按得动；
 *  · 手机上四颗按钮都在、连段计数是 HUD 里的独立一行（不画在画布上）；
 *  · `destroy` 之后 window 上一个监听都不许剩（两套键位 + 暂停 + 失焦）；
 *  · 壳层给了 `initialLevel` 就直奔格斗塔那一层。
 */
import { afterEach, describe, expect, it } from "vitest";
import { installDom, restoreDom, windowListenerCount, flushFrames, fireWindow, type Dom, type El } from "./domStub";
import { P1_KEYS, P2_KEYS, PAUSE_KEY } from "./controls";
import { mount } from "./index";
import { resetMigration } from "./progress";

interface Rec {
  dom: Dom;
  api: { root: unknown; play: (n: string) => void; addStars: (n: number) => number; getStars: () => number; onWin: () => void; onLose: () => void };
  sounds: string[];
  stars: number;
}

let live: { destroy: () => void } | null = null;

function setup(width = 800): Rec {
  const dom = installDom(width);
  resetMigration();
  const sounds: string[] = [];
  const rec: Rec = {
    dom,
    sounds,
    stars: 0,
    api: {
      root: dom.root,
      play: (n: string) => {
        sounds.push(n);
      },
      addStars: (n: number) => (rec.stars += n),
      getStars: () => rec.stars,
      onWin: () => undefined,
      onLose: () => undefined
    }
  };
  return rec;
}

function open(rec: Rec): { destroy: () => void } {
  live = mount(rec.api as unknown as Parameters<typeof mount>[0]);
  return live;
}

/** 按可见文字点一个按钮 */
function click(root: El, text: string): void {
  const btn = root.findAll((e) => e.tagName === "button" && e.textContent.includes(text)).pop();
  if (!btn) throw new Error(`找不到按钮：${text}`);
  btn.click();
}

afterEach(() => {
  live?.destroy();
  live = null;
  restoreDom();
});

describe("五个入口", () => {
  it("菜单上五种玩法都在，键位提示也写着", () => {
    const rec = setup();
    open(rec);
    const text = rec.dom.root.textContent;
    for (const name of ["双人对战", "人机对战", "格斗塔", "无尽连胜", "训练场"]) {
      expect(text, name).toContain(name);
    }
    expect(rec.dom.root.querySelectorAll(".fk-mode").length).toBeGreaterThanOrEqual(5);
  });

  it("人机对战的选人页给的是五档对手，不是三档", () => {
    const rec = setup();
    open(rec);
    click(rec.dom.root, "人机对战");
    const text = rec.dom.root.textContent;
    for (const label of ["轻松", "普通", "灵巧", "老练", "高手"]) {
      expect(text, label).toContain(label);
    }
  });

  it("360px 上最小的那一档字号不低于 12px", () => {
    const rec = setup(360);
    open(rec);
    const css = rec.dom.root.find((e) => e.tagName === "style")?.textContent ?? "";
    expect(css.length).toBeGreaterThan(0);
    // 训练场的帧数读数与触屏钮的钮名原来都是 11px，双人时左右各四颗钮更难认
    expect(css).toContain(".fk-clock-r{font-size:12px;");
    expect(css).toContain(".fk-pad-name{font-size:12px;");
    // 整份 CSS 逐条量过去，带小数的也算数（.fk-ch-n 与 360px 档的 .fk-name 原来是 11.5px，
    // 只挡整数像素的话它们会从筛子缝里漏过去）
    const sizes = [...css.matchAll(/font-size:([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length, "一条 font-size 都没扒到").toBeGreaterThan(15);
    for (const px of sizes) {
      expect(px, `还有 ${px}px 的字`).toBeGreaterThanOrEqual(12);
    }
  });

  it("进得去也退得回来：训练场 → 返回 → 还是那张菜单", () => {
    const rec = setup();
    open(rec);
    click(rec.dom.root, "训练场");
    expect(rec.dom.root.textContent).toContain("陪练");
    click(rec.dom.root, "返回");
    expect(rec.dom.root.textContent).toContain("格斗塔 188 关");
  });
});

describe("训练场界面", () => {
  function enterTraining(rec: Rec): void {
    open(rec);
    click(rec.dom.root, "训练场");
    click(rec.dom.root, "开打");
  }

  it("读数五行齐全：帧数、现在哪一段、挡下与命中、可取消、连段与距离", () => {
    const rec = setup();
    enterTraining(rec);
    flushFrames(rec.dom, 4);
    const live = rec.dom.root.querySelector(".fk-live");
    expect(live).not.toBeNull();
    const text = live!.textContent;
    expect(text).toContain("站着没动");
    expect(text).toContain("挡下");
    expect(text).toContain("连段");
    expect(text).toContain("距离");
  });

  it("读数是真接在引擎上的：按住轻击跑一阵，屏幕上就会报出招式名与帧数", () => {
    const rec = setup();
    enterTraining(rec);
    // 先跑完"准备…"读条，再按住轻击
    flushFrames(rec.dom, 120);
    fireWindow(rec.dom, "keydown", { code: P1_KEYS.light });
    flushFrames(rec.dom, 40);
    const live = rec.dom.root.querySelector(".fk-live")!;
    expect(live.textContent).toMatch(/起手 \d+ \/ 命中 \d+ \/ 收招 \d+/);
    fireWindow(rec.dom, "keyup", { code: P1_KEYS.light });
  });

  it("假人三选一都点得动，说明也跟着换", () => {
    const rec = setup();
    enterTraining(rec);
    const hint = rec.dom.root.querySelector(".fk-train-hint")!;
    const before = hint.textContent;
    click(rec.dom.root, "随机反击");
    expect(hint.textContent).not.toBe(before);
    click(rec.dom.root, "蹲防");
    expect(hint.textContent).not.toBe(before);
  });
});

describe("手机 360px 的 HUD 与按钮", () => {
  it("连段计数是 HUD 里的独立一行 DOM，不会被元气条压住", () => {
    const rec = setup(360);
    open(rec);
    click(rec.dom.root, "人机对战");
    click(rec.dom.root, "开打");
    expect(rec.dom.root.querySelector(".fk-comborow")).not.toBeNull();
    expect(rec.dom.root.querySelectorAll(".fk-combo").length).toBe(2);
  });

  it("触屏是轻 / 重 / 必杀 / 防御四颗按钮，双人时左右各一套", () => {
    const rec = setup(360);
    open(rec);
    click(rec.dom.root, "人机对战");
    click(rec.dom.root, "开打");
    const solo = rec.dom.root.querySelectorAll(".fk-padbtn");
    expect(solo.map((b) => b.textContent)).toEqual(["轻击", "重击", "必杀", "防御"]);
    live?.destroy();
    live = null;

    const two = setup(360);
    open(two);
    click(two.dom.root, "双人对战");
    click(two.dom.root, "开打");
    expect(two.dom.root.querySelectorAll(".fk-padbtn").length).toBe(8);
  });

  it("角色名过长会缩写，HUD 不会被顶出屏幕", () => {
    const rec = setup(360);
    open(rec);
    click(rec.dom.root, "人机对战");
    click(rec.dom.root, "开打");
    flushFrames(rec.dom, 3);
    for (const n of rec.dom.root.querySelectorAll(".fk-name")) {
      // emoji + 最多 3 个字（含省略号）
      expect([...n.textContent].length).toBeLessThanOrEqual(6);
    }
  });
});

describe("清理", () => {
  it("开一局再 destroy，window 上的监听一个都不剩", () => {
    const rec = setup();
    open(rec);
    click(rec.dom.root, "人机对战");
    click(rec.dom.root, "开打");
    flushFrames(rec.dom, 5);
    expect(windowListenerCount(rec.dom)).toBeGreaterThan(0);
    live!.destroy();
    live = null;
    expect(windowListenerCount(rec.dom)).toBe(0);
    expect(rec.dom.root.children.length).toBe(0);
  });

  it("两套键位加暂停键，destroy 之后再按也不会有人接", () => {
    const rec = setup();
    open(rec);
    click(rec.dom.root, "双人对战");
    click(rec.dom.root, "开打");
    flushFrames(rec.dom, 5);
    live!.destroy();
    live = null;
    for (const code of [P1_KEYS.light, P2_KEYS.heavy, PAUSE_KEY]) {
      expect(() => fireWindow(rec.dom, "keydown", { code })).not.toThrow();
    }
    expect(windowListenerCount(rec.dom)).toBe(0);
  });

  it("在模式之间来回切换，监听不会越挂越多", () => {
    const rec = setup();
    open(rec);
    for (let i = 0; i < 3; i++) {
      click(rec.dom.root, "人机对战");
      click(rec.dom.root, "开打");
      flushFrames(rec.dom, 3);
      click(rec.dom.root, "退出");
    }
    click(rec.dom.root, "人机对战");
    click(rec.dom.root, "开打");
    flushFrames(rec.dom, 3);
    const once = windowListenerCount(rec.dom);
    expect(once).toBeLessThanOrEqual(4);
  });
});

describe("平台接线", () => {
  it("壳层给了 initialLevel 就直奔格斗塔，不停在菜单", () => {
    const rec = setup();
    (rec.api as unknown as { initialLevel: number }).initialLevel = 1;
    open(rec);
    expect(rec.dom.root.textContent).toContain("格斗塔 188 关");
    expect(rec.dom.root.textContent).not.toContain("八位小伙伴同台切磋");
  });

  it("没给关号就照常停在菜单", () => {
    const rec = setup();
    open(rec);
    expect(rec.dom.root.textContent).toContain("八位小伙伴同台切磋");
  });
});
