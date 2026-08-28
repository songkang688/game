/**
 * 拼音小火车 · 1.3 第 24 步 C 档视觉升级用例（只增不减）。
 *
 * 钉住的全是「皮肤」：火车舞台的挂厢 / 轻晃 / 发车、三色车票助记、声调正字法、
 * 透视轨道、reduced 降级、destroy 归零、TTS 接线回归。
 * 题库、拼读规则、判定的既有用例一条没动，跑全量确认。
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAIN_COLORS, carriage, loco } from "../../art/kit/train";
import { chapterOf, type PlayCtx } from "../level99";
import { CHAPTERS, buildQuestions, buildSpell } from "./levels";
import { INITIALS, VOWELS, WHOLE_READ_SYLLABLES } from "./logic";
import { markTone } from "./pinyin";
import {
  CONFETTI_COUNT,
  DEPART_MS,
  QUIZ_SKIN_CSS,
  SCENE_CSS,
  SIGN_LINE,
  TICKET_CSS,
  backdropSvg,
  buildScene,
  centerScrollLeft,
  classifyToken,
  decorateQuizTickets,
  prefersReduced,
  trainWatchCtx,
  type SceneHandle,
} from "./scene";
import { CHIP_MIN_PX, PINYIN_FONT_MIN, TONE_CHIP_NAMES, runSpell } from "./spell";
import { StubEl, findAll, findOne, installDom } from "./domStub";

const THEME = { bg: "#fff", accent: "#c2255c" };

interface CtxProbe {
  ctx: PlayCtx;
  sfx: string[];
  wins: Array<{ stars: number; msg?: string }>;
  loses: string[];
}

function makeCtx(level = 100): CtxProbe {
  const probe: CtxProbe = { ctx: null as unknown as PlayCtx, sfx: [], wins: [], loses: [] };
  probe.ctx = {
    level,
    chapter: CHAPTERS[chapterOf(CHAPTERS, level)],
    chapterIndex: chapterOf(CHAPTERS, level),
    indexInChapter: 0,
    win: (stars, msg) => probe.wins.push({ stars, msg }),
    lose: (msg) => probe.loses.push(msg ?? ""),
    sfx: (name) => probe.sfx.push(name),
    bonusStars: () => {},
  };
  return probe;
}

/** 把标记里的标签剥掉，剩下的就是 textContent */
function textOf(svg: string): string {
  return svg.replace(/<[^>]*>/g, "");
}

/** 车厢元素身上那节 SVG（stub 环境 innerHTML 只是个字符串属性） */
function carSvg(car: StubEl): string {
  return String((car as unknown as { innerHTML?: string }).innerHTML ?? "");
}

// ---------------------------------------------------------------------------
// 一、火车舞台（buildScene / trainWatchCtx）
// ---------------------------------------------------------------------------

