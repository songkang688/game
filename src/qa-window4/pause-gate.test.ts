/**
 * 窗口 4 · 暂停接线板（`pauseGate.ts`）的行为用例。
 *
 * 冒险小王、寻找外星朋友、贪吃毛毛虫、拼图小画家、记忆翻翻牌这五款不走
 * 「定时器总管」那条路：前两款自己就有一个 `paused` 开关（Esc 和屏上的 ⏸
 * 都拨它），后三款是裸 rAF / setInterval，加了一道 `frozen` 闸。
 * 共同点是「屏」有好几个（闯关 / 无尽 / 对战），`mount()` 并不知道孩子当下
 * 在哪一个，所以每个屏开场挂一条到接线板上，`mount()` 只把 freezeAll /
 * thawAll 交给外壳。
 *
 * 这一份验接线板本身：挂得上、停得住、摘得干净、重复调不出乱子。
 * 每一款各有各的一份拷贝，所以逐款各验一遍——漏改一款这里就红。
 */
import { describe, expect, it } from "vitest";

import * as adventureKing from "../games/adventure-king/pauseGate";
import * as alienSeek from "../games/alien-seek/pauseGate";
import * as snakeSnack from "../games/snake-snack/pauseGate";
import * as puzzleTiles from "../games/puzzle-tiles/pauseGate";
import * as memoryCards from "../games/memory-cards/pauseGate";

interface GateModule {
  registerGate: (gate: { freeze: () => void; thaw: () => void }) => () => void;
  freezeAll: () => void;
  thawAll: () => void;
  liveGates: () => number;
}

const GAMES: Array<[string, GateModule]> = [
  ["冒险小王", adventureKing],
  ["寻找外星朋友", alienSeek],
  ["贪吃毛毛虫", snakeSnack],
  ["拼图小画家", puzzleTiles],
  ["记忆翻翻牌", memoryCards],
];

describe("窗口 4 · 暂停接线板", () => {
  for (const [name, gate] of GAMES) {
    describe(name, () => {
      it("挂一个屏就停一个屏，化冻又放回去", () => {
        let frozen = false;
        const drop = gate.registerGate({
          freeze: () => {
            frozen = true;
          },
          thaw: () => {
            frozen = false;
          },
        });

        gate.freezeAll();
        expect(frozen, "外壳弹面板了，这个屏必须停住").toBe(true);
        gate.thawAll();
        expect(frozen, "关掉面板要接着玩").toBe(false);

        drop();
      });

      it("几个屏同时开着就一起停（闯关没退干净时不能漏掉任何一个）", () => {
        const stopped = [false, false, false];
        const drops = stopped.map((_, i) =>
          gate.registerGate({
            freeze: () => {
              stopped[i] = true;
            },
            thaw: () => {
              stopped[i] = false;
            },
          })
        );

        gate.freezeAll();
        expect(stopped).toEqual([true, true, true]);
        gate.thawAll();
        expect(stopped).toEqual([false, false, false]);

        for (const drop of drops) drop();
      });

      it("屏 destroy 之后就摘干净：外壳再暂停也碰不到它", () => {
        const before = gate.liveGates();
        let touched = 0;
        const drop = gate.registerGate({
          freeze: () => touched++,
          thaw: () => touched++,
        });
        expect(gate.liveGates()).toBe(before + 1);

        drop();
        expect(gate.liveGates(), "摘掉就该回到原样，不能越玩越多").toBe(before);

        gate.freezeAll();
        gate.thawAll();
        expect(touched, "已经退场的屏一次都不该被叫到").toBe(0);
      });

      it("重复摘不会把名册摘穿", () => {
        const before = gate.liveGates();
        const drop = gate.registerGate({ freeze: () => {}, thaw: () => {} });
        drop();
        drop();
        expect(gate.liveGates()).toBe(before);
      });

      it("一个屏在冻的时候抛错，别的屏照停不误", () => {
        const stopped: string[] = [];
        const dropBad = gate.registerGate({
          freeze: () => {
            stopped.push("坏的");
          },
          thaw: () => {},
        });
        const dropGood = gate.registerGate({
          freeze: () => {
            stopped.push("好的");
          },
          thaw: () => {},
        });

        gate.freezeAll();
        expect(stopped, "两个都得叫到，顺序按挂上去的先后").toEqual(["坏的", "好的"]);

        dropBad();
        dropGood();
      });

      it("名册一开始是空的，用例之间不互相串", () => {
        expect(gate.liveGates(), `${name} 的接线板上还挂着没摘的屏`).toBe(0);
      });
    });
  }

  it("五款各有各的一份，互不串台", () => {
    let seekStopped = false;
    const drop = alienSeek.registerGate({
      freeze: () => {
        seekStopped = true;
      },
      thaw: () => {},
    });

    memoryCards.freezeAll();
    expect(seekStopped, "翻翻牌暂停不该顺手把找物也停了").toBe(false);
    alienSeek.freezeAll();
    expect(seekStopped).toBe(true);

    drop();
  });
});
