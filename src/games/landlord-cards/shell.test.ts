/**
 * 朵朵抢地主 —— 牌桌外壳巡检。
 *
 * 这一份不测牌型,只把整个目录的源码扒出来盯三件事:
 *  1. `destroy` 得把定时器、动画帧和所有监听收干净,离开牌桌不留后台任务;
 *  2. 手机 360px 上牌够宽、底部三钮热区够大;
 *  3. 红线:这是纸牌策略不是赌博,没有货币下注筹码赔率,没有商标,没有 three.js。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FLY_MAX_MS, FLY_MIN_MS } from "./anim";
import { cardWidthFor } from "./fan";
import guide from "./guide";
import { meta } from "./meta";

const dir = fileURLToPath(new URL(".", import.meta.url));
/** 玩法源码(不含测试文件本身:巡检用的黑名单词就写在测试里,扫自己会误伤) */
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const shell = readFileSync(`${dir}index.ts`, "utf8");
/** 整份玩法源码(含注释),红线巡检连注释一起扫 */
const allSource = files.map((f) => readFileSync(`${dir}${f}`, "utf8")).join("\n");

/** 赌博相关的说法,一个都不许出现在这款纸牌策略游戏里 */
const GAMBLING_WORDS = ["下注", "押注", "赌注", "赌博", "筹码", "赔率", "彩金", "充值", "金币", "现金", "钱包余额"];

/** 任务书里点名的商标与别家角色,注释里也不许出现 */
const BRAND_WORDS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "俄罗斯方块",
  "Tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "Minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "Pac-Man",
  "吃豆人",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀",
];

