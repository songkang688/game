/**
 * 采矿花园 · 1.3 第 1 轮 C 档修复契约（对应 A 档 5-1 阻断）。
 *
 *  ① `.mn-mini` 的 display:block 曾盖掉 UA 的 [hidden]{display:none}，
 *     小地图收起时仍留一块空底板——现在 CSS 必须补回 `.mn-mini[hidden]{display:none}`；
 *  ② 鸟瞰图画布曾按固定 300px 基准画，320px 视口下越界 14px——
 *     现在按容器实际宽收敛，CSS 再上 box-sizing:border-box + max-width:100% 双保险。
 */
import { afterEach, describe, expect, it } from "vitest";
import { MN_CSS, mountField } from "./index";
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

describe("mine-garden · 小地图 hidden 生效与 320px 收敛（A 档 5-1 阻断）", () => {
  it("CSS 把 [hidden] 的 display:none 补了回来，且画布带 max-width 兜底", () => {
    expect(MN_CSS).toContain(".mn-mini[hidden]{display:none;}");
    const rule = MN_CSS.slice(MN_CSS.indexOf(".mn-mini{"), MN_CSS.indexOf(".mn-mini[hidden]"));
    expect(rule).toContain("max-width:100%");
    expect(rule).toContain("box-sizing:border-box");
  });

  it("容器不足 300px 时鸟瞰图画布按容器宽收敛，不再越界", () => {
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
    expect(mini.hidden).toBe(false);
    expect(mini.width).toBeLessThanOrEqual(300);

    const cells = dom.root.byClass("mn-cell");
    tap(cells[0]);
    // 模拟 320px 视口：容器只剩 240px，下一次重画必须收进 240-8=232 之内
    dom.root.byClass("mn-field")[0].clientWidth = 240;
    const b = field.run.board;
    let covered = -1;
    for (let i = 0; i < b.state.length; i++) {
      if (b.state[i] === 0) {
        covered = i;
        break;
      }
    }
    cells[covered].fire("contextmenu");
    expect(mini.width).toBeLessThanOrEqual(232);
    expect(mini.width).toBeGreaterThan(0);
    field.destroy();
  });
});
