/**
 * 守门：组字工坊也必须钳进舞台看得见的那一段（1.2 窗口5 · 第 3 轮 · 档A，W5R3-A-02，阻断）。
 *
 * 第 2 轮 W5R2-F-A-02 把**答题屏**接上了 `fitQuizHost`，组字工坊（偏旁推字园）漏了。
 * 真机实测（Chrome headless + CDP，命中一律 `document.elementFromPoint(键心)`）
 * 320×568 第 188 关，题面「『眼睛』的这个字：用来看东西的」：
 *   `.game-stage` 下沿 y=554，`.bc-wrap` 下沿 y=661——整整 107px 在裁切线以下；
 *   四个选项在 292px 的内容宽里折成 3+1 两行，第二行那颗「讠」的盒子是 y=551..613，
 *   键心 y=582 `elementFromPoint` 拿回的不是它；`.bc-msg`（y=623）整条也看不见。
 *   祖先链上 overflow 是 auto/scroll 的一个都没有：`.l99-stage-wrap` 与 `.game-stage`
 *   都是 hidden，手指怎么划都够不着。
 * 四选一少一个选项 = 那一步可能选不出来 = 这一关过不去，按阻断记。
 *
 * 两道保险一起上：
 *   ① 窄屏把四颗键收进一行（4×62 + 3×8 = 272 ≤ 292），常见情形根本不用滚；
 *   ② 接 `fitQuizHost` 兜底——收完还高（提示行折行、选项字多）时钳住宿主并把选项排带进眼里。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = fileURLToPath(new URL(".", import.meta.url));
const src = readFileSync(`${dir}buildChar.ts`, "utf8");
const fitSrc = readFileSync(`${dir}fit.ts`, "utf8");

function cssOf(text: string): string {
  const i = text.indexOf("const CSS = `");
  expect(i, "找不到工坊的样式块").toBeGreaterThan(-1);
  return text.slice(i, text.indexOf("`;", i));
}

const css = cssOf(src);

/** 把某条 @media 块里的规则切出来 */
function mediaBlock(text: string, query: string): string {
  const at = text.indexOf(`@media ${query}{`);
  expect(at, `找不到 @media ${query}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(at, i + 1);
    }
  }
  throw new Error(`@media ${query} 没闭合`);
}

/** 某条规则里某个属性的像素值 */
function px(block: string, selector: string, prop: string): number {
  const rule = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(block);
  expect(rule, `${selector} 在这一段里没有规则`).not.toBeNull();
  const hit = new RegExp(`(?:^|;)\\s*${prop}:\\s*([\\d.]+)px`).exec(rule![1]);
  expect(hit, `${selector} 没写 ${prop}`).not.toBeNull();
  return Number.parseFloat(hit![1]);
}

describe("识字小花园 · 组字工坊 · 320 宽一行排得下", () => {
  const narrow = mediaBlock(css, "(max-width:340px)");
  /**
   * 320 机上工坊真正能用的内容宽（真机量，不是拿屏宽算的）：
   * `window.innerWidth` 是 320，可 `.game-stage` 只有 300px 宽，
   * 壳再吃掉一层内边距，`.bc-wrap` 的盒子量到 272px；padding 收到 10px 之后内容宽 252px。
   * 这个数被写死在这里是有意的——它是「缺陷复现的那台机器」的读数，
   * 谁把 padding / 壳的边距改宽了，下面这条就该红。
   */
  const CONTENT_W_320 = 252;

  it("最宽那一档（四选一）真的塞得进 320 机的内容宽", () => {
    const minW = px(narrow, ".bc-pick", "min-width");
    const gap = px(narrow, ".bc-choices", "gap");
    const need = 4 * minW + 3 * gap;
    expect(need, `四颗键要 ${need}px，工坊只有 ${CONTENT_W_320}px`).toBeLessThanOrEqual(CONTENT_W_320);
  });

  it("padding 得收到 10px，252 这个预算才成立", () => {
    expect(px(narrow, ".bc-wrap", "padding")).toBe(10);
  });

  it("修之前那一档是塞不下的——缺陷不是我编的", () => {
    const wide = mediaBlock(css, "(max-width:420px)");
    // 420 那一档写的是 min-width:70、gap 沿用基线的 10；padding 14 时内容宽是 244px
    const need = 4 * px(wide, ".bc-pick", "min-width") + 3 * 10;
    expect(need, "真机就是在这一档折成了 3+1 两行").toBeGreaterThan(244);
  });

  it("收的只有左右和字号，热区竖直方向一动不动（下限 44px）", () => {
    expect(narrow, "窄屏档里不许动 min-height").not.toMatch(/\.bc-pick\{[^}]*min-height:/);
    expect(px(narrow, ".bc-pick", "min-width")).toBeGreaterThanOrEqual(44);
    // 基线与 420 档给的高度都还在 44 以上
    expect(px(mediaBlock(css, "(max-width:420px)"), ".bc-pick", "min-height")).toBeGreaterThanOrEqual(44);
  });

  it("窄屏档排在宽屏档后面，不然被覆盖回去等于没写", () => {
    expect(css.indexOf("@media (max-width:340px)")).toBeGreaterThan(css.indexOf("@media (max-width:420px)"));
  });
});

describe("识字小花园 · 组字工坊 · 钳位兜底（源码巡检）", () => {
  it("挂进舞台之后立刻钳一次", () => {
    const at = src.indexOf("stage.appendChild(wrap)");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 600)).toContain("fitQuizHost(wrap)");
  });

  it("换一步就重量一次——选项个数和提示行高矮都会变", () => {
    const at = src.indexOf("choicesEl.appendChild(btn)");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 260)).toContain("fit.relayout()");
  });

  it("destroy 里把 resize 那条监听拆掉", () => {
    const at = src.indexOf("destroy()");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at), "工坊 destroy 没叫 fit.dispose()，转屏监听会留在 window 上").toContain(
      "fit.dispose()"
    );
  });

  it("「带进眼里」认得工坊自己的选项排，不只认答题屏的 .qz-choices", () => {
    expect(fitSrc).toContain(".bc-choices");
    const at = fitSrc.indexOf("const CHOICE_ROWS");
    expect(at).toBeGreaterThan(-1);
    expect(fitSrc.slice(at, at + 120)).toContain(".qz-choices");
  });

  it("没有把 quiz99 的公共样式抄进本款（qz- 前缀一条都不许写）", () => {
    for (const m of css.matchAll(/(^|[\s,{])\.qz-[\w-]+/g)) {
      throw new Error(`工坊样式里不许直接写 qz- 选择器：${m[0].trim()}`);
    }
  });
});

/**
 * 描红台是本款第三条入口，也是最后一条（W5R3-A-03）。
 *
 * 真机 320×568 / 360×640 第 117 关实测：`.wgd-msg`「田字格里按顺序描一描，描错顺序也没关系～」
 * 45px 高、**0px 可见**；田字格自己也被切掉 18px（320 档 241/259、360 档 275/292）。
 * 那句话是描红的规则说明，看不见就不知道笔顺要按顺序来。
 *
 * 这一屏**不自动滚**：描红是按住画的玩法，替孩子滚屏会把手指底下的田字格挪走。
 * 只钳位 + 挂滚动条；`.wgd-pad` 写着 `touch-action:none`，落在格子上的手指不会带着壳一起滚。
 */
describe("识字小花园 · 描红台 · 钳位（源码巡检）", () => {
  const trace = readFileSync(`${dir}tracing.ts`, "utf8");

  it("挂进舞台之后立刻钳一次", () => {
    const at = trace.indexOf("stage.appendChild(wrap)");
    expect(at).toBeGreaterThan(-1);
    expect(trace.slice(at, at + 700)).toContain("fitQuizHost(wrap)");
  });

  it("换一个字 / 开一朵花都会变高，重量一次", () => {
    const at = trace.indexOf('flowersEl.className = "wgd-flowers wgd-bloom"');
    expect(at).toBeGreaterThan(-1);
    expect(trace.slice(at, at + 220)).toContain("fit.relayout()");
  });

  it("destroy 里把 resize 那条监听拆掉", () => {
    const at = trace.indexOf("destroy() {");
    expect(at).toBeGreaterThan(-1);
    expect(trace.slice(at)).toContain("fit.dispose()");
  });

  it("三条入口一条都不许漏：答题屏 / 组字工坊 / 描红台", () => {
    const runner = readFileSync(`${dir}runner.ts`, "utf8");
    for (const [name, text] of [["答题屏", runner], ["组字工坊", src], ["描红台", trace]] as const) {
      expect(text, `${name}没接钳位器`).toContain("fitQuizHost(");
    }
  });

  it("田字格自己不许被替玩家滚屏——描红是按住画的玩法", () => {
    // `showChoices` 只认 `.qz-choices` / `.bc-choices`，描红台两样都没有，所以不会自动滚
    expect(trace, "描红台不该有选项排").not.toContain("qz-choices");
    expect(trace).not.toContain("bc-choices");
  });
});
