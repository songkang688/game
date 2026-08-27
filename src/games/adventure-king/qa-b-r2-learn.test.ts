/**
 * 窗口 4 · 档B · 第 2 轮学习优化员 —— 冒险小王
 *
 * 落地 B2-01：无尽古堡不再连着发同一张房间模板。
 */
import { describe, expect, it } from "vitest";
import { ROOM_TEMPLATES, buildCastleRoom, solveRoom, templatePoolFor } from "./explore";
import { seaColors, seaPushMs, seaTideRows } from "../bubble-pop/collapse";
import { stormPace } from "../fruit-slice/blade";
import { endlessWave } from "../mole-pop/levels";
import { endlessBoard } from "../puzzle-tiles/levels";

/** 照着 index.ts 的走法闯一趟古堡：一趟认一个种子，房号从 1 往上数 */
function walk(runSeed: number, rooms: number): string[] {
  const ids: string[] = [];
  for (let room = 1; room <= rooms; room++) {
    ids.push(buildCastleRoom(runSeed, room).template.id);
  }
  return ids;
}

describe("档B R2 学习优化员 · 冒险小王 · 无尽古堡不再连着重样", () => {
  it("400 趟 × 30 间：一次都不会「下一间还是刚才那间」", () => {
    // 改之前：11600 次换房里有 1514 次相邻重复（13.1%），396/400 趟至少撞一次，最长连开 5 间同一张图
    let repeats = 0;
    let worstRun = -1;
    for (let run = 0; run < 400; run++) {
      const ids = walk((run * 9973) % 100000 + 1, 30);
      for (let i = 1; i < ids.length; i++) {
        if (ids[i] === ids[i - 1]) {
          repeats++;
          if (worstRun < 0) worstRun = run;
        }
      }
    }
    expect(repeats, `第 ${worstRun} 趟起还会连着抽到同一张模板`).toBe(0);
  });

  it("只避开「上一间」，不是把模板轮着发：同一趟里该重的还是会重", () => {
    // 池子就 12 张，30 间房必然有重复；要禁的只是「挨着重」
    const ids = walk(7, 30);
    expect(new Set(ids).size).toBeLessThan(ids.length);
    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it("同一个种子仍旧完全可复现：纪录还能比", () => {
    for (const room of [1, 5, 18, 40]) {
      expect(buildCastleRoom(4242, room)).toEqual(buildCastleRoom(4242, room));
    }
  });

  it("每一间照样是走得通的房，前几间也照样只出简单模板", () => {
    for (let room = 1; room <= 60; room++) {
      const built = buildCastleRoom(room * 31 + 5, room);
      expect(solveRoom(built.state), `第 ${room} 间走不通`).toBe(true);
      const pool = templatePoolFor(room).map((t) => t.id);
      expect(pool, `第 ${room} 间发了池子外的模板`).toContain(built.template.id);
    }
  });

  it("过滤掉「上一间」之后池子也不会被掏空", () => {
    // 池子最少 3 张，去掉上一间还剩 2 张可挑；发出来的永远是库里真有的那张
    expect(templatePoolFor(1).length).toBeGreaterThanOrEqual(3);
    const known = new Set(ROOM_TEMPLATES.map((t) => t.id));
    for (let room = 1; room <= 120; room++) {
      const id = buildCastleRoom(room * 7 + 3, room).template.id;
      expect(known.has(id), `第 ${room} 间发出了库里没有的模板 ${id}`).toBe(true);
    }
  });
});

/**
 * 五款横扫：第 2 轮测试员发现「五款的无尽都会在某一轮之后彻底卡死在一个平台上」，
 * 这一条把结论钉住 —— 每一款都要么还在往上走，要么走到自己声明的下限才稳住。
 */
describe("档B R2 学习优化员 · 五款横扫 · 无尽后段不再有平台期", () => {
  interface EndlessProbe {
    /** 哪一款的哪个无尽玩法 */
    name: string;
    /** 原来在第几轮之后彻底不变 */
    oldCap: number;
    /** 把第 n 轮的配置拍成一个字符串，逐项比对用 */
    dump: (n: number) => string;
  }

  const PROBES: EndlessProbe[] = [
    {
      name: "地鼠嘭嘭 · 地鼠夜市",
      oldCap: 25,
      dump: (n) => {
        const c = endlessWave(n);
        return `${c.target}|${c.upMsMin}|${c.gapMs}|${c.maxConcurrent}|${c.bunnyChance}|${c.shieldChance}`;
      },
    },
    {
      name: "泡泡噗噗 · 无尽泡泡海",
      oldCap: 18,
      dump: (n) => `${seaPushMs(n)}|${seaColors(n)}|${seaTideRows(n)}`,
    },
    {
      name: "水果切切乐 · 水果暴风",
      oldCap: 22,
      dump: (n) => {
        const p = stormPace(n);
        return `${p.count}|${p.interval}|${p.bombChance}`;
      },
    },
    {
      name: "拼图乐园 · 无尽画廊",
      oldCap: 19,
      dump: (n) => {
        const b = endlessBoard(n);
        return `${b.rows}|${b.hints}|${b.moveLimit}|${b.timeLimit ?? "-"}`;
      },
    },
  ];

  it("四款讲难度的无尽在「原来的封顶点」之后都还在变", () => {
    for (const p of PROBES) {
      // 三种玩法轮着来的那款要跨过一整个轮换周期才比得出，统一取 +36
      const at = p.dump(p.oldCap);
      const later = p.dump(p.oldCap + 36);
      expect(later, `${p.name}：第 ${p.oldCap} 轮和第 ${p.oldCap + 36} 轮还是一模一样`).not.toBe(at);
    }
  });

  it("第五款讲的是花样：无尽古堡闯到多深都不会连着重样", () => {
    // 古堡的板子本来就不谈难度曲线（每间都是一道独立的小谜题），
    // 它原来的毛病是「下一间还是刚才那间」，所以这里查的是相邻重复
    for (const seed of [1, 20260827, 77771]) {
      const ids = walk(seed, 120);
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i], `seed=${seed} 第 ${i + 1} 间和上一间重样了`).not.toBe(ids[i - 1]);
      }
    }
  });

  it("五款一路走到 400 轮都排得出配置，没有一处会崩", () => {
    for (const p of PROBES) {
      for (const n of [1, 25, 60, 120, 400]) {
        expect(p.dump(n), `${p.name} 第 ${n} 轮排不出配置`).toBeTruthy();
      }
    }
    expect(buildCastleRoom(20260827, 400).template.id).toBeTruthy();
  });
});
