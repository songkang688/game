/**
 * 勇者小路 —— 文案红线巡检。
 *
 * 这一份不测玩法，只把游戏里**所有会被孩子看见的中文**扒出来过一遍筛子：
 *  1. 不许出现流血、受伤、死亡一类的说法（被打中只写星星飞溅 / 转圈圈 / 弹开）；
 *  2. 不许蹭任何商业商标或别家的官方角色名；
 *  3. 名字只用本作原创的那几位。
 *
 * 以后谁再往表里加一件装备、一位首领、一句战斗播报，这里都会自动帮他检查一遍。
 */
import { describe, expect, it } from "vitest";
import {
  ITEMS,
  SKILLS,
  affinityHint,
  makeFighter,
  simulateBattle,
  type CombatEvent,
  type Element,
  type FighterSpec
} from "./combat";
import { BOSSES, CHAPTERS, buildLevel, makeBossSpec, makeFoeSpec } from "./levels";
import {
  BLESSING_EVERY,
  COMPANIONS,
  GEARS,
  HERO_NAME,
  SKILL_UNLOCKS,
  applyBlessing,
  endlessEndText,
  rollBlessings
} from "./logic";
import { meta } from "./meta";

/* ------------------------------------------------------------------ */
/* 筛子                                                                */
/* ------------------------------------------------------------------ */

/** 流血 / 受伤 / 死亡一类的字眼，一个都不许进可见文案 */
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
  "毒打",
  "打死",
  "消灭",
  "干掉",
  "暴力"
];

/** 商业商标与别家官方角色名 */
const BRAND_WORDS = [
  "宝可梦",
  "皮卡丘",
  "精灵球",
  "马里奥",
  "马力欧",
  "塞尔达",
  "奥特曼",
  "迪士尼",
  "米老鼠",
  "小马宝莉",
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
  "汤姆猫",
  "冰雪奇缘",
  "艾莎",
  "变形金刚",
  "钢铁侠",
  "蜘蛛侠",
  "小猪佩奇",
  "佩奇",
  "巴啦啦",
  "叶罗丽",
  "赛尔号",
  "洛克王国",
  "泡泡堂",
  "kirby",
  "sonic",
  "mario",
  "zelda",
  "pokemon",
  "pikachu",
  "disney",
  "minecraft",
  "roblox",
  "digimon"
];

/** 把一段可见文案拿去过筛子，出问题时报出来源，方便定位 */
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
/* 1. 静态文案表                                                        */
/* ------------------------------------------------------------------ */

