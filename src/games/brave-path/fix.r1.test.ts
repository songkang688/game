/**
 * 勇者之路 · 窗口 4 档A · 第 1 轮监督修复员
 *
 * 本轮在这一款上没查出阻断或严重问题，修复员做的是三件复核：
 *
 *  1. **文案红线扩面**：把商标 / 措辞黑名单从 `meta.ts` + `guide.ts` 扩到整个目录。
 *     扩面之后当场逮到两条：攻略里两次写「血量」，而这一款的规矩写在 `combat.ts` 开头——
 *     「全篇没有流血、受伤、死亡的说法，生命值叫『星芒』」。攻略自己破了自己的规矩，本轮改掉。
 *  2. **存档 key 只增不改**：`SAVE_KEY` 钉死，迁移只补字段不换 key。
 *  3. **`destroy` 一件不剩**：`Cleanup` 的四类资源全清、清完 `pending()` 归零。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Cleanup } from "./cleanup";
import GUIDE from "./guide";
import { HERO_NAME, RIVAL_NAME, SAVE_KEY, defaultSave, loadSave, migrateSave } from "./logic";

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

/** 这一款自己立的规矩：生命值叫星芒，全篇不见血、不受伤、不死亡 */
const NO_BLOOD_WORDS = ["血量", "流血", "出血", "扣血", "掉血", "死亡", "死了", "尸", "杀死", "受伤"];
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

describe("勇者之路 · R1 修复 · 全源码红线复核", () => {
  it("扫的是整个目录，index / logic / combat / maze / power / levels 一个不漏", () => {
    const names = SOURCES.map((s) => s.file);
    for (const must of ["index.ts", "logic.ts", "combat.ts", "maze.ts", "power.ts", "levels.ts", "guide.ts", "meta.ts"]) {
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

  it("攻略正文里一处「血量」都不剩，生命值一律叫星芒（本轮修掉的两条）", () => {
    for (const line of guideText()) {
      for (const w of NO_BLOOD_WORDS) {
        expect(line.includes(w), `攻略里出现了「${w}」：${line}`).toBe(false);
      }
    }
    expect(guideText().some((l) => l.includes("星芒"))).toBe(true);
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

  it("角色只用朵朵 / 星星与原创配角", () => {
    expect(HERO_NAME).toBe("朵朵");
    expect(RIVAL_NAME).toBe("星星");
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
});

describe("勇者之路 · R1 修复 · 存档 key 只增不改", () => {
  it("SAVE_KEY 钉死在 1.1 的那一个", () => {
    expect(SAVE_KEY).toBe("yiduo-yixing.bravepath");
    const keys = SOURCES.flatMap(({ text }) => text.match(/"yiduo-yixing\.[a-z.]+"/g) ?? []);
    expect(new Set(keys)).toEqual(new Set(['"yiduo-yixing.bravepath"']));
  });

  it("旧存档读进来只补字段，不丢已有进度", () => {
    const old = { level: 12, coins: 300, exp: 40 };
    const s = migrateSave(old);
    expect(s.level).toBe(12);
    expect(s.coins).toBe(300);
    expect(s.exp).toBe(40);
    // 新字段有默认值兜住，不会读出 undefined
    expect(Array.isArray(s.bag)).toBe(true);
    expect(Array.isArray(s.loadout)).toBe(true);
    expect(typeof s.gear.weapon).toBe("string");
  });

  it("没有存档 / 存档坏了都退回默认档，绝不抛异常", () => {
    expect(() => loadSave(null)).not.toThrow();
    expect(loadSave(null).level).toBe(defaultSave().level);
    const broken = { getItem: () => "{ 这不是 JSON", setItem: () => undefined };
    expect(() => loadSave(broken)).not.toThrow();
    expect(loadSave(broken).level).toBe(defaultSave().level);
  });
});

describe("勇者之路 · R1 修复 · destroy 一件不剩", () => {
  it("定时器 / 循环 / rAF / 监听全清光，pending() 归零", () => {
    const cleared = { timeouts: 0, intervals: 0, frames: 0 };
    const c = new Cleanup({
      setTimeout: () => 1,
      clearTimeout: () => { cleared.timeouts++; },
      setInterval: () => 2,
      clearInterval: () => { cleared.intervals++; },
      requestAnimationFrame: () => 3,
      cancelAnimationFrame: () => { cleared.frames++; }
    });
    let off = 0;
    c.after(20, () => undefined);
    c.every(20, () => undefined);
    c.frame(() => undefined);
    c.own(() => { off++; });
    expect(c.pending()).toBe(4);
    c.destroy();
    expect(c.pending()).toBe(0);
    expect(c.dead).toBe(true);
    expect(cleared).toEqual({ timeouts: 1, intervals: 1, frames: 1 });
    expect(off).toBe(1);
  });

  it("destroy 之后再触发的回调一概不执行", () => {
    const pending: Array<() => void> = [];
    let fired = 0;
    const c = new Cleanup({
      setTimeout: (fn) => { pending.push(fn); return 1; },
      clearTimeout: () => undefined,
      setInterval: (fn) => { pending.push(fn); return 2; },
      clearInterval: () => undefined
    });
    c.after(5, () => { fired++; });
    c.every(5, () => { fired++; });
    c.destroy();
    for (const fn of pending) fn();
    expect(fired).toBe(0);
  });

  it("监听挂上去就一定摘得下来，摘的时候某条抛错也不影响别的", () => {
    const seen: string[] = [];
    const target = {
      addEventListener: (t: string) => { seen.push(`+${t}`); },
      removeEventListener: (t: string) => { seen.push(`-${t}`); }
    };
    const c = new Cleanup({ setTimeout: () => 1, clearTimeout: () => undefined });
    c.on(target, "keydown", () => undefined);
    c.own(() => { throw new Error("摘不掉"); });
    expect(() => c.destroy()).not.toThrow();
    expect(seen).toEqual(["+keydown", "-keydown"]);
    expect(c.pending()).toBe(0);
  });

  it("每一个入口都收在 cleanup.destroy() 上，子界面也会被顺手带走", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    expect((src.match(/cleanup\.destroy\(\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(src).toContain("child?.destroy()");
    expect(src).toContain("outer.destroy()");
  });
});
