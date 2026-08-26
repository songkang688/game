/**
 * 时钟小屋 —— 外壳巡检。
 *
 * 判分与出题归 `levels.test.ts` / `logic.test.ts` 管，这一份把整个目录的源码扒出来盯五件事：
 *  1. 公共资产只读：`quiz99.ts` / `speech.ts` / `level99.ts` 只许 import，不许改；
 *  2. `destroy` 要把两轮的壳、监听、timer、可拖钟面一起收干净；
 *  3. 1.2 追加的样式一律 `clk-` 前缀，而且只贴在后面，不改 `qz-` / `l99-` 的老规则；
 *  4. 手机 360px：钟面直径 ≥ 200px、按钮 ≥ 44px、题干字号 ≥ 16px、减弱动效有兜底；
 *  5. 红线：无商标、失败只鼓励、保持 2D、不联网、不内购。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import guide from "./guide";
import { meta } from "./meta";
import { CLK_CSS, HINT_AFTER_WRONG, MIN_FACE_PX, REVIEW_DONE, REVIEW_NOTE } from "./runner";

const DIR = fileURLToPath(new URL(".", import.meta.url));

function read(name: string): string {
  return readFileSync(`${DIR}${name}`, "utf8");
}

const runner = read("runner.ts");
const shell = read("index.ts");
/** 只扒发布出去的源码；测试自己写着黑名单，不能算进去 */
const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const allSource = files.map((f) => read(f)).join("\n");

/** 商标黑名单：一个都不许出现在源码或文案里 */
const TRADEMARKS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "俄罗斯方块",
  "Tetris",
  "球球大作战",
  "我的世界",
  "Minecraft",
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

