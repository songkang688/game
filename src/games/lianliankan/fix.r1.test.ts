/**
 * 连连看 · 窗口 4 档A · 第 1 轮监督修复员
 *
 * 本轮在这一款上没查出阻断或严重问题。修复员做的是复核：
 *
 *  1. **文案红线扩面**到整个目录（原来只扫 `meta.ts` + `guide.ts`）；
 *  2. **绝不把孩子扔在死局里**：洗牌洗不出来就走构造式重排，重排完一定有得连；
 *  3. **色觉友好**：同一色系的图案一定各配一种轮廓，不靠颜色也分得开；
 *  4. **`destroy` 一件不剩**：`Janitor` 的三类资源全清、清完 `pending()` 归零。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { anyMove, createBoard, fairShuffle } from "./board";
import GUIDE from "./guide";
import {
  Janitor,
  TILE_BGS,
  TILE_FAMILY,
  TILE_SHAPES,
  familyOf,
  shapeOf,
  timeUpWord,
  winWord
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

describe("连连看 · R1 修复 · 全源码红线复核", () => {
  it("扫的是整个目录，board.ts 这类纯逻辑文件也在里面", () => {
    const names = SOURCES.map((s) => s.file);
    for (const must of ["index.ts", "logic.ts", "board.ts", "levels.ts", "meta.ts", "guide.ts"]) {
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

  it("时间到与通关的收场词都只给方法，用过提示也照样夸", () => {
    const up = timeUpWord();
    expect(up).toMatch(/下一局|边角/);
    for (const w of [...NO_BLOOD_WORDS, ...HARSH_WORDS]) expect(up.includes(w)).toBe(false);
    const used = winWord(30, 2);
    expect(used).toMatch(/全连完啦/);
    expect(used).not.toMatch(/可惜|但是|要是/);
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

describe("连连看 · R1 修复 · 绝不把孩子扔在死局里", () => {
  it("随机洗 60 盘，洗完永远至少有一对能连", () => {
    for (let seed = 0; seed < 60; seed++) {
      const rand = mulberry32(seed * 31 + 7);
      const b = createBoard({ rows: 6, cols: 6, kinds: 10, gravity: "none", maxTurns: 2 }, rand);
      const rep = fairShuffle(b, rand, 2);
      expect(rep.ok, `种子 ${seed}`).toBe(true);
      expect(anyMove(b, 2), `种子 ${seed}`).not.toBeNull();
    }
  });

  it("随机洗的次数被掐掉时也不会留死局：直接走构造式重排", () => {
    for (let seed = 0; seed < 30; seed++) {
      const rand = mulberry32(seed * 97 + 3);
      const b = createBoard({ rows: 6, cols: 6, kinds: 12, gravity: "none", maxTurns: 1 }, rand);
      // tries = 0：一次随机洗都不给，逼它走构造式那条路
      const rep = fairShuffle(b, rand, 1, 0);
      expect(rep.constructed, `种子 ${seed}`).toBe(true);
      expect(rep.ok, `种子 ${seed}`).toBe(true);
      expect(anyMove(b, 1), `种子 ${seed}`).not.toBeNull();
    }
  });
});

describe("连连看 · R1 修复 · 色觉友好", () => {
  it("同一色系里的图案一定各配一种轮廓，不靠颜色也分得开", () => {
    const byFamily = new Map<string, string[]>();
    for (let v = 0; v < TILE_BGS.length; v++) {
      const fam = familyOf(v);
      const list = byFamily.get(fam) ?? [];
      list.push(shapeOf(v));
      byFamily.set(fam, list);
    }
    for (const [fam, shapes] of byFamily) {
      expect(new Set(shapes).size, `${fam} 色系里有图案撞了轮廓：${shapes.join("/")}`).toBe(shapes.length);
    }
    expect(TILE_FAMILY).toHaveLength(TILE_BGS.length);
    expect(TILE_SHAPES.length).toBeGreaterThanOrEqual(5);
  });

  it("图案编号越界（负数 / 超大）也取得到底色和轮廓，不会读出 undefined", () => {
    for (const v of [-99, -1, 0, 13, 14, 999]) {
      expect(typeof familyOf(v)).toBe("string");
      expect(TILE_SHAPES).toContain(shapeOf(v));
    }
  });
});

describe("连连看 · R1 修复 · destroy 一件不剩", () => {
  it("定时器 / 计时器 / 监听全清光，pending() 归零", () => {
    const cleared = { timeouts: 0, intervals: 0 };
    const jan = new Janitor({
      setTimeout: () => 1,
      clearTimeout: () => { cleared.timeouts++; },
      setInterval: () => 2,
      clearInterval: () => { cleared.intervals++; }
    });
    let off = 0;
    jan.after(30, () => undefined);
    jan.every(30, () => undefined);
    jan.own(() => { off++; });
    expect(jan.pending()).toBe(3);
    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(jan.dead).toBe(true);
    expect(cleared).toEqual({ timeouts: 1, intervals: 1 });
    expect(off).toBe(1);
  });

  it("连线动画那几段 setTimeout 在 destroy 之后一个都不会回调", () => {
    const pending: Array<() => void> = [];
    let fired = 0;
    const jan = new Janitor({
      setTimeout: (fn) => { pending.push(fn); return pending.length; },
      clearTimeout: () => undefined,
      setInterval: (fn) => { pending.push(fn); return pending.length; },
      clearInterval: () => undefined
    });
    // 折线撑住 → 缩掉 → 收拢，三段接力
    jan.after(220, () => { fired++; });
    jan.after(180, () => { fired++; });
    jan.every(1000, () => { fired++; });
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
    expect(ok).toBe(2);
    expect(jan.pending()).toBe(0);
  });

  it("三个入口（闯关 / 无尽 / 外层）各自都有 destroy，且都收在 jan.destroy() 上", () => {
    const src = SOURCES.find((s) => s.file === "index.ts")!.text;
    expect((src.match(/destroy\(\)\s*\{/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((src.match(/jan\.destroy\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("mode?.destroy()");
  });
});
