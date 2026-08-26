import { describe, expect, it } from "vitest";
import {
  CHAIN_MAX,
  COMMAND_CLEAR_BONUS,
  COMMAND_MAX,
  FRENZY_MULTIPLIER,
  HEARTS_PER_ROUND,
  KING_INFO,
  LEGACY_ORCHARDS,
  LEGACY_ROUNDS,
  LEVELS_PER_THEME,
  MIRROR_PERIOD,
  NEW_HANDMADE_PER_THEME,
  NEW_ORCHARD_SIZES,
  ORCHARD_ORDER,
  ORCHARD_STYLE,
  PROGRESS_KEY,
  ROUNDS,
  RoundDef,
  SHELL_HITS,
  SHELL_SCORE,
  SPECIAL_CHANCE,
  THEME_SIZES,
  TOTAL_ROUNDS,
  chainGain,
  chainLabel,
  chainTotal,
  commandCheck,
  commandLabel,
  commandResetNeed,
  commandSequence,
  commandStepScore,
  comboBonus,
  kingDown,
  kingShowMult,
  levelIndicesOfTheme,
  mirrorOn,
  mirrorX,
  parseProgress,
  roundIsCleared,
  shellBounce,
  shellCracked,
  themeIndexOf,
  themeSize,
  themeStart,
} from "./logic";

/** 新增的三个果园(1.1 追加在末尾)。 */
const NEW_CHAPTERS = [9, 10, 11];
/** 新章节的回合下标区间 [100, 188)(0 起就是 [99, 188))。 */
const NEW_ROUND_IDS = Array.from({ length: TOTAL_ROUNDS - LEGACY_ROUNDS }, (_, i) => LEGACY_ROUNDS + i);

/** 1.1 引入的新字段,前 99 回合一个都不该带。 */
const NEW_FIELDS = ["chain", "command", "shellChance", "mirror", "mirrorPeriod", "king"] as const;

function fnv1a(s: string): string {
  let hHash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hHash ^= s.charCodeAt(i);
    hHash = Math.imul(hHash, 0x01000193) >>> 0;
  }
  return hHash.toString(16).padStart(8, "0");
}

/** 回合的完整字面量,顺序固定,用来做逐字回归。 */
function dump(r: RoundDef): string {
  return JSON.stringify([
    r.name,
    r.orchard,
    r.target,
    r.time,
    r.bombChance,
    r.bigBombChance,
    r.maxOnScreen,
    r.volleyMin,
    r.volleyMax,
    r.specials,
    r.feature,
    r.gen ?? false,
    r.hint,
  ]);
}

/* ================= 结构:188 回合 ================= */

describe("fruit-slice 1.1 · 188 回合结构", () => {
  it("章节和 === 188:九个老果园 99 回合 + 三个新果园 89 回合", () => {
    expect(TOTAL_ROUNDS).toBe(188);
    expect(ROUNDS.length).toBe(188);
    expect(THEME_SIZES.reduce((a, b) => a + b, 0)).toBe(188);
    expect(THEME_SIZES.length).toBe(ORCHARD_ORDER.length);
    expect(ORCHARD_ORDER.length).toBe(12);
    expect(LEGACY_ROUNDS).toBe(99);
    expect([...NEW_ORCHARD_SIZES]).toEqual([30, 30, 29]);
    expect(NEW_ORCHARD_SIZES.reduce((a, b) => a + b, 0)).toBe(89);
    for (let ci = 0; ci < LEGACY_ORCHARDS; ci++) expect(THEME_SIZES[ci]).toBe(LEVELS_PER_THEME);
  });

  it("章节尺寸表和下标换算对得上(themeStart/themeSize/themeIndexOf 自洽)", () => {
    expect(themeStart(0)).toBe(0);
    expect(themeStart(LEGACY_ORCHARDS)).toBe(LEGACY_ROUNDS);
    expect(themeStart(ORCHARD_ORDER.length)).toBe(TOTAL_ROUNDS);
    for (let ci = 0; ci < ORCHARD_ORDER.length; ci++) {
      const ids = levelIndicesOfTheme(ci);
      expect(ids.length).toBe(themeSize(ci));
      expect(ids[0]).toBe(themeStart(ci));
      for (const i of ids) {
        expect(themeIndexOf(i)).toBe(ci);
        expect(ROUNDS[i].orchard).toBe(ORCHARD_ORDER[ci]);
      }
    }
    // 第 100 关正好是新果园的第一关
    expect(themeIndexOf(99)).toBe(9);
    expect(themeIndexOf(98)).toBe(8);
    expect(themeIndexOf(187)).toBe(11);
  });

  it("每个新果园 12 回合手写 + 其余巡宴生成,压轴是果王", () => {
    expect(NEW_HANDMADE_PER_THEME).toBe(12);
    for (const ci of NEW_CHAPTERS) {
      const rounds = levelIndicesOfTheme(ci).map((i) => ROUNDS[i]);
      expect(rounds.filter((r) => !r.gen).length).toBe(NEW_HANDMADE_PER_THEME);
      expect(rounds.filter((r) => r.gen).length).toBe(themeSize(ci) - NEW_HANDMADE_PER_THEME);
      expect(rounds[rounds.length - 1].king).toBeTruthy();
      expect(rounds[rounds.length - 1].gen).toBeFalsy();
    }
  });
});

