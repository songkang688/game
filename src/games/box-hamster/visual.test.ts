// 推箱小仓鼠 · 1.3 视觉升级用例(只增不减):
// token 落表 / 仓鼠四朝向与双款可分 / 木箱礼物盒分支 / 推滑传三分支 /
// 平移时长沿用 / 传送 200ms / 28px 尘土兜底 / -22% 换算 / 主题轮换 / reduced。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shade } from "../../art/kit/palette";
import { PUSH_MS, WALK_MS, moveDuration } from "./assist";
import type { MoveOutcome } from "./logic";
import {
  BH_HAMSTER_STYLES,
  BH_LAYER_Z,
  BH_THEMES,
  BH_TIMINGS,
  BH_TOKENS,
  BOX_SIDE,
  DUST_MIN_CELL,
  MOVE_FX_CLASS,
  SIDE_SHADE,
  WALL_POST,
  bhHamsterSvg,
  bhVisualCss,
  boxPieceSvg,
  boxSvg,
  classifyMove,
  confettiHtml,
  dustHtml,
  giftSvg,
  poseForKind,
  scratchHtml,
  shouldShowDust,
  teleportInHtml,
  themeOf,
  undoIconSvg,
} from "./visual";

const CSS = bhVisualCss();

describe("配色 token(四·补一):全部落在样式表", () => {
  it("十枚 --bh- token 和规格表一字不差", () => {
    expect(BH_TOKENS["--bh-floor"]).toBe("#F8F1E4");
    expect(BH_TOKENS["--bh-wall"]).toBe("#C89B6C");
    expect(BH_TOKENS["--bh-ice"]).toBe("#DDF2FF");
    expect(BH_TOKENS["--bh-goal"]).toBe("#B8E39B");
    expect(BH_TOKENS["--bh-box"]).toBe("#D9A06B");
    expect(BH_TOKENS["--bh-gift"]).toBe("#F4859F");
    expect(BH_TOKENS["--bh-portal-in"]).toBe("#9F8FF0");
    expect(BH_TOKENS["--bh-portal-out"]).toBe("#F0C25A");
    expect(BH_TOKENS["--bh-hamster-a"]).toBe("#E8B27A");
    expect(BH_TOKENS["--bh-hamster-b"]).toBe("#C9CFEA");
  });

  it("样式表里每一枚 token 都以自定义属性出现", () => {
    for (const [k, v] of Object.entries(BH_TOKENS)) {
      expect(CSS, `${k} 不在样式表里`).toContain(`${k}:${v};`);
    }
  });

  it("格内层级从地形到金光单调递增(①→⑥)", () => {
    const { terrain, portal, box, hamster, fx, gold } = BH_LAYER_Z;
    expect(terrain).toBeLessThan(portal);
    expect(portal).toBeLessThan(box);
    expect(box).toBeLessThan(hamster);
    expect(hamster).toBeLessThan(fx);
    expect(fx).toBeLessThan(gold);
  });
});

describe("仓鼠:四朝向独立姿态,双款可分", () => {
  it("四朝向输出四份不同 SVG,且不是 transform 翻转", () => {
    const svgs = ([0, 1, 2, 3] as const).map((f) => bhHamsterSvg(0, f, "idle"));
    expect(new Set(svgs).size).toBe(4);
    for (const s of svgs) {
      expect(s).toContain("<svg");
      expect(s).not.toContain("scaleX(-1)");
    }
  });

  it("双款仓鼠毛色 / 耳形 / 头饰三通道都不同", () => {
    expect(BH_HAMSTER_STYLES[0].fur).toBe(BH_TOKENS["--bh-hamster-a"]);
    expect(BH_HAMSTER_STYLES[1].fur).toBe(BH_TOKENS["--bh-hamster-b"]);
    expect(BH_HAMSTER_STYLES[0].ear).not.toBe(BH_HAMSTER_STYLES[1].ear);
    expect(BH_HAMSTER_STYLES[0].topper).not.toBe(BH_HAMSTER_STYLES[1].topper);
    const a = bhHamsterSvg(0, 2, "idle");
    const b = bhHamsterSvg(1, 2, "idle");
    expect(a).not.toBe(b);
    expect(a).toContain("bhh-topper-flower");
    expect(b).toContain("bhh-topper-cowlick");
  });

  it("咀嚼两帧挂 bxh-chew,样式表里有 1200ms 的轮播与 reduced 关停", () => {
    const svg = bhHamsterSvg(0, 2, "idle");
    expect(svg).toContain("bxh-chew-a");
    expect(svg).toContain("bxh-chew-b");
    expect(CSS).toContain(`--bxh-chew-ms:${BH_TIMINGS.chewMs}ms`);
    expect(BH_TIMINGS.chewMs).toBe(1200);
  });
});

