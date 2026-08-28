/**
 * N-216：390 / 915 抽验攻略抽屉。壳层 styles.css，不抢 B 游戏文件。
 * 不回退 N-201 横滑、N-202/203/204 overlay、N-205/215 open·back 闸。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const L99 = readFileSync(fileURLToPath(new URL("../games/level99.ts", import.meta.url)), "utf8");

describe("N-216 攻略抽屉 390 / 915", () => {
  it("正文可滚：min-height:0 + overflow-y + pan-y，关闭钮写死 44 不是 38", () => {
    expect(STYLES).toMatch(/\.guide-body\s*\{[^}]*min-height:\s*0/);
    expect(STYLES).toMatch(/\.guide-body\s*\{[^}]*overflow-y:\s*auto/);
    expect(STYLES).toMatch(/\.guide-body\s*\{[^}]*touch-action:\s*pan-y/);
    expect(STYLES).toMatch(/\.guide-body\s*\{[^}]*overscroll-behavior:\s*contain/);
    expect(STYLES).toMatch(/\.guide-drawer\s*\{[^}]*min-height:\s*0/);
    expect(STYLES).toMatch(/\.guide-drawer\s*\{[^}]*overflow:\s*hidden/);
    expect(STYLES).toMatch(/\.guide-overlay\s*\{[^}]*touch-action:\s*pan-y/);
    expect(STYLES).toMatch(/\.guide-close\s*\{[^}]*width:\s*44px/);
    expect(STYLES).toMatch(/\.guide-close\s*\{[^}]*height:\s*44px/);
    expect(STYLES).not.toMatch(/\.guide-close\s*\{[^}]*width:\s*38px/);
    expect(STYLES).toMatch(/\.guide-done\s*\{/);
    expect(STYLES).toMatch(
      /\.btn,\s*\.icon-btn[\s\S]*?\.guide-done \{\n  min-height: 44px;/,
    );
  });

  it("915 矮屏收攻略头脚，不改暂停 58 / 横滑", () => {
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?\.guide-head \{[\s\S]*?padding: 8px 14px 6px/,
    );
    expect(STYLES).toMatch(/\.home-screen\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(STYLES).toMatch(/^\.btn \{\n  min-height: 58px;/m);
  });
});

describe("不回退 overlay / 大厅闸", () => {
  it("N-203/204 overlay 与 N-201 横滑仍在", () => {
    expect(L99).toMatch(/\.l99-overlay\{[^}]*overflow-y:auto/);
    expect(L99).toMatch(/\.l99-overlay\{[^}]*touch-action:pan-y/);
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?\.pause-content \.dialog-text \{[\s\S]*?display: none/,
    );
  });
});