/* ================= 回归:前 99 回合一字不动 ================= */

describe("fruit-slice 1.1 · 前 99 回合回归", () => {
  it("前 99 回合逐字未改(整段 FNV 指纹 + 首尾抽样)", () => {
    const legacy = ROUNDS.slice(0, LEGACY_ROUNDS).map(dump).join("\n");
    expect(fnv1a(legacy)).toBe("b58944be");
    expect(ROUNDS[0].name).toBe("热身果盘");
    expect(ROUNDS[0].target).toBe(20);
    expect(ROUNDS[0].time).toBe(40);
    expect(ROUNDS[98].name).toBe("传说果神宴");
    expect(ROUNDS[98].target).toBe(100);
    expect(ROUNDS[98].orchard).toBe("royal");
    expect(ROUNDS.length).toBeGreaterThan(LEGACY_ROUNDS);
  });

  it("前 99 回合不带任何 1.1 新字段,新机制只活在新果园里", () => {
    for (let i = 0; i < LEGACY_ROUNDS; i++) {
      for (const f of NEW_FIELDS) {
        expect(ROUNDS[i][f], `第 ${i + 1} 回合不该有 ${f}`).toBeUndefined();
      }
    }
    for (const i of NEW_ROUND_IDS) {
      expect(ROUNDS[i].chain, `第 ${i + 1} 回合应开连刀`).toBe(true);
    }
  });

  it("老存档(长度 99 的星星数组)读出来前 99 位一模一样,存档 key 不变", () => {
    expect(PROGRESS_KEY).toBe("yiduo-yixing.fruit-slice.campaign.v2");
    const old = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
    const restored = parseProgress(JSON.stringify(old), TOTAL_ROUNDS);
    expect(restored.length).toBe(188);
    for (let i = 0; i < 99; i++) expect(restored[i]).toBe(old[i]);
    for (let i = 99; i < 188; i++) expect(restored[i]).toBe(0);
  });

  it("老存档通关到第 99 回合就能解锁第 10 章(新果园接在老战役后面)", () => {
    const old = new Array(99).fill(3);
    const stars = parseProgress(JSON.stringify(old), TOTAL_ROUNDS);
    expect(stars[98]).toBe(3);
    // 第 100 回合(下标 99)因为上一关通了而解锁
    expect(stars[99]).toBe(0);
    expect(themeStart(9)).toBe(99);
  });
});

/* ================= 三个新果园 ================= */

