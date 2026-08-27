/**
 * 识字小花园 —— 外壳巡检。
 *
 * 出题与判分归 `bank.test.ts` / `strokes.test.ts` 管，这一份把整个目录的源码扒出来盯五件事：
 *  1. 公共资产只读：`quiz99.ts` / `speech.ts` / `level99.ts` 只许 import，不许改；
 *  2. `destroy` 要把两轮的壳、监听、timer 一起收干净；
 *  3. 1.2 追加的样式一律 `wgd-` 前缀，而且只贴在后面，不改 `qz-` / `l99-` 的老规则；
 *  4. 手机 360px：描红区 ≥ 240px、按钮 ≥ 44px、题干字号够大，减弱动效有兜底；
 *  5. 红线：攻略不泄题、失败只鼓励、保持 2D、不联网、不内购、无商标。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import guide from "./guide";
import { meta } from "./meta";
import { REVIEW_CSS, REVIEW_DONE, REVIEW_NOTE } from "./runner";
import { MIN_PAD_PX, TRACE_INTRO, WGD_CSS } from "./tracing";
import { LOOKALIKE_SETS, IDIOM_CARDS, POLYPHONE_CARDS, SYN_ANT_CARDS } from "./logic";
import { CHAPTER_POOLS } from "./levels";

const DIR = fileURLToPath(new URL(".", import.meta.url));

function read(name: string): string {
  return readFileSync(`${DIR}${name}`, "utf8");
}

const runner = read("runner.ts");
const tracing = read("tracing.ts");
const buildChar = read("buildChar.ts");
/** 只扒发布出去的源码；测试自己写着黑名单，不能算进去 */
const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const allSource = files.map((f) => read(f)).join("\n");

/** 商标黑名单：一个都不许出现在源码或文案里 */
const TRADEMARKS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "拳皇", "街霸",
  "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris", "球球大作战", "我的世界",
  "Minecraft", "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀",
];