describe("拼音小火车 1.3 · 火车舞台", () => {
  let dom = installDom();

  beforeEach(() => {
    dom = installDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    dom.restore();
  });

  function scenery(target = 5, reduced = false): { scene: SceneHandle; root: StubEl } {
    const scene = buildScene({ target, reduced });
    return { scene, root: scene.el as unknown as StubEl };
  }

  it("车厢数 = 已答对音节数：0 / 3 / 全对三点映射（数据不变）", () => {
    const probe = makeCtx(10);
    const answers = buildQuestions(10).map((q) => q.answer);
    const { scene, root } = scenery(answers.length);
    const ctx = trainWatchCtx(probe.ctx, scene, answers);

    // 0：还没答对，一节都没挂
    expect(scene.hookedCount()).toBe(0);
    expect(findAll(root, "pyt-car")).toHaveLength(0);

    // 3：答对三题挂三节
    ctx.sfx("coin");
    ctx.sfx("coin");
    ctx.sfx("coin");
    expect(scene.hookedCount()).toBe(3);
    expect(findAll(root, "pyt-car")).toHaveLength(3);
    expect(root.getAttribute("data-hooked")).toBe("3");

    // 全对：车厢数 = 题数，透传的 sfx 一声不少
    for (let i = 3; i < answers.length; i++) ctx.sfx("coin");
    expect(scene.hookedCount()).toBe(answers.length);
    expect(probe.sfx.filter((s) => s === "coin")).toHaveLength(answers.length);
    scene.destroy();
  });

  it("车厢侧面文字 = 题库音节原文（ā á ǎ à 声调符号逐字符断言）", () => {
    const { scene, root } = scenery(6);
    const sample = ["mā", "má", "mǎ", "mà", "xióng", "lǜ"];
    for (const syll of sample) scene.hook(syll);
    const cars = findAll(root, "pyt-car");
    expect(cars).toHaveLength(sample.length);
    cars.forEach((car, i) => {
      expect(car.getAttribute("data-syll")).toBe(sample[i]);
      const chars = Array.from(textOf(carSvg(car)));
      expect(chars).toEqual(Array.from(sample[i]));
    });
    // 题库真实音节也逐字符核对（buildSpell 的 target 就是要拼出的音节原文）
    const tasks = buildSpell(101);
    const { scene: s2, root: r2 } = scenery(tasks.length);
    for (const t of tasks) s2.hook(t.target);
    findAll(r2, "pyt-car").forEach((car, i) => {
      expect(Array.from(textOf(carSvg(car)))).toEqual(Array.from(tasks[i].target));
    });
    scene.destroy();
    s2.destroy();
  });

  it("回顾加练轮多出来的答对只亮车灯，不再往目标节数外挂车厢", () => {
    const probe = makeCtx(10);
    const { scene, root } = scenery(2);
    const ctx = trainWatchCtx(probe.ctx, scene, ["mā", "mǎ"]);
    ctx.sfx("coin");
    ctx.sfx("coin");
    ctx.sfx("coin"); // 回顾轮的第三声 coin：answers 用完了
    expect(scene.hookedCount()).toBe(2);
    expect(findAll(root, "pyt-car")).toHaveLength(2);
    expect(probe.sfx.filter((s) => s === "coin")).toHaveLength(3);
    scene.destroy();
  });

  it("拼对 / 拼错走不同视觉分支，拼错车厢轻晃不脱钩 + 站牌「再听一遍」", () => {
    const probe = makeCtx(10);
    const { scene, root } = scenery(3);
    const ctx = trainWatchCtx(probe.ctx, scene, ["mā", "mǎ", "mà"]);
    ctx.sfx("coin");
    const train = findOne(root, "pyt-train") as StubEl;
    expect(train.classList.contains("pyt-train-shake")).toBe(false);

    ctx.sfx("oops");
    // 轻晃类挂上、站牌露出，车厢一节都不掉
    expect(train.classList.contains("pyt-train-shake")).toBe(true);
    const sign = findOne(root, "pyt-sign") as StubEl;
    expect(sign.textContent).toBe(SIGN_LINE);
    expect(sign.classList.contains("pyt-sign-hide")).toBe(false);
    expect(findAll(root, "pyt-car")).toHaveLength(1);
    expect(scene.hookedCount()).toBe(1);
    // 晃完类名摘掉，站牌收回
    vi.advanceTimersByTime(2000);
    expect(train.classList.contains("pyt-train-shake")).toBe(false);
    expect(sign.classList.contains("pyt-sign-hide")).toBe(true);
    // oops 原样透传，失败不批评的文案链路没被视觉层截胡
    expect(probe.sfx).toEqual(["coin", "oops"]);
    scene.destroy();
  });

  it("发车仪式只在整轮拼完（win 透传那一刻）触发，中途不触发", () => {
    const probe = makeCtx(10);
    const { scene, root } = scenery(3);
    const ctx = trainWatchCtx(probe.ctx, scene, ["mā", "mǎ", "mà"]);
    const train = findOne(root, "pyt-train") as StubEl;

    ctx.sfx("coin");
    ctx.sfx("coin");
    vi.advanceTimersByTime(300);
    expect(train.classList.contains("pyt-train-depart")).toBe(false);
    expect(findAll(root, "pyt-confetti")).toHaveLength(0);

    ctx.sfx("coin");
    ctx.win(3, "到站！");
    // 鸣笛汽笛圈两圈 + 发车 + 车尾小旗 + 彩纸 16 粒 + 站台小人挥手
    expect(train.classList.contains("pyt-train-depart")).toBe(true);
    expect(findAll(root, "pyt-ring")).toHaveLength(2);
    expect(findAll(root, "pyt-flag")).toHaveLength(1);
    expect(findAll(root, "pyt-confetti")).toHaveLength(CONFETTI_COUNT);
    expect(root.classList.contains("pyt-scene-depart")).toBe(true);
    // win 原样透传，星数一分不动
    expect(probe.wins).toEqual([{ stars: 3, msg: "到站！" }]);
    // 发车之后新列车进站：车厢清空重来
    vi.advanceTimersByTime(DEPART_MS + 200);
    expect(findAll(root, "pyt-car")).toHaveLength(0);
    expect(scene.hookedCount()).toBe(0);
    scene.destroy();
  });

  it("列车横向滚动：当前待拼（最新挂上）车厢居中可见（scroll 位置断言）", () => {
    // 纯函数：正中 = itemLeft - (视口 - 车厢)/2，夹在 [0, maxScroll]
    expect(centerScrollLeft(300, 76, 200, 400)).toBe(238);
    expect(centerScrollLeft(10, 76, 200, 400)).toBe(0);
    expect(centerScrollLeft(900, 76, 200, 400)).toBe(400);
    expect(centerScrollLeft(Number.NaN, 76, 200, 400)).toBe(0);
    expect(centerScrollLeft(300, 76, 0, 400)).toBe(0);

    // DOM 路：挂厢之后真的把算出来的 scrollLeft 写回滚动口
    const { scene, root } = scenery(3);
    const strip = findOne(root, "pyt-train-scroll") as StubEl;
    (strip as unknown as { clientWidth: number }).clientWidth = 200;
    (strip as unknown as { scrollWidth: number }).scrollWidth = 600;
    strip.rect = { left: -300, top: 0, width: 200, height: 80 };
    scene.hook("mā");
    expect((strip as unknown as { scrollLeft: number }).scrollLeft).toBe(238);
    scene.destroy();
  });

  it("reduced：滑入 / 白烟 / 发车 / 汽笛圈 / 彩纸全停，静态列车与站牌仍在", () => {
    const probe = makeCtx(10);
    const { scene, root } = scenery(2, true);
    const ctx = trainWatchCtx(probe.ctx, scene, ["mā", "mǎ"]);
    ctx.sfx("coin");
    // 瞬挂：没有滑入动画类，也不喷白烟
    const car = findOne(root, "pyt-car") as StubEl;
    expect(car.classList.contains("pyt-car-in")).toBe(false);
    expect(findAll(root, "pyt-steam")).toHaveLength(0);
    ctx.sfx("oops");
    expect((findOne(root, "pyt-sign") as StubEl).classList.contains("pyt-sign-hide")).toBe(false);
    ctx.sfx("coin");
    ctx.win(3);
    // 发车换成淡出：无汽笛圈、无彩纸、无 600ms 驶出，小人是静态挥手帧
    expect(findAll(root, "pyt-ring")).toHaveLength(0);
    expect(findAll(root, "pyt-confetti")).toHaveLength(0);
    const train = findOne(root, "pyt-train") as StubEl;
    expect(train.classList.contains("pyt-train-depart")).toBe(false);
    expect(train.classList.contains("pyt-train-fadeout")).toBe(true);
    expect(root.classList.contains("pyt-scene-depart-soft")).toBe(true);
    // CSS 侧同样钉死：reduced 媒体查询把滑入 / 白烟 / 汽笛圈 / 彩纸全关掉
    const media = SCENE_CSS.slice(SCENE_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(media).toContain(".pyt-car-in,.pyt-train-shake,.pyt-train-depart,.pyt-train-arrive{animation:none;}");
    expect(media).toContain(".pyt-steam,.pyt-ring,.pyt-confetti{animation:none;display:none;}");
    // matchMedia 量不到就当不减，绝不抛错
    expect(prefersReduced()).toBe(false);
    scene.destroy();
  });

  it("destroy 后白烟 / 发车 / 站牌计时器全部归零", () => {
    const { scene } = scenery(3);
    scene.hook("mā"); // 白烟 + 车灯 + 滑入类摘除，三只表
    scene.wobble(); // 轻晃 + 站牌，两只表
    scene.depart(); // 汽笛圈 + 彩纸 + 新列车进站，一串表
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    scene.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => scene.destroy()).not.toThrow();
  });

  it("舞台部件齐全：车头（锅炉/车灯/双轮/挂钩）、远山云朵隧道站台喇叭小人、透视轨道", () => {
    const { scene, root } = scenery(3);
    const locoArt = findOne(root, "pyt-loco-art") as StubEl;
    const locoSvg = String((locoArt as unknown as { innerHTML?: string }).innerHTML ?? "");
    for (const part of ["kit-train-boiler", "kit-train-lamp", "kit-train-wheel", "kit-train-hook", "kit-train-chimney"]) {
      expect(locoSvg).toContain(part);
    }
    // 禁抄托马斯：舞台上这颗车头也没有人脸浮雕
    expect(locoSvg).toContain('data-face="none"');
    const back = backdropSvg();
    for (const part of ["pyt-mount", "pyt-cloud", "pyt-tunnel", "pyt-platform", "pyt-horn-art", "pyt-waver", "kit-railway", "kit-rail-sleeper"]) {
      expect(back).toContain(part);
    }
    // 云两朵
    expect([...back.matchAll(/class="pyt-cloud"/g)].length).toBe(2);
    scene.destroy();
  });
});

