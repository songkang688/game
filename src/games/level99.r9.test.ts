import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ROOT_PERMANENT_EXPIRES_AT,
  ROOT_TTL_MS,
  clearRootSession,
  resetRoot12Extras,
  rootStatusLine,
  writeRootSession
} from "../ui/root12Contract";
import { ROOT_PERMANENT_NOTE } from "../ui/rootUnlock";
import { rootJumpNote } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const NOW = 1_700_000_000_000;

describe("N-38 直达小字永久态", () => {
  beforeEach(() => {
    resetRoot12Extras();
    clearRootSession(null);
  });

  it("限时态仍报剩余分钟（修前口径）", () => {
    expect(rootJumpNote(43 * 60_000, NOW)).toBe("管理员权限还剩 43 分钟");
  });

  it("永久开启不再把远未来时间戳换算成几亿分钟", () => {
    writeRootSession(ROOT_PERMANENT_EXPIRES_AT, null, "permanent");
    const remain = ROOT_PERMANENT_EXPIRES_AT - NOW;
    const note = rootJumpNote(remain, NOW);
    expect(note).toBe(ROOT_PERMANENT_NOTE);
    expect(note).toBe(rootStatusLine(NOW));
    expect(note).not.toMatch(/\d{5,}/);
    expect(note).not.toContain("4193047370");
  });

  it("限时会话过期后小字不再自称永久", () => {
    writeRootSession(NOW + ROOT_TTL_MS, null, "timed");
    expect(rootJumpNote(ROOT_TTL_MS, NOW)).toBe("管理员权限还剩 60 分钟");
    expect(rootJumpNote(0, NOW + ROOT_TTL_MS)).toBe("管理员权限还剩 0 分钟");
  });
});

describe("N-37 矮横屏 root 抬头收成一行", () => {
  it("只在 :has(.l99-jump) 时收紧，root 关布局零改", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".l99-stagebar:has(.l99-jump)");
    expect(SRC).toContain(".l99-stagebar:has(.l99-jump) .l99-jump-note{display:none;}");
    expect(SRC).toContain("flex-wrap:nowrap");
    const compact = SRC.slice(SRC.indexOf("/* N-37"));
    expect(compact).toContain(":has(.l99-jump)");
    expect(compact).toContain(".l99-stage-wrap:has(.l99-jump) .pyt-scene{height:44px;}");
    expect(compact).toContain(".l99-stage-wrap:has(.l99-jump) .tm-bar{margin-bottom:2px");
    expect(compact).not.toMatch(/\.l99-stagebar\{[^}]*padding:4px 8px/);
  });
});
