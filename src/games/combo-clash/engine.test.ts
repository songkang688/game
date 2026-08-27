import { describe, expect, it } from "vitest";
import { characterById } from "./frames";
import {
  GUARD_CRUSH_STUN,
  MAX_NORMAL_STUN,
  THROW_RANGE,
  cancelWindowEnd,
  inputOf,
  neutralInput,
  type InputFrame
} from "./rules";
import {
  CHARGE_FRAMES,
  DEFAULT_ROUND_FRAMES,
  createMatch,
  currentMove,
  defaultConfig,
  gapBetween,
  runHeadless,
  startRound,
  stepMatch,
  type Decider,
  type MatchState
} from "./engine";

/** 摆一个两人贴脸的开局 */
function faceOff(partial: Parameters<typeof defaultConfig>[0] = {}, gap = 40): MatchState {
  const m = createMatch(defaultConfig({ roundFrames: 60 * 60, ...partial }));
  m.fighters[0].x = 300;
  m.fighters[1].x = 300 + gap;
  return m;
}

/**
 * 把防守方钉在右边墙角的开局。
 *
 * 「往后挡」在本作里就是往后走,所以在开阔场上一直挡等于一路后退,
 * 谁也够不着谁。要单独验防御高度和投技,得先把对方逼到角落里。
 */
function pinned(partial: Parameters<typeof defaultConfig>[0] = {}, gap = 40): MatchState {
  return faceOff({ stageWidth: 355, ...partial }, gap);
}

/** 一帧一帧喂输入 */
function feed(m: MatchState, a: Partial<InputFrame>, b: Partial<InputFrame> = {}, frames = 1): void {
  for (let i = 0; i < frames; i++) stepMatch(m, [inputOf(a), inputOf(b)]);
}

/** 用一个函数决定每一帧按什么 */
function drive(m: MatchState, decide: (m: MatchState) => [Partial<InputFrame>, Partial<InputFrame>], frames: number): void {
  for (let i = 0; i < frames; i++) {
    const [a, b] = decide(m);
    stepMatch(m, [inputOf(a), inputOf(b)]);
  }
}

describe("combo-clash · 三段帧在对局里真的一帧一帧走", () => {
  it("起手那几帧打不到人,进了命中帧才削元气", () => {
    const m = faceOff();
    const before = m.fighters[1].vigor;
    feed(m, { light: true });
    const mv = currentMove(m.fighters[0]);
    expect(mv?.slot).toBe("5L");
    feed(m, {}, {}, mv!.startup - 1);
    expect(m.fighters[1].vigor, "起手帧不该削元气").toBe(before);
    feed(m, {}, {}, 3);
    expect(m.fighters[1].vigor).toBeLessThan(before);
    expect(m.stats[0].hits).toBe(1);
  });

  it("打空了就是打空了:够不着的时候一帧都不掉元气", () => {
    const m = faceOff({}, 260);
    const before = m.fighters[1].vigor;
    feed(m, { light: true });
    feed(m, {}, {}, 40);
    expect(m.fighters[1].vigor).toBe(before);
    expect(m.stats[0].hits).toBe(0);
  });

  it("一招只会打中一次,不会一直判定", () => {
    const m = faceOff();
    feed(m, { heavy: true });
    feed(m, {}, {}, 40);
    expect(m.stats[0].hits).toBe(1);
  });
});

describe("combo-clash · 上中下段在对局里的四种组合", () => {
  function blockCase(slot: "5L" | "2L" | "jH", crouch: boolean): { hits: number; blocked: number } {
    const m = pinned();
    const back: Partial<InputFrame> = { right: true, down: crouch };
    if (slot === "jH") {
      let jumped = false;
      let swung = false;
      drive(
        m,
        (s) => {
          const me = s.fighters[0];
          if (!jumped) {
            jumped = true;
            return [{ up: true }, back];
          }
          // 过了最高点就下踢,落地前正好走完起手,判定框才罩得到人
          if (!swung && me.vy < 0 && me.y < 95) {
            swung = true;
            return [{ heavy: true }, back];
          }
          return [{}, back];
        },
        70
      );
    } else {
      feed(m, slot === "2L" ? { light: true, down: true } : { light: true }, back);
      feed(m, {}, back, 20);
    }
    return { hits: m.stats[0].hits, blocked: m.stats[0].blocked };
  }

  it("站着挡:中段挡得住,下段挡不住", () => {
    expect(blockCase("5L", false).blocked).toBe(1);
    expect(blockCase("2L", false).hits).toBe(1);
  });

  it("蹲着挡:下段挡得住,上段(空中招)挡不住", () => {
    expect(blockCase("2L", true).blocked).toBe(1);
    expect(blockCase("jH", true).hits).toBe(1);
  });

  it("站着挡得住空中下踢", () => {
    expect(blockCase("jH", false).blocked).toBe(1);
  });
});

