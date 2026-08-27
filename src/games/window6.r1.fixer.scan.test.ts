/**
 * 窗口 6 · 第 1 轮视觉监督修复员(C 档)· 扩展商标扫描钉子。
 *
 * A 档各款 qa1 的商标黑名单没有覆盖到「泡泡龙」等同题材易踩线词——
 * 自查在 bubble-aim/index.ts 的头注释里真抓到一处「泡泡龙玩法」(已改写为
 * 通用玩法描述)。这里把扩展词表对本窗口 9 款钉死,防止再犯。
 * qaAudit.ts 的黑名单定义自身含词,属守卫,豁免。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GAMES = [
  "brave-path",
  "adventure-king",
  "alien-seek",
  "brick-break",
  "mole-pop",
  "box-hamster",
  "balloon-pop",
  "bubble-pop",
  "bubble-aim",
] as const;

/** A 档词表之外的同题材易踩线补充(与 B 档第四节风险清单对齐) */
const EXTRA_TRADEMARKS = [
  /泡泡龙/,
  /puzzle\s*bobble/i,
  /bubble\s*bobble/i,
  /开心消消乐/,
  /哈姆太郎/,
  /hamtaro/i,
  /汤姆猫/,
  /talking\s*tom/i,
  /愤怒的小鸟/,
  /angry\s*birds/i,
  /arkanoid/i,
  /吃豆人/,
  /pac-?man/i,
  /kitty/i,
];

describe("窗口6 r1 fixer · 扩展商标扫描(9 款非测试源码,含代码注释)", () => {
  for (const id of GAMES) {
    it(`${id}:扩展词表 0 命中`, () => {
      const dir = join(__dirname, id);
      const files = readdirSync(dir).filter(
        (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "qaAudit.ts"
      );
      for (const f of files) {
        const src = readFileSync(join(dir, f), "utf8");
        for (const re of EXTRA_TRADEMARKS) {
          expect(src, `${id}/${f} 命中 ${re}`).not.toMatch(re);
        }
      }
    });
  }
});
