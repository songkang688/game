/**
 * 保龄球 · 「玩家一下都不按」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 *
 * 本款是三段式出手(① 力度 ② 落点 ③ 旋转,一段按一下),不按就没有球滚出去。
 * 所以「摆烂」在这一款是两层意思,两层各钉一条:
 *  1. **真机层**:进第 1 关之后一个键都不按,球台上的指针自己来回晃,
 *     但球不会自己脱手 —— 不结算、0 分、不发星星(用 `domStub` 真挂一次游戏);
 *  2. **规则层**:一球都不投就是 0 分,而 188 关每一关的过关线都 > 0 分,
 *     所以摆烂在规则上也不可能达标。
 */
import { afterEach, describe, expect, it } from "vitest";
import { allText, findButton, install, type Harness } from "./domStub";
import { ALL_LEVELS, buildLevel } from "./levels";
import { totalScore, turnState } from "./scoring";

let harness: Harness | null = null;
let game: { destroy: () => void } | null = null;

afterEach(() => {
  game?.destroy();
  game = null;
  harness?.restore();
  harness = null;
});

async function bootFirstLevel(): Promise<{ h: Harness; stars: number[] }> {
  const h = (harness = install());
  const stars: number[] = [];
  const mod = await import("./index");
  game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: (n: number) => void stars.push(n),
  } as never) as unknown as { destroy: () => void };
  const start = findButton(h.root, "开始冒险");
  expect(start, "选关页上没有「开始冒险」").not.toBeNull();
  start?.fire("click");
  h.flush(4);
  expect(allText(h.root), "点了「开始冒险」却没进第 1 关").toContain("第 1 关");
  return { h, stars };
}

describe("保龄球 · 摆烂:一下都不按", () => {
  it("第 1 关零输入:球不会自己脱手,3000 帧过去还是 0 分、第 1 格、没结算", async () => {
    const { h, stars } = await bootFirstLevel();
    for (let f = 0; f < 3000; f++) h.flush(1, 50);
    const text = allText(h.root);
    expect(text, "一个键都没按,球却滚出去了").toContain("0 分 · 已倒 0 瓶");
    expect(text, "摆烂居然自己走到了后面的格").toContain(`第 1/${buildLevel(0).frames} 格`);
    expect(text, "摆烂居然结算了").not.toContain("过关");
    expect(stars, "一球没投却发了星星").toEqual([]);
  });

  it("一球都不投就是 0 分,而 188 关的过关线全都 > 0 分", () => {
    const reachable: number[] = [];
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      expect(lv.target, `第 ${i + 1} 关的过关线不该是 0 分`).toBeGreaterThan(0);
      if (totalScore([], lv.frames) >= lv.target) reachable.push(i + 1);
    }
    expect(reachable, `一球不投也达标的:第 ${reachable.join(" / ")} 关`).toEqual([]);
    expect(ALL_LEVELS.length).toBe(188);
  });

  it("一球都不投的局面永远停在第 1 格,不会自己走完", () => {
    for (const i of [0, 59, 132, 187]) {
      const st = turnState([], buildLevel(i).frames);
      expect(st.over, `第 ${i + 1} 关一球没投却算打完了`).toBe(false);
      expect(st.frame).toBe(0);
      expect(st.ball).toBe(0);
    }
  });
});
