/**
 * 红蓝点点 —— 外壳巡检。
 *
 * 判分归 `rounds.test.ts` 管,这一份把整个目录的源码扒出来盯四件事:
 *  1. `destroy` 要把定时器与两套键位收干净,离开对战场不留后台任务;
 *  2. 1.2 追加的样式一律 `rbt-` 前缀(拔河那款用的是 rbg 前缀,不许撞),而且只贴在老规则后面;
 *  3. 手机 360px 上按钮 ≥ 72px、两侧热区之间的隔离带 ≥ 24px;
 *  4. 红线:无血无伤、失败只鼓励、只用朵朵 / 星星、无商标、保持 2D、不联网不内购。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import guide from "./guide";
import { meta } from "./meta";
import { KEYS_LEFT, KEYS_RIGHT, KEY_MIN_PX, SIDE_GUTTER_PX } from "./arena";

const DIR = fileURLToPath(new URL(".", import.meta.url));

function read(name: string): string {
  return readFileSync(`${DIR}${name}`, "utf8");
}

const arena = read("arena.ts");
const shell = read("index.ts");
const rounds = read("rounds.ts");
/** 只扒发布出去的源码;测试自己写着黑名单,不能算进去 */
const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const allSource = files.map((f) => read(f)).join("\n");

/** 商标黑名单:一个都不许出现在源码或文案里 */
const TRADEMARKS = [
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
  "王者荣耀"
];

