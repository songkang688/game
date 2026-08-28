import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/**
 * N-10(r18 收口):旧钳 calc(100dvh - 168px) 低估棋盘上方的壳+抬头,915×412 下
 * .wq-scroll 底边伸到 468,盒底几路怎么滚都够不着。按实测预算重钳(96px 下限),
 * 壳内关卡另留一档;700px 断点与 sticky 工具列不动,窄竖屏不受影响。
 */
describe("N-10 weiqi-garden 滚动盒预算", () => {
  it("滚动盒钳到实测预算,壳内关卡更紧一档", () => {
    expect(SRC).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(SRC).toContain(".wq-scroll{max-height:max(96px, calc(100dvh - 240px));}");
    expect(SRC).toContain(".l99-stage-wrap .wq-scroll{max-height:max(96px, calc(100dvh - 300px));}");
    expect(SRC).not.toContain("calc(100dvh - 168px)");
  });

  it("工具列仍 sticky 钉底", () => {
    expect(SRC).toContain(".wq-tools{position:sticky;bottom:0");
  });
});
