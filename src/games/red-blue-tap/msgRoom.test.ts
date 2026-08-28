/**
 * 红蓝点点 · 横过来拿的时候，「本关新玩法」那一行也得留在屏幕里
 * （1.2 窗口5 · 第 3 轮 · 档B 学习优化员，`W5R3-BT-03`）。
 *
 * `fitArena()` 里那句 `bottom - top - belowPx(el)` 本来就是**为这一行留的位置**
 * ——注释写得清清楚楚：「收场地时得把这一截让出来，不然提示整行掉在裁切线以下」。
 * 可它下面紧跟着一条下限：`arenaBoxPx()` 收到 `ARENA_FLOOR_PX = 80`（一整颗点）就不再收。
 * **两条规矩撞上的时候，谁也没管那一行。**
 *
 * 我自己在真机上量到的（CDP，五档 × L100/117/155/181/188 共 25 格）：
 *
 * ```
 * 640×360 L100/117/155/188   .rbt-msg 333–355，裁切线 348 → 被切 7px，能看见 15/22
 * 640×360 L181               芯片排折成两行(48px)，场地被顶到 270
 *                            .rbt-msg 360–382 → 被切 34px，能看见 0/22
 * 740×360 五关全中           同 640×360 的第一档，被切 7px
 * 844×390 / 360×640 / 320×568  0 切
 * ── 被切的 10/25，且这一行**不在任何可滚容器里**（往上找到 .game-stage 都不滚），划不出来
 * ```
 *
 * 这一行不只是开局那句招牌。整局里「☁️ 还没亮呢」「❄️ 冻住小电脑」「🧲 磁铁到手」
 * 都写在这里——横屏矮机上等于这一款把嘴闭上了。
 *
 * 修法**不动竞技场那条下限，也不给这一款加滚动条**（连点游戏，能滚就会「想点却滚走了」，
 * `fitArena` 的注释里写着）。缺的像素从**这一款自己上下那几行的留白**里省：
 * 横屏矮档把芯片排与提示行收紧一档，恰好把 7px 让出来，
 * 顺带让四颗芯片在 640px 宽上排回一行（L181 那 34px 就是第二行芯片撑出来的）。
 * 热区一分不动——`.rbt-dot` 是这一款唯一的操作对象。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARENA_FLOOR_PX,
  CHIP_TIGHT_FONT_PX,
  MSG_TIGHT_GAP_PX,
  MSG_TIGHT_MIN_PX,
  SHORT_LANDSCAPE_PX,
  arenaBoxPx,
  msgBudgetPx,
} from "./index";

const dir = fileURLToPath(new URL(".", import.meta.url));
const rawCss = readFileSync(`${dir}index.ts`, "utf8");
/** 源码里那条媒体查询长这样（读的是模板字面量，所以常量名是原样躺在文件里的） */
const TIGHT_AT = "@media (max-height: ${SHORT_LANDSCAPE_PX}px)";

/** 真机 640×360 / 740×360 上量到的那一组数（收紧之前） */
const REAL_640 = {
  clip: 348,
  /** 收紧之前场地的上沿：芯片排一行时 243、折成两行时 270 */
  arenaTopOneLine: 243,
  arenaTopTwoLines: 270,
  cssHeight: 320,
  /** 收紧之前提示行自己占的高度：`margin-top:10` + 行高 22 */
  msgWas: 32,
};

describe("红蓝点点 · 横屏矮档给「本关新玩法」那行留的位置", () => {
  it("**先摆事实**：按 640×360 真机那组数，收紧前场地下限和提示行是撞的", () => {
    const room = REAL_640.clip - REAL_640.arenaTopOneLine - REAL_640.msgWas;
    expect(room, "真机量到的余量").toBe(73);
    // 73 < 80：arenaBoxPx 会守住 ARENA_FLOOR_PX，多出来的 7px 就从提示行身上出
    expect(arenaBoxPx(REAL_640.cssHeight, room)).toBe(ARENA_FLOOR_PX);
    expect(ARENA_FLOOR_PX - room, "提示行被切掉的像素").toBe(7);
  });

  it("收紧之后，同一组数里场地下限和提示行不再撞（一行芯片那一档）", () => {
    const room = REAL_640.clip - REAL_640.arenaTopOneLine - msgBudgetPx();
    expect(
      room,
      `横屏矮档提示行只该占 ${MSG_TIGHT_GAP_PX}+${MSG_TIGHT_MIN_PX}px，省下来的正是被切掉的那 7px`
    ).toBeGreaterThanOrEqual(ARENA_FLOOR_PX);
    // 余量够了，arenaBoxPx 就会老老实实按余量收，而不是硬撑 80 把提示行顶出去
    expect(arenaBoxPx(REAL_640.cssHeight, room)).toBe(room);
  });

  it("提示行的预算是「留白 + 行高」，一个字都不许再挤", () => {
    expect(msgBudgetPx()).toBe(MSG_TIGHT_GAP_PX + MSG_TIGHT_MIN_PX);
    // 18px 是 14px 字号那一行的高度，再矮字就贴边了
    expect(MSG_TIGHT_MIN_PX).toBeGreaterThanOrEqual(18);
    expect(MSG_TIGHT_GAP_PX, "留白全省光会让提示行贴着场地下沿").toBeGreaterThanOrEqual(2);
  });

  it("横屏矮档那条媒体查询真的写进了样式，而且按常量走", () => {
    const at = rawCss.indexOf(TIGHT_AT);
    expect(at, "没有横屏矮档那一块，样式上就没人给提示行让位").toBeGreaterThan(0);
    const block = rawCss.slice(at, rawCss.indexOf("\n}", at));
    // 写死一个数就会和常量走散，用例也就钉不住了
    expect(block).toContain("margin-top: ${MSG_TIGHT_GAP_PX}px");
    expect(block).toContain("min-height: ${MSG_TIGHT_MIN_PX}px");
    // 芯片收一档，四颗才排得回一行（L181 那 34px 就是第二行芯片撑出来的）
    expect(block).toContain("font-size: ${CHIP_TIGHT_FONT_PX}px");
    expect(MSG_TIGHT_GAP_PX + MSG_TIGHT_MIN_PX).toBe(msgBudgetPx());
    expect(CHIP_TIGHT_FONT_PX, "芯片再小就看不清了").toBeGreaterThanOrEqual(12);
  });

  it("**热区一分没动**：`.rbt-dot` 与场地下限一个字节都没碰", () => {
    const at = rawCss.indexOf(TIGHT_AT);
    const block = rawCss.slice(at, rawCss.indexOf("\n}", at));
    expect(block, "收留白可以，收唯一那颗能点的东西不行").not.toContain(".rbt-dot");
    expect(ARENA_FLOOR_PX, "一整颗点(72)加两边各 4px 的边距").toBe(80);
  });

  it("竖屏那几档不受影响：媒体查询只在矮屏生效，且门槛盖得住 360/390 的横屏", () => {
    // 640×360 / 740×360 高 360，844×390 高 390，都得进；360×640 / 320×568 不许进
    expect(SHORT_LANDSCAPE_PX).toBeGreaterThanOrEqual(390);
    expect(SHORT_LANDSCAPE_PX).toBeLessThan(568);
  });
});
