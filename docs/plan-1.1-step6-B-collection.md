# 1.1 第 6 步 · 角色 B 工作计划(宠物 / 人物 / 装备收藏册)

只做**跨游戏通用的收藏养成系统**,不碰任何一款游戏的玩法。

## 独占范围(全部新建)

- `src/engine/collection.ts` —— 图鉴数据 + 存档 + 解锁/升级/穿戴规则
- `src/engine/collection.test.ts`
- `src/ui/collection.ts` —— 「小屋·收藏」面板,导出 `openCollection(scope?)`
- `src/ui/collection.test.ts`

## 明确不碰

- `src/games/rainbow-run/`(A 档)、`src/games/duo-rush/`(C 档)
- `src/ui/home.ts`(第 12 步已经留好探测式入口,按钮那边不用我改)
- `src/engine/save.ts`:`yiduo-yixing.save.v1` 的既有字段含义一个都不改,
  只把它当钱包用(`getStars` / `addStars`)
- `src/styles.css`:样式由 `ui/collection.ts` 自己注入一段带前缀的 `<style>`,
  和 `home.ts` 注入 `HOME_EXTRA_CSS` 的做法一致,避免和别的窗口抢同一个文件

## 数据口径

- 人物 ≥6(朵朵、星星 + 4 个原创角色),宠物 ≥6(各带一个温和被动),
  装备 ≥8(鞋 / 披风 / 帽子 / 护目镜 …,小幅数值加成)
- 角色名只用本作原创:朵朵、星星、糯糯、云云、墩墩、闪闪、绿绿豆、啾啾 …
  禁止任何商业商标与别家官方角色名
- 新存档 key:`yiduo-yixing.collection.v1`(只增不改老 key)
- 容错与 `save.ts` 同口径:坏 JSON / 坏字段一律降级为默认,
  隐私模式(localStorage 抛异常)降级为内存存储

## 数值口径

- 全套满级(全部装备穿满 + 满级宠物 + 满级人物)对任一属性的总加成
  **不超过基础值的 +35%**,写成单测断言,避免变成付费墙式养成
- 一次性效果(复活一次 / 起步无敌)不计入百分比加成,单独字段表达

## 面板口径

- 卡片式:已解锁 / 未解锁、解锁需要多少星、当前等级与升级花费
- 试穿预览:纯 Canvas 绘制的原创小人(无外部图片)
- `openCollection(scope?: string)`:任何游戏都能开,`scope` 只影响标题里的一句话
- 关闭 / `destroy` 之后不留任何全局监听

## 验收

- 新增测试 ≥ 20 个用例,`npm test` 全绿且用例只增不减
- `npm run build` 全绿
- 375×667 与 1280×800 都能开能关
