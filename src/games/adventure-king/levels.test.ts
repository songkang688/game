import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { ROPE_MAX, dist } from "./logic";
import {
  ARTIFACT_EMOJI,
  ARTIFACT_NAMES,
  CEIL_Y,
  CHAPTERS,
  GROUND_Y,
  LANDING_STRIP,
  LEVELS,
  MAX_JUMP,
  SWING_GAP_MAX,
  SWING_GAP_MIN,
  WALK_GAP_MAX,
  anchorCovers,
  artifactsGrounded,
  buildEndlessFloor,
  buildLevel,
  buildSpeedrunCourse,
  chapterStartLevel,
  gapsOf,
  levelTraversable,
  type AdvLevel,
} from "./levels";

/** 一关的基本体检:石台有序、坑不重叠、守卫待在自己的台上 */
function checkShape(lv: AdvLevel): void {
  expect(lv.platforms.length).toBeGreaterThanOrEqual(4);
  expect(lv.pits).toHaveLength(lv.platforms.length - 1);
  for (let i = 1; i < lv.platforms.length; i++) {
    const prev = lv.platforms[i - 1];
    const cur = lv.platforms[i];
    expect(cur.x).toBeGreaterThan(prev.x + prev.w);
    expect(cur.y).toBeGreaterThanOrEqual(CEIL_Y);
    expect(cur.y).toBeLessThanOrEqual(GROUND_Y);
    expect(cur.w).toBeGreaterThanOrEqual(130);
  }
  for (const e of lv.enemies) {
    expect(e.from).toBeLessThan(e.to);
    expect(e.x).toBeGreaterThanOrEqual(e.from);
    expect(e.x).toBeLessThanOrEqual(e.to);
    const host = lv.platforms.find((p) => e.from >= p.x && e.to <= p.x + p.w);
    expect(host).toBeTruthy();
  }
  const last = lv.platforms[lv.platforms.length - 1];
  expect(lv.door.x).toBeGreaterThanOrEqual(last.x);
  expect(lv.door.x).toBeLessThanOrEqual(last.x + last.w);
  expect(lv.door.y).toBe(last.y);
  expect(lv.width).toBeGreaterThan(last.x + last.w);
}

describe("冒险小王 188 关战役", () => {
  it("正好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 8 个主题章节,章节大小之和是 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("章节名字都是本作原创的遗迹,没有外部角色名", () => {
    expect(CHAPTERS.map((c) => c.name)).toEqual([
      "绿林遗迹",
      "沙丘神庙",
      "冰川裂谷",
      "天空之城",
      "熔岩地窟",
      "沉船珊瑚",
      "齿轮钟塔",
      "星辉王座",
    ]);
    expect(ARTIFACT_NAMES).toHaveLength(3);
    expect(ARTIFACT_EMOJI).toHaveLength(3);
  });

  it("每一关的形状都合法(石台有序、门在最后、守卫不越台)", () => {
    for (const lv of LEVELS) checkShape(lv);
  });

  it("188 关全部走得通:每个坑要么跳得过去,要么有藤环接着", () => {
    for (const lv of LEVELS) {
      expect(levelTraversable(lv)).toBe(true);
    }
  });

  it("能直接跳的坑一定比一次起跳的距离窄,要荡的坑一定超过步行上限", () => {
    expect(WALK_GAP_MAX).toBeLessThan(MAX_JUMP);
    expect(SWING_GAP_MIN).toBeGreaterThan(WALK_GAP_MAX);
    for (const lv of LEVELS) {
      for (const g of gapsOf(lv)) {
        expect(g.width).toBeGreaterThan(0);
        expect(g.width).toBeLessThanOrEqual(SWING_GAP_MAX);
        if (g.jumpable) expect(g.width).toBeLessThanOrEqual(WALK_GAP_MAX);
        else expect(g.width).toBeGreaterThanOrEqual(SWING_GAP_MIN);
      }
    }
  });

  it("每个藤环都在绳长之内:起跳点和落点都够得着", () => {
    for (const lv of LEVELS) {
      for (const g of gapsOf(lv)) {
        if (g.anchor < 0) continue;
        const a = lv.anchors[g.anchor];
        expect(dist(g.from, g.leftY, a.x, a.y)).toBeLessThanOrEqual(ROPE_MAX);
        expect(dist(g.to, g.rightY, a.x, a.y)).toBeLessThanOrEqual(ROPE_MAX);
      }
    }
  });

  it("每一关都是三件不同的神器,而且都稳稳落在石台上", () => {
    for (const lv of LEVELS) {
      expect(lv.artifacts).toHaveLength(3);
      expect(artifactsGrounded(lv)).toBe(true);
    }
  });

  it("神器分散在走廊前中后段,不会三件挤在同一块石台", () => {
    for (const lv of LEVELS) {
      const xs = lv.artifacts.map((a) => a.x).sort((p, q) => p - q);
      expect(xs[2] - xs[0]).toBeGreaterThan(lv.width * 0.25);
    }
  });

  it("同一关重复生成的结果完全一样(确定性)", () => {
    for (const i of [0, 37, 88, 120, 187]) {
      expect(JSON.stringify(buildLevel(i))).toBe(JSON.stringify(buildLevel(i)));
      expect(JSON.stringify(buildLevel(i))).toBe(JSON.stringify(LEVELS[i]));
    }
  });

  it("越往后走廊越长、目标时间越宽松", () => {
    const first = LEVELS.slice(0, 12);
    const last = LEVELS.slice(176);
    const avg = (xs: AdvLevel[], f: (l: AdvLevel) => number) => xs.reduce((s, l) => s + f(l), 0) / xs.length;
    expect(avg(last, (l) => l.width)).toBeGreaterThan(avg(first, (l) => l.width));
    expect(avg(last, (l) => l.parSec)).toBeGreaterThan(avg(first, (l) => l.parSec));
    for (const lv of LEVELS) expect(lv.parSec).toBeGreaterThanOrEqual(12);
  });

  it("心数在 4~5 之间,后面的章节少一颗", () => {
    for (const lv of LEVELS) {
      expect(lv.hearts).toBeGreaterThanOrEqual(4);
      expect(lv.hearts).toBeLessThanOrEqual(5);
    }
    expect(LEVELS[0].hearts).toBe(5);
    expect(LEVELS[187].hearts).toBe(4);
  });

  it("特色章节的手感参数对得上:冰川很滑、水里轻飘飘", () => {
    const ice = LEVELS[chapterStartLevel(2)];
    const water = LEVELS[chapterStartLevel(5)];
    const grass = LEVELS[0];
    expect(ice.frictionScale).toBeLessThan(grass.frictionScale);
    expect(water.gravityScale).toBeLessThan(1);
    expect(LEVELS[chapterStartLevel(6)].enemySpeed).toBeGreaterThan(grass.enemySpeed);
  });

  it("第一章是纯跑跳教学,一个藤环都不需要", () => {
    for (let i = 0; i < CHAPTERS[0].size; i++) {
      expect(LEVELS[i].anchors).toHaveLength(0);
      expect(gapsOf(LEVELS[i]).every((g) => g.jumpable)).toBe(true);
    }
  });

  it("后面的章节确实用上了抓钩", () => {
    const later = LEVELS.slice(chapterStartLevel(3));
    expect(later.filter((l) => l.anchors.length > 0).length).toBeGreaterThan(later.length * 0.4);
  });

  it("anchorCovers 会拒绝挂太低、太远、偏出坑口的藤环", () => {
    const gap = { from: 100, to: 300, leftY: 400, rightY: 400 };
    expect(anchorCovers(gap, { x: 200, y: 275 })).toBe(true);
    expect(anchorCovers(gap, { x: 200, y: 380 })).toBe(false);
    expect(anchorCovers(gap, { x: 600, y: 275 })).toBe(false);
    expect(anchorCovers(gap, { x: 200, y: 100 })).toBe(false);
  });

  it("chapterStartLevel 与章节切分一致", () => {
    expect(chapterStartLevel(0)).toBe(0);
    expect(chapterStartLevel(1)).toBe(CHAPTERS[0].size);
    expect(chapterStartLevel(CHAPTERS.length)).toBe(188);
  });
});