describe("combo-clash · 取消窗口", () => {
  /** 空等到这一招打中人为止。顿帧不推进招式帧,所以只能盯 `hasHit` */
  function waitForHit(m: MatchState): void {
    let guard = 0;
    while (!m.fighters[0].hasHit && guard < 90) {
      feed(m, {});
      guard += 1;
    }
  }

  it("轻击命中之后按重击能取消,连段接得上", () => {
    const m = pinned();
    feed(m, { light: true });
    waitForHit(m);
    expect(m.stats[0].hits).toBe(1);
    // 命中顿帧里两边都定格,按键要按住,只点一下会被顿帧吃掉
    feed(m, { heavy: true }, {}, 8);
    expect(m.stats[0].cancels).toBe(1);
    expect(currentMove(m.fighters[0])?.slot).toBe("5H");
  });

  it("窗口过了再按就取消不了,只能等收招", () => {
    const m = pinned();
    const mv = characterById("duoduo").moves["5H"];
    feed(m, { heavy: true });
    waitForHit(m);
    let guard = 0;
    while (m.fighters[0].frame <= cancelWindowEnd(mv) && guard < 120) {
      feed(m, {});
      guard += 1;
    }
    expect(m.fighters[0].phase, "窗口关了但招还没收完").toBe("attack");
    feed(m, { burst: true }, {}, 4);
    expect(m.stats[0].cancels).toBe(0);
  });

  it("空振的时候按什么都取消不了", () => {
    const m = faceOff({}, 260);
    const mv = characterById("duoduo").moves["5L"];
    feed(m, { light: true });
    feed(m, {}, {}, mv.startup + 1);
    feed(m, { heavy: true }, {}, 3);
    expect(m.stats[0].cancels).toBe(0);
    expect(currentMove(m.fighters[0])?.slot).toBe("5L");
  });

  it("同一串连段里同一个招不能接自己", () => {
    const m = pinned();
    feed(m, { light: true });
    waitForHit(m);
    feed(m, { light: true }, {}, 8);
    expect(m.stats[0].cancels).toBe(0);
  });
});

describe("combo-clash · 超级取消", () => {
  function superCancelRun(meter: number): MatchState {
    const m = pinned({ startMeter: [meter, 0] });
    feed(m, { burst: true });
    expect(currentMove(m.fighters[0])?.slot).toBe("s1");
    let guard = 0;
    while (!m.fighters[0].hasHit && guard < 90) {
      feed(m, {});
      guard += 1;
    }
    expect(m.stats[0].hits).toBe(1);
    feed(m, { burst: true }, {}, 10);
    return m;
  }

  it("必杀命中的窗口里按必杀钮,槽够就换成超必", () => {
    const m = superCancelRun(50);
    expect(m.stats[0].superCancels).toBe(1);
    expect(currentMove(m.fighters[0])?.slot).toBe("sv1");
    expect(m.fighters[0].meter).toBeLessThan(50);
  });

  it("槽满 100 就直接上 LV2", () => {
    const m = superCancelRun(100);
    expect(currentMove(m.fighters[0])?.slot).toBe("sv2");
  });

  it("槽不够就取消不成,老老实实打完必杀", () => {
    // 起手 20 槽,必杀命中本身还会涨一点,但离 50 还差着,超级取消就是不给过
    const m = superCancelRun(20);
    expect(m.fighters[0].meter).toBeLessThan(50);
    expect(m.stats[0].superCancels).toBe(0);
    expect(m.stats[0].supersUsed).toBe(0);
  });

  it("蓄力超必:轻击按满再松手也能出", () => {
    const m = faceOff({ startMeter: [100, 0] });
    feed(m, { light: true }, {}, CHARGE_FRAMES + 6);
    feed(m, {});
    expect(m.stats[0].supersUsed).toBe(1);
  });
});

describe("combo-clash · 跳入落地接", () => {
  it("空中命中之后落地能接地面连,空振就接不了", () => {
    function run(hitInAir: boolean): MatchState {
      const m = hitInAir ? pinned() : faceOff({}, 260);
      let jumped = false;
      let swung = false;
      let follow = 0;
      drive(
        m,
        (s) => {
          const me = s.fighters[0];
          if (!jumped) {
            jumped = true;
            return [{ up: true }, {}];
          }
          if (!swung && me.vy < 0 && me.y < 95) {
            swung = true;
            return [{ heavy: true }, {}];
          }
          if (me.phase === "landing" || follow > 0) {
            follow += 1;
            return [{ light: follow <= 3 }, {}];
          }
          return [{}, {}];
        },
        80
      );
      return m;
    }
    const hit = run(true);
    expect(hit.stats[0].landCancels).toBe(1);
    expect(hit.stats[0].jumpInCombos).toBe(1);
    expect(hit.stats[0].maxCombo).toBeGreaterThanOrEqual(2);

    const whiff = run(false);
    expect(whiff.stats[0].landCancels).toBe(0);
  });
});

