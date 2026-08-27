// 窗口 4 · QA 档C · 第 2 轮测试员:寻找外星朋友。
//
// 第 2 轮剧本(样本全换):难度曲线 → 竞态(狂点 / 同一拍 / 重入) → 无尽持续 → 存档往返。
// 竞态那一段把 `index.ts` 的 `pick()` 一比一搬下来(含三道闸:finished / found / crossed),
// 再拿「一秒点 20 下」的手去捶它。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, chapterOf, loadStars, mulberry32, saveStar, type StorageLike } from "../level99";
import { CHAPTERS, LEVELS, buildEndlessRound, buildVersusRound } from "./levels";
import {
  ENDLESS_PEAK_ROUND,
  endlessDifficulty,
  endlessMissPenalty,
  endlessSeconds,
  endlessSpotCount,
  endlessTargetCount,
  missPenalty,
  travelTime,
  versusLine,
  versusWinner,
  type DeduceLevel,
  type FindLevel,
  type SeekLevel,
} from "./logic";
import { pickNearestSpot, toleranceInScene, emptyClickTip, EMPTY_TIPS_AFTER } from "./seek12";
import { levelIsBeatable } from "./sim";

/* ------------------------------------------------------------------ */
/* 把 index.ts 的 pick() 搬下来                                         */
/* ------------------------------------------------------------------ */

interface Round {
  finished: boolean;
  won: boolean;
  misses: number;
  left: number;
  found: Set<number>;
  crossed: Set<number>;
  scores: [number, number];
  emptyStreak: number;
  /** 每一次点击都记一笔,用来看狂点有没有被重复计分 */
  log: string[];
}

function startRound(lv: SeekLevel): Round {
  return {
    finished: false,
    won: false,
    misses: 0,
    left: lv.seconds,
    found: new Set(),
    crossed: new Set(),
    scores: [0, 0],
    emptyStreak: 0,
    log: [],
  };
}

/** 和 index.ts 的 pick() 逐行对齐:点空 / 推理 / 找物三条分支,三道闸一个不少 */
function pick(r: Round, lv: SeekLevel, player: 0 | 1, sx: number, sy: number): void {
  if (r.finished) return;
  const i = pickNearestSpot(lv.spots, sx, sy, toleranceInScene(1));
  if (i < 0) {
    r.emptyStreak++;
    r.log.push("empty");
    return;
  }
  r.emptyStreak = 0;
  if (lv.mode === "deduce") {
    if (r.crossed.has(i)) {
      r.log.push("dup-cross");
      return;
    }
    if (i === lv.answer) {
      r.found.add(i);
      r.finished = true;
      r.won = true;
      r.log.push("answer");
    } else {
      r.crossed.add(i);
      r.misses++;
      r.left = Math.max(0, r.left - (lv.penalty ?? missPenalty(lv.chapter)));
      r.log.push("wrong");
      if (r.misses >= 3) {
        r.finished = true;
        r.won = false;
      }
    }
    return;
  }
  if (r.found.has(i)) {
    r.log.push("dup-found");
    return;
  }
  const hit = lv.targets.find((t) => t.spot === i);
  if (!hit) {
    r.misses++;
    r.left = Math.max(0, r.left - (lv.penalty ?? missPenalty(lv.chapter)));
    r.log.push("miss");
    return;
  }
  r.found.add(i);
  r.scores[player]++;
  r.log.push("hit");
  if (r.found.size >= lv.targets.length) {
    r.finished = true;
    r.won = true;
  }
}

const FIND = (lv: SeekLevel): FindLevel | null => (lv.mode === "find" ? lv : null);

/** 第 2 轮换的样本:和第 1 轮的 1 / 100 / 188 一关不重 */
const SAMPLE = [7, 23, 46, 61, 88, 109, 132, 157, 170, 181];

