/**
 * S-3(trio-r5):家长权限门弹窗开着切路由(hashchange)时,遮罩曾跨页残留(窗口 5 BL-6)。
 * 修法:路由一变就 finish(false)——关弹窗、不授权。
 * 单测环境是 node(没有 DOM),这里按仓库惯例扫源码钉住三件事:
 * 监听在场、finish 里摘监听不泄漏、密码/答案不落存储的约定没被顺手破坏。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./parentAuth.ts", import.meta.url), "utf8");

describe("S-3 parentAuth 跨路由残留", () => {
  it("弹窗挂了 hashchange 监听,路由一变就当放弃", () => {
    expect(SRC).toMatch(/window\.addEventListener\("hashchange", onRouteChange\)/);
    expect(SRC).toMatch(/function onRouteChange\(\): void \{\s*finish\(false\);/);
  });

  it("finish 里摘掉监听,弹窗正常关掉时不留孤儿监听", () => {
    expect(SRC).toMatch(/window\.removeEventListener\("hashchange", onRouteChange\)/);
    // removeEventListener 必须在 finish 函数体内(clearInterval 与 handle.close 之间)
    const finishBody = /function finish\(ok: boolean\): void \{([\s\S]*?)\n    \}/.exec(SRC)?.[1] ?? "";
    expect(finishBody).toContain('removeEventListener("hashchange"');
  });

  it("授权只在内存:整个文件不许出现往 localStorage 写授权/密码的代码", () => {
    // 允许读跳关记录(getItem/removeItem),不许 setItem
    expect(SRC).not.toMatch(/localStorage[^\n]*setItem/);
  });
});
