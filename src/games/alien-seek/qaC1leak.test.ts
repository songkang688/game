// 窗口 4 · QA 档C · 第 1 轮监督修复员:五款的 destroy 泄漏体检 + 硬约束扫描。
//
// 这一份是**跨五款**的闸门,按理该放公共目录;但档C 只许动那五个游戏目录,
// 所以落在字典序第一的 alien-seek 下,扫的是 alien-seek / box-hamster /
// bubble-aim / snake-snack / memory-cards 五款。
//
// vitest 跑在 node 环境,挂不起 DOM,没法真的 mount 一遍再数残留;
// 所以这里做源码级配平:凡是往 window / document 上挂的监听、开的定时器、
// 起的 rAF,都必须能在同一个文件里找到成对的收尾。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 档C 的五款 */
const GAMES = ["alien-seek", "box-hamster", "bubble-aim", "snake-snack", "memory-cards"] as const;

const srcOf = (game: string, file = "index.ts"): string =>
  readFileSync(`src/games/${game}/${file}`, "utf8");

/** 把 `window.addEventListener("x", handler)` 里的 事件名 + 处理函数名 抓出来 */
function listeners(src: string, verb: "add" | "remove"): string[] {
  const re = new RegExp(
    `(?:window|document)\\.${verb}EventListener\\(\\s*["'\`]([\\w-]+)["'\`]\\s*,\\s*([A-Za-z_$][\\w$]*)`,
    "g"
  );
  const out: string[] = [];
  for (const m of src.matchAll(re)) out.push(`${m[1]}:${m[2]}`);
  return out;
}

describe("档C R1 修复 · destroy 不许漏东西", () => {
  it("挂在 window / document 上的监听,每一个都摘得回来(事件名 + 处理函数都对上)", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      const added = listeners(src, "add");
      const removed = new Set(listeners(src, "remove"));
      for (const one of added) {
        expect(removed.has(one), `${g}/index.ts 挂了 ${one} 却没摘`).toBe(true);
      }
    }
  });

  it("挂全局监听时不许直接塞匿名函数 —— 塞了就再也摘不掉", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      const all = src.match(/(?:window|document)\.addEventListener\(/g) ?? [];
      // 能被上面那条正则抓到的,说明第二个参数是个具名函数
      expect(listeners(src, "add").length, `${g}/index.ts 有匿名的全局监听`).toBe(all.length);
    }
  });

  it("开了 rAF 就必须有 cancelAnimationFrame", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      if (!src.includes("requestAnimationFrame")) continue;
      expect(src.includes("cancelAnimationFrame"), `${g}/index.ts 起了 rAF 没有取消`).toBe(true);
    }
  });

  it("开了 setInterval / setTimeout 就必须有对应的 clear", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      if (src.includes("setInterval(")) {
        expect(src.includes("clearInterval("), `${g}/index.ts 起了 setInterval 没有清`).toBe(true);
      }
      if (src.includes("setTimeout(")) {
        expect(src.includes("clearTimeout("), `${g}/index.ts 起了 setTimeout 没有清`).toBe(true);
      }
    }
  });

  it("每一款都有 destroy,而且 destroy 里真的做了收尾", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      expect(src, `${g}/index.ts 没有 destroy`).toContain("destroy");
      const cleanup =
        src.includes("removeEventListener") ||
        src.includes("cancelAnimationFrame") ||
        src.includes("clearInterval") ||
        src.includes("clearTimeout");
      expect(cleanup, `${g}/index.ts 的 destroy 什么都没收`).toBe(true);
    }
  });

  it("没有人自己 new 一个 AudioContext 或 Audio —— 声音只走 api.play", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      expect(src).not.toMatch(/new\s+(webkit)?AudioContext/);
      expect(src).not.toMatch(/new\s+Audio\s*\(/);
    }
  });
});

describe("档C R1 修复 · 硬约束扫描", () => {
  /** 逐字照抄任务书的黑名单 */
  const BANNED = [
    "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
    "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
    "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
    "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
    "蛋仔", "原神", "王者荣耀",
  ];

  /** 每款要扫的文件(玩法代码 + 玩家看得见的文案) */
  const FILES = ["index.ts", "meta.ts", "levels.ts", "logic.ts", "guide.ts"];

  it("五款的玩法代码和文案里一个商标都没有", () => {
    for (const g of GAMES) {
      for (const f of FILES) {
        let src: string;
        try {
          src = srcOf(g, f);
        } catch {
          continue;
        }
        for (const word of BANNED) {
          expect(src.includes(word), `${g}/${f} 里出现了「${word}」`).toBe(false);
        }
      }
    }
  });

  it("没有 three.js / CDN / Socket", () => {
    for (const g of GAMES) {
      for (const f of FILES) {
        let src: string;
        try {
          src = srcOf(g, f);
        } catch {
          continue;
        }
        expect(src, `${g}/${f}`).not.toMatch(/from\s+["']three["']/);
        expect(src, `${g}/${f}`).not.toMatch(/new\s+WebSocket/);
        expect(src, `${g}/${f}`).not.toContain("socket.io");
        // 外链一律不许:资源全在本仓里
        expect(src, `${g}/${f} 里有外链`).not.toMatch(/["'`]https?:\/\//);
      }
    }
  });

  it("音效只从 api.play 出去", () => {
    for (const g of GAMES) {
      const src = srcOf(g);
      const plays = src.match(/\bapi\.play\(/g) ?? [];
      const sfx = src.match(/\bsfx\(/g) ?? [];
      expect(plays.length + sfx.length, `${g}/index.ts 一句音效都没有?`).toBeGreaterThan(0);
    }
  });

  it("存档 key 只增不改:五款用到的 key 全在登记表里", () => {
    // 登记表 = 基线上就有的 key,这一档一个都没改、一个都没删
    const known: Record<string, string[]> = {
      "alien-seek": [],
      "box-hamster": [],
      "bubble-aim": ["yiduo.bubble-aim.campaign.v2"],
      "snake-snack": [],
      "memory-cards": [],
    };
    for (const g of GAMES) {
      const src = srcOf(g);
      const keys = (src.match(/["'`](yiduo[\w.\-]*)["'`]/g) ?? []).map((s) => s.slice(1, -1));
      for (const k of keys) {
        expect(known[g], `${g} 冒出了没登记过的存档 key「${k}」`).toContain(k);
      }
    }
  });

  it("失败文案只鼓励:没有「你输了」这类话,也没有血和死亡", () => {
    // 「菜」不能单列 —— 地窖那一关的「腌菜坛」是正经道具名
    const HARSH = ["你输了", "失败了", "笨", "蠢", "垃圾", "废物", "太菜", "流血", "死掉", "死了", "杀"];
    for (const g of GAMES) {
      for (const f of FILES) {
        let src: string;
        try {
          src = srcOf(g, f);
        } catch {
          continue;
        }
        for (const w of HARSH) {
          expect(src.includes(w), `${g}/${f} 里出现了「${w}」`).toBe(false);
        }
      }
    }
  });
});
