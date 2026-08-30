import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-111 fight-king 矮横屏菜单可滚", () => {
  it(".fk-root 矮横屏自滚,N-88 选人开打 sticky 不回退", () => {
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px){");
    expect(SRC).toContain(".fk-root{max-height:calc(100dvh - 88px);overflow-y:auto;}");
    expect(SRC).toContain(".fk-pick-versus .fk-versus-go{");
    expect(SRC).toContain("position:sticky;top:0;z-index:5;background:#fffdff;padding:6px 0;margin-bottom:8px;");
  });
});
