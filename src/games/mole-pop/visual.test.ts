/**
 * 地鼠嘭嘭 · 1.3 视觉升级(第 18 步 B 档)用例。只增不减:
 * 配色 token / 三层土堆 z 序 / 自绘 SVG 替换裸 emoji / 装备显隐随 hits /
 * 升降沿用既有时序 / reduced 跳过预告 / 被敲压扁+星星圈且热区不动 /
 * 装备飞走只动装备层 / 算术黑板手写算式 / destroy 计时归零 / 玩法数值零漂移。
 *
 * 视觉断言全部咬 visual.ts 纯函数与 index.ts 源码里的字面量 CSS,
 * 不碰任何判定 / 谱面 / 存档逻辑。
 */
import { describe, expect, it } from "vitest";
import { inlineCss, readGameSources } from "../adventure-king/qaAudit";
import { mulberry32 } from "../level99";
import { BONK_SQUASH, BONK_STAR_COUNT } from "../../art/kit/moleSvg";
import { buildQuizCard } from "./levels";
import {
  DROP_MS,
  MOLE_SPECS,
  RISE_MS,
  TimerBag,
  type MoleKind,
  type TimerHost,
} from "./rhythm";
import {
  MP_TIMING,
  MP_TOKENS,
  MP_Z,
  dropPose,
  gearFor,
  gearSvgFor,
  holeInnerHtml,
  moleFaceSvg,
  orchardSceneSvg,
  torchFlameSvg,
  torchFlamesHtml,
} from "./visual";

const SOURCES = readGameSources("mole-pop");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;
const CSS = inlineCss(INDEX);

