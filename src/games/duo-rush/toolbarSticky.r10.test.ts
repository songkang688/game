import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const MATCH = readFileSync(fileURLToPath(new URL("./match.ts", import.meta.url)), "utf8");

describe("N-40 duo-rush 赛道态工具条矮横屏常驻", () => {
  it("矮屏把 .dr-btns 钉在舞台底，不重钳画布", () => {
    expect(INDEX).toContain("@media (max-height: 500px)");
    expect(INDEX).toContain(".dr-btns");
    expect(INDEX).toContain("position: sticky; bottom: 0");
    const canvasRule = INDEX.slice(INDEX.indexOf(".dr-canvas"), INDEX.indexOf("}", INDEX.indexOf(".dr-canvas")));
    expect(canvasRule).not.toContain("max-height");
    expect(INDEX).toContain(".dur-padbtn");
  });

  it("赛道数学零触碰", () => {
    expect(MATCH).toContain("export function");
    expect(MATCH).not.toContain("sticky");
    expect(MATCH).not.toContain("dr-btns");
  });
});
