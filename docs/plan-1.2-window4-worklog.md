# 窗口 4 · B 档 · 工作计划（1.2 第 17B–21B）

工作分支：`game-1.2-window4`，基线 `origin/game-1.2`（55 款，`npm test` 158 文件 / 4456 用例）。
本窗口只做五格升级，做完即空闲；不写三轮验收报告，不碰别人的游戏目录。

| 步 | 档 | 游戏 id | 规格 | 独占目录 |
| --- | --- | --- | --- | --- |
| 17 | B | `adventure-king` | `docs/plan-1.2-step17-B-adventure-king.md` | `src/games/adventure-king/` |
| 18 | B | `mole-pop` | `docs/plan-1.2-step18-B-mole-pop.md` | `src/games/mole-pop/` |
| 19 | B | `bubble-pop` | `docs/plan-1.2-step19-B-bubble-pop.md` | `src/games/bubble-pop/` |
| 20 | B | `fruit-slice` | `docs/plan-1.2-step20-B-fruit-slice.md` | `src/games/fruit-slice/` |
| 21 | B | `puzzle-tiles` | `docs/plan-1.2-step21-B-puzzle-tiles.md` | `src/games/puzzle-tiles/` |

## 每一格的施工要点

### 17B `adventure-king`「冒险小王」
- 新增 `explore.ts` 探索层：六种解谜物件（钥匙门 / 推箱压板 / 颜色开关 / 跷跷板 / 隐藏墙 / 传送门配对）各一组纯函数。
- 已探索留痕 + 可折叠小地图；秘密房独立计数。
- 贴纸图鉴序列化往返（新存档 key `yiduo-yixing.adventure-king.album.v1`，只增不改老 key）。
- 不卡死：房间求解器（钥匙 / 压板推箱 BFS 的不动点）判定死局，给「一键复位本房间」，不扣星。
- 无尽「无尽古堡」：房间模板库 ≥ 12，随机拼接后必须通过连通性与钥匙可达校验；成绩走 `save.recordEndlessBest`。
- 188 关战役与前 99 关生成参数一个字不改。

### 18B `mole-pop`「地鼠嘭嘭」
- 三档判定窗口（Perfect / Good / 擦边）纯函数化。
- 谱面数据化（出洞时间表 + 洞位 + 类型），后段靠节奏型变化而非单纯提速。
- 角色体系补齐：普通鼠 / 帽子鼠 / 闪光鼠 / 花花兔（不能打）/ 群鼠。
- 连击倍率封顶；无尽「地鼠夜市」seeded 生成。
- 前 99 关谱面不改。

### 19B `bubble-pop`「泡泡噗噗」
- 塌陷时间线状态机：消除 → 下落（错峰）→ 左移 → 稳定，禁止一次 render 直达终态。
- 按住预览高亮整个连通群与预计得分。
- 死局检测 + 「吹一口气」重排；三种特殊泡（彩虹 / 冰 / 连锁）。
- 无尽「泡泡海」底部上推；`meta.modes` 补 `endless`。

### 20B `fruit-slice`「水果切切乐」
- 线段相交切割判定（补高速采样）+ 最短划动阈值。
- 连刀窗口 800ms、可累计封顶；抛物线可及性断言。
- 特殊目标：冰冻果 / 双倍果 / 花朵（不能切）/ 连体果。
- 无尽「水果暴风」seeded 渐进。

### 21B `puzzle-tiles`「拼图乐园」
- 吸附阈值 = 格宽 × 0.35 + 磁性滑入；放错轻轻弹回不惩罚。
- 预览三档（半透明底图 / 角落缩略图 / 无预览），不改三星标准，只给挑战徽章。
- 后段碎片带角度，旋转状态进存档与撤销栈。
- 大图中途续拼存档（`yiduo-yixing.` 前缀），坏数据降级。
- 无尽「拼不完的画」片数递增。

## 公共纪律
- 每款升级新增单测 ≥ 18（规格下限），用例总数只增不减。
- 每做完一款：`npm test && npm run build` 全绿再进下一款。
- 只推 `game-1.2-window4`，禁止 force push、禁止改 `main`、禁止用 `gh` 开/改/合 PR。
- 商标黑名单零命中，无血无伤无死亡，失败只鼓励；离线可玩、不加运行时依赖。
