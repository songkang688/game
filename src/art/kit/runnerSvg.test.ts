import { describe, expect, it } from "vitest";
import { RACE_LOOKS, runnerSvg, type RunnerLook } from "./runnerSvg";

const red = RACE_LOOKS.red;
const blue = RACE_LOOKS.blue;

describe("art-kit · 侧视跑者小人", () => {
  it("输出是完整 svg,不含脚本、不含 NaN", () => {
    const svg = runnerSvg({ look: red });
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.toLowerCase()).not.toContain("<script");
    expect(svg).not.toContain("NaN");
  });

  it("跑姿两帧输出不同路径(摆臂 + 跨步真的在换)", () => {
    const f0 = runnerSvg({ look: red, phase: 0 });
    const f1 = runnerSvg({ look: red, phase: 1 });
    expect(f0).not.toBe(f1);
    // 帧 0 前腿伸到 47,61 一带;帧 1 膝盖前顶收在 39,58 一带
    expect(f0).toContain("47 61");
    expect(f1).toContain("39 58");
    expect(f0).toContain('data-phase="0"');
    expect(f1).toContain('data-phase="1"');
  });

  it("红蓝服装 + 鞋色双通道:各自的背心色与鞋色都落在标记里,且互不相同", () => {
    const r = runnerSvg({ look: red });
    const b = runnerSvg({ look: blue });
    expect(r).toContain(red.vestDark);
    expect(r).toContain(red.shoe);
    expect(b).toContain(blue.vestDark);
    expect(b).toContain(blue.shoe);
    expect(red.vest).not.toBe(blue.vest);
    expect(red.shoe).not.toBe(blue.shoe);
    expect(r).not.toContain(blue.shoe);
  });

  it("背心号码 1 / 2 大字上身", () => {
    expect(runnerSvg({ look: red })).toContain(">1</text>");
    expect(runnerSvg({ look: blue })).toContain(">2</text>");
  });

  it("跳跃收腿:jump 与 run 四肢不同,落地阴影收窄", () => {
    const run = runnerSvg({ look: red, phase: 0 });
    const jump = runnerSvg({ look: red, pose: "jump" });
    expect(jump).not.toBe(run);
    expect(jump).toContain('data-pose="jump"');
    expect(jump).toContain('rx="9.0"'); // 15 * 0.6
    expect(run).toContain('rx="15.0"');
  });

  it("滑倒是坐地 + 头顶三颗转圈星,不是受苦画面", () => {
    const slip = runnerSvg({ look: blue, pose: "slip" });
    expect(slip).toContain('data-pose="slip"');
    expect([...slip.matchAll(/kit-slip-star"/g)].length).toBe(3);
    expect(slip).toContain("kit-slip-stars");
  });

  it("头像位:传 faceHref 就贴图并用圆形 clipPath 裁", () => {
    const svg = runnerSvg({ look: red, faceHref: "avatars/duoduo.svg" });
    expect(svg).toContain('href="avatars/duoduo.svg"');
    expect(svg).toContain("clip-path=\"url(#kitRunner-face)\"");
    // 不传就画简笔笑脸,不留空窟窿
    expect(runnerSvg({ look: red })).not.toContain("<image");
  });

  it("idPrefix 隔离渐变与 clipPath,双实例同页不撞 id", () => {
    const a = runnerSvg({ look: red, idPrefix: "laneRed" });
    const b = runnerSvg({ look: blue, idPrefix: "laneBlue" });
    expect(a).toContain('id="laneRed-vest"');
    expect(b).toContain('id="laneBlue-vest"');
    expect(a).not.toContain("laneBlue");
    // 非法字符被剥掉,id 不会写坏
    expect(runnerSvg({ look: red, idPrefix: 'x"><bad' })).toContain('id="xbad-vest"');
  });

  it("phase 乱传一律当 0,不抛不画坏", () => {
    const weird = runnerSvg({ look: red, phase: Number.NaN });
    expect(weird).toBe(runnerSvg({ look: red, phase: 0 }));
    expect(() => runnerSvg({ look: red, phase: -7 })).not.toThrow();
  });

  it("换肤只换色组不改剪影:同姿态同帧下路径集合一致", () => {
    const strip = (svg: string, look: RunnerLook): string =>
      svg
        .replaceAll(look.vest, "@")
        .replaceAll(look.vestDark, "@")
        .replaceAll(look.shoe, "@")
        .replaceAll(look.cap, "@")
        .replaceAll(`>${look.number}</text>`, ">@</text>");
    const r = strip(runnerSvg({ look: red, idPrefix: "p" }), red);
    const b = strip(runnerSvg({ look: blue, idPrefix: "p" }), blue);
    const paths = (s: string): string[] => [...s.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
    expect(paths(r)).toEqual(paths(b));
  });
});
