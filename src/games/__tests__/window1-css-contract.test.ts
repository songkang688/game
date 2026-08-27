import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 窗口 1 十二款的 CSS 类名契约(第 2 轮补,对应测试员的 W1-05 / W1-06)。
 *
 * 两件事:
 *  1. **前缀独占**:每款只许用一个类名前缀,而且这个前缀不许被第二款用。
 *     `merge-2048` 与 `mine-garden` 曾经都叫 `mg-`,`.mg-open` 在两款里含义还相反
 *     (一个是「模式入口按钮」,一个是「已经翻开的格子」)。样式眼下塞在各自根节点里
 *     所以不会真串味,但只要谁把样式提到 `styles.css`、或者出现同屏预览两款的需求,
 *     两边的盘面就会互相改样子。
 *  2. **返回键与模式入口不共用类名**:「← 回闯关 / ◀ 回选关」顶着 `<前缀>-open` 的话,
 *     任何按类名找入口的自动化都会一路被带回选关页(第 1 轮走查脚本就栽在这上面)。
 */

const GAMES = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
  "merge-2048",
  "mine-garden",
  "sudoku-petal"
] as const;

const SRC = new Map<string, string>(
  GAMES.map((id) => [id, readFileSync(new URL(`../${id}/index.ts`, import.meta.url), "utf8")])
);

/** 这个文件里出现过的类名选择器(`.xx-yyy`),连 `querySelector(".xx-yyy")` 一起算 */
function classSelectors(src: string): string[] {
  return [...src.matchAll(/(?:^|[\s,>+~({[])\.([a-z][a-z0-9]{0,3}-[a-z0-9-]+)/gm)].map((m) => m[1]);
}

/** 类名前缀:第一个连字号之前那一段 */
function prefixOf(cls: string): string {
  return cls.slice(0, cls.indexOf("-"));
}

/** 一款游戏自己的前缀:它用得最多的那一个(排掉平台共用的 `l99-` / `qz-`) */
const SHARED_PREFIXES = new Set(["l99", "qz", "gs", "home", "app"]);

function ownPrefixes(src: string): Set<string> {
  const tally = new Map<string, number>();
  for (const cls of classSelectors(src)) {
    const p = prefixOf(cls);
    if (SHARED_PREFIXES.has(p)) continue;
    tally.set(p, (tally.get(p) ?? 0) + 1);
  }
  // 出现 3 次以上才算「这一款自己的前缀」,免得把偶发引用当成所有权
  return new Set([...tally.entries()].filter(([, n]) => n >= 3).map(([p]) => p));
}

describe("十二款的类名前缀两两不撞", () => {
  it("每个前缀只归一款所有", () => {
    const owners = new Map<string, string[]>();
    for (const id of GAMES) {
      for (const p of ownPrefixes(SRC.get(id) as string)) {
        owners.set(p, [...(owners.get(p) ?? []), id]);
      }
    }
    const clashes = [...owners.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([p, ids]) => `${p}- 被 ${ids.join(" / ")} 同时用着`);
    expect(clashes).toEqual([]);
  });

  it("每款只用一个自己的前缀,不半路换名", () => {
    for (const id of GAMES) {
      const ps = [...ownPrefixes(SRC.get(id) as string)];
      expect(ps, `${id} 的前缀是 ${ps.join(" / ")}`).toHaveLength(1);
    }
  });

  it("`merge-2048` 与 `mine-garden` 声明的类名一个都不重叠", () => {
    const a = new Set(classSelectors(SRC.get("merge-2048") as string).filter((c) => !SHARED_PREFIXES.has(prefixOf(c))));
    const b = new Set(classSelectors(SRC.get("mine-garden") as string).filter((c) => !SHARED_PREFIXES.has(prefixOf(c))));
    const both = [...a].filter((c) => b.has(c)).sort();
    expect(both).toEqual([]);
  });
});

describe("返回键不和模式入口共用类名", () => {
  /** 「← 回闯关 / ◀ 回选关 / ← 回选关」这些退出模式的按钮 */
  const BACK_TEXT = /["`](?:←|◀)\s*回/;

  it("十二款里凡是造返回键的地方,className 都不含 `<前缀>-open`", () => {
    const bad: string[] = [];
    for (const id of GAMES) {
      const src = SRC.get(id) as string;
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!BACK_TEXT.test(line)) return;
        // 往上翻 6 行找这颗按钮的 className
        for (let k = Math.max(0, i - 6); k <= i; k++) {
          const m = /className\s*=\s*[`"']([^`"']*)/.exec(lines[k]);
          if (m && /\b[a-z]+-open\b/.test(m[1])) bad.push(`${id}:${k + 1} ${m[1].trim()}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it("每款的模式入口按钮仍旧统一叫 `<前缀>-open`,走查脚本按这个找入口", () => {
    for (const id of GAMES) {
      const src = SRC.get(id) as string;
      expect(/className\s*=\s*[`"'][a-z]+-open/.test(src), `${id} 找不到 <前缀>-open 入口`).toBe(true);
    }
  });
});
