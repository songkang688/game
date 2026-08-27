/**
 * 音符下落 · 前端接线回归(规格第八、十、十四、十六节)。
 *
 * 测试环境是 node,所以用自带的 `domStub.ts`:Canvas、rAF、window 监听、
 * AudioContext 全是可观察的桩,「destroy 之后什么都不剩」这句话才有断言撑着。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { buildLevel, levelChart, matchChart } from "./levels";
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
  ALIAS_DUO,
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
  it("单人四轨是 D F J K,双人是鸭梨 A S、康康 K L", () => {
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

  it("双人分轨另认鸭梨的 D 与康康的方向键,主键一个都没换", () => {
    // 主键原样保留
    expect(KEYS_DUO).toEqual(["a", "s", "k", "l"]);
    // 别名和主键落在同一条轨上
    expect(laneForKey("d", true)).toBe(laneForKey("s", true));
    expect(laneForKey("ArrowLeft", true)).toBe(laneForKey("k", true));
    expect(laneForKey("ArrowRight", true)).toBe(laneForKey("l", true));
    expect(ALIAS_DUO).toEqual({ d: 1, arrowleft: 2, arrowright: 3 });
    // 单人四轨不认这些别名,免得 D 抢走 F 的轨
    expect(laneForKey("ArrowLeft", false)).toBe(-1);
    expect(laneForKey("d", false)).toBe(0); // 单人的 D 本来就是第 1 轨
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
    byText("大师")?.click();
    byText("开始")?.click();
    expect(hudText()).toContain("大师");
    expect(hudText()).toMatch(/\d+ 分/);
    handle.destroy();
  });

  it("双人分轨:别名键和主键当一个键使,长条不会被换手按断", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    flushFrames(dom, 1, 0);
    const start = dom.clock.ms;
    // 第 1 局的谱和 matchChart(41) 一模一样,挑一个落在鸭梨第 2 轨(键 S / D)的音符
    const note = matchChart(41).notes.find((n) => n.lane === 1);
    expect(note, "谱面里得有一个落在第 2 轨的音符").toBeTruthy();

    dom.clock.ms = start + note!.time;
    fireWindow(dom, "keydown", { key: "s" });
    expect(hudText()).toContain("1 连");
    // 按着 S 再按同轨的 D:不该被当成又点了一次(不然连击立刻掉回 0)
    dom.clock.ms += 30;
    fireWindow(dom, "keydown", { key: "d" });
    expect(hudText()).toContain("1 连");
    // 抬起 D 也不算抬手,S 还按着
    fireWindow(dom, "keyup", { key: "d" });
    expect(hudText()).toContain("1 连");
    fireWindow(dom, "keyup", { key: "s" });
    handle.destroy();
  });

  it("双人分轨:开头这一串只用别名键(D 与方向键)也是一路完美", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    flushFrames(dom, 1, 0);
    const start = dom.clock.ms;
    // 鸭梨第 1 轨没有别名,仍旧按 A;别的三条轨全走别名键
    const keyFor = ["a", "d", "ArrowLeft", "ArrowRight"];
    const notes = [...matchChart(41).notes].sort((a, b) => a.time - b.time);
    // 取开头够长的一段:要把三个别名键都用上
    const need = new Set([1, 2, 3]);
    let take = 0;
    while (take < notes.length && need.size > 0) need.delete(notes[take++].lane);
    expect(need.size, "谱面开头得把三条有别名的轨都用上").toBe(0);

    // 按谱面时间轴把 keydown / keyup 排好序再依次落手:长按条要按住到尾
    const beats = notes
      .slice(0, take)
      .flatMap((n) => [
        { t: n.time, down: true, hold: n.hold, key: keyFor[n.lane] },
        { t: n.time + n.hold, down: false, hold: n.hold, key: keyFor[n.lane] },
      ])
      .sort((a, b) => a.t - b.t || Number(a.down) - Number(b.down));
    let combo = 0;
    for (const b of beats) {
      dom.clock.ms = start + b.t;
      fireWindow(dom, b.down ? "keydown" : "keyup", { key: b.key });
      if (!b.down) continue;
      // 普通块按下去就报「完美」并涨一连;长按条要按到尾端才结算
      if (b.hold > 0) {
        expect(sayText()).toContain("按住别松");
        continue;
      }
      combo += 1;
      expect(sayText(), `第 ${combo} 个音符`).toContain("完美");
      expect(hudText()).toContain(`${combo} 连`);
    }
    expect(combo).toBeGreaterThanOrEqual(take - 1);
    handle.destroy();
  });

  it("双人分轨:键位提示写明鸭梨管左两轨、康康管右两轨", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    const keys = dom.root.querySelector(".tt-keys")?.innerHTML ?? "";
    expect(keys).toContain("鸭梨");
    expect(keys).toContain("康康");
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