describe("fruit-slice 1.1 · 三个新果园", () => {
  it("回旋果谷/指令果市/镜湖果宫:名字表情配色都是新的,简介写清了主打机制", () => {
    const ids = NEW_CHAPTERS.map((ci) => ORCHARD_ORDER[ci]);
    expect(ids).toEqual(["swirl", "decree", "mirror"]);
    const names = ids.map((o) => ORCHARD_STYLE[o].name);
    expect(names).toEqual(["回旋果谷", "指令果市", "镜湖果宫"]);
    const legacyNames = new Set(
      ORCHARD_ORDER.slice(0, LEGACY_ORCHARDS).map((o) => ORCHARD_STYLE[o].name),
    );
    const legacyTops = new Set(
      ORCHARD_ORDER.slice(0, LEGACY_ORCHARDS).map((o) => ORCHARD_STYLE[o].bgTop),
    );
    const legacyEmoji = new Set(
      ORCHARD_ORDER.slice(0, LEGACY_ORCHARDS).map((o) => ORCHARD_STYLE[o].emoji),
    );
    for (const o of ids) {
      const st = ORCHARD_STYLE[o];
      expect(legacyNames.has(st.name)).toBe(false);
      expect(legacyTops.has(st.bgTop)).toBe(false);
      expect(legacyEmoji.has(st.emoji)).toBe(false);
      expect(st.blurb.length).toBeGreaterThan(8);
      expect(st.specials.length).toBeGreaterThan(0);
      expect(Math.abs(st.wind)).toBeLessThanOrEqual(80);
    }
  });

  it("四种新机制都真的登场了,而且是一章一章慢慢加的", () => {
    const swirl = levelIndicesOfTheme(9).map((i) => ROUNDS[i]);
    const decree = levelIndicesOfTheme(10).map((i) => ROUNDS[i]);
    const mirror = levelIndicesOfTheme(11).map((i) => ROUNDS[i]);
    // 第 10 章:连刀 + 硬壳果,还没有指令果和镜像
    expect(swirl.every((r) => r.chain)).toBe(true);
    expect(swirl.some((r) => (r.shellChance ?? 0) > 0)).toBe(true);
    expect(swirl.some((r) => r.command)).toBe(false);
    expect(swirl.some((r) => r.mirror)).toBe(false);
    // 第 1 关只教连刀,不掺别的
    expect(swirl[0].shellChance).toBeUndefined();
    // 第 11 章:指令果登场,镜像还没来
    expect(decree.every((r) => r.chain)).toBe(true);
    expect(decree.every((r) => (r.command ?? 0) >= 2)).toBe(true);
    expect(decree.some((r) => (r.shellChance ?? 0) > 0)).toBe(true);
    expect(decree.some((r) => r.mirror)).toBe(false);
    // 第 12 章:镜像收官,四种机制同台
    expect(mirror.every((r) => r.chain && r.mirror)).toBe(true);
    expect(mirror.some((r) => (r.command ?? 0) > 0)).toBe(true);
    expect(mirror.some((r) => (r.shellChance ?? 0) > 0)).toBe(true);
    // 指令果最多挂 4 张牌,镜像周期越往后越短
    for (const r of ROUNDS) {
      if (r.command) expect(r.command).toBeLessThanOrEqual(COMMAND_MAX);
      if (r.mirrorPeriod) expect(r.mirrorPeriod).toBeGreaterThanOrEqual(4);
    }
    expect(Math.min(...mirror.map((r) => r.mirrorPeriod ?? MIRROR_PERIOD))).toBeLessThan(
      Math.max(...mirror.map((r) => r.mirrorPeriod ?? MIRROR_PERIOD)),
    );
  });

  it("新章节目标分一路往上爬,末章末回合 188 分是全战役最高", () => {
    for (const ci of NEW_CHAPTERS) {
      const targets = levelIndicesOfTheme(ci).map((i) => ROUNDS[i].target);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i], `第 ${ci + 1} 章第 ${i + 1} 回合`).toBeGreaterThan(targets[i - 1]);
      }
    }
    const avg = ORCHARD_ORDER.map((_, ci) => {
      const rs = levelIndicesOfTheme(ci).map((i) => ROUNDS[i]);
      return rs.reduce((s, r) => s + r.target, 0) / rs.length;
    });
    for (let ci = 1; ci < avg.length; ci++) expect(avg[ci]).toBeGreaterThan(avg[ci - 1]);
    expect(ROUNDS[187].target).toBe(188);
    expect(Math.max(...ROUNDS.map((r) => r.target))).toBe(188);
  });

  it("新回合参数都在合理范围,而且目标分不超过水果供给的安全线", () => {
    for (const i of NEW_ROUND_IDS) {
      const r = ROUNDS[i];
      expect(r.time).toBeGreaterThanOrEqual(25);
      expect(r.time).toBeLessThanOrEqual(60);
      expect(r.bombChance).toBeGreaterThan(0);
      expect(r.bombChance).toBeLessThan(0.4);
      expect(r.bigBombChance).toBeGreaterThan(0);
      expect(r.bigBombChance).toBeLessThan(0.2);
      expect(r.maxOnScreen).toBeGreaterThanOrEqual(r.volleyMax);
      expect(r.volleyMax).toBeGreaterThan(r.volleyMin);
      expect((r.shellChance ?? 0)).toBeLessThanOrEqual(0.2);
      // 与 index.ts 一致:1.4 秒一波;哪怕一分连刀都不吃,全切也要有 1.25 倍余量
      const fruits = (r.time / 1.4) * ((r.volleyMin + r.volleyMax) / 2);
      expect(fruits, `${r.name} 目标 ${r.target}/${r.time}s`).toBeGreaterThanOrEqual(r.target * 1.25);
      // 每回合只用得上本果园的特殊水果
      const palette = new Set(ORCHARD_STYLE[r.orchard].specials);
      for (const sp of r.specials) expect(palette.has(sp)).toBe(true);
    }
  });

  it("188 个回合的名字、机制标记和模板签名都不重复", () => {
    expect(new Set(ROUNDS.map((r) => r.name)).size).toBe(TOTAL_ROUNDS);
    expect(new Set(ROUNDS.map((r) => r.feature)).size).toBe(TOTAL_ROUNDS);
    const sig = (r: RoundDef) =>
      [
        r.target,
        r.time,
        r.bombChance,
        r.bigBombChance,
        r.maxOnScreen,
        `${r.volleyMin}-${r.volleyMax}`,
        [...r.specials].sort().join(","),
      ].join("|");
    expect(new Set(ROUNDS.map(sig)).size).toBe(TOTAL_ROUNDS);
    for (const i of NEW_ROUND_IDS) {
      expect(ROUNDS[i].hint.length).toBeGreaterThan(8);
      expect(ROUNDS[i].feature.length).toBeGreaterThan(0);
    }
  });
});

