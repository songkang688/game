/**
 * 冰冰火火森林 · 「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 *
 * 本款没有 AI 队友(单人模式是「按 Tab 换人,另一位留在原地」,见 `solo.test.ts`),
 * 所以「玩家不动」就等于「场上没人动」——不像 `prince-princess` 那样有搭档替你走。
 * 两层各钉一条:
 *  1. **规则层**:全 188 关,两人站在出生点(含传送带自己带走的那一段)都不是过关姿势,
 *     而 `isWin` 只在走完一步之后才会被问到,所以不动就永远出不了结算;
 *  2. **真机层**:第 1 关挂机到限时,弹出的是「时间用完啦」,一颗星都不发。
 */
import { afterEach, describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { allText, install, type Harness } from "./domStub";
import { analyzeLevel } from "./levels";
import { initialState, isWin, parseLevel, settle, type GameState } from "./logic";

let harness: Harness | null = null;
let game: { openCampaignLevel: (n: number) => number; destroy: () => void } | null = null;

afterEach(() => {
  game?.destroy();
  game = null;
  harness?.restore();
  harness = null;
});

/** 开局摆着不动:只让传送带把人带到它要带到的地方,之后状态就再也不变了 */
function idleState(level: number): { st: GameState; win: boolean } {
  const parsed = parseLevel(analyzeLevel(level).grid);
  const st = initialState(parsed);
  settle(parsed, st);
  return { st, win: isWin(parsed, st) };
}

describe("冰冰火火森林 · 摆烂:一个键都不按", () => {
  it("第 1 关零输入:两个人都还在出生点,不是过关姿势", () => {
    const parsed = parseLevel(analyzeLevel(0).grid);
    const { st, win } = idleState(0);
    expect(win, "第 1 关摆烂居然就算过关").toBe(false);
    expect(st.ice === parsed.iceDoor && st.fire === parsed.fireDoor).toBe(false);
  });

  it("全 188 关零输入:一关都不算过关", () => {
    const won: number[] = [];
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      if (idleState(i).win) won.push(i + 1);
    }
    expect(won, `摆烂过关的:第 ${won.join(" / ")} 关`).toEqual([]);
    expect(TOTAL_LEVELS).toBe(188);
  }, 60000);

  it("零输入的局面是死的:再怎么结算传送带,状态也不会自己往门口挪", () => {
    for (const i of [0, 59, 132, 187]) {
      const parsed = parseLevel(analyzeLevel(i).grid);
      const st = initialState(parsed);
      settle(parsed, st);
      const snapshot = { ...st };
      for (let k = 0; k < 20; k++) settle(parsed, st);
      expect(st, `第 ${i + 1} 关摆烂时状态还在自己变`).toEqual(snapshot);
    }
  });

  it("真机第 1 关挂机到限时:弹的是「时间用完啦」,一颗星都不发", async () => {
    const h = (harness = install());
    const stars: number[] = [];
    const mod = await import("./index");
    game = mod.mount({
      root: h.root as unknown as HTMLElement,
      play: () => {},
      addStars: (n: number) => {
        stars.push(n);
        return n;
      },
      getStars: () => 0,
      onWin: () => {},
      onLose: () => {},
    } as never) as unknown as NonNullable<typeof game>;
    expect(game.openCampaignLevel(1)).toBe(1);
    h.flush(2);
    // 第 1 关限时 120 秒;一帧 50ms 走 3000 帧 = 150 秒,够它走到头
    for (let f = 0; f < 3000; f++) h.flush(1, 50);
    const text = allText(h.root);
    expect(text, "挂机到限时却没弹「时间用完啦」").toContain("时间用完啦");
    expect(text, "摆烂居然结算成过关").not.toContain("通关");
    expect(stars, "一步没走却发了星星").toEqual([]);
  }, 30000);
});
