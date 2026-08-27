/**
 * 红蓝赛跑 · 壳层生命周期与文案红线（窗口5 第1轮监督修复员补）。
 *
 * 补的是一个覆盖漏口：本档五款里，`landlord-cards` / `clock-house` / `word-garden`
 * 都有各自的 `shell.test.ts`、`color-fun` 有 `upgrade12.test.ts`，四款都钉着
 * 「destroy 归零」和「整个目录一个商标都不沾」；**只有本款一条都没有**。
 * 本款偏偏是五款里唯一常驻 rAF 的（关内约 60fps），还挂着两套全局键盘监听，
 * 是最经不起漏一次清理的那一个。
 *
 * 这一份不改玩法，只钉四件事：
 *  1. 三处入口（闯关 / 对战场 / 无尽）的 destroy 都真的把 runtime 收了；
 *  2. 全局键盘只从 `bindKeys()` 这一个口子出去，而且句句交给 `rt.own()` 登记；
 *  3. 快速连点与来回切模式不会叠出第二份 runtime；
 *  4. 整个目录（注释也算）没有商标、没有赌博与流血的说法。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以生命周期这几条走源码巡检
 * （和本档另四款的同名用例一个路数），能拿纯函数验的就拿纯函数验。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bindRaceKeys, type KeyHost, type RaceKeyEvent } from "./keys";

const DIR = fileURLToPath(new URL("./", import.meta.url));
const INDEX = readFileSync(`${DIR}index.ts`, "utf8");
const ALL_SOURCE = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => readFileSync(DIR + f, "utf8"))
  .join("\n");

/** 商业商标与别家官方角色名,可见文案与注释里都不许出现 */
const BRAND_WORDS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
  "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀",
];

/** 分级红线：赛跑是比谁快，不是比谁狠 */
const HARM_WORDS = ["流血", "受伤", "骨折", "打死", "杀死", "死亡", "赌注", "下注", "输钱", "赢钱"];

