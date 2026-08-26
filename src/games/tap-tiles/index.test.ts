/**
 * 音符下落 · 前端接线回归(规格第八、十、十四、十六节)。
 *
 * 测试环境是 node,所以用自带的 `domStub.ts`:Canvas、rAF、window 监听、
 * AudioContext 全是可观察的桩,「destroy 之后什么都不剩」这句话才有断言撑着。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { buildLevel, levelChart } from "./levels";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "./domStub";
import {
  JUDGE_LINE_RATIO,
  KEYS_DUO,
  KEYS_SOLO,
  MIN_LANE_PX,
  MIN_STAGE_PX,
  PARTICLE_LIFE_MS,
  PARTICLE_LIFE_REDUCED_MS,
  fitStageHeight,
  laneForKey,
  laneForX,
  laneWidthAt,
  meta,
  mount,
  particleCount,
  stageHeight,
  stageWidth,
} from "./index";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
  stars: number;
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [], stars: 0 };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: (n: number) => (rec.stars += n),
    getStars: () => rec.stars,
    onWin: () => undefined,
    onLose: () => undefined,
  } as unknown as GameApi;
  return rec;
}

/** 找到写着这段字的那个按钮(find 是先序,直接用会捞到外层容器) */
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function canvas(): El | null {
  return dom.root.querySelector(".tt-canvas");
}

function hudText(): string {
  return dom.root.querySelector(".tt-stats")?.innerHTML ?? "";
}

function sayText(): string {
  return dom.root.querySelector(".tt-say")?.textContent ?? "";
}

function styleText(): string {
  const style = dom.root.find((e) => e.tagName === "style");
  return style?.textContent ?? "";
}

/** 进第一关(地图上的「开始冒险 / 继续第 N 关」按钮) */
function enterFirstLevel(): void {
  const go = dom.root.findAll((e) => e.tagName === "button" && /开始冒险|继续 第/.test(e.textContent));
  go[go.length - 1]?.click();
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("模块契约", () => {
  it("meta 按规格落地,四种模式都声明了", () => {
    expect(meta.id).toBe("tap-tiles");
    expect(meta.title).toBe("音符下落");
    expect(meta.emoji).toBe("🎹");
    expect(meta.category).toBe("casual");
    expect(meta.color).toBe("#E8D9FF");
    expect(meta.levels).toBe(188);
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.blurb).toContain("空白格");
  });

  it("挂上去就有三个模式入口和一张选关地图", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(byText("无尽加速")).toBeTruthy();
    expect(byText("同谱对战")).toBeTruthy();
    expect(byText("双人同屏")).toBeTruthy();
    expect(dom.root.querySelector(".l99-map")).toBeTruthy();
    handle.destroy();
  });
});