describe("combo-clash · 护盾与破防", () => {
  it("一直挡会掉护盾,掉光就是破防,而且愣得比任何普通硬直都久", () => {
    const m = faceOff();
    m.fighters[1].guard = 5;
    feed(m, { heavy: true }, { right: true });
    feed(m, {}, { right: true }, 16);
    expect(m.stats[0].guardCrushes).toBe(1);
    expect(m.fighters[1].phase).toBe("guardbreak");
    expect(m.fighters[1].stun).toBeGreaterThan(MAX_NORMAL_STUN);
    expect(m.fighters[1].stun).toBeLessThanOrEqual(GUARD_CRUSH_STUN);
  });

  it("挡下来不掉元气,只掉护盾", () => {
    const m = faceOff();
    const vig = m.fighters[1].vigor;
    const guard = m.fighters[1].guard;
    feed(m, { heavy: true }, { right: true });
    feed(m, {}, { right: true }, 16);
    expect(m.fighters[1].vigor).toBe(vig);
    expect(m.fighters[1].guard).toBeLessThan(guard);
  });
});

describe("combo-clash · 对拼", () => {
  it("同帧对撞、优先级差 ≤ 1 就火花互退,两个人都被弹开", () => {
    const m = faceOff({}, 44);
    let clashed = false;
    drive(
      m,
      (s) => {
        if (s.frame === 0) return [{ light: true }, { light: true }];
        if (s.events.some((e) => e.kind === "clash")) clashed = true;
        return [{}, {}];
      },
      14
    );
    expect(clashed).toBe(true);
    expect(m.fighters[0].phase === "clash" || m.fighters[1].phase === "clash").toBe(true);
    expect(m.stats[0].hits).toBe(0);
    expect(m.stats[1].hits).toBe(0);
  });
});

describe("combo-clash · 倒地、起身三选一与投无敌", () => {
  it("扫腿命中会把人放倒", () => {
    const m = faceOff();
    feed(m, { heavy: true, down: true });
    feed(m, {}, {}, 22);
    expect(m.fighters[1].phase).toBe("knockdown");
  });

  it("受身起得比原地起快", () => {
    function wakeFrames(tech: boolean): number {
      const m = faceOff();
      feed(m, { heavy: true, down: true });
      feed(m, {}, {}, 22);
      expect(m.fighters[1].phase).toBe("knockdown");
      let n = 0;
      while (m.fighters[1].phase !== "idle" && n < 200) {
        stepMatch(m, [neutralInput(), inputOf(tech ? { light: true } : {})]);
        n += 1;
      }
      return n;
    }
    expect(wakeFrames(true)).toBeLessThan(wakeFrames(false));
  });

  it("起身开头那 4 帧抓不着人", () => {
    const m = faceOff();
    feed(m, { heavy: true, down: true });
    feed(m, {}, {}, 22);
    // 等到对手刚进入起身
    let n = 0;
    while (m.fighters[1].phase !== "wakeup" && n < 60) {
      stepMatch(m, [neutralInput(), neutralInput()]);
      n += 1;
    }
    expect(m.fighters[1].phase).toBe("wakeup");
    m.fighters[0].x = m.fighters[1].x - 28;
    const throws = m.stats[0].throws;
    feed(m, { right: true, burst: true });
    feed(m, {}, {}, 3);
    expect(m.stats[0].throws).toBe(throws);
  });

  it("贴身按前 + 必杀钮就是投技,投技挡不住", () => {
    const m = pinned({}, THROW_RANGE + 28);
    feed(m, { right: true, burst: true }, { right: true });
    feed(m, { right: true }, { right: true }, 8);
    expect(m.stats[0].throws).toBe(1);
    expect(m.fighters[1].phase).toBe("knockdown");
  });
});