describe("destroy 归零", () => {
  it("加了几种监听就摘几种,一个不落", () => {
    const added = [...shell.matchAll(/addEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    const removed = [...shell.matchAll(/removeEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    // click 是随按钮一起被移除的(整棵子树都 remove 掉了),其余都得显式摘掉
    const need = new Set(added.filter((n) => n !== "click"));
    expect(need.size).toBeGreaterThan(3);
    for (const name of need) expect(removed, `${name} 监听没摘`).toContain(name);
  });

  it("定时器和动画帧都有对应的清理", () => {
    expect(shell).toContain("clearTimeout");
    expect(shell).toContain("cancelAnimationFrame");
    expect(shell).toContain("clearTimers()");
    expect(shell).toContain("clearFlights()");
  });

  it("destroy 里先立 destroyed 旗子,再清定时器、飞牌与牌面元素", () => {
    const body = shell.slice(shell.indexOf("    destroy() {"));
    const head = body.slice(0, body.indexOf("wrap.remove();"));
    expect(head).toContain("destroyed = true;");
    expect(head).toContain("clearTimers();");
    expect(head).toContain("clearFlights();");
    expect(head).toContain("dropAllCardEls();");
  });

  it("每一个 setTimeout 都走 later(),会被登记进 timers 里", () => {
    const raw = [...shell.matchAll(/window\.setTimeout\(/g)].length;
    expect(raw).toBe(1); // 只有 later() 里的那一处
    expect(shell).toContain("timers.add(id)");
  });

  it("游戏自己不碰音频上下文,声音一律走平台的 sfx", () => {
    expect(allSource).not.toContain("AudioContext");
  });
});

describe("手机 360px", () => {
  it("360 宽的屏幕上每张牌都不窄于 44px", () => {
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(44);
    expect(cardWidthFor(320)).toBeGreaterThanOrEqual(44);
  });

  it("底部「不出 / 提示 / 出牌」是固定一行三钮", () => {
    const bar = shell.slice(shell.indexOf('btnsEl.className = "ldc-mainbar"'));
    const play = bar.slice(bar.indexOf('} else if (phase === "play")'), bar.indexOf("subEl.appendChild"));
    expect(play).toContain("🙅 不出");
    expect(play).toContain("💡 提示");
    expect(play).toContain("✅ 出牌");
    expect(shell).toContain("flex-wrap:nowrap");
  });

  it("三钮与副排按钮的热区都不小于 44px", () => {
    // 只看按钮那几条规则:牌面小图标的高度不算热区
    const mins = [...shell.matchAll(/\.ld-btn[^{]*\{[^}]*min-height:(\d+)px/g)].map((m) => Number(m[1]));
    expect(mins.length).toBeGreaterThanOrEqual(3);
    for (const v of mins) expect(v).toBeGreaterThanOrEqual(42);
    expect(shell).toContain(".ldc-mainbar .ld-btn{flex:1 1 0;min-width:0;min-height:48px");
    expect(shell).toContain(".ldc-subbar .ld-btn{min-height:44px");
  });

  it("1.2 新加的样式一律用 ldc- 前缀,不去动别人的类名", () => {
    const newBlock = shell.slice(shell.indexOf("/* --- 1.2 新增"));
    const selectors = [...newBlock.matchAll(/^\.([a-z0-9-]+)/gm)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThan(5);
    for (const s of selectors) expect(s.startsWith("ldc-"), `${s} 应该用 ldc- 前缀`).toBe(true);
  });
});

describe("出牌动画接线", () => {
  it("牌桌真的用上了飞牌状态机,而不是自己写一套时长", () => {
    expect(shell).toContain("startFly(");
    expect(shell).toContain("stepFly(");
    expect(shell).toContain("flyDuration(reduced)");
    expect(shell).toContain("requestAnimationFrame");
  });

  it("出牌区读的是「飞到了才摆上桌」的 tableShown,不是直接读 state.prev", () => {
    const center = shell.slice(shell.indexOf("function renderCenter()"), shell.indexOf("function dropAllCardEls()"));
    expect(center).toContain("tableShown");
    expect(shell).toContain("else flyCards(seat, cards, landed);");
  });

  it("手牌 div 是复用的,重排才滑得动", () => {
    expect(shell).toContain("cardEls.get(id)");
    expect(shell).toContain("ldc-card-move");
    expect(FLY_MIN_MS).toBe(180);
    expect(FLY_MAX_MS).toBe(240);
  });

  it("勾了减弱动效就走短淡入的那条分支", () => {
    expect(shell).toContain("prefersReducedMotion()");
    expect(shell).toContain("prefers-reduced-motion: reduce");
  });
});

describe("分级红线", () => {
  it("整个目录没有一句赌博的说法", () => {
    for (const w of GAMBLING_WORDS) expect(allSource.includes(w), `源码里出现了「${w}」`).toBe(false);
  });

  it("整个目录一个商标都不沾(注释里也不行)", () => {
    const low = allSource.toLowerCase();
    for (const w of BRAND_WORDS) expect(low.includes(w.toLowerCase()), `源码里出现了「${w}」`).toBe(false);
  });

  it("不引入 three.js,保持 2D", () => {
    expect(allSource).not.toContain("three.js");
    expect(allSource).not.toMatch(/from ["']three["']/);
    expect(allSource).not.toContain("WebGL");
    expect(allSource).not.toContain("getContext(\"webgl");
  });

  it("没有广告、内购、账号、联网这些东西", () => {
    for (const w of ["广告", "内购", "登录", "注册", "fetch(", "XMLHttpRequest"]) {
      expect(allSource.includes(w), `源码里出现了「${w}」`).toBe(false);
    }
  });

  it("首页文案与事实对得上:四种模式、188 关、party 分类", () => {
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.levels).toBe(188);
    expect(meta.category).toBe("party");
    expect(meta.blurb).toContain("提示");
    expect(meta.blurb).toContain("188");
  });

  it("攻略里也讲了牌力提示三档", () => {
    const text = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
    expect(text).toContain("提示");
    for (const w of GAMBLING_WORDS) expect(text.includes(w)).toBe(false);
  });
});
