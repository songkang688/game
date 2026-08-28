/**
 * N-47 残留(trio-r8)· 古堡工具钮与回选关的 44px 红线。
 *
 * r14 实测:古堡「复位本间/小地图/结束这局/陈列」35px、「◀ 回选关」33px,
 * 都在孩子面 44px 红线以下。只抬热区(min-height),字号/留白/判定零触碰;
 * 浏览器复证 915×412 / 390×844 / 1024×768 三档全部 h44、线下 0。
 * (r14 同条的 mine-garden 半边是休闲款,不在本工位范围。)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("adventure-king · 工具钮热区 44px(N-47 残留)", () => {
  it(".ak-back(回选关)有 44px 下限", () => {
    const rule = SRC.match(/\.ak-back\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("min-height:44px");
  });

  it(".advk-tool(复位/小地图/结束/陈列)有 44px 下限", () => {
    const rule = SRC.match(/\.advk-tool\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("min-height:44px");
  });

  /**
   * 44px 抬完还剩一个死角:矮横屏壳层写 max-height:100%,可 l99-host 没有定高,
   * 百分比绑不住——壳长到 408px 被 322px 宿主 overflow:hidden 裁掉 86px,
   * 第 6 行「🏛️ 打开陈列」top 436 永远线下且用户滚不到。
   * 修法:dvh 钳高 + overflow-y:auto 让壳层自滚,默认视野 13 控件一个不动。
   */
  it("矮横屏壳层用 dvh 钳高并可竖滚,陈列行滚得到", () => {
    const rule = SRC.match(/\.ak-mode\.advk-shell\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("max-height:calc(100dvh - 90px)");
    expect(rule![0]).toContain("overflow-y:auto");
    expect(rule![0]).not.toContain("max-height:100%");
  });

  it("album 行有 min-height 托底(overflow:auto 的自动最小尺寸是 0,会被网格压塌)", () => {
    const rule = SRC.match(/\.ak-mode\.advk-shell > \.advk-album\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("min-height:48px");
  });

  it("开馆态把 album 行托满 28dvh,展柜不在 48px 缝里内滚", () => {
    expect(SRC).toContain('album.classList.toggle("advk-album-open", albumOpen)');
    expect(SRC).toContain(".ak-mode.advk-shell > .advk-album.advk-album-open{min-height:28dvh;}");
  });
});
