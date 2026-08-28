/**
 * 全库守门:模式条的 `[hidden]` 必须压得住自家的 `display:flex`。
 *
 * 三人组第 4/5 轮走查抓的同一族病灶(r4 C-1 → r5 收尾):进「对战/无尽/双人」
 * 模式后 `bar.hidden = true` 被 `.xx-modebar{display:flex}` 顶掉,残留条
 * 40–154px 高仍杵在屏上(box-hamster 40 / prince-princess 82 / sudoku-petal 154)。
 * 逐款补测试补了两轮还在漏,这里改成一份全库扫描:
 * 凡 src/games 下各款 index.ts / view.ts 的 CSS 模板串里,类名含 modebar / bar-modes
 * 且规则带 `display:flex` 的,同文件必须有 `.同名[hidden]{…display:none…}` 兜底
 * (群组选择器算数,shoot-range 就是合写的)。新游戏进库也逃不掉这道闸。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GAMES_DIR = new URL("..", import.meta.url).pathname;

function gameSourceFiles(): string[] {
  const out: string[] = [];
  for (const dir of readdirSync(GAMES_DIR)) {
    const full = join(GAMES_DIR, dir);
    if (!statSync(full).isDirectory() || dir === "__tests__") continue;
    for (const name of ["index.ts", "view.ts"]) {
      const file = join(full, name);
      try {
        if (statSync(file).isFile()) out.push(file);
      } catch {
        // 没这个文件就跳过
      }
    }
  }
  return out.sort();
}

/** 文件里所有「display:flex 的 modebar 族类名」 */
function flexModebarClasses(src: string): string[] {
  const found = new Set<string>();
  // 规则块允许跨行;CSS 模板串里没有嵌套花括号(${} 里也没有),[^}]* 够用
  const re = /\.([a-z0-9-]*(?:modebar|bar-modes))\{([^}]*)\}/gs;
  for (const m of src.matchAll(re)) {
    if (m[2].replace(/\s+/g, "").includes("display:flex")) found.add(m[1]);
  }
  return [...found];
}

/** `.cls[hidden]` 是否落在某条 display:none 规则的选择器里(含群组合写) */
function hiddenRuleCovers(src: string, cls: string): boolean {
  const esc = cls.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const re = new RegExp(`\\.${esc}\\[hidden\\][^{}]*\\{[^}]*display:none`, "s");
  return re.test(src);
}

describe("模式条 [hidden] 全库守门(r5 C-1 收尾)", () => {
  const files = gameSourceFiles();

  it("扫得到游戏源文件,守门没有空转", () => {
    expect(files.length).toBeGreaterThan(50);
    const withBar = files.filter((f) => flexModebarClasses(readFileSync(f, "utf8")).length > 0);
    // 库里至少十几款带模式条,一款都扫不出来说明匹配口径坏了
    expect(withBar.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files)("%s 的 flex 模式条都有 [hidden]{display:none} 兜底", (file) => {
    const src = readFileSync(file, "utf8");
    for (const cls of flexModebarClasses(src)) {
      expect(hiddenRuleCovers(src, cls), `.${cls} 缺 .${cls}[hidden]{display:none} 兜底`).toBe(true);
    }
  });

  it("本轮点名的三款收尾到位(box-hamster / prince-princess / sudoku-petal)", () => {
    const named: Array<[string, string]> = [
      ["box-hamster/index.ts", "bh-modebar"],
      ["prince-princess/index.ts", "pcp-modebar"],
      ["sudoku-petal/index.ts", "sp-modebar"],
    ];
    for (const [rel, cls] of named) {
      const src = readFileSync(join(GAMES_DIR, rel), "utf8");
      expect(flexModebarClasses(src)).toContain(cls);
      expect(hiddenRuleCovers(src, cls), `${rel} 的 .${cls} 缺兜底`).toBe(true);
    }
  });

  it("prince-princess 进关收模式条、离关放回来(侧模式开着不替它放)", () => {
    const src = readFileSync(join(GAMES_DIR, "prince-princess/index.ts"), "utf8");
    const wired = src.slice(src.indexOf("const level = mountLevelGame"), src.indexOf("const jumpTo"));
    expect(wired).toContain("bar.hidden = true");
    expect(wired).toContain("if (!current && !direct) bar.hidden = false;");
    expect(wired.indexOf("bar.hidden = true")).toBeLessThan(wired.indexOf("playLevel(stage, ctx)"));
  });
});

/**
 * 同族第二道闸(r5 走查追加):类名不带 modebar 的「flex/grid 容器 + 代码里
 * `xx.hidden = true` 收起」也会中一样的招——adventure-king `.ak-bar` 就是这么
 * 在第一道闸眼皮底下把三颗模式钮永远杵在无尽古堡里的。这里顺着代码找:
 * 凡被 `.hidden = true` 点过名的元素,若其类名的 CSS 规则带 display:flex/grid,
 * 同文件必须有 `[hidden]{display:none}` 兜底。
 */
describe("hidden 收起 × display:flex/grid 全库守门(r5 追加)", () => {
  /** A 组(壳层+闯关学习)待修名单:B 组无权改这些目录,修完从名单划掉 */
  const A_GROUP_PENDING = new Set(["sky-squad/index.ts:sks-topbar"]);

  interface Offender {
    file: string;
    cls: string;
  }

  function offendersOf(file: string): Offender[] {
    const src = readFileSync(file, "utf8");
    const out: Offender[] = [];
    const hiddenVars = new Set<string>();
    for (const m of src.matchAll(/(\w+)\.hidden = true/g)) hiddenVars.add(m[1]);
    for (const v of hiddenVars) {
      // 变量的类名:`v.className = "…"` 或 `v = el("tag", "…")` 两种写法
      const cm = src.match(new RegExp(`${v}(?:\\.className\\s*=\\s*|\\s*=\\s*el\\("\\w+",\\s*)"([a-z0-9- ]+)"`));
      if (!cm) continue;
      for (const cls of cm[1].split(/\s+/)) {
        if (!new RegExp(`\\.${cls}\\{[^}]*display:(?:flex|grid)`, "s").test(src)) continue;
        if (!hiddenRuleCovers(src, cls)) out.push({ file, cls });
      }
    }
    return out;
  }

  it("被 .hidden 收起的 flex/grid 容器都有 [hidden] 兜底(A 组待修名单除外)", () => {
    const bad: string[] = [];
    for (const file of gameSourceFiles()) {
      for (const o of offendersOf(file)) {
        const key = `${file.split("/").slice(-2).join("/")}:${o.cls}`;
        if (A_GROUP_PENDING.has(key)) continue;
        bad.push(key);
      }
    }
    expect(bad, `这些容器被 .hidden 收起但 display:flex/grid 顶掉了兜底:${bad.join(", ")}`).toEqual([]);
  });

  it("本轮补上的四款在扫描口径里(ak-bar / sr-skins / sp-hintbox / tt-sum-bar)", () => {
    const named: Array<[string, string]> = [
      ["adventure-king/index.ts", "ak-bar"],
      ["snake-royale/index.ts", "sr-skins"],
      ["sudoku-petal/index.ts", "sp-hintbox"],
      ["tap-tiles/index.ts", "tt-sum-bar"],
    ];
    for (const [rel, cls] of named) {
      const src = readFileSync(join(GAMES_DIR, rel), "utf8");
      expect(hiddenRuleCovers(src, cls), `${rel} 的 .${cls} 缺兜底`).toBe(true);
    }
  });
});
