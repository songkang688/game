/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「星币旋转 / 远处退化成金点」与「道具泡泡看图标」讲进了攻略,
 * 钉住这句不被回退,同时钉住攻略结构没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("彩虹跑跑 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的星币旋转与道具图标讲给玩家(逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "星币会打着转:转到侧面只剩一条金棱,退到远处就缩成一个小金点,但它从头到尾都是金色的 —— 认准金光顺路收,别为看清它多看一眼路面之外。道具泡泡里画着磁铁、火箭或滑板,看图标就知道值不值得挪一条道。"
    );
  });

  it("文案改动没有碰坏攻略结构:十二段首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(12);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });
});
