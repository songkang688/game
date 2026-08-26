/**
 * 钓鱼小达人 · 玩法内核单测。
 *
 * 重点在张力拉扯:断线、跑鱼、收竿成功三条分支都要能稳定复现,
 * 边界值(刚好 1.0 断线 / 刚好卡在 0.28 不算松)一个都不能漂。
 */
import { describe, expect, it } from "vitest";
import {
  CHARGE_CYCLE_MS,
  DEX_KEY,
  ENDLESS_MS,
  ESCAPE_MS,
  FISH,
  GAME_ID,
  GOOD_AT,
  LAYERS,
  MAX_DEPTH,
  MAX_STEP_MS,
  SNAP_AT,
  START_TENSION,
  TIGHT_AT,
  addToDex,
  autoReel,
  bandMiss,
  biteDelayMs,
  castDepth,
  catchScore,
  chargePower,
  clamp,
  comboMultiplier,
  depthLabel,
  dexProgress,
  endlessLeft,
  endlessRank,
  fightLine,
  fightParams,
  fishById,
  fishOfLayer,
  fishWeightAt,
  formatClock,
  formatWeight,
  inBand,
  isActionKey,
  isPauseKey,
  isPerfectCatch,
  layerAt,
  layerCenter,
  newFight,
  parseDex,
  pickFish,
  rarityChance,
  rarityStars,
  serializeDex,
  sinkMs,
  stepFight,
  struggle,
  tensionZone,
  zoneGain,
  zoneText,
  type Fish,
  type FightState,
} from "./logic";

/** 固定随机源:同一个种子永远给同一串数 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SMALL = FISH[0];
const BIG = FISH[FISH.length - 1];

/** 把一场拉扯按固定手法跑完,返回结局 */
function runFight(
  fish: Fish,
  hardness: number,
  decide: (state: FightState, wasReeling: boolean) => boolean,
  maxFrames = 5000
): FightState {
  const p = fightParams(fish, hardness);
  let state = newFight();
  let reeling = true;
  for (let i = 0; i < maxFrames && state.status === "fighting"; i++) {
    reeling = decide(state, reeling);
    state = stepFight(state, p, reeling, 16);
  }
  return state;
}

// ---------------------------------------------------------------------------

describe("水层", () => {
  it("五层水从浅到深首尾相接,最后一层顶到最大深度", () => {
    expect(LAYERS.length).toBe(5);
    for (let i = 1; i < LAYERS.length; i++) {
      expect(LAYERS[i].from).toBe(LAYERS[i - 1].to);
    }
    expect(LAYERS[0].from).toBe(0);
    expect(LAYERS[LAYERS.length - 1].to).toBe(MAX_DEPTH);
  });

  it("layerAt 落在每一层的区间里,超界夹到两端", () => {
    expect(layerAt(0)).toBe(0);
    expect(layerAt(7.9)).toBe(0);
    expect(layerAt(8)).toBe(1);
    expect(layerAt(29)).toBe(3);
    expect(layerAt(MAX_DEPTH)).toBe(4);
    expect(layerAt(999)).toBe(4);
    expect(layerAt(Number.NaN)).toBe(0);
  });

  it("depthLabel 带一位小数和水层名", () => {
    expect(depthLabel(3)).toBe("3.0 米 · 晨光浅滩");
    expect(depthLabel(45)).toContain("星光海沟");
  });

  it("layerCenter 落在这一层内部", () => {
    for (let i = 0; i < LAYERS.length; i++) {
      const c = layerCenter(i);
      expect(c).toBeGreaterThanOrEqual(LAYERS[i].from);
      expect(c).toBeLessThanOrEqual(LAYERS[i].to);
    }
  });
});

