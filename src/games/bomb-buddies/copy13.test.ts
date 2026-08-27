/**
 * bomb-buddies · 1.3 窗口 5 第 1 轮学习优化员 · 改名快照。
 *
 * tester Z1:原标题「泡泡炸弹人」内嵌「炸弹人」(Bomberman 通行中文名),记阻断。
 * 本轮更名「泡泡布阵」(纯文案,不动玩法、不动 parentAuth)。
 * 这里把新名字与「旧名不许回流」钉住:谁把商标词改回来,当场红。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { matchesSearch, pinyinInitials } from "../../ui/homeFilters";
import { meta } from "./meta";
import GUIDE from "./guide";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

describe("bomb-buddies · 1.3 改名「泡泡布阵」快照", () => {
  it("标题就是「泡泡布阵」,攻略认领同一个名字", () => {
    expect(meta.title).toBe("泡泡布阵");
    expect(GUIDE.title).toContain("泡泡布阵");
  });

  it("孩子可见文案(meta + guide)里再无「炸弹人」及近邻商标名", () => {
    const copy = [
      meta.title,
      meta.blurb,
      GUIDE.title,
      ...GUIDE.general,
      ...GUIDE.entries.flatMap((e) => [e.title, ...e.tips]),
    ].join("\n");
    for (const bad of ["炸弹人", "bomberman", "泡泡堂", "泡泡龙"]) {
      expect(copy.toLowerCase()).not.toContain(bad);
    }
  });

  it("index.ts 全文(含结算文案与注释)不再出现「炸弹人」", () => {
    expect(read("index.ts")).not.toContain("炸弹人");
    expect(read("meta.ts")).not.toContain("泡泡炸弹人");
    expect(read("guide.ts")).not.toContain("炸弹人");
  });

  it("新标题拼音首字母搜得到:ppbz / 泡泡 / id 三条路都通", () => {
    expect(pinyinInitials(meta.title)).toBe("ppbz");
    expect(matchesSearch(meta, "ppbz")).toBe(true);
    expect(matchesSearch(meta, "泡泡")).toBe(true);
    expect(matchesSearch(meta, "bombbuddies")).toBe(true);
  });
});