describe("红蓝赛跑 · destroy 归零", () => {
  it("计时器、动画帧、监听全都只从 createRuntime() 这一个登记簿出去", () => {
    // 直接调 setTimeout / requestAnimationFrame 的地方只许有 createRuntime 里那几处
    const runtime = INDEX.slice(INDEX.indexOf("function createRuntime()"), INDEX.indexOf("const CONFETTI_COLORS"));
    expect([...INDEX.matchAll(/\bsetTimeout\(/g)].length).toBe(
      [...runtime.matchAll(/\bsetTimeout\(/g)].length
    );
    expect([...INDEX.matchAll(/\brequestAnimationFrame\(/g)].length).toBe(
      [...runtime.matchAll(/\brequestAnimationFrame\(/g)].length
    );
    expect(INDEX).not.toContain("setInterval(");
    // dispose 一次把三样都收掉
    expect(runtime).toContain("dead = true;");
    expect(runtime).toContain("cancelAnimationFrame(raf);");
    expect(runtime).toContain("timeouts.forEach((t) => clearTimeout(t));");
    expect(runtime).toContain("off?.();");
  });

  it("三处入口的 destroy 都真的把自己的 runtime 收了", () => {
    const bodies = [...INDEX.matchAll(/destroy\(\) \{([\s\S]*?)\n {4}\}/g)].map((m) => m[1]);
    // 闯关 playLevel / 对战场 mountVersus / 无尽 mountEndless / mount 总入口
    expect(bodies.length).toBeGreaterThanOrEqual(4);
    for (const body of bodies) {
      expect(/dispose\(\)|side\?\.destroy\(\)/.test(body), `有一处 destroy 没收 runtime：${body}`).toBe(true);
    }
    // 总入口还要连着关掉侧场并摘掉自己的 DOM
    const outer = bodies[bodies.length - 1];
    expect(outer).toContain("side?.destroy();");
    expect(outer).toContain("level.destroy();");
    expect(outer).toContain("root.remove();");
  });

  it("全局键盘只有 bindKeys() 一个口子，而且每一处都交给 rt.own() 登记", () => {
    // 只有 bindKeys 里那一处会把监听挂到 window 上
    expect([...INDEX.matchAll(/window as unknown as KeyHost/g)].length).toBe(1);
    expect(INDEX).not.toContain("window.addEventListener");
    // 三处调用（闯关 / 对战场 / 无尽）全部包在 rt.own( … ) 里
    const calls = [...INDEX.matchAll(/bindKeys\(/g)].length;
    expect(calls).toBe(4); // 1 处定义 + 3 处调用
    const owned = [...INDEX.matchAll(/\bown\(\s*\n\s*bindKeys\(/g)].length;
    expect(owned).toBe(3);
  });

  it("声音一律走平台的 sfx，本款自己不建音频上下文", () => {
    expect(ALL_SOURCE).not.toContain("AudioContext");
  });

  it("卸载器可以重复调用，键盘监听不会摘两次也不会摘漏", () => {
    const bound: Array<(ev: RaceKeyEvent) => void> = [];
    const host: KeyHost = {
      addEventListener: (_t, h) => void bound.push(h),
      removeEventListener: (_t, h) => void bound.splice(bound.indexOf(h), 1),
    };
    let hits = 0;
    const off = bindRaceKeys(host, true, () => void hits++);
    expect(bound.length).toBe(2);
    off();
    off();
    expect(bound.length).toBe(0);
    expect(hits).toBe(0);
  });
});

describe("红蓝赛跑 · 快速连点与来回切模式", () => {
  it("对战场 / 无尽的入口连点两下只开得出一个，开着的时候再点不叠第二份", () => {
    const openSide = INDEX.slice(INDEX.indexOf("function openSide("), INDEX.indexOf("versusBtn.addEventListener"));
    expect(openSide).toContain("if (side) return;");
    const closeSide = INDEX.slice(INDEX.indexOf("function closeSide("), INDEX.indexOf("function openSide("));
    expect(closeSide).toContain("side?.destroy();");
    expect(closeSide).toContain("side = null;");
  });

  it("对战场里换对手 / 打下一局，先把上一局的 runtime 收掉再开新的", () => {
    const startRound = INDEX.slice(INDEX.indexOf("function startRound()"));
    const head = startRound.slice(0, startRound.indexOf("round++;"));
    expect(head).toContain("roundRt?.dispose();");
    expect(head.indexOf("roundRt?.dispose();")).toBeLessThan(head.indexOf("createRuntime()"));
  });

  it("暂停 / 切后台再回来，那一大跳的时间差被夹住，人不会瞬移过终点", () => {
    // 暂停面板与切后台都会让 rAF 停一段时间，回来的第一帧 `now - lastTime` 是好几秒。
    // 三条主循环（闯关 / 对战场 / 无尽）都必须夹上限，少一条就能一帧冲线。
    const clamps = [...INDEX.matchAll(/const dt = Math\.min\(([\d.]+),/g)].map((m) => Number(m[1]));
    expect(clamps.length).toBe(3);
    for (const c of clamps) expect(c).toBeLessThanOrEqual(0.05);
  });

  it("一局跑完之后 later() / frame() 都不再放行，回调不会在退出后补跑", () => {
    const runtime = INDEX.slice(INDEX.indexOf("function createRuntime()"), INDEX.indexOf("const CONFETTI_COLORS"));
    const later = runtime.slice(runtime.indexOf("later(fn, ms)"), runtime.indexOf("frame(cb)"));
    expect(later).toContain("if (dead) return;");
    expect(later).toContain("if (!dead) fn();"); // 排队中的那一发也要拦
    const frame = runtime.slice(runtime.indexOf("frame(cb)"), runtime.indexOf("stopFrame()"));
    expect(frame).toContain("if (dead) return;");
  });
});

describe("红蓝赛跑 · 文案红线", () => {
  it("整个目录一个商标都不沾（注释里也不行）", () => {
    const low = ALL_SOURCE.toLowerCase();
    for (const w of BRAND_WORDS) {
      expect(low.includes(w.toLowerCase()), `源码里出现了「${w}」`).toBe(false);
    }
  });

  it("没有流血、受伤与赌博的说法", () => {
    for (const w of HARM_WORDS) {
      // 「不掉血」这类明写着「不会怎样」的说明不算，逐条按整词查
      expect(ALL_SOURCE.includes(w), `源码里出现了「${w}」`).toBe(false);
    }
  });

  it("筛子确实能拦下踩线的句子（防止黑名单写空了这几条空转）", () => {
    expect(BRAND_WORDS.length).toBeGreaterThan(20);
    expect(new Set(BRAND_WORDS).size).toBe(BRAND_WORDS.length);
    expect("这一关像超级玛丽".includes(BRAND_WORDS[8])).toBe(true);
    expect("对手流血了".includes(HARM_WORDS[0])).toBe(true);
  });
});