describe("文案红线 · 静态表", () => {
  it("首页卡片的标题与介绍干干净净", () => {
    checkCopy("meta.title", meta.title);
    checkCopy("meta.blurb", meta.blurb);
    expect(meta.category).toBe("action");
  });

  it("八个章节的名字和介绍都过筛子", () => {
    expect(CHAPTERS).toHaveLength(8);
    for (const c of CHAPTERS) {
      checkCopy(`章节 ${c.name}`, c.name);
      checkCopy(`章节 ${c.name} 简介`, c.desc);
    }
  });

  it("八位首领的名字、大招名、提示都过筛子", () => {
    expect(BOSSES).toHaveLength(8);
    for (const b of BOSSES) {
      checkCopy(`首领 ${b.name}`, b.name);
      checkCopy(`首领 ${b.name} 大招`, b.chargeName);
      checkCopy(`首领 ${b.name} 提示`, b.tip);
    }
  });

  it("所有招式的名字和说明都过筛子", () => {
    const all = Object.values(SKILLS);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      checkCopy(`招式 ${s.name}`, s.name);
      checkCopy(`招式 ${s.name} 说明`, s.desc);
    }
  });

  it("所有道具的名字和说明都过筛子", () => {
    const all = Object.values(ITEMS);
    expect(all.length).toBeGreaterThan(0);
    for (const i of all) {
      checkCopy(`道具 ${i.name}`, i.name);
      checkCopy(`道具 ${i.name} 说明`, i.desc);
    }
  });

  it("所有装备的名字都过筛子", () => {
    expect(GEARS.length).toBeGreaterThan(0);
    for (const g of GEARS) checkCopy(`装备 ${g.name}`, g.name);
  });

  it("技能解锁提示与同伴介绍都过筛子", () => {
    expect(SKILL_UNLOCKS.length).toBeGreaterThan(0);
    for (const u of SKILL_UNLOCKS) {
      const def = SKILLS[u.id];
      expect(def, `技能解锁表里的 ${u.id} 应该能在招式表里查到`).toBeTruthy();
      checkCopy(`解锁 ${u.id}`, def.name);
      checkCopy(`解锁 ${u.id} 说明`, def.desc);
    }
    for (const c of COMPANIONS) {
      checkCopy(`同伴 ${c.name}`, c.name);
      checkCopy(`同伴 ${c.name} 介绍`, c.desc);
    }
  });

  it("属性克制的三句提示语都过筛子", () => {
    const els: Element[] = ["fire", "water", "grass", "light", "dark"];
    for (const a of els) {
      for (const d of els) checkCopy(`克制提示 ${a}->${d}`, affinityHint(a, d));
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. 角色名单                                                          */
/* ------------------------------------------------------------------ */

describe("文案红线 · 角色只用本作原创的那几位", () => {
  const CAST = ["鸭梨", "康康", "糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾"];

  it("主角是鸭梨", () => {
    expect(HERO_NAME).toBe("鸭梨");
    expect(CAST).toContain(HERO_NAME);
  });

  it("同伴全部出自本作角色名单", () => {
    expect(COMPANIONS.length).toBeGreaterThan(0);
    for (const c of COMPANIONS) expect(CAST).toContain(c.name);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 跑出来的动态文案                                                  */
/* ------------------------------------------------------------------ */

describe("文案红线 · 打起来之后冒出的话", () => {
  function fighter(over: Partial<FighterSpec> = {}) {
    return makeFighter({
      name: "鸭梨",
      emoji: "🍐",
      element: "grass",
      maxHp: 130,
      atk: 28,
      def: 9,
      spd: 12,
      crit: 0.2,
      skills: [
        { id: "petalSlash", rank: 2 },
        { id: "sunnyWarmth", rank: 1 }
      ],
      bag: [{ id: "berry", count: 2 }],
      ...over
    });
  }

  it("跑满八章的小怪与首领战，几千条播报没有一句踩线", () => {
    const events: CombatEvent[] = [];
    for (let ch = 0; ch < CHAPTERS.length; ch++) {
      const level = CHAPTERS.slice(0, ch).reduce((n, c) => n + c.size, 0);
      for (const tier of ["normal", "elite"] as const) {
        for (let seed = 0; seed < 6; seed++) {
          const res = simulateBattle(fighter(), makeFighter(makeFoeSpec(level + 2, tier, seed)), seed + 1);
          events.push(...res.events);
        }
      }
      const bossLevel = CHAPTERS.slice(0, ch + 1).reduce((n, c) => n + c.size, 0) - 1;
      for (let seed = 0; seed < 4; seed++) {
        const res = simulateBattle(fighter({ maxHp: 900, atk: 90 }), makeFighter(makeBossSpec(bossLevel)), seed + 9);
        events.push(...res.events);
      }
    }
    expect(events.length).toBeGreaterThan(500);
    const seen = new Set<string>();
    for (const e of events) {
      if (seen.has(e.text)) continue;
      seen.add(e.text);
      checkCopy("战斗播报", e.text);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it("星芒见底那一刻，赢和输说的都是卡通话：让开小路 / 坐下歇口气", () => {
    const weak: FighterSpec = {
      name: "蹦蹦草团",
      emoji: "🌱",
      element: "grass",
      maxHp: 40,
      atk: 3,
      def: 0,
      spd: 1,
      crit: 0,
      skills: []
    };
    const won = simulateBattle(fighter({ maxHp: 1200, atk: 120 }), makeFighter(weak), 5);
    const wonLast = won.events[won.events.length - 1];
    expect(won.winner).toBe("hero");
    expect(wonLast.text).toContain("让开了小路");
    checkCopy("赢下来的收尾播报", wonLast.text);

    const lost = simulateBattle(
      fighter({ maxHp: 30, atk: 1, skills: [], bag: [] }),
      makeFighter({ ...weak, name: "咚咚石团", maxHp: 900, atk: 90, spd: 99 }),
      5
    );
    const lostLast = lost.events[lost.events.length - 1];
    expect(lost.winner).toBe("foe");
    expect(lostLast.text).toContain("歇口气");
    checkCopy("没打过的收尾播报", lostLast.text);
  });

  it("无尽深渊的结算只说回城休息，深浅两种说法都干净", () => {
    for (const [depth, best] of [
      [1, 0],
      [3, 3],
      [7, 12],
      [25, 25],
      [60, 61]
    ] as const) {
      const text = endlessEndText(depth, best);
      checkCopy(`无尽结算 第${depth}层`, text);
      expect(text).toContain("回城");
    }
  });

  it("无尽深渊的祝福文案也过筛子，而且一路挑下去角色不会散架", () => {
    let carry = fighter();
    for (let floor = BLESSING_EVERY; floor <= BLESSING_EVERY * 6; floor += BLESSING_EVERY) {
      const picks = rollBlessings(floor);
      expect(picks.length).toBeGreaterThan(0);
      for (const b of picks) {
        checkCopy(`祝福 ${b.name}`, b.name);
        checkCopy(`祝福 ${b.name} 说明`, b.desc);
      }
      carry = applyBlessing(carry, picks[0]);
      expect(carry.maxHp).toBeGreaterThan(0);
      expect(carry.hp).toBeLessThanOrEqual(carry.maxHp);
    }
  });

  it("188 关的小路上，每个格子的说明文字都过筛子", () => {
    let nodes = 0;
    for (let level = 0; level < 188; level++) {
      const plan = buildLevel(level);
      checkCopy(`第 ${level + 1} 关章节名`, CHAPTERS[plan.chapterIndex].name);
      checkCopy(`第 ${level + 1} 关目标`, plan.goalText);
      for (const step of plan.steps) {
        for (const node of step) {
          nodes += 1;
          checkCopy(`第 ${level + 1} 关格子`, node.label);
          if (node.foe) checkCopy(`第 ${level + 1} 关对手`, node.foe.name);
        }
      }
    }
    expect(nodes).toBeGreaterThan(188 * 3);
  });
});