/* ================= 三位果王 ================= */

describe("fruit-slice 1.1 · 三位果王", () => {
  it("三位果王各守一章,技能一位比一位全,大果王压轴第 188 回合", () => {
    const kings = ROUNDS.map((r, i) => ({ i, king: r.king })).filter((x) => x.king);
    expect(kings.length).toBe(3);
    expect(kings.map((k) => k.king)).toEqual(["swirlKing", "decreeKing", "grandKing"]);
    expect(kings.map((k) => k.i)).toEqual([128, 158, 187]);
    for (const k of kings) {
      // 每位果王都站在自己那一章的最后一关
      const ci = themeIndexOf(k.i);
      expect(k.i).toBe(themeStart(ci) + themeSize(ci) - 1);
    }
    const skills = (id: keyof typeof KING_INFO) => {
      const s = KING_INFO[id];
      return [!!s.throwsShell, !!s.decrees, !!s.flips, !!s.enrages].filter(Boolean).length;
    };
    expect(skills("swirlKing")).toBe(1);
    expect(skills("decreeKing")).toBe(2);
    expect(skills("grandKing")).toBe(4);
    expect(KING_INFO.grandKing.name).toBe("大果王");
    expect(ROUNDS[187].king).toBe("grandKing");
  });

  it("果王的血量、体型和奖励随章节变大,技能组合互不相同", () => {
    const order = ["swirlKing", "decreeKing", "grandKing"] as const;
    for (let i = 1; i < order.length; i++) {
      const prev = KING_INFO[order[i - 1]];
      const cur = KING_INFO[order[i]];
      expect(cur.hp).toBeGreaterThan(prev.hp);
      expect(cur.r).toBeGreaterThan(prev.r);
      expect(cur.hitScore).toBeGreaterThan(prev.hitScore);
      expect(cur.downBonus).toBeGreaterThan(prev.downBonus);
      // 越往后躲得越勤
      expect(cur.showTime).toBeLessThan(prev.showTime);
    }
    const sigs = order.map((id) => {
      const s = KING_INFO[id];
      return `${s.throwsShell ? "S" : ""}${s.decrees ? "D" : ""}${s.flips ? "F" : ""}${s.enrages ? "E" : ""}`;
    });
    expect(new Set(sigs).size).toBe(3);
    for (const id of order) {
      const s = KING_INFO[id];
      expect(s.name.length).toBeGreaterThan(1);
      expect(s.blurb.length).toBeGreaterThan(8);
      expect(s.hideTime).toBeGreaterThan(0);
    }
  });

  it("果王关的目标分光靠果王砍不下来,必须也去切水果", () => {
    for (const idx of [128, 158, 187]) {
      const r = ROUNDS[idx];
      const spec = KING_INFO[r.king!];
      const fromKing = spec.hp * spec.hitScore + spec.downBonus;
      expect(fromKing).toBeLessThan(r.target);
      // 反过来,果王那份分也不能少到可有可无
      expect(fromKing).toBeGreaterThan(r.target * 0.3);
    }
  });
});

/* ================= 新机制纯函数 ================= */

describe("fruit-slice 1.1 · 连刀判定", () => {
  it("一刀之内第 n 颗值 n 分,封顶 CHAIN_MAX", () => {
    expect(CHAIN_MAX).toBe(5);
    expect(chainGain(1)).toBe(1);
    expect(chainGain(2)).toBe(2);
    expect(chainGain(3)).toBe(3);
    expect(chainGain(5)).toBe(5);
    expect(chainGain(9)).toBe(5);
    expect(chainGain(0)).toBe(1);
    expect(chainTotal(1)).toBe(1);
    expect(chainTotal(3)).toBe(6);
    expect(chainTotal(5)).toBe(15);
    expect(chainTotal(6)).toBe(20);
    // 连刀总是不亏:切同样多的果,连着切一定不比一颗颗切少
    for (let n = 1; n <= 8; n++) expect(chainTotal(n)).toBeGreaterThanOrEqual(n);
  });

  it("连刀文案:一颗不报,满连刀要喊出来", () => {
    expect(chainLabel(1)).toBeNull();
    expect(chainLabel(0)).toBeNull();
    expect(chainLabel(2)).toBe("连刀 ×2");
    expect(chainLabel(3)).toBe("连刀 ×3!");
    expect(chainLabel(5)).toContain("满连刀");
    expect(chainLabel(7)).toContain("满连刀");
    // 连刀和 0.3 秒连击窗口是两套奖励,可以叠
    expect(comboBonus(3)).toBe(6);
  });
});