describe("木箱与礼物盒:SVG 自绘,不再裸 emoji", () => {
  it("木箱有木板纹三条 + 四角铁片 + 顶亮侧暗", () => {
    const svg = boxSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain("bxh-box-planks");
    expect(svg).toContain("bxh-box-top");
    expect(svg).toContain("bxh-box-side");
    expect((svg.match(/<line /g) ?? []).length).toBe(3);
    expect((svg.match(/<rect [^>]*width="8"/g) ?? []).length).toBe(4);
  });

  it("到位分支跟随 bh-done 语义:done=礼物盒(缎带+蝴蝶结+金光),否则木箱", () => {
    expect(boxPieceSvg(false, false)).toBe(boxSvg());
    const gift = boxPieceSvg(true, false);
    expect(gift).toContain("bxh-gift-ribbon");
    expect(gift).toContain("bxh-gift-bow");
    expect(gift).toContain("bxh-gift-ring");
    expect(gift).not.toContain("bxh-gift-pulse");
    // 刚归位那一下才放金光脉冲
    expect(boxPieceSvg(true, true)).toContain("bxh-gift-pulse");
  });

  it("箱子 / 仓鼠 / 礼物盒的输出里没有 📦 也没有 🐹", () => {
    for (const s of [boxSvg(), giftSvg(true), bhHamsterSvg(0, 2, "idle"), bhHamsterSvg(1, 1, "push")]) {
      expect(s).not.toContain("📦");
      expect(s).not.toContain("🐹");
    }
  });

  it("index.ts 渲染层源码里也不再出现 📦 / 🐹(裸 emoji 清除)", () => {
    const src = readFileSync("src/games/box-hamster/index.ts", "utf8");
    expect(src).not.toContain("📦");
    expect(src).not.toContain("🐹");
    // 传送门 / 脚印的 emoji 地形也一并退场
    expect(src).not.toContain("🌀");
    expect(src).not.toContain("🐾");
  });
});

describe("三种移动走三条视觉分支(只读 MoveOutcome)", () => {
  const base: MoveOutcome = {
    state: { boxes: [], hamsters: [5] },
    pushed: false,
    boxIndex: -1,
    boxFrom: -1,
    boxTo: -1,
    boxPath: [],
    from: 4,
    to: 5,
    path: [5],
    teleported: false,
  };
  const noPortal = { portal: new Array<number>(30).fill(-1) };

  it("平地走一格是 walk,不加戏", () => {
    expect(classifyMove(noPortal, base)).toBe("walk");
    expect(MOVE_FX_CLASS.walk).toBe("");
  });

  it("推箱是 push,冰面多格滑行是 slide,仓鼠被传送是 teleport", () => {
    expect(classifyMove(noPortal, { ...base, pushed: true, boxIndex: 0, boxFrom: 5, boxTo: 6, boxPath: [6] })).toBe(
      "push"
    );
    expect(classifyMove(noPortal, { ...base, to: 7, path: [5, 6, 7] })).toBe("slide");
    expect(classifyMove(noPortal, { ...base, to: 20, path: [5, 20], teleported: true })).toBe("teleport");
  });

  it("被推的箱子最后一跳走了传送门,同样算 teleport", () => {
    const portal = new Array<number>(30).fill(-1);
    portal[6] = 21;
    portal[21] = 6;
    const out: MoveOutcome = { ...base, pushed: true, boxIndex: 0, boxFrom: 5, boxTo: 21, boxPath: [6, 21] };
    expect(classifyMove({ portal }, out)).toBe("teleport");
  });

  it("三条附加类名互不相同且都进了样式表", () => {
    const classes = [MOVE_FX_CLASS.push, MOVE_FX_CLASS.slide, MOVE_FX_CLASS.teleport];
    expect(new Set(classes).size).toBe(3);
    expect(dustHtml(1)).toContain("bxh-dust");
    expect((dustHtml(1).match(/bxh-dust/g) ?? []).length).toBe(2);
    expect(scratchHtml(0)).toContain("--rot:90deg");
    expect(scratchHtml(1)).toContain("--rot:0deg");
    expect(teleportInHtml()).toContain("bxh-tp-in");
    for (const cls of ["bxh-dust", "bxh-scratch", "bxh-tp-in", "bxh-tp-out"]) expect(CSS).toContain(cls);
  });

  it("姿态跟移动语义走:推=push、滑=slide、走/传=idle", () => {
    expect(poseForKind("push")).toBe("push");
    expect(poseForKind("slide")).toBe("slide");
    expect(poseForKind("walk")).toBe("idle");
    expect(poseForKind("teleport")).toBe("idle");
  });
});

