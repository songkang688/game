import { describe, expect, it } from "vitest";
import {
  GHOST_KEY,
  GHOST_MAX_EVENTS,
  GHOST_MAX_MS,
  GHOST_PREFIX,
  GhostPlayer,
  GhostRecorder,
  beatsGhost,
  clampGhost,
  emptyGhost,
  ghostDurationMs,
  ghostGap,
  ghostGapLine,
  ghostMetersAt,
  ghostStateAt,
  parseGhost,
  serializeGhost,
} from "./ghost";
import type { GhostEvent, GhostRun } from "./ghost";
import type { RunInput } from "./controls";
import { JUMP_TIME } from "./logic";

const INPUTS: RunInput[] = ["left", "right", "jump", "roll"];

/** 造一趟看着像真人打的快照。 */
function fakeRun(count: number, seed = 1): GhostRun {
  let s = seed;
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const events: GhostEvent[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    t += Math.floor(rnd() * 400) + 30;
    if (t > GHOST_MAX_MS) break;
    events.push({ t, input: INPUTS[Math.floor(rnd() * 4)] });
  }
  return { meters: 100 + count, events };
}

describe("彩虹跑跑 · 幽灵快照往返", () => {
  it("空快照压出来还是空的,读回来也是空的", () => {
    const round = parseGhost(serializeGhost(emptyGhost()));
    expect(round).toEqual({ meters: 0, events: [] });
  });

  it("一趟真快照压成一行字符串再读回来,一个事件都不差", () => {
    const run = fakeRun(400, 20260826);
    const text = serializeGhost(run);
    expect(text.startsWith(GHOST_PREFIX)).toBe(true);
    expect(text).not.toContain("\n");
    const back = parseGhost(text);
    expect(back).not.toBeNull();
    expect(back?.meters).toBe(run.meters);
    expect(back?.events).toEqual(run.events);
  });

  it("压两次得到同一行字符串:序列化是确定的", () => {
    const run = fakeRun(120, 7);
    expect(serializeGhost(run)).toBe(serializeGhost(run));
  });

  it("三分钟的快照塞进 localStorage 绰绰有余", () => {
    const run = fakeRun(GHOST_MAX_EVENTS, 99);
    const text = serializeGhost(run);
    expect(text.length).toBeLessThan(12_000);
    expect(parseGhost(text)?.events.length).toBe(clampGhost(run).events.length);
  });

  it("四种操作各自都能原样走一个来回", () => {
    for (const input of INPUTS) {
      const run: GhostRun = { meters: 5, events: [{ t: 1234, input }] };
      expect(parseGhost(serializeGhost(run))?.events).toEqual([{ t: 1234, input }]);
    }
  });

  it("认不出来的文本一律当没有幽灵,绝不因为一行坏数据把无尽模式卡住", () => {
    expect(parseGhost(null)).toBeNull();
    expect(parseGhost(undefined)).toBeNull();
    expect(parseGhost("")).toBeNull();
    expect(parseGhost("随便写的")).toBeNull();
    expect(parseGhost("rr-ghost/9/12/0J")).toBeNull();
    expect(parseGhost(`${GHOST_PREFIX}120`)).toBeNull();
    // 结尾剩一截数字 = 这行字被截断了
    expect(parseGhost(`${GHOST_PREFIX}120/0J5a`)).toBeNull();
    // 混进不认识的字符
    expect(parseGhost(`${GHOST_PREFIX}120/0J!R`)).toBeNull();
  });

  it("存档 key 和战役、无尽纪录分开,互不影响", () => {
    expect(GHOST_KEY).toContain("rainbow-run");
    expect(GHOST_KEY).toContain("ghost");
    expect(GHOST_KEY).not.toContain("campaign");
    expect(GHOST_KEY).not.toContain("endless-record");
  });
});

describe("彩虹跑跑 · 幽灵快照的两条硬上限", () => {
  it("最多录 3 分钟,超时的事件直接丢掉", () => {
    expect(GHOST_MAX_MS).toBe(180_000);
    const run: GhostRun = {
      meters: 900,
      events: [
        { t: 10, input: "jump" },
        { t: GHOST_MAX_MS, input: "left" },
        { t: GHOST_MAX_MS + 1, input: "right" },
        { t: GHOST_MAX_MS * 2, input: "roll" },
      ],
    };
    const out = clampGhost(run);
    expect(out.events.length).toBe(2);
    expect(ghostDurationMs(out)).toBe(GHOST_MAX_MS);
  });

  it("最多录 1200 个事件,狂搓方向键也撑不爆存档", () => {
    const rec = new GhostRecorder();
    for (let i = 0; i < GHOST_MAX_EVENTS * 3; i++) rec.push(i * 10, "left");
    expect(rec.count).toBe(GHOST_MAX_EVENTS);
    expect(rec.finish(500).events.length).toBe(GHOST_MAX_EVENTS);
  });

  it("录的时候就把乱序、越界、坏时间挡在外面", () => {
    const rec = new GhostRecorder();
    rec.push(100, "jump");
    rec.push(-5, "left");
    rec.push(Number.NaN, "right");
    rec.push(GHOST_MAX_MS + 1000, "roll");
    rec.push(50, "right"); // 比上一条早,按上一条的时间收下
    const run = rec.finish(42);
    expect(run.meters).toBe(42);
    expect(run.events.map((e) => e.input)).toEqual(["jump", "right"]);
    expect(run.events[1].t).toBeGreaterThanOrEqual(run.events[0].t);
  });

  it("米数是个正整数,坏数据当 0", () => {
    expect(clampGhost({ meters: 12.9, events: [] }).meters).toBe(12);
    expect(clampGhost({ meters: -3, events: [] }).meters).toBe(0);
    expect(clampGhost({ meters: Number.NaN, events: [] }).meters).toBe(0);
  });
});

