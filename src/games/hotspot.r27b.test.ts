import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r27–r30 B 热区票 CSS ≥44", () => {
  it("N-141 landlord .ld-btn 基础档 44（≠ N-104 .ld-back）", () => {
    const s = read("landlord-cards/index.ts");
    expect(s).toMatch(/\.ld-btn\{[^}]*min-height:44px/);
    expect(s).not.toMatch(/\.ld-btn\{border:none;border-radius:999px;min-height:42px/);
    expect(s).toContain(".ld-back{");
  });

  it("N-142 / N-144 fight-king 模式卡与选人芯片", () => {
    const s = read("fight-king/index.ts");
    expect(s).toMatch(/\.fk-mode\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.fk-ch\{[^}]*min-height:44px/s);
    expect(s).toContain(".fk-pick-versus .fk-versus-go{");
  });

  it("N-145 bowling .bl-btn、bumper 开局/选车（不回退 N-135 返回）", () => {
    const bowl = read("bowling-lane/index.ts");
    expect(bowl).toMatch(/\.bl-btn\{[^}]*min-height:44px/s);
    expect(bowl).toMatch(/\.bl-back\{[^}]*min-height:44px/);
    const bump = read("bumper-cars/index.ts");
    expect(bump).toMatch(/\.bc-open\{[^}]*min-height:44px/s);
    expect(bump).toMatch(/\.bc-pick\{[^}]*min-height:44px/s);
  });

  it("N-147 snake / puzzle 回选关（不碰 N-108 画廊）", () => {
    expect(read("snake-snack/index.ts")).toMatch(/\.sn-back \{[^}]*min-height: 44px/);
    const pz = read("puzzle-tiles/index.ts");
    expect(pz).toMatch(/\.pz-back \{[^}]*min-height: 44px/);
    expect(pz).not.toMatch(/N-108/);
  });

  it("N-148 hue-hand 抓牌、duo-vs-star 选角（.dvs-pad 42 保留）", () => {
    expect(read("hue-hand/index.ts")).toMatch(/\.hh-catch\{[^}]*min-height:44px/s);
    const dvs = read("duo-vs-star/index.ts");
    expect(dvs).toMatch(/\.dvs-pick\{[^}]*min-height:44px/s);
    expect(dvs).toContain(".dvs-pad button{min-width:42px;min-height:42px");
  });

  it("N-150 brave-path kit 40 保留并叠 44", () => {
    const s = read("brave-path/index.ts");
    expect(s).toContain('touchUpliftCss([".bvp-btn"])');
    expect(s).toContain(".bvp-btn,.bvp-btn-sm,.bvp-act{min-height:44px;}");
  });

  it("N-151 拼图窥图/撤销与王子结算 CTA", () => {
    expect(read("puzzle-tiles/index.ts")).toMatch(
      /\.pzt-eye, \.pzt-undo \{[^}]*min-height: 44px/,
    );
    expect(read("prince-princess/index.ts")).toMatch(/\.pcp-act\{[^}]*min-height:44px/s);
  });

  it("不回退 N-121/122/124/125/126/129/133/134/135/139", () => {
    expect(read("fruit-catch/index.ts")).toMatch(/\.frc-open \{[^}]*min-height: 44px/s);
    expect(read("balloon-pop/index.ts")).toContain(".blp-open,.blp-back{min-height:44px;}");
    expect(read("duo-rush/index.ts")).toContain("@media (max-width: 430px) and (min-height: 700px)");
    expect(read("red-blue-race/index.ts")).toMatch(/\.rbe-back \{[^}]*min-height: 44px/s);
    expect(read("shoot-range/index.ts")).toMatch(/\.shr-back\{[^}]*min-height:44px/);
    expect(read("mole-pop/index.ts")).toContain(".mp-open, .mp-back { min-height: 44px; }");
  });
});
