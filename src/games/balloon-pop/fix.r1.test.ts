/**
 * 气球砰砰 · 窗口 4 档A · 第 1 轮监督修复员
 *
 * 修复 **W4A-01（严重）**：第 129–188 关里有 28 关会放礼物气球却不是「护礼物」关，
 * HUD 从头到尾没提过礼物，礼物飘走却照样按 `giftLost × 2` 扣星。
 * 孩子看到的是「一个没漏、一次没错，结算却只有一星」——扣分理由从来没露过面。
 *
 * 修法：`giftLost` 的语义收紧成「**该护住却没护住**的礼物」，
 * 只有 `goal === "protect"` 的关卡才往上记。别的关卡里礼物是个不能戳的路人：
 * 戳它只会摇一摇，飘走了不扣星、不扣爱心、也不算「放跑」。
 *
 * 另外把本档五款的商标 / 措辞黑名单从 `meta.ts` + `guide.ts` 扩到**全部源码**，
 * 并复核 `destroy` 契约。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import {
  Janitor,
  giftGuarded,
  goalFailure,
  goalReached,
  levelGoal,
  simulateLevel,
  starsFor,
  type GoalState
} from "./logic";

const DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => ({ file: f, text: readFileSync(join(DIR, f), "utf8") }));

/** 任务书点名的 29 个商标 + 几个常见英文写法。这些词在源码里一个都不许出现 */
const BRAND_WORDS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
  "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀", "roblox", "disney", "zelda", "sonic"
];

/** 玩家看得见的字里不许出现的说法：见血、见死，以及数落人的词 */
const HARSH_WORDS = ["流血", "出血", "死亡", "死了", "尸", "杀死", "笨", "蠢", "白痴", "垃圾", "太差劲"];

/** 不许自己联网 / 自己合成声音 / 引外部包 */
const FORBIDDEN_API = [
  "XMLHttpRequest", "WebSocket", "socket.io", "three.js", "from \"three\"",
  "new Audio(", "AudioContext", "createOscillator", "https://cdn", "http://cdn"
];

/** 从源码里粗略抠出字符串字面量（玩家看得见的字基本都在这儿） */
function literals(text: string): string[] {
  return text.match(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\[\s\S]|[^\\`])*`/g) ?? [];
}

describe("气球砰砰 · R1 修复 · W4A-01 礼物气球不再暗扣星", () => {
  it("非保护关的礼物飘走一颗星都不扣（原来悄悄扣两档）", () => {
    const nonProtect: GoalState = {
      popped: 20, target: 20, escaped: 0, escapes: 2, mistakes: 0, giftLost: 0
    };
    expect(starsFor(nonProtect.mistakes, nonProtect.escaped, nonProtect.giftLost)).toBe(3);
    expect(giftGuarded("count")).toBe(false);
    expect(giftGuarded("color")).toBe(false);
    expect(giftGuarded("order")).toBe(false);
    expect(giftGuarded("protect")).toBe(true);
  });

  it("护礼物关照旧算账：礼物飘走既过不了关，也拿不到三星", () => {
    const st: GoalState = { popped: 20, target: 20, escaped: 0, escapes: 2, mistakes: 0, giftLost: 1 };
    expect(goalReached("protect", st)).toBe(false);
    expect(goalFailure("protect", st)).toMatch(/礼物气球飘走啦/);
    expect(starsFor(0, 0, 1)).toBeLessThan(3);
  });

  it("28 关「有礼物但不是护礼物」的关卡，模拟一遍全都 giftLost === 0", () => {
    const affected = LEVELS.map((l, i) => ({ l, i }))
      .filter(({ l }) => (l.giftChance ?? 0) > 0 && levelGoal(l) !== "protect");
    expect(affected.length).toBe(28);
    for (const { l, i } of affected) {
      const res = simulateLevel(l, { seed: 500 + i * 7 });
      expect(res.giftLost, `第 ${i + 1} 关`).toBe(0);
      expect(starsFor(res.mistakes, res.escaped, res.giftLost), `第 ${i + 1} 关`).toBeGreaterThanOrEqual(1);
    }
  });

  it("六关真正的护礼物关，giftLost 仍然是有意义的计数口径", () => {
    const protects = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => levelGoal(l) === "protect");
    expect(protects.length).toBe(6);
    for (const { l, i } of protects) {
      const res = simulateLevel(l, { seed: 900 + i });
      // 假玩家会把礼物摇下去，所以它能护住；护住了才算赢
      expect(res.won, `第 ${i + 1} 关`).toBe(true);
      expect(res.giftLost, `第 ${i + 1} 关`).toBe(0);
    }
  });

  it("真机改在记账那一步：只有护礼物关才 giftLost++，并且同时给一句鼓励", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    expect(src).toContain("if (giftGuarded(goal)) {");
    expect(src).toContain("🎁 礼物飘走啦……没关系，下次早一点把它摇下来！");
    // 结算读的还是同一个 giftLost，不需要在两个地方各判一次
    expect(src).toContain("starsFor(mistakes, escaped, giftLost)");
  });

  it("188 关全部跑一遍：没有一关会因为礼物而拿不到该拿的星", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const res = simulateLevel(LEVELS[lv], { seed: 500 + lv * 7 });
      if (levelGoal(LEVELS[lv]) === "protect") continue;
      expect(res.giftLost, `第 ${lv + 1} 关`).toBe(0);
    }
  });
});

