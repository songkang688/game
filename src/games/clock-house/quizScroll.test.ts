/**
 * 守门：钳出滚动条那一档，选项整排得**一进来就露在外面**（窗口5 第 2 轮档A，W5R2-F-A-01 续）。
 *
 * 上一任的 `5793f04` 给答题屏配了本款自己的宿主并按舞台下沿钳住，这一条我独立复测过，
 * 是真修：320×568 上 6 组里第三个选项从「怎么划都够不着」变成「划得到」。
 * 但复测同时量出它只走了一半——真机上（Chrome headless + CDP）第三个选项
 * 一进关**仍旧整颗在裁切线以下**，clock-house 第 41 / 91 / 171 关分别差 44 / 40 / 11px，
 * `elementFromPoint(键心)` 拿回来的不是它。宿主现在能滚了，可孩子看到的是「只有两个选项」，
 * 屏幕上没有任何东西告诉他底下还有第三个——够得着和找得着是两回事。
 *
 * 所以钳完之后再把宿主自己滚一小段，把选项整排的下沿带进可视段。
 * 滚的是**最小的那一段**（不是滚到底），题面尽量留在眼前：
 * 第 41 关实测只要滚 82px（宿主一共能滚 124px），钟面照旧看得见。
 */
import { describe, expect, it } from "vitest";
import { fitQuizHost, scrollToShowPx } from "./fit";

describe("时钟小屋 · 钳出滚动条之后把选项整排带进眼里", () => {
  describe("scrollToShowPx", () => {
    it("要露的那一段在下面：只滚到刚好露出它的下沿，多一个像素都不滚", () => {
      // 第 41 关实测：选项整排在宿主内容里占 [221, 418]，可视段 336px，最多能滚 124px
      expect(scrollToShowPx(221, 418, 336, 124)).toBe(82);
    });

    it("本来就整排露着就一动不动", () => {
      expect(scrollToShowPx(100, 300, 336, 124)).toBe(0);
    });

    it("它比可视段还高（描红卡那种）：从它自己的上沿开始露，先看得见头", () => {
      expect(scrollToShowPx(120, 600, 336, 900)).toBe(120);
    });

    it("再怎么要露也不许滚过头，卡在能滚的上限里", () => {
      expect(scrollToShowPx(500, 900, 336, 124)).toBe(124);
    });

    it("量不出可视段 / 根本不能滚就返回 0，不平白写一个 scrollTop 进去", () => {
      expect(scrollToShowPx(221, 418, 0, 124)).toBe(0);
      expect(scrollToShowPx(221, 418, 336, 0)).toBe(0);
      expect(scrollToShowPx(Number.NaN, 418, 336, 124)).toBe(0);
    });
  });

  describe("fitQuizHost 钳完顺手滚一小段", () => {
    /** 只够 fitQuizHost 用的假 DOM，外加 querySelector / clientHeight / scrollTop */
    class View {
      getComputedStyle(el: El): { overflowY: string } {
        return { overflowY: el.overflowY };
      }
      addEventListener(): void {}
      removeEventListener(): void {}
    }
    class El {
      readonly style: Record<string, string> = { maxHeight: "", overflowY: "", overscrollBehavior: "" };
      parentElement: El | null = null;
      overflowY = "visible";
      top = 0;
      content = 0;
      scrollTop = 0;
      child: El | null = null;
      /** 这一排在宿主内容坐标里的位置（不随 scrollTop 变，getBoundingClientRect 里才减） */
      offset = 0;
      constructor(readonly view: View) {}
      get ownerDocument(): { defaultView: View } {
        return { defaultView: this.view };
      }
      get scrollHeight(): number {
        return this.content;
      }
      get clientHeight(): number {
        const capped = Number.parseFloat(this.style.maxHeight);
        return Number.isFinite(capped) ? Math.min(this.content, capped) : this.content;
      }
      querySelector(): El | null {
        return this.child;
      }
      getBoundingClientRect(): { top: number; bottom: number; height: number } {
        return { top: this.top, bottom: this.top + this.clientHeight, height: this.clientHeight };
      }
      asEl(): HTMLElement {
        return this as unknown as HTMLElement;
      }
    }

    /** 320×568 实测：舞台裁在 y=554，宿主从 y=218 起，内容 460px；选项整排在 [221, 418] */
    function build(stageBottom: number, content: number) {
      const view = new View();
      const stage = new El(view);
      stage.overflowY = "hidden";
      stage.top = 88;
      stage.content = stageBottom - 88;
      const host = new El(view);
      host.top = 218;
      host.content = content;
      host.parentElement = stage;
      const choices = new El(view);
      choices.offset = 221;
      choices.content = 197;
      choices.parentElement = host;
      // 选项整排在屏幕上的位置＝宿主上沿 + 内容里的位置 − 已经滚掉的那一段
      Object.defineProperty(choices, "top", {
        get: () => host.top + choices.offset - host.scrollTop,
      });
      host.child = choices;
      return { host, choices };
    }

    it("320×568：钳完之后选项整排的下沿真的进了可视段（原来整颗在裁切线以下）", () => {
      const { host, choices } = build(554, 460);
      const fit = fitQuizHost(host.asEl());
      expect(host.style.overflowY).toBe("auto");
      expect(host.scrollTop).toBeGreaterThan(0);
      expect(choices.getBoundingClientRect().bottom).toBeLessThanOrEqual(554);
      // 只滚最小的那一段，没有一路滚到底——题面还留着大半
      expect(host.scrollTop).toBeLessThan(host.scrollHeight - host.clientHeight);
      fit.dispose();
    });

    it("360×640 装得下那一档：不钳、不滚，一个像素不改", () => {
      const { host } = build(626, 380);
      const fit = fitQuizHost(host.asEl());
      expect(host.style.overflowY).toBe("");
      expect(host.style.maxHeight).toBe("");
      expect(host.scrollTop).toBe(0);
      fit.dispose();
    });

    it("换一题重量：题面变矮到装得下，钳位与滚动一起还回去", () => {
      const { host } = build(554, 460);
      const fit = fitQuizHost(host.asEl());
      expect(host.scrollTop).toBeGreaterThan(0);
      host.content = 300;
      fit.relayout();
      expect(host.style.maxHeight).toBe("");
      expect(host.scrollTop).toBe(0);
      fit.dispose();
    });
  });
});
