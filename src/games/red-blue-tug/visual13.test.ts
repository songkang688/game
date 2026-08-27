/**
 * 红蓝拔河 · 1.3 第 23 步 C 档视觉用例(只增不减)。
 *
 * 钉住「只动皮肤不动骨头」:丝带 / 后仰 / 节拍环全是既有数据的映射,
 * 判定窗口、胜负阈值、recordEndlessBest 原值回归;reduced 全停但信息不减;
 * destroy 后计时器与粒子归零。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TEAM_SCALES, TUG_ART, tugPullerSvg, tugTeamHtml } from "../../art/kit/tugTeam";
import { TUG12 } from "./tuning";
import { beatTrack, buildBeats } from "./force";
import {
  BEAT_RING_MAX,
  BEAT_RING_MIN,
  CONFETTI_COLORS,
  HEAD_CARD_FONT_MIN,
  HIT_YANK_MS,
  MISS_SWAY_MS,
  SWAY_PX,
  YANK_EXTRA_DEG,
  beatLeftPct,
  beatMode,
  beatRingR,
  confettiCount,
  createFxSpool,
  dustCount,
  finaleHtml,
  headCards,
  headRowWidthPx,
  pullFx,
  ribbonLeftPct,
  riverSvg,
  ropePathD,
  sceneSvg,
  shadowShiftPx,
  teamLeanDeg,
  trophyStack,
  winLinePcts,
} from "./theater";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("1.3 视觉 · 丝带与胜负线(用例1 / 用例8)", () => {
  it("丝带位置 = 拉力值线性映射,0 / 0.5 / 1 三点与 1.2 的 flagPct 一字不差", () => {
    expect(ribbonLeftPct(0)).toBe(50);
    expect(ribbonLeftPct(0.5)).toBe(32.5);
    expect(ribbonLeftPct(1)).toBe(15);
    expect(ribbonLeftPct(-0.5)).toBe(67.5);
    expect(ribbonLeftPct(-1)).toBe(85);
    // 越界钳住,绝不把丝带画出场外
    expect(ribbonLeftPct(2)).toBe(15);
    expect(ribbonLeftPct(Number.NaN)).toBe(50);
    // render 真用的是这条映射,数据源还是 rope / ROPE_WIN
    expect(SRC).toContain("ribbonLeftPct(ratio)");
    expect(SRC).toContain("rope / TUG12.ROPE_WIN");
  });

  it("河沟刻度带的过线展示位与胜负阈值一致,阈值常量原值", () => {
    expect(TUG12.ROPE_WIN).toBe(100);
    expect(winLinePcts()).toEqual({ red: 15, blue: 85 });
    // 场地上的两条胜负线就画在 15% / 85%(right:15% 即 85%)
    expect(SRC).toContain(`<div class="rbg-zone" style="left:15%"></div>`);
    expect(SRC).toContain(`<div class="rbg-zone" style="right:15%"></div>`);
    // 河沟是纵向蓝渐变(规格 token 8fd3ff → 5b9bff)+ 波纹
    const river = riverSvg();
    expect(river).toContain(TUG_ART.riverTop);
    expect(river).toContain(TUG_ART.riverBottom);
    expect(river).toContain(`data-part="wave"`);
  });
});

describe("1.3 视觉 · 队伍后仰三档(用例2)", () => {
  it("|拉力比| 按 1/3、2/3 分档映射 4° / 7° / 10°,正负对称", () => {
    expect(teamLeanDeg(0)).toBe(4);
    expect(teamLeanDeg(0.32)).toBe(4);
    expect(teamLeanDeg(1 / 3)).toBe(7);
    expect(teamLeanDeg(0.5)).toBe(7);
    expect(teamLeanDeg(-0.5)).toBe(7);
    expect(teamLeanDeg(2 / 3)).toBe(10);
    expect(teamLeanDeg(1)).toBe(10);
    expect(teamLeanDeg(-1)).toBe(10);
    expect(teamLeanDeg(Number.NaN)).toBe(4);
  });

  it("档位越高脚下阴影反向偏得越多(0 / 1 / 2px),render 把它写进 --rbg-shx", () => {
    expect(shadowShiftPx(0)).toBe(0);
    expect(shadowShiftPx(0.5)).toBe(1);
    expect(shadowShiftPx(1)).toBe(2);
    expect(SRC).toContain(`redSquad.style.setProperty("--rbg-shx"`);
    expect(SRC).toContain(`blueSquad.style.setProperty("--rbg-shx"`);
    // 站位角基准 −6° 叠加三档:红队负角、蓝队正角
    expect(SRC).toContain("BASE_LEAN_DEG + teamLeanDeg(ratio)");
    expect(SRC).toContain("rotate(${-lean}deg)");
    expect(SRC).toContain("rotate(${lean}deg)");
  });
});

describe("1.3 视觉 · 绳上节拍环(用例3)", () => {
  it("环从 r=26 收缩到 r=8,最小时刻正好是拍点时刻,逐拍成立", () => {
    expect(BEAT_RING_MAX).toBe(26);
    expect(BEAT_RING_MIN).toBe(8);
    const beats = buildBeats(31 + 23 * 7, 30_000, 1);
    expect(beats.length).toBeGreaterThan(4);
    for (const beatAt of beats.slice(0, 5)) {
      // 出现时刻(提前 BEAT_TRAVEL_MS)是最大环
      expect(beatRingR(beatAt, beatAt - TUG12.BEAT_TRAVEL_MS)).toBe(26);
      // 拍点时刻是最小环 = 命中窗口中心
      expect(beatRingR(beatAt, beatAt)).toBe(8);
      // 一路单调收缩
      let prev = Number.POSITIVE_INFINITY;
      for (let k = 0; k <= 4; k++) {
        const r = beatRingR(beatAt, beatAt - TUG12.BEAT_TRAVEL_MS + (k / 4) * TUG12.BEAT_TRAVEL_MS);
        expect(r).toBeLessThanOrEqual(prev);
        prev = r;
      }
    }
  });

  it("水平位置沿用 1.2 的 beatTrack 映射,判定窗口常量原值钉死", () => {
    expect(TUG12.BEAT_WINDOW_MS).toBe(120);
    expect(TUG12.BEAT_TRAVEL_MS).toBe(1700);
    expect(beatLeftPct(-1)).toBe(8);
    expect(beatLeftPct(0)).toBe(50);
    expect(beatLeftPct(1)).toBe(92);
    const beats = buildBeats(7, 20_000, 1);
    const now = beats[0] - 400;
    expect(beatLeftPct(beatTrack(beats[0], now))).toBeCloseTo(8 + ((beatTrack(beats[0], now) + 1) / 2) * 84, 9);
    // renderBeats 的数据源与热窗口逻辑一字不差
    expect(SRC).toContain("nextBeatFrom(beats, nowMs - TUG12.BEAT_TRAVEL_MS)");
    expect(SRC).toContain("Math.abs(beats[i] - nowMs) <= TUG12.BEAT_WINDOW_MS");
    expect(SRC).toContain("beatRingR(beats[i], nowMs)");
  });
});

describe("1.3 视觉 · 命中猛拉 / miss 绳晃互斥(用例4)", () => {
  it("beatHitIndex ≥0 → hit,<0 → miss,两分支互斥", () => {
    expect(pullFx(0)).toBe("hit");
    expect(pullFx(5)).toBe("hit");
    expect(pullFx(-1)).toBe("miss");
    expect(HIT_YANK_MS).toBe(160);
    expect(MISS_SWAY_MS).toBe(200);
    expect(YANK_EXTRA_DEG).toBe(6);
    expect(SWAY_PX).toBe(2);
  });

  it("index.ts 真接上了两分支:玩家踩点走 pullFx(hit),CSS 里 ±6° 回弹与 ±2px 绳晃", () => {
    expect(SRC).toContain("playPullFx(pullFx(hit))");
    expect(SRC).toContain("rbg-yank");
    expect(SRC).toContain("rbg-sway");
    // 猛拉帧 ±6°、绳晃 ±2px 落在关键帧里
    expect(SRC).toMatch(/@keyframes rbgYankR \{ 45% \{ transform: rotate\(-6deg\)/);
    expect(SRC).toMatch(/@keyframes rbgYankB \{ 45% \{ transform: rotate\(6deg\)/);
    expect(SRC).toMatch(/@keyframes rbgSway \{ 25% \{ transform: translateX\(-2px\); \} 75% \{ transform: translateX\(2px\); \}/);
  });
});

describe("1.3 视觉 · 两队小人(用例5 / 用例6 / 用例7)", () => {
  it("红队含 tugRed 不含 tugBlue,蓝队反之,场上两队都真挂上了", () => {
    const red = tugTeamHtml("red");
    const blue = tugTeamHtml("blue");
    expect(red).toContain(TUG_ART.tugRed);
    expect(red).not.toContain(TUG_ART.tugBlue);
    expect(blue).toContain(TUG_ART.tugBlue);
    expect(blue).not.toContain(TUG_ART.tugRed);
    expect(SRC).toContain(`tugTeamHtml("red")`);
    expect(SRC).toContain(`tugTeamHtml("blue")`);
  });

  it("领队与队员的表情 / 头饰差异:红头带、蓝帽子各就各位", () => {
    const redLeader = tugPullerSvg({ side: "red", role: "leader" });
    const blueLeader = tugPullerSvg({ side: "blue", role: "leader" });
    const member = tugPullerSvg({ side: "red", role: "member" });
    expect(redLeader).toContain(`data-part="headband"`);
    expect(redLeader).toContain(`data-part="teeth"`);
    expect(redLeader).toContain(`data-part="cheek"`);
    expect(blueLeader).toContain(`data-part="hat"`);
    expect(blueLeader).toContain(`data-part="teeth"`);
    expect(member).not.toContain(`data-part="headband"`);
    expect(member).not.toContain(`data-part="hat"`);
    expect(member).toContain(`data-part="mouth"`);
  });

  it("同队三人缩放 1 / 0.92 / 0.86 造纵深,间距 26px", () => {
    expect([...TEAM_SCALES]).toEqual([1, 0.92, 0.86]);
    const html = tugTeamHtml("red");
    expect(html).toContain("transform:scale(1)");
    expect(html).toContain("transform:scale(0.92)");
    expect(html).toContain("transform:scale(0.86)");
    expect(html).toContain("left:26px");
    expect(html).toContain("left:52px");
  });
});

describe("1.3 视觉 · 胜负仪式与结算回归(用例9 / 用例10)", () => {
  it("红胜蓝胜走不同分支:胜方欢呼叠罗汉+抛帽,败方坐地吐舌,互不串队", () => {
    const redWin = finaleHtml("red");
    const blueWin = finaleHtml("blue");
    // 红胜:欢呼的是红(tugRed 渐变),坐地吐舌的是蓝
    expect(redWin).toContain(`data-part="laugh"`);
    expect(redWin).toContain(`data-part="tongue"`);
    expect(redWin).toContain("rbgTugGradR");
    expect(redWin).toContain("rbgTugGradB");
    expect(redWin.indexOf("rbg-pile")).toBeLessThan(redWin.indexOf("rbg-sit"));
    expect(redWin).toContain("rbg-hat-a");
    expect(redWin).toContain("rbg-hat-b");
    // 蓝胜的文案与红胜不同,且都是笑着收场
    expect(blueWin).not.toBe(redWin);
    expect(redWin).toContain("笑成一团");
    expect(blueWin).toContain("笑成一团");
    // index.ts 真用它画收场,900ms 结算时机原样
    expect(SRC).toContain("fin.innerHTML = finaleHtml(winner);");
    expect(SRC).toContain("hooks.onEnd(winner, seconds), 900");
  });

  it("recordEndlessBest 的调用一字未动(回归)", () => {
    const hits = SRC.match(/save\.recordEndlessBest\(meta\.id, streak\)/g) ?? [];
    expect(hits.length).toBe(1);
    expect(SRC).toContain("if (streak > 0) best = save.recordEndlessBest(meta.id, streak);");
  });

  it("连胜奖杯堆叠数量 = streak 值(0 / 3 / 7 三点),排版封顶不吃三点", () => {
    expect(trophyStack(0)).toBe(0);
    expect(trophyStack(3)).toBe(3);
    expect(trophyStack(7)).toBe(7);
    expect(trophyStack(999)).toBe(12);
    expect(trophyStack(-2)).toBe(0);
    expect(SRC).toContain("trophyStack(streak)");
  });
});

describe("1.3 视觉 · 顶栏三卡(用例11)", () => {
  it("局数 / 连胜 / 纪录三卡齐全,数据源原样", () => {
    const cards = headCards(2, 5);
    expect(cards.length).toBe(3);
    expect(cards[0].value).toBe("第 3 局");
    expect(cards[1].value).toBe("2");
    expect(cards[2].value).toBe("5");
    expect(headCards(0, 0)[2].value).toBe("—");
    // 无尽顶栏真挂了三张卡
    expect(SRC).toContain(`class="rbg-card rbg-round"`);
    expect(SRC).toContain(`class="rbg-card rbg-streak"`);
    expect(SRC).toContain(`class="rbg-card rbg-best"`);
    expect(SRC).toContain("headCards(streak, best)");
  });

  it("360px 下三卡 + 回关卡按钮一行放得下,字号 ≥ 14px", () => {
    expect(HEAD_CARD_FONT_MIN).toBeGreaterThanOrEqual(14);
    // 两位数连胜、三位数局号的最宽情况:回关卡按钮实测 87px,.rbg-head gap 8px×3
    const row = headRowWidthPx(headCards(99, 42));
    expect(row + 87 + 8 * 3).toBeLessThanOrEqual(360);
    // 卡片字号写死 14px,不许再小
    const rule = /\.rbg-card \{[^}]*font-size: (\d+)px/.exec(SRC);
    expect(rule).toBeTruthy();
    expect(Number(rule![1])).toBeGreaterThanOrEqual(HEAD_CARD_FONT_MIN);
  });
});

describe("1.3 视觉 · reduced 全停但信息不减(用例12)", () => {
  it("节拍环 / 尘土 / 彩纸在 reduced 下为 0,丝带映射照常", () => {
    expect(beatMode(true)).toBe("dot");
    expect(beatMode(false)).toBe("ring");
    expect(dustCount(true)).toBe(0);
    expect(dustCount(false)).toBe(2);
    expect(confettiCount(true)).toBe(0);
    expect(confettiCount(false)).toBe(24);
    // 丝带映射根本不认识 reduced:纯拉力值单参函数
    expect(ribbonLeftPct.length).toBe(1);
  });

  it("reduced 的 CSS 与 DOM 接线:环换静态高亮点,摇摆动画全停", () => {
    // 运行时探测:reduced 时场地挂 rbg-still,环隐藏、热点静态放大
    expect(SRC).toContain(`rbg-still`);
    expect(SRC).toContain(".rbg-still .rbg-beat-ring { display: none; }");
    expect(SRC).toContain(".rbg-still .rbg-beat-hot .rbg-beat-core");
    // 媒体查询把小旗 / 小花 / 彩纸 / 尘土 / 抛帽 / 猛拉全停
    const media = SRC.slice(SRC.indexOf("@media (prefers-reduced-motion"));
    expect(media).toContain("animation: none !important");
    for (const cls of [".rbg-bunting", ".rbg-flower-a", ".rbg-confetti", ".rbg-dust", ".rbg-hat", ".rbg-squad"]) {
      expect(media, `${cls} 没停`).toContain(cls);
    }
  });
});

describe("1.3 视觉 · destroy 归零(用例13)", () => {
  it("FxSpool:清空后计时器归零、粒子清理回调全跑到", () => {
    const timers = new Map<number, () => void>();
    let seq = 0;
    const cleared: number[] = [];
    const spool = createFxSpool({
      setT: (fn) => {
        timers.set(++seq, fn);
        return seq;
      },
      clearT: (id) => {
        timers.delete(id);
        cleared.push(id);
      },
    });
    let liveEls = 0;
    expect(
      spool.spawn(24, 900, () => {
        liveEls++;
        return () => liveEls--;
      })
    ).toBe(24);
    expect(spool.live).toBe(24);
    expect(spool.pending).toBe(24);
    expect(liveEls).toBe(24);
    // 一颗自然到期:计时器自己收走自己
    const first = timers.get(1)!;
    first();
    expect(liveEls).toBe(23);
    // destroy 一把清零:剩余 23 个计时器全清、23 个粒子全摘
    spool.clear();
    expect(spool.live).toBe(0);
    expect(spool.pending).toBe(0);
    expect(liveEls).toBe(0);
    expect(cleared.length).toBe(23);
    // 再清一次什么都不做
    spool.clear();
    expect(liveEls).toBe(0);
  });

  it("index.ts 的 destroy 真调了 spool.clear(),粒子层不许残留", () => {
    expect(SRC).toContain("spool.clear();");
    const destroyAt = SRC.indexOf("spool.clear();");
    expect(destroyAt).toBeGreaterThan(0);
    // clear 排在 gone.dispose 之前,timer 与 DOM 一起走
    expect(destroyAt).toBeLessThan(SRC.indexOf("gone.dispose();", destroyAt));
    // 尘土 / 彩纸都从 spool 走账,不许有裸 setTimeout 粒子
    expect(SRC).toContain("spool.spawn(dustCount(reduced)");
    expect(SRC).toContain("spool.spawn(confettiCount(reduced)");
  });
});

describe("1.3 视觉 · 场景与麻绳(氛围层)", () => {
  it("天空 / 远山两层 / 小旗串 / 观众小花两朵齐活,麻绳两段贝塞尔 + 绳纹", () => {
    const scene = sceneSvg();
    expect((scene.match(/data-part="hill"/g) ?? []).length).toBe(2);
    expect(scene).toContain("rbg-bunting");
    expect((scene.match(/rbg-flower /g) ?? []).length).toBe(2);
    // 麻绳:sag=0 绷直、sag>0 两段 Q 在中点汇合
    expect(ropePathD(200, 8, 0)).toBe("M0 8 Q 50 8 100 8 Q 150 8 200 8");
    const sagged = ropePathD(200, 8, 9);
    expect((sagged.match(/Q /g) ?? []).length).toBe(2);
    expect(sagged).toContain("100 17");
    // 绳色走规格 token(源码里是模板插值),绳纹用 ropeLine 斜线 dasharray
    expect(SRC).toContain('stroke="${TUG_ART.ropeTan}"');
    expect(SRC).toContain('stroke="${TUG_ART.ropeLine}"');
    expect(SRC).toContain(`stroke-dasharray="2.5 7"`);
    // 彩纸配色是粉彩程序化,不是位图
    expect(CONFETTI_COLORS.length).toBeGreaterThanOrEqual(4);
  });

  it("热区红线:粒子层 pointer-events:none,双人按键与拉绳钮的尺寸规则零改动", () => {
    expect(SRC).toContain(".rbg-fx { position: absolute; inset: 0; pointer-events: none;");
    // 两侧大按钮仍按 sideLayout 布尺寸,一个像素没动
    expect(SRC).toContain("btn.style.width = `${layout.width}px`;");
    expect(SRC).toContain("btn.style.height = `${layout.height}px`;");
    // 键帽提示只是 .rbg-sub 换装,三处「星星按住 K」的文本原样
    expect((SRC.match(/星星[^\n]{0,40}按住 K/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(SRC).toContain(".rbg-pull .rbg-sub");
  });
});