describe("时钟小屋 · 公共资产只读", () => {
  it("目录里一个字都没写回 quiz99 / speech / level99，只是 import 进来用", () => {
    for (const mod of ["quiz99", "speech", "level99"]) {
      const uses = [...allSource.matchAll(new RegExp(`\\.\\./${mod}`, "g"))].length;
      expect(uses, `${mod} 应该被用到`).toBeGreaterThan(0);
    }
    // 没有 monkey patch：不给公共模块的导出赋值，也不改它们的原型
    expect(allSource).not.toMatch(/(runQuiz|speak|mountLevelGame|stopSpeaking|shouldHint)\s*=[^=]/);
    expect(allSource).not.toMatch(/Object\.(defineProperty|assign)\(\s*(quiz|speech|level)/i);
  });

  it("提示门槛和公共壳保持一致：连错 2 次，两边同时发生", () => {
    expect(HINT_AFTER_WRONG).toBe(2);
    // 壳自己的闪烁提示照旧，本款只是把那一行文字换成方法提示并朗读同一句
    expect(runner).toContain('stage.querySelector(".qz-msg")');
    expect(runner).toMatch(/msg\.textContent = line;/);
    expect(runner).toContain("speak(line);");
  });

  it("辅助层只读壳渲染出来的 DOM：捕获阶段监听不拦点击、不改判分", () => {
    expect(runner).toContain('stage.addEventListener("click", onClick, true)');
    expect(runner).not.toContain("stopPropagation");
    expect(runner).not.toContain("preventDefault()");
  });
});

describe("时钟小屋 · destroy 归零", () => {
  it("运行器每一处 addEventListener 都配了一处 removeEventListener", () => {
    const added = [...runner.matchAll(/addEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    const removed = [...runner.matchAll(/removeEventListener\("([a-z]+)"/g)].map((m) => m[1]);
    expect(added.length).toBeGreaterThan(0);
    for (const name of new Set(added)) expect(removed, `${name} 监听没摘`).toContain(name);
  });

  it("辅助层的 destroy 先立旗子，再断观察者、卸监听、清 timer、收钟面", () => {
    const body = runner.slice(runner.indexOf("    destroy() {\n      dead = true;"));
    expect(body).toContain("dead = true;");
    expect(body).toContain("observer?.disconnect();");
    expect(body).toContain("while (offs.length) offs.pop()?.();");
    expect(body).toContain("timers.forEach((t) => clearTimeout(t));");
    expect(body).toContain("dial?.destroy();");
  });

  it("一关的 destroy 把两轮的壳、横幅和自己那段样式一起收走", () => {
    const body = runner.slice(runner.indexOf("    destroy() {\n      destroyed = true;"));
    expect(body).toContain("destroyed = true;");
    expect(body).toContain("dropRound();");
    expect(body).toContain("style.remove();");
    const drop = runner.slice(runner.indexOf("function dropRound()"), runner.indexOf("function noteWrong"));
    expect(drop).toContain("helper?.destroy();");
    expect(drop).toContain("quiz?.destroy?.();");
    expect(drop).toContain("banner?.remove();");
  });

  it("所有 setTimeout 都登记进 timers，没有散养的定时器", () => {
    const raw = [...runner.matchAll(/setTimeout\(/g)].length;
    expect(raw).toBe(1);
    expect(runner).toContain("timers.add(t);");
    // 没有 rAF、没有 AudioContext、没有 setInterval 要收
    expect(allSource).not.toContain("requestAnimationFrame");
    expect(allSource).not.toContain("setInterval");
    expect(allSource).not.toContain("AudioContext");
  });
});

describe("时钟小屋 · 样式只追加，clk- 前缀", () => {
  it("1.2 追加的每一条规则都是 clk- 前缀，一条都没碰别人的类名", () => {
    // 先把 @keyframes / @media 的整块挖掉，剩下的才是真正的选择器
    const flat = CLK_CSS.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "").replace(
      /@media[^{]*\{/g,
      ""
    );
    const selectors = [...flat.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim());
    expect(selectors.length).toBeGreaterThanOrEqual(8);
    for (const sel of selectors) {
      for (const one of sel.split(",")) {
        expect(one.trim(), `「${one.trim()}」不是 clk- 前缀`).toMatch(/^\.clk-/);
      }
    }
    expect(CLK_CSS).not.toMatch(/\.qz-[a-z]+\s*\{/);
    expect(CLK_CSS).not.toMatch(/\.l99-[a-z]+\s*\{/);
  });

  it("关键帧名字也带 clk 前缀，不会和别的游戏撞车", () => {
    const frames = [...CLK_CSS.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) expect(f.startsWith("clk")).toBe(true);
  });

  it("样式是新建 style 节点插进关卡容器的，没有去改别人已经挂上的样式表", () => {
    expect(runner).toContain('createElement("style")');
    expect(runner).toContain("style.textContent = CLK_CSS;");
    expect(runner).not.toContain("insertRule");
    expect(runner).not.toContain("document.head");
  });
});

describe("时钟小屋 · 手机 360px", () => {
  it("钟面直径不小于 200px，窄屏按可用宽度自适应", () => {
    expect(MIN_FACE_PX).toBeGreaterThanOrEqual(200);
    expect(CLK_CSS).toContain(`min-width: ${MIN_FACE_PX}px`);
    expect(CLK_CSS).toMatch(/\.clk-face \{[^}]*width: min\(/);
    expect(CLK_CSS).toContain("@media (max-width: 400px)");
  });

  it("自己加的按钮 ≥ 44px，题干与提示字号 ≥ 16px，可换行不溢出", () => {
    expect(CLK_CSS).toMatch(/\.clk-toggle \{[^}]*min-height: 44px/);
    expect(CLK_CSS).toMatch(/\.clk-toggle \{[^}]*min-width: 44px/);
    const sizes = [...CLK_CSS.matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(2);
    for (const px of sizes) expect(px, `有一处字号只有 ${px}px`).toBeGreaterThanOrEqual(15);
    expect(CLK_CSS).toMatch(/\.clk-hint \{[^}]*font-size: 16px/);
    expect(CLK_CSS).toContain("line-height");
  });

  it("钟面竖排在选项上面，靠 flex 分开，不会压到选项按钮", () => {
    expect(CLK_CSS).toMatch(/\.clk-dial-wrap \{[^}]*flex-direction: column/);
    expect(CLK_CSS).not.toContain("position: absolute");
    expect(CLK_CSS).toContain("touch-action: none");
  });

  it("prefers-reduced-motion 下关掉指针与提示的动效", () => {
    expect(CLK_CSS).toContain("@media (prefers-reduced-motion: reduce)");
    const reduced = CLK_CSS.slice(CLK_CSS.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".clk-hint { animation: none; }");
    expect(reduced).toContain(".clk-hand { transition: none; }");
  });
});

describe("时钟小屋 · 红线", () => {
  it("源码与攻略里一个商标都不沾", () => {
    const text = [allSource, JSON.stringify(guide), meta.title, meta.blurb].join("\n").toLowerCase();
    for (const word of TRADEMARKS) {
      expect(text.includes(word.toLowerCase()), `出现了商标「${word}」`).toBe(false);
    }
  });

  it("保持 2D、不联网、不内购、不开账号", () => {
    for (const banned of ["three.js", '"three"', "WebGLRenderer", "canvas", "fetch(", "XMLHttpRequest", "WebSocket", "广告", "内购", "登录"]) {
      expect(allSource.includes(banned), `不该出现 ${banned}`).toBe(false);
    }
  });

  it("失败只鼓励：错题回顾是复习不是惩罚，回顾轮不判失败也不扣星", () => {
    expect(REVIEW_NOTE).not.toMatch(/错了|不对|失败|笨|重罚/);
    expect(REVIEW_NOTE.length).toBeGreaterThan(8);
    expect(REVIEW_DONE.length).toBeGreaterThan(4);
    // 回顾轮的容错次数远超题量，做不完这一关也不会掉下去
    expect(runner).toContain("maxWrong: questions.length * 20 + 20");
    // 回顾轮结束报的是正题拿到的星级，一颗都没变
    expect(runner).toContain("ctx.win(stars, `${msg ?? \"\"} ${REVIEW_DONE}`.trim())");
    expect(runner).toContain("const reviewCtx: PlayCtx = { ...ctx, skipped: false, win: finish, lose: finish }");
  });

  it("meta 与实现对得上：学习类只做闯关 188 关，platform 是 both", () => {
    expect(meta.id).toBe("clock-house");
    expect(meta.category).toBe("edu");
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    // blurb 说到的内容,实现里真的都有
    for (const word of ["读钟面", "拨指针", "经过时间", "作息表"]) {
      expect(meta.blurb, `blurb 少了「${word}」`).toContain(word);
    }
    expect(meta.blurb).not.toContain("99 关");
  });

  it("平台接线：走 mountLevelGame，攻略挂上去了，跳过与直开第 N 关都由框架接管", () => {
    expect(shell).toContain("mountLevelGame(api, {");
    expect(shell).toContain("guide,");
    expect(shell).toContain("playLevel: playClockLevel");
    // 跳过标记由框架塞进 ctx.skipped，本款正题原样透传给壳（回顾轮才关掉）
    expect(runner).toContain("...ctx,");
    expect(runner).toContain("skipped: false");
  });
});
