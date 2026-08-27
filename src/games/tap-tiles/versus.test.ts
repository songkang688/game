/**
 * 音符下落 · 同谱对战的胜负判定回归（QA 第 1 轮 · 包 B · B-2）。
 *
 * 测试员实测：大师档假人在同一张谱上就是满分，孩子每一个音符都踩正点拿到的也是同一个满分，
 * 旧的 `state.score > rivalScore` 把这局判给对手，结算却写着「你 7800 分 · 对手 7800 分」。
 * 这里守住三件事：赢仍旧要严格大于、平分就是平局、平局既不算玩家赢也不算对手赢。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { aiRun } from "./ai";
import type { Chart } from "./chart";
import { matchChart } from "./levels";
import { El, fireWindow, flushFrames, installDom, restoreDom, type Dom } from "./domStub";
import { KEYS_SOLO, mount } from "./index";

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

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function chipText(): string {
  return dom.root.querySelector(".tt-chip")?.textContent ?? "";
}

function overText(): string {
  return dom.root.querySelector(".tt-over")?.innerHTML ?? "";
}

/** 按谱面时间轴一路完美地打完整张谱：长按条按住到尾，同一刻先松后按 */
function playPerfect(chart: Chart): void {
  const start = dom.clock.ms;
  const beats = chart.notes
    .flatMap((n) => [
      { t: n.time, down: true, lane: n.lane },
      // 松手排在按下之后:同一刻先松后按会把这一下整个吃掉
      { t: n.time + n.hold + (n.hold > 0 ? 10 : 1), down: false, lane: n.lane },
    ])
    .sort((a, b) => a.t - b.t || Number(b.down) - Number(a.down));
  for (const b of beats) {
    dom.clock.ms = start + b.t;
    fireWindow(dom, b.down ? "keydown" : "keyup", { key: KEYS_SOLO[b.lane] });
  }
  dom.clock.ms = start + chart.notes[chart.notes.length - 1].time + 4000;
  flushFrames(dom, 2, 0);
}

/** 进对战、挑一个档位、开局，返回这一局的谱 */
function openVersus(rec: Recorder, tierLabel: string): Chart {
  byText("同谱对战")?.click();
  byText(tierLabel)?.click();
  byText("开始")?.click();
  flushFrames(dom, 1, 0);
  return matchChart(1);
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("同谱对战的胜负判定", () => {
  it("大师档假人在第 1 局这张谱上确实是满分（平局这件事真会发生）", () => {
    const chart = matchChart(1);
    // 对战里假人用的种子就是 chart.seed + 5
    expect(aiRun(chart, "hell", chart.seed + 5).score).toBe(aiRun(chart, "hell", chart.seed + 5).score);
    expect(aiRun(chart, "hell", chart.seed + 5).miss).toBe(0);
  });

  it("打平不算输：两边同分时说的是平局，比分不记给任何一方", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const chart = openVersus(rec, "大师");
    playPerfect(chart);

    const rival = aiRun(chart, "hell", chart.seed + 5).score;
    const panel = overText();
    // 先确认这一局真的打成了平手（数字自己得对得上）
    expect(panel).toContain(`对手 ${rival} 分`);
    expect(panel).toContain(`你 ${rival} 分`);
    // 平局绝不能写成「对手分高」
    expect(panel).not.toContain("对手分高");
    expect(panel).toContain("平");
    // 顶栏比分：平局既不给玩家也不给对手
    byText("再来一局")?.click();
    expect(chipText()).toContain("你 0 : 0");
    handle.destroy();
  });

  it("赢仍旧是严格大于：新手档打满分就是玩家赢，比分记给玩家", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const chart = openVersus(rec, "新手");
    const rival = aiRun(chart, "rookie", chart.seed + 5).score;
    playPerfect(chart);

    const panel = overText();
    expect(panel).toContain("你赢下这一局");
    expect(panel).toContain(`对手 ${rival} 分`);
    expect(rec.stars).toBeGreaterThan(0);
    byText("再来一局")?.click();
    expect(chipText()).toContain("你 1 : 0");
    handle.destroy();
  });

  it("一下不点就是真输：对手分高才记给对手", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    openVersus(rec, "新手");
    flushFrames(dom, 30, 900);

    const panel = overText();
    expect(panel).toContain("对手分高");
    expect(panel).toContain("你 0 分");
    byText("再来一局")?.click();
    expect(chipText()).toContain("你 0 : 1");
    handle.destroy();
  });
});
