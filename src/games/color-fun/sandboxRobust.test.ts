/**
 * 涂色小屋 · 自由画室在坏存档面前不许崩（窗口5 第1轮监督修复员补）。
 *
 * 本轮监督复审补测「存档损坏 / 崩溃入口」这一口时找到的：
 * 画廊里的一张旧作记着「用的是第几幅线稿」，`sandbox.ts` 的 `normalizeWork()`
 * 只管它是不是个 ≥0 的有限数，**不认识 `PICTURES` 有几幅**——存档被改坏、
 * 或者从装过新版（线稿更多）的机器退回旧版，都会留下一个越界的下标。
 * 画廊那一格本来就有 `?? PICTURES[0]` 兜着看不出问题，可**点开接着涂**那条路没有：
 * `onWork()` 直接把它赋给 `picIndex`，`renderCanvas()` 再去读 `PICTURES[picIndex].regions`
 * ——`undefined.regions`，整间画室当场崩掉，只能退出游戏重进。
 *
 * 所以下面第一条同时钉两件事：存档层确实会放行越界下标（不是我瞎编的入口），
 * 以及不收口就是真的抛异常。第二条起钉收口之后的行为与接线。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PICTURES } from "./levels";
import { normalizeWork } from "./sandbox";
import { safePicIndex } from "./sandboxUi";
import { pictureSvgBody, thumbnailSvg } from "./ui";

const SRC = readFileSync(fileURLToPath(new URL("./sandboxUi.ts", import.meta.url)), "utf8");

describe("涂色小屋 · 画室读到坏存档", () => {
  it("存档层会放行越界的线稿下标，不收口直接拿去画就是崩", () => {
    const work = normalizeWork({ pic: PICTURES.length + 7, fills: { wall: "红色" }, at: 1 });
    expect(work, "存档层认这张作品").not.toBeNull();
    expect(work!.pic).toBe(PICTURES.length + 7);
    expect(PICTURES[work!.pic]).toBeUndefined();
    expect(() => pictureSvgBody(PICTURES[work!.pic])).toThrow();
    expect(() => pictureSvgBody(PICTURES[safePicIndex(work!.pic)])).not.toThrow();
  });

  it("越界、负数、小数、NaN 一律回到第一幅；正常下标原样放过", () => {
    for (const bad of [PICTURES.length, PICTURES.length + 99, -1, -0.5, 1.5, NaN, Infinity]) {
      expect(safePicIndex(bad), `${bad} 应该被收口成 0`).toBe(0);
    }
    for (let i = 0; i < PICTURES.length; i++) expect(safePicIndex(i)).toBe(i);
  });

  it("收口之后，坏存档的缩略图与画布都画得出来", () => {
    const work = normalizeWork({ pic: 999, fills: { roof: "蓝色" }, at: 0 })!;
    const pic = PICTURES[safePicIndex(work.pic)];
    expect(() => thumbnailSvg(pic, work.fills)).not.toThrow();
    expect(pictureSvgBody(pic).length).toBeGreaterThan(0);
  });

  it("点开旧作那条路真的走了收口（源码巡检）", () => {
    const onWork = SRC.slice(SRC.indexOf("function onWork("), SRC.indexOf("function currentWork("));
    expect(onWork).toContain("picIndex = safePicIndex(work.pic)");
    // 画廊缩略图也走同一道口子，两处别再各写各的兜底
    const gallery = SRC.slice(SRC.indexOf("function renderGallery("), SRC.indexOf("function onWork("));
    expect(gallery).toContain("safePicIndex(work.pic)");
  });
});
