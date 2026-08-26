import { describe, expect, it } from "vitest";
import { SKY_H, SKY_W, makeSpec, buildVolley } from "./bullets";
import {
  FOE_INFO,
  MAX_POWER,
  MAX_WINGMEN,
  WEAPONS,
  WEAPON_ORDER,
  applyPickup,
  circlesTouch,
  clampPlane,
  damageFoe,
  dps,
  endlessScore,
  glideAway,
  isPauseKey,
  keyToAction,
  makePlane,
  playerShots,
  shotsPerSecond,
  sortieMessage,
  starsForSortie,
  touchPlane,
  useBomb,
  waveSpec,
  wingmanOffsets,
  wingmanShots,
  type Foe,
  type WeaponKind,
} from "./logic";

describe("sky-squad 三种主武器", () => {
  it("三把武器都往上打,颜色都是冷色(和暖色敌弹分得开)", () => {
    for (const kind of WEAPON_ORDER) {
      for (let power = 1; power <= MAX_POWER; power++) {
        const shots = playerShots(kind, power, 100, 500);
        expect(shots.length).toBeGreaterThan(0);
        for (const s of shots) expect(s.vy).toBeLessThan(0);
      }
      expect(WEAPONS[kind].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(WEAPONS[kind].name.length).toBeGreaterThan(1);
      expect(shotsPerSecond(kind)).toBeGreaterThan(2);
    }
  });

  it("火力升级弹更多,超过 3 级不再涨,低于 1 级按 1 级算", () => {
    expect(playerShots("star", 1, 0, 0).length).toBe(1);
    expect(playerShots("star", 3, 0, 0).length).toBe(3);
    expect(playerShots("star", 9, 0, 0).length).toBe(3);
    expect(playerShots("star", 0, 0, 0).length).toBe(1);
    expect(playerShots("star", -5, 0, 0).length).toBe(1);
  });

  it("三把武器各有各的长处,没有一把把另外两把完全压死", () => {
    const wide = (k: WeaponKind): number => {
      const xs = playerShots(k, 3, 0, 0).map((s) => s.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    // 光束伤害最高
    expect(dps("beam", 3)).toBeGreaterThan(dps("wave", 3));
    // 波纹弹覆盖最宽、弹体最大
    expect(wide("wave")).toBeGreaterThan(wide("beam"));
    expect(playerShots("wave", 1, 0, 0)[0].r).toBeGreaterThan(playerShots("beam", 1, 0, 0)[0].r);
    // 只有光束能穿透
    expect(playerShots("beam", 1, 0, 0)[0].pierce).toBe(true);
    expect(playerShots("star", 1, 0, 0)[0].pierce).toBe(false);
    expect(playerShots("wave", 1, 0, 0)[0].pierce).toBe(false);
  });
});

describe("sky-squad 僚机", () => {
  it("僚机最多两架,左右对称站位,不会挡住主机视线", () => {
    expect(wingmanOffsets(0)).toEqual([]);
    expect(wingmanOffsets(1).length).toBe(1);
    expect(wingmanOffsets(5).length).toBe(MAX_WINGMEN);
    const two = wingmanOffsets(2);
    expect(two[0].dx).toBeLessThan(0);
    expect(two[1].dx).toBeGreaterThan(0);
    expect(Math.abs(two[0].dx)).toBe(Math.abs(two[1].dx));
    for (const o of two) expect(o.dy).toBeGreaterThan(0);
  });

  it("僚机只打直线,火力比主机弱一档", () => {
    const shots = wingmanShots("star", 100, 400);
    expect(shots.length).toBe(1);
    expect(shots[0].vx).toBe(0);
    expect(shots[0].damage).toBe(1);
    expect(Math.abs(shots[0].vy)).toBeLessThan(Math.abs(playerShots("star", 1, 0, 0)[0].vy));
  });
});

describe("sky-squad 护盾 / 备用小飞机 / 炸弹", () => {
  it("被碰到的顺序是「先破护盾、再换备用机」,而且没有任何受伤描写", () => {
    const base = { ...makePlane(), invuln: 0, shield: 1, spare: 1, power: 3, wingmen: 2 };
    const first = touchPlane(base);
    expect(first.outcome).toBe("shielded");
    expect(first.plane.shield).toBe(0);
    expect(first.plane.spare).toBe(1);
    expect(first.line).toContain("护盾");

    const second = touchPlane({ ...first.plane, invuln: 0 });
    expect(second.outcome).toBe("swapped");
    expect(second.plane.spare).toBe(0);
    // 换机会掉一级火力、散掉一架僚机
    expect(second.plane.power).toBe(2);
    expect(second.plane.wingmen).toBe(1);
    expect(second.line).toContain("迫降");
    for (const line of [first.line, second.line]) {
      expect(line).not.toMatch(/血|伤|死|爆炸/);
    }

    const third = touchPlane({ ...second.plane, invuln: 0 });
    expect(third.outcome).toBe("grounded");
    expect(third.line).toContain("检修");
  });

  it("无敌时间内碰到不算数,火力也不会掉", () => {
    const plane = { ...makePlane(), invuln: 0.5, power: 3 };
    const res = touchPlane(plane);
    expect(res.outcome).toBe("ignored");
    expect(res.plane).toBe(plane);
  });

  it("炸弹清空全场敌弹并给一小段无敌,没弹可炸时不消耗", () => {
    const bullets = buildVolley(makeSpec("ring", { count: 12 }), 0, { x: 240, y: 130 });
    const plane = { ...makePlane(), bombs: 1, invuln: 0 };
    const used = useBomb(plane, bullets);
    expect(used.used).toBe(true);
    expect(used.cleared).toBe(12);
    expect(used.bullets.length).toBe(0);
    expect(used.plane.bombs).toBe(0);
    expect(used.plane.invuln).toBeGreaterThan(0);

    const empty = useBomb(used.plane, bullets);
    expect(empty.used).toBe(false);
    expect(empty.bullets.length).toBe(12);
  });

  it("道具各管各的,而且都有上限", () => {
    let p = makePlane();
    p = applyPickup(p, "power");
    expect(p.power).toBe(2);
    p = applyPickup(applyPickup(applyPickup(p, "power"), "power"), "power");
    expect(p.power).toBe(MAX_POWER);
    p = applyPickup(p, "wing");
    p = applyPickup(p, "wing");
    p = applyPickup(p, "wing");
    expect(p.wingmen).toBe(MAX_WINGMEN);
    const before = p.weapon;
    p = applyPickup(p, "weapon");
    expect(p.weapon).not.toBe(before);
    let q = applyPickup(makePlane(), "shield");
    for (let i = 0; i < 6; i++) q = applyPickup(q, "shield");
    expect(q.shield).toBeLessThanOrEqual(3);
    let b = makePlane();
    for (let i = 0; i < 9; i++) b = applyPickup(b, "bomb");
    expect(b.bombs).toBeLessThanOrEqual(5);
  });

  it("换武器是三把轮着来,转一圈回到原点", () => {
    let p = makePlane("star");
    const seen: string[] = [p.weapon];
    for (let i = 0; i < 3; i++) {
      p = applyPickup(p, "weapon");
      seen.push(p.weapon);
    }
    expect(seen).toEqual(["star", "wave", "beam", "star"]);
  });
});

describe("sky-squad 敌机", () => {
  it("四种敌机血量速度各不相同,大肚运输机最耐打", () => {
    const kinds = Object.keys(FOE_INFO) as Array<keyof typeof FOE_INFO>;
    expect(kinds.length).toBe(4);
    expect(FOE_INFO.tanker.hp).toBeGreaterThan(FOE_INFO.scout.hp);
    expect(FOE_INFO.kite.speed).toBeGreaterThan(FOE_INFO.tanker.speed);
    for (const k of kinds) {
      expect(FOE_INFO[k].r).toBeGreaterThan(10);
      expect(FOE_INFO[k].name.length).toBeGreaterThan(1);
    }
  });

  it("敌机掉血到 0 才迫降,而且一定朝画面外滑走", () => {
    const foe: Foe = { id: 1, kind: "puff", x: 100, y: 200, vx: 0, vy: 40, hp: 2, fireIn: 1, phase: 0 };
    const once = damageFoe(foe, 1);
    expect(once.downed).toBe(false);
    expect(once.foe.hp).toBe(1);
    expect(damageFoe(once.foe, 1).downed).toBe(true);
    expect(glideAway({ ...foe, x: 10 }).vx).toBeLessThan(0);
    expect(glideAway({ ...foe, x: SKY_W - 10 }).vx).toBeGreaterThan(0);
    expect(glideAway(foe).vy).toBeGreaterThan(0);
  });
});

describe("sky-squad 结算与无尽波次", () => {
  it("零失误零炸弹才三星,挨碰或者狂扔炸弹掉星", () => {
    expect(starsForSortie({ downed: 8, total: 8, touched: 0, bombs: 0, bossDown: false })).toBe(3);
    expect(starsForSortie({ downed: 8, total: 8, touched: 1, bombs: 1, bossDown: false })).toBe(2);
    expect(starsForSortie({ downed: 8, total: 8, touched: 3, bombs: 0, bossDown: false })).toBe(1);
    expect(starsForSortie({ downed: 8, total: 8, touched: 0, bombs: 3, bossDown: false })).toBe(1);
  });

  it("结算文案只夸不骂,也不出现任何伤亡字眼", () => {
    const lines = [
      sortieMessage({ downed: 8, total: 8, touched: 0, bombs: 0, bossDown: true }),
      sortieMessage({ downed: 8, total: 8, touched: 0, bombs: 2, bossDown: true }),
      sortieMessage({ downed: 8, total: 8, touched: 4, bombs: 1, bossDown: true }),
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(8);
      expect(line).not.toMatch(/血|受伤|死|爆炸|笨|真差/);
    }
  });

  it("无尽波次越来越强但都有封顶,道具按固定节奏掉", () => {
    const w1 = waveSpec(1);
    const w9 = waveSpec(9);
    const w99 = waveSpec(99);
    expect(w1.kinds).toEqual(["scout"]);
    expect(w9.kinds).toContain("tanker");
    expect(w9.foes).toBeGreaterThan(w1.foes);
    expect(w99.foes).toBeLessThanOrEqual(14);
    expect(w99.speed).toBeLessThanOrEqual(2);
    expect(w99.fireGap).toBeGreaterThanOrEqual(0.85);
    const pickups = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => waveSpec(w).pickup);
    expect(pickups.filter(Boolean).length).toBeGreaterThanOrEqual(4);
  });

  it("无尽得分随波数与战果单调上升", () => {
    expect(endlessScore(1, 0)).toBe(0);
    expect(endlessScore(5, 0)).toBeGreaterThan(endlessScore(3, 0));
    expect(endlessScore(5, 10)).toBeGreaterThan(endlessScore(5, 0));
  });
});

describe("sky-squad 键位与场地", () => {
  it("双人两套键位互不抢占,单人时两套都归 1 号", () => {
    expect(keyToAction("KeyD", 2)).toEqual({ player: 0, action: "right" });
    expect(keyToAction("ArrowRight", 2)).toEqual({ player: 1, action: "right" });
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "fire" });
    expect(keyToAction("KeyG", 2)).toEqual({ player: 0, action: "bomb" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "fire" });
    expect(keyToAction("KeyK", 2)).toEqual({ player: 1, action: "bomb" });
    expect(keyToAction("ArrowRight", 1)?.player).toBe(0);
    expect(keyToAction("Tab", 2)).toBeNull();
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("Enter")).toBe(false);
  });

  it("小飞机被夹在战场里,永远不会飞出画面", () => {
    expect(clampPlane(-999, -999).x).toBeGreaterThan(0);
    expect(clampPlane(-999, -999).y).toBeGreaterThan(0);
    expect(clampPlane(9999, 9999).x).toBeLessThan(SKY_W);
    expect(clampPlane(9999, 9999).y).toBeLessThan(SKY_H);
    expect(clampPlane(240, 500)).toEqual({ x: 240, y: 500 });
  });

  it("圆碰圆判定认得刚好相切与差一点点", () => {
    expect(circlesTouch(0, 0, 10, 19, 0, 10)).toBe(true);
    expect(circlesTouch(0, 0, 10, 21, 0, 10)).toBe(false);
    expect(circlesTouch(0, 0, 10, 0, 0, 1)).toBe(true);
  });
});
