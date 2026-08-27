/**
 * bumper-cars · 摆烂通关根因诊断。
 *
 * 照 index.ts 闯关那一支原样搭局、玩家一个键不按,把每一台对手车挂上台沿的那一刻记下来:
 * 挂之前它在往哪儿开、离台沿多远、有没有外飘速度、多久之前挨过撞。
 * 用来回答「对手到底是怎么自己下去的」——是自己开出去的,还是被滚桶/弹簧/自己人挤出去的。
 *
 * 走 vitest 是因为 levels.ts 顺着 level99 拉到了头像图片,裸 node 解析不了 .png。
 * 跑法:BC_LEVELS=1,3,11 npx vitest run --config scripts/qa-window3/vitest.config.ts bcdiag
 */
import { describe, it, expect } from "vitest";

const TICK = 16;
const LEVELS = (process.env.BC_LEVELS ?? "1,3,11").split(",").map(Number);

describe("bumper-cars 摆烂根因", () => {
  it("逐关记录对手挂台沿前的姿态", async () => {
    const { buildLevel } = await import("../../src/games/bumper-cars/levels");
    const A = await import("../../src/games/bumper-cars/ai");
    const logic = await import("../../src/games/bumper-cars/logic");

    for (const human of LEVELS) {
      const i = human - 1;
      const lv = buildLevel(i);
      const cars = [
        logic.makeCar({ id: 0, name: "鸭梨", emoji: "🌸", color: "#e8558f", team: 0, x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts, ai: true }),
        ...lv.foes.map((foe, k) => {
          const spot = lv.foeSpawns[k] ?? lv.foeSpawns[0] ?? lv.spawn;
          return logic.makeCar({ id: k + 1, name: foe.name, emoji: foe.emoji, color: foe.color, team: 1, x: spot.x, y: spot.y, lives: foe.lives, mass: foe.mass, r: foe.r, ai: true });
        }),
      ];
      const w = logic.createWorld({
        field: lv.field, cars, pads: lv.pads, hazards: lv.hazards, spinners: lv.spinners,
        slicks: lv.slicks, limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, keep: lv.keep, seed: lv.seed,
      });
      const skills = [3, ...lv.foes.map((f) => f.skill)];
      // 每台车最近一次「还站在台面上」那一帧的样子,掉下去之后回头看它
      const last: (Record<string, unknown> | null)[] = w.cars.map(() => null);
      const log: Record<string, unknown>[] = [];
      let tick = 0;
      let ms = 0;
      for (; ms < lv.seconds * 1000; ms += TICK) {
        if (logic.levelCleared(w) || logic.playerDown(w)) break;
        const hunters = A.huntersFor(w, lv.hunters, w.time);
        const intents = w.cars.map((_, k) =>
          k === 0 ? logic.IDLE : A.chooseCarAction(w, k, (skills[k] ?? 2) as never, tick + k * 7, hunters.has(k) ? "hunt" : "patrol")
        );
        w.cars.forEach((c, k) => {
          if (c.teeter > 0 || c.out || c.gone) return;
          const center = logic.fieldCenter(w.field);
          const backLen = Math.max(0.001, logic.hypot(center.x - c.x, center.y - c.y));
          const inX = (center.x - c.x) / backLen;
          const inY = (center.y - c.y) / backLen;
          last[k] = {
            at: ms,
            edge: +logic.worldEdge(w, c.x, c.y).toFixed(1),
            speedOut: +(-(c.vx * inX + c.vy * inY)).toFixed(1),
            aimOut: +(-(intents[k].dx * inX + intents[k].dy * inY)).toFixed(2),
            hunt: hunters.has(k) ? "hunt" : "patrol",
            skill: skills[k] ?? 2,
            hitAgo: c.lastPushBy >= 0 ? Math.round(w.time - c.lastPushAt) : -1,
            dash: intents[k].dash === true,
          };
        });
        tick++;
        w.events.length = 0;
        logic.stepWorld(w, TICK, intents);
        for (const e of w.events) {
          if (e.kind === "teeter" && last[e.who]) log.push({ id: e.who, ...last[e.who] });
        }
        if (process.env.BC_TRACE && ms % 320 === 0) {
          const line = w.cars
            .map((c, k) => {
              const center = logic.fieldCenter(w.field);
              const backLen = Math.max(0.001, logic.hypot(center.x - c.x, center.y - c.y));
              const inX = (center.x - c.x) / backLen;
              const inY = (center.y - c.y) / backLen;
              const out = -(c.vx * inX + c.vy * inY);
              return `${k}:(${c.x.toFixed(0)},${c.y.toFixed(0)}) 沿${logic.worldEdge(w, c.x, c.y).toFixed(0)} 外${out.toFixed(0)} 头${(-(intents[k].dx * inX + intents[k].dy * inY)).toFixed(1)}${c.teeter > 0 ? " 打转" : ""}${c.out ? " 出局" : ""}`;
            })
            .join("  |  ");
          console.log(`   ${String(ms).padStart(6)}ms ${line}`);
        }
      }

      const res = logic.levelCleared(w) ? "摆烂通关" : logic.playerDown(w) ? "正常判负" : "僵持";
      console.log(`\n=== 第 ${human} 关 · ${res} · ${Math.round(ms / 1000)}s · 场地 ${lv.field.w}x${lv.field.h} ===`);
      console.log(
        `   滚桶 ${lv.hazards.length} · 转盘 ${lv.spinners.length} · 加速带 ${lv.pads.length} · 冰面 ${lv.slicks.length} · 对手档位 ${lv.foes.map((f) => f.skill).join(",")}`
      );
      for (const l of log.slice(0, 16)) {
        console.log(
          `   ${String(l.at).padStart(6)}ms  ${l.id}号(${l.skill}档,${l.hunt}) 挂台沿 · 挂之前:离沿 ${l.edge} · 外飘 ${l.speedOut} · 车头朝外 ${l.aimOut} · 上次挨撞 ${l.hitAgo}ms 前${l.dash ? " · 冲刺中" : ""}`
        );
      }
      if (log.length > 16) console.log(`   …共 ${log.length} 次`);
    }
    expect(LEVELS.length).toBeGreaterThan(0);
  });
});
