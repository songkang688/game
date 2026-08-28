// 窗口3 · 第 2 轮监督修复:round1 遗留 #6 / B 档 round2 建议 8——
// 暂停按钮与暂停遮罩的 ⏸ / ▶️ emoji 换内联 SVG(两根圆角竖条 / 圆角小三角)。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pauseIconSVG, playIconSVG } from "./art";

const indexSrc = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("tap-tiles 暂停图标画制化(遗留 #6)", () => {
  it("pauseIconSVG:两根圆角竖条(rect×2 带 rx),装饰性 aria-hidden", () => {
    const svg = pauseIconSVG();
    expect(svg.match(/<rect /g)?.length).toBe(2);
    expect(svg).toContain('rx="1.65"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.includes("⏸")).toBe(false);
  });

  it("playIconSVG:一枚圆角小三角(path 圆角连接),同为 currentColor", () => {
    const svg = playIconSVG();
    expect(svg).toContain("<path ");
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg.includes("▶")).toBe(false);
  });

  it("两枚图标都用 currentColor:浅紫按钮与遮罩标题共用一份不重配色", () => {
    for (const svg of [pauseIconSVG(), playIconSVG()]) {
      expect(svg).toContain('fill="currentColor"');
      expect(svg.includes("#")).toBe(false);
    }
  });

  it("尺寸参数直通宽高,默认 13(按钮行内),遮罩标题可放大", () => {
    expect(pauseIconSVG()).toContain('width="13" height="13"');
    expect(pauseIconSVG(17)).toContain('width="17" height="17"');
    expect(playIconSVG(20)).toContain('width="20" height="20"');
  });

  it("源码不再有 ⏸ 与 ▶️ emoji;「开始 ▶」的纯排版三角保留", () => {
    expect(indexSrc.includes("⏸")).toBe(false);
    expect(indexSrc.includes("▶️")).toBe(false);
    expect(indexSrc).toContain('go.textContent = "开始 ▶";');
  });

  it("暂停按钮初始态 / 切换两态 / 遮罩标题与继续钮全部走 SVG 图标", () => {
    expect(indexSrc).toContain("pauseBtn.innerHTML = pauseIconSVG();");
    expect(indexSrc).toContain("pauseBtn.innerHTML = `${playIconSVG()}<span> 继续</span>`;");
    expect(indexSrc).toContain("pauseBtn.innerHTML = `${pauseIconSVG()}<span> 暂停</span>`;");
    expect(indexSrc).toContain("`${pauseIconSVG(17)}<span> 先歇一会儿</span>`");
    expect(indexSrc).toContain("`${playIconSVG()}<span> 继续玩</span>`");
  });

  it("暂停按钮的 aria-label「暂停」保留(图标是装饰,读屏口径不变)", () => {
    expect(indexSrc).toContain('pauseBtn.setAttribute("aria-label", "暂停");');
  });
});
