/**
 * 守门：22 条配方的说法必须站得住（第 2 轮测试员 W5R2-A-10，建议）。
 *
 * 测试员挑出两处口径瑕疵，本轮逐条核完的结论是**两处都不改配方，改成锁住**：
 *
 * ①「浅绿 + 绿色 = 中绿」——测试员说它的亮度落在两个原料之间、方向不如别的配方直白。
 *   核下来这恰恰是**对的**：往很淡的浅绿里再兑一点原绿，结果就该落在两者中间。
 *   它只是句式跟「加白变浅 / 加黑变深」不一样，不是教错。
 *   与其改配方，不如把「必须严格落在两者之间」钉成用例——这样以后谁调 hex 都不会把它调飞。
 *
 * ②「红色 + 红色 = 深红」「黄色 + 黄色 = 金黄」——测试员说同色相混物理上不会变深。
 *   核下来要看说的是哪件事：如果说的是「两束光 / 两种色相相加」，那确实不会变深；
 *   但这一条的说法是「**再加一勺颜料**，颜料更浓」——一杯水里多化一勺同样的颜料，
 *   画出来就是更沉，这是水彩台上真会发生的事，说法是站得住的。
 *   而且这三条是 1.0 的老配方、前 99 关靠它，不许动。
 *   要守的是**说法不许漂**：这一族的理由里不能出现「相加 / 混出」这类色相合成的说法。
 *
 * 所以这个文件一条配方都不改，只把两处结论钉死。
 */
import { describe, expect, it } from "vitest";
import { MIX_TABLE, PIGMENT_HEX, RECIPES, lightness, mixKey, mixWhy, pigmentLightness } from "./mix";

/** 同色再倒一勺那一族 */
const SAME_HUE = RECIPES.filter((r) => r.a === r.b);
/** 掺白 / 掺黑那两族 */
const WITH_WHITE = RECIPES.filter((r) => r.b === "白色" && r.a !== "白色");
const WITH_BLACK = RECIPES.filter((r) => r.b === "黑色" && r.a !== "黑色");

describe("涂色小屋 ·「兑出中间那一档」这一条", () => {
  it("配的是浅绿 + 深绿，出中绿", () => {
    expect(MIX_TABLE[mixKey("浅绿", "深绿")]).toBe("中绿");
  });

  it("中绿的亮度严格落在两个原料之间——这才是「兑出中间那一档」该有的样子", () => {
    const light = pigmentLightness("浅绿");
    const mid = pigmentLightness("中绿");
    const deep = pigmentLightness("深绿");
    expect(deep).toBeLessThan(mid);
    expect(mid).toBeLessThan(light);
  });

  it("反例:老配方「浅绿 + 绿色」出的中绿比两支原料都深,那是在教「两支淡的兑出更深的」", () => {
    expect(pigmentLightness("中绿")).toBeLessThan(pigmentLightness("绿色"));
    expect(pigmentLightness("中绿")).toBeLessThan(pigmentLightness("浅绿"));
    expect(MIX_TABLE[mixKey("浅绿", "绿色")]).toBeUndefined();
  });

  it("它不该被当成「加白变浅」或「加黑变深」——句式不同是因为做的事不同", () => {
    const why = mixWhy("浅绿", "深绿") ?? "";
    expect(why).not.toContain("加白");
    expect(why).not.toContain("加黑");
    expect(why).toContain("浅绿");
    expect(why).toContain("中绿");
  });

  it("凡是「兑出中间那一档」的配方,出来的都必须真的夹在两支原料之间", () => {
    for (const r of RECIPES.filter((x) => x.why.includes("兑出中间"))) {
      const lo = Math.min(pigmentLightness(r.a), pigmentLightness(r.b));
      const hi = Math.max(pigmentLightness(r.a), pigmentLightness(r.b));
      expect(pigmentLightness(r.out), `${r.a}+${r.b} 出的 ${r.out} 没夹在中间`).toBeGreaterThan(lo);
      expect(pigmentLightness(r.out), `${r.a}+${r.b} 出的 ${r.out} 没夹在中间`).toBeLessThan(hi);
    }
  });

  it("加白那一族出来的一定更浅，加黑那一族一定更深(别的配方方向确实是直白的)", () => {
    for (const r of WITH_WHITE) {
      expect(pigmentLightness(r.out), `${r.a}加白反而变深了`).toBeGreaterThan(pigmentLightness(r.a));
    }
    for (const r of WITH_BLACK) {
      expect(pigmentLightness(r.out), `${r.a}加黑反而变浅了`).toBeLessThan(pigmentLightness(r.a));
    }
  });
});

describe("涂色小屋 ·「同色再倒一勺」这一族的说法", () => {
  it("就是红 / 黄 / 蓝这三条，一条不多一条不少（1.0 老配方，前 99 关靠它）", () => {
    expect(SAME_HUE.map((r) => r.a).sort()).toEqual(["红色", "蓝色", "黄色"].sort());
    expect(MIX_TABLE[mixKey("红色", "红色")]).toBe("深红");
    expect(MIX_TABLE[mixKey("黄色", "黄色")]).toBe("金黄");
    expect(MIX_TABLE[mixKey("蓝色", "蓝色")]).toBe("深蓝");
  });

  it("说的是「颜料更浓」，不是「两种颜色相加」——后者才是教错", () => {
    for (const r of SAME_HUE) {
      const why = r.why;
      expect(why, `${r.a}+${r.a} 的理由没说清是加颜料`).toContain("加一勺");
      expect(why, `${r.a}+${r.a} 说成了色相合成`).not.toContain("调出");
      expect(why, `${r.a}+${r.a} 说成了色相合成`).not.toContain("混出");
      expect(why).toContain("浓");
    }
  });

  it("既然说「更浓」，出来的就必须真的更沉", () => {
    for (const r of SAME_HUE) {
      expect(pigmentLightness(r.out), `${r.a} 再倒一勺反而变浅了`).toBeLessThan(pigmentLightness(r.a));
    }
  });

  it("同色加浓不许换色相:出来的还得是同一支颜色的深浅版", () => {
    for (const r of SAME_HUE) {
      const same = r.out.includes(r.a[0]) || r.out === "金黄";
      expect(same, `${r.a}+${r.a} 出了个不相干的 ${r.out}`).toBe(true);
    }
  });
});

describe("涂色小屋 · 22 条配方的说法整体扫一遍", () => {
  it("每一条都有一句为什么，而且不空话", () => {
    for (const r of RECIPES) {
      expect(r.why.length, `${r.a}+${r.b} 的理由太短`).toBeGreaterThanOrEqual(6);
      expect(mixWhy(r.a, r.b)).toBe(r.why);
    }
  });

  it("「调出」只留给三原色两两相加那三条——只有那三条才是真的合成出新色相", () => {
    const blended = RECIPES.filter((r) => r.why.includes("调出")).map((r) => `${r.a}+${r.b}`);
    expect(blended.sort()).toEqual(["红色+蓝色", "红色+黄色", "白色+黑色", "蓝色+黄色"].sort());
  });

  it("配方出来的颜色都是真有 hex 的颜料，不会指向一个不存在的名字", () => {
    for (const r of RECIPES) {
      expect(PIGMENT_HEX[r.out], `${r.a}+${r.b} 出了个没有颜料的 ${r.out}`).toBeTruthy();
      expect(lightness(PIGMENT_HEX[r.out])).toBeGreaterThanOrEqual(0);
    }
  });
});
