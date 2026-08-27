/**
 * 糖果秋千 · 「玩家一下都不点」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 *
 * **走的是真机那条路,不是 `sim.ts`。** 本款还挂着一条观察项 O1:
 * `sim.ts` 空跑 20 秒有 20 关糖果会自己掉进怪物嘴里,而浏览器 45 秒摆烂复现不出来
 * (`docs/qa/1.2-window3-round3-tester.md` §7 与 8.1)。所以这里一律用
 * `index.ts` 的 `mount()` + `openCampaignLevel()` 真跑一遍 —— 玩家的手指
 * 一次都不落在画布上,帧照常走,判定链走的是产品代码里那一套。
 *
 * 钉三件事:
 *  1. 第 1 关零输入吃不到糖 —— 新玩家的第一关不是白送的;
 *  2. 浏览器走查点名的第 1 / 60 / 133 / 188 关,45 秒零输入照样不结算过关;
 *  3. 全 188 关扫一遍,**会自己吃到糖的就是已备案的那 20 关,一关都不许多**。
 *     这一条是「钉住现在」:O1 那 20 关按派发单不动物理,但**不许再长出第 21 关**。
 *
 * 顺带回答了 O1 里那句「`sim.ts` 和真机是不是同一套物理」:
 * 这条真机路径扫出来的名单,与 `sim.ts` 空跑 20 秒扫出来的名单**逐关一致**。
 */
import { afterEach, describe, expect, it } from "vitest";
import { findOne, install, type Harness } from "./domStub";
import { LEVELS } from "./levels";
import { makeSimFor, runSim } from "./sim";

/** 一帧 16ms,和 `tick()` 里的定步长对得上:1250 帧 = 20 秒 */
const FRAMES_20S = 1250;
const FRAMES_45S = 2813;

/** 吃到糖时 `.cs-msg` 上写的那句话(`winLevel()` 里唯一的闯关结算文案) */
const ATE = "啾啾吃到糖果啦";
/** 糖果掉出界 / 被扎 / 被抢时的那句 */
const FAILED = "没关系";

let harness: Harness | null = null;
let game: Game | null = null;

interface Game {
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

afterEach(() => {
  game?.destroy();
  game = null;
  harness?.restore();
  harness = null;
});

async function boot(): Promise<{ h: Harness; g: Game }> {
  const h = (harness = install());
  const mod = await import("./index");
  const g = (game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    onWin: () => {},
    onLose: () => {},
  } as never) as unknown as Game);
  return { h, g };
}

type Outcome = "ate" | "failed" | "playing";

/**
 * 直达第 n 关(1 基)之后一下都不点,只把帧放过去。
 * 画布上不发 pointerdown / pointermove,也不按任何键 —— 就是把手机搁桌上。
 */
function idleLevel(h: Harness, g: Game, n: number, frames = FRAMES_20S): Outcome {
  g.openCampaignLevel(n);
  const msg = findOne(h.root, "cs-msg");
  if (!msg) throw new Error(`第 ${n} 关没进去:HUD 上没有 .cs-msg`);
  for (let f = 0; f < frames; f++) {
    h.flush(1);
    const text = msg.textContent;
    if (text.includes(ATE)) return "ate";
    if (text.includes(FAILED)) return "failed";
  }
  return "playing";
}

/**
 * O1 备案名单:真机路径下空跑 20 秒糖果会自己进嘴的 20 关(1 基)。
 * 其中 8 关 `solve.kind = "wait"` 本来就是「等场上机关自己动」的设计;
 * 另外 12 关(cut 5 关 / search 7 关)是 O1 观察项,按派发单不动物理。
 * **这份名单只许变短,不许变长。**
 */
const KNOWN_IDLE_EATS: readonly number[] = [
  21, 28, 38, 39, 46, 47, 51, 73, 77, 78, 86, 87, 89, 90, 91, 95, 96, 120, 167, 180,
];

describe("糖果秋千 · 摆烂:一下都不点", () => {
  it("第 1 关零输入 20 秒:糖果不会自己进嘴,结算不了过关", async () => {
    const { h, g } = await boot();
    expect(idleLevel(h, g, 1)).not.toBe("ate");
  });

  it("浏览器走查点名的第 1 / 60 / 133 / 188 关:45 秒零输入都不结算过关", async () => {
    const { h, g } = await boot();
    for (const n of [1, 60, 133, 188]) {
      expect(idleLevel(h, g, n, FRAMES_45S), `第 ${n} 关零输入居然吃到糖了`).not.toBe("ate");
    }
  }, 30000);

  it("全 188 关零输入:会自己吃到糖的就是备案的那 20 关,一关都不许多", async () => {
    const { h, g } = await boot();
    const ate: number[] = [];
    for (let n = 1; n <= LEVELS.length; n++) {
      if (idleLevel(h, g, n) === "ate") ate.push(n);
    }
    const extra = ate.filter((n) => !KNOWN_IDLE_EATS.includes(n));
    expect(extra, `新长出来的零输入过关:第 ${extra.join(" / ")} 关`).toEqual([]);
    expect(ate.length).toBeLessThanOrEqual(KNOWN_IDLE_EATS.length);
  }, 60000);

  it("备案的那 20 关里,8 关是 solve.kind = wait 的设计如此,其余是 O1 观察项", () => {
    const wait = KNOWN_IDLE_EATS.filter((n) => LEVELS[n - 1].solve.kind === "wait");
    expect(wait.length).toBe(8);
    // 剩下的都要求玩家动手(cut / search),这一条对不上设计意图,是 O1
    for (const n of KNOWN_IDLE_EATS) {
      expect(["wait", "cut", "search"], `第 ${n} 关的 solve.kind`).toContain(LEVELS[n - 1].solve.kind);
    }
  });

  it("O1 的那句疑问:`sim.ts` 与真机是同一套物理 —— 两边扫出来的名单逐关一致", async () => {
    const bySim: number[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const w = makeSimFor(LEVELS[i]);
      runSim(w, 20);
      if (w.ate) bySim.push(i + 1);
    }
    expect(bySim).toEqual([...KNOWN_IDLE_EATS]);
  }, 30000);
});