describe("红蓝点点 · destroy 归零", () => {
  it("对战场里每一处 addEventListener 都配了一处 removeEventListener(click 随子树一起摘)", () => {
    const added = [...arena.matchAll(/addEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    const removed = [...arena.matchAll(/removeEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    const need = new Set(added.filter((n) => n !== "click"));
    expect(need.size).toBeGreaterThanOrEqual(2);
    for (const name of need) expect(removed, `${name} 监听没摘`).toContain(name);
  });

  it("两套键位分开挂、也分开卸:装了几个 keydown 就卸几个", () => {
    const on = [...arena.matchAll(/window\.addEventListener\("keydown"/g)].length;
    const off = [...arena.matchAll(/window\.removeEventListener\("keydown"/g)].length;
    // 对战场两套(朵朵 + 星星)、无尽一套
    expect(on).toBe(3);
    expect(off).toBe(on);
  });

  it("摘监听的动作全部登记进 offs,不是散落在 destroy 里手写", () => {
    const removes = [...arena.matchAll(/removeEventListener\("[a-z]+"/g)].length;
    const booked = [...arena.matchAll(/offs\.push\(/g)].length;
    expect(booked).toBe(removes);
  });

  it("每个 destroy 都先立旗子,再清定时器、卸监听、摘 DOM", () => {
    const blocks = [...arena.matchAll(/destroy\(\) \{([\s\S]*?)\n    \}/g)].map((m) => m[1]);
    expect(blocks).toHaveLength(2);
    for (const body of blocks) {
      expect(body).toContain("destroyed = true;");
      expect(body).toContain("over = true;");
      expect(body).toContain("clearTimers();");
      expect(body).toContain("offs.forEach((off) => off());");
      expect(body).toContain("wrap.remove();");
    }
  });

  it("对战场里所有 setTimeout 都走 later(),没有裸的定时器漏在外面", () => {
    const raw = [...arena.matchAll(/setTimeout\(/g)].length;
    const inLater = [...arena.matchAll(/const t = setTimeout\(/g)].length;
    expect(raw).toBe(inLater);
    expect(inLater).toBe(2);
  });

  it("闯关那一层的 destroy 照旧把点、定时器和外壳一起收掉", () => {
    const body = shell.slice(shell.indexOf("      destroyed = true;\n      ended = true;"));
    const head = body.slice(0, body.indexOf("wrap.remove();"));
    expect(head).toContain("clearDots();");
    expect(head).toContain("timeouts.clear();");
  });

  it("游戏自己不碰音频上下文,声音一律走平台", () => {
    expect(allSource).not.toContain("AudioContext");
  });
});

describe("红蓝点点 · 样式只追加,前缀不撞车", () => {
  it("1.2 的样式全部 rbt 前缀,没有借用拔河那款的前缀", () => {
    const selectors = [...arena.matchAll(/^\.([a-z-]+)/gm)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThan(10);
    for (const sel of selectors) expect(sel.startsWith("rbt-"), `${sel} 不是 rbt- 前缀`).toBe(true);
    expect(allSource).not.toContain("rbg-");
  });

  it("index.ts 的 1.2 样式块贴在文件最后,没有插进 1.1 的规则里", () => {
    const v12 = shell.indexOf("const CSS_V12");
    const legacyCss = shell.indexOf("const CSS = `");
    const legacyEndless = shell.indexOf("const ENDLESS_CSS = `");
    expect(v12).toBeGreaterThan(legacyCss);
    expect(v12).toBeGreaterThan(legacyEndless);
    expect(shell.trim().endsWith("`;")).toBe(true);
    const block = shell.slice(v12);
    for (const sel of [...block.matchAll(/^\.([a-z-]+)/gm)].map((m) => m[1])) {
      expect(sel.startsWith("rbt-")).toBe(true);
    }
  });

  it("1.1 的老规则一条没动:点点、场地、提示条的选择器都还在", () => {
    for (const sel of [".rbt-wrap", ".rbt-arena", ".rbt-dot", ".rbt-msg", ".rbt-badge", ".rbt-dot-num"]) {
      expect(shell).toContain(`${sel} {`);
    }
  });
});

describe("红蓝点点 · 手机 360px", () => {
  it("按钮 ≥ 72px、两侧热区隔离带 ≥ 24px,常量与样式对得上", () => {
    expect(KEY_MIN_PX).toBeGreaterThanOrEqual(72);
    expect(SIDE_GUTTER_PX).toBeGreaterThanOrEqual(24);
    expect(arena).toContain("min-width: ${KEY_MIN_PX}px; min-height: ${KEY_MIN_PX}px");
    expect(arena).toContain("flex: 0 0 ${SIDE_GUTTER_PX}px; min-width: ${SIDE_GUTTER_PX}px");
  });

  it("窄屏的分支里按钮不许缩水到 72px 以下", () => {
    const narrow = arena.slice(arena.indexOf("@media (max-width: 420px)"));
    expect(narrow).toContain("min-width: ${KEY_MIN_PX}px; min-height: ${KEY_MIN_PX}px");
    expect(narrow).toContain("flex-basis: ${SIDE_GUTTER_PX}px");
  });

  it("闯关的点在手机上也放大到 72px", () => {
    const v12 = shell.slice(shell.indexOf("const CSS_V12"));
    expect(v12).toContain(".rbt-arena .rbt-dot { width: 72px; height: 72px;");
    const narrow = v12.slice(v12.indexOf("@media (max-width: 420px)"));
    expect(narrow).toContain("width: 72px; height: 72px;");
  });

  it("比分与回合提示这一行字号 ≥ 16px", () => {
    expect(arena).toMatch(/\.rbt-vs-score \{[^}]*font-size: (1[6-9]|[2-9]\d)px/);
    expect(arena).toMatch(/\.rbt-vs-brief \{[^}]*font-size: (1[6-9]|[2-9]\d)px/);
  });

  it("两套键位各四个键,左右手不重叠", () => {
    expect(KEYS_LEFT).toHaveLength(4);
    expect(KEYS_RIGHT).toHaveLength(4);
    expect(KEYS_LEFT.filter((k) => KEYS_RIGHT.includes(k))).toEqual([]);
  });
});

describe("红蓝点点 · 无障碍与手感", () => {
  it("亮灯有预备节奏:预备类名与预备时长两边都写死了", () => {
    expect(shell).toContain("rbt-dot-ready");
    expect(shell).toContain("READY_MIN_MS");
    expect(arena).toContain("rbt-ready");
    expect(rounds).toContain("export const READY_MIN_MS");
  });

  it("prefers-reduced-motion 下关掉闪烁", () => {
    expect(arena).toContain("@media (prefers-reduced-motion: reduce)");
    expect(shell).toContain("@media (prefers-reduced-motion: reduce)");
    const reduced = arena.slice(arena.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation: none");
  });

  it("按钮有 aria-label,不是只靠颜色说话", () => {
    expect(arena).toContain("setAttribute(\"aria-label\"");
    expect(arena).toContain("rbt-key-num");
  });

  it("抢点的惩罚文案是小云朵挡一下,不批评小孩", () => {
    expect(arena).toContain("小云朵");
    expect(shell).toContain("小云朵");
    for (const bad of ["笨", "太差", "失败者", "真慢"]) expect(allSource).not.toContain(bad);
  });
});

describe("红蓝点点 · 分级红线", () => {
  it("一个商标名都没有", () => {
    for (const name of TRADEMARKS) expect(allSource, `命中商标:${name}`).not.toContain(name);
  });

  it("无血无伤:源码里没有血、伤、死这些字眼", () => {
    for (const bad of ["流血", "受伤", "死亡", "杀死"]) expect(allSource).not.toContain(bad);
  });

  it("保持 2D:不引 three.js,也没有 WebGL", () => {
    expect(allSource).not.toContain("three");
    expect(allSource).not.toContain("WebGL");
    expect(allSource).not.toContain("webgl");
  });

  it("不联网、不内购、不要账号", () => {
    for (const bad of ["fetch(", "XMLHttpRequest", "WebSocket", "内购", "充值", "广告", "登录"]) {
      expect(allSource, `不该出现:${bad}`).not.toContain(bad);
    }
  });

  it("存档只走平台的 save,不自己碰 localStorage", () => {
    expect(allSource).not.toContain("localStorage");
    expect(arena).toContain("save.recordEndlessBest(meta.id, cleared)");
  });

  it("角色只有朵朵和星星", () => {
    expect(arena).toContain("朵朵");
    expect(arena).toContain("星星");
    expect(allSource).toContain("AVATAR_URLS.duoduo");
  });
});

describe("红蓝点点 · meta 与攻略跟事实对齐", () => {
  it("三模式、188 关、party 分类都没动", () => {
    expect(meta.id).toBe("red-blue-tap");
    expect(meta.category).toBe("party");
    expect(meta.levels).toBe(188);
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless"]);
  });

  it("blurb 说的是 1.2 的事实:四种回合 + 双人对战 + 点到手软", () => {
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).toContain("双人");
    expect(meta.blurb.length).toBeLessThanOrEqual(60);
  });

  it("攻略覆盖 1 到 188 关,没有断档", () => {
    expect(guide.gameId).toBe(meta.id);
    let at = 1;
    for (const e of guide.entries) {
      expect(e.from).toBe(at);
      expect(e.to).toBeGreaterThanOrEqual(e.from);
      at = e.to + 1;
    }
    expect(at - 1).toBe(188);
    expect(guide.general.length).toBeGreaterThanOrEqual(5);
  });
});