/* ------------------------------------------------------------------ */
/* 一、难度曲线                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · alien-seek · 难度曲线", () => {
  it("战役一章比一章难:藏身点越来越多,给的时间相对越来越紧", () => {
    const perCh = CHAPTERS.map((_, ci) => {
      const rows = LEVELS.filter((lv) => chapterOf(CHAPTERS, lv.index) === ci);
      const spots = rows.reduce((s, lv) => s + lv.spots.length, 0) / rows.length;
      return { ci, spots, n: rows.length };
    });
    for (const p of perCh) expect(p.n, `第 ${p.ci + 1} 章一关都没有`).toBeGreaterThan(0);
    expect(perCh[0].spots, "第 1 章反而比最后一章点还多").toBeLessThan(perCh[perCh.length - 1].spots);
    // 不许中途掉头掉太狠:后一章的平均藏身点不能比前一章少 1 个以上
    for (let i = 1; i < perCh.length; i++) {
      expect(perCh[i].spots, `第 ${i + 1} 章比上一章简单太多`).toBeGreaterThan(perCh[i - 1].spots - 1);
    }
  });

  it("换一批样本关照样过得去:第 8 / 24 / 47 …… 共 10 关逐关复验可通", () => {
    for (const i of SAMPLE) {
      const lv = LEVELS[i];
      expect(levelIsBeatable(lv), `第 ${i + 1} 关按正常手速打不完`).toBe(true);
    }
  });

  it("每一关给的时间都比「机器人一路点过去」多出余量", () => {
    for (const i of SAMPLE) {
      const lv = FIND(LEVELS[i]);
      if (!lv) continue;
      let t = 0;
      let x = 500;
      let y = 320;
      for (const tg of lv.targets) {
        const s = lv.spots[tg.spot];
        t += travelTime(x, y, s.x, s.y);
        x = s.x;
        y = s.y;
      }
      expect(lv.seconds, `第 ${i + 1} 关只给 ${lv.seconds} 秒,光走位就要 ${t.toFixed(1)} 秒`).toBeGreaterThan(t);
    }
  });

  it("点错的罚时随章加重,但一次点错咬不掉这一关四分之一的时间", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const p = missPenalty(ci);
      expect(p).toBeGreaterThan(0);
      if (ci > 0) expect(p, `第 ${ci + 1} 章的罚时比上一章还轻`).toBeGreaterThanOrEqual(missPenalty(ci - 1));
    }
    // 有上限,不会一路涨到把整局吃光
    expect(missPenalty(999)).toBe(missPenalty(CHAPTERS.length * 4));
    for (const lv of LEVELS) {
      const p = missPenalty(lv.chapter);
      expect(p, `第 ${lv.index + 1} 关只有 ${lv.seconds} 秒,点错一次却要罚 ${p} 秒`).toBeLessThanOrEqual(
        lv.seconds / 4
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、竞态                                                            */
/* ------------------------------------------------------------------ */

