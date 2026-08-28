/**
 * N-109：root 密码门在 915×412 一族矮横屏,时长四胶囊折两行,
 * 「打开 / 不打开」初见掉到 413~459(盒内滚得到,但初见看不见)。
 * 修法:ROOT_GATE_CSS 加一档 max-height:500px——收行距、胶囊瘦身进一行;
 * 输入框(46)/胶囊(44)/按钮(46) 热区一律不动,竖屏与平板(高>500px)零变化。
 * 密码契约(不写 storage、只落过期时间)一个字不碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ROOT_CONTACT_LINE, rootDialogSpec } from "./rootGate";

const SRC = readFileSync(fileURLToPath(new URL("./rootGate.ts", import.meta.url)), "utf8");

function shortBlock(): string {
  const at = SRC.indexOf("@media (max-height:500px)");
  expect(at, "ROOT_GATE_CSS 应有 max-height:500px 档").toBeGreaterThanOrEqual(0);
  const next = SRC.indexOf("@media", at + 1);
  return SRC.slice(at, next > 0 ? next : undefined);
}

describe("N-109 root 密码门矮横屏收档", () => {
  it("矮横屏收行距与胶囊,CTA 初见回 412 内", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.rootgate\{gap:6px\}/);
    expect(block).toMatch(/\.rootgate-dur\{padding:0 10px;font-size:14px\}/);
    expect(block).toMatch(/\.rootgate-durs\{gap:6px\}/);
  });

  it("热区红线不回退:输入 46 / 胶囊 44 / 按钮 46 原样,媒体档不许改矮", () => {
    expect(SRC).toMatch(/\.rootgate-input\{min-height:46px/);
    expect(SRC).toMatch(/\.rootgate-dur\{min-height:44px/);
    expect(SRC).toMatch(/\.rootgate-btn\{min-height:46px/);
    const block = shortBlock();
    expect(block).not.toContain("min-height:4");
    expect(block).not.toContain("min-height:3");
  });

  it("弹窗内容契约不动:联系方式原样、按钮清单原样", () => {
    expect(ROOT_CONTACT_LINE).toContain("要打开请联系管理员");
    const spec = rootDialogSpec("要用管理员权限", 0, null);
    expect(spec.buttons.map((b) => b.label)).toEqual(["打开", "不打开"]);
    expect(spec.durations.at(-1)?.key).toBe("forever");
  });
});
