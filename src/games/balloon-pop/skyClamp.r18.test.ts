import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SKY_H } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/**
 * C-8(r18):915×412 闯关天空 222–642,出生区整段在首屏线下(实测线下气球 top 633)。
 * 修法只钳 .blp-sky 的显示高;SKY_H=420 是 walkthrough/learn 钉死的世界常量,禁改。
 * 气球顶锚定(style.top=y),钳高后可见窗口与修前视口裁出的窗口一样处于逃逸线附近,
 * 大小不缩水(max 96px 下限兜底),HUD 与播报全部回进首屏。
 */
describe("C-8 balloon-pop 天空显示高", () => {
  it("SKY_H 世界常量原封不动", () => {
    expect(SKY_H).toBe(420);
    expect(SRC).toContain("height: ${SKY_H}px");
  });

  it("矮横屏只钳显示高,并给壳内关卡留更紧的一档", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".blp-sky { max-height: max(96px, calc(100dvh - 200px)); }");
    expect(SRC).toContain(".l99-stage-wrap .blp-sky { max-height: max(96px, calc(100dvh - 300px)); }");
  });
});
