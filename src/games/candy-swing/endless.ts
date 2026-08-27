// 无尽模式「甜甜塔」：一层一层往上爬的糖果塔。
// 每一层都是现搭的一关（同一颗种子搭出来的塔永远一样，方便复盘和写用例），
// 机关组合随层数变多、限时随层数变短，坚持到第几层就记第几颗糖。
// 纯数据生成，不碰 DOM；index.ts 拿它当普通 LevelDef 跑，sim.ts 也能直接验可解性。

import type { LevelDef, SpringDef, StickyDef } from "./levels";

/** 32 位确定性伪随机（mulberry32）：同一颗种子永远同一座塔 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每层的限时：第 1 层 18 秒，越往上越紧，最快到 8 秒封底 */
export function towerTimeLimit(wave: number): number {
  const w = Math.max(1, Math.floor(wave));
  return Math.max(8, 18 - (w - 1) * 0.5);
}

/**
 * 第 wave 层解锁到哪一档机关。
 * 1 = 直落，2 = 荡秋千，3 = 双绳，4 = 加黏黏泡，5 = 加弹簧蘑菇，6 = 全都有。
 */
export function towerTier(wave: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const w = Math.max(1, Math.floor(wave));
  if (w <= 2) return 1;
  if (w <= 5) return 2;
  if (w <= 8) return 3;
  if (w <= 12) return 4;
  if (w <= 16) return 5;
  return 6;
}

/** 每层的层名（给 HUD 用），十层一个称号 */
export function towerTitle(wave: number): string {
  const names = ["糖霜层", "果冻层", "棉花层", "巧克力层", "星星层"];
  const w = Math.max(1, Math.floor(wave));
  return names[Math.min(names.length - 1, Math.floor((w - 1) / 10))];
}

const ANCHOR_Y = 56;
const CANVAS_W = 360;

/**
 * 搭一层甜甜塔。
 * 布局刻意收敛：糖果永远吊在锚点正下方或偏一侧，怪物永远在下半屏摆动能够到的地方，
 * 机关只往「不挡主路线」的位置放，所以每一层都保证存在通关解（测试里用 searchCutTimeFor 逐层验）。
 */
export function makeTowerLevel(seed: number, wave: number): LevelDef {
  const w = Math.max(1, Math.floor(wave));
  const rnd = mulberry32((seed >>> 0) + w * 0x9e3779b1);
  const tier = towerTier(w);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length) % arr.length];
  const between = (lo: number, hi: number): number => lo + rnd() * (hi - lo);

  // 锚点在上方，糖果吊在下面；tier 1 正下方直落，往后往一侧偏，得算摆动时机
  const anchorX = Math.round(between(120, 240));
  const ropeLen = Math.round(between(96, 150));
  const side: 1 | -1 = rnd() < 0.5 ? 1 : -1;
  const swing = tier === 1 ? 0 : Math.round(between(40, 78));
  const candyX = Math.max(40, Math.min(CANVAS_W - 40, anchorX + side * swing));
  const candyY = ANCHOR_Y + Math.round(Math.sqrt(Math.max(1, ropeLen * ropeLen - swing * swing)));

  // 怪物落在糖果荡过去那一侧的下方（tier 1 就在正下方）
  const monsterX = Math.max(50, Math.min(
    CANVAS_W - 50,
    tier === 1 ? candyX : anchorX - side * Math.round(between(24, 66))
  ));
  const monsterY = Math.round(between(388, 430));

  const stars = [0, 1, 2].map((k) => ({
    x: Math.round(anchorX + (monsterX - anchorX) * ((k + 1) / 4)),
    y: Math.round(candyY + (monsterY - candyY) * ((k + 1) / 4)),
  }));

  const ropes = [{ x: anchorX, y: ANCHOR_Y, length: ropeLen }];
  if (tier >= 3) {
    // 第二根绳从另一侧松松地拴着：两根都得切断糖果才掉，
    // 但它留了 30% 的余量，糖果照样能荡起来（拉直了就只能干瞪眼）
    const otherX = Math.max(24, Math.min(CANVAS_W - 24, anchorX - side * Math.round(between(66, 108))));
    const slack = Math.hypot(candyX - otherX, candyY - ANCHOR_Y) * 1.3;
    ropes.push({ x: otherX, y: ANCHOR_Y, length: Math.round(slack) });
  }

  // 黏黏泡是「安全网」：悬在啾啾正上方一点点，
  // 被它黏住的糖果放开后正好直直落进嘴里，孩子有几秒喘息看清下半程。
  const stickies: StickyDef[] = [];
  if (tier >= 4) {
    const lo = Math.min(candyY + 70, monsterY - 110);
    const hi = monsterY - 100;
    stickies.push({
      x: Math.round(monsterX + between(-26, 26)),
      y: Math.round(between(Math.min(lo, hi), Math.max(lo, hi))),
      radius: 30,
      hold: +between(0.7, 1.3).toFixed(2),
    });
  }

  // 弹簧蘑菇贴边站着，把飞过头的糖果弹回场内
  const springs: SpringDef[] = [];
  if (tier >= 5) {
    const onLeft = rnd() < 0.5;
    springs.push({
      x: onLeft ? 26 : CANVAS_W - 26,
      y: Math.round(between(300, 372)),
      radius: 22,
      dir: onLeft ? "right" : "left",
      bounce: +between(0.7, 1.05).toFixed(2),
      minOut: Math.round(between(150, 230)),
    });
    if (tier >= 6) {
      // 压轴档两面墙都站一朵：飞向哪边都会被弹回场内，糖果不容易白白掉出去
      springs.push({
        x: onLeft ? CANVAS_W - 26 : 26,
        y: Math.round(between(300, 372)),
        radius: 22,
        dir: onLeft ? "left" : "right",
        bounce: +between(0.7, 1.05).toFixed(2),
        minOut: Math.round(between(150, 230)),
      });
    }
  }

  const lv: LevelDef = {
    name: `甜甜塔 第 ${w} 层 · ${towerTitle(w)}`,
    tip: tier === 1 ? "划一刀，把糖果送进啾啾嘴里！" : "看准摆动的时机再下刀！",
    candy: { x: candyX, y: candyY },
    monster: { x: monsterX, y: monsterY },
    ropes,
    stars,
    timeLimit: towerTimeLimit(w),
    solve: { kind: "search", tMax: 3.2 },
  };
  if (stickies.length > 0) lv.stickies = stickies;
  if (springs.length > 0) lv.springs = springs;
  return lv;
}