// ---------------------------------------------------------------------------
// 二、三色助记与车票皮肤
// ---------------------------------------------------------------------------

describe("拼音小火车 1.3 · 三色助记与车票", () => {
  it("声 / 韵 / 整体认读三色分类与语法类别一致（六例覆盖三类）", () => {
    // 声母 → 橙
    expect(classifyToken("b")).toBe("initial");
    expect(classifyToken("zh")).toBe("initial");
    // 韵母（含戴调号的）→ 青绿
    expect(classifyToken("ang")).toBe("final");
    expect(classifyToken("ǎ")).toBe("final");
    // 整体认读 → 紫
    expect(classifyToken("zhi")).toBe("whole");
    expect(classifyToken("yuán")).toBe("whole");
    // 与题库数据一致：抽全表核对，分类器不许跟语法唱反调
    for (const x of INITIALS) expect(classifyToken(x)).toBe("initial");
    for (const x of WHOLE_READ_SYLLABLES) expect(classifyToken(x)).toBe("whole");
    for (const x of VOWELS.filter((v) => !WHOLE_READ_SYLLABLES.includes(v))) expect(classifyToken(x)).toBe("final");
    // 认不出的（汉字词 / 整音节）不硬贴三色
    expect(classifyToken("妈妈")).toBe("plain");
    expect(classifyToken("mǎ")).toBe("plain");
  });

  it("声调符号使用 toneRed 且不因样式裁切（overflow 断言）", () => {
    // 车厢侧面：戴调号的字母 toneRed 加粗，svg 与 text 双层 overflow visible
    const svg = carriage("mǎ", "plain");
    expect(svg).toContain(`fill="${TRAIN_COLORS.toneRed}" font-weight="900"`);
    expect(svg).toMatch(/<svg [^>]*overflow="visible"/);
    expect(svg).toMatch(/<text [^>]*overflow="visible"/);
    // 车票：声调票整票 toneRed，皮肤自己 overflow:visible，不许把 ǎ 的小勾裁掉
    expect(TICKET_CSS).toContain(`color:${TRAIN_COLORS.toneRed}`);
    expect(TICKET_CSS).toContain("overflow:visible");
    expect(QUIZ_SKIN_CSS).toContain("overflow:visible");
  });

  it("车票皮肤不缩热区不缩字号：既有下限（≥44px / ≥18px）原样生效", () => {
    // 皮肤故意不写 min-height / font-size，热区与字号由玩法既有常量守着
    expect(TICKET_CSS).not.toContain("min-height");
    expect(TICKET_CSS).not.toContain("font-size");
    expect(CHIP_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(PINYIN_FONT_MIN).toBeGreaterThanOrEqual(18);
    // 车票是锯齿 clip-path + 类别色边条 + 圆孔
    expect(TICKET_CSS).toContain("clip-path:polygon(");
    expect(TICKET_CSS).toContain(TRAIN_COLORS.initialOrange);
    expect(TICKET_CSS).toContain(TRAIN_COLORS.finalTeal);
    expect(TICKET_CSS).toContain(TRAIN_COLORS.wholePurple);
    expect(TICKET_CSS).toContain("radial-gradient(circle 3.5px");
  });

  it("quiz 车票化只加类名不动文字与事件；答对变绿的原生反馈让回去", () => {
    const choices = ["b", "ang", "zhi"].map((t) => {
      const el = new StubEl("button");
      el.textContent = t;
      return el;
    });
    const say = new StubEl("button");
    const host = {
      querySelectorAll: (sel: string) => (sel === ".qz-choice" ? choices : sel === ".qz-say" ? [say] : []),
      ownerDocument: null,
    } as unknown as HTMLElement;
    const deco = decorateQuizTickets(host);
    expect(choices[0].className).toBe("pyt-ticket pyt-tk-initial");
    expect(choices[1].className).toBe("pyt-ticket pyt-tk-final");
    expect(choices[2].className).toBe("pyt-ticket pyt-tk-whole");
    expect(say.classList.contains("pyt-horn")).toBe(true);
    // 文字与监听一根手指头都没碰
    expect(choices[0].textContent).toBe("b");
    expect(choices[0].listenerCount).toBe(0);
    expect(() => deco.dispose()).not.toThrow();
    // 环境不支持 querySelectorAll 就静默降级，不炸
    expect(() => decorateQuizTickets({} as unknown as HTMLElement).dispose()).not.toThrow();
    // 覆盖样式给 .qz-right 留了口子：反馈永远大于装饰
    expect(QUIZ_SKIN_CSS).toContain(".pyt-quizskin .qz-choice.pyt-ticket.qz-right{background-color:#E4F9E0;}");
  });
});

// ---------------------------------------------------------------------------
// 三、拼读车厢（runSpell）换肤后的行为回归
// ---------------------------------------------------------------------------

describe("拼音小火车 1.3 · 拼读车厢换肤回归", () => {
  let dom = installDom();

  beforeEach(() => {
    dom = installDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    dom.restore();
  });

  function mountSpell(level = 100) {
    const stage = new StubEl("div");
    const probe = makeCtx(level);
    const tasks = buildSpell(level);
    const handle = runSpell({ stage: stage as unknown as HTMLElement, ctx: probe.ctx, tasks, theme: THEME });
    return { stage, probe, handle, tasks };
  }

  function solve(stage: StubEl, task: { initial: string; final: string; tone: number }): void {
    const byLabel = (label: string): StubEl | null => {
      const walk = (el: StubEl): StubEl | null => {
        if (el.getAttribute("aria-label") === label) return el;
        for (const kid of el.children) {
          const hit = walk(kid);
          if (hit) return hit;
        }
        return null;
      };
      return walk(stage);
    };
    byLabel(`声母车厢 ${task.initial}`)?.fire("click");
    byLabel(`韵母车厢 ${task.final}`)?.fire("click");
    byLabel(`声调车厢 ${TONE_CHIP_NAMES[task.tone - 1]}`)?.fire("click");
    findOne(stage, "pyt-go")?.fire("click");
  }

  it("拼对一节挂一节，车厢侧面写的就是题库音节原文；拼错只晃不脱钩", () => {
    const { stage, tasks } = mountSpell(100);
    expect(findAll(stage, "pyt-car")).toHaveLength(0);

    solve(stage, tasks[0]);
    const cars = findAll(stage, "pyt-car");
    expect(cars).toHaveLength(1);
    expect(cars[0].getAttribute("data-syll")).toBe(tasks[0].target);
    expect(Array.from(textOf(carSvg(cars[0])))).toEqual(Array.from(tasks[0].target));
    vi.advanceTimersByTime(1200);

    // 拼错：挂错一节声母
    const wrongIni = tasks[1].initialChips.find((x) => x !== tasks[1].initial) as string;
    solve(stage, { initial: wrongIni, final: tasks[1].final, tone: tasks[1].tone });
    expect(findAll(stage, "pyt-car")).toHaveLength(1); // 不脱钩
    expect((findOne(stage, "pyt-train") as StubEl).classList.contains("pyt-train-shake")).toBe(true);
    expect((findOne(stage, "pyt-sign") as StubEl).classList.contains("pyt-sign-hide")).toBe(false);
  });

  it("发车仪式只在整轮拼完触发（中途不触发断言）", () => {
    const { stage, probe, tasks } = mountSpell(100);
    const train = findOne(stage, "pyt-train") as StubEl;
    for (let i = 0; i < tasks.length; i++) {
      solve(stage, tasks[i]);
      if (i < tasks.length - 1) {
        vi.advanceTimersByTime(500);
        expect(train.classList.contains("pyt-train-depart")).toBe(false);
        expect(findAll(stage, "pyt-confetti")).toHaveLength(0);
        vi.advanceTimersByTime(700);
      }
    }
    // 最后一节挂上后 420ms 鸣笛发车
    vi.advanceTimersByTime(500);
    expect(train.classList.contains("pyt-train-depart")).toBe(true);
    expect(findAll(stage, "pyt-confetti")).toHaveLength(CONFETTI_COUNT);
    vi.advanceTimersByTime(1200);
    expect(probe.wins).toHaveLength(1);
    expect(probe.wins[0].stars).toBe(3);
  });

  it("三排车厢换上三色车票：声母橙票 / 韵母青票 / 声调红票，判定零改动", () => {
    const { stage, tasks } = mountSpell(100);
    const chips = findAll(stage, "pyt-chip");
    expect(chips.length).toBeGreaterThanOrEqual(tasks[0].initialChips.length + tasks[0].finalChips.length + 4);
    for (const chip of chips) {
      expect(chip.classList.contains("pyt-ticket")).toBe(true);
      const kinds = ["pyt-tk-initial", "pyt-tk-final", "pyt-tk-tone"].filter((k) => chip.classList.contains(k));
      expect(kinds).toHaveLength(1);
    }
    // 声母行全橙、韵母行全青、声调行全红（行首标签后面才是车厢）
    const rows = findAll(stage, "pyt-row");
    const rowKinds = ["pyt-tk-initial", "pyt-tk-final", "pyt-tk-tone"];
    rows.forEach((row, i) => {
      for (const chip of row.children.slice(1)) expect(chip.classList.contains(rowKinds[i])).toBe(true);
    });
  });

  it("TTS 朗读按钮接线换肤后原样（回归断言）：广播喇叭只是件外套", () => {
    const dom2 = dom; // 无语音包环境
    void dom2;
    const { stage } = mountSpell(100);
    const say = findOne(stage, "pyt-say") as StubEl;
    // 皮肤类挂上了，接线一个字没动：无语音包时照旧藏着
    expect(say.classList.contains("pyt-horn")).toBe(true);
    expect(say.hidden).toBe(true);
    expect(say.listeners.get("click")?.length ?? 0).toBe(1);
  });

  it("destroy 之后连同舞台的白烟 / 发车计时器一并归零，DOM 摘干净", () => {
    const { stage, handle, tasks } = mountSpell(100);
    solve(stage, tasks[0]);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    handle.destroy?.();
    expect(stage.children.length).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 四、答题关接线（index.ts 源码钉死：观察层只看不改）
// ---------------------------------------------------------------------------

describe("拼音小火车 1.3 · 答题关舞台接线", () => {
  const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

  it("答题关套的是纯视觉观察层：quiz99 仍渲进宿主，判定链路原样", () => {
    expect(SRC).toContain("trainWatchCtx(innerCtx, scene");
    expect(SRC).toContain("decorateQuizTickets(host)");
    expect(SRC).toContain("scene.destroy()");
    // 宿主结构与 W5R2-FC-01 的钳位一根毫毛没动
    expect(SRC).toContain("fitQuizHost(host)");
    expect(SRC).toMatch(/stage:\s*host/);
  });

  it("挑拣车厢（pickAll）也接了舞台与车票，且只在源码层面加视觉调用", () => {
    const PK = readFileSync(new URL("./pickAll.ts", import.meta.url), "utf8");
    expect(PK).toContain("buildScene({ target: task.correct.length })");
    expect(PK).toContain("scene.wobble()");
    expect(PK).toContain("scene.depart()");
    expect(PK).toContain("scene.destroy()");
    expect(PK).toContain("pyt-ticket pyt-tk-${classifyToken(chip)}");
    // 判定函数一个字没动
    expect(PK).toContain("const verdict = judgePickAll([...picked], task.correct);");
  });
});
