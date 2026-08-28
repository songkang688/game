import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * C-1(trio-r5) 全库守门:模式栏(*-modebar)只要被 CSS 显式设了 display(flex 等),
 * 浏览器默认的 [hidden]{display:none} 就会被覆盖,必须在同文件补上
 * `.xx-modebar[hidden]{display:none}`,否则 bar.hidden = true 之后模式栏仍然杵在屏幕上。
 * 曾在 box-hamster / prince-princess / sudoku-petal 复发,这里全库扫一遍防再犯。
 */

const GAMES_DIR = join(__dirname);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (name.endsWith(".ts") && !name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

interface Offender {
  file: string;
  cls: string;
}

function findOffenders(): Offender[] {
  const offenders: Offender[] = [];
  for (const file of collectSourceFiles(GAMES_DIR)) {
    const src = readFileSync(file, "utf8");
    const classNames = new Set<string>();
    for (const m of src.matchAll(/\.([a-z0-9]+(?:-[a-z0-9]+)*-modebar)(?![\w-])/g)) {
      classNames.add(m[1]);
    }
    for (const cls of classNames) {
      // 该类是否有某条规则把 display 设成了非 none(会盖掉 UA 的 [hidden])
      const overridesDisplay = new RegExp(
        `\\.${cls}(?![\\w-])(?!\\[hidden\\])[^{}]*\\{[^{}]*display\\s*:\\s*(?!none)[a-z-]`,
      ).test(src);
      if (!overridesDisplay) continue;
      const hasHiddenRule = new RegExp(
        `\\.${cls}\\[hidden\\][^{}]*\\{[^{}]*display\\s*:\\s*none`,
      ).test(src);
      if (!hasHiddenRule) offenders.push({ file, cls });
    }
  }
  return offenders;
}

describe("modebar [hidden] 全库守门", () => {
  it("凡显式设 display 的 *-modebar 类都必须带 [hidden]{display:none} 规则", () => {
    const offenders = findOffenders();
    const msg = offenders
      .map((o) => `${o.file} 缺 .${o.cls}[hidden]{display:none}`)
      .join("\n");
    expect(offenders, msg).toEqual([]);
  });

  it("本轮修复的三款确实带上了 [hidden] 规则", () => {
    const cases: Array<[string, string]> = [
      ["box-hamster/index.ts", ".bh-modebar[hidden]"],
      ["prince-princess/index.ts", ".pcp-modebar[hidden]"],
      ["sudoku-petal/index.ts", ".sp-modebar[hidden]"],
    ];
    for (const [rel, sel] of cases) {
      const src = readFileSync(join(GAMES_DIR, rel), "utf8");
      const rule = new RegExp(`${sel.replace(/[.[\]]/g, "\\$&")}\\{display:none;\\}`);
      expect(rule.test(src), `${rel} 应含 ${sel}{display:none;}`).toBe(true);
    }
  });
});
