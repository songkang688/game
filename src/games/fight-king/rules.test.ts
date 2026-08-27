/**
 * 梨康格斗王 —— 判定纯函数与帧数据表的回归测试。
 *
 * 四块重点（题目要求的那四件事都在这儿）：
 *  1. 判定框重叠：朝向镜像、上段打不到蹲着的、下段打不到跳起来的；
 *  2. 优先级：同帧对拼谁赢、投技压制普通招；
 *  3. 连段中断：取消表是单向的，接不回去；
 *  4. 无限连防护：同一招不能在一段连段里用两次，段数到顶就强制放倒。
 */
import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  METER_MAX,
  MOVE_SLOTS,
  STAGE_WIDTH,
  SUPER_COST,
  characterById,
  moveOf,
  totalFrames,
  type Move
} from "./frames";
import {
  CANCEL_TABLE,
  COMBO_LIMIT,
  MIN_COMBO_SCALE,
  PUNISH_THRESHOLD,
  THROW_RANGE,
  bodyGap,
  blocksAttack,
  canCancelInto,
  canChain,
  cappedOutcome,
  comboScale,
  comboTotalPower,
  facingTowards,
  framesAfterFirstActive,
  guardAfterBlock,
  guardRegen,
  hitStopFrames,
  holdingBack,
  hurtRect,
  isActiveFrame,
  isComboCapped,
  isGuardBroken,
  isValidCombo,
  matchOver,
  matchWinner,
  meterAfterGain,
  meterAfterPay,
  canPaySuper,
  movePhase,
  onBlockAdvantage,
  onHitAdvantage,
  overlapArea,
  punishableOnBlock,
  pushApart,
  rateByVigor,
  rectsOverlap,
  resolveClash,
  roundResult,
  scaledHitStun,
  scaledPower,
  shakeAmount,
  sparkCount,
  techWindowOpen,
  throwBeatsStrike,
  throwConnects,
  vigorAfter,
  wakeupFrames,
  worldBox
} from "./rules";

const duoduo = characterById("duoduo");
const xingxing = characterById("xingxing");

/* ------------------------------------------------------------------ */
/* 一、帧数据表本身                                                    */
/* ------------------------------------------------------------------ */

