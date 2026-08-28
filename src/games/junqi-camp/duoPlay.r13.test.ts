import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

const IDX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-64 junqi-camp 双人确认行", () => {
  it("矮屏只收 .jq-duoplay 舞台,不动菜单四卡", () => {
    expect(CSS).toContain(".jq-duoplay .jq-stage{height:min(48dvh,220px);min-height:140px;}");
    expect(CSS).toContain(".jq-duoplay .jq-tools");
    expect(IDX).toContain('opts.rival === "human" ? "jq-wrap jq-duoplay"');
    expect(IDX).toContain(".jq-mode.jq-d{");
  });
});
