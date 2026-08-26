import { describe, expect, it } from "vitest";
import {
  BUILD_COLS,
  CHAPTER_BOSSES,
  COMMANDER_ENERGY_CAP,
  FROST_SECONDS,
  FROST_SLOW,
  HERO_BASE_DAMAGE,
  HERO_BASE_RELOAD,
  LANES,
  MONSTER_COLOR,
  MONSTER_EMOJI,
  MONSTER_INFO,
  MONSTER_THREAT,
  NORMAL_KINDS,
  POP_EMOJI,
  PASSIVE_PAINT_EVERY,
  SCENE_H,
  SCENE_W,
  TECH_LINES,
  TECH_MAX,
  TOWER_EMOJI,
  TOWER_INFO,
  TOWER_KINDS,
  applyHit,
  blastDamage,
  blastTargets,
  campaignStars,
  canBuildOn,
  canCommand,
  canHit,
  chewDamage,
  chewInterval,
  clamp,
  clampPaint,
  colAtX,
  colX,
  commanderCost,
  commanderDeck,
  commanderRegen,
  coopLine,
  emptyTech,
  endlessLine,
  fieldHeightBudget,
  fieldSize,
  formatClock,
  heroDamage,
  heroReload,
  heroSpeed,
  jarInterval,
  laneAtRatio,
  loseLine,
  monsterArmor,
  monsterHp,
  monsterSpeed,
  mulberry32,
  paintCap,
  paintInterval,
  reachesTower,
  splitChildren,
  techCost,
  towerDamage,
  towerDamageMult,
  towerRefund,
  towersUnlockedAt,
  versusLine,
  versusWinner,
  waveSpawnSpan,
  willJump,
  winLine,
} from "./logic";

describe("场地几何", () => {
  it("列号与 x 坐标能来回换算", () => {
    for (let col = 0; col < BUILD_COLS; col++) {
      expect(colAtX(colX(col))).toBe(col);
    }
  });

  it("建造区外的 x 不属于任何一列", () => {
    expect(colAtX(0)).toBe(-1);
    expect(colAtX(9.6)).toBe(-1);
  });

  it("归一化纵坐标落在合法车道里", () => {
    expect(laneAtRatio(0)).toBe(0);
    expect(laneAtRatio(0.99)).toBe(LANES - 1);
    expect(laneAtRatio(-3)).toBe(0);
    expect(laneAtRatio(7)).toBe(LANES - 1);
  });

  it("clamp 把值夹在范围里", () => {
    expect(clamp(-1, 0, 4)).toBe(0);
    expect(clamp(9, 0, 4)).toBe(4);
    expect(clamp(2.5, 0, 4)).toBe(2.5);
  });
});

describe("画面尺寸", () => {
  it("手机竖屏上战场顶多占两成多高,下面留得住虚拟方向盘", () => {
    // 375×667 是最挤的一块屏:状态条 + 建筑栏 + 战场 + 方向盘要一屏塞下,
    // 战场吃过头,方向盘就被挤出舞台(舞台 overflow:hidden,挤出去就点不到)
    const budget = fieldHeightBudget(375, 667);
    expect(budget).toBeLessThanOrEqual(667 * 0.23);
    expect(budget).toBeGreaterThan(120);
  });

  it("宽屏放得开,战场能占到三成半以上", () => {
    expect(fieldHeightBudget(1280, 800)).toBeGreaterThan(fieldHeightBudget(375, 800));
    expect(fieldHeightBudget(1280, 800)).toBeGreaterThan(800 * 0.35);
  });

  it("再高的屏也不会把画布拉过原始尺寸", () => {
    expect(fieldHeightBudget(1920, 4000)).toBe(SCENE_H);
  });

  it("矮屏也留得住一块看得清的战场", () => {
    expect(fieldHeightBudget(320, 300)).toBeGreaterThanOrEqual(120);
  });

  it("量不到视口高度时给个稳妥的默认值", () => {
    expect(fieldHeightBudget(375, 0)).toBeGreaterThan(120);
  });

  it("缩放后长宽比始终不变形", () => {
    for (const [w, h, avail] of [
      [375, 667, 317],
      [768, 1024, 700],
      [1280, 800, 660],
      [1920, 1080, 900],
    ]) {
      const size = fieldSize(avail, w, h);
      expect(Math.abs(size.w / size.h - SCENE_W / SCENE_H)).toBeLessThan(0.02);
    }
  });

  it("战场不会超出可用宽度,也不会超过原始画布", () => {
    expect(fieldSize(317, 375, 667).w).toBeLessThanOrEqual(317);
    expect(fieldSize(5000, 1920, 4000).w).toBe(SCENE_W);
  });

  it("屏幕越高战场越大,但一直守着高度预算", () => {
    const short = fieldSize(660, 1280, 600);
    const tall = fieldSize(660, 1280, 900);
    expect(tall.h).toBeGreaterThan(short.h);
    expect(short.h).toBeLessThanOrEqual(fieldHeightBudget(1280, 600));
    expect(tall.h).toBeLessThanOrEqual(fieldHeightBudget(1280, 900));
  });
});

