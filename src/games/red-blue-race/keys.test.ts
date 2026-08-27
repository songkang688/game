import { describe, expect, it } from "vitest";
import {
  BLUE_KEYS,
  RED_KEYS,
  bindRaceKeys,
  resolveRaceKey,
  type KeyHost,
  type RaceKeyEvent,
  type RaceKeyHit
} from "./keys";

/** 极简键盘宿主：只记着挂了几个监听，不引 jsdom */
function fakeHost(): KeyHost & { count: () => number; press: (key: string) => number } {
  const handlers: Array<(ev: RaceKeyEvent) => void> = [];
  return {
    addEventListener(_type, handler) {
      handlers.push(handler);
    },
    removeEventListener(_type, handler) {
      const i = handlers.indexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    },
    count: () => handlers.length,
    press(key) {
      let prevented = 0;
      const ev: RaceKeyEvent = { key, preventDefault: () => void prevented++ };
      for (const h of [...handlers]) h(ev);
      return prevented;
    }
  };
}

describe("红蓝赛跑 · 两套键位", () => {
  it("鸭梨 A / D 交替、W 跳；康康 ← / → 交替、↑ 跳", () => {
    expect(RED_KEYS.a).toBe("left");
    expect(RED_KEYS.d).toBe("right");
    expect(RED_KEYS.w).toBe("jump");
    expect(BLUE_KEYS.ArrowLeft).toBe("left");
    expect(BLUE_KEYS.ArrowRight).toBe("right");
    expect(BLUE_KEYS.ArrowUp).toBe("jump");
  });

  it("双人时各管各的，一个键都不许串到对面那条道", () => {
    expect(resolveRaceKey("a", true)).toEqual({ racer: "red", action: "left" });
    expect(resolveRaceKey("d", true)).toEqual({ racer: "red", action: "right" });
    expect(resolveRaceKey("f", true)).toEqual({ racer: "red", action: "jump" });
    expect(resolveRaceKey("ArrowLeft", true)).toEqual({ racer: "blue", action: "left" });
    expect(resolveRaceKey("ArrowRight", true)).toEqual({ racer: "blue", action: "right" });
    expect(resolveRaceKey("l", true)).toEqual({ racer: "blue", action: "jump" });
    // 双人时空格不归任何一方，免得两个人抢
    expect(resolveRaceKey(" ", true)).toBeNull();
  });

  it("单人时两套键都开给同一个人，空格也是跳", () => {
    expect(resolveRaceKey("ArrowLeft", false)).toEqual({ racer: "red", action: "left" });
    expect(resolveRaceKey("ArrowRight", false)).toEqual({ racer: "red", action: "right" });
    expect(resolveRaceKey("ArrowUp", false)).toEqual({ racer: "red", action: "jump" });
    expect(resolveRaceKey(" ", false)).toEqual({ racer: "red", action: "jump" });
    expect(resolveRaceKey("a", false)?.racer).toBe("red");
  });

  it("开着大写锁也按得动，不认识的键一律不响", () => {
    expect(resolveRaceKey("A", true)).toEqual({ racer: "red", action: "left" });
    expect(resolveRaceKey("D", true)).toEqual({ racer: "red", action: "right" });
    expect(resolveRaceKey("z", true)).toBeNull();
    expect(resolveRaceKey("Enter", true)).toBeNull();
    expect(resolveRaceKey("", true)).toBeNull();
  });

  it("挂上去就是两套监听，卸载后一个都不剩", () => {
    const host = fakeHost();
    const off = bindRaceKeys(host, true, () => {});
    expect(host.count()).toBe(2);
    off();
    expect(host.count()).toBe(0);
    // 重复卸载不会炸
    off();
    expect(host.count()).toBe(0);
  });

  it("卸载之后再按键，一个回调都不会跑", () => {
    const host = fakeHost();
    const hits: RaceKeyHit[] = [];
    const off = bindRaceKeys(host, true, (hit) => hits.push(hit));
    host.press("a");
    host.press("ArrowRight");
    expect(hits).toEqual([
      { racer: "red", action: "left" },
      { racer: "blue", action: "right" }
    ]);
    off();
    host.press("a");
    host.press("ArrowRight");
    expect(hits).toHaveLength(2);
  });

  it("同一个键只会触发一次，而且会拦掉浏览器默认行为", () => {
    const host = fakeHost();
    const hits: RaceKeyHit[] = [];
    const off = bindRaceKeys(host, false, (hit) => hits.push(hit));
    expect(host.press(" ")).toBe(1);
    expect(hits).toHaveLength(1);
    expect(host.press("ArrowLeft")).toBe(1);
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.racer === "red")).toBe(true);
    // 不认识的键既不回调也不拦默认行为
    expect(host.press("q")).toBe(0);
    expect(hits).toHaveLength(2);
    off();
  });
});