describe("combo-clash · 贴边与连段上限", () => {
  it("被逼到边角上就算贴边,命中会记进贴边统计", () => {
    const m = faceOff({ stageWidth: 430 });
    m.fighters[1].x = 430 - 16;
    m.fighters[0].x = 430 - 56;
    feed(m, { light: true });
    feed(m, {}, {}, 10);
    expect(m.fighters[1].cornered).toBe(true);
    expect(m.stats[0].cornerHits).toBeGreaterThanOrEqual(1);
  });

  /**
   * 摆一个「已经连了 hits 段」的局面。
   * 段数要在起手之后再塞进去 —— 新起一招本来就会清空连段计数,
   * 塞早了会被 `resetString` 抹掉。
   */
  function midCombo(hits: number): MatchState {
    const m = pinned();
    feed(m, { light: true });
    m.fighters[0].comboHits = hits;
    m.fighters[0].comboTimer = 60;
    return m;
  }

  it("连到第八段强制把对手放倒,不可能一直按住", () => {
    const m = midCombo(7);
    feed(m, {}, {}, 12);
    expect(m.stats[0].hits).toBe(1);
    expect(m.fighters[1].phase).toBe("knockdown");
  });

  it("连段越长削得越少", () => {
    const fresh = pinned();
    const vig0 = fresh.fighters[1].vigor;
    feed(fresh, { light: true });
    feed(fresh, {}, {}, 12);
    const first = vig0 - fresh.fighters[1].vigor;

    const late = midCombo(5);
    const vig2 = late.fighters[1].vigor;
    feed(late, {}, {}, 12);
    const later = vig2 - late.fighters[1].vigor;

    expect(first).toBeGreaterThan(0);
    expect(later).toBeLessThan(first);
  });
});

describe("combo-clash · 回合与整场", () => {
  it("元气见底就坐下休息,这一回合结束", () => {
    const m = faceOff();
    m.fighters[1].vigor = 3;
    feed(m, { heavy: true });
    feed(m, {}, {}, 20);
    expect(m.fighters[1].phase).toBe("rest");
    expect(m.roundWinner).toBe(0);
    expect(m.wins[0]).toBe(1);
  });

  it("三局两胜:赢两回合才算赢下整场", () => {
    const m = faceOff();
    m.wins[0] = 1;
    m.fighters[1].vigor = 3;
    feed(m, { heavy: true });
    feed(m, {}, {}, 20);
    expect(m.wins[0]).toBe(2);
    expect(m.winner).toBe(0);
  });

  it("时间耗尽比元气,一样多就是平局重来", () => {
    const m = faceOff({ roundFrames: 10 });
    feed(m, {}, {}, 12);
    expect(m.roundWinner).toBe(-1);
    expect(m.wins).toEqual([0, 0]);
    expect(m.winner).toBeNull();
  });

  it("下一回合元气会满上,能量留着", () => {
    const m = faceOff({ roundFrames: 8 });
    m.fighters[0].meter = 70;
    m.fighters[0].vigor = 12;
    feed(m, {}, {}, 10);
    startRound(m);
    expect(m.fighters[0].vigor).toBe(m.fighters[0].vigorMax);
    expect(m.fighters[0].meter).toBe(70);
  });

  it("默认一回合 60 秒,命中会攒能量", () => {
    expect(DEFAULT_ROUND_FRAMES).toBe(3600);
    const m = faceOff();
    feed(m, { light: true });
    feed(m, {}, {}, 10);
    expect(m.fighters[0].meter).toBeGreaterThan(0);
    expect(m.fighters[1].meter).toBeGreaterThan(0);
  });
});

describe("combo-clash · 减弱动效与投射物", () => {
  it("prefers-reduced-motion 下顿帧为 0", () => {
    const soft = faceOff({ reducedMotion: true });
    feed(soft, { heavy: true });
    feed(soft, {}, {}, 12);
    expect(soft.hitstop).toBe(0);
    const loud = faceOff({ reducedMotion: false });
    feed(loud, { heavy: true });
    feed(loud, {}, {}, 12);
    expect(loud.stats[0].hits).toBe(1);
  });

  it("投射型的必杀会射出一颗弹丸,飞过去才打到人", () => {
    const m = createMatch(defaultConfig({ chars: ["xingxing", "dundun"], roundFrames: 3600 }));
    m.fighters[0].x = 120;
    m.fighters[1].x = 420;
    feed(m, { burst: true });
    feed(m, {}, {}, 18);
    expect(m.projectiles.length).toBeGreaterThan(0);
    const before = m.fighters[1].vigor;
    feed(m, {}, {}, 80);
    expect(m.fighters[1].vigor).toBeLessThan(before);
  });

  it("两个人离得太近会被推开,不会叠在一起", () => {
    const m = faceOff({}, 4);
    feed(m, {}, {}, 3);
    expect(gapBetween(m)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(m.fighters[0].x - m.fighters[1].x)).toBeGreaterThanOrEqual(29);
  });

  it("无头模拟里两边都不动,时间到了也能收场,不会跑飞", () => {
    const m = createMatch(defaultConfig({ roundFrames: 60 }));
    const idle: Decider = () => neutralInput();
    const r = runHeadless(m, [idle, idle], 4000);
    expect(r.winner).not.toBeNull();
    expect(r.frames).toBeLessThan(4000);
  });
});
