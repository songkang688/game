/**
 * 朵朵大战星星 —— 内容体检 + 文案红线巡检。
 *
 * 一半是数据体检（角色 / 场地 / 道具的表填得对不对），
 * 一半是把整个游戏目录里**所有会被孩子看见的中文**（连注释一起）过一遍筛子：
 *  1. 不许出现流血、受伤、死亡一类的说法——这一款根本不扣血，被撞中只有弹飞和转圈；
 *  2. 不许蹭任何商业商标或别家的官方角色名；
 *  3. 出场的只能是本作原创的那十几位好朋友。
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AI_TIERS, AI_ORDER, aiPowerBonus } from "./ai";
import { ATTACKS } from "./battle";
import {
  ITEMS,
  emptyBuffs,
  extraAirJumps,
  fallMul,
  itemById,
  jumpMul,
  powerMul,
  rollItem,
  speedMul,
  tickBuffs,
  weightMul,
} from "./items";
import { CHAPTERS, LEVELS } from "./levels";
import { meta } from "./meta";
import { ROSTER, TEAM_NAMES, fighterAt, fighterById } from "./roster";
import { STAGES, WORLD_H, WORLD_W, platformAt, stageAt, stageById, syrupLevel } from "./stages";

/* ------------------------------------------------------------------ */
/* 筛子                                                                */
/* ------------------------------------------------------------------ */

/** 流血 / 受伤 / 死亡一类的字眼，一个都不许进这个目录 */
const HURT_WORDS = [
  "血",
  "死",
  "杀",
  "尸",
  "受伤",
  "伤害",
  "阵亡",
  "牺牲",
  "重伤",
  "残",
  "疼",
  "痛",
  "打死",
  "消灭",
  "干掉",
  "暴力",
  "烫",
  "灼",
  "烧伤",
];

/** 商业商标与别家的官方角色名 */
const BRAND_WORDS = [
  "宝可梦",
  "皮卡丘",
  "马里奥",
  "马力欧",
  "塞尔达",
  "奥特曼",
  "迪士尼",
  "米老鼠",
  "海绵宝宝",
  "喜羊羊",
  "灰太狼",
  "光头强",
  "熊大",
  "哆啦",
  "多啦",
  "柯南",
  "火影",
  "鸣人",
  "蜡笔小新",
  "王者荣耀",
  "原神",
  "我的世界",
  "植物大战僵尸",
  "愤怒的小鸟",
  "冰雪奇缘",
  "变形金刚",
  "钢铁侠",
  "蜘蛛侠",
  "小猪佩奇",
  "巴啦啦",
  "叶罗丽",
  "赛尔号",
  "洛克王国",
  "大乱斗",
  "明星大乱斗",
  "kirby",
  "sonic",
  "mario",
  "zelda",
  "pokemon",
  "pikachu",
  "disney",
  "minecraft",
  "roblox",
  "smash bros",
];

function checkCopy(where: string, text: string): void {
  for (const bad of HURT_WORDS) {
    expect(`${where}｜${text}`).not.toContain(bad);
  }
  const low = text.toLowerCase();
  for (const bad of BRAND_WORDS) {
    expect(`${where}｜${low}`).not.toContain(bad.toLowerCase());
  }
}

/* ------------------------------------------------------------------ */
/* 1. 出场名单                                                          */
/* ------------------------------------------------------------------ */

