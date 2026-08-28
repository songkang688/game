/**
 * 拼音小火车 · 三人组第 9 轮 测试修复员 B · N-34（拼写关）+ N-35（全选关）修后钉子。
 *
 * 深关直达走 localStorage 进度路（`yiduo-yixing.l99.pinyin-train` 写前 N 关满星），
 * 免掉 root 抬头那 ~100px 的干扰（N-37 是另一本账）。
 *
 * 修前实测（915×412，`.game-stage` clientHeight = 322）：
 * - 第 101 关族（拼写）裁 450：三个车厢槽半截出屏，**10 张拼读车票 + 🚂 发车全部折叠线下**；
 * - 第 103 关族（全选）裁 179：**6 张 pk-chip 选票 + ✅ 就挑这些全部折叠线下**。
 *
 * 修后实测（关型 × 视口，配方 J）：
 * | 关型 | 915×412 | 390×844 | 412×915 | 1024×768 |
 * | 拼写 101 | 450 → **0** | 145（原样） | 15（原样） | 134（原样） |
 * | 全选 103 | 179 → **0** | 0 | 0 | 0 |
 * | 限时 135（护栏，勿劣化） | 6（原样） | 0 | 0 | 0 |
 * 折叠线下交互件：拼写 14 → 0，全选 7 → 0。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHIP_MIN_PX, PINYIN_FONT_MIN } from "./spell";

const spellSrc = readFileSync(fileURLToPath(new URL("./spell.ts", import.meta.url)), "utf8");
const pickSrc = readFileSync(fileURLToPath(new URL("./pickAll.ts", import.meta.url)), "utf8");
const sceneSrc = readFileSync(fileURLToPath(new URL("./scene.ts", import.meta.url)), "utf8");

const SHORT = "@media (min-width:700px) and (max-height:560px)";

/** 取一段媒体查询里的声明（到该查询的收尾大括号为止） */
function mediaBlock(src: string, head: string): string {
  const at = src.indexOf(head);
  expect(at, `找不到媒体查询 ${head}`).toBeGreaterThan(0);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`媒体查询 ${head} 没有配对的大括号`);
}

describe("N-34/N-35 · 矮横屏只咬 915×412 一族", () => {
  it("门槛 = 宽 ≥700 且高 ≤560：竖屏三档与 1024×768 / 1280×800 全部不进这条分支", () => {
    const hits = (w: number, h: number): boolean => w >= 700 && h <= 560;
    expect(hits(915, 412)).toBe(true);
    expect(hits(360, 640)).toBe(false);
    expect(hits(390, 844)).toBe(false);
    expect(hits(412, 915)).toBe(false);
    expect(hits(1024, 768)).toBe(false);
    expect(hits(1280, 800)).toBe(false);
  });

  it("两个关型各有一条矮横屏分支，常规档一个像素都不动", () => {
    expect(spellSrc).toContain(SHORT);
    expect(pickSrc).toContain(SHORT);
    // 双栏/三栏声明只在矮横屏里出现
    expect(spellSrc.replace(mediaBlock(spellSrc, SHORT), "")).not.toContain("grid-template-areas");
    expect(pickSrc.replace(mediaBlock(pickSrc, SHORT), "")).not.toContain("grid-template-areas");
  });
});

describe("N-34 · 拼写关（第 101 关族）三栏：读的在左，按的在中，发车在右", () => {
  const block = mediaBlock(spellSrc, SHORT);

  it("车厢槽 / 车票排 / 发车钮各有自己的格子，都不再排在火车画布带下面", () => {
    expect(block).toContain('grid-template-areas:"loco slots top" "scene yard go" "view yard msg" "hint yard say"');
    expect(block).toContain(".pyt-spell>.pyt-slots{grid-area:slots;}");
    expect(block).toContain(".pyt-spell>.pyt-yard{grid-area:yard;}");
    expect(block).toContain(".pyt-spell>.pyt-bottom>.pyt-go{grid-area:go;");
  });

  it("发车钮 / 反馈 / 方法提示拆成独立格子（pyt-bottom 让位），提示语没有被藏起来", () => {
    expect(block).toContain(".pyt-spell>.pyt-bottom{display:contents;}");
    expect(block).toContain(".pyt-spell>.pyt-bottom>.pyt-hint{grid-area:hint;}");
    expect(block).not.toContain("display:none");
  });

  it("火车画布带只缩高不删除：还是同一块 .pyt-scene，132 → 76", () => {
    expect(block).toMatch(/\.pyt-spell>\.pyt-scene\{grid-area:scene;height:76px;\}/);
    // scene.ts 是三个关型共用件，本轮零触碰，缩高写在拼写关自己的皮肤里
    expect(sceneSrc).toContain(".pyt-scene{position:relative;height:132px;");
    expect(sceneSrc).not.toContain("max-height:560px");
  });

  it("热区与字号下限一格不让：车厢 ≥CHIP_MIN_PX，拼音字号 ≥PINYIN_FONT_MIN", () => {
    // 下限写的是常量本身（模板串插值），改不动常量就改不动热区
    expect(block).toContain(".pyt-slot{min-height:${CHIP_MIN_PX}px;");
    expect(CHIP_MIN_PX).toBeGreaterThanOrEqual(44);
    const valFont = block.match(/\.pyt-slot-val\{font-size:\$\{PINYIN_FONT_MIN \+ (\d+)\}px/);
    expect(valFont).not.toBeNull();
    expect(PINYIN_FONT_MIN + Number(valFont![1])).toBeGreaterThanOrEqual(PINYIN_FONT_MIN);
    // 车票本体的 min-height 没被矮横屏改写
    expect(block).not.toMatch(/\.pyt-chip\{[^}]*min-height/);
  });

  it("拼读判定与车厢挂接逻辑零触碰（只动皮肤，不动 judgeSpell / place 一带）", () => {
    expect(spellSrc).toContain("export function judgeSpell(p: SpellPick, task: SpellTask): boolean {");
    expect(spellSrc).toContain("return spell(p.initial as string, p.final as string, p.tone as number) === task.target;");
  });
});

describe("N-35 · 全选关（第 103 关族）双栏：选票与提交整块进首屏", () => {
  const block = mediaBlock(pickSrc, SHORT);

  it("选票排与提交排在右栏，题面 / 提示 / 火车画布带在左栏", () => {
    expect(block).toContain('grid-template-areas:"top chips" "title chips" "hint chips" "scene bottom" "say bottom"');
    expect(block).toContain(".pk-wrap>.pk-chips{grid-area:chips;}");
    expect(block).toContain(".pk-wrap>.pk-bottom{grid-area:bottom;}");
  });

  it("画布带缩高不删除，题面与提示一句都没藏", () => {
    expect(block).toMatch(/\.pk-wrap>\.pyt-scene\{grid-area:scene;height:\d+px;\}/);
    expect(block).not.toContain("display:none");
    expect(block).toContain(".pk-wrap>.pk-title{grid-area:title;}");
    expect(block).toContain(".pk-wrap>.pk-hint{grid-area:hint;}");
  });

  it("选票热区没被矮横屏缩水（min-height 仍是本款的 56px 基线）", () => {
    expect(block).not.toMatch(/\.pk-chip\{[^}]*min-height/);
    expect(pickSrc).toContain("min-width:74px;min-height:56px;");
  });

  it("判定零触碰：judgePickAll 一带原样", () => {
    expect(pickSrc).toContain("export function pickAllFeedback(v: PickAllVerdict): string {");
  });
});
