/**
 * W8R1-07 · 前 99 关旧题面钟消费端换装的钉子（窗口 8 第 2 轮监督修复员）。
 *
 * 第 1 轮挂账：clockSVG 产物进了 promptHTML，被 LEGACY_DIGEST 逐字节钉死。
 * 本轮修法：渲染后就地换装（faceLift），题库字符串零改动。这里钉六件事：
 *   1. 指针换装：细线时针/分针 → arrowHandD 胖/细箭头，针尖坐标 = 老 line 的
 *      x2/y2（角度公式零改动）、配色 = CLK_TOKENS.hourOrange / minuteTeal；
 *   2. 轴心换 hubSVG、刻度数字 9px → 11px；
 *   3. 幂等：换过的钟面再喂进来是恒等映射；
 *   4. 全量扫：前 99 关每一张旧钟面（题面 + 选项）都换得干净——细线清零；
 *   5. 题库零改动：buildQuestions 的输出字符串在换装前后各跑一次逐字节一致
 *      （换装是 DOM 层的事，纯函数世界一个字节都不许被它碰）；
 *   6. 运行时接线：liftFacesIn 幂等 + runner 挂载/destroy 断开。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLK_TOKENS, HOUR_HAND_SHAPE, MINUTE_HAND_SHAPE, arrowHandD } from "./house";
import { LIFT_ATTR, liftFaceBody, liftFacesIn } from "./faceLift";
import { hourHandAngle, minuteHandAngle, type Quarter } from "./logic";
import { buildQuestions, clockSVG } from "./levels";

/** 1.1 细线钟面（liftFaceBody 的入料夹具；产品 clockSVG 已换装） */
function oldClockSVG(hour: number, quarter: Quarter, size: number, label = "钟面，自己读一读"): string {
  const cx = 50, cy = 50;
  const hA = ((hourHandAngle(hour, quarter) - 90) * Math.PI) / 180;
  const mA = ((minuteHandAngle(quarter) - 90) * Math.PI) / 180;
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const nx = cx + Math.cos(a) * 36;
    const ny = cy + Math.sin(a) * 36;
    ticks += `<text x="${nx.toFixed(1)}" y="${(ny + 3.4).toFixed(1)}" font-size="9" font-weight="800" text-anchor="middle" fill="#5c4a7d">${i === 0 ? 12 : i}</text>`;
  }
  return `<svg data-h="${hour}" data-q="${quarter}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${label}">
    <circle cx="${cx}" cy="${cy}" r="46" fill="#fff" stroke="#845ef7" stroke-width="5"/>
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(hA) * 20).toFixed(1)}" y2="${(cy + Math.sin(hA) * 20).toFixed(1)}" stroke="#e8590c" stroke-width="6" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(mA) * 30).toFixed(1)}" y2="${(cy + Math.sin(mA) * 30).toFixed(1)}" stroke="#1971c2" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="3.4" fill="#5c4a7d"/>
  </svg>`;
}

/** 老钟面里两根细线的针尖坐标（宽 6 = 时针，宽 4 = 分针） */
function lineTips(svg: string): { hour: [number, number]; minute: [number, number] } {
  const out: Record<string, [number, number]> = {};
  for (const m of svg.matchAll(/<line x1="50" y1="50" x2="([\d.]+)" y2="([\d.]+)"[^/]*stroke-width="(6|4)"/g)) {
    out[m[3] === "6" ? "hour" : "minute"] = [Number(m[1]), Number(m[2])];
  }
  return out as { hour: [number, number]; minute: [number, number] };
}

describe("W8R1-07 · liftFaceBody 换装工序", () => {
  const face = oldClockSVG(4, 1, 120);
  const lifted = liftFaceBody(face);

  it("时针/分针换 arrowHandD 箭头：针尖 = 老 line 端点，色 = 规格 token", () => {
    const tips = lineTips(face);
    expect(lifted).toContain(`d="${arrowHandD(50, 50, tips.hour[0], tips.hour[1], HOUR_HAND_SHAPE)}"`);
    expect(lifted).toContain(`d="${arrowHandD(50, 50, tips.minute[0], tips.minute[1], MINUTE_HAND_SHAPE)}"`);
    expect(lifted).toContain(`fill="${CLK_TOKENS.hourOrange}"`);
    expect(lifted).toContain(`fill="${CLK_TOKENS.minuteTeal}"`);
    expect(lifted).not.toContain("<line");
  });

  it("轴心换 hubSVG 木色铆钉，刻度数字 9px → 11px", () => {
    expect(lifted).not.toContain('r="3.4" fill="#5c4a7d"');
    expect(lifted).toContain('class="clk-hub"');
    expect(lifted).not.toContain('font-size="9"');
    expect((lifted.match(/font-size="11"/g) ?? []).length).toBe(12);
  });

  it("svg 开标签与 data-h / data-q / aria-label 一字不动", () => {
    const head = face.slice(0, face.indexOf(">") + 1);
    expect(lifted.startsWith(head)).toBe(true);
    expect(lifted).toContain('data-h="4" data-q="1"');
  });

  it("真机 innerHTML 把 line 写成 </line>、属性乱序也能换装", () => {
    const serial =
      `<line stroke-width="6" stroke="#e8590c" y2="40.0" x2="50.0" y1="50" x1="50" stroke-linecap="round"></line>` +
      `<line stroke="#1971c2" stroke-width="4" x1="50" y1="50" x2="80.0" y2="50.0" stroke-linecap="round"></line>` +
      `<circle fill="#5c4a7d" r="3.4" cy="50" cx="50"></circle>`;
    const lifted = liftFaceBody(serial);
    expect(lifted).toContain("clk-lift-hour");
    expect(lifted).toContain("clk-lift-minute");
    expect(lifted).toContain('class="clk-hub"');
    expect(lifted).not.toContain("<line");
  });

  it("幂等：换过的钟面再喂进来是恒等映射", () => {
    expect(liftFaceBody(lifted)).toBe(lifted);
  });
});