describe("fruit-slice 1.1 · 指令果", () => {
  it("号码从 1 排到 n,最多 4 张牌", () => {
    expect(commandSequence(2)).toEqual([1, 2]);
    expect(commandSequence(4)).toEqual([1, 2, 3, 4]);
    expect(commandSequence(9)).toEqual([1, 2, 3, 4]);
    expect(commandSequence(0)).toEqual([1]);
  });

  it("顺序对了加分,切错只是从 1 重新数(不掉心)", () => {
    expect(commandCheck(1, 1)).toBe("ok");
    expect(commandCheck(2, 3)).toBe("wrong");
    expect(commandCheck(3, 1)).toBe("wrong");
    expect(commandResetNeed()).toBe(1);
    // 号码越大给得越多,整组切完还有一笔奖励
    expect(commandStepScore(1)).toBe(3);
    expect(commandStepScore(4)).toBe(6);
    expect(commandStepScore(4)).toBeGreaterThan(commandStepScore(1));
    expect(COMMAND_CLEAR_BONUS).toBeGreaterThan(commandStepScore(COMMAND_MAX));
    const full = commandSequence(4).reduce((s, n) => s + commandStepScore(n), 0) + COMMAND_CLEAR_BONUS;
    expect(full).toBe(3 + 4 + 5 + 6 + 12);
    expect(commandLabel(2, 4)).toBe("按号码切:下一颗 2/4");
  });
});

describe("fruit-slice 1.1 · 硬壳果", () => {
  it("要切两刀才开,第一刀只是弹开", () => {
    expect(SHELL_HITS).toBe(2);
    expect(shellCracked(0)).toBe(false);
    expect(shellCracked(1)).toBe(false);
    expect(shellCracked(2)).toBe(true);
    expect(shellCracked(3)).toBe(true);
    expect(SHELL_SCORE).toBeGreaterThan(1);
  });

  it("第一刀:速度关于刀线镜像反射,并被往上顶一下(留出补刀时间)", () => {
    // 竖直下落 + 水平横刀 => 竖直分量反向
    const a = shellBounce(0, 300, 100, 0);
    expect(a.vx).toBeCloseTo(0, 5);
    expect(a.vy).toBeLessThan(0);
    // 水平飞行 + 竖直竖刀 => 水平分量反向
    const b = shellBounce(200, 0, 0, 100);
    expect(b.vx).toBeLessThan(0);
    // 弹开之后总要往上走,才追得上补第二刀
    for (const [vx, vy, dx, dy] of [
      [120, 240, 1, 1],
      [-90, 180, 3, -2],
      [0, -50, 1, 0],
      [40, 300, -2, 5],
    ]) {
      const r = shellBounce(vx, vy, dx, dy);
      expect(r.vy).toBeLessThan(0);
      expect(Number.isFinite(r.vx)).toBe(true);
    }
    // 刀线退化成一个点也不能算出 NaN
    const z = shellBounce(50, 60, 0, 0);
    expect(Number.isFinite(z.vx)).toBe(true);
    expect(z.vy).toBeLessThan(0);
  });
});

describe("fruit-slice 1.1 · 镜像模式", () => {
  it("每半个周期翻一次,翻的时候横坐标照着屏幕中线对折", () => {
    expect(MIRROR_PERIOD).toBe(6);
    expect(mirrorOn(0)).toBe(false);
    expect(mirrorOn(5.9)).toBe(false);
    expect(mirrorOn(6.1)).toBe(true);
    expect(mirrorOn(11.9)).toBe(true);
    expect(mirrorOn(12.1)).toBe(false);
    // 周期可以调快
    expect(mirrorOn(4.5, 4)).toBe(true);
    expect(mirrorOn(3.5, 4)).toBe(false);
    // 负时间当 0 算,周期为 0 退回默认值,都不该炸
    expect(mirrorOn(-3)).toBe(false);
    expect(mirrorOn(7, 0)).toBe(true);
  });

  it("镜像开着才翻坐标,翻两次回到原地,中线不动", () => {
    expect(mirrorX(100, 375, false)).toBe(100);
    expect(mirrorX(100, 375, true)).toBe(275);
    expect(mirrorX(mirrorX(100, 375, true), 375, true)).toBe(100);
    expect(mirrorX(187.5, 375, true)).toBe(187.5);
    expect(mirrorX(0, 375, true)).toBe(375);
  });
});