describe("动效时序(四·补三)", () => {
  it("移动平移沿用既有过渡常量,一个数没动", () => {
    expect(BH_TIMINGS.moveWalkMs).toBe(WALK_MS);
    expect(BH_TIMINGS.movePushMs).toBe(PUSH_MS);
    expect(WALK_MS).toBe(120);
    expect(PUSH_MS).toBe(160);
    expect(moveDuration("walk", false)).toBe(120);
    expect(moveDuration("push", false)).toBe(160);
    expect(moveDuration("walk", false, true)).toBe(60);
    expect(moveDuration("push", true)).toBe(16);
  });

  it("尘土 240 / 擦痕 300 / 传送 200 / 金光 500 / 转圈 800,全部写成自定义属性", () => {
    expect(BH_TIMINGS.dustMs).toBe(240);
    expect(BH_TIMINGS.scratchMs).toBe(300);
    expect(BH_TIMINGS.teleportMs).toBe(200);
    expect(BH_TIMINGS.giftPulseMs).toBe(500);
    expect(BH_TIMINGS.winSpinMs).toBe(800);
    expect(CSS).toContain("--bxh-dust-ms:240ms");
    expect(CSS).toContain("--bxh-scratch-ms:300ms");
    expect(CSS).toContain("--bxh-tp-ms:200ms");
    expect(CSS).toContain("--bxh-gift-ms:500ms");
    expect(CSS).toContain("--bxh-cheer-ms:800ms");
  });

  it("reduced 一段把旋涡 / 咀嚼 / 脉冲 / 转圈 / 彩带全关停,静态层次保留", () => {
    const at = CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    expect(at).toBeGreaterThan(-1);
    const block = CSS.slice(at);
    expect(block).toContain("animation:none");
    for (const cls of ["bh-portal::before", "bxh-chew", "bxh-gift-pulse", "bxh-win .bxh-hamster", "bxh-confetti"]) {
      expect(block, `reduced 段没有关停 ${cls}`).toContain(cls);
    }
  });
});

describe("最小格兜底与 -22% 换算", () => {
  it("格 ≤ 28px 省略尘土,29px 起才冒;reduced 一律不生成", () => {
    expect(DUST_MIN_CELL).toBe(28);
    expect(shouldShowDust(28, false)).toBe(false);
    expect(shouldShowDust(18, false)).toBe(false);
    expect(shouldShowDust(29, false)).toBe(true);
    expect(shouldShowDust(42, false)).toBe(true);
    expect(shouldShowDust(42, true)).toBe(false);
  });

  it("尘土省略时姿态保留:poseForKind 与格宽无关", () => {
    // 姿态由移动语义决定,shouldShowDust 只管要不要冒尘土
    expect(poseForKind("push")).toBe("push");
    expect(shouldShowDust(DUST_MIN_CELL, false)).toBe(false);
  });

  it("墙立柱 / 箱侧面 = 主色 -22%(shade 换算断言)", () => {
    expect(SIDE_SHADE).toBe(-22);
    expect(WALL_POST).toBe(shade(BH_TOKENS["--bh-wall"], -22));
    expect(WALL_POST).toBe("#9c7954");
    expect(BOX_SIDE).toBe(shade(BH_TOKENS["--bh-box"], -22));
    expect(BOX_SIDE).toBe("#a97d53");
    expect(CSS).toContain(WALL_POST);
    expect(boxSvg()).toContain(BOX_SIDE);
  });
});

describe("章节主题 / 庆祝 / HUD", () => {
  it("木屋 / 冰窖 / 花园三主题轮换,角标都是 SVG", () => {
    expect(BH_THEMES.map((t) => t.id)).toEqual(["cabin", "cellar", "garden"]);
    expect(themeOf(0).id).toBe("cabin");
    expect(themeOf(1).id).toBe("cellar");
    expect(themeOf(2).id).toBe("garden");
    expect(themeOf(3).id).toBe("cabin");
    for (const t of BH_THEMES) {
      expect(t.deco).toContain("<svg");
      expect(t.tint).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(new Set(BH_THEMES.map((t) => t.tint)).size).toBe(3);
  });

  it("过关彩带六片,颜色写死成表(seed 无关,回放一致)", () => {
    const html = confettiHtml();
    expect((html.match(/bxh-confetti/g) ?? []).length).toBe(6);
    expect(html).toContain(BH_TOKENS["--bh-gift"]);
    expect(confettiHtml()).toBe(html);
  });

  it("撤销按钮是小时钟回转图标(SVG,带指针与回转箭头)", () => {
    const svg = undoIconSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain("bxh-undo-icon");
    expect(svg).toContain("bxh-undo-arrow");
    expect(svg).toContain("bxh-undo-hands");
  });

  it("传送门进出口反色:样式表里进紫出金各一段,出口反向旋转", () => {
    expect(CSS).toContain("var(--bh-portal-in)");
    expect(CSS).toContain("var(--bh-portal-out)");
    expect(CSS).toContain("bxh-portal-out");
    expect(CSS).toContain("animation-direction:reverse");
    expect(CSS).toContain("conic-gradient");
  });
});
