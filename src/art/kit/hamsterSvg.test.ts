// 共享美术套件 · 参数化 SVG 仓鼠单测(窗口 6 第 18 步 C 档):
// 四朝向独立路径(非翻转)/ 双款剪影可分 / 推箱与滑冰姿态 / 咀嚼两帧 /
// 双款 × 四朝向共 8 份快照全部入测。
import { describe, expect, it } from "vitest";
import {
  PUSH_LEAN_DEG,
  hamsterBodyPath,
  hamsterSvg,
  type HamsterFacing,
  type HamsterStyle,
} from "./hamsterSvg";

const STYLE_A: HamsterStyle = {
  fur: "#E8B27A",
  belly: "#F9EBD6",
  ear: "round",
  topper: "flower",
  topperColor: "#F4859F",
};
const STYLE_B: HamsterStyle = {
  fur: "#C9CFEA",
  belly: "#F0F3FB",
  ear: "fold",
  topper: "cowlick",
  topperColor: "#8FA0D6",
};

const FACINGS: HamsterFacing[] = [0, 1, 2, 3];

describe("hamsterSvg · 四朝向是四条路径,不是翻转", () => {
  it("身体路径两两不同", () => {
    const paths = FACINGS.map((f) => hamsterBodyPath(f));
    expect(new Set(paths).size).toBe(4);
  });

  it("整张 SVG 里没有 scaleX(-1) 这类镜像翻转", () => {
    for (const f of FACINGS) {
      const svg = hamsterSvg({ style: STYLE_A, facing: f });
      expect(svg).not.toContain("scaleX(-1)");
      expect(svg).not.toContain("scale(-1");
    }
  });

  it("上是背影(无眼无嘴有居中尾巴),下是正脸(双眼双腮无尾巴)", () => {
    const up = hamsterSvg({ style: STYLE_A, facing: 0 });
    const down = hamsterSvg({ style: STYLE_A, facing: 2 });
    expect(up).not.toContain("bhh-mouth");
    expect(up).toContain("bhh-tail");
    expect(up).toContain('cx="32"');
    expect(down).toContain("bhh-mouth");
    expect(down).not.toContain("bhh-tail");
    expect(down).toContain("bhh-belly");
  });

  it("左右侧脸是侧脸单腮,且左右的路径数字互不相同", () => {
    const right = hamsterSvg({ style: STYLE_A, facing: 1 });
    const left = hamsterSvg({ style: STYLE_A, facing: 3 });
    expect(right).not.toBe(left);
    expect(hamsterBodyPath(1)).not.toBe(hamsterBodyPath(3));
    // 单腮:侧脸只有一团腮帮(静态帧里只出现一个 cheek 圆)
    const cheekCircles = (svg: string): number => (svg.match(/bhh-cheeks/g) ?? []).length;
    expect(cheekCircles(right)).toBeGreaterThan(0);
  });
});

describe("hamsterSvg · 双款剪影可分(耳形 + 头饰双通道)", () => {
  it("A 圆耳小花 / B 折耳呆毛,两款 SVG 完全不同", () => {
    for (const f of FACINGS) {
      const a = hamsterSvg({ style: STYLE_A, facing: f });
      const b = hamsterSvg({ style: STYLE_B, facing: f });
      expect(a).not.toBe(b);
      expect(a).toContain("bhh-topper-flower");
      expect(b).toContain("bhh-topper-cowlick");
    }
  });

  it("毛色跟 style 走:A 用 #E8B27A 系,B 用 #C9CFEA 系", () => {
    const a = hamsterSvg({ style: STYLE_A, facing: 2 });
    const b = hamsterSvg({ style: STYLE_B, facing: 2 });
    expect(a).toContain("#E8B27A");
    expect(b).toContain("#C9CFEA");
    expect(a).not.toContain("#C9CFEA");
  });
});

describe("hamsterSvg · 姿态", () => {
  it("推箱姿态:data-pose=push、侧向前倾 12°、双爪抵箱 + 后腿蹬地", () => {
    const right = hamsterSvg({ style: STYLE_A, facing: 1, pose: "push" });
    expect(right).toContain('data-pose="push"');
    expect(right).toContain(`rotate(${PUSH_LEAN_DEG} 32 40)`);
    expect(right).toContain("bhh-paws-push");
    const left = hamsterSvg({ style: STYLE_A, facing: 3, pose: "push" });
    expect(left).toContain(`rotate(-${PUSH_LEAN_DEG} 32 40)`);
  });

  it("滑冰姿态:张开小爪 + 「哇」圆嘴", () => {
    const svg = hamsterSvg({ style: STYLE_A, facing: 1, pose: "slide" });
    expect(svg).toContain("bhh-paws-slide");
    expect(svg).toContain("bhh-mouth-wow");
  });

  it("idle 姿态既没有推箱爪也没有哇嘴", () => {
    const svg = hamsterSvg({ style: STYLE_A, facing: 2 });
    expect(svg).toContain("bhh-paws-idle");
    expect(svg).not.toContain("bhh-mouth-wow");
    expect(svg).not.toContain("bhh-paws-push");
  });
});

describe("hamsterSvg · 咀嚼两帧与底影", () => {
  it("给 chewClass 输出 a / b 两帧腮帮,不给就只有静态一组", () => {
    const chewing = hamsterSvg({ style: STYLE_A, facing: 2, chewClass: "bxh-chew" });
    expect(chewing).toContain("bxh-chew-a");
    expect(chewing).toContain("bxh-chew-b");
    const still = hamsterSvg({ style: STYLE_A, facing: 2 });
    expect(still).not.toContain("bxh-chew");
  });

  it("底影椭圆按格宽 60% / 高 14% 打底", () => {
    const svg = hamsterSvg({ style: STYLE_A, facing: 2 });
    expect(svg).toContain('class="bhh-shadow"');
    expect(svg).toContain('rx="19.2"');
    expect(svg).toContain('ry="4.5"');
  });

  it("输出是纯矢量:没有位图也没有外链", () => {
    const svg = hamsterSvg({ style: STYLE_B, facing: 1, pose: "push", chewClass: "x" });
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("http");
  });
});

describe("hamsterSvg · 双款 × 四朝向 8 份快照", () => {
  const combos: Array<[string, HamsterStyle, HamsterFacing]> = [];
  for (const [name, style] of [
    ["A", STYLE_A],
    ["B", STYLE_B],
  ] as const) {
    for (const f of FACINGS) combos.push([`${name}-朝向${f}`, style, f]);
  }

  it.each(combos)("%s 快照", (_name, style, facing) => {
    expect(hamsterSvg({ style, facing, chewClass: "bxh-chew" })).toMatchSnapshot();
  });

  it("8 份快照两两不同", () => {
    const svgs = combos.map(([, style, facing]) => hamsterSvg({ style, facing }));
    expect(new Set(svgs).size).toBe(8);
  });
});