describe("确定性随机", () => {
  it("同一个种子每次都给同一串数", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("不同种子给的数不一样", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("建筑", () => {
  it("每种建筑都有中文名、说明和正价", () => {
    for (const kind of TOWER_KINDS) {
      const spec = TOWER_INFO[kind];
      expect(spec.name.length).toBeGreaterThan(1);
      expect(spec.desc.length).toBeGreaterThan(3);
      expect(spec.cost).toBeGreaterThan(0);
      expect(spec.hp).toBeGreaterThan(0);
      expect(TOWER_EMOJI[kind]).toBeTruthy();
    }
  });

  it("收起建筑退一半颜料(向上取整)", () => {
    expect(towerRefund("wall")).toBe(1);
    expect(towerRefund("beam")).toBe(4);
    for (const kind of TOWER_KINDS) {
      expect(towerRefund(kind)).toBeLessThanOrEqual(TOWER_INFO[kind].cost);
    }
  });

  it("解锁顺序:开局三件套,后面一章一件,越往后越全", () => {
    expect(towersUnlockedAt(0).sort()).toEqual(["jar", "pop", "wall"]);
    expect(towersUnlockedAt(1)).toContain("boom");
    expect(towersUnlockedAt(2)).toContain("frost");
    expect(towersUnlockedAt(3)).toContain("beam");
    for (let ci = 1; ci < 8; ci++) {
      expect(towersUnlockedAt(ci).length).toBeGreaterThanOrEqual(towersUnlockedAt(ci - 1).length);
    }
    expect(towersUnlockedAt(7).length).toBe(TOWER_KINDS.length);
  });

  it("占住的格、花坛格、场外格都摆不了东西", () => {
    expect(canBuildOn(3, 2, false, false)).toBe(true);
    expect(canBuildOn(3, 2, true, false)).toBe(false);
    expect(canBuildOn(3, 2, false, true)).toBe(false);
    expect(canBuildOn(-1, 2, false, false)).toBe(false);
    expect(canBuildOn(BUILD_COLS, 2, false, false)).toBe(false);
    expect(canBuildOn(3, LANES, false, false)).toBe(false);
    expect(canBuildOn(1.5, 2, false, false)).toBe(false);
  });
});

describe("小怪物属性", () => {
  it("每种小怪物都有中文名、颜色、图标和「变成什么」", () => {
    for (const kind of Object.keys(MONSTER_INFO) as Array<keyof typeof MONSTER_INFO>) {
      expect(MONSTER_INFO[kind].name.length).toBeGreaterThan(1);
      expect(MONSTER_INFO[kind].becomes.length).toBeGreaterThan(1);
      expect(MONSTER_COLOR[kind]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(MONSTER_EMOJI[kind]).toBeTruthy();
      expect(POP_EMOJI[kind]).toBeTruthy();
      expect(MONSTER_THREAT[kind]).toBeGreaterThan(0);
    }
  });

  it("血量随关号变厚,但一直是有限的", () => {
    expect(monsterHp("doodle", 0)).toBe(MONSTER_INFO.doodle.hp);
    expect(monsterHp("doodle", 100)).toBeGreaterThan(monsterHp("doodle", 0));
    expect(monsterHp("doodle", 187)).toBeLessThan(MONSTER_INFO.doodle.hp + 20);
    expect(monsterHp("doodle", -5)).toBe(MONSTER_INFO.doodle.hp);
  });

  it("大怪不吃关号加成(不然后期会变成算不过来的死局)", () => {
    for (const boss of CHAPTER_BOSSES) {
      expect(monsterHp(boss, 187)).toBe(MONSTER_INFO[boss].hp);
      expect(monsterArmor(boss, 187)).toBe(MONSTER_INFO[boss].armor);
    }
  });

  it("没壳的小怪物永远不会凭空长出壳", () => {
    expect(monsterArmor("doodle", 187)).toBe(0);
    expect(monsterArmor("pumpkin", 187)).toBeGreaterThan(MONSTER_INFO.pumpkin.armor);
  });

  it("大怪一章比一章壮", () => {
    for (let i = 1; i < CHAPTER_BOSSES.length; i++) {
      expect(MONSTER_INFO[CHAPTER_BOSSES[i]].hp).toBeGreaterThan(MONSTER_INFO[CHAPTER_BOSSES[i - 1]].hp);
    }
  });

  it("普通名单里没有混进大怪", () => {
    expect(NORMAL_KINDS.every((k) => !MONSTER_INFO[k].boss)).toBe(true);
    expect(CHAPTER_BOSSES.every((k) => MONSTER_INFO[k].boss)).toBe(true);
    expect(CHAPTER_BOSSES.length).toBe(8);
  });
});

describe("战斗结算", () => {
  it("泡泡和冰沙够不着天上的,颜料弹和彩虹光什么都糊得到", () => {
    expect(canHit("bubble", true)).toBe(false);
    expect(canHit("ice", true)).toBe(false);
    expect(canHit("paint", true)).toBe(true);
    expect(canHit("beam", true)).toBe(true);
    for (const proj of ["bubble", "ice", "paint", "beam"] as const) {
      expect(canHit(proj, false)).toBe(true);
    }
  });

  it("颜料先糊外壳,壳花了才染到本体", () => {
    const first = applyHit({ hp: 10, armor: 5 }, 3);
    expect(first).toEqual({ hp: 10, armor: 2, shellOff: false, popped: false });
    const second = applyHit({ hp: 10, armor: 2 }, 6);
    expect(second.armor).toBe(0);
    expect(second.hp).toBe(6);
    expect(second.shellOff).toBe(true);
    expect(second.popped).toBe(false);
  });

  it("血糊光就算变成花花了", () => {
    expect(applyHit({ hp: 2, armor: 0 }, 5).popped).toBe(true);
    expect(applyHit({ hp: 2, armor: 0 }, 1).popped).toBe(false);
  });

  it("负数伤害不会给小怪物回血", () => {
    const r = applyHit({ hp: 5, armor: 1 }, -4);
    expect(r.hp).toBe(5);
    expect(r.armor).toBe(1);
  });

  it("冰沙没化时走路变慢", () => {
    expect(monsterSpeed(1, 0)).toBe(1);
    expect(monsterSpeed(1, FROST_SECONDS)).toBeCloseTo(FROST_SLOW);
    expect(FROST_SLOW).toBeLessThan(1);
  });

  it("大怪啃得又快又猛", () => {
    expect(chewDamage(true)).toBeGreaterThan(chewDamage(false));
    expect(chewInterval(true)).toBeLessThan(chewInterval(false));
  });

  it("走到建筑跟前才停下来啃", () => {
    expect(reachesTower(colX(3) + 0.1, 3)).toBe(true);
    expect(reachesTower(colX(3) + 1.2, 3)).toBe(false);
  });

  it("爆米花只波及同一条道上的地面小怪物", () => {
    const list = [
      { x: colX(3), lane: 1, flying: false },
      { x: colX(3) + 1, lane: 1, flying: false },
      { x: colX(3), lane: 2, flying: false },
      { x: colX(3), lane: 1, flying: true },
      { x: colX(3) + 5, lane: 1, flying: false },
    ];
    const hit = blastTargets(list, 3, 1, 1.7);
    expect(hit).toHaveLength(2);
    expect(hit.every((m) => m.lane === 1 && !m.flying)).toBe(true);
  });

  it("果冻怪分裂出两只涂涂怪,别的不分裂", () => {
    expect(splitChildren("jelly")).toEqual(["doodle", "doodle"]);
    expect(splitChildren("doodle")).toEqual([]);
  });

  it("跳跳怪只肯蹦一次", () => {
    expect(willJump("hopper", false)).toBe(true);
    expect(willJump("hopper", true)).toBe(false);
    expect(willJump("doodle", false)).toBe(false);
  });
});

describe("颜料经济与三条科技线", () => {
  it("科技价格递增,满级之后买不动", () => {
    for (const line of TECH_LINES) {
      let prev = 0;
      for (let lv = 0; lv < TECH_MAX; lv++) {
        const cost = techCost(line, lv);
        expect(cost).toBeGreaterThan(prev);
        prev = cost;
      }
      expect(techCost(line, TECH_MAX)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("新开一局三条线都是 0 级", () => {
    expect(emptyTech()).toEqual({ paint: 0, tower: 0, hero: 0 });
  });

  it("颜料线让颜料攒得更快、罐子装得更多", () => {
    expect(paintInterval(0)).toBe(PASSIVE_PAINT_EVERY);
    expect(paintInterval(5)).toBeLessThan(paintInterval(0));
    expect(jarInterval(5)).toBeLessThan(jarInterval(0));
    expect(paintCap(5)).toBeGreaterThan(paintCap(0));
  });

  it("颜料不会超过上限也不会变成负数", () => {
    expect(clampPaint(999, paintCap(0))).toBe(paintCap(0));
    expect(clampPaint(-8, paintCap(0))).toBe(0);
    expect(clampPaint(7.4, paintCap(0))).toBe(7);
  });

  it("炮台线给所有炮台加伤害", () => {
    expect(towerDamageMult(0)).toBe(1);
    expect(towerDamageMult(5)).toBeGreaterThan(1);
    expect(towerDamage("pop", 5)).toBeGreaterThan(towerDamage("pop", 0));
    expect(towerDamage("wall", 5)).toBe(0);
    expect(blastDamage(5)).toBeGreaterThan(blastDamage(0));
  });

  it("主角线让主角更狠、更快", () => {
    expect(heroDamage(0)).toBe(HERO_BASE_DAMAGE);
    expect(heroDamage(5)).toBeGreaterThan(heroDamage(0));
    expect(heroReload(0)).toBe(HERO_BASE_RELOAD);
    expect(heroReload(5)).toBeLessThan(heroReload(0));
    expect(heroReload(5)).toBeGreaterThan(0);
    expect(heroSpeed(5)).toBeGreaterThan(heroSpeed(0));
  });
});

describe("评星与文案", () => {
  it("一罐没丢三星,丢一罐两星,再多一星", () => {
    expect(campaignStars(3, 3)).toBe(3);
    expect(campaignStars(2, 3)).toBe(2);
    expect(campaignStars(1, 3)).toBe(1);
    expect(campaignStars(0, 3)).toBe(1);
  });

  it("时间显示成 0:08 这样的钟点", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(8)).toBe("0:08");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(-4)).toBe("0:00");
  });

  it("过关的话按丢了几罐说不同的夸奖", () => {
    const perfect = winLine(3, 3, 12);
    expect(perfect).toContain("一罐");
    expect(perfect).toContain("12");
    expect(winLine(2, 3, 12)).not.toBe(perfect);
    expect(winLine(0, 3, 12)).not.toBe(perfect);
  });

  it("失败文案只鼓励、只给下一步,不说丧气话", () => {
    const lines = [loseLine(1, 5, -1), loseLine(3, 5, 2), loseLine(5, 5, 0)];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(8);
      expect(line).not.toMatch(/死|输了|失败|笨|没用/);
    }
    expect(lines[1]).toContain("第 3 条道");
    expect(new Set(lines).size).toBe(3);
  });

  it("无尽 / 合作 / 对战都有各自的结算话", () => {
    expect(endlessLine(9, 9)).toContain("新纪录");
    expect(endlessLine(3, 9)).toContain("9");
    expect(endlessLine(0, 5)).toContain("下一局");
    expect(coopLine(10, 10, 42)).toContain("42");
    expect(coopLine(4, 10, 12)).toContain("第 4 波");
    expect(versusLine("defender", 2, 100)).toContain("守家成功");
    expect(versusLine("commander", 0, 62)).toContain("1:02");
  });
});

describe("非对称对战", () => {
  it("守家的撑到时间就赢,颜料被搬光就是指挥官赢", () => {
    expect(versusWinner(3, 40)).toBeNull();
    expect(versusWinner(0, 40)).toBe("commander");
    expect(versusWinner(2, 0)).toBe("defender");
  });

  it("指挥官的能量越打回得越快,但有上限", () => {
    expect(commanderRegen(60)).toBeGreaterThan(commanderRegen(0));
    expect(commanderRegen(600)).toBe(commanderRegen(72));
    expect(commanderRegen(600)).toBeLessThanOrEqual(commanderRegen(0) * 2.2);
    expect(COMMANDER_ENERGY_CAP).toBeGreaterThan(commanderCost("box"));
  });

  it("越难缠的兵派出去越贵", () => {
    expect(commanderCost("box")).toBeGreaterThan(commanderCost("doodle"));
    expect(canCommand(commanderCost("doodle"), "doodle")).toBe(true);
    expect(canCommand(commanderCost("doodle") - 1, "doodle")).toBe(false);
  });

  it("能派的兵越打越多,而且全是普通小怪物", () => {
    const early = commanderDeck(0);
    const late = commanderDeck(120);
    expect(early.length).toBeGreaterThanOrEqual(2);
    expect(late.length).toBeGreaterThan(early.length);
    expect(late.every((k) => NORMAL_KINDS.includes(k))).toBe(true);
  });
});

describe("波次工具", () => {
  it("算得出一波从头到最后一只出场要多久", () => {
    expect(
      waveSpawnSpan({
        spawns: [
          { time: 0.5, lane: 0, kind: "doodle" },
          { time: 4.2, lane: 1, kind: "cotton" },
        ],
        tail: 3,
      })
    ).toBe(4.2);
    expect(waveSpawnSpan({ spawns: [], tail: 3 })).toBe(0);
  });
});
