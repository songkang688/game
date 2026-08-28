# 三人组第 18 轮 · 测试修复员 A 报告(壳层 + 闯关学习,主档 390×844 竖屏)

> 进场:`e58ccceb`(全量测试 **5 红**)。出场:全绿 19488 通过。
> 实测:puppeteer-core + Chrome,视口 390×844(触屏)/ 915×412 / 1024×768 / 360×640。
> 管理员密码 kangkang:1 小时档与永久档均实测通过;N-77 相册、N-39/N-63/N-89 均回归无回退。

## 修了什么(每条附实测数)

| # | 问题(修前) | 修法 | 修后 |
| --- | --- | --- | --- |
| R18-1 | 进场 5 红:combo-clash `.cc-info`、mahjong-bloom `.mj-goal` 在矮屏块被压到 14px + nowrap,违反 16px 正文红线 | 删窄屏字号覆盖(守门允许「要么不写」);`.mj-goal` 去 nowrap/ellipsis,`max-height:1.3em` 单行裁切保矮屏 | mobileText / window1-mobile-text 全绿 |
| R18-2 | **390×844 关内标题条 247px**:管理员开着时攻略/跳过/直达/剩余提示竖堆 4 行,舞台只剩 483px,拼音题需内滚 478→345 | level99 新增 `@media (max-width:480px)`:关内 `.l99-tools` 收单行横滚、`.l99-jump-note` 藏(title/aria 保留) | 标题条 **116px**,舞台 **614px**,题目零内滚;915×412 走原 500px 档不变(bar 100px,选项 bottom 336 进屏) |
| R18-3 | 初次进图 `scrollIntoView` 把进度条与「开始冒险」CTA 卷出视口,顶上剩半个被裁按钮 | 当前关整格在 `.l99-view` 可视区内时跳过滚动(量不出矩形照旧滚,N-39 字符串守门与聚焦不回退) | 第 1 关时 CTA 首屏可见;深关照旧居中滚 |
| R18-4 | sudoku-petal 第 1 关 `.sp-msg` 超出舞台底 **114px**(模式条 tip+按钮占 ~160px) | ≤420px 模式钮收单行横滚、tip 收起(group aria-label 保留完整口径);level99 ≤480px 舞台 `overflow-y:auto` 竖滚兜底 | 舞台 450→**561px**,crop=ok;915/1024 tip 照常显示 |
| R18-5 | memory-cards `.mmc-open/.mmc-toggle` 热区 35–36px(<44 红线,N-47 同类) | min-height:44px | 无 <40px 热区;crop=ok |
| R18-6 | 390 顶栏游戏名被挤到 43px(一个字):攻略钮全宽 + 星星胶囊 82px | ≤420px:顶栏攻略钮 font-size:0 + `::before "📖"`(aria/44 热区不变)、返回与星星胶囊收内边距、gap 6px | 标题文本 43→**67px**;l99 地图工具行攻略钮仍带字 |
| R18-7 | 收藏册全屏档(≤640px)head/foot 贴屏无安全区;`.card-blurb` 等孩子读的字 11–13px | head/foot 补 `env(safe-area-inset-*)`;正文 16px、小标签/按钮 ≥14px | 390/915 无横溢、无小热区;N-59 双栏不回退 |

## 测过的面(390×844 为主)

- **壳层**:首页滚到底(12860px 全程无横溢)、分类/玩法/设备筛选、搜索(中文+拼音首字母)、收藏心形、最近玩过、收藏册(N-77:人物/宠物/装备页签)、暂停面板、攻略抽屉、家长算术门(2 题/45 秒)、kangkang 1 小时+永久、管理员解锁全章节并直进第 172 关。
- **闯关学习款逐个进关**:pinyin-train(胜/负结算、下一关、回地图状态同步 🚩1/188 ⭐2/564)、math-farm、word-garden、music-stars、color-fun、shape-kingdom、clock-house、find-diff、memory-cards、sudoku-petal。
- **壳改动回归(非学习 l99 抽查)**:hop-pads / balloon-pop / merge-2048 / orb-arena 全部 bar=116、无 crop、无横溢、无小热区。

## 未修与说明

- 章节页签 11 个在竖屏换 6 行:window6.r3 守门**明确禁止** `.l99-tabs` 横滚(可发现性先例),不动;地图可滚、CTA 在首屏,可接受。
- find-diff `.fdf-viewport` 内滚 19px:游戏自有放大视口 + 缩放滑杆,且舞台已可竖滚,不另修。
- 915 关内火车场景 44px 时「已挂 0/4 节」章挂在车厢上方:N-37 短横屏配方的既定取舍,不动。