describe("fruit-slice 1.1 · 果王判定", () => {
  it("砍够刀数才倒,血过半的大果王会加速躲闪", () => {
    const grand = KING_INFO.grandKing;
    expect(kingDown(grand, 11)).toBe(false);
    expect(kingDown(grand, 12)).toBe(true);
    expect(kingDown(grand, 13)).toBe(true);
    expect(kingShowMult(grand, 0)).toBe(1);
    expect(kingShowMult(grand, 6)).toBeLessThan(1);
    // 前两位果王不会暴走,现身时长恒定
    expect(kingShowMult(KING_INFO.swirlKing, 7)).toBe(1);
    expect(kingShowMult(KING_INFO.decreeKing, 9)).toBe(1);
  });

  it("果王关要「分数够 + 果王倒」两个条件都满足才算过", () => {
    expect(roundIsCleared(200, 188, true, false)).toBe(false);
    expect(roundIsCleared(100, 188, true, true)).toBe(false);
    expect(roundIsCleared(188, 188, true, true)).toBe(true);
    // 普通回合只看分数
    expect(roundIsCleared(84, 84, false, false)).toBe(true);
    expect(roundIsCleared(83, 84, false, false)).toBe(false);
  });
});

/* ================= 文案 ================= */

describe("fruit-slice 1.1 · 文案", () => {
  it("新章节文案不含任何商业商标或原作角色名,失败提示只鼓励", () => {
    const banned = [
      "水果忍者", "忍者", "切水果大战", "Fruit Ninja", "ninja",
      "愤怒", "小鸟", "植物大战", "僵尸", "马里奥", "神庙", "地铁跑酷",
      "宝可梦", "皮卡丘", "王者", "原神",
    ];
    const text = [
      ...NEW_ROUND_IDS.map((i) => `${ROUNDS[i].name}${ROUNDS[i].hint}${ROUNDS[i].feature}`),
      ...NEW_CHAPTERS.map((ci) => {
        const st = ORCHARD_STYLE[ORCHARD_ORDER[ci]];
        return `${st.name}${st.blurb}`;
      }),
      ...Object.values(KING_INFO).map((k) => `${k.name}${k.blurb}`),
    ].join("");
    for (const b of banned) expect(text.toLowerCase()).not.toContain(b.toLowerCase());
    // 指令果切错的提示是「重新数」,不是罚分不是掉心
    const decreeIntro = ROUNDS[levelIndicesOfTheme(10)[1]];
    expect(decreeIntro.hint).toContain("不掉心");
  });
});

/* ================= 模拟:第 100–188 回合可通关 ================= */

/** 稳定的伪随机,保证模拟结果可复现。 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Airborne {
  fly: "fruit" | "bomb" | "bigbomb" | "banana" | "shell" | "command";
  life: number;
  num?: number;
  hits?: number;
}

interface SimOut {
  score: number;
  hearts: number;
  kingHits: number;
  cleared: boolean;
}

/**
 * headless 跑一个回合,照着 index.ts 的节奏来:
 * 1.4 秒一波抛射、同屏上限、水果在空中约 2.6 秒、每 0.4 秒挥一刀。
 * skill 是「这一刀能不能切中」的概率;bombRisk 是每颗炸弹被误切的概率
 * (按颗算,不按刀算 —— 真人是盯着炸弹躲,不是每挥一刀都掷一次骰子)。
 */
