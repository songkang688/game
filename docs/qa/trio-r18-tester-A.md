# 三人组第 18 轮 · 测试修复员 A 报告(壳层 + 闯关学习)

> 进场主干 `e58ccceb`,分支 `cursor/trio-r18-tester-a-4e78`。
> 工具:`npm run build && npx vite preview --port 4173` + puppeteer-core + Chrome。
> 视口:390×844 / 915×412 主测,360×640 / 1024×768 / 320×568 抽验。
> 管理员密码 kangkang(1 小时档)实测过门、直达、跳过全链路。

## 修了什么(按提交顺序)

| # | 问题 | 根因 | 修法 | 验收数字 |
| --- | --- | --- | --- | --- |
| A-1 | 基线 `npm test` 红 5:combo-clash `.cc-info` / mahjong-bloom `.mj-goal` 矮横屏缩到 14px,后者还锁 nowrap | r15/r16 矮横屏收高时顺手缩字 | 只收占位不缩字(16px 红线),`.mj-goal` 解锁 nowrap 改 2 行内滚 | `mobileText` / `window1-mobile-text` 全绿 |
| A-2 | 首页搜索框两个 ✕(Chrome 原生 cancel + 自定义清空钮) | `type=search` 原生钮没藏 | `::-webkit-search-cancel-button` 隐藏,只留 44×44 自定义钮 | 390/360 截图无双叉 |
| A-3 | 915×412 关内盘面剪死:sudoku `sp-cell b447→504`、lianliankan `llk-cell b479` 滚不到 | `.l99-wrap max-height:calc(100dvh-136px)` 连关内也钳 + `.l99-stage overflow:hidden` | 钳高改 `:has(.l99-map)` 只限地图态;连连看 `.llk-holder`、数独 `.sp-wrap` 矮横屏内部滚,数独模式说明行让位 | 滚到底可达 ✓;lianliankan 盘整版进 415;sudoku 露两行+sticky 工具 |
| A-4 | quiz99 系(math-farm 等)关内「选关/攻略/跳过/直达」整条抬头**看不见但收点击**(幽灵热区) | 游戏景片 `position:absolute;inset:0` 挂在 static 的 `.l99-stage` 里,锚到 `.l99-wrap` 把抬头条盖住 | `.l99-stage` 加 `position:relative` 建定位上下文 | 390:`l99-back t106 b150` 命中自身;915:`bar t66 b166` 全可见 |
| A-5 | **手机竖屏 6 款关内剪死**:junqi `jq-btn@878`、pool-stars `ps-shoot@934`、star-estate `se-deed@1074`、flight-chess `fc-pick@1085`、fruit-stack `fs-key@938`、hero-cards `hc-card@1030`(vh=844) | N-63 把滚条从 `.game-stage` 挪进 l99 内部后,关内长内容没有滚动出口(`.l99-stage-wrap overflow:hidden` 圆角裁死) | `.l99-stage` 基础规则改 `overflow-y:auto`(装得下不出滚条) | 6 款滚动源 `.l99-stage +132…+464`,滚到底全可达 ✓;bowling 亦收益 |
| A-6 | **每款游戏手机顶栏标题被挤成 3px 缝**(只剩表情+一条缝) | 异步挂载的「📖 攻略」钮(~100px)挤压 flex-basis:0 的标题 | 攻略钮拆 emoji+label 两 span,≤420px 只藏字(图标/aria/热区不变);标题装饰 emoji 同档让位;星星胶囊 82→59;gap 10→6 | 标题可见宽 3→85/98/120;`算数小农场` 全显 |

## 测过且通过(无需改)

- 首页 390/915/360/1024:能划到底(剩余 0)、无真横向溢出(tabs 为有意横滑+右缘渐隐)、热区全 ≥44、搜索空态/未知 `#/game/xx` 路由兜底回首页、无 JS 错误。
- 67 款闯关全量扫描(两视口第 1 关):除下表遗留外全部可达。
- 胜/负结算(math-farm 真打):浮层两视口 IN、按钮 48px、冷静期防误触、下一关/再试本关/回地图链路通。
- 暂停面板(10 款抽验):弹出/Esc 关闭/继续玩全通;家长门、管理员门 390/915 都整窗 IN;kangkang 后地图与关内直达/跳过行可见可点(915 关内 `admin t118 b162` 单行)。
- 攻略抽屉 390(底部半屏)/915(右侧栏)/360:关闭钮 44×44,不越界。
- 收藏心形 44×44、收藏区置顶显示、收藏册(小屋)390 竖排 / 915 横排正常。
- 麻将 `mj-goal` 改后单行 h21、手牌 fixed 钉底命中正常(N-75 无回退);N-63 保龄/hop-pads 地图聚焦回归 ✓;N-89 壳标题契约测试 ✓。
- `npm test` 1193 文件 / 19488 用例全绿(基线 2 文件红已修);`npm run build` 通过。

## 遗留(B 工位领地,勿重复开号;915×412 数字已留)

| 候选 | 现象 | 备注 |
| --- | --- | --- |
| xiangqi 闯关第 1 课 | 整列被挤 ~214px 宽,`xq-canvas t294 b532` 超底,座卡叠在棋盘上 | 与本轮框架改动无关(新旧样式坐标一致);shortLandscape.r10/r11 只测了对战面 |
| mole-pop 闯关 | 洞排 `mp-hole b457/675` 剪死无滚(定位系,不吃舞台滚条) | 打地鼠靠滚动玩不成,需按余高缩洞排 |
| alien-seek 闯关 | 工具排 `als-tool b446/498` 超底 | `als-list` 只滚 13px |
| snake-snack 闯关 | `sn-canvas b422` 底沿 22px 出视口 | 轻微 |
| star-estate 闯关 | `se-tile b512` 超底(N-3 族) | N-3 已有口径:只放大预览或略抬棋盘 |
| balloon-pop | `blp-balloon@426` 为上升中的移动目标,非死剪 | C-8 约束:禁改 `SKY_H` |

## 风险说明

- `.l99-stage` 新增 `overflow-y:auto` + `position:relative` 是框架级:全量 67 款两视口扫描 + 全套单测通过;理论上有游戏依赖「舞台永不滚」或「inset:0 锚到 wrap」的暗契约,若后续轮次发现个别游戏景片错位,按 A-4/A-5 的口径在该游戏内消化,勿回退框架。
- 地图态 `:has(.l99-map)` 需 Chrome 105+/Safari 15.4+(同块 N-37 已在用 `:has`,口径一致)。
