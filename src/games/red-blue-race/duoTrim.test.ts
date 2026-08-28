/**
 * W8R1-05（严重）修复钉子：红蓝跑者剪影级可区分。
 *
 * 测试员量化口径原样复现：sharp 把双方 SVG 栅格化到 16×16 灰度（白底 flatten），
 * 逐像素 |ΔL| ≥ 24/255 记「可分辨像素」，修前 0.0%，验收线 ≥15%。
 * 另钉住三件事：装饰层结构通道齐备、原 SVG 串一字未动、
 * 装饰层照抄的 headDy / torsoDy / 鞋位表与 runnerSvg 实际输出不漂移。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { RACE_LOOKS, runnerSvg, type RunnerPose } from "../../art/kit/runnerSvg";
import { trimHeadDy, trimRunnerSvg, trimShoeSpots, trimTorsoDy } from "../../art/kit/runnerDuoTrim";

const FRAMES: Array<{ key: string; pose: RunnerPose; phase: number }> = [
  { key: "run0", pose: "run", phase: 0 },
  { key: "run1", pose: "run", phase: 1 },
  { key: "jump", pose: "jump", phase: 0 },
  { key: "slip", pose: "slip", phase: 0 }
];

function duo(pose: RunnerPose, phase: number): { red: string; blue: string } {
  return {
    red: trimRunnerSvg(runnerSvg({ look: RACE_LOOKS.red, pose, phase, idPrefix: "dtR" }), "red", { pose, phase }),
    blue: trimRunnerSvg(runnerSvg({ look: RACE_LOOKS.blue, pose, phase, idPrefix: "dtB" }), "blue", { pose, phase })
  };
}

async function gray16(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(16, 16, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer();
}

describe("W8R1-05 · 16px 灰度可分辨像素 ≥15%", () => {
  for (const f of FRAMES) {
    it(`${f.key} 帧红蓝可分辨（修前 0.0%）`, async () => {
      const { red, blue } = duo(f.pose, f.phase);
      const [a, b] = await Promise.all([gray16(red), gray16(blue)]);
      let count = 0;
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) >= 24) count++;
      }
      expect((100 * count) / a.length).toBeGreaterThanOrEqual(15);
    });
  }
});

describe("W8R1-05 · 装饰层结构通道", () => {
  it("红方=双丸子头+亮带，蓝方=反戴帽舌+深带，剪影通道各归各", () => {
    const { red, blue } = duo("run", 0);
    expect(red).toContain('data-duo-trim="red"');
    expect(red).toContain('data-trim="red-buns"');
    expect(red).not.toContain('data-trim="blue-visor"');
    expect(blue).toContain('data-duo-trim="blue"');
    expect(blue).toContain('data-trim="blue-visor"');
    expect(blue).not.toContain('data-trim="red-buns"');
    for (const svg of [red, blue]) {
      expect(svg).toContain('data-trim-part="bands"');
      expect(svg).toContain('data-trim-part="scarf"');
      expect(svg).toContain('data-trim-part="cuffs"');
    }
  });

  it("装饰只做尾部注入：原 runnerSvg 串一字不改；号码 1/2 通道保留", () => {
    for (const f of FRAMES) {
      const base = runnerSvg({ look: RACE_LOOKS.red, pose: f.pose, phase: f.phase, idPrefix: "dtK" });
      const out = trimRunnerSvg(base, "red", { pose: f.pose, phase: f.phase });
      expect(out.startsWith(base.slice(0, base.lastIndexOf("</svg>")))).toBe(true);
      expect(out.endsWith("</svg>")).toBe(true);
      expect(out).toContain(">1</text>");
    }
    const blue = trimRunnerSvg(runnerSvg({ look: RACE_LOOKS.blue, idPrefix: "dtK2" }), "blue");
    expect(blue).toContain(">2</text>");
  });

  it("残串 / 非法输入原样返回，不抛错", () => {
    expect(trimRunnerSvg("<svg>no close tag", "red")).toBe("<svg>no close tag");
    expect(trimRunnerSvg("", "blue")).toBe("");
  });

  it("配件不引入任何 id / defs（同页多实例零冲突）", () => {
    const { red, blue } = duo("run", 0);
    for (const svg of [red, blue]) {
      const layer = svg.slice(svg.indexOf("<g data-duo-trim"));
      expect(layer).not.toContain(" id=");
      expect(layer).not.toContain("<defs");
    }
  });
});

describe("W8R1-05 · 照抄的姿态偏移表与 runnerSvg 不漂移", () => {
  it("headDy / torsoDy：装饰表与 runnerSvg 输出坐标一致", () => {
    for (const f of FRAMES) {
      const svg = runnerSvg({ look: RACE_LOOKS.red, pose: f.pose, phase: f.phase, idPrefix: "dtP" });
      const hy = trimHeadDy(f.pose, f.phase);
      // 头心圆：cx=41 cy=15+hy（runnerSvg 写死的骨架）
      expect(svg).toContain(`<circle cx="41" cy="${15 + hy}" r="10"`);
      expect(svg).toContain(`translate(0 ${trimTorsoDy(f.pose)})`);
    }
  });

  it("鞋位表：装饰表与 runnerSvg 的鞋心椭圆一致", () => {
    for (const f of FRAMES) {
      const svg = runnerSvg({ look: RACE_LOOKS.red, pose: f.pose, phase: f.phase, idPrefix: "dtS" });
      for (const [x, y] of trimShoeSpots(f.pose, f.phase)) {
        expect(svg).toContain(`<ellipse cx="${x}" cy="${y}" rx="5" ry="3"`);
      }
    }
  });

  it("race 帧装配处四帧都套了装饰（index.ts 集成钉子）", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");
    const frames = src.slice(src.indexOf("function runnerFramesHtml"), src.indexOf("function buildLane"));
    expect(frames.match(/trimRunnerSvg\(/g)?.length).toBe(4);
    expect(frames).toContain("RACE_LOOKS[side]");
  });
});
