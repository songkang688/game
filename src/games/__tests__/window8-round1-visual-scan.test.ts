/**
 * 窗口 8 · 1.3 视觉升级 · 第 1 轮验收沉淀的机器化扫描（测试员新增）。
 *
 * 范围锁死本窗 12 款。四类静态断言，给第 2/3 轮直接复跑：
 *  ① 火柴人纪律：实现代码禁止 `fillText(` 直出（emoji 画布直出的老路）；
 *  ② 商标纪律：实现代码 0 商标词（各款 *.test.ts 里的扫描名单不算产品文案）；
 *  ③ 双人可区分：跑者背心号码 1/2、拔河头带 vs 鸭舌帽 + 蓝队镜像，三通道证据钉死；
 *  ④ 2.5D 点名款：red-blue-race 的透视赛道（perspective + rotateX）不许退化。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RACE_LOOKS, runnerSvg } from "../../art/kit/runnerSvg";
import { tugPullerSvg } from "../../art/kit/tugTeam";
import { GEM_STOPS, gemGradient } from "../../art/kit/gem";
import { starSvg } from "../../art/kit/glowStar";

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const WINDOW8_IDS = [
  "red-blue-race",
  "red-blue-tap",
  "red-blue-tug",
  "clock-house",
  "math-farm",
  "pinyin-train",
  "word-garden",
  "shape-kingdom",
  "find-diff",
  "color-fun",
  "music-stars",
  "kitty-care"
] as const;

/** 某款游戏的全部「实现」源码（排除 *.test.ts，测试文件里放的是扫描名单不是文案） */
function implSources(id: string): Array<{ file: string; text: string }> {
  const dir = join(GAMES_DIR, id);
  const out: Array<{ file: string; text: string }> = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (!statSync(p).isFile()) continue;
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    out.push({ file: `${id}/${f}`, text: readFileSync(p, "utf8") });
  }
  return out;
}

describe("窗口 8 · 专项① 火柴人纪律", () => {
  it("12 款实现代码没有一处 fillText( 画布直出", () => {
    const hits: string[] = [];
    for (const id of WINDOW8_IDS) {
      for (const { file, text } of implSources(id)) {
        if (text.includes("fillText(")) hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("窗口 8 · 专项⑥ 商标纪律", () => {
  // 词表拆开写，免得这份测试自己被逐字 grep 时误报成「产品文案出现商标」
  const BANNED = [
    "43" + "99",
    "任天" + "堂",
    "nin" + "tendo",
    "迪士" + "尼",
    "dis" + "ney",
    "马里" + "奥",
    "mar" + "io",
    "皮卡" + "丘",
    "pika" + "chu",
    "宝可" + "梦",
    "poke" + "mon",
    "hello " + "kitty",
    "凯蒂" + "猫",
    "汤姆" + "猫",
    "托马" + "斯",
    "tho" + "mas",
    "bomber" + "man",
    "米老" + "鼠",
    "mic" + "key",
    "奥特" + "曼",
    "ultra" + "man"
  ];

  it("12 款实现代码 0 商标词命中", () => {
    const hits: string[] = [];
    for (const id of WINDOW8_IDS) {
      for (const { file, text } of implSources(id)) {
        const low = text.toLowerCase();
        for (const w of BANNED) {
          if (low.includes(w)) hits.push(`${file} ← ${w}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("窗口 8 · 专项③ 双人可区分的结构通道", () => {
  it("红蓝跑者背心号码 1 / 2 两个附件通道齐备", () => {
    const red = runnerSvg({ look: RACE_LOOKS.red, phase: 0, idPrefix: "w8r" });
    const blue = runnerSvg({ look: RACE_LOOKS.blue, phase: 0, idPrefix: "w8b" });
    expect(red).toContain(">1</text>");
    expect(blue).toContain(">2</text>");
    expect(red).not.toContain(">2</text>");
    expect(blue).not.toContain(">1</text>");
  });

  it("拔河领队：红队头带、蓝队鸭舌帽，剪影通道各归各", () => {
    const red = tugPullerSvg({ side: "red", role: "leader", pose: "pull" });
    const blue = tugPullerSvg({ side: "blue", role: "leader", pose: "pull" });
    expect(red).toContain('data-part="headband"');
    expect(red).not.toContain('data-part="hat"');
    expect(blue).toContain('data-part="hat"');
    expect(blue).not.toContain('data-part="headband"');
  });

  it("拔河蓝队整体镜像（朝向通道），红队不镜像", () => {
    const red = tugPullerSvg({ side: "red", role: "member", pose: "pull" });
    const blue = tugPullerSvg({ side: "blue", role: "member", pose: "pull" });
    expect(blue).toContain("scale(-1 1)");
    expect(red).not.toContain("scale(-1 1)");
  });
});

describe("窗口 8 · 专项④ 2.5D 点名款不许退化", () => {
  it("red-blue-race 赛道保有 perspective + rotateX 透视", () => {
    const src = readFileSync(join(GAMES_DIR, "red-blue-race", "index.ts"), "utf8");
    expect(src).toMatch(/perspective:\s*\d+px/);
    expect(src).toMatch(/rotateX\(\s*\d+(\.\d+)?deg\s*\)/);
  });
});

describe("窗口 8 · 专项② 收集物体积感（kit 契约）", () => {
  it("宝石四色都是三停渐变（受光 135°），不是平涂", () => {
    expect(GEM_STOPS.length).toBe(4);
    for (let i = 0; i < GEM_STOPS.length; i++) {
      const g = gemGradient(i);
      expect(g).toContain("135deg");
      expect(g.split(",").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("发光星星带描边与星心高光，不是平涂圆贴字符", () => {
    const svg = starSvg(24, "#ffd93d");
    expect(svg).toContain("stroke=");
    expect(svg).toContain("rgba(255,255,255,.9)");
    expect(svg).toContain("<polygon");
  });
});
