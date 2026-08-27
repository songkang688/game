import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { meta } from "./meta";
import guide from "./guide";
import {
  CHAPTERS,
  STARTER_BAG,
  chapterIndexOf,
  endlessConfig,
  goalLine,
  levelConfig,
  levelWon,
  starsFor,
  startBoard,
  versusConfig
} from "./levels";
import { COLS, ROWS, columnHeights, countHoles, filledCount, maxHeight } from "./board";
import { PIECE_IDS } from "./pieces";
import { MAX_LEVEL } from "./score";
import { AI_TIERS, solveLevel } from "./ai";

/** 面向孩子的产品红线:这些词一个都不许出现 */
const BRANDS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "俄罗斯方块",
  "Tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "Minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "Pac-Man",
  "吃豆人",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀"
];

const SOURCES = ["meta.ts", "index.ts", "pieces.ts", "srs.ts", "board.ts", "score.ts", "levels.ts", "ai.ts", "guide.ts"].map(
  (f) => ({ f, text: readFileSync(new URL(`./${f}`, import.meta.url), "utf8") })
);

const src = (f: string): string => SOURCES.find((s) => s.f === f)!.text;

describe("block-drop · meta", () => {
  it("id / 标题 / 分类都按规格填", () => {
    expect(meta.id).toBe("block-drop");
    expect(meta.title).toBe("方块叠叠乐");
    expect(meta.emoji).toBe("🧱");
    expect(meta.category).toBe("casual");
    expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(meta.levels).toBe(TOTAL_LEVELS);
  });

  it("四种模式都声明了,手游端游都能玩", () => {
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.platform).toBe("both");
  });

  it("meta 是纯数据,不 import 任何玩法", () => {
    expect(src("meta.ts")).not.toMatch(/^import .*from "\.\/(index|levels|ai|board|score|pieces|srs)"/m);
  });

  it("一句话简介写清了核心玩法,而且够短", () => {
    expect(meta.blurb).toContain("行");
    expect(meta.blurb.length).toBeLessThan(60);
  });
});

describe("block-drop · 188 关章节", () => {
  it("八章加起来正好 188", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
  });

  it("章节数与关数按规格切分", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每一章都有名字、图标和给孩子看的说明", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(8);
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("关号能对到正确的章", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(chapterIndexOf(9999)).toBe(7);
  });
});

