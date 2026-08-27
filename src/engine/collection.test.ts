import { afterEach, describe, expect, it } from "vitest";
import type { StorageLike } from "./save";
import type { Bonus, Wallet } from "./collection";
import {
  BONUS_CAP_PERMILLE,
  COLLECTION_KEY,
  CollectionStore,
  GEARS,
  GEAR_SLOTS,
  HEROES,
  ITEMS,
  MAX_LEVEL,
  PETS,
  STARTER_IDS,
  START_SHIELD_MS_PER_LEVEL,
  STAT_KEYS,
  collection,
  defaultCollection,
  describeStats,
  formatPermille,
  itemById,
  itemsInSlot,
  itemsOfKind,
  maxBonus,
  overallGain,
  parseCollection,
  perksOf,
  sanitizeCollection,
  serializeCollection,
  statsAtLevel,
  totalCost,
  unlockCost,
  upgradeCost
} from "./collection";

// ---------------------------------------------------------------------------
// 测试用的假钱包与假存储
// ---------------------------------------------------------------------------

function makeWallet(start: number): Wallet & { balance: number } {
  return {
    balance: Math.max(0, Math.round(start)),
    getStars() {
      return this.balance;
    },
    addStars(n: number) {
      this.balance = Math.max(0, Math.round(this.balance + n));
      return this.balance;
    }
  };
}

function makeStorage(seed?: Record<string, string>): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    map,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()]
  };
}

/** 隐私模式:localStorage 存在,但一读写就抛 */
function makeHostileStorage(): StorageLike {
  return {
    getItem() {
      throw new Error("privacy mode");
    },
    setItem() {
      throw new Error("privacy mode");
    },
    removeItem() {
      throw new Error("privacy mode");
    }
  };
}