describe("360px 下的四列", () => {
  it("四列铺满窄屏,每列都不低于 80px", () => {
    expect(laneWidthAt(360)).toBeGreaterThanOrEqual(MIN_LANE_PX);
    expect(laneWidthAt(320)).toBeGreaterThanOrEqual(MIN_LANE_PX);
    expect(stageWidth(360)).toBe(336);
    expect(stageWidth(1200)).toBe(460);
    expect(stageHeight(336)).toBeGreaterThan(336);
  });

  it("矮屏上画布会让出高度,判定线不会被挤出首屏", () => {
    const short = stageHeight(336, 640);
    expect(short).toBeLessThanOrEqual(640 - 300);
    expect(short).toBeGreaterThanOrEqual(MIN_STAGE_PX);
    expect(stageHeight(336, 1000)).toBeGreaterThan(short);
    // 再矮也留得住一块能看清的画布
    expect(stageHeight(336, 380)).toBe(MIN_STAGE_PX);
  });

  it("按舞台量出来的空位收画布:够宽敞就照旧,不够就贴着可用高度走", () => {
    const roomy = stageHeight(336);
    // 量不出来(测试桩、老浏览器)就退回原来的算法,不许因此变矮
    expect(fitStageHeight(roomy, 0)).toBe(roomy);
    expect(fitStageHeight(roomy, -50)).toBe(roomy);
    expect(fitStageHeight(roomy, Number.NaN)).toBe(roomy);
    // 空位比想要的大就还是照 roomy 来,不会撑破
    expect(fitStageHeight(roomy, 900)).toBe(roomy);
    // 空位不够就收到空位那么大
    expect(fitStageHeight(roomy, 240)).toBe(240);
    // 再挤也不会矮过下限,不然音符没有下落距离
    expect(fitStageHeight(roomy, 40)).toBe(MIN_STAGE_PX);
  });

  it("进关时把模式入口收起来,回地图又露出来", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const bar = dom.root.querySelector(".tt-bar")!;
    expect(bar.hidden).toBe(false);
    enterFirstLevel();
    expect(bar.hidden).toBe(true);
    byText("选关")?.click();
    expect(bar.hidden).toBe(false);
    handle.destroy();
  });

  it("画布真的按这个尺寸建出来,判定线在下方 80% 处", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    enterFirstLevel();
    const c = canvas();
    expect(c).toBeTruthy();
    expect(c!.width).toBe(stageWidth(360));
    expect(c!.width / 4).toBeGreaterThanOrEqual(MIN_LANE_PX);
    expect(JUDGE_LINE_RATIO).toBe(0.8);
    expect(c!.getAttribute("aria-label")).toContain("判定线");
    handle.destroy();
  });

  it("顶上的分数与连击字号 ≥ 16px", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    enterFirstLevel();
    const css = styleText();
    const stat = /\.tt-stat\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const size = /font-size:(\d+)px/.exec(stat)?.[1] ?? "0";
    expect(Number(size)).toBeGreaterThanOrEqual(16);
    expect(hudText()).toContain("分");
    expect(hudText()).toContain("连");
    handle.destroy();
  });

  it("样式里照顾了 prefers-reduced-motion", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(styleText()).toContain("prefers-reduced-motion");
    handle.destroy();
  });

  it("减少动效时粒子变少、飘得短,但命中反馈还在", () => {
    expect(particleCount(false, true)).toBeGreaterThan(particleCount(true, true));
    expect(particleCount(false, false)).toBeGreaterThan(particleCount(true, false));
    expect(particleCount(true, false)).toBeGreaterThan(0);
    expect(PARTICLE_LIFE_REDUCED_MS).toBeLessThan(PARTICLE_LIFE_MS);
  });

  it("开了减少动效,命中之后画面上的粒子确实更少", () => {
    /** 命中一下之后那一帧多画了多少笔 */
    function costAfterHit(reduced: boolean): number {
      restoreDom();
      dom = installDom(360, reduced);
      const rec = fakeApi(dom.root);
      const handle = mount(rec.api);
      enterFirstLevel();
      flushFrames(dom, 1, 0);
      const chart = levelChart(buildLevel(0));
      const c = canvas()!;
      dom.clock.ms += chart.notes[0].time;
      fireWindow(dom, "keydown", { key: KEYS_SOLO[chart.notes[0].lane] });
      const before = c.draws;
      flushFrames(dom, 1, 16);
      const cost = c.draws - before;
      handle.destroy();
      return cost;
    }
    expect(costAfterHit(true)).toBeLessThan(costAfterHit(false));
  });
});

describe("键位与点位", () => {
  it("单人四轨是 D F J K,双人是朵朵 A S、星星 K L", () => {
    expect(KEYS_SOLO).toEqual(["d", "f", "j", "k"]);
    expect(KEYS_DUO).toEqual(["a", "s", "k", "l"]);
    expect(laneForKey("D", false)).toBe(0);
    expect(laneForKey("k", false)).toBe(3);
    expect(laneForKey("a", true)).toBe(0);
    expect(laneForKey("s", true)).toBe(1);
    expect(laneForKey("k", true)).toBe(2);
    expect(laneForKey("l", true)).toBe(3);
    expect(laneForKey("z", false)).toBe(-1);
  });

  it("触屏点在哪一列就算哪一列", () => {
    expect(laneForX(10, 400)).toBe(0);
    expect(laneForX(150, 400)).toBe(1);
    expect(laneForX(399, 400)).toBe(3);
    expect(laneForX(999, 400)).toBe(3);
  });
});

