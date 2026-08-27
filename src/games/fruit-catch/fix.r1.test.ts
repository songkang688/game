/**
 * 接住小水果 · 窗口 4 档A · 第 1 轮监督修复员
 *
 * 本轮在这一款上没查出阻断或严重问题（W4A-04 已由第 1 轮学习优化员的 A-L01 落地解决）。
 * 修复员做的是复核：
 *
 *  1. **文案红线扩面**到整个目录。扩面之后逮到一条：攻略写「不能接的东西是硬性扣血」，
 *     可这一款的机制里根本没有血，掉的是**爱心**（`MAX_MISS = 3` 颗）。本轮改掉。
 *  2. **失败只鼓励**：三条 `missWord` 逐条过一遍，只描述、只给方法。
 *  3. **`destroy` 一件不剩**：`Janitor` 的三类资源全清、清完 `pending()` 归零。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import GUIDE from "./guide";
import { Janitor, MAX_MISS, PLAYERS, missWord } from "./logic";

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

const NO_BLOOD_WORDS = ["血", "死亡", "死了", "尸", "杀"];
const HARSH_WORDS = ["笨", "蠢", "白痴", "垃圾", "太差劲", "不行", "没出息"];

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

describe("接住小水果 · R1 修复 · 全源码红线复核", () => {
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

  it("攻略里不再说「扣血」：这一款掉的是爱心，不是血（本轮修掉的一条）", () => {
    for (const line of guideText()) {
      for (const w of NO_BLOOD_WORDS) {
        expect(line.includes(w), `攻略里出现了「${w}」：${line}`).toBe(false);
      }
    }
    expect(guideText().some((l) => l.includes("爱心"))).toBe(true);
    expect(MAX_MISS).toBe(3);
  });

  it("玩家看得见的字里不见血、不见死，也没有数落人的话", () => {
    for (const { file, text } of SOURCES) {
      for (const s of literals(text)) {
        for (const w of [...NO_BLOOD_WORDS, ...HARSH_WORDS]) {
          expect(s.includes(w), `${file} 的字符串「${s.slice(0, 40)}」里出现了「${w}」`).toBe(false);
        }
      }
    }
  });

  it("角色只用鸭梨和康康", () => {
    expect(PLAYERS.doudou.name).toBe("鸭梨");
    expect(PLAYERS.star.name).toBe("康康");
  });

  it("三条漏球提示条条只描述、只给方法，最后一颗爱心也是鼓励", () => {
    for (let n = 1; n <= MAX_MISS; n++) {
      const w = missWord(n);
      expect(w.length).toBeGreaterThan(6);
      for (const bad of [...NO_BLOOD_WORDS, ...HARSH_WORDS]) expect(w.includes(bad), w).toBe(false);
    }
    expect(missWord(1)).toMatch(/没关系|～|！/);
    expect(missWord(MAX_MISS)).toMatch(/稳住|先/);
    // 越界也不会读出 undefined
    expect(missWord(0)).toBe(missWord(1));
    expect(missWord(99)).toBe(missWord(MAX_MISS));
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

describe("接住小水果 · R1 修复 · destroy 一件不剩", () => {
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

  it("两套键位的监听都摘得干净（双人同屏最容易漏这一条）", () => {
    const seen: string[] = [];
    const target = {
      addEventListener: (t: string) => { seen.push(`+${t}`); },
      removeEventListener: (t: string) => { seen.push(`-${t}`); }
    };
    const jan = new Janitor({ setTimeout: () => 1, clearTimeout: () => undefined });
    jan.on(target, "keydown", () => undefined);
    jan.on(target, "keyup", () => undefined);
    jan.destroy();
    expect(seen.filter((s) => s.startsWith("+"))).toHaveLength(2);
    expect(seen.filter((s) => s.startsWith("-"))).toHaveLength(2);
    expect(jan.pending()).toBe(0);
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

  it("四个入口（闯关 / 双人 / 水果雨 / 外层）各自都有 destroy，且都停掉 rAF", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    expect((src.match(/destroy\(\)\s*\{/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((src.match(/cancelAnimationFrame\(raf\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((src.match(/jan\.destroy\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
