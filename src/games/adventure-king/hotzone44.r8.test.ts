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
});