describe("真的能弹", () => {
  /** 进第一关并把时钟对齐到关卡开始 */
  function startLevelOne(rec: Recorder): { start: number; notes: { lane: number; time: number }[] } {
    enterFirstLevel();
    flushFrames(dom, 1, 0);
    const chart = levelChart(buildLevel(0));
    return { start: dom.clock.ms, notes: chart.notes.map((n) => ({ lane: n.lane, time: n.time })) };
  }

  it("踩在判定线上按键就是完美,连击涨上去", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    dom.clock.ms = start + notes[0].time;
    fireWindow(dom, "keydown", { key: KEYS_SOLO[notes[0].lane] });
    expect(sayText()).toContain("完美");
    expect(hudText()).toContain("1 连");
    handle.destroy();
  });

  it("按住不放不会重复触发,松开再按才算下一次", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    const key = KEYS_SOLO[notes[0].lane];
    dom.clock.ms = start + notes[0].time;
    fireWindow(dom, "keydown", { key });
    fireWindow(dom, "keydown", { key });
    expect(hudText()).toContain("1 连");
    fireWindow(dom, "keyup", { key });
    dom.clock.ms = start + notes[1].time;
    fireWindow(dom, "keydown", { key });
    expect(hudText()).toContain("2 连");
    handle.destroy();
  });

  it("点到空白的那条轨会被温柔提醒,连击归零", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    dom.clock.ms = start + notes[0].time;
    fireWindow(dom, "keydown", { key: KEYS_SOLO[notes[0].lane] });
    fireWindow(dom, "keyup", { key: KEYS_SOLO[notes[0].lane] });
    // 第 1 关只有一条轨,别的三条都是空白
    const emptyLane = (notes[0].lane + 1) % 4;
    dom.clock.ms += 40;
    fireWindow(dom, "keydown", { key: KEYS_SOLO[emptyLane] });
    expect(sayText()).toContain("空白格");
    expect(hudText()).toContain("0 连");
    handle.destroy();
  });

  it("触屏点画布也能打,列位按 x 坐标算", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    const c = canvas()!;
    dom.clock.ms = start + notes[0].time;
    const laneW = c.width / 4;
    c.dispatch("pointerdown", { clientX: notes[0].lane * laneW + laneW / 2, clientY: 10 });
    expect(hudText()).toContain("1 连");
    handle.destroy();
  });

  it("音符溜走了只说一句「这个音符溜走啦」,不刺眼也不批评", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    dom.clock.ms = start + notes[0].time + 400;
    flushFrames(dom, 1, 0);
    expect(sayText()).toBe("这个音符溜走啦");
    expect(styleText()).not.toContain("#ff0000");
    handle.destroy();
  });

  it("命中之后画面上会多出往上飘的小音符,不是瞬间消失", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    const c = canvas()!;
    dom.clock.ms = start + notes[0].time - 200;
    flushFrames(dom, 1, 0);
    const before = c.draws;
    flushFrames(dom, 1, 0);
    const idleCost = c.draws - before;

    dom.clock.ms = start + notes[0].time;
    fireWindow(dom, "keydown", { key: KEYS_SOLO[notes[0].lane] });
    const afterHit = c.draws;
    flushFrames(dom, 1, 16);
    expect(c.draws - afterHit).toBeGreaterThan(idleCost);
    handle.destroy();
  });

  it("Esc 暂停会盖一层面板,再按一次接着弹", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    startLevelOne(rec);
    fireWindow(dom, "keydown", { key: "Escape" });
    expect(dom.root.querySelector(".tt-cover")).toBeTruthy();
    fireWindow(dom, "keydown", { key: "Escape" });
    expect(dom.root.querySelector(".tt-cover")).toBeFalsy();
    handle.destroy();
  });

  it("一路完美打完第 1 关就过关,漏光了就是温柔的鼓励面板", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const { start, notes } = startLevelOne(rec);
    for (const note of notes) {
      dom.clock.ms = start + note.time;
      fireWindow(dom, "keydown", { key: KEYS_SOLO[note.lane] });
      fireWindow(dom, "keyup", { key: KEYS_SOLO[note.lane] });
    }
    dom.clock.ms = start + notes[notes.length - 1].time + 4000;
    flushFrames(dom, 2, 0);
    const overlay = dom.root.querySelector(".l99-overlay");
    expect(overlay?.innerHTML ?? "").toContain("过关");
    expect(rec.sounds).toContain("win");
    handle.destroy();
  });

  it("一直不点就会走到鼓励面板,不会卡死", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    startLevelOne(rec);
    flushFrames(dom, 30, 900);
    const overlay = dom.root.querySelector(".l99-overlay");
    expect(overlay?.innerHTML ?? "").toContain("就差一点点");
    expect(rec.sounds).toContain("oops");
    handle.destroy();
  });
});

