/**
 * 1.3 窗口 6 · C 档 · 第 1 轮监督修复员 · W6R1-05 / W6R1-06 修复钉子(mole-pop)。
 * A 档 16px 灰度实测:normal vs flash 0%、vs shield 0%、vs sleepy 0.8% 不可分。
 * 修法:kit 只增不改——新增 moleAccents.ts 叠加层(闪光鼠头顶天线星、
 * 盾面冷灰钢化、瞌睡闭眼弧加粗 + 瞌睡泡描边),moleSvg.ts 一字未动。
 * 这里用与 A 档同一把尺(sharp 栅格化 16×16 灰度,灰阶差 >24 的像素占比)
 * 把 diffPct ≥3% 钉死,防回退。
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { moleSvg } from "../../art/kit/moleSvg";
import {
  DROWSE_BUBBLE_INK,
  FLASH_STAR_FILL,
  SHIELD_STEEL,
  drowseBoldGroup,
  flashCrestGroup,
  injectAccents,
  shieldSteelGroup,
} from "../../art/kit/moleAccents";
import { gearSvgFor, moleFaceSvg } from "./visual";

/** A 档同款量尺:白底合成 → 16×16 → 灰度,逐像素比 */
async function gray16(svg: string): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: "#FFFFFF" })
    .resize(16, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = data[i * info.channels];
  return out;
}

function diffPct(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
  return (n / a.length) * 100;
}

describe("窗口6 r1 fixer · W6R1-05/06 地鼠一家 16px 灰度可分", () => {
  it("闪光鼠 vs 普通鼠:16px 灰度 diffPct ≥3%(修前 0%)", async () => {
    const normal = await gray16(moleSvg({ size: 64 }));
    const flash = await gray16(injectAccents(moleSvg({ sparkle: true, size: 64 }), [flashCrestGroup()]));
    expect(diffPct(normal, flash)).toBeGreaterThanOrEqual(3);
  });

  it("盾鼠(含钢化盾面) vs 普通鼠:16px 灰度 diffPct ≥3%(修前 0%)", async () => {
    const normal = await gray16(moleSvg({ size: 64 }));
    const shield = await gray16(injectAccents(moleSvg({ gear: "shield", size: 64 }), [shieldSteelGroup()]));
    expect(diffPct(normal, shield)).toBeGreaterThanOrEqual(3);
  });

  it("瞌睡鼠 vs 普通鼠:16px 灰度 diffPct ≥3%(修前 0.8%)", async () => {
    const normal = await gray16(moleSvg({ size: 64 }));
    const sleepy = await gray16(injectAccents(moleSvg({ sleepy: true, size: 64 }), [drowseBoldGroup()]));
    expect(diffPct(normal, sleepy)).toBeGreaterThanOrEqual(3);
  });

  it("游戏侧真的接了强化层:flash/sleepy 的脸、shield 的装备都带 data-part 标记", () => {
    expect(moleFaceSvg("flash")).toContain('data-part="flash-crest"');
    expect(moleFaceSvg("sleepy")).toContain('data-part="drowse-bold"');
    expect(gearSvgFor("shield")).toContain('data-part="shield-steel"');
    // 帽子与黑板不叠钢盾层
    expect(gearSvgFor("hat")).not.toContain("shield-steel");
    expect(gearSvgFor("board", "3+4")).not.toContain("shield-steel");
  });

  it("强化层规格:天线星实心金+墨描边、钢盾三停冷灰、瞌睡泡带描边", () => {
    const flash = flashCrestGroup();
    expect(flash).toContain(FLASH_STAR_FILL);
    expect(flash).toMatch(/stroke-width="1\.5"/);
    const steel = shieldSteelGroup();
    expect(new Set([SHIELD_STEEL.lit, SHIELD_STEEL.body, SHIELD_STEEL.dark]).size).toBe(3);
    expect(steel).toContain(SHIELD_STEEL.lit);
    expect(steel).toContain(SHIELD_STEEL.dark);
    expect(steel).toMatch(/rgba\(255,255,255,\.9\)/);
    const drowse = drowseBoldGroup();
    expect(drowse).toContain(DROWSE_BUBBLE_INK);
    expect(drowse).toMatch(/stroke-width="2\.6"/);
  });

  it("kit 纪律:moleSvg.ts 未被改动(星芒/盾面老常量原样),强化只走注入", () => {
    // 老文件的淡星芒与木盾还在(叠加层盖在其上),说明没有人动老 kit
    expect(moleSvg({ sparkle: true })).toContain("#FFF3B0");
    expect(moleSvg({ gear: "shield" })).toContain("#C89B6C");
    // 注入器找不到闭标签时原样返回,不会把字符串弄坏
    expect(injectAccents("no-svg", [flashCrestGroup()])).toBe("no-svg");
  });

  it("五种脸两两可分(SVG 串各不相同,含花花兔)", () => {
    const faces = [moleFaceSvg("normal"), moleFaceSvg("gold"), moleFaceSvg("sleepy"), moleFaceSvg("flash"), moleFaceSvg("bunny")];
    expect(new Set(faces).size).toBe(faces.length);
  });
});

describe("窗口6 r1 fixer · B 档 TOP-7 夜场氛围补层(nightSceneSvg)", () => {
  it("夜姊妹件齐活:月牙 + 五粒星子 + 两棵剪影树,全 #FFF3C9/#3C3A55 夜色板", async () => {
    const { nightSceneSvg } = await import("./visual");
    const svg = nightSceneSvg();
    expect(svg).toContain('data-part="moon"');
    expect(svg).toContain('mask="url(#mp-night-moon)"'); // 月牙靠遮罩抠出弯
    expect(svg).toContain("#FFF3C9");
    expect((svg.match(/data-part="stars"/g) ?? []).length).toBe(1);
    expect((svg.match(/opacity="\.8"/g) ?? []).length).toBe(5); // 星子恰好 5 粒
    expect((svg.match(/#3C3A55/g) ?? []).length).toBeGreaterThanOrEqual(8); // 两棵树 × 4 件剪影
  });

  it("星子全部压在栅栏线(y=58)以上,不进洞区不抢玩法层", async () => {
    const { nightSceneSvg } = await import("./visual");
    const stars = /<g data-part="stars">([\s\S]*?)<\/g>/.exec(nightSceneSvg())![1];
    const ys = [...stars.matchAll(/cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(5);
    for (const y of ys) expect(y).toBeLessThan(58);
  });

  it("index 夜场把氛围层排在火把前面(火把与洞口暖光叠在其上,一字不动)", () => {
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(src).toContain("nightSceneSvg() + torchFlamesHtml()");
    expect(src).toContain("orchardSceneSvg()"); // 白天关照旧互斥渲染
  });

  it("氛围层是纯装饰:aria-hidden、无动画、无 emoji", async () => {
    const { nightSceneSvg } = await import("./visual");
    const svg = nightSceneSvg();
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("animate");
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(svg)).toBe(false);
  });
});