describe("帧数据表", () => {
  it("正好八位可选角色，id 与名字都不重复", () => {
    expect(CHARACTERS).toHaveLength(8);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(8);
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(8);
  });

  it("每人都有 11 个招式槽，每槽都有名字", () => {
    for (const ch of CHARACTERS) {
      expect(Object.keys(ch.moves).sort()).toEqual([...MOVE_SLOTS].sort());
      for (const slot of MOVE_SLOTS) {
        expect(ch.moves[slot].slot, `${ch.id}.${slot}`).toBe(slot);
        expect(ch.moves[slot].name.length).toBeGreaterThan(1);
      }
    }
  });

  it("每人 3 个必杀 + 1 个超必杀，超必杀要满槽才放得出来", () => {
    for (const ch of CHARACTERS) {
      const specials = (["s1", "s2", "s3"] as const).map((s) => ch.moves[s]);
      expect(specials.every((m) => m.kind === "special")).toBe(true);
      expect(new Set(specials.map((m) => m.name)).size).toBe(3);
      expect(ch.moves.super.kind).toBe("super");
      expect(ch.moves.super.meterCost).toBe(SUPER_COST);
      expect(specials.every((m) => m.meterCost === 0)).toBe(true);
    }
  });

  it("超必杀的名字全场唯一，八个人不会撞名", () => {
    const names = CHARACTERS.map((c) => c.moves.super.name);
    expect(new Set(names).size).toBe(8);
  });

  it("所有招式的三段帧都是正数，判定框也不为空", () => {
    for (const ch of CHARACTERS) {
      for (const slot of MOVE_SLOTS) {
        const m = ch.moves[slot];
        expect(m.startup, `${ch.id}.${slot} 起手`).toBeGreaterThan(0);
        expect(m.active, `${ch.id}.${slot} 命中`).toBeGreaterThan(0);
        expect(m.recovery, `${ch.id}.${slot} 收招`).toBeGreaterThan(0);
        expect(m.box.w).toBeGreaterThan(0);
        expect(m.box.h).toBeGreaterThan(0);
        expect(totalFrames(m)).toBe(m.startup + m.active + m.recovery);
      }
    }
  });

  it("角色差异是真的：速度 / 范围 / 起手 / 元气 四项各自都拉开了档次", () => {
    expect(new Set(CHARACTERS.map((c) => c.walk)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(CHARACTERS.map((c) => c.reach)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(CHARACTERS.map((c) => c.startupMod)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(CHARACTERS.map((c) => c.vigor)).size).toBeGreaterThanOrEqual(7);
  });

  it("速度最快的闪闪起手比最慢的墩墩短，墩墩的元气则最厚", () => {
    const shan = characterById("shanshan");
    const dun = characterById("dundun");
    expect(shan.moves["5L"].startup).toBeLessThan(dun.moves["5L"].startup);
    expect(shan.walk).toBeGreaterThan(dun.walk);
    expect(dun.vigor).toBeGreaterThan(Math.max(...CHARACTERS.filter((c) => c.id !== "dundun").map((c) => c.vigor)));
  });

  it("长手的云云攻击范围最大，短手的啾啾最小", () => {
    const reaches = CHARACTERS.map((c) => ({ id: c.id, r: c.reach })).sort((a, b) => b.r - a.r);
    expect(reaches[0].id).toBe("yunyun");
    expect(reaches[reaches.length - 1].id).toBe("jiujiu");
    expect(characterById("yunyun").moves["5H"].box.w).toBeGreaterThan(characterById("jiujiu").moves["5H"].box.w);
  });

  it("投技的判定框不吃攻击范围倍率：谁都得贴身才抓得到", () => {
    const widths = new Set(CHARACTERS.map((c) => c.moves.throw.box.w));
    expect(widths.size).toBe(1);
  });

  it("扫堂腿是下段、跳跃攻击是上段、投技是投", () => {
    for (const ch of CHARACTERS) {
      expect(ch.moves["2H"].height).toBe("low");
      expect(ch.moves.jL.height).toBe("high");
      expect(ch.moves.jH.height).toBe("high");
      expect(ch.moves.throw.height).toBe("throw");
    }
  });

  it("moveOf / characterById 找不到时退回鸭梨，不会返回空", () => {
    expect(characterById("查无此人").id).toBe("duoduo");
    expect(moveOf("查无此人", "5L").slot).toBe("5L");
    expect(moveOf("dundun", "super").name).toBe("天旋地转墩");
  });
});

/* ------------------------------------------------------------------ */
/* 二、判定框重叠                                                      */
/* ------------------------------------------------------------------ */

describe("判定框重叠", () => {
  it("朝右时判定框往前长", () => {
    const r = worldBox(100, 0, 1, { x: 20, y: 40, w: 50, h: 30 });
    expect(r).toEqual({ x: 120, y: 40, w: 50, h: 30 });
  });

  it("朝左时整个框镜像到另一边", () => {
    const r = worldBox(100, 0, -1, { x: 20, y: 40, w: 50, h: 30 });
    expect(r).toEqual({ x: 30, y: 40, w: 50, h: 30 });
  });

  it("角色在空中时框跟着抬高", () => {
    const ground = worldBox(100, 0, 1, { x: 10, y: 20, w: 30, h: 30 });
    const air = worldBox(100, 60, 1, { x: 10, y: 20, w: 30, h: 30 });
    expect(air.y - ground.y).toBe(60);
  });

  it("两个框重叠 / 不重叠 / 边贴边", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: 20, y: 0, w: 10, h: 10 })).toBe(false);
    // 边贴边不算重叠，免得"擦过去"也判命中
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it("重叠面积算得对，没碰上就是 0", () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 30, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it("蹲下的受击框比站着矮", () => {
    const stand = hurtRect(100, 0, 24, 92, 62, false);
    const crouch = hurtRect(100, 0, 24, 92, 62, true);
    expect(stand.h).toBe(92);
    expect(crouch.h).toBe(62);
    expect(crouch.x).toBe(76);
    expect(crouch.w).toBe(48);
  });

  it("鸭梨的站立重击够得到 60 距离外的康康，够不到 130 外的", () => {
    const move = duoduo.moves["5H"];
    const near = worldBox(100, 0, 1, move.box);
    expect(rectsOverlap(near, hurtRect(160, 0, xingxing.halfWidth, xingxing.height, xingxing.crouchHeight, false))).toBe(
      true
    );
    expect(rectsOverlap(near, hurtRect(230, 0, xingxing.halfWidth, xingxing.height, xingxing.crouchHeight, false))).toBe(
      false
    );
  });

  it("下段扫堂腿打不到跳在空中的人", () => {
    const sweep = worldBox(100, 0, 1, duoduo.moves["2H"].box);
    const airborne = hurtRect(150, 60, xingxing.halfWidth, xingxing.height, xingxing.crouchHeight, false);
    expect(rectsOverlap(sweep, airborne)).toBe(false);
    const grounded = hurtRect(150, 0, xingxing.halfWidth, xingxing.height, xingxing.crouchHeight, false);
    expect(rectsOverlap(sweep, grounded)).toBe(true);
  });

  it("跳跃攻击的判定框在半空，够得到站着的人，够不到蹲着的人", () => {
    const jump = worldBox(120, 30, 1, duoduo.moves.jL.box);
    const crouching = hurtRect(150, 0, xingxing.halfWidth, xingxing.height, xingxing.crouchHeight, true);
    expect(rectsOverlap(jump, crouching)).toBe(false);
    const standing = hurtRect(150, 0, xingxing.halfWidth, xingxing.height, xingxing.crouchHeight, false);
    expect(rectsOverlap(jump, standing)).toBe(true);
  });

  it("身体间距、推挤、转身都算得对", () => {
    expect(bodyGap(100, 200, 24, 22)).toBe(54);
    expect(bodyGap(100, 130, 24, 22)).toBe(0);
    expect(pushApart(100, 200, 24, 22)).toBe(0);
    expect(pushApart(100, 130, 25, 25)).toBe(10);
    expect(facingTowards(100, 200)).toBe(1);
    expect(facingTowards(200, 100)).toBe(-1);
  });
});

/* ------------------------------------------------------------------ */
/* 三、三段帧与帧数差                                                  */
/* ------------------------------------------------------------------ */

describe("起手 / 命中 / 收招", () => {
  const probe: Move = { ...duoduo.moves["5L"], startup: 4, active: 3, recovery: 8 };

  it("四段分界准确", () => {
    expect(movePhase(probe, 0)).toBe("startup");
    expect(movePhase(probe, 3)).toBe("startup");
    expect(movePhase(probe, 4)).toBe("active");
    expect(movePhase(probe, 6)).toBe("active");
    expect(movePhase(probe, 7)).toBe("recovery");
    expect(movePhase(probe, 14)).toBe("recovery");
    expect(movePhase(probe, 15)).toBe("done");
  });

  it("只有命中帧那一段判定框才生效", () => {
    const on: number[] = [];
    for (let i = 0; i < totalFrames(probe); i++) if (isActiveFrame(probe, i)) on.push(i);
    expect(on).toEqual([4, 5, 6]);
  });

  it("帧数差 = 对手硬直 − 我剩下的收招", () => {
    expect(framesAfterFirstActive(probe)).toBe(10);
    expect(onBlockAdvantage(probe)).toBe(probe.blockStun - 10);
    expect(onHitAdvantage(probe)).toBe(probe.hitStun - 10);
    expect(onHitAdvantage(probe)).toBeGreaterThan(onBlockAdvantage(probe));
  });

  it("轻击挡下来比重击安全，扫堂腿和超必杀被挡就要挨反击", () => {
    expect(onBlockAdvantage(duoduo.moves["5L"])).toBeGreaterThan(onBlockAdvantage(duoduo.moves["5H"]));
    expect(punishableOnBlock(duoduo.moves["5L"])).toBe(false);
    expect(punishableOnBlock(duoduo.moves["2H"])).toBe(true);
    expect(punishableOnBlock(duoduo.moves.super)).toBe(true);
    expect(PUNISH_THRESHOLD).toBeLessThan(0);
  });

  it("八个人的轻击都比自己的重击起手快", () => {
    for (const ch of CHARACTERS) {
      expect(ch.moves["5L"].startup, ch.id).toBeLessThan(ch.moves["5H"].startup);
      expect(ch.moves["5L"].power, ch.id).toBeLessThan(ch.moves["5H"].power);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、优先级                                                          */
/* ------------------------------------------------------------------ */

describe("同帧对拼的优先级", () => {
  it("优先级高的一边赢", () => {
    expect(resolveClash(duoduo.moves["5H"], duoduo.moves["5L"])).toBe("a");
    expect(resolveClash(duoduo.moves["5L"], duoduo.moves["5H"])).toBe("b");
  });

  it("优先级一样就双方弹开", () => {
    expect(resolveClash(duoduo.moves["5L"], duoduo.moves["2L"])).toBe("trade");
    expect(resolveClash(duoduo.moves["5H"], duoduo.moves["2H"])).toBe("trade");
  });

  it("超必杀压得住普通招，对空必杀压得住跳跃攻击", () => {
    expect(resolveClash(duoduo.moves.super, duoduo.moves["5H"])).toBe("a");
    expect(resolveClash(duoduo.moves.s2, xingxing.moves.jH)).toBe("a");
  });

  it("投技的优先级最高，能压过任何普通招", () => {
    for (const ch of CHARACTERS) {
      for (const slot of ["5L", "5H", "2L", "2H", "jL", "jH"] as const) {
        expect(throwBeatsStrike(ch.moves.throw, ch.moves[slot]), `${ch.id}.${slot}`).toBe(true);
      }
    }
  });

  it("普通招不会被当成投技去压别人", () => {
    expect(throwBeatsStrike(duoduo.moves["5H"], duoduo.moves["5L"])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 五、连段：取消表与中断                                              */
/* ------------------------------------------------------------------ */

describe("连段取消表", () => {
  it("取消表是单向的：轻能接重，重接不回轻", () => {
    expect(CANCEL_TABLE.light).toContain("heavy");
    expect(CANCEL_TABLE.heavy).not.toContain("light");
    expect(CANCEL_TABLE.special).not.toContain("light");
    expect(CANCEL_TABLE.special).not.toContain("heavy");
    expect(CANCEL_TABLE.special).toContain("super");
    expect(CANCEL_TABLE.super).toEqual([]);
    expect(CANCEL_TABLE.throw).toEqual([]);
  });

  it("同一类里可以再接一招（换个槽），六段连段就是这么来的", () => {
    expect(CANCEL_TABLE.light).toContain("light");
    expect(CANCEL_TABLE.heavy).toContain("heavy");
    expect(CANCEL_TABLE.special).toContain("special");
  });

  it("轻 → 重 → 必杀 → 超必杀 一路接得上", () => {
    expect(canCancelInto(duoduo.moves["5L"], duoduo.moves["5H"])).toBe(true);
    expect(canCancelInto(duoduo.moves["5H"], duoduo.moves.s1)).toBe(true);
    expect(canCancelInto(duoduo.moves.s1, duoduo.moves.super)).toBe(true);
  });

  it("接不回去：重接不了轻、必杀接不了重、超必杀之后什么都接不了", () => {
    expect(canCancelInto(duoduo.moves["5H"], duoduo.moves["5L"])).toBe(false);
    expect(canCancelInto(duoduo.moves.s1, duoduo.moves["5H"])).toBe(false);
    expect(canCancelInto(duoduo.moves.s1, duoduo.moves["2L"])).toBe(false);
    expect(canCancelInto(duoduo.moves.super, duoduo.moves["5L"])).toBe(false);
  });

  it("投技既接不出去也接不进来（连段里塞不了投技）", () => {
    expect(canCancelInto(duoduo.moves.throw, duoduo.moves["5L"])).toBe(false);
    expect(canCancelInto(duoduo.moves["5L"], duoduo.moves.throw)).toBe(false);
    expect(canCancelInto(duoduo.moves.s1, duoduo.moves.throw)).toBe(false);
  });

  it("连段中断：同一段里同一个招不许用第二次", () => {
    expect(canChain(duoduo.moves["5L"], duoduo.moves["5L"], [], 1)).toBe(false);
    expect(canChain(duoduo.moves["5L"], duoduo.moves["2L"], ["5L"], 1)).toBe(true);
    expect(canChain(duoduo.moves["2L"], duoduo.moves["5L"], ["5L", "2L"], 2)).toBe(false);
  });

  it("连段中断：段数到上限就再也接不上了", () => {
    expect(canChain(duoduo.moves["5L"], duoduo.moves["5H"], ["5L"], COMBO_LIMIT - 1)).toBe(true);
    expect(canChain(duoduo.moves["5L"], duoduo.moves["5H"], ["5L"], COMBO_LIMIT)).toBe(false);
    expect(canChain(duoduo.moves["5L"], duoduo.moves["5H"], ["5L"], COMBO_LIMIT + 3)).toBe(false);
  });
});

describe("连段递减与无限连防护", () => {
  it("每多一段就轻一点，且有地板", () => {
    expect(comboScale(0)).toBe(1);
    expect(comboScale(1)).toBe(0.9);
    expect(comboScale(5)).toBe(0.5);
    expect(comboScale(9)).toBe(MIN_COMBO_SCALE);
    for (let i = 1; i < 6; i++) expect(comboScale(i)).toBeLessThan(comboScale(i - 1));
  });

  it("威力递减但至少留 1 点，硬直递减但至少留 6 帧", () => {
    expect(scaledPower(10, 0)).toBe(10);
    expect(scaledPower(10, 3)).toBe(7);
    expect(scaledPower(1, 9)).toBe(1);
    expect(scaledHitStun(20, 0)).toBe(20);
    expect(scaledHitStun(20, 4)).toBe(12);
    expect(scaledHitStun(8, 20)).toBe(6);
  });

  it("硬直一路递减，连段自己就会断掉", () => {
    let prev = Infinity;
    for (let i = 0; i < COMBO_LIMIT; i++) {
      const cur = scaledHitStun(24, i);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  it("段数到顶：再打中也不削元气，直接放倒弹开", () => {
    expect(isComboCapped(COMBO_LIMIT - 1)).toBe(false);
    expect(isComboCapped(COMBO_LIMIT)).toBe(true);
    const out = cappedOutcome(duoduo.moves["5L"]);
    expect(out.power).toBe(0);
    expect(out.hitStun).toBe(0);
    expect(out.knockdown).toBe(true);
    expect(out.knockback).toBeGreaterThanOrEqual(8);
  });

  it("一整条合法连段：轻 → 蹲轻 → 重 → 必杀 → 超必杀", () => {
    const route = [duoduo.moves["5L"], duoduo.moves["2L"], duoduo.moves["5H"], duoduo.moves.s1, duoduo.moves.super];
    expect(isValidCombo(route)).toBe(true);
    expect(comboTotalPower(route)).toBeGreaterThan(0);
  });

  it("典型的无限连写法全部被挡下来", () => {
    const L = duoduo.moves["5L"];
    const H = duoduo.moves["5H"];
    // 同一招自己接自己
    expect(isValidCombo([L, L])).toBe(false);
    expect(isValidCombo([L, L, L, L])).toBe(false);
    // 两招来回循环
    expect(isValidCombo([L, H, L, H])).toBe(false);
    // 三招循环
    expect(isValidCombo([L, duoduo.moves["2L"], H, L])).toBe(false);
    // 超过段数上限
    expect(
      isValidCombo([L, duoduo.moves["2L"], duoduo.moves["2H"], H, duoduo.moves.s1, duoduo.moves.super, duoduo.moves.jL])
    ).toBe(false);
  });

  it("连段越长每一段越不值钱：五段的总量小于同样五招不打折的总和", () => {
    const route = [duoduo.moves["5L"], duoduo.moves["2L"], duoduo.moves["5H"], duoduo.moves.s1, duoduo.moves.super];
    const raw = route.reduce((s, m) => s + m.power, 0);
    expect(comboTotalPower(route)).toBeLessThan(raw);
  });

  it("空连段不算数，超长连段的计数也只算到上限", () => {
    expect(isValidCombo([])).toBe(false);
    const many = new Array(12).fill(duoduo.moves["5L"]) as Move[];
    expect(comboTotalPower(many)).toBe(comboTotalPower(many.slice(0, COMBO_LIMIT)));
  });
});

/* ------------------------------------------------------------------ */
/* 六、格挡与破防                                                      */
/* ------------------------------------------------------------------ */

describe("格挡与破防", () => {
  it("站着挡得住中段和上段，挡不住下段", () => {
    expect(blocksAttack("stand", "mid")).toBe(true);
    expect(blocksAttack("stand", "high")).toBe(true);
    expect(blocksAttack("stand", "low")).toBe(false);
  });

  it("蹲着挡得住中段和下段，挡不住上段", () => {
    expect(blocksAttack("crouch", "mid")).toBe(true);
    expect(blocksAttack("crouch", "low")).toBe(true);
    expect(blocksAttack("crouch", "high")).toBe(false);
  });

  it("空中不能防御，投技谁都挡不住", () => {
    expect(blocksAttack("air", "mid")).toBe(false);
    expect(blocksAttack("stand", "throw")).toBe(false);
    expect(blocksAttack("crouch", "throw")).toBe(false);
  });

  it("按住远离对手的方向键才算格挡", () => {
    expect(holdingBack(1, true, false)).toBe(true);
    expect(holdingBack(1, false, true)).toBe(false);
    expect(holdingBack(-1, false, true)).toBe(true);
    // 左右一起按不算，免得原地发抖
    expect(holdingBack(1, true, true)).toBe(false);
  });

  it("格挡槽挡一下掉一块，掉光就是破防", () => {
    expect(guardAfterBlock(60, 11)).toBe(49);
    expect(guardAfterBlock(5, 11)).toBe(0);
    expect(isGuardBroken(0)).toBe(true);
    expect(isGuardBroken(1)).toBe(false);
  });

  it("不挡的时候格挡槽会慢慢回，但不会超上限", () => {
    expect(guardRegen(50, 60)).toBeGreaterThan(50);
    expect(guardRegen(59.95, 60)).toBe(60);
    expect(guardRegen(60, 60, 100)).toBe(60);
  });

  it("破防招挡起来特别费槽：云云和墩墩的破防招掉得比普通重击多一倍不止", () => {
    expect(characterById("yunyun").moves.s3.guardCrush).toBe(true);
    expect(characterById("dundun").moves.s3.guardCrush).toBe(true);
    expect(characterById("yunyun").moves.s3.guardCost).toBeGreaterThan(characterById("yunyun").moves["5H"].guardCost * 2);
  });

  it("守得住的次数是有限的：一直挡重击迟早破防", () => {
    let guard = duoduo.guardMax;
    let blocks = 0;
    while (!isGuardBroken(guard) && blocks < 100) {
      guard = guardAfterBlock(guard, duoduo.moves["5H"].guardCost);
      blocks++;
    }
    expect(isGuardBroken(guard)).toBe(true);
    expect(blocks).toBeLessThan(20);
  });
});

/* ------------------------------------------------------------------ */
/* 七、投技与受身                                                      */
/* ------------------------------------------------------------------ */

describe("投技", () => {
  it("贴身才抓得到", () => {
    expect(throwConnects(0, "idle", false)).toBe(true);
    expect(throwConnects(THROW_RANGE, "idle", false)).toBe(true);
    expect(throwConnects(THROW_RANGE + 1, "idle", false)).toBe(false);
  });

  it("在硬直里的人有投技保护，抓不着", () => {
    expect(throwConnects(0, "hitstun", false)).toBe(false);
    expect(throwConnects(0, "blockstun", false)).toBe(false);
    expect(throwConnects(0, "knockdown", false)).toBe(false);
    expect(throwConnects(0, "guardbreak", false)).toBe(false);
  });

  it("跳在空中的人抓不到", () => {
    expect(throwConnects(0, "idle", true)).toBe(false);
  });

  it("投技抓空非常亏：收招是全套招式里最长的一档", () => {
    for (const ch of CHARACTERS) {
      expect(ch.moves.throw.recovery, ch.id).toBeGreaterThan(ch.moves["5H"].recovery);
    }
  });
});

describe("受身", () => {
  it("倒地窗口开着的时候才受得了身", () => {
    expect(techWindowOpen(0)).toBe(true);
    expect(techWindowOpen(8)).toBe(true);
    expect(techWindowOpen(9)).toBe(false);
    expect(techWindowOpen(-1)).toBe(false);
  });

  it("受身成功爬得更快", () => {
    expect(wakeupFrames(true)).toBeLessThan(wakeupFrames(false));
  });
});

/* ------------------------------------------------------------------ */
/* 八、能量槽、手感与胜负                                              */
/* ------------------------------------------------------------------ */

describe("能量槽", () => {
  it("涨能量有封顶，也不会变成负数", () => {
    expect(meterAfterGain(90, 20)).toBe(METER_MAX);
    expect(meterAfterGain(0, -5)).toBe(0);
  });

  it("满槽才放得出超必杀，放完清零", () => {
    expect(canPaySuper(METER_MAX)).toBe(true);
    expect(canPaySuper(SUPER_COST - 1)).toBe(false);
    expect(meterAfterPay(METER_MAX, SUPER_COST)).toBe(0);
  });
});

describe("手感与减弱动效", () => {
  it("减弱动效时屏幕完全不抖", () => {
    expect(shakeAmount(30, false)).toBeGreaterThan(0);
    expect(shakeAmount(30, true)).toBe(0);
    expect(shakeAmount(0, false)).toBeGreaterThan(0);
  });

  it("威力越大抖得越厉害，但有封顶", () => {
    expect(shakeAmount(20, false)).toBeGreaterThan(shakeAmount(4, false));
    expect(shakeAmount(999, false)).toBeLessThanOrEqual(9);
  });

  it("命中顿帧在减弱动效下减半但不消失", () => {
    const mv = duoduo.moves["5H"];
    expect(hitStopFrames(mv, false)).toBe(mv.hitStop);
    expect(hitStopFrames(mv, true)).toBeLessThan(mv.hitStop);
    expect(hitStopFrames(mv, true)).toBeGreaterThan(0);
  });

  it("减弱动效时星星特效也少放几颗", () => {
    expect(sparkCount(30, true)).toBeLessThanOrEqual(4);
    expect(sparkCount(30, false)).toBeGreaterThan(sparkCount(30, true));
    expect(sparkCount(999, false)).toBeLessThanOrEqual(12);
  });
});

describe("元气与胜负", () => {
  it("元气不会掉成负数", () => {
    expect(vigorAfter(10, 3)).toBe(7);
    expect(vigorAfter(2, 30)).toBe(0);
  });

  it("回合判定：谁先没元气谁输，都还有就比谁多", () => {
    expect(roundResult(0, 40)).toBe(1);
    expect(roundResult(40, 0)).toBe(0);
    expect(roundResult(0, 0)).toBe(-1);
    expect(roundResult(50, 30)).toBe(0);
    expect(roundResult(30, 50)).toBe(1);
    expect(roundResult(30, 30)).toBe(-1);
  });

  it("一场比赛先赢两回合的人拿下", () => {
    expect(matchOver([1, 1], 2)).toBe(false);
    expect(matchOver([2, 1], 2)).toBe(true);
    expect(matchWinner([2, 1], 2)).toBe(0);
    expect(matchWinner([1, 2], 2)).toBe(1);
    expect(matchWinner([1, 1], 2)).toBe(-1);
  });

  it("按剩余元气评星：赢得越轻松星越多", () => {
    expect(rateByVigor(100, 100)).toBe(3);
    expect(rateByVigor(50, 100)).toBe(2);
    expect(rateByVigor(10, 100)).toBe(1);
    expect(rateByVigor(0, 0)).toBe(1);
  });

  it("舞台宽度足够两个人拉开距离", () => {
    expect(STAGE_WIDTH).toBeGreaterThan(600);
  });
});
