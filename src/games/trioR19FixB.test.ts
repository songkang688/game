/**
 * 三人组 r19 · 测试修复员 B 交付钉子。
 *
 * 病历见 docs/qa/trio-r19-playbook.md(B 独占面)。每一条断言钉住一处修复的
 * 源码标记:CSS 档位或 layout() 的余量钳。谁把这些行改回去,谁在 915×412 上
 * 就会复现对应的切屏/热区伤,故整表只增不删。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

describe("r19 B · N-98 hue-hand 三键钉底(对战/无尽壳)", () => {
  const src = read("hue-hand/index.ts");
  it("矮横屏 .hh-wrap 自己成滚动容器,sticky 三键有钉底面", () => {
    expect(src).toContain(".hh-wrap{max-height:calc(100dvh - 88px);overflow-y:auto;}");
    expect(src).toContain(".hh-mode .hh-wrap{max-height:calc(100dvh - 146px);}");
  });
  it("「就一张」钮改钉视口,不随滚动层跑", () => {
    expect(src).toContain(".hh-one{position:fixed;right:22px;bottom:64px;}");
  });
});

describe("r19 B · N-95 xiangqi 自由对战设置屏", () => {
  const src = read("xiangqi/view.ts");
  it("设置屏 wrap 单独放宽开卷轴,棋盘 wrap 不吃这一档", () => {
    expect(src).toContain(".xq-wrap:has(>.xq-panel){max-width:min(94vw,660px);max-height:calc(100dvh - 96px);overflow-y:auto;}");
  });
  it("「开始下棋」CTA sticky 钉卷轴底,seg 键 44px 底线", () => {
    expect(src).toContain(".xq-panel>button.xq-start:first-of-type{position:sticky;bottom:0;");
    expect(src).toContain(".xq-panel .xq-seg button{padding:8px 6px;min-height:44px;}");
  });
});

describe("r19 B · N-94+N-101 duo-vs-star 选人 CTA 与赛中 14 键", () => {
  const src = read("duo-vs-star/index.ts");
  it("N-94:角色/场地芯片与回选关 44px 底线", () => {
    const pick = src.slice(src.indexOf(".dvs-pick{"), src.indexOf(".dvs-pick["));
    expect(pick).toContain("min-height:44px");
  });
  it("N-94:矮横屏选人 CTA fixed 钉视口底", () => {
    expect(src).toContain(".dvs-menu .dvs-go{position:fixed;left:50%;transform:translateX(-50%);bottom:6px;");
    expect(src).toContain(".dvs-menu{padding-bottom:62px;}");
  });
  it("N-101:赛中两组 7 键 fixed 钉底横排,44px 底线", () => {
    expect(src).toContain("position:fixed;left:6px;right:6px;bottom:4px;z-index:25;grid-row:auto;grid-column:auto;");
    expect(src).toContain(".dvs-pad button{min-width:44px;min-height:44px;font-size:16px;}");
  });
});

describe("r19 B · N-96 bomb-buddies 画布缩显示", () => {
  const src = read("bomb-buddies/index.ts");
  it("真余量装不下时按比例缩 style 尺寸,cell/坐标/判定不动", () => {
    expect(src).toContain("const shrink = Number.isFinite(room) && room > 80 && cssH > room ? room / cssH : 1;");
    expect(src).toContain("canvas.style.width = `${Math.round(cssW * shrink)}px`;");
    expect(src).toContain("canvas.style.height = `${Math.round(cssH * shrink)}px`;");
  });
});

describe("r19 B · N-107 fruit-stack 双人六键钉底", () => {
  const src = read("fruit-stack/index.ts");
  it("矮横屏外层键排 fixed 钉视口底,内层分组回流", () => {
    expect(src).toContain(".fs-wrap>.fs-pad{position:fixed;left:10px;right:10px;bottom:6px;z-index:25;");
    expect(src).toContain(".fs-wrap>.fs-pad .fs-pad{position:static;background:none;padding:0;}");
  });
  it("果盆显示高按「键排顶 − 果盆顶」实测余量重钳", () => {
    expect(src).toContain("if (top > 0) roomH = Math.max(110, Math.min(roomH, vh - padBudget - top - 34));");
  });
});

describe("r19 B · N-106 monster-crisis 摇杆/甩弹钉角", () => {
  const src = read("monster-crisis/index.ts");
  it("矮横屏两组操控 fixed 钉视口左右下角", () => {
    expect(src).toContain(".mcr-pads{position:fixed;left:12px;right:12px;bottom:8px;z-index:25;min-height:0;pointer-events:none;}");
    expect(src).toContain(".mcr-pad{pointer-events:auto;}");
  });
});

describe("r19 B · N-108 puzzle-tiles 无尽画廊与热区尾款", () => {
  const src = read("puzzle-tiles/index.ts");
  it("矮横屏无尽盘宽按余量反推,三排进可视区(闯关不吃这一档)", () => {
    expect(src).toContain(".pz-mode .pz-board { max-width: max(148px, calc(100dvh - 238px)); margin-left: auto; margin-right: auto; }");
  });
  it("五颗工具/入口热区抬到 44px 底线", () => {
    for (const sel of [".pz-hint {", ".pz-open {", ".pz-back {", ".pzt-eye, .pzt-undo {"]) {
      const rule = src.slice(src.indexOf(sel), src.indexOf("}", src.indexOf(sel)));
      expect(rule, `${sel} 需 min-height: 44px`).toContain("min-height: 44px");
    }
  });
});

describe("r19 B · N-102 bumper-cars 画布/热区/1024 刹车", () => {
  const src = read("bumper-cars/index.ts");
  it("模式入口与档位芯片 44px 底线", () => {
    const open = src.slice(src.indexOf(".bc-open{"), src.indexOf(".bc-open:"));
    const pick = src.slice(src.indexOf(".bc-pick{"), src.indexOf(".bc-pick."));
    expect(open).toContain("min-height:44px");
    expect(pick).toContain("min-height:44px");
  });
  it("矮横屏摇杆列挪场地两侧,layout() 同步按侧栏取余量", () => {
    expect(src).toContain('grid-template-areas:"hud hud hud" "padl arena padr";');
    expect(src).toContain("const sidePads = vh <= 500 && vw >= 640;");
  });
  it("场地显示高按「视口底 − 场地顶」实测余量封顶(1024 刹车回屏)", () => {
    expect(src).toContain("const visCap = arenaTop > 0 && vh > 0 ? vh - arenaTop - (sidePads ? 8 : below) : Infinity;");
  });
});

describe("r19 B · N-103 ice-fire-forest 画布切底(含 root×188)", () => {
  const src = read("ice-fire-forest/index.ts");
  it("画布预算按「视口高 − 画布实际 top」封一刀,root 直达行自动进预算", () => {
    expect(src).toContain("if (top > 0) budgetH = Math.max(110, Math.min(budgetH, vh - top - 8));");
  });
  it("root×188 双 pad 第三行回进 412:名牌让位、行距收档、44px 不降", () => {
    expect(src).toContain(".iff-wrap{--iff-hit:44px;gap:4px;}");
    expect(src).toContain(".iff-pad{gap:2px;}");
    expect(src).toContain(".iff-padname{display:none;}");
  });
});

describe("r19 B · N-104 landlord-cards 回选关热区", () => {
  const src = read("landlord-cards/index.ts");
  it(".ld-back 从 33px 抬到 44px 底线(开局 + 出牌两态一处修)", () => {
    const rule = src.slice(src.indexOf(".ld-back{"), src.indexOf(".ld-back:"));
    expect(rule).toContain("min-height:44px");
  });
});

describe("r19 B · C-5 mole-pop 九洞反推洞径", () => {
  const src = read("mole-pop/index.ts");
  it("矮横屏两栏布局,盘宽 CSS 档按「视口高 − 盘顶那摞」反推", () => {
    expect(src).toContain(".mp-board { grid-column: 2; grid-row: 1 / span 6; gap: 8px; width: clamp(148px, calc(100dvh - 142px), 320px); }");
    expect(src).toContain(".mp-hole { min-width: 44px; min-height: 44px; font-size: clamp(24px, 8dvh, 44px); }");
  });
  it("fitBoard() 按盘顶实测 top 反推盘宽(root×167 的浮动壳头全兜住),destroy 时摘 resize", () => {
    expect(src).toContain("boardEl.style.width = `${Math.max(148, Math.min(320, vh - top - 8))}px`;");
    expect(src).toContain('window.addEventListener("resize", fitBoard);');
    expect(src).toContain('window.removeEventListener("resize", fitBoard);');
  });
});

describe("r19 B · N-29 尾款(sling-birds / candy-swing / bubble-aim)", () => {
  it("sling-birds:矮横屏控件排收进 412,按钮 44px 底线", () => {
    const src = read("sling-birds/index.ts");
    expect(src).toContain(".slb-btn { min-height: 44px; padding: 9px 20px; }");
    expect(src).toContain(".slb-say { width: 44px; height: 44px; }");
  });
  it("candy-swing:矮横屏画布钳显示高、保长宽比居中", () => {
    const src = read("candy-swing/index.ts");
    expect(src).toContain(".cs-canvas { width: auto; max-width: 100%; max-height: max(150px, calc(100dvh - 178px)); margin: 0 auto; }");
  });
  it("bubble-aim:关内/无尽工具排 40px 抬到 44px", () => {
    const src = read("bubble-aim/index.ts");
    expect(src).toContain(".ba-btn, .bba-mode, .bba-swap { min-height: 44px; min-width: 44px; }");
  });
});
