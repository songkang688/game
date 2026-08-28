/**
 * 云端竖屏/平板走查 · PT 系列守门(独立编号,不占 N-xx)
 *
 * PT-1 bubble-aim:`.ba-wrap` 曾锁 `touch-action: none`,地图态舞台还剩 46px
 *      溢出时手指怎么划都划不动(用户反馈「有时往下划不了」)。瞄准手势只挂在
 *      画布上、画布自己就有 touch-action:none,wrap 必须让出竖向平移。
 * PT-2 bubble-aim:平板/宽屏(≥700px)选关地图放宽到 720px、八列,
 *      与 candy-swing 已合入的 cs-view-map 同款;进关摘类回窄档。
 * PT-3 bubble-aim / candy-swing:平板横屏(宽高都 ≥700px)关内 3:4 画布按
 *      可用高度长大(clamp 到 520px 封顶);矮横屏 915×412 与手机竖屏
 *      因 media 条件不满足,一像素都不变,不碰 N-29 的矮屏账。
 * PT-4 candy-swing:`.cs-map` 高度预算 -120px 时外壳仍溢 18px 被舞台裁掉,
 *      收到 -138px(壳顶栏+边框+wrap padding+msg 行的实账)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BA_SRC = readFileSync(
  fileURLToPath(new URL("./bubble-aim/index.ts", import.meta.url)),
  "utf8"
);
const CS_SRC = readFileSync(
  fileURLToPath(new URL("./candy-swing/index.ts", import.meta.url)),
  "utf8"
);

describe("PT-1 bubble-aim wrap 不许再锁死触摸滚动", () => {
  it("`.ba-wrap` 用 manipulation,不再是 none", () => {
    const wrapRule = /\.ba-wrap \{[^}]*\}/.exec(BA_SRC)?.[0] ?? "";
    expect(wrapRule, "找不到 .ba-wrap 规则").not.toBe("");
    expect(wrapRule).toContain("touch-action: manipulation");
    expect(wrapRule).not.toContain("touch-action: none");
  });

  it("画布自己的 touch-action:none 保留(瞄准手势不受影响)", () => {
    const canvasRule = /\.ba-canvas \{[^}]*\}/.exec(BA_SRC)?.[0] ?? "";
    expect(canvasRule).toContain("touch-action: none");
  });
});

describe("PT-2 bubble-aim 平板地图放宽(ba-view-map)", () => {
  it("地图态挂类、进关(闯关/无尽)都摘掉", () => {
    // 单测桩没有 classList,照 candy-swing 先例用 className 直赋值
    expect(BA_SRC).toContain('wrap.className = "ba-wrap ba-view-map"');
    expect(
      BA_SRC.split('wrap.className = "ba-wrap";').length - 1,
      "mount 初始化 + startLevel + startEndless 至少三处回到窄档"
    ).toBeGreaterThanOrEqual(3);
  });

  it("≥700px 地图 720px 宽、八列", () => {
    expect(BA_SRC).toContain(".ba-wrap.ba-view-map { max-width: 720px; width: 100%; }");
    expect(BA_SRC).toContain(".ba-wrap.ba-view-map .ba-grid { grid-template-columns: repeat(8, 1fr); }");
  });
});

describe("PT-3 平板横屏关内画布按高度长大", () => {
  const CLAMP = "clamp(400px, calc((100dvh - 240px) * 0.75), 520px)";

  it("bubble-aim:min-width 与 min-height 双条件,矮横屏/竖屏不受影响", () => {
    expect(BA_SRC).toContain("@media (min-width: 700px) and (min-height: 700px)");
    expect(BA_SRC).toContain(`.ba-wrap:not(.ba-view-map) { max-width: ${CLAMP}; width: 100%; }`);
  });

  it("candy-swing:同款双条件 clamp", () => {
    expect(CS_SRC).toContain("@media (min-width: 700px) and (min-height: 700px)");
    expect(CS_SRC).toContain(`.cs-wrap:not(.cs-view-map) { max-width: ${CLAMP}; width: 100%; }`);
  });

  it("下限 400px 与旧档一致:不满足 media 时一像素不变", () => {
    // wrap 基础规则仍是 400px,clamp 的下限也是 400px,永不缩小
    expect(/\.ba-wrap \{[^}]*max-width: 400px/.test(BA_SRC)).toBe(true);
    expect(/\.cs-wrap \{[^}]*max-width: 400px/.test(CS_SRC)).toBe(true);
  });
});

describe("PT-4 candy-swing 地图高度预算收到 -138px", () => {
  it("外壳不再被舞台裁 18px", () => {
    expect(CS_SRC).toContain("max-height: min(960px, max(180px, calc(100dvh - 138px)))");
    expect(CS_SRC).not.toContain("calc(100dvh - 120px)");
  });
});
