import { describe, expect, it } from "vitest";
import { stagePlayRoom } from "./stageRoom";

class FakeEl {
  className: string;
  clientWidth: number;
  clientHeight: number;
  offsetHeight: number;
  parentElement: FakeEl | null = null;
  children: FakeEl[] = [];

  constructor(
    className: string,
    size: { w?: number; h?: number; offsetH?: number } = {}
  ) {
    this.className = className;
    this.clientWidth = size.w ?? 0;
    this.clientHeight = size.h ?? 0;
    this.offsetHeight = size.offsetH ?? size.h ?? 0;
  }

  append(child: FakeEl): void {
    child.parentElement = this;
    this.children.push(child);
  }

  querySelector(sel: string): FakeEl | null {
    const token = sel.replace(/^\./, "");
    const walk = (n: FakeEl): FakeEl | null => {
      if (n.className.split(/\s+/).includes(token)) return n;
      for (const c of n.children) {
        const hit = walk(c);
        if (hit) return hit;
      }
      return null;
    };
    for (const c of this.children) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  }
}

describe("stagePlayRoom", () => {
  it("没有宿主时退回 fallback，且宽高都是正数", () => {
    expect(stagePlayRoom(null, { w: 320, h: 400 })).toEqual({ w: 320, h: 400 });
    expect(stagePlayRoom(undefined, { w: 0, h: -8 })).toEqual({ w: 360, h: 420 });
  });

  it("量得到 .game-stage 时，高度要扣掉关内抬头", () => {
    const stage = new FakeEl("game-stage", { w: 360, h: 520 });
    const wrap = new FakeEl("l99-stage-wrap", { w: 352, h: 512 });
    const bar = new FakeEl("l99-stagebar", { w: 352, h: 120, offsetH: 120 });
    const host = new FakeEl("l99-stage", { w: 340, h: 0 });
    stage.append(wrap);
    wrap.append(bar);
    wrap.append(host);
    const room = stagePlayRoom(host as unknown as HTMLElement, { w: 360, h: 900 });
    expect(room.w).toBe(340);
    // 520 - 120 - 16 边距
    expect(room.h).toBe(384);
  });

  it("舞台还没量到高度时不要用 0，退回 fallback 高", () => {
    const host = new FakeEl("orphan", { w: 280, h: 0 });
    const room = stagePlayRoom(host as unknown as HTMLElement, { w: 200, h: 333 });
    expect(room.w).toBe(280);
    expect(room.h).toBe(333);
  });
});
