/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「星币旋转 / 远处退化成金点」与「道具泡泡看图标」讲进了攻略,
 * 钉住这句不被回退,同时钉住攻略结构没有被文案改动碰坏。
 * 第 3 轮终查:收集物叫法统一成任务栏的正式名「糖果币」(missionLabel:
 * 「吃到 N 颗糖果币」),攻略里不再混用「金币 / 星币」两个别名,快照同步更新。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("彩虹跑跑 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的糖果币旋转与道具图标讲给玩家(逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "糖果币会打着转:转到侧面只剩一条金棱,退到远处就缩成一个小金点,但它从头到尾都是金色的 —— 认准金光顺路收,别为看清它多看一眼路面之外。道具泡泡里画着磁铁、火箭或滑板,看图标就知道值不值得挪一条道。"
    );
  });

  it("文案改动没有碰坏攻略结构:十二段首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(12);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  // 第 2 轮:把 visual-r1 画制化的 HUD 心心(掉心从右往左灰)讲进攻略
  it("攻略把画制心心的读法讲给玩家(第 2 轮逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "顶栏右侧那排画制小心心是这一局的家底:撞一下就从右往左灰一颗,全灰就得重来——探险前先瞄一眼心心,再决定要不要为一枚糖果币冒险。"
    );
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });

  // 第 3 轮终查:攻略全文对收集物只用「糖果币」一个名字,不再出现「金币 / 星币」别名
  it("收集物叫法统一为任务栏正式名「糖果币」(第 3 轮终查钉子)", () => {
    const all = JSON.stringify(guide);
    expect(all).toContain("糖果币");
    expect(all).not.toContain("金币");
    expect(all).not.toContain("星币");
  });
});
