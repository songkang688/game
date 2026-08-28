/**
 * N-58：壳层暂停后再点跳关，不得叠 .dialog--pause 与 .dialog--gate。
 * 开门前先关暂停并 resume；dialogs 按钮语义 / 冷静期零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SHELL = readFileSync(fileURLToPath(new URL("./gameShell.ts", import.meta.url)), "utf8");
const DIALOGS = readFileSync(fileURLToPath(new URL("./dialogs.ts", import.meta.url)), "utf8");

describe("N-58 暂停 + 跳关确认门套娃", () => {
  it("requestSkip 先 releaseShellPause 再开家长门", () => {
    const body = /export async function requestSkip[\s\S]*?^registerLevelExtras/m.exec(SHELL)?.[0] ?? "";
    expect(body).toContain("releaseShellPause?.()");
    expect(body).toContain('requestParentAuth("high"');
  });

  it("暂停释放会 closePause 并 tellGame resume，Esc 一次只面对家长门", () => {
    expect(SHELL).toContain("N-58");
    expect(SHELL).toMatch(/releaseShellPause = \(\) => \{[\s\S]*closePause\(\);[\s\S]*tellGame\("resume"\)/);
    expect(SHELL).toContain("releaseShellPause = null");
  });

  it("dialogs 冷静期与按钮 class 未改", () => {
    expect(DIALOGS).toContain("export const CLICK_GUARD_MS = 400");
    expect(DIALOGS).toContain('b.className = `btn ${btn.kind === "ghost" ? "btn--ghost" : "btn--primary"}`');
  });
});
