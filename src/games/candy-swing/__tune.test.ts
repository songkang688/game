import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { LEVELS, chapterOf } from "./levels";
import { makeSim, playRecipe, runSim, searchCutTime } from "./sim";

// 临时调参用：跑一遍第 100 关以后的新关，把失败原因和终局位置打出来。
describe("tune", () => {
  it("report", () => {
    const from = Number(process.env.TUNE_FROM ?? 99);
    const to = Number(process.env.TUNE_TO ?? LEVELS.length);
    const out: string[] = [`LEVELS=${LEVELS.length} from=${from} to=${to}`];
    let bad = 0;
    for (let i = from; i < to; i++) {
      const lv = LEVELS[i];
      if (lv.solve.kind === "search") {
        const t = searchCutTime(i, lv.solve.tMax);
        if (t === null) {
          bad++;
          const w = makeSim(i);
          runSim(w, 1.0);
          const c = w.candy();
          out.push(
            `FAIL ${i + 1} ch${chapterOf(i) + 1} 「${lv.name}」 search tMax=${lv.solve.tMax}` +
              ` idle@1s=(${c.x.toFixed(0)},${c.y.toFixed(0)}) failed=${w.failed}`
          );
        }
        continue;
      }
      const w = playRecipe(i);
      if (!w.ate) {
        bad++;
        const c = w.candy();
        out.push(
          `FAIL ${i + 1} ch${chapterOf(i) + 1} 「${lv.name}」 ${lv.solve.kind}` +
            ` failed=${w.failed || "-"} end=(${c.x.toFixed(0)},${c.y.toFixed(0)})` +
            ` monster=(${lv.monster.x},${lv.monster.y}) stars=${w.collected.size}` +
            ` minD=${w.minMouthD.toFixed(0)} crossX=${w.crossX.toFixed(0)}`
        );
      }
    }
    out.push(`--- 共 ${to - from} 关，失败 ${bad} 关 ---`);
    writeFileSync("/tmp/tune.txt", out.join("\n") + "\n");
  });
});
