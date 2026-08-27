# 1.2 第 15 步 · A 档 —— `bomb-buddies`「泡泡炸弹人」升级计划

规格:`docs/plan-1.2-step15-A-bomb-buddies.md`。工作基线 `origin/game-1.2-window3`,只往这条线推。
只改 `src/games/bomb-buddies/**`,不碰 `snow-fight` / `bumper-cars` / `bowling-lane` 与任何平台文件。

---

## 一、现状审查(规格第三节六问,先给结论再动手)

1. **贴边转向补正:没有。** `tryStep` 只看「当前格朝 dir 的那一格能不能站」,拐不过去就原地卡住,
   连一格的容差都没有,`moveT` 还会被罚 60ms 冷却 —— 走廊拐角处越急越拐不过去,正是最挫败的地方。
2. **时间线:引信 `FUSE_MS = 2400`,爆风留场 `FLAME_MS = 460`,没有膨胀段。**
   连锁做了(`chainBombs` 纯函数 + `explodeBombs` 一次算完),但是**同一帧瞬间全炸**,
   看不出「一颗带一串」的节奏,也没有可断言的连锁顺序。
3. **道具 6 种**:`fire` / `bomb` / `speed` / `kick` / `ghost` / `remote`,**已经有踢泡与穿泡,缺护盾**。
   掉落 `rollItem(seed, cell, richness)` 是纯哈希,同一颗种子同一格永远同一件,可复现 ✅。
4. **五种模式都能玩到结算** ✅:`smoke.test.ts` 已经用逻辑层把闯关(含出口关 / 泡泡王关)、
   合作关、无尽前三轮、双人对战、三档人机各打到真实结算。但 `coop` 目前只是「两个人各打各的」,
   没有任何非做不可的配合动作 —— 有合作模式,没有合作理由。
5. **AI 会自保** ✅:`escapeAfterBomb` 会把「假如这颗泡泡已经放下」的世界算一遍,
   BFS 找不到安全格就不放。但三档之间只差「思考冷却」和「打不打人」,
   **没有封路、没有预判**,高档打起来跟普通档几乎一样。
6. **双人键位互不抢占** ✅:`KEY_MAP` 两套键零重叠,单人时两套都归 0 号;
   触屏每个座位一套独立方向盘,`setHold` 按座位隔离。但**手机 360px 上按钮只有 40×40**,
   够不到 44px 热区,而且没有踢泡钮。

---

## 二、这一版要做的事

| # | 项 | 落点 |
| --- | --- | --- |
| 1 | **转向补正** | `logic.ts` 新增 `TURN_ASSIST_CELLS = 0.5` 与纯函数 `turnAssist()`:请求方向被挡住时,若沿当前朝向对齐一格后就能拐过去,自动先走那一步。阈值常量 + 单测。 |
| 2 | **泡泡时间线** | `BUBBLE_GROW_MS = 400` / `BUBBLE_POP_MS = 2000` / `CHAIN_FRAMES = 3` / `CHAIN_STEP_MS`。`bubbleStage()` 给出膨胀进度;`chainWaves()` 给出可复现的连锁波次,整串连锁在 3 帧内走完。 |
| 3 | **道具 7 种** | 补 `shield`「泡泡护盾」:挡下一次被罩。`rollItem` 的老 6 件权重表**一个字节不动**(前 99 关掉落原样),第 100 关起与擂台 / 泡泡塔改用含护盾的 v2 池。 |
| 4 | **AI 三档 + 自保** | 保留 `escapeAfterBomb` 闸门并给三档都断言;高档新增 `foeEscapeCount()`(封路评分)与 `predictFoeCells()`(预判落点)。固定 seed 胜率断言:高档打轻松档胜率明显占优。 |
| 5 | **coop 救援** | `RESCUE_MS = 5000`:合作模式里被罩住的人 5 秒内可被队友拍破。队友贴着泡泡站 `RESCUE_TOUCH_MS` 就「啵」一声救出来,救人 +1 星,`rescues` 计数进结算。 |
| 6 | **无尽「泡泡塔」** | `buildTowerFloor(n)`:一层一张小地图,敌人渐强(种类 / 数量 / 速度三条线),撑到第几层记 `save.recordEndlessBest("bomb-buddies", n)`。老的 `buildEndlessRound` 保留不删。 |
| 7 | **窄屏可见** | `recipeFor` 加 `MAX_BOARD_SPAN`,让每张图在 360px 上都能用 ≥24px 的格子整屏显示;**前 99 关地图指纹逐关比对不变**(新增快照用例)。 |
| 8 | **手感与分级** | 泡泡膨胀呼吸、破裂是「啵」的彩虹波、砖变小花散开、被困角色头顶倒计时圈;`prefers-reduced-motion` 关闪烁。可见文案全面去掉火焰 / 爆炸 / 伤害的说法。 |
| 9 | **手机 360px** | `bmb-` 前缀重排:摇杆 + 放泡钮 + 踢泡钮不重叠、热区 ≥44px,双人上下分区。 |
| 10 | **平台接线** | `mount()` 返回 `openCampaignLevel(n)`;`initialLevel` / `?level=` 直达;Skip 继续走 188 框架的 `requestSkip`。 |
| 11 | **收尾** | CSS 局部 `<style>`(不改 `src/styles.css`);`destroy` 清 rAF / 监听 / 两套键位 / 朗读 / 状态;新增 ≥20 个用例。 |

