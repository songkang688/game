/**
 * 红蓝拔河 · 齿轮条开关与两套键位的回归（窗口5 第1轮 学习优化员）。
 *
 * 对应测试员档C 两条：
 *
 * - **W5C-T02（建议）**：360px 上「🔥 拼一把」实测 107×26，高度差 6px。
 * - **W5C-T01（建议）**：星星队第二个键取了 `J`，平台双人约定是 `K`。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RBG_CSS } from "./index";
import { TOGGLE_MIN_H } from "./tuning";
import { BLUE_KEYS, BLUE_KEY_MAIN, RED_KEYS, boundKeys, keySideOf } from "./runtime";

function ruleFor(css: string, selector: string): string {
  const re = new RegExp(`(^|[,{}])\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m");
  const hit = re.exec(css);
  return hit ? hit[2] : "";
}

describe("红蓝拔河 · 齿轮条上的小开关（W5C-T02）", () => {
  it("最小高度守得住 32px，而且文字居中", () => {
    expect(TOGGLE_MIN_H).toBeGreaterThanOrEqual(32);
    const block = ruleFor(RBG_CSS, ".rbg-toggle");
    expect(block, "CSS 里找不到 .rbg-toggle").not.toBe("");
    const hit = /min-height\s*:\s*(\d+)px/.exec(block);
    expect(hit, ".rbg-toggle 没写 min-height").toBeTruthy();
    expect(Number(hit![1])).toBe(TOGGLE_MIN_H);
    expect(block).toMatch(/display\s*:\s*inline-flex/);
    expect(block).toMatch(/align-items\s*:\s*center/);
  });
});

describe("红蓝拔河 · 星星队的键位对齐平台约定（W5C-T01）", () => {
  it("屏幕上一律写 K，K 与 L 都真的接管得到", () => {
    expect(BLUE_KEY_MAIN).toBe("KeyK");
    expect(BLUE_KEYS[0]).toBe("KeyK");
    expect(keySideOf("KeyK", true)).toBe("blue");
    expect(keySideOf("KeyL", true)).toBe("blue");
    // 平台双人约定里星星那半边不含 F / A，别把朵朵的键抢过来
    for (const code of RED_KEYS) expect(BLUE_KEYS).not.toContain(code);
  });

  it("老版本的 J 继续算数——已经玩熟的孩子不许被改哑", () => {
    expect(BLUE_KEYS).toContain("KeyJ");
    expect(keySideOf("KeyJ", true)).toBe("blue");
    // 单人打小电脑时蓝队一个键都不接管，免得一个人玩按到对手的键
    expect(keySideOf("KeyJ", false)).toBeNull();
    expect(keySideOf("KeyK", false)).toBeNull();
    expect(boundKeys(false)).not.toContain("KeyK");
    expect(boundKeys(true)).toContain("KeyK");
    // 卸键的时候一个都不许漏
    expect(new Set(boundKeys(true)).size).toBe(boundKeys(true).length);
    for (const code of BLUE_KEYS) expect(boundKeys(true)).toContain(code);
  });

  it("屏幕上给孩子看的提示都改成了 K，没有一处还写着 J", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");
    expect(src, "还有地方写着「星星按住 J」").not.toMatch(/星星[^\n]{0,40}按住 J/);
    expect((src.match(/星星[^\n]{0,40}按住 K/g) ?? []).length, "屏幕上的 K 提示少了").toBeGreaterThanOrEqual(3);
  });
});