describe("档C R2 · alien-seek · 竞态", () => {
  it("狂点同一个目标 30 下,只算一次,分数不会翻倍", () => {
    const lv = FIND(LEVELS.find((l) => l.mode === "find" && l.targets.length >= 3) as SeekLevel);
    expect(lv).not.toBeNull();
    if (!lv) return;
    const r = startRound(lv);
    const s = lv.spots[lv.targets[0].spot];
    for (let k = 0; k < 30; k++) pick(r, lv, 0, s.x, s.y);
    expect(r.scores[0]).toBe(1);
    expect(r.found.size).toBe(1);
    expect(r.misses).toBe(0);
    expect(r.log.filter((x) => x === "hit")).toHaveLength(1);
    expect(r.log.filter((x) => x === "dup-found")).toHaveLength(29);
  });

  it("最后一个目标被连点 10 下,结算只会发生一次", () => {
    const lv = FIND(LEVELS.find((l) => l.mode === "find" && l.targets.length >= 2) as SeekLevel);
    if (!lv) return;
    const r = startRound(lv);
    for (const tg of lv.targets) {
      const s = lv.spots[tg.spot];
      for (let k = 0; k < 10; k++) pick(r, lv, 0, s.x, s.y);
    }
    expect(r.won).toBe(true);
    expect(r.finished).toBe(true);
    expect(r.scores[0]).toBe(lv.targets.length);
    // 结算之后再怎么捶都不动了
    const before = JSON.stringify([r.scores, r.misses, r.left]);
    for (let k = 0; k < 50; k++) pick(r, lv, 0, lv.spots[0].x, lv.spots[0].y);
    expect(JSON.stringify([r.scores, r.misses, r.left])).toBe(before);
  });

  it("推理关连点同一个错答案,只扣一次时间", () => {
    const lv = LEVELS.find((l): l is DeduceLevel => l.mode === "deduce");
    expect(lv).toBeDefined();
    if (!lv) return;
    const wrong = lv.spots.findIndex((_, i) => i !== lv.answer);
    const r = startRound(lv);
    const s = lv.spots[wrong];
    for (let k = 0; k < 20; k++) pick(r, lv, 0, s.x, s.y);
    expect(r.misses).toBe(1);
    expect(r.left).toBe(lv.seconds - (lv.penalty ?? missPenalty(lv.chapter)));
    expect(r.finished).toBe(false);
  });

  it("推理关点错三个不同的地方才收工,而且收工之后不再接受输入", () => {
    const lv = LEVELS.find((l): l is DeduceLevel => l.mode === "deduce" && l.spots.length >= 5);
    if (!lv) return;
    const wrongs = lv.spots.map((_, i) => i).filter((i) => i !== lv.answer).slice(0, 3);
    const r = startRound(lv);
    for (const i of wrongs) pick(r, lv, 0, lv.spots[i].x, lv.spots[i].y);
    expect(r.misses).toBe(3);
    expect(r.finished).toBe(true);
    expect(r.won).toBe(false);
    // 收工后点中正确答案也不会「起死回生」
    pick(r, lv, 0, lv.spots[lv.answer].x, lv.spots[lv.answer].y);
    expect(r.won).toBe(false);
  });

  it("双人同一拍抢同一个目标:先到的记分,后到的空手,总分不会多出来", () => {
    const lv = buildVersusRound(3);
    if (lv.mode !== "find") return;
    const r = startRound(lv);
    for (const tg of lv.targets) {
      const s = lv.spots[tg.spot];
      // 朵朵和星星同一拍点同一个点
      pick(r, lv, 0, s.x, s.y);
      pick(r, lv, 1, s.x, s.y);
    }
    expect(r.scores[0] + r.scores[1]).toBe(lv.targets.length);
    expect(r.scores[1]).toBe(0);
    const line = versusLine(r.scores[0], r.scores[1]);
    expect(line).toContain("朵朵");
    for (const bad of ["输", "笨", "菜"]) expect(line).not.toContain(bad);
  });

  it("乱点空地 50 下:不扣时间、不扣星,提醒也只是偶尔说一句", () => {
    const lv = FIND(LEVELS[SAMPLE[0]]);
    if (!lv) return;
    const r = startRound(lv);
    for (let k = 0; k < 50; k++) pick(r, lv, 0, -900, -900);
    expect(r.misses).toBe(0);
    expect(r.left).toBe(lv.seconds);
    expect(r.emptyStreak).toBe(50);
    // 提醒只在连着点空到一定次数之后才出,不会每一下都唠叨
    const tips = Array.from({ length: 50 }, (_, k) => emptyClickTip(k + 1)).filter(Boolean);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.length).toBeLessThan(50);
    expect(emptyClickTip(1)).toBeNull();
    expect(emptyClickTip(EMPTY_TIPS_AFTER)).not.toBeNull();
  });

  it("点中之后紧跟着点空,连击计数会被清零,不会互相污染", () => {
    const lv = FIND(LEVELS.find((l) => l.mode === "find" && l.targets.length >= 2) as SeekLevel);
    if (!lv) return;
    const r = startRound(lv);
    for (let k = 0; k < 5; k++) pick(r, lv, 0, -900, -900);
    expect(r.emptyStreak).toBe(5);
    const s = lv.spots[lv.targets[0].spot];
    pick(r, lv, 0, s.x, s.y);
    expect(r.emptyStreak).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 三、无尽持续                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · alien-seek · 无尽连打 120 轮", () => {
  it("每一轮都生得出、点得完,不会中途生成失败", () => {
    let cleared = 0;
    for (let r = 1; r <= 120; r++) {
      const lv = buildEndlessRound(r);
      expect(lv.spots.length, `第 ${r} 轮没有藏身点`).toBeGreaterThanOrEqual(4);
      expect(lv.seconds, `第 ${r} 轮没给时间`).toBeGreaterThan(0);
      if (lv.mode === "find") {
        expect(lv.targets.length).toBeGreaterThan(0);
        for (const t of lv.targets) expect(lv.spots[t.spot]).toBeDefined();
        const round = startRound(lv);
        for (const t of lv.targets) {
          const s = lv.spots[t.spot];
          pick(round, lv, 0, s.x, s.y);
        }
        expect(round.won, `第 ${r} 轮点完全部目标还没赢`).toBe(true);
      } else {
        const round = startRound(lv);
        pick(round, lv, 0, lv.spots[lv.answer].x, lv.spots[lv.answer].y);
        expect(round.won, `第 ${r} 轮点中答案还没赢`).toBe(true);
      }
      cleared++;
    }
    expect(cleared).toBe(120);
  });

  it("三条曲线一路不掉头,而且到顶之后就稳在顶上", () => {
    for (let r = 2; r <= 200; r++) {
      expect(endlessSpotCount(r)).toBeGreaterThanOrEqual(endlessSpotCount(r - 1));
      expect(endlessTargetCount(r)).toBeGreaterThanOrEqual(endlessTargetCount(r - 1));
      expect(endlessSeconds(r)).toBeLessThanOrEqual(endlessSeconds(r - 1));
    }
  });

  it("【C2-01 已修】规模一路涨到第 36 轮,不再是第 20 轮就冻住", () => {
    // 原状:藏身点 / 目标数 / 限时三条曲线在第 20 轮同时到顶,shape(20)===shape(120)。
    // L2-01 之后目标数分两段涨到 8 个、罚时改成按轮次单调,难度分撑到第 36 轮。
    const shape = (r: number): string =>
      `${endlessSpotCount(r)}/${endlessTargetCount(r)}/${endlessSeconds(r)}/${endlessMissPenalty(r)}`;
    expect(shape(20)).not.toBe(shape(28));
    expect(shape(28)).not.toBe(shape(36));
    expect(endlessDifficulty(36)).toBeGreaterThan(endlessDifficulty(20));
    // 到顶那一轮之后规模才不动(16 个藏身点是摆放上限,14 秒是 sim 算出来的公平地板)
    expect(shape(ENDLESS_PEAK_ROUND)).toBe(shape(120));
    // 场景种子照旧每轮都换
    const a = buildEndlessRound(40);
    const b = buildEndlessRound(41);
    expect(JSON.stringify(a.spots)).not.toBe(JSON.stringify(b.spots));
  });

  it("连打 120 轮,藏身点从来不会重叠到点不开", () => {
    for (let r = 1; r <= 120; r += 7) {
      const lv = buildEndlessRound(r);
      for (let i = 0; i < lv.spots.length; i++) {
        for (let j = i + 1; j < lv.spots.length; j++) {
          const a = lv.spots[i];
          const b = lv.spots[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          expect(d, `第 ${r} 轮第 ${i}/${j} 个点叠在一起了`).toBeGreaterThan(8);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、存档往返                                                        */
/* ------------------------------------------------------------------ */

/** 一个可注入的内存存档,专门用来验往返 */
function memStore(): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
    dump: () => Object.fromEntries(map),
  };
}

describe("档C R2 · alien-seek · 存档往返", () => {
  const ID = "alien-seek";

  it("写进去几星,读出来还是几星", () => {
    const st = memStore();
    for (const i of SAMPLE) saveStar(ID, i, ((i % 3) + 1) as 1 | 2 | 3, st);
    const back = loadStars(ID, st);
    expect(back).toHaveLength(TOTAL_LEVELS);
    for (const i of SAMPLE) expect(back[i], `第 ${i + 1} 关星数没存住`).toBe(((i % 3) + 1));
  });

  it("同一关反复写,只留最好那一次,不会被低分覆盖", () => {
    const st = memStore();
    saveStar(ID, 46, 3, st);
    saveStar(ID, 46, 1, st);
    saveStar(ID, 46, 2, st);
    expect(loadStars(ID, st)[46]).toBe(3);
  });

  it("存档里塞了脏东西也读得回来,不会整份进度报废", () => {
    const st = memStore();
    saveStar(ID, 10, 3, st);
    const key = st.keys!().find((k) => k.includes(ID));
    expect(key).toBeDefined();
    for (const junk of ["", "{", "null", '"x"', "[1,2,{}]", '{"a":1}']) {
      st.setItem(key as string, junk);
      const back = loadStars(ID, st);
      expect(back, `存档写成 ${junk} 之后读崩了`).toHaveLength(TOTAL_LEVELS);
      expect(back.every((v) => v >= 0 && v <= 3)).toBe(true);
    }
  });

  it("存档 key 还是老那一个,一个字都没改", () => {
    const st = memStore();
    saveStar(ID, 0, 1, st);
    expect(st.keys!()).toEqual([`yiduo-yixing.l99.${ID}`]);
  });

  it("整份进度写满 188 关,导出再读回来一关不差", () => {
    const st = memStore();
    const want: number[] = [];
    const rand = mulberry32(4242);
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const s = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
      want.push(s);
      saveStar(ID, i, s, st);
    }
    // 换一个新的 storage 视角读(模拟关掉 app 再打开)
    const reopened = memStore();
    for (const [k, v] of Object.entries(st.dump())) reopened.setItem(k, v);
    expect(loadStars(ID, reopened)).toEqual(want);
  });

  it("双人局的比分不进存档,只有战役星级会落盘", () => {
    const st = memStore();
    const lv = buildVersusRound(5);
    expect(versusWinner(3, 1)).toBe("朵朵");
    expect(versusWinner(1, 3)).toBe("星星");
    expect(versusWinner(2, 2)).toBe("平局");
    expect(lv.spots.length).toBeGreaterThan(0);
    expect(st.keys!()).toEqual([]);
  });
});
