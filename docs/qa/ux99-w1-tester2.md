# UX-99 Wave1 · 测试修复员 #2（另一条路径）交卷

> 分支 `cursor/tester2-mobile-fit-9ad5` → `game-1.3`。进场主干 `e58ccceb`。
> 路径:关卡选择页排布 / 关内 HUD·暂停·胜负弹层 / 滚动 / 输入手势 / 性能 / 逻辑。
> 工具:vite preview + puppeteer-core(真 Chrome),主测视口 **390×844**(手机竖屏,触屏)与 **915×412**(平板横屏,触屏),抽测 320×568、844×390。

## 测试清单(全部游戏覆盖)

| 项 | 覆盖 | 方法 | 结果 |
| --- | --- | --- | --- |
| 冒烟:控制台错误 / 页面异常 / 资源加载失败 | **76 款 × 2 视口** | 逐款进入,收 console/pageerror/requestfailed | ✅ 0 报错 0 资源失败 |
| 横向溢出 / 元素出界 | 76 款 × 2 视口 | `getBoundingClientRect` 全元素扫 | ✅ 0(修后) |
| l99 选关地图:列数 / 节点尺寸 / 滚到底 / 最后一关可达 | 59 款闯关 × 2 视口 | 量 `.l99-grid/.l99-node/.l99-view` | ✅ 竖屏 5 列节点 57–61px,横屏 8 列 76px,全部滚得到底 |
| 过小热区(<38px 可见按钮) | 76 款 × 2 视口 | 全 button 扫 | 4 款有伤 → 已修,回归 0 |
| 胜负弹层(真实过关/真实失败) | memory-cards 通关、math-farm 答错到失败 × 2 视口 | 真点牌配对 / 真点错选项 | 修前 915×412 胜利弹层 3 钮全出屏 → 已修,回归全进屏(bottom 384≤412) |
| 暂停面板 | 6 款代表(闯关/跑酷/答题/格斗/双人/棋)× 2 视口 | 点 ⏸ 量弹窗与按钮,Esc 恢复 | ✅ fits,按钮 ≥44px,Esc 正常 |
| 主页滚动 | 390×844 / 320×568 / 915×412 | 滚到底,量 footer 与 hOverflow | ✅ 无溢出,footer 可见;320 家长门出界 → 已修 |
| 横竖屏切换 | **76 款**:390×844 → 844×390 → 旋回 | 每步量出界元素 | ✅ 0 款布局崩(brave-path 一次瞬态读数,复测 ×5 稳定在屏内) |
| 性能 | rainbow-run / ocean-munch / duo-rush 进关实测 | rAF 帧率 + PerformanceObserver longtask 5s | ✅ 60fps、0 长任务;分包健康(单游戏 chunk ≤120K) |
| 逻辑:过关判定 / 进度 / 关卡顺序 | memory-cards 真打 | 通关→星入档([3,0,0])→下一关是第 2 关→回地图第 1 关 3 星第 2 关 cur 第 3 关锁→刷新后进度还在 | ✅ |
| 逻辑:失败不写档 | math-farm 真失败 | 失败后重试,存档仍 0 星 | ✅ |
| 逻辑:管理员直达 | kangkang 解锁 → 直达 50 → 直达 999 | 标题「第 50 关」;999 钳到 188;跳关不写星 | ✅ |
| 双击缩放 / 橡皮筋 | 全局 | 走查 CSS:body overscroll none,game-stage contain;iOS 无视 user-scalable=no | button 无 touch-action → 已修(全局 manipulation) |

## 问题与修复(5 批,均带守门测试)

1. **主干带入的 5 个守门测试失败**(r15 引入):`combo-clash .cc-info`、`mahjong-bloom .mj-goal` 矮横屏被压到 14px + nowrap,破 16px 正文红线。修:回 16px、解 nowrap、高度改 52px 自滚 / 2.6em 截断。**与 r18 N-105 分支(trio-r18-n105-c337)撞车,已 byte 级对齐其写法**,双方守门测试互相兼容,谁先合另一边都干净。
2. **模式按钮热区 32–37px**(同 N-47 类伤):`bumper-cars .bc-open/.bc-pick`、`fruit-catch .frc-open/.frc-back`、`memory-cards .mmc-open/.mmc-toggle`、`sky-squad .sks-mode` 补 `min-height:44px`。守门:`modeChips44.qa2.test.ts`。
3. **l99 胜负弹层矮横屏按钮全出屏**(915×412 实测 wrap 钳 276px、内容 ~330px,flex 居中溢出且滚不到顶):`justify-content:safe center` + `overflow-y:auto` 兜底,矮横屏头像/星星/标题收一档让按钮进屏;z-index 8→30 盖过游戏钉底 fixed 条(麻将手牌 z20),仍低于壳层 overlay(50)。守门:`l99Overlay.qa2.test.ts`。
4. **320px 屏弹窗出右界 7px**:`@media(max-width:340px)` 的 `.dialog{width:min(96vw,320px)}` 没扣 overlay 两侧 20px padding,改 `min(calc(100vw - 40px),320px)`。
5. **iOS 双击缩放**:全局 `button` 补 `touch-action:manipulation`(连点型玩法「下一关」/地鼠/点点在 iOS 上双击会缩放页面)。守门:`touchAction.qa2.test.ts`。

## 回归

- `npm test`:进场 19483 过 + **5 失败** → 交卷 **19496 全过**(新增 3 个守门文件,只增不减)。
- `npm run build` ✅。
- 修后复跑全量冒烟(76×2=152 项)**0 发现**;深度交互(真过关/真失败/暂停/主页)全绿。

## 残留项(建议下轮)

- 390×844 壳层顶栏 `.game-title` 被攻略/星星芯片挤到只剩表情(915 正常)。N-89 一脉归 A 工位管,未动。
- 915×412 选关地图初始滚动定位在当前关(N-39 既定),头部「继续」钮需上滑一屏才可见——行为符合历史验收,如要改需与 N-39/N-63 一起议。
- brave-path 旋转后偶发一次 getBoundingClientRect 瞬态越界读数(复测 5 次稳定),疑测量时机撞上重排,无用户可见影响,未修。