describe("冒险小王 · 无尽遗迹与速通赛道", () => {
  it("前 40 层都走得通,而且形状合法", () => {
    for (let f = 1; f <= 40; f++) {
      const lv = buildEndlessFloor(f);
      checkShape(lv);
      expect(levelTraversable(lv)).toBe(true);
      expect(artifactsGrounded(lv)).toBe(true);
      // 第 40 层起深层压力开始少给一颗心(见 `ruinsPressure`),再深也不会少于 2 颗
      expect(lv.hearts).toBe(f < 40 ? 4 : 3);
    }
  });

  it("守卫不会两只叠在同一块石台上,也不会堵住台面左边的落脚带", () => {
    const check = (lv: ReturnType<typeof buildEndlessFloor>) => {
      const seen = new Set<number>();
      for (const e of lv.enemies) {
        const host = lv.platforms.findIndex((p) => e.x >= p.x && e.x <= p.x + p.w);
        expect(host).toBeGreaterThan(0);
        expect(seen.has(host)).toBe(false);
        seen.add(host);
        expect(e.from).toBeGreaterThanOrEqual(lv.platforms[host].x + LANDING_STRIP);
      }
    };
    for (let f = 1; f <= 40; f++) check(buildEndlessFloor(f));
    for (const lv of LEVELS) check(lv);
  });

  it("层数越深走廊越长,同一层重开布局不变", () => {
    expect(buildEndlessFloor(20).platforms.length).toBeGreaterThan(buildEndlessFloor(2).platforms.length);
    expect(JSON.stringify(buildEndlessFloor(7))).toBe(JSON.stringify(buildEndlessFloor(7)));
    expect(JSON.stringify(buildEndlessFloor(7))).not.toBe(JSON.stringify(buildEndlessFloor(8)));
  });

  it("八条速通赛道各不相同,都走得通且带目标时间", () => {
    const shapes = new Set<string>();
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const lv = buildSpeedrunCourse(ci);
      checkShape(lv);
      expect(levelTraversable(lv)).toBe(true);
      expect(artifactsGrounded(lv)).toBe(true);
      expect(lv.parSec).toBeGreaterThan(10);
      shapes.add(JSON.stringify(lv));
    }
    expect(shapes.size).toBe(CHAPTERS.length);
  });

  it("赛道编号越界会被夹回合法章节", () => {
    expect(JSON.stringify(buildSpeedrunCourse(-3))).toBe(JSON.stringify(buildSpeedrunCourse(0)));
    expect(JSON.stringify(buildSpeedrunCourse(99))).toBe(JSON.stringify(buildSpeedrunCourse(CHAPTERS.length - 1)));
  });
});