## 三、不做的事

- **不做 2.5D**:爆风范围必须精确可读,保持 2D 俯视格子(规格第六节)。
- 不引入依赖,不自建 `AudioContext` / `setInterval`,音效只走 `api.play`。
- 不改 `src/styles.css`,不碰窗口 1 平台文件,不碰别人窗口的游戏目录。
- **前 99 关地图不动**:墙 / 砖 / 小怪 / 出口 / 藏品逐关指纹比对。
- 不删任何既有用例。

## 四、分级红线

泡泡不是炸药。**没有爆炸伤害、没有火焰、没有死亡**:被泡泡罩住 = 「困在泡泡里,队友可以拍破救你」,
破裂是「啵」的一圈彩虹波,砖块被波及是「变成小花散开」。失败只鼓励,无商标。

---

## 五、施工对账(收工时回填)

计划十一条全部落地,另外有四处是**真机上才露出来、计划里没写**的:

| # | 计划 | 实际落点 | 差异 |
| --- | --- | --- | --- |
| 1 | 转向补正 | `logic.ts` `TURN_ASSIST_CELLS = 0.5` + `turnAssistReach()` / `planTurn()` | 函数名从 `turnAssist` 拆成两个:一个算容差、一个出决策,好单测 |
| 2 | 泡泡时间线 | `BUBBLE_GROW_MS 400` / `BUBBLE_POP_MS 2000` / `CHAIN_FRAMES 3` / `CHAIN_STEP_MS`;`bubbleStage()`、`growProgress()`、`chainWaves()` | 照做 |
| 3 | 第七件道具 | `shield` + `ITEM_KINDS_V2` / `rollItemV2`;第 6 章起换池,擂台仍用 v1 | 擂台**不**发护盾:两个人各揣两层护盾会把对局拖成平局,实测过 |
| 4 | AI 三档 + 自保 | `canEscapeFrom()` 粗筛 + `escapeAfterBomb()` 定案;高档 `predictFoeCells()` / `foeEscapeCount()`;`AI_TUNING` 一张表列清三档差异 | 自保补了两处计划外的洞:算退路时要把**起步冷却 `moveT`** 算进去(2 秒引信下这半步就是生死),以及先绕开小怪、绕不开再退回原算法 |
| 5 | coop 救援 | `RESCUE_MS 5000` / `RESCUE_TOUCH_MS`;`rescuerFor()` / `popBubble()`;救人 +1 星 | 另加 `FREE_GRACE_MS`:刚被放出来有 900ms 彩虹光,否则会被同一只追追怪当场再罩一次 |
| 6 | 泡泡塔 | `buildTowerFloor(n)`,道具带着爬楼(`Carry` / `carryOf`),第 6 层起楼板往里收 | 照做,老的 `buildEndlessRound` 留着没删 |
| 7 | 窄屏可见 | `MAX_COLS` / `MAX_ROWS` = **13**(不是 15) | 计划里按「360 / 24 = 15」算,**错了**:360 的屏宽要先扣掉平台留白、舞台描边和本款内边距,真机上量下来只剩 315px,15×24=360 根本画不下。收到 13 之后前 99 关一格没动(本来最大就是 13×13),被收窄的只有第 100 关之后原本会长到 15 的那些图 |
| 8 | 手感与分级 | 膨胀 / 晃悠 / 绷紧三段 + 最后一秒倒数;彩虹波;砖散成小花;被困的人在泡泡里左右晃、头顶一圈倒计时;`prefers-reduced-motion` CSS 关过渡、画布这边 `matchMedia` 自己收住晃动 | 照做 |
| 9 | 手机 360px | 摇杆 + 放泡 / 踢泡 / 拍破三颗钮,热区 ≥44 | 计划以为「排得下」就完了。真机上**排下了也按不到**:平台的 `.game-stage` 是 `overflow:hidden` 的定高一屏,摇杆整块落在屏幕外面。棋盘高度因此改成量出来的(扣掉棋盘上方真实位置与下方提示条 / 摇杆实际高度),暂停钮搬进标题条腾出一行,矮屏提示条让位,救援条弹出时再重排一次 |
| 10 | 平台接线 | `openCampaignLevel(n)` / `initialLevel` / `?level=` / `requestSkip` | 直达关卡这条路原本没有跳关按钮,补了和 `tank-battle` 同一套家长门 |
| 11 | 收尾 | 局部 `<style>`;`destroy` 归零;**新增 120 个用例**(`upgrade12` 60 + `ai12` 16 + `runtime12` 44) | 用例数超出计划的 20 一大截,因为运行时那层得靠自带 DOM 桩(`domStub.ts`)才验得动 |

**同格重复提交**:rebase 到 `origin/game-1.2-window3` 时本款目录只有 1.1 的代码,没有别人推的 1.2 版本,
不存在需要合流的另一路实现。既有的 `logic.test.ts` / `levels.test.ts` / `ai.test.ts` / `smoke.test.ts`
一个用例都没删,只在新文件里做加法。
