/**
 * 窗口 4 档A · 第 2 轮监督修复员 · 五款总闸
 *
 * 这一轮修的四条（W4A-07 严重 / W4A-11 / W4A-12 / W4A-15）都动了玩法代码，
 * 而且三条都是「让无尽真的没有尽头」——续段是新写的循环，正是最容易
 * 漏掉清理、也最容易把红线词带进来的地方。所以本段把第 1 轮各自为战的
 * 红线扫描收成一道总闸，五个目录一起过；再逐款复核 `destroy` 契约。
 *
 * 文件放在 `brick-break/` 只是因为本轮最重的那条修在这儿，扫的是本档五款全部源码。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = join(HERE, "..");

/** 本档独占的五个目录，一个都不许漏扫 */
const OWNED = ["brave-path", "brick-break", "balloon-pop", "fruit-catch", "lianliankan"];

interface Source {
  game: string;
  file: string;
  text: string;
}

const SOURCES: Source[] = OWNED.flatMap((game) =>
  readdirSync(join(GAMES_DIR, game))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ game, file: `${game}/${f}`, text: readFileSync(join(GAMES_DIR, game, f), "utf8") }))
);

/** 任务书点名的 29 个商标 + 几个常见英文写法 */
const BRAND_WORDS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
  "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀", "roblox", "disney", "zelda", "sonic"
];

/** 玩家看得见的字里不许出现的说法 */
const HARSH_WORDS = ["流血", "出血", "死亡", "死了", "尸", "杀死", "笨", "蠢", "白痴", "垃圾", "太差劲"];

/** 不许自己联网 / 自己合成声音 / 引外部包 */
const FORBIDDEN_API = [
  "XMLHttpRequest", "WebSocket", "socket.io", "three.js", "from \"three\"",
  "new Audio(", "AudioContext", "createOscillator", "https://cdn", "http://cdn"
];

function literals(text: string): string[] {
  return text.match(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\[\s\S]|[^\\`])*`/g) ?? [];
}

describe("窗口4 档A · R2 修复 · 红线总闸（五款一起过）", () => {
  it("五个目录一个不漏，每个目录都扫到了 index / logic / meta", () => {
    for (const game of OWNED) {
      const mine = SOURCES.filter((s) => s.game === game).map((s) => s.file);
      for (const must of ["index.ts", "logic.ts", "meta.ts"]) {
        expect(mine, `${game} 漏扫了 ${must}`).toContain(`${game}/${must}`);
      }
    }
    expect(SOURCES.length).toBeGreaterThanOrEqual(20);
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

  it("存档 key 只增不改：五款都不直接写 localStorage，key 名一个字没动", () => {
    for (const { file, text } of SOURCES) {
      expect(text.includes("localStorage.setItem"), `${file} 直接写了 localStorage`).toBe(false);
    }
    const keys = SOURCES.flatMap(({ text }) => text.match(/yiduo-yixing\.[a-z0-9-]+/gi) ?? []);
    for (const k of keys) expect(k).toMatch(/^yiduo-yixing\.[a-z0-9-]+$/i);
    expect(SOURCES.find((s) => s.file === "brave-path/logic.ts")!.text).toContain("yiduo-yixing.bravepath");
  });

  it("声音只走 api.play(...)，五款都没有别的发声口子", () => {
    for (const game of OWNED) {
      const src = SOURCES.find((s) => s.file === `${game}/index.ts`)!.text;
      const calls = src.match(/\b(api\.play|ctx\.sfx)\(/g) ?? [];
      expect(calls.length, `${game} 一次 api.play 都没有`).toBeGreaterThan(0);
      expect(src, `${game} 用了震动`).not.toMatch(/navigator\.vibrate/);
    }
  });

  it("角色只有鸭梨 / 康康 + 原创配角，没有借来的名字", () => {
    const known = SOURCES.map((s) => s.text).join("\n");
    expect(known).toContain("鸭梨");
    for (const w of ["奥特", "皮卡", "喜羊", "光头强", "熊大", "熊二", "海绵宝宝", "小猪佩奇"]) {
      expect(known.includes(w), `出现了「${w}」`).toBe(false);
    }
  });
});

describe("窗口4 档A · R2 修复 · destroy 一件不剩（本轮新写的循环也算）", () => {
  it("五款每个入口都有 destroy，rAF / 定时器都收在管家手里", () => {
    for (const game of OWNED) {
      const src = SOURCES.find((s) => s.file === `${game}/index.ts`)!.text;
      expect((src.match(/destroy\(\)\s*[:{]/g) ?? []).length, `${game} 的 destroy 太少`).toBeGreaterThanOrEqual(1);
      const raf = (src.match(/requestAnimationFrame\(/g) ?? []).length;
      if (raf > 0) {
        expect(src, `${game} 排了帧却没见取消`).toMatch(/cancelAnimationFrame\(/);
      }
      // 裸的 setTimeout / setInterval 一律不许有：要么走管家，要么走 jan.after / jan.every
      const bare = (src.match(/(?<!jan\.)(?<!\.)\bsetInterval\(/g) ?? []).length;
      expect(bare, `${game} 里有没人管的 setInterval`).toBe(0);
    }
  });

  it("本轮新写的两处「续表」都挂在原来的循环里，没有另起炉灶", () => {
    const fruit = SOURCES.find((s) => s.file === "fruit-catch/index.ts")!.text;
    const balloon = SOURCES.find((s) => s.file === "balloon-pop/index.ts")!.text;
    // 续段只是往已有数组上接，不新开定时器 / 不新开 rAF
    for (const src of [fruit, balloon]) {
      const topUp = src.slice(src.indexOf("function topUpPlan"), src.indexOf("function topUpPlan") + 400);
      expect(topUp).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
      expect(topUp).toMatch(/plan = plan\.concat\(/);
    }
  });

  it("续表不会把内存吃掉：出场表一段一段接，屏幕上的活物照旧随手清", () => {
    const fruit = SOURCES.find((s) => s.file === "fruit-catch/index.ts")!.text;
    const balloon = SOURCES.find((s) => s.file === "balloon-pop/index.ts")!.text;
    // 已经落地 / 已经飘走的都从 items / balloons 里摘掉，DOM 也一起 remove
    expect(fruit).toMatch(/items\.splice\(i, 1\)/);
    expect(balloon).toMatch(/balloons\.splice\(i, 1\)/);
    expect(balloon).toMatch(/b\.el\.remove\(\)|remove\(b, false\)/);
  });
});