describe("另外三种模式", () => {
  it("无尽加速:进去就有第 1 段和速度显示", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽加速")?.click();
    expect(dom.root.querySelector(".tt-chip")?.textContent).toContain("第 1 段");
    expect(canvas()).toBeTruthy();
    handle.destroy();
  });

  it("同谱对战:挑档位再开局,顶上写着对手多少分", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("同谱对战")?.click();
    byText("地狱")?.click();
    byText("开始")?.click();
    expect(hudText()).toContain("地狱");
    expect(hudText()).toMatch(/\d+ 分/);
    handle.destroy();
  });

  it("双人分轨:键位提示写明朵朵管左两轨、星星管右两轨", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    const keys = dom.root.querySelector(".tt-keys")?.innerHTML ?? "";
    expect(keys).toContain("朵朵");
    expect(keys).toContain("星星");
    expect(keys).toContain("A S");
    expect(keys).toContain("K L");
    handle.destroy();
  });

  it("从模式里能退回选关地图", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽加速")?.click();
    expect(canvas()).toBeTruthy();
    byText("回选关")?.click();
    expect(canvas()).toBeFalsy();
    expect(dom.root.querySelector(".l99-map")).toBeTruthy();
    handle.destroy();
  });
});

describe("destroy 收得干净", () => {
  it("监听、rAF、AudioContext 一个都不剩", () => {
    const rec = fakeApi(dom.root);
    const before = windowListenerCount(dom);
    const handle = mount(rec.api);
    enterFirstLevel();
    flushFrames(dom, 1, 0);
    const chart = levelChart(buildLevel(0));
    dom.clock.ms += chart.notes[0].time;
    fireWindow(dom, "keydown", { key: KEYS_SOLO[chart.notes[0].lane] });
    expect(dom.audios.length).toBe(1);
    expect(windowListenerCount(dom)).toBeGreaterThan(before);

    handle.destroy();

    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.audios[0].closedTimes).toBe(1);
    expect(dom.audios[0].state).toBe("closed");
    expect(dom.cancelled.length).toBeGreaterThan(0);
    // rAF 归零:剩下的帧跑完之后不会再排新的
    flushFrames(dom, 5, 16);
    expect(dom.frames.length).toBe(0);
    expect(dom.root.childElementCount).toBe(0);
  });

  it("模式开着的时候 destroy 也收得干净", () => {
    const rec = fakeApi(dom.root);
    const before = windowListenerCount(dom);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    flushFrames(dom, 3, 16);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    flushFrames(dom, 5, 16);
    expect(dom.frames.length).toBe(0);
    expect(dom.root.childElementCount).toBe(0);
  });
});
