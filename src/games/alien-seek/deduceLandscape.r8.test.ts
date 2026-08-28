/**
 * C-6 补账(trio-r8)· 推理关矮横屏的守门。
 *
 * 病根有两层(r13 实锤 915x412 确认键 428 / 向下键 477 线下、舞台自滚 383):
 * 1. r11 双栏里的 sticky 在 grid 单元格里没有活动余地=没用;右栏
 *    线索77+工具96+方向盘166+提示49=388px 塞不进 ~226px 的窗。
 * 2. `grid-row:1/-1` 在没有显式行的网格里解析成「只占第 1 行」,画布把 row1
 *    撑到 214px,右栏工具反而被顶到 404 线下;syncSize 的 vh-72 钳高也没把
 *    平台抬头(~186px)进账,画布自己就戳穿舞台底(实测 186..454)。
 * 修法:推理关挂 as-deduce 标记单独开档——右栏放宽到 300px 起、D-pad 压成一行
 * (热区 44 一个不动)、画布显式跨满右栏四行、syncSize 按最近裁切祖先量真实余量。
 * 浏览器复证 915x412:舞台裁 0 滚 0,五键+暂停 313..357 全屏内,线索/工具/提示全在;
 * find 关(r11 已验收)与竖屏/平板零变化。判定/seed/线索数据零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("alien-seek · 推理关矮横屏专属档(C-6 补账)", () => {
  it("推理关挂 as-deduce 标记,find 关不卷入", () => {
    expect(SRC).toContain('wrap.className = deduce ? "as-wrap as-deduce" : "as-wrap";');
  });

  it("矮横屏档:右栏放宽、画布显式跨行、D-pad 一行、线索盒收矮内滚", () => {
    const media = SRC.match(/@media \(max-height:500px\) and \(min-width:640px\)\{([\s\S]*?)\n\}/);
    expect(media).not.toBeNull();
    const block = media![0];
    expect(block).toContain(".as-wrap.as-deduce{grid-template-columns:minmax(0,1fr) minmax(300px,48%);}");
    expect(block).toContain(".as-wrap.as-deduce>.as-canvas{grid-row:1/span 4;}");
    expect(block).toContain(".as-wrap.as-deduce .as-pad{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;}");
    expect(block).toContain(".as-wrap.as-deduce>.as-clues{max-height:52px;}");
    // 热区红线:这一档不许出现按键尺寸声明(44px 的 min-height 全在基准样式里)
    expect(block).not.toMatch(/as-deduce[^{]*\{[^}]*min-height:\s*(?:[0-3]?\d)px/);
  });

  it("syncSize 按最近裁切祖先量真实余量(平台抬头进账),量不到走 vh-72 老路", () => {
    expect(SRC).toContain("if (clipEl === undefined) clipEl = findClipEl();");
    expect(SRC).toContain("clipEl.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top - 12");
    expect(SRC).toContain("if (room >= 120) cap = Math.min(cap, room);");
  });
});
