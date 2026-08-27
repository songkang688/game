/**
 * 弹弓小鸟 · 「玩家一只鸟都不发射」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 * 附录 B.2 也记了一句:这一款在纯逻辑层「没有干净的完全不动口子」——
 * 因为本款的输入是「拉弓」,不拉就不会有任何输入事件。可**世界照样在走**:
 * 积木会塌、气球会飘、石头会滚,`index.ts` 的 `updateFlow()` 每一帧都在问
 * `beansAlive() === 0`,一旦为 0 就判过关。所以「摆烂」在这一款的准确说法是
 * **一只鸟都不上弦,只让场地自己动**——这正是这里跑的模型。
 *
 * 用的是线上同一套定步长物理(`world.ts` 的 `advance`),和 `solvable.test.ts`
 * 求解时用的是同一份世界,不另造第二套模拟。
 */
import { describe, expect, it } from "vitest";
import { LEVELS, targetCount } from "./levels";
import { advance, beansAlive, createWorld } from "./world";

/** 空跑多久:比任何一次弹道演出都长得多,够场地自己塌完 */
const IDLE_SECONDS = 20;
const DT = 1 / 60;

/** 建好世界之后一只鸟都不上弦,只把时间推过去 */
function idleBeans(level: (typeof LEVELS)[number]): number {
  const w = createWorld(level);
  for (let i = 0; i < IDLE_SECONDS * 60; i++) advance(w, DT);
  return beansAlive(w);
}

describe("弹弓小鸟 · 摆烂:一只鸟都不发射", () => {
  it("第 1 关零输入 20 秒:绿绿豆一颗都不会自己掉", () => {
    const lv = LEVELS[0];
    expect(lv.id).toBe(1);
    expect(idleBeans(lv), "第 1 关不拉弓也把豆清完了").toBe(targetCount(lv));
    expect(targetCount(lv)).toBeGreaterThan(0);
  });

  it("全 188 关零输入:一关都不会自己通关", () => {
    const cleared: number[] = [];
    for (const lv of LEVELS) {
      if (idleBeans(lv) === 0) cleared.push(lv.id);
    }
    expect(cleared, `不拉弓也通关的:第 ${cleared.join(" / ")} 关`).toEqual([]);
  }, 60000);

  it("全 188 关零输入:场地自己塌也带不走任何一颗绿绿豆", () => {
    const shrunk: string[] = [];
    for (const lv of LEVELS) {
      const left = idleBeans(lv);
      if (left !== targetCount(lv)) shrunk.push(`第 ${lv.id} 关 ${targetCount(lv)}→${left}`);
    }
    expect(shrunk, `零输入却少了豆的关:${shrunk.join("、")}`).toEqual([]);
  }, 60000);
});
