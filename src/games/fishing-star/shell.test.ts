/**
 * 钓鱼小达人 —— 钓场外壳巡检。
 *
 * 这一份不测张力也不测鱼,只把整个目录的源码扒出来盯四件事:
 *  1. `destroy` 得把 rAF、定时器和所有监听收干净,离开钓场不留后台任务;
 *  2. 1.2 追加的样式一律 `fss-` 前缀,而且只许追加在老规则后面;
 *  3. 手机 360px 上那颗「按住抛竿」够 64px、图鉴卡片够 88px;
 *  4. 红线:只用星星、没有货币内购、没有商标、保持 2D 侧视、失败只鼓励。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import guide from "./guide";
import { TOUCH_MIN_PX } from "./index";
import { meta } from "./meta";

const dir = fileURLToPath(new URL(".", import.meta.url));
/** 玩法源码(不含测试文件本身:巡检用的黑名单词就写在测试里,扫自己会误伤) */
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const shell = readFileSync(`${dir}index.ts`, "utf8");
/** 整份玩法源码(含注释) */
const allSource = files.map((f) => readFileSync(`${dir}${f}`, "utf8")).join("\n");
/** 只留代码,把注释剥掉:注释里写「不做真 3D」「没有内购」是好事,不该被巡检误伤 */
const code = allSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** index.ts 里那一整块 CSS */
const css = shell.slice(shell.indexOf("const CSS = `"), shell.indexOf("\n`;\n"));

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
  it("每一处 addEventListener 都配了一处 removeEventListener(click 随子树一起摘)", () => {
    const added = [...shell.matchAll(/addEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    const removed = [...shell.matchAll(/removeEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    const need = new Set(added.filter((n) => n !== "click"));
    expect(need.size).toBeGreaterThanOrEqual(6);
    for (const name of need) expect(removed, `${name} 监听没摘`).toContain(name);
  });

  it("摘监听的动作全部登记进 ledger,不是散落在 destroy 里手写", () => {
    const removes = [...shell.matchAll(/removeEventListener\("[a-z]+"/g)].length;
    const booked = [...shell.matchAll(/ledger\.listener\(/g)].length;
    expect(booked).toBe(removes);
  });

  it("每一次 requestAnimationFrame 都过一遍 ledger.raf,没有裸的帧号", () => {
    const raf = [...shell.matchAll(/requestAnimationFrame\(/g)].length;
    const booked = [...shell.matchAll(/ledger\.raf\(requestAnimationFrame\(/g)].length;
    expect(raf).toBeGreaterThan(0);
    expect(booked).toBe(raf);
  });

  it("destroy 先立旗子再一次性还清登记簿", () => {
    const body = shell.slice(shell.indexOf("    destroy() {"));
    const head = body.slice(0, body.indexOf("wrap.remove();"));
    expect(head).toContain("finished = true;");
    expect(head).toContain("ledger.releaseAll();");
  });

  it("游戏自己不碰音频上下文,声音一律走平台的 sfx", () => {
    expect(allSource).not.toContain("AudioContext");
  });
});

describe("1.2 样式只许追加", () => {
  it("1.2 那一段里的选择器全是 fss- 前缀", () => {
    const block = css.slice(css.indexOf("1.2 追加"));
    const selectors = [...block.matchAll(/^\.([a-z0-9-]+)/gm)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThan(15);
    for (const s of selectors) expect(s.startsWith("fss-"), `${s} 应该用 fss- 前缀`).toBe(true);
  });

  it("fss- 的规则一条不落地排在老 fs- 规则后面,没有插队", () => {
    const firstFss = css.search(/^\.fss-/m);
    const lastFs = css.search(/^\.fs-(?!s)[a-z-]*\{(?![\s\S]*^\.fs-(?!s))/m);
    expect(firstFss).toBeGreaterThan(0);
    expect(firstFss).toBeGreaterThan(lastFs);
  });
});

describe("手机 360px", () => {
  it("蓄力与收线共用的那颗大按钮热区不小于 64px", () => {
    expect(css).toContain(".fss-act{min-height:64px;");
    const mins = [...css.matchAll(/\.fss-act\{min-height:(\d+)px/g)].map((m) => Number(m[1]));
    expect(mins.length).toBe(1);
    for (const v of mins) expect(v).toBeGreaterThanOrEqual(64);
  });

  it("窄屏那一档只收窄宽度,没有把高度也压下去", () => {
    const narrow = css.slice(css.lastIndexOf("@media (max-width:420px)"));
    expect(narrow).toContain(".fss-act{min-width:");
    expect(narrow).not.toMatch(/\.fss-act\{[^}]*min-height/);
  });

  it("640 高的机器再收一档,收完还高就自己滚,那颗大按钮不许被收到 44px 以下", () => {
    // 测试员 W5-B-01：360×640 上第 100 关的「🎣 按住抛竿」中心落到舞台裁切线以下 8px。
    // 舞台那一半（定高 + overflow:hidden）是平台文件,交给窗口1;本款先自己兜住。
    const at = css.indexOf("@media (max-height:660px)");
    expect(at, "没有 640 高那一档").toBeGreaterThan(-1);
    const short = css.slice(at, css.indexOf("@media", at + 10));
    expect(short).toContain("overflow-y:auto");
    expect(short).toContain("max-height:100%");
    expect(short).toMatch(/\.fs-act\{[^}]*min-height:44px/);
    // 这一档必须排在既有的 720 那一档后面,否则被它盖回去
    expect(css.indexOf("@media (max-height:720px)")).toBeLessThan(at);
  });

  it("小按钮（⏸ 暂停、结算页那几颗）抬到 44px 触屏底线", () => {
    // 复审时用 elementFromPoint 逐个量热区，这一批实测只有 34px 高——
    // 本档统一的规矩是「可点的最小边长 44px」，只抬高度不动配色圆角
    expect(TOUCH_MIN_PX).toBe(44);
    // 这里读的是源码原文，样式里写的是模板占位符而不是数字
    const btn = css.slice(css.indexOf(".fs-btn{"), css.indexOf(".fs-btn:active"));
    expect(btn).toContain("min-height:${TOUCH_MIN_PX}px");
    // 抬高之后文字得居中，不然贴着上边更难按
    expect(btn).toContain("align-items:center");
    expect(btn).toContain("box-sizing:border-box");
    // 矮屏那两档不许把它又收回去
    for (const q of ["@media (max-height:720px)", "@media (max-height:660px)"]) {
      const at = css.indexOf(q);
      const block = css.slice(at, css.indexOf("@media", at + 10));
      expect(block, `${q} 里把 .fs-btn 的高度又收回去了`).not.toMatch(/\.fs-btn\{[^}]*min-height/);
    }
  });

  it("图鉴卡片不窄于 88px,窄屏那一档也一样", () => {
    const widths = [...css.matchAll(/\.fs-dex\{[^}]*minmax\((\d+)px/g)].map((m) => Number(m[1]));
    const narrow = [...css.matchAll(/\.fs-dex\{grid-template-columns:repeat\(auto-fill,minmax\((\d+)px/g)].map((m) =>
      Number(m[1])
    );
    expect(widths.length + narrow.length).toBeGreaterThanOrEqual(2);
    for (const v of [...widths, ...narrow]) expect(v).toBeGreaterThanOrEqual(88);
  });

  it("张力条在大按钮上方:bars 先 append,actBtn 最后", () => {
    const order = shell.slice(shell.indexOf("wrap.append("), shell.indexOf("wrap.append(") + 200);
    expect(order.indexOf("bars")).toBeLessThan(order.indexOf("actBtn"));
  });
});

describe("平台接线", () => {
  it("闯关走平台的 mountLevelGame,跳关与直开第 N 关都由它统一管", () => {
    expect(shell).toContain("mountLevelGame(");
    expect(shell).toContain("chapters: CHAPTERS");
    expect(shell).toContain("guide: GUIDE");
  });

  it("无尽成绩报的是总重量千克,不是分数", () => {
    const line = shell.slice(shell.indexOf("save.recordEndlessBest("));
    expect(line.startsWith("save.recordEndlessBest(meta.id, kg)")).toBe(true);
    expect(shell).not.toContain("recordEndlessBest(meta.id, score)");
  });

  it("首页文案与事实对得上:casual、两种模式、188 关", () => {
    expect(meta.category).toBe("casual");
    expect(meta.modes).toEqual(["campaign", "endless"]);
    expect(meta.levels).toBe(188);
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).toContain("图鉴");
  });

  it("上鱼小演出不超过 900 毫秒,而且看够了能按掉", () => {
    const showMs = Number(/const SHOW_MS = (\d+)/.exec(shell)?.[1]);
    const skipMs = Number(/const SHOW_SKIP_MS = (\d+)/.exec(shell)?.[1]);
    expect(showMs).toBeLessThanOrEqual(900);
    expect(skipMs).toBeGreaterThan(0);
    expect(skipMs).toBeLessThan(showMs);
    expect(shell).toContain("if (phaseMs >= SHOW_SKIP_MS) afterShow();");
  });

  it("咬钩给了反应窗口,而不是当场判死", () => {
    const window = Number(/const BITE_WINDOW_MS = (\d+)/.exec(shell)?.[1]);
    expect(window).toBeGreaterThanOrEqual(400);
  });
});

describe("分级红线", () => {
  it("整个目录一个商标都不沾(注释里也不行)", () => {
    const low = allSource.toLowerCase();
    for (const w of BRAND_WORDS) expect(low.includes(w.toLowerCase()), `源码里出现了「${w}」`).toBe(false);
  });

  it("只用星星:代码里没有第二种货币,也没有任何购买接口", () => {
    for (const w of ["金币", "钻石", "点券", "充值", "内购", "货币", "purchase", "iap", "checkout"]) {
      expect(code.toLowerCase().includes(w.toLowerCase()), `代码里出现了「${w}」`).toBe(false);
    }
    // 花钱只有一条路:平台钱包的 addStars(升级时扣的是负数)
    expect(shell).toContain("api.addStars(-");
  });

  it("不引入 three.js,保持 2D 侧视", () => {
    expect(code).not.toMatch(/from ["']three["']/);
    expect(code).not.toContain("WebGL");
    expect(code).not.toContain('getContext("webgl');
    expect(shell).toContain('getContext("2d")');
  });

  it("没有广告、账号、联网这些东西", () => {
    for (const w of ["广告", "登录", "注册", "fetch(", "XMLHttpRequest", "WebSocket"]) {
      expect(code.includes(w), `代码里出现了「${w}」`).toBe(false);
    }
  });

  it("没有伤害表达:鱼只会溜走或者被放回水里", () => {
    for (const w of ["血", "死亡", "杀死", "受伤", "hp", "damage"]) {
      expect(code.toLowerCase().includes(w.toLowerCase()), `源码里出现了「${w}」`).toBe(false);
    }
    expect(shell).toContain("放生");
  });

  it("失败只鼓励:跑鱼与断线的每一句都不批评人", () => {
    const lines = [...allSource.matchAll(/loseLine[\s\S]{0,600}?\];/g)].join("\n");
    for (const w of ["笨", "菜", "又输", "真差", "不行"]) {
      expect(lines.includes(w), `失败文案里出现了「${w}」`).toBe(false);
    }
  });

  it("攻略里讲清了红区那 1.2 秒和三种挣扎节奏", () => {
    const text = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
    expect(text).toContain("红区");
    expect(text).toContain("1.2 秒");
    const low = text.toLowerCase();
    for (const w of BRAND_WORDS) expect(low.includes(w.toLowerCase())).toBe(false);
  });
});