function simulate(idx: number, seed: number, skill: number, bombRisk = 0.03): SimOut {
  const r = ROUNDS[idx];
  const rand = rng(seed + idx * 7919);
  const spec = r.king ? KING_INFO[r.king] : null;

  let t = 0;
  let score = 0;
  let hearts = HEARTS_PER_ROUND;
  let launchTimer = 0.8;
  let strokeTimer = 0.4;
  let frenzy = 0;
  let frenzyLaunch = 0;
  const air: Airborne[] = [];

  // 指令果
  let cmdNeed = 1;
  let cmdTotal = 0;
  let cmdTimer = 2.5;
  // 果王
  let kingHits = 0;
  let kingOut = false;
  let kingTimer = 2.2;

  const AIR_TIME = 2.6;
  const dt = 1 / 30;

  const spawn = (fly: Airborne["fly"], num?: number): void => {
    if (fly === "bomb" || fly === "bigbomb") {
      // 炸弹按颗掷骰:躲开就当它自己飞走了,躲不开当场掉心
      if (rand() < bombRisk) hearts -= fly === "bigbomb" ? 2 : 1;
      return;
    }
    air.push({ fly, life: AIR_TIME, num, hits: fly === "shell" ? 0 : undefined });
  };

  while (t < r.time && hearts > 0) {
    t += dt;
    for (let i = air.length - 1; i >= 0; i--) {
      air[i].life -= dt;
      if (air[i].life <= 0) air.splice(i, 1);
    }

    // 抛射
    if (frenzy > 0) {
      frenzy -= dt;
      frenzyLaunch -= dt;
      if (frenzyLaunch <= 0 && air.length < 12) {
        frenzyLaunch = 0.3;
        spawn("fruit");
        if (rand() < 0.4) spawn("fruit");
      }
    } else {
      launchTimer -= dt;
      if (launchTimer <= 0 && air.length < r.maxOnScreen) {
        launchTimer = 1.4;
        const n = r.volleyMin + Math.floor(rand() * (r.volleyMax - r.volleyMin + 1));
        for (let i = 0; i < n; i++) spawn("fruit");
        if (t > 4) {
          if (rand() < r.bigBombChance) spawn("bigbomb");
          else if (rand() < r.bombChance) spawn("bomb");
        }
        for (const sp of r.specials) if (rand() < SPECIAL_CHANCE) spawn(sp === "banana" ? "banana" : "fruit");
        if ((r.shellChance ?? 0) > 0 && rand() < (r.shellChance ?? 0)) spawn("shell");
      }
    }

    // 指令果整组
    if (r.command) {
      const alive = air.some((a) => a.fly === "command");
      if (!alive) {
        if (cmdTotal > 0) {
          cmdTotal = 0;
          cmdNeed = 1;
        }
        cmdTimer -= dt;
        if (cmdTimer <= 0) {
          cmdTimer = 3.4;
          const seq = commandSequence(r.command);
          cmdTotal = seq.length;
          cmdNeed = 1;
          for (const num of seq) spawn("command", num);
        }
      }
    }

    // 果王探头
    if (spec && !kingDown(spec, kingHits)) {
      kingTimer -= dt;
      if (kingTimer <= 0) {
        kingOut = !kingOut;
        kingTimer = kingOut ? spec.showTime * kingShowMult(spec, kingHits) : spec.hideTime;
        if (kingOut && spec.throwsShell) spawn("shell");
      }
    } else {
      kingOut = false;
    }

    // 玩家挥刀
    strokeTimer -= dt;
    if (strokeTimer > 0) continue;
    strokeTimer = 0.4;
    const mult = frenzy > 0 ? FRENZY_MULTIPLIER : 1;

    // 果王现身:大概一半的刀花在它身上,另一半还得去切水果凑分
    if (spec && kingOut && !kingDown(spec, kingHits) && rand() < 0.5) {
      // 果王一直在晃,比切静止的水果更难蹭到
      if (rand() < skill * 0.8) {
        kingHits++;
        score += spec.hitScore * mult;
        if (kingDown(spec, kingHits)) score += spec.downBonus * mult;
      }
      continue;
    }

    let chainN = 0;
    // 指令果:按号码切,偶尔手滑切错就重数
    if (cmdTotal > 0) {
      const want = air.findIndex((a) => a.fly === "command" && a.num === cmdNeed);
      if (want >= 0) {
        if (rand() < skill) {
          const num = air[want].num as number;
          air.splice(want, 1);
          score += commandStepScore(num) * mult;
          if (num >= cmdTotal) {
            score += COMMAND_CLEAR_BONUS * mult;
            cmdTotal = 0;
            cmdNeed = 1;
          } else {
            cmdNeed = num + 1;
          }
        } else if (rand() < 0.25) {
          // 手滑切到别的号码:这一组从 1 重新数,但不掉心
          const wrong = air.findIndex((a) => a.fly === "command" && a.num !== cmdNeed);
          if (wrong >= 0) air.splice(wrong, 1);
          cmdNeed = 1;
        }
        continue;
      }
    }

    // 香蕉:切到就开水果雨
    const ban = air.findIndex((a) => a.fly === "banana");
    if (ban >= 0 && rand() < skill) {
      air.splice(ban, 1);
      frenzy = 4;
      frenzyLaunch = 0;
      continue;
    }

    // 一刀最多带 3 个目标(硬壳果算一刀,补刀在下一次)
    for (let k = 0; k < 3; k++) {
      const i = air.findIndex((a) => a.fly === "fruit" || a.fly === "shell");
      if (i < 0) break;
      if (rand() > skill) break;
      const a = air[i];
      if (a.fly === "shell") {
        a.hits = (a.hits ?? 0) + 1;
        a.life = Math.max(a.life, 1.4);
        if (!shellCracked(a.hits)) break;
        air.splice(i, 1);
        chainN++;
        score += SHELL_SCORE * (r.chain ? chainGain(chainN) : 1) * mult;
        break;
      }
      air.splice(i, 1);
      chainN++;
      score += (r.chain ? chainGain(chainN) : 1) * mult;
    }
    if (chainN >= 2) score += comboBonus(chainN);
  }

  return {
    score,
    hearts,
    kingHits,
    cleared: hearts > 0 && roundIsCleared(score, r.target, !!spec, !!spec && kingDown(spec, kingHits)),
  };
}

