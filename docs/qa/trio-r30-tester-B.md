# 三人组第 30 轮 · 测试修复员 B（N-150 / N-151）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：`trio-r30-playbook.md`。
> 不改 brave-path 战斗数值。保留 `touchUpliftCss([".bvp-btn"])`，后面叠 44（同气球 N-121）。
> N-108 ≠ `.pzt-eye`。N-105 零 hunk。三视口 390×844 / 915×412 / 1024×768。

## 本轮号账

| # | 状态 |
| --- | --- |
| **N-150** | `.bvp-btn` / `.bvp-btn-sm` / `.bvp-act` 叠 `min-height:44px` |
| **N-151** | `.pzt-eye,.pzt-undo` 与 `.pcp-act` 补 44 |

## 三视口

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.bvp-btn` / `.bvp-btn-sm`（进关顶栏） | **104–148 / 156–200 h44 IN** | **74–118 h44 IN** | **104–148 h44 IN** |
| `.bvp-act` 技能 | 夹具三档 **h44 IN**（kit 40 调用仍在，叠 44） | 同左 | 同左 |
| `.pzt-eye` / `.pzt-undo` | **305–349 h44 IN** | **197–241 h44 IN** | **227–271 h44 IN** |
| `.pcp-act` 结算 | 夹具三档 **h44 IN** | 同左 | 同左 |

## 测试

`hotspot.r27b.test.ts` 断言 kit 调用 + 叠层 44。window6 `touchUpliftCss([".bvp-btn"])` 守门仍绿。

## 护栏（r27–r30 合计）

未改存档 key / meta.id / 题库 / seed / 胜负 / 物理 / `SKY_H` / combo-clash / mahjong-bloom / kit / `level99.ts` / `home.ts`。