describe("block-drop · 关卡配置", () => {
  it("同一关每次进来都一样", () => {
    expect(levelConfig(99)).toEqual(levelConfig(99));
    expect(startBoard(99)).toEqual(startBoard(99));
  });

  it("关号越界会被夹回合法范围", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(9999).level).toBe(TOTAL_LEVELS - 1);
    expect(levelConfig(Number.NaN).level).toBe(0);
  });

  it("每一关的 seed 都不一样,重开一次出块顺序还是那一串", () => {
    const seeds = new Set<number>();
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) seeds.add(levelConfig(lv).seed);
    expect(seeds.size).toBe(TOTAL_LEVELS);
  });

  it("入门章只出三种好摆的块,之后七种齐全", () => {
    expect(STARTER_BAG).toEqual(["O", "I", "L"]);
    expect(levelConfig(0).bag).toEqual(STARTER_BAG);
    expect(levelConfig(23).bag).toEqual(STARTER_BAG);
    expect(levelConfig(24).bag).toEqual([...PIECE_IDS]);
    expect(levelConfig(187).bag).toEqual([...PIECE_IDS]);
  });

  it("八章各教一手,顺序是:熟手 → 七块 → 暂存 → 踢墙 → 满四行 → 转身 → 连击 → 综合", () => {
    expect(levelConfig(0).skill).toBe("none");
    expect(levelConfig(30).skill).toBe("none");
    expect(levelConfig(50).skill).toBe("hold");
    expect(levelConfig(80).skill).toBe("kick");
    expect(levelConfig(100).skill).toBe("quad");
    expect(levelConfig(125).skill).toBe("tspin");
    expect(levelConfig(150).skill).toBe("combo");
    expect(levelConfig(187).skill).toBe("quad");
  });

  it("目标行数和块数预算一章比一章紧,而且预算够摆完目标", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const c = levelConfig(lv);
      expect(c.targetLines).toBeGreaterThanOrEqual(3);
      expect(c.targetLines).toBeLessThanOrEqual(12);
      expect(c.pieceBudget).toBeGreaterThan(c.targetLines * 2);
      expect(c.startLevel).toBeGreaterThanOrEqual(0);
      expect(c.startLevel).toBeLessThanOrEqual(MAX_LEVEL);
    }
    expect(levelConfig(187).targetLines).toBeGreaterThan(levelConfig(0).targetLines);
    expect(levelConfig(187).startLevel).toBeGreaterThan(levelConfig(0).startLevel);
  });

  it("连击章才有连击目标,别的章是 0", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const c = levelConfig(lv);
      if (c.chapter === 6) expect(c.comboTarget).toBeGreaterThanOrEqual(2);
      else expect(c.comboTarget).toBe(0);
    }
  });

  it("第 1 关是空场地,后面的初始堆形不超过一半高、也不带死洞", () => {
    expect(filledCount(startBoard(0))).toBe(0);
    expect(filledCount(startBoard(23))).toBe(0);
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const b = startBoard(lv);
      expect(b).toHaveLength(ROWS);
      expect(b[0]).toHaveLength(COLS);
      expect(maxHeight(b)).toBeLessThanOrEqual(6);
      // 只有小凸转身那一章故意留屋檐,别的章不许一开局就带洞
      if (chapterIndexOf(lv) === 5) expect(countHoles(b)).toBeLessThanOrEqual(3);
      else expect(countHoles(b)).toBe(0);
    }
  });

  it("满四行那一章一开局就有一口四格深的井", () => {
    for (const lv of [96, 100, 117]) {
      const h = columnHeights(startBoard(lv));
      const lowest = Math.min(...h);
      const highest = Math.max(...h);
      expect(highest - lowest).toBeGreaterThanOrEqual(4);
    }
  });

  it("第 1 / 100 / 188 关都开得起来,目标也说得清", () => {
    for (const lv of [0, 99, 187]) {
      const c = levelConfig(lv);
      expect(goalLine(c)).toContain(`消 ${c.targetLines} 行`);
      expect(goalLine(c)).toContain(`${c.pieceBudget} 块`);
      expect(goalLine(c).length).toBeGreaterThan(8);
    }
  });
});

describe("block-drop · 胜负与评星", () => {
  it("叠到顶就不算过,消够行才算过", () => {
    const cfg = levelConfig(10);
    expect(levelWon(cfg, { lines: cfg.targetLines, toppedOut: true })).toBe(false);
    expect(levelWon(cfg, { lines: cfg.targetLines, toppedOut: false })).toBe(true);
    expect(levelWon(cfg, { lines: cfg.targetLines - 1, toppedOut: false })).toBe(false);
  });

  it("没达标只给一星", () => {
    const cfg = levelConfig(10);
    expect(starsFor(cfg, { lines: 0, used: 1, skillDone: true, bestCombo: 9 })).toBe(1);
  });

  it("达标又省块又打出那一手才三星", () => {
    const cfg = levelConfig(50);
    const thrifty = Math.round(cfg.pieceBudget * 0.7);
    expect(starsFor(cfg, { lines: cfg.targetLines, used: thrifty, skillDone: true, bestCombo: 0 })).toBe(3);
    expect(starsFor(cfg, { lines: cfg.targetLines, used: thrifty, skillDone: false, bestCombo: 0 })).toBe(2);
    expect(starsFor(cfg, { lines: cfg.targetLines, used: cfg.pieceBudget, skillDone: true, bestCombo: 0 })).toBe(2);
    expect(starsFor(cfg, { lines: cfg.targetLines, used: cfg.pieceBudget, skillDone: false, bestCombo: 0 })).toBe(1);
  });

  it("连击章的第三颗星看连击长度", () => {
    const cfg = levelConfig(150);
    const thrifty = Math.round(cfg.pieceBudget * 0.7);
    expect(starsFor(cfg, { lines: cfg.targetLines, used: thrifty, skillDone: false, bestCombo: cfg.comboTarget })).toBe(3);
    expect(
      starsFor(cfg, { lines: cfg.targetLines, used: thrifty, skillDone: true, bestCombo: cfg.comboTarget - 1 })
    ).toBe(2);
  });
});