/** 从字面量 CSS 里抠某个类的声明体 */
function ruleOf(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `样式表里找不到 ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
}

/** reduced-motion 媒体块整段 */
function reducedBlock(css: string): string {
  const at = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(at).toBeGreaterThanOrEqual(0);
  return css.slice(at);
}

describe("mole-pop 视觉 · 1) 配色 token 全部落在样式表", () => {
  it("七个 --mp- token 一个不少,色值与 visual.ts 唯一口径一致", () => {
    const names = Object.keys(MP_TOKENS);
    expect(names).toHaveLength(7);
    for (const [name, value] of Object.entries(MP_TOKENS)) {
      expect(CSS, `${name} 不在样式表里或色值漂了`).toContain(`${name}: ${value};`);
    }
  });

  it("六个动效时长也写成了 CSS 自定义属性,与 MP_TIMING 对得上", () => {
    expect(CSS).toContain(`--mp-peek-ms: ${MP_TIMING.peekMs}ms`);
    expect(CSS).toContain(`--mp-fly-ms: ${MP_TIMING.gearFlyMs}ms`);
    expect(CSS).toContain(`--mp-bonk-ms: ${MP_TIMING.bonkMs}ms`);
    expect(CSS).toContain(`--mp-sway-ms: ${MP_TIMING.cardSwayMs}ms`);
    expect(CSS).toContain(`--mp-pop-ms: ${MP_TIMING.comboPopMs}ms`);
    expect(CSS).toContain(`--mp-flame-ms: ${MP_TIMING.flameMs}ms`);
  });
});

describe("mole-pop 视觉 · 2) 四种 spec 的装备层", () => {
  const CASES: Array<[MoleKind, string | null]> = [
    ["normal", null],
    ["shield", "shield"],
    ["hat", "hat"],
    ["quiz", "board"],
  ];

  it.each(CASES)("%s:该带的装备带、不该带的不带", (kind, gear) => {
    expect(gearFor(kind, 0)).toBe(gear);
    if (gear) {
      const svg = gearSvgFor(gear, "3+4");
      expect(svg).toContain(`data-part="gear-${gear}"`);
    }
  });
});

describe("mole-pop 视觉 · 3) 地鼠不再是裸 emoji", () => {
  it("renderHole 路径输出 <svg,index.ts 里 🐹 已清", () => {
    expect(INDEX.text).not.toContain("🐹");
    expect(INDEX.text).not.toContain(".emoji");
    expect(INDEX.text).toContain("moleFaceSvg(");
    for (const kind of Object.keys(MOLE_SPECS) as MoleKind[]) {
      const svg = moleFaceSvg(kind);
      expect(svg.startsWith("<svg"), `${kind} 不是 SVG`).toBe(true);
      expect(svg).not.toContain("🐹");
    }
  });

  it("九种角色剪影可分:金=金毛、瞌睡=瞌睡泡、闪光=星芒、花花兔=郁金香", () => {
    expect(moleFaceSvg("gold")).toContain("#F2C14E");
    expect(moleFaceSvg("sleepy")).toContain('data-part="drowse"');
    expect(moleFaceSvg("flash")).toContain('data-part="sparkle"');
    expect(moleFaceSvg("bunny")).toContain('data-part="tulip"');
    expect(moleFaceSvg("bunny")).not.toContain('data-part="teeth"');
  });
});

describe("mole-pop 视觉 · 4) 装备显隐只读 hits,判定值零漂移", () => {
  it("护盾鼠还要敲 2 下时亮盾,只剩 1 下时盾消失(hits 只读)", () => {
    expect(MOLE_SPECS.shield.hits).toBe(2);
    expect(gearFor("shield", 0)).toBe("shield");
    expect(gearFor("shield", 1)).toBeNull();
  });

  it("帽子鼠同理;普通鼠 / 金鼠永远素颜", () => {
    expect(MOLE_SPECS.hat.hits).toBe(2);
    expect(gearFor("hat", 0)).toBe("hat");
    expect(gearFor("hat", 1)).toBeNull();
    expect(gearFor("normal", 0)).toBeNull();
    expect(gearFor("gold", 0)).toBeNull();
  });
});

describe("mole-pop 视觉 · 5) 三层土堆 z 序", () => {
  it("后沿 < 地鼠层 < 装备层 < 前沿 < 反馈,和 MP_Z 一致", () => {
    const z = (sel: string): number => Number(/z-index: (\d+)/.exec(ruleOf(CSS, sel))?.[1]);
    expect(z(".mp-pit")).toBe(MP_Z.pit);
    expect(z(".mp-mound-back")).toBe(MP_Z.moundBack);
    expect(z(".mp-lift")).toBe(MP_Z.lift);
    expect(z(".mp-gear")).toBe(MP_Z.gear);
    expect(z(".mp-mound-front")).toBe(MP_Z.moundFront);
    expect(z(".mp-fx")).toBe(MP_Z.fx);
    expect(z(".mp-mound-back")).toBeLessThan(z(".mp-lift"));
    expect(z(".mp-lift")).toBeLessThan(z(".mp-mound-front"));
  });

  it("洞结构模板按层级序生成,地鼠层带 overflow:hidden 裁剪", () => {
    const html = holeInnerHtml();
    const order = ["mp-pit", "mp-mound-back", "mp-lift", "mp-gear", "mp-mound-front", "mp-fx"];
    let last = -1;
    for (const cls of order) {
      const at = html.indexOf(cls);
      expect(at, `${cls} 缺席`).toBeGreaterThan(last);
      last = at;
    }
    expect(ruleOf(CSS, ".mp-lift")).toContain("overflow: hidden");
    expect(ruleOf(CSS, ".mp-hole > span")).toContain("pointer-events: none");
  });
});

describe("mole-pop 视觉 · 6) 升降沿用既有 translateY 时序", () => {
  it("mpUp .18s 与 6px/22px/26px 一字未改,判定窗口 120/60ms 未动", () => {
    expect(CSS).toContain("animation: mpUp .18s ease");
    expect(CSS).toContain("transform: translateY(6px)");
    expect(CSS).toContain("transform: translateY(22px); opacity: .55;");
    expect(CSS).toContain("from { transform: translateY(26px); opacity: .4; }");
    expect(RISE_MS).toBe(120);
    expect(DROP_MS).toBe(60);
  });
});

describe("mole-pop 视觉 · 7) reduced-motion 接线", () => {
  it("冒头预告在 reduced 下跳过,升降瞬时切换", () => {
    const reduced = reducedBlock(CSS);
    expect(reduced).toContain(".mp-hole.mp-peek .mp-mound-front { animation: none; }");
    expect(reduced).toContain(".mp-hole.mp-peek .mp-fx::after { display: none; }");
    expect(reduced).toContain(".mp-hole .mp-face { animation: none; }");
  });

  it("装备飞走 / 压扁 / 黑板摆 / 火苗 / 倍率跳动全部静止", () => {
    const reduced = reducedBlock(CSS);
    expect(reduced).toContain(".mp-gear.mp-gear-fly { animation: none; opacity: 0; }");
    expect(reduced).toContain(".mp-bonk { animation: none; }");
    expect(reduced).toContain(".mp-gear-board svg { animation: none; }");
    expect(reduced).toContain('.mp-flame [data-part="flame-outer"]');
    expect(reduced).toContain(".mp-badge .mp-mult.mp-pop { animation: none; }");
  });
});

describe("mole-pop 视觉 · 8) 被敲反馈与热区几何", () => {
  it("被敲态 = 压扁 0.8 + 吐舌笑 + 星星圈 3 颗,无痛苦表达", () => {
    const svg = moleFaceSvg("normal", "bonked");
    expect(svg).toContain(`scale(1 ${BONK_SQUASH})`);
    expect(svg).toContain('data-part="stars"');
    expect(svg).toContain('data-part="tongue"');
    expect((svg.match(/<polygon/g) ?? []).length).toBe(BONK_STAR_COUNT);
  });

  it("反馈画在 mp-fx 层;洞热区几何(1.2 原文)一个像素没动", () => {
    const bonkFn = /function bonkFx[\s\S]*?\n {2}\}/.exec(INDEX.text)?.[0] ?? "";
    expect(bonkFn).toContain("fxEls[i]");
    expect(bonkFn).not.toContain("liftEls");
    expect(bonkFn).not.toContain("holeEls");
    const hole = ruleOf(CSS, ".mp-hole");
    expect(hole).toContain("aspect-ratio: 1; min-width: 56px; min-height: 56px;");
    expect(ruleOf(CSS, ".mp-board")).toContain("grid-template-columns: repeat(3, 1fr); gap: 12px;");
    expect(CSS).toContain(".mp-hole:active { transform: scale(.93); }");
  });

  it("未敲中缩回打哈欠,花花兔不装哈欠", () => {
    expect(dropPose("normal")).toBe("yawn");
    expect(dropPose("bunny")).toBe("up");
    expect(moleFaceSvg("normal", "yawn")).toContain('data-part="sleep-bubble"');
  });
});

describe("mole-pop 视觉 · 9) 装备飞走 260ms,只动装备层", () => {
  it("时长 260ms,CSS 走 var(--mp-fly-ms)", () => {
    expect(MP_TIMING.gearFlyMs).toBe(260);
    expect(CSS).toContain(".mp-gear.mp-gear-fly { animation: mpGearFly var(--mp-fly-ms) ease-out forwards; }");
    expect(CSS).toContain("@keyframes mpGearFly");
  });

  it("flyGear 只碰 gearEls,地鼠层(liftEls)一根毛不动", () => {
    const flyFn = /function flyGear[\s\S]*?\n {2}\}/.exec(INDEX.text)?.[0] ?? "";
    expect(flyFn).toContain("gearEls[i]");
    expect(flyFn).not.toContain("liftEls");
    expect(flyFn).toContain("MP_TIMING.gearFlyMs");
  });
});

describe("mole-pop 视觉 · 10) 算术小黑板", () => {
  it("黑板含手写体算式文本(quiz 数据只读,出题一个字不动)", () => {
    const rand = mulberry32(20260827);
    const card = buildQuizCard(7, true, rand);
    expect(card.correct).toBe(true);
    const svg = gearSvgFor("board", card.expr);
    expect(svg).toContain(`>${card.expr}</text>`);
    expect(svg).toContain("cursive");
    expect(svg).toContain('data-part="gear-board"');
  });

  it("出题黑板轻摆 ±3°、900ms;HUD 出题条用木框深板面", () => {
    expect(CSS).toContain("animation: mpSway var(--mp-sway-ms) ease-in-out infinite alternate;");
    expect(CSS).toContain("@keyframes mpSway { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }");
    expect(ruleOf(CSS, ".mp-quiz")).toContain("var(--mp-board)");
  });
});

describe("mole-pop 视觉 · 11) destroy 计时归零", () => {
  it("视觉动效的 TimerBag 计时 clearAll 后归零,宿主里也全清干净", () => {
    const pending = new Set<number>();
    let seq = 0;
    const host: TimerHost = {
      setTimeout: () => (pending.add(++seq), seq),
      clearTimeout: (id) => pending.delete(id),
      setInterval: () => (pending.add(++seq), seq),
      clearInterval: (id) => pending.delete(id),
    };
    const bag = new TimerBag(host);
    bag.after(() => {}, MP_TIMING.peekMs);
    bag.after(() => {}, MP_TIMING.gearFlyMs);
    bag.after(() => {}, MP_TIMING.bonkHoldMs);
    bag.every(() => {}, 40);
    expect(bag.size).toBe(4);
    bag.clearAll();
    expect(bag.size).toBe(0);
    expect(pending.size).toBe(0);
  });

  it("index.ts 的视觉计时全走 later/bag,没有裸 setTimeout", () => {
    expect(/\bsetTimeout\(/.test(INDEX.text.replace(/bag\.after|host\.setTimeout/g, ""))).toBe(false);
  });
});

describe("mole-pop 视觉 · 12) 场景氛围与玩法数值零漂移", () => {
  it("果园背景:两棵圆树 + 栅栏 + 三排草丛;夜场火把双层火苗 + 暖光 token", () => {
    const scene = orchardSceneSvg();
    expect(scene).toContain('data-part="trees"');
    expect(scene).toContain('data-part="fence"');
    for (const mark of ["grass-far", "grass-mid", "grass-near"]) {
      expect(scene).toContain(`data-part="${mark}"`);
    }
    const flame = torchFlameSvg();
    expect(flame).toContain('data-part="flame-outer"');
    expect(flame).toContain('data-part="flame-inner"');
    expect(flame).toContain("var(--mp-torch)");
    expect(torchFlamesHtml()).toContain("mp-flame-l");
    expect(torchFlamesHtml()).toContain("mp-flame-r");
  });

  it("场景互斥:夜场只夜色件(月牙星子剪影+火把)、白天只果园(源码分支断言)", () => {
    // W6R1 fixer 落地 B 档 TOP-7 后,夜场氛围层排在火把前;互斥结构不变:
    // 白天关不带任何夜场节点,夜场关不带果园节点
    expect(INDEX.text).toContain("cfg.night ? nightSceneSvg() + torchFlamesHtml() : orchardSceneSvg()");
  });

  it("MOLE_SPECS 的行为数值(hits/base/stayScale/hittable)与 1.2 完全一致", () => {
    const behavior = Object.fromEntries(
      Object.entries(MOLE_SPECS).map(([k, s]) => [k, [s.hits, s.base, s.stayScale, s.hittable]])
    );
    expect(behavior).toEqual({
      normal: [1, 1, 1, true],
      sleepy: [1, 1, 1.8, true],
      gold: [1, 2, 1, true],
      bunny: [0, 0, 1.4, false],
      shield: [2, 2, 1.9, true],
      quiz: [1, 1, 1.15, true],
      hat: [2, 2, 1.6, true],
      flash: [1, 3, 0.55, true],
      swarm: [1, 1, 0.9, true],
    });
  });

  it("冒头预告只加视觉类:scanPeek 用自己的游标,不动 cursor / holes 状态", () => {
    const peekFn = /function scanPeek[\s\S]*?\n {2}\}/.exec(INDEX.text)?.[0] ?? "";
    expect(peekFn).toContain("peekCursor");
    expect(peekFn).toContain('classList.add("mp-peek")');
    expect(peekFn).not.toContain("spawnNote");
    expect(peekFn).not.toMatch(/holes\[[^\]]+\]\.kind\s*=[^=]/);
  });
});
