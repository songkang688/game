/**
 * 采矿花园 · 1.3 第 2 轮 A 档复验契约（对 r1 阻断 5-1 修复的边界加固）。
 *
 * 第 2 轮 headless 实测已证:第 1 关(窄盘)小地图 hidden 真隐藏(computed display:none)、
 * 中级林 16×16(宽盘)@320px 小地图可见且 canvas 240px 不越界。
 * 本文件把 drawMini 收敛公式的上下限两个边界钉死,防后续改动回退:
 *  - 巨大容器:画布不超过 300px 上限;
 *  - 极窄容器:96px 下限兜底,画布永远画得出来。
 */
import { afterEach, describe, expect, it } from "vitest";
import { mountField } from "./index";
import { installDom, type DomStub, type FakeEl } from "./testkit";

let dom: DomStub | null = null;

afterEach(() => {
  dom?.restore();
  dom = null;
});

function tap(cell: FakeEl): void {
  cell.fire("pointerdown", { button: 0 });
  cell.fire("pointerup", { button: 0 });
}

describe("mine-garden · 鸟瞰图收敛公式的上下限（r2 复验加固）", () => {
  it("容器再宽,画布也收在 300px 上限内;容器极窄时 96px 下限兜底", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 30,
      h: 16,
      mines: 99,
      seed: 4,
      sfx: () => undefined,
      autoSettle: false
    });
    const mini = dom.root.byClass("mn-mini")[0];
    const wrap = dom.root.byClass("mn-field")[0];
    const cells = dom.root.byClass("mn-cell");
    tap(cells[0]);

    const coveredCells: number[] = [];
    const b = field.run.board;
    for (let i = 0; i < b.state.length && coveredCells.length < 2; i++) {
      if (b.state[i] === 0) coveredCells.push(i);
    }

    // 上限:容器 2000px,画布仍 ≤300(避免小地图喧宾夺主)
    wrap.clientWidth = 2000;
    cells[coveredCells[0]].fire("contextmenu");
    expect(mini.width).toBeLessThanOrEqual(300);
    expect(mini.width).toBeGreaterThanOrEqual(240);

    // 下限:容器 60px,avail 用 96 兜底,画布照样画得出来且不为 0
    wrap.clientWidth = 60;
    cells[coveredCells[1]].fire("contextmenu");
    expect(mini.width).toBeGreaterThan(0);
    expect(mini.width).toBeLessThanOrEqual(96);
    field.destroy();
  });
});