describe("block-drop · 无尽与对战", () => {
  it("马拉松没有终点,竞速是消满 40 行", () => {
    expect(endlessConfig("marathon").targetLines).toBe(0);
    expect(endlessConfig("sprint").targetLines).toBe(40);
    for (const k of ["marathon", "sprint"] as const) {
      expect(endlessConfig(k).bag).toEqual([...PIECE_IDS]);
      expect(endlessConfig(k).startLevel).toBe(0);
    }
  });

  it("对战档位越高起手掉得越快", () => {
    for (const t of AI_TIERS) expect(versusConfig(t).tier).toBe(t);
    expect(versusConfig("hell").startLevel).toBeGreaterThan(versusConfig("pro").startLevel);
    expect(versusConfig("pro").startLevel).toBeGreaterThan(versusConfig("rookie").startLevel);
    expect(versusConfig("normal").startLevel).toBe(0);
  });
});

describe("block-drop · 188 关都有解", () => {
  it("每一关的初始堆形都放得下新块,不会一进来就结束", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      expect(maxHeight(startBoard(lv))).toBeLessThan(ROWS - 4);
    }
  });

  it("求解器把 188 关一关一关走通,块数都在预算之内", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const cfg = levelConfig(lv);
      const r = solveLevel(startBoard(lv), cfg.seed, { lines: cfg.targetLines, pieces: cfg.pieceBudget }, "hell", cfg.bag);
      if (!r.ok || r.toppedOut || r.used > cfg.pieceBudget) {
        bad.push(`第 ${lv + 1} 关(要 ${cfg.targetLines} 行,消了 ${r.lines} 行,用了 ${r.used}/${cfg.pieceBudget} 块)`);
      }
    }
    expect(bad).toEqual([]);
  }, 900000);
});

describe("block-drop · 攻略手册", () => {
  it("挂在本款上,八章一章不落", () => {
    expect(guide.gameId).toBe("block-drop");
    expect(guide.entries).toHaveLength(8);
    expect(guide.general.length).toBeGreaterThanOrEqual(4);
  });

  it("每一章的区间连起来正好盖满 188 关", () => {
    let expectFrom = 1;
    for (const e of guide.entries) {
      expect(e.from).toBe(expectFrom);
      expect(e.to).toBeGreaterThanOrEqual(e.from);
      expect(e.tips.length).toBeGreaterThanOrEqual(3);
      expectFrom = e.to + 1;
    }
    expect(expectFrom - 1).toBe(188);
  });

  it("攻略区间和章节切分对得上", () => {
    let from = 1;
    CHAPTERS.forEach((c, i) => {
      expect(guide.entries[i].from).toBe(from);
      expect(guide.entries[i].to).toBe(from + c.size - 1);
      from += c.size;
    });
  });

  it("把「别造洞」和「暂存只能用一次」写进了总纲", () => {
    const text = guide.general.join("");
    expect(text).toContain("洞");
    expect(text).toContain("暂存");
  });
});