describe("出场名单", () => {
  it("至少十位好朋友，而且都是本作原创角色", () => {
    const CAST = [
      "朵朵",
      "星星",
      "糯糯",
      "云云",
      "墩墩",
      "闪闪",
      "绿绿豆",
      "啾啾",
      "泡泡",
      "团团",
      "麦麦",
      "灯灯",
    ];
    expect(ROSTER.length).toBeGreaterThanOrEqual(10);
    for (const f of ROSTER) expect(CAST).toContain(f.name);
  });

  it("id 与名字都不重复", () => {
    expect(new Set(ROSTER.map((f) => f.id)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((f) => f.name)).size).toBe(ROSTER.length);
  });

  it("每个人的数值都在合理范围内", () => {
    for (const f of ROSTER) {
      expect(f.weight).toBeGreaterThanOrEqual(60);
      expect(f.weight).toBeLessThanOrEqual(150);
      expect(f.speed).toBeGreaterThan(0.7);
      expect(f.speed).toBeLessThan(1.4);
      expect(f.jump).toBeGreaterThan(0.7);
      expect(f.jump).toBeLessThan(1.4);
      expect(f.power).toBeGreaterThan(0.7);
      expect(f.power).toBeLessThan(1.4);
      expect(f.airJumps).toBeGreaterThanOrEqual(1);
      expect(f.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("轻的跳得高、沉的力气大：不是一堆换皮角色", () => {
    const lightest = ROSTER.reduce((a, b) => (a.weight <= b.weight ? a : b));
    const heaviest = ROSTER.reduce((a, b) => (a.weight >= b.weight ? a : b));
    expect(lightest.jump).toBeGreaterThan(heaviest.jump);
    expect(heaviest.power).toBeGreaterThan(lightest.power);
    expect(new Set(ROSTER.map((f) => f.weight)).size).toBeGreaterThan(6);
  });

  it("按 id / 下标都能取到人，越界会自动绕回来", () => {
    expect(fighterById("xingxing").name).toBe("星星");
    expect(fighterById("查无此人").name).toBe("朵朵");
    expect(fighterAt(0)).toBe(ROSTER[0]);
    expect(fighterAt(ROSTER.length)).toBe(ROSTER[0]);
    expect(fighterAt(-1)).toBe(ROSTER[ROSTER.length - 1]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. 场地                                                              */
/* ------------------------------------------------------------------ */

describe("场地", () => {
  it("至少八张场地，id 不重复", () => {
    expect(STAGES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
  });

  it("每张场地都有平台、四个出生点和一圈弹飞线", () => {
    for (const s of STAGES) {
      expect(s.platforms.length).toBeGreaterThanOrEqual(3);
      expect(s.spawns.length).toBeGreaterThanOrEqual(4);
      expect(s.bounds.left).toBeLessThan(0);
      expect(s.bounds.right).toBeGreaterThan(WORLD_W);
      expect(s.bounds.top).toBeLessThan(0);
      expect(s.bounds.bottom).toBeGreaterThan(WORLD_H);
      expect(s.sky).toHaveLength(2);
    }
  });

  it("出生点都落在场地里面，不会一开局就出界", () => {
    for (const s of STAGES) {
      for (const sp of s.spawns) {
        expect(sp.x).toBeGreaterThan(s.bounds.left);
        expect(sp.x).toBeLessThan(s.bounds.right);
        expect(sp.y).toBeGreaterThan(s.bounds.top);
        expect(sp.y).toBeLessThan(s.bounds.bottom);
      }
    }
  });

  it("平台尺寸都是正的，且都在世界范围内", () => {
    for (const s of STAGES) {
      for (const p of s.platforms) {
        expect(p.w).toBeGreaterThan(40);
        expect(p.h).toBeGreaterThan(8);
        expect(p.x).toBeGreaterThan(s.bounds.left);
        expect(p.x + p.w).toBeLessThan(s.bounds.right);
      }
    }
  });

  it("四种机关（会塌 / 传送带 / 弹簧 / 冰面）都至少有一张图用到", () => {
    const has = (fn: (p: (typeof STAGES)[number]["platforms"][number]) => boolean) =>
      STAGES.some((s) => s.platforms.some(fn));
    expect(has((p) => !!p.collapse)).toBe(true);
    expect(has((p) => !!p.drift)).toBe(true);
    expect(has((p) => !!p.bounce)).toBe(true);
    expect(has((p) => !!p.ice)).toBe(true);
    expect(STAGES.some((s) => !!s.syrup)).toBe(true);
    expect(STAGES.some((s) => !!s.wind)).toBe(true);
    expect(STAGES.some((s) => s.platforms.some((p) => p.moveY || p.moveX))).toBe(true);
  });

  it("会塌的平台一定配了长回来的时间", () => {
    for (const s of STAGES) {
      for (const p of s.platforms) {
        if (!p.collapse) continue;
        expect(p.collapse).toBeGreaterThan(0.5);
        expect(p.restore ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("升降台按时间来回摆，不会越飘越远", () => {
    const p = { x: 100, y: 200, w: 100, h: 10, kind: "pass" as const, moveY: 60, period: 4 };
    const positions = [0, 1, 2, 3, 4, 8].map((t) => platformAt(p, t));
    for (const pos of positions) {
      expect(Math.abs(pos.y - 200)).toBeLessThanOrEqual(60 + 1e-6);
      expect(pos.x).toBe(100);
    }
    expect(positions[0].y).toBeCloseTo(positions[4].y, 6);
  });

  it("不会动的平台永远待在原地", () => {
    const p = { x: 10, y: 20, w: 50, h: 10, kind: "solid" as const };
    expect(platformAt(p, 0)).toEqual({ x: 10, y: 20 });
    expect(platformAt(p, 99)).toEqual({ x: 10, y: 20 });
  });

  it("咕嘟糖浆一点点涨上来，涨到上限就停住", () => {
    const pool = stageById("syrup-pool");
    const t0 = syrupLevel(pool, 0);
    const t10 = syrupLevel(pool, 10);
    const t999 = syrupLevel(pool, 999);
    expect(t10).toBeLessThan(t0);
    expect(t999).toBe(pool.syrup!.limit);
  });

  it("没有糖浆池的场地永远查不到液面", () => {
    expect(syrupLevel(stageById("cloud-square"), 50)).toBe(Number.POSITIVE_INFINITY);
  });

  it("按 id / 下标都能取到场地，越界自动绕回来", () => {
    expect(stageById("ice-lake").name).toBe("滑滑冰湖");
    expect(stageById("没有这张图")).toBe(STAGES[0]);
    expect(stageAt(STAGES.length)).toBe(STAGES[0]);
    expect(stageAt(-1)).toBe(STAGES[STAGES.length - 1]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 道具                                                              */
/* ------------------------------------------------------------------ */

describe("道具", () => {
  it("至少十种道具，id 不重复，权重都是正的", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(i.weight).toBeGreaterThan(0);
      expect(i.duration).toBeGreaterThanOrEqual(0);
      expect(i.emoji.length).toBeGreaterThan(0);
    }
  });

  it("题目要求的那几样（锤子 / 弹簧鞋 / 护盾泡泡 / 加速羽毛）都在", () => {
    for (const id of ["hammer", "springshoe", "shield", "feather"]) {
      expect(itemById(id)).not.toBeNull();
    }
    expect(itemById("这个道具不存在")).toBeNull();
  });

  it("抽道具按权重来，抽到的一定在池子里", () => {
    for (let i = 0; i < 100; i++) {
      const def = rollItem(i / 100);
      expect(ITEMS).toContain(def);
    }
    expect(rollItem(0).id).toBe(ITEMS[0].id);
    expect(rollItem(0.999999).id).toBe(ITEMS[ITEMS.length - 1].id);
  });

  it("限定池子时只会抽到池子里的道具", () => {
    for (let i = 0; i < 50; i++) {
      expect(["hammer", "shield"]).toContain(rollItem(i / 50, ["hammer", "shield"]).id);
    }
  });

  it("空池子 / 坏参数都会退回全池，不会抽出 undefined", () => {
    expect(ITEMS).toContain(rollItem(0.5, []));
    expect(ITEMS).toContain(rollItem(Number.NaN));
    expect(ITEMS).toContain(rollItem(-3));
    expect(ITEMS).toContain(rollItem(9));
  });

  it("增益倒计时会一路减到 0，不会变成负数", () => {
    let b = { ...emptyBuffs(), hammer: 1, fast: 0.3 };
    b = tickBuffs(b, 0.5);
    expect(b.hammer).toBeCloseTo(0.5, 6);
    expect(b.fast).toBe(0);
    b = tickBuffs(b, 99);
    for (const v of Object.values(b)) expect(v).toBe(0);
  });

  it("各种增益按预期改数值", () => {
    const none = emptyBuffs();
    expect(powerMul(none)).toBe(1);
    expect(powerMul({ ...none, hammer: 1 })).toBeGreaterThan(1);
    expect(speedMul({ ...none, fast: 1 })).toBeGreaterThan(1);
    expect(speedMul({ ...none, slow: 1 })).toBeLessThan(1);
    expect(speedMul({ ...none, dizzy: 1 })).toBe(0);
    expect(jumpMul({ ...none, spring: 1 })).toBeGreaterThan(1);
    expect(weightMul({ ...none, heavy: 1 })).toBeGreaterThan(1);
    expect(weightMul({ ...none, mini: 1 })).toBeLessThan(1);
    expect(extraAirJumps({ ...none, spring: 1 })).toBe(2);
    expect(fallMul({ ...none, float: 1 })).toBeLessThan(1);
  });

  it("变小同时变快又变轻：风险和收益都在", () => {
    const mini = { ...emptyBuffs(), mini: 1 };
    expect(speedMul(mini)).toBeGreaterThan(1);
    expect(weightMul(mini)).toBeLessThan(1);
  });
});

/* ------------------------------------------------------------------ */
/* 4. 小电脑三档参数                                                     */
/* ------------------------------------------------------------------ */

describe("小电脑三档参数", () => {
  it("档次越高想得越快、失误越少、越会照顾场地边缘", () => {
    const [e, n, h] = AI_ORDER.map((t) => AI_TIERS[t]);
    expect(e.think).toBeGreaterThan(n.think);
    expect(n.think).toBeGreaterThan(h.think);
    expect(e.mistake).toBeGreaterThan(n.mistake);
    expect(n.mistake).toBeGreaterThan(h.mistake);
    expect(h.ledgeCare).toBeGreaterThan(n.ledgeCare);
    expect(n.ledgeCare).toBeGreaterThan(e.ledgeCare);
  });

  it("高手档也留着反应延迟，不是零帧无敌", () => {
    expect(AI_TIERS.hard.think).toBeGreaterThan(0.05);
    expect(AI_TIERS.hard.mistake).toBeGreaterThan(0);
  });

  it("档次越高力度加成越大", () => {
    expect(aiPowerBonus("hard")).toBeGreaterThan(aiPowerBonus("normal"));
    expect(aiPowerBonus("normal")).toBeGreaterThan(aiPowerBonus("easy"));
  });

  it("重击比轻击起手慢、收招久，但力度更大打得更远", () => {
    expect(ATTACKS.heavy.windup).toBeGreaterThan(ATTACKS.light.windup);
    expect(ATTACKS.heavy.recover).toBeGreaterThan(ATTACKS.light.recover);
    expect(ATTACKS.heavy.power).toBeGreaterThan(ATTACKS.light.power);
    expect(ATTACKS.heavy.reach).toBeGreaterThan(ATTACKS.light.reach);
  });
});

/* ------------------------------------------------------------------ */
/* 5. 文案红线                                                          */
/* ------------------------------------------------------------------ */

describe("文案红线", () => {
  it("首页卡片干干净净，分类是对战", () => {
    checkCopy("meta.title", meta.title);
    checkCopy("meta.blurb", meta.blurb);
    expect(meta.id).toBe("duo-vs-star");
    expect(meta.category).toBe("party");
  });

  it("角色名字与介绍都过筛子", () => {
    for (const f of ROSTER) {
      checkCopy(`角色 ${f.name}`, f.name);
      checkCopy(`角色 ${f.name} 介绍`, f.tip);
    }
    for (const n of TEAM_NAMES) checkCopy("队名", n);
  });

  it("场地名字与介绍都过筛子，岩浆一类的写实说法一个都没有", () => {
    for (const s of STAGES) {
      checkCopy(`场地 ${s.name}`, s.name);
      checkCopy(`场地 ${s.name} 介绍`, s.blurb);
      expect(s.name).not.toContain("岩浆");
      expect(s.blurb).not.toContain("岩浆");
    }
  });

  it("道具名字与说明都过筛子", () => {
    for (const i of ITEMS) {
      checkCopy(`道具 ${i.name}`, i.name);
      checkCopy(`道具 ${i.name} 说明`, i.tip);
    }
  });

  it("188 关的章节名、规则标签与说明都过筛子", () => {
    for (const ch of CHAPTERS) {
      checkCopy(`章节 ${ch.name}`, ch.name);
      checkCopy(`章节 ${ch.name} 介绍`, ch.desc);
    }
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      if (seen.has(lv.rule)) continue;
      seen.add(lv.rule);
      checkCopy(`规则 ${lv.ruleTag}`, lv.ruleTag);
      checkCopy(`规则 ${lv.ruleTag} 说明`, lv.rule);
    }
    expect(seen.size).toBeGreaterThanOrEqual(9);
  });

  it("整个游戏目录的源码（连注释一起）都不许踩线", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const file of files) {
      checkCopy(`源码 ${file}`, readFileSync(join(dir, file), "utf8"));
    }
  });

  it("源码里没有掉血 / 血条一类的机制词，这一款本来就不扣血", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of files) {
      const text = readFileSync(join(dir, file), "utf8");
      for (const bad of ["hp", "HP", "血条", "生命值", "扣血"]) {
        expect(`${file}｜${text}`).not.toContain(bad);
      }
    }
  });
});