describe("气球砰砰 · R1 修复 · 全源码红线复核", () => {
  it("扫的是整个目录，不只是 meta.ts 和 guide.ts", () => {
    const names = SOURCES.map((s) => s.file);
    for (const must of ["index.ts", "logic.ts", "levels.ts", "meta.ts", "guide.ts"]) {
      expect(names, `漏扫了 ${must}`).toContain(must);
    }
  });

  it("商标黑名单 0 命中", () => {
    for (const { file, text } of SOURCES) {
      const low = text.toLowerCase();
      for (const w of BRAND_WORDS) {
        expect(low.includes(w.toLowerCase()), `${file} 里出现了「${w}」`).toBe(false);
      }
    }
  });

  it("玩家看得见的字里没有见血见死，也没有数落人的话", () => {
    for (const { file, text } of SOURCES) {
      for (const s of literals(text)) {
        for (const w of HARSH_WORDS) {
          expect(s.includes(w), `${file} 的字符串「${s.slice(0, 40)}」里出现了「${w}」`).toBe(false);
        }
      }
    }
  });

  it("失败文案只描述、只给方法，不下判语", () => {
    const st: GoalState = { popped: 1, target: 20, escaped: 9, escapes: 2, mistakes: 0, giftLost: 0 };
    const word = goalFailure("count", st) as string;
    expect(word).toBeTruthy();
    expect(word).toMatch(/再来一次|优先|先/);
    for (const w of HARSH_WORDS) expect(word.includes(w)).toBe(false);
  });

  it("没有联网、没有广告内购账号、没有自己合成声音、没有外部依赖", () => {
    for (const { file, text } of SOURCES) {
      for (const api of FORBIDDEN_API) {
        expect(text.includes(api), `${file} 里出现了 ${api}`).toBe(false);
      }
      for (const w of ["广告", "内购", "充值", "登录", "注册"]) {
        expect(text.includes(w), `${file} 里出现了「${w}」`).toBe(false);
      }
    }
  });

  it("声音只走 api.play / ctx.sfx，没有别的发声口子", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    const calls = src.match(/\b(api\.play|ctx\.sfx)\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(src).not.toMatch(/navigator\.vibrate/);
  });

  it("存档 key 只增不改：没有在这一档里冒出新的 localStorage 写入", () => {
    for (const { file, text } of SOURCES) {
      expect(text.includes("localStorage.setItem"), `${file} 直接写了 localStorage`).toBe(false);
    }
  });
});

describe("气球砰砰 · R1 修复 · destroy 一件不剩", () => {
  it("定时器 / 循环 / rAF / 监听全清光，pending() 归零", () => {
    const cleared = { timeouts: 0, intervals: 0, frames: 0 };
    const jan = new Janitor({
      setTimeout: () => 1,
      clearTimeout: () => { cleared.timeouts++; },
      setInterval: () => 2,
      clearInterval: () => { cleared.intervals++; },
      requestAnimationFrame: () => 3,
      cancelAnimationFrame: () => { cleared.frames++; }
    });
    let off = 0;
    jan.after(50, () => undefined);
    jan.every(50, () => undefined);
    jan.frame(() => undefined);
    jan.own(() => { off++; });
    expect(jan.pending()).toBe(4);
    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(jan.dead).toBe(true);
    expect(cleared).toEqual({ timeouts: 1, intervals: 1, frames: 1 });
    expect(off).toBe(1);
  });

  it("destroy 之后再触发的回调一概不执行", () => {
    let fired = 0;
    const pending: Array<() => void> = [];
    const jan = new Janitor({
      setTimeout: (fn) => { pending.push(fn); return 1; },
      clearTimeout: () => undefined
    });
    jan.after(10, () => { fired++; });
    jan.destroy();
    for (const fn of pending) fn();
    expect(fired).toBe(0);
  });

  it("摘监听时某一条抛错，剩下的照样摘干净", () => {
    const jan = new Janitor({ setTimeout: () => 1, clearTimeout: () => undefined });
    let ok = 0;
    jan.own(() => { ok++; });
    jan.own(() => { throw new Error("摘不掉"); });
    jan.own(() => { ok++; });
    expect(() => jan.destroy()).not.toThrow();
    expect(jan.pending()).toBe(0);
    expect(ok).toBe(2);
  });

  it("三个入口（闯关 / 无尽 / 外层）各自都有 destroy，而且都会停掉 rAF", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    expect((src.match(/destroy\(\)\s*\{/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((src.match(/cancelAnimationFrame\(raf\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/jan\.destroy\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
