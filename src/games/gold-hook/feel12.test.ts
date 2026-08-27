/**
 * 1.2 第 12 步 C 档的第二批用例：手感的**视觉出口**（绳子张力）、
 * 结算跳数、360px 版面下限、照明圈的暗度上限，以及无尽成绩从
 * 1.1 的金币口径迁到 1.2 的层深口径这一段。
 *
 * 和 `depth12.test.ts` 分开是因为这一批里有几条要读 CSS 字符串 ——
 * 版面约束（字号 ≥ 14px、热区 ≥ 44px）写在注释里没人守得住，得能断言。
 */
import { describe, expect, it } from "vitest";
import {
  HUD_MIN_FONT,
  LIGHT_BAND_TOP,
  LIGHT_MAX_DIM,
  LIGHT_MIN,
  MUDDY_SLIP_GRACE,
  MUDDY_SLIP_PER_SEC,
  NEW_ORES,
  ROPE_SAG_MAX,
  TALLY_MS,
  TOUCH_MIN,
  TWIN_SHELL_SHARE,
  createTwin,
  lightFloorDepth,
  lightRadius,
  makeHookRng,
  muddySlipChance,
  muddySlips,
  ropeSag,
  tallyValue,
  twinGrab,
  twinValue,
} from "./depth12";
import { ORES, PIVOT_Y } from "./logic";
import { CSS } from "./style";
import { ENDLESS_KEY, bestLine, mergeEndlessBest, migrateEndlessBest } from "./endlessBest";

/* ---------------- 绳子张力 ---------------- */

describe("1.2 绳索张力", () => {
  it("空钩绷直，钩着东西才垂", () => {
    expect(ropeSag(0)).toBe(0);
    expect(ropeSag(-5)).toBe(0);
    expect(ropeSag(ORES.gem.weight)).toBeGreaterThan(0);
  });

  it("越重垂得越多，但收敛到上限，不会垂到挡住下面的矿石", () => {
    let prev = -1;
    for (let w = 0; w <= 40; w += 4) {
      const sag = ropeSag(w);
      expect(sag).toBeGreaterThanOrEqual(prev);
      expect(sag).toBeLessThan(ROPE_SAG_MAX);
      prev = sag;
    }
    expect(ropeSag(1e6)).toBeLessThan(ROPE_SAG_MAX);
  });

  it("最沉的大石头垂得比最轻的钻石明显得多（不然玩家看不出区别）", () => {
    expect(ropeSag(ORES.boulder.weight)).toBeGreaterThan(ropeSag(ORES.gem.weight) * 2);
  });
});

/* ---------------- 泥泥矿滑手：逐帧与闭式公式必须是同一条曲线 ---------------- */

describe("1.2 泥泥矿滑手模型自洽", () => {
  it("宽限期内一次都不滑（抓到就掉像在耍赖）", () => {
    const rng = makeHookRng(7);
    for (let t = 0; t < MUDDY_SLIP_GRACE; t += 1 / 60) {
      expect(muddySlips(rng, 1 / 60, false, t)).toBe(false);
    }
    expect(muddySlipChance(MUDDY_SLIP_GRACE)).toBe(0);
  });

  it("逐帧掷骰子的实测频率和闭式公式对得上（差 3 个百分点以内）", () => {
    const seconds = 6;
    const dt = 1 / 60;
    const runs = 3000;
    let slipped = 0;
    const rng = makeHookRng(20240612);
    for (let i = 0; i < runs; i++) {
      let held = MUDDY_SLIP_GRACE;
      for (let t = 0; t < seconds; t += dt) {
        held += dt;
        if (muddySlips(rng, dt, false, held)) {
          slipped++;
          break;
        }
      }
    }
    const measured = slipped / runs;
    const predicted = muddySlipChance(seconds + MUDDY_SLIP_GRACE);
    expect(Math.abs(measured - predicted)).toBeLessThan(0.03);
  });

  it("一趟正常深度的泥泥矿多半还是拉得上来的（滑手是意外，不是常态）", () => {
    // 从最深处拉一颗泥泥矿大约要这么久
    const haulSeconds = (400 - PIVOT_Y) / 66;
    const worst = muddySlipChance(haulSeconds + MUDDY_SLIP_GRACE);
    expect(worst).toBeLessThan(0.5);
    // 但也不能低到根本遇不上，那这颗矿就白设计了
    expect(worst).toBeGreaterThan(0.15);
    expect(MUDDY_SLIP_PER_SEC).toBeGreaterThan(0);
  });
});