describe("W8R1-07 · 前 99 关全量扫", () => {
  it("每一张旧钟面（题面 + 选项）都换得干净：细线清零、箭头双色齐", () => {
    for (let level = 0; level < 99; level++) {
      for (const q of buildQuestions(level)) {
        for (const html of [q.promptHTML, ...q.choices]) {
          if (!html.includes("data-h=")) continue;
          expect(html, `第 ${level + 1} 关`).not.toContain("<line");
          expect(html, `第 ${level + 1} 关`).toContain("clk-lift-hour");
          expect(html, `第 ${level + 1} 关`).toContain("clk-lift-minute");
          expect(html, `第 ${level + 1} 关`).toContain('class="clk-hub"');
          expect(liftFaceBody(html), `第 ${level + 1} 关幂等`).toBe(html);
        }
      }
    }
  });

  it("题库零改动：换装前后 buildQuestions 输出逐字节一致（纯函数世界不受扰）", () => {
    const before = JSON.stringify(buildQuestions(0));
    liftFaceBody(clockSVG(7, 2, 120));
    expect(JSON.stringify(buildQuestions(0))).toBe(before);
  });
});

describe("trio-r7 L-2 · DOM 序列化写法也换得动（真机补账）", () => {
  /** 浏览器 innerHTML 重排:`<line …/>` → `<line …></line>`,`<circle …/>` → `<circle …></circle>` */
  function domSerialized(svg: string): string {
    return svg
      .replace(/(<line [^>]*)\/>/g, "$1></line>")
      .replace(/(<circle [^>]*)\/>/g, "$1></circle>");
  }

  it("序列化后的钟面:指针换箭头、轴心换铆钉、细线清零", () => {
    const face = clockSVG(4, 1, 120);
    const inner = face.slice(face.indexOf(">") + 1, face.lastIndexOf("</svg>"));
    const lifted = liftFaceBody(domSerialized(inner));
    expect(lifted).toContain("clk-lift-hour");
    expect(lifted).toContain("clk-lift-minute");
    expect(lifted).toContain('class="clk-hub"');
    expect(lifted).not.toContain("<line");
    expect(lifted).not.toContain('r="3.4" fill="#5c4a7d"');
  });

  it("序列化前后换装产物一致:两条路走出同一张钟面(归一化到序列化形态再比)", () => {
    const face = clockSVG(9, 2, 82, "钟面");
    const inner = face.slice(face.indexOf(">") + 1, face.lastIndexOf("</svg>"));
    // 换装新插入的 hubSVG 本身是自闭合写法,两条路都过一遍序列化归一后必须逐字节相同
    expect(domSerialized(liftFaceBody(domSerialized(inner)))).toBe(domSerialized(liftFaceBody(inner)));
  });

  it("前 99 关全量扫:序列化形态一样细线清零", () => {
    for (let level = 0; level < 99; level += 7) {
      for (const q of buildQuestions(level)) {
        for (const html of [q.promptHTML, ...q.choices]) {
          if (!html.includes("data-h=")) continue;
          const lifted = liftFaceBody(domSerialized(html));
          expect(lifted, `第 ${level + 1} 关`).not.toContain("<line");
          expect(lifted, `第 ${level + 1} 关`).toContain("clk-lift-hour");
        }
      }
    }
  });
});

describe("W8R1-07 · 运行时接线", () => {
  /** 极简元素桩：liftFacesIn 只用 querySelectorAll / get/setAttribute / innerHTML */
  class FakeSvg {
    readonly attrs = new Map<string, string>();
    constructor(public innerHTML: string) {}
    getAttribute(name: string): string | null {
      return this.attrs.get(name) ?? null;
    }
    setAttribute(name: string, value: string): void {
      this.attrs.set(name, value);
    }
  }

  function fakeHost(faces: FakeSvg[]): Element {
    return { querySelectorAll: (sel: string) => (sel === "svg[data-h]" ? faces : []) } as unknown as Element;
  }

  it("liftFacesIn：首趟全换 + 打标记，第二趟 0 面（幂等）", () => {
    const face = oldClockSVG(9, 3, 82, "钟面");
    const inner = face.slice(face.indexOf(">") + 1, face.lastIndexOf("</svg>"));
    const faces = [new FakeSvg(inner), new FakeSvg(inner)];
    const host = fakeHost(faces);
    expect(liftFacesIn(host)).toBe(2);
    for (const f of faces) {
      expect(f.getAttribute(LIFT_ATTR)).toBe("1");
      expect(f.innerHTML).toContain("clk-lift-hour");
    }
    expect(liftFacesIn(host)).toBe(0);
  });

  it("runner 挂载在 helper 之后、destroy 里断开（源码接缝防拆线）", () => {
    const src = readFileSync(new URL("./runner.ts", import.meta.url), "utf8");
    expect(src).toContain("const lift: FaceLiftHandle = mountFaceLift(host);");
    expect(src).toContain("lift.destroy();");
  });
});
