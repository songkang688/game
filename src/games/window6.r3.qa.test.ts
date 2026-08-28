/**
 * 1.3 窗口 6 · A 档 · 第 3 轮视觉测试员(终验) · 终验钉子(9 款范围)。
 *
 * 第 3 轮终验实测后,把「放行状态」里没有机器守卫的三块补上钉子:
 *  1. 终验补充商标词表:qa1 黑名单与 r1 fixer 扩展词表之外,把本轮终查用的
 *     平台方/大 IP 词一并钉死(马里奥/宝可梦/迪士尼/任天堂/俄罗斯方块等),
 *     grep 实测 0 命中,防后续文案/注释无意引入;
 *  2. B 档两轮风险清单的 3 个残余位点终查结论钉死:
 *     adventure-king 传送圈 = 双弧旋(非三角堆叠/字母形)、
 *     mole-pop 天线星 = 三颗描边星 + 单杆天线(无电光件)、
 *     brave-path 钥匙/锁 = 同心环头 + 锁梁锁身(无「一路小圆点链」);
 *  3. 360px 布局的静态根因:文档级 overflow-x:hidden 兜底 +
 *     首页 .tabs 页签条是设计内横滑容器(overflow-x:auto);战役 .l99-tabs 在
 *     1.3 手机端修复后改成换行铺开(flex-wrap:wrap)——原先横滑 + 藏滚动条
 *     在手机上看起来就像末个页签被切掉,两种口径都不会顶出文档级横滚,
 *     这是 38 个运行时采样点文档级溢出全 0 的结构性保证;
 *  4. 金币三件套:brave-path 金币图标高光弧 / 内环暗缘 / 落影椭圆齐备,非平涂黄圆。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { castleGlyphSvg } from "./adventure-king/visual";
import { flashCrestGroup } from "../art/kit/moleAccents";
import { mazeItemSvg, rowIconSvg } from "./brave-path/visual";

const GAMES = [
  "brave-path",
  "adventure-king",
  "alien-seek",
  "brick-break",
  "mole-pop",
  "box-hamster",
  "balloon-pop",
  "bubble-pop",
  "bubble-aim",
] as const;

/** 终验终查用的平台方 / 大 IP 补充词(r1 扩展词表之外;qaAudit.ts 黑名单定义自身豁免) */
const FINAL_TRADEMARK_SWEEP = [
  /马里奥/,
  /超级玛丽/,
  /super\s*mario/i,
  /大金刚/,
  /donkey\s*kong/i,
  /塞尔达/,
  /zelda/i,
  /宝可梦/,
  /pok[eé]mon/i,
  /皮卡丘/,
  /pikachu/i,
  /米老鼠|米奇/,
  /mickey/i,
  /迪士尼/,
  /disney/i,
  /任天堂/,
  /nintendo/i,
  /三丽鸥/,
  /sanrio/i,
  /俄罗斯方块/,
  /tetris/i,
  /breakout/i,
  /space\s*invaders/i,
  /神庙逃亡/,
  /temple\s*run/i,
  /地铁跑酷/,
  /subway\s*surf/i,
  /whack-?a-?mole/i,
  /植物大战僵尸/,
  /plants\s*vs/i,
];

describe("窗口6 r3 tester · 终验补充商标词表(9 款非测试源码,含注释)", () => {
  for (const id of GAMES) {
    it(`${id}:终验补充词表 0 命中`, () => {
      const dir = join(__dirname, id);
      const files = readdirSync(dir).filter(
        (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "qaAudit.ts"
      );
      for (const f of files) {
        const src = readFileSync(join(dir, f), "utf8");
        for (const re of FINAL_TRADEMARK_SWEEP) {
          expect(src, `${id}/${f} 命中 ${re}`).not.toMatch(re);
        }
      }
    });
  }
});

describe("窗口6 r3 tester · B 档两轮风险清单残余位点终查钉", () => {
  it("adventure-king 传送圈 = 双弧旋:两支旋臂弧 + 中心点,无 polygon 三角堆叠、无字母文本", () => {
    const svg = castleGlyphSvg("portal");
    // 双弧旋:两条不同色宽的圆弧旋臂
    expect(svg).toContain('stroke="#6FA8E8"');
    expect(svg).toContain('stroke="#3E7CB8"');
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).not.toContain("<polygon");
    expect(svg).not.toContain("<text");
  });

  it("mole-pop 天线星 = 单杆天线 + 三颗描边金星,无电光/闪电件", () => {
    const g = flashCrestGroup();
    expect((g.match(/<polygon/g) ?? []).length).toBe(3);
    expect(g).not.toContain("<polyline");
    // 电光/闪电惯用的锯齿折线关键字不出现
    expect(g).not.toMatch(/zig|bolt|lightning/i);
  });

  it("brave-path 钥匙 = 同心双环头(非小圆点链):两枚 circle 同圆心", () => {
    const svg = mazeItemSvg("key");
    const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
    expect(circles.length).toBe(2);
    expect(circles[0][1]).toBe(circles[1][1]);
    expect(circles[0][2]).toBe(circles[1][2]);
  });

  it("brave-path 锁 = 锁梁 + 锁身 + 单孔(非小圆点链):circle 仅锁孔一枚", () => {
    const svg = mazeItemSvg("lock");
    expect((svg.match(/<circle /g) ?? []).length).toBe(1);
    expect(svg).toContain("<rect");
  });
});

describe("窗口6 r3 tester · 360px 布局静态根因钉(壳层滚动容器只读断言)", () => {
  it("文档级兜底:html { overflow-x:hidden } 在位(任何一处算错宽度都不顶出横滚)", () => {
    const css = readFileSync(join(__dirname, "../styles.css"), "utf8");
    expect(css).toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it("首页分类页签 .tabs 是设计内横滑容器(overflow-x:auto)", () => {
    const css = readFileSync(join(__dirname, "../styles.css"), "utf8");
    expect(css).toMatch(/\.tabs\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("战役章节页签 .l99-tabs 换行铺开,不再靠横滑 + 藏滚动条(1.3 手机端修复)", () => {
    const src = readFileSync(join(__dirname, "level99.ts"), "utf8");
    // 换行铺开:每个章节页签都完整可见,末个页签不再像被切掉一半
    expect(src).toMatch(/\.l99-tabs\{[^}]*flex-wrap:wrap/);
    // 横滑 + 藏滚动条的老写法不许回潮(规则本体,注释里的说明不算)
    expect(src).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:auto/);
    expect(src).not.toMatch(/\.l99-tabs\{[^}]*scrollbar-width:none/);
  });
});

describe("窗口6 r3 tester · 金币三件套终验钉(非平涂黄圆)", () => {
  it("brave-path 金币图标:左上高光弧 + 内环暗缘 + 落影椭圆 + 星形浮雕四件齐备", () => {
    const svg = rowIconSvg("supply-coins");
    expect(svg).toContain('rgba(255,255,255,.8)'); // 左上高光弧(hlArc 同族约定)
    expect(svg).toContain('rgba(122,90,30,.5)'); // 内环暗缘
    expect(svg).toContain('<ellipse cx="32" cy="56"'); // 底部落影椭圆(iconWrap)
    expect(svg).toContain('fill="#FFF7EC"'); // 星形浮雕
  });
});