describe("识字小花园 · 公共资产只读", () => {
  it("目录里一个字都没写回 quiz99 / speech / level99，只是 import 进来用", () => {
    for (const mod of ["quiz99", "speech", "level99"]) {
      const uses = [...allSource.matchAll(new RegExp(`\\.\\./${mod}`, "g"))].length;
      expect(uses, `${mod} 应该被用到`).toBeGreaterThan(0);
    }
    // 没有 monkey patch：不给公共模块的导出赋值，也不改它们的原型
    expect(allSource).not.toMatch(/(runQuiz|speak|mountLevelGame|stopSpeaking|shouldHint|quizStars)\s*=[^=>]/);
    expect(allSource).not.toMatch(/Object\.(defineProperty|assign)\(\s*(quiz|speech|level)/i);
  });

  it("复查轮只在本款目录里用 ctx 代理实现，不拦壳的点击、不改壳的判分", () => {
    expect(runner).toContain('stage.addEventListener("click", onClick, true)');
    expect(runner).not.toContain("stopPropagation");
    expect(runner).not.toContain("preventDefault");
    // 复查轮不判失败：lose 也接到同一个 finish 上
    expect(runner).toMatch(/win: finish, lose: finish/);
    expect(REVIEW_NOTE).not.toMatch(/错了|笨|不行/);
    expect(REVIEW_DONE.length).toBeGreaterThan(0);
  });

  it("朗读全部走公共 speech.ts，没有中文语音包就把按钮藏起来，做题不受影响", () => {
    for (const src of [tracing, buildChar]) {
      expect(src).toContain("whenSpeechReady");
      expect(src).toContain("speechReady()");
      expect(src).toContain("hidden = false");
      expect(src).toContain("stopSpeaking()");
    }
    // 按钮默认就是藏着的，语音包来了才亮出来
    expect(tracing).toContain('class="wgd-say"');
    expect(tracing).toMatch(/wgd-say[^>]*hidden/);
    expect(buildChar).toMatch(/bc-say[^>]*hidden/);
  });
});

describe("识字小花园 · destroy 归零", () => {
  it("描红台：监听、timer、DOM 全部拆干净，指针状态归零", () => {
    const body = tracing.slice(tracing.indexOf("destroy() {"));
    for (const line of [
      "removeEventListener(\"pointerdown\"",
      "removeEventListener(\"pointermove\"",
      "removeEventListener(\"pointerup\"",
      "removeEventListener(\"pointercancel\"",
      "clearTimeout",
      "timeouts.clear()",
      "unwatchSpeech()",
      "stopSpeaking()",
      "wrap.remove()",
    ]) {
      expect(body, `描红台 destroy 少了 ${line}`).toContain(line);
    }
    expect(body).toContain("destroyed = true");
    expect(body).toContain("drawing = false");
  });

  it("运行器：两轮的壳、监听、注入的样式一起收", () => {
    const body = runner.slice(runner.indexOf("destroy() {"));
    expect(body).toContain("dropRound()");
    expect(body).toContain("style.remove()");
    expect(runner).toContain("observer?.disconnect()");
    expect(runner).toContain("timers.forEach((t) => clearTimeout(t))");
    expect(runner).toContain('stage.removeEventListener("click", onClick, true)');
  });

  it("组字工坊补了朗读之后，destroy 也跟着收语音", () => {
    const body = buildChar.slice(buildChar.indexOf("destroy() {"));
    expect(body).toContain("unwatchSpeech()");
    expect(body).toContain("stopSpeaking()");
    expect(body).toContain("timeouts.clear()");
  });
});

describe("识字小花园 · 样式与手机 360px", () => {
  it("1.2 追加的类名一律 wgd- 前缀，不动 qz- / l99- 的老规则", () => {
    const added = [...`${WGD_CSS}\n${REVIEW_CSS}`.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
    expect(added.length).toBeGreaterThan(10);
    for (const cls of added) {
      expect(cls.startsWith("wgd-"), `新样式类名要 wgd- 前缀：${cls}`).toBe(true);
    }
    // 组字工坊沿用 1.1 的 bc- 前缀，同样只往后贴
    expect(buildChar).not.toMatch(/\.qz-[\w-]*\s*\{/);
    expect(tracing).not.toMatch(/\.(qz|l99)-[\w-]*\s*\{/);
  });

  it("描红区 ≥ 240px、按钮 ≥ 44px、题干字号够大", () => {
    expect(MIN_PAD_PX).toBeGreaterThanOrEqual(240);
    expect(WGD_CSS).toContain(`min-width:${MIN_PAD_PX}px`);
    expect(WGD_CSS).toMatch(/\.wgd-say\{[^}]*min-height:44px/);
    expect(buildChar).toMatch(/\.bc-say\{[^}]*min-height:44px/);
    // 手指会挡住字，所以正在描第几笔永远写在顶上那一行
    expect(WGD_CSS).toMatch(/\.wgd-peek\{[^}]*font-size:17px/);
    expect(tracing).toContain("正在描第");
    // 窄屏另有一套
    expect(WGD_CSS).toContain("@media (max-width:400px)");
  });

  it("prefers-reduced-motion 下关掉生长动画，直接显示结果", () => {
    expect(WGD_CSS).toContain("@media (prefers-reduced-motion:reduce)");
    expect(WGD_CSS).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  });

  it("保持 2D：不引 three.js，不碰 WebGL，也不联网不内购", () => {
    expect(allSource).not.toMatch(/three|WebGL|webgl|canvas3d/i);
    expect(allSource).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|https?:\/\/(?!www\.w3\.org)/);
    expect(allSource).not.toMatch(/内购|付费|广告|登录|账号/);
  });
});

describe("识字小花园 · 内容红线", () => {
  it("攻略只讲方法，一个答案字都不给", () => {
    const tips = [...guide.general, ...guide.entries.flatMap((e) => e.tips)].join("");
    // 六张字卡上的字、形近字组里的字、成语、近反义词，攻略里一个都不许点名
    for (const c of CHAPTER_POOLS.flat()) {
      expect(tips.includes(`「${c.char}」`), `攻略点名了答案字 ${c.char}`).toBe(false);
    }
    for (const item of LOOKALIKE_SETS.flat()) {
      expect(tips.includes(item.word), `攻略给出了形近字答案词 ${item.word}`).toBe(false);
    }
    for (const card of IDIOM_CARDS) {
      expect(tips.includes(card.idiom), `攻略写出了成语 ${card.idiom}`).toBe(false);
    }
    for (const card of SYN_ANT_CARDS) {
      expect(tips.includes(card.synonym), `攻略给出了近义词 ${card.synonym}`).toBe(false);
      expect(tips.includes(card.antonym), `攻略给出了反义词 ${card.antonym}`).toBe(false);
      expect(tips.includes(card.word), `攻略给出了近反义题干词 ${card.word}`).toBe(false);
    }
    for (const card of POLYPHONE_CARDS) {
      for (const r of card.readings) {
        expect(tips.includes(r.pinyin), `攻略给出了读音 ${r.pinyin}`).toBe(false);
      }
    }
    expect(guide.entries).toHaveLength(11);
    expect(guide.gameId).toBe(meta.id);
  });

  it("失败与提示只鼓励，绝不批评孩子", () => {
    const lines = [TRACE_INTRO, REVIEW_NOTE, REVIEW_DONE];
    for (const line of lines) expect(line).not.toMatch(/笨|差劲|不行|太慢|又错/);
    // 描红台压根没有 lose 这条路：写字这件事上不该有「输」
    expect(tracing).not.toContain("ctx.lose");
    expect(tracing).toContain("ctx.win");
  });

  it("meta 与事实对齐：188 关、只做闯关、blurb 说得出新玩法", () => {
    expect(meta.id).toBe("word-garden");
    expect(meta.levels).toBe(188);
    expect(meta.category).toBe("edu");
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.platform).toBe("both");
    expect(meta.blurb).toContain("十一座花园 188 关");
    expect(meta.blurb).toContain("笔顺");
    expect(meta.blurb).toContain("多音字");
  });

  it("没有商标、没有别家角色", () => {
    const text = `${allSource}${guide.general.join("")}${guide.entries.map((e) => e.tips.join("")).join("")}`;
    for (const name of TRADEMARKS) {
      expect(text.includes(name), `出现商标：${name}`).toBe(false);
    }
  });
});
