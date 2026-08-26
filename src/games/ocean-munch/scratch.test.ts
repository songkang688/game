import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulateEndless } from "./endless";

describe("scratch", () => {
  it("prints", () => {
    const lines: string[] = [];
    for (const seed of [1, 2, 7, 42, 99]) {
      const g = simulateEndless({ seed, seconds: 90, policy: "greedy" });
      lines.push(`greedy ${seed} ${JSON.stringify({ ...g, dex: g.dex.join("/") })}`);
    }
    for (const seed of [5, 6, 13, 21]) {
      const timid = simulateEndless({ seed, seconds: 200, policy: "timid" });
      lines.push(`timid ${seed} ${JSON.stringify({ ...timid, dex: "" })}`);
    }
    for (const seed of [3, 11]) {
      const rec = simulateEndless({ seed, seconds: 200, policy: "reckless" });
      lines.push(`reckless ${seed} ${JSON.stringify({ ...rec, dex: "" })}`);
    }
    writeFileSync("/tmp/scratch.txt", lines.join("\n"));
    expect(true).toBe(true);
  });
});