describe("彩虹跑跑 · 幽灵回放", () => {
  it("按上一趟的时间线走位:换道到点了才动", () => {
    const run: GhostRun = {
      meters: 300,
      events: [
        { t: 500, input: "right" },
        { t: 1500, input: "right" },
        { t: 2500, input: "left" },
      ],
    };
    expect(ghostStateAt(run, 0).lane).toBe(1);
    expect(ghostStateAt(run, 400).lane).toBe(1);
    expect(ghostStateAt(run, 600).lane).toBe(2);
    expect(ghostStateAt(run, 1600).lane).toBe(2); // 已经在最右,撞墙不越界
    expect(ghostStateAt(run, 2600).lane).toBe(1);
  });

  it("幽灵的动作时长和真人一模一样,跳完自己回到跑", () => {
    const run: GhostRun = { meters: 100, events: [{ t: 100, input: "jump" }] };
    expect(ghostStateAt(run, 200).action).toBe("jump");
    expect(ghostStateAt(run, 100 + JUMP_TIME * 1000 - 60).action).toBe("jump");
    expect(ghostStateAt(run, 100 + JUMP_TIME * 1000 + 200).action).toBe("run");
  });

  it("回放只能往前走,倒着 seek 不会把幽灵拽回去", () => {
    const player = new GhostPlayer({ meters: 80, events: [{ t: 300, input: "right" }] });
    expect(player.seek(500).lane).toBe(2);
    expect(player.seek(100).lane).toBe(2);
  });

  it("reset 之后从头再放一遍,结果和第一遍完全一样", () => {
    const run = fakeRun(80, 31);
    const player = new GhostPlayer(run);
    const first = player.seek(20_000);
    player.reset();
    let second = player.seek(0);
    for (let t = 0; t <= 20_000; t += 200) second = player.seek(t);
    expect(second.lane).toBe(first.lane);
  });

  it("快照放完了就标记结束,画面上让幽灵淡出", () => {
    const run: GhostRun = { meters: 60, events: [{ t: 400, input: "jump" }] };
    const player = new GhostPlayer(run);
    expect(player.seek(100).finished).toBe(false);
    expect(player.seek(500).finished).toBe(true);
    expect(player.durationMs).toBe(400);
  });

  it("没有事件的快照当场就算放完,不会挂一个不动的幽灵在场上", () => {
    const player = new GhostPlayer(emptyGhost());
    expect(player.seek(0).finished).toBe(true);
    expect(player.durationMs).toBe(0);
  });

  it("名牌上的米数按上一趟的平均速度铺开,两端夹住", () => {
    const run: GhostRun = { meters: 400, events: [{ t: 2000, input: "jump" }] };
    expect(ghostMetersAt(run, 0)).toBe(0);
    expect(ghostMetersAt(run, 1000)).toBeCloseTo(200, 6);
    expect(ghostMetersAt(run, 2000)).toBeCloseTo(400, 6);
    expect(ghostMetersAt(run, 99_999)).toBeCloseTo(400, 6);
    // 一个事件都没有的快照直接报总米数,不做除零
    expect(ghostMetersAt({ meters: 77, events: [] }, 500)).toBe(77);
  });

  it("跑赢上一趟才算破纪录,没有幽灵时不算", () => {
    const ghost: GhostRun = { meters: 300, events: [] };
    expect(beatsGhost(301, ghost)).toBe(true);
    expect(beatsGhost(300, ghost)).toBe(false);
    expect(beatsGhost(299.9, ghost)).toBe(false);
    expect(beatsGhost(9999, null)).toBe(false);
  });
});

describe("彩虹跑跑 · 幽灵名牌的领先 / 落后", () => {
  it("三种状态各归各的,差多少米永远是非负数", () => {
    expect(ghostGap(320, 300)).toEqual({ state: "ahead", meters: 20 });
    expect(ghostGap(280, 300)).toEqual({ state: "behind", meters: 20 });
    expect(ghostGap(300, 300)).toEqual({ state: "even", meters: 0 });
  });

  it("差不到一米算并排,不再写「领先 0 米」", () => {
    expect(ghostGap(300.4, 300)).toEqual({ state: "even", meters: 0 });
    expect(ghostGap(299.6, 300)).toEqual({ state: "even", meters: 0 });
    expect(ghostGapLine(ghostGap(300.4, 300))).toBe("👻 并排跑着呢");
    expect(ghostGapLine(ghostGap(300.4, 300))).not.toContain("0 米");
  });

  it("坏数字当 0 处理,名牌不会印出 NaN", () => {
    expect(ghostGap(Number.NaN, 120)).toEqual({ state: "behind", meters: 120 });
    expect(ghostGap(120, Number.NaN)).toEqual({ state: "ahead", meters: 120 });
    for (const line of [
      ghostGapLine(ghostGap(Number.NaN, Number.NaN)),
      ghostGapLine(ghostGap(Number.NaN, 120)),
    ]) {
      expect(line).not.toContain("NaN");
    }
  });

  it("名牌文案和幽灵的实时米数对得上", () => {
    const run: GhostRun = { meters: 400, events: [{ t: 2000, input: "jump" }] };
    expect(ghostGapLine(ghostGap(250, ghostMetersAt(run, 1000)))).toBe("👻 领先 50 米");
    expect(ghostGapLine(ghostGap(150, ghostMetersAt(run, 1000)))).toBe("👻 落后 50 米");
  });
});