describe("block-drop · 产品红线", () => {
  it("全部源码扫不出任何商标", () => {
    for (const { f, text } of SOURCES) {
      for (const brand of BRANDS) {
        expect(`${f}:${text.includes(brand)}`).toBe(`${f}:false`);
      }
    }
  });

  it("攻略、章节说明和块名里也不出现商标", () => {
    const text = JSON.stringify(guide) + JSON.stringify(CHAPTERS) + JSON.stringify(meta);
    for (const brand of BRANDS) expect(text).not.toContain(brand);
  });

  it("不写死亡和流血,结束只鼓励", () => {
    const text = JSON.stringify(guide) + JSON.stringify(CHAPTERS);
    for (const bad of ["死", "血", "尸", "杀"]) expect(text).not.toContain(bad);
    expect(guide.entries.map((e) => e.tips.join("")).join("")).toContain("也没关系");
  });

  it("离线可玩:不引 three.js、不连网、不开 socket", () => {
    for (const { f, text } of SOURCES) {
      expect(`${f}:${/three|Socket|WebSocket|fetch\(|XMLHttpRequest/.test(text)}`).toBe(`${f}:false`);
    }
  });

  it("音效只走 api.play,不自己造 AudioContext", () => {
    expect(src("index.ts")).not.toContain("new AudioContext");
    expect(src("index.ts")).not.toContain("new Audio(");
  });

  it("index.ts 顶部就把 meta 透出来,并导出 mount", () => {
    expect(src("index.ts").slice(0, 200)).toContain("export { meta }");
    expect(src("index.ts")).toContain("export function mount(");
  });

  it("destroy 会把监听、定时器和 rAF 全清掉", () => {
    const index = src("index.ts");
    const adds = (index.match(/window\.addEventListener/g) ?? []).length;
    const removes = (index.match(/window\.removeEventListener/g) ?? []).length;
    expect(removes).toBe(adds);
    const canvasAdds = (index.match(/canvas\.addEventListener/g) ?? []).length;
    const canvasRemoves = (index.match(/canvas\.removeEventListener/g) ?? []).length;
    expect(canvasRemoves).toBe(canvasAdds);
    expect(index).toContain("cancelAnimationFrame(raf)");
    expect(index).toContain("clearTimeout(t)");
  });

  it("双人键位齐全:朵朵 WASD+F/G,星星 方向键 +L/K,Esc 暂停", () => {
    const index = src("index.ts");
    for (const key of [
      '=== "a"',
      '=== "d"',
      '=== "s"',
      '=== "w"',
      '=== "f"',
      '=== "g"',
      '=== "l"',
      '=== "k"',
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "ArrowUp",
      '"Escape"'
    ]) {
      expect(index).toContain(key);
    }
  });

  it("手机有触屏等价:七个大钮 + 滑动手势,热区不小于 44px", () => {
    const index = src("index.ts");
    expect(index).toContain("pointerdown");
    expect(index).toContain("pointermove");
    for (const label of ["◀", "▶", "↻", "↺", "▼", "⤓", "📦"]) expect(index).toContain(label);
    expect(index).toContain("min-height:46px");
  });

  it("360px 窄屏有专门的兜底:字号不小于 13px,每格不小于 22px", () => {
    const index = src("index.ts");
    expect(index).toContain("@media (max-width:360px)");
    const sizes = [...index.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(2);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
    expect(index).toContain("Math.max(22, Math.round(opts.cellPx))");
    expect(index).toContain("overflow-wrap:anywhere");
  });

  it("尊重 prefers-reduced-motion:关掉抖动但保留塌落顺序", () => {
    const index = src("index.ts");
    // 这一款是纯画布,减弱动效判定在 JS 里,走共享的 prefersReducedMotion(不再各抄一份 matchMedia)
    expect(index).toContain('import { prefersReducedMotion } from "../../engine/view25d"');
    expect(index).toContain("const soft = prefersReducedMotion()");
    expect(index).not.toContain("matchMedia");
    expect(index).toContain("CLEAR_ANIM_SEC");
  });

  it("存档只用本款自己的进度,不碰平台那几个 key", () => {
    const index = src("index.ts");
    expect(index).toContain("save.getGameProgress(meta.id)");
    expect(index).not.toContain("fav.v1");
    expect(index).not.toContain("collection.v1");
  });
});