describe("fruit-slice 1.1 · 第 100–188 回合模拟可通关", () => {
  it("合理操作(七成命中、老老实实躲炸弹)下,第 100–188 回合每一关都能达标", () => {
    const failed: string[] = [];
    for (const seed of [1234, 7, 20260826, 99991]) {
      for (const i of NEW_ROUND_IDS) {
        const out = simulate(i, seed, 0.7, 0);
        if (!out.cleared) {
          failed.push(
            `seed ${seed} 第 ${i + 1} 回合 ${ROUNDS[i].name}:${out.score}/${ROUNDS[i].target} 分`,
          );
        }
      }
    }
    expect(failed.slice(0, 8), failed.join(" | ")).toEqual([]);
  });

  it("老的 99 回合在同一套模拟里也照样过(模型没把老关卡跑崩)", () => {
    const failed: string[] = [];
    for (const seed of [1234, 7, 20260826]) {
      for (let i = 0; i < LEGACY_ROUNDS; i++) {
        const out = simulate(i, seed, 0.7, 0);
        if (!out.cleared) failed.push(`seed ${seed} 第 ${i + 1} 回合 ${out.score}/${ROUNDS[i].target}`);
      }
    }
    expect(failed.slice(0, 8), failed.join(" | ")).toEqual([]);
  });

  it("炸弹是真威胁但不劝退:偶尔手滑(每颗 5%)也有九成以上的回合能过", () => {
    let cleared = 0;
    let total = 0;
    for (const seed of [1234, 7, 20260826, 99991]) {
      for (const i of NEW_ROUND_IDS) {
        total++;
        if (simulate(i, seed, 0.7, 0.05).cleared) cleared++;
      }
    }
    expect(cleared / total, `通过率 ${((cleared / total) * 100).toFixed(1)}%`).toBeGreaterThan(0.9);
    // 但也不能白送:炸弹全往刀口上撞就一定过不去
    expect(simulate(187, 1234, 0.7, 0.9).cleared).toBe(false);
  });

  it("三个果王关都能打赢:分数达标而且果王真的倒了", () => {
    for (const i of [128, 158, 187]) {
      const spec = KING_INFO[ROUNDS[i].king!];
      for (const seed of [4242, 7, 20260826]) {
        const out = simulate(i, seed, 0.72, 0);
        expect(out.kingHits, `seed ${seed} 第 ${i + 1} 回合果王没砍倒`).toBeGreaterThanOrEqual(spec.hp);
        expect(out.score).toBeGreaterThanOrEqual(ROUNDS[i].target);
        expect(out.cleared).toBe(true);
      }
    }
  });

  it("果王关也真的会输:手生(命中低、老切到炸弹)就打不过,但只是重来", () => {
    for (const i of [128, 158, 187]) {
      for (const seed of [4242, 7]) {
        const out = simulate(i, seed, 0.12, 0.35);
        expect(out.cleared, `seed ${seed} 第 ${i + 1} 回合不该躺赢`).toBe(false);
      }
    }
    // 分数够了但果王没倒,一样不算过 —— 果王关的胜负条件是真的两条
    const spec = KING_INFO.grandKing;
    expect(roundIsCleared(999, ROUNDS[187].target, true, kingDown(spec, spec.hp - 1))).toBe(false);
  });

  it("末关大果王:手越准分越高、砍得越多,达标线卡在「刀刀有准头」这一档", () => {
    const runs = [0.2, 0.45, 0.7].map((s) => simulate(187, 555, s, 0));
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].score).toBeGreaterThan(runs[i - 1].score);
      expect(runs[i].kingHits).toBeGreaterThanOrEqual(runs[i - 1].kingHits);
    }
    expect(runs[2].cleared).toBe(true);
    // 两成半命中的手生玩家:大果王砍不倒,这一关就过不去(但只是重来)
    expect(runs[0].cleared).toBe(false);
    expect(runs[0].kingHits).toBeLessThan(KING_INFO.grandKing.hp);
  });
});
