/**
 * 碰碰砖块 · 窗口 4 档A · 第 1 轮监督修复员
 *
 * 本轮在这一款上没查出阻断或严重问题（砖塔爆米花的不一致已由 A-L04 落地解决）。
 * 修复员做的是复核：
 *
 *  1. **文案红线扩面**到整个目录（原来只扫 `meta.ts` + `guide.ts`）；
 *  2. **道具没有一个是永久强化**：全部有时限，板宽有上下限，续时间也封顶；
 *  3. **`destroy` 一件不剩**：`Janitor` 的三类资源全清、清完 `pending()` 归零。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import GUIDE from "./guide";
import {
  Janitor,
  MAX_POWER_SECONDS,
  PADDLE_SCALE_MAX,
  PADDLE_SCALE_MIN,
  POWERS,
  POWER_ORDER,
  STALL_HINT,
  grantPower,
  powerEffects,
  tickPowers
} from "./logic";

const DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => ({ file: f, text: readFileSync(join(DIR, f), "utf8") }));

const BRAND_WORDS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
  "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀", "roblox", "disney", "zelda", "sonic"
];

const NO_BLOOD_WORDS = ["流血", "出血", "死亡", "死了", "尸", "杀死"];
const HARSH_WORDS = ["笨", "蠢", "白痴", "垃圾", "太差劲", "没出息"];

const FORBIDDEN_API = [
  "XMLHttpRequest", "WebSocket", "socket.io", "three.js", "from \"three\"",
  "new Audio(", "AudioContext", "createOscillator", "https://cdn", "http://cdn", "navigator.vibrate"
];

function literals(text: string): string[] {
  return text.match(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\[\s\S]|[^\\`])*`/g) ?? [];
}

function guideText(): string[] {
  const out = [GUIDE.title, ...GUIDE.general];
  for (const e of GUIDE.entries) out.push(e.title, ...e.tips);
  return out;
}

describe("碰碰砖块 · R1 修复 · 全源码红线复核", () => {
  it("扫的是整个目录，不只是 meta.ts 和 guide.ts", () => {
    const names = SOURCES.map((s) => s.file);
    for (const must of ["index.ts", "logic.ts", "levels.ts", "meta.ts", "guide.ts"]) {
      expect(names, `漏扫了 ${must}`).toContain(must);
    }
  });

  it("商标黑名单 0 命中（「俄罗斯方块」这类同品类词也一并挡住）", () => {
    for (const { file, text } of SOURCES) {
      const low = text.toLowerCase();
      for (const w of BRAND_WORDS) {
        expect(low.includes(w.toLowerCase()), `${file} 里出现了「${w}」`).toBe(false);
      }
    }
  });

  it("玩家看得见的字里不见血、不见死，也没有数落人的话", () => {
    for (const { file, text } of SOURCES) {
      for (const s of literals(text)) {
        for (const w of [...NO_BLOOD_WORDS, ...HARSH_WORDS]) {
          expect(s.includes(w), `${file} 的字符串「${s.slice(0, 40)}」里出现了「${w}」`).toBe(false);
        }
      }
    }
    for (const line of guideText()) {
      for (const w of [...NO_BLOOD_WORDS, ...HARSH_WORDS]) {
        expect(line.includes(w), `攻略里出现了「${w}」：${line}`).toBe(false);
      }
    }
  });

  it("死球提示是「帮它把方向掰正」，不是「你打得太烂」", () => {
    expect(STALL_HINT).toMatch(/帮它|往砖多的一边/);
    for (const w of [...NO_BLOOD_WORDS, ...HARSH_WORDS]) expect(STALL_HINT.includes(w)).toBe(false);
  });

  it("没有联网、没有广告内购账号、没有自己合成声音、没有外部依赖", () => {
    for (const { file, text } of SOURCES) {
      for (const api of FORBIDDEN_API) {
        expect(text.includes(api), `${file} 里出现了 ${api}`).toBe(false);
      }
      for (const w of ["广告", "内购", "充值", "登录", "注册", "localStorage.setItem"]) {
        expect(text.includes(w), `${file} 里出现了「${w}」`).toBe(false);
      }
    }
  });
});

describe("碰碰砖块 · R1 修复 · 道具没有一个是永久强化", () => {
  it("每一种道具要么有时限，要么是一次性的，没有常驻加成", () => {
    for (const k of POWER_ORDER) {
      const info = POWERS[k];
      expect(info.seconds, `${info.name}`).toBeLessThanOrEqual(MAX_POWER_SECONDS);
      expect(info.seconds, `${info.name}`).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(info.seconds)).toBe(true);
    }
  });

  it("同种道具连吃十次也不会越叠越长，封顶在单次时限", () => {
    let timers = {};
    for (let i = 0; i < 10; i++) timers = grantPower(timers, "wide");
    expect((timers as Record<string, number>).wide).toBe(POWERS.wide.seconds);
  });

  it("板宽再怎么叠都锁在上下限之间", () => {
    let timers = {};
    for (let i = 0; i < 5; i++) timers = grantPower(timers, "wide");
    expect(powerEffects(timers).paddleScale).toBeLessThanOrEqual(PADDLE_SCALE_MAX);
    expect(powerEffects(grantPower({}, "narrow")).paddleScale).toBeGreaterThanOrEqual(PADDLE_SCALE_MIN);
  });

  it("时间走完道具就没了，不会留一个 0 秒的空壳一直生效", () => {
    let timers = grantPower({}, "pierce");
    expect(powerEffects(timers).pierce).toBe(true);
    timers = tickPowers(timers, POWERS.pierce.seconds + 0.1);
    expect(timers).toEqual({});
    expect(powerEffects(timers).pierce).toBe(false);
  });
});

describe("碰碰砖块 · R1 修复 · destroy 一件不剩", () => {
  it("定时器 / rAF / 监听全清光，pending() 归零", () => {
    const cleared = { timeouts: 0, frames: 0 };
    const jan = new Janitor({
      setTimeout: () => 1,
      clearTimeout: () => { cleared.timeouts++; },
      requestAnimationFrame: () => 2,
      cancelAnimationFrame: () => { cleared.frames++; }
    });
    let off = 0;
    jan.after(30, () => undefined);
    jan.frame(() => undefined);
    jan.own(() => { off++; });
    expect(jan.pending()).toBe(3);
    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(jan.dead).toBe(true);
    expect(cleared).toEqual({ timeouts: 1, frames: 1 });
    expect(off).toBe(1);
  });

  it("destroy 之后再触发的回调一概不执行，摘监听抛错也不影响别的", () => {
    const pending: Array<() => void> = [];
    let fired = 0;
    let ok = 0;
    const jan = new Janitor({
      setTimeout: (fn) => { pending.push(fn); return 1; },
      clearTimeout: () => undefined
    });
    jan.after(5, () => { fired++; });
    jan.own(() => { ok++; });
    jan.own(() => { throw new Error("摘不掉"); });
    jan.own(() => { ok++; });
    expect(() => jan.destroy()).not.toThrow();
    for (const fn of pending) fn();
    expect(fired).toBe(0);
    expect(ok).toBe(2);
    expect(jan.pending()).toBe(0);
  });

  it("宿主没有 rAF 时也不会崩（Node 环境下就是这样）", () => {
    const jan = new Janitor({ setTimeout: () => 1, clearTimeout: () => undefined });
    expect(jan.frame(() => undefined)).toBe(0);
    expect(() => jan.destroy()).not.toThrow();
    expect(jan.pending()).toBe(0);
  });

  it("三个入口（闯关 / 砖塔 / 外层）各自都有 destroy，且都停掉 rAF", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    expect((src.match(/destroy\(\)\s*\{/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((src.match(/cancelAnimationFrame\(raf\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/jan\.destroy\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