/* ---------------- 双层晶只有一套价目表 ---------------- */

describe("1.2 双层晶价钱只有一套", () => {
  it("钩一次的价钱恰好是全价的一半，depth12 和 logic 两边对得上", () => {
    expect(ORES.twinCrystal.value * 2).toBe(NEW_ORES.twinCrystal.value);
    expect(TWIN_SHELL_SHARE).toBe(0.5);
  });

  it("剥壳拿一半，取芯拿全价", () => {
    const cracked = twinGrab(createTwin()).state;
    expect(twinValue(cracked)).toBe(ORES.twinCrystal.value);
    expect(twinValue({ layers: 0 })).toBe(ORES.twinCrystal.value * 2);
  });
});

/* ---------------- 结算跳数 ---------------- */

describe("1.2 结算金额跳数", () => {
  it("时长在规格上限 800ms 以内", () => {
    expect(TALLY_MS).toBeGreaterThan(0);
    expect(TALLY_MS).toBeLessThanOrEqual(800);
  });

  it("从 0 跳到终值，中途单调不回头", () => {
    let prev = -1;
    for (let ms = 0; ms <= TALLY_MS; ms += 16) {
      const v = tallyValue(1234, ms);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(tallyValue(1234, 0)).toBe(0);
  });

  it("走完一定精确等于终值，一块钱都不能差", () => {
    for (const total of [0, 7, 240, 1234, 99999]) {
      expect(tallyValue(total, TALLY_MS)).toBe(total);
      expect(tallyValue(total, TALLY_MS * 5)).toBe(total);
    }
  });

  it("是缓出的：前半段就跳掉了大半（不然看着像卡住）", () => {
    expect(tallyValue(1000, TALLY_MS / 2)).toBeGreaterThan(600);
  });
});

/* ---------------- 照明圈 ---------------- */

describe("1.2 照明圈不许压住 UI", () => {
  it("最暗处也不是全黑，矿石始终认得出来", () => {
    expect(LIGHT_MAX_DIM).toBeGreaterThan(0);
    expect(LIGHT_MAX_DIM).toBeLessThan(0.7);
  });

  it("只压地面线以下，悬挂点那一带不压暗", () => {
    expect(LIGHT_BAND_TOP).toBeGreaterThan(PIVOT_Y);
  });

  it("深度曲线是先收后平：到某一层收到下限，再深也不会更暗", () => {
    const floorAt = lightFloorDepth();
    expect(lightRadius(floorAt)).toBe(LIGHT_MIN);
    expect(lightRadius(floorAt - 1)).toBeGreaterThan(LIGHT_MIN);
    expect(lightRadius(floorAt + 50)).toBe(LIGHT_MIN);
  });
});

/* ---------------- 360px 版面 ---------------- */

/** 取某个选择器块里的一条声明 */
function decl(selector: string, prop: string): string | null {
  const i = CSS.indexOf(selector + "{");
  if (i < 0) return null;
  const body = CSS.slice(i + selector.length + 1, CSS.indexOf("}", i));
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);
  return m ? m[1].trim() : null;
}

/** 取 @media (max-width:420px) 那一整块 */
function narrowBlock(): string {
  const i = CSS.indexOf("@media (max-width:420px){");
  expect(i).toBeGreaterThan(-1);
  let depth = 1;
  let j = CSS.indexOf("{", i) + 1;
  const from = j;
  while (j < CSS.length && depth > 0) {
    if (CSS[j] === "{") depth++;
    else if (CSS[j] === "}") depth--;
    j++;
  }
  return CSS.slice(from, j - 1);
}