function makeStore(stars = 1000, seed?: Record<string, string>) {
  const wallet = makeWallet(stars);
  const storage = makeStorage(seed);
  return { wallet, storage, store: new CollectionStore(wallet, storage) };
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

// ---------------------------------------------------------------------------
// 1. 图鉴数据
// ---------------------------------------------------------------------------

describe("收藏册图鉴", () => {
  it("人物至少 6 位,鸭梨和康康一开始就在", () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(6);
    const names = HEROES.map((h) => h.name);
    expect(names).toContain("鸭梨");
    expect(names).toContain("康康");
    expect([...STARTER_IDS].sort()).toEqual(["duoduo", "xingxing"]);
  });

  it("宠物至少 6 只,每只都带一个温和的被动", () => {
    expect(PETS.length).toBeGreaterThanOrEqual(6);
    for (const pet of PETS) {
      const hasStat = STAT_KEYS.some((k) => (pet.stats[k] ?? 0) > 0);
      expect(hasStat || !!pet.perk, `${pet.name} 没有任何被动`).toBe(true);
    }
    // 复活一次、起步无敌这两种一次性被动都得有宠物带着
    expect(PETS.some((p) => p.perk === "revive")).toBe(true);
    expect(PETS.some((p) => p.perk === "startShield")).toBe(true);
  });

  it("装备至少 8 件,鞋 / 披风 / 帽子 / 护目镜都配齐", () => {
    expect(GEARS.length).toBeGreaterThanOrEqual(8);
    for (const slot of ["shoes", "cape", "hat", "goggles"] as const) {
      expect(itemsInSlot(slot).length, `${slot} 槽是空的`).toBeGreaterThan(0);
    }
    expect(itemsOfKind("gear").length).toBe(GEARS.length);
  });

  it("每件收藏品的 id 都唯一,而且 kind 与 slot 对得上", () => {
    const ids = ITEMS.map((it) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ITEMS) {
      expect(item.name.trim().length, `${item.id} 没名字`).toBeGreaterThan(0);
      expect(item.blurb.trim().length, `${item.id} 没介绍`).toBeGreaterThan(0);
      if (item.kind === "hero") expect(item.slot).toBe("hero");
      if (item.kind === "pet") expect(item.slot).toBe("pet");
      if (item.kind === "gear") expect(GEAR_SLOTS).toContain(item.slot as never);
    }
    expect(itemById("这件根本不存在")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. 数值必须温和(收益上限)
// ---------------------------------------------------------------------------

describe("加成上限:全套满级也不超过 +35%", () => {
  const max = maxBonus();

  it("单项属性的理论最大加成都压在 +35% 以内", () => {
    for (const key of STAT_KEYS) {
      expect(max[key], `${key} 的满级加成 ${max[key]}‰ 超过上限`).toBeLessThanOrEqual(
        BONUS_CAP_PERMILLE
      );
    }
  });

  it("五项折成综合强度后也不超过 +35%", () => {
    expect(overallGain(max)).toBeLessThanOrEqual(BONUS_CAP_PERMILLE);
  });

  it("每一项都确实练得出加成,不是摆设", () => {
    for (const key of STAT_KEYS) {
      expect(max[key], `${key} 一点都练不上去`).toBeGreaterThan(0);
    }
  });

  it("一次性被动同样温和:起步无敌不超过 2.4 秒,复活只有一次", () => {
    const shield = PETS.find((p) => p.perk === "startShield")!;
    const revive = PETS.find((p) => p.perk === "revive")!;
    expect(perksOf(shield, MAX_LEVEL).startShieldMs).toBe(START_SHIELD_MS_PER_LEVEL * MAX_LEVEL);
    expect(perksOf(shield, MAX_LEVEL).startShieldMs).toBeLessThanOrEqual(2400);
    expect(perksOf(revive, MAX_LEVEL).reviveOnce).toBe(true);
    expect(perksOf(null, 3)).toEqual({ reviveOnce: false, startShieldMs: 0 });
  });

  it("等级越界时按 0 与满级夹住,不会把加成放飞", () => {
    const hero = itemById("shanshan")!;
    expect(statsAtLevel(hero, 0)).toEqual({ speed: 0, jump: 0, magnet: 0, coin: 0, luck: 0 });
    expect(statsAtLevel(hero, -5).speed).toBe(0);
    expect(statsAtLevel(hero, 99)).toEqual(statsAtLevel(hero, MAX_LEVEL));
    expect(statsAtLevel(hero, Number.NaN).speed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. 花费
// ---------------------------------------------------------------------------

describe("星星花费", () => {
  it("白送的两位解锁价是 0,别的都要花星星", () => {
    for (const item of ITEMS) {
      if (STARTER_IDS.includes(item.id)) expect(unlockCost(item)).toBe(0);
      else expect(unlockCost(item)).toBeGreaterThan(0);
    }
  });

  it("越贵的收藏品升级越贵,第二级比第一级贵", () => {
    const cheap = itemById("duoduo")!;
    const pricey = itemById("dingding")!;
    expect(upgradeCost(cheap, 1)).toBeLessThan(upgradeCost(pricey, 1));
    expect(upgradeCost(pricey, 2)).toBeGreaterThan(upgradeCost(pricey, 1));
  });

  it("升级价的等级参数被夹在 1..满级-1 之间", () => {
    const item = itemById("shoes-cloud")!;
    expect(upgradeCost(item, 0)).toBe(upgradeCost(item, 1));
    expect(upgradeCost(item, 99)).toBe(upgradeCost(item, MAX_LEVEL - 1));
  });

  it("从零到满级的总价 = 解锁价 + 每一级升级价", () => {
    const item = itemById("cape-star")!;
    let sum = unlockCost(item);
    for (let lv = 1; lv < MAX_LEVEL; lv++) sum += upgradeCost(item, lv);
    expect(totalCost(item)).toBe(sum);
  });
});

// ---------------------------------------------------------------------------
// 4. 解锁与升级
// ---------------------------------------------------------------------------

describe("解锁", () => {
  it("解锁会扣掉对应数量的星星", () => {
    const { store, wallet } = makeStore(500);
    const item = itemById("nuonuo")!;
    const res = store.unlock("nuonuo");
    expect(res.ok).toBe(true);
    expect(res.reason).toBe("ok");
    expect(res.spent).toBe(unlockCost(item));
    expect(wallet.balance).toBe(500 - unlockCost(item));
    expect(store.getLevel("nuonuo")).toBe(1);
    expect(res.stars).toBe(wallet.balance);
  });

  it("余额不足就不解锁,一颗星都不扣", () => {
    const { store, wallet } = makeStore(10);
    const res = store.unlock("dingding");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("poor");
    expect(res.spent).toBe(0);
    expect(wallet.balance).toBe(10);
    expect(store.isUnlocked("dingding")).toBe(false);
  });

  it("星星刚好够时解锁得了,余额正好清零", () => {
    const cost = unlockCost(itemById("lvludou")!);
    const { store, wallet } = makeStore(cost);
    expect(store.unlock("lvludou").ok).toBe(true);
    expect(wallet.balance).toBe(0);
  });

  it("已经有的不能再买一次,认不出的 id 直接回绝", () => {
    const { store, wallet } = makeStore(500);
    expect(store.unlock("duoduo").reason).toBe("owned");
    expect(store.unlock("这件根本不存在").reason).toBe("unknown");
    expect(wallet.balance).toBe(500);
  });

  it("鸭梨和康康开局就在,不用花星星", () => {
    const { store, wallet } = makeStore(0);
    expect(store.isUnlocked("duoduo")).toBe(true);
    expect(store.isUnlocked("xingxing")).toBe(true);
    expect(wallet.balance).toBe(0);
    expect(store.unlockedIds()).toEqual(["duoduo", "xingxing"]);
  });
});

describe("升级", () => {
  it("升级扣星并加一级", () => {
    const { store, wallet } = makeStore(500);
    const item = itemById("duoduo")!;
    const price = upgradeCost(item, 1);
    const res = store.upgrade("duoduo");
    expect(res.ok).toBe(true);
    expect(res.level).toBe(2);
    expect(res.spent).toBe(price);
    expect(wallet.balance).toBe(500 - price);
  });

  it("满级之后再点也不扣星", () => {
    const { store, wallet } = makeStore(5000);
    for (let i = 1; i < MAX_LEVEL; i++) expect(store.upgrade("xingxing").ok).toBe(true);
    const before = wallet.balance;
    const res = store.upgrade("xingxing");
    expect(res.reason).toBe("max");
    expect(res.level).toBe(MAX_LEVEL);
    expect(wallet.balance).toBe(before);
  });

  it("还没解锁的东西升不了级", () => {
    const { store } = makeStore(5000);
    expect(store.upgrade("dingding").reason).toBe("locked");
    expect(store.upgrade("这件根本不存在").reason).toBe("unknown");
  });

  it("升级余额不足时保持原级", () => {
    const { store, wallet } = makeStore(5);
    const res = store.upgrade("duoduo");
    expect(res.reason).toBe("poor");
    expect(res.level).toBe(1);
    expect(wallet.balance).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 5. 试穿
// ---------------------------------------------------------------------------

describe("试穿与脱下", () => {
  it("没解锁的穿不上", () => {
    const { store } = makeStore(0);
    expect(store.equip("cape-star")).toBe(false);
    expect(store.equippedId("cape")).toBeNull();
  });

  it("同一个槽只穿得下一件,换一件就把上一件替下来", () => {
    const { store } = makeStore(5000);
    store.unlock("shoes-cloud");
    store.unlock("shoes-spring");
    expect(store.equip("shoes-cloud")).toBe(true);
    expect(store.equippedId("shoes")).toBe("shoes-cloud");
    expect(store.equip("shoes-spring")).toBe(true);
    expect(store.equippedId("shoes")).toBe("shoes-spring");
    expect(store.isEquipped("shoes-cloud")).toBe(false);
  });

  it("宠物可以脱下来,人物槽永远有人站着", () => {
    const { store } = makeStore(5000);
    store.unlock("jiujiu");
    store.equip("jiujiu");
    expect(store.unequip("pet")).toBe(true);
    expect(store.equippedId("pet")).toBeNull();
    expect(store.unequip("pet")).toBe(false);
    expect(store.unequip("hero")).toBe(false);
    expect(store.equippedId("hero")).toBe("duoduo");
  });

  it("穿上一整套之后加成正好等于各件之和", () => {
    const { store } = makeStore(5000);
    for (const id of ["shanshan", "lvludou", "shoes-cloud", "cape-star"]) {
      store.unlock(id);
      store.equip(id);
    }
    const expected: Bonus = { speed: 0, jump: 0, magnet: 0, coin: 0, luck: 0 };
    for (const id of ["shanshan", "lvludou", "shoes-cloud", "cape-star"]) {
      const part = statsAtLevel(itemById(id)!, 1);
      for (const key of STAT_KEYS) expected[key] += part[key];
    }
    expect(store.bonus()).toEqual(expected);
    const loadout = store.loadout();
    expect(loadout.hero.id).toBe("shanshan");
    expect(loadout.pet?.id).toBe("lvludou");
    expect(loadout.gear.map((g) => g.id)).toEqual(["shoes-cloud", "cape-star"]);
  });

  it("游戏侧拿到的是一串乘数,什么都没穿时全是 1", () => {
    const { store } = makeStore(5000);
    const bare = new CollectionStore(makeWallet(0), makeStorage());
    bare.unequip("pet");
    const heroOnly = bare.effects();
    expect(heroOnly.speedMul).toBeCloseTo(1 + statsAtLevel(itemById("duoduo")!, 1).speed / 1000, 6);
    expect(heroOnly.reviveOnce).toBe(false);
    expect(heroOnly.startShieldMs).toBe(0);

    store.unlock("mianmian");
    store.equip("mianmian");
    expect(store.effects().reviveOnce).toBe(true);
    store.unlock("paopao");
    store.equip("paopao");
    expect(store.effects().reviveOnce).toBe(false);
    expect(store.effects().startShieldMs).toBe(START_SHIELD_MS_PER_LEVEL);
  });
});

// ---------------------------------------------------------------------------
// 6. 坏存档降级
// ---------------------------------------------------------------------------

describe("坏存档降级为默认", () => {
  it("不是 JSON 的一坨字符直接当没存过", () => {
    const { store } = makeStore(0, { [COLLECTION_KEY]: "{这不是 json" });
    expect(store.snapshot()).toEqual(defaultCollection());
  });

  it("顶层是数组 / null / 数字都降级", () => {
    for (const raw of ["[]", "null", "42", '"字符串"']) {
      const { store } = makeStore(0, { [COLLECTION_KEY]: raw });
      expect(store.snapshot(), `${raw} 没降级`).toEqual(defaultCollection());
    }
    expect(sanitizeCollection(undefined)).toEqual(defaultCollection());
    expect(parseCollection(null)).toEqual(defaultCollection());
    expect(parseCollection("")).toEqual(defaultCollection());
  });

  it("认不出的 id 与坏掉的等级会被丢掉,认得的照常读回来", () => {
    const data = sanitizeCollection({
      levels: {
        duoduo: 3,
        "别家的角色": 2,
        "shoes-cloud": "二级",
        "cape-star": Number.NaN,
        jiujiu: 99,
        dingding: 0,
        nuonuo: -1
      },
      equipped: { hero: "duoduo" }
    });
    expect(data.levels.duoduo).toBe(3);
    expect(data.levels.jiujiu).toBe(MAX_LEVEL);
    expect(data.levels["别家的角色"]).toBeUndefined();
    expect(data.levels["shoes-cloud"]).toBeUndefined();
    expect(data.levels["cape-star"]).toBeUndefined();
    expect(data.levels.dingding).toBeUndefined();
    expect(data.levels.nuonuo).toBeUndefined();
  });

  it("穿着没解锁的东西 / 穿错槽位都会被摘掉", () => {
    const data = sanitizeCollection({
      levels: { "shoes-cloud": 1 },
      equipped: { shoes: "cape-star", cape: "shoes-cloud", hat: "dingding", pet: 7 }
    });
    expect(data.equipped.shoes).toBeUndefined();
    expect(data.equipped.cape).toBeUndefined();
    expect(data.equipped.hat).toBeUndefined();
    expect(data.equipped.pet).toBeUndefined();
  });

  it("人物槽空着或指向没解锁的人时,自动换回鸭梨", () => {
    expect(sanitizeCollection({ levels: {}, equipped: {} }).equipped.hero).toBe("duoduo");
    expect(
      sanitizeCollection({ levels: {}, equipped: { hero: "shanshan" } }).equipped.hero
    ).toBe("duoduo");
    expect(
      sanitizeCollection({ levels: { shanshan: 2 }, equipped: { hero: "shanshan" } }).equipped.hero
    ).toBe("shanshan");
  });

  it("坏存档降级之后照样能正常解锁,不会把面板卡死", () => {
    const { store, wallet } = makeStore(500, { [COLLECTION_KEY]: "☂☂☂" });
    expect(store.unlock("shoes-cloud").ok).toBe(true);
    expect(wallet.balance).toBe(500 - unlockCost(itemById("shoes-cloud")!));
  });
});

// ---------------------------------------------------------------------------
// 7. 序列化往返与存储降级
// ---------------------------------------------------------------------------

describe("序列化往返", () => {
  it("存进去再读出来,收藏和穿戴一模一样", () => {
    const { store, storage } = makeStore(5000);
    for (const id of ["yunyun", "jiujiu", "hat-crown", "goggles-night"]) {
      store.unlock(id);
      store.equip(id);
    }
    store.upgrade("jiujiu");
    const before = store.snapshot();
    const revived = new CollectionStore(makeWallet(0), storage);
    expect(revived.snapshot()).toEqual(before);
    expect(revived.bonus()).toEqual(store.bonus());
  });

  it("同一份收藏永远写出同一段文本(key 排过序)", () => {
    const a = sanitizeCollection({
      levels: { xingxing: 1, duoduo: 2, "shoes-cloud": 1 },
      equipped: { hero: "duoduo", shoes: "shoes-cloud" }
    });
    const b = sanitizeCollection({
      levels: { "shoes-cloud": 1, duoduo: 2, xingxing: 1 },
      equipped: { shoes: "shoes-cloud", hero: "duoduo" }
    });
    expect(serializeCollection(a)).toBe(serializeCollection(b));
    expect(parseCollection(serializeCollection(a))).toEqual(a);
  });

  it("restore 能把一段文本吃回去,坏文本则整体降级", () => {
    const { store } = makeStore(5000);
    store.unlock("dundun");
    store.equip("dundun");
    const text = store.serialize();
    store.resetAll();
    expect(store.equippedId("hero")).toBe("duoduo");
    store.restore(text);
    expect(store.equippedId("hero")).toBe("dundun");
    store.restore("坏掉的文本");
    expect(store.snapshot()).toEqual(defaultCollection());
  });

  it("清空收藏不会动星星钱包", () => {
    const { store, wallet } = makeStore(500);
    store.unlock("nuonuo");
    const after = wallet.balance;
    store.resetAll();
    expect(wallet.balance).toBe(after);
    expect(store.isUnlocked("nuonuo")).toBe(false);
  });
});

describe("存储降级", () => {
  it("隐私模式下 localStorage 一读写就抛,收藏册退回内存照样能用", () => {
    (globalThis as { localStorage?: unknown }).localStorage = makeHostileStorage();
    const wallet = makeWallet(500);
    const store = new CollectionStore(wallet);
    expect(store.snapshot()).toEqual(defaultCollection());
    expect(store.unlock("shoes-spring").ok).toBe(true);
    expect(store.getLevel("shoes-spring")).toBe(1);
    expect(store.equip("shoes-spring")).toBe(true);
  });

  it("写盘失败也不影响这一局的解锁", () => {
    const wallet = makeWallet(500);
    const flaky: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      }
    };
    const store = new CollectionStore(wallet, flaky);
    expect(store.unlock("hat-straw").ok).toBe(true);
    expect(store.getLevel("hat-straw")).toBe(1);
    store.resetAll();
    expect(store.isUnlocked("hat-straw")).toBe(false);
  });

  it("钱包读余额抛异常时当成 0 颗星,不解锁也不崩", () => {
    const broken: Wallet = {
      getStars() {
        throw new Error("wallet down");
      },
      addStars: () => 0
    };
    const store = new CollectionStore(broken, makeStorage());
    expect(store.stars()).toBe(0);
    expect(store.unlock("dingding").reason).toBe("poor");
  });
});

// ---------------------------------------------------------------------------
// 8. 订阅与文案
// ---------------------------------------------------------------------------

describe("订阅变化", () => {
  it("解锁 / 升级 / 试穿都会通知订阅方,退订之后不再通知", () => {
    const { store } = makeStore(5000);
    let hits = 0;
    const off = store.onChange(() => {
      hits += 1;
    });
    store.unlock("shoes-cloud");
    store.equip("shoes-cloud");
    store.upgrade("shoes-cloud");
    expect(hits).toBe(3);
    off();
    store.unlock("hat-straw");
    expect(hits).toBe(3);
  });
});

describe("加成文案", () => {
  it("千分之一转成好读的百分比", () => {
    expect(formatPermille(0)).toBe("0%");
    expect(formatPermille(66)).toBe("6.6%");
    expect(formatPermille(240)).toBe("24%");
    expect(formatPermille(Number.NaN)).toBe("0%");
  });

  it("卡片上的加成文字会随等级一起变大", () => {
    const item = itemById("shoes-cloud")!;
    expect(describeStats(item, 1)).toBe("速度 +0.8%");
    expect(describeStats(item, MAX_LEVEL)).toBe("速度 +2.4%");
  });

  it("一次性被动写成人话,没有加成的也有一句话兜底", () => {
    expect(describeStats(itemById("mianmian")!, 1)).toBe("摔倒后能接住一次");
    expect(describeStats(itemById("paopao")!, MAX_LEVEL)).toContain("起步无敌 2.4 秒");
    expect(describeStats({ ...itemById("paopao")!, perk: undefined }, 1)).toBe("陪你一起跑");
  });
});

describe("全局单例", () => {
  it("直接用全局收藏册也能拿到一整套乘数", () => {
    const fx = collection.effects();
    for (const mul of [fx.speedMul, fx.jumpMul, fx.magnetMul, fx.coinMul, fx.luckMul]) {
      expect(mul).toBeGreaterThanOrEqual(1);
      expect(mul).toBeLessThanOrEqual(1 + BONUS_CAP_PERMILLE / 1000);
    }
  });
});