describe("抛竿蓄力", () => {
  it("力度条是 0→1→0 的三角波,来回摆", () => {
    expect(chargePower(0)).toBe(0);
    expect(chargePower(CHARGE_CYCLE_MS / 2)).toBeCloseTo(1, 5);
    expect(chargePower(CHARGE_CYCLE_MS)).toBeCloseTo(0, 5);
    expect(chargePower(CHARGE_CYCLE_MS / 4)).toBeCloseTo(0.5, 5);
    expect(chargePower(CHARGE_CYCLE_MS * 0.75)).toBeCloseTo(0.5, 5);
  });

  it("力度永远在 0..1 之间,按多久都不会溢出", () => {
    for (let ms = 0; ms < 12_000; ms += 37) {
      const p = chargePower(ms);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("力度 → 深度线性映射,保留一位小数", () => {
    expect(castDepth(0)).toBe(0);
    expect(castDepth(1)).toBe(MAX_DEPTH);
    expect(castDepth(0.5)).toBe(25);
    expect(castDepth(-3)).toBe(0);
    expect(castDepth(9)).toBe(MAX_DEPTH);
  });

  it("越深沉得越久,咬钩等待也随深度变长", () => {
    expect(sinkMs(0)).toBeLessThan(sinkMs(25));
    expect(sinkMs(25)).toBeLessThan(sinkMs(MAX_DEPTH));
    const shallow = biteDelayMs(() => 0, 0);
    const deep = biteDelayMs(() => 0, MAX_DEPTH);
    expect(deep).toBeGreaterThan(shallow);
    expect(biteDelayMs(() => 0.999, 10)).toBeGreaterThan(biteDelayMs(() => 0, 10));
  });

  it("inBand / bandMiss 认得出落点偏了多少", () => {
    const band = { from: 10, to: 20 };
    expect(inBand(15, band)).toBe(true);
    expect(inBand(10, band)).toBe(true);
    expect(inBand(20, band)).toBe(true);
    expect(inBand(9.9, band)).toBe(false);
    expect(bandMiss(15, band)).toBe(0);
    expect(bandMiss(7, band)).toBe(3);
    expect(bandMiss(23.5, band)).toBe(3.5);
  });
});

describe("鱼种图鉴表", () => {
  it("至少 20 种鱼,id 与名字都不重复", () => {
    expect(FISH.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
    expect(new Set(FISH.map((f) => f.name)).size).toBe(FISH.length);
  });

  it("每一层都住着至少三种鱼", () => {
    for (let i = 0; i < LAYERS.length; i++) {
      expect(fishOfLayer(i).length, `第 ${i} 层的鱼太少`).toBeGreaterThanOrEqual(3);
    }
    expect(fishOfLayer(0).concat(fishOfLayer(1), fishOfLayer(2), fishOfLayer(3), fishOfLayer(4)).length).toBe(FISH.length);
  });

  it("每条鱼的数值都在合理范围里,而且带一句原创图鉴说明", () => {
    for (const f of FISH) {
      expect(f.rarity, f.id).toBeGreaterThanOrEqual(1);
      expect(f.rarity, f.id).toBeLessThanOrEqual(5);
      expect(f.layer, f.id).toBeGreaterThanOrEqual(0);
      expect(f.layer, f.id).toBeLessThan(LAYERS.length);
      expect(f.weight, f.id).toBeGreaterThan(0);
      expect(f.score, f.id).toBeGreaterThan(0);
      expect(f.pull, f.id).toBeGreaterThan(0.2);
      expect(f.pull, f.id).toBeLessThanOrEqual(1);
      expect(f.stamina, f.id).toBeGreaterThanOrEqual(1);
      expect(f.stamina, f.id).toBeLessThanOrEqual(2.5);
      expect(f.note.length, f.id).toBeGreaterThan(8);
      expect(f.emoji.length, f.id).toBeGreaterThan(0);
    }
  });

  it("越稀有分越高;深水的鱼力气普遍比浅滩大", () => {
    const byRarity = [1, 2, 3, 4, 5].map((r) => {
      const group = FISH.filter((f) => f.rarity === r);
      return group.reduce((s, f) => s + f.score, 0) / Math.max(1, group.length);
    });
    for (let i = 1; i < byRarity.length; i++) {
      expect(byRarity[i], `稀有度 ${i + 1} 的均分应该更高`).toBeGreaterThan(byRarity[i - 1]);
    }
    const shallowPull = fishOfLayer(0).reduce((s, f) => s + f.pull, 0) / fishOfLayer(0).length;
    const deepPull = fishOfLayer(4).reduce((s, f) => s + f.pull, 0) / fishOfLayer(4).length;
    expect(deepPull).toBeGreaterThan(shallowPull);
  });

  it("fishById 查得到也查得空", () => {
    expect(fishById(FISH[3].id)?.name).toBe(FISH[3].name);
    expect(fishById("没有这条鱼")).toBeUndefined();
  });

  it("稀有度星串永远是五颗", () => {
    expect(rarityStars(1)).toBe("★☆☆☆☆");
    expect(rarityStars(5)).toBe("★★★★★");
    expect(rarityStars(0)).toBe("★☆☆☆☆");
    expect(rarityStars(99)).toBe("★★★★★");
  });
});

describe("谁咬钩", () => {
  it("稀有度越高越难碰上", () => {
    expect(rarityChance(1)).toBeGreaterThan(rarityChance(2));
    expect(rarityChance(2)).toBeGreaterThan(rarityChance(3));
    expect(rarityChance(4)).toBeGreaterThan(rarityChance(5));
  });

  it("运气加成只抬高稀有鱼,常见鱼保持不变", () => {
    expect(rarityChance(1, 1)).toBeCloseTo(rarityChance(1, 0), 6);
    expect(rarityChance(5, 1)).toBeGreaterThan(rarityChance(5, 0));
  });

  it("同一层的鱼权重最高,隔得越远越不可能", () => {
    const shallow = FISH.find((f) => f.layer === 0) as Fish;
    const deep = FISH.find((f) => f.layer === 4) as Fish;
    expect(fishWeightAt(shallow, 3)).toBeGreaterThan(fishWeightAt(deep, 3));
    expect(fishWeightAt(deep, 45)).toBeGreaterThan(fishWeightAt(shallow, 45));
    expect(fishWeightAt(shallow, 45)).toBeGreaterThan(0);
  });

  it("抽签是确定的:同一串随机数抽出同一条鱼", () => {
    const a = pickFish(20, rng(7));
    const b = pickFish(20, rng(7));
    expect(a.id).toBe(b.id);
  });

  it("抽一千次:浅滩抽到的绝大多数是浅层鱼", () => {
    const rand = rng(99);
    let sameLayer = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickFish(4, rand).layer === 0) sameLayer++;
    }
    expect(sameLayer).toBeGreaterThan(700);
  });

  it("极端随机值也抽得到鱼,不会返回 undefined", () => {
    expect(pickFish(25, () => 0)).toBeTruthy();
    expect(pickFish(25, () => 0.9999999)).toBeTruthy();
    expect(pickFish(25, () => 1)).toBeTruthy();
    expect(pickFish(25, () => -5)).toBeTruthy();
  });
});

describe("张力分区", () => {
  it("四个区间的分界点就在常量上", () => {
    expect(tensionZone(0)).toBe("slack");
    expect(tensionZone(GOOD_AT - 0.001)).toBe("slack");
    expect(tensionZone(GOOD_AT)).toBe("good");
    expect(tensionZone(TIGHT_AT - 0.001)).toBe("good");
    expect(tensionZone(TIGHT_AT)).toBe("tight");
    expect(tensionZone(SNAP_AT - 0.001)).toBe("tight");
    expect(tensionZone(SNAP_AT)).toBe("snap");
    expect(tensionZone(Number.NaN)).toBe("slack");
  });

  it("舒服区收线效率最高,松弛区几乎收不动", () => {
    expect(zoneGain("good")).toBeGreaterThan(zoneGain("tight"));
    expect(zoneGain("tight")).toBeGreaterThan(zoneGain("slack"));
    expect(zoneGain("snap")).toBe(0);
  });

  it("每个区间都有一句给孩子看的提示", () => {
    expect(zoneText("tight")).toContain("松");
    expect(zoneText("slack")).toContain("收");
    expect(zoneText("good")).toContain("正好");
    expect(zoneText("snap")).toContain("断");
  });

  it("开局张力落在舒服区,不会一咬钩就报警", () => {
    expect(tensionZone(START_TENSION)).toBe("good");
    expect(newFight().status).toBe("fighting");
    expect(newFight().progress).toBe(0);
  });
});

describe("拉扯参数", () => {
  it("松手的力度一定压得住鱼的挣扎,否则会变成死局", () => {
    for (const f of FISH) {
      for (const h of [0, 0.5, 1]) {
        const p = fightParams(f, h);
        expect(p.ease, `${f.id} 在难度 ${h} 下松手压不住`).toBeGreaterThan(p.pull);
      }
    }
  });

  it("难度只加鱼的力气,不改玩家的收线速度", () => {
    const easy = fightParams(BIG, 0);
    const hard = fightParams(BIG, 1);
    expect(hard.pull).toBeGreaterThan(easy.pull);
    expect(hard.reel).toBe(easy.reel);
    expect(hard.gain).toBe(easy.gain);
    expect(hard.escapeMs).toBeLessThan(easy.escapeMs);
    expect(easy.escapeMs).toBe(ESCAPE_MS);
  });

  it("体力越足收得越慢", () => {
    expect(fightParams(BIG, 0).gain).toBeLessThan(fightParams(SMALL, 0).gain);
  });

  it("挣扎波形在 0..1 之间来回,平均值约 0.5", () => {
    let sum = 0;
    let n = 0;
    for (let t = 0; t < 4000; t += 7) {
      const v = struggle(t, 800);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      sum += v;
      n++;
    }
    expect(sum / n).toBeCloseTo(0.5, 1);
    expect(struggle(0, 0)).toBeCloseTo(0.5, 6);
  });
});

describe("拉扯的一帧", () => {
  it("一直按住收线 → 张力冲顶断线", () => {
    const out = runFight(SMALL, 0, () => true);
    expect(out.status).toBe("snapped");
    expect(out.tension).toBeGreaterThanOrEqual(SNAP_AT);
  });

  it("一直不收线 → 张力落到底,鱼甩钩跑掉", () => {
    const out = runFight(SMALL, 0, () => false);
    expect(out.status).toBe("escaped");
    expect(out.slackMs).toBeGreaterThanOrEqual(fightParams(SMALL, 0).escapeMs);
  });

  it("一收一放的标准手法 → 每一条鱼都能收上来", () => {
    for (const f of FISH) {
      for (const h of [0, 0.5, 1]) {
        const out = runFight(f, h, (st, was) => autoReel(st, 0.34, 0.6, was));
        expect(out.status, `${f.id} 在难度 ${h} 下没能收上来`).toBe("landed");
        expect(out.elapsedMs, `${f.id} 拉扯时间过长`).toBeLessThan(20_000);
      }
    }
  });

  it("大鱼比小鱼难拉,时间明显更长", () => {
    const small = runFight(SMALL, 0.5, (st, was) => autoReel(st, 0.34, 0.6, was));
    const big = runFight(BIG, 0.5, (st, was) => autoReel(st, 0.34, 0.6, was));
    expect(big.elapsedMs).toBeGreaterThan(small.elapsedMs);
  });

  it("断线优先于收竿:同一帧张力冲顶就算断,不给侥幸", () => {
    const p = fightParams(SMALL, 0);
    const almost: FightState = {
      tension: SNAP_AT - 0.001,
      progress: 0.999,
      slackMs: 0,
      elapsedMs: 0,
      perfectMs: 0,
      status: "fighting",
    };
    const out = stepFight(almost, { ...p, reel: 5, gain: 5 }, true, 16);
    expect(out.status).toBe("snapped");
  });

  it("结束以后再喂帧也不会改状态", () => {
    const p = fightParams(SMALL, 0);
    const done: FightState = { ...newFight(), status: "landed", progress: 1 };
    expect(stepFight(done, p, true, 16)).toBe(done);
    expect(stepFight({ ...done, status: "snapped" }, p, false, 500).status).toBe("snapped");
  });

  it("切后台回来的一大跳会被夹到 MAX_STEP_MS,不会一下崩断线", () => {
    const p = fightParams(SMALL, 0);
    const a = stepFight(newFight(), p, true, 100_000);
    const b = stepFight(newFight(), p, true, MAX_STEP_MS);
    expect(a).toEqual(b);
    expect(a.status).toBe("fighting");
  });

  it("负数与 NaN 的时间步长当 0 处理", () => {
    const p = fightParams(SMALL, 0);
    const base = newFight();
    expect(stepFight(base, p, true, -50)).toEqual({ ...base, elapsedMs: 0 });
    expect(stepFight(base, p, true, Number.NaN).tension).toBeCloseTo(base.tension, 6);
  });

  it("逐帧重放完全一致:同样的输入序列给同样的结果", () => {
    const p = fightParams(FISH[10], 0.4);
    const inputs = [true, true, false, true, false, false, true, true, true, false];
    const play = (): FightState => {
      let st = newFight();
      for (let i = 0; i < 60; i++) st = stepFight(st, p, inputs[i % inputs.length], 16);
      return st;
    };
    expect(play()).toEqual(play());
  });

  it("张力永远不会跑到 0 以下,进度永远在 0..1", () => {
    const p = fightParams(BIG, 1);
    let st = newFight();
    for (let i = 0; i < 400; i++) {
      st = stepFight(st, p, i % 17 === 0, 16);
      expect(st.tension).toBeGreaterThanOrEqual(0);
      expect(st.progress).toBeGreaterThanOrEqual(0);
      expect(st.progress).toBeLessThanOrEqual(1);
      if (st.status !== "fighting") break;
    }
  });

  it("松弛计时会在张力回到舒服区时清零", () => {
    const p = fightParams(SMALL, 0);
    let st = newFight();
    for (let i = 0; i < 20; i++) st = stepFight(st, p, false, 16);
    expect(st.slackMs).toBeGreaterThan(0);
    // 收线把张力拉回舒服区之前,松弛计时还在走;一回到舒服区就必须归零
    for (let i = 0; i < 40; i++) st = stepFight(st, p, true, 16);
    expect(tensionZone(st.tension)).toBe("good");
    expect(st.slackMs).toBe(0);
    expect(st.status).toBe("fighting");
  });

  it("全程稳在舒服区算完美收竿,乱来就不算", () => {
    const good = runFight(FISH[5], 0.3, (st, was) => autoReel(st, 0.34, 0.6, was));
    expect(good.status).toBe("landed");
    expect(isPerfectCatch(good)).toBe(true);
    expect(isPerfectCatch(newFight())).toBe(false);
    expect(isPerfectCatch({ ...newFight(), status: "snapped" })).toBe(false);
  });

  it("autoReel 在两条阈值之间保持原来的动作,不会抖来抖去", () => {
    const st = newFight();
    expect(autoReel({ ...st, tension: 0.9 }, 0.34, 0.6, true)).toBe(false);
    expect(autoReel({ ...st, tension: 0.2 }, 0.34, 0.6, false)).toBe(true);
    expect(autoReel({ ...st, tension: 0.45 }, 0.34, 0.6, true)).toBe(true);
    expect(autoReel({ ...st, tension: 0.45 }, 0.34, 0.6, false)).toBe(false);
  });

  it("三种结局都有一句温柔的说明", () => {
    expect(fightLine("snapped")).toContain("松");
    expect(fightLine("escaped")).toContain("跑");
    expect(fightLine("landed")).toContain("成功");
    expect(fightLine("fighting").length).toBeGreaterThan(0);
  });
});

describe("计分与连击", () => {
  it("连击最多加到两倍就封顶", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBeCloseTo(1.2, 6);
    expect(comboMultiplier(5)).toBeCloseTo(2, 6);
    expect(comboMultiplier(50)).toBeCloseTo(2, 6);
    expect(comboMultiplier(-3)).toBe(1);
  });

  it("完美收竿与落点准都会加分,基础分永远至少 1", () => {
    const f = FISH[0];
    const base = catchScore(f);
    expect(base).toBe(f.score);
    expect(catchScore(f, { perfect: true })).toBeGreaterThan(base);
    expect(catchScore(f, { inBand: true })).toBeGreaterThan(base);
    expect(catchScore(f, { combo: 3 })).toBeGreaterThan(base);
    expect(catchScore({ ...f, score: 0 })).toBeGreaterThanOrEqual(1);
  });

  it("无尽模式的时间与称号", () => {
    expect(endlessLeft(0)).toBe(ENDLESS_MS);
    expect(endlessLeft(ENDLESS_MS)).toBe(0);
    expect(endlessLeft(ENDLESS_MS + 5000)).toBe(0);
    expect(endlessLeft(-100)).toBe(ENDLESS_MS);
    expect(endlessRank(0)).toBe("初次下竿");
    expect(endlessRank(1000)).toBe("海沟传说");
    const ranks = [0, 50, 150, 300, 500, 900].map(endlessRank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});

describe("图鉴存档", () => {
  it("坏数据一律当空图鉴,不抛异常", () => {
    expect(parseDex(null)).toEqual([]);
    expect(parseDex("")).toEqual([]);
    expect(parseDex("不是 JSON")).toEqual([]);
    expect(parseDex('{"a":1}')).toEqual([]);
    expect(parseDex("[1,2,3]")).toEqual([]);
    expect(parseDex('["查无此鱼"]')).toEqual([]);
  });

  it("认识的鱼按图鉴顺序排好,重复的只留一条", () => {
    const raw = JSON.stringify([FISH[4].id, FISH[0].id, FISH[4].id]);
    expect(parseDex(raw)).toEqual([FISH[0].id, FISH[4].id]);
  });

  it("收录是幂等的", () => {
    const one = addToDex([], FISH[2].id);
    expect(one).toEqual([FISH[2].id]);
    expect(addToDex(one, FISH[2].id)).toEqual(one);
    expect(addToDex(one, "查无此鱼")).toEqual(one);
    expect(addToDex(one, FISH[1].id)).toEqual([FISH[1].id, FISH[2].id]);
  });

  it("序列化以后读回来还是同一份", () => {
    const ids = [FISH[9].id, FISH[1].id];
    expect(parseDex(serializeDex(ids))).toEqual([FISH[1].id, FISH[9].id]);
  });

  it("收录度按整数百分比算", () => {
    expect(dexProgress([])).toEqual({ found: 0, total: FISH.length, percent: 0 });
    expect(dexProgress(FISH.map((f) => f.id))).toEqual({
      found: FISH.length,
      total: FISH.length,
      percent: 100,
    });
    expect(dexProgress([FISH[0].id, "假的"]).found).toBe(1);
  });

  it("存档 key 挂在本应用的前缀下,不和别的游戏打架", () => {
    expect(DEX_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(DEX_KEY).toContain(GAME_ID);
  });
});

describe("小工具", () => {
  it("Esc 暂停,空格与回车是动作键", () => {
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyP")).toBe(false);
    expect(isActionKey("Space")).toBe(true);
    expect(isActionKey("Enter")).toBe(true);
    expect(isActionKey("NumpadEnter")).toBe(true);
    expect(isActionKey("KeyA")).toBe(false);
  });

  it("体重不到一千克说克", () => {
    expect(formatWeight(0.3)).toBe("300 克");
    expect(formatWeight(1)).toBe("1.0 千克");
    expect(formatWeight(9.05)).toBe("9.1 千克");
    expect(formatWeight(0)).toBe("0 克");
    expect(formatWeight(Number.NaN)).toBe("0 克");
  });

  it("时间显示成 分:秒", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(1)).toBe("0:01");
    expect(formatClock(90_000)).toBe("1:30");
    expect(formatClock(-500)).toBe("0:00");
  });

  it("clamp 挡得住 NaN 与越界", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(Number.NaN, 2, 10)).toBe(2);
  });
});