describe("1.2 360px 版面下限", () => {
  it("顶部金额、目标与剩余时间字号都不小于 14px", () => {
    for (const sel of [".gdh-chip", ".gdh-bar-txt"]) {
      expect(decl(sel, "font-size"), sel).toBe(`${HUD_MIN_FONT}px`);
    }
    expect(HUD_MIN_FONT).toBeGreaterThanOrEqual(14);
  });

  it("窄屏那一块里没有人偷偷把顶部字号又缩回去", () => {
    const narrow = narrowBlock();
    expect(narrow).not.toMatch(/\.gdh-chip\s*\{/);
    expect(narrow).not.toMatch(/\.gdh-bar-txt\s*\{/);
    expect(narrow).not.toMatch(/\.gdh-kit\s*\{[^}]*font-size/);
  });

  it("底部按钮与道具栏热区不小于 44px", () => {
    expect(TOUCH_MIN).toBeGreaterThanOrEqual(44);
    for (const sel of [".gdh-btn", ".gdh-kit", ".gdh-buy"]) {
      expect(decl(sel, "min-height"), sel).toBe(`${TOUCH_MIN}px`);
    }
    expect(decl(".gdh-btn", "min-width")).toBe(`${TOUCH_MIN}px`);
  });

  it("底部永远是一行，不许换行成两排", () => {
    expect(decl(".gdh-ctrl", "flex-wrap")).toBe("nowrap");
    expect(decl(".gdh-hud", "flex-wrap")).toBe("nowrap");
    // 窄屏靠收起文字腾地方，而不是缩热区
    expect(narrowBlock()).toMatch(/\.gdh-btn \.gdh-lb\{display:none;\}/);
    expect(narrowBlock()).not.toMatch(/min-height/);
  });

  it("放绳按钮的文字在窄屏上也留着（主操作不能只剩一个图标）", () => {
    expect(narrowBlock()).toMatch(/\.gdh-btn-fire \.gdh-lb\{display:inline;\}/);
  });

  it("prefers-reduced-motion 下位移与过渡全停掉", () => {
    const i = CSS.indexOf("@media (prefers-reduced-motion:reduce){");
    expect(i).toBeGreaterThan(-1);
    const block = CSS.slice(i, CSS.indexOf("}\n`", i));
    expect(block).toMatch(/transform:none/);
    expect(block).toMatch(/\.gdh-bar-fill\{transition:none;\}/);
    expect(block).toMatch(/\.gdh-toast\{transition:none;\}/);
  });

  it("样式全走 gdh- 前缀，一条都没漏", () => {
    const classes = new Set(CSS.match(/\.[a-z][a-z0-9-]*/g) ?? []);
    for (const cls of classes) expect(cls, cls).toMatch(/^\.gdh-/);
  });
});

/* ---------------- 无尽成绩：1.1 金币 → 1.2 层深 ---------------- */

describe("1.2 无尽成绩迁移", () => {
  it("新 key 是新增的，前缀跟着平台走", () => {
    expect(ENDLESS_KEY).toBe("yiduo-yixing.gold-hook.endless.v12");
  });

  it("第一次进来把 1.1 的金币纪录搬过来，层深从零起（不会显示成 800 层）", () => {
    const migrated = migrateEndlessBest(null, 820);
    expect(migrated.coins).toBe(820);
    expect(migrated.depth).toBe(0);
  });

  it("搬过一次之后就以自己那份为准，但金币纪录只会取大的", () => {
    const stored = JSON.stringify({ depth: 9, coins: 500 });
    expect(migrateEndlessBest(stored, 820)).toEqual({ depth: 9, coins: 820 });
    expect(migrateEndlessBest(stored, 100)).toEqual({ depth: 9, coins: 500 });
  });

  it("存坏了不崩，退回迁移分支", () => {
    expect(migrateEndlessBest("{坏掉的", 30)).toEqual({ depth: 0, coins: 30 });
    expect(migrateEndlessBest("null", 30)).toEqual({ depth: 0, coins: 30 });
    expect(migrateEndlessBest(JSON.stringify({ depth: "x" }), 0)).toEqual({ depth: 0, coins: 0 });
  });

  it("纪录只增不减", () => {
    const prev = { depth: 12, coins: 900 };
    expect(mergeEndlessBest(prev, 3, 100)).toEqual(prev);
    expect(mergeEndlessBest(prev, 14, 1200)).toEqual({ depth: 14, coins: 1200 });
    expect(mergeEndlessBest(prev, NaN, Infinity)).toEqual(prev);
  });

  it("没纪录时不硬凑一句话，有纪录才写", () => {
    expect(bestLine({ depth: 0, coins: 0 })).toBe("");
    expect(bestLine({ depth: 0, coins: 400 })).toContain("400");
    const line = bestLine({ depth: 6, coins: 400 });
    expect(line).toContain("第 6 层");
    expect(line).toContain("400");
  });
});
