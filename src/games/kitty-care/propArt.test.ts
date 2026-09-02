/**
 * W8R1-03 · 萌猫小屋喂饭/逗猫道具贴纸化的钉子（窗口 8 第 1 轮监督修复员）。
 *
 * A 档报告：喂饭核心道具（🍗🧀🥬🐟🍋…）、饭碗 🥣、气泡想吃物、逗猫棒 🪶 与
 * 爪印 🐾 全为裸 emoji 直出（对照组：看病道具 toolIconSvg 已自绘）。
 * 修法：沿看病工序（空标签按钮 + 图标 span + 小字），道具一律走 kit 贴纸，
 * 文案与热区零改动。这里钉四件事：
 *   1. propIcon：贴纸 SVG、装饰/读屏两档 aria、查不到回退原文不空屏；
 *   2. 喂饭端到端：碗/托盘/想吃气泡全贴纸、0 可见裸 emoji，点想吃的→点碗照样完成；
 *   3. 逗猫端到端：棒子/爪印/气泡全贴纸，无障碍标签一字不动；
 *   4. 全部食物 + 碗 + 棒 + 爪印在贴纸图集里一张不缺。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasSticker } from "../../art/kit/stickers";
import { Arena, PROP_PX, propIcon, type TaskSpec } from "./arena";
import { ALL_FOODS, buildFeed } from "./tasks";
import { Life, type TimerHost } from "./runtime";
import { findAll, findOne, installDom, type InstalledDom, type StubEl } from "./domStub";

const PICTO = /\p{Extended_Pictographic}/u;

/** 假时钟（照 careFeedback.test.ts 的抄，只要 setTimeout 一族） */
class TinyClock {
  private seq = 1;
  readonly timers = new Map<number, () => void>();

  setTimeout(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.timers.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    this.timers.delete(id as unknown as number);
  }

  setInterval(): ReturnType<typeof setTimeout> {
    return this.seq++ as unknown as ReturnType<typeof setTimeout>;
  }

  clearInterval(): void {}

  requestAnimationFrame(): number {
    return this.seq++;
  }

  cancelAnimationFrame(): void {}

  runTimers(): void {
    const list = [...this.timers.values()];
    this.timers.clear();
    for (const fn of list) fn();
  }
}

function spec(task: TaskSpec["task"]): TaskSpec {
  return { task, target: 0, seed: 5, options: 4, playTaps: 3, notes: 3, cureSteps: 2, styleSlots: 3 };
}

describe("W8R1-03 · 道具贴纸", () => {
  let dom: InstalledDom;
  let clock: TinyClock;
  let life: Life;
  let host: StubEl;

  beforeEach(() => {
    dom = installDom();
    clock = new TinyClock();
    life = new Life(clock as unknown as TimerHost);
    host = dom.doc.createElement("div");
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  function makeArena(): Arena {
    return new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount: 1,
      moodStart: 0,
      moodMax: 0,
      theme: 0,
      reduceMotion: true
    });
  }

  it("propIcon：贴纸 SVG 永远纯装饰（不给装饰件挂标签和真按钮撞车）；查不到回退原文", () => {
    const deco = propIcon("🥣", PROP_PX.bowl) as unknown as StubEl;
    expect(deco.innerHTML).toContain("<svg");
    expect(deco.innerHTML).toContain(`width="${PROP_PX.bowl}"`);
    expect(deco.getAttribute("aria-hidden")).toBe("true");
    expect(deco.getAttribute("aria-label")).toBeNull();

    const fallback = propIcon("🦖", 20) as unknown as StubEl;
    expect(fallback.textContent).toBe("🦖");
    expect(fallback.getAttribute("aria-hidden")).toBeNull();
  });

  it("喂饭：碗/托盘/想吃气泡全贴纸，可见层 0 裸 emoji，判定与热区照旧走通", () => {
    const arena = makeArena();
    let done = 0;
    arena.startTask(spec("feed"), () => done++);
    const feed = buildFeed(5, 4);

    // 饭碗：贴纸 + 原无障碍标签
    const bowl = findOne(host, "ktc-bowl")!;
    expect(bowl.getAttribute("aria-label")).toBe("饭碗");
    expect(findOne(bowl, "ktc-propicon")!.innerHTML).toContain("<svg");
    expect(PICTO.test(bowl.textContent)).toBe(false);

    // 托盘：每个按钮空标签 + 贴纸 + 小字食物名，热区类名与 aria 一字不动
    const items = findAll(host, "ktc-drag");
    expect(items.length).toBe(feed.options.length);
    items.forEach((item, i) => {
      expect(item.getAttribute("aria-label")).toBe(feed.options[i].name);
      expect(item.textContent).toContain(feed.options[i].name);
      expect(PICTO.test(item.textContent), `${feed.options[i].name} 还漏 emoji`).toBe(false);
      expect(findOne(item, "ktc-propicon")!.innerHTML).toContain("<svg");
    });

    // 想吃气泡：可见层是贴纸，原 emoji 收进 sr-only（读屏念的和原来一字不差）
    const bubble = findOne(host, "ktc-bubble")!;
    expect(bubble.textContent).toContain("想吃");
    const sr = findOne(bubble, "ktc-propsr")!;
    expect(sr.textContent).toBe(feed.want.emoji);
    const wantIcon = findOne(bubble, "ktc-propicon")!;
    expect(wantIcon.getAttribute("aria-hidden")).toBe("true");
    expect(wantIcon.innerHTML).toContain("<svg");

    // 玩法走通：点想吃的那一样 → 点碗 → 完成回调照旧
    items.find((b) => b.getAttribute("aria-label") === feed.want.name)!.fire("click");
    bowl.fire("click");
    clock.runTimers();
    expect(done).toBe(1);
    expect(arena.mistakes).toBe(0);
    arena.destroy();
  });

  it("逗猫：棒子/爪印/气泡全贴纸，标签一字不动", () => {
    const arena = makeArena();
    arena.startTask(spec("play"), () => {});

    const toy = findOne(host, "ktc-toy")!;
    expect(toy.getAttribute("aria-label")).toBe("逗猫棒");
    expect(toy.textContent).toContain("逗猫棒");
    expect(PICTO.test(toy.textContent)).toBe(false);
    expect(findOne(toy, "ktc-propicon")!.innerHTML).toContain("<svg");

    const chaser = findOne(host, "ktc-chaser")!;
    expect(chaser.getAttribute("aria-hidden")).toBe("true");
    expect(findOne(chaser, "ktc-propicon")!.innerHTML).toContain("<svg");
    expect(PICTO.test(chaser.textContent)).toBe(false);

    const bubble = findOne(host, "ktc-bubble")!;
    expect(bubble.textContent).toContain("想玩逗猫棒");
    expect(PICTO.test(bubble.textContent)).toBe(false);
    expect(findOne(bubble, "ktc-propicon")!.innerHTML).toContain("<svg");
    arena.destroy();
  });

  it("九种食物 + 碗 + 棒 + 爪印，贴纸图集一张不缺", () => {
    for (const food of ALL_FOODS) {
      expect(hasSticker(food.emoji), `${food.name} ${food.emoji} 缺贴纸`).toBe(true);
    }
    for (const e of ["🥣", "🪶", "🐾"]) {
      expect(hasSticker(e), `${e} 缺贴纸`).toBe(true);
    }
  });
});
