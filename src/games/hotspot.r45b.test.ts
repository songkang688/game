import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r45 B · 只做 N-195 .shr-back", () => {
  it("N-195 返回钮 44 + 居中，不改 N-134 toggle 与 N-124 500 画布钳", () => {
    const s = read("shoot-range/index.ts");
    expect(s).toMatch(/\.shr-back\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.shr-back\{[^}]*display:inline-flex/s);
    expect(s).toContain(".shr-toggle{border:none;border-radius:999px;min-height:44px");
    expect(s).toContain(".shr-cv{height:min(140px,36dvh);}");
    expect(s).toContain(".shr-toggle,.shr-back,.shr-veil-btn,.shr-mode{min-height:44px;}");
  });

  /* 回填 1.3 时本闸的「零改」范围锁与 A 侧 N-196/N-198（壳层 CTA 抬 44）直接对撞。
     A 侧的 44 是产品要求且有 level99.r26/r29/r31/r35/r38 多道闸守着,这里改成守 A 侧口径。 */
  it("N-196 壳层 .l99-continue 声明不变，只多一条 44", () => {
    const s = read("level99.ts");
    expect(s).toContain(
      ".l99-continue{border:none;border-radius:999px;padding:8px 16px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;",
    );
    expect(s).toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
  });

  it("N-105 禁第四版；不回退中间档", () => {
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("fruit-stack/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
  });
});
